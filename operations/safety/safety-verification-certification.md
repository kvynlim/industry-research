# Safety, Verification, Certification, and Formal Methods for AI/ML-Based Autonomous Vehicle Systems

**Research Report -- March 2026**

---

## Table of Contents

1. [Safety Standards for AV with ML](#1-safety-standards-for-av-with-ml)
2. [Aviation-Specific Safety Standards](#2-aviation-specific-safety-standards)
3. [Formal Verification of Neural Networks](#3-formal-verification-of-neural-networks)
4. [Safety Cases for Learned Models](#4-safety-cases-for-learned-models)
5. [Runtime Safety](#5-runtime-safety)

---

## 1. Safety Standards for AV with ML

### 1.1 ISO 26262 -- Functional Safety and the ML Gap

ISO 26262 ("Road vehicles -- Functional safety") is the foundational standard for automotive functional safety. It defines Automotive Safety Integrity Levels (ASIL A--D) and prescribes a V-model development lifecycle with requirements traceability, verification, and validation at every stage. Its core assumption is that safety-relevant behavior can be specified deterministically and that software can be verified against those specifications through code inspection, static analysis, and structural coverage.

**Why ISO 26262 conflicts with ML/neural networks:**

- **No deterministic specification.** Neural networks learn statistical mappings from data; there is no explicit requirement-to-code traceability.
- **No code-level inspection.** Weights in a trained network are not human-interpretable. Structural coverage metrics (MC/DC, statement coverage) are meaningless for a matrix of floating-point parameters.
- **No fault model.** ISO 26262 assumes faults arise from hardware random failures or systematic software defects. ML models can produce unsafe outputs without any "fault" -- they simply encounter inputs outside their training distribution.
- **Non-deterministic development.** Training is stochastic (random initialization, data shuffling, dropout). The same training pipeline can produce different models with different failure modes.

The standard is now being revised toward a third edition (work ongoing as of 2025-2026), with significant attention to how AI components can be accommodated. The 15th Anniversary Automotive Functional Safety Week (Munich, April 2025) focused on fine-tuning ISO 26262 updates and deep dives on ISO/PAS 8800 and ISO/DTS 5083.

### 1.2 ISO/PAS 8800 -- Safety and Artificial Intelligence in Road Vehicles

Published in December 2024, ISO/PAS 8800 ("Road vehicles -- Safety and artificial intelligence") is the most significant recent addition to the automotive safety standards landscape. It was developed by experts from 17 countries under ISO/TC22/SC32/WG14.

**Key contributions:**

- **AI safety lifecycle.** Introduces a lifecycle specifically for AI components, covering bias, prediction accuracy, robustness, and generalization capability.
- **Dual risk model.** Proposes that AI risks fall into two categories:
  - *Malfunctions* (addressed by tailoring ISO 26262-4, -6, and -8)
  - *Functional insufficiencies* (performance limitations, specification insufficiencies) addressed through extensions of ISO 21448 (SOTIF) concepts
- **Data quality requirements.** Explicit requirements for training data completeness, representativeness, and absence of bias.
- **Verification of AI elements.** Guidance on testing, robustness evaluation, and monitoring of AI components throughout the lifecycle.

ISO/PAS 8800 is designed to complement, not replace, ISO 26262 and ISO 21448. It provides the missing guidance for AI-specific risks that neither parent standard was designed to handle.

### 1.3 ISO 21448 -- SOTIF (Safety of the Intended Functionality)

ISO 21448 (published 2022) addresses hazards that arise not from system failures, but from limitations of the intended functionality -- precisely the class of risk that ML-based perception and prediction systems introduce.

**Core concepts:**

- **Known/unknown safe and unsafe scenarios.** SOTIF defines a four-quadrant model:
  - Known safe scenarios (validated, no risk)
  - Known unsafe scenarios (identified hazards with mitigations)
  - Unknown unsafe scenarios (the critical gap -- unidentified hazardous conditions)
  - Unknown safe scenarios (benign conditions not yet validated)
- **Residual risk reduction.** The goal is to shrink the "unknown unsafe" quadrant to an acceptable level through systematic scenario identification, simulation, and field testing.
- **Triggering conditions.** SOTIF introduces the concept of "triggering conditions" -- specific environmental or operational circumstances that cause the intended functionality to produce hazardous behavior (e.g., sun glare causing a camera-based perception system to miss an obstacle).

**Application to world models and neural networks:**

World models that predict future states of the environment are particularly susceptible to SOTIF-type failures. A world model may produce accurate predictions within its training distribution but generate physically implausible or dangerously incorrect predictions when encountering novel scenarios. SOTIF analysis for world models should focus on:

- Identifying triggering conditions where the world model's predictions diverge from reality
- Quantifying the impact of prediction errors on downstream planning decisions
- Systematic exploration of the unknown-unsafe quadrant through adversarial scenario generation

### 1.4 UL 4600 -- Evaluation of Autonomous Products

UL 4600, first published in April 2020 (second edition March 2022), is the first comprehensive standard designed specifically for evaluating the safety of autonomous products. Developed under the leadership of Philip Koopman (CMU), it takes a fundamentally different approach from process-based standards.

**Key characteristics:**

- **Safety case-based.** UL 4600 is not a process standard or a product construction standard. It prescribes topics that must be addressed in a safety case and evaluates whether the safety case is well-constructed.
- **Claim-based approach.** The standard defines a set of claims that must be supported by evidence and argumentation, covering:
  - Safety case construction methodology
  - Risk analysis
  - Design process safety aspects
  - Testing and validation
  - Tool qualification
  - Autonomy validation (including ML-based functionality)
  - Data integrity
  - Human-machine interaction
  - Lifecycle concerns and metrics
- **ML-specific provisions.** Explicitly addresses validation of ML-based functionality, practices for addressing "unknown unknowns," and reliability of ML hardware/software infrastructure.
- **No prescribed ASIL or SIL.** Instead of prescribing integrity levels, UL 4600 requires the safety case to demonstrate that the chosen approach is adequate for the risk.

UL 4600 is particularly well-suited for systems using world models because it allows the developer to construct a custom safety argument rather than forcing compliance with a fixed process that may not accommodate learned components.

### 1.5 IEEE 2846 -- Assumptions for AV Safety Models

IEEE 2846 (published 2022) defines a minimum set of reasonable assumptions about the behavior of other road users that must be considered when developing safety-related models for automated driving systems. It directly supports formal safety frameworks like RSS (see Section 3.5).

**Key provisions:**

- **Normative assumptions.** For scenarios including car-following, adjacent driving, intersections, and occlusion scenarios involving pedestrians and bicyclists, the standard defines minimum assumptions that an ADS must account for.
- **Informative attributes.** Defines attributes common to safety-related models and methods for verifying whether a model considers the normative assumptions.
- **Scope limitations.** Sources of uncertainty (prediction errors, perception errors) are explicitly out of scope -- the standard focuses on behavioral assumptions, not sensor fidelity.

### 1.6 PAS 1883 -- Operational Design Domain Taxonomy

PAS 1883 (BSI, 2020) provides a standardized taxonomy for specifying the Operational Design Domain (ODD) of an automated driving system, applicable to SAE Level 3 and Level 4 systems.

**Taxonomy structure:**

| Category | Description | Examples |
|---|---|---|
| **Scenery** | Geo-stationary elements | Road geometry, lane markings, signage, buildings |
| **Environment** | Atmospheric conditions | Weather, lighting, visibility |
| **Dynamic Elements** | Movable objects | Other vehicles, pedestrians, animals, debris |

PAS 1883 is being evolved into ISO 34503, which adds measurability requirements for environmental elements and a standardized format for ODD definition across the evaluation continuum (simulation, test track, public road).

**Relevance to world models:** A world model's training data and validation scenarios must be mapped to the ODD taxonomy to ensure coverage. If the world model is deployed outside its trained ODD (e.g., encountering weather conditions not represented in training data), the system must detect this and trigger appropriate fallback behavior.

---

## 2. Aviation-Specific Safety Standards

### 2.1 DO-178C -- Software Considerations in Airborne Systems

DO-178C is the primary standard for certification of software in airborne systems, recognized by the FAA, EASA, and Transport Canada. It defines five Design Assurance Levels (DAL A--E), with DAL A being the most critical (catastrophic failure condition).

**Core requirements:**

- Requirements-based development with full traceability
- Structural coverage analysis (MC/DC for DAL A)
- Code review and static analysis
- Deterministic, repeatable test execution
- Configuration management and problem reporting

**Fundamental incompatibility with ML:**

DO-178C assumes that software behavior can be fully specified, that code can be inspected against requirements, and that test coverage can be measured structurally. Neural networks violate all three assumptions. Current certification of ML in airborne systems is limited to low-criticality applications (DAL D or below), with active research into approaches for higher DAL levels.

**Emerging approaches:**

- **Traceable Machine Learning.** Companies like Intelligent Artifacts are developing DO-178C "cert-kits" for airborne ML, focusing on making the ML development process traceable and auditable.
- **Semi-automated certification.** NASA research proposes Assurance Profiles that consolidate evaluation outcomes for data validation, model validation, resilience assessment, and usability assurance.
- **Case studies.** Research teams have demonstrated verification of Deep Neural Networks (DNNs) for airport runway sign detection at DAL D to DAL B, applying DO-178C, ARP4754A, and prospective EASA/FAA guidelines.

### 2.2 DO-254 -- Design Assurance for Airborne Electronic Hardware

DO-254 establishes guidelines for hardware component safety in aviation, ensuring that electronic systems (flight control computers, avionics) meet strict reliability standards. For ML-based systems, DO-254 is relevant because:

- Neural network inference often runs on specialized hardware (GPUs, FPGAs, custom ASICs)
- Hardware-software interaction effects can alter inference results (numerical precision, timing)
- Inference hardware must meet the same DAL requirements as other safety-critical avionics

### 2.3 ARP4754A -- Development of Civil Aircraft and Systems

ARP4754A provides system-level development assurance guidelines, defining Functional Development Assurance Levels (FDAL) that flow down to Item Development Assurance Levels (IDAL) for software (DO-178C) and hardware (DO-254). The updated ARP4754B continues to evolve these guidelines.

**Key role in ML certification:**

ARP4754A sits at the top of the certification hierarchy. For an ML-based system to be certified, the system-level safety assessment (per ARP4754A) must:

1. Identify the ML component's contribution to each aircraft function
2. Assign appropriate FDALs/IDALs based on the failure condition severity
3. Flow down safety requirements to the ML component
4. Verify that the ML component satisfies those requirements (which is where the gap lies)

### 2.4 Airside Ground Vehicles -- Between Automotive and Aviation Certification

Autonomous ground vehicles operating on airport airside represent a unique regulatory gap: they operate in an aviation-controlled environment but are ground vehicles, not aircraft.

**Current FAA position (CertAlert 24-02, 2024):**

- The FAA has **not authorized** AGVS deployment at Part 139 certified airports or federally obligated airports for unrestricted use.
- Testing is supported only in **controlled environments**: non-movement areas such as aprons, aircraft gate areas, parking areas, remote areas, and landside areas.
- **Movement areas, safety areas, and object-free areas** are explicitly excluded from "controlled environments."
- A **human monitor** must be physically located in or near the AGVS when operating around moving aircraft and airport employees/vehicles.
- Airport sponsors must coordinate with their regional FAA Airport Certification and Safety Inspector before any testing.

**Safety requirements for airside AGVS:**

| Requirement | Detail |
|---|---|
| Collision avoidance | Must detect and respond to aircraft, vehicles, and personnel |
| Communication | Integration with airport ops and ATC coordination required |
| Failure modes | Safe shutdown procedures must be tested and validated |
| Weather limitations | Sensor capability constraints must be documented |
| Personnel training | Airport staff must be familiarized with AGVS operations |
| Monitoring | Continuous oversight mechanisms required during deployment |

**Regulatory implications for world model-based systems:**

An airside AV using a world model for perception/prediction faces a dual certification challenge:

1. **Automotive-adjacent:** The vehicle itself may need to satisfy ISO 26262/SOTIF-type requirements for functional safety
2. **Aviation-adjacent:** The operating environment is governed by FAA regulations, and any interaction with aircraft or runway safety areas invokes aviation safety standards
3. **Gap area:** No single standard covers this intersection comprehensively. A safety case approach (per UL 4600) may be the most viable path, supplemented by compliance with applicable portions of both automotive and aviation standards.

### 2.5 EASA AI Roadmap and Certification Approach

EASA has published the most detailed regulatory framework for AI in aviation of any certification authority worldwide.

#### 2.5.1 AI Roadmap 2.0

The EASA AI Roadmap 2.0 defines three levels of AI applications:

| Level | Description | Timeline |
|---|---|---|
| **Level 1** | Human assistance -- AI assists human decision-making | Guidance published 2021; first applications foreseen 2025 |
| **Level 2** | Human-AI teaming -- AI makes decisions under human oversight | Guidance published 2023 (Concept Paper Issue 2) |
| **Level 3** | Advanced automation -- AI operates with high autonomy | Guidance for consultation in 2025; consolidation by 2028 |

#### 2.5.2 The W-Shaped Process Model

The most significant technical contribution from EASA is the **W-shaped development process** for ML components, developed jointly with Daedalean (published in the CoDANN reports). This extends the traditional V-model used in DO-178C.

**W-shaped process phases:**

```
Requirements -----.                                    .---- Requirements Verification
                   \                                  /
  Data Design ----. \                              / .---- Data Management Validation
                   \ \                            / /
Learning Process    \ \     Model Training      / /    Inference Model Verification
    Design --------. \ \       (valley)       / / .---- Learning Verification
                     \_\_\___________________/_/_/
```

The three descending branches of the "W" are:

1. **Data Assurance**
   - Data collection and labeling with full traceability
   - Distribution validity: sufficient volume, absence of bias, real-world correspondence, edge-case coverage
   - Dataset independence: training, validation, and test datasets must remain strictly separate
   - Verification that data have been managed correctly throughout the lifecycle

2. **Learning Assurance**
   - Selection of training methodologies aligned with safety requirements
   - Definition of evaluation metrics connected to operational safety requirements
   - Iterative model refinement with documented rationale
   - Model freezing only after test results satisfy all metrics
   - Once frozen, the model becomes deterministic and immutable

3. **Inference Assurance**
   - Verification that the deployed model retains training-phase properties on actual hardware
   - Computational constraints (memory, processing limits) must not degrade model performance
   - Real-world operational conditions must maintain specified safety margins

#### 2.5.3 AI Trustworthiness Framework

EASA's concept papers establish four building blocks for AI trustworthiness:

1. **Learning Assurance** -- equivalent to software assurance for ML
2. **AI Explainability** -- appropriate transparency for the intended audience (developer, certifier, operator, end user)
3. **AI Safety Risk Assessment** -- extending ARP4761/ARP4761A safety assessment to AI components
4. **Ethics-Based Assessment** -- addressing societal and ethical implications

#### 2.5.4 ForMuLA (Formal Methods use for Learning Assurance)

EASA has commissioned the ForMuLA project to investigate how formal methods can be applied to neural network verification in the context of learning assurance, bridging the gap between traditional formal verification (as used in DO-178C) and the statistical nature of ML.

#### 2.5.5 Regulatory Timeline

- **NPA 2025-07:** Technical guidance for AI trustworthiness aligned with the EU AI Act
- **Second NPA (2026):** Deploy the generic framework to specific aviation domain regulations
- **Consolidation (2028):** Finalization of EASA AI/ML policy

---

## 3. Formal Verification of Neural Networks

### 3.1 Neural Network Verification Tools

Neural network verification aims to provide formal guarantees about network behavior: given a specification of allowed inputs and required outputs, can we prove that the network satisfies the specification for all inputs in the allowed set?

#### 3.1.1 Marabou 2.0

Marabou is an SMT-based neural network verification framework developed at Stanford and Hebrew University. Marabou 2.0 (published 2024) represents a major architectural overhaul.

**Architecture:**

- **Engine:** Central satisfiability checker for linear and non-linear constraint sets
- **Preprocessor:** Query normalization
- **SMT Solver:** Lazy-DPLL(T)-based case analysis on piecewise-linear constraints
- **Network-level Reasoner:** Abstract interpretation techniques
- **LP/MILP Interface:** External solver integration

**Verification algorithm (DeepSoI):**

The default solving strategy extends sum-of-infeasibilities methods from convex optimization. It formulates a cost function representing constraint violations and uses stochastic minimization with provable convergence guarantees.

**Supported activation functions:**

- Piecewise-linear: ReLU, Max, DNF, Sign, Absolute value, Leaky ReLU
- Transcendental: Sigmoid, Tanh
- Specialized: Round, Clip, Softmax, Bi-linear

**Abstract interpretation techniques (7 analyses):**

1. Interval bound propagation
2. Symbolic bound propagation
3. DeepPoly/CROWN analysis (default)
4. LP-based bound tightening
5. Forward-backward analysis
6. MILP-based bound tightening
7. Iterative propagation

**Proof production:** Generates UNSAT proof certificates based on constructive Farkas lemma variants. Successfully certified 113 of 180 ACAS-Xu benchmarks with over 1.46 million proof-tree leaves, of which >99.99% were validated.

**Performance:** 2x speedup on 56% of benchmarks, 10x speedup on 34%, median memory usage reduced from 604MB to 59MB versus prior version. Achieved second place in VNN-COMP 2023, highest among CPU-based verifiers.

#### 3.1.2 alpha-beta-CROWN

alpha-beta-CROWN is a GPU-accelerated neural network verifier that has won the International Verification of Neural Networks Competition (VNN-COMP) every year from 2021 through 2025. It implements bound propagation with optimizable parameters (alpha for split neuron relaxation, beta for branch-and-bound).

**Key advantages:**

- GPU acceleration enables verification of significantly larger networks than CPU-based tools
- Consistently ranked top-1 across all scored benchmarks in VNN-COMP 2025
- In the 2025 competition (6th edition), 8 teams participated on 16 regular and 9 extended benchmarks

**Competitive landscape (VNN-COMP 2025):**

| Tool | Approach | Notable Features |
|---|---|---|
| alpha-beta-CROWN | GPU-accelerated bound propagation | Winner 2021--2025 |
| Marabou 2.0 | SMT-based, CPU | Best CPU-based verifier; proof production |
| NeuralSAT | SAT-based | Consistently top performer |
| MN-BaB | Multi-neuron bound | Branch-and-bound with multi-neuron constraints |
| ERAN | Abstract interpretation | ETH Zurich, DeepPoly/DeepZ |

#### 3.1.3 Other Notable Tools

- **ERAN (ETH Robustness Analyzer for Neural Networks):** Uses DeepPoly and DeepZ abstract domains for certification.
- **KeYmaera X:** Differential dynamic logic theorem prover used for proving collision-freedom of neural network-controlled vehicles on infinite time horizons.
- **Verisig:** Verification of neural network controllers in closed-loop systems with plant dynamics.

### 3.2 Certified Robustness

Certified robustness provides provable guarantees that a neural network's output will not change under bounded input perturbations.

**Key approaches:**

1. **Randomized smoothing.** Constructs a smoothed classifier by averaging predictions over Gaussian noise. Provides probabilistic certified radii for L2-norm perturbations. Scalable to large networks but limited to L2 perturbations.

2. **Interval bound propagation (IBP).** Propagates interval bounds through network layers to compute guaranteed output ranges. Fast but often loose bounds.

3. **CROWN/DeepPoly.** Computes tighter linear relaxation bounds by propagating symbolic constraints. Foundation of alpha-beta-CROWN.

4. **Probably Approximately Correct (PAC) bounds.** Recent frameworks derive PAC bounds by solving scenario convex programs, yielding confidence lower bounds on certified robustness radii that generalize beyond the training set.

**Application to autonomous driving:**

- Certified defenses for image classifiers can provide lower-bound accuracy guarantees against adversarial perturbations
- Multi-sensor fusion perception models have achieved certified accuracy >60% against multi-source attacks
- Point cloud (LiDAR) certified robustness remains challenging due to the sparse, irregular structure of 3D data

**Three evaluation dimensions for certified defenses:**

1. Clean accuracy (performance without perturbation)
2. Certified accuracy (provably robust accuracy under perturbation)
3. Computational overhead (inference time increase)

### 3.3 Runtime Monitoring and Safety Envelopes

Rather than verifying the entire neural network offline (which is computationally intractable for large networks), runtime monitoring checks the network's behavior during operation and triggers safety interventions when violations are detected.

**Safety envelope concept:**

A safety envelope defines a region of the state space within which the system is guaranteed to be recoverable by a safety controller. The envelope is computed offline using formal methods (e.g., Lyapunov analysis, reachability analysis) and checked at runtime.

**Runtime verification with differential dynamic logic:**

Recent work (KeYmaera X) has demonstrated formal safety proofs for autonomous cars with neural network controllers, proving collision-freedom on infinite time horizons. The runtime monitor assigns the safety formula's variables with the implementation's input/output values and verifies compliance at each control step. If the implementation violates the safety formula, a verified fallback controller overrides the action.

### 3.4 Simplex Architecture

The Simplex architecture is a well-established safety pattern that combines a high-performance (but potentially unsafe) controller with a high-assurance (but potentially conservative) safety controller.

**Architecture components:**

```
                    +-----------------------+
                    |    Safety Monitor     |
                    |   (Decision Module)   |
                    +---+---------------+---+
                        |               |
              Safe? --> |               | <-- Unsafe?
                        v               v
              +----------------+  +------------------+
              |  Advanced      |  |  Baseline         |
              |  Controller    |  |  Controller        |
              |  (neural net)  |  |  (formally verified)|
              +----------------+  +------------------+
                        |               |
                        v               v
                    +-----------------------+
                    |        Plant          |
                    +-----------------------+
```

**Switching logic:**

- **Forward switch** (Advanced to Baseline): Triggered when the safety monitor detects that the system state is approaching the boundary of the safety envelope (Region of Asymptotic Attraction).
- **Reverse switch** (Baseline to Advanced): Only occurs when the state returns to a more restrictive safe subset within the envelope, preventing oscillatory switching (hysteresis).

**Experimental validation:**

- Inverted pendulum: Neural network controller (128 hidden neurons, CMA-ES trained) with end-to-end latency 288.6--3975.7 microseconds. Successful recovery from disturbances through switching.
- AgileX Scout Mini rover: DDPG-trained DNN, completed 20m corridor navigation without collisions, responded to sudden obstacles within 100ms, maintained safety under simulated cyber-attacks. Inter-domain communication overhead: >99% of messages in <=10 microseconds.

**Dynamic Simplex (recent advancement):**

A two-way switching strategy using a combination of:
- Myopic selector with surrogate models (forward switch)
- Non-myopic planner (reverse switch)

This balances safety and performance more effectively than static switching thresholds.

### 3.5 Responsibility-Sensitive Safety (RSS)

RSS, proposed by Mobileye (Prof. Amnon Shashua) in 2017, is a mathematically rigorous safety model that formalizes human driving norms into verifiable rules.

**The five RSS rules:**

1. **Safe longitudinal distance.** Formalize minimum following distance; when violated, the AV must brake until safe distance is restored or the vehicle stops.
2. **Safe lateral distance.** Formalize safe lateral margins; the AV must be aware when lateral safety is compromised by other drivers.
3. **Right of way.** Formalize negotiation at intersections and priority scenarios so machines arrive at the same conclusions as competent human drivers.
4. **Caution around limited visibility.** Require conservative behavior when occluded areas may contain road users.
5. **Avoidability and responsibility.** If a dangerous situation is imposed so suddenly that collision is unavoidable without violating traffic rules, the AV must minimize harm while following rules 1--4 as closely as possible.

**Key properties:**

- **Formally verifiable.** Each rule is expressed as a mathematical formula that can be checked at runtime.
- **Technology-neutral.** RSS does not prescribe how the AV perceives or plans; it only constrains the output actions.
- **Open and transparent.** Published as an open standard; adopted by Baidu Apollo; referenced by IEEE 2846.
- **Implemented.** Intel/Mobileye provides an open-source C++ library (`ad-rss-lib`) implementing the RSS model.

**Relevance to world model-based systems:**

RSS can serve as a safety layer on top of any planning system, including world model-based planners. The world model generates predicted future states, the planner generates candidate actions, and RSS checks whether each candidate action satisfies the five rules before it is executed. Actions that violate RSS constraints are rejected, and the system falls back to a safe response (typically braking or maintaining current trajectory).

---

## 4. Safety Cases for Learned Models

### 4.1 GSN (Goal Structuring Notation) for ML-Based Systems

Goal Structuring Notation is a graphical argument notation developed at the University of York in the 1990s. It is widely used in safety-critical industries (nuclear, defense, rail, automotive) for documenting safety cases.

**GSN elements:**

| Element | Symbol | Description |
|---|---|---|
| **Goal** | Rectangle | A claim about safety that must be supported |
| **Strategy** | Parallelogram | The approach used to decompose a goal |
| **Solution** | Circle | Evidence supporting a goal (test reports, analysis results) |
| **Context** | Rounded rectangle | Contextual information (assumptions, definitions) |
| **Assumption** | Ellipse with "A" | An explicit assumption underlying the argument |
| **Justification** | Ellipse with "J" | Rationale for why a strategy is appropriate |

**Application to ML-based systems:**

A neural network safety case in GSN typically follows this structure:

```
G1: "The ML component is acceptably safe for its intended function"
  |
  S1: "Argue over ML lifecycle stages"
  |
  +-- G1.1: "Training data is sufficient and representative"
  |     |-- Sn1: Data coverage analysis report
  |     |-- Sn2: Distribution analysis vs ODD
  |
  +-- G1.2: "Model performance meets safety requirements"
  |     |-- Sn3: Test results on independent test set
  |     |-- Sn4: Robustness evaluation results
  |
  +-- G1.3: "Model behavior is monitored at runtime"
  |     |-- Sn5: Runtime monitor specification
  |     |-- Sn6: Fallback controller verification
  |
  +-- G1.4: "Residual risks are acceptable"
        |-- Sn7: SOTIF analysis results
        |-- Sn8: Field operational data
```

Recent research has explored using LLMs (e.g., GPT-4) to generate GSN safety cases, including for ML-enabled automotive components. While LLMs can produce structurally valid GSN arguments, expert review remains essential for ensuring the arguments are sound and the evidence is sufficient.

### 4.2 AMLAS (Assurance of Machine Learning for Autonomous Systems)

AMLAS, developed by the Assuring Autonomy International Programme at the University of York, is the world's first comprehensive methodology for safety assurance of ML components in autonomous systems.

**Six stages:**

| Stage | Focus | Key Outputs |
|---|---|---|
| **1. ML Safety Assurance Scoping** | Define scope and context for ML safety assurance | System-level safety requirements; ML component boundaries |
| **2. ML Safety Requirements Elicitation** | Derive safety requirements for the ML component | ML-specific safety requirements; performance metrics |
| **3. Data Management** | Assure the datasets used for training, validation, testing | Data requirements; distribution analysis; coverage arguments |
| **4. Model Learning** | Assure the training process and resulting model | Training methodology justification; model selection rationale |
| **5. Model Verification** | Verify the ML model against safety requirements | Verification results; robustness evidence; edge case analysis |
| **6. Model Deployment** | Assure safe integration and ongoing operation | Integration test results; runtime monitoring specification |

**Key properties of AMLAS:**

- Uses **GSN** for all safety case patterns
- Activities are performed **in parallel** with ML development (not as a separate post-hoc exercise)
- The process is **iterative** -- each stage can trigger reconsideration of earlier stages
- Has been applied in **healthcare, automotive, aerospace, and defense**
- A **Microsoft Visio prototype tool** enables systematic progression through stages and automatic safety case generation
- An **Agile variant (AgileAMLAS)** has been developed for iterative development environments

### 4.3 SOTIF Analysis for World Models

Applying SOTIF (ISO 21448) analysis to world models requires addressing the unique failure modes of learned dynamics models.

**World model-specific triggering conditions:**

| Triggering Condition | Example | Impact |
|---|---|---|
| **Distribution shift** | Weather/lighting not in training data | Physically implausible predictions |
| **Compounding errors** | Multi-step rollouts accumulating error | Divergent predicted trajectories |
| **Rare event under-representation** | Emergency vehicles, construction zones | Failure to predict critical obstacles |
| **Sensor degradation** | Rain on camera, LiDAR reflections | Corrupted input to world model |
| **Dynamic object interaction** | Novel multi-agent behaviors | Incorrect interaction predictions |

**SOTIF analysis process for world models:**

1. **Functional specification.** Define what the world model is intended to predict (object positions, velocities, road geometry, free space).
2. **Performance limitation identification.** Catalog known limitations (prediction horizon, spatial resolution, supported object classes).
3. **Triggering condition analysis.** Systematically identify conditions that cause predictions to become unsafe.
4. **Risk evaluation.** Assess the severity and probability of hazards arising from prediction errors.
5. **Mitigation.** Design mitigations (runtime monitoring, confidence thresholds, fallback behaviors) and demonstrate residual risk reduction.

### 4.4 Arguing Safety of World Model-Based Planning

A safety case for a world model-based planning system must address several unique challenges that do not arise in traditional rule-based or optimization-based planners.

**Top-level safety argument structure:**

```
G0: "The world model-based planning system is acceptably safe within the defined ODD"
  |
  S0: "Argue over system architecture, world model assurance, and runtime protection"
  |
  +-- G1: "The ODD is completely and correctly specified" (PAS 1883 / ISO 34503)
  |
  +-- G2: "The world model produces sufficiently accurate predictions within the ODD"
  |     +-- G2.1: "Training data covers the ODD"
  |     +-- G2.2: "Model accuracy meets quantified safety requirements"
  |     +-- G2.3: "Prediction uncertainty is correctly calibrated"
  |
  +-- G3: "The planner generates safe actions given world model predictions"
  |     +-- G3.1: "Planner satisfies RSS/formal safety constraints"
  |     +-- G3.2: "Planner accounts for prediction uncertainty"
  |
  +-- G4: "Runtime monitoring detects unsafe conditions"
  |     +-- G4.1: "OOD inputs are detected and flagged"
  |     +-- G4.2: "World model prediction errors are bounded at runtime"
  |     +-- G4.3: "Fallback behavior is triggered before unsafe states are reached"
  |
  +-- G5: "Residual risk is acceptable"
        +-- G5.1: "SOTIF analysis demonstrates sufficient scenario coverage"
        +-- G5.2: "Field operational test data supports safety claims"
```

**Recent developments (2025-2026):**

- **RAISE methodology** (assuRance of vlA-based drIving SystEms) proposes safety case patterns specifically for vision-language-action (VLA) autonomous driving systems using GSN, extending HARA to include "Safe Events" alongside hazardous events.
- **SafeDrive Dreamer** integrates world models with constrained Markov decision processes (CMDP) and safety reinforcement learning to ensure safety-aware planning.
- **Dynamic safety cases** are emerging as a concept where the safety argument is continuously updated based on operational data, rather than being a static document created at design time.

### 4.5 Operational Design Domain (ODD) Specification

The ODD defines the complete set of conditions under which an autonomous system is designed to operate safely. For world model-based systems, the ODD specification must be particularly precise because the world model's accuracy is inherently bounded by its training data distribution.

**ODD specification requirements (per PAS 1883 / ISO 34503):**

1. **Scenery attributes:** Road types, lane configurations, intersection types, signage, infrastructure
2. **Environmental attributes:** Weather (rain, snow, fog, sun position), lighting (day, night, dusk, dawn, artificial), visibility range
3. **Dynamic element attributes:** Traffic density, vehicle types, pedestrian density, cyclist presence, animal presence

**Mapping ODD to world model training data:**

For each ODD attribute, the safety case must demonstrate:
- The training data includes representative samples
- The distribution of training data matches the expected operational distribution
- Edge cases at ODD boundaries are adequately covered
- The system can detect when it is operating outside the ODD

---

## 5. Runtime Safety

### 5.1 Safety Monitors and Fallback Controllers

Runtime safety monitors are the last line of defense in an autonomous system, continuously checking system behavior against safety constraints and triggering interventions when violations are detected or imminent.

**Monitoring architecture layers:**

| Layer | What is Monitored | Response |
|---|---|---|
| **Input monitoring** | Sensor data quality, distribution shift | Flag degraded inputs; increase uncertainty estimates |
| **Perception monitoring** | Object detection consistency, tracking coherence | Flag unreliable detections; use conservative assumptions |
| **Prediction monitoring** | World model output plausibility, confidence | Flag uncertain predictions; widen safety margins |
| **Planning monitoring** | Action compliance with safety constraints (RSS) | Reject unsafe actions; use safety controller |
| **System monitoring** | Hardware health, latency, resource usage | Trigger degraded mode or safe stop |

**Dependability cage architecture:**

The dependability cage concept combines onboard runtime monitoring with off-board monitoring through a remote command control center. The cage continuously monitors:

1. The system's ODD compliance
2. Perception component output consistency (via redundant sensor channels)
3. Planning output safety compliance

When the cage detects a violation, it initiates graceful transfer of control to either a simpler onboard safety controller or a remote human operator.

**Certified Control architecture (MIT):**

A safety architecture where the safety monitor formally verifies that each proposed control action is safe using a clearance envelope. If the proposed action violates the envelope, the monitor switches to a deterministic, formally verified controller.

### 5.2 Out-of-Distribution Detection

OOD detection identifies inputs that are fundamentally different from the training data distribution, where the neural network's outputs cannot be trusted.

**Detection approaches:**

1. **Input-space methods:**
   - Reconstruction-based: Autoencoders trained on in-distribution data; high reconstruction error indicates OOD
   - Density estimation: Normalizing flows or variational autoencoders modeling the training distribution
   - Distance-based: Mahalanobis distance from class-conditional distributions in feature space

2. **Hidden-layer monitoring (Henzinger et al.):**
   - Monitor neuron activations in hidden layers during inference
   - Use hyperrectangles for each neuron capturing the range of activation values observed during training
   - Flag inputs as OOD if activations fall outside the hyperrectangles

3. **Output-space methods:**
   - Maximum softmax probability (baseline)
   - Energy-based scoring
   - ODIN (Out-of-Distribution detector for Neural networks)

4. **Ensemble-based methods:**
   - Deep ensembles: Multiple independently trained models; high prediction disagreement indicates OOD
   - MC-Dropout: Monte Carlo dropout approximates Bayesian uncertainty; high variance indicates OOD

**Limitations of OOD detection:**

- OOD detection is necessary but not sufficient for safety: an input may be OOD but still produce correct outputs, or be in-distribution but trigger a rare failure mode
- False positive rates can be high, leading to unnecessary fallback activations
- Latency requirements for real-time detection constrain the complexity of detection methods

### 5.3 Confidence Calibration for World Model Predictions

A well-calibrated world model assigns prediction confidence scores that accurately reflect the true probability of the prediction being correct. This is critical for safety because downstream planners must adjust their behavior based on prediction uncertainty.

**Calibration approaches:**

1. **Deep ensembles:** Multiple independently trained world models; prediction mean provides the forecast, prediction variance provides uncertainty. Demonstrated performance gains as an uncertainty calibration method for planning.

2. **Variational autoencoders (VAE) with recurrent predictors:** Forecast future latent trajectories from raw image sequences and estimate safety property satisfaction probabilities with calibrated confidence.

3. **Belief functions (Dempster-Shafer theory):** Achieve superior uncertainty calibration compared to softmax probabilities, enabling integration into vehicle control pipelines where uncertainty dynamically modulates vehicle speed.

4. **Temperature scaling:** Post-hoc calibration technique that scales logits by a learned temperature parameter. Simple and effective for classification networks.

5. **Conformal prediction:** Distribution-free calibration that provides finite-sample coverage guarantees. Produces prediction sets that contain the true outcome with a specified probability.

**Integration with planning:**

Calibrated uncertainty from world models can be used to:
- Dynamically adjust safety margins (wider margins when uncertainty is high)
- Modulate vehicle speed (reduce speed in uncertain scenarios)
- Trigger fallback behaviors when confidence falls below thresholds
- Select among multiple candidate trajectories based on worst-case uncertainty

### 5.4 Graceful Degradation Strategies

Graceful degradation ensures that when the autonomous system encounters conditions beyond its capability, it transitions to progressively safer (though potentially less performant) modes rather than failing catastrophically.

**Degradation hierarchy for a world model-based AV:**

```
Level 0: Full autonomy (world model + learned planner)
   |
   v  [Trigger: OOD detection, low confidence, sensor degradation]
Level 1: Restricted autonomy (conservative planner, wider safety margins)
   |
   v  [Trigger: Persistent OOD, world model prediction errors exceed threshold]
Level 2: Minimal risk condition (reduce speed, move to safe location)
   |
   v  [Trigger: Safety-critical system failure, loss of perception]
Level 3: Safe stop (controlled deceleration to standstill)
   |
   v  [Trigger: Communication failure during teleoperation]
Level 4: Emergency stop (immediate braking)
```

**Design principles:**

- Each degradation level must be **independently safe** -- the system must not pass through an unsafe state during transitions
- **Hysteresis** prevents oscillation between levels (require sustained recovery before upgrading)
- **Time budgets** ensure that higher degradation levels are reached before the system enters an unrecoverable state
- The degradation strategy must be **testable and verifiable** as part of the safety case

### 5.5 Human-in-the-Loop / Teleoperation Fallback

Teleoperation provides a human fallback for situations where the autonomous system cannot safely continue operating independently.

**Teleoperation modes:**

| Mode | Description | Latency Tolerance |
|---|---|---|
| **Remote driving** | Full real-time control by remote operator | <100ms (critical) |
| **Remote assistance** | Operator provides waypoints or path; vehicle executes autonomously | 1-5 seconds |
| **Remote supervision** | Operator monitors and intervenes only when needed | Seconds to minutes |

**Key challenges:**

1. **Sensory deprivation.** Teleoperators depend on limited visual and audio feeds, potentially missing environmental cues (flat tires, approaching emergency vehicles, surface conditions).
2. **Network latency.** Variable time delay degrades control quality. Systems must continuously monitor latency and trigger autonomous fallback (emergency braking) when delay exceeds thresholds.
3. **Bandwidth degradation.** When bandwidth drops, video resolution and frame rate must be reduced; if degradation persists, the fallback controller brings the vehicle to a controlled halt.
4. **Situational awareness.** Remote operators lack the vestibular and proprioceptive feedback that on-board drivers use for vehicle state estimation.

**Teleoperation as a deployment accelerator:**

Rather than viewing teleoperation as merely a safety net, industry increasingly treats it as a core operational component that enables deployment of autonomous systems before they achieve full autonomy. It provides a controlled means to handle edge cases while maintaining service continuity, and generates valuable training data for improving the autonomous system.

**Network resilience architecture:**

```
Autonomous Vehicle                    Remote Command Center
+------------------+                  +-------------------+
| Perception       |  Video/LiDAR     | Display System    |
| World Model      | =============>  | Remote Operator   |
| Safety Monitor   |  <latency check> | Control Interface |
| Fallback Ctrl    | <============   |                   |
+------------------+  Commands        +-------------------+
       |
       v
[If latency > threshold OR link lost]
       |
       v
Autonomous fallback: controlled stop
```

---

## Summary of Standards Landscape

| Standard | Domain | Focus | ML Coverage |
|---|---|---|---|
| ISO 26262 | Automotive | Functional safety (faults) | Inadequate; assumes deterministic software |
| ISO 21448 (SOTIF) | Automotive | Safety of intended functionality | Addresses ML limitations indirectly |
| ISO/PAS 8800 | Automotive | AI safety lifecycle | Purpose-built for AI; complements 26262 + 21448 |
| ISO/TS 5083 | Automotive | ADS safety design/V&V | Includes AI/ML annex |
| UL 4600 | Autonomous products | Safety case evaluation | Explicitly addresses ML validation |
| IEEE 2846 | Automotive | AV behavioral assumptions | Supports formal safety models (RSS) |
| PAS 1883 / ISO 34503 | Automotive | ODD specification | Framework for ML training data mapping |
| DO-178C | Aviation | Airborne software | Fundamentally incompatible; extensions underway |
| DO-254 | Aviation | Airborne hardware | Relevant for inference hardware |
| ARP4754A | Aviation | System-level assurance | Top of certification hierarchy |
| EASA AI Roadmap | Aviation | AI certification framework | W-shaped process; most advanced regulatory framework |

---

## Key Recommendations for World Model-Based Autonomous Systems

1. **Adopt a safety case approach (UL 4600 / GSN).** Given the gap between existing prescriptive standards and the reality of ML-based systems, a structured safety argument is the most viable path to demonstrating safety.

2. **Apply AMLAS methodology.** Integrate safety assurance into the ML development lifecycle from the start, not as a post-hoc exercise.

3. **Implement the Simplex architecture.** Pair the world model-based planner with a formally verified safety controller. Use RSS constraints as the safety envelope.

4. **Build comprehensive runtime monitoring.** Layer OOD detection, confidence calibration, and safety envelope checking to provide defense in depth.

5. **Design for graceful degradation.** Define explicit degradation levels with independently verifiable safety at each level. Include teleoperation as a fallback for airside operations.

6. **Map training data to ODD.** Use PAS 1883 / ISO 34503 taxonomy to ensure training data coverage matches the intended operational domain.

7. **Invest in formal verification of safety-critical components.** Use tools like Marabou or alpha-beta-CROWN for verifying safety-critical sub-networks; use KeYmaera X or similar for proving properties of the closed-loop system with the safety controller.

8. **Follow EASA's W-shaped process.** Even for non-aviation applications, the data assurance / learning assurance / inference assurance framework provides a rigorous structure for ML component development.

9. **Perform SOTIF analysis.** Systematically identify triggering conditions for world model failures and demonstrate that the unknown-unsafe scenario space has been reduced to an acceptable level.

10. **For airside operations, engage regulators early.** The FAA's CertAlert 24-02 requires coordination before any AGVS testing. The dual automotive/aviation regulatory requirement means no single standard provides complete coverage.

---

## Sources

### Section 1 -- Safety Standards for AV with ML
- [An Analysis of ISO 26262: Using Machine Learning Safely in Automotive Software](https://www.researchgate.net/publication/319622647_An_Analysis_of_ISO_26262_Using_Machine_Learning_Safely_in_Automotive_Software)
- [Rethinking AV Functional Safety: SOTIF and ISO 26262](https://www.automotive-iq.com/autonomous-drive/articles/rethinking-autonomous-vehicle-functional-safety-standards-an-analysis-of-sotif-and-iso-26262)
- [Introducing ISO/PAS 8800 -- Functional Safety for AI in Road Vehicles (SGS)](https://www.sgs.com/en/news/2025/04/safeguards-04625-introducing-iso-pas-8800-functional-safety-for-ai-in-road-vehicles)
- [ISO/PAS 8800:2024 (ISO)](https://www.iso.org/standard/83303.html)
- [Safety-Related Systems with AI: ISO/PAS 8800 (UL Solutions)](https://www.ul.com/sis/blog/safety-related-systems-road-vehicles-artificial-intelligence-are-addressed-isopas-88002024)
- [The Collision: Why ISO 26262 and AI Are at Odds (Medium)](https://medium.com/@ashishrai12_23721/the-collision-why-iso-26262-and-ai-are-at-odds-in-autonomous-driving-9728b6a015a3)
- [ISO 26262 and AI/ML System Safety Assessment (Hermes Solution)](https://www.hermessol.com/2025/02/07/blog_250201/)
- [Navigating SOTIF ISO 21448 (Automotive IQ)](https://www.automotive-iq.com/functional-safety/articles/navigating-sotif-iso-21448-and-ensuring-safety-in-autonomous-driving)
- [What is SOTIF? (Visure Solutions)](https://visuresolutions.com/automotive/iso-21448/)
- [UL 4600: Standard for Safety for the Evaluation of Autonomous Products (CMU)](https://users.ece.cmu.edu/~koopman/ul4600/index.html)
- [What Is UL 4600? (Perforce)](https://www.perforce.com/blog/qac/what-is-ul-4600)
- [UL 4600: Autonomous Vehicle Safety Standard (Intertek)](https://www.intertek.com/automotive/ul-4600/)
- [IEEE 2846 Standard (IEEE)](https://standards.ieee.org/ieee/2846/10831/)
- [IEEE Standard Will Make AVs Safer (IEEE Spectrum)](https://spectrum.ieee.org/ieee-standard-for-autonomous-vehicles)
- [PAS 1883:2020 ODD Taxonomy (BSI)](https://www.bsigroup.com/globalassets/localfiles/en-gb/cav/pas1883.pdf)

### Section 2 -- Aviation-Specific Safety Standards
- [DO-178C (Wikipedia)](https://en.wikipedia.org/wiki/DO-178C)
- [Toward Certification of ML Systems for Low Criticality Airborne Applications (NASA)](https://ntrs.nasa.gov/api/citations/20210019093/downloads/main.pdf)
- [DO-178C Cert-Kit for Airborne ML (Military Embedded Systems)](https://militaryembedded.com/avionics/software/do-178c-cert-kit-for-airborne-machine-learning-to-be-researched-by-intelligent-artifacts)
- [ARP4754A Guidelines (SAE)](https://www.sae.org/standards/content/arp4754a/)
- [EASA Artificial Intelligence Roadmap 2.0](https://www.easa.europa.eu/en/document-library/general-publications/easa-artificial-intelligence-roadmap-20)
- [EASA AI Concept Paper Issue 2](https://www.easa.europa.eu/en/document-library/general-publications/easa-artificial-intelligence-concept-paper-issue-2)
- [Explaining W-Shaped Learning Assurance (Daedalean)](https://www.daedalean.ai/tpost/pxl6ih0yc1-explaining-w-shaped-learning-assurance)
- [EASA ForMuLA: Formal Methods for Learning Assurance](https://www.easa.europa.eu/en/downloads/137878/en)
- [FAA AGVS on Airports](https://www.faa.gov/airports/new_entrants/agvs_on_airports)
- [FAA CertAlert 24-02: AGVS Technology on Airports](https://www.faa.gov/airports/airport_safety/certalerts/part_139_certalert_24_02)
- [Autonomous GSE and the Future of Airside Operations (Airside International)](https://airsideint.com/issue-article/autonomous-gse-and-the-future-of-airside-operations/)
- [ISO/TS 5083:2025 (ISO)](https://www.iso.org/standard/81920.html)

### Section 3 -- Formal Verification of Neural Networks
- [Marabou 2.0: A Versatile Formal Analyzer of Neural Networks (arXiv)](https://arxiv.org/html/2401.14461v1)
- [alpha-beta-CROWN (GitHub)](https://github.com/Verified-Intelligence/alpha-beta-CROWN)
- [VNN-COMP 2025 Summary and Results (arXiv)](https://arxiv.org/abs/2512.19007)
- [Marabou GitHub Repository](https://github.com/NeuralNetworkVerification/Marabou)
- [Certified Robustness in Automated Driving Perception (Springer)](https://link.springer.com/article/10.1007/s42154-024-00347-3)
- [Robustness Certificates for Neural Networks (arXiv)](https://arxiv.org/html/2512.20865v1)
- [Mobileye RSS](https://www.mobileye.com/technology/responsibility-sensitive-safety/)
- [RSS: Five Rules for AV Safety (Mobileye Blog)](https://www.mobileye.com/blog/rss-explained-the-five-rules-for-autonomous-vehicle-safety/)
- [ad-rss-lib (GitHub)](https://github.com/intel/ad-rss-lib)
- [Simplex Architecture for Deep-Learning-Powered Autonomous Systems (arXiv)](https://arxiv.org/html/2509.21014)
- [Dynamic Simplex: Balancing Safety and Performance (ACM)](https://dl.acm.org/doi/10.1145/3576841.3585934)
- [Verification of Autonomous Neural Car Control with KeYmaera X (arXiv)](https://arxiv.org/html/2504.03272)
- [Certified Control: A New Safety Architecture for AVs (MIT)](https://groups.csail.mit.edu/sdg/pubs/2020/certified-control.pdf)

### Section 4 -- Safety Cases for Learned Models
- [AMLAS Guidance (University of York)](https://www.york.ac.uk/assuring-autonomy/guidance/amlas/)
- [AMLAS Paper (arXiv)](https://arxiv.org/abs/2102.01564)
- [Safety Assurance of ML for Autonomous Systems (ScienceDirect)](https://www.sciencedirect.com/science/article/abs/pii/S0951832025005125)
- [Goal Structuring Notation (Wikipedia)](https://en.wikipedia.org/wiki/Goal_structuring_notation)
- [GSN (NASA CertWare)](https://nasa.github.io/CertWare/gsn.html)
- [Safety Case Patterns for VLA-Based Driving Systems (RAISE)](https://arxiv.org/html/2603.16013)
- [SafeDrive Dreamer: World Models for Safety (ScienceDirect)](https://www.sciencedirect.com/science/article/pii/S1110016824011943)
- [Building a Credible Case for Safety: ADS (ScienceDirect)](https://www.sciencedirect.com/science/article/pii/S0022437525001641)
- [Credible Autonomy Safety Argumentation (CMU)](https://users.ece.cmu.edu/~koopman/pubs/Koopman19_SSS_CredibleSafetyArgumentation.pdf)

### Section 5 -- Runtime Safety
- [Runtime Safety Monitoring of DNNs for Perception: A Survey (arXiv)](https://arxiv.org/pdf/2511.05982)
- [Safety Monitoring for Learning-Enabled Systems (arXiv)](https://arxiv.org/pdf/2504.13478)
- [Connected Dependability Cage for Safe Automated Driving (arXiv)](https://arxiv.org/html/2307.06258v1)
- [Uncertainty-Aware Prediction in Planning for AD (arXiv)](https://arxiv.org/html/2403.02297v1)
- [Calibrated Prediction of Safety Chances (arXiv)](https://arxiv.org/html/2508.09346)
- [Graceful Degradation of Decision and Control (SAE)](https://saemobilus.sae.org/articles/improving-safety-autonomous-vehicles-a-verifiable-method-for-graceful-degradation-decision-control-responsibilities-12-08-02-0021)
- [Graceful Degradation Design Process for ADS (Springer)](https://link.springer.com/chapter/10.1007/978-3-030-26601-1_2)
- [Teleoperation: Safety Net for Autonomous Driving? (EE Times)](https://www.eetimes.eu/is-teleoperation-just-a-safety-net-for-autonomous-driving/)
- [Predicting Safety Misbehaviours Using Uncertainty Quantification (arXiv)](https://arxiv.org/html/2404.18573v1)
