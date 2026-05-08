# Cruise Autonomous Vehicle Division: Exhaustive Technical Writeup

> **Last Updated:** March 2026

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
11. [Safety & Redundancy](#11-safety--redundancy)
12. [Fleet Operations](#12-fleet-operations)
13. [Regulatory & Safety Record](#13-regulatory--safety-record)
14. [Key Partnerships](#14-key-partnerships)
15. [Research & Publications](#15-research--publications)
16. [Current Status (2025-2026)](#16-current-status-2025-2026)

---

## 1. Company Overview

### Founding & History

Cruise was founded in **2013** by **Kyle Vogt** and **Dan Kan** in San Francisco, California. The company participated in **Y Combinator** as part of its startup accelerator program. Cruise's first product was the **RP-1**, announced in June 2014 -- a $10,000 aftermarket retrofit kit designed for 2012+ Audi A4 and S4 vehicles that would enable limited highway autonomy. The RP-1 was abandoned in January 2014 in favor of pursuing full autonomy, initially using the Nissan Leaf as a development platform.

In **March 2016**, General Motors acquired Cruise Automation for approximately **$1 billion**. At the time of acquisition, Cruise had roughly 40 employees and had raised $20 million in venture funding.

### Key Leaders

| Leader | Role | Tenure |
|---|---|---|
| **Kyle Vogt** | Co-founder; CEO (interim Dec 2021, permanent Feb 2022) | 2013 -- Nov 2023 (resigned) |
| **Dan Kan** | Co-founder | 2013 -- departed post-acquisition |
| **Dan Ammann** | CEO (former GM President) | Nov 2018 -- Dec 2021 (departed) |
| **Mo Elshenawy** | EVP Engineering / President & CTO; co-president post-Vogt | Pre-2023 -- Apr 2025 (transition) |
| **Marc Whitten** | CEO (former Amazon/Microsoft exec) | Jul 2024 -- Feb 2025 (departed in GM absorption) |
| **Craig Glidden** | Co-president (post-Vogt, GM General Counsel) | Nov 2023 -- 2024 |
| **Carl Jenkins** | VP Hardware | 2018 -- onward |
| **Sterling Anderson** | Hired post-Cruise (former Tesla Autopilot chief) | 2025 -- present (GM autonomous driving) |

### Funding & Investment

GM's cumulative spending on Cruise reached approximately **$12.1 billion**:

| Year | Investment |
|---|---|
| 2016 | $1.0B (acquisition) |
| 2017 | $600M |
| 2018 | $700M |
| 2019 | $1.0B |
| 2020 | $900M |
| 2021 | $1.2B |
| 2022 | $1.9B |
| 2023 | $2.7B (peak) |
| 2024 | $1.7B |
| 2025 | $400M |
| **Total** | **~$12.1B** |

Major external funding rounds:

- **May 2018**: Honda invested $750M equity + committed ~$2B over 12 years ($2.75B total)
- **May 2019**: SoftBank Vision Fund invested $2.25B; total valuation reached $19B
- **January 2021**: Microsoft, Honda, and institutional investors contributed $2B; valuation reached $30B
- **April 2021**: Walmart joined a $2.75B round alongside Microsoft and Honda
- **March 2022**: GM acquired SoftBank Vision Fund 1's equity for $2.1B and invested an additional $1.35B

Peak valuation: **$30 billion** (January 2021).

### Employees & Offices

- **Peak headcount**: ~4,000 full-time employees (late 2023)
- **Headquarters**: San Francisco, CA
- **Additional offices**: Seattle/Bellevue (WA), Pasadena (CA), Phoenix (AZ), Austin (TX), Munich (Germany)
- **Post-restructuring headcount**: ~1,050 retained (Feb 2025, after 50% layoff of ~2,100)

### Key Milestones Timeline

| Date | Milestone |
|---|---|
| 2013 | Founded by Kyle Vogt and Dan Kan |
| Jun 2014 | RP-1 aftermarket kit announced |
| Mar 2016 | Acquired by GM for ~$1B |
| Oct 2017 | Acquired Strobe Inc. (solid-state lidar startup) |
| Oct 2018 | Honda partnership announced |
| Nov 2018 | Dan Ammann appointed CEO |
| May 2019 | SoftBank Vision Fund invests $2.25B; valuation $19B |
| Jan 2020 | Cruise Origin unveiled (purpose-built AV) |
| Jan 2021 | Microsoft invests; valuation hits $30B |
| Sep 2021 | CA DMV issues driverless permit |
| Nov 2021 | First fully driverless ride in San Francisco |
| Jun 2022 | First CA Driverless Deployment Permit (commercial fares) |
| Feb 2023 | 1 million driverless miles reached |
| Aug 2023 | CPUC approves 24/7 commercial operations in SF |
| Oct 2, 2023 | Pedestrian dragging incident |
| Oct 24, 2023 | CA DMV suspends driverless permit |
| Oct 26, 2023 | Cruise voluntarily pauses all driverless operations |
| Nov 2023 | Kyle Vogt resigns; 24% workforce reduction |
| Jun 2024 | Marc Whitten appointed CEO |
| Dec 2024 | GM announces end of robotaxi funding; pivot to personal vehicles |
| Feb 2025 | GM acquires full ownership; 50% layoff (~1,000 employees); Cruise absorbed into GM |

---

## 2. Vehicle Platform

### Chevrolet Bolt EV (Retrofit Platform)

Cruise's primary operational vehicle was a modified **Chevrolet Bolt EV**, retrofitted with autonomous driving hardware. The company iterated through multiple generations:

| Generation | Approximate Period | Key Changes |
|---|---|---|
| 1st Gen | 2016--2017 | Initial Bolt EV integration; early sensor suite |
| 2nd Gen | 2017--2018 | Improved sensor placement and compute |
| 3rd Gen | 2018--2019 | Unveiled publicly; refined rooftop sensor module |
| 4th Gen | 2019+ | Production-intent design; GM filed safety petition with DOT for deployment |

**Bolt EV Base Specifications (2023 model year):**

| Specification | Value |
|---|---|
| Powertrain | All-electric (single motor, FWD) |
| Battery | 65 kWh lithium-ion |
| Range (EPA) | ~259 miles |
| Motor output | 200 hp / 266 lb-ft |
| Wheelbase | 102.4 in |
| Length | 163.2 in |
| Curb weight | ~3,563 lbs |

The Cruise AV modification adds the rooftop sensor module (LiDAR, cameras, radar arrays), additional compute hardware in the trunk area, and removes manual controls in the 4th-gen production-intent variant (no steering wheel, pedals). According to Cruise, **40% of the hardware** in the Cruise AV is unique to self-driving and not found in the standard Bolt EV.

### Cruise Origin (Purpose-Built, Cancelled)

Unveiled in **January 2020**, the Cruise Origin was a purpose-built autonomous vehicle with no manual driving controls -- no steering wheel, no pedals, no rearview mirrors, and no windshield wipers.

**Origin Design Specifications:**

| Specification | Value |
|---|---|
| Platform | GM BEV3 (Ultium architecture) |
| Battery | GM Ultium (pouch-cell, exact capacity undisclosed) |
| Motors | Ultium Drive |
| Passenger capacity | 6 (face-to-face bench seating) |
| Doors | Sliding doors on both sides |
| Length | Approximately same as Chevrolet Cruze |
| Entry height | Lower and 3x wider than a conventional passenger car |
| Autonomy level | SAE Level 4--5 |
| Modularity | Designed for sensor/compute upgrades without full fleet replacement |
| Use cases | Ride-hail and delivery (convertible interior) |

The Origin was designed to be **modular**, meaning sensor packages and compute units could be upgraded without replacing the entire vehicle. The interior could convert between passenger mode and delivery mode with a slide-in/slide-out delivery unit.

**Status**: A small number of prototypes were built in late 2023, but no production vehicles were manufactured. The Origin was effectively cancelled when GM ended robotaxi funding in December 2024.

---

## 3. Sensor Suite

The Cruise AV (Bolt-based) uses a multi-modal sensor suite providing **360-degree coverage**:

| Sensor Type | Count | Purpose |
|---|---|---|
| **LiDAR** | 5 | 3D point cloud mapping, obstacle detection, localization |
| **Cameras** | 16 | Visual perception, traffic light recognition, lane detection |
| **Radar** | 21 | Velocity measurement, object detection in adverse weather |
| **Total** | **42** | Full surround sensing |

### LiDAR

- **5 LiDAR units** mounted on the rooftop sensor bar
- Early vehicles used **Velodyne** spinning LiDAR sensors
- In **October 2017**, Cruise acquired **Strobe Inc.**, a 12-person startup founded by Lute Maleki (previously of OEwaves), developing chip-scale FMCW (Frequency-Modulated Continuous Wave) solid-state lidar
- Strobe's technology produces "chirps" of frequency-modulated laser light; measuring the phase and frequency of returning chirps allows simultaneous measurement of both **distance and velocity** of objects
- FMCW lidar advantages: relatively immune to interference from other lidar systems, does not require highly sensitive photodetectors, and dramatically reduces cost (target: **99% cost reduction** per unit)
- Cruise pursued a hybrid strategy: using commercial lidar units for near-term deployment while developing proprietary solid-state lidar for future generations

### Cameras

- **16 cameras** distributed around the vehicle
- Provide visual perception data for traffic signal recognition, lane markings, signage, and object classification
- Camera data is fused with LiDAR and radar for robust multi-modal perception

### Radar

- **21 radar sensors** distributed around the vehicle
- Provide reliable velocity and range measurements, particularly effective in adverse weather conditions (rain, fog, snow) where lidar and cameras may be degraded
- Enable detection of objects and their velocity with high precision

### Additional Sensors

- **Acoustic sensors** (microphones) for detecting emergency vehicle sirens and other relevant audio cues
- **GPS/GNSS** receivers for coarse positioning (supplemented by LiDAR-based localization in urban canyons)
- **IMU** (Inertial Measurement Unit) for dead-reckoning and sensor fusion

---

## 4. Onboard Compute

### Compute Architecture

Cruise developed its compute platform significantly in-house, with dedicated hardware engineering teams established from early 2018 under **Carl Jenkins** (VP Hardware) and **Brendan Hermalyn** (Director, Autonomous Hardware Systems).

**Key architectural properties:**

- **Custom AV topology**: Encompasses sensors, compute, network systems, connectivity, infotainment, and UX
- **Redundant compute modules**: No single point of failure across sensing, compute, networking, or power -- critical because there is no backup human driver
- **High-throughput data processing**: The system processes up to **10 gigabits of data per second** from the combined sensor suite
- **Real-time processing**: Hard real-time constraints for perception, prediction, and planning loops
- **Dedicated silicon architecture**: Cruise employed compute and silicon architects to drive system-level architecture decisions, working with leading partners in high-performance computing
- **Hundreds of hardware engineers** worked on sensors, network systems, compute, and infotainment systems

### Hardware Development Philosophy

Rather than relying entirely on off-the-shelf compute solutions (e.g., NVIDIA DRIVE), Cruise invested heavily in custom hardware development and systems integration. This approach provided:

- Tighter integration between software and hardware
- Optimization for their specific autonomy workloads
- Greater control over thermal management, power consumption, and reliability
- Hardware tailored to the specific sensor suite and processing pipeline

---

## 5. Autonomy Software Stack

Cruise's autonomy pipeline follows the classical modular architecture with significant machine learning integration:

### 5.1 Perception

- **Sensor fusion**: Combines data from LiDAR, cameras, and radar to produce a unified environmental model
- **Object detection and classification**: Identifies vehicles, pedestrians, cyclists, traffic signals, signs, and other road objects
- **3D point cloud processing**: LiDAR data processed for obstacle detection and free-space estimation
- **Multi-modal fusion**: Camera imagery provides texture and color information fused with LiDAR depth data for robust classification
- Capable of detecting obstacles even in **pitch-black conditions, rain, and fog** through complementary sensor modalities

### 5.2 Prediction

- **ML-first approach**: Cruise adopted a machine-learning-first strategy for prediction because "people don't necessarily follow the rules of the road"
- **Intent prediction**: Predicts future trajectories of pedestrians, vehicles, and cyclists multiple seconds into the future
- **Self-supervised learning framework**: Uses future perception output compared against current predictions to create training labels, enabling continuous improvement without manual annotation
- **Continuous Learning Machine (CLM)**: An automated pipeline for identifying prediction errors, labeling data, training new models, and deploying improvements (detailed in Section 6)

### 5.3 Planning

- **Path planning**: Generates safe, comfortable, and efficient trajectories from current position to destination
- **Intersection handling**: Uses a purely learning-based approach for complex intersection scenarios
- **Behavioral planning**: High-level decision making (lane changes, yielding, merging, unprotected turns)
- **Fallback path planning**: Dedicated failover planners for degraded operating conditions
- **Patent filings** cover path planners that search for and update optimal plans from a current pose to an end pose while avoiding obstacles

### 5.4 Control

- **Model Predictive Control (MPC)**: Used for low-level vehicle control (steering, throttle, braking)
- **Kalman Filters**: Used for state estimation and object tracking
- **Multiple control modes**: Normal operation, minimal risk condition (MRC) handling, and emergency stop capabilities

### 5.5 Pipeline Integration

```
Sensors --> Perception (Fusion) --> Prediction --> Planning --> Control --> Vehicle Actuation
                  |                      |             |
                  v                      v             v
           HD Map Localization    Scene Context    Safety Monitor
```

Every piece of code undergoes a **physical road test** with an engineer in the vehicle before being merged into the production branch, in addition to extensive simulation testing.

---

## 6. Machine Learning & AI

### Continuous Learning Machine (CLM)

Cruise's most significant ML innovation is the **Continuous Learning Machine**, an automated pipeline addressing the "long tail" challenge in autonomous driving:

**Three-Step CLM Process:**

1. **Error Mining (Active Learning)**
   - Automatically identifies scenarios where there is a significant difference between prediction and reality
   - Only problematic scenarios are added to the training dataset, avoiding bloat with "easy" examples
   - Enables extremely targeted data mining

2. **Self-Supervised Labeling**
   - Uses future perception output as "ground truth" for prediction scenarios
   - Fully automated -- no human annotators required
   - Enables significant improvements in scale, cost, and speed

3. **Model Training & Evaluation**
   - New models are trained, tested through extensive evaluation pipelines, and deployed
   - Metrics pipelines ensure each new model exceeds previous model performance
   - Models must generalize well across diverse scenarios before deployment

**Example workflow**: If an initial model poorly predicts U-turn situations, the CLM automatically samples U-turn error cases, grows the dataset representation of U-turns, and iterates until the model sufficiently handles them -- all without human intervention.

### Training Infrastructure

- Trained on **5+ million miles of real-world driverless driving data**
- Uses **Google Cloud Vertex AI** to train hundreds of models simultaneously
- Consumes **hundreds of GPU-years every month** for model training
- Models cover perception, prediction, planning, and other AV subsystems

### ML Architecture Approaches

- **Deep neural networks** for object detection and classification
- **Recurrent and transformer-based architectures** for trajectory prediction
- **Multi-modal perception models** fusing camera, LiDAR, and radar inputs
- **Self-supervised and semi-supervised learning** frameworks to reduce labeling dependency
- Cruise has not publicly disclosed use of a single "foundation model" architecture, but their technology stack includes multimodal perception systems and AI models that are being integrated into GM's next-generation driver-assistance programs

---

## 7. Mapping & Localization

### HD Mapping Approach

Cruise produces its **own high-definition maps in-house** using precision LiDAR and semantic mapping techniques.

**Map Contents:**

- Lane boundaries and lane types
- Traffic light locations and types
- Curb locations and heights
- Road surface features
- Semantic information (crosswalks, stop lines, speed limits, turn restrictions)

**Localization Method:**

- Vehicles use **LiDAR-to-map matching**: the car scans the surrounding environment with lidar and compares it against the HD map to determine its position **down to the centimeter**
- This approach is critical in urban environments like San Francisco where tall buildings block GPS signals (urban canyon effect)
- Map-based localization frees up processing power that would otherwise be spent on environmental understanding, giving the car more compute budget for dynamic maneuvering

**Map Maintenance:**

- Cruise developed operational solutions to **detect real-world changes** (construction, new signage, road modifications)
- Map updates are pushed to every autonomous vehicle in the fleet **within minutes**
- Multiple versions of map features can be A/B tested simultaneously
- The best-performing version is rapidly deployed fleet-wide

**Strategic Advantage:**

- In-house mapping provides full control over maintenance strategy
- Faster iteration on new map features compared to relying on third-party map providers
- Ability to rapidly expand to new operational domains

---

## 8. Simulation Platform

Cruise built one of the most extensive AV simulation platforms in the industry.

### Scale

| Metric | Value |
|---|---|
| Total simulated miles | **20+ billion** |
| Daily compute jobs | **200,000 hours** of compute per day |
| Daily instances spun up | **30,000** |
| Processor cores | **300,000+** |
| GPUs | **5,000+** |
| Daily data output | **~300 TB** of results |

### Simulation Tools

| Tool | Function |
|---|---|
| **Morpheus** | Rapid generation of specific testing scenarios |
| **Road-to-Sim** | Automated pipeline that fuses real-world driving data to recreate on-road events in simulation without manual intervention |
| **WorldGen** | Procedural generation of entire virtual cities for testing in new operational design domains |

### Scenario Sources

Scenarios are drawn from:

- **Millions of miles of real-world driving data** collected by the fleet
- **National crash databases** (e.g., NHTSA crash data)
- **Academic research** on edge cases and failure modes
- **Synthetic generation**: entirely new scenarios designed from scratch
- **Modified real-world data**: actual events replayed with variations

### Simulation Capabilities

- Replay actual on-road events with high fidelity
- Modify real-world scenarios to create novel edge cases
- Generate scenarios across different weather conditions, times of day, and traffic densities
- Test perception, prediction, and planning modules independently or end-to-end
- Run regression testing against new software releases multiple times per week

### Data Warehousing for Simulation

Cruise built a dedicated **simulation metrics data warehouse** using Avro tables. A graph compute engine transforms raw simulation output into structured analytics tables. Engineers can experiment with new simulation metrics without schema migrations, enabling rapid iteration on evaluation criteria.

---

## 9. Cloud & Data Infrastructure

### Multi-Cloud Strategy

Cruise operates on a **multi-cloud architecture**, primarily using two major cloud providers:

#### Google Cloud Platform (Primary Compute)

| Service | Usage |
|---|---|
| **Google Kubernetes Engine (GKE)** | Primary container orchestration for backend services |
| **Compute Engine** | Virtual machines for simulation and processing |
| **Cloud Storage** | Large-scale data storage for sensor logs and training data |
| **BigQuery** | Analytics and data warehousing |
| **Vertex AI** | ML model training (hundreds of models, hundreds of GPU-years/month) |
| **CloudSQL** | Relational database services |
| **PubSub** | Event-driven messaging |
| **Cloud Functions** | Serverless compute |
| **App Engine** | Application hosting |
| **Cloud Logging & Monitoring** | Observability |

#### Microsoft Azure (Strategic Partner)

- Following Microsoft's investment in January 2021, Azure became Cruise's **primary and preferred cloud provider** (though not exclusive)
- GM uses Azure for **collaboration, storage, AI, and machine learning** projects
- The partnership extended to exploring digital supply chain optimization and new mobility services

### Data Processing: Terra Platform

Cruise developed **Terra**, a custom data processing platform built as an extension of the **Apache Beam SDK**:

- Built in **Python** on top of Apache Beam
- Handles **dataset registration, lineage tracking, timestamp synchronization, windowing, automatic schema inference, data validation, and feature discovery**
- Provides standard connectors to diverse data stores (raw car data, labeled data, map data, operational data)
- **Weekly usage**: 70+ unique users submitting 2,000+ jobs
- Improved feature engineering pipeline runtime by up to **100x** (two orders of magnitude)

### Container Platform

- Backend for Cruise self-driving cars runs on **Kubernetes**
- Custom tool **"Juno"** enables application developers to iterate and deploy at scale
- Multi-tenant, multi-environment Platform as a Service
- Detailed networking architecture for container platform connectivity

### Infrastructure as Code

- Uses **HashiCorp Terraform** from early days for cloud resource provisioning
- Library of **150+ versioned, validated, and approved Terraform modules**
- Decomposed mono-repository into well-defined micro-repositories using Terraform Enterprise workspaces
- Each team has dedicated workspaces for writing and executing infrastructure code

---

## 10. Programming Languages & Tools

### Programming Languages

| Language | Primary Use |
|---|---|
| **C++** | Real-time AV software (perception, planning, control), latency-critical components |
| **Python** | ML model training, data processing (Terra), tooling, scripting, simulation analysis |
| **Go (Golang)** | Backend services, infrastructure tooling, cloud-native applications |
| **Node.js** | Web services, internal tools, dashboards |

### Build Systems & CI/CD

| Tool | Purpose |
|---|---|
| **CircleCI Enterprise** | Continuous integration and deployment |
| **GitHub Enterprise** | Source code management and collaboration |
| **Bazel** (likely) | Build system for multi-language monorepo (common in AV industry for C++/Python) |

### Infrastructure & DevOps

| Tool | Purpose |
|---|---|
| **Docker** | Containerization |
| **Kubernetes** | Container orchestration (via GKE) |
| **HashiCorp Terraform** | Infrastructure as code |
| **Apache Kafka** | Event streaming and message queuing |
| **Apache Beam** | Data processing framework (via Terra) |

### Internal Tools

| Tool | Purpose |
|---|---|
| **Juno** | Custom container deployment platform for developers |
| **Terra** | Custom data processing platform (Apache Beam extension) |
| **Morpheus** | Simulation scenario generation |
| **Road-to-Sim** | Real-world to simulation conversion pipeline |
| **WorldGen** | Procedural city/environment generation for simulation |

### Development Practices

- **Monorepo approach** (at least historically, per CircleCI case study)
- Every code change undergoes **physical road testing** with an engineer in the vehicle before merging to master
- Simulation-based regression testing enables **multiple releases per week**
- New developers are productive from **day 1** due to CircleCI/GitHub integration

---

## 11. Safety & Redundancy

### Safety Reports

Cruise published formal safety reports (notably the **2022 Safety Report**) covering:

- Operational Design Domain (ODD) definition
- Regulatory requirements and compliance
- Safety methodology and approaches
- High-level architecture and system design
- Requirements management
- Verification and validation processes
- Hardware and firmware verification
- Cybersecurity validation
- Test scenario development
- Safe launch readiness review
- Operational readiness protocols

### Redundancy Architecture

The Cruise AV is designed with **no single points of failure** across four critical domains:

| Domain | Redundancy Approach |
|---|---|
| **Sensing** | Multiple overlapping sensor modalities (LiDAR, cameras, radar) with overlapping fields of view; system degrades gracefully if one sensor fails |
| **Compute** | Redundant compute modules; dual-redundant with active hot standby; safety-critical compute has built-in redundancy |
| **Networking** | Redundant communication lines between computing systems and sensors |
| **Power** | Distributed power sources scattered throughout the vehicle (more fail-safe than centralized configurations) |

### Safety Design Principles

- **Fail-operational**: System continues operating safely after a single component failure
- **Fail-safe**: In the event of multiple failures, the vehicle transitions to a Minimal Risk Condition (MRC) -- typically pulling over and stopping safely
- **Fallback path planning**: Dedicated failover planners for degraded operating conditions (covered by patent filings)
- **AI-filtered sensor data**: System smoothly transitions between redundant sensors to maintain control if one sensor fails
- **Remote assistance**: Fleet operations center can provide remote guidance to vehicles in ambiguous situations

---

## 12. Fleet Operations

### Operational Cities

| City | Launch Date | Operating Hours | Coverage Area |
|---|---|---|---|
| **San Francisco, CA** | Nov 2021 (driverless) | Initially 10pm--6am; expanded to 24/7 (Aug 2023) | Initially Sunset/Richmond districts; expanded citywide |
| **Phoenix, AZ** | Late 2022 | Nighttime initially | Select neighborhoods |
| **Austin, TX** | Late 2022 | Nighttime initially | Select neighborhoods |
| **Houston, TX** | Oct 2023 | 9pm--6am, 7 days/week | ~11 sq mi (Downtown, Midtown, East Downtown, Montrose, Hyde Park, River Oaks) |
| **Dallas, TX** | Planned/limited | -- | -- |

### Fleet Size

- Total fleet: approximately **400 vehicles** across all cities (pre-pause)
- Typical new city launch: ~12 vehicles initially, scaling from there
- All operational vehicles were modified Chevrolet Bolt EVs

### Ride Statistics

| Metric | Value |
|---|---|
| Total driverless miles | **5+ million** (real-world) |
| 1 million driverless miles reached | February 2023 (15 months after first ride) |
| Total driverless rides delivered | **250,000+** |
| Driverless miles by Aug 2022 | 250,000+ |

### Pricing (Pre-Pause)

| Component | Rate |
|---|---|
| Base fare | $5.00 |
| Per mile | $0.90 |
| Per minute | $0.40 |
| City tax | 1.5% |

Cruise received California's first **Driverless Deployment Permit** in June 2022, allowing it to charge fares. It became the first company to launch a fared robotaxi service in San Francisco.

---

## 13. Regulatory & Safety Record

### October 2, 2023: Pedestrian Dragging Incident

The pivotal incident that precipitated Cruise's downfall:

1. A pedestrian was struck by a **human-driven hit-and-run vehicle**, which threw her into the path of a Cruise AV
2. The Cruise AV, operating driverlessly, ran over the pedestrian
3. The Cruise AV's software then attempted to **pull over to the curb** -- dragging the woman approximately **20 feet** while she was trapped underneath
4. The pedestrian suffered serious injuries

### Reporting Failures

- Cruise submitted **two NHTSA crash reports** that **omitted** the post-crash dragging details
- NHTSA discovered the omission only after requesting and reviewing video footage from Cruise
- Cruise initially showed NHTSA and the California DMV a truncated version of the incident video that did not include the dragging portion

### Criminal Charges

- Cruise admitted to **submitting a false report to influence a federal investigation**
- Paid a **$500,000 criminal fine** (U.S. Department of Justice, Northern District of California)

### Regulatory Actions

| Action | Date | Authority |
|---|---|---|
| CA DMV **immediately suspends** driverless permit | Oct 24, 2023 | California DMV |
| Cruise **voluntarily pauses** all driverless operations nationwide | Oct 26, 2023 | Self-imposed |
| 24% workforce reduction (~960 employees) | Dec 14, 2023 | Internal |
| NHTSA **consent order** with $1.5M penalty | Sep 2024 | NHTSA |
| NHTSA closes preliminary investigation | Jan 2025 | NHTSA |

### Recalls

**Recall 1 -- Unexpected Braking (2022--2024):**

| Detail | Value |
|---|---|
| Issue | AV software could trigger unexpected hard braking when a cyclist or vehicle approached from the rear |
| Investigation opened | Dec 12, 2022 |
| Total hard-braking incidents since 2021 | 7,632 |
| Incidents leading to crashes/fires | 10 |
| Injuries reported | 4 |
| Vehicles recalled | 1,194 (entire fleet) |
| Resolution | Software update improving perception, prediction, and path planning; completed during operations pause (Oct 2023 -- May 2024) |
| Investigation closed | Aug 2024 |

**Recall 2 -- Post-Crash Behavior (2023):**

- Related to the October 2023 pedestrian incident
- Software updated to improve post-collision behavior

### Other Notable Incidents

- Multiple incidents of Cruise vehicles **blocking traffic**, including emergency vehicles
- Vehicles entering **wet concrete** at construction sites
- Clustering incidents where multiple Cruise vehicles congregated and blocked streets
- A Cruise vehicle struck a San Francisco fire truck in August 2023

---

## 14. Key Partnerships

### General Motors (Parent Company)

- Acquired Cruise in March 2016 for ~$1B
- Provided the Chevrolet Bolt EV platform and manufacturing capabilities
- Developed the BEV3/Ultium platform for the Origin
- Completed full ownership acquisition in February 2025
- Invested cumulative ~$12.1B
- Now integrating Cruise technology into Super Cruise and future autonomous driving systems

### Microsoft

- Invested as part of $2B round in January 2021
- **Azure** designated as Cruise's primary and preferred cloud provider
- Collaboration on software engineering, cloud computing, and AI/ML capabilities
- Partnership explored digital supply chain optimization

### Honda

- Invested $750M equity in Cruise + committed ~$2B over 12 years ($2.75B total commitment)
- Co-developed the Cruise Origin alongside GM and Cruise
- Planned joint venture for **driverless ridehail service in Japan** (targeted early 2026)
- Joint venture would have used Origin vehicles for 6-passenger autonomous rides
- **Partnership dissolved** after GM ended robotaxi development in December 2024

### Walmart

- Became a Cruise investor in April 2021 (part of $2.75B round)
- Piloted **self-driving delivery service** in Scottsdale, Arizona (November 2021)
- Partnership explored autonomous last-mile delivery

### Strobe Inc. (Acquired)

- Acquired October 2017
- 12-person solid-state FMCW lidar startup
- Founded by Lute Maleki (OEwaves spinoff)
- Technology goal: reduce per-unit lidar cost by 99%

---

## 15. Research & Publications

### Patents

GM Cruise Holdings LLC has been assigned approximately **79+ patents** covering:

| Patent Area | Examples |
|---|---|
| **Simulation** | Purposeful stress testing of AV response time with simulation |
| **Perception** | Systems responding to adverse weather conditions |
| **Path Planning** | Searching and updating optimal plans from current pose to end pose while avoiding obstacles |
| **Camera Systems** | Calibration systems for correcting lens distortion |
| **Failover** | Handling degraded operating conditions with fallback path planners |
| **Fleet Management** | Real-time autonomous vehicle fleet parking availability |

### Engineering Blog (Medium)

Cruise maintained an active engineering blog at **medium.com/cruise** with notable publications:

| Publication | Topic |
|---|---|
| "Cruise's Continuous Learning Machine" | Self-supervised ML pipeline for prediction improvement |
| "Introducing Terra" | Custom data processing platform built on Apache Beam |
| "Building a Container Platform at Cruise" | Kubernetes-based PaaS architecture |
| "Container Platform Networking" | Kubernetes networking architecture |
| "Data Warehousing for AV Simulation Analysis" | Simulation data infrastructure |
| "How Cruise Uses Simulation to Speed Up Sensor Development" | Sensor-in-the-loop simulation |
| "3 Ways Cruise HD Maps Give Our Self-Driving Vehicles an Edge" | HD mapping approach |

### Conference Presentations

| Venue | Topic |
|---|---|
| **Google Cloud Next '19** | "How to Run Millions of Self-Driving Car Simulations on GCP" |
| **MLconf** | "ML Infrastructure for Autonomous Vehicles @ Cruise" |
| **HashiCorp events** | "Terraform and Cruise Case Study: A Self-Driven Future" |

### Academic Engagement

While Cruise published fewer academic papers than competitors like Waymo, their engineering contributions focused on:

- Self-supervised learning for autonomous driving
- Scalable simulation infrastructure
- Data processing pipelines for AV applications
- Container platform engineering at scale

---

## 16. Current Status (2025-2026)

### GM's Strategic Pivot

In **December 2024**, GM CEO Mary Barra announced that GM would **stop funding Cruise as a standalone robotaxi business** and instead integrate Cruise's autonomous technology into GM's personal vehicle lineup. The rationale:

- The robotaxi business required too much capital with uncertain timelines to profitability
- Cruise's technology could be better leveraged for consumer ADAS products
- GM could reduce spending by **$1+ billion annually**

### Absorption into GM (February 2025)

- GM acquired **full ownership** of Cruise, completing the merger
- **~50% of Cruise employees laid off** (~1,000 of ~2,100)
- Departing executives: CEO Marc Whitten, CHRO Nilka Thomas, Chief Safety Officer Steve Kenner, Chief Government Affairs Officer Rob Grant
- Mo Elshenawy (President/CTO) stayed through April 2025 for transition
- Retained employees are primarily in **engineering roles**
- Sterling Anderson (former Tesla Autopilot chief) hired to lead GM's autonomous driving development

### Technology Integration Path

Cruise's technology is being channeled into GM's consumer vehicle autonomy roadmap:

| System | Timeline | Capability |
|---|---|---|
| **Super Cruise** (current) | 2018--present | Hands-free, eyes-on highway driving; 600,000+ miles of mapped roads; 500,000+ enabled vehicles on road |
| **Enhanced Super Cruise** | 2026 MY | Google Maps integration; automatic transition between steering assist and hands-free modes |
| **Eyes-Off Driving System** | Target 2028 | Hands-off, eyes-off driving starting with Cadillac Escalade IQ; uses lidar + radar + cameras; operates on unmapped highways |
| **Full Autonomy** | TBD | Long-term goal; leveraging Cruise's 5M+ driverless miles and simulation framework |

### Current Testing (2025-2026)

- GM is using a limited number of **Cruise Bolt AVs** and other vehicles equipped with lidar on select highways in **Michigan, Texas, and the San Francisco Bay Area**
- Vehicles are driven by **trained human drivers** (not driverless)
- Testing focuses on developing simulation models and advancing driver-assistance systems
- Data collection vehicles include **Cadillac Escalade IQ** and **GMC Yukon** SUVs gathering driving data from across the U.S.

### Cruise Technology Assets Retained by GM

- **Multimodal perception systems** trained on 5+ million driverless miles
- **AI/ML models** and the Continuous Learning Machine pipeline
- **Simulation framework** (20+ billion simulated miles, WorldGen, Morpheus, Road-to-Sim)
- **HD mapping technology** and rapid map-update infrastructure
- **Sensor fusion expertise** and proprietary sensor development (Strobe lidar IP)
- **Cloud infrastructure** and data processing pipelines (Terra, Kubernetes platforms)
- **Patent portfolio** (79+ patents)

### Industry Context

Cruise's trajectory from a $30B-valued robotaxi pioneer to absorption into GM's ADAS division represents one of the most significant pivots in the autonomous vehicle industry. While competitors like Waymo continued expanding driverless operations, Cruise's October 2023 incident -- and particularly the cover-up of the pedestrian dragging -- destroyed regulatory trust and public confidence. GM's $12.1B investment, though it did not produce a viable robotaxi business, generated substantial autonomous driving IP that is now being redirected toward the potentially larger market of consumer autonomous vehicles.

---

## Sources

- [Cruise (autonomous vehicle) - Wikipedia](https://en.wikipedia.org/wiki/Cruise_(autonomous_vehicle))
- [The Amount GM Spent On The Cruise Robotaxi Will Shock You - GM Authority](https://gmauthority.com/blog/2025/12/the-amount-gm-spent-on-its-defunct-cruise-robotaxi-service-will-shock-you/)
- [GM to retreat from robotaxis - NPR](https://www.npr.org/2024/12/11/g-s1-37700/gm-to-retreat-from-robotaxis-and-stop-funding-its-cruise-autonomous-vehicle-unit)
- [GM is giving up on Cruise robotaxis - TechCrunch](https://techcrunch.com/2024/12/11/gm-is-giving-up-on-cruise-robotaxis-pivots-to-personal-autonomous-vehicles/)
- [RIP, Cruise robotaxi - TechCrunch](https://techcrunch.com/2024/12/12/rip-cruise-robotaxi/)
- [GM cuts 50% of Cruise staff - CNBC](https://www.cnbc.com/2025/02/04/gm-cuts-50percent-of-cruise-staff-after-ending-robotaxi-business.html)
- [Cruise to slash workforce by 50% - TechCrunch](https://techcrunch.com/2025/02/04/cruise-to-slash-workforce-by-50-after-gm-cuts-funding-to-robotaxi-operations/)
- [NHTSA Consent Order with Cruise](https://www.nhtsa.gov/press-releases/consent-order-cruise-crash-reporting)
- [Cruise admits false report - DOJ](https://www.justice.gov/usao-ndca/pr/cruise-admits-submitting-false-report-influence-federal-investigation-and-agrees-pay)
- [California DMV suspends Cruise permit - TechCrunch](https://techcrunch.com/2023/10/24/dmv-immediately-suspends-cruises-robotaxi-permit-in-california/)
- [Cruise recalls robotaxi fleet - TechCrunch](https://techcrunch.com/2024/08/22/cruise-recall-av-fleet-nhtsa-probe-closed/)
- [GM Cruise recalls 1,200 vehicles - EV.com](https://ev.com/news/gms-cruise-recalls-nearly-1200-autonomous-vehicles-amid-safety-concerns)
- [NHTSA closes Cruise investigation - SF Examiner](https://www.sfexaminer.com/news/transit/nhtsa-closes-federal-investigation-into-cruise-car-accidents/article_7834aeea-60db-11ef-b535-bb351d8aa37a.html)
- [What is the Cruise Origin? - Consumer Guide](https://blog.consumerguide.com/what-is-the-cruise-origin/)
- [Cruise Origin - Digital Trends](https://www.digitaltrends.com/cars/cruise-origin-self-driving-car/)
- [Cruise Origin - CNBC](https://www.cnbc.com/2020/01/21/gm-subsidiary-cruise-unveils-its-first-purpose-built-autonomous-vehicle.html)
- [Fully Autonomous Cruise AV Has 5 Lidar Sensors - LiDAR News](https://blog.lidarnews.com/fully-autonomous-cruise-av-has-5-lidar-sensors/)
- [Cruise Automation - ThinkAutonomous](https://www.thinkautonomous.ai/blog/cruise-self-driving-car/)
- [Cruise's Continuous Learning Machine - Medium](https://medium.com/cruise/cruise-continuous-learning-machine-30d60f4c691b)
- [How Cruise tests its AVs on Google Cloud](https://cloud.google.com/blog/products/containers-kubernetes/how-cruise-tests-its-avs-on-a-google-cloud-platform)
- [Cruise simulation - MIT Technology Review](https://www.technologyreview.com/2022/02/18/1045784/simulation-virtual-world-driverless-car-autonomous-vehicle-school-ai-cruise-waabi/)
- [GM's Cruise preparing for self-driving future in the cloud - VentureBeat](https://venturebeat.com/ai/gms-cruise-is-preparing-for-a-self-driving-future-in-the-cloud)
- [Cruise to use Azure - DataCenter Dynamics](https://www.datacenterdynamics.com/en/news/cruise-use-azure-microsoft-invests-2bn-autonomous-vehicle-company/)
- [The technology powering driverless cars at Cruise - CircleCI](https://circleci.com/case-studies/cruise/)
- [Cruise Tech Stack - StackShare](https://stackshare.io/cruise/cruise)
- [HashiCorp Terraform - Cruise Case Study](https://www.hashicorp.com/en/case-studies/cruise)
- [Introducing Terra - Cruise Medium](https://medium.com/cruise/introducing-terra-cruises-data-processing-platform-c6a476bb5b72)
- [Building a Container Platform at Cruise - Medium](https://medium.com/cruise/building-a-container-platform-at-cruise-part-1-507f3d561e6f)
- [Data Warehousing for AV Simulation Analysis - Cruise Medium](https://medium.com/cruise/data-warehousing-av-7c8914bc5116)
- [3 Ways Cruise HD Maps Give Our Self-Driving Vehicles An Edge - Medium](https://medium.com/cruise/hd-maps-self-driving-cars-b6444720021c)
- [How Cruise builds digital maps - Digital Trends](https://www.digitaltrends.com/cars/how-cruise-develops-digital-maps-for-self-driving-cars/)
- [GM Cruise acquires Strobe - TechCrunch](https://techcrunch.com/2017/10/09/cruise-acquires-strobe-to-help-dramatically-reduce-lidar-costs/)
- [GM Cruise Snaps Up Strobe - IEEE Spectrum](https://spectrum.ieee.org/gm-cruise-snaps-up-solidstate-lidar-pioneer-strobe-inc)
- [Cruise Safety Report 2022 (PDF)](https://assets.ctfassets.net/95kuvdv8zn1v/zKJHD7X22fNzpAJztpd5K/ac6cd2419f2665000e4eac3b7d16ad1c/Cruise_Safety_Report_2022_sm-optimized.pdf)
- [GM, Cruise and Honda Japan JV - GM Investor Relations](https://investor.gm.com/news-releases/news-release-details/gm-cruise-and-honda-are-bringing-autonomous-vehicle-ridehail)
- [Honda ends Cruise tie-up - Nikkei Asia](https://asia.nikkei.com/business/automobiles/honda-to-end-self-driving-tie-up-with-gm-as-cruise-unit-founders)
- [Walmart investing in Cruise - CNBC](https://www.cnbc.com/2021/04/15/walmart-investing-in-gms-cruise-self-driving-car-company.html)
- [Patents Assigned to GM Cruise Holdings LLC - Justia](https://patents.justia.com/assignee/gm-cruise-holdings-llc)
- [GM's path to full autonomy - GM News](https://news.gm.com/home.detail.html/Pages/topic/us/en/2025/oct/1009-GMs-path-full-autonomy-Building-trust-step-by-step.html)
- [GM to launch eyes-off driving - GM News](https://news.gm.com/home.detail.html/Pages/news/us/en/2025/oct/1022-AI-GM-launch-eyes-off-driving-conversational-AI.html)
- [GM Plans Eyes-Off Driving by 2028 - InsideEVs](https://insideevs.com/news/776525/gm-super-cruise-eyes-off-2028/)
- [GM acquires full ownership of Cruise - GM News](https://news.gm.com/home.detail.html/Pages/topic/us/en/2025/feb/0204-cruise.html)
- [After Cruise shutdown: GM renews autonomous push - electrive](https://www.electrive.com/2025/08/12/after-cruise-shutdown-general-motors-renews-autonomous-driving-push/)
- [Cruise Houston launch - TechCrunch](https://techcrunch.com/2023/10/12/cruise-opens-robotaxi-service-in-houston/)
- [Cruise $5 flat fares Houston - Tech Times](https://www.techtimes.com/articles/297472/20231012/cruise-expands-self-driving-robotaxi-service-houston-5-flat-fares.htm)
- [Kyle Vogt - Wikipedia](https://en.wikipedia.org/wiki/Kyle_Vogt)
- [Cruise - Crunchbase](https://www.crunchbase.com/organization/cruise)
- [Fortune: Inside GM Cruise](https://fortune.com/2024/05/16/inside-gm-cruise-self-driving-car-accident-san-francisco-what-really-happened/)
