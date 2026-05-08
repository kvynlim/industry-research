# Neural / Learned Motion Planning for Autonomous Driving

## State of the Art (2023-2026)

---

## Table of Contents

1. [Introduction and Taxonomy](#1-introduction-and-taxonomy)
2. [Imitation Learning Planners](#2-imitation-learning-planners)
3. [Game-Theoretic Planners](#3-game-theoretic-planners)
4. [Optimization-Based Neural Planners](#4-optimization-based-neural-planners)
5. [Planning with Language / VLA](#5-planning-with-language--vla)
6. [Safety-Constrained Neural Planning](#6-safety-constrained-neural-planning)
7. [NAVSIM Benchmark](#7-navsim-benchmark)
8. [Practical Deployment](#8-practical-deployment)
9. [Summary Comparison Table](#9-summary-comparison-table)
10. [Airside Applicability](#10-airside-applicability)

---

## 1. Introduction and Taxonomy

Classical motion planning (Frenet sampling, lattice search, RRT*, optimization-based MPC) has powered every production autonomous vehicle to date. These methods are well-understood, certifiable, and provide hard constraint satisfaction. However, they rely on hand-tuned cost functions, struggle with complex multi-agent interactions, and cannot learn from data at scale.

Neural / learned motion planners replace or augment the hand-coded components with learned representations, cost functions, or end-to-end trajectory generators. The field has exploded since 2023, driven by three catalysts:

1. **nuPlan** (Motional, 2023) -- the first large-scale real-world closed-loop planning benchmark (1,500 hours of driving data from 4 cities)
2. **NAVSIM** (Autonomous Vision Group, NeurIPS 2024) -- a scalable non-reactive benchmark that enabled 143 teams and 463 submissions at CVPR 2024
3. **End-to-end architectures** (UniAD, VAD, SparseDrive) that integrate planning into perception-prediction pipelines

### Taxonomy of Neural Planning Approaches

```
Neural Motion Planning
|
+-- Imitation Learning
|   +-- Behavioral Cloning (BC)           -- direct trajectory regression
|   +-- DAgger / Interactive IL            -- online correction of distribution shift
|   +-- Generative IL (diffusion, VAE)     -- model trajectory distributions
|
+-- Game-Theoretic
|   +-- Level-k reasoning (GameFormer)     -- iterative best-response
|   +-- Nash equilibrium solvers           -- simultaneous optimization
|   +-- Contingency planning (MARC)        -- tree-structured policy-conditioned plans
|
+-- Optimization-Based (Differentiable)
|   +-- Learned cost + classical optimizer -- DIPP, DTPP
|   +-- Differentiable optimization layers -- OptNet-style QP layers
|   +-- Neural MPC                         -- learned dynamics in MPC loop
|
+-- Language / VLA-Guided
|   +-- VLA action experts (Alpamayo)      -- reasoning + trajectory generation
|   +-- Dual-system (DriveVLM)             -- slow VLM + fast classical planner
|   +-- LLM as planner (PlanAgent)         -- code-generating planning agent
|
+-- Safety-Constrained
|   +-- Control Barrier Functions (CBF)    -- hard safety filtering
|   +-- RSS integration                    -- responsibility-sensitive constraints
|   +-- Safe RL (SafeDreamer)              -- constrained world-model planning
|   +-- Simplex architecture               -- neural + classical fallback
```

### Why Classical Planning Persists

| Property | Classical | Neural |
|----------|-----------|--------|
| Hard constraint satisfaction | Yes (by construction) | No (must be enforced externally) |
| Certifiability | Formal proofs possible | Statistical guarantees only |
| Interpretability | Cost function terms are named | Learned features are opaque |
| Multi-modal trajectory generation | Sampling-based (limited diversity) | Generative (high diversity) |
| Interaction modeling | Rule-based (yield/merge logic) | Learned from data (emergent) |
| Adaptation to new environments | Manual cost tuning | Fine-tuning or zero-shot |
| Long-tail scenario handling | Brittle (needs explicit rules) | Generalizes from data distribution |
| Computational cost | Predictable, O(N_candidates) | Variable, depends on model size |

The practical reality: **every deployed AV still uses classical planning as the primary or fallback system**. Neural planners are either used as additional cost terms, trajectory proposal generators, or high-level decision makers that parameterize a classical low-level planner.

---

## 2. Imitation Learning Planners

Imitation learning (IL) trains a planner to mimic expert driving demonstrations. The core formulation: given a dataset of expert state-action pairs D = {(s_i, a_i)}, learn a policy pi(a|s) that matches the expert's behavior.

### 2.1 Training Paradigms

#### Behavioral Cloning (BC)

The simplest IL approach: supervised learning on expert demonstrations.

```
Loss = E_{(s,a) ~ D} [ || pi_theta(s) - a ||^2 ]
```

**Strengths:**
- Simple to implement, fast to train
- No simulator required
- Scales well with data

**Weaknesses:**
- **Covariate shift**: small errors compound because the policy visits states never seen in expert data. A policy trained to imitate may drift off-trajectory and encounter out-of-distribution states, causing cascading failures.
- **Mode averaging**: when the expert has multi-modal behavior (e.g., sometimes turns left, sometimes right), L2 regression averages the modes, producing a trajectory that goes straight into an obstacle.
- Theoretical error bound: O(T^2 * epsilon) where T is horizon and epsilon is per-step error.

#### DAgger (Dataset Aggregation)

Addresses covariate shift by iteratively:
1. Roll out the current policy in the environment
2. Query the expert for labels at the visited states
3. Aggregate new data into the training set
4. Retrain the policy

**Error bound improvement:** O(T * epsilon) -- linear rather than quadratic in horizon.

**Practical challenge:** Requires an expert oracle available at training time. For autonomous driving, this means either a simulator with a privileged planner, or expensive human annotation of policy-visited states. DAgger remains impractical for real-world training at scale, but is widely used in simulation-based pipelines.

**MEGA-DAgger** (2023) extends DAgger to multiple imperfect experts, filtering unsafe demonstrations while aggregating training data.

#### Generative IL

Modern planners increasingly use generative models to capture multi-modal trajectory distributions:
- **Diffusion-based**: DiffusionDrive, Diffusion-Planner -- model p(tau|context) as a denoising process
- **VAE-based**: GenAD -- encode trajectories in a latent space, sample diverse futures
- **Flow matching**: Alpamayo action expert -- continuous normalizing flows for trajectory generation

Generative approaches naturally handle multi-modality without mode averaging, a fundamental advantage over regression-based BC.

### 2.2 PlanTF (ICRA 2024)

**Paper:** "Rethinking Imitation-based Planner for Autonomous Driving"
**Venue:** ICRA 2024
**Authors:** Jcheng et al.
**Code:** [github.com/jchengai/planTF](https://github.com/jchengai/planTF) (open source)

PlanTF is a deliberately simple, pure learning-based baseline that achieves surprisingly strong performance without rule-based post-processing or optimization refinement.

**Key Contributions:**
1. **Systematic study of essential features**: Identifies which input features (ego state, agent states, map elements) actually matter for ego planning quality
2. **Data augmentation for IL**: Shows that effective augmentation (trajectory perturbation, agent dropout) significantly reduces compounding errors -- a fundamentally underexplored aspect of imitation-based planners
3. **Minimal architecture**: Transformer encoder for scene encoding, simple MLP decoder for trajectory generation

**Architecture:**
```
Multi-view inputs --> Scene Tokenizer --> Transformer Encoder --> MLP Decoder --> Trajectory waypoints
                      (agents, map,                               (6 future
                       ego state)                                  timesteps)
```

**Performance (nuPlan closed-loop):**
- Competitive with methods that use intricate rule-based strategies or post-optimization
- Demonstrates that a well-designed IL baseline can match complex pipelines
- Lightweight: 4-6 GB GPU memory at batch size 32

**Key Finding:** The choice of input features and data augmentation matters more than architectural complexity. This challenges the trend of ever-more-complex architectures.

**Deployment Relevance:** PlanTF's simplicity makes it a strong starting point for edge deployment. Its small model size and pure feed-forward inference are compatible with Orin-class hardware.

### 2.3 UniAD Planner (CVPR 2023 Best Paper)

**Paper:** "Planning-Oriented Autonomous Driving"
**Venue:** CVPR 2023 (Best Paper Award)
**Authors:** OpenDriveLab, Wuhan University, SenseTime
**Code:** [github.com/OpenDriveLab/UniAD](https://github.com/OpenDriveLab/UniAD) (open source)

UniAD's planner is the final module in a unified perception-prediction-planning pipeline. It is not a standalone planner -- it depends on the full UniAD stack.

**How the Planner Works:**
1. **Inputs from upstream modules:**
   - Tracked agent bounding boxes and features (from TrackFormer)
   - Online HD map elements (from MapFormer)
   - Predicted agent trajectories (from MotionFormer)
   - Predicted occupancy grids (from OccFormer)
2. **Ego query mechanism:** A learned ego query token attends to all upstream features via cross-attention, aggregating relevant scene information
3. **Trajectory generation:** The ego query is decoded through an MLP to produce 6 future waypoints (3 seconds at 2 Hz)
4. **Collision optimization:** An additional loss penalizes predicted trajectories that collide with predicted occupancy

**Training:**
- Two-stage: first train perception modules for 6 epochs, then end-to-end across all modules for 20 epochs
- Planning loss: L2 distance to expert trajectory + collision penalty
- The planning objective backpropagates through the entire pipeline, aligning perception and prediction toward planning quality

**Performance (nuScenes open-loop):**
| Metric | Value |
|--------|-------|
| L2 Error (3s) | 0.73 m |
| Collision Rate | 0.61% |
| Training Time | 144h on 8x A100 |
| Inference FPS | 1.8 |

**Significance:** UniAD proved that jointly optimizing perception, prediction, and planning yields better results than optimizing each independently. However, its planner component is relatively simple -- the innovation is in the full pipeline integration, not the planner architecture itself.

**Limitations for Deployment:**
- 1.8 FPS is far too slow for real-time planning (need 10+ Hz)
- Camera-only input
- Open-loop evaluation only on nuScenes (no closed-loop results on nuPlan)

### 2.4 VAD Planner (ICCV 2023 / ICLR 2026)

**Paper:** "VAD: Vectorized Scene Representation for Efficient Autonomous Driving"
**Venue:** VAD at ICCV 2023; VADv2 at ICLR 2026
**Authors:** HUST (Huazhong University of Science and Technology)
**Code:** [github.com/hustvl/VAD](https://github.com/hustvl/VAD) (open source)

VAD replaces dense BEV rasterization with a fully vectorized scene representation, making it significantly faster than UniAD while achieving better collision avoidance.

**How the Planner Works:**
1. **Scene tokenization:** The driving scene is encoded into agent query tokens and map query tokens (vectorized polylines, not raster grids)
2. **Ego query interaction:** A learned ego query attends to both agent queries and map queries, extracting relevant scene information through cross-attention
3. **Planning head:** Combines ego query features with ego status features (velocity, acceleration) and a high-level driving command (turn left/right/straight) to produce trajectory waypoints
4. **Vectorized constraints (key innovation):** Instead of relying solely on L2 regression loss, VAD introduces three explicit planning constraints as vectorized checks:
   - **Ego-agent collision constraint:** Checks predicted ego trajectory against predicted agent trajectories
   - **Ego-boundary overstepping constraint:** Checks ego trajectory against vectorized road boundaries
   - **Ego-lane directional constraint:** Ensures ego trajectory follows lane direction

**Performance (nuScenes open-loop):**
| Metric | VAD | VADv2 |
|--------|-----|-------|
| L2 Error (3s) | 0.72 m | -- |
| Collision Rate | 0.21% | SOTA on CARLA Town05 |
| Inference Speed | ~4x faster than UniAD | Real-time capable |

**VADv2 Key Advance:** Moves from deterministic trajectory regression to **probabilistic planning** -- outputs a distribution over actions and samples from it. This handles multi-modality natively. No rule-based wrappers needed.

**Why VAD Matters for Deployment:**
- Vectorized representation is inherently more efficient than dense BEV grids
- The three vectorized constraints are lightweight and effective
- VADv2's probabilistic formulation avoids mode averaging

### 2.5 SparseDrive Planner (ECCV 2024)

**Paper:** "SparseDrive: End-to-End Autonomous Driving via Sparse Scene Representation"
**Venue:** ECCV 2024 (Best Paper Candidate)
**Authors:** Sun Wenchao et al.
**Code:** [github.com/swc-17/SparseDrive](https://github.com/swc-17/SparseDrive) (open source)

SparseDrive achieves the best known collision rate (0.06%) on nuScenes through a sparse-centric paradigm that treats planning and prediction as symmetric tasks.

**How the Planner Achieves 0.06% Collision Rate:**

1. **Sparse perception module:** Represents agents as sparse instance features F_d (N_d x C) with anchor boxes B_d (N_d x 11), and map elements as anchor polylines (N_m x N_p x 2). Uses 900 detection anchors, 6 decoder layers, 100 map polylines with 20 points each.

2. **Parallel motion planner (key innovation):** Exploits the structural similarity between motion prediction and ego planning:
   - Both predict future trajectories
   - Both need agent-agent and agent-map interaction modeling
   - SparseDrive runs them in **parallel** with shared architecture
   - Produces 6 multi-modal trajectory proposals for both prediction (12 future timesteps) and planning (6 future timesteps)

3. **Hierarchical planning selection:**
   - **Step 1 -- Command filtering:** Filter trajectory proposals by high-level driving command (left/right/straight)
   - **Step 2 -- Collision-aware rescore:** For each remaining proposal, check for collision with predicted agent trajectories. Trajectories that collide have their scores set to zero.
   - **Step 3 -- Best trajectory selection:** Select highest-scoring non-colliding trajectory

4. **Ego initialization (avoiding status leakage):** Ego features are derived from front camera feature map via average pooling, NOT from ground-truth ego velocity. This prevents the model from "cheating" by using privileged information.

5. **Instance memory queue:** Temporal modeling via (N_d+1) x 3 memory queue with three interaction types:
   - Agent-temporal cross-attention (how agents evolve over time)
   - Agent-agent self-attention (how agents interact)
   - Agent-map cross-attention (how agents relate to road structure)

**Performance Comparison (nuScenes open-loop):**

| Method | L2 (m) | Collision (%) | Training (h) | FPS | Memory (MB) |
|--------|--------|---------------|---------------|-----|-------------|
| UniAD | 0.73 | 0.61 | 144 (8xA100) | 1.8 | 2451 |
| VAD | 0.72 | 0.21 | -- | -- | -- |
| **SparseDrive-S** | **0.61** | **0.10** | **20** | **9.0** | **1294** |
| **SparseDrive-B** | **0.58** | **0.06** | **30** | **7.3** | **1437** |

SparseDrive-B achieves 71.4% lower collision rate than VAD (0.06% vs 0.21%), trains 4.8x faster than UniAD, runs 4x faster, and uses 41% less GPU memory.

**Why SparseDrive Wins:**
- Sparse representations avoid wasting computation on empty space
- Parallel prediction-planning shares computation and ensures consistency
- Collision-aware rescoring is a simple but effective safety mechanism
- No post-processing or rule-based refinement needed

### 2.6 GenAD (ECCV 2024)

**Paper:** "GenAD: Generative End-to-End Autonomous Driving"
**Venue:** ECCV 2024
**Authors:** Zheng et al.
**Code:** [github.com/wzzheng/GenAD](https://github.com/wzzheng/GenAD) (open source)

GenAD models planning as a generative process in a learned structural latent space, simultaneously predicting agent futures and ego trajectory.

**Architecture:**
1. **Instance-centric scene tokenizer:** Transforms surrounding agents and map elements into map-aware instance tokens
2. **Structural latent space (VAE):** Learns a distribution over future trajectories. The VAE encoder maps ground-truth future trajectories to a latent code z; the decoder reconstructs trajectories from z.
3. **Temporal model:** Captures temporal evolution of agents and ego in the latent space, enabling rollout of future states
4. **Joint generation:** At inference, samples z from the learned prior, conditions on instance tokens, and generates both ego trajectory and agent predictions simultaneously

**Key Innovation:** By performing planning in a learned latent space (rather than directly in coordinate space), GenAD naturally captures multi-modal trajectory distributions without mode averaging. The structural prior in the latent space encodes physical plausibility.

**Performance:** State-of-the-art on nuScenes for vision-centric end-to-end driving with high efficiency.

**Open Source:** Yes. Repository includes training code and model weights.

### 2.7 Diffusion-Planner (ICLR 2025 Oral)

**Paper:** "Diffusion-Based Planning for Autonomous Driving with Flexible Guidance"
**Venue:** ICLR 2025 (Oral presentation)
**Authors:** Zheng Yinan et al.
**Code:** [github.com/ZhengYinan-AIR/Diffusion-Planner](https://github.com/ZhengYinan-AIR/Diffusion-Planner) (open source)

Diffusion-Planner represents the current pinnacle of diffusion-based planning, achieving state-of-the-art closed-loop performance on nuPlan.

**Architecture:**
- Transformer-based diffusion model for closed-loop planning
- **Joint prediction and planning:** Models both ego trajectory and surrounding agent trajectories in a single diffusion process, ensuring consistency between ego plan and predicted scene evolution
- **Flexible classifier guidance:** Learns the gradient of a trajectory score function and uses classifier-free guidance to steer generation toward desired properties (safety, comfort, speed) **without additional training**

**Key Innovation -- Flexible Guidance:**
After training the base diffusion model, different guidance signals can be applied at inference to modify planning behavior:
- Safety guidance: penalize trajectories close to other agents
- Comfort guidance: penalize high jerk/acceleration
- Speed guidance: encourage target velocity
- These guidance gradients are computed in parallel and are differentiable

**Performance (nuPlan closed-loop):**
- State-of-the-art closed-loop performance
- Robust transferability: trained on nuPlan, tested on a separate 200-hour delivery-vehicle dataset
- No rule-based refinement needed

**Significance for Neural Planning:**
Diffusion-Planner shows that diffusion models can achieve closed-loop performance competitive with or better than methods using extensive rule-based post-processing. The flexible guidance mechanism provides a principled way to inject safety and comfort constraints without retraining.

**Relationship to Existing Repo Coverage:** The diffusion-trajectory-planning.md document covers Diffuser (ICML 2022) and DiffusionDrive (truncated diffusion). Diffusion-Planner is the next evolution: joint prediction-planning with classifier guidance, validated on nuPlan rather than just nuScenes.

---

## 3. Game-Theoretic Planners

Game-theoretic planners model driving as a multi-agent strategic interaction where each agent optimizes its behavior while accounting for others' responses. This is fundamentally different from IL planners that treat other agents as part of the environment.

### 3.1 GameFormer (ICCV 2023 Oral)

**Paper:** "GameFormer: Game-theoretic Modeling and Learning of Transformer-based Interactive Prediction and Planning for Autonomous Driving"
**Venue:** ICCV 2023 (Oral)
**Authors:** Zhiyu Huang et al. (NUS)
**Code:** [github.com/MCZhi/GameFormer](https://github.com/MCZhi/GameFormer) (open source)

GameFormer formulates multi-agent prediction and planning as a hierarchical game with level-k reasoning, implemented via a novel hierarchical transformer decoder.

**Level-k Reasoning:**
```
Level 0: Each agent predicts independently (no interaction awareness)
         pi_i^0 = argmax_a P(a | s, map)

Level 1: Each agent responds to others' Level-0 predictions
         pi_i^1 = argmax_a P(a | s, map, {pi_j^0 for j != i})

Level k: Each agent responds to others' Level-(k-1) predictions
         pi_i^k = argmax_a P(a | s, map, {pi_j^{k-1} for j != i})
```

**Architecture:**
1. **Transformer encoder:** Encodes scene context (agents, map, traffic lights) into a shared representation
2. **Hierarchical transformer decoder:** K stacked decoder layers, each implementing one level of reasoning:
   - Input: prediction outcomes from previous level + shared scene context
   - Output: refined trajectory predictions for all agents
   - The ego agent's trajectory at level k responds to others' level-(k-1) trajectories
3. **Typically K=3 levels** -- deeper levels show diminishing returns

**Training:**
- Supervised with expert trajectories
- Each level's output is supervised, not just the final level
- This provides dense gradient signal and stabilizes training

**Performance:**
- State-of-the-art on Waymo Open Motion Dataset (WOMD) interaction prediction
- Competitive on nuPlan closed-loop planning benchmark

**GameFormer-Planner Extension:**
Extended GameFormer for full planning pipeline:
1. Feature processing of scene elements
2. Path planning (candidate route generation)
3. Model query (GameFormer interaction reasoning)
4. Trajectory refinement

Validated on nuPlan with competitive open-loop and closed-loop results.

**Why Game Theory Matters:**
- Avoids the "frozen robot" problem: ego doesn't freeze because it knows others will react
- Handles negotiation: merging, yielding, lane changes involve implicit game dynamics
- Level-k is computationally tractable (unlike full Nash equilibrium)

### 3.2 MARC (Multipolicy and Risk-Aware Contingency Planning)

**Paper:** "MARC: Multipolicy and Risk-aware Contingency Planning for Autonomous Driving"
**Venue:** arXiv 2023 (cited extensively in 2024-2025 planning literature)
**Authors:** TU Munich
**Code:** C++11 implementation

MARC generates tree-structured contingency plans that branch based on how the scene might evolve, addressing the limitation of single-trajectory planners.

**Key Concepts:**

1. **Policy-conditioned scenario trees:** For each high-level ego policy (e.g., "merge now" vs. "yield"), MARC simulates how other agents would react, producing different scenario branches

2. **Dynamic branchpoint:** Identifies the latest time at which trajectories for different ego policies remain within a deviation threshold. Before this point, a single shared trajectory is executed; after it, the plan branches.

3. **Risk-aware selection:** Evaluates each branch for risk (collision probability, constraint violation) and selects the policy with the best risk-reward tradeoff

**Architecture:**
```
Ego Policies (semantic) --> Scenario Generator --> Tree-Structured Plans
  e.g., merge/yield       (conditioned on      --> Dynamic Branchpoint
                            each policy)        --> Risk Evaluation
                                                --> Selected Contingency Plan
```

**Performance:**
- Runs at **20 Hz** on Intel i9-12900K (no GPU required)
- C++11 implementation with customized solvers
- Demonstrates safe, non-conservative behavior in dense traffic

**Significance:** MARC bridges the gap between semantic-level decision-making (which policy to follow) and trajectory-level planning (what exact path to take). The contingency tree structure means the vehicle always has a fallback plan ready.

### 3.3 Nash Equilibrium Formulation for Multi-Agent Planning

The multi-agent planning problem can be formalized as finding a Generalized Nash Equilibrium (GNE): a set of strategies where no agent has incentive to unilaterally deviate.

**Formal Definition:**
For N agents, each with strategy u_i and cost function J_i:
```
u* = (u_1*, ..., u_N*) is a GNE if:
  for all i: J_i(u_i*, u_{-i}*) <= J_i(u_i, u_{-i}*) for all feasible u_i
  subject to: shared constraints (collision avoidance, road boundaries)
```

**Computational Approaches (2024-2025):**
- **Iterative best-response:** Each agent optimizes in turn, holding others fixed. Converges to Nash in many practical cases. GameFormer's level-k reasoning is a neural approximation of this.
- **Potential games:** If the interaction can be formulated as a potential game (all agents implicitly optimize the same potential function), Nash equilibria can be found efficiently. Lane-following scenarios often have this structure.
- **MCCFR-S:** Monte Carlo Counterfactual Regret minimization for games of incomplete information, parallelizable and proven to converge. Applied to scenarios where agents have private information (e.g., intended destination).
- **Bayesian game formulation:** Models uncertainty about other agents' types/intentions as a Bayesian game, finding Bayes-Nash equilibria that account for belief distributions.

**Practical Limitations:**
- Full Nash equilibrium computation is NP-hard for general games
- Real traffic agents are not fully rational -- they make mistakes, have limited information
- Level-k reasoning (GameFormer) or single-iteration best-response (DIPP) are practical approximations
- Real-time constraint: Nash solvers must complete within planning cycle (<100 ms)

### 3.4 Interaction-Aware Joint Prediction-Planning

The fundamental insight: prediction and planning are not independent. The ego's plan affects how others behave, and others' predicted behavior affects the ego's plan.

**Key Methods:**

| Method | Approach | Key Feature |
|--------|----------|-------------|
| GameFormer | Level-k reasoning | Hierarchical decoder refines predictions across levels |
| MARC | Policy-conditioned scenarios | Tree-structured contingency plans |
| M2I (CVPR 2022) | Influencer-reactor decomposition | Asymmetric causal interaction modeling |
| FJMP (CVPR 2023) | DAG-structured joint prediction | Partial ordering of agents by causal influence |
| DTPP (ICRA 2024) | Conditional prediction + cost eval | Differentiable prediction-planning with tree policy |

**The Chicken-and-Egg Problem:**
- To plan, we need to predict what others will do
- But what others do depends on what we plan to do
- Breaking this circular dependency requires either:
  a. Iterate (GameFormer, DIPP)
  b. Model jointly (GenAD, Diffusion-Planner)
  c. Assume ego is non-influential (most IL planners -- often wrong)

---

## 4. Optimization-Based Neural Planners

These methods combine the strengths of learned representations with classical trajectory optimization, creating differentiable pipelines where the optimizer's gradients flow through the learned components.

### 4.1 DIPP: Differentiable Integrated Prediction and Planning

**Paper:** "Differentiable Integrated Motion Prediction and Planning with Learnable Cost Function for Autonomous Driving"
**Venue:** IEEE T-NNLS 2023
**Authors:** Zhiyu Huang et al. (same group as GameFormer)
**Code:** [github.com/MCZhi/DIPP](https://github.com/MCZhi/DIPP) (open source)

**Architecture:**
```
Observations --> Prediction Network --> Predicted Agent Trajectories
                                              |
                                              v
                 Differentiable Optimizer <-- Learned Cost Function
                         |                        ^
                         v                        |
                 Ego Trajectory -----> Loss (vs expert) ---> Backprop to cost weights
```

**How It Works:**
1. A neural network predicts surrounding agents' future trajectories
2. A **differentiable nonlinear optimizer** takes predicted trajectories as constraints and optimizes the ego trajectory
3. The cost function is **learned**: weights on terms like collision risk, lane deviation, comfort are learned end-to-end by backpropagating through the optimizer
4. The key insight: because the optimizer is differentiable, the planning loss (mismatch with expert trajectory) can backpropagate all the way to the prediction network, jointly optimizing prediction and planning

**Why This Matters:**
- The prediction network learns to predict trajectories that are useful for planning, not just accurate
- The cost function adapts to the data distribution rather than requiring manual tuning
- Classical optimization guarantees (constraint satisfaction, convergence) are preserved

**Results:**
- Joint training outperforms separate training in both open-loop and closed-loop tests
- The learned cost function captures nuances that hand-tuned functions miss

### 4.2 DTPP: Differentiable Joint Conditional Prediction and Cost Evaluation

**Paper:** "DTPP: Differentiable Joint Conditional Prediction and Cost Evaluation for Tree Policy Planning in Autonomous Driving"
**Venue:** ICRA 2024
**Authors:** Zhiyu Huang, Peter Karkus et al.
**Code:** Available (same research group)

DTPP extends DIPP to handle the interaction-awareness problem through tree-structured policy evaluation.

**Architecture:**
1. **Query-centric Transformer prediction network:** Predicts surrounding agents' trajectories conditioned on ego's intended action (not just the current state)
2. **Ego conditioning:** Efficiently injects the ego's candidate future trajectory into the prediction, enabling conditional prediction ("if I do X, what will they do?")
3. **Tree policy planner:** Evaluates multiple ego policy branches (tree structure), where each branch has different conditional predictions
4. **Learned cost model:** Combines handcrafted features (time-to-collision, lane offset) with learned context-aware weights

**Key Innovation:** The prediction loss from the cost evaluation backpropagates to the prediction module, ensuring predictions are optimized for planning utility, not just accuracy.

**Differentiable Pipeline:**
```
Ego Policy Tree --> Conditional Prediction --> Learned Cost Evaluation --> Policy Selection
      ^                                              |
      |______________________________________________|
                    Gradient backpropagation
```

### 4.3 OptNet and Differentiable Optimization Layers

**Paper:** "OptNet: Differentiable Optimization as a Layer in Neural Networks"
**Venue:** ICML 2017 (foundational work)
**Authors:** Brandon Amos, J. Zico Kolter (CMU)
**Code:** [github.com/locuslab/optnet](https://github.com/locuslab/optnet) (open source)

OptNet embeds quadratic program (QP) solvers as layers in neural networks, enabling end-to-end learning through optimization.

**Core Idea:**
```
Standard neural layer: y = f(Wx + b)
OptNet layer: y = argmin_z (1/2)z'Qz + q'z  subject to Az <= b, Gz = h
              where Q, q, A, b, G, h can depend on network outputs
```

**Application to Motion Planning:**

1. **Neural cost function + QP planner:** A neural network outputs cost function parameters (Q, q) and constraint parameters (A, b) based on the perceived scene. An OptNet layer solves the resulting QP to produce the optimal trajectory. Gradients flow through the QP solver via implicit differentiation.

2. **Advantages:**
   - Hard constraints are satisfied by construction (the QP solver guarantees feasibility)
   - The neural network only needs to learn the cost landscape, not solve the optimization
   - Combines neural perception with certifiable planning

3. **Limitations:**
   - QP solvers have fixed computational cost per iteration
   - Scaling to long horizons or many constraints is expensive
   - Nonlinear dynamics require sequential QPs or nonlinear programming

**Modern Extensions (2024-2025):**
- **CvxpyLayers:** Differentiable convex optimization layers (broader than QP)
- **Theseus:** Meta's differentiable nonlinear least-squares optimizer, specifically designed for robotics
- **DiffCoSim:** Differentiable constrained simulation for contact-rich planning

### 4.4 Combining ML Perception with Classical Trajectory Optimization

The practical pattern used by most deployed AVs:

```
Camera/LiDAR --> Neural Perception --> Tracked Objects + Map
                                              |
                                              v
                                    Classical Planner
                                    (Frenet / Lattice / MPC)
                                              |
                                              v
                                    Trajectory + Controls
```

**How to add neural components incrementally:**

| Integration Level | What Changes | Risk Level |
|-------------------|-------------|------------|
| **Level 1: Neural perception only** | Object detection, tracking, map prediction are neural; planner is classical | Low -- planner has safety guarantees |
| **Level 2: Neural cost terms** | Add learned cost functions (e.g., occupancy-based collision cost) alongside hand-tuned costs | Medium -- fallback to hand-tuned costs if neural cost fails |
| **Level 3: Neural trajectory proposals** | Neural model proposes candidate trajectories; classical optimizer refines them | Medium -- classical refinement ensures feasibility |
| **Level 4: Neural planner with classical fallback** | Neural planner is primary; Simplex architecture switches to classical if safety monitor triggers | Medium-High -- depends on monitor quality |
| **Level 5: Fully neural end-to-end** | UniAD/SparseDrive/GenAD style -- neural from sensors to trajectory | High -- no classical safety net |

**Recommendation for airside deployment:** Start at Level 2-3, advancing to Level 4 with validated Simplex switching logic. Level 5 is a research goal, not a near-term deployment target.

---

## 5. Planning with Language / VLA

### 5.1 DriveVLM Planner (2024)

**Paper:** "DriveVLM: The Convergence of Autonomous Driving and Large Vision-Language Models"
**Venue:** arXiv 2024 (Tsinghua MARS Lab)
**Authors:** Tian et al.

DriveVLM uses a VLM for high-level reasoning and a classical planner for low-level trajectory generation, forming a **slow-fast dual system**.

**Architecture:**
```
Camera Images --> VLM (slow, ~1-2 Hz)
                    |
                    +-- Scene Description (what's happening)
                    +-- Scene Analysis (what matters, why)
                    +-- Hierarchical Planning (coarse trajectory + intent)
                              |
                              v
                    Classical Planner (fast, 10-20 Hz)
                    (uses VLM trajectory as reference/initial solution)
                              |
                              v
                    Final Trajectory (smooth, collision-free)
```

**How the Dual System Works:**
1. **VLM runs at low frequency (~1-2 Hz):** Produces a reference trajectory, scene description, and intent analysis using chain-of-thought reasoning
2. **Classical planner runs at high frequency (10-20 Hz):** Takes the VLM trajectory as either:
   - An initial solution for optimization (warm-starting the optimizer)
   - An input query for a neural refinement network
3. **Safety:** The classical planner enforces hard constraints (collision avoidance, road boundaries) regardless of what the VLM suggests

**Significance:** DriveVLM demonstrates a practical deployment pattern: use the VLM for its reasoning capabilities (understanding complex scenes, handling edge cases) but don't rely on it for real-time control. The classical planner provides the safety and frequency guarantees.

### 5.2 Alpamayo Action Expert (NVIDIA, January 2026)

**Paper:** "Alpamayo-R1: Bridging Reasoning and Action Prediction for Generalizable Autonomous Driving in the Long Tail"
**Venue:** arXiv / NeurIPS 2025
**Authors:** NVIDIA
**Weights:** [huggingface.co/nvidia/Alpamayo-R1-10B](https://huggingface.co/nvidia/Alpamayo-R1-10B) (non-commercial license)

Alpamayo is a 10B-parameter VLA (8.2B Cosmos-Reason backbone + 2.3B action expert) that generates trajectories alongside reasoning traces.

**How the Action Expert Works:**

1. **Cosmos-Reason backbone (8.2B params):** Processes video input and generates chain-of-causation reasoning tokens explaining the driving decision
2. **Action expert decoder (2.3B params):** A **diffusion-based trajectory decoder built on flow matching** that converts reasoning tokens into continuous trajectory waypoints
3. **Output:** 6.4 seconds of future trajectory (64 waypoints at 10 Hz) with position and rotation in ego coordinates

**Flow Matching for Trajectory Generation:**
```
Reasoning tokens --> Flow Matching Decoder --> 64 waypoints (x, y, yaw)
                     (conditional generation      at 10 Hz
                      from noise to trajectory,    6.4s horizon
                      conditioned on reasoning)
```

Flow matching is more efficient than full diffusion (fewer denoising steps needed) and produces smoother trajectories. The action expert generates multi-modal trajectory samples, from which the highest-scoring trajectory is selected.

**Performance:**
- 12% improvement in planning accuracy on challenging cases vs trajectory-only baselines
- 35% reduction in off-road rate
- 25% reduction in close encounter rate
- Targets 99 ms latency for real-time inference (10 Hz)

**Deployment Considerations:**
- 10B parameters is too large for Orin (275 TOPS) in its native form
- Designed as a **teacher model** for distillation to smaller edge-deployable models
- The action expert (2.3B params) could potentially be distilled separately
- NVIDIA Thor (~1,000 TOPS) is the target deployment platform for full-scale Alpamayo

### 5.3 PlanAgent (2024)

**Paper:** "PlanAgent: A Multi-modal Large Language Agent for Closed-loop Vehicle Motion Planning"
**Venue:** arXiv 2024
**Authors:** Chen et al.

PlanAgent uses GPT-4V as a cognitive agent that generates planner code rather than directly outputting trajectories.

**Architecture:**
1. **Environment Transformation:** Converts the driving scene into a compact BEV map and lane-graph representation (reduces token usage vs. raw scene description)
2. **Reasoning Engine:** GPT-4V receives the scene representation and, through hierarchical chain-of-thought reasoning, generates Python code that parameterizes an Intelligent Driver Model (IDM) planner
3. **Reflection Module:** Evaluates the generated plan and feeds back to the LLM for correction if needed

**Key Innovation:** PlanAgent doesn't ask the LLM to output trajectory coordinates (which LLMs are bad at). Instead, it asks the LLM to write code that configures a classical planner. This leverages the LLM's strengths (reasoning, code generation) while avoiding its weaknesses (precise numerical output).

**Performance (nuPlan closed-loop):**
- Outperforms rule-based, learning-based, and other LLM-based planners in common scenarios
- Higher performance in long-tailed scenarios (the VLM's reasoning capability shines on edge cases)
- Zero-shot: no training on driving data required

**Practical Limitations:**
- Requires GPT-4V API calls -- not deployable on-vehicle
- Latency: seconds per planning step (suitable for strategic decisions, not real-time control)
- Cost: API inference costs are non-trivial at scale

### 5.4 Other LLM/VLA Planning Approaches

| Method | Year | Approach | Key Feature |
|--------|------|----------|-------------|
| GPT-Driver | 2023 | Trajectory as language tokens | First LLM-as-planner proof of concept |
| LanguageMPC | 2023 | LLM sets MPC parameters | High-level decisions, classical execution |
| LLM-Assist | 2024 | LLM augments rule-based planner | Fallback pattern: LLM advises, rules execute |
| DriveGPT4 | 2023/2025 | Multimodal LLM with video input | Interpretable end-to-end driving |
| DiLu | ICLR 2024 | Dilemma-driven LLM reasoning | Handles ethical/ambiguous scenarios |

**Convergent Pattern:** Nearly all practical LLM/VLA planners use a **dual-system architecture**: the LLM/VLA handles high-level reasoning at low frequency, while a classical or lightweight neural planner handles trajectory generation at high frequency. This is not a limitation -- it is the correct architecture for combining reasoning with real-time control.

---

## 6. Safety-Constrained Neural Planning

The fundamental challenge: neural planners learn from data and provide statistical guarantees at best. Safety-critical autonomous driving requires hard guarantees. How do we bridge this gap?

### 6.1 Control Barrier Functions (CBF) with Learned Dynamics

**Core Concept:** A Control Barrier Function h(x) defines a safe set S = {x : h(x) >= 0}. A controller u is safe if it keeps h(x) non-decreasing (or decreasing slowly enough) at the boundary of S.

**CBF Safety Condition:**
```
For continuous dynamics x_dot = f(x) + g(x)u:
  h_dot(x, u) + alpha(h(x)) >= 0   for all x on boundary of S

where alpha is a class-K function (e.g., alpha(h) = gamma * h)
```

**Integration with Neural Planners:**

1. **Neural CBF synthesis:** Use a neural network to parameterize h(x), trained to satisfy the CBF condition across the state space. Recent work (CP-NCBF, 2024) uses conformal prediction to provide probabilistic safety guarantees for neural CBFs.

2. **CBF as safety filter:**
```
Neural Planner --> Proposed trajectory u_nn
                          |
                          v
                   CBF Safety Filter
                   min ||u - u_nn||^2
                   s.t. h_dot(x, u) + alpha(h(x)) >= 0
                          |
                          v
                   Safe trajectory u*
```
The CBF filter minimally modifies the neural planner's output to ensure safety. This is a QP that can be solved in real-time (<1 ms).

3. **Learned dynamics models:** When the true dynamics f(x), g(x) are unknown, they can be learned from data. The CBF condition is then applied using the learned dynamics, with robustness margins to account for model error.

**Challenges:**
- Verification of neural CBFs is NP-hard in general, though tractable for ReLU networks using bound propagation (ICML 2025)
- The safe set must be specified a priori -- choosing h(x) to capture all relevant safety constraints is non-trivial
- Multi-agent CBFs (GCBF+, MIT 2024) extend to fleet coordination but scale quadratically with agent count

### 6.2 RSS (Responsibility-Sensitive Safety) Integration

**Original Formulation:** Intel/Mobileye, 2017
**Library:** [github.com/intel/ad-rss-lib](https://github.com/intel/ad-rss-lib) (open source, C++)

RSS defines five mathematical rules for safe driving:
1. Do not hit someone from behind
2. Do not cut in recklessly
3. Right-of-way is given, not taken
4. Be careful of areas with limited visibility
5. If you can avoid an accident without causing another, you must

**RSS as a Safety Layer for Neural Planners:**
```
Perception --> Object List (positions, velocities, dimensions)
                     |
                     v
              RSS Safety Module
              (computes safe longitudinal/lateral distances)
                     |
                     v
              Actuator Command Restrictions
              (max/min acceleration limits)
                     |
                     v
              Neural Planner (must operate within RSS limits)
```

**Integration Pattern:**
1. RSS receives the object list from perception
2. Computes the "proper response" -- acceleration limits that guarantee safety under worst-case assumptions about other agents
3. The neural planner's output is clipped to these limits
4. If the neural planner violates RSS constraints, the RSS layer overrides with the minimum intervention needed

**eRSS-RAMP (2024):** Extends RSS for non-connected AVs in merging and emergency scenarios, formulating a rule-adherence motion planner that respects extended RSS constraints.

**Limitations:**
- RSS assumes worst-case behavior from other agents, leading to conservatism
- Does not handle all scenarios (e.g., RSS says nothing about which lane to drive in)
- Hard to calibrate safe distances for non-standard environments (airports, construction zones)
- Performance depends on perception quality -- if an object is misdetected, RSS cannot help

### 6.3 SafeDreamer (ICLR 2024)

**Paper:** "SafeDreamer: Safe Reinforcement Learning with World Models"
**Venue:** ICLR 2024
**Authors:** PKU Alignment Team
**Code:** [github.com/PKU-Alignment/SafeDreamer](https://github.com/PKU-Alignment/SafeDreamer) (open source)

SafeDreamer integrates Lagrangian-based constrained optimization into world model planning (specifically DreamerV3), enabling RL-based planning with safety constraints.

**Architecture:**
```
Observations --> World Model (DreamerV3 backbone)
                      |
                      v
              Imagined Rollouts (in learned dynamics)
                      |
                      +-- Reward estimation R(s, a)
                      +-- Cost estimation C(s, a)  <-- safety indicator
                      |
                      v
              Lagrangian Optimization
              max_pi E[sum R] s.t. E[sum C] <= threshold
              (balance reward and safety cost via learned Lagrange multiplier)
                      |
                      v
              Safe Policy pi*(a|s)
```

**Variants:**
- **OSRP:** Online Safety-Reward Planning within the world model
- **OSRP-Lag:** OSRP with Lagrangian balancing of long-term rewards and costs
- **BSRP-Lag:** Background planning with Lagrangian constraints

**Performance:**
- Achieves **nearly zero-cost** (zero constraint violations) across Safety-Gymnasium benchmarks
- Works with both low-dimensional and **vision-only** inputs
- First method to achieve zero-cost on vision-based safety tasks

**Driving Applications:**
- Extended experiments in the paper's appendix demonstrate applicability to driving scenarios
- The cost function can encode collision avoidance, road boundary violations, speed limits
- The world model enables "imagining" consequences of actions before executing them

**Significance:** SafeDreamer provides a principled framework for safe RL-based planning that is directly applicable to autonomous driving. By separating rewards (progress, comfort) from costs (safety violations), it avoids the common problem of reward-hacking where an agent finds unsafe shortcuts to maximize reward.

### 6.4 The Simplex Architecture for Neural Planning

**Original:** Sha (2001), extended by Phan et al. (NFM 2020) as "Neural Simplex Architecture"

The Simplex architecture is the most practical safety framework for deploying neural planners in safety-critical systems.

**Components:**
```
                    +-- Neural Planner (high-performance, no safety guarantee)
Sensor Input -->    |
                    +-- Classical Planner (safe, conservative, always ready)
                    |
                    +-- Safety Monitor (decides which planner controls the vehicle)
                              |
                              v
                    Selected Trajectory --> Vehicle
```

**Switching Logic:**
1. **Normal operation:** Neural planner is active, producing high-quality trajectories
2. **Safety monitor** continuously evaluates:
   - Is the neural planner's trajectory feasible? (within dynamics constraints)
   - Does it violate safety boundaries? (collision, road departure)
   - Can the classical planner still recover from the current state? (reachability check)
3. **If any check fails:** Immediately switch to classical planner
4. **Recovery:** Switch back to neural planner when the classical planner has brought the system to a safe state AND the neural planner's proposals pass safety checks

**Key Properties:**
- **Provable safety:** If the classical planner is verified safe and the safety monitor is correct, the system is safe regardless of neural planner behavior
- **Graceful degradation:** Neural planner failures result in conservative driving, not crashes
- **Bounded recovery time:** The classical planner guarantees return to a safe state within bounded time

**Recent Work (2024-2025):**
- DRL-GAT-SA (2022) combines graph attention RL with Simplex for autonomous driving
- "The Use of the Simplex Architecture to Enhance Safety in Deep-Learning-Powered Autonomous Systems" (2025) provides a comprehensive survey and formal analysis
- "Towards Safe Path Tracking Using the Simplex Architecture" (2025) demonstrates Simplex for trajectory tracking with formal switching guarantees

**Practical Implementation for Airside:**
```
Neural Planner (SparseDrive-lite or PlanTF)
  |
  +-- Generates trajectory at 10 Hz
  |
Safety Monitor (runs in parallel):
  +-- Check: trajectory within speed limits (airside: 5-30 km/h)
  +-- Check: minimum distance to all detected objects > threshold
  +-- Check: trajectory within geofenced area
  +-- Check: classical planner can still reach safe stop from current state
  |
  +-- If ANY check fails --> Switch to Classical Planner
  |
Classical Planner (Frenet with conservative parameters):
  +-- Emergency stop capability always available
  +-- Conservative lane-following
  +-- Guaranteed collision-free within perception range
```

---

## 7. NAVSIM Benchmark

### 7.1 What NAVSIM Measures

**Paper:** "NAVSIM: Data-Driven Non-Reactive Autonomous Vehicle Simulation and Benchmarking"
**Venue:** NeurIPS 2024 (Datasets and Benchmarks Track); NAVSIM v2 at CoRL 2025
**Authors:** Autonomous Vision Group (Tuebingen / Bosch)
**Code:** [github.com/autonomousvision/navsim](https://github.com/autonomousvision/navsim) (open source)

NAVSIM is a **non-reactive** planning benchmark that evaluates planning quality by unrolling short (4-second) simulations on real-world driving data. "Non-reactive" means other agents follow their recorded trajectories -- they do not react to the ego vehicle's plan.

**PDM Score (PDMS) -- NAVSIM v1:**

PDMS is a composite metric combining multiple sub-scores:

| Sub-metric | Abbreviation | What It Measures |
|------------|-------------|------------------|
| No Collision | NC | Whether ego trajectory avoids all objects |
| Drivable Area Compliance | DAC | Whether ego stays on drivable surface |
| Ego Progress | EP | How much forward progress ego makes along route |
| Time-to-Collision | TTC | Minimum time before collision at any point |
| Comfort | C | Smoothness of trajectory (jerk, lateral acceleration) |

PDMS combines these as a weighted product:
```
PDMS = NC * DAC * EP * (w_TTC * TTC + w_C * C)
```

Note: NC and DAC are multiplicative gates -- a collision or drivable area violation zeros out the entire score.

**Extended PDM Score (EPDMS) -- NAVSIM v2:**

NAVSIM v2 adds four additional metrics:

| Sub-metric | Abbreviation | What It Measures |
|------------|-------------|------------------|
| Driving Direction Compliance | DDC | Whether ego follows correct driving direction |
| Traffic Light Compliance | TL | Whether ego respects traffic signals |
| Lane Keeping | LK | How well ego stays centered in lane |
| Extended Comfort | EC | Additional comfort criteria beyond basic smoothness |

### 7.2 Current SOTA on NAVSIM (as of early 2026)

| Method | PDMS | Approach | Key Innovation |
|--------|------|----------|---------------|
| TransDiffuser | 94.85 | Anchor-free diffusion | Diffusion model for trajectory generation |
| TrajHF | 93.95 | RL fine-tuning | Human feedback RL on NAVSIM metrics |
| DiffE2E | 92.7 | Hybrid diffusion | Combines diffusion with end-to-end |
| HiPro-AD | 92.6 | Camera-only | Hierarchical progressive planning |
| SparseDriveV2 | 92.0 | Sparse scoring | Scoring-based trajectory selection |
| DriveDPO | 90.0 | Direct preference optimization | RL fine-tuning against preferences |
| ReCogDrive | 89.6 | Cognitive reasoning | Reasoning-enhanced planning |
| DriveDreamer-Policy | 89.2 | World model policy | Policy learned in dreamer world model |
| ResWorld | 88.3 | Residual world model | World model for planning |

**Trends in Top Methods:**
1. **RL fine-tuning against NAVSIM metrics** (TrajHF, DriveDPO) provides large gains over pure IL
2. **Diffusion-based methods** (TransDiffuser, DiffE2E) dominate the top of the leaderboard
3. **Scoring/selection approaches** (SparseDriveV2) outperform methods that directly regress a single trajectory
4. **World model-based policies** (DriveDreamer-Policy, ResWorld) are competitive but not yet leading

### 7.3 How NAVSIM Differs from nuScenes Planning Metrics

| Aspect | nuScenes Planning | NAVSIM |
|--------|-------------------|--------|
| **Evaluation type** | Open-loop (compare to GT trajectory) | Pseudo-closed-loop (short rollout simulation) |
| **Primary metrics** | L2 displacement error, collision rate | PDMS (composite safety + progress + comfort) |
| **Agent reactivity** | N/A (single-frame comparison) | Non-reactive (agents follow recorded paths) |
| **Planning horizon** | 3 seconds (6 waypoints at 2 Hz) | 4 seconds (LQR-controlled rollout) |
| **Scale** | ~34K samples (nuScenes val) | Millions of scenarios from OpenScene |
| **Failure sensitivity** | L2 error averages over failures | NC/DAC gates zero out score on failure |
| **Multi-modality** | Penalizes any trajectory far from GT | Rewards progress, doesn't require GT match |

**Why NAVSIM is More Meaningful:**
- nuScenes L2 error penalizes a planner for taking a different (but valid) route than the human driver
- NAVSIM rewards safety and progress regardless of exact path match
- NAVSIM's multiplicative NC/DAC gates mean a single collision has catastrophic impact on score -- correctly reflecting real-world priorities
- nuScenes collision rate is calculated on a single frame, not over a rollout

**Limitations of NAVSIM:**
- Non-reactive: doesn't test how well the planner handles agents that respond to its actions
- Short horizon: 4 seconds doesn't test strategic planning
- Metric gaming: methods can optimize specifically for PDMS sub-metrics without genuine driving quality

**nuPlan** addresses the reactivity limitation with full closed-loop simulation, but at much higher computational cost. **interPlan** further augments nuPlan with adversarial edge-case scenarios.

---

## 8. Practical Deployment

### 8.1 Which Neural Planners Run on NVIDIA Orin?

NVIDIA Orin provides 275 TOPS (INT8) at 60W. The practical compute budget for planning is a fraction of total SoC capacity (perception uses the majority).

**Realistic Planning Compute Budget on Orin:** ~20-40 TOPS allocated to planning, which must include prediction and planning modules.

| Method | Native FPS (A100) | Estimated Orin Feasibility | Model Size | Notes |
|--------|-------------------|---------------------------|------------|-------|
| PlanTF | High (lightweight) | **Yes** | Small (~50M params) | Minimal architecture, designed for efficiency |
| SparseDrive-S | 9.0 FPS | **Likely** (with TensorRT) | Medium | Sparse operations map well to Orin |
| VAD | ~7 FPS | **Likely** (with TensorRT) | Medium | Vectorized representation is efficient |
| DiffusionDrive | ~45 FPS (after truncation) | **Yes** | Small-Medium | Truncated diffusion specifically designed for real-time |
| SparseDrive-B | 7.3 FPS | **Marginal** | Larger | May need INT8 quantization |
| UniAD | 1.8 FPS | **No** | Large (multi-module) | Far too slow, dense BEV computation |
| Diffusion-Planner | ~3-5 FPS | **Likely No** | Large | Full diffusion + joint prediction |
| GenAD | ~5 FPS | **Marginal** | Medium | VAE + temporal model overhead |
| Alpamayo | <1 FPS native | **No** (10B params) | Very Large | Designed as teacher, needs distillation |
| GameFormer | ~10 FPS | **Likely** (with TensorRT) | Medium | Level-k adds overhead per level |

**Path to Orin Deployment:**
1. **TensorRT optimization:** 2-5x speedup typical for transformer models
2. **INT8 quantization:** Additional 1.5-2x speedup with minimal accuracy loss
3. **DLA offloading:** Orin's Deep Learning Accelerator handles 38-74% of DL workload
4. **Model distillation:** Train a small student model from a large teacher (Alpamayo pattern)
5. **Sparse operations:** SparseDrive's sparse representation maps efficiently to GPU

**On NVIDIA Thor (~1,000+ TOPS, expected 2025-2026):**
All methods except Alpamayo at full 10B scale would be feasible. Thor enables full world model planning on-vehicle.

### 8.2 Latency Requirements

**Hard Constraint:** Planning must complete within one control cycle.

| Control Frequency | Max Planning Latency | Use Case |
|-------------------|---------------------|----------|
| 20 Hz | 50 ms | Highway driving (high speed) |
| 10 Hz | 100 ms | Urban driving (standard) |
| 5 Hz | 200 ms | Low-speed operations (parking, airside) |
| 2 Hz | 500 ms | Strategic decisions only (VLM reasoning) |

**For airside operations at 5-30 km/h:** A 5-10 Hz planning rate (100-200 ms latency budget) is appropriate. This is more relaxed than highway driving, providing more room for neural planner computation.

**Latency Breakdown for a Typical Neural Planning Pipeline:**
```
Perception:     30-50 ms (BEV feature extraction, object detection)
Prediction:     10-20 ms (agent trajectory prediction)
Planning:       20-50 ms (trajectory generation + selection)
Safety check:    5-10 ms (CBF/RSS constraint verification)
Control:         5-10 ms (trajectory tracking, low-level control)
-----------------------------------------------------
Total:          70-140 ms (fits within 10 Hz cycle)
```

### 8.3 Fallback to Classical Planner

The Simplex architecture (Section 6.4) is the standard pattern. Here is the concrete implementation for integration with an existing Frenet/lattice planner:

**Runtime Architecture:**
```
                              +-- Neural Planner Thread (10 Hz)
                              |   - Runs SparseDrive-lite or PlanTF
Perception Pipeline --------> |   - Outputs: trajectory + confidence
                              |
                              +-- Classical Planner Thread (10 Hz, always running)
                              |   - Runs Frenet planner (420 candidates/cycle)
                              |   - Outputs: trajectory + cost breakdown
                              |
                              +-- Trajectory Arbiter (10 Hz)
                                  - Receives both trajectories
                                  - Runs safety checks on neural trajectory
                                  - Selects best safe trajectory
                                  - Falls back to classical if neural fails checks
```

**Safety Checks on Neural Planner Output:**
1. **Kinematic feasibility:** Is the trajectory physically realizable? (curvature, acceleration within vehicle limits)
2. **Collision check:** Does the trajectory maintain minimum clearance from all detected objects?
3. **Drivable area:** Does the trajectory stay within the geofenced operational area?
4. **Consistency:** Is the trajectory smooth and consistent with the previous plan? (large jumps indicate neural planner instability)
5. **Timeout:** Did the neural planner complete within its time budget?

**Switching Conditions:**
```python
def select_trajectory(neural_traj, classical_traj, safety_monitor):
    # Check if neural planner produced output within deadline
    if neural_traj is None or neural_traj.timed_out:
        return classical_traj, "TIMEOUT"

    # Check kinematic feasibility
    if not check_kinematics(neural_traj, vehicle_params):
        return classical_traj, "KINEMATICS_VIOLATION"

    # Check collision safety
    if min_clearance(neural_traj, detected_objects) < SAFETY_MARGIN:
        return classical_traj, "COLLISION_RISK"

    # Check geofence
    if not within_geofence(neural_traj, operational_area):
        return classical_traj, "GEOFENCE_VIOLATION"

    # Check trajectory consistency
    if trajectory_jump(neural_traj, previous_traj) > MAX_JUMP:
        return classical_traj, "INCONSISTENCY"

    # Neural trajectory passes all checks
    return neural_traj, "NEURAL_ACTIVE"
```

### 8.4 Integration with Existing Frenet/Lattice Baseline

For the reference airside AV stack specifically (ROS Noetic, Frenet planner with 420 candidates/cycle, Stanley lateral control):

**Integration Pattern 1: Neural Cost Terms (Lowest Risk)**
```
Existing Frenet Planner:
  - Generate 420 candidate trajectories (unchanged)
  - Evaluate classical cost: safety + comfort + efficiency (unchanged)
  - ADD: Neural cost term from learned occupancy prediction
  - ADD: Neural cost term from predicted agent trajectories
  - Select best candidate (unchanged selection logic)
```
This requires only adding new cost evaluation to the existing pipeline. The Frenet planner's sampling and selection logic is unchanged.

**Integration Pattern 2: Neural Trajectory Proposals (Medium Risk)**
```
Neural Planner:
  - Generate 6-12 multi-modal trajectory proposals
  - Each proposal is a coarse trajectory (2-4 Hz waypoints)

Frenet Refinement:
  - For each neural proposal, find the closest Frenet trajectory
  - OR: Use neural proposal as reference path, generate Frenet candidates around it
  - Evaluate with full classical cost function + neural cost terms
  - Select best feasible trajectory
```
This uses the neural planner for diversity (exploring maneuvers the Frenet sampler might miss) while relying on Frenet refinement for smoothness and feasibility.

**Integration Pattern 3: Simplex with Neural Primary (Higher Risk, Higher Reward)**
```
Neural Planner (primary):
  - Full SparseDrive-lite or PlanTF
  - Outputs: trajectory at 10 Hz

Frenet Planner (safety backup):
  - Always runs in parallel
  - Conservative parameters (larger safety margins)
  - Ready to take over instantly

Safety Monitor:
  - Validates neural trajectory every cycle
  - Switches to Frenet if any check fails
```

---

## 9. Summary Comparison Table

| Method | Year | Venue | Type | Open Source | L2 (m) | Coll (%) | PDMS | Real-Time Orin? | Key Innovation |
|--------|------|-------|------|-------------|--------|----------|------|-----------------|----------------|
| **UniAD** | 2023 | CVPR | E2E IL | Yes | 0.73 | 0.61 | -- | No | Joint perception-prediction-planning |
| **VAD** | 2023 | ICCV | E2E IL | Yes | 0.72 | 0.21 | -- | Likely | Vectorized constraints |
| **VADv2** | 2024/2026 | ICLR | E2E IL | Yes | -- | -- | -- | Likely | Probabilistic action space |
| **SparseDrive-B** | 2024 | ECCV | E2E IL | Yes | 0.58 | 0.06 | -- | Marginal | Parallel prediction-planning, sparse |
| **PlanTF** | 2024 | ICRA | IL | Yes | -- | -- | -- | Yes | Simple baseline, augmentation study |
| **GenAD** | 2024 | ECCV | Generative IL | Yes | -- | -- | -- | Marginal | VAE latent space planning |
| **Diffusion-Planner** | 2025 | ICLR Oral | Diffusion IL | Yes | -- | -- | SOTA | Likely No | Flexible classifier guidance |
| **GameFormer** | 2023 | ICCV Oral | Game-theoretic | Yes | -- | -- | -- | Likely | Level-k hierarchical reasoning |
| **MARC** | 2023 | arXiv | Contingency | C++ | -- | -- | -- | Yes (CPU) | Tree-structured contingency plans |
| **DIPP** | 2023 | T-NNLS | Optimization | Yes | -- | -- | -- | Likely | Differentiable cost learning |
| **DTPP** | 2024 | ICRA | Optimization | Yes | -- | -- | -- | Likely | Tree policy + conditional prediction |
| **DriveVLM** | 2024 | arXiv | VLM dual-system | No | -- | -- | -- | Partial | Slow VLM + fast classical |
| **Alpamayo** | 2026 | NeurIPS/arXiv | VLA | Weights only | -- | -- | -- | No (teacher) | Flow matching action expert, 10B |
| **PlanAgent** | 2024 | arXiv | LLM agent | No | -- | -- | -- | No (API) | LLM generates planner code |
| **SafeDreamer** | 2024 | ICLR | Safe RL | Yes | -- | -- | -- | No | Lagrangian world model planning |
| **TransDiffuser** | 2025 | arXiv | Diffusion | -- | -- | -- | 94.85 | -- | NAVSIM SOTA (anchor-free diffusion) |
| **TrajHF** | 2025 | arXiv | RL fine-tuning | -- | -- | -- | 93.95 | -- | Human feedback RL on planning |

---

## 10. Airside Applicability

### 10.1 Why Neural Planning Matters for Airside

Airport airside operations present a unique planning challenge:
- **Low speed** (5-30 km/h) relaxes latency requirements
- **High precision** required (tight clearances around aircraft, GSE, personnel)
- **Multi-agent density** during turnaround (10+ vehicles, 20+ personnel around one aircraft)
- **Non-standard agents** (aircraft, belt loaders, catering trucks) not in any driving dataset
- **Mixed traffic rules** (aircraft always have priority, no standard "rules of the road")

Classical Frenet planning works well for the basic corridor following but struggles with:
- Dense multi-agent scenarios (turnaround congestion)
- Novel agent types (no hand-tuned cost for "catering truck backing toward aircraft")
- Non-standard right-of-way negotiation (who yields to whom in an unstructured apron)

### 10.2 Recommended Neural Planning Stack for Airside

**Phase 1 (Near-term, 6-12 months): Neural Cost Augmentation**
- Keep Frenet planner as primary
- Add learned occupancy prediction as a cost term (FlashOcc or similar, runs on Orin)
- Add predicted agent trajectories from a lightweight predictor (HiVT or PointPillars + simple prediction head)
- Integrate RSS-like safety constraints for aircraft-specific clearance zones

**Phase 2 (Medium-term, 12-24 months): Neural Proposal Generation**
- Train a SparseDrive-lite or PlanTF model on collected airside data
- Use neural model for trajectory proposals
- Refine with Frenet planner for feasibility and smoothness
- Simplex architecture with Frenet as safety backup

**Phase 3 (Longer-term, 24+ months): Full Neural Planning**
- Deploy distilled VLA model (from Alpamayo or successor, fine-tuned on airside)
- Game-theoretic interaction modeling for turnaround scenarios
- World model-based planning for anticipating turnaround sequences
- Classical planner retained as emergency fallback only

### 10.3 Key Research Gaps for Airside Neural Planning

1. **No airside planning datasets exist.** Every method above was trained/evaluated on road driving data. Creating an airside planning benchmark is a prerequisite for meaningful neural planner development.

2. **Aircraft as dynamic obstacles.** No existing planner handles agents with 30-60 meter wingspans. The collision checking and clearance computation for aircraft requires specialized geometry.

3. **Schedule-conditioned planning.** Airside planning can leverage flight schedule information (what vehicles will arrive when), but no existing neural planner ingests schedule data. This is an untapped advantage.

4. **Multi-modal right-of-way.** Airport right-of-way rules are complex and airport-specific. Game-theoretic approaches (GameFormer) could model this, but need airside-specific training data.

5. **Regulatory acceptance.** Neural planners face certification challenges. The Simplex architecture provides a path: certify the classical fallback and the safety monitor, then the neural planner is a performance enhancement that cannot compromise safety.

---

*Document compiled April 2026. Based on published research through early 2026.*
*Related documents: diffusion-trajectory-planning.md, frenet-planner-augmentation.md, motion-prediction.md, llm-reasoning-planning.md*
