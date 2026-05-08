# World Models for Autonomous Vehicles: A Comprehensive Technical Report

**Date:** March 2025

---

## Table of Contents

1. [What Are World Models in the AV Context?](#1-what-are-world-models-in-the-av-context)
2. [Key Architectures and Papers (2023--2025)](#2-key-architectures-and-papers-20232025)
3. [How World Models Improve AV Stacks](#3-how-world-models-improve-av-stacks)
4. [Airside (Airport Tarmac) Operations](#4-specific-considerations-for-airside-airport-tarmac-operations)
5. [State of the Art: Deployable vs. Research-Only](#5-state-of-the-art-as-of-early-2025)

---

## 1. What Are World Models in the AV Context?

### 1.1 Core Concept

A **world model** is a learned internal representation of the environment that enables an autonomous system to predict how the world will evolve over time in response to actions. Rather than merely perceiving the current state and mapping it to control outputs, a world model allows the system to *imagine* future states -- simulating what will happen before committing to a plan.

The concept originates from Ha and Schmidhuber's 2018 "World Models" paper and LeCun's articulation of the Joint Embedding Predictive Architecture (JEPA), but it has been dramatically accelerated in the AV domain by the convergence of large-scale generative models (diffusion models, autoregressive transformers, and video foundation models) with driving-specific datasets.

In the autonomous driving context, a world model is formally a function:

```
s_{t+1} = f(s_t, a_t, c_t)
```

where `s_t` is the current world state (which may be represented as video frames, point clouds, occupancy grids, or learned latent vectors), `a_t` is the ego-vehicle action, and `c_t` is contextual conditioning (e.g., map data, text prompts, weather, other agents' behaviors).

### 1.2 How They Differ from Traditional Perception-Planning Pipelines

Traditional AV stacks follow a **modular pipeline**:

```
Sensors --> Perception --> Prediction --> Planning --> Control
```

Each module is designed, trained, and evaluated independently. Perception detects objects and lane markings; prediction forecasts their trajectories; planning generates a safe ego-trajectory; control executes it. This design is interpretable and allows component-level testing, but it suffers from several fundamental limitations:

| Limitation | Traditional Pipeline | World Model Approach |
|---|---|---|
| **Error propagation** | Errors cascade through modules (missed detection kills planning) | End-to-end learning can absorb imperfections |
| **Information bottleneck** | Intermediate representations discard information (e.g., bounding boxes lose shape/texture) | Richer latent states preserve more scene context |
| **Closed-world assumption** | Relies on pre-defined object taxonomies | Learns general scene dynamics, can handle novel objects |
| **Planning horizon** | Typically short-horizon reactive planning | Can "imagine" long-horizon futures (seconds to minutes) |
| **Data efficiency** | Requires massive labeled datasets per module | Self-supervised pre-training from raw video |
| **Rare event handling** | Limited to observed training data | Can generate and train on counterfactual scenarios |

### 1.3 The "Imagination" Paradigm

The key conceptual shift is from **reactive** to **imaginative** autonomy. A world model enables:

1. **Mental simulation**: Before executing an action, the system rolls out multiple candidate futures in its learned latent space, evaluating which action sequence leads to the best outcome. This is analogous to model-based reinforcement learning (MBRL) and model predictive control (MPC) but in a learned representation rather than a hand-crafted physics simulator.

2. **Counterfactual reasoning**: "What would happen if I accelerated here?" or "What if that pedestrian steps off the curb?" These questions can be answered by conditioning the world model on hypothetical actions and observing the predicted outcomes.

3. **Self-supervised learning at scale**: Because predicting the future is an inherently self-supervised task (the ground truth is simply what happens next), world models can be trained on vast quantities of unlabeled driving data, following the same scaling paradigm that powered large language models.

---

## 2. Key Architectures and Papers (2023--2025)

### 2.1 GAIA-1 and GAIA-2 (Wayve, 2023--2025)

#### GAIA-1 (arXiv:2309.17080)

**Architecture:** GAIA-1 is a 9.1-billion-parameter generative world model composed of three components:
- **Multimodal encoders** for video, text, and action inputs, projecting them into a shared representation space with temporal alignment
- **Autoregressive transformer** (6.5B parameters) that predicts the next set of image tokens in a sequence, using vector-quantized (VQ) representations to cast future prediction as next-token prediction
- **Video diffusion decoder** (2.6B parameters) that converts predicted tokens back to pixel space

**Training:** 15 days on 64 NVIDIA A100 GPUs for the world model, 15 days on 32 A100s for the video decoder. Trained on 4,700 hours of proprietary urban driving data collected in London (2019--2023).

**Key innovations:**
- Frames world modeling as unsupervised sequence modeling analogous to LLM pre-training
- Demonstrates emergent understanding of driving concepts (road geometry, traffic rules, agent interactions) without explicit labels
- Supports multimodal conditioning: text prompts (e.g., "Going around a stopped bus"), action sequences (steering, speed), and video context
- Can generate diverse plausible futures from the same starting context
- Exhibits LLM-like scaling laws -- performance improves predictably with more data and compute

**Limitations:** Autoregressive frame-by-frame generation is computationally expensive; single-camera output only.

#### GAIA-2 (arXiv:2503.20523, March 2025)

**Architecture:** Fundamentally redesigned with two components:
- **Video tokenizer** that compresses raw pixel-space videos into a compact continuous latent space (not discrete tokens as in GAIA-1)
- **Latent diffusion world model** that operates on compressed representations to predict future states

**Key advances over GAIA-1:**
- **Latent diffusion replaces autoregressive generation**: Encodes entire sequences into continuous latent space, eliminating temporal discontinuities and improving motion smoothness
- **Native multi-camera generation**: Spatiotemporally consistent video across multiple viewpoints simultaneously
- **Geographic diversity**: Trained across UK, US, and Germany with region-specific adaptation
- **Rich structured conditioning**: Ego-vehicle dynamics (speed, steering curvature), 3D bounding boxes for dynamic agents, weather/time-of-day, road semantics (lanes, speed limits, crossings, intersections), and external embeddings (CLIP + proprietary driving model embeddings)
- **Multiple generation modes**: Forecast future from existing video, create entirely new scenes, modify existing sequences, generate action-conditioned scenarios

### 2.2 UniSim (Google DeepMind / Waabi, CVPR 2023 Highlight)

**Paper:** arXiv:2308.01898

**Architecture:** Neural rendering-based closed-loop sensor simulator that separates scene reconstruction into:
- **Static background** reconstruction using neural feature grids
- **Dynamic actor** reconstruction with learnable priors for dynamic objects
- **Compositing network** that merges static and dynamic elements
- **Convolutional completion network** for inpainting regions not visible in original recordings

**Approach:** Converts a single recorded sensor log into a fully interactive, closed-loop multi-sensor simulation. Given a real-world driving log, UniSim can:
- Re-render the scene from novel viewpoints
- Add, remove, or reposition actors
- Modify ego and actor trajectories arbitrarily
- Simulate both LiDAR and camera data simultaneously

**Key contribution:** Demonstrates that the sim-to-real gap can be small enough for meaningful closed-loop safety evaluation -- testing AV stacks on safety-critical scenarios "as if in the real world" without ever leaving simulation. This is particularly important for scenarios too dangerous to test on public roads.

### 2.3 MILE -- Model-Based Imitation Learning (arXiv:2210.07729)

**Architecture:** Learns a compact latent world model jointly with a driving policy from expert demonstrations, without any online environment interaction.

**Key innovations:**
- Uses **3D geometry as an inductive bias** to ground latent representations
- First camera-only method to simultaneously represent static scene, dynamic scene, and ego-behavior in a unified world model
- Learned representations are **interpretably decodable** to bird's-eye-view (BEV) semantic segmentation
- Plans entirely "in imagination" -- executes complex driving maneuvers from trajectories predicted within the world model's latent space

**Results:** 31% improvement in driving score on CARLA over prior state-of-the-art when deployed in previously unseen towns and weather conditions. Open-source code and weights available.

**Significance:** MILE demonstrated that offline learning from demonstrations, combined with a world model for imaginative planning, could match or exceed methods requiring expensive online interaction.

### 2.4 DriveDreamer and DriveDreamer-2

#### DriveDreamer (arXiv:2309.09777)

**Approach:** The first world model built entirely from real-world driving data (prior work primarily used gaming/simulated environments). Uses diffusion models to represent complex driving environments.

**Two-stage training:**
1. Learns structured traffic constraints from real-world scenarios
2. Develops predictive capabilities for future state anticipation

**Capabilities:** Generates controllable driving videos that faithfully capture traffic scenario constraints. Evaluated on the nuScenes benchmark.

#### DriveDreamer-2 (arXiv:2403.06845)

**Key advance:** Integrates Large Language Models (LLMs) into the world model pipeline, becoming the first world model to generate customized driving videos from natural language descriptions.

**Pipeline:**
1. LLM converts user text queries into agent trajectories
2. HDMap generation module ensures trajectories adhere to traffic rules
3. Unified multi-view video synthesis model generates spatiotemporally coherent multi-camera driving videos

**Results:** FID score of 11.2 (30% improvement), FVD score of 55.7 (50% improvement) over prior SOTA. Generated data demonstrably improves downstream 3D object detection and tracking.

### 2.5 ADriver-I (arXiv:2311.13549)

**Architecture:** Combines multimodal large language models (MLLMs) with diffusion models in a unified autonomous driving framework.

**Key innovation -- Interleaved vision-action pairs:** Unifies visual features and control signals into a single data format, enabling a single model to handle perception, prediction, and control.

**Operational loop (autoregressive):**
1. Accept current vision-action pair
2. Predict control signals for current frame
3. Use generated control signals + history to predict future frames
4. Repeat indefinitely

**Significance:** Demonstrates that the modular perception-prediction-planning pipeline can be collapsed into a single autoregressive loop, reducing redundancy inherent in traditional modular designs.

### 2.6 GenAD -- Generative End-to-End Autonomous Driving (CVPR 2024 Highlight)

**Paper:** arXiv:2403.09630

**Architecture:** The first large-scale video prediction model specifically for autonomous driving, using latent diffusion models with novel temporal reasoning blocks.

**Training data:** Over 2,000 hours of web-sourced driving videos with diverse geographic coverage, weather, and traffic conditions paired with text descriptions.

**Key capabilities:**
- Zero-shot generalization to unseen driving datasets, surpassing both general and driving-specific video prediction models
- Adaptable as either an action-conditioned prediction model or a motion planner
- Associated dataset available through OpenDriveLab/DriveAGI on GitHub

### 2.7 Copilot4D (arXiv:2311.01017)

**Architecture:** Two-stage pipeline for 4D (3D spatial + temporal) point cloud forecasting:
1. **VQVAE tokenizer** converts raw LiDAR observations into discrete tokens
2. **Discrete diffusion model** (adapted from Masked Generative Image Transformer) predicts future tokens with parallel decoding

**Results:**
- 65% reduction in Chamfer distance over prior SOTA at 1-second prediction
- 50% reduction at 3-second prediction
- Evaluated on NuScenes, KITTI Odometry, and Argoverse2

**Significance:** Demonstrates that "discrete diffusion on tokenized agent experience can unlock the power of GPT-like unsupervised learning for robotics" -- establishing point cloud world modeling as a viable paradigm parallel to video-based approaches.

### 2.8 OccWorld (arXiv:2311.16038)

**Architecture:** A world model operating in **3D occupancy space** rather than image or point cloud space.
- **Scene tokenizer** based on reconstruction: converts 3D occupancy grids into discrete scene tokens
- **GPT-like spatial-temporal generative transformer** predicts future scene tokens and ego-motion tokens simultaneously

**Rationale for occupancy representation:**
1. More fine-grained 3D scene structure than bounding boxes
2. More economical to obtain (e.g., from sparse LiDAR)
3. Adapts to both vision-only and LiDAR setups

**Results:** Competitive planning results on nuScenes without requiring instance-level or map supervision. Code available on GitHub.

### 2.9 Vista (arXiv:2405.17398, OpenDriveLab)

**Architecture:** A generalizable driving world model addressing three limitations of prior work: poor generalization, low fidelity, and limited controllability.

**Key innovations:**
- Novel loss functions targeting moving instances and structural information for high-resolution real-world dynamics
- **Latent replacement approach** for injecting historical frames as priors, enabling temporally consistent long-horizon predictions
- **Multi-level controllability**: high-level (commands, goal points) and low-level (trajectories, angles, speeds) conditioning through a unified efficient learning strategy

**Results:**
- Outperforms general video generators in >70% of comparisons
- 55% improvement in FID and 27% in FVD over best prior driving world model
- First model to generate generalizable reward signals for action evaluation without ground-truth references

### 2.10 MUVO -- Multimodal World Model with Geometric Voxel Representations

**Paper:** arXiv:2311.11762 (accepted IV 2025)

**Innovation:** Addresses the gap where most driving world models use camera-only input by exploring different sensor fusion strategies combining camera and LiDAR.

**Approach:** Instead of predicting raw sensor data, outputs **3D occupancy predictions** -- argued to be more actionable for downstream driving tasks. Analyzes weaknesses of current sensor fusion approaches.

### 2.11 Think2Drive (arXiv:2402.16720)

**Architecture:** First model-based reinforcement learning method for autonomous driving:
- **Latent world model** learns environment state transitions in low-dimensional latent space
- **RL-trained planner** uses the world model as a neural simulator

**Key results:**
- First reported 100% route completion rate in CARLA v2
- Handles 39 common driving events
- Achieves expert-level performance within 3 days on a single A6000 GPU
- Introduced CornerCase-Repository benchmark for scenario-based evaluation

**Significance:** Demonstrates that model-based RL with a learned world model can handle corner cases far more flexibly than rule-based planners.

### 2.12 WorldDreamer (arXiv:2401.09985)

**Approach:** Frames world modeling as unsupervised visual sequence modeling via masked token prediction (inspired by BERT/MAE rather than GPT-style autoregression).

**Capabilities:** Captures dynamic elements across diverse environments including natural scenes and driving contexts. Supports text-to-video, image-to-video, and video editing tasks.

**Innovation:** Moves beyond domain-specific driving models to develop general world physics understanding applicable across varied environments.

### 2.13 DriveWorld (CVPR 2024, arXiv:2405.04390)

**Architecture:** 4D pre-training framework using a Memory State-Space Model with two components:
- **Dynamic Memory Bank**: Learns temporal-aware latent dynamics for predicting future changes
- **Static Scene Propagation**: Learns spatial-aware latent statics for comprehensive scene context
- **Task Prompt mechanism**: Decouples task-specific features for flexible downstream adaptation

**Results (pre-trained on OpenScene, evaluated on nuScenes):**
- 3D Object Detection: +7.5% mAP
- Online Mapping: +3.0% IoU
- Multi-Object Tracking: +5.0% AMOTA
- Motion Forecasting: -0.1m minADE
- Occupancy Prediction: +3.0% IoU
- Planning: -0.34m average L2 error

### 2.14 NVIDIA Cosmos World Foundation Models (arXiv:2501.03575)

**Overview:** An open-weight platform for physical AI development, positioning world foundation models as the counterpart to language foundation models but for the physical world.

**Architecture:** Includes both diffusion and autoregressive transformer models trained on 9,000 trillion tokens from 20 million hours of real-world data spanning human interactions, industrial, robotics, and driving scenarios. Model sizes range from 4B to 14B parameters.

**Three tiers:**
- **Nano**: Optimized for real-time, low-latency edge deployment
- **Super**: High-performance baseline models
- **Ultra**: Maximum quality for distilling custom models

**AV-specific extensions:**
- **Cosmos-Drive-Dreams** (arXiv:2506.09042): Specialized adaptation for generating controllable, high-fidelity, multi-view, spatiotemporally consistent driving videos. Demonstrated utility for 3D lane detection, 3D object detection, and driving policy learning. Addresses long-tail distribution problems.
- **Cosmos-Predict2.5 / Transfer2.5** (arXiv:2511.00062): Next generation with improved video quality and instruction alignment.

**Availability:** Open-weight with permissive licenses via GitHub and Hugging Face; fine-tunable via NVIDIA NeMo.

### 2.15 Waymo -- SceneDiffuser Family (2024--2025)

**SceneDiffuser (NeurIPS 2024):** Efficient and controllable driving simulation initialization and rollout using diffusion models.

**SceneDiffuser++ (CVPR 2025):** City-scale traffic simulation via a generative world model. Enables large-scale scene generation for comprehensive testing.

### 2.16 Doe-1 (arXiv:2412.09627, December 2024)

**Architecture:** Closed-loop autonomous driving as next-token generation with multi-modal tokens:
- **Perception tokens**: Free-form text for scene descriptions
- **Prediction tokens**: Image tokens for future state generation in RGB space
- **Planning tokens**: Position-aware tokenized actions

Autoregressively generates perception, prediction, and planning in a unified transformer. Evaluated on nuScenes for VQA, action-conditioned video generation, and motion planning.

### 2.17 Other Notable Models (2024--2025)

| Model | Key Innovation |
|---|---|
| **DrivingWorld** (arXiv:2412.19505) | Video GPT generating >40-second driving clips with spatial-temporal fusion |
| **DFIT-OccWorld** (arXiv:2412.13772) | Efficient 3D occupancy world model with decoupled dynamic flow |
| **DrivePhysica** (arXiv:2412.08410) | Physics-informed world model with coordinate alignment and flow guidance |
| **InfinityDrive** (arXiv:2412.01522) | Minute-scale video generation (1500+ frames) with memory injection |
| **HoloDrive** (arXiv:2412.01407) | First joint 2D-3D generation (camera + LiDAR) via BEV transforms |
| **DrivingDiffusion** (arXiv:2310.07771) | Multi-view driving video generation controlled by 3D layout |
| **GEM** (arXiv:2412.11198) | Generalizable ego-vision multimodal model, 4000+ hours multimodal data |
| **UniDWM** (arXiv:2602.01536) | Unified driving world model with structure-aware latent representation |
| **World4Drive** (arXiv:2507.00603) | Intention-aware physical latent world model for end-to-end driving |

---

## 3. How World Models Improve AV Stacks

### 3.1 Data Augmentation and Synthetic Data Generation

World models address the fundamental data bottleneck in AV development: rare but safety-critical scenarios are by definition underrepresented in real-world driving logs, yet these are precisely the scenarios that matter most.

**Mechanisms:**

- **Controllable scenario generation**: Models like GAIA-2 and DriveDreamer-2 accept structured conditioning inputs (ego-actions, agent placements, weather, road configurations) to generate targeted scenarios. DriveDreamer-2 further allows natural language specification of scenarios (e.g., "a vehicle suddenly cuts in from the left lane").

- **Long-tail augmentation**: Cosmos-Drive-Dreams specifically targets the long-tail distribution problem, generating rare edge cases (near-collisions, unusual road geometries, adverse weather) to augment training data. This demonstrably improves downstream 3D detection and lane detection performance.

- **Multi-view consistency**: GAIA-2, DriveDreamer-2, and HoloDrive generate spatiotemporally consistent multi-camera outputs, critical for training surround-view perception systems.

- **Multi-modal synthesis**: HoloDrive and MUVO generate aligned camera + LiDAR data, enabling joint sensor training without additional real-world collection.

**Quantitative impact:** DriveDreamer-2 achieves FID=11.2 and FVD=55.7 (30--50% improvements), and generated data demonstrably improves 3D detection and tracking performance.

### 3.2 Sim-to-Real Transfer

The persistent challenge in simulation-based AV development is the **sim-to-real gap**: models trained in simulation often fail when deployed on real sensor data due to differences in visual fidelity, sensor noise, physics, and scenario diversity.

World models attack this gap from multiple angles:

- **Learned neural rendering** (UniSim): By reconstructing scenes from real sensor data rather than from artist-authored 3D assets, UniSim achieves sensor simulation with a "small domain gap on downstream tasks." This enables testing AV systems on modified real-world scenarios without the traditional simulation fidelity penalty.

- **Real-data-grounded generation**: Unlike traditional simulators (CARLA, SUMO) that synthesize from scratch, models like DriveDreamer are trained on real-world data (nuScenes, proprietary fleets), inheriting realistic visual statistics, sensor noise patterns, and behavioral distributions.

- **Foundation model transfer**: NVIDIA Cosmos provides a general-purpose pre-trained world model that can be fine-tuned for specific domains, leveraging 20 million hours of diverse real-world video to bootstrap sim-to-real transfer for specialized applications.

### 3.3 Planning via Imagination (Model Predictive Control in Latent Space)

This is arguably the most transformative application of world models. Rather than planning in hand-crafted state spaces, the AV can plan in a learned latent space:

**MILE's approach:**
1. Encode current observation into latent state
2. Propose candidate action sequences
3. Roll out each sequence through the world model in latent space
4. Decode predicted latent states to evaluate outcomes (e.g., BEV segmentation for collision checking)
5. Select the action sequence with the best predicted outcome

**Think2Drive's approach (MBRL):**
1. Learn a latent world model of environment transitions
2. Use the world model as a "neural simulator" for RL policy training
3. Train the planner entirely within the world model, avoiding expensive real-world or high-fidelity simulator interaction
4. Achieve 100% route completion in CARLA v2 in 3 days on a single GPU

**Key advantages of latent-space planning:**
- **Speed**: Latent rollouts are orders of magnitude faster than physics simulation
- **Parallelism**: Tensor-based computation enables massive parallel rollout of candidate plans
- **Gradient-based optimization**: Differentiable world models allow direct gradient computation through the planning horizon
- **Implicit constraint handling**: The world model naturally captures physical constraints (road geometry, vehicle dynamics) without explicit modeling

**UniDWM and World4Drive** (2025) further develop this paradigm by constructing structure- and dynamic-aware latent representations that unify perception, prediction, and planning in a single learned space, enabling intention-driven future state prediction.

### 3.4 Safety Validation and Scenario Generation

Safety validation is the most commercially pressing application. Proving AV safety requires testing against an astronomical number of scenarios, many of which are too dangerous or too rare to encounter naturally.

**World model contributions:**

- **Targeted corner case generation**: GAIA-2 can synthesize near-collisions, emergency maneuvers, and out-of-distribution conditions by manipulating its structured conditioning inputs. Think2Drive introduced a CornerCase-Repository specifically for evaluating AV responses to challenging situations.

- **Closed-loop evaluation**: UniSim enables testing the complete AV stack (perception through control) in a neural simulation loop, where the AV's actions affect the simulated environment, which in turn affects subsequent observations. This is fundamentally different from open-loop replay testing.

- **Counterfactual analysis**: Given a real-world driving log, world models can answer "what if" questions -- what would have happened if the ego vehicle had braked later, or if an oncoming vehicle had not yielded?

- **Waymo's SceneDiffuser++**: Enables city-scale traffic simulation, allowing systematic coverage of rare multi-agent interaction patterns across entire urban networks.

### 3.5 Reducing Reliance on HD Maps

HD maps are expensive to create and maintain, representing a major scalability bottleneck for AV deployment. World models contribute to map-free driving in several ways:

- **OccWorld** produces competitive planning results without instance-level or map supervision, suggesting that world models can internalize road structure from raw sensor data.

- **GAIA-2** conditions on road semantics (lanes, speed limits, intersections) but these can be predicted by the model rather than supplied from pre-built maps.

- **Vista** generates generalizable reward signals for action evaluation without ground-truth reference data, enabling planning that does not depend on pre-mapped environments.

- **DriveWorld's** pre-training on multi-camera video learns implicit map representations (+3.0% IoU on online mapping), suggesting world models can replace offline HD maps with learned online map prediction.

---

## 4. Specific Considerations for Airside (Airport Tarmac) Operations

### 4.1 Environment Characteristics

Airport airside (tarmac/apron) environments differ fundamentally from public roads:

| Factor | Public Roads | Airport Airside |
|---|---|---|
| **Speed** | 0--130 km/h | Typically 5--25 km/h (strict limits) |
| **Traffic mix** | Homogeneous (cars, trucks, bikes) | Highly heterogeneous: aircraft, baggage tugs, belt loaders, catering trucks, fuel tankers, pushback tugs, passenger stairs, de-icing vehicles, follow-me cars, personnel on foot |
| **Layout** | Standardized lanes, intersections | Taxiways, apron stands, service roads; layout changes with gate assignments |
| **Marking system** | Standard road markings and signs | Aerodrome markings (taxiway centerlines, stand guidance, FOD zones) per ICAO Annex 14 |
| **Right-of-way** | Traffic laws | Aircraft always have priority; complex hierarchy among ground vehicles |
| **Weather impact** | Reduced visibility/traction | Same, plus jet blast, de-icing chemicals, and FOD (foreign object debris) |
| **Communication** | None (except V2X research) | Mandatory radio communication with ATC ground control |

### 4.2 Unique Challenges for World Models

#### 4.2.1 Domain-Specific Object Recognition

Standard driving world models are trained on datasets (nuScenes, Waymo Open Dataset, Argoverse) containing cars, pedestrians, cyclists, and standard road infrastructure. Airport airside environments introduce object categories that are entirely absent from these datasets:

- **Aircraft** of varying sizes (A380 vs. regional jets) with complex geometries
- **Ground Support Equipment (GSE)**: Pushback tugs, belt loaders, container loaders, catering high-lifts, fuel bowsers, lavatory service vehicles, ground power units
- **Personnel** in high-visibility vests, often in close proximity to operating equipment
- **Jet bridges** and their articulation states
- **Towbars** and tow connections between aircraft and tugs

**Implication for world models:** A world model for airside operations would need to be trained on airside-specific data. Given the limited availability of such data (no public large-scale airport driving datasets exist comparable to nuScenes), **foundation model fine-tuning** becomes the most viable path. NVIDIA Cosmos or similar pre-trained models could be fine-tuned on airport-specific video collected from instrumented ground vehicles.

#### 4.2.2 Behavioral Dynamics

Airside vehicle behavior follows different rules than road traffic:

- **No traffic lights or stop signs**: Priority is managed by marshalling, follow-me vehicles, and ATC ground control
- **Stand-entry procedures**: Vehicles must follow precise docking procedures around parked aircraft
- **Convoy behavior**: Baggage trains and service vehicle convoys operate differently from road platoons
- **Pedestrian behavior**: Ground crew may walk unpredictably around aircraft, often in blind spots
- **Aircraft push-back**: Large, slow-moving aircraft pushed by tugs create unique occlusion and clearance situations

A world model for this domain must learn these specific interaction patterns, which differ qualitatively from road traffic.

#### 4.2.3 Structured but Dynamic Environment

While airport layouts are structured (taxiway designations, painted stand markings), the operational configuration changes dynamically:

- Gate assignments change per flight schedule
- Temporary closures for maintenance
- Seasonal variations (de-icing areas active only in winter)
- Construction zones

This combination of structure and dynamic change is well-suited to world models that can adapt online, but it also means that world model conditioning on map data must accommodate temporal variability.

### 4.3 Regulatory Framework

#### ICAO (International Civil Aviation Organization)

- **Annex 14 (Aerodromes)**: Defines aerodrome design, markings, and lighting standards. Any autonomous vehicle operating airside must comply with surface movement guidance and marking systems defined here.
- **Doc 9137 (Airport Services Manual)**: Covers ground vehicle operations, including vehicle/pedestrian control, right-of-way rules, and safety requirements.
- **SMS (Safety Management System)**: ICAO requires SMS implementation for aerodrome operators. Autonomous vehicles would need to be integrated into the aerodrome's SMS, with hazard identification and risk mitigation processes.

#### FAA (United States)

- **Advisory Circular 150/5210-20**: Guidelines for driver training and vehicle operations on airports. Currently written for human drivers but establishes the safety framework any autonomous system must meet.
- **14 CFR Part 139**: Certification of airports. Autonomous vehicles would need to demonstrate compliance with airfield safety standards.
- **No specific autonomous vehicle regulations for airside**: As of early 2025, neither ICAO nor the FAA has published standards specifically governing autonomous ground vehicles on airport surfaces. This regulatory gap means that any deployment would likely require special approvals and extensive safety cases on a per-airport basis.

#### IATA

- **ISAGO (IATA Safety Audit for Ground Operations)**: Industry standard for ground handling safety. Autonomous vehicles in ground handling roles would need to meet ISAGO audit criteria.
- **IATA Ground Operations Manual (IGOM)**: Defines standard procedures for ground handling. Autonomous system behavior would need to conform to IGOM procedures.

### 4.4 Opportunities for World Models in Airside Operations

Despite the challenges, airside environments have properties that make them **particularly well-suited** for world model-based autonomy:

1. **Low speed**: Operating at 5--25 km/h provides longer reaction times and reduces the consequence of prediction errors, making latent-space planning more tractable.

2. **Structured environment**: Despite dynamic elements, the overall environment is more structured and controlled than public roads, with fewer unpredictable external factors.

3. **Controlled access**: All vehicles and personnel on the apron are authorized, trained, and (in theory) following known procedures. This reduces the behavioral diversity the world model must capture.

4. **High economic value**: Ground handling delays are extremely costly to airlines (estimated $100+ per minute for aircraft on-ground delays). Efficiency improvements from autonomous GSE operations have clear ROI.

5. **Safety-critical but lower liability complexity**: Operations are on private property under airport operator control, potentially simplifying the liability framework compared to public roads.

**Recommended approach for deploying world models in airside operations:**
- Use a pre-trained foundation model (e.g., NVIDIA Cosmos) fine-tuned on airport-specific data
- Leverage the world model primarily for **scenario generation and safety validation** (generating rare airside incidents for testing)
- Use occupancy-based world models (OccWorld-style) for planning, as 3D occupancy naturally represents the diverse object geometries found on the apron
- Implement closed-loop testing (UniSim-style) with real airside sensor logs to validate perception and planning before physical deployment

---

## 5. State of the Art as of Early 2025

### 5.1 What Is Actually Deployable

| Readiness Level | Technology | Status |
|---|---|---|
| **Production-deployed** | Traditional modular pipelines (Waymo, Cruise, Zoox) | Operational in geo-fenced areas; world models not yet core to production stacks |
| **Fleet-tested** | Wayve's LINGO-2 (vision-language-action model) | First closed-loop VLAM tested on public roads in London |
| **Pilot/integration phase** | NVIDIA Cosmos for synthetic data augmentation | Used by Waabi and others for training data generation; not yet in vehicle real-time inference |
| **Advanced research** | GAIA-2, GenAD, Vista, DriveDreamer-2 | Generating high-quality synthetic training data; not running in-vehicle |
| **Research prototype** | MILE, Think2Drive, OccWorld (latent-space planning) | Demonstrated in simulation (CARLA, nuScenes); not tested on physical vehicles |
| **Foundational research** | Doe-1, WorldDreamer, DrivePhysica | Architectural innovations; early-stage evaluation |

### 5.2 Key Gaps Between Research and Deployment

1. **Real-time inference**: Most world models require seconds to generate a single future prediction. Real-time planning demands predictions within 50--100ms. Only the smallest models (NVIDIA Cosmos Nano tier) are designed for edge deployment, and even these are not yet validated for real-time driving.

2. **Closed-loop validation at scale**: While UniSim and SceneDiffuser++ enable closed-loop testing, the industry lacks standardized benchmarks for evaluating world model fidelity in closed-loop settings. Most published results use open-loop metrics (FID, FVD, Chamfer distance) that do not directly predict driving performance.

3. **Safety guarantees**: World models are fundamentally probabilistic and can hallucinate plausible but physically impossible futures. No current framework provides formal safety guarantees from world model predictions, which is a prerequisite for safety-critical deployment.

4. **Sensor fidelity**: Video-based world models generate visually convincing outputs but may not accurately represent the precise geometric and radiometric properties that perception systems depend on. LiDAR world models (Copilot4D) are more geometrically faithful but less mature.

5. **Multi-agent interaction fidelity**: While GAIA-2 conditions on agent bounding boxes, the reactive behavior of other agents in response to ego actions remains a significant modeling challenge. Oversimplified agent behavior in the world model can lead to overconfident planning.

6. **Domain adaptation**: All current world models are trained on road driving data. Adapting to non-road domains (airports, mines, construction sites, warehouses) requires new data collection and fine-tuning, with limited guidance on how much data is sufficient.

### 5.3 Trajectory of the Field

The field is converging on a consensus architecture:

```
Video/Sensor Tokenizer --> Latent Diffusion/Transformer World Model --> Task-Specific Heads
                                       ^
                                       |
                          Structured Conditioning Inputs
                    (actions, maps, weather, agents, text)
```

Key trends:

- **Diffusion over autoregression**: GAIA-2's shift from autoregressive tokens (GAIA-1) to latent diffusion reflects the field's direction. Diffusion models produce higher-fidelity outputs with better temporal consistency.

- **Occupancy as the representation layer**: OccWorld, DFIT-OccWorld, MUVO, and Delta-Triplane Transformers all converge on 3D occupancy as a representation that balances expressiveness, computational cost, and task utility.

- **Foundation model + fine-tuning**: NVIDIA Cosmos establishes the template -- large-scale pre-training on diverse video, then domain-specific fine-tuning. This will likely reduce the barrier to deploying world models in specialized domains like airport operations.

- **Unification of generation and planning**: Doe-1 and UniDWM represent the frontier where the world model is not just a data generator but the core decision-making module, collapsing the traditional pipeline into a single learned system.

- **Scaling laws hold**: GAIA-1 demonstrated LLM-like scaling behavior, with Wayve noting "significant room for improvement" through additional data and compute. Cosmos trained on 9,000 trillion tokens. The field expects continued performance gains from scale.

### 5.4 Industry Assessment

**Near-term (2025--2026):** World models will be deployed primarily as **offline tools** for:
- Training data augmentation (synthetic rare scenarios)
- Simulation-based testing and validation
- Pre-training representations for downstream perception/prediction tasks

**Medium-term (2026--2028):** World models will begin to appear as **online planning components** in:
- Geo-fenced, low-speed applications (airport GSE, warehouse robots, mining vehicles)
- L4 autonomous vehicles as a planning module complementing traditional planners
- Continuous learning systems that update their world model from fleet data

**Long-term (2028+):** World models may become the **core architecture** for autonomous systems, replacing modular pipelines entirely with unified learned models that perceive, predict, plan, and act within a single latent space.

---

## References

### Core World Model Papers
- GAIA-1: Hu et al., "GAIA-1: A Generative World Model for Autonomous Driving," arXiv:2309.17080, 2023
- GAIA-2: Wayve, "GAIA-2: A Latent Diffusion World Model for Autonomous Driving," arXiv:2503.20523, 2025
- UniSim: Yang et al., "UniSim: A Neural Closed-Loop Sensor Simulator," CVPR 2023 Highlight, arXiv:2308.01898
- MILE: Hu et al., "Model-Based Imitation Learning for Urban Driving," NeurIPS 2022, arXiv:2210.07729
- DriveDreamer: Wang et al., "DriveDreamer: Towards Real-world-driven World Models for Autonomous Driving," arXiv:2309.09777, 2023
- DriveDreamer-2: Zhao et al., "DriveDreamer-2: LLM-Enhanced World Models for Diverse Driving Video Generation," arXiv:2403.06845, 2024
- ADriver-I: Li et al., "ADriver-I: A General World Model for Autonomous Driving," arXiv:2311.13549, 2023
- GenAD: Yang et al., "Generative End-to-End Autonomous Driving," CVPR 2024 Highlight, arXiv:2403.09630
- Copilot4D: Zhang et al., "Copilot4D: Learning Unsupervised World Models for Autonomous Driving via Discrete Diffusion," arXiv:2311.01017, 2023
- OccWorld: Zheng et al., "OccWorld: Learning a 3D Occupancy World Model for Autonomous Driving," arXiv:2311.16038, 2023
- Vista: Gao et al., "Vista: A Generalizable Driving World Model with High Fidelity and Versatile Controllability," arXiv:2405.17398, 2024
- MUVO: "Multimodal World Model with Geometric Voxel Representations," IV 2025, arXiv:2311.11762
- Think2Drive: Li et al., "Think2Drive: Efficient Reinforcement Learning by Thinking in Latent World Model for Autonomous Driving," arXiv:2402.16720, 2024
- WorldDreamer: Wang et al., "WorldDreamer: Towards General World Models for Video Generation via Predicting Masked Tokens," arXiv:2401.09985, 2024
- DriveWorld: Chen et al., "DriveWorld: 4D Pre-trained Scene Understanding via World Models for Autonomous Driving," CVPR 2024, arXiv:2405.04390

### Foundation Models and Platforms
- NVIDIA Cosmos: "Cosmos World Foundation Model Platform for Physical AI," arXiv:2501.03575, 2025
- Cosmos-Drive-Dreams: arXiv:2506.09042, 2025
- Cosmos-Predict2.5: arXiv:2511.00062, 2025

### Industry Systems
- Waymo SceneDiffuser: NeurIPS 2024
- Waymo SceneDiffuser++: CVPR 2025
- Wayve LINGO-2: Vision-Language-Action Model, 2024

### Surveys
- "A Survey of World Models for Autonomous Driving," Feng et al., arXiv:2501.11260, 2025
- "The Role of World Models in Shaping Autonomous Driving," Tu et al., arXiv:2502.10498, 2025
- "Exploring the Interplay Between Video Generation and World Models in Autonomous Driving," Fu et al., arXiv:2411.02914, 2024
- "World Models for Autonomous Driving: An Initial Survey," Guan et al., arXiv:2403.02622, 2024
- "Understanding World or Predicting Future? A Comprehensive Survey of World Models," Ding et al., arXiv:2411.14499, 2024

### Recent Additions (Late 2024--2025)
- Doe-1: arXiv:2412.09627
- DrivingWorld: arXiv:2412.19505
- DFIT-OccWorld: arXiv:2412.13772
- DrivePhysica: arXiv:2412.08410
- InfinityDrive: arXiv:2412.01522
- HoloDrive: arXiv:2412.01407
- GEM: arXiv:2412.11198
- UniDWM: arXiv:2602.01536
- World4Drive: arXiv:2507.00603
