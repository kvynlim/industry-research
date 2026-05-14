# Mapping, Localization, and Map-Free Autonomous Driving: Technical Report with Airport Airside Applicability

---

## Table of Contents

0. [Cross-Section Reading Path](#cross-section-reading-path)
1. [Map-Free / Map-Lite Autonomous Driving](#1-map-free--map-lite-autonomous-driving)
2. [Online Mapping and Scene Understanding](#2-online-mapping-and-scene-understanding)
3. [Localization Approaches](#3-localization-approaches)
4. [Spatial Memory and Place Recognition](#4-spatial-memory-and-place-recognition)
5. [Airport-Specific Mapping Challenges](#5-airport-specific-mapping-challenges)
6. [Synthesis: Implications for Airport Airside Autonomy](#6-synthesis-implications-for-airport-airside-autonomy)

---

## Cross-Section Reading Path

For photoreal 4D reconstruction, Gaussian maps, dynamic neural scene assets, and feed-forward splatting, start with [Photoreal City-Scale 4D Reconstruction](photoreal-city-scale-4d-reconstruction.md). That page separates SLAM pose sources from reconstruction assets and links into the relevant knowledge-base, simulation, perception, and world-model pages.

For GLIM, GTSAM, factor-graph SLAM, Bayes-tree updates, Hessian diagnostics, and sparse backend behavior, start with [GLIM and GTSAM Pipeline Hub](../slam-methods/glim-gtsam-pipeline-hub.md).

---

## 1. Map-Free / Map-Lite Autonomous Driving

### 1.1 The Problem with HD Maps

High-Definition maps have been the backbone of autonomous driving for a decade, providing centimeter-level lane geometry, traffic signal positions, road boundaries, and semantic landmarks. However, they carry fundamental limitations that make them increasingly untenable at scale:

- **Production cost**: HD maps cost up to **$1,000 per kilometer** to produce, requiring specialized survey vehicles with surveying-grade LiDAR, cameras, and GNSS equipment, followed by extensive post-processing in data centers.
- **Update latency**: Construction, lane reconfigurations, and infrastructure changes can render maps stale within days, yet update cycles span months or years.
- **Geographic coverage**: Despite a projected market of $2.19 billion by 2032, HD map coverage remains limited to major urban corridors. Rural roads, private facilities, and airport airside environments are largely unmapped.
- **Brittleness**: As Elon Musk articulated at Tesla Autonomy Day 2019, HD map dependency creates systems that are "extremely brittle" -- too dependent on the map and unable to adapt to environmental changes the way humans do.

These factors have driven a research trajectory from full HD map dependence toward map-lite and fully map-free paradigms.

### 1.2 Taxonomy of Map Approaches

A comprehensive 2025 survey identifies three evolutionary stages:

| Stage | Era | Characteristics | Examples |
|-------|-----|----------------|----------|
| **HD Maps** | 2015--2021 | Lane-level precision, centimeter accuracy, manual annotation | TomTom Road DNA, Waymo, HERE |
| **Lite Maps** | 2021--present | Crowdsourced, automated generation, daily updates | Tesla FSD auto-labeling, Mobileye REM, Huawei RoadCode |
| **Implicit Maps** | 2023--present | Knowledge encoded in neural network parameters | Tesla FSD v12+, Wayve GAIA, NVIDIA end-to-end |

**Lite Maps** represent a pragmatic middle ground. Rather than deploying specialized survey fleets, they leverage production vehicles with consumer-grade sensors. Raw sensor data is discarded after on-board vectorization (preserving user privacy), and only vectorized elements are uploaded for crowd-sourced map aggregation. This enables urban coverage with significantly reduced production costs and update cycles measured in hours rather than months.

**Implicit Maps** represent the most radical departure: environmental knowledge is encoded within neural network parameters rather than through traditional explicit map formats. This supports differentiable processing and backpropagation in joint learning systems, enabling end-to-end optimization from perception through planning.

### 1.3 Key Online Map Construction Methods

#### MapTR / MapTRv2

**MapTR** (ICLR 2023 Spotlight) introduced a structured modeling and learning framework for online vectorized HD map construction. Its key innovation is **permutation-equivalent modeling** -- representing map elements as point sets with groups of equivalent permutations. This accurately describes map element geometry while stabilizing the learning process, solving the fundamental problem of ambiguous point orderings in polyline representations.

**MapTRv2** (IJCV 2024) extends MapTR with:
- **Hierarchical query embedding**: Flexibly encodes structured map information at multiple levels
- **Hierarchical bipartite matching**: Stabilizes learning through structured assignment
- **Auxiliary one-to-many matching**: Accelerates convergence with dense supervision
- **Performance**: 4x shorter training schedule, 2.8 higher mAP than MapTR v1, real-time inference speed
- **State-of-the-art** on both nuScenes and Argoverse2 benchmarks

The MapTR family popularized efficient single-stage, parallel decoding with permutation-equivalent queries, establishing the dominant paradigm for online map construction.

#### HDMapNet

**HDMapNet** (ICRA 2022) was a foundational work in online HD semantic map learning. Its architecture:

1. **Input Encoding**: Images processed through EfficientNet-B0 with a neural view transformer (MLP) for perspective-to-BEV projection; point clouds encoded via PointPillars
2. **BEV Decoder**: Produces three simultaneous outputs via MLP heads:
   - Semantic segmentation (drivable area, lane markings, crossings)
   - Instance embedding (discriminative loss for clustering)
   - Direction estimation (lane direction bins)
3. **Vectorization**: Instance polylines constructed by clustering embedding maps, followed by greedy polyline tracing based on predicted direction bins

HDMapNet's limitation is its reliance on heuristic post-processing for vectorization, which restricts scalability. This motivated the development of end-to-end approaches like MapTR.

#### VectorMapNet

**VectorMapNet** (ICML 2023) introduced end-to-end vectorized HD map learning with a coarse-to-fine, two-stage architecture:

1. **BEV feature extraction** from multi-modal sensor data
2. **DETR-like map element detector** for coarse element proposals
3. **Polyline generator** for fine-grained vectorized output

Map elements are represented as sparse polyline sets that are directly compatible with downstream tasks (motion forecasting, planning), avoiding the segmentation-then-vectorize pipeline of HDMapNet.

#### Neural Map Prior (NMP)

**Neural Map Prior** (CVPR 2023) introduces a complementary concept: a learned neural representation of global maps that aids online map prediction. Rather than constructing maps from scratch each frame, NMP maintains incrementally updated global map tiles:

- **Architecture**: Global NMP stored as sparse map tiles, each corresponding to a real-world location
- **Fusion mechanism**: Current BEV features are refined using corresponding NMP prior features through:
  - **C2P (Current-to-Prior) attention**: Cross-attention that selectively weights current vs. prior features
  - **GRU (Gated Recurrent Unit)**: Dynamically updates global neural map with enhanced BEV features
- **Adaptive weighting**: When current frame quality is high, the network assigns more weight to current features; when quality is poor (rain, night), it relies more heavily on the prior
- **Key result**: NMP is "particularly useful on rainy days and at night," and substantially improves results as perception range increases

NMP is architecture-agnostic and can be applied to various map segmentation and detection methods, including HDMapNet and VectorMapNet.

#### StreamMapNet

**StreamMapNet** (WACV 2024) addresses the critical limitation of single-frame approaches: temporal instability. It introduces a streaming temporal fusion mechanism with two strategies:

- **Query propagation**: Retains high-confidence element queries from frame to frame
- **BEV fusion**: Aligns and fuses BEV features from consecutive frames

This enables long-range perception (up to 100x50 meters vs. 60x30 meters for single-frame methods) with temporal consistency. StreamMapNet surpasses other methods by at least 10.2 mAP on the original nuScenes split.

Follow-up work **SQD-MapNet** adds stream query denoising for further temporal consistency improvements.

#### MapExpert

**MapExpert** (AAAI 2025) addresses the observation that different map element types (lane boundaries, pedestrian crossings, road edges) have distinct geometric characteristics. It employs sparse experts distributed by routers to describe various non-cubic map elements accurately, rather than treating all elements with a unified decoder.

#### Other Notable Methods

- **MapNeXt**: Revisits training and scaling practices, showing significant gains from proper optimization
- **DTCLMapper**: Dual Temporal Consistent Learning for vectorized construction
- **HeightMapNet** (WACV 2025): Explicit height modeling for end-to-end HD map learning
- **MambaMap**: Applies State Space Models (Mamba) to online map construction
- **P-MapNet**: Encodes SD map priors as conditional branches with masked autoencoders

### 1.4 MapEX and Prior Map Integration

**MapEX** categorizes existing maps into three types and refines query-based estimation models' matching algorithms for handling map priors. However, its approach of simulating outdated maps by introducing artificial offsets and erasing elements risks leaking ground truth data and fails to accurately represent real-world map staleness.

More promising approaches for prior integration include:
- **PriorDrive**: Unified vector prior encoding combining multiple prior map types
- **Compressed Map Priors**: 3D perception enhancement through compressed map representations
- Performance gains from SD map integration: HDMapNet +3.0% mAP, VectorMapNet +3.9%, StreamMapNet +5.9%, MapTRv2 +5.7%

### 1.5 How Map-Free Relates to World Models: The Model IS the Map

The convergence of map-free driving and world models represents a fundamental paradigm shift. World models are generative spatio-temporal neural systems that compress multi-sensor physical observations into a compact latent state and roll it forward under hypothetical actions, letting the vehicle rehearse futures before they occur.

#### Key World Model Architectures

**OccWorld** (ECCV 2024) learns a 3D occupancy world model that simultaneously predicts ego movement and surrounding scene evolution:
- Uses a VQVAE scene tokenizer on 3D occupancy to obtain discrete scene tokens
- Employs a GPT-like spatial-temporal generative transformer for future prediction
- Can forecast future map elements (drivable areas) and agent movements **without instance or map supervision**
- Demonstrates that the spatial structure traditionally encoded in maps can emerge from learned occupancy representations

**GAIA Series** (Wayve):
- **GAIA-1** (2023): 9-billion parameter generative world model treating video, text, and control as one token stream
- **GAIA-2** (2025): Controllable multi-view generation with lighting-consistent rendering
- **GAIA-3** (December 2025): 15 billion parameters (2x GAIA-2), trained on 10x more data spanning 9 countries across 3 continents
- These models learn road rules and actor intent through unsupervised prediction rather than map annotation

**BEV-Based Implicit Maps**: Methods like FIERY and MILE compress entire scenes into compact latent codes encoding static structure and moving actors simultaneously, creating a unified top-down representation without explicit cartographic annotation.

**Occupancy-Based Encoding**: 3D voxel grids where each cell is assigned an occupancy probability yield "far richer geometric detail than 2D projections," enabling fine-grained reasoning about occlusions and spatial relationships.

**Neural Volumetric Representations**: Methods like UniSim learn photoreal feature grids from a single drive, while implicit-field methods (e.g., UnO) leverage future point clouds to learn NeRF-style 4D occupancy fields. These turn the map into a differentiable oracle for visibility or risk gradients.

#### The Conceptual Shift

The implicit map thesis holds that a sufficiently powerful world model renders explicit maps redundant:

| Traditional Pipeline | World Model Pipeline |
|---------------------|---------------------|
| Survey -> Annotate -> Store -> Retrieve -> Plan | Observe -> Encode -> Predict -> Plan |
| Map is an external artifact | Map is an emergent property of the model |
| Updates require re-surveying | Updates occur through continued observation |
| Discrete, tile-based | Continuous, differentiable |
| Static between updates | Dynamic, frame-by-frame |

Tesla's FSD v12+ exemplifies this at production scale: the system relies primarily on visual perception using cameras, with neural networks making path decisions based on fleet-learned driving patterns rather than pre-built maps. By January 2025, Tesla customers had driven 3 billion miles on FSD (Supervised), and the company launched its Robotaxi service in Austin, Texas in June 2025.

### 1.6 The CVPR 2024 Mapless Driving Challenge

The **CVPR 2024 Autonomous Grand Challenge** included a "Mapless Driving" track, explicitly requiring autonomous driving without HD maps. The winning approach, **MapVision**, demonstrated:

- Multi-perspective camera images combined with Standard-Definition (SD) maps from OpenStreetMap
- SD map integration into BEV feature maps via map encoder pre-training
- Enhanced traffic element detection via YOLOX
- Auxiliary tasks borrowed from MapTRv2 for comprehensive scene understanding

Key insight: purely map-free approaches struggled at road far-ends and under occlusion, suggesting that lightweight SD map priors (available globally from sources like OpenStreetMap) provide a valuable complement to sensor-only perception.

---

## 2. Online Mapping and Scene Understanding

### 2.1 Real-Time Vectorized Map Construction from Sensors

The modern online mapping pipeline follows a consistent architecture:

```
Multi-Camera Images -> 2D Feature Extraction -> View Transform -> BEV Features -> Map Element Decoder -> Vectorized Output
        |                                                              |
   LiDAR Points -----> Point Cloud Encoding -------------------------+
```

**View Transformation** is the critical step converting perspective image features to BEV space. Approaches include:
- **IPM (Inverse Perspective Mapping)**: Geometric projection assuming flat ground plane
- **Lift-Splat-Shoot (LSS)**: Predicts depth distribution per pixel and "lifts" 2D features to 3D, then "splats" onto BEV grid
- **BEVFormer**: Uses deformable attention with learnable BEV queries to sample spatial features from multi-camera images
- **Neural view transformer**: MLP-based direct spatial transformation (as in HDMapNet)

**Decoding strategies** have evolved from two-stage (detect then refine) to single-stage parallel decoding:
- **Two-stage**: VectorMapNet's DETR-like detection followed by polyline generation
- **Single-stage**: MapTR's permutation-equivalent queries enabling direct parallel polyline prediction
- **Streaming**: StreamMapNet's temporal propagation for consistent reconstruction across frames

### 2.2 Lane Detection and Road Boundary Detection

Lane detection in the BEV paradigm has advanced significantly:

- **Monocular lane detection** remains active with deep learning survey (November 2024) covering 100+ methods
- **BEV-based methods** focus on the view transformation challenge from front-view to BEV features
- **LLFormer4D** (2025): LiDAR-based lane detection using temporal feature fusion and sparse transformers
- **TopoSD** (2024): Topology-enhanced lane segment perception with SD map priors
- **HeightMapNet** (WACV 2025): Explicit height modeling addressing the flat-ground assumption that causes errors on slopes and overpasses

**Real-time performance** has reached practical levels: SparseBEV achieves 67.5 NDS on nuScenes at 23.5 FPS on a single GPU.

### 2.3 Semantic Scene Understanding

Online map construction methods now handle multiple semantic categories simultaneously:

- **Drivable area segmentation**: Binary classification of navigable surfaces
- **Lane boundary detection**: Vectorized polylines for lane dividers
- **Pedestrian crossing detection**: Both vectorized and instance-level
- **Road edge/curb detection**: Boundary between road and non-road surfaces
- **Traffic element detection**: Signs, signals, and their lane associations
- **Centerline extraction**: For routing and topology reasoning

### 2.4 Topological Mapping

Understanding not just where map elements are but how they connect is critical for navigation:

**T2SG (Traffic Topology Scene Graph)** (CVPR 2025) defines a unified scene graph that explicitly models:
- Lanes controlled and guided by different road signals (e.g., right turn)
- Topology relationships among lanes
- **TopoFormer**: A one-stage transformer with Lane Aggregation Layer (leveraging geometric distance among centerlines) and Counterfactual Intervention Layer (modeling reasonable road structures like intersections)
- Achieves 46.3 OLS on OpenLane-V2 benchmark

**Layered Topology Mapping**: Uses intersections as reference landmark nodes, with each node organized across metric, semantic, and topology layers, providing a hierarchical representation suitable for long-range navigation.

### 2.5 Airport Surface Applicability

Online mapping approaches are directly relevant to airport surfaces, though adaptation is needed:

| Road Domain | Airport Equivalent | Challenge Level |
|-------------|-------------------|----------------|
| Lane markings (white/yellow lines) | Taxiway centerlines (yellow), runway markings (white) | Moderate -- color-coded but different grammar |
| Road boundaries / curbs | Taxiway edge markings, safety lines | High -- less distinct physical boundaries |
| Pedestrian crossings | Vehicle crossing points, personnel corridors | High -- not standardized like zebra crossings |
| Traffic signals | Taxiway guidance signs, stop bars | High -- aviation-specific signage system |
| Drivable area | Movement area vs. non-movement area | Critical -- misclassification = runway incursion |
| Intersection topology | Taxiway junction topology | Critical -- wrong turn = safety incident |

The key technical gap: existing models are trained exclusively on road driving datasets (nuScenes, Argoverse). Airport surface environments have different marking conventions, wider operational areas, and unique obstacles (aircraft, jet bridges, GSE equipment). Transfer learning and domain-specific datasets would be required.

---

## 3. Localization Approaches

### 3.1 Visual Localization

Visual localization determines vehicle pose from camera images, either relative to a previously built map or through visual odometry:

**Visual Odometry (VO)** estimates ego-motion from frame-to-frame visual changes:
- Feature-based methods (ORB-SLAM3) extract and track sparse keypoints
- Direct methods (DSO, LDSO) minimize photometric error across entire image regions
- Hybrid approaches combine both for robustness

**Map-based visual localization** matches current observations against a pre-built visual map:
- Feature matching against 3D point cloud maps (e.g., HLoc pipeline)
- Scene coordinate regression (learning to predict 3D coordinates directly)
- Image retrieval followed by local feature matching

**Advantages for airport environments**: Cameras are low-cost, provide rich semantic information, and work in GPS-degraded areas. **Limitations**: Sensitive to lighting changes, weather conditions, and dynamic scene content.

### 3.2 LiDAR-Based Localization and SLAM

LiDAR provides precise geometric measurements that are invariant to lighting conditions:

**LiDAR Odometry approaches**:
- **ICP-based**: Point-to-Point and Point-to-Plane Iterative Closest Point algorithms
- **Feature-based**: LOAM (LiDAR Odometry and Mapping) and its variants extract edge and planar features
- **Learning-based**: GenZ-ICP (2024) uses adaptive weighting for generalizable and degeneracy-robust odometry

**GPS-Denied LiDAR SLAM** (comprehensive 2025 survey):

Key challenges identified:
- **Degeneracy**: In geometrically feature-less environments (long corridors, open fields, wide aprons), scan matching lacks sufficient constraints. Solid-state LiDARs are particularly susceptible due to limited FOV and fewer feature points per scan
- **Drift**: Accumulated odometry error over long trajectories. Sliding window optimization (as in Fast-LIO) reduces cumulative errors
- **Dynamic environments**: Moving objects interfere with mapping accuracy. Dynamic object filtering and segmentation are active research areas

**Recent advances (2024-2025)**:
- **DALI-SLAM**: Degeneracy-aware LiDAR-inertial SLAM with novel distortion correction
- **GenZ-ICP**: Adaptive weighting scheme that is robust to degeneracy
- **Anti-degeneracy schemes** using ResNet and transformer-based particle filter classification
- **SLAM2REF**: Long-term mapping with 3D LiDAR and reference map integration for precise 6-DoF estimation

### 3.3 Multi-Sensor Fusion for Robust Localization

No single sensor is sufficient for all conditions. Multi-sensor fusion combines complementary strengths:

**Typical fusion stack**:
```
GNSS/RTK  ----\
IMU       -----\
LiDAR     -------> State Estimation (EKF/Factor Graph) -> Pose Estimate
Camera    ------/
Wheel Odom ---/
```

**Fusion strategies**:
- **Loosely coupled**: Each sensor produces independent estimates that are fused at the state level
- **Tightly coupled**: Raw sensor measurements are jointly optimized (higher accuracy, greater complexity)
- **Adaptive fusion**: Sensor trust weights are dynamically adjusted based on real-time quality evaluation

A 2024 study demonstrated **tightly coupled integration of vector HD map, LiDAR, GNSS, and INS** for precise vehicle navigation in GNSS-challenging environments, showing that map-aided localization can maintain centimeter accuracy even when GNSS degrades.

### 3.4 Localization in GPS-Degraded Environments

This challenge is directly relevant to airport airside operations, where GPS signals are degraded by:
- **Multipath reflections** from terminal buildings, hangars, and aircraft fuselages
- **Signal blockage** under aircraft wings and near tall structures
- **Electromagnetic interference** from radar and communication equipment

**GNSS multipath effects** in urban canyons (and analogously, airport aprons) cause position errors of several meters. Traditional RTK accuracy of 1-2 cm degrades to meter-level estimates.

**Mitigation approaches**:

1. **LiDAR-map matching**: Pre-built 3D point cloud maps of the airport surface enable centimeter-level localization without GNSS. The vehicle matches its current LiDAR scan against the stored map using ICP or NDT algorithms
2. **Visual-inertial odometry (VIO)**: Combines camera and IMU for drift-limited dead reckoning between GPS fixes
3. **VLOAM (Visual LiDAR Odometry and Mapping)**: Fuses visual and LiDAR data for robust navigation in degraded conditions
4. **LiDAR-OSM matching**: Using OpenStreetMap or equivalent databases to constrain particle filter localization when GPS is denied
5. **Infrastructure-aided positioning**: UWB beacons, magnetic markers, or reflective targets placed at known positions on the airport surface

### 3.5 Centimeter-Level Positioning Requirements

Autonomous airport operations demand centimeter-level accuracy for:
- Precise stand positioning (aircraft door alignment with jet bridge)
- Baggage cart navigation between conveyor and aircraft
- Pushback operations near aircraft and other GSE
- Taxiway centerline following

**RTK-GNSS** provides the baseline centimeter accuracy when signals are available:
- Carrier-phase based differential GNSS technique
- Requires base station network transmitting real-time corrections
- **PPP-RTK**: Hybrid approach leveraging both RTK and Precise Point Positioning

**When RTK fails** (multipath, blockage), multi-sensor fusion maintains accuracy:
- **Adaptive multi-sensor frameworks**: Dynamically fuse LiDAR, IMU, and RTK-GNSS data based on real-time sensor quality evaluation
- **Vision-RTK systems**: Feed all available sensor data into fusion engines, combining GNSS with relative positioning
- **Map-aided localization**: Pre-built HD maps of the airport surface provide geometric constraints that bound drift

**AeroVect case study**: AeroVect's autonomous GSE system integrates Point One Navigation's RTK corrections from a network of thousands of ground-based reference stations. Their AeroVect Explorer mapping vehicle can create a digital twin of a major airport in less than 2 hours, providing the reference map for subsequent autonomous operations. Centimeter-level accuracy enables safe operation in confined apron spaces.

---

## 4. Spatial Memory and Place Recognition

### 4.1 Visual Place Recognition for Driving

Visual Place Recognition (VPR) answers the question "where am I?" by matching current observations against a database of previously visited locations. This is critical for loop closure in SLAM and for re-localization after GPS outages.

**Key methods and evolution**:

- **NetVLAD** (2016): Aggregates CNN features with a differentiable VLAD layer. Established the deep learning baseline for VPR
- **MixVPR** (WACV 2023): Feature mixing for VPR, achieving 58.4% recall@1 on the challenging Nordland benchmark -- a 69% improvement over CosPlace and 79% over NetVLAD
- **DINO-Mix** (2024): Combines DINOv2 foundation model features with feature mixing, succeeding where other methods fail under viewpoint changes, illumination changes, and seasonal variations
- **MS-MixVPR** (2024): Multi-scale feature extraction from different CNN layers, creating compact holistic representations robust to environmental changes

**LiDAR-based place recognition** (2024 survey) has become equally important:
- 3D point cloud descriptors (PointNetVLAD, MinkLoc3D)
- Scan context representations for efficient retrieval
- Advantages: invariant to illumination, robust in adverse weather
- Provides long measurement distance and rich 3D information

### 4.2 Long-Term Mapping and Change Detection

Real-world environments change over time. Autonomous systems must:
1. **Detect changes** between current observations and stored maps
2. **Update maps** to reflect new reality
3. **Maintain historical versions** for temporal reasoning

**SLAM2REF** (2024) addresses long-term mapping by integrating 3D LiDAR SLAM with reference map data for precise 6-DoF trajectory estimation and map extension, explicitly handling the challenge of environments that evolve over construction seasons.

**Crowd-sourced map updates** (the Lite Map paradigm) address this at fleet scale: each vehicle uploads vectorized observations, and the aggregation system detects changes by comparing new observations against the existing map. Tesla's auto-labeling and Mobileye REM are production implementations of this approach.

### 4.3 Seasonal and Lighting Variation Handling

The **4Seasons benchmark** (IJCV 2024) provides the definitive evaluation for localization under appearance variation:
- **300+ km** of recordings across 9 environments (parking garages, urban tunnels, countryside, highway)
- **>1 year** of data collection capturing snow, rain, sun, and night conditions
- Jointly evaluates visual odometry, global place recognition, and map-based localization
- Centimeter-level ground truth from fused stereo-inertial odometry with RTK GNSS

**Key findings**: Methods that combine geometric and appearance features (multi-scale, multi-modal) significantly outperform those relying on appearance alone. Foundation model features (DINOv2) show remarkable robustness to appearance changes due to pre-training on diverse visual data.

**Airport relevance**: Airport surfaces experience significant appearance variation -- day/night operations, rain pooling on aprons, snow/ice coverage, jet blast heat shimmer, reflective surfaces from wet pavement. Systems must maintain localization across all these conditions.

### 4.4 AirLoc and Aviation-Specific Localization

**AiRLoc** (ICLR 2023 Workshop) applies reinforcement learning to aerial view localization, specifically targeting search-and-rescue scenarios. While not directly designed for airport surface operations, it demonstrates:
- Aerial patch-based goal specification for localization
- RL-based active search strategy for visual matching
- Follow-up work **GOMAA-Geo** generalizes to ground-level imagery and natural language goal specifications

**Other aerial localization methods**:
- **CrossLoc** (CVPR 2022): Scalable aerial localization assisted by multimodal synthetic data
- **LoD-Loc v2** (ICCV 2025): Aerial visual localization over low level-of-detail city models using explicit silhouette alignment
- **FoundLoc**: Vision-based onboard aerial localization using foundation models (AnyLoc)
- **UAV-VisLoc**: Large-scale dataset for UAV visual localization

**Gap analysis**: No published research specifically targets airport surface vehicle localization as a distinct domain. The closest work comes from autonomous GSE companies (AeroVect, reference airside AV stack) who develop proprietary solutions combining RTK-GNSS, LiDAR, and cameras, but publish limited technical details.

---

## 5. Airport-Specific Mapping Challenges

### 5.1 Frequently Changing Airport Layouts

Airports are among the most dynamic operational environments:
- **Construction projects**: Terminal expansions, runway extensions, taxiway reconfigurations occur continuously at major airports
- **Seasonal changes**: Deicing pad activation/deactivation, seasonal stand configurations
- **Temporary configurations**: Special event layouts, temporary barriers, construction zones
- **Time-of-day changes**: Gate assignments, remote stand usage varies with schedule

**Impact on autonomous systems**: Any autonomous vehicle operating airside must handle map staleness as a first-class concern. A baggage tractor that learned the layout last week may encounter a newly closed taxiway segment today.

**Map-free approaches are especially valuable here**: The argument for online map construction and world-model-based spatial understanding is stronger in airports than on public roads, because:
1. Airport layouts change more frequently than road networks
2. The operational area is geographically bounded (enabling manageable prior mapping)
3. Lite/implicit map approaches can be updated through fleet observations during normal operations

### 5.2 Construction Zones and Temporary Closures

**Dynamic geofencing** is the primary mechanism for managing temporary restrictions:
- **Keep-in geofences**: Define the allowed operational area for autonomous vehicles
- **Keep-out geofences**: Exclude construction zones, closed taxiways, and restricted areas
- Virtual boundaries triggered by GNSS, RFID, or cellular data
- Must be updated in real-time as conditions change

**FAA guidance** (Emerging Entrants Bulletin 25-02, CertAlert 24-02):
- AGVS may operate in movement areas that are **closed to aircraft operations**
- Airport sponsors must ensure risks are "understood, properly considered, and mitigated"
- Remote areas and landside locations are preferred for initial testing
- Coordination required with regional FAA Airport Certification and Safety Inspectors

**Dynamic map architectures** combine static base maps with real-time overlay layers:
```
Static Base Map (AMXM/AIXM geometry)
    + Real-time NOTAM layer (closures, restrictions)
    + Live sensor layer (detected obstacles, vehicles)
    + Operational layer (active stand assignments, pushback clearances)
    = Current operational map
```

### 5.3 NOTAM Integration for Mapping Dynamic Restrictions

**NOTAMs (Notices to Air Missions)** are the aviation standard for communicating temporary changes to airport operations. Digital NOTAM integration is directly relevant to autonomous airside vehicles:

**What NOTAMs cover for surface operations**:
- Runway closures and threshold displacements
- Taxiway closures (full or partial)
- Runway declared distance changes
- Construction zone boundaries
- Temporary obstacle notifications
- Equipment outages (lighting, navigation aids)

**Integration approaches**:
- **Notamify MCP**: Real-time NOTAM intelligence with AI agents, enabling automated assessment of runway availability, taxiway closures, and approach availability
- **Digital NOTAM services**: Graphical presentation of airspace availability on "current airspace activity maps"
- **EFB integration**: Electronic Flight Bag applications depict NOTAM information graphically within 15-20 seconds of publication

**For autonomous vehicles**: NOTAMs must be parsed into machine-readable geofence updates. A closed taxiway becomes a keep-out zone; a displaced threshold changes the available movement area. The **Digital NOTAM** format (based on AIXM) enables direct machine processing, but integration with vehicle-level mapping remains an engineering challenge requiring:
1. NOTAM parsing into geometric constraints
2. Constraint projection onto the vehicle's local map representation
3. Path replanning to respect new restrictions
4. Confirmation/verification that the physical environment matches the NOTAM (e.g., physical barricades present at closed taxiway)

### 5.4 Airport Surface Markings and Signage Recognition

Airport surface markings follow strict ICAO/FAA standards that differ significantly from road markings:

**Color coding**:
- **White**: Runway markings (centerline, threshold, touchdown zone, aiming point)
- **Yellow**: Taxiway markings (centerline, edge, holding position)
- **Red**: Runway guard lights, stop bars
- **Black background with yellow inscription**: Surface painted location signs

**Signage system**:
- **Mandatory instruction signs**: Red background, white text (runway hold position, ILS critical area)
- **Location signs**: Yellow text, black background (taxiway designators)
- **Direction signs**: Yellow background, black text (routing guidance)
- **Information signs**: Yellow background, black text (supplementary info)

**Computer vision for airport markings** (2025 research):
- **AssistNet**: CNN classifier distinguishing runways from taxiways with 99.5% validation accuracy
- **ALINA (Automated Line Identification and Notation Algorithm)**: Trapezoidal ROI establishment, color space transformation, CIRCLEDAT algorithm for pixel identification
- **Synth_Airport_Taxii**: Synthetic dataset generation for airport taxiway navigation training

**Key challenges**:
- Shadows, tire marks, and varying surface conditions degrade detection
- Taxiways and runways share road-like appearances, differing mainly in marking color
- Dynamic ROI adjustment needed as vehicle perspective changes
- Environmental variations (lighting, weather, surface contamination)
- Labeled training data is scarce, motivating synthetic data approaches

### 5.5 Integration with AIXM and AMXM

**AIXM (Aeronautical Information Exchange Model)**:
- Developed jointly by FAA, NGA, and EUROCONTROL
- Provides a logical data model (UML class diagrams) and XML schema
- Encodes aeronautical information for AIS (Aeronautical Information Services)
- Based on Geography Markup Language (GML)
- Current version: AIXM 5.2
- Covers: airspace, procedures, obstacles, airport mapping data
- Enables coding of dynamic aeronautical data including closures and restrictions

**AMXM (Aerodrome Mapping Exchange Model)**:
- EUROCAE WG-44 / RTCA SC-217 specification for Aerodrome Mapping Databases (AMDB)
- Provides detailed geometric information for airport surfaces:
  - Runway geometry and markings
  - Taxiway centerlines and edges
  - Apron boundaries
  - Stand/gate positions
  - Building footprints
  - Obstacle locations
- Based on ISO 19100/OGC standards with GML 3.2 schema
- Compliant with ICAO Annex 14/15 SARPs
- Can be used with OGC Web Feature Service (WFS) for SWIM information services
- Bidirectional data exchange with AIXM 5.1

**ARINC 816** extends AMXM with additional elements including anchor points for map label placement and tessellated polygons.

**For autonomous vehicles**: AIXM/AMXM provides the authoritative geometric base map for airport surface operations. This serves as the "HD map equivalent" for airports -- but unlike road HD maps, AIXM/AMXM is:
- Maintained by airport authorities as a regulatory requirement
- Updated through formal change management processes
- Available in standardized, machine-readable formats
- Already includes detailed geometry for taxiways, aprons, and stands

The integration opportunity: use AIXM/AMXM as the static base map (analogous to SD/lite maps in road driving), augmented by online perception for dynamic elements and fine-grained local features not captured in the database.

### 5.6 Indoor-Outdoor Transitions

Airport operations span multiple environments with different characteristics:

| Environment | GPS | LiDAR | Vision | Challenges |
|-------------|-----|-------|--------|------------|
| Open apron | Good (with multipath) | Excellent | Good | Aircraft occlusion, jet blast |
| Under aircraft | Blocked | Partially occluded | Limited | Confined space, dynamic |
| Near terminal | Degraded (multipath) | Good | Variable (shadows) | Pedestrians, GSE congestion |
| Inside baggage hall | None | Good | Controlled lighting | Indoor SLAM required |
| Tunnel/underpass | None | Limited range | Low light | Degeneracy risk |

**Transition handling** requires:
- Seamless switching between GPS-aided and GPS-denied localization modes
- Map continuity across indoor/outdoor boundaries
- Consistent coordinate frame maintenance
- Degradation detection and fallback strategies

---

## 6. Synthesis: Implications for Airport Airside Autonomy

### 6.1 Recommended Technical Architecture

Based on this analysis, the optimal mapping and localization architecture for airport airside autonomous vehicles combines elements from multiple approaches:

```
Layer 1: STATIC BASE MAP
    Source: AIXM/AMXM airport mapping database
    Content: Taxiway geometry, stand positions, building footprints
    Update cycle: Formal change management (weeks/months)

Layer 2: OPERATIONAL MAP
    Source: NOTAM integration + ATC clearances
    Content: Closed areas, active runway assignments, temporary restrictions
    Update cycle: Real-time (seconds/minutes)

Layer 3: ONLINE PERCEPTION MAP
    Source: Vehicle sensors (cameras, LiDAR)
    Content: Detected markings, obstacles, other vehicles, aircraft positions
    Architecture: MapTR-style online vectorized construction
    Update cycle: Frame-by-frame (10-30 Hz)

Layer 4: NEURAL MAP PRIOR
    Source: Fleet-aggregated observations
    Content: Learned spatial priors for adverse conditions
    Architecture: NMP-style global neural tiles
    Update cycle: Continuous fleet learning (hours/days)

LOCALIZATION STACK:
    Primary: RTK-GNSS (centimeter accuracy in open areas)
    Secondary: LiDAR-map matching against Layer 1 geometry
    Tertiary: Visual-inertial odometry for GPS gaps
    Fusion: Adaptive EKF/factor graph with quality-based weighting
```

### 6.2 Key Research Gaps for Airport Application

1. **Airport surface training data**: No public dataset exists for airport surface online mapping (equivalent to nuScenes/Argoverse for roads). Synthetic data generation (as in Synth_Airport_Taxii) is a promising but insufficient substitute.

2. **Aviation marking recognition models**: Current road-trained models do not understand taxiway centerlines, holding position markings, or ILS critical area boundaries. Domain-specific fine-tuning or training is required.

3. **AIXM/AMXM to perception pipeline**: No published work bridges standardized aviation mapping formats with modern online map construction frameworks. Building this bridge would provide airports a significant advantage over road environments.

4. **Multi-vehicle coordination mapping**: Airport operations involve coordinated movement of multiple autonomous vehicles (baggage tractors, pushback tugs, cargo loaders). Shared/cooperative mapping and localization across a fleet is essential but underexplored.

5. **Regulatory framework**: The FAA acknowledges AGVS testing but has not issued comprehensive technical standards for navigation and positioning systems. ICAO-level standardization is preferred but not yet developed.

### 6.3 Why World Models Matter for Airports

The world model paradigm is particularly compelling for airport airside operations:

- **Bounded operational domain**: Unlike road driving with infinite geographic scope, airports are finite, surveyable spaces. A world model can be comprehensively trained on a specific airport.
- **Repetitive operations**: Airport GSE performs the same routes repeatedly (baggage hall to stand, cargo area to aircraft). This repetition is ideal for world model learning.
- **High change frequency**: The argument against HD maps is strongest in environments that change frequently. Airports change more frequently than roads.
- **Safety-critical with fallback options**: Airport operations can be paused (vehicles stopped) in ways that highway driving cannot, providing a safer context for world model deployment with human oversight.
- **Rich prior structure**: AIXM/AMXM provides geometric priors that can bootstrap world model training, combining the structure of explicit maps with the adaptability of neural representations.

---

## Sources

### Map-Free / Map-Lite Autonomous Driving
- [MapTR/MapTRv2 GitHub Repository](https://github.com/hustvl/MapTR)
- [MapTRv2: An End-to-End Framework for Online Vectorized HD Map Construction (IJCV 2024)](https://link.springer.com/article/10.1007/s11263-024-02235-z)
- [MapTRv2 ArXiv Paper](https://arxiv.org/abs/2308.05736)
- [HDMapNet Project Page](https://tsinghua-mars-lab.github.io/HDMapNet/)
- [HDMapNet ArXiv Paper](https://arxiv.org/abs/2107.06307)
- [VectorMapNet Project Page](https://tsinghua-mars-lab.github.io/vectormapnet/)
- [VectorMapNet ICML Paper](https://proceedings.mlr.press/v202/liu23ax/liu23ax.pdf)
- [Neural Map Prior Project Page](https://tsinghua-mars-lab.github.io/neural_map_prior/)
- [Neural Map Prior CVPR 2023 Paper](https://openaccess.thecvf.com/content/CVPR2023/papers/Xiong_Neural_Map_Prior_for_Autonomous_Driving_CVPR_2023_paper.pdf)
- [StreamMapNet WACV 2024](https://arxiv.org/abs/2308.12570)
- [MapExpert AAAI 2025](https://arxiv.org/abs/2412.12704)
- [Maps for Autonomous Driving: Full-process Survey and Frontiers](https://arxiv.org/html/2509.12632v1)
- [Online HD Map Construction Survey](https://www.mdpi.com/2224-2708/14/1/15)
- [Awesome HD Map Construction Repository](https://github.com/Honminden/awesome-hd-map-construction)
- [MapVision: CVPR 2024 Mapless Driving Challenge](https://arxiv.org/abs/2406.10125)

### World Models
- [A Survey of World Models for Autonomous Driving](https://arxiv.org/html/2501.11260v4)
- [OccWorld: Learning a 3D Occupancy World Model (ECCV 2024)](https://github.com/wzzheng/OccWorld)
- [GAIA-1 Technical Report](https://arxiv.org/abs/2309.17080)
- [GAIA-2 Technical Report](https://wayve.ai/wp-content/uploads/2025/03/GAIA_2_Technical_Report.pdf)
- [GAIA-3 Announcement](https://wayve.ai/press/wayve-launches-gaia3/)
- [Awesome World Model Repository](https://github.com/LMD0311/Awesome-World-Model)

### Localization and SLAM
- [GPS-Denied LiDAR-Based SLAM Survey (2025)](https://ietresearch.onlinelibrary.wiley.com/doi/full/10.1049/csy2.70031)
- [LiDAR-Based Place Recognition Survey](https://dl.acm.org/doi/10.1145/3707446)
- [Vision-based Localization in GPS-Denied Environments](https://arxiv.org/pdf/2211.11988)
- [RTK and Sensor Fusion for Autonomous Vehicle Navigation](https://www.techbriefs.com/component/content/article/51724-rtk-and-sensor-fusion-for-autonomous-vehicle-navigation-guidance)
- [Tightly Coupled HD Map-LiDAR-GNSS-INS Integration](https://www.tandfonline.com/doi/full/10.1080/10095020.2024.2377800)
- [4Seasons Benchmark (IJCV 2024)](https://link.springer.com/article/10.1007/s11263-024-02230-4)
- [Odyssey: Automotive LiDAR-Inertial Odometry Dataset for GNSS-denied](https://arxiv.org/html/2512.14428)

### Place Recognition
- [MixVPR: Feature Mixing for Visual Place Recognition](https://arxiv.org/abs/2303.02190)
- [DINO-Mix: Enhancing VPR with Foundation Models](https://www.nature.com/articles/s41598-024-73853-3)
- [MS-MixVPR: Multi-scale Feature Mixing](https://link.springer.com/article/10.1007/s42979-024-03011-z)
- [3D Point Cloud-based Place Recognition Survey](https://link.springer.com/article/10.1007/s10462-024-10713-6)

### Topological Mapping
- [T2SG: Traffic Topology Scene Graph (CVPR 2025)](https://arxiv.org/abs/2411.18894)
- [Topology-Aware Perception Survey](https://arxiv.org/pdf/2509.23641)

### Airport-Specific
- [FAA: Autonomous Ground Vehicle Systems on Airports](https://www.faa.gov/airports/new_entrants/agvs_on_airports)
- [Autonomous GSE and the Future of Airside Operations](https://airsideint.com/issue-article/autonomous-gse-and-the-future-of-airside-operations/)
- [AeroVect Autonomous GSE with Point One RTK](https://pointonenav.com/news/aerovects-autonomous-gse-case-study/)
- [Runway vs. Taxiway: Challenges in Automated Line Identification](https://arxiv.org/html/2501.18494v1)
- [Synth_Airport_Taxii Synthetic Dataset](https://github.com/Robcib-GIT/Synth_Airport_Taxii)
- [Airport Markings Recognition for Automatic Taxiing](https://www.researchgate.net/publication/261334923_Airport_markings_recognition_for_automatic_taxiing)
- [AIXM (EUROCONTROL)](https://www.eurocontrol.int/model/aeronautical-information-exchange-model)
- [AMXM FAQ](https://amxm.aero/faq-page)
- [AIXM Official Site](https://aixm.aero/)
- [FAA AIXM](https://www.faa.gov/about/office_org/headquarters_offices/ato/service_units/mission_support/aixm)
- [Digital NOTAM Use Cases](https://swim-eurocontrol.atlassian.net/wiki/spaces/ASW/pages/60031290/Digital+NOTAM+Use+Cases)
- [Notamify MCP Real-Time NOTAM Intelligence](https://notamify.com/notamify-mcp)
- [Smart Airport 2026 Technologies](https://www.wheere.com/en/articles/smart-airport-2026-5-technologies-qui-faconnent-laeroport-intelligent/)
- [Dynamic Maps for Automated Driving and UAV Geofencing](https://arxiv.org/pdf/2201.07186)
- [Computer Vision in Aviation](https://viso.ai/applications/computer-vision-in-aviation/)

### Industry and Market
- [HD Maps for Autonomous Driving Market Report 2025-2032](https://finance.yahoo.com/news/hd-maps-autonomous-driving-research-090600034.html)
- [DeepRoute Map-Free Self-Driving Tech](https://www.iotworldtoday.com/transportation-logistics/deeproute-launches-new-map-free-self-driving-tech)
- [Benefits of Mapless Autonomous Driving (Imagry)](https://imagry.co/articles/mapless-autonomous-driving-technology-benefits/)
- [Hybrid Mapping for ADAS (Applied Intuition)](https://www.appliedintuition.com/blog/hybrid-mapping-strategies)
- [Tesla FSD: No HD Maps, Neural Nets and Data](https://www.moomoo.com/community/feed/tesla-explains-how-fsd-chooses-its-path-no-hd-maps-111164555132934)
- [Aviation 2026: Ground Handling Trends](https://www.airport-suppliers.com/supplier-press-release/aviation-2026-7-ground-handling-trends-that-will-redefine-airport-operations/)
