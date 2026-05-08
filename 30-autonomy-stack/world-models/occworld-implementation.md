# OccWorld Implementation Guide

## Hands-On Setup, Training, and Airside Deployment

---

## 1. OccWorld Setup (ECCV 2024)

### 1.1 Repository and Dependencies

```bash
# Clone
git clone https://github.com/wzzheng/OccWorld.git
cd OccWorld

# Dependencies
# Python 3.8+, PyTorch 1.13+, CUDA 11.7+
pip install torch==2.0.1 torchvision==0.15.2 --index-url https://download.pytorch.org/whl/cu117

# mmdetection3d ecosystem (OccWorld builds on this)
pip install mmcv-full==1.7.1 -f https://download.openmmlab.com/mmcv/dist/cu117/torch2.0/index.html
pip install mmdet==2.28.2
pip install mmsegmentation==0.30.0
pip install mmdet3d==1.0.0rc6

# Additional
pip install einops timm open3d
```

### 1.2 Architecture Internals

```
OccWorld Architecture:
│
├── Scene Tokenizer (VQ-VAE)
│   ├── Encoder: 3D Occupancy Grid → BEV projection → 2D CNN → Latent features
│   ├── Quantizer: Codebook with 512 entries, 256-dim embeddings
│   │   └── EMA codebook updates + commitment loss (β=0.25)
│   └── Decoder: Codebook indices → 2D features → upscale → 3D occupancy
│
├── World Model (GPT-style Transformer)
│   ├── Input: sequence of scene tokens (past T frames)
│   ├── Architecture: 6 transformer layers, 8 heads, 256-dim
│   ├── Temporal causal attention (can only attend to past)
│   ├── U-Net style multi-scale aggregation
│   └── Output: predicted next scene tokens
│
└── Decoder
    ├── Scene tokens → 3D Semantic Occupancy
    └── Ego token → Future ego trajectory
```

### 1.3 Data Preparation (nuScenes)

```bash
# 1. Download nuScenes (full dataset, ~400GB)
# https://www.nuscenes.org/download

# 2. Generate occupancy labels
# OccWorld uses Occ3D labels (pre-generated)
# Download from: https://github.com/Tsinghua-MARS-Lab/Occ3D

# 3. Directory structure expected:
data/
├── nuscenes/
│   ├── maps/
│   ├── samples/
│   ├── sweeps/
│   ├── v1.0-trainval/
│   └── gts/          # Occ3D occupancy labels
│       ├── scene-0001/
│       │   ├── 0.npz  # (200, 200, 16) uint8 semantic occupancy
│       │   ├── 1.npz
│       │   └── ...
│       └── ...

# 4. Create info files
python tools/create_data.py nuscenes --root-path ./data/nuscenes \
    --out-dir ./data/nuscenes --extra-tag nuscenes
```

### 1.4 Training Procedure

```bash
# Stage 1: Train VQ-VAE tokenizer (scene tokenizer)
python train.py --config configs/occworld_vqvae.py \
    --work-dir work_dirs/vqvae \
    --gpu-ids 0 1 2 3

# Training time: ~12-24 hours on 4x A100
# Key hyperparameters:
#   codebook_size: 512
#   embedding_dim: 256
#   commitment_loss_weight: 0.25
#   learning_rate: 1e-4
#   batch_size: 4 per GPU

# Stage 2: Train world model (transformer)
python train.py --config configs/occworld_transformer.py \
    --work-dir work_dirs/world_model \
    --load-vqvae work_dirs/vqvae/latest.pth \
    --gpu-ids 0 1 2 3

# Training time: ~24-48 hours on 4x A100
# Key hyperparameters:
#   transformer_layers: 6
#   num_heads: 8
#   context_length: 8 (past frames)
#   prediction_horizon: 4-8 (future frames)
#   learning_rate: 5e-5
#   batch_size: 2 per GPU
```

### 1.5 Inference

```python
import torch
from occworld import OccWorldModel

model = OccWorldModel.load_pretrained('work_dirs/world_model/latest.pth')
model.eval().cuda()

# Input: past occupancy grids (T, C, H, W, D)
# T = number of past frames (e.g., 8)
# C = semantic classes (e.g., 17 for nuScenes)
# H, W = BEV resolution (200, 200 for nuScenes)
# D = height bins (16 for nuScenes)
past_occupancy = torch.randn(1, 8, 17, 200, 200, 16).cuda()

# Optional: ego action (candidate trajectory)
ego_trajectory = torch.randn(1, 4, 3).cuda()  # 4 future steps, (x, y, yaw)

# Predict future
with torch.no_grad():
    future_occupancy = model.predict(past_occupancy, ego_trajectory)
    # Output: (1, K, 17, 200, 200, 16) — K future timesteps

# future_occupancy[0, 0] = predicted occupancy at t+1
# future_occupancy[0, 3] = predicted occupancy at t+4
```

---

## 2. Occupancy Label Generation from LiDAR

### 2.1 Self-Supervised (No 3D Labels Needed)

For airside where you have no labeled data, self-supervised occupancy is the path:

```python
def generate_occupancy_from_lidar_accumulation(
    point_clouds: List[np.ndarray],  # List of T point clouds
    poses: List[np.ndarray],          # List of T ego poses (4x4)
    voxel_size: float = 0.2,
    x_range: Tuple = (-51.2, 51.2),
    y_range: Tuple = (-51.2, 51.2),
    z_range: Tuple = (-1.0, 5.0),
):
    """
    Accumulate multi-sweep LiDAR into dense occupancy.
    Points → occupied voxels.
    Ray casting → free voxels.
    Unobserved → unknown.
    """
    # Grid dimensions
    nx = int((x_range[1] - x_range[0]) / voxel_size)
    ny = int((y_range[1] - y_range[0]) / voxel_size)
    nz = int((z_range[1] - z_range[0]) / voxel_size)
    occupancy = np.full((nx, ny, nz), -1, dtype=np.int8)  # -1 = unknown

    for pc, pose in zip(point_clouds, poses):
        # Transform point cloud to reference frame
        pc_world = (pose[:3, :3] @ pc[:, :3].T + pose[:3, 3:4]).T

        # Mark occupied voxels
        vx = ((pc_world[:, 0] - x_range[0]) / voxel_size).astype(int)
        vy = ((pc_world[:, 1] - y_range[0]) / voxel_size).astype(int)
        vz = ((pc_world[:, 2] - z_range[0]) / voxel_size).astype(int)
        valid = (vx >= 0) & (vx < nx) & (vy >= 0) & (vy < ny) & (vz >= 0) & (vz < nz)
        occupancy[vx[valid], vy[valid], vz[valid]] = 1  # occupied

        # Ray casting for free space
        sensor_pos = pose[:3, 3]
        for point in pc_world[valid]:
            ray_voxels = bresenham_3d(sensor_pos, point, voxel_size, x_range, y_range, z_range)
            for rv in ray_voxels[:-1]:  # all voxels except endpoint are free
                if occupancy[rv[0], rv[1], rv[2]] != 1:  # don't overwrite occupied
                    occupancy[rv[0], rv[1], rv[2]] = 0  # free

    return occupancy  # -1=unknown, 0=free, 1=occupied
```

### 2.2 RenderOcc-Style (Camera Rendering Supervision)

When cameras are available, you can train occupancy without 3D labels by:
1. Predict 3D occupancy from BEV features
2. Render the predicted occupancy to 2D (differentiable volume rendering)
3. Supervise with 2D depth maps (from LiDAR projection) and 2D segmentation (from SAM/DINO)

This is entirely self-supervised in 3D.

---

## 3. Custom Domain Fine-tuning (nuScenes → Airside)

### 3.1 Handling Different LiDAR Configurations

**Problem:** OccWorld is trained on nuScenes (Velodyne HDL-32E, 32-beam, 360°). Your system uses RoboSense RSHELIOS (32-ch, 70° vertical FOV) and RSBP (32-ch, 90°).

**Solution: Point cloud normalization**

```python
def normalize_pointcloud_for_occworld(
    pc: np.ndarray,           # (N, 4) x,y,z,intensity from RoboSense
    source: str = 'robosense', # or 'velodyne'
):
    """Normalize point cloud to OccWorld's expected distribution."""
    # 1. Coordinate system alignment
    # RoboSense: x=forward, y=left, z=up (same as nuScenes — good)

    # 2. Intensity normalization
    # RoboSense: 0-255 uint8. nuScenes Velodyne: 0-255 but different calibration
    # Normalize to [0, 1]
    pc[:, 3] = pc[:, 3] / 255.0

    # 3. Range clipping (match nuScenes training distribution)
    range_mask = np.linalg.norm(pc[:, :3], axis=1) < 50.0  # 50m max range
    pc = pc[range_mask]

    # 4. Density matching (optional)
    # If your multi-LiDAR setup is denser, subsample to match nuScenes density
    if pc.shape[0] > 35000:  # nuScenes typically has ~35K points/frame
        indices = np.random.choice(pc.shape[0], 35000, replace=False)
        pc = pc[indices]

    return pc
```

### 3.2 Fine-tuning Strategy

```python
# Phase 1: Self-supervised pre-training on airside data (no labels)
# Use accumulated LiDAR to generate occupancy pseudo-labels
# Train VQ-VAE tokenizer to represent airside scenes

# Phase 2: Fine-tune world model
# Freeze VQ-VAE (or fine-tune with low LR)
# Train transformer to predict future airside occupancy
# Use next-frame prediction as self-supervised objective

# Phase 3: Add semantic labels (when auto-labeled data is available)
# Add semantic channels to occupancy
# Fine-tune decoder to produce semantic occupancy

training_config = {
    'pretrained': 'occworld_nuscenes.pth',  # nuScenes pre-trained
    'freeze_vqvae_epochs': 10,  # freeze tokenizer initially
    'lr': 1e-5,  # 10x lower than from scratch
    'epochs': 50,
    'batch_size': 2,
    'data': 'airside_occupancy_dataset',
}
```

### 3.3 Minimum Data Requirements

| Data Volume | Expected Quality | Notes |
|-------------|-----------------|-------|
| 10 hours | Poor — overfits | Barely enough to adapt VQ-VAE codebook |
| 50 hours | Moderate | World model learns basic airside motion patterns |
| 200 hours | Good | Captures seasonal/time-of-day variation |
| 500+ hours | Strong | Robust to diverse airport conditions |

**Key:** Self-supervised pre-training (predict next frame) requires no labels, only LiDAR + ego-pose. This means ALL your bag data is usable immediately.

---

## 4. Drive-OccWorld (AAAI 2025)

### 4.1 Action Conditioning

The critical upgrade from OccWorld: the world model is conditioned on ego actions.

```
OccWorld:      past_scenes → future_scenes (no action input)
Drive-OccWorld: past_scenes + ego_action → future_scenes (action-conditioned)
```

**Why this matters for planning:**
- OccWorld predicts what the world will do regardless of ego action → useful for prediction
- Drive-OccWorld predicts what the world will do IF you take a specific action → useful for planning

```python
# Drive-OccWorld planning loop
trajectories = frenet_planner.generate_candidates()  # 420 candidates
scores = []

for traj in trajectories:
    # Ask: "what happens if I follow this trajectory?"
    future_occ = drive_occworld.predict(
        past_scenes=past_occupancy,
        ego_action=traj  # THIS IS THE KEY DIFFERENCE
    )

    # Score: collision probability with predicted occupancy
    collision_score = compute_collision(traj, future_occ)
    scores.append(collision_score)

best_trajectory = trajectories[np.argmin(scores)]
```

### 4.2 Architecture Differences from OccWorld

| Component | OccWorld | Drive-OccWorld |
|-----------|---------|----------------|
| Action input | None | Ego trajectory encoded as tokens |
| Prediction | Unconditional | Conditioned on ego action |
| Planning use | Indirect (prediction only) | Direct (evaluate candidate actions) |
| Performance | Baseline | +33% improvement over UniAD |

---

## 5. ROS Integration

### 5.1 World Model ROS Node

```python
#!/usr/bin/env python3
"""OccWorld ROS node for airside AV."""

import rospy
import torch
import numpy as np
from sensor_msgs.msg import PointCloud2
from nav_msgs.msg import Odometry
from std_msgs.msg import Header
import sensor_msgs.point_cloud2 as pc2

# Custom message (define in airside_msgs)
from airside_perception_msgs.msg import OccupancyPrediction

class OccWorldNode:
    def __init__(self):
        rospy.init_node('occworld_prediction')

        # Load model
        self.model = load_occworld_model(
            rospy.get_param('~model_path'),
            device='cuda'
        )
        self.model.eval()

        # History buffer
        self.bev_history = []
        self.history_length = rospy.get_param('~history_length', 8)

        # Subscribers
        rospy.Subscriber('/bev_encoder/features', BEVFeatures, self.bev_callback)
        rospy.Subscriber('/odom/fused', Odometry, self.odom_callback)

        # Publisher
        self.occ_pub = rospy.Publisher(
            '/occworld/prediction',
            OccupancyPrediction,
            queue_size=1
        )

        # Rate: 5Hz (every other LiDAR frame at 10Hz)
        self.timer = rospy.Timer(rospy.Duration(0.2), self.predict_callback)

    def predict_callback(self, event):
        if len(self.bev_history) < self.history_length:
            return

        with torch.no_grad():
            # Stack history
            past = torch.stack(self.bev_history[-self.history_length:]).unsqueeze(0).cuda()

            # Predict
            future_occ = self.model.predict(past)

            # Publish
            msg = OccupancyPrediction()
            msg.header = Header(stamp=rospy.Time.now())
            msg.prediction_horizon = future_occ.shape[1]
            msg.resolution = 0.2
            msg.data = future_occ.cpu().numpy().tobytes()
            self.occ_pub.publish(msg)

if __name__ == '__main__':
    node = OccWorldNode()
    rospy.spin()
```

### 5.2 Threading Model

```
Main thread (ROS):
  ├── Sensor callbacks (receive point clouds, odometry)
  ├── Timer callbacks (trigger prediction at 5Hz)
  └── Publisher (send predictions)

GPU thread (PyTorch):
  ├── BEV encoding (PointPillars forward pass)
  ├── VQ-VAE tokenization
  └── Transformer prediction

Communication: torch.cuda.Stream for async GPU ops
              Python queue for thread-safe data passing
```

**Latency target:** BEV encoding (20ms) + VQ-VAE (5ms) + Transformer (50ms) = ~75ms total. Within 200ms budget including ROS overhead.

---

## Sources

- [OccWorld (ECCV 2024)](https://arxiv.org/abs/2311.16038) — [GitHub](https://github.com/wzzheng/OccWorld)
- [Drive-OccWorld (AAAI 2025)](https://arxiv.org/abs/2311.16038)
- [Occ3D (NeurIPS 2023)](https://github.com/Tsinghua-MARS-Lab/Occ3D)
- [SelfOcc](https://arxiv.org/abs/2311.12754)
- [RenderOcc](https://arxiv.org/abs/2309.09502)
- [OpenOccupancy](https://github.com/JeffWang987/OpenOccupancy)
