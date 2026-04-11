# LiDAR Semantic Segmentation for Airside Autonomous Vehicles

## From RANSAC to Neural Segmentation: A Practical Migration Path

**Last updated:** 2026-04-11

---

## Table of Contents

1. [Why Neural Segmentation for Airside](#1-why-neural-segmentation-for-airside)
2. [Segmentation Task Taxonomy](#2-segmentation-task-taxonomy)
3. [Architecture Families](#3-architecture-families)
4. [SOTA Methods Comparison (2021-2026)](#4-sota-methods-comparison-2021-2026)
5. [Real-Time Methods for NVIDIA Orin](#5-real-time-methods-for-nvidia-orin)
6. [Panoptic Segmentation](#6-panoptic-segmentation)
7. [Training-Free Instance Segmentation](#7-training-free-instance-segmentation)
8. [Airside-Specific Class Taxonomy](#8-airside-specific-class-taxonomy)
9. [LiDAR Foundation Model Fine-Tuning Path](#9-lidar-foundation-model-fine-tuning-path)
10. [Integration with Aurrigo ROS Stack](#10-integration-with-aurrigo-ros-stack)
11. [Deployment on NVIDIA Orin](#11-deployment-on-nvidia-orin)
12. [Migration from RANSAC](#12-migration-from-ransac)
13. [Benchmarks and Evaluation](#13-benchmarks-and-evaluation)
14. [Recommended Architecture](#14-recommended-architecture)
15. [References](#15-references)

---

## 1. Why Neural Segmentation for Airside

### 1.1 Current Aurrigo Perception Limitations

Aurrigo's production stack uses RANSAC-based edge fitting with **3 classes**: ground, obstacle, edge. This is sufficient for basic path following but cannot:

- **Distinguish personnel from equipment** — a 70kg ground crew member and a 500kg cargo dolly are both "obstacle"
- **Detect FOD** — foreign object debris (bolts, luggage fragments, tools) is too small for RANSAC clustering
- **Classify aircraft parts** — fuselage, wing, engine nacelle, landing gear have very different safety implications (jet blast zone from engine ≠ wing overhang)
- **Identify GSE types** — cargo loader vs belt loader vs pushback tractor require different interaction models
- **Handle partial occlusion** — RANSAC merges partially-visible objects into single clusters

### 1.2 What Neural Segmentation Enables

| Capability | RANSAC (Current) | Neural Semantic | Neural Panoptic |
|-----------|------------------|-----------------|-----------------|
| Ground removal | Yes | Yes + surface type | Yes + surface type |
| Person detection | No (blob only) | Yes (per-point) | Yes + instance ID |
| FOD detection | No (<0.1m objects) | Marginal | With fine-tuning |
| Aircraft part classification | No | Yes (fuselage/wing/engine) | Yes + individual aircraft |
| GSE type identification | No | Yes (tractor/loader/belt) | Yes + individual vehicle |
| Processing time (Orin) | ~2ms | 15-50ms | 30-80ms |
| Training data required | None | 5,000-50,000 labeled scans | 10,000-100,000 scans |

### 1.3 The Airside Segmentation Challenge

Airside point clouds differ fundamentally from road driving:

- **Scale range**: Aircraft wingspan 30-65m vs FOD at 0.01-0.1m — **3-4 orders of magnitude**
- **Object density**: Open apron has 5-15 objects vs urban road with 50-200
- **Height variation**: Cargo loader raised to 5m, aircraft tail at 12-18m vs road objects <3m
- **Surface materials**: Concrete with painted markings, metal equipment, rubber tires, glass cockpits
- **Dynamic range**: Stationary aircraft + slow pushback (2 km/h) + fast taxiing (30 km/h) + running crew (10 km/h)
- **Reflectance**: High-vis vests saturate LiDAR intensity, wet concrete causes specular reflection

---

## 2. Segmentation Task Taxonomy

### 2.1 Semantic Segmentation

Assigns a **class label** to every point. No instance distinction.

```
Input:  Point cloud P = {(x_i, y_i, z_i, intensity_i)} for i = 1..N
Output: Labels L = {c_i} where c_i ∈ {ground, vehicle, person, aircraft, ...}
```

- **Use case**: "Where are all people?" (safety zone enforcement)
- **Does NOT answer**: "How many people?" or "Is that the same person as last frame?"

### 2.2 Instance Segmentation

Groups points into **individual object instances** within each class.

```
Output: Labels L = {(c_i, id_i)} where id_i identifies specific object
```

- **Use case**: "There are 3 cargo dollies and 2 ground crew members"
- **Enables**: Object counting, tracking initialization, individual trajectory prediction

### 2.3 Panoptic Segmentation

Combines semantic + instance: every point gets a class label, and "things" (countable objects) also get instance IDs, while "stuff" (ground, building) gets only class labels.

```
Output: Panoptic labels L = {(c_i, id_i)} where id_i = 0 for stuff classes
```

- **Use case**: Full scene understanding — "Aircraft A320 (instance #3) at stand 42, with 2 belt loaders (instances #7, #8) and 4 crew (instances #12-15)"
- **Most valuable for airside** but most computationally expensive

### 2.4 Moving Object Segmentation (MOS)

Binary classification: is each point **static** or **dynamic**?

```
Output: Labels L = {m_i} where m_i ∈ {static, moving}
```

- **Use case**: Distinguish parked aircraft from taxiing aircraft, stationary vs walking crew
- **Complements** semantic segmentation — "moving person" is highest priority

---

## 3. Architecture Families

### 3.1 Point-Based Methods

Process raw points directly using PointNet-style shared MLPs or transformer attention.

| Method | Mechanism | Pros | Cons |
|--------|-----------|------|------|
| PointNet++ (2017) | Hierarchical set abstraction, FPS + ball query | Theoretically elegant | Slow FPS, O(N log N) |
| RandLA-Net (2020) | Random sampling + local feature aggregation | Fast sampling | Lower accuracy |
| PTv3 (2024) | Serialize + patch attention via space-filling curves | **Current SOTA accuracy** | Moderate latency |
| WaffleIron (2023) | 2D backbone on projected point features | Good accuracy | 4.8 FPS on Orin (too slow) |

**Key insight**: PTv3 replaces expensive k-NN neighbor search with a **serialize-and-patch** paradigm — points are sorted along a space-filling curve, then grouped into fixed-size patches for self-attention. This achieves 3x faster inference and 10x less memory than PTv2.

### 3.2 Voxel-Based Methods

Discretize space into regular 3D voxels, apply 3D sparse convolutions.

| Method | Voxel Type | Pros | Cons |
|--------|-----------|------|------|
| MinkUNet (2019) | Cubic voxels + sparse conv (Minkowski Engine) | Strong baseline, well-tested | Fixed resolution tradeoff |
| SPVCNN (2020) | Sparse voxel conv + point-based branch | Best of both worlds | Complex pipeline |
| Cylinder3D (2021) | **Cylindrical** voxels (r, θ, z) | Matches LiDAR scan pattern | Custom CUDA kernels |
| SphereFormer (2023) | Radial windows for attention | Handles range-dependent density | Higher latency |

**Cylindrical voxelization** is particularly relevant for LiDAR because sensor density naturally decreases with range — cylindrical cells have approximately equal point counts regardless of distance.

### 3.3 Range-Image Methods

Project 3D points onto a 2D range image (azimuth × elevation), apply 2D CNNs.

| Method | Backbone | Pros | Cons |
|--------|----------|------|------|
| SqueezeSeg (2018) | SqueezeNet | Very fast | Low accuracy |
| SalsaNext (2020) | Dilated conv + pixel shuffle | **Real-time on Orin** | ~60 mIoU (low) |
| FIDNet (2021) | Fully interpolation decoding | Handles discretization loss | Moderate accuracy |
| CENet (2022) | Range image + multi-scale context | Better boundary quality | Still 2D projection artifacts |

**Trade-off**: Range-image methods are fastest but suffer from **occlusion artifacts** (far points behind near objects are lost in 2D projection) and **discretization error** (nearby points at different heights project to same pixel).

### 3.4 Multi-Representation Fusion

Combine multiple representations for best accuracy.

| Method | Representations | Performance |
|--------|----------------|-------------|
| RPVNet (2021) | Range + Point + Voxel | 70.3% mIoU SemanticKITTI |
| 2DPASS (2022) | Range image + 3D voxel + 2D image distillation | 72.9% mIoU |
| UniSeg (2023) | Voxel + range + point + BEV | 75.2% mIoU |

---

## 4. SOTA Methods Comparison (2021-2026)

### 4.1 SemanticKITTI Single-Scan Leaderboard (as of 2026)

| Rank | Method | mIoU (%) | Type | Year | Real-Time? |
|------|--------|----------|------|------|------------|
| 1 | PTv3 + Sonata | **82.7** | Point transformer | 2024 | No (desktop) |
| 2 | UniSeg3D | 78.4 | Multi-representation | 2024 | No |
| 3 | WaffleIron-48-768 | 72.5 | Point-based | 2023 | No (4.8 FPS Orin) |
| 4 | Cylinder3D-TS | 72.2 | Cylindrical voxel | 2021 | Marginal (~8 FPS) |
| 5 | SPVCNN | 69.1 | Sparse voxel + point | 2020 | Marginal (~10 FPS) |
| 6 | MinkUNet-34C | 69.4 | Sparse voxel | 2019 | Marginal (~12 FPS) |
| 7 | SalsaNext | 59.5 | Range image | 2020 | **Yes (~25 FPS Orin)** |
| 8 | FIDNet | 59.2 | Range image | 2021 | **Yes (~30 FPS Orin)** |

### 4.2 nuScenes LiDAR Segmentation Leaderboard

| Method | mIoU (%) | Type | Notes |
|--------|----------|------|-------|
| PTv3 (Sonata pre-train) | **83.5** | Point transformer | Pre-trained on 11 datasets |
| Cylinder3D++ | 77.2 | Cylindrical voxel | Multi-scan input |
| SPVCNN | 77.4 | Sparse voxel + point | TTA improved |
| MinkUNet | 75.3 | Sparse voxel | Baseline |
| SalsaNext | 72.2 | Range image | Fast but less accurate |

### 4.3 Key Observations

1. **PTv3 dominates accuracy** but requires desktop GPU for full inference
2. **Cylinder3D remains the best accuracy/speed tradeoff** for voxel methods
3. **SalsaNext is the only method achieving real-time on Orin** without TensorRT optimization — but accuracy is ~20% lower than SOTA
4. **FlatFormer** (CVPR 2023, MIT Han Lab) bridges the gap: first point cloud transformer achieving **4.6x speedup over SST** while maintaining competitive accuracy. Uses sorted grouping instead of spatial windows
5. **Pre-training** (Sonata, ScaLR) adds 5-10% mIoU on top of any base architecture

---

## 5. Real-Time Methods for NVIDIA Orin

### 5.1 Orin Compute Budget for Segmentation

Assuming Orin AGX 64GB running full AV stack:

| Component | Budget | Notes |
|-----------|--------|-------|
| LiDAR preprocessing | 3-5ms | Point aggregation, ego-motion compensation |
| **Segmentation inference** | **15-25ms target** | Must fit in 10Hz pipeline |
| Post-processing | 2-5ms | Clustering, smoothing |
| Total perception budget | 30-50ms | Leaves room for detection + tracking |

### 5.2 Achieving Real-Time on Orin

#### Option A: SalsaNext + TensorRT (Fastest, Lowest Accuracy)

```python
# SalsaNext on Orin: ~25 FPS with TensorRT FP16
# mIoU: ~60% on SemanticKITTI, ~72% on nuScenes

# Export to ONNX
import torch
model = SalsaNext(num_classes=20)
model.load_state_dict(torch.load('salsanext_kitti.pth'))

dummy_range_image = torch.randn(1, 5, 64, 2048)  # 5 channels: x,y,z,intensity,range
torch.onnx.export(model, dummy_range_image, 'salsanext.onnx',
                   input_names=['range_image'],
                   output_names=['segmentation'],
                   dynamic_axes={'range_image': {0: 'batch'}})

# TensorRT conversion
# trtexec --onnx=salsanext.onnx --saveEngine=salsanext_fp16.engine --fp16 --workspace=2048
```

**Latency**: ~15ms on Orin (FP16), ~10ms (INT8)
**Limitation**: Range-image projection loses 3D spatial fidelity

#### Option B: Cylinder3D + TensorRT (Best Tradeoff)

```python
# Cylinder3D on Orin: ~8-12 FPS (83-125ms baseline)
# With TensorRT sparse conv optimization: ~15-20 FPS target

# Cylindrical voxelization parameters for airside
CYLINDER_CONFIG = {
    'grid_size': [480, 360, 32],      # radial, angular, height
    'max_range': 120.0,                # meters (covers full apron)
    'min_range': 0.5,                  # ignore self-returns
    'height_range': [-3.0, 20.0],      # ground to aircraft tail
    'angular_resolution': 1.0,         # degrees
    'radial_resolution': 0.25,         # meters (inner) to 0.5m (outer)
}

# Sparse convolution with Torchsparse (faster than MinkowskiEngine on Orin)
import torchsparse
from torchsparse import SparseTensor

def cylindrical_voxelize(points, config):
    """Convert Cartesian points to cylindrical voxel coordinates."""
    r = torch.sqrt(points[:, 0]**2 + points[:, 1]**2)
    theta = torch.atan2(points[:, 1], points[:, 0])
    z = points[:, 2]
    
    # Quantize to grid
    r_idx = ((r - config['min_range']) / 
             (config['max_range'] - config['min_range']) * config['grid_size'][0]).long()
    theta_idx = ((theta + torch.pi) / (2 * torch.pi) * config['grid_size'][1]).long()
    z_idx = ((z - config['height_range'][0]) / 
             (config['height_range'][1] - config['height_range'][0]) * config['grid_size'][2]).long()
    
    coords = torch.stack([r_idx, theta_idx, z_idx], dim=1)
    feats = points[:, :4]  # x, y, z, intensity
    
    return SparseTensor(feats, coords)
```

**Optimization path**: Replace MinkowskiEngine with TorchSparse 2.x (2-3x faster sparse conv on Orin)

#### Option C: FlatFormer (Transformer Speed, Better Accuracy)

```python
# FlatFormer: 4.6x faster than SST, competitive accuracy
# Key idea: sort points along space-filling curves, group by count (not spatial window)

FLATFORMER_CONFIG = {
    'num_groups': 256,           # fixed number of groups
    'group_size': 512,           # points per group
    'num_heads': 8,
    'embed_dim': 128,
    'num_layers': 4,
    'sorting_axis': 'hilbert',   # Hilbert curve for spatial locality
    'window_shift': True,        # alternate axes between layers
}

# Estimated Orin performance:
# FP16: ~20-25 FPS (40-50ms)
# INT8: ~30-35 FPS (28-33ms) — within real-time budget
```

**Advantage over Cylinder3D**: No custom CUDA kernels for cylindrical partition — standard attention ops that TensorRT optimizes well.

#### Option D: PTv3 Lite (Highest Accuracy, Heavier)

PTv3 with reduced patch size and fewer layers:

```python
PTV3_LITE_CONFIG = {
    'enc_channels': [48, 96, 192, 384],     # vs full: [96, 192, 384, 512]
    'enc_num_heads': [3, 6, 12, 24],
    'enc_depths': [2, 2, 4, 2],              # vs full: [2, 2, 6, 2]
    'patch_size': 1024,                       # points per patch
    'grid_sizes': [0.1, 0.2, 0.4, 0.8],     # multi-scale
    'serialize_order': 'hilbert',
}
# Estimated: ~10-15 FPS on Orin FP16 — needs DLA offloading for real-time
```

### 5.3 Decision Matrix

| Method | mIoU (est.) | FPS on Orin (FP16) | TensorRT Ready | Effort |
|--------|-------------|-------------------|----------------|--------|
| SalsaNext | 60% | 25-30 | Yes (trivial) | Low |
| Cylinder3D + TorchSparse | 72% | 12-18 | Moderate (sparse conv) | Medium |
| FlatFormer | 70% | 25-35 (INT8) | Yes (standard attention) | Medium |
| PTv3-Lite | 76% | 10-15 | Hard (custom ops) | High |

**Recommendation for Aurrigo**: Start with **FlatFormer** — best balance of accuracy, speed, and TensorRT compatibility. Fall back to SalsaNext if compute budget is too tight.

---

## 6. Panoptic Segmentation

### 6.1 Why Panoptic Matters for Airside

Semantic segmentation tells you "there are person-points here." Panoptic tells you "there are 4 distinct people, and here are their individual point sets." This enables:

- **Counting**: "3 crew members in the safety zone" — triggers alert if >2
- **Tracking initialization**: Each instance gets a unique ID for downstream MOT
- **Interaction modeling**: "This tractor (instance #7) is approaching aircraft (instance #2)"

### 6.2 SOTA Panoptic Methods

| Method | SemanticKITTI PQ | nuScenes PQ | Approach | Year |
|--------|-----------------|-------------|----------|------|
| EfficientLPS | **57.4** | — | Shared encoder, dual decoders | 2021 |
| Panoptic-PolarNet | 54.1 | — | Polar BEV + range view | 2021 |
| DQFormer | — | **59.2** | Dynamic query transformer | 2025 |
| ALPINE | **64.2** | — | Training-free clustering on semantic output | 2025 |
| Eq-4D-StOP | 67.8 LSTQ | — | 4D panoptic (temporal) | 2024 |

### 6.3 ALPINE: Training-Free Panoptic from Semantic

ALPINE (2025) demonstrates that **panoptic segmentation can be achieved without training a panoptic head** — apply per-class connected components in BEV with tuned thresholds:

```python
def alpine_panoptic(semantic_labels, points_xyz, class_thresholds):
    """
    Training-free panoptic segmentation via BEV clustering.
    
    Args:
        semantic_labels: (N,) per-point class predictions
        points_xyz: (N, 3) point coordinates
        class_thresholds: dict mapping class_id -> BEV clustering distance
    
    Returns:
        panoptic_labels: (N,) combined semantic + instance labels
    """
    panoptic = np.zeros(len(points_xyz), dtype=np.int64)
    instance_counter = 0
    
    THING_CLASSES = [1, 2, 3, 4, 5, 6, 7, 8]  # vehicle, person, etc.
    
    for cls_id in THING_CLASSES:
        mask = semantic_labels == cls_id
        if mask.sum() == 0:
            continue
        
        # Project to BEV
        bev_points = points_xyz[mask, :2]  # x, y only
        
        # Connected components with class-specific threshold
        threshold = class_thresholds.get(cls_id, 1.0)
        from sklearn.cluster import DBSCAN
        clustering = DBSCAN(eps=threshold, min_samples=5).fit(bev_points)
        
        for label in set(clustering.labels_):
            if label == -1:
                continue
            instance_counter += 1
            instance_mask = clustering.labels_ == label
            # Encode: class_id * 1000 + instance_id
            panoptic[np.where(mask)[0][instance_mask]] = cls_id * 1000 + instance_counter
    
    # Stuff classes get class label only
    STUFF_CLASSES = [0, 9, 10, 11]  # ground, building, vegetation, road
    for cls_id in STUFF_CLASSES:
        mask = semantic_labels == cls_id
        panoptic[mask] = cls_id * 1000  # instance_id = 0 for stuff
    
    return panoptic

# Airside class thresholds (BEV clustering distance in meters)
AIRSIDE_THRESHOLDS = {
    1: 3.0,    # aircraft — large, 3m BEV gap between instances
    2: 2.0,    # GSE vehicles — medium objects
    3: 1.0,    # cargo containers — smaller
    4: 0.8,    # personnel — close together during operations
    5: 2.5,    # pushback tractor
    6: 1.5,    # belt loader
    7: 1.5,    # cargo loader
    8: 0.5,    # FOD — very small, tight clustering
}
```

**Key advantage**: Works on top of ANY semantic segmentation model. No additional training needed. Achieves PQ=64.2 on SemanticKITTI, competitive with trained panoptic heads.

---

## 7. Training-Free Instance Segmentation

### 7.1 Why Training-Free Matters for Airside

There are **no public airside LiDAR datasets with instance labels**. Annotating panoptic labels is 5-10x more expensive than semantic labels. Training-free methods bridge the gap:

1. Train semantic segmentation (or fine-tune a pre-trained model)
2. Apply DBSCAN/HDBSCAN/connected components for instance grouping
3. No additional instance-specific training required

### 7.2 HDBSCAN for Airside Instance Segmentation

HDBSCAN improves over DBSCAN by automatically adapting clustering density:

```python
import hdbscan

def airside_instance_segmentation(points_xyz, semantic_labels, min_cluster_sizes):
    """
    HDBSCAN-based instance segmentation with class-specific parameters.
    
    Key advantage over DBSCAN: no epsilon parameter to tune — 
    automatically finds clusters of varying density.
    """
    instances = {}
    
    for cls_id, min_size in min_cluster_sizes.items():
        mask = semantic_labels == cls_id
        if mask.sum() < min_size:
            continue
        
        cls_points = points_xyz[mask]
        
        clusterer = hdbscan.HDBSCAN(
            min_cluster_size=min_size,
            min_samples=max(3, min_size // 5),
            metric='euclidean',
            cluster_selection_method='eom',  # excess of mass — better for varying sizes
            allow_single_cluster=False,
        )
        
        labels = clusterer.fit_predict(cls_points)
        instances[cls_id] = (mask, labels, clusterer.probabilities_)
    
    return instances

# Airside min cluster sizes (minimum points per instance)
AIRSIDE_MIN_CLUSTER = {
    1: 200,    # aircraft — large, many points
    2: 50,     # GSE vehicles
    3: 30,     # cargo containers
    4: 10,     # personnel — may have few returns at distance
    5: 40,     # pushback tractor
    6: 30,     # belt loader
    7: 40,     # cargo loader
    8: 5,      # FOD — very few points
}
```

### 7.3 Temporal Accumulation for Small Objects

For FOD and distant personnel, single-scan point density may be insufficient. Accumulate 3-5 scans with ego-motion compensation:

```python
def temporal_accumulate(scan_buffer, ego_poses, num_scans=5):
    """
    Accumulate multiple LiDAR scans into a single dense cloud.
    Compensates for ego-motion using GTSAM-estimated poses.
    """
    accumulated = []
    latest_pose = ego_poses[-1]
    
    for i in range(-num_scans + 1, 1):
        idx = len(scan_buffer) + i
        if idx < 0:
            continue
        
        scan = scan_buffer[idx]
        pose = ego_poses[idx]
        
        # Transform to latest frame
        relative = np.linalg.inv(latest_pose) @ pose
        transformed = (relative[:3, :3] @ scan[:, :3].T + relative[:3, 3:4]).T
        
        # Preserve intensity
        accumulated.append(np.hstack([transformed, scan[:, 3:4]]))
    
    return np.vstack(accumulated)
```

---

## 8. Airside-Specific Class Taxonomy

### 8.1 Proposed 18-Class Airside Taxonomy

Based on airside operational requirements and safety criticality:

| ID | Class | Category | Safety Level | Min Points @50m |
|----|-------|----------|-------------|-----------------|
| 0 | Ground (concrete) | Stuff | Low | N/A |
| 1 | Ground (markings) | Stuff | Medium | N/A |
| 2 | Vegetation | Stuff | Low | N/A |
| 3 | Building/terminal | Stuff | Low | N/A |
| 4 | Fence/barrier | Stuff | Medium | N/A |
| 5 | Aircraft fuselage | Thing | **Critical** | 500+ |
| 6 | Aircraft wing | Thing | **Critical** | 200+ |
| 7 | Aircraft engine | Thing | **Critical** | 100+ |
| 8 | Aircraft tail | Thing | High | 50+ |
| 9 | Pushback tractor | Thing | High | 80+ |
| 10 | Belt loader | Thing | High | 50+ |
| 11 | Cargo loader | Thing | High | 60+ |
| 12 | Fuel truck | Thing | **Critical** | 100+ |
| 13 | Other GSE | Thing | Medium | 30+ |
| 14 | Cargo container/ULD | Thing | Medium | 40+ |
| 15 | Personnel (standing) | Thing | **Critical** | 10+ |
| 16 | Personnel (crouching) | Thing | **Critical** | 5+ |
| 17 | FOD | Thing | High | 3+ |

### 8.2 Class Grouping Strategy

For initial deployment, reduce to **8 super-classes** to improve accuracy:

```
Super-classes:
  0: Ground          → {0, 1}
  1: Structure        → {2, 3, 4}
  2: Aircraft         → {5, 6, 7, 8}
  3: Heavy GSE        → {9, 10, 11, 12}
  4: Light GSE/cargo  → {13, 14}
  5: Personnel        → {15, 16}
  6: FOD              → {17}
  7: Unknown/other    → everything else
```

Then progressively expand as data accumulates. The **ALPINE approach** can provide instance IDs within each super-class without additional training.

### 8.3 Safety-Weighted Loss Function

Not all classes are equally important for safety. Weight the cross-entropy loss:

```python
# Safety-weighted class weights for cross-entropy loss
AIRSIDE_CLASS_WEIGHTS = torch.tensor([
    0.1,   # 0: ground (concrete)
    0.3,   # 1: ground (markings) — matters for localization
    0.1,   # 2: vegetation
    0.1,   # 3: building
    0.3,   # 4: fence/barrier
    2.0,   # 5: aircraft fuselage — CRITICAL
    2.0,   # 6: aircraft wing — CRITICAL
    3.0,   # 7: aircraft engine — CRITICAL (jet blast)
    1.0,   # 8: aircraft tail
    1.5,   # 9: pushback tractor
    1.0,   # 10: belt loader
    1.0,   # 11: cargo loader
    2.0,   # 12: fuel truck — CRITICAL (fire risk)
    0.5,   # 13: other GSE
    0.5,   # 14: cargo container
    5.0,   # 15: personnel standing — HIGHEST PRIORITY
    5.0,   # 16: personnel crouching — HIGHEST PRIORITY
    3.0,   # 17: FOD
], dtype=torch.float32)

loss_fn = torch.nn.CrossEntropyLoss(weight=AIRSIDE_CLASS_WEIGHTS)
```

---

## 9. LiDAR Foundation Model Fine-Tuning Path

### 9.1 Pre-Training → Fine-Tuning Strategy

Since no public airside datasets exist, leverage road-driving pre-trained models and fine-tune:

```
Step 1: Start with PTv3 + Sonata pre-trained weights (11 datasets, 82.7% mIoU road)
Step 2: Map road classes → airside super-classes
            car → Heavy GSE
            pedestrian → Personnel  
            bicycle → Light GSE (geometry somewhat similar)
            truck → Heavy GSE
            vegetation → Vegetation
            building → Building
            road → Ground
Step 3: Fine-tune with PointLoRA (CVPR 2025) on 500-2000 labeled airside scans
Step 4: Evaluate on held-out airside test set
Step 5: Expand to full 18-class taxonomy with more data
```

### 9.2 PointLoRA Fine-Tuning

PointLoRA adapts foundation models with minimal parameter overhead:

```python
# PointLoRA configuration for airside fine-tuning
POINTLORA_CONFIG = {
    'backbone': 'ptv3_sonata',
    'lora_rank': 16,                    # lower rank for small dataset
    'lora_alpha': 32,
    'target_modules': ['qkv', 'fc1', 'fc2'],  # attention + FFN
    'num_classes': 8,                    # start with super-classes
    'freeze_backbone': True,             # only train LoRA adapters
    'trainable_params': '~2% of total',  # vs 100% for full fine-tune
}

# Training data requirements with PointLoRA:
# - 500 scans: ~55% mIoU (rough but functional)
# - 1000 scans: ~65% mIoU (usable for shadow mode)
# - 2000 scans: ~72% mIoU (production-ready with safety filtering)
# - 5000 scans: ~76% mIoU (approaching full fine-tune accuracy)

# Compare: full fine-tuning needs 10,000+ scans for same accuracy
```

### 9.3 ScaLR Self-Supervised Pre-Training

If collecting labeled data is too slow, use ScaLR (self-supervised) to create a better starting point:

```
Step 1: Collect 10,000+ unlabeled airside LiDAR scans (easy — just drive around)
Step 2: Run ScaLR self-supervised pre-training (DINOv2 distillation to point cloud)
Step 3: Resulting features are 5-15% better than ImageNet pre-training
Step 4: Fine-tune on 500-1000 labeled scans
```

**ScaLR achieves 67.8% mIoU with NO labels** on nuScenes via linear probing — strong evidence that self-supervised features transfer well.

---

## 10. Integration with Aurrigo ROS Stack

### 10.1 ROS Node Architecture

```
                     ┌──────────────────┐
                     │  pointcloud_agg  │ (existing Aurrigo node)
                     │  4-8 LiDAR merge │
                     └────────┬─────────┘
                              │ /aurrigo/lidar/aggregated (sensor_msgs/PointCloud2)
                              ▼
                     ┌──────────────────┐
                     │  semantic_seg    │ (NEW nodelet)
                     │  FlatFormer/Cyl3D│
                     │  TensorRT engine │
                     └────────┬─────────┘
                              │ /perception/segmentation (custom msg)
                              ▼
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
    ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
    │  instance   │  │  ground_seg  │  │  safety_zone │
    │  clustering │  │  (replaces   │  │  monitor     │
    │  (ALPINE)   │  │   RANSAC)    │  │  (personnel) │
    └─────────────┘  └──────────────┘  └──────────────┘
```

### 10.2 Custom ROS Message Types

```protobuf
# msg/SemanticPointCloud.msg
std_msgs/Header header
sensor_msgs/PointCloud2 cloud           # original point cloud
uint8[] semantic_labels                  # per-point class ID (0-17)
float32[] confidences                    # per-point confidence [0,1]
uint32[] instance_ids                    # per-point instance ID (0 = stuff)

# msg/SegmentationInfo.msg
std_msgs/Header header
uint32 num_points                        # total points processed
uint32 num_instances                     # total instances detected
float32 inference_time_ms                # model inference time
float32 mean_confidence                  # average prediction confidence
perception_msgs/InstanceInfo[] instances # per-instance metadata

# msg/InstanceInfo.msg
uint32 instance_id
uint8 class_id
string class_name
uint32 num_points
geometry_msgs/Point centroid
geometry_msgs/Vector3 bbox_size          # 3D bounding box dimensions
float32 mean_confidence
bool is_moving                           # from MOS or velocity estimation
```

### 10.3 Nodelet Implementation Skeleton

```cpp
#include <nodelet/nodelet.h>
#include <sensor_msgs/PointCloud2.h>
#include <NvInfer.h>  // TensorRT

class SemanticSegNodelet : public nodelet::Nodelet {
public:
    void onInit() override {
        ros::NodeHandle& nh = getPrivateNodeHandle();
        
        // Load TensorRT engine
        std::string engine_path;
        nh.param<std::string>("engine_path", engine_path, 
                              "/opt/aurrigo/models/flatformer_int8.engine");
        loadEngine(engine_path);
        
        // Parameters
        nh.param<int>("max_points", max_points_, 150000);
        nh.param<double>("confidence_threshold", conf_threshold_, 0.5);
        nh.param<bool>("enable_panoptic", enable_panoptic_, true);
        
        // Publishers and subscribers
        sub_ = nh.subscribe("/aurrigo/lidar/aggregated", 1,
                            &SemanticSegNodelet::callback, this);
        pub_seg_ = nh.advertise<perception_msgs::SemanticPointCloud>(
                   "/perception/segmentation", 1);
        pub_info_ = nh.advertise<perception_msgs::SegmentationInfo>(
                    "/perception/segmentation_info", 1);
    }
    
private:
    void callback(const sensor_msgs::PointCloud2::ConstPtr& msg) {
        auto start = ros::Time::now();
        
        // 1. Extract points from PointCloud2
        // 2. Voxelize / prepare input tensor
        // 3. Run TensorRT inference
        // 4. Post-process: argmax per point
        // 5. Optional: ALPINE panoptic clustering
        // 6. Publish results
        
        auto elapsed = (ros::Time::now() - start).toSec() * 1000.0;
        ROS_DEBUG_THROTTLE(5.0, "Segmentation: %.1fms, %d points, %d instances",
                          elapsed, num_points, num_instances);
    }
    
    nvinfer1::ICudaEngine* engine_;
    nvinfer1::IExecutionContext* context_;
    int max_points_;
    double conf_threshold_;
    bool enable_panoptic_;
    ros::Subscriber sub_;
    ros::Publisher pub_seg_, pub_info_;
};

PLUGINLIB_EXPORT_CLASS(SemanticSegNodelet, nodelet::Nodelet)
```

---

## 11. Deployment on NVIDIA Orin

### 11.1 TensorRT Conversion Pipeline

```bash
#!/bin/bash
# Convert FlatFormer PyTorch → ONNX → TensorRT

# Step 1: Export to ONNX (on training machine with GPU)
python export_flatformer.py \
    --weights flatformer_airside_v1.pth \
    --num_classes 8 \
    --max_points 150000 \
    --output flatformer_airside.onnx

# Step 2: Convert to TensorRT engine (on Orin target)
/usr/src/tensorrt/bin/trtexec \
    --onnx=flatformer_airside.onnx \
    --saveEngine=flatformer_airside_fp16.engine \
    --fp16 \
    --workspace=4096 \
    --minShapes=points:1x50000x4 \
    --optShapes=points:1x100000x4 \
    --maxShapes=points:1x150000x4

# Step 3: INT8 calibration (with 100 representative scans)
/usr/src/tensorrt/bin/trtexec \
    --onnx=flatformer_airside.onnx \
    --saveEngine=flatformer_airside_int8.engine \
    --int8 \
    --calib=calibration_cache.bin \
    --workspace=4096
```

### 11.2 Memory Layout on Orin

```
Orin AGX 64GB Unified Memory Allocation:
├── System + ROS:          8 GB
├── LiDAR preprocessing:   2 GB (point aggregation, GTSAM)
├── Segmentation model:    1-2 GB (FlatFormer INT8 engine)
├── Segmentation I/O:      1 GB (input/output buffers)
├── Detection model:       1-2 GB (CenterPoint or similar)
├── Tracking:              0.5 GB (Kalman filters, association)
├── Occupancy grid:        1-2 GB (nvblox TSDF)
├── Planning:              1 GB (Frenet planner state)
├── Visualization:         1 GB (RViz, debug streams)
└── Headroom:              ~45 GB free
    (ample for model upgrades and concurrent development)
```

### 11.3 DLA Offloading Strategy

Orin has 2 Deep Learning Accelerators (DLAs) that can run simpler layers independently:

```
GPU: Complex layers (attention, sparse conv, custom ops)
DLA 0: Segmentation post-processing network (lightweight CNN for refinement)
DLA 1: Moving object segmentation (simple binary classifier)
```

DLA is 2-3x more power-efficient than GPU for supported layers but has limited op coverage.

---

## 12. Migration from RANSAC

### 12.1 Phased Migration Plan

```
Phase 0 (Current): RANSAC only
  - 3 classes: ground, obstacle, edge
  - ~2ms processing
  - No ML dependency

Phase 1 (Shadow Mode): Run neural segmentation IN PARALLEL with RANSAC
  - RANSAC remains authoritative for planning
  - Neural segmentation publishes to /perception/segmentation_shadow
  - Log disagreements: when neural says "person" but RANSAC says "obstacle"
  - Duration: 2-4 weeks of data collection
  - Goal: Validate accuracy, measure latency, collect failure cases

Phase 2 (Hybrid): Neural segmentation for classification, RANSAC for safety fallback
  - Use neural output for PLANNING decisions (which obstacle to avoid vs yield to)
  - Keep RANSAC for SAFETY decisions (emergency stop if any obstacle detected)
  - Simplex architecture: neural = AC (advanced controller), RANSAC = BC (baseline)
  - Duration: 1-3 months

Phase 3 (Neural Primary): Neural segmentation is authoritative
  - RANSAC runs as sanity check only
  - Full 18-class taxonomy active
  - Panoptic clustering for tracking initialization
  - RANSAC only triggers on: model confidence < threshold, inference timeout, GPU error

Phase 4 (Full Panoptic): Instance-level scene understanding
  - Panoptic segmentation with temporal tracking
  - Interaction modeling between instances
  - Fed into learned or game-theoretic planner
```

### 12.2 Validation Metrics for Each Phase

| Phase | Gate Metric | Threshold | How to Measure |
|-------|-----------|-----------|----------------|
| 1→2 | Neural-RANSAC agreement | >95% on safety-critical objects | Log comparison over 10,000 frames |
| 1→2 | Person detection recall | >99% within 30m | Manual review of disagreement logs |
| 2→3 | Neural false negative rate | <0.1% for persons within 20m | Annotated test set + shadow mode |
| 2→3 | Inference latency P99 | <30ms on Orin | Timing logs over 100,000 frames |
| 3→4 | Instance segmentation accuracy | >80% HOTA for GSE | Manual annotation of 500 frames |

---

## 13. Benchmarks and Evaluation

### 13.1 Standard Benchmarks

| Benchmark | Points/scan | Classes | Scans | Focus |
|-----------|------------|---------|-------|-------|
| SemanticKITTI | ~120K | 19 | 43,552 | Semantic + panoptic + MOS |
| nuScenes-lidarseg | ~35K | 16 | 40,000 | Semantic, sparse LiDAR |
| Waymo Open | ~180K | 23 | 230,000 | Large-scale, high quality |
| ScribbleKITTI | ~120K | 19 | 43,552 | Weak supervision (scribble labels) |
| RELLIS-3D | ~100K | 20 | 13,556 | Off-road (closest to airside terrain) |

### 13.2 Why Existing Benchmarks Are Insufficient for Airside

| Gap | SemanticKITTI | nuScenes | Airside Need |
|-----|---------------|----------|-------------|
| Aircraft class | No | No | Yes (fuselage, wing, engine, tail) |
| GSE types | No | No | Yes (5+ types) |
| FOD | No | No | Yes (sub-10cm objects) |
| Open apron geometry | No | No | Yes (200m+ visibility) |
| Height range | 0-5m | 0-5m | 0-20m (aircraft tail) |
| Personnel density | Dense pedestrians | Moderate | Sparse, scattered |
| Surface type | Asphalt road | Urban road | Concrete apron + markings |

### 13.3 Creating an Airside Benchmark

**Minimum viable benchmark**:
- 1,000 annotated scans from 3+ airports
- 8 super-classes (§8.2)
- 100 scans with full panoptic labels
- Publish as "AirsideKITTI" or "ApronSeg" — **first public airside LiDAR segmentation dataset**

**Annotation cost estimate**:
- Semantic labels: ~15 min/scan × 1,000 scans = 250 hours × $30/hr = **$7,500**
- Panoptic labels: ~45 min/scan × 100 scans = 75 hours × $30/hr = **$2,250**
- Total: **~$10,000** for foundational benchmark

Using SALT (Semi-Automatic Labeling Tool, 2025) with cross-scene adaptability could reduce this by 60-70%.

---

## 14. Recommended Architecture

### 14.1 Recommended Stack for Aurrigo

```
┌─────────────────────────────────────────────────┐
│            RECOMMENDED SEGMENTATION STACK         │
├─────────────────────────────────────────────────┤
│                                                   │
│  Pre-training:  ScaLR self-supervised on          │
│                 10K unlabeled airside scans        │
│                        ↓                          │
│  Backbone:      FlatFormer (CVPR 2023)            │
│                 INT8 TensorRT on Orin             │
│                 ~25-35 FPS, ~70% mIoU             │
│                        ↓                          │
│  Fine-tuning:   PointLoRA (rank 16) on            │
│                 500-2000 labeled airside scans     │
│                        ↓                          │
│  Semantic head: 8 super-classes initially          │
│                 → expand to 18 with more data      │
│                        ↓                          │
│  Panoptic:      ALPINE clustering (training-free)  │
│                 Class-specific DBSCAN in BEV       │
│                        ↓                          │
│  Safety:        RANSAC parallel fallback           │
│                 Simplex: neural AC + RANSAC BC     │
│                                                   │
│  Total latency: 20-35ms on Orin AGX (INT8)        │
│  Memory: ~2GB engine + 1GB I/O                    │
│  Training data: 500 labeled + 10K unlabeled scans │
│  Est. cost: $15-25K (data + annotation + dev)     │
└─────────────────────────────────────────────────┘
```

### 14.2 Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Data collection (unlabeled) | 2-4 weeks | 10,000+ scans from 2+ airports |
| ScaLR pre-training | 1 week (GPU cluster) | Self-supervised backbone |
| Annotation (500 scans) | 2 weeks | Labeled training set |
| FlatFormer fine-tuning | 1 week | Trained model |
| TensorRT conversion + Orin testing | 1 week | Deployed engine |
| Shadow mode validation | 4 weeks | Accuracy/latency metrics |
| Hybrid deployment | 4-8 weeks | Neural + RANSAC Simplex |
| **Total** | **~4-5 months** | Production segmentation |

### 14.3 Cost Estimate

| Item | Cost |
|------|------|
| Annotation (500 semantic + 100 panoptic) | $7,500 |
| GPU compute (pre-training + fine-tuning) | $2,000-3,000 |
| Engineering (integration, testing) | $10,000-15,000 |
| **Total** | **$20,000-25,000** |

---

## 15. References

### Core Methods
- **PTv3**: Wu et al., "Point Transformer V3: Simpler, Faster, Stronger" (CVPR 2024) — [arxiv.org/abs/2312.10035](https://arxiv.org/abs/2312.10035)
- **Cylinder3D**: Zhu et al., "Cylindrical and Asymmetrical 3D Convolution Networks for LiDAR Segmentation" (CVPR 2021 Oral)
- **FlatFormer**: Liu et al., "FlatFormer: Flattened Window Attention for Efficient Point Cloud Transformer" (CVPR 2023) — [github.com/mit-han-lab/flatformer](https://github.com/mit-han-lab/flatformer)
- **SalsaNext**: Cortinhal et al., "SalsaNext: Fast, Uncertainty-Aware Semantic Segmentation of LiDAR Point Clouds" (ISVC 2020)
- **MinkUNet**: Choy et al., "4D Spatio-Temporal ConvNets: Minkowski Convolutional Neural Networks" (CVPR 2019)
- **SPVCNN**: Tang et al., "Searching Efficient 3D Architectures with Sparse Point-Voxel Convolution" (ECCV 2020)
- **WaffleIron**: Puy et al., "Using a Waffle Iron for Automotive Point Cloud Semantic Segmentation" (ICCV 2023)

### Panoptic & Instance Segmentation
- **ALPINE**: "Clustering is back: Reaching state-of-the-art LiDAR instance segmentation without training" (2025) — [arxiv.org/abs/2503.13203](https://arxiv.org/abs/2503.13203)
- **EfficientLPS**: Sirohi et al., "Efficient LiDAR Panoptic Segmentation" (2021)
- **DQFormer**: Yang et al., "DQFormer: Toward Unified LiDAR Panoptic Segmentation" (2025)
- **Eq-4D-StOP**: 4D panoptic segmentation with equivariant features (2024)

### Foundation Models & Fine-Tuning
- **Sonata/Concerto**: Pre-trained 3D backbones on 11 datasets (2024)
- **ScaLR**: Puy et al., "Three Pillars improving Vision Foundation Model Distillation for Lidar" (CVPR 2024)
- **PointLoRA**: Parameter-efficient fine-tuning for point clouds (CVPR 2025)
- **GD-MAE**: Yang et al., "GD-MAE: Generative Decoder for MAE Pre-training on LiDAR Point Clouds" (CVPR 2024)

### Real-Time & Edge Deployment
- "Are We Ready for Real-Time LiDAR Semantic Segmentation in Autonomous Driving?" (2024) — [arxiv.org/abs/2410.08365](https://arxiv.org/abs/2410.08365)
- "An Experimental Study of SOTA LiDAR Segmentation Models" (2025) — [arxiv.org/abs/2502.12860](https://arxiv.org/abs/2502.12860)
- **SALT**: "A Flexible Semi-Automatic Labeling Tool for General LiDAR Point Clouds" (2025)

### Benchmarks
- **SemanticKITTI**: Behley et al., "SemanticKITTI: A Dataset for Semantic Scene Understanding of LiDAR Sequences" (ICCV 2019)
- **nuScenes-lidarseg**: Caesar et al., "nuScenes: A multimodal dataset for autonomous driving" (CVPR 2020)
- **RELLIS-3D**: Jiang et al., "RELLIS-3D Dataset: Data, Benchmarks and Analysis for Off-Road Robotics" (RA-L 2021)
- **STU**: "Spotting the Unexpected: A 3D LiDAR Dataset for Anomaly Segmentation in Autonomous Driving" (CVPR 2025)
