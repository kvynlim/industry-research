# Reinforcement Learning with Learned World Models: A Comprehensive Technical Report

## Table of Contents

1. [Model-Based RL with World Models](#1-model-based-rl-with-world-models)
2. [World Models for Planning](#2-world-models-for-planning)
3. [Sim-to-Real and Domain Adaptation](#3-sim-to-real-and-domain-adaptation)
4. [Offline RL and World Models](#4-offline-rl-and-world-models)
5. [Safety and Robustness](#5-safety-and-robustness)

---

## 1. Model-Based RL with World Models

### 1.1 The Dreamer Family (Danijar Hafner et al.)

The Dreamer series represents one of the most influential lines of work in model-based reinforcement learning, evolving from v1 through v4 with progressively more general and scalable architectures.

#### Dreamer v1 (2019)

[Dream to Control: Learning Behaviors by Latent Imagination](https://arxiv.org/abs/1912.01603) introduced the core paradigm: learn a world model, then train an actor-critic entirely inside "imagined" trajectories in latent space. The agent never needs to interact with the real environment during policy optimization -- it learns purely by propagating analytic gradients of learned state values back through imagined trajectories in the compact state space of the RSSM (Recurrent State-Space Model).

**Architecture:**
- **RSSM World Model**: Combines a deterministic recurrent path (GRU) with a stochastic latent variable, capturing both deterministic dynamics and environmental stochasticity.
- **Encoder**: Maps observations to posterior stochastic states.
- **Dynamics Predictor (Prior)**: Predicts the next stochastic state from the deterministic recurrent state alone (no observation needed).
- **Decoder, Reward, and Discount predictors**: Reconstruct observations and predict rewards from latent states.

#### Dreamer v2 (2020)

Key improvements included switching from Gaussian to **discrete categorical latent representations** (32 categorical variables, each with 32 classes), which provided more expressivity. It also introduced **KL balancing** between the dynamics and representation losses.

#### Dreamer v3 (2023)

[DreamerV3: Mastering Diverse Domains through World Models](https://arxiv.org/abs/2301.04104) -- published in *Nature* (2025) -- achieved a landmark: a **single set of hyperparameters** working across 150+ tasks spanning Atari, continuous control, DMLab, Crafter, and Minecraft.

**Key Technical Innovations:**

| Component | Technique | Purpose |
|---|---|---|
| **Symlog Predictions** | `symlog(x) = sign(x) * ln(\|x\| + 1)` | Compresses large reward magnitudes while preserving small ones; eliminates need for reward clipping or normalization |
| **Two-Hot Encoding** | Discretizes returns into K=255 buckets with soft assignment | Distributional RL for the critic, handling multimodal return distributions |
| **Free Bits** | KL terms clipped below 1 nat | Prevents degenerate solutions where dynamics are trivial |
| **1% Unimix** | Categorical distributions mixed with 1% uniform | Ensures exploration and avoids zero probabilities |
| **Percentile Return Normalization** | Normalizes returns by their 5th-95th percentile range | Scale-invariant actor training across domains |
| **Block GRU + RMSNorm + SiLU** | Modern architectural choices | Improved stability and expressivity |

**Result:** First algorithm to collect diamonds in Minecraft from scratch without human data or curricula, at 30M environment steps (~17 days simulated playtime). Larger models consistently increase both final performance and data-efficiency.

#### Dreamer v4 (2025)

[Training Agents Inside of Scalable World Models](https://arxiv.org/abs/2509.24527) introduced a fundamentally scalable architecture:

- **Block-causal transformer world model** that jointly attends over spatial patches and temporal sequences, replacing the RSSM.
- **Shortcut forcing objective** for efficient training.
- **Real-time interactive inference** on a single GPU.
- Learns general action conditioning from a small amount of labeled data, extracting most knowledge from **diverse unlabeled videos**.
- First agent to obtain diamonds in Minecraft **purely from offline data**, without any environment interaction, using 100x less data than previous methods (e.g., OpenAI VPT).

### 1.2 DayDreamer: Real-World Robot Learning

[DayDreamer](https://arxiv.org/abs/2206.14176) bridges the gap between simulated world model RL and physical robotics. It applies the Dreamer framework directly to real robots **without any simulator**.

**How it works:**
1. An actor process interacts with the physical environment, storing experiences in a replay buffer.
2. A learner samples from the buffer to train the world model.
3. The actor-critic is trained entirely on imagined trajectories from the world model.
4. The world model fuses proprioceptive and visual inputs into compact discrete representations via a recurrent sequence model.

**Real-world results (same hyperparameters across all tasks):**
- **Quadruped robot**: Learns to roll off its back, stand up, and walk from scratch in **1 hour** without resets. Adapts to perturbations within 10 minutes.
- **Robotic arms**: Learns pick-and-place from camera images and sparse rewards, approaching human teleoperation performance.
- **Wheeled robot**: Navigates to goals purely from camera images, resolving orientation ambiguity autonomously.

### 1.3 TD-MPC and TD-MPC2

**TD-MPC** (Temporal Difference Learning for Model Predictive Control) performs local trajectory optimization in the latent space of a learned **implicit (decoder-free) world model**. Unlike Dreamer, it does not reconstruct observations -- the world model is trained purely through temporal-difference value prediction.

**[TD-MPC2](https://arxiv.org/abs/2310.16828)** (ICLR 2024) introduced several improvements:

- **SimNorm**: Partitions the latent state into groups and projects each onto a fixed-dimensional simplex via softmax, critical for stabilizing deep latent world models.
- **LayerNorm + Mish activation** replacing bare MLPs with ELU.
- Achieves consistently strong results with a **single set of hyperparameters** across 104 tasks spanning DMControl, Meta-World, ManiSkill2, and MyoSuite.
- A single **317M parameter agent** successfully performs 80 tasks across multiple domains, embodiments, and action spaces.
- Compares favorably to SAC (model-free), DreamerV3, and TD-MPC.
- Open-sourced 300+ model checkpoints and multi-task datasets.

### 1.4 MBPO (Model-Based Policy Optimization)

[MBPO](https://arxiv.org/abs/1906.08253) (Janner et al., NeurIPS 2019) addresses a fundamental tension: model-based data can reduce off-policy error but introduces compounding model bias over long horizons.

**Key insights:**
- Provides a **monotonic improvement guarantee** -- a lower bound on a policy's true return expressed in terms of model return, rollout length, policy divergence, and model error.
- Rather than full-length rollouts from initial states, MBPO performs **short branched rollouts from previously encountered real states**, balancing model utility against error accumulation.

**Algorithm:**
1. Train a **probabilistic ensemble of dynamics models** on real transitions.
2. Generate short synthetic rollouts (k steps) branching from real states in the replay buffer.
3. Train SAC (Soft Actor-Critic) on the combined real + synthetic data.

**Results:** Achieves model-free asymptotic performance with ~10x fewer real samples, scaling to state dimensions and horizon lengths that cause previous model-based methods to fail.

### 1.5 MuZero and Its Descendants

**MuZero** (DeepMind) learns a world model that predicts only **task-relevant quantities** -- future rewards, policies, and values -- rather than reconstructing observations. Planning uses **Monte Carlo Tree Search (MCTS)** over simulated trajectories in the learned latent space.

#### Key Descendants:

| Method | Key Innovation |
|---|---|
| **EfficientZero** | Self-supervised consistency loss + temporal difference targets for sample-efficient Atari (human-level at 100k frames) |
| **EfficientZero V2** | Extends to continuous action spaces via Gaussian policy + Gumbel search; surpasses EfficientZero |
| **UniZero** | Transformer-based world model that **disentangles latent state from implicit history**; matches MuZero (4-frame stack) with single-frame input on 17/26 Atari games |
| **Sampled MuZero** | Extends MCTS to continuous action spaces via action sampling |
| **Equivariant MuZero** | Enforces symmetry equivariance in the world model networks |
| **ObjectZero** | Object-centric representations integrated with MCTS for structured environments |

### 1.6 IRIS: Transformers as World Models

[IRIS](https://arxiv.org/abs/2209.00588) (ICLR 2023 Oral) composes a **discrete autoencoder** (tokenizing frames) with an **autoregressive Transformer** that predicts future frame tokens, rewards, and episode termination.

- For each action, the Transformer autoregressively unfolds new frame tokens that can be decoded into observations.
- The agent learns behaviors **entirely in imagination** -- the world model quality is the cornerstone.
- On Atari 100k: mean human-normalized score of **1.046**, outperforming humans on 10/26 games.
- Conceptually a large, differentiable, neural version of Dyna-Q operating in latent space.

### 1.7 DIAMOND: Diffusion World Models

[DIAMOND](https://arxiv.org/abs/2405.12399) (NeurIPS 2024 Spotlight) uses a **diffusion model** as the world model, challenging discrete-latent approaches.

**Key technical details:**
- Uses the **EDM (Elucidating the Design Space) framework** rather than DDPM, which maintains stability even with single-step denoising due to better handling of autoregressive error accumulation.
- **3 denoising steps** found optimal: sufficient for resolving ambiguous transitions (e.g., unpredictable opponent movements) while remaining efficient.
- Action conditioning removes ambiguity for controllable elements.
- Captures **visual details** that discrete tokenization loses, leading to better RL agent performance.

**Results:**
- Atari 100k: mean human-normalized score of **1.46** (46% above human), new SOTA for world-model-trained agents.
- Scaled to **CS:GO** as a standalone neural game engine: 381M parameters with two-stage pipeline (low-res dynamics + high-res upsampling).

### 1.8 Application to Driving and Vehicles

World models have become central to autonomous driving research, with approaches spanning multiple modalities:

**Driving-Specific World Model Systems:**

| System | Approach | Key Capability |
|---|---|---|
| **GAIA-1/GAIA-2** (Wayve) | Transformer-based; video + text + control as unified token stream (9B params). GAIA-2 uses latent diffusion for multi-camera generation | Minute-long controllable driving video generation with coherent semantics |
| **DriveDreamer / DriveDreamer-2 / DriveDreamer4D** | Progressive series from 2D video to spatiotemporally coherent 4D outputs | LLM-prompted scenario generation, 4D world modeling |
| **Think2Drive** (ECCV 2024) | MBRL in latent world model space | Expert-level CARLA v2 proficiency in 3 days on a single A6000 GPU |
| **MILE** | Joint environment transition model + driving behavior learning from offline data | Generalizes to unseen towns and weather in CARLA |
| **OccWorld** | Converts occupancy voxels into autoregressive scene tokens | Geometric understanding for planning |
| **DriveWorld** | Memory-augmented world model for planning | Integrates occupancy prediction with trajectory conditioning |
| **GenAD** | Rolls latent representations forward for ego-conditioned futures | Generative planning without explicit trajectory sampling |
| **Vista** | Generalizable driving world model with high fidelity | Versatile controllability across driving scenarios |
| **WorldRFT** (AAAI 2026) | Latent world model + reinforcement fine-tuning with GRPO | Reduces collision rates by 83% on nuScenes; SOTA on nuScenes and NavSim |

**Four primary generation modalities in driving world models:**
1. **Image-based**: Photorealistic 2D/video frames via diffusion/transformers
2. **BEV-based**: Top-down representations (FIERY, GenAD, CarFormer)
3. **Occupancy Grid**: 3D voxels with occupancy probabilities (OccWorld, OccSora, DynamicCity)
4. **Point Cloud**: Preserving LiDAR spatial fidelity (Copilot4D, LiDARCrafter)

---

## 2. World Models for Planning

### 2.1 Model Predictive Control in Learned Latent Spaces

**PlaNet** (Hafner et al., 2018) -- [Learning Latent Dynamics for Planning from Pixels](https://planetrl.github.io/) -- pioneered purely model-based planning from pixels using MPC in latent space:
- Learns a latent dynamics model with both **deterministic and stochastic** transition components.
- Plans using the **Cross-Entropy Method (CEM)**: samples thousands of action sequences, evaluates them via the world model, and iteratively refines toward high-reward trajectories.
- Multi-step variational inference objective called **latent overshooting**.

**Dream-MPC** improves on this by using **gradient ascent** instead of sampling-based methods (CEM/MPPI), performing local trajectory optimization with a latent dynamics model. This is more sample-efficient than evaluating hundreds of action sequences per planning step.

**TD-MPC/TD-MPC2** integrate short-horizon MPC with long-horizon TD learning:
- Short planning horizon via MPC in latent space handles near-term dynamics accurately.
- Value function learned via TD captures long-term consequences beyond the planning horizon.
- The combination avoids the need for very long (and error-prone) model rollouts.

### 2.2 Tree Search in World Model Latent Spaces

MuZero-style algorithms perform **Monte Carlo Tree Search (MCTS)** in a learned latent space, which offers several advantages over pixel-space search:

- **Compact representation**: Search nodes are latent vectors rather than full observations.
- **Learned transition model**: The dynamics network predicts next latent states and rewards without needing ground-truth environment rules.
- **Value-guided search**: A learned value function provides long-horizon estimates at leaf nodes.

**Recent advances:**
- **ObjectZero**: Uses object-centric representations as MCTS nodes, enabling structured reasoning about entity interactions.
- **WorldPlanner**: Combines MCTS with MPC using action-conditioned visual world models for long-horizon robotic planning from unstructured play data.
- **Hierarchical MCTS**: Discovers latent skills and integrates them with tree search for efficient higher-level decision-making.

### 2.3 Planning with Diffusion Models

[Diffuser](https://arxiv.org/abs/2205.09991) (Janner et al., ICML 2022) reframes trajectory optimization as **iterative denoising**:

- Plans by progressively refining randomly sampled noise into coherent trajectories.
- The planning horizon is determined by the size of the initial noise vector.
- Functions as an **unconditional prior over possible behaviors**; test-time tasks are specified by guiding denoised trajectories with reward functions or constraints.

**Key advantages over autoregressive planning:**
- **No compounding errors**: Generates entire trajectories simultaneously rather than one-step-at-a-time.
- **Flexible conditioning**: A single model supports reward-guided planning, goal-conditioned planning, and constraint satisfaction.
- **Long-horizon capability**: If the model accurately predicts long trajectories, planning quality follows automatically.

**Extensions:**
- **DiffuserLite**: Real-time diffusion planning via efficiency optimizations.
- **MetaDiffuser**: Diffusion-based planning for offline meta-RL.
- **Trajectory Diffuser**: Hybrid autoregressive + diffusion approach for faster feasible trajectory generation.
- **DDPO**: Training diffusion models with RL by treating denoising as a multi-step decision process.

### 2.4 SafeDreamer: Safe RL with World Models

[SafeDreamer](https://arxiv.org/abs/2307.07176) (ICLR 2024) integrates **Lagrangian-based safety constraints** into the Dreamer framework:

**Two algorithmic variants:**
- **OSRP-Lag** (Online Safety-Reward Planning with Lagrangian): Performs safety-constrained planning during online interaction.
- **BSRP-Lag** (Background Safety-Reward Planning with Lagrangian): Integrates safety constraints into background (imagination-based) planning.

**Technical approach:**
- Employs the **Constrained Cross-Entropy Method** in the planning process.
- Balances long-term reward and cost via Lagrangian multipliers that are dynamically adjusted.
- World model accuracy for safety-related states is critical -- reconstruction loss and latent hidden state size significantly impact the ability to reduce cost.

**Result:** First algorithm to achieve **nearly zero-cost performance** using vision-only input in the Safety-Gymnasium benchmark.

### 2.5 How World Models Enable "Imagination" for Decision-Making

The concept of "imagination" in RL directly parallels cognitive science's notion of **mental simulation** -- the human capacity to imagine what will or could happen before acting. World models operationalize this:

1. **Forward simulation**: Given a state and candidate action sequence, the world model predicts future states, rewards, and termination signals.
2. **Branching evaluation**: Multiple action sequences can be evaluated in parallel ("what-if" reasoning).
3. **Gradient-based optimization**: Unlike real environments, imagined trajectories are differentiable, enabling direct gradient-based policy improvement.
4. **Risk assessment**: The model can simulate dangerous scenarios without physical consequences.
5. **Sample efficiency**: Thousands of imagined trajectories can be generated per real interaction step.

This paradigm is especially powerful for autonomous driving, where trial-and-error in the real world is prohibitively dangerous, and for robotics, where physical interaction is slow and costly.

---

## 3. Sim-to-Real and Domain Adaptation

### 3.1 Learning World Models from Real Data vs. Simulation

**From simulation:**
- Traditional approach: build a handcrafted physics simulator, train RL agents, then transfer.
- World models can be learned from simulator data (e.g., CARLA for driving), inheriting the simulator's physics but learning richer visual/perceptual representations.
- The primary limitation is the **reality gap** -- differences between simulated and real dynamics, visuals, and distributions.

**From real data:**
- DayDreamer demonstrates that world models can be learned directly from real-world interaction data, bypassing simulation entirely.
- Dreamer v4 shows that world models can learn from **diverse unlabeled real-world video** combined with small amounts of action-labeled data.
- Real-data world models naturally capture the true dynamics distribution but require careful data collection and are limited by available interaction data.

**Hybrid approaches:**
- RLVR-World: Self-supervised method using **sim-to-real gap rewards** that align simulated next states with observed real next states, encouraging consistency between internal simulations and actual dynamics.
- Video world models yield smaller discrepancies between real and simulated success rates compared to handcrafted simulators, suggesting world models as a scalable bridge.

### 3.2 Domain Randomization in Learned Simulators

**Classical domain randomization** randomizes simulation parameters (colors, textures, lighting, dynamics) so the policy learns to be robust across a distribution that includes the real world as one sample.

**Advanced approaches:**
- **Active Domain Randomization (ADR)**: Dynamically steers training toward regions where the agent struggles, rather than uniform randomization. Results in stronger zero-shot sim-to-real transfer.
- **DROPO** (Sim-to-Real Transfer with Offline Domain Randomization): Uses offline data to calibrate randomization ranges.
- **Learned domain randomization**: Neural network-based simulators can learn to generate diverse training conditions that maximize policy robustness.

### 3.3 Bridging the Sim-to-Real Gap

Key methodologies include:

| Strategy | Mechanism | Trade-off |
|---|---|---|
| **Domain Randomization** | Train across randomized simulator parameters | Increases learning complexity |
| **Domain Adaptation** | Align feature distributions between sim and real | Requires some real data |
| **System Identification** | Fit simulator parameters to real-world observations | Limited by simulator expressivity |
| **Progressive Nets** | Continual learning across tasks with lateral connections | Prevents catastrophic forgetting |
| **Latent Space Transfer** | Learn domain-invariant latent representations | May lose domain-specific information |
| **World Model as Bridge** | Learn dynamics models that generalize across domains | Most promising recent direction |

**PAC-Bayesian bounds** (used by SafeDrive Dreamer) provide theoretical guarantees for generalization error between simulated and real-world scenarios, enabling more principled sim-to-real knowledge transfer.

### 3.4 Progressive Learning Strategies

- **Curriculum learning**: Start with simple scenarios, progressively increase complexity.
- **Progressive neural networks**: Add new columns of network capacity for each task/domain while freezing previous ones, enabling transfer without catastrophic forgetting.
- **Adaptive world model alignment (AdaWM)**: Diagnoses policy-world model mismatch during execution and triggers alignment-driven refinement, adapting progressively to distribution shift.
- **Goal-update curriculum**: Homogenizes the sim/real interface by gradually adjusting goals to bridge the adaptation burden.

---

## 4. Offline RL and World Models

### 4.1 Learning World Models from Offline Driving Data

Offline RL is especially attractive for autonomous driving because:
- Large-scale driving datasets already exist (nuScenes, Waymo, nuPlan).
- Online interaction for learning is dangerous and expensive.
- Fixed datasets enable rapid experimental iteration.

**Key approaches:**

- **MILE**: Jointly learns environment transition models and driving behaviors from offline datasets, generalizing to unseen towns and weather conditions.
- **Think2Drive**: Trains a latent world model (transition, reward, termination models) from offline data, achieving expert-level CARLA v2 performance in 3 days.
- **Dreamer v4**: Extracts knowledge from diverse unlabeled videos, learns action conditioning from small amounts of labeled data, and trains agents purely in imagination -- first to obtain diamonds in Minecraft from offline data alone.

**Core challenge:** Without online interaction, the agent cannot correct model inaccuracies or explore beyond the dataset's state-action distribution, making value overestimation for out-of-distribution actions a critical problem.

### 4.2 Conservative World Models

Several methods address the overestimation problem in offline model-based RL:

**MOPO (Model-based Offline Policy Optimization):**
- Builds a lower bound for expected return under true dynamics by **penalizing rewards proportional to model uncertainty**.
- Uses ensemble disagreement as the uncertainty measure.
- Constructs a **Pessimistic MDP (P-MDP)** where the agent is discouraged from visiting states where the model is uncertain.

**MOReL:**
- Similar P-MDP construction but uses a **HALT state** -- when model uncertainty exceeds a threshold, the trajectory terminates with a pessimistic reward.

**COMBO (Conservative Offline Model-Based RL):**
- Regularizes the value function on **out-of-support state-action tuples** generated via model rollouts.
- Does not require explicit uncertainty estimation -- instead uses a CQL-style conservative value penalty.

**ORPO (Optimistic Rollouts for Pessimistic Optimization):**
- Generates **optimistic model rollouts** (exploring beyond the dataset) but applies **pessimistic policy optimization**.
- Better utilizes the generalization ability of dynamics models while maintaining safety.

### 4.3 Decision Transformer and Trajectory Optimization

[Decision Transformer](https://arxiv.org/abs/2106.01345) (Chen et al., NeurIPS 2021) reframes RL as **conditional sequence modeling**:

- Uses a causally masked Transformer conditioned on **(return-to-go, state, action)** tuples.
- At test time, conditions on a **desired return** to generate actions that achieve that return.
- No value functions or policy gradients -- purely supervised learning on offline trajectories.
- Matches or exceeds SOTA model-free offline RL on Atari, OpenAI Gym, and Key-to-Door tasks.

**Trajectory Transformer:**
- Treats offline RL as one big sequence modeling problem.
- Discretizes states, actions, and rewards into tokens and models them autoregressively.
- Beam search at inference time replaces traditional planning.

### 4.4 GATO-like Generalist Approaches

[GATO](https://arxiv.org/abs/2205.06175) (DeepMind, 2022) demonstrated a single 1.2B-parameter Transformer trained on **604 distinct tasks** spanning:
- Atari games, continuous control, robotic manipulation
- Image captioning, dialogue
- Real robot arm block stacking

**Relationship to world models:** While GATO itself is a policy (not a world model), its multi-task, multi-modal tokenization architecture has influenced how world models are designed. Dreamer v4 and TD-MPC2 both demonstrate that scaling model parameters and training data across tasks leads to emergent generalist capabilities in world-model agents.

---

## 5. Safety and Robustness

### 5.1 Using World Models for Safety Verification

World models enable **"what-if" rollouts** -- the agent can rehearse futures before committing to actions:

- **Trajectory evaluation**: Before executing an action sequence, roll it out in the world model to check for predicted collisions, constraint violations, or unsafe states.
- **Proactive hazard detection**: The model predicts environmental changes and identifies dangerous situations before they materialize.
- **SafeDreamer**: Integrates Lagrangian constraints directly into world model planning, achieving nearly zero safety violations.
- **Nightmare Dreamer** (2026): Trains two specialized actors (control + safe) using a learned world model. A planning mechanism **switches between policies based on predicted future costs**, achieving nearly zero safety violations with ~20x efficiency improvement over model-free baselines.
- **SafeDrive Dreamer**: Integrates world models with CMDP for vision-based autonomous navigation; uses PAC-Bayesian bounds for sim-to-real safety transfer; improves collision avoidance by 3.8%.

**Critical limitation:** Current learning pipelines **lack provable bounds required for certification** -- formal safety guarantees remain an open challenge.

### 5.2 Adversarial Scenario Generation

World models are powerful tools for generating safety-critical test scenarios:

- **Naturalistic adversarial generation**: Uses naturalistic human driving priors combined with RL to produce diverse, realistic safety-critical scenarios at scale.
- **CVAE + LLM frameworks**: Conditional variational autoencoders learn latent traffic structures for physically consistent scenarios, while LLMs act as adversarial reasoning engines.
- **STRIVE** (NVIDIA): Generates useful accident-prone driving scenarios via a learned traffic prior.
- **Hierarchical RL-based generation**: Scheduling, conflict prediction, and evaluation modules segment adversarial scenario generation into guidance, adversarial, and exploration periods.

### 5.3 Out-of-Distribution Detection via World Models

OOD detection is critical because learned models and policies produce unpredictable outputs without signaling uncertainty when encountering novel situations.

**Methods:**

| Approach | Mechanism |
|---|---|
| **Ensemble disagreement** | Multiple models trained on bootstrap samples; high disagreement signals OOD |
| **Dropout-based uncertainty** | MC-Dropout at inference provides approximate Bayesian uncertainty |
| **UBOOD framework** | Models OOD as one-class classification using epistemic uncertainty |
| **Dynamics-based detection** | OOD formulated as severe MDP perturbations detected via probabilistic dynamics model ensembles |
| **UMBRELLA** | Stochastic ensembles with adaptive low-rank updates exposing epistemic and aleatoric risk |

**For autonomous driving:** Performance degrades in OOD weather, geography, or traffic densities. AdaWM addresses this by diagnosing policy-world model mismatch and triggering alignment-driven finetuning at runtime.

### 5.4 Uncertainty Estimation in World Model Predictions

Accurate uncertainty estimation is essential for:
1. **Conservative planning**: Avoiding actions whose outcomes are highly uncertain.
2. **Exploration guidance**: Directing data collection toward uncertain regions.
3. **Safety monitoring**: Detecting when the world model's predictions become unreliable.

**Practical methods:**
- **Probabilistic ensemble models** (used in MBPO, MOPO): Train N models; use variance of predictions as epistemic uncertainty.
- **Distributional world models**: Predict distributions over next states rather than point estimates (used in DreamerV3's categorical representations).
- **Conformal prediction**: Provides distribution-free prediction intervals with coverage guarantees.
- **Ensemble Quantile Networks**: Simultaneously quantify aleatoric and epistemic uncertainty for robust autonomous vehicle control.

**Key insight:** In the context of world models for driving, uncertainty estimation serves a dual role -- it enables **conservative decision-making** (avoiding uncertain actions) and **targeted data augmentation** (generating training scenarios in regions of high uncertainty).

---

## Summary: The State of the Field

The convergence of world models with reinforcement learning has produced increasingly capable systems. Several key trends define the current moment:

1. **Scaling**: Dreamer v4 and TD-MPC2 demonstrate that world model agents improve predictably with parameter count and data scale, mirroring foundation model scaling in language and vision.

2. **Generalization**: Single-hyperparameter algorithms (DreamerV3, TD-MPC2) work across hundreds of diverse tasks, removing the need for domain-specific tuning.

3. **Offline learning**: The ability to learn world models from pre-collected data (Dreamer v4, MILE, Think2Drive) is especially important for autonomous driving where online interaction is dangerous.

4. **Diffusion as dynamics**: DIAMOND and Diffuser show that diffusion models can serve both as world models and as planners, capturing visual details and generating entire trajectories.

5. **Safety integration**: SafeDreamer, Nightmare Dreamer, and WorldRFT demonstrate that safety constraints can be directly incorporated into world model planning.

6. **Driving applications**: World models are rapidly becoming the backbone of end-to-end autonomous driving systems, spanning perception (OccWorld), prediction (GAIA-1/2), planning (Think2Drive, WorldRFT), and simulation (Vista, DriveDreamer).

The field is moving toward systems where a single large world model, trained on diverse data, supports imagination-based planning, safety verification, and continuous adaptation -- much like the human cognitive architecture it was inspired by.

---

## Sources

- [DreamerV3 - Mastering Diverse Domains through World Models (arXiv)](https://arxiv.org/abs/2301.04104)
- [DreamerV3 - Nature Publication](https://www.nature.com/articles/s41586-025-08744-2)
- [Dreamer v4 - Training Agents Inside of Scalable World Models](https://arxiv.org/abs/2509.24527)
- [DayDreamer: World Models for Physical Robot Learning](https://arxiv.org/abs/2206.14176)
- [TD-MPC2: Scalable, Robust World Models for Continuous Control](https://arxiv.org/abs/2310.16828)
- [MBPO Paper](https://arxiv.org/abs/1906.08253)
- [MuZero - DeepMind Blog](https://deepmind.google/blog/muzero-mastering-go-chess-shogi-and-atari-without-rules/)
- [UniZero](https://arxiv.org/abs/2406.10667)
- [IRIS - Transformers are Sample-Efficient World Models](https://arxiv.org/abs/2209.00588)
- [DIAMOND - Diffusion for World Modeling](https://arxiv.org/abs/2405.12399)
- [Diffuser: Planning with Diffusion](https://arxiv.org/abs/2205.09991)
- [PlaNet - Learning Latent Dynamics for Planning from Pixels](https://planetrl.github.io/)
- [SafeDreamer: Safe RL with World Models](https://arxiv.org/abs/2307.07176)
- [Nightmare Dreamer](https://arxiv.org/abs/2601.04686)
- [SafeDrive Dreamer](https://www.sciencedirect.com/science/article/pii/S1110016824011943)
- [Think2Drive (ECCV 2024)](https://arxiv.org/abs/2402.16720)
- [WorldRFT (AAAI 2026)](https://arxiv.org/abs/2512.19133)
- [GAIA-1/2](https://arxiv.org/abs/2309.17080)
- [Decision Transformer](https://arxiv.org/abs/2106.01345)
- [GATO: A Generalist Agent](https://arxiv.org/abs/2205.06175)
- [MOPO Paper](https://proceedings.nips.cc/paper/2020/file/a322852ce0df73e204b7e67cbbef0d0a-Paper.pdf)
- [Awesome World Models for AD (GitHub)](https://github.com/LMD0311/Awesome-World-Model)
