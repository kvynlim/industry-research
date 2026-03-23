# Diffusion-Based Trajectory Planning for Autonomous Driving

## From Diffuser to DiffusionDrive: Generative Planning at Real-Time Rates

---

## Table of Contents

1. [Diffuser: Planning as Iterative Denoising](#1-diffuser-planning-as-iterative-denoising)
2. [DiffusionDrive: Truncated Diffusion with Trajectory Anchors](#2-diffusiondrive-truncated-diffusion-with-trajectory-anchors)
3. [DiffuserLite: Real-Time Diffuser for Online RL](#3-diffuserlite-real-time-diffuser-for-online-rl)
4. [Multi-Modal Trajectories: Why Diffusion Beats Regression](#4-multi-modal-trajectories-why-diffusion-beats-regression)
5. [Comparison with Classical Planning Methods](#5-comparison-with-classical-planning-methods)
6. [Conditioning Mechanisms](#6-conditioning-mechanisms)
7. [Safety and Constraint Enforcement](#7-safety-and-constraint-enforcement)
8. [Integration with World Models](#8-integration-with-world-models)
9. [Practical Deployment Engineering](#9-practical-deployment-engineering)
10. [Airside Adaptation](#10-airside-adaptation)

---

## 1. Diffuser: Planning as Iterative Denoising

### 1.1 Core Formulation (Janner et al., ICML 2022)

Diffuser (Janner, Du, Tenenbaum, Levine) introduced the foundational insight that planning can be cast as a **generative modeling problem over trajectories**. Rather than learning a policy pi(a|s) or a value function V(s), Diffuser learns a generative model p(tau) over entire trajectories tau = (s_0, a_0, s_1, a_1, ..., s_T, a_T), then samples from it to plan.

**Key insight:** A trajectory is just a data point in a high-dimensional space. If you can model the distribution of "good trajectories" from a dataset, you can sample new trajectories from that distribution -- and those samples will inherit the quality of the training data.

**Trajectory representation:**

```
tau = [s_0, a_0, s_1, a_1, ..., s_H, a_H]  (state-action pairs over horizon H)

Flattened: tau in R^{H x (dim_s + dim_a)}

This is a 2D array: rows = timesteps, columns = state/action dimensions.
The diffusion model treats this entire array as a single "image" to generate.
```

### 1.2 Architecture

Diffuser uses a **temporal U-Net** as the denoising network -- a 1D convolutional U-Net operating along the time axis of the trajectory:

```
Input: Noisy trajectory tau_k (H x D) + diffusion timestep k
                |
    [1D Conv] → [Temporal ResBlock + Attention] → [Downsample]  (encoder)
                |
    [1D Conv] → [Temporal ResBlock + Attention] → [Upsample]    (decoder)
                |
Output: Predicted noise epsilon_theta(tau_k, k)  (H x D)

Key difference from image U-Nets:
- 1D convolutions along trajectory time axis (not 2D spatial)
- Temporal attention captures long-range dependencies across planning horizon
- Skip connections preserve temporal resolution
```

The model is trained with the standard DDPM objective:

```
L = E_{k, tau_0, epsilon} [ ||epsilon - epsilon_theta(tau_k, k)||^2 ]

where tau_k = sqrt(alpha_bar_k) * tau_0 + sqrt(1 - alpha_bar_k) * epsilon
```

### 1.3 Planning via Conditional Sampling

At inference, Diffuser generates a plan by sampling from the trajectory distribution, conditioned on the current state and optionally guided toward high-reward regions.

**Step 1 -- State conditioning (inpainting):** The current observed state s_0 is fixed. After each denoising step, the first row of the trajectory is overwritten with the true current state:

```python
def plan(model, current_state, num_steps=100):
    # Start from noise
    tau_K = torch.randn(H, D)

    for k in reversed(range(K)):
        # Predict noise
        eps = model(tau_k, k)

        # Standard DDPM reverse step
        tau_{k-1} = reverse_step(tau_k, eps, k)

        # Inpainting: fix current state (constraint)
        tau_{k-1}[0, :dim_s] = current_state

    return tau_0  # planned trajectory
```

**Step 2 -- Reward guidance (classifier guidance):** To bias sampling toward high-reward trajectories, Diffuser applies classifier guidance using a separately trained reward model J(tau):

```
tau_{k-1} = reverse_step(tau_k, eps, k) + alpha * grad_{tau_k} J(tau_k)

The gradient of the reward model with respect to the trajectory
"pushes" the denoising process toward higher-reward regions.
```

This is analogous to classifier guidance in image diffusion, where the gradient of a classifier pushes generation toward a target class. Here, the "class" is "high reward."

### 1.4 No Compounding Errors

The most significant advantage of Diffuser over autoregressive planners (which predict s_{t+1} from s_t, then s_{t+2} from s_{t+1}, etc.) is the **absence of compounding errors**:

```
Autoregressive planner:
  s_1 = f(s_0) + err_1
  s_2 = f(s_1) + err_2 = f(f(s_0) + err_1) + err_2
  s_T = accumulated errors grow exponentially

Diffusion planner:
  tau = [s_0, s_1, ..., s_T] generated SIMULTANEOUSLY
  All timesteps are refined in parallel during each denoising step
  Errors don't compound because later states don't depend on earlier predictions
  Internal consistency is enforced by the diffusion model's learned distribution
```

The diffusion model learns the **joint distribution** over entire trajectories, so it generates internally consistent sequences where s_3 is consistent with s_2, not because s_3 was derived from s_2 but because the model learned what consistent trajectories look like.

### 1.5 Results and Limitations

**Results on D4RL benchmarks:**
- Competitive with or better than Decision Transformer, CQL, IQL on locomotion tasks
- Particularly strong on long-horizon tasks (Maze2D) where compounding errors hurt autoregressive methods
- Enables flexible test-time constraints without retraining (want to avoid a region? add a constraint during sampling)

**Limitations:**
- Requires ~100 denoising steps during planning (slow, ~50-200ms per plan)
- Temporal U-Net has limited capacity for complex scenes
- Reward guidance can be noisy and requires careful tuning of guidance scale
- Not real-time for high-frequency control loops (10-20 Hz driving)

---

## 2. DiffusionDrive: Truncated Diffusion with Trajectory Anchors

### 2.1 Overview (Liao et al., CVPR 2025 Highlight)

DiffusionDrive addresses the fundamental bottleneck of diffusion-based planning -- inference speed -- through two interconnected innovations: **trajectory anchors** and **truncated diffusion**. The result is a diffusion planner that runs at real-time rates (over 45 FPS) while preserving the multi-modal expressiveness that makes diffusion attractive.

**Paper:** "DiffusionDrive: Truncated Diffusion Model for End-to-End Autonomous Driving" (Liao et al., CVPR 2025 Highlight)

**Core thesis:** Standard diffusion planning starts from pure Gaussian noise and requires many denoising steps because the noise is maximally far from any reasonable trajectory. If instead you start from a good initial guess (an "anchor trajectory"), only a few refinement steps are needed.

### 2.2 Trajectory Anchor Pre-Computation

**Step 1 -- Collect training trajectories:** Extract all ego-vehicle trajectories from the training dataset (e.g., nuScenes). Each trajectory is a sequence of future waypoints: tau = [(x_1, y_1), (x_2, y_2), ..., (x_T, y_T)] in the ego-vehicle coordinate frame, typically covering 3 seconds at 2 Hz (6 waypoints) or 4 seconds at 2 Hz (8 waypoints).

**Step 2 -- K-means clustering:** Run K-means on the collected trajectories to identify K representative trajectory modes:

```
Training trajectories: {tau_1, tau_2, ..., tau_N}  (N ~ 28,000 for nuScenes train set)

K-means with K = 512 (or 256, 1024 -- ablated):
  Cluster centers: {a_1, a_2, ..., a_K}  (the "anchors")

Each anchor a_i represents a prototypical driving maneuver:
  - Straight driving at various speeds
  - Left/right lane changes
  - Left/right turns of various radii
  - Stopping / decelerating
  - Accelerating from stop
```

**Step 3 -- Anchor bank:** The K anchor trajectories are stored as a fixed lookup table in the model. At inference, the model selects and refines anchors rather than generating trajectories from scratch.

**Why K=512:** The authors ablated K in {64, 128, 256, 512, 1024}. Performance improves with K up to 512, then plateaus. K=512 provides sufficient coverage of the trajectory space while keeping the anchor bank manageable. Each anchor is 6x2 = 12 floats, so the entire bank is 512 x 12 = 6,144 floats (24 KB).

### 2.3 Truncated Diffusion Process

**Standard diffusion** starts from timestep T (pure noise) and denoises to timestep 0 (clean trajectory):

```
Standard: tau_T ~ N(0, I) → tau_{T-1} → ... → tau_1 → tau_0
          T steps needed (typically T=100-1000)
```

**Truncated diffusion** starts from a much lower noise level T' << T:

```
Truncated: tau_{T'} = sqrt(alpha_bar_{T'}) * anchor + sqrt(1 - alpha_bar_{T'}) * epsilon
           → tau_{T'-1} → ... → tau_1 → tau_0
           Only T' steps needed (T' = 2-5)
```

The key: because the anchor is already close to a plausible trajectory, you only need to add a small amount of noise (low T') and then denoise for a few steps to refine it into a situation-specific plan.

**How anchors are selected at inference:**

```
1. Scene encoder (e.g., sparse transformer over BEV features) produces
   a scene embedding z_scene

2. An anchor selection head predicts a score for each of the K anchors:
   scores = MLP(z_scene) -> R^K

3. Top-N anchors are selected (N = 1 in simplest case, N = 16 for diversity)

4. Each selected anchor is noised to level T' and denoised in parallel

5. The trajectory with the lowest cost (or highest confidence) is selected
```

### 2.4 Architecture Details

DiffusionDrive's full pipeline:

```
Multi-view camera images
        |
  [Image backbone (e.g., ResNet-50 or Swin-T)]
        |
  [BEV encoder (LSS / BEVFormer-style)]
        |
  [Scene encoder / sparse transformer]  →  Scene embedding z_scene
        |                                        |
  [Anchor selector]                     [Denoising network]
   Picks top-N anchors                  Refines noised anchors
        |                                        |
  [Noise anchors to level T']          [T' denoising steps]
        |                                        |
        +----------→  [Merge]  ←-----------------+
                          |
                 [Score & select best]
                          |
                   Final trajectory tau_0
```

**Denoising network:** A lightweight MLP-based or small transformer denoiser that takes:
- Noised trajectory tau_k (H x 2 waypoints)
- Diffusion timestep k
- Scene embedding z_scene (cross-attention or concatenation)

And predicts the noise or the clean trajectory directly (x_0-prediction parameterization is preferred for the few-step regime).

### 2.5 Measured Performance

**NAVSIM benchmark results (nuScenes-based):**

| Method | PDMS Score | Latency (ms) | FPS |
|--------|-----------|--------------|-----|
| Vanilla diffusion (100 steps) | ~80 | ~300 | ~3 |
| DiffusionDrive (5 steps) | 88.1 | ~15 | ~67 |
| DiffusionDrive (2 steps) | 86.6 | ~8 | ~125 |
| SparseDrive (regression) | 84.3 | ~12 | ~83 |
| UniAD (regression) | 81.5 | ~40 | ~25 |
| VAD (regression) | 80.2 | ~30 | ~33 |

**Key findings:**
- DiffusionDrive achieves state-of-the-art planning quality (PDMS 88.1) while being faster than most regression-based methods
- With only 2 denoising steps, quality drops marginally (88.1 to 86.6) but latency is halved
- Vanilla diffusion with 100 steps is 20x slower for only marginally different quality
- The anchor mechanism provides a 10-20x speedup over standard diffusion planning

**Comparison with vanilla diffusion policy (no anchors):**

| Configuration | Steps | PDMS | Latency |
|---------------|-------|------|---------|
| Full diffusion (no anchors) | 100 | 79.8 | ~300ms |
| Full diffusion (no anchors) | 20 | 77.2 | ~60ms |
| Full diffusion (no anchors) | 5 | 68.4 | ~15ms |
| Truncated + anchors | 5 | 88.1 | ~15ms |
| Truncated + anchors | 2 | 86.6 | ~8ms |

The comparison is striking: at 5 steps, vanilla diffusion collapses (68.4) because pure noise cannot be resolved in so few steps. Truncated diffusion with anchors at 5 steps achieves 88.1 because the starting point is already informative.

### 2.6 Why It Works: Geometric Intuition

```
Trajectory space (simplified 2D visualization):

Standard diffusion:
  Start: random point in trajectory space (noise) ............... X
  Need many steps to navigate to the data manifold            /
                                                             /
  Data manifold of good trajectories:    ~~~~~~~~~/~~~~~~~~~

Truncated diffusion with anchors:
  Anchors sit ON the data manifold:       ~~*~~*~~*~~*~~*~~
  Add small noise: move slightly off:     ~·*·~·*·~·*·~·*·~
  Need only 2-5 steps to snap back onto manifold

The closer the starting point is to the data manifold,
the fewer denoising steps are needed.
```

---

## 3. DiffuserLite: Real-Time Diffuser for Online RL

### 3.1 Motivation and Approach

DiffuserLite (Dong et al., NeurIPS 2024) tackles the same latency problem as DiffusionDrive but from the reinforcement learning side. While DiffusionDrive uses trajectory anchors to reduce denoising steps, DiffuserLite introduces a **plan refinement** approach that reuses and refines the previous planning cycle's output.

**Core idea:** In a real-time control loop, consecutive planning calls are temporally close. The trajectory planned at timestep t is a good starting point for the plan at timestep t+1 (shifted by one time step). Instead of generating a new trajectory from scratch each cycle, refine the previous plan.

### 3.2 Architecture and Efficiency Optimizations

```
Standard Diffuser planning loop:
  t=0: tau_0 = denoise(noise, 100 steps)       [100 steps]
  t=1: tau_1 = denoise(noise, 100 steps)       [100 steps]
  t=2: tau_2 = denoise(noise, 100 steps)       [100 steps]
  Total: 300 denoising steps for 3 planning cycles

DiffuserLite planning loop:
  t=0: tau_0 = denoise(noise, 20 steps)         [20 steps, cold start]
  t=1: tau_1 = denoise(shift(tau_0), 4 steps)   [4 steps, warm start]
  t=2: tau_2 = denoise(shift(tau_1), 4 steps)   [4 steps, warm start]
  Total: 28 denoising steps for 3 planning cycles (10x fewer)
```

**Key optimizations:**

1. **Temporal shifting and reuse:** When the ego moves forward by one timestep, the previous trajectory is shifted forward (drop the first waypoint, extrapolate the last) and used as the starting point for the next denoising cycle.

2. **Adaptive step scheduling:** More denoising steps for the initial plan (cold start) and fewer for subsequent refinements (warm starts), since the shifted previous plan is already close to optimal.

3. **Lightweight denoiser:** A smaller U-Net or MLP replaces the full temporal U-Net used in Diffuser, reducing per-step compute.

4. **State-conditioned truncation:** The noise level for the warm-start is adapted based on how much the scene has changed -- large scene changes trigger more denoising steps, stable scenes use fewer.

### 3.3 Results

On D4RL benchmarks (locomotion and maze navigation), DiffuserLite achieves:
- Comparable asymptotic performance to full Diffuser
- 5-10x faster inference (suitable for real-time control at 10+ Hz)
- Better suited for online RL settings where planning must be fast

**Connection to DiffusionDrive:** DiffuserLite's plan-refinement idea is complementary to DiffusionDrive's anchor approach. In principle, both can be combined: use trajectory anchors for the cold start, then refine the previous plan for subsequent cycles. This would yield the fastest possible diffusion planner.

---

## 4. Multi-Modal Trajectories: Why Diffusion Beats Regression

### 4.1 The Mode Collapse Problem

Direct regression planners (e.g., UniAD, VAD, SparseDrive) output a single trajectory by minimizing L2 loss against ground truth:

```
L = ||tau_pred - tau_gt||^2

Problem: When multiple valid futures exist, the optimal L2 prediction
is the MEAN of all valid futures -- which may itself be INVALID.

Example: T-intersection, vehicle can go left or right

                    left trajectory
                   /
  ego →  --------+
                   \
                    right trajectory

L2-optimal prediction: go STRAIGHT (mean of left and right)
But going straight crashes into the median!

The regression model predicts the average of valid modes,
which is itself in an invalid region of trajectory space.
```

### 4.2 How Diffusion Captures Multi-Modality

Diffusion models are **generative** -- they model the full distribution p(tau), not just its mean. Drawing multiple samples yields diverse, individually valid trajectories:

```
Sample 1: tau_1 ~ p(tau | scene)  →  turn left
Sample 2: tau_2 ~ p(tau | scene)  →  turn right
Sample 3: tau_3 ~ p(tau | scene)  →  turn left (slightly different)
Sample 4: tau_4 ~ p(tau | scene)  →  stop and wait

Each sample is a complete, internally consistent trajectory.
No sample is the invalid "mean trajectory."
```

**Mechanism:** The stochasticity comes from the random noise used to initialize the denoising process. Different noise realizations lead to different modes of the trajectory distribution. The diffusion model has learned that both left-turn and right-turn trajectories are valid at a T-intersection, and the random seed determines which mode is reached.

### 4.3 Comparison with Other Multi-Modal Approaches

| Approach | Multi-modality mechanism | Pros | Cons |
|----------|------------------------|------|------|
| **Regression** | None (single output) | Fast, simple | Mode collapse |
| **Mixture of experts** | K fixed heads predict K trajectories | Captures K modes | Fixed K, mode assignment unstable |
| **CVAE** | Latent variable z sampled from prior | Continuous latent space | Posterior collapse, training instability |
| **GAN** | Generator noise z | Can produce diverse samples | Mode collapse in training, unstable |
| **Diffusion** | Denoising from random noise | True distribution modeling, stable training | Slow inference (addressed by truncation) |
| **Flow matching** | ODE transport from noise | Fewer steps than diffusion, stable | Newer, less explored for planning |

Diffusion has the most principled multi-modality of all approaches. Unlike mixture models (which must choose K upfront) or CVAEs (which suffer from posterior collapse), diffusion models naturally capture the full complexity of the trajectory distribution, including rare modes.

### 4.4 DiffusionDrive's Multi-Modal Mechanism

DiffusionDrive captures multi-modality through **both** the anchor bank and the denoising process:

```
Multi-modality in DiffusionDrive:

Layer 1 -- Anchor diversity:
  K=512 anchors span the space of driving maneuvers.
  The anchor selector picks the top-N (e.g., N=16) anchors most
  relevant to the current scene.
  These N anchors already represent N distinct trajectory modes.

Layer 2 -- Denoising stochasticity:
  Each of the N selected anchors is noised with random epsilon.
  Different noise realizations can push the denoised result into
  different sub-modes within each anchor's basin of attraction.

Result: N anchors x stochastic denoising = rich multi-modal coverage
```

---

## 5. Comparison with Classical Planning Methods

### 5.1 Frenet Trajectory Generation

The Werling (2010) Frenet planner (detailed in `frenet-planner-augmentation.md`) generates trajectories by sampling terminal states in a curvilinear frame:

```
                Frenet Planner          Diffusion Planner
Representation  Quintic polynomials     Free-form waypoints
Candidate gen.  Grid sampling in        Sampling from learned
                (d, T, v) space         distribution p(tau)
Expressiveness  Limited by polynomial   Can represent any
                degree (smooth only)    trajectory shape
Multi-modality  Exhaustive enumeration  Inherent in generative
                (175-800 candidates)    model (N samples)
Scene context   Hand-crafted costs      Learned from data
Road structure  Requires reference      Can work road-free
                path (centerline)       (BEV features)
Guarantees      Kinematic feasibility   No hard guarantees
                by construction         (must post-filter)
Compute         <10ms (C++)             5-300ms (GPU)
Interpretable   Yes (cost weights)      Partially (anchors help)
```

**Key tradeoff:** Frenet planners are fast, interpretable, and provide kinematic guarantees by construction, but are limited in expressiveness and require extensive hand-tuning of cost weights. Diffusion planners are more expressive and learn costs from data, but are slower and provide no formal guarantees.

### 5.2 Model Predictive Control (MPC)

```
                MPC                     Diffusion Planner
Formulation     Optimization problem    Generative sampling
                min J(u) s.t. g(u)<=0  sample tau ~ p(tau|scene)
Horizon         Receding horizon        Full horizon at once
                (re-solve each step)    (but can warm-start)
Dynamics        Explicit model needed   Learned implicitly
                (bicycle model etc.)    from trajectory data
Constraints     Hard constraints via    Soft constraints via
                optimization            guidance / post-filter
Multi-modality  Single optimal sol.     Multiple samples
                (unless multi-start)    naturally diverse
Compute         5-50ms (QP solver)      5-300ms (GPU)
Online adapt.   Re-solve each step      Re-denoise each step
Guarantees      Constraint satisfaction No formal guarantees
                if solver converges
```

**Key insight:** MPC and diffusion planning are actually complementary. MPC excels at enforcing hard constraints (stay in lane, don't exceed acceleration limits) but struggles with complex scenes and multi-modality. Diffusion excels at modeling complex scene-dependent behavior but struggles with hard constraints. A hybrid approach -- diffusion for candidate generation, MPC for constraint enforcement and refinement -- combines the best of both.

### 5.3 Tree Search (MCTS)

```
                MCTS                    Diffusion Planner
Search space    Discrete action tree    Continuous trajectory
                (branch factor B,       space
                depth D: B^D nodes)
Evaluation      Rollout + value fn.     Implicit in learned
                                        distribution
Multi-modality  Exhaustive search       Generative sampling
                (exponential cost)      (linear cost in N)
Compute         Exponential in depth    Linear in num. steps
                (MCTS-constrained)      and num. samples
Quality         Depends on rollout      Depends on training
                policy and value fn.    data quality
```

**Tree search has a combinatorial explosion problem** that diffusion avoids. MCTS must explore exponentially many branches, while diffusion samples trajectories in constant time per sample. However, MCTS provides stronger guarantees about coverage of the action space when given sufficient compute budget.

### 5.4 Summary Table

| Criterion | Frenet | MPC | MCTS | Regression | Diffusion |
|-----------|--------|-----|------|------------|-----------|
| Multi-modality | Enum. | Single | Search | None | Native |
| Latency | <10ms | 5-50ms | 50-500ms | 2-10ms | 5-300ms |
| Hard constraints | Yes | Yes | Via pruning | No | No* |
| Data-driven | Partial | No | Partial | Yes | Yes |
| Expressiveness | Low | Medium | High | High | High |
| Interpretability | High | High | Medium | Low | Medium |
| Real-time ready | Yes | Yes | Difficult | Yes | With truncation |

*Diffusion can incorporate constraints via guidance or constrained sampling (see Section 7).

---

## 6. Conditioning Mechanisms

### 6.1 Ego Goal Conditioning

The simplest conditioning: specify where the ego vehicle should end up.

```
Goal conditioning via inpainting:
  Fix the last waypoint of the trajectory to the goal position:
  tau[H, :2] = (x_goal, y_goal)

  After each denoising step, overwrite the terminal state.
  The diffusion model fills in the intermediate waypoints
  to create a smooth, feasible path to the goal.

Goal conditioning via cross-attention:
  Encode goal as a token: g = MLP(x_goal, y_goal)
  Cross-attend trajectory tokens to goal token in denoiser
  Softer than inpainting -- allows model to "negotiate" with goal
```

DiffusionDrive uses goal conditioning implicitly through the scene encoder, which processes the navigation command (e.g., "turn left at next intersection") and produces a scene embedding that biases anchor selection and denoising.

### 6.2 Traffic Rule Conditioning

```
Rule types and encoding:
  - Speed limits:    v_max → continuous scalar
  - Traffic lights:  {red, yellow, green} → one-hot
  - Stop signs:      distance to stop line → scalar
  - Right of way:    {ego_has_priority, yield} → binary
  - Lane constraints: allowed lane boundaries → polylines

Encoding approach:
  Rule vector r = [v_max, light_state, stop_dist, priority, ...]
  Condition denoiser: epsilon_theta(tau_k, k, z_scene, r)

  Alternatively, encode rules as cost penalties in guidance:
  J_rules(tau) = -lambda_speed * max(0, v(tau) - v_max)^2
                 -lambda_stop * penalty_if_not_stopped_at_sign
                 -lambda_lane * penalty_if_outside_lane

  Apply via classifier guidance:
  tau_{k-1} += alpha * grad_tau J_rules(tau_k)
```

### 6.3 World Model Prediction Conditioning

The most powerful conditioning for safety-critical driving: condition the planner on predictions of how the world will evolve.

```
World model provides:
  - Future occupancy grids O_{t+1:t+H}
  - Predicted agent trajectories {tau_agent_i}
  - Risk maps / collision probability maps

Conditioning approaches:

1. Feature concatenation:
   Concatenate world model features with scene embedding:
   z_combined = [z_scene; z_world_pred]
   Use z_combined as condition for denoiser

2. Cross-attention:
   Trajectory tokens cross-attend to future occupancy tokens
   Allows fine-grained spatial reasoning about future obstacles

3. Guidance (test-time):
   J_collision(tau) = -sum_t C(tau_t, O_{t})
   where C measures collision cost at each timestep
   Gradient guidance pushes trajectory away from predicted occupancy
```

### 6.4 Language Instruction Conditioning

For systems that accept natural language commands (e.g., "pull over to the right shoulder"):

```
Language encoding:
  instruction = "pull over to the right shoulder"
  z_lang = LanguageEncoder(instruction)  (CLIP, BERT, etc.)

Conditioning:
  Cross-attention between trajectory tokens and language tokens
  The denoiser learns to generate trajectories that match
  the semantic content of the instruction

Examples:
  "follow the vehicle ahead"  → generates car-following trajectory
  "change to left lane"       → generates lane-change trajectory
  "stop at the crosswalk"     → generates deceleration + stop trajectory
```

This is particularly relevant for VLA (Vision-Language-Action) approaches to driving, where language provides a flexible interface for specifying high-level driving intent.

### 6.5 Classifier-Free Guidance for Planning

Adapting classifier-free guidance (CFG) from image generation to trajectory planning:

```
Training:
  With probability p=0.1, drop the scene condition:
    epsilon_theta(tau_k, k, empty)  -- unconditional
  Otherwise:
    epsilon_theta(tau_k, k, z_scene)  -- conditional

Inference:
  eps_guided = (1 + w) * eps_conditional - w * eps_unconditional

  w = guidance scale:
    w = 0: pure conditional (standard generation)
    w = 1-3: moderate guidance (higher fidelity to condition)
    w > 3: strong guidance (may reduce diversity)
```

CFG for planning provides a knob to trade off between trajectory diversity (low w) and condition adherence (high w). Low w produces diverse multi-modal trajectories; high w produces trajectories that strictly follow the conditioning signal.

---

## 7. Safety and Constraint Enforcement

### 7.1 The Challenge

Diffusion planners generate trajectories by sampling from a learned distribution. Unlike MPC (which solves a constrained optimization) or Frenet planners (which filter infeasible candidates), diffusion has no built-in mechanism to guarantee that sampled trajectories satisfy hard safety constraints.

**Critical constraints for driving:**
- No collision with any object
- Stay within lane boundaries (or road boundaries)
- Respect kinematic limits (max curvature, max acceleration)
- Maintain minimum following distance
- Obey traffic signals

### 7.2 Guidance-Based Constraint Enforcement

Use the gradient of a constraint violation function to steer denoising away from constraint-violating regions:

```
Safety cost function:
  J_safety(tau) = -lambda_col * CollisionCost(tau)
                  -lambda_lane * LaneBoundaryCost(tau)
                  -lambda_kin * KinematicViolationCost(tau)

At each denoising step:
  tau_{k-1} = reverse_step(tau_k, eps, k) + alpha * grad_tau J_safety(tau_k)

CollisionCost(tau) = sum_t max(0, safety_margin - dist(tau_t, nearest_obstacle))^2
LaneBoundaryCost(tau) = sum_t max(0, lateral_offset(tau_t) - lane_width/2)^2
KinematicViolationCost(tau) = sum_t max(0, curvature(tau_t) - kappa_max)^2
```

**Pros:** No retraining needed, constraints can be changed at test time.
**Cons:** Soft enforcement -- gradient guidance reduces but does not eliminate violations. High guidance scales distort the trajectory distribution.

### 7.3 Constrained Diffusion Sampling

More principled approaches that enforce constraints within the diffusion framework:

**Projection-based methods:**

```
After each denoising step, project the trajectory onto the feasible set:

  tau_{k-1} = Project_C(reverse_step(tau_k, eps, k))

  where Project_C is the projection onto constraint set C:
    - Clip speeds to [0, v_max]
    - Clip curvatures to [-kappa_max, kappa_max]
    - Move waypoints that collide with obstacles to nearest free space

  This is exact for convex constraints but approximate for non-convex ones
  (collision avoidance is non-convex in general).
```

**Manifold-constrained diffusion (MCDiff):**

Train the diffusion model with constraints baked into the denoising process. The score function learns to predict noise that, when removed, always produces feasible trajectories. This requires training-time knowledge of constraints but provides stronger guarantees.

**Safety filtering (post-hoc):**

```
1. Sample N trajectories from diffusion model
2. Check each for constraint violations
3. Discard violating trajectories
4. Select best from remaining feasible set

If all N violate constraints:
  Fall back to a safe default trajectory (e.g., emergency stop)

This is the simplest approach and provides hard guarantees
at the cost of potentially rejecting all samples.
```

### 7.4 Simplex Architecture Integration

For safety-critical deployment, diffusion planners should operate within a **simplex safety architecture** (detailed in `../../operations/safety/simplex-safety-architecture.md`):

```
                    ┌─────────────────┐
                    │  Diffusion       │
                    │  Planner         │ ← "Advanced Controller"
                    │  (performance)   │
                    └────────┬────────┘
                             │
                    ┌────────v────────┐
                    │  Safety Monitor  │ ← checks constraints
                    │  (collision,     │
                    │   kinematic,     │
                    │   boundary)      │
                    └────────┬────────┘
                        pass │ fail
                    ┌────────v────────┐
              pass→ │ Execute          │
                    │ diffusion plan   │
                    └─────────────────┘
              fail→ ┌─────────────────┐
                    │  Fallback        │ ← "Baseline Controller"
                    │  Planner         │    (Frenet / MPC)
                    │  (guaranteed     │
                    │   safe)          │
                    └─────────────────┘

The diffusion planner proposes trajectories.
The safety monitor checks hard constraints.
If constraints are violated, a proven-safe fallback planner takes over.
```

This architecture lets the diffusion planner handle the "99% case" (complex scenes, multi-modal decisions) while the fallback handles the safety-critical edge cases with formal guarantees.

---

## 8. Integration with World Models

### 8.1 Diffusion Planner + Occupancy World Model

The most natural integration pairs a diffusion planner with an occupancy prediction world model (see `../../technology/world-models/occupancy-world-models.md`):

```
Pipeline:

1. Perception → BEV features + 3D occupancy grid (current)

2. World model (e.g., OccWorld, UnO) predicts future occupancy:
   O_{t+1}, O_{t+2}, ..., O_{t+H}

3. Diffusion planner generates N candidate trajectories:
   tau_1, tau_2, ..., tau_N ~ p(tau | z_scene)

4. Score each trajectory against predicted occupancy:
   Score(tau_i) = -sum_t Collision(tau_i[t], O_{t})
                  + Comfort(tau_i) + Progress(tau_i)

5. Select: tau* = argmax_i Score(tau_i)
```

**Why this works well:** The world model captures how the environment evolves (other vehicles moving, pedestrians crossing), and the diffusion planner generates trajectories that navigate through these predicted futures. The planner doesn't need to explicitly predict other agents' behavior -- it just avoids predicted occupied space.

### 8.2 DiffusionDrive + OccWorld Combination

A particularly promising combination for end-to-end driving:

```
Shared BEV backbone
        |
   ┌────┴────┐
   v         v
OccWorld    DiffusionDrive
(predict    (generate
 future      candidate
 occupancy)  trajectories)
   |         |
   └────┬────┘
        v
  Score trajectories
  against predicted
  occupancy
        |
        v
  Best trajectory
  → control
```

**Shared BEV backbone:** Both OccWorld and DiffusionDrive can share the same BEV feature encoder, amortizing the cost of perception. OccWorld adds a temporal diffusion head that predicts future occupancy grids. DiffusionDrive adds the anchor selection and trajectory denoising heads. The total overhead over a single-task model is modest.

**OccWorld specifics (Zheng et al., ECCV 2024):** OccWorld predicts future 3D occupancy using a GPT-like world model that autoregressively generates future occupancy tokens. It can predict 4D occupancy up to 2 seconds ahead and jointly plan ego trajectories. Combining OccWorld's predictions with DiffusionDrive's multi-modal trajectory generation yields a system that can reason about multiple possible futures and plan diverse responses.

### 8.3 Scoring Trajectories Against World Model Predictions

```
Detailed scoring function:

Score(tau, O_{1:H}) = w_col * CollisionScore(tau, O_{1:H})
                    + w_prog * ProgressScore(tau)
                    + w_comf * ComfortScore(tau)
                    + w_rule * RuleScore(tau)

CollisionScore(tau, O):
  For each timestep t:
    Compute ego vehicle footprint at tau[t]
    Check overlap with occupied voxels in O[t]
    Score = -sum of occupancy probabilities in footprint
  Penalizes trajectories that pass through predicted occupied space

ProgressScore(tau):
  Score = distance along route achieved by trajectory
  Rewards forward progress toward goal

ComfortScore(tau):
  Score = -integral(jerk^2) - penalty(lateral_accel)
  Penalizes jerky or uncomfortable trajectories

RuleScore(tau):
  Score = -penalty(speed_violation) - penalty(signal_violation)
  Penalizes traffic rule violations
```

### 8.4 Using World Model Gradients for Guidance

For differentiable world models, gradients can flow from the world model back through the planner:

```
1. Generate trajectory tau from diffusion planner
2. Run world model conditioned on tau: O = WorldModel(z_scene, tau)
3. Compute cost: C = CollisionCost(tau, O)
4. Backprop: grad_tau C flows back through world model and into planner
5. Use gradient to guide denoising: tau_{k-1} += -alpha * grad_tau C

This creates a closed loop where:
  - Planner proposes trajectory
  - World model predicts consequences
  - Gradient tells planner how to improve
  - Planner adjusts in next denoising step
```

This is the most tightly integrated approach and requires the entire pipeline (world model + planner) to be differentiable. It's the end-state architecture for end-to-end differentiable driving systems.

---

## 9. Practical Deployment Engineering

### 9.1 TensorRT Export of Diffusion Planners

Deploying diffusion planners on embedded hardware requires careful optimization:

```
Export pipeline:

1. Train diffusion planner in PyTorch (float32)

2. Separate the model into exportable components:
   a. BEV encoder (image backbone + LSS)     → TensorRT engine
   b. Scene encoder (transformer)             → TensorRT engine
   c. Anchor selector (MLP)                   → TensorRT engine
   d. Denoiser (MLP or small transformer)     → TensorRT engine

3. Each denoising step is a separate TensorRT inference call:
   For step k = T', T'-1, ..., 0:
     eps = denoiser_engine.infer(tau_k, k, z_scene)
     tau_{k-1} = reverse_step(tau_k, eps, k)

4. Optimization tricks:
   - FP16 for denoiser (2x speedup, minimal quality loss)
   - INT8 quantization for BEV encoder if quantization-aware trained
   - Batch all N anchors into a single inference call
   - Pre-compute anchor noise at each truncation level
```

**Why the denoiser is easy to export:** Unlike image diffusion models (which use large U-Nets with dynamic shapes), trajectory diffusion models have tiny, fixed-shape denoisers. A denoiser for 6-waypoint trajectories takes a (6x2 + 1 + D_scene) input and outputs (6x2). This is just an MLP, trivially exportable to TensorRT.

### 9.2 Latency on NVIDIA Orin

Estimated latency breakdown for DiffusionDrive on Orin AGX (275 TOPS INT8, 138 TFLOPS FP16):

```
Component               FP32 (ms)    FP16 (ms)    INT8 (ms)
BEV encoder (ResNet-50)    25           12            8
Scene encoder (sparse)     10            5            3
Anchor selector             1           0.5          0.3
Denoiser (per step)         2            1           0.7
  x 5 steps               10            5           3.5
Scoring + selection         1           0.5          0.5
─────────────────────────────────────────────────────────
Total                      47           23           15

At FP16 with 5 denoising steps: ~23ms → 43 Hz
At FP16 with 2 denoising steps: ~19ms → 52 Hz
At INT8 with 2 denoising steps: ~13ms → 77 Hz

For comparison, typical AV planning runs at 10-20 Hz.
Even the conservative FP32 estimate meets the 20 Hz requirement.
```

**Orin NX (100 TOPS INT8):** Roughly 2x the latency of Orin AGX. FP16 with 2 steps would be ~38ms (26 Hz), still real-time.

### 9.3 Handling Iterative Nature at Real-Time Rates

The iterative denoising process poses a challenge for real-time systems because the latency depends on the number of steps:

```
Strategy 1: Fixed step budget
  Always use exactly N=2 (or N=5) denoising steps.
  Predictable, constant latency. Easiest to schedule in a real-time OS.
  Trade-off: slightly lower quality in complex scenes.

Strategy 2: Adaptive step budget (DiffuserLite-inspired)
  Simple scenes (straight road): N=1-2 steps
  Complex scenes (intersection): N=3-5 steps
  Scene complexity estimated from BEV feature entropy or anchor selector confidence.
  Pro: better quality when needed. Con: variable latency.

Strategy 3: Warm-starting across planning cycles
  Reuse and refine previous plan (DiffuserLite approach):
  Cycle 1: cold start, N=5 steps
  Cycle 2+: warm start from shifted previous plan, N=1-2 steps
  Average latency dominated by warm starts.

Strategy 4: Asynchronous planning
  BEV encoder runs at 10 Hz (every 100ms)
  Denoiser runs asynchronously, returning results when ready
  Safety monitor uses most recent valid plan
  If denoiser is slow, previous plan is still being executed

For airside (max 25 km/h): even 5 Hz planning (200ms) is acceptable
because the vehicle moves <1.4 m per planning cycle.
```

### 9.4 Memory Footprint

```
Component                  Parameters    Memory (FP16)
BEV encoder (ResNet-50)      25M           50 MB
Scene encoder (sparse)       10M           20 MB
Anchor bank (512x12)         6K            12 KB
Denoiser (MLP, 3 layers)     2M            4 MB
───────────────────────────────────────────────────
Total                        ~37M          ~74 MB

Fits comfortably in Orin's 32-64 GB unified memory.
The denoiser is trivially small -- the BEV encoder dominates.
```

---

## 10. Airside Adaptation

### 10.1 Defining Airside Trajectory Anchors

Airport airside operations have a distinct set of driving maneuvers compared to on-road driving. The trajectory anchor bank should be designed to reflect these:

```
Airside maneuver categories (proposed anchor clustering):

1. STRAIGHT (various speeds)
   - Taxiway traversal at 15-25 km/h
   - Service road cruising at 10-15 km/h
   - Slow approach at 3-5 km/h

2. TURN (various radii)
   - 90-degree taxiway intersection turns
   - Wide sweeping turns on perimeter roads
   - Tight turns around stand corners (5-10m radius)

3. DOCK / APPROACH
   - Final approach to aircraft stand (precision alignment)
   - Approach to loading position (align with cargo door)
   - Approach to charging station or parking bay

4. REVERSE
   - Backing into stand positions
   - Reversing from under-wing areas
   - Three-point turns in constrained areas

5. YIELD / STOP
   - Stopping for crossing aircraft
   - Yielding to pushback operations
   - Emergency stop (rapid deceleration)
   - Holding at hold-short lines

6. LANE CHANGE / MERGE
   - Moving to pass slower GSE
   - Merging from apron to service road
   - Entering/exiting active runway crossing areas

Proposed K values:
  K = 128: Adequate for a single airport with limited maneuver diversity
  K = 256: Good coverage for multi-airport deployment
  K = 512: Full coverage including rare maneuvers (emergency, unusual turns)
```

### 10.2 Training Data Collection for Anchors

```
Sources of airside trajectory data:

1. Human-driven GSE logs (primary source):
   Record RTK-GPS trajectories of human-driven baggage tractors,
   belt loaders, etc. over several months at the target airport.
   Filter for quality (smooth, safe trajectories only).
   Expected yield: 10,000-50,000 trajectory segments per airport.

2. Shadow mode data:
   Once the AV is operating in shadow mode (safety driver in control),
   record the human driver's trajectories.
   Higher quality than general GSE logs (consistent vehicle platform).

3. Simulation data:
   Generate synthetic trajectories in CARLA or airport-specific simulator.
   Useful for rare maneuvers (emergency stops, unusual configurations).
   Must be validated against real-world distribution.

4. Cross-airport transfer:
   Anchor banks from one airport can be transferred to another
   because fundamental maneuvers (straight, turn, dock) are universal.
   Airport-specific anchors (e.g., unusual stand geometries) are added
   through fine-tuning K-means with local data.
```

### 10.3 Adapting DiffusionDrive for Low-Speed Structured Environments

Airport airside is a **low-speed, highly structured** environment -- fundamentally different from highway/urban driving in several ways that affect diffusion planner design:

```
Adaptation 1: Trajectory representation
  Highway: 3s horizon at 30 m/s = 90m traveled, 2 Hz = 6 waypoints
  Airside: 3s horizon at 5 m/s = 15m traveled, 4 Hz = 12 waypoints

  Use HIGHER temporal resolution (4-5 Hz) because:
  - Low speeds mean less distance per waypoint
  - Precision docking requires fine-grained waypoints
  - Can afford more waypoints because computational budget is ample

Adaptation 2: Coordinate system
  Highway: ego-centric, forward-facing
  Airside: ego-centric but must support ALL headings including reverse

  Include heading angle theta in waypoints: tau_t = (x, y, theta)
  This is critical for reverse maneuvers and precision docking.

Adaptation 3: Speed profile
  Highway: speed varies 0-130 km/h, mostly high-speed
  Airside: speed varies 0-25 km/h, mostly 5-15 km/h

  The anchor bank should have fine granularity at low speeds:
  - 0-1 km/h: docking precision maneuvers
  - 1-5 km/h: stand area operations
  - 5-15 km/h: service road cruising
  - 15-25 km/h: taxiway traversal

Adaptation 4: Conditioning on airport-specific context
  Additional conditioning signals beyond standard driving:
  - Aircraft presence and type at nearby stands
  - Pushback zones (active/inactive)
  - Jet blast zones (dynamic, depends on engine state)
  - Hold-short lines and restricted areas
  - Turnaround phase (determines which GSE is active where)

  Encode these as additional tokens in the scene embedding:
  z_scene = BEV_features + airport_context_tokens

Adaptation 5: Safety margins
  Airside safety margins are LARGER than on-road:
  - 5m minimum from active aircraft
  - 3m from other GSE
  - 10m from engine intake zones
  - 25m from jet blast zones (behind active engines)

  These inflate the "obstacle" representation used for
  collision checking and guidance-based constraint enforcement.
```

### 10.4 Integration Architecture for Airside

```
Complete airside diffusion planning stack:

  ┌───────────────────────────────────────────────┐
  │              Sensor Suite                      │
  │  Cameras + LiDAR + RTK-GPS + Airport Data Feed│
  └──────────────────┬────────────────────────────┘
                     │
  ┌──────────────────v────────────────────────────┐
  │  BEV Encoder + Occupancy Network              │
  │  (shared backbone)                             │
  └──────────┬───────────────┬────────────────────┘
             │               │
  ┌──────────v──────┐ ┌──────v──────────────────┐
  │ OccWorld         │ │ DiffusionDrive           │
  │ (future          │ │ (trajectory generation)  │
  │  occupancy       │ │ - Airside anchor bank    │
  │  prediction)     │ │ - 2-5 denoising steps    │
  │                  │ │ - Airport context cond.  │
  └──────────┬──────┘ └──────┬──────────────────┘
             │               │
  ┌──────────v───────────────v────────────────────┐
  │  Trajectory Scoring                            │
  │  - Collision vs predicted occupancy            │
  │  - Airport safety margins                      │
  │  - Comfort + progress                          │
  │  - Traffic rule compliance                     │
  └──────────────────┬────────────────────────────┘
                     │
  ┌──────────────────v────────────────────────────┐
  │  Safety Monitor (Simplex)                      │
  │  - Hard constraint checking                    │
  │  - Kinematic feasibility                       │
  │  - Geofence validation                         │
  │  - Fallback: Frenet planner or emergency stop  │
  └──────────────────┬────────────────────────────┘
                     │
  ┌──────────────────v────────────────────────────┐
  │  Vehicle Controller                            │
  │  (PID / Stanley on selected trajectory)        │
  └───────────────────────────────────────────────┘
```

### 10.5 Deployment Roadmap

```
Phase 1: Baseline (current)
  Frenet planner with hand-tuned costs
  Add world model collision cost term (see frenet-planner-augmentation.md)
  No diffusion yet

Phase 2: Offline validation
  Train DiffusionDrive on collected airside trajectory data
  Run in shadow mode: compare diffusion planner outputs vs. human driver
  Measure PDMS-equivalent metrics on airside scenarios
  Build airside-specific anchor bank via K-means

Phase 3: Parallel execution
  Run diffusion planner alongside Frenet planner
  Safety monitor selects between them:
    - Use diffusion plan when it passes all constraints
    - Fall back to Frenet when diffusion violates constraints
  Collect data on when/why diffusion fails → retrain

Phase 4: Diffusion-primary
  Diffusion planner becomes primary planner
  Frenet becomes fallback only
  Continuous improvement via fleet data → anchor bank updates
```

### 10.6 Why Diffusion Planning Fits Airside

Several properties of airport airside operations make diffusion-based planning particularly attractive:

1. **Multi-modal decisions are frequent:** At taxiway intersections, the vehicle may go straight, turn left, or turn right -- all valid depending on the task. Diffusion captures this naturally; regression would produce a dangerous average.

2. **Low speed means latency is forgiving:** At 10 km/h, the vehicle moves 2.8 m/s. Even a 100ms planning latency means the vehicle moves only 0.28m between plans. The 15-23ms latency of DiffusionDrive on Orin is massive overkill -- providing a comfortable margin for additional safety checks.

3. **Structured environment aids anchor design:** Airport layouts are regular and predictable. The set of maneuvers (straight, turn, dock, reverse, yield) is well-defined and can be thoroughly covered by a modest anchor bank (K=128-256).

4. **Precision docking benefits from diffusion refinement:** Approaching an aircraft stand requires high precision (< 0.1m error). The iterative refinement nature of denoising is well-suited to progressively sharpening a trajectory toward the exact docking position.

5. **Safety architecture compatibility:** The simplex architecture (diffusion as advanced controller, Frenet as baseline controller) provides the formal safety guarantees required for airport operations while allowing the diffusion planner to handle complex scenarios.

---

## Sources

- Janner, Du, Tenenbaum, Levine. "Planning with Diffusion for Flexible Behavior Synthesis." ICML, 2022. (Diffuser)
- Liao et al. "DiffusionDrive: Truncated Diffusion Model for End-to-End Autonomous Driving." CVPR, 2025 Highlight.
- Dong et al. "DiffuserLite: Towards Real-time Diffusion Planning." NeurIPS, 2024.
- Chi et al. "Diffusion Policy: Visuomotor Policy Learning via Action Diffusion." RSS, 2023.
- Zheng et al. "OccWorld: Learning a 3D Occupancy World Model for Autonomous Driving." ECCV, 2024.
- Werling, Ziegler, Kammel, Thrun. "Optimal Trajectory Generation for Dynamic Street Scenarios in a Frenet Frame." ICRA, 2010.
- Hu et al. "Planning-oriented Autonomous Driving" (UniAD). CVPR Best Paper, 2023.
- Jiang et al. "VAD: Vectorized Scene Representation for Efficient Autonomous Driving." ICCV, 2023.
- Ho, Jain, Abbeel. "Denoising Diffusion Probabilistic Models." NeurIPS, 2020.
- Song, Meng, Ermon. "Denoising Diffusion Implicit Models." ICLR, 2021.
- Ajay et al. "Is Conditional Generative Modeling all you need for Decision Making?" ICLR, 2023. (Decision Diffuser)
- Carvalho, Le, Baez, Torber, Peters. "Motion Planning Diffusion: Learning and Planning of Robot Motions with Diffusion Models." IROS, 2023.
- Huang et al. "Constrained Diffusion Models via Dual Training." NeurIPS, 2024.
- Sun et al. "SparseDrive: End-to-End Autonomous Driving via Sparse Scene Representation." ECCV, 2024.
