# Occupancy Flow and 4D Scene Understanding for Autonomous Driving

## Per-Voxel Velocity Prediction, Scene Flow Estimation, and Dynamic Scene Reconstruction for Airport Airside Operations

**Last updated:** 2026-04-11

---

> **Key Takeaway:** Static 3D occupancy grids tell the planner *where* obstacles are but not *where they are going*. Occupancy flow extends this by attaching a 3D velocity vector to every occupied voxel, transforming static spatial maps into dynamic spatiotemporal predictions. For airport airside operations -- where baggage carts, pushback tractors, ground crew, and taxiing aircraft all move in tight quarters at varying speeds -- this distinction is the difference between reactive braking and predictive planning. Scene flow estimation provides the per-point motion foundation (ZeroFlow achieves 0.028m EPE3D on Argoverse 2 with zero-shot distillation), 4D occupancy forecasting extrapolates these flows into the future (UnO won the Argoverse 2 LiDAR Forecasting Challenge at CVPR 2024), and dynamic scene reconstruction enables replay-based simulation for testing. For Aurrigo's LiDAR-primary Orin deployment, the practical pipeline is: sparse voxelization (0.2-0.4m) + scene flow head (~8ms) + temporal aggregation (~12ms) + flow-aware planning integration -- fitting within a 50ms budget on Orin AGX and providing the velocity-aware safety margins that ISO 3691-4 implicitly requires.

---

## Table of Contents

1. [From Static Occupancy to Dynamic Flow](#1-from-static-occupancy-to-dynamic-flow)
2. [Scene Flow Estimation](#2-scene-flow-estimation)
3. [4D Occupancy Forecasting](#3-4d-occupancy-forecasting)
4. [Dynamic Scene Reconstruction](#4-dynamic-scene-reconstruction)
5. [Flow-Guided Planning and Control](#5-flow-guided-planning-and-control)
6. [Multi-Scale Temporal Modeling](#6-multi-scale-temporal-modeling)
7. [Evaluation Metrics and Benchmarks](#7-evaluation-metrics-and-benchmarks)
8. [Deployment on Edge Hardware](#8-deployment-on-edge-hardware)
9. [Practical Implementation](#9-practical-implementation)
10. [Key Takeaways](#10-key-takeaways)
11. [References](#11-references)

---

## 1. From Static Occupancy to Dynamic Flow

### 1.1 3D Occupancy Grids Recap

3D occupancy prediction divides the scene into a voxel grid and classifies each voxel as occupied or free, optionally with a semantic label. This representation gained momentum after Tesla's AI Day 2022 demonstration and has since been formalized through several benchmarks and architectures.

**Key benchmarks and methods (see `occupancy-networks-comparison.md` for full 20-method survey):**

| Benchmark / Method | Year | Resolution | Range | Classes | Key Contribution |
|-------------------|------|-----------|-------|---------|-----------------|
| **Occ3D-nuScenes** | NeurIPS 2023 | 0.4m | [-40m, 40m] x [-40m, 40m] x [-1m, 5.4m] | 16 + free | Standardized benchmark with visibility-aware labels |
| **SurroundOcc** | ICCV 2023 | 0.5m | [-50m, 50m] x [-50m, 50m] x [-5m, 3m] | 16 | Dense labels via Poisson reconstruction from LiDAR |
| **OpenOccupancy** | ICCV 2023 | 0.2m | [-51.2m, 51.2m]^2 x [-4m, 4m] | 16 | Denser annotations than Occ3D |
| **FlashOcc** | 2023 | 0.4m | Same as Occ3D | 16 | 197.6 FPS via channel-to-height, TensorRT-friendly |
| **SparseOcc** | ECCV 2024 | 0.4m | Same as Occ3D | 16 | Fully sparse pipeline, RayIoU metric |
| **GaussianFormer-2** | CVPR 2025 | Continuous | Continuous | 16 | Probabilistic Gaussians, 75-82% less memory |

These methods answer: **"Is voxel (x, y, z) occupied, and what class?"** But they do not answer: **"Where will voxel (x, y, z) be in 0.5 seconds?"**

### 1.2 Why Static Occupancy Is Insufficient for Planning

Consider three airside scenarios where static occupancy fails:

**Scenario 1: Baggage tractor approaching from the side.**
A static occupancy grid shows the tractor at position (10m, -5m) at time t. The planner sees free space ahead and proceeds. At t+0.5s, the tractor has moved to (10m, -2m), now intersecting the planned path. A static snapshot gave no warning -- the planner needed the tractor's velocity vector to predict the collision.

**Scenario 2: Aircraft pushback in progress.**
During pushback, the tail of an A320 sweeps through a 15-20m arc at ~1-3 km/h. A static grid at time t shows the tail at position P. The planner routes behind the aircraft. But the tail sweeps through the planned path over the next 10 seconds. Without temporal prediction, the planner sees "free" in a zone that will become "occupied."

**Scenario 3: Ground crew walking between equipment.**
Ramp personnel frequently cross between belt loaders and the aircraft fuselage -- a path that takes 2-3 seconds at walking speed. A static occupancy grid detects them at their current position but cannot predict their crossing trajectory. Safety requires predicting their position 2-5 seconds ahead.

**The fundamental limitation:** Static occupancy is a *photograph*. Planning requires a *video*. The transition from photograph to video is what occupancy flow provides.

### 1.3 Occupancy Flow Definition

**Occupancy flow** attaches a 3D velocity vector to every occupied voxel in the grid:

```
Static occupancy:
  O(x, y, z) -> {occupied, free} x {class_label}

Occupancy with flow:
  O(x, y, z) -> {occupied, free} x {class_label} x {v_x, v_y, v_z}

Where:
  (v_x, v_y, v_z) = velocity of the matter occupying voxel (x,y,z)
                     in m/s, in the ego vehicle frame
```

Tesla introduced this concept at AI Day 2022 as part of their occupancy network output. Each voxel produces not just an occupancy probability and semantic class, but a 3-channel flow vector indicating the direction and magnitude of motion.

**Properties of occupancy flow:**

| Property | Description |
|----------|-------------|
| **Per-voxel** | Every occupied voxel has its own velocity -- not per-object |
| **3D vectors** | Full (vx, vy, vz), unlike 2D optical flow |
| **Ego-relative** | Velocities are in the ego vehicle frame (ego-motion compensated) |
| **Dense** | Flow is defined for all occupied voxels, not just detected objects |
| **Class-agnostic motion** | Unknown objects still have flow vectors |

**Why per-voxel matters:** Object-level velocity (from tracking) assigns a single velocity to each object. But objects are not rigid points -- an aircraft wing tip moves at a different angular velocity than the nose gear during pushback. A belt loader's conveyor belt moves at a different velocity than the vehicle chassis. Per-voxel flow captures this articulated, non-rigid motion naturally.

### 1.4 Relationship to Scene Flow, Optical Flow, and Point Cloud Flow

Occupancy flow is one representation in a family of motion estimation approaches. Understanding the relationships clarifies when to use each:

```
                          Motion Estimation Family
                                    |
              +---------------------+---------------------+
              |                     |                     |
        2D Image Domain      3D Point Domain        3D Voxel Domain
              |                     |                     |
     +--------+--------+    +------+------+       +------+------+
     |                  |    |             |       |             |
Optical Flow    2D Scene  Scene Flow  Point   Occupancy    Occupancy
(per-pixel     Flow      (per-point  Cloud    Flow         Forecasting
 2D motion)   (2D->3D    3D motion)  Flow    (per-voxel    (future
               lifting)              (sparse  3D motion)    occupancy)
                                     -> dense)
```

| Representation | Domain | Density | Dimensionality | Input | Output |
|----------------|--------|---------|----------------|-------|--------|
| **Optical flow** | 2D image | Dense (per-pixel) | 2D (u, v) | RGB frames | Pixel displacement |
| **Scene flow** | 3D point cloud | Sparse (per-point) | 3D (dx, dy, dz) | Point cloud pair | Per-point 3D translation |
| **Point cloud flow** | 3D points | Sparse | 3D (dx, dy, dz) | Sequential scans | Point-to-point correspondence |
| **Occupancy flow** | 3D voxel grid | Dense (per-voxel) | 3D (vx, vy, vz) | Voxelized scenes | Per-voxel velocity |
| **4D occupancy** | 3D + time | Dense (spatiotemporal) | 4D volume | Temporal sequences | Future occupancy states |

**For Aurrigo's LiDAR-primary stack**, scene flow and occupancy flow are the most relevant:
- **Scene flow** operates directly on LiDAR point clouds -- no camera needed
- **Occupancy flow** operates on voxelized LiDAR -- matches the occupancy representation already planned for the stack
- Optical flow requires cameras and provides only 2D motion -- less useful for a LiDAR-primary system

### 1.5 4D = 3D Space + Time: Spatiotemporal Occupancy

The "4D" in 4D occupancy refers to 3D spatial occupancy extended across the time dimension:

```
4D Occupancy Tensor:
  O ∈ R^{X × Y × Z × T}

  where:
    X, Y, Z = spatial dimensions (e.g., 200 x 200 x 16 at 0.4m resolution)
    T = temporal dimension (e.g., 5-10 future timesteps at 0.5s intervals)

  Each element O[x, y, z, t] = P(occupied at spatial position (x,y,z) at time t)
```

**Two paradigms for 4D occupancy:**

1. **Explicit tensor**: Store the full 4D grid. Memory: X * Y * Z * T * sizeof(float). At 200^2 * 16 * 10 = 6.4M voxels, this is ~25MB per prediction -- manageable on Orin but grows fast at higher resolution.

2. **Implicit field**: Learn a function f(x, y, z, t) -> P(occupied). Query at arbitrary resolution and timestep. UnO uses this approach -- more memory-efficient for long horizons and variable resolution.

**Temporal horizons for airside planning:**

| Horizon | Duration | Resolution | Use Case |
|---------|----------|-----------|----------|
| **Immediate** | 0-0.5s | 50ms steps | Collision avoidance, emergency stop |
| **Short-term** | 0.5-2s | 200ms steps | Trajectory refinement, speed adaptation |
| **Medium-term** | 2-5s | 500ms steps | Path planning, merge/yield decisions |
| **Long-term** | 5-10s | 1s steps | Route planning, turnaround sequencing |

Airside speeds (5-30 km/h) mean the immediate horizon is less critical than highway driving (where 0.5s at 120 km/h = 16.7m). But the medium-term horizon is more important because airside interactions are longer-duration (pushback sequences last 3-5 minutes, turnaround positioning takes 30-60 seconds).

---

## 2. Scene Flow Estimation

Scene flow is the 3D motion field describing per-point displacement between consecutive LiDAR scans. It is the foundation upon which occupancy flow and 4D forecasting are built. For a LiDAR-primary stack, scene flow estimation operates directly on the native sensor modality.

### 2.1 Neural Scene Flow Prior (NSFP)

**Paper:** "Neural Scene Flow Prior" (Li et al., ICLR 2021)
**Key Insight:** Use a randomly-initialized neural network as an implicit regularizer for scene flow estimation -- the network's inductive bias toward smooth functions acts as a prior that prevents degenerate solutions.

**Architecture:**

```
Input: Point cloud pair (P_t, P_{t+1})

Neural Network:
  MLP(x, y, z) -> (dx, dy, dz)   # Per-point flow prediction
  
  Architecture: 8-layer MLP, 128 hidden units, ReLU
  Input: 3D coordinates of P_t
  Output: 3D displacement vectors

Optimization (at test time):
  For each point cloud pair:
    1. Initialize MLP with random weights
    2. Optimize weights to minimize:
       L = L_chamfer(P_t + flow, P_{t+1}) + λ * L_smooth(flow)
    3. Iterate for 500-1000 steps

Output: Per-point 3D flow vectors for P_t
```

**Results:**

| Metric | NSFP | FlowNet3D | HPLFlowNet |
|--------|------|-----------|------------|
| EPE3D (m) on FlyingThings3D | 0.0369 | 0.1136 | 0.0804 |
| Acc3D Strict (%) | 86.3 | 41.3 | 61.4 |
| Runtime per pair | ~60s | 0.02s | 0.12s |

**Limitation:** NSFP is an optimization-based method that runs at test time -- ~60 seconds per point cloud pair. Completely impractical for real-time deployment. But it established that neural networks are excellent scene flow priors, inspiring the feedforward methods below.

### 2.2 FastNSF and Optimization-Based Improvements

**FastNSF** (Li et al., CVPR 2023) accelerated NSFP by:

1. **Distance transform initialization**: Pre-compute signed distance field of target cloud, reducing optimization landscape complexity
2. **Coarse-to-fine optimization**: Start at low resolution, progressively refine
3. **Early stopping**: Convergence detection reduces unnecessary iterations

| Method | EPE3D (m) | Runtime | Speedup vs NSFP |
|--------|-----------|---------|-----------------|
| NSFP | 0.037 | ~60s | 1x |
| FastNSF | 0.039 | ~0.5s | 120x |
| Fast-NSF++ | 0.035 | ~0.3s | 200x |

Still too slow for real-time (>10 Hz), but practical for offline processing of recorded rosbags for dataset annotation and pseudo-label generation.

**NSFP-guided label generation pipeline for airside:**

```
Recorded Rosbag (4-8 LiDAR @ 10Hz)
        │
        ▼
Merge + ego-motion compensate (GTSAM poses)
        │
        ▼
NSFP optimization per consecutive pair (~0.5s/pair offline)
        │
        ▼
Per-point 3D flow pseudo-labels
        │
        ▼
Use as training supervision for feedforward scene flow network
```

### 2.3 ZeroFlow (ICLR 2024): Scalable Scene Flow via Zero-Shot Distillation

**Paper:** "ZeroFlow: Scalable Scene Flow via Distillation" (Vedder et al., ICLR 2024)
**arXiv:** [2305.10424](https://arxiv.org/abs/2305.10424)

ZeroFlow is the current practical standard for LiDAR scene flow. Its key innovation: use a slow optimization-based method (NSFP) as a **teacher** to generate pseudo-labels on a massive unlabeled dataset, then **distill** into a fast feedforward student network.

**Architecture:**

```
Teacher (offline, once):
  NSFP/FastNSF applied to millions of LiDAR pairs
  → Pseudo-label dataset of per-point 3D flow vectors
  
Student (feedforward, real-time):
  Input: (P_t, P_{t+1}) concatenated with timestamps
  Backbone: Point Transformer V3 (PTv3) or PointPillars variant
  Head: Per-point MLP → (dx, dy, dz)
  
  Single forward pass: ~20-50ms on A100
```

**Results on Argoverse 2 Scene Flow Benchmark:**

| Method | EPE3D (m) | Acc3D Strict (%) | Acc3D Relaxed (%) | Supervised? |
|--------|-----------|-------------------|--------------------|----|
| FlowNet3D | 0.177 | 8.2 | 33.1 | Yes (synthetic) |
| NSFP (teacher) | 0.059 | 35.6 | 71.4 | No (optimization) |
| **ZeroFlow-XL** | **0.028** | **67.2** | **88.3** | **No (distilled)** |
| ZeroFlow-L | 0.036 | 58.1 | 82.6 | No (distilled) |
| ZeroFlow-S | 0.051 | 42.3 | 72.1 | No (distilled) |

**Critical insight:** The student (ZeroFlow-XL) **surpasses the teacher** (NSFP) by 53% on EPE3D. This happens because distillation averages out the teacher's per-pair errors while retaining the overall motion prior. This is a rare and powerful property of distillation-based approaches.

**Airside relevance:**
- ZeroFlow's self-supervised pipeline means no annotated airside scene flow data is needed
- Generate pseudo-labels from recorded airside rosbags using FastNSF offline
- Distill into a real-time student network (PointPillars backbone for Orin)
- Result: a fast scene flow network that generalizes to airside without any human annotation

### 2.4 DeFlow (CVPR 2024): Decoder-Free Scene Flow

**Paper:** "DeFlow: Decoder-Free Scene Flow" (Chodosh et al., CVPR 2024)

DeFlow eliminates the explicit decoder stage, treating scene flow as a **direct regression from the backbone features**:

```
Input: Point cloud pair (P_t, P_{t+1})
       │
       ▼
Shared Backbone (e.g., MinkowskiNet sparse conv)
       │
       ├── Features for P_t:  F_t ∈ R^{N x C}
       └── Features for P_{t+1}: F_{t+1} ∈ R^{M x C}
       
Correlation:
  For each point in P_t, compute correlation with K-nearest 
  neighbors in F_{t+1} feature space
       │
       ▼
Direct regression: Linear(F_t || Correlation) → (dx, dy, dz)
  No iterative refinement, no decoder stack
```

**Results on Argoverse 2:**

| Method | EPE3D (m) | Dynamic EPE3D (m) | Params | FPS (A100) |
|--------|-----------|-------------------|--------|------------|
| ZeroFlow-XL | 0.028 | 0.063 | 124M | ~20 |
| **DeFlow** | **0.023** | **0.051** | 38M | ~35 |
| FastFlow3D | 0.051 | 0.118 | 15M | ~50 |

DeFlow achieves 18% better EPE3D than ZeroFlow-XL with 3.3x fewer parameters and 1.75x higher throughput. The decoder-free design is more TensorRT-friendly because it avoids iterative refinement loops.

### 2.5 Supervised Methods: FlowNet3D, HPLFlowNet, FLOT

These methods established the field but are now outperformed by self-supervised approaches:

**FlowNet3D** (Liu et al., CVPR 2019):
- First end-to-end deep learning method for scene flow
- Set-conv layers + flow embedding layer + set-upconv layers
- Trained on FlyingThings3D (synthetic) -- poor generalization to real LiDAR
- 0.177m EPE3D on Argoverse 2 (6x worse than ZeroFlow)

**HPLFlowNet** (Gu et al., CVPR 2019):
- Bilateral convolutional layers in permutohedral lattice space
- More efficient than PointNet-based approaches
- 0.0804m EPE3D on FlyingThings3D
- Still requires synthetic training data

**FLOT** (Puy et al., ECCV 2020):
- Optimal transport-inspired point matching
- Sinkhorn algorithm for soft correspondence
- Better generalization than FlowNet3D but slower (0.5s per pair)
- 0.052m EPE3D on FlyingThings3D

**Why supervised methods fell behind:** They require synthetic labeled data (FlyingThings3D), which has a significant domain gap to real LiDAR. Self-supervised methods (ZeroFlow, DeFlow) train on real data without labels and now dominate all benchmarks.

### 2.6 Self-Supervised Methods: PointPWC-Net, Self-Point-Flow

**PointPWC-Net** (Wu et al., CVPR 2020):
- Coarse-to-fine scene flow estimation inspired by PWC-Net (optical flow)
- Self-supervised via Chamfer distance + smoothness + Laplacian regularization
- Learnable cost volume in 3D point space
- 0.0588m EPE3D on FlyingThings3D (self-supervised)

**Self-Point-Flow** (Li et al., ICCV 2021):
- Self-supervised with pseudo-label bootstrapping
- Alternates between forward and backward flow for cycle consistency
- 0.051m EPE3D on KITTI (self-supervised)

**These pioneered the self-supervised paradigm** that ZeroFlow and DeFlow later scaled to state-of-the-art levels. The key insight: Chamfer distance between the warped source cloud and the target cloud provides a natural self-supervised loss for scene flow without any labels.

### 2.7 LiDAR-Native Flow Advantages

For a LiDAR-primary stack like Aurrigo's, scene flow estimation has fundamental advantages over camera-based alternatives:

| Property | Camera-Based Flow | LiDAR-Based Flow |
|----------|------------------|-----------------|
| **Dimensionality** | 2D (u, v) pixel displacement | 3D (dx, dy, dz) metric displacement |
| **Depth ambiguity** | Cannot resolve depth without stereo/mono depth | Inherent depth from range measurement |
| **Metric accuracy** | Requires depth estimation (10-20% error) | Direct metric flow (centimeter accuracy) |
| **Weather robustness** | Degrades in rain, fog, low light | LiDAR operates in fog, rain (degraded), darkness |
| **FOD detection** | Small objects at range: poor flow estimation | LiDAR detects 0.1m+ objects with flow |
| **Speed estimation** | Requires 3D lifting of 2D flow | Direct: ||flow|| / dt = speed in m/s |

**Computing velocity from scene flow:**

```python
# Given scene flow (dx, dy, dz) between frames at time dt apart:
velocity_x = dx / dt  # m/s
velocity_y = dy / dt  # m/s
velocity_z = dz / dt  # m/s
speed = sqrt(velocity_x**2 + velocity_y**2 + velocity_z**2)

# For Aurrigo's RoboSense at 10Hz:
# dt = 0.1s
# A baggage cart moving at 20 km/h = 5.56 m/s
# Scene flow magnitude: 5.56 * 0.1 = 0.556m per frame
# Well within LiDAR resolution (0.2m voxels) for detection
```

### 2.8 Airside Scene Flow Applications

**Tracking baggage carts and tugs from flow:**

Scene flow enables tracking-by-flow as an alternative or complement to traditional detect-then-track approaches (see `../perception/overview/multi-object-tracking.md`). Instead of detecting bounding boxes and matching them across frames, scene flow directly provides per-point motion vectors. Clustering points with similar flow vectors identifies coherent moving objects.

```
Per-point scene flow vectors
        │
        ▼
DBSCAN clustering on (x, y, z, vx, vy, vz) space
        │
        ▼
Clusters = individual moving objects
        │
        ▼
Cluster centroid velocity = object velocity
Cluster bounding box = object extent
```

**Advantages for airside:**
- No per-class detector needed -- any moving cluster is a tracked object
- Works for unusual objects (dropped luggage, loose equipment, FOD in motion)
- Handles articulated objects naturally (tractor + trailer have different flow vectors per segment)
- Ground crew detection: a moving cluster at pedestrian height (0.5-1.8m) with walking-speed flow (1-2 m/s) is a person

**Ground crew safety application:**

```
Scene flow for personnel near aircraft:
  1. Detect moving clusters with speed 0.5-2.0 m/s (walking speed)
  2. Filter by height: 0.5m < z < 2.0m (standing/crouching person)
  3. Predict position at t+2s: current_pos + velocity * 2.0
  4. Check predicted position against ego planned path
  5. If intersection within 3m → trigger caution/slow/stop

This works even when the person is not classified as "person"
by the object detector -- flow-based safety is class-agnostic.
```

---

## 3. 4D Occupancy Forecasting

4D occupancy forecasting extends scene flow from per-point displacement estimation to full volumetric prediction of future scene states. Instead of asking "where did each point go?" it asks "what will the entire 3D scene look like in 0.5, 1.0, 2.0, ... seconds?"

### 3.1 Cam4DOcc (NeurIPS 2023 / CVPR 2024)

**Paper:** "Cam4DOcc: Benchmark for Camera-Only 4D Occupancy Forecasting in Autonomous Driving"
**Authors:** Ma et al. (Haomo.AI)
**Venue:** CVPR 2024
**Code:** [github.com/haomo-ai/Cam4DOcc](https://github.com/haomo-ai/Cam4DOcc)

Cam4DOcc is primarily a **benchmark** rather than a single method. It provides:

1. **Standardized evaluation protocol** for 4D occupancy forecasting
2. **Four baseline categories** covering different forecasting paradigms
3. **Two dataset versions**: V1.1 (2 classes: occupied/free) and V1.2 (9 semantic classes)

**Benchmark specification:**

| Parameter | Value |
|-----------|-------|
| Voxel size | 0.2m |
| Volume size | [512, 512, 40] (102.4m x 102.4m x 8m) |
| Temporal range | Current + 4 future timesteps (2s at 2Hz) |
| Training sequences | 23,930 |
| Validation frames | 5,119 |
| Dataset base | nuScenes |
| Semantic classes (V1.2) | 9: barrier, bicycle, bus, car, construction, motorcycle, pedestrian, trailer, truck |

**Four baseline paradigms compared:**

| Paradigm | Description | Example | mIoU (V1.2) |
|----------|-------------|---------|--------------|
| **Copy-last** | Assume static world -- copy current occupancy to future | Naive baseline | 12.3 |
| **Voxel prediction** | Direct voxel-to-voxel forecasting via 3D ConvLSTM | Learned temporal model | 18.7 |
| **Instance prediction** | Detect instances, predict per-instance trajectory, re-render | Detect + forecast | 20.1 |
| **OCFNet** | End-to-end occupancy completion + forecasting | Joint model | 22.4 |

**Key finding from Cam4DOcc:** Even the best method (OCFNet) only reaches 22.4% mIoU for 4D forecasting -- substantially below static occupancy prediction (35-45% mIoU). **Forecasting the future is fundamentally harder than perceiving the present**, and the field has significant room for improvement.

**Airside relevance:** Cam4DOcc focuses on camera-only input and road driving classes. Neither is directly applicable to airside. However, the benchmark protocol (voxel-based evaluation of future occupancy) and the metric framework are reusable for an airside benchmark.

### 3.2 OccSora (2024): Diffusion-Based 4D Occupancy Generation

**Paper:** "OccSora: 4D Occupancy Generation Models as World Simulators for Autonomous Driving"
**Authors:** Zheng et al.
**Code:** [github.com/wzzheng/OccSora](https://github.com/wzzheng/OccSora)

OccSora applies diffusion-based generation (inspired by Sora) to the 4D occupancy domain. It is a **world simulator**, not a perception model -- its purpose is to generate plausible 4D occupancy sequences for training and testing.

**Architecture:**

```
4D Scene Tokenizer:
  Input: 3D occupancy sequence O_{t}, O_{t+1}, ..., O_{t+T}
  → Spatial tokenization: 3D occupancy → compact spatial tokens
  → Temporal compression: group spatial tokens across time
  → Output: discrete spatiotemporal token sequence

Diffusion Transformer (DiT-XL/2):
  Input: Noised token sequence + trajectory condition
  → Iterative denoising (1000-step DDPM, or 50-step DDIM)
  → Output: denoised 4D occupancy token sequence

4D Scene Decoder:
  Tokens → reconstruct 3D semantic occupancy per timestep
  → Output: 16-second occupancy video
```

**Results:**
- Generates 16-second occupancy sequences with authentic 3D layout
- Trajectory-conditioned: specify ego vehicle path, model generates consistent surroundings
- Requires A100 80GB for training
- Inference: ~2-5 seconds per 16-second sequence (not real-time)
- Pretrained weights NOT publicly available

**Airside application -- scenario generation:**

OccSora's value for airside is in **simulation and testing**, not real-time prediction. Given a map of an airport stand and a set of GSE trajectories, OccSora could generate plausible 4D occupancy sequences for:
- Testing planner responses to different turnaround configurations
- Augmenting training data with rare scenarios (two pushbacks on adjacent stands)
- Generating edge cases (crew member running across path during belt loader operation)

Cross-reference: See `diffusion-world-models.md` for the broader context of diffusion-based world simulators.

### 3.3 SelfOccFlow: Self-Supervised Joint Occupancy + Flow

**Paper:** "SelfOcc: Self-Supervised Vision-Based 3D Occupancy Prediction" (extended with flow)
**Approach:** Joint self-supervised prediction of occupancy and flow using neural rendering losses.

The core idea: if you predict occupancy and flow correctly, you should be able to **render** the future LiDAR scan (or camera image) by:
1. Starting with current occupancy O_t
2. Applying predicted flow F_t to transport occupancy to O_{t+1}
3. Rendering O_{t+1} into a synthetic LiDAR scan
4. Comparing with the actual future scan

This provides self-supervised training without any occupancy or flow labels.

**Loss formulation:**

```
L_total = L_render + λ_flow * L_flow_consistency + λ_smooth * L_smoothness

L_render = -sum_rays log P(ray terminates at observed depth | O_{t+k})
L_flow_consistency = ||O_t + F_t - O_{t+1}||  (flow should explain occupancy change)
L_smoothness = ||∇F_t||  (flow should be spatially smooth)
```

**Key results:**
- Self-supervised (no 3D labels)
- Joint occupancy + flow improves both tasks vs training each alone
- Flow consistency acts as temporal regularizer for occupancy
- Occupancy prediction improves by +1.2 mIoU when trained with flow auxiliary task

### 3.4 UnO (Waabi, CVPR 2024): Self-Supervised Occupancy Forecasting

**Full coverage in `lidar-native-world-models.md` -- summary here for context.**

UnO (Unsupervised Occupancy Fields) is the most relevant 4D occupancy forecasting method for Aurrigo's stack:

| Feature | UnO |
|---------|-----|
| Input modality | **LiDAR-only** |
| Supervision | **Self-supervised** (no annotations) |
| Output | Continuous occupancy + flow field |
| Representation | Implicit function f(x,y,z,t) → {P(occ), flow} |
| Benchmark result | **1st place** Argoverse 2 LiDAR Forecasting (CVPR 2024) |
| Resolution | Continuous (queryable at arbitrary resolution) |

**Why UnO is the top candidate for airside:**
1. LiDAR-only input matches Aurrigo's sensor configuration
2. Self-supervised training eliminates the annotation problem (no airside datasets exist)
3. Continuous representation enables adaptive resolution (fine near ego, coarse at distance)
4. Joint occupancy + flow output directly provides the velocity-aware grid the planner needs
5. Won the competitive Argoverse 2 benchmark against supervised methods

**UnO performance (Argoverse 2):**

| Metric | UnO | Best Supervised | Improvement |
|--------|-----|----------------|-------------|
| NFCD (m^2) | 0.71 | 0.83 | +14% |
| Chamfer Distance (m^2) | 7.02 | 8.12 | +13% |
| BEV mAP | 52.3 | 48.7 | +7% |

### 3.5 OCFNet: Occupancy Completion and Forecasting

**Paper:** "OCFNet: Occupancy Completion and Forecasting" (Li et al., 2024)

OCFNet jointly solves two problems:
1. **Completion**: Fill in unobserved (occluded) regions in the current occupancy grid
2. **Forecasting**: Predict future occupancy states

**Architecture:**

```
Input: Sparse current occupancy O_t (from LiDAR or camera)
          │
          ▼
  Completion Module:
    Sparse 3D conv encoder → dense feature volume
    → Semantic completion head (fill occluded regions)
    → Output: Dense completed O_t
          │
          ▼
  Forecasting Module:
    Temporal encoder (takes past completed grids)
    → 3D ConvGRU / ConvLSTM for temporal modeling
    → Future occupancy decoder
    → Output: O_{t+1}, ..., O_{t+K}
```

**Key innovation:** Completion before forecasting. If you don't complete the current scene (fill in behind the fuselage, behind the belt loader), your forecast will propagate the gaps. Completing first gives the forecasting module a full scene to reason about.

**Results (nuScenes):**

| Task | OCFNet | Copy-Last | Improvement |
|------|--------|-----------|-------------|
| Completion IoU | 34.2 | N/A | N/A |
| Forecast IoU @ 1s | 24.8 | 18.1 | +37% |
| Forecast IoU @ 2s | 19.3 | 12.3 | +57% |

**Airside insight:** Completion is especially valuable for airside because aircraft fuselages create massive occlusion zones (30-65m blind zones, per `../perception/overview/multi-object-tracking.md`). A completion module that hallucinates the occluded scene behind the fuselage enables the forecasting module to predict movements of ground crew or equipment hidden from direct LiDAR observation.

### 3.6 OccWorld (ECCV 2024)

**Detailed in `occworld-implementation.md` -- brief cross-reference here.**

OccWorld is a GPT-style autoregressive world model that operates on VQ-VAE tokenized occupancy:

- **Input**: 3D occupancy from any source (LiDAR-derived or camera-predicted)
- **Tokenizer**: VQ-VAE with 512-entry codebook, 256-dim embeddings
- **World model**: 6-layer transformer with temporal causal attention
- **Planning integration**: Joint occupancy forecasting + ego trajectory prediction
- **Results**: Avg IoU 26.63 (GT occ input), L2@3s 1.99m, Collision 1.35%

OccWorld does not explicitly predict per-voxel flow but implicitly captures dynamics through temporal occupancy evolution. The difference between consecutive predicted frames *is* the implicit flow.

### 3.7 ViDAR (NeurIPS 2024): Visual Point Cloud Forecasting for Pre-Training

**Paper:** "ViDAR: Visual Point Cloud Forecasting for Pre-Training"
**Authors:** Yang et al.
**Venue:** NeurIPS 2024

ViDAR uses point cloud forecasting as a **pre-training objective** rather than a deployment-time capability. The hypothesis: if a model can predict future point clouds from past camera observations, it has learned a rich spatiotemporal representation of the 3D world.

**Architecture:**

```
Past camera images (6-camera, T frames)
          │
          ▼
BEV Encoder (e.g., BEVFormer)
          │
          ▼
Future BEV Feature Predictor (Temporal Transformer)
          │
          ▼
Point Cloud Renderer (Predicted BEV → Predicted LiDAR scan)
          │
          ▼
Loss: Chamfer Distance between rendered and actual future LiDAR

After pre-training:
  Discard renderer, use BEV encoder + temporal features
  for downstream tasks (detection, segmentation, planning)
```

**Results:**

| Downstream Task | ViDAR Pre-trained | BEV Pre-trained | Improvement |
|----------------|-------------------|-----------------|-------------|
| 3D Detection (NDS) | 56.4 | 52.8 | +3.6 |
| BEV Segmentation (mIoU) | 48.3 | 44.1 | +4.2 |
| Occupancy Prediction | 34.8 | 31.2 | +3.6 |

**Key insight:** Predicting future point clouds forces the model to learn:
- Object permanence (objects exist even when occluded)
- Motion patterns (how different object classes move)
- Depth reasoning (cameras must infer depth to predict LiDAR)
- Scene dynamics (static vs dynamic scene elements)

**Airside relevance for pre-training:** If Aurrigo adds cameras in the future, ViDAR-style pre-training on road driving data could provide a strong initialization before fine-tuning on airside data. The pre-trained features encode general 3D understanding that transfers across domains.

### 3.8 Temporal Horizons: Short-Term vs Long-Term

The forecasting horizon determines both the architecture design and the practical utility:

**Short-term (0.5-2s):**
- **Use case**: Collision avoidance, immediate trajectory refinement
- **Accuracy**: High (motion is nearly linear over short horizons)
- **Architecture**: Direct flow propagation, no need for complex temporal models
- **Computation**: Light -- single flow step + propagation
- **Airside example**: "Will the baggage cart cross my path in the next 1 second?"

**Medium-term (2-5s):**
- **Use case**: Path planning, merge/yield decisions, speed adaptation
- **Accuracy**: Moderate (motion becomes nonlinear -- turns, accelerations)
- **Architecture**: Autoregressive or diffusion-based temporal models
- **Computation**: Moderate -- multiple timestep predictions
- **Airside example**: "Will the pushback tractor's swept volume intersect my planned route in the next 5 seconds?"

**Long-term (5-10s):**
- **Use case**: Route planning, turnaround sequencing, strategic decisions
- **Accuracy**: Low for precise positions, useful for occupancy probabilities
- **Architecture**: World models with action conditioning (OccWorld, UnO with temporal extension)
- **Computation**: Heavy -- full world model inference
- **Airside example**: "If I wait 10 seconds, will the belt loader have cleared Stand B14?"

**Accuracy degradation with horizon (typical):**

| Horizon | Occupancy IoU | Flow EPE3D (m) | Position Error (m) |
|---------|--------------|----------------|--------------------| 
| 0.5s | 30-35 | 0.05-0.1 | 0.1-0.3 |
| 1.0s | 25-30 | 0.1-0.2 | 0.3-0.8 |
| 2.0s | 18-22 | 0.2-0.5 | 0.8-2.0 |
| 3.0s | 14-18 | 0.4-1.0 | 1.5-4.0 |
| 5.0s | 10-14 | 0.8-2.0 | 3.0-8.0 |

For airside at 15 km/h, a 2m position error at 3s is still useful for conservative path planning -- it tells the planner "this region has a >50% chance of being occupied, plan around it."

---

## 4. Dynamic Scene Reconstruction

Dynamic scene reconstruction builds explicit 4D representations of the world that can be rendered from novel viewpoints and at novel times. While the primary use case is simulation and replay rather than real-time perception, these methods enable two critical capabilities: replay-based testing and what-if scenario generation.

### 4.1 DynamicCity (2024): Large-Scale 4D Scene Generation

**Paper:** "DynamicCity: Large-Scale LiDAR Generation from Layout Priors" (2024)

DynamicCity generates 4D LiDAR scenes at city scale with **compositional decomposition** -- separately modeling static background and dynamic foreground:

**Architecture:**

```
Input: Scene layout (road geometry + object trajectories)
          │
          ├── Static Background Generator:
          │     Layout → neural point cloud backbone
          │     → Dense static point cloud (buildings, roads, vegetation)
          │
          └── Dynamic Object Generator:
                Per-object trajectory + class
                → Object-specific neural model
                → Point cloud for each object at each timestep
          │
          ▼
Composition:
  Static background + positioned dynamic objects
  → Full 4D scene with temporal consistency
```

**Key capabilities:**
- Generates city-scale scenes (200m x 200m) with multiple dynamic objects
- Compositional: add/remove/modify individual objects without regenerating the scene
- Supports object insertion: place a virtual vehicle at a specific trajectory
- LiDAR-native output: generates point clouds directly (not images)

**Airside application:**
- Generate synthetic airside scenes: place aircraft at known stands, add GSE on expected trajectories
- Test edge cases: insert a ground crew member at specific positions near the ego vehicle
- Augment training data with rare configurations (two wide-body aircraft on adjacent stands)
- Generate counter-factual scenarios: "what if the baggage tractor had turned left instead of right?"

### 4.2 StreetGaussians and Dynamic 3D Gaussians

**StreetGaussians** (Yan et al., ECCV 2024): Dynamic scene modeling using separate Gaussian splat representations for static background and tracked dynamic objects.

**Architecture:**

```
Input: Multi-view images + LiDAR + tracked object poses
          │
          ├── Static Gaussians: Scene background (road, buildings)
          │     → Standard 3DGS optimization
          │
          └── Dynamic Gaussians per tracked object:
                Object point cloud → initialize Gaussians
                → Per-timestep rigid transform from tracking
                → Gaussian deformation field for articulation
          │
          ▼
Rendering:
  Compose static + transformed dynamic Gaussians
  → Rasterize from any viewpoint at any time
```

**Dynamic 3D Gaussians** (Luiten et al., 3DV 2024): An alternative that uses a single set of Gaussians with learned per-frame positions, covariances, and colors. Each Gaussian has a trajectory across time rather than a single position.

**Comparison:**

| Method | Rendering FPS | Dynamic Objects | Training Time | Input |
|--------|--------------|-----------------|---------------|-------|
| StreetGaussians | 120+ FPS | Per-object Gaussians | ~2 hours/scene | Camera + LiDAR |
| Dynamic 3DGS | 100+ FPS | Single Gaussian set | ~4 hours/scene | Camera + LiDAR |
| D-NeRF | 0.1 FPS | Deformation field | ~24 hours | Camera only |

**Airside digital twin application:** See `../simulation/digital-twin-3dgs.md` for the full 3DGS-based digital twin pipeline. StreetGaussians with tracked aircraft and GSE could reconstruct an entire turnaround sequence as a renderable 4D scene -- enabling replay from any camera angle for incident review, operator training, and planner validation.

### 4.3 4D Neural Radiance Fields

**D-NeRF** (Pumarola et al., CVPR 2021): Extended NeRF with a deformation network that maps a canonical space to per-timestep deformed space.

**K-Planes** (Fridovich-Keil et al., CVPR 2023): Decomposes the 4D (x,y,z,t) space into six planes: XY, XZ, YZ, XT, YT, ZT. Features are extracted from each plane and multiplied together. This planar factorization dramatically reduces memory compared to full 4D grids.

```
K-Planes factorization:
  F(x,y,z,t) = plane_XY(x,y) * plane_XZ(x,z) * plane_YZ(y,z) 
              * plane_XT(x,t) * plane_YT(y,t) * plane_ZT(z,t)
  
  Memory: O(6 * R^2) instead of O(R^4) for a 4D grid of resolution R
  For R=256: 6 * 256^2 = 393K entries vs 256^4 = 4.3B entries
  Reduction: ~10,900x
```

**HexPlane** (Cao & Johnson, CVPR 2023): Similar planar decomposition but with learnable feature projections and more efficient sampling:

| Method | Training Time | Novel View PSNR | Temporal Consistency |
|--------|--------------|-----------------|---------------------|
| D-NeRF | ~24 hours | 29.3 dB | Moderate (per-frame deformation) |
| K-Planes | ~30 min | 31.6 dB | Good (explicit temporal planes) |
| HexPlane | ~20 min | 31.0 dB | Good |
| 4D Gaussian Splatting | ~15 min | 32.4 dB | Best (per-Gaussian trajectories) |

### 4.4 Deformable 3D Gaussian Approaches

**Deformable-3DGS** (Yang et al., CVPR 2024):
- Learns a per-Gaussian deformation field: Δ(position, rotation, scale) = f(Gaussian_id, time)
- Implemented as a small MLP per deformation group
- Handles non-rigid deformation (important for articulated objects like belt loaders with extending conveyors)

**SC-GS** (Huang et al., CVPR 2024, Sparse-Controlled Gaussian Splatting):
- Uses a sparse set of control points with learnable displacements
- Gaussians are deformed via Linear Blend Skinning (LBS) from nearby control points
- 10-50x fewer parameters than Deformable-3DGS
- Better for real-time applications due to sparse deformation

| Method | Training Params | Rendering FPS | Non-Rigid Support |
|--------|----------------|---------------|-------------------|
| Deformable-3DGS | 2-5M deformation | 80-100 | Yes (per-Gaussian MLP) |
| SC-GS | 50-200K control points | 100-150 | Yes (LBS skinning) |
| 4D Gaussian Splatting | 1-2M trajectory params | 50-80 | Limited |

### 4.5 EmerNeRF: Emergent Temporal Representations

**Paper:** "EmerNeRF: Emergent Real-World Neural Radiance Fields" (Yang et al., ICLR 2024)

EmerNeRF learns to decompose a driving scene into static and dynamic components **without explicit supervision** -- the decomposition emerges from the training objective:

```
Input: Driving sequence (images + LiDAR + ego poses)
          │
          ▼
Static Field: NeRF for time-invariant scene elements
  σ_static, c_static = f_static(x, y, z, direction)
          │
          ▼
Dynamic Field: NeRF with temporal feature embedding
  σ_dynamic, c_dynamic, flow = f_dynamic(x, y, z, t, direction)
          │
          ▼
Composition: α-blending based on learned σ_static vs σ_dynamic
  → Rendering: volume render static + dynamic
  → Scene flow: extract 3D motion vectors from dynamic field
```

**Key results:**
- Emergent scene decomposition: accurately separates static background from moving objects
- Produces scene flow as a byproduct of temporal modeling
- 3D flow from the dynamic field correlates strongly with ground-truth scene flow
- No explicit object detection or tracking required

**Airside insight:** EmerNeRF's unsupervised static/dynamic decomposition is directly useful for airside operations -- it automatically identifies which parts of the scene are moving (GSE, crew, aircraft during pushback) vs static (terminal building, pavement markings, fixed equipment). This decomposition feeds into occupancy flow (static voxels have zero flow, dynamic voxels have learned flow vectors).

### 4.6 PeriFlow: Streaming 4D Scene Reconstruction

**Paper:** "PeriFlow: Streaming 4D World Reconstruction" (2024)

PeriFlow addresses a practical limitation of prior work: most 4D reconstruction methods require the full sequence to be available before processing (batch optimization). PeriFlow processes the sequence **online** as frames arrive:

```
t=0: Initialize scene with first LiDAR scan
     → Static Gaussians from initial point cloud

t=1: New scan arrives
     → Identify new observations (not explained by existing Gaussians)
     → Add new Gaussians / update existing
     → Estimate flow for dynamic Gaussians
     → Prune Gaussians no longer observed

t=2, 3, ...: Incremental update
     → Running reconstruction that grows with new observations
     → Maintains temporal consistency via flow-based prediction
```

**Key properties:**
- Online processing: 50-100ms per frame update (compatible with 10Hz LiDAR)
- Memory-bounded: prunes old Gaussians, maintains fixed-size representation
- Flow-based prediction: uses estimated flow to predict where Gaussians will be in the next frame, improving matching

**Airside streaming reconstruction:**
For airside operations, PeriFlow's streaming approach enables building a live 4D model of the scene that:
- Continuously updates as the ego vehicle moves through the stand area
- Tracks GSE and personnel as deforming Gaussian clusters
- Predicts near-future Gaussian positions from learned flow
- Provides a renderable 3D representation for operator HMI visualization (see `../../operations/deployment/hmi-operator-interface.md`)

### 4.7 Applications: Replay-Based Simulation and What-If Scenarios

**Replay simulation** (see `../simulation/digital-twin-3dgs.md`):

Dynamic scene reconstruction enables high-fidelity replay of recorded driving sequences:

```
Recorded Sequence (rosbag: LiDAR + camera + GPS/IMU)
          │
          ▼
4D Reconstruction (StreetGaussians / EmerNeRF / Deformable-3DGS)
          │
          ▼
Reconstructed 4D Scene (renderable from any viewpoint/time)
          │
          ├── Replay: re-render from ego viewpoint → validate perception
          ├── Novel view: render from different position → test blind spots
          ├── Object removal: remove a GSE, test detection without it
          └── Object insertion: add a virtual person, test safety response
```

**What-if scenario generation:**

The compositional structure of methods like StreetGaussians enables modifying individual scene elements:

| Modification | Method | Use Case |
|--------------|--------|----------|
| Change object trajectory | Re-pose dynamic Gaussians | "What if the tractor turned left?" |
| Add new object | Insert from library | "What if a crew member appeared here?" |
| Remove object | Inpaint static background | "What if the belt loader wasn't present?" |
| Change speed | Rescale temporal trajectory | "What if the aircraft taxied faster?" |
| Weather change | Modify Gaussian appearance | "What does this scene look like in rain?" |

This enables systematic safety testing without physical deployment -- generating thousands of scenario variations from a single recorded pass.

---

## 5. Flow-Guided Planning and Control

### 5.1 Using Occupancy Flow for Collision Avoidance

Static occupancy enables binary collision checking: "Is my planned path occupied?" Occupancy flow enables **predictive** collision checking: "Will my planned path become occupied?"

**Velocity-aware safety margins:**

```
Traditional safety margin (static):
  d_safe = d_min (fixed, e.g., 3m from personnel)

Flow-aware safety margin (dynamic):
  d_safe(t) = d_min + v_obstacle * t_prediction + v_ego * t_reaction

  where:
    v_obstacle = ||flow(voxel)|| -- speed of approaching obstacle
    t_prediction = forecasting horizon (e.g., 2s)
    t_reaction = system reaction time (e.g., 0.3s)
    v_ego = ego vehicle speed

Example:
  Personnel walking toward ego path at 1.5 m/s:
    d_safe = 2m + 1.5 * 2.0 + (15/3.6) * 0.3 = 2 + 3.0 + 1.25 = 6.25m

  Static belt loader:
    d_safe = 2m + 0 + (15/3.6) * 0.3 = 2 + 0 + 1.25 = 3.25m
```

The flow-aware margin is larger for approaching objects and identical to the static margin for stationary objects. This prevents unnecessary conservatism (stopping 6m from a parked loader) while ensuring adequate margin for approaching hazards.

**Integration with CBF safety filter (see `../planning/safety-critical-planning-cbf.md`):**

```
h_flow(x) = d(x, obstacle) - d_safe(v_obstacle)

where:
  d(x, obstacle) = signed distance from ego to nearest occupied voxel
  d_safe(v_obstacle) = flow-aware margin (velocity-dependent)

CBF constraint:
  h_dot(x, u) + α * h(x) >= 0

This constraint is velocity-aware: the CBF tightens when obstacles 
approach (high flow toward ego) and relaxes when they recede.
```

### 5.2 Flow-Based vs Trajectory-Based Motion Prediction

Two paradigms exist for predicting how other agents will move. Understanding the tradeoffs is critical for choosing the right approach for airside:

| Aspect | Trajectory Prediction | Flow-Based Prediction |
|--------|----------------------|----------------------|
| **Output** | Per-agent trajectory (x,y,z @ t) | Per-voxel velocity field |
| **Requires** | Detection + tracking | Occupancy + flow network |
| **Unknown objects** | Cannot predict (not detected) | Naturally predicted (all occupied voxels have flow) |
| **Articulated objects** | Single trajectory per object | Per-voxel motion (captures articulation) |
| **Multi-modal futures** | K trajectory hypotheses per agent | Probabilistic occupancy at each voxel |
| **Computational cost** | O(N_agents * K_modes) | O(V_occupied) -- independent of agent count |
| **Occlusion handling** | Lost track → no prediction | Occupancy completion → flow for hidden regions |
| **Interpretability** | High (explicit trajectories) | Moderate (velocity fields require visualization) |

**For airside, flow-based prediction has key advantages:**
1. **Class-agnostic**: Works for all GSE types without per-type detectors
2. **Articulated motion**: Captures belt loader extension, conveyor movement
3. **Crowd flow**: Models aggregate crew movement patterns without per-person tracking
4. **Unknown FOD**: Predicts motion of unclassified objects on the apron

**For planning integration, trajectory prediction has advantages:**
1. **Discrete agent reasoning**: "Will Agent #3 yield?" requires agent identity
2. **Intent prediction**: Trajectories encode intent (turning, stopping)
3. **Interaction modeling**: Game-theoretic planning (GameFormer) needs per-agent trajectories

**Recommended hybrid for airside:**

```
Scene Flow (per-point 3D motion)
        │
        ├── Aggregate to occupancy flow (per-voxel velocity)
        │     → Safety layer: velocity-aware margins
        │     → CBF constraint: flow-augmented h(x)
        │
        └── Cluster into agent trajectories (via tracking)
              → Planning layer: per-agent trajectory prediction
              → Interaction modeling: right-of-way reasoning
```

### 5.3 ST-P3 (NeurIPS 2022): Spatial-Temporal Feature Learning for Planning

**Paper:** "ST-P3: End-to-End Vision-Based Autonomous Driving via Spatial Temporal Feature Learning"
**Authors:** Hu et al.
**Venue:** NeurIPS 2022

ST-P3 was an early demonstration that spatiotemporal occupancy features improve planning:

**Architecture:**

```
Multi-camera images (T frames)
          │
          ▼
BEV Feature Extraction (LSS-based)
          │
          ▼
Spatial-Temporal Feature Pyramid:
  BEV features at t-2, t-1, t
  → 3D Conv temporal fusion
  → Multi-scale feature pyramid (fine + coarse)
          │
          ├── Perception head: BEV segmentation, 3D detection
          ├── Prediction head: Future BEV occupancy
          └── Planning head: Trajectory prediction from features
```

**Key results:**

| Task | ST-P3 | Without Temporal | Improvement |
|------|-------|-----------------|-------------|
| Planning L2@3s (m) | 2.21 | 3.47 | 36% |
| Collision rate (%) | 1.27 | 2.89 | 56% |
| BEV segmentation (IoU) | 35.8 | 31.2 | +4.6 |

**Takeaway:** Adding temporal (4D) features to the perception representation significantly improves planning, even with a simple temporal fusion approach (3D convolution over time). This validates the premise that planning needs dynamics, not just statics.

### 5.4 OccNet (Tesla): Occupancy Network for Prediction and Planning

Tesla's production occupancy network (AI Day 2022) demonstrated the end-to-end pipeline:

```
8 cameras → RegNet/BiFPN backbone → Attention-based 2D-to-3D lifting
  → 3D feature volume (current)
  → Temporal fusion (past volumes aligned by ego-motion)
  → 4D spatiotemporal feature volume
          │
          ├── Occupancy head: per-voxel occupied/free + semantic class
          ├── Flow head: per-voxel (vx, vy, vz) velocity
          └── Planning interface: query future occupancy along candidate paths
```

**Production metrics (as reported by Tesla):**
- Runs at **>100 FPS** on Tesla FSD HW3 (72 TOPS)
- Handles arbitrary unknown objects
- Flow vectors enable moving vs. stationary classification
- NeRF-based fleet validation pipeline for quality assurance

**Key lesson for airside:** Tesla proved that occupancy + flow is a viable production representation for planning. Their system runs on hardware with less compute than Orin AGX (72 TOPS vs 275 TOPS), suggesting the approach is feasible for edge deployment.

### 5.5 BEVFlow and Flow-Based Planning

**BEV-Flow approaches** operate in the BEV (bird's-eye view) plane rather than full 3D, trading vertical resolution for computational efficiency:

```
BEV Occupancy Grid (H x W)
          │
          ▼
BEV Flow Prediction:
  Input: BEV_t-2, BEV_t-1, BEV_t
  Conv backbone → per-cell (vx, vy) BEV flow
          │
          ▼
Future BEV Propagation:
  BEV_{t+k} = Warp(BEV_t, flow * k)  (linear approximation)
  or:
  BEV_{t+k} = Warp(BEV_{t+k-1}, predicted_flow_{t+k-1})  (autoregressive)
          │
          ▼
Planning:
  For each candidate trajectory:
    Check intersection with propagated BEV occupancy at each timestep
    Cost = sum of occupancy probabilities along path
```

**Advantages of BEV flow:**
- 2D instead of 3D: ~16x less memory (collapse height dimension)
- Faster inference: ~5-10ms on Orin for BEV flow estimation
- Sufficient for ground vehicles (most relevant motion is horizontal)
- Directly interfaces with BEV-based planning representations

**Limitation for airside:** Aircraft have significant vertical extent (tail height 12-16m) and wing tips extend at different heights. BEV flow loses this vertical information. For airside, a 2.5D approach (BEV + height map + flow) may be the practical compromise.

### 5.6 Integration with Frenet Planner

Aurrigo's current Frenet planner generates 420 trajectory candidates per cycle and selects the best one via cost function evaluation. Occupancy flow integrates at the cost function level:

**Current Frenet cost function:**

```
cost = w_d * d_lateral + w_v * (v - v_target)^2 + w_j * jerk + w_obs * obstacle_cost

where obstacle_cost = 1/d_min for nearest detected object (static snapshot)
```

**Flow-augmented Frenet cost function:**

```python
def flow_augmented_cost(trajectory, occupancy_grid, flow_field, dt=0.1):
    """
    Evaluate trajectory cost using occupancy flow prediction.
    
    Args:
        trajectory: [(x, y, theta, v, t), ...] -- Frenet candidate
        occupancy_grid: O[x, y, z] current occupancy
        flow_field: F[x, y, z] = (vx, vy, vz) per-voxel velocity
        dt: timestep for flow propagation
    """
    total_cost = 0.0
    
    for (x_ego, y_ego, theta, v, t) in trajectory:
        # Propagate occupancy to time t using flow
        t_steps = int(t / dt)
        predicted_occ = propagate_occupancy(occupancy_grid, flow_field, t_steps, dt)
        
        # Query occupancy at ego position (with swept volume)
        swept_volume = get_vehicle_footprint(x_ego, y_ego, theta)
        occ_cost = query_occupancy(predicted_occ, swept_volume)
        
        # Flow-aware proximity cost
        nearby_flow = get_flow_at(flow_field, x_ego, y_ego)
        closing_speed = compute_closing_speed(nearby_flow, v, theta)
        proximity_cost = closing_speed / (distance_to_nearest_occupied + epsilon)
        
        total_cost += occ_cost + lambda_prox * proximity_cost
    
    return total_cost


def propagate_occupancy(occ, flow, steps, dt):
    """Simple Euler propagation of occupancy along flow vectors."""
    current = occ.copy()
    for step in range(steps):
        # Shift each occupied voxel by its flow vector * dt
        current = advect(current, flow, dt)
    return current
```

**Expected improvement from flow integration:**

| Metric | Static-only Frenet | Flow-augmented Frenet | Improvement |
|--------|-------------------|----------------------|-------------|
| Collision rate | 2-5% (reactive only) | 0.5-1.5% (predictive) | 60-70% |
| Unnecessary stops | 15-20% (conservative margins) | 5-10% (velocity-aware margins) | 50-67% |
| Smoothness (jerk) | Higher (late reactions) | Lower (early avoidance) | 20-30% |

### 5.7 Airside Planning with Occupancy Flow

**Aircraft taxi path prediction:**

Aircraft taxiing follow prescribed routes at known speeds. Occupancy flow from a LiDAR world model directly predicts the swept volume:

```
Current aircraft occupancy: large cluster, ~35m long, 36m wingspan
Current flow: (vx=2.8, vy=0.1) m/s -- taxiing at ~10 km/h, slight turn

Predicted at t+5s:
  Propagate flow: aircraft occupancy shifts (14m, 0.5m) forward
  Plus rotation from flow gradient across the wingspan
  → Predicted future swept volume: 14m x 36m x 16m region

Planning: Ego vehicle should not enter this region for the next 5 seconds
```

**Conveyor belt trajectory prediction:**

Belt loaders have an extending conveyor that moves toward the aircraft cargo door. The conveyor extends at ~0.3-0.5 m/s over 5-8 seconds. Occupancy flow captures this non-rigid extension:

```
Belt loader body: zero flow (stationary)
Conveyor section: flow = (0.4, 0, 0.1) m/s -- extending and rising

The planner sees that the conveyor region is growing toward the aircraft.
If the ego path passes through the extension zone, the planner routes around.
```

**Crew movement prediction:**

Ground crew move in semi-predictable patterns during turnaround:
- Walk from equipment to aircraft door (straight-line, 1-2 m/s)
- Work near landing gear (stationary or slow movement)
- Run during emergency (2-4 m/s, unpredictable direction)

Flow-based prediction handles the first two patterns naturally. The third requires a safety fallback: if a crew member's flow magnitude suddenly increases (running), expand the safety margin beyond flow-predicted position to account for unpredictable direction changes.

---

## 6. Multi-Scale Temporal Modeling

4D scene understanding requires modeling dynamics at multiple temporal scales. A pushback sequence lasts 3-5 minutes (long-term), the tractor's steering inputs change every 1-2 seconds (medium-term), and vibration from the engine is at 50-100 Hz (not perceptually relevant). Efficient temporal architectures must capture the relevant scales without being overwhelmed by high-frequency noise.

### 6.1 Hierarchical Temporal Representations

```
Temporal Hierarchy for Airside 4D Understanding:

Level 0: Raw sensor (10-100 Hz)
  └── Point cloud at each LiDAR rotation
  └── Purpose: immediate collision detection

Level 1: Frame-level (2-10 Hz)
  └── Aggregated multi-LiDAR scan, ego-motion compensated
  └── Purpose: scene flow estimation, occupancy prediction

Level 2: Action-level (0.5-2 Hz)
  └── Smoothed occupancy + flow, agent state estimation
  └── Purpose: trajectory prediction, planning decisions

Level 3: Maneuver-level (0.1-0.2 Hz)
  └── Activity recognition (pushback phase, loading phase)
  └── Purpose: turnaround scheduling, strategic routing

Level 4: Mission-level (0.01 Hz)
  └── Turnaround progress, fleet state
  └── Purpose: dispatch decisions, multi-vehicle coordination
```

**Architectural implication:** Different temporal levels require different model architectures:

| Level | Temporal Scale | Architecture | Compute on Orin |
|-------|---------------|-------------|-----------------|
| L0 | 10-100 Hz | Direct LiDAR processing | 3-7 ms |
| L1 | 2-10 Hz | Scene flow + occupancy | 15-30 ms |
| L2 | 0.5-2 Hz | Temporal transformer / GRU | 10-20 ms |
| L3 | 0.1-0.2 Hz | Activity recognition CNN | 20-50 ms (low freq) |
| L4 | 0.01 Hz | VLM reasoning (see `../vla-vlm/vlm-scene-understanding.md`) | 300+ ms (async) |

### 6.2 Temporal Attention Mechanisms

**4D Attention (Space-Time Transformers):**

Standard 3D attention over a voxel grid of size (X, Y, Z) has complexity O((X*Y*Z)^2). Adding time T makes it O((X*Y*Z*T)^2) -- utterly intractable.

**Factored attention approaches:**

```
Option 1: Spatial-then-temporal (most common)
  For each timestep:
    Spatial attention over (X, Y, Z) voxels → spatial features
  Then:
    Temporal attention over T timesteps → spatiotemporal features
  
  Complexity: O(T * (XYZ)^2 + XYZ * T^2)
  This is the approach used by OccWorld, BEVFormer, UniAD

Option 2: Local spatial + global temporal
  Local spatial: attend within r-radius neighborhood
  Global temporal: full attention across all T timesteps
  
  Complexity: O(T * XYZ * r^3 + XYZ * T^2)
  Reduces spatial complexity, keeps full temporal receptive field

Option 3: Windowed spatiotemporal
  Divide (X, Y, Z, T) into windows of size (wx, wy, wz, wt)
  Attend within each window + cross-window communication
  
  Complexity: O(XYZ*T * (wx*wy*wz*wt))
  Used by Swin-style architectures (Video Swin Transformer)
```

**BEV temporal attention (practical for Orin):**

For deployment, BEV temporal attention is the most practical:

```python
class BEVTemporalAttention(nn.Module):
    """
    Efficient temporal attention over BEV features.
    BEV collapses height: (X, Y, T) instead of (X, Y, Z, T).
    """
    def __init__(self, embed_dim=256, num_heads=8, num_frames=5):
        super().__init__()
        self.temporal_attn = nn.MultiheadAttention(embed_dim, num_heads)
        self.norm = nn.LayerNorm(embed_dim)
        
    def forward(self, bev_features_seq):
        """
        Args:
            bev_features_seq: (T, H*W, C) -- T frames of BEV features
        Returns:
            fused: (H*W, C) -- temporally fused BEV features
        """
        # Each BEV cell attends to its temporal history
        # T=5 frames, H*W=200*200=40000 cells, C=256 channels
        # Attention: O(40000 * 5^2) per layer -- fast on Orin
        
        query = bev_features_seq[-1:]  # Current frame as query
        key = bev_features_seq  # All frames as key/value
        value = bev_features_seq
        
        fused, _ = self.temporal_attn(query, key, value)
        return self.norm(fused.squeeze(0) + bev_features_seq[-1])
```

### 6.3 Mamba/SSM for Efficient Temporal Modeling

Mamba (Structured State Space Models) offers an alternative to attention for temporal modeling with **linear** complexity in sequence length (see `../perception/overview/lidar-foundation-models.md` for Mamba in perception):

**DriveMamba** achieved:
- 42% L2 reduction vs UniAD
- 3.2x faster inference
- 68.8% less GPU memory
- Linear O(T) vs quadratic O(T^2) temporal complexity

**Why Mamba matters for 4D occupancy:**

| Property | Attention | Mamba/SSM |
|----------|-----------|-----------|
| Temporal complexity | O(T^2) | O(T) |
| Memory for T=50 frames | ~8 GB | ~2 GB |
| Long-range dependency | Full (but expensive) | Selective (hardware-efficient) |
| Causal (autoregressive) | Requires masking | Naturally causal |
| Orin support | Full (TensorRT attention) | Partial (custom CUDA kernels needed) |

**Practical limitation on Orin:** Mamba requires custom CUDA kernels (selective scan) that are not natively supported by TensorRT. Deployment requires either:
1. Custom CUDA kernel compilation for Orin (JetPack 5.x + CUDA 11.4)
2. Approximation via standard ops (loses some efficiency)
3. Waiting for TensorRT Mamba support (NVIDIA is working on this)

For the near term, standard temporal attention (5-10 frames at BEV resolution) is more deployment-friendly on Orin.

### 6.4 Recurrent vs Attention-Based Temporal Fusion

**Recurrent approaches (GRU, LSTM, ConvGRU):**

```
Advantages:
  + Fixed memory per timestep (hidden state is constant size)
  + Naturally causal (process frames sequentially)
  + TensorRT-friendly (standard ops)
  + Proven on Orin: 5-10ms for ConvGRU update

Disadvantages:
  - Gradient vanishing for long sequences (>20 frames)
  - Cannot attend to arbitrary past (fixed hidden state)
  - Sequential processing (cannot parallelize over time)
```

**Attention approaches (Temporal Transformer):**

```
Advantages:
  + Direct attention to any past frame
  + Parallelizable over time dimension
  + Better for long-range dependencies (10+ seconds)
  + State-of-the-art accuracy on all benchmarks

Disadvantages:
  - O(T^2) memory and compute
  - Requires storing all past features (memory grows with T)
  - Harder to deploy efficiently on edge hardware
```

**Recommended for Orin deployment:**

```
Hybrid approach:
  Short-term (last 5 frames, 0.5s): Temporal attention
    → Full attention over recent history
    → Captures fine-grained dynamics (acceleration, turning)
    → ~12ms on Orin
    
  Long-term (5-50 frames, 0.5-5s): ConvGRU summary
    → Compress older frames into fixed-size hidden state
    → Captures persistent scene structure
    → ~5ms per update on Orin
    
  Total temporal modeling: ~17ms on Orin
```

### 6.5 Memory-Efficient Implementations for Orin

**Gradient checkpointing (training only):**
- Trade compute for memory: recompute intermediate activations during backward pass
- Reduces training memory by ~40% at ~30% compute increase
- Critical for training 4D models on limited GPU memory

**Feature quantization (inference):**
- Store temporal buffer in FP16 or INT8 instead of FP32
- 2-4x memory reduction with <1% accuracy loss
- Orin's Tensor Cores natively operate on FP16/INT8

**Temporal buffer management:**

```
Sliding Window (simple, bounded memory):
  Maintain buffer of last T frames
  When new frame arrives: drop oldest, append new
  Memory: T * feature_size (constant)
  
  For T=10, BEV 200x200, C=256, FP16:
    10 * 200 * 200 * 256 * 2 bytes = 204.8 MB

Keyframe + Interpolation (efficient, variable resolution):
  Store every K-th frame as keyframe (full features)
  Interpolate between keyframes for intermediate queries
  Memory: (T/K) * feature_size (reduced by factor K)
  
  For K=3: ~68 MB (3.3x reduction)

Compressed Memory (most efficient):
  ConvGRU hidden state: fixed size regardless of T
  Memory: H * W * hidden_dim * 2 bytes
  
  For 200x200, hidden=128, FP16: 10.2 MB
```

**Orin memory budget for 4D occupancy pipeline:**

| Component | Memory | Notes |
|-----------|--------|-------|
| Current occupancy grid (200^2 * 16, FP16) | 2.56 MB | Single frame |
| Flow field (200^2 * 16 * 3, FP16) | 7.68 MB | 3-channel velocity |
| Temporal buffer (10 frames, BEV, FP16) | 204.8 MB | Sliding window |
| Model weights (occupancy + flow network) | 80-200 MB | Depends on architecture |
| TensorRT execution workspace | 200-500 MB | Runtime allocation |
| **Total** | **~500 MB - 1 GB** | **Well within 6-10 GB budget** |

---

## 7. Evaluation Metrics and Benchmarks

### 7.1 Occupancy Prediction Benchmarks

**Occ3D-nuScenes (primary benchmark):**

| Parameter | Value |
|-----------|-------|
| Base dataset | nuScenes (700 train / 150 val scenes) |
| Voxel resolution | 0.4m |
| Range | [-40m, 40m] x [-40m, 40m] x [-1m, 5.4m] |
| Grid size | 200 x 200 x 16 |
| Semantic classes | 16 (+ free space) |
| Primary metric | mIoU (mean Intersection over Union) |
| Visibility-aware | Yes (only evaluates visible voxels) |

**OpenOccupancy (denser labels):**

| Parameter | Value |
|-----------|-------|
| Base dataset | nuScenes |
| Voxel resolution | 0.2m |
| Range | [-51.2m, 51.2m] x [-51.2m, 51.2m] x [-4m, 4m] |
| Grid size | 512 x 512 x 40 |
| Semantic classes | 16 |
| Primary metric | mIoU |
| Label generation | Multi-frame LiDAR + semantic augmentation |

**SurroundOcc:**

| Parameter | Value |
|-----------|-------|
| Voxel resolution | 0.5m |
| Range | [-50m, 50m] x [-50m, 50m] x [-5m, 3m] |
| Label generation | Multi-frame LiDAR + Poisson reconstruction |

**SOTA results (as of early 2026):**

| Method | Occ3D mIoU | Input | FPS (A100) | Notes |
|--------|-----------|-------|------------|-------|
| FB-OCC (ensemble) | 52.79 | Camera | N/A | 1st place challenge (1200M params) |
| FB-OCC (R50) | 39.1 | Camera | 10.3 | Practical single model |
| PanoOcc | 42.13 | Camera | 6.7 | Panoptic + occupancy |
| SparseOcc | 40.3 | Camera | 12.5 | Fully sparse, 16-frame |
| FlashOcc (M4) | 32.90 | Camera | 197.6 | Fastest method |
| GaussianFormer-2 | 20.33 | Camera | ~5 | Fewest Gaussians needed |

### 7.2 Scene Flow Metrics

**End Point Error (EPE3D):**
The L2 distance between predicted and ground-truth per-point 3D flow vectors, averaged over all points.

```
EPE3D = (1/N) * sum_{i=1}^{N} ||f_pred_i - f_gt_i||_2

where f_pred_i, f_gt_i ∈ R^3 are predicted and ground-truth flow vectors
```

**Accuracy metrics (Acc3D):**

```
Acc3D_strict = (1/N) * sum_{i=1}^{N} [||f_pred_i - f_gt_i||_2 < 0.05m 
                                        OR relative_error < 5%]

Acc3D_relaxed = (1/N) * sum_{i=1}^{N} [||f_pred_i - f_gt_i||_2 < 0.1m 
                                         OR relative_error < 10%]
```

**Outlier ratio:**

```
Outlier3D = (1/N) * sum_{i=1}^{N} [||f_pred_i - f_gt_i||_2 > 0.3m 
                                     AND relative_error > 10%]
```

**Dynamic vs static evaluation:**
Scene flow benchmarks often report separate metrics for static points (flow ≈ 0) and dynamic points (flow > threshold). Dynamic flow is harder and more important for planning.

| Benchmark | Method | EPE3D All (m) | EPE3D Dynamic (m) | Acc3D Strict (%) |
|-----------|--------|--------------|-------------------|------------------|
| Argoverse 2 | ZeroFlow-XL | 0.028 | 0.063 | 67.2 |
| Argoverse 2 | DeFlow | 0.023 | 0.051 | 72.1 |
| Argoverse 2 | NSFP (teacher) | 0.059 | 0.114 | 35.6 |
| KITTI SF | ZeroFlow | 0.042 | 0.089 | 58.4 |
| KITTI SF | FlowNet3D | 0.177 | 0.315 | 8.2 |

### 7.3 Occupancy Forecasting Metrics

**IoU over time (primary metric for 4D):**

```
IoU@T = Intersection(O_pred_T, O_gt_T) / Union(O_pred_T, O_gt_T)

where T is the forecast horizon (e.g., 0.5s, 1.0s, 2.0s, 3.0s)
```

**mAP over time:**

```
mAP@T = mean Average Precision at forecast time T
  Average Precision computed per semantic class
  Mean over all classes
```

**Forecast-specific metrics from Cam4DOcc:**

| Metric | Description | Range |
|--------|-------------|-------|
| F-mIoU | Future mIoU (averaged over T future steps) | 0-100% |
| F-IoU@1s | Future IoU at 1-second horizon | 0-100% |
| F-IoU@2s | Future IoU at 2-second horizon | 0-100% |
| VPQ | Video Panoptic Quality (temporal consistency + quality) | 0-100% |

**SOTA forecasting results:**

| Method | F-mIoU | F-IoU@1s | F-IoU@2s | Input | Supervision |
|--------|--------|---------|---------|-------|-------------|
| Copy-last baseline | 12.3 | 14.1 | 10.5 | Any | N/A |
| OCFNet (Cam4DOcc) | 22.4 | 25.8 | 19.3 | Camera | Supervised |
| OccWorld-O (GT input) | 17.14 | 20.1 | 14.2 | GT Occ | Supervised |
| Drive-OccWorld | 15.1 | 18.3 | 12.0 | Camera | Supervised |
| UnO | -- | -- | -- | LiDAR | **Self-supervised** |

Note: UnO uses different metrics (Chamfer distance, NFCD) on Argoverse 2, not directly comparable to Cam4DOcc mIoU. But UnO won the Argoverse 2 LiDAR forecasting challenge, establishing it as SOTA for LiDAR-native forecasting.

### 7.4 Argoverse 2 Scene Flow Challenge

**Argoverse 2** (Waymo, 2023) is the current standard benchmark for LiDAR scene flow:

| Parameter | Value |
|-----------|-------|
| LiDAR | 2x 32-beam (roof-mounted) |
| Sequences | 1,000 (train/val/test split) |
| Annotations | Cuboid tracks + ego-motion |
| Flow ground truth | Derived from cuboid tracking + ego-motion compensation |
| Evaluation | Online server with hidden test set |
| Dynamic points | Separately evaluated for moving objects |

**2024/2025 leaderboard highlights:**

| Rank | Method | EPE3D (m) | Dynamic EPE3D (m) | Year |
|------|--------|-----------|-------------------|------|
| 1 | DeFlow | 0.023 | 0.051 | 2024 |
| 2 | ZeroFlow-XL | 0.028 | 0.063 | 2024 |
| 3 | FastFlow3D++ | 0.035 | 0.078 | 2024 |
| 4 | NSFP (optimization) | 0.059 | 0.114 | 2023 |
| 5 | FlowNet3D | 0.177 | 0.315 | 2019 |

### 7.5 KITTI Scene Flow Benchmark

**KITTI Scene Flow** (2015) was the original benchmark but is now considered limited:

| Parameter | Value |
|-----------|-------|
| LiDAR | Velodyne HDL-64E |
| Sequences | 200 (training) + 200 (test) |
| Resolution | ~120K points per scan |
| Evaluation | Online server |
| Limitation | Small dataset, single sensor, limited dynamics |

Most modern methods (ZeroFlow, DeFlow) still report KITTI results for backward compatibility but primarily benchmark on Argoverse 2.

### 7.6 Gap: No Airside-Specific Evaluation Benchmark

**No public benchmark exists for airside scene flow or occupancy forecasting.** This is a critical gap because:

1. **Object classes differ**: Aircraft (30-80m), GSE (2-15m), personnel (0.5m) -- the size range in airside is 160x, vs ~10x in road driving (motorcycle to truck)

2. **Dynamics differ**: Pushback at 1-3 km/h, taxiing at 15-30 km/h, crew walking at 4-6 km/h, conveyor extension at 0.3 m/s -- much wider speed range at the low end

3. **Occlusion patterns differ**: Aircraft fuselage creates 30-65m continuous occlusion zones -- far larger than any road driving occlusion

4. **Flow patterns differ**: Aircraft during pushback follow geometric arcs (not lane-following), belt loaders extend linearly, crew movements are semi-random within a work zone

5. **Safety-critical objects differ**: A dropped wrench (FOD) on the apron has zero flow but is safety-critical -- road benchmarks don't evaluate static hazard detection

**Proposed airside benchmark specification:**

| Parameter | Proposed Value | Rationale |
|-----------|---------------|-----------|
| LiDAR | 4-8 RoboSense (matching Aurrigo config) | Test with actual sensor configuration |
| Range | [-75m, 75m] x [-75m, 75m] x [-2m, 20m] | Cover aircraft height + full stand area |
| Resolution | 0.2m (close), 0.4m (medium), 0.8m (far) | Multi-resolution for efficiency |
| Classes | 18 (see `../perception/overview/lidar-semantic-segmentation.md`) | Airside-specific taxonomy |
| Flow evaluation | Separate per-class (aircraft, GSE, personnel, FOD) | Different dynamics per class |
| Horizons | 0.5s, 1s, 2s, 5s, 10s | Include long-term for pushback |
| Scenarios | Turnaround phases, taxi, pushback, emergency | Airside-specific situations |

Cost estimate: $30-50K for initial benchmark creation (500-1000 annotated sequences from fleet data).

Cross-reference: See `../../cross-cutting/evaluation-benchmarks.md` for general benchmark discussion and the finding that no public airside datasets exist (Key Finding #25).

---

## 8. Deployment on Edge Hardware

### 8.1 Voxel Resolution vs Compute Tradeoffs

The voxel resolution determines the fundamental accuracy-compute tradeoff:

```
Compute scaling: O(R^3) where R = 1/voxel_size (per dimension)
  0.1m → R=1000 → R^3 = 1 billion voxels (IMPOSSIBLE on Orin)
  0.2m → R=500  → R^3 = 125 million (too heavy for full 3D)
  0.4m → R=250  → R^3 = 15.6 million (feasible with sparse conv)
  0.8m → R=125  → R^3 = 1.95 million (easily real-time)
```

**Multi-resolution grid (recommended for airside):**

```
See occupancy-deployment-orin.md for detailed treatment.

Summary:
  Zone 1 (0-20m): 0.2m resolution → detect personnel, FOD
  Zone 2 (20-50m): 0.4m resolution → detect GSE, vehicles  
  Zone 3 (50-100m): 0.8m resolution → detect aircraft, structures

Memory per zone:
  Zone 1: (200/0.2)^2 * (10/0.2) = 50M voxels → 50 MB (sparse: ~5 MB)
  Zone 2: (60/0.4)^2 * (20/0.4) = 1.125M voxels → 1.1 MB
  Zone 3: (100/0.8)^2 * (20/0.8) = 390K voxels → 0.4 MB
  
  Total sparse occupancy: ~6.5 MB
  With flow (3 channels): ~26 MB
```

### 8.2 Sparse Convolution Libraries

Dense 3D convolution processes all voxels (occupied and empty). Since outdoor scenes are >95% empty, this wastes >95% of compute. Sparse convolution processes only occupied voxels:

| Library | Backend | Orin Support | Speed (10K pts) | Features |
|---------|---------|-------------|-----------------|----------|
| **MinkowskiNet** | Custom CUDA | Yes (JetPack 5.x) | ~8ms | Generalized sparse conv, proven |
| **SpConv v2** | Custom CUDA | Yes | ~5ms | Fastest, used in CenterPoint |
| **TorchSparse** | PyTorch native | Yes | ~7ms | Easy integration, good docs |
| **TorchSparse++ (v2.1)** | Optimized CUDA | Yes | ~4ms | Adaptive grouping, locality-aware |

**SpConv v2 is the recommended choice** for Orin deployment: it is the fastest, most battle-tested in production perception (CenterPoint, PointPillars), and has confirmed JetPack compatibility.

**Sparse convolution for occupancy flow:**

```python
import spconv.pytorch as spconv

class SparseOccFlowNet(nn.Module):
    """
    Sparse 3D convolution network for joint occupancy + flow prediction.
    Only processes occupied voxels -- 95%+ compute savings over dense.
    """
    def __init__(self, in_channels=4, occ_classes=18, flow_dim=3):
        super().__init__()
        
        # Encoder: sparse 3D conv backbone
        self.encoder = spconv.SparseSequential(
            spconv.SubMConv3d(in_channels, 32, 3, padding=1),
            nn.BatchNorm1d(32), nn.ReLU(),
            spconv.SparseConv3d(32, 64, 3, stride=2, padding=1),  # Downsample
            nn.BatchNorm1d(64), nn.ReLU(),
            spconv.SubMConv3d(64, 64, 3, padding=1),
            nn.BatchNorm1d(64), nn.ReLU(),
            spconv.SparseConv3d(64, 128, 3, stride=2, padding=1),  # Downsample
            nn.BatchNorm1d(128), nn.ReLU(),
        )
        
        # Occupancy head
        self.occ_head = spconv.SparseSequential(
            spconv.SubMConv3d(128, 64, 1),
            nn.BatchNorm1d(64), nn.ReLU(),
            spconv.SubMConv3d(64, occ_classes, 1),  # Per-voxel class logits
        )
        
        # Flow head
        self.flow_head = spconv.SparseSequential(
            spconv.SubMConv3d(128, 64, 1),
            nn.BatchNorm1d(64), nn.ReLU(),
            spconv.SubMConv3d(64, flow_dim, 1),  # Per-voxel (vx, vy, vz)
        )
    
    def forward(self, voxel_features, voxel_coords, batch_size):
        x = spconv.SparseConvTensor(voxel_features, voxel_coords, 
                                      spatial_shape=[200, 200, 16],
                                      batch_size=batch_size)
        features = self.encoder(x)
        occ = self.occ_head(features)
        flow = self.flow_head(features)
        return occ, flow
```

### 8.3 TensorRT Optimization for Occupancy Networks

**TensorRT conversion pipeline (see `occupancy-deployment-orin.md` for full detail):**

```
PyTorch model
    │
    ▼
ONNX export (torch.onnx.export with dynamic axes)
    │
    ▼
TensorRT engine build (trtexec --onnx=model.onnx)
    │
    ├── FP32 baseline: full accuracy, ~2x speedup over PyTorch
    ├── FP16: <0.5% accuracy loss, ~4x speedup
    └── INT8 (PTQ/QAT): 1-3% accuracy loss, ~8x speedup
    │
    ▼
Orin-optimized engine (.engine file)
```

**Key TensorRT considerations for occupancy + flow:**

1. **Sparse convolution**: TensorRT does not natively support SpConv. Use SpConv's built-in TensorRT plugin or convert sparse → dense → TensorRT → sparse at the boundary.

2. **Dynamic shapes**: Occupancy grids have fixed spatial dimensions but variable occupied voxel counts. Use TensorRT dynamic shapes for the sparse dimension.

3. **Multi-head output**: Both occupancy and flow heads share the backbone. TensorRT handles multi-output graphs natively.

4. **INT8 calibration for flow**: Flow values are continuous (not categorical like occupancy classes). Use percentile calibration (99.99th percentile) rather than entropy calibration for the flow head to avoid clipping large velocities.

**Expected latency on Orin AGX (TensorRT FP16):**

| Component | Latency | Notes |
|-----------|---------|-------|
| Voxelization (4-8 LiDAR merge) | 3-5ms | GPU-accelerated |
| Sparse 3D backbone | 8-12ms | SpConv v2 |
| Occupancy head | 2-3ms | 18-class classification |
| Flow head | 2-3ms | 3-channel regression |
| Temporal fusion (5-frame attention) | 8-12ms | BEV temporal attention |
| **Total** | **23-35ms** | **Fits within 50ms budget** |

### 8.4 FlashOcc as Real-Time Baseline

FlashOcc (see `occupancy-networks-comparison.md` and `occupancy-deployment-orin.md`) achieves 197.6 FPS on RTX 3090 via its channel-to-height trick. On Orin:

| FlashOcc Variant | Orin AGX (FP16) | Orin AGX (INT8) | mIoU |
|------------------|-----------------|-----------------|------|
| M0 (lightest) | ~25 FPS (40ms) | ~40 FPS (25ms) | 31.95 |
| M1 | ~20 FPS (50ms) | ~32 FPS (31ms) | 32.08 |

**FlashOcc does NOT predict flow** -- it is static occupancy only. To add flow:

```
Option 1: FlashOcc + separate flow head
  Add 3-channel regression head to BEV features before C2H
  Estimated overhead: +3-5ms
  Total: 28-55ms on Orin FP16

Option 2: FlashOcc + post-hoc scene flow
  Run FlashOcc for occupancy
  Run lightweight scene flow (e.g., PointPillars-based) on raw points
  Assign flow to occupied voxels
  Total: 40-60ms on Orin (two separate passes)

Option 3: Unified occupancy-flow network (recommended)
  Design backbone with shared features, dual heads
  See SparseOccFlowNet above
  Total: 23-35ms on Orin FP16 (single pass, sparse)
```

### 8.5 Temporal Buffer Management

The temporal dimension introduces a unique memory management challenge: how many past frames to store and in what format.

**Sliding window (constant memory):**

```
Buffer: [F_{t-T+1}, F_{t-T+2}, ..., F_t]  -- T feature maps

On new frame:
  1. Pop F_{t-T+1} (oldest)
  2. Push F_{t+1} (newest)
  3. Run temporal fusion on buffer

Memory: T * feature_size
Latency: constant per frame
```

**Keyframe approach (reduced memory):**

```
Keyframes: [F_{t-K*N}, F_{t-K*(N-1)}, ..., F_t]  -- every K-th frame
Between keyframes: discard intermediate features

Memory: (T/K) * feature_size
Tradeoff: loses fine-grained temporal detail between keyframes
```

**Adaptive keyframe (best tradeoff):**

```
Store keyframe when scene changes significantly:
  - Flow magnitude > threshold (something moving)
  - Ego velocity change > threshold (ego action)
  - New object appears (detection trigger)

Between keyframes: interpolate features
Memory: variable, bounded by max keyframe count
```

**Recommended for Orin:**

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Window size | 10 frames (1 second at 10Hz) | Covers typical airside interaction |
| Feature format | BEV 200x200 x 256 FP16 | 20 MB per frame |
| Total buffer | 200 MB | Within 6-10 GB budget |
| Update strategy | Sliding window | Simple, bounded, deterministic |
| Keyframe addition | Every 5th frame for long-term memory | Extends to ~5 seconds with 10 keyframes |

### 8.6 Memory Budget on Orin: Full 4D Pipeline

**Complete 4D occupancy flow pipeline memory allocation:**

```
Orin AGX 32 GB Total GPU Memory Allocation:

Other perception tasks (detection, segmentation, mapping): 12-16 GB
  └── PointPillars/CenterPoint: 2-4 GB
  └── LiDAR segmentation: 2-3 GB
  └── Online mapping (MapTracker): 4-6 GB
  └── Tracking + fusion: 2-3 GB

4D Occupancy Flow Pipeline: 4-6 GB
  ├── Model weights: 200-400 MB
  │   └── Backbone + occ head + flow head + temporal fusion
  ├── TensorRT workspace: 200-500 MB
  ├── Temporal feature buffer: 200 MB (10 frames BEV FP16)
  ├── Current occupancy grid: 26 MB (with flow, sparse)
  ├── Predicted future grids (5 steps): 130 MB
  └── Intermediate activations: 200-500 MB

Planning + localization + infrastructure: 4-6 GB
  └── Frenet planner: 1-2 GB
  └── GTSAM + VGICP: 2-3 GB
  └── CBF-QP solver: <100 MB

System overhead: 2-4 GB
  └── CUDA runtime, driver, OS
```

### 8.7 Latency Target: <50ms for Occupancy+Flow on Orin AGX

**Target latency breakdown:**

| Stage | Target (ms) | Method |
|-------|-------------|--------|
| Multi-LiDAR merge + voxelization | 3-5 | GPU-accelerated, pre-computed transforms |
| Sparse 3D backbone | 8-12 | SpConv v2 + TensorRT FP16 |
| Occupancy classification head | 2-3 | Linear layer on sparse features |
| Flow regression head | 2-3 | Linear layer on sparse features |
| BEV temporal attention (5 frames) | 8-12 | TensorRT FP16 attention |
| Flow propagation (3 future steps) | 3-5 | Euler advection on GPU |
| **Total** | **26-40ms** | **Within 50ms budget** |

**Stretch target (INT8):**

With INT8 quantization, each stage gains 1.5-2x speedup:

| Stage | FP16 (ms) | INT8 (ms) |
|-------|-----------|-----------|
| Backbone | 8-12 | 5-7 |
| Heads | 4-6 | 2-4 |
| Temporal fusion | 8-12 | 5-7 |
| Other | 6-10 | 4-7 |
| **Total** | **26-40** | **16-25** |

INT8 target of 16-25ms would leave significant headroom for additional processing (e.g., occupancy completion, longer temporal horizons, higher resolution near-field).

---

## 9. Practical Implementation

### 9.1 Architecture Overview

The complete 4D occupancy flow pipeline for airside deployment:

```
4-8 RoboSense LiDAR (RSHELIOS/RSBP, 10 Hz each)
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│  LiDAR Preprocessing (GPU, 3-5ms)                           │
│                                                              │
│  1. Per-sensor ego-motion compensation (GTSAM poses)        │
│  2. Multi-sensor merge to unified point cloud               │
│  3. Ground removal (RANSAC, existing Aurrigo pipeline)      │
│  4. Voxelization: point cloud → sparse voxel grid           │
│     Multi-resolution: 0.2m / 0.4m / 0.8m per zone          │
│  5. Per-voxel feature computation (mean xyz, intensity,     │
│     point count, covariance)                                │
└─────────────────────┬───────────────────────────────────────┘
                      │ Sparse voxel features: V ∈ R^{N_occ x C}
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Sparse 3D Backbone (SpConv v2, 8-12ms)                     │
│                                                              │
│  Stage 1: SubMConv3d(C, 32) → BN → ReLU                    │
│  Stage 2: SparseConv3d(32, 64, stride=2) → BN → ReLU       │
│  Stage 3: SubMConv3d(64, 64) → BN → ReLU                   │
│  Stage 4: SparseConv3d(64, 128, stride=2) → BN → ReLU      │
│  Stage 5: SubMConv3d(128, 128) → BN → ReLU                 │
│                                                              │
│  BEV Collapse: max-pool over height dimension               │
│  → BEV features: F_bev ∈ R^{H x W x 128}                  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Temporal Fusion Module (8-12ms)                             │
│                                                              │
│  Sliding window buffer: [F_{t-9}, ..., F_{t-1}, F_t]       │
│                                                              │
│  Ego-motion alignment:                                       │
│    For each past frame, warp BEV features to current ego    │
│    frame using GTSAM-provided relative poses                │
│                                                              │
│  Temporal attention:                                         │
│    Q = F_t, K = [F_{t-9}, ..., F_t], V = [F_{t-9}, ..., F_t] │
│    Attn = softmax(QK^T / sqrt(d)) V                        │
│                                                              │
│  Output: F_temporal ∈ R^{H x W x 128}                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ├──────────────────┐
                      ▼                  ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│  Occupancy Head (2-3ms)  │  │  Flow Head (2-3ms)       │
│                          │  │                          │
│  BEV → 3D via C2H        │  │  BEV → 3D via C2H        │
│  (Channel-to-Height)     │  │  (Channel-to-Height)     │
│                          │  │                          │
│  Conv2d(128, 18*16)      │  │  Conv2d(128, 3*16)       │
│  Reshape → (H,W,16,18)  │  │  Reshape → (H,W,16,3)   │
│                          │  │                          │
│  Output: O ∈ R^{H×W×Z×C}│  │  Output: F ∈ R^{H×W×Z×3}│
│  Per-voxel class logits  │  │  Per-voxel velocity      │
└──────────┬───────────────┘  └──────────┬───────────────┘
           │                             │
           ▼                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Flow Propagation (3-5ms)                                    │
│                                                              │
│  For k = 1, 2, ..., K_future:                               │
│    O_{t+k} = advect(O_{t+k-1}, F, dt)                      │
│    (Euler forward advection of occupancy along flow field)  │
│                                                              │
│  Output: [O_{t+1}, O_{t+2}, ..., O_{t+K}]                  │
│  Future occupancy predictions at 0.5s intervals             │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 Python Pseudocode: 4D Occupancy Flow Predictor

```python
import torch
import torch.nn as nn
import spconv.pytorch as spconv
import numpy as np
from typing import List, Tuple, Dict


class OccupancyFlowPredictor(nn.Module):
    """
    4D Occupancy Flow Predictor for LiDAR-primary airside AV.
    
    Takes multi-LiDAR point clouds, produces:
      1. Current 3D semantic occupancy (18 airside classes)
      2. Per-voxel 3D flow vectors (vx, vy, vz)
      3. Future occupancy predictions (K timesteps ahead)
    
    Designed for NVIDIA Orin AGX deployment with TensorRT.
    Target: <50ms total pipeline latency.
    """
    
    def __init__(self, 
                 voxel_size: Tuple[float, float, float] = (0.4, 0.4, 0.4),
                 point_cloud_range: List[float] = [-80, -80, -2, 80, 80, 18],
                 num_classes: int = 18,
                 temporal_frames: int = 10,
                 future_steps: int = 5,
                 future_dt: float = 0.5):
        super().__init__()
        
        self.voxel_size = voxel_size
        self.pc_range = point_cloud_range
        self.num_classes = num_classes
        self.temporal_frames = temporal_frames
        self.future_steps = future_steps
        self.future_dt = future_dt
        
        # Compute grid dimensions
        self.grid_size = [
            int((point_cloud_range[3] - point_cloud_range[0]) / voxel_size[0]),
            int((point_cloud_range[4] - point_cloud_range[1]) / voxel_size[1]),
            int((point_cloud_range[5] - point_cloud_range[2]) / voxel_size[2]),
        ]  # [400, 400, 50] at 0.4m for 160m range
        
        # Voxel feature encoder
        self.voxel_encoder = VoxelFeatureEncoder(in_channels=5)  # x,y,z,intensity,count
        
        # Sparse 3D backbone
        self.backbone = Sparse3DBackbone(in_channels=32, out_channels=128)
        
        # BEV collapse
        self.bev_collapse = nn.AdaptiveMaxPool1d(1)  # Max-pool over height
        
        # Temporal fusion
        self.temporal_fusion = BEVTemporalAttention(
            embed_dim=128, 
            num_heads=8, 
            num_frames=temporal_frames
        )
        
        # Occupancy head (Channel-to-Height)
        height_bins = self.grid_size[2]
        self.occ_head = nn.Sequential(
            nn.Conv2d(128, 256, 3, padding=1),
            nn.BatchNorm2d(256), nn.ReLU(),
            nn.Conv2d(256, num_classes * height_bins, 1),  # C2H: output channels = classes * height
        )
        
        # Flow head (Channel-to-Height)
        self.flow_head = nn.Sequential(
            nn.Conv2d(128, 256, 3, padding=1),
            nn.BatchNorm2d(256), nn.ReLU(),
            nn.Conv2d(256, 3 * height_bins, 1),  # 3 flow channels * height bins
        )
        
        # Temporal feature buffer (managed externally in ROS node)
        self.feature_buffer = []
    
    def voxelize(self, points: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Convert merged multi-LiDAR point cloud to sparse voxels.
        
        Args:
            points: (N, 5) -- x, y, z, intensity, sensor_id
        Returns:
            voxel_features: (M, C) -- per-voxel features
            voxel_coords: (M, 4) -- batch_idx, z, y, x indices
        """
        # Quantize points to voxel indices
        coords = ((points[:, :3] - torch.tensor(self.pc_range[:3])) 
                  / torch.tensor(self.voxel_size)).int()
        
        # Filter out-of-range
        valid = ((coords >= 0) & (coords < torch.tensor(self.grid_size))).all(dim=1)
        coords = coords[valid]
        points = points[valid]
        
        # Unique voxels and aggregate features
        unique_coords, inverse = torch.unique(coords, dim=0, return_inverse=True)
        
        # Per-voxel features: mean position, mean intensity, point count
        voxel_features = torch.zeros(unique_coords.shape[0], 5, device=points.device)
        voxel_features.scatter_reduce_(0, inverse.unsqueeze(1).expand(-1, 5),
                                        points[:, :5], reduce='mean')
        
        # Add batch index
        batch_coords = torch.cat([
            torch.zeros(unique_coords.shape[0], 1, device=coords.device, dtype=torch.int),
            unique_coords
        ], dim=1)
        
        return voxel_features, batch_coords
    
    def forward(self, points: torch.Tensor, ego_transforms: List[torch.Tensor] = None):
        """
        Full forward pass: points → occupancy + flow + future predictions.
        
        Args:
            points: (N, 5) merged multi-LiDAR point cloud
            ego_transforms: list of 4x4 transforms for temporal alignment
        
        Returns:
            occ: (H, W, Z, num_classes) -- current occupancy logits
            flow: (H, W, Z, 3) -- per-voxel velocity (m/s)
            future_occ: list of (H, W, Z) -- future occupancy predictions
        """
        # 1. Voxelize
        voxel_features, voxel_coords = self.voxelize(points)
        
        # 2. Encode voxel features
        encoded = self.voxel_encoder(voxel_features)
        
        # 3. Sparse 3D backbone
        bev_features = self.backbone(encoded, voxel_coords, batch_size=1)
        # bev_features: (1, 128, H, W) after BEV collapse
        
        # 4. Update temporal buffer
        self.feature_buffer.append(bev_features.detach())
        if len(self.feature_buffer) > self.temporal_frames:
            self.feature_buffer.pop(0)
        
        # 5. Temporal fusion (ego-motion aligned)
        if ego_transforms is not None and len(self.feature_buffer) > 1:
            aligned = self._align_temporal_features(self.feature_buffer, ego_transforms)
        else:
            aligned = self.feature_buffer
        
        temporal_features = self.temporal_fusion(torch.stack(aligned))
        # temporal_features: (1, 128, H, W)
        
        # 6. Occupancy prediction (Channel-to-Height)
        occ_raw = self.occ_head(temporal_features)  # (1, num_classes*Z, H, W)
        H, W = occ_raw.shape[2], occ_raw.shape[3]
        Z = self.grid_size[2]
        occ = occ_raw.reshape(1, self.num_classes, Z, H, W).permute(0, 3, 4, 2, 1)
        # occ: (1, H, W, Z, num_classes)
        
        # 7. Flow prediction (Channel-to-Height)
        flow_raw = self.flow_head(temporal_features)  # (1, 3*Z, H, W)
        flow = flow_raw.reshape(1, 3, Z, H, W).permute(0, 3, 4, 2, 1)
        # flow: (1, H, W, Z, 3) -- per-voxel (vx, vy, vz) in m/s
        
        # 8. Propagate occupancy into the future
        future_occ = self._propagate_flow(occ, flow)
        
        return occ.squeeze(0), flow.squeeze(0), future_occ
    
    def _propagate_flow(self, occ: torch.Tensor, flow: torch.Tensor) -> List[torch.Tensor]:
        """
        Propagate current occupancy along flow field to predict future states.
        Uses simple Euler advection.
        
        Returns: list of K future occupancy grids
        """
        future_predictions = []
        current_occ = occ.squeeze(0)  # (H, W, Z, C)
        
        for k in range(1, self.future_steps + 1):
            t = k * self.future_dt  # seconds ahead
            
            # Compute displacement in voxel units
            displacement = flow.squeeze(0) * t / torch.tensor(self.voxel_size)
            # displacement: (H, W, Z, 3) in voxel units
            
            # Create sampling grid for grid_sample
            # (simplified -- production would use proper 3D warping)
            H, W, Z, C = current_occ.shape
            grid_z, grid_y, grid_x = torch.meshgrid(
                torch.arange(Z), torch.arange(H), torch.arange(W), indexing='ij'
            )
            
            # Source coordinates (where each voxel came from)
            src_x = grid_x.float() - displacement[..., 0].permute(2, 0, 1)
            src_y = grid_y.float() - displacement[..., 1].permute(2, 0, 1)
            src_z = grid_z.float() - displacement[..., 2].permute(2, 0, 1)
            
            # Bilinear interpolation of occupancy at source coordinates
            future_occ_k = self._trilinear_sample(current_occ, src_x, src_y, src_z)
            future_predictions.append(future_occ_k)
        
        return future_predictions
    
    def _trilinear_sample(self, volume, x, y, z):
        """Trilinear interpolation from a 3D volume at fractional coordinates."""
        # Clamp to valid range
        H, W, Z, C = volume.shape
        x = x.clamp(0, W - 1)
        y = y.clamp(0, H - 1)
        z = z.clamp(0, Z - 1)
        
        # Floor and ceil indices
        x0, y0, z0 = x.long(), y.long(), z.long()
        x1 = (x0 + 1).clamp(max=W - 1)
        y1 = (y0 + 1).clamp(max=H - 1)
        z1 = (z0 + 1).clamp(max=Z - 1)
        
        # Fractional parts
        xd, yd, zd = x - x0.float(), y - y0.float(), z - z0.float()
        
        # Trilinear interpolation (simplified for clarity)
        c000 = volume[y0, x0, z0]
        c001 = volume[y0, x0, z1]
        c010 = volume[y0, x1, z0]
        c011 = volume[y0, x1, z1]
        c100 = volume[y1, x0, z0]
        c101 = volume[y1, x0, z1]
        c110 = volume[y1, x1, z0]
        c111 = volume[y1, x1, z1]
        
        xd, yd, zd = xd.unsqueeze(-1), yd.unsqueeze(-1), zd.unsqueeze(-1)
        
        result = (c000 * (1-xd)*(1-yd)*(1-zd) + c001 * (1-xd)*(1-yd)*zd +
                  c010 * (1-xd)*yd*(1-zd) + c011 * (1-xd)*yd*zd +
                  c100 * xd*(1-yd)*(1-zd) + c101 * xd*(1-yd)*zd +
                  c110 * xd*yd*(1-zd) + c111 * xd*yd*zd)
        
        return result
    
    def _align_temporal_features(self, features, transforms):
        """Align past BEV features to current ego frame using transforms."""
        aligned = []
        current_to_world = transforms[-1]
        
        for i, feat in enumerate(features):
            if i == len(features) - 1:
                aligned.append(feat)
                continue
            
            # Compute relative transform: past_frame → current_frame
            past_to_world = transforms[i]
            past_to_current = torch.inverse(current_to_world) @ past_to_world
            
            # Extract 2D rotation + translation for BEV warping
            theta = past_to_current[:2, :3].unsqueeze(0)  # Affine transform
            grid = nn.functional.affine_grid(theta, feat.shape, align_corners=False)
            warped = nn.functional.grid_sample(feat, grid, align_corners=False)
            aligned.append(warped)
        
        return aligned


class VoxelFeatureEncoder(nn.Module):
    """Simple per-voxel feature encoder."""
    def __init__(self, in_channels=5, out_channels=32):
        super().__init__()
        self.linear = nn.Sequential(
            nn.Linear(in_channels, 32),
            nn.BatchNorm1d(32),
            nn.ReLU(),
            nn.Linear(32, out_channels),
        )
    
    def forward(self, x):
        return self.linear(x)


class Sparse3DBackbone(nn.Module):
    """Sparse 3D convolution backbone with BEV collapse."""
    def __init__(self, in_channels=32, out_channels=128):
        super().__init__()
        self.conv = spconv.SparseSequential(
            spconv.SubMConv3d(in_channels, 32, 3, padding=1),
            nn.BatchNorm1d(32), nn.ReLU(),
            spconv.SparseConv3d(32, 64, 3, stride=2, padding=1),
            nn.BatchNorm1d(64), nn.ReLU(),
            spconv.SubMConv3d(64, 64, 3, padding=1),
            nn.BatchNorm1d(64), nn.ReLU(),
            spconv.SparseConv3d(64, out_channels, 3, stride=(1, 2, 2), padding=1),
            nn.BatchNorm1d(out_channels), nn.ReLU(),
        )
    
    def forward(self, features, coords, batch_size):
        x = spconv.SparseConvTensor(features, coords, 
                                      spatial_shape=self.grid_size,
                                      batch_size=batch_size)
        x = self.conv(x)
        # BEV collapse: dense → max over height
        dense = x.dense()  # (B, C, Z, H, W)
        bev = dense.max(dim=2)[0]  # (B, C, H, W)
        return bev


class BEVTemporalAttention(nn.Module):
    """Temporal attention over BEV features."""
    def __init__(self, embed_dim=128, num_heads=8, num_frames=10):
        super().__init__()
        self.embed_dim = embed_dim
        self.attn = nn.MultiheadAttention(embed_dim, num_heads, batch_first=True)
        self.norm = nn.LayerNorm(embed_dim)
        self.pos_embed = nn.Embedding(num_frames, embed_dim)
    
    def forward(self, features_seq: torch.Tensor):
        """
        Args:
            features_seq: (T, 1, C, H, W) temporal sequence of BEV features
        Returns:
            fused: (1, C, H, W) temporally fused BEV features
        """
        T, B, C, H, W = features_seq.shape
        
        # Reshape: each BEV cell is a token, attend across time
        # (T, B, C, H, W) → (B*H*W, T, C)
        x = features_seq.permute(1, 3, 4, 0, 2).reshape(B * H * W, T, C)
        
        # Add temporal positional encoding
        pos = self.pos_embed(torch.arange(T, device=x.device))
        x = x + pos.unsqueeze(0)
        
        # Self-attention across time dimension
        query = x[:, -1:, :]  # Current frame as query
        out, _ = self.attn(query, x, x)
        out = self.norm(out + query)
        
        # Reshape back: (B*H*W, 1, C) → (B, C, H, W)
        out = out.squeeze(1).reshape(B, H, W, C).permute(0, 3, 1, 2)
        
        return out
```

### 9.3 ROS Integration: Occupancy Flow Publisher

**ROS node architecture for Aurrigo's Noetic stack:**

```
ROS Node: /occupancy_flow_predictor
  
  Subscribers:
    /lidar/merged_cloud  (sensor_msgs/PointCloud2, 10 Hz)
    /localization/pose   (geometry_msgs/PoseStamped, 100 Hz)
    /localization/gtsam_state (custom_msgs/GTSAMState, 10 Hz)
  
  Publishers:
    /perception/occupancy    (custom_msgs/OccupancyGrid3D, 10 Hz)
    /perception/flow         (custom_msgs/OccupancyFlow3D, 10 Hz)
    /perception/future_occ   (custom_msgs/FutureOccupancy, 10 Hz)
    /perception/occ_markers  (visualization_msgs/MarkerArray, 2 Hz)
  
  Parameters:
    ~voxel_size: [0.4, 0.4, 0.4]       # meters
    ~range: [-80, -80, -2, 80, 80, 18]  # meters
    ~temporal_frames: 10
    ~future_steps: 5
    ~future_dt: 0.5                      # seconds
    ~model_path: /models/occ_flow.engine # TensorRT engine
    ~gpu_id: 0
```

**Custom message definitions:**

```
# OccupancyGrid3D.msg
Header header
float32 voxel_size_x
float32 voxel_size_y
float32 voxel_size_z
float32 origin_x
float32 origin_y
float32 origin_z
uint32 size_x
uint32 size_y
uint32 size_z
uint8[] data           # Packed: class_id per voxel (0 = free)
float32[] confidence   # Per-voxel confidence scores

# OccupancyFlow3D.msg
Header header
float32 voxel_size_x
float32 voxel_size_y
float32 voxel_size_z
float32 origin_x
float32 origin_y
float32 origin_z
uint32 size_x
uint32 size_y
uint32 size_z
float32[] flow_x       # Per-voxel velocity x (m/s)
float32[] flow_y       # Per-voxel velocity y (m/s)
float32[] flow_z       # Per-voxel velocity z (m/s)

# FutureOccupancy.msg
Header header
float32 dt             # Timestep between predictions (seconds)
uint32 num_steps       # Number of future steps
OccupancyGrid3D[] predictions  # List of future occupancy grids
```

**ROS node skeleton (C++ nodelet for Aurrigo's architecture):**

```cpp
// occupancy_flow_nodelet.h
#include <ros/ros.h>
#include <nodelet/nodelet.h>
#include <sensor_msgs/PointCloud2.h>
#include <geometry_msgs/PoseStamped.h>
#include <NvInfer.h>  // TensorRT

namespace aurrigo_perception {

class OccupancyFlowNodelet : public nodelet::Nodelet {
public:
    void onInit() override {
        ros::NodeHandle& nh = getNodeHandle();
        ros::NodeHandle& pnh = getPrivateNodeHandle();
        
        // Load TensorRT engine
        std::string model_path;
        pnh.param<std::string>("model_path", model_path, 
                                "/models/occ_flow.engine");
        engine_ = loadTensorRTEngine(model_path);
        
        // Parameters
        pnh.param("voxel_size", voxel_size_, 0.4);
        pnh.param("temporal_frames", temporal_frames_, 10);
        pnh.param("future_steps", future_steps_, 5);
        
        // Subscribers
        cloud_sub_ = nh.subscribe("/lidar/merged_cloud", 1,
                                   &OccupancyFlowNodelet::cloudCallback, this);
        pose_sub_ = nh.subscribe("/localization/pose", 10,
                                  &OccupancyFlowNodelet::poseCallback, this);
        
        // Publishers
        occ_pub_ = nh.advertise<OccupancyGrid3D>("/perception/occupancy", 1);
        flow_pub_ = nh.advertise<OccupancyFlow3D>("/perception/flow", 1);
        future_pub_ = nh.advertise<FutureOccupancy>("/perception/future_occ", 1);
    }
    
    void cloudCallback(const sensor_msgs::PointCloud2::ConstPtr& msg) {
        // 1. Voxelize point cloud (GPU)
        auto voxels = voxelize(msg);
        
        // 2. Update temporal buffer with ego-motion alignment
        Eigen::Matrix4f current_pose = getCurrentPose();
        updateTemporalBuffer(voxels, current_pose);
        
        // 3. Run TensorRT inference
        auto [occ, flow, future] = runInference(temporal_buffer_);
        
        // 4. Publish results
        publishOccupancy(occ, msg->header);
        publishFlow(flow, msg->header);
        publishFutureOcc(future, msg->header);
    }
    
private:
    nvinfer1::ICudaEngine* engine_;
    std::deque<BEVFeatures> temporal_buffer_;
    double voxel_size_;
    int temporal_frames_;
    int future_steps_;
    
    ros::Subscriber cloud_sub_, pose_sub_;
    ros::Publisher occ_pub_, flow_pub_, future_pub_;
};

}  // namespace aurrigo_perception
```

### 9.4 Sparse Voxel Representation for Efficient Storage and Transmission

For ROS message transmission and rosbag storage, the dense representation (200 x 200 x 16 = 640K voxels) is wasteful -- typically >95% of voxels are empty.

**Sparse encoding:**

```
Dense: 640,000 voxels * (1 class + 3 flow) * 4 bytes = 10.24 MB per frame
Sparse: ~20,000 occupied voxels * (3 coords + 1 class + 3 flow) * 4 bytes = 0.56 MB

Compression ratio: ~18x
```

**Sparse message format:**

```
# SparseOccupancyFlow.msg
Header header
float32 voxel_size
float32[3] origin
uint32[3] grid_size
uint32 num_occupied              # Number of occupied voxels
uint16[] voxel_x                 # X indices of occupied voxels
uint16[] voxel_y                 # Y indices
uint16[] voxel_z                 # Z indices
uint8[] class_id                 # Semantic class per voxel
float32[] confidence             # Confidence per voxel
float16[] flow_x                 # Flow vx per occupied voxel (FP16)
float16[] flow_y                 # Flow vy per occupied voxel
float16[] flow_z                 # Flow vz per occupied voxel
```

**Rosbag storage estimate:**

```
Per frame (sparse): ~0.56 MB
At 10 Hz: 5.6 MB/s = 20.2 GB/hour
For 8-hour shift: 161.6 GB (occupancy+flow channel only)

Compare to raw LiDAR (4-8 sensors): ~200 GB/day
Occupancy+flow adds ~80% overhead to raw LiDAR storage
But provides preprocessed, planning-ready representation
```

### 9.5 Training Data Requirements and Synthetic Data Augmentation

**Minimum data requirements for training:**

| Training Phase | Data Source | Volume | Estimated Cost |
|---------------|-------------|--------|---------------|
| Pre-training (SSL) | Road driving (nuScenes, Argoverse) | 500-1000 hours | Free (public datasets) |
| Scene flow teacher | Airside rosbags (unlabeled) | 50-100 hours | $0 (own fleet data) |
| Distillation | Teacher labels on airside data | 50-100 hours | $1-2K compute |
| Fine-tuning | Airside with sparse labels | 500-1000 frames | $5-10K annotation |
| Validation | Airside annotated test set | 200-500 frames | $3-5K annotation |

**Synthetic data augmentation strategies:**

1. **LidarDM** (see `lidar-native-world-models.md`): Generate synthetic LiDAR scans conditioned on airport maps. Can produce unlimited training data from a single map.

2. **CARLA/LGSVL simulation with airport environments**: Existing airport map assets + LiDAR simulation plugin. Quality: moderate (sim-to-real gap ~15-20% AP, reducible to 2-3% with domain adaptation per `../../cross-cutting/synthetic-data.md`).

3. **Scene flow augmentation**: Apply random rigid transforms to detected object clusters (shift, rotate, rescale flow) to create synthetic training examples from real scans.

4. **Temporal augmentation**: Time-reverse sequences (play backward), speed-up/slow-down sequences (rescale flow proportionally), concatenate clips from different stands.

**Training pipeline:**

```
Phase 1: Self-supervised pre-training on road data
  Dataset: nuScenes + Argoverse 2 (public, free)
  Method: ZeroFlow-style distillation for scene flow
          + SelfOcc for occupancy (neural rendering loss)
  Compute: 4x A100, ~3 days
  Cost: ~$500 cloud GPU

Phase 2: Self-supervised adaptation to airside
  Dataset: 50-100 hours recorded airside rosbags (unlabeled)
  Method: Continue SSL training on airside data
          FastNSF teacher → ZeroFlow student on airside
  Compute: 4x A100, ~2 days
  Cost: ~$300 cloud GPU

Phase 3: Supervised fine-tuning (optional)
  Dataset: 500-1000 annotated airside frames
  Method: Standard supervised training with flow + occupancy labels
  Compute: 4x A100, ~1 day
  Cost: ~$150 cloud GPU + $5-10K annotation

Total estimated cost: $6-11K (annotation dominant)
```

---

## 10. Key Takeaways

1. **Static occupancy is necessary but insufficient for planning.** A 3D occupancy grid tells the planner *where* obstacles are but not *where they will be*. Adding per-voxel flow vectors transforms static spatial maps into dynamic predictions -- essential for airside operations where GSE, aircraft, and crew all move simultaneously in tight quarters.

2. **ZeroFlow achieves 0.028m EPE3D via zero-shot distillation** -- the student surpasses the teacher (NSFP) by 53% through distillation smoothing. This means Aurrigo can generate high-quality scene flow pseudo-labels on airside data using FastNSF offline, then distill into a real-time network without any human annotation.

3. **DeFlow (CVPR 2024) is the current SOTA for LiDAR scene flow**: 0.023m EPE3D with 3.3x fewer parameters than ZeroFlow-XL and 1.75x higher throughput. Its decoder-free architecture is more TensorRT-friendly for Orin deployment.

4. **UnO won the Argoverse 2 LiDAR Forecasting Challenge** with a fully self-supervised, LiDAR-only approach. It predicts continuous occupancy + flow fields without any labels -- directly matching Aurrigo's constraints (LiDAR-primary, no airside labels available).

5. **Occupancy forecasting accuracy degrades ~50% per doubling of prediction horizon.** IoU drops from ~30% at 0.5s to ~14% at 3.0s on Cam4DOcc. For airside at 15 km/h, a 2m position error at 3s is still useful for conservative planning.

6. **Flow-aware safety margins prevent both false positives and false negatives.** A baggage cart approaching at 20 km/h requires a 6.25m margin; a stationary belt loader requires only 3.25m. Static margins must be conservative (large) to handle the worst case, wasting throughput.

7. **Dynamic 3D Gaussian Splatting enables replay-based testing at 100+ FPS.** StreetGaussians with tracked objects reconstruct renderable 4D scenes from recorded data. What-if scenario generation (insert/remove/modify objects) enables systematic safety testing without physical deployment.

8. **K-Planes factorization reduces 4D memory by ~10,900x** compared to dense 4D grids, making temporal neural representations practical for edge deployment. For a 256^3 spatial grid with 256 time steps, memory drops from 17 GB to 1.5 MB.

9. **The complete 4D occupancy flow pipeline fits within 26-40ms on Orin AGX FP16** -- well within the 50ms budget. INT8 quantization reduces this to 16-25ms, leaving headroom for higher resolution or longer temporal horizons.

10. **Hybrid temporal modeling (attention for recent + GRU for long-term) balances accuracy and efficiency** on Orin. Short-term attention over 5 frames captures fine dynamics, while ConvGRU compresses older context into a fixed-size state. Total temporal overhead: ~17ms.

11. **Sparse voxel representation achieves ~18x compression** over dense grids for ROS message transmission and rosbag storage. At 10 Hz, this is 5.6 MB/s vs 102 MB/s for dense -- critical for fleet data pipelines.

12. **No public airside scene flow or occupancy forecasting benchmark exists.** This is both a gap and an opportunity. Aurrigo's fleet data could become the de facto benchmark for airside 4D understanding. Estimated creation cost: $30-50K.

13. **Flow-based motion prediction is class-agnostic** -- it predicts motion for unknown objects, articulated mechanisms, and crowd flow without per-class detectors. This is a fundamental advantage for airside, where 30+ GSE types, 100+ aircraft variants, and novel foreign objects must all be handled.

14. **Scene flow enables tracking-by-flow as an alternative to detect-then-track.** DBSCAN clustering on (x, y, z, vx, vy, vz) identifies coherent moving objects without classification. This complements traditional MOT (see `../perception/overview/multi-object-tracking.md`) for unknown or rare object classes.

15. **Self-supervised training eliminates the annotation bottleneck.** ZeroFlow (distillation), UnO (occupancy rendering loss), and SelfOccFlow (neural rendering) all train without labels. Combined with road data pre-training and airside adaptation, the total labeling cost for 4D occupancy flow is $5-10K vs $80K+ for fully supervised approaches.

16. **Occupancy flow integrates with Aurrigo's Frenet planner at the cost function level.** Flow-augmented obstacle costs replace static proximity penalties, enabling predictive trajectory selection. Expected improvement: 60-70% collision rate reduction, 50-67% reduction in unnecessary stops.

17. **Mamba/SSM offers linear-complexity temporal modeling** (vs quadratic for attention), but requires custom CUDA kernels not yet supported by TensorRT on Orin. For near-term deployment, standard BEV temporal attention is more practical.

18. **The training pipeline costs $6-11K total** (compute + annotation), leveraging public road datasets for pre-training, self-supervised methods for airside adaptation, and minimal supervised fine-tuning. This is 85-93% cheaper than fully supervised training from scratch.

---

## 11. References

### Scene Flow

- Li et al., "Neural Scene Flow Prior" (ICLR 2021)
- Vedder et al., "ZeroFlow: Scalable Scene Flow via Distillation" (ICLR 2024)
- Chodosh et al., "DeFlow: Decoder-Free Scene Flow" (CVPR 2024)
- Liu et al., "FlowNet3D: Learning Scene Flow in 3D Point Clouds" (CVPR 2019)
- Gu et al., "HPLFlowNet: Hierarchical Permutohedral Lattice FlowNet" (CVPR 2019)
- Puy et al., "FLOT: Scene Flow on Point Clouds Guided by Optimal Transport" (ECCV 2020)
- Wu et al., "PointPWC-Net: Cost Volume on Point Clouds for Scene Flow Estimation" (CVPR 2020)
- Li et al., "Self-Point-Flow: Self-Supervised Scene Flow Estimation on Point Clouds" (ICCV 2021)

### 4D Occupancy Forecasting

- Ma et al., "Cam4DOcc: Benchmark for Camera-Only 4D Occupancy Forecasting" (CVPR 2024)
- Zheng et al., "OccSora: 4D Occupancy Generation Models as World Simulators" (2024)
- Zheng et al., "OccWorld: Learning a 3D Occupancy World Model" (ECCV 2024)
- Yu et al., "Drive-OccWorld: Driving in the Occupancy World" (AAAI 2025)
- Agro et al., "UnO: Unsupervised Occupancy Fields for Perception and Forecasting" (CVPR 2024)
- Li et al., "OCFNet: Occupancy Completion and Forecasting" (2024)
- Yang et al., "ViDAR: Visual Point Cloud Forecasting for Pre-Training" (NeurIPS 2024)

### Dynamic Scene Reconstruction

- DynamicCity (2024)
- Yan et al., "StreetGaussians: Modeling Dynamic Urban Scenes" (ECCV 2024)
- Luiten et al., "Dynamic 3D Gaussians: Tracking by Persistent Dynamic View Synthesis" (3DV 2024)
- Pumarola et al., "D-NeRF: Neural Radiance Fields for Dynamic Scenes" (CVPR 2021)
- Fridovich-Keil et al., "K-Planes: Explicit Radiance Fields in Space, Time, and Appearance" (CVPR 2023)
- Cao & Johnson, "HexPlane: A Fast Representation for Dynamic Scenes" (CVPR 2023)
- Yang et al., "Deformable 3D Gaussians for High-Fidelity Monocular Dynamic Scene Reconstruction" (CVPR 2024)
- Huang et al., "SC-GS: Sparse-Controlled Gaussian Splatting for Editable Dynamic Scenes" (CVPR 2024)
- Yang et al., "EmerNeRF: Emergent Real-World Neural Radiance Fields" (ICLR 2024)
- PeriFlow: "Streaming 4D World Reconstruction" (2024)

### Flow-Guided Planning

- Hu et al., "ST-P3: End-to-End Vision-Based Autonomous Driving via Spatial Temporal Feature Learning" (NeurIPS 2022)
- Tesla AI Day 2022: Occupancy Network presentation
- Zheng et al., "OccWorld" for planning integration

### Benchmarks and Datasets

- Tian et al., "Occ3D: A Large-Scale 3D Occupancy Prediction Benchmark" (NeurIPS 2023)
- Wang et al., "OpenOccupancy: A Large Scale Benchmark for Surrounding Semantic Occupancy Perception" (ICCV 2023)
- Wei et al., "SurroundOcc: Multi-Camera 3D Occupancy Prediction" (ICCV 2023)
- Wilson et al., "Argoverse 2: Next Generation Datasets for Self-Driving Perception and Forecasting" (NeurIPS 2023)
- Menze & Geiger, "Object Scene Flow for Autonomous Vehicles" (CVPR 2015) -- KITTI Scene Flow

### Temporal Modeling

- Gu et al., "Mamba: Linear-Time Sequence Modeling with Selective State Spaces" (2024)
- DriveMamba: Mamba for autonomous driving temporal modeling

### Edge Deployment

- Choy et al., "4D Spatio-Temporal ConvNets: Minkowski Convolutional Neural Networks" (CVPR 2019) -- MinkowskiNet
- Yan et al., "SECOND: Sparsely Embedded Convolutional Detection" (Sensors 2018) -- SpConv
- Tang et al., "TorchSparse: Efficient Point Cloud Inference Engine" (MLSys 2022)
- Yu et al., "FlashOcc: Fast and Memory-Efficient Occupancy Prediction" (2023)

### Cross-References Within This Repository

- `occupancy-networks-comparison.md` -- 20-method occupancy comparison
- `lidar-native-world-models.md` -- Copilot4D, UnO, LidarDM, AD-L-JEPA
- `occupancy-deployment-orin.md` -- FlashOcc, nvblox, TensorRT on Orin
- `occworld-implementation.md` -- OccWorld hands-on setup and training
- `diffusion-world-models.md` -- Sora, DriveDreamer, diffusion video world models
- `../perception/overview/multi-object-tracking.md` -- 3D MOT for airside
- `../perception/overview/lidar-semantic-segmentation.md` -- 18-class airside taxonomy
- `../perception/overview/lidar-foundation-models.md` -- PTv3, FlatFormer, Mamba backbone
- `../planning/safety-critical-planning-cbf.md` -- CBF safety filter integration
- `../planning/neural-motion-planning.md` -- SparseDrive, DiffusionDrive
- `../simulation/digital-twin-3dgs.md` -- 3DGS-based digital twin
- `../../operations/deployment/hmi-operator-interface.md` -- Operator visualization
- `../../cross-cutting/evaluation-benchmarks.md` -- Benchmark landscape
- `../../cross-cutting/synthetic-data.md` -- Sim-to-real transfer
