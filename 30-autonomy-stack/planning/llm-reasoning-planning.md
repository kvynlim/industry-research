# LLM-Based Reasoning, Planning, and Decision-Making for Autonomous Vehicles

## Comprehensive Technical Report

---

## Table of Contents

1. [LLMs as AV Planners and Reasoners](#1-llms-as-av-planners-and-reasoners)
2. [Chain-of-Thought and Reasoning for Driving](#2-chain-of-thought-and-reasoning-for-driving)
3. [Multimodal LLMs for Driving](#3-multimodal-llms-for-driving)
4. [LLM-Based Traffic Simulation](#4-llm-based-traffic-simulation)
5. [Applicability to Airside Operations](#5-applicability-to-airside-operations)
6. [Taxonomy and Landscape Summary](#6-taxonomy-and-landscape-summary)
7. [Key Challenges and Open Problems](#7-key-challenges-and-open-problems)

---

## 1. LLMs as AV Planners and Reasoners

### 1.1 GPT-Driver (NeurIPS Workshop 2023)

**Core idea:** Reformulates motion planning as a language modeling problem. Driving trajectory waypoints are tokenized as language and GPT-3.5 is used to generate them.

- **Input/Output:** Scene descriptions and ego-vehicle state are encoded as text prompts; the LLM outputs a sequence of coordinate waypoints as natural-language tokens.
- **Prompting-Reasoning-Finetuning strategy:** A three-stage pipeline that (1) constructs structured prompts from the driving scene, (2) uses chain-of-thought to stimulate numerical reasoning, and (3) fine-tunes the LLM on trajectory data to improve coordinate precision.
- **Results on nuScenes:** Outperforms state-of-the-art motion planners in effectiveness, generalization, and interpretability.
- **Significance:** The first work to demonstrate that a general-purpose LLM can serve as a competitive motion planner when the planning problem is reformulated as next-token prediction.

**Reference:** [GPT-Driver: Learning to Drive with GPT](https://pointscoder.github.io/projects/gpt_driver/index.html)

---

### 1.2 LanguageMPC (October 2023)

**Core idea:** Uses LLMs as high-level decision makers whose outputs parameterize a Model Predictive Controller (MPC).

- **Architecture:** The LLM receives a structured textual description of the driving scenario (road layout, surrounding vehicles, traffic signals) and produces a high-level decision (e.g., "slow down and yield to oncoming traffic"). This decision is translated into MPC parameter adjustments through guided parameter matrix adaptation.
- **Key capabilities:**
  - Traffic rule reasoning: For an unsignalized intersection left turn, the LLM correctly decides to yield to oncoming traffic.
  - User preference adaptation: Switches between conservative (follow the car ahead) and aggressive (overtake) driving styles based on natural language instructions.
  - Multi-vehicle coordination: Handles complex multi-agent scenarios using commonsense reasoning.
- **Results:** Consistently surpasses baseline approaches in single-vehicle tasks and successfully handles multi-vehicle coordination.

**Reference:** [LanguageMPC: Large Language Models as Decision Makers for Autonomous Driving](https://arxiv.org/abs/2310.03026)

---

### 1.3 LLM-Assist (2024)

**Core idea:** A hybrid planner that combines a conventional rule-based planner with an LLM-based planner for closed-loop driving.

- **Problem addressed:** Rule-based planners generalize well but fail on complex maneuvers; learning-based planners overfit and have poor long-tail performance. LLM-Assist uses LLMs (GPT-3.5 and GPT-4) to augment rule-based planning when the base planner fails.
- **Mechanism:** The LLM defines planner parameters (not raw trajectories) to safely navigate scenarios, acting as a "consultant" that adjusts the rule-based planner's behavior.
- **Key finding:** GPT-4 shows a marginal edge in unconstrained settings, while GPT-3.5 performs slightly better in constrained scenarios.
- **Significance:** Demonstrates a practical integration pattern where the LLM provides high-level reasoning while the rule-based system handles low-level execution, reducing latency and safety concerns.

**Reference:** [LLM-Assist: Enhancing Closed-Loop Planning with Language-Based Reasoning](https://arxiv.org/html/2401.00125v1)

---

### 1.4 DriveGPT4 (2023) and DriveGPT4-V2 (CVPR 2025)

**Core idea:** An interpretable end-to-end autonomous driving system built on a multimodal LLM.

- **Architecture:** A multimodal language model with a dedicated video tokenizer for processing multi-frame video sequences, combined with a shared text/control signal de-tokenizer.
- **Training:** Fine-tuned on 56K video-text instruction-following pairs for driving plus 223K general instruction-following data.
- **Capabilities:**
  - Processes multi-frame video inputs and textual queries
  - Interprets vehicle actions with natural-language reasoning
  - Predicts low-level vehicle control signals end-to-end
  - Answers diverse user questions about driving scenarios
- **DriveGPT4-V2 (CVPR 2025):** Extends to closed-loop autonomous driving with enhanced LLM capabilities.
- **Results:** Superior performance on the BDD-X dataset; comparable to GPT-4V on driving grounding tasks when domain-fine-tuned.

**Reference:** [DriveGPT4: Interpretable End-to-end Autonomous Driving via Large Language Model](https://arxiv.org/abs/2310.01412)

---

### 1.5 DiLu -- Dilemma-driven LLM for Driving (ICLR 2024)

**Core idea:** A knowledge-driven framework with four modules that enables LLMs to accumulate driving experience and continuously improve, inspired by how humans learn to drive.

- **Four modules:**
  1. **Environment:** Highway-env simulation providing real-time vehicle positions, speeds, and accelerations.
  2. **Reasoning Module:** Encodes driving scenes as text, retrieves similar past experiences from a vector database, constructs few-shot prompts, and queries GPT-3.5 for driving decisions using chain-of-thought.
  3. **Reflection Module:** Post-episode evaluation using GPT-4 -- for collisions, it identifies the error cause, generates corrected reasoning, and proposes preventive strategies.
  4. **Memory Module:** A vector database storing scene descriptions paired with reasoning processes. Initialized with just 5 human-crafted seed scenarios.
- **Key results:**
  - With only 40 memory items, DiLu matches the performance of RL methods trained over 600,000 episodes.
  - Superior generalization: when transferred to more complex scenarios (5 lanes, higher density), DiLu maintains a 35% success rate where RL suffers an 85% performance drop.
  - Real-world transferability: experiences from the CitySim trajectory dataset improved simulation performance.

**Reference:** [DiLu: A Knowledge-Driven Approach to Autonomous Driving with Large Language Models](https://arxiv.org/abs/2309.16292)

---

### 1.6 Agent-Driver (2024)

**Core idea:** Treats the LLM as a cognitive agent with a tool library, cognitive memory, and a multi-step reasoning engine, mimicking an anthropomorphic driving process.

- **Tool Library:** 20+ functions abstracting neural module outputs into text, spanning detection (`get_leading_object`), prediction (retrieve predicted trajectories), occupancy (check location occupancy probabilities), and mapping (lane/road shoulder info). The LLM selectively invokes relevant functions via dynamic calls.
- **Cognitive Memory:**
  - Commonsense Memory: traffic regulations and safe driving knowledge.
  - Experience Memory: past driving scenarios with decisions, retrieved via a two-stage search (KNN in embedding space + LLM-based fuzzy ranking).
- **Reasoning Engine (4 steps):**
  1. **Chain-of-Thought Reasoning:** Identifies key objects and their effects on driving.
  2. **Task Planning:** High-level plans combining discrete behaviors (move_forward, change_lane, turn, stop) with velocity estimates.
  3. **Motion Planning:** Generates 6 waypoints over 3 seconds through LLM fine-tuning on human driving data.
  4. **Self-Reflection:** Collision-checks trajectories against occupancy maps; refines colliding trajectories.
- **Results on nuScenes:**
  - Collision rate: 0.09% average (35.7% reduction vs. second-best).
  - L2 error: 0.37m average.
  - Few-shot: with just 1% of training data, exceeds UniAD trained on full datasets.
  - Zero invalid outputs even with minimal training data.

**Reference:** [A Language Agent for Autonomous Driving](https://arxiv.org/abs/2311.10813)

---

### 1.7 DriveMLM (2023, published Springer 2025)

**Core idea:** Aligns multimodal LLM decision outputs with the behavioral planning module of a modular AD system (Apollo).

- **Architecture:**
  - Multi-modal tokenizer: transforms multi-view images, LiDAR, traffic rules, and user requirements into unified tokens.
  - MLLM decoder: makes decisions based on unified tokens and generates natural-language explanations.
- **Key innovation:** Behavioral Planning States Alignment -- the LLM's linguistic decisions map directly to Apollo's behavioral planning states, enabling seamless conversion to vehicle control signals.
- **Data engine:** Custom dataset with decision state annotations and corresponding explanations.
- **Results on CARLA Town05 Long:** Driving Score of 76.1 (outperforming Apollo by 4.7 points); highest miles-per-intervention (0.96) among all compared systems.

**Reference:** [DriveMLM: Aligning Multi-Modal Large Language Models with Behavioral Planning States](https://arxiv.org/abs/2312.09245)

---

### 1.8 LimSim++ (2024)

**Core idea:** The first open-source closed-loop simulation platform for deploying and evaluating MLLMs in autonomous driving.

- **Dual-component architecture:** Simulation System (SUMO + CARLA) and an MLLM-powered Driver Agent interacting in a closed-loop fashion.
- **Capabilities:** Prompt engineering, model evaluation, framework enhancement, continuous learning through reflection and memory.
- **Results:** LLM agents achieved over 90% route completion in complex scenarios; GPT-3.5's success rate improved from 50% to 100% through continuous learning.

**Reference:** [LimSim++: A Closed-Loop Platform for Deploying Multimodal LLMs in Autonomous Driving](https://arxiv.org/abs/2402.01246)

---

### 1.9 SurrealDriver (2023)

**Core idea:** Builds human-like generative driving agents using post-driving self-report "driving-thinking" data from real human drivers.

- **Data collection:** Post-driving self-reports from 24 real-world drivers captured their verbalized considerations and decision-making processes during urban driving.
- **Framework design:** Basic driving pipeline, safety and memory mechanism, and human-aligned long-term driving guidelines informed by human thought demonstrations.
- **Results:** Incorporating expert demonstration data reduced collision rates by 81.04% and increased human likeness by 50% compared to baseline LLM-based agents.
- **Significance:** First application of LLMs to construct an agent capable of human-like urban driving behavior.

**Reference:** [SurrealDriver: Designing LLM-powered Generative Driver Agent Framework](https://arxiv.org/abs/2309.13193)

---

### 1.10 DriveGPT -- Waymo (ICML 2025)

**Core idea:** A large autoregressive behavior model that applies LLM-style scaling laws to driving.

- **Scale:** 1B+ parameters, trained on 100M+ high-quality human driving demonstrations in dense urban settings -- approximately 3x larger and 50x more data than prior published behavior models.
- **Architecture:** Transformer encoder-decoder where the encoder summarizes scene context and the decoder predicts future agent states autoregressively as tokens.
- **Key finding:** Scaling experiments reveal LLM-like scaling laws for driving -- performance improves predictably with more data and compute, and autoregressive decoders show better scalability than one-shot decoders.
- **Real-world deployment:** Deployed as a real-time planner in complex urban scenarios on actual Waymo vehicles.

**Reference:** [DriveGPT: Scaling Autoregressive Behavior Models for Driving](https://arxiv.org/abs/2412.14415)

---

### 1.11 Additional Notable Systems

| System | Year | Key Contribution |
|--------|------|------------------|
| **Drive Like a Human** | 2023 | Identifies three key LLM abilities for driving: reasoning, interpretation, memorization. Zero-shot pass rate > 60% in HighwayEnv. |
| **Senna** | 2024 | Bridges LVLM (Senna-VLM) with end-to-end planner (Senna-E2E). Reduces planning error by 27.12% and collision rate by 33.33%. |
| **AutoVLA** | NeurIPS 2025 | Unifies reasoning and action generation. Introduces dual thinking modes (fast/slow) and GRPO-based reinforcement fine-tuning. Top score on Waymo Challenge Spotlight metric. |
| **KnowVal** | 2025 | Integrates driving knowledge graph (traffic laws, ethics, defensive driving) with VLM reasoning. Achieves lowest collision rate on nuScenes. |
| **Wayve LINGO-2** | 2024 | First closed-loop vision-language-action driving model tested on public roads. Language serves as both input prompt and output explanation. |
| **DriveLLM-V** | 2025 | Explicit natural-language "Vehicle Intention-Based Control Signals" embedded in LLM reasoning for behavioral explainability. |
| **LLaDA (NVIDIA)** | 2024 | Large Language Driving Assistant enabling policy adaptation to traffic rules in new locations via zero-shot LLM generalization. |

---

## 2. Chain-of-Thought and Reasoning for Driving

### 2.1 Decomposing Driving Tasks with LLMs

LLMs decompose the complex, monolithic driving task into structured sub-problems that mirror human cognitive processes:

```
Perception -> Prediction -> Planning -> Action
     |              |            |           |
  "What do     "What will    "What       "Execute
   I see?"     they do?"    should       trajectory"
                            I do?"
```

**Agent-Driver's four-step decomposition** is the canonical example:
1. **Chain-of-Thought Reasoning:** "The vehicle ahead is braking. A pedestrian is crossing 30m ahead. The traffic light is yellow."
2. **Task Planning:** "Decelerate and prepare to stop. Do not change lanes -- pedestrian in adjacent lane."
3. **Motion Planning:** Generate 6 waypoints over 3 seconds with decreasing velocity.
4. **Self-Reflection:** Check waypoints against occupancy map; refine if collision detected.

**DriveLM's Graph VQA** structures reasoning as a directed graph:
- Nodes: QA pairs about perception ("What objects are nearby?"), prediction ("Will the pedestrian cross?"), and planning ("Should I yield?")
- Edges: Logical progressions between reasoning steps
- This graph structure enforces causal reasoning chains and prevents the LLM from "jumping to conclusions."

---

### 2.2 Spatial Reasoning with LLMs

Spatial reasoning remains a fundamental challenge. Key approaches:

**Talk2BEV (ICRA 2024):** Constructs language-enhanced Bird's-Eye View maps by aligning vision-language features for each detected object. The BEV representation can be queried for spatial reasoning ("Is there a vehicle in my blind spot?"), distance estimation, and future scenario planning.

**BEVLM (2025):** Distills semantic knowledge from LLMs into BEV representations, improving LLM reasoning accuracy by 46% in cross-view driving scenes and safety-critical scenario performance by 29%.

**Spatial-aware VLMs:** Contemporary VLMs struggle with metric spatial understanding because they primarily consume 2D imagery. BEV representations bridge this gap by providing explicit spatial encoding that LLMs can reason over.

**Visualization-of-Thought (NeurIPS 2024):** Augments chain-of-thought with interleaved "visualizations" that mimic internal sketching, improving multi-hop spatial planning and navigation success rates.

---

### 2.3 Traffic Rule Understanding and Compliance

**DriveReg / Driving with Regulation (2024):**
- **Traffic Regulation Retrieval (TRR) Agent:** Uses RAG with `text-embedding-ada-002` embeddings and FAISS similarity search to retrieve relevant regulations from state laws, DMV manuals, city ordinances, court cases, and driving norms.
- **Cascading retrieval:** Paragraph-level selection followed by sentence-level re-embedding for precision.
- **Dual-level evaluation:** The reasoning agent (GPT-4o) performs both compliance checking (mandatory rules) and safety assessment (guidelines).
- **Results:** Without RAG: 76% accuracy; with RAG: 100% accuracy on 30 hypothesized scenarios. 15/17 correct on real-world nuScenes samples.
- **Latency:** ~2 seconds per decision with detailed reasoning; ~1 second for shorter outputs.

**LLaDA (NVIDIA, CVPR 2024):** Enables AVs to adapt to traffic rules in new geographic locations through zero-shot LLM generalization, interpreting and applying unfamiliar local regulations without retraining.

**KnowVal (2025):** Encodes traffic laws, defensive driving principles, and ethical norms in a comprehensive driving knowledge graph, with an LLM-based retrieval mechanism tailored for driving scenarios.

---

### 2.4 Common-Sense Reasoning for Edge Cases

LLMs are uniquely valuable for long-tail scenarios where rule-based logic and statistical models fail:

- **Traffic cone on a truck:** Human drivers use common sense to recognize traffic cones as cargo rather than construction markers. Most perception systems fail on this distinction, but LLMs can reason: "The cones are on the truck bed, not on the road surface, so they are being transported."
- **Drive Like a Human:** Demonstrates that LLMs achieve > 60% zero-shot pass rate on highway scenarios that require common-sense reasoning, outperforming RL and search-based methods without any training.
- **DiLu's Reflection Module:** When the LLM makes an error (e.g., collision), GPT-4 analyzes the failure, identifies the root cause, and generates corrective strategies stored for future use -- mimicking how human drivers learn from mistakes.
- **AutoScenario (2025):** A multimodal LLM framework that converts real-world safety-critical data into textual representations, enabling LLMs to generalize risk factors and generate realistic corner cases for testing.

---

### 2.5 Multi-Step Planning with Language

**Sequential reasoning patterns used in driving:**

| Pattern | Example | Systems Using It |
|---------|---------|-----------------|
| Chain-of-Thought | "I see X -> This means Y -> Therefore I should Z" | Agent-Driver, DiLu, DriveLM |
| Tree-of-Thought | Explore multiple plan candidates, evaluate each | AutoScenario, LLM4ADSTest |
| Graph-of-Thought | Non-linear reasoning with cross-connections | DriveLM Graph VQA |
| Reflection/Self-Critique | Generate plan -> Evaluate -> Refine | Agent-Driver, DiLu, LimSim++ |
| RAG-Augmented Reasoning | Retrieve rules/experience -> Reason with context | DriveReg, KnowVal, DiLu |

---

## 3. Multimodal LLMs for Driving

### 3.1 GPT-4V/4o Applied to Driving Analysis

**"On the Road with GPT-4V(ision)" (ICLR 2024):**
- **Strengths:** Outperforms existing systems in scene understanding and causal reasoning. Successfully recognizes weather conditions, traffic lights/signs across countries, and positions/actions of traffic participants.
- **Limitations:** Cannot predict numerical control signals; fails to correctly understand dynamic vehicle actions (turning, accelerating). Insufficient for real-time control but valuable for high-level scene analysis.

**GPT-4V Explorations: Mining Autonomous Driving (2024):**
- Extended evaluation of GPT-4V for mining driving-relevant insights from camera data.

**GPT-4o in DriveReg:** Used as the reasoning agent for traffic regulation compliance, achieving 100% accuracy with RAG-retrieved regulations.

---

### 3.2 Waymo's Driving VLM (Gemini-based)

Waymo uses a Driving VLM trained on top of Gemini for complex semantic reasoning:
- Fine-tuned on Waymo's driving data and tasks
- Leverages Gemini's world knowledge for rare and novel scenarios
- Example: When encountering a vehicle on fire, the VLM provides semantic signals prompting the system to reroute
- Represents a production-grade deployment of multimodal LLM reasoning in autonomous driving

---

### 3.3 DriveLM (ECCV 2024 Oral)

**Core innovation: Graph Visual Question Answering (Graph VQA)**
- QA pairs structured as a directed graph mimicking human reasoning: Perception -> Prediction -> Planning
- Each QA node connects to others via logical progression edges
- Instantiated on nuScenes and CARLA datasets

**DriveLM-Agent baseline:**
- Performs end-to-end driving competitively with driving-specific architectures
- Strong zero-shot generalization to unseen objects and sensor configurations
- Served as a main track in the CVPR 2024 Autonomous Driving Challenge

---

### 3.4 NuScenes-QA (AAAI 2024)

**The first VQA benchmark for autonomous driving:**
- 34K visual scenes, 460K question-answer pairs
- Multi-modal input: 6-view RGB cameras + 5D LiDAR point clouds
- Programmatically generated QA pairs from 3D detection annotations and scene graphs
- Covers Boston and Singapore driving scenes with diverse conditions
- Establishes standardized evaluation for VQA capabilities in driving contexts

**Reference:** [NuScenes-QA: A Multi-modal Visual Question Answering Benchmark](https://arxiv.org/abs/2305.14836)

---

### 3.5 How MLLMs Understand Driving Scenes

The emerging MLLM pipeline for driving scene understanding:

```
Multi-view Cameras + LiDAR
        |
  Visual Encoder (e.g., CLIP, SigLIP, InternViT)
        |
  BEV / Spatial Feature Extraction
        |
  Visual-Language Alignment (projection/adapter)
        |
  Large Language Model (reasoning backbone)
        |
  Outputs: Scene description, decisions, trajectories, explanations
```

**Key challenges identified:**
- **Metric spatial understanding:** 2D image encoders lose 3D depth; BEV integration helps
- **Temporal reasoning:** Multi-frame processing is computationally expensive but necessary
- **Hallucination:** LLMs may confidently describe objects/scenarios that don't exist -- critical for safety
- **Latency:** Most MLLMs require seconds per inference, too slow for reactive control

---

## 4. LLM-Based Traffic Simulation

### 4.1 ChatSim (CVPR 2024 Highlight)

**The first system for editable photo-realistic 3D driving scene simulation via natural language.**

- **Multi-agent LLM collaboration:** Multiple LLM agents with specialized roles decompose simulation demands into specific editing tasks, mirroring human company workflows.
- **Rendering:** Novel multi-camera neural radiance field for photo-realistic outcomes with scene-consistent lighting estimation.
- **Evaluation:** Demonstrated on Waymo Open Dataset handling complex language commands for scene editing.

**Reference:** [ChatSim: Editable Scene Simulation for Autonomous Driving via LLM-Agent Collaboration](https://github.com/yifanlu0227/ChatSim)

---

### 4.2 Language Conditioned Traffic Generation -- LCTGen (CoRL 2023)

**Natural language to traffic scenario generation:**

- **Interpreter Module:** LLM converts natural language descriptions ("A busy intersection with a jaywalking pedestrian") into structured representations and retrieves matching maps from a real-world map library.
- **Generator Module:** Query-based Transformer generates the full traffic scenario (initial states + motions) in a single pass.
- **Applications:** Instructional traffic editing, controllable policy evaluation.
- **Results:** Outperforms prior work in both unconditional and conditional scene generation for realism and fidelity.

**Reference:** [Language Conditioned Traffic Generation](https://ariostgx.github.io/lctgen/)

---

### 4.3 LLMs for Realistic Agent Behavior Modeling

**Cognitive Agents with LLM Reasoning:**
- Multi-horizon memory-driven planning with reflection and adaptation
- Modal decisions emerge from LLM-driven reflection and situational feedback rather than predefined rules
- Enables investigation of emergent, profile-sensitive behaviors across stable and perturbed conditions

**Promptable Closed-Loop Traffic Simulation (2024):**
- LLM comprehends natural language prompts to generate language-conditioned policy queries for each traffic agent
- Enables controllable simulation where individual agent behaviors can be specified via text

**AnchorDrive (2025):**
- Two-stage framework: LLM generates semantically controllable scenarios under natural language constraints; diffusion model regenerates realistic trajectories while preserving intent
- Bridges the gap between linguistic controllability and physical realism

---

### 4.4 LLM-Driven Scenario Generation for Testing

| System | Approach | Key Innovation |
|--------|----------|---------------|
| **AutoScenario** | Multimodal LLM for corner case generation | Converts real-world safety-critical data to text for LLM reasoning |
| **OmniTester** | MLLM-driven scenario testing | Comprehensive multimodal testing framework |
| **LLM4ADSTest** | Tree-of-Thoughts strategy | Structured prompts + red-teaming refinement |
| **AnchorDrive** | LLM + diffusion model | Semantically controllable + physically realistic |

---

### 4.5 GAIA-1 -- Wayve (2023)

**Generative world model for driving, architecturally paralleling LLMs:**

- 9-billion parameter model trained on ~4,700 hours of UK driving data
- Uses vector-quantized representations to reframe video prediction as next-token prediction (analogous to LLM pretraining)
- Generates semantically meaningful, temporally consistent driving videos
- Can predict several minutes into the future from seconds of input
- Exhibits LLM-like scaling laws: performance improves with model size and data

---

## 5. Applicability to Airside Operations

### 5.1 Current State of Airport Autonomous Ground Vehicles

**FAA regulatory status (CertAlert 24-02):**
- Testing, deployment, and operation of Autonomous Ground Vehicle Systems (AGVS) have **not been authorized** by the FAA at Part 139 certified airports for operational use.
- Testing is supported in controlled environments: remote airport areas, landside locations, and movement areas closed to aircraft operations.
- Applications under consideration: maintenance vehicles (mowers, snow removal, sweepers, FOD detection), perimeter security, self-driving aircraft tugs, baggage carts, employee buses, and passenger shuttles.
- Existing safety requirements and standards were not developed with autonomous vehicles in mind; the FAA is developing new standards and guidance.

**ICAO-level discussion:** EASA recommends international regulatory coordination through ICAO for autonomous airport vehicles.

---

### 5.2 LLMs Understanding Airport Ground Operations

**Direct relevance of LLM-for-driving research to airside:**

The airside environment shares key characteristics with road driving that make LLM-based reasoning applicable:

| Road Driving Challenge | Airside Equivalent | LLM Capability |
|----------------------|-------------------|----------------|
| Traffic rules (state laws, signals) | ICAO Annex 14, FAA AC 150/5210-20, local airport rules | RAG-based rule retrieval and compliance checking |
| Multi-agent coordination | Aircraft, GSE, personnel on ramp/taxiway | Multi-agent reasoning (LanguageMPC, Agent-Driver) |
| Edge cases / corner cases | FOD, weather events, emergency vehicles | Common-sense reasoning (DiLu, Drive Like a Human) |
| Scene understanding | Gate areas, taxiways, apron markings | Multimodal scene analysis (GPT-4V, DriveLM) |
| Explainable decisions | Safety-case requirements for certification | Natural language explanations (DriveGPT4, Senna) |

---

### 5.3 Encoding ICAO/FAA Rules as Language Prompts

The **DriveReg / RAG-based compliance framework** provides a directly transferable architecture for airside regulation compliance:

**Proposed adaptation:**
1. **Regulation Corpus:** Ingest ICAO Annex 2 (Rules of the Air), Annex 14 (Aerodromes), FAA AC 150/5210-20A (Ground Vehicle Operations), FAA AC 150/5340-1M (Marking Standards), local airport SOPs, and NOTAMs.
2. **Retrieval Agent:** Embed regulations with a domain-specific model, use FAISS or similar for real-time retrieval based on the current operational context (e.g., "vehicle approaching active runway crossing").
3. **Reasoning Agent:** LLM evaluates proposed actions against retrieved regulations:
   - Mandatory compliance: "All vehicles must obtain clearance before entering a movement area" (FAA AC 150/5210-20)
   - Safety guidelines: "Maintain safe distance from aircraft engine intake zones"
   - Context-dependent rules: "During low-visibility operations, additional restrictions apply"

**Key advantage:** Unlike hard-coded rule engines, an LLM-based system can handle:
- Ambiguous or conflicting regulations
- Novel scenarios not explicitly covered by rules
- Integration of NOTAMs and temporary operational changes via natural language
- Regional variations between airports and jurisdictions

---

### 5.4 Natural Language Interfaces for AV Operators

**Existing work directly applicable to airside:**

**NASA Research on Digital Taxi Instructions (AIAA 2024):**
- Uses Natural Language Understanding (intent classification + slot filling) to automatically generate digital taxi instructions from ATC speech.
- Motivation: Reduces errors from voice-only communication and enables data-link integration.
- Challenge: LLMs alone can make unsafe assignments (e.g., multiple aircraft on same runway); requires deterministic guardrails.

**Moonware HALO Platform:**
- World's first AI-powered Ground Traffic Control system for airports.
- Consolidates operational inputs from across the airside into centralized coordination.
- On-demand task allocation replacing paper-based scheduling.
- Active at US hub airports (British Airways, Aerocharter) and testing at Tokyo International Airport with Japan Airlines.
- Results: 20% reduction in delays, 5-minute average decrease in turnaround time.
- Future roadmap: Integration with autonomous GSE for pushback, baggage handling, and cargo.

**LLM-based ATC Agent (Delft University, 2024):**
- Language model agent with function-calling resolves air traffic conflicts autonomously.
- Three-agent architecture: planner, executor, verifier.
- Experience Library (vector database) stores and retrieves past conflict resolutions.
- Best configuration resolved 119/120 imminent conflict scenarios, including 4-aircraft simultaneous conflicts.
- Provides human-level text explanations of reasoning -- directly addresses the transparency requirement for safety certification.

**Proposed airside operator interface capabilities:**
- Voice/text commands: "Clear GSE Unit 7 to proceed to Gate B12 via Taxilane Alpha"
- Status queries: "What is the current status of the pushback at Gate C4?"
- Exception handling: "Divert all ground traffic from Taxiway Bravo -- FOD reported"
- The LLM interprets intent, validates against current operational state, and either executes or explains why the action cannot be performed

---

### 5.5 Explainable Decisions for Safety Cases

LLM-based explainability is a critical enabler for airside AV certification:

**Why it matters for airside:**
- Airside operations require safety cases compliant with ICAO and national regulations
- Regulators need to understand why an autonomous vehicle made each decision
- Post-incident investigation requires traceable decision logs
- Operators need real-time visibility into AV reasoning

**Transferable approaches from driving research:**

| Approach | Source | Airside Application |
|----------|--------|-------------------|
| Natural-language decision rationales | DriveGPT4, Senna-VLM, DriveLLM-V | "I stopped because aircraft N12345 is performing pushback across my planned path" |
| Chain-of-thought reasoning logs | Agent-Driver, DiLu | Complete traceable reasoning chain for each decision |
| Regulation-linked justification | DriveReg (RAG) | "Per FAA AC 150/5210-20, Section 7: vehicles must yield to aircraft at all times" |
| Reflection and error analysis | DiLu Reflection Module | Post-incident: "The collision occurred because the system did not detect the baggage cart behind the aircraft nose" |

**DriveLLM-V's VICS (Vehicle Intention-Based Control Signals)** are particularly relevant: they embed acceleration/deceleration and steering commands together with the reason for each action in plain language, enabling human-readable diagnostics.

---

### 5.6 Integration with Ground Control Instructions

**Architecture for LLM-integrated airside AV operations:**

```
                    Ground Control / HALO
                          |
                  [Natural Language Instructions]
                          |
                    LLM Reasoning Layer
                   /        |        \
            RAG:         Scene         Memory:
         ICAO/FAA      Understanding   Past Operations
         Regulations   (Camera+LiDAR)  & Experiences
                   \        |        /
                    Decision Engine
                          |
                  [Validated Action Plan]
                          |
                    MPC / Path Planner
                          |
                  Autonomous GSE Vehicle
```

**Key integration points:**
1. **ATC/Ground Control communication:** LLM parses natural language or data-link instructions, extracts intent (taxi route, hold short, give way), and validates against current operational state.
2. **Conflict detection:** Similar to the Delft ATC agent, the LLM detects potential conflicts between multiple ground vehicles and aircraft, proposing deconfliction strategies.
3. **Dynamic replanning:** When operational conditions change (gate reassignment, weather, emergency), the LLM re-reasons about the plan using updated context from RAG-retrieved procedures.
4. **Multi-agent coordination:** Drawing from LanguageMPC and Agent-Driver patterns, multiple autonomous GSE vehicles coordinate through shared LLM reasoning to avoid conflicts and optimize turnaround operations.

---

### 5.7 Active Industry Players in Autonomous Airside Operations

| Company | Technology | Status |
|---------|-----------|--------|
| **Moonware** | AI-powered Ground Traffic Control (HALO) | Operational at US hubs, testing at Tokyo |
| **EVIE Autonomous** | Autonomous aircraft tugs and luggage pods | Development/testing phase |
| **Aurrigo** | Auto-DollyTug and Auto-Sim autonomous baggage | Approved for wider use across 60+ airports (Royal Schiphol Group) |
| **UVU / Academic** | Autonomous electric aircraft tug | Prototype demonstrated at Provo Airport |
| **TaxiBot / WheelTug** | Semi-autonomous aircraft taxiing | Various stages of deployment |

---

## 6. Taxonomy and Landscape Summary

### 6.1 How LLMs Are Used in AV Systems

Based on the LLM4AD survey taxonomy:

```
LLM Applications in Autonomous Driving
|
+-- Perception Enhancement
|   +-- Scene description and narration
|   +-- Visual question answering (NuScenes-QA, DriveLM)
|   +-- 3D spatial reasoning (Talk2BEV, BEVLM)
|
+-- Planning & Decision-Making
|   +-- High-level decision making (LanguageMPC, DiLu)
|   +-- Trajectory generation (GPT-Driver, Agent-Driver)
|   +-- End-to-end driving (DriveGPT4, Senna, AutoVLA)
|   +-- Rule compliance (DriveReg, KnowVal)
|
+-- Control Integration
|   +-- MPC parameterization (LanguageMPC)
|   +-- Behavioral planning alignment (DriveMLM)
|   +-- Vision-Language-Action models (LINGO-2, AutoVLA)
|
+-- Simulation & Testing
|   +-- Scene generation (ChatSim)
|   +-- Traffic scenario generation (LCTGen)
|   +-- Corner case generation (AutoScenario)
|   +-- Agent behavior modeling (SurrealDriver, LimSim++)
|   +-- World models (GAIA-1)
|
+-- Explainability & Safety
    +-- Decision rationales (DriveGPT4, Senna-VLM)
    +-- Regulation compliance (DriveReg)
    +-- Safety diagnostics (DriveLLM-V)
```

### 6.2 Key Learning Methods

| Method | Examples | Pros | Cons |
|--------|----------|------|------|
| **Zero/Few-shot Prompting** | DiLu, Drive Like a Human | No training needed; immediate deployment | Lower precision; inconsistent |
| **Supervised Fine-Tuning** | DriveGPT4, DriveMLM | Domain-specific precision | Requires labeled data; may overfit |
| **LoRA/QLoRA** | Senna, various | Parameter-efficient adaptation | Limited capacity vs. full fine-tuning |
| **RAG** | DriveReg, KnowVal | Dynamic knowledge; no retraining | Retrieval latency; corpus maintenance |
| **Reinforcement Learning (GRPO)** | AutoVLA | Optimizes for driving metrics directly | Complex training; reward design |
| **Reflection/Self-Improvement** | DiLu, LimSim++ | Continuous improvement; error correction | Requires evaluation oracle |

---

## 7. Key Challenges and Open Problems

### 7.1 Latency
- Most LLM-based planners require 1-2+ seconds per decision.
- Driving demands reactive control at 10-20 Hz.
- **Mitigation strategies:** Dual fast/slow thinking (AutoVLA), LLM for high-level decisions only (LanguageMPC, LLM-Assist), on-device inference with smaller models, asynchronous reasoning.

### 7.2 Hallucination
- LLMs may confidently describe objects or scenarios that do not exist.
- In safety-critical driving, a hallucinated "clear road" when a pedestrian is present could be fatal.
- **Mitigation:** Grounding in perception outputs (Agent-Driver tool library), self-reflection against occupancy maps, confidence calibration, multi-model verification.

### 7.3 Safety Verification
- No established framework for formally verifying LLM-based decisions.
- Stochastic outputs make traditional safety analysis (FMEA, SOTIF) challenging.
- **Opportunity for airside:** Lower speeds, more controlled environment, and smaller operational design domain may make formal verification more tractable than road driving.

### 7.4 Deployment Constraints
- Cloud-based LLMs (GPT-4) have connectivity and latency issues.
- Edge deployment of large models requires significant compute.
- **Trend:** Smaller, distilled models (7B-13B parameters) fine-tuned for driving achieve competitive performance while being deployable on-vehicle.

### 7.5 Evaluation Standardization
- Open-loop vs. closed-loop evaluation produces very different conclusions.
- L2 displacement error doesn't capture safety-critical behavior.
- **Emerging benchmarks:** Bench2Drive, LaMPilot-Bench, CARLA Leaderboard, Waymo Challenge.

### 7.6 Airside-Specific Challenges
- No existing datasets for airside autonomous driving.
- Airport ground markings, signage, and operational procedures differ significantly from road driving.
- Multi-agent interactions (aircraft, vehicles, personnel) are more heterogeneous than road traffic.
- Communication modality (radio/data-link) differs from road driving assumptions.
- Regulatory frameworks (ICAO, FAA) are evolving and not yet accommodating of autonomous systems.

---

## Sources

### LLMs as AV Planners/Reasoners
- [GPT-Driver: Learning to Drive with GPT](https://pointscoder.github.io/projects/gpt_driver/index.html)
- [LanguageMPC: Large Language Models as Decision Makers for Autonomous Driving](https://arxiv.org/abs/2310.03026)
- [LLM-Assist: Enhancing Closed-Loop Planning with Language-Based Reasoning](https://arxiv.org/html/2401.00125v1)
- [DriveGPT4: Interpretable End-to-end Autonomous Driving via Large Language Model](https://arxiv.org/abs/2310.01412)
- [DiLu: A Knowledge-Driven Approach to Autonomous Driving with Large Language Models](https://arxiv.org/abs/2309.16292)
- [Agent-Driver: A Language Agent for Autonomous Driving](https://arxiv.org/abs/2311.10813)
- [DriveMLM: Aligning Multi-Modal Large Language Models with Behavioral Planning States](https://arxiv.org/abs/2312.09245)
- [LimSim++: A Closed-Loop Platform for Deploying Multimodal LLMs](https://arxiv.org/abs/2402.01246)
- [SurrealDriver: Designing LLM-powered Generative Driver Agent Framework](https://arxiv.org/abs/2309.13193)
- [DriveGPT: Scaling Autoregressive Behavior Models for Driving (Waymo)](https://arxiv.org/abs/2412.14415)
- [Drive Like a Human: Rethinking Autonomous Driving with Large Language Models](https://arxiv.org/abs/2307.07162)
- [Senna: Bridging Large Vision-Language Models and End-to-End Autonomous Driving](https://arxiv.org/abs/2410.22313)
- [AutoVLA: Vision-Language-Action Model for End-to-End Autonomous Driving](https://arxiv.org/abs/2506.13757)
- [KnowVal: A Knowledge-Augmented and Value-Guided Autonomous Driving System](https://arxiv.org/abs/2512.20299)
- [DriveGPT4-V2: Enhanced Closed-Loop Autonomous Driving (CVPR 2025)](https://openaccess.thecvf.com/content/CVPR2025/papers/Xu_DriveGPT4-V2_Harnessing_Large_Language_Model_Capabilities_for_Enhanced_Closed-Loop_Autonomous_CVPR_2025_paper.pdf)

### Chain-of-Thought and Reasoning
- [Driving with Regulation: Retrieval-Augmented Reasoning via LLM](https://arxiv.org/abs/2410.04759)
- [Driving Everywhere with Large Language Model Policy Adaptation (CVPR 2024)](https://openaccess.thecvf.com/content/CVPR2024/papers/Li_Driving_Everywhere_with_Large_Language_Model_Policy_Adaptation_CVPR_2024_paper.pdf)
- [Visualization-of-Thought Elicits Spatial Reasoning (NeurIPS 2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/a45296e83b19f656392e0130d9e53cb1-Paper-Conference.pdf)
- [Talk2BEV: Language-Enhanced Bird's Eye View Maps](https://llmbev.github.io/talk2bev/)
- [BEVLM: Distilling Semantic Knowledge from LLMs into BEV](https://arxiv.org/abs/2603.06576)

### Multimodal LLMs for Driving
- [On the Road with GPT-4V(ision) (ICLR 2024)](https://arxiv.org/abs/2311.05332)
- [GPT-4V Explorations: Mining Autonomous Driving](https://arxiv.org/abs/2406.16817)
- [DriveLM: Driving with Graph Visual Question Answering (ECCV 2024)](https://arxiv.org/abs/2312.14150)
- [NuScenes-QA: Multi-modal VQA Benchmark (AAAI 2024)](https://arxiv.org/abs/2305.14836)
- [Wayve LINGO-1](https://wayve.ai/thinking/lingo-natural-language-autonomous-driving/)
- [Wayve LINGO-2: Driving with Natural Language](https://wayve.ai/thinking/lingo-2-driving-with-language/)
- [DriveLLM-V: Explainable End-to-End Autonomous Driving](https://www.sciencedirect.com/science/article/abs/pii/S0968090X25003729)
- [Waymo Demonstrably Safe AI for Autonomous Driving](https://waymo.com/blog/2025/12/demonstrably-safe-ai-for-autonomous-driving/)

### Traffic Simulation
- [ChatSim: Editable Scene Simulation via LLM-Agent Collaboration (CVPR 2024)](https://arxiv.org/abs/2402.05746)
- [Language Conditioned Traffic Generation (CoRL 2023)](https://ariostgx.github.io/lctgen/)
- [GAIA-1: A Generative World Model for Autonomous Driving](https://arxiv.org/abs/2309.17080)
- [AutoScenario: Realistic Corner Case Generation with Multimodal LLM](https://www.sciopen.com/article/10.26599/TST.2025.9010178)
- [AnchorDrive: LLM Scenario Rollout with Anchor-Guided Diffusion](https://arxiv.org/html/2603.02542v1)
- [Promptable Closed-loop Traffic Simulation](https://arxiv.org/html/2409.05863v1)

### Airside Operations and ATC
- [FAA: Autonomous Ground Vehicle Systems on Airports](https://www.faa.gov/airports/new_entrants/agvs_on_airports)
- [FAA CertAlert 24-02: AGVS Technology on Airports](https://www.faa.gov/airports/airport_safety/certalerts/part_139_certalert_24_02)
- [NASA: NLU Approach for Digitizing Aircraft Ground Taxi Instructions (AIAA 2024)](https://arc.aiaa.org/doi/10.2514/6.2024-4359)
- [Automatic Control With Human-Like Reasoning: LLM Embodied Air Traffic Agents](https://arxiv.org/html/2409.09717v1)
- [Moonware: AI-Powered Ground Traffic Control](https://moonware.com/)
- [Aurrigo Auto-DollyTug Approved for 60+ Airports](https://airportindustry-news.com/aurrigo-and-aviation-solutions-to-deploy-autonomous-baggage-vehicles/)
- [EVIE Autonomous Air Side Systems](https://evieautonomous.com/air-side/)

### Surveys and Taxonomies
- [LLM4Drive: A Survey of Large Language Models for Autonomous Driving](https://arxiv.org/abs/2311.01043)
- [LLM4AD: Concept, Review, Benchmark, Experiments, and Future Trends](https://arxiv.org/html/2410.15281v4)
- [Awesome-LLM4AD Repository](https://github.com/Thinklab-SJTU/Awesome-LLM4AD)
- [Empowering Autonomous Driving with LLMs: A Safety Perspective](https://arxiv.org/html/2312.00812v3)
- [Vision-Language-Action Models for Autonomous Driving: Past, Present, Future](https://arxiv.org/html/2512.16760v2)
