# World Models & AI for Airside Autonomous Vehicles: Master Synthesis

**Date:** 2026-03-21
**Scope:** Comprehensive research survey across 20 deep-dive reports covering world models, VLAs, simulation, end-to-end driving, and their applicability to autonomous vehicles operating on airport airside.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [The Landscape: What Exists Today](#2-the-landscape)
3. [Top Candidate Approaches for Airside AV](#3-top-candidates)
4. [NVIDIA Alpamayo: Deep Dive](#4-alpamayo)
5. [Recommended Architecture](#5-recommended-architecture)
6. [The Airside Data Problem & Solutions](#6-data-problem)
7. [Simulation Strategy](#7-simulation-strategy)
8. [Safety & Certification Path](#8-safety-certification)
9. [Hardware & Deployment](#9-hardware-deployment)
10. [Research Report Index](#10-report-index)
11. [Key Papers & Repos](#11-key-resources)
12. [Strategic Recommendations](#12-strategic-recommendations)

---

## 1. Executive Summary

The autonomous driving field has undergone a paradigm shift from modular perception-planning-control pipelines toward **learned world models** and **end-to-end architectures**. Three converging trends make this the right time to adopt these approaches for airside AV:

1. **World models are production-ready.** Comma.ai's openpilot v0.11 ships a 2B-parameter diffusion transformer world model — the first robotics agent trained fully in learned simulation. Wayve's GAIA series (up to 15B params) navigates 500+ cities with a single model.

2. **NVIDIA Alpamayo provides an open foundation.** Released January 2026, this 10.5B-parameter VLA with Chain-of-Causation reasoning, 1,727 hours of driving data, and AlpaSim closed-loop simulator is Apache 2.0 / NVIDIA Open Model licensed. It's the most accessible starting point for building a world-model-based AV stack.

3. **Airside is an ideal ODD for world models.** Low speeds (5-30 km/h), structured environments, and the absence of large-scale airside datasets (a weakness for traditional approaches) becomes a *strength* for world models that can leverage pre-training on road driving and adapt with minimal domain-specific data.

### The Core Thesis

> **A world model pre-trained on road driving data, fine-tuned on airside data, and combined with occupancy-based planning can leapfrog traditional airside AV approaches that rely on hand-crafted rules and HD maps.**

Key advantages over current airside AV solutions (TractEasy, Aurrigo, etc.):
- **No per-class object detection needed** — occupancy prediction is class-agnostic, handling aircraft, GSE, personnel without per-type training
- **Generalization across airports** — world models + VLAs can adapt to new layouts with minimal data, vs. re-mapping for each airport
- **Language-grounded reasoning** — VLAs can process ground control instructions and provide explainable decisions for regulatory compliance
- **Synthetic data generation** — world models generate training scenarios, addressing the zero-public-dataset problem for airside

---

## 2. The Landscape

### 2.1 World Model Architectures (Maturity Ranking)

| Approach | Maturity | Key Systems | Airside Fit |
|----------|----------|-------------|-------------|
| **Latent world models + RL** | Production | DreamerV3/V4, TD-MPC2, Think2Drive | High — proven for control |
| **VLA (Vision-Language-Action)** | Near-production | Alpamayo, LINGO-2, DriveVLM, pi0 | Very High — language grounding |
| **Diffusion world models** | Research+ | GAIA-2, Vista, DriveDreamer-2, DIAMOND | High — simulation & planning |
| **Occupancy world models** | Research+ | OccWorld, Drive-OccWorld, OccSora | Very High — class-agnostic |
| **Autoregressive video models** | Research | DrivingGPT, DrivingWorld, Copilot4D | Medium — simulation |
| **JEPA (embedding prediction)** | Early research | V-JEPA 2, AD-L-JEPA | High potential — efficiency |
| **3DGS/NeRF reconstruction** | Research+ | Street Gaussians, SplatAD, PVG | High — airport digital twins |

### 2.2 Current Airside AV Players

| Company | Product | Autonomy | Deployments | Tech Stack |
|---------|---------|----------|-------------|------------|
| **TractEasy** (TLD + EasyMile) | EZTow, EZDolly | L4 | Narita, Changi, Munich, Dubai | GPS + 3D LiDAR + fusion |
| **Aurrigo** | Auto-DollyTug, Auto-Cargo | L4 | Zurich, Schiphol, Heathrow | LiDAR + 360 cam + GPS + IMU |
| **Charlatte Autonom** | AT135 | L4 | CDG (Air France), Frankfurt | V2X + sensor fusion |
| **Fernride** | Teleoperation + autonomy | L4 tele | NVIDIA partnership | Progressive autonomy |
| **Ohmio** | Autonomous shuttles | L4 | JFK, Schiphol, Brussels | Undisclosed |

**Critical gaps in current solutions:**
- All use traditional perception pipelines — no world models
- No public airside driving datasets exist
- FAA CertAlert 24-02 (Feb 2024) is the only formal US guidance
- No A-SMGCS integration with autonomous GSE
- Limited adverse weather handling (de-icing, jet blast, FOD)

### 2.3 Regulatory Landscape

| Standard | Status | Relevance |
|----------|--------|-----------|
| **FAA CertAlert 24-02** | Only formal US guidance (2024) | Acknowledges AGVS, standards in development |
| **ISO 3691-4:2020** | Current certification path | Driverless industrial trucks — used by TractEasy/Aurrigo |
| **ISO/PAS 8800** | Published Dec 2024 | AI safety lifecycle for AV — bridges ISO 26262 gap |
| **EASA AI Roadmap 2.0** | In progress, targeting 2028 | W-shaped development process for aviation AI |
| **ISO 21448 (SOTIF)** | Active | Safety of intended functionality — key for ML models |
| **UL 4600** | Active | Safety case-based evaluation of autonomous products |

---

## 3. Top Candidate Approaches for Airside AV

### 3.1 Tier 1: Build On Now

#### A. NVIDIA Alpamayo + AlpaSim (Recommended Starting Point)
- **What:** 10.5B VLA (8.2B Cosmos-Reason backbone + 2.3B action expert)
- **Why:** Open-source, Chain-of-Causation reasoning generates trajectories AND explanations, 1,727h driving data across 25 countries, AlpaSim for closed-loop testing
- **Alpamayo 1.5:** Adds RL post-training, flexible multi-camera support, text-guided planning
- **Airside path:** Fine-tune on airside data, leverage language reasoning for ground instructions, use AlpaSim for scenario testing
- **License:** Apache 2.0 + NVIDIA Open Model License
- **Partners:** Lucid, JLR, Uber, Berkeley DeepDrive

#### B. Occupancy World Models (OccWorld / Drive-OccWorld)
- **What:** Predict future 3D occupancy grids — class-agnostic scene prediction
- **Why:** No per-class detection needed. Handles aircraft, GSE, personnel, FOD without type-specific training. Drive-OccWorld (AAAI 2025) adds action conditioning — 33% improvement over UniAD
- **Airside path:** Pre-train on nuScenes/Waymo occupancy, fine-tune on airside. Jet blast zones become hazard occupancy predictions
- **Open source:** OccWorld on GitHub (ECCV 2024)

#### C. NVIDIA Cosmos World Foundation Models
- **What:** Open-weight world foundation models (4-14B params, trained on 9000T+ tokens)
- **Why:** Pre-trained world models for fine-tuning on domain-specific data. Up to 2048x compression tokenizers
- **Airside path:** Fine-tune Cosmos on airside video for simulation and data augmentation
- **License:** Apache 2.0 + NVIDIA Open Model

### 3.2 Tier 2: Integrate Short-Term

#### D. 3D Gaussian Splatting for Airport Digital Twins
- **What:** Reconstruct airport environments from sensor logs for photorealistic simulation
- **Key systems:** Street Gaussians (135 FPS, 30min training), SplatAD (CVPR 2025, joint camera+LiDAR)
- **Airside path:** Drive around airport, reconstruct as 3DGS scene, use for closed-loop testing with counterfactual scenarios (insert aircraft, simulate pushback, test FOD response)

#### E. Foundation Model Perception (Open-Vocabulary Detection)
- **What:** SAM, Grounding DINO, YOLO-World for detecting objects never seen in training
- **Why:** Airside has unique object classes (30+ types of GSE, 100+ aircraft variants). Open-vocabulary detection handles these without per-class annotation
- **Airside path:** Zero-shot detection with text prompts ("baggage tractor", "jet bridge", "belt loader"), then fine-tune with LoRA on small airside dataset
- **Data estimate:** 0-50 examples per class for zero-shot; 200-500 for fine-tuned 80%+ mAP

#### F. Map-Free Driving (MapTR/MapTRv2)
- **What:** Online vectorized map construction from sensors — no HD map needed
- **Why:** Airport layouts change frequently (construction, seasonal operations, NOTAMs). HD maps are expensive to maintain per-airport
- **Airside path:** Combine with AIXM/AMXM airport data as prior, NOTAM integration for dynamic restrictions

### 3.3 Tier 3: Research & Future

#### G. JEPA-Style World Models (V-JEPA 2, AD-L-JEPA)
- **What:** Predict future scene embeddings, not pixels — 240x faster planning than video generation
- **Why:** Massive efficiency gains. V-JEPA 2-AC plans in 16 seconds vs. 4 minutes for pixel-generation baselines
- **Status:** Early but Meta open-sourcing aggressively. AD-L-JEPA is first driving-specific JEPA (AAAI 2026)

#### H. LLM-Based Planning & ATC Integration
- **What:** LLMs for reasoning about traffic rules, ground control instructions, edge cases
- **Key:** DriveReg achieves 100% traffic rule compliance via RAG. Delft's LLM-based ATC agent resolved 119/120 conflicts
- **Airside path:** RAG over ICAO/FAA rules + airport-specific procedures. Process digital taxi instructions (NASA NLU work exists)

#### I. Multi-Agent Fleet Coordination
- **What:** Shared world models across vehicle fleet, cooperative perception, turnaround sequencing
- **Key:** Moonware HALO (deployed at US hubs, 20% delay reduction), SuperMap Apron Commander
- **Airside path:** Fleet world model shared via 5G/CBRS, A-CDM integration for turnaround optimization

---

## 4. NVIDIA Alpamayo: Deep Dive

Alpamayo is the most directly applicable system for airside AV development. Here's why:

### Architecture
```
Input: Multi-camera images + vehicle state
    |
    v
[Cosmos-Reason Backbone (8.2B)] -- Vision encoder + language model
    |
    v
[Chain-of-Causation Reasoning] -- Generates causal explanation of scene
    |                              ("Vehicle ahead is braking because...")
    v
[Action Expert (2.3B)] -- Generates driving trajectories
    |
    v
Output: Trajectory + Natural language explanation
```

### Key Capabilities
- **Chain-of-Causation reasoning:** Generates both trajectories AND interpretable explanations — critical for regulatory compliance in aviation
- **Text-guided planning (v1.5):** Can follow natural language instructions — maps directly to ground control instructions
- **RL post-training (v1.5):** Reinforcement learning fine-tuning improves real-world performance
- **700K reasoning traces:** Pre-built dataset for reasoning-aware training
- **AlpaSim:** Microservice-based closed-loop simulator for testing

### Airside Adaptation Strategy
1. **Phase 1 (0-3 months):** Deploy Alpamayo in shadow mode on airside vehicles. Collect data with explanations.
2. **Phase 2 (3-6 months):** Fine-tune on collected airside data. Add airport-specific reasoning traces (jet blast awareness, FOD detection, stand procedures).
3. **Phase 3 (6-12 months):** RL post-training on airside scenarios via AlpaSim. Add ground control instruction following.
4. **Phase 4 (12+ months):** Multi-airport deployment with few-shot adaptation.

---

## 5. Recommended Architecture

### 5.1 Layered Architecture for Airside AV

```
┌─────────────────────────────────────────────────┐
│              SAFETY LAYER (Always Active)         │
│  Simplex architecture: High-performance + safe    │
│  RSS-based safety envelope │ OOD detection        │
│  Teleoperation fallback (Fernride-style)          │
└───────────────────────┬─────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────┐
│           PLANNING & REASONING LAYER              │
│  Alpamayo VLA (trajectory + explanation)           │
│  OR Occupancy-based MPC (Drive-OccWorld)           │
│  LLM reasoning for edge cases (RAG over rules)    │
│  Multi-agent coordination (fleet world model)     │
└───────────────────────┬─────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────┐
│           WORLD MODEL LAYER                       │
│  4D Occupancy prediction (OccWorld-style)          │
│  Motion prediction (MotionLM / MTR++)              │
│  Scene understanding (DINOv2 + open-vocab det.)   │
│  Online mapping (MapTRv2 + AIXM prior)            │
└───────────────────────┬─────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────┐
│           PERCEPTION LAYER                        │
│  BEV fusion (BEVFormer/BEVFusion)                 │
│  Multi-sensor: cameras + LiDAR + 4D radar         │
│  Foundation model features (DINOv2 backbone)      │
│  Open-vocabulary detection (Grounding DINO)       │
└───────────────────────┬─────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────┐
│           SENSOR & LOCALIZATION LAYER             │
│  Cameras (surround view) + LiDAR + 4D radar       │
│  RTK-GNSS + visual/LiDAR SLAM fallback           │
│  UWB beacons for GPS-degraded areas              │
│  ADS-B receiver for aircraft awareness            │
└─────────────────────────────────────────────────┘
```

### 5.2 Integration Points

| Airport System | Integration Method | Purpose |
|----------------|-------------------|---------|
| **A-SMGCS** | API / ASTERIX Cat 010/062 | Aircraft position awareness |
| **A-CDM / AODB** | ACRIS Semantic Model | Flight schedule, turnaround timing |
| **NOTAM system** | AIXM/AMXM parser | Dynamic restriction awareness |
| **Digital tower** | Data feed | Surface movement clearances |
| **ADS-B** | 1090ES receiver | Aircraft proximity detection |
| **Fleet management** | 5G/CBRS mesh | Vehicle coordination |

### 5.3 Sensor Suite Recommendation

| Sensor | Qty | Purpose | Airside Rationale |
|--------|-----|---------|-------------------|
| **Cameras (surround)** | 6-8 | Primary perception | Rich semantic info, low cost |
| **LiDAR (128-ch)** | 1 | 3D geometry, localization | Handles reflective surfaces, large objects |
| **4D Radar** | 2-4 | Velocity, all-weather | Works in rain, de-icing spray, fog |
| **RTK-GNSS** | 1 | Primary localization | cm-level in open areas |
| **UWB anchors** | Site-based | GPS fallback | Near terminals, under aircraft |
| **ADS-B receiver** | 1 | Aircraft awareness | Real-time aircraft positions |
| **IMU** | 1 | Dead reckoning | Bridge GPS gaps |

---

## 6. The Airside Data Problem & Solutions

### 6.1 The Problem

**Zero public airside driving datasets exist.** The only resources:
- Synth_Airport_Taxii (synthetic, limited)
- AssistTaxi (marking recognition, limited)
- AeroVect proprietary (not available)

### 6.2 The Solution: 4-Phase Data Engine

| Phase | Timeline | Strategy | Data Volume |
|-------|----------|----------|-------------|
| **1. Foundation** | 0-6 months | Pre-train on road driving (nuScenes, Waymo, nuPlan). Transfer learn with domain adaptation | 10,000+ hours (existing) |
| **2. Bootstrap** | 3-9 months | Deploy in shadow mode at 1-2 airports. Manual annotation + auto-labeling (SAM + Grounding DINO) | 100-500 hours |
| **3. World Model Training** | 6-18 months | Train world model on airside data. Generate synthetic scenarios via Cosmos/GAIA. 3DGS digital twin of airports | 1,000+ hours (real + synthetic) |
| **4. Scaling** | 12+ months | Active learning from fleet. Federated learning across airports. Continuous world model improvement | 5,000+ hours |

### 6.3 Synthetic Data Generation Pipeline

```
Real Airport Scan (3DGS/NeRF)
    → Reconstructed Digital Twin
    → Insert synthetic agents (aircraft, GSE, personnel)
    → Vary weather, lighting, time-of-day
    → Render multi-sensor data (camera + LiDAR + radar)
    → World model training data
```

**Tools:** NVIDIA Cosmos for video generation, 3DGS for scene reconstruction, DriveDreamer-2 for LLM-prompted scenario generation, Unreal Engine with airport assets for structured simulation.

### 6.4 Domain Adaptation Strategy

Pre-training curriculum:
1. General vision (DINOv2 on ImageNet)
2. Driving video (Cosmos on road data)
3. Structured low-speed driving (parking lots, industrial areas)
4. Synthetic airport scenes
5. Real airport data (fine-tuning)
6. Continual learning from deployment

---

## 7. Simulation Strategy

### 7.1 Multi-Fidelity Simulation Stack

| Level | Tool | Fidelity | Speed | Purpose |
|-------|------|----------|-------|---------|
| **L1: Unit test** | AlpaSim | Low | Real-time | Component testing |
| **L2: Scenario** | CARLA + airport assets | Medium | 10-100x | Scenario validation |
| **L3: Neural sim** | Cosmos / GAIA | High visual | 1-10x | Perception testing |
| **L4: Digital twin** | 3DGS reconstruction | Photorealistic | Real-time | Closed-loop testing |
| **L5: Shadow mode** | Real vehicle | Real | 1x | Pre-deployment validation |

### 7.2 Key Scenarios to Simulate

| Scenario | Priority | Challenge |
|----------|----------|-----------|
| Aircraft pushback (nose-in/nose-out) | Critical | Large dynamic object, jet blast |
| Crossing active taxiway | Critical | ATC clearance required |
| FOD on apron | High | Small object detection at distance |
| De-icing operations | High | Glycol spray, reduced visibility |
| Multi-vehicle turnaround sequencing | High | Coordination, timing |
| Emergency vehicle response | Critical | Yield behavior |
| Night operations with apron lighting | Medium | Lighting variation |
| Snow/ice operations | Medium | Traction, visibility |
| Personnel walking near aircraft | Critical | Vulnerable road user prediction |

---

## 8. Safety & Certification Path

### 8.1 Recommended Certification Framework

Given that airside AV falls between automotive and aviation domains:

1. **Primary:** ISO 3691-4:2020 (driverless industrial trucks) — used by current deployments
2. **AI safety:** ISO/PAS 8800 (AI safety lifecycle) — newly published Dec 2024
3. **Functional safety:** ISO 26262 adapted for airside ODD
4. **Intended functionality:** ISO 21448 (SOTIF) — critical for ML-based perception
5. **Safety case:** UL 4600 framework with GSN notation
6. **Future-proofing:** Track EASA AI Roadmap 2.0 for aviation-specific AI certification

### 8.2 Safety Architecture for World Models

```
┌──────────────────────────────────────┐
│         WORLD MODEL PLANNER          │
│  (High performance, learned)         │
├──────────────────────────────────────┤
│         SAFETY MONITOR               │
│  - OOD detection (ensemble)          │
│  - Confidence calibration            │
│  - RSS safety envelope check         │
│  - Occupancy prediction validation   │
├──────────────────────────────────────┤
│      DECISION: Safe? ─── Yes ──→ Execute world model trajectory
│                  │
│                  No
│                  ↓
│         SAFE FALLBACK CONTROLLER     │
│  (Rule-based, formally verified)     │
│  - Graceful stop                     │
│  - Maintain safe distance            │
│  - Request teleoperation             │
└──────────────────────────────────────┘
```

### 8.3 AMLAS (Assurance of ML for Autonomous Systems) Process

1. ML Safety Requirements → derive from SOTIF analysis
2. ML Data Management → curate airside dataset with bias analysis
3. ML Model Learning → train with safety-aware objectives (SafeDreamer)
4. ML Model Verification → test against safety requirements
5. ML Model Deployment → runtime monitoring + OOD detection
6. ML Model Operation → continuous validation from fleet data

---

## 9. Hardware & Deployment

### 9.1 Compute Platform Recommendation

| Option | TOPS | Power | Cost | Recommendation |
|--------|------|-------|------|----------------|
| **NVIDIA Orin** | 275 | 60W | ~$1,500 | **Best for initial deployment** — proven, Alpamayo compatible |
| **NVIDIA Thor** | 2,000+ | 130W | TBD | Future upgrade — runs full world models on-vehicle |
| **Qualcomm Ride** | 1,280 (dual) | Varies | Competitive | Alternative if NVIDIA supply constrained |

**NVIDIA Orin (60W)** is negligible on electric GSE with 30-100 kWh batteries (< 0.2% of battery capacity per hour).

### 9.2 Cloud-Edge Hybrid Architecture

| Workload | Location | Latency | Rationale |
|----------|----------|---------|-----------|
| Perception + planning | On-vehicle (Orin) | <100ms | Safety-critical, must be real-time |
| World model inference | On-vehicle (Orin) | <200ms | Latent-space models fit in 8GB |
| World model training | Cloud/edge server | Async | Too compute-intensive for on-vehicle |
| Simulation (AlpaSim) | Airport edge server | N/A | Scenario testing, not real-time |
| Fleet coordination | Airport edge server | <50ms | 5G/CBRS connectivity |
| Data upload & labeling | Cloud | Async | Large data volumes (1-4 TB/hour) |

### 9.3 Fleet Cost Model (50 vehicles)

| Component | Year 1 Cost | Notes |
|-----------|-------------|-------|
| Compute (Orin per vehicle) | $75K | Hardware + integration |
| Sensors per vehicle | $30-50K | LiDAR + cameras + radar + GNSS |
| 5G/CBRS infrastructure | $200-400K | Airport-wide coverage |
| Edge server | $100-200K | Training + fleet coordination |
| Cloud (training) | $200-500K | GPU cluster rental |
| Software development | $1-5M | World model adaptation, integration |
| **Total Year 1** | **$2.1-9.2M** | |
| **Payback** | **1-3 years** | Via labor cost savings |

---

## 10. Research Report Index

### Core World Models & Architecture
| Report | File | Key Findings |
|--------|------|-------------|
| World Models for AV | `technology/world-models/overview.md` | 17+ architectures, readiness assessment |
| End-to-End AV | `technology/e2e-driving/e2e-architectures.md` | SparseDrive SOTA (0.06% collision), recommended architecture |
| Diffusion World Models | `technology/world-models/diffusion-world-models.md` | Sora, Genie 2/3, 13 driving-specific models |
| RL with World Models | `technology/world-models/rl-with-world-models.md` | Dreamer v1-v4, TD-MPC2, SafeDreamer |
| Tokenized & JEPA | `technology/world-models/tokenized-and-jepa.md` | VQ-VAE world models, JEPA ~15x faster planning |
| 4D Occupancy | `technology/world-models/occupancy-world-models.md` | Class-agnostic prediction, jet blast as hazard occupancy |
| Occupancy Comparison | `technology/world-models/occupancy-networks-comparison.md` | 20 methods compared, FlashOcc 197.6 FPS |
| Open-Source Repos | `technology/world-models/opensource-implementations.md` | 21 repos rated, only 6 fully usable |

### Models & Approaches
| Report | File | Key Findings |
|--------|------|-------------|
| VLAs | `technology/vla/vla-for-driving.md` | 15+ VLA models, LINGO-2, DriveVLM |
| Alpamayo | `technology/vla/alpamayo-setup.md` | Camera-only, non-commercial, teacher model for distillation |
| Company Deep Dives | `technology/e2e-driving/company-approaches.md` | Wayve/NVIDIA/Tesla/Waymo/Comma.ai strategies |
| LLM Reasoning | `technology/planning/llm-reasoning-planning.md` | DriveReg 100% rule compliance, Moonware HALO |
| Motion Prediction | `technology/planning/motion-prediction.md` | MotionLM, gate turnaround sequencing |
| Foundation Models | `technology/perception/vision-foundation-models.md` | SAM, DINO, open-vocab detection |
| DINOv2 | `technology/perception/dinov2-foundation-models-driving.md` | Adapter-mediated integration, LoRA rank 32 optimal |

### Simulation & Data
| Report | File | Key Findings |
|--------|------|-------------|
| Neural Simulation | `technology/simulation/neural-simulation-platforms.md` | Alpamayo, Cosmos, 12+ sim platforms |
| 3DGS & NeRF | `technology/simulation/neural-scene-reconstruction.md` | Street Gaussians 135 FPS, SplatAD |
| Airport Digital Twins | `technology/simulation/airport-digital-twins.md` | Autonoma, SITA, $50K-$4M |
| Simulators for Airside | `technology/simulation/simulators-for-airside.md` | CARLA/AWSIM/Isaac Sim comparison |
| Datasets & Benchmarks | `cross-cutting/data-engines-datasets.md` | Zero airside datasets, 4-phase bootstrap plan |
| Synthetic Data | `cross-cutting/synthetic-data-generation.md` | Cosmos +16.2% mAP foggy, 7-phase pipeline |

### Deployment & Safety
| Report | File | Key Findings |
|--------|------|-------------|
| Safety & Certification | `operations/safety/certification-guide.md` | ISO/PAS 8800, EASA AI Roadmap, AMLAS |
| ISO 3691-4 | `operations/safety/iso-3691-4-deep-dive.md` | $130K-380K, harmonized May 2024, 27 safety functions |
| Regulatory Trajectory | `operations/safety/regulatory-trajectory-deep-dive.md` | FAA AC ~2028-2029, EASA ~2028 |
| Ground Crew Safety | `operations/safety/ground-crew-pedestrian-safety.md` | 27K accidents/yr, hi-vis paradox |
| Insurance & Liability | `operations/safety/insurance-liability-airside.md` | $35M per engine exposure |
| Compute & Hardware | `hardware/compute/edge-platforms.md` | Orin 275 TOPS @ 60W, fleet cost model |
| NVIDIA Orin | `hardware/compute/nvidia-orin-technical.md` | 8 power modes, DLA 74% at 15W |
| NVIDIA Thor | `hardware/compute/nvidia-drive-thor.md` | ~1000 TOPS, FP8 native, 2025+ |
| TensorRT Guide | `hardware/compute/tensorrt-deployment-guide.md` | PointPillars 6.84ms, DLA deployment |
| 4D Radar | `hardware/sensors/4d-radar.md` | Continental ARS548, immune to all weather |
| Airside Industry | `operations/airside/industry-overview.md` | 21 companies, FAA CertAlert 24-02 |
| Multi-Agent & Fleet | `technology/multi-agent/fleet-coordination.md` | V2X, Moonware, 5G/CBRS, A-CDM |
| Mapping & Localization | `technology/localization/mapping-and-localization.md` | Map-free driving, AIXM, NOTAM integration |
| Robustness | `technology/robustness/adverse-conditions.md` | De-icing, jet blast, FOD, 4D radar |

---

## 11. Key Papers & Repos

### Must-Read Papers
1. **Alpamayo** — NVIDIA's 10.5B VLA for L4 AV (CES 2026)
2. **GAIA-1/2/3** — Wayve's world model series (9B-15B params)
3. **DreamerV3/V4** — Model-based RL at scale (Nature 2025)
4. **OccWorld** — 3D occupancy world model (ECCV 2024)
5. **Drive-OccWorld** — Action-conditioned occupancy (AAAI 2025)
6. **EMMA** — Waymo's end-to-end multimodal model (on Gemini)
7. **Cosmos** — NVIDIA world foundation models (9000T+ tokens)
8. **SafeDreamer** — Safe RL with world models (ICLR 2024)
9. **WorldRFT** — RL fine-tuning for world models (AAAI 2026, 83% collision reduction)
10. **V-JEPA 2** — Meta's efficient video world model (2025)

### Key Open-Source Repos
| Repo | Description |
|------|-------------|
| [NVIDIA Alpamayo](https://github.com/NVIDIA/alpamayo) | 10.5B VLA + AlpaSim |
| [NVIDIA Cosmos](https://github.com/NVIDIA/Cosmos) | World foundation models |
| [OpenDWM](https://github.com/SenseTime-FVG/OpenDWM) | Driving world model framework |
| [OccWorld](https://github.com/wzzheng/OccWorld) | 3D occupancy world model |
| [DriveDreamer](https://github.com/JeffWang987/DriveDreamer) | World model from real driving |
| [DiffusionDrive](https://github.com/hustvl/DiffusionDrive) | Real-time E2E driving (CVPR 2025) |
| [DIAMOND](https://github.com/eloialonso/diamond) | Diffusion RL world model |
| [V-JEPA 2](https://github.com/facebookresearch/vjepa2) | Efficient video prediction |
| [AD-L-JEPA](https://github.com/haoranzhuexplorer/ad-l-jepa-release) | JEPA for driving LiDAR |
| [openpilot](https://github.com/commaai/openpilot) | Open-source E2E driving |
| [Awesome-World-Model](https://github.com/LMD0311/Awesome-World-Model) | Paper collection |

---

## 12. Strategic Recommendations

### Immediate Actions (0-3 months)
1. **Set up Alpamayo + AlpaSim** — Download, run inference, understand the architecture
2. **Begin airside data collection** — Mount cameras on existing GSE in shadow mode
3. **Build 3DGS digital twin** — Scan your primary airport for simulation
4. **Deploy open-vocab detection** — Grounding DINO for zero-shot airside object detection

### Short-Term (3-12 months)
5. **Fine-tune Alpamayo on airside data** — Start with simple scenarios (straight-line baggage tug routes)
6. **Train occupancy world model** — Pre-train on nuScenes, fine-tune on airside
7. **Build synthetic data pipeline** — Cosmos for video generation, 3DGS for scenarios
8. **Engage with FAA/EASA** — Begin safety case development using AMLAS methodology

### Medium-Term (12-24 months)
9. **RL post-training** — Fine-tune world model policy with SafeDreamer-style constraints
10. **Multi-airport adaptation** — Test few-shot generalization to new airports
11. **Fleet coordination** — Shared world model via 5G, A-CDM integration
12. **Ground control instruction following** — LLM-based digital taxi instruction processing

### Long-Term (24+ months)
13. **Full autonomous turnaround sequencing** — Multi-agent world model for coordinated GSE
14. **Continuous learning data engine** — Fleet-wide active learning, federated model updates
15. **Certification** — ISO 3691-4 + ISO/PAS 8800 + SOTIF safety case

### Key Risk Mitigations
| Risk | Mitigation |
|------|-----------|
| No airside training data | Synthetic data + transfer learning + active learning |
| Regulatory uncertainty | Build safety case with established frameworks (AMLAS, UL 4600) |
| World model hallucination | Simplex architecture with verified fallback controller |
| Compute constraints | Start with Orin (latent models), upgrade to Thor for full models |
| Airport stakeholder buy-in | Demonstrate in shadow mode first, show explainable decisions via VLA |

---

*This synthesis draws from 20 deep-dive research reports totaling 13,210 lines of analysis across 200+ papers, models, and systems. Each report is available in this directory for detailed reference.*
