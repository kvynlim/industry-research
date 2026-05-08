# Aurora Innovation — Full AV Tech Stack Deep Dive

---

## 1. Perception System

Aurora's perception uses a **three-layer "Swiss Cheese" architecture** where overlapping layers compensate for each other's gaps:

| Layer | Function | Key Detail |
|---|---|---|
| **Mainline Perception** | Fuses lidar+camera+radar+HD map; detects/tracks known actors (vehicles, pedestrians, cyclists) | Powered by the **S2A (Sensor-to-Adjustment) neural network** operating on raw sensor data thousands of times per second per tracked object |
| **Remainder Explainer** | Explains every unexplained sensor measurement; tracks unknown/novel objects | ML-based **avoidance score** from dimensions, material type, motion. "No Measurement Left Behind" philosophy — detected a charred trailer fragment never seen in training |
| **Fault Management System** | Monitors hardware/software health; triggers safe pullover if degraded | Redundant backup computer; dozens of fault injection tests run daily |

**Sensor Fusion Pipeline** — Early fusion with three stages:
1. **Sensor-to-Tensor**: LiDAR+HD Map+RADAR → Euclidean View (3D); cameras → Image View (2D); LiDAR → Range View (2D spherical)
2. **Feature Extraction**: Separate CNN branches per view
3. **Final Fusion**: 2D features projected back into 3D, concatenated, processed through additional conv layers

**Neural Architectures:**
- **CNNs** for multi-view feature extraction
- **Graph Convolutional Networks (GCNs)** for motion prediction (agents as nodes, interactions as edges)
- **Transformers/attention** — Aurora states they've been "using transformer-style models on the road since 2021"

**Key Published Research:**

| Paper | Venue | Innovation |
|---|---|---|
| **LaserNet** | CVPR 2019 | Fully convolutional range-view detector with multimodal bounding box distributions |
| **LaserFlow** | ICRA 2022 (Best Paper RA-L) | Joint detection + motion forecasting in range view; first range-view method to beat BEV SOTA |
| **SpotNet** | arXiv 2024 | Image-centric, lidar-anchored long-range 3D detection with O(1) compute complexity vs range |

**Inherited from Uber ATG acquisition:** PIXOR, ContFuse, SpAGNN, PnPNet, LIDARsim, LaneGCN, LookOut.

**Online Sensor Calibration** — auxiliary regression head on existing detection model; corrects camera-lidar misalignment in **<100ms** with **<5% error**. Critical because at 400m+, milliradians of offset = a full highway lane.

*Sources: [Seeing with Superhuman Clarity](https://aurora.tech/newsroom/seeing-with-superhuman-clarity-the-physics-and-architecture-behind-the), [Perception: No Measurement Left Behind](https://aurora.tech/newsroom/perception-at-aurora-no-measurement-left-behind), [Continuous Real-Time Sensor Recalibration](https://aurora.tech/newsroom/continuous-real-time-sensor-recalibration-a-long-range-perception-game), [SpotNet (arXiv:2405.15843)](https://arxiv.org/abs/2405.15843)*

---

## 2. Motion Planning & Prediction

**Architecture: Proposer-Ranker** (not end-to-end, not purely rule-based)

- **Proposer**: Generates dynamically feasible trajectory candidates ("correctness by construction")
- **Ranker**: Scores each proposal using learned cost functions; runs **~10 Hz**
- Safety invariants (traffic rules, collision avoidance) enforced as **hard constraints** in ranking

**Interleaved Forecasting & Planning** — Aurora's key architectural differentiator:
- Rejects traditional cascaded pipeline (perception → prediction → planning)
- Instead: for each candidate AV action, the system predicts how other actors would respond (**conditional forecasting**)
- Evaluates joint (AV action, world response) outcomes
- Enables **causal reasoning**: "If I do X, what happens?" vs. "What will others do regardless of me?"

**Learning Methods:**

| Method | Role | Origin |
|---|---|---|
| **Maximum Entropy IRL** | Learns reward functions from human demonstrations | Drew Bagnell (co-founder), AAAI 2008 — won 2024 Classic Paper Award |
| **LEARCH** | Functional gradient imitation learning | Bagnell, Autonomous Robots 2009 |
| **DAgger** | Interactive imitation learning | Ross, Gordon, Bagnell (AISTATS 2011) |
| **RLHF** | Preference learning from virtual scenario annotations | Applied when real driving data unavailable |

**"Verifiable AI"** — hybrid approach: learned behavior from expert demonstrations + encoded invariants (stop at red lights, yield for emergency vehicles). Aurora explicitly rejects pure end-to-end as "an unmaintainable quagmire."

**Complex Scenario Handling:**
- **Construction zones**: 3,500+ miles of Texas construction navigated; cones/barrels treated as solid barriers; can override Atlas map with real-time perception of temporary lane lines
- **Emergency vehicles**: Detects rapid brightness/color changes; partnered with Frisco PD for testing
- **Merges**: Core use case for interleaved forecasting
- **Night driving**: Driverless since 2025; FirstLight LiDAR detects pedestrians >300m at night

*Sources: [AI Alignment blog](https://aurora.tech/newsroom/ai-alignment-ensuring-the-aurora-driver-is-safe-and-human-like), [Verifiable AI blog](https://aurora.tech/newsroom/auroras-verifiable-ai-approach-to-self-driving), [Forecasting Part 1](https://aurora.tech/newsroom/forecasting-part-1-understanding-interaction), [Construction Zones](https://aurora.tech/newsroom/capability-spotlight-tackling-construction)*

---

## 3. Hardware & Sensor Suite

### FirstLight LiDAR (FMCW)

| Spec | Value |
|---|---|
| **Technology** | Frequency-Modulated Continuous Wave (FMCW) — coherent detection |
| **Wavelength** | 1550 nm (eye-safe at higher power than 905nm ToF) |
| **Range** | Current: **450m+**; Gen 2 (2026): **1,000m** |
| **Velocity** | **Instantaneous per-point Doppler** (no frame-to-frame estimation needed) |
| **Sensitivity** | Single-photon sensitive |
| **Interference** | Immune — only detects its own signal timing/frequency/wavelength |
| **Form factor** | Evolving to **silicon photonics chip** (10x size reduction from OURS Technology acquisition) |
| **Manufacturing** | 78,000 sq ft facility in Bozeman, MT |

**Acquisitions**: Blackmore Sensors (2019, FMCW architecture) + OURS Technology (2021, silicon photonics) → combined into FirstLight.

*Sources: [FMCW Lidar: Game-Changer](https://aurora.tech/newsroom/fmcw-lidar-the-self-driving-game-changer), [FirstLight on a Chip](https://aurora.tech/newsroom/firstlight-lidar-on-a-chip)*

### Other Sensors

| Component | Details |
|---|---|
| **Cameras** | 7 cameras (forward stereo pair + 5 wide-angle), 1920x1200 px each, custom lenses, HDR capable |
| **Imaging Radar** | Custom with Continental; true 3D imaging; penetrates rain/fog/snow |
| **Total sensors** | 25+ providing overlapping 360° coverage |
| **Sensor cleaning** | Concentrated air + washer fluid nozzles, millisecond response |

### Aurora Driver Computer

| Spec | Gen 1 (Current) | Gen 2 (Mid-2026) | Gen 3 (2027) |
|---|---|---|---|
| **Compute** | 5,400 TOPS | Enhanced | Dual **NVIDIA DRIVE Thor** (Blackwell) ~2,000+ TFLOPS |
| **Manufacturer** | Aurora (internal) | **Fabrinet** | **AUMOVIO** (formerly Continental) |
| **Cost** | Baseline | **50% reduction** | Further **50% reduction** |
| **LiDAR range** | 450m | 1,000m | 1,000m+ |
| **Durability** | ISO 16750-3 | 1M-mile life | Tens of thousands of trucks |
| **Safety standard** | — | — | ISO 26262 ASIL-D |

**Redundancy**: Dual-computer architecture (primary + specialized fallback), redundancy across 8 domains: steering, braking, communication, computation, power, energy storage, vehicle motion, cooling.

**Networking**: Custom **TSN (Time-Sensitive Networking) switch** synchronizing all sensors to **microsecond precision**.

*Sources: [Aurora Driver](https://aurora.tech/aurora-driver/), [Meet Fusion](https://aurora.tech/newsroom/meet-fusion-the-aurora-drivers-next-generation), [NVIDIA Partnership](https://ir.aurora.tech/news-events/press-releases/detail/112/aurora-continental-and-nvidia-partner-to-deploy-driverless-trucks-at-scale)*

---

## 4. Mapping & Localization

**Aurora Atlas** — proprietary HD map with two layers:
- **World Geometry**: Sparse 3D point cloud from fleet sensor data (lightweight for OTA)
- **Semantic Annotations**: Lanes, signs, signals — some auto-generated by ML, rest manually annotated

**Key Design Choices:**
- **Locally-consistent, sharded** coordinate frames (not globally-consistent) — each shard ~ city-block-sized
- **Cloud Atlas**: Git-like versioned map database with concurrent editing, independent layer updates
- Map building requires only a **single manual drive** + cloud auto-annotation
- Updates pushed OTA in **hours**, not days

**Localization**: 6-DOF pose estimation by matching stored sparse geometry against live LiDAR scans. **GPS-independent.** Accuracy "much more precise than GPS."

**Map Override**: When construction creates mismatches, the system detects temporary lane lines in real-time and deviates from the Atlas.

*Sources: [The Atlas](https://aurora.tech/newsroom/the-atlas-our-hd-mapping-system), [Aurora Multi-Sensor Dataset](https://registry.opendata.aws/aurora_msds/)*

---

## 5. Simulation & Virtual Testing

**Offline Executor** — custom-built (not a game engine):
- **Deterministic lock-step** execution with autonomy software
- Same framework and libraries as production vehicle code
- Simulates latencies and compute delays
- Module-level testing: feeds synthesized inputs indistinguishable from real sensor data

**Scale:**
- **5-12 million tasks/day** via the Batch API
- **22+ million equivalent miles/day** in simulation
- Hundreds of thousands of concurrent vCPUs + thousands of GPUs on AWS

**Batch API** ("Aurora's Supercomputer") — written in **Go**:

| Component | Role |
|---|---|
| **Gateway API** | Stateless, HA, Protobuf-defined |
| **Runner** | Sharded stateful service managing execution across clusters |
| **TaskHost** | Lightweight binary deployed at runtime; zero-downtime updates |

DAGs up to **1 million tasks**. ~8x cheaper per compute unit than Spark. Target: scale from 10M → **1 billion daily tasks**.

**Scenario Generation:**
- **Curated**: Hand-crafted with nuanced validation criteria
- **Procedural**: Automated recipes generating **100,000+ scenarios in hours** (team includes former Pixar VFX artists)
- Completed **2.27 million unprotected left turns in simulation** before attempting one in reality

**Sensor Simulation**: Acquired **Colrspace** (Pixar veterans, 2022) — **Protocolr** uses neural networks for inverse rendering + differentiable image rendering. Simulates camera, conventional lidar, and FMCW lidar. Evaluated ~20,000 hardware design scenarios before manufacturing prototypes.

**Four-Tier Testing Pyramid:**
1. **Codebase Tests** — Unit + integration tests; must pass before merge
2. **Perception Tests** — Labeled real-world log data with ground-truth; broad metrics + specific capability tests
3. **Manual Driving Evaluations** — Expert trajectories compared against Aurora Driver planned movements
4. **Simulations** — Curated + procedural scenarios; disengagement events converted to virtual tests within days

**Safety Validation Scale:**
- ~10,000 requirements
- **4.5 million tests** before each software release
- ~20,000 FMCW hardware design simulations before prototype manufacturing

*Sources: [The Offline Executor](https://aurora.tech/newsroom/the-offline-executor), [Scaling Simulation](https://aurora.tech/blog/scaling-simulation), [Batch API Part 1](https://aurora.tech/blog/batch-api-part-1-auroras-supercomputer), [Batch API Part 2](https://aurora.tech/blog/batch-api-part-2-resource-management), [Batch API Part 3](https://aurora.tech/blog/batch-api-part-3-supercomputing-at-scale), [Colrspace Acquisition](https://aurora.tech/newsroom/pixar-veterans-join-aurora-to-advance-simulation-efforts), [Virtual Testing](https://aurora.tech/newsroom/virtual-testing-the-invisible-accelerator)*

---

## 6. Software Architecture & Engineering

**Custom Middleware** (not ROS) — deterministic framework enabling lock-step sim execution. No ROS references anywhere in Aurora's public materials.

**Languages:**

| Language | Use |
|---|---|
| **C++** | Core autonomy (perception, planning, control); C++ standards committee participation funded |
| **Go** | Backend services, Batch API, fleet management |
| **Python** | ML pipelines, data analysis, Kubeflow orchestration |
| **JavaScript** | Visualization (XVIZ, streetscape.gl) |

**Build & CI/CD:**

| Tool | Role |
|---|---|
| **Bazel** | Primary build system (monorepo) |
| **Buildkite** | CI/CD orchestration |
| **GitHub** | Source control, PR-triggered integration tests |
| **Docker** | Containerization |
| **Terraform** | Infrastructure-as-code on EKS |

**ML Infrastructure:**

| Tool | Role |
|---|---|
| **PyTorch** (primary), TensorFlow, JAX | ML training |
| **CUDA / cuDNN / TensorRT** | GPU compute, inference optimization |
| **Kubeflow Pipelines** | ML workflow orchestration on EKS |
| **Amazon SageMaker** | Distributed training |
| **Amazon S3 / EMR** | Data storage (petabytes) and processing |

**Data Engine** — cyclical ML lifecycle:
1. **Identify** data requirements for a capability
2. **Mine and label** on-road sensor data iteratively
3. **Train** ML models on prepared datasets
4. **Evaluate** at subsystem and system level
5. **Feed results** back for next iteration

Continuous deployment of datasets and models within **two weeks** of new data availability.

**Observability**: **Grafana Cloud** across 30+ Kubernetes clusters (migrated from Chronosphere + Honeycomb).

**Databases & Services:**

| Technology | Purpose |
|---|---|
| **PostgreSQL** | Primary relational DB |
| **Redis** | Caching layer |
| **gRPC** | Service-to-service communication |
| **Nginx** | Web server / reverse proxy |
| **Protobuf** | API serialization |

**5 Engineering Tenets:**
- **#LowFriction** — Remove barriers to experimentation; faster iteration wins
- **#AdviceNotGatekeeping** — Collaborative code review; reviewers don't block outside expertise
- **#CarryOurWater** — All teams share tool-building responsibility; no separate research team
- **#EndToEnd** — Accept imperfect tools; build end-to-end before framework transformation
- **#FirstClassLanguages** — Company-wide support for multiple languages with proper tooling

*Sources: [Engineering Tenets](https://aurora.tech/newsroom/auroras-software-engineering-tenets), [Data Engine](https://blog.aurora.tech/engineering/auroras-data-engine-how-we-accelerate-machine-learning-model-workflows), [Grafana ObservabilityCON](https://grafana.com/events/observabilitycon-on-the-road/2025/san-francisco-bay-area/auroras-observability-evolution-with-grafana-cloud/)*

---

## 7. Cloud Infrastructure (AWS — Exclusive Partner)

| AWS Service | Purpose |
|---|---|
| **Amazon EKS** | Kubernetes orchestration for sim + ML workloads |
| **Amazon EC2** (P4d GPUs) | Driving simulations (100k+ concurrent vCPUs, 1000s GPUs) |
| **Amazon SageMaker** | Distributed ML model training |
| **Amazon EMR** | Petabyte-scale data processing |
| **Amazon S3** | Sensor data storage (petabyte scale) |
| **AWS Global Accelerator** | Website network CDN |
| **AWS Route 53** | DNS |
| **AWS Direct Connect** | High-bandwidth vehicle-to-cloud data transfer |
| **Amazon DynamoDB** | Metadata and operational data |
| **AWS Athena + Glue** | Analytics on S3 Parquet data |

Custom **Batch Autoscaler** replaced Kubernetes Cluster Autoscaler for heterogeneous workloads. Tracks EC2 spot/on-demand pricing, enforces $/hr spend-rate caps, uses direct EC2 Fleet API for faster scaling.

**Placement API** distributes team-level resource quotas across multiple clusters and AWS regions.

*Source: [Aurora Accelerates Development with AWS](https://press.aboutamazon.com/2021/12/aurora-accelerates-development-of-the-aurora-driver-with-aws)*

---

## 8. Safety & Security

### Safety Case Framework

First-ever for autonomous vehicles, using **Goal Structuring Notation (GSN)**:

**5 Principles:**
1. **Proficient** (G1) — Acceptably safe during nominal operation
2. **Fail-Safe** (G2) — Safety maintained in presence of faults/failures
3. **Continuously Improving** (G3) — All safety issues evaluated and resolved
4. **Resilient** (G4) — Safe during foreseeable misuse and unavoidable events
5. **Trustworthy** (G5) — Enterprise is trustworthy

- ~10,000 requirements, **4.5 million tests**
- Publicly viewable at [safetycaseframework.aurora.tech/gsn](https://safetycaseframework.aurora.tech/gsn)
- Independently audited by **TUV SUD**

### Cybersecurity

- **Zero Trust Architecture** — continuous verification
- **Cryptographic attestation** via DICE protocols ([libnat20](https://github.com/aurora-opensource/libnat20) open-sourced)
- Custom intrusion detection integrated into FMS
- **No remote vehicle control** by design — remote assistants can only suggest

*Sources: [Safety Case 101](https://aurora.tech/newsroom/welcome-to-safety-case-101), [Cybersecurity blog](https://aurora.tech/newsroom/auroras-approach-to-cybersecurity-for-autonomous-trucking)*

---

## 9. Fleet Operations & Cloud

| System | Function |
|---|---|
| **Aurora Beacon** | Cloud-based fleet mission control (dispatch, monitoring, remote support, OTA updates) |
| **Aurora Cloud** | Customer-facing API for autonomous vehicle integration |
| **McLeod TMS Integration** | Plugs into existing carrier fleet management |

**OEM Partners**: PACCAR (Peterbilt/Kenworth), Volvo (VNL Autonomous), International (LT Series), Toyota (Sienna ride-hail).

**Operational Status (March 2026):**
- **250,000+ driverless miles**, zero Aurora Driver-attributed collisions
- **10 routes** across Texas, New Mexico, Arizona
- 100% on-time performance
- Customers: Uber Freight, FedEx, Werner Enterprises, Hirschbach
- Target: 200+ trucks, $80M run rate by end of 2026

*Sources: [Aurora Triples Network](https://ir.aurora.tech/news-events/press-releases/detail/132/aurora-triples-driverless-network-to-10-routes-and-prepares-to-expand-across-u-s-sun-belt), [250K Miles](https://finance.yahoo.com/news/aurora-innovation-touts-250k-incident-053545428.html)*

---

## 10. Patent Portfolio

**1,400+ patent assets** (~50% hardware, ~50% software). Key areas:

| Area | Examples |
|---|---|
| FMCW LiDAR | 19 families covering beam steering, chirp ranging, transceiver design |
| Perception | Sensor dropout training, point cloud generation, deep learning for image analysis |
| Planning | Basis path generation (US11561548B2), joint trajectory distribution modeling |
| Mapping | Fleet learning + map encoding (US20200400821A1), training data from sensors |
| Security | DICE attestation (libnat20) |

*Sources: [GreyB Patent Analysis](https://insights.greyb.com/aurora-innovation-patents/), [Justia Patents](https://patents.justia.com/assignee/aurora-operations-inc)*

---

## 11. Open Source

| Repo | Lang | Stars | Description |
|---|---|---|---|
| [**xviz**](https://github.com/aurora-opensource/xviz) | JS | ~1,068 | Protocol for real-time autonomy data transfer/visualization |
| [**streetscape.gl**](https://github.com/aurora-opensource/streetscape.gl) | JS | ~977 | React + WebGL visualization for robotics data |
| [**au**](https://github.com/aurora-opensource/au) | C++ | ~413 | Zero-dependency C++14 physical units library |
| [**libnat20**](https://github.com/aurora-opensource/libnat20) | C++ | 5 | DICE attestation (hardware root-of-trust) |
| Kubeflow forks (3) | Python/Jsonnet | — | Customized ML orchestration |

---

## 12. Key Acquisitions

| Company | Year | Technology Gained |
|---|---|---|
| **Blackmore Sensors** | 2019 | FMCW LiDAR architecture, digital signal processing |
| **Uber ATG** | 2020 | ~1,200 engineers, perception/prediction research, road test data, patents |
| **OURS Technology** | 2021 | Silicon photonics, lidar-on-chip (10x size reduction) |
| **Colrspace** | 2022 | Sensor simulation, inverse rendering (Pixar veterans) |

**Founding Team:**
- **Chris Urmson** — ex-Google/Waymo CTO
- **Sterling Anderson** — ex-Tesla Autopilot head
- **Drew Bagnell** — ex-Uber ATG autonomy/perception head; 43,000+ citations; MaxEnt IRL, DAgger, LEARCH inventor

---

## 13. Comparison: Aurora vs Waymo

| Dimension | Aurora | Waymo |
|---|---|---|
| **Primary Market** | Long-haul trucking (L4) | Robotaxi / urban (L4) |
| **LiDAR Type** | FMCW (FirstLight, 1550nm) | ToF (6th-gen in-house) |
| **LiDAR Range** | >450m (next-gen: 1,000m) | Not disclosed at same detail |
| **Instantaneous Velocity** | Yes (Doppler from FMCW) | No (estimated from frames) |
| **Architecture** | Modular with interleaved forecasting | Modular (separate perception/planning) |
| **Planning** | Proposer-Ranker with MaxEnt IRL | End-to-end foundation model (2024+) |
| **Simulation Engine** | Custom Offline Executor (deterministic lock-step) | SimulationCity + generative World Model |
| **Sim Scale** | 5-12M tasks/day; 9B+ equivalent miles | 15B+ virtual miles; generative scenarios |
| **Cloud** | AWS-native (EKS, EC2, SageMaker, S3) | Google Cloud / TPU-native |
| **Compute** | 5,400 TOPS; moving to NVIDIA DRIVE Thor | Custom TPU-based |
| **Key Advantage** | Highway-speed long-range perception (400m+) | Largest operational fleet, urban expertise |
| **Commercial Status** | Launched driverless trucking May 2025 (Texas) | Operating robotaxis in multiple cities |

---

## 14. Key Engineering Blog Posts

| Post | Topic | URL |
|---|---|---|
| Software Engineering Tenets | 5 engineering principles | [Link](https://aurora.tech/newsroom/auroras-software-engineering-tenets) |
| The Offline Executor | Deterministic simulation architecture | [Link](https://aurora.tech/newsroom/the-offline-executor) |
| Virtual Testing | Testing pyramid | [Link](https://aurora.tech/newsroom/virtual-testing-the-invisible-accelerator) |
| Scaling Simulation | Procedural scenario generation | [Link](https://aurora.tech/blog/scaling-simulation) |
| Data Engine | ML infrastructure with Kubeflow/Bazel | [Link](https://blog.aurora.tech/engineering/auroras-data-engine-how-we-accelerate-machine-learning-model-workflows) |
| Batch API Part 1 | Supercomputer infrastructure | [Link](https://aurora.tech/blog/batch-api-part-1-auroras-supercomputer) |
| Batch API Part 2 | Resource management | [Link](https://aurora.tech/blog/batch-api-part-2-resource-management) |
| Batch API Part 3 | Supercomputing at scale | [Link](https://aurora.tech/blog/batch-api-part-3-supercomputing-at-scale) |
| Seeing with Superhuman Clarity | Perception architecture | [Link](https://aurora.tech/newsroom/seeing-with-superhuman-clarity-the-physics-and-architecture-behind-the) |
| Perception: No Measurement Left Behind | Multi-layer perception | [Link](https://aurora.tech/newsroom/perception-at-aurora-no-measurement-left-behind) |
| Continuous Real-Time Sensor Recalibration | Online calibration | [Link](https://aurora.tech/newsroom/continuous-real-time-sensor-recalibration-a-long-range-perception-game) |
| The Atlas | HD mapping system | [Link](https://aurora.tech/newsroom/the-atlas-our-hd-mapping-system) |
| FMCW Lidar: Game-Changer | FirstLight technology | [Link](https://aurora.tech/newsroom/fmcw-lidar-the-self-driving-game-changer) |
| FirstLight on a Chip | Lidar miniaturization | [Link](https://aurora.tech/newsroom/firstlight-lidar-on-a-chip) |
| AI Alignment | Safe and human-like driving | [Link](https://aurora.tech/newsroom/ai-alignment-ensuring-the-aurora-driver-is-safe-and-human-like) |
| Verifiable AI | Invariants + learned driving | [Link](https://aurora.tech/newsroom/auroras-verifiable-ai-approach-to-self-driving) |
| Forecasting Part 1 | Interleaved forecasting | [Link](https://aurora.tech/newsroom/forecasting-part-1-understanding-interaction) |
| AI Transparency | GNNs, transformers, debugging | [Link](https://aurora.tech/newsroom/ai-transparency-the-why-and-how) |
| Fault Management | FMS architecture | [Link](https://aurora.tech/newsroom/capability-spotlight-fault-management) |
| Cybersecurity | Zero Trust, DICE attestation | [Link](https://aurora.tech/newsroom/auroras-approach-to-cybersecurity-for-autonomous-trucking) |
| Safety Case 101 | GSN-based safety methodology | [Link](https://aurora.tech/newsroom/welcome-to-safety-case-101) |
| Introducing Au | C++ units library | [Link](https://aurora.tech/newsroom/introducing-au-our-open-source-c-units-library) |
| Product Design from First Principles | Hardware-software co-design | [Link](https://aurora.tech/newsroom/product-design-from-first-principles-and-experience) |
| Meet Fusion | Next-gen hardware | [Link](https://aurora.tech/newsroom/meet-fusion-the-aurora-drivers-next-generation) |
| Construction Zones | Construction zone handling | [Link](https://aurora.tech/newsroom/capability-spotlight-tackling-construction) |
| Emergency Vehicles | Emergency vehicle response | [Link](https://aurora.tech/newsroom/capability-spotlight-responding-to-emergency-vehicles) |
| Stormy Weather | Adverse weather driving | [Link](https://aurora.tech/newsroom/capability-spotlight-stormy-weather) |

---

## 15. Corporate SaaS Tools (from DNS TXT Records)

| Tool | Category |
|---|---|
| **Atlassian** (Jira/Confluence) | Project management / documentation |
| **Slack** | Communication |
| **1Password** | Secrets management |
| **Monday.com** | Project management |
| **JetBrains** | IDEs (likely CLion for C++) |
| **Autodesk** | CAD/engineering design |
| **DocuSign** | Contract signing |
| **Zoom** | Video conferencing |
| **Cisco** | Networking |
| **Google Workspace** | Primary email/productivity |
| **Microsoft 365** | Secondary productivity suite |
| **Mixpanel** | Product analytics |
| **OneTrust** | Privacy/cookie compliance |

---

## 16. Website Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Nuxt 3 (Vue.js 3.5.13) |
| **Build Tool** | Vite (Rollup) |
| **State** | Pinia |
| **CMS** | Contentful (headless, GraphQL API) |
| **Search** | Algolia |
| **3D/WebGL** | Three.js + custom GLSL shaders |
| **Animation** | GSAP v3.12.7 (ScrollTrigger, ScrollSmoother) |
| **Video** | Mux |
| **Hosting** | Netlify |
| **CDN** | AWS Global Accelerator |
| **DNS** | AWS Route 53 |
| **Analytics** | Google Tag Manager, HubSpot, Sentry, Mixpanel |
| **Fonts** | Google Fonts (Inter + IBM Plex Mono) |
| **Built by** | Dogstudio agency |

---

## 17. Coordinate Frame Architecture — Point Cloud Processing

### Primary Processing Frame: Ego-Centric BEV

Aurora does **not** bind point clouds to the map frame. All perception processing happens in the **ego-centric vehicle frame**. This is confirmed in their Multi-View Fusion paper (WACV 2022): "each LiDAR sweep S_t at time t comprises LiDAR points represented by their (x,y,z) locations. Then, sweep S_t is voxelized in a BEV image **centered on the SDV**."

Aurora's "Euclidean View" is their internal name for ego-centric BEV. It is where LiDAR, RADAR, and HD Map data converge after transformation.

### How Each Data Source Enters the Ego Frame

| Data Source | Native Frame | Transformation |
|---|---|---|
| **LiDAR** | 3D sensor frame (spherical) | Voxelized directly into ego-centric BEV grid (deltaL=0.16m, deltaW=0.16m, deltaV=0.2m); also projected to sensor-native Range View |
| **Cameras** | 2D image frame | Features extracted in image space, projected into 3D ego-centric BEV via camera intrinsics/extrinsics (K, R, t) |
| **RADAR** | 3D radar frame | Transformed into ego-centric 3D space via calibrated extrinsics |
| **HD Map (Atlas)** | Local map anchor frame(s) | Transformed using 6-DOF localization pose → rasterized as **7 binary mask channels** into the same ego-centric BEV grid |

The map data comes **to the ego frame**, not the other way around. The Atlas is rasterized into the BEV grid as channel layers alongside sensor data.

*Source: [Multi-View Fusion (arXiv:2008.11901)](https://ar5iv.labs.arxiv.org/html/2008.11901)*

### Why Not Map Frame?

Aurora's Atlas uses **locally-consistent, sharded coordinate frames** (each shard ~ city-block-sized, with its own anchor point) — there isn't even a single unified global map frame to project into. Aurora explicitly states: "globally accurate maps simply aren't necessary for self-driving since our localization system doesn't require global consistency."

Processing in ego frame is preferred because:
- **Motion planning is native to Cartesian/BEV space** — outputs feed directly to the planner
- **Avoids map error propagation** — localization inaccuracies affect map overlay, not fundamental LiDAR/camera processing
- **Metric consistency** — object sizes are constant regardless of range (unlike perspective view)
- **Generalization** — learned features don't depend on global position/orientation

*Source: [The Atlas](https://aurora.tech/newsroom/the-atlas-our-hd-mapping-system)*

### Temporal Multi-Sweep Fusion (LaserFlow)

When fusing multiple LiDAR sweeps over time, Aurora does **not** transform raw point clouds into a common frame. Instead, **LaserFlow** performs fusion in **feature space** in the most recent sweep's coordinate frame:

1. Each sweep's features are extracted in its **native Range View frame** (sensor-centric spherical coordinates) using shared CNN weights
2. **Ego-motion encoding**: Vehicle pose delta between sweeps is computed as `Delta_s = P_0 * P_s^(-1)` and rotated to local azimuth alignment
3. **Feature warping**: 3D points are transformed to the current sweep's frame (`x' = P_0 * P_s^(-1) * x`), then reprojected to Range View coordinates
4. A **Feature Transformer Network** receives ego-motion features concatenated with per-sweep features and learns to "undo the effect of ego-motion on the extracted features" — isolating object motion from vehicle motion

The key insight: naively transforming point clouds between Range View frames **destroys information** because spherical projections cause perspective changes and point occlusion. Feature-space fusion avoids this.

*Source: [LaserFlow (arXiv:2003.05982)](https://ar5iv.labs.arxiv.org/html/2003.05982) — ICRA 2022 Best Paper*

### Three-Stage Pipeline by Frame

```
Stage 1: Sensor-to-Tensor
├── LiDAR + RADAR + HD Map ──→ Ego-centric BEV ("Euclidean View")
│   └── Map rasterized into BEV via 6-DOF localization pose
├── Cameras ──→ Image View (camera-native 2D)
└── LiDAR ──→ Range View (sensor-native spherical)

Stage 2: Feature Extraction (parallel CNNs)
├── Left path: BEV features (ego frame)
└── Right path: Range View + Image View features (sensor-native frames)

Stage 3: Final Fusion
└── Right path features projected INTO ego-centric BEV ──→ concatenated with left path ──→ final conv layers
    └── Output: detections in ego-centric BEV frame
```

Everything converges to **ego-centric BEV** at the end. The Range View and Image View are only used for feature extraction in their native frames — the final representation is always ego-centric.

### S2A Tracker and Remainder Explainer Frames

- **S2A (Sensor-to-Adjustment)**: Operates on **local ego-centric crops** centered on each tracked object, extracted from the ego-centric sensor representation. Runs thousands of iterations/second per object.
- **Remainder Explainer**: Operates on raw sensor returns in the same ego-centric frame as Mainline Perception — analyzes unexplained measurements and provides avoidance scores to motion planning.

### Uber ATG Heritage — All Ego-Centric

| Paper | Frame |
|---|---|
| **PIXOR** | Ego-centric BEV (70m forward, 40m lateral) |
| **PointPillars** | Ego-vehicle coordinate frame (pillar-based BEV pseudo-image) |
| **ContFuse** | Projects LiDAR to ego-centric BEV, retrieves camera features via KNN + unprojection |
| **LaserNet** | Sensor-native Range View, outputs in ego-centric BEV |

No Aurora paper, blog post, or patent describes transforming point clouds into a global/map frame before perception processing.

### SpotNet — Camera-Centric for Long Range

SpotNet (arXiv:2405.15843) operates primarily in the **camera frame** for long-range detection:
- 3D positions expressed relative to camera position/orientation
- LiDAR points projected into image space using z-buffering
- Object heading parameterized as bearing-relative: theta_k = phi_k - alpha_k
- 3D distance parameterized along camera ray (range invariant): delta_d = r * v
- Input: 5-channel RGB-D tensor (3 RGB + sparse LiDAR depth + binary sentinel)
- Computational cost scales O(1) with range (vs O(r^2) for BEV methods)
- Final NMS uses both 2D image-space NMS (IoU 0.5) and BEV NMS (IoU 0.2)

*Source: [SpotNet (arXiv:2405.15843)](https://arxiv.org/html/2405.15843v1)*

---

## 18. Perception Stack Deep Dive — Segmentation, Object Representation, and Classification

### Object Representation Format

Aurora's primary output is **oriented 3D bounding boxes (cuboids)**, not polygon meshes or per-point segmentation masks. However, patent US10579063B2 explicitly mentions **"bounding polygon or other shape"** as an object footprint representation, suggesting polygonal representations may exist internally for certain use cases.

### Detection Head Output Formats by Network

**LaserNet** (Range View, per-point):
- Class probabilities for C classes
- **K=3 mixture modes** per vehicle (K=1 for pedestrians/bikes) — each mode outputs: center offset (dx, dy), orientation (omega_x, omega_y), length, width
- Laplace distribution scales (uncertainty per mode)
- Mixture weights
- Fused via **mean-shift clustering** with inverse-variance weighting
- Height is **fixed** — all objects assumed on same ground plane

*Source: [LaserNet (CVPR 2019)](https://openaccess.thecvf.com/content_CVPR_2019/papers/Meyer_LaserNet_An_Efficient_Probabilistic_3D_Object_Detector_for_Autonomous_Driving_CVPR_2019_paper.pdf)*

**LaserFlow** (Range View, per-point, temporal):
- Class, length, width
- **6 future waypoints** over 3 seconds (0.5s intervals) as sequential displacement vectors
- Per-timestep heading as doubled-angle encoding: (cos 2omega, sin 2omega)
- Per-timestep **Laplace uncertainty** decomposed into along-track and cross-track

*Source: [LaserFlow (arXiv:2003.05982)](https://ar5iv.labs.arxiv.org/html/2003.05982)*

**SpotNet** (Image-centric, long-range):
- Three heads at H/2 x W/2: class, 2D box, 3D box
- 3D box: projected centroid offsets, distance along camera ray, extents (w, l, h), bearing-relative heading
- Detected classes: **vehicles, VRU (pedestrians/cyclists), construction equipment, signs, traffic cones, traffic lights**

*Source: [SpotNet (arXiv:2405.15843)](https://arxiv.org/abs/2405.15843)*

**S2A Tracker** (production system):
- Operates on **local ego-centric sensor crops** around each tracked object
- Outputs: refined **position, velocity, orientation** + estimated future positions
- Runs directly on raw lidar/radar/camera data, not just upstream detections

*Source: [Seeing with Superhuman Clarity](https://aurora.tech/newsroom/seeing-with-superhuman-clarity-the-physics-and-architecture-behind-the)*

---

### Per-Point Semantic Segmentation (LaserNet++)

Aurora **does** perform per-point LiDAR segmentation — confirmed in LaserNet++ (CVPRW 2019). Six classes:

| Class | IoU |
|---|---|
| Background | — |
| **Road** | **98.23%** |
| Vehicle | — |
| Pedestrian | — |
| Bicycle | — |
| Motorcycle | — |

Runs jointly with detection on a shared backbone — single 1x1 conv output layer. The road segmentation effectively provides drivable surface estimation.

*Source: [LaserNet++ (arXiv:1904.11466)](https://arxiv.org/abs/1904.11466)*

### Per-Point Instance Segmentation (OSIS — Remainder Explainer Predecessor)

OSIS (arXiv:1910.11296, Uber ATG) performs **open-set instance segmentation**:
- Category-agnostic embedding network learns per-point embeddings in BEV
- **DBSCAN clustering** groups points into instances — both known AND unknown categories
- BEV resolution: 0.15625m over 160x160x5m region
- Known: vehicle, pedestrian, motorbike
- **Unknown: anything else** — groups novel physical objects into separate instances without classification

This is almost certainly the research foundation for the Remainder Explainer.

*Source: [OSIS (arXiv:1910.11296)](https://ar5iv.labs.arxiv.org/html/1910.11296)*

---

### Static vs Dynamic Object Separation

#### What Comes from the HD Map (Static — No Real-Time Detection Needed)

Aurora's Atlas provides 7 rasterized binary mask channels in BEV:

1. Driving paths
2. Crosswalks
3. Lane boundaries
4. Road boundaries
5. Intersections
6. Driveways
7. Parking lots

Plus: 3D geometry of static scenery (buildings, vegetation, infrastructure), traffic signal positions, stop signs, speed limits.

*Source: [Multi-View Fusion (arXiv:2008.11901)](https://ar5iv.labs.arxiv.org/html/2008.11901)*

#### What Comes from Real-Time Perception (Dynamic + Novel Static)

| Category | Representation | Source Module |
|---|---|---|
| Vehicles, pedestrians, cyclists, motorcycles | Oriented 3D bounding boxes with velocity/trajectory | Mainline Perception (LaserNet/LaserFlow/SpotNet -> S2A tracker) |
| Unknown physical objects | **Generic cuboids with avoidance score** (gray in Lightbox viz) | Remainder Explainer |
| Construction cones/barrels | Individual detections -> **aggregated into "blockage regions"** (yellow wall in Lightbox) | Construction perception module |
| Temporary lane markings | Real-time camera-based lane detection | Overrides Atlas when detected |
| Road surface (drivable area) | Per-point semantic label ("Road" class) | LaserNet++ segmentation head |

#### FMCW LiDAR Static/Dynamic Separation (Patent US11550061B2)

Aurora's FMCW lidar gives **instantaneous per-point Doppler velocity**, enabling hardware-level static/dynamic classification:
- Points with zero radial velocity -> **immobile** (trees, signs, guardrails) -> can be excluded from trajectory planning
- Points with non-zero velocity -> **mobile** (vehicles, pedestrians, animals) -> full tracking pipeline
- Patent explicitly states: *"can exclude object(s) having certain classification(s) indicative of non-moving objects, such as a tree classification"*

This is a massive architectural advantage — ToF lidars can't do this without multi-frame tracking.

*Source: [US11550061B2](https://patents.google.com/patent/US20190317219A1)*

---

### Construction Zone Pipeline

```
Sensor data
  |
  +-- Detect individual construction elements (cones, barrels, barriers, equipment)
  |     +-- SpotNet classifies: "traffic cones", "construction equipment" as distinct classes
  |
  +-- Aggregate into BLOCKAGE REGIONS
  |     +-- Individual detections merged into continuous barrier representation
  |     +-- Treated as equivalent to a SOLID WALL by the motion planner
  |     +-- Rendered as yellow wall in Lightbox visualization
  |
  +-- Detect temporary lane markings (camera-based)
  |     +-- When detected, OVERRIDES Atlas HD map lane geometry
  |     +-- Vehicle follows perceived lanes instead of mapped lanes
  |
  +-- Extended nudging capability
        +-- Can drive partially on shoulder to avoid construction encroachment
```

3,500+ miles of Texas construction zones driven through.

*Sources: [Tackling Construction](https://aurora.tech/newsroom/capability-spotlight-tackling-construction), [Eyes on the Roadmap](https://aurora.tech/newsroom/eyes-on-the-roadmap-the-aurora-driver-advances-toward-feature-complete)*

---

### Ground Plane Estimation

**MMF (Multi-Task Multi-Sensor Fusion, CVPR 2019):**
- Ground height estimation as an **auxiliary training task**
- Estimated ground height subtracted from regression targets to improve 3D localization
- Used during training only — not required at inference

**Patent US12051001B2 (Multi-Task Multi-Sensor Fusion):**
- Includes a dedicated **machine-learned mapping model** that estimates **ground geometry (road surface elevation)** as a multi-task output alongside 3D/2D detection and depth completion

**LaserNet limitation:** Assumes flat ground plane. LaserNet++ reports misclassifying road points as background on steep roads — suggesting Aurora has since improved ground estimation for production.

**Patent US10967862B2 (Road Anomaly Detection):**
- Detects potholes, rail tracks, road cracks, depressions using **IMU data signatures** (accelerometer, gyroscope, magnetometer)
- Matches against a library of known road anomaly patterns
- Updates localization maps with labeled anomaly locations

*Sources: [MMF (CVPR 2019)](https://patrick-llgc.github.io/Learning-Deep-Learning/paper_notes/mmf.html), [US12051001B2](https://patents.google.com/patent/US20230043931A1/en), [US10967862B2](https://patents.google.com/patent/US10967862B2/en)*

---

### Occupancy Representations

| Method | Type | Details |
|---|---|---|
| **PIXOR BEV input** | 3D voxel grid | 800x700x38, binary occupancy + intensity, 0.1m resolution |
| **OSIS** | BEV rasterization | 0.15625m resolution, 160x160x5m, 3D occupancy voxels |
| **MP3** | **Semantic occupancy flow** | Per-BEV-cell motion vectors + probabilities — represents dynamic objects as flowing occupancy, not instance bounding boxes |
| **Patent US11531346B2** | **Lane-based occupancy cells** | 1D spatial cells per lane, probability of object occupying each cell over prediction horizon, uses Graph CNNs |
| **Patent US11521396B1** | Probabilistic occupancy distributions | Scene rasterization with probabilistic prediction |
| **Multi-view fusion input** | BEV voxels | LxWxV dimensions, T=10 historical sweeps stacked |

MP3's **occupancy flow** is particularly notable — it represents dynamic objects as per-cell probability distributions with motion vectors rather than tracked instances, which avoids the hard data association problem entirely.

*Sources: [PIXOR (CVPR 2018)](https://ar5iv.labs.arxiv.org/html/1902.06326), [MP3 (CVPR 2021)](https://arxiv.org/abs/2101.06806), [US11531346B2](https://patents.google.com/patent/US11531346B2), [US11521396B1](https://patents.google.com/patent/US11521396B1)*

---

### Full Object Class Taxonomy (Reconstructed)

**Mainline Perception (confirmed classes):**
- Vehicle (car, truck — likely sub-categorized)
- Motorcycle
- Pedestrian
- Cyclist / Bicycle

**SpotNet extended classes:**
- Construction equipment
- Signs
- Traffic cones
- Traffic lights

**Semantic segmentation (LaserNet++):**
- Background
- Road
- Vehicle
- Pedestrian
- Bicycle
- Motorcycle

**Remainder Explainer (no classification — avoidance only):**
- Generic unknown obstacle -> assigned avoidance score based on dimensions, material, motion
- Examples handled: charred trailer, dropped debris, detached tires, livestock

**FMCW static classification (Patent US11550061B2):**
- Trees
- Signs
- Other immobile objects (guardrails, barriers, buildings)
- Animals (classified as mobile)

The production taxonomy is almost certainly **10+ classes** given SpotNet's granularity.

---

### Lane Detection: Map vs Perception

**From HD Map (default):** The Atlas contains lane boundaries, lane segments (described relationally to predecessor/successor), and road markings. Cameras contribute "semantic details such as signage, lane markers, and critical actor attributes."

**Real-time override for construction:** When Aurora detects temporary lane markings that conflict with the Atlas, the perception system **overrides the map**. The vehicle deviates from Atlas-guided paths and follows perceived lane lines instead.

**HDNET fallback (CoRL 2018):** When HD maps are unavailable, a **map prediction module** estimates road layout on-the-fly from a single LiDAR sweep, predicting BEV road segmentation.

*Sources: [The Atlas](https://aurora.tech/newsroom/the-atlas-our-hd-mapping-system), [HDNET (CoRL 2018)](http://proceedings.mlr.press/v87/yang18b/yang18b.pdf)*

---

### Spatio-Temporal Memory for Feature Detection (Patent US11217012B2)

Aurora's travel way feature identification system uses a **non-parametric memory database**:
- Receives 2D image data and 3D LiDAR data
- DNN produces per-pixel class probability estimates from camera images
- LiDAR points projected onto camera imagery assign classifications to 3D locations
- Memory database captures **local space and time** — the system **remembers** past observations, **reinforces** repeated detections, and **forgets** stale ones
- Includes **occlusion reasoning** via depth comparison across timesteps
- Used for lane markings, traffic cones, signs, and other travel way features

*Source: [US11217012B2](https://patents.google.com/patent/US11217012B2/en)*

---

### Key Perception Patents

| Patent | Title | Key Detail |
|---|---|---|
| **US10310087B2** | Range-view LIDAR-based object detection | Per-cell class + instance center + bounding box in range view |
| **US10579063B2** | ML for predicting locations of objects | **"Bounding polygon or other shape"** as object footprint; static object classifier |
| **US11550061B2** | Phase coherent LIDAR classification | FMCW per-point velocity -> static/dynamic separation |
| **US12051001B2** | Multi-task multi-sensor fusion | 3D bounding boxes + ground geometry estimation |
| **US11531346B2** | Goal-directed occupancy prediction | Lane-based 1D occupancy cells with GCN |
| **US11521396B1** | Probabilistic prediction of dynamic objects | Probabilistic occupancy distributions |
| **US11217012B2** | Travel way feature identification | 2D/3D segmentation fusion with spatio-temporal memory |
| **US10967862B2** | Road anomaly detection | IMU-based pothole/crack detection |
| **US10489686B2** | Object detection for an autonomous vehicle | Pixel-level detection via background subtraction |

---

### Key Published Papers on Object Representation

| Paper | Venue | Contribution |
|---|---|---|
| **LaserNet** | CVPR 2019 | Per-point multimodal mixture of oriented 3D boxes in range view |
| **LaserNet++** | CVPRW 2019 | Per-point semantic segmentation (6 classes) + detection with camera fusion |
| **LaserFlow** | RA-L 2021 / ICRA 2022 | Joint detection + temporal displacement trajectories in range view |
| **SpotNet** | arXiv 2024 | Image-centric, LiDAR-anchored long-range 3D boxes with learned uncertainty |
| **PIXOR** | CVPR 2018 | BEV single-stage oriented bounding box detector |
| **Fast and Furious** | CVPR 2018 | Joint detection + tracking + forecasting with BEV temporal 3D convolutions |
| **HDNET** | CoRL 2018 | HD map road segmentation in BEV as detection prior + online map prediction |
| **ContFuse** | ECCV 2018 | Continuous convolution for LiDAR-camera fusion in BEV |
| **MMF** | CVPR 2019 | Ground estimation + depth completion as auxiliary tasks for 3D detection |
| **PnPNet** | CVPR 2020 | End-to-end perception + prediction with tracking in the loop |
| **IntentNet** | CoRL 2018 | Joint detection + intention + trajectory prediction from BEV LiDAR |
| **MP3** | CVPR 2021 | Mapless driving with online BEV semantic mapping + occupancy flow |
| **OSIS** | arXiv 2019 | Open-set per-point instance segmentation for unknown objects |
| **LiDARsim** | CVPR 2020 | 3D mesh reconstruction of objects + environments for realistic simulation |
| **Multi-View Fusion** | WACV 2022 | BEV+RV+Camera fusion with 7-channel rasterized map input |
| **RV-FuseNet** | arXiv 2020 | Range-view temporal fusion for joint detection and trajectory estimation |
| **MVFuseNet** | CVPR 2021 Workshop | Multi-view fusion (RV + BEV) for joint detection and motion forecasting |

---

## 19. Non-ML Perception Technology Deep Dive

### FMCW LiDAR Signal Processing (FirstLight)

Aurora's FMCW LiDAR originates from two acquisitions: **Blackmore Sensors & Analytics** (May 2019, Bozeman, MT) and **OURS Technology** (February 2021, Berkeley, CA).

#### Chirp Pattern and Waveform

Two principal chirp approaches from Aurora's patents:

**Triangle chirp (sequential up/down):** The laser frequency is linearly swept upward (up-chirp) then downward (down-chirp). The beat frequency during the up-chirp is `f_beat_up = k*tau - f_Doppler` and during the down-chirp is `f_beat_down = k*tau + f_Doppler`, where `k` is the chirp rate, `tau` is the round-trip delay, and `f_Doppler` is the Doppler shift. Solving simultaneously:
- **Range:** `R = c(f_beat_up + f_beat_down) / (4k)`
- **Velocity:** `v = lambda(f_beat_down - f_beat_up) / 4`

**Complementary simultaneous chirp (OURS Technology, Patent US20210096253A1):** Two lasers paired — one with increasing frequency, one with decreasing frequency — firing simultaneously. A 90-degree optical hybrid separates the resulting beat frequencies by sign in the I/Q domain. This eliminates sequential up/down sweeps, reducing acquisition time by ~50%. Range is extracted as `(f_up_beat - f_down_beat)/2` and velocity as `(f_up_beat + f_down_beat)/2`.

#### Beat Frequency Extraction and IF Signal

Per Blackmore patent US7742152B2, coherent detection uses a **self-homodyne** scheme: both transmitted signal and local oscillator (LO) are modulated by the identical chirp. The backscattered delayed signal `u(t-Delta)` beats against the current LO chirp `u(t)` at the photodetector, producing an intermediate frequency (IF) signal. The de-chirped signal yields a constant beat frequency: `f_d = (f2-f1)*Delta/tau`, directly mapping transit delay to frequency.

Tested parameters from the patent: frequency chirped from 100 MHz to 200 MHz within each 40 us pulse, producing a 2.5 MHz/us chirping rate, with pulse repetition rate of 8.7 kHz at ~35% duty cycle.

#### DSP Algorithm Chain

1. **Balanced photodetection:** Balanced photodiode pairs (80 kHz to 650 MHz bandwidth per US10948600) mix the returned signal with the LO, producing I and Q electrical channels
2. **Transimpedance amplification (TIA):** Converts photocurrent to voltage
3. **ADC digitization:** Converts analog IF signal to digital samples. De-chirping in the optical domain compresses bandwidth so lower-rate ADCs suffice
4. **Digital Down Conversion (DDC):** Shifts frequency content to baseband using LPF/HPF with cutoff at half the ADC sampling rate, with power comparison selecting the band with maximum energy
5. **Windowing:** Applied to reduce spectral leakage (the first sidelobe of a rectangular window FFT sits at -13 dB)
6. **FFT for range:** Transforms the IF signal from time domain to frequency domain; the peak bin position identifies beat frequency, hence range
7. **PSD computation for I+jQ:** Complex-valued signal from I and Q channels undergoes power spectral density analysis to identify both positive and negative frequency peaks (per US20210096253A1)
8. **ST-CFAR (Simple Threshold Constant False Alarm Rate):** Post-FFT interpolation between bins to achieve sub-bin resolution, improving range accuracy beyond theoretical FFT bin spacing

#### Coherent Detection vs Direct Detection: SNR Advantage

From patent US7742152B2, coherent detection SNR scales linearly with received signal power (1 dB/dB slope), while direct detection SNR scales quadratically (2 dB/dB slope). This yields approximately **~10 dB advantage** at lower power levels. Coherent detection achieves **shot-noise-limited performance**, sensitive to single photons. The narrower receiver bandwidth (hundreds of MHz vs. >2 GHz for ToF) further reduces noise.

#### Phase Noise Mitigation

Patent US7742152B2 describes two methods:
- **3x3 fiber coupler method:** Three outputs separated by 120-degree phase differences feed three photodetectors. DSP combines these to remove phase noise
- **90-degree I/Q method:** Quadrature outputs allow signal extraction by squaring and adding photocurrents

#### Mirror Doppler Compensation (Patents US11262437B1, US11366200)

Scanning mirrors at high angular speeds (>5 kdeg/s) cause Doppler broadening. The patented solution:
1. Sample L points around frequency peaks in both primary and reference signals (which undergo identical mirror Doppler broadening)
2. Convolve the two sample sets
3. The convolution peak at index Delta reveals the spectral shift; refine both peaks by Delta/2

This is a **template-matching approach** achieving blind equalization without explicit Doppler rate estimation.

#### Interference Rejection

FMCW inherently rejects interference because the coherent receiver only responds to light matching its own timing, frequency, and wavelength. Non-matching light is filtered out during heterodyne mixing.

*Sources: [US7742152B2](https://patents.google.com/patent/US7742152), [US20210096253A1](https://patents.google.com/patent/US20210096253A1/fr), [US20190317219A1](https://patents.google.com/patent/US20190317219A1/en), [US20200400821A1](https://patents.google.com/patent/US20200400821A1/en), [US11262437B1](https://patents.google.com/patent/US11262437B1/en), [US11366200](https://patents.justia.com/patent/11366200), [US10948600](https://patents.justia.com/patent/10948600), [Blackmore - LIDAR Magazine](https://lidarmag.com/2019/10/07/blackmore-leads-the-way-with-fm-lidar-for-av-applications-2/)*

---

### Silicon Photonics Integration (OURS Technology)

The on-chip implementation integrates:
- **Optical distribution network:** Binary tree structure distributing frequency-modulated signals to parallel transceiver slices
- **Coherent receiver (CR) units** per transceiver slice
- **On-chip optical antennas** (surface grating couplers or edge couplers)
- **2x2 bidirectional splitters** for light distribution
- **Balanced 2x2 mixers or optical hybrids** for coherent mixing
- **Integrated photodiodes** for optical-to-electrical conversion
- **Mode field converters** to shape beam divergence

A lens system at the focal plane creates collimated beams at different angles. A mechanical scanner deflects all beams together in coordinated raster patterns, with denser scanning at the center of the FOV for higher resolution.

*Sources: [US20210096253A1](https://patents.google.com/patent/US20210096253A1/en), [FirstLight on a Chip](https://aurora.tech/newsroom/firstlight-lidar-on-a-chip)*

---

### Point Cloud Preprocessing (Pre-ML)

#### Ego-Motion Compensation / Deskewing (Patent US20200400821A1)

FMCW-unique: because each point carries instantaneous radial velocity via Doppler, ego-motion can be estimated from a **single sweep** without IMU:

**Translational velocity estimation:**
1. Collect raw points, each carrying (azimuth, inclination, range, radial_velocity)
2. Solve for 3D translational velocity (vx, vy, vz) via least-squares minimization of residuals across all points
3. Apply bidirectional scan averaging to cancel acceleration artifacts
4. Detect transverse velocity discontinuities when beam wraps around FOV

**Rotational velocity estimation:**
1. For N sensor origins at different lever arms from rotation center: `v_y(x) = v_y0 + omega_z * x`
2. Least-squares fit extracts angular velocity (omega_x, omega_y, omega_z)
3. PCA on parameterized velocity-vs-position identifies rotation vector and center of rotation

**Point cloud correction:**
1. Remove sensor motion effects to project points to earth-fixed frame
2. Distinguish stationary features via threshold filtering on corrected velocities
3. Apply deskewing to align temporal sampling artifacts

This is entirely classical linear algebra and least-squares estimation — no ML involved.

*Source: [US20200400821A1](https://patents.google.com/patent/US20200400821A1/en)*

#### Range View Discretization

Aurora uses **range view (spherical coordinate) discretization** rather than BEV cartesian grids for primary LiDAR representation. The range view discretizes points in spherical coordinates, producing a dense rasterized grid native to the sensor's viewpoint. This avoids the sparsity problem BEV suffers at long range.

*Source: [Harnessing the Range View](https://aurora.tech/newsroom/a-piece-of-the-perception-puzzle-harnessing-the-range-view)*

---

### Sensor Calibration

#### Pre-Mission Calibration (Classical)

Aurora uses **checkerboard fiducials** placed around the vehicle at terminals. The calibration system captures these from all cameras and LiDARs, then aligns and optimizes sensor data to find the relative pose of each fiducial for all camera-LiDAR pairs. Standard techniques: PnP (Perspective-n-Point) for camera-to-world and point-based registration for LiDAR-to-world.

#### Online Recalibration

Regresses pitch and yaw miscalibration as an auxiliary output of the existing long-range detection model:
- Operates in real-time (<100 ms)
- Average absolute error under 5% of injected noise values
- Extensible to full 6-DOF
- Uses **aleatoric heteroscedastic uncertainty** estimation to flag low-confidence calibration situations (motion blur, featureless scenes)

#### Post-Mission Validation

Generates calibration status reports that feed into a data validation system, filtering miscalibrated data before ingestion by the labeling engine.

*Source: [Continuous Real-Time Sensor Recalibration](https://aurora.tech/newsroom/continuous-real-time-sensor-recalibration-a-long-range-perception-game)*

---

### TSN (Time-Sensitive Networking) and Sensor Synchronization

Aurora's custom networking switch is the **backbone** of the Aurora Driver computer. It uses an advanced networking chip with next-generation, high-bandwidth automotive physical layers to:
- Move data between nodes efficiently
- Duplicate data packets for redundancy
- Provide redundant pathways
- **Synchronize sensors to microsecond precision**

TSN is an IEEE 802.1 standard suite providing deterministic, low-latency communication. Aurora's implementation stitches all sensors and peripheral devices into one common hub with a common time reference, enabling tight temporal alignment of LiDAR sweeps, camera frames, radar returns, and IMU measurements.

The Aurora computer uses **enterprise-class server architecture** with processors designed for ML acceleration and camera signal processing. It conditions and distributes its own power, coordinates and synchronizes its own sensors, communicates with the vehicle over a simple umbilical, and communicates with transportation networks over a common network.

*Source: [Product Design from First Principles](https://aurora.tech/newsroom/product-design-from-first-principles-and-experience)*

---

### Localization Against the Atlas

#### D-LOAM (Doppler LIDAR Odometry and Mapping — Patent US20200400821A1)

The Blackmore/Aurora vehicle odometry patent describes **D-LOAM** that uses the ego-motion-corrected point cloud for:
1. Feature extraction from stationary objects (identified via Doppler velocity thresholding)
2. Correlation with previously mapped features
3. 6-DOF pose estimation (3 translational + 3 rotational)
4. Continuous map updates and vehicle localization

This is a classical SLAM-like approach enhanced by FMCW's direct velocity measurements, which allow immediate separation of moving vs. stationary features — something ToF LiDAR cannot do without multi-frame tracking.

#### Atlas Matching

Aurora states localization "determines the vehicle's position in all 6 degrees of freedom relative to the Atlas by matching up stored geometry data with what our sensors are 'seeing' in real time." The stored world geometry is a sparse 3D representation, lightweight for OTA updates.

While Aurora does not publicly name the specific algorithm, the description (6-DOF pose from matching live sensor data against stored sparse 3D geometry) is consistent with **point-to-plane ICP** or **NDT (Normal Distributions Transform) scan matching**.

*Sources: [US20200400821A1](https://patents.google.com/patent/US20200400821A1/en), [The Atlas](https://aurora.tech/blog/the-atlas-our-hd-mapping-system/)*

---

### Tracking and State Estimation (Classical Components)

#### Extended Kalman Filter (EKF)

Aurora's job postings for Senior Perception Software Engineer - Tracking explicitly require: *"design, implement, evaluate, and improve state estimation algorithms (such as EKF) for tracking objects around the AV"* and demand *"extensive experience in state estimation, Kalman Filter implementation, and 3D object tracking."*

This confirms **EKF** is a core component of Aurora's tracking pipeline, operating alongside/within the S2A neural network tracker.

#### Velocity Estimation (Patent US20190317219A1)

The phase-coherent LiDAR perception patent describes **classical velocity aggregation methods** selected adaptively based on object class and data quality:
- **Mean aggregation:** Simple average of per-point velocities (used for pedestrians)
- **Median aggregation:** Robust central tendency
- **Histogram analysis:** Bin velocities by range, select modal bin (used for vehicles)
- Technique selection depends on object classification, quantity of data points, and object proximity

*Sources: [Senior Perception Engineer - Tracking Job Posting](https://builtin.com/job/senior-perception-software-engineer-tracking/3093826), [US20190317219A1](https://patents.google.com/patent/US20190317219A1/en)*

---

### Radar Signal Processing

Aurora develops **custom imaging radar** with "far greater range and resolution than traditional automotive radar," producing "true and precise 3D images" through rain, dense fog, and snow.

While Aurora has not published detailed radar DSP specs, their imaging radar necessarily uses standard FMCW radar DSP:
- **MIMO virtual array** for angular resolution enhancement
- **Range FFT** (fast-time) and **Doppler FFT** (slow-time) to produce range-Doppler maps
- **Beamforming** (digital or analog) for angle estimation
- **CFAR detection** on the range-Doppler-angle cube

The perception system dynamically shifts reliance toward imaging radar during dust storms or fog where optical sensors are degraded.

*Source: [Product Design from First Principles](https://aurora.tech/newsroom/product-design-from-first-principles-and-experience)*

---

### Camera ISP and Preprocessing

Aurora uses custom-designed camera modules with **Aurora-designed lenses** and **rolling shutter imagers** selected for improved resolution and SNR. The cameras are "high-dynamic-range" capable of seeing through sun glare.

Standard ISP operations that necessarily occur before any ML model:
- **Debayering** (demosaicing the Bayer-pattern raw data)
- **HDR tone mapping** (for their high-dynamic-range cameras)
- **Lens distortion correction** (given custom lens designs)
- **Auto-exposure and auto-white-balance**
- **Rolling shutter correction** (they specifically note rolling shutter imagers)

Camera signal processing is handled by the Aurora computer's dedicated processors.

Aurora has an onboard **sensor-cleaning system** that preserves optical quality — concentrated air + washer fluid nozzles with millisecond response.

*Sources: [Product Design from First Principles](https://aurora.tech/newsroom/product-design-from-first-principles-and-experience), [Superhuman Clarity](https://aurora.tech/newsroom/seeing-with-superhuman-clarity-the-physics-and-architecture-behind-the)*

---

### Post-Processing: NMS and Clustering

Per patent US20190317219A1, after ML detection, Aurora uses classical post-processing:
- **Nearest neighbor and/or other clustering techniques** to determine portions of data that likely correspond to a single classification
- **Spatial region aggregation** where class probability exceeds threshold to form cohesive object subgroups
- Standard NMS variants for final bounding box selection

*Source: [US20190317219A1](https://patents.google.com/patent/US20190317219A1/en)*

---

### Monopulse Super-Resolution (Classical)

Patent US20190317219A1 describes a **monopulse FMCW LiDAR** enhancement using dual or triple receivers at different positions. Classical super-resolution techniques improve angular accuracy beyond beam width:
- **Frequency domain methods:** Fourier-based shift/aliasing properties
- **Spatial domain methods:** Maximum Likelihood, Maximum a Posteriori (MAP), Projection Onto Convex Sets (POCS), Bayesian treatments

These are all classical signal processing / computational imaging techniques, not ML-based.

*Source: [US20190317219A1](https://patents.google.com/patent/US20190317219A1/en)*

---

### Fault Detection (Non-ML)

Aurora's Fault Management System (FMS) uses a three-part architecture:

1. **Detection:** Each component "constantly reports diagnostic health checks to the other components." The FMS "actively monitors the health of the vehicle, including the self-driving software, sensors, and onboard computer"
2. **Diagnosis:** Evaluates fault severity and determines impact on safe driving capability
3. **Response:** Triggers mitigation strategies — reduced speed, hazard light activation, safe pullover

Demonstrated on public highways with fault injection testing, including simulated sensor and compute loss. A backup compute pathway handles complete primary system failure.

Sensor data consistency checking occurs implicitly through the Remainder Explainer, which flags sensor returns that cannot be explained by any known object — anomalous readings could indicate sensor degradation.

*Sources: [Fault Management](https://aurora.tech/newsroom/capability-spotlight-fault-management), [Fault Management Part 2](https://blog.aurora.tech/products/capability-spotlight-fault-management-part-2)*

---

### Sensor Fusion at the Data Level (Pre-ML)

The pre-ML temporal and spatial alignment of asynchronous sensors relies on:
- **TSN microsecond synchronization** for temporal alignment
- **Extrinsic calibration transforms** for spatial registration (SE(3) rigid-body)
- **Pose interpolation** using IMU data to align sensors firing at different times within a sweep
- **Coordinate transforms** between sensor frames

*Source: [ThinkAutonomous: Aurora Deep Learning Sensor Fusion](https://www.thinkautonomous.ai/blog/aurora-deep-learning-sensor-fusion-motion-prediction/)*

---

### Key Non-ML Specifications

| Parameter | Value | Source |
|---|---|---|
| FirstLight Range | >450m (current), >1000m (next-gen) | Aurora blog |
| Wavelength | ~1550 nm (eye-safe) | Blackmore, Aurora blog |
| Beam Divergence | <0.01 degrees | Blackmore/LIDAR Magazine |
| Velocity Resolution | +/-0.25 m/s across +/-100 m/s spread | Patent US20200400821A1 |
| Online Calibration Latency | <100 ms | Aurora blog |
| Online Calibration Error | <5% of injected noise | Aurora blog |
| TSN Sync Precision | Microsecond | Aurora blog |
| FMCW Patent Families | ~36 (109 worldwide patents) | GreyB analysis |
| Blackmore Patents | ~58% of Aurora portfolio | GreyB analysis |
| Silicon Photonics Production Target | 2027 | Aurora blog |

---

### What Remains Proprietary / Undisclosed

Aurora explicitly guards several critical implementation details:
- **Specific localization algorithm** (ICP variant, NDT, or hybrid) for Atlas matching
- **Specific data association algorithm** for multi-object tracking (Hungarian, JPDA, GNN)
- **Specific Kalman filter variant** beyond "EKF" (UKF? factor graph? iSAM2?)
- **Specific CFAR variant** used in LiDAR and radar detection
- **Specific windowing function** (Hanning, Hamming, Kaiser) used in FFT processing
- **Specific IMU-LiDAR tight coupling method** for localization
- **Camera ISP pipeline details** (debayering algorithm, tone mapping curve)
- **Occupancy grid implementation** (if used — not confirmed for production)
- **Radar beamforming architecture** and MIMO configuration
- **NMS variant** used in post-processing
