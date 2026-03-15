# Wayve: Exhaustive Technical Analysis of the Autonomous Driving Technology Stack

*Last updated: March 2026*

---

## Table of Contents

1. [Company Overview](#1-company-overview)
2. [Technical Approach](#2-technical-approach)
3. [Foundation Model -- LINGO](#3-foundation-model--lingo)
4. [Foundation Model -- GAIA-1](#4-foundation-model--gaia-1)
5. [Foundation Model -- PRISM-1](#5-foundation-model--prism-1)
6. [Sensor Suite](#6-sensor-suite)
7. [Autonomy Software Stack](#7-autonomy-software-stack)
8. [Machine Learning & AI](#8-machine-learning--ai)
9. [Simulation](#9-simulation)
10. [Cloud & Data Infrastructure](#10-cloud--data-infrastructure)
11. [Programming Languages & Tools](#11-programming-languages--tools)
12. [Safety Architecture](#12-safety-architecture)
13. [Testing & Operations](#13-testing--operations)
14. [Key Partnerships](#14-key-partnerships)
15. [Research & Publications](#15-research--publications)
16. [Competitive Differentiators](#16-competitive-differentiators)

---

## 1. Company Overview

### Founding & Leadership

Wayve Technologies Ltd was founded in **2017** by **Alex Kendall** and **Amar Shah**, both machine learning PhD students at the **University of Cambridge**. Kendall studied under Roberto Cipolla in the Department of Engineering, focusing on end-to-end deep learning for scene understanding. Shah completed his PhD in Zoubin Ghahramani's Machine Learning group and had previously worked as a Quantitative Strategist at Goldman Sachs. Shah also studied under Yoshua Bengio (2018 Turing Award winner).

Shah served as joint CEO for Wayve's first three years, raising $40M and building an initial team of 60 engineers before departing in 2020. Alex Kendall then assumed the sole CEO role and has led the company since.

**Key leadership recognitions for Alex Kendall:**
- Royal Academy of Engineering Silver Medal (Princess Royal Silver Medal)
- Officer of the Order of the British Empire (OBE) for services to artificial intelligence
- MIT Technology Review Innovators Under 35
- Fellow of Trinity College, Cambridge (elected 2017)
- 2018 BMVA Prize and 2019 ELLIS Prize for his PhD research
- Google Scholar: 52,000+ citations

### Headquarters & Offices

| Location | Function |
|---|---|
| London, UK (HQ) | Primary R&D, operations, corporate |
| Sunnyvale, California, USA | US engineering and testing |
| Germany | European expansion hub |
| Canada | Engineering |
| Japan | Partnership operations (Nissan/Uber) |

### Employees

Wayve has grown rapidly from approximately 60 employees at its founding era to approximately **833 employees** as of January 2026. The company's headcount more than doubled to around 650 by mid-2025 and continued growing through the Series D round. Wayve was named Britain's fastest-hiring tech firm in May 2025.

### Funding History

| Round | Date | Amount | Lead Investor(s) | Key Participants | Post-Money Valuation |
|---|---|---|---|---|---|
| Seed | Sep 2017 | $2.15M | Compound, Firstminute Capital | Cambridge-based angels | -- |
| Series A | Nov 2019 | $20M | Eclipse Ventures | Balderton Capital | -- |
| Series B | Jan 2022 | $200M | Eclipse Ventures | Microsoft, Virgin Group, Baillie Gifford, D1 Capital, Moore Strategic Ventures, Balderton; Yann LeCun & Richard Branson as individual investors | -- |
| Series C | May 2024 | $1.05B | SoftBank Group | NVIDIA, Microsoft | ~$4.5B (est.) |
| Series D | Feb 2026 | $1.2B ($1.5B total incl. Uber milestone capital) | Eclipse, Balderton, SoftBank Vision Fund 2 | Microsoft, NVIDIA, Uber, Mercedes-Benz, Nissan, Stellantis, Ontario Teachers' Pension Plan, Baillie Gifford, British Business Bank, Schroders Capital, Icehouse Ventures | **$8.6B** |

**Total funding raised: ~$2.5B across 8 rounds.**

### Key Milestones Timeline

| Year | Milestone |
|---|---|
| 2017 | Founded at University of Cambridge |
| 2018 | Emerged from stealth; demonstrated "Learning to Drive in a Day" via deep RL |
| 2019 | Series A; launched pilot fleet of Jaguar I-Pace SUVs in central London |
| 2020 | Amar Shah departs; Alex Kendall becomes sole CEO |
| 2022 | Series B ($200M); introduced AV2.0 concept |
| 2023 | Released GAIA-1 (9B parameter world model); LINGO-1 announced |
| 2024 | Series C ($1.05B); LINGO-2 demonstrated on public roads; MILE model published |
| 2025 | GAIA-2 launched (March); PRISM-1 released; Ghost Gym neural simulator; testing in 500+ cities; Nissan partnership announced; headcount crosses 650 |
| 2025 (Sep) | Signed letter of intent from NVIDIA for potential $500M investment |
| 2025 (Dec) | GAIA-3 launched (15B parameters) |
| 2026 (Feb) | Series D ($1.2B); $8.6B valuation; Gen 3 platform on NVIDIA DRIVE AGX Thor |
| 2026 (Mar) | Wayve/Uber/Nissan robotaxi collaboration announced for Tokyo pilot (late 2026) |
| 2026 | Planned London L4 robotaxi trials with Uber (spring 2026) |
| 2027 | Consumer vehicles with Wayve AI Driver (L2+ hands-off) planned via OEMs |

---

## 2. Technical Approach

### AV2.0: End-to-End Embodied AI

Wayve's core thesis -- what they term **AV2.0** -- fundamentally rejects the modular "sense-plan-act" pipeline used by traditional autonomous vehicle companies (AV1.0). Instead, Wayve replaces the entire modular stack with a **single neural network** trained end-to-end on diverse data to convert raw sensor inputs into safe driving outputs.

#### AV1.0 (Traditional Modular) vs AV2.0 (Wayve's Approach)

| Aspect | AV1.0 (Waymo, Aurora, Cruise) | AV2.0 (Wayve) |
|---|---|---|
| Architecture | Modular: perception -> prediction -> planning -> control | Single end-to-end neural network |
| Maps | Requires pre-built HD maps | No HD maps; uses standard sat-nav |
| Rules | Hand-coded driving rules and heuristics | Learned driving behaviors from data |
| Sensor requirements | Typically requires LiDAR + cameras + radar | Camera-first; radar optional; LiDAR optional |
| Scaling to new cities | Requires per-city HD map creation and rule tuning | Data-driven adaptation; tested in 500+ cities without city-specific fine-tuning |
| Labeling | Requires extensive per-frame annotation | Self-supervised learning from unlabeled driving data |
| Long-tail handling | Manual rule additions for edge cases | Generalization from large-scale diverse data |

#### How It Works

The input to Wayve's system is:
- A video stream from **6 monocular cameras** providing 360-degree surround view
- Supporting sensory information (vehicle speed, steering angle, IMU)
- Standard satellite navigation data (turn-by-turn directions)

The neural network contains **tens of millions of parameters** and learns to regress a **motion plan** (a trajectory), which a low-level controller then actuates on the vehicle. Critically, the system does not decompose the driving problem into separate perception, prediction, and planning modules -- instead, a single differentiable model jointly optimizes all these functions.

#### Auxiliary Outputs for Interpretability

While the core model is end-to-end, Wayve decodes a number of **intermediate representations** from the model's latent states as auxiliary outputs:
- **Semantic segmentation** (learned from labeled data)
- **Traffic light state detection** (learned from labeled data)
- **Depth estimation** (self-supervised)
- **Geometry and surface normals** (self-supervised)
- **Optical flow / motion estimation** (self-supervised)
- **Future prediction** (self-supervised)

These are not features directly used in the model's decision pipeline but rather decoded from intermediate latent states as auxiliary training targets and for development/interpretability/safety verification. This preserves the flexibility of high-dimensional internal representations while accelerating performance by providing additional learning signals and semantic inductive biases.

#### Why This Differs from Waymo/Aurora/Tesla

**Waymo** uses a modular stack with dedicated perception (LiDAR/camera fusion), prediction, and planning modules, supplemented by a sensor fusion module tuned for speed and geometric precision. However, Waymo has been incorporating end-to-end elements, and its latest architecture is converging -- if one removes Waymo's explicit sensor fusion module, the resulting transformer-based model looks structurally similar to Wayve's.

**Aurora** follows a modular approach with its Aurora Driver, relying on HD maps and a dedicated FirstLight LiDAR sensor. Its architecture maintains clear module boundaries.

**Tesla** has moved toward end-to-end learning with its FSD system but retains some modular elements and is camera-only (no radar in recent versions). Tesla's approach is the closest to Wayve's philosophically, but Wayve explicitly licenses its technology to OEMs rather than bundling it with its own vehicles.

The fundamental bet Wayve makes is that a single learned model can generalize better to novel situations (the "long tail") than hand-crafted rules, and that self-supervised learning from vast driving data eliminates the annotation bottleneck that plagues modular approaches.

---

## 3. Foundation Model -- LINGO

### LINGO-1: Open-Loop Vision-Language Driving Commentator

**LINGO-1** is Wayve's first vision-language model for autonomous driving, functioning as an **open-loop driving commentator** that combines vision, language, and action to enhance how Wayve interprets, explains, and trains its foundation driving models.

#### Architecture & Training Data
- Combines a vision encoder with an auto-regressive language model
- Trained on a scalable and diverse dataset incorporating image, language, and action data gathered from Wayve's expert drivers commentating as they drive around the UK
- Drivers narrate their decision-making process while driving, creating paired vision-language-action training data

#### Capabilities
- Comments on driving scenes in natural language
- Can be prompted with questions to clarify and explain what factors in the driving environment affected driving decisions
- Provides post-hoc explanations of driving behavior
- Referential segmentation: can visually ground its language descriptions to specific regions of the image (LINGO-1's "Show and Tell" capability)

#### LingoQA Benchmark (ECCV 2024)
Wayve released **LingoQA**, a Video QA benchmark for autonomous driving:
- **419,000 QA pairs** across **28,000 unique short video scenarios** from central London
- Free-form questions and answers covering perception and driving reasoning
- Introduced **Lingo-Judge**, a learned classifier-based evaluation metric with Spearman coefficient of 0.950 (outperforms GPT-4 as an evaluator)
- GPT-4V answers only 59.6% of questions truthfully vs. 96.6% for humans, demonstrating the benchmark's difficulty
- Baseline model: fine-tuned vision-language model with Vicuna-1.5-7B and late video fusion

### LINGO-2: Closed-Loop Vision-Language-Action Driving Model

**LINGO-2** is the world's **first vision-language-action (VLA) model tested on public roads**. It represents a major leap from LINGO-1 by operating in **closed loop** -- meaning it actually controls the vehicle, not just comments on pre-recorded driving.

#### Architecture
- Combines a **Wayve vision model** with an **auto-regressive language model**
- Takes images and language as inputs
- Outputs both **driving actions** (steering, acceleration) and **language** (commentary)
- By swapping the order of text tokens and driving action tokens, language becomes a prompt for driving behavior

#### Key Capabilities
1. **Driving from vision**: processes multi-camera video to understand the driving scene
2. **Natural language commentary**: provides continuous real-time commentary explaining its motion planning decisions
3. **Language-conditioned driving**: users can prompt LINGO-2 with constrained navigation commands (e.g., "pull over on the left," "turn right at the next junction") and the model adapts the vehicle's behavior accordingly
4. **Bidirectional vision-language-action**: language can be both input (instructions) and output (explanations), enabling interactive and interpretable autonomous driving

#### Significance
LINGO-2 demonstrates that a single model can simultaneously drive a vehicle, explain its decisions, and accept natural language instructions -- a capability no other AV system has demonstrated on public roads.

---

## 4. Foundation Model -- GAIA (Generative AI for Autonomy)

Wayve's GAIA family represents a line of **generative world models** for autonomous driving -- AI systems that learn to simulate realistic driving scenarios. The family has evolved through three generations.

### GAIA-1: The 9-Billion Parameter World Model

**Paper:** [GAIA-1: A Generative World Model for Autonomous Driving](https://arxiv.org/abs/2309.17080) (September 2023)

#### Architecture Overview

GAIA-1 is a two-component system:

**Component 1: World Model (6.5B parameters)**
- An **autoregressive transformer** that predicts the next set of image tokens
- Encodes three modalities through specialized encoders:
  - **Video encoder**: discretizes each video frame using vector quantization (VQ), transforming frames into sequences of tokens
  - **Text encoder**: discretizes and embeds natural language descriptions
  - **Action encoder**: projects scalar action values (steering, throttle/brake) into the shared representation space
- All encoders project into a **shared representation space**
- The transformer predicts future image tokens conditioned on past image tokens, text context, and action tokens
- Reframes future prediction as **next-token prediction** in a multimodal sequence

**Component 2: Video Diffusion Decoder (2.6B parameters)**
- A **denoising video diffusion model** that translates predicted image tokens back into pixel space
- Operates on sequences of frames (not individual frames) to ensure temporal consistency
- Produces semantically meaningful, visually accurate, and temporally consistent video outputs
- Uses the diffusion process to model frame sequences jointly, preventing temporal discontinuities

#### Training Specifications

| Specification | Value |
|---|---|
| Total parameters | ~9.1B (6.5B world model + 2.6B decoder) |
| World model training | 15 days on 64x NVIDIA A100 GPUs |
| Video decoder training | 15 days on 32x NVIDIA A100 GPUs |
| Training data | 4,700 hours of proprietary driving data |
| Data collection period | 2019--2023, London, UK |
| Input modalities | Video, text, action |
| Output | Realistic driving video sequences |

#### Capabilities
- Generate diverse, realistic driving scenarios from text prompts (e.g., "rainy night driving")
- Controllable ego-vehicle behavior via action conditioning
- Understands 3D geometry, occlusion, and scene dynamics
- Can be used for synthetic data generation to augment real-world training data

### GAIA-2: Multi-View Controllable World Model

**Paper:** [GAIA-2: A Controllable Multi-View Generative World Model for Autonomous Driving](https://arxiv.org/abs/2503.20523) (March 2025)

#### Architectural Innovations over GAIA-1

| Feature | GAIA-1 | GAIA-2 |
|---|---|---|
| Generation paradigm | Autoregressive token prediction | Latent diffusion model |
| Video tokenizer | VQ per-frame | Continuous latent space encoder (spatial 32x, temporal 8x downsampling, latent dim 64, total compression 384x) |
| Camera views | Single view | Up to 5 synchronized camera views |
| Resolution | -- | 448 x 960 per view |
| Scene control | Text + action conditioning | Fine-grained control over ego-action, weather, lighting, road config, agents |
| Training data | London only | Multi-country (UK, US, Germany) |

#### Architecture Details
- **Video tokenizer**: encoder uses a series of spatial transformer blocks; predicts parameters (mean and standard deviation) of a Gaussian distribution for each latent token
- **Latent world model**: a **diffusion model** that predicts future latent states conditioned on past latent states, ego-vehicle actions, and contextual information
- **Denoising backbone**: a **space-time factorized transformer** that separates spatial attention (within each frame) from temporal attention (across frames)

#### Conditioning Parameters
- **Ego-action**: speed, steering curvature
- **Environmental**: weather conditions, time of day, lighting
- **Road configuration**: number of drivable lanes, speed limits, pedestrian crossings, intersections
- **Agent behavior**: control over other road users' trajectories and behaviors

### GAIA-3: World Model for Safety and Evaluation

**Launched:** December 2, 2025

#### Scale and Architecture

| Specification | GAIA-2 | GAIA-3 |
|---|---|---|
| Total parameters | ~7.5B | **15B** |
| Video tokenizer size | Base | **2x larger** |
| Training data scale | Base | **10x more data** |
| Focus | Generation quality | Safety evaluation and validation |

#### New Evaluation Modes
1. **Safety-critical scenario generation**: synthesize rare, dangerous driving scenarios for model validation
2. **Embodiment transfer**: consistent evaluation across different vehicle sensor rigs and platforms
3. **Controlled visual diversity**: robustness testing under varied visual conditions

#### Performance
- Simulated testing closely mirrors real-world driving results
- Reduced synthetic-test rejection rates **fivefold** compared to previous generation
- Enables a more faithful representation of real-world physics and causality due to the doubled tokenizer and model size

---

## 5. Foundation Model -- PRISM-1

### Overview

**PRISM-1** is Wayve's scene reconstruction model for creating **photorealistic 4D simulations** (3D space + time) of dynamic driving scenarios. While GAIA generates entirely new scenes from scratch, PRISM-1 **reconstructs existing recorded scenes** with sufficient fidelity for closed-loop simulation.

### Technical Architecture

#### Core Representation
- Built on **3D Gaussian Splatting** as the primary scene representation (confirmed by visible Gaussian artifacts in outputs)
- Employs **novel view synthesis** to render scenes from arbitrary camera viewpoints
- Operates on **camera-only inputs** -- no LiDAR or 3D bounding boxes required

#### Inductive Biases for Generalization
PRISM-1 achieves generalization by incorporating both geometric and semantic inductive biases:

**Geometric elements:**
- Depth estimation
- Surface normals
- Optical flow

**Semantic elements:**
- Semantic segmentation
- Features from a foundation vision model

#### Dynamic Scene Handling
- Reconstructs **dynamic and deformable elements**: cyclists, pedestrians, brake lights, opening car doors, road debris
- Avoids the need for explicit labels, scene graphs, or bounding boxes
- Scales efficiently as scene complexity increases

### Relationship to Ghost Gym
PRISM-1 serves as the reconstruction backbone for **Ghost Gym**, Wayve's closed-loop neural simulator. It provides the scene representation that Ghost Gym uses to generate photorealistic re-simulations of real-world driving scenarios with modified ego-vehicle behavior.

### WayveScenes101 Benchmark
Alongside PRISM-1, Wayve released the **WayveScenes101** dataset:
- **101 diverse driving scenes** from the UK and US
- Urban, suburban, and highway environments
- Various weather and lighting conditions
- 20 seconds per scene, 10 FPS per camera, 5 synchronized cameras
- **101,000 camera images** with camera poses obtained from COLMAP
- Open-source code and data available on [GitHub](https://github.com/wayveai/wayve_scenes)

---

## 6. Sensor Suite

### Philosophy: Camera-First, Sensor-Flexible

Wayve believes that **cameras and radar** will be the most important sensors for building a safe and affordable AI Driver system. Their architecture is designed to be **sensor-agnostic** -- the core neural network can ingest data from various sensor modalities, allowing OEM partners to choose their preferred sensor configuration.

### Sensor Configuration by Platform

| Platform / Use Case | Cameras | Radar | LiDAR | Notes |
|---|---|---|---|---|
| Core R&D fleet | 6 monocular cameras (360-degree) | Optional | Optional | Minimum viable sensor set |
| Nissan ProPILOT prototype | 11 cameras | 5 radar sensors | 1 next-gen LiDAR | OEM-specified configuration |
| OEM consumer vehicles (2027+) | Flexible (camera-first) | Automotive radar (low-cost) | Optional add-on | Cost-optimized for mass production |
| Gen 3 L4 robotaxi platform | Multi-camera surround view | Integrated | Available | Full redundancy for driverless operation |

### Rationale for Camera-First

1. **Cost efficiency**: cameras are orders of magnitude cheaper than LiDAR
2. **Information density**: cameras capture color, texture, and semantic information that LiDAR cannot
3. **Scalability**: every car already has cameras; adding more is straightforward
4. **AI-friendly**: modern vision transformers excel at extracting 3D understanding from 2D images

### Adding Radar
Wayve introduced radar to complement the camera-first approach because:
- Radar provides direct velocity measurement of other objects
- Functions reliably in adverse weather (rain, fog, snow)
- Provides safety benefits at low cost
- Enhances robustness without replacing camera-based perception

### Optional LiDAR
- LiDAR can be integrated as needed by the OEM
- Used for ground-truth validation and development
- Not required by the core AI architecture
- Wayve has incorporated LiDAR into some development vehicles to enhance system capabilities

### On-Vehicle Compute
- **Current R&D**: NVIDIA GPU-powered compute units mounted on vehicle
- **Gen 3 platform**: **NVIDIA DRIVE AGX Thor** (Blackwell architecture, up to 2,000 FP4 TFLOPS)
- **Production target**: **Qualcomm Snapdragon Ride** SoC platform for consumer vehicle deployment
  - Safety-certified architecture with redundancy, real-time monitoring, and secure system isolation
  - Energy-efficient on-device AI inference
  - Pre-integrated with Wayve's AI Driver and Qualcomm's Active Safety software

---

## 7. Autonomy Software Stack

### End-to-End Architecture

Unlike traditional AV stacks that consist of 10+ separate modules, Wayve's autonomy software is organized around a **single foundation driving model** with supporting components:

```
                    +---------------------------+
                    |    Satellite Navigation    |
                    |  (turn-by-turn directions) |
                    +------------+--------------+
                                 |
  +--------+  +--------+  +-----v-----+  +---------+
  |Camera 1|  |Camera 2|  | Camera N  |  | Radar   |
  +---+----+  +---+----+  +-----+-----+  +----+----+
      |           |              |             |
      +-----+-----+------+------+------+------+
            |             |             |
      +-----v-------------v-------------v------+
      |                                        |
      |     Foundation Driving Model           |
      |     (End-to-End Neural Network)        |
      |                                        |
      |  +----------------------------------+  |
      |  | Vision Backbone (multi-camera)   |  |
      |  +----------------------------------+  |
      |  | Spatial-Temporal Reasoning       |  |
      |  +----------------------------------+  |
      |  | Motion Planning Head             |  |
      |  +----------------------------------+  |
      |                                        |
      +---+------+------+------+------+--------+
          |      |      |      |      |
          v      v      v      v      v
     Motion   Depth  Semantics Flow  Language
     Plan     (aux)   (aux)   (aux)  Commentary
          |
          v
   +------+------+
   | Vehicle     |
   | Controller  |
   | (actuators) |
   +-------------+
```

### Wayve AI Driver Product

The **Wayve AI Driver** is the commercial product built on the foundation driving model:

- **L2+ "Hands-Off" Mode**: supervised autonomy where the vehicle steers, navigates, and responds to traffic under driver supervision (planned for consumer vehicles from 2027)
- **L3 "Eyes-Off" Mode**: the system handles driving in defined domains while the human can disengage attention
- **L4 Driverless Mode**: fully autonomous operation for robotaxi use cases (trials from 2026)

### How It Differs from Modular Stacks

| Modular Stack Component | Wayve Equivalent |
|---|---|
| HD Map localization module | Eliminated; uses standard sat-nav + learned spatial reasoning |
| Object detection module | Subsumed into the unified model's learned representations |
| Object tracking module | Implicitly learned through temporal reasoning |
| Trajectory prediction module | Implicitly learned; world model capabilities |
| Route planning module | Standard sat-nav provides high-level routing |
| Motion planning module | Directly output by the foundation model |
| Rule-based behavior planner | Eliminated; driving behavior is learned from data |
| Separate safety monitor | Integrated safety mechanisms + external NCAP-aligned checks |

---

## 8. Machine Learning & AI

### Training Methodology

#### Self-Supervised Learning (Primary)
The majority of Wayve's training is **self-supervised**, meaning models learn from raw, unlabeled driving data without requiring expensive per-frame annotations:

- **Future prediction**: the model learns to predict what will happen next in a driving scene
- **Depth estimation**: learned from geometric consistency across stereo/multi-view cameras and temporal sequences
- **Optical flow**: learned from frame-to-frame pixel correspondence
- **Ego-motion estimation**: learned from odometry signals

#### Imitation Learning
- The model learns to mimic human expert driving behavior from recorded data
- **MILE (Model-Based Imitation Learning)**: jointly learns a world model and a driving policy from an offline corpus of driving data
- MILE can "imagine" diverse and plausible futures and use this ability to plan future actions

#### Reinforcement Learning (Historical Foundation)
- Wayve's earliest work (2018) used **Deep Deterministic Policy Gradients (DDPG)** to learn lane following
- Original network: 4 convolutional layers + 3 fully connected layers, ~10,000 parameters
- Demonstrated "Learning to Drive in a Day" -- the first work showing deep RL as viable for autonomous driving
- RL concepts remain influential in the current training pipeline, particularly for reward shaping and policy optimization

#### Active Learning
- Wayve employs active learning to identify and prioritize the most informative driving scenarios from fleet data
- This creates "convergent and predictably rewarding training cycles"
- Ensures the model continuously improves on its weakest areas

### Model Architectures

#### Transformer-Based Foundation Model
- The core driving model is a **transformer-based architecture**
- Processes multi-camera video through a vision backbone
- Uses self-attention mechanisms for spatial and temporal reasoning
- Contains tens of millions of parameters in the deployed driving model

#### Vision Backbone
- Multi-camera image features are extracted and lifted into 3D using learned depth probability distributions
- 3D feature voxels are projected to **bird's-eye-view (BEV)** representation through sum-pooling operations
- BEV representation compressed to 1D latent vector encoding the world state

#### Generative Models

| Model | Architecture | Purpose |
|---|---|---|
| GAIA-1 | Autoregressive transformer + video diffusion decoder | World modeling, synthetic data generation |
| GAIA-2 | Latent diffusion model with space-time factorized transformer | Multi-view controllable world simulation |
| GAIA-3 | Scaled latent diffusion (15B params) | Safety evaluation and validation |
| LINGO-1 | Vision encoder + auto-regressive language model | Open-loop scene commentary |
| LINGO-2 | Vision model + auto-regressive language model (VLA) | Closed-loop language-conditioned driving |
| MILE | CNN encoder + BEV projection + RNN dynamics + StyleGAN-like decoders | End-to-end imitation learning with world model |
| PRISM-1 | 3D Gaussian Splatting with geometric/semantic priors | 4D scene reconstruction |

#### MILE Architecture Details
- Converts captured images to 3D using depth probability distributions with predefined depth bins, camera intrinsics and extrinsics
- 3D feature voxels converted to BEV through sum-pooling on a predefined grid
- Observation decoder and BEV decoder use **StyleGAN-like architecture**: prediction starts as a learned constant tensor, progressively upsampled with latent state injected via adaptive instance normalization
- Temporal dynamics modeled by a **recurrent neural network (RNN)** predicting next latent state from previous state

### Training Data

- **Proprietary fleet data**: collected from Wayve's R&D fleet and partner fleets across the UK, US, Germany, Canada, and Japan
- **Scale**: thousands of hours of driving data (4,700 hours confirmed for GAIA-1 training alone; total corpus is significantly larger)
- **Diversity**: tested across 500+ cities across Europe, North America, and Japan without city-specific fine-tuning
- **Synthetic data**: generated by GAIA models to augment real-world data, particularly for rare and safety-critical scenarios
- **Language data**: expert drivers providing spoken commentary while driving, creating paired vision-language-action datasets

---

## 9. Simulation

### Ghost Gym: Neural Simulator for Autonomous Driving

**Ghost Gym** is Wayve's proprietary **closed-loop data-driven neural simulator** that enables testing and validation of end-to-end AI driving models.

#### Architecture Components

Ghost Gym aligns three key components:

1. **Neural Renderer** (powered by PRISM-1): photorealistic 4D scene reconstruction from camera data using 3D Gaussian Splatting
2. **Simulated Robot Car**: high-fidelity vehicle model with accurate dynamics
3. **Vehicle Dynamics Model**: precise simulation of how the vehicle responds to control inputs

#### Closed-Loop vs Open-Loop

The critical advantage of Ghost Gym over traditional replay-based testing:

| Feature | Open-Loop Replay | Ghost Gym (Closed-Loop) |
|---|---|---|
| Environment response | Static; replays recorded data | Dynamic; environment changes based on ego-vehicle actions |
| Scenario divergence | Cannot test counterfactuals | Can test "what if" scenarios |
| Failure investigation | Limited to recorded behavior | Can reproduce and debug model failures offline |
| Iteration speed | Requires new real-world data collection | Rapid virtual iteration |

#### Applications
- **Model validation**: consistent testing conditions for evaluating driving model updates
- **Failure debugging**: reproduce model failures offline with full component visibility
- **Scenario generation**: create thousands of simulated scenarios from recorded driving data
- **Training data augmentation**: generate diverse training scenarios

### GAIA Models for Generative Simulation

While Ghost Gym + PRISM-1 handles **re-simulation** of recorded scenes, the GAIA family generates **entirely new scenarios**:

| Model | Simulation Role |
|---|---|
| GAIA-1 | Generate novel driving videos from text/action prompts |
| GAIA-2 | Generate multi-view, controllable driving scenarios with fine-grained scene control |
| GAIA-3 | Generate safety-critical scenarios for evaluation; embodiment transfer across vehicle platforms |

The combination of PRISM-1 (reconstruction-based simulation) and GAIA (generation-based simulation) provides comprehensive coverage for both replaying real events and imagining scenarios that have never been recorded.

---

## 10. Cloud & Data Infrastructure

### Microsoft Azure Partnership

Wayve selected **Microsoft Azure** as its primary cloud platform, citing cost, technology, and strategic alignment as key factors. Microsoft is also an investor (Series B, C, and D).

#### Compute Infrastructure

| Resource | Specification |
|---|---|
| Training GPUs (historical) | Collections of machines with up to 8x NVIDIA V100 GPUs, 612 GB RAM |
| Training GPUs (GAIA-1 era) | 64x NVIDIA A100 GPUs (world model) + 32x NVIDIA A100 GPUs (decoder) |
| GPU provisioning | Mix of reserved instances (base load) and spot/pre-emptible instances (bursty workloads) |
| Network throughput | Up to 400 Gbps theoretical throughput for distributed training |
| Performance gain | 90% faster model training through Azure optimization |

#### Data Storage Strategy

| Storage Tier | Purpose |
|---|---|
| Azure Blob Storage (Archive) | Unfiltered, full-resolution image and video data from fleet |
| Azure Blob Storage (Hot) | Latest training curriculum -- curated, processed datasets ready for training |

#### Infrastructure Tools
- **Apache Airflow**: workflow orchestration for training pipelines
- **Apache Spark / Hadoop**: distributed data processing for large-scale driving datasets

### NVIDIA Partnership (Compute)

- **Training**: NVIDIA A100 and later-generation GPUs via Azure
- **On-vehicle (R&D)**: NVIDIA GPU-powered compute units
- **On-vehicle (Gen 3)**: NVIDIA DRIVE AGX Thor (Blackwell architecture, 2,000 FP4 TFLOPS)
- **Historical**: Collaboration since 2018, starting with NVIDIA DRIVE PX2
- Every generation of Wayve's robot platforms has been powered by NVIDIA technology

### Qualcomm Partnership (Edge Compute)

- **Production vehicles**: Qualcomm Snapdragon Ride SoC platform
- Combines Wayve's AI Driver with Qualcomm's Active Safety stack in a pre-integrated solution
- Safety-certified architecture with redundancy, real-time monitoring, and secure system isolation
- Targets entry-level hands-off driver assistance through eyes-off automated driving
- Exploring Snapdragon Ride for future L4 robotaxi applications

---

## 11. Programming Languages & Tools

### Known Technology Stack

Based on public disclosures, job postings, and technology profiling:

| Category | Technologies |
|---|---|
| Primary ML Framework | **PyTorch** |
| Programming Languages | **Python** (ML/research), **C++** (on-vehicle inference, performance-critical), **Rust** (systems) |
| Data Processing | **Pandas**, **Apache Spark**, **Hadoop** |
| Workflow Orchestration | **Apache Airflow** |
| Cloud Platform | **Microsoft Azure** (Blob Storage, VM instances, networking) |
| Web/Infrastructure | **Apache** web server |
| GPU Computing | **NVIDIA CUDA**, **cuDNN**, **TensorRT** (inference optimization), **Triton** (inference serving) |
| ML Operations | MLOps pipelines for continuous model deployment to fleet |
| Simulation | Ghost Gym (proprietary), PRISM-1 (proprietary), GAIA models (proprietary) |
| Engineering/CAD | **AutoCAD**, **Dassault SOLIDWORKS** (hardware and vehicle modification design) |
| On-Vehicle OS | **NVIDIA DriveOS** (safety-certified) on DRIVE AGX Thor |
| Edge Inference | **Qualcomm Snapdragon Ride** platform (production vehicles) |
| Version Control / CI | Standard Git-based workflows (GitHub; Wayve maintains public repos at github.com/wayveai) |

### Open-Source Contributions

Wayve maintains a GitHub organization ([wayveai](https://github.com/wayveai)) with several public repositories:
- **wayve_scenes**: WayveScenes101 dataset and benchmark code
- **LingoQA**: Visual Question Answering benchmark for autonomous driving (ECCV 2024)
- Forks and contributions to projects like **segment-anything-2**

---

## 12. Safety Architecture

### Philosophy: Learned Safety with Engineered Guarantees

Wayve's safety approach balances the generalization capabilities of learned systems with the rigor of traditional automotive safety engineering.

### Multi-Layer Safety Framework

#### Layer 1: Foundation Model Safety (Learned)
- The core driving model learns safe driving behavior from millions of miles of human expert driving data
- Self-supervised learning ensures the model has been exposed to diverse scenarios
- Superior generalization capabilities allow the model to handle unexpected scenarios even without prior training exposure
- World model (GAIA) capabilities allow the AI to "imagine" consequences of actions before executing them

#### Layer 2: Auxiliary Safety Outputs (Interpretable)
- Decoded intermediate representations provide transparency into the model's internal state
- Semantic segmentation, depth estimation, and object detection outputs enable monitoring
- These outputs can be compared against expected values to detect anomalies

#### Layer 3: NCAP-Aligned Active Safety (Engineered)
- Wayve's technology supports **NCAP (New Car Assessment Programme)** and **GSR (General Safety Regulation)** active-safety test protocols
- Integrated on-board components combine the foundation driving model with NCAP-aligned safety mechanisms
- These mechanisms provide rule-based safety checks as a complementary layer

#### Layer 4: Functional Safety Compliance (FuSa)
- The system is **FuSa-compliant by design** (aligned with ISO 26262)
- Qualcomm Snapdragon Ride platform provides safety-certified architecture with:
  - Hardware redundancy
  - Real-time monitoring
  - Secure system isolation
- NVIDIA DRIVE AGX Thor runs safety-certified NVIDIA DriveOS with NVIDIA Halos comprehensive safety system

#### Layer 5: Redundant Interpretable Safety Systems
- For safety-critical operations, redundant safety is achieved with **interpretable methods** designed to identify and resolve specific failure modes
- These operate independently of the neural network, providing a safety net if the learned system fails

### Validation Through Simulation
- **GAIA-3** generates safety-critical scenarios that are rare and dangerous to reproduce in the real world
- **Ghost Gym** enables closed-loop testing of the driving model's response to hazardous situations
- Early studies show GAIA-3 simulated testing closely mirrors real-world driving results
- Synthetic-test rejection rates reduced fivefold with GAIA-3

### Safety Standards Alignment

| Standard | Status |
|---|---|
| Euro NCAP active safety protocols | Supported |
| GSR (General Safety Regulation) | Supported |
| ISO 26262 (Functional Safety) | FuSa-compliant by design |
| Automotive-grade compute certification | Via NVIDIA DriveOS and Qualcomm safety-certified SoCs |

---

## 13. Testing & Operations

### Geographic Scope of Testing

| Region | Status | Details |
|---|---|---|
| London, UK | Primary testing since 2019 | Fleet of retrofitted vehicles; L4 trials planned spring 2026 |
| Greater UK | Active | Testing across multiple cities and road types |
| San Francisco / Bay Area, USA | Active since 2025 | L2+ testing on public roads; office in Sunnyvale |
| Germany | Active | European expansion hub; data collection for GAIA-2 training |
| Canada | Active | Engineering and testing operations |
| Japan (Tokyo) | Planned late 2026 | Robotaxi pilot with Uber and Nissan |
| 500+ cities globally | Demonstrated | Driving tests across Europe, North America, and Japan without city-specific fine-tuning |

### Test Fleet

- **Vehicle platforms**: Jaguar I-Pace SUVs (early fleet), Nissan LEAF (Uber/Nissan robotaxi pilot), various OEM vehicles
- **Gen 3 platform**: built on NVIDIA DRIVE AGX Thor, adaptable to multiple vehicle platforms
- **Sensor configurations**: vary by platform and use case (6-camera minimum to 11-camera + radar + LiDAR for advanced prototypes)

### Deployment Methodology

Wayve practices **fleet learning** -- models are trained centrally in the cloud, deployed to vehicles across the fleet, and real-world performance data flows back to improve the next model iteration:

1. **Data collection**: fleet vehicles record driving data during normal operation
2. **Active learning**: system identifies the most informative/challenging scenarios
3. **Central training**: models retrained on Azure GPU clusters
4. **Validation**: tested in Ghost Gym simulation and GAIA-generated scenarios
5. **Deployment**: updated models pushed to fleet vehicles
6. **Monitoring**: real-world performance tracked; cycle repeats

### Commercial Deployment Timeline

| Date | Deployment |
|---|---|
| Spring 2026 | L4 robotaxi trials in London (with Uber) |
| Late 2026 | Robotaxi pilot in Tokyo (with Uber and Nissan) |
| 2026+ | Expansion to 10+ cities globally for robotaxi service |
| 2027 | Consumer vehicles with L2+ Wayve AI Driver (starting with Nissan) |
| 2027+ | Broader OEM deployment (Mercedes-Benz, Stellantis) |

---

## 14. Key Partnerships

### Strategic Technology Partners

#### NVIDIA
- **Relationship since**: 2018 (earliest collaboration on DRIVE PX2)
- **Investment**: Participated in Series C ($1.05B, 2024) and Series D ($1.2B, 2026); signed LOI for potential $500M investment (September 2025)
- **Technology**: Every generation of Wayve's robot platforms powered by NVIDIA; Gen 3 built on DRIVE AGX Thor; training on NVIDIA GPUs (A100, etc.)
- **Significance**: Deep hardware-software co-development; NVIDIA provides both training infrastructure and on-vehicle compute

#### Microsoft
- **Relationship since**: Series B (2022)
- **Investment**: Participated in Series B, C, and D
- **Technology**: Azure cloud infrastructure for training and data storage; 90% training speedup
- **Significance**: Provides the scale, reliability, and safety needed for commercial deployment

#### Qualcomm
- **Relationship**: Technical collaboration announced 2025
- **Technology**: Snapdragon Ride SoC platform for production vehicle deployment; pre-integrated solution combining Wayve AI Driver with Qualcomm Active Safety stack
- **Significance**: Path to mass-market consumer vehicle integration at automotive-grade cost and safety

### Mobility & Fleet Partners

#### Uber
- **Investment**: Participated in Series D; additional milestone-based capital for robotaxi scaling
- **Operational**: Joint robotaxi deployment in 10+ cities globally; London L4 trials (spring 2026); Tokyo pilot (late 2026); Uber Autonomous Solutions initiative
- **Significance**: Provides the ride-hailing network and operational infrastructure for robotaxi commercialization

### OEM Partners

| OEM | Partnership Scope | Timeline |
|---|---|---|
| **Nissan** | Next-gen ProPILOT driver-assist integration; Nissan LEAF robotaxi platform for Tokyo pilot | L2+ in mass-market vehicles from FY2027; Tokyo robotaxi late 2026 |
| **Mercedes-Benz** | Investor in Series D; dual-track development for consumer vehicles and robotaxi | Active collaboration on L2+ through L4 |
| **Stellantis** | Investor in Series D; autonomous driving solutions for consumer and commercial applications | Active collaboration |

### Financial Investors

| Investor | Rounds Participated |
|---|---|
| SoftBank Vision Fund 2 | Series C (lead), Series D |
| Eclipse Ventures | Series A (lead), Series B (lead), Series D (co-lead) |
| Balderton Capital | Series A, Series B, Series D (co-lead) |
| Baillie Gifford | Series B, Series D |
| Ontario Teachers' Pension Plan | Series D |
| British Business Bank | Series D |
| Schroders Capital | Series D |
| D1 Capital Partners | Series B |
| Virgin Group / Richard Branson | Series B |
| Compound | Seed |
| Firstminute Capital | Seed |

---

## 15. Research & Publications

### Alex Kendall's Foundational Academic Work

Alex Kendall's academic contributions have been highly influential (52,000+ Google Scholar citations):

| Paper | Venue/Year | Key Contribution | Citations |
|---|---|---|---|
| **PoseNet: A Convolutional Network for Real-Time 6-DOF Camera Relocalization** | ICCV 2015 | First CNN to regress full 6-DOF camera pose from a single RGB image end-to-end | High |
| **SegNet: A Deep Convolutional Encoder-Decoder Architecture for Image Segmentation** | IEEE TPAMI 2017 | Efficient encoder-decoder architecture for pixel-wise semantic segmentation (with Badrinarayanan, Cipolla) | Very high |
| **Bayesian SegNet: Model Uncertainty in Deep Convolutional Encoder-Decoder Architectures for Scene Understanding** | arXiv 2015 | Monte Carlo dropout for uncertainty estimation in segmentation; 2-3% improvement from uncertainty modeling | High |
| **What Uncertainties Do We Need in Bayesian Deep Learning for Computer Vision?** | NeurIPS 2017 | Distinguishes aleatoric and epistemic uncertainty; framework for uncertainty in deep learning (with Gal) | Very high |
| **Multi-Task Learning Using Uncertainty to Weigh Losses for Scene Geometry and Semantics** | CVPR 2018 | Principled multi-task learning using homoscedastic uncertainty to weigh losses (with Gal, Cipolla) | Very high |
| **Learning to Drive in a Day** | ICRA 2019 | First demonstration that deep RL is viable for autonomous driving; 10K-parameter network learns lane following | Seminal |

### Wayve Research Publications

| Paper | Year | Key Contribution |
|---|---|---|
| **Learning to Drive in a Day** | 2018 | Deep RL for autonomous driving; DDPG with 10K parameters |
| **Urban Driving with Conditional Imitation Learning** | ICRA 2020 | Conditional imitation learning for urban driving (Hawke et al.) |
| **Orthographic Feature Transform for Monocular 3D Object Detection** | BMVC 2019 | BEV feature projection for 3D detection (Roddick, Kendall, Cipolla) |
| **Reimagining an Autonomous Vehicle** | arXiv 2021 | Manifesto for end-to-end learned driving; auxiliary self-supervised outputs |
| **MILE: Model-Based Imitation Learning** | NeurIPS 2022 | Joint world model + driving policy from offline data; StyleGAN-like decoders |
| **GAIA-1: A Generative World Model for Autonomous Driving** | arXiv 2023 | 9B parameter world model; autoregressive transformer + video diffusion |
| **LINGO-1: Exploring Natural Language for Autonomous Driving** | 2023 | Open-loop vision-language driving commentator |
| **LingoQA: Visual Question Answering for Autonomous Driving** | ECCV 2024 | VQA benchmark; 419K QA pairs; Lingo-Judge metric |
| **LINGO-2: Driving with Natural Language** | 2024 | First closed-loop VLA model tested on public roads |
| **GAIA-2: A Controllable Multi-View Generative World Model** | arXiv 2025 | Latent diffusion world model; multi-view; fine-grained control |
| **PRISM-1: Photorealistic Reconstruction in Static and Dynamic Scenes** | 2025 | 4D scene reconstruction from camera-only input using Gaussian Splatting |
| **WayveScenes101: A Dataset and Benchmark for Novel View Synthesis** | 2024 | 101-scene benchmark for autonomous driving NVS |
| **GAIA-3: Scaling World Models to Power Safety and Evaluation** | 2025 | 15B parameter world model for AV safety validation |

### PhD Thesis
**"Geometry and Uncertainty in Deep Learning for Computer Vision"** -- Alex Kendall's Cambridge PhD thesis, awarded the 2018 BMVA Prize and 2019 ELLIS Prize. Demonstrated how end-to-end deep learning could enable safe and real-time scene understanding, laying the intellectual foundation for Wayve.

---

## 16. Competitive Differentiators

### 1. Truly End-to-End Learned System
Wayve is the most committed major AV company to the end-to-end approach. While Tesla has moved in this direction and Waymo is incorporating E2E elements, Wayve was built from day one on the premise that a single learned model should handle the entire driving task. This gives them the deepest expertise and longest iteration history in this paradigm.

### 2. No HD Maps Required
By eliminating the dependency on pre-built HD maps, Wayve can deploy to new cities with minimal incremental effort. Traditional AV companies (Waymo, Aurora, Cruise) must create and maintain detailed maps for every street they operate on -- a process that is expensive, time-consuming, and fragile to real-world changes. Wayve's system has been tested in 500+ cities without city-specific fine-tuning.

### 3. Hardware-Agnostic, OEM-Friendly Business Model
Wayve licenses its technology to OEMs rather than building its own vehicles or operating its own fleet. This positions Wayve as a **platform** that multiple automakers can adopt:
- Nissan, Mercedes-Benz, and Stellantis are all investors and integration partners
- Qualcomm Snapdragon Ride provides a cost-effective, automotive-grade compute platform for mass production
- NVIDIA DRIVE AGX Thor provides high-performance compute for L4 robotaxi applications
- The same AI stack scales from L2+ consumer ADAS to L4 driverless robotaxis

### 4. World Model Capabilities (GAIA Family)
Wayve is a leader in **generative world models for driving** -- a category they helped pioneer. The GAIA family (1/2/3) enables:
- Synthetic training data generation at scale
- Safety-critical scenario simulation
- Validation and evaluation without real-world risk
- This is a capability moat that most competitors lack

### 5. Vision-Language-Action Integration (LINGO)
LINGO-2 is the **world's first closed-loop VLA model tested on public roads**, demonstrating capabilities no competitor has matched:
- Driving that can be instructed via natural language
- Real-time natural language explanations of driving decisions
- Potential for intuitive human-AV interaction

### 6. Self-Supervised Learning at Scale
Wayve's reliance on self-supervised learning (rather than expensive per-frame annotation) means:
- Training data scales with fleet miles driven, not annotation budget
- No human labeling bottleneck
- Continuous improvement as the fleet grows

### 7. Generalization Over Specialization
Wayve explicitly optimizes for generalization -- the ability to handle novel scenarios never seen in training. Traditional modular systems tend to overfit to their specific operational design domains and fail at the edges. Wayve's approach is philosophically aligned with the scaling laws observed in large language models: more diverse data and larger models lead to emergent capabilities.

### Competitive Landscape Summary

| Company | Approach | Maps | Sensors | Business Model | Status |
|---|---|---|---|---|---|
| **Wayve** | End-to-end learned | No HD maps | Camera-first + radar | OEM licensing + robotaxi | Pre-commercial; trials 2026 |
| **Waymo** | Modular (incorporating E2E) | HD maps | LiDAR + camera + radar | Own fleet operator | Commercial in US cities |
| **Tesla** | End-to-end (evolved) | No HD maps | Camera-only | Own vehicles only | FSD Beta widely deployed |
| **Aurora** | Modular | HD maps | LiDAR + camera + radar | OEM licensing (trucks first) | Commercial trucking |
| **Cruise** | Modular | HD maps | LiDAR + camera + radar | Own fleet (GM) | Paused/restructuring |
| **Mobileye** | Modular + RSS safety | Crowdsourced maps | Camera-first + radar | OEM licensing (chip + software) | Commercial ADAS; SuperVision |

---

## Appendix: Model Parameter Summary

| Model | Parameters | Architecture | Training Compute | Training Data |
|---|---|---|---|---|
| GAIA-1 World Model | 6.5B | Autoregressive transformer | 64x A100, 15 days | 4,700 hours London driving |
| GAIA-1 Video Decoder | 2.6B | Video diffusion model | 32x A100, 15 days | Same as world model |
| GAIA-1 Total | **~9.1B** | -- | -- | -- |
| GAIA-2 | ~7.5B (est.) | Latent diffusion + space-time transformer | Not disclosed | UK, US, Germany driving data |
| GAIA-3 | **15B** | Scaled latent diffusion | Not disclosed | 10x more data than GAIA-2 |
| LINGO-1 | Not disclosed | Vision encoder + auto-regressive LM | Not disclosed | UK expert-driver commentary |
| LINGO-2 | Not disclosed | Vision model + auto-regressive LM (VLA) | Not disclosed | Vision-language-action data |
| LingoQA Baseline | ~7B | Vicuna-1.5-7B + late video fusion | Not disclosed | 419K QA pairs |
| MILE | Not disclosed | CNN + BEV + RNN + StyleGAN decoders | Not disclosed | Offline driving corpus |
| Driving Model (deployed) | Tens of millions | Transformer-based | Azure GPU clusters | Fleet + synthetic data |
| Early RL model (2018) | ~10K | 4 conv + 3 FC layers | Single GPU | RL episodes |

---

## Sources

- [TechCrunch: Wayve raises $1.2B Series D](https://techcrunch.com/2026/02/24/self-driving-tech-startup-wayve-raises-1-2b-from-nvidia-uber-and-three-automakers/)
- [Wayve: Series D Announcement](https://wayve.ai/press/series-d/)
- [Wayve: Investors Page](https://wayve.ai/company/investors/)
- [CNBC: Wayve Series C ($1.05B)](https://www.cnbc.com/2024/05/07/wayve-just-raised-over-1-billion-from-nvidia-softbank-microsoft-eclipse-ventures.html)
- [Wayve: Series C Announcement](https://wayve.ai/press/series-c/)
- [Wikipedia: Wayve](https://en.wikipedia.org/wiki/Wayve)
- [Wayve: Scaling GAIA-1](https://wayve.ai/thinking/scaling-gaia-1/)
- [arXiv: GAIA-1 Paper](https://arxiv.org/abs/2309.17080)
- [Wayve: GAIA-1 Technical Report](https://wayve.ai/press/wayve-releases-gaia-1-technical-report/)
- [Wayve: GAIA-2 Blog](https://wayve.ai/thinking/gaia-2/)
- [arXiv: GAIA-2 Paper](https://arxiv.org/abs/2503.20523)
- [Wayve: GAIA-3 Blog](https://wayve.ai/thinking/gaia-3/)
- [Wayve: GAIA-3 Press Release](https://wayve.ai/press/wayve-launches-gaia3/)
- [Wayve: LINGO-1 Blog](https://wayve.ai/thinking/lingo-natural-language-autonomous-driving/)
- [Wayve: LINGO-2 Blog](https://wayve.ai/thinking/lingo-2-driving-with-language/)
- [Wayve: LINGO Science Page](https://wayve.ai/science/lingo/)
- [arXiv: LingoQA Paper](https://arxiv.org/abs/2312.14115)
- [GitHub: LingoQA](https://github.com/wayveai/LingoQA)
- [Wayve: PRISM-1 Blog](https://wayve.ai/thinking/prism-1/)
- [Wayve: PRISM-1 Press Release](https://wayve.ai/press/wayve-unveils-prism-1/)
- [Wayve: Ghost Gym Blog](https://wayve.ai/thinking/ghost-gym-neural-simulator/)
- [Wayve: Sensor Stack Explained](https://wayve.ai/thinking/introducing-radar-wayves-lean-sensor-stack-explained/)
- [Wayve: Technology Page (AV2.0)](https://wayve.ai/technology/)
- [Wayve: AI Driver Product Page](https://wayve.ai/product/wayve-ai-driver/)
- [Wayve: E2E Embodied AI Blog](https://wayve.ai/thinking/e2e-embodied-ai-solves-the-long-tail/)
- [Wayve: Emerging Behaviour Blog](https://wayve.ai/thinking/emerging-behaviour-of-our-driving-intelligence-with-end-to-end-deep-learning/)
- [Wayve: Learning to Drive in a Day](https://wayve.ai/thinking/learning-to-drive-in-a-day/)
- [Wayve: MILE Blog](https://wayve.ai/thinking/learning-a-world-model-and-a-driving-policy/)
- [Wayve: Azure Scaling Blog](https://wayve.ai/thinking/scaling-machine-learning-from-garage-to-fleet-with-microsoft-azure/)
- [Wayve: Gen 3 / NVIDIA DRIVE AGX Thor](https://wayve.ai/thinking/wayve-gen-3/)
- [Wayve: Qualcomm Collaboration](https://wayve.ai/press/qualcomm-wayve-collaboration/)
- [Wayve: Uber L4 Autonomy Trials](https://wayve.ai/press/wayve-uber-l4-autonomy-trials/)
- [Wayve: Nissan/Uber/Wayve Robotaxi Collaboration](https://wayve.ai/press/wayve-nissan-uber-robotaxi-collaboration/)
- [Wayve: Reimagining an Autonomous Vehicle (PDF)](https://wayve.ai/wp-content/uploads/2024/04/2108.05805-1.pdf)
- [Wayve: Series B Announcement](https://wayve.ai/press/wayve-announces-200-million-in-funding-to-accelerate-the-development-of-av2-0-the-next-wave-of-autonomous-vehicles/)
- [Alex Kendall Personal Site](https://alexgkendall.com/)
- [Wayve: Alex Kendall Bio](https://wayve.ai/company/leadership-team/alex-kendall/)
- [Google Scholar: Alex Kendall](https://scholar.google.com/citations?user=hE2mTp4AAAAJ&hl=en)
- [Cambridge: Alex Kendall Alumni Story](https://www.eng.cam.ac.uk/news/alumni-stories-meet-alex-kendall-autonomous-vehicle-pioneer-global-ambition)
- [Sequoia: Alex Kendall Podcast](https://sequoiacap.com/podcast/how-end-to-end-learning-created-autonomous-driving-2-0-wayve-ceo-alex-kendall/)
- [NVIDIA Blog: Riding the Wayve](https://blogs.nvidia.com/blog/wayve-generative-ai/)
- [Wayve: WayveScenes101](https://wayve.ai/science/wayvescenes101/)
- [GitHub: WayveScenes101](https://github.com/wayveai/wayve_scenes)
- [Tech.eu: Wayve Headcount 650](https://tech.eu/2025/07/28/wayve-sees-leap-in-headcount-to-650-amid-expansion-into-new-markets/)
- [CNBC: Wayve $8.6B Valuation](https://www.cnbc.com/2026/02/24/wayve-fundraise-nvidia-microsoft.html)
- [Road to Autonomy: Wayve US Expansion](https://www.roadtoautonomy.com/wayve-expands-us/)
- [EU-Startups: Wayve Series D](https://www.eu-startups.com/2026/02/wayve-rockets-to-e7-2-billion-valuation-with-e1-billion-series-d-bet-on-ai-driven-autonomy-backing-from-uber-and-microsoft/)
- [Nissan: Next-gen ProPILOT](https://global.nissannews.com/en/releases/next-gen-propilot-technology)
- [Radiance Fields: PRISM-1 Analysis](https://radiancefields.com/wayve-announces-prism-1)
- [arXiv: Bayesian SegNet](https://arxiv.org/abs/1511.02680)
- [arXiv: Multi-Task Uncertainty](https://arxiv.org/abs/1705.07115)
- [arXiv: What Uncertainties Do We Need](https://arxiv.org/abs/1703.04977)
