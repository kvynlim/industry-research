# Imitation Learning and Behavioral Cloning for Airside Autonomous GSE

Autonomous ground support equipment at airports currently relies on hand-crafted planning systems — Aurrigo's Frenet planner samples 420 trajectory candidates per cycle and scores them with manually tuned cost functions for lane centering, obstacle avoidance, speed compliance, and comfort. These cost functions capture explicit domain knowledge but miss the implicit expertise that human operators demonstrate daily: the nuanced way a tow operator approaches a busy stand, the timing of yielding to crossing pedestrians, the subtle speed adjustments when passing near aircraft engines, and the confidence with which experienced drivers navigate congested aprons. Imitation learning (IL) offers a systematic way to extract this expertise from demonstrations — either from teleoperation logs, from manually driven runs during supervised deployment, or from shadow-mode data where the human drove while the autonomous system recorded what it would have done. This document covers the three pillars of imitation learning for autonomous driving: behavioral cloning (BC) which directly maps observations to actions via supervised learning, inverse reinforcement learning (IRL) which recovers the implicit reward function behind expert behavior, and interactive imitation learning (DAgger and variants) which addresses the distribution shift problem that makes naive BC fragile. For each, we examine the mathematical foundations, SOTA methods (2024-2026), practical considerations for deployment on NVIDIA Orin with LiDAR-based perception, and airside-specific adaptations including multi-operator style handling, safety constraint enforcement, and integration with the existing Frenet planner as a safety fallback via the Simplex architecture. The core recommendation is a phased approach: start with BC from teleoperation logs to bootstrap a policy, refine with DAgger in simulation, extract cost functions via IRL for Frenet planner augmentation, and eventually deploy with Simplex safety guarantees.

---

## Table of Contents

1. [Why Imitation Learning for Airside GSE](#1-why-imitation-learning-for-airside-gse)
2. [Behavioral Cloning Fundamentals](#2-behavioral-cloning-fundamentals)
3. [Advanced BC: Handling Multimodality](#3-advanced-bc-handling-multimodality)
4. [Distribution Shift and the DAgger Framework](#4-distribution-shift-and-the-dagger-framework)
5. [Inverse Reinforcement Learning](#5-inverse-reinforcement-learning)
6. [Generative Adversarial Imitation Learning](#6-generative-adversarial-imitation-learning)
7. [Learning from Diverse Operators](#7-learning-from-diverse-operators)
8. [Safety-Constrained Imitation Learning](#8-safety-constrained-imitation-learning)
9. [Integration with Existing Planning Stack](#9-integration-with-existing-planning-stack)
10. [Data Collection and Preparation](#10-data-collection-and-preparation)
11. [Orin Deployment and Real-Time Inference](#11-orin-deployment-and-real-time-inference)
12. [Key Takeaways](#12-key-takeaways)

---

## 1. Why Imitation Learning for Airside GSE

### 1.1 The Expert Knowledge Gap

Aurrigo's current autonomous pipeline is rule-based: the Frenet planner generates trajectories according to explicit mathematical cost functions. This works well for structured driving (follow lane, avoid obstacles, maintain speed) but struggles with the nuanced interactions that dominate airside operations:

| Scenario | Rule-Based Response | Expert Operator Response |
|----------|-------------------|------------------------|
| Approaching busy stand with crossing crew | Stop, wait for clear path | Slow to 2 km/h, creep through gap timed with crew movement |
| Passing aircraft with engines running | Maintain 50m clearance (hard-coded) | Adjust clearance based on engine type, wind direction, and jet blast feel |
| Convoy following behind lead tractor | Maintain fixed following distance | Adaptively match leader's speed profile, anticipate stops |
| Navigating congested apron intersection | Stop-and-wait at each conflict | Assertive merge with communication via trajectory intent |
| De-icing spray encounter | Reduce speed by fixed percentage | Dramatically slow, shift to different sensor mode, resume quickly |

These behaviors are difficult to encode as explicit rules but easy for experienced operators to demonstrate. Imitation learning bridges this gap.

### 1.2 Data Sources for Imitation

| Source | Availability | Quality | Volume | Cost |
|--------|-------------|---------|--------|------|
| **Teleoperation logs** | Available now (Fernride-style teleop) | High (human control, full sensor data) | Low (limited teleop hours) | Low (byproduct of operations) |
| **Supervised driving logs** | Available during deployment phase | High (human driver, autonomous sensors) | Medium (every supervised shift) | Low (byproduct) |
| **Shadow mode data** | Available with software modification | Medium (human drove, no autonomous correction) | High (every human-driven shift) | Very low (passive recording) |
| **Simulation demonstrations** | Unlimited (with sim environment) | Variable (sim-to-real gap) | Unlimited | Medium (sim development cost) |
| **Fleet natural driving** | Massive (after initial deployment) | Self-referential (learning from self) | Very high | Very low |

### 1.3 IL vs RL for Airside

| Dimension | Imitation Learning | Reinforcement Learning |
|-----------|-------------------|----------------------|
| **Data requirement** | Expert demonstrations | Reward function + environment |
| **Safety during training** | Safe (learns from safe demos) | Unsafe (explores, may cause damage) |
| **Sample efficiency** | High (few hundred demos) | Low (millions of episodes) |
| **Captures nuance** | Yes (implicit in demo behavior) | Only if reward captures it |
| **Distribution shift** | Yes (major challenge) | No (learns on own distribution) |
| **Optimality** | Bounded by expert quality | Can exceed expert performance |
| **Airside fit** | Excellent (can't explore unsafely) | Good after BC bootstrap |

**Recommendation**: IL first (BC bootstrap), then RL fine-tuning in simulation (see `30-autonomy-stack/planning/reinforcement-learning-driving-policy.md`).

---

## 2. Behavioral Cloning Fundamentals

### 2.1 Mathematical Formulation

Behavioral Cloning casts driving as supervised learning:

Given a dataset D = {(o₁, a₁), (o₂, a₂), ..., (oₙ, aₙ)} where:
- oₜ is the observation at time t (LiDAR BEV, ego state, map features)
- aₜ is the expert action at time t (steering, speed, or trajectory waypoints)

Learn a policy π_θ(a|o) by minimizing:

```
L(θ) = E_{(o,a)∼D} [||π_θ(o) - a||²]    (MSE for continuous actions)
```

Or, for trajectory prediction:

```
L(θ) = E_{(o,τ)∼D} [Σₜ ||π_θ(o)_t - τ_t||²]    (waypoint MSE)
```

### 2.2 BC Architecture for LiDAR-Based Driving

```python
import torch
import torch.nn as nn

class BehavioralCloningPolicy(nn.Module):
    """
    BC policy for airside GSE.
    
    Input: LiDAR BEV features + ego state + route info
    Output: Trajectory waypoints (next 3 seconds at 5 Hz = 15 waypoints)
    
    Architecture follows comma.ai / VAD pattern:
    Backbone (BEV features) → Temporal aggregation → Trajectory head
    """
    
    def __init__(self, bev_channels=256, ego_dim=8, route_dim=32, 
                 num_waypoints=15, waypoint_dim=3):
        super().__init__()
        
        # BEV feature encoder (from PointPillars or CenterPoint backbone)
        self.bev_encoder = nn.Sequential(
            nn.Conv2d(bev_channels, 128, 3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(),
            nn.Conv2d(128, 64, 3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.AdaptiveAvgPool2d((8, 8)),  # Fixed spatial size
            nn.Flatten(),
            nn.Linear(64 * 8 * 8, 256),
            nn.ReLU(),
        )
        
        # Ego state encoder (position, velocity, heading, steering angle, etc.)
        self.ego_encoder = nn.Sequential(
            nn.Linear(ego_dim, 64),
            nn.ReLU(),
            nn.Linear(64, 64),
            nn.ReLU(),
        )
        
        # Route encoder (next N route waypoints or goal direction)
        self.route_encoder = nn.Sequential(
            nn.Linear(route_dim, 64),
            nn.ReLU(),
            nn.Linear(64, 64),
            nn.ReLU(),
        )
        
        # Temporal aggregation (last 5 observations)
        self.temporal = nn.GRU(
            input_size=256 + 64 + 64,
            hidden_size=256,
            num_layers=2,
            batch_first=True,
        )
        
        # Trajectory prediction head
        self.trajectory_head = nn.Sequential(
            nn.Linear(256, 256),
            nn.ReLU(),
            nn.Linear(256, num_waypoints * waypoint_dim),  # x, y, heading
        )
        
        self.num_waypoints = num_waypoints
        self.waypoint_dim = waypoint_dim
    
    def forward(self, bev_features, ego_state, route_features, hidden=None):
        """
        Args:
            bev_features: [B, T, C, H, W] — BEV from last T frames
            ego_state: [B, T, ego_dim] — ego state history
            route_features: [B, route_dim] — route/goal encoding
        
        Returns:
            trajectory: [B, num_waypoints, waypoint_dim] — predicted waypoints
        """
        B, T = bev_features.shape[:2]
        
        # Encode each timestep
        frame_features = []
        for t in range(T):
            bev_feat = self.bev_encoder(bev_features[:, t])
            ego_feat = self.ego_encoder(ego_state[:, t])
            route_feat = self.route_encoder(route_features)
            combined = torch.cat([bev_feat, ego_feat, route_feat], dim=-1)
            frame_features.append(combined)
        
        frame_seq = torch.stack(frame_features, dim=1)  # [B, T, D]
        
        # Temporal aggregation
        gru_out, hidden = self.temporal(frame_seq, hidden)
        latest = gru_out[:, -1]  # [B, 256]
        
        # Predict trajectory
        traj_flat = self.trajectory_head(latest)
        trajectory = traj_flat.view(B, self.num_waypoints, self.waypoint_dim)
        
        return trajectory, hidden


def train_bc(model, dataloader, optimizer, num_epochs=100):
    """
    Standard BC training loop.
    
    Key considerations for airside:
    - Weight safety-critical scenarios higher (near aircraft, near crew)
    - Use L1 loss for robustness to outlier demonstrations
    - Apply data augmentation (noise injection on ego state)
    """
    loss_fn = nn.SmoothL1Loss()
    
    for epoch in range(num_epochs):
        for batch in dataloader:
            bev, ego, route, expert_traj, weights = batch
            
            pred_traj, _ = model(bev, ego, route)
            
            # Weighted loss: higher weight for safety-critical scenarios
            loss = (weights.unsqueeze(-1).unsqueeze(-1) * 
                    loss_fn(pred_traj, expert_traj)).mean()
            
            optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
```

### 2.3 Action Representations

| Representation | Pros | Cons | Best For |
|---------------|------|------|----------|
| **Steering + speed** | Simple, direct control | Compounding errors, hard to evaluate | Simple vehicles |
| **Trajectory waypoints** | Evaluable, plannable | Needs trajectory tracker | Most AV systems (recommended) |
| **Frenet coefficients** | Matches existing planner | Planner-specific | Aurrigo integration |
| **Cost function weights** | Interpretable, composable | Indirect mapping | IRL-based approaches |
| **Occupancy predictions** | Rich representation | Very indirect | World model approaches |

**Recommendation for Aurrigo**: Trajectory waypoints (3s horizon, 5 Hz, in ego-centric coordinates) — decouples learning from control, evaluable for safety.

---

## 3. Advanced BC: Handling Multimodality

### 3.1 The Multimodality Problem

Standard BC with MSE loss averages over multiple valid actions. When an operator could validly go left OR right around an obstacle, the average is going straight into it. This is the most common failure mode of naive BC.

### 3.2 Solutions

**Mixture Density Networks (MDN)**:
```python
class MDNPolicy(nn.Module):
    """
    Mixture Density Network for multimodal behavioral cloning.
    Models output as mixture of K Gaussians.
    """
    def __init__(self, backbone, K=5, traj_dim=45):
        super().__init__()
        self.backbone = backbone
        self.K = K
        
        # Mixture components
        self.pi_head = nn.Linear(256, K)           # Mixture weights
        self.mu_head = nn.Linear(256, K * traj_dim) # Means
        self.sigma_head = nn.Linear(256, K * traj_dim) # Log std
    
    def forward(self, x):
        features = self.backbone(x)
        
        pi = F.softmax(self.pi_head(features), dim=-1)      # [B, K]
        mu = self.mu_head(features).view(-1, self.K, 45)     # [B, K, 45]
        sigma = torch.exp(self.sigma_head(features)).view(-1, self.K, 45)
        
        return pi, mu, sigma
    
    def loss(self, pi, mu, sigma, target):
        """Negative log-likelihood of mixture."""
        target = target.unsqueeze(1).expand_as(mu)  # [B, K, 45]
        
        # Log probability of each component
        log_probs = -0.5 * ((target - mu) / sigma) ** 2 - torch.log(sigma)
        log_probs = log_probs.sum(dim=-1)  # [B, K]
        
        # Log mixture probability
        log_mix = torch.log(pi + 1e-8) + log_probs
        loss = -torch.logsumexp(log_mix, dim=-1).mean()
        
        return loss
    
    def sample(self, x, select='best'):
        """Sample trajectory from learned distribution."""
        pi, mu, sigma = self.forward(x)
        
        if select == 'best':
            # Select mode with highest weight
            best_k = pi.argmax(dim=-1)
            return mu[range(len(best_k)), best_k]
        elif select == 'sample':
            # Sample component, then sample from it
            k = torch.multinomial(pi, 1).squeeze(-1)
            eps = torch.randn_like(mu[:, 0])
            return mu[range(len(k)), k] + sigma[range(len(k)), k] * eps
```

**Diffusion-Based BC** (ICLR 2026 trend):
```python
class DiffusionBC(nn.Module):
    """
    Diffusion Policy (Chi et al. 2024) applied to driving.
    
    Advantages:
    - Naturally multimodal (no mode collapse)
    - Handles high-dimensional trajectory outputs
    - Can condition on arbitrary observations
    
    Disadvantage:
    - Requires 5-20 denoising steps (50-200ms on Orin)
    - Mitigated by DDIM with 3-5 steps (15-50ms)
    """
    def __init__(self, obs_encoder, traj_dim=45, hidden_dim=256, 
                 num_diffusion_steps=100):
        super().__init__()
        self.obs_encoder = obs_encoder
        self.noise_pred = nn.Sequential(
            nn.Linear(traj_dim + hidden_dim + 1, 512),  # +1 for timestep
            nn.ReLU(),
            nn.Linear(512, 512),
            nn.ReLU(),
            nn.Linear(512, traj_dim),
        )
        self.T = num_diffusion_steps
    
    def training_loss(self, obs, expert_traj):
        """Standard DDPM training loss."""
        obs_feat = self.obs_encoder(obs)
        
        # Sample random timestep
        t = torch.randint(0, self.T, (len(obs),), device=obs.device)
        
        # Add noise to expert trajectory
        noise = torch.randn_like(expert_traj)
        alpha_bar = self.alpha_schedule(t)
        noisy_traj = torch.sqrt(alpha_bar).unsqueeze(-1) * expert_traj + \
                     torch.sqrt(1 - alpha_bar).unsqueeze(-1) * noise
        
        # Predict noise
        t_embed = t.float() / self.T
        pred_noise = self.noise_pred(
            torch.cat([noisy_traj, obs_feat, t_embed.unsqueeze(-1)], dim=-1)
        )
        
        return F.mse_loss(pred_noise, noise)
    
    def sample(self, obs, num_steps=5):
        """DDIM sampling for fast inference."""
        obs_feat = self.obs_encoder(obs)
        traj = torch.randn(len(obs), 45, device=obs.device)
        
        step_size = self.T // num_steps
        for i in range(num_steps, 0, -1):
            t = torch.full((len(obs),), i * step_size - 1, device=obs.device)
            t_embed = t.float() / self.T
            
            pred_noise = self.noise_pred(
                torch.cat([traj, obs_feat, t_embed.unsqueeze(-1)], dim=-1)
            )
            
            # DDIM update
            traj = self.ddim_step(traj, pred_noise, t, step_size)
        
        return traj
```

### 3.3 Comparison of Multimodal BC Methods

| Method | Multimodality | Inference Time (Orin) | Training Stability | Accuracy | Recommendation |
|--------|--------------|---------------------|--------------------|----------|---------------|
| MSE BC | None (averages) | <1ms | Stable | Good (unimodal) | Baseline only |
| MDN (K=5) | Discrete modes | ~1ms | Moderate | Good | Short-term use |
| CVAE | Continuous latent | ~2ms | Moderate | Good | Medium-term |
| Diffusion (5 steps) | Full distribution | ~30ms | Stable | Best | If budget allows |
| Implicit BC (EBM) | Full support | ~50ms (optimization) | Hard | Good | Research only |

---

## 4. Distribution Shift and the DAgger Framework

### 4.1 The Core Problem

BC trains on the expert's state distribution but deploys on the policy's own state distribution. Small errors compound: a 1-degree steering error leads to slightly off-center driving, which produces observations the policy never trained on, which produces larger errors, leading to divergence.

**Compounding error bound**: For a policy with per-step error epsilon, trajectory error after T steps grows as O(epsilon * T²) — quadratic, not linear.

### 4.2 DAgger (Dataset Aggregation)

DAgger (Ross, Gordon & Bagnell, 2011) solves distribution shift by iteratively collecting data from the learned policy's distribution but labeling it with expert actions:

```python
class DAggerTrainer:
    """
    DAgger for airside GSE policy training.
    
    In practice: run in simulation with expert labeling.
    Expert = Frenet planner (for initial DAgger) or human teleoperator.
    """
    
    def __init__(self, policy, expert, simulator):
        self.policy = policy
        self.expert = expert  # Frenet planner or human teleop
        self.sim = simulator
        self.dataset = []
        self.beta_schedule = lambda i: max(0.0, 1.0 - i * 0.1)  # Decay expert
    
    def train(self, num_iterations=10, episodes_per_iter=50):
        """
        DAgger training loop.
        
        Iteration 0: Collect data from expert (pure BC dataset)
        Iteration 1+: Mix policy + expert execution, label with expert
        """
        for iteration in range(num_iterations):
            beta = self.beta_schedule(iteration)
            new_data = []
            
            for episode in range(episodes_per_iter):
                obs_list, action_list = [], []
                obs = self.sim.reset()
                
                for step in range(300):  # 30 seconds at 10 Hz
                    # Mix policy and expert execution
                    if np.random.random() < beta:
                        action = self.expert.act(obs)  # Expert executes
                    else:
                        action = self.policy.act(obs)   # Policy executes
                    
                    # ALWAYS label with expert (regardless of who executed)
                    expert_action = self.expert.act(obs)
                    
                    obs_list.append(obs)
                    action_list.append(expert_action)
                    
                    obs, _, done, _ = self.sim.step(action)
                    if done:
                        break
                
                new_data.extend(zip(obs_list, action_list))
            
            # Aggregate dataset
            self.dataset.extend(new_data)
            
            # Retrain policy on full aggregated dataset
            self.policy.train_on(self.dataset)
            
            # Evaluate
            success_rate = self.evaluate(num_episodes=20)
            print(f"Iter {iteration}: beta={beta:.2f}, "
                  f"dataset_size={len(self.dataset)}, "
                  f"success_rate={success_rate:.3f}")
    
    def evaluate(self, num_episodes=20):
        """Evaluate policy without expert intervention."""
        successes = 0
        for _ in range(num_episodes):
            obs = self.sim.reset()
            for step in range(300):
                action = self.policy.act(obs)
                obs, _, done, info = self.sim.step(action)
                if done:
                    if info.get('success'):
                        successes += 1
                    break
        return successes / num_episodes
```

### 4.3 DAgger Variants

| Variant | Key Innovation | Airside Applicability |
|---------|---------------|---------------------|
| **DAgger** (Ross 2011) | Iterative dataset aggregation | Good baseline, needs expert labels |
| **SafeDAgger** (Zhang 2016) | Only query expert when policy is uncertain | Reduces expert burden |
| **HG-DAgger** (Kelly 2019) | Human-gated: human takes over only on errors | Natural for teleop |
| **EnsembleDAgger** (Menda 2019) | Use ensemble disagreement to trigger queries | Efficient expert time |
| **ThriftyDAgger** (Hoque 2021) | Query-efficient: learn when to ask for help | Minimal expert annotation |
| **LazyDAgger** (Hoque 2024) | Ask only when intervention leads to learning | Most efficient |

**Recommended for Aurrigo**: HG-DAgger in simulation with Frenet planner as expert. The existing Frenet planner provides unlimited, deterministic expert labels at zero cost. DAgger iterations run in CARLA or Isaac Sim with airport environment.

---

## 5. Inverse Reinforcement Learning

### 5.1 Why IRL Instead of BC

BC learns a policy (what action to take). IRL learns a reward function (what makes a good action). The reward function is:
- **Transferable**: Same reward works across different vehicles, different planning algorithms
- **Interpretable**: Learned weights on cost features explain why the expert behaved a certain way
- **Composable**: Combine with safety constraints, efficiency objectives
- **Reusable**: Plug learned reward into Frenet planner as improved cost function

### 5.2 Maximum Entropy IRL

```python
class MaxEntIRL:
    """
    Maximum Entropy IRL (Ziebart 2008) for learning Frenet planner costs.
    
    Learns a reward function R(s,a) = theta^T * phi(s,a) where:
    - phi(s,a) are features (distance to lane center, speed, proximity to obstacles, etc.)
    - theta are learned weights
    
    The learned theta directly augments Frenet planner cost function.
    """
    
    def __init__(self, features, planner, learning_rate=0.01):
        self.features = features  # Feature extractor
        self.planner = planner    # Frenet planner (for forward pass)
        self.lr = learning_rate
        
        # Feature weights (what we're learning)
        self.theta = np.zeros(features.num_features)
    
    def extract_features(self, trajectory, scene):
        """
        Extract features from a trajectory in a scene.
        
        Airside-specific features:
        """
        return np.array([
            trajectory.lane_deviation_avg,          # Lane centering
            trajectory.min_obstacle_distance,       # Obstacle clearance
            trajectory.speed_deviation_from_limit,  # Speed compliance
            trajectory.lateral_acceleration_max,    # Comfort
            trajectory.longitudinal_jerk_max,       # Smoothness
            trajectory.min_aircraft_distance,       # Aircraft clearance (airside)
            trajectory.min_personnel_distance,      # Personnel clearance (airside)
            trajectory.time_to_goal,                # Efficiency
            trajectory.heading_change_total,        # Path smoothness
            trajectory.curvature_max,               # Turning sharpness
            trajectory.deceleration_max,            # Braking aggression
            trajectory.distance_to_jet_blast_zone,  # Jet blast avoidance
            trajectory.stand_approach_angle,        # Docking approach quality
        ])
    
    def compute_expert_feature_expectations(self, demonstrations):
        """Average feature values across expert demonstrations."""
        features_sum = np.zeros(self.features.num_features)
        for demo in demonstrations:
            for traj, scene in demo:
                features_sum += self.extract_features(traj, scene)
        return features_sum / sum(len(d) for d in demonstrations)
    
    def compute_policy_feature_expectations(self, scenes, num_samples=100):
        """
        Expected feature values under current reward-optimal policy.
        Uses Frenet planner with current theta as cost weights.
        """
        features_sum = np.zeros(self.features.num_features)
        count = 0
        
        for scene in scenes:
            # Set Frenet planner cost weights to current theta
            self.planner.set_cost_weights(self.theta)
            
            # Generate optimal trajectory under current reward
            traj = self.planner.plan(scene)
            features_sum += self.extract_features(traj, scene)
            count += 1
        
        return features_sum / count
    
    def train(self, demonstrations, scenes, num_iterations=200):
        """
        Gradient descent on feature matching objective.
        
        Update rule: theta += lr * (expert_features - policy_features)
        
        Intuition: increase reward for features that experts exhibit more
        than the current policy, decrease for features they exhibit less.
        """
        expert_features = self.compute_expert_feature_expectations(demonstrations)
        
        for iteration in range(num_iterations):
            policy_features = self.compute_policy_feature_expectations(scenes)
            
            # Gradient: match expert feature expectations
            gradient = expert_features - policy_features
            self.theta += self.lr * gradient
            
            # Feature matching error
            error = np.linalg.norm(gradient)
            
            if iteration % 20 == 0:
                print(f"Iter {iteration}: feature matching error = {error:.4f}")
                print(f"  Learned weights: {dict(zip(self.features.names, self.theta))}")
            
            if error < 0.01:
                print(f"Converged at iteration {iteration}")
                break
        
        return self.theta
```

### 5.3 IRL for Frenet Planner Augmentation

The key insight for Aurrigo: **IRL learns cost function weights that directly plug into the existing Frenet planner**. No neural network replacement needed — the planner's cost function becomes:

```
cost(τ) = Σᵢ θᵢ * φᵢ(τ)
```

Where θᵢ are learned from expert demonstrations and φᵢ are the existing Frenet cost features plus new airside-specific features.

| Feature | Hand-Tuned Weight | IRL-Learned Weight | Interpretation |
|---------|------------------|--------------------|---------------|
| Lane deviation | 10.0 | 7.3 | Experts care less about perfect centering |
| Obstacle distance | 15.0 | 22.1 | Experts are more cautious than hand-tuned |
| Speed compliance | 8.0 | 5.2 | Experts drive slightly faster when safe |
| Lateral accel | 5.0 | 8.7 | Experts prioritize passenger comfort more |
| Aircraft clearance | 20.0 | 31.4 | Experts maintain much more aircraft margin |
| Personnel clearance | 25.0 | 45.6 | Experts are extremely cautious near people |

---

## 6. Generative Adversarial Imitation Learning

### 6.1 GAIL Overview

GAIL (Ho & Ermon, 2016) trains a policy to generate behavior indistinguishable from expert demonstrations, using a GAN-style adversarial framework:

```python
class GAIL:
    """
    GAIL for driving policy learning.
    
    Components:
    - Generator (policy): tries to produce expert-like trajectories
    - Discriminator: tries to distinguish expert from policy trajectories
    
    Advantage over BC: doesn't need state-action pairs, just trajectories.
    Advantage over IRL: doesn't require feature engineering.
    Disadvantage: requires interactive environment (simulation).
    """
    
    def __init__(self, policy_net, discriminator_net, env, 
                 expert_trajectories):
        self.policy = policy_net
        self.discriminator = discriminator_net
        self.env = env
        self.expert_data = expert_trajectories
        
        self.policy_optimizer = torch.optim.Adam(
            self.policy.parameters(), lr=3e-4)
        self.disc_optimizer = torch.optim.Adam(
            self.discriminator.parameters(), lr=3e-4)
    
    def train_step(self):
        """One GAIL training iteration."""
        # 1. Collect policy rollouts
        policy_states, policy_actions = self.collect_rollouts(
            self.policy, self.env, num_episodes=32)
        
        # 2. Sample expert data
        expert_states, expert_actions = self.sample_expert(batch_size=len(policy_states))
        
        # 3. Update discriminator
        expert_logits = self.discriminator(expert_states, expert_actions)
        policy_logits = self.discriminator(policy_states, policy_actions)
        
        disc_loss = (
            F.binary_cross_entropy_with_logits(expert_logits, torch.ones_like(expert_logits)) +
            F.binary_cross_entropy_with_logits(policy_logits, torch.zeros_like(policy_logits))
        )
        
        self.disc_optimizer.zero_grad()
        disc_loss.backward()
        self.disc_optimizer.step()
        
        # 4. Update policy with PPO using discriminator as reward
        rewards = -torch.log(1 - torch.sigmoid(
            self.discriminator(policy_states, policy_actions).detach()))
        
        self.ppo_update(policy_states, policy_actions, rewards)
```

### 6.2 When to Use Each IL Method

| Method | Data Needed | Environment Needed | Output | Best For |
|--------|------------|-------------------|--------|----------|
| **BC** | State-action pairs | No | Policy | Quick baseline, offline data |
| **DAgger** | Expert labeler | Sim or real | Policy | Robust policy with minimal expert |
| **MaxEnt IRL** | State-action pairs | Forward planner | Reward function | Frenet cost augmentation |
| **GAIL** | Trajectories only | Simulator | Policy | Complex behavior, no feature engineering |
| **Preference Learning** | Trajectory rankings | No | Reward function | When experts can rank but not demonstrate |

---

## 7. Learning from Diverse Operators

### 7.1 The Multi-Operator Problem

Different teleoperators and safety drivers have different styles — some are aggressive, some conservative, some take wider turns, some cut corners. Naive IL averages these styles, producing a mediocre policy.

### 7.2 Style-Conditioned BC

```python
class StyleConditionedBC(nn.Module):
    """
    Learn different driving styles from labeled operators.
    
    Condition the policy on an operator style embedding.
    At deployment, select the style closest to desired behavior.
    """
    
    def __init__(self, backbone, num_styles=5, style_dim=16):
        super().__init__()
        self.backbone = backbone
        
        # Style embedding table
        self.style_embeddings = nn.Embedding(num_styles, style_dim)
        
        # Style-conditioned trajectory head
        self.head = nn.Sequential(
            nn.Linear(256 + style_dim, 256),
            nn.ReLU(),
            nn.Linear(256, 45),  # 15 waypoints × 3 (x, y, heading)
        )
    
    def forward(self, obs, style_id):
        features = self.backbone(obs)
        style = self.style_embeddings(style_id)
        combined = torch.cat([features, style], dim=-1)
        return self.head(combined).view(-1, 15, 3)
    
    def deploy(self, obs, preferred_style='conservative'):
        """At deployment, use the most conservative/safe style."""
        style_map = {
            'conservative': 0,
            'moderate': 1,
            'efficient': 2,
            'aggressive': 3,  # For time-critical operations
            'docking': 4,     # Ultra-precise, very slow
        }
        style_id = torch.tensor([style_map[preferred_style]])
        return self.forward(obs, style_id)
```

### 7.3 Operator Quality Weighting

Not all demonstrations are equally valuable:

```python
class QualityWeightedBC:
    """
    Weight demonstrations by quality metrics.
    
    Better operators get higher weight in training.
    """
    
    def compute_demo_quality(self, demonstration):
        """Score a demonstration based on safety and efficiency."""
        scores = {
            'safety': self.safety_score(demonstration),      # No close calls
            'smoothness': self.smoothness_score(demonstration), # Low jerk
            'efficiency': self.efficiency_score(demonstration), # Task completed quickly
            'compliance': self.compliance_score(demonstration), # Followed rules
        }
        
        # Weighted combination (safety-weighted for airside)
        quality = (
            0.4 * scores['safety'] +
            0.3 * scores['smoothness'] +
            0.2 * scores['efficiency'] +
            0.1 * scores['compliance']
        )
        
        return quality
    
    def filter_demonstrations(self, all_demos, min_quality=0.6):
        """Remove low-quality demonstrations before training."""
        filtered = []
        for demo in all_demos:
            quality = self.compute_demo_quality(demo)
            if quality >= min_quality:
                filtered.append((demo, quality))
        
        # Normalize weights
        total = sum(q for _, q in filtered)
        return [(demo, q / total) for demo, q in filtered]
```

---

## 8. Safety-Constrained Imitation Learning

### 8.1 The Safety Problem

Expert demonstrations may occasionally contain unsafe behaviors (near-misses, aggressive maneuvers, rule violations). The learned policy must not reproduce these.

### 8.2 Constrained BC

```python
class SafeBC:
    """
    Behavioral cloning with safety constraints.
    
    Hard constraints: filter demonstrations and post-process predictions
    Soft constraints: add safety penalty to loss function
    """
    
    def __init__(self, policy, safety_checker):
        self.policy = policy
        self.safety = safety_checker  # CBF or rule-based
    
    def filter_unsafe_demos(self, demonstrations):
        """Remove demonstration segments that violate safety constraints."""
        safe_demos = []
        for demo in demonstrations:
            safe_segments = []
            for obs, action in demo:
                if self.safety.is_safe(obs, action):
                    safe_segments.append((obs, action))
                else:
                    # Log filtered segment for analysis
                    self.log_filtered(obs, action, reason=self.safety.violation_reason)
            
            if len(safe_segments) > 10:  # Minimum segment length
                safe_demos.append(safe_segments)
        
        return safe_demos
    
    def safe_training_loss(self, pred_traj, expert_traj, obs):
        """Loss with safety penalty."""
        # Standard imitation loss
        imitation_loss = F.smooth_l1_loss(pred_traj, expert_traj)
        
        # Safety constraint violation penalty
        safety_cost = 0
        for t in range(pred_traj.shape[1]):
            waypoint = pred_traj[:, t]
            
            # Aircraft clearance
            aircraft_dist = self.safety.min_aircraft_distance(obs, waypoint)
            safety_cost += F.relu(3.0 - aircraft_dist)  # 3m minimum
            
            # Personnel clearance
            person_dist = self.safety.min_personnel_distance(obs, waypoint)
            safety_cost += F.relu(2.0 - person_dist) * 5  # 2m minimum, high weight
            
            # Speed limit
            speed = self.safety.compute_speed(pred_traj[:, max(0, t-1):t+1])
            speed_limit = self.safety.get_speed_limit(obs, waypoint)
            safety_cost += F.relu(speed - speed_limit) * 2
        
        total_loss = imitation_loss + 0.1 * safety_cost
        return total_loss
    
    def safe_inference(self, obs):
        """Post-process prediction through safety filter."""
        # Get raw prediction
        pred_traj = self.policy(obs)
        
        # CBF safety filter (from safety-critical-planning-cbf.md)
        safe_traj = self.safety.cbf_filter(pred_traj, obs)
        
        return safe_traj
```

### 8.3 Simplex Integration

The learned BC policy serves as the Advanced Controller (AC) in the Simplex architecture, with the existing Frenet planner as the Baseline Controller (BC):

```
                     ┌──────────────────────┐
Observations ────────┤  Decision Module     │
                     │  (monitor safety)    │──── Control Output
                     └────┬────────┬────────┘
                          │        │
                    ┌─────┴───┐ ┌──┴──────────┐
                    │ Learned │ │ Frenet       │
                    │ BC/IL   │ │ Planner      │
                    │ Policy  │ │ (fallback)   │
                    │ (AC)    │ │ (BC)         │
                    └─────────┘ └──────────────┘
```

Switch to Frenet planner when:
- Learned policy output violates CBF constraints
- Policy uncertainty (ensemble disagreement) exceeds threshold
- Novel ODD condition detected
- Emergency situation

---

## 9. Integration with Existing Planning Stack

### 9.1 Three Integration Modes

**Mode 1: Policy as Trajectory Generator** (replace Frenet for normal ops)
```python
# Learned policy generates trajectories, Frenet is fallback
if policy_confidence > THRESHOLD and cbf_safe(policy_trajectory):
    execute(policy_trajectory)
else:
    execute(frenet_planner.plan())
```

**Mode 2: IRL Costs for Frenet Planner** (augment, don't replace)
```python
# IRL-learned weights improve existing Frenet planner
frenet_planner.update_cost_weights(irl_learned_theta)
trajectory = frenet_planner.plan()  # Same planner, better costs
```

**Mode 3: Policy as Trajectory Scorer** (score Frenet candidates)
```python
# Frenet generates 420 candidates, learned model scores them
candidates = frenet_planner.generate_candidates(420)
for traj in candidates:
    traj.learned_score = learned_scorer.score(traj, observation)
best = max(candidates, key=lambda t: 0.5 * t.frenet_score + 0.5 * t.learned_score)
```

**Recommendation**: Start with Mode 2 (IRL + Frenet), then Mode 3 (scoring), eventually Mode 1 (full policy with Simplex).

---

## 10. Data Collection and Preparation

### 10.1 Demonstration Collection Protocol

| Phase | Duration | Data Source | Expected Volume | Purpose |
|-------|----------|------------|-----------------|---------|
| Phase 0 | Ongoing | Teleop logs (existing) | 10-50 hours | Bootstrap BC dataset |
| Phase 1 | 2 weeks | Supervised driving (dedicated collection) | 50-100 hours | High-quality labeled demos |
| Phase 2 | Ongoing | Shadow mode (automatic) | 100+ hours/month | Scale up dataset |
| Phase 3 | Ongoing | Fleet natural driving | 1000+ hours/month | Continuous improvement |

### 10.2 Data Requirements

| Method | Minimum Data | Recommended Data | Quality Requirement |
|--------|-------------|-----------------|-------------------|
| BC (baseline) | 5-10 hours | 50-100 hours | Filtered, quality-weighted |
| DAgger | 2-5 hours + 50 sim iterations | 10-20 hours + 200 iterations | Expert available for labeling |
| MaxEnt IRL | 10-20 hours | 50-100 hours | Diverse scenarios |
| GAIL | 20-50 hours | 100+ hours | Trajectory-level only |
| Diffusion BC | 20-50 hours | 100+ hours | High diversity |

---

## 11. Orin Deployment and Real-Time Inference

### 11.1 Computational Budgets

| Model | FP32 Orin | FP16 Orin | INT8 Orin | Meets 50ms? |
|-------|-----------|-----------|-----------|------------|
| BC (MLP head) | 0.5ms | 0.3ms | 0.2ms | Yes |
| BC + GRU temporal | 2ms | 1ms | 0.8ms | Yes |
| MDN (K=5) | 1ms | 0.5ms | 0.4ms | Yes |
| Diffusion (5 steps) | 50ms | 25ms | 15ms | Marginal |
| Diffusion (3 steps) | 30ms | 15ms | 10ms | Yes |
| GAIL policy | 1ms | 0.5ms | 0.4ms | Yes |

**Note**: These are policy inference times only. Total pipeline = perception + policy + safety check. Budget for policy: <5ms.

### 11.2 TensorRT Deployment

```python
# Convert trained policy to TensorRT for Orin deployment
import tensorrt as trt
import torch.onnx

# Export to ONNX
dummy_input = (
    torch.randn(1, 5, 256, 128, 128),  # BEV features (5 frames)
    torch.randn(1, 5, 8),               # Ego state
    torch.randn(1, 32),                 # Route features
)
torch.onnx.export(model, dummy_input, 'bc_policy.onnx',
                  input_names=['bev', 'ego', 'route'],
                  output_names=['trajectory'],
                  dynamic_axes={'bev': {0: 'batch'}})

# Convert to TensorRT with FP16
# trtexec --onnx=bc_policy.onnx --fp16 --saveEngine=bc_policy.engine
# Expected: <2ms inference on Orin AGX
```

---

## 12. Key Takeaways

1. **Imitation learning bridges the rule-to-expertise gap**. Hand-tuned Frenet costs capture explicit knowledge; IL captures implicit operator expertise — approach angles, timing of yielding, comfort preferences — that is hard to formalize as rules.

2. **Start with IRL for Frenet augmentation, not policy replacement**. MaxEnt IRL learns cost function weights that plug directly into the existing Frenet planner. No new controller needed. Immediate improvement with zero safety risk.

3. **BC from teleoperation logs is free data**. Every teleoperation session and supervised driving shift produces demonstration data. A 50-hour dataset is achievable within 2 weeks of dedicated collection.

4. **Distribution shift is the critical BC failure mode**. Naive BC diverges within seconds in novel states. DAgger with the Frenet planner as expert solves this at zero labeling cost (planner generates labels automatically in simulation).

5. **Multimodal BC is essential for airside**. Multiple valid paths around obstacles, different approach strategies to stands, alternative yielding behaviors. MDN or Diffusion BC avoids the averaging problem.

6. **Diffusion BC is SOTA but expensive on Orin**. 3-step DDIM: ~15ms INT8. Fits within budget only if total pipeline is carefully managed. MDN (K=5) at <1ms is more practical for near-term deployment.

7. **GAIL doesn't need state-action pairs**. Only trajectories. Useful when you have GPS tracks from human-driven GSE but no synchronized sensor data. Requires simulation environment.

8. **IRL-learned features reveal expert priorities**. Personnel clearance weights 2-3x higher than hand-tuned; aircraft clearance 1.5x higher. Experts are more cautious than engineers expect.

9. **Quality-weighted demonstration filtering is critical**. Not all operators are equally skilled. Weight demonstrations by safety score, smoothness, and efficiency. Filter out the bottom 20% of demonstrations.

10. **Style-conditioned BC handles multi-operator diversity**. Learn K=5 driving styles, select the most conservative for deployment. Enables per-scenario style selection (aggressive for time-critical pushback, conservative for general transit).

11. **Simplex provides the safety net for learned policies**. Learned policy as Advanced Controller, Frenet planner as Baseline Controller. CBF filter as intermediate check. Three layers of safety for certification.

12. **Safety constraints in training prevent learning unsafe expert behaviors**. Filter unsafe demonstration segments, add safety penalty to loss, post-process with CBF filter. Learned policy should be safer than any individual expert.

13. **BC policy inference is negligible on Orin**. MLP head <0.5ms, GRU temporal <1ms. The bottleneck is perception (15-30ms), not the policy. Even MDN and GAIL policies fit easily.

14. **DAgger with Frenet expert is the most efficient training protocol**. Unlimited expert labels (planner is deterministic), simulation provides unlimited scenarios. 200 DAgger iterations in 2-3 days of compute.

15. **Three integration modes in order of risk**: (1) IRL costs for Frenet (safe, immediate), (2) Learned scoring of Frenet candidates (moderate risk, 2-4 weeks), (3) Full policy with Simplex fallback (highest reward, 8-12 weeks to validate).

16. **50-100 hours of demonstrations bootstraps a useful policy**. Road→airside transfer with LoRA fine-tuning reduces this to 10-20 hours of airside-specific data.

17. **Implementation cost: $35-55K over 10-14 weeks**. Phase 1 (IRL + Frenet augmentation, 3-4 weeks, $10-15K), Phase 2 (BC + DAgger in sim, 4-5 weeks, $15-20K), Phase 3 (Deployment + Simplex, 3-5 weeks, $10-20K).

---

## Cost and Implementation Roadmap

| Phase | Scope | Duration | Cost | Deliverable |
|-------|-------|----------|------|-------------|
| **Phase 1** | MaxEnt IRL from teleop logs + Frenet cost augmentation | 3-4 weeks | $10-15K | Improved Frenet planner with learned costs |
| **Phase 2** | BC policy training + DAgger with Frenet expert in sim | 4-5 weeks | $15-20K | Standalone BC policy, evaluated in simulation |
| **Phase 3** | Safety filtering + Simplex integration + shadow mode validation | 3-5 weeks | $10-20K | Production-ready IL pipeline |
| **Total** | End-to-end imitation learning system | 10-14 weeks | $35-55K | Learned driving from expert demonstrations |

---

## References

### Internal Repository
- `30-autonomy-stack/planning/reinforcement-learning-driving-policy.md` — BC→offline RL→online RL pipeline, RL post-IL
- `30-autonomy-stack/planning/frenet-planner-augmentation.md` — Frenet planner cost function structure
- `30-autonomy-stack/planning/safety-critical-planning-cbf.md` — CBF safety filter for post-processing
- `operations/safety/simplex-safety-architecture.md` — Simplex AC/BC architecture
- `operations/teleoperation/teleoperation-systems.md` — Teleop data sources
- `cross-cutting/data-flywheel-airside.md` — Data collection and labeling pipeline
- `30-autonomy-stack/planning/neural-motion-planning.md` — Learned planning approaches

### External
- Ross, S., Gordon, G., & Bagnell, D. (2011). "A Reduction of Imitation Learning and Structured Prediction to No-Regret Online Learning." AISTATS.
- Ziebart, B.D. et al. (2008). "Maximum Entropy Inverse Reinforcement Learning." AAAI.
- Ho, J. & Ermon, S. (2016). "Generative Adversarial Imitation Learning." NeurIPS.
- Chi, C. et al. (2024). "Diffusion Policy: Visuomotor Policy Learning via Action Diffusion." RSS.
- Bishop, C.M. (1994). "Mixture Density Networks." Technical Report.
- Hoque, R. et al. (2021). "ThriftyDAgger: Budget-Aware Novelty and Risk Gating for Interactive Imitation Learning." CoRL.
- "Beyond Behavior Cloning in Autonomous Driving: A Survey." arXiv (2025).
- "Behavioral Cloning Models Reality Check for Autonomous Driving." arXiv (2024).
