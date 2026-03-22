# End-to-End Autonomous Driving Architectures & Foundation Models for Airside Autonomous Vehicles

## Comprehensive Technical Report

**Date:** March 2026
**Scope:** End-to-end driving models, foundation models, occupancy networks, sensor fusion, and deployment considerations for airside autonomous vehicles.

---

## Table of Contents

1. [End-to-End Autonomous Driving Models](#1-end-to-end-autonomous-driving-models)
2. [Foundation Models for Driving](#2-foundation-models-for-driving)
3. [Occupancy-Based Approaches](#3-occupancy-based-approaches)
4. [Multi-Modal Sensor Fusion](#4-multi-modal-sensor-fusion)
5. [Deployment Considerations for Airside](#5-deployment-considerations-for-airside)
6. [Synthesis: Applicability to Airside Autonomous Vehicles](#6-synthesis-applicability-to-airside-autonomous-vehicles)
7. [Sources](#7-sources)

---

## 1. End-to-End Autonomous Driving Models

### 1.1 UniAD (Unified Autonomous Driving) — CVPR 2023 Best Paper

**Authors:** OpenDriveLab, Wuhan University, SenseTime Research

UniAD is a planning-oriented framework that unifies perception, prediction, and planning into a single differentiable network. Rather than treating each task as a standalone module, UniAD casts them hierarchically with planning as the ultimate objective.

**Architecture:**
- **Input:** Multi-view camera images (no LiDAR)
- **BEV Feature Extraction:** Camera images are projected into a Bird's Eye View feature space
- **TrackFormer:** Generates and tracks 3D agent bounding boxes
- **MapFormer:** Online HD map construction (lane dividers, road boundaries, pedestrian crossings)
- **MotionFormer:** Predicts future trajectories for each tracked agent
- **OccFormer:** Voxel-based occupancy prediction for unstructured obstacles
- **Planner:** Generates ego-vehicle trajectory conditioned on all upstream outputs

**Training:** Two-stage approach — perception modules (tracking + mapping) trained jointly for 6 epochs, then full end-to-end training across all modules for 20 epochs.

**Key Contribution:** Demonstrated that jointly optimizing all tasks with a planning objective yields significant improvements over individually optimized modules. Established a new paradigm for end-to-end driving research.

**nuScenes Performance:** L2 error 0.73m, collision rate 0.61%.

---

### 1.2 VAD / VADv2 (Vectorized Autonomous Driving) — ICCV 2023 / ICLR 2026

**Authors:** Huazhong University of Science and Technology (HUST)

**VAD (v1):** Models the driving scene as a fully vectorized representation. Instead of dense rasterized BEV maps, VAD uses vectorized agent motion and map elements as explicit instance-level planning constraints. This eliminates computation-intensive rasterized representations, achieving faster inference than prior end-to-end methods while improving planning safety.

**VADv2 (2024):** Extends VAD with probabilistic planning to handle uncertainty. Key innovations:
- **Input:** Multi-view image sequences processed in a streaming manner
- **Processing:** Sensor data transformed into environmental token embeddings
- **Output:** Probabilistic distribution over actions (not deterministic waypoints)
- **Action space:** A single action is sampled from the distribution to control the vehicle
- **No rule-based wrappers:** Operates in a fully end-to-end fashion

**Performance:** VADv2 achieves state-of-the-art closed-loop performance on CARLA Town05 benchmark, significantly outperforming all existing methods. VAD v1 achieves L2 error 0.72m, collision rate 0.21% on nuScenes.

---

### 1.3 SparseDrive — ECCV 2024 (Best Paper Candidate)

**Authors:** Sun Wenchao et al.

SparseDrive introduces a sparse-centric paradigm for end-to-end driving, replacing dense BEV representations with instance-level sparse features.

**Architecture:**
- **Sparse Perception Module:** Symmetric architecture unifying detection, tracking, and online mapping. Agent instances represented by features F_d (N_d x C) and anchor boxes B_d (N_d x 11) containing location, dimension, yaw, and velocity. Map elements represented as anchor polylines (N_m x N_p x 2). Uses 900 detection anchors with 6 decoder layers and 100 map polyline anchors with 20 points each.
- **Parallel Motion Planner:** Leverages similarity between motion prediction and planning. Produces 6 multi-modal trajectory proposals for both tasks (12 future timesteps for prediction, 6 for planning).
- **Hierarchical Planning Selection:** (1) Filter by high-level driving command (turn left/right/straight), (2) Apply collision-aware rescore module (sets collision trajectory scores to zero).
- **Instance Memory Queue:** Temporal modeling via (N_d+1) x 3 memory queue. Three interaction types: agent-temporal cross-attention, agent-agent self-attention, agent-map cross-attention.
- **Ego Initialization:** Ego features derived from front camera feature map via average pooling (avoids status leakage from ground truth velocity).

**Performance vs. Baselines (nuScenes):**

| Method | L2 Error (m) | Collision Rate (%) |
|--------|-------------|-------------------|
| UniAD | 0.73 | 0.61% |
| VAD | 0.72 | 0.21% |
| **SparseDrive-B** | **0.58** | **0.06%** |

**Computational Efficiency:**

| Model | Training Time | Inference FPS | GPU Memory |
|-------|--------------|---------------|-----------|
| UniAD | 144h (8xA100) | 1.8 FPS | 2451 MB |
| SparseDrive-S | 20h (7.2x faster) | 9.0 FPS | 1294 MB |
| SparseDrive-B | 30h (4.8x faster) | 7.3 FPS | 1437 MB |

SparseDrive represents the current state-of-the-art in efficiency-performance trade-off for end-to-end driving on nuScenes.

---

### 1.4 FusionAD — NeurIPS 2023 Workshop

The first unified framework fusing camera and LiDAR beyond perception into prediction and planning.

**Architecture:**
- **Camera Encoder:** BEVFormer-based image encoder maps camera images to BEV space
- **LiDAR Encoder:** Processes LiDAR point clouds into BEV features
- **Transformer Fusion Network:** Fuses multi-modality information into unified BEV features
- **FMSPnP Modules:** Fusion-aided Modality-aware prediction and Status-aware Planning with progressive interaction and refinement
- **Fusion-based Collision Loss:** Models collision risk using fused multi-modal features

**Results vs. UniAD (camera-only):**
- 37% error reduction for trajectory prediction
- 29% enhancement for occupancy prediction
- 14% decrease in collision rates for planning

---

### 1.5 BEV-Based Approaches

#### BEVFormer — ECCV 2022

Camera-only framework learning unified BEV representations via spatiotemporal transformers.

- **Spatial Cross-Attention:** BEV queries extract features from regions of interest across multiple camera views using deformable attention
- **Temporal Self-Attention:** Recurrently fuses historical BEV information, enabling temporal reasoning without explicit tracking
- **Performance:** 56.9% NDS on nuScenes test (on par with LiDAR baselines)
- **Significance:** Proved camera-only approaches could match LiDAR-based methods in 3D perception, spawning numerous follow-up works

#### BEVFusion — ICRA 2023

Multi-task, multi-sensor fusion framework from MIT Han Lab.

- **Unified BEV Space:** Projects both camera and LiDAR features into a shared BEV representation, preserving both geometric (from LiDAR) and semantic (from cameras) information
- **Optimized BEV Pooling:** Reduces latency by 40x compared to naive implementations
- **Task-Agnostic Design:** Seamlessly supports 3D detection, segmentation, and other tasks with minimal architectural changes
- **Results:** +1.3% mAP/NDS for detection, +13.6% mIoU for BEV segmentation, at 1.9x lower computation cost

---

### 1.6 TransFuser — PAMI 2023

Multi-modal fusion transformer integrating image and LiDAR representations using attention mechanisms.

- **Architecture:** Transformer-based fusion of camera images and LiDAR point clouds at multiple spatial scales
- **Sensor Fusion:** Global attention between image and LiDAR feature maps at each resolution level
- **CARLA Performance:** At submission, TransFuser outperformed all prior work on the CARLA leaderboard driving score by a large margin
- **TransFuser++:** Achieved second place at CVPR 2024 CARLA Autonomous Driving Challenge

---

### 1.7 InterFuser — CoRL 2022

Safety-enhanced autonomous driving using interpretable sensor fusion transformer.

- **Architecture:** Unified transformer fusing synchronized RGB and LiDAR sensor data for comprehensive scene understanding
- **Interpretable Outputs:** Produces intermediate representations (attention maps, object detections) that explain downstream control decisions
- **Safety Focus:** Explicitly optimized for safety through infraction-minimizing objectives
- **CARLA Performance:** Highest driving score (76.18) on public CARLA Leaderboard with superior route completion and infraction metrics vs. TransFuser, LBC, NEAT

---

### 1.8 TCP (Trajectory-guided Control Prediction) — NeurIPS 2022

**Architecture:**
- **Dual-Branch Design:** Trajectory planning branch + direct control branch
- **Trajectory Branch:** Predicts future waypoints
- **Control Branch:** Multi-step prediction scheme reasoning about current actions and future states, guided by trajectory branch via attention at each time step
- **Fusion:** Situation-based scheme merges outputs from both branches
- **Input:** Monocular camera only

**Performance:** Driving score 75.137, ranked 1st on public CARLA Leaderboard, surpassing methods using multiple cameras + LiDAR by 13.291 points.

---

### 1.9 NEAT (Neural Attention Fields) — ICCV 2021

Represents driving scenes as continuous neural attention fields, enabling dense spatial reasoning from sparse observations. Pioneered the use of neural implicit representations for end-to-end driving in CARLA.

---

### 1.10 ReasonNet — CVPR 2023

**Three-Module Architecture:**
1. **Perception Module:** Fuses multi-sensor data to generate BEV features, traffic sign features, and waypoints
2. **Temporal Reasoning Module:** Processes current and historic features via a memory bank for temporal context
3. **Global Reasoning Module:** Models interactions and relationships among objects and environment to detect adverse events (occlusion, sudden appearances)

**Key Innovation:** Explicit temporal and global reasoning modules that improve robustness to occlusions and rare events.

---

### 1.11 GameFormer — ICCV 2023 (Oral)

**Architecture:**
- **Game-Theoretic Formulation:** Models multi-agent interaction prediction as a hierarchical game
- **Transformer Encoder:** Models relationships between all scene elements (agents, lanes, traffic signals)
- **Hierarchical Transformer Decoder:** At each level, agents respond to other agents' behaviors from the preceding level, iteratively refining the interaction process
- **Applications:** Interactive prediction and planning for dense traffic scenarios

---

### 1.12 Significant 2024-2025 Models

#### DriveTransformer (2025)
A simplified E2E framework for scaling, featuring:
- **Task Parallelism:** Agent, map, and planning queries directly interact at each transformer block (vs. sequential perception-prediction-planning)
- **Sparse Representation:** Efficient scene encoding
- **Benefit:** Eliminates cumulative errors from manual task ordering

#### PARA-Drive — CVPR 2024
Fully parallel end-to-end architecture achieving state-of-the-art in perception, prediction, and planning while significantly enhancing runtime speed. Demonstrates that parallelizing traditionally sequential tasks can improve both accuracy and latency.

#### GenAD — ECCV 2024 (CVPR 2024 Highlight)
Casts autonomous driving as a generative modeling problem. First large-scale video world model for driving, trained on 2000+ hours of diverse driving videos from the web. Can be adapted into an action-conditioned prediction model or a motion planner.

#### Hydra-MDP — CVPR 2024 Challenge Winner
Multi-teacher, student-teacher knowledge distillation framework. Integrates knowledge from both human and rule-based planners. Won first place and innovation award at CVPR 2024 E2E Driving at Scale Challenge on the nuPlan benchmark.

#### DriveVLM — CoRL 2024
Integrates Vision-Language Models (VLMs) for enhanced scene understanding. Three reasoning modules: scene description, scene analysis, and hierarchical planning. Bridges VLMs with traditional driving pipelines for improved interpretability.

#### Vision-Language-Action (VLA) Models (2025-2026)
Emerging paradigm integrating perception, language reasoning, and action generation:
- **End-to-End VLA:** Single model for perception, reasoning, and planning
- **Dual-System VLA:** Slow deliberation (VLM) + fast execution (planner)
- **DeepRoute.ai (GTC 2026):** 40B parameter VLA model deployed across 250,000+ production vehicles
- **OpenDriveVLA (AAAI 2026):** Open-source end-to-end driving with large VLA models

---

## 2. Foundation Models for Driving

### 2.1 NVIDIA Foundation Models

#### Alpamayo 1 (December 2025)
- **Architecture:** 10-billion parameter chain-of-thought reasoning Vision-Language-Action (VLA) model
- **Input:** Video
- **Output:** Trajectories + reasoning traces explaining each decision
- **Design Philosophy:** Teacher model for distillation — not deployed directly in vehicles. Developers fine-tune and distill into compact AV stack backbones
- **Target:** Long-tail edge cases — rare, complex driving conditions
- **Open Source:** Model weights on Hugging Face, inference scripts on GitHub, AlpaSim simulation framework
- **Dataset:** Physical AI Open Datasets with 1,700+ hours of diverse driving data

#### Cosmos World Foundation Models (January 2025)
- **Purpose:** Generative world foundation models for physical AI (AVs + robots)
- **Capabilities:** Generate physics-based videos from text, image, video, or sensor/motion data. Model physical interactions, object permanence, diverse road conditions
- **Application:** Generate synthetic training data; amplify variations of physically-based sensor data for AV simulation
- **Adopters:** 1X, Agility Robotics, Figure AI, Foretellix, Skild AI, Uber

#### Cosmos-Reason (2025)
Reasoning model enabling vehicles to "think through" decisions — e.g., navigating construction zones, interpreting ambiguous traffic signals. Forms the foundation for Alpamayo.

#### DRIVE Platform Architecture
- **Three-Computer Solution:** DGX (cloud training) -> DRIVE Sim (Omniverse testing) -> DRIVE AGX (in-vehicle inference)
- **DRIVE AGX Orin:** 254 TOPS, powering DRIVE Concierge + DRIVE Chauffeur
- **DRIVE AGX Thor (next-gen):** 8x GPU performance, 2.6x CPU improvement vs. Orin
- **Halos (March 2025):** Unified system combining NVIDIA automotive hardware, software, and AV safety research

---

### 2.2 Waymo — EMMA (End-to-End Multimodal Model for Autonomous Driving) — October 2024

**Architecture:**
- **Foundation:** Built on Google Gemini multimodal LLM (fine-tuned Gemini 1.0 Nano-1)
- **Formulation:** Driving tasks reformulated as visual question-answering: O = G(T, V)
- **Input Representation:** Surround-view camera videos stitched into images/sequences; all non-sensor inputs (navigation commands, ego status) represented as plain text
- **Output Representation:** Trajectories, 3D detections, road graphs all represented as natural language text (x,y coordinates as floating-point strings)
- **Task-Specific Prompts:** Different prompts select which task to perform

**Chain-of-Thought Reasoning (R1-R4):**
1. R1 — Scene description (weather, time, traffic, road characteristics)
2. R2 — Critical objects with 3D/BEV coordinate predictions
3. R3 — Behavior descriptions (status and intent of critical agents)
4. R4 — Meta driving decisions across 12 categories
- Automated label generation (no human annotation needed)
- 6.7% improvement over standard E2E planning

**Multi-Task Co-Training Results:**
- Co-training all three tasks: up to 5.5% improvement over single-task specialists
- Tasks are complementary — co-training planning + detection improves detection by 2.4%

**Performance:**
- nuScenes motion planning: L2 0.32m (EMMA), 0.29m (EMMA+)
- Waymo WOMD: State-of-the-art on ADE at 1s, 3s, and 5s horizons
- WOD 3D detection: 16.3% relative improvement in vehicle precision

**Acknowledged Limitations:**
1. Limited temporal context (max 4 frames)
2. No LiDAR/radar integration — camera only
3. No consistency guarantee between outputs and perception
4. Extremely high computational cost for sensor simulation
5. Not deployable in real-time on current hardware (requires distillation)

---

### 2.3 Tesla FSD Architecture Evolution

**Current State (FSD V13, Summer 2025):**
- **48 Neural Networks:** Process inputs from 8 cameras (360-degree coverage)
- **End-to-End Architecture:** FSD V12+ replaced 300,000+ lines of C++ rules with a single neural network pipeline mapping raw camera inputs directly to steering/acceleration/braking
- **Occupancy Networks (2nd Generation):** Transform 2D camera images into 3D spatial understanding via BEV transformations. Predict "Occupancy Volume" and "Occupancy Flow" — what is free vs. occupied, and where occupied space will move
- **Training Scale:** 70,000 GPU hours per cycle, 1.5+ petabytes of data from 4+ million vehicles, target 100 exaFLOPS by end of 2025
- **V13 Shift:** Moves toward more unified end-to-end AI, away from siloed neural networks stitched with human-written code
- **Camera-Only:** No LiDAR, radar, or ultrasonic sensors

---

### 2.4 Comma.ai — openpilot

**Architecture (v0.11, 2025):**

openpilot represents the most advanced open-source end-to-end driving system deployed at scale (325+ car models, 10,000+ users, 100M+ miles).

**World Model Architecture:**
- **Frame Compressor:** ViT encoder (50M params) / decoder (100M params). Compresses dual camera feeds (narrow + wide, 3x128x256 each) into 32x16x32 latent space using Masked Auto Encoder with LPIPS, adversarial, and LSE losses
- **Diffusion Transformer:** 2 billion parameter transformer (48 layers, 25 heads, 1600 embedding dimension). Processes 2s past context + 1s future conditioning + 0-7s simulation window. Block-causal attention masking. Trained on 2.5M minutes of driving video using Rectified Flow
- **Inference:** 15 Euler steps, 12.2 frames/second/GPU throughput

**Training Paradigm (Breakthrough):**
1. Large world model (simulator) trains on unlabeled fleet data
2. Smaller policy network trains on world model rollouts using latest policy checkpoint
3. On-policy training with lateral and longitudinal noise injection
4. **First real-world robotics agent shipped to users that was fully trained in learned simulation**

**Evolution:**
- Pre-v0.10: Hand-coded MPC planners
- v0.10: World model for planning, reprojective simulator for videos
- v0.11: Fully learned simulation + world model planning

---

### 2.5 Mobileye

**Architecture:**
- **Dual-System Design:** Independent camera system + independent radar-lidar system (redundancy for safety)
- **SuperVision Platform:** 11 cameras + optional radar, AI-powered surround computer vision
- **REM (Road Experience Management):** Crowdsourced HD mapping from millions of production vehicles
- **RSS (Responsibility-Sensitive Safety):** Formal mathematical model for driving policy ensuring provably safe decisions
- **Hardware:** EyeQ6H chipset; modular ECU series supporting SuperVision (ADAS), Chauffeur (L3), and Drive (L4+)
- **Scale:** 240,000+ Zeekr vehicles shipped with SuperVision; 19M+ EyeQ6H-based systems projected

**Key Differentiator:** True Redundancy — two independent perception subsystems must agree before action, providing safety guarantees absent from single-stack approaches.

---

### 2.6 Zoox (Amazon)

- **Purpose-Built Vehicle:** No steering wheel, no pedals; bidirectional design with opposing seat rows
- **Sensor Suite:** Multiple LiDARs, cameras, and radars for 360-degree perception
- **Geofenced Operation:** Operates in defined urban areas (SoMa, Mission District in SF as of November 2025)
- **Architecture:** Proprietary full-stack autonomous system designed from scratch for driverless operation
- **Status:** "Zoox Explorers" program launched November 2025 in San Francisco

---

### 2.7 Cruise (GM — Shut Down 2024)

GM shut down Cruise's robotaxi business in 2024 following safety incidents and regulatory issues. The technology and some teams were absorbed into GM's ADAS/autonomy efforts. Represents a cautionary case for the industry regarding safety validation and public trust.

---

### 2.8 Aurora Innovation

- **Aurora Driver:** SAE Level 4 system for trucks and ride-hailing vehicles
- **FirstLight LiDAR:** Custom FMCW long-range LiDAR measuring position AND velocity of every point. Current gen: 500m range; next gen (mid-2026): 1,000m range, 50% hardware cost reduction
- **Common Core Architecture:** Single software stack deployable across multiple truck platforms
- **Partnership:** Continental for production-ready hardware (2027 target)
- **Status:** 100,000+ driverless miles on public roads without safety incidents (Q3 2025), commercial trucking service operating

---

## 3. Occupancy-Based Approaches

### 3.1 Occupancy Networks: Core Concept

Occupancy networks discretize the 3D driving environment into voxel grids, assigning each cell a probability of being occupied and optionally a semantic label. This representation offers several advantages over bounding boxes:

- **General Object Representation:** Can represent arbitrary shapes (construction debris, fallen cargo, unusual obstacles) without requiring pre-defined categories
- **Free-Space Reasoning:** Explicitly models traversable vs. non-traversable space
- **Fine-Grained Geometry:** Sub-meter resolution volumetric understanding
- **Dynamic Prediction:** Occupancy flow predicts where occupied space will move

### 3.2 Tesla's Occupancy Network

Tesla pioneered practical deployment of occupancy networks at scale:

- **1st Generation (2022):** 3D occupancy volume prediction from multi-camera input via BEV transformations
- **2nd Generation (2023+):** Adds Occupancy Flow — predicts future positions of occupied voxels. Handles amorphous/unusual obstacles (debris, cargo, animal groups). Functions as a real-time high-fidelity 3D map of immediate surroundings
- **Integration:** Core component of FSD V12+ pipeline, replacing explicit object detection for obstacle avoidance

### 3.3 TPVFormer — CVPR 2023

**Tri-Perspective View Representation:**
- Accompanies BEV with two additional perpendicular planes (front view + side view)
- Models each 3D point by summing its projected features on all three planes
- Transformer-based TPV encoder processes multi-camera images
- **Key Result:** Achieves semantic occupancy prediction for all voxels with only sparse supervision (no dense 3D labels needed)
- Described as "an academic alternative to Tesla's occupancy network"

### 3.4 SurroundOcc — ICCV 2023

- Predicts volumetric occupancy of surrounding 3D scenes from multi-camera images
- Uses 2D-to-3D feature lifting with spatial cross-attention
- Dense occupancy prediction with multi-scale supervision
- Provides a pipeline for generating dense occupancy ground truth from sparse LiDAR

### 3.5 OpenOccupancy — ICCV 2023

- **First surrounding semantic occupancy perception benchmark**
- Extends nuScenes with dense semantic occupancy annotations
- Defines evaluation metrics for the occupancy prediction task
- Baseline models and benchmarking framework for fair comparison

### 3.6 Occ3D — NeurIPS 2023

- Large-scale 3D occupancy prediction benchmark
- Label generation pipeline producing dense, visibility-aware labels
- Accounts for sensor occlusion in ground truth generation
- Supports both nuScenes and Waymo datasets

### 3.7 Occupancy Prediction and World Models: The Connection

Occupancy prediction is foundational to world models for autonomous driving:

**OccWorld — ECCV 2024:**
- 3D occupancy-based world model that jointly predicts ego-car movement and surrounding scene evolution
- Given past 3D occupancy observations, forecasts future scenes and ego movements
- Compatible with self-supervised (SelfOcc), LiDAR-collected (TPVFormer), or machine-annotated (SurroundOcc) occupancy data
- Scalable to large-scale training

**Drive-OccWorld — AAAI 2025:**
- Vision-centric world model for 4D occupancy and flow forecasting
- Integrated with end-to-end planning
- Plans trajectories by forecasting future occupancy state and selecting optimal trajectory via occupancy-based cost function

**OccSora (2024):**
- Uses 4D occupancy generation models as world simulators
- Generates future occupancy sequences for training and evaluation

**Key Insight:** Occupancy representations bridge the gap between perception and world modeling. They provide a natural intermediate representation that is:
1. General enough to capture arbitrary geometry
2. Structured enough for physics-based reasoning
3. Compatible with generative models for future prediction
4. Directly usable for planning via free-space cost functions

---

## 4. Multi-Modal Sensor Fusion

### 4.1 Camera-Only vs. Camera + LiDAR

| Aspect | Camera-Only | Camera + LiDAR |
|--------|------------|----------------|
| **Cost** | Low ($50-500 per camera) | High (LiDAR $500-$10,000+) |
| **Depth Accuracy** | Estimated (errors at range) | Direct measurement (mm accuracy) |
| **Semantic Richness** | High (color, texture, signs) | Limited (geometry only) |
| **Weather Robustness** | Degraded in rain/fog/snow | LiDAR robust; rain can cause noise |
| **Lighting** | Requires illumination | LiDAR works in total darkness |
| **Data Volume** | Moderate | High (point clouds are large) |
| **Scaling** | Easy (cameras are ubiquitous) | Difficult (cost, calibration) |
| **Proponents** | Tesla, Comma.ai | Waymo, Zoox, Aurora, Mobileye |

**Current Research Consensus (2024-2025):** For safety-critical applications, multi-sensor fusion remains the gold standard. BEVFusion demonstrated that unified BEV fusion preserves both geometric accuracy (LiDAR) and semantic density (cameras). However, camera-only approaches (BEVFormer, UniAD, SparseDrive) have narrowed the gap significantly, with some now matching LiDAR-based perception accuracy.

**Relevance for Airside:** Low-speed, structured environments may favor multi-sensor approaches due to:
- Safety-critical proximity to aircraft and personnel
- Need for precise positioning (centimeter-level)
- Operation in all weather conditions
- Lower cost sensitivity (fewer vehicles, higher per-unit safety investment)

### 4.2 Radar Integration

Traditional automotive radar provides velocity measurements and operates in all weather, but has low angular resolution. Integration approaches:

- **Late Fusion:** Radar detections fused with camera/LiDAR objects at the object level
- **Mid-Level Fusion:** Radar features fused in BEV space with camera/LiDAR BEV features
- **Early Fusion:** Raw radar signals fused with other sensor modalities at the feature level

### 4.3 4D Radar Developments

4D imaging radar represents a significant advancement, providing elevation information (azimuth + elevation + range + Doppler velocity):

- **Market Growth:** USD 677M (2024) projected to USD 1,043M (2032)
- **Key Datasets:**
  - V2X-R (Xiamen University, 2024): 12,079 scenes, LiDAR-camera-4D radar fusion with adverse weather simulation. Multi-modal Denoising Diffusion uses radar features to clean noisy LiDAR data
  - MAN TruckScenes: 747 scenes, 360-degree 4D radar data, largest annotated 3D bounding box radar dataset
- **Advantages for Airside:**
  - All-weather operation (critical for 24/7 airport operations)
  - Direct velocity measurement (useful for tracking ground support equipment)
  - Lower cost than LiDAR
  - Robust to rain, snow, fog, dust — common airport conditions
  - Penetrates jet exhaust and FOD (Foreign Object Debris) that may scatter LiDAR

### 4.4 Sensor Fusion Architectures for Low-Speed Environments

For constrained, low-speed environments like airports, ports, and warehouses:

**Typical Sensor Suite:**
- 3D LiDAR (1-4 units for 360-degree coverage)
- Cameras (6-12 for surround view)
- 4D Radar (for weather robustness and velocity)
- RTK-GNSS (centimeter-level positioning)
- IMU (inertial measurement)
- Ultrasonic (close-range obstacle detection during docking)

**Architecture Patterns:**
1. **FPGA-Based Fusion:** Ultra-low latency, high reliability for safety-critical applications
2. **Adaptive EKF Fusion:** Selectively integrates multi-sensor data while minimizing energy consumption
3. **BEV Fusion with LIO-SAM:** High-precision dynamic environment maps for logistics operations
4. **Infrastructure-Augmented:** V2X communication with airport infrastructure for enhanced situational awareness

---

## 5. Deployment Considerations for Airside

### 5.1 Real-Time Inference Requirements

For airside autonomous vehicles operating at 5-25 km/h:

| Requirement | Value | Rationale |
|------------|-------|-----------|
| Perception Latency | < 100 ms | Obstacle detection at low speed |
| Planning Cycle | 50-100 ms (10-20 Hz) | Smooth trajectory generation |
| Control Loop | 20-50 ms (20-50 Hz) | Vehicle dynamics response |
| End-to-End Latency | < 200 ms | Sensor-to-actuator total |
| 3D Detection Range | 50-100 m | Adequate for low-speed ODD |
| Occupancy Resolution | 0.1-0.5 m | Precise docking with aircraft |

**Model Inference Benchmarks (for reference):**
- SparseDrive: 7.3-9.0 FPS on A100 — marginal for real-time, requires optimization
- UniAD: 1.8 FPS — not real-time capable without significant optimization
- openpilot policy model: Runs on Snapdragon 8 Gen 3 (mobile SoC)
- EMMA: Not deployable on-edge without distillation

### 5.2 Edge Computing Platforms

#### NVIDIA Jetson Family

| Platform | AI Performance | Power | Form Factor | Availability |
|----------|---------------|-------|-------------|-------------|
| Jetson Orin Nano | 67 TOPS | 7-25 W | Smallest | Available |
| Jetson Orin NX | 157 TOPS | 10-40 W | Small | Available |
| **Jetson AGX Orin** | **275 TOPS** | **15-60 W** | **Module** | **Available** |
| Jetson AGX Thor | 2000+ TOPS | TBD | Module | 2025-2026 |

**Jetson AGX Orin** is the recommended platform for airside autonomous vehicles:
- 275 TOPS sufficient for optimized perception + planning models
- Power configurable for energy-constrained electric GSE
- Mature ecosystem (JetPack SDK, TensorRT, DeepStream)
- Proven in robotics and autonomous machine deployments

#### NVIDIA DRIVE Platform

| Platform | Target | Performance |
|----------|--------|------------|
| DRIVE AGX Orin | Production ADAS/AV | 254 TOPS |
| DRIVE AGX Thor | Next-gen AV | 2000+ TOPS |

DRIVE AGX is designed for automotive (ISO 26262 certified silicon), making it directly applicable to airside vehicles requiring functional safety certification.

#### Model Optimization Pipeline

```
Training (DGX/Cloud) -> ONNX Export -> TensorRT Optimization -> Edge Deployment
```

**TensorRT Optimization Techniques:**
- **Quantization:** FP32 -> FP16/INT8/FP8 (2-4x speedup)
- **Layer Fusion:** Merge adjacent operations (conv + BN + ReLU)
- **Kernel Auto-Tuning:** Hardware-specific kernel selection
- **Dynamic Batching:** Optimize throughput for multi-model pipelines
- **Sparsity:** Structured pruning for 2x additional speedup (Ampere+)

**TensorRT Edge-LLM (2025):** Open-source C++ framework for efficient LLM/VLM inference on embedded platforms (DRIVE AGX Thor, Jetson Thor). Enables reasoning-capable models on edge hardware.

### 5.3 Safety Certification

#### ISO 26262 (Road Vehicles — Functional Safety)

- **Applicability:** Directly applicable to airside autonomous vehicles as they are ground vehicles
- **ASIL Levels:** A (lowest) through D (highest). Airside vehicles likely require ASIL B-D depending on proximity to aircraft and personnel
- **Key Requirements:**
  - Hazard analysis and risk assessment (HARA)
  - Safety goals derivation
  - Functional safety concept
  - Hardware/software design verification
  - Systematic capability and random hardware failure metrics
- **AI/ML Challenge:** ISO 26262 assumes deterministic software. Neural networks are probabilistic, creating certification gaps
- **Industry Response:** EasyMile achieved ISO 26262 certification for its autonomous driving platform (the first autonomous shuttle company to do so), demonstrating feasibility

#### DO-178C (Software Considerations in Airborne Systems)

- **Applicability:** Not directly required for ground vehicles, but relevant for airside operations near aircraft
- **Design Assurance Levels (DAL):** A (catastrophic) through E (no effect)
- **Relevance:** Airside vehicles operating in proximity to aircraft may need to satisfy aviation safety authorities (FAA, EASA) who reference DO-178C standards. The FAA's guidance on AGVS indicates increasing regulatory interest
- **Hybrid Approach:** Some operators may adopt ISO 26262 for the vehicle platform and elements of DO-178C or aviation safety management practices for airside-specific operations

#### Practical Certification Path for Airside

1. **ISO 26262 ASIL B-C** for the autonomous driving platform
2. **Airport-specific safety management** per FAA CertAlert 24-02 / Emerging Entrants Bulletin 25-02
3. **EASA/FAA coordination** for operations in aircraft movement areas
4. **Operational safety case** demonstrating risk mitigation for the specific ODD
5. **Redundancy architecture** (dual-channel perception per Mobileye's approach)

### 5.4 Operational Design Domain (ODD) for Airside

The ODD defines the specific conditions under which an autonomous vehicle is designed to operate safely. For airside operations:

#### Proposed Airside ODD Parameters

| Parameter | Specification |
|-----------|--------------|
| **Speed** | 0-25 km/h (ramp), 0-40 km/h (service roads) |
| **Operating Area** | Defined apron, taxiways, service roads, baggage areas |
| **Weather** | All weather with degraded-mode for extreme conditions (heavy fog <50m visibility, ice storms) |
| **Time of Day** | 24/7 operation |
| **Traffic** | Mixed traffic with aircraft, GSE, personnel, FOD |
| **Infrastructure** | Paved surfaces, marked lanes (where available), geo-fenced boundaries |
| **Connectivity** | V2X with airport operations center, A-SMGCS integration |
| **Exclusion Zones** | Active runways (without explicit clearance), passenger boarding areas |
| **Fallback** | Remote operator takeover, safe stop in designated areas |
| **Cargo/Payload** | ULD containers, baggage dollies, up to specified weight |

#### Key ODD Challenges for Airside

1. **Jet Blast:** High-velocity exhaust from taxiing/departing aircraft can affect sensor performance and vehicle stability
2. **FOD (Foreign Object Debris):** Small objects on apron surfaces that must be detected and avoided
3. **Aircraft Priority:** All ground vehicles must yield to aircraft unconditionally
4. **Dynamic Geometry:** Aircraft pushback paths, variable stand assignments, temporary construction
5. **Electro-Magnetic Interference:** Radar, radio communications, navigation aids
6. **Multi-stakeholder Environment:** Airlines, ground handlers, airport authority, ATC — complex operational coordination

---

## 6. Synthesis: Applicability to Airside Autonomous Vehicles

### 6.1 Most Applicable Architectural Patterns

For airside autonomous GSE (baggage tugs, cargo dollies, service vehicles), the following architectural elements are most relevant:

#### Perception
- **BEV Fusion approach** (camera + LiDAR + 4D radar): Robust multi-modal perception suited for safety-critical, all-weather operations
- **Occupancy networks** (TPVFormer / SurroundOcc style): Ideal for detecting arbitrary obstacles (FOD, loose cargo, ground equipment) without requiring category-specific training
- **Sparse instance representations** (SparseDrive style): Efficient for tracking known agent types (aircraft, other GSE, personnel)

#### Planning
- **Probabilistic planning** (VADv2 style): Handles uncertainty inherent in shared airside environments
- **Collision-aware trajectory selection** (SparseDrive): Critical for safe operation near aircraft
- **Game-theoretic interaction modeling** (GameFormer): Useful for multi-agent coordination on shared aprons

#### World Models
- **Occupancy-based world models** (OccWorld/Drive-OccWorld): Natural fit for predicting scene evolution in structured environments
- **Learned simulation** (openpilot v0.11): Enables training from fleet data without expensive manual annotation

#### Safety & Verification
- **Dual-system redundancy** (Mobileye): Independent perception channels for safety-critical decisions
- **Chain-of-thought reasoning** (EMMA): Explainability for safety case arguments
- **RSS formal safety model** (Mobileye): Mathematical guarantees on safe distances and right-of-way

### 6.2 Recommended Architecture for Airside AV

```
Sensors:
  6-8 cameras (surround view)
  2-3 LiDAR (360-degree, solid-state preferred for reliability)
  4D radar (all-weather backup)
  RTK-GNSS + IMU (precise positioning)
  Ultrasonic (docking)
  V2X radio (airport integration)

Perception:
  BEV fusion backbone (camera + LiDAR + radar -> unified BEV)
  3D occupancy prediction (free-space + obstacle)
  Object detection + tracking (aircraft, GSE, personnel)
  Online map element detection (lane markings, stand boundaries)

Prediction:
  Occupancy flow (future obstacle positions)
  Agent trajectory prediction (multi-modal)

Planning:
  Probabilistic multi-modal trajectory planning
  Collision-aware selection with safety margins
  Integration with airport traffic management

Control:
  Low-level trajectory following
  Emergency stop capability
  Remote operator fallback

Compute:
  NVIDIA Jetson AGX Orin (275 TOPS) or DRIVE AGX
  TensorRT-optimized models (INT8/FP16)
  Redundant compute for safety-critical paths

Safety:
  Dual-channel perception (camera-based + LiDAR-based, independent)
  Formal safety model (RSS-style)
  Watchdog / system monitor
  ISO 26262 ASIL B-C certified platform
```

### 6.3 Current Industry Deployments

| Company | Product | Airports | Technology |
|---------|---------|----------|-----------|
| **EasyMile** | EZTow, EZDolly | Dubai, Changi, Narita, DFW, Schiphol | LiDAR + camera, 400+ deployments globally |
| **AeroVect** | AeroVect Driver | Multiple US airports | LiDAR + camera + RTK-GNSS, platform-agnostic |
| **Aurrigo** | Auto-DollyTug | 6 airports (incl. Zurich, Changi, Schiphol) | LiDAR + 360-degree cameras, all-weather |
| **dnata** | EZTow (EasyMile) | Dubai World Central | L3 autonomy, upgrading to L4 in 2026 |

### 6.4 Regulatory Landscape

- **FAA CertAlert 24-02 (2024):** First formal guidance for AGVS at Part 139 airports
- **FAA Emerging Entrants Bulletin 25-02 (May 2025):** Testing and demonstration guidance
- **Key FAA Positions:**
  - Supports AGVS testing in controlled, low-congestion airport areas
  - Permits operational testing in closed movement and safety areas with proper risk mitigation
  - Airports should not close areas exclusively for AGVS testing
  - Regional FAA Airport Certification and Safety Inspectors must be engaged early

### 6.5 Key Research Gaps for Airside

1. **Airside-specific datasets:** No large-scale public dataset exists for airside driving scenarios (unlike nuScenes, Waymo for roads)
2. **Aircraft interaction modeling:** No published game-theoretic models for GSE-aircraft interactions
3. **Jet blast and FOD perception:** Limited research on perception robustness to jet engine exhaust and small debris detection
4. **Cross-domain transfer:** Limited study on transferring road-driving models to airside environments
5. **Regulatory framework maturity:** FAA/EASA guidance still emerging; no established certification pathway combining ISO 26262 + aviation safety
6. **V2X integration:** Standards for AGVS-airport infrastructure communication are not yet established

---

## 7. Sources

### End-to-End Driving Models
- [UniAD: Planning-oriented Autonomous Driving — CVPR 2023 Best Paper](https://arxiv.org/abs/2212.10156)
- [UniAD GitHub Repository](https://github.com/OpenDriveLab/UniAD)
- [VAD: Vectorized Scene Representation for Efficient Autonomous Driving — ICCV 2023](https://arxiv.org/abs/2303.12077)
- [VADv2: End-to-End Vectorized Autonomous Driving via Probabilistic Planning](https://arxiv.org/abs/2402.13243)
- [SparseDrive: End-to-End Autonomous Driving via Sparse Scene Representation](https://arxiv.org/abs/2405.19620)
- [FusionAD: Multi-modality Fusion for Prediction and Planning Tasks](https://ar5iv.labs.arxiv.org/html/2308.01006)
- [BEVFormer: Learning Bird's-Eye-View Representation](https://arxiv.org/abs/2203.17270)
- [BEVFusion: Multi-Task Multi-Sensor Fusion](https://arxiv.org/abs/2205.13542)
- [TransFuser: Imitation with Transformer-Based Sensor Fusion](https://arxiv.org/abs/2205.15997)
- [InterFuser: Safety-Enhanced Autonomous Driving — CoRL 2022](https://github.com/opendilab/InterFuser)
- [TCP: Trajectory-guided Control Prediction — NeurIPS 2022](https://arxiv.org/abs/2206.08129)
- [NEAT: Neural Attention Fields — ICCV 2021](https://github.com/autonomousvision/neat)
- [ReasonNet: End-to-End Driving with Temporal and Global Reasoning — CVPR 2023](https://github.com/opendilab/DOS)
- [GameFormer: Game-theoretic Interactive Prediction and Planning — ICCV 2023](https://arxiv.org/abs/2303.05760)
- [DriveTransformer: Unified Transformer for Scalable E2E Driving](https://openreview.net/forum?id=M42KR4W9P5)
- [PARA-Drive: Parallelized Architecture for Real-time Autonomous Driving — CVPR 2024](https://openaccess.thecvf.com/content/CVPR2024/html/Weng_PARA-Drive_Parallelized_Architecture_for_Real-time_Autonomous_Driving_CVPR_2024_paper.html)
- [GenAD: Generative End-to-End Autonomous Driving — ECCV 2024](https://github.com/wzzheng/GenAD)
- [Hydra-MDP: End-to-End Driving at Scale — NVIDIA](https://developer.nvidia.com/blog/end-to-end-driving-at-scale-with-hydra-mdp/)
- [DriveVLM: Convergence of Autonomous Driving and Large Vision-Language Models](https://arxiv.org/abs/2402.12289)
- [End-to-end Autonomous Driving Survey — IEEE T-PAMI 2024](https://github.com/OpenDriveLab/End-to-end-Autonomous-Driving)
- [VLA Models Survey for Autonomous Driving](https://arxiv.org/abs/2512.16760)

### Foundation Models
- [NVIDIA Alpamayo: Open-Source AV Models and Tools](https://nvidianews.nvidia.com/news/alpamayo-autonomous-vehicle-development)
- [NVIDIA Cosmos World Foundation Models](https://www.nvidia.com/en-us/ai/cosmos/)
- [NVIDIA Cosmos Release Announcement](https://nvidianews.nvidia.com/news/nvidia-announces-major-release-of-cosmos-world-foundation-models-and-physical-ai-data-tools)
- [Waymo EMMA: End-to-End Multimodal Model for Autonomous Driving](https://arxiv.org/abs/2410.23262)
- [Waymo EMMA Blog Post](https://waymo.com/blog/2024/10/introducing-emma/)
- [Tesla FSD Architecture Evolution](https://www.thinkautonomous.ai/blog/tesla-end-to-end-deep-learning/)
- [Tesla Occupancy Networks](https://www.thinkautonomous.ai/blog/occupancy-networks/)
- [comma.ai openpilot 0.11 Release](https://blog.comma.ai/011release/)
- [comma.ai openpilot GitHub](https://github.com/commaai/openpilot)
- [Mobileye Technologies](https://www.mobileye.com/ces-2025/)
- [Aurora Driver Technology](https://aurora.tech/aurora-driver/)
- [GAIA-1: Generative World Model for Autonomous Driving — Wayve](https://arxiv.org/abs/2309.17080)
- [DriveDreamer: Real-World-Drive World Models — ECCV 2024](https://github.com/JeffWang987/DriveDreamer)

### Occupancy Prediction
- [TPVFormer — CVPR 2023](https://github.com/wzzheng/TPVFormer)
- [SurroundOcc — ICCV 2023](https://github.com/weiyithu/SurroundOcc)
- [OpenOccupancy — ICCV 2023](https://github.com/JeffWang987/OpenOccupancy)
- [Occ3D — NeurIPS 2023](https://proceedings.neurips.cc/paper_files/paper/2023/file/cabfaeecaae7d6540ee797a66f0130b0-Paper-Datasets_and_Benchmarks.pdf)
- [OccWorld: 3D World Model for Autonomous Driving — ECCV 2024](https://github.com/wzzheng/OccWorld)
- [Drive-OccWorld: 4D Occupancy Forecasting and Planning — AAAI 2025](https://github.com/yuyang-cloud/Drive-OccWorld)
- [Survey on Occupancy Perception — Information Fusion 2025](https://github.com/HuaiyuanXu/3D-Occupancy-Perception)

### Sensor Fusion
- [4D Radar Market Outlook 2026-2032](https://www.intelmarketresearch.com/d-millimeter-wave-imaging-radar-for-autonomous-driving-market-22993)
- [Multi-Sensor Fusion Review in Autonomous Driving](https://pmc.ncbi.nlm.nih.gov/articles/PMC12526605/)
- [Camera vs LiDAR Comparison](https://www.autopilotreview.com/lidar-vs-cameras-self-driving-cars/)

### Edge Computing & Deployment
- [NVIDIA Jetson Orin Platform](https://www.nvidia.com/en-us/autonomous-machines/embedded-systems/jetson-orin/)
- [NVIDIA Jetson AGX Thor](https://www.rs-online.com/designspark/new-details-on-nvidia-jetson-agx-thor-the-future-of-ai-robotics-and-edge-computing)
- [NVIDIA TensorRT SDK](https://developer.nvidia.com/tensorrt)
- [TensorRT Edge-LLM](https://developer.nvidia.com/blog/accelerating-llm-and-vlm-inference-for-automotive-and-robotics-with-nvidia-tensorrt-edge-llm)

### Airside Operations & Safety
- [FAA: Autonomous Ground Vehicle Systems on Airports](https://www.faa.gov/airports/new_entrants/agvs_on_airports)
- [EasyMile Airport Solutions](https://easymile.com/en/use-cases/freighter_cargo)
- [AeroVect — AI-Powered Airside Automation](https://www.aerovect.com/)
- [Aurrigo Auto-DollyTug](https://aurrigo.com/auto-dollytug/)
- [ISO 26262 Certification for EasyMile](https://futuretransport-news.com/iso-26262-certification-for-easymile/)
- [DO-178C Standards Overview](https://en.wikipedia.org/wiki/DO-178C)
- [Operational Design Domain Definition](https://en.wikipedia.org/wiki/Operational_design_domain)
- [Swissport and Aurrigo Zurich Airport Pilot](https://www.swissport.com/en/news/current-news/2025/swissport-and-aurrigo-launch-first-global-pilot-of-autonomous-ground-handling-solutions-at-zurich-airport)
- [dnata Autonomous Vehicles in Airport Operations](https://www.aviationpros.com/ground-support-worldwide/ground-handling/press-release/55303819/dnata-rolls-out-autonomous-vehicles-in-airport-operations)
- [DeepRoute.ai 40B VLA Foundation Model — GTC 2026](https://www.prnewswire.com/news-releases/deeprouteai-presents-40b-vision-language-action-foundation-model-at-nvidia-gtc-2026-accelerating-autonomous-driving-at-scale-302716046.html)
