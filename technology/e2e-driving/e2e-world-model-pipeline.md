# End-to-End World Model Pipeline

## From Sensor Data to Vehicle Control for Airside Autonomous Vehicles

---

## 1. Full Pipeline Architecture

### 1.1 System Overview

```
                           AIRSIDE WORLD MODEL PIPELINE
  ============================================================================

  SENSORS             BEV ENCODING        TOKENIZATION       WORLD MODEL
  --------            -----------          ------------       -----------
  LiDAR x8  ──┐                          ┌─ VQ-VAE ─────┐
               ├──► Voxelization ──►     │  Encoder     │   Spatio-Temporal
  IMU/GNSS ──┐│     PointPillars        │  Codebook    │──► Transformer
              ││     Backbone            │  Quantize    │   (GPT-style)
  Odom ──────┘│     Swin-T neck          └─────────────┘   ├─ Spatial Attn
               │                                            ├─ Temporal Attn
  [Phase 2+]  │     [Phase 2+]                             └─ Ego Conditioning
  Cameras x6 ─┘     LSS / BEVFormer
                     Feature Fusion


  WORLD MODEL         PLANNING            CONTROL            ACTUATORS
  -----------         --------            -------            ---------
  Future BEV     ┌─► Trajectory     ┌─► MPC (20Hz)    ┌─► Steering
  Tokens t+1..N  │   Scoring        │   Lateral ctrl   │
                 │   Cost volumes   │                   ├─► Throttle
  Occupancy  ────┤   Collision chk  ├─► PID (50Hz)     │
  Prediction     │                  │   Longitudinal    ├─► Brake
                 │   Multi-modal    │                   │
  Ego Trajectory─┘   Selection      └─► Safety gate ───┘
                                        RSS check
```

### 1.2 Tensor Shapes at Each Stage

The following documents concrete tensor shapes flowing through the pipeline, using airside-specific configuration (102.4m x 102.4m operating range, 0.2m BEV resolution).

#### Stage 1: Sensor Input

```
LiDAR aggregate:     (N, 4)          # N ~ 200K points, [x, y, z, intensity]
                                     # 8x RoboSense at 10Hz, aggregated
IMU:                 (6,)            # [ax, ay, az, wx, wy, wz]
GNSS/Odom:           (7,)            # [x, y, z, qx, qy, qz, qw]
Cameras (Phase 2+):  (6, 3, 900, 1600)  # 6 cameras, RGB, H, W
```

#### Stage 2: Voxelization

```python
# Airside PointPillars configuration
point_cloud_range = [-51.2, -51.2, -3.0, 51.2, 51.2, 5.0]  # meters
voxel_size = [0.2, 0.2, 8.0]                                 # pillar: 0.2m x 0.2m x full height

# Resulting grid
grid_size = [512, 512, 1]  # (102.4m / 0.2m) = 512 cells per axis
max_pillars = 40000        # typically 6K-12K non-empty on airside apron
max_points_per_pillar = 32

# Pillar tensor (sparse → dense)
pillars:         (P, 32, 9)     # P non-empty pillars, 32 pts max, 9 features
                                 # features: [x, y, z, intensity, xc, yc, zc, xp, yp]
                                 # (xc,yc,zc)=offset from pillar center, (xp,yp)=pillar coords
pillar_coords:   (P, 3)          # [batch_idx, x_idx, y_idx]
```

#### Stage 3: BEV Feature Encoding

```python
# PointNet per-pillar → scatter to pseudo-image
pillar_features:  (P, 64)           # after PointNet MLP: 9→64→64
pseudo_image:     (1, 64, 512, 512) # (B, C, H, W) — scattered to BEV grid

# Backbone (SECOND-style 2D CNN or Swin-T)
# Multi-scale feature pyramid
bev_feat_1x:     (1, 64, 512, 512)  # stride 1 — full resolution
bev_feat_2x:     (1, 128, 256, 256) # stride 2
bev_feat_4x:     (1, 256, 128, 128) # stride 4

# FPN neck → unified BEV features
bev_features:    (1, 256, 128, 128) # after FPN aggregation
                                     # effective resolution: 0.8m per cell
                                     # covers 102.4m x 102.4m
```

#### Stage 4: VQ-VAE Tokenization

```python
# Encoder (downsamples BEV features 8x from voxel resolution)
# Input:  bev_features (1, 256, 128, 128)
# Swin-T encoder blocks

encoder_out:     (1, 256, 128, 128) # latent features before quantization

# Vector Quantization
codebook_size = 512                  # 512 discrete codes (OccWorld default)
embedding_dim = 256                  # each code is a 256-dim vector

# Quantized output
z_q:             (1, 256, 128, 128) # quantized latent features
token_indices:   (1, 128, 128)      # codebook indices — 16,384 tokens per frame
                                     # each index ∈ {0, 1, ..., 511}

# Scene token sequence for world model
scene_tokens:    (T, 16384)         # T historical frames, each with 16K tokens
```

#### Stage 5: World Model (Spatio-Temporal Transformer)

```python
# Architecture: GPT-style transformer with interleaved spatial/temporal attention
# Based on OccWorld / Copilot4D paradigm

# Input preparation
token_embeddings:  (B, T, 128, 128, 256)  # embedded tokens in spatial layout
ego_embedding:     (B, T, 256)             # ego state (pose, velocity) projected

# Transformer blocks (6 layers total, alternating)
# Spatial block: Swin Transformer on each frame independently
#   Attention window: 8x8 tokens
#   Params: 256 dim, 8 heads, MLP ratio 4
# Temporal block: Causal attention across time at same spatial position
#   Attends over T frames
#   Params: 256 dim, 8 heads

# Output
predicted_tokens:  (B, T_future, 128, 128)  # next T_future frames of token indices
                                             # T_future typically 5 (= 1 second at 5Hz)
ego_trajectory:    (B, T_future, 3)          # predicted ego [x, y, yaw] per step
```

#### Stage 6: Decoded Predictions

```python
# VQ-VAE Decoder: token indices → 3D occupancy / BEV segmentation
# For each predicted future frame:

decoded_bev:        (B, C_sem, 128, 128)     # semantic BEV segmentation
                                              # C_sem classes: free, vehicle, aircraft,
                                              # person, GSE, building, FOD, unknown
decoded_occupancy:  (B, C_sem, 200, 200, 16) # 3D semantic occupancy (if using OccWorld)
                                              # 0.4m x 0.4m x 0.5m voxels
```

#### Stage 7: Planning

```python
# Multi-modal trajectory generation + scoring

# Candidate trajectories (sampled or learned)
candidates:         (B, K, T_plan, 3)   # K=256 candidate trajectories
                                         # T_plan=10 steps at 20Hz = 0.5s
                                         # each step: [x, y, yaw]

# Cost volume from world model predictions
cost_volume:        (B, 128, 128)        # per-cell traversal cost

# Trajectory scoring
scores:             (B, K)               # score per candidate
                                          # combines: collision cost, progress,
                                          # comfort, lane adherence

# Selected trajectory
best_trajectory:    (B, T_plan, 3)       # highest scoring trajectory
waypoints:          (B, T_plan, 2)       # [x, y] control waypoints
```

#### Stage 8: Control Output

```python
# MPC → low-level commands
control_cmd:    (3,)    # [steering_angle, throttle, brake]
                        # steering: -1.0 to 1.0 (normalized)
                        # throttle: 0.0 to 1.0
                        # brake: 0.0 to 1.0

# Alternative: Twist command (ROS convention for airside AV)
cmd_twist:              # geometry_msgs/Twist
  linear.x:   float     # forward velocity (m/s), max ~5 m/s airside
  angular.z:  float     # yaw rate (rad/s)
```

### 1.3 Model Parameter Counts

| Component | Parameters | GPU Memory (FP16) | Inference Time (Orin) |
|-----------|-----------|-------------------|----------------------|
| PointPillars encoder | 5M | ~200 MB | ~5 ms |
| Swin-T BEV backbone | 28M | ~400 MB | ~15 ms |
| VQ-VAE tokenizer (enc+dec) | 13-20M | ~300 MB | ~8 ms |
| World model transformer | 39-200M | ~400-1600 MB | ~30-80 ms |
| Planning head | 2-5M | ~50 MB | ~3 ms |
| Safety ensemble (x3) | 15M | ~150 MB | ~5 ms |
| **Total** | **~100-270M** | **~1.5-2.7 GB** | **~66-116 ms** |

---

## 2. Data Flow Timing

### 2.1 Multi-Rate Architecture

The pipeline operates at four frequency tiers. Each tier has specific responsibilities, and data flows between tiers through ring buffers with timestamp-based interpolation.

```
 ┌─────────────────────────────────────────────────────────────┐
 │                    TIMING DIAGRAM (1 second)                │
 │                                                             │
 │  50Hz ║████║████║████║████║████║████║████║████║████║████║... │
 │  ctrl ║ 20ms cycle: PID + safety gate + actuator write      │
 │       ║                                                     │
 │  20Hz ║██████████║██████████║██████████║██████████║████...   │
 │  plan ║ 50ms cycle: trajectory scoring + MPC solve           │
 │       ║ consumes latest world model prediction               │
 │       ║                                                     │
 │  10Hz ║████████████████████║████████████████████████║...     │
 │  perc ║ 100ms cycle: point cloud → BEV features             │
 │       ║ PointPillars + backbone + FPN                       │
 │       ║                                                     │
 │   5Hz ║████████████████████████████████████████████║...      │
 │  wm   ║ 200ms budget: VQ-VAE encode + transformer predict   │
 │       ║ + VQ-VAE decode occupancy                           │
 └─────────────────────────────────────────────────────────────┘
```

### 2.2 50Hz Control Loop (20ms cycle)

**What runs:**
- Read latest trajectory waypoints from planning buffer
- Interpolate trajectory to current timestamp using cubic spline
- PID controller: compute steering and throttle from trajectory error
  - Lateral: Stanley or Pure Pursuit controller → steering command
  - Longitudinal: PID on velocity profile → throttle/brake
- RSS safety check on interpolated trajectory
- Write actuator commands via CAN/EtherCAT

**Timing budget:**
```
PID computation:         ~0.5 ms (CPU)
RSS boundary check:      ~0.2 ms (CPU)
Actuator write:          ~0.3 ms (CAN bus latency)
Margin:                  ~19 ms
Total:                   <1 ms active, 19 ms idle
```

**Buffer interface:**
```python
# Planning → Control ring buffer
trajectory_buffer = RingBuffer(capacity=5)  # holds last 5 planning outputs

class TrajectoryStamped:
    timestamp: float                # ROS time of planning cycle
    waypoints: np.ndarray           # (T_plan, 3) — [x, y, yaw]
    velocities: np.ndarray          # (T_plan,) — target speed per waypoint
    confidence: float               # world model confidence score
```

### 2.3 20Hz Planning Loop (50ms cycle)

**What runs:**
- Read latest world model predictions from prediction buffer
- Read latest BEV features from perception buffer (for cost volume)
- Generate candidate trajectories (lattice planner or learned sampler)
- Score candidates against predicted occupancy:
  - Collision cost: check overlap with predicted occupied cells
  - Progress cost: reward forward movement toward goal
  - Comfort cost: penalize high jerk, lateral acceleration
  - Lane cost: penalize deviation from planned route
- MPC solve on top-k candidates for smoothed trajectory
- Publish selected trajectory to control buffer

**Timing budget:**
```
Candidate generation:    ~2 ms  (GPU, batch parallel)
Cost volume lookup:      ~5 ms  (GPU, scatter-gather on predicted occ)
MPC solve:               ~15 ms (CPU, QP solver — OSQP or acados)
Buffer writes:           ~1 ms
Total:                   ~23 ms (within 50ms budget)
```

**When world model is stale (>400ms old):**
- Fall back to constant-velocity extrapolation of last BEV
- Reduce max speed to 2 m/s
- Log staleness warning

### 2.4 10Hz Perception Loop (100ms cycle)

**What runs:**
- Receive aggregated LiDAR point cloud (8 sensors fused by aggregator node)
- Voxelize into pillars
- Run PointPillars encoder → BEV pseudo-image
- Run 2D backbone + FPN → multi-scale BEV features
- [Phase 2+] Camera images → LSS/BEVFormer → camera BEV → fuse with LiDAR BEV
- Publish BEV features to perception buffer (consumed by tokenizer and planner)

**Timing budget (LiDAR-only, Orin):**
```
Point cloud preprocessing: ~3 ms  (CPU: NaN removal, range filter)
Voxelization:              ~3 ms  (GPU: scatter to pillars)
PointPillars PointNet:     ~2 ms  (GPU: per-pillar MLP)
Scatter to pseudo-image:   ~0.5 ms (GPU)
2D backbone:               ~8 ms  (GPU: Swin-T or ResNet-18)
FPN neck:                  ~3 ms  (GPU)
Buffer write:              ~0.5 ms
Total:                     ~20 ms (within 100ms budget)
```

**[Phase 2+] with cameras (additional):**
```
Image preprocessing:       ~2 ms  (GPU: resize, normalize)
Image backbone:            ~12 ms (GPU: ResNet-50 or Swin-T)
View transform (LSS):     ~8 ms  (GPU: depth distribution + splat)
BEV fusion:                ~3 ms  (GPU: concatenate + 1x1 conv)
Total with cameras:        ~45 ms (still within 100ms budget)
```

### 2.5 5Hz World Model Loop (200ms cycle)

**What runs:**
- Read latest BEV features from perception buffer
- VQ-VAE encoder: BEV features → discrete tokens
- Append to temporal token buffer (sliding window of T=4 past frames)
- World model transformer: predict T_future=5 future token frames
  - Conditioned on ego action (current velocity + planned trajectory)
  - Discrete diffusion: 10 denoising steps for highest quality
  - Or single-pass autoregressive for lower latency
- VQ-VAE decoder: predicted tokens → future occupancy / BEV segmentation
- Uncertainty estimation: entropy of token predictions
- Publish predictions to world model buffer

**Timing budget:**
```
VQ-VAE encode:           ~8 ms   (GPU: Swin-T encoder + quantize)
Token buffer management: ~0.5 ms (CPU: sliding window update)
Transformer forward:     ~60 ms  (GPU: 6 layers, 5 future frames)
  [OR discrete diffusion: ~120 ms with 10 steps]
VQ-VAE decode:           ~10 ms  (GPU: per-frame decode)
Uncertainty compute:     ~2 ms   (GPU: softmax entropy)
Buffer write:            ~0.5 ms
Total (autoregressive):  ~81 ms  (within 200ms budget)
Total (diffusion):       ~141 ms (within 200ms budget, less margin)
```

### 2.6 Interpolation Between Tiers

When a faster loop needs data from a slower loop, it interpolates:

```python
class TimestampedBuffer:
    """Thread-safe ring buffer with timestamp-based interpolation."""

    def __init__(self, capacity: int, interp_method: str = 'linear'):
        self.buffer = collections.deque(maxlen=capacity)
        self.lock = threading.Lock()
        self.interp_method = interp_method

    def get_at_time(self, query_time: float) -> np.ndarray:
        """Interpolate buffer contents to query_time."""
        with self.lock:
            if len(self.buffer) < 2:
                return self.buffer[-1].data  # hold last value

            # Find bracketing entries
            times = [entry.timestamp for entry in self.buffer]
            idx = bisect.bisect_right(times, query_time) - 1
            idx = max(0, min(idx, len(self.buffer) - 2))

            t0, d0 = times[idx], self.buffer[idx].data
            t1, d1 = times[idx + 1], self.buffer[idx + 1].data

            # Linear interpolation (for trajectories)
            alpha = (query_time - t0) / max(t1 - t0, 1e-6)
            alpha = np.clip(alpha, 0.0, 1.5)  # allow small extrapolation

            return d0 * (1 - alpha) + d1 * alpha
```

### 2.7 Latency Chain Analysis

End-to-end latency from sensor input to actuator output:

```
Worst case (all pipelines just missed their cycle):
  LiDAR capture:          0 ms   (trigger)
  Wait for perception:   100 ms  (missed 10Hz cycle, wait for next)
  Perception compute:     20 ms
  Wait for world model:  200 ms  (missed 5Hz cycle, wait for next)
  World model compute:    80 ms
  Wait for planning:      50 ms  (missed 20Hz cycle)
  Planning compute:       23 ms
  Wait for control:       20 ms  (missed 50Hz cycle)
  Control compute:         1 ms
  ─────────────────────────────
  WORST CASE:            ~494 ms

Best case (all pipelines are synchronized):
  LiDAR capture:           0 ms
  Perception compute:     20 ms
  World model compute:    80 ms  (pipelined with next perception)
  Planning compute:       23 ms
  Control compute:         1 ms
  ─────────────────────────────
  BEST CASE:             ~124 ms

Typical case (pipelined, no stalls):
  Effective latency:     ~200-250 ms
  (dominated by world model cycle time)
```

At airside speeds (max 5 m/s = 18 km/h), 250ms latency means the vehicle travels ~1.25m before reacting. This is acceptable for the low-speed airside ODD but requires:
- Minimum following distance: 5m (4x reaction distance)
- Safety braking distance at 5 m/s: ~2.5m (comfortable decel at 5 m/s^2)
- Total stopping distance budget: ~3.75m

---

## 3. Memory Management

### 3.1 GPU Memory Budget (Jetson AGX Orin 64GB Unified Memory)

The Orin uses unified memory shared between CPU and GPU. Budget allocation must account for all concurrent models plus working memory.

```
 ┌─────────────────────────────────────────────────────────────────┐
 │              GPU MEMORY ALLOCATION (Total: 64 GB)              │
 │                                                                 │
 │  ┌──────────────────────────────────────────────────┐           │
 │  │  TensorRT Engines (persistent)         ~3.5 GB  │           │
 │  │  ├── PointPillars encoder:              200 MB   │           │
 │  │  ├── BEV backbone (Swin-T):             400 MB   │           │
 │  │  ├── VQ-VAE encoder:                    150 MB   │           │
 │  │  ├── VQ-VAE decoder:                    150 MB   │           │
 │  │  ├── World model transformer:          1600 MB   │           │
 │  │  ├── Planning scorer:                    50 MB   │           │
 │  │  ├── Safety ensemble (3x small):        150 MB   │           │
 │  │  └── [Phase 2] Camera backbone:         800 MB   │           │
 │  └──────────────────────────────────────────────────┘           │
 │                                                                 │
 │  ┌──────────────────────────────────────────────────┐           │
 │  │  Activation / Working Memory            ~2.5 GB  │           │
 │  │  ├── Point cloud buffer (2 frames):     100 MB   │           │
 │  │  ├── BEV feature maps (current):        256 MB   │           │
 │  │  ├── Token buffer (4 frames):            64 MB   │           │
 │  │  ├── Transformer KV cache:              512 MB   │           │
 │  │  ├── Predicted occupancy (5 frames):    400 MB   │           │
 │  │  ├── Candidate trajectories:             32 MB   │           │
 │  │  ├── Cost volume:                        64 MB   │           │
 │  │  └── Misc intermediate tensors:        1072 MB   │           │
 │  └──────────────────────────────────────────────────┘           │
 │                                                                 │
 │  ┌──────────────────────────────────────────────────┐           │
 │  │  System / OS / ROS                      ~4.0 GB  │           │
 │  │  ├── Linux kernel + drivers:           1000 MB   │           │
 │  │  ├── ROS node overhead:                 500 MB   │           │
 │  │  ├── Sensor drivers:                    500 MB   │           │
 │  │  ├── Visualization (optional):         1000 MB   │           │
 │  │  └── Safety monitor + logging:         1000 MB   │           │
 │  └──────────────────────────────────────────────────┘           │
 │                                                                 │
 │  Total allocated:    ~10 GB                                     │
 │  Available margin:   ~54 GB (unified memory headroom)           │
 │                                                                 │
 │  Note: On Orin 32GB, total comes to ~10 GB — still fits        │
 │  with ~22 GB margin. Constraint is compute, not memory.         │
 └─────────────────────────────────────────────────────────────────┘
```

### 3.2 CUDA Stream Architecture

Multiple CUDA streams enable overlapping computation across pipeline stages. The key principle: perception for frame N+1 runs concurrently with world model inference on frame N.

```python
import torch

class PipelineStreamManager:
    """Manages CUDA streams for overlapped multi-model inference."""

    def __init__(self):
        # Dedicated streams per pipeline stage
        self.stream_perception = torch.cuda.Stream(priority=-1)  # high priority
        self.stream_tokenizer  = torch.cuda.Stream(priority=0)
        self.stream_worldmodel = torch.cuda.Stream(priority=0)
        self.stream_planning   = torch.cuda.Stream(priority=-1)  # high priority
        self.stream_safety     = torch.cuda.Stream(priority=-1)  # high priority
        self.stream_transfer   = torch.cuda.Stream(priority=0)   # H2D / D2H

        # Events for synchronization between streams
        self.evt_perception_done = torch.cuda.Event()
        self.evt_tokenizer_done  = torch.cuda.Event()
        self.evt_worldmodel_done = torch.cuda.Event()

    def run_perception(self, point_cloud):
        """Run BEV encoding on perception stream."""
        with torch.cuda.stream(self.stream_perception):
            # Upload point cloud (overlaps with previous world model)
            pillars = self.voxelize(point_cloud)
            bev_features = self.bev_encoder(pillars)
            self.evt_perception_done.record(self.stream_perception)
        return bev_features

    def run_world_model(self, bev_features):
        """Run tokenization + prediction on world model stream."""
        # Wait for perception to finish
        self.stream_tokenizer.wait_event(self.evt_perception_done)

        with torch.cuda.stream(self.stream_tokenizer):
            tokens = self.vqvae_encoder(bev_features)
            self.evt_tokenizer_done.record(self.stream_tokenizer)

        self.stream_worldmodel.wait_event(self.evt_tokenizer_done)

        with torch.cuda.stream(self.stream_worldmodel):
            predicted_tokens = self.transformer(tokens)
            predicted_occ = self.vqvae_decoder(predicted_tokens)
            self.evt_worldmodel_done.record(self.stream_worldmodel)

        return predicted_occ

    def run_planning(self, predicted_occ, ego_state):
        """Run planning on planning stream (high priority)."""
        self.stream_planning.wait_event(self.evt_worldmodel_done)

        with torch.cuda.stream(self.stream_planning):
            candidates = self.generate_trajectories(ego_state)
            costs = self.score_trajectories(candidates, predicted_occ)
            best = candidates[costs.argmin()]
        return best
```

### 3.3 Memory Optimization Techniques

**TensorRT engine optimization:**
```bash
# Build engines with workspace limit and FP16
trtexec --onnx=bev_encoder.onnx \
        --saveEngine=bev_encoder.engine \
        --fp16 \
        --workspace=2048 \      # 2GB workspace limit
        --minShapes=pillars:1x100x32x9 \
        --optShapes=pillars:1x10000x32x9 \
        --maxShapes=pillars:1x40000x32x9 \
        --memPoolSize=workspace:2048MiB

# For world model transformer with dynamic sequence length
trtexec --onnx=world_model.onnx \
        --saveEngine=world_model.engine \
        --fp16 \
        --workspace=4096 \
        --minShapes=tokens:1x2x128x128 \
        --optShapes=tokens:1x4x128x128 \
        --maxShapes=tokens:1x8x128x128
```

**Tensor memory pooling:**
```python
class TensorPool:
    """Pre-allocate and reuse GPU tensors to avoid allocation overhead."""

    def __init__(self):
        self.pools = {}

    def get(self, name: str, shape: tuple, dtype=torch.float16) -> torch.Tensor:
        key = (name, shape, dtype)
        if key not in self.pools:
            self.pools[key] = torch.empty(shape, dtype=dtype, device='cuda')
        return self.pools[key]

# Pre-allocate all working buffers at startup
pool = TensorPool()
bev_buffer     = pool.get('bev_feat', (1, 256, 128, 128))
token_buffer   = pool.get('tokens',   (1, 4, 128, 128), dtype=torch.long)
pred_buffer    = pool.get('pred_occ', (1, 5, 128, 128), dtype=torch.long)
traj_buffer    = pool.get('traj',     (1, 256, 10, 3))
```

### 3.4 Multi-GPU Considerations

For development workstations with multiple GPUs (training scenario):

| Configuration | BEV Encoder | VQ-VAE | World Model | Planning |
|--------------|-------------|--------|-------------|----------|
| 1x GPU (Orin) | GPU:0 | GPU:0 | GPU:0 | GPU:0 |
| 2x GPU (dev) | GPU:0 | GPU:0 | GPU:1 | GPU:1 |
| 4x GPU (train) | GPU:0 | GPU:1 | GPU:2-3 (DDP) | GPU:0 |

---

## 4. Training Pipeline End-to-End

### 4.1 Overview: Raw ROS Bags to Deployed TensorRT Model

```
 Phase A          Phase B          Phase C          Phase D          Phase E
 DATA PREP        TRAIN BEV        TRAIN VQ-VAE     TRAIN WM         DEPLOY
 ─────────        ─────────        ────────────     ────────         ──────
 ROS bags    ──►  PointPillars ──► VQ-VAE       ──► Transformer ──► ONNX
 → extract        on nuScenes      on BEV feats     on token seqs    → TRT
 → clean          → fine-tune      → codebook       → future pred    → Orin
 → format         airside          learning          → ego pred
 → split                                            → fine-tune
                                                     airside
 ~1-2 weeks       ~2 days          ~1-2 days        ~2-5 days        ~1 day
```

### 4.2 Phase A: Data Preparation (from ROS Bags)

**Step 1: Index and catalog bags**
```bash
# Install tooling (no ROS dependency needed)
pip install rosbags rosbags-dataframe mcap mcap-ros1-support

# Index all available bags
python scripts/index_bags.py \
    --bag-dir /data/airside_bags/ \
    --output /data/airside_dataset/bag_index.json

# Expected output: list of bags with topics, durations, sizes
# Typical airside dataset: 50-200 hours of driving
```

**Step 2: Extract synchronized sensor data**
```python
#!/usr/bin/env python3
"""Extract synchronized LiDAR + odom from ROS bags into training format."""

from pathlib import Path
from rosbags.rosbag1 import Reader
from rosbags.serde import deserialize_cdr, ros1_to_cdr
import numpy as np
import json

def extract_bag(bag_path: Path, output_dir: Path):
    """Extract point clouds and ego poses from a single bag."""
    output_dir.mkdir(parents=True, exist_ok=True)

    with Reader(bag_path) as reader:
        # Collect timestamps for synchronization
        pc_msgs = []
        odom_msgs = []

        for connection, timestamp, rawdata in reader.messages():
            msg = deserialize_cdr(ros1_to_cdr(rawdata, connection.msgtype),
                                  connection.msgtype)

            if connection.topic == '/pointcloud_aggregator/output':
                pc_msgs.append((timestamp, msg))
            elif connection.topic == '/odom/fused':
                odom_msgs.append((timestamp, msg))

        # Synchronize: for each point cloud, find nearest odom
        for i, (pc_ts, pc_msg) in enumerate(pc_msgs):
            # Find closest odom
            odom_idx = np.argmin([abs(o[0] - pc_ts) for o in odom_msgs])
            odom_msg = odom_msgs[odom_idx][1]

            # Extract point cloud as numpy array
            points = pointcloud2_to_numpy(pc_msg)  # (N, 4): x, y, z, intensity

            # Extract ego pose
            ego_pose = np.array([
                odom_msg.pose.pose.position.x,
                odom_msg.pose.pose.position.y,
                odom_msg.pose.pose.position.z,
                odom_msg.pose.pose.orientation.x,
                odom_msg.pose.pose.orientation.y,
                odom_msg.pose.pose.orientation.z,
                odom_msg.pose.pose.orientation.w,
            ])

            # Save
            np.save(output_dir / f'{i:06d}_points.npy', points.astype(np.float32))
            np.save(output_dir / f'{i:06d}_ego.npy', ego_pose.astype(np.float64))

    # Save metadata
    meta = {
        'bag_path': str(bag_path),
        'num_frames': len(pc_msgs),
        'duration_sec': (pc_msgs[-1][0] - pc_msgs[0][0]) / 1e9,
        'hz': len(pc_msgs) / ((pc_msgs[-1][0] - pc_msgs[0][0]) / 1e9),
    }
    with open(output_dir / 'meta.json', 'w') as f:
        json.dump(meta, f, indent=2)
```

**Step 3: Generate ground truth occupancy labels**
```bash
# Option A: LiDAR accumulation (self-supervised, no manual labels)
python scripts/generate_occupancy_labels.py \
    --data-dir /data/airside_dataset/extracted/ \
    --output-dir /data/airside_dataset/occupancy/ \
    --accumulate-frames 20 \    # accumulate 20 past/future frames
    --voxel-size 0.4 \          # 0.4m voxels
    --grid-range "[-40, -40, -3, 40, 40, 5]" \
    --num-workers 16

# Option B: Use pre-trained segmentation model for semantic labels
python scripts/generate_semantic_occupancy.py \
    --data-dir /data/airside_dataset/extracted/ \
    --model-checkpoint pretrained/cylinder3d_nuscenes.pth \
    --remap-classes configs/nuscenes_to_airside_classes.yaml
```

**Step 4: Create dataset splits**
```bash
python scripts/create_splits.py \
    --data-dir /data/airside_dataset/ \
    --train-ratio 0.8 \
    --val-ratio 0.1 \
    --test-ratio 0.1 \
    --temporal-split \          # split by recording session, not random frames
    --min-sequence-length 20    # at least 20 consecutive frames per sequence
```

### 4.3 Phase B: Train BEV Encoder

**Step 1: Pre-train on nuScenes (optional but recommended)**
```bash
# Using OpenPCDet
git clone https://github.com/open-mmlab/OpenPCDet.git
cd OpenPCDet && pip install -e .

# Download nuScenes and create data infos
python -m pcdet.datasets.nuscenes.nuscenes_dataset --func create_nuscenes_infos \
    --cfg_file tools/cfgs/dataset_configs/nuscenes_dataset.yaml \
    --version v1.0-trainval

# Train PointPillars on nuScenes
python -m torch.distributed.launch --nproc_per_node=4 \
    tools/train.py \
    --cfg_file tools/cfgs/nuscenes_models/cbgs_pillar0075_res2d_centerpoint.yaml \
    --batch_size 16 \
    --epochs 20 \
    --launcher pytorch
```

**Step 2: Fine-tune on airside data**
```bash
# Modify config for airside classes and geometry
# Key changes:
#   - point_cloud_range: [-51.2, -51.2, -3.0, 51.2, 51.2, 5.0]
#   - voxel_size: [0.2, 0.2, 8.0]
#   - class_names: ['vehicle', 'aircraft', 'person', 'gse', 'fod']
#   - Freeze backbone for first 5 epochs, then unfreeze

python -m torch.distributed.launch --nproc_per_node=4 \
    tools/train.py \
    --cfg_file configs/airside/pointpillars_airside_finetune.yaml \
    --pretrained_model output/nuscenes/cbgs_pillar/checkpoint_epoch_20.pth \
    --batch_size 8 \
    --epochs 30 \
    --launcher pytorch
```

### 4.4 Phase C: Train VQ-VAE Tokenizer

**Step 1: Extract BEV features from trained encoder**
```bash
# Run trained BEV encoder on full dataset to generate feature maps
python scripts/extract_bev_features.py \
    --data-dir /data/airside_dataset/ \
    --checkpoint output/airside/pointpillars/best.pth \
    --output-dir /data/airside_dataset/bev_features/ \
    --batch-size 32 \
    --num-workers 8
    # Output: (N_frames, 256, 128, 128) saved as .npy per sequence
```

**Step 2: Train VQ-VAE tokenizer**
```bash
# Train the scene tokenizer
python train_vqvae.py \
    --config configs/vqvae/vqvae_airside.yaml \
    --data-dir /data/airside_dataset/bev_features/ \
    --codebook-size 512 \
    --embedding-dim 256 \
    --commitment-loss-weight 0.25 \
    --lr 3e-4 \
    --batch-size 32 \
    --epochs 100 \
    --gpus 4 \
    --output-dir output/vqvae/

# Key config (vqvae_airside.yaml):
# encoder:
#   type: SwinTransformer
#   embed_dim: 96
#   depths: [2, 2, 6, 2]
#   num_heads: [3, 6, 12, 24]
#   window_size: 8
#   downsample: 1  (no spatial downsampling — keep 128x128)
# decoder:
#   type: SwinTransformerDecoder
#   upsample_layers: [2, 2, 6, 2]
# quantizer:
#   type: EMAVectorQuantizer
#   codebook_size: 512
#   embedding_dim: 256
#   decay: 0.99
#   commitment_cost: 0.25
```

**Step 3: Validate tokenizer reconstruction**
```bash
python eval_vqvae.py \
    --checkpoint output/vqvae/best.pth \
    --data-dir /data/airside_dataset/bev_features/ \
    --split val \
    --metrics reconstruction_loss codebook_usage perplexity
    # Target: reconstruction L1 < 0.05, codebook usage > 80%, perplexity > 400
```

### 4.5 Phase D: Train World Model

**Step 1: Generate token sequences from dataset**
```bash
# Tokenize entire dataset
python scripts/tokenize_dataset.py \
    --data-dir /data/airside_dataset/bev_features/ \
    --vqvae-checkpoint output/vqvae/best.pth \
    --output-dir /data/airside_dataset/tokens/ \
    --batch-size 64
    # Output per sequence: token_indices (T, 128, 128) int16
    #                      ego_poses (T, 7) float64
```

**Step 2: Train world model transformer**
```bash
# Pre-train on nuScenes tokens (if available), then fine-tune on airside
python train_world_model.py \
    --config configs/world_model/transformer_airside.yaml \
    --data-dir /data/airside_dataset/tokens/ \
    --context-frames 4 \        # condition on 4 past frames
    --predict-frames 5 \        # predict 5 future frames (1 second at 5Hz)
    --lr 1e-4 \
    --batch-size 8 \
    --epochs 50 \
    --gpus 4 \
    --output-dir output/world_model/

# Key config (transformer_airside.yaml):
# model:
#   type: SpatioTemporalTransformer
#   embed_dim: 256
#   num_layers: 6
#   num_heads: 8
#   spatial_block: SwinTransformer
#   temporal_block: CausalGPT2
#   window_size: 8
#   mlp_ratio: 4.0
#   dropout: 0.1
# training:
#   objective_weights:
#     future_prediction: 0.5   # predict future tokens from past
#     joint_modeling: 0.4      # reconstruct past + future
#     unconditional: 0.1       # no conditioning (for CFG)
#   ego_conditioning: true
#   noise_injection: 0.2       # 20% uniform noise on non-masked tokens
```

**Step 3: Train planning head**
```bash
python train_planner.py \
    --config configs/planning/cost_planner_airside.yaml \
    --world-model-checkpoint output/world_model/best.pth \
    --data-dir /data/airside_dataset/ \
    --lr 5e-4 \
    --batch-size 16 \
    --epochs 30 \
    --gpus 2
```

### 4.6 Phase E: Export and Deploy

**Step 1: Export to ONNX**
```bash
# Export each component separately for independent optimization
python scripts/export_onnx.py \
    --component bev_encoder \
    --checkpoint output/airside/pointpillars/best.pth \
    --output bev_encoder.onnx \
    --dynamic-axes "pillars:0,num_pillars:0" \
    --opset 17

python scripts/export_onnx.py \
    --component vqvae_encoder \
    --checkpoint output/vqvae/best.pth \
    --output vqvae_encoder.onnx \
    --opset 17

python scripts/export_onnx.py \
    --component world_model \
    --checkpoint output/world_model/best.pth \
    --output world_model.onnx \
    --dynamic-axes "context_length:1" \
    --opset 17

python scripts/export_onnx.py \
    --component vqvae_decoder \
    --checkpoint output/vqvae/best.pth \
    --output vqvae_decoder.onnx \
    --opset 17
```

**Step 2: Build TensorRT engines**
```bash
# On the target Orin device (engines are device-specific)

# BEV encoder — FP16
trtexec --onnx=bev_encoder.onnx \
        --saveEngine=bev_encoder_fp16.engine \
        --fp16 \
        --workspace=2048

# VQ-VAE encoder — FP16
trtexec --onnx=vqvae_encoder.onnx \
        --saveEngine=vqvae_encoder_fp16.engine \
        --fp16 \
        --workspace=1024

# World model — FP16 (largest model, most benefit from optimization)
trtexec --onnx=world_model.onnx \
        --saveEngine=world_model_fp16.engine \
        --fp16 \
        --workspace=4096 \
        --minShapes=tokens:1x2x128x128 \
        --optShapes=tokens:1x4x128x128 \
        --maxShapes=tokens:1x8x128x128

# VQ-VAE decoder — FP16
trtexec --onnx=vqvae_decoder.onnx \
        --saveEngine=vqvae_decoder_fp16.engine \
        --fp16 \
        --workspace=1024

# INT8 quantization (optional, for maximum speed)
# Requires calibration dataset
trtexec --onnx=world_model.onnx \
        --saveEngine=world_model_int8.engine \
        --int8 \
        --fp16 \
        --calib=calibration_cache.bin \
        --workspace=4096
```

**Step 3: Validate on device**
```bash
# Run inference benchmark
trtexec --loadEngine=world_model_fp16.engine \
        --shapes=tokens:1x4x128x128 \
        --iterations=100 \
        --warmUp=10 \
        --avgRuns=10

# Expected output on Orin AGX 64GB:
# Throughput: ~15-25 qps
# Latency (median): ~50-80 ms
# GPU Compute: ~45-70 ms
# H2D + D2H: ~3-5 ms
```

**Step 4: Integration test**
```bash
# Run full pipeline on recorded bag (offline replay)
python scripts/run_pipeline_offline.py \
    --bag /data/test_bags/airside_test_001.bag \
    --engines-dir /opt/world_model/engines/ \
    --output-dir /data/eval/pipeline_test/ \
    --visualize \
    --save-predictions

# Run online on vehicle (shadow mode)
roslaunch world_model_stack shadow_mode.launch \
    engine_dir:=/opt/world_model/engines/ \
    mode:=shadow
```

---

## 5. Evaluation Pipeline

### 5.1 Metrics at Each Stage

The evaluation pipeline validates each component independently, then measures end-to-end performance.

```
 STAGE              METRIC              TARGET (airside)     MEASUREMENT
 ─────              ──────              ────────────────     ───────────
 BEV Encoder        BEV Seg IoU         > 70% mIoU          Per-class IoU on held-out set
                    Detection mAP       > 50% mAP@0.5       AP for vehicle, aircraft, person
                    Latency             < 25 ms              TensorRT profiling on Orin

 VQ-VAE             Reconstruction L1   < 0.05               L1 between input/output features
                    Codebook Usage      > 80%                % of codes used in epoch
                    Perplexity          > 400 (of 512)       exp(entropy) of code distribution
                    Visual Fidelity     Qualitative          Side-by-side BEV comparison

 World Model        1s Prediction IoU   > 40% mIoU           Compare predicted vs GT occupancy
                    2s Prediction IoU   > 25% mIoU           (IoU degrades with horizon)
                    Chamfer Distance    < 2.0m (1s)          Point cloud reconstruction quality
                    Token Accuracy      > 60% (next frame)   % of tokens correctly predicted
                    FVD                 < 200                 Frechet Video Distance (if video)
                    Ego Traj L2         < 1.0m @ 2s          L2 error of ego predictions

 Planning           Collision Rate      < 0.1%               % of plans intersecting GT objects
                    Progress Rate       > 95%                % of goals reached within time
                    Comfort Score       < 2.0 m/s^3 jerk     Max jerk along trajectory
                    Infeasibility Rate  < 1%                 % of dynamically infeasible plans

 End-to-End         Route Completion    > 98%                % of routes completed successfully
                    Collision-free      > 99.9%              % of runs with zero collisions
                    Intervention Rate   < 1 per 10 km        Human takeover frequency
                    Avg Speed           > 3.5 m/s            Operational efficiency (of 5 max)
```

### 5.2 BEV Encoder Evaluation

```python
def evaluate_bev_encoder(model, dataloader, classes):
    """Evaluate BEV segmentation and detection quality."""
    iou_calculator = IoUCalculator(num_classes=len(classes))
    det_evaluator = DetectionEvaluator(classes, iou_thresholds=[0.3, 0.5, 0.7])
    latencies = []

    for batch in dataloader:
        points, gt_seg, gt_boxes = batch

        t0 = time.perf_counter()
        pred_seg, pred_boxes = model(points)
        torch.cuda.synchronize()
        latencies.append(time.perf_counter() - t0)

        iou_calculator.update(pred_seg, gt_seg)
        det_evaluator.update(pred_boxes, gt_boxes)

    results = {
        'mIoU': iou_calculator.compute_miou(),
        'per_class_iou': iou_calculator.compute_per_class(),
        'mAP@0.5': det_evaluator.compute_map(0.5),
        'latency_ms': {
            'mean': np.mean(latencies) * 1000,
            'p95': np.percentile(latencies, 95) * 1000,
            'p99': np.percentile(latencies, 99) * 1000,
        }
    }
    return results
```

### 5.3 VQ-VAE Tokenizer Evaluation

```python
def evaluate_vqvae(model, dataloader):
    """Evaluate tokenizer reconstruction quality and codebook health."""
    total_l1 = 0
    code_counts = torch.zeros(model.codebook_size)

    for bev_features in dataloader:
        # Encode → quantize → decode
        z_e = model.encoder(bev_features)
        z_q, indices, commit_loss = model.quantizer(z_e)
        recon = model.decoder(z_q)

        # Reconstruction loss
        total_l1 += F.l1_loss(recon, bev_features).item()

        # Codebook usage tracking
        for idx in indices.flatten():
            code_counts[idx] += 1

    n_batches = len(dataloader)
    usage = (code_counts > 0).float().mean().item()
    perplexity = torch.exp(-torch.sum(
        (code_counts / code_counts.sum()) *
        torch.log(code_counts / code_counts.sum() + 1e-10)
    )).item()

    return {
        'reconstruction_l1': total_l1 / n_batches,
        'codebook_usage': usage,
        'perplexity': perplexity,
        'dead_codes': (code_counts == 0).sum().item(),
    }
```

### 5.4 World Model Prediction Evaluation

```python
def evaluate_world_model(model, vqvae, dataloader, horizons=[1, 2, 3, 5]):
    """Evaluate world model prediction quality at multiple horizons."""
    metrics = {h: {'iou': [], 'chamfer': [], 'token_acc': []} for h in horizons}

    for context_tokens, future_tokens, ego_poses in dataloader:
        # Predict future
        predicted = model.predict(context_tokens, ego_poses, steps=max(horizons))

        for h in horizons:
            # Token-level accuracy
            pred_h = predicted[:, h-1]              # (B, 128, 128)
            gt_h = future_tokens[:, h-1]            # (B, 128, 128)
            token_acc = (pred_h == gt_h).float().mean().item()

            # Decode to occupancy for IoU
            pred_occ = vqvae.decode(pred_h)          # (B, C, H, W)
            gt_occ = vqvae.decode(gt_h)

            iou = compute_iou(pred_occ.argmax(1), gt_occ.argmax(1))
            chamfer = compute_chamfer(pred_occ, gt_occ)

            metrics[h]['iou'].append(iou)
            metrics[h]['chamfer'].append(chamfer)
            metrics[h]['token_acc'].append(token_acc)

    return {
        f'{h}s': {
            'mIoU': np.mean(metrics[h]['iou']),
            'chamfer_m': np.mean(metrics[h]['chamfer']),
            'token_accuracy': np.mean(metrics[h]['token_acc']),
        }
        for h in horizons
    }
```

### 5.5 Planning and End-to-End Evaluation

```python
def evaluate_planning_e2e(pipeline, test_scenarios):
    """End-to-end evaluation on recorded or simulated scenarios."""
    results = {
        'route_completion': [],
        'collisions': 0,
        'interventions': 0,
        'total_distance_m': 0,
        'total_time_s': 0,
        'jerk_values': [],
        'speeds': [],
    }

    for scenario in test_scenarios:
        outcome = pipeline.run_scenario(
            scenario,
            max_time=scenario.time_limit,
            record=True,
        )

        results['route_completion'].append(outcome.progress)
        results['collisions'] += outcome.collision_count
        results['interventions'] += outcome.intervention_count
        results['total_distance_m'] += outcome.distance_traveled
        results['total_time_s'] += outcome.duration
        results['jerk_values'].extend(outcome.jerk_profile)
        results['speeds'].extend(outcome.speed_profile)

    n = len(test_scenarios)
    return {
        'route_completion_rate': np.mean(results['route_completion']),
        'collision_rate': results['collisions'] / n,
        'collision_free_rate': 1.0 - (results['collisions'] / n),
        'interventions_per_km': (
            results['interventions'] /
            max(results['total_distance_m'] / 1000, 0.001)
        ),
        'avg_speed_ms': np.mean(results['speeds']),
        'max_jerk': np.max(results['jerk_values']),
        'p95_jerk': np.percentile(results['jerk_values'], 95),
    }
```

### 5.6 Automated Evaluation Script

```bash
#!/bin/bash
# run_full_evaluation.sh — runs all evaluation stages

set -e

DATA_DIR=/data/airside_dataset
CHECKPOINTS=/output
RESULTS=/data/eval/$(date +%Y%m%d_%H%M%S)
mkdir -p $RESULTS

echo "=== Stage 1: BEV Encoder ==="
python eval/eval_bev_encoder.py \
    --checkpoint $CHECKPOINTS/bev_encoder/best.pth \
    --data-dir $DATA_DIR --split test \
    --output $RESULTS/bev_encoder.json

echo "=== Stage 2: VQ-VAE Tokenizer ==="
python eval/eval_vqvae.py \
    --checkpoint $CHECKPOINTS/vqvae/best.pth \
    --data-dir $DATA_DIR/bev_features --split test \
    --output $RESULTS/vqvae.json

echo "=== Stage 3: World Model ==="
python eval/eval_world_model.py \
    --wm-checkpoint $CHECKPOINTS/world_model/best.pth \
    --vqvae-checkpoint $CHECKPOINTS/vqvae/best.pth \
    --data-dir $DATA_DIR/tokens --split test \
    --horizons 1 2 3 5 \
    --output $RESULTS/world_model.json

echo "=== Stage 4: Planning ==="
python eval/eval_planner.py \
    --pipeline-config configs/pipeline/full_pipeline.yaml \
    --scenarios $DATA_DIR/test_scenarios/ \
    --output $RESULTS/planning.json

echo "=== Stage 5: End-to-End ==="
python eval/eval_e2e.py \
    --pipeline-config configs/pipeline/full_pipeline.yaml \
    --scenarios $DATA_DIR/e2e_test_scenarios/ \
    --output $RESULTS/e2e.json

echo "=== Generating Report ==="
python eval/generate_report.py \
    --results-dir $RESULTS \
    --output $RESULTS/report.html

echo "Results saved to $RESULTS"
```

---

## 6. Failure Modes

### 6.1 Failure Taxonomy

```
 STAGE              FAILURE MODE              SEVERITY   DETECTION             RESPONSE
 ─────              ────────────              ────────   ─────────             ────────

 SENSORS
 ├── LiDAR dropout  One or more LiDARs stop   HIGH       Heartbeat timeout     Reduce speed, use
 │                  publishing                            on /rslidar topics    remaining LiDARs
 │
 ├── Point cloud    Points show systematic     MEDIUM     Statistical test on   Recalibrate or
 │   degradation    bias (rain, fog, dust)                point density/range   reduce confidence
 │
 └── Time sync      LiDAR timestamps drift     HIGH       PPS monitoring,       Stop if drift
     drift          from system clock                     NTP check             > 10ms

 BEV ENCODER
 ├── Empty BEV      No pillars generated       HIGH       Check non-empty       Emergency stop
 │                  (total sensor failure)                 pillar count > 100
 │
 ├── Feature         Backbone produces          MEDIUM     L2 norm monitoring    Fall back to
 │   collapse       near-zero features                    on BEV features       rule-based safety
 │
 └── Latency        Inference exceeds          MEDIUM     Wall-clock timing     Skip frame,
     spike          100ms budget                          per cycle             use stale features

 VQ-VAE
 ├── Codebook       >20% of tokens map to      MEDIUM     Track index           Retrain tokenizer
 │   collapse       same few codes                        histogram per frame   with reset
 │
 ├── Reconstruction Input BEV cannot be         HIGH       Online reconstruction Reduce WM weight
 │   failure        faithfully reconstructed              loss monitoring       in planning
 │
 └── OOD tokens     Scene maps to rarely-       MEDIUM     Entropy of code       Flag uncertainty,
                    used codes (novel scene)              distribution          increase caution

 WORLD MODEL
 ├── Hallucination  Predicts objects that       HIGH       Compare prediction    Discard prediction,
 │                  don't exist (phantom                   entropy to threshold  use constant-vel
 │                  aircraft, vehicles)                    > 2.0 nats            extrapolation
 │
 ├── Missed         Fails to predict real       CRITICAL   Cross-check with      Emergency stop if
 │   prediction     dynamic objects                        current perception    close object missed
 │
 ├── Temporal        Predictions flicker or     MEDIUM     Temporal consistency  Smooth predictions
 │   inconsistency  show impossible motion                 score (IoU between   with EMA filter
 │                                                         consecutive preds)
 │
 ├── Ego drift      Predicted ego trajectory    HIGH       L2 between predicted  Clamp ego
 │                  diverges from physics                  and kinematic model   prediction to
 │                                                                              feasible set
 │
 └── Autoregressive Error compounds across      HIGH       Monitor prediction    Limit prediction
     error          predicted frames                      quality vs horizon    horizon to
     accumulation                                                               confident range

 PLANNING
 ├── No feasible    All trajectories score      HIGH       Check if any          Emergency stop +
 │   trajectory     above collision threshold              candidate passes     request human
 │                                                         all safety checks
 │
 ├── Oscillation    Planner alternates          MEDIUM     Track trajectory      Hysteresis on
 │                  between two plans                      change rate           plan selection
 │
 └── Goal           Cannot reach goal due to    LOW        Progress monitoring   Replan to
     unreachable    predicted permanent                    over 10s window       alternate route
                    blockage

 CONTROL
 ├── Actuator       Steering/braking does       CRITICAL   Compare commanded     Emergency stop
 │   failure        not respond                            vs measured state     via redundant
 │                                                                              brake
 │
 └── Tracking       Large error between         MEDIUM     Cross-track error     Reduce speed,
     error          planned and actual path                monitoring            increase control
                                                                                gains
```

### 6.2 Detection Mechanisms

**Runtime health monitor:**
```python
class PipelineHealthMonitor:
    """Monitors all pipeline stages for anomalies."""

    def __init__(self):
        self.checks = {
            'sensor_heartbeat':    HeartbeatCheck(timeout_ms=200),
            'bev_feature_norm':    RangeCheck(min_val=0.01, max_val=100.0),
            'codebook_entropy':    ThresholdCheck(min_val=4.0),  # bits
            'prediction_entropy':  ThresholdCheck(max_val=3.0),  # nats
            'ego_prediction_l2':   ThresholdCheck(max_val=2.0),  # meters
            'planning_feasible':   BooleanCheck(expected=True),
            'control_tracking':    ThresholdCheck(max_val=0.5),  # meters
            'cycle_time':          LatencyCheck(budgets={
                'perception': 100, 'world_model': 200,
                'planning': 50, 'control': 20,
            }),
        }

    def check_all(self) -> HealthStatus:
        failures = []
        for name, check in self.checks.items():
            if not check.passes():
                failures.append(HealthFailure(name, check.severity, check.value))

        if any(f.severity == 'CRITICAL' for f in failures):
            return HealthStatus.EMERGENCY_STOP
        elif any(f.severity == 'HIGH' for f in failures):
            return HealthStatus.DEGRADE_TO_SAFETY
        elif any(f.severity == 'MEDIUM' for f in failures):
            return HealthStatus.REDUCE_CONFIDENCE
        return HealthStatus.NOMINAL
```

### 6.3 Graceful Degradation Hierarchy

```
 LEVEL 0: NOMINAL
   All systems operational, full world model pipeline active
   Max speed: 5 m/s, full prediction horizon (1s)

 LEVEL 1: REDUCED CONFIDENCE
   One or more MEDIUM severity issues detected
   Actions:
   ├── Reduce max speed to 3 m/s
   ├── Increase following distance to 8m
   ├── Shorten prediction horizon to 0.6s
   └── Log warnings, continue operation

 LEVEL 2: SAFETY MODE
   One or more HIGH severity issues detected
   Actions:
   ├── Disable world model predictions
   ├── Fall back to rule-based planner (constant velocity extrapolation)
   ├── Reduce max speed to 2 m/s
   ├── Activate safety ensemble voting
   └── Request human monitoring attention

 LEVEL 3: MINIMAL RISK CONDITION
   CRITICAL failure or multiple HIGH failures
   Actions:
   ├── Execute controlled stop (decelerate at 2 m/s^2)
   ├── Activate hazard lights
   ├── Broadcast position to fleet manager
   ├── Hold position until human intervention
   └── Maintain sensor recording for post-incident analysis
```

### 6.4 World Model-Specific Safety Checks

```python
class WorldModelSafetyValidator:
    """Validates world model outputs before they reach the planner."""

    def __init__(self):
        self.entropy_threshold = 3.0        # nats — high entropy = uncertain
        self.temporal_iou_threshold = 0.3   # minimum IoU between consecutive frames
        self.ego_kinematic_limit = 5.0      # m/s max speed for ego prediction
        self.max_acceleration = 3.0         # m/s^2 max for predicted ego

    def validate(self, prediction, prev_prediction, ego_state):
        issues = []

        # 1. Entropy check — are predictions confident?
        entropy = self.compute_token_entropy(prediction.token_logits)
        if entropy > self.entropy_threshold:
            issues.append(('high_entropy', entropy, 'MEDIUM'))

        # 2. Temporal consistency — do consecutive predictions agree?
        if prev_prediction is not None:
            temporal_iou = self.compute_temporal_iou(
                prediction.occupancy[0],    # first predicted frame
                prev_prediction.occupancy[1] # second frame from previous pred
            )
            if temporal_iou < self.temporal_iou_threshold:
                issues.append(('temporal_inconsistency', temporal_iou, 'HIGH'))

        # 3. Kinematic feasibility — is the ego prediction physically possible?
        ego_traj = prediction.ego_trajectory
        velocities = np.linalg.norm(np.diff(ego_traj[:, :2], axis=0), axis=1) * 5  # 5Hz
        accelerations = np.abs(np.diff(velocities)) * 5

        if np.any(velocities > self.ego_kinematic_limit):
            issues.append(('ego_speed_violation', velocities.max(), 'HIGH'))
        if np.any(accelerations > self.max_acceleration):
            issues.append(('ego_accel_violation', accelerations.max(), 'MEDIUM'))

        # 4. Phantom object check — new large objects appearing from nowhere
        if prev_prediction is not None:
            new_objects = self.detect_phantom_objects(
                prediction.occupancy, prev_prediction.occupancy
            )
            if len(new_objects) > 0:
                issues.append(('phantom_objects', len(new_objects), 'HIGH'))

        return ValidationResult(
            valid=len([i for i in issues if i[2] in ('HIGH', 'CRITICAL')]) == 0,
            issues=issues,
        )
```

---

## 7. Phased Deployment

### 7.1 Phase Overview

```
 PHASE 0          PHASE 1          PHASE 2          PHASE 3
 DATA             SHADOW           CAMERAS          VLA
 ────             ──────           ───────          ───
 Duration:        Duration:        Duration:        Duration:
 2-4 months       3-6 months       4-8 months       6-12 months

 Collect          Run world        Add camera       Vision-Language
 training data    model in         fusion, close    Action model
 from existing    shadow mode      the loop on      with language
 fleet ops        alongside        limited routes   reasoning
                  production
                  stack
```

### 7.2 Phase 0: Data Collection and Foundation

**Objective:** Build a training dataset of 100+ hours of airside driving with sensor data, poses, and annotations.

**Activities:**
1. Instrument existing fleet vehicles with data recording (ROS bag recording of all sensor topics)
2. Set up data pipeline: bags → extracted frames → occupancy labels
3. Train BEV encoder on nuScenes, validate on airside data
4. Train VQ-VAE tokenizer on airside BEV features
5. Train initial world model on airside token sequences
6. Establish evaluation benchmark with held-out test scenarios

**Infrastructure:**
- On-vehicle: 2TB NVMe SSD per vehicle for bag recording
- Off-vehicle: NAS or cloud storage for bag archive (estimate 10-50TB)
- Training: 4-8x A100 GPUs (cloud or on-prem)
- CI/CD: automated training pipeline with experiment tracking (W&B / MLflow)

**Milestones:**
| Milestone | Target | Measurement |
|-----------|--------|-------------|
| M0.1: Bag pipeline operational | Week 2 | Can extract, index, process bags automatically |
| M0.2: 50 hours collected | Week 6 | Bag index shows 50+ hours of driving |
| M0.3: BEV encoder trained | Week 8 | mIoU > 50% on airside val set |
| M0.4: VQ-VAE trained | Week 10 | Reconstruction L1 < 0.05, codebook usage > 80% |
| M0.5: World model v0.1 | Week 12 | 1s prediction IoU > 20% on airside val |
| M0.6: 100 hours collected | Week 14 | Bag index shows 100+ hours |
| M0.7: World model v0.2 | Week 16 | 1s prediction IoU > 30% on airside val |

**Go/No-Go Criteria for Phase 1:**
- [REQUIRED] 100+ hours of clean, synchronized sensor data collected
- [REQUIRED] BEV encoder achieves > 50% mIoU on airside validation set
- [REQUIRED] VQ-VAE codebook usage > 70%, reconstruction L1 < 0.1
- [REQUIRED] World model produces visually plausible 1s predictions on 10+ test sequences
- [DESIRED] 1s prediction IoU > 25%
- [DESIRED] Automated training pipeline runs end-to-end without manual intervention

### 7.3 Phase 1: Shadow Mode

**Objective:** Run the world model pipeline alongside the production stack, comparing predictions to reality without controlling the vehicle.

**Activities:**
1. Deploy world model stack as shadow ROS namespace
2. Record shadow stack predictions + production stack decisions + actual outcomes
3. Continuously compare world model predictions against reality (closed-loop validation)
4. Mine disagreements between shadow and production for hard examples
5. Iteratively retrain world model on growing dataset (data flywheel)
6. Implement and validate safety monitor / arbitrator

**Architecture:**
```
 Production Stack                Shadow Stack (World Model)
 ┌────────────────┐             ┌────────────────────────┐
 │ Existing        │             │ BEV Encoder             │
 │ Perception      │←─ LiDAR ──→│ VQ-VAE Tokenizer        │
 │ Planning        │   (shared) │ World Model Transformer  │
 │ Control ────────│──► VEHICLE │ Planner (scoring only)   │
 └────────────────┘             └──────────┬─────────────┘
                                            │
                                     ┌──────▼──────┐
                                     │ Comparator   │
                                     │ - pred vs GT │
                                     │ - shadow vs  │
                                     │   production │
                                     │ - log + mine │
                                     └─────────────┘
```

**Milestones:**
| Milestone | Target | Measurement |
|-----------|--------|-------------|
| M1.1: Shadow stack runs on vehicle | Week 4 | All nodes publish, no crashes for 1 hour |
| M1.2: Comparator logging works | Week 6 | Can replay and visualize pred vs reality |
| M1.3: Shadow runs 100 hours | Week 12 | No OOM, no crashes, <1% frame drops |
| M1.4: 1s pred IoU > 35% | Week 16 | Measured on real-time vehicle data |
| M1.5: Planning agreement > 70% | Week 20 | Shadow planner agrees with production 70%+ |
| M1.6: Safety monitor validated | Week 24 | All injected faults detected, <5% false positive |

**Go/No-Go Criteria for Phase 2:**
- [REQUIRED] Shadow stack runs continuously for 500+ hours with no crashes or OOM
- [REQUIRED] 1s prediction IoU > 35% measured on live vehicle data
- [REQUIRED] Safety monitor detects 100% of injected critical faults
- [REQUIRED] Safety monitor false positive rate < 5%
- [REQUIRED] Shadow planner agrees with production planner on > 70% of decisions
- [REQUIRED] No cases where shadow planner would have caused collision that production avoided
- [DESIRED] 1s prediction IoU > 40%
- [DESIRED] World model correctly predicts > 80% of dynamic object behaviors

### 7.4 Phase 2: Camera Fusion and Closed Loop

**Objective:** Add cameras to the perception pipeline, fuse camera + LiDAR BEV features, and begin closed-loop control on limited routes.

**Activities:**
1. Install camera rig on test vehicles (6 cameras for 360 coverage)
2. Train camera-to-BEV encoder (LSS or BEVFormer)
3. Train fused BEV encoder (LiDAR + camera)
4. Retrain VQ-VAE and world model on fused features
5. Validate on shadow mode with cameras
6. Begin closed-loop control on single, well-mapped test route
7. Gradually expand to more routes as confidence builds

**Camera configuration for airside:**
```yaml
cameras:
  front:      {fov: 70, resolution: [1920, 1080], fps: 10}
  front_left: {fov: 70, resolution: [1920, 1080], fps: 10}
  front_right:{fov: 70, resolution: [1920, 1080], fps: 10}
  rear:       {fov: 70, resolution: [1920, 1080], fps: 10}
  rear_left:  {fov: 70, resolution: [1920, 1080], fps: 10}
  rear_right: {fov: 70, resolution: [1920, 1080], fps: 10}
```

**Closed-loop deployment rules:**
- Safety driver always present with physical e-stop
- Maximum speed: 3 m/s initially, increase to 5 m/s after 50 hours incident-free
- Operating hours: daylight only initially, expand to night after 100 hours
- Weather: clear conditions initially, expand to rain after 200 hours
- Route: single fixed route initially, expand after each 100-hour incident-free window

**Milestones:**
| Milestone | Target | Measurement |
|-----------|--------|-------------|
| M2.1: Camera rig installed | Week 4 | All 6 cameras publishing, calibrated |
| M2.2: Camera BEV encoder trained | Week 8 | Camera-only mIoU > 40% |
| M2.3: Fused BEV > LiDAR-only | Week 12 | Fused mIoU > LiDAR-only mIoU |
| M2.4: Retrained WM on fused | Week 16 | 1s pred IoU > 45% with fusion |
| M2.5: First closed-loop run | Week 20 | Complete 1 route, 0 interventions |
| M2.6: 50 hours closed-loop | Week 28 | < 2 interventions per 10 km |
| M2.7: 200 hours closed-loop | Week 32 | < 0.5 interventions per 10 km |

**Go/No-Go Criteria for Phase 3:**
- [REQUIRED] 200+ hours of closed-loop operation with < 1 intervention per 10 km
- [REQUIRED] Zero collisions in closed-loop operation
- [REQUIRED] World model prediction IoU > 45% at 1s, > 30% at 2s
- [REQUIRED] System operates in day + night + light rain conditions
- [REQUIRED] Fused perception outperforms LiDAR-only on all metrics
- [DESIRED] Route completion rate > 98%
- [DESIRED] Average operational speed > 4 m/s

### 7.5 Phase 3: Vision-Language-Action Model

**Objective:** Integrate language reasoning into the driving pipeline for complex airside scenarios (e.g., understanding marshaller signals, radio instructions, signage).

**Activities:**
1. Collect language-annotated driving data (narrated scenarios, instruction-following)
2. Fine-tune VLA model (based on AutoVLA, VQ-VLA, or similar) on airside data
3. Implement dual-system architecture: fast planner (world model) + slow reasoner (VLA)
4. VLA handles edge cases: unusual aircraft types, construction zones, emergency vehicles
5. World model handles routine navigation at high frequency
6. Extensive validation in simulation and shadow mode before any closed-loop

**VLA Architecture for Airside:**
```
 ┌─────────────────────────────────────────────────────────────┐
 │                    DUAL-SYSTEM VLA                          │
 │                                                             │
 │  SYSTEM 1 (Fast, 20Hz)          SYSTEM 2 (Slow, 2Hz)       │
 │  ┌────────────────────┐         ┌──────────────────────┐    │
 │  │ World Model        │         │ VLA (Vision-Language) │    │
 │  │ ├── BEV Encoder    │         │ ├── Image Encoder     │    │
 │  │ ├── VQ-VAE         │         │ ├── Language Model    │    │
 │  │ ├── Transformer    │         │ ├── Action Decoder    │    │
 │  │ └── Planner        │         │ └── Reasoning Chain   │    │
 │  └────────┬───────────┘         └──────────┬───────────┘    │
 │           │                                │                │
 │           ▼                                ▼                │
 │  ┌────────────────────────────────────────────────────┐     │
 │  │              Arbitration Layer                      │     │
 │  │  - System 2 provides high-level intent/constraints  │     │
 │  │  - System 1 executes within those constraints       │     │
 │  │  - System 2 can override System 1 for edge cases    │     │
 │  └────────────────────────────────────┬───────────────┘     │
 │                                       │                     │
 │                                       ▼                     │
 │                                   CONTROL                   │
 └─────────────────────────────────────────────────────────────┘
```

**Milestones:**
| Milestone | Target | Measurement |
|-----------|--------|-------------|
| M3.1: Language dataset collected | Week 8 | 10K+ annotated scenarios |
| M3.2: VLA fine-tuned on airside | Week 16 | Passes 80% of edge-case scenarios |
| M3.3: Dual-system running shadow | Week 24 | VLA correctly classifies 90%+ of scenarios |
| M3.4: VLA handles marshaller signals | Week 32 | Detects and follows 95%+ of signals |
| M3.5: Full VLA closed-loop (limited) | Week 40 | 100 hours, < 0.5 interventions/10km |

**Go/No-Go for production deployment:**
- [REQUIRED] 1000+ hours total closed-loop operation across all conditions
- [REQUIRED] Zero at-fault collisions
- [REQUIRED] Intervention rate < 0.1 per 10 km
- [REQUIRED] Handles all standard airside scenarios (pushback, towing, stand approach, taxiway crossing)
- [REQUIRED] Passes FAA AGVS safety review (AC 150/5210-XX or equivalent)
- [REQUIRED] Redundant safety systems validated (hardware e-stop, RSS, watchdog)

---

## 8. Quick Start Guide

### 8.1 Objective

Get a world model predicting airside scenes from LiDAR bags within 1 week.

This guide takes the fastest path: use OccWorld (open-source, ECCV 2024) with nuScenes pre-trained weights, adapt minimally to airside LiDAR data, and get predictions running.

### 8.2 Day 1-2: Environment and Data

**Set up compute (2 hours):**
```bash
# Option A: Cloud GPU (recommended for speed)
# Provision 1x A100 80GB on Lambda Labs, RunPod, or CoreWeave
# ~$1.10-1.64/hr

# Option B: Local workstation with RTX 4090 (24GB, will be tight)

# Base environment
conda create -n worldmodel python=3.10 -y
conda activate worldmodel

# PyTorch 2.1+ with CUDA 11.8
pip install torch==2.1.0 torchvision==0.16.0 --index-url https://download.pytorch.org/whl/cu118

# OccWorld dependencies
pip install mmcv==2.1.0 -f https://download.openmmlab.com/mmcv/dist/cu118/torch2.1/index.html
pip install mmdet==3.2.0 mmsegmentation==1.2.2
pip install mmdet3d==1.4.0
pip install einops timm open3d wandb

# Clone OccWorld
git clone https://github.com/wzzheng/OccWorld.git
cd OccWorld
pip install -e .
```

**Prepare airside data (4 hours):**
```bash
# 1. Extract point clouds and poses from ROS bags
pip install rosbags

python scripts/extract_from_bags.py \
    --bag-dir /path/to/airside/bags/ \
    --output-dir /data/airside_quick/ \
    --lidar-topic /pointcloud_aggregator/output \
    --odom-topic /odom/fused \
    --max-bags 10 \
    --target-hz 2  # downsample to 2Hz for training (matches nuScenes)

# 2. Generate self-supervised occupancy labels
# Accumulate 10 future + 10 past frames → dense occupancy ground truth
python scripts/generate_occ_labels.py \
    --data-dir /data/airside_quick/extracted/ \
    --output-dir /data/airside_quick/occupancy/ \
    --accumulate-frames 10 \
    --voxel-size 0.4 \
    --grid-size "200 200 16" \
    --range "[-40, -40, -3, 40, 40, 5]"

# 3. Format into OccWorld-compatible structure
python scripts/format_for_occworld.py \
    --data-dir /data/airside_quick/ \
    --output-dir /data/airside_occworld/ \
    --sequence-length 20
```

### 8.3 Day 3-4: Train Models

**Train VQ-VAE scene tokenizer (8-12 hours):**
```bash
# Use pre-trained nuScenes weights as initialization
# Download OccWorld pre-trained weights
wget https://github.com/wzzheng/OccWorld/releases/download/v1.0/occworld_nuscenes.pth

# Train tokenizer on airside occupancy
python tools/train.py \
    configs/occworld/occworld_tokenizer_airside.py \
    --work-dir output/tokenizer_airside/ \
    --load-from occworld_nuscenes.pth \
    --cfg-options \
        data_root=/data/airside_occworld/ \
        train_dataloader.batch_size=8 \
        optim_wrapper.optimizer.lr=1e-4 \
        train_cfg.max_epochs=50

# Monitor training
# Target: reconstruction_loss < 0.1 by epoch 30
# codebook_perplexity > 300 (of 512 codes)
```

**Train world model transformer (12-24 hours):**
```bash
# Train GPT-style transformer on tokenized sequences
python tools/train.py \
    configs/occworld/occworld_transformer_airside.py \
    --work-dir output/worldmodel_airside/ \
    --load-from output/tokenizer_airside/best.pth \
    --cfg-options \
        data_root=/data/airside_occworld/ \
        train_dataloader.batch_size=4 \
        optim_wrapper.optimizer.lr=5e-5 \
        train_cfg.max_epochs=30 \
        model.world_model.num_layers=6 \
        model.world_model.num_heads=8 \
        model.world_model.embed_dim=256

# Monitor training
# Target: prediction_loss decreasing, token_accuracy > 40% by epoch 20
```

### 8.4 Day 5-6: Evaluate and Visualize

**Run predictions on test sequences:**
```bash
# Generate predictions
python tools/test.py \
    configs/occworld/occworld_transformer_airside.py \
    output/worldmodel_airside/best.pth \
    --work-dir output/eval_airside/ \
    --cfg-options data_root=/data/airside_occworld/

# Visualize predictions vs ground truth
python scripts/visualize_predictions.py \
    --pred-dir output/eval_airside/predictions/ \
    --gt-dir /data/airside_occworld/occupancy/ \
    --output-dir output/eval_airside/vis/ \
    --format video \
    --fps 2
```

**Quick evaluation script:**
```python
#!/usr/bin/env python3
"""Quick evaluation of world model predictions."""

import numpy as np
from pathlib import Path

def quick_eval(pred_dir, gt_dir, horizons=[1, 2, 5]):
    pred_files = sorted(Path(pred_dir).glob('*.npy'))
    gt_files = sorted(Path(gt_dir).glob('*.npy'))

    for h in horizons:
        ious = []
        for pf, gf in zip(pred_files, gt_files):
            pred = np.load(pf)  # (T, 200, 200, 16)
            gt = np.load(gf)

            if h >= pred.shape[0]:
                continue

            # Binary IoU (occupied vs free)
            pred_occ = pred[h] > 0
            gt_occ = gt[h] > 0

            intersection = (pred_occ & gt_occ).sum()
            union = (pred_occ | gt_occ).sum()
            iou = intersection / max(union, 1)
            ious.append(iou)

        print(f"Horizon {h} ({h*0.5:.1f}s): IoU = {np.mean(ious):.3f} "
              f"(+/- {np.std(ious):.3f})")

quick_eval('output/eval_airside/predictions/', '/data/airside_occworld/occupancy/')
```

### 8.5 Day 7: Offline Replay on Vehicle Data

**Run world model on a recorded bag (no vehicle control):**
```bash
# Convert trained model to inference-friendly format
python scripts/export_inference.py \
    --config configs/occworld/occworld_transformer_airside.py \
    --checkpoint output/worldmodel_airside/best.pth \
    --output output/inference_model/

# Replay a bag through the world model pipeline
python scripts/replay_bag_with_worldmodel.py \
    --bag /data/airside_bags/test_drive_001.bag \
    --model-dir output/inference_model/ \
    --lidar-topic /pointcloud_aggregator/output \
    --odom-topic /odom/fused \
    --output-dir output/replay_results/ \
    --visualize
```

**What you should see after 1 week:**
- The world model takes a LiDAR point cloud sequence and predicts what the scene will look like 0.5-2.5 seconds in the future
- Predictions should show: static structure (buildings, fences) persists correctly; moving vehicles/GSE are extrapolated forward; overall scene layout is recognizable
- Quality will be rough (IoU ~20-30% at 1s) — this is expected for a week-one prototype with limited data
- Primary value: validates the entire pipeline works end-to-end, identifies data quality issues, gives a concrete baseline to improve

### 8.6 What to Improve Next

After the quick start, the path to production quality:

| Priority | Action | Expected Improvement |
|----------|--------|---------------------|
| 1 | Collect more data (target 100+ hours) | 10-15% IoU improvement |
| 2 | Add ego velocity conditioning to world model | Better dynamic predictions |
| 3 | Tune VQ-VAE codebook size (try 256, 512, 1024) | Sharper reconstructions |
| 4 | Add semantic classes to occupancy labels | Class-specific prediction quality |
| 5 | Implement Copilot4D-style discrete diffusion | Higher quality multi-modal predictions |
| 6 | Add camera fusion (Phase 2) | Better far-field and semantic understanding |
| 7 | Train planning head on world model outputs | Close the perception-action loop |
| 8 | Export to TensorRT for on-vehicle deployment | Real-time inference on Orin |

---

## Sources

- [Copilot4D: Learning Unsupervised World Models for Autonomous Driving via Discrete Diffusion](https://arxiv.org/html/2311.01017v4)
- [BEVWorld: A Multimodal World Model for Autonomous Driving via Unified BEV Latent Space](https://arxiv.org/html/2407.05679v1)
- [GPD-1: Generative Pre-training for Driving](https://arxiv.org/html/2412.08643v1)
- [OccWorld: Learning a 3D Occupancy World Model for Autonomous Driving](https://github.com/wzzheng/OccWorld)
- [MUVO: A Multimodal Generative World Model for Autonomous Driving with Geometric Representations](https://arxiv.org/html/2311.11762v4)
- [A Survey of World Models for Autonomous Driving](https://arxiv.org/html/2501.11260v4)
- [World Models: The Safety Perspective](https://arxiv.org/html/2411.07690v1)
- [Enhancing End-to-End Autonomous Driving with Latent World Model (LAW)](https://arxiv.org/abs/2406.08481)
- [World4Drive: End-to-End Autonomous Driving via Intention-aware Physical Latent World Model](https://arxiv.org/abs/2507.00603)
- [Designing an Optimal AI Inference Pipeline for Autonomous Driving (NVIDIA)](https://developer.nvidia.com/blog/designing-an-optimal-ai-inference-pipeline-for-autonomous-driving/)
- [PointPillars: Fast Encoders for Object Detection from Point Clouds](https://arxiv.org/abs/1812.05784)
- [VQ-VLA: Improving Vision-Language-Action Models via Scaling Vector-Quantized Action Tokenizers](https://openaccess.thecvf.com/content/ICCV2025/papers/Wang_VQ-VLA_Improving_Vision-Language-Action_Models_via_Scaling_Vector-Quantized_Action_Tokenizers_ICCV_2025_paper.pdf)
- [AutoVLA: A Vision-Language-Action Model for End-to-End Autonomous Driving](https://autovla.github.io/)
- [Wayve GAIA-3: Scaling World Models to Power Safety and Evaluation](https://wayve.ai/thinking/gaia-3/)
- [FAA: Autonomous Ground Vehicle Systems on Airports](https://www.faa.gov/airports/new_entrants/agvs_on_airports)
- [Shadow Testing in Autonomous Vehicles](https://www.researchgate.net/publication/385733470_Shadow_Testing_in_Autonomous_Vehicles_A_Novel_Approach_to_Validating_Full_Self-Driving_AI_Systems)
- [Scaling GAIA-1: 9-Billion Parameter Generative World Model for Autonomous Driving](https://wayve.ai/thinking/scaling-gaia-1/)
