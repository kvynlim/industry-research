# Multi-Modal Sensor Fusion Architectures for Autonomous Driving

## LiDAR + Camera + Radar Fusion — Design for Incremental Sensor Addition

---

## 1. Fusion Taxonomy

### 1.1 By Stage

| Level | Where | How | Example |
|-------|-------|-----|---------|
| **Early (Data-level)** | Before feature extraction | Concatenate raw data | Project LiDAR points onto images |
| **Mid (Feature-level)** | After backbone, before heads | Fuse feature maps | BEVFusion concatenates BEV features |
| **Late (Decision-level)** | After per-modal predictions | Merge detections/tracks | Ensemble 3D boxes from LiDAR + camera |

**Recommendation for airside:** Mid-level (feature-level) fusion in BEV space. This preserves modality-specific features while creating a unified representation for downstream tasks. It also naturally handles missing modalities (zero out the missing BEV features).

### 1.2 By Architecture

```
Type A: Proposal-level fusion (PointPainting, MVP)
  LiDAR points → detect 3D proposals → project to image → augment with image features
  Pro: Simple, works with existing 3D detectors
  Con: Dependent on projection accuracy (calibration-sensitive)

Type B: BEV-level fusion (BEVFusion, TransFusion)
  Each modality → independent BEV encoder → concatenate/attend in BEV → shared heads
  Pro: Clean separation, graceful degradation, unified downstream
  Con: Each modality needs its own BEV encoder

Type C: Point-level fusion (PointFusion, DeepFusion)
  Raw point cloud + raw images → joint processing from the start
  Pro: Maximum information exchange
  Con: Tightly coupled, hard to degrade gracefully
```

---

## 2. BEVFusion (MIT — Recommended)

### 2.1 Architecture

```
Camera Images (6 views, 900×1600)
    │
    ├── Image Backbone (Swin-T or DINOv2-B)
    │   → Multi-scale features per view
    │
    ├── View Transform (LSS: Lift-Splat-Shoot)
    │   → Predict depth distribution per pixel
    │   → Create 3D feature frustum
    │   → Splat to BEV grid
    │
    └── Camera BEV features: (C_cam=80, H=180, W=180)

LiDAR Point Cloud (N×4)
    │
    ├── Voxelization (VoxelNet or PointPillars)
    │
    ├── 3D Sparse Convolution backbone
    │
    └── LiDAR BEV features: (C_lidar=256, H=180, W=180)

Fusion:
    Camera BEV (80, 180, 180) + LiDAR BEV (256, 180, 180)
        │
        ├── Concatenate: (336, 180, 180)
        │
        ├── ConvFuser: Conv2d(336→256, 1×1) + BN + ReLU
        │
        └── Fused BEV: (256, 180, 180)
            │
            ├── 3D Detection Head (CenterPoint-style)
            └── BEV Segmentation Head (map elements)
```

### 2.2 Key Design Choices

**Why BEV for fusion:**
- Sensor-independent after BEV encoding — downstream doesn't know which sensors produced features
- Natural 2D convolutions on BEV (efficient, well-optimized)
- Scale-consistent (1 pixel = 0.2m everywhere, unlike perspective images)

**Efficient BEV pooling:**
The original LSS view transform is the bottleneck. BEVFusion introduces efficient BEV pooling:
```
Standard LSS: scatter operation → O(N_pixels × D_depths) → 500ms
BEVFusion pooling: precomputed associations + GPU parallel → 8ms
Speedup: ~62.5x
```

### 2.3 Performance (nuScenes)

| Method | Modality | mAP | NDS | Latency |
|--------|----------|-----|-----|---------|
| CenterPoint | LiDAR | 58.0 | 65.5 | 60ms |
| BEVDet | Camera | 31.2 | 39.2 | 42ms |
| **BEVFusion (MIT)** | **LiDAR + Camera** | **68.5** | **71.4** | **85ms** |
| TransFusion-L | LiDAR + Camera | 67.5 | 71.3 | 95ms |

Camera adds **+10.5 mAP** over LiDAR-only — significant but LiDAR remains the backbone.

---

## 3. Alternative Fusion Architectures

### 3.1 BEVFusion (Megvii/NVIDIA)

Differs from MIT version:
- Uses BEVPool with efficient kernel (precomputed scatter indices)
- Focus on speed for deployment
- Similar accuracy, slightly faster inference

### 3.2 TransFusion

```
Stage 1: LiDAR-only proposals (CenterPoint)
  → Initial 3D box proposals from LiDAR BEV

Stage 2: Cross-attention to camera features
  → For each proposal, attend to relevant image features
  → Refine box parameters with image information

Pro: LiDAR proposals are robust; camera refines details (color, type)
Con: Sequential (slower than parallel BEVFusion)
```

### 3.3 DeepFusion

- Deep continuous fusion: LiDAR features augmented with camera features at every layer
- Uses InverseAug to align augmented LiDAR with camera features
- Best accuracy but highest complexity

### 3.4 UniTR (Unified Transformer)

```
All modalities → Shared transformer backbone
  → Modal-specific tokenization (voxel tokens for LiDAR, patch tokens for camera)
  → Cross-modal attention in unified transformer
  → Task-specific heads

Pro: Elegant, maximum information sharing
Con: Cannot easily handle missing modalities, high compute
```

---

## 4. 4D Radar Integration

### 4.1 What 4D Radar Adds

| Measurement | Camera | LiDAR | 4D Radar |
|-------------|--------|-------|----------|
| Range | No (monocular depth) | Yes (±2cm) | Yes (±10cm) |
| Velocity | No | No (single-frame) | **Yes (Doppler, ±0.1m/s)** |
| All-weather | Poor (rain, fog) | Poor (heavy rain) | **Excellent** |
| Cost | Low ($10-50) | Medium ($200-5K) | Low ($50-200) |
| Angular resolution | High | High | **Low** (main weakness) |

**Key value:** Doppler velocity is **not available from any other sensor**. Combined with LiDAR geometry, it gives instantaneous velocity per object without tracking.

### 4.2 Radar Fusion Architectures

```
Option A: Radar as point cloud (add to LiDAR pillarization)
  Radar points (x, y, z, v_doppler, RCS) → pillarize alongside LiDAR
  Simple but loses radar-specific information

Option B: Separate radar BEV encoder
  Radar → RadarPillarNet → Radar BEV features
  Concatenate with LiDAR + Camera BEV → Fuse

Option C: RCFusion (Radar-Camera Fusion)
  Radar Doppler → velocity map in image space
  Camera + velocity map → enhanced detection
```

### 4.3 Continental ARS548 (Leading 4D Radar)

```
Specs: 77GHz, 300m range, 120°×30° FOV, 20Hz, 800+ points/frame
Integration: Automotive Ethernet output, CAN FD control
ROS driver: continental_ars548 package
Data: Each point = (range, azimuth, elevation, Doppler velocity, RCS)
```

---

## 5. Graceful Degradation Design

### 5.1 Masked Modality Training

**The critical pattern:** Train with random sensor dropout so the model handles missing sensors at inference.

```python
class GracefulBEVFusion(nn.Module):
    def __init__(self):
        self.lidar_encoder = PointPillarsBEV(out_channels=128)
        self.camera_encoder = LSS_BEV(out_channels=128)
        self.radar_encoder = RadarPillarBEV(out_channels=64)
        self.fuser = nn.Sequential(
            nn.Conv2d(128+128+64, 256, 1),  # 320 → 256
            nn.BatchNorm2d(256),
            nn.ReLU()
        )

    def forward(self, lidar=None, cameras=None, radar=None):
        bev_parts = []

        # LiDAR (always present in our system)
        if lidar is not None:
            bev_parts.append(self.lidar_encoder(lidar))
        else:
            bev_parts.append(torch.zeros(B, 128, H, W, device=device))

        # Camera (optional — added in Phase 2)
        if cameras is not None and self.training:
            # Random camera dropout during training
            if random.random() > 0.3:  # 30% dropout rate
                bev_parts.append(self.camera_encoder(cameras))
            else:
                bev_parts.append(torch.zeros(B, 128, H, W, device=device))
        elif cameras is not None:
            bev_parts.append(self.camera_encoder(cameras))
        else:
            bev_parts.append(torch.zeros(B, 128, H, W, device=device))

        # Radar (optional — added in Phase 2+)
        if radar is not None:
            bev_parts.append(self.radar_encoder(radar))
        else:
            bev_parts.append(torch.zeros(B, 64, H, W, device=device))

        # Fuse whatever is available
        fused = self.fuser(torch.cat(bev_parts, dim=1))
        return fused  # Always (256, H, W) regardless of input modalities
```

### 5.2 Degradation Hierarchy

```
Level 0: All sensors (LiDAR + Camera + Radar) → Full performance
Level 1: LiDAR + Camera (radar failed) → Lose Doppler, still good
Level 2: LiDAR + Radar (camera failed) → Lose texture/color, geometry OK
Level 3: LiDAR only (camera + radar failed) → Baseline performance
Level 4: Camera + Radar (LiDAR failed) → Degraded geometry, possible
Level 5: Single sensor → Minimum safe operation, reduce speed

Transition logic:
  if lidar_healthy and camera_healthy and radar_healthy:
      mode = FULL
  elif lidar_healthy:
      mode = LIDAR_PRIMARY  # camera/radar enhance if available
  elif camera_healthy and radar_healthy:
      mode = CAMERA_RADAR   # reduced but operational
  else:
      mode = SAFE_STOP       # insufficient sensors
```

---

## 6. Camera-LiDAR Calibration

### 6.1 The Problem

To project LiDAR points onto camera images (or vice versa), you need precise extrinsic calibration:

```
p_camera = K · [R|t] · p_lidar

where:
  K = camera intrinsic matrix (3×3)
  [R|t] = extrinsic transform from LiDAR to camera frame (3×4)
  p_lidar = 3D point in LiDAR frame
  p_camera = 2D pixel + depth in camera frame
```

### 6.2 Calibration Methods

| Method | Approach | Accuracy | Automation |
|--------|----------|----------|------------|
| **Checkerboard** | Place checkerboard visible to both sensors | ±1 pixel / ±2cm | Manual |
| **Target-free** | Align edges/features in LiDAR and camera | ±3 pixel / ±5cm | Semi-automatic |
| **Online calibration** | Optimize during operation using natural features | ±5 pixel | Fully automatic |
| **CalibNet** | Neural network predicts extrinsics | ±5 pixel | Fully automatic |

### 6.3 Handling Vibration and Thermal Drift

Airport vehicles experience significant vibration (rough apron surfaces) and temperature variation (-20°C to +50°C):

```
Mitigation strategies:
1. Rigid sensor mounting (machined brackets, no flexibility)
2. Periodic re-calibration check (compare projected LiDAR edges with camera edges)
3. Online calibration correction (small adjustments every 100 frames)
4. Temperature compensation model (calibrate at multiple temperatures, interpolate)
5. Vibration damping mounts (rubber isolators for cameras)
```

---

## 7. Temporal Fusion

### 7.1 Multi-Frame Aggregation

Accumulate multiple LiDAR sweeps for denser point clouds:

```python
def temporal_fusion(current_scan, past_scans, ego_poses, n_sweeps=10):
    """Aggregate n past LiDAR sweeps into current frame."""
    accumulated = [current_scan]

    for i in range(min(n_sweeps, len(past_scans))):
        # Transform past scan to current frame
        T_current_to_past = ego_poses[-1].inverse() @ ego_poses[-(i+2)]
        past_in_current = transform_pointcloud(past_scans[-(i+1)], T_current_to_past)

        # Add time offset as additional feature
        time_offset = (i + 1) * 0.1  # 10Hz LiDAR
        past_in_current = np.column_stack([
            past_in_current[:, :4],
            np.full(len(past_in_current), time_offset)
        ])

        accumulated.append(past_in_current)

    return np.concatenate(accumulated, axis=0)
    # Result: much denser point cloud with temporal information
    # 10 sweeps × 35K points = 350K points
```

### 7.2 Streaming Perception

Handle the reality that sensors have different latencies:

```
Sensor arrival times for a "frame":
  LiDAR: t + 0ms (reference)
  Camera: t + 30ms (exposure + readout + ISP)
  Radar: t + 50ms (processing latency)
  IMU: t - 2ms (minimal latency, arrives early)
  GPS: t + 100ms (NTRIP correction delay)

Strategy: Don't wait for all sensors. Process as they arrive:
  1. LiDAR arrives → start BEV encoding immediately
  2. Camera arrives → start camera BEV encoding
  3. When both ready → fuse and predict
  4. Radar arrives late → update prediction if available

This reduces worst-case latency from max(all_latencies) to LiDAR_latency
```

---

## 8. Foundation Model Backbones for Fusion

### 8.1 DINOv2 as Camera Backbone

```
Standard backbone: ResNet-50 or Swin-T (trained on ImageNet, task-specific)
Foundation backbone: DINOv2 ViT-B (self-supervised on 142M images)

DINOv2 advantages:
  - Rich semantic features without task-specific training
  - Handles novel objects (critical for airside — GSE types never in ImageNet)
  - ~9pp route completion improvement in CARLA (vs supervised)

Usage:
  Frozen DINOv2-B → extract features from each camera view
  → LSS depth estimation + BEV projection
  → Camera BEV features with semantic richness

Fine-tuning: LoRA (r=16) on 500-1000 airside frames adds domain specificity
  without forgetting general object understanding
```

### 8.2 Sensor Configuration for Airside

| Sensor | Count | Placement | Purpose |
|--------|-------|-----------|---------|
| **RoboSense RSHELIOS** | 2 | Front + rear, roof-mounted | Primary 3D perception, long range |
| **RoboSense RSBP** | 4 | Left/right sides, bumper-level | Side coverage, hemispherical FOV |
| **Cameras** (Phase 2) | 6-8 | Surround, roof-mounted | Semantic understanding, signage, markings |
| **4D Radar** (Phase 2+) | 2-4 | Front/rear corners | All-weather, Doppler velocity |
| **RoboSense M1 Plus** (optional) | 1 | Front, bumper | Long-range forward, ASIL-B rated |

**Total data rate:**
```
6 LiDAR × ~1.2M pts/s × 16 bytes/pt = ~115 MB/s
8 cameras × 2MP × 10Hz × 3 bytes = ~480 MB/s (compressed: ~50 MB/s)
4 radar × 800 pts/frame × 20Hz × 20 bytes = ~1.3 MB/s
Total: ~170 MB/s (compressed)
```

---

## Sources

- Liu et al. "BEVFusion: Multi-Task Multi-Sensor Fusion with Unified Bird's-Eye View Representation." ICRA, 2023
- Liang et al. "BEVFusion: A Simple and Robust LiDAR-Camera Fusion Framework." NeurIPS, 2022 (Megvii)
- Bai et al. "TransFusion: Robust LiDAR-Camera Fusion for 3D Object Detection." CVPR, 2022
- Li et al. "DeepFusion: Lidar-Camera Deep Fusion for Multi-Modal 3D Object Detection." CVPR, 2022
- Philion & Fidler. "Lift, Splat, Shoot: Encoding Images from Arbitrary Camera Rigs." ECCV, 2020
- Oquab et al. "DINOv2: Learning Robust Visual Features without Supervision." TMLR, 2024
