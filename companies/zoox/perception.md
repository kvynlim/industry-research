# Zoox Perception Stack — Exhaustive Deep Dive

> Compiled March 2026 from Zoox Journal articles, Amazon Science publications, AWS re:Invent 2025 talks,
> NHTSA filings, NVIDIA partnership disclosures, patent filings, job postings, Teledyne FLIR and Hesai
> product documentation, and trade press.

---

## Table of Contents

1. [Triple-Redundant Perception Architecture](#1-triple-redundant-perception-architecture)
2. [Sensor Fusion](#2-sensor-fusion)
3. [LWIR Thermal Camera Integration](#3-lwir-thermal-camera-integration)
4. [Sensor Staleness Framework](#4-sensor-staleness-framework)
5. [Neural Network Architectures](#5-neural-network-architectures)
6. [Object Detection](#6-object-detection)
7. [Object Tracking](#7-object-tracking)
8. [Prediction System (QTP)](#8-prediction-system-qtp)
9. [Microphone-Based Perception](#9-microphone-based-perception)
10. [Point Cloud Processing](#10-point-cloud-processing)
11. [Camera Perception](#11-camera-perception)
12. [Radar Processing](#12-radar-processing)
13. [Occupancy and Scene Representations](#13-occupancy-and-scene-representations)
14. [Coordinate Frames and BEV Representation](#14-coordinate-frames-and-bev-representation)
15. [Temporal Fusion](#15-temporal-fusion)
16. [Foundation Model for Perception](#16-foundation-model-for-perception)
17. [Auto-Labeling and Annotation](#17-auto-labeling-and-annotation)
18. [Non-ML Components: Geometric Collision Avoidance](#18-non-ml-components-geometric-collision-avoidance)
19. [Calibration (CLAMS)](#19-calibration-clams)
20. [Key Patents](#20-key-patents)
21. [Key Publications and Conference Appearances](#21-key-publications-and-conference-appearances)
22. [Sources](#22-sources)

---

## 1. Triple-Redundant Perception Architecture

Zoox operates **three independent, simultaneous perception systems** — a design without precedent in the autonomous vehicle industry. The systems are architecturally diverse by design: they use different algorithms, different sensor subsets, and different software stacks to avoid **common-cause failures** (a single bug or algorithmic flaw cannot disable all three).

### 1.1 System 1: Main AI System

The primary perception pipeline — the most computationally expensive and sophisticated of the three.

| Attribute | Detail |
|---|---|
| **Type** | ML-based, multi-model ensemble |
| **Sensor inputs** | All five modalities: cameras, LiDAR, radar, LWIR thermal, microphones |
| **Functions** | Detection, classification, tracking, semantic segmentation, motion modeling |
| **Outputs** | 3D bounding boxes with class labels, velocity estimates, tracked object states, semantic maps |
| **Update cadence** | Real-time, multiple times per second |

RJ He (Director of Perception): *"The first system uses a variety of machine learning models and obtains a sophisticated understanding of the world around the vehicle. This includes our vision, lidar, and radar sensors — all needed for detection, tracking, and segmentation. We also use a motion modeling system that gives our system an understanding of how agents move through the world."*

The Main AI System produces the primary perception output consumed by the Prediction and Planner modules. It performs **early fusion** of multi-modal sensor data (see Section 2), runs CNNs for bird's-eye-view scene representation (see Section 5), and maintains multi-object tracked states over time (see Section 7).

### 1.2 System 2: Geometric Collision Avoidance (GCA)

| Attribute | Detail |
|---|---|
| **Type** | Non-ML, rule-based geometric algorithms |
| **Sensor inputs** | Raw sensor data (primarily LiDAR and radar point returns) |
| **Function** | Detects physical obstructions in the vehicle's **intended driving path** |
| **Scope** | 360-degree, but focused on the planned trajectory corridor |
| **Latency** | Optimized for **low end-to-end latency** — faster than the Main AI System |
| **Failure mode independence** | Architecturally different from the Main AI System to avoid common-cause failures |

The GCA system operates on **direct geometric reasoning** — it does not classify objects or predict trajectories. It answers a simpler but critical question: *"Is there something physically in our path?"* This is achieved through interpretable algorithms that check sensor returns against the vehicle's planned trajectory geometry. Because it uses no learned parameters, it is immune to the classes of failure that affect neural networks (distribution shift, adversarial inputs, training data gaps).

The GCA system can trigger the vehicle's **Collision Avoidance System (CAS)**, which assumes full control of braking and steering at millisecond-level response times — faster than the primary Planner's multiple-times-per-second update cycle.

### 1.3 System 3: Safety Net

| Attribute | Detail |
|---|---|
| **Type** | ML-based, but architecturally independent from the Main AI System |
| **Sensor inputs** | Sensor data (details not disclosed; likely a subset) |
| **Functions** | Detection + short-horizon trajectory prediction |
| **Scope** | 360 degrees around the vehicle |
| **Trigger condition** | If future collision probability exceeds a threshold, triggers emergency stop |
| **Latency** | Optimized for low end-to-end latency |

RJ He: *"[The Safety Net is] a machine-learned algorithm... that performs both detection and prediction of future movement in a short time horizon, 360 degrees around our vehicle."*

The Safety Net differs from the Main AI System in that it combines detection and prediction into a single, streamlined pipeline with a shorter time horizon — prioritizing speed of response over the detailed scene understanding the Main AI System provides. It is designed to catch threats that the Main AI System might process too slowly to avoid.

### 1.4 How the Three Systems Interact

```
                    +-----------------+
   All 5 sensor  -->| Main AI System  |--> Perception output --> Prediction --> Planner
   modalities       +-----------------+

   Raw sensor    -->| Geometric       |--> Path obstruction  --> CAS (emergency brake/steer)
   returns          | Collision Avoid. |    detected?

   Sensor data   -->| Safety Net      |--> Collision probability --> CAS (emergency stop)
                    +-----------------+    exceeds threshold?
```

**Override hierarchy:**
- The **Planner** normally controls the vehicle based on Main AI System perception + Prediction outputs.
- The **CAS** (fed by GCA and Safety Net) can **override the Planner** and assume direct control of braking and steering when either backup system detects an imminent collision.
- The CAS operates at **millisecond-level latency**, faster than the Planner's update cycle.
- This parallels aviation's flight envelope protection systems, where automated safety systems can override pilot inputs.

**Key design principles:**
1. **Architectural diversity** — Different algorithms, different software stacks, different sensor subsets to prevent common-cause failures.
2. **Latency optimization** — The backup systems (GCA and Safety Net) are optimized for speed, not comprehensiveness.
3. **Threshold-based triggering** — The Safety Net triggers on probabilistic collision thresholds, not deterministic object classification.
4. **Continuous concurrent operation** — All three systems run simultaneously at all times; they do not take turns.

---

## 2. Sensor Fusion

### 2.1 Five Sensor Modalities

Zoox is the only autonomous vehicle company using all five of these modalities simultaneously:

| Modality | Quantity | Primary Role | Strengths | Weaknesses |
|---|---|---|---|---|
| **RGB Cameras** | ~28 (wide + telephoto) | Color, classification, traffic lights, gestures | High resolution, rich semantic content | Degraded in low light, rain, fog |
| **LiDAR** | Multiple Hesai units | 3D geometry, precise ranging | Millions of points/sec, accurate depth | Degraded in heavy rain/snow; no color |
| **LWIR Thermal** | Multiple Teledyne FLIR Boson modules | Heat signatures: people, animals | Works in total darkness and fog | Lower resolution than RGB; no color |
| **Radar** | Units at each corner | Velocity, long-range detection | Penetrates rain/fog/snow; direct velocity | Low angular resolution; clutter |
| **Microphones** | Directional arrays | Emergency vehicle sirens | Detects through occlusion; 360-degree | Ambient noise; limited object types |

### 2.2 Sensor Pod Architecture

All sensors are mounted in **identical pods at each of the four vehicle corners**, positioned high and wide on the roof. Each corner pod achieves **270-degree field of view**. The four overlapping 270-degree FOVs produce complete **360-degree coverage** with substantial overlap, meaning:

- Every direction is covered by sensors from **at least two corners**.
- The vehicle can "almost always see around and behind the objects nearest to us, which is particularly helpful in dense urban environments" (Jesse Levinson, CTO).
- If any individual sensor fails, coverage from adjacent pods fills the gap (**fail-operational**).

### 2.3 Early Fusion Architecture

Zoox employs **early fusion** — raw data from all sensor modalities is combined **before** independent object detection occurs. This is in contrast to **late fusion**, where each sensor modality runs its own detection pipeline and results are merged afterward.

Bat-El Shlomo (Director, Perception) described the evolution: the system moved from "late fusion" where *"each sensor would make its own predictions about the world"* to integrated early fusion using *"shared representation layers that combine information across sensor types from the beginning,"* enabling richer environmental interpretations.

**Early fusion advantages for Zoox:**
- Cross-modal features (e.g., a warm blob in LWIR aligned with a LiDAR cluster and a camera bounding box) are available to the network from the start.
- The network learns which modality to trust in which conditions (e.g., radar in rain, LWIR at night).
- Reduces the "voting" problem inherent in late fusion, where conflicting per-sensor detections must be reconciled.

**Fusion pipeline (inferred architecture):**

```
Raw Camera Images ----\
Raw LiDAR Points ------\
Raw Radar Returns --------> [Early Fusion Backbone] --> Shared Feature Representation
Raw LWIR Frames --------/                                       |
Raw Audio ---------------/                                      v
                                                    [Detection / Segmentation Heads]
                                                              |
                                                              v
                                                    3D Bounding Boxes, Classes,
                                                    Velocities, Semantic Maps
```

### 2.4 Temporal Information in Fusion

Sensor fusion incorporates temporal information for velocity estimation and scene flow. Each data point carries timestamp metadata (see Section 4 on Sensor Staleness), enabling the fusion backbone to reason about motion across frames and handle sensor asynchrony.

---

## 3. LWIR Thermal Camera Integration

Zoox is the **first and only autonomous vehicle company** to integrate longwave infrared (LWIR) thermal cameras into its production sensor suite. This is a significant differentiator.

### 3.1 Hardware: Teledyne FLIR Boson

| Specification | Value |
|---|---|
| **Sensor** | Teledyne FLIR Boson uncooled microbolometer |
| **Resolution** | 640 x 512 pixels |
| **Pixel pitch** | 12 micrometers |
| **Spectral band** | 7.5 - 13.5 micrometers (LWIR) |
| **Frame rate** | 30 Hz or 60 Hz |
| **Cooling** | Uncooled (no cryogenic cooler required) |
| **On-module VPU** | Intel Movidius Myriad 2 Vision Processing Unit |
| **NETD** | < 40 mK (typical for Boson 640) |
| **Form factor** | Compact module designed for OEM integration |

### 3.2 Intel Movidius Myriad 2 VPU

Each Boson module contains an integrated **Intel Movidius Myriad 2 VPU**, which provides:

| Attribute | Detail |
|---|---|
| **Architecture** | Heterogeneous multi-core with 12 SHAVE vector processors |
| **Performance** | ~1 TOPS (tera-operations per second) |
| **Power** | ~1 W typical |
| **Function** | On-sensor preprocessing — likely performs initial thermal image processing (flat-field correction, non-uniformity correction, radiometric calibration) before data reaches the main compute platform |

The VPU handles thermal-specific preprocessing at the sensor level, reducing the load on the central NVIDIA GPU compute platform and minimizing data bandwidth between sensor pods and the vehicle's compute module.

### 3.3 What LWIR Enables

**Pedestrian detection in darkness:**
- Humans emit thermal radiation at ~9.4 micrometers (peak), falling squarely within the Boson's 7.5-13.5 micrometer band.
- A person is clearly visible in LWIR even in **total darkness** (no streetlights), where RGB cameras are blind.
- LWIR contrast between a human body (~37 degrees C) and ambient environment is typically 10-20 degrees C, producing strong signal-to-noise ratios.

**Animal detection:**
- Animals (dogs, deer, cats) also emit strong thermal signatures, making LWIR critical for detecting animals that are invisible or near-invisible to cameras and LiDAR in low-light conditions.

**Adverse weather performance:**
- LWIR is less affected by fog, light rain, and dust than visible-light cameras.
- Thermal signatures penetrate many conditions that degrade RGB camera performance.

**Fusion with RGB and LiDAR:**
- In the early fusion architecture, LWIR thermal features are combined with co-registered RGB camera images and LiDAR point clouds.
- This enables the perception system to detect objects that any single modality would miss:
  - Dark-clothed pedestrian at night: invisible to camera, weak LiDAR return, strong LWIR signature.
  - Vehicle behind fog: weak camera/LiDAR, strong radar return, visible LWIR heat signature.

### 3.4 End-of-Line Calibration

During manufacturing at the Hayward facility, LWIR cameras are calibrated alongside all other sensors in a dedicated calibration bay. The process uses **halogen lights** that serve dual purposes: calibrating visible-spectrum cameras while simultaneously **heating dots on calibration boards** to create thermal targets for LWIR camera calibration on the same surface.

---

## 4. Sensor Staleness Framework

Deployed to the fleet in **summer 2025**, the sensor staleness framework is one of Zoox's most significant perception innovations. It was published under the Amazon Science umbrella and is **model-agnostic** — applicable to any perception architecture.

### 4.1 The Problem

In a multi-sensor fusion system, different sensor modalities have **different processing latencies**:

| Sensor | Typical Latency Factors |
|---|---|
| **LiDAR** | Point cloud accumulation time (depends on rotation speed), preprocessing |
| **Cameras** | Exposure time, ISP pipeline, image encoding, neural network inference |
| **Radar** | Waveform processing, Doppler computation |
| **LWIR** | Thermal image capture, VPU preprocessing |

When one sensor stream arrives late (is "stale"), the fusion system has data from different moments in time. At urban driving speeds, even tens of milliseconds of staleness can mean an object has moved significantly from where the stale sensor last observed it. This creates:
- **Ghost detections** (object appears at both old and new positions)
- **Missed detections** (stale data contradicts fresh data, causing mutual cancellation)
- **Incorrect velocity estimates** (temporal misalignment corrupts motion inference)

The traditional approach was to **discard stale data entirely**, which wastes useful information and creates sensor dropout gaps.

### 4.2 The Solution: Timestamp Features + Synthetic Stale Training

**Step 1: Timestamp features added to every data point.**

Every sensor measurement — every LiDAR point, every camera pixel, every radar return — is augmented with a **timestamp feature** encoding its age relative to the current inference time. This gives the perception model explicit awareness of *how old* each piece of data is.

The timestamp features enable "fine-grained temporal awareness in sensor fusion." Rather than the model implicitly assuming all data is synchronous, it can learn to weight or compensate for stale data appropriately.

**Step 2: Synthetic stale data for training.**

Zoox generates training data with artificially introduced staleness using **real-world vehicle logs**:
- Take a real-world driving log with perfectly synchronized sensor data.
- Artificially delay one or more sensor streams by varying amounts.
- Present this synthetically stale data to the model during training with the original (non-stale) ground truth labels.

This approach is described as "like a vaccine — by training our model on a concentrated dose of stale data, we can prepare it to recognize and manage staleness in the real world."

**Step 3: Layered deployment strategy.**
- For **minor temporal misalignments**: Use the staleness-augmented model, which can correctly interpret slightly stale data.
- For **complete sensor failures or persistent/severe misalignment**: Drop the data entirely.

### 4.3 Results

| Metric | Improvement |
|---|---|
| **Pedestrian detection precision** | **2x** (doubled) |
| **Pedestrian detection recall** | **~6x** (~600% increase) |
| **Cyclist detection** | Significant improvement (exact figures not disclosed) |
| **Car detection** | Significant improvement (exact figures not disclosed) |
| **Performance on non-stale data** | Nearly identical to baseline (no degradation) |
| **Latency impact** | Near-zero |

The 6x recall improvement for pedestrians is particularly noteworthy — it means the system went from missing a large fraction of pedestrians during sensor staleness events to detecting nearly all of them. This directly addresses the NHTSA recall 25E-037 (May 2025), which involved failure to detect a prone vulnerable road user at very close range.

### 4.4 Why Model-Agnostic?

The timestamp feature approach works regardless of the underlying perception model architecture. It is an **input augmentation** technique, not an architectural change. This means it can be applied to:
- CNN-based detectors
- Transformer-based detectors
- Any future architecture

Zoox explicitly notes the potential to benefit other autonomous vehicle teams encountering similar synchronization challenges.

---

## 5. Neural Network Architectures

### 5.1 Bird's-Eye-View CNN (~60 Semantic Channels)

The core perception representation is a **bird's-eye-view (BEV) multi-channel image** processed by convolutional neural networks. This is not a standard RGB image — it has approximately **60 channels (layers)** encoding diverse semantic information.

**What the ~60 channels encode (confirmed and inferred):**

| Channel Type | Example Encoding | Source |
|---|---|---|
| **Agent presence** | Binary mask: 1 where a pedestrian/vehicle/cyclist exists, 0 elsewhere | Confirmed |
| **Agent attributes** | Pedestrian holding smartphone (1/0) — "someone holding a smartphone tends to behave differently" | Confirmed (Andres Morales, Amazon Science) |
| **Agent geometry** | Bounding box dimensions (width, length), heading, position | Confirmed (Scenario Diffusion paper) |
| **Agent velocity** | Speed and direction vectors per agent | Inferred from motion modeling references |
| **Agent trajectory history** | Past positions over recent time steps | Inferred from prediction pipeline description |
| **Road geometry** | Lane boundaries, lane centers, road edges | Inferred from BEV representation requirements |
| **Traffic control** | Traffic light states, stop sign locations, crosswalk boundaries | Inferred from ZRN semantic layer |
| **Speed limits** | Encoded per road segment | Confirmed as part of ZRN |
| **Drivable surface** | Binary mask of where the vehicle can legally drive | Inferred from planner hard constraints |
| **Crosswalk occupancy** | Pedestrian presence in crosswalks | Inferred from recall 25E-019 (crosswalk behavior) |
| **Construction zones** | Temporary road modifications | Confirmed (vehicle detects unmapped construction) |
| **Bike lanes** | Bicycle lane locations and boundaries | Confirmed as part of ZRN |
| **Elevation/height** | Ground plane or height map from LiDAR | Inferred from 3D scene understanding |

Kai Wang (Director, Prediction): *"We draw everything into a 2D image and present it to a [convolutional neural network] [CNN], which in turn determines what distances matter, what relationships between agents matter, and so on."*

Andres Morales (Staff Engineer): *"This is not an RGB image. It's got about 60 channels, or layers, which also include semantic information. For example, because someone holding a smartphone tends to behave differently, we might have one channel that represents a pedestrian holding their phone as a '1' and a pedestrian with no phone as a '0'."*

### 5.2 Graph Neural Networks (GNNs)

GNNs are used as a **message-passing system** to model interactions between agents and scene elements.

Mahsa Ghafarianzadeh (Senior Engineer): *"Think of the GNN as a message-passing system by which all the agents and static elements in the scene are interconnected. What this enables is the explicit encoding of the relationships between all the agents in the scene, as well as the Zoox vehicle, and how these relationships might develop into the future."*

**GNN architecture (inferred):**
- **Nodes** represent agents (vehicles, pedestrians, cyclists) and static elements (traffic lights, stop signs).
- **Edges** represent relationships (proximity, line-of-sight, shared lane, yield relationships).
- **Message passing** propagates information between connected nodes over multiple rounds, enabling each agent's representation to incorporate context from all nearby agents.
- The GNN output feeds into trajectory prediction (see Section 8).

### 5.3 Other Model Architectures

| Architecture | Use Case |
|---|---|
| **CNNs** | BEV perception (~60 channels), camera-based detection |
| **GNNs** | Agent interaction modeling, trajectory prediction |
| **Latent Diffusion Models** | Scenario Diffusion (NeurIPS 2023) — synthetic scenario generation |
| **Gaussian Splatting / NeRFs** | Neural rendering for 3D scene reconstruction in simulation |
| **Foundation model (Qwen VL)** | Multimodal perception + control (see Section 16) |

### 5.4 Motion Modeling System

The Main AI System includes a dedicated **motion modeling system** that provides "an understanding of how agents move through the world." This likely operates on tracked object states over time, estimating:
- Instantaneous velocity and acceleration
- Turning rates
- Motion patterns (e.g., walking, running, cycling cadence)

---

## 6. Object Detection

### 6.1 Detection Classes

The perception system detects, classifies, and tracks the following object types (confirmed from Zoox sources):

| Class | Details |
|---|---|
| **Vehicles** | Cars, trucks, buses, motorcycles |
| **Pedestrians** | Adults, children; attributes include phone-holding, gestures |
| **Cyclists** | Bicyclists, e-scooter riders |
| **Animals** | Dogs, cats, and other animals (via LWIR thermal) |
| **Emergency vehicles** | Detected via siren audio + visual cues |
| **Construction zone elements** | Road cones, signs, barriers |
| **Static obstacles** | Debris, fallen objects, road infrastructure |
| **Traffic control devices** | Traffic lights (including arrow signals), stop signs, yield signs |
| **Vulnerable Road Users (VRUs)** | Supercategory encompassing pedestrians, cyclists, scooter riders |

### 6.2 Detection Format

Detections are output as **3D bounding boxes** in the vehicle's coordinate frame:

| Attribute | Detail |
|---|---|
| **Position** | (x, y, z) center in ego-centric coordinates |
| **Dimensions** | Width, length, height |
| **Heading** | Orientation angle |
| **Velocity** | (vx, vy) from radar direct measurement + motion model |
| **Class label** | Categorical classification |
| **Confidence score** | Detection confidence (probability) |
| **Attributes** | Object-specific metadata (e.g., pedestrian holding phone, traffic light color) |

### 6.3 Detection Ranges

| Condition | Range |
|---|---|
| **General detection** | Up to **200 meters** in all directions (confirmed by Zoox) |
| **LiDAR maximum range** | **210 meters** at 10% reflectivity (Hesai AT128 spec) |
| **Radar** | Longer-range than LiDAR for large objects; specific range undisclosed |
| **Cameras (telephoto)** | Extended range for traffic lights and signs |
| **LWIR thermal** | Effective for detecting humans at ranges where cameras struggle in darkness |

### 6.4 Recall Insights into Detection Gaps

NHTSA recalls provide rare insight into perception failure modes:

**Recall 25E-019 (March 2025):** Over-cautious hard braking for bicyclists near crosswalks. The perception/prediction system incorrectly anticipated collision from the rear, triggering unnecessary hard braking. This was a **false positive** prediction issue, not a missed detection.

**Recall 25E-037 (May 2025):** At speeds below 0.5 m/s, failure to detect a **prone VRU immediately adjacent** to the vehicle. Fix: software update to improve perception tracking and prevent vehicle movement when a vulnerable road user may be very near the vehicle. This was a near-field detection gap — extremely close range, unusual pose (prone/lying down).

**Recall 25E-090 (December 2025):** Unnecessary lane-line crossing at/near intersections (62 instances, zero collisions). This was a planning/perception interaction issue with lane boundary understanding.

---

## 7. Object Tracking

### 7.1 Multi-Object Tracking (MOT)

The Main AI System maintains tracked states for all detected objects over time. While Zoox has not disclosed the specific tracking algorithm, the system performs:

| Function | Detail |
|---|---|
| **Track initiation** | New detections are assigned unique track IDs |
| **Track association** | Frame-to-frame matching of detections to existing tracks (likely using Mahalanobis distance, IoU, or learned association) |
| **State estimation** | Position, velocity, acceleration, heading, turn rate — maintained via filtering (likely Kalman filter variants or learned state estimators) |
| **Track lifecycle** | Tracks are maintained through temporary occlusions and re-identified when objects reappear |
| **Track termination** | Tracks are dropped after sustained non-detection |

### 7.2 Motion Modeling

The dedicated motion modeling system provides:
- **Agent kinematics**: Position, velocity, acceleration, heading rate
- **Motion patterns**: Classification of motion type (stationary, walking, running, cycling, driving)
- **Historical trajectory**: Recent past positions used for prediction input

### 7.3 Tracking Across Sensor Modalities

In the early fusion architecture, tracking operates on the fused representation rather than per-sensor tracks. This avoids the classic multi-sensor tracking problem of track-to-track association between independent sensor pipelines.

---

## 8. Prediction System (QTP)

### 8.1 Evolution: UAP to QTP

| System | Architecture | Approach | Limitation |
|---|---|---|---|
| **UAP** (Unified Active Prediction) | Graph-based neural network | Assumption-based: modeled expected behaviors (following lanes, stopping at lights) | "Had trouble modeling unexpected outcomes, like jaywalkers or illegal U-turns" |
| **QTP** (Query-centric Trajectory Prediction) | Data-driven CNN + GNN | Learns behavior directly from data: "behavior pulled directly from the data" | Requires very large training datasets; rare scenarios underrepresented |

QTP's core philosophy: *"Building flexible models that are based on how people actually behave, not how they're supposed to."*

### 8.2 QTP Architecture

```
Perception Output (tracked objects + semantic scene)
                    |
                    v
    [~60-Channel BEV Image Encoding]
                    |
                    v
    [CNN Feature Extraction]
                    |
                    v
    [GNN Message Passing Between Agents]
                    |
                    v
    [Trajectory Distribution Output]
        |           |           |
        v           v           v
    Trajectory 1  Traj. 2   Traj. N  (probabilistic, multi-modal)
```

**Input representation:**
- The ~60-channel BEV image (see Section 5.1) encodes the complete scene.
- CNN processes this image to extract spatial features capturing road geometry, agent positions, and semantic context.
- GNN takes the per-agent features from the CNN and performs message passing to model agent-agent interactions.

**Output:**
- **Probabilistic trajectory distributions** for every detected agent — not a single predicted path but a distribution over possible futures.
- Predictions range from **most probable to least probable scenarios**.
- Recalculated **every 100 milliseconds** (10 Hz) as new perception data arrives.

### 8.3 Prediction Horizon and Update Rate

| Parameter | Value |
|---|---|
| **Prediction horizon** | Up to **8 seconds** into the future |
| **Update rate** | Every **100 milliseconds** (10 Hz) |
| **Training data** | **Billions** of real-world samples |
| **Training approach** | Self-supervised — actual future trajectories serve as ground truth |

### 8.4 Conditional Prediction

QTP supports **action-conditioned prediction** — it can answer: *"If I perform action X, or Y, or Z, how are the agents in my vicinity likely to adjust their own behavior in each case?"*

This is critical for the Planner: when evaluating candidate trajectories, the Planner queries QTP with different possible Zoox actions, and QTP predicts how other agents would respond to each. This creates a **coupled prediction-planning loop** where the vehicle anticipates how its own actions influence the behavior of others.

### 8.5 Synthetic Data for Rare Scenarios

QTP's primary weakness is that rare scenarios (jaywalking, illegal U-turns, unusual construction zones) are underrepresented in real-world training data. Zoox addresses this with:

1. **Scenario Diffusion** (NeurIPS 2023) — generative AI model that creates synthetic driving scenarios from noise in ~1 second per scenario on a single GPU.
2. **Procedural simulation** — system-generated scenarios that discover edge cases engineers might not anticipate.
3. **Log-based replay** — situations the software struggled with, replayed from real-world test fleet data.

---

## 9. Microphone-Based Perception

### 9.1 Emergency Vehicle Siren Detection

Zoox vehicles carry **directional microphone arrays** that serve as the "ears" of the vehicle.

| Capability | Detail |
|---|---|
| **Primary function** | Detecting emergency vehicle sirens |
| **Direction estimation** | Discerning the **direction of arrival** of sirens |
| **Detection timing** | Can detect sirens *"even before they are visible"* — i.e., before the emergency vehicle is within line-of-sight of any optical sensor |
| **360-degree coverage** | Audio sensors provide omnidirectional coverage |

### 9.2 Acoustic Signal Processing (Inferred)

While Zoox has not disclosed the specific acoustic processing pipeline, siren detection and localization likely involves:

- **Spectral analysis**: Emergency sirens have characteristic frequency patterns (typically 1-3 kHz, alternating between two tones).
- **Beamforming**: Directional microphone arrays use time-of-arrival differences across microphones to estimate the source direction.
- **Classification**: Distinguishing siren sounds from ambient urban noise (honking, music, construction).
- **Tracking**: Following the siren source as the emergency vehicle approaches and passes.

### 9.3 Integration with Behavior

When a siren is detected, the information feeds into the Prediction and Planning pipeline, causing the vehicle to:
- Begin looking for the emergency vehicle visually.
- Prepare to yield (pull over, slow down, clear intersection) as required by traffic law.
- Respond appropriately based on the estimated direction and distance of the emergency vehicle.

---

## 10. Point Cloud Processing

### 10.1 Hesai AT128 LiDAR Specifications

| Specification | Value |
|---|---|
| **Channels** | 128 (genuinely distributed, not stacked) |
| **Range** | 210 meters at 10% reflectivity |
| **Points per second** | 1,536,000 (single return mode) |
| **Field of view** | 120 degrees horizontal x 25.4 degrees vertical |
| **Angular resolution** | 0.1 degrees (horizontal) x 0.2 degrees (vertical) |
| **Pixel resolution** | 1200 x 128 |
| **Dimensions** | 136 x 114 x 49 mm |
| **Weight** | 940 grams |
| **Power consumption** | 13.5 W |
| **Eye safety** | Class 1 |
| **Functional safety** | ISO 26262 ASIL B certified |
| **Cybersecurity** | ISO 21434 compliant development process |

### 10.2 Multi-LiDAR Point Cloud Aggregation

With multiple Hesai AT128 units mounted at the four corners, the vehicle generates a combined point cloud of several million points per second. The processing pipeline (inferred from industry practice and Zoox disclosures) involves:

1. **Ego-motion compensation**: Each LiDAR point is timestamped; the vehicle's ego-motion (from IMU + wheel odometry) is used to transform all points into a common reference frame, compensating for vehicle movement during the scan.

2. **Multi-sensor registration**: Point clouds from multiple LiDAR units are registered into a unified coordinate frame using extrinsic calibration parameters from the CLAMS system.

3. **Ground plane removal**: Separation of ground returns from above-ground objects, likely using RANSAC or similar plane-fitting algorithms on the dense point cloud.

4. **Voxelization / Pillar encoding**: For neural network processing, the continuous point cloud is likely discretized into voxels (3D grid cells) or pillars (vertical columns), following approaches similar to PointPillars or VoxelNet. This converts the irregular point cloud into a regular grid amenable to CNN processing.

5. **Feature extraction**: Per-voxel or per-pillar features (point count, mean position, intensity, elongation) are computed and fed into the fusion backbone.

6. **Multi-return processing**: The AT128 supports single-return mode at 1.53M pts/sec. Multi-return modes (if used) would provide additional information about semi-transparent objects (rain, dust, foliage) by returning echoes from multiple surfaces along each laser beam.

### 10.3 LiDAR Data in HD Map Creation

During map construction (via the CLAMS team):
- Raw LiDAR point clouds from survey vehicles are aggregated across multiple passes.
- ML-based dynamic object removal eliminates people, cars, and other transient objects.
- Overlapping point clouds from multiple drives are aligned and fused to create high-resolution 3D maps.
- The resulting HD maps serve as the reference for real-time localization.

---

## 11. Camera Perception

### 11.1 Camera Configuration

| Attribute | Detail |
|---|---|
| **Total cameras** | ~28 RGB cameras across the vehicle |
| **Lens types** | Wide-angle (for near-field coverage) and telephoto (for long-range detection) |
| **Placement** | Distributed across the four corner sensor pods |
| **Coverage** | 360-degree, with overlapping fields of view |

### 11.2 Camera Processing Pipeline

The camera pipeline handles multiple perception tasks:

**Traffic light detection and classification:**
- Identifies traffic lights in the scene.
- Classifies light state (red, yellow, green, arrow signals).
- Associates detected lights with the correct lane/approach using map data from ZRN.
- Telephoto cameras provide extended range for detecting distant traffic lights.

**Pedestrian gesture recognition:**
- Detects pedestrian body language and gestures (e.g., waving to cross, looking at phone).
- Phone-holding detection is specifically encoded as a semantic channel in the BEV representation, since "someone holding a smartphone tends to behave differently."

**Object classification:**
- Provides rich classification information that LiDAR and radar cannot: vehicle make/model appearance, pedestrian clothing, signage text.
- Enables detection of flat objects (lane markings, road paint, debris) that produce weak LiDAR returns.

**Construction zone detection:**
- Identifies road cones, construction signs, temporary barriers, flaggers.
- Enables the vehicle to detect "unmapped construction zones" and adjust behavior accordingly.

### 11.3 Camera-LiDAR Cross-Modal Features

In the early fusion architecture, camera features are aligned with LiDAR features through:
- Calibrated projection matrices mapping 3D LiDAR points to 2D camera image planes.
- Camera features are "lifted" into 3D space or LiDAR features are projected into camera space for cross-modal attention.
- The CLAMS calibration system maintains precise camera-LiDAR alignment using natural environmental features (see Section 19).

---

## 12. Radar Processing

### 12.1 Radar Configuration

Radar units are mounted at each of the four vehicle corners, providing 360-degree coverage. The specific radar model is not publicly disclosed.

### 12.2 Radar's Unique Contributions

| Capability | Detail |
|---|---|
| **Direct velocity measurement** | Radar provides instantaneous radial velocity via Doppler effect — no need for multi-frame tracking |
| **Long-range detection** | Effective at ranges exceeding LiDAR for large objects (vehicles) |
| **Adverse weather operation** | Radar penetrates rain, fog, snow, and dust that degrade cameras and LiDAR |
| **Low-latency updates** | Radio wave propagation and processing provide fast update rates |

### 12.3 Radar in the Fusion Pipeline

Radar data is fused with LiDAR and camera data in the early fusion backbone. Radar's primary contributions to the fused representation are:
- **Velocity information**: Direct Doppler velocity measurements help disambiguate moving vs. stationary objects and provide initialization for tracking velocity estimates.
- **Weather-robust detections**: In rain or fog, radar may be the only modality providing reliable detections, and the fusion network learns to upweight radar features in these conditions.
- **Long-range velocity estimation**: For distant vehicles approaching at high speed, radar provides early warning that is difficult to obtain from LiDAR or cameras alone.

### 12.4 Radar Challenges

Radar data presents well-known challenges that the fusion pipeline must handle:
- **Multipath reflections**: Radar signals can bounce off buildings and other surfaces, creating ghost detections.
- **Low angular resolution**: Compared to LiDAR and cameras, radar has coarser spatial resolution.
- **Clutter**: Returns from guardrails, road surface, and other structures must be filtered.

The early fusion approach helps address these challenges because the network can learn to cross-reference radar returns with LiDAR and camera evidence, suppressing radar ghosts that lack corresponding detections in other modalities.

---

## 13. Occupancy and Scene Representations

### 13.1 Bird's-Eye-View (BEV) Representation

The primary scene representation used by Zoox's perception and prediction systems is a **multi-channel BEV image** with ~60 semantic channels (detailed in Section 5.1). This is a 2D top-down representation where each spatial location encodes rich semantic information across the channel dimension.

### 13.2 Occupancy Grid (Inferred)

While Zoox has not explicitly confirmed the use of occupancy grids or voxel-based 3D occupancy representations in public disclosures, the BEV representation with semantic channels effectively functions as a **semantic occupancy grid** in 2D:
- Each cell in the BEV grid contains per-channel values indicating occupancy by different object classes and semantic attributes.
- The Geometric Collision Avoidance system likely uses a simpler form of occupancy representation — checking whether sensor returns (LiDAR points, radar echoes) fall within the vehicle's planned trajectory corridor.

### 13.3 3D Scene Representations in Simulation

For simulation and validation, Zoox uses advanced 3D representations:
- **Gaussian Splatting**: Novel-view synthesis for creating photorealistic sensor simulations from real-world data captures.
- **NeRFs (Neural Radiance Fields)**: 3D scene reconstruction enabling camera and LiDAR simulation from arbitrary viewpoints.
- These are used for **closed-loop simulation** where the perception system is tested against synthetic sensor data generated from neural reconstructions of real scenes.

---

## 14. Coordinate Frames and BEV Representation

### 14.1 Ego-Centric Coordinate Frame

Perception operates primarily in an **ego-centric coordinate frame** — centered on the vehicle, with the x-axis pointing forward, y-axis left, and z-axis up (standard ROS/automotive convention). This frame moves with the vehicle.

Advantages of ego-centric processing:
- Sensor data is naturally in the vehicle's reference frame.
- Near-field perception has the highest spatial resolution (where it matters most).
- Consistent representation regardless of global position.

### 14.2 Map Frame

For localization and long-range planning, perception outputs are transformed into a **map-aligned reference frame** using the vehicle's localized pose (from the CLAMS/localization system, accurate to within a few centimeters and a fraction of a degree, updated 200 times per second).

### 14.3 BEV Grid Details (Inferred)

| Parameter | Likely Value | Rationale |
|---|---|---|
| **Spatial extent** | ~200m x 200m centered on vehicle | Matches stated detection range of 200m |
| **Grid resolution** | 0.1 - 0.2 meters per cell | Needed for pedestrian-scale detection |
| **Channels** | ~60 semantic channels | Confirmed by Zoox engineers |
| **Update rate** | Synchronized with perception pipeline (likely 10-20 Hz) | Must feed into 10 Hz prediction |

---

## 15. Temporal Fusion

### 15.1 Multi-Frame Aggregation

Temporal fusion is critical for autonomous driving perception. Zoox incorporates temporal information at multiple levels:

**Point cloud accumulation:**
- Multiple LiDAR sweeps are accumulated and ego-motion compensated to create denser point clouds than a single sweep provides.
- This is particularly valuable for detecting small or distant objects that produce few points in a single scan.

**Temporal feature aggregation in neural networks:**
- The perception backbone likely processes features from multiple recent time steps.
- Recurrent features or temporal attention mechanisms enable the network to reason about motion and change.

**Staleness-aware temporal features:**
- The sensor staleness framework (Section 4) adds explicit timestamp features to every data point.
- This enables the model to perform temporally-aware fusion even when sensor data arrives at different rates or with variable latency.

### 15.2 Scene Flow Estimation

From the existing Zoox technical document: *"Temporal information incorporated for velocity estimation and scene flow."*

Scene flow is the 3D analog of optical flow — it describes how every point in the 3D scene moves between time steps. This provides:
- Dense motion fields for the entire scene, not just tracked objects.
- Detection of motion in regions without explicit object detections.
- Input for separating dynamic objects from static background.

### 15.3 Motion Modeling

The dedicated motion modeling system (part of the Main AI System) uses temporal data to:
- Estimate per-object kinematics (velocity, acceleration, turn rate).
- Classify motion patterns (stationary, accelerating, decelerating, turning).
- Provide motion state estimates to the prediction system.

---

## 16. Foundation Model for Perception

Presented at **AWS re:Invent 2025** (session AMZ304), Zoox is developing a multimodal foundation model that represents a potential paradigm shift from their modular perception pipeline.

### 16.1 Architecture

| Attribute | Detail |
|---|---|
| **Base model** | **Qwen 3 VL** (vision-language model) |
| **Architecture type** | Multimodal language-action model with LLM core |
| **Inputs** | Camera images/video (via pre-trained vision encoders), LiDAR, radar, text prompts, existing perception stack 3D detections (as embeddings) |
| **Outputs** | Robotic controls (acceleration, braking, steering), 3D object detections, generative scene descriptions, captions |
| **Projection layers** | Convert sensor data into LLM-compatible embeddings |

### 16.2 Model Scale

| Scale | Parameters | Use |
|---|---|---|
| **Small** | 400M | Rapid experimentation, ablation studies |
| **Medium** | 7B | Regular training and evaluation |
| **Large** | 32B | Maximum capability (advancing toward) |

### 16.3 Three-Stage Training Pipeline

**Stage 1: Large-Scale Supervised Fine-Tuning (SFT)**
- Behavior cloning on tens of thousands of hours of human driving data.
- Millions of 3D detection labels for spatial perception understanding.
- Visual question answering for scene comprehension.
- Standard LLM fine-tuning techniques.

**Stage 2: High-Quality SFT**
- Focused on rare object detection — objects that appear infrequently in training data.
- Difficult driving scenarios (construction zones, unusual road configurations).
- **Synthetic chain-of-thought reasoning** — training the model to produce step-by-step reasoning about driving decisions.

**Stage 3: Reinforcement Learning**
- **GRPO** (Generalist Reward Policy Optimization) — a reinforcement learning technique for aligning model outputs with desired driving behavior.
- **DAPO** (Direct Alignment from Preference Optimization) — preference-based RL technique.
- Focus on robotic controls (smooth, safe, comfortable driving) and challenging scenarios.

### 16.4 Perception Capabilities of the Foundation Model

The foundation model can produce **3D object detections matching the current perception pipeline's output format**. This means it can potentially serve as:
- A redundant perception system (architectural diversity).
- A "zero-shot" detector for novel objects the traditional pipeline has never been trained on.
- A system that combines perception and reasoning — e.g., understanding that a person standing at a crosswalk with a white cane is likely visually impaired and may cross unpredictably.

### 16.5 Distributed Training Infrastructure

| Component | Detail |
|---|---|
| **Parallelism** | HSDP (Hybrid Sharded Data Parallel) across nodes + FSDP within nodes |
| **Tensor parallelism** | For multi-billion parameter models |
| **Precision** | BF16 (half memory, double speed vs. FP32) |
| **Gradient checkpointing** | Enables larger batch sizes |
| **Compilation** | torch.compile for graph optimization |
| **Hardware** | P5 and P6N GPU instances via AWS SageMaker HyperPod |
| **Cluster scale** | 500+ node clusters supported |
| **GPU utilization** | 95% achieved after optimization |
| **Data loading** | Mosaic Data Streaming (MDS) with deterministic sampling and mid-epoch resumption |
| **Networking** | EFA at 3,200 Gbps per node |
| **Storage** | FSx for Lustre for training data |

---

## 17. Auto-Labeling and Annotation

### 17.1 Perception Labeling and Tools Team

Zoox maintains a dedicated **Perception Labeling and Tools** team responsible for:
- Building and maintaining annotation infrastructure.
- Developing auto-labeling algorithms that reduce manual labeling burden.
- Creating web-based labeling tools (React/Angular/Vue frontends + Python backends).

### 17.2 Auto-Labeling Approaches

| Approach | Detail |
|---|---|
| **Self-supervised prediction training** | Actual future trajectories serve as ground truth labels — the model learns to predict where agents actually went, with no human annotation needed for trajectory labels |
| **Auto-labeling algorithms** | ML models that automatically generate 3D bounding box annotations for training data, reviewed and corrected by human annotators |
| **Synthetic chain-of-thought** | Foundation model training uses synthetically generated reasoning traces as labels |
| **Log-derived labels** | Real-world driving logs provide implicit supervision — e.g., ego-vehicle behavior in response to perceived situations provides weak labels for what the vehicle should have done |

### 17.3 Data Scale

| Metric | Value |
|---|---|
| **Raw data per vehicle** | 4 TB/hour |
| **Active storage** | Tens of petabytes (Quobyte on-premises + S3) |
| **Cold storage** | ~1 exabyte (AWS S3) |
| **Training data for prediction** | Billions of real-world samples |
| **Foundation model training data** | Tens of thousands of hours of human driving |
| **Detection labels** | Millions of 3D detection labels |

---

## 18. Non-ML Components: Geometric Collision Avoidance

### 18.1 Design Philosophy

The Geometric Collision Avoidance (GCA) system is deliberately **non-ML** — it uses interpretable, rule-based algorithms that can be formally reasoned about and do not exhibit the failure modes of neural networks.

### 18.2 How It Works (Inferred from Disclosures)

The GCA system operates on **raw sensor data** (primarily LiDAR point clouds and radar returns) and the vehicle's **planned trajectory**:

1. **Trajectory corridor definition**: The vehicle's planned path is expanded into a 3D corridor (accounting for vehicle width, height, and trajectory curvature).

2. **Sensor return projection**: Raw LiDAR points and radar returns are checked for intersection with the trajectory corridor.

3. **Obstruction detection**: If sensor returns fall within the corridor, an obstruction is flagged.

4. **CAS activation**: If the obstruction is imminent (based on time-to-collision at current speed), the Collision Avoidance System (CAS) is triggered.

### 18.3 Key Properties

| Property | Detail |
|---|---|
| **No classification required** | Does not need to identify *what* the object is — only that *something* is in the path |
| **No learned parameters** | Immune to training data distribution shift, adversarial examples, and neural network failures |
| **Interpretable** | Behavior can be formally verified and is fully deterministic |
| **Low latency** | Minimal computation — geometric checks are fast |
| **Limited scope** | Only detects path obstructions, not general scene understanding |

### 18.4 Why Both ML and Non-ML Systems

The combination addresses different failure modes:
- **ML system failures**: Distribution shift, adversarial inputs, rare object classes, training data gaps.
- **Geometric system limitations**: Cannot classify, predict, or understand context — but is extremely reliable for the narrow question "is something in my path?"
- **Architectural diversity**: A bug in the ML stack cannot affect the geometric system and vice versa.

---

## 19. Calibration (CLAMS)

### 19.1 CLAMS Overview

**CLAMS** = **Calibration, Localization, and Mapping, Simultaneously**

The CLAMS team is responsible for ensuring all sensors are precisely aligned and the vehicle knows exactly where it is.

### 19.2 Infrastructure-Free Calibration

Traditional sensor calibration requires specialized infrastructure — calibration targets on walls, fiducial markers, controlled environments. Zoox's innovation is **infrastructure-free calibration** using natural environmental features:

- The system **automatically identifies image gradients** (edges of buildings, trunks of trees) from the vehicle's **color camera data**.
- These image gradients are **aligned with depth edges** in the **LiDAR data**.
- Corresponding features in camera and LiDAR are matched to compute and refine extrinsic calibration parameters.

This is critical because *"every vehicle is a special snowflake in some way"* — manufacturing tolerances and environmental exposure (shock, vibration, thermal cycling) cause *"very slight changes in sensor positioning"* over time. Without continuous recalibration, sensor alignment would degrade and produce "blurry" perception.

### 19.3 Factory Calibration

At the Hayward manufacturing facility, initial sensor calibration is performed in a dedicated **calibration bay**:

1. Vehicle is placed on an **automated turntable**.
2. **Specialized calibration boards** with **halogen lights** and radar targets surround the vehicle.
3. Halogen lights calibrate visible-spectrum cameras while simultaneously heating dots on boards for LWIR calibration.
4. The turntable rotates the vehicle through 360 degrees, collecting calibration data from all angles.
5. The process completes an initial sensor calibration **in minutes**.
6. The vehicle performs a calibration "dance" involving rotation and tilting movements.

### 19.4 Continuous In-Field Calibration

After factory calibration, the infrastructure-free approach enables **continuous calibration refinement** during normal operation:
- As the vehicle drives, it continuously identifies natural feature correspondences between camera and LiDAR.
- Calibration parameters are refined online, compensating for thermal drift, vibration-induced shifts, and other perturbations.

### 19.5 Calibration for Map Creation

During HD map creation:
1. Toyota Highlander survey vehicles drive through target areas.
2. ML-based dynamic object removal eliminates people, vehicles, and other ephemeral objects from LiDAR data.
3. Point clouds from overlapping drives are aligned and fused into high-resolution 3D maps.
4. The ZRN (Zoox Road Network) team adds semantic layers: speed limits, traffic signals, stop signs, bike lanes, one-way streets, keep-clear zones.

---

## 20. Key Patents

Zoox (and its parent Amazon) hold an extensive patent portfolio related to perception. While Google Patents search requires direct access, the following categories of Zoox patents are known from public filings and references:

### 20.1 Known Patent Categories

| Category | Description |
|---|---|
| **Sensor fusion** | Methods for combining data from multiple sensor modalities (LiDAR, camera, radar, LWIR) in autonomous vehicles |
| **Object detection and classification** | 3D object detection in point clouds and fused sensor representations |
| **Trajectory prediction** | Methods for predicting future trajectories of detected agents |
| **Thermal imaging for autonomous vehicles** | Integration of LWIR thermal cameras with other sensor modalities |
| **Sensor calibration** | Infrastructure-free calibration methods using natural environmental features |
| **Collision avoidance** | Geometric and ML-based collision detection and avoidance systems |
| **Bidirectional vehicle perception** | Perception architectures for vehicles that operate in both directions |
| **Occupant safety** | Novel airbag systems, seatbelt monitoring, and occupant protection for autonomous vehicles |
| **Sensor cleaning** | Water spray and air blast systems for maintaining sensor clarity |

### 20.2 Notable Patent Holders

Zoox patents are filed under both "Zoox, Inc." and "Amazon Technologies, Inc." (post-acquisition). Key inventors include:
- **Jesse Levinson** (CTO) — Multiple patents on autonomous vehicle systems
- Perception, prediction, and planning engineers named in NHTSA filings and Amazon Science publications
- **Vince Spinella-Mamo** — Highlighted during National Inventors Day (February 2025) as a prolific Zoox inventor

---

## 21. Key Publications and Conference Appearances

### 21.1 Published Research

| Title | Venue/Platform | Year | Authors | Topic |
|---|---|---|---|---|
| **Scenario Diffusion: Controllable Driving Scenario Generation With Diffusion** | NeurIPS 2023 | 2023 | Ethan Pronovost, Meghana Reddy Ganesina, Noureldin Hendy, Zeyu Wang, Andres Morales, Kai Wang, Nicholas Roy | Latent diffusion model for generating synthetic driving scenarios; combines autoencoder + diffusion for simultaneous agent placement and trajectory generation |
| **Sensor Staleness Framework** | Amazon Science | 2025 | Zoox Perception Team | Model-agnostic framework adding timestamp features for temporal awareness; pedestrian precision 2x, recall 6x |
| **QTP (Query-centric Trajectory Prediction)** | Amazon Science | 2022-2025 | Zoox Prediction Team (Kai Wang, Andres Morales, Mahsa Ghafarianzadeh et al.) | Data-driven behavior prediction replacing assumption-based UAP system |
| **CLAMS: Infrastructure-Free Calibration** | Amazon Science | 2022 | Zoox CLAMS Team | Calibration using natural environmental features (building edges, tree trunks) aligned between camera gradients and LiDAR depth edges |
| **Foundation Model for Autonomous Vehicles** | AWS re:Invent 2025 (AMZ304) | 2025 | Zoox ML Infrastructure Team | Multimodal language-action model (Qwen VL base, 400M-32B parameters) producing robotic controls and 3D detections |

### 21.2 Amazon Science Articles

| Title | Date | Key Content |
|---|---|---|
| *"How the Zoox robotaxi predicts everything, everywhere, all at once"* | August 2022 | Deep dive into prediction system: ~60-channel BEV CNN, GNN message passing, 8-second horizon, 100ms update rate, conditional prediction |
| *"How Zoox vehicles 'find themselves' in an ever-changing world"* | April 2022 | CLAMS calibration, infrastructure-free sensor alignment, HD map creation, dynamic object removal |
| *"Scenario Diffusion helps Zoox vehicles navigate safety-critical situations"* | February 2024 | Latent diffusion for synthetic driving scenario generation |
| *"The next frontier in robotics"* | June 2022 | Interview with Olivier Toupet on planning and prediction |
| *"The future of mobility-as-a-service"* | June 2021 | CTO Jesse Levinson Q&A on autonomy and perception |

### 21.3 Zoox Journal Technical Articles

| Title | Date | Key Perception Content |
|---|---|---|
| *"Going beyond seeing to perceiving the world around us"* | Oct 2022 | Triple-redundant perception architecture, five sensor modalities, sensor fusion, Main AI System, GCA, Safety Net |
| *"Solving sensor staleness"* | Jan 2026 | Timestamp features, synthetic stale data training, precision/recall improvements |
| *"The future in sight: How Zoox predicts the road ahead"* | Sept 2025 | QTP replacing UAP, data-driven prediction, synthetic scenario generation |
| *"Building redundancy into the Zoox robotaxi"* | Aug 2025 | Fail-operational architecture, sensor redundancy, CAS, dual computers |
| *"Putting our robots on the map"* | Oct 2025 | LiDAR point cloud visualization, mapping pipeline |
| *"A deep dive into end-of-line testing at Zoox"* | Nov 2025 | Sensor calibration bay, halogen light + turntable calibration process |
| *"Leadership in Focus: Bat El Shlomo, Director, Perception"* | Dec 2025 | Evolution from late fusion to early fusion with shared representation layers |
| *"Putting the rider first: How we're redefining safety on our roads"* | Sept 2025 | Microphone siren detection, LWIR in adverse weather, 360-degree sensor coverage |

### 21.4 Conference Appearances

| Event | Year | Content |
|---|---|---|
| **AWS re:Invent** (AMZ304) | 2025 | Building ML infrastructure for AVs; foundation model architecture; distributed training at scale |
| **NVIDIA GTC** | 2024 | CTO Jesse Levinson on NVIDIA partnership and simulation |
| **CVPR** | 2022, 2023 | Booth presence; perception and simulation demonstrations |
| **CES** | 2023 | First CES appearance; vehicle demonstration |
| **NeurIPS** | 2023 | Scenario Diffusion paper presentation |

### 21.5 NHTSA Filings (Perception-Relevant)

| Filing | Date | Perception Relevance |
|---|---|---|
| **Recall 25E-019** | March 2025 | Prediction over-confidence for bicyclists near crosswalks |
| **Recall 25E-037** | May 2025 | Near-field VRU detection gap at very low speeds; perception tracking improvement deployed |
| **Recall 25E-090** | December 2025 | Lane boundary perception/planning interaction at intersections |
| **Demonstration Exemption** | August 2025 | First exemption for American-built AV; confirms sensor suite and detection range (200m) |
| **Temporary Exemption Filing** | June 2025 | Detailed vehicle specifications and safety architecture |

---

## 22. Sources

### Official Zoox
- [Zoox Autonomy](https://zoox.com/autonomy) — Sensor overview, perception description
- [Zoox Vehicle](https://zoox.com/vehicle) — Sensor suite, detection ranges
- [Zoox Safety](https://zoox.com/safety) — Safety architecture, redundancy overview
- [Zoox Journal: Perception](https://zoox.com/journal/perception) — Triple-redundant architecture, five sensor modalities, early fusion
- [Zoox Journal: Sensor Staleness](https://zoox.com/journal/sensor-staleness-zoox) — Timestamp features, synthetic stale training, performance results
- [Zoox Journal: Prediction](https://zoox.com/journal/prediction-ai-technology) — QTP vs UAP, data-driven prediction
- [Zoox Journal: Redundancy](https://zoox.com/journal/redundancy-zoox-robotaxi) — Fail-operational architecture, CAS
- [Zoox Journal: End-of-Line Testing](https://zoox.com/journal/zoox-end-of-line-testing-manufacturing) — Sensor calibration bay
- [Zoox Journal: Safety Innovations](https://zoox.com/journal/three-ways-zoox-reinventing-road-safety) — Microphone siren detection, LWIR, sensor redundancy
- [Zoox Journal: Bat-El Shlomo Interview](https://zoox.com/journal/leadership-in-focus-bat-el-shlomo-director-perception) — Late-to-early fusion evolution
- [Zoox Journal: Robotaxi Design](https://zoox.com/journal/zoox-robotaxi-design) — Sensor pod placement and design
- [Zoox Journal: Testing Vehicle](https://zoox.com/journal/autonomous-zoox-testing-vehicle) — Testing fleet sensor architecture matching robotaxi
- [Zoox Journal: Strio.AI](https://zoox.com/journal/strio-ai-joins-zoox) — Perception team expansion, RJ He as Director of Perception
- [Zoox Journal: Production Facility](https://zoox.com/journal/zoox-robotaxi-serial-production-facility) — Calibration bay, sensor pod assembly

### Amazon Science
- [Prediction Article](https://www.amazon.science/latest-news/how-the-zoox-robotaxi-predicts-everything-everywhere-all-at-once) — ~60-channel BEV CNN, GNN message passing, 8-second horizon, conditional prediction
- [CLAMS Article](https://www.amazon.science/latest-news/how-zoox-vehicles-find-themselves-in-an-ever-changing-world) — Infrastructure-free calibration, HD map creation
- [Scenario Diffusion Article](https://www.amazon.science/blog/scenario-diffusion-helps-zoox-vehicles-navigate-safety-critical-situations) — Autoencoder + diffusion architecture
- [Jesse Levinson Q&A](https://www.amazon.science/latest-news/amazon-zoox-robotaxi-the-future-of-mobility-as-a-service) — ML approaches, self-supervised learning, reinforcement learning
- [Olivier Toupet Interview](https://www.amazon.science/latest-news/the-next-frontier-in-robotics) — Perception + planning integration

### AWS & NVIDIA
- [AWS re:Invent 2025 AMZ304](https://dev.to/kazuya_dev/aws-reinvent-2025-zoox-building-machine-learning-infrastructure-for-autonomous-vehicles-amz304-3e6m) — Foundation model, distributed training, Qwen VL, GRPO/DAPO
- [NVIDIA Zoox Robotaxi](https://blogs.nvidia.com/blog/zoox-autonomous-robotaxi-powered-by-nvidia/) — NVIDIA DRIVE platform, GPU compute, sensor fusion
- [NVIDIA Zoox Ride-Hailing](https://blogs.nvidia.com/blog/nvidia-zoox-autonomous-ride-hailing/) — GPU processing, sensor data pipeline

### Sensor Suppliers
- [Hesai AT128 Specifications](https://www.hesaitech.com/product/at128/) — 128-ch, 210m range, 1.53M pts/sec, ISO 26262 ASIL B

### Infrastructure
- [Quobyte + Zoox](https://blocksandfiles.com/2025/07/01/quobyte-zoox-robotaxi-training/) — 30 PB Quobyte storage, GPU cluster details, training cadence
- [AWS Case Study](https://aws.amazon.com/solutions/case-studies/zoox/) — ML training, S3 storage at exabyte scale

### Regulatory
- [NHTSA Recall 25E-019](https://static.nhtsa.gov/odi/rcl/2025/RCLRPT-25E019-8103.PDF) — Bicyclist braking issue
- [NHTSA Recall 25E-037](https://static.nhtsa.gov/odi/rcl/2025/RCLRPT-25E037-4912.pdf) — Near-field VRU detection
- [NHTSA Recall 25E-090](https://static.nhtsa.gov/odi/rcl/2025/RCLRPT-25E090-1680.pdf) — Lane-line crossing
- [Zoox Recall Reports](https://zoox.com/journal/2025-may-safety-recall-report) — Perception tracking improvements

### Academic
- [Scenario Diffusion (arXiv:2311.02738)](https://arxiv.org/abs/2311.02738) — NeurIPS 2023, Pronovost et al.

---

*This document synthesizes information from 40+ sources across Zoox official publications, Amazon Science,
AWS re:Invent presentations, NVIDIA partnership disclosures, NHTSA regulatory filings, sensor supplier
specifications, trade press, and academic publications. Where specific technical details are not publicly
disclosed by Zoox, inferences are clearly marked as such and grounded in disclosed architectural choices
and industry-standard practices.*
