# Edge-Cloud Hybrid Inference Architecture for Fleet-Scale Autonomous GSE

**Last Updated:** 2026-04-11
**Context:** Autonomous electric GSE fleet (20-100+ vehicles) operating 16-20 hrs/day on airport airside
**Platforms:** NVIDIA Jetson AGX Orin 64GB (on-vehicle), NVIDIA DGX/HGX or multi-GPU servers (airport edge), cloud GPU clusters (training/analytics)
**Connectivity:** Airport private 5G/CBRS (100 Mbps-1 Gbps DL, 50-200 Mbps UL, 5-20ms RTT)

---

> **Key Takeaway:** On-vehicle Orin AGX (275 TOPS) is sufficient for the safety-critical perception and planning loop but cannot simultaneously run VLMs, world models, foundation model backbones, cooperative perception fusion, and fleet-level intelligence. Airport private 5G provides the missing link that highway AVs lack: reliable, high-bandwidth, low-latency connectivity to local compute infrastructure. A three-tier architecture (on-vehicle Orin + airport MEC edge server + cloud) enables advanced AI capabilities without replacing vehicle hardware, amortizes expensive GPU infrastructure across the fleet ($2,500/vehicle for a shared edge server vs $2,000-5,000/vehicle for individual Thor upgrades), and degrades gracefully when the network fails because the safety-critical Simplex baseline controller never leaves the vehicle. The critical design constraint is that the vehicle must always be able to operate fully autonomously -- the edge enhances but never gates safety. This architecture uniquely suits airports because the operating environment is geographically bounded, the infrastructure is owned or co-managed, the connectivity is private and controllable, and vehicles return to depots where edge servers are co-located.

---

## Table of Contents

1. [Introduction and Motivation](#1-introduction-and-motivation)
2. [Three-Tier Compute Architecture](#2-three-tier-compute-architecture)
3. [Model Placement Decision Framework](#3-model-placement-decision-framework)
4. [Bandwidth and Latency Analysis](#4-bandwidth-and-latency-analysis)
5. [Split Inference Patterns](#5-split-inference-patterns)
6. [Airport Edge Server Architecture](#6-airport-edge-server-architecture)
7. [Graceful Degradation When Network Fails](#7-graceful-degradation-when-network-fails)
8. [Security and Privacy](#8-security-and-privacy)
9. [Cost-Benefit Analysis](#9-cost-benefit-analysis)
10. [Integration with Existing reference airside AV stack Systems](#10-integration-with-existing-airside-systems)
11. [Industry Approaches](#11-industry-approaches)
12. [Implementation Roadmap](#12-implementation-roadmap)
13. [Key Takeaways](#13-key-takeaways)
14. [References](#14-references)

---

## 1. Introduction and Motivation

### 1.1 The On-Vehicle Compute Bottleneck

The NVIDIA Jetson AGX Orin 64GB provides 275 TOPS (sparse INT8), 138 TFLOPS (FP16), and 64 GB unified LPDDR5 memory at 15-60W. For the current reference airside AV stack safety-critical perception and planning stack, this is sufficient with headroom:

```
Current reference airside AV stack Orin Compute Budget (from model-compression-edge-deployment.md):
┌─────────────────────────────────┬──────────┬──────────┐
│ Component                        │ Latency  │ Memory   │
├─────────────────────────────────┼──────────┼──────────┤
│ LiDAR preprocessing              │ 5ms      │ 0.5 GB   │
│ 3D Detection (PointPillars)      │ 6.84ms   │ 0.8 GB   │
│ 3D Segmentation (FlatFormer)     │ 25ms     │ 1.5 GB   │
│ Tracking (Kalman + association)  │ 3ms      │ 0.2 GB   │
│ Occupancy grid (nvblox)          │ 10ms     │ 1.0 GB   │
│ Localization (GTSAM + VGICP)     │ 8ms      │ 0.5 GB   │
│ Planning (Frenet, 420 cands)     │ 5ms      │ 0.3 GB   │
│ CBF safety filter                │ 1ms      │ 0.1 GB   │
│ Safety monitoring (STL)          │ 2ms      │ 0.1 GB   │
├─────────────────────────────────┼──────────┼──────────┤
│ TOTAL                            │ ~66ms    │ 5.0 GB   │
│ Remaining budget (100ms cycle)   │ ~34ms    │ 59.0 GB  │
└─────────────────────────────────┴──────────┴──────────┘
```

The problem emerges when attempting to add advanced AI capabilities simultaneously:

```
Desired Additional Models (cannot all fit on Orin simultaneously):
┌─────────────────────────────────┬──────────┬──────────┬───────────┐
│ Model                            │ Orin ms  │ Memory   │ Frequency │
├─────────────────────────────────┼──────────┼──────────┼───────────┤
│ VLM co-pilot (InternVL2-2B)     │ 300ms    │ 3.0 GB   │ 1-2 Hz    │
│ World model (3-step prediction)  │ 50-100ms │ 2.0 GB   │ 5 Hz      │
│ Foundation backbone (PTv3)       │ 30-40ms  │ 2.5 GB   │ 10 Hz     │
│ Scene flow (DeFlow)              │ 26-40ms  │ 1.5 GB   │ 10 Hz     │
│ Multi-task perception head       │ 14.8ms   │ 1.8 GB   │ 10 Hz     │
│ Place recognition (MinkLoc3D)    │ 15ms     │ 0.8 GB   │ 1 Hz      │
│ Cooperative perception fusion    │ 10-20ms  │ 1.0 GB   │ 10 Hz     │
│ Uncertainty quantification       │ 7.5ms    │ 0.5 GB   │ 10 Hz     │
│ Neural motion planner            │ 15-45ms  │ 1.0 GB   │ 10 Hz     │
│ Thermal fusion                   │ 6-8ms    │ 0.5 GB   │ 10 Hz     │
├─────────────────────────────────┼──────────┼──────────┼───────────┤
│ TOTAL additional                 │ ~500ms+  │ 14.6 GB  │ (mixed)   │
│ Combined with safety stack       │ ~570ms+  │ 19.6 GB  │           │
└─────────────────────────────────┴──────────┴──────────┴───────────┘
```

Even with CUDA streams enabling concurrent execution, the GPU contention from running all models simultaneously would blow the 100ms cycle budget by 5-6x. The memory fits in 64 GB, but the compute does not fit in time. Running models at reduced frequency (VLM at 1 Hz, world model at 5 Hz) helps but still leaves the perception cycle overloaded during complex scenarios like turnaround operations where all capabilities are needed most.

### 1.2 Why Airports Are Different from Highways

Highway autonomous vehicles face a fundamental connectivity problem: the vehicle moves through heterogeneous coverage zones at 100+ km/h, traverses rural areas with no infrastructure, and cannot depend on any particular wireless connection. This forces all compute onto the vehicle.

Airport airside operations have the opposite characteristics:

| Property | Highway AV | Airport GSE |
|----------|-----------|-------------|
| Speed | 30-130 km/h | 5-25 km/h |
| Coverage area | Open road, 100s of km | Bounded apron, <5 km2 |
| Connectivity | Variable cellular, no guarantee | Private 5G/CBRS, owned infrastructure |
| Base station distance | Macro cells, 500m-5km | Small cells, 50-200m |
| RTT achievable | 20-100ms (variable) | 5-20ms (consistent) |
| Bandwidth | 10-100 Mbps (contested) | 100 Mbps-1 Gbps (dedicated) |
| Infrastructure ownership | Carrier-owned, shared | Airport-owned or co-managed |
| Vehicle return to base | Unpredictable | Every shift (depot/charging) |
| Environment predictability | Open world | Semi-structured, mapped |
| Fleet co-location | Geographically dispersed | Co-located on same apron |

The combination of owned connectivity, bounded geography, predictable routes, and co-located fleet creates a uniquely favorable environment for edge-cloud offloading. This is not aspirational -- DFW Airport has deployed private 5G/CBRS at $10M covering 27 square miles (see `airport-5g-cbrs.md` Section 1), and Changi operates autonomous tractors on private 5G today (Section 2).

### 1.3 The Edge-Cloud Opportunity

The key insight is that airport 5G connectivity bridges the gap between what Orin can compute locally and what a fleet needs for advanced AI capabilities:

```
Without Edge-Cloud          With Edge-Cloud
(Vehicle Only)              (Three-Tier)

┌──────────────┐           ┌──────────────┐
│   Vehicle     │           │   Vehicle     │
│  Orin 275T    │           │  Orin 275T    │
│              │           │              │
│ PointPillars │           │ PointPillars │  <- Safety: always on-vehicle
│ Frenet       │           │ Frenet       │
│ CBF/Simplex  │           │ CBF/Simplex  │
│ GTSAM        │           │ GTSAM        │
│ FlatFormer   │           │ FlatFormer   │
│              │           │              │
│ VLM? No room │           │ + BEV feat.  │──┐ 5G (5-20ms RTT)
│ WM? Maybe 5Hz│           │ + UQ heads   │  │
│ PTv3? No room│           │ + Flow input │  │
│              │           │              │  │
│ Capability:  │           │ Capability:  │  │
│ ★★★☆☆       │           │ ★★★★★       │  │
└──────────────┘           └──────────────┘  │
                                              │
                           ┌──────────────┐  │
                           │ Airport Edge  │<─┘
                           │ 4-8x A100    │
                           │              │
                           │ VLM co-pilot │
                           │ World model  │
                           │ Coop. fusion │
                           │ Map updates  │
                           │ Fleet percep.│
                           │              │
                           └──────┬───────┘
                                  │ Internet (>100ms)
                           ┌──────┴───────┐
                           │    Cloud      │
                           │              │
                           │ Training     │
                           │ Auto-labeling│
                           │ Analytics    │
                           │ Regulatory   │
                           └──────────────┘
```

### 1.4 Relation to Existing Documents

This document builds on and cross-references:

- **`nvidia-orin-technical.md`**: Orin AGX hardware capabilities, power modes, and memory subsystem
- **`energy-efficient-inference-24-7.md`**: Power management and compute scheduling on-vehicle
- **`model-compression-edge-deployment.md`**: Compression techniques for on-vehicle deployment
- **`edge-platforms.md`**: Compute platform survey including Orin and Thor
- **`airport-5g-cbrs.md`**: Airport connectivity infrastructure (DFW, Changi, LAX case studies)
- **`v2x-protocols-airside.md`**: V2X message standards and bandwidth planning
- **`collaborative-fleet-perception.md`**: V2V cooperative perception algorithms
- **`vlm-scene-understanding.md`**: VLM co-pilot architecture and deployment considerations
- **`lidar-native-world-models.md`**: LiDAR world model inference requirements
- **`runtime-verification-monitoring.md`**: Safety monitoring and Simplex architecture
- **`tensorrt-deployment-guide.md`**: TensorRT optimization pipeline

---

## 2. Three-Tier Compute Architecture

### 2.1 Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────────┐
│                     THREE-TIER COMPUTE ARCHITECTURE                         │
│                                                                            │
│  TIER 1: ON-VEHICLE           TIER 2: AIRPORT EDGE      TIER 3: CLOUD     │
│  (Per Vehicle)                (Per Airport)              (Global)           │
│  ─────────────────           ─────────────────          ───────────────    │
│  Orin AGX 64GB               DGX H100 / 4-8x A100      GPU Cluster       │
│  275 TOPS, 60W               ~600-8,000 TOPS            ~Petascale        │
│  64 GB LPDDR5                40-640 GB HBM              TB+ RAM            │
│  $1,599/vehicle              $50K-400K/airport          $10K+/mo           │
│                                                                            │
│  Latency: <10ms local        Latency: 20-100ms E2E      Latency: >1s      │
│  Availability: 100%          Availability: 99.9%         Availability: 99%  │
│  Bandwidth: N/A (local)      Bandwidth: 5G private       Bandwidth: Inet   │
│                                                                            │
│  RESPONSIBILITIES:           RESPONSIBILITIES:           RESPONSIBILITIES:  │
│  • Safety-critical percep.   • VLM co-pilot inference   • Model training   │
│  • Object detection (PP)     • World model prediction   • Auto-labeling    │
│  • Planning (Frenet)         • Foundation model heads   • Data processing  │
│  • CBF safety filter         • Cooperative perception   • Fleet analytics  │
│  • Simplex BC controller     • Map change detection     • Regulatory logs  │
│  • GTSAM localization        • Fleet-level fusion       • SW OTA packaging │
│  • STL runtime monitors      • Place recognition DB     • Sim/validation   │
│  • Emergency stop            • Advanced UQ analysis     • Federated agg.   │
│  • Basic segmentation        • Neural planner (verify)  • Incident review  │
│                                                                            │
│  FAILURE MODE:               FAILURE MODE:              FAILURE MODE:       │
│  N/A (always available)      → Vehicle goes autonomous  → Edge handles all  │
│  If vehicle fails → stop     Network loss = transparent  short-term tasks   │
│                              for safety-critical path                       │
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Tier 1: On-Vehicle (NVIDIA Orin AGX)

The on-vehicle tier runs everything required for safe autonomous operation with zero network dependency. This is the irreducible compute core that cannot be offloaded.

**Design principle: The vehicle must always be capable of completing its current mission if the network disappears.**

| Component | Latency | Model | Why On-Vehicle |
|-----------|---------|-------|----------------|
| 3D detection | 6.84ms | PointPillars INT8 | Safety: primary obstacle detection |
| Segmentation | 16-25ms | FlatFormer INT8 | Safety: ground/obstacle classification |
| Tracking | 3ms | SimpleTrack/Kalman | Safety: temporal consistency |
| Occupancy grid | 2-5ms | GPU raycasting (nvblox) | Safety: collision avoidance |
| Localization | 8ms | GTSAM + VGICP | Safety: position knowledge |
| Planning | 5ms | Frenet (420 candidates) | Safety: trajectory generation |
| CBF filter | <1ms | OSQP solver | Safety: formal collision avoidance |
| Simplex BC | <0.5ms | Emergency fallback | Safety: system failover |
| STL monitors | <2ms | 20 airside specs | Safety: runtime verification |
| Safety MCU | Continuous | STM32H725 (MISRA C) | Safety: HW speed limiter, watchdog |

**Total on-vehicle safety budget: ~50-55ms within 100ms cycle (10 Hz)**

The remaining ~45-50ms is available for on-vehicle portions of split inference (backbone execution, feature extraction, local uncertainty estimation) and for receiving/integrating edge results from the previous cycle.

**Memory allocation (on-vehicle):**

```
Safety stack (always resident):          ~5.0 GB
Feature extraction backbone:            ~1.5 GB
V2X communication buffers:              ~0.5 GB
Edge result caching (last known good):  ~1.0 GB
ROS node overhead:                      ~2.0 GB
TensorRT execution contexts:            ~1.5 GB
OS + drivers:                           ~4.0 GB
────────────────────────────────────────────────
Total resident:                         ~15.5 GB
Available for optional models:          ~48.5 GB
```

The 48.5 GB headroom enables selective on-vehicle execution of enhanced models during network degradation, or caching of edge-provided priors (neural map prior, fleet perception state, world model predictions) that remain valid for seconds even after network loss.

### 2.3 Tier 2: Airport Edge Server (MEC)

The airport edge server is a Multi-access Edge Computing (MEC) node co-located with the airport's 5G infrastructure. Physically, it sits in an equipment room at the airport -- often in the same facility as the 5G core network, within 1-2 network hops of the radio access network.

**Purpose: Run compute-intensive AI models that enhance safety and capability but are not required for baseline safe operation.**

| Function | Model | Edge Latency | Value Added |
|----------|-------|-------------|-------------|
| VLM co-pilot | InternVL2-7B or Qwen-VL-7B | 40-80ms | Scene reasoning, anomaly explanation |
| World model prediction | LiDAR-native (UnO variant) | 30-60ms | 3-step future occupancy prediction |
| Foundation perception | PTv3 backbone + multi-task heads | 15-30ms | Higher accuracy seg/det/prediction |
| Cooperative fusion | Where2comm aggregation | 10-20ms | Fleet-level perception merge |
| Map change detection | RTMap incremental update | 20-40ms | Real-time HD map maintenance |
| Neural map prior | NMP inference | 30-50ms | Enhanced mapping in adverse conditions |
| Advanced UQ | Deep ensemble (M=5) | 50-100ms | Gold-standard uncertainty estimates |
| Place recognition DB | FAISS + MinkLoc3D verification | 5-15ms | Multi-session map alignment |
| Fleet state estimation | Graph-based fleet optimizer | 10-30ms | Cross-vehicle consistency |
| Auto-labeling (near-RT) | SAM + CLIP on selected frames | 200-500ms | Trigger-based edge labeling |

The edge server operates as a shared resource. Every vehicle in the fleet submits requests and receives enhanced results. The server must handle concurrent requests from all vehicles, with prioritization based on the vehicle's current operational context (turnaround stand operations get priority over taxiway transit).

### 2.4 Tier 3: Cloud

The cloud tier handles tasks where latency tolerance exceeds 1 second and compute requirements exceed what a single airport edge server can provide.

| Function | Latency Tolerance | Compute Need | Frequency |
|----------|-------------------|-------------|-----------|
| Model training (full) | Hours-days | Multi-node GPU | Weekly-monthly |
| Federated learning aggregation | Minutes | CPU/GPU hybrid | Per FL round (hours) |
| Auto-labeling (batch) | Hours | Multi-GPU | Daily |
| Simulation / validation | Hours | GPU cluster | Per release |
| Fleet analytics dashboard | Seconds | CPU | Continuous |
| Regulatory log archival | Minutes | Storage-heavy | Continuous |
| OTA update packaging | Minutes | CPU/storage | Per release |
| Cross-airport model transfer | Hours | Multi-GPU | Per new airport |
| Incident replay / analysis | Minutes | GPU | Per incident |
| Causal SCM inference (batch) | Minutes | CPU/GPU | Per shift |

**Cloud provider considerations for aviation:**
- Data sovereignty: some airports (especially EU, Middle East) require data to remain in-country
- Aviation cybersecurity compliance (see `cybersecurity-airside-av.md`)
- Hybrid cloud: airport-owned compute for sensitive data + public cloud for training

### 2.5 Data Flow Architecture

```
                    TIER 3: CLOUD
                    ┌────────────────────────────┐
                    │  Training    Analytics      │
                    │  AutoLabel   Simulation     │
                    │  OTA Mgmt   Regulatory      │
                    └──────────┬─────────────────┘
                               │ Internet
                               │ (100-500ms RTT)
                               │
                    TIER 2: AIRPORT EDGE
                    ┌──────────┴─────────────────┐
                    │  VLM   WorldModel  CoopFuse │
                    │  MapMgr  PlaceRecDB  UQ     │
                    │                              │
                    │  NVIDIA Triton Server         │
                    │  Request Queue + Priority     │
                    │  Result Cache + Broadcast     │
                    └───┬────┬────┬────┬──────────┘
                        │    │    │    │  Private 5G
                        │    │    │    │  (5-20ms RTT)
           ┌────────────┘    │    │    └────────────┐
           │                 │    │                  │
     ┌─────┴──────┐   ┌─────┴──┐  ┌──────┴───┐  ┌──┴───────┐
     │ Vehicle 1  │   │ Veh. 2 │  │  Veh. 3  │  │  Veh. N  │
     │ Orin AGX   │   │ Orin   │  │  Orin    │  │  Orin    │
     │            │   │        │  │          │  │          │
     │ Safety PP  │   │ Safety │  │  Safety  │  │  Safety  │
     │ Frenet+CBF │   │ stack  │  │  stack   │  │  stack   │
     │ GTSAM      │   │        │  │          │  │          │
     └────────────┘   └────────┘  └──────────┘  └──────────┘

     Data flows:
     UPLINK (vehicle → edge):
       • Compressed LiDAR features: 50-200 KB @ 10 Hz
       • Camera frame (selected): 100-300 KB @ 2-5 Hz
       • BEV feature map: 50-100 KB @ 10 Hz
       • Detection results: 5-10 KB @ 10 Hz
       • Health/telemetry: 1-2 KB @ 1 Hz

     DOWNLINK (edge → vehicle):
       • VLM scene description: 1-5 KB @ 1-2 Hz
       • World model predictions: 20-50 KB @ 5 Hz
       • Enhanced detections: 10-20 KB @ 10 Hz
       • Cooperative perception: 50-100 KB @ 10 Hz
       • Map updates: 10-50 KB @ 1 Hz
       • Fleet state: 5-10 KB @ 1 Hz
```

---

## 3. Model Placement Decision Framework

### 3.1 Latency Budget Taxonomy

Every model in the reference airside AV stack falls into one of four latency categories. The category determines which tier(s) can host the model:

```
LATENCY CATEGORIES:

┌─────────────────────────────────────────────────────────────────────┐
│  CATEGORY A: HARD REAL-TIME (<10ms)                                 │
│  Tier: ON-VEHICLE ONLY                                              │
│  Rationale: Any network hop adds 5-20ms minimum. Cannot risk        │
│  network jitter or failure. Controls actuators directly.            │
│  Examples: CBF filter, Simplex BC, STL monitors, safety MCU         │
├─────────────────────────────────────────────────────────────────────┤
│  CATEGORY B: SOFT REAL-TIME (10-100ms)                              │
│  Tier: ON-VEHICLE PRIMARY, EDGE ENHANCEMENT                        │
│  Rationale: On-vehicle model provides baseline. Edge provides       │
│  higher-quality result that is used if it arrives in time.          │
│  Examples: Detection, segmentation, tracking, planning              │
├─────────────────────────────────────────────────────────────────────┤
│  CATEGORY C: NEAR REAL-TIME (100ms-1s)                              │
│  Tier: EDGE PRIMARY, ON-VEHICLE CACHE                               │
│  Rationale: These models run at 1-5 Hz. Edge compute is sufficient. │
│  Vehicle caches last-known-good result for network loss periods.    │
│  Examples: VLM co-pilot, world model, cooperative fusion, map update│
├─────────────────────────────────────────────────────────────────────┤
│  CATEGORY D: OFFLINE (>1s)                                          │
│  Tier: CLOUD ONLY                                                   │
│  Rationale: Not time-critical. Compute requirements exceed edge.    │
│  Examples: Training, auto-labeling, simulation, regulatory reports  │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Decision Tree

For each model, walk this decision tree to determine optimal placement:

```
                     ┌──────────────────┐
                     │ Does model output │
                     │ directly control  │
                     │ actuators?        │
                     └────────┬─────────┘
                        Yes   │   No
                     ┌────────┘   └────────┐
                     ▼                      ▼
              ┌────────────┐        ┌──────────────┐
              │ TIER 1 ONLY │        │ Latency req. │
              │ (on-vehicle)│        │ < 100ms?     │
              └────────────┘        └──────┬───────┘
                                     Yes   │   No
                                ┌──────────┘   └──────────┐
                                ▼                          ▼
                         ┌────────────┐            ┌────────────┐
                         │ Orin can run│            │ Latency req.│
                         │ within 50ms?│            │ < 1s?       │
                         └──────┬─────┘            └──────┬─────┘
                          Yes   │   No              Yes   │   No
                       ┌────────┘  └───────┐    ┌────────┘   └────┐
                       ▼                    ▼    ▼                  ▼
                ┌────────────┐      ┌────────────┐          ┌────────────┐
                │ TIER 1     │      │ TIER 1+2   │          │ TIER 3     │
                │ (on-vehicle│      │ Split:      │          │ (cloud)    │
                │ sufficient)│      │ backbone T1 │          └────────────┘
                └────────────┘      │ head on T2  │
                                    └────────────┘
```

### 3.3 Complete Model Placement Table

| Model | Category | Tier | On-Vehicle Role | Edge Role | Cloud Role | Fallback |
|-------|----------|------|-----------------|-----------|------------|----------|
| **PointPillars (detection)** | A | T1 only | Full inference (6.84ms) | N/A | N/A | Is the fallback |
| **CBF-QP safety filter** | A | T1 only | Full solve (<1ms) | N/A | N/A | Is the fallback |
| **Simplex BC (Frenet)** | A | T1 only | Full planning (5ms) | N/A | N/A | Is the fallback |
| **STL runtime monitors** | A | T1 only | 20 specs (<2ms) | N/A | N/A | Is the fallback |
| **Safety MCU (STM32)** | A | T1 only | HW watchdog | N/A | N/A | Hardware independent |
| **GTSAM localization** | A | T1 only | Full filter (8ms) | N/A | N/A | Dead reckoning |
| **FlatFormer (seg.)** | B | T1+T2 | INT8 on-vehicle (16-25ms) | PTv3 head (higher acc.) | N/A | On-vehicle result |
| **CenterPoint (det.)** | B | T1+T2 | INT8 on-vehicle (12ms) | Foundation head | N/A | On-vehicle result |
| **Scene flow (DeFlow)** | B | T1+T2 | On-vehicle (26-40ms) | Enhanced resolution | N/A | On-vehicle result |
| **Multi-task perception** | B | T1+T2 | Shared backbone (14.8ms) | Additional heads | N/A | On-vehicle heads |
| **Tracking (SimpleTrack)** | B | T1 | On-vehicle (3ms) | Fleet-consistent IDs | N/A | On-vehicle tracks |
| **Uncertainty (evidential)** | B | T1+T2 | Single-pass (7.5ms) | Deep ensemble (M=5) | N/A | Single-pass UQ |
| **Neural planner** | B | T1+T2 | On-vehicle + CBF (16.3ms) | Verify/correct | N/A | Frenet (Simplex) |
| **Thermal fusion** | B | T1 | YOLO-Thermal (6-8ms) | Enhanced fusion | N/A | LiDAR-only |
| **VLM co-pilot** | C | T2 | Cache last result | InternVL2-7B (40-80ms) | InternVL2-26B | No VLM (safe without) |
| **World model** | C | T2 | Cache predictions | LiDAR-native (30-60ms) | Training only | Occupancy flow only |
| **Cooperative fusion** | C | T2 | Local features only | Where2comm agg. | N/A | Single-vehicle percep. |
| **Map change detection** | C | T2 | Report observations | RTMap fusion | Archival | Static HD map |
| **Neural map prior** | C | T2 | Cache prior | NMP inference | Training | Standard map |
| **Place recognition** | C | T1+T2 | ScanContext CPU (5ms) | FAISS DB + MinkLoc3D | N/A | Odometry only |
| **Fleet state estimation** | C | T2 | N/A | Graph optimizer | Dashboard | No fleet state |
| **Auto-labeling (RT)** | C | T2 | Select trigger frames | SAM + CLIP | Batch processing | Manual labeling |
| **Model training** | D | T3 | N/A | N/A | Full training | N/A |
| **Batch auto-labeling** | D | T3 | N/A | N/A | SAM + CLIP pipeline | N/A |
| **Simulation** | D | T3 | N/A | N/A | CARLA/NVIDIA Isaac | N/A |
| **Federated aggregation** | D | T3 | Local LoRA training | N/A | Global aggregation | N/A |
| **OTA updates** | D | T3 | Receive + apply | Stage locally | Package + sign | N/A |
| **Regulatory reporting** | D | T3 | Log locally | Forward | Archive + query | Local logs only |

### 3.4 Context-Adaptive Placement

Model placement is not static. The decision framework adapts based on the vehicle's current operational context, following the context-aware switching strategy from `energy-efficient-inference-24-7.md`:

```
CONTEXT → PLACEMENT ADJUSTMENT:

Taxiway transit (low complexity):
  T1: Safety stack only (PointPillars, Frenet, CBF)
  T2: VLM at 0.5 Hz, world model off, cooperative perception at 2 Hz
  Power: 15-30W on Orin

Apron transit (medium complexity):
  T1: Safety stack + segmentation + tracking
  T2: VLM at 1 Hz, world model at 2 Hz, cooperative at 5 Hz
  Power: 30-45W on Orin

Stand approach (high complexity):
  T1: Full safety stack + feature backbone
  T2: VLM at 2 Hz, world model at 5 Hz, cooperative at 10 Hz, map updates
  Power: 45-60W on Orin

Runway crossing (maximum alert):
  T1: Full safety stack, no optional models
  T2: All models at maximum rate, fleet-level fusion priority
  Power: MAXN on Orin, all available edge GPU allocated
```

---

## 4. Bandwidth and Latency Analysis

### 4.1 Airport 5G Network Characteristics

Based on deployed airport 5G networks (DFW, Changi, LAX -- see `airport-5g-cbrs.md`):

| Parameter | Private 5G (CBRS n48) | Private 5G (mmWave n260) | WiFi 6E |
|-----------|----------------------|-------------------------|---------|
| Downlink peak | 300 Mbps-1 Gbps | 1-4 Gbps | 1-2 Gbps |
| Uplink peak | 50-200 Mbps | 200-500 Mbps | 500 Mbps-1 Gbps |
| RTT (UE to MEC) | 5-15ms | 2-8ms | 3-10ms |
| RTT (UE to internet) | 20-50ms | 15-30ms | 10-30ms |
| Reliability | 99.999% (URLLC) | 99.9% (coverage limited) | 99% |
| Range per cell | 200-500m | 50-150m | 30-100m |
| Handover time | <20ms | <30ms | 50-200ms |
| Vehicle density per cell | 20-50 | 10-20 | 10-30 |
| Frequency | 3.55-3.7 GHz | 24-40 GHz | 6 GHz |

**Recommended for airside GSE: Private 5G CBRS (sub-6 GHz)** -- best balance of range, reliability, and latency. mmWave provides higher bandwidth but smaller cells and is susceptible to rain fade and jet blast turbulence. WiFi 6E lacks URLLC guarantees.

### 4.2 Per-Vehicle Data Payloads

The choice of what data to send from vehicle to edge server determines bandwidth consumption. The options range from raw sensor data (maximum bandwidth, maximum flexibility) to compressed features (minimum bandwidth, requires on-vehicle preprocessing).

| Data Type | Raw Size | Compressed | Rate | Per-Vehicle BW | Direction |
|-----------|----------|------------|------|---------------|-----------|
| **LiDAR point cloud (4-8 sensors)** | 4-12 MB/frame | 200-500 KB (Draco) | 10 Hz | 16-40 Mbps | UL |
| **Camera frame (1-2 cameras)** | 6-12 MB/frame | 100-300 KB (JPEG95) | 10-30 Hz | 8-72 Mbps | UL |
| **BEV feature map** | 2-8 MB/frame | 50-200 KB (FP16+LZ4) | 10 Hz | 4-16 Mbps | UL |
| **Pillar features** | 1-3 MB/frame | 30-80 KB (sparse) | 10 Hz | 2.4-6.4 Mbps | UL |
| **Detection results** | 10-50 KB | 5-10 KB | 10 Hz | 0.4-0.8 Mbps | UL |
| **Vehicle telemetry** | 2-5 KB | 1-2 KB | 10 Hz | 0.08-0.16 Mbps | UL |
| **Health diagnostics** | 1-2 KB | 1-2 KB | 1 Hz | 0.008-0.016 Mbps | UL |
| **Edge detection results** | 10-50 KB | 5-20 KB | 10 Hz | 0.4-1.6 Mbps | DL |
| **VLM scene description** | 1-10 KB | 1-5 KB | 1-2 Hz | 0.008-0.08 Mbps | DL |
| **World model predictions** | 50-200 KB | 20-50 KB | 5 Hz | 0.8-2.0 Mbps | DL |
| **Cooperative percep. result** | 100-500 KB | 50-100 KB | 10 Hz | 4.0-8.0 Mbps | DL |
| **Map updates** | 10-100 KB | 10-50 KB | 1 Hz | 0.08-0.4 Mbps | DL |
| **Fleet state broadcast** | 5-20 KB | 5-10 KB | 1 Hz | 0.04-0.08 Mbps | DL |

### 4.3 Per-Vehicle Bandwidth Profiles

Different offloading strategies consume different bandwidth:

```
Profile A: Feature offload (RECOMMENDED)
  UL: BEV features (4-16 Mbps) + detections (0.8 Mbps) + telemetry (0.16 Mbps)
      = 5-17 Mbps uplink per vehicle
  DL: Edge results (1.6 Mbps) + VLM (0.08 Mbps) + world model (2.0 Mbps) +
      coop percep (8.0 Mbps) + map (0.4 Mbps) + fleet (0.08 Mbps)
      = 5-12 Mbps downlink per vehicle

Profile B: Raw sensor offload (for auto-labeling, not real-time)
  UL: LiDAR (16-40 Mbps) + camera (8-72 Mbps)
      = 24-112 Mbps uplink per vehicle
  DL: Minimal return data = 1-5 Mbps downlink per vehicle

Profile C: Minimal (degraded network)
  UL: Detection results only (0.8 Mbps) + telemetry (0.16 Mbps)
      = ~1 Mbps uplink per vehicle
  DL: Fleet state broadcast only (0.08 Mbps)
      = ~0.1 Mbps downlink per vehicle
```

### 4.4 Fleet-Scale Bandwidth Planning

| Fleet Size | Profile A (UL/DL) | Profile B (UL/DL) | Profile C (UL/DL) |
|------------|-------------------|--------------------|-------------------|
| 20 vehicles | 100-340 / 100-240 Mbps | 480-2,240 / 20-100 Mbps | 20 / 2 Mbps |
| 50 vehicles | 250-850 / 250-600 Mbps | 1,200-5,600 / 50-250 Mbps | 50 / 5 Mbps |
| 100 vehicles | 500-1,700 / 500-1,200 Mbps | **Infeasible** | 100 / 10 Mbps |
| 200 vehicles | 1,000-3,400 / 1,000-2,400 Mbps | **Infeasible** | 200 / 20 Mbps |

**Key observation:** Profile A (feature offload) supports up to ~50 vehicles on a single 5G sector. Beyond 50, either additional sectors or bandwidth optimization is needed. Profile B (raw offload) is only viable for up to 5-10 vehicles simultaneously and should be reserved for selected trigger-frame uploads, not continuous streaming.

### 4.5 Congestion Management

When multiple vehicles operate near the same stand during turnaround (the highest-demand scenario), network congestion must be managed:

```python
# QoS Priority Levels for 5G Network Slicing
# 5QI (5G QoS Identifier) mapping for autonomous GSE

QOS_PROFILES = {
    # 5QI 82: Delay-critical GBR (guaranteed bit rate)
    "safety_critical": {
        "5qi": 82,
        "priority": 1,           # Highest
        "guaranteed_br": "1 Mbps",  # Detections + V2X safety
        "max_latency": "10ms",
        "packet_error": "1e-6",
        "slice": "URLLC",
        "contents": ["V2X_safety", "emergency_stop", "detection_results"]
    },

    # 5QI 7: Non-GBR, real-time
    "edge_inference": {
        "5qi": 7,
        "priority": 2,
        "guaranteed_br": "N/A",
        "max_latency": "50ms",
        "packet_error": "1e-3",
        "slice": "eMBB",
        "contents": ["BEV_features", "edge_results", "cooperative_percep"]
    },

    # 5QI 8: Non-GBR, best effort with priority
    "enhanced_percep": {
        "5qi": 8,
        "priority": 3,
        "guaranteed_br": "N/A",
        "max_latency": "100ms",
        "packet_error": "1e-2",
        "slice": "eMBB",
        "contents": ["VLM_results", "world_model", "map_updates"]
    },

    # 5QI 9: Non-GBR, best effort
    "analytics": {
        "5qi": 9,
        "priority": 4,           # Lowest
        "guaranteed_br": "N/A",
        "max_latency": "1000ms",
        "packet_error": "1e-2",
        "slice": "eMBB",
        "contents": ["raw_sensor_upload", "logging", "diagnostics"]
    }
}
```

**Network slicing** partitions the 5G network into logically separate networks with guaranteed resources. The safety-critical slice (URLLC) is provisioned with guaranteed bit rate and never contends with analytics traffic. This is a standard 5G SA (standalone) feature available in private deployments.

### 4.6 End-to-End Latency Breakdown

For the recommended Profile A (feature offload) path:

```
End-to-end latency for edge-enhanced inference:

Step 1: On-vehicle backbone (feature extraction)
  LiDAR preprocess:                     5ms
  Pillar/voxel encoding:                3ms
  Backbone forward pass:                8ms
  Feature compression (LZ4):            1ms
  ───────────────────────────────────────
  Subtotal:                            17ms

Step 2: Network transport (vehicle → edge)
  5G UL scheduling + encoding:          2-5ms
  Air interface:                        1-3ms
  Backhaul to MEC:                      1-3ms
  ───────────────────────────────────────
  Subtotal:                            4-11ms

Step 3: Edge server inference
  Triton request deserialization:       0.5ms
  Feature decompression:                0.5ms
  Model inference (varies):            10-50ms
  Result serialization:                 0.5ms
  ───────────────────────────────────────
  Subtotal:                           11.5-51.5ms

Step 4: Network transport (edge → vehicle)
  Backhaul from MEC:                    1-3ms
  Air interface:                        1-3ms
  5G DL scheduling:                     1-2ms
  ───────────────────────────────────────
  Subtotal:                            3-8ms

Step 5: On-vehicle result integration
  Deserialization:                      0.5ms
  Confidence-weighted fusion:           1ms
  ───────────────────────────────────────
  Subtotal:                            1.5ms

═══════════════════════════════════════════
TOTAL END-TO-END:                      37-89ms
Typical:                               ~55ms
```

This 55ms typical latency means edge results arrive during the same 100ms perception cycle or the next one. The vehicle never waits -- it uses its on-vehicle results immediately and integrates edge results when they arrive, which is typically within 1 cycle.

---

## 5. Split Inference Patterns

### 5.1 Pattern A: Full Offload

```
VEHICLE                    NETWORK                EDGE SERVER
┌────────────┐             ┌────────┐             ┌────────────────┐
│ Raw LiDAR  │────────────>│  5G UL │────────────>│ Full model     │
│ (200-500KB │  16-40 Mbps │ 5-15ms │             │ inference      │
│  per frame)│             └────────┘             │ (PointPillars  │
│            │                                    │  + PTv3 + VLM  │
│ Wait for   │<────────────┐────────┐<────────────│  + world model)│
│ results... │  1-5 Mbps   │  5G DL │             │                │
│            │             │ 5-15ms │             │ 50-200ms       │
└────────────┘             └────────┘             └────────────────┘

Total latency: 60-230ms
Bandwidth: 16-40 Mbps UL per vehicle
```

**Use case:** Not for real-time safety perception. Viable only for:
- Batch auto-labeling of recorded data (upload during depot charging)
- Post-hoc analytics on full sensor streams
- Shadow-mode evaluation of new models against on-vehicle results

**Advantages:** Simplest vehicle-side code. Edge runs any model without vehicle changes.
**Disadvantages:** Highest bandwidth. Highest latency. Vehicle cannot act until results return. Single point of failure if network drops.

**Verdict:** Use for data pipeline and analytics only. Never for safety-relevant perception.

### 5.2 Pattern B: Feature Offload (Split Backbone-Head)

```
VEHICLE                    NETWORK                EDGE SERVER
┌────────────┐             ┌────────┐             ┌────────────────┐
│ LiDAR      │             │        │             │                │
│ preprocess  │             │        │             │                │
│   ↓         │             │        │             │                │
│ Backbone   │             │        │             │                │
│ (pillars/  │             │        │             │                │
│  voxels)   │             │        │             │                │
│   ↓         │             │        │             │                │
│ BEV feats  │────────────>│  5G UL │────────────>│ Foundation head│
│ (50-200KB) │  4-16 Mbps  │ 5-15ms │             │ (PTv3 decoder) │
│            │             └────────┘             │   ↓             │
│ Meanwhile: │                                    │ VLM head       │
│ Safety det.│                                    │   ↓             │
│ (PP 6.84ms)│                                    │ World model    │
│ Frenet plan│<────────────┐────────┐<────────────│   ↓             │
│ CBF filter │  5-12 Mbps  │  5G DL │             │ Enhanced dets  │
│            │             │ 5-15ms │             │ + VLM output   │
│ Merge edge │             └────────┘             │ + predictions  │
│ results    │                                    │                │
└────────────┘                                    └────────────────┘

Total latency: 35-90ms
Bandwidth: 4-16 Mbps UL per vehicle
```

**This is the recommended primary pattern for reference airside AV stack.**

The vehicle runs its lightweight backbone (pillar/voxel encoding) and sends the resulting BEV feature map to the edge. The edge runs multiple heads on those features simultaneously: a high-accuracy detection head (PTv3 decoder), a VLM head for scene reasoning, and a world model head for future prediction.

Meanwhile, the vehicle runs its safety stack (PointPillars detection, Frenet planning, CBF filter) on the same raw data. The vehicle acts on its own results immediately. When edge results arrive (typically within the same or next 100ms cycle), they are fused with on-vehicle results using confidence-weighted merging.

```python
# Feature offload: vehicle-side ROS node (simplified)
import rospy
import numpy as np
import lz4.frame
from std_msgs.msg import Header
from sensor_msgs.msg import PointCloud2
from edge_msgs.msg import BEVFeatureMap, EdgeInferenceResult

class FeatureOffloadNode:
    """Extracts BEV features on-vehicle, sends to edge, fuses results."""

    def __init__(self):
        rospy.init_node('feature_offload')

        # On-vehicle backbone (TensorRT engine)
        self.backbone = TensorRTEngine('/models/pillar_backbone_int8.engine')

        # Publisher to edge (via rosbridge or custom UDP transport)
        self.feat_pub = rospy.Publisher(
            '/edge/bev_features', BEVFeatureMap, queue_size=1
        )

        # Subscriber for edge results
        self.edge_sub = rospy.Subscriber(
            '/edge/inference_result', EdgeInferenceResult,
            self.edge_result_cb, queue_size=1
        )

        # Local safety detections (from on-vehicle PointPillars)
        self.local_det_sub = rospy.Subscriber(
            '/perception/detections_3d', Detection3DArray,
            self.local_det_cb, queue_size=1
        )

        # Fused output
        self.fused_pub = rospy.Publisher(
            '/perception/fused_detections', Detection3DArray, queue_size=1
        )

        # State
        self.last_edge_result = None
        self.edge_result_age = float('inf')
        self.MAX_EDGE_AGE = 0.2  # 200ms - discard stale edge results

    def lidar_cb(self, msg):
        """Process LiDAR, extract features, send to edge."""
        t0 = rospy.Time.now()

        # 1. Voxelize point cloud (on-vehicle, ~3ms)
        pillars = self.voxelize(msg)

        # 2. Run backbone (on-vehicle, ~8ms)
        bev_features = self.backbone.infer(pillars)

        # 3. Compress and send to edge (~1ms)
        compressed = lz4.frame.compress(
            bev_features.astype(np.float16).tobytes()
        )

        feat_msg = BEVFeatureMap()
        feat_msg.header = msg.header
        feat_msg.data = compressed
        feat_msg.shape = list(bev_features.shape)
        feat_msg.vehicle_id = self.vehicle_id
        feat_msg.send_time = t0
        self.feat_pub.publish(feat_msg)

    def edge_result_cb(self, msg):
        """Receive enhanced detections from edge server."""
        latency = (rospy.Time.now() - msg.send_time).to_sec()
        self.last_edge_result = msg
        self.edge_result_age = 0.0
        rospy.logdebug(f"Edge result received, RTT={latency*1000:.1f}ms")

    def local_det_cb(self, local_dets):
        """Fuse local safety detections with edge-enhanced detections."""
        fused = Detection3DArray()
        fused.header = local_dets.header

        # Always include local detections (safety baseline)
        for det in local_dets.detections:
            det.source = "on_vehicle"
            fused.detections.append(det)

        # Merge edge results if fresh
        if (self.last_edge_result is not None and
                self.edge_result_age < self.MAX_EDGE_AGE):
            for edet in self.last_edge_result.detections:
                match = self.find_matching_detection(
                    edet, local_dets.detections
                )
                if match:
                    # Confidence-weighted merge of matched detections
                    merged = self.merge_detections(match, edet)
                    # Replace local with merged
                    self.replace_detection(fused, match, merged)
                else:
                    # Edge-only detection (new object not seen locally)
                    edet.source = "edge_only"
                    edet.confidence *= 0.8  # Discount edge-only slightly
                    fused.detections.append(edet)

        self.fused_pub.publish(fused)
```

### 5.3 Pattern C: Ensemble Augmentation

```
VEHICLE                                            EDGE SERVER
┌──────────────────────┐                           ┌──────────────────┐
│ LiDAR → PointPillars │ (6.84ms, safety baseline) │                  │
│         ↓             │                           │                  │
│ Detections_local     │                           │                  │
│         ↓             │                           │                  │
│ [BEV features]───────│──── 5G (50-200KB) ───────>│ PTv3 decoder     │
│                      │                           │ (15-30ms)        │
│ Frenet planning      │                           │         ↓         │
│ CBF filter           │                           │ Detections_edge  │
│         ↓             │                           │         ↓         │
│ Initial trajectory   │                           │ Enhanced_dets────│──> back to vehicle
│         ↓             │                           │                  │
│ FUSION: merge local  │<── 5G (10-20KB) ──────────│                  │
│ + edge detections    │                           │                  │
│         ↓             │                           │                  │
│ Updated trajectory   │                           │                  │
│ (if edge improves)   │                           │                  │
└──────────────────────┘                           └──────────────────┘
```

**Key design:** The vehicle runs its full safety stack and generates an initial trajectory. The edge runs a more accurate model on the same features. If the edge results arrive before the next planning cycle, the vehicle fuses them and may update its trajectory. If they arrive late or not at all, the vehicle has already acted safely on its own results.

**When edge disagrees with vehicle:**

```
Disagreement Resolution Matrix:

                        Edge says CLEAR         Edge says OBSTACLE
Vehicle says CLEAR      Both agree: proceed     CONSERVATIVE: treat as
                                                obstacle (edge may see
                                                more; reduce speed)

Vehicle says OBSTACLE   Keep obstacle           Both agree: obstacle
                        (vehicle is safety-     (highest confidence wins
                        critical authority)      for position/size)
```

The rule is simple: **any detection is real until proven otherwise**. If either the vehicle or edge reports an obstacle, the planner treats it as present. False positives cause unnecessary stops; false negatives cause collisions. The asymmetry favors safety.

### 5.4 Pattern D: Speculative Execution

```
Timeline within one 100ms cycle:

t=0ms     Vehicle receives LiDAR scan
t=5ms     Preprocessing complete
t=12ms    PointPillars detection complete → passed to planner
t=17ms    Frenet planning complete → trajectory generated
t=18ms    CBF filter applied → safe trajectory committed to actuators
          SIMULTANEOUSLY at t=5ms: BEV features sent to edge

t=55ms    Edge result arrives (typical)
t=56ms    Compare edge vs vehicle detections
t=57ms    If edge found NEW obstacle not in vehicle detections:
            → Insert into next planning cycle (t=100ms)
            → If critical (obstacle on current trajectory): trigger re-plan
          If edge refines existing detections (better position/size):
            → Update tracking state for next cycle
          If edge agrees with vehicle:
            → Confidence boost, no action needed

t=100ms   Next cycle begins with updated state
```

This pattern treats edge inference as speculative look-ahead. The vehicle never delays its own safety loop waiting for edge results. Edge corrections arrive asynchronously and are incorporated at the next opportunity.

**Implementation as a ROS callback-based pipeline:**

```python
class SpeculativeExecutionNode:
    """
    Asynchronous edge inference integration.
    Vehicle acts immediately on local results.
    Edge corrections applied to NEXT cycle.
    """

    def __init__(self):
        self.correction_buffer = []
        self.correction_lock = threading.Lock()

    def planning_cycle(self, local_detections, ego_state):
        """Main 10 Hz planning cycle (runs on-vehicle)."""
        # 1. Apply any pending edge corrections from previous cycle
        with self.correction_lock:
            corrected_dets = self.apply_corrections(
                local_detections, self.correction_buffer
            )
            self.correction_buffer.clear()

        # 2. Plan on corrected detections
        trajectory = self.frenet_planner.plan(corrected_dets, ego_state)

        # 3. Safety filter (always on-vehicle, never delayed)
        safe_trajectory = self.cbf_filter.apply(trajectory, corrected_dets)

        return safe_trajectory

    def edge_correction_cb(self, edge_result):
        """Async callback when edge results arrive (any time)."""
        latency = self.get_age(edge_result)
        if latency > 0.15:  # 150ms - too stale
            return

        with self.correction_lock:
            # Check if edge found something vehicle missed
            new_objects = self.find_novel_detections(edge_result)
            refined_objects = self.find_refined_detections(edge_result)

            for obj in new_objects:
                if obj.confidence > 0.5:  # Edge-only requires higher conf
                    self.correction_buffer.append(
                        Correction(type='ADD', detection=obj)
                    )

            for old, new in refined_objects:
                self.correction_buffer.append(
                    Correction(type='REFINE', old=old, new=new)
                )

            # CRITICAL: Check if correction is urgent
            # (new obstacle on current trajectory)
            for obj in new_objects:
                if self.is_on_current_trajectory(obj):
                    rospy.logwarn("Edge found obstacle on trajectory, "
                                 "triggering immediate re-plan")
                    self.trigger_immediate_replan()
```

### 5.5 Pattern E: Cooperative Fleet Fusion

```
     Vehicle A             Vehicle B             Vehicle C
    ┌─────────┐           ┌─────────┐           ┌─────────┐
    │ Backbone │           │ Backbone │           │ Backbone │
    │    ↓      │           │    ↓      │           │    ↓      │
    │ BEV feat │           │ BEV feat │           │ BEV feat │
    │ + pose   │           │ + pose   │           │ + pose   │
    └────┬─────┘           └────┬─────┘           └────┬─────┘
         │   5G UL              │   5G UL              │   5G UL
         │  (50-200 KB)         │  (50-200 KB)         │  (50-200 KB)
         └──────────┬───────────┴───────────┬──────────┘
                    │                       │
              ┌─────┴───────────────────────┴─────┐
              │         EDGE SERVER                │
              │                                    │
              │  1. Receive all vehicle features   │
              │  2. Ego-motion compensate           │
              │     (transform to common frame)    │
              │  3. Where2comm attention fusion     │
              │  4. Run detection/segmentation head │
              │  5. Generate fleet-level perception │
              │                                    │
              │  Processing: 20-40ms per cycle      │
              └─────┬───────────┬───────────┬──────┘
                    │           │           │
         ┌──────────┘           │           └──────────┐
         │   5G DL              │   5G DL              │   5G DL
         │  (50-100 KB)         │  (50-100 KB)         │  (50-100 KB)
    ┌────┴─────┐           ┌────┴─────┐           ┌────┴─────┐
    │ Vehicle A │           │ Vehicle B │           │ Vehicle C │
    │          │           │          │           │          │
    │ Fuse with│           │ Fuse with│           │ Fuse with│
    │ local    │           │ local    │           │ local    │
    │ dets     │           │ dets     │           │ dets     │
    └──────────┘           └──────────┘           └──────────┘
```

This extends the V2V cooperative perception architecture (see `collaborative-fleet-perception.md`) by centralizing the fusion on the edge server rather than requiring each vehicle to fuse with every other vehicle peer-to-peer. The edge server is the Where2comm aggregation point.

**Advantages over pure V2V:**
- Each vehicle sends features once (to edge) instead of N-1 times (to every other vehicle)
- Edge has more compute for attention-based fusion than any single Orin
- Edge can maintain global consistency (no conflicting pairwise fusions)
- Edge can incorporate infrastructure sensors (CCTV, SMR) in the same fusion

**Bandwidth efficiency:** With Where2comm's learned attention masks, each vehicle sends only the informative regions of its BEV feature map -- typically 50-200 KB per frame instead of the full 2-8 MB. The edge fuses all vehicles and returns a fleet-level perception result that each vehicle merges with its local detections. Per the Where2comm results, this achieves 95.3% of full raw-data sharing AP at 1/64 bandwidth (see finding 127 in CLAUDE.md).

### 5.6 Pattern Selection Guide

| Scenario | Recommended Pattern | Why |
|----------|-------------------|-----|
| Normal operations (stand approach) | B + C + E | Feature offload + ensemble + cooperative fusion |
| Taxiway transit (low complexity) | B + E (reduced rate) | Feature offload at 5 Hz, cooperative at 2 Hz |
| Turnaround (maximum complexity) | B + C + E (maximum rate) | All patterns active, all models at max rate |
| Degraded network (>50ms RTT) | C only (reduced rate) | Ensemble augmentation tolerates latency |
| Minimal network (<1 Mbps) | None (vehicle-only) | Fall back to on-vehicle safety stack |
| Data collection (depot/charging) | A | Full raw offload for auto-labeling |
| New airport (shadow mode) | A + B + C | All patterns for maximum data collection |

---

## 6. Airport Edge Server Architecture

### 6.1 Hardware Sizing by Fleet Scale

The edge server must handle concurrent inference requests from all active vehicles. The critical sizing parameter is not total TOPS but rather the number of concurrent model instances that can run without queuing.

| Fleet Size | Active Vehicles (peak) | GPU Requirement | Recommended Config | Estimated Cost |
|------------|----------------------|-----------------|-------------------|---------------|
| 10-20 | 15 | 2-4x A100 80GB | NVIDIA DGX Station A100 (4x A100) | $35,000-50,000 |
| 20-50 | 35 | 4-8x A100 80GB | NVIDIA DGX A100 (8x A100) | $100,000-150,000 |
| 50-100 | 70 | 2x DGX A100 or DGX H100 | DGX H100 (8x H100 80GB) | $200,000-400,000 |
| 100-200 | 140 | DGX SuperPOD (partial) | 2-4x DGX H100 | $500,000-1,000,000 |

**Detailed sizing for 20-vehicle fleet (reference airside AV stack near-term):**

```
Workload Analysis (20 vehicles, peak):
────────────────────────────────────────────────────────────────
Model               Per-Vehicle  Frequency  GPU ms/req  Total GPU-ms/s
────────────────────────────────────────────────────────────────
PTv3 detection head    1 req       10 Hz      20ms          4,000
VLM (InternVL2-7B)     1 req       2 Hz       50ms          2,000
World model            1 req       5 Hz       40ms          4,000
Cooperative fusion     1 req       10 Hz      15ms          3,000
Map update             1 req       1 Hz       30ms          600
Place recognition      1 req       0.5 Hz     15ms          150
UQ ensemble (M=5)      1 req       2 Hz       80ms          3,200
────────────────────────────────────────────────────────────────
TOTAL GPU-ms/s:                                             16,950

Available GPU-ms/s per A100: 1,000 (1 GPU, 1 second, accounting
  for overhead and memory transfers ≈ 85% utilization)

GPUs needed: 16,950 / 850 ≈ 20 GPU-seconds/second
           = 20 concurrent GPU-slots needed at peak
           = 4x A100 at ~5x concurrent streams via TensorRT
             (4 GPUs * 5 streams ≈ 20 effective slots)

Memory: 4x 80GB = 320 GB total HBM
  - Model weights shared across streams: ~25 GB
  - Per-stream activations: ~2 GB * 20 streams = 40 GB
  - KV cache for VLM: ~8 GB
  - Workspace: ~40 GB
  Total: ~113 GB (fits in 320 GB with headroom)

RECOMMENDATION: 4x A100 80GB (DGX Station or custom build)
```

### 6.2 Software Stack

```
┌─────────────────────────────────────────────────────────┐
│                    EDGE SERVER SOFTWARE STACK             │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │  FLEET MANAGEMENT LAYER                            │  │
│  │  - Vehicle registry and health monitoring          │  │
│  │  - Request prioritization (turnaround > transit)   │  │
│  │  - Load balancing across GPUs                      │  │
│  │  - Result caching and broadcast                    │  │
│  └───────────────────────────┬───────────────────────┘  │
│                               │                          │
│  ┌───────────────────────────┴───────────────────────┐  │
│  │  NVIDIA TRITON INFERENCE SERVER                    │  │
│  │  - Model repository (TensorRT engines)             │  │
│  │  - Dynamic batching (across vehicles)              │  │
│  │  - Model versioning and A/B testing                │  │
│  │  - GPU scheduling and resource isolation           │  │
│  │  - Health checks and auto-restart                  │  │
│  │  - Prometheus metrics export                       │  │
│  └───────────────────────────┬───────────────────────┘  │
│                               │                          │
│  ┌───────────────────────────┴───────────────────────┐  │
│  │  GPU RUNTIME                                       │  │
│  │  - TensorRT 10.x engines (FP16/INT8)              │  │
│  │  - CUDA 12.x + cuDNN 9.x                          │  │
│  │  - MPS (Multi-Process Service) for isolation       │  │
│  │  - CUDA streams for concurrent execution           │  │
│  └───────────────────────────┬───────────────────────┘  │
│                               │                          │
│  ┌───────────────────────────┴───────────────────────┐  │
│  │  INFRASTRUCTURE                                    │  │
│  │  - Kubernetes (K3s for single-node, K8s for multi) │  │
│  │  - Container runtime: NVIDIA Container Toolkit      │  │
│  │  - Storage: NVMe SSD for model repo + result cache │  │
│  │  - Networking: SR-IOV for direct NIC-to-container   │  │
│  │  - Monitoring: Prometheus + Grafana                 │  │
│  │  - Logging: Loki for structured inference logs      │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  OS: Ubuntu 22.04 LTS + NVIDIA Driver 550+              │
│  Hardware: DGX Station A100 or custom 4U server          │
└─────────────────────────────────────────────────────────┘
```

**NVIDIA Triton Inference Server** is the centerpiece. It provides:

1. **Dynamic batching**: When multiple vehicles submit BEV features within a short window, Triton batches them into a single GPU call. This is the primary efficiency mechanism -- batching 4 vehicles' features into one PTv3 forward pass costs ~30ms instead of 4x20ms = 80ms sequential.

2. **Model ensemble pipelines**: Chain backbone → detection head → VLM head as a single request, minimizing data movement.

3. **Concurrent model execution**: Different models run on different CUDA streams. While the VLM processes vehicle A's request, the detection head processes vehicle B's features.

4. **Model versioning**: Deploy new model versions alongside existing ones. Route a subset of vehicles (canary) to the new version while monitoring accuracy.

### 6.3 Dynamic Batching Configuration

```python
# Triton model configuration for edge server
# File: model_repository/ptv3_detection_head/config.pbtxt

name: "ptv3_detection_head"
platform: "tensorrt_plan"
max_batch_size: 8  # Batch up to 8 vehicles' features

# Dynamic batching: wait up to 5ms to collect a batch
dynamic_batching {
  preferred_batch_size: [4, 8]
  max_queue_delay_microseconds: 5000
  priority_levels: 3
  default_priority_level: 2
  # Priority 1: runway crossing vehicles
  # Priority 2: stand approach vehicles
  # Priority 3: taxiway transit vehicles
}

# Input: BEV feature map from vehicle backbone
input [
  {
    name: "bev_features"
    data_type: TYPE_FP16
    dims: [256, 200, 200]  # C x H x W BEV grid
  },
  {
    name: "ego_pose"
    data_type: TYPE_FP32
    dims: [4, 4]  # 4x4 transformation matrix
  }
]

# Output: 3D detections
output [
  {
    name: "boxes_3d"
    data_type: TYPE_FP32
    dims: [-1, 9]  # N x (x,y,z,w,l,h,yaw,vel_x,vel_y)
  },
  {
    name: "scores"
    data_type: TYPE_FP32
    dims: [-1]
  },
  {
    name: "labels"
    data_type: TYPE_INT32
    dims: [-1]
  }
]

instance_group [
  {
    count: 2  # 2 instances on GPU 0
    kind: KIND_GPU
    gpus: [0]
  },
  {
    count: 2  # 2 instances on GPU 1
    kind: KIND_GPU
    gpus: [1]
  }
]
```

### 6.4 Redundancy and Failover

**The edge server is an enhancement, not a dependency.** Its failure mode is simple: vehicles revert to on-vehicle-only operation. However, for availability, redundancy is still important because the edge provides significant safety enhancements (cooperative perception, VLM anomaly detection).

```
PRIMARY EDGE SERVER              SECONDARY EDGE SERVER
┌─────────────────────┐          ┌─────────────────────┐
│  DGX Station A100   │          │  DGX Station A100   │
│  4x A100 80GB       │◄────────►│  4x A100 80GB       │
│                     │ heartbeat │                     │
│  Active             │  (1 Hz)   │  Hot standby        │
│  - Serving requests │          │  - Models loaded     │
│  - State replicated │          │  - Ready to serve    │
│    to standby       │          │  - No GPU active     │
└─────────────────────┘          └─────────────────────┘

Failover scenarios:
1. Primary healthy: secondary idle, models pre-loaded in GPU memory
2. Primary degraded (GPU failure): secondary promotes to active (<5s)
3. Primary down: secondary active, vehicles experience 1-5s edge gap
   (during gap: vehicle operates fully autonomously — transparent)
4. Both down: all vehicles fully autonomous, alert sent to ops center
```

For cost-sensitive deployments, the secondary can be a smaller server (2x A100) that handles reduced models (cooperative perception + detection only, no VLM or world model) during failover. This halves the redundancy cost while maintaining the most safety-relevant edge functions.

### 6.5 Physical Deployment

The edge server is physically co-located with the airport's 5G MEC infrastructure to minimize network hops:

```
Typical Airport Network Topology:

      Airport Operations Center
              │
              │ Fiber (1-10 Gbps)
              │
    ┌─────────┴──────────┐
    │  Airport Data Center│
    │  (Terminal Building) │
    │                     │
    │  ┌───────────────┐  │
    │  │ 5G Core (UPF) │  │    UPF = User Plane Function
    │  └───────┬───────┘  │    (where data plane terminates)
    │          │           │
    │  ┌───────┴───────┐  │
    │  │ EDGE SERVER   │  │ ← Co-located with UPF
    │  │ (DGX Station) │  │    1 hop from radio
    │  └───────────────┘  │    <2ms additional latency
    │                     │
    └──────────┬──────────┘
               │ Fiber
    ┌──────────┴──────────┐
    │  5G Radio Units      │
    │  (gNodeB / small     │
    │   cells on apron)    │
    └──────────┬──────────┘
               │ 5G NR (air interface)
    ┌──────────┴──────────┐
    │  Vehicle 5G Modem    │
    │  (Cradlepoint/Sierra │
    │   Wireless)          │
    └─────────────────────┘

Network path: Vehicle → 5G air (1-3ms) → gNodeB → Fiber → UPF (1ms) → Edge Server
Total: 2-4ms one-way network latency
```

**Environmental requirements:**
- Power: 2-6 kW per DGX Station (dedicated 30A/240V circuit)
- Cooling: 2-6 kW heat dissipation (airport data centers typically have this)
- Physical security: locked rack in controlled-access data center
- UPS: minimum 30 minutes backup (allows vehicles to transition to autonomous mode)
- Network: dual 25/100 GbE uplinks to 5G UPF

---

## 7. Graceful Degradation When Network Fails

### 7.1 Network Failure Is Expected

Network failure on an airport apron is not exceptional -- it is a routine operating condition:

| Failure Mode | Frequency | Duration | Cause |
|-------------|-----------|----------|-------|
| Coverage gap | Daily | 5-30s | Vehicle enters shadowed area behind hangar |
| Handover hiccup | Hourly | 50-200ms | Vehicle transitions between 5G cells |
| Congestion spike | Peak hours | 1-30s | Many vehicles near same stand during turnaround |
| Weather interference | Seasonal | Minutes-hours | Heavy rain attenuates mmWave; sub-6 more resistant |
| Planned maintenance | Monthly | 30-120 min | 5G equipment firmware updates |
| Equipment failure | Rare | Hours | gNodeB or switch failure |
| Construction | During works | Days | Terminal construction alters RF environment |
| RF interference | Unpredictable | Seconds-minutes | Radar, ILS, other airport RF sources |

The system must handle all of these without any discontinuity in safe vehicle operation.

### 7.2 Degradation Levels

```
NETWORK STATE MACHINE:

    ┌────────────────────────────────────────────────────────────────────┐
    │                                                                    │
    │   FULL           DEGRADED          MINIMAL          OFFLINE        │
    │   ┌──────┐       ┌──────┐          ┌──────┐         ┌──────┐      │
    │   │ RTT  │       │ RTT  │          │ RTT  │         │ No   │      │
    │   │<20ms │──────>│20-100│─────────>│>100ms│────────>│ conn.│      │
    │   │>10Mb │ degr. │ ms   │ further  │<1Mbps│ total   │      │      │
    │   │      │       │1-10  │ degrad.  │      │ loss    │      │      │
    │   │      │<──────│ Mbps │<─────────│      │<────────│      │      │
    │   └──────┘ recov └──────┘ recovery └──────┘ recovery└──────┘      │
    │                                                                    │
    │   Recovery requires sustained good conditions for 5+ seconds       │
    │   (asymmetric transition: fast degradation, slow recovery)         │
    └────────────────────────────────────────────────────────────────────┘
```

### 7.3 Capability Matrix by Network State

| Capability | FULL | DEGRADED | MINIMAL | OFFLINE |
|-----------|------|----------|---------|---------|
| On-vehicle safety stack | Full (10 Hz) | Full (10 Hz) | Full (10 Hz) | Full (10 Hz) |
| Edge detection enhancement | Full (10 Hz) | Reduced (5 Hz) | Off | Off |
| VLM co-pilot | Full (2 Hz) | Reduced (0.5 Hz) | Off | Off |
| World model prediction | Full (5 Hz) | Reduced (2 Hz) | Off | Off |
| Cooperative perception | Full (10 Hz) | Reduced (5 Hz) | Safety msgs only | Off |
| Map updates | Full (1 Hz) | Reduced (0.2 Hz) | Off | Off |
| Fleet state | Full (1 Hz) | Reduced (0.2 Hz) | Off | Off |
| Auto-labeling | Background | Off | Off | Off |
| V2X safety messages | Full | Full | **Full** (prioritized) | Off (PC5 sidelink) |
| Max speed | 25 km/h | 20 km/h | 15 km/h | 10 km/h |
| Safety margins | Standard | +20% | +50% | +100% (doubled) |
| Teleop available | Yes | Yes | Voice-only | No |

### 7.4 The Simplex Analogy

The edge-cloud architecture mirrors the Simplex fault-tolerance pattern already used in the reference airside AV stack's planning stack:

```
Simplex Pattern for Planning:
  Advanced Controller (AC): Neural planner (better performance)
  Baseline Controller (BC): Frenet planner (proven safe)
  Decision Module (DM): CBF safety filter decides which to use

Edge-Cloud Simplex Pattern:
  Advanced Controller (AC): Edge-enhanced perception (better accuracy)
  Baseline Controller (BC): On-vehicle perception (proven safe)
  Decision Module (DM): Freshness + confidence check decides which to use

                    ┌─────────────────────┐
                    │   DECISION MODULE    │
                    │                     │
                    │  if edge_result is  │
                    │    fresh (<200ms)   │
                    │    AND consistent   │
                    │    with local:      │
                    │    → use FUSED      │
                    │  else:             │
                    │    → use LOCAL ONLY │
                    │                     │
                    └──────┬──────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
     ┌────────┴────────┐      ┌────────┴────────┐
     │ AC: Edge-Enhanced│      │ BC: On-Vehicle   │
     │ Perception        │      │ Perception        │
     │                  │      │                  │
     │ • PTv3 accuracy  │      │ • PointPillars   │
     │ • VLM reasoning  │      │ • FlatFormer     │
     │ • Fleet fusion   │      │ • nvblox         │
     │ • World model    │      │ • Basic tracking │
     │                  │      │                  │
     │ Performance: ★★★★★│      │ Performance: ★★★ │
     │ Availability: 95% │      │ Availability: 100%│
     └──────────────────┘      └──────────────────┘
```

### 7.5 Seamless Transition Implementation

The transition between network states must be invisible to the planning and control layers. They always receive detections from the same topic -- the fusion node handles the switching internally.

```python
class GracefulDegradationNode:
    """
    Monitors network health and adjusts edge utilization.
    Provides seamless perception output regardless of network state.
    """

    # Network state thresholds
    FULL_RTT = 0.020        # <20ms
    DEGRADED_RTT = 0.100    # <100ms
    MINIMAL_BW = 1_000_000  # 1 Mbps

    # Recovery hysteresis
    RECOVERY_HOLD = 5.0     # 5 seconds of good before upgrading state

    def __init__(self):
        self.state = NetworkState.FULL
        self.last_edge_result_time = rospy.Time.now()
        self.rtt_ewma = 0.010  # Exponential weighted moving average
        self.rtt_alpha = 0.3   # Smoothing factor
        self.recovery_timer = 0.0

        # Cache of last known good edge results
        self.cached_edge_detections = None
        self.cached_cooperative_map = None
        self.cached_vlm_description = None
        self.cached_world_prediction = None

    def update_network_state(self, measured_rtt, measured_bw):
        """Called on each edge response (or timeout)."""
        self.rtt_ewma = (self.rtt_alpha * measured_rtt +
                         (1 - self.rtt_alpha) * self.rtt_ewma)

        new_state = self._classify_state(self.rtt_ewma, measured_bw)

        # Fast degradation, slow recovery
        if new_state.value > self.state.value:
            # Degrading: switch immediately
            self.state = new_state
            self.recovery_timer = 0.0
            self._adjust_edge_requests()
            rospy.logwarn(f"Network degraded to {self.state.name}")

        elif new_state.value < self.state.value:
            # Recovering: require sustained good conditions
            self.recovery_timer += self.dt
            if self.recovery_timer >= self.RECOVERY_HOLD:
                self.state = new_state
                self.recovery_timer = 0.0
                self._adjust_edge_requests()
                rospy.loginfo(f"Network recovered to {self.state.name}")

    def get_fused_perception(self, local_detections):
        """
        Returns best available perception regardless of network state.
        The planner/controller never knows (or cares) about network state.
        """
        if self.state == NetworkState.FULL:
            return self._fuse_local_and_edge(
                local_detections,
                self.cached_edge_detections,
                max_age=0.2
            )
        elif self.state == NetworkState.DEGRADED:
            return self._fuse_local_and_edge(
                local_detections,
                self.cached_edge_detections,
                max_age=0.5  # Accept slightly staler edge results
            )
        else:
            # MINIMAL or OFFLINE: local only
            return local_detections

    def _adjust_edge_requests(self):
        """Reduce edge request rate based on network state."""
        rates = {
            NetworkState.FULL:     {'det': 10, 'vlm': 2, 'wm': 5, 'coop': 10},
            NetworkState.DEGRADED: {'det': 5,  'vlm': 0.5, 'wm': 2, 'coop': 5},
            NetworkState.MINIMAL:  {'det': 0,  'vlm': 0, 'wm': 0, 'coop': 0},
            NetworkState.OFFLINE:  {'det': 0,  'vlm': 0, 'wm': 0, 'coop': 0},
        }
        for model, rate in rates[self.state].items():
            self.set_edge_request_rate(model, rate)
```

### 7.6 Edge Result Staleness Management

When the network degrades, the vehicle may still have recent edge results that remain valid. The validity window depends on the type of result and the vehicle's speed:

| Edge Result Type | Freshness Window | Rationale |
|-----------------|-----------------|-----------|
| Detection enhancement | 100-200ms | Objects move; stale detections may mislocate |
| VLM scene description | 2-5s | Scene semantics change slowly |
| World model prediction | 500ms-2s | Predictions are inherently future-looking |
| Cooperative perception | 100-200ms | Other vehicles move |
| Map updates | 30-60s | Map changes are slow |
| Fleet state | 5-10s | Fleet-level coordination is coarse-grained |
| Neural map prior | Minutes-hours | Map priors are quasi-static |

At 10 km/h (typical apron speed), a vehicle moves 2.8 m/s. A 200ms-stale detection is off by ~0.56m -- within the safety margin for most obstacles but problematic for precision docking. The staleness window should be proportional to the required positional accuracy.

---

## 8. Security and Privacy

### 8.1 Threat Model

Data transmitted over the airport wireless network faces several threat categories:

```
THREAT MODEL FOR EDGE-CLOUD INFERENCE:

┌──────────────────────────────────────────────────────────────┐
│ THREAT 1: Eavesdropping                                       │
│ Attacker intercepts sensor data or model outputs              │
│ Risk: Exposure of airport layout, operational patterns        │
│ Mitigation: TLS 1.3 for all vehicle-edge communication       │
├──────────────────────────────────────────────────────────────┤
│ THREAT 2: Man-in-the-middle (injection)                       │
│ Attacker injects false edge results (phantom detections)      │
│ Risk: Vehicle stops unnecessarily or ignores real obstacles   │
│ Mitigation: Mutual TLS (mTLS) + signed inference results     │
│            + consistency check with on-vehicle detections     │
├──────────────────────────────────────────────────────────────┤
│ THREAT 3: Denial of service                                   │
│ Attacker floods 5G network, preventing edge communication     │
│ Risk: Loss of edge enhancement (vehicles go autonomous)       │
│ Mitigation: 5G network slicing + graceful degradation         │
│            (vehicles are safe without edge — by design)       │
├──────────────────────────────────────────────────────────────┤
│ THREAT 4: Model extraction                                    │
│ Attacker probes edge server to extract model weights          │
│ Risk: IP theft, competitive intelligence                      │
│ Mitigation: Triton access control, API-only access            │
│            (no direct GPU access), rate limiting               │
├──────────────────────────────────────────────────────────────┤
│ THREAT 5: Data poisoning via vehicle                          │
│ Compromised vehicle sends corrupted features to edge          │
│ Risk: Degrades cooperative perception for all vehicles        │
│ Mitigation: Per-vehicle authentication, anomaly detection     │
│            on input features, Byzantine-robust fusion          │
│            (see federated-learning-fleet-scale.md FLTrust)    │
├──────────────────────────────────────────────────────────────┤
│ THREAT 6: Multi-tenant data leakage                           │
│ Edge server serves multiple airlines/handlers at same airport │
│ Risk: Cross-tenant data exposure                              │
│ Mitigation: Kubernetes namespace isolation, separate model     │
│            instances per tenant, no shared caches              │
└──────────────────────────────────────────────────────────────┘
```

### 8.2 Encryption and Authentication

All vehicle-to-edge communication runs over mTLS (mutual Transport Layer Security):

```
Vehicle                          Edge Server
┌──────────┐                     ┌──────────┐
│ Vehicle   │                     │ Server   │
│ cert (X.509)                   │ cert (X.509)
│ signed by │                     │ signed by │
│ fleet CA  │                     │ fleet CA  │
│          │ ──── TLS 1.3 ──── │          │
│ Verifies │  ClientHello +     │ Verifies │
│ server   │  CertificateVerify │ vehicle  │
│ identity │                     │ identity │
└──────────┘                     └──────────┘

Certificate management:
- Fleet CA: reference airside AV stack-operated, issues certs to vehicles and edge servers
- Vehicle cert: Stored in Orin's secure element (if available) or TPM
- Rotation: Certificates rotate every 90 days via OTA
- Revocation: Compromised vehicle cert revoked immediately; vehicle
  continues operating autonomously but cannot access edge
```

### 8.3 Model IP Protection

Model weights on the edge server represent significant IP. Protection strategies:

1. **No weight download**: Vehicles send features and receive results. They never receive model weights. The edge exposes an inference API only.

2. **Triton access control**: Each vehicle has a unique API key. Requests are rate-limited (no more than 10 Hz per model per vehicle). Anomalous request patterns trigger alerts.

3. **Obfuscated outputs**: Edge returns final detections (boxes, scores, labels) rather than intermediate representations. An attacker cannot reverse-engineer the model architecture from bounding boxes.

4. **Physical security**: Edge server is in a locked airport data center with badge access, CCTV, and tamper detection.

### 8.4 Multi-Tenant Isolation

Large airports serve multiple ground handling companies. If the edge server is shared:

```
Edge Server Multi-Tenancy:

┌────────────────────────────────────────────────┐
│  Kubernetes Cluster                             │
│                                                 │
│  ┌──────────────┐   ┌──────────────┐           │
│  │ Namespace:    │   │ Namespace:    │           │
│  │ airside_av       │   │ handler-b     │           │
│  │              │   │              │           │
│  │ Triton (GPU0,│   │ Triton (GPU2,│           │
│  │         GPU1)│   │         GPU3)│           │
│  │              │   │              │           │
│  │ Models: v2.3 │   │ Models: v1.8 │           │
│  │ Vehicles:    │   │ Vehicles:    │           │
│  │   third-generation tug-001   │   │   TRACTOR-X  │           │
│  │   third-generation tug-002   │   │   TRACTOR-Y  │           │
│  │   ...        │   │   ...        │           │
│  └──────────────┘   └──────────────┘           │
│                                                 │
│  GPU isolation: MIG (Multi-Instance GPU) or     │
│  time-sharing with strict scheduling             │
│  Network isolation: Calico network policies     │
│  Storage isolation: Separate PVCs                │
│  No shared state between namespaces              │
└────────────────────────────────────────────────┘
```

### 8.5 Regulatory Compliance

| Regulation | Requirement | Edge-Cloud Implication |
|-----------|-------------|----------------------|
| GDPR (EU) | Data minimization, purpose limitation | Feature maps (not raw camera) minimize personal data; edge processes and discards |
| EU AI Act | High-risk AI system transparency | Audit logs of every edge inference decision |
| Airport security (ICAO Annex 17) | Screening of all equipment entering restricted area | Edge server undergoes airport security assessment |
| NIS2 Directive (EU) | Cybersecurity for critical infrastructure | Edge server treated as critical infrastructure element |
| Data sovereignty (varies) | Data may not leave country/airport | Edge server physically at airport; cloud in same jurisdiction |
| FAA CertAlert 24-02 | Autonomous vehicle safety requirements | Edge enhancement documented in safety case as non-safety-critical |

---

## 9. Cost-Benefit Analysis

### 9.1 Edge Server vs. Vehicle Upgrade

The fundamental economic question: is it cheaper to add a shared edge server or upgrade every vehicle's on-board compute?

**Option A: Edge Server (shared infrastructure)**

| Component | 20-Vehicle Fleet | 50-Vehicle Fleet | 100-Vehicle Fleet |
|-----------|-----------------|-----------------|-------------------|
| Edge hardware (4x A100) | $50,000 | $120,000 | $300,000 |
| Redundancy (secondary) | $30,000 | $70,000 | $200,000 |
| 5G vehicle modems (per vehicle) | $10,000 ($500 ea.) | $25,000 ($500 ea.) | $50,000 ($500 ea.) |
| Installation + integration | $15,000 | $25,000 | $40,000 |
| Software development | $40,000 | $40,000 | $40,000 |
| Annual maintenance (HW + SW) | $15,000 | $25,000 | $50,000 |
| Annual power + cooling | $3,000 | $7,000 | $15,000 |
| **Total Year 1** | **$163,000** | **$312,000** | **$695,000** |
| **Per vehicle Year 1** | **$8,150** | **$6,240** | **$6,950** |
| **Annual ongoing per vehicle** | **$900** | **$640** | **$650** |

**Option B: On-Vehicle Upgrade (per-vehicle compute)**

| Component | Per Vehicle | 20 Vehicles | 50 Vehicles | 100 Vehicles |
|-----------|------------|-------------|-------------|--------------|
| Orin → Thor module | $2,000-5,000 | $40K-100K | $100K-250K | $200K-500K |
| Carrier board redesign | $500-1,500 | $10K-30K | $25K-75K | $50K-150K |
| Thermal redesign | $300-800 | $6K-16K | $15K-40K | $30K-80K |
| Power supply upgrade (60W→130W) | $200-500 | $4K-10K | $10K-25K | $20K-50K |
| Integration + testing per vehicle | $1,000-2,000 | $20K-40K | $50K-100K | $100K-200K |
| Software port (Ampere→Blackwell) | $20,000 (one-time) | $20K | $20K | $20K |
| **Total** | **$4K-10K** | **$100K-216K** | **$220K-510K** | **$420K-1M** |
| **Per vehicle** | **$4K-10K** | **$5K-10.8K** | **$4.4K-10.2K** | **$4.2K-10K** |

**Key comparison:**

```
COST PER VEHICLE TO ACHIEVE EQUIVALENT CAPABILITY:

                  Edge Server          Vehicle Upgrade (Thor)
                  ──────────           ──────────────────────
20 vehicles:      $8,150 Y1            $5,000-10,800
50 vehicles:      $6,240 Y1            $4,400-10,200
100 vehicles:     $6,950 Y1            $4,200-10,000

Year 2+:          $900/vehicle/yr      $0 (hardware paid)

5-YEAR TCO PER VEHICLE:
20 vehicles:      $11,750              $5,000-10,800
50 vehicles:      $8,800               $4,400-10,200
100 vehicles:     $9,550               $4,200-10,000
```

At first glance, per-vehicle upgrade appears cheaper over 5 years. However, the edge approach offers advantages not captured in raw cost:

### 9.2 Non-Monetary Advantages of Edge

| Factor | Edge Server | Vehicle Upgrade |
|--------|------------|-----------------|
| **Time to deploy** | 4-6 weeks (one server) | 6-12 months (retrofit fleet) |
| **Model update speed** | Minutes (update edge server) | Weeks (OTA to fleet) |
| **Model size limit** | 80 GB HBM (A100) per model | 64 GB unified (Orin/Thor shared) |
| **Fleet-wide consistency** | All vehicles get same model version instantly | Staggered rollout, version fragmentation |
| **Cooperative perception** | Natural (all features at edge) | Requires peer-to-peer V2V (complex) |
| **Experimentation velocity** | Run A/B tests on edge instantly | Each experiment requires OTA cycle |
| **Hardware refresh** | Replace 1 server, fleet benefits | Replace every vehicle's compute |
| **Power on vehicle** | No additional vehicle power draw | +70W per vehicle (Thor vs Orin) |
| **Vehicle complexity** | No vehicle HW changes | Carrier board, thermal, power redesign |
| **VLM capability** | 7B+ parameter models feasible | 2B max on Orin, ~4B on Thor |

### 9.3 The Hybrid Answer

The optimal strategy is not either/or but both:

1. **Today (Orin fleet):** Deploy edge server to unlock VLM, world model, cooperative perception capabilities that Orin cannot run locally. Cost: $50-150K for the first airport.

2. **Future (Thor upgrade cycle):** When vehicles naturally reach hardware refresh (3-5 year cycle), upgrade to Thor. Thor handles more on-vehicle but edge still provides fleet fusion, VLM 7B+, and faster experimentation.

3. **Multi-airport scale:** Edge infrastructure at each airport, cloud for cross-airport training and federation. Edge cost amortizes as fleet grows.

### 9.4 ROI Calculation

```
SCENARIO: 20-vehicle fleet, first airport

COSTS (Year 1):
  Edge server (4x A100 + redundancy):        $80,000
  5G modems (20 vehicles):                    $10,000
  Integration + software:                     $55,000
  Annual maintenance:                         $18,000
  ─────────────────────────────────────────────────────
  Total Year 1:                               $163,000

BENEFITS (Year 1):
  VLM anomaly detection:
    Prevents 2-3 incidents/year at $50K avg.   $100,000-150,000

  Cooperative perception:
    +18-22% detection AP → fewer safety events
    Prevents 1-2 near-misses/year              $50,000-100,000

  World model prediction:
    Smoother planning → 5-10% efficiency gain
    20 vehicles * 16hr/day * 5% more missions  $75,000-150,000

  Faster model iteration:
    Edge A/B testing saves 2-4 weeks/quarter
    Engineering time saved                     $40,000-80,000

  ─────────────────────────────────────────────────────
  Total Year 1 benefit:                        $265,000-480,000

  NET YEAR 1:                                  $102,000-317,000 positive
  PAYBACK PERIOD:                              4-8 months
```

### 9.5 Multi-Airport Edge Economics

| Airport # | Edge Server Cost | Incremental Vehicles | Per-Vehicle Edge Cost (Y1) |
|-----------|-----------------|---------------------|--------------------------|
| 1st (hub) | $163,000 | 20 | $8,150 |
| 2nd (hub) | $130,000 (copy playbook) | 30 | $4,333 |
| 3rd (regional) | $80,000 (smaller server) | 10 | $8,000 |
| 4th (regional) | $80,000 | 10 | $8,000 |
| 5th+ | $60,000 (standardized) | 10-20 | $3,000-6,000 |

Edge software and model management is developed once and deployed to each airport. Subsequent airports benefit from the first airport's development investment.

---

## 10. Integration with Existing reference airside AV stack Systems

### 10.1 ROS Noetic Integration Architecture

The reference airside AV stack runs ROS Noetic. The edge server does not run ROS -- it runs NVIDIA Triton. The bridge between them uses a lightweight transport layer.

```
ON-VEHICLE (ROS Noetic)                    EDGE SERVER (Non-ROS)
┌─────────────────────────┐                ┌─────────────────────┐
│                         │                │                     │
│ /lidar/merged           │                │  NVIDIA Triton      │
│     ↓                    │                │  Inference Server   │
│ /perception/backbone     │                │                     │
│     ↓                    │                │  gRPC endpoint:     │
│ /edge/bev_features      │   gRPC/HTTP2   │  edge-server:8001   │
│     ↓                    │ ─────────────> │                     │
│ edge_client_node         │                │  Process request    │
│ (ROS node that sends     │                │  Return results     │
│  features via gRPC)      │                │                     │
│                         │   gRPC/HTTP2   │                     │
│ edge_result_node         │ <───────────── │                     │
│ (ROS node that receives  │                │                     │
│  and publishes results)  │                │                     │
│     ↓                    │                │                     │
│ /edge/detections_3d     │                │                     │
│ /edge/vlm_description   │                │                     │
│ /edge/world_prediction  │                │                     │
│     ↓                    │                │                     │
│ /perception/fused_dets  │                │                     │
│                         │                │                     │
└─────────────────────────┘                └─────────────────────┘
```

**Why not rosbridge_server?** Rosbridge (WebSocket-based) adds 2-5ms serialization overhead and does not support binary data efficiently. For high-throughput, low-latency communication, a direct gRPC client is superior. The Triton client library (tritonclient) provides both gRPC and HTTP interfaces with native numpy/tensor support.

### 10.2 Edge Client ROS Node

```python
#!/usr/bin/env python3
"""
edge_inference_client.py - ROS node for edge server communication.

Subscribes to on-vehicle BEV features, sends to edge Triton server,
publishes results back to ROS topics.

Dependencies: tritonclient[grpc], rospy, numpy, lz4
"""

import rospy
import numpy as np
import threading
import time
import lz4.frame
import tritonclient.grpc as triton_grpc

from sensor_msgs.msg import PointCloud2
from std_msgs.msg import String
from geometry_msgs.msg import PoseStamped
# Custom message types (would be defined in edge_msgs package)
# from edge_msgs.msg import BEVFeatureMap, Detection3DArray, VLMResult


class EdgeInferenceClient:
    """
    Asynchronous edge inference client.
    Sends features to Triton, receives results without blocking
    the on-vehicle perception pipeline.
    """

    def __init__(self):
        rospy.init_node('edge_inference_client')

        # Parameters
        self.edge_url = rospy.get_param(
            '~edge_server_url', 'edge-server.local:8001'
        )
        self.vehicle_id = rospy.get_param('~vehicle_id', 'third-generation tug-001')
        self.enable_vlm = rospy.get_param('~enable_vlm', True)
        self.enable_world_model = rospy.get_param('~enable_world_model', True)

        # Triton client (gRPC, async)
        self.triton_client = triton_grpc.InferenceServerClient(
            url=self.edge_url,
            verbose=False
        )

        # Check server health
        if not self.triton_client.is_server_live():
            rospy.logwarn("Edge server not reachable, starting in "
                          "offline mode")
            self.connected = False
        else:
            self.connected = True
            rospy.loginfo(f"Connected to edge server at {self.edge_url}")

        # Subscribers
        self.bev_sub = rospy.Subscriber(
            '/perception/bev_features', PointCloud2,
            self.bev_feature_cb, queue_size=1
        )
        self.pose_sub = rospy.Subscriber(
            '/localization/pose', PoseStamped,
            self.pose_cb, queue_size=1
        )

        # Publishers (edge results)
        self.edge_det_pub = rospy.Publisher(
            '/edge/detections_3d', PointCloud2, queue_size=1
        )
        self.edge_vlm_pub = rospy.Publisher(
            '/edge/vlm_description', String, queue_size=1
        )

        # Latency tracking
        self.rtt_history = []
        self.rtt_pub = rospy.Publisher(
            '/edge/rtt_ms', String, queue_size=1
        )

        # Async inference thread pool
        self.executor = threading.ThreadPoolExecutor(max_workers=4)

        # Health monitoring
        self.health_timer = rospy.Timer(
            rospy.Duration(1.0), self.health_check_cb
        )

    def bev_feature_cb(self, msg):
        """Non-blocking: submit edge inference request."""
        if not self.connected:
            return

        # Submit async (does not block this callback)
        self.executor.submit(self._run_edge_inference, msg)

    def _run_edge_inference(self, feature_msg):
        """Run on thread pool. Sends to Triton, publishes result."""
        try:
            t_start = time.monotonic()

            # Prepare Triton input
            features_np = self._msg_to_numpy(feature_msg)

            input_tensors = [
                triton_grpc.InferInput(
                    'bev_features', features_np.shape, 'FP16'
                ),
            ]
            input_tensors[0].set_data_from_numpy(features_np)

            # Request detection + VLM + world model in one call
            # (Triton ensemble pipeline handles routing)
            output_names = ['boxes_3d', 'scores', 'labels']
            if self.enable_vlm:
                output_names.append('vlm_text')

            outputs = [
                triton_grpc.InferRequestedOutput(name)
                for name in output_names
            ]

            result = self.triton_client.infer(
                model_name='airside_perception_ensemble',
                inputs=input_tensors,
                outputs=outputs,
                client_timeout=0.1,  # 100ms timeout
                headers={
                    'x-vehicle-id': self.vehicle_id,
                    'x-timestamp': str(feature_msg.header.stamp.to_sec())
                }
            )

            rtt = (time.monotonic() - t_start) * 1000
            self.rtt_history.append(rtt)

            # Publish results to ROS topics
            self._publish_detections(result, feature_msg.header)

            if self.enable_vlm and 'vlm_text' in output_names:
                self._publish_vlm(result)

            # Publish RTT for monitoring
            self.rtt_pub.publish(String(data=f"{rtt:.1f}"))

        except Exception as e:
            rospy.logwarn_throttle(5.0,
                f"Edge inference failed: {e}. Vehicle continues "
                f"autonomously."
            )

    def health_check_cb(self, event):
        """Periodic edge server health check."""
        try:
            is_live = self.triton_client.is_server_live()
            if is_live and not self.connected:
                rospy.loginfo("Edge server connection restored")
                self.connected = True
            elif not is_live and self.connected:
                rospy.logwarn("Edge server connection lost")
                self.connected = False
        except Exception:
            if self.connected:
                rospy.logwarn("Edge server health check failed")
                self.connected = False
```

### 10.3 Latency Monitoring Dashboard

Every edge inference request is instrumented with timestamps at each stage. A Prometheus metrics endpoint on the edge client node exposes:

```
# Prometheus metrics exported by edge_inference_client

# RTT histogram (ms)
edge_inference_rtt_ms{vehicle="third-generation tug-001", model="ptv3_detection"}

# Request rate (req/s)
edge_inference_requests_total{vehicle="third-generation tug-001", model="ptv3_detection"}

# Error rate
edge_inference_errors_total{vehicle="third-generation tug-001", error_type="timeout"}

# Network state
edge_network_state{vehicle="third-generation tug-001"}  # 0=offline, 1=minimal, 2=degraded, 3=full

# Queue depth at edge server
edge_server_queue_depth{model="ptv3_detection"}

# GPU utilization on edge
edge_gpu_utilization{gpu="0"}
```

Grafana dashboard panels:

| Panel | Metric | Alert Threshold |
|-------|--------|----------------|
| P50/P95/P99 RTT per vehicle | `edge_inference_rtt_ms` | P99 > 100ms: warn |
| Request success rate | `1 - errors/requests` | < 95%: warn, < 80%: alert |
| Fleet network state heatmap | `edge_network_state` per vehicle | Any vehicle offline > 60s |
| Edge GPU utilization | `edge_gpu_utilization` | > 90% sustained: capacity alert |
| Model queue depth | `edge_server_queue_depth` | > 20 requests: scaling needed |

### 10.4 ROS Topic Architecture with Edge Integration

```
/lidar/merged (PointCloud2, 10 Hz)
    │
    ├──> /perception/preprocessor
    │       │
    │       ├──> /perception/pillars (on-vehicle backbone)
    │       │       │
    │       │       ├──> /perception/pointpillars_det (6.84ms, safety)
    │       │       │       │
    │       │       │       └──> /perception/detections_local
    │       │       │
    │       │       └──> /perception/bev_features
    │       │               │
    │       │               └──> edge_inference_client ──> [5G] ──> Edge
    │       │                                                        │
    │       │               edge_result_subscriber <── [5G] <────────┘
    │       │                       │
    │       │                       ├──> /edge/detections_3d
    │       │                       ├──> /edge/vlm_description
    │       │                       ├──> /edge/world_prediction
    │       │                       └──> /edge/cooperative_map
    │       │
    │       └──> /perception/segmentation (FlatFormer, on-vehicle)
    │
    └──> /localization/vgicp ──> /localization/pose

/perception/detections_local ──┐
                                ├──> perception_fusion_node
/edge/detections_3d ───────────┘       │
                                       └──> /perception/fused_detections
                                                    │
                                                    └──> /planning/frenet
                                                            │
                                                            └──> /control/cmd_vel
```

---

## 11. Industry Approaches

### 11.1 Mobileye "Slow-Think" Cloud VLM Architecture

Mobileye has publicly described a dual-loop architecture where a fast, on-vehicle perception loop runs in real-time while a "slow-think" cloud-based VLM processes the same scene at a lower frequency for higher-level reasoning. Presented at CES 2025, this architecture:

- **Fast loop (on-vehicle, EyeQ Ultra):** 176 TOPS, runs detection, free space, lane detection at 10+ Hz. Produces driving commands.
- **Slow loop (cloud/edge VLM):** Processes camera frames at ~1 Hz. Provides scene understanding, anomaly detection, and planning verification.
- **Reconciliation:** If slow loop identifies a risk the fast loop missed (e.g., "construction zone ahead, workers on road"), it sends a constraint to the fast loop that tightens safety margins.

**Relevance to reference airside AV stack:** This is precisely the Pattern D (speculative execution) architecture. Mobileye validates the approach for production: the vehicle always acts on the fast loop's output, and cloud/edge reasoning arrives asynchronously to refine behavior.

**Key difference for airside:** Mobileye's slow loop runs in cloud (100+ ms RTT) because highway driving lacks local edge infrastructure. the reference airside AV stack's edge server provides 20-90ms RTT, enabling the slow loop to contribute within the same or next planning cycle -- a significant advantage.

### 11.2 Waymo Cloud-Based Perception Refinement

Waymo has documented (in public talks and patents) a cloud-based perception pipeline that:

- Runs resource-intensive models on cloud GPUs for sensor data uploaded from the fleet
- Identifies perception errors (false negatives, misclassified objects) using larger models than can run on-vehicle
- Generates automatic labels for fine-tuning on-vehicle models
- Provides offline route analysis to pre-compute expected perception challenges

Waymo's approach is batch/offline (minutes to hours latency), not real-time. It focuses on improving the on-vehicle model rather than augmenting it in real-time.

**Relevance to reference airside AV stack:** Waymo's cloud pipeline corresponds to Tier 3 in our architecture. The auto-labeling and model improvement functions are directly applicable. The difference is that Waymo does not operate edge servers for real-time enhancement (highway AVs cannot rely on connectivity), while reference airside AV stack can.

### 11.3 Apollo Cloud-Based HD Map Updates

Baidu Apollo uses a cloud-based map pipeline:

- Vehicles continuously upload mapping data (point clouds, images, localization)
- Cloud pipeline detects map changes (new construction, lane changes)
- Updated map tiles are pushed to vehicles

This is essentially the map change detection function of our Tier 2/3. The "fleet-based map maintenance" architecture described in `hd-map-change-detection.md` follows a similar pattern but with the fusion happening at the airport edge server (lower latency, privacy-preserving).

### 11.4 Tesla Dojo and On-Vehicle Only Inference

Tesla takes the opposite approach: all inference runs on-vehicle (HW3/HW4), and Dojo is used exclusively for training. Tesla's rationale:

- Cannot depend on connectivity (highway driving)
- Latency requirements are stringent at highway speeds
- Custom silicon (FSD chip) is highly optimized for their models

**Relevance to reference airside AV stack:** Tesla's constraint (no reliable connectivity) does not apply to airport operations. However, Tesla's principle of "the vehicle must work without the network" is critical and directly maps to our Simplex-based degradation strategy.

### 11.5 Motional / Hyundai Edge Computing Approach

Motional (Hyundai's L4 subsidiary, previously Aptiv-Hyundai JV) has piloted edge computing for:

- Intersection perception augmentation using roadside units (RSUs)
- V2I communication for traffic signal phase and timing (SPaT)
- Cloud-based remote assistance for edge cases

Motional's RSU-based perception is closest to the airport V2I cooperative perception concept. Their finding that infrastructure sensors add 15-25% detection AP aligns with DAIR-V2X benchmark results cited in our cooperative perception documents.

### 11.6 UISEE Airport Edge Approach

UISEE, the leading airside AV company (1,000+ vehicles deployed, Changi driverless tractors), has not publicly detailed their compute architecture. However, based on their published specifications and Changi deployment:

- Vehicles run local perception and planning
- Connected to airport operations center via 5G (Changi uses Singtel private 5G)
- Central dispatch/scheduling system communicates with vehicles
- Remote monitoring with human oversight

UISEE appears to use centralized fleet management (Tier 3 equivalent) but it is unclear whether they use edge-based perception enhancement (Tier 2). Their vehicles reportedly run on custom compute platforms, not NVIDIA Orin.

### 11.7 Comparative Summary

| Company | On-Vehicle | Edge | Cloud | Connectivity |
|---------|-----------|------|-------|-------------|
| **reference airside AV stack (proposed)** | Safety stack (Orin) | VLM + world model + coop. fusion | Training + analytics | Private 5G |
| **Mobileye** | Fast perception (EyeQ) | N/A | Slow-think VLM | Public cellular |
| **Waymo** | Full perception + planning | N/A | Auto-label + map + refinement | Public cellular |
| **Apollo** | Full perception + planning | N/A | Map updates + training | Public cellular |
| **Tesla** | Full stack (FSD chip) | N/A | Training only (Dojo) | WiFi (OTA only) |
| **Motional** | Full perception + planning | RSU perception fusion | Remote assistance | V2I + cellular |
| **UISEE** | Perception + planning | Unknown | Fleet management | Private 5G |

**the reference airside AV stack's edge approach is differentiated** because the airport environment uniquely enables it. No highway AV company can rely on edge compute because connectivity is not guaranteed on public roads. This is a structural advantage of airport operations that should be exploited.

---

## 12. Implementation Roadmap

### 12.1 Phase 1: Foundation ($15,000-25,000, 6 weeks)

**Goal:** Edge server operational, VLM offloading working end-to-end.

| Week | Task | Deliverable |
|------|------|-------------|
| 1-2 | Edge server hardware setup and software installation | Triton running, accessible from vehicle network |
| 2-3 | Edge client ROS node development | gRPC client node, feature serialization, result deserialization |
| 3-4 | VLM deployment on Triton | InternVL2-7B serving, camera frame intake, text output |
| 4-5 | End-to-end integration | Vehicle sends camera frames, receives VLM descriptions |
| 5-6 | Latency measurement and optimization | P50 < 60ms RTT, monitoring dashboard live |

**Hardware for Phase 1:**
- 1x server with 2x A100 40GB (can be rented: ~$5K/month) or purchased (~$25K used)
- 1x 5G modem per test vehicle (Cradlepoint E3000, ~$500)

**Success criteria:**
- VLM co-pilot running at 1-2 Hz from vehicle
- RTT < 80ms at P95
- Vehicle operates safely when edge server is unplugged (graceful degradation)

### 12.2 Phase 2: Split Inference ($20,000-35,000, 8 weeks)

**Goal:** Feature offload pattern operational for cooperative perception.

| Week | Task | Deliverable |
|------|------|-------------|
| 1-2 | BEV feature extraction on-vehicle | Backbone feature map published as ROS topic |
| 2-3 | Feature transport optimization | LZ4 compression, gRPC streaming, bandwidth profiling |
| 3-5 | Edge detection head deployment | PTv3/foundation model head on Triton, batched inference |
| 5-6 | Perception fusion node | Confidence-weighted merge of on-vehicle + edge detections |
| 6-7 | Cooperative perception fusion | Multi-vehicle feature aggregation on edge (Where2comm) |
| 7-8 | A/B testing framework | Side-by-side evaluation of edge-enhanced vs local-only |

**Success criteria:**
- Feature offload running at 10 Hz for 5+ vehicles simultaneously
- Edge detection AP measurably higher than on-vehicle only (shadow mode comparison)
- Cooperative perception fusion showing new detections in occluded zones
- Graceful degradation tested: kill edge, verify vehicle continues safely

### 12.3 Phase 3: Fleet Orchestration ($15,000-25,000, 6 weeks)

**Goal:** Full graceful degradation, fleet-level optimization, production hardening.

| Week | Task | Deliverable |
|------|------|-------------|
| 1-2 | Network state machine implementation | 4-state degradation with hysteresis |
| 2-3 | Edge server redundancy | Dual-server failover, tested with kill switch |
| 3-4 | Dynamic batching optimization | Triton batch tuning for fleet-scale throughput |
| 4-5 | World model deployment on edge | LiDAR-native world model serving 5+ vehicles |
| 5-6 | Load testing | Simulate 20-50 concurrent vehicles, identify bottlenecks |

**Success criteria:**
- All 4 network degradation levels tested and validated
- Edge server failover < 5 seconds
- 20 vehicles served simultaneously at < 80ms P95 RTT
- World model predictions available at 5 Hz per vehicle

### 12.4 Phase 4: Multi-Airport ($10,000-20,000, 4 weeks)

**Goal:** Repeatable edge deployment pattern for second and subsequent airports.

| Week | Task | Deliverable |
|------|------|-------------|
| 1 | Edge deployment automation (Ansible/Terraform) | One-command edge server provisioning |
| 2 | Airport-specific model configuration | Per-airport model variants, A/B testing by airport |
| 3 | Cross-airport fleet management | Single dashboard for multiple airport edge servers |
| 4 | Documentation and handoff | Ops playbook for edge server at new airports |

**Success criteria:**
- Second airport edge server deployed in < 1 week
- Per-airport model serving with shared base + per-airport LoRA
- Centralized monitoring across airports

### 12.5 Total Investment Summary

| Phase | Duration | Cost | Cumulative |
|-------|----------|------|-----------|
| Phase 1: Foundation | 6 weeks | $15K-25K | $15K-25K |
| Phase 2: Split inference | 8 weeks | $20K-35K | $35K-60K |
| Phase 3: Fleet orchestration | 6 weeks | $15K-25K | $50K-85K |
| Phase 4: Multi-airport | 4 weeks | $10K-20K | $60K-105K |
| **Total software development** | **24 weeks** | **$60K-105K** | |
| **Edge hardware (first airport)** | — | **$50K-150K** | |
| **Grand total (first airport)** | **24 weeks** | **$110K-255K** | |

This is comparable to the cost of a single vehicle (third-generation tug production cost) but benefits the entire fleet.

---

## 13. Key Takeaways

1. **Orin AGX is sufficient for safety, insufficient for advanced AI.** The safety-critical stack (PointPillars, Frenet, CBF, Simplex) fits within 55ms on Orin. Adding VLMs, world models, foundation backbones, and cooperative fusion simultaneously requires 500ms+ -- a 5x overrun. Edge offloading resolves this without replacing vehicle hardware.

2. **Airports uniquely enable edge-cloud inference.** Private 5G with 5-20ms RTT, bounded geography, owned infrastructure, and co-located fleets create conditions that highway AVs cannot exploit. The 55ms typical end-to-end edge latency fits within a single 100ms perception cycle.

3. **Feature offload (Pattern B) is the optimal primary pattern.** Sending compressed BEV features (50-200 KB) instead of raw sensor data (4-12 MB) reduces bandwidth 20-60x while enabling the edge to run multiple model heads on the same features. A 20-vehicle fleet needs 5-17 Mbps uplink per vehicle -- well within 5G capacity.

4. **The vehicle must always operate safely without the network.** The Simplex analogy applies: edge-enhanced perception is the advanced controller, on-vehicle perception is the baseline controller. Network loss degrades capability but never safety. Fast degradation, slow recovery (5s hysteresis) prevents oscillation.

5. **Edge economics favor fleets of 20+ vehicles.** A 4x A100 edge server ($50K) amortized across 20 vehicles is $2,500/vehicle -- less than a single Orin-to-Thor upgrade. The edge provides VLM 7B+ capabilities that even Thor cannot match, plus cooperative fleet fusion that no per-vehicle upgrade enables.

6. **Dynamic batching across vehicles is the edge's key efficiency.** Triton's batched inference processes multiple vehicles' features in a single GPU call. Batching 4 vehicles costs ~30ms instead of 4x20ms = 80ms. This is why a shared edge server is more GPU-efficient than per-vehicle compute for fleet workloads.

7. **Network slicing with URLLC guarantees safety-critical V2X.** 5G QoS profiles ensure V2X safety messages (1 Mbps) get guaranteed bit rate even when analytics traffic (100+ Mbps) saturates the network. This decouples safety communication from enhancement communication.

8. **Cooperative perception is the highest-value edge function.** Where2comm on the edge fuses features from all vehicles into fleet-level perception, providing +18-22% detection AP and eliminating occlusion blind spots. This is impossible without centralized edge compute -- pure V2V peer-to-peer does not scale.

9. **Multi-tenant isolation is critical for airline customers.** Airports serve multiple ground handlers. Kubernetes namespace isolation, MIG GPU partitioning, and separate Triton instances per tenant prevent cross-customer data leakage while sharing hardware cost.

10. **Phase 1 (VLM offloading) delivers value in 6 weeks for $15-25K.** The fastest path to demonstrating edge value is offloading a VLM co-pilot -- a capability that cannot run on Orin at acceptable frequency. This provides immediate anomaly detection and scene reasoning at 1-2 Hz with zero vehicle hardware changes.

---

## 14. References

### Academic Papers

1. **He, Z., Shorinwa, O., et al.** "CoBEVFlow: Robust Asynchronous Collaborative 3D Object Detection." AAAI 2024. Asynchronous cooperative perception with BEV flow compensation up to 200ms delay.

2. **Hu, Y., Fang, S., et al.** "Where2comm: Communication-Efficient Collaborative Perception via Spatial Confidence Maps." NeurIPS 2022. Achieves 95.3% of full-sharing performance at 1/64 bandwidth via learned attention masks.

3. **Li, Y., et al.** "InternVL2: Better than the Best -- Expanding the Boundaries of Open-Source Multimodal Models." 2024. InternVL2-2B achieves practical VLM performance in 300ms on Orin; 7B achieves SOTA on edge/cloud GPUs.

4. **Wu, X., et al.** "Point Transformer V3: Simpler, Faster, Stronger." CVPR 2024 (Oral). 80.4% mIoU on nuScenes, 3x faster, 10x less memory than PTv2.

5. **Lang, A., et al.** "PointPillars: Fast Encoders for Object Detection from Point Clouds." CVPR 2019. 6.84ms INT8 on Orin with TensorRT -- the safety baseline detection model.

6. **Yang, B., et al.** "Copilot4D: Learning Unsupervised World Models for Autonomous Driving via Discrete Diffusion." ICLR 2024. LiDAR future prediction via discrete diffusion on tokenized point clouds.

7. **Agand, P., et al.** "UnO: Unsupervised Occupancy Fields for Perception and Forecasting." CVPR 2024. Self-supervised LiDAR occupancy forecasting outperforming supervised baselines.

8. **Xu, Y., et al.** "V2X-ViT: Vehicle-to-Everything Cooperative Perception with Vision Transformer." ECCV 2022. Transformer-based V2X fusion achieving +18% AP over single-vehicle.

9. **Li, Y., et al.** "HEAL: An Extensible Framework for Open Heterogeneous Collaborative Perception." ICLR 2024. Heterogeneous agent fusion without retraining existing agents.

10. **Tian, S., et al.** "DriveVLM: The Convergence of Autonomous Driving and Large Vision-Language Models." 2024. Chain-of-thought reasoning architecture for VLM driving co-pilots.

### Industry Publications

11. **NVIDIA.** "Triton Inference Server: Model Serving at Scale." NVIDIA Developer Documentation, 2025. Dynamic batching, model ensembles, GPU scheduling for multi-model serving.

12. **NVIDIA.** "Jetson AGX Orin Developer Guide." JetPack 6.x, 2025. Hardware specifications, power modes, TensorRT deployment.

13. **OnGo Alliance.** "Private Wireless Revolution: CBRS at DFW Airport." 2024. DFW $10M private 5G deployment case study.

14. **Singtel.** "5G Aviation Testbed at Changi Airport." 2023-2026. Private 5G for autonomous tractor operations.

15. **3GPP.** "TS 23.501: System Architecture for the 5G System." Release 17, 2023. 5G QoS framework, network slicing, URLLC specifications.

16. **3GPP.** "TS 23.287: Application Layer Support for V2X Services." Release 17, 2023. C-V2X sidelink and network-based V2X communication.

17. **ETSI.** "MEC 003: Multi-access Edge Computing -- Framework and Reference Architecture." v3.1.1, 2023. MEC deployment architecture for edge servers co-located with 5G infrastructure.

18. **ETSI.** "GR MEC 022: Multi-access Edge Computing -- Study on MEC Support for V2X Use Cases." 2020. Edge computing for V2X applications including cooperative perception.

19. **NVIDIA.** "NVIDIA DGX Station A100 Datasheet." 2024. 4x A100 80GB, 320 GB total HBM, 6.4 kW power.

20. **Mobileye.** "Mobileye Drive: System Architecture." CES 2025 presentation. Dual-loop fast/slow-think architecture with cloud VLM integration.

### Standards and Regulations

21. **ISO 3691-4:2023.** "Industrial trucks -- Safety requirements and verification -- Part 4: Driverless industrial trucks." Harmonized with EU Machinery Directive.

22. **EU AI Act (Regulation 2024/1689).** High-risk AI system requirements including robustness, transparency, and human oversight. Effective August 2024, compliance by August 2026.

23. **NIS2 Directive (Directive 2022/2555).** Network and information security requirements for critical infrastructure. Transport sector (including airports) in scope.

24. **EU GDPR (Regulation 2016/679).** Data protection requirements applicable to sensor data containing personal information (camera images of ground crew).

25. **ICAO Annex 17.** Aviation security standards applicable to equipment in restricted airside zones.

### Software and Products

26. **NVIDIA Triton Inference Server.** https://github.com/triton-inference-server/server. Open-source inference serving with dynamic batching, GPU scheduling, and model management.

27. **Cradlepoint E3000 Series.** Enterprise 5G router for vehicle-mounted deployment. Multi-carrier, dual-modem, CBRS/sub-6/mmWave support.

28. **Sierra Wireless AirLink XR90.** Rugged 5G router for industrial vehicles. IP67 rated, -40C to +70C operating temperature.

29. **NVIDIA Isaac ROS.** GPU-accelerated ROS packages for robot perception. Includes nvblox, visual SLAM, and freespace segmentation.

30. **Kubernetes + NVIDIA GPU Operator.** Container orchestration with GPU resource management for edge server deployment.
