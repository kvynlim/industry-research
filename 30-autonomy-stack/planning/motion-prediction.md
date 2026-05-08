# Motion Prediction, Trajectory Forecasting, and World Models for Autonomous Driving

## Comprehensive Technical Report

---

## 1. State-of-the-Art Motion Prediction Models

### 1.1 MotionLM (Waymo, ICCV 2023)

MotionLM reformulates multi-agent motion prediction as a **language modeling task** by representing continuous trajectories as sequences of discrete motion tokens. This reconceptualization enables the direct application of autoregressive sequence modeling techniques to trajectory forecasting.

**Key Technical Innovations:**
- **Discrete Tokenization of Trajectories:** Continuous motion data is converted into a vocabulary of discrete motion tokens, creating a "language" of motion
- **Single Unified Objective:** Uses a standard language modeling loss (maximizing average log probability over sequence tokens), eliminating the need for anchor-based methods or explicit latent variable optimization
- **Autoregressive Joint Decoding:** Produces joint distributions over interactive agent futures in a single autoregressive decoding process, removing the need for post-hoc interaction heuristics
- **Temporal Causality:** Sequential factorization naturally enables temporally causal conditional rollouts, meaning predictions respect the arrow of time

**Results:** Ranked 1st on the Waymo Open Motion Dataset interactive challenge leaderboard. The language modeling framing is significant because it connects motion prediction to the massive body of work on large language models, suggesting that scaling laws and architectural innovations from NLP may transfer to motion prediction.

---

### 1.2 MTR / MTR++ (Motion Transformer, NeurIPS 2022 Oral / TPAMI 2024)

**MTR (Motion Transformer)** reformulates motion prediction as a two-stage optimization: **global intention localization** followed by **local movement refinement**.

**Key Technical Innovations:**
- **Learnable Motion Query Pairs:** Instead of dense goal candidate grids, MTR uses a small set of learnable motion query pairs where each pair is responsible for trajectory prediction and refinement for a specific motion mode. This stabilizes training and improves multimodal coverage
- **Global Intention Localization:** First identifies the high-level "intention" or destination region of each agent
- **Local Movement Refinement:** Then refines the detailed trajectory within that intention region
- **Spatial Intention Priors:** The query mechanism provides spatial priors that guide the model toward diverse but realistic motion modes

**MTR++** extends MTR to simultaneous multi-agent prediction with two key additions:
- **Symmetric Context Modeling:** Processes scene information in a balanced way across all agents, ensuring fair representation regardless of agent position
- **Mutually-Guided Intention Querying:** Agents' predicted future behaviors inform each other, creating scene-compliant trajectories that respect interactive dynamics

**Results:** MTR ranked 1st on both marginal and joint Waymo Open Motion Dataset leaderboards (NeurIPS 2022). MTR++ was the winning approach for the Waymo Motion Prediction Challenge in 2022 and 2023.

---

### 1.3 QCNet / QCNeXt (CVPR 2023 Workshop Winner)

QCNet adopts a **query-centric encoding paradigm** for joint multi-agent trajectory forecasting, endowing the scene encoder with three critical mathematical properties:

- **Permutation equivariance** across agent sets
- **Roto-translation invariance** in spatial dimensions
- **Translation invariance** in temporal dimensions

These properties enable accurate multi-agent forecasting and support **streaming processing** -- the ability to incrementally update predictions as new observations arrive without re-encoding the entire scene.

**Decoder Design:** Employs a multi-agent DETR-like decoder that models agents' interactions at future time steps, facilitating joint prediction. The authors demonstrated that joint prediction models outperform marginal prediction models even when evaluated on marginal metrics -- an important finding that suggests interaction modeling is universally beneficial.

**Results:** 1st place on the Argoverse 2 multi-agent motion forecasting benchmark (CVPR 2023 Workshop on Autonomous Driving).

---

### 1.4 Wayformer (Waymo)

Wayformer explores a **surprisingly simple yet effective** approach: using homogeneous attention mechanisms across all input modalities rather than specialized modules for different input types.

**Architecture:**
- Unified attention-based scene encoder and decoder
- Processes road geometry, lane connectivity, traffic light states, and agent motion histories through the same attention mechanism

**Three Fusion Strategies Investigated:**
1. **Early Fusion:** Combines all inputs at the initial stage -- simple and modality-agnostic
2. **Late Fusion:** Processes modalities separately before integration
3. **Hierarchical Fusion:** Structures fusion across multiple levels

**Efficiency Strategies:**
- Factorized attention (decomposing attention operations)
- Latent query attention (using learned queries for reduced computation)

**Key Finding:** Early fusion proved surprisingly effective despite its simplicity, achieving state-of-the-art results on both WOMD and Argoverse leaderboards. This challenges the assumption that modality-specific processing is necessary.

---

### 1.5 HiVT (Hierarchical Vector Transformer, CVPR 2022)

HiVT decomposes motion prediction into two hierarchical layers:

- **Local Context Extraction:** Captures fine-grained interactions in an agent's immediate neighborhood
- **Global Interaction Modeling:** Captures long-range dependencies across the entire scene

**Invariance Properties:**
- **Translation-Invariant Scene Representation:** Maintains consistent predictions regardless of absolute agent position
- **Rotation-Invariant Spatial Learning Modules:** Extracts features robust to geometric transformations

These properties enable HiVT to make fast, accurate multi-agent predictions in a single forward pass with a remarkably small model size.

**Results:** State-of-the-art on Argoverse motion forecasting benchmark with high efficiency, making it a popular choice as a baseline and backbone in subsequent work.

---

### 1.6 LaneGCN (ECCV 2020 Oral)

LaneGCN pioneered the use of **graph neural networks on lane-level map representations** for motion prediction, replacing rasterized map inputs.

**Key Design Choices:**
- **Lane Graph Construction:** Builds a lane graph directly from vectorized map data, explicitly preserving road topology
- **Multiple Adjacency Matrices:** Captures diverse relationships within the lane network (predecessor, successor, left neighbor, right neighbor)
- **Along-Lane Dilation:** Addresses long-range dependencies across connected road segments

**Four-Way Interaction Fusion:**
1. Actor-to-Lane: How agents relate to nearby road segments
2. Lane-to-Lane: How road segments relate to each other
3. Lane-to-Actor: How road context influences agent behavior
4. Actor-to-Actor: How agents influence each other

**Legacy:** LaneGCN established the paradigm of vectorized, graph-based map encoding that nearly all subsequent methods build upon. Its four-way interaction design remains influential.

---

### 1.7 SceneTransformer (ICLR 2022)

SceneTransformer introduced **joint prediction of all agents simultaneously** using a unified attention-based architecture.

**Key Innovations:**
- **Masked Sequence Modeling:** Inspired by language modeling, uses masking as a query mechanism. A single model can predict agent behavior in many ways -- marginally, jointly, or conditioned on specific agents' goals or full trajectories
- **Three-Dimensional Attention:** Combines attention across road elements, agent-to-agent interactions, and temporal sequences
- **Scene-Centric Prediction:** Rather than per-agent prediction, reasons about the entire scene holistically
- **Agent Permutation Equivariance:** The model is invariant to the ordering of agents

The masked approach elegantly unifies marginal prediction, joint prediction, and conditional prediction within a single framework. Conditioning on one agent's future trajectory to predict another's is achieved simply by unmasking the conditioning agent.

---

### 1.8 MultiPath++ (Waymo)

MultiPath++ advances the original MultiPath architecture with several key innovations:

- **Sparse Scene Encoding:** Replaces dense image-based encoding with compact polylines for road features and raw agent state vectors (position, velocity, acceleration)
- **Multi-Context Gating Fusion:** A context-aware fusion component that effectively combines heterogeneous scene elements
- **Learned Latent Anchor Embeddings:** End-to-end learned anchors replace static pre-defined trajectory clusters, enabling more flexible trajectory representation
- **Ensembling and Aggregation:** Explores ensemble techniques for probabilistic multimodal output

**Results:** State-of-the-art on both Argoverse and Waymo Open Dataset.

---

### 1.9 GoRela (Goal-Relative Prediction)

GoRela addresses a fundamental efficiency vs. accuracy tradeoff in multi-agent prediction:

- Encoding each agent in its own reference frame is computationally expensive
- Using a shared coordinate system is sample-inefficient

**Solution:** Leverages **pair-wise relative positional encodings** to represent geometric relationships between agents and map elements within a heterogeneous spatial graph. This achieves viewpoint invariance while allowing pre-computed map embeddings to be reused offline.

**Goal Prediction:** Predicts agent goals on the lane graph to enable diverse and context-aware multimodal prediction. Separates the problem into offline map processing and online agent reasoning.

---

### 1.10 MotionDiffuser (CVPR 2023 Highlight)

MotionDiffuser applies **diffusion models** to multi-agent motion prediction, representing a fundamentally different approach from discriminative methods.

**Key Innovations:**
- **Diffusion-Based Generation:** Learns multimodal distributions of future trajectories through iterative denoising
- **Single L2 Loss Objective:** Does not require trajectory anchors
- **PCA-Based Trajectory Compression:** Enhances performance and enables efficient exact log probability calculations
- **Constrained Sampling Framework:** Enables controllable trajectory generation using differentiable cost functions -- enforcing physical constraints, rule compliance, or creating tailored simulation scenarios
- **Permutation-Invariant Joint Prediction:** Naturally models joint distributions across multiple agents

**Results:** State-of-the-art on Waymo Open Motion Dataset for multi-agent prediction. The constrained sampling capability is particularly valuable for generating safety-critical test scenarios.

---

### 1.11 Notable 2024-2025 Models

**GenAD (Generalized Predictive Model, CVPR 2024 Highlight):**
- First large-scale video prediction model for autonomous driving
- Trained on 2000+ hours of diverse web-collected driving videos with text descriptions
- Built on latent diffusion with novel temporal reasoning blocks
- Zero-shot generalization to unseen driving datasets
- Adaptable as action-conditioned predictor or motion planner

**ViDAR (Visual Point Cloud Forecasting, 2024):**
- Pre-training approach that predicts future LiDAR point clouds from historical visual input
- Latent Rendering operator transforms visual embeddings into 3D geometric space
- Improvements: 3.1% NDS in 3D detection, ~10% error reduction in motion forecasting, ~15% collision rate reduction in planning

**Vista (NeurIPS 2024):**
- Generalizable driving world model with high-fidelity future prediction
- Novel losses for learning moving instances and structural information
- Latent replacement approach for coherent long-horizon rollouts
- Supports high-level (goal points, intentions) and low-level (trajectory, angle, speed) control simultaneously
- 55% FID and 27% FVD improvements over prior driving world models

---

## 2. World Models as Prediction Engines

### 2.1 How World Models Naturally Solve Prediction

A world model learns a compressed representation of environment dynamics and uses it to **simulate possible futures**. Unlike discriminative predictors that directly map observations to predicted trajectories, world models learn the underlying generative process of how scenes evolve.

**The Prediction-Generation Connection:**
- **Discriminative models** answer: "Given the past, what trajectories are likely?"
- **World models** answer: "Given the past and possible actions, what will the world look like?"

This shift is profound because:
1. **Prediction becomes a byproduct of understanding.** A model that truly understands how the world works can naturally predict what will happen next
2. **Action-conditioned prediction is native.** World models naturally answer "what if?" questions -- what happens if I accelerate, brake, or change lanes?
3. **Multimodal futures emerge naturally** from the stochastic generation process

### 2.2 Key World Models for Autonomous Driving

**GAIA-1 (Wayve, 2023):**
- Generative world model leveraging video, text, and action inputs
- Casts world modeling as unsupervised sequence modeling by mapping inputs to discrete tokens and predicting next tokens
- Demonstrates emergent understanding of geometry, scene dynamics, and contextual awareness
- The learned representation captures expectations of future events while generating realistic samples

**Copilot4D (ICLR 2024):**
- By Waabi (Urtasun et al.) -- first tokenizes sensor observations with VQVAE, then predicts future via discrete diffusion
- Enhanced Masked Generative Image Transformer adapted as discrete diffusion
- >65% reduction in Chamfer distance for 1-second point cloud prediction, >50% for 3-second prediction
- Addresses two key bottlenecks: managing complex unstructured observation spaces and scalable generative modeling

**OccWorld (2023):**
- World model built on 3D occupancy representation rather than bounding boxes
- Two-stage: reconstruction-based tokenizer converts 3D occupancy to discrete tokens, then GPT-like transformer generates future tokens
- Simultaneously predicts ego car movement and surrounding scene evolution
- Captures fine-grained 3D structure more expressively than object boxes
- Works with both vision and LiDAR sensors, no instance-level or map supervision required

**DriveDreamer (2023):**
- First world model built entirely from real-world driving data (nuScenes)
- Uses diffusion models to handle complex driving scene modeling
- Two-stage training: first learns traffic structure constraints, then develops future state anticipation
- Enables generation of realistic driving policies beyond just video synthesis

**Drive-WM (2023):**
- First driving world model compatible with existing end-to-end planning models
- Generates multiview video sequences through joint spatial-temporal modeling with view factorization
- Supports "driving into multiple futures based on distinct driving maneuvers"
- Demonstrates safe planning via image-based reward computation

**UniSim (CVPR 2023 Highlight):**
- Neural closed-loop sensor simulator converting single recorded logs into realistic multi-sensor simulations
- Neural feature grids reconstruct static backgrounds and dynamic actors
- Composition mechanisms synthesize LiDAR and camera data at novel viewpoints
- Enables closed-loop evaluation on safety-critical scenarios "as if it were in the real world"

### 2.3 Joint Prediction of All Scene Elements vs. Per-Agent Prediction

Traditional motion prediction operates **per-agent**: for each agent of interest, encode the scene from that agent's perspective and decode its future trajectory. This has several limitations:

| Aspect | Per-Agent Prediction | Joint Scene Prediction |
|--------|---------------------|----------------------|
| Consistency | No guarantee that predicted trajectories are mutually consistent | All predictions are generated together, ensuring consistency |
| Interactions | Interactions must be modeled explicitly or post-hoc | Interactions emerge naturally from joint generation |
| Scalability | Linear in number of agents (but repeated computation) | Amortized: all agents predicted simultaneously |
| Collision avoidance | Requires post-processing to avoid predicted collisions | Joint generation naturally avoids implausible configurations |
| Compute | Redundant scene encoding per agent | Single encoding shared across all agents |

World models inherently perform joint prediction -- they simulate the entire scene forward in time, producing consistent futures for all elements simultaneously.

### 2.4 Occupancy Flow Prediction vs. Trajectory Prediction

The Waymo Occupancy and Flow Prediction Challenge introduced an alternative representation for prediction:

**Trajectory Prediction:**
- Predicts a set of discrete future waypoints for each detected agent
- Outputs: (x, y) coordinates at future timestamps
- Requires object detection and tracking as prerequisites
- Cannot represent undetected or occluded agents
- Crisp but limited to tracked objects

**Occupancy Flow Prediction:**
- Predicts dense 256x256 bird's-eye-view grids showing where space will be occupied
- Occupancy grids: probability of each cell being occupied at each future timestep
- Flow fields: 2D displacement vectors showing how occupied regions move between timesteps
- Three sub-tasks: currently observed vehicles, currently occluded vehicles, and future flow

**Advantages of Occupancy Flow:**
1. **No tracking required:** Can predict space occupancy without maintaining identity-consistent tracks
2. **Handles occlusions natively:** Can predict where currently unseen agents will appear
3. **Represents uncertainty spatially:** Soft occupancy naturally encodes spatial uncertainty
4. **Aligns with planning:** Ego vehicle planning often uses occupancy grids; prediction in the same representation eliminates format conversion
5. **Captures non-agent dynamics:** Can represent space occupied by debris, construction zones, or other non-standard obstacles

World models that predict future 3D occupancy (like OccWorld) naturally produce this representation, bridging the gap between prediction and world modeling.

### 2.5 Scene-Level vs. Agent-Level Prediction

**Agent-Level Prediction (Traditional):**
- Input: one target agent + scene context
- Output: K possible trajectories for that agent
- Must be run N times for N agents
- Each prediction is independent unless explicitly coupled

**Scene-Level Prediction (World Models):**
- Input: entire current scene state
- Output: possible future scenes (all agents, all objects, road surface, etc.)
- One forward pass predicts everything
- Consistency is inherent

Scene-level prediction is more aligned with how planning systems consume predictions: a planner needs to understand the complete future scene, not individual agent trajectories in isolation.

### 2.6 Advantages of Generative Prediction

**Multimodal Futures:**
Generative models (diffusion, autoregressive, VAE) naturally produce diverse samples from learned distributions. Each generated future is a complete, coherent scenario rather than an isolated trajectory.

**Compositionality:**
Generative world models can combine learned dynamics with novel constraints at inference time (e.g., MotionDiffuser's constrained sampling).

**Scalable Data Utilization:**
World models can learn from unlabeled video (no annotation of trajectories needed), enabling training on orders of magnitude more data.

**Simulation and Planning:**
Generated futures can be used directly for planning -- evaluating candidate actions by "imagining" their consequences through the world model.

---

## 3. Interaction-Aware Prediction

### 3.1 Modeling Interactions Between Agents

Interaction modeling is perhaps the most critical and challenging aspect of motion prediction. Agents do not move independently -- their behaviors are coupled through physical constraints, social conventions, and strategic reasoning.

**Approaches to Interaction Modeling:**

**Graph Neural Networks (GNN-Based):**
- Represent agents as nodes and interactions as edges
- LaneGCN's actor-to-actor attention
- EvolveGraph: dynamic relational reasoning where interaction graphs evolve over time
- Strengths: explicit relational structure, interpretable interactions
- Weaknesses: requires defining graph connectivity heuristics

**Attention-Based Interaction:**
- Self-attention across agents captures pairwise relationships
- HiVT's local-global hierarchy: local attention for nearby agents, global attention for long-range interactions
- Wayformer: homogeneous attention across all scene elements including agents
- SceneTransformer: three-dimensional attention (spatial, agent, temporal)
- Strengths: learnable, flexible, handles varying numbers of agents
- Weaknesses: quadratic complexity in number of agents

**Social Force Models (Classical):**
- Model agents as particles subject to attractive/repulsive forces
- Forces include: goal attraction, collision avoidance repulsion, lane-keeping forces
- Social Force Model (Helbing & Molnar, 1995) remains foundational for pedestrian modeling
- Modernized versions learn force parameters from data
- Strengths: physically interpretable, computationally efficient
- Weaknesses: limited expressiveness, struggles with complex strategic behavior

### 3.2 Game-Theoretic Prediction

Game-theoretic approaches model agents as rational (or boundedly rational) players who strategically optimize their behavior while accounting for others' decisions.

**GameFormer (ICCV 2023):**
- Models prediction and planning as a multi-agent game
- **Hierarchical Transformer Decoder:** Implements level-k reasoning through iterative refinement
  - Level 0: Agents predict independently (non-strategic baseline)
  - Level 1: Each agent responds to others' Level-0 predictions
  - Level k: Each agent responds to others' Level-(k-1) predictions
- At each level, the decoder uses prediction outcomes from the previous level plus shared environmental context to refine the interaction process
- An agent's behavior at the current level is regulated to respond to other agents' behaviors from the preceding level
- State-of-the-art on Waymo interaction prediction task and nuPlan planning benchmark

**Game-Theoretic Advantages:**
1. **Captures strategic behavior:** Agents in traffic are strategic -- they signal, yield, or assert right-of-way based on expectations of others' responses
2. **Handles negotiation:** Merging, lane changing, and intersection crossing involve implicit negotiation
3. **Avoids "frozen robot" problem:** By modeling others as rational responders, the ego vehicle avoids overly conservative predictions

### 3.3 Conditional Prediction

Conditional prediction answers: "If Agent A does X, how will Agent B respond?"

**M2I (CVPR 2022):**
- Decomposes interactive prediction into **influencer-reactor** pairs
- Influencers' trajectories are predicted independently (marginal prediction)
- Reactors' trajectories are predicted conditioned on influencer predictions (conditional prediction)
- Combined via joint likelihood scoring
- Insight: many interactions have asymmetric causal structure (e.g., a vehicle entering a roundabout reacts to existing traffic)

**SceneTransformer's Masking Approach:**
- By selectively masking/unmasking agent futures, can condition on any subset of agents
- Provides a unified framework for marginal, joint, and conditional prediction
- Particularly useful for planning: "What will others do if I follow this plan?"

### 3.4 Joint Prediction of Interacting Agents

**FJMP (CVPR 2023):**
- Represents agent interactions as a **sparse directed interaction graph**
- Prunes the interaction graph into a Directed Acyclic Graph (DAG), establishing partial ordering among agents based on causal relationships
- Decomposes joint prediction into a sequence of marginal and conditional predictions following the DAG's topological order
- Uses a Directed Acyclic Graph Neural Network (DAGNN) for decoding
- Ranked 1st on INTERACTION dataset multi-agent leaderboard
- Produces more scene-consistent predictions than non-factorized approaches

**MotionLM's Autoregressive Joint Decoding:**
- Generates joint agent futures through a single autoregressive process
- Each token generation step is conditioned on all previously generated tokens (including other agents)
- Natural temporal causality ensures realistic interaction dynamics

**MTR++'s Mutually-Guided Intention Querying:**
- Agents' intention queries inform each other through cross-attention
- Creates bidirectional information flow between interacting agents
- Avoids the assumption of fixed influencer-reactor roles

---

## 4. Long-Horizon Prediction

### 4.1 The Horizon Challenge

Motion prediction quality degrades dramatically with prediction horizon:
- **1-3 seconds:** Kinematics-dominated; trajectory is largely determined by current velocity, acceleration, and road geometry
- **3-8 seconds:** Intent-dominated; where the agent is going (lane change, turn, stop) matters more than kinematics
- **8-30 seconds:** Goal-dominated; the agent's high-level destination and route drive the trajectory
- **>30 seconds:** Route/schedule-dominated; requires knowledge of the agent's plan, not just current observations

Most state-of-the-art models predict 6-8 seconds ahead (the Waymo challenge uses 8-second horizons). Beyond this, uncertainty explodes and traditional discriminative models fail.

### 4.2 Goal-Conditioned Prediction

Goal-conditioned prediction explicitly separates **where** an agent is going from **how** it gets there:

1. **Goal Prediction:** Estimate the distribution over possible destinations (typically on the lane graph)
2. **Path Prediction:** For each candidate goal, predict the trajectory to reach it
3. **Scoring:** Rank goal-trajectory pairs by likelihood

**MTR's Intention Localization** is a form of goal-conditioned prediction: learnable queries capture distinct destination modes, then local refinement generates the trajectory.

**GoRela** predicts goals on the lane graph, naturally decomposing prediction into goal selection and trajectory completion.

**TNT (Target-driven Trajectory Prediction):** Samples target endpoints from the lane graph, generates trajectory conditioned on each target, and scores the candidates.

### 4.3 Intent Prediction

Beyond geometric goals, intent prediction estimates **what the agent is trying to do** semantically:
- Is this vehicle going to change lanes?
- Is this pedestrian going to cross the street?
- Is this vehicle yielding or asserting right-of-way?

Intent prediction typically operates as a classification task upstream of trajectory prediction:
1. Classify agent intent (lane change left, lane change right, keep lane, turn, stop, etc.)
2. Condition trajectory prediction on the inferred intent
3. Weight predictions by intent probability

This two-stage approach naturally supports long-horizon prediction because intent captures the high-level plan that determines long-term trajectory.

### 4.4 Route/Destination Prediction

For even longer horizons:
- **Map matching:** Identify which roads/lanes the agent is likely following
- **Turn-by-turn route prediction:** Estimate probable routes through the road network
- **Destination prediction:** Estimate where the agent is ultimately headed (using priors from time of day, agent type, historical patterns)

These are primarily used in fleet prediction, traffic simulation, and urban planning rather than real-time autonomous driving.

### 4.5 How World Models Enable Longer Horizons

World models have a structural advantage for long-horizon prediction:

**Autoregressive Rollout:**
- Discriminative models predict the full trajectory in a single shot, requiring the model to learn the mapping from observations to distant future states directly
- World models predict one step at a time and feed predictions back as input, allowing indefinite rollout
- Each step only needs to model short-term dynamics, which is easier to learn
- Vista's latent replacement approach explicitly addresses coherent long-horizon rollouts

**Compounding Error vs. Compositional Understanding:**
- Single-shot discriminative models avoid compounding errors but must learn increasingly complex mappings for longer horizons
- Autoregressive world models may compound errors but can compose simple short-horizon dynamics into complex long-horizon behaviors
- Modern world models (GAIA-1, Copilot4D) mitigate compounding error through learned priors and diffusion-based generation

**Implicit Intent Modeling:**
- World models that process video or occupancy sequences implicitly capture agent intent through the patterns they learn
- GAIA-1 demonstrates "contextual awareness" -- understanding that a car at a red light will wait and then proceed

**Conditioning on Plans:**
- World models naturally support conditioning on ego plans: "what happens if I follow this trajectory?"
- This enables model-predictive control with the world model as the forward dynamics model
- Vista demonstrates this with multi-level control signals (goal points, trajectory, speed)

---

## 5. Airport-Specific Prediction Challenges

Airport environments present a unique and underexplored domain for motion prediction. While sharing fundamental challenges with on-road autonomous driving, airport operations introduce domain-specific complexities that require adapted approaches.

### 5.1 Aircraft Movement Prediction

**Pushback Prediction:**
- Aircraft pushback from gates is a highly constrained, low-speed maneuver
- Prediction inputs: flight schedule data, gate assignment, pushback clearance timing
- Challenges: variable pushback durations, tug vehicle coordination, adjacent gate conflicts
- Unlike road vehicles, aircraft during pushback are externally controlled (by tow tractors) with very limited maneuverability

**Taxi Trajectory Prediction:**
- Aircraft taxi along designated taxiways following ATC clearances
- The taxiway network forms a graph analogous to the road network in autonomous driving
- Key differences from road prediction:
  - Routes are largely pre-determined by ATC clearances
  - Speed profiles are more constrained (typical taxi speeds: 10-20 knots)
  - Aircraft have much larger turning radii than road vehicles
  - Wingspan creates complex collision boundaries (not point-like agents)
- Prediction is primarily about **timing** rather than **path**: the path is usually known, but when the aircraft will reach each point is uncertain

**Relevant Data Sources:**
- ASDE-X (Airport Surface Detection Equipment, Model X): radar-based surface surveillance providing position updates every ~1 second
- ADS-B surface messages: GPS-based position reports from equipped aircraft
- SWIM (System Wide Information Management): FAA data sharing platform
- Airport CDMS (Collaborative Decision Making System): flight schedule and operational data

### 5.2 Ground Vehicle Movement Prediction

Airport aprons host a diverse fleet of ground service equipment (GSE), each with distinct movement patterns:

**Tow Tractors / Tugs:**
- Move between fixed points (gates, hangars, maintenance areas)
- Follow designated vehicle lanes on the apron
- Speed: 5-15 mph with frequent stops
- Prediction challenge: which aircraft they are servicing next (scheduling dependency)

**Belt Loaders:**
- Position at aircraft cargo doors during ground handling
- Movement limited to immediate vicinity of aircraft
- Prediction tied to baggage/cargo operations schedule

**Fuel Trucks:**
- Route between fuel depot and aircraft gates
- Service sequence depends on fueling schedule
- Large vehicles with limited maneuverability

**Catering Trucks, Lavatory Trucks, Ground Power Units:**
- Each has characteristic approach angles and positions relative to aircraft
- Movement is highly scheduled and procedural

**Unique Ground Vehicle Prediction Challenges:**
- Vehicles operate in a semi-structured environment (painted lanes but less enforcement than roads)
- Movement patterns are tied to flight schedules and airline procedures
- Right-of-way rules differ from road traffic (aircraft always have priority)
- High density of different vehicle types in small areas during turnaround operations
- No standardized "rules of the road" across airports

### 5.3 Pedestrian Prediction on Apron

Ground crew pedestrian behavior on airport aprons is fundamentally different from urban pedestrian prediction:

- **Goal-directed with known goals:** Crew members move between specific equipment and aircraft doors/positions
- **Task-dependent trajectories:** A marshaller walks to a specific position, wing walkers go to wingtips, ground crew approaches cargo doors
- **PPE and safety constraints:** Must stay within designated walking paths, avoid jet blast zones, propeller arcs, and active vehicle lanes
- **Team coordination:** Ground handling involves coordinated teams whose movements are interdependent
- **Low-visibility challenges:** Operations continue in rain, fog, darkness with limited visibility

**Prediction Approaches:**
- Task-sequence models: predict the crew member's current task and associated movement pattern
- Role-based prediction: different roles (marshaller, chock handler, headset operator) have distinct and predictable movement patterns
- Team-coordination models: predict crew movements as a coordinated group, not independently

### 5.4 Highly Structured but Complex Movement Patterns

Airport operations exhibit a paradox: individual movements are highly procedural and predictable, but the overall system is complex due to:

- **Temporal coupling:** Many operations must happen in sequence (arrive gate -> chocks -> bridge -> doors -> services)
- **Resource constraints:** Limited gates, taxiways, runways create dependencies
- **Cascading delays:** A delay in one operation propagates through the system
- **Multi-stakeholder coordination:** Airlines, ground handlers, ATC, airport authority all influence operations

This structure suggests that **graph-based world models** (similar to LaneGCN's lane graph approach) could be particularly effective, with the taxiway/apron layout as the spatial graph and the operational sequence as the temporal graph.

### 5.5 Integration with Flight Schedule Data

Unlike road traffic, airport movements are largely **scheduled**:

- Flight arrival/departure times are known hours in advance
- Gate assignments are planned (though subject to change)
- Ground handling procedures have standard durations
- Crew and equipment are allocated to specific flights

**This creates a unique opportunity for prediction:**
- Prior knowledge of upcoming events (e.g., a flight arriving in 10 minutes triggers predictable ground handling mobilization)
- Schedule adherence as a prediction feature
- Deviation from schedule as an anomaly signal
- Integration of ACARS (Aircraft Communications Addressing and Reporting System) messages for real-time schedule updates

**Recommended Approach: Hybrid Prediction**
1. **Schedule-based prior:** Start with the planned sequence and timing of operations
2. **Observation-based refinement:** Use sensor data (cameras, radar, ADS-B) to detect actual positions and update predictions
3. **World model for simulation:** A learned world model can generate the likely sequence of events given current state and schedule, producing multi-step predictions of how the apron scene will evolve

### 5.6 Predicting Gate Operations Sequences

Gate turnaround is a complex, multi-step process with interdependencies:

```
Typical Turnaround Sequence:
1. Aircraft arrives and parks at gate
2. Chocks placed, engines shut down
3. Jet bridge connects
4. Passenger doors open
5. Ground power connected
6. Baggage unloading begins (belt loader approaches)
7. Fueling begins (fuel truck approaches)
8. Catering service (catering truck approaches)
9. Cabin cleaning
10. Water/lavatory service
11. New cargo/baggage loading
12. Fueling complete (fuel truck departs)
13. New passengers board
14. Jet bridge disconnects
15. Pushback clearance obtained
16. Tug connects and pushback begins
```

**Prediction as Sequence Modeling:**
- Each step has a characteristic duration distribution
- Some steps can occur in parallel (fueling, catering, baggage)
- Some steps have strict ordering constraints (chocks before bridge, bridge before doors)
- The entire sequence can be modeled as a **temporal graph** with nodes (tasks) and edges (dependencies)

**World Model Approach:**
A world model trained on turnaround sequences could:
- Predict the timing of each step given current progress
- Identify delays early (if baggage unloading is slow, predict delayed departure)
- Generate realistic turnaround scenarios for planning and optimization
- Handle the compositional nature of the process (different aircraft types, different airlines have different procedures)

This is structurally similar to MotionLM's language modeling approach -- the turnaround sequence is a "language" of operations that can be modeled autoregressively.

### 5.7 Applying Autonomous Driving Prediction to Airports

Several autonomous driving prediction paradigms transfer well to airport environments:

| AD Paradigm | Airport Application |
|-------------|-------------------|
| Lane graph (LaneGCN) | Taxiway/apron layout graph |
| Goal-conditioned prediction (GoRela, MTR) | Gate/runway assignment as goals |
| Joint multi-agent prediction (SceneTransformer) | Coordinated ground handling team prediction |
| Game-theoretic (GameFormer) | Aircraft-vehicle-pedestrian right-of-way negotiation |
| Occupancy flow prediction | Apron area occupancy prediction for safety zones |
| World model rollout (GAIA-1, OccWorld) | Turnaround sequence simulation and what-if analysis |
| Conditional prediction (M2I, FJMP) | "If this aircraft pushes back, how do adjacent vehicles react?" |
| Diffusion-based prediction (MotionDiffuser) | Generating diverse gate operation scenarios for robustness |

**Key Adaptations Needed:**
1. **Flight schedule integration:** No analog in road driving; requires fusing structured database information with sensor observations
2. **Role-based agent modeling:** Different vehicle/person types have fundamentally different behavior models
3. **Sequence-level prediction:** Predicting multi-step operational sequences (turnaround), not just trajectories
4. **Safety zone modeling:** Jet blast zones, propeller arcs, and wing sweep areas create dynamic no-go zones
5. **Longer horizons:** Airport prediction may need 30-60 minute horizons vs. 8 seconds for driving
6. **Lower speeds, higher precision:** Airport movements are slower but require higher positional precision due to tight clearances

---

## 6. Summary and Key Insights

### Evolution of Motion Prediction

The field has evolved through several paradigms:

1. **Physics-based (pre-2018):** Constant velocity/acceleration models
2. **CNN + Rasterization (2018-2020):** Encode the scene as a bird's-eye-view image, use CNNs to predict
3. **Graph + Vectorization (2020-2022):** LaneGCN, VectorNet -- represent scenes as graphs, use GNNs
4. **Transformer-based (2021-2023):** HiVT, Wayformer, SceneTransformer -- attention mechanisms replace hand-designed interaction modules
5. **Language/Diffusion-based (2023-present):** MotionLM, MotionDiffuser -- connect prediction to generative modeling
6. **World Model-based (2023-present):** GAIA-1, Copilot4D, OccWorld, Vista -- learn the world dynamics and derive prediction as a consequence

### Key Takeaways

1. **Joint prediction outperforms marginal prediction** -- even on marginal metrics (QCNet finding). Modeling interactions is always beneficial.

2. **Language modeling for trajectories** (MotionLM) is a surprisingly effective paradigm that may benefit from scaling laws and architectural innovations in NLP.

3. **World models as prediction engines** represent a paradigm shift: instead of training specialized prediction modules, learn the dynamics of the world and derive predictions as rollouts.

4. **Occupancy flow prediction** is a complementary representation to trajectory prediction that handles occlusions, untracked objects, and spatial uncertainty more naturally.

5. **Game-theoretic approaches** (GameFormer) are essential for modeling the strategic aspects of multi-agent interaction that purely data-driven approaches may miss.

6. **Airport environments** are a promising but underexplored application domain where the structured nature of operations, availability of schedule data, and safety criticality make world model-based prediction particularly valuable.

7. **The convergence of prediction and planning** is accelerating: models like GenAD, Vista, and Drive-WM blur the boundary between predicting what will happen and deciding what to do.

---

*Report compiled March 2026. Based on published research through early 2025.*
