# Datasets, Benchmarks, and Data Engines for Autonomous Driving World Models

**Deep Technical Research Report — March 2026**

---

## Table of Contents

1. [Major Driving Datasets](#1-major-driving-datasets)
2. [Benchmarks for World Models and Generation](#2-benchmarks-for-world-models-and-generation)
3. [Data Engines and Auto-Labeling](#3-data-engines-and-auto-labeling)
4. [The Data Gap for Airside Operations](#4-the-data-gap-for-airside-operations)
5. [Data Curation and Quality](#5-data-curation-and-quality)

---

## 1. Major Driving Datasets

### 1.1 nuScenes (Motional, 2019)

The foundational multimodal dataset for autonomous driving research.

| Property | Details |
|---|---|
| **Scale** | 1,000 curated scenes, 5.5 hours of driving from 83 logs (14.8h total) |
| **Sensors** | 6 cameras (360deg), 1 LiDAR (Velodyne HDL-32E), 5 radars — full AV sensor suite |
| **Annotations** | 1.4M 3D bounding boxes across 23 object classes; panoptic extension adds 1.1B point-level labels |
| **Locations** | Boston, Singapore |
| **Key metrics** | nuScenes Detection Score (NDS), AMOTA for tracking |

**Strengths for world models:** Rich multimodal temporal sequences with semantic maps enable learning spatial-temporal dynamics. Over 16,000 downloads, 1,000+ academic citations.

**Limitations (per "nuScenes Revisited," Dec 2025):** Geographic overlap between train/val/test splits causes overfitting risk. Only 5.5h of data is small for modern training. Radar synchronization issues complicate multimodal fusion. The dataset's curation bias toward "interesting" moments limits continuous-driving distribution learning.

**Key extensions:**
- **nuImages**: 93,000 annotated images for 2D detection
- **Panoptic nuScenes**: Semantic + instance labels at point level
- **NuPlanQA** (2025): 4.3M frames with multi-modal language QA built on nuPlan

### 1.2 nuPlan (Motional, 2021)

The world's first large-scale real-world planning dataset and benchmark.

| Property | Details |
|---|---|
| **Scale** | 1,282 hours of driving, ~235x larger than nuScenes |
| **Locations** | Las Vegas, Boston, Pittsburgh, Singapore |
| **Features** | Auto-labeled object tracks, traffic light data, HD maps |
| **Use case** | Closed-loop planning evaluation |

nuPlan is the base dataset from which **OpenScene** is derived (see section 1.10). Its massive scale makes it the de facto standard for end-to-end driving research in 2024-2025.

### 1.3 Waymo Open Dataset (Waymo, 2019-present)

The most actively maintained large-scale AV dataset, with continual expansions.

| Property | Details |
|---|---|
| **Perception Dataset** | 1,150 scenes, 20s each; 12.6M 3D box labels, 12M 2D box labels |
| **Motion Dataset (WOMD)** | 103,354 scenes; 574+ hours with raw LiDAR range images |
| **Sensors** | 5 LiDARs, 5 cameras (no radar) |
| **Locations** | Phoenix, San Francisco, Mountain View, and other US cities |
| **Current version** | v1.3.1 (Oct 2025), added `sdc_paths` for future route planning |

**Recent extensions (2024-2025):**
- **WOD-E2E**: 4,021 high-difficulty long-tail segments (~12 hours) for end-to-end driving in safety-critical situations
- **WOMD-Reasoning**: 3M QA pairs spanning map recognition, motion narratives, interaction reasoning, and intention prediction — enabling joint vision-language benchmarking
- **WOMD-LiDAR**: Raw compressed LiDAR range images for the full 574h motion dataset, enabling sensor-to-prediction learning

### 1.4 Waymo Open Motion Dataset (WOMD)

Deserves separate treatment due to its importance for world model training:

| Property | Details |
|---|---|
| **Scenes** | 103,354 (104,000 in some references) |
| **Duration** | 574+ hours |
| **Prediction horizon** | 8 seconds |
| **Key tasks** | Marginal/joint motion forecasting, interaction prediction, sim agents |
| **Metrics** | minADE, minFDE, Miss Rate, Overlap Rate, forecasting mAP |

The WOMD is particularly relevant for world models because it provides the long-horizon trajectory data needed to supervise future state prediction. The sim agents challenge specifically evaluates the ability to generate realistic multi-agent futures.

### 1.5 Argoverse 1 & 2 (Argo AI → now open-source, 2019/2023)

| Property | Argoverse 1 | Argoverse 2 |
|---|---|---|
| **Sensor Dataset** | 113 scenes | 1,000 3D-annotated scenarios |
| **LiDAR Dataset** | — | 20,000 unannotated sequences |
| **Motion Forecasting** | 324,557 segments | 250,000 scenarios |
| **Sensors** | 2 LiDARs, 7 cameras | 2 LiDARs (64 beams total at 10Hz), 7 ring cameras (20Hz), 2 stereo cameras |
| **Object classes** | 15 | 26 |
| **Locations** | Miami, Pittsburgh | Austin, Detroit, Miami, Pittsburgh, Palo Alto, Washington D.C. |

**Unique features:** Real-valued ground height maps at 30cm resolution (critical for 3D scene reconstruction). Map change dataset (1,000 scenarios, 200 with real-world HD map changes). Rich HD maps with 3D lane-level geometry, lane markings, traffic direction, crosswalks, and driveable area.

### 1.6 KITTI and KITTI-360 (KIT/Toyota, 2012/2022)

**KITTI** (original):
- Tasks: stereo, optical flow, visual odometry, 3D detection, 3D tracking
- Sensors: 2 color cameras, 2 grayscale cameras, Velodyne HDL-64E, GPS/IMU
- Location: Karlsruhe, Germany (urban, rural, highway)
- Status: Still widely used as a baseline despite age; 15,000+ citations

**KITTI-360** (successor):
- 73.7km driving distance, 300K images, 80K laser scans
- 150K+ images and 1B 3D points with coherent semantic instance annotations
- Full 360-degree FOV via fisheye cameras and pushbroom scanner
- Tasks: semantic scene understanding, novel view synthesis, semantic SLAM

KITTI remains the most-cited AV dataset, but its limited scale and single-city coverage make it insufficient for modern world model training. It retains value as a domain-transfer target (e.g., Waymo-to-KITTI zero-shot benchmarks).

### 1.7 Lyft Level 5 (Lyft/Woven Planet, 2019)

| Property | Details |
|---|---|
| **Scale** | 55,000+ human-labeled 3D annotated frames; 1,000+ hours total sensor data |
| **Fleet** | 20 self-driving cars |
| **Duration** | 4-month collection period |
| **Location** | Palo Alto, California (fixed route) |
| **Maps** | Drivable surface map + HD spatial semantic map |

The dataset is no longer actively maintained since Woven Planet (Toyota) absorbed Lyft Level 5. Its value lies primarily in the large fleet data collection paradigm it demonstrated.

### 1.8 PandaSet (Hesai/Scale AI, 2021)

| Property | Details |
|---|---|
| **Scenes** | 100+ scenes, 8 seconds each |
| **Sensors** | 1 x 360deg mechanical spinning LiDAR, 1 x forward-facing long-range LiDAR, 6 cameras |
| **Annotations** | 28 object classes, 37 semantic segmentation classes |
| **License** | First AV dataset with no-cost commercial license |

PandaSet is notable for its dual-LiDAR configuration and commercial-friendly licensing, but its small scale limits use for world model training.

### 1.9 ONCE (One millioN sCenEs, 2021)

| Property | Details |
|---|---|
| **Scale** | 1 million LiDAR scenes, 7 million camera images |
| **Duration** | Selected from 144 driving hours (20x larger than nuScenes/Waymo at time of release) |
| **Sensors** | 1 high-quality LiDAR (70K points/scene avg), 7 cameras (360deg) |
| **Annotations** | Small labeled subset + massive unlabeled pool |
| **Focus** | Semi-supervised and self-supervised 3D detection |

ONCE is particularly relevant for studying data scaling and self-supervised pretraining approaches, as its massive unlabeled pool enables controlled experiments on how much labeled vs. unlabeled data is needed.

### 1.10 OpenScene (OpenDriveLab/Shanghai AI Lab, 2024)

| Property | Details |
|---|---|
| **Scale** | 120+ hours of driving data |
| **Base** | Compact redistribution of nuPlan (>10x compression) |
| **Sampling** | 2Hz sensor data with relevant annotations retained |
| **Annotations** | Occupancy labels from 20s accumulated LiDAR, flow annotations (motion direction + velocity) |
| **Cities** | Boston, Pittsburgh, Las Vegas, Singapore |

**Critical role:** OpenScene is the official dataset for:
- CVPR 2024 Autonomous Grand Challenge: End-to-End Driving + Predictive World Model tracks
- CVPR 2025 Autonomous Grand Challenge: NAVSIM-v2 End-to-End Driving track

At 120h it provides ~20x more data than competing occupancy datasets (Occ3D: 5.5h, OccNet: 5.7h), making it the primary benchmark dataset for world model research.

### 1.11 DriveLM (OpenDriveLab, 2024 — ECCV 2024 Oral)

| Property | Details |
|---|---|
| **Structure** | Graph-structured QA pairs (Perception, Prediction, Planning) |
| **Base datasets** | nuScenes + CARLA |
| **Annotation type** | Frame-wise P3 QA with logical dependencies |
| **Graph structure** | QA pairs as nodes, object relationships as edges |

DriveLM is the first language-driving dataset covering the full stack of driving tasks with graph-structured logical dependencies. It enables training VLMs that can reason about driving through structured question-answering chains from perception through prediction to planning.

### 1.12 Talk2Car (KU Leuven, 2019)

| Property | Details |
|---|---|
| **Scale** | 11,959 natural language commands across 850 nuScenes videos |
| **Task** | Grounding natural language commands to 3D bounding boxes |
| **Modalities** | Leverages full nuScenes sensor suite (maps, GPS, LiDAR, radar, 360deg RGB) |

Talk2Car is important for language-grounded driving where commands like "follow that blue car" must be resolved to specific detected objects.

### 1.13 Significant New Datasets (2024-2025)

**CoVLA (Turing Inc., WACV 2025):**
- 10,000 driving scenes from Tokyo, 80+ hours of video
- Automated frame-level language captions + future trajectory annotations
- Bridges vision-language-action for VLA model training
- CoVLA-Agent baseline achieves 0.814m ADE with ground truth captions

**OpenDV-YouTube / OpenDV-2K (OpenDriveLab, 2024):**
- 1,700-2,000+ hours of YouTube driving videos — 300x-374x larger than nuScenes
- 244 cities in 40 countries
- Paired with LLM/VLM-generated text descriptions and driving instructions
- Used to pretrain Vista, a generalizable driving world model
- Key insight: YouTube data provides natural distribution of driving scenarios across geographies, weather, and traffic

**V2X-Real (ECCV 2024):**
- Multi-vehicle + infrastructure cooperative perception
- 33K LiDAR frames, 171K camera images, 1.2M annotated boxes (10 categories)
- Data from 2 connected AVs + 2 smart infrastructure units

**V2X-Radar (Tsinghua, 2024):**
- First V2X dataset with 4D radar
- 20K LiDAR frames, 40K camera images, 20K 4D radar frames, 350K annotated boxes

**WayveScenes101 (Wayve, 2024):**
- 101 driving sequences (20s each), 101,000 images
- Designed specifically for novel view synthesis in driving
- US and UK locations

**SEVD (CARLA-based, 2024):**
- 58 hours of multi-modal synthetic data
- 9 million bounding box annotations
- Ego-vehicle + infrastructure viewpoints, 3 lighting / 5 weather conditions

**WOD-E2E (Waymo, 2025):**
- 4,021 high-difficulty long-tail driving segments
- Focused specifically on rare, safety-critical situations for E2E driving

**UniOcc (ICCV 2025):**
- Unified benchmark merging nuScenes, Waymo, CARLA, OpenCOOD
- 14.2 hours across 2,152 sequences
- Standardizes occupancy forecasting and prediction evaluation

---

## 2. Benchmarks for World Models and Generation

### 2.1 NAVSIM (NeurIPS 2024 / CoRL 2025)

The most important recent benchmark for end-to-end driving evaluation.

**Core concept:** A middle ground between open-loop and closed-loop evaluation. Uses large real-world datasets with a non-reactive simulator, gathering simulation-based metrics by unrolling BEV abstractions of test scenes.

| Property | Details |
|---|---|
| **Dataset** | OpenScene (derived from nuPlan) |
| **Metrics** | Progress, time-to-collision, drivable area compliance, comfort |
| **Correlation** | Pseudo-simulation achieves strong correlation with traditional closed-loop simulation at 6x less compute |
| **Competition** | CVPR 2024: 143 teams, 463 submissions; CVPR 2025: NAVSIM v2 challenge |
| **Version** | v2 (2025) with private_test_hard split for HuggingFace leaderboard |

**Key finding:** On large sets of challenging scenarios, simple methods with moderate compute (e.g., TransFuser) can match large-scale E2E architectures (e.g., UniAD), suggesting architecture innovations alone are insufficient — data and evaluation rigor matter more.

### 2.2 nuScenes Prediction Benchmarks

**Trajectory prediction:**
- Up to 25 proposed future trajectories per agent
- Metrics: ADE (Average Displacement Error), FDE (Final Displacement Error) over k most likely predictions
- Focus: Multi-modal trajectory forecasting quality

**3D Occupancy prediction:**
- Voxelized 3D space representation
- Joint estimation of occupancy state and semantic class per voxel
- Metrics: IoU and mIoU per class
- Standard benchmarks: Occ3D-nuScenes, OpenOccupancy
- Occluded/out-of-FOV voxels are ignored during evaluation

**Relevance for world models:** Occupancy prediction is a direct proxy for world modeling — predicting future 3D occupancy is essentially predicting future world states. The transition from trajectory-only to dense occupancy forecasting marks a paradigm shift toward richer world representations.

### 2.3 Waymo Sim Agents Challenge

| Property | Details |
|---|---|
| **Task** | Simulate 32 realistic joint futures for all agents in a scene |
| **Input** | 1 second of past agent tracks + map |
| **Goal** | Realistic, interactive agent simulation |
| **Status** | Running annually since 2023; 2025 leaderboard remains open |

The Sim Agents Challenge is the closest public benchmark to directly evaluating world models in the behavioral/trajectory domain. Generating 32 diverse, physically plausible joint futures tests both diversity and realism of learned dynamics.

### 2.4 CARLA Leaderboard

| Property | Details |
|---|---|
| **Simulator** | CARLA (Unreal Engine 4 based) |
| **Leaderboard v2** | 39 challenging scenarios for robustness evaluation |
| **Status** | No official challenge in 2025 (unforeseen circumstances); local use still available |
| **Best entry** | SimLingo (topped both Leaderboard 2.0 and Bench2Drive, won CARLA Challenge 2024) |

CARLA remains the primary closed-loop simulation benchmark but faces questions about sim-to-real transferability.

### 2.5 Bench2Drive (NeurIPS 2024 Datasets & Benchmarks)

A granular closed-loop E2E-AD benchmark enhanced by world model RL expert policies.

| Property | Details |
|---|---|
| **Scenarios** | 44 scenario types, 5 routes each (different weather/towns) = 220 routes |
| **Route length** | ~150 meters per route |
| **Evaluation** | Multi-ability assessment across all 44 scenarios |
| **Enhancement** | World model RL expert provides better demonstrations than rule-based experts |

Bench2Drive is significant because it demonstrates how world models can improve benchmark quality itself — world model RL experts generate better training demonstrations than hand-coded rule-based policies.

### 2.6 WorldModelBench (NeurIPS 2025 Datasets & Benchmarks)

The first dedicated benchmark for evaluating video generation models as world models.

| Property | Details |
|---|---|
| **Domains** | 7 application domains, 56 subdomains |
| **Evaluation** | Instruction following + physics adherence |
| **Human alignment** | 67K crowd-sourced human labels across 14 frontier models |
| **Judger** | Fine-tuned 2B multimodal model achieving 8.6% higher accuracy than GPT-4o at detecting violations |
| **Violation detection** | Nuanced physics violations (e.g., mass conservation, object permanence) |

Autonomous driving is one of the 7 primary domains evaluated, making this relevant for assessing whether driving world models actually learn physical laws vs. just appearance.

### 2.7 WorldLens (CVPR 2026)

The most comprehensive driving-specific world model evaluation framework.

| Property | Details |
|---|---|
| **Evaluation axes** | 5: Generation, Reconstruction, Action-Following, Downstream Task, Human Preference |
| **Dimensions** | 24 evaluation dimensions across the 5 axes |
| **Scope** | Visual realism, geometric consistency, functional reliability, perceptual alignment |
| **Key finding** | No single model dominates across all axes |

WorldLens addresses a critical gap: existing benchmarks either test generation quality OR downstream task utility, but not both. A world model that generates beautiful videos but fails geometrically or behaviorally is useless for planning.

---

## 3. Data Engines and Auto-Labeling

### 3.1 Tesla's Data Engine

The canonical example of a fleet-scale data engine, operating in a continuous closed loop:

**Pipeline architecture:**
1. **Shadow mode:** Models run passively on fleet vehicles, detecting candidate failures without affecting vehicle behavior
2. **Data upload:** When owners opt in, clips are uploaded to Tesla's supercomputer infrastructure
3. **Auto-labeling:** Fleet data is used to construct precise 3D environment models, which serve as the basis for automatic labeling of new data
4. **Human review:** Auto-labeled data is escalated for human verification before training
5. **Retraining:** Models are retrained on the curated + auto-labeled data
6. **Deployment:** Updated models are pushed to the fleet, restarting the cycle

**Active learning approach:**
- Uncertainty sampling + query-by-committee to identify maximally informative samples
- Selective upload of uncommon scenarios ("trigger" system)
- Fleet of millions of vehicles provides unmatched geographic and scenario diversity
- Simulated data augmentation using synthetic environments for FSD training

**Scale advantage:** No other company operates at Tesla's fleet scale for data collection. This creates a compounding advantage where more data enables better models, which identify more interesting data, which enables even better models.

### 3.2 Auto-Labeling with Foundation Models

**Grounding DINO + SAM pipeline:**
The dominant auto-labeling paradigm in 2024-2025 chains open-vocabulary detection with segmentation:

1. **Grounding DINO** provides open-set 2D object detection from text prompts (52.5 AP on COCO zero-shot)
2. **SAM/SAM2** generates precise segmentation masks from detected boxes
3. Masks are projected onto 3D point clouds via geometric calibration for 3D labels

**ZOPP Framework (NeurIPS 2024):** Combines Grounding DINO features with SAM for zero-shot offboard panoptic perception, specifically designed for autonomous driving. Integrates detection, segmentation, and multi-object tracking in an offboard pipeline.

**UP-VL approach:** Uses VLM textual outputs + spatiotemporal clustering to automatically generate 3D bounding boxes and object tracklets — producing high-quality pseudo labels without any human annotations.

**SAL method:** Employs SAM to generate 2D instance masks, then projects onto 3D point clouds via geometric calibration. These projected masks serve as supervisory signals for training 3D instance segmentation models.

**Grounded SAM 2:** Includes a cascaded auto-label pipeline with caption and phrase grounding capabilities, enabling fully automated annotation workflows at scale.

**Key insight:** Foundation model auto-labeling has shifted the bottleneck from "can we label this data?" to "can we verify the labels are correct?" — quality assurance, not label generation, is now the constraint.

### 3.3 Active Learning for Driving

**ActiveAD (2024):** Planning-oriented active learning that introduces task-specific diversity and uncertainty metrics:
- Three key metrics: Displacement Error, Soft Collision, Agent Uncertainty
- **Critical result:** Using only 30% of training data, ActiveAD matches or exceeds methods trained on 100% of data in both nuScenes (open-loop) and CARLA (closed-loop) evaluation
- Demonstrates that intelligent data selection can substitute for 3x more random data

**Uncertainty sampling strategies:**
- Least Confident sampling: selects frames where the model is most uncertain
- Entropy-based sampling: selects frames with highest prediction entropy
- Practical results: 80% accuracy achievable in 10 iterations with appropriate strategies

**Industrial practice (NVIDIA):**
- Scalable active learning implementation with A/B testing validation
- Continuous improvement loops integrated into production data pipelines

### 3.4 Self-Supervised Pretraining on Driving Data

**OpenDV-YouTube / Vista (OpenDriveLab):**
- 1,700-2,000+ hours of YouTube driving videos used for pretraining
- Self-supervised video prediction as pretraining objective
- Vista model: predicts high-fidelity, long-horizon futures and can serve as a generalizable reward function
- Covers 244 cities across 40 countries — natural distribution of driving world

**DriveVLA-W0 (2025):**
- Uses world modeling (future image prediction) as a dense self-supervised signal for VLA training
- Addresses the "supervision deficit" where sparse action labels underutilize model capacity
- Two instantiations: autoregressive world model (discrete tokens) + diffusion world model (continuous features)
- **Key result:** With data scaling from 70K to 70M frames, world model supervision shows sustained improvement, while action-only supervision saturates
- State-of-the-art on NAVSIM benchmark, surpassing BEV-based and VLA baselines

**Implication for world models:** Self-supervised pretraining on raw driving video, followed by fine-tuning on labeled data, is emerging as the dominant paradigm. World model training objectives naturally provide dense supervision signals that scale better than action-only supervision.

### 3.5 Scaling Laws for Driving Data

Three landmark studies establish the empirical scaling laws:

**Waymo Scaling Laws (June 2025):**
- Studied 500,000 hours of driving data — largest AV scaling study to date
- Motion forecasting quality follows a power-law as a function of training compute
- As training compute grows, optimal scaling requires increasing model size 1.5x faster than dataset size
- Unlike LLMs, optimal AV models tend to be relatively smaller but require significantly more data
- Closed-loop metrics also improve with scaling — first demonstration that real-world AV performance predictably improves with more data/compute

**Data Scaling Laws for E2E Driving (Dec 2024):**
- ONE-Drive dataset: 4 million demonstrations, 30,000+ hours, 23 scenario types
- Open-loop evaluation exhibits power-law relationship with data quantity
- Closed-loop evaluation does NOT follow a simple power law — suggests qualitative phase transitions
- Real-world deployment achieved 24.41 km average miles-per-intervention

**DriveVLA-W0 Scaling (2025):**
- World model objectives amplify data scaling — performance gains accelerate with more data (vs. saturating with action-only supervision)
- Tested across 70K to 70M frames
- World model pretraining fundamentally changes the scaling curve shape

**Practical implications for data collection:**
1. More data reliably improves performance (no plateau observed at current scales)
2. Data quality and diversity matter as much as raw quantity
3. Optimal model sizes are smaller than LLMs, but data requirements are proportionally larger
4. Closed-loop improvement requires data diversity, not just volume

---

## 4. The Data Gap for Airside Operations

### 4.1 Current State: No Public Airside Driving Datasets

The aerospace field has a notable absence of large-scale public datasets and easily accessible simulation tools specifically tailored for autonomous airport navigation. This stands in stark contrast to the road driving domain, which benefits from dozens of large-scale public datasets.

**What exists today:**

| Resource | Type | Scale | Limitations |
|---|---|---|---|
| **Synth_Airport_Taxii** | Synthetic (MS Flight Sim 2020) | Small | Classes: taxiway lane, signs, persons, airplanes, ground vehicles, runway limits. Sim-to-real gap. |
| **AssistTaxi** | Real images (aircraft taxiway) | 300,000+ frames | Only 2 small airports (Melbourne FL, Grant-Valkaria). Aircraft perspective, not ground vehicle. |
| **AeroVect proprietary** | Real fleet data | Undisclosed | Private; collected at major US airports. Not publicly available. |

**Why the gap exists:**
1. **Security restrictions:** Airport ramps are secured areas with strict access control
2. **Liability concerns:** Sensor data from active ramps captures aircraft, personnel, and proprietary operations
3. **Small addressable market:** Fewer companies working on airside autonomy vs. road driving
4. **Equipment diversity:** GSE vehicles (baggage tugs, pushback tractors, belt loaders) vary dramatically
5. **Regulatory vacuum:** No standards or regulations exist for autonomous GSE data collection

### 4.2 Transfer Learning from Road Driving to Airside

**What transfers well:**
- Low-level perception: object detection, segmentation, depth estimation
- Multi-sensor fusion pipelines (LiDAR + camera + radar)
- Occupancy prediction architectures
- Motion forecasting for agent interactions
- Self-supervised visual representations (DINOv2, CLIP features)

**What does NOT transfer:**
- Semantic understanding: road lanes vs. taxiway markings vs. apron boundaries
- Agent behavior models: aircraft follow-me vehicles, pushback procedures, jet blast zones
- Speed regimes: airside operations are typically limited to 8-25 kph
- Right-of-way rules: aircraft always have priority; FOD (Foreign Object Debris) creates unique constraints
- Environment geometry: wide-open aprons vs. structured road networks

**Domain adaptation strategies:**

**ReSimAD (ICLR 2024)** provides a promising template for zero-shot 3D domain transfer:
1. Reconstruct 3D scene-level meshes from source domain (domain-invariant representation)
2. Simulate target-domain-like point clouds conditioned on reconstructed meshes
3. Train perception models on simulated target data

This approach outperforms unsupervised domain adaptation methods that require access to real target domain data — critical for airside where real data is scarce. It has been validated across Waymo-to-KITTI, Waymo-to-nuScenes, and Waymo-to-ONCE transfers.

**Practical strategy for airside transfer:**
1. Pretrain backbone on large-scale road driving data (nuPlan, Waymo, OpenDV-YouTube)
2. Use ReSimAD-style reconstruction-simulation to generate airport-like environments
3. Fine-tune on small real airport dataset (even a few hours of data)
4. Apply continual learning as more real airport data is collected

### 4.3 Synthetic Data Generation for Airside

**Existing platforms and approaches:**

**Microsoft Flight Simulator 2020 (validated for airport use):**
- Synth_Airport_Taxii demonstrates airport-specific synthetic data
- Classes: taxiway lanes, vertical signs, persons, airplanes, horizontal signs, runway limits, ground vehicles
- **Key finding:** Models trained on a mix of real + synthetic images outperform models trained on either alone
- Cost-effective alternative to real-world data collection

**CARLA-style approach adapted for airports:**
- CARLA2Real tool (2024) reduces sim-to-real appearance gap using G-Buffer data from the rendering pipeline
- Enhancing Photorealism Enhancement (EPE) method targets characteristics of real-world datasets
- Domain randomization strategies demonstrate strong generalization when transferring to real data
- Could be extended to airport environments with custom Unreal Engine assets

**Proposed synthetic data pipeline for airside:**
1. **Environment construction:** Build airport ramp environments in Unreal Engine 5 or Unity, using real airport GIS data and satellite imagery for layout accuracy
2. **Asset library:** Model GSE vehicles (tugs, tractors, belt loaders, fuel trucks), aircraft types, personnel, signage, and markings
3. **Behavior simulation:** Implement realistic GSE traffic patterns, aircraft pushback procedures, and pedestrian behavior models
4. **Domain randomization:** Vary lighting (day/night/dusk), weather (rain, fog, snow), surface conditions (wet, icy), and equipment configurations
5. **Sensor simulation:** Generate synthetic LiDAR, camera, and radar data with realistic noise models
6. **Automatic annotation:** Leverage rendering engine metadata for perfect ground-truth labels
7. **Real-data validation:** Continuously calibrate sim-to-real gap using small real-world datasets

### 4.4 Bootstrapping a Data Engine for Airside

Based on Tesla's data engine paradigm, adapted for a niche domain with limited initial data:

**Phase 1: Foundation (0-6 months)**
- Deploy instrumented vehicles (LiDAR + cameras + GPS/RTK) on 2-3 partner airports
- Collect 100-500 hours of raw sensor data during normal operations
- Use foundation model auto-labeling (Grounding DINO + SAM) for initial annotations
- Human-in-the-loop review for safety-critical labels (aircraft proximity, personnel detection)
- Build initial HD maps using AeroVect-style rapid mapping (~2 hours per airport)

**Phase 2: Active Learning Loop (6-18 months)**
- Deploy initial perception models on fleet vehicles in shadow mode
- Use ActiveAD-style uncertainty metrics to identify informative scenarios
- Trigger-based upload: automatically flag near-miss events, unusual objects, degraded visibility
- Maintain scenario database with tagged attributes (weather, time-of-day, traffic density, aircraft type)
- Target: 1,000-5,000 hours of curated data

**Phase 3: World Model Training (12-24 months)**
- Pretrain world model on road driving data (OpenDV-YouTube, nuPlan)
- Fine-tune on airside data with domain-specific objectives
- Use world model for scenario generation to augment real data
- Implement closed-loop evaluation in simulation
- Target: competitive performance on airside-specific benchmarks

**Phase 4: Scaling (18+ months)**
- Expand to 10+ airports for geographic diversity
- Continuous mining for edge cases and rare scenarios
- Implement data balancing strategies for long-tail events
- Build airside-specific foundation model
- Target: 10,000+ hours of diverse airside data

### 4.5 Domain-Specific Pretraining Strategies

**Synthetic Continued Pretraining (ICLR 2025):**
This approach is directly relevant for airside domains where real data is scarce:
1. Start with a small corpus of domain-specific data (e.g., 100h of airport driving)
2. Synthesize a larger corpus using generative methods to make the knowledge more "learnable"
3. Continue pretraining the foundation model on the augmented corpus
4. The synthetic expansion helps the model integrate niche knowledge more effectively

**Recommended pretraining curriculum for airside world models:**

| Stage | Data Source | Objective | Duration |
|---|---|---|---|
| 1 | ImageNet / COCO / general vision | Visual feature learning | Standard pretrained backbone |
| 2 | OpenDV-YouTube (1,700h) | Driving dynamics, multi-agent prediction | 50-100 GPU-days |
| 3 | nuPlan / Waymo (500Kh available) | Structured driving with HD maps | 100-200 GPU-days |
| 4 | Synthetic airport data (rendered) | Airport-specific semantics | 20-50 GPU-days |
| 5 | Real airport data (100-1,000h) | Domain-specific fine-tuning | 10-30 GPU-days |
| 6 | Continual learning on fleet data | Continuous improvement | Ongoing |

**Key principle:** The further up the pyramid, the more compute-efficient the learning becomes because lower stages have already encoded transferable representations. Stage 2-3 provide the dynamics understanding; stages 4-5 specialize the semantics.

---

## 5. Data Curation and Quality

### 5.1 Mining Interesting/Rare Scenarios from Fleet Data

**The challenge:** AV fleets generate terabytes of data daily, but the vast majority captures trivial driving (straight roads, no interactions). Safety-critical rare events — the "long tail" — are where model failures concentrate.

**Applied Intuition's Data Explorer:**
- Foundation model trained on 5B+ text-image pairs via contrastive learning (CLIP-based)
- Two-tower retrieval architecture:
  - **Item tower:** Fleet camera data embedded once during upload (batch GPU processing). For a 20-minute log with 4 cameras at 4Hz, ~20,000 images are embedded.
  - **Query tower:** Natural language queries embedded at query time (real-time CPU processing)
- Engineers search using plain language: "cyclists at night," "construction zones," "jaywalking pedestrians"
- Apache Spark handles scalable nearest-neighbor search across thousands of hours
- Hybrid queries combine natural language + structured data filters simultaneously

**Motional's scenario mining approach:**
- Mining pipelines ingest sensor outputs (LiDAR, images, radar) plus AV software intermediate results (detections, predictions)
- Attribute computation for each scenario enables structured querying
- Scenario-specific data mining targets model weaknesses

**RefAV (2025):** Planning-centric scenario mining that focuses on finding scenarios relevant to specific planning failure modes, not just perceptually interesting ones.

**SMc2f (2025):** Robust scenario mining from coarse to fine — progressively refines scenario search from broad categories to specific safety-critical instances.

### 5.2 Scenario Tagging and Retrieval

**Tagging taxonomy dimensions:**
- **Environmental:** Weather (clear, rain, fog, snow), lighting (day, night, dusk, dawn), road surface (dry, wet, icy)
- **Traffic:** Density (free flow, congested, stopped), agent types (vehicles, pedestrians, cyclists, construction equipment)
- **Behavioral:** Lane changes, turns, merges, U-turns, emergency maneuvers, near-misses
- **Infrastructure:** Intersections, roundabouts, construction zones, school zones, parking lots
- **Temporal:** Time of day, day of week, season, holiday periods

**Retrieval-driven development (AV 3.0 paradigm):**
- Customers continuously mine, assemble, and refresh datasets targeting observed model weaknesses
- Each training iteration starts with a query: "what scenarios does the model handle worst?"
- Foundation models enable natural-language retrieval without predefined tag schemas
- Vector similarity search handles semantic queries that exact tags cannot express

**LLM-based scenario analysis (2025):**
Recent work uses LLMs to analyze driving scenarios in natural language, enabling queries like "Why was the vehicle braking?" and extracting structured scenario descriptions from raw driving logs.

### 5.3 Data Balancing Strategies

**The curse of rarity (Nature Communications, 2024):**
The rarity of safety-critical events in high-dimensional variable spaces presents fundamental challenges. Simply collecting more data does not proportionally increase coverage of the long tail — the number of possible rare combinations grows exponentially.

**Strategies at the data level:**
1. **Oversampling rare events:** Duplicate or augment underrepresented scenarios. Risk: overfitting to specific rare instances
2. **Undersampling common events:** Remove redundant "boring" driving. Risk: losing contextual diversity
3. **Importance sampling:** Weight training examples by their information value. ActiveAD achieves 100% performance with 30% of data using this approach
4. **Synthetic augmentation:** Generate rare scenarios using GANs, VAEs, diffusion models, or simulators. Risk: synthetic artifacts, domain gap
5. **Curriculum learning:** Train on progressively harder scenarios, spending more compute on difficult examples

**Strategies at the model level:**
1. **Loss re-weighting:** Higher loss weight for rare classes/scenarios
2. **Meta-learning for long-tail:** Differentiable semantic meta-learning specifically designed for long-tail motion forecasting (2025)
3. **Contrastive learning:** Learn representations that distinguish rare events from common ones
4. **Model uncertainty as a signal:** Let the model identify its own areas of confusion for targeted data collection

**Industrial best practice:**
Combine real-world data mining + simulation-based augmentation + active learning, ensuring a balance between reliability (real data) and coverage (synthetic data) for rare scenarios.

### 5.4 Privacy and Anonymization for Airport Data

**Regulatory context:**
Airport ramp data presents heightened privacy concerns beyond typical road driving:
- Employee identification (ground handlers, maintenance personnel)
- Aircraft registration numbers and airline-specific operations
- Security procedures and restricted area layouts
- Temporal patterns of operations (flight schedules, staffing patterns)
- Location-based privacy risks from GPS/RTK data

**Anonymization techniques:**

**Visual anonymization:**
- **Face blurring/replacement:** PP4AV provides benchmarking dataset and methods for face/license plate anonymization in driving contexts
- **Deep Natural Anonymization:** Replaces identifiable features with synthetic alternatives while preserving semantic content
- **Badge/uniform anonymization:** Airport-specific requirement to obscure employee identification
- **Aircraft registration masking:** Remove or blur tail numbers and airline-specific livery details

**Spatial anonymization:**
- **Trajectory perturbation:** Add noise to GPS tracks to prevent re-identification of specific routes
- **Temporal obfuscation:** Shift timestamps to prevent correlation with flight schedules
- **Map generalization:** Remove airport-specific details from HD maps before public release

**Data-minimization approaches:**
- Process sensor data onboard, upload only embeddings/features rather than raw images
- Federated learning: train models locally at each airport without centralizing raw data
- Synthetic data generation as a privacy-preserving alternative to real data sharing
- Differential privacy for aggregate statistics about airport operations

**Recommended pipeline for airport data:**
1. **Onboard processing:** Run face/badge/registration detection immediately on capture
2. **Automatic anonymization:** Apply Deep Natural Anonymization before data leaves the vehicle
3. **Access control:** Role-based access — only safety team sees raw data; ML team works with anonymized data
4. **Audit trail:** Log all data access for regulatory compliance
5. **Retention policy:** Auto-delete raw data after anonymized version is verified; retain only anonymized data long-term
6. **Security classification:** Tag each data element with sensitivity level (public / internal / restricted / confidential)

---

## Summary: Key Takeaways for World Model Development

### Dataset landscape
- **For pretraining:** OpenDV-YouTube (1,700h+ diverse video) and nuPlan/Waymo (massive scale with annotations) provide the best foundation
- **For benchmarking:** OpenScene + NAVSIM is the current standard for world model evaluation; WorldLens (CVPR 2026) provides the most comprehensive evaluation framework
- **For language grounding:** DriveLM and CoVLA enable vision-language-action world model training

### Scaling laws
- Performance improves as a power-law with compute (similar to LLMs)
- Optimal AV models are relatively small but require disproportionately more data than LLMs
- World model pretraining objectives amplify scaling — DriveVLA-W0 shows sustained improvement to 70M frames where action-only supervision saturates

### For airside operations
- No public datasets exist; this is simultaneously a challenge and an opportunity
- Transfer learning from road driving provides a strong foundation for low-level perception
- Synthetic data from Unreal Engine / Flight Simulator is validated as a viable supplement
- A phased data engine approach (instrument -> collect -> auto-label -> active-learn -> scale) can bootstrap from near-zero data
- Privacy/security requirements demand onboard anonymization and federated learning approaches

### Data engine essentials
- Foundation model auto-labeling (Grounding DINO + SAM) has shifted the bottleneck from label generation to label verification
- Active learning can achieve full performance with 30% of data (ActiveAD)
- Scenario mining with embedding-based retrieval (Applied Intuition's approach) enables natural-language data discovery at scale
- The data balancing challenge requires combining real mining + synthetic generation + importance sampling

---

## Sources

### Datasets
- [nuScenes](https://www.nuscenes.org/)
- [nuScenes Revisited: Progress and Challenges](https://arxiv.org/html/2512.02448v1)
- [nuPlan](https://motional.com/news/motionals-nuplan-dataset-set-usher-next-generation-autonomous-vehicles)
- [NuPlanQA](https://arxiv.org/html/2503.12772v1)
- [Waymo Open Dataset](https://waymo.com/open/)
- [WOD-E2E](https://arxiv.org/html/2510.26125v1)
- [Argoverse 2](https://www.argoverse.org/av2.html)
- [Argoverse 2 Paper](https://arxiv.org/abs/2301.00493)
- [KITTI](https://www.cvlibs.net/datasets/kitti/)
- [KITTI-360](https://www.cvlibs.net/datasets/kitti-360/)
- [PandaSet](https://arxiv.org/pdf/2112.12610v1)
- [ONCE Dataset](https://arxiv.org/abs/2106.11037)
- [OpenScene GitHub](https://github.com/OpenDriveLab/OpenScene)
- [DriveLM](https://github.com/OpenDriveLab/DriveLM)
- [Talk2Car](https://talk2car.github.io/)
- [CoVLA](https://arxiv.org/abs/2408.10845)
- [OpenDV / DriveAGI](https://github.com/OpenDriveLab/DriveAGI)
- [V2X-Real (ECCV 2024)](https://dl.acm.org/doi/10.1007/978-3-031-72943-0_26)
- [WayveScenes101](https://www.basic.ai/blog-post/15-new-autonomous-driving-datasets-in-2024-2025)

### Benchmarks
- [NAVSIM GitHub](https://github.com/autonomousvision/navsim)
- [NAVSIM Paper](https://arxiv.org/abs/2406.15349)
- [nuScenes Prediction Task](https://www.nuscenes.org/prediction)
- [Waymo Sim Agents Challenge](https://waymo.com/open/challenges/)
- [CARLA Leaderboard](https://leaderboard.carla.org/)
- [Bench2Drive](https://github.com/Thinklab-SJTU/Bench2Drive)
- [WorldModelBench](https://arxiv.org/abs/2502.20694)
- [WorldLens](https://worldbench.github.io/worldlens)
- [UniOcc](https://arxiv.org/html/2503.24381)

### Data Engines and Scaling
- [Tesla Data Engine Explained](https://www.arrow.com/en/research-and-events/articles/autonomous-vehicle-training-and-teslas-data-engine-explained)
- [Waymo Scaling Laws](https://waymo.com/blog/2025/06/scaling-laws-in-autonomous-driving/)
- [Waymo Scaling Laws Paper](https://arxiv.org/abs/2506.08228)
- [DriveVLA-W0](https://arxiv.org/abs/2510.12796)
- [Data Scaling Laws for E2E Driving](https://arxiv.org/abs/2412.02689)
- [ActiveAD](https://arxiv.org/html/2403.02877v1)
- [Applied Intuition Data Mining](https://www.appliedintuition.com/blog/ai-for-mining-massive-autonomy-datasets)
- [Grounding DINO](https://github.com/IDEA-Research/GroundingDINO)
- [ZOPP (NeurIPS 2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/fdb0c77c157d066942f060ae193395c1-Paper-Conference.pdf)

### Airside and Domain Adaptation
- [Synth_Airport_Taxii](https://github.com/Robcib-GIT/Synth_Airport_Taxii)
- [Validating Synthetic Data for Airport Navigation](https://www.mdpi.com/2226-4310/11/5/383)
- [AssistTaxi Dataset](https://arxiv.org/abs/2409.06856)
- [AeroVect](https://www.aerovect.com/)
- [AeroVect Case Study](https://pointonenav.com/news/aerovects-autonomous-gse-case-study/)
- [ReSimAD (ICLR 2024)](https://arxiv.org/abs/2309.05527)
- [CARLA2Real](https://arxiv.org/html/2410.18238v4)
- [Autonomous GSE Future](https://airsideint.com/issue-article/autonomous-gse-and-the-future-of-airside-operations/)

### Privacy and Data Quality
- [PP4AV Dataset](https://github.com/khaclinh/pp4av)
- [Anonymization for AD Data Privacy](https://dxc.com/us/en/insights/perspectives/paper/how-anonymization-can-solve-autonomous-driving-data-privacy-challenges)
- [Curse of Rarity for AVs](https://www.nature.com/articles/s41467-024-49194-0)
- [Long-Tail Scenarios in AD](https://www.labelvisor.com/long-tail-scenarios-in-autonomous-driving-handling-rare-events-edge-cases/)
- [Synthetic Continued Pretraining (ICLR 2025)](https://proceedings.iclr.cc/paper_files/paper/2025/file/6dcf277ea32ce3288914faf369fe6de0-Paper-Conference.pdf)
