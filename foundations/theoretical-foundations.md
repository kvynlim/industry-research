# Theoretical Foundations of World Models for Autonomous Driving

## Mathematical Frameworks, Formal Results, and Theoretical Analysis

---

## 1. World Model Formal Definition

### 1.1 The World Model as a Learned Dynamics Function

A world model is a learned approximation of environment dynamics:

```
s_{t+1} = f_θ(s_t, a_t) + ε_t

where:
  s_t ∈ S     — state at time t (latent representation of the world)
  a_t ∈ A     — action taken by the agent
  f_θ         — learned dynamics function parameterized by θ
  ε_t         — stochastic noise (aleatoric uncertainty)
```

**In the driving context:**
- **State s_t**: BEV occupancy grid, semantic features, ego pose — a compressed representation of the driving scene
- **Action a_t**: steering angle δ, velocity v, acceleration a — the ego vehicle's control
- **Dynamics f_θ**: a neural network (transformer, SSM, diffusion model) that predicts how the scene evolves

### 1.2 POMDP Formulation for Driving

Driving is a Partially Observable Markov Decision Process (POMDP):

```
POMDP = (S, A, T, R, Ω, O, γ)

S: State space (true world state — positions, velocities, intentions of ALL agents)
A: Action space (ego vehicle controls: steering, throttle, brake)
T: Transition function T(s'|s,a) — true world dynamics
R: Reward function R(s,a) — driving quality (progress, safety, comfort)
Ω: Observation space (LiDAR point clouds, camera images, GPS)
O: Observation function O(o|s) — sensor model (partial, noisy view of state)
γ: Discount factor (0.99 for driving — long-horizon task)
```

**Why POMDP matters for world models:** The agent never observes the true state s — only observations o. The world model must maintain a *belief state* b(s) = P(s|o_{1:t}, a_{1:t-1}), a probability distribution over possible true states given observation history.

**The BEV representation is an approximate belief state:** When you encode LiDAR/camera into BEV features, you're computing an approximate sufficient statistic for the belief state — compressing observation history into a fixed-size representation that (hopefully) captures everything needed for decision-making.

### 1.3 Information-Theoretic View

A world model should maximize the mutual information between its predictions and the true future state, while being compressible:

```
max_θ I(ŝ_{t+1}; s_{t+1} | s_{1:t}, a_{1:t})    — predictive information
s.t.  I(ŝ_{t+1}; s_{1:t}) ≤ C                      — information bottleneck capacity
```

This is the **Information Bottleneck** principle applied to world models:
- **Maximize:** how much the prediction tells you about the true future
- **Minimize:** how much information from the past is retained (compression)

**JEPA vs. generative world models through this lens:**
- **Generative (GAIA, Cosmos):** Maximize I by predicting every pixel → high information, high capacity needed
- **JEPA (V-JEPA 2):** Predict only in embedding space → retains predictive information, discards unpredictable noise → more efficient information bottleneck

---

## 2. Predictive Coding and Active Inference

### 2.1 Karl Friston's Free Energy Principle

The Free Energy Principle (FEP) proposes that intelligent systems minimize *variational free energy* — a bound on surprise:

```
F = E_q[log q(s) - log p(o,s)]
  = KL[q(s) || p(s|o)] + const
  ≥ -log p(o)  (= surprise)

where:
  q(s)    — agent's belief about world state (the world model)
  p(o,s)  — generative model of observations and states
  p(s|o)  — true posterior
```

**Minimizing free energy means:**
1. **Perception:** Update beliefs q(s) to match observations → update world model
2. **Action:** Act to make observations match predictions → active inference

### 2.2 Active Inference for Driving

In active inference, the agent doesn't maximize reward — it minimizes *expected free energy* (EFE):

```
G(π) = E_π[F_t] = E_π[-log p(o_t | s_t)] + E_π[H[p(s_t | o_t)]]
      = pragmatic value (achieve goals) + epistemic value (reduce uncertainty)
```

**For airside AV:**
- **Pragmatic:** "Drive to stand B12" → minimize distance to goal
- **Epistemic:** "I'm uncertain about what's behind that aircraft" → slow down, gather more information

**Implementation:** Active inference naturally balances exploitation (go to goal) and exploration (reduce uncertainty). This is exactly what a world-model-based planner should do — and it falls out of the math without hand-tuning exploration bonuses.

### 2.3 Predictive Coding Networks

Predictive coding is a neural implementation of free energy minimization:

```
Each layer l predicts the activity of the layer below:
  ε_l = x_l - f_l(x_{l+1})    — prediction error
  x_l ← x_l + α(ε_{l-1} - ε_l)  — update to minimize error
```

**Connection to world models:** The RSSM in DreamerV1-V3 IS a predictive coding architecture:
- Prior (prediction): p_θ(s_t | s_{t-1}, a_{t-1})
- Posterior (correction): q_θ(s_t | s_{t-1}, a_{t-1}, o_t)
- Training minimizes: KL[posterior || prior] — the prediction error

---

## 3. Representation Learning Theory

### 3.1 Why BEV is a Good Representation

**Theorem (Informal):** BEV is a sufficient statistic for driving decisions.

**Argument:** For a ground vehicle, the relevant aspects of the world are:
1. Where obstacles are (x, y, and approximate height)
2. Where drivable space is (x, y)
3. How fast things are moving (vx, vy)
4. Semantic identity (for behavior prediction)

All of these can be represented in a 2D grid with feature channels. The height dimension is compressed to a finite set of bins. This is BEV.

**Why BEV and not raw sensor data:**
- **Composability:** Multiple sensors map to the same BEV space
- **Translation equivariance:** A shifted scene → shifted BEV features (spatial convolutions exploit this)
- **Action-relevance:** Vehicle actions are 2D (x, y, yaw) — BEV aligns with the action space
- **Compactness:** BEV at 0.2m resolution, 100m range = 500×500 = 250K cells vs. millions of LiDAR points

### 3.2 Information Bottleneck for Driving Representations

The optimal driving representation Z should satisfy:

```
min_Z  I(X; Z) - β · I(Z; Y)

where:
  X = raw sensor input (point clouds, images)
  Z = learned representation (BEV features)
  Y = task-relevant output (future occupancy, trajectory)
  β = Lagrange multiplier controlling compression
```

**β → ∞:** Z retains maximum information about Y → good prediction but large representation
**β → 0:** Z is maximally compressed → fast inference but poor prediction
**Optimal β:** Depends on model capacity and compute budget

**For airside:** Low speeds mean you can afford a richer representation (more channels, finer resolution) than highway driving. β can be larger.

### 3.3 Disentangled Representations

The ideal world model representation separates:
- **Static scene** (map, buildings, markings) — changes slowly
- **Dynamic objects** (vehicles, personnel) — changes every frame
- **Ego state** (pose, velocity) — known from odometry
- **Lighting/weather** — changes slowly but affects sensors

**DreamerV3's categorical latent space** achieves partial disentanglement through discrete bottlenecks. OccWorld separates static occupancy from dynamic occupancy. EmerNeRF explicitly decomposes into static/dynamic NeRF fields.

---

## 4. Scaling Laws for World Models

### 4.1 Chinchilla-Style Analysis for Driving

For LLMs, the Chinchilla scaling law states:
```
L(N, D) = A/N^α + B/D^β + E

where N = parameters, D = data (tokens), L = loss
α ≈ 0.34, β ≈ 0.28
```

**For driving world models (GAIA-1 results):**
- Power-law curves on validation cross-entropy vs. model size
- "Significant room for improvement that can be obtained by scaling data and compute"
- Consistent with LLM scaling, though exact exponents not published

**Waymo scaling laws (June 2025):**
- Log-linear gains in motion planning and forecasting metrics
- Data scaling: 16 → 8,192 hours shows continuous improvement
- Model scaling: larger models consistently outperform smaller ones

**DriveVLA-W0 finding:** World modeling amplifies data scaling laws:
- Action-only training: performance saturates at ~20M frames
- Action + world model objective: sustained improvement to 70M+ frames
- **Implication:** World model pre-training is compute-optimal for driving

### 4.2 Compute-Optimal Training for Airside

Given limited airside data, the optimal strategy is:

```
1. Pre-train large model on abundant road data (nuScenes + Waymo = 300K+ frames)
2. Fine-tune smaller model on limited airside data
3. Use world model self-supervised objective to maximize value from airside data

Expected schedule:
  - BEV encoder: Pre-train on nuScenes (28K frames), fine-tune on airside (5K frames)
  - World model: Pre-train on nuScenes occupancy, self-supervised fine-tune on airside (50K frames)
  - Planning: Train in world model imagination (infinite simulated frames)
```

---

## 5. Generalization Theory

### 5.1 PAC-Bayes Bounds for Sim-to-Real

PAC-Bayesian theory provides bounds on generalization error:

```
E_real[L(h)] ≤ E_sim[L(h)] + √(KL[Q||P] + ln(2n/δ)) / (2n))

where:
  E_real[L(h)] — expected loss on real driving data
  E_sim[L(h)]  — expected loss on simulated/training data
  KL[Q||P]     — KL divergence between posterior Q and prior P
  n            — number of training samples
  δ            — failure probability
```

**Practical interpretation:**
- **Small KL[Q||P]:** Model parameters don't deviate far from prior → better generalization
- **Large n:** More training data → tighter bound
- **For sim-to-real:** If the simulated distribution is close to real, E_sim ≈ E_real and the bound is tight

**SafeDrive Dreamer** uses PAC-Bayesian bounds explicitly to provide safety guarantees for sim-to-real transfer.

### 5.2 Domain Adaptation Theory

**Ben-David et al. (2010)** bound for domain adaptation:

```
ε_T(h) ≤ ε_S(h) + d_H(S, T) + λ*

where:
  ε_T(h) — target domain error (airside)
  ε_S(h) — source domain error (road driving)
  d_H(S, T) — H-divergence between source and target distributions
  λ* — optimal joint error (irreducible)
```

**For road → airside transfer:**
- **ε_S(h):** Low — models are well-trained on road data
- **d_H(S, T):** High — airside looks very different from roads
- **λ*:** Unknown — are the tasks even compatible?

**Reducing d_H:** Domain adaptation techniques (DANN, MMD) minimize the H-divergence by learning domain-invariant features. For airside, the transferable features are physics (rigid body dynamics, motion patterns) rather than appearance (object types, scene layout).

---

## 6. Safety-Critical ML Theory

### 6.1 Conformal Prediction for Coverage Guarantees

Conformal prediction provides **distribution-free** prediction intervals:

```
Given calibration data {(x_i, y_i)}_{i=1}^n and new input x_{n+1}:

1. Compute nonconformity scores: α_i = |y_i - f(x_i)|
2. Find quantile: q̂ = (1-ε)(1 + 1/n)-th quantile of {α_i}
3. Prediction set: C(x_{n+1}) = {y : |y - f(x_{n+1})| ≤ q̂}

Guarantee: P(y_{n+1} ∈ C(x_{n+1})) ≥ 1 - ε
```

**For world model occupancy prediction:**
- Predict occupancy probability per voxel
- Conformal calibration ensures that the 95% prediction set covers the true occupied voxels at least 95% of the time
- This provides a **formal safety guarantee** on prediction coverage

### 6.2 Distributionally Robust Optimization

Instead of minimizing expected loss, minimize worst-case loss over an uncertainty set:

```
min_θ max_{P ∈ U} E_P[L(f_θ, x, y)]

where U is an uncertainty set around the training distribution
```

**For airside world model:** The uncertainty set U captures distribution shift between airports, weather conditions, and rare scenarios. Training with DRO ensures the world model performs well even in worst-case conditions.

### 6.3 Probably Approximately Correct (PAC) Learning for Safety

A world model is (ε, δ)-PAC safe if:

```
P(collision rate ≤ ε) ≥ 1 - δ

with sample complexity: n ≥ (1/ε)(ln(|H|/δ))
```

**For airside (ε = 10^{-4} collision rate, δ = 10^{-2}):**
- Need O(10^6) test scenarios for statistical significance
- This is why simulation (world model as sim) is essential — you can't drive 10^6 scenarios in reality
- SafeDreamer + conformal prediction + formal verification provides a path to PAC safety

---

## 7. Causal Reasoning in World Models

### 7.1 Structural Causal Models for Driving

A driving scenario can be modeled as a Structural Causal Model (SCM):

```
U = {U_ego, U_traffic, U_weather, U_infrastructure}  — exogenous noise
V = {Ego, Vehicle_1, ..., Vehicle_n, Pedestrian_1, ..., Lane, Signal}  — endogenous variables
F = {f_ego, f_vehicle, f_pedestrian, f_signal}  — structural equations

f_vehicle_i: position_{t+1} = f(position_t, velocity_t, intention_t, U_traffic)
f_ego: action_t = π(observation_t)
```

### 7.2 Interventional vs. Observational Prediction

**Observational prediction** (standard world model): P(future | past)
- "What will happen next?" — based on patterns in training data

**Interventional prediction** (causal world model): P(future | do(action))
- "What will happen if I take this action?" — requires causal understanding

**The do-calculus distinction:**
```
P(Y | X = x) ≠ P(Y | do(X = x))

Observational: "When the ego vehicle brakes, other vehicles often brake too"
  (because both brake at red lights — confounded)

Interventional: "If I brake, will the other vehicle brake?"
  (requires understanding that my braking doesn't cause their braking in most cases)
```

**Drive-OccWorld is an interventional world model:** It predicts P(future_occupancy | do(ego_action)), not just P(future_occupancy | past). This is why action conditioning is critical for planning.

### 7.3 Counterfactual Reasoning

Counterfactuals enable: "What would have happened if I had taken a different action?"

```
Given: I followed trajectory τ_actual and nothing bad happened
Counterfactual: If I had followed τ_alternative, would there have been a collision?

World model enables this: Replay past observation, feed τ_alternative → predicted outcome
```

**Applications for airside:**
- Safety validation: "Would alternative trajectory have been safer?"
- Root cause analysis: "If the vehicle had braked 0.5s earlier, would the near-miss have been avoided?"
- Training data augmentation: Generate counterfactual trajectories with labels

---

## 8. Multi-Agent Game Theory

### 8.1 Nash Equilibria in Airside Traffic

Multi-agent airside interaction can be modeled as a game:

```
Players: {ego_GSE, other_GSE_1, ..., aircraft_1, ..., pedestrian_1, ...}
Strategies: {trajectories}
Payoffs: {-collision_cost + progress_reward + comfort}
```

**Nash equilibrium:** A set of trajectories where no player can improve their payoff by unilaterally changing their trajectory.

**For airside, the game is asymmetric:**
- Aircraft always have priority (infinite cost for aircraft collision)
- Emergency vehicles have priority
- GSE must yield to personnel
- This simplifies the game — it's more like Stackelberg (leader-follower) than Nash

### 8.2 Level-k Reasoning

Level-k game theory models bounded rationality:

```
Level-0: Random or default behavior (drive straight)
Level-1: Best response to Level-0 agents
Level-2: Best response to Level-1 agents
...
```

**GameFormer (ICCV 2023)** implements level-k reasoning for driving. For airside:
- **Level-0:** GSE follows waypoints, aircraft follows taxi instructions
- **Level-1:** Ego anticipates Level-0 agents → yield when they have priority
- **Level-2:** Ego anticipates that other GSE will yield to aircraft → plan accordingly

---

## 9. Optimal Control + Learning

### 9.1 MPC in Latent Space

Model Predictive Control in the world model's latent space connects classical control with learned dynamics:

```
Classical MPC:
  min_{a_{t:t+H}} Σ c(s_k, a_k)   s.t. s_{k+1} = f(s_k, a_k)

Latent MPC (TD-MPC2):
  min_{a_{t:t+H}} Σ -V_θ(z_k)     s.t. z_{k+1} = h_θ(z_k, a_k)

where:
  z_k — latent state (no decoder needed)
  h_θ — learned latent dynamics
  V_θ — learned value function (replaces explicit cost)
```

**TD-MPC2 optimizes via CEM (Cross-Entropy Method):**
1. Sample N action sequences from a distribution
2. Evaluate each by rolling out latent dynamics + value function
3. Refit distribution to top-K performers
4. Repeat for M iterations
5. Execute first action of best sequence

### 9.2 Hamilton-Jacobi Reachability

For safety-critical driving, HJ reachability analysis provides formal guarantees:

```
V(x, t) = min_{a ∈ A} max_{d ∈ D} V(x + f(x,a,d)dt, t+dt)

where:
  V(x, t) < 0 → state x is unsafe (reachable from danger set)
  V(x, t) ≥ 0 → state x is safe
  a — ego control
  d — disturbance (other agents' worst-case behavior)
```

**For airside:** The danger set is collision with any object. HJ reachability computes the set of states from which collision is unavoidable, regardless of ego's actions. The safety monitor should prevent the vehicle from entering this set.

**Limitation:** Classical HJ scales exponentially with state dimension. Neural approximations (DeepReach) handle higher dimensions but lose formal guarantees.

---

## 10. Key Theorems and Results

| Theorem / Result | Statement | Relevance |
|-----------------|-----------|-----------|
| **Universal Approximation** | Neural networks can approximate any continuous function | World models can theoretically represent any dynamics |
| **No Free Lunch** | No learning algorithm is universally best | Pre-training on driving data gives a strong inductive bias |
| **PAC-Bayes bound** | Generalization bounded by KL + sample size | Constrains how much fine-tuning data you need for airside |
| **Ben-David domain adaptation** | Target error ≤ source error + domain divergence | Quantifies the road→airside transfer gap |
| **Conformal prediction** | Distribution-free coverage guarantee | Formally calibrated occupancy predictions |
| **Bellman optimality** | Optimal policy satisfies V*(s) = max_a [R + γV*(s')] | Foundation for world model planning (Dreamer, TD-MPC2) |
| **RSS safety** | 5 formally verifiable rules guarantee blame-free driving | Airside adaptation provides baseline safety |
| **GAIA-1 scaling** | Power-law improvement with model/data scale | More data + compute = better world model |

---

## Sources

- Friston, K. "The free-energy principle: a unified brain theory?" Nature Reviews Neuroscience, 2010
- Ben-David et al. "A theory of learning from different domains." Machine Learning, 2010
- Tishby & Zaslavsky. "Deep learning and the information bottleneck principle." ITW, 2015
- Hafner et al. "Dream to Control: Learning Behaviors by Latent Imagination." ICLR, 2020
- Shalev-Shwartz et al. "On a Formal Model of Safe and Scalable Self-driving Cars." arXiv, 2017 (RSS)
- Pearl, J. "Causality: Models, Reasoning, and Inference." Cambridge, 2009
- Hansen et al. "TD-MPC2: Scalable, Robust World Models for Continuous Control." ICLR, 2024
- Vovk et al. "Algorithmic Learning in a Random World." Springer, 2005 (Conformal Prediction)
- Bansal et al. "DeepReach: A Deep Learning Approach to High-Dimensional Reachability." ICRA, 2021
