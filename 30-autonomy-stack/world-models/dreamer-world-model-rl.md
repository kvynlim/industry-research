# Dreamer World Model RL for Autonomous Vehicles

## Executive Summary

This report covers DreamerV4's transformer-based world model architecture, practical application of Dreamer-family algorithms to autonomous driving (with focus on airside operations), offline RL training from recorded driving data, SafeDreamer's safety-constrained learning, and TD-MPC2 as an alternative approach. Each section includes architecture details, training procedures, and code availability.

---

## 1. DreamerV4 Architecture

### 1.1 From RSSM to Block-Causal Transformer

DreamerV3 used a Recurrent State-Space Model (RSSM) combining a GRU-based deterministic path with stochastic categorical latent variables. DreamerV4 (paper: "Training Agents Inside of Scalable World Models," Hafner & Yan, arXiv 2509.24527) makes a fundamental architectural shift: the RSSM is replaced by a block-causal transformer that jointly attends over spatial patches and temporal sequences.

The motivation is scale. As Hafner explained in a TalkRL interview, the RSSM "just couldn't handle" diverse, high-resolution video data. Transformers can process longer contexts, leverage GPU parallelism during training, and absorb far more data before saturating.

**Block-causal transformer details:**

| Component | Design Choice |
|-----------|--------------|
| Attention pattern | Axial attention -- separate space-only and time-only layers |
| Temporal sparsity | Temporal attention applied only every 4 layers |
| KV efficiency | Grouped Query Attention (GQA) reduces KV cache size |
| Consistency | Register tokens improve temporal coherence |
| Length generalization | Alternating short/long batch lengths during training |

The transformer processes interleaved sequences of actions, noise levels, step sizes, and tokenizer representations. Video tokens attend to past video tokens and action tokens, but critically, video tokens do not attend backward to agent tokens -- this preserves the causal structure needed for world modeling.

### 1.2 Causal Tokenizer

DreamerV4 uses a causal masked-autoencoder (MAE) tokenizer to compress video frames into continuous latent representations:

- **Input:** Raw video frames split into spatial patches
- **Architecture:** Block-causal transformer (same backbone as dynamics model)
- **Training:** Masked autoencoding with MSE + LPIPS losses, with loss normalization
- **Temporal causality:** Causal attention enforces that encoding each frame depends only on past frames, enabling frame-by-frame decoding for interactive inference
- **Compression:** Latents are squeezed through a low-dimensional projection with tanh activation
- **Quality:** Achieves ~40 PSNR reconstruction from masked inputs

The tokenizer produces continuous (not discrete) latent representations, unlike VQ-VAE approaches. This avoids codebook collapse issues and enables smooth gradient flow to the dynamics model.

### 1.3 Shortcut Forcing Objective

Standard diffusion models require 64+ denoising steps at inference, making real-time world simulation impractical. DreamerV4 introduces **shortcut forcing**, which extends diffusion forcing:

1. **Diffusion forcing** assigns different noise levels to individual frames in a time series, enabling flexible causal generation
2. **Shortcut forcing** trains the model to predict clean representations in fewer steps by conditioning on step size. The model learns: "when conditioned on making a larger step, end up at the same point" by bootstrapping from itself
3. **Result:** 4 sampling steps match the quality of 64-step diffusion forcing -- a **16x speedup**
4. **x-prediction** (predicting clean representations directly) rather than v-prediction reduces error accumulation in long rollouts
5. **Ramp loss weighting** focuses learning on signal levels with high information content

Combined with architectural optimizations, DreamerV4 achieves real-time inference at 20+ FPS on a single H100 GPU, compared to the ~1000x slower baseline of standard diffusion transformers.

### 1.4 Learning from Unlabeled Video

A key breakthrough: DreamerV4 learns the majority of its world knowledge from unlabeled video, requiring only a small fraction of action-labeled data.

**Quantitative results on action conditioning:**
- With 100 hours of action-labeled data (out of a much larger unlabeled corpus): 85% of action-conditioned PSNR and 100% of SSIM compared to full supervision
- When action labels are restricted to one dimension (e.g., Minecraft overworld only), the model generalizes action conditioning to unseen dimensions (Nether, End): 76% PSNR, 80% SSIM

**Mechanism:** Agent tokens (encoding actions and task identity) are inserted into the transformer. During pretraining on unlabeled video, these tokens are absent. During finetuning with action-labeled data, agent tokens attend to video tokens and past agent tokens, learning general action conditioning that transfers across domains.

This has profound implications for driving: a world model could be pretrained on vast quantities of dashcam/surveillance video, then finetuned with a small amount of action-labeled driving data.

### 1.5 Three-Stage Training Pipeline

| Stage | Description | Key Details |
|-------|-------------|-------------|
| **1. World Model Pretraining** | Tokenizer and dynamics model trained on large-scale video | Can use unlabeled video; action labels optional |
| **2. Agent Finetuning** | Policy and reward heads inserted into transformer | Behavioral cloning + reward modeling via multi-token prediction (MTP) |
| **3. Imagination Training** | Policy improved via RL on imagined rollouts | Uses PMPO with KL regularization to BC prior |

**PMPO (Preference Optimization as Probabilistic Inference):** The policy optimization maximizes likelihood of preferred trajectories while minimizing likelihood of dis-preferred ones. KL regularization to a behavioral cloning prior prevents policy collapse and keeps the learned policy anchored to demonstrated behavior.

### 1.6 Performance

- **Minecraft diamonds:** 0.7% success rate from purely offline data (no environment interaction) -- first agent to achieve this, requiring sequences of over 20,000 mouse/keyboard actions from raw pixels
- **Intermediate milestones:** >90% on stone pickaxe, 29% on iron pickaxe
- **Data efficiency:** Outperforms OpenAI's VPT offline agent while using 100x less data
- **Representation quality:** World model provides better representations for behavioral cloning than Gemma 3
- **Video fidelity:** FVD reduced from 306 to 57; context lengths up to 9.6 seconds (6x longer than prior models)

---

## 2. Applying Dreamer to Driving

### 2.1 Observation Space Design

For airside autonomous vehicle operations, the observation space should encode the structured environment efficiently. Based on CarDreamer and Think2Drive precedents:

**Bird's Eye View (BEV) representation (recommended primary modality):**

Following Think2Drive's proven approach, use BEV semantic segmentation masks:

| Channel Group | Content | Channels |
|--------------|---------|----------|
| Static infrastructure | Taxiways, apron markings, service roads, stand boundaries, gate areas | 1 |
| Dynamic objects (per class) | Aircraft, ground support equipment, baggage carts, fuel trucks, personnel | 4 per class (position + velocity encoding) |
| Route/intent | Planned path, next waypoint, clearance zones | 1-2 |
| Temporal history | Stacked past BEV frames at t-16, t-11, t-6, t-1 | Multiplied by above |

Think2Drive uses 128x128 pixels with 34 channels. For airside operations, a similar resolution covering a ~100m x 100m area centered on the ego vehicle provides sufficient spatial detail.

**State vector (concatenated with BEV features):**
- Ego velocity (longitudinal, lateral)
- Previous control commands (steering, throttle/brake)
- Ego heading relative to route
- Distance to next waypoint
- Clearance status (e.g., permission to cross active taxiway)

**BEV encoding approaches:**
- **BEVFusion:** Unifies camera + LiDAR + radar into BEV space (most robust for airside where lighting varies dramatically)
- **LSS (Lift-Splat-Shoot):** Camera-only BEV projection
- **Pre-rendered from perception stack:** If the AV already produces BEV occupancy grids, feed those directly

CarDreamer demonstrated that DreamerV3's world model accurately predicts BEV dynamics over 64-step horizons, including vehicle positions, trajectories, and ego-vehicle rotation/translation.

### 2.2 Action Space Design

For airside operations where speeds are low (typically 5-25 km/h) and maneuvers are precise:

**Option A: Discrete actions (Think2Drive approach)**

Think2Drive uses 30 discrete actions mapping combinations of:
- Throttle: {0, 0.3, 0.7}
- Brake: {0, 0.3, 0.6, 1.0}
- Steering: {-1.0 to +1.0 in 0.1 increments}

This works well with DreamerV3's categorical latent space and simplifies exploration.

**Option B: Continuous actions (CarDreamer approach)**

Direct continuous control:
- Steering angle: [-1.0, 1.0] (mapped to max steering angle)
- Target velocity: [0, v_max] (with separate brake/accelerate logic)

For airside, continuous actions with a velocity target (rather than raw throttle/brake) are preferable because:
1. Low-speed maneuvering requires fine control
2. Speed limits vary by zone (stand area vs. service road vs. apron taxiway)
3. The velocity controller can be a separate PID layer, simplifying what the RL agent must learn

**Recommended for airside:** 2D continuous action space:
- `a_steer` in [-1, 1]: normalized steering command
- `a_vel` in [0, 1]: normalized target velocity (mapped to zone-specific speed limits)

### 2.3 Reward Design for Airside Operations

Based on CarDreamer's reward structure (r = alpha * v_parallel - beta * v_perp - gamma * I_collision) and Think2Drive's multi-component design, a reward function for airside driving:

```
r = r_progress + r_safety + r_comfort + r_compliance
```

**Progress reward (dense):**
```
r_progress = alpha_1 * v_parallel    # speed toward next waypoint
           - alpha_2 * v_perp        # penalize lateral drift
           + alpha_3 * waypoint_reached  # bonus per waypoint
```

**Safety reward (sparse + dense):**
```
r_safety = -beta_1 * I_collision           # large penalty for any collision
         - beta_2 * proximity_penalty      # continuous penalty for being too close to obstacles
         - beta_3 * I_restricted_zone      # entering restricted areas (active runway, etc.)
```

**Comfort reward (dense):**
```
r_comfort = -gamma_1 * |delta_steer|       # penalize jerky steering
          - gamma_2 * |jerk|               # penalize acceleration jerk
```

**Compliance reward (dense):**
```
r_compliance = -delta_1 * speed_violation  # exceeding zone speed limits
             - delta_2 * I_wrong_side      # wrong side of service road
             + delta_3 * I_yield_correct   # yielding to aircraft correctly
```

**Key design principles from CarDreamer:**
- Reward incremental progress (speed toward goal) rather than absolute position -- avoids premature convergence
- Include perpendicular velocity penalty to prevent entropy-driven zigzag behavior
- Collision indicator should be a large negative constant, not a continuous function of impact force

### 2.4 Episode Structure

**For training:**
- Episode length: 200-500 steps at 10 Hz (20-50 seconds of driving)
- Termination conditions: collision, route completion, timeout, critical safety violation
- Reset: random start position on apron/service road network with randomized traffic

**For airside-specific considerations:**
- Routes should be short (stand-to-stand, gate-to-fuel, etc.) -- typical airside trips are 200-500m
- Traffic density should be varied: empty apron, moderate operations, peak turnaround
- Include aircraft push-back scenarios (ego must yield)
- Weather/lighting variation: day, night, rain, fog (airside operations are 24/7)

Think2Drive uses routes of <300m with single scenario per route for training, then composes skills for longer routes at evaluation -- a good template for airside.

---

## 3. Training from Offline Data

### 3.1 Structuring Bag Data as Offline RL Dataset

Converting ROS bag recordings into an offline RL dataset requires extracting (s, a, r, s', done) tuples:

**Step 1: Temporal alignment and synchronization**
```
For each bag file:
  1. Extract synchronized sensor frames at fixed rate (e.g., 10 Hz)
  2. Align: BEV/camera images, LiDAR scans, CAN bus data, GPS/IMU
  3. Interpolate control commands to match sensor timestamps
```

**Step 2: State construction**
```
s_t = {
  bev_t: BEV semantic grid (from perception pipeline or raw sensors),
  ego_state_t: [vx, vy, yaw_rate, steer_angle, speed],
  route_t: next N waypoints in ego frame
}
```

**Step 3: Action extraction**
```
a_t = {
  steer: CAN bus steering command (normalized),
  velocity: CAN bus speed command or actual speed
}
```

**Step 4: Reward labeling (post-hoc)**

Since bag data was collected under human/autopilot control, rewards must be computed retroactively:
- Progress: computed from GPS trajectory vs. planned route
- Safety: computed from object detections (minimum distances to obstacles)
- Comfort: computed from IMU jerk and steering rate
- Compliance: computed from speed vs. zone limits, lane adherence

**Step 5: Episode segmentation**
- Segment continuous recordings into episodes at natural boundaries (vehicle stop, route completion, manual takeover)
- Mark terminal states and done flags
- Store as HDF5 or zarr arrays with shape [episodes, timesteps, features]

**Dataset quality considerations:**
- AD4RL benchmark uses 100K transition steps per dataset with episodes of length 1000
- Include diverse behavior quality: cautious human driving, aggressive driving, autopilot -- mixed quality data trains more robust policies
- Think2Drive's dataset structure: expert (20 trajectories/task), mixed-small (20/task), mixed-large (200/task)

### 3.2 Handling Distributional Shift

The core challenge of offline RL: the learned policy may visit states not covered by the training data, where the world model's predictions are unreliable.

**Three complementary strategies:**

**A. World model uncertainty as reward penalty (MOPO approach)**

MOPO (Yu et al., NeurIPS 2020) modifies the reward function:
```
r_penalized(s, a) = r(s, a) - lambda * u(s, a)
```
where u(s, a) is the epistemic uncertainty of the learned dynamics model, estimated as the variance across an ensemble of N independently trained models:
```
u(s, a) = Var_{i=1..N}[f_i(s, a)]
```

This ensures the policy avoids regions where the world model is uncertain, effectively staying close to the data distribution. The algorithm maximizes a lower bound on the true return.

**Implementation with Dreamer:**
- Train an ensemble of K world models (or use MC dropout in the RSSM/transformer)
- During imagination rollouts, compute disagreement across ensemble members
- Subtract lambda * disagreement from imagined rewards
- lambda controls the conservatism-exploration tradeoff

**B. Conservative value estimation (COMBO approach)**

COMBO (Yu et al., NeurIPS 2021) extends CQL into the model-based setting:
- Train a dynamics model on the offline dataset
- Generate synthetic rollouts from the model
- Penalize Q-values on out-of-support state-action tuples from model rollouts
- No explicit uncertainty estimation required

The Q-function is trained with an additional regularization term:
```
L_conservative = alpha * (E_{s,a ~ model}[Q(s,a)] - E_{s,a ~ data}[Q(s,a)])
```

This pushes down Q-values for model-generated (potentially out-of-distribution) state-action pairs while pushing up Q-values for observed data.

**C. KL-constrained policy (DreamerV4 approach)**

DreamerV4's PMPO uses KL regularization to a behavioral cloning prior:
```
L_policy = -E[Q(s, pi(s))] + beta * KL(pi || pi_BC)
```

This naturally prevents the policy from straying too far from demonstrated behavior -- critical for safety in driving applications.

### 3.3 Practical Offline Training Pipeline

```
Phase 1: Data Collection & Preprocessing
  - Record driving bags with full sensor suite
  - Run perception pipeline to generate BEV representations
  - Extract (s, a, r, s', done) tuples
  - Split into train/val sets (by route, not by time)

Phase 2: World Model Training (offline)
  - Train tokenizer/encoder on BEV sequences (if using DreamerV4-style)
  - Train dynamics model on (s, a, s') transitions
  - Train reward predictor on (s, a, r) tuples
  - Validate: one-step and multi-step prediction accuracy on held-out routes

Phase 3: Policy Training in Imagination
  - Initialize policy via behavioral cloning on offline data
  - Generate imagined rollouts from world model
  - Apply MOPO/COMBO conservatism penalties
  - Train actor-critic on imagined trajectories
  - KL-constrain policy to BC prior

Phase 4: Evaluation
  - Deploy in simulation (CARLA or custom airside sim)
  - Measure: route completion, collision rate, comfort metrics
  - If sim performance sufficient, deploy in shadow mode on real vehicle
```

---

## 4. SafeDreamer: Safety-Constrained World Model RL

### 4.1 Overview

SafeDreamer (Huang et al., ICLR 2024) integrates Lagrangian-based safety constraints into the DreamerV3 world model framework. It is the first algorithm to achieve nearly zero-cost performance using vision-only input in the Safety-Gymnasium benchmark.

### 4.2 CMDP Formulation

SafeDreamer operates within a Constrained Markov Decision Process:
```
maximize  J_R(pi)      # expected cumulative reward
subject to  J_C(pi) <= b  # expected cumulative cost <= threshold b
```

The cost function C(s, a) -> R quantifies hazardous behaviors (collisions, constraint violations). Unlike the reward signal, costs are treated as separate safety indicators.

### 4.3 Architecture Modifications to DreamerV3

SafeDreamer adds three components to DreamerV3:

1. **Cost decoder C_phi:** Predicts cost from model state (parallel to reward decoder R_phi)
2. **Cost critic V_psi_c:** Separate value function for cost estimation, trained via TD(lambda) bootstrapping:
   ```
   C_lambda(s_t) = C_phi(s_t) + gamma * ((1-lambda)*V_psi_c(s_{t+1}) + lambda*C_lambda(s_{t+1}))
   ```
3. **World model loss extension:** Adds cost prediction loss:
   ```
   L_wm = L_reconstruction + L_dynamics - beta_r * L_reward - beta_c * L_cost
   ```

### 4.4 Two Algorithmic Variants

**OSRP-Lag (Online Safety-Reward Planning with Lagrange):**
- Uses Constrained Cross-Entropy Method (CCEM) for planning
- Separates safe trajectories: A_s = {trajectories where J_C' < b}
- If sufficient safe trajectories: optimize reward within safety bounds
- If insufficient: minimize cost first, then optimize reward
- Suitable for when online planning compute is available

**BSRP-Lag (Background Safety-Reward Planning with Lagrange):**
- Trains a safe actor using imagined rollouts of length T=15
- Actor loss includes Augmented Lagrangian penalty:
  ```
  L(theta) = -sum_t [sg(R_lambda(s_t)) + eta * H[pi(a|s)] - Psi(sg(C_lambda(s_t)), lambda_p, mu)]
  ```
- Lagrangian multiplier lambda_p updated via PID control
- More efficient at inference: no online planning needed
- **Recommended for real-time driving applications**

### 4.5 Cost Function Design for Airside Operations

For airport airside AVs, the cost function should capture:

```python
def cost_function(state, action):
    cost = 0.0

    # Hard safety constraints (binary indicators)
    cost += 1.0 * collision_with_aircraft(state)      # catastrophic
    cost += 1.0 * collision_with_vehicle(state)        # severe
    cost += 1.0 * collision_with_personnel(state)      # catastrophic
    cost += 1.0 * entered_active_runway(state)         # catastrophic

    # Soft safety constraints (continuous)
    cost += proximity_cost(state, min_dist_aircraft=5.0)  # too close to aircraft
    cost += proximity_cost(state, min_dist_personnel=3.0) # too close to people
    cost += speed_zone_violation(state, action)            # exceeding speed limit

    return cost
```

**Cost threshold b:** Set to 0 (or near-zero, e.g., b=0.1) for airside operations -- any collision is unacceptable. SafeDreamer has demonstrated the ability to achieve near-zero cost while maintaining task performance.

### 4.6 Results

SafeDreamer (BSRP-Lag) achieves:
- **94.3% cost reduction** vs. LAMBDA (previous best model-based safe RL)
- **Nearly zero-cost** across 20+ Safety-Gymnasium tasks
- **Reward performance** matching or exceeding unconstrained DreamerV3
- Works with both low-dimensional states and vision-only inputs

Key insight: the world model enables planning for safety in imagination, where the cost of violations is zero. The agent can explore dangerous scenarios in imagination without real-world consequences, learning to avoid them before deployment.

---

## 5. TD-MPC2 Alternative

### 5.1 Architecture Overview

TD-MPC2 (Hansen et al., ICLR 2024) takes a fundamentally different approach from Dreamer: instead of learning to reconstruct observations, it learns an implicit (decoder-free) world model and performs Model Predictive Control (MPC) in latent space.

**Five neural network components:**

| Component | Function | Architecture |
|-----------|----------|--------------|
| Encoder h(s, e) | Maps observations to latent states z | MLP + LayerNorm + Mish |
| Dynamics d(z, a, e) | Predicts next latent state z' | MLP + LayerNorm + Mish |
| Reward R(z, a, e) | Estimates task reward | MLP + LayerNorm + Mish |
| Q-function Q(z, a, e) | Estimates discounted returns | 5-member ensemble, MLP |
| Policy p(z, e) | Learned action prior | MLP + LayerNorm + Mish |

All components are conditioned on a task embedding e (learnable, L2-norm constrained to 1).

### 5.2 SimNorm Normalization

A key innovation preventing gradient explosion in latent space:
- Partition latent vector z into L groups of dimension V
- Apply softmax to each group: g_i = softmax(z_{i:i+V} / tau)
- Temperature tau controls sparsity
- Naturally biases toward sparse representations without hard constraints
- Eliminates the gradient instability that plagued the original TD-MPC

### 5.3 MPC in Latent Space (MPPI Planning)

At inference, TD-MPC2 solves a trajectory optimization problem using Model Predictive Path Integral (MPPI):

```
mu*, sigma* = argmax E_{a_t..a_{t+H} ~ N(mu, sigma^2)} [
    gamma^H * Q(z_{t+H}, a_{t+H}) + sum_{h=0}^{H-1} gamma^h * R(z_h, a_h)
]
```

Key features:
- Derivative-free optimization with sampled action sequences
- Warm-starts from previous timestep's solution
- Samples from both policy prior and random distribution
- Fixed number of iterations per planning step
- Executes only the first action, then replans (receding horizon)

### 5.4 Training Objective

Joint embedding prediction (no decoder required):
```
L = sum_{h=0}^{H-1} lambda^h * [
    ||d(z_h, a_h) - sg(h(s_{h+1})))||^2   # latent dynamics prediction
    + CE(R(z_h, a_h), twohot(symlog(r_h)))  # reward prediction (discrete regression)
    + CE(Q(z_h, a_h), twohot(symlog(q_h)))  # value prediction (discrete regression)
]
```

The discrete regression formulation (two-hot encoded symlog-transformed values) handles varying reward magnitudes across tasks -- the same technique DreamerV3 uses.

### 5.5 Scaling Results

| Model Size | Tasks | Key Results |
|-----------|-------|-------------|
| 1M params | Single-task | Baseline performance |
| 5M params | Single-task (default) | Matches/beats DreamerV3 on most tasks |
| 19M params | Multi-task | Strong multi-domain performance |
| 48M params | Multi-task | Further improvement |
| 317M params | 80 tasks | Single agent across DMControl, Meta-World, ManiSkill2, MyoSuite |

The 317M model required ~33 GPU-days on a single RTX 3090.

### 5.6 TD-MPC2 vs. Dreamer for Driving

| Dimension | Dreamer (V3/V4) | TD-MPC2 |
|-----------|-----------------|---------|
| World model type | Explicit (encoder-decoder) | Implicit (encoder only) |
| Planning | Amortized (actor network) | Online MPC (MPPI at each step) |
| Observation | Can reconstruct/visualize predictions | No reconstruction possible |
| Compute at inference | Single forward pass | Multiple MPPI iterations |
| Data efficiency | Very high (imagination training) | High (model-based + planning) |
| Multi-task | DreamerV4 supports task tokens | Native multi-task with embeddings |
| Safety constraints | SafeDreamer exists | Would need custom CMDP extension |
| Driving adaptations | CarDreamer, Think2Drive exist | No driving-specific work yet |

**Recommendation for airside AVs:** Dreamer (V3 or V4) is better suited because:
1. SafeDreamer provides a proven safety constraint framework
2. CarDreamer and Think2Drive provide tested driving adaptations
3. Explicit world model enables debugging/visualization of predictions
4. Amortized policy is faster at inference (no MPPI iterations)

TD-MPC2 is worth considering if you need multi-task generalization across very different vehicle types or if online re-planning is critical (e.g., rapidly changing obstacle configurations).

---

## 6. Training Pipeline

### 6.1 Data Preparation

**From ROS bags to training dataset:**

```
Input: ROS bags with camera, LiDAR, CAN bus, GPS/IMU, perception outputs

Step 1: Synchronize and extract at 10 Hz
  - Camera images (front, rear, sides)
  - LiDAR point clouds
  - BEV occupancy/semantic grid (from perception pipeline)
  - Vehicle state: speed, steering angle, yaw rate
  - Control commands: throttle, brake, steering

Step 2: Post-hoc reward computation
  - Route progress from GPS + planned route
  - Safety metrics from object tracker + proximity computation
  - Comfort from IMU (jerk, lateral acceleration)
  - Compliance from speed vs zone limits

Step 3: Episode segmentation
  - Split at stops, route completions, takeovers
  - Typical episode: 200-500 steps (20-50 seconds)
  - Mark terminal states

Step 4: Storage format
  - HDF5 or zarr arrays
  - Shape: [num_episodes, max_steps, feature_dims]
  - Include padding masks for variable-length episodes

Step 5: Quality filtering
  - Remove episodes with sensor dropouts
  - Remove stationary-only episodes
  - Balance: include expert, cautious, and sub-optimal driving
```

**Storage estimates:**
- BEV at 128x128x34 float16: ~1.1 MB per frame
- At 10 Hz, 1 hour of driving: ~40 GB of BEV data
- 100 hours of diverse airside driving: ~4 TB
- Add 2x for camera/LiDAR if retaining raw modalities

### 6.2 World Model Training

**DreamerV3 approach (RSSM-based, proven for driving):**

```
Hyperparameters (from DreamerV3 defaults + Think2Drive):
  Model size: 18M-200M parameters
    - 18M (Small): 32 CNN multipliers, 512 GRU/MLP units -- fits single 4090
    - 200M (Large): default DreamerV3 -- requires A100/H100
  Batch size: 16 sequences x 64 timesteps
  Learning rate: 1e-4 (Adam)
  Sequence length: 64 steps (6.4 seconds at 10 Hz)
  Replay buffer: up to 1M transitions
  KL balancing: 0.8 (posterior vs prior)
  Free bits: 1.0 nat
  Symlog predictions: enabled for rewards and values

Training loop:
  For each gradient step:
    1. Sample batch of sequences from replay buffer
    2. Encode observations through CNN/transformer encoder
    3. Unroll RSSM for sequence length steps
    4. Compute losses:
       - Reconstruction (BEV decoder)
       - Reward prediction
       - KL divergence (with free bits and balancing)
       - Continue predictor (episode termination)
    5. Update encoder, RSSM, decoders jointly

Convergence: 50K-200K gradient steps
  - Simple tasks (waypoint following): ~50K steps, ~1 hour on 4090
  - Complex tasks (traffic interaction): ~200K steps, ~4 hours on 4090
```

**DreamerV4 approach (transformer-based, for larger scale):**

```
Stage 1: Tokenizer training
  Command: torchrun --nproc_per_node=8 train_tokenizer.py
  Duration: ~24 hours on 8x RTX 3090
  Data: all video sequences (can include unlabeled footage)
  Target: ~40 PSNR reconstruction

Stage 2: Dynamics model training
  Command: torchrun --nproc_per_node=8 train_dynamics.py --use_actions
  Duration: ~48 hours on 8x RTX 3090
  Data: action-labeled sequences
  Requires: pretrained tokenizer checkpoint

Stage 3: Policy finetuning
  - Insert task tokens and reward heads
  - Behavioral cloning initialization
  - Duration: hours-to-days depending on task complexity

Stage 4: Imagination RL
  - PMPO policy optimization on imagined rollouts
  - KL regularization to BC prior
```

### 6.3 Policy Training in Imagination

**DreamerV3 actor-critic (proven approach):**

```
Imagination rollouts:
  Horizon H = 15 steps (1.5 seconds at 10 Hz)
  Batch of 1024 parallel imagined trajectories
  No real environment interaction

Actor training:
  - Maximize lambda-returns estimated by critic
  - Entropy regularization for exploration
  - Reinforce + straight-through gradients for discrete actions
  - Or reparameterized gradients for continuous actions

Critic training:
  - Predict two-hot encoded symlog-transformed returns
  - TD(lambda) with lambda = 0.95
  - Target network updated via EMA (tau = 0.02)

For offline RL with safety (SafeDreamer BSRP-Lag):
  Additional training:
  - Cost critic trained on imagined cost trajectories
  - Lagrangian multiplier lambda_p updated via PID control
  - Actor loss includes augmented Lagrangian penalty for cost constraint
```

### 6.4 Evaluation Protocol

```
Level 1: World model quality
  - 1-step prediction error on held-out data
  - Multi-step (5, 15, 64) rollout quality (MSE, SSIM, FVD)
  - Reward prediction accuracy
  - Cost prediction accuracy (for SafeDreamer)

Level 2: Policy in simulation
  - Deploy learned policy in CARLA or custom sim
  - Metrics: route completion %, collision rate, avg speed, comfort
  - Stress testing: dense traffic, edge cases, adversarial scenarios

Level 3: Shadow mode on real vehicle
  - Run learned policy alongside production stack
  - Compare decisions without executing
  - Measure intervention rate (how often human would override)

Level 4: Limited real deployment
  - Restricted operational domain (e.g., empty apron, low traffic)
  - Gradual expansion as confidence grows
```

### 6.5 GPU Requirements Summary

| Configuration | Hardware | Training Time | Use Case |
|--------------|----------|---------------|----------|
| DreamerV3 Small (18M) | 1x RTX 4090 (24GB) | 1-4 hours | Prototyping, simple tasks |
| DreamerV3 Large (200M) | 1x A100 (80GB) | 12-48 hours | Production driving policy |
| DreamerV4 Tokenizer | 8x RTX 3090 (24GB each) | ~24 hours | Video tokenizer pretraining |
| DreamerV4 Dynamics | 8x RTX 3090 (24GB each) | ~48 hours | Dynamics model |
| DreamerV4 Full (original paper) | 256-1024 TPU-v5p | Days | Full Minecraft scale |
| TD-MPC2 Single-task (5M) | 1x RTX 3090 | Hours | Single driving task |
| TD-MPC2 Multi-task (317M) | 1x RTX 3090 | ~33 GPU-days | Multi-task agent |
| SafeDreamer | 1x GPU (CUDA 11+) | Hours | Safety-constrained policy |

---

## 7. Code Availability and Adaptation

### 7.1 DreamerV3 Repositories

**Official implementation (JAX):**
- Repository: https://github.com/danijar/dreamerv3
- Language: Python 3.11+, JAX
- License: Open source
- Features: All model sizes (12M-400M), all benchmarks
- Config: `dreamerv3/configs.yaml` with overridable flags
- Install: `pip install dreamerv3`

**PyTorch reimplementation:**
- Repository: https://github.com/NM512/dreamerv3-torch
- Good for teams more comfortable with PyTorch

**Ray RLlib integration:**
- Built into Ray RLlib: `ray.rllib.algorithms.dreamerv3`
- Production-ready distributed training

**CarDreamer (driving-specific):**
- Repository: https://github.com/ucd-dare/CarDreamer
- Built on DreamerV3, integrated with CARLA
- Includes BEV, camera, LiDAR observation handlers
- Optimized reward functions for driving tasks
- 18M parameter model trainable on single 4090

### 7.2 DreamerV4 Repositories

**Unofficial PyTorch (Nicklas Hansen):**
- Repository: https://github.com/nicklashansen/dreamer4
- Targets continuous control (DMControl, MMBench)
- Includes tokenizer + dynamics model training
- Pretrained checkpoints on HuggingFace
- MIT license

**JAX implementation:**
- Repository: https://github.com/edwhu/dreamer4-jax
- 4-stage pipeline implementation

**Minecraft-specific:**
- Repository: https://github.com/IamCreateAI/Dreamerv4-MC
- MAE tokenizer + DiT dynamics for Minecraft
- HuggingFace model: IamCreateAI/Dreamerv4-MC

**Complete implementation (vijayabhaskar-ev):**
- Repository: https://github.com/vijayabhaskar-ev/dreamer_v4
- Includes: causal MAE tokenizer, block-causal transformer, shortcut forcing, task-token finetuning, imagination RL

**PyPI package:**
- `pip install dreamer4`
- Classes: VideoTokenizer, DynamicsWorldModel

### 7.3 SafeDreamer

- Repository: https://github.com/PKU-Alignment/SafeDreamer
- Framework: JAX 0.3.25
- License: Apache 2.0
- 80+ pretrained checkpoints on HuggingFace
- Supports Safety-Gymnasium environments
- Entry point: `train.py` with YAML configs

### 7.4 TD-MPC2

- Repository: https://github.com/nicklashansen/tdmpc2
- 324 model checkpoints open-sourced (1M-317M parameters)
- Two datasets: 545M transitions (34GB) and 345M transitions (20GB)
- Supports both single-task online RL and multi-task offline RL
- Requirements: GPU with 8GB+ VRAM (single-task), 128GB RAM (multi-task)

### 7.5 Adapting for Airside Driving

**Recommended starting point: CarDreamer + SafeDreamer hybrid**

```
Step 1: Fork CarDreamer
  - Replace CARLA integration with your airside simulator or data pipeline
  - Implement custom BEV observation handler for airside layout
  - Define airside-specific action space (steering + velocity)
  - Implement reward function with airside-specific terms

Step 2: Integrate SafeDreamer constraints
  - Add cost decoder and cost critic to CarDreamer's DreamerV3
  - Implement BSRP-Lag actor training
  - Define cost function for airside safety constraints
  - Set cost threshold b ≈ 0

Step 3: Offline data pipeline
  - Build ROS bag to HDF5/zarr converter
  - Implement post-hoc reward/cost computation
  - Create replay buffer that loads from offline dataset

Step 4: Train and evaluate
  - Start with DreamerV3 Small (18M) for rapid iteration
  - Scale to DreamerV3 Large (200M) once pipeline is validated
  - Evaluate in simulation, then shadow mode

Optional Step 5: Upgrade to DreamerV4
  - Once pipeline is proven with DreamerV3
  - Leverage unlabeled airport video for pretraining
  - Finetune with action-labeled driving data
  - Requires significantly more compute (8+ GPUs)
```

**Key adaptation considerations:**
1. Airside environments are simpler than urban driving (lower speeds, structured layout, fewer actor types) -- DreamerV3 Small may be sufficient
2. Safety constraints are more critical (aircraft worth $100M+, human lives on apron)
3. Operational patterns are repetitive -- world model should learn quickly
4. 24/7 operations provide abundant data but with lighting/weather variation
5. Multi-agent coordination (with other GSE vehicles) may require Think2Drive-style independent modeling

---

## References

### Primary Papers
- Hafner & Yan, "Training Agents Inside of Scalable World Models" (DreamerV4), arXiv 2509.24527
- Hafner et al., "Mastering Diverse Domains through World Models" (DreamerV3), Nature 2025, arXiv 2301.04104
- Huang et al., "SafeDreamer: Safe Reinforcement Learning with World Models," ICLR 2024, arXiv 2307.07176
- Hansen et al., "TD-MPC2: Scalable, Robust World Models for Continuous Control," ICLR 2024, arXiv 2310.16828

### Driving Applications
- Gao et al., "CarDreamer: Open-Source Learning Platform for World Model based Autonomous Driving," arXiv 2405.09111
- Li et al., "Think2Drive: Efficient Reinforcement Learning by Thinking in Latent World Model for Autonomous Driving," ECCV 2024, arXiv 2402.16720
- "SafeDrive Dreamer: Navigating Safety-Critical Scenarios in Autonomous Driving with World Models," Alexandria Engineering Journal, 2024

### Offline RL Foundations
- Yu et al., "MOPO: Model-based Offline Policy Optimization," NeurIPS 2020, arXiv 2005.13239
- Yu et al., "COMBO: Conservative Offline Model-Based Policy Optimization," NeurIPS 2021, arXiv 2102.08363
- "AD4RL: Autonomous Driving Benchmarks for Offline Reinforcement Learning," arXiv 2404.02429

### Code Repositories
- DreamerV3 official: https://github.com/danijar/dreamerv3
- DreamerV4 PyTorch: https://github.com/nicklashansen/dreamer4
- DreamerV4 JAX: https://github.com/edwhu/dreamer4-jax
- SafeDreamer: https://github.com/PKU-Alignment/SafeDreamer
- TD-MPC2: https://github.com/nicklashansen/tdmpc2
- CarDreamer: https://github.com/ucd-dare/CarDreamer
