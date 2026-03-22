# World-Model-Powered Airside Autonomous Vehicle Stack

## Design Specification

**Date:** 2026-03-21
**Type:** Research Design — Next-Generation AV Stack for Airport Airside Operations
**Context:** Greenfield parallel track alongside existing Aurrigo ROS Noetic stack (Simplex architecture)
**Approach:** Dual-Track Foundation (Data Engine + World Model Stack)

---

## 1. Problem Statement

The current Aurrigo ADS stack is a production-tested, modular ROS Noetic pipeline optimized for waypoint-following on airport airside. It works — but it has fundamental limitations that world models and foundation AI can address:

| Current Limitation | Root Cause | Impact |
|---|---|---|
| Can only detect 3 object types (deck, ULD, trailer) | Hand-crafted RANSAC perception, no learned models | Cannot detect aircraft, personnel, FOD, other GSE |
| No prediction of other agents' behavior | Frenet planner treats obstacles as static | Reactive-only — cannot anticipate pushback, pedestrian intent |
| Requires per-airport waypoint authoring + PCD maps | No generalization capability | Weeks of setup per new airport deployment |
| Kinematic-only simulation (no 3D scene, no sensors) | Python bicycle model, no rendering | Cannot test perception, cannot generate diverse scenarios |
| No explainability for decisions | Rule-based FSM with no reasoning trace | Hard to build safety cases, impossible to debug edge cases |
| LiDAR-only perception | No camera integration | Misses color, texture, signage, markings — critical airside info |
| No adverse condition handling | No rain/fog/de-icing compensation beyond SOR filter | Degraded or unsafe operation in real airport weather |

**The thesis:** A world model that learns the dynamics of the airside environment — how aircraft move, how ground crews behave, how turnarounds sequence — combined with foundation model perception and VLA reasoning, can address all of these simultaneously.

---

## 2. System Architecture

### 2.1 Simplex Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        VEHICLE HARDWARE LAYER                          │
│  Sensors: LiDAR (4-8x RoboSense) + IMU + RTK-GPS + Wheel Encoders     │
│  Future:  + Surround Cameras (6-8x) + 4D Radar (2-4x) + ADS-B + UWB   │
│  Actuators: Hydraulic/Electric steering + braking via CAN              │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ Raw sensor data
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     SENSOR ABSTRACTION LAYER                           │
│  Unified multi-modal representation regardless of sensor configuration │
│  Handles: timestamping, calibration, ego-motion compensation           │
│  Output: Synchronized, ego-compensated sensor bundle @ 10-20Hz         │
└──────────┬────────────────────────────────────────────────┬─────────────┘
           │                                                │
           ▼                                                ▼
┌──────────────────────────┐                 ┌──────────────────────────┐
│   NEW STACK               │                 │   CURRENT STACK           │
│   (High-Performance)      │                 │   (Verified Fallback)     │
│                           │                 │                           │
│  ┌─────────────────────┐  │                 │  ┌─────────────────────┐  │
│  │ Perception Backbone  │  │                 │  │ LiDAR Perception    │  │
│  │ BEV Encoder          │  │                 │  │ (RANSAC pipeline)   │  │
│  │ Foundation Features  │  │                 │  └─────────┬───────────┘  │
│  └─────────┬───────────┘  │                 │            │              │
│            │               │                 │  ┌─────────▼───────────┐  │
│  ┌─────────▼───────────┐  │                 │  │ GTSAM Localization  │  │
│  │ World Model          │  │                 │  └─────────┬───────────┘  │
│  │ 4D Occupancy Pred.   │  │                 │            │              │
│  │ Motion Forecasting   │  │                 │  ┌─────────▼───────────┐  │
│  │ Scene Understanding  │  │                 │  │ Frenet Planner      │  │
│  └─────────┬───────────┘  │                 │  │ Behavior FSM        │  │
│            │               │                 │  └─────────┬───────────┘  │
│  ┌─────────▼───────────┐  │                 │            │              │
│  │ Planning / VLA       │  │                 │  ┌─────────▼───────────┐  │
│  │ Trajectory Gen.      │  │                 │  │ Vehicle Interface   │  │
│  │ Language Reasoning   │  │                 │  │ (CAN gateway)       │  │
│  └─────────┬───────────┘  │                 │  └─────────┬───────────┘  │
│            │               │                 │            │              │
└────────────┼───────────────┘                 └────────────┼──────────────┘
             │                                              │
             ▼                                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SAFETY MONITOR                                  │
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ OOD         │  │ RSS Safety  │  │ Confidence   │  │ Watchdog /   │  │
│  │ Detection   │  │ Envelope    │  │ Calibration  │  │ Heartbeat    │  │
│  │ (ensemble)  │  │ Check       │  │ Threshold    │  │ Monitor      │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘  │
│         └────────────────┼───────────────┬─┘                 │          │
│                          ▼               ▼                   │          │
│                   ┌──────────────┐                           │          │
│                   │ ARBITRATOR   │◄──────────────────────────┘          │
│                   │ Select: NEW  │                                      │
│                   │    or FALLBACK│                                      │
│                   └──────┬───────┘                                      │
└──────────────────────────┼──────────────────────────────────────────────┘
                           │
                           ▼
                    Vehicle Actuators
```

### 2.2 Design Principles

1. **Compute-agnostic:** Every component specifies its interface (input tensors, output tensors) not its runtime. Same model runs on Orin, Thor, or cloud via ONNX/TensorRT/Triton.
2. **Sensor-agnostic:** The BEV encoder accepts a configurable sensor manifest. Start with LiDAR-only, add cameras and radar without architecture changes.
3. **Graceful degradation:** If the new stack fails, hesitates, or detects OOD, the current stack takes over seamlessly. The vehicle never stops being safe.
4. **Data flywheel:** Every meter driven generates training data. The system improves from its own operation.
5. **Airport-aware:** Unlike road AV stacks, this system integrates with airport data sources (A-CDM, NOTAM, ADS-B, A-SMGCS) as first-class inputs.

---

## 3. Component Design

### 3.1 Sensor Abstraction Layer

**Purpose:** Decouple the world model stack from specific sensor hardware. Provide a unified, synchronized, ego-compensated sensor bundle.

**Design:**

```python
@dataclass
class SensorBundle:
    timestamp: float                          # Unified timestamp (ns)
    ego_pose: SE3                             # Ego vehicle pose in world frame
    ego_velocity: Twist                       # Linear + angular velocity

    # LiDAR (always present)
    pointcloud: PointCloud                    # Aggregated, ego-compensated, in vehicle frame
    pointcloud_metadata: LiDARMeta            # Sensor positions, beam config, intensity stats

    # Camera (optional, added incrementally)
    images: Optional[Dict[str, Image]]        # Named cameras: front, left, right, back, etc.
    camera_intrinsics: Optional[Dict[str, K]] # Per-camera calibration
    camera_extrinsics: Optional[Dict[str, SE3]]

    # Radar (optional, future)
    radar_points: Optional[RadarPointCloud]   # 4D radar: x, y, z, doppler velocity

    # Airport context (optional, from integration layer)
    airport_context: Optional[AirportContext] # ADS-B targets, NOTAM zones, flight schedule
```

**Key decisions:**
- **Ego-motion compensation at this layer** — the world model receives motion-corrected data, never raw. Uses IMU + wheel odometry for deskewing (same as your current `LidarProcessorNodelet`).
- **Variable-rate fusion** — LiDAR at 10Hz, cameras at 10-30Hz, radar at 13Hz, GPS at 2Hz. The bundle is produced at the LiDAR rate with the most recent data from each sensor interpolated to the LiDAR timestamp.
- **Graceful absence** — Every non-LiDAR field is `Optional`. The downstream BEV encoder handles missing modalities via masked attention or zero-padding.

### 3.2 Perception Backbone

**Purpose:** Transform raw sensor data into a unified Bird's-Eye-View (BEV) feature representation that the world model consumes.

**Architecture:**

```
SensorBundle
    │
    ├── LiDAR Branch
    │   ├── Voxelization (pillar-based, configurable resolution)
    │   ├── PointPillars / CenterPoint encoder
    │   │   OR VoxelNet backbone
    │   └── BEV features (C × H × W)
    │
    ├── Camera Branch (when available)
    │   ├── DINOv2 backbone (frozen or LoRA-tuned)
    │   ├── LSS (Lift-Splat-Shoot) view transform
    │   │   OR BEVFormer cross-attention
    │   └── BEV features (C × H × W)
    │
    ├── Radar Branch (when available)
    │   ├── Pillar encoding of radar points
    │   └── BEV features (C × H × W)
    │
    └── BEV Fusion
        ├── Concatenation + 1x1 Conv  (simple)
        │   OR Transformer cross-attention (rich)
        └── Fused BEV features (C_fused × H × W)
```

**Key decisions:**

- **BEV resolution:** 0.2m/pixel, 100m × 100m range = 500 × 500 grid. Sufficient for airside speeds (5-30 km/h). Configurable for larger ranges when tracking aircraft at distance.
- **DINOv2 backbone for cameras:** Pre-trained on ImageNet, provides rich semantic features without airside-specific training. DINO-based pre-training has shown ~9 percentage point route completion improvement over supervised baselines in CARLA simulation (62.18% vs. 53.20%). Frozen initially, LoRA fine-tuned on airside data later.
- **Open-vocabulary detection head:** Grounding DINO or YOLO-World attached to camera features for zero-shot detection of airside-specific objects. Text prompts: "baggage tractor", "belt loader", "aircraft nose gear", "ground crew in hi-vis", "FOD on tarmac". This gives you detection of 30+ GSE types and 100+ aircraft variants without any airside-specific training data.
- **LiDAR-only mode:** When cameras aren't available, the BEV encoder uses only the LiDAR branch. The world model still works — it just has geometric features without semantic richness.

### 3.3 World Model Core

This is the heart of the new stack. The world model predicts the future state of the entire scene — not individual objects, but the full 3D environment.

**Architecture: 4D Occupancy World Model**

```
                    History (t-T ... t)
                          │
    ┌─────────────────────▼──────────────────────┐
    │         ENCODER                              │
    │  BEV features → VQ-VAE tokenization          │
    │  Codebook: 512-1024 entries                  │
    │  Each BEV frame → sequence of discrete tokens│
    └─────────────────────┬──────────────────────┘
                          │ Token sequence
    ┌─────────────────────▼──────────────────────┐
    │         DYNAMICS MODEL                       │
    │  Autoregressive Transformer (GPT-style)      │
    │  OR Mamba SSM (O(n) vs O(n^2))              │
    │                                              │
    │  Inputs:                                     │
    │    - Past scene tokens (t-T ... t)           │
    │    - Ego action (candidate trajectory)       │
    │    - Airport context embedding (optional)    │
    │                                              │
    │  Outputs:                                    │
    │    - Future scene tokens (t+1 ... t+K)       │
    │    - Per-token confidence scores             │
    └─────────────────────┬──────────────────────┘
                          │ Future tokens
    ┌─────────────────────▼──────────────────────┐
    │         DECODER                              │
    │  Tokens → 3D Occupancy Grid                  │
    │  Resolution: 0.2m × 0.2m × 0.2m             │
    │  Height: -1m to 5m (30 voxels)               │
    │  Semantic channels (optional):               │
    │    - Occupied / Free / Unknown               │
    │    - Hazard (jet blast, FOD)                 │
    │    - Dynamic (moving) / Static               │
    └─────────────────────┬──────────────────────┘
                          │
                 4D Occupancy Prediction
              (3D space × K future timesteps)
```

**Why occupancy over object detection for airside:**

| Property | Object Detection | Occupancy Prediction |
|----------|-----------------|---------------------|
| Novel objects (new GSE type, unusual aircraft) | Fails — not in training classes | Works — just occupied voxels |
| Jet blast zone | Cannot represent | Hazard occupancy channel |
| FOD (small debris) | Needs tiny-object detector | Ground-level occupancy anomaly |
| Partial occlusion | Lost detections | Partial occupancy preserved |
| Aircraft (huge objects) | Bounding box is mostly empty | Accurate shape representation |
| Class-agnostic safety | Needs per-class behavior rules | "Don't drive into occupied space" — one rule |

**Model sizing (compute-agnostic tiers):**

| Tier | Parameters | Prediction Horizon | Latency (Orin) | Latency (Thor) |
|------|-----------|-------------------|----------------|----------------|
| Lite | 50M | 2s (10 steps @ 5Hz) | ~80ms | ~20ms |
| Base | 200M | 4s (20 steps) | ~200ms | ~50ms |
| Large | 500M+ | 8s (40 steps) | Cloud/edge only | ~150ms |

**Pre-training strategy:**
1. Pre-train on nuScenes + Waymo occupancy (300K+ labeled scenes exist)
2. Self-supervised pre-training on your airside LiDAR bags (predict masked future frames)
3. Fine-tune on labeled airside data (auto-labeled via foundation models)

### 3.4 Planning Layer

**Two operating modes, selected based on available compute and maturity:**

#### Mode 1: World-Model-Augmented Frenet Planner (Near-term)

Your existing Frenet planner generates 420 trajectory candidates per cycle. Currently it scores them against static obstacles. The world model upgrades this:

```
Frenet Trajectory Generator (existing, 420 candidates)
    │
    │ For each candidate trajectory:
    │
    ├── Feed trajectory as ego-action to World Model
    │   → Get predicted future occupancy for that action
    │   → Score: collision probability over prediction horizon
    │   → Score: proximity to hazard occupancy (jet blast, etc.)
    │   → Score: smoothness of predicted future state
    │
    ├── Existing scores (path smoothness, lateral deviation, etc.)
    │
    └── Weighted combination → Select best trajectory
```

This is a **drop-in upgrade** to your existing planner. The world model acts as a learned cost function for trajectory evaluation. Your Frenet generator, Stanley controller, and vehicle interface are unchanged.

#### Mode 2: Learned Planner / VLA (Medium-term)

Replace the Frenet generator entirely with a learned policy:

```
World Model (4D Occupancy + Scene Understanding)
    │
    ▼
┌────────────────────────────────────┐
│  VLA Planning Head                  │
│                                    │
│  Option A: Alpamayo-R1-10B (8.2B backbone + 2.3B action expert)        │
│    - Camera + LiDAR BEV input      │
│    - Chain-of-Causation reasoning  │
│    - Trajectory + explanation      │
│    - Text-guided planning          │
│                                    │
│  Option B: Diffusion Policy (~100M) │
│    - BEV + occupancy input         │
│    - Denoising trajectory gen      │
│    - Multi-modal futures           │
│    - Like DiffusionDrive (CVPR'25) │
│                                    │
│  Option C: MPC in Latent Space     │
│    - TD-MPC2 style                 │
│    - CEM optimization in world     │
│      model latent space            │
│    - Implicit value function       │
└──────────────┬─────────────────────┘
               │
               ▼
        Trajectory (x, y, yaw, velocity, timestamp)
               │
               ▼
        Stanley Controller (existing) → Vehicle
```

**Alpamayo integration path:** When cameras are added, Alpamayo becomes the natural planning head. Its Chain-of-Causation reasoning generates both the trajectory and a natural language explanation ("Slowing because ground crew is crossing ahead of aircraft nose. Jet blast zone boundary in 15m."). This is invaluable for:
- Safety case evidence (every decision is logged with reasoning)
- Operator trust (the vehicle explains itself)
- Regulatory compliance (EASA AI Roadmap requires explainability)
- Debugging (replay and read why the vehicle did what it did)

### 3.5 Airport Integration Layer

**Purpose:** Ingest airport-specific data sources that no road AV stack handles. This is a unique competitive advantage.

```
┌─────────────────────────────────────────────────┐
│              AIRPORT CONTEXT MANAGER              │
│                                                   │
│  ┌─────────────┐  ┌──────────────┐               │
│  │ ADS-B       │  │ A-CDM /      │               │
│  │ Receiver    │  │ AODB         │               │
│  │ (1090ES)    │  │ (REST API)   │               │
│  │             │  │              │               │
│  │ → Aircraft  │  │ → Flight     │               │
│  │   positions │  │   schedule   │               │
│  │   altitudes │  │ → TOBT/TSAT  │               │
│  │   callsigns │  │ → Gate       │               │
│  └──────┬──────┘  │   assignments│               │
│         │         └──────┬───────┘               │
│         │                │                        │
│  ┌──────▼────────────────▼───────┐               │
│  │     CONTEXT FUSER             │               │
│  │                               │               │
│  │  Produces AirportContext:     │               │
│  │  - Active aircraft positions  │               │
│  │  - Predicted pushback times   │               │
│  │  - Active NOTAM zones         │               │
│  │  - Jet blast hazard zones     │               │
│  │    (computed from aircraft    │               │
│  │     type + engine status)     │               │
│  │  - Turnaround phase per gate  │               │
│  │  - Dynamic restricted areas   │               │
│  └──────────────┬────────────────┘               │
│  ┌──────────────▼────────────────┐               │
│  │  NOTAM       │  │ AIXM/AMXM   │               │
│  │  Parser      │  │ Airport     │               │
│  │  → Dynamic   │  │ Model       │               │
│  │    geofences │  │ → Static    │               │
│  │    closures  │  │   geometry  │               │
│  │    restrictions│ │   taxiways │               │
│  └──────────────┘  │   markings  │               │
│                     └─────────────┘               │
└─────────────────────────────────────────────────┘
```

**How airport context feeds the world model:**

The `AirportContext` is encoded as a conditioning signal for the world model:
- **ADS-B aircraft positions** → injected as occupied regions in the BEV with velocity vectors. The world model learns to predict aircraft movement given these priors.
- **Flight schedule + turnaround phase** → embedded as a context token. The world model learns temporal priors: "Aircraft at gate B7 is in phase 3 (cargo loading), pushback expected in 12 minutes."
- **NOTAM zones** → rendered as additional BEV channels (restricted/closed). The planner treats these as hard constraints.
- **Jet blast prediction** → computed from aircraft type + engine configuration (lookup table). Rendered as hazard occupancy extending behind aircraft.

### 3.6 Data Engine

**Purpose:** Transform your scattered bag files into a structured, labeled, continuously growing airside driving dataset.

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA ENGINE                               │
│                                                                   │
│  STAGE 1: INGEST                                                  │
│  ┌─────────────┐                                                  │
│  │ Bag Scanner  │ Crawl storage, index all .bag files             │
│  │              │ Extract: duration, topics, sensor config,       │
│  │              │          GPS trace, vehicle ID, date             │
│  └──────┬──────┘                                                  │
│         │                                                         │
│  STAGE 2: EXTRACT                                                  │
│  ┌──────▼──────┐                                                  │
│  │ Scene        │ Split bags into scenes (30-60s segments)        │
│  │ Extractor    │ Extract: pointclouds, images (if any),          │
│  │              │          poses, CAN data, IMU, GPS              │
│  │              │ Align to common timeline                        │
│  │              │ Export to efficient format (e.g., zarr, lance)  │
│  └──────┬──────┘                                                  │
│         │                                                         │
│  STAGE 3: AUTO-LABEL                                               │
│  ┌──────▼──────┐                                                  │
│  │ Foundation   │ LiDAR: CenterPoint/PointPillars 3D detection    │
│  │ Model        │ Camera (if available): Grounding DINO + SAM     │
│  │ Labeler      │ Occupancy: self-supervised from LiDAR           │
│  │              │ Scenario tags: speed, proximity, weather,       │
│  │              │                turnaround phase, near-miss      │
│  └──────┬──────┘                                                  │
│         │                                                         │
│  STAGE 4: CURATE                                                   │
│  ┌──────▼──────┐                                                  │
│  │ Scenario     │ Balance dataset by scenario type                │
│  │ Miner        │ Prioritize rare/interesting events              │
│  │              │ Flag low-quality labels for human review        │
│  │              │ Applied Intuition-style CLIP retrieval:          │
│  │              │   "aircraft pushback with ground crew nearby"    │
│  └──────┬──────┘                                                  │
│         │                                                         │
│  STAGE 5: RECONSTRUCT                                              │
│  ┌──────▼──────┐                                                  │
│  │ 3DGS Digital │ Build 3D Gaussian Splatting reconstruction      │
│  │ Twin Builder │ of operating airports from accumulated data     │
│  │              │ Enable: novel view synthesis, counterfactual     │
│  │              │         scenario injection, sensor simulation   │
│  └──────┬──────┘                                                  │
│         │                                                         │
│  STAGE 6: GENERATE                                                 │
│  ┌──────▼──────┐                                                  │
│  │ Synthetic    │ Use Cosmos / world model to generate:           │
│  │ Data Gen     │ - Rare scenarios (near-collision, FOD, de-icing)│
│  │              │ - Weather variations (rain, fog, night)         │
│  │              │ - New airport layouts (from AIXM geometry)      │
│  │              │ - Adversarial scenarios (SafeDreamer-style)     │
│  └─────────────┘                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Data flywheel:** Once vehicles run the new stack in shadow mode, every drive generates:
- Sensor data (training input)
- Current stack decisions (baseline labels)
- New stack decisions (comparison)
- Safety monitor activations (edge case mining gold)
- World model prediction errors (active learning signal — collect more data where the model is wrong)

### 3.7 Simulation Stack

**Multi-fidelity, building on your existing kinematic sim:**

```
LEVEL 0: KINEMATIC SIM (existing aurrigo_python_sim)
├── Bicycle model, validated 4.1% error
├── Tests nav stack logic (waypoints, FSM, zone management)
├── Unchanged — keeps testing current stack
└── Add: world model prediction quality regression tests

LEVEL 1: SCENARIO SIM (new — world model in the loop)
├── World model generates future occupancy from past data
├── Replay real bag data, inject counterfactual actions
├── "What if I had turned left?" → world model predicts outcome
├── Closed-loop: planner proposes action → world model predicts
│   → planner re-plans → repeat for full scenario
└── Key metric: collision rate, goal completion, prediction error

LEVEL 2: NEURAL SIM (new — learned sensor simulation)
├── 3DGS digital twin of airport
├── Render synthetic LiDAR + camera from any viewpoint
├── Insert dynamic agents (aircraft, GSE, pedestrians)
├── Vary: weather, lighting, time of day, surface conditions
├── Full closed-loop with rendered sensor data
└── Enables testing perception + world model + planning end-to-end

LEVEL 3: SHADOW MODE (on real vehicle)
├── New stack runs alongside current stack, no actuator access
├── Compare: new stack decisions vs. current stack actions
├── Log: world model predictions vs. reality (prediction error)
├── Mine: disagreements between stacks = edge cases
└── Graduate to: new stack drives, current stack monitors
```

### 3.8 Safety Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     SAFETY MONITOR                            │
│                                                               │
│  LAYER 1: INPUT VALIDATION                                    │
│  ├── Sensor health check (all LiDARs alive, IMU sane, etc.) │
│  ├── Ego-pose sanity (velocity within physical bounds)       │
│  └── Clock synchronization check                             │
│                                                               │
│  LAYER 2: WORLD MODEL CONFIDENCE                              │
│  ├── OOD Detection                                           │
│  │   ├── Ensemble disagreement (N world model copies)        │
│  │   ├── Reconstruction error (VQ-VAE decoder quality)       │
│  │   └── Input distribution monitoring (Mahalanobis distance)│
│  ├── Prediction Confidence                                   │
│  │   ├── Per-voxel occupancy entropy                         │
│  │   ├── Temporal consistency (prediction stability)         │
│  │   └── Calibration check (predicted vs. observed error)    │
│  └── Threshold: if confidence < tau → FALLBACK               │
│                                                               │
│  LAYER 3: TRAJECTORY SAFETY                                   │
│  ├── RSS (Responsibility-Sensitive Safety) envelope           │
│  │   ├── Safe longitudinal distance (response time + braking)│
│  │   ├── Safe lateral distance                               │
│  │   ├── Right-of-way rules (aircraft always have priority)  │
│  │   └── Proper response to restricted zones                 │
│  ├── Occupancy collision check                               │
│  │   └── Trajectory swept volume vs. predicted occupancy     │
│  └── Violation: if trajectory breaches RSS → FALLBACK         │
│                                                               │
│  LAYER 4: OPERATIONAL BOUNDS                                  │
│  ├── Geofence check (NOTAM zones, airport boundary)          │
│  ├── Speed limits (zone-based, from zone_manager)            │
│  ├── Teleoperation heartbeat (remote operator alive?)        │
│  └── System health (system_minder integration)               │
│                                                               │
│  ARBITRATION LOGIC:                                           │
│  ├── ALL layers pass → New Stack drives                      │
│  ├── ANY layer fails → Current Stack drives (graceful)       │
│  ├── Critical failure → Controlled stop + teleoperation      │
│  └── All decisions logged with full reasoning trace          │
└──────────────────────────────────────────────────────────────┘
```

**Graceful degradation hierarchy:**
1. **Full autonomy (new stack)** — everything nominal
2. **Fallback autonomy (current stack)** — new stack uncertain, current stack drives
3. **Reduced capability** — both stacks uncertain, slow to safe speed, increase safety margins
4. **Controlled stop** — safe position, engage parking brake
5. **Teleoperation** — remote operator takes control via Fernride-style interface

### 3.9 Latency Budget

At airside speeds (5-30 km/h = 1.4-8.3 m/s), a 200ms total pipeline latency means the vehicle travels 0.28-1.67m before reacting. For comparison, the current stack runs planning at 50Hz (20ms cycle).

**End-to-end latency budget (sensor-to-actuator):**

| Component | Budget | Notes |
|-----------|--------|-------|
| Sensor aggregation + ego-compensation | 10ms | Existing LidarProcessorNodelet does this in ~5ms |
| BEV encoding (LiDAR branch) | 20ms | PointPillars on Orin |
| BEV encoding (camera branch, when added) | 30ms | DINOv2 ViT-B + LSS |
| World model inference (Lite tier, 50M) | 50ms | 2s horizon, 10 steps |
| Planning (trajectory scoring or learned) | 20ms | 420 Frenet candidates or diffusion |
| Safety monitor (all layers) | 10ms | RSS check + OOD ensemble |
| Arbitration + command output | 5ms | Negligible |
| **Total** | **~145ms** | **Fits within 10Hz loop** |

**World model cadence resolution:** The world model runs at 5Hz (every other sensor bundle at 10Hz input rate). Between world model updates, the planner uses the most recent occupancy prediction with ego-motion extrapolation. This is analogous to how the current stack uses `/odom/fused` at 20Hz but `/odom/fused/high_rate` at 50Hz for interpolation.

**Target loop rates:**
- Perception + world model: 5-10Hz (new stack)
- Planning: 10-20Hz (reuses latest world model prediction)
- Safety monitor: 20-50Hz (lightweight checks, matches current stack rate)
- Control (Stanley + vehicle interface): 50Hz (unchanged)

### 3.10 Memory and VRAM Budget

| Component | VRAM/RAM | Notes |
|-----------|----------|-------|
| **BEV Encoder (LiDAR, PointPillars)** | ~500MB VRAM | Standard deployment size |
| **BEV Encoder (Camera, DINOv2-B + LSS)** | ~2GB VRAM | ViT-B frozen backbone |
| **World Model (OccWorld Lite, 50M)** | ~800MB VRAM | FP16 inference |
| **World Model (OccWorld Base, 200M)** | ~2GB VRAM | FP16 inference |
| **Safety Monitor (3x ensemble)** | ~1.5GB VRAM | 3 copies of lightweight heads |
| **VQ-VAE tokenizer/decoder** | ~400MB VRAM | Shared with world model |
| **Current stack (GTSAM + VGICP)** | ~4GB VRAM | Already allocated, GPU localization |
| **OS + ROS + buffers** | ~4GB RAM | System overhead |
| **Sensor data buffers** | ~2GB RAM | Point clouds + images in pipeline |

**Compute tier feasibility:**

| Platform | VRAM | Fits LiDAR-only (Phase 1) | Fits Multi-modal (Phase 2) | Fits VLA (Phase 3) |
|----------|------|--------------------------|---------------------------|-------------------|
| **Orin 32GB** | 32GB unified | Yes (~13GB total: 7GB GPU + 6GB system) | Yes (~17GB total) | No (10B model needs ~20GB+ GPU alone) |
| **Orin 64GB** | 64GB unified | Yes | Yes | Marginal (INT4 quantized) |
| **Thor** | 128GB+ | Yes | Yes | Yes |
| **Cloud/edge** | Unlimited | Yes | Yes | Yes |

### 3.11 Localization Strategy

The new stack **reuses the existing GTSAM localization** — it is already production-tested and provides high-quality ego-pose via GPU VGICP scan-matching.

**Rationale:** Localization is a solved problem in this stack. The GTSAM factor graph (VGICP + IMU + GPS + wheel odometry) outputs `/odom/fused` at 20Hz and `/odom/fused/high_rate` at 50Hz. Both stacks share this single localization source.

**Architecture:**
```
GTSAM Localization (existing, shared)
    │
    ├──→ /odom/fused @ 20Hz ──→ Current Stack (planning)
    │                         ──→ New Stack (BEV encoder ego-compensation)
    │
    └──→ /odom/fused/high_rate @ 50Hz ──→ Both stacks (control loop)
```

**Future enhancement path:**
- Phase 2+: The world model's implicit ego-motion prediction can serve as an additional factor in the GTSAM graph (learned odometry factor alongside VGICP)
- Phase 3+: Visual localization from cameras can add a visual factor to GTSAM (place recognition, visual odometry)
- The localization system is never replaced, only enriched with additional factors

### 3.12 Arbitration State Machine

```
                    ┌──────────────┐
     startup ──────→│  INITIALIZING │
                    │  (both stacks │
                    │   warming up) │
                    └──────┬───────┘
                           │ both stacks healthy
                           ▼
                    ┌──────────────┐
            ┌──────│  NEW_STACK    │◄────────────────┐
            │      │  DRIVING      │                  │
            │      └──────┬───────┘                  │
            │             │ any safety layer fails    │ all safety layers pass
            │             ▼                          │ for T_promote seconds
            │      ┌──────────────┐                  │ (hysteresis: 2s default)
            │      │  FALLBACK    │──────────────────┘
            │      │  DRIVING     │
            │      └──────┬───────┘
            │             │ fallback stack also uncertain
            │             ▼
            │      ┌──────────────┐
            │      │  REDUCED     │──→ (recovery) ──→ FALLBACK_DRIVING
            │      │  CAPABILITY  │
            │      │  (slow, wide │
            │      │   margins)   │
            │      └──────┬───────┘
            │             │ critical failure
            │             ▼
            │      ┌──────────────┐
            │      │  CONTROLLED  │──→ (operator connects) ──→ TELEOPERATION
            │      │  STOP        │
            │      └──────────────┘
            │
            │ critical failure (any state)
            └──────────────────────────→ CONTROLLED_STOP
```

**Key design decisions:**
- **Both stacks always run hot.** The current stack never cold-starts. It continuously processes sensor data and computes trajectories, even when the new stack is driving. Handoff latency is one control cycle (20ms).
- **Hysteresis on promotion:** The new stack must pass all safety checks for `T_promote` consecutive seconds (default: 2s) before being promoted back from FALLBACK to NEW_STACK_DRIVING. This prevents rapid oscillation.
- **Mid-trajectory rejection:** If the safety monitor rejects a new-stack trajectory mid-execution, the arbitrator immediately switches to the current stack's latest trajectory. The current stack's trajectory is always available because it runs continuously.
- **All transitions are logged** with full sensor snapshots, world model predictions, safety monitor scores, and the arbitration decision. This creates a rich dataset for debugging and improvement.

### 3.13 Data Volume Estimates

**Current state (estimated):**

| Data Source | Estimated Volume | Notes |
|-------------|-----------------|-------|
| Bag files (scattered) | 2-10 TB | Based on ~60GB visible in workspace, likely more on vehicle/server storage |
| PCD maps | ~500MB | 2 maps in workspace |
| Scenarios (YAML) | <1MB | Kinematic sim test scenarios |

**Target dataset sizes:**

| Phase | Target | Source | Storage |
|-------|--------|--------|---------|
| Phase 0 | 50-200 hours extracted scenes | Existing bags, organized and indexed | 1-5 TB (zarr/lance format) |
| Phase 1 | 500+ hours with auto-labels | Shadow mode collection + auto-labeling | 10-20 TB |
| Phase 2 | 2,000+ hours (real + synthetic) | Fleet collection + Cosmos/3DGS generation | 50-100 TB |
| Phase 3 | 5,000+ hours | Multi-airport fleet + scenario generation | 100-200 TB |

**Per-vehicle data rate:** ~1-2 TB/hour raw (4-8 LiDAR @ 10Hz + future cameras). Extracted scenes (downsampled, compressed) are ~50-100 GB/hour.

---

## 4. World Model Training Pipeline

### 4.1 Pre-training (Transfer from Road Driving)

```
Phase 1: Foundation (no airside data needed)
├── Download nuScenes + Waymo Open Dataset occupancy labels
├── Pre-train BEV encoder on road LiDAR data
├── Pre-train occupancy prediction transformer on road scenes
├── Pre-train VQ-VAE tokenizer on road BEV features
└── Result: World model that understands general driving dynamics

Phase 2: Domain Adaptation (your unorganized data)
├── Run data engine Stage 1-3 on your bag files
├── Self-supervised pre-training: mask future LiDAR frames, predict
├── No labels needed — the world model learns airside dynamics
│   from reconstruction loss alone
├── Fine-tune BEV encoder on airside LiDAR distribution
└── Result: World model adapted to airport geometry and dynamics

Phase 3: Supervised Fine-tuning (labeled airside data)
├── Auto-label with foundation models (Stage 3 of data engine)
├── Human review of auto-labels for quality-critical scenarios
├── Train occupancy prediction with ground truth occupancy
├── Train detection heads with labeled objects
└── Result: World model with airside-specific object understanding

Phase 4: RL Post-training (simulation)
├── SafeDreamer-style constrained RL in world model imagination
├── Reward: goal completion + smoothness
├── Constraint: zero collisions, RSS compliance, zone respect
├── Use adversarial scenario generation for robustness
└── Result: Planning policy optimized for airside safety
```

### 4.2 Continual Learning (Fleet Operation)

```
Shadow Mode Operation
├── New stack runs, current stack drives
├── Log: world model predictions, new stack decisions
├── Measure: prediction error (predicted occupancy vs. observed)
├── Mine: high-error scenes → priority training data
├── Weekly: retrain world model on accumulated data
├── Monthly: evaluate new model in simulation → promote or reject
└── Gradually: transfer control from current → new stack
    based on confidence metrics and safety record
```

---

## 5. Key Model Choices and Alternatives

### 5.1 World Model Architecture Decision

| Option | Architecture | Params | Pros | Cons | Recommendation |
|--------|-------------|--------|------|------|----------------|
| **OccWorld** | VQ-VAE + GPT transformer (ECCV 2024) | 50-200M | Proven on nuScenes, open-source, class-agnostic | Autoregressive = sequential, slower for long horizons | **Start here** |
| **Drive-OccWorld** | Action-conditioned occupancy | 100-300M | Action-conditioned (what the planner needs), 33% better than UniAD | AAAI 2025, less mature | **Upgrade to** |
| **Copilot4D** | VQ-VAE + discrete diffusion on LiDAR (ICLR 2024) | ~52M published (39M WM + 13M tokenizer) | Native LiDAR (perfect for you), Waabi-backed | Point cloud output (not occupancy), no open code | Evaluate |
| **OccSora** | Diffusion on 4D occupancy | 300-500M | Longest horizon (16s), highest fidelity | Diffusion = slow inference, needs strong GPU | Long-term |
| **Mamba-based** | SSM for temporal modeling | 50-200M | O(n) complexity, longer horizons feasible | Newer, less proven for driving | Research track |

**Recommendation:** Start with OccWorld (open-source, proven, fits Orin). Upgrade to Drive-OccWorld when action-conditioned prediction is needed for planning. Evaluate Mamba-based architectures for long-horizon efficiency.

### 5.2 Planning Head Decision

| Option | Type | Params | Pros | Cons | When |
|--------|------|--------|------|------|------|
| **World-model-augmented Frenet** | Hybrid | 0 (reuses existing) | Zero-risk, drop-in upgrade, keeps proven planner | Limited by Frenet candidate space | Phase 1 |
| **DiffusionDrive** | Diffusion policy (CVPR 2025 Highlight) | ~50-100M published (ResNet-34 backbone) | Multi-modal trajectories, real-time truncated diffusion | Needs training on airside data | Phase 2 |
| **TD-MPC2 in latent space** | MPC + learned value | 300M | Latent MPC, proven across 104 tasks, single hyperparams | Implicit world model may conflict with explicit one | Phase 2 alt |
| **Alpamayo VLA** | Vision-Language-Action | 10.5B | Explainable, text-guided, NVIDIA ecosystem | Needs cameras, heavy compute, fine-tuning complex | Phase 3 |

### 5.3 Perception Backbone Decision

| Option | Modality | Params | Pros | Cons | When |
|--------|----------|--------|------|------|------|
| **PointPillars** | LiDAR | 5M | Fast, proven, good baseline | Limited semantic understanding | Phase 1 |
| **CenterPoint** | LiDAR | 10M | Better 3D detection, center-based | Slightly heavier | Phase 1 alt |
| **BEVFusion** | LiDAR + Camera | 50-100M | Multi-modal, SOTA fusion | Needs cameras | Phase 2 |
| **DINOv2 + LSS** | Camera-primary | 300M | Rich semantic features, foundation model | Needs cameras | Phase 2 |
| **UniPAD** | LiDAR + Camera | 200M | Unified pre-training, CVPR 2024 | Complex training pipeline | Phase 3 |

---

## 6. Airside-Specific Innovations

### 6.1 Jet Blast Hazard Prediction

No road AV system needs this. Your world model should predict jet blast zones as hazard occupancy:

```
Input: Aircraft type (from ADS-B) + Engine status (from ATC/A-CDM)
    → Lookup: jet blast envelope (CFD-derived lookup table per aircraft type)
    → Render: hazard occupancy extending behind aircraft engines
    → World model: learns to predict jet blast evolution over time
    → Planner: treats hazard occupancy same as physical obstacles
```

### 6.2 FOD Detection via Occupancy Anomaly

FOD (Foreign Object Debris) is a critical airside concern. Traditional approaches need purpose-built detectors. Occupancy world models offer a natural solution:

```
Ground plane occupancy at t-1: empty
Ground plane occupancy at t:   occupied (small region, low height)
    → Anomaly: unexpected ground-level occupancy
    → Flag as potential FOD
    → If persistent across multiple frames: confirmed FOD
    → Alert operator + avoid zone
```

### 6.3 Turnaround Sequence Prediction

The world model can learn the temporal structure of aircraft turnarounds:

```
Turnaround phases: Arrival → Chocks On → Doors Open → Unloading → Loading → Doors Close → Pushback

World model + flight schedule context:
    → Predicts which phase each gate is in
    → Predicts when pushback will happen (± 2-5 min)
    → Planner routes GSE to arrive just-in-time
    → Reduces apron congestion and idle time
```

### 6.4 Ground Control Instruction Following (VLA Phase)

When Alpamayo or equivalent VLA is integrated:

```
Digital taxi instruction: "Tractor 7, proceed via Alpha to Stand B12, hold short of Bravo"
    → VLA parses instruction into route constraint
    → Plans trajectory: follow taxiway Alpha → hold at Bravo intersection
    → Monitors: ATC clearance to cross Bravo
    → Explains: "Holding short of Bravo as instructed. Awaiting clearance."
```

---

## 7. Research Gaps and Open Questions

### 7.1 Unsolved Problems

| Gap | Impact | Mitigation Strategy |
|-----|--------|-------------------|
| No public airside driving dataset | Can't benchmark against others | Your data becomes the first — publish a subset? |
| Occupancy world models not yet deployed on any real vehicle | You'd be first | Start with world-model-augmented Frenet (low risk) |
| Airside regulatory framework for ML-based AV is immature | Certification uncertainty | Build safety case with AMLAS + UL 4600, engage FAA early |
| LiDAR-only world models are less studied than camera-based | Fewer pre-trained models available | Copilot4D and AD-L-JEPA are LiDAR-native, OccWorld works from LiDAR BEV |
| Jet blast prediction from learned models is unexplored | Novel research needed | Start with CFD lookup table, learn residuals |
| Multi-agent coordination between autonomous GSE | No airside-specific solutions | Start with single vehicle, add fleet coordination later |

### 7.2 Research Directions Worth Tracking

1. **Dreamer V4** — Block-causal transformer world model, learns from unlabeled video. Could learn airside dynamics from your bags without labels.
2. **V-JEPA 2-AC** — ~15x faster planning than video generation baselines (16s vs. ~4min per action). If it scales to driving, it's a game-changer for real-time world model planning.
3. **WorldRFT** — RL fine-tuning of world models (AAAI 2026, 83% collision reduction). Direct path to safe learned planning.
4. **Waymo World Model (Genie 3)** — Generates camera AND LiDAR data. When open-sourced, could bootstrap your neural sim.
5. **ISO/PAS 8800** — Just published Dec 2024. First standard addressing AI safety lifecycle for AV. Foundation for your safety case.

---

## 8. Phased Roadmap

### Phase 0: Foundation (Months 0-3)
- [ ] Data engine Stages 1-3: index, extract, auto-label existing bags
- [ ] Pre-train BEV encoder on nuScenes/Waymo LiDAR
- [ ] Pre-train OccWorld on nuScenes occupancy
- [ ] Set up training infrastructure (GPU server or cloud)
- [ ] Define sensor abstraction layer interfaces
- **Deliverable:** Organized airside dataset + pre-trained world model baseline

### Phase 1: Airside World Model (Months 3-9)
- [ ] Fine-tune OccWorld on airside LiDAR data (self-supervised)
- [ ] Build world-model-augmented Frenet planner
- [ ] Implement safety monitor (OOD detection + RSS envelope)
- [ ] Integrate Simplex arbitration with current stack
- [ ] Shadow mode deployment on one vehicle
- **Deliverable:** World model running in shadow mode, predicting airside scenes

### Phase 2: Perception + Simulation Upgrade (Months 6-15)
- [ ] Add cameras to vehicle hardware
- [ ] Integrate DINOv2 + BEVFusion perception backbone
- [ ] Open-vocabulary detection for all airside object types
- [ ] Build 3DGS digital twin of primary airport
- [ ] Level 2 neural sim (closed-loop in reconstructed airport)
- [ ] Upgrade to Drive-OccWorld (action-conditioned)
- **Deliverable:** Multi-modal perception + rich simulation environment

### Phase 3: Learned Planning + VLA (Months 12-24)
- [ ] Train DiffusionDrive or TD-MPC2 planning head on airside data
- [ ] Integrate Alpamayo VLA (language reasoning + explainability)
- [ ] Airport integration layer (ADS-B, A-CDM, NOTAM)
- [ ] Jet blast hazard prediction system
- [ ] Ground control instruction following (VLA)
- [ ] RL post-training with SafeDreamer constraints
- **Deliverable:** End-to-end learned planning with explainability

### Phase 4: Fleet + Generalization (Months 18-30+)
- [ ] Multi-vehicle fleet coordination via shared world model
- [ ] Few-shot adaptation to new airports
- [ ] Continual learning data engine from fleet
- [ ] Safety case for certification (AMLAS + UL 4600)
- [ ] Turnaround sequence prediction and optimization
- **Deliverable:** Multi-airport, multi-vehicle autonomous airside operations

---

## 9. Success Criteria

| Metric | Phase 1 Target | Phase 3 Target | Phase 4 Target |
|--------|---------------|----------------|----------------|
| World model prediction error (occupancy IoU) | >0.5 @ 2s | >0.7 @ 4s | >0.8 @ 4s |
| Shadow mode agreement with current stack | >80% | >95% | >99% |
| Novel object detection (unseen GSE types) | N/A (LiDAR only) | >70% recall | >90% recall |
| Collision rate (simulation) | <1% | <0.1% | <0.01% |
| New airport adaptation time | N/A | <1 week | <1 day |
| Decision explainability | None | VLA explanations | Logged for every decision |
| Adverse weather operation | Baseline (rain filter) | Camera+radar fusion | World model robustness validated |

---

*This design specification synthesizes findings from 20 deep-dive research reports (13,210 lines of analysis across 200+ papers) with the concrete reality of the Aurrigo ADS ROS Noetic stack — 22 packages, LiDAR-centric perception, GTSAM localization, Frenet planning, multi-platform vehicle support. The architecture is designed to preserve every strength of the current stack while progressively unlocking capabilities that only learned world models can provide.*
