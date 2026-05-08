# BEV Encoding Architectures for Airside AV

## Practical Implementation Guide

---

## 1. LiDAR-to-BEV Encoders

### 1.1 PointPillars (Recommended Starting Point)

**Architecture:**
- Converts point cloud into vertical pillars (columns of points)
- Each pillar: fixed (x,y) position, variable number of points
- PointNet per pillar → fixed-size feature → scatter to 2D BEV grid
- 2D CNN backbone on BEV grid → detection heads

**Configuration for Airside:**
```yaml
# Recommended PointPillars config for airside
point_cloud_range: [-51.2, -51.2, -3.0, 51.2, 51.2, 5.0]  # 102.4m x 102.4m, -3m to 5m height
voxel_size: [0.2, 0.2, 8.0]  # 0.2m BEV resolution, full height pillars
max_points_per_voxel: 32
max_voxels: [40000, 40000]  # train, test
```

**Performance on Jetson Orin (measured benchmarks from community):**
- PointPillars (nuScenes config): ~15-25ms inference with TensorRT FP16
- Memory: ~500MB GPU
- Accuracy: 45-50 mAP on nuScenes (sufficient for BEV feature extraction, not final detection)

**Why PointPillars for airside:**
- Fast enough for 10Hz pipeline on Orin
- Handles RoboSense RSHELIOS/RSBP point clouds natively (any unorganized point cloud works)
- Simple architecture = easier to debug and modify
- Excellent as BEV feature backbone even if not used for final detection

**Key repos:**
- [OpenPCDet](https://github.com/open-mmlab/OpenPCDet) — reference implementation, TensorRT export supported
- [MMDetection3D](https://github.com/open-mmlab/mmdetection3d) — alternative with more model zoo options
- [NVIDIA CenterPoint-TensorRT](https://github.com/NVIDIA-AI-IOT/centerpoint) — Orin-optimized

### 1.2 CenterPoint (Recommended for Detection)

**Architecture:**
- Two-stage: voxel encoder → 3D sparse conv backbone → BEV scatter → 2D backbone → center heatmap heads
- Detects objects as center points (no anchors needed)
- Second stage: point features from first-stage proposals for refinement

**Advantages for airside:**
- Center-based detection handles unusual aspect ratios (aircraft are very long)
- No anchor tuning needed (critical when your objects are different from road vehicles)
- Built-in velocity estimation from multi-frame

**Two variants:**
| Variant | 3D Backbone | Speed | Accuracy |
|---------|-------------|-------|----------|
| CenterPoint-Pillar | PointPillars | ~20ms | 50 mAP |
| CenterPoint-Voxel | VoxelNet + Sparse Conv | ~40ms | 56 mAP |

**For airside: start with CenterPoint-Pillar** (faster), upgrade to CenterPoint-Voxel if accuracy is insufficient.

### 1.3 VoxelNet / SECOND

**Architecture:**
- Full 3D voxelization (not pillars)
- 3D sparse convolutions (much more efficient than dense 3D conv)
- SECOND: Spatially Sparse Convolutional Encoder-Decoder Network

**When to use:** When you need fine-grained height information (relevant for ULD detection, deck height estimation — your existing stack already handles this with RANSAC, so this may be redundant initially).

---

## 2. Camera-to-BEV (When Cameras Are Added)

### 2.1 LSS (Lift-Splat-Shoot)

**How it works:**
1. **Lift:** For each pixel, predict a discrete depth distribution (e.g., 59 bins from 4m to 45m)
2. **Splat:** Create a point cloud of features: each pixel's feature × depth probability → 3D feature frustum → project to BEV grid
3. **Shoot:** 2D convolution on the BEV grid

**Practical considerations:**
- Memory: ~1.5-2GB per camera at 900×1600 resolution
- Depth prediction quality is critical — garbage depths → garbage BEV
- Multi-camera: process each camera independently, accumulate in same BEV grid
- Works well when you have LiDAR depth supervision for training

**Why LSS for airside:** Simple, well-understood, and you can supervise the depth prediction with your LiDAR depth. When you add cameras, you already have LiDAR providing ground truth depth.

### 2.2 BEVFormer

**How it works:**
- Learnable BEV queries (like DETR's object queries, but for spatial positions)
- Deformable cross-attention from BEV queries to multi-camera image features
- Temporal self-attention across previous BEV features
- No explicit depth prediction needed

**When to use:** When you have enough data and compute for the transformer training. More powerful than LSS but harder to train and more compute-intensive.

### 2.3 SimpleBEV

**Key finding:** A simple baseline (IPM projection + learned refinement) can match BEVFormer on many metrics. Worth trying first before complex architectures.

**Recommendation:** Start with LSS when cameras are added. It's simpler, depth is supervised by LiDAR, and it's well-understood. Move to BEVFormer only if LSS is insufficient.

---

## 3. Multi-Modal BEV Fusion

### 3.1 BEVFusion (MIT — Recommended)

**Architecture:**
```
Camera images → Camera Backbone (e.g., Swin-T) → LSS → Camera BEV features
LiDAR points → LiDAR Backbone (e.g., VoxelNet) → LiDAR BEV features
                                                          │
Camera BEV ──────── Concatenate ──────── LiDAR BEV        │
                       │                                   │
                  Conv Fusion Layer                         │
                       │                                   │
                  Fused BEV features                       │
                       │                                   │
              Task Heads (detection, segmentation, etc.)
```

**Critical design for sensor-graceful degradation:**

The key insight for your system: train with random camera dropout so the model handles missing cameras.

```python
# During training: randomly mask camera inputs
if training:
    camera_mask = torch.bernoulli(torch.full((num_cameras,), 0.7))  # 70% camera keep rate
    camera_bev = camera_bev * camera_mask.unsqueeze(-1).unsqueeze(-1)

# At inference: when cameras unavailable, zero-pad camera BEV
if not cameras_available:
    camera_bev = torch.zeros_like(lidar_bev)

fused_bev = fusion_conv(torch.cat([lidar_bev, camera_bev], dim=1))
```

This ensures:
- LiDAR-only mode works (Phase 1) — camera BEV is all zeros
- Camera-added mode works (Phase 2) — full fusion
- Sensor failure handling — graceful degradation if camera(s) fail

### 3.2 Fusion Architecture Recommendation

```
Phase 1 (LiDAR-only):
  PointPillars → BEV features (C=256, H=256, W=256)
  These features go directly to world model

Phase 2 (LiDAR + Camera):
  PointPillars → LiDAR BEV (C=128)
  DINOv2 + LSS → Camera BEV (C=128)
  Concatenate → Conv1x1 → Fused BEV (C=256)
  Same shape as Phase 1 → world model unchanged
```

**The key:** keep the BEV output shape constant across phases. The world model never knows if it's receiving LiDAR-only or fused features. Sensor composition is hidden behind the BEV abstraction.

---

## 4. BEV Configuration for Airside

### 4.1 Resolution and Range

| Parameter | Road AV (typical) | Airside AV (recommended) | Rationale |
|-----------|-------------------|-------------------------|-----------|
| BEV range | 50-100m | 100m (extend to 200m for aircraft) | Low speed = less range needed, but aircraft are large and detected far |
| BEV resolution | 0.1-0.2m | 0.2m | Balance between detail and compute |
| Height range | -5m to 3m | -1m to 8m | Aircraft tails, jet bridges, overhead structures |
| Height bins | N/A (pillars) | 30 bins × 0.3m (for voxel) | Enough to distinguish ground vehicles from aircraft wings |

### 4.2 Feature Dimensions

```
BEV grid: 500 × 500 (at 0.2m/px, 100m range)
         or 1000 × 1000 (at 0.2m/px, 200m range)
Feature channels: 256
Total: 500 × 500 × 256 = 64M values (256MB FP32, 128MB FP16)
```

This is the input to the world model at each timestep.

---

## 5. Training Recipes

### 5.1 PointPillars on nuScenes (Pre-training)

```yaml
# OpenPCDet config
optimizer:
  type: adam_onecycle
  lr: 0.003
  weight_decay: 0.01
  momentum: 0.9

training:
  epochs: 80
  batch_size: 4  # per GPU
  grad_clip: 10.0

augmentation:
  gt_sampling: true  # paste ground truth objects into scenes
  random_flip: [x, y]
  random_rotation: [-0.78, 0.78]  # ±45°
  random_scaling: [0.95, 1.05]

# 8x A100: ~6-8 hours for PointPillars on nuScenes
# 1x A100: ~24-48 hours
```

### 5.2 Fine-tuning on Airside Data

```yaml
# Key changes from pre-training:
optimizer:
  lr: 0.0003  # 10x lower than pre-training

training:
  epochs: 20  # fewer epochs, less data

# Freeze backbone, only fine-tune heads initially
freeze_backbone: true
freeze_backbone_epochs: 5  # unfreeze after 5 epochs

# Custom classes
classes: [
  'aircraft', 'baggage_tractor', 'belt_loader', 'pushback_tug',
  'fuel_truck', 'catering_truck', 'ground_crew', 'ULD', 'trailer',
  'maintenance_vehicle', 'fire_truck', 'follow_me_car', 'FOD'
]
```

---

## 6. TensorRT Deployment

### 6.1 Export Pipeline

```bash
# 1. Train in PyTorch (OpenPCDet)
python train.py --cfg cfgs/nuscenes/centerpoint_pillar.yaml

# 2. Export to ONNX
python export_onnx.py --cfg cfgs/nuscenes/centerpoint_pillar.yaml \
    --ckpt output/centerpoint/latest.pth

# 3. Build TensorRT engine
trtexec --onnx=centerpoint.onnx \
    --saveEngine=centerpoint.engine \
    --fp16 \
    --workspace=4096 \
    --minShapes=voxels:1x32x10,voxel_num:1 \
    --maxShapes=voxels:40000x32x10,voxel_num:1

# 4. Run inference
python infer_trt.py --engine centerpoint.engine --pcd test.pcd
```

### 6.2 Quantization Effects

| Precision | Latency (Orin) | mAP Loss | Memory |
|-----------|---------------|----------|--------|
| FP32 | ~50ms | Baseline | ~1GB |
| FP16 | ~20ms | <0.5% | ~500MB |
| INT8 | ~12ms | 1-3% | ~300MB |

**Recommendation:** FP16 for production. INT8 only if latency budget is extremely tight.

---

## 7. Connecting BEV to World Model

The BEV encoder produces features that feed directly into the world model:

```python
class BEVWorldModelPipeline:
    def __init__(self):
        self.bev_encoder = PointPillarsBEV(...)  # Phase 1: LiDAR-only
        # self.bev_encoder = BEVFusionEncoder(...)  # Phase 2: multi-modal
        self.tokenizer = VQVAETokenizer(codebook_size=512)
        self.world_model = OccWorldTransformer(...)

    def forward(self, sensor_bundle):
        # 1. Encode to BEV (same interface regardless of sensors)
        bev_features = self.bev_encoder(sensor_bundle)  # (B, C, H, W)

        # 2. Tokenize BEV features
        tokens, indices = self.tokenizer.encode(bev_features)  # (B, N_tokens)

        # 3. World model predicts future tokens
        future_tokens = self.world_model.predict(
            past_tokens=tokens_history,      # T past timesteps
            ego_action=candidate_trajectory   # what the planner proposes
        )

        # 4. Decode to occupancy
        future_occupancy = self.tokenizer.decode(future_tokens)  # (B, K, H, W, D)

        return future_occupancy
```

**Key insight:** The BEV encoder is a plug-and-play component. The world model sees (C, H, W) features regardless of whether they came from LiDAR pillars, camera LSS, or fused BEVFusion. This is the sensor abstraction in practice.

---

## Sources

- [PointPillars (CVPR 2019)](https://arxiv.org/abs/1812.05784)
- [CenterPoint (CVPR 2021)](https://arxiv.org/abs/2006.11275)
- [BEVFusion (ICRA 2023)](https://arxiv.org/abs/2205.13542)
- [LSS - Lift, Splat, Shoot (ECCV 2020)](https://arxiv.org/abs/2008.05711)
- [BEVFormer (ECCV 2022)](https://arxiv.org/abs/2203.17270)
- [OpenPCDet](https://github.com/open-mmlab/OpenPCDet)
- [MMDetection3D](https://github.com/open-mmlab/mmdetection3d)
- [NVIDIA CenterPoint TensorRT](https://github.com/NVIDIA-AI-IOT/centerpoint)
- [SimpleBEV](https://arxiv.org/abs/2206.07959)
- [DINOv2](https://arxiv.org/abs/2304.07193)
