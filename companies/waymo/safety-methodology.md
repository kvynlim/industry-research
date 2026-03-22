# Waymo Safety Methodology: Deep Research

*Last updated: 2026-03-22*

---

## Table of Contents

1. [Published Safety Reports](#1-published-safety-reports)
2. [Three-Pillar Safety Framework](#2-three-pillar-safety-framework-driver-simulator-critic)
3. [Operational Safety Validation](#3-operational-safety-validation)
4. [Simulation Infrastructure](#4-simulation-infrastructure)
5. [Waymax Open-Source Simulator](#5-waymax-open-source-simulator)
6. [TUV SUD Audit](#6-tuv-sud-audit)
7. [NHTSA Engagement](#7-nhtsa-engagement)
8. [Published Crash Rate Data](#8-published-crash-rate-data)
9. [Edge Case Handling](#9-edge-case-handling)
10. [Remote Assistance Model](#10-remote-assistance-fleet-response)
11. [ML Safety and Robustness](#11-ml-safety-and-robustness)
12. [Safety Case Methodology](#12-safety-case-methodology)
13. [Published Safety Research Papers](#13-published-safety-research-papers)
14. [Sources](#14-sources)

---

## 1. Published Safety Reports

### Report History

Waymo has published formal safety reports across several years, evolving from a DOT-recommended voluntary disclosure into a comprehensive, data-driven safety hub.

**2017 Safety Report** ("On the Road to Fully Self-Driving")
- First public safety report from any AV developer, published October 12, 2017.
- 43 pages addressing the 12 safety elements outlined by the US DOT's "Voluntary Guidance" for AV developers (issued September 2016).
- Covered: system architecture overview, operational design domain, how the self-driving system works (sensor suite, software stack), testing and validation methods (simulation, closed-course, public road), safety processes, and minimal risk condition.
- Referenced 5 million miles of on-road self-driving and billions of miles of simulated driving at the time.
- PDF: `storage.googleapis.com/sdc-prod/v1/safety-report/waymo-safety-report-2017-10.pdf`

**2018 Safety Report** ("On the Road to Fully Self-Driving," updated)
- Expanded on the 2017 version with updated operational data.
- Addressed the same DOT framework but reflected the growth in autonomous miles and expanded ODD (Phoenix early rider program had launched in 2017).
- PDF: `assets.ctfassets.net/.../waymo-safety-report-2018.pdf`

**2020 Technical Paper** (arXiv: 2011.00054)
- "Waymo's Safety Methodologies and Safety Readiness Determinations" (Webb, Smith, Ludwick, et al., 2020).
- Shifted from a general-audience report to a detailed technical publication.
- Described the multi-layered safety approach: hazard analysis, scenario-based verification, safety requirements decomposition, simulation methodology, and the safety readiness determination process.
- Covered 6.1 million miles of automated driving in the Phoenix metropolitan area, including 65,000 miles of driverless operation from 2019 and early 2020.

**2021 Safety Report** (February 2021)
- Comprehensive update to the formal Safety Report series.
- Covered the maturation of fully driverless operations (Waymo One rider-only service in Phoenix/Chandler).
- PDF: `downloads.ctfassets.net/.../Waymo_Safety_Report_02-2021.pdf`

**2023 Safety Case Approach White Paper**
- "A Blueprint for AV Safety: Waymo's Toolkit For Building a Credible Safety Case."
- Shifted focus from descriptive reporting to formal safety argumentation methodology.
- Introduced the Case Credibility Assessment (CCA) framework.
- PDF: `assets.ctfassets.net/.../Waymo_Safety_Case_Approach.pdf`

**2024 Safety Data Hub** (September 2024)
- Transition from static PDF reports to a continuously updated interactive dashboard.
- URL: `waymo.com/safety/impact/`
- Provides downloadable CSV data for independent verification.
- Covered 22+ million rider-only miles through June 2024 at initial launch.
- Metrics: crash rates by severity, city-level comparisons, benchmark methodology.

**2025 Safety Data Hub Update** (December 2025)
- Updated with data through September 2025.
- Now covering 127 million fully autonomous miles (150+ human driving lifetimes).
- Added Austin as a fourth city with detailed metrics alongside Phoenix, San Francisco, and Los Angeles.

**Latest Data (through December 2025)**: 170.7 million rider-only miles total.

### Metrics Reported Across Versions

The metrics have evolved significantly:
- **Early reports (2017-2018)**: Qualitative descriptions of safety processes, disengagement data, miles driven.
- **2020 paper**: Formal hazard analysis framework, scenario-based testing methodology.
- **2023 onward**: Quantitative crash rate comparisons (IPMM -- incidents per million miles), per-city breakdowns, crash type decomposition, delta-V analysis, vulnerability road user metrics, confidence intervals, downloadable raw data.

---

## 2. Three-Pillar Safety Framework: Driver, Simulator, Critic

Announced in December 2025, the three-pillar framework represents Waymo's current articulation of their safety architecture. All three pillars are powered by the **Waymo Foundation Model**, a unified AI architecture, creating a continuous "virtuous cycle."

### Pillar 1: The Driver

The autonomous decision-making system that generates safe, comfortable, and compliant driving actions.

**Architecture ("Think Fast and Think Slow"):**
- **Sensor Fusion Encoder**: Processes camera, lidar, and radar data for rapid perception. Breaks the scene into dozens of individual objects (vehicles, pedestrians, traffic cones, road surfaces, etc.), producing objects, semantics, and rich embeddings.
- **Driving VLM (Vision-Language Model)**: Trained using Google's Gemini. Considers the scene holistically and leverages Gemini's extensive world knowledge for understanding rare, novel, and complex semantic scenarios. Example: a vehicle on fire ahead -- while the physical path may be clear, the VLM generates a semantic signal to reroute.
- **World Decoder**: Downstream component that predicts behaviors, generates maps, and produces trajectory signals from both inputs.

**Teacher-Student Architecture:**
- Large Teacher models are trained to generate safe, comfortable, and compliant action sequences.
- Capabilities are distilled into more efficient Student models for real-time onboard deployment.
- The model supports full end-to-end signal backpropagation during training while maintaining compact, materialized structured representations (objects, semantic attributes, roadgraph elements) for safety validation at inference time.

**Onboard Safety Validation Layer:**
- A separate and rigorous validation layer verifies trajectories produced by the generative ML model before execution.
- The structured intermediate representations enable powerful correctness and safety validation at inference time, which would not be possible with a pure end-to-end black-box approach.

### Pillar 2: The Simulator

A closed-loop testing environment for training and evaluation. Creates high-fidelity, multi-modal dynamic worlds using compact structured representations combined with generative sensor simulation.

Key capabilities:
- Tests across potential collisions, inclement weather, intricate intersections, and unusual behaviors.
- Supports counterfactual "what if" analysis.
- Enables reinforcement learning in an inner training loop.

### Pillar 3: The Critic

An evaluation system that stress-tests the Waymo Driver.

Key functions:
- Automatically flags any suboptimal driving behavior from Waymo's fully autonomous fleet experience.
- Generates improved alternative behaviors from flagged events to serve as training data.
- Proactively identifies subtle edge cases.
- Enables rapid, targeted improvements.

### The Virtuous Cycle

1. The **Critic** automatically flags suboptimal behavior from real-world driving data.
2. Improved alternative behaviors are generated and serve as training data for the **Driver**.
3. Improvements are rigorously tested in the **Simulator**, with the Critic verifying fixes.
4. Only once Waymo's safety framework confirms the absence of unreasonable risk is the enhanced Driver deployed to the real world.

**Two improvement loops:**
- **Inner loop**: Reinforcement learning within simulation.
- **Outer loop**: Real-world data feeds back through Critic evaluation, simulation testing, and safety verification before deployment.

---

## 3. Operational Safety Validation

### Safety Readiness Determination Process

Waymo's operational safety validation is structured around three complementary perspectives (formalized in their 2023 safety case paper, arXiv: 2306.01917):

**1. Layered Approach to Safety**
Risk assessment across three categories of hazards:
- **Architectural hazards**: Design-level deficiencies in system structure (hardware redundancy, fail-safe mechanisms).
- **Behavioral hazards**: Operational anomalies in decision-making or control (the ADS makes a wrong decision).
- **In-service operational hazards**: External conditions or operational issues affecting safety (maintenance failures, ODD violations, fleet operations errors).

**2. Dynamic Approach to Safety**
Ongoing (not one-time) assessments of risks and readiness:
- Triggered when entering a new city, adding a new vehicle platform, or making significant software changes.
- Each assessment is tailored to risks relevant to the intended operating mode.
- Regular software releases incorporate the continuous improvement flywheel.

**3. Credible Approach to Safety**
The Case Credibility Assessment (CCA):
- Rests on two pillars: credibility of arguments for safety, and credibility of evidence.
- Reinforced through implementation credibility checks.
- Distinguishes between simulation evidence, closed-course testing, and public road operation (different evidence types carry different weight).

### Multi-Level Testing Architecture

At the **system level**, three types of testing:
1. **Simulation**: Billions of virtual miles, scenario-based testing, reconstructed crashes.
2. **Closed-course testing**: 113-acre facility ("Castle") with 20,000+ staged scenarios.
3. **Public road testing**: Operational deployment with continuous monitoring.

At the **subsystem/component level**:
- Software unit tests and integration tests.
- Bench tests and hardware-in-the-loop tests.
- Sensor performance validation.

### Collision Avoidance Testing (CAT)

A scenario-based testing method evaluating the Waymo Driver's safety in conflict situations requiring urgent evasive maneuvers.

**Scenario sources:**
- Waymo's public road driving experience.
- Human crash data from police databases and dash cam recordings.
- Expert knowledge of operational design domains.
- NHTSA's 37 recommended pre-crash scenarios (based on ~6 million police-reported light vehicle crashes).

**The NIEON Reference Model:**
- Non-Impaired, Eyes ON the conflict -- represents an idealized, always-attentive human driver without distraction, impairment, or fatigue.
- Performance bar significantly exceeds actual average human drivers.
- Uses surprise-based response timing rather than fixed reaction times.

**CAT Results** (from 2008-2017 fatal crashes in Chandler, AZ, reconstructed in simulation):
- NIEON prevented 62.5% of crashes and reduced 84% of serious injury risk.
- Waymo Driver avoided 75% of collisions and reduced 93% of serious injury risk.
- Waymo consistently matched or exceeded the idealized NIEON benchmark.

### ODD Expansion and New City Validation

Process for entering new cities (Miami, Dallas, Houston, San Antonio, Orlando added 2025-2026):
1. Compare driving performance against a proven baseline.
2. Identify unique local characteristics (weather, traffic patterns, road geometry, local driving customs).
3. Refine the Waymo Driver's AI for local nuances (becoming fewer with each new city due to the generalizable foundation model).
4. Rigorous validation through real-world driving + advanced simulation.
5. Regular software releases implementing improvements.

### Standards Alignment

Waymo aligns with:
- **SAE J3016**: Automation taxonomy (Level 4 operations).
- **ISO 26262**: Functional safety principles for automotive E/E systems.
- **ISO/PAS 21448 (SOTIF)**: Safety of the intended functionality, addressing performance limitations and functional insufficiencies beyond hardware faults.
- **ISO 15026-2**: Systems and software assurance (confirmed via TUV SUD audit).
- **AVSC Best Practices**: Safety case assessment (AVSC D-04-2025) and remote assistance use-cases (AVSC-04-2023).

---

## 4. Simulation Infrastructure

### Scale

- **20+ billion miles** driven in simulation (as of publicly reported figures).
- Approximately **20 million miles per day** in simulation.
- One day in simulation equals driving more than 100 years in the real world.
- Built on Alphabet/Google's compute infrastructure (TPU/GPU clusters).

### SimulationCity (Announced July 2021)

Waymo's most advanced internal simulation platform.

**Core capability**: Automatically synthesizes entire journeys to assess Waymo Driver performance -- from 20-minute urban Waymo One trips across San Francisco to 11-hour cross-state deliveries.

**Data foundation:**
- 20+ million autonomous miles from Waymo's fleet.
- NHTSA Crash Data Systems.
- Naturalistic Driving Study Data.
- Third-party behavioral information.
- Alphabet's technical infrastructure.

**Two main approaches:**
1. **Replaying and tweaking real-world miles**: Pick the most interesting encounters from real driving to maximize learning efficiency. Modify positions, speeds, and behaviors to create targeted variations.
2. **Building completely synthetic scenarios**: Scenarios never encountered in real life, designed to understand how the Waymo Driver would perform.

**Environmental fidelity:**
- Recreates specific conditions with high precision: raindrops on sensors, dimming light, solar glare, etc.
- Rather than testing single outcomes, generates multiple variations to understand how the Waymo Driver reacts to the full distribution of possible behaviors (including rare edge cases like inattentive drivers failing to brake).
- Simulated environments are constantly refreshed with experiences collected daily from the fleet.

**Key applications:**
- New vehicle platform testing (safely evaluate new hardware generations).
- Operational optimization (trip duration, energy consumption, service efficiency).
- User experience simulation (pickup/dropoff scenarios, rider satisfaction prediction).
- Geographic expansion (test in unmapped locations by combining historical data with third-party information).

### SurfelGAN Sensor Simulation

Waymo's approach to realistic sensor data generation for simulation.

**How it works:**
- Uses texture-mapped surface elements (surfels) to reconstruct scenes from vehicle passes.
- Preserves information about object 3D geometry, semantics, and appearance.
- A SurfelGAN neural network reconstructs realistic camera images for novel positions and orientations of the self-driving vehicle and moving objects.
- Can render simulated scenes from various distances and viewing angles.

**Advantages over traditional approaches:**
- Traditional simulators (Unreal Engine, Unity) require manual environment creation, have limited scalability, and struggle to produce realistic sensor approximations.
- SurfelGAN uses real-world data directly, enabling scalable and photorealistic sensor simulation.

### Waymo World Model (Announced February 2026)

A frontier generative model representing the latest evolution of Waymo's simulation technology.

**Foundation:**
- Built on **Genie 3** (Google DeepMind's most advanced general-purpose world model).
- Generates photorealistic and interactive 3D environments.
- Through specialized post-training, transfers Genie 3's vast world knowledge from 2D video into 3D lidar outputs tailored to Waymo's sensor hardware suite.

**Multi-sensor generation:**
- Simultaneously generates high-fidelity camera and lidar data.
- Cameras provide visual detail; lidar provides complementary depth signals.

**Three controllability pathways:**
1. **Driving Action Control**: "What if" counterfactual simulations testing alternative driving decisions.
2. **Scene Layout Control**: Customize road layouts, traffic signals, and other road user behavior through selective placement.
3. **Language Control**: Adjust conditions like time-of-day, weather, or generate entirely synthetic scenarios through natural language prompts.

**Edge case generation:**
- Leverages broad world knowledge to simulate rare events that are almost impossible to capture at scale in reality (e.g., a tornado, an encounter with an elephant on the road).
- Proactively prepares the Waymo Driver for long-tail challenges before real-world encounters.

**Efficiency:**
- An efficient variant enables longer scenes with dramatic reduction in compute while maintaining high realism.

---

## 5. Waymax Open-Source Simulator

### Overview

Waymax is Waymo's open-source, lightweight, multi-agent, JAX-based simulator for autonomous driving research. Released October 2023.

- **Paper**: "Waymax: An Accelerated, Data-Driven Simulator for Large-Scale Autonomous Driving Research" (arXiv: 2310.08710).
- **Repository**: `github.com/waymo-research/waymax`
- **License**: Waymax License Agreement for Non-Commercial Use.

### Architecture

Written entirely in JAX with in-graph compilation for hardware-accelerated simulation on GPUs and TPUs.

**Core modules:**
- `waymax.dataloader`: Utilities for loading data from the Waymo Open Motion Dataset (WOMD).
- `waymax.metrics`: Commonly used metrics for evaluating simulated rollouts.
- `waymax.agents`: Intelligent simulated agents for realistic simulation.
- `waymax.env`: Stateless, closed-loop simulator interface with adapters to dm-env and brax RL interfaces.

### Data Foundation

Uses scenarios from the Waymo Open Motion Dataset (WOMD):
- 250+ hours of real driving data from dense urban environments.
- 100,000+ trajectory snippets.
- 7.64 million unique objects to interact with or control.
- Each trajectory snippet: 9 seconds recorded at 10 Hz.

### Technical Details

**Object representation**: Bounding boxes rather than raw sensor outputs, distilling behavior research into its simplest form.

**Vehicle dynamics**: Two models supported:
1. Direct state-based control.
2. Kinematic bicycle model.
- Default simulation at 10 Hz (matching WOMD), adjustable.

**Simulation modes for uncontrolled objects:**
1. **Log playback**: Replays behavior as recorded in the dataset.
2. **IDM-based route-following**: Vehicles follow logged paths but adjust speed profiles using the Intelligent Driver Model (IDM).

### Performance

- Hardware-accelerated Waymax is **2-3 orders of magnitude faster** than CPU-based simulators (nuPlan, MetaDrive, Nocturne).
- Supports combining training and simulation within the same computation graph ("in-graph" training), eliminating CPU-GPU communication bottlenecks.
- Easily distributed and deployed on hardware accelerators.

### Research Applications

Designed for:
- Closed-loop simulation for planning.
- Sim agent research.
- Open-loop behavior prediction.
- Imitation learning and reinforcement learning algorithm development.
- Waymo Open Sim Agents Challenge (WOSAC) submissions.

---

## 6. TUV SUD Audit

### Overview

Waymo is the first autonomous driving company to complete independent, third-party audits of both its remote assistance program and its safety case program. Audits were conducted by **TUV SUD**, the global leader in safety testing and certification, over several months. Results announced November 2025.

### Safety Case Program Audit

**What was audited:**
- Policy documentation from claim creation and evidence identification to operationalization and management of the entire safety case process.
- Interviews with Waymo team members.

**Standards used:**
- **AVSC Best Practice for Safety Case Assessment** (AVSC D-04-2025).
- **ISO 15026-2**: International Standard for Systems and Software Assurance.

**Finding:** Confirmed that Waymo's safety case program adheres to all guidance in the AVSC best practice and satisfies the requirements of ISO 15026-2.

### Remote Assistance (Fleet Response) Program Audit

**What was audited:**
- Comprehensive review of training and implementation practices.
- Multiple-day site visit to observe operations firsthand.

**Standard used:**
- **AVSC industry best practice on Remote Assistance Use-Cases** (AVSC-04-2023).

**Finding:** Confirmed adherence of Waymo's policies and practices to the AVSC best practice.

### First Responder Program Audit

Waymo's First Responder Program was also independently reviewed by TUV SUD (announced December 2024).
- First in the industry to receive third-party validation according to industry best practices.

### Caveats

Some independent analysts have noted that the AVSC documents used as audit benchmarks are industry best practices, not formal safety standards. The audits confirm process compliance, not safety outcomes per se. TUV SUD audited the *process* by which Waymo develops its safety case, not the safety case conclusions themselves.

---

## 7. NHTSA Engagement

### Voluntary Safety Self-Assessment (VSSA)

- Waymo was the **first company** to publish a VSSA (October 12, 2017), responding to NHTSA's voluntary guidance framework.
- NHTSA recognized Waymo alongside Ford, GM, Nuro, Nvidia, Uber, Apple, Bosch, Mercedes-Benz, and others for publicly releasing VSSAs.

### Standing General Order (SGO) Compliance

- NHTSA's SGO (first issued 2021, amended in 2021, 2023, and 2025) requires ADS operators to report qualifying crashes.
- Waymo reports all crashes meeting SGO thresholds.
- Waymo's Safety Data Hub uses SGO-reported crash data as its primary Waymo crash data source, enabling independent verification.

### NHTSA Investigations

**PE24016 (May 2024):**
- Preliminary Evaluation opened May 13, 2024.
- Triggered by 22 initial reports of unexpected driving behavior (identified through SGO and public sources).
- Included cases where a Waymo vehicle was the only vehicle involved in a collision or exhibited behavior potentially violating traffic safety laws.
- ODI ultimately identified 367 total incidents, of which 109 were crashes (102 reported by Waymo under SGO).
- NHTSA closed this investigation after review.

**PE25013 (School Bus Incidents, October 2025):**
- Opened after media reports of Waymo vehicles illegally passing stopped school buses.
- Austin ISD documented 19 instances of Waymo vehicles passing school buses.
- NHTSA set a January 20, 2026 deadline for Waymo to respond.
- Waymo identified the software issue and filed a **voluntary software recall** in December 2025.
- No injuries occurred in any of the incidents.

**Santa Monica Pedestrian Incident (January 2026):**
- Waymo voluntarily contacted NHTSA on the same day as the January 23, 2026 incident.
- NHTSA indicated intent to open an investigation; Waymo committed to full cooperation.
- Waymo's system had reduced speed from 17 mph to under 6 mph before contact.
- Company called 911 and kept the vehicle stationary at the scene.

### Transparency Practices

- Proactive reporting to NHTSA (same-day notification for the Santa Monica incident).
- Public disclosure of crash data through the Safety Data Hub with downloadable CSVs.
- Voluntary recall filings (school bus software issue).
- Commitment to publishing peer-reviewed safety research.

---

## 8. Published Crash Rate Data

### The 92% Figure: Methodology

The headline "92% fewer serious crashes" comes from Waymo's Safety Impact Data Hub analysis (through December 2025, covering 170.7 million rider-only miles).

**How the comparison works:**

**Waymo crash data source:** NHTSA Standing General Order (SGO) submissions. All crashes meeting SGO reporting thresholds are included.

**Human benchmark construction:**
- State police crash records + vehicle miles traveled (VMT) data.
- Filtered to passenger vehicles on non-freeway (surface street) roadways in counties where Waymo operates.
- Adjusted for underreporting (32% underreporting rate for any-injury-reported outcomes, based on NHTSA Blincoe et al., 2023).
- Dynamically reweighted geographically to account for Waymo's unique driving distribution patterns.
- Human crash data expressed as vehicle-level rates (crashed vehicles per VMT) for valid apples-to-apples comparison.

**Statistical methods:**
- Poisson Exact confidence intervals for IPMM rates.
- Clopper-Pearson binomial confidence intervals for percent reductions.
- Both at 95% confidence levels. Results are reported as statistically significant only when error bars do not cross zero.

### Key Crash Rate Data (Through December 2025)

| Metric | Waymo IPMM | Benchmark IPMM | Reduction |
|--------|-----------|----------------|-----------|
| Serious injury or worse (all locations) | 0.02 | 0.22 | **-92%** (35 fewer incidents) |
| Any injury reported (all locations) | 0.71 | 3.90 | **-82%** (544 fewer incidents) |
| Airbag deployment, any vehicle (all locations) | 0.28 | 1.63 | **-83%** (230 fewer incidents) |
| Airbag deployment, Waymo vehicle only | 0.05 | 1.12 | **-96%** |

### By City (Serious Injury or Worse)

| City | Waymo IPMM | Benchmark IPMM | Reduction |
|------|-----------|----------------|-----------|
| Phoenix | 0.01 | 0.10 | -86% |
| San Francisco | 0.04 | 0.43 | -91% |
| Los Angeles | 0.00 | 0.15 | -100% |
| Austin | 0.00 | 0.18 | -100% |

### By Crash Type (Any Injury Reported)

| Crash Type | Benchmark Events | Waymo Events | Reduction |
|------------|-----------------|--------------|-----------|
| V2V Intersection | 262 | 10 | -96% |
| V2V Lateral | 44 | 10 | -78% |
| V2V Front-to-Rear | 102 | 57 | -44% |
| Single Vehicle | 46 | 2 | -96% |
| Pedestrian | 66 | 5 | -92% |
| Motorcycle | 31 | 6 | -81% |
| Cyclist | 46 | 7 | -85% |

### Vulnerable Road User Protection

- 92% fewer pedestrian crashes with injuries (62 fewer).
- 85% fewer cyclist crashes with injuries (39 fewer).
- 81% fewer motorcycle crashes with injuries (25 fewer).

### Delta-V Analysis

43% of Waymo's SGO-reported collisions had delta-V (change in velocity) of less than 1 mph, indicating many reported incidents are extremely low-severity contacts (dents, scratches).

### Swiss Re Insurance Claims Study (December 2024)

Independent validation using a completely different data source: private passenger vehicle liability insurance claims.

**Methodology:**
- Human baseline: Swiss Re's dataset of 500,000+ claims spanning 200+ billion miles of driving exposure.
- Waymo data: 25.3 million fully autonomous miles, liability claims analysis.

**Results:**
- 9 property damage claims (vs. 78 expected for human drivers) = **88% reduction**.
- 2 bodily injury claims (vs. 26 expected) = **92% reduction**.
- Against newest vehicles only (2018-2021 models with ADAS): 86% PDL reduction, 90% BIL reduction.

### Peer-Reviewed Insurance Claims Study (PMC11305169, 2024)

**Methodology:**
- 600,000+ human insurance claims, 125+ billion miles, 25+ million policy years (2016-2021).
- Waymo: 53.1 million miles across all modes (Jan 2018 - Aug 2023).
- Zip code and mileage calibration for regional matching.

**Key results by operating mode:**
| Mode | Miles | BIL Reduction | PDL Reduction |
|------|-------|--------------|---------------|
| Manual driving | 14.4M | 45% | 34% |
| Testing Ops (safety driver) | 35.2M | 92% | 95% |
| Rider-Only (driverless) | 3.9M | 100% (zero BIL claims) | 76% |
| Combined TO+RO | 39.1M | 93% | 93% |

### Research Partnerships for Data Validation

- Insurance Institute for Highway Safety (IIHS).
- University of Michigan Transportation Research Institute (UMTRI).
- Virginia Tech Transportation Institute (VTTI).
- Swiss Re.

---

## 9. Edge Case Handling

### Multi-Pronged Approach

Waymo addresses edge cases through several complementary mechanisms:

**1. The Critic System**
- Automatically mines Waymo's vast fully autonomous driving data for suboptimal behavior.
- Flags edge cases proactively, even when no incident occurred.
- Generates improved alternative behaviors as training data.

**2. Simulation-Based Edge Case Generation**
- The Waymo World Model can simulate events that are "almost impossible to capture at scale in reality" (tornadoes, animal encounters, etc.).
- Language-controlled scenario generation allows engineers to describe arbitrary edge cases in natural language.
- Scene layout control enables selective placement of unusual configurations.
- Counterfactual "what if" testing explores alternative outcomes.

**3. WOD-E2E Dataset for Long-Tail Evaluation**
- Waymo Open Dataset for End-to-End Driving (WOD-E2E): 4,021 driving segments (~12 hours).
- Specifically curated for challenging long-tail scenarios with occurrence frequency less than 0.03%.
- Introduces the **Rater Feedback Score (RFS)** metric: measures how closely predicted trajectories match human rater-annotated trajectory preference labels (vs. conventional ADE metrics, which are insufficient for multi-modal long-tail scenarios).

**4. Collision Avoidance Testing Library**
- Scenario library developed since 2016.
- Sources: real-world driving, police crash databases, dash cam recordings, expert knowledge.
- 20,000+ scenarios at the Castle closed-course facility, each fed into simulation for hundreds of variations.
- New geographies expand the library (e.g., San Francisco and Phoenix added novel pedestrian interaction patterns).

**5. SimulationCity Distribution Testing**
- Rather than testing single edge case outcomes, generates multiple variations to understand the Waymo Driver's response to the full distribution of possible behaviors.
- Includes rare cases like inattentive drivers failing to brake.

**6. Driving VLM for Semantic Understanding**
- Gemini-powered VLM handles rare, novel, and complex semantic scenarios that a traditional perception stack might not flag.
- Example: vehicle on fire ahead -- physically drivable but semantically dangerous.

### Acceptance Criteria Framework

Waymo uses a balance between:
- **Event-level acceptance criteria**: Sample risk from individual instances of occurrence, supporting event-level risk assessment.
- **Aggregate-level acceptance criteria**: Overarching indicators of performance across the fleet.

---

## 10. Remote Assistance (Fleet Response)

### Architecture

Fleet Response is Waymo's remote assistance system, functioning as a "phone-a-friend" mechanism for the autonomous vehicle.

**Key design principle**: The Waymo Driver is in control of the vehicle at all times. Fleet Response provides *contextual information*, not remote driving commands. Operators cannot override vehicle decisions.

### How It Works

1. The Waymo Driver encounters an ambiguous situation (e.g., atypical cone configuration at a construction site, unclear lane closure).
2. The vehicle contacts a Fleet Response agent for additional context.
3. The primary interaction uses a **question-and-answer format** (e.g., "Is this lane closed?").
4. The agent accesses:
   - Real-time feeds from the vehicle's exterior cameras.
   - A 3D graphical representation of what the car perceives.
   - Ability to rewind feeds for scene analysis.
5. The ADS evaluates the response: if it matches the ADS's understanding and falls within safety parameters, the ADS accepts it. If there's a mismatch, the ADS can request clarification or refuse the guidance and remain in a safe state.

### Operator Capabilities

Fleet Response agents can influence driving paths through three methods:
1. Indicating lane changes.
2. Explicitly requesting specific lane usage.
3. Proposing alternative routes.

**They cannot**: Directly steer, accelerate, or brake the vehicle. They cannot override the vehicle's safety decisions.

### Safety Layer

- As the vehicle waits for input, it continues using all available sensor information to inform decisions.
- If the environment changes (e.g., the obstacle clears), the vehicle can resolve the situation autonomously.
- The vehicle may come to a stop regardless of operator input if it determines that is the safest course of action.
- If stopped and unable to proceed, the vehicle can request **Waymo Roadside Assistance** for manual retrieval.
- The vast majority of situations are resolved without human assistance.

### Operations

- Fleet Response operates with approximately 35 operators (some based in the Philippines, as reported in 2025).
- TUV SUD audited the program, including a multi-day site visit (November 2025).
- Confirmed adherence to AVSC industry best practice on Remote Assistance Use-Cases (AVSC-04-2023).

---

## 11. ML Safety and Robustness

### Foundation Model Safety Properties

**Structured intermediate representations:**
- Unlike pure end-to-end systems, Waymo's foundation model materializes structured outputs (objects, semantic attributes, roadgraph elements) between perception and planning.
- These structured representations enable explicit safety validation at inference time.
- The onboard validation layer can verify that proposed trajectories satisfy safety constraints before execution.

**Dual-path perception:**
- The sensor fusion encoder provides fast, data-driven reactions.
- The Driving VLM provides semantic reasoning about rare/novel scenarios.
- This redundancy adds robustness: if one path fails to flag a hazard, the other may catch it.

### EMMA Research (End-to-End Multimodal Model for Autonomous Driving)

Published October 2024 as a research exploration.

- Built on Google's Gemini multimodal LLM.
- Processes raw camera inputs + textual data in a unified framework.
- Represents non-sensor inputs and outputs as natural language text.
- Uses chain-of-thought reasoning (6.7% improvement in planning performance).
- Achieves state-of-the-art on multiple tasks (motion planning, 3D object detection, road graph estimation, scene understanding).
- **Limitations acknowledged**: Cannot process long video sequences, doesn't use LiDAR/radar, needs inference time optimization, requires verification of intermediate decisions.
- **Status**: Research-focused, not in production deployment.

### Published Research on Safety-Related ML Topics

**Collision Avoidance:**
- "Collision avoidance testing of the Waymo automated driving system" (Kusano et al., 2022).
- "Collision avoidance effectiveness of an automated driving system using a human driver behavior reference model in reconstructed fatal collisions" (Scanlon et al., 2022).
- "Waymo simulated driving behavior in reconstructed fatal crashes within an autonomous vehicle operating domain" (Scanlon et al., 2021).

**Behavior Modeling and Safety:**
- "Active inference as a unified model of collision avoidance behavior in human drivers" (Schumann et al., 2025).
- "Active inference-based modeling of human driver collision avoidance behavior" (Schumann et al., 2024).
- "Looking for an out: Affordances, uncertainty and collision avoidance behavior of human drivers" (Johnson et al., 2025).

**Long-Tail and Rare Events:**
- WOD-E2E dataset for long-tail scenarios.
- "Improving the Intra-class Long-tail in 3D Detection via Rare Example Mining" (Waymo Research).
- Waymo World Model for generating impossible/rare scenarios via generative AI.

**Fatigue and Human Factors (during testing phase):**
- "Waymo's fatigue risk management framework: prevention, monitoring, and mitigation of fatigue-induced risks while testing automated driving systems" (Favaro et al., 2022).

**Note:** Waymo has not published papers specifically on adversarial ML attacks or adversarial robustness testing of their perception/planning systems. Their published ML safety work focuses on behavior-level safety validation, collision avoidance performance, and human-driver comparison methodologies rather than adversarial input perturbations.

---

## 12. Safety Case Methodology

### Framework Structure

Waymo's safety case is a structured argument demonstrating that the ADS operates without unreasonable risk. Published in detail through:
- "Building a Credible Case for Safety: Waymo's Approach for the Determination of Absence of Unreasonable Risk" (Favaro et al., 2023, arXiv: 2306.01917).
- Waymo Safety Case Approach White Paper (2023).
- "Determining Absence of Unreasonable Risk: Approval Guidelines for an Automated Driving System Deployment" (Favaro et al., 2025).
- "Assessing a Safety Case: Bottom-up Guidance for Claims and Evidence Evaluation" (Schnelle et al., 2025).

### Claim-Evidence Structure

Top-level claim: the ADS is safe (i.e., free from unreasonable risk).

Decomposed into subclaims:
- **System Design Safety**: Architecture incorporates redundancy and fail-safe mechanisms.
- **Operational Safety**: Real-world performance data demonstrates safe behavior.
- **Hazard Mitigation**: Identified risks receive appropriate controls.

Claims connect to evidence through explicit argumentation.

### Case Credibility Assessment (CCA)

A systematic framework for evaluating the credibility of safety arguments:

1. **Evidence Quality**: Distinguishing between simulation, closed-course testing, and public road operation evidence.
2. **Completeness**: Identifying gaps where claims lack sufficient support.
3. **Independence**: Whether evidence originates from internal or external sources.
4. **Relevance**: Ensuring evidence directly supports stated claims.

Two main pillars:
- Credibility of arguments for safety.
- Credibility of evidence supporting those arguments.
- Reinforced through implementation credibility checks.

### Acceptance Criteria

Quantitative and qualitative thresholds:
- Performance benchmarks relative to human driver baselines.
- Specific scenario performance requirements.
- Reliability metrics for critical functions.
- Balance between event-level and aggregate-level criteria.

### Unreasonable Risk Standard

Safety is established by demonstrating that residual risks fall below levels society accepts for comparable transportation. Absolute elimination of all risk is acknowledged as impossible.

### Industry Contribution

The methodology is described as "methodology-agnostic, so that anyone in the space could employ portions or all of it." Waymo has published this framework specifically to advance industry-wide safety practices, not just internal use.

### Related Research Categories

Waymo's 50+ published safety papers span seven domains:
1. Behavior Reference Models.
2. Holistic Publications and Best Practices.
3. Injury Risk Estimation.
4. Peer-reviewed Research.
5. Prospective Safety Impact.
6. Retrospective Safety Impact.
7. Vision Zero initiatives.

---

## 13. Published Safety Research Papers

### Complete List (50 papers as of March 2026)

**2025-2026** (14 papers):
1. Being good (at driving): Characterizing behavioral expectations on automated and human driven vehicles -- Fraade-Blanar et al. (2026)
2. Building a credible case for safety (updated) -- Favaro et al. (2026)
3. A mechanistic approach to modeling omnidirectional motorcyclist injury risk -- Schubert et al. (2025)
4. Ride-hailing in the Safe System: Increased Seat Belt Compliance and Late Model Year Vehicles -- Campolettano et al. (2025)
5. From Stoplights to On-Ramps: Crash Rate Benchmarks for Freeway and Surface Street ADS Evaluation -- Scanlon et al. (2025)
6. Automated Brake Onset Detection in Naturalistic Driving Data -- Liu et al. (2025)
7. Potential Safety Benefits Associated with Speed Limit Compliance -- Campolettano et al. (2025)
8. TARGET setting for high severity collisions -- Campolettano et al. (2025)
9. Assessing a Safety Case: Bottom-up Guidance for Claims and Evidence Evaluation -- Schnelle et al. (2025)
10. Active inference as a unified model of collision avoidance behavior -- Schumann et al. (2025)
11. Looking for an out: Affordances, uncertainty and collision avoidance behavior -- Johnson et al. (2025)
12. Determining Absence of Unreasonable Risk -- Favaro et al. (2025)
13. Comparison of Waymo Rider-Only Crash Rates by Crash Type at 56.7M Miles -- Kusano et al. (2025)
14. Dynamic Benchmarks: Spatial and Temporal Alignment for ADS Performance Evaluation -- Chen et al. (2025)
15. Developing a Safety Management System for the Automated Vehicle Industry -- Wichner et al. (2025)

**2024** (14 papers):
16. Do Autonomous Vehicles Outperform Latest-Generation Human-Driven Vehicles? (Swiss Re study) -- Di Lillo et al. (2024)
17. Baseline vulnerable road user injury risk -- Campolettano et al. (2024)
18. Kinematic characterization of micro-mobility vehicles during evasive maneuvers -- Terranova et al. (2024)
19. Characterising vulnerable road user evasive manoeuvring in real-world crashes -- Campolettano et al. (2024)
20. Active inference-based modeling of human driver collision avoidance behavior -- Schumann et al. (2024)
21. Active inference as a general framework for modeling human driving behavior -- Engstrom et al. (2024)
22. Representative cyclist collision injury risk distributions -- Campolettano et al. (2024)
23. Comparative safety performance of autonomous and human drivers (insurance study) -- Di Lillo et al. (2024)
24. Resolving uncertainty on the fly: adaptive driving behavior as active inference -- Engstrom et al. (2024)
25. Modeling road user response timing in naturalistic traffic conflicts -- Engstrom et al. (2024)
26. Comparison of Waymo rider-only crash data at 7.1M miles -- Kusano et al. (2024)
27. Benchmarks for retrospective ADS crash rate analysis -- Scanlon et al. (2024)
28. RAVE checklist for retrospective ADS studies -- Scanlon et al. (2024)
29. Bridging the gap: Mechanistic cyclist injury risk curves -- Schubert et al. (2024)

**2023** (13 papers):
30-41. Covering: pedestrian collision injury risk, cyclist dooring analysis, measuring surprise in naturalistic driving, interpreting safety outcomes, conflict typology for ADS evaluation, ADS standardization landscape, safety performance at one million miles, world model learning, active inference car following, intersection collision functional scenarios, plus others.

**2022** (4 papers):
42. Fatigue risk management framework -- Favaro et al.
43. Methodology for maximum injury potential determination -- Kusano & Victor.
44. Collision avoidance testing of the Waymo ADS -- Kusano et al.
45. Collision avoidance effectiveness using human driver behavior reference model -- Scanlon et al.

**2021** (3 papers):
46. Omni-directional injury risk model -- McMurry et al.
47. Waymo simulated driving behavior in reconstructed fatal crashes -- Scanlon et al.
48. Waymo Safety Report -- The Waymo Team.

**2020** (2 papers):
49. Waymo public road safety performance data -- Schwall et al.
50. Waymo's safety methodologies and safety readiness determinations -- Webb et al.

---

## 14. Sources

### Waymo Official
- [Waymo Safety Impact Data Hub](https://waymo.com/safety/impact/)
- [Waymo Safety Research Papers](https://waymo.com/safety/research/)
- [Waymo Safety Page](https://waymo.com/safety/)
- [Demonstrably Safe AI For Autonomous Driving (Three-Pillar Framework)](https://waymo.com/blog/2025/12/demonstrably-safe-ai-for-autonomous-driving/)
- [The Waymo World Model](https://waymo.com/blog/2026/02/the-waymo-world-model-a-new-frontier-for-autonomous-driving-simulation/)
- [SimulationCity](https://waymo.com/blog/2021/07/simulation-city/)
- [Safety Data Hub Launch](https://waymo.com/blog/2024/09/safety-data-hub/)
- [Fleet Response](https://waymo.com/blog/2024/05/fleet-response/)
- [Independent Audits (TUV SUD)](https://waymo.com/blog/2025/11/independent-audits/)
- [First Responder Program Audit](https://waymo.com/blog/2024/12/waymos-first-responder-program-receives-independent-safety-confirmation/)
- [Swiss Re Study](https://waymo.com/blog/2024/12/new-swiss-re-study-waymo/)
- [Collision Avoidance Testing / NIEON](https://waymo.com/blog/2022/12/waymos-collision-avoidance-testing)
- [Benchmarking AV Safety](https://waymo.com/blog/2022/09/benchmarking-av-safety)
- [Safety Framework for Fully Autonomous Operations](https://waymo.com/blog/2020/10/sharing-our-safety-framework)
- [Introducing EMMA](https://waymo.com/blog/2024/10/introducing-emma/)
- [Safe, Routine, Ready: Five New Cities](https://waymo.com/blog/2025/11/safe-routine-ready-autonomous-driving-in-new-cities/)
- [Commitment to Transparency (Santa Monica)](https://waymo.com/blog/2026/01/a-commitment-to-transparency-and-road-safety/)
- [Waymax Research Page](https://waymo.com/research/waymax/)
- [Waymax Blog Post](https://waymo.com/blog/2023/10/waymo-advances-ai-research-with-our-multifunctional-waymax-simulator)
- [SurfelGAN Research](https://waymo.com/research/surfelgan-synthesizing-realistic-sensor-data-for-autonomous-driving/)

### Academic / arXiv
- [Waymo's Safety Methodologies (arXiv: 2011.00054)](https://arxiv.org/pdf/2011.00054)
- [Building a Credible Case for Safety (arXiv: 2306.01917)](https://arxiv.org/abs/2306.01917)
- [Waymax Paper (arXiv: 2310.08710)](https://arxiv.org/pdf/2310.08710)
- [Collision Avoidance Testing (arXiv: 2212.08148)](https://arxiv.org/abs/2212.08148)
- [WOD-E2E Long-Tail Dataset (arXiv: 2510.26125)](https://arxiv.org/abs/2510.26125)
- [Comparative Safety (PMC11305169)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11305169/)
- [Crash Data at 7.1M Miles (PubMed)](https://pubmed.ncbi.nlm.nih.gov/39485678/)
- [Crash Rates at 56.7M Miles](https://www.tandfonline.com/doi/full/10.1080/15389588.2025.2499887)

### Waymo White Papers / PDFs
- [Safety Case Approach White Paper](https://assets.ctfassets.net/e6t5diu0txbw/66jOjPtNIjzawaK0ZjpU3q/7f081b392cf29a3355c97d0d758fe6cf/Waymo_Safety_Case_Approach.pdf)
- [2017 Safety Report](https://storage.googleapis.com/sdc-prod/v1/safety-report/waymo-safety-report-2017-10.pdf)
- [2018 Safety Report](https://assets.ctfassets.net/sv23gofxcuiz/1xAGjnH0kTxD2Vmvqsv3eS/7da216660cbd9ee7b35eefcac1b28a2f/waymo-safety-report-2018.pdf)
- [Safety Impact Data Hub Release Notes (Dec 2025)](https://storage.googleapis.com/waymo-uploads/files/documents/safety/safety-impact-data/Waymo_Safety_Impact_Data_Hub_Release_Notes_20251216.pdf)

### GitHub
- [Waymax Repository](https://github.com/waymo-research/waymax)

### NHTSA
- [NHTSA Voluntary Safety Self-Assessment](https://www.nhtsa.gov/automated-driving-systems/voluntary-safety-self-assessment)
- [NHTSA Standing General Order on Crash Reporting](https://www.nhtsa.gov/laws-regulations/standing-general-order-crash-reporting)
- [NHTSA Investigation PE24016](https://static.nhtsa.gov/odi/inv/2024/INOA-PE24016-12382.pdf)
- [NHTSA Investigation PE25013](https://static.nhtsa.gov/odi/inv/2025/INOA-PE25013-23069.pdf)

### Media / Third-Party Analysis
- [CleanTechnica: Safety Hub Update at 127M Miles](https://cleantechnica.com/2025/12/16/waymo-safety-hub-update-features-data-from-127-million-fully-autonomous-miles/)
- [CleanTechnica: Demonstrably Safe AI](https://cleantechnica.com/2025/12/09/demonstrably-safe-ai-for-autonomous-driving/)
- [NPR: Waymo School Bus Recall](https://www.npr.org/2025/12/06/nx-s1-5635614/waymo-school-buses-recall)
- [TechCrunch: School Bus Software Recall](https://techcrunch.com/2025/12/05/waymo-to-issue-software-recall-over-how-robotaxis-behave-around-school-buses/)
- [Behind Waymo's 'Independently Audited' Teleoperation](https://junkoyoshidaparis.substack.com/p/behind-waymos-independently-audited)
- [Waymo Remote Assistance Analysis](https://thelastdriverlicenseholder.com/2026/02/09/are-waymos-remote-controlled-or-not-the-answer-is-no/)
