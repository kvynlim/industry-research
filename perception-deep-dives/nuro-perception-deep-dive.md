# Nuro Perception Stack: Exhaustive Deep Dive

*Last updated: March 2026*

---

## Table of Contents

1. [Delivery Vehicle Perception: A Different Problem](#1-delivery-vehicle-perception-a-different-problem)
2. [Unified Perception Foundation Model](#2-unified-perception-foundation-model)
3. [Sensor Suite: Six Modalities](#3-sensor-suite-six-modalities)
4. [LiDAR Perception](#4-lidar-perception)
5. [Camera Perception](#5-camera-perception)
6. [Radar Perception](#6-radar-perception)
7. [Thermal Camera Perception](#7-thermal-camera-perception)
8. [Audio Perception](#8-audio-perception)
9. [Multi-Sensor Fusion](#9-multi-sensor-fusion)
10. [3D Object Detection](#10-3d-object-detection)
11. [Object Tracking](#11-object-tracking)
12. [Prediction](#12-prediction)
13. [Pedestrian Safety Perception](#13-pedestrian-safety-perception)
14. [Semantic Segmentation and Scene Understanding](#14-semantic-segmentation-and-scene-understanding)
15. [Zero-Occupant Perception Advantages](#15-zero-occupant-perception-advantages)
16. [FTL Model Compiler Framework](#16-ftl-model-compiler-framework)
17. [Geospatial Foundation Model](#17-geospatial-foundation-model)
18. [Calibration](#18-calibration)
19. [Auto-Labeling and Training Data](#19-auto-labeling-and-training-data)
20. [Reinforcement Learning for Perception and Behavior](#20-reinforcement-learning-for-perception-and-behavior)
21. [Key Patents](#21-key-patents)
22. [Key Publications and Research](#22-key-publications-and-research)
23. [Perception for the Robotaxi Pivot](#23-perception-for-the-robotaxi-pivot)

---

## 1. Delivery Vehicle Perception: A Different Problem

### Why Delivery Perception Is Not Robotaxi Perception

Nuro pioneered a vehicle form factor that has no analog in the autonomous vehicle industry: a half-width, zero-occupant, goods-only delivery robot operating at 25-45 mph on public roads. This form factor imposes fundamentally different constraints on perception compared to a full-size robotaxi carrying passengers.

| Dimension | Delivery Vehicle (R2/R3) | Robotaxi (Lucid Gravity) |
|---|---|---|
| **Primary protected entity** | Pedestrians and other road users (no occupants) | Passengers inside + external road users |
| **Operating speed** | 25-45 mph | Up to 65+ mph (highway) |
| **Operating environment** | Residential neighborhoods, suburban arterials | Urban streets, highways, commercial districts |
| **Critical detection classes** | Pedestrians (including children), pets, cyclists, obstacles on residential streets | Vehicles, pedestrians, cyclists, highway traffic, construction zones |
| **Close-range priority** | Very high -- frequent curbside stops, driveway approaches, loading zones | Moderate -- primarily at intersections and parking |
| **Detection range emphasis** | Short-to-medium range (residential speeds) | Long range (highway speeds require early detection) |
| **Braking freedom** | Aggressive emergency braking permitted (no passenger comfort/injury constraints) | Constrained by passenger comfort and injury risk |
| **Sensor height** | Low sensor vantage point (~6 ft vehicle height) | Higher vantage point (SUV-height roof-mounted sensors) |
| **Collision energy** | Low (2,535 lb at 25 mph = low kinetic energy) | High (5,000+ lb at 65 mph = high kinetic energy) |

### Delivery-Specific Perception Priorities

**Residential neighborhood awareness.** Nuro's delivery vehicles operate primarily in residential areas where the traffic mix is fundamentally different from urban cores or highways. The perception system must excel at detecting:
- Children playing near the road or running into the street
- Pets (dogs, cats) that move unpredictably and are small detection targets
- Pedestrians walking on narrow sidewalks adjacent to the vehicle's path
- Garbage bins, parked scooters, and other residential-street clutter
- Backing vehicles emerging from driveways

**Curbside delivery perception.** Every delivery involves approaching a specific address, stopping at the curb, and waiting for the customer to retrieve goods. This creates perception demands that robotaxis rarely face:
- Precise curb detection and localization for accurate stop positioning
- Detection of obstacles in the intended stopping zone (parked cars, mailboxes, trash cans)
- Monitoring for approaching pedestrians during the stopped phase (the customer and other passersby)
- Driveway and address identification for correct delivery location

**Low-speed, high-recall philosophy.** Because the vehicle operates at lower speeds and carries no passengers, Nuro can tune perception for higher recall (detecting more potential obstacles) at the cost of more frequent cautious stops. In a robotaxi, excessive false positives degrade passenger experience; in a delivery vehicle, a few extra cautious pauses are operationally acceptable and improve safety margins. Nuro's safety blog explicitly states this: "With a goods-first approach, Nuro is able to prioritize safety over comfort by allowing for higher recall, which ensures they detect unknown obstacles and can support more aggressive stopping maneuvers."

**All-day operation in all conditions.** The delivery vehicle must operate from early morning through late evening in all weather. The thermal camera is particularly valuable in this context -- detecting pedestrians at dawn, dusk, and night in residential areas where street lighting may be poor.

---

## 2. Unified Perception Foundation Model

### Architecture Overview

Nuro's perception system is built around a single **Unified Perception Foundation Model** -- a monolithic neural network that ingests data from all sensor modalities simultaneously and produces outputs for multiple perception tasks. This is a deliberate architectural choice, trading the modularity of separate per-task models for the efficiency and representational power of a unified system.

```
                        ┌──────────────────────────────────────┐
                        │       Unified Perception Model       │
                        ├──────────────────────────────────────┤
                        │                                      │
                        │  ┌──────────┐  ┌──────────────────┐  │
                        │  │ Detection │  │ Tracking         │  │
                        │  │ & Class.  │  │ (Stateful)       │  │
                        │  └──────────┘  └──────────────────┘  │
                        │  ┌──────────┐  ┌──────────────────┐  │
    Task Heads ────────►│  │ Online   │  │ Occupancy &      │  │
                        │  │ Mapping  │  │ Flow             │  │
                        │  └──────────┘  └──────────────────┘  │
                        │  ┌──────────┐  ┌──────────────────┐  │
                        │  │ Localiz. │  │ Scene            │  │
                        │  │          │  │ Understanding    │  │
                        │  └──────────┘  └──────────────────┘  │
                        ├──────────────────────────────────────┤
                        │     Temporal Module                   │
                        │  (T to T-n alignment, stateful       │
                        │   temporal modeling, spatial-         │
                        │   temporal feature fusion)            │
                        ├──────────────────────────────────────┤
                        │     Sensor Fusion Module              │
                        │  (Unified Voxel Feature Space)        │
                        ├────────┬────────┬────────┬───────────┤
                        │ Camera │ LiDAR  │ Radar  │ Thermal/  │
                        │Encoder │Encoder │Encoder │ Audio Enc.│
                        └────────┴────────┴────────┴───────────┘
                            ▲        ▲        ▲         ▲
                         Cameras   LiDARs   Radars   Thermal/
                        (~12+)    (solid-  (imaging)  Mic Array
                                  state)
```

### Component-by-Component Architecture

**1. Independent Multimodal Sensor Encoders**

Each sensor modality has its own dedicated encoder network that processes raw sensor data into intermediate feature representations. This independence is a critical design choice: it allows the model to handle different sensor configurations across vehicle platforms without retraining the entire system.

- **Camera encoder**: Processes high-resolution images from multiple cameras. The image encoder is pretrained on large-scale image datasets, which improves performance on all downstream tasks and facilitates integration with other foundation models. Recent updates integrated a Vision Transformer (ViT) architecture, which boosted emergency vehicle detection by 5% without increasing false positives.
- **LiDAR encoder**: Processes 3D point clouds from distributed solid-state LiDAR sensors into spatial features.
- **Radar encoder**: Processes radar returns including velocity and elevation data from imaging radar sensors.
- **Thermal/audio encoders**: Process infrared imagery and audio spectrograms from thermal cameras and microphone arrays.

**2. Sensor Fusion Module**

The fusion module transforms encoded features from their native sensor-specific formats into a **unified voxel feature space**. This is where all modalities converge: camera features (2D perspective projections), LiDAR features (3D point clouds), radar features (range-Doppler), and other modalities are all projected into a common 3D voxel grid representation. The output is a set of multi-modal spatial features that encode the scene from all sensors simultaneously.

The voxel representation is particularly well-suited for autonomous driving because it naturally encodes 3D spatial relationships, supports variable sensor configurations, and provides a common coordinate frame for downstream reasoning.

**3. Temporal Module**

The temporal module aligns spatial features across multiple time steps (from time T to T-n) and fuses them into spatial-temporal features. This is essential for:
- **Motion estimation**: Understanding how objects are moving by comparing their positions across frames
- **Temporal consistency**: Ensuring that detections and tracks are stable across time, reducing flickering or lost tracks
- **Velocity estimation**: Deriving object speeds from displacement over time

For certain tasks, the module performs **stateful temporal modeling**, conditioning on spatial-temporal features at time T and task features/queries from T-1 to T-n. This statefulness allows the model to maintain a running representation of the scene that evolves smoothly, rather than processing each frame independently.

**4. Task Heads**

Downstream task-specific heads operate on the unified spatial-temporal features. The model simultaneously addresses multiple perception and mapping tasks:
- **Detection and tracking**: 3D bounding box detection and multi-object tracking
- **Localization and online mapping**: Real-time position estimation and map feature prediction
- **Occupancy and flow**: Volumetric occupancy grid estimation and motion flow prediction
- **Classification**: Fine-grained object classification (vehicle type, pedestrian posture, etc.)
- **Scene understanding**: Unusual scene detection, road condition assessment

### Design Objectives

**Cross-platform compatibility.** The unified model is designed so that a single foundational model can be trained once and deployed across different vehicle platforms with efficient post-training adaptation. This is critical for Nuro's licensing business model: the same perception model serves both delivery robots and the Lucid Gravity robotaxi.

**Sensor robustness via sensor dropout.** Model training includes sensor dropout, whereby random sensors are masked during training. This minimizes the model's dependency on any single sensor, ensuring it maintains performance even when multiple sensors fail during real-world operation. This is analogous to dropout regularization in neural networks, applied at the sensor-modality level.

**Computational efficiency.** The unified architecture eliminates redundant feature computations that would occur if separate models independently processed overlapping portions of the sensor data. The Perception and ML-Infra teams collaborated to develop novel solutions with the ML compiler and runtime to support running the multi-sensor, multi-task model efficiently on limited onboard compute.

**Open vocabulary integration.** Nuro is augmenting the unified perception model with open vocabulary capabilities, utilizing feature extractors derived from multimodal language models (VLMs). This enables the system to recognize and reason about objects and scenes that were not explicitly labeled in the training data -- a critical capability for handling the long tail of unusual objects encountered in real-world driving.

### Perception Foundation Encoder

The **Perception Foundation Encoder** is the earliest processing stage in the stack. Per Nuro's job descriptions for this role, it is "responsible for compressing raw sensor data (cameras, lidar, radar, and audio) into a unified feature representation." Work on the encoder directly impacts object detection and tracking, online mapping, unusual scene understanding, and learned behavior. The role requires PhD-level expertise and publications at top conferences (CVPR, ICCV, ECCV, NeurIPS, ICML, ICLR, CoRL, RSS, ICRA).

---

## 3. Sensor Suite: Six Modalities

Nuro employs six distinct sensor modalities, a breadth that exceeds most competitors and reflects the company's emphasis on redundancy and pedestrian safety.

### Modality Summary

| # | Modality | Sensor Type | Primary Role | Key Advantage |
|---|---|---|---|---|
| 1 | **LiDAR** | Distributed solid-state | Precise 3D depth, object geometry | Centimeter-level range accuracy; no moving parts |
| 2 | **Cameras** | Automotive-grade (4 categories) | Classification, semantic understanding, color/texture | High resolution; rich appearance features |
| 3 | **Radar** | Long-range imaging radar | Velocity measurement, all-weather operation | Works in rain, fog, snow; direct velocity via Doppler |
| 4 | **Thermal Camera** | Long-wave infrared (LWIR) | Pedestrian/animal detection via heat | Works in darkness; sees through glare and partial occlusion |
| 5 | **Microphone** | Distributed microphone array | Emergency vehicle siren detection and localization | 360-degree audio; detects sirens at long range |
| 6 | **IMU** | ASIL-D rated inertial measurement unit | Vehicle state estimation, inertial navigation | Highest automotive safety integrity level (ISO 26262) |

### Total Sensor Count

The unified perception system ingests synchronized data from approximately **30 individual sensors**, including multiple long-range and short-range cameras, LiDARs, and radars.

### Camera Categories

The next-generation sensor architecture features four categories of cameras:
1. **Ultra-long-range cameras**: For early detection of distant objects at highway speeds
2. **Long-range cameras**: Primary detection cameras for typical driving distances
3. **Short-range cameras**: Close-range perception for curbside operations, parking, and tight maneuvering
4. **Traffic light detection cameras**: Dedicated cameras optimized for traffic signal recognition

All cameras are arranged for redundant, 360-degree overlapping field of view.

### R2 Sensor Configuration (Legacy)

| Sensor | Count |
|---|---|
| High-definition cameras | 12 (360-degree overlapping FOV) |
| Roof-mounted primary LiDAR | 1 (rotary) |
| Additional LiDAR/radar sensors | 14 |
| Thermal camera | 1 (front-facing) |

### Next-Generation Sensor Architecture (Nuro Driver Platform)

The next-generation architecture was introduced in June 2025 and is designed for cross-platform deployment across delivery robots, robotaxis, and OEM vehicles.

Key design changes from R2:
- **Rotary LiDAR replaced by distributed solid-state LiDAR**: Multiple small sensors mounted around the vehicle perimeter for enhanced coverage. Fewer moving parts improve reliability, reduce maintenance costs, and enable easier manufacturing at scale.
- **Low-profile form factor**: The new sensor architecture maintains a significantly lower profile compared to the previous generation, improving aerodynamics for high-speed driving and enabling better vehicle design integration.
- **Modular mounting**: Sensors can be mounted in distributed configurations, enabling swift, seamless integration with diverse vehicle platforms.
- **Commercially available automotive-grade sensors**: Selected for production-scale reliability and lower operational costs.

---

## 4. LiDAR Perception

### Solid-State LiDAR Architecture

Nuro transitioned from a single roof-mounted rotary LiDAR (used on R2) to a distributed array of solid-state LiDAR sensors in its next-generation architecture. This transition has several perception implications:

**Advantages of solid-state over rotary:**
- **No mechanical spinning parts**: Eliminates the most common failure mode of rotary LiDAR; improves MTBF (mean time between failures) for fleet operations
- **Smaller form factor**: Enables flush or near-flush mounting into vehicle body panels, reducing aerodynamic drag and improving aesthetics for consumer vehicle integration
- **Enhanced side and rear visibility**: Distributed placement provides more uniform 360-degree coverage compared to a single roof-mounted unit, which has inherent blind spots directly below and to the sides
- **Enhanced long-range detection**: Solid-state sensors can concentrate laser energy for improved range on specific scan sectors

**Challenges addressed by the architecture:**
- **Multiple sensor coordination**: Distributed solid-state sensors require precise time synchronization and coordinate alignment to produce a coherent 3D scene representation
- **Field-of-view tiling**: Unlike a spinning LiDAR that inherently covers 360 degrees, solid-state sensors have limited FOV and must be tiled to achieve full coverage

### Point Cloud Processing

The LiDAR encoder in Nuro's unified perception model processes raw point clouds into spatial features. Based on the architecture:
- Point clouds from multiple solid-state sensors are aggregated into a unified coordinate frame
- The encoder extracts geometric features that capture object shapes, surfaces, and spatial relationships
- These features are projected into the shared voxel feature space for fusion with other modalities

### LiDAR-Specific Patents

Nuro holds patents related to LiDAR technology organized across 4 patent families:
- **US20190018109A1**: Image size compensation method for LiDAR systems, addressing manufacturing-induced discrepancies between transmission and collection lens optical properties through positional adjustments
- **US Patent App. 16/682235 (published as US20200150278A1)**: LiDAR for vehicle blind spot detection using short-range sensors deployed on bumpers and door sides, capable of detecting objects within inches of the vehicle -- critical for close-range pedestrian safety in delivery scenarios

### LiDAR in the Perception Pipeline

In Nuro's release notes, specific improvements tied to LiDAR perception include:
- 13% expansion in object detection range for high-speed road capability (October 2023)
- 72% latency reduction through combining localization and perception models (September 2023), which leveraged shared LiDAR feature processing
- 7.5% improvement in foreign object and debris detection at night via unified geometry models (April 2024)

---

## 5. Camera Perception

### Camera Processing Pipeline

Cameras remain the richest source of appearance information for object classification. Nuro's camera perception pipeline processes images through the camera encoder, which is part of the unified perception model.

**Image encoder pretraining.** The camera encoder is pretrained on large-scale image datasets before being integrated into the unified model. This pretraining:
- Provides strong visual features that transfer well to autonomous driving tasks
- Improves performance on all downstream tasks that depend on visual features
- Facilitates integration with other foundation models (including VLMs for open vocabulary capabilities)

### Vision Transformer (ViT) Integration

In April 2024, Nuro updated the camera encoder to incorporate a **Vision Transformer (ViT)** architecture. The results were immediate and measurable:
- **5% boost in emergency vehicle detection** without any increase in false positives
- The ViT architecture's attention mechanism allows the model to focus on salient regions of the image, which is particularly effective for detecting emergency vehicles (which have distinctive but variable visual patterns -- flashing lights, reflective markings, varying vehicle types)

The choice of ViT over traditional convolutional architectures aligns with industry trends: transformer-based vision models excel at capturing long-range spatial dependencies and can be efficiently scaled with more compute.

### Camera-Specific Perception Tasks

Cameras contribute disproportionately to several perception tasks:
- **Traffic light detection**: Dedicated traffic light detection cameras are specifically positioned and calibrated for this task, processing color and pattern information that only cameras can capture
- **Human traffic controller recognition**: Cameras are the primary modality for detecting human traffic controllers. Nuro achieved a 43% improvement in recognition, with a 380% improvement in detecting controllers holding signs (February 2024), and an additional 10% recall improvement via the unified perception model architecture
- **Fine-grained classification**: Distinguishing between vehicle types (sedan, truck, motorcycle), pedestrian postures (standing, walking, crouching, running), and cyclist behaviors
- **Text and sign reading**: Processing road signs, street names, and delivery addresses

### Rain Detection

Nuro's camera pipeline includes a rain detection model that classifies precipitation intensity. An April 2024 upgrade increased light rain recall by 83% and heavy rain recall by 8%, enabling the autonomy stack to adapt driving behavior to weather conditions.

---

## 6. Radar Perception

### Imaging Radar Capabilities

Nuro uses long-range, high-resolution **imaging radar** sensors -- a significant upgrade from traditional automotive radar. Imaging radar differs from conventional radar in several ways:

| Capability | Conventional Radar | Imaging Radar (Nuro) |
|---|---|---|
| **Angular resolution** | Low (~10-15 degrees) | High (~1-2 degrees) |
| **Elevation data** | None or minimal | Yes (3D detection capability) |
| **Object separation** | Poor (clusters objects) | Good (resolves individual objects) |
| **Point density** | Sparse | Dense (approaching sparse LiDAR) |
| **Velocity measurement** | Yes (Doppler) | Yes (Doppler, per-point) |

### All-Weather Perception

Radar is Nuro's primary sensor for maintaining perception in adverse weather. While cameras degrade in rain, fog, and snow, and LiDAR point clouds can be corrupted by precipitation returns, radar operates effectively in all conditions. Nuro's documentation states that the imaging radar sensors "help detect the distance and depth of small, distant objects, even in challenging weather."

Specific radar advantages for all-weather operation:
- **Rain**: Radar wavelengths (millimeter-wave) pass through rain droplets with minimal attenuation
- **Fog**: Radar penetrates fog where cameras and even LiDAR struggle
- **Snow**: Radar can detect objects through falling and accumulated snow
- **Dust**: Radar is unaffected by airborne particulate matter

### Radar-Specific Detection Improvements

From Nuro's release notes (February 2024): Integration of a new radar model improved **motorcyclist recall by 4.7% in far-range scenarios**. Motorcyclists are notoriously difficult radar targets due to their small radar cross-section, making this improvement significant.

The imaging radar also provides:
- **Direct velocity measurement**: Unlike cameras or LiDAR (which infer velocity from position changes across frames), radar measures velocity directly via Doppler effect, providing instantaneous and accurate speed readings for every detected point
- **High-speed vehicle detection**: The improved velocity and angular resolution supports detection of high-speed vehicles and cross-traffic, which is critical for intersection and highway driving

---

## 7. Thermal Camera Perception

### Operating Principle

Nuro's thermal cameras operate in the **Long-Wave Infrared (LWIR)** spectrum (8-14 micrometers), detecting thermal radiation emitted by objects based on their temperature. Unlike visible-light cameras, thermal cameras do not rely on ambient illumination or reflectivity.

### Advantages for Delivery Perception

Thermal cameras are particularly valuable in Nuro's delivery context:

**Nighttime pedestrian detection.** Delivery vehicles operate from early morning through late evening. In residential areas with poor street lighting, thermal cameras detect pedestrians by their body heat, creating a high-contrast image where people stand out clearly against the ambient background.

**Partial occlusion.** Thermal cameras detect body heat even when a pedestrian is partially hidden behind a bush, fence, or parked car. This is critical in residential environments where pedestrians frequently emerge from behind occluded areas.

**Glare immunity.** Thermal cameras are inherently resilient to direct sunlight and headlight glare because they operate in a completely different part of the electromagnetic spectrum. Low-angle sun that blinds visible-light cameras has no effect on LWIR sensors.

**Animal detection.** Pets (dogs, cats) and wildlife are significant detection targets for delivery vehicles operating in residential neighborhoods. Thermal cameras provide an additional detection modality for warm-blooded animals that may be small and difficult to detect visually, especially at night.

### Thermal Camera Configuration

On the R2, a single front-facing thermal camera was deployed. Nuro describes it as "an additional modality for detecting pedestrians in front of the vehicle" that "works extremely well at night and in cases where a pedestrian is only partially visible."

The next-generation architecture continues to include thermal cameras as part of the multi-modal sensor suite, with the thermal encoder feeding into the unified perception model's voxel feature space.

### Comparison with Zoox's LWIR Approach

Nuro's use of LWIR thermal cameras parallels Zoox's deployment of thermal cameras for pedestrian detection. Both companies identified the same fundamental advantage: thermal imaging provides an independent detection modality for vulnerable road users that is complementary to all other sensors. The key difference is operational context -- Zoox deploys thermal cameras primarily for urban robotaxi operation, while Nuro prioritizes residential delivery scenarios where the combination of low lighting, residential clutter, and unpredictable pedestrian behavior (children, pets) makes thermal sensing especially valuable.

---

## 8. Audio Perception

### Emergency Vehicle Siren Detection

Nuro's vehicles are equipped with a distributed microphone array specifically designed for emergency vehicle detection.

**Hardware architecture:**
- An array of multiple microphones placed around the vehicle body
- Designed for long-range siren detection -- can hear approaching emergency vehicles from a significant distance
- Provides directional information through array beamforming -- the system can triangulate the direction of an approaching siren

**Detection pipeline:**
- Microphones continuously listen for emergency vehicle sirens (police cars, fire trucks, ambulances)
- Audio processing identifies siren signatures against ambient noise
- Directional estimation determines where the siren is coming from
- The detection triggers a safe pullover maneuver well in advance of the emergency vehicle's arrival

### Unified Siren Perception Model

In November 2025, Nuro published "Building Better Ears: Nuro's Unified Siren Perception Model," describing their approach to audio-based emergency vehicle detection. The model addresses why self-driving vehicles need "ears" -- with reliable audio detection, the AI driver has more time to react safely to approaching emergency vehicles compared to relying solely on visual detection (which requires line-of-sight).

The audio encoder in the perception foundation encoder processes raw audio data and feeds it into the unified perception model alongside visual and spatial sensor data. This integration allows the system to correlate audio detections (hearing a siren) with visual detections (seeing flashing lights) for robust emergency vehicle recognition.

### Audio as the Sixth Modality

Audio perception is unique among Nuro's six modalities because it operates in a fundamentally different physical domain (pressure waves vs. electromagnetic radiation). This makes it truly independent from all other sensors:
- A failure of all cameras, LiDARs, radars, and thermal cameras would not affect siren detection
- Audio detection works around corners and behind occluding objects where no line-of-sight sensor can see
- It provides the earliest possible warning for approaching emergency vehicles

---

## 9. Multi-Sensor Fusion

### Voxel-Based Fusion Architecture

Nuro's fusion architecture converts all sensor modalities into a **unified voxel feature space** -- a 3D grid of learned feature vectors that encodes the scene from all sensors simultaneously.

**Why voxel fusion:**
- Voxels provide a natural 3D representation that captures spatial relationships between objects
- All sensor modalities can be projected into the same voxel grid regardless of their native data format (2D images, 3D point clouds, range-Doppler maps, thermal images, audio spectrograms)
- The voxel representation supports both detection (what is at each location) and prediction (how the scene will evolve)
- It eliminates the need for explicit geometric registration between sensor modalities -- the network learns the alignment implicitly

**Fusion process:**
1. Each sensor encoder produces modality-specific features in its native format
2. The sensor fusion module transforms these features into the unified voxel space, projecting camera features via learned 2D-to-3D lifting, LiDAR features via point-to-voxel conversion, and radar/thermal features via their respective projections
3. Multi-modal spatial features are generated by combining the projected features within each voxel
4. The temporal module then aligns these spatial features across time steps for temporal consistency

### Sensor Dropout for Robustness

A key innovation in Nuro's fusion approach is **sensor dropout during training**. During training, entire sensor modalities are randomly masked (set to zero), forcing the model to learn representations that do not depend critically on any single sensor. This produces a model that:
- Degrades gracefully when individual sensors fail or are obscured (e.g., a camera covered by mud, a LiDAR partially blocked)
- Can operate on vehicles with different sensor configurations (delivery robot vs. robotaxi) without retraining from scratch
- Provides robust performance even under adversarial conditions (e.g., extreme weather affecting one modality)

### Redundancy Through Diversity

The six-modality approach provides defense-in-depth against sensor-specific failure modes:

| Failure Mode | Unaffected Modalities |
|---|---|
| Rain/fog/snow | Radar, thermal, audio, IMU |
| Darkness | LiDAR, radar, thermal, audio, IMU |
| Glare (low sun, headlights) | LiDAR, radar, thermal, audio, IMU |
| Sensor surface contamination (mud, ice) | Other instances of same modality + all other modalities |
| GPS denial | LiDAR, cameras, radar, thermal, audio, IMU (inertial dead reckoning) |
| Electromagnetic interference | Cameras, thermal, audio, IMU |

### Latency and Synchronization

Multi-sensor fusion requires precise temporal synchronization. Nuro has achieved major latency reductions in their fusion pipeline:
- **41% perception latency reduction** through enhanced ML model scheduling and synchronization (November 2023)
- **25% mainline path latency improvement** with 7% CPU usage reduction through event prioritization optimization (May 2024)
- **15% mainline path latency improvement** and **40% GPU usage reduction** through extended inference support for major model layers (June 2024)
- **72% latency drop** by combining localization and perception models into a shared inference pass (September 2023)

---

## 10. 3D Object Detection

### Detection Architecture

Nuro's 3D object detection operates as a task head within the unified perception model, processing the fused spatial-temporal features from the voxel representation.

**Multi-class detection.** The system detects and classifies objects into categories relevant to autonomous driving, with particular emphasis on delivery-context classes:

| Category | Subcategories | Delivery Relevance |
|---|---|---|
| **Pedestrians** | Adults, children, unusual postures | Critical -- high priority in residential areas |
| **Cyclists** | Bicycles, e-scooters, e-bikes | High -- frequent in suburban neighborhoods |
| **Vehicles** | Cars, trucks, motorcycles, buses | Standard -- traffic interaction |
| **Animals** | Dogs, cats, horses, large birds | High -- unique to delivery context (pets in yards) |
| **Emergency vehicles** | Police, fire, ambulance | Critical -- requires immediate response |
| **Human traffic controllers** | With/without signs | Important -- construction zones |
| **Foreign objects and debris** | Road debris, fallen objects | Important -- obstacle avoidance |
| **Uncategorized moving objects** | Novel objects not in training set | Important -- long-tail safety |
| **Infrequent vehicles** | Excavators, golf carts, tractors | Moderate -- edge cases |

### Detection Range

Nuro's detection range has expanded as the company transitioned from low-speed delivery-only operation to highway-capable perception:
- **13% expansion in object detection range** for high-speed road capability (October 2023)
- Long-range imaging radar and ultra-long-range cameras specifically address detection at distances required for highway speeds (65+ mph)
- Close-range detection remains critical, supported by short-range cameras and short-range LiDAR sensors that can detect objects within inches of the vehicle

### Detection Performance Improvements (from Release Notes)

| Date | Improvement | Metric |
|---|---|---|
| Nov 2023 | Perception false negative reduction | >20% across all scenarios |
| Feb 2024 | Motorcyclist far-range recall (radar model) | +4.7% |
| Feb 2024 | Human traffic controller recognition | +43% |
| Feb 2024 | Controllers holding signs | +380% |
| Apr 2024 | Foreign object/debris detection at night | +7.5% |
| Apr 2024 | Emergency vehicle detection (ViT) | +5% |
| May 2024 | Human traffic controller detection | +20% (cumulative over 2 months) |
| May 2024 | Emergency vehicle recall | +20% (threshold refinement) |
| Jun 2024 | VRU and animal detection | +50% (unprotected maneuver dataset) |
| Jun 2024 | VRU dataset performance | +30% |

### Occupancy and Flow Estimation

Beyond bounding-box detection, the unified perception model produces **occupancy and flow** outputs:
- **Occupancy grids**: A 3D volumetric representation of which voxels in the scene are occupied, providing a dense understanding of the environment that captures objects of any shape (including non-standard objects that don't fit bounding boxes)
- **Flow estimation**: Per-voxel motion vectors predicting how the scene is moving, which feeds directly into prediction for anticipating future object positions

The integration of continuous occupancy height into world state encoding (March 2024) improved overall perception quality by providing a richer 3D representation of the scene geometry.

---

## 11. Object Tracking

### Tracking in the Delivery Context

Object tracking in Nuro's delivery vehicles has characteristics distinct from high-speed robotaxi tracking:

**Low-speed advantages.** At 25-45 mph, objects move through the sensor field more slowly, providing more observations per object per second. This makes tracking easier in some respects (more data points per track) but introduces its own challenges:
- Objects may appear static or quasi-static relative to the vehicle (e.g., pedestrians walking alongside the slowly moving vehicle)
- The vehicle frequently stops and starts, creating challenging ego-motion compensation scenarios
- Objects at close range move rapidly through the field of view even at low vehicle speeds

**Stateful temporal modeling for tracking.** The unified perception model's temporal module performs stateful tracking by conditioning on task features/queries from T-1 to T-n. This allows the tracker to maintain persistent identity assignments across occlusion events, velocity changes, and sensor handoffs.

### Tracking Performance

Key tracking improvements from release notes:
- **40% reduction in false positive tracks** for uncategorized moving objects (April 2024)
- **30% improvement in speed estimation** for tracked objects (April 2024)
- **65% improvement in reversing vehicle orientation detection** (December 2023)
- **10% improvement in orientation accuracy for large vehicles** (March 2024)
- **18.3% precision improvement** for infrequent moving objects (December 2023)

### Track-Level Perception for LAMBDA

Nuro's LAMBDA language reasoning model can reference tracked road users by their unique perception IDs. This indicates that the tracking system assigns stable, persistent identifiers to all tracked objects, enabling higher-level reasoning about specific agents across time. The perception stack provides agent features for nearby road users to LAMBDA, including position, velocity, heading, and classification.

---

## 12. Prediction

### Multi-Hypothesis Prediction System

Nuro's prediction module generates **multiple hypotheses** for each detected and tracked agent, rolling each hypothesis out **10 seconds into the future**. This multi-hypothesis approach acknowledges the fundamental uncertainty in predicting other agents' behavior.

**Key characteristics:**
- Multiple hypotheses per agent per second, each representing a plausible future trajectory
- Considers how the autonomous vehicle's own actions may influence other agents' behavior (interactive prediction)
- Selects the safest option to proceed based on risk evaluation across all hypotheses
- Relies heavily on machine learning trained on hundreds of millions of recorded human driving interactions

### Prediction in the Delivery Context

Delivery vehicles encounter distinctive prediction challenges:
- **Unpredictable pedestrian behavior in residential areas**: Children may run into the street; dog walkers may change direction suddenly; residents may approach the vehicle to retrieve deliveries
- **Driveway interactions**: Vehicles backing out of driveways require prediction of intent and trajectory in constrained spaces
- **Cyclist interactions**: Delivery vehicles share residential streets with cyclists who may not follow standard traffic patterns
- **Pet behavior**: Animals are inherently less predictable than human road users

### Fallback and Safety

The prediction system has ML-first predictions with rules-based fallbacks:
- ML models provide primary predictions based on learned behavior patterns
- Fallback predictions based on vehicle dynamics and map information activate when the ML model is uncertain or detects anomalous behavior
- The system can detect when agents are not matching predictions and responds conservatively -- and because there are no passengers, Nuro can afford to stay conservative for longer periods

### Improvement Metrics

- **12% improvement in interaction predictions with other vehicles** (January 2024)
- **47% improvement in reacting to obstacles** like curbs and vegetation (February 2024)
- **50% improvement in unprotected maneuver dataset performance** (June 2024)

---

## 13. Pedestrian Safety Perception

### Central Design Priority

Pedestrian safety is the organizing principle of Nuro's entire perception system. The zero-occupant vehicle design eliminates the traditional tension between passenger safety and pedestrian safety, allowing Nuro to optimize entirely for external human protection.

### Close-Range Pedestrian Detection

Delivery vehicles operate in close proximity to pedestrians during curbside delivery, residential street navigation, and crosswalk interactions. The perception system provides:

**Multi-modal pedestrian detection.** Pedestrians are detected by:
1. **Cameras**: Primary modality for appearance-based detection and classification (posture, gait, age estimation)
2. **LiDAR**: Provides precise 3D geometry and distance measurement for pedestrians
3. **Radar**: Detects pedestrian motion and velocity, particularly useful in adverse weather
4. **Thermal camera**: Detects body heat, especially effective at night and for partially occluded pedestrians
5. **Short-range LiDAR**: Nuro's patent (US20200150278A1) describes short-range LiDAR systems deployed on bumpers and door sides that can detect pedestrians within inches of the vehicle

### Vulnerable Road User (VRU) Detection

Nuro's release notes highlight significant investments in VRU detection:
- **50% improvement in VRU detection** in unprotected maneuver scenarios (June 2024)
- **30% improvement in VRU dataset performance** (June 2024)
- Detection improvements span pedestrians in unusual postures, partially occluded pedestrians, and pedestrians in challenging lighting conditions

### Edge Case Handling

Nuro's training data pipeline (via Scale AI's Nucleus) has identified and labeled large numbers of edge cases critical for pedestrian safety:

| Edge Case | Training Examples Found |
|---|---|
| Pedestrians in unusual postures | 1,000+ (vs. ~60 with internal tools) |
| Occluded/backlit pedestrians | 500+ (vs. 10-20 with internal tools) |

### Pre-Deployed External Airbag

The perception system's confidence directly enables a novel safety feature: Nuro's external pedestrian airbag (R3, developed with Autoliv) can be **pre-deployed before contact** because the perception system provides high-accuracy, redundant, 360-degree detection with sufficient lead time. This is only possible because the perception system reliably detects imminent collisions early enough to inflate the airbag before impact.

---

## 14. Semantic Segmentation and Scene Understanding

### Unified Model Outputs

Semantic segmentation and scene understanding are produced as task heads within the unified perception model, operating on the fused spatial-temporal features.

### Delivery-Relevant Segmentation Classes

The segmentation system must distinguish several classes that are particularly important for delivery operations:

**Drivable area detection.** The system identifies navigable road surfaces, distinguishing between:
- Driving lanes (standard road surface)
- Curbs and curb ramps (critical for precise curbside stopping)
- Driveways (potential vehicle entry/exit points)
- Shoulders and road edges
- Parking areas and loading zones

**Online mapping.** The scalable HD mapping approach fuses offline map priors with online sensor data, predicting polyline features including:
- Lane markings
- Curbs
- Driveways
- Lane centers

This hybrid approach uses a BEV (bird's-eye-view) encoder that fuses sensor information, combined with offline HD map priors, to predict the final map representation. The system learns to pass through the offline prior when correct but remains robust to map changes, addressing the fundamental challenge of HD map staleness.

### Unusual Scene Understanding

The perception system includes an unusual scene detection capability, critical for handling the long tail of driving scenarios. Nuro's LAMBDA model can reason about unusual scenes by combining perception features with language model understanding, enabling it to identify and describe novel situations that the system has not been explicitly trained to handle.

### Weather and Condition Detection

- **Rain detection model**: Classifies precipitation intensity (light rain recall +83%, heavy rain recall +8% as of April 2024)
- **Night-time perception**: Significantly expanded night-time testing coverage (September 2023), with specific improvements in foreign object/debris detection at night (+7.5%)

---

## 15. Zero-Occupant Perception Advantages

### Fundamental Safety Reframing

The zero-occupant design creates perception advantages that are impossible for passenger-carrying vehicles. Nuro estimates that for every mile of driving replaced by a zero-occupant vehicle, the risk of fatality or injury is reduced by approximately 60%.

### Higher Recall, Lower Precision Tolerance

Nuro explicitly tunes perception for **higher recall** at the expense of more conservative behavior:
- The system can afford to detect "phantom" obstacles (false positives) because stopping for a false positive in a delivery vehicle only delays a package delivery, not a human passenger
- Higher recall means fewer missed detections (false negatives), directly improving safety
- This trade-off would be unacceptable in a robotaxi, where frequent unnecessary stops degrade passenger experience and trust

### More Aggressive Stopping Trajectories

Because there are no passengers to injure through hard braking:
- The vehicle can execute emergency stops at deceleration rates that would cause passenger injury in a conventional vehicle
- The onboard computer continuously calculates multiple potential stopping trajectories that would be safe if a system failure occurs
- These preplanned trajectories are resilient to loss of connectivity or computer malfunction since they are precomputed and sent to the high-reliability computer frequently

### Extended Conservative Mode

The system detects when agents are not matching predictions and becomes more conservative. In a delivery vehicle, this conservatism can be maintained for extended periods without negative consequences -- there is no passenger growing frustrated with unnecessary caution.

### Lower Kinetic Energy

The R2 weighs 2,535 lb and operates at 25 mph. The kinetic energy at maximum speed is a fraction of a full-size vehicle at highway speed, meaning even in a collision, the energy available to cause harm is dramatically reduced. This lower energy budget means perception "misses" have less catastrophic consequences, though the system is still designed to minimize them.

---

## 16. FTL Model Compiler Framework

### Overview

The **Faster Than Light (FTL) Compiler Framework** is Nuro's custom ML model optimization toolchain for deploying perception and other models to onboard compute. It bridges the gap between research-trained models (on cloud TPU/GPU clusters) and the constrained onboard NVIDIA DRIVE Thor hardware.

### Architecture

```
    Training Framework           FTL Compiler                    Onboard
    (TensorFlow/PyTorch)    ┌─────────────────────┐           Deployment
         │                  │                     │
         │  ONNX export     │  Orchestrator       │
         ├─────────────────►│  Segmenter          │
         │                  │    │                │
         │                  │    ▼                │
         │                  │  TensorRT           │     NVIDIA
         │                  │  Compilation        ├────► DRIVE
         │                  │    │                │     Thor
         │                  │    ▼                │
         │                  │  Segment Breaker    │
         │                  │  (precision control)│
         │                  │    │                │
         │                  │    ▼                │
         │                  │  Multi-GPU          │
         │                  │  Pipeline Split     │
         │                  │    │                │
         │                  │    ▼                │
         │                  │  Custom Kernel      │
         │                  │  Injection          │
         │                  └─────────────────────┘
```

### Key Components

**ONNX conversion.** Models from multiple training frameworks (TensorFlow, PyTorch) are exported to ONNX format, providing a framework-agnostic intermediate representation.

**Orchestrator Segmenter.** Compiles relevant parts of the computational graph to TensorRT (NVIDIA's inference optimization engine), enabling selective optimization of different model components while maintaining flexibility.

**Segment Breaker.** Allows developers to isolate and configure specific subgraphs for particular precision levels (e.g., FP32 for precision-sensitive operations). This addresses issues that arise during model export and conversion where certain operations may produce incorrect results at reduced precision.

**Multi-GPU inference via pipeline parallelism.** FTL splits the model via subgraphs across multiple GPU devices, enabling pipeline-parallel inference. Users can configure multi-GPU inference in their model with minimal effort. This approach achieved an **approximately 27-28% reduction in latency** for Nuro's perception detector.

**Custom kernel injection.** The framework supports injecting custom PyTorch GPU kernels into the final compiled graph, enabling fine-grained optimization at the kernel level for operations where the standard compilation path is suboptimal.

**Quantization.** FTL supports reduced-precision inference (FP16, INT8) for model components where precision loss is acceptable, reducing compute requirements and memory consumption.

### Performance Impact

After general adoption of FTL across Nuro's models:
- Significant reductions in CPU compute utilization
- Significant reductions in GPU compute utilization
- Significant reductions in GPU memory consumption
- A unified optimization platform where a single code change delivers performance improvements to all models simultaneously
- Non-ML-infra teams (e.g., onboard performance teams) can independently optimize CPU utilization and upgrade CUDA APIs

### Importance for Perception

The unified perception model is the most computationally demanding model on the vehicle. The Perception and ML-Infra teams closely collaborated to develop novel solutions within FTL and the ML runtime to support running the multi-sensor, multi-task unified perception model efficiently on the limited onboard compute of the NVIDIA DRIVE Thor platform.

---

## 17. Geospatial Foundation Model

### Architecture

Nuro is developing a **geospatial foundation model** that combines real-time perception data with low-cost map priors for three key capabilities:
1. **Precision global localization** -- centimeter-level position tracking at all times
2. **Online map feature inference** -- real-time map updates from sensor data
3. **Real-time sensor calibration** -- continuous calibration adjustment as road conditions change

### Learned Localization: Aerial-Ground Alignment

The localization system bridges satellite/aerial map data with street-level sensor data through a learned cross-modal alignment:

**Online encoder.** Consumes onboard LiDAR point cloud spins and produces an embedding of the vehicle's current local environment.

**Geospatial encoder.** Consumes aerial data from two modalities:
- **Aerial RGB imagery** from USDA sources
- **Digital Surface Models (DSM)** from USGS, providing elevation data

**Cross-correlation alignment.** The embedding images from both encoders are aligned by computing cross-correlation over a search window of possible x, y, and theta offsets. Vehicle-to-map alignment during training produces improved contrast of the online embedding and reduced uncertainty compared to models trained without alignment.

### Scalable HD Mapping

Nuro's HD mapping approach addresses the fundamental problem that traditional HD maps become stale as road infrastructure changes. Their hybrid architecture:

1. **Traditional approach** (baseline): Labels are hand-labeled and passed onboard; change detection systems identify discrepancies
2. **Online-only prediction**: A model predicts polyline features by fusing sensor information in a BEV encoder, decoded into map features
3. **Hybrid approach** (Nuro's innovation): Learns to fuse information from an offboard HD map prior and onboard sensors to predict the final polylines. The model "learns to pass through the offline HD map prior when correct" but adapts when the map is outdated

Map features represented include lane markings, curbs, driveways, and lane centers.

### National Data Collection Initiative

Nuro's perception and mapping system is trained on data collected from a coast-to-coast data collection initiative spanning **59 U.S. cities**. This initiative is designed to accelerate the development of a scalable, generalizable autonomy stack by capturing the diversity of American road environments. The collected data feeds directly into training the geospatial foundation model, the unified perception model, and HD map generation. A second national data collection tour expanded coverage further.

The system has demonstrated the ability to create precise maps of San Francisco without relying on preexisting context maps, generating maps purely from real-time perception data.

### International Expansion

In March 2026, Nuro brought test vehicles to Tokyo, Japan, marking its first international data collection initiative. The system operated as **"zero-shot autonomous driving"** -- navigating Tokyo's public roads without any prior training on Japanese driving data. This demonstrates that the perception and geospatial models have learned sufficiently general representations of road environments that they transfer across countries with fundamentally different driving conventions (left-side driving, different signage, different lane markings).

---

## 18. Calibration

### Real-Time Sensor Calibration

Calibration -- ensuring that all sensors are precisely aligned and synchronized -- is critical for multi-sensor fusion. Nuro's approach integrates calibration directly into the geospatial foundation model as a learned capability rather than a purely offline geometric procedure.

**Key aspects:**
- **Real-time calibration**: The geospatial foundation model enables real-time sensor calibration that responds to changing road conditions, vibrations, thermal expansion, and other factors that cause calibration drift during vehicle operation
- **Learned calibration**: Rather than relying solely on fiducial markers or manual calibration procedures, the system learns calibration parameters as part of its training, allowing it to self-correct during operation
- **Cross-sensor alignment**: The unified voxel feature space inherently requires precise calibration between all sensor modalities; the fusion module learns to compensate for minor misalignments

### LiDAR Calibration Patents

Nuro holds patents specifically addressing LiDAR calibration:
- **US20190018109A1**: A method for image size compensation in LiDAR systems that addresses manufacturing-induced discrepancies between transmission and collection lens optical properties through positional lens adjustments. This addresses the practical challenge that LiDAR transmission and collection lenses should have identical optical performance, but manufacturing tolerances introduce discrepancies.

### Calibration in Fleet Operations

For fleet-scale deployment, Nuro's calibration approach must be:
- **Automated**: No manual calibration procedures in the field
- **Continuous**: Calibration is maintained and updated during normal operation
- **Robust**: System must detect and compensate for calibration degradation caused by road vibrations, temperature cycling, and physical impacts

---

## 19. Auto-Labeling and Training Data

### Dataset Scale

Nuro's Perception Team maintains a dataset at a scale of **over 500 million images**. This dataset is continuously growing through fleet data collection across multiple U.S. cities and, as of 2026, international locations (Tokyo).

### Scale AI Partnership

Nuro's data labeling partnership with Scale AI provides:
- **2D image labeling**: Bounding boxes, semantic masks, classification labels
- **3D data labeling**: 3D cuboids for objects in point cloud and fused sensor data
- **HD map labeling**: Road features, lane markings, traffic infrastructure
- **Dataset curation**: Via Scale's Nucleus platform for managing and exploring the massive dataset

### Auto-Labeling with 3D Cuboids

From the November 2023 release notes: Nuro achieved **75% automation of 3D cuboid labeling** with a **67% reduction in error rate**. This indicates a sophisticated auto-labeling pipeline where:
1. Initial labels are generated automatically by a trained model
2. Human reviewers verify and correct a subset of labels
3. The auto-labeling model is iteratively improved based on corrections

### Edge Case Mining with Autotag

Scale AI's **Autotag** functionality enables Nuro to efficiently find rare scenarios in their massive unlabeled dataset:
- Users select unlabeled images of a certain category
- An internal model and its feature vectors identify a set of similar images suitable for labeling
- This dramatically improves the discovery of rare edge cases

**Effectiveness vs. internal tools:**

| Edge Case | Internal Tool Yield | Nucleus/Autotag Yield | Improvement |
|---|---|---|---|
| Pedestrians in unusual postures | ~60 | 1,000+ | ~17x |
| Animals (horses, large birds, small non-pets) | ~50 | 400+ | ~8x |
| Occluded/backlit pedestrians | 10-20 | 500+ | ~25x |
| Infrequent vehicles (excavators) | 10-20 | 500+ | ~25x |

### Model Retraining Velocity

Nuro's ML team can incorporate newly identified edge cases and retrain a new perception model in **just a few days** rather than over a week. This rapid iteration cycle is critical for closing safety gaps identified through on-road operation.

### Performance Targets

Nuro aims for **higher than 95% accuracy for rare cases** that often comprise only 1% of the dataset. This asymmetric accuracy target reflects the safety-critical nature of detecting unusual objects (a child in an unusual posture, an animal in the road).

### AlloyDB Vector Infrastructure

Nuro uses Google Cloud's **AlloyDB** (PostgreSQL-based) with its vector store and advanced indexing using **ScaNN** (Scalable Nearest Neighbors) for running complex similarity searches. These searches quickly identify scenarios where the Nuro Driver can learn and improve, enabling data-driven perception development at scale.

---

## 20. Reinforcement Learning for Perception and Behavior

### RL Training Infrastructure

Nuro has built a highly performant RL training system that enables training on **years worth of driving experience in only a single hour** (or decades of experience in hours at full scale).

**Architecture:**
- **Distributed training**: Scales across GPU/TPU resources and parallel simulations hosted on Google Kubernetes Engine (GKE)
- **Closed-loop training**: RL agents train in simulation with realistic dynamics and traffic, using high-fidelity production simulation integrated into the training loop
- **Hundreds of parallel simulations**: Run on a single cloud instance, with optimizations including:
  - Map data sharding and caching
  - Remote model inference
  - Efficient inter-module data sharing
- **Abstracted communication and simulation**: Researchers can plug in new agent architectures and algorithms to test state-of-the-art RL methods without modifying the infrastructure

### CIMRL: Combining Imitation and Reinforcement Learning

Nuro developed **CIMRL** (Combining Imitation and Reinforcement Learning for Safe Autonomous Driving), a novel approach that merges the strengths of both learning paradigms:

**Imitation learning strengths**: Produces naturalistic driving behavior by learning from human demonstrations
**Reinforcement learning strengths**: Optimizes for specific objectives (safety, progress) and can explore beyond human demonstrations

**Safety-filtering mechanism (Recovery RL):**
- During inference, the system identifies unsafe actions that violate safety constraints (quantified by a learned risk function, Qrisk)
- When some actions are safe, it re-normalizes the policy over safe actions and samples from the truncated distribution
- When all actions violate constraints, it falls back to a recovery policy
- This safety filter prevents the RL-trained policy from executing dangerous maneuvers

**Results:**
- Outperforms Motion Transformer (MTR) approaches on collision rates
- Better than behavior cloning on both collision and progress metrics
- Successfully learned to navigate T-shaped intersections without becoming stuck mid-crossing
- Executes safe intersection crossing without excessive conservatism or "creeping" behavior

### RL Applications in Perception-Adjacent Tasks

While RL is not directly used to train the perception model itself, it influences perception-adjacent systems:
- **Plan selection**: RL-trained models select between pullover and pullout maneuvers based on perceived environment state
- **Behavior modeling**: Human feedback reward models, incorporated via active learning, guide behavior in response to perception outputs
- **Driving policy refinement**: RL optimizes the policy that acts on perception outputs

### Human Feedback Integration

Reward models incorporate human preferences through active learning:
- Human evaluators provide feedback on driving behavior
- This feedback trains reward models that guide RL training toward safer, more naturalistic driving
- The approach connects perception quality (what the system sees) to behavioral quality (how the system drives)

---

## 21. Key Patents

### Patent Portfolio Overview

Nuro maintains **111 patents** organized into **21 patent families**, with a **100% allowance rate** at the USPTO. The portfolio spans three major technology categories.

### Perception-Related Patents

| Patent | Title | Relevance |
|---|---|---|
| **US20190018109A1** | Image size compensation in LiDAR systems | LiDAR calibration accuracy |
| **US20200150278A1** | LiDAR for vehicle blind spot detection | Short-range LiDAR for close-range pedestrian detection; sensors on bumpers and door sides |
| **US App. 16/048797 (US20190054876A1)** | Hardware and software mechanisms on autonomous vehicle for pedestrian safety | External airbag system with pre-deployment based on perception; energy-absorbing front panel |
| **US10369976B1** | Emergency deceleration safety feature | Mechanical anchoring for emergency stops |

### Delivery and Fleet Patents (16 Patent Families)

| Patent | Title | Relevance |
|---|---|---|
| **US10732629B2** | Peer-to-peer transaction using autonomous delivery vehicles | Autonomous delivery workflow |
| **USD853888S1** | Vehicle design patent | Distinctive compartmentalized delivery vehicle design |
| Various | Fleet management, autonomous navigation and control | Operational infrastructure |

### Co-Founder Patent Portfolio

**Dave Ferguson**: 100+ patents spanning perception, planning, path planning, simulation, and sensor fusion. His pre-Nuro work at Google/Waymo covered computer vision, machine learning, behavior prediction, and scene understanding. His planning algorithms are used for long-range autonomy on NASA's Mars Rovers.

**Jiajun Zhu**: 100+ patents, with pre-Nuro work at Google/Waymo focusing on perception systems and simulation for autonomous vehicles.

Combined, the co-founders hold **200+ patents**, providing a significant IP foundation for Nuro's perception technology.

### Patent Strategy

Nuro's patent portfolio emphasizes practical autonomous delivery solutions (fleet management, transaction processing, safety mechanisms) alongside foundational sensing technology (LiDAR calibration, blind spot detection). The portfolio is prosecuted by Edell Shapiro & Finnan LLC with an average prosecution time of approximately 1.4-1.5 years.

---

## 22. Key Publications and Research

### Nuro Engineering Blog Publications

Nuro's engineering team has published detailed technical content on perception and related topics:

| Publication | Date | Key Authors | Topic |
|---|---|---|---|
| **Unified Perception Model** | Oct 2024 | Zhenbang Wang, Shuvam Chakraborty, Qianhao Zhang, Zhuwen Li | Foundation model architecture, voxel fusion, temporal modeling |
| **Building Better Ears: Nuro's Unified Siren Perception Model** | Nov 2025 | (Engineering team) | Audio perception for emergency vehicle detection |
| **FTL Model Compiler Framework** | 2024 | (ML Infra team) | Model optimization for onboard deployment |
| **Exploring HD Mapping that Scales** | 2024 | (Mapping team) | Offline-online map fusion, scalable HD mapping |
| **Learned Localization: Bridging the Aerial-Ground Divide** | Aug 2025 | (Localization team) | Aerial-ground localization with cross-correlation alignment |
| **Enabling Reinforcement Learning at Scale** | Jan 2024 | Jonathan Booher, Wei Liu, Zixun Zhang, Joyce Huang, Ethan Tang | Distributed RL training infrastructure |
| **CIMRL: Combining Imitation and Reinforcement Learning** | 2024 | (Research team) | Safe autonomous driving via combined IL+RL |
| **LAMBDA: The Nuro Driver's Real-Time Language Reasoning Model** | May 2024 | (Research team) | Multimodal LLM for driving reasoning |
| **Scaling ML Training at Nuro** | 2024 | (ML Infra team) | Nuro ML Scheduler, TPU/GPU infrastructure |
| **Scaling Autonomy in the Cloud** | Dec 2024 | (Infrastructure team) | BATES system, DAG processing, cloud infrastructure |
| **The Nuro Autonomy Stack** | 2023 | (Engineering team) | End-to-end autonomy stack overview |
| **Next-Generation Sensor Architecture** | Jun 2025 | (Hardware team) | Solid-state LiDAR, sensor architecture redesign |
| **Unlocking Freeway Autonomy** | 2025 | (Engineering team) | Highway-speed perception and driving |
| **National Data Collection Initiative** | Feb 2025 | (Engineering team) | Coast-to-coast data collection across 59 U.S. cities |

### Dave Ferguson's Academic Publications (Pre-Nuro)

Dave Ferguson's academic career at CMU produced 60+ publications with 24,600+ citations. Key papers relevant to perception and planning:

| Paper | Venue | Contribution |
|---|---|---|
| **Motion Planning in Urban Environments (Part I & II)** | IROS 2008 / Journal of Field Robotics | Motion planning algorithms for the winning DARPA Urban Challenge entry (Boss) |
| **Tartan Racing: A Multi-Modal Approach to the DARPA Urban Challenge** | CMU/DARPA 2007 | End-to-end autonomous driving system for DARPA Urban Challenge |
| Various papers on path planning and field robotics | ICRA, IROS, RSS, JFR | Foundational work on planning under uncertainty, grid-based search algorithms |

Ferguson's path planning algorithms for CMU's "Boss" combined a model-predictive trajectory generation algorithm for computing dynamically feasible actions with two higher-level planners for both on-road and unstructured area navigation.

### LAMBDA Model

LAMBDA (Language Model for Autonomous Driving Applications) represents Nuro's integration of large language models with perception:
- A Multimodal LLM integrated with the autonomy stack
- Accesses perception state (agent features, map features, vehicle kinematics)
- Uses a Behavior Foundation Model pre-trained on hundreds of millions of driving examples to encode world state into continuous tokens
- Can reference road users by their perception-assigned unique IDs
- Applied retroactively to edge cases and tested in real-time in Nuro test vehicles

---

## 23. Perception for the Robotaxi Pivot

### From Delivery to Robotaxi: What Changes

In September 2024, Nuro pivoted from building delivery vehicles to licensing its Nuro Driver autonomy system. The flagship integration is the **Lucid Gravity robotaxi** for Uber, with 20,000+ vehicles planned. This pivot demands significant perception adaptations.

### New Perception Requirements

| Requirement | Delivery Vehicle | Robotaxi (Lucid Gravity) |
|---|---|---|
| **Operating speed** | 25-45 mph | Up to 65+ mph (highway) |
| **Detection range** | Short-to-medium | Long range (critical for highway) |
| **Passenger comfort** | N/A | Must minimize false positives to avoid unnecessary stops |
| **Recall vs. precision** | High recall tolerated | Must balance recall with precision for ride quality |
| **Sensor height** | ~6 ft (low) | SUV roof height (~6+ ft plus Halo module) |
| **360-degree coverage at speed** | Important | Critical (merging, lane changes, highway traffic) |
| **Night/highway perception** | Residential nighttime | Highway nighttime at high speed |

### Halo Sensor Module

The Lucid Gravity robotaxi features the **Nuro Halo** -- a purpose-built, low-profile roof-mounted sensor module that integrates cameras, solid-state LiDAR, and radars. The Halo:
- Resembles a roof cargo rack to maintain vehicle aesthetics
- Provides the elevated vantage point needed for highway-speed long-range perception
- Includes integrated LEDs that communicate ride status and display rider initials
- Supplements sensors integrated into the Lucid Gravity's body panels

### Cross-Platform Perception Architecture

The unified perception model's design explicitly supports cross-platform deployment:

**Sensor configuration flexibility.** The independent sensor encoders and sensor dropout training mean the model can adapt to the Lucid Gravity's sensor configuration (which differs from the R2/R3) without fundamental architecture changes.

**Post-training adaptation.** A single foundational model can be trained once and deployed across vehicle platforms with efficient post-training adaptation, rather than training entirely separate models for delivery and robotaxi applications.

**Proven portability.** Nuro Driver has been integrated into seven different vehicle platforms (including delivery robots, modified Toyota Priuses, and the Lucid Gravity), validating the cross-platform architecture.

### Highway Perception Expansion

The delivery-to-robotaxi transition required expanding perception from residential/suburban streets to include highways:
- **65 mph driving** with Toyota Prius test vehicles in Mountain View, collecting highway perception data
- **Lane change and merge perception**: Detecting and predicting behavior of vehicles in adjacent lanes at highway speeds
- **On-ramp and off-ramp perception**: Handling merging traffic, speed differentials, and complex geometry
- **13% expansion in object detection range** (October 2023) specifically targeting high-speed road capability
- Ultra-long-range cameras added to the sensor suite specifically for highway-speed detection distances

### Zero-Shot Generalization

The most dramatic demonstration of the perception system's generalization came in March 2026 when Nuro deployed test vehicles in **Tokyo, Japan** -- navigating public roads without any prior training on Japanese driving data. The perception system handled:
- Left-side driving (reversed from U.S.)
- Different signage conventions
- Different lane marking styles
- Unfamiliar road geometry and traffic patterns
- Japanese-specific road users (kei trucks, delivery bicycles, etc.)

This "zero-shot autonomous driving" capability suggests that the perception and geospatial foundation models have learned sufficiently abstract representations of road environments to generalize across national boundaries, a critical capability for a technology licensor targeting global deployment.

### Robotaxi-Specific Perception Features

**Passenger identification.** The Halo module's LEDs greet riders and display their initials, requiring the perception system or a connected service to identify the correct rider at pickup locations.

**Urban complexity.** Robotaxi deployment in dense urban environments (San Francisco Bay Area planned for 2026) requires perception capabilities beyond residential delivery: complex multi-lane intersections, heavy traffic, double-parked vehicles, construction zones, and diverse road user types.

**Regulatory compliance.** The perception system must meet the standards required for carrying passengers, including higher reliability requirements and more stringent safety margins than goods-only delivery.

---

## Sources

- [Nuro -- Unified Perception Model Blog](https://www.nuro.ai/blogs/unified-perception-model)
- [Nuro -- FTL Model Compiler Framework Blog](https://www.nuro.ai/blog/ftl-model-compiler-framework)
- [Nuro -- Next-Generation Sensor Architecture Blog](https://www.nuro.ai/blog/introducing-the-nuro-drivers-next-generation-sensor-architecture)
- [Nuro Driver Platform](https://www.nuro.ai/nuro-driver)
- [Nuro -- The Nuro Autonomy Stack Blog](https://www.nuro.ai/blog/the-nuro-autonomy-stack)
- [Nuro -- Enabling Reinforcement Learning at Scale Blog](https://www.nuro.ai/blog/enabling-reinforcement-learning-at-scale)
- [Nuro -- CIMRL Blog](https://www.nuro.ai/blog/cimrl-combining-imitation-reinforcement-learning-for-safe-autonomous-driving)
- [Nuro -- LAMBDA Blog](https://www.nuro.ai/blog/lambda-the-nuro-drivers-real-time-language-reasoning-model)
- [Nuro -- Learned Localization Blog](https://www.nuro.ai/blog/learned-localization-bridging-the-aerial-ground-divide)
- [Nuro -- Exploring HD Mapping that Scales Blog](https://www.nuro.ai/blog/exploring-hd-mapping-that-scales)
- [Nuro -- Scaling ML Training at Nuro Blog](https://www.nuro.ai/blog/scaling-ml-training-at-nuro)
- [Nuro -- Scaling Autonomy in the Cloud Blog](https://www.nuro.ai/blog/scaling-autonomy-in-the-cloud)
- [Nuro -- National Data Collection Initiative Blog](https://www.nuro.ai/blog/national-data-collection-initiative-scaling-nuros-path-to-a-safer-smarter-autonomous-driver)
- [Nuro -- Unlocking Freeway Autonomy Blog](https://www.nuro.ai/blog/unlocking-freeway-autonomy)
- [Nuro -- Safety: Our Vehicles Blog](https://www.nuro.ai/blog/safety-nuro-our-vehicles)
- [Nuro -- Safety: Our Autonomy Software Blog](https://www.nuro.ai/blog/safety-nuro-our-autonomy-software)
- [Nuro Release Notes](https://www.nuro.ai/release-notes)
- [Nuro Safety](https://www.nuro.ai/safety)
- [Nuro Solutions](https://www.nuro.ai/solutions)
- [Nuro-Lucid-Uber Robotaxi](https://www.nuro.ai/nuro-lucid-uber-robotaxi)
- [Lucid-Nuro-Uber CES 2026 Announcement](https://ir.lucidmotors.com/news-releases/news-release-details/lucid-nuro-and-uber-unveil-global-robotaxi-ces-announce)
- [Scale AI -- Nuro Customer Story](https://scale.com/customers/nuro)
- [Nuro Patents -- Insights;Gate Analysis](https://insights.greyb.com/nuro-patents/)
- [Nuro Patents -- GreyB Technology Profile](https://insights.greyb.com/nuro-patents-technology-profile/)
- [USPTO -- Nuro Pedestrian Safety Patent (US20190054876A1)](https://uspto.report/patent/app/20190054876)
- [USPTO -- Nuro LiDAR Blind Spot Patent (US20200150278A1)](https://uspto.report/patent/app/20200150278)
- [Dave Ferguson -- Google Scholar](https://scholar.google.com/citations?user=MkztWIoAAAAJ&hl=en)
- [Dave Ferguson -- Motion Planning in Urban Environments (CMU)](https://www.cs.cmu.edu/~maxim/files/motplaninurbanenv_part1_iros08.pdf)
- [Tartan Racing -- DARPA Urban Challenge (CMU RI)](https://www.ri.cmu.edu/publications/tartan-racing-a-multi-modal-approach-to-the-darpa-urban-challenge/)
- [NVIDIA -- Nuro Partner Page](https://www.nvidia.com/en-us/solutions/autonomous-vehicles/partners/nuro/)
- [NVIDIA Blog -- Nuro Driver](https://blogs.nvidia.com/blog/nuro-driver/)
- [Google Cloud Blog -- Nuro AlloyDB](https://cloud.google.com/blog/products/databases/nuro-drives-autonomous-innovation-with-alloydb-for-postgresql)
- [Contrary Research -- Nuro Business Breakdown](https://research.contrary.com/company/nuro)
- [TechCrunch -- Nuro Tokyo Testing (March 2026)](https://techcrunch.com/2026/03/11/nuro-is-testing-its-autonomous-vehicle-tech-on-tokyos-streets/)
- [TechRepublic -- Nuro Zero-Shot Tokyo Testing](https://www.techrepublic.com/article/news-nuro-tests-self-driving-tech-tokyo/)
- [Autonomous Vehicle International -- Nuro Sensor Architecture](https://www.autonomousvehicleinternational.com/news/sensors/nuro-drivers-next-gen-sensor-architecture-revealed.html)
- [ClimateTechList -- Nuro Perception Foundation Encoder Job Posting](https://www.climatetechlist.com/job/nuro-senior-ml-engineer-perception-foundation-encoder-Nir2SvdFmVYMvv)
- [Nuro Company Page](https://www.nuro.ai/company)
