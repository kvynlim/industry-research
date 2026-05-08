# Reinforcement Learning for Autonomous Driving Policy Learning

> Comprehensive guide to model-free and offline reinforcement learning for learning driving policies — covering on-policy (PPO, IMPALA), off-policy (SAC, TD3, TQC, CrossQ), offline RL (CQL, IQL, EDAC, Decision Transformer), behavior cloning bootstrapping, constrained/safe RL (CPO, CMDP, Lagrangian), policy distillation for edge deployment, and offline-to-online fine-tuning. Focused on practical applicability to airport airside GSE operations with Aurrigo's ROS Noetic stack.
>
> **Relation to existing docs**: Complements `rl-with-world-models.md` (model-based RL with Dreamer/TD-MPC), `neural-motion-planning.md` (IL-based planning), `diffusion-trajectory-planning.md` (diffusion-based generation), `safety-critical-planning-cbf.md` (CBF safety filters), `causal-reasoning-counterfactual.md` (causal policy evaluation). This document focuses on *model-free and offline* RL policy learning — the algorithms that directly optimize a policy from environment interaction or fixed datasets, without requiring a learned dynamics model.

**Key Takeaway**: For airside autonomous GSE, offline RL from recorded fleet data is the most realistic path to safe policy learning — online exploration on an active apron is unacceptable. CaRL (CoRL 2025) demonstrates that PPO with simple route-completion rewards scales to complex driving and is the best open-source RL planner on both CARLA Leaderboard 2.0 and nuPlan. IQL emerges as the most practical offline RL algorithm for driving (consistent across traffic densities, no need for explicit behavior policy). The recommended approach is a **three-phase pipeline**: (1) behavior cloning from Frenet planner demonstrations as a warm start, (2) offline RL fine-tuning on fleet data with IQL/CQL, (3) online refinement in simulation (CARLA airport env) with PPO + CBF safety filter. Policy distillation compresses the learned policy to run within the 14.8ms multi-task perception budget on Orin.

---

## Table of Contents

1. [Why RL for Driving Policy Learning](#1-why-rl-for-driving-policy-learning)
2. [RL Fundamentals for Driving](#2-rl-fundamentals-for-driving)
3. [On-Policy Methods](#3-on-policy-methods)
4. [Off-Policy Methods](#4-off-policy-methods)
5. [Offline Reinforcement Learning](#5-offline-reinforcement-learning)
6. [Behavior Cloning and Bootstrapping](#6-behavior-cloning-and-bootstrapping)
7. [Safe and Constrained RL](#7-safe-and-constrained-rl)
8. [Offline-to-Online Fine-Tuning](#8-offline-to-online-fine-tuning)
9. [Policy Distillation for Edge Deployment](#9-policy-distillation-for-edge-deployment)
10. [RL Benchmarks and Evaluation](#10-rl-benchmarks-and-evaluation)
11. [Practical Implementation for Airside](#11-practical-implementation-for-airside)
12. [Key Takeaways](#12-key-takeaways)
13. [References](#13-references)

---

## 1. Why RL for Driving Policy Learning

### 1.1 The Limitations of Current Approaches

Aurrigo's current Frenet planner generates 420 trajectory candidates per cycle and selects the lowest-cost one via hand-crafted cost functions. This works well for structured, low-speed airside operations but has fundamental limitations:

| Limitation | Impact |
|---|---|
| **Hand-crafted cost functions** | Cannot capture all interaction nuances; adding new behaviors requires manual engineering |
| **Combinatorial explosion** | 420 candidates sample sparsely in high-dimensional trajectory space |
| **No learning from experience** | Same behavior whether first or thousandth time at a stand |
| **Poor multi-agent reasoning** | Cost functions don't model other agents' reactions to ego actions |
| **Conservative by default** | Rule-based safety margins are uniform; can't adapt to context |

### 1.2 What RL Offers

Reinforcement learning directly optimizes a policy π(a|s) to maximize cumulative reward through interaction with an environment (or dataset). For driving:

- **Learns from outcome, not demonstration**: Can discover behaviors better than the human/rule-based teacher
- **Handles sequential decisions**: Naturally reasons about long-horizon consequences
- **Adapts to distribution shift**: Online RL continuously improves from new data
- **Multimodal behavior**: Stochastic policies capture multiple valid driving strategies

### 1.3 Why Not Just Use IL?

Imitation learning (behavior cloning, DAgger) learns from expert demonstrations. It's simpler than RL but suffers from:

| Issue | RL Advantage |
|---|---|
| **Compounding error** | BC drifts from expert distribution; errors compound over trajectory. RL optimizes closed-loop performance directly |
| **Distribution mismatch** | IL only sees expert states; at test time, minor errors push to unseen states. RL explores and recovers |
| **Bounded by teacher** | IL policy is at best as good as the expert. RL can exceed the expert |
| **Reward hacking vs. copying** | IL copies behavior (including irrelevant correlations). RL optimizes the actual objective |

**CaRL (CoRL 2025)** demonstrated this concretely: RL with simple rewards outperforms all IL baselines on CARLA Leaderboard 2.0 longest6 v2 and achieves SOTA on nuPlan, while being more scalable with training compute.

### 1.4 Model-Free vs. Model-Based RL

This document focuses on **model-free** (and offline) RL. The distinction:

| Aspect | Model-Based (Dreamer, TD-MPC) | Model-Free (PPO, SAC, IQL) |
|---|---|---|
| **Learns dynamics** | Yes — explicit world model | No — learns policy/value directly |
| **Sample efficiency** | Higher (imagined rollouts) | Lower (needs more real/sim data) |
| **Compounding model error** | Yes — model errors accumulate | No — no model to be wrong |
| **Compute at inference** | Planning in model (higher) | Forward pass through policy (lower) |
| **Best for** | Complex dynamics, long horizon | Simple/well-understood dynamics, abundant data |

For airside at low speeds (5-25 km/h) with relatively simple dynamics, model-free RL is viable and avoids the complexity of learned dynamics models. Model-based RL (covered in `rl-with-world-models.md`) is better when dynamics are complex or data is scarce.

---

## 2. RL Fundamentals for Driving

### 2.1 MDP Formulation for Driving

Autonomous driving as a Markov Decision Process (MDP):

```
M = (S, A, T, R, γ)

S: State space — ego state (x, y, θ, v, κ) + perception output (detected objects, free space, map)
A: Action space — trajectory waypoints (x, y, θ, v) at future timesteps, or direct control (steering, throttle)
T: Transition dynamics — vehicle kinematics + environment evolution
R: Reward function — safety, progress, comfort, efficiency
γ: Discount factor — typically 0.99 for driving (long-horizon)
```

### 2.2 Action Space Design

The choice of action space profoundly affects learning:

| Action Space | Dimensionality | Pros | Cons |
|---|---|---|---|
| **Direct control** (δ, a) | 2D continuous | Simple, low-dim | Jerky, no trajectory coherence |
| **Waypoint sequence** (x_t, y_t)×H | 2H (e.g., 20D for H=10) | Smooth, interpretable | High-dimensional, harder to learn |
| **Lateral offset + speed** (d, v) | 2D continuous | Maps to Frenet frame | Limited expressivity |
| **Trajectory index** | Discrete (K=420) | Matches Frenet candidates | Fixed set, no interpolation |
| **Residual on planner** | Low-dim continuous | Refines existing planner | Coupled to planner quality |

**Recommendation for Aurrigo**: Start with **lateral offset + longitudinal speed** in Frenet frame. This maps directly to the existing Frenet planner's output space, enables incremental deployment (RL as a "selector" over Frenet candidates), and keeps the action space low-dimensional.

### 2.3 State Representation

What the RL agent observes:

```python
class DrivingState:
    """State representation for RL driving policy."""
    
    # Ego state (from GTSAM localization)
    ego_position: np.ndarray  # (x, y) in map frame
    ego_heading: float        # θ radians
    ego_speed: float          # m/s
    ego_curvature: float      # κ 1/m
    ego_acceleration: float   # m/s²
    
    # Route information (from mission planner)
    route_waypoints: np.ndarray  # (N, 2) upcoming waypoints
    distance_to_goal: float
    
    # Detected objects (from PointPillars/multi-task head)
    objects: List[DetectedObject]  # position, velocity, class, uncertainty
    
    # Occupancy/free space (from occupancy head)
    bev_occupancy: np.ndarray  # (H, W) binary/probabilistic
    
    # Map features (from Lanelet2 + semantic map)
    lane_boundaries: np.ndarray  # relative to ego
    speed_limits: np.ndarray
    right_of_way: int  # priority level (0-8 from neuro-symbolic doc)
    
    # Operational context
    weather_condition: int  # ODD state from runtime monitor
    time_of_day: int
    airport_zone: int  # apron, taxiway, service road, etc.
```

**Encoding for RL**: Flatten ego state + route into vector, encode objects via PointNet-style aggregation or attention, encode BEV as CNN features. Total state dimension: ~256-512D after encoding.

### 2.4 Reward Design

Reward design is the most critical and difficult aspect of RL for driving.

**CaRL's insight (CoRL 2025)**: Complex shaped rewards (summing 10+ terms) cause PPO to fail at scale because conflicting gradients from different reward terms become harder to reconcile with larger batch sizes. A **single primary reward** (route completion) with **multiplicative infraction penalties** and **episode termination** scales much better.

**Reward structure for airside GSE**:

```python
def airside_reward(state, action, next_state, info):
    """
    CaRL-inspired reward: route completion + infraction penalties.
    """
    # Primary reward: progress along route
    route_progress = info['route_completion_delta']  # fraction of route completed this step
    
    # Infraction penalties (multiplicative, not additive)
    infraction_multiplier = 1.0
    
    # Safety infractions — terminate episode
    if info['collision']:
        return -1.0  # terminal
    if info['runway_incursion']:
        return -1.0  # terminal
    if info['aircraft_proximity'] < AIRCRAFT_MIN_DISTANCE:
        return -1.0  # terminal
    if info['personnel_proximity'] < PERSONNEL_MIN_DISTANCE:
        return -1.0  # terminal
    
    # Soft infractions — reduce reward multiplicatively
    if info['speed_violation']:
        infraction_multiplier *= 0.5
    if info['wrong_zone']:
        infraction_multiplier *= 0.3
    if info['excessive_jerk']:
        infraction_multiplier *= 0.8
    if info['off_route'] > OFF_ROUTE_THRESHOLD:
        infraction_multiplier *= 0.5
    
    # Comfort bonus (small, doesn't dominate)
    comfort = -0.01 * abs(info['lateral_acceleration'])
    
    return route_progress * infraction_multiplier + comfort
```

### 2.5 Discount Factor and Horizon

| Parameter | Typical Road | Airside GSE | Rationale |
|---|---|---|---|
| **γ (discount)** | 0.99 | 0.995 | Longer missions (10-30 min), need long-horizon planning |
| **Episode length** | 20-60s | 120-600s | Full stand-to-stand mission |
| **Decision frequency** | 10 Hz | 10 Hz | Matches perception pipeline |
| **Effective horizon** | 1/(1-γ) = 100 steps | 200 steps | 20s lookahead at 10 Hz |

---

## 3. On-Policy Methods

On-policy methods update the policy using data collected by the current policy. They're sample-inefficient but stable.

### 3.1 PPO (Proximal Policy Optimization)

PPO (Schulman et al., 2017) is the most widely used RL algorithm for driving, and the backbone of CaRL.

**Why PPO dominates driving RL**:
- Clipped objective prevents destructive policy updates
- Works with both discrete and continuous actions
- Parallelizes well across many environments
- Simple to implement and tune

**PPO objective**:
```
L^CLIP(θ) = E_t [min(r_t(θ) Â_t, clip(r_t(θ), 1-ε, 1+ε) Â_t)]

where r_t(θ) = π_θ(a_t|s_t) / π_θ_old(a_t|s_t)  (probability ratio)
      Â_t = advantage estimate (GAE-λ)
      ε = clip range (typically 0.2)
```

**CaRL configuration (SOTA on CARLA + nuPlan)**:

| Hyperparameter | CaRL Value | Notes |
|---|---|---|
| Learning rate | 3e-4 | Adam with linear warmup |
| Clip range ε | 0.2 | Standard |
| GAE λ | 0.95 | High bias-variance tradeoff |
| Discount γ | 0.99 | |
| Mini-batch size | 2048+ | Key finding: scales with simple rewards |
| Entropy coefficient | 0.01 | Encourages exploration |
| Value function coeff | 0.5 | |
| Max gradient norm | 0.5 | Gradient clipping |
| Network | MLP (256, 256) | Privileged state input |
| Reward | Route completion | Single term + infraction penalties |

**CaRL's scaling insight**: With complex shaped rewards (10+ weighted terms), PPO's performance *degrades* when mini-batch size increases. With simple route-completion reward, performance *improves* with larger batches. This makes RL scalable with more compute — a fundamental requirement for production.

```python
class PPODrivingAgent:
    """PPO agent for airside driving."""
    
    def __init__(self, state_dim, action_dim, config):
        self.actor = nn.Sequential(
            nn.Linear(state_dim, 256),
            nn.ReLU(),
            nn.Linear(256, 256),
            nn.ReLU(),
            nn.Linear(256, action_dim * 2),  # mean + log_std
        )
        self.critic = nn.Sequential(
            nn.Linear(state_dim, 256),
            nn.ReLU(),
            nn.Linear(256, 256),
            nn.ReLU(),
            nn.Linear(256, 1),
        )
        self.optimizer = torch.optim.Adam(
            list(self.actor.parameters()) + list(self.critic.parameters()),
            lr=config.lr,
        )
        self.clip_range = config.clip_range
        self.gamma = config.gamma
        self.gae_lambda = config.gae_lambda
    
    def get_action(self, state):
        """Sample action from current policy."""
        output = self.actor(state)
        mean, log_std = output.chunk(2, dim=-1)
        std = log_std.clamp(-5, 2).exp()
        dist = torch.distributions.Normal(mean, std)
        action = dist.sample()
        log_prob = dist.log_prob(action).sum(-1)
        return action, log_prob
    
    def compute_gae(self, rewards, values, dones):
        """Generalized Advantage Estimation."""
        advantages = torch.zeros_like(rewards)
        last_gae = 0
        for t in reversed(range(len(rewards))):
            if t == len(rewards) - 1:
                next_value = 0
            else:
                next_value = values[t + 1]
            delta = rewards[t] + self.gamma * next_value * (1 - dones[t]) - values[t]
            advantages[t] = delta + self.gamma * self.gae_lambda * (1 - dones[t]) * last_gae
            last_gae = advantages[t]
        returns = advantages + values
        return advantages, returns
    
    def update(self, batch):
        """PPO clipped objective update."""
        states, actions, old_log_probs, advantages, returns = batch
        
        # Normalize advantages
        advantages = (advantages - advantages.mean()) / (advantages.std() + 1e-8)
        
        for _ in range(self.n_epochs):  # typically 10
            # Get current policy distribution
            output = self.actor(states)
            mean, log_std = output.chunk(2, dim=-1)
            std = log_std.clamp(-5, 2).exp()
            dist = torch.distributions.Normal(mean, std)
            new_log_probs = dist.log_prob(actions).sum(-1)
            entropy = dist.entropy().sum(-1).mean()
            
            # Policy ratio
            ratio = (new_log_probs - old_log_probs).exp()
            
            # Clipped objective
            surr1 = ratio * advantages
            surr2 = torch.clamp(ratio, 1 - self.clip_range, 1 + self.clip_range) * advantages
            policy_loss = -torch.min(surr1, surr2).mean()
            
            # Value loss
            values = self.critic(states).squeeze(-1)
            value_loss = 0.5 * (returns - values).pow(2).mean()
            
            # Total loss
            loss = policy_loss + 0.5 * value_loss - 0.01 * entropy
            
            self.optimizer.zero_grad()
            loss.backward()
            nn.utils.clip_grad_norm_(self.parameters(), 0.5)
            self.optimizer.step()
```

### 3.2 IMPALA (Importance Weighted Actor-Learner Architecture)

IMPALA decouples acting from learning, enabling massive parallelism:

- **Actors**: Many parallel environment instances collecting experience
- **Learner**: Single GPU training on batched experience
- **V-trace correction**: Corrects for off-policy data from slightly stale actor policies

```
v_s = V(x_s) + Σ_{t=s}^{s+n-1} γ^{t-s} (Π_{i=s}^{t-1} c_i) δ_t V

where c_i = min(c̄, π(a_i|x_i) / μ(a_i|x_i))  (truncated importance weight)
      δ_t V = ρ_t(r_t + γV(x_{t+1}) - V(x_t))
      ρ_t = min(ρ̄, π(a_t|x_t) / μ(a_t|x_t))
```

**Relevance for airside**: IMPALA enables training with 100+ parallel CARLA instances. At ~10 FPS per instance, 100 instances provide 1,000 environment steps/second — enough to train a driving policy in 24-48 hours.

### 3.3 On-Policy Performance Comparison

| Algorithm | CARLA Longest6 v2 | nuPlan CLS-R | Stability | Sample Efficiency |
|---|---|---|---|---|
| **PPO (CaRL)** | **SOTA** (open-source) | **SOTA** (open-source) | High | Low (needs 50M+ steps) |
| **IMPALA** | Good | — | High | Medium (V-trace helps) |
| **A3C** | Moderate | — | Low (async instability) | Low |
| **TRPO** | Good | — | Very high | Very low |

---

## 4. Off-Policy Methods

Off-policy methods learn from data collected by any policy (including old policies or expert demonstrations). Much more sample-efficient than on-policy.

### 4.1 SAC (Soft Actor-Critic)

SAC (Haarnoja et al., 2018) adds maximum entropy to the RL objective:

```
π* = arg max_π E [Σ_t γ^t (R(s_t, a_t) + α H(π(·|s_t)))]

where α = entropy temperature (auto-tuned)
      H(π) = -E[log π(a|s)]
```

**Why entropy matters for driving**: The entropy bonus encourages exploration of multiple valid driving strategies (faster lane, slower but safer route) rather than collapsing to a single behavior. For airside, this helps discover alternative routes around obstacles.

**SAC components**:
- **Actor**: Squashed Gaussian policy π_θ(a|s) — outputs mean + std, samples via reparameterization, applies tanh squashing
- **Twin critics**: Two Q-networks Q_φ1, Q_φ2 — take minimum to prevent overestimation
- **Target networks**: Exponential moving average for stability (τ = 0.005)
- **Auto-tuned α**: Adjusts entropy weight to maintain target entropy = -dim(A)

| Hyperparameter | Driving Value | Notes |
|---|---|---|
| Learning rate | 3e-4 | Same for actor and critics |
| Replay buffer | 1M transitions | ~28 hours of 10 Hz driving |
| Batch size | 256 | |
| Target update τ | 0.005 | Soft update |
| Discount γ | 0.99 | |
| Target entropy | -dim(A) | Auto-tuned α |

### 4.2 TD3 (Twin Delayed DDPG)

TD3 (Fujimoto et al., 2018) addresses overestimation in DDPG with three tricks:

1. **Clipped double Q-learning**: min(Q_φ1, Q_φ2) — same as SAC
2. **Delayed policy updates**: Update actor every 2 critic updates
3. **Target policy smoothing**: Add clipped noise to target actions

```python
# Target Q-value computation in TD3
target_action = target_actor(next_state) + clipped_noise
target_q1 = target_critic1(next_state, target_action)
target_q2 = target_critic2(next_state, target_action)
target_q = reward + gamma * (1 - done) * min(target_q1, target_q2)
```

**TD3 vs SAC for driving**: SAC generally outperforms TD3 on driving tasks due to entropy-regularized exploration. TD3 is simpler but more brittle with reward design.

### 4.3 TQC (Truncated Quantile Critics)

TQC (Kuznetsov et al., 2020) extends SAC with distributional critics:

- Uses N=5 quantile critic networks, each predicting M=25 quantiles of the return distribution
- Drops the top d=2 atoms from the combined quantile distribution for pessimism
- Achieves more accurate Q-value estimates and better exploration

**First applied to driving in 2025**: TQC outperformed SAC, TD3, and DDPG on urban CARLA scenarios, particularly in intersection navigation where value estimation is challenging.

### 4.4 CrossQ

CrossQ (Bhatt et al., 2024) simplifies SAC by removing target networks entirely:

- Uses batch normalization in critics to stabilize training
- Processes current and next states in the same forward pass (cross-batch normalization)
- Achieves SAC-level performance with 50% fewer parameters and no target network updates

**Advantage for Orin**: Smaller critic networks mean faster training if doing on-device fine-tuning (relevant for federated RL).

### 4.5 Off-Policy Performance Comparison

| Algorithm | CARLA Urban | Sample Efficiency | Hyperparameter Sensitivity | Implementation Complexity |
|---|---|---|---|---|
| **SAC** | Strong | High | Low (auto-α) | Medium |
| **TD3** | Moderate | High | Medium | Low |
| **TQC** | Strong+ | High | Low | Medium-High |
| **CrossQ** | Strong | High | Low | Medium |
| **DDPG** | Weak | Medium | High | Low |

---

## 5. Offline Reinforcement Learning

Offline RL learns policies entirely from a fixed dataset of previously collected transitions, without any environment interaction. This is the most relevant paradigm for airside deployment.

### 5.1 Why Offline RL for Airside

Online RL requires environment interaction — impossible on an active airport apron:

| Constraint | Impact |
|---|---|
| **Safety** | Random exploration near aircraft risks $250K+ damage per incident |
| **Availability** | Can't monopolize a real stand for RL training |
| **Regulatory** | No regulatory framework for "learning" vehicles on apron |
| **Cost** | Each real-world episode requires operator oversight |

Offline RL learns from:
- **Frenet planner logs**: Thousands of hours of rule-based driving (state, action, reward can be computed post-hoc)
- **Human operator demonstrations**: Recorded during safety-operator-present deployments
- **Simulation data**: CARLA airport environment (see sim-to-real doc)
- **Fleet data**: Continuously growing dataset from deployed vehicles

### 5.2 The Distribution Shift Problem

The fundamental challenge: the learned policy π encounters states not in the dataset D (collected by behavior policy β), causing Q-value overestimation for unseen (state, action) pairs.

```
Online RL: if Q is wrong → agent visits that state → gets corrected
Offline RL: if Q is wrong → agent never visits → error persists and compounds
```

### 5.3 CQL (Conservative Q-Learning)

CQL (Kumar et al., 2020) addresses overestimation by adding a regularizer that pushes down Q-values for out-of-distribution actions:

```
L_CQL(φ) = α * (E_{s~D, a~π} [Q_φ(s,a)] - E_{(s,a)~D} [Q_φ(s,a)]) + L_TD(φ)
                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                Push down OOD Q-values          Push up in-distribution Q-values
```

**Effect**: The learned Q-function is a lower bound on the true Q-function for in-distribution actions, preventing the policy from exploiting overestimated values for unseen actions.

| CQL Hyperparameter | Driving Value | Notes |
|---|---|---|
| α (conservative weight) | 1.0-5.0 | Higher = more conservative. Start at 1.0 for expert data, 5.0 for mixed-quality data |
| Min Q-weight | 1.0 | For SAC-style entropy regularization |
| Network | (256, 256) MLP or ResNet-18 encoder | |
| Batch size | 256 | |
| Learning rate | 3e-4 | |

**CQL for driving**: AD4RL benchmark showed CQL achieves reasonable performance on highway and urban driving from offline datasets, but tends to be overly conservative — the vehicle drives slowly and hesitates at intersections.

### 5.4 IQL (Implicit Q-Learning)

IQL (Kostrikov et al., 2022) avoids querying OOD actions entirely by using expectile regression:

```
L_V(ψ) = E_{(s,a)~D} [L_τ(Q_φ(s,a) - V_ψ(s))]

where L_τ(u) = |τ - 1(u < 0)| * u²
      τ = expectile (0.5-0.9, typically 0.7)
```

**Key insight**: IQL never evaluates Q(s, a) for actions a not in the dataset. The value function V(s) is trained to estimate the τ-th expectile of Q-values in the dataset, effectively extracting the best actions without explicit maximization.

**Advantages for driving**:
- No need to sample/evaluate OOD actions — more stable than CQL
- Simpler to tune (single hyperparameter τ)
- Consistent performance across traffic densities (2026 AEB study)
- Works well with mixed-quality data (different drivers/planners)

```python
class IQLDrivingAgent:
    """Implicit Q-Learning for offline driving policy."""
    
    def __init__(self, state_dim, action_dim, config):
        self.q1 = QNetwork(state_dim, action_dim, hidden=256)
        self.q2 = QNetwork(state_dim, action_dim, hidden=256)
        self.v = VNetwork(state_dim, hidden=256)
        self.actor = GaussianActor(state_dim, action_dim, hidden=256)
        
        self.tau = config.expectile  # 0.7 default
        self.beta = config.awr_temperature  # 3.0 for advantage-weighted regression
    
    def update_value(self, states, actions):
        """Expectile regression for V-function."""
        with torch.no_grad():
            q1 = self.q1(states, actions)
            q2 = self.q2(states, actions)
            q = torch.min(q1, q2)
        
        v = self.v(states)
        diff = q - v
        weight = torch.where(diff > 0, self.tau, 1 - self.tau)
        v_loss = (weight * diff.pow(2)).mean()
        return v_loss
    
    def update_q(self, states, actions, rewards, next_states, dones):
        """Standard Bellman backup using V-function (no max over actions)."""
        with torch.no_grad():
            next_v = self.v(next_states)
            target_q = rewards + self.gamma * (1 - dones) * next_v
        
        q1_loss = ((self.q1(states, actions) - target_q).pow(2)).mean()
        q2_loss = ((self.q2(states, actions) - target_q).pow(2)).mean()
        return q1_loss + q2_loss
    
    def update_actor(self, states, actions):
        """Advantage-weighted regression (AWR) for policy extraction."""
        with torch.no_grad():
            q = torch.min(self.q1(states, actions), self.q2(states, actions))
            v = self.v(states)
            advantage = q - v
            # Exponential advantage weighting
            weights = torch.exp(self.beta * advantage)
            weights = torch.clamp(weights, max=100.0)  # prevent explosion
        
        log_prob = self.actor.log_prob(states, actions)
        actor_loss = -(weights * log_prob).mean()
        return actor_loss
```

### 5.5 EDAC (Ensemble-Diversified Actor-Critic)

EDAC (An et al., 2021) uses a large ensemble of Q-functions (N=10-50) with a diversity regularizer:

- Penalizes Q-functions that agree on OOD actions (forces disagreement = uncertainty)
- Uses the mean - λ*std of ensemble Q-values as the target
- More fine-grained uncertainty estimation than CQL's blanket pessimism

**For driving**: EDAC is promising for mixed-quality datasets (some expert, some novice demonstrations) because the ensemble uncertainty is higher for states visited only by poor drivers.

### 5.6 Decision Transformer and Sequence Models

Decision Transformer (Chen et al., 2021) casts offline RL as conditional sequence generation:

```
Input:  (R̂_1, s_1, a_1, R̂_2, s_2, a_2, ..., R̂_t, s_t)
Output: a_t

where R̂_t = desired return-to-go (sum of future rewards)
```

**At test time**: Condition on a high desired return to generate expert-quality actions.

**Trajectory Transformer** (Janner et al., 2021) takes this further — discretizes everything into tokens and uses beam search for planning.

**For airside driving**:
- Natural fit: driving is already sequential decision-making
- Can condition on different "quality levels" — e.g., low return-to-go generates cautious driving
- Scales with data and compute (Transformer scaling laws apply)
- Limitation: no stitching — can only reproduce behaviors seen in the dataset, not combine sub-trajectories from different demonstrations

### 5.7 Offline RL Algorithm Comparison for Driving

| Algorithm | AEB Performance (2026) | Conservatism | Stability | Data Requirements | Stitching |
|---|---|---|---|---|---|
| **BC** (baseline) | Moderate | N/A — copies data | High | Any | No |
| **CQL** | Good | High (overly cautious) | Medium | Expert + mixed | Yes |
| **IQL** | **Best** (consistent) | Moderate | **High** | Any | Limited |
| **EDAC** | Good | Adaptive | Medium | Mixed quality | Yes |
| **Decision Transformer** | Moderate | Conditioned | High | Expert preferred | No |
| **BPPO** | Good | Moderate | Medium | Any | Yes |

---

## 6. Behavior Cloning and Bootstrapping

### 6.1 BC as Warm Start

Behavior cloning pre-trains the policy on expert demonstrations before RL fine-tuning:

```
L_BC(θ) = E_{(s,a)~D_expert} [-log π_θ(a|s)]
```

**Why BC first**:
- RL from scratch requires millions of steps even in simulation
- BC provides a reasonable initial policy in ~10K gradient steps
- Subsequent RL fine-tuning corrects BC's compounding errors

**For Aurrigo**: The Frenet planner generates thousands of hours of (state, action) pairs. BC on this data produces a neural policy that mimics the Frenet planner, which RL then improves upon.

### 6.2 DAgger (Dataset Aggregation)

DAgger (Ross et al., 2011) iteratively corrects the distribution mismatch:

1. Train initial policy π_0 from expert data
2. Run π_i in the environment, collecting states s_i
3. Query the expert for actions a* at states s_i
4. Aggregate D = D ∪ {(s_i, a*)} and retrain

**Adaptation for airside**: Instead of querying a human expert, use the Frenet planner as the oracle. DAgger with the Frenet planner is safe (Frenet planner always available as fallback) and automatable.

```python
def dagger_airside(frenet_planner, initial_policy, env, n_iterations=10):
    """DAgger with Frenet planner as expert oracle."""
    dataset = collect_expert_data(frenet_planner, env, n_episodes=100)
    policy = train_bc(initial_policy, dataset)
    
    for i in range(n_iterations):
        # Roll out current policy (with Frenet safety fallback)
        states = collect_states_with_policy(policy, env, n_episodes=50)
        
        # Query Frenet planner at visited states
        expert_actions = [frenet_planner.plan(s) for s in states]
        
        # Aggregate and retrain
        dataset.extend(zip(states, expert_actions))
        policy = train_bc(policy, dataset)  # or fine-tune
    
    return policy
```

### 6.3 BC → Offline RL → Online RL Pipeline

The recommended three-phase approach:

| Phase | Method | Data Source | Duration | Expected Improvement |
|---|---|---|---|---|
| **Phase 1: BC** | Supervised learning | Frenet planner logs (1000+ hours) | 2-4 hours training | Baseline policy ~90% of Frenet |
| **Phase 2: Offline RL** | IQL/CQL on fleet data | Fleet logs + simulation data | 8-16 hours training | +5-15% over BC |
| **Phase 3: Online RL** | PPO in CARLA airport env | Simulated interaction | 24-72 hours training | +10-20% over offline |

---

## 7. Safe and Constrained RL

### 7.1 Why Standard RL Is Unsafe

Standard RL maximizes expected return, which can include rare catastrophic failures offset by good average performance:

```
Standard: max E[Σ γ^t r_t]  — average performance
Needed:   max E[Σ γ^t r_t] s.t. P(collision) < ε  — worst-case constraints
```

### 7.2 Constrained MDP (CMDP) Formulation

CMDP augments the MDP with cost constraints:

```
max_π E_π [Σ γ^t R(s_t, a_t)]
s.t. E_π [Σ γ^t C_i(s_t, a_t)] ≤ d_i  for i = 1, ..., m

where C_i = cost function for constraint i
      d_i = maximum allowed cumulative cost
```

**Airside constraints**:

| Constraint | Cost Function | Threshold d |
|---|---|---|
| Collision | 1 if collision, 0 otherwise | 0 (zero tolerance) |
| Aircraft proximity | max(0, d_min - d_aircraft) | 0 |
| Speed limit | max(0, v - v_limit) | 0.1 (minor violations OK) |
| Geofence | 1 if outside permitted zone | 0 |
| Comfort | |jerk| > j_max | 5.0 per episode |

### 7.3 Lagrangian Methods

Convert CMDP to unconstrained optimization with adaptive Lagrange multipliers:

```
L(π, λ) = E_π [Σ γ^t R] - Σ_i λ_i (E_π [Σ γ^t C_i] - d_i)

Update policy: θ ← θ + α_θ ∇_θ L(π_θ, λ)
Update multipliers: λ_i ← max(0, λ_i + α_λ (E[C_i] - d_i))
```

**PPO-Lagrangian** simply adds Lagrangian cost terms to PPO's objective. Implemented in OmniSafe library.

### 7.4 CPO (Constrained Policy Optimization)

CPO (Achiam et al., 2017) provides a trust-region method with hard constraint satisfaction:

- Each policy update is projected onto the constraint-satisfying region
- Guarantees near-constraint satisfaction at every iteration (not just convergence)
- More conservative than Lagrangian but safer during training

### 7.5 Safety Layer / CBF Integration

Instead of learning safe behavior from scratch, combine RL with a **safety filter** (see `safety-critical-planning-cbf.md`):

```
a_safe = argmin_a ||a - a_RL||²
         s.t. h(f(s) + g(s)a) ≥ -α(h(s))  (CBF constraint)
```

**Architecture for Aurrigo**:
```
RL Policy → proposed action → CBF-QP filter → safe action → vehicle
                                     ↑
                        Safety constraints from
                        runtime monitor (STL specs)
```

**Advantages**:
- RL doesn't need to learn safety — focuses on performance
- CBF provides formal safety guarantees (see CBF doc)
- Matches Simplex architecture: RL as advanced controller, Frenet as fallback, CBF as filter

```python
class SafeRLController:
    """RL policy with CBF safety filter."""
    
    def __init__(self, rl_policy, cbf_filter, frenet_fallback):
        self.rl_policy = rl_policy
        self.cbf_filter = cbf_filter
        self.frenet_fallback = frenet_fallback
        self.use_rl = True
    
    def get_action(self, state):
        if not self.use_rl:
            return self.frenet_fallback.plan(state)
        
        # Get RL proposed action
        action_rl = self.rl_policy(state)
        
        # Apply CBF safety filter
        action_safe, feasible = self.cbf_filter.filter(state, action_rl)
        
        if not feasible:
            # CBF can't make RL action safe → switch to Frenet (Simplex)
            self.trigger_simplex_switch()
            return self.frenet_fallback.plan(state)
        
        return action_safe
    
    def trigger_simplex_switch(self):
        """Log intervention and switch to safe controller."""
        self.use_rl = False
        rospy.logwarn("Simplex: RL → Frenet fallback triggered")
```

### 7.6 Recovery RL

Recovery RL (Thananjeyan et al., 2021) trains two policies:
- **Task policy**: Optimizes performance (may be unsafe)
- **Recovery policy**: Trained to return to safe states when risk is detected

The system switches to the recovery policy when the task policy's proposed action enters a "danger zone" estimated by a learned safety critic.

**For airside**: The recovery policy could be trained specifically on "near-miss" scenarios — learning aggressive but safe evasive maneuvers that the conservative Frenet planner can't generate.

---

## 8. Offline-to-Online Fine-Tuning

### 8.1 The Problem

Offline RL policies, while safe to train, are bounded by the quality and coverage of the offline dataset. Online fine-tuning improves them but risks catastrophic forgetting and initial performance collapse.

### 8.2 Cal-QL (Calibrated Conservative Q-Learning)

Cal-QL (Nakamoto et al., 2024) addresses the "initial dip" problem in offline-to-online:

- During online fine-tuning, gradually relaxes CQL's conservatism
- Calibrates the conservative Q-function to the true Q-function as online data accumulates
- Eliminates the performance dip when transitioning from offline to online

### 8.3 RLPD (Reinforcement Learning with Prior Data)

RLPD (Ball et al., 2023) simply mixes offline data with online experience in the replay buffer:

```
Mini-batch = 50% offline data + 50% online data
Train standard SAC on mixed mini-batches
```

**Surprisingly effective**: This simple approach matches or exceeds sophisticated offline-to-online methods on many benchmarks.

### 8.4 Practical Offline-to-Online for Airside

```
Phase 1 (Offline): Train IQL on fleet data → conservative but safe policy
Phase 2 (Sim Online): PPO fine-tuning in CARLA airport env with CBF safety filter
Phase 3 (Real Online): RLPD with fleet data (offline) + shadow mode data (online)
                        Safety: Simplex architecture, Frenet fallback always available
```

**Shadow mode integration** (see `60-safety-validation/verification-validation/shadow-mode.md`):
- RL policy runs in shadow (no vehicle control)
- Compares RL actions to Frenet planner actions
- When RL would have performed better, adds to online replay buffer
- When RL would have been worse/unsafe, adds as negative example

---

## 9. Policy Distillation for Edge Deployment

### 9.1 Why Distillation

RL training uses large networks (256-512 hidden units, ensembles) and runs on GPU servers. Deployment on Orin requires:

| Constraint | Training | Orin Deployment |
|---|---|---|
| Latency | Not critical | <5ms per inference |
| Memory | 16-80 GB GPU | Shared with perception |
| Network size | 5-50M params | 0.5-2M params |
| Precision | FP32 | FP16/INT8 |

### 9.2 Knowledge Distillation

Train a small "student" policy to mimic the large "teacher":

```
L_distill = E_s [(1-α) * L_BC(π_student, D_expert) + α * L_KD(π_student, π_teacher)]

where L_KD = KL(π_teacher(·|s) || π_student(·|s))
      α = distillation weight (0.5-0.9)
```

### 9.3 Privileged-to-Sensor Distillation

CaRL and many driving RL methods train with **privileged state** (perfect object positions, ground-truth map) but deploy with **sensor input** (LiDAR point clouds, images):

```
Teacher: π_privileged(a | ground_truth_state)     ← trained with RL
Student: π_sensor(a | lidar_features, map_features) ← trained with distillation
```

**Two-stage training**:
1. Train teacher with PPO/IQL using privileged state (fast, converges well)
2. Distill into student that takes sensor features as input (supervised, stable)

This is the approach used by comma.ai (see `companies/comma-ai/tech-stack.md`): 2B parameter DiT world model as teacher → small FastViT+Transformer policy for on-device deployment.

### 9.4 Distilled Policy Architecture for Orin

```python
class DistilledDrivingPolicy(nn.Module):
    """Compact policy for Orin deployment (~500K params, <3ms FP16)."""
    
    def __init__(self, feature_dim=128, action_dim=2):
        super().__init__()
        # Input: concatenated features from perception backbone
        # (reuse BEV features from multi-task head, no extra encoder)
        self.policy_head = nn.Sequential(
            nn.Linear(feature_dim, 128),
            nn.ReLU(),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, action_dim),  # (lateral_offset, target_speed)
        )
    
    def forward(self, bev_features):
        """
        bev_features: (B, 128) from shared perception backbone
        Returns: (B, 2) — (lateral_offset_m, target_speed_mps)
        """
        return self.policy_head(bev_features)

# Orin inference budget:
# Perception backbone (shared): 14.8ms (from multi-task doc)
# Policy head: ~0.5ms FP16
# CBF safety filter: ~1.0ms
# Total: ~16.3ms → 60 Hz feasible
```

---

## 10. RL Benchmarks and Evaluation

### 10.1 Simulation Benchmarks

| Benchmark | Environment | Metrics | Best RL Method |
|---|---|---|---|
| **CARLA Leaderboard 2.0** | CARLA simulator | Route completion, infractions, driving score | CaRL (PPO) |
| **nuPlan** | Real-world replay + simulation | CLS-R, OLS, reactive metrics | CaRL (PPO) |
| **AD4RL** | Highway + urban offline datasets | Normalized return, collision rate | IQL |
| **MetaDrive** | Procedural environments | Success rate, efficiency | PPO |
| **SMARTS** | Multi-agent traffic | Completion, safety, comfort | SAC |
| **Waymax** | Waymo data, JAX-based | Log-likelihood, collision, off-road | — |

### 10.2 nuPlan: The Gold Standard

nuPlan provides the most realistic evaluation:
- **1282 hours** of real driving from 4 cities
- **Closed-loop simulation**: ego actions affect the environment
- **Reactive agents**: Other vehicles respond to ego's behavior
- **CLS-R metric**: Closed-loop score with reactive agents (composite of progress, safety, comfort)

| Method | CLS-R (Val14) | Type |
|---|---|---|
| PDM-Closed (rule-based) | ~92 | Rule-based |
| **CaRL (PPO)** | **~89** (best open-source RL) | RL |
| Diffusion-ES | ~90 | Diffusion + search |
| BC baseline | ~75 | Imitation learning |

**Key insight**: Rule-based PDM still leads on average, but RL methods (CaRL) outperform on the hardest interactive scenarios where rule-based logic fails.

### 10.3 Metrics for Airside RL Evaluation

Standard road metrics don't capture airside requirements:

| Metric | Description | Target |
|---|---|---|
| **Mission completion rate** | Stand-to-stand success | >99.5% |
| **Aircraft proximity violation** | Enters aircraft safety buffer | <0.1% of missions |
| **Personnel safety distance** | Min distance to ground crew | >3m 100% of time |
| **Speed compliance** | Within zone speed limits | >99% |
| **Geofence compliance** | Within permitted zones | 100% |
| **Turnaround time contribution** | Arrival within assigned window | >95% |
| **Comfort score** | Max lateral accel, jerk | <2 m/s², <5 m/s³ |
| **Simplex intervention rate** | How often fallback needed | <1% of decisions |
| **Energy efficiency** | kWh per mission vs baseline | <110% of optimal |

---

## 11. Practical Implementation for Airside

### 11.1 Training Infrastructure

| Component | Specification | Cost |
|---|---|---|
| Training server | 4x A100 80GB (or 4x RTX 4090) | $15-30K one-time |
| CARLA instances | 32-64 parallel on same server | Included |
| CARLA airport env | Custom airport map (see sim-to-real doc) | $10-20K development |
| Offline dataset | 1000+ hours Frenet planner logs | Already available |
| nuPlan license | Academic/commercial | Free/negotiable |

### 11.2 Phased Deployment Plan

#### Phase 0: BC Baseline (Weeks 1-4, $5-10K)
- Extract (state, action) pairs from Frenet planner ROS bags
- Train BC policy on fleet data
- Evaluate in CARLA airport environment
- **Deliverable**: Neural policy that mimics Frenet planner

#### Phase 1: Offline RL (Weeks 5-10, $10-15K)
- Implement IQL on extracted fleet data
- Add reward labels to fleet data post-hoc (route progress, proximity violations)
- Train offline RL policy, evaluate closed-loop in simulation
- **Deliverable**: Offline RL policy that outperforms BC by 5-15%

#### Phase 2: Online RL in Simulation (Weeks 11-18, $15-25K)
- Set up CaRL-style PPO training in CARLA airport env
- Integrate CBF safety filter during training
- 50M+ environment steps (2-5 days wall time on 4x A100)
- **Deliverable**: Online RL policy with SOTA simulation performance

#### Phase 3: Distillation + Deployment (Weeks 19-24, $10-15K)
- Distill privileged RL policy to sensor-input student
- TensorRT optimization for Orin (FP16, <3ms)
- Shadow mode evaluation on real fleet (2-4 weeks)
- **Deliverable**: Orin-deployable RL policy, shadow mode validation results

#### Phase 4: Closed-Loop Deployment (Weeks 25-32, $5-10K)
- Integrate with Simplex architecture (RL as advanced controller)
- CBF safety filter in real-time
- Frenet planner as always-available fallback
- A/B testing: RL vehicles vs Frenet-only vehicles
- **Deliverable**: Production RL deployment with safety guarantees

**Total**: $45-75K over 32 weeks

### 11.3 ROS Integration Architecture

```
┌─────────────────────────────────────────────────┐
│                  Decision Layer                   │
│                                                   │
│  ┌──────────────┐  ┌──────────────┐              │
│  │  RL Policy   │  │   Frenet     │              │
│  │  (advanced)  │  │   Planner    │              │
│  │              │  │  (fallback)  │              │
│  └──────┬───────┘  └──────┬───────┘              │
│         │                  │                      │
│         ▼                  │                      │
│  ┌──────────────┐          │                      │
│  │  CBF Safety  │          │                      │
│  │   Filter     │          │                      │
│  └──────┬───────┘          │                      │
│         │                  │                      │
│         ▼                  ▼                      │
│  ┌──────────────────────────────┐                │
│  │     Simplex Decision Module   │                │
│  │  (switches RL↔Frenet based   │                │
│  │   on runtime monitor STL)    │                │
│  └──────────────┬───────────────┘                │
│                  │                                │
│                  ▼                                │
│         /cmd_vel or /trajectory                   │
└─────────────────────────────────────────────────┘
```

**ROS topics**:
```yaml
# Inputs to RL policy
/perception/bev_features:        sensor_msgs/Image  # (H,W,C) BEV feature map
/localization/ego_state:         nav_msgs/Odometry   # pose + velocity
/planning/route_waypoints:       nav_msgs/Path        # upcoming route
/perception/detected_objects:    vision_msgs/Detection3DArray
/runtime_monitor/odd_state:      std_msgs/Int32      # ODD operational state

# RL policy output
/planning/rl_trajectory:         nav_msgs/Path       # proposed trajectory
/planning/rl_confidence:         std_msgs/Float32    # policy entropy (uncertainty)

# After CBF filter
/planning/safe_trajectory:       nav_msgs/Path       # filtered trajectory

# Simplex output
/planning/active_controller:     std_msgs/String     # "rl" or "frenet"
/control/cmd_vel:                geometry_msgs/Twist  # final command
```

### 11.4 Sim-to-Real Considerations

| Challenge | Mitigation |
|---|---|
| **Dynamics gap** | Train on randomized dynamics (mass, friction, steering delay) |
| **Sensor gap** | Privileged→sensor distillation (see Section 9.3) |
| **Scenario gap** | Adversarial scenario generation (see testing doc) |
| **Reward gap** | Use real-world metrics in simulation reward |
| **Latency gap** | Add random 10-50ms action delay during training |

### 11.5 Continuous Improvement Loop

```
Fleet Data → Offline RL Update (monthly)
                    ↓
        Simulation Validation (automated)
                    ↓
        Shadow Mode Testing (1-2 weeks)
                    ↓
        A/B Testing (2-4 weeks, subset of fleet)
                    ↓
        Full Fleet Rollout (OTA update)
                    ↓
        Fleet Data → ... (loop)
```

This integrates with the data flywheel (see `50-cloud-fleet/mlops/data-flywheel-airside.md`) and the federated learning pipeline (see `50-cloud-fleet/mlops/federated-learning-fleet.md`) for multi-airport policy adaptation.

---

## 12. Key Takeaways

1. **CaRL (CoRL 2025) is SOTA for open-source RL driving**: PPO with simple route-completion reward + infraction penalties, first public codebase for RL on CARLA Leaderboard 2.0 and nuPlan. Key insight: complex shaped rewards prevent PPO from scaling with batch size.

2. **IQL is the best offline RL algorithm for driving**: Consistent performance across traffic densities, no need to evaluate OOD actions, single hyperparameter (expectile τ). 2026 AEB study confirms IQL outperforms CQL and BPPO for autonomous emergency braking.

3. **Offline RL is mandatory for airside initial policy learning**: Online exploration on an active apron is unacceptable. The thousands of hours of Frenet planner logs provide a natural offline dataset. Rewards can be computed post-hoc from logged states.

4. **BC → Offline RL → Online RL pipeline is the recommended approach**: BC warm start (90% of Frenet performance), IQL fine-tuning (+5-15%), PPO in simulation (+10-20%). Each phase builds on the previous, with decreasing risk.

5. **Safety filter (CBF-QP) decouples performance from safety**: RL focuses on route completion and efficiency; CBF guarantees collision avoidance and constraint satisfaction. This matches the Simplex architecture with RL as advanced controller and Frenet as fallback.

6. **Simple rewards scale; complex rewards don't**: CaRL proved that summing 10+ reward terms causes PPO to fail at large batch sizes. For airside: route completion × infraction multiplier + episode termination on collision. Resist the urge to add more reward terms.

7. **Privileged-to-sensor distillation enables Orin deployment**: Train with ground-truth state (fast convergence), distill to sensor-input student (500K params, <3ms FP16 on Orin). This is the comma.ai approach at smaller scale.

8. **Policy distillation fits within the multi-task perception budget**: The distilled policy head adds only ~0.5ms to the shared backbone (14.8ms). Total decision pipeline: 14.8ms perception + 0.5ms policy + 1.0ms CBF = 16.3ms → 60 Hz.

9. **SAC is the best off-policy algorithm for driving**: Entropy regularization provides robust exploration, auto-tuned temperature eliminates a key hyperparameter. TQC and CrossQ are promising but less battle-tested.

10. **Lagrangian PPO is the simplest safe RL approach**: Adds constraint costs as Lagrangian terms to PPO objective, auto-tunes multipliers. CPO provides stronger guarantees but is harder to implement. Both available in OmniSafe library.

11. **Shadow mode enables safe offline-to-online transition**: RL policy runs in parallel with Frenet planner, decisions compared but not executed. Positive comparisons enter online replay buffer; negative ones become training signal. Zero risk during transition.

12. **Recovery RL trains an emergency maneuver policy**: Separate from the task policy, activated when safety critic detects danger. For airside: aggressive but safe evasive maneuvers that the conservative Frenet planner can't generate (e.g., tight swerve around suddenly-placed obstacle).

13. **AD4RL benchmark provides airside-relevant offline RL evaluation**: Highway and urban driving datasets with proper offline RL evaluation protocols. Complements nuPlan for offline algorithm selection.

14. **DAgger with Frenet planner is a free lunch**: Use the Frenet planner as an always-available oracle for dataset aggregation. The neural policy runs in the loop, visits states the Frenet planner wouldn't, and gets corrected. Zero safety risk (Frenet always available as fallback).

15. **RLPD's simple 50/50 mixing matches sophisticated offline-to-online methods**: No need for complex calibration (Cal-QL) or curriculum — just mix offline and online data in the replay buffer. Start here before trying anything fancier.

16. **Continuous fleet RL improvement integrates with existing pipelines**: Monthly offline RL updates from fleet data → simulation validation → shadow mode → A/B testing → full rollout. Same cadence as the data flywheel retraining cycle.

17. **RL policy size is negligible compared to perception**: The RL policy (0.5-2M params) is <1% of the perception backbone (5-60M params). Compression and distillation focus should be on perception, not the policy.

18. **Reward shaping for airside should encode airport zone physics**: Different zones have different safety requirements — apron near aircraft (ultra-conservative), service road (moderate), remote taxiway (can be more efficient). Zone-conditioned reward or separate policies per zone type.

19. **Total cost $45-75K over 32 weeks**: Phase 0-4 from BC baseline through production deployment. Incremental — each phase delivers usable artifacts and de-risks the next.

20. **No public airside RL benchmark exists**: Building a CARLA airport environment + defining airside RL metrics would be a significant contribution and competitive advantage. The evaluation metrics (Section 10.3) provide the foundation.

---

## 13. References

### Foundational RL
- Schulman, J., et al. (2017). "Proximal Policy Optimization Algorithms." arXiv:1707.06347 — PPO
- Haarnoja, T., et al. (2018). "Soft Actor-Critic: Off-Policy Maximum Entropy Deep Reinforcement Learning with a Stochastic Actor." ICML — SAC
- Fujimoto, S., et al. (2018). "Addressing Function Approximation Error in Actor-Critic Methods." ICML — TD3
- Lillicrap, T. P., et al. (2016). "Continuous control with deep reinforcement learning." ICLR — DDPG
- Espeholt, L., et al. (2018). "IMPALA: Scalable Distributed Deep-RL with Importance Weighted Actor-Learner Architectures." ICML

### Offline RL
- Kumar, A., et al. (2020). "Conservative Q-Learning for Offline Reinforcement Learning." NeurIPS — CQL
- Kostrikov, I., et al. (2022). "Offline Reinforcement Learning with Implicit Q-Learning." ICLR — IQL
- An, G., et al. (2021). "Uncertainty-Based Offline Reinforcement Learning with Diversified Q-Ensemble." NeurIPS — EDAC
- Chen, L., et al. (2021). "Decision Transformer: Reinforcement Learning via Sequence Modeling." NeurIPS
- Janner, M., et al. (2021). "Offline Reinforcement Learning as One Big Sequence Modeling Problem." NeurIPS — Trajectory Transformer
- Fujimoto, S., et al. (2019). "Off-Policy Deep Reinforcement Learning without Exploration." ICML — BCQ
- Yu, T., et al. (2020). "MOPO: Model-based Offline Policy Optimization." NeurIPS
- Yu, T., et al. (2021). "COMBO: Conservative Offline Model-Based Policy Optimization." NeurIPS

### RL for Driving
- Jaeger, B., et al. (2025). "CaRL: Learning Scalable Planning Policies with Simple Rewards." CoRL — **SOTA open-source RL planner**
- Chen, D., et al. (2024). "AD4RL: Autonomous Driving Benchmarks for Offline Reinforcement Learning with Value-based Dataset." arXiv:2404.02429
- Dauner, D., et al. (2024). "Towards learning-based planning: The nuPlan benchmark for real-world autonomous driving." ICRA
- "A Comparative Study of Deep Reinforcement Learning Algorithms for Urban Autonomous Driving." Applied Sciences (2025) — TQC, CrossQ for CARLA
- "Offline Reinforcement Learning using Human-Aligned Reward Labeling for Autonomous Emergency Braking." arXiv:2504.08704 (2025) — IQL for AEB
- "V-Max: A Reinforcement Learning Framework for Autonomous Driving." RLC (2025)

### Safe RL
- Achiam, J., et al. (2017). "Constrained Policy Optimization." ICML — CPO
- Thananjeyan, B., et al. (2021). "Recovery RL: Safe Reinforcement Learning with Learned Recovery Zones." RA-L
- Chow, Y., et al. (2019). "Lyapunov-based Safe Policy Optimization for Continuous Control." ICML
- Ray, A., et al. (2019). "Benchmarking Safe Exploration in Deep Reinforcement Learning." arXiv — Safety Gym
- Ji, J., et al. (2024). "OmniSafe: An Infrastructure for Accelerating Safe Reinforcement Learning Research." JMLR

### Offline-to-Online
- Nakamoto, M., et al. (2024). "Cal-QL: Calibrated Offline RL Pre-Training for Efficient Online Fine-Tuning." NeurIPS
- Ball, P. J., et al. (2023). "Efficient Online Reinforcement Learning with Offline Data." ICML — RLPD
- Lee, S., et al. (2022). "Offline-to-Online Reinforcement Learning via Balanced Replay and Pessimistic Q-Ensemble." CoRL

### Distillation and Deployment
- Hinton, G., et al. (2015). "Distilling the Knowledge in a Neural Network." NeurIPS Workshop
- Chen, D., et al. (2020). "Learning by Cheating." CoRL — Privileged→sensor distillation
- Ross, S., et al. (2011). "A Reduction of Imitation Learning and Structured Prediction to No-Regret Online Learning." AISTATS — DAgger

### Additional
- Kuznetsov, A., et al. (2020). "Controlling Overestimation Bias with Truncated Mixture of Continuous Distributional Quantile Critics." ICML — TQC
- Bhatt, A., et al. (2024). "CrossQ: Batch Normalization in Deep Reinforcement Learning." ICLR
