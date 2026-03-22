# Evaluation Methods, Benchmarks, and Metrics for World Models and Autonomous Driving

> Research compiled March 2026. Covers SOTA leaderboards, world-model-specific benchmarks, metrics taxonomies, evaluation paradigms, and recommendations for building an airside-specific evaluation suite.

---

## Table of Contents

1. [Current SOTA Leaderboards and Benchmarks](#1-current-sota-leaderboards-and-benchmarks)
2. [World Model Benchmarks](#2-world-model-benchmarks)
3. [Metrics Taxonomy](#3-metrics-taxonomy)
4. [Open-Loop vs Closed-Loop Evaluation](#4-open-loop-vs-closed-loop-evaluation)
5. [Safety-Focused Evaluation](#5-safety-focused-evaluation)
6. [Evaluation Without Ground Truth](#6-evaluation-without-ground-truth)
7. [Sim-to-Real Evaluation Gap](#7-sim-to-real-evaluation-gap)
8. [Statistical Significance Requirements](#8-statistical-significance-requirements)
9. [Building an Airside-Specific Eval Suite](#9-building-an-airside-specific-eval-suite)
10. [Key Takeaways and Recommendations](#10-key-takeaways-and-recommendations)

---

## 1. Current SOTA Leaderboards and Benchmarks

### 1.1 nuScenes

**Status (early 2026):** The nuScenes benchmark remains the most widely cited evaluation platform for 3D perception and planning in autonomous driving, though increasingly complemented by newer alternatives.

**Primary Metrics:**

- **nuScenes Detection Score (NDS):** A composite metric that is a weighted sum of mean Average Precision (mAP) and five True Positive (TP) metrics:
  - NDS = (1/10) * [5 * mAP + sum(TP_scores)]
  - TP metrics: mean Average Translation Error (mATE), mean Average Scale Error (mASE), mean Average Orientation Error (mAOE), mean Average Velocity Error (mAVE), mean Average Attribute Error (mAAE)
  - Each TP error is converted to a score: TP_score = max(1 - TP_error, 0.0)
- **mAP:** Uses 2D center distance matching on the ground plane rather than IoU-based affinities, which is a deliberate design choice to avoid penalizing orientation or size errors twice.

**Planning Metrics on nuScenes:**

- L2 displacement error at 1s, 2s, 3s horizons
- Collision rate (ego-vehicle trajectory intersection with other agents)
- Miss rate at 2m threshold

**Recent SOTA:**

- FastDriveVLA (XPENG/Peking University, AAAI 2026) achieved SOTA on nuScenes planning with 7.5x reduction in computational load
- DriveWorld-VLA unified world modeling and planning, achieving SOTA on both NAVSIM and nuScenes
- Temporal Residual World Model (TR-World) demonstrated SOTA planning performance

**Known Limitations:**

- Open-loop planning evaluation on nuScenes has been shown to be unreliable; models that simply memorize ego status can perform well ("Is Ego Status All You Need?", 2023)
- The dataset is relatively small (1,000 scenes) compared to newer alternatives
- Scenes are predominantly from Boston and Singapore, limiting geographic diversity

### 1.2 Waymo Open Dataset (WOD)

**Status (early 2026):** The 2025 challenges ran March 31 - May 22, 2025. No 2026 challenges had been announced as of writing.

**2025 Challenge Tracks:**

| Track | Task | Primary Metric |
|-------|------|----------------|
| Vision-based End-to-End Driving (WOD-E2E) | Predict driving trajectories from cameras | Rater Feedback Score (RFS) |
| Scenario Generation | Add agents to scenes for realistic traffic | Scenario realism metrics |
| Interaction Prediction | Forecast complex agent interactions | Interaction-aware metrics |
| Sim Agents (WOSAC) | Generate realistic future behaviors for all agents | Realism Meta Metric |

**Rater Feedback Score (RFS) -- novel metric for WOD-E2E 2025:**

- Unlike conventional ADE/FDE metrics, RFS measures alignment with human rater trajectory preference labels
- Each trajectory scored on five dimensions: Safety, Legality, Reaction Time, Braking Necessity, Efficiency
- Major infractions incur a -2 penalty, minor -1, with Rank 1 trajectories guaranteed at least 6 points
- Key finding: RFS and ADE are only weakly correlated, indicating geometric proximity does not guarantee human-preferred or safe behavior

**Realism Meta Metric (Sim Agents):**

- Composite metric: weighted average of kinematic, interaction, and map-based components
- Metrics combined using negative log-likelihood (NLL) or Kolmogorov-Smirnov normalization
- Collisions and road departures are double-weighted for safety emphasis
- Evaluated over 32 stochastic rollouts per scenario (closed-loop consistency enforced)
- 2025 top result: TrajTok achieved 0.7852 Realism Meta Metric, 0.9207 on map-based metrics

**WOD-E2E Dataset:** 4,021 segments (~12 hours) specifically curated for long-tail scenarios occurring <0.03% in daily driving, with 360-degree camera views from 8 cameras.

### 1.3 Argoverse 2

**Status (early 2026):** Three active competitions for CVPR 2025 Workshop, with test split and EvalAI leaderboard for Scenario Mining opening February 18, 2026.

**Active Competition Tracks:**

1. **Multi-agent Motion Forecasting** -- predicting future motion of multiple key actors
2. **Scenario Mining** -- finding safety-critical scenarios via natural language
3. **Lidar Scene Flow** -- capturing motion of pedestrians and Vulnerable Road Users

**Motion Forecasting Metrics:**

| Metric | Description | Notes |
|--------|-------------|-------|
| minADE_K | Average L2 between best-of-K trajectory and GT | Minimum over K predictions |
| minFDE_K | L2 at final timestep of best-of-K trajectory | Endpoint accuracy |
| Miss Rate | % scenarios where no prediction within 2m of GT endpoint | Strict failure metric |
| brier-minFDE | minFDE + (1-p)^2 penalty | Incorporates prediction confidence |
| brier-minADE | minADE + (1-p)^2 penalty | Primary ranking metric at K=6 |

**Dataset:** Six U.S. cities (Austin, Detroit, Miami, Pittsburgh, Palo Alto, Washington D.C.), providing diverse geographic coverage.

### 1.4 NAVSIM

**Status (early 2026):** NAVSIM v2 is the primary evaluation framework for the AGC2025 NAVSIM End-to-End Driving Challenge. Published at CoRL 2025 (Pseudo-Simulation paper) and NeurIPS 2024 (original NAVSIM).

**Core Innovation: Pseudo-Simulation.** Bridges open-loop and closed-loop paradigms by augmenting real data with synthetic observations positioned near predicted trajectories, achieving strong correlation with closed-loop simulation at 6x less compute. Unlike traditional closed-loop simulation, pseudo-simulation is neither sequential nor interactive, enabling open-loop computation of all evaluation metrics.

**Extended Predictive Driver Model Score (EPDMS):**

```
EPDMS = (Product of penalty multipliers) * (Weighted average of quality scores)
```

**Penalty Multiplier Sub-metrics (binary/ternary gates):**

| Metric | Values | Description |
|--------|--------|-------------|
| NC (No at-fault Collisions) | {0, 0.5, 1} | Penalizes collision involvement |
| DAC (Drivable Area Compliance) | {0, 1} | Must stay within valid driving zones |
| DDC (Driving Direction Compliance) | {0, 0.5, 1} | Enforces proper directional travel (v2) |
| TLC (Traffic Light Compliance) | {0, 1} | Traffic signal adherence (v2) |

**Weighted Average Sub-metrics:**

| Metric | Weight | Range | Description |
|--------|--------|-------|-------------|
| EP (Ego Progress) | 5 | [0,1] | Forward movement progress |
| TTC (Time to Collision) | 5 | {0,1} | Safety margin from obstacles |
| LK (Lane Keeping) | 2 | {0,1} | Centerline deviation penalty (v2) |
| HC (History Comfort) | 2 | {0,1} | Trajectory smoothness vs history (v2) |
| EC (Extended Comfort) | 2 | {0,1} | Inter-frame acceleration/jerk (v2) |

**False-Positive Penalty Filtering:** If the human driver also violated a rule, the planner is not penalized -- preventing unfair deductions for necessary maneuvers.

**Recent SOTA:** Latent TransFuser v6 (LEAD, CVPR 2026) improved EPDMS by +6 points over Latent TransFuser baseline.

### 1.5 CARLA Leaderboard 2.0/2.1

**Status (early 2026):** Leaderboard 2.1 released March 2025 with modified infraction scoring. The CARLA AD Challenge was not run in 2025 due to unforeseen circumstances, but the leaderboard remains available for local evaluation.

**Primary Metric: Driving Score**

```
Driving Score = Route Completion (R_i) * Infraction Penalty (P_i)
```

where `P_i = 1 / (1 + sum(c_j * infractions_j))`, starting at 1.0.

**Infraction Coefficients (v2.1):**

| Infraction | Coefficient |
|------------|------------|
| Pedestrian collision | 1.0 |
| Vehicle collision | 0.70 |
| Static element collision | 0.60 |
| Running red light | 0.40 |
| Failing to yield to emergency vehicles | 0.40 |
| Running stop sign | 0.25 |
| Scenario timeout (4 min) | 0.40 |
| Insufficient speed | up to 0.40 |

**Route specifications:** 20 long routes (~12 km) in Town 13, each with ~90 safety-critical scenarios across 21 types.

**Sensor Modalities:** SENSORS track (8 cameras, 2 LiDAR, 4 RADAR, GNSS, IMU, speedometer) and MAP track (adds OpenDRIVE HD map).

**SOTA:** LEAD/TransFuser v6 (CVPR 2026) achieved 12-point Driving Score increase over TFv5 on Bench2Drive and more than doubled prior SOTA on Longest6 v2.

**Related Benchmarks:**

- **Bench2Drive** (NeurIPS 2024): 2M annotated frames, 220 routes across 44 interactive scenarios, 23 weather conditions, 12 towns. The only benchmark to evaluate E2E-AD methods under closed-loop with multi-ability analysis.
- **DriveE2E** (2025): First closed-loop benchmark based on real-world traffic scenarios, integrating 800 scenarios from infrastructure sensor data into CARLA digital twins of 15 real-world intersections.

---

## 2. World Model Benchmarks

### 2.1 WorldModelBench (NeurIPS 2025 Datasets & Benchmarks)

**Purpose:** Evaluate video generation models as world simulators across application-driven domains.

**Dataset:** 350 image-text condition pairs across 7 domains (Robotics, Driving, Industry, Human Activities, Gaming, Animation, Natural) and 56 subdomains. Supports both text-to-video (T2V) and image-to-video (I2V) models.

**Evaluation Dimensions:**

| Dimension | Score Range | What It Measures |
|-----------|------------|-----------------|
| Instruction Following | 0-3 | Task completion from absent subjects to full execution |
| Physics Adherence | 0-5 | Five binary tests: Newton's First Law, mass conservation, fluid mechanics, object impenetrability, gravity |
| Commonsense | 0-2 | Frame-wise and temporal quality |
| **Total** | **0-10** | Combined world modeling capability |

**Human Annotation:** 67K labels from 65 annotators, 87.1% agreement within absolute score difference of 2, 70% pairwise agreement.

**Models Evaluated:** 14 frontier models including KLING, Minimax, Runway, Luma, CogVideoX, OpenSora.

**Key Results:**

- Best model (KLING) achieved only 61% correct task completion
- I2V models consistently underperformed T2V counterparts
- Low correlation (0.28) with VBench physics scores, demonstrating unique evaluation value
- Fine-tuned 2B judger model achieved 4.1% averaged prediction error, outperforming GPT-4o

### 2.2 WorldLens (CVPR 2026)

**Purpose:** Full-spectrum evaluation of driving world models in the real world, bridging perceptual quality and functional fidelity.

**Five Evaluation Aspects:**

1. **Generation Quality** -- visual realism, temporal stability, semantic consistency; addresses flickering and motion instability in diffusion models
2. **Reconstruction** -- whether generated videos can be reprojected into coherent 4D scenes via differentiable rendering; exposes geometric inconsistencies ("floaters")
3. **Action-Following** -- whether pre-trained planners can operate safely inside the generated world; reveals gaps between photometric realism and functional fidelity
4. **Downstream Task** -- whether synthetic data supports real-world perception models; detection/segmentation accuracy drops of 30-50% noted
5. **Human Preference** -- subjective ratings for world realism, physical plausibility, behavioral safety

**WorldLens-26K Dataset:** 26,808 human-annotated scoring records with discrete scores and textual rationales for training auto-evaluation agents and reward functions.

**WorldLens-Agent:** LoRA-based SFT on Qwen3-VL creates a human-aligned evaluator for scalable preference assessment.

**Models Evaluated:** 11+ driving world models including DiST-4D, OpenDWM, DriveDreamer-2, DreamForge, MagicDrive variants, AD-R1.

**Core Finding:** "Photometric realism alone cannot yield functional fidelity" -- geometric consistency is inseparable from perceptual quality.

### 2.3 ACT-Bench (ICLR 2025)

**Purpose:** Evaluate action controllability of driving world models -- how faithfully they follow trajectory instructions.

**Metrics:**

| Metric | Description |
|--------|-------------|
| Instruction-Execution Consistency (IEC) | % match between instructed and executed driving behaviors |
| Average Displacement Error (ADE) | Step-by-step spatial fidelity |
| Final Displacement Error (FDE) | Endpoint spatial accuracy |

**Dataset:** 2,286 video-trajectory pairs from nuScenes CAM_FRONT, 9 action categories (curving left/right, lane shifting, start/stop, acceleration, constant speed, deceleration).

**ACT-Estimator:** I3D backbone + self-attention, 94.03% action classification accuracy, used to estimate actions from generated videos for IEC computation.

**Key Results:**

| Model | IEC | Notes |
|-------|-----|-------|
| Vista (SOTA baseline) | 30.72% | Struggles with curving actions, abrupt motion transitions |
| Terra (proposed) | 44.11% | Better trajectory alignment, enables deliberate crash scenario generation |

**Critical Findings:**

- Neither model adequately adheres to instructions, revealing a fundamental gap in action fidelity
- "Causal Misalignment" observed: ego-vehicle instructions unintentionally affect surrounding agents
- Action controllability remains a major unsolved challenge

### 2.4 DrivingGen (2026)

**Purpose:** First comprehensive benchmark combining diverse data with driving-specific metrics to jointly assess visual realism, trajectory plausibility, temporal coherence, and controllability.

**Four Metric Categories:**

**Distribution Metrics:**
- Frechet Video Distance (FVD) -- video distributional similarity
- Frechet Trajectory Distance (FTD) -- novel metric using Motion Transformer encoders for trajectory distribution alignment

**Quality Metrics:**
- CLIP-IQA+ for subjective image quality
- IEEE P2020 Modulation Mitigation Probability for flicker detection
- Trajectory Quality combining comfort, motion, and curvature scores

**Temporal Consistency Metrics:**
- Adaptive optical flow sampling for video-level consistency
- DINOv3 features for agent appearance consistency
- VLM-based agent abnormal disappearance detection
- Speed/acceleration stability for trajectory consistency

**Trajectory Alignment Metrics (ego-conditioned track):**
- Average Displacement Error (ADE)
- Dynamic Time Warping (DTW) for trajectory shape comparison

**Dataset:** 400 samples across two tracks:
- **Open-Domain Track** (200 samples): Internet-sourced diverse scenarios -- snow (13.1%), fog (12.6%), night/sunset/sunrise (50%), 7 global regions
- **Ego-Conditioned Track** (200 samples): Aggregated from Zod, DrivingDojo, COVLA, nuPlan, WOMD

**Models Evaluated:** 14 SOTA models across three categories: general video (Kling 2.1, Gen-3 Alpha Turbo, CogVideoX, Wan, HunyuanVideo), physics-based (Cosmos-Predict1/2), driving-specific (Vista, DrivingDojo, GEM, VaViM, UniFuture).

**Key Findings:**

- No single model excels in both visual realism and trajectory fidelity
- General models: high visual quality but break physics
- Driving-specific models: physically plausible motion but visual artifacts
- Multi-metric approach reveals failure modes hidden by single-metric evaluation

### 2.5 Additional World Model Benchmarks

**VBench / VBench-2.0 (CVPR 2024/2025):** Comprehensive video generation benchmark with 16 evaluation dimensions (subject identity, motion smoothness, temporal flickering, spatial relationships, etc.). VBench-2.0 extends evaluation to "intrinsic faithfulness" covering Human Fidelity, Controllability, Creativity, Physics, and Commonsense.

**CVPR 2025 OpenDriveLab Predictive World Model Track:** Evaluates future point cloud prediction given action sequences and initial sensor images; primary metric is Chamfer Distance between predicted and ground-truth point clouds within [-51.2m, 51.2m].

**World Consistency Score (WCS):** A per-video, interpretive metric for conditional generation where each sample's coherence matters (e.g., text-to-video), complementing distribution-level metrics.

---

## 3. Metrics Taxonomy

### 3.1 Visual Fidelity Metrics

**Distribution-Level (Reference-Based):**

| Metric | Domain | What It Measures | Limitations |
|--------|--------|-----------------|-------------|
| FID (Frechet Inception Distance) | Image | Distributional divergence in Inception v3 feature space | Single-frame only, trained on ImageNet (domain gap for driving) |
| FVD (Frechet Video Distance) | Video | Distributional divergence in I3D feature space (Kinetics-trained) | Non-Gaussian feature space, insensitive to temporal distortions, requires impractical sample sizes |
| KID (Kernel Inception Distance) | Image | MMD-based distributional divergence | Same feature extractor limitations as FID |
| JEDi (JEPA Embedding Distance) | Video | MMD with polynomial kernel on JEPA features | ICLR 2025; needs only 16% of samples vs FVD, 34% better human alignment |

**Sample-Level (Paired Reference):**

| Metric | What It Measures | Range | Human Alignment |
|--------|-----------------|-------|-----------------|
| PSNR | Pixel-wise signal quality | Higher = better | Low (purely mathematical) |
| SSIM | Structural similarity (luminance, contrast, structure) | [0, 1] | Moderate |
| LPIPS | Learned perceptual similarity via CNN features | [0, 1], lower = better | High (closest to human perception) |
| CLIP-IQA+ | No-reference image quality via CLIP | Continuous | Good for subjective quality |

**Key Insight from ICLR 2025 "Beyond FVD":** FVD has three critical limitations: (1) non-Gaussianity of I3D features, (2) insensitivity to temporal distortions, (3) impractical sample sizes for convergence. JEDi is recommended as a superior alternative.

### 3.2 Geometric Metrics

| Metric | Domain | What It Measures | Notes |
|--------|--------|-----------------|-------|
| Chamfer Distance | 3D point clouds | Bidirectional nearest-neighbor distance between point sets | Density-aware variant most correlated with perception; sensitive to rotation/translation |
| IoU (Intersection over Union) | 3D bounding boxes / voxels | Overlap ratio of predicted and GT volumes | Standard thresholds: 0.7 for cars, 0.5 for pedestrians/cyclists |
| mIoU (mean IoU) | Semantic occupancy | Average IoU across semantic classes | Standard for occupancy prediction (nuScenes, Waymo) |
| Volume IoU | 3D meshes | Volumetric overlap for shape reconstruction | Used alongside Chamfer and F-Score |
| F-Score | 3D surfaces | Harmonic mean of precision and recall at distance threshold | Good for surface quality assessment |

**Occupancy-Specific Metrics (UniOcc, 2025):**

- Soft IoU: 52.1% achieved by OFMPNet on Waymo
- Flow-Grounded Occupancy AUC: 76.75% on Waymo
- UniOcc Score: Composite metric aggregating reconstruction quality, forecasting accuracy, temporal consistency, and realism probability
- Per-voxel flow annotations enable evaluation of motion prediction within occupancy grids

**nuScenes Center-Based Matching:** Rather than IoU, nuScenes matches detections to ground truth based on 2D center distance on the ground plane, avoiding double-penalization of orientation/size errors.

### 3.3 Driving Performance Metrics

**Safety Metrics:**

| Metric | What It Measures | Notes |
|--------|-----------------|-------|
| Collision Rate | Frequency of ego-vehicle collisions | Differentiated by collision partner (pedestrian, vehicle, static) |
| Time-to-Collision (TTC) | Time remaining until collision if course maintained | Limited to rear-end; TTCmo variant considers yaw angle |
| No at-fault Collision (NC) | Binary safety gate | NAVSIM penalty multiplier |
| Drivable Area Compliance (DAC) | Staying within valid driving zones | NAVSIM penalty multiplier |

**Progress and Efficiency Metrics:**

| Metric | What It Measures | Notes |
|--------|-----------------|-------|
| Route Completion | % of route distance traveled | CARLA primary sub-metric |
| Ego Progress (EP) | Forward movement progress | NAVSIM weighted sub-metric |
| Driving Score | Route Completion * Infraction Penalty | CARLA primary metric |

**Comfort Metrics:**

| Metric | What It Measures | Notes |
|--------|-----------------|-------|
| Lateral/longitudinal jerk | Ride smoothness | Comfort sub-metrics in DrivingGen, NAVSIM |
| History Comfort (HC) | Trajectory smoothness vs motion history | NAVSIM v2 |
| Extended Comfort (EC) | Inter-frame acceleration/jerk consistency | NAVSIM v2 |

**Compliance Metrics:**

| Metric | What It Measures | Notes |
|--------|-----------------|-------|
| Traffic Light Compliance (TLC) | Signal adherence | NAVSIM v2 |
| Driving Direction Compliance (DDC) | Proper directional travel | NAVSIM v2 |
| Lane Keeping (LK) | Centerline deviation | NAVSIM v2 |

### 3.4 Trajectory Prediction and Motion Forecasting Metrics

| Metric | What It Measures | Used In |
|--------|-----------------|---------|
| minADE_K | Best-of-K average L2 trajectory error | Argoverse, nuScenes, Waymo |
| minFDE_K | Best-of-K final displacement error | Argoverse, nuScenes, Waymo |
| Miss Rate | % no prediction within threshold | Argoverse (2m), Waymo |
| brier-minFDE | minFDE + confidence penalty (1-p)^2 | Argoverse primary ranking metric |
| ADE | Average Displacement Error | ACT-Bench, DrivingGen |
| FDE | Final Displacement Error | ACT-Bench |
| DTW | Dynamic Time Warping for shape comparison | DrivingGen |
| FTD | Frechet Trajectory Distance | DrivingGen (novel) |

### 3.5 Action Fidelity and Controllability Metrics

| Metric | What It Measures | Used In |
|--------|-----------------|---------|
| Instruction-Execution Consistency (IEC) | % match between instructed and executed behaviors | ACT-Bench |
| Trajectory Alignment (TA) | ADE/FDE of generated vs intended trajectories | ACT-Bench, DrivingGen |
| Action-Following Score | Planner safety inside generated world | WorldLens |
| Rater Feedback Score (RFS) | Human preference alignment on 5 dimensions | WOD-E2E 2025 |

---

## 4. Open-Loop vs Closed-Loop Evaluation

### 4.1 Open-Loop Evaluation

**Approach:** Assess prediction quality in frozen, non-reactive environments using offline single-step metrics (ADE, FID, FVD, L2 error). Standard on datasets like nuScenes and Waymo.

**Advantages:**

- Simple, efficient, reproducible
- Cost-effective and suitable for large-scale training/testing
- Easy to run on pre-collected datasets
- Deterministic results

**Critical Limitations:**

- System never experiences consequences of prediction errors
- Masks compounding error effects where minor early drifts push agents into out-of-distribution states
- "Is Ego Status All You Need?" (2023) showed open-loop metrics on nuScenes can be gamed
- No evidence that open-loop results transfer to closed-loop, making ablations and claims unreliable

### 4.2 Closed-Loop Evaluation

**Approach:** Measure policy quality in reactive, interactive environments using online multi-step rollouts in simulators. Uses survival metrics: Success Rate, Route Completion, collision frequency.

**Key Platforms:**

- CARLA 2.0/2.1 Leaderboard (primary arena)
- LGSVL, AirSim, MetaDrive, Waymax
- DriveArena (generative simulation)
- DriveE2E (real-to-sim)

**Advantages:**

- Reveals dramatic performance gaps: models with comparable open-loop errors can exhibit success rates varying from 20% to 100%
- Exposes interaction-dependent failures
- More representative of real-world deployment

**Limitations:**

- Computationally expensive
- Sim-to-real domain gap
- Scenario coverage challenges
- Non-deterministic results require statistical aggregation

### 4.3 Pseudo-Simulation: The Middle Ground

NAVSIM v2's pseudo-simulation approach (CoRL 2025) combines:

- **Open-loop efficiency** -- not sequential or interactive
- **Closed-loop robustness** -- augments real data with synthetic observations near predicted trajectories
- **6x less compute** than traditional closed-loop simulation
- **Strong correlation** with full closed-loop results

**Two-Stage Reactive Agents:** NAVSIM v2 adds reactive traffic agent policies, enabling more realistic interaction modeling without full simulation overhead.

### 4.4 The Closed-Loop Safety Gap (CSG)

From the latent world models survey (March 2026):

```
CSG = F_OL - S_CL
```

Where F_OL is normalized open-loop fidelity and S_CL is closed-loop safety. A large positive CSG indicates visually plausible predictions that fail to translate into safe closed-loop execution -- the "prediction-interaction gap." This metric formalizes what has been observed qualitatively: perceptual quality does not imply behavioral safety.

---

## 5. Safety-Focused Evaluation

### 5.1 Accelerated Testing via Importance Sampling

Real-world validation requires billions of miles to statistically validate safety claims. Importance sampling provides 2-20x acceleration over naive Monte Carlo and 10-300x over real-world testing.

**Approach:**

1. Learn alternative distributions that generate accidents more frequently using cross-entropy algorithm
2. Iteratively approximate optimal importance sampling distribution
3. Re-weight outcomes to estimate true failure rates
4. 1,000 simulated miles equivalent to 2-20 million real-world miles for encountering rare events

**Advanced Methods:**

- Implicit Importance Sampling (IIS) for intelligent testing environments
- Subset simulation for efficient rare-event probability estimation
- Deep Reinforcement Learning adversarial agents (D2RL) learning maneuvers from densified naturalistic data

### 5.2 Adversarial Scenario Generation

**Universal adversarial testing framework** (2025-2026): Generates worst-case traffic scenarios focused on prediction and planning, assessed from three perspectives:

1. **Harm** -- potential for damage/injury
2. **Ambiguity** -- decision uncertainty
3. **Rarity** -- infrequency of occurrence

**Techniques:**

- Causal Bayesian Networks derived from accident data
- DeepMF framework for collision risk analysis
- Genetic Algorithms for synthesizing complex disturbances
- Large Language Model-based scenario generation

### 5.3 Safety-Specific Metrics

**Time-to-Collision variants:**

- Standard TTC: only for rear-end collisions
- TTCmo: considers yaw angle of conflicting objects
- Multi-dimensional risk index: TTC + relative speed + spacing parameters

**Waymo's approach:**

- Double-weighting collisions and road departures in the Realism Meta Metric
- Response Time framework: compares AV response timing to attentive non-impaired human driver baseline
- Human rater evaluation of trajectory safety (RFS)

### 5.4 Current Research Gaps in Safety Evaluation

Three persistent gaps identified across the literature:

1. **No standardized safety metrics** -- different benchmarks use incompatible definitions
2. **Limited ethical and human factors integration** -- testing scenarios rarely capture moral dilemmas or human-AV interaction
3. **Insufficient ODD-specific coverage** -- most benchmarks focus on urban road driving, with limited coverage of specialized operational domains

---

## 6. Evaluation Without Ground Truth

### 6.1 Reference-Free Metrics

**UniOcc (ICCV 2025):** Introduces evaluation metrics for occupancy prediction that do not depend on ground-truth occupancy, enabling assessment of additional quality aspects. The UniOcc Score aggregates reconstruction quality, forecasting accuracy, temporal consistency, and realism probability.

**World Model Self-Consistency:** WorldLens evaluates whether generated videos can be reprojected into coherent 4D scenes via differentiable rendering -- geometric consistency serves as an intrinsic quality measure without requiring paired ground truth.

**CLIP-IQA+:** No-reference image quality metric based on CLIP features, used in DrivingGen for subjective quality assessment of generated driving videos.

### 6.2 Epistemic Uncertainty-Based Evaluation

The "Scalable Offline Metrics for Autonomous Driving" work (October 2025) proposes:

- An offline metric based on epistemic uncertainty to capture events likely to cause errors in closed-loop settings
- Achieves 13%+ improvement in correlation with online performance vs. previous offline metrics
- Does not require high-quality perception information or surrounding agent prediction models
- Validated in real-world settings with even greater gains than simulation

### 6.3 World Model-Based Trajectory Evaluation

Model-based trajectory evaluation leverages learned world models that capture environmental dynamics:

- BEV world models predict future states for trajectory evaluation without requiring ground-truth future states
- Enables online trajectory scoring during deployment
- Key challenge: extrapolating from offline model performance to online settings remains unreliable

### 6.4 Human Preference as Proxy for Ground Truth

- **WorldLens-26K:** 26,808 human annotations with textual rationales, used to train auto-evaluation agents
- **WorldModelBench:** 67K human labels for calibrating automated judgers
- **WOD-E2E RFS:** Human raters provide preference labels that capture safety and quality dimensions beyond geometric metrics
- **DrivingGen:** Human alignment validation confirmed strong Spearman correlation between proposed metrics and human judgment

---

## 7. Sim-to-Real Evaluation Gap

### 7.1 The Nature of the Gap

The sim-to-real gap manifests in multiple dimensions:

- **Visual domain gap:** CARLA's rendered scenes vs. real sensor streams
- **Sensor model gap:** Simplified sensor models vs. real noise, calibration drift, degradation
- **Behavioral gap:** Scripted/learned traffic agents vs. real human behavior
- **Environmental gap:** Missing weather effects, lighting conditions, surface properties

### 7.2 S2R-Bench (2025)

The first corruption robustness benchmark based on real-world scenarios:

- Collected with high-resolution camera, 80-line LiDAR, two 4D radar types
- 700 km across Beijing roads (city, suburban, motorway, tunnel, town, village)
- Covers light snow (27.3%), moderate snow (14.9%), fog (19.9%), strong lighting (7.4%)
- Demonstrates that existing perception methods exhibit poor robustness under real adverse conditions

### 7.3 Narrowing the Gap

**Photorealistic Simulation:**
- Neural Radiance Fields (NeRF) and 3D Gaussian Splatting (3DGS) enable photorealistic scene synthesis
- Hybrid reconstruction (LiDAR + images) achieves performance comparable to real-world training data
- RoboTron-Sim (ICCV 2025): ~50% improvement in hard-case success rates by learning from simulated scenarios

**Real-to-Sim Approaches:**
- DriveE2E: Extracts 800 dynamic scenarios from infrastructure sensors into CARLA digital twins
- Bench2Drive-R: Turns real-world data into reactive closed-loop benchmark via generative models

**Domain Randomization and Adaptation:**
- Data augmentation across weather, lighting, and sensor conditions
- Cross-domain training on multiple sim and real datasets
- Progressive domain adaptation during training

### 7.4 Quantifying the Gap

The latent world models survey (March 2026) proposes the **Closed-Loop Safety Gap (CSG)** metric specifically to quantify the prediction-interaction gap. Cross-domain evaluation reveals:

- Models with comparable in-distribution benchmark success can exhibit dramatically different cross-domain performance
- Real-world datasets predominantly feature common conditions, systematically underrepresenting rare scenarios
- Standard benchmarks insufficiently capture out-of-distribution robustness

---

## 8. Statistical Significance Requirements

### 8.1 Sample Size Challenges

The fundamental statistical challenge for AV safety validation:

- Fully autonomous vehicles would need hundreds of millions to hundreds of billions of miles to demonstrate reliability for fatalities and injuries
- Under aggressive testing assumptions, existing fleets would take tens to hundreds of years
- This makes pure statistical validation via real-world testing practically impossible

### 8.2 Statistical Methods for Evaluation

**Failure Rate Estimation:**

- Direct failure rate estimation with significance level and power level
- Significance level: probability of correct rejection (Type I error)
- Power level: probability of correct acceptance (Type II error)
- Both characterize evaluation result reliability

**Acceleration Methods:**

1. **Importance Sampling:** Generate test cases from non-standard distributions, re-weight to estimate true failure rate; reduces required test cases for rare events
2. **Subset Simulation:** Progressive conditioning on increasingly rare events; efficient for very low probability failures

### 8.3 Benchmark-Specific Statistical Practices

**NAVSIM v2:** Two-stage aggregation with Gaussian proximity weighting provides more statistically robust evaluation across scenarios.

**Waymo Sim Agents:** Evaluation over 32 stochastic rollouts per scenario captures behavioral variance.

**Bench2Drive:** 220 routes across 44 scenarios provides sufficient coverage for disentangled multi-ability assessment, but each route is short (~150m), limiting long-horizon statistics.

**CARLA 2.1:** Global scores are arithmetic means across all routes; the 20-route evaluation set provides limited statistical power for rare events.

### 8.4 Best Practices

From the literature:

- Report confidence intervals alongside point estimates
- Use multiple seeds/rollouts for stochastic evaluations
- Separate in-distribution and out-of-distribution performance
- Weight metrics by scenario criticality (e.g., Waymo double-weighting collisions)
- Avoid comparing across leaderboard versions (CARLA 2.0 vs 2.1 scores are incomparable)

---

## 9. Building an Airside-Specific Eval Suite

### 9.1 FAA Regulatory Context

**FAA CertAlert 24-02** (February 2024) and **Emerging Entrants Bulletin 25-02** (May 2025) provide guidance for AGVS testing at airports:

- Testing currently permitted only in "controlled environments" -- non-movement areas (aprons, aircraft gate areas, parking areas, remote/landside areas)
- Active movement areas, safety areas, and object-free areas are NOT considered controlled environments
- Human monitor must be physically located in/near the AGVS during operation around aircraft and personnel
- Monitor must have capability to take control at any time
- Airport sponsors have authority to approve/disapprove testing

**Key Testing Requirements:**

- Object detection and obstacle avoidance validation
- Integration of sensors (LiDAR, radar, cameras)
- Redundancy in navigation systems
- Wireless communications requirements
- Cybersecurity protections

### 9.2 Unique Airside Evaluation Challenges

Airside operations differ fundamentally from road driving:

| Dimension | Road Driving | Airside Operations |
|-----------|-------------|-------------------|
| Speed regime | 30-130 km/h | 5-40 km/h (often <25 km/h) |
| Agent types | Vehicles, pedestrians, cyclists | Aircraft, tugs, baggage carts, fuel trucks, ground crew, pushback vehicles |
| Lane structure | Well-defined lanes, road markings | Painted taxiway markings, service roads, ramp areas with minimal structure |
| Collision consequences | Property damage, injury | Aircraft damage ($M+), fuel spill risk, jet blast, FOD risk |
| Regulatory framework | DOT/NHTSA | FAA Part 139, ICAO Annex 14 |
| Operating environment | Public roads | Restricted access, controlled zones |
| Map representation | HD maps, OpenDRIVE | Airport GIS, AMDB (Aerodrome Mapping Database) |
| Communication | V2X, cellular | ATC radio, ACARS, ADS-B, ramp control |

### 9.3 Proposed Airside Evaluation Framework

#### Tier 1: Perception Evaluation

**Detection metrics (adapted from nuScenes NDS):**

- mAP with airside-specific classes: aircraft (by type/size), ground service equipment (GSE), personnel, FOD, vehicles, jetbridge
- Center-distance matching on ground plane (inherit nuScenes approach)
- TP metrics: ATE, ASE, AOE adapted for aircraft-scale objects
- Additional: FOD detection recall at sub-10cm scale

**Geometric metrics:**

- 3D IoU for large objects (aircraft, GSE) with class-appropriate thresholds
- Chamfer Distance for point cloud reconstruction of ramp areas
- Surface normal consistency for taxiway/apron surface reconstruction

**Occupancy metrics:**

- Semantic occupancy IoU for airside zones (taxiway, apron, safety area, jetblast zone, no-go zone)
- Per-voxel flow for moving GSE and personnel tracking

#### Tier 2: Prediction and Planning Evaluation

**Trajectory prediction:**

- minADE/minFDE adapted for slow-speed, multi-agent airside scenarios
- brier-minFDE for probabilistic predictions
- Miss rate with airside-appropriate thresholds (e.g., 1m for near-aircraft operations)

**Planning metrics (adapted from NAVSIM EPDMS):**

- Aircraft separation compliance (analogous to DAC)
- Jet blast zone avoidance
- Safety area clearance
- Right-of-way compliance (aircraft always have priority)
- Taxiway/service road compliance
- Speed limit compliance by zone
- Proximity-to-aircraft comfort metrics
- FOD avoidance

**Safety gates (binary multipliers):**

- No aircraft contact (highest severity, coefficient 2.0+)
- No personnel collision (coefficient 1.5)
- No GSE collision (coefficient 1.0)
- Safety area violation (coefficient 0.8)
- Jet blast zone entry (coefficient 0.6)

#### Tier 3: World Model Quality Evaluation

**Visual fidelity:**

- FVD/JEDi adapted for airside video generation
- LPIPS for reconstruction quality of generated ramp views
- DrivingGen-style temporal consistency metrics

**Action controllability:**

- IEC for airside maneuvers (approach-to-stand, pushback follow, GSE avoidance)
- ADE/FDE for trajectory-conditioned generation
- DTW for route adherence

**Physical plausibility:**

- Aircraft dynamics consistency (turning radius, speed constraints)
- GSE behavior realism
- Personnel movement patterns
- Jet blast propagation modeling

#### Tier 4: Closed-Loop Simulation

**Airside-specific simulator requirements:**

- Accurate aircraft models (dimensions, turning radii, jet blast zones)
- GSE traffic patterns and scheduling
- Personnel movement models (marshalling, fueling, loading)
- Weather effects on ramp operations (rain, ice, wind, visibility)
- Day/night lighting transitions
- Radio communication modeling

**Evaluation protocol (adapted from Bench2Drive/CARLA):**

- Scenario categories: stand approach, pushback, ramp transit, crossing active taxiway, emergency stop, FOD encounter, right-of-way yielding, convoy following
- Multiple weather/lighting conditions per scenario
- Route completion + infraction penalty scoring with airside-specific infraction coefficients
- Minimum 100 scenarios for statistical power, with importance sampling for rare events

### 9.4 Recommended Evaluation Pipeline

```
Stage 1: Component Benchmarks (offline)
  - Perception: NDS-variant on airside dataset
  - Prediction: brier-minFDE on airside motion data
  - Planning: EPDMS-variant on logged airside scenarios

Stage 2: Pseudo-Simulation (NAVSIM-style)
  - Apply pseudo-simulation to logged airside data
  - Compute EPDMS-variant with airside safety gates
  - Filter false positives against human driver behavior

Stage 3: Closed-Loop Simulation (CARLA/custom)
  - Full reactive simulation in airside digital twin
  - Driving Score with airside infraction coefficients
  - Adversarial scenario injection for safety-critical testing
  - Importance sampling for rare event coverage

Stage 4: Controlled Real-World Testing
  - Closed areas first (per FAA guidance)
  - Graduated expansion to non-movement areas
  - Shadow-mode operation (parallel to human operator)
  - Statistical failure rate estimation with confidence intervals
```

### 9.5 Dataset Requirements

To build an airside-specific evaluation suite, the following data is needed:

- **Minimum viable dataset:** 200+ hours of multi-sensor (camera + LiDAR + radar) operation data across multiple airports
- **Annotation requirements:** 3D bounding boxes for all airside object classes, semantic segmentation, per-frame occupancy grids, motion trajectories for all agents
- **Scenario coverage:** At least 20 distinct scenario types, each with 10+ examples across weather/lighting conditions
- **Long-tail coverage:** Explicit collection of rare events (near-misses, emergency stops, FOD encounters, unusual aircraft configurations)
- **Geographic diversity:** Multiple airport layouts (terminal apron, remote stands, cargo areas, maintenance ramps)

---

## 10. Key Takeaways and Recommendations

### 10.1 The State of Evaluation in 2026

1. **No single metric suffices.** DrivingGen demonstrates that models with good FVD can still exhibit stop-go jitter, identity drift, or non-physical disappearances. Multi-dimensional evaluation is essential.

2. **Open-loop is necessary but insufficient.** The gap between open-loop and closed-loop performance remains large, with models showing 20-100% success rate variation despite comparable open-loop errors.

3. **Action controllability is the frontier.** ACT-Bench reveals that even SOTA world models achieve only 30-44% instruction-execution consistency, making this the key bottleneck for using world models as simulators.

4. **Human alignment matters.** WOD-E2E's RFS metric shows weak correlation between geometric metrics (ADE) and human preference, especially in ambiguous long-tail scenarios.

5. **FVD is on its way out.** The "Beyond FVD" work at ICLR 2025 demonstrated fundamental limitations; JEDi requires 16% of samples and achieves 34% better human alignment.

6. **World model benchmarks are maturing rapidly.** The progression from ad-hoc FVD evaluation to WorldModelBench (NeurIPS 2025), ACT-Bench (ICLR 2025), DrivingGen (2026), and WorldLens (CVPR 2026) represents a significant maturation in evaluation methodology.

### 10.2 Recommendations for Airside AV Stack

1. **Adopt multi-tier evaluation** -- perception, prediction, planning, and end-to-end closed-loop, with airside-specific metrics at each tier.

2. **Prioritize safety metrics** -- use binary safety gates (adapted from NAVSIM) with airside-specific infraction coefficients that reflect the catastrophic cost of aircraft contact.

3. **Build pseudo-simulation capability** -- NAVSIM-style pseudo-simulation on logged airside data provides the best cost/fidelity tradeoff for iterative development.

4. **Invest in closed-loop simulation** -- an airside digital twin with realistic aircraft, GSE, and personnel models is essential for safety-critical scenario testing.

5. **Use importance sampling** -- given the rarity of airside safety events, accelerated testing via importance sampling is necessary for statistically meaningful safety validation.

6. **Evaluate world models on controllability** -- if using world models for planning or simulation, ACT-Bench-style action fidelity metrics are more important than visual fidelity for downstream safety.

7. **Plan for regulatory alignment** -- structure evaluation around FAA's graduated testing framework (closed areas -> non-movement areas -> movement areas), with each stage requiring demonstrated safety metrics.

---

## Key References and Resources

### Benchmark Platforms
- [nuScenes](https://www.nuscenes.org/) -- Detection, tracking, prediction, planning
- [Waymo Open Dataset](https://waymo.com/open/) -- Perception, motion, sim agents, E2E driving
- [Argoverse 2](https://www.argoverse.org/av2.html) -- Motion forecasting, scene flow, scenario mining
- [NAVSIM](https://github.com/autonomousvision/navsim) -- Pseudo-simulation for E2E driving
- [CARLA Leaderboard](https://leaderboard.carla.org/) -- Closed-loop driving evaluation

### World Model Benchmarks
- [WorldModelBench](https://arxiv.org/abs/2502.20694) -- NeurIPS 2025, video generation as world models
- [WorldLens](https://worldbench.github.io/worldlens) -- CVPR 2026, full-spectrum driving world model evaluation
- [ACT-Bench](https://github.com/turingmotors/ACT-Bench) -- ICLR 2025, action controllability
- [DrivingGen](https://drivinggen-bench.github.io/) -- 2026, comprehensive generative world model benchmark
- [VBench 2.0](https://github.com/Vchitect/VBench) -- Video generation intrinsic faithfulness

### Key Papers
- "Beyond FVD" (ICLR 2025) -- Enhanced video generation metrics (JEDi)
- "Latent World Models for Automated Driving" (March 2026) -- Unified taxonomy and evaluation framework
- "Scalable Offline Metrics for Autonomous Driving" (October 2025) -- Epistemic uncertainty-based evaluation
- "LEAD: Minimizing Learner-Expert Asymmetry" (CVPR 2026) -- TransFuser v6, SOTA across CARLA/NAVSIM
- "Pseudo-Simulation for Autonomous Driving" (CoRL 2025) -- NAVSIM v2 methodology
- "WOD-E2E" (2025) -- Rater Feedback Score for long-tail evaluation
- "S2R-Bench" (2025) -- Sim-to-real robustness benchmark

### Regulatory References
- [FAA CertAlert 24-02](https://www.faa.gov/airports/airport_safety/certalerts/part_139_certalert_24_02) -- AGVS testing guidance
- [FAA Emerging Entrants Bulletin 25-02](https://www.faa.gov/airports/new_entrants/bulletins/25_02) -- AGVS testing at federally obligated airports
- [FAA AC 150/5220-26](https://www.faa.gov/documentLibrary/media/Advisory_Circular/150_5220_26_change_3_consolidated.pdf) -- Airport ground vehicle operations
