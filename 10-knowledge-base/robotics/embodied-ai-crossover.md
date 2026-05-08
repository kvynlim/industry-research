# Embodied AI and Robotics Crossover for Autonomous Vehicles

## How Robotics Foundation Models Transfer to Driving

---

## 1. Physical Intelligence pi0 / pi0.5

### 1.1 Architecture

pi0 is a vision-language-action model for general-purpose robotics:

```
Vision Encoder (SigLIP): Images → visual tokens
Language Encoder: Task description → language tokens
Proprioception: Robot state → state tokens

Combined tokens → Transformer backbone (3B params)
                            │
                   Flow Matching Action Head
                   (NOT diffusion — flow matching is more stable)
                            │
                   Action: joint positions / velocities
```

**Key innovation:** The action head uses **flow matching** instead of diffusion or regression:
- More stable training (no noise schedule hyperparameter)
- Better multi-modal action coverage (doesn't collapse to mean)
- Faster inference (fewer denoising steps)

### 1.2 Cross-Embodiment Transfer

pi0 is trained on data from multiple robot types:
- Franka Panda arms
- UR5 arms
- Mobile manipulators
- Bi-manual robots

**The shared representation captures physics** — gravity, rigid body dynamics, contact forces — regardless of embodiment. The embodiment-specific parts are handled by the action head.

### 1.3 Applicability to Vehicles

| pi0 Concept | Vehicle Application |
|-------------|-------------------|
| Flow matching action head | Trajectory generation (steering, velocity) |
| Vision-language conditioning | Ground control instruction following |
| Cross-embodiment backbone | Pre-train on diverse robots, fine-tune for vehicle |
| Proprioception encoding | Vehicle state (steering angle, velocity, IMU) |

**Limitation:** pi0 operates at 5-10 Hz for manipulation. Driving needs 10-50 Hz. The backbone may need to be smaller or distilled for real-time vehicle control.

---

## 2. Google DeepMind Robotics

### 2.1 RT-2 → RT-X → AutoRT

**Evolution:**
| System | Scale | Key Innovation |
|--------|-------|----------------|
| RT-1 (2022) | 130K episodes, single robot | Transformer for robot actions |
| RT-2 (2023) | PaLM-E backbone, language reasoning | VLM directly outputs actions |
| RT-X (2023) | 22 robot types, 160K hours | Cross-embodiment dataset |
| AutoRT (2024) | Fleet of 20+ robots, LLM supervisor | Autonomous data collection |
| SARA-RT (2024) | Up-training for real-time inference | Efficient RT-2 |

**RT-2 architecture directly inspired driving VLAs** (DriveVLM, LINGO-2, Alpamayo). The key insight: use a large VLM backbone and simply add action tokens to its vocabulary.

### 2.2 What Transfers to Driving

```
From robotics:                    To driving:
Manipulation policies      →     Docking/loading policies (ULD, trailer coupling)
Pick-and-place             →     Cargo placement (if arms are on vehicle)
Navigation in cluttered    →     Navigation on crowded apron
Obstacle avoidance         →     Obstacle avoidance (same physics)
Language instructions      →     Ground control instructions
Multi-robot coordination   →     Multi-GSE coordination
```

**What doesn't transfer:**
- Manipulation-specific skills (grasp planning, force control)
- Indoor-scale spatial reasoning (rooms, tables) → outdoor-scale (apron, taxiways)
- Contact-rich dynamics (grasping) → contact-free dynamics (driving)

---

## 3. Humanoid World Models

### 3.1 Tesla Optimus

- Uses similar neural architecture to FSD (shared engineering DNA)
- World model for predicting physical interactions
- **Key transfer:** If Tesla's implicit world model works for humanoid walking, similar physics priors apply to vehicle dynamics

### 3.2 1X NEO / Figure

- Foundation model approach to humanoid control
- World models for predicting consequences of actions
- **Transfer potential:** Physics understanding (gravity, momentum, friction) is universal

### 3.3 The Shared Physics Hypothesis

```
Hypothesis: A world model trained on diverse physical interactions
(manipulation, walking, driving, flying) learns universal physics
that transfers better than domain-specific training.

Evidence:
  - Genie 2: trained on games, generalizes to robotics
  - DreamerV4: single architecture works across Atari, robotics, games
  - pi0: single model works across robot types

Implication: Pre-training a world model on diverse physical
scenarios (including driving) may produce better airside predictions
than training only on driving data.
```

---

## 4. LeRobot (Hugging Face)

### 4.1 Framework Overview

```
LeRobot provides:
├── Datasets: standardized format for robot learning data
├── Models: ACT, Diffusion Policy, VQ-BeT, pi0-compatible
├── Simulation: Gymnasium, MuJoCo, PyBullet integration
├── Hardware: Affordable robot arms for data collection
└── Training: Unified training pipeline
```

### 4.2 Relevance to Vehicles

| LeRobot Component | Vehicle Application |
|-------------------|-------------------|
| Dataset format | Standardize airside driving data in LeRobot format for sharing |
| Diffusion Policy | Use as trajectory generation head (same as DiffusionDrive) |
| ACT (Action Chunking Transformer) | Generate sequences of controls, not single steps |
| VQ-BeT (Vector Quantized Behavior Transformer) | Tokenize trajectories for autoregressive prediction |
| Training pipeline | Adapt for driving policy training |

### 4.3 L2D Dataset

The L2D dataset on Hugging Face is the world's largest multimodal driving dataset:
- 1M+ episodes, 5,000+ hours, 90+ TB
- Collected from 60 driving school cars across 30 German cities
- Compatible with LeRobot training pipeline
- **Could be used to pre-train a driving policy before airside fine-tuning**

---

## 5. Diffusion Policy for Vehicles

### 5.1 Chi et al.'s Diffusion Policy

```
Standard policy:  observation → action (point estimate)
Diffusion policy: observation → denoise(noise) → action distribution

Training:
  1. Add noise to expert actions: a_t = a_0 + σ_t * ε
  2. Train model to predict noise: L = ||ε_θ(a_t, o, t) - ε||²

Inference:
  1. Sample noise: a_T ~ N(0, I)
  2. Iteratively denoise: a_{t-1} = denoise(a_t, o, t)
  3. Final action: a_0 (denoised)
```

### 5.2 DiffusionDrive (CVPR 2025)

Adapts diffusion policy for driving with key innovations:
- **Truncated diffusion:** Start from partially noisy anchor trajectories, not full noise
  - Pre-compute trajectory anchors from training data (K-means on expert trajectories)
  - At inference: select closest anchor, add small noise, denoise in 2-5 steps
  - **10x faster** than full diffusion
- Multi-modal trajectory output (different futures for different modes)
- Real-time on GPU (50+ FPS)

### 5.3 For Airside

```
Airside trajectory anchors (pre-computed from your bag data):
  Anchor 1: Straight driving (common, 60% of data)
  Anchor 2: Right turn (loading area approach)
  Anchor 3: Left turn (stand departure)
  Anchor 4: Slow docking (final approach to aircraft)
  Anchor 5: Reverse (backing to trailer)
  Anchor 6: Stop-and-go (yielding to crossing traffic)
  Anchor 7: Emergency stop

At inference:
  Select closest anchor → add small noise → 2-step denoise → trajectory
  Total latency: ~5ms (vs. 50ms for full diffusion)
```

---

## 6. Action Tokenization

### 6.1 VQ-BeT (Vector Quantized Behavior Transformer)

```
Expert trajectories → VQ-VAE encoder → discrete tokens
Observation → Transformer → predict next action token
Action token → VQ-VAE decoder → continuous action

Advantages:
  - Multi-modal: different tokens for different behaviors
  - Scalable: same architecture as LLMs
  - Composable: can combine tokens for novel behaviors
```

### 6.2 ACT (Action Chunking with Transformers)

```
Instead of predicting one action at a time:
  Predict a CHUNK of K future actions simultaneously

For driving (K=10 at 10Hz = 1 second of trajectory):
  observation → transformer → [a_t, a_{t+1}, ..., a_{t+9}]

Advantages:
  - Temporal consistency (no jitter between adjacent actions)
  - Faster effective rate (compute every 10 frames, execute smoothly)
  - Better for slow actuators (hydraulic steering has latency)
```

### 6.3 For Airside Vehicle Control

```
Action space: [steering_angle, velocity, acceleration]

Tokenization options:
  A) Discretize each: steering → 128 bins, velocity → 64 bins, accel → 64 bins
     Total: 128 × 64 × 64 = 524,288 possible action tokens (too many)

  B) VQ-VAE: learn 256-1024 action tokens from training data
     Each token = a typical control pattern (turn left slowly, brake gently, etc.)
     Much more manageable

  C) Continuous (flow matching): don't tokenize, use continuous action head
     Most flexible, best for smooth trajectories

Recommendation: Flow matching (option C) for trajectory generation,
VQ-BeT (option B) for high-level behavior selection
```

---

## 7. The Convergence Thesis

### 7.1 Are Driving and Robotics World Models Converging?

**Evidence FOR convergence:**
- Same architectures work for both (transformers, diffusion, flow matching)
- Same training paradigms (VLM backbone + action head)
- Physics is shared (rigid body dynamics, contact, friction)
- Language interface is shared (natural language instructions → actions)
- DreamerV3/V4 works across games, robotics, and (implicitly) driving
- NVIDIA's Physical AI vision explicitly unifies driving and robotics

**Evidence AGAINST convergence:**
- Driving is 2D control (steering + speed), manipulation is 6-7 DoF
- Driving operates at 10-50 Hz, manipulation at 5-20 Hz
- Driving has regulatory requirements (ISO 26262, SOTIF), robotics less so
- Sensor suites are different (LiDAR+camera for AV, depth camera for manipulation)
- Scale is different (100m for driving, 1m for manipulation)

### 7.2 The Prediction

```
2024: Separate communities (driving VLAs ≠ robotics VLAs)
2025: Shared architectures (both use DiT/Transformer + flow matching)
2026: Shared pre-training (Cosmos, pi0 backbones used for both)
2027: Shared models? (one foundation model, multiple action heads)
2028+: Unified Physical AI?

For airside AV: This convergence is GOOD because:
  - Robotic loading/unloading could use same backbone as driving
  - Vehicle + arm coordination (future: autonomous loaders)
  - More pre-training data available (combine driving + robotics)
  - Faster research transfer (robotics breakthroughs → driving faster)
```

---

## 8. Practical Transfer Opportunities for Airside

| Source Domain | Target Application | What Transfers | Effort |
|--------------|-------------------|---------------|--------|
| **pi0 flow matching** | Trajectory generation | Action head architecture | Medium |
| **RT-X cross-embodiment** | Multi-vehicle-type driving | Shared backbone across ADT3/STL2/POD | High |
| **Diffusion Policy** | Multi-modal trajectory planning | DiffusionDrive for airside | Low |
| **ACT chunking** | Smooth hydraulic control | Chunk predictions for steering | Low |
| **LeRobot dataset format** | Standardize airside data | Data pipeline compatibility | Low |
| **DreamerV4** | World model + RL | Latent world model for planning | Medium |
| **Genie 2** | Interactive simulation | Environment generation for testing | High |

---

## Sources

- Black et al. "pi0: A Vision-Language-Action Flow Model for General Robot Control." arXiv, 2024
- Brohan et al. "RT-2: Vision-Language-Action Models Transfer Web Knowledge to Robotic Control." arXiv, 2023
- Open X-Embodiment Collaboration. "Open X-Embodiment: Robotic Learning Datasets and RT-X Models." arXiv, 2023
- Chi et al. "Diffusion Policy: Visuomotor Policy Learning via Action Diffusion." RSS, 2023
- Zhao et al. "Learning Fine-Grained Bimanual Manipulation with Low-Cost Hardware (ACT)." RSS, 2023
- Lee et al. "Behavior Generation with Latent Actions (VQ-BeT)." ICML, 2024
- Hafner et al. "DreamerV3: Mastering Diverse Domains through World Models." Nature, 2025
- [LeRobot](https://github.com/huggingface/lerobot)
- [DiffusionDrive](https://github.com/hustvl/DiffusionDrive)
- NVIDIA Physical AI Vision (CES 2026)
