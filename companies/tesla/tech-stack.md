# Tesla Full Self-Driving (FSD) / Autopilot: Comprehensive Technical Stack

**Last Updated:** March 2026

---

## Table of Contents

1. [Company Overview](#1-company-overview)
2. [Vehicle Platform](#2-vehicle-platform)
3. [Sensor Suite](#3-sensor-suite)
4. [Onboard Compute](#4-onboard-compute)
5. [Autonomy Software Stack](#5-autonomy-software-stack)
6. [Machine Learning & AI](#6-machine-learning--ai)
7. [Training Infrastructure](#7-training-infrastructure)
8. [Data Engine](#8-data-engine)
9. [Simulation Platform](#9-simulation-platform)
10. [Cloud & Data Infrastructure](#10-cloud--data-infrastructure)
11. [Programming Languages & Tools](#11-programming-languages--tools)
12. [Safety Architecture](#12-safety-architecture)
13. [Fleet Operations](#13-fleet-operations)
14. [Regulatory](#14-regulatory)
15. [Research & Publications](#15-research--publications)
16. [CyberCab](#16-cybercab)

---

## 1. Company Overview

### Organization & Leadership

Tesla's autonomous vehicle program operates under the broader Tesla AI umbrella, led by CEO Elon Musk with day-to-day technical leadership from **Ashok Elluswamy**, Vice President of AI Software. Elluswamy was the first software engineer hired for Autopilot in June 2014, recruited by Musk via Twitter in 2015. He rose to Director of Autopilot Software by May 2019 and was promoted to VP of AI Software in 2024. As of late 2025, Elluswamy's responsibilities expanded to also lead the **Optimus humanoid robot** program following the departure of Milan Kovac, creating a unified AI leadership across FSD, Optimus, and Tesla's simulation infrastructure.

Other notable figures in Tesla's AI/autonomy history include:

| Name | Role | Tenure |
|------|------|--------|
| Andrej Karpathy | Sr. Director of AI | 2017--2022 |
| Pete Bannon | VP of Hardware Engineering (FSD Chip architect) | 2016--present |
| Ganesh Venkataramanan | Director of Hardware (Dojo architect) | 2016--2023 |
| Milan Kovac | VP of Optimus | 2022--2025 |
| Stuart Bowers | VP of Engineering, Autopilot | 2017--2019 |

### FSD Timeline & Milestones

| Date | Milestone |
|------|-----------|
| Oct 2014 | Autopilot HW1 ships (Mobileye EyeQ3) on Model S |
| Oct 2016 | HW2.0 announced: 8 cameras, radar, 12 ultrasonics, NVIDIA Drive PX2 |
| Apr 2019 | HW3 (FSD Computer) unveiled at Autonomy Day; custom Tesla-designed chip |
| Jul 2020 | FSD Beta internal testing begins |
| Oct 2020 | FSD Beta limited public release |
| Aug 2021 | AI Day 1: HydraNet, BEV, Dojo D1 chip revealed |
| Sep 2022 | AI Day 2: Occupancy Networks, planning architecture detailed |
| Oct 2022 | Ultrasonic sensor removal begins (Model 3/Y) |
| Mar 2023 | HW4 (AI4) begins shipping in new vehicles |
| Nov 2023 | FSD v12 released: first end-to-end neural network stack, replacing ~300,000 lines of C++ |
| Aug 2024 | FSD v12.5 brings end-to-end to highway driving |
| Nov 2024 | FSD v13 released (HW4 only): temporal-voxel transformer model |
| Jun 2025 | Tesla Robotaxi pilot launches in Austin, TX (with safety monitors) |
| Oct 2025 | FSD v14 released: 10x larger neural network model |
| Jan 2026 | Unsupervised robotaxi rides begin in Austin (trailing safety vehicles) |
| Feb 2026 | First production CyberCab rolls off line at Giga Texas |
| Apr 2026 | CyberCab volume production begins (planned) |

---

## 2. Vehicle Platform

### Consumer Vehicles as AV Platforms

Every Tesla sold since October 2016 has shipped with hardware capable of running Autopilot and FSD software. The fleet of **9+ million vehicles** worldwide (as of early 2026) constitutes both a consumer product and a massive data-collection platform.

| Vehicle | Status | FSD Hardware | Notes |
|---------|--------|-------------|-------|
| Model S | Production (ending Q2 2026) | HW3 / HW4 (varies by build date) | Fremont factory repurposing to Optimus |
| Model 3 | Active production | HW3 (pre-2023) / HW4 (2023+) | Highest-volume FSD platform |
| Model X | Production (ending Q2 2026) | HW3 / HW4 (varies by build date) | Fremont factory repurposing |
| Model Y | Active production | HW3 (pre-2023) / HW4 (2023+) | Best-selling EV globally; robotaxi pilot vehicle |
| Cybertruck | Active production | HW4 (all units) | First vehicle with HW4-native cameras |
| CyberCab | Pre-production (Feb 2026) | AI5 (planned) | Purpose-built robotaxi, no steering wheel or pedals |

### Optimus Integration

Tesla's Optimus humanoid robot shares foundational AI architecture with FSD:

- Same **end-to-end neural network** paradigm (cameras in, actions out)
- Same **occupancy networks** for 3D spatial understanding
- Same **training infrastructure** (Cortex GPU clusters)
- Same **world simulator** for closed-loop training
- Runs adapted FSD neural networks optimized for bipedal navigation and manipulation
- Integrates **xAI's Grok** LLM for conversational AI (language), while FSD-derived nets handle movement
- V3 prototype unveiling planned Q1 2026; 50,000 units targeted by 2026
- Fremont Model S/X lines being repurposed for Optimus manufacturing

---

## 3. Sensor Suite

### Philosophy: Camera-Only "Tesla Vision"

Tesla is the only major AV company pursuing a **pure-vision approach** with no LiDAR and (since 2021--2023) no radar or ultrasonic sensors. The rationale, as articulated by Musk and Karpathy, is that human driving is solved with vision alone, so a sufficiently capable neural network should be able to do the same with cameras.

### Sensor Removal Timeline

| Sensor Type | Removal Start | Models Affected | Replacement |
|-------------|--------------|-----------------|-------------|
| Front radar | May 2021 | Model 3/Y first, then S/X (2022) | Tesla Vision (camera-only) |
| Ultrasonic sensors (12x) | Oct 2022 | Model 3/Y (NA, Europe, ME, Taiwan) | Vision-based occupancy network |
| Ultrasonic sensors (12x) | 2023 | Model S/X (all markets) | Vision-based occupancy network |

### Camera Specifications

#### HW3 Camera System (8 external + 1 cabin)

| Camera Position | Count | Resolution | FOV | Max Range | Sensor |
|----------------|-------|------------|-----|-----------|--------|
| Narrow forward (windshield) | 1 | 1280 x 960 (1.2 MP) | ~35 deg | 250 m | ON Semi / Aptina |
| Main forward (windshield) | 1 | 1280 x 960 (1.2 MP) | ~50 deg | 150 m | ON Semi / Aptina |
| Wide forward (windshield) | 1 | 1280 x 960 (1.2 MP) | ~150 deg | 60 m | ON Semi / Aptina |
| B-pillar (left) | 1 | 1280 x 960 (1.2 MP) | ~90 deg | 80 m | ON Semi / Aptina |
| B-pillar (right) | 1 | 1280 x 960 (1.2 MP) | ~90 deg | 80 m | ON Semi / Aptina |
| Side repeater (left fender) | 1 | 1280 x 960 (1.2 MP) | ~90 deg | 80 m | ON Semi / Aptina |
| Side repeater (right fender) | 1 | 1280 x 960 (1.2 MP) | ~90 deg | 80 m | ON Semi / Aptina |
| Rear (above license plate) | 1 | 1280 x 960 (1.2 MP) | ~130 deg | 50 m | ON Semi / Aptina |
| Cabin (above rearview mirror) | 1 | -- | -- | -- | IR-capable |

#### HW4 (AI4) Camera System

| Camera Position | Count | Resolution | FOV | Sensor |
|----------------|-------|------------|-----|--------|
| Forward cameras (windshield) | 2 active + 1 dummy | 2896 x 1876 (5.4 MP) | Wide + Main | Sony IMX490 / IMX963 |
| B-pillar (left/right) | 2 | 2896 x 1876 (5.4 MP) | ~90 deg | Sony IMX490 |
| C-pillar (left/right) -- new position | 2 | 2896 x 1876 (5.4 MP) | ~90 deg | Sony IMX490 |
| Rear | 1 | 2896 x 1876 (5.4 MP) | Wide fish-eye | Sony IMX490 |
| Cabin | 1 | -- | -- | IR + visible |

Key HW3 vs. HW4 camera differences:
- Resolution jumps from **1.2 MP to 5.4 MP** (4.5x increase)
- Red-tinted lenses on HW4 for improved HDR and low-light performance
- C-pillar cameras are a new position (replacing fender-mounted repeaters on some models)
- HW4 supports up to 13 camera inputs (future-proofing)
- 2025 updates added **front bumper cameras** across the lineup

---

## 4. Onboard Compute

### Hardware Generations

| Generation | Chip | Process | Year | Designed By | Fab |
|-----------|------|---------|------|------------|-----|
| HW1 | Mobileye EyeQ3 | 40 nm | 2014 | Mobileye | STMicro |
| HW2 / HW2.5 | NVIDIA Drive PX2 (Parker SoC) | 16 nm | 2016 / 2017 | NVIDIA | TSMC |
| HW3 | Tesla FSD Chip | 14 nm | 2019 | Tesla (Pete Bannon) | Samsung |
| HW4 (AI4) | Tesla FSD Chip 2 | 7 nm | 2023 | Tesla | Samsung |
| AI5 | Tesla AI5 | 5 nm (est.) | 2026 (late) | Tesla | TSMC (initial), Samsung |
| AI6 | Tesla AI6 | 3 nm (est.) | 2027+ | Tesla | Samsung (Austin, TX fab) |

### HW3 -- FSD Computer (Detailed Specs)

| Parameter | Specification |
|-----------|--------------|
| **SoC** | Tesla FSD Chip (dual-chip, redundant) |
| **Process** | Samsung 14 nm FinFET |
| **Die Size** | 260 mm^2 |
| **Transistors** | 6 billion |
| **CPU** | 3x quad-core ARM Cortex-A72 clusters (12 cores total) @ 2.2--2.6 GHz |
| **GPU** | ARM Mali G71 MP12 @ 1 GHz |
| **NPU** | 2x neural processing units (systolic arrays) @ 2 GHz |
| **NPU Performance** | 36 TOPS per NPU, 72 TOPS per chip, **144 TOPS** total (dual chip) |
| **Frames/sec** | 2,300 FPS processing capacity |
| **RAM** | 8 GB LPDDR4 (68 GB/s peak bandwidth) |
| **Storage** | 64 GB eMMC |
| **Power** | ~72 W |
| **Redundancy** | Dual FSD Chips; both compute same data, compare outputs |

### HW4 (AI4) -- FSD Computer 2 (Detailed Specs)

| Parameter | Specification |
|-----------|--------------|
| **SoC** | Tesla FSD Chip 2 (dual-chip) |
| **Process** | Samsung 7 nm |
| **CPU** | 20 cores per side @ 2.35 GHz (max), 1.37 GHz (idle) |
| **NPU** | 3x neural processing units per chip @ 2.2 GHz |
| **NPU Performance** | ~50 TOPS per NPU, **~121 TOPS** per chip |
| **Overall Performance** | 3--8x faster than HW3 (per Musk) |
| **RAM** | 16 GB Micron GDDR6 @ 14 Gbps on 128-bit bus (224 GB/s) |
| **Storage** | 256 GB NVMe |
| **Camera Inputs** | Up to 13 camera streams |
| **Redundancy** | Dual-node architecture with cross-comparison |

### AI5 / AI6 -- Next-Generation Chips

| Parameter | AI5 | AI6 |
|-----------|-----|-----|
| **Foundry** | TSMC (Taiwan/Arizona) | Samsung (Austin, TX) |
| **Status** | Design complete, tape-out pending | In development |
| **Production** | Late 2026 (small batch), 2027 (volume) | ~2027--2028 |
| **Architecture** | Inference + training capable | Integrates Dojo supercomputer chip architecture |
| **Target Applications** | FSD, Optimus, CyberCab | FSD, Optimus, training |
| **Contract Value** | -- | $16.5 billion (Samsung deal) |
| **Performance Target** | Significant leap over AI4 | ~2x AI5 performance |

### Dojo D1 Chip (Training)

| Parameter | Specification |
|-----------|--------------|
| **Process** | TSMC 7 nm |
| **Transistors** | 50 billion |
| **Die Size** | 645 mm^2 |
| **Cores** | 354 specialized ML cores |
| **FP32 Performance** | 22.6 TFLOPS |
| **BF16/CFP8 Performance** | 362 TFLOPS |
| **TDP** | 400 W |
| **ISA** | Custom ML-focused instruction set |
| **On-Chip SRAM** | -- |
| **I/O Bandwidth** | 2x bandwidth of state-of-the-art networking switch chips |

---

## 5. Autonomy Software Stack

### Architecture Evolution

Tesla's autonomy stack has undergone three major architectural phases:

```
Phase 1 (2016--2021): Modular Pipeline
  Camera Images -> Per-Camera CNNs -> Object Detection + Lane Lines ->
  HD Map Lookup -> Rule-Based Planner -> PID Controller -> Vehicle Controls

Phase 2 (2021--2023): BEV + Occupancy + Hybrid Planner
  Multi-Camera Images -> Shared Backbone (RegNet) -> BEV Transformer ->
  Occupancy Network (3D voxels) + Lane Network + Object Network ->
  Monte-Carlo Tree Search + Neural Network Planner -> Vehicle Controls

Phase 3 (2023--present): End-to-End Neural Network
  Multi-Camera Video (8 cams x N frames) -> Vision Transformer ->
  Learned World Model -> Neural Network Planner -> Vehicle Controls
  (single unified model, ~2,000--3,000 lines of glue code)
```

### Phase 2: HydraNet + Occupancy (2021--2023)

**HydraNet** was Tesla's multi-task learning architecture introduced at AI Day 2021:

- Single shared **backbone** (RegNet-based) processes all 8 camera feeds
- **Multi-scale feature extraction** at multiple resolutions
- Shared features fed into task-specific **decoder heads**:
  - Object detection (3D bounding boxes)
  - Semantic segmentation
  - Lane line detection and topology
  - Drivable space estimation
  - Traffic light / sign classification
  - Depth estimation (monocular)
  - Velocity estimation
- A full build involved **48 neural networks** producing **1,000 distinct output tensors** per timestep

**Bird's Eye View (BEV) Transformer:**
- Transforms multi-camera 2D image features into a unified top-down spatial representation
- Uses attention mechanisms to handle the camera-to-BEV projection
- Enables reasoning about spatial relationships without explicit 3D geometry

**Occupancy Network** (introduced at AI Day 2022):
- Predicts a dense **3D voxel grid** around the vehicle
- Each voxel classified as occupied/free + semantic class
- Outputs **Occupancy Volume** (what's free vs. occupied) and **Occupancy Flow** (velocity of occupied voxels)
- Uses **Signed Distance Fields (SDF)** rather than binary occupancy for smoother geometry
- Replaced the need for explicit object detection for many safety-critical decisions
- Runs at >100 FPS; memory-efficient implementation

**Planning** (Phase 2):
- **Monte-Carlo Tree Search (MCTS)** + neural network evaluator
- The neural network scores candidate trajectories
- MCTS explores the trajectory tree to select optimal path
- Integrated occupancy and lane graph as inputs

### Phase 3: End-to-End (FSD v12+)

Starting with FSD v12 (November 2023), Tesla replaced the modular stack with a single end-to-end neural network:

- **Input:** Raw pixel data from 8 cameras (multi-frame video)
- **Output:** Steering angle, acceleration, braking commands
- Replaced approximately **300,000 lines of C++ code** with neural networks
- Remaining code: ~2,000--3,000 lines for network activation, safety monitors, and vehicle interface
- Training data: **10+ million driving video clips** from fleet
- Training compute: **70,000 GPU-hours** per full training cycle
- Data volume: **1.5+ petabytes** of driving data per training run

### FSD Version Architecture Progression

| Version | Release | Key Architecture Change |
|---------|---------|----------------------|
| v12 | Nov 2023 | First end-to-end; replaces C++ planner with neural net |
| v12.4 | Jun 2024 | Camera-based driver monitoring; improved E2E model |
| v12.5 | Aug 2024 | End-to-end extended to highway driving; larger model |
| v13 | Nov 2024 | Temporal-voxel transformer; 10-second recursive video buffer; HW4 only |
| v13.3 | 2025 | Single large Vision Transformer for entire pipeline |
| v14 | Oct 2025 | 10x larger neural network; mixture-of-experts architecture |
| v14.2 | Nov 2025 | Refinements; 95% reduction in hesitant behaviors |

---

## 6. Machine Learning & AI

### End-to-End Transformer Architecture

FSD v13+ uses a **Vision Transformer (ViT)** based architecture:

- **Input Tokenization:** Raw image patches from 8 cameras are converted to tokens
- **Multi-Head Self-Attention:** Spatial and cross-camera attention mechanisms
- **Temporal Attention:** Recursive buffer of last **10 seconds of video** data
- **BEV Projection:** Learned transformation from multi-view image tokens to bird's-eye-view representation
- **Decoder:** Outputs control actions (steering, throttle, brake) directly

FSD v14 introduces a **Mixture-of-Experts (MoE)** architecture:
- Only relevant expert sub-modules activated per inference step
- Reduces computational load despite 10x parameter increase
- Enables richer video processing with less compression

### Occupancy Networks (3D Voxel Predictions)

Technical details of the occupancy prediction system:

- **Input:** Multi-camera features projected to 3D via learned BEV transform
- **Output:** Dense 3D voxel grid covering surrounding environment
- **Voxel Resolution:** Increased 8x from initial version (v13+)
- **Prediction Types:**
  - Occupancy Volume: probability of each voxel being occupied
  - Occupancy Flow: predicted velocity vector for each occupied voxel
  - Semantic Labels: road surface, vehicle, pedestrian, static obstacle, etc.
- **Signed Distance Field (SDF):** Continuous distance-to-surface prediction (smoother than binary voxels)
- **Temporal Persistence:** Vehicle maintains permanent 3D "Voxel Map" from recent observations
  - Tracks objects even when temporarily occluded (e.g., pedestrian behind parked car)
  - Remembers trajectory and velocity of occluded agents

### Multi-Trip Aggregation

- Fleet vehicles record data from multiple trips through the same location
- Offline pipeline aggregates observations across trips to build rich 3D representations
- Moving objects are identified by their temporal inconsistency across trips
- Static map elements are refined with each additional pass

### Imitation Learning

- **Behavioral Cloning:** Neural network trained to replicate expert human driving behavior
- Training data: millions of hours of human driving from Tesla fleet
- FSD v12 initial approach: large-scale imitation from **10 million driving video clips**
- The model learns the mapping from visual input to control output by observing human demonstrations
- Augmented with reinforcement learning for safety-critical and edge-case scenarios

### Reinforcement Learning

- Used to optimize behavior in rare, complex, or safety-critical scenarios
- **Reward mechanism:** evaluates resulting actions
  - Positive reward: safe navigation around obstacles, smooth lane changes
  - Negative reward: traffic violations, uncomfortable maneuvers, unsafe proximity
- Applied on top of imitation-learned base policy
- FSD v14+ incorporates "advanced reasoning and reinforcement learning"

### Photorealistic Neural Rendering

Tesla uses **Generative Gaussian Splatting** for 3D scene understanding:
- Operates in hundreds of milliseconds
- Allows the AI to "imagine" and explain the 3D geometry of its environment
- Works even when the vehicle deviates from its original path
- Used both for visualization and for training data augmentation

### BEV Transformers

The BEV (Bird's Eye View) transformer pipeline:

1. **Feature Extraction:** Per-camera backbone extracts multi-scale image features
2. **Camera-to-BEV Projection:** Learned spatial transformer maps 2D features to 3D BEV space
3. **Multi-Scale Fusion:** Features from different cameras and scales are fused via transformer attention
4. **Temporal Fusion:** Current BEV features are combined with historical BEV features
5. **Task Heads:** BEV features are decoded into occupancy, lanes, objects, and drivable space

---

## 7. Training Infrastructure

### Dojo Supercomputer

| Component | Specification |
|-----------|--------------|
| **Basic Unit** | D1 Chip (354 ML cores, 7 nm, 645 mm^2, 50B transistors) |
| **Training Tile** | 25 D1 chips per tile |
| **Tile Performance** | 9 PFLOPS (BF16/CFP8) |
| **Tile Bandwidth** | 36 TB/s |
| **Tile SRAM** | Self-contained with power, cooling, networking |
| **Cabinet** | Multiple tiles per cabinet |
| **ExaPOD** | 10 cabinets, 120 tiles, 3,000 D1 chips |
| **ExaPOD Cores** | 1,062,000 usable cores |
| **ExaPOD Performance** | 1.1 EXAFLOPS (BF16/CFP8) |
| **ExaPOD SRAM** | 1.3 TB on-tile SRAM |
| **ExaPOD HBM** | 13 TB dual-inline HBM |
| **Software Stack** | Custom compiler (no kernels); PyTorch frontend with compiled intermediate layer |
| **Data Formats** | Wide variety of composable precisions; up to 16 vector formats simultaneously |

**Dojo Status (as of March 2026):**
- Dojo 1 project **disbanded** in August 2025 (Bloomberg)
- Cited reasons: too expensive, too complex, insufficient strategic benefit vs. NVIDIA GPUs
- Musk announced **Dojo 2 restart** in January 2026 with new chip iteration
- Dojo 2 target: "operating at scale" in 2026, "somewhere around 100k H100 equivalent"
- Architecture pivot: unified chip for both inference and training (AI5/AI6)

### NVIDIA GPU Clusters

#### Cortex (Giga Texas)

| Parameter | Specification |
|-----------|--------------|
| **Location** | Gigafactory Texas, Austin |
| **GPUs** | 50,000 NVIDIA H100 + 20,000 Tesla proprietary hardware |
| **Status** | Operational Q4 2024 |
| **Power** | 130 MW at launch, expanding to 500 MW |
| **Purpose** | FSD training, Optimus training, AI research |
| **Cost** | ~$300 million initial deployment |
| **Performance** | 1.8+ EXAFLOPS (combined with other clusters) |

#### Cortex 2 (Giga Texas)

| Parameter | Specification |
|-----------|--------------|
| **Location** | Gigafactory Texas, Austin |
| **GPUs** | ~100,000 NVIDIA H100/H200 |
| **Phase 1** | 250 MW, activating April 2026 |
| **Full Capacity** | 500 MW, expected mid-2026 |
| **Energy Storage** | Tesla Megapacks for grid stabilization |
| **Purpose** | Primarily Optimus training; also FSD |

#### Other GPU Clusters

| Cluster | GPUs | Location | Notes |
|---------|------|----------|-------|
| Palo Alto cluster | 10,000 NVIDIA GPUs | Palo Alto, CA | Operational by 2024 |
| Planned ExaPODs | 7 Dojo ExaPODs | Palo Alto | ~8.8 EXAFLOPS target (pre-disbandment) |
| xAI Memphis (Colossus) | 100,000+ H100/H200 | Memphis, TN | Shared infrastructure with xAI; 2.3 GWh Megapack storage |

### Training Scale Summary

| Metric | Value |
|--------|-------|
| Total NVIDIA GPUs (estimated) | 150,000--200,000+ H100/H200 |
| Combined compute | ~1.8+ EXAFLOPS |
| Target training compute (end of 2025) | 100 EFLOPS (100E) |
| Training cycle (full FSD build) | 70,000 GPU-hours |
| Data per training run | 1.5+ petabytes |
| Training iteration speed | Multiple model iterations per week |

---

## 8. Data Engine

### Overview

Tesla's Data Engine is a closed-loop system that continuously identifies weaknesses in the neural networks, collects relevant data from the fleet, labels it, retrains the model, deploys it, and repeats.

```
Fleet Vehicles -> Shadow Mode / Triggers -> Data Upload ->
Auto-Labeling Pipeline -> Training -> Model Validation ->
OTA Deployment -> Fleet Vehicles (repeat)
```

### Fleet Data Collection

| Metric | Value |
|--------|-------|
| Fleet Size | 9+ million vehicles worldwide |
| FSD Subscribers/Purchasers | 1.1 million (Q4 2025) |
| Data Collection | All Tesla vehicles (not just FSD users) |
| Collection Mechanism | Shadow Mode, hard triggers, soft triggers |
| Robotaxi Paid Miles | ~700,000 (as of Dec 2025) |

### Shadow Mode

- Runs the FSD neural network stack **in the background** on all Tesla vehicles
- Compares the system's predicted action with the human driver's actual action
- When predictions diverge ("disagreement events"), the scenario is flagged
- Flagged clips are uploaded to Tesla's servers for analysis
- Operates silently without affecting vehicle behavior or driver experience
- Effectively turns millions of vehicles into a passive data-gathering network

### Trigger-Based Collection

| Trigger Type | Description | Example |
|-------------|-------------|---------|
| **Hard Clips** | Human driver intervenes unexpectedly | AEB activation, sudden steering correction |
| **Soft Clips** | Model prediction deviates from human action | Predicted lane change vs. human stays in lane |
| **Shadow Disagreement** | Background FSD disagrees with human | Different steering angle prediction |
| **Scenario-Based** | Targeted collection for specific situations | Unprotected left turns, construction zones |
| **Edge Case Mining** | Rare events identified by analysis | Unusual road geometry, rare objects |

### Auto-Labeling Pipeline

The auto-labeling pipeline processes data offline in Tesla's data centers:

1. **Raw Data Ingestion:** 45-second to 1-minute video clips with IMU, GPS, and odometry data
2. **Offline Neural Network Processing:** Networks run with access to past AND future frames (unlike real-time), producing "perfect" labels
3. **4D Vector Space Reconstruction:**
   - Multi-camera video fused into 3D point clouds
   - Multiple frames combined for temporal consistency
   - Labeling in 4D vector space (3D + time) is **100x more efficient** than per-image labeling
4. **Multi-Trip Aggregation:** Data from multiple fleet vehicles passing through the same location is combined to create rich 3D scene reconstructions
5. **Moving Object Identification:** Temporal inconsistencies reveal dynamic objects; trajectories and kinematics are tracked
6. **Human Verification:** Auto-generated labels are spot-checked by human labelers for quality assurance
7. **Output:** Rich labels including road surface, static objects, dynamic object kinematics (even occluded objects), lane topology, and semantic segmentation

### Clip Mining

- Active learning system identifies the most informative training examples
- Searches fleet data for scenarios similar to known failure modes
- Prioritizes rare, safety-critical situations that are underrepresented in training data
- Examples: unusual intersection geometry, rare weather conditions, novel obstacle types

---

## 9. Simulation Platform

### Neural World Simulator

Tesla has developed a **generative neural world simulator** for training and validating FSD and Optimus AI:

| Feature | Specification |
|---------|--------------|
| **Architecture** | Generative model predicting next video frame based on current state + action |
| **Frame Rate** | Optimized to run at 36 Hz |
| **Training Data** | Fleet driving data ("Niagara Falls of data") |
| **Output** | Photorealistic multi-view video (8 cameras) |
| **Fidelity** | "Indistinguishable from reality" per Tesla |
| **3D Engine** | Generative Gaussian Splatting (operates in hundreds of ms) |

### Capabilities

- **Closed-Loop Simulation:** AI agent drives in the simulator; world responds to agent's actions
- **Scenario Injection:**
  - Drop in pedestrians, vehicles, or obstacles
  - Add fog, rain, glare, or other weather conditions
  - Trigger sudden lane changes or unexpected behaviors
  - Replay historical failure cases
  - Generate adversarial scenarios
- **Scale:** Equivalent of 500 years of human driving experience trainable in one day
- **3D World Generation:** Real-time drivable 3D environments constructed from fleet camera footage
  - Engineers can virtually "drive" inside fully simulated real-world locations
  - All 8 camera views are generated simultaneously
- **Validation:** New model versions evaluated in simulation before fleet deployment
- **Optimus Integration:** Same simulator generates realistic video of Optimus robot actions (walking, turning, manipulation) for robot AI training

### Procedural World Generation

- Combines fleet-captured real-world data with procedural variation
- Road topology, lane markings, traffic patterns can be varied programmatically
- Enables testing on road configurations not yet encountered in fleet data
- Construction zones, new intersections, and novel road furniture can be synthesized

---

## 10. Cloud & Data Infrastructure

### Data Center Locations

| Location | Purpose | Scale |
|----------|---------|-------|
| Gigafactory Texas (Austin) | Cortex + Cortex 2 GPU clusters, Dojo | 50,000--100,000+ GPUs; 130--500 MW |
| Palo Alto, CA | GPU training cluster, Dojo ExaPODs (planned) | 10,000 GPUs; 7 ExaPODs planned |
| Memphis, TN (xAI/shared) | Colossus GPU cluster | 100,000+ H100/H200; 2.3 GWh Megapack storage |

### Scale of Compute

| Metric | Value |
|--------|-------|
| Total GPU Count (est.) | 150,000--200,000+ |
| Combined Training Performance | 1.8+ EXAFLOPS |
| Current Power Capacity | ~130 MW (Cortex 1) |
| Planned Power Capacity | 500 MW (Cortex 2 full build) |
| Data Processed | Petabytes per training cycle |
| Bandwidth Requirements | Dedicated 50 MW substations with power conditioning |

### Energy & Sustainability

- Waste heat recovery at Giga Texas data centers for adjacent industrial operations
- ~1 GW of wind/solar capacity secured through long-term PPAs across NA and Europe
- Tesla Megapacks deployed for grid stabilization at data center sites
- Closed-loop AI systems for energy optimization across facilities
- Autonomous algorithms optimize data center energy consumption in real-time

### In-House vs. Cloud

Tesla runs nearly all AI training on **in-house infrastructure**, rather than cloud providers:
- Full ownership of hardware, networking, and software stack
- Custom compiler for Dojo; custom orchestration for GPU clusters
- No dependency on AWS, Azure, or GCP for core training workloads
- xAI Memphis facility represents shared infrastructure between Tesla and Musk's xAI

---

## 11. Programming Languages & Tools

### Primary Languages

| Language | Use Case | Notes |
|----------|----------|-------|
| **Python** | ML model development, training pipelines, data preprocessing, prototyping | Primary language for AI research; PyTorch frontend |
| **C++** | Real-time vehicle software, sensor fusion, safety-critical systems, control algorithms | On-vehicle inference runtime; latency-critical paths |
| **C** | Low-level hardware drivers, embedded systems | Direct hardware interface layer |
| **Java** | Backend systems, cloud infrastructure, data aggregation | Server-side services |

### ML Frameworks & Tools

| Tool | Usage |
|------|-------|
| **PyTorch** | Primary ML framework; most-used external library at Tesla |
| **Custom Dojo Compiler** | Translates PyTorch models to Dojo D1 ISA; compiler-first architecture (no kernels) |
| **TensorRT** (likely) | NVIDIA inference optimization for GPU clusters |
| **Custom Inference Engine** | Optimized C++/C runtime for on-vehicle FSD chip inference |
| **CUDA** | GPU kernel development for training |

### Development Workflow

1. **Research & Prototyping:** Python + PyTorch for rapid iteration on model architectures
2. **Training:** PyTorch models trained on Cortex GPU clusters (or Dojo via custom compiler)
3. **Model Export:** Trained models converted to optimized inference format
4. **On-Vehicle Deployment:** Models compiled to run on FSD Chip (HW3/HW4) hardware
   - Automatic conversion from Python to C/C++/raw metal driver code
   - Quantization and optimization for NPU systolic arrays
5. **OTA Update:** Models deployed to fleet via over-the-air software updates

### Dojo Custom Compiler

- **Design Philosophy:** Compiler-first, no kernels
- PyTorch serves as the frontend interface
- Custom intermediate layer handles parallelization and hardware mapping
- Supports dynamic composition of up to **16 vector formats** simultaneously
- Handles the D1 chip's custom ML-focused ISA
- Optimizes across the unique D1 tile interconnect topology

---

## 12. Safety Architecture

### Driver Monitoring System (DMS)

| Feature | Implementation |
|---------|---------------|
| **Cabin Camera** | IR-capable camera above rearview mirror |
| **Eye Tracking** | Monitors driver gaze direction and attentiveness |
| **Hand Detection** | Checks for handheld devices (phones); flags anything in hands |
| **Steering Wheel Torque** | Detects hands-on-wheel via capacitive sensor |
| **Escalation Ladder** | Visual alerts -> audible chimes -> speed reduction -> hazard lights + pullover |
| **Fallback** | If camera blocked/dim/sunglasses/hat, system falls back to steering wheel torque check |

**Recent DMS Changes:**
- FSD v12.4 introduced camera-based attention monitoring (replacing torque-only)
- FSD v13.2.9 loosened camera nag frequency (after user complaints)
- Musk acknowledged DMS can be "too strict" (Q1 2025 earnings call)
- IR LEDs enable night-time eye tracking

### Operational Design Domain (ODD) Limitations

Tesla FSD (Supervised) is classified as an **SAE Level 2+ ADAS** system. Known limitations:

| Limitation Category | Examples |
|--------------------|---------|
| **Weather** | Heavy rain, snow, dense fog, extreme sun glare |
| **Road Conditions** | Unusual lane markings, construction zones, unpaved roads |
| **Lighting** | Very low light, direct sun into cameras |
| **Scenarios** | Complex uncontrolled intersections, emergency vehicles, hand signals from traffic police |
| **Geographic** | Unmapped areas, regions with non-standard signage |
| **Infrastructure** | Missing or contradictory road markings, unusual traffic signals |

### Safety Statistics (Published by Tesla)

**Q2 2025 Vehicle Safety Report:**

| Metric | With Autopilot | Without Autopilot | NHTSA Average (US) |
|--------|---------------|-------------------|-------------------|
| Miles per crash | 6.69 million | 963,000 | 702,000 |
| Safety multiplier vs. average | ~9.5x safer | ~1.4x safer | Baseline |

**FSD (Supervised) Safety Data (Nov 2025):**

| Metric | FSD (Supervised) | NHTSA US Average |
|--------|-----------------|-----------------|
| Miles per major collision | 2.9 million | 505,000 |
| Miles per minor collision | 986,000 | 178,000 |

**Important Caveats** (noted by safety researchers):
- Tesla compares new vehicles with modern safety features against the entire US fleet (including older cars)
- Most Autopilot miles are highway driving (inherently safer than urban)
- National statistics include all road types, weather conditions, and driver demographics
- Methodology has been questioned by NHTSA, Consumer Reports, and independent researchers

### Hardware Redundancy

- HW3/HW4: Dual FSD chips compute the same data independently and compare outputs
- Disagreement triggers fallback to conservative behavior
- Dual power rails and independent camera data paths
- Vehicle can continue basic operation if one chip fails

---

## 13. Fleet Operations

### FSD Supervised vs. Unsupervised

| Mode | Description | Status |
|------|-------------|--------|
| **FSD (Supervised)** | Driver must remain attentive and ready to take over at all times; hands-on-wheel required | Generally available in US; expanding globally |
| **FSD (Unsupervised)** | No human driver required; vehicle operates autonomously | Limited testing in Austin, TX (Jan 2026+) |

### FSD Adoption

| Metric | Value (Q4 2025) |
|--------|-----------------|
| Active FSD subscriptions/purchases | 1.1 million |
| Fleet penetration rate | ~12.4% of 8.9M total deliveries |
| Upfront purchases (lifetime) | ~770,000 (~70% of total) |
| Monthly subscribers | ~330,000 (~30% of total) |
| Year-over-year growth | 38% (from 800K in 2024) |

### Robotaxi Operations (Austin Pilot)

| Parameter | Detail |
|-----------|--------|
| **Launch Date** | June 2025 (with safety monitors) |
| **Unsupervised Start** | January 2026 (with trailing safety vehicles) |
| **Vehicle** | Model Y (HW4) |
| **Fleet Size** | ~135 robotaxis (Dec 2025) |
| **Paid Miles Logged** | ~700,000 (as of Dec 2025) |
| **Fare** | $4.20 flat fare |
| **Software** | FSD Unsupervised |
| **Safety Protocol** | Trailing black Tesla vehicles with remote safety monitors |

### Planned Expansion

| Timeline | Markets |
|----------|---------|
| H1 2026 | 7 additional US cities (planned) |
| 2026 | Nevada, Florida, Arizona |
| 2026 | Miami, Dallas, Phoenix, Las Vegas |
| Late 2026 / Early 2027 | Select European countries, pending regulatory approval |
| 2026+ | China (pending Feb 2026 approvals) |

### Business Model Evolution

- Transitioning from one-time FSD purchase ($12,000--$15,000) to monthly subscription ($99--$199/month)
- Robotaxi revenue model: per-ride fares (Tesla takes a platform cut)
- Fleet owners may operate their own Teslas as robotaxis (revenue-sharing model announced)
- CyberCab units will be Tesla-owned fleet vehicles

---

## 14. Regulatory

### NHTSA Investigations

| Date | Investigation | Scope | Status |
|------|--------------|-------|--------|
| Oct 2024 | PE24-020 | FSD safety in low-visibility conditions (fog, extreme sunlight) | Open |
| Oct 2025 | PE25-012 | FSD traffic violations (red light running, wrong-lane driving) | Open; expanded |
| Aug 2025 | Crash Reporting | Tesla reporting FSD/Autopilot crashes months late (violating SGO) | Under review |

**Key Findings (PE25-012):**
- 80 FSD traffic violations identified (up from initial 50)
- 62 customer complaints, 14 Tesla-submitted reports, 4 media accounts
- 44 separate incidents, including 3 crashes and 5 injuries
- 2,882,566 vehicles covered by investigation
- Tesla granted extension for response in January 2026

### Major Recalls

| Date | Recall | Vehicles | Issue | Resolution |
|------|--------|----------|-------|------------|
| Feb 2022 | Rolling Stop | ~54,000 | FSD Beta allowed rolling through stop signs | OTA update disabled feature |
| Feb 2023 | FSD Beta 23V-085 | 362,000 | Exceeding speed limits, unpredictable intersection behavior | OTA software update |
| Dec 2023 | Autopilot DMS | 2+ million | Deficient driver monitoring system; use outside ODD | OTA software update |
| Various | Multiple OTA | 700,000+ | Various safety-related software updates | OTA patches |

### Regulatory Approach

| Jurisdiction | Status | Key Issues |
|-------------|--------|------------|
| **Federal (NHTSA)** | Active investigations; moving toward national AV framework | SELF DRIVE Act of 2026 would preempt state restrictions |
| **California DMV** | Dec 2025 ruling: deceptive marketing (Autopilot/FSD naming) | 60-day compliance window; threatened 30-day dealer license suspension across 70+ locations |
| **Texas** | Permissive; Austin robotaxi pilot approved | No autonomous vehicle permit required for supervised testing |
| **Nevada/Florida/Arizona** | Favorable regulatory environment | Planned robotaxi expansion markets |
| **Europe** | Pending approvals (Feb 2026) | Varying technical compliance requirements by country |
| **China** | Pending approvals (Feb 2026) | Data localization requirements; mapping restrictions |

### SAE Level Classification

Tesla officially classifies FSD (Supervised) as **Level 2** ADAS, requiring constant driver supervision. However:
- The "Full Self-Driving" naming has been found misleading by California DMV
- Consumer Reports and NHTSA have raised concerns about the gap between marketing and capability
- Unsupervised robotaxi operation in Austin represents a functional shift toward Level 4 in a limited ODD

---

## 15. Research & Publications

### AI Day Presentations

| Event | Date | Key Reveals |
|-------|------|-------------|
| **Autonomy Day** | Apr 2019 | HW3 FSD Chip architecture; custom silicon strategy; 144 TOPS |
| **AI Day 2021** | Aug 2021 | HydraNet multi-task architecture; BEV transformers; Dojo D1 chip; Training Tile; ExaPOD; Tesla Bot announcement |
| **AI Day 2022** | Sep 2022 | Occupancy Networks (3D voxel predictions); occupancy flow; planning architecture (MCTS + NN); Optimus prototype; Dojo progress |

### Key Technical Talks & Presentations

| Speaker | Event | Date | Topic |
|---------|-------|------|-------|
| Andrej Karpathy | CVPR 2021 Workshop | Jun 2021 | Tesla's vision-only approach; data engine |
| Andrej Karpathy | CVPR 2022 Workshop | Jun 2022 | Scaling training data; auto-labeling |
| Ashok Elluswamy | ICCV 2024 | Oct 2024 | End-to-end FSD architecture; "billions of tokens"; world simulator |
| Ashok Elluswamy | Various 2025 | 2025 | Neural world simulator; unified FSD + Optimus architecture; Gaussian Splatting |

### Patents (Selected)

Tesla holds numerous patents related to autonomous driving. Key areas include:

| Patent Area | Description |
|-------------|-------------|
| Occupancy prediction | 3D voxel grid prediction from camera inputs |
| SDF-based rendering | Signed Distance Field methods for high-quality 3D scene representation |
| FSD visualizations | Advanced rendering of FSD perception for driver display |
| Multi-modal AI fusion | Integrating multiple data sources for driving decisions |
| Auto-labeling | Automated data labeling from fleet data |
| Neural network inference | Optimized on-chip inference for custom silicon |
| Inductive charging | Wireless charging for autonomous vehicles |

### Research Philosophy

Tesla does not publish peer-reviewed papers in the traditional academic sense. Instead:
- Technical details are shared via AI Day presentations and shareholder meetings
- Ashok Elluswamy has increased public technical communication via social media and conferences (ICCV, etc.)
- Tesla's approach is described as following "The Bitter Lesson" (Rich Sutton): scale compute and data, use general methods
- Close collaboration between Tesla AI and xAI (Musk's AI research company)

---

## 16. CyberCab

### Purpose-Built Robotaxi Specifications

| Parameter | Specification |
|-----------|--------------|
| **Type** | Purpose-built Level 4 autonomous robotaxi |
| **Passengers** | 2 (two seats) |
| **Doors** | Dual butterfly (upward-opening, automatic) |
| **Steering Wheel** | None |
| **Pedals** | None |
| **Display** | 20.5-inch center screen |
| **Interior** | Vegan leather seats, ambient lighting |
| **Weight** | < 1,150 kg |
| **Dimensions (est.)** | Length: 3.55 m, Wheelbase: 2.29 m, Height: 1.14 m |
| **Tires** | 225/60/R21 (rear) |

### Powertrain & Charging

| Parameter | Specification |
|-----------|--------------|
| **Battery Capacity** | 35 kWh (< 50 kWh pack) |
| **Range** | 200 mi (320 km) |
| **Efficiency** | 5.5 mi/kWh (8.9 km/kWh) -- highest of any EV |
| **Charging** | Inductive (wireless) -- primary |
| **Inductive Power** | 22 kW continuous; up to 150 kW pad supported |
| **Inductive Efficiency** | > 90% |
| **Full Charge Time** | 30--40 minutes (150 kW pad) |

### Compute & Sensors

| Parameter | Specification |
|-----------|--------------|
| **Compute Platform** | AI5 chip (planned) |
| **Cameras** | Multiple (exact count TBD); same architecture as production Tesla cameras |
| **LiDAR** | None |
| **Radar** | None |
| **Roof Sensors** | None (clean roofline) |
| **Shared Platform** | Same batteries, compute, and cameras as Optimus |

### Production & Timeline

| Date | Milestone |
|------|-----------|
| Oct 2024 | CyberCab unveiled at "We, Robot" event |
| Mid 2025 | Model Y-based robotaxi pilot begins in Austin |
| Feb 2026 | First production CyberCab completed at Giga Texas |
| Apr 2026 | Volume production begins at Giga Texas |
| 2026+ | CyberCab enters robotaxi fleet in Austin and expansion cities |

### Production Targets

| Metric | Target |
|--------|--------|
| Unit cycle time | < 10 seconds per vehicle |
| Manufacturing location | Gigafactory Texas |
| Target unit cost | Below $30,000 (estimated) |
| Ownership model | Tesla-owned fleet (primarily) |
| Revenue model | Per-ride fare with Tesla platform cut |

### Key Design Decisions

- **No steering wheel or pedals:** CyberCab is designed exclusively for unsupervised autonomous operation; there is no human driving fallback
- **Inductive charging only:** Eliminates the need for human interaction to plug in, enabling fully autonomous fleet recharging
- **Two-passenger capacity:** Optimized for typical ride-hailing trips (average 1.2 passengers)
- **Clean sensor integration:** No roof-mounted sensor pods; all perception hardware integrated into body panels
- **Shared architecture with Optimus:** Reduces cost through component commonality across Tesla's robotics products

---

## Appendix: Key Comparisons

### Tesla FSD vs. Waymo

| Dimension | Tesla FSD | Waymo Driver |
|-----------|-----------|-------------|
| **Sensors** | Camera-only (8--9 cameras) | LiDAR + cameras + radar (29+ sensors) |
| **Compute** | Custom Tesla FSD Chip (144--121+ TOPS) | Custom + NVIDIA |
| **Approach** | End-to-end neural network; imitation + RL | Modular stack with ML components |
| **Fleet Size** | 9M+ vehicles (1.1M FSD) | ~700 robotaxis |
| **Data Scale** | Billions of miles of fleet data | Millions of autonomous miles |
| **ODD** | All roads (supervised); limited unsupervised | Geo-fenced cities (Phoenix, SF, LA, Austin) |
| **SAE Level** | Level 2+ (supervised); Level 4 (robotaxi pilot) | Level 4 (fully driverless) |
| **Business Model** | Consumer ADAS + robotaxi | Robotaxi only |

### Tesla Hardware Generations

| Feature | HW1 | HW2/2.5 | HW3 | HW4 (AI4) | AI5 (planned) |
|---------|-----|---------|-----|-----------|---------------|
| **Year** | 2014 | 2016/2017 | 2019 | 2023 | 2026 |
| **Chip** | Mobileye EyeQ3 | NVIDIA PX2 | Tesla FSD | Tesla FSD2 | Tesla AI5 |
| **Process** | 40 nm | 16 nm | 14 nm | 7 nm | 5 nm (est.) |
| **NPU TOPS** | N/A | ~24 | 144 | ~121+ | TBD |
| **Cameras** | 1 | 8 | 8 | 8--9+ | TBD |
| **Radar** | 1 | 1 | 0-1 | 0 | 0 |
| **Ultrasonics** | 0 | 12 | 0-12 | 0 | 0 |
| **RAM** | N/A | N/A | 8 GB | 16 GB | TBD |
| **Camera Res.** | N/A | 1.2 MP | 1.2 MP | 5.4 MP | TBD |
| **FSD Support** | No | Limited | Yes (v12 max) | Yes (v13, v14) | Yes |

---

*This document was compiled from publicly available information including Tesla AI Day presentations, earnings calls, NHTSA filings, teardown analyses, technical conference talks by Ashok Elluswamy and others, and industry reporting as of March 2026.*
