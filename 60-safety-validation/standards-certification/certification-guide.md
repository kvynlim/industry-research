# Production Safety Certification for Autonomous Vehicles

## Practical Guide to Certification Standards, Safety Cases, and Regulatory Approval

This document covers the end-to-end certification landscape for deploying autonomous vehicles in production, with emphasis on airport airside operations. It addresses the standards, safety case methodologies, regulatory processes, and real-world examples relevant to getting an AV from prototype to certified production system.

---

## Table of Contents

1. [ISO 3691-4:2020/2023 -- Driverless Industrial Trucks](#1-iso-3691-42020-2023----driverless-industrial-trucks)
2. [UL 4600 Safety Case](#2-ul-4600-safety-case)
3. [AMLAS Methodology in Practice](#3-amlas-methodology-in-practice)
4. [ISO 26262 for Autonomous Vehicles](#4-iso-26262-for-autonomous-vehicles)
5. [ISO/PAS 8800 -- AI Safety Lifecycle](#5-isopas-8800----ai-safety-lifecycle)
6. [SOTIF (ISO 21448)](#6-sotif-iso-21448)
7. [CE Marking for Autonomous Vehicles](#7-ce-marking-for-autonomous-vehicles)
8. [FAA Approval Process for Airside Operations](#8-faa-approval-process-for-airside-operations)
9. [Safety Case Structure (GSN)](#9-safety-case-structure-gsn)
10. [Testing Requirements](#10-testing-requirements)
11. [Third-Party Assessment](#11-third-party-assessment)
12. [Real Examples](#12-real-examples)

---

## 1. ISO 3691-4:2020/2023 -- Driverless Industrial Trucks

### What It Is

ISO 3691-4 is the primary international safety standard for driverless industrial trucks, including automated guided vehicles (AGVs), autonomous mobile robots (AMRs), and automated guided carts (AGCs). The 2020 edition established the framework; the 2023 revision (ISO 3691-4:2023) expanded it to 82 pages across six major sections. This is the standard that TractEasy and similar airport ground vehicles certify against for European deployment.

### Scope and Applicability

The standard applies to driverless industrial trucks with:
- Automatic modes requiring operator action to initiate
- Capability to transport riders
- Additional manual modes for setup or maintenance
- Maintenance modes allowing manual operation

It does **not** apply to:
- Trucks solely guided by mechanical means (rails, guides)
- Remotely controlled trucks (no autonomous capability)
- Vehicles for public roads, military use, explosive environments
- Noise, vibration, or radiation hazards (covered elsewhere)

### What It Requires

**Safety Functions and Performance Levels:**

The standard defines Performance Level (PL) requirements based on ISO 13849-1:
- **Braking system**: PLd required (high reliability)
- **Parking brake**: PLb required
- **Personnel detection**: PLd for collision avoidance in personnel detection zones
- **Emergency stop (E-Stop)**: Specific placement and accessibility requirements
- **Speed limiting**: Performance level based on application risk

**Section Structure (2023 Edition):**

| Section | Content |
|---------|---------|
| Section 4 | Safety requirements -- hardware and operational design, obstacle detection, E-Stop, sharp edges, ground clearance |
| Section 5 | Testing and verification -- specific test procedures for design validation, obstacle detection protocols |
| Section 6 | Documentation -- instruction manuals, PPE requirements, speed/slope specs, environmental conditions |

**Key Safety Elements:**
1. Operating environment definition (zones of human-vehicle interaction)
2. Hazard and risk identification for all operational scenarios
3. Safety system implementation with defined performance levels

### Stakeholder Responsibilities

ISO 3691-4 defines a three-party responsibility framework:

**OEM Manufacturer:**
- Design and build with safety as priority
- Conduct comprehensive risk assessments (collision, entrapment, crushing)
- Implement safety measures from design phase
- Supply extensive documentation per Machinery Directive
- Manage residual risks through collaboration with integrators

**Integrator:**
- Perform risk assessments focusing on AGV-environment interfaces
- Ensure complete installation with all risks identified and mitigated
- Conduct risk transfer activities to end users
- Bridge manufacturer design intent and real-world deployment

**End User:**
- Conduct risk assessments specific to their use cases
- Continuously monitor and manage residual risks
- Provide safety training for operators
- Enforce zone access control and provide PPE
- Maintain AGVs per manufacturer guidelines

### How to Get Certified

1. **Risk Assessment**: Conduct comprehensive hazard analysis per ISO 12100
2. **Design to Standard**: Implement safety functions meeting required PLs per ISO 13849-1
3. **Build Technical Construction File**: Contains electrical diagrams, functional diagrams, list of applied standards, test results, risk assessment, calculations, instruction/maintenance manuals, Declarations of Conformity for components
4. **Third-Party Assessment**: Submit Technical Construction File to a certification body (TUV Rheinland, Applus+, etc.) for review and testing
5. **Testing**: Third-party auditors conduct specific verification tests, particularly for obstacle detection
6. **CE Declaration**: Upon passing, manufacturer issues EU Declaration of Conformity
7. **CE Marking**: Affix CE marking to the vehicle

### Cost and Timeline

- **Standard purchase**: $200 (ANSI members) / $250 (non-members)
- **Certification assessment**: Typically $50,000-$150,000 depending on complexity, number of variants, and certification body
- **Timeline**: 3-6 months for the certification process itself (assuming the product is already designed to the standard)
- **Note**: ISO 3691-4 was harmonized with the EU Machinery Directive 2006/42/EC in May 2024 (published in OJEU), giving it presumption of conformity status. This means compliance with ISO 3691-4 creates a legal presumption that the essential health and safety requirements of the Directive are met. See [iso-3691-4-deep-dive.md](iso-3691-4-deep-dive.md) for detailed clause-by-clause analysis

### Practical Considerations for Airport AVs

EasyMile/TractEasy systems are compliant with ISO 13849-1 achieving Performance Level PLd, and their CE-marked products meet applicable European safety directives. For airport-specific deployments, ISO 3691-4 provides the industrial truck safety baseline, but airport-specific requirements (FOD prevention, aircraft proximity, jet blast zones) require additional risk assessment beyond what the standard covers.

---

## 2. UL 4600 Safety Case

### What It Is

ANSI/UL 4600, "Standard for Safety for the Evaluation of Autonomous Products," is the first comprehensive standard for public road autonomous vehicle safety covering both urban and highway use cases. First issued April 2020, with Edition 2 in March 2022 and Edition 3 in March 2023 (adding autonomous trucking). It is technology-agnostic and goal-based.

### Core Concept: The Safety Case

UL 4600 does not prescribe specific technical solutions. Instead, it requires the developer to construct a **safety case** -- a structured argument, supported by evidence, demonstrating that an autonomous system is acceptably safe for its intended use.

A safety case has three elements:
1. **Goals (Claims)**: What safety properties must be demonstrated
2. **Argumentation**: The logical reasoning connecting evidence to goals
3. **Evidence**: Test results, analysis, operational data, design documentation

### Key Topics and Clauses

| Topic Area | Coverage |
|-----------|----------|
| Safety Case Construction | Goal coverage, argumentation validity, evidence credibility |
| Risk Analysis | Hazard identification, severity assessment, mitigation strategies |
| Design Process | Safety-relevant aspects of system design and development |
| Testing | Verification, validation, and testing methodologies |
| Tool Qualification | COTS systems, legacy components, development tools |
| Autonomy Validation | Machine learning, sensing, perception, prediction |
| Data Integrity | Data storage, communications, integrity verification |
| Human-Machine Interaction | Interaction with non-drivers (pedestrians, other road users) |
| Lifecycle Concerns | Design-to-manufacturing handoff, supply chain, disposal |
| Maintenance & Inspection | Ongoing system maintenance requirements |
| Metrics | Safety performance indicators and measurement |
| Conformance Assessment | Independent evaluation and feedback mechanisms |

### How to Build a UL 4600 Safety Case

**Step 1: Define Safety Claims**
- Identify all operational scenarios and their hazards
- Define measurable safety claims (e.g., "the vehicle detects pedestrians at X distance with Y reliability")
- Account for real-world edge cases (visually impaired pedestrians, deferred maintenance, component failures)

**Step 2: Construct Argumentation**
- Document the logical chain from evidence to claims
- Address assumptions and their validity
- Handle "unknown unknowns" -- explicit acknowledgment of what is not known
- Ensure internal consistency of the entire safety argument

**Step 3: Provide Evidence**
- Simulation results with scenario coverage metrics
- Road test data with statistical significance
- Design verification reports
- Static code analysis results (mandatory for V&V)
- Hardware reliability data
- Field feedback data

**Step 4: Address ML Components**
- Validate ML-based perception and prediction functionality
- Demonstrate robustness and brittleness boundaries
- Provide evidence for ML training data quality and coverage
- Address adversarial robustness and distribution shift

**Step 5: Post-Deployment**
- Mechanisms for collecting field feedback data
- Managing uncertainties, assumptions, and gaps after deployment
- Continuous safety case maintenance as the system evolves

### Assessment Framework (Edition 2+)

UL 4600 distinguishes between:
- **Self-assessment**: Development teams create and evaluate their own safety cases
- **Independent assessment**: External organizations examine both structure and technical substance

The independent assessor examines:
- Whether the safety case is structurally complete
- Whether the argumentation is valid
- Whether the evidence is sufficient and credible
- Whether all required topics are adequately addressed

### Practical Value for Airport AVs

UL 4600 provides the most complete framework for building a safety case for an autonomous system. Even if you are not seeking formal UL 4600 certification, the standard's structure serves as an excellent template for the safety case that airport authorities, airlines, and regulators will want to see. The standard is available for free digital viewing through UL.org (registration required).

---

## 3. AMLAS Methodology in Practice

### What It Is

AMLAS (Assurance of Machine Learning for use in Autonomous Systems) is the world's first methodology for safely deploying autonomous technologies with machine learning components. Developed by the University of York's Assuring Autonomy International Programme, AMLAS provides a systematic six-stage process with safety argument patterns (in GSN notation) that produce a complete safety case for ML components.

### The 6 Stages Applied to a Real AV System

#### Stage 1: ML Safety Assurance Scoping

**Objective**: Define the scope of safety assurance for the ML component and establish the safety case boundary.

**Activities:**
- Activity 1: Allocate safety requirements to the ML component by examining system hazards, architectural features, and environmental factors. Consider redundancy and human oversight contributions.
- Activity 2: Instantiate the ML Safety Assurance Scoping Argument Pattern (GSN).

**Required Artifacts:**
- [E] Safety Requirements Allocated to ML Component
- [G] ML Safety Assurance Scoping Argument

**Inputs:**
- System safety requirements
- Operating environment description
- System architecture details
- ML component description

**Airport AV Example**: For a perception system, Stage 1 would allocate requirements like "detect all ground personnel within 30m with >99.9% recall" from the system-level requirement "vehicle shall not collide with personnel."

**Safety Argument Pattern (GSN)**:
Top claim G1.1: "Allocated system safety requirements are satisfied in the defined environment." Explicitly documents assumptions about system safety requirements validity.

#### Stage 2: ML Safety Requirements Assurance

**Objective**: Develop ML-specific safety requirements from allocated system requirements, addressing the "semantic gap" between implicit intentions and explicit ML requirements.

**Activities:**
- Activity 3: Translate real-world safety concepts into ML-implementable requirements (e.g., "detect all personnel" becomes specific recall/precision metrics for each object class)
- Activity 4: Validate ML safety requirements through expert reviews and simulation
- Activity 5: Instantiate the ML Safety Requirements Argument Pattern

**Required Artifacts:**
- [H] ML Safety Requirements (performance and robustness specifications)
- [J] ML Safety Requirements Validation Results
- [K] ML Safety Requirements Argument

**Airport AV Example**: Requirements like:
- "Pedestrian detection recall >= 99.95% at distances 2-30m"
- "False positive rate for personnel detection <= 0.1% per frame"
- "Detection performance degrades by no more than 5% in rain conditions"
- "System detects high-visibility vest-wearing ground crew at >= 99.99%"

#### Stage 3: Data Management Assurance

**Objective**: Develop data requirements, generate datasets, and validate that data is sufficient to support ML safety requirements.

**Activities:**
- Activity 6: Define data requirements for relevance, completeness, accuracy, and balance
- Activity 7: Generate three separate datasets: development data, internal test data, and verification data
- Activity 8: Validate datasets meet data requirements with documented justifications
- Activity 9: Instantiate the ML Data Argument Pattern

**Required Artifacts:**
- [L] Data Requirements
- [M] Data Requirements Justification Report
- [N] Development Data
- [O] Internal Test Data
- [P] Verification Data (never exposed during development)
- [Q] Data Generation Log
- [S] ML Data Validation Results
- [T] ML Data Argument

**Airport AV Example**: Data requirements must specify:
- Coverage of all personnel types (ground crew, pilots, passengers)
- All lighting conditions (dawn, dusk, night, direct sun, ramp lighting)
- All weather conditions present in the ODD (rain, fog, snow, heat shimmer)
- Airport-specific objects (dollies, belt loaders, GPU carts, aircraft)
- Balance across rare but safety-critical scenarios

#### Stage 4: Model Learning Assurance

**Objective**: Develop the ML model satisfying safety requirements, with documented justification for all design decisions.

**Activities:**
- Activity 10: Create candidate models through hyperparameter tuning; document rationale for architecture selection
- Activity 11: Evaluate candidates using internal test data; select based on multi-objective optimization
- Activity 12: Instantiate the ML Learning Argument Pattern

**Required Artifacts:**
- [U] Model Development Log (all decisions and justifications)
- [V] ML Model
- [X] Internal Test Results
- [Y] ML Learning Argument

**Airport AV Example**: Document why a specific architecture was chosen (e.g., "YOLOv8 selected over Faster R-CNN due to real-time inference requirements on target hardware while meeting recall requirements"), along with all hyperparameter choices and training decisions.

#### Stage 5: Model Verification Assurance

**Objective**: Verify the ML model against safety requirements using data never seen during development.

**Activities:**
- Activity 13: Verify ML model using held-out verification data; test both performance metrics and robustness across environmental variations
- Activity 14: Instantiate the ML Verification Argument Pattern

**Required Artifacts:**
- [Z] Verification Test Results
- [BB] ML Verification Argument Pattern
- [CC] ML Verification Argument

**Airport AV Example**: Run the trained model against the verification dataset. Demonstrate that:
- All performance requirements from Stage 2 are met
- Performance holds across all environmental conditions in the ODD
- Robustness to perturbations (sensor noise, partial occlusion) is within bounds

#### Stage 6: Model Deployment Assurance

**Objective**: Integrate the ML model into the complete system, test system-level functionality, and create deployment assurance arguments.

**Activities:**
- Activity 15: Integrate ML model with sensors, actuators, and other software components
- Activity 16: Test integrated system addressing real-time performance, hardware interactions, latency
- Activity 17: Instantiate the ML Deployment Argument Pattern

**Required Artifacts:**
- [DD] Integration Test Results
- [EE] System-Level Test Results
- [FF] Integration Test Report
- [HH] ML Deployment Argument

**Airport AV Example**: Demonstrate that the perception model running on the target compute platform (e.g., NVIDIA Jetson) meets latency requirements (<100ms inference), handles sensor synchronization correctly, and integrates properly with planning and control modules.

### Cross-Stage Process Characteristics

- **Iterative**: Verification findings may trigger revisits to data management or requirements stages
- **Parallel**: Assurance activities run alongside ML development, not as a post-hoc audit
- **Documented**: Every stage produces explicit documentation of assumptions, tradeoffs, and uncertainties
- **Composable**: Each stage produces GSN argument patterns that collectively form the complete ML safety case, which integrates with the broader system safety case

### Complete AMLAS Safety Case Structure

The full safety case is the composition of all six stage arguments:
```
System Safety Case
  |-- System Safety Argument (non-ML)
  |-- ML Safety Case (AMLAS)
       |-- [G] Scoping Argument
       |-- [K] Requirements Argument
       |-- [T] Data Argument
       |-- [Y] Learning Argument
       |-- [CC] Verification Argument
       |-- [HH] Deployment Argument
```

---

## 4. ISO 26262 for Autonomous Vehicles

### What It Is

ISO 26262 is the international standard for functional safety of road vehicles. It provides a comprehensive framework for ensuring that electrical and electronic (E/E) systems in vehicles do not cause unreasonable risk due to malfunctioning behavior. The standard defines Automotive Safety Integrity Levels (ASILs) from A (lowest) to D (highest).

### ASIL Determination

ASIL is determined through Hazard Analysis and Risk Assessment (HARA) using three factors:

**Severity (S):**
| Level | Description |
|-------|------------|
| S0 | No injuries |
| S1 | Light and moderate injuries |
| S2 | Severe and life-threatening injuries (survival probable) |
| S3 | Life-threatening injuries (survival uncertain), fatal |

**Exposure (E):**
| Level | Description |
|-------|------------|
| E0 | Incredible |
| E1 | Very low probability |
| E2 | Low probability |
| E3 | Medium probability |
| E4 | High probability |

**Controllability (C):**
| Level | Description |
|-------|------------|
| C0 | Controllable in general |
| C1 | Simply controllable |
| C2 | Normally controllable |
| C3 | Difficult to control or uncontrollable |

**ASIL Determination Matrix:**

| | C1 | C2 | C3 |
|---|---|---|---|
| **S1+E1** | QM | QM | QM |
| **S1+E2** | QM | QM | QM |
| **S1+E3** | QM | QM | A |
| **S1+E4** | QM | A | B |
| **S2+E1** | QM | QM | QM |
| **S2+E2** | QM | QM | A |
| **S2+E3** | QM | A | B |
| **S2+E4** | A | B | C |
| **S3+E1** | QM | QM | A |
| **S3+E2** | QM | A | B |
| **S3+E3** | A | B | C |
| **S3+E4** | B | C | D |

QM = Quality Management (no specific safety requirements beyond standard quality)

### Requirements at Each ASIL Level

**Hardware Metrics:**

| Metric | ASIL B | ASIL C | ASIL D |
|--------|--------|--------|--------|
| SPFM (Single Point Fault Metric) | >= 90% | >= 97% | >= 99% |
| LFM (Latent Fault Metric) | >= 60% | >= 80% | >= 90% |
| PMHF (Probabilistic Metric for Hardware Failure) | <= 100 FIT | <= 100 FIT | <= 10 FIT |

(FIT = Failures in Time, 1 failure per 10^9 hours)

**Development Process Requirements by ASIL Level:**

| Requirement | ASIL A | ASIL B | ASIL C | ASIL D |
|-------------|--------|--------|--------|--------|
| Safety plan | Required | Required | Required | Required |
| Hazard analysis | Required | Required | Required | Required |
| Safety concept | Recommended | Required | Required | Required |
| V-model development | Recommended | Required | Required | Required |
| Design verification | Recommended | Required | Required | Required |
| Code review | Recommended | Recommended | Required | Required |
| Unit testing | Recommended | Required | Required | Required |
| Integration testing | Required | Required | Required | Required |
| Safety validation | Required | Required | Required | Required |
| Formal methods | Not required | Not required | Recommended | Highly recommended |
| Back-to-back testing | Not required | Recommended | Required | Required |
| Fault injection testing | Not required | Recommended | Recommended | Required |

### Implications for Autonomous Vehicles

**The Controllability Problem**: ISO 26262 defines controllability as the driver's ability to control the situation. For autonomous vehicles with no human driver, controllability defaults to C3 (uncontrollable). This means:
- Any hazard with S2/E3 or worse becomes ASIL B or higher
- Many AV perception/planning systems default to ASIL C or ASIL D
- Most OEMs default to ASIL D for any system with potential for passenger harm

**ASIL Decomposition**: ISO 26262 allows ASIL decomposition -- splitting a high-ASIL requirement across redundant components. For example, an ASIL D requirement can be satisfied by two independent ASIL B channels. This is crucial for AV architectures where:
- A primary ML-based perception channel provides normal operation
- A secondary safety-rated channel (e.g., lidar-only collision detection) provides independent safety monitoring

### How ML Components Are Handled

ISO 26262 was not designed for ML components and has significant gaps:

**Challenges:**
- ML models are not deterministic in the traditional sense
- Code coverage metrics do not apply meaningfully to neural networks
- Formal verification of deep neural networks is an open research problem
- Training data quality has no direct analog in traditional software development
- Model interpretability is limited, conflicting with transparency requirements

**Current Approaches:**
1. **Architecture-Level Mitigation**: Treat the ML component as a "black box" and wrap it with safety-rated monitors. The ML channel operates at QM (no ASIL), while independent safety monitors operate at the required ASIL level
2. **ASIL Decomposition**: Use diverse redundancy -- different ML architectures trained on different datasets provide independence
3. **Complementary Standards**: Apply ISO/PAS 8800 for AI-specific concerns and ISO 21448 (SOTIF) for intended functionality safety
4. **Testing Focus**: Extensive scenario-based testing substitutes for traditional code-level verification

**Practical ASIL Assignment for an Airport AV:**
- Collision avoidance (personnel): ASIL D (S3, E4, C3) -- fatal risk, high exposure, no driver
- Speed control on ramp: ASIL C (S2, E4, C2) -- serious injury risk
- Route adherence: ASIL B (S2, E3, C2) -- deviation could cause aircraft contact
- Status reporting: ASIL A or QM -- failure is inconvenient but not dangerous

---

## 5. ISO/PAS 8800 -- AI Safety Lifecycle

### What It Is

ISO/PAS 8800:2024, "Road Vehicles -- Safety and Artificial Intelligence," was published in December 2024. It is the first standard specifically addressing the safety of AI-based systems in road vehicles. It fills critical gaps in ISO 26262 (which does not address AI/ML) and extends ISO 21448 (SOTIF) with AI-specific safety lifecycle processes.

### Standard Structure (15 Clauses)

| Clause | Content |
|--------|---------|
| Clauses 1-5 | Definitions, references, and foundational concepts |
| Clause 6 | Context for AI in road vehicles and basic safety concepts |
| Clause 7 | AI safety management (organizational processes) |
| Clause 8 | Assurance arguments for AI systems |
| Clause 9 | Derivation of AI safety requirements |
| Clause 10 | Selection of AI technologies and architectural measures |
| Clause 11 | Data-related considerations (training, validation, test, production, field monitoring datasets) |
| Clause 12 | Verification and validation of AI systems |
| Clause 13 | Safety analysis of AI systems (including CFDTs) |
| Clause 14 | Operational measures (post-deployment monitoring, updates) |
| Clause 15 | Confidence in AI frameworks and tools |

Plus 8 annexes providing supplementary guidance.

### What It Adds Beyond ISO 26262

**1. AI Safety Lifecycle**

ISO/PAS 8800 introduces an AI-specific V-model covering:
- AI requirements derivation (from system safety requirements)
- AI architecture and technology selection
- Data acquisition, annotation, and management
- Model training and validation
- Verification against safety requirements
- Deployment and field monitoring
- Continuous safety assurance post-deployment

**2. Five Dataset Types as Safety Artifacts**

| Dataset | Purpose | Safety Treatment |
|---------|---------|-----------------|
| Training Dataset | Model instruction and learning | Version-controlled, traceable |
| Validation Dataset | Model comparison and parameter tuning | Independent from training |
| Test Dataset | Performance and generalization estimation | Held out, never seen during training |
| Production Dataset | Real-world operational data | Monitored for distribution shift |
| Field Monitoring Dataset | Post-deployment performance tracking | Triggers corrective actions |

Each dataset must be version-controlled, traceable, and treated as a formal safety artifact.

**3. Component Fault and Deficiency Trees (CFDTs)**

CFDTs extend traditional Component Fault Trees (CFTs) to describe:
- Cause-effect relationships between individual failures
- Functional insufficiencies (not just faults)
- System hazards from AI-specific failure modes
- Risk mitigation assessment for both traditional faults and AI performance deficiencies

This allows a unified safety analysis covering both:
- ISO 26262 concerns (malfunctioning behavior)
- SOTIF concerns (performance limitations and insufficiencies)

**4. AI-Specific Safety Concerns Addressed**

- **Bias**: Requirements for detecting and mitigating bias in training data and model outputs
- **Prediction Accuracy**: Quantitative requirements for AI prediction performance
- **Robustness**: Testing against adversarial inputs, sensor degradation, edge cases
- **Interpretability**: Requirements for understanding why AI makes specific decisions
- **Bounded Incremental Learning**: Safety controls on systems that learn post-deployment
- **Distribution Shift**: Monitoring for changes in operational data vs. training data

**5. Post-Deployment Monitoring**

Field monitoring closes the safety loop through:
- Continuous real-world data collection
- Anomaly and near-miss detection
- Unexpected condition identification
- Corrective action triggers via change management
- Periodic revalidation of safety claims

### How to Apply ISO/PAS 8800

**Step 1**: Map your AI components to the standard's scope (perception, planning, prediction)

**Step 2**: Derive AI safety requirements from system-level HARA, considering both malfunction (ISO 26262) and insufficiency (SOTIF)

**Step 3**: Select AI technologies and define architectural measures (redundancy, monitoring, fallback)

**Step 4**: Implement data management processes treating all five dataset types as safety artifacts

**Step 5**: Conduct verification and validation using scenario-based testing, covering both nominal and edge-case conditions

**Step 6**: Perform safety analysis using CFDTs

**Step 7**: Establish post-deployment monitoring and update processes

### Relationship to Other Standards

The combination creates an Automated Driving Systems (ADS) safety framework:
- **ISO 26262**: Base functional safety framework (deterministic systems)
- **ISO 21448 (SOTIF)**: Safety of intended functionality (performance limitations)
- **ISO/PAS 8800**: AI-specific safety lifecycle (learning systems, data-dependent behavior)
- **ISO/TS 5083**: ADS safety case framework (overall safety argumentation)

---

## 6. SOTIF (ISO 21448)

### What It Is

SOTIF -- Safety of the Intended Functionality -- is defined as "the absence of unreasonable risk due to hazards resulting from functional insufficiencies of the intended functionality or by reasonably foreseeable misuse by persons." Published as ISO/PAS 21448:2019, with the full ISO 21448:2022 standard following.

### How SOTIF Differs from ISO 26262

| Aspect | ISO 26262 | ISO 21448 (SOTIF) |
|--------|-----------|-------------------|
| Focus | Malfunctioning behavior | Performance limitations |
| Failure Type | Component faults, systematic errors | Functional insufficiencies |
| Example | LiDAR hardware failure | LiDAR cannot detect black objects in rain |
| Approach | Fault prevention, detection, tolerance | Scenario analysis, performance validation |
| Root Cause | Known failure modes | Unknown triggering conditions |

### The Four Scenario Areas

SOTIF defines four areas based on two dimensions -- whether the scenario is safe or unsafe, and whether it is known or unknown:

```
                    KNOWN              UNKNOWN
              +------------------+------------------+
    SAFE      |   Area 1         |   Area 2         |
              | Known Safe       | Unknown Safe     |
              | (Normal ops)     | (Benign unknowns)|
              +------------------+------------------+
    UNSAFE    |   Area 3         |   Area 4         |
              | Known Unsafe     | Unknown Unsafe   |
              | (Mitigated)      | (Residual risk)  |
              +------------------+------------------+
```

**Area 1 (Known Safe)**: Scenarios where the system is known to perform safely. These grow through verification.

**Area 2 (Unknown Safe)**: Scenarios that are safe but not yet identified. Not a safety concern but represent incomplete knowledge.

**Area 3 (Known Unsafe)**: Hazardous scenarios that have been identified. The goal is to mitigate them through design improvements or ODD restrictions, moving them to Area 1.

**Area 4 (Unknown Unsafe)**: Hazardous scenarios not yet discovered. This is the primary SOTIF concern. The goal is to discover these (moving them to Area 3) and then mitigate them (moving them to Area 1).

### How to Identify Triggering Conditions

**Triggering conditions** are specific conditions of a driving scenario that initiate a system reaction, possibly leading to a hazardous event.

**Systematic Identification Process:**

1. **Use-Case Based Analysis**: Start from system specifications and the operational design domain. Enumerate all use cases the system will encounter.

2. **Functional Insufficiency Analysis**: For each sensor and algorithm, identify known limitations:
   - Camera: Glare, low contrast, lens contamination, dynamic range limits
   - LiDAR: Rain, fog, reflective surfaces, black objects, near-range blind spots
   - Radar: Multipath in cluttered environments, height ambiguity
   - Perception ML: Out-of-distribution objects, unusual poses, partial occlusion
   - Prediction: Unusual behavior by other agents, rare interaction patterns

3. **Environment-Based Analysis**: Systematic enumeration of environmental conditions:
   - Weather: Rain, fog, snow, dust, heat shimmer
   - Lighting: Dawn, dusk, direct sun, shadows, artificial lighting transitions
   - Surface: Wet, icy, painted markings, gratings
   - Objects: Unusual objects, debris, temporary structures

4. **Scenario Combination**: Cross-product of use cases x functional insufficiencies x environmental conditions to generate potential triggering conditions.

**Airport-Specific Triggering Conditions:**
- Jet blast causing sensor vibration or debris
- Aircraft refueling operations (fuel vapors affecting lidar)
- High-visibility vest patterns confusing person detection
- Painted markings on apron with varying contrast
- Pushback tractors moving aircraft in unpredictable trajectories
- FOD (foreign object debris) on pavement
- Night operations with mixed artificial lighting

### Validation Requirements

**Scenario-Based Testing Approach:**

SOTIF pushes scenario-based testing because exhaustive real-world testing is impossible. The validation strategy combines:

1. **Simulation**: Millions of scenarios testing perception + planning together
2. **Hardware-in-the-Loop (HIL)**: Safety-critical software in simulated conditions
3. **Software-in-the-Loop (SIL)**: Full software stack in virtual environment
4. **Proving Ground**: Controlled physical testing of critical scenarios
5. **Real-World Testing**: Edge-case validation in actual operating environment

**Acceptance Criteria:**
- Area 3 (Known Unsafe) scenarios must be shown to be mitigated to acceptable residual risk
- Area 4 (Unknown Unsafe) must be demonstrated to be sufficiently small through extensive scenario exploration
- Statistical evidence that discovery rate of new unknown unsafe scenarios has converged

**SOTIF Achievement Process:**
1. Specification and design of the intended functionality
2. Identification of hazards and triggering conditions
3. Evaluation of known unsafe scenarios
4. Definition of verification and validation strategy
5. Verification of known unsafe scenarios mitigation
6. Validation through scenario-based testing to demonstrate sufficiently low residual risk
7. Continuous monitoring and update post-deployment

---

## 7. CE Marking for Autonomous Vehicles

### Regulatory Framework

In Europe, autonomous ground vehicles used in industrial settings (including airports) fall under the Machinery Directive 2006/42/EC and its successor, the new Machinery Regulation (EU) 2023/1230. CE marking is the mandatory conformity marking indicating compliance with EU health and safety requirements.

### Current Framework: Machinery Directive 2006/42/EC

**Scope**: Applies to all machinery placed on the European market, including AGVs and autonomous industrial vehicles.

**Conformity Assessment Routes:**

1. **Self-Certification (Standard Machinery)**:
   - Manufacturer performs conformity assessment
   - Compiles Technical File
   - Issues EU Declaration of Conformity
   - Affixes CE marking

2. **Third-Party Certification (Annex IV Machinery)**:
   - For higher-risk machinery listed in Annex IV
   - Required when no harmonized standards are applied, or manufacturer did not apply them
   - Must involve a Notified Body (e.g., TUV, Bureau Veritas)
   - Notified Body reviews Technical File and issues certificate

**Technical File Requirements:**
- General description of the machinery
- Overall drawings and detailed drawings
- Complete electrical/hydraulic/pneumatic diagrams
- Risk assessment documentation (per ISO 12100)
- List of applied harmonized standards
- Test results and reports
- Instructions and maintenance manuals
- Declaration of Conformity for incorporated components
- Declaration of Conformity for the complete machine

### New Framework: Machinery Regulation (EU) 2023/1230

**Effective**: January 20, 2027 (replaces Directive 2006/42/EC)

**Key Changes for Autonomous Vehicles:**

1. **Autonomous Mobile Machinery Requirements**:
   - Supervisory function: Robot must send information and alerts to a human supervisor
   - Supervisor must be able to stop, restart, or bring the machine to a safe position
   - Safe travel within defined working area using physical borders or obstacle detection
   - Safe fallback modes enabling operators to override or shut down AI-based functions

2. **AI and Self-Evolving Behavior**:
   - For machines with fully or partially self-evolving logic, risk assessment must consider behavior after market placement
   - Targets movement space and task evolution
   - Requires ongoing conformity even as behavior changes

3. **Annex I High-Risk Machinery**:
   - Part A: Mandatory Notified Body involvement
   - Part B: Procedure similar to current Annex IV
   - Autonomous mobile machinery with AI safety functions is expected to require Notified Body assessment

### What Applies to Airport AVs

For an autonomous baggage tractor or cargo mover operating at a European airport:

1. **Machinery Directive/Regulation**: Primary CE marking route. The vehicle is machinery.
2. **EMC Directive (2014/30/EU)**: Electromagnetic compatibility
3. **Low Voltage Directive (2014/35/EU)**: If electrically powered
4. **Radio Equipment Directive (2014/53/EU)**: If using wireless communications (WiFi, 4G/5G, V2X)
5. **Outdoor Noise Directive (2000/14/EC)**: If operating outdoors

**Harmonized Standards Applied:**
- ISO 13849-1: Safety of machinery -- Safety-related parts of control systems
- ISO 3691-4: Driverless industrial trucks
- ISO 12100: Safety of machinery -- General principles for design
- IEC 62443: Cybersecurity for industrial automation

### Practical CE Marking Process for an Airport AV

1. Determine applicable directives
2. Identify harmonized standards for each directive
3. Conduct risk assessment per ISO 12100
4. Design to meet essential health and safety requirements
5. Apply harmonized standards (ISO 3691-4, ISO 13849-1)
6. Compile Technical File
7. If Annex IV/Annex I Part A: Engage Notified Body
8. Conduct type examination or production quality assurance
9. Issue EU Declaration of Conformity
10. Affix CE marking

**Timeline**: 4-8 months for the conformity assessment process (assuming design is compliant)
**Cost**: $30,000-$100,000 for Notified Body assessment, depending on complexity

---

## 8. FAA Approval Process for Airside Operations

### Current Regulatory Status

As of 2025, the FAA has **not authorized** full autonomous vehicle operations on the airside of Part 139 certificated airports. The regulatory framework is still developing. Two key documents define the current landscape:

### CertAlert 24-02 (February 15, 2024)

**Purpose**: Provide information on Autonomous Ground Vehicle Systems (AGVS) technology and its use on airports.

**Key Points:**
- Testing, deployment, and operation of AGVS for airside use have **not been authorized** by the FAA at Part 139 certificated airports
- The FAA supports testing only in "controlled environments"
- This was partly triggered by TractEasy's deployment at Greenville-Spartanburg airport, where the FAA "requested a pause due to the absence of a structured process to assess AVs for airport use"

**Controlled Environments (Permitted for Testing):**
- Non-movement areas (aprons, aircraft gate areas)
- Parking areas
- Remote areas
- Landside areas

**Not Considered Controlled Environments:**
- Active movement areas (runways, taxiways)
- Safety areas
- Object free areas

### Emerging Entrants Bulletin 25-02 (May 2025)

**Updates from CertAlert 24-02:**
- AGVS may now be operationally tested in **closed movement areas** and associated safety areas
- Airport sponsors must "ensure that associated risks with AGVS are understood, properly considered, and mitigated"
- Avoid closing airport areas exclusively for AGVS testing (maintain tenant access)

**Approved AGVS Applications:**
- Maintenance vehicles (mowers, snow removal, sweepers, FOD detection)
- Perimeter security vehicles
- Self-driving aircraft tugs
- Baggage carts
- Employee buses and shuttles

### What Airport Authorities Actually Require

**Step-by-Step Approval Process:**

1. **Early Engagement**: Contact your regional FAA Airport Certification and Safety Inspector (Part 139) or Regional Airports Division (GA airports) early in planning

2. **Safety Plan Submission**: Provide a comprehensive safety plan including:
   - Vehicle specifications and capabilities
   - Operational design domain (where, when, how fast)
   - Risk assessment for the specific airport environment
   - Emergency procedures
   - Safety operator protocols
   - Insurance documentation

3. **Local Stakeholder Coordination**: Once FAA testing is authorized, engage:
   - Airport operations
   - Airlines and ground handlers
   - Air traffic control (if near movement areas)
   - Airport fire/rescue

4. **Controlled Environment Testing**: Begin with testing in non-movement areas (aprons, remote areas)

5. **Progressive Expansion**: Demonstrate safe operations before expanding to more complex environments

6. **Documentation and Reporting**: Maintain detailed records of:
   - Testing results and system performance data
   - Safety incident reports
   - Operational modifications or upgrades
   - Hours of operation and miles driven

### FAA Research Direction

The FAA's Airport Technology Research and Development Branch is studying:
- Remote monitoring and control of AGVS
- Object detection and obstacle avoidance performance
- Integration of sensors and communications
- Performance in movement areas, safety areas, and non-movement areas

### Practical Reality

The current regulatory environment means:
- **No formal certification path exists** for airside autonomous vehicle operations at US airports
- Each deployment is essentially a negotiated agreement with the local FAA office
- The FAA is supportive of testing but cautious about operational deployment
- TractEasy's experience shows that proceeding without FAA coordination triggers regulatory intervention
- Most successful deployments have been in non-movement areas (aprons, cargo areas)

### International Comparison

**United Kingdom**: reference airside AV stack obtained its ground handling licence at East Midlands Airport under the Airports (Ground Handling) Regulations 1997 and the Civil Aviation Authority's compliance framework under the Civil Aviation Act 2012. This provides a more structured path than the US.

**Japan**: TractEasy/EasyMile deployed at Narita International Airport in partnership with the airport corporation and Ministry of Land, Infrastructure, Transport and Tourism, with driverless operations under remote supervision.

**Singapore**: TractEasy has deployed at Changi Airport under the Civil Aviation Authority of Singapore's framework.

**France**: TractEasy's flagship deployment at Toulouse-Blagnac Airport has been operational since November 2022, achieving Level 4 autonomy (no onboard operator) by November 2023.

---

## 9. Safety Case Structure (GSN)

### What Is Goal Structuring Notation

Goal Structuring Notation (GSN) is a graphical argumentation notation developed at the University of York in the 1990s for presenting safety cases. It shows the elements of a safety argument and the relationships between them. GSN is the de facto standard for documenting safety cases in safety-critical industries (aviation, rail, nuclear, automotive, defense).

### GSN Elements

| Element | Shape | Purpose |
|---------|-------|---------|
| **Goal** | Rectangle | A claim or assertion to be demonstrated |
| **Strategy** | Parallelogram | The approach for breaking down a goal into sub-goals |
| **Solution** | Circle | Evidence that directly supports a goal |
| **Context** | Rounded rectangle | Contextual information qualifying a goal or strategy |
| **Assumption** | Ellipse with "A" | An assumed condition underlying the argument |
| **Justification** | Ellipse with "J" | Rationale for why a goal or strategy is acceptable |
| **Undeveloped** | Diamond on goal | Indicates a goal not yet fully developed |

### GSN Relationships

| Relationship | Notation | Meaning |
|-------------|----------|---------|
| **SupportedBy** | Solid arrow | Goal/strategy is supported by sub-goals, strategies, or solutions |
| **InContextOf** | Hollow arrow | Goal/strategy is interpreted in context of another element |

### Building a Safety Case for an ML-Based AV System

Here is a practical GSN structure for an airport autonomous vehicle:

```
G1: "Airport AV operates acceptably safely in the defined ODD"
  |-- C1: "ODD: Airport apron, <15 km/h, daylight + night, all weather"
  |-- C2: "Acceptable safety: No collisions with personnel or aircraft"
  |
  |-- S1: "Argument over identified hazards"
  |    |
  |    |-- G1.1: "Collision with personnel is prevented"
  |    |    |-- S1.1: "Argument over perception + planning + control"
  |    |    |    |
  |    |    |    |-- G1.1.1: "Personnel are detected with sufficient reliability"
  |    |    |    |    |-- C: "Sufficient = >99.9% recall at 2-30m"
  |    |    |    |    |-- Sn1: "Verification test results (AMLAS Stage 5)"
  |    |    |    |    |-- Sn2: "Field monitoring data (AMLAS Stage 6)"
  |    |    |    |
  |    |    |    |-- G1.1.2: "Vehicle stops in time given detection distance"
  |    |    |    |    |-- Sn3: "Braking distance test results"
  |    |    |    |    |-- Sn4: "Worst-case latency analysis"
  |    |    |    |
  |    |    |    |-- G1.1.3: "Independent safety system provides backup"
  |    |    |    |    |-- Sn5: "Safety PLC certification (PLd per ISO 13849-1)"
  |    |    |    |    |-- Sn6: "Emergency braking test results"
  |    |    |    |    |-- Sn7: "Independence analysis (ASIL decomposition)"
  |    |
  |    |-- G1.2: "Collision with aircraft is prevented"
  |    |    |-- [Similar decomposition]
  |    |
  |    |-- G1.3: "Vehicle remains within authorized zones"
  |    |    |-- [Similar decomposition]
  |
  |-- S2: "Argument over system lifecycle"
  |    |-- G2.1: "Development process is sufficient"
  |    |    |-- Sn: "ISO 26262 process compliance evidence"
  |    |-- G2.2: "ML components are assured"
  |    |    |-- Sn: "AMLAS safety case (6 stages)"
  |    |-- G2.3: "System is maintained safely post-deployment"
  |    |    |-- Sn: "Field monitoring procedures"
  |    |    |-- Sn: "Update and revalidation process"
  |
  |-- S3: "Argument over operational safety"
       |-- G3.1: "Operators are adequately trained"
       |-- G3.2: "Operating procedures address all identified scenarios"
       |-- G3.3: "Emergency procedures are effective"
```

### Safety Case Patterns for ML Systems

AMLAS defines reusable GSN patterns for each stage. The key patterns are:

**ML Safety Assurance Scoping Pattern:**
- Top claim: "Allocated system safety requirements are satisfied in the defined environment"
- Decomposes over: system requirements allocation, environment definition, architecture suitability

**ML Data Argument Pattern:**
- Top claim: "Data used during development and verification is sufficient"
- Decomposes over: data requirements sufficiency, dataset generation quality, validation results

**ML Verification Argument Pattern:**
- Top claim: "ML safety requirements are satisfied by the verified model"
- Decomposes over: performance requirements, robustness requirements, verification evidence

### Tools for GSN

| Tool | Type | Notes |
|------|------|-------|
| Astah GSN | Commercial | Full GSN support, export to multiple formats |
| ASCE (Adelard) | Commercial | Safety case editor with GSN and CAE support |
| safeTbox (Fraunhofer IESE) | Commercial | State-of-the-art professional tool |
| CertWare (NASA) | Open source | Eclipse-based, GSN and CAE support |
| D-Case Editor | Open source | GSN editor developed for assurance cases |

---

## 10. Testing Requirements

### The Statistical Problem

The RAND Corporation's landmark 2016 study ("Driving to Safety") demonstrated the fundamental challenge of proving AV safety through testing alone:

**Key Findings:**

| Confidence Target | Required Miles | Fleet of 100 Cars |
|-------------------|---------------|-------------------|
| Demonstrate zero fatalities at 95% confidence | 275 million miles | 12.5 years continuous driving |
| Estimate fatality rate within 20% at 95% confidence | 8.8 billion miles | 400 years continuous driving |
| Prove 20% safer than humans at 95% confidence, 80% power | 11 billion miles | 518 years continuous driving |

**Why These Numbers Are So Large:**
- Human crash rate is about 77 injuries per 100 million miles
- Human fatality rate is about 1.09 per 100 million miles
- To demonstrate statistically significant improvement over such low base rates requires enormous sample sizes
- The calculation uses a Poisson distribution model: need ~96 observed fatalities for 20% precision at 95% confidence

### What This Means in Practice

Pure mileage-based testing is not feasible for demonstrating AV safety. The industry has converged on a multi-layered testing approach:

### Testing Pyramid

```
         /\
        /  \    Real-World Testing
       /    \   (thousands of hours)
      /------\
     /        \  Proving Ground Testing
    /          \ (hundreds of scenarios)
   /------------\
  /              \ Hardware-in-the-Loop
 /                \ (tens of thousands of tests)
/------------------\
/                    \ Software-in-the-Loop / Simulation
/                      \ (billions of miles / millions of scenarios)
```

### Testing Requirements by Standard

**ISO 26262:**
- Unit testing for all safety-related software
- Integration testing at component and system level
- Back-to-back testing (model vs. implementation) for ASIL C/D
- Fault injection testing for ASIL D
- Hardware-in-the-loop testing
- Vehicle-level validation testing

**ISO 21448 (SOTIF):**
- Scenario-based testing covering all identified triggering conditions
- Validation that unknown unsafe scenarios (Area 4) are acceptably small
- Statistical evidence of scenario discovery convergence
- Real-world testing for edge case validation

**UL 4600:**
- Simulation testing with defined scenario coverage
- Track testing for safety-critical scenarios
- Road/field testing
- Robustness testing (sensor degradation, environmental extremes)
- Regression testing after any system update

**ISO 3691-4:**
- Personnel detection testing at specified distances and speeds
- Emergency stop testing
- Braking distance verification
- Environmental testing (lighting, surface conditions)

### Scenario-Based Testing Approach

Modern AV certification relies on scenario-based testing. The approach:

1. **Scenario Catalog**: Define thousands of scenarios covering:
   - Normal operations (routine driving)
   - Edge cases (unusual but plausible situations)
   - Adversarial scenarios (worst-case conditions)

2. **Scenario Parameters**: Each scenario is parameterized:
   - Road geometry, surface conditions
   - Traffic participants (type, behavior, trajectory)
   - Environmental conditions (weather, lighting)
   - Sensor degradation modes

3. **Coverage Metrics**: Demonstrate adequate coverage:
   - Percentage of ODD covered
   - Percentage of identified triggering conditions tested
   - Statistical distribution of scenario parameters

4. **Pass/Fail Criteria**: Define measurable criteria:
   - No collisions in any tested scenario
   - Minimum time-to-collision in near-miss scenarios
   - Maximum deviation from expected trajectory
   - Response time within specified bounds

### Waymo's Approach (Industry Benchmark)

Waymo provides the most transparent example of AV testing methodology:

- **Real-world miles**: 127+ million fully autonomous miles (as of late 2025)
- **Simulation miles**: 6+ billion virtual miles (10 million simulated miles per day)
- **Statistical methodology**: Poisson distribution-based comparison of crash rates between Waymo and human benchmarks
- **Published results**: Over 56.7 million rider-only miles showing statistically significant lower crash rates than human benchmarks
- **Scenario-based testing**: Thousands of collision avoidance scenarios with simulated reconstruction of real-world crashes

### Testing Requirements for Airport AVs

For an airport autonomous vehicle, a practical testing program includes:

**Simulation (Minimum):**
- 10,000+ unique scenarios covering the airport ODD
- All identified triggering conditions from SOTIF analysis
- All weather and lighting conditions
- All personnel and vehicle interaction patterns
- Sensor degradation and failure modes

**Proving Ground / Controlled Testing:**
- Personnel detection at all distances, speeds, and angles
- Emergency braking from all speeds
- Obstacle avoidance for all object types
- Night operations
- Wet surface operations
- Multiple vehicle interaction

**Field Testing (At Airport):**
- Minimum 1,000 hours of supervised autonomous operation
- Progressive removal of safety operators
- All operational shifts (day, night, peak, off-peak)
- All weather conditions encountered during testing period
- Integration with airport ground operations

---

## 11. Third-Party Assessment

### Who Does Safety Assessments

**TUV SUD / TUV Rheinland / TUV Nord:**
- Largest and most recognized certification bodies for automotive and industrial safety
- Provide ISO 26262 functional safety assessments, ISO 3691-4 AGV certification, CE marking
- Scenario-based testing services for autonomous vehicles
- Offices globally; primary labs in Germany
- TUV Rheinland specifically prepared to test and certify Mobile Robots, AGVs, and Trucks for European and North American markets

**UL Solutions:**
- Developers of UL 4600 standard
- Provide autonomous vehicle safety training and advisory
- Independent safety case assessment services
- Strongest in North American market

**Bureau Veritas:**
- Automotive component testing and certification
- Quality and safety compliance assessments
- Particularly strong in European and Asian markets

**SGS:**
- ISO/PAS 8800 assessment services
- Automotive functional safety
- Global laboratory network

**Intertek:**
- UL 4600 assessment services
- Autonomous vehicle testing
- Electromagnetic compatibility testing

**DNV (Det Norske Veritas):**
- ISO 26262 functional safety for road vehicles
- Risk-based certification approach
- Strong in Nordic markets and maritime-adjacent applications

**Applus+ Laboratories:**
- ISO 3691-4:2023 compliance testing for AGVs
- CE marking assessments
- Specialized in industrial vehicle testing

### Cost Estimates

Specific costs are highly variable and dependent on scope, but industry ranges are:

| Assessment Type | Estimated Cost Range | Typical Duration |
|----------------|---------------------|------------------|
| ISO 3691-4 CE Marking (with Notified Body) | $50,000 - $150,000 | 3-6 months |
| ISO 26262 Functional Safety Assessment (full system) | $200,000 - $1,000,000+ | 12-24 months |
| UL 4600 Safety Case Assessment | $100,000 - $500,000 | 6-12 months |
| ISO 21448 SOTIF Assessment | $100,000 - $300,000 | 6-12 months |
| CE Marking (full conformity, multiple directives) | $30,000 - $100,000 | 4-8 months |
| ISO/PAS 8800 AI Safety Assessment | $150,000 - $400,000 | 9-18 months |
| Comprehensive AV Safety Package (ISO 26262 + SOTIF + UL 4600) | $500,000 - $2,000,000+ | 18-36 months |

**Notes on Cost:**
- These are assessment/certification costs only, not development costs
- Companies typically allocate 10-15% of operational budget for regulatory compliance
- First-time certification is significantly more expensive than subsequent updates
- Scope (number of variants, ODD complexity) dramatically affects cost
- Personnel certification (e.g., TUV Functional Safety Engineer) costs $3,000-$5,000 per person

### Assessment Process (Typical)

1. **Scoping Meeting**: Define what is being assessed, applicable standards, timeline
2. **Gap Analysis**: Assessor reviews existing documentation against standard requirements
3. **Document Review**: Detailed review of safety case, risk assessments, test reports
4. **On-Site Assessment**: Physical inspection of vehicle, processes, facilities
5. **Testing**: Witness or conduct testing per applicable standards
6. **Findings Report**: Document conformities, non-conformities, observations
7. **Corrective Actions**: Address any non-conformities
8. **Certification Decision**: Issue certificate or assessment report
9. **Surveillance**: Annual or periodic follow-up assessments

---

## 12. Real Examples

### TractEasy (EasyMile + TLD)

**Company**: Joint venture between TLD (ground support equipment manufacturer) and EasyMile (autonomous technology provider).

**Products**: EZTow autonomous tow tractor, EZDolly autonomous cargo dolly.

**Safety and Certification Approach:**
- Compliant with ISO 13849-1 at Performance Level PLd
- CE-marked products meeting applicable European safety directives
- Follow ISO 3691-4 for driverless industrial trucks
- Follow ISO 12100 and ISO 13849-1 for machinery safety
- Apply ISO 26262 functional safety for road vehicle aspects
- Apply ISO 21448 (SOTIF) for intended functionality safety
- Proprietary safety chain with redundant braking, certified safety PLCs, continuous self-diagnostics
- EasyMile is ISO 9001:2015 certified
- Zero-collision record across 300+ deployments and 800,000+ autonomous miles

**Airport Deployments:**

| Airport | Status | Details |
|---------|--------|---------|
| Toulouse-Blagnac (France) | Operational since Nov 2022 | Level 4 autonomy (no onboard operator) since Nov 2023. Partner: Alyzia Group. Operates in all weather. |
| Changi (Singapore) | Deployed | Under CAAS regulatory framework |
| Narita (Japan) | Deployed | Partnership with airport corporation and Ministry of Land, Infrastructure, Transport and Tourism. Driverless with remote supervision. |
| Greenville-Spartanburg (USA) | Demonstration, paused | Started Sep 2024. FAA requested pause per CertAlert 24-02 due to absence of structured AV assessment process. Now re-engaging with FAA. |

**Regulatory Lessons Learned:**
- After deployment at Greenville-Spartanburg, the FAA "followed up with a letter demanding deployments stop because they did not know what was going on"
- No dedicated legal framework exists for AVs at airports; must navigate patchwork of general safety standards
- TractEasy now embraces FAA involvement, believing it will help set standards and provide consistent guidelines
- European deployments (Toulouse) have proceeded more smoothly due to existing CE marking and machinery regulation frameworks

### reference airside AV stack

**Company**: reference airside AV vendor plc, Coventry-based technology company specializing in autonomous aviation ground support equipment.

**Products**: autonomous cargo vehicle autonomous cargo vehicles, autonomous shuttle.

**Certification and Approval:**
- Obtained formal ground handling licence at East Midlands Airport (EMA) under the Airports (Ground Handling) Regulations 1997
- Licence issued in line with the Civil Aviation Authority's (CAA) compliance framework under the Civil Aviation Act 2012
- Licence permits operations at EMA until 30 June 2026
- Operating alongside UPS for cargo operations

**Deployment Details:**
- Two autonomous cargo vehicle vehicles and one autonomous shuttle deployed at EMA
- One-to-one support during roll-out and integration phases (safety operator present)
- Operating within EMA's established safety and operational governance
- Key stakeholders: David Keene (CEO), Lauren Turner (Head of Airfield Operations at EMA)

**Regulatory Approach:**
- Obtained licence under existing aviation ground handling regulations (not AV-specific regulations)
- Working within the CAA's established compliance framework
- Demonstrates that existing regulatory structures can accommodate autonomous operations when properly engaged
- The UK approach provides a more structured path than the US (where FAA has no formal process yet)

### Navya

**Company**: Navya (now Navya Mobility), French autonomous vehicle manufacturer. Filed for bankruptcy in 2023 but technology continues under new structure.

**Products**: Autonom Shuttle EVO, autonomous passenger shuttles.

**Airport Deployments:**

| Airport | Date | Details |
|---------|------|---------|
| JFK (New York) | Oct 2022 | Four-day platooning demonstration in parking area closed to public. Two shuttles. On-board safety operator at all times. Supervised by Navya control center in Michigan. |

**Certification Approach:**
- ISO 9001 certification obtained September 2021
- In-house certification department for regulatory compliance
- On-board safety operator present for all airport operations
- JFK demonstration was part of Port Authority of New York and New Jersey innovation call
- Testing conducted in controlled environment (closed parking area)

**Regulatory Lessons:**
- Navya's approach of starting with controlled demonstrations in non-public areas aligns with current FAA guidance
- On-board safety operators are still the standard expectation for airport shuttle deployments
- Airport authority partnership (PANYNJ) was key to obtaining testing permission

### Common Patterns Across All Examples

1. **No AV-specific airport certification exists**: Every deployment has used existing regulatory frameworks (machinery directives, ground handling regulations, airport operator partnerships)

2. **Progressive autonomy**: All deployments started with safety operators and progressively moved toward remote supervision (TractEasy at Toulouse is the most advanced, achieving operator-free Level 4)

3. **Non-movement areas first**: All initial deployments were on aprons, cargo areas, or parking areas -- not runways or taxiways

4. **Airport authority partnership is essential**: Success depends on close collaboration with airport operations teams

5. **CE marking / ISO 13849-1 is the baseline**: European deployments rely on existing machinery safety certification as the foundation

6. **Safety record matters**: EasyMile's zero-collision record across 800,000+ miles provides empirical evidence for safety claims

7. **Insurance is a practical requirement**: Special insurance policies are required for aircraft parking positions and ramp operations

---

## Certification Strategy for an Airport AV

Based on the analysis above, here is a recommended certification strategy:

### Phase 1: Foundation (Months 1-6)
- Conduct HARA per ISO 26262 and assign ASILs to all functions
- Define ODD per ISO 21448 (SOTIF)
- Identify all triggering conditions through systematic analysis
- Begin AMLAS Stage 1-2 for ML components
- Initiate ISO 3691-4 design compliance

### Phase 2: Development (Months 6-18)
- Design to ISO 13849-1 Performance Levels
- Implement safety architecture with ASIL decomposition
- Execute AMLAS Stages 3-5 (data, training, verification)
- Conduct simulation campaign (10,000+ scenarios)
- Apply ISO/PAS 8800 AI safety lifecycle

### Phase 3: Certification (Months 12-24)
- Compile Technical File for CE marking
- Engage Notified Body (TUV or equivalent) for ISO 3691-4 assessment
- Build UL 4600 safety case
- Conduct proving ground testing
- Begin safety case documentation in GSN

### Phase 4: Airport Integration (Months 18-30)
- Engage FAA/CAA early in planning
- Obtain airport authority partnership
- Conduct supervised field testing (1,000+ hours)
- Execute AMLAS Stage 6 (deployment assurance)
- Obtain ground handling licence or equivalent authorization

### Phase 5: Production Deployment (Months 24-36+)
- Achieve CE marking
- Obtain independent safety case assessment
- Transition from safety operators to remote supervision
- Establish post-deployment monitoring per ISO/PAS 8800
- Maintain and update safety case continuously

### Estimated Total Investment
- Safety certification activities: $500,000 - $2,000,000
- Testing infrastructure (simulation, proving ground): $200,000 - $1,000,000
- Third-party assessment fees: $200,000 - $500,000
- Personnel (safety engineers, test engineers): 4-8 FTEs for 2-3 years
- **Total**: $1,500,000 - $5,000,000+ depending on scope and complexity

---

## References and Resources

### Standards (Purchase Required)
- ISO 3691-4:2023 -- Driverless industrial trucks
- ISO 26262:2018 -- Functional safety of road vehicles
- ISO 21448:2022 -- Safety of the intended functionality (SOTIF)
- ISO/PAS 8800:2024 -- Road vehicles: Safety and artificial intelligence
- ISO 13849-1:2023 -- Safety-related parts of control systems
- ISO 12100:2010 -- Safety of machinery: General principles
- ANSI/UL 4600 Ed. 3 -- Safety for the evaluation of autonomous products

### Free Resources
- [AMLAS Guidance v1.1 (University of York)](https://www.york.ac.uk/media/assuring-autonomy/documents/AMLASv1.1.pdf)
- [UL 4600 Voting Draft (Free)](https://users.ece.cmu.edu/~koopman/ul4600/index.html)
- [FAA CertAlert 24-02](https://www.faa.gov/airports/airport_safety/certalerts/part_139_certalert_24_02)
- [FAA AGVS on Airports](https://www.faa.gov/airports/new_entrants/agvs_on_airports)
- [RAND Driving to Safety Study](https://www.rand.org/pubs/research_reports/RR1478.html)
- [GSN Community Standard](https://www.faa.gov/about/office_org/headquarters_offices/ang/redac/redac-sas-201503-gsn-community-standard-v1.pdf)
- [EasyMile Safety by Design](https://easymile.com/technology/safety-by-design)
- [ISO/PAS 8800 Overview (SGS)](https://www.sgs.com/en/news/2025/04/safeguards-04625-introducing-iso-pas-8800-functional-safety-for-ai-in-road-vehicles)
- [EU Machinery Regulation 2023/1230](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32023R1230)

### Key Organizations
- [TUV Rheinland -- AGV/AMR Certification](https://www.tuv.com/landingpage/en/new-mobility/main-navigation/automated-driving/)
- [TUV SUD -- Autonomous Driving Assessment](https://www.tuvsud.com/en-us/industries/mobility-and-automotive/automotive-and-oem/autonomous-driving)
- [UL Solutions -- AV Safety Advisory](https://www.ul.com/services/achieve-confidence-autonomous-vehicle-safety-ul-4600)
- [Applus+ -- AGV Compliance Testing](https://www.appluslaboratories.com/global/en/what-we-do/service-sheet/iso-3691-4-2023-compliance-testing-for-automated-guided-vehicles-agvs)
- [University of York -- Assuring Autonomy](https://www.assuringautonomy.com/amlas)
