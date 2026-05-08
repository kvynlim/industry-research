# Collaborative Fleet Perception: Vehicle-to-Vehicle Cooperative Sensing for Autonomous GSE

> **Purpose**: Deep dive into V2V cooperative perception between autonomous GSE vehicles — sharing sensor observations across the fleet to eliminate blind spots, improve detection range, and enable collective situational awareness on airport aprons.
>
> **Relation to existing docs**: Complements `infrastructure-cooperative-perception.md` which covers V2I (fixed infrastructure sensors). This document focuses exclusively on V2V (vehicle-to-vehicle) perception sharing within a fleet of autonomous GSE, including algorithms, bandwidth management, latency constraints, and airside deployment architecture.

---

## Table of Contents

1. [Why V2V Cooperative Perception for Airside Fleets](#1-why-v2v)
2. [V2V Cooperative Perception: Taxonomy and SOTA](#2-taxonomy-and-sota)
3. [Intermediate Fusion: The Dominant Paradigm](#3-intermediate-fusion)
4. [Bandwidth-Efficient Feature Sharing](#4-bandwidth-efficient)
5. [Temporal Fusion Across Vehicles](#5-temporal-fusion)
6. [Heterogeneous Agent Fusion](#6-heterogeneous-agents)
7. [Robustness: Delays, Noise, and Dropout](#7-robustness)
8. [Fleet-Level Collective Perception](#8-fleet-level)
9. [Privacy and Security](#9-privacy-security)
10. [Airside Deployment Architecture](#10-airside-deployment)
11. [Implementation on ROS/Orin](#11-implementation)
12. [Comparison Table](#12-comparison)
13. [Key Findings](#13-key-findings)

---

## 1. Why V2V Cooperative Perception for Airside Fleets

### 1.1 The Occlusion Problem on Airport Aprons

Airport ramps have severe occlusion challenges that single-vehicle perception cannot solve:

```
Scenario: Baggage tractor approaching aircraft stand

                    ┌─────────────┐
                    │   Aircraft   │
                    │   Fuselage   │
                    └─────┬───────┘
                          │ ← OCCLUDED ZONE
    ┌────┐               │              ┌────┐
    │GSE │               │              │GSE │
    │ A  │──────────X────│──────────────│ B  │
    └────┘    Cannot see  │  Can see     └────┘
              personnel   │  personnel
              behind      │  from other
              aircraft    │  angle
```

GSE-A cannot see personnel working on the far side of the aircraft. But GSE-B, approaching from a different angle, has clear line-of-sight. If GSE-B shares its perception with GSE-A, both vehicles have a complete picture.

**Airside-specific occlusion scenarios:**
- Aircraft fuselage blocks view of opposite side (90%+ of gate operations)
- Belt loaders, air stairs, and ground power units create 2-3m tall occlusion walls
- Container dollies in train configuration create 15-30m moving walls
- Fuel trucks and catering vehicles block entire gate approaches
- Jet bridges create overhead occlusion for camera-based systems

### 1.2 V2V vs V2I for Airside

| Criterion | V2I (Infrastructure) | V2V (Fleet) |
|-----------|---------------------|-------------|
| Coverage | Fixed, predictable | Dynamic, follows fleet |
| Cost | $100K-500K per zone | Marginal cost per vehicle ($5-10K) |
| Installation | Poles, power, fiber | Software + network config |
| Scalability | Fixed capacity | Scales with fleet size |
| Failure mode | Zone goes dark | Graceful degradation |
| Latency | Low (edge compute) | Medium (V2V via 5G/WiFi) |
| Mobile coverage | No | Yes (follows vehicles) |

**Key insight**: V2V cooperative perception is particularly valuable for airside because the fleet itself provides coverage. As more vehicles are deployed, perception quality improves for all. V2I requires physical infrastructure installation; V2V is a software capability that deploys with the fleet.

### 1.3 Quantitative Benefits

Published results from cooperative perception research show consistent improvements:

| Study | Setting | Single-vehicle mAP | Cooperative mAP | Improvement |
|-------|---------|--------------------|-----------------|----|
| OPV2V (Xu et al., 2022) | V2V LiDAR | 60.2% | 79.0% | +18.8% |
| V2X-ViT (Xu et al., 2022) | V2V+V2I | 62.5% | 82.1% | +19.6% |
| Where2comm (Hu et al., 2022) | V2V (bandwidth-limited) | 60.2% | 75.3% | +15.1% at 1/64 bandwidth |
| CoBEVT (Xu et al., 2023) | V2V BEV | 62.3% | 82.9% | +20.6% |
| CoBEVFlow (Wei et al., 2024) | V2V temporal | 62.3% | 84.5% | +22.2% |

**For airside operations specifically:**
- Personnel detection recall improves ~25-40% (occlusion elimination)
- Effective perception range extends from 60m (single LiDAR) to 120m+ (cooperative)
- FOD detection probability improves with overlapping coverage from multiple angles
- Aircraft clearance measurement accuracy improves with multi-viewpoint fusion

---

## 2. V2V Cooperative Perception: Taxonomy and SOTA

### 2.1 Fusion Strategies

```
           ┌──────────────────────────────────────────┐
           │         Cooperative Perception            │
           │              Fusion Levels                │
           └──────────┬───────────┬───────────┬───────┘
                      │           │           │
              ┌───────┴──┐  ┌────┴────┐  ┌───┴────────┐
              │  Early    │  │ Inter-  │  │   Late     │
              │  Fusion   │  │ mediate │  │   Fusion   │
              └──────────┘  └─────────┘  └────────────┘
              
  Share:     Raw point     Compressed    Detection
             clouds        BEV features  boxes/tracks
  
  Bandwidth: ~10 MB/s      ~0.1-1 MB/s  ~0.01 MB/s
  
  Quality:   Best          Near-best     Good
  
  Latency    Highest       Moderate      Lowest
  tolerance:
```

### 2.2 SOTA Methods Timeline

| Method | Year | Venue | Fusion Level | Key Innovation |
|--------|------|-------|-------------|----------------|
| **DiscoNet** | 2021 | NeurIPS | Intermediate | Knowledge distillation from early fusion teacher |
| **OPV2V** | 2022 | ICRA | All levels | First open V2V perception benchmark + AttFuse |
| **V2X-ViT** | 2022 | ECCV | Intermediate | Vision Transformer for V2V feature fusion |
| **Where2comm** | 2022 | NeurIPS | Intermediate | Spatial confidence maps for bandwidth-efficient sharing |
| **CoBEVT** | 2023 | CoRL | Intermediate | Fused Axial Attention for BEV cooperative fusion |
| **HEAL** | 2024 | ICLR | Intermediate | Heterogeneous agent fusion (different sensor configs) |
| **CoBEVFlow** | 2024 | NeurIPS | Intermediate | Asynchronous temporal BEV flow compensation |
| **CoAlign** | 2024 | ICRA | Intermediate | Robust to pose error via agent-object pose graph |
| **V2X-R** | 2025 | CVPR | Intermediate | LiDAR-4D radar V2X fusion with denoising diffusion |
| **BM2CP** | 2024 | NeurIPS | Mixed | Bi-level multi-agent consensus via LLM |
| **MRCNet** | 2024 | ECCV | Intermediate | Multi-resolution compressed features |

---

## 3. Intermediate Fusion: The Dominant Paradigm

### 3.1 Why Intermediate Fusion Wins

Early fusion (raw data sharing) provides the best theoretical performance but requires ~10 MB/s per vehicle pair — impractical over wireless networks. Late fusion (detection sharing) is bandwidth-efficient but loses fine-grained spatial information. Intermediate fusion strikes the optimal balance: share compressed BEV feature maps (~0.1-1 MB/s) that retain spatial detail while being communication-friendly.

### 3.2 AttFuse (OPV2V Baseline)

**Architecture:**
```
Vehicle i:                           Vehicle j:
LiDAR_i → PointPillars → BEV_i     LiDAR_j → PointPillars → BEV_j
                |                                    |
                v                                    v
            Compress                             Compress
            (1x1 conv)                          (1x1 conv)
                |                                    |
                +──── Transmit via V2V ──────────────+
                |                                    |
                v                                    v
        Warp BEV_j to                       Warp BEV_i to
        Vehicle i frame                     Vehicle j frame
        (using relative                     (using relative
         pose transform)                     pose transform)
                |                                    |
                v                                    v
        Attention Fusion:                   Attention Fusion:
        BEV_fused_i = Attn(                BEV_fused_j = Attn(
          Q=BEV_i,                           Q=BEV_j,
          K=BEV_j_warped,                    K=BEV_i_warped,
          V=BEV_j_warped)                    V=BEV_i_warped)
                |                                    |
                v                                    v
          Detection_i                          Detection_j
```

**Key operation — spatial warping:**
```
Given:
  T_i = ego vehicle i's pose [R_i | t_i]  (from GTSAM localization)
  T_j = vehicle j's pose [R_j | t_j]

Relative transform: T_j→i = T_i^{-1} @ T_j

Warp BEV features:
  For each (x, y) in BEV_j:
    (x', y') = T_j→i @ (x, y, 0, 1)  (homogeneous transform)
    BEV_j_warped(x', y') = bilinear_interpolate(BEV_j, x, y)
```

**Pose accuracy requirement:** ±0.2m position, ±0.5 degree heading. the reference airside AV stack's GTSAM provides ±0.02m with RTK — well within requirement.

### 3.3 V2X-ViT (ECCV 2022)

**Paper:** "V2X-ViT: Vehicle-to-Everything Cooperative Perception with Vision Transformer"
**Code:** [github.com/DerrickXuNu/v2x-vit](https://github.com/DerrickXuNu/v2x-vit)

**Key innovations:**
1. **Heterogeneous Multi-Agent Attention (HMSA)**: Different attention for different agent types (ego vehicle, other vehicles, infrastructure)
2. **Multi-Scale Window Attention**: Captures both local and global spatial dependencies in the fused BEV
3. **Relative Positional Encoding**: Encodes the relative pose between agents directly into the attention mechanism

**Architecture details:**
```
Each agent:
  LiDAR → PointPillar encoder → BEV feature (H×W×C)
  
Ego vehicle receives features from all agents:
  [BEV_ego, BEV_1_warped, BEV_2_warped, ..., BEV_N_warped]
  
V2X-ViT fusion:
  Layer 1: Multi-Agent Self-Attention (attend across agents at same spatial location)
  Layer 2: Multi-Scale Window Attention (attend within local windows across agents)
  Layer 3: Feed-Forward Network
  Repeat × L layers
  
Output: Fused BEV → Detection/Segmentation heads
```

**Performance:** 82.1% AP@0.7 on OPV2V (vs 60.2% single-agent, 79.0% AttFuse). Best single model at the time.

### 3.4 CoBEVT (CoRL 2023)

**Paper:** "CoBEVT: Cooperative Bird's Eye View Semantic Segmentation with Sparse Transformers"
**Code:** [github.com/DerrickXuNu/CoBEVT](https://github.com/DerrickXuNu/CoBEVT)

**Key innovation — Fused Axial Attention (FAX):**

Standard attention over a (N_agents × H × W × C) tensor is O((N×H×W)^2) — intractable. CoBEVT decomposes this into:
1. **Agent-wise axial attention**: Attend across agents at each (h, w) location → O(N^2 × H × W)
2. **Height-wise axial attention**: Attend across H at each (n, w) location → O(H^2 × N × W)
3. **Width-wise axial attention**: Attend across W at each (n, h) location → O(W^2 × N × H)

This reduces complexity from O((N×H×W)^2) to O(N^2×H×W + H^2×N×W + W^2×N×H) — making it practical.

**Performance:** 82.9% AP on OPV2V, SOTA at time of publication.

---

## 4. Bandwidth-Efficient Feature Sharing

### 4.1 The Bandwidth Challenge

Airport 5G provides 100-500 Mbps shared across all vehicles. For a fleet of 20 vehicles each sharing with all others:
```
Naive intermediate fusion:
  BEV feature: 200×200 × 64 channels × 4 bytes = 10.24 MB per feature map
  20 vehicles × 19 recipients × 10 Hz = 38,912 MB/s = ~311 Gbps  → IMPOSSIBLE
  
Compressed intermediate fusion (32x compression):
  320 KB per feature map
  20 × 19 × 10 = 1,216 MB/s = ~9.7 Gbps → Still challenging
  
Selective sharing (Where2comm, top-10% spatial locations):
  32 KB per feature map
  20 × 19 × 10 = 121.6 MB/s = ~973 Mbps → FEASIBLE with airport 5G
```

### 4.2 Where2comm (NeurIPS 2022)

**Paper:** "Where2comm: Communication-Efficient Collaborative Perception via Spatial Confidence Maps"
**Code:** [github.com/MediaBrain-SJTU/Where2comm](https://github.com/MediaBrain-SJTU/Where2comm)

**Core idea:** Not all spatial locations need to be shared. Only send features from locations where the sender has useful information for the receiver.

**Architecture:**
```
Each vehicle i:
  1. Compute BEV features F_i (standard perception backbone)
  2. Generate confidence map C_i (learned, per-location importance score)
  3. For each potential receiver j:
     a. Estimate receiver's confidence C_j (from previous exchange or prediction)
     b. Compute complementary map: M_ij = C_i * (1 - C_j)
        (high where I'm confident AND you're not)
     c. Select top-K spatial locations from M_ij
     d. Transmit only selected features: {(x_k, y_k, f_k)} for k = 1..K
  4. Receive features from other vehicles
  5. Fuse: scatter received features onto BEV grid, attention-weighted merge
```

**Bandwidth-performance tradeoff:**

| Compression Ratio | Bandwidth per Pair | mAP (AP@0.7) | Relative to Full |
|-------------------|--------------------|-------------|------------------|
| 1x (full feature) | 10.24 MB/frame | 79.0% | 100% |
| 8x | 1.28 MB/frame | 78.2% | 99.0% |
| 32x | 320 KB/frame | 76.5% | 96.8% |
| 64x | 160 KB/frame | 75.3% | 95.3% |
| 256x | 40 KB/frame | 72.1% | 91.3% |

**Critical finding:** At 64x compression, Where2comm retains 95.3% of full-sharing performance while using only 160 KB per frame per vehicle pair. For a 20-vehicle fleet at 10 Hz, this requires ~608 MB/s total — feasible on airport 5G.

### 4.3 MRCNet: Multi-Resolution Compressed Features (ECCV 2024)

**Key innovation:** Instead of uniform compression, use multi-resolution: high-resolution features near the sender (where they're most accurate) and low-resolution features far away (where less spatial detail is needed):

```
Near field (0-30m from sender): Full resolution (200×200)
Mid field (30-60m): 2x downsampled (100×100)
Far field (60m+): 4x downsampled (50×50)
```

This achieves 128x compression with only 1.2% mAP loss (vs 3.7% for uniform 128x).

### 4.4 Neural Feature Compression

Standard approaches use 1×1 convolutions to reduce channel dimension. More advanced:

**Learned codec (DiscoNet):** Train encoder-decoder pair:
```
Sender:  F_BEV (64 channels) → Encoder (conv layers) → Z (4 channels) → Quantize → Transmit
Receiver: Receive → Dequantize → Decoder (conv layers) → F_BEV_reconstructed (64 channels)
```

**Entropy-coded features:** Apply arithmetic coding to quantized features. Variable-length encoding achieves 2-4x additional compression over fixed quantization.

**Vector quantization:** Use VQ-VAE style codebook. Transmit only codebook indices (integers) instead of float features. With 1024-entry codebook, each spatial location needs only 10 bits.

---

## 5. Temporal Fusion Across Vehicles

### 5.1 The Asynchrony Problem

Vehicles don't perceive simultaneously. Network delays add further asynchrony:
```
Timeline:
  Vehicle A captures scan at t = 0.000s
  Vehicle B captures scan at t = 0.023s  (different scan phase)
  A transmits feature at t = 0.050s     (processing delay)
  B receives A's feature at t = 0.065s  (network delay: 15ms)
  B needs to fuse A's feature (captured at t=0) with B's data (at t=0.023s)
  
  Temporal gap: 23ms + ego-motion during that time
  At 25 km/h (6.9 m/s): 0.16m displacement in 23ms → non-trivial for close-range safety
```

### 5.2 CoBEVFlow (NeurIPS 2024)

**Paper:** "CoBEVFlow: Robust BEV Flow for Asynchronous Cooperative Perception"
**Code:** Available on GitHub

**Key innovation — BEV flow field estimation:**

Instead of assuming static features between timestamps, estimate how the BEV scene changes over time and warp accordingly:

```
Inputs: BEV_A(t_A), BEV_B(t_B), relative pose, timestamps t_A, t_B

1. Estimate BEV flow field F(t_A → t_B):
   F predicts per-pixel displacement between t_A and t_B
   Uses: ego-motion (from odometry) + scene dynamics (learned from BEV features)

2. Warp A's features to B's timestamp:
   BEV_A_aligned = warp(BEV_A, F(t_A → t_B))

3. Fuse aligned features:
   BEV_fused = Attention(Q=BEV_B, K=BEV_A_aligned, V=BEV_A_aligned)
```

**Performance:** 84.5% AP on OPV2V (vs 82.9% CoBEVT, 60.2% single-agent). The temporal alignment is worth +1.6% AP even in mostly static scenes — more impactful in dynamic airport environments.

### 5.3 Prediction-Based Compensation

For longer delays (50-200ms, typical of 5G under load), BEV flow may not suffice. Alternative: each sender also transmits a motion prediction:

```
Sender transmits:
  - BEV features F at timestamp t
  - Predicted BEV features F' at timestamp t + delta_predicted
  - Prediction uncertainty sigma

Receiver at timestamp t_recv:
  - Interpolate between F and F' based on (t_recv - t) / delta_predicted
  - Weight by prediction uncertainty: lower weight for uncertain predictions
```

This is equivalent to each vehicle running a mini-world model for its local perception and sharing the predicted future state.

---

## 6. Heterogeneous Agent Fusion

### 6.1 The Heterogeneous Fleet Problem

Airside fleets are heterogeneous:

| Vehicle Type | Sensors | BEV Resolution | Compute |
|-------------|---------|---------------|---------|
| third-generation tug (reference airside AV stack) | 4-8 LiDAR, cameras | 0.2m/pixel | Orin (275 TOPS) |
| Baggage tractor | 2 LiDAR, cameras | 0.5m/pixel | Orin NX (100 TOPS) |
| Belt loader | 1 LiDAR, cameras | 1.0m/pixel | Orin Nano (40 TOPS) |
| Manual GSE (retrofit) | Camera-only | 0.5m/pixel | Orin Nano |

Different vehicles produce BEV features with different:
- Spatial resolution
- Channel dimensions
- Semantic richness
- Quality/confidence

### 6.2 HEAL (ICLR 2024)

**Paper:** "HEAL: An Extensible Framework for Open Heterogeneous Collaborative Perception"
**Code:** [github.com/yifanlu0227/HEAL](https://github.com/yifanlu0227/HEAL)

**Core idea — backward alignment:**

Rather than requiring all agents to use the same backbone (impractical for heterogeneous fleets), HEAL:
1. Defines a **collaboration base** (reference feature space)
2. Each agent learns an **alignment module** that projects its native features to the base
3. New agent types can be added without retraining existing agents

```
Agent type A (LiDAR, ResNet):
  F_A → AlignNet_A(F_A) → F_base_A    (project to common space)

Agent type B (Camera, Swin-T):
  F_B → AlignNet_B(F_B) → F_base_B    (project to same common space)

Agent type C (Camera-only, MobileNet):
  F_C → AlignNet_C(F_C) → F_base_C

Fusion: Attention(F_base_A, F_base_B, F_base_C) → F_fused
```

**Training:** AlignNet is trained via knowledge distillation from a strong "oracle" model (the collaboration base). Each agent only needs its own AlignNet; the fusion module is shared.

**Airside application:** The third-generation tug (full sensor suite) defines the collaboration base. Simpler vehicles (baggage tractors, belt loaders) learn alignment modules that map their sparser features to the third-generation tug's rich feature space. New vehicle types can be integrated by training only a lightweight alignment network (~100K parameters, ~1 hour training).

### 6.3 Handling Missing Modalities

When a vehicle temporarily loses a sensor (LiDAR failure, camera obstruction):
```
Normal: F_lidar + F_camera → F_BEV (multi-modal)
Degraded: F_camera only → F_BEV_degraded (lower quality)

Solution: Confidence-weighted fusion
  w_i = confidence(F_BEV_i) = f(sensor_health_i, feature_variance_i, staleness_i)
  
  F_fused = sum_i(w_i * F_BEV_i) / sum_i(w_i)
```

The cooperative framework automatically compensates — other vehicles with healthy sensors contribute more to the fused perception.

---

## 7. Robustness: Delays, Noise, and Dropout

### 7.1 Communication Delay

| Network Type | Typical Latency | Worst Case | Suitable for |
|-------------|----------------|-----------|-------------|
| Direct WiFi 6E | 1-5 ms | 15 ms | Nearby vehicles (< 100m) |
| Airport 5G (private) | 5-20 ms | 50 ms | All vehicles on apron |
| Airport 5G (public) | 20-100 ms | 200 ms | Non-safety features only |
| Edge server relay | 10-30 ms | 80 ms | Multi-hop, central fusion |

**Safety policy:** Cooperative features with delay > 100ms are discarded for safety-critical decisions (obstacle avoidance). Only ego perception is used. Cooperative data with 50-100ms delay is used with reduced confidence weight.

### 7.2 Pose Error Robustness

Cooperative fusion requires knowing the relative pose between vehicles to warp features. Pose errors cause misalignment.

**CoAlign (ICRA 2024):**
- Constructs an agent-object pose graph
- Joint optimization of poses and feature fusion
- Robust to ±0.5m position error, ±2 degree heading error
- the reference airside AV stack's GTSAM provides ±0.02m, ±0.1 deg — well within tolerance

### 7.3 Agent Dropout

Vehicles may leave the communication group (out of range, network failure, shutdown):

**Robust training strategy:**
```
During training, randomly drop 0-50% of cooperating agents per sample.
This forces the model to work with variable numbers of cooperators.

During inference:
  N available agents → fuse all
  Some agents drop → remaining agents still provide benefit
  All agents drop → fall back to ego-only perception (graceful degradation)
```

**Monte Carlo dropout test (CoBEVT):**

| Agents Available | mAP | Relative to Full Fleet |
|-----------------|-----|----------------------|
| All (5) | 82.9% | 100% |
| 4 of 5 | 81.5% | 98.3% |
| 3 of 5 | 79.2% | 95.5% |
| 2 of 5 | 75.1% | 90.6% |
| 1 (ego only) | 62.3% | 75.1% |

Graceful degradation — even one cooperating partner provides 13% improvement.

---

## 8. Fleet-Level Collective Perception

### 8.1 Beyond Pairwise: Fleet-Wide Fusion

Standard V2V is pairwise (vehicle A fuses with vehicle B). Fleet-level perception extends to N vehicles simultaneously.

**Centralized approach:**
```
All vehicles → upload BEV features → Edge server
Edge server → fuse all features → broadcast fused BEV
Latency: 20-40ms round trip
Bandwidth: N × feature_size (upload) + N × fused_size (download)
```

**Decentralized approach (preferred for robustness):**
```
Each vehicle:
  1. Broadcast compressed features (publish)
  2. Receive features from K nearest neighbors (subscribe)
  3. Fuse locally using attention over received features
  4. No central point of failure
```

### 8.2 Fleet Occupancy Map

Aggregate all vehicles' local occupancy grids into a fleet-wide occupancy map:

```python
class FleetOccupancyAggregator:
    """
    Maintains a fleet-wide occupancy grid updated by all vehicles.
    Uses log-odds fusion for Bayesian occupancy update.
    """
    
    def __init__(self, grid_size=(400, 400), resolution=0.5):
        self.resolution = resolution  # 0.5m per cell
        self.log_odds = np.zeros(grid_size, dtype=np.float32)  # log-odds occupancy
        self.last_updated = np.zeros(grid_size, dtype=np.float64)  # timestamp per cell
        self.staleness_threshold = 2.0  # seconds
    
    def update_from_vehicle(self, vehicle_id, local_occ, pose, timestamp):
        """
        Fuse a vehicle's local occupancy observation into the fleet map.
        
        Args:
            local_occ: (H_local, W_local) occupancy probabilities [0, 1]
            pose: (x, y, theta) vehicle pose in global frame
            timestamp: observation time
        """
        # Transform local occupancy to global frame
        global_occ = self._warp_to_global(local_occ, pose)
        
        # Convert to log-odds
        log_odds_obs = np.log(global_occ / (1 - global_occ + 1e-8) + 1e-8)
        
        # Bayesian fusion: add log-odds (assumes conditional independence)
        mask = ~np.isnan(log_odds_obs)
        self.log_odds[mask] += log_odds_obs[mask]
        self.log_odds = np.clip(self.log_odds, -10, 10)  # prevent saturation
        
        # Update timestamps
        self.last_updated[mask] = timestamp
    
    def get_occupancy(self, current_time):
        """Return current occupancy with staleness decay."""
        staleness = current_time - self.last_updated
        decay = np.exp(-staleness / self.staleness_threshold)
        
        # Decay log-odds toward prior (0 = unknown) based on staleness
        decayed_log_odds = self.log_odds * decay
        
        # Convert back to probability
        return 1.0 / (1.0 + np.exp(-decayed_log_odds))
    
    def get_blind_spots(self, current_time, threshold=0.3):
        """Identify areas not observed recently by any vehicle."""
        staleness = current_time - self.last_updated
        return staleness > self.staleness_threshold
```

### 8.3 Collective FOD Detection

Foreign Object Debris (FOD) detection benefits enormously from fleet cooperation:

```
Single vehicle: Detects FOD if within sensor range AND not occluded
  → P(detect) ≈ 0.3-0.6 (single pass over area)

Fleet with V2V: Multiple vehicles observe same area from different angles
  → P(detect) = 1 - product(1 - P_i(detect)) for all vehicles i
  → With 3 vehicles: P(detect) ≈ 0.85-0.95
  → With 5 vehicles: P(detect) ≈ 0.95-0.99

Multi-pass with fleet memory: Vehicles accumulate observations over time
  → Detection probability approaches 1.0 for persistent FOD
```

**Fleet FOD protocol:**
1. Any vehicle detects potential FOD → flag location with uncertainty
2. Nearby vehicles directed to observe flagged location from different angles
3. Multi-view consistency check: if 2+ vehicles confirm → report to operations
4. If inconsistent (shadow, marking) → dismiss with updated map

### 8.4 Fleet-Based Dynamic Mapping

Vehicles collectively maintain a real-time map of the apron:

```
Static layer: Updated hourly from fleet SLAM consensus
  - Lane markings, buildings, permanent infrastructure
  
Semi-static layer: Updated per-minute from fleet observations
  - Parked aircraft positions, gate assignments, active zones
  
Dynamic layer: Updated real-time from V2V perception
  - Moving vehicles, personnel, active equipment
  - Jet blast zones (from engine state detection)
  - Wet/icy surface patches
```

---

## 9. Privacy and Security

### 9.1 Feature-Level Privacy

Sharing raw sensor data could reveal sensitive information (airline operations, security procedures). Feature-level sharing mitigates this:

- **BEV features** are abstract — cannot reconstruct original images/point clouds
- **Compressed features** (4-8 channels) retain task-relevant information but discard appearance
- **Quantized features** (VQ-VAE indices) are opaque to inspection

### 9.2 Adversarial Attacks on V2V

A compromised vehicle could inject malicious features to manipulate fleet perception:

**Threat model:**
- Attacker controls one vehicle in the fleet
- Attacker sends crafted BEV features that create phantom objects or hide real ones
- Goal: cause another vehicle to brake unnecessarily or miss an obstacle

**Defenses:**
1. **Consistency checking**: Cross-validate features against ego perception. If a cooperating vehicle's features are inconsistent with ego observations in overlapping areas, reduce weight or reject.
2. **Byzantine-tolerant fusion**: Use median or trimmed mean instead of attention-weighted average. Requires ≥3 cooperative views to tolerate 1 malicious view.
3. **Signed features**: Each vehicle signs its feature messages with a hardware-backed key. Tampering is detectable.
4. **Anomaly detection**: Train a discriminator to distinguish normal vs. adversarial feature distributions.

### 9.3 Airport Security Considerations

Cooperative perception data traverses the airport network:
- All V2V communication must be encrypted (TLS 1.3 or WireGuard)
- Feature messages authenticated per vehicle (certificate-based)
- No raw sensor data leaves the vehicle (features only)
- Compliant with airport security regulations (TSA/EASA)
- Network segmentation: V2V on dedicated VLAN, not shared with public WiFi

---

## 10. Airside Deployment Architecture

### 10.1 Proposed System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Airport 5G Network                    │
│              (Private network, dedicated slice)          │
└────────┬──────────┬──────────┬──────────┬──────────────┘
         │          │          │          │
    ┌────┴────┐ ┌───┴────┐ ┌──┴─────┐ ┌─┴──────┐
    │  third-generation tug   │ │ Tractor│ │ Loader │ │  Edge  │
    │ (ego)   │ │  #2    │ │  #3    │ │ Server │
    └────┬────┘ └───┬────┘ └──┬─────┘ └─┬──────┘
         │          │          │          │
    Each vehicle:                    Fleet services:
    ┌──────────────┐               ┌──────────────┐
    │ LiDAR/Camera │               │ Fleet Occ Map│
    │     ↓        │               │ FOD Tracker  │
    │ Perception   │               │ Event Logger │
    │     ↓        │               │ Map Updater  │
    │ BEV Features │               └──────────────┘
    │     ↓        │
    │ Compress     │
    │     ↓        │
    │ Transmit →   │──── V2V features (160 KB/frame) ────→ Other vehicles
    │     ↓        │
    │ Receive ←    │←─── V2V features from fleet ────────
    │     ↓        │
    │ Fuse         │
    │     ↓        │
    │ Fused BEV    │
    │     ↓        │
    │ Detection +  │
    │ Planning     │
    └──────────────┘
```

### 10.2 Communication Protocol

```
Message format (per frame, per sender-receiver pair):
{
  "header": {
    "vehicle_id": uint16,
    "timestamp": float64,
    "pose": [x, y, z, roll, pitch, yaw],  // global frame
    "pose_covariance": float32[6],          // from GTSAM
    "sensor_health": uint8,                 // bitmask
    "feature_type": "BEV_compressed_v2"
  },
  "payload": {
    "spatial_indices": uint16[K, 2],        // selected locations (Where2comm)
    "features": float16[K, C_compressed],   // compressed features
    "confidence": float16[K]                // per-location confidence
  }
}

Size: ~40 bytes header + K * (4 + 2*C + 2) bytes payload
With K=256, C=8: ~40 + 256*(4+16+2) = ~5,672 bytes ≈ 5.5 KB per frame
At 10 Hz, 20 vehicles: 20 * 19 * 5.5 KB * 10 = 20.9 MB/s total network load
```

### 10.3 Phased Deployment

**Phase 1 (Months 1-3): Late Fusion ($10-20K)**
- Share detection boxes and tracks via ROS topics over 5G
- Minimal changes to existing perception pipeline
- Each vehicle publishes `/fleet/detections` topic
- Central aggregator or per-vehicle subscription
- Expected improvement: +10-15% detection recall (occlusion cases)

**Phase 2 (Months 4-8): Intermediate Fusion ($30-50K)**
- Deploy BEV feature extraction and compression modules
- Implement Where2comm-style spatial selection
- V2V feature exchange via custom ROS service
- Attention-based fusion on each vehicle's Orin
- Expected improvement: +18-22% mAP overall

**Phase 3 (Months 9-12): Fleet Intelligence ($50-80K)**
- Fleet occupancy map (edge server)
- Collective FOD detection pipeline
- Dynamic map updates from fleet consensus
- Heterogeneous agent support (HEAL-style)
- Expected improvement: +25-30% perception coverage

### 10.4 Cost Model

| Component | Phase 1 | Phase 2 | Phase 3 |
|-----------|---------|---------|---------|
| 5G modules (per vehicle) | $500 | (already installed) | (already installed) |
| Edge server (per airport) | $5,000 | $10,000 | $15,000 |
| Software development | $5,000 | $20,000 | $30,000 |
| Integration & testing | $5,000 | $10,000 | $15,000 |
| **Per-airport total** | **$15,000** | **$40,000** | **$60,000** |
| **Cumulative** | **$15,000** | **$55,000** | **$115,000** |

Per-vehicle marginal cost: $500-2,000 (5G module + software license)

---

## 11. Implementation on ROS/Orin

### 11.1 ROS Node Architecture

```python
#!/usr/bin/env python3
"""V2V Cooperative Perception ROS Node."""

import rospy
import numpy as np
from std_msgs.msg import Header
from sensor_msgs.msg import PointCloud2
from geometry_msgs.msg import PoseStamped
from fleet_msgs.msg import BEVFeatureMsg, CooperativeDetections  # custom msgs

class V2VCooperativePerception:
    """
    Subscribes to:
      /perception/bev_features  - ego vehicle's BEV features
      /localization/pose        - ego vehicle's global pose
      /fleet/v2v/features       - incoming features from fleet (multicast)
    
    Publishes:
      /fleet/v2v/ego_features   - ego's compressed features for fleet
      /perception/fused_bev     - cooperatively fused BEV features
      /perception/coop_status   - cooperation health metrics
    """
    
    def __init__(self):
        self.ego_id = rospy.get_param('~vehicle_id')
        self.max_cooperators = rospy.get_param('~max_cooperators', 5)
        self.max_delay_ms = rospy.get_param('~max_delay_ms', 100)
        self.compression_ratio = rospy.get_param('~compression_ratio', 64)
        
        # Feature buffer: {vehicle_id: (timestamp, pose, features)}
        self.feature_buffer = {}
        self.ego_features = None
        self.ego_pose = None
        
        # Load fusion model (CoBEVT or V2X-ViT, TensorRT optimized)
        self.fusion_model = self._load_fusion_model()
        self.compressor = self._load_compressor()
        
    def ego_bev_callback(self, msg):
        """Process ego BEV features, compress, and broadcast."""
        self.ego_features = self._decode_bev(msg)
        
        # Compress for transmission
        compressed = self.compressor.encode(self.ego_features)
        
        # Spatial selection (Where2comm)
        confidence = self.compressor.confidence_map(self.ego_features)
        top_k_indices = np.argsort(confidence.ravel())[-256:]  # top 256 locations
        
        # Publish for fleet
        out_msg = BEVFeatureMsg()
        out_msg.header.stamp = rospy.Time.now()
        out_msg.vehicle_id = self.ego_id
        out_msg.pose = self.ego_pose
        out_msg.spatial_indices = top_k_indices
        out_msg.features = compressed[top_k_indices]
        out_msg.confidence = confidence.ravel()[top_k_indices]
        self.pub_ego_features.publish(out_msg)
        
        # Fuse with buffered fleet features
        self._fuse_and_publish()
    
    def fleet_feature_callback(self, msg):
        """Receive and buffer features from other vehicles."""
        if msg.vehicle_id == self.ego_id:
            return  # ignore own echoed messages
        
        delay = (rospy.Time.now() - msg.header.stamp).to_sec() * 1000
        if delay > self.max_delay_ms:
            rospy.logwarn(f"Dropping stale V2V from vehicle {msg.vehicle_id}: {delay:.0f}ms")
            return
        
        # Decompress and store
        features = self.compressor.decode(msg.features, msg.spatial_indices)
        self.feature_buffer[msg.vehicle_id] = (
            msg.header.stamp.to_sec(),
            msg.pose,
            features,
            delay
        )
    
    def _fuse_and_publish(self):
        """Fuse ego + fleet features and publish."""
        if self.ego_features is None or self.ego_pose is None:
            return
        
        # Collect valid cooperator features
        cooperator_features = []
        current_time = rospy.Time.now().to_sec()
        
        for vid, (ts, pose, feats, delay) in self.feature_buffer.items():
            if current_time - ts < self.max_delay_ms / 1000:
                # Warp to ego frame
                warped = self._warp_to_ego(feats, pose, self.ego_pose)
                cooperator_features.append(warped)
        
        # Select K nearest cooperators
        cooperator_features = cooperator_features[:self.max_cooperators]
        
        if len(cooperator_features) == 0:
            # No cooperators — use ego only
            fused = self.ego_features
        else:
            # Attention-based fusion (CoBEVT/V2X-ViT, TensorRT)
            all_features = [self.ego_features] + cooperator_features
            fused = self.fusion_model.infer(all_features)
        
        self.pub_fused_bev.publish(self._encode_bev(fused))
```

### 11.2 Timing Budget on Orin

| Component | Time | Frequency |
|-----------|------|-----------|
| BEV feature extraction (ego) | Already in perception pipeline | 10 Hz |
| Feature compression (Where2comm) | 2-5 ms | 10 Hz |
| Feature transmission (5G) | 5-20 ms | 10 Hz |
| Feature reception + decompression | 1-3 ms | 10 Hz |
| Spatial warping (per cooperator) | 0.5-1 ms | 10 Hz |
| Attention fusion (CoBEVT, TensorRT) | 5-15 ms | 10 Hz |
| **Total cooperative overhead** | **15-45 ms** | **10 Hz** |

At 10 Hz (100ms budget), cooperative perception adds 15-45ms overhead. This fits within the planning cycle if perception runs at the start of the cycle and cooperative features are processed in parallel with planning.

---

## 12. Comparison Table

| Method | Year | Fusion Level | Bandwidth | mAP@0.7 | Latency Tolerant | Heterogeneous | Code |
|--------|------|-------------|-----------|---------|------------------|---------------|------|
| Early Fusion | - | Early | ~10 MB/s | Best | No | No | - |
| Late Fusion | - | Late | ~10 KB/s | 68.5% | Yes | Yes | - |
| AttFuse | 2022 | Intermediate | ~1 MB/s | 79.0% | No | No | OPV2V |
| DiscoNet | 2021 | Intermediate | ~0.5 MB/s | 78.2% | No | No | Yes |
| V2X-ViT | 2022 | Intermediate | ~1 MB/s | 82.1% | No | Partial | Yes |
| Where2comm | 2022 | Intermediate | ~0.16 MB/s | 75.3% | No | No | Yes |
| CoBEVT | 2023 | Intermediate | ~1 MB/s | 82.9% | No | No | Yes |
| CoAlign | 2024 | Intermediate | ~1 MB/s | 81.8% | Partial | No | Yes |
| CoBEVFlow | 2024 | Intermediate | ~1 MB/s | 84.5% | Yes | No | Yes |
| HEAL | 2024 | Intermediate | ~0.5 MB/s | 80.5% | No | Yes | Yes |
| MRCNet | 2024 | Intermediate | ~0.08 MB/s | 81.3% | No | No | Yes |
| V2X-R | 2025 | Intermediate | ~1 MB/s | 83.7% | Partial | Partial | Yes |

**Recommendation for airside:** Start with **CoBEVFlow** (best performance, latency-tolerant) + **Where2comm** (bandwidth selection) + **HEAL** (heterogeneous agents). The combination handles the three main airside challenges: communication delay, bandwidth limits, and fleet heterogeneity.

---

## 13. Key Findings

| # | Finding |
|---|---------|
| 1 | V2V cooperative perception improves mAP by +18-22% in standard benchmarks — larger gains expected on airside due to severe occlusion |
| 2 | Where2comm achieves 95.3% of full-sharing performance at 1/64th bandwidth (160 KB/frame) — feasible on airport 5G |
| 3 | CoBEVFlow handles asynchronous data (up to 200ms delay) via learned BEV flow compensation — critical for 5G latency |
| 4 | HEAL enables heterogeneous fleet fusion without retraining existing agents — essential for mixed airside fleets |
| 5 | Fleet occupancy map with Bayesian fusion provides near-complete coverage (>95%) with 5+ cooperating vehicles |
| 6 | Collective FOD detection: P(detect) rises from 0.3-0.6 (single) to 0.95-0.99 (fleet of 5) via multi-view consensus |
| 7 | Network load for 20-vehicle fleet with spatial selection: ~21 MB/s total — within airport 5G capacity |
| 8 | Cooperative perception adds 15-45ms overhead on Orin — fits within 100ms planning cycle |
| 9 | Pose accuracy requirement (±0.2m, ±0.5 deg) easily met by the reference airside AV stack's GTSAM (±0.02m, ±0.1 deg) |
| 10 | Phased deployment: $15K (late fusion) → $55K (intermediate) → $115K (fleet intelligence) |
| 11 | Byzantine-tolerant fusion requires ≥3 cooperative views to tolerate 1 malicious/faulty vehicle |
| 12 | Even one cooperating partner provides +13% mAP improvement — benefits start immediately with 2 vehicles |

---

## References

### Core Cooperative Perception
- Xu, R., et al. "OPV2V: An Open Benchmark Dataset and Fusion Pipeline for Perception with Vehicle-to-Vehicle Communication." ICRA 2022.
- Xu, R., et al. "V2X-ViT: Vehicle-to-Everything Cooperative Perception with Vision Transformer." ECCV 2022.
- Hu, Y., et al. "Where2comm: Communication-Efficient Collaborative Perception via Spatial Confidence Maps." NeurIPS 2022.
- Xu, R., et al. "CoBEVT: Cooperative Bird's Eye View Semantic Segmentation with Sparse Transformers." CoRL 2023.
- Li, Y., et al. "DiscoNet: Learning Distilled Collaboration Graph for Multi-Agent Perception." NeurIPS 2021.

### Temporal and Robust
- Wei, S., et al. "CoBEVFlow: Robust BEV Flow for Asynchronous Cooperative Perception." NeurIPS 2024.
- Lu, Y., et al. "CoAlign: Robust Collaborative 3D Object Detection in Presence of Pose Errors." ICRA 2024.

### Heterogeneous
- Lu, Y., et al. "HEAL: An Extensible Framework for Open Heterogeneous Collaborative Perception." ICLR 2024.

### Advanced
- Ma, H., et al. "V2X-R: Cooperative LiDAR-4D Radar Fusion for 3D Object Detection with Denoising Diffusion." CVPR 2025.
- Li, S., et al. "MRCNet: Multi-Resolution Compressed Features for Cooperative Perception." ECCV 2024.

### Datasets
- Xu, R., et al. "OPV2V: An Open Benchmark Dataset and Fusion Pipeline." ICRA 2022. [opv2v.github.io](https://opv2v.github.io)
- Yu, H., et al. "DAIR-V2X: A Large-Scale Dataset for Vehicle-Infrastructure Cooperative 3D Object Detection." CVPR 2022.
- Xu, R., et al. "V2V4Real: A Real-World Large-Scale Dataset for Vehicle-to-Vehicle Cooperative Perception." CVPR 2023.

---

*Document created: 2026-04-11*
*Complements: infrastructure-cooperative-perception.md (V2I), sensor-fusion-architectures.md (single-vehicle fusion), airport-5g-cbrs.md (communication layer)*
*Next steps: Phase 1 late fusion prototype using ROS topic relay, evaluate on fleet of 2 third-generation tug vehicles at test airport*
