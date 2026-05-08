# Tesla FSD Production Deployment: Deep Research Report

> The largest-scale end-to-end autonomous driving system in production.
> Last updated: March 2026

---

## Table of Contents

1. [FSD V12/V13/V14 Architecture](#1-fsd-v12v13v14-architecture)
2. [Scale](#2-scale)
3. [Data Engine in Production](#3-data-engine-in-production)
4. [Hardware Generations](#4-hardware-generations)
5. [OTA Deployment](#5-ota-deployment)
6. [Safety Metrics](#6-safety-metrics)
7. [The V12 Transition](#7-the-v12-transition)
8. [Dojo](#8-dojo)
9. [Simulation and World Models](#9-simulation-and-world-models)
10. [Operational Limitations](#10-operational-limitations)
11. [Lessons for Airside Operations](#11-lessons-for-airside-operations)

---

## 1. FSD V12/V13/V14 Architecture

### 1.1 The End-to-End Paradigm

Tesla FSD V12 (released early 2024) marked the most consequential architectural shift in the system's history: the elimination of approximately **300,000 lines of C++ control code** and its replacement with end-to-end neural networks. The remaining code (~2,000-3,000 lines) exists only to activate and manage the neural network inference pipeline.

The core design principle: **raw camera pixels in, vehicle control commands out**. Instead of the traditional modular stack (perception -> prediction -> planning -> control), the neural network learns the entire driving task from human demonstration data.

As Elon Musk stated: *"There's no line of code that says there is a roundabout... There are over 300,000 lines of C++ in version 11, and there's basically none of that in version 12."*

### 1.2 V12 Architecture Details

The V12 technical architecture consists of:

- **48 distinct neural networks** working in concert
- **8 cameras** providing 360-degree surround coverage
- **1.3 gigapixels per second** processing throughput with near-zero latency
- **Bird's Eye View (BEV) transformations** converting 2D camera images into 3D spatial understanding
- **Occupancy networks** for volumetric environment representation
- Direct output of **steering angle, acceleration, and braking commands**

The system learns by observing millions of hours of human driving. Training requires **70,000 GPU hours** per complete cycle, processing over **1.5 petabytes** of driving data collected from the global fleet.

### 1.3 V13 Architecture (Late 2024 - 2025)

V13 introduced several architectural advances:

- **Temporal-Voxel transformer model** prioritizing long-term memory over instantaneous reaction
- Raw video input from eight cameras directly outputting vehicle control commands
- Integrated unpark and reverse capabilities (previously separate subsystems)
- Dynamic routing around road closures
- Ability to start FSD from Park
- Reduced photon-to-control latency

**Hardware divergence**: V13 was the first version where HW3 and HW4 received different builds. HW4 runs v13 natively in high-precision FP16 (16-bit floating point). To fit v13 onto HW3, Tesla employs aggressive **neural pruning and INT8 quantization**, introducing "quantization noise" that degrades performance.

**Performance**: HW4 platforms achieved ~450 miles between critical disengagements; HW3 platforms achieved ~120 miles (as of March 2026).

### 1.4 V14 Architecture (October 2025 - Present)

V14 represents the largest architecture leap since V12:

- **10x larger neural network model** than V13
- **Higher-resolution vision encoders** across all eight external cameras
- Richer video processing with less compression and more detail
- Smoother reasoning in edge cases
- Initial implementations of **reasoning capabilities** (e.g., navigation route changes during construction, parking option selection)
- **~3x more miles between critical interventions** compared to V13

V14 leans heavily on HW4, with **V14 Lite** being developed as a hardware-constrained adaptation for HW3 vehicles, expected Q2 2026.

### 1.5 Version Lineage Summary

| Version | Release   | Key Change                                      | Hardware  |
|---------|-----------|------------------------------------------------|-----------|
| V11     | 2023      | Modular stack, 300K lines C++                  | HW3/HW4   |
| V12     | Early 2024| End-to-end neural net, code elimination        | HW3/HW4   |
| V12.5   | Aug 2024  | Larger model, more parameters                  | HW3/HW4   |
| V13     | Nov 2024  | Temporal-voxel transformer, HW divergence      | HW3/HW4 (separate builds) |
| V14     | Oct 2025  | 10x model size, reasoning capabilities         | HW4 primary |
| V14 Lite| Q2 2026 (planned) | Constrained V14 for older hardware      | HW3       |

---

## 2. Scale

### 2.1 Fleet Size

- **5+ million vehicles** fitted with FSD hardware on the road
- **~2.8 million vehicles** on HW3 (manufactured ~2019-2022, accounting for scrappage from ~3 million produced)
- Every Tesla manufactured since January 2023 ships with **HW4**
- NHTSA's March 2026 investigation covers **3.2 million US vehicles** across Model S, 3, X, Y, and Cybertruck

### 2.2 FSD Miles Driven

Cumulative FSD (Supervised) miles, showing exponential growth:

| Year  | Annual Miles      | Cumulative  |
|-------|------------------|-------------|
| 2021  | ~6 million        | ~6M         |
| 2022  | ~80 million       | ~86M        |
| 2023  | ~670 million      | ~756M       |
| 2024  | ~2.25 billion     | ~3B         |
| 2025  | ~4.25 billion     | ~7.25B      |
| 2026  | ~1B (first 50 days) | **8.5B+** |

Current accumulation rate: **~20 million miles per day**.

Musk has cited **10 billion miles** as the threshold needed for safe unsupervised self-driving. At current rates, Tesla is on track to cross 10 billion miles by **mid-2026**.

### 2.3 Geographic Coverage

FSD (Supervised) is actively deployed in:
- **United States** (primary market)
- **Canada**
- **China**
- **Mexico**
- **Puerto Rico**
- **Australia**
- **New Zealand**
- **South Korea**

**Europe**: Pending. Netherlands expected to be first EU market (RDW approval targeted April 10, 2026). EU-wide rollout possible summer 2026, though realistically 2-3 major markets by year-end, with Germany and France likely Q1 2027.

### 2.4 Robotaxi Operations

- **Austin, Texas**: Robotaxi service launched June 22, 2025, with human safety monitors in modified Model Y vehicles
- **January 2026**: Began integrating **unsupervised vehicles** (no safety monitor) in limited numbers
- **~31 robotaxis** operating in Austin
- Vehicles are still **remotely monitored** and followed by chase vehicles
- First production **Cybercab** rolled off the line mid-February 2026
- Plans to expand to several major US cities in 2026

### 2.5 FSD Adoption

As of end of 2022, Tesla reported ~285,000 US/Canada customers who had purchased FSD, representing ~9% adoption among HW3 vehicles. Adoption has grown with subscription model and free trial periods.

---

## 3. Data Engine in Production

### 3.1 The Data Flywheel

Tesla's data engine is the core competitive advantage of the FSD program. It creates a closed-loop flywheel:

```
Deploy model to fleet
        |
        v
Shadow mode + active FSD collect data
        |
        v
On-vehicle filtering selects valuable clips
        |
        v
Upload to Tesla servers (owner opt-in)
        |
        v
Auto-labeling pipeline processes clips
        |
        v
Human review of escalated cases
        |
        v
Retrain neural networks
        |
        v
OTA deploy improved model
        |
        (repeat)
```

### 3.2 Shadow Mode

Shadow mode is the foundation of Tesla's data collection strategy:

- FSD runs **silently in the background** on all Tesla vehicles, **even when FSD is not engaged**
- The system constantly makes driving decisions **without controlling the car**
- Compares the neural network's intended actions against the human driver's actual actions
- When the human intervenes in a way the system did not anticipate (a **"hard clip"**), the scenario is automatically flagged

Hard clips constitute the most valuable, novel, and critical edge cases for training.

### 3.3 Data Collection Triggers

Data upload is triggered by several mechanisms:

1. **Disengagements**: When the human driver takes over from FSD
2. **Shadow mode disagreements**: When the passive system's prediction diverges from human behavior
3. **Aborts**: When FSD initiates a maneuver then cancels
4. **Crashes/near-crashes**: Automatically logged
5. **Targeted queries**: Tesla engineers can design specific triggers to collect data for identified problem areas (e.g., "find all clips of vehicles encountering temporary lane markings at construction sites")
6. **Fleet queries**: When an inaccuracy is identified, Tesla queries the fleet for more examples of similar scenarios

### 3.4 On-Vehicle Filtering

The first round of data selection happens **on the vehicle itself**:

- Raw driving data is large and costly to upload and store
- The vehicle runs lightweight classifiers to determine clip value
- Only high-value clips meeting trigger criteria are queued for upload
- Upload occurs when the vehicle is connected to Wi-Fi (owner opt-in)

### 3.5 Data Pipeline Scale

- **400,000 video clips per second** processed through the pipeline from the global fleet
- Datasets on the order of **1.5 petabytes** drawn from approximately 1 million clips per training cycle
- A typical dataset consists of synchronized camera frames from all 8 cameras plus temporal data (GPS, IMU)
- Owners opt in to sharing short video clips and analytics (not linked to VIN or account)

### 3.6 Auto-Labeling Pipeline

Tesla's auto-labeling system processes the vast majority of training data automatically:

1. **Object detection and classification**: Vehicles, pedestrians, cyclists, signs, signals
2. **Position, velocity, and acceleration tagging**: Every detected object is labeled with kinematic state
3. **3D reconstruction**: Using multi-camera geometry to build ground-truth 3D scene representations
4. **Contextual enrichment**: Weather conditions, time of day, road type, environment classification
5. **Human escalation**: Edge cases and uncertain labels are escalated for human review

LiDAR is occasionally used during the auto-labeling process to validate vision sensor accuracy and generate ground-truth depth maps, even though the production system is vision-only.

### 3.7 Fleet Learning Workflow

The fleet learning loop follows a structured process:

1. Vehicle identifies an inaccuracy or failure mode
2. Inaccuracy enters Tesla's **Unit Tests** to verify legitimacy (filtering out cases caused by poor human driving)
3. If legitimate, Tesla queries the fleet for more examples
4. Examples are correctly labeled (auto-labeled + human review)
5. Labeled data is used to retrain the neural network
6. Improved model is validated and deployed via OTA

---

## 4. Hardware Generations

### 4.1 Hardware 3 (HW3 / AI3) — 2019-2022

| Specification       | Value                          |
|---------------------|-------------------------------|
| CPU                 | 12x ARM Cortex-A72 @ 2.6 GHz |
| GPU                 | Mali GPU @ 1 GHz              |
| Neural Accelerator  | 2x systolic arrays @ 2 GHz   |
| AI Compute          | **36 TOPS**                   |
| RAM                 | 16 GB                        |
| Storage             | 256 GB                       |
| Power               | Up to **100W**               |
| Custom SoC          | FSD Computer 1 (Samsung 14nm)|
| Fleet Size          | ~2.8 million active vehicles  |

**Current status**: Tesla confirmed in early 2025 that HW3 cannot support future FSD versions. V14 Lite is targeted for Q2 2026 as a constrained port. Long-term upgrade path for HW3 owners who purchased FSD remains an open question.

### 4.2 Hardware 4 (HW4 / AI4) — 2023-Present

| Specification       | Value                          |
|---------------------|-------------------------------|
| CPU                 | 20 cores per side @ 2.35 GHz (idle 1.37 GHz) |
| Neural Accelerator  | Up to **50 TOPS**             |
| RAM                 | 32 GB                        |
| Storage             | 1 TB                         |
| Power               | Up to **160W**               |
| Custom SoC          | FSD Computer 2 (Samsung 7nm) |
| Cameras             | Higher resolution than HW3    |

HW4 runs V13/V14 natively in FP16. Significantly improved thermal management over HW3.

### 4.3 Hardware 4.5 (HW4.5 / AI4.5) — Late 2025/Early 2026

The existence of HW4.5 is debated. Key details:

- **Part Number**: 2261336-S2-A, priced at $2,300 in Tesla's Electronic Parts Catalog
- **Architecture**: **Three SoC (System-on-Chip)** design, up from the traditional dual-SoC configuration
- **Triple Modular Redundancy (TMR)**: Two chips can outvote a third in case of fault, improving resilience
  - If one chip hallucinates an obstacle but the other two see a clear path, the system votes to ignore the outlier
- **Shadow mode testing**: Third chip can run a newer, experimental FSD version in the background
- **Dual-redundant power supplies**: If a fuse blows, the car continues to drive
- **Up to ~50% more processing power** than HW4 (estimated)

**Status**: Tesla sales advisors initially stated the "AP45" marking was a labeling error. Tesla subsequently removed HW4.5 references from its public parts catalog. Whether HW4.5 is actively shipping remains ambiguous.

### 4.4 Hardware 5 (HW5 / AI5) — Late 2026 / Early 2027

| Specification       | Value                          |
|---------------------|-------------------------------|
| AI Compute          | **2,000-2,500 TOPS**          |
| vs. HW4             | **~4-5x more compute**        |
| Memory              | ~9x more than HW4             |
| Inference Latency   | Sub-5ms per cycle             |
| Power               | Up to **800W**                |
| Process Node        | TSMC N3P (3nm) or N2 (2nm); Samsung SF3 (3nm GAA) |
| Manufacturing       | **Dual-sourced**: TSMC (Taiwan/Arizona) + Samsung (Texas) |

**Timeline**: Originally planned for end of 2025, pushed to end of 2026 in Q2 2025, then pushed to early 2027 in January 2026. Musk has stated AI5 will be the **last hardware iteration installed in vehicles**.

**First application**: Cybercab robotaxi, where the higher compute enables additional safety and redundancy systems.

### 4.5 AI6 — In Development

- Tesla signed a **$16.5 billion deal** with Samsung for AI6 chip manufacturing (July 2025)
- Designed to scale from powering FSD and Optimus humanoid robots to high-performance AI training in data centers
- Represents the convergence of Dojo supercomputer technology into vehicle hardware
- Multiple AI6 chips clustered on single boards would form "Dojo 3" for training workloads

### 4.6 Hardware Comparison Summary

| Spec          | HW3       | HW4       | HW4.5 (est.)| HW5       |
|---------------|-----------|-----------|-------------|-----------|
| TOPS          | 36        | 50        | ~75         | 2,000-2,500|
| RAM           | 16 GB     | 32 GB     | 32 GB       | ~288 GB   |
| Storage       | 256 GB    | 1 TB      | 1 TB        | TBD       |
| Power         | 100W      | 160W      | ~200W       | 800W      |
| Process       | 14nm      | 7nm       | 7nm         | 3nm       |
| SoC Count     | 2         | 2         | 3           | TBD       |

---

## 5. OTA Deployment

### 5.1 Rollout Stages

Tesla delivers FSD software updates in a phased, progressive rollout:

1. **Internal (~0.1%)**: Factory employees and internal test vehicles receive builds first
2. **Early Access (~1%)**: Voluntary FSD Beta testers and early access program members for stress testing
3. **Canary (~5%)**: Non-Beta owners in low-risk regions (e.g., rural Nevada, Tennessee) to detect unusual hardware configurations
4. **Validation gate**: If no major severity-1 bugs emerge within **72 hours** of the ~6% deployment, Tesla proceeds
5. **Wide release**: Pushed to all supported vehicles in **waves over three days**

### 5.2 A/B Testing

Tesla conducts active A/B testing:

- Different FSD versions released simultaneously to different groups of testers
- Telemetry is compared between version cohorts to verify performance differences
- Shadow mode enables testing of new algorithms without enabling them in active control
- Recent example: FSD v14.2.2.3 initially limited to ~1.2% of the fleet; v14 rollout later reached 50%+ of eligible HW4 vehicles

### 5.3 Monitoring and Telemetry

- **Real-time fleet telemetry** streams performance metrics from every FSD-equipped vehicle
- Metrics tracked include: disengagement rate, intervention types, miles between critical events, near-miss frequency, comfort metrics
- Shadow mode data provides an additional comparison layer
- Tesla monitors for regressions across: geographic regions, hardware variants, weather conditions, road types

### 5.4 Rollback Capability

- Tesla employs **rapid rollback** capability to revert builds that produce problematic metrics
- Rollback builds can be pushed to affected vehicles via OTA
- The monitoring infrastructure enables Tesla to identify issues quickly and respond before wider fleet exposure
- NHTSA has used Tesla's OTA capability to mandate safety recalls (e.g., FSD Beta driving operations recall) delivered as software updates

### 5.5 Update Delivery Mechanics

- Updates delivered over **Wi-Fi or cellular** connection
- Vehicles can be scheduled to update at specific times (e.g., overnight)
- No dealership visit required
- Shortens the iterate-test-deploy cycle to **days or weeks** compared with traditional OEM release cadences of months or years
- FSD model weights and vehicle firmware are updated together as a unified software package

---

## 6. Safety Metrics

### 6.1 Tesla's Published Safety Data

Tesla publishes quarterly safety reports comparing FSD, Autopilot, and manual driving:

| Mode                    | Miles per Major Collision |
|-------------------------|--------------------------|
| FSD (Supervised)        | **5.3 million miles**     |
| Autopilot (highway)     | **6.36 million miles** (Q3 2025) |
| Manual (US average)     | **660,000 miles**         |

Tesla claims FSD users drive about **986,000 miles between minor collisions**, compared to ~178,000 miles for the average US driver.

**Safety multiplier**: Tesla claims FSD is **~7x safer** than manual driving for major collisions.

### 6.2 Disengagement Rates

Disengagement metrics have been volatile:

- **FSD v14.1** (October 2025): Peak of **4,109 city miles** per critical disengagement
- **FSD v14.2** rollout: Dropped to **809 miles** per critical disengagement (a significant regression)
- **HW4 with V13** (March 2026): ~450 miles between critical disengagements
- **HW3 with V13** (March 2026): ~120 miles between critical disengagements

The Q3 2024 benchmark showed **100x improvement** in miles between critical interventions with V12.5, with expectations of 1,000x improvement through V13.

### 6.3 Safety Data Criticisms

The safety statistics have faced scrutiny:

- **Selection bias**: FSD is primarily used on highways and well-maintained roads, not representative of all driving conditions
- **Metric definitions**: Tesla's definition of "crash" and "disengagement" may differ from NHTSA standards
- **Deterioration trend**: Q3 2025 Autopilot crash rate showed ~10% year-over-year decline compared to Q3 2024
- **Under-reporting**: NHTSA found that Tesla's internal software may **under-report "near-miss" events**, masking the true frequency of system failures
- Tesla has twice requested deadline extensions to hand over safety data to NHTSA (as of early 2026)

### 6.4 NHTSA Investigations (Active as of March 2026)

**Investigation 1: Visibility Degradation (EA26002)**
- Upgraded to **Engineering Analysis** on March 18, 2026 (the step before a potential recall)
- Covers **3.2 million vehicles** (Model S, 3, X, Y, Cybertruck)
- Core finding: FSD's degradation detection system fails to warn drivers when cameras are blinded by sun glare, fog, or airborne dust
- **9 crashes** identified (1 fatality, 1 injury), 6 additional incidents under review
- Tesla's own fix would have prevented only 3 of 9 crashes
- Fatal crash occurred November 28, 2023; Tesla filed required crash report **7 months later** (June 27, 2024)

**Investigation 2: Traffic Violations (PE25012)**
- Launched October 2025
- **58 reports** of FSD-equipped vehicles committing traffic violations
- Includes running red lights and crossing into opposing lanes

**Investigation 3: Robotaxi Incidents**
- 14 robotaxi incidents under review as of March 2026
- Focused on the Austin deployment

### 6.5 Historical Recall Actions

Tesla has issued multiple OTA recalls for FSD:
- Several safety recalls delivered as software updates (no physical recall needed)
- Most notable: recall addressing FSD Beta driving operations issues

---

## 7. The V12 Transition

### 7.1 What Changed

The V12 transition was the most significant architectural change in FSD history:

**Before (V11 and earlier)**:
- Modular architecture: perception, prediction, planning, control as separate subsystems
- ~300,000 lines of hand-written C++ rules
- Engineers manually programmed responses to every traffic sign, signal, and maneuver
- Stop sign behavior: hardcoded shape recognition and timing rules
- Traffic light compliance: color detection algorithms with explicit state machines
- Lane changes: explicit gap acceptance thresholds

**After (V12)**:
- Single end-to-end neural network pipeline
- ~2,000-3,000 lines of management code
- System learns responses from human demonstration data
- Stop sign behavior: learned contextual responses
- Traffic light compliance: contextual understanding of intersection dynamics
- Lane changes: probabilistic gap acceptance learned from human behavior

### 7.2 Key Technical Changes

1. **Perception-to-action collapse**: The separate perception, prediction, planning, and control modules were unified into a single learned pipeline
2. **Rule elimination**: If-then logic for thousands of driving scenarios replaced with learned behavior
3. **Probabilistic reasoning**: Hard thresholds (e.g., "change lanes if gap > 3 seconds") replaced with learned probability distributions
4. **Contextual understanding**: The network learned to interpret scenes holistically rather than processing individual objects in isolation

### 7.3 Challenges Encountered

**Interpretability**: When accidents occur, investigators need to understand why the system made specific decisions. Traditional code allows step-by-step analysis; neural networks offer only statistical correlations. This is a fundamental challenge for regulatory compliance and liability determination.

**Novel edge cases**: The AI excels at handling scenarios seen thousands of times in training data. However, when confronted with truly novel situations (confusing temporary lane markings, unusual vehicles, unexpected obstacles), it can become hesitant or make incorrect decisions.

**Unprotected left turns (UPLs)**: Historically the most challenging maneuver for autonomous systems. The end-to-end network improved UPL handling by learning probabilistic gaps rather than relying on hardcoded distance metrics, but early V12 testing showed inconsistency:
- Some attempts were smooth and confident
- Others showed creeping, hesitation, or overly aggressive gap acceptance
- Approaching headlights could confuse the system

**Regression management**: End-to-end models can fix one behavior while regressing another, making quality assurance more difficult than with rule-based systems where changes are localized.

**Training data distribution**: The network's competence is bounded by its training distribution. Rare scenarios (construction zones with contradictory signage, emergency vehicle interactions, unusual road geometries) remain challenging.

### 7.4 Benefits Realized

Despite challenges, the V12 transition delivered measurable improvements:

- **100x improvement** in miles between critical interventions (V12.5 vs V11)
- Dramatically smoother driving behavior
- Better handling of complex intersections
- More natural-feeling acceleration and braking profiles
- Faster iteration cycle (retrain the network vs. rewrite rules)
- Improved performance in rain (California, Texas, Florida drivers noted dramatic improvements)

---

## 8. Dojo

### 8.1 Vision and Design

Dojo was Tesla's custom-designed AI training supercomputer, announced at Tesla AI Day on August 19, 2021. The vision was to create purpose-built hardware optimized for the massive video training workloads required by FSD.

**D1 Chip Specifications**:
- **50 billion transistors**
- **645 mm^2** die size (near reticle limit)
- **TSMC 7nm** process
- **362 TFLOPS** at BF16/CFloat8
- **22 TFLOPS** at FP32
- **400W** thermal design power per chip

**Architecture**: 25 D1 chips formed a "training tile." Multiple tiles assembled into ExaPods. Each tile was a self-contained training unit with integrated high-bandwidth interconnect.

### 8.2 Investment

- Tesla announced plans to spend **$500 million** on a Dojo facility in Buffalo, New York
- Musk stated Tesla planned to spend **more than $1 billion** on Dojo through 2024
- TSMC began production of next-generation Dojo training modules, with a roadmap to 40x computing power increase by 2027

### 8.3 Timeline and Shutdown

| Date           | Event                                                    |
|----------------|----------------------------------------------------------|
| April 2019     | Dojo first mentioned by Musk at Autonomy Investor Day    |
| August 2021    | Official announcement at AI Day; D1 chip revealed        |
| September 2022 | First Dojo cabinet installed at AI Day 2; 2.2MW load test|
| July 2023      | Production started; $1B+ investment commitment           |
| August 2024    | Talk of Dojo abruptly ended; Musk pivoted to Cortex      |
| July 2025      | Q2 earnings call: Dojo 2 expected "operating at scale" in 2026 |
| July 28, 2025  | Tesla signed **$16.5B deal** with Samsung for AI6 chips  |
| August 7, 2025 | **Tesla disbanded the Dojo team**                        |
| August 11, 2025| Musk confirmed shutdown: "an evolutionary dead end"      |

### 8.4 Why Dojo Failed

Musk's explanation: *"Once it became clear that all paths converged to AI6, I had to shut down Dojo and make some tough personnel choices, as Dojo 2 was now an evolutionary dead end."*

It didn't make sense to "divide its resources and scale two quite different AI chip designs." The AI6 chip could serve dual purpose: both in-vehicle inference and data center training.

### 8.5 Team Fate

- **~20 employees** left to found **DensityAI**, a new AI startup focused on data center services
- **Peter Bannon** (Dojo lead) departed Tesla
- Remaining staff reassigned to other data center and compute projects within Tesla

### 8.6 What Replaced Dojo: Cortex

**Cortex** is Tesla's NVIDIA-based AI training supercomputer at Giga Texas:

| Specification      | Value                          |
|--------------------|-------------------------------|
| Initial GPUs       | 50,000 NVIDIA H100            |
| Q2 2025 Expansion  | +16,000 H200 GPUs             |
| Total Compute      | **~67,000 H100 equivalents**  |
| Power/Cooling      | 130MW at launch, scaling to **500MW** |
| Purpose            | FSD training + Optimus robot training |

**Cortex 2** is confirmed for Giga Texas with a 2026 timeline.

**Future**: AI6 chips in clustered configurations ("Dojo 3") are intended to eventually replace the NVIDIA GPU dependency, creating a unified chip architecture for both vehicle and data center use.

---

## 9. Simulation and World Models

### 9.1 Neural World Simulator

Tesla has developed a unified **neural world simulator** — a single end-to-end neural network trained on video, maps, and kinematic data from the vehicle fleet. Key capabilities:

- **Learns to synthesize high-fidelity video responses** to AI actions
- Creates **closed-loop simulations** to evaluate new AI models
- Enables **historical validation**: AI can diverge from recorded scenarios and demonstrate alternative decision-making paths
- Generates **adversarial scenarios** to test corner cases
- Supports large-scale **reinforcement learning** to achieve "superhuman performance"

The simulator is a functioning **world model** — trained entirely on video to predict future states. Tesla's AI chief Ashok Elluswamy has noted that "loss on open-loop predictions might not correlate to great performance in the real-world," motivating the closed-loop simulation approach.

### 9.2 Cross-Domain Transfer

The same simulator architecture **extends to Optimus** humanoid robot training:
- Generates realistic video of the robot navigating factory environments
- Provides a safe virtual environment for training robot AI
- Represents unified AI development across different physical embodiments

### 9.3 Synthetic Data Generation

Tesla's "Simulated Content" system generates synthetic training data guided by real-world data:

**Process**:
1. Extract **content model attributes** from ground truth data: road edges, lane lines, stationary objects, dynamic objects (vehicles, pedestrians)
2. Add **contextual information**: weather conditions, time of day, road type, environment
3. Generate **variations** by tweaking attributes: heavy traffic, construction zones, adverse weather (rain, fog, snow)
4. Introduce **adversarial scenarios**: sudden pedestrian crossings, unexpected obstacles, erratic driver behavior

**Benefits**:
- Cost reduction (avoids data transmission, storage, and labeling expenses)
- Enables training on rare but critical edge cases that occur too infrequently in real-world data
- Rapid iteration without waiting for real-world data collection
- Addresses geographic and regulatory constraints (especially critical for China where data export restrictions exist)

### 9.4 Reinforcement Learning and Reasoning

FSD V14.2 includes initial implementations of **reasoning capabilities**:
- Navigation route changes during construction
- Parking option selection
- These represent early steps toward AI decision-making that goes beyond pattern matching

Tesla is actively exploring how reinforcement learning within the world simulator can bridge the gap between accumulated real-world miles and the performance needed for unsupervised autonomy.

---

## 10. Operational Limitations

### 10.1 Weather and Visibility

Visibility is critical for FSD operation. The system's performance degrades significantly in:

- **Heavy rain**: Camera lens occlusion and reduced visibility
- **Fog**: Loss of depth perception and object detection range
- **Snow**: Lane markings obscured, road boundaries unclear
- **Direct sun glare**: Camera saturation, especially at sunrise/sunset
- **Dust storms**: Particulate matter reduces camera effectiveness
- **Low light**: Reduced ability to detect objects at distance

Tesla recommends temporarily disabling FSD or switching to basic Autosteer during heavy fog, intense glare, dust storms, or heavy rain.

**NHTSA finding**: The system's degradation detection mechanism fails to adequately alert drivers when common road conditions impair camera visibility. In reviewed crashes, FSD did not detect visibility impairment or provide alerts until immediately before the crash.

### 10.2 Geofencing

Unlike Waymo and Cruise, **Tesla does not geofence FSD**:

- FSD is capable of navigating roads that have never been traveled by another Tesla
- No operational design domain (ODD) restrictions based on geography
- This is both a strength (universal availability) and a risk (no guaranteed performance boundaries)

**Exception**: In Europe, conditional relaxation of geofencing is being considered based on regulator-reviewed performance data for the initial rollout.

### 10.3 Disengagement Conditions

FSD automatically disengages when:
- Driver shifts out of Drive
- A door or trunk is opened
- Automatic Emergency Braking (AEB) activates
- Driver's seatbelt is released or driver leaves seat
- Driver fails to respond to repeated attention reminders
- Camera becomes obscured
- System encounters a scenario beyond its confidence threshold

### 10.4 Driver Monitoring

FSD remains **strictly supervised** (SAE Level 2+):

- **Cabin camera** continuously monitors driver eye gaze and head position
- Looking away for more than a few seconds triggers visual and audible warnings
- Progressive escalation: visual alert -> audible chime -> forced disengagement
- Multiple disengagement events can result in temporary FSD lockout

### 10.5 Known Weak Spots

Based on NHTSA data and user reports:
- **Construction zones** with contradictory or temporary signage
- **Emergency vehicle** interactions
- **Unusual road geometries** (complex multi-lane roundabouts, non-standard intersections)
- **Sensor degradation** in rain/fog without adequate driver warning
- **Highly variable lighting** (tunnel exits into bright sun)
- **Pedestrians in unexpected locations** or unusual appearances

---

## 11. Lessons for Airside Operations

### 11.1 Data Engine Architecture

Tesla's data engine provides a proven template for airside AV deployment:

**Applicable pattern**: Deploy vehicles with always-on perception and shadow mode. Collect edge cases automatically. Build an auto-labeling pipeline. Retrain and redeploy via OTA.

**Airside adaptation considerations**:
- Airside environments are more constrained than public roads (known layout, controlled access), making shadow mode even more effective
- Smaller fleet size means each vehicle's data is more valuable — trigger criteria should be more aggressive
- Airport-specific edge cases (jet blast, ground equipment movements, apron markings under snow) need targeted trigger design
- Regulatory environment differs (airport authority oversight vs. NHTSA/state DMV), potentially enabling faster iteration

### 11.2 Fleet Learning

**Key Tesla patterns to adopt**:
1. **Centralized training, distributed inference**: Train models in the cloud, deploy to vehicles via OTA
2. **Continuous evaluation**: Shadow mode running on all vehicles, even when not in autonomous mode
3. **Targeted data mining**: Query the fleet for specific scenario examples when a failure mode is identified
4. **Hardware headroom**: Ship vehicles with more compute than initially needed (Tesla shipped HW3 years before FSD was capable)

**Airside-specific considerations**:
- Fleet sizes are much smaller (tens of vehicles vs. millions), requiring more deliberate data collection strategies
- Operating environment is more repetitive, which means the training distribution converges faster
- Safety-critical scenarios (aircraft proximity, FOD on taxiways) need explicit trigger design and can't rely on statistical rarity alone

### 11.3 OTA Model Management

**Tesla patterns to adopt**:
1. **Phased rollout**: Internal -> canary -> limited -> wide release
2. **Telemetry-driven gating**: Automated metrics must pass thresholds before wider deployment
3. **72-hour hold**: Observe canary performance for a defined period before proceeding
4. **Rapid rollback**: Infrastructure to revert to previous model version within hours
5. **A/B testing**: Run different model versions simultaneously on fleet subsets

**Airside adaptations**:
- Smaller fleet means canary groups may be a single vehicle
- Operating environment consistency allows more targeted validation (e.g., test on specific apron zones)
- Regulatory approval for model updates may require additional documentation beyond Tesla's process
- Consider maintaining N-1 and N-2 model versions for rapid fallback

### 11.4 Hardware Strategy Lessons

**Key takeaways from Tesla's hardware evolution**:
1. **Over-provision compute**: Tesla's regret with HW3 (shipping 36 TOPS when they needed 2,000+) is a cautionary tale
2. **Redundancy matters**: HW4.5's triple modular redundancy and dual power supplies reflect the safety requirements for unsupervised operation
3. **Plan for model growth**: Neural network size has grown 10x between V12 and V14; airside models will grow similarly
4. **Vision-only has limits**: NHTSA's visibility investigation highlights risks of camera-only systems in degraded conditions — airside operations in fog, rain, and jet blast environments may benefit from sensor fusion (LiDAR, radar)

### 11.5 Safety and Validation Approach

**Lessons from Tesla's safety challenges**:
1. **Define clear metrics early**: Tesla's shifting metric definitions create confusion; establish consistent safety KPIs from day one
2. **Transparent reporting**: Tesla's data reporting delays and potential under-reporting damage regulator trust
3. **Degraded mode handling**: Proactive degradation detection and graceful handoff are critical (Tesla's failure here led to a 3.2M vehicle investigation)
4. **Scenario-specific validation**: Test against a defined ODD rather than claiming universal capability
5. **Independent validation**: NHTSA's findings suggest self-reported metrics are insufficient; consider independent safety assessment

### 11.6 What Not to Copy

1. **No geofencing**: Airside operations should maintain strict geofencing (apron boundaries, exclusion zones near active runways)
2. **Vision-only dogma**: Airport environments benefit from multi-modal sensing (LiDAR for FOD detection, radar for weather penetration, ADS-B for aircraft awareness)
3. **Consumer-grade driver monitoring**: Airside operations need deterministic safety monitoring, not probabilistic attention detection
4. **Shipping before ready**: Tesla's pattern of aggressive timelines and missed deadlines erodes trust; airside deployments must meet safety cases before operational deployment
5. **Metric opacity**: Airside operations require transparent, auditable safety reporting for airport authority and aviation regulator approval

### 11.7 What to Copy

1. **Data flywheel architecture**: The closed-loop pipeline from fleet data collection to model improvement
2. **Shadow mode**: Running candidate models passively against real operational data
3. **OTA model deployment**: Continuous improvement without physical intervention
4. **Synthetic data for edge cases**: Generating rare scenarios (near-miss with aircraft, unusual ground vehicle paths) that can't be safely collected in production
5. **World model for simulation**: Building a learned simulator of the operational environment for closed-loop evaluation
6. **Phased rollout with automated gating**: Preventing regressions from reaching the full fleet

---

## Sources

### Architecture
- [Tesla's Neural Network Revolution: How Full Self-Driving Replaced 300,000 Lines of Code with AI](https://www.fredpope.com/blog/machine-learning/tesla-fsd-12)
- [The FSD v13 Paradox: Testing HW3 Limits and the AI4 Future](https://www.teslaacessories.com/blogs/news/the-fsd-v13-paradox-testing-hw3-limits-and-the-ai4-future)
- [The FSD V12.4 Paradigm Shift](https://www.teslaacessories.com/blogs/news/the-fsd-v12.4-paradigm-shift-unpacking-the-end-to-end-ai-architecture-impact-on-urban-driving-and-safety-metrics)
- [Breakdown: How Tesla will transition from Modular to End-To-End Deep Learning](https://www.thinkautonomous.ai/blog/tesla-end-to-end-deep-learning/)
- [Tesla FSD V14 Lite Coming Summer 2026](https://www.basenor.com/blogs/news/tesla-update-v14-lite)
- [Evolution of Tesla's Driving Autonomy System](https://www.allpcb.com/allelectrohub/evolution-of-teslas-driving-autonomy-system)

### Scale and Miles
- [Tesla FSD Hits 8.5 Billion Miles](https://www.basenor.com/blogs/news/tesla-fsd-hits-8-5-billion-miles-what-this-means-for-owners)
- [Tesla FSD Passes 8 Billion Miles](https://www.basenor.com/blogs/news/tesla-fsd-passes-8-billion-miles-the-massive-data-gap-widens)
- [Tesla's FSD Software Logs 1 Billion Miles in First 50 Days of 2026](https://eletric-vehicles.com/tesla/teslas-fsd-software-logs-1-billion-miles-in-first-50-days-of-2026/)
- [Total Full Self-Driving Miles Tracker](https://fsdmiles.com/)
- [Tesla FSD Fleet Nears 7 Billion Miles](https://www.teslarati.com/tesla-fsd-fleet-nearing-7-billion-total-miles-including-2-5-billion-city-miles/)

### Data Engine
- [How Tesla Turned Every Driver Into a Data Source](https://www.economyinsights.com/p/how-tesla-turned-every-driver-into-a-data-source)
- [Tesla's FSD Shadow Mode: What It Is and How It Improves FSD](https://www.notateslaapp.com/news/3108/teslas-fsd-shadow-mode-what-it-is-and-how-it-improves-fsd)
- [Autonomous Vehicle Training & Tesla's Data Engine](https://www.arrow.com/en/research-and-events/articles/autonomous-vehicle-training-and-teslas-data-engine-explained)
- [How Tesla Will Automate Data Labeling for FSD](https://www.notateslaapp.com/news/2455/how-tesla-will-automate-data-labeling-for-fsd)

### Hardware
- [Tesla Autopilot Hardware — Wikipedia](https://en.wikipedia.org/wiki/Tesla_Autopilot_hardware)
- [Tesla Hardware 4 (AI4) — Full Details](https://www.autopilotreview.com/tesla-hardware-4-rolling-out-to-new-vehicles/)
- [HW 4.5 vs. HW 3.0: The Inconvenient Truth](https://www.teslaacessories.com/blogs/news/hw-4.5-vs.-hw-3.0-the-inconvenient-truth-about-the-path-to-unsupervised-autonomy)
- [Tesla FSD Hardware 4.5 Appears: A 3-Chip Upgrade Before AI5?](https://www.notateslaapp.com/news/3529/tesla-fsd-hardware-45-appears-a-3-chip-upgrade-before-ai5)
- [Everything We Know About HW5 / AI5](https://www.notateslaapp.com/news/2971/everything-we-know-about-hw5-ai5-teslas-next-gen-fsd-computer)
- [Tesla HW5 FSD Computer Specs Leak](https://www.notebookcheck.net/Tesla-HW5-FSD-computer-specs-leak-out-as-production-is-entrusted-to-TSMC-and-Samsung.1038965.0.html)
- [Tesla Quietly Starts Shipping Model Y with New AI4.5 Computer](https://electrek.co/2026/01/26/tesla-quietly-starts-shipping-model-y-with-new-ai4-5-computer/)

### OTA Deployment
- [Tesla Software & FSD Today: OTA Changes](https://www.teslaacessories.com/blogs/news/tesla-software-fsd-today-ota-changes-safety-regulation-and-what-owners-in-the-us-europe-must-know)
- [Tesla FSD v14.2 Approaching Wide Release](https://www.teslaacessories.com/blogs/news/full-self-driving-v14.2-approaching-wide-release-the-next-evolution-of-tesla-autonomous-technology)
- [TeslaFi Firmware Tracker](https://teslafi.com/firmware.php)

### Safety and NHTSA
- [Tesla FSD Safety Report](https://www.tesla.com/fsd/safety)
- [Tesla's FSD Safety Metrics 'Sharply Deteriorating'](https://www.benzinga.com/markets/tech/26/03/51137537/teslas-fsd-safety-metrics-sharply-deteriorating-says-analyst)
- [NHTSA Escalates Tesla FSD Probe — 3.2 Million Vehicles](https://electrek.co/2026/03/19/nhtsa-upgrades-tesla-fsd-visibility-investigation-3-2-million-vehicles/)
- [NHTSA Investigation PE25012 Resume](https://static.nhtsa.gov/odi/inv/2025/INOA-PE25012-19171.pdf)
- [Tesla's FSD Safety Data Under the Microscope: 14 Robotaxi Incidents](https://nai500.com/blog/2026/03/teslas-fsd-safety-data-under-the-microscope-what-14-robotaxi-incidents-really-tell-us/)
- [Tesla is Having a Hard Time Turning Over FSD Traffic Violation Data](https://electrek.co/2026/02/23/tesla-nhtsa-fsd-traffic-violation-investigation-second-extension/)

### V12 Transition
- [Tesla FSD Beta v12.3 at Challenging Unprotected Left Turns](https://cleantechnica.com/2024/03/18/tesla-fsd-beta-v12-3-at-challenging-unprotected-left-turns/)
- [Ten Thousand Words Analysis: End-to-End Qualitative Change in V12](https://news.futunn.com/en/post/46642035/ten-thousand-words-in-depth-analysis-does-end-to-end)

### Dojo
- [Tesla Dojo — Wikipedia](https://en.wikipedia.org/wiki/Tesla_Dojo)
- [Tesla Dojo: The Rise and Fall of Elon Musk's AI Supercomputer](https://techcrunch.com/2025/09/02/tesla-dojo-the-rise-and-fall-of-elon-musks-ai-supercomputer/)
- [Tesla Shuts Down Dojo](https://techcrunch.com/2025/08/07/tesla-shuts-down-dojo-the-ai-training-supercomputer-that-musk-said-would-be-key-to-full-self-driving/)
- [Elon Musk Confirms Shutdown of Dojo](https://techcrunch.com/2025/08/11/elon-musk-confirms-shutdown-of-tesla-dojo-an-evolutionary-dead-end/)
- [Tesla Shuts Down Dojo — Pivot to AI6](https://www.notateslaapp.com/news/3007/teslas-dojo-isnt-dead-a-deeper-look-at-the-pivot-to-ai6)

### Training Infrastructure
- [Tesla Cortex AI Supercomputer — 50,000 NVIDIA H100 GPUs](https://www.tomshardware.com/desktops/servers/elon-musk-shows-off-cortex-ai-supercluster-first-look-at-teslas-50000-nvidia-h100s)
- [Tesla 2026: Cortex 2 Confirmed](https://www.basenor.com/blogs/news/tesla-2026-cortex-2-confirmed-autonomous-ai-future-takes-shape)
- [Tesla's Supercomputing Cluster at Giga Texas: 100K H100/H200](https://www.tweaktown.com/news/99714/teslas-supercomputing-cluster-at-giga-texas-100k-h100-h200-for-video-training-fsd-optimus/index.html)

### Simulation and World Models
- [How Tesla Uses Simulated Data to Improve FSD](https://www.notateslaapp.com/news/2573/how-tesla-uses-simulated-data-to-improve-fsd)
- [Tesla AI Chief Details Unified 'World Simulator' for FSD and Optimus](https://www.humanoidsdaily.com/feed/tesla-ai-chief-details-unified-world-simulator-for-fsd-and-optimus)
- [NVIDIA Cosmos Offers Synthetic Training Data Following Tesla's Lead](https://www.notateslaapp.com/news/2484/nvidias-cosmos-offers-synthetic-training-data-following-teslas-lead)

### Robotaxi
- [Tesla Launches Unsupervised Robotaxi Rides in Austin](https://www.notateslaapp.com/news/3527/tesla-launches-unsupervised-robotaxi-rides-in-austin)
- [Tesla Starts Testing Robotaxis in Austin With No Safety Driver](https://techcrunch.com/2025/12/15/tesla-starts-testing-robotaxis-in-austin-with-no-safety-driver/)
- [Tesla Robotaxi — Wikipedia](https://en.wikipedia.org/wiki/Tesla_Robotaxi)

### Geographic Expansion
- [Tesla FSD Europe Launch 2026](https://www.tesery.com/blogs/news/tesla-eyes-february-2026-for-fsd-rollout-in-europe-dutch-regulator-rdw-takes-center-stage)
- [Tesla FSD Set For Netherlands Approval](https://evxl.co/2026/03/20/tesla-fsd-supervised-netherlands-approval/)
- [FSD Europe Tracker](https://fsdtracker.eu/)

### Operational Limitations
- [Tesla FSD Support Page](https://www.tesla.com/support/fsd)
- [Tesla Model Y Owner's Manual — Limitations and Warnings](https://www.tesla.com/ownersmanual/modely/en_us/GUID-2CB60804-9CEA-4F4B-8B04-09B991368DC5.html)
