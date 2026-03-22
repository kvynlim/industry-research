# World Models & End-to-End Approaches in Autonomous Driving
## Comprehensive Technical Report -- Leading AV Companies

**Date:** March 2026
**Scope:** Wayve, NVIDIA, Tesla, Waymo, Comma.ai, Waabi, Zoox, Aurora, Cruise, Hugging Face LeRobot, Applied Intuition

---

## Table of Contents

1. [Wayve](#1-wayve)
2. [NVIDIA](#2-nvidia)
3. [Tesla](#3-tesla)
4. [Waymo](#4-waymo)
5. [Comma.ai](#5-commaai)
6. [Waabi](#6-waabi)
7. [Zoox, Aurora, Cruise](#7-zoox-aurora-cruise)
8. [Hugging Face LeRobot & Open-Source Ecosystem](#8-hugging-face-lerobot--open-source-ecosystem)
9. [Applied Intuition & Ghost Autonomy](#9-applied-intuition--ghost-autonomy)
10. [Comparative Analysis & Lessons for Airside AV](#10-comparative-analysis--lessons-for-airside-av)

---

## 1. Wayve

### 1.1 Company Overview

Wayve is a London-based company pioneering an "AV2.0" approach to autonomous driving -- an AI-first, end-to-end paradigm that replaces traditional rule-based and HD-map-dependent stacks with foundation models trained on real-world driving data. Founded by Alex Kendall (Cambridge PhD), Wayve has raised approximately $2.3B total, including a $1.05B Series C (May 2024, led by SoftBank, with NVIDIA and Microsoft participating) and a $1.2B Series D (February 2026), bringing valuation to $8.6B.

### 1.2 GAIA World Model Family

Wayve's GAIA (Generative AI for Autonomy) is a lineage of generative world models that learn to predict and synthesize driving scenarios from data.

#### GAIA-1 (September 2023)

- **Architecture:** Three-component pipeline:
  1. **Modality-specific encoders** for video, text, and action inputs, projecting into a shared representation space
  2. **Autoregressive transformer** (the world model core) that performs next-token prediction in a unified sequence space
  3. **Video diffusion decoder** that translates predicted latent tokens back to pixel-space video
- **Video tokenizer:** Fully convolutional 2D U-Net encoder with discrete quantization via a learnable embedding table. Uses DINO-guided semantic compression rather than high-frequency detail preservation
- **Scale:** 9 billion parameters
- **Training data:** 4,700 hours of proprietary London driving data (2019--2023)
- **Emergent capabilities:** Learned high-level scene structure, contextual awareness, geometric understanding, and generalization to novel scenarios

#### GAIA-2 (March 2025)

- **Architectural shift:** Moved from GAIA-1's autoregressive frame-by-frame token generation to a **latent diffusion world model** operating in continuous latent space. This eliminates temporal discontinuities and enhances motion smoothness
- **Video tokenizer:** Compresses raw pixel-space video into compact, semantically meaningful latent representations
- **Conditioning parameters:** Extensive domain-specific controls including:
  - Ego-vehicle actions (speed, steering curvature)
  - Environmental factors (weather, time of day)
  - Road attributes (lane count, speed limits, intersections, traffic lights)
  - External embeddings (CLIP, proprietary driving-optimized models)
- **Multi-view generation:** Native multi-camera video generation with spatial and temporal coherence across viewpoints (a key gap from GAIA-1)
- **Training data:** Multi-country (UK, US, Germany), multi-vehicle-platform, multi-sensor-configuration
- **Operational modes:** Forecasting, full scene synthesis, and modification of existing sequences

#### GAIA-3 (December 2025)

- **Scale:** 15 billion parameters (double GAIA-2); video tokenizer also doubled in size
- **Training:** 5x compute and 10x data compared to GAIA-2, spanning 9 countries across 3 continents
- **Key innovations:**
  - **World-on-Rails:** Can alter ego trajectories while maintaining perfect consistency in all other scene elements
  - **Embodiment Transfer:** Re-renders scenes from new sensor configurations using small unpaired target samples -- enables evaluation across vehicle programs without paired captures
  - **Controlled Visual Diversity:** Varies lighting, textures, weather while preserving scene geometry and motion
- **Evaluation capabilities:** Safety-critical scenario generation, NCAP-style testing at scale, rare failure mode enrichment, LiDAR alignment validation
- **Key result:** Simulated testing closely mirrors real-world results; 5x reduction in synthetic-test rejection rates

### 1.3 LINGO Models (Language-Conditioned Driving)

#### LINGO-1 (September 2023)
- Open-loop driving commentator combining vision, language, and action
- Can comment on driving scenes and explain decision factors
- Enhances interpretability and training feedback

#### LINGO-2 (April 2024)
- **First closed-loop Vision-Language-Action Model (VLAM) tested on public roads**
- **Architecture:** Two modules:
  1. Wayve vision model (visual encoding)
  2. Auto-regressive language model that receives visual tokens plus conditioning variables (route, speed, speed limit) and predicts driving trajectory + commentary text
- **Capabilities:** Responds to constrained navigation commands ("pull over," "turn right") and adapts behavior in real-time
- Represents closed-loop human-vehicle interaction via natural language

### 1.4 AV2.0 End-to-End Approach

Wayve's AV2.0 philosophy replaces HD maps, hand-coded rules, and modular perception-prediction-planning pipelines with a single end-to-end deep learning architecture:

- **Foundation model backbone:** Trained on petabyte-scale real-world driving datasets; encodes transferable driving behaviors as a "universal backbone"
- **Generalization approach:**
  - Single global model navigated 500 cities across Europe, North America, and Asia with no fine-tuning
  - Adapted to US roads approaching UK performance with only 500 hours of incremental US data (8 weeks of collection)
  - Rapidly learned US-specific behaviors: right turns on red, freeway merging, unprotected left turns
  - Japan research hub opened April 2025 (SoftBank-backed) for local adaptation
- **Commercial deployment timeline:**
  - Uber partnership announced for L4 robotaxi trials in London (starting 2026)
  - Supervised autonomy software for consumer vehicles from 2027

### 1.5 Microsoft Azure Partnership

- Partnership since 2020; Wayve uses Azure Storage, Azure Databricks, Azure AI infrastructure with AKS to connect thousands of GPUs into a flexible supercomputer
- October 2025: Expanded commitment via new Azure services deal and Strategic Framework Agreement covering joint marketing, sales, and technology expansion to other OEMs
- Microsoft is also an investor (participated in Series C and D)

### 1.6 Key Takeaways

| Aspect | Detail |
|--------|--------|
| World model paradigm | Latent diffusion (GAIA-2/3) replacing autoregressive (GAIA-1) |
| Scale trajectory | 9B -> ~15B parameters; 4,700hrs -> 10x more data |
| Generalization | Foundation model approach; single model, 500 cities, no fine-tuning |
| Language integration | Closed-loop VLAM (LINGO-2) on public roads |
| Deployment | London robotaxi trials 2026 (with Uber) |
| Compute infrastructure | Microsoft Azure (thousands of GPUs) |

---

## 2. NVIDIA

### 2.1 Cosmos World Foundation Models

Announced at CES on January 6, 2025, Cosmos is NVIDIA's platform of generative world foundation models for physical AI.

#### Architecture

- **Cosmos Tokenizer:**
  - Lightweight, computationally efficient architecture with temporally causal mechanism (causal temporal convolution + causal temporal attention)
  - **Encoder:** Starts with 2-level Haar wavelet transform (4x spatial + 4x temporal downsampling); symmetrical encoder-decoder pair
  - **Two tokenizer types:**
    - **Continuous (C):** Vanilla autoencoder for latent diffusion models
    - **Discrete (D):** Finite-Scalar-Quantization (FSQ) for autoregressive transformers
  - **Image (I) and Video (V) variants** for each type
  - **Compression:** Up to 2048x total compression (8x/16x spatial, 4x/8x temporal); 8x more compression than SOTA while maintaining higher quality; runs up to 12x faster
  - 12 pre-trained tokenizer models on Hugging Face

- **Cosmos Predict:** Generates virtual world states from multimodal inputs (text, images, video)
  - Cosmos Predict-2 (March 2025): Multi-frame generation, predicts intermediate actions/motion trajectories from start/end images
  - Cosmos Predict-2.5: Latest version specialized for simulating and predicting future world states

- **Cosmos Transfer:** Conditional generation with spatial control inputs

- **Cosmos Reason:** Reasoning model for physical AI (early access)

#### Licensing
- Source code: Apache 2.0 License
- Models: NVIDIA Open Model License (commercially usable, attribution required: "Built on NVIDIA Cosmos")
- Pre-training and post-training scripts available via NVIDIA NeMo Framework

#### AV-Specific Adoption
- Waabi: Data curation for AV software development and simulation
- Wayve: Edge/corner case driving scenario search
- Foretellix: High-fidelity testing scenario generation
- Nexar, Oxa: Advancing autonomous driving systems

### 2.2 Alpamayo (January 2026)

NVIDIA's family of open AI models, simulation tools, and datasets for reasoning-based AV development.

#### Alpamayo 1
- **Architecture:** 10B-parameter chain-of-thought reasoning Vision-Language-Action (VLA) model
- **Function:** Processes multi-camera video input to generate trajectories alongside natural language reasoning traces
- **Key capability:** Acts as "implicit world model operating in semantic space" -- reasons through novel edge cases step-by-step (e.g., traffic light outage at busy intersection)
- **Deployment model:** Teacher model -- developers fine-tune and distill into their production AV stacks
- **Availability:** Weights and inference scripts on Hugging Face; future versions with larger parameters, more I/O flexibility, and commercial licensing options

#### AlpaSim
- Fully open-source simulation framework (GitHub)
- **Microservice architecture:** Separate processes for Driver (inference), Renderer (perception), TrafficSim (traffic), Controller (vehicle control), Physics (dynamics)
- **Pipeline parallelism:** While one scene renders, driver runs inference for another -- dramatically improves GPU utilization
- gRPC-based interfaces; horizontal GPU scaling; ~900 reconstructed scenes
- Supports both open-loop training and closed-loop refinement via RoaD algorithm (mitigates covariate shift)

#### Physical AI Open Datasets
- 1,727 hours across 25 countries, 2,500+ cities
- 310,895 clips (20s each), multi-camera + LiDAR + radar
- Designed for robust VLA training and assessment

#### Industry Adoption
- JLR, Lucid Motors, Uber, Berkeley DeepDrive

### 2.3 DRIVE Sim & Omniverse

- **DRIVE Sim on Omniverse:** Transitioned AV simulation from game engine to simulation engine foundation
- **OpenUSD integration:** Unified data framework enabling seamless interoperability of simulation assets; layer-stacking and composition arcs for asynchronous collaboration
- **Omniverse Blueprint for AV Simulation:** Standardized API-driven workflow for digital twins, sensor data replay, ground-truth generation, closed-loop testing
- **Capabilities:** Software-in-the-loop and hardware-in-the-loop configurations; complex sensor suite simulation across GPUs and nodes
- **Users:** Foretellix, Mcity, Oxa, Parallel Domain, Plus AI, Uber

### 2.4 NVIDIA Halos Safety Platform

Comprehensive safety platform integrating full automotive hardware/software stack with AI safety research. Cosmos models deliver safety enhancements through extensive scenario generation and validation.

### 2.5 Partnership Ecosystem

NVIDIA's AV platform is adopted by:
- **OEMs:** Mercedes-Benz, JLR, Lucid, and others
- **AV companies:** Zoox, Aurora, Wayve, Waabi
- **Hardware:** DRIVE AGX Orin (current), DRIVE AGX Thor (forthcoming)
- **Aurora partnership:** Dual NVIDIA DRIVE Thor SoC configuration with DriveOS for the Aurora Driver

---

## 3. Tesla

### 3.1 FSD Architecture Evolution

Tesla's Full Self-Driving system has undergone a fundamental architectural transformation:

#### Phase 1: Modular Stack (FSD v1--v11)
- **HydraNet:** Multi-task neural network for object detection, lane lines, signs
- **Occupancy Networks (2022):** 3D volumetric representation of the environment; complemented HydraNet for perceiving occupied space
- **Explicit planning module:** C++ rule-based planner consuming perception outputs
- Result: ~300,000 lines of C++ code for planning and control

#### Phase 2: End-to-End (FSD v12, 2024)
- Replaced 300,000 lines of C++ with a single neural network pipeline
- **Architecture:** 48 distinct neural networks processing inputs from 8 cameras (360-degree coverage)
- Transforms 2D camera images into 3D spatial understanding via BEV transformations and occupancy networks
- **Direct output:** Steering, acceleration, braking commands from raw camera inputs
- **Training:** ~70,000 GPU-hours per cycle; 1.5+ petabytes of driving data from 4M+ vehicle fleet

#### Phase 3: Unified E2E (FSD v13, Summer 2025)
- **Temporal-Voxel Transformer:** Prioritizes long-term memory over instantaneous reaction
- **Temporal Transformers:** Recursive buffer of last 10 seconds of video; maintains permanent 3D "Voxel Map" of surroundings
- **Occupancy Network v3:** Upgraded perception; remembers obscured agents' trajectories and velocities
- **AI4 hardware:** Higher NPU throughput, native FP16 (16-bit floating point) execution
- **Training approach:** Millions of video clips of exemplary human driving; learns nuanced behaviors (subtle steering near trucks, gentle deceleration at stale green lights)

### 3.2 Tesla's Implicit World Model

Tesla does not deploy an explicit, standalone world model in the GAIA/Cosmos sense. Instead, FSD contains an **implicit world model** embedded within its end-to-end architecture:

- The occupancy network + temporal transformer combination functions as an internal predictive model of the environment
- The voxel map with memory effectively predicts where agents will be based on observed trajectories
- Training on human driving videos implicitly teaches the network physics, agent behavior, and traffic dynamics

### 3.3 Autolabeling Pipeline & Data Engine

- **Shadow mode:** Each vehicle runs two FSD systems -- one drives, one evaluates in background, identifying disagreements/inaccuracies
- **Fleet-sourced mining:** When inaccuracies are confirmed, fleet is queried for similar examples
- **Human-in-the-loop:** Mined examples are correctly labeled and fed back into training
- **Synthetic data:** GPU-accelerated path-tracing engine generates synthetic frames matching real camera response curves (global illumination, accurate sensor simulation)
- **Scale:** 3 billion FSD miles by January 2025; 500M km European data 2024--2025; 400% compute increase in 2024

### 3.4 Simulation Approach

- Virtual proving ground generating perfectly labeled synthetic data
- Simulates visual properties of cameras (camera response curves, lens distortion)
- Edge case scenarios feed into training pipeline
- Closed-loop simulation for safety validation

### 3.5 Dojo Supercomputer

- Custom AI training supercomputer designed for video-based neural network training
- **Status:** Dojo project was reportedly disbanded August 2025, then restarted January 2026
- **Dojo 2:** Expected to operate "at scale" (~100k H100 equivalent) sometime in 2026
- Designed to compress training cycles from days/weeks to hours

### 3.6 Current FSD Status (March 2026)

- FSD v13 deployed fleet-wide (Summer 2025)
- FSD v14.x series in active development/testing
- Europe rollout ongoing with expanded data collection
- Robotaxi ambitions continue alongside consumer FSD

---

## 4. Waymo

### 4.1 EMMA (End-to-End Multimodal Model for Autonomous Driving)

Published October 2024; represents Waymo's research direction toward unified end-to-end autonomy.

#### Architecture
- **Foundation:** Built on Google's Gemini multimodal large language model
- **Input:** Raw camera sensor data (images)
- **Output unification:** All non-sensor inputs (navigation instructions, ego status) and outputs (trajectories, 3D locations) represented as natural language text
- **Task formulation:** Jointly processes multiple driving tasks in unified language space using task-specific prompts:
  - Motion planning (planner trajectories)
  - Perception (object detection)
  - Road graph estimation
- **Co-training benefit:** Single co-trained EMMA matches or surpasses individually trained task-specific models

#### Performance
- State-of-the-art motion planning on nuScenes
- Competitive results on Waymo Open Motion Dataset (WOMD)
- Competitive camera-primary 3D object detection on Waymo Open Dataset

#### Limitations
- Processes only small number of image frames
- No LiDAR/radar input (camera-only)
- Computationally expensive
- Future plans: 3D sensing encoders for LiDAR/radar integration

### 4.2 Waymo World Model (February 2026)

- **Foundation:** Built on Google DeepMind's **Genie 3** -- the most advanced general-purpose world model for photorealistic, interactive 3D environments
- **Adaptation:** Genie's broad world knowledge is transferred from 2D video into 3D lidar outputs compatible with Waymo's hardware suite
- **Multi-sensor output:** Generates high-fidelity camera AND lidar data simultaneously
- **Controllability:**
  1. **Driving actions:** Counterfactual "what-if" scenario testing
  2. **Scene layout:** Road configurations, traffic signals, agent behavior
  3. **Language control:** Time-of-day, weather, fully synthetic scenes
- **Rare event simulation:** Can simulate events never observed by fleet -- tornados, animal encounters, etc.
- **Efficient variant:** Reduced computational demands for longer simulations while maintaining fidelity
- **Context:** Waymo has logged ~200 million fully autonomous miles; billions of virtual miles

### 4.3 MultiPath++ (Motion Forecasting)

Published at ICRA 2022; a key component of Waymo's prediction stack.

- **Input representation:** Compact polylines for road features; raw agent state (position, velocity, acceleration) -- departed from dense image-based approaches
- **Multi-Context Gating (MCG) Fusion:** Cross-attention-like mechanism for context-aware fusion between agents and road elements
- **Latent anchor embeddings:** Learned end-to-end (replacing static pre-defined anchors)
- **Agent encoding:** LSTM for sequential state history
- **Output:** Gaussian Mixture Model priors for multi-modal trajectory prediction
- **Performance:** SOTA on Argoverse Motion Forecasting and WOMD challenges

### 4.4 Waymo Open Sim Agents Challenge (WOSAC)

- First public challenge for multi-agent traffic simulation
- Goal: Design realistic simulators for evaluating and training AV behavior models
- **Waymax simulator:** Made available to research community (2024)
- 2025 challenge: Top methods include SMART-R1's alternating SFT-RFT-SFT pipeline achieving SOTA realism and safety

### 4.5 Waymo's Overall Architecture

Waymo's production system (the "Waymo Driver") remains a **modular architecture** with perception, prediction, planning, and control as distinct components, augmented by:
- Extensive sensor suite (cameras, LiDAR, radar)
- HD maps for operational domains
- Massive simulation infrastructure

EMMA and the Waymo World Model represent **research directions** that may gradually integrate into the production stack. The production system benefits from the most real-world autonomous miles of any company (~200M+).

---

## 5. Comma.ai

### 5.1 Overview

Comma.ai's openpilot is the leading open-source advanced driver assistance system, supporting 325+ car models with 10,000+ active users and 100M+ miles driven.

### 5.2 End-to-End Architecture

openpilot uses a system-level end-to-end design -- a single neural network predicting car trajectory directly from camera images, trained on real-world driving data uploaded by users.

#### Vision Backbone Evolution
- **Previous:** EfficientNet-based
- **Current:** **FastViT** (Hybrid Vision Transformer) -- biggest model improvement since 0.9.0 redesign

#### Model Architecture (openpilot 0.10+)
- MPC systems entirely removed (both lateral and longitudinal)
- Model directly outputs executable trajectories
- End-to-end training with world model supervision

### 5.3 World Model Approach

Comma.ai's world model paper ("Learning to Drive from a World Model," CVPR 2025) details their approach:

#### World Model Architecture
- **Core:** Diffusion Transformer (DiT) operating on compressed video
- **Video encoding:** Pretrained Stable Diffusion VAE (8x8 compression, 4 latent channels)
- **Model sizes tested:** 250M, 500M (primary), 1B parameters
- **Conditioning:** Vehicle poses, world timesteps, diffusion noise timesteps fused via Adaptive Layer Norm
- **Causal masking:** Block-wise triangular attention prevents future frame access; enables KV caching
- **3D extension:** DiT adapted to 3D inputs by extending patching table to 3D, then flattening before transformer blocks

#### Training
- **Rectified Flow objective:** Minimizes image reconstruction loss + multi-hypothesis planning loss (5 trajectory hypotheses with Laplace priors)
- **Noise level augmentation:** Addresses autoregressive drift (30% of samples, LogitNormal distribution)
- **Data:** 100k--400k one-minute video segments at 5 Hz, 128x256 resolution

#### Future-Anchored World Model
- Non-causal variant conditioned on future observations
- Creates "recovery pressure" -- trajectories converge to goal states without explicit recovery behavior
- Model predicts both images and action trajectories; Plan Model generates supervision signals

#### Simulation Comparison

| Aspect | Reprojective Simulation | World Model Simulation |
|--------|------------------------|----------------------|
| Mechanism | 3D depth reprojection + inpainting | Learned video prediction |
| Dynamic scenes | Static scene assumption (fails) | Handles dynamic environments |
| Night driving | Severe lighting/reflection artifacts | Implicit handling |
| Range | Limited (<4m translation) | No range limit |
| Shortcut learning | Pose-correlated artifacts exploitable | Generalizable |
| Scalability | Limited | Scales with compute and data |

#### Information Bottleneck
- White Gaussian noise limits feature representation to ~700 bits
- Prevents exploitation of simulator artifacts; enforces generalizable feature learning

### 5.4 Real-World Results

- **Closed-loop (MetaDrive):** World model on-policy achieves 24/24 lane-centering, 19/20 lane changes
- **Real-world deployment (500 users, ~2 months):**
  - World model: 29.92% engaged time, 52.49% distance engagement
  - Reprojective: 27.63% engaged time, 48.10% distance engagement

### 5.5 Recent Evolution

- **openpilot 0.10:** World model ("Tomb Raider") supervises driving model during training
- **openpilot 0.11:** First driving model trained using both videos AND plans generated from a world model
- Fully open-source: all code on GitHub (commaai/openpilot)

---

## 6. Waabi

### 6.1 UniSim: Neural Closed-Loop Sensor Simulator

Waabi, founded by Raquel Urtasun (former Uber ATG chief scientist), takes an "AI-first" approach centered on simulation.

#### Architecture
- Takes pre-recorded real-world sensor logs and converts them into modifiable digital twin simulations
- Generates both camera and LiDAR point clouds with temporal and spatial consistency
- Neural rendering approach (related to NeRF family) for photorealistic scene reconstruction

#### Key Capabilities
- **Counterfactual scenario generation:** "What would happen if the car in front cut in more aggressively?"
- **Cross-platform transfer:** Data from a car's sensors can simulate what a truck's sensors would see
- **Closed-loop testing:** Runs full autonomy stack in reactive, immersive simulation
- **Multi-sensor consistency:** Camera + LiDAR outputs are temporally and spatially coherent

### 6.2 Waabi World

- Comprehensive closed-loop simulator for training and testing AV systems primarily in virtual environments
- Uses generative AI to create millions of driving scenarios
- Focused on autonomous trucking
- Fully driverless truck operations planned by end of 2025
- Raised $200M; named to CNBC Disruptor 50 (2025)

### 6.3 Integration with NVIDIA Ecosystem
- Evaluating NVIDIA Cosmos for data curation in AV software development
- Uses NVIDIA GPUs for training and simulation
- Cosmos partnership for scenario generation

---

## 7. Zoox, Aurora, Cruise

### 7.1 Zoox (Amazon)

#### Architecture
- **Purpose-built vehicle:** Symmetrical, bidirectional electric robotaxi designed from ground up (not retrofitted)
- **Sensor suite:** Cameras, LiDAR, radar, and longwave-infrared cameras at four corners providing overlapping 360-degree FOV (100m+ range)
- **AI stack:** Traditional three-stage pipeline: Perception -> Prediction -> Planning
  - **Perception:** Deep neural networks extract lanes, signs, lights, objects, pedestrians from fused sensor input
  - **Prediction:** CNN processes bird's-eye view with ~60 semantic layers; enhanced by Graph Neural Networks for explicit agent relationship encoding; outputs probability distribution of trajectories per agent
  - **Planning:** Consumes predictions to generate safe, efficient routes
- **Emerging direction:** Integrating prediction with planning for conditional reasoning ("if I do X, how will agents react?")
- **Simulation:** Adversarial simulations testing edge cases
- **Computing:** NVIDIA GPU-based
- **Status:** Public robotaxi service launched San Francisco, November 2025 ("Zoox Explorers" program)

### 7.2 Aurora Innovation

#### Aurora Driver
- **Level:** SAE L4 autonomous driving system
- **Focus:** Autonomous freight trucking (Texas corridor)
- **Hardware:** Dual NVIDIA DRIVE Thor SoC configuration with DriveOS
- **Key sensor:** Proprietary FirstLight LiDAR -- detects objects in dark 450m+ away, identifying pedestrians 11 seconds sooner than human drivers
- **Architecture:** Common core design enabling integration across multiple truck platforms (modular, consolidated components)
- **Partnerships:** Continental (mass manufacture 2027), Volvo Autonomous Solutions
- **Status:** Surpassed 100,000 driverless miles by October 2025; expanding routes in Southwestern US

### 7.3 Cruise (GM)

#### Timeline
- **October 2023:** San Francisco accident (vehicle dragged pedestrian) triggered regulatory and reputational crisis
- **December 2024:** GM stopped funding Cruise robotaxi development; 1,000 employees dismissed (50% workforce reduction)
- **February 2025:** Cruise merged into GM; pivot from robotaxis to personal vehicle autonomy
- **December 2025:** GM attempted revival; hired former Tesla executive Ronalee Mann
- **Current direction:** Developing hands-free/eyes-closed features for consumer GM vehicles (personal autonomy, not robotaxi); input from former Tesla Autopilot chief Sterling Anderson

---

## 8. Hugging Face LeRobot & Open-Source Ecosystem

### 8.1 LeRobot

- **Founded:** 2024, led by ex-Tesla lead Remi Cadene
- **Growth:** 0 to 12,000+ GitHub stars in first year
- **Mission:** Lowering barriers to robotics with open models, datasets, and tools in PyTorch

#### Key Capabilities (v0.4.0)
- **Models:** PI0.5, GR00T N1.5 (VLA models), and other imitation learning / reinforcement learning approaches
- **Datasets v3.0:** Scalable data infrastructure
- **Plugin system:** Easier hardware integration
- **SmolVLA:** Compact VLA model running on CPUs and single consumer GPUs -- lowers barrier to generalist robotics

#### Ecosystem Growth
- Robotics datasets on Hugging Face: 1,145 (2024) -> 26,991 (2025) -- now the single largest dataset category on the Hub
- Hugging Face acquired Pollen Robotics to sell open-source robots

### 8.2 Relevance to AV

While LeRobot is primarily focused on manipulation robotics, the VLA architectures (PI0.5, GR00T N1.5, SmolVLA) share architectural DNA with AV systems:
- Vision-Language-Action paradigm applicable to driving
- Open datasets and training infrastructure transferable
- Imitation learning / on-policy RL approaches directly relevant
- Community-driven development model

---

## 9. Applied Intuition & Ghost Autonomy

### 9.1 Applied Intuition

#### Platform
- AI-powered ADAS/AD toolchain, vehicle platform, and autonomy stack
- **Customers:** 18 of top 20 global automakers (Toyota, Nissan, Porsche, VW Group, Stellantis, Valeo)
- **Valuation:** $6B+ (as of 2024)

#### SDS for Automotive (2025)
- **End-to-end ADAS stack:** Unified neural architecture integrating perception, planning, control
- **White-box transparency:** Full source code access for OEMs; customizable, validatable, traceable
- **Silicon-agnostic:** Camera-heavy design supporting 1 to 11 cameras, optional radars
- **Feature range:** L2++ with pathway to L3/L4
- **Regulatory compliance:** ISO 26262, SOTIF, ISO/PAS 8800:2024
- **Scale:** 50M+ simulations covering billions of driving miles

#### Simulation Infrastructure
- Neural simulation, AI agents, full vehicle testing
- Large-scale data and ML infrastructure
- Enables 4x faster development cycles
- NVIDIA collaboration: ADAS stack optimized for DRIVE AGX Orin and forthcoming DRIVE AGX Thor

### 9.2 Ghost Autonomy

- Ghost Autonomy: Supplier of autonomous driving software that innovated in AV tech
- **October 2024:** Applied Intuition acquired Ghost Autonomy's patent portfolio
- Strategic IP acquisition strengthening Applied Intuition's freedom to innovate
- Demonstrates consolidation trend in AV industry

---

## 10. Comparative Analysis & Lessons for Airside AV

### 10.1 Architecture Taxonomy

| Company | World Model Type | E2E Approach | Primary Modality | Open/Proprietary |
|---------|-----------------|--------------|-------------------|-----------------|
| **Wayve** | Explicit generative (GAIA, latent diffusion) | Full E2E (AV2.0) | Camera-primary | Proprietary |
| **NVIDIA** | Foundation model platform (Cosmos) + Reasoning VLA (Alpamayo) | Provides tools, not production stack | Multi-modal | Open (Cosmos: NVIDIA License; Alpamayo: HF) |
| **Tesla** | Implicit (embedded in E2E network) | Full E2E (FSD v12+) | Camera-only | Proprietary |
| **Waymo** | Explicit generative (Genie 3-based) | Research E2E (EMMA); production modular | Camera + LiDAR + radar | Research papers; proprietary production |
| **Comma.ai** | Explicit generative (DiT-based) | Full E2E (openpilot) | Camera-primary | Fully open source (MIT) |
| **Waabi** | Neural simulator (UniSim) | Simulation-first | Camera + LiDAR | Proprietary |
| **Zoox** | N/A (traditional simulation) | Modular (perception->prediction->planning) | Camera + LiDAR + radar + IR | Proprietary |
| **Aurora** | N/A | Modular with proprietary LiDAR | Camera + LiDAR + radar | Proprietary |
| **Applied Intuition** | Neural simulation | E2E ADAS stack (SDS) | Camera-primary (flexible) | White-box commercial |

### 10.2 Key Trends

1. **Latent diffusion is winning:** Both Wayve (GAIA-2/3) and Comma.ai have moved from autoregressive to diffusion-based world models for superior temporal consistency and motion quality

2. **VLA models are the frontier:** NVIDIA Alpamayo, Wayve LINGO-2, and Waymo EMMA all represent Vision-Language-Action architectures that unify perception, reasoning, and action in language space

3. **World models serve dual purpose:** Both training (data augmentation, on-policy learning) AND evaluation (safety validation, scenario generation)

4. **Foundation model generalization works:** Wayve's 500-city demo and rapid US adaptation with 500 hours of data validates the foundation model approach for geographic transfer

5. **Open-source ecosystem is maturing:** NVIDIA Cosmos/Alpamayo, Comma.ai openpilot, HuggingFace LeRobot create a viable open stack

### 10.3 What Can Be Borrowed/Adapted for Airside AV

#### From Wayve
- **Foundation model approach to generalization** is directly applicable: Train on diverse airport environments, then fine-tune per airport with minimal local data
- **GAIA-style world models** for safety-critical scenario generation (rare events: FOD, aircraft pushback conflicts, emergency vehicles on tarmac)
- **Embodiment transfer** (GAIA-3): Same model evaluates across different GSE vehicle types
- **LINGO-2 language conditioning:** Adaptable to airside commands ("hold at runway crossing," "proceed to gate B12")

#### From NVIDIA
- **Cosmos as training data engine:** Fine-tune Cosmos for airport environments; generate synthetic ramp scenarios, weather conditions, lighting variations
- **Alpamayo reasoning VLA:** Chain-of-thought reasoning for complex airside decisions (right-of-way at taxiway intersections, responding to marshaller signals)
- **AlpaSim framework:** Open-source simulation adaptable to airport operations
- **Physical AI datasets:** While road-focused, demonstrate data curation practices transferable to airside data collection
- **DRIVE Sim + Omniverse:** OpenUSD-based digital twins of airports for simulation; reconstruct specific ramp layouts

#### From Tesla
- **Data engine paradigm:** Fleet-sourced learning from operational airside vehicles; shadow mode for identifying edge cases
- **Autolabeling pipeline:** Reduce annotation costs for airside-specific objects (aircraft types, GSE, marshalling signals)
- **Implicit world model in E2E:** Demonstrates that explicit world models aren't strictly necessary -- sufficiently large E2E networks can learn physics and dynamics implicitly
- **Temporal voxel approach:** Particularly relevant for airside where remembering obscured agents (behind aircraft) is critical

#### From Waymo
- **EMMA-style multimodal model:** Airport operations have rich text/procedure context (NOTAM, ATC instructions) that can be unified with visual input
- **Waymo World Model (Genie 3-based):** Simulating rare airside events (engine blast, jet wash, fuel spill)
- **MultiPath++ forecasting:** Aircraft and GSE trajectory prediction with multi-modal uncertainty
- **WOSAC-style benchmarks:** Could establish standardized airside simulation challenges

#### From Comma.ai
- **Open-source E2E as starting point:** openpilot's architecture (FastViT + temporal transformer) is a proven, deployable E2E backbone
- **World model training methodology:** DiT-based world model with future anchoring is directly transferable
- **Information bottleneck technique:** Prevents overfitting to simulation artifacts -- critical for sim-to-real transfer in airside environments
- **Real-world validation methodology:** Engagement metrics and on-policy learning framework

#### From Waabi
- **UniSim for cross-platform transfer:** Record data from one GSE vehicle type, simulate what another vehicle type's sensors would see
- **Simulation-first development:** Particularly attractive for airside where real-world testing is expensive and restricted
- **Counterfactual safety testing:** "What if aircraft pushed back earlier?" scenarios

#### From Applied Intuition
- **White-box stack for regulatory compliance:** Airside operations face aviation safety standards (DO-178C, ARP4754A) requiring traceable, inspectable systems
- **Silicon-agnostic design:** Important for GSE manufacturers with varying compute constraints
- **OEM integration model:** Demonstrates how to deliver autonomy technology to vehicle manufacturers (analogous to GSE OEMs)

### 10.4 Open-Source vs. Proprietary Considerations

#### Strong Open-Source Options Available
| Component | Open-Source Option | License | Notes |
|-----------|-------------------|---------|-------|
| World foundation models | NVIDIA Cosmos | NVIDIA Open Model License (commercial OK) | Best-in-class tokenizers + generation |
| Reasoning VLA | NVIDIA Alpamayo 1 | Hugging Face (research; commercial TBD) | 10B parameter, chain-of-thought |
| E2E driving stack | Comma.ai openpilot | MIT License | Production-proven, 100M+ miles |
| Simulation framework | NVIDIA AlpaSim | Open source (GitHub) | Microservice architecture, scalable |
| Robotics VLA models | HuggingFace LeRobot | Apache 2.0 / MIT | SmolVLA, PI0.5, GR00T N1.5 |
| Driving datasets | NVIDIA Physical AI AV | Open | 1,727 hours, 25 countries |

#### Proprietary Components Worth Licensing
| Component | Provider | Value Proposition |
|-----------|----------|-------------------|
| Full simulation platform | Applied Intuition | 18/20 OEMs trust it; regulatory compliance built-in |
| World model for evaluation | Wayve GAIA-3 | Best-in-class generative driving scenarios |
| Foundation model compute | Microsoft Azure | Wayve-proven GPU orchestration at scale |
| Hardware platform | NVIDIA DRIVE AGX | Industry-standard AV compute; Thor coming |

### 10.5 Recommended Approach for Airside AV

Based on this analysis, a practical development strategy would be:

1. **Start with open-source backbone:** Adapt openpilot's E2E architecture (FastViT + temporal transformer) or NVIDIA Alpamayo for airside perception and planning

2. **Build airside world model:** Fine-tune NVIDIA Cosmos on airside driving data to create an airport-specific world foundation model for training data generation and scenario simulation

3. **Adopt simulation-first development:** Use AlpaSim (open-source) or Applied Intuition (commercial) as simulation backbone; integrate Cosmos-generated synthetic airside scenarios

4. **Implement data engine:** Follow Tesla's shadow-mode paradigm -- deploy data collection vehicles on ramps to build proprietary airside datasets

5. **Language conditioning:** Incorporate LINGO-2/EMMA-style language interfaces for airside procedure compliance and ATC/ground control integration

6. **Safety validation:** Use GAIA-3-style world models (or Waymo World Model approach) for rare-event simulation specific to airside operations

7. **Regulatory pathway:** Applied Intuition's white-box, traceable architecture provides a model for meeting aviation safety standards

---

## Key Sources

### Wayve
- [GAIA-1 Technical Report](https://arxiv.org/abs/2309.17080)
- [Scaling GAIA-1 to 9B Parameters](https://wayve.ai/thinking/scaling-gaia-1/)
- [GAIA-2: Multi-View Generative World Model](https://wayve.ai/thinking/gaia-2/)
- [GAIA-3: World Models for Safety and Evaluation](https://wayve.ai/thinking/gaia-3/)
- [LINGO-2: Driving with Natural Language](https://wayve.ai/thinking/lingo-2-driving-with-language/)
- [AV2.0 Technology](https://wayve.ai/technology/)
- [Multi-Country Generalization](https://wayve.ai/thinking/multi-country-generalization/)
- [AI-500 Roadshow: 500 Cities](https://wayve.ai/thinking/ai-500-roadshow-500-cities/)
- [Wayve-Uber L4 Trials](https://wayve.ai/press/wayve-uber-l4-autonomy-trials/)
- [Series D Funding ($1.2B)](https://eandt.theiet.org/2026/02/25/uk-start-wayve-raises-further-12bn-scale-its-ai-self-driving-vehicle-platform)
- [Microsoft Azure Partnership](https://news.microsoft.com/source/emea/features/ai-that-drives-change-wayve-rewrites-self-driving-playbook-with-deep-learning-in-azure/)

### NVIDIA
- [Cosmos World Foundation Models](https://www.nvidia.com/en-us/ai/cosmos/)
- [Cosmos Platform Paper (arXiv)](https://arxiv.org/abs/2501.03575)
- [Cosmos Tokenizer (GitHub)](https://github.com/NVIDIA/Cosmos-Tokenizer)
- [Cosmos Predict-2 (GitHub)](https://github.com/nvidia-cosmos/cosmos-predict2)
- [Alpamayo Announcement](https://nvidianews.nvidia.com/news/alpamayo-autonomous-vehicle-development)
- [Building AVs That Reason with Alpamayo](https://developer.nvidia.com/blog/building-autonomous-vehicles-that-reason-with-nvidia-alpamayo/)
- [NVIDIA Open Model License](https://www.nvidia.com/en-us/agreements/enterprise-software/nvidia-open-model-license/)
- [DRIVE Sim on Omniverse](https://blogs.nvidia.com/blog/nvidia-drive-sim-omniverse-early-access/)
- [WFMs Advance AV Simulation and Safety](https://blogs.nvidia.com/blog/wfm-advance-av-sim-safety/)

### Tesla
- [Tesla FSD v12 Neural Network Revolution](https://www.fredpope.com/blog/machine-learning/tesla-fsd-12)
- [FSD v13 Architecture Deep Dive](https://www.teslaacessories.com/blogs/news/a-deep-dive-into-tesla-fsd-v13-and-the-new-era-of-autonomous-driving)
- [Tesla Dojo Timeline](https://techcrunch.com/2025/09/02/teslas-dojo-a-timeline/)
- [Tesla Autolabeling and Simulation](https://saneryee-studio.medium.com/deep-understanding-tesla-fsd-part-4-auto-labeling-simulation-60c9bfd3bcb5)
- [FSD Architecture Evolution](https://www.allpcb.com/allelectrohub/evolution-of-teslas-driving-autonomy-system)

### Waymo
- [EMMA Paper (arXiv)](https://arxiv.org/abs/2410.23262)
- [EMMA Research Page](https://waymo.com/research/emma/)
- [Waymo World Model Blog](https://waymo.com/blog/2026/02/the-waymo-world-model-a-new-frontier-for-autonomous-driving-simulation/)
- [MultiPath++ Research](https://waymo.com/research/multipath++-efficient-information-fusion-and-trajectory-aggregation-for-behavior-prediction/)
- [Waymo Open Sim Agents Challenge](https://arxiv.org/html/2305.12032v4)
- [Waymo Taps Genie 3](https://winbuzzer.com/2026/02/07/waymo-google-deepmind-genie-3-autonomous-driving-simulation-xcxwbn/)

### Comma.ai
- [Learning to Drive from a World Model (Blog)](https://blog.comma.ai/mlsim)
- [Learning to Drive from a World Model (Paper)](https://arxiv.org/html/2504.19077v1)
- [openpilot 0.10 Release](https://blog.comma.ai/010release/)
- [openpilot 0.11 Release](https://blog.comma.ai/011release/)
- [openpilot GitHub](https://github.com/commaai/openpilot)

### Others
- [Waabi UniSim](https://waabi.ai/unisim/)
- [Waabi World](https://waabi.ai/insights/waabi-world)
- [Zoox Prediction System (Amazon Science)](https://www.amazon.science/latest-news/how-the-zoox-robotaxi-predicts-everything-everywhere-all-at-once)
- [Aurora Innovation](https://aurora.tech/)
- [Aurora + Continental + NVIDIA Partnership](https://ir.aurora.tech/news-events/press-releases/detail/112/aurora-continental-and-nvidia-partner-to-deploy-driverless-trucks-at-scale)
- [Cruise/GM Shutdown and Restart](https://www.electrive.com/2025/08/12/after-cruise-shutdown-general-motors-renews-autonomous-driving-push/)
- [LeRobot GitHub](https://github.com/huggingface/lerobot)
- [LeRobot v0.4.0](https://huggingface.co/blog/lerobot-release-v040)
- [Applied Intuition SDS for Automotive](https://www.appliedintuition.com/blog/sds-for-automotive)
- [Applied Intuition + Ghost Autonomy](https://www.appliedintuition.com/news/applied-intuition-ghost-autonomy-patents)
- [World Models for AD Survey (arXiv)](https://arxiv.org/pdf/2501.11260)
