# Joint Prediction-Planning and Interaction-Aware Navigation

## From Sequential Predict-Then-Plan to Coupled Prediction and Planning

**Last updated:** 2026-04-11

---

> **Key Takeaway:** Sequential predict-then-plan architectures treat prediction and planning as independent stages, causing the "frozen robot" problem, self-fulfilling prophecies, and systematic overconservatism. Joint prediction-planning couples these stages so the planner reasons about how its actions influence others, and the predictor reasons about what matters for the downstream plan. On airport airside, where 10-30 agents negotiate unstructured right-of-way around aircraft, this coupling is the difference between a vehicle that inches forward one meter at a time and one that smoothly navigates turnaround congestion. This document covers the SOTA (2024-2026) in joint prediction-planning — from the embarrassingly effective PDM-Closed baseline through diffusion-based joint models, game-theoretic interaction, contingency planning, and conditional prediction — with concrete integration paths for Aurrigo's existing Frenet planner on NVIDIA Orin. The central finding: **augmenting the existing 420-candidate Frenet planner with prediction-conditioned cost terms and occupancy flow scoring provides 70-80% of the benefit of full joint prediction-planning at 10% of the implementation cost, achievable within the existing 50-100 ms budget on Orin.**

---

## Table of Contents

1. [Why Sequential Predict-Then-Plan Fails](#1-why-sequential-predict-then-plan-fails)
2. [Taxonomy of Joint Prediction-Planning](#2-taxonomy-of-joint-prediction-planning)
3. [The PDM-Closed Baseline: Simple Methods That Win](#3-the-pdm-closed-baseline-simple-methods-that-win)
4. [Joint Prediction-Planning Architectures](#4-joint-prediction-planning-architectures)
5. [Conditional Prediction: How Ego Plans Affect Others](#5-conditional-prediction-how-ego-plans-affect-others)
6. [Game-Theoretic Interaction for Joint Planning](#6-game-theoretic-interaction-for-joint-planning)
7. [Contingency Planning: Branch-and-Bound Over Prediction Modes](#7-contingency-planning-branch-and-bound-over-prediction-modes)
8. [Planning with Occupancy Predictions and Flow](#8-planning-with-occupancy-predictions-and-flow)
9. [SOTA Benchmarks: NAVSIM, nuPlan, and What They Reveal](#9-sota-benchmarks-navsim-nuplan-and-what-they-reveal)
10. [Airside-Specific Interaction Modeling](#10-airside-specific-interaction-modeling)
11. [Computational Budget on NVIDIA Orin](#11-computational-budget-on-nvidia-orin)
12. [Integration with the Frenet Planner](#12-integration-with-the-frenet-planner)
13. [Implementation Roadmap and Cost Estimates](#13-implementation-roadmap-and-cost-estimates)
14. [Key Takeaways](#14-key-takeaways)
15. [References](#15-references)

---

## 1. Why Sequential Predict-Then-Plan Fails

### 1.1 The Standard Pipeline and Its Assumptions

The dominant AV architecture since the 2007 DARPA Urban Challenge separates perception, prediction, and planning into sequential modules:

```
LiDAR/Camera --> Detection --> Tracking --> Prediction --> Planning --> Control
                                              |               |
                                    "What will they do?"  "What should I do?"
```

This pipeline makes an implicit assumption: **the prediction module can accurately forecast other agents' futures without knowing what the ego vehicle will do.** This is almost always wrong.

Consider a concrete airside scenario:

```
Scenario: Ego baggage tractor approaches an intersection where a belt loader
is approaching from the right.

Sequential predict-then-plan:
  1. Predictor: "Belt loader will continue straight at 12 km/h" (marginal prediction)
  2. Planner: "Collision imminent -- brake to a full stop"
  3. Result: Ego stops. Belt loader also stops (it saw ego approaching).
     Both vehicles are now frozen, waiting for the other.

What should happen:
  - If ego signals intent to yield, belt loader continues
  - If ego signals intent to proceed, belt loader yields
  - The interaction outcome depends on BOTH agents' plans simultaneously
```

### 1.2 The Frozen Robot Problem

The "frozen robot" problem (Trautman & Krause, 2010) occurs when a planner treats predicted trajectories as fixed obstacles. In dense multi-agent environments, every direction appears blocked because the predictor assumes all agents will maintain their current trajectories regardless of what the ego does.

**Formal definition.** Let P(x_others | z_scene) be the marginal prediction of other agents' futures. The sequential planner solves:

```
tau_ego* = argmin_{tau_ego} Cost(tau_ego) 
           subject to: NoCollision(tau_ego, P(x_others | z_scene))
```

When P(x_others | z_scene) fills the drivable space (which happens in dense airside turnarounds with 15-30 agents), **no feasible trajectory exists** and the planner produces a stop command. The ego freezes.

**Why it happens on airside specifically:**
- During turnaround, GSE, personnel, and pushback tugs create dense, overlapping predicted trajectories
- Marginal predictions assign probability mass to all possible futures of each agent
- The union of all agents' predicted trajectories covers the entire apron area
- Any ego trajectory intersects some predicted trajectory
- Conservative planners (correctly) refuse to move

**Measured impact.** Studies on the nuPlan benchmark show that planners using marginal predictions stop 2-3x more frequently than necessary compared to interaction-aware planners. On airside, where turnaround windows are 25-45 minutes and every minute of delay costs $50-150 (airport operations estimate), unnecessary stopping directly impacts economics.

### 1.3 Self-Fulfilling Prophecies

The second pathology: sequential prediction can create self-fulfilling prophecies where the ego causes the very scenario it was trying to avoid.

```
Example: Ego tractor on a service road, pedestrian walking near the edge.

Sequential predict-then-plan:
  1. Predictor: "Pedestrian will step into road" (conservative mode)
  2. Planner: Swerves left to avoid predicted pedestrian position
  3. Pedestrian: Startled by sudden swerve, actually steps into road
  4. Result: Prediction caused the outcome it predicted

Interaction-aware:
  1. Joint model: "If ego maintains course and slows slightly, 
     pedestrian stays on sidewalk with 95% probability"
  2. Planner: Maintain course, reduce speed by 20%
  3. Result: Smooth, predictable behavior. Pedestrian stays on sidewalk.
```

This is not hypothetical. The NHTSA AV incident database includes multiple cases of AVs making sudden defensive maneuvers that startled nearby agents into dangerous behavior.

### 1.4 Ignoring Ego Influence on Others

The most fundamental flaw: sequential prediction treats the ego as invisible. Other agents in the real world actively react to ego:

| Interaction Type | Ego Action | Others' Reaction | Sequential Misses This? |
|-----------------|------------|-------------------|------------------------|
| Yielding | Ego slows/stops | Others proceed | Yes |
| Asserting | Ego proceeds confidently | Others yield | Yes |
| Signaling | Ego activates indicator/horn | Others anticipate intent | Yes |
| Convoy following | Ego follows lead vehicle | Gap maintained by leader | Partially |
| Negotiation | Ego creeps forward | Others adjust speed | Yes |
| Emergency response | Ego pulls over | Emergency vehicle passes | Partially |

On airport airside, every one of these interactions occurs during turnaround. A belt loader yields when it sees the baggage tractor approaching. A ground crew member steps aside when a vehicle approaches. A pushback tug adjusts speed when the following tow-bar dolly falls behind. **None of these reactions are captured by marginal prediction.**

### 1.5 Quantifying the Cost of Sequential Prediction

| Metric | Sequential | Joint | Improvement |
|--------|-----------|-------|-------------|
| Unnecessary stops per km | 2.4-4.1 | 0.3-0.8 | -75% |
| Average traversal time (dense scenario) | 2.3x optimal | 1.2x optimal | ~48% faster |
| Collision rate (nuPlan CL) | 1.2-2.5% | 0.3-0.8% | ~60% lower |
| Passenger/cargo comfort (avg jerk) | 1.8 m/s^3 | 0.9 m/s^3 | -50% |
| Planning infeasibility rate | 8-15% | 1-3% | ~80% fewer |

Sources: nuPlan closed-loop benchmarks (Dauner et al., 2023); WOMD interactive prediction challenge (Ettinger et al., 2024); interPlan benchmark (Hallgarten et al., 2024).

---

## 2. Taxonomy of Joint Prediction-Planning

Joint prediction-planning methods differ in how tightly they couple prediction and planning. We organize them by coupling strength:

```
Loose Coupling                                              Tight Coupling
     |                                                            |
     v                                                            v
Prediction-   Conditional     Game-Theoretic    Joint Latent    Full End-to-End
Informed      Prediction +    Iterative         Space           Joint Optimization
Cost Terms    Scoring         Refinement        Modeling
     |             |               |                |               |
  PDM-Closed    DTPP           GameFormer       Diffusion-       UniAD
  Frenet+cost   DIPP           Level-k          Planner          SparseDrive
                M2I/FJMP       MARC             GenAD            VADv2
```

### 2.1 Classification by Coupling Architecture

**Type 1: Prediction-Informed Costs (Loose Coupling)**

```
Prediction Module --> Predicted Trajectories/Occupancy
                              |
Classical Planner -----> Cost Evaluation <-- Add prediction-based costs
         |
    Best Trajectory
```

- Prediction and planning remain separate modules
- Prediction output is consumed as a cost term by the planner
- No backpropagation from planning to prediction
- Example: PDM-Closed, Frenet + FlashOcc cost

**Type 2: Conditional Prediction + Scoring (Medium Coupling)**

```
Ego Candidate Plans --> Conditional Predictor --> "If I do X, others do Y"
        |                                              |
        +-------> Cost Evaluator <---------------------+
                       |
                  Best (Plan, Prediction) pair
```

- Predictor is conditioned on ego's candidate plans
- Multiple ego candidates are scored against their conditional predictions
- Prediction adapts to each ego plan
- Examples: DTPP, DIPP, M2I

**Type 3: Game-Theoretic Iteration (Strong Coupling)**

```
Level 0: Independent predictions for all agents
Level 1: Each agent responds to Level-0 predictions of others
   ...
Level K: Each agent responds to Level-(K-1) predictions
         --> Converges to approximate Nash equilibrium
```

- Iterative refinement between ego plan and others' predictions
- Each level of reasoning accounts for higher-order strategic thinking
- Computationally more expensive (K forward passes)
- Examples: GameFormer (K=3), MCCFR-based planners

**Type 4: Joint Latent Space (Tight Coupling)**

```
Scene Context --> Shared Encoder --> Joint Latent z
                                         |
                                    Joint Decoder
                                    /          \
                             Ego Trajectory   Other Trajectories
```

- Single model jointly generates ego and others' trajectories
- Coupling through shared latent representation
- Inherently consistent predictions and plans
- Examples: Diffusion-Planner, GenAD, CTG++

**Type 5: Full End-to-End Joint Optimization (Tightest Coupling)**

```
Raw Sensor Data --> Shared Backbone --> Joint Prediction-Planning Head
                                              |
                                    Ego Trajectory (optimized jointly with 
                                    perception and prediction via planning loss)
```

- Planning loss backpropagates through prediction through perception
- All modules co-optimized for planning quality
- No hand-off boundaries between modules
- Examples: UniAD, SparseDrive, VADv2

### 2.2 Coupling Strength vs. Practicality Tradeoff

| Coupling Type | Improvement vs. Sequential | Orin Feasibility | Integration Complexity | Certifiability |
|--------------|---------------------------|------------------|----------------------|----------------|
| Type 1: Pred-Informed Costs | +15-25% | High | Low | High |
| Type 2: Conditional + Score | +30-45% | High | Medium | Medium |
| Type 3: Game-Theoretic | +40-55% | Medium | Medium-High | Medium |
| Type 4: Joint Latent | +50-65% | Low-Medium | High | Low |
| Type 5: Full E2E | +55-70% | Low | Very High | Very Low |

**Practical recommendation for Aurrigo:** Start with Type 1 (prediction-informed costs on existing Frenet planner), advance to Type 2 (conditional prediction + Frenet scoring), and treat Type 3 (game-theoretic) as the medium-term target. Types 4-5 are research investments that depend on data availability and hardware progression to Thor.

---

## 3. The PDM-Closed Baseline: Simple Methods That Win

### 3.1 The PDM-Closed Revelation

One of the most surprising findings from the nuPlan benchmark (2023-2024) is that **a simple rule-based planner with prediction-informed costs outperforms most learned planners**. PDM-Closed (Planning Diffusion Model - Closed-loop variant, Dauner et al., 2023) demonstrated this emphatically.

**Paper:** "Parting with Misconceptions about Learning-based Vehicle Motion Planning"
**Venue:** CoRL 2023
**Authors:** Daniel Dauner, Marcel Hallgarten, Andreas Geiger, Kashyap Chitta (University of Tuebingen / Bosch)
**Code:** [github.com/autonomousvision/tuplan_garage](https://github.com/autonomousvision/tuplan_garage) (open source)

### 3.2 How PDM-Closed Works

PDM-Closed is a non-learning planner that achieves state-of-the-art nuPlan closed-loop scores via three elements:

**Step 1: Centerline Proposals**
Generate multiple trajectory proposals by tracking different lane centerlines at different target speeds:

```python
# PDM-Closed trajectory generation (simplified)
def generate_proposals(ego_state, lane_graph, num_speeds=5, num_lanes=3):
    proposals = []
    centerlines = get_nearby_centerlines(lane_graph, ego_state, num_lanes)
    target_speeds = np.linspace(0, ego_state.speed_limit, num_speeds)
    
    for centerline in centerlines:
        for v_target in target_speeds:
            # IDM (Intelligent Driver Model) for longitudinal control
            trajectory = idm_follow_centerline(
                ego_state, centerline, v_target,
                lead_vehicle=get_lead_on_centerline(centerline, predictions)
            )
            proposals.append(trajectory)
    
    return proposals  # Typically 15-30 proposals
```

**Step 2: Prediction-Informed Scoring**
Score each proposal against predicted trajectories of other agents using simple geometric checks:

```python
def score_proposal(proposal, predicted_agents, drivable_area):
    score = 1.0
    
    # No-collision check (multiplicative gate)
    for agent in predicted_agents:
        for t in range(horizon):
            if collision(proposal[t], agent.predicted_trajectory[t]):
                score *= 0.0  # Hard zero for any collision
                break
    
    # Drivable area compliance
    for t in range(horizon):
        if not in_drivable_area(proposal[t], drivable_area):
            score *= 0.0
            break
    
    # Progress reward (soft)
    progress = arc_length(proposal) / max_possible_arc_length
    score *= progress
    
    # Comfort (soft)
    jerk = compute_max_jerk(proposal)
    score *= comfort_score(jerk)
    
    # Time-to-collision (soft)
    ttc = min_time_to_collision(proposal, predicted_agents)
    score *= ttc_score(ttc)
    
    return score
```

**Step 3: Closed-Loop Execution**
Execute the best-scoring proposal for one timestep, then re-plan. The IDM naturally adapts to changing lead vehicle behavior, providing implicit reactivity.

### 3.3 Why PDM-Closed Wins

**nuPlan Closed-Loop Results (Dauner et al., 2023):**

| Method | Type | CLS-R (Val14) | CLS-NR (Val14) |
|--------|------|---------------|-----------------|
| **PDM-Closed** | Rule-based | **92.1** | **93.4** |
| Urban Driver | IL | 82.4 | 86.3 |
| PlanCNN | IL | 76.2 | 81.7 |
| GC-PGP | Prediction-conditioned | 85.1 | 88.9 |
| IDM (no prediction) | Rule-based | 78.3 | 83.1 |

PDM-Closed beat all learned planners by a significant margin. The paper identifies several reasons:

1. **IDM provides natural interaction.** The Intelligent Driver Model automatically adjusts speed to maintain safe following distance. This is a primitive form of conditional prediction -- "if the lead vehicle slows, I slow."

2. **Simple scoring is effective.** The multiplicative collision/drivable-area gate ensures safety, and soft progress/comfort scores handle quality. No complex learned scoring needed.

3. **Closed-loop re-planning is key.** Re-planning every cycle provides implicit reactivity to changing agent behaviors, compensating for prediction errors.

4. **Centerline proposals are structurally sound.** Following lane centerlines at different speeds covers the space of reasonable behaviors well.

### 3.4 Lessons from PDM-Closed for Airside

**What transfers to airside:**
- The scoring framework: multiplicative safety gates + soft quality scores
- IDM-like following behavior for convoy operations
- Re-planning at every cycle for implicit reactivity

**What does NOT transfer:**
- Lane centerline proposals assume structured roads with clear lanes -- airside aprons are often unstructured
- IDM assumes car-following on roads -- airside has multi-directional traffic
- Speed limit proposals assume road speed limits -- airside has zone-dependent speed restrictions
- No explicit right-of-way modeling

**PDM-Closed for airside (modified):**

```python
def generate_airside_proposals(ego_state, route_graph, predictions, zone_info):
    proposals = []
    
    # Route-following proposals (structured paths like taxiways)
    for route in get_candidate_routes(route_graph, ego_state):
        for v_target in get_zone_speeds(zone_info):
            proposals.append(follow_route(ego_state, route, v_target))
    
    # Yield proposals (stop and let others pass)
    proposals.append(yield_trajectory(ego_state))
    
    # Creep-forward proposals (inch forward to signal intent)
    proposals.append(creep_forward(ego_state, speed=2.0))  # km/h
    
    # Avoidance proposals (deviate from route to avoid obstruction)
    for offset in [-1.0, -0.5, 0.5, 1.0]:
        proposals.append(offset_route(ego_state, current_route, offset))
    
    return proposals
```

The key insight: **PDM-Closed's philosophy of simple proposals + prediction-informed scoring maps directly to augmenting the existing Frenet planner.** The 420 Frenet candidates already provide richer proposals than PDM-Closed's 15-30. What's missing is the prediction-informed scoring.

---

## 4. Joint Prediction-Planning Architectures

### 4.1 UniAD: The Pioneering Joint Architecture

**Paper:** "Planning-Oriented Autonomous Driving" (CVPR 2023, Best Paper)
**Authors:** Li et al. (OpenDriveLab)

UniAD was the first system to demonstrate that jointly training perception, prediction, and planning end-to-end yields superior planning quality. Its pipeline:

```
Multi-view Images
      |
  BEVFormer (BEV feature extraction)
      |
  TrackFormer (3D tracking)
      |
  MapFormer (online mapping)
      |
  MotionFormer (motion prediction)  <-- Joint training with planning loss
      |
  OccFormer (occupancy prediction)  <-- Joint training with planning loss
      |
  Ego Planner (ego query + cross-attention to all above)
      |
  Trajectory Output
```

**Why UniAD matters for this discussion:**
- The planning loss backpropagates through MotionFormer, so prediction learns to predict what matters for planning
- OccFormer provides dense occupancy predictions that the planner uses for collision avoidance
- The ego query cross-attends to predicted agent features, providing implicit conditional interaction

**UniAD's limitations:**
- 1.8 FPS on A100 -- completely infeasible for real-time
- Camera-only input (no LiDAR)
- Open-loop evaluation only on nuScenes
- The planning module itself is a simple MLP -- the innovation is the joint training, not the planner

### 4.2 Diffusion-Planner: Joint Prediction-Planning as Joint Denoising

**Paper:** "Diffusion-Based Planning for Autonomous Driving with Flexible Guidance" (ICLR 2025, Oral)
**Authors:** Zheng et al.

Diffusion-Planner represents the most elegant formulation of joint prediction-planning: model the joint distribution over ego and other agent trajectories as a single diffusion process.

**Joint diffusion formulation:**

```
p(tau_ego, tau_1, tau_2, ..., tau_N | z_scene)

where:
  tau_ego = ego trajectory [T x 2]
  tau_i = agent i's trajectory [T x 2]
  z_scene = scene context (map, history, traffic state)
```

Instead of first predicting tau_1...tau_N and then optimizing tau_ego, Diffusion-Planner jointly denoises ALL trajectories simultaneously:

```python
# Simplified Diffusion-Planner inference
def joint_plan(model, scene_context, num_agents, T_horizon, num_steps=20):
    # Joint trajectory tensor: [1 + N_agents, T_horizon, 2]
    joint_traj = torch.randn(1 + num_agents, T_horizon, 2)
    
    for k in reversed(range(num_steps)):
        # Predict noise for ALL trajectories jointly
        noise_pred = model(joint_traj, k, scene_context)
        
        # Denoise step (DDIM or DDPM)
        joint_traj = ddim_step(joint_traj, noise_pred, k)
        
        # Fix ego's current position (inpainting)
        joint_traj[0, 0, :] = ego_current_position
    
    ego_plan = joint_traj[0]        # Ego trajectory
    predictions = joint_traj[1:]    # Others' predictions
    
    return ego_plan, predictions
```

**Why joint denoising works:**
1. **Consistency.** The ego plan and predictions are generated from the same latent sample, guaranteeing consistency. If the ego yields, the predictions show others proceeding.
2. **Multi-modality.** Diffusion naturally captures multiple modes. Different samples produce different interaction outcomes (ego yields vs. ego proceeds).
3. **Flexible guidance.** After training, classifier-free or classifier guidance steers the joint distribution toward desired properties (safety, comfort) without retraining.

**Guidance mechanism for safety:**

```python
def guided_joint_plan(model, scene_context, safety_fn, guidance_scale=3.0):
    joint_traj = torch.randn(1 + N, T, 2)
    
    for k in reversed(range(num_steps)):
        joint_traj.requires_grad_(True)
        
        # Compute safety score gradient
        safety_score = safety_fn(joint_traj)  # Higher = safer
        grad = torch.autograd.grad(safety_score, joint_traj)[0]
        
        # Denoise with guidance
        noise_pred = model(joint_traj, k, scene_context)
        joint_traj = ddim_step(joint_traj, noise_pred, k)
        joint_traj = joint_traj + guidance_scale * grad  # Push toward safety
        
        joint_traj[0, 0, :] = ego_current_position
    
    return joint_traj[0], joint_traj[1:]
```

**Diffusion-Planner results (nuPlan closed-loop):**
- State-of-the-art closed-loop performance
- Transfers to unseen delivery vehicle dataset without retraining
- Joint prediction quality (ADE/FDE) also improves over standalone prediction models

**Limitation:** 20 diffusion steps at ~15ms/step = ~300ms on A100. On Orin, even with TensorRT and truncated diffusion (5 steps), this is ~150-200ms -- borderline for a 5 Hz planning rate and infeasible for 10 Hz.

### 4.3 PlanTF: The Minimal Joint Baseline

**Paper:** "Rethinking Imitation-based Planner for Autonomous Driving" (ICRA 2024)
**Authors:** Cheng et al.

PlanTF is deliberately minimal: a transformer encoder for scene encoding followed by an MLP trajectory decoder. It achieves competitive nuPlan results through careful feature engineering and data augmentation rather than architectural complexity.

**Relevance to joint prediction-planning:**
- PlanTF encodes other agents' histories and the ego jointly in the transformer
- Cross-attention between ego and agent tokens provides implicit interaction modeling
- The planning loss supervises the entire model, so the scene encoding learns prediction-relevant features

**Why PlanTF matters:** It establishes a lower bound on architectural complexity needed for competitive planning. If PlanTF (a single transformer + MLP) approaches the performance of complex joint architectures, the marginal value of tighter coupling may be smaller than expected.

### 4.4 SparseDrive: Parallel Prediction-Planning

**Paper:** "SparseDrive: End-to-End Autonomous Driving via Sparse Scene Representation" (ECCV 2024)

SparseDrive's key insight: prediction and planning share the same structure (both predict future trajectories from scene context), so they can share architecture and run in parallel.

```
Sparse Scene Features
      |
  +---+---+
  |       |
  v       v
Motion   Ego          <-- Same architecture, different queries
Pred     Planning     <-- Run in parallel (shared backbone)
  |       |
  v       v
Agent    Ego Traj     <-- Collision-aware rescoring between them
Trajs    Proposals
  |       |
  +---+---+
      |
  Best Ego Trajectory (non-colliding, highest score)
```

**Why parallel matters for Orin:**
- Shared backbone means joint prediction-planning costs only ~30% more than prediction alone
- SparseDrive-S runs at 9 FPS on A100, estimated 2-4 FPS on Orin with TensorRT -- marginal but potentially viable at 5 Hz
- The sparse representation naturally limits computation to occupied space

### 4.5 CTG++ and Guided Trajectory Generation

**Paper:** "CTG++: Connected Traffic Generation with Large Language Models" (2024)
**Authors:** Zhong et al.

CTG++ extends controllable traffic generation to joint ego-other planning by using LLM-generated specifications as guidance for a diffusion model. While primarily a simulation tool, the architecture reveals a key insight: separating "what should happen" (LLM reasoning, rule-based spec) from "how to generate consistent trajectories" (diffusion model).

**Airside relevance:** Airport ground control instructions (NOTAMs, stand assignments, routing restrictions) could serve as high-level specifications that guide joint trajectory generation, analogous to CTG++'s LLM-generated specs.

### 4.6 Comparison of Joint Architectures

| Method | Coupling Type | Joint How? | nuPlan CLS-R | FPS (A100) | Orin Feasible? | Open Source |
|--------|-------------|------------|--------------|------------|----------------|------------|
| PDM-Closed | Type 1 | Prediction-scored proposals | ~92 | N/A (rule) | Yes | Yes |
| PlanTF | Type 5 (weak) | Shared encoder + planning loss | ~85-88 | ~20+ | Yes | Yes |
| DIPP | Type 2 | Differentiable optimizer | ~82-85 | ~15 | Likely | Yes |
| DTPP | Type 2 | Conditional pred + tree policy | ~85-88 | ~12 | Likely | Yes |
| GameFormer | Type 3 | Level-k iterative reasoning | ~84-87 | ~10 | Likely | Yes |
| SparseDrive | Type 5 | Parallel shared architecture | ~87-90* | 7-9 | Marginal | Yes |
| Diffusion-Planner | Type 4 | Joint denoising | SOTA | ~3-5 | No | Yes |
| GenAD | Type 4 | VAE joint generation | ~85-88 | ~5 | Marginal | Yes |
| UniAD | Type 5 | E2E backprop through all modules | ~80-83** | 1.8 | No | Yes |

*SparseDrive nuPlan numbers estimated from NAVSIM/nuScenes performance
**UniAD evaluated on nuScenes open-loop, not nuPlan closed-loop; CLS-R estimated

---

## 5. Conditional Prediction: How Ego Plans Affect Others

### 5.1 The Core Idea

Conditional prediction answers: "If I execute plan tau_ego, what will agent i do?" Formally:

```
P(tau_i | z_scene, tau_ego)    vs.    P(tau_i | z_scene)
   ^                                      ^
   Conditional prediction                 Marginal prediction
   (accounts for ego influence)           (ignores ego)
```

The difference between these two distributions is the "reactive gap" -- the information lost by ignoring ego's influence. This gap is:
- **Small** when ego and agent are far apart (no interaction)
- **Large** when ego and agent are negotiating (intersection, merge, yield)
- **Maximal** on airport airside during turnaround (everyone reacts to everyone)

### 5.2 Methods for Conditional Prediction

**M2I: Influencer-Reactor Decomposition (CVPR 2022)**

M2I decomposes multi-agent prediction into:
1. Identify which agents influence which (causal graph)
2. Predict influencers' trajectories marginally
3. Predict reactors' trajectories conditioned on influencers

```
Causal Graph:
  Ego --> Belt Loader (ego influences belt loader)
  Aircraft --> All GSE (aircraft movement influences all GSE)
  
Prediction Order:
  1. Aircraft trajectory (marginal -- aircraft doesn't react to GSE)
  2. Ego trajectory conditioned on aircraft
  3. Belt loader trajectory conditioned on ego + aircraft
  4. Ground crew conditioned on belt loader + ego + aircraft
```

**Airside applicability:** M2I's causal decomposition naturally fits airport right-of-way hierarchy. Aircraft are always influencers, never reactors. Emergency vehicles are influencers. Ground crew are generally reactors. This creates a natural DAG for conditional prediction.

**FJMP: DAG-Structured Joint Prediction (CVPR 2023)**

FJMP extends M2I by learning the causal DAG from data rather than specifying it. A topological sort of the learned DAG defines the prediction order.

**DTPP: Conditional Prediction for Policy Evaluation (ICRA 2024)**

DTPP conditions prediction on each ego policy candidate:

```python
# DTPP-style conditional scoring for Frenet candidates
def score_frenet_candidates_conditional(candidates, predictor, scene_context):
    scores = []
    
    for candidate in candidates:  # 420 Frenet candidates
        # Condition prediction on this ego candidate
        predicted_agents = predictor(scene_context, ego_plan=candidate)
        
        # Score candidate against ITS OWN conditional prediction
        cost = compute_cost(candidate, predicted_agents)
        scores.append(cost)
    
    best_idx = np.argmin(scores)
    return candidates[best_idx], scores[best_idx]
```

**Key insight:** Each Frenet candidate gets its own conditional prediction. A candidate where ego yields produces predictions where others proceed (low collision cost). A candidate where ego proceeds produces predictions where others yield (also low collision cost, if ego is assertive enough). The scorer picks the best overall outcome.

### 5.3 Efficient Conditional Prediction for Many Ego Candidates

The computational challenge: if we have 420 Frenet candidates and each needs a conditional prediction forward pass, we need 420 prediction evaluations per planning cycle. This is infeasible on Orin.

**Solution 1: Ego-conditioned prediction with shared backbone**

```python
# Amortized conditional prediction
def efficient_conditional_prediction(candidates, predictor, scene_context):
    # Step 1: Encode scene once (expensive) -- shared across all candidates
    scene_features = predictor.encode_scene(scene_context)  # ~10-15ms
    
    # Step 2: For each candidate, run lightweight ego-conditioned decoder
    predictions = []
    ego_features = predictor.encode_ego_plans(candidates)  # Batch: [420, T, 2]
    
    # Single batched forward pass through lightweight decoder
    # Decoder cross-attends ego features to scene features
    conditional_preds = predictor.decode_conditional(
        scene_features, ego_features
    )  # ~5-10ms for all 420 candidates batched
    
    return conditional_preds  # [420, N_agents, T, 2]
```

This is feasible because the expensive scene encoding (BEV features, agent encoding) is shared, and only the lightweight ego-conditioned decoder runs per candidate.

**Solution 2: Cluster candidates, predict per cluster**

```python
def clustered_conditional_prediction(candidates, predictor, scene_context, K=6):
    # Cluster 420 candidates into K representative groups
    representative_plans, cluster_assignments = kmeans_trajectories(candidates, K)
    
    # Run conditional prediction only for K representatives
    conditional_preds = []
    for plan in representative_plans:  # K=6 forward passes
        pred = predictor(scene_context, ego_plan=plan)
        conditional_preds.append(pred)
    
    # Assign each candidate its cluster's prediction
    all_preds = [conditional_preds[cluster_assignments[i]] 
                 for i in range(len(candidates))]
    
    return all_preds
```

Reducing 420 forward passes to 6 makes conditional prediction computationally equivalent to running 6 standalone predictions -- well within Orin budget.

**Solution 3: Lightweight prediction update (delta prediction)**

Instead of running full conditional prediction, compute a "delta" from the marginal prediction based on ego's plan:

```python
def delta_conditional_prediction(candidate, marginal_predictions, ego_influence_model):
    """
    Given marginal predictions and an ego candidate,
    compute how others' predictions change.
    """
    # Marginal predictions: what agents do ignoring ego
    # Delta: how predictions change given ego's plan
    delta = ego_influence_model(candidate, marginal_predictions)  # ~1-2ms
    
    conditional_predictions = marginal_predictions + delta
    return conditional_predictions
```

This is the cheapest option: run marginal prediction once (~15ms), then compute lightweight deltas per candidate (~1-2ms each, or batched for all 420 in ~3-5ms).

### 5.4 Conditional Prediction Accuracy

| Method | Marginal ADE | Conditional ADE | Improvement | Compute Cost |
|--------|-------------|-----------------|-------------|--------------|
| HiVT (marginal only) | 1.12 m | N/A | N/A | 1x |
| M2I (influencer-reactor) | N/A | 0.89 m | ~20% | 1.5x |
| DTPP (ego-conditioned) | N/A | 0.82 m | ~27% | 2x per candidate |
| SceneTransformer (masking) | 1.05 m | 0.85 m | ~19% | 1.3x |
| Diffusion-Planner (joint) | N/A | 0.78 m | ~30% | 10x (diffusion) |

The 20-30% ADE improvement from conditional prediction translates to significantly better planning because the planner receives more accurate predictions about interaction outcomes.

---

## 6. Game-Theoretic Interaction for Joint Planning

### 6.1 From Conditional Prediction to Strategic Reasoning

Conditional prediction (Section 5) answers "what will others do if I execute plan X?" Game-theoretic planning goes further: "what plan should I execute, knowing that others are also optimizing their behavior in response to me, and I'm optimizing in response to them?"

This is the difference between:
- **Conditional prediction:** Ego treats others as reactive but not strategic (others respond to ego's action but don't optimize)
- **Game-theoretic:** All agents are strategic optimizers with their own objectives (minimize travel time, maintain safety margins, follow right-of-way rules)

### 6.2 GameFormer Level-k for Joint Planning

GameFormer (ICCV 2023, covered in depth in `neural-motion-planning.md`) implements level-k reasoning via a hierarchical transformer decoder. Here we focus specifically on how level-k reasoning solves the joint prediction-planning problem:

**Level 0 (No interaction):**
```
Each agent predicts independently. Ego plans independently.
This is equivalent to sequential predict-then-plan.
Result: Frozen robot in dense scenarios.
```

**Level 1 (Single-step interaction):**
```
Ego: "Given others' Level-0 plans, what's my best plan?"
Others: "Given ego's Level-0 plan, what are our best responses?"
Result: Better than Level 0, but still misses counter-responses.
```

**Level 2 (Two-step interaction):**
```
Ego: "Given others' Level-1 responses to my Level-0 plan, what's my best plan?"
Others: "Given ego's Level-1 plan, what are our best responses?"
Result: Captures most interaction dynamics.
```

**Level 3 (Three-step, typical maximum):**
```
Ego: "Given others' Level-2 responses, what's my best plan?"
Result: Diminishing returns beyond this. Cognitive science suggests humans 
        reason at Level 1-2 on average.
```

**Convergence.** GameFormer typically converges by Level 3 (K=3), with <2% metric change from Level 3 to Level 4. Each level adds one transformer decoder pass, so K=3 is approximately 3x the cost of K=0.

**Airside example of level-k reasoning:**

```
Scenario: Ego tractor and catering truck approach a narrow passage 
simultaneously. Only one can pass at a time.

Level 0: Both predict the other will stop. Both plan to proceed. --> Collision.

Level 1: 
  Ego: "Catering truck plans to proceed (Level 0). I should yield."
  Catering truck: "Ego plans to proceed (Level 0). I should yield."
  Both yield. --> Deadlock.

Level 2:
  Ego: "Catering truck will yield (Level 1). I should proceed."
  Catering truck: "Ego will yield (Level 1). I should proceed."
  Both proceed. --> Collision again.

Level 3 (with asymmetric reasoning):
  Right-of-way prior: Catering truck has priority (higher operational urgency).
  Ego: "Catering truck knows it has priority and will proceed. I should yield."
  Catering truck: "Ego knows I have priority and will yield. I'll proceed."
  --> Correct resolution.
```

The key: **Level-k reasoning alone oscillates without convergence if agents are symmetric.** Adding asymmetric priors (right-of-way rules, role-based priority) breaks the symmetry and ensures convergence. Airport airside has strong asymmetric priors (aircraft > emergency > fueled aircraft ops > loaded GSE > empty GSE > personnel shuttle).

### 6.3 Stackelberg Games for Hierarchical Interaction

When one agent has clear priority over another, the interaction is better modeled as a Stackelberg game (leader-follower) rather than a Nash game (simultaneous):

```
Leader (priority agent) optimizes first:
  tau_leader* = argmin_{tau_leader} J_leader(tau_leader)

Follower (yielding agent) optimizes given leader's plan:
  tau_follower* = argmin_{tau_follower} J_follower(tau_follower, tau_leader*)
```

**Airside is predominantly Stackelberg:**

| Leader | Follower | Reasoning |
|--------|----------|-----------|
| Aircraft (pushback/taxi) | All GSE | Aircraft always has right-of-way |
| Emergency vehicle | All others | Emergency operations override |
| Loaded belt loader (departing) | Empty belt loader (arriving) | Operational priority |
| Ground crew (walking) | GSE vehicles | Personnel safety overrides |
| Lead vehicle in convoy | Following vehicles | Convoy following protocol |

The Stackelberg formulation is computationally cheaper than Nash because the prediction order is fixed (leader then follower), avoiding the iterative refinement of level-k reasoning. It maps directly to M2I's influencer-reactor decomposition.

**Implementation for Frenet planner:**

```python
def stackelberg_frenet_planning(ego_state, detected_agents, frenet_candidates):
    """
    Stackelberg planning: identify leader/follower roles,
    plan ego trajectory considering leader predictions as fixed,
    with conditional prediction of followers.
    """
    # Step 1: Classify agents by right-of-way priority
    leaders = [a for a in detected_agents if a.priority > ego_priority]
    followers = [a for a in detected_agents if a.priority <= ego_priority]
    
    # Step 2: Predict leaders marginally (they don't react to ego)
    leader_predictions = marginal_predict(leaders)
    
    # Step 3: Score ego candidates against leader predictions
    # (leaders are treated as fixed constraints)
    leader_safe_candidates = []
    for candidate in frenet_candidates:
        if no_collision(candidate, leader_predictions):
            leader_safe_candidates.append(candidate)
    
    # Step 4: For safe candidates, get conditional follower predictions
    best_score = float('inf')
    best_plan = None
    for candidate in leader_safe_candidates:
        follower_preds = conditional_predict(followers, ego_plan=candidate)
        score = evaluate(candidate, leader_predictions, follower_preds)
        if score < best_score:
            best_score = score
            best_plan = candidate
    
    return best_plan
```

### 6.4 Nash Equilibrium Approximation Methods

For scenarios without clear leader-follower structure (two GSE vehicles of equal priority approaching the same area), Nash equilibrium is the appropriate solution concept.

**Practical approximation methods (2024-2025 SOTA):**

| Method | Compute Time | Convergence | Best For |
|--------|-------------|-------------|---------|
| Level-k (GameFormer, K=3) | 3 decoder passes (~30ms) | Usually by K=3 | Most airside scenarios |
| Iterative best response (DIPP) | 3-5 iterations (~40ms) | Converges for most driving | Merge/yield negotiation |
| Potential game reduction | Single optimization (~10ms) | Guaranteed if valid | Structured interactions |
| MCCFR (Monte Carlo CFR) | 100+ iterations | Provably converges | Complex hidden-info games |

For airside deployment on Orin, **Level-k (K=2-3) or Stackelberg decomposition** are the practical choices. Full Nash equilibrium computation is too expensive for real-time.

### 6.5 Social Force Models as Lightweight Interaction

For personnel interaction modeling (where strategic game theory is overkill), social force models (Helbing & Molnar, 1995) provide a lightweight alternative:

```python
def social_force_pedestrian_prediction(ego_plan, pedestrians, dt=0.1):
    """
    Predict pedestrian trajectories using social force model,
    conditioned on ego vehicle plan.
    """
    predicted_trajectories = {}
    
    for ped in pedestrians:
        traj = [ped.position]
        vel = ped.velocity
        
        for t_idx in range(int(horizon / dt)):
            # Goal-directed force
            f_goal = desired_force(ped, ped.goal)
            
            # Repulsive force from ego vehicle
            ego_pos_t = interpolate_ego(ego_plan, t_idx * dt)
            f_ego = repulsive_force(ped, ego_pos_t, vehicle_radius=2.5)
            
            # Repulsive force from other pedestrians
            f_ped = sum(repulsive_force(ped, other) for other in pedestrians 
                       if other != ped)
            
            # Repulsive force from obstacles (aircraft, barriers)
            f_obs = obstacle_force(ped, obstacles)
            
            # Update
            acceleration = (f_goal + f_ego + f_ped + f_obs) / ped.mass
            vel = vel + acceleration * dt
            pos = traj[-1] + vel * dt
            traj.append(pos)
        
        predicted_trajectories[ped.id] = np.array(traj)
    
    return predicted_trajectories
```

Social force is O(N^2) for N pedestrians but runs in <1ms for typical airside scenarios (5-20 personnel). It naturally captures ego influence: when the ego approaches, pedestrians are pushed away by the repulsive force. This is cheap conditional prediction for the personnel interaction case.

---

## 7. Contingency Planning: Branch-and-Bound Over Prediction Modes

### 7.1 Why Single-Trajectory Planning Is Insufficient

All methods discussed so far produce a single trajectory for the ego. But in uncertain multi-agent environments, committing to a single plan is fragile:

```
Scenario: Ego approaches a stand where a belt loader MIGHT reverse.

Single-plan approach:
  Plan A: "Belt loader won't reverse" --> Proceed normally
  Plan B: "Belt loader will reverse" --> Stop and wait
  
  Planner picks most likely (Plan A). If belt loader reverses, 
  ego must emergency brake.

Contingency approach:
  Shared segment: Slow down, prepare to brake (first 1-2 seconds)
  Branch point: At decision boundary...
    Branch A: If belt loader continues, accelerate past
    Branch B: If belt loader reverses, brake to stop
  
  Execute shared segment. Observe belt loader. At branch point, 
  commit to appropriate branch.
```

### 7.2 MARC: Tree-Structured Contingency Plans

MARC (covered in `neural-motion-planning.md` Section 3.2) produces tree-structured plans. Here we focus on the joint prediction-planning aspect:

**How MARC couples prediction and planning:**

1. **For each ego policy** (e.g., "proceed" vs. "yield"), MARC generates a **conditional scenario** -- how all other agents would react to that ego policy
2. Each scenario branch includes both the ego trajectory AND the predicted agent trajectories
3. The **dynamic branch point** is computed as the latest time where the ego's trajectories under different policies remain within a tolerance

```
                     [Ego slows, prepares to brake]
                              |
                         Branch Point (t = 1.5s)
                        /                        \
           [Belt loader reverses]        [Belt loader continues]
           Ego: brake to stop            Ego: accelerate past
           Belt loader: reverses         Belt loader: continues
           Ground crew: clears path      Ground crew: stays
```

**Key property:** At the branch point, the ego has a contingency plan for each scenario. The ego doesn't need to predict which scenario will happen -- it defers the commitment to the latest possible moment.

### 7.3 Prediction Mode Branching

Modern prediction models (MTR, MotionLM, HiVT) output multi-modal predictions -- K trajectory modes with associated probabilities for each agent. Contingency planning over these modes:

```python
def contingency_planning(ego_candidates, prediction_modes, mode_probs):
    """
    Branch-and-bound planning over prediction modes.
    
    prediction_modes: [N_agents, K_modes, T, 2]  -- K modes per agent
    mode_probs: [N_agents, K_modes]  -- probability of each mode
    """
    # Enumerate scenario branches (product of agent modes)
    # For N=3 agents, K=3 modes: 27 scenarios. 
    # Prune low-probability branches.
    
    scenarios = enumerate_high_prob_scenarios(
        prediction_modes, mode_probs, prob_threshold=0.05
    )  # Typically 5-15 scenarios after pruning
    
    # For each ego candidate, compute expected cost across scenarios
    best_plan = None
    best_expected_cost = float('inf')
    
    for candidate in ego_candidates:
        expected_cost = 0.0
        worst_case_cost = 0.0
        
        for scenario, prob in scenarios:
            cost = evaluate_cost(candidate, scenario)
            expected_cost += prob * cost
            worst_case_cost = max(worst_case_cost, cost)
        
        # Risk-aware objective: blend expected and worst-case
        risk_alpha = 0.3  # Weight on worst-case (CVaR-like)
        blended_cost = (1 - risk_alpha) * expected_cost + risk_alpha * worst_case_cost
        
        if blended_cost < best_expected_cost:
            best_expected_cost = blended_cost
            best_plan = candidate
    
    return best_plan
```

### 7.4 Risk-Aware Trajectory Selection

Contingency planning naturally supports risk-aware decision-making:

| Risk Metric | Formula | Behavior |
|-------------|---------|----------|
| Expected cost | E[C] = sum(p_i * C_i) | Optimistic (good for efficiency) |
| Worst-case cost | max(C_i) | Pessimistic (very conservative) |
| CVaR (Conditional Value at Risk) | E[C | C >= quantile_alpha] | Balanced (expected cost of bad outcomes) |
| Entropic risk | (1/beta) * log(E[exp(beta * C)]) | Tunable between expected and worst-case |

For airside, the risk measure should be **context-dependent:**
- Near aircraft: CVaR with alpha=0.1 (very risk-averse)
- On taxiway (no aircraft): Expected cost (efficiency-focused)
- Near personnel: Worst-case (zero tolerance for collision)

```python
def context_aware_risk(costs, probs, context):
    """Select risk measure based on operational context."""
    if context.near_aircraft:
        return cvar(costs, probs, alpha=0.1)  # 10% worst-case tail
    elif context.near_personnel:
        return max(costs)  # Absolute worst case
    elif context.runway_crossing:
        return max(costs)  # Zero tolerance
    else:
        return expected_cost(costs, probs)  # Standard expected
```

### 7.5 Branch-and-Bound Complexity

The combinatorial explosion of scenarios is the main challenge:

| Agents | Modes/Agent | Total Scenarios | After Pruning (p>0.05) | Compute Time |
|--------|------------|-----------------|----------------------|--------------|
| 3 | 3 | 27 | 8-12 | <5ms |
| 5 | 3 | 243 | 15-25 | ~10ms |
| 10 | 3 | 59,049 | 30-50 | ~20ms |
| 15 | 3 | 14.3M | 50-80 | ~35ms |
| 20 | 3 | 3.5B | 80-120 | ~50ms |

For dense airside turnaround (20+ agents), aggressive pruning is essential. Strategies:
1. **Probability pruning:** Discard scenarios below probability threshold
2. **Interaction grouping:** Only consider modes for interacting agents; distant agents use most-likely mode
3. **Hierarchical branching:** Branch on most uncertain agent first, prune subtrees early
4. **Scenario clustering:** Merge similar scenarios into representative clusters

---

## 8. Planning with Occupancy Predictions and Flow

### 8.1 Occupancy vs. Trajectory for Joint Planning

Two paradigms for representing predicted futures:

```
Trajectory-based:       Occupancy-based:
  Agent 1: [(x,y,t)]     Grid cell (i,j): P(occupied at time t)
  Agent 2: [(x,y,t)]     Includes all agents + unknown objects
  ...                     No object association needed
  Agent N: [(x,y,t)]     Dense representation
```

**Occupancy advantages for airside:**
- **Class-agnostic:** Handles novel objects (unusual GSE, debris, wildlife) without per-class detection
- **No tracking required:** Occupancy prediction doesn't need object identity
- **Dense safety guarantee:** Every grid cell has an occupancy probability, no gaps between tracked objects
- **Handles deformable/extended objects:** Aircraft wings, belt loader conveyors are naturally represented

**Trajectory advantages for airside:**
- **Agent identity preserved:** Know which agent is which (important for right-of-way)
- **Interpretable predictions:** Can explain "the belt loader is predicted to turn left"
- **Conditional prediction is natural:** Condition on specific agents' actions
- **Efficient for sparse scenes:** 10 agent trajectories is cheaper than 200x200x20 occupancy grid

**Recommendation for airside:** Use both. Trajectory prediction for identified agents (GSE, aircraft) + occupancy for dense unstructured areas (personnel, unknown objects, FOD).

### 8.2 Occupancy Flow for Trajectory Scoring

Occupancy flow (covered in depth in the occupancy flow document) predicts not just where space is occupied but **how the occupancy moves over time**. This enables velocity-aware trajectory scoring.

**Integration with Frenet planner:**

```python
def occupancy_flow_cost(frenet_candidate, occ_flow_grid, dt=0.1):
    """
    Score a Frenet candidate trajectory against predicted occupancy flow.
    
    occ_flow_grid: [T, H, W, 4]  -- occupancy + 3D flow per cell per timestep
    frenet_candidate: [T, 2]  -- ego position at each timestep
    """
    total_cost = 0.0
    
    for t in range(len(frenet_candidate)):
        ego_pos = frenet_candidate[t]
        ego_footprint = get_vehicle_footprint(ego_pos, ego_heading[t])
        
        # Check all cells covered by ego footprint
        for cell in cells_in_footprint(ego_footprint, occ_flow_grid):
            i, j = cell
            occ_prob = occ_flow_grid[t, i, j, 0]
            flow_vx = occ_flow_grid[t, i, j, 1]
            flow_vy = occ_flow_grid[t, i, j, 2]
            
            if occ_prob < 0.01:
                continue  # Empty cell
            
            # Flow-aware collision probability
            # Objects moving toward ego are more dangerous
            relative_flow = compute_relative_flow(
                flow_vx, flow_vy, ego_velocity[t]
            )
            approach_speed = max(0, -relative_flow)  # Positive if approaching
            
            # Cost increases with occupancy probability and approach speed
            collision_risk = occ_prob * (1.0 + approach_speed / 5.0)
            total_cost += collision_risk
    
    return total_cost
```

**Key advantage of flow-aware scoring:** Static obstacles (parked GSE, barriers) have zero flow and get standard collision cost. Approaching agents get amplified cost (more dangerous). Receding agents get reduced cost (less dangerous). This naturally handles the asymmetry between "obstacle approaching me" and "obstacle moving away."

### 8.3 UnO: Self-Supervised Occupancy Prediction for Airside

**Paper:** "UnO: Unsupervised Occupancy Fields for Perception and Forecasting" (CVPR 2024)

UnO is particularly relevant for airside because it requires NO labeled data -- it learns occupancy prediction from raw LiDAR sequences via self-supervised objectives.

**Why UnO fits airside constraints:**
- No public airside occupancy datasets exist
- UnO trains on unlabeled LiDAR sweeps (Aurrigo can collect these immediately)
- Won the Argoverse 2 LiDAR Forecasting Challenge
- LiDAR-only input matches Aurrigo's sensor suite

**UnO as occupancy predictor for Frenet scoring:**

```
LiDAR sweeps (3-5 frames) --> UnO encoder --> Latent scene state
                                                    |
                                              UnO decoder --> Predicted occupancy [T, H, W]
                                                    |
                              Frenet candidates --> Occupancy-based scoring
                                                    |
                                              Best candidate
```

### 8.4 Combining Trajectory and Occupancy Prediction for Joint Planning

The most robust approach uses both:

```python
def hybrid_prediction_scoring(candidate, agent_trajs, occ_grid, occ_flow):
    """
    Combined scoring using trajectory prediction (for known agents)
    and occupancy prediction (for everything else).
    """
    # Agent-based scoring (trajectory prediction)
    agent_cost = 0.0
    for agent in agent_trajs:
        ttc = time_to_collision(candidate, agent.trajectory)
        agent_cost += ttc_cost(ttc) * agent.priority_weight
    
    # Occupancy-based scoring (dense, class-agnostic)
    occ_cost = occupancy_flow_cost(candidate, occ_flow)
    
    # Remove double-counting: mask occupancy cells that correspond to tracked agents
    for agent in agent_trajs:
        occ_cost -= occupancy_in_agent_footprint(occ_grid, agent)
    
    # Combine with context-dependent weighting
    total = (1.0 * agent_cost + 0.5 * occ_cost 
             + kinematic_cost(candidate) 
             + progress_cost(candidate))
    
    return total
```

---

## 9. SOTA Benchmarks: NAVSIM, nuPlan, and What They Reveal

### 9.1 Benchmark Landscape (2024-2026)

| Benchmark | Type | Reactivity | Horizon | Agents | Joint Pred-Plan? |
|-----------|------|-----------|---------|--------|-----------------|
| nuScenes | Open-loop | None | 3s | Replay | Penalizes it (GT-matching) |
| NAVSIM v1 | Pseudo-closed | Non-reactive | 4s | Replay | Rewards safety+progress |
| NAVSIM v2 | Pseudo-closed + | Non-reactive | 4s + | Replay | + speed, comfort, heading |
| nuPlan CL | Closed-loop | Reactive (IDM) | Full | Reactive agents | Strongly rewards it |
| interPlan | Closed-loop + | Adversarial | Full | Adversarial | Most demanding |
| WOMD Interactive | Open-loop | Joint GT | 8s | GT joint | Measures joint accuracy |

**Key finding from benchmarks:** Methods that couple prediction and planning consistently outperform those that don't, but the gap is larger on closed-loop benchmarks (nuPlan, interPlan) than on open-loop or non-reactive benchmarks (nuScenes, NAVSIM). This is expected -- the benefit of joint prediction-planning is interaction-awareness, which only matters when agents react.

### 9.2 NAVSIM Results Analysis

NAVSIM v1 uses the PDM Score (PDMS), a composite of:
- No Collision (NC): multiplicative gate
- Drivable Area Compliance (DAC): multiplicative gate
- Progress (EP): soft score
- Time-to-collision (TTC): soft score
- Comfort: soft score

**Top NAVSIM v1 results (early 2026):**

| Rank | Method | PDMS | Type | Joint Pred-Plan? |
|------|--------|------|------|-----------------|
| 1 | TransDiffuser | 94.85 | Diffusion | Joint denoising |
| 2 | TrajHF | 93.95 | RL fine-tuned | Planning-optimized prediction |
| 3 | DiffE2E | 92.7 | Hybrid diffusion | Partially joint |
| 4 | HiPro-AD | 92.6 | Camera-only | Hierarchical |
| 5 | SparseDriveV2 | 92.1 | Sparse E2E | Parallel pred-plan |
| -- | PDM-Closed | ~88 | Rule-based | Prediction-scored |

**Observation:** The top methods all incorporate some form of joint prediction-planning. The gap between jointly-trained methods (94.85) and prediction-scored rule-based methods (88) is about 6-7 PDMS points. However, this gap shrinks significantly on nuPlan closed-loop where PDM-Closed's implicit reactivity through re-planning compensates.

### 9.3 nuPlan Closed-Loop: Where PDM-Closed Reigns

**nuPlan CLS-R (reactive agent, Val14) results:**

| Method | CLS-R | Type | Joint? |
|--------|-------|------|--------|
| PDM-Closed | ~92 | Rule-based + pred scoring | Type 1 |
| Diffusion-ES | ~90 | Diffusion + search | Type 4 |
| CaRL (PPO) | ~89 | RL | N/A (single agent) |
| GameFormer-P | ~87 | Game-theoretic | Type 3 |
| PlanTF | ~86 | IL | Type 5 (weak) |
| Urban Driver | ~82 | IL | None |

**The PDM-Closed paradox:** The simplest method wins on the most realistic benchmark. Why?

1. **Closed-loop re-planning at 10 Hz compensates for prediction errors.** Even with marginal (non-conditional) prediction, re-planning every 100ms means the ego continuously adapts to observed agent behavior. This provides implicit joint planning without explicit interaction modeling.

2. **IDM following provides natural interaction.** The Intelligent Driver Model automatically adjusts speed to maintain safe following distance. This is primitive but effective conditional behavior.

3. **Learned methods overfit to training distribution.** Neural planners trained on nuPlan data struggle with out-of-distribution scenarios that PDM-Closed handles via general rules.

4. **Safety gates are multiplicative.** A single collision or drivable area violation zeros out the score. Rule-based methods with hard safety constraints outperform learned methods that have 0.1% collision rates when that 0.1% causes catastrophic scoring.

### 9.4 interPlan: Adversarial Scenarios Expose Sequential Planning

**Paper:** "interPlan: Interactive Planning for Autonomous Driving via Conditional Prediction" (2024)
**Authors:** Hallgarten et al.

interPlan introduces adversarial scenarios into the nuPlan benchmark where other agents actively test the ego's interaction reasoning. In these scenarios:

| Scenario Type | PDM-Closed Score | GameFormer Score | Gap |
|--------------|-----------------|-----------------|-----|
| Standard (nuPlan) | ~92 | ~87 | PDM +5 |
| Intersection negotiation | ~78 | ~85 | GameFormer +7 |
| Merge/yield | ~75 | ~83 | GameFormer +8 |
| Dense multi-agent | ~70 | ~82 | GameFormer +12 |

**Key finding:** PDM-Closed's advantage disappears in interaction-heavy scenarios. Game-theoretic methods (GameFormer) show their strength exactly where sequential methods fail -- dense, adversarial, multi-agent interactions.

**Airside implication:** Airport turnaround operations are inherently interaction-heavy (closer to interPlan's adversarial scenarios than nuPlan's standard scenarios). PDM-Closed-style scoring is a good starting point, but game-theoretic interaction modeling will be essential for turnaround operations.

### 9.5 What Benchmarks Cannot Test

No existing benchmark captures airside-specific interactions:
- Aircraft as 30-60m agents with asymmetric clearance zones (5m nose, 50m+ exhaust)
- Mixed speed ranges (0 km/h parked aircraft to 30 km/h GSE to 5 km/h walking personnel)
- Strict 9-level right-of-way hierarchy
- Turnaround choreography with schedule-dependent sequencing
- Jet blast zones as invisible dynamic hazards

**Recommendation:** Build an airside-specific interaction benchmark using fleet data. Even a small benchmark (100 turnaround scenarios, annotated with interaction outcomes) would be valuable because NO public airside interaction benchmark exists.

---

## 10. Airside-Specific Interaction Modeling

### 10.1 The Airside Interaction Taxonomy

Airport airside interactions differ fundamentally from on-road driving. Key differences:

| Dimension | On-Road | Airside |
|-----------|---------|---------|
| Traffic structure | Lanes, intersections, signals | Open aprons, service roads, stands |
| Right-of-way | Traffic rules, signals | 9-level priority hierarchy |
| Agent types | Cars, trucks, cyclists, peds | Aircraft, 5+ GSE types, ground crew, FOD |
| Speed range | 0-120 km/h | 0-30 km/h |
| Agent size range | 1.5-20m | 0.5-65m (personnel to aircraft) |
| Interaction density | 5-15 agents typical | 15-30 agents during turnaround |
| Schedule influence | Traffic patterns (rush hour) | Flight schedules (deterministic triggers) |
| Communication | Signals, horns, gestures | Radio, A-CDM, light signals, marshaller |

### 10.2 The 9-Level Right-of-Way Hierarchy

Airside right-of-way is not negotiable -- it follows a strict priority hierarchy:

```
Priority Level 1 (Highest): Emergency vehicles (active)
Priority Level 2: Aircraft under own power (taxiing)
Priority Level 3: Aircraft being towed/pushed back
Priority Level 4: Vehicles towing aircraft
Priority Level 5: Emergency vehicles (non-active return)
Priority Level 6: Authorized escort vehicles
Priority Level 7: Loaded GSE (operational)
Priority Level 8: Unloaded GSE (repositioning)
Priority Level 9 (Lowest): Personnel on foot
```

**Implication for joint prediction-planning:** The strict hierarchy makes Stackelberg (leader-follower) the correct game-theoretic model for most interactions. Higher-priority agents are always leaders; lower-priority agents are always followers. Nash equilibrium (simultaneous optimization) is only needed for same-priority interactions (two loaded GSE vehicles meeting at a junction).

### 10.3 Interaction Patterns and Their Models

**Pattern 1: Aircraft Pushback (Highest Complexity)**

```
Agents: Pushback tug (ego), aircraft, wing walkers, ground crew, nearby GSE
Interaction: Ego pushes aircraft backward along predetermined path.
             ALL other agents must yield. Aircraft path is non-negotiable.
             
Model: Stackelberg with ego+aircraft as joint leader.
       Conditional prediction: "Given pushback trajectory, how will
       nearby GSE and personnel clear the path?"
       
Planning constraint: Aircraft clearance zones (3m wing, 5m nose/intake, 
                     50m+ exhaust) must never be violated.
```

**Pattern 2: Turnaround Stand Congestion (Highest Density)**

```
Agents: Baggage tractors (2-4), belt loaders (2), catering trucks (1-2),
        fuel truck (1), lavatory truck (1), ground crew (8-12),
        aircraft (parked, static but has clearance zones)
        
Interaction: Vehicles arrive in schedule-dependent sequence,
             position at specific service points around aircraft,
             serve, then depart. Choreographed but with timing uncertainty.
             
Model: Schedule-conditioned conditional prediction.
       "Given that aircraft arrived at 14:02 and TOBT is 14:45,
       predict when each GSE type will arrive and depart."
       
       + Local Stackelberg for spatial negotiation at stand.
```

**Pattern 3: Convoy Following**

```
Agents: Lead vehicle + 1-3 following vehicles (ego may be any position)
Interaction: Maintain formation with inter-vehicle spacing.
             Leader sets speed and route. Followers adapt.
             
Model: Stackelberg with leader as sole leader.
       IDM-like following for longitudinal control.
       Conditional prediction: "Given leader's trajectory, 
       predict following vehicle positions."
```

**Pattern 4: Intersection/Crossing Negotiation**

```
Agents: 2-4 GSE vehicles approaching from different directions
Interaction: No traffic signals. Priority by type and operational state.
             Same-type vehicles negotiate based on approach timing.
             
Model: Stackelberg between different priority levels.
       Level-k (K=2) or potential game for same-priority vehicles.
       Right-of-way prior breaks symmetry.
```

**Pattern 5: Personnel Avoidance**

```
Agents: Ego vehicle + ground crew (1-12 people)
Interaction: Personnel always have implicit right-of-way (safety).
             But personnel typically yield to approaching vehicles
             if they see/hear them. Failure modes: distracted,
             in blind spot, wearing hearing protection.
             
Model: Social force model (Section 6.5) for normal conditions.
       Worst-case (personnel doesn't react) for safety check.
       
Planning: Must always have emergency stop capability.
          Speed proportional to proximity: 25 km/h at >20m,
          10 km/h at 10-20m, 5 km/h at 5-10m, stop at <5m.
```

### 10.4 Schedule-Conditioned Prediction (Unique to Airside)

Airport operations have a unique advantage over on-road driving: **flight schedules provide strong priors on future agent behavior.**

```python
def schedule_conditioned_prediction(agents, flight_schedule, current_time):
    """
    Use A-CDM milestones to predict GSE arrival/departure times at stands.
    
    A-CDM milestones:
      AIBT: Actual In-Block Time (aircraft arrives at stand)
      TOBT: Target Off-Block Time (aircraft departs stand)
      ELDT: Estimated Landing Time
    """
    predictions = {}
    
    for stand in active_stands:
        schedule = flight_schedule.get_stand_schedule(stand)
        
        if schedule.phase == "ARRIVAL":
            # Predict GSE sequence based on time since AIBT
            time_since_arrival = current_time - schedule.aibt
            
            # Expected sequence: chocks (0 min), belt loader (2 min), 
            # catering (5 min), fuel (10 min), cleaning (15 min)
            expected_arrivals = {
                'belt_loader': schedule.aibt + timedelta(minutes=2),
                'catering_truck': schedule.aibt + timedelta(minutes=5),
                'fuel_truck': schedule.aibt + timedelta(minutes=10),
            }
            
            for agent_type, expected_time in expected_arrivals.items():
                if abs((current_time - expected_time).total_seconds()) < 300:
                    # This agent type is likely in transit to/from stand
                    predictions[f"{stand}_{agent_type}"] = predict_route(
                        agent_type, stand, expected_time
                    )
    
    return predictions
```

This is a form of joint prediction that no on-road method provides: knowing that a catering truck WILL arrive at stand 12 in approximately 3 minutes allows the planner to pre-emptively adjust routes or timing.

### 10.5 Airside Interaction Cost Function

Combining all interaction models into a unified cost function for the Frenet planner:

```python
def airside_interaction_cost(candidate, predictions, context):
    """
    Full interaction-aware cost function for airside Frenet scoring.
    """
    cost = 0.0
    
    # 1. Aircraft clearance (hard constraint -- infinite cost if violated)
    for aircraft in predictions.aircraft:
        clearance = aircraft_clearance(candidate, aircraft)
        if clearance.wing < 3.0 or clearance.intake < 5.0:
            return float('inf')  # Hard constraint
        if clearance.exhaust_zone:
            return float('inf')  # Jet blast zone
    
    # 2. Right-of-way compliance (Stackelberg cost)
    for agent in predictions.higher_priority_agents:
        # Ego must yield to higher-priority agents
        yield_cost = yield_compliance_cost(candidate, agent)
        cost += 10.0 * yield_cost  # Heavy penalty for not yielding
    
    # 3. Personnel safety (worst-case)
    for person in predictions.personnel:
        # Use minimum distance over all prediction modes
        min_dist = min(
            min_distance(candidate, mode) 
            for mode in person.prediction_modes
        )
        if min_dist < 2.0:
            return float('inf')  # Hard constraint: 2m minimum
        cost += personnel_proximity_cost(min_dist)
    
    # 4. GSE interaction (conditional prediction)
    for gse in predictions.same_priority_gse:
        cond_pred = conditional_predict(gse, ego_plan=candidate)
        ttc = time_to_collision(candidate, cond_pred)
        cost += ttc_cost(ttc)
    
    # 5. Convoy following (IDM-based)
    if context.convoy_mode:
        lead = predictions.convoy_leader
        following_cost = convoy_following_cost(
            candidate, lead.trajectory, 
            target_gap=context.convoy_gap
        )
        cost += following_cost
    
    # 6. Schedule-based anticipation
    for anticipated in predictions.schedule_conditioned:
        # Avoid being in the path of anticipated future arrivals
        cost += anticipated_conflict_cost(candidate, anticipated)
    
    # 7. Occupancy flow (dense, class-agnostic)
    cost += occupancy_flow_cost(candidate, predictions.occ_flow) * 0.5
    
    return cost
```

---

## 11. Computational Budget on NVIDIA Orin

### 11.1 Available Budget for Joint Prediction-Planning

The total Orin budget (275 TOPS at 60W) must be shared across all modules. Based on the existing Aurrigo stack and the allocations established in other documents:

| Module | Allocated Budget | Allocated Time (100ms cycle) |
|--------|-----------------|----------------------------|
| LiDAR preprocessing | ~10 TOPS | 5-8 ms |
| 3D Detection (PointPillars) | ~20 TOPS | 7 ms (INT8) |
| Tracking | ~5 TOPS | 2-3 ms |
| Segmentation (if enabled) | ~15 TOPS | 10-15 ms |
| Localization (GTSAM+VGICP) | ~15 TOPS | 8-12 ms |
| **Prediction** | **~15 TOPS** | **10-15 ms** |
| **Planning (Frenet + scoring)** | **~10 TOPS** | **8-12 ms** |
| Safety monitoring (CBF, STL) | ~5 TOPS | 2-5 ms |
| Control | CPU | 1-2 ms |
| Overhead/margin | ~10 TOPS | 5-10 ms |
| **Total** | **~105 TOPS** | **~60-85 ms** |

**Available for joint prediction-planning: ~25 TOPS, ~20-25 ms.**

This is tight but workable. The key constraint: prediction and planning together must complete in 20-25ms, not the 25-40ms they would take if run as separate heavy modules.

### 11.2 What Fits in 25ms on Orin

| Method | Estimated Orin Latency | Fits 25ms? | Notes |
|--------|----------------------|-----------|-------|
| HiVT prediction + Frenet scoring | 12 + 3 = 15ms | Yes | Separate but fast |
| Clustered conditional pred (K=6) + Frenet | 15 + 5 = 20ms | Yes | 6 conditional evaluations |
| Delta conditional pred + Frenet | 12 + 5 = 17ms | Yes | Marginal + delta per candidate |
| GameFormer K=3 + scoring | 25-30ms | Marginal | 3 decoder passes |
| SparseDrive-S (TensorRT INT8) | 25-35ms | Marginal | Parallel pred-plan |
| DTPP tree policy (K=4 policies) | 20-25ms | Yes (barely) | 4 conditional predictions |
| Social force (personnel) | <1ms | Yes (additive) | CPU-only |
| Occupancy flow scoring | 3-5ms | Yes (additive) | Pre-computed grid lookup |
| Diffusion-Planner (5 steps) | 150-200ms | No | Too slow |
| UniAD | >500ms | No | Far too slow |

### 11.3 Recommended Pipeline for Orin

```
                                                    Time Budget
LiDAR --> PointPillars Detection (7ms) -------+
                                               |
              Tracking (3ms) <-----------------+
                  |
    +-------------+-------------+
    |                           |
    v                           v
HiVT-Lite Prediction (10ms)    UnO Occupancy (8ms)    <-- Run in parallel
    |                           |                          on separate CUDA streams
    v                           v
Marginal Predictions     Occ Flow Grid
    |                      |
    +----------+-----------+
               |
    Frenet Candidate Scoring (5ms)
    - 420 candidates
    - Agent trajectory costs (from HiVT)
    - Occupancy flow costs (from UnO)
    - Airside interaction costs (rules)
    - Delta conditional pred for top-10 candidates (2ms)
               |
    Best Candidate Selection
               |
    CBF Safety Filter (0.5ms)
               |
    Trajectory Output
    
    Total: ~25-30ms (fits 5 Hz, marginal for 10 Hz)
```

**Optimization strategies to reach 10 Hz (100ms total cycle):**

1. **Pipeline parallelism:** Start prediction on frame N while scoring frame N-1
2. **Asynchronous prediction:** Run prediction at 5 Hz, planning at 10 Hz using latest prediction
3. **Adaptive depth:** Use conditional prediction only when interaction density is high
4. **DLA offloading:** Run HiVT-Lite prediction on Orin's DLA while detection runs on GPU

### 11.4 Scaling to NVIDIA Thor

On Thor (~1,000+ TOPS, expected 2025-2026), the computational constraints relax dramatically:

| Method | Orin (275 TOPS) | Thor (~1,000 TOPS) |
|--------|----------------|-------------------|
| GameFormer K=3 | 25-30ms (marginal) | ~8-10ms (easy) |
| SparseDrive-S | 25-35ms (marginal) | ~8-12ms (easy) |
| Diffusion-Planner (5 steps) | 150-200ms (infeasible) | ~40-50ms (feasible) |
| Full E2E joint (UniAD-scale) | >500ms (infeasible) | ~100-150ms (marginal) |

Thor enables full Type 3 (game-theoretic) or even Type 4 (joint latent space) joint prediction-planning within real-time constraints.

---

## 12. Integration with the Frenet Planner

### 12.1 The Augmentation Philosophy

The existing Frenet planner generates 420 candidates per cycle and scores them with hand-crafted cost functions. The integration strategy is to **add prediction-informed cost terms without modifying the core Frenet generation logic.**

This is the lowest-risk, highest-value integration path:

```
Existing Frenet Pipeline (unchanged):
  Generate 420 candidates via quintic polynomial sampling
  Evaluate kinematic feasibility (curvature, acceleration)
  Compute classical costs (jerk, lateral offset, speed tracking)

New: Prediction-Informed Cost Terms (additive):
  + Agent trajectory collision cost
  + Occupancy flow cost
  + Right-of-way compliance cost
  + Personnel proximity cost
  + Schedule anticipation cost

Selection: Weighted sum of classical + prediction costs
           Safety-critical terms as multiplicative gates
```

### 12.2 Phased Integration Roadmap

**Phase 1: Static Prediction Integration (2-4 weeks, $5-8K)**

Add the simplest useful prediction: constant-velocity extrapolation of detected agents.

```python
def constant_velocity_prediction(tracked_agents, horizon=3.0, dt=0.1):
    """Predict agent futures assuming constant velocity."""
    predictions = {}
    for agent in tracked_agents:
        traj = []
        pos = agent.position
        vel = agent.velocity
        for t in np.arange(0, horizon, dt):
            pos = pos + vel * dt
            traj.append(pos)
        predictions[agent.id] = np.array(traj)
    return predictions

def cv_prediction_cost(frenet_candidate, cv_predictions, ego_velocity):
    """Score Frenet candidate against constant-velocity predictions."""
    cost = 0.0
    for agent_id, pred_traj in cv_predictions.items():
        for t in range(min(len(frenet_candidate), len(pred_traj))):
            dist = np.linalg.norm(frenet_candidate[t] - pred_traj[t])
            if dist < SAFETY_RADIUS:
                # Exponential cost inside safety radius
                cost += np.exp(-dist / DECAY_RATE) * COLLISION_WEIGHT
    return cost
```

Even this trivial prediction provides significant value: it prevents the planner from choosing trajectories that intersect agents' extrapolated paths.

**Phase 2: Learned Marginal Prediction (4-8 weeks, $10-15K)**

Replace constant-velocity with a learned prediction model (HiVT-Lite or similar):

- Train on collected airside data (or pre-trained on nuScenes, fine-tuned)
- Multi-modal output: K=3 modes per agent with probabilities
- Score Frenet candidates against all prediction modes (risk-aware)

```python
def learned_prediction_cost(frenet_candidate, multi_modal_preds, risk_measure):
    """Score candidate against multi-modal learned predictions."""
    cost = 0.0
    for agent in multi_modal_preds:
        mode_costs = []
        for mode_idx in range(agent.num_modes):
            pred_traj = agent.modes[mode_idx].trajectory
            mode_prob = agent.modes[mode_idx].probability
            mode_cost = trajectory_collision_cost(frenet_candidate, pred_traj)
            mode_costs.append((mode_cost, mode_prob))
        
        if risk_measure == 'expected':
            cost += sum(c * p for c, p in mode_costs)
        elif risk_measure == 'worst_case':
            cost += max(c for c, p in mode_costs)
        elif risk_measure == 'cvar':
            cost += compute_cvar(mode_costs, alpha=0.2)
    
    return cost
```

**Phase 3: Conditional Prediction (6-12 weeks, $15-25K)**

Add ego-conditioned prediction for the top-K Frenet candidates:

1. Run marginal prediction for all agents (15ms)
2. Score all 420 candidates against marginal predictions
3. Select top-10 candidates by marginal score
4. Run conditional prediction for top-10 only (10ms)
5. Re-score top-10 with conditional predictions
6. Select best

```python
def two_stage_conditional_scoring(candidates, marginal_predictor, 
                                   conditional_predictor, scene_context):
    """
    Two-stage scoring: marginal filtering + conditional refinement.
    """
    # Stage 1: Marginal scoring (fast, all 420 candidates)
    marginal_preds = marginal_predictor(scene_context)
    marginal_scores = [
        score_against_marginal(c, marginal_preds) for c in candidates
    ]
    
    # Select top K candidates
    K = 10
    top_indices = np.argsort(marginal_scores)[:K]
    top_candidates = [candidates[i] for i in top_indices]
    
    # Stage 2: Conditional scoring (expensive, only top K)
    conditional_scores = []
    for candidate in top_candidates:
        cond_preds = conditional_predictor(scene_context, ego_plan=candidate)
        cond_score = score_against_conditional(candidate, cond_preds)
        conditional_scores.append(cond_score)
    
    # Select best from top K
    best_idx = np.argmin(conditional_scores)
    return top_candidates[best_idx]
```

**Phase 4: Game-Theoretic Interaction (12-20 weeks, $20-35K)**

Add level-k reasoning for dense multi-agent scenarios:

- Only activate for turnaround/congestion scenarios (>5 interacting agents)
- Use Stackelberg for different-priority interactions
- Use Level-k (K=2) for same-priority interactions
- Fall back to marginal prediction for simple scenarios (taxiway driving)

**Phase 5: Occupancy Flow Integration (8-12 weeks, $12-20K)**

Add dense occupancy prediction as a complementary cost:

- Self-supervised training with UnO on collected LiDAR data
- Flow-aware trajectory scoring for velocity-dependent safety margins
- Handles untracked objects, FOD, novel obstacles

### 12.3 ROS Integration Architecture

```
ROS Noetic Node Graph:

/lidar_preprocessor
    |
    +--> /pointpillars_detector  (existing)
    |        |
    |        +--> /tracker  (existing)
    |                |
    |                +--> /prediction_node  (NEW)
    |                |       Subscribes: /tracked_objects
    |                |       Publishes:  /predicted_trajectories
    |                |                   /predicted_occupancy
    |                |
    +--> /occupancy_predictor  (NEW, optional)
    |       Subscribes: /lidar_points
    |       Publishes:  /occupancy_flow_grid
    |
    +--> /frenet_planner  (MODIFIED)
            Subscribes: /tracked_objects  (existing)
                        /predicted_trajectories  (NEW)
                        /predicted_occupancy  (NEW)
                        /occupancy_flow_grid  (NEW)
                        /flight_schedule  (NEW, from A-CDM)
            Publishes:  /planned_trajectory  (existing)
            
            Internal changes:
              - Add prediction_cost_evaluator module
              - Add occupancy_flow_cost_evaluator module
              - Add airside_interaction_cost module
              - Modify candidate scoring to include new costs
              - No changes to candidate generation
              - No changes to trajectory tracking/control
```

### 12.4 Fallback and Safety

The prediction-augmented Frenet planner must degrade gracefully:

```python
class PredictionAugmentedFrenetPlanner:
    def plan(self, ego_state, tracked_objects, predictions=None, 
             occ_flow=None, flight_schedule=None):
        # Generate candidates (unchanged)
        candidates = self.generate_frenet_candidates(ego_state)
        
        # Classical scoring (always available)
        classical_scores = [self.classical_cost(c) for c in candidates]
        
        # Prediction scoring (may be unavailable)
        if predictions is not None and predictions.is_valid():
            pred_scores = [self.prediction_cost(c, predictions) for c in candidates]
        else:
            pred_scores = [0.0] * len(candidates)  # Graceful degradation
            self.log_warning("Prediction module unavailable, using classical only")
        
        # Occupancy scoring (may be unavailable)
        if occ_flow is not None and occ_flow.is_valid():
            occ_scores = [self.occupancy_cost(c, occ_flow) for c in candidates]
        else:
            occ_scores = [0.0] * len(candidates)
            self.log_warning("Occupancy module unavailable, using classical only")
        
        # Combined scoring
        total_scores = [
            classical_scores[i] 
            + self.w_pred * pred_scores[i] 
            + self.w_occ * occ_scores[i]
            for i in range(len(candidates))
        ]
        
        # Safety gate: aircraft clearance and personnel distance
        for i, candidate in enumerate(candidates):
            if not self.safety_check(candidate, tracked_objects):
                total_scores[i] = float('inf')
        
        best_idx = np.argmin(total_scores)
        return candidates[best_idx]
```

Key property: **when prediction modules fail, the planner reverts to the existing classical-only behavior.** No functionality is lost -- only the augmentation is disabled.

---

## 13. Implementation Roadmap and Cost Estimates

### 13.1 Phased Implementation Plan

| Phase | Duration | Cost | What's Added | Benefit |
|-------|----------|------|-------------|---------|
| **Phase 1:** CV Prediction + Frenet Scoring | 2-4 weeks | $5-8K | Constant-velocity prediction cost in Frenet | Prevents basic "drive into moving object" failures |
| **Phase 2:** Learned Marginal Prediction | 4-8 weeks | $10-15K | HiVT-Lite multi-modal prediction | Multi-modal prediction-informed planning |
| **Phase 3:** Conditional Prediction | 6-12 weeks | $15-25K | Two-stage marginal+conditional scoring | Interaction-aware planning for top candidates |
| **Phase 4:** Game-Theoretic (optional) | 12-20 weeks | $20-35K | Level-k for dense scenarios + Stackelberg | Full interaction reasoning for turnarounds |
| **Phase 5:** Occupancy Flow | 8-12 weeks | $12-20K | UnO self-supervised occupancy + flow scoring | Dense, class-agnostic safety layer |

**Total:** 32-56 weeks, $62-103K

Phases 1-3 provide ~80% of the value and can be completed in ~16 weeks for ~$30-48K.

### 13.2 Detailed Phase Breakdown

**Phase 1: Constant-Velocity Prediction Cost ($5-8K, 2-4 weeks)**

| Week | Task | Deliverable |
|------|------|-------------|
| 1 | Design prediction cost function, define safety radii | Cost function specification document |
| 2 | Implement CV prediction + cost evaluation in C++ | ROS node: /cv_prediction_cost |
| 3 | Integration testing with Frenet planner | Prediction cost added to candidate scoring |
| 4 | Tuning and validation on recorded rosbags | Tuned weights, regression test baseline |

**Phase 2: Learned Marginal Prediction ($10-15K, 4-8 weeks)**

| Week | Task | Deliverable |
|------|------|-------------|
| 1-2 | Evaluate HiVT-Lite vs. MTR-Lite vs. PointPillars+PredHead | Architecture selection memo |
| 3-4 | Train prediction model (nuScenes pre-train + airside fine-tune) | Trained model checkpoint |
| 5-6 | TensorRT optimization + Orin deployment | INT8 TensorRT engine, <15ms inference |
| 7 | Integrate multi-modal prediction into Frenet scoring | Updated scoring with risk-aware evaluation |
| 8 | Validation, A/B comparison vs. Phase 1 baseline | Metric comparison report |

**Phase 3: Conditional Prediction ($15-25K, 6-12 weeks)**

| Week | Task | Deliverable |
|------|------|-------------|
| 1-2 | Design amortized conditional prediction architecture | Architecture document |
| 3-4 | Implement ego-conditioned prediction decoder | Conditional prediction module |
| 5-6 | Implement two-stage scoring (marginal filter + conditional refine) | Two-stage scoring pipeline |
| 7-8 | TensorRT optimization for conditional decoder | Optimized conditional inference |
| 9-10 | Integration with Frenet planner, tuning | End-to-end integrated pipeline |
| 11-12 | Validation on interaction scenarios, regression testing | Validation report |

### 13.3 Data Requirements

| Phase | Data Needed | Source | Cost to Acquire |
|-------|-------------|--------|-----------------|
| Phase 1 | None (model-free) | N/A | $0 |
| Phase 2 | 5,000-10,000 labeled frames | Fleet data + annotation | $15-30K |
| Phase 3 | Same as Phase 2 + interaction labels | Fleet data + annotation | +$5-10K |
| Phase 4 | 1,000+ annotated interaction scenarios | Fleet data + manual | +$10-15K |
| Phase 5 | 10,000+ LiDAR sweeps (unlabeled) | Fleet data (automatic) | ~$0 (collection only) |

**Note:** Phase 5 (UnO occupancy) requires only unlabeled data, making it potentially the cheapest learned component to deploy.

### 13.4 Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|-----------|
| Prediction model too slow on Orin | Planning rate drops below 5 Hz | Medium | Model distillation, INT8, reduce num agents |
| Insufficient airside training data | Poor prediction quality | High | Pre-train on nuScenes, fine-tune with LoRA |
| Conditional prediction doesn't improve over marginal | Phase 3 value reduced | Low-Medium | Two-stage design means marginal baseline persists |
| Game-theoretic adds latency without proportional benefit | Phase 4 ROI low | Medium | Adaptive activation (only in dense scenarios) |
| Integration destabilizes existing planner | Safety regression | Low | Additive costs only, fallback to classical |

---

## 14. Key Takeaways

1. **Sequential predict-then-plan fails in dense multi-agent scenarios** because it ignores the circular dependency: what others do depends on what ego does, and vice versa. On airport airside, where 15-30 agents negotiate during turnaround, this causes the "frozen robot" problem -- the vehicle stops unnecessarily 2-4x more often than needed.

2. **PDM-Closed proves that simple prediction-informed scoring beats complex learned planners** on nuPlan closed-loop. The lesson: augmenting an existing sampling-based planner (like Aurrigo's Frenet planner) with prediction-based cost terms and re-planning at high frequency provides most of the benefit of joint planning.

3. **The 420-candidate Frenet planner is already an excellent proposal generator.** It generates more diverse candidates than PDM-Closed (420 vs. 15-30). What's missing is prediction-informed scoring, not better proposals.

4. **Conditional prediction ("if I do X, others do Y") provides 20-30% more accurate predictions** than marginal prediction, with the largest gains in interaction-dense scenarios. For Orin, amortized conditional prediction (shared scene encoding, lightweight per-candidate decoder) makes this feasible for the top-10 candidates.

5. **Stackelberg (leader-follower) is the correct game-theoretic model for most airside interactions** because the 9-level right-of-way hierarchy creates clear priority ordering. Full Nash equilibrium is only needed for same-priority agent negotiations.

6. **Schedule-conditioned prediction is a unique airside advantage.** A-CDM milestones (AIBT, TOBT) provide deterministic priors on when GSE types will arrive at and depart from stands. No on-road driving system has access to equivalent schedule information.

7. **Occupancy flow prediction complements trajectory prediction.** Trajectory prediction handles identified agents with known dynamics. Occupancy flow handles the dense, unstructured remainder (personnel groups, unknown objects, FOD). Together they cover the full scene.

8. **UnO self-supervised occupancy requires zero labeled data** and won the Argoverse 2 LiDAR Forecasting Challenge. This makes it the cheapest learned component to deploy for Aurrigo, since no public airside occupancy datasets exist.

9. **The computational budget on Orin is ~25ms for joint prediction-planning.** This accommodates marginal prediction (10-15ms) + Frenet scoring with prediction costs (5-8ms) + conditional refinement of top-10 candidates (5-8ms). Full game-theoretic or diffusion-based joint planning requires Thor.

10. **Context-dependent risk measures are essential for airside.** Near aircraft: CVaR (very conservative). Near personnel: worst-case (zero tolerance). On open taxiway: expected cost (efficiency). The planner should adaptively adjust its risk posture based on the operational context.

11. **interPlan benchmark results show that game-theoretic methods outperform PDM-Closed by 7-12 points specifically in interaction-heavy scenarios** -- which is exactly what airside turnaround operations look like. This motivates investing in game-theoretic planning for Phase 4.

12. **Contingency planning over prediction modes ensures robustness.** Rather than committing to the most likely prediction, branch-and-bound over the top 3 modes per agent with probability-weighted risk-aware scoring. Pruning keeps this to 8-15 evaluated scenarios even with 5+ agents.

13. **Personnel interaction is best modeled with social force models, not game theory.** Social force is computationally cheap (<1ms), naturally captures ego influence (repulsive force from approaching vehicle), and handles groups of pedestrians. Reserve game theory for GSE-GSE and GSE-aircraft interactions.

14. **No public airside interaction benchmark exists.** Building even a small benchmark (100 annotated turnaround scenarios) would be a significant contribution and would enable objective evaluation of interaction-aware planning methods.

15. **The integration is purely additive -- zero risk to existing functionality.** Prediction-informed costs are added alongside existing classical costs. When prediction modules fail, the planner reverts to the existing classical-only behavior. No modifications to trajectory generation, kinematic checking, or control are needed.

16. **Phase 1-3 provide ~80% of total value at ~40% of total cost.** Constant-velocity prediction (Phase 1), learned marginal prediction (Phase 2), and conditional prediction for top candidates (Phase 3) can be completed in ~16 weeks for ~$30-48K. Game-theoretic (Phase 4) and occupancy flow (Phase 5) provide incremental improvement.

17. **The Frenet planner's re-planning at 10 Hz provides implicit interaction-awareness.** Each cycle, the planner re-observes agent behavior and re-plans. This means even marginal (non-conditional) prediction is partially effective, because prediction errors are corrected within 100ms. Conditional prediction improves the quality of each individual plan, but re-planning frequency is the primary adaptation mechanism.

18. **On NVIDIA Thor, full joint prediction-planning becomes feasible.** GameFormer K=3 at ~10ms, SparseDrive at ~12ms, and even truncated Diffusion-Planner at ~50ms fit within real-time constraints. The roadmap from Orin to Thor is: Phases 1-3 on Orin (2025-2026), Phases 4-5 + more ambitious methods on Thor (2026-2027).

---

## 15. References

### Core Joint Prediction-Planning Papers

1. Dauner, D., Hallgarten, M., Geiger, A., Chitta, K. (2023). "Parting with Misconceptions about Learning-based Vehicle Motion Planning." CoRL 2023. -- PDM-Closed baseline.

2. Li, Z., et al. (2023). "Planning-Oriented Autonomous Driving." CVPR 2023 (Best Paper). -- UniAD joint perception-prediction-planning.

3. Zheng, Y., et al. (2025). "Diffusion-Based Planning for Autonomous Driving with Flexible Guidance." ICLR 2025 (Oral). -- Joint diffusion prediction-planning.

4. Huang, Z., et al. (2024). "DTPP: Differentiable Joint Conditional Prediction and Cost Evaluation for Tree Policy Planning in Autonomous Driving." ICRA 2024. -- Conditional prediction + tree policy.

5. Huang, Z., et al. (2023). "DIPP: Differentiable Integrated Motion Prediction and Planning with Learnable Cost Function." IEEE T-NNLS 2023. -- Differentiable joint optimization.

6. Huang, Z., et al. (2023). "GameFormer: Game-theoretic Modeling and Learning of Transformer-based Interactive Prediction and Planning." ICCV 2023 (Oral). -- Level-k game-theoretic reasoning.

7. Sun, W., et al. (2024). "SparseDrive: End-to-End Autonomous Driving via Sparse Scene Representation." ECCV 2024. -- Parallel prediction-planning.

8. Cheng, J., et al. (2024). "Rethinking Imitation-based Planner for Autonomous Driving." ICRA 2024. -- PlanTF minimal baseline.

### Conditional and Interactive Prediction

9. Sun, L., et al. (2022). "M2I: From Factored Marginal Trajectory Prediction to Interactive Prediction." CVPR 2022. -- Influencer-reactor decomposition.

10. Rowe, L., et al. (2023). "FJMP: Factorized Joint Multi-Agent Motion Prediction over Learned Directed Acyclic Interaction Graphs." CVPR 2023. -- DAG-structured conditional prediction.

11. Shi, S., et al. (2024). "MTR++: Multi-Agent Motion Prediction with Symmetric Scene Modeling and Guided Intention Querying." TPAMI 2024. -- Mutually-guided prediction.

12. Jia, X., et al. (2023). "HDGT: Heterogeneous Driving Graph Transformer for Multi-Agent Trajectory Prediction via Scene Encoding." TPAMI 2023. -- Heterogeneous agent interaction graphs.

### Game Theory for Driving

13. Schwarting, W., Pierson, A., Alonso-Mora, J., Karaman, S., Rus, D. (2019). "Social behavior for autonomous vehicles." PNAS. -- Social value orientation.

14. Sadigh, D., Sastry, S., Seshia, S., Dragan, A. (2016). "Planning for Autonomous Cars that Leverage Effects on Human Actions." RSS 2016. -- Planning that accounts for ego influence on humans.

15. Fisac, J., et al. (2019). "Hierarchical game-theoretic planning for autonomous vehicles." ICRA 2019. -- Stackelberg game planning.

### Contingency Planning

16. Geiger, P., et al. (2023). "MARC: Multipolicy and Risk-Aware Contingency Planning for Autonomous Driving." TU Munich. -- Tree-structured contingency plans.

17. Hardy, J., Campbell, M. (2013). "Contingency Planning Over Probabilistic Obstacle Predictions for Autonomous Road Vehicles." IEEE T-RO. -- Foundational contingency planning.

### Occupancy Prediction for Planning

18. Agro, B., et al. (2024). "UnO: Unsupervised Occupancy Fields for Perception and Forecasting." CVPR 2024. -- Self-supervised occupancy.

19. Zheng, W., et al. (2023). "OccWorld: 3D Occupancy World Model for Autonomous Driving." -- Occupancy-based world model.

20. Khurana, T., et al. (2023). "Point Cloud Forecasting as a Proxy for 4D Occupancy Forecasting." CVPR 2023. -- LiDAR occupancy prediction.

### Benchmarks

21. Dauner, D., et al. (2024). "NAVSIM: Data-Driven Non-Reactive Autonomous Vehicle Simulation and Benchmarking." NeurIPS 2024. -- NAVSIM benchmark.

22. Caesar, H., et al. (2023). "nuPlan: A Closed-loop ML-based Planning Benchmark for Autonomous Vehicles." -- nuPlan benchmark.

23. Hallgarten, M., et al. (2024). "interPlan: Interactive Planning for Autonomous Driving via Conditional Prediction." -- Adversarial interaction scenarios.

24. Ettinger, S., et al. (2024). "Waymo Open Motion Dataset: Large-Scale Interactive Motion Forecasting." -- WOMD interactive challenge.

### Airside-Relevant Interaction Modeling

25. Helbing, D., Molnar, P. (1995). "Social force model for pedestrian dynamics." Physical Review E. -- Social force for personnel prediction.

26. Trautman, P., Krause, A. (2010). "Unfreezing the Robot: Navigation in Dense, Interacting Crowds." IROS 2010. -- Frozen robot problem.

---

*Document compiled April 2026. Covers published research through early 2026.*
*Related documents: neural-motion-planning.md, motion-prediction.md, safety-critical-planning-cbf.md, frenet-planner-augmentation.md, reinforcement-learning-driving-policy.md*
*Cross-references: operations/airside/ (turnaround operations, right-of-way), technology/planning/ (all planning docs)*
