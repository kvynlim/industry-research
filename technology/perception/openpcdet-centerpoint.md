# OpenPCDet & CenterPoint: Complete Guide for 3D LiDAR Detection

## Table of Contents
1. [OpenPCDet Setup](#1-openpcdet-setup)
2. [CenterPoint Deep Dive](#2-centerpoint-deep-dive)
3. [Training on Custom Data](#3-training-on-custom-data)
4. [RoboSense LiDAR Handling](#4-robosense-lidar-handling)
5. [Auto-Labeling Pipeline](#5-auto-labeling-pipeline)
6. [TensorRT Deployment](#6-tensorrt-deployment)
7. [PointPillars as Lightweight Alternative](#7-pointpillars-as-lightweight-alternative)

---

## 1. OpenPCDet Setup

### 1.1 What OpenPCDet Is

OpenPCDet is the canonical open-source PyTorch codebase for LiDAR-based 3D object detection, maintained under the open-mmlab umbrella. It provides a unified, modular framework where datasets convert to a shared box format and models are dataset-agnostic. The library covers one-stage detectors (PointPillars, SECOND, CenterPoint, VoxelNeXt, DSVT), two-stage detectors (PointRCNN, Part-A2, PV-RCNN, PV-RCNN++, Voxel R-CNN), and multi-modal models (TransFusion-Lidar, BEVFusion). It natively supports KITTI, nuScenes, Waymo Open, ONCE, Argoverse2, Lyft, and Pandaset datasets.

### 1.2 Repository Structure

```
OpenPCDet/
├── data/                          # Dataset storage (KITTI, nuScenes, Waymo, custom)
│   └── custom/
│       ├── ImageSets/             # train.txt, val.txt (sample indices)
│       ├── points/                # 000000.npy ... (point clouds)
│       └── labels/                # 000000.txt ... (3D box annotations)
├── docker/                        # Docker environment configs
├── docs/                          # INSTALL.md, GETTING_STARTED.md, DEMO.md,
│                                  # CUSTOM_DATASET_TUTORIAL.md
├── pcdet/                         # Core library
│   ├── datasets/                  # Dataset implementations + augmentation
│   │   ├── processor/             # data_processor.py (voxelization, masking)
│   │   ├── augmentor/             # data_augmentor.py (GT-sampling, flips, etc.)
│   │   ├── kitti/
│   │   ├── nuscenes/
│   │   ├── waymo/
│   │   └── custom/                # custom_dataset.py for user data
│   ├── models/                    # Detection model architectures
│   │   ├── backbones_3d/          # VoxelBackBone8x, VoxelResBackBone8x, etc.
│   │   ├── backbones_2d/          # BaseBEVBackbone
│   │   ├── dense_heads/           # AnchorHeadSingle, CenterHead, etc.
│   │   ├── roi_heads/             # Second-stage refinement heads
│   │   └── detectors/             # Detector3DTemplate, CenterPoint, PV-RCNN, etc.
│   ├── ops/                       # CUDA ops (roiaware_pool3d, iou3d_nms, etc.)
│   └── utils/                     # Loss utils, box utils, common utils
└── tools/
    ├── cfgs/
    │   ├── dataset_configs/       # nuscenes_dataset.yaml, kitti_dataset.yaml
    │   ├── kitti_models/          # Per-model YAML configs for KITTI
    │   ├── nuscenes_models/       # cbgs_voxel0075_res3d_centerpoint.yaml, etc.
    │   └── waymo_models/
    ├── scripts/                   # dist_train.sh, dist_test.sh, slurm_train.sh
    ├── train.py
    ├── test.py
    └── demo.py                    # Single-file inference + visualization
```

### 1.3 Dependencies and Version Matrix

| Component | Tested Versions | Notes |
|-----------|----------------|-------|
| OS | Ubuntu 14.04 - 21.04 | Linux only |
| Python | 3.6+ | 3.8 recommended for modern setups |
| PyTorch | 1.1 - 1.10+ (2.0+ with spconv v2.x) | PyTorch 1.10+CUDA 11.3 is a well-tested combo |
| CUDA | 9.0+ (9.2+ for PyTorch 1.3+) | CUDA 11.3 has most stable prebuilt spconv wheels |
| spconv | v1.0, v1.2, v2.x | v2.x installable via pip; v1.x requires source build |
| cumm | Required by spconv v2.x | Installed automatically with pip |
| SharedArray | For Waymo dataset | `pip install SharedArray` |
| Open3D or Mayavi | For visualization | Open3D is faster |

### 1.4 Installation Steps

```bash
# 1. Create environment
conda create -n openpcdet python=3.8 -y
conda activate openpcdet

# 2. Install PyTorch (match your CUDA)
# For CUDA 11.3:
pip install torch==1.10.1+cu113 torchvision==0.11.2+cu113 \
    -f https://download.pytorch.org/whl/cu113/torch_stable.html
# For CUDA 11.8 (newer):
pip install torch==2.0.1+cu118 torchvision==0.15.2+cu118 \
    --index-url https://download.pytorch.org/whl/cu118

# 3. Install spconv
# spconv v2.x (recommended, simple pip install):
pip install spconv-cu113   # match your CUDA version
# or: pip install spconv-cu118

# 4. Clone and install OpenPCDet
git clone https://github.com/open-mmlab/OpenPCDet.git
cd OpenPCDet
pip install -r requirements.txt
python setup.py develop

# 5. Verify
python -c "import pcdet; print(pcdet.__version__)"
```

**Critical notes:**
- Always re-run `python setup.py develop` after pulling updates -- this recompiles the CUDA ops.
- spconv v2.x is the path of least resistance. Avoid building spconv v1.x from source unless you need PyTorch <= 1.3.
- Docker users: NVIDIA provides official spconv Docker images. The `docker/` directory in the repo has Dockerfiles.

### 1.5 Supported Models with Benchmark Performance

**KITTI Benchmarks (moderate difficulty, Car AP @ IoU 0.7):**

| Model | Car 3D AP | Type |
|-------|----------|------|
| PointPillars | 77.28% | One-stage |
| SECOND | 78.62% | One-stage |
| PV-RCNN | 83.61% | Two-stage |
| Voxel R-CNN | 84.54% | Two-stage |
| Focals Conv | 85.66% | Two-stage |

**nuScenes Benchmarks (val set):**

| Model | mAP | NDS |
|-------|-----|-----|
| CenterPoint-Pillar | ~45% | ~56% |
| CenterPoint-Voxel (0.075) | ~56% | ~65% |
| TransFusion-Lidar | ~65% | ~69.43% |
| BEVFusion | ~67% | ~70.98% |

**Waymo Benchmarks (20% training, ALL difficulty):**

| Model | Vec mAPH L2 | Ped mAPH L2 |
|-------|------------|------------|
| CenterPoint | 66.20 | 62.64 |
| PV-RCNN++ | 77.82 | 73.21 |
| DSVT-Voxel | 79.77 | 76.34 |

---

## 2. CenterPoint Deep Dive

### 2.1 Core Idea

CenterPoint represents objects as their center points rather than anchor boxes. Inspired by 2D CenterNet, it predicts a heatmap of object centers in bird's-eye view, then regresses per-center attributes (3D size, orientation, velocity). This anchor-free design is rotationally invariant -- eliminating the combinatorial explosion of angle-binned anchors that plagued earlier detectors like SECOND.

### 2.2 Architecture Pipeline

```
Raw Point Cloud
     │
     ▼
┌─────────────┐
│ Voxelization │  Discretize into 3D grid (or pillars)
└─────────────┘
     │
     ▼
┌──────────────────────┐
│ Voxel Feature Encoder │  MeanVFE or DynPillarVFE
│ (VFE)                 │  Aggregate per-voxel point features
└──────────────────────┘
     │
     ▼
┌──────────────────────────┐
│ 3D Sparse Conv Backbone   │  VoxelBackBone8x or VoxelResBackBone8x
│ (Submanifold + Regular    │  8x XY downsample, 16x Z downsample
│  sparse convolutions)     │  Output: sparse 3D feature volume
└──────────────────────────┘
     │
     ▼
┌────────────────────┐
│ Map-to-BEV          │  HeightCompression: collapse Z-axis
│ (Height Compression) │  → dense 2D BEV feature map (C=256)
└────────────────────┘
     │
     ▼
┌─────────────────────┐
│ 2D BEV Backbone      │  BaseBEVBackbone: multi-scale conv + FPN
│ (Neck)               │  Upsample and fuse features
└─────────────────────┘
     │
     ▼
┌──────────────────────┐
│ CenterHead            │  Per-class heatmap + regression heads
│ (Dense Detection Head)│  Predicts: center, center_z, dim, rot, vel
└──────────────────────┘
     │
     ▼
┌───────────────────────┐
│ (Optional) Stage 2     │  Bilinear feature sampling at face centers
│ Refinement             │  MLP → refined box + confidence
└───────────────────────┘
```

### 2.3 Stage-by-Stage Details

**Voxelization:**
- Voxel variant: Grid resolution e.g. [0.075, 0.075, 0.2] meters. Point cloud range [-54, -54, -5, 54, 54, 3].
- Pillar variant: Grid resolution [0.2, 0.2, 8.0] meters (full Z-height collapsed into one cell).
- Max points per voxel: 10 (voxel) or dynamically allocated (DynPillarVFE).
- Max voxels: 120,000 (train), 160,000 (test).

**VFE (Voxel Feature Encoder):**
- `MeanVFE`: Simple arithmetic mean of all point features within each voxel. Fast and sufficient for voxel backbones.
- `DynPillarVFE`: Dynamic pillar feature extractor with two FC layers (64 filters each), absolute XYZ encoding, and batch normalization. Used by the pillar variant.

**3D Sparse Conv Backbone:**
- `VoxelBackBone8x`: Standard backbone, 4 stages of sparse convolutions with increasing channel widths (16→32→64→128). Uses submanifold sparse convolutions (only activate at occupied voxels) within residual blocks and regular sparse convolutions for downsampling.
- `VoxelResBackBone8x`: ResNet-style with residual connections at each stage. Higher accuracy, slightly more compute.
- X/Y axes downsampled 8x; Z-axis downsampled 16x (collapsed to ~2-3 bins).

**Height Compression (Map-to-BEV):**
- Collapses the remaining Z dimension by concatenating features along the height axis.
- Output: dense 2D feature map, typically 256 channels.
- This is the sparse-to-dense conversion point -- all subsequent operations are standard dense 2D convolutions.

**2D BEV Backbone:**
- `BaseBEVBackbone` with configurable layer counts, strides, and channel widths.
- Voxel variant example: Layers [5,5], strides [1,2], filters [128,256], upsample strides [1,2], upsample filters [256,256].
- Pillar variant example: Layers [3,5,5], strides [2,2,2], filters [64,128,256], upsample strides [0.5,1,2], upsample filters [128,128,128].
- Multi-scale feature fusion via learned upsampling and concatenation.

**CenterHead (Detection Head):**

The CenterHead is the signature component. It groups the 10 nuScenes classes into 6 task heads to reduce inter-class interference:

```yaml
CLASS_NAMES_EACH_HEAD:
  - ['car']
  - ['truck', 'construction_vehicle']
  - ['bus', 'trailer']
  - ['barrier']
  - ['motorcycle', 'bicycle']
  - ['pedestrian', 'traffic_cone']
```

Each task head produces:
- **Heatmap** (C classes): Gaussian-rendered center probability, trained with focal loss.
- **center** (2 channels): Sub-voxel XY offset from quantized grid center.
- **center_z** (1 channel): Absolute Z height of object center.
- **dim** (3 channels): Object dimensions (length, width, height).
- **rot** (2 channels): Heading angle encoded as (sin, cos) pair.
- **vel** (2 channels): XY velocity components (for nuScenes; omitted for KITTI).

All regression heads use 2 conv layers with shared 64-channel convolution before branching.

**Target Assignment:**
- Feature map stride: 8 (voxel) or 4 (pillar) relative to BEV resolution.
- Each ground-truth box rendered as a Gaussian on the heatmap centered at its BEV projection.
- Gaussian radius determined by `GAUSSIAN_OVERLAP: 0.1` and `MIN_RADIUS: 2`.
- `NUM_MAX_OBJS: 500` caps objects per scene.

### 2.4 Pillar vs Voxel Variants

| Property | CenterPoint-Voxel | CenterPoint-Pillar |
|----------|-------------------|-------------------|
| Voxel Size | [0.075, 0.075, 0.2] m | [0.2, 0.2, 8.0] m |
| VFE | MeanVFE | DynPillarVFE (2x FC64) |
| 3D Backbone | VoxelResBackBone8x (sparse conv) | None (no 3D backbone) |
| Map-to-BEV | HeightCompression (256 ch) | PointPillarScatter (64 ch) |
| 2D Backbone Layers | [5,5] | [3,5,5] |
| Feature Map Stride | 8 | 4 |
| nuScenes NDS | ~65% | ~56% |
| Latency (V100) | ~60 ms | ~35 ms |
| Deployment | Needs spconv (complex) | Standard conv (easy TRT) |

**When to use which:**
- **Voxel** for maximum accuracy when compute budget allows and spconv deployment is feasible.
- **Pillar** for edge deployment, rapid prototyping, or when TensorRT/ONNX compatibility matters. The pillar variant avoids 3D sparse convolutions entirely.

### 2.5 Second Stage Refinement

CenterPoint's optional two-stage design:
1. From the Stage 1 predicted box, sample 5 points: the predicted 3D center + the 4 face centers (centers of the top/bottom/left/right box faces).
2. Extract features at each point via bilinear interpolation from the BEV feature map M.
3. Concatenate 5 feature vectors and pass through a small MLP.
4. Predict: class-agnostic confidence score + box refinement (delta corrections to the Stage 1 box).

This adds ~2-3 ms but improves mAP by ~1-2% on nuScenes. On Waymo it provides more significant gains.

### 2.6 Multi-Frame Tracking

CenterPoint's tracking is elegantly simple:

1. **Velocity estimation**: The detection head directly regresses 2D velocity (vx, vy) for each detection. On nuScenes, this leverages 10-sweep point cloud aggregation (1 keyframe + 9 non-keyframe sweeps = ~0.5s temporal window).

2. **Greedy closest-point matching**: At each timestep:
   - Predict tracking offset from velocity: `tracking_offset = velocity * (-1) * time_lag`
   - For each new detection, compute the predicted previous position.
   - Match to existing tracks using Euclidean distance with greedy assignment (no Hungarian algorithm needed).
   - Unmatched detections start new tracks; unmatched tracks persist for a configurable number of frames.

3. **Performance**: Achieves 63.8 AMOTA on nuScenes -- state-of-the-art at publication -- with essentially zero additional compute beyond the velocity head.

### 2.7 Loss Functions

```yaml
LOSS_WEIGHTS:
  cls_weight: 1.0           # Focal loss for heatmap
  loc_weight: 0.25           # L1 regression loss
  code_weights: [1.0, 1.0,   # center_x, center_y
                 1.0,         # center_z
                 1.0, 1.0, 1.0,  # dx, dy, dz
                 0.2, 0.2,    # rot (sin, cos) -- lower weight
                 1.0, 1.0]    # vel_x, vel_y
```

- **Classification**: Penalty-reduced focal loss on heatmap (alpha=2, beta=4).
- **Regression**: L1 loss on all regression targets, applied only at GT center locations.
- Rotation gets lower weight (0.2) because the sin/cos encoding already constrains the range.

### 2.8 Post-Processing

```yaml
POST_PROCESSING:
  SCORE_THRESH: 0.1
  POST_CENTER_LIMIT_RANGE: [-61.2, -61.2, -10.0, 61.2, 61.2, 10.0]
  MAX_OBJ_PER_SAMPLE: 500
  NMS_CONFIG:
    NMS_TYPE: nms_gpu
    NMS_THRESH: 0.2           # BEV IoU threshold
    NMS_PRE_MAXSIZE: 1000
    NMS_POST_MAXSIZE: 83      # ~500/6 heads
```

---

## 3. Training on Custom Data

### 3.1 Data Format Requirements

**Point Clouds (`.npy` files):**
- Shape: `(N, 4+)` where columns are `[x, y, z, intensity, ...]`.
- Coordinate system (OpenPCDet unified): **X = forward, Y = left, Z = up**.
- Intensity normalized to [0, 1]. If unavailable, set to zeros.
- Z-axis origin should be approximately 1.6m above the ground (matching KITTI convention for transfer learning).
- Can also use `.bin` files (flat float32 array, N*4 elements).

**Labels (`.txt` files):**
Each line describes one 3D bounding box:
```
# x    y    z    dx   dy   dz   heading   class_name
1.50  1.46  0.10  5.12  1.85  4.13  1.56  Vehicle
5.54  0.57  0.41  1.08  0.74  1.95  1.57  Pedestrian
```

- `(x, y, z)`: Center of the 3D box in the LiDAR coordinate frame.
- `(dx, dy, dz)`: Box dimensions (length along X, width along Y, height along Z).
- `heading`: Rotation angle around Z-axis in radians. Zero heading = aligned with X-axis.

**Image Sets (`train.txt`, `val.txt`):**
Plain text files listing sample indices (one per line, no extension):
```
000000
000001
000002
```

### 3.2 Directory Layout

```
OpenPCDet/data/custom/
├── ImageSets/
│   ├── train.txt
│   └── val.txt
├── points/
│   ├── 000000.npy
│   ├── 000001.npy
│   └── ...
└── labels/
    ├── 000000.txt
    ├── 000001.txt
    └── ...
```

### 3.3 Custom Dataset Configuration

Create `tools/cfgs/dataset_configs/custom_dataset.yaml`:

```yaml
DATASET: 'CustomDataset'
DATA_PATH: '../data/custom'

POINT_CLOUD_RANGE: [-70.0, -40.0, -3.0, 70.0, 40.0, 1.0]
# Adjust to your sensor range. Rules:
#   (max_z - min_z) / voxel_z = 40 (or multiple of 40 for voxel models)
#   (max_x - min_x) / voxel_x = multiple of 16
#   (max_y - min_y) / voxel_y = multiple of 16

CLASS_NAMES: ['Vehicle', 'Pedestrian', 'Cyclist']

MAP_CLASS_TO_KITTI:
  'Vehicle': 'Car'
  'Pedestrian': 'Pedestrian'
  'Cyclist': 'Cyclist'

POINT_FEATURE_ENCODING:
  encoding_type: absolute_coordinates_encoding
  used_feature_list: ['x', 'y', 'z', 'intensity']
  src_feature_list: ['x', 'y', 'z', 'intensity']

DATA_AUGMENTOR:
  DISABLE_AUG_LIST: ['placeholder']
  AUG_CONFIG_LIST:
    - NAME: gt_sampling
      USE_ROAD_PLANE: False
      DB_INFO_PATH:
        - custom_dbinfos_train.pkl
      PREPARE:
        filter_by_min_points: ['Vehicle:5', 'Pedestrian:5', 'Cyclist:5']
        filter_by_difficulty: [-1]
      SAMPLE_GROUPS: ['Vehicle:20', 'Pedestrian:15', 'Cyclist:15']
      NUM_POINT_FEATURES: 4
      DATABASE_WITH_FAKELIDAR: False
      REMOVE_EXTRA_WIDTH: [0.0, 0.0, 0.0]
      LIMIT_WHOLE_SCENE: True

    - NAME: random_world_flip
      ALONG_AXIS_LIST: ['x', 'y']

    - NAME: random_world_rotation
      WORLD_ROT_ANGLE: [-0.78539816, 0.78539816]  # +/- 45 degrees

    - NAME: random_world_scaling
      WORLD_SCALE_RANGE: [0.95, 1.05]

DATA_PROCESSOR:
  - NAME: mask_points_and_boxes_outside_range
    REMOVE_OUTSIDE_BOXES: True

  - NAME: shuffle_points
    SHUFFLE_ENABLED:
      train: True
      test: False

  - NAME: transform_points_to_voxels
    VOXEL_SIZE: [0.2, 0.2, 8.0]  # pillar mode
    MAX_POINTS_PER_VOXEL: 32
    MAX_NUMBER_OF_VOXELS:
      train: 40000
      test: 40000
```

### 3.4 Custom Model Configuration

Create `tools/cfgs/custom_models/centerpoint_custom.yaml`:

```yaml
CLASS_NAMES: ['Vehicle', 'Pedestrian', 'Cyclist']

DATA_CONFIG:
  _BASE_CONFIG_: cfgs/dataset_configs/custom_dataset.yaml
  POINT_CLOUD_RANGE: [-70.0, -40.0, -3.0, 70.0, 40.0, 1.0]

MODEL:
  NAME: CenterPoint

  VFE:
    NAME: DynPillarVFE
    WITH_DISTANCE: False
    USE_ABSLOTE_XYZ: True
    USE_NORM: True
    NUM_FILTERS: [64, 64]

  MAP_TO_BEV:
    NAME: PointPillarScatter
    NUM_BEV_FEATURES: 64

  BACKBONE_2D:
    NAME: BaseBEVBackbone
    LAYER_NUMS: [3, 5, 5]
    LAYER_STRIDES: [2, 2, 2]
    NUM_FILTERS: [64, 128, 256]
    UPSAMPLE_STRIDES: [0.5, 1, 2]
    NUM_UPSAMPLE_FILTERS: [128, 128, 128]

  DENSE_HEAD:
    NAME: CenterHead
    CLASS_AGNOSTIC: False
    CLASS_NAMES_EACH_HEAD:
      - ['Vehicle']
      - ['Pedestrian', 'Cyclist']
    SHARED_CONV_CHANNEL: 64
    USE_BIAS_BEFORE_NORM: True
    NUM_HM_CONV: 2
    SEPARATE_HEAD_CFG:
      HEAD_ORDER: ['center', 'center_z', 'dim', 'rot']
      HEAD_DICT:
        'center': {out_channels: 2, num_conv: 2}
        'center_z': {out_channels: 1, num_conv: 2}
        'dim': {out_channels: 3, num_conv: 2}
        'rot': {out_channels: 2, num_conv: 2}
    TARGET_ASSIGNER_CONFIG:
      FEATURE_MAP_STRIDE: 4
      NUM_MAX_OBJS: 500
      GAUSSIAN_OVERLAP: 0.1
      MIN_RADIUS: 2
    LOSS_CONFIG:
      LOSS_WEIGHTS:
        cls_weight: 1.0
        loc_weight: 0.25
        code_weights: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
    POST_PROCESSING:
      SCORE_THRESH: 0.1
      POST_CENTER_LIMIT_RANGE: [-75.0, -45.0, -5.0, 75.0, 45.0, 5.0]
      MAX_OBJ_PER_SAMPLE: 500
      NMS_CONFIG:
        NMS_TYPE: nms_gpu
        NMS_THRESH: 0.2
        NMS_PRE_MAXSIZE: 1000
        NMS_POST_MAXSIZE: 200

  POST_PROCESSING:
    RECALL_THRESH_LIST: [0.3, 0.5, 0.7]
    EVAL_METRIC: kitti

OPTIMIZATION:
  BATCH_SIZE_PER_GPU: 4
  NUM_EPOCHS: 80
  OPTIMIZER: adam_onecycle
  LR: 0.003
  WEIGHT_DECAY: 0.01
  MOMENTUM: 0.9
  MOMS: [0.95, 0.85]
  PCT_START: 0.4
  DIV_FACTOR: 10
  GRAD_NORM_CLIP: 10
```

### 3.5 Generate Infos and Train

```bash
# Generate dataset info pickle files
cd OpenPCDet
python -m pcdet.datasets.custom.custom_dataset create_custom_infos \
    tools/cfgs/dataset_configs/custom_dataset.yaml

# This creates:
#   data/custom/custom_infos_train.pkl
#   data/custom/custom_infos_val.pkl
#   data/custom/custom_dbinfos_train.pkl   (for GT-sampling augmentation)
#   data/custom/custom_gt_database/        (extracted GT point cloud snippets)

# Train (single GPU)
python tools/train.py --cfg_file tools/cfgs/custom_models/centerpoint_custom.yaml

# Train (multi-GPU)
bash tools/scripts/dist_train.sh 4 --cfg_file tools/cfgs/custom_models/centerpoint_custom.yaml

# Test
python tools/test.py --cfg_file tools/cfgs/custom_models/centerpoint_custom.yaml \
    --batch_size 4 --ckpt output/custom_models/centerpoint_custom/ckpt/checkpoint_epoch_80.pth
```

### 3.6 Data Augmentation Strategies

**GT-Sampling (most impactful augmentation):**
- Extracts individual ground-truth objects (with their interior points) into a database.
- During training, randomly pastes objects from the database into the current scene.
- Critical for rare classes -- set higher sample counts for underrepresented categories.
- `SAMPLE_GROUPS: ['Vehicle:20', 'Pedestrian:15', 'Cyclist:15']` controls how many objects of each class are pasted per scene.
- `filter_by_min_points` removes low-quality database entries (distant, occluded objects).

**Geometric Augmentations:**
- `random_world_flip`: Mirror along X and/or Y axis. Almost always beneficial.
- `random_world_rotation`: Rotate entire scene around Z-axis. Range of [-0.785, 0.785] rad (45 degrees) is standard; widen for datasets without preferred orientation.
- `random_world_scaling`: Uniform scaling [0.95, 1.05]. Helps with distance generalization.
- `random_world_translation`: Global shift [0.5, 0.5, 0.5] meters. Minor benefit.

**Custom augmentation tips for airside operations:**
- Increase rotation range to [-pi, pi] if vehicles approach from all directions on the apron.
- Tune GT-sampling counts to match deployment class frequencies (e.g., fewer cyclists, more ground vehicles, pushback tugs, baggage carts).
- Consider `LIMIT_WHOLE_SCENE: True` to prevent pasted objects from floating in unrealistic positions.

### 3.7 Coordinate System Pitfalls

The most common failure when training on custom data is coordinate system mismatch. OpenPCDet uses:
```
X = forward (toward vehicle front)
Y = left
Z = up
```
- Heading angle 0 = object aligned with X-axis (facing forward).
- If your data uses a different convention (e.g., ROS: X-forward, Y-left, Z-up is compatible; but some systems use X-right, Y-forward), you must transform both points AND labels.
- Verify with visualization: `python tools/demo.py` should show sensible bounding boxes overlaid on points.

---

## 4. RoboSense LiDAR Handling

### 4.1 RoboSense Sensor Specifications

**RS-Helios-32:**
- 32 beams, 150m range (110m @ 10% reflectivity)
- 26-degree vertical FOV (0.5-degree vertical resolution) or 70-degree ultra-wide variant
- Dense beam distribution in central FOV for higher precision
- XYZIRT point format (x, y, z, intensity, ring, timestamp)

**RS-Bpearl (RSBP):**
- 32 beams, hemispherical 360x90-degree FOV
- Designed for near-field blind-spot coverage
- Same XYZIRT format

### 4.2 RoboSense Point Cloud Format

The RoboSense SDK (rs_driver) outputs points in the `PointXYZIRT` structure:

```cpp
struct PointXYZIRT {
    float x;         // meters, right-handed coordinate system
    float y;         // meters
    float z;         // meters
    uint8_t intensity;  // 0-255 reflectance
    uint16_t ring;      // channel/beam ID (0-31 for Helios-32)
    double timestamp;   // per-point timestamp (seconds)
};
```

**Coordinate system**: rs_driver uses a right-handed coordinate system:
- X = forward (from the sensor)
- Y = left
- Z = up

This is **compatible** with OpenPCDet's convention. No rotation transform needed if the sensor frame matches your ego frame convention.

### 4.3 Converting RoboSense to OpenPCDet Format

**Step 1: Extract from ROS bags or PCAP files**

```python
import numpy as np
import rosbag
from sensor_msgs.point_cloud2 import read_points

def extract_robosense_to_npy(bag_path, topic, output_dir):
    """Extract RoboSense point clouds from ROS bag to .npy files."""
    bag = rosbag.Bag(bag_path)

    for idx, (topic_name, msg, t) in enumerate(bag.read_messages(topics=[topic])):
        # Read XYZIRT fields
        points = list(read_points(msg, field_names=['x', 'y', 'z', 'intensity',
                                                      'ring', 'timestamp']))
        pts = np.array(points, dtype=np.float32)

        # RoboSense intensity is uint8 [0-255] -> normalize to [0, 1]
        pts[:, 3] = pts[:, 3] / 255.0

        # Keep only XYZI for OpenPCDet (drop ring and timestamp)
        xyzi = pts[:, :4].astype(np.float32)

        # Filter NaN/Inf points
        valid = np.isfinite(xyzi).all(axis=1)
        xyzi = xyzi[valid]

        # Remove points at origin (invalid returns)
        dist = np.linalg.norm(xyzi[:, :3], axis=1)
        xyzi = xyzi[dist > 0.5]  # skip near-field noise

        np.save(f"{output_dir}/{idx:06d}.npy", xyzi)

    bag.close()
```

**Step 2: If using RSView export (CSV/PCD format)**

```python
import open3d as o3d

def pcd_to_npy(pcd_path, output_path):
    """Convert PCD file from RSView to OpenPCDet .npy format."""
    pcd = o3d.io.read_point_cloud(pcd_path)
    xyz = np.asarray(pcd.points, dtype=np.float32)

    # If intensity available in PCD colors channel
    if pcd.has_colors():
        intensity = np.asarray(pcd.colors)[:, 0:1].astype(np.float32)
    else:
        intensity = np.zeros((xyz.shape[0], 1), dtype=np.float32)

    xyzi = np.hstack([xyz, intensity])
    np.save(output_path, xyzi)
```

**Step 3: RoboSense-to-Velodyne ROS conversion (alternative path)**

The `rs_to_velodyne` ROS package converts RoboSense messages to Velodyne format in real-time, which can then be consumed by standard LiDAR pipelines:

```bash
# Subscribe: /rslidar_points → Publish: /velodyne_points
rosrun rs_to_velodyne rs_to_velodyne XYZIRT XYZI
```

Supported conversions: XYZIRT→XYZIRT, XYZIRT→XYZIR, XYZIRT→XYZI, XYZI→XYZIR. Works with RS-16, RS-32, RS-Ruby, RS-BP, and RS-Helios.

### 4.4 Voxel and Range Configuration for RoboSense

**RS-Helios-32 recommended settings:**

```yaml
# Helios-32 has 150m range, 26-degree vertical FOV
# For airside operations, limit range to operational area
POINT_CLOUD_RANGE: [-76.8, -76.8, -3.0, 76.8, 76.8, 1.0]
# Verification: (76.8 - (-76.8)) / 0.2 = 768 = 48 * 16 ✓
# Z: (1.0 - (-3.0)) / 0.1 = 40 ✓

# Pillar config (deployment-friendly)
VOXEL_SIZE: [0.2, 0.2, 4.0]

# Voxel config (higher accuracy)
VOXEL_SIZE: [0.1, 0.1, 0.1]
```

**RS-Bpearl recommended settings (near-field):**

```yaml
# RSBP is hemispherical, near-field focused
POINT_CLOUD_RANGE: [-30.0, -30.0, -2.0, 30.0, 30.0, 2.0]
VOXEL_SIZE: [0.1, 0.1, 4.0]  # pillar
```

**Voxel size constraints (must satisfy):**
1. `(RANGE_X_MAX - RANGE_X_MIN) / VOXEL_X` must be a **multiple of 16**.
2. `(RANGE_Y_MAX - RANGE_Y_MIN) / VOXEL_Y` must be a **multiple of 16**.
3. `(RANGE_Z_MAX - RANGE_Z_MIN) / VOXEL_Z` = **40** (for voxel backbones) or can be 1 (for pillars, since the entire Z is one pillar).

### 4.5 Multi-Sensor Aggregation

When combining multiple RoboSense sensors (e.g., Helios front + 2x Bpearl sides):

```python
import numpy as np
from scipy.spatial.transform import Rotation

def aggregate_multi_lidar(point_clouds, extrinsics):
    """
    Aggregate point clouds from multiple LiDARs into ego frame.

    Args:
        point_clouds: list of (N_i, 4) arrays [x, y, z, intensity]
        extrinsics: list of 4x4 transformation matrices (sensor → ego)

    Returns:
        (N_total, 4) aggregated point cloud in ego frame
    """
    all_points = []
    for pc, T in zip(point_clouds, extrinsics):
        xyz = pc[:, :3]
        intensity = pc[:, 3:4]

        # Apply extrinsic transform
        xyz_homo = np.hstack([xyz, np.ones((len(xyz), 1))])
        xyz_ego = (T @ xyz_homo.T).T[:, :3]

        all_points.append(np.hstack([xyz_ego, intensity]))

    merged = np.vstack(all_points).astype(np.float32)
    return merged
```

**Calibration workflow:**
1. Mount LiDARs rigidly. Measure rough extrinsics (position + orientation) from CAD or tape measure.
2. Collect overlapping scans of a known environment.
3. Refine with ICP (Iterative Closest Point) between overlapping point clouds.
4. Store as 4x4 homogeneous transforms: `T_sensor_to_ego`.
5. For temporal alignment, use the per-point timestamps from XYZIRT to compensate for motion during a scan (ego-motion undistortion).

### 4.6 RoboSense-Specific Preprocessing Tips

1. **Intensity calibration**: RoboSense intensity is uint8 [0-255]. nuScenes intensity is [0-255]. KITTI intensity is [0, 1]. Match the convention of your pretrained model.

2. **Ring ID for pillar models**: The ring channel can be used as an additional input feature. Add `'ring'` to `used_feature_list` and set `NUM_POINT_FEATURES: 5`. This encodes vertical angle information that pillars otherwise lose.

3. **Near-field filtering**: RoboSense sensors can produce noisy returns under 1m. Filter with `dist > 0.5m` or `dist > 1.0m`.

4. **Ground plane estimation**: For GT-sampling with `USE_ROAD_PLANE: True`, compute ground planes per frame using RANSAC on the lowest ring points. Store as `.txt` files alongside labels.

---

## 5. Auto-Labeling Pipeline

### 5.1 Strategy Overview

Use a nuScenes-pretrained CenterPoint model as an automatic labeler for your custom RoboSense data. The pipeline:

```
nuScenes-pretrained CenterPoint
        │
        ▼
Run inference on unlabeled custom data
        │
        ▼
Filter predictions by confidence threshold
        │
        ▼
Manual QA + correction on subset
        │
        ▼
Fine-tune model on auto-labels
        │
        ▼
Re-run inference (improved auto-labels)
        │
        ▼
Iterate until convergence
```

### 5.2 Setting Up the Pretrained Model

```bash
# Download nuScenes CenterPoint-Pillar pretrained checkpoint from OpenPCDet model zoo
# Check the README.md table for current download links

# Alternatively, train from scratch on nuScenes:
# 1. Download nuScenes dataset to data/nuscenes/
# 2. Generate infos:
python -m pcdet.datasets.nuscenes.nuscenes_dataset --func create_nuscenes_infos \
    --cfg_file tools/cfgs/dataset_configs/nuscenes_dataset.yaml --version v1.0-trainval

# 3. Train:
bash tools/scripts/dist_train.sh 8 \
    --cfg_file tools/cfgs/nuscenes_models/cbgs_dyn_pp_centerpoint.yaml
```

### 5.3 Running Inference on Custom Data

```python
import numpy as np
import torch
import glob
from pcdet.config import cfg, cfg_from_yaml_file
from pcdet.models import build_network, load_data_to_gpu
from pcdet.datasets import DatasetTemplate
from pcdet.utils import common_utils

class InferenceDataset(DatasetTemplate):
    """Minimal dataset for inference on raw point cloud files."""

    def __init__(self, dataset_cfg, class_names, point_dir, logger=None):
        super().__init__(dataset_cfg, class_names, training=False, logger=logger)
        self.point_files = sorted(glob.glob(f"{point_dir}/*.npy"))

    def __len__(self):
        return len(self.point_files)

    def __getitem__(self, index):
        points = np.load(self.point_files[index]).astype(np.float32)

        # Ensure XYZI format
        if points.shape[1] > 4:
            points = points[:, :4]

        input_dict = {
            'points': points,
            'frame_id': index,
        }
        data_dict = self.prepare_data(data_dict=input_dict)
        return data_dict

def run_auto_labeling(config_file, ckpt_file, point_dir, output_dir,
                      score_threshold=0.3):
    """Run CenterPoint inference and save pseudo-labels."""

    cfg_from_yaml_file(config_file, cfg)
    logger = common_utils.create_logger()

    dataset = InferenceDataset(cfg.DATA_CONFIG, cfg.CLASS_NAMES, point_dir, logger)
    dataloader = torch.utils.data.DataLoader(dataset, batch_size=1, shuffle=False,
                                              collate_fn=dataset.collate_batch)

    model = build_network(model_cfg=cfg.MODEL, num_class=len(cfg.CLASS_NAMES),
                          dataset=dataset)
    model.load_params_from_file(filename=ckpt_file, logger=logger)
    model.cuda().eval()

    with torch.no_grad():
        for batch_dict in dataloader:
            load_data_to_gpu(batch_dict)
            pred_dicts, _ = model(batch_dict)

            for pred in pred_dicts:
                boxes = pred['pred_boxes'].cpu().numpy()    # (N, 7)
                scores = pred['pred_scores'].cpu().numpy()  # (N,)
                labels = pred['pred_labels'].cpu().numpy()  # (N,)

                # Confidence filtering
                mask = scores >= score_threshold
                boxes = boxes[mask]
                scores = scores[mask]
                labels = labels[mask]

                # Save as OpenPCDet label format
                frame_id = batch_dict['frame_id'][0]
                save_pseudo_labels(f"{output_dir}/{frame_id:06d}.txt",
                                   boxes, scores, labels, cfg.CLASS_NAMES)

def save_pseudo_labels(path, boxes, scores, labels, class_names):
    """Save predictions as OpenPCDet-format label files."""
    with open(path, 'w') as f:
        for box, score, label in zip(boxes, scores, labels):
            cls_name = class_names[label - 1]  # labels are 1-indexed
            # x y z dx dy dz heading class_name [score]
            line = f"{box[0]:.2f} {box[1]:.2f} {box[2]:.2f} "
            line += f"{box[3]:.2f} {box[4]:.2f} {box[5]:.2f} "
            line += f"{box[6]:.4f} {cls_name}\n"
            f.write(line)
```

### 5.4 Confidence Filtering Strategy

| Stage | Score Threshold | Purpose |
|-------|----------------|---------|
| Initial auto-label | 0.5 - 0.6 | High precision, accept only confident detections |
| After 1st fine-tune | 0.3 - 0.4 | Model is adapting; loosen threshold |
| After 2nd fine-tune | 0.2 - 0.3 | Model familiar with domain; capture more objects |
| Final production | 0.1 | Maximum recall, rely on NMS for dedup |

**Per-class thresholds** are recommended since large vehicles (buses, tugs) are easier to detect than small objects (cones, personnel):
```python
class_thresholds = {
    'Vehicle': 0.4,
    'Pedestrian': 0.5,
    'Cyclist': 0.5,
}
```

### 5.5 Domain Gap Considerations

When using nuScenes-pretrained models on airside data, expect degradation from:

1. **Sensor modality**: nuScenes uses a roof-mounted 32-beam Velodyne. RoboSense Helios has different beam distribution, angular resolution, and intensity calibration.
2. **Object classes**: nuScenes has car/truck/bus/pedestrian. Airside may have pushback tugs, baggage carts, fuel trucks, ground power units. Map your classes to the closest nuScenes class.
3. **Scene geometry**: nuScenes is urban roads. Airside aprons have flat open tarmac with different distributions of objects.
4. **Intensity scale**: Match the intensity normalization. nuScenes intensity is [0-255]; if your model expects this, multiply back from [0-1].

### 5.6 Iterative Improvement Loop

```
Iteration 0: nuScenes pretrained → auto-label custom data (high threshold 0.5)
     ↓
Human QA: Review ~200 frames, fix obvious errors, add missing annotations
     ↓
Iteration 1: Fine-tune on corrected auto-labels (80 epochs, lr=0.001)
     ↓
Re-run inference with improved model (threshold 0.4)
     ↓
Iteration 2: Add more corrected frames, fine-tune (40 epochs, lr=0.0005)
     ↓
Re-run inference (threshold 0.3)
     ↓
Iteration 3: Full dataset, extended training (80 epochs, lr=0.001)
```

**Best practices:**
- Start with the **pillar variant** for auto-labeling speed (faster inference).
- Validate on a small hand-labeled holdout set at each iteration.
- Track per-class AP on the holdout set -- stop iterating when AP plateaus.
- Use **active learning** to prioritize human review: select frames with the most uncertain predictions (many predictions near the threshold) or frames where the model disagrees with previous iterations.

### 5.7 Tooling for QA

- **SUSTechPOINTS**: Open-source 3D annotation tool supporting LiDAR point clouds. Import auto-labels, manually correct, export in KITTI/OpenPCDet format.
- **Supervisely**: Commercial platform with 3D labeling, supports pre-annotation import.
- **CVAT**: Open-source, supports 3D point cloud annotation with cuboid editing.
- **Custom Open3D viewer**: Quick visual check with `o3d.visualization.draw_geometries()`.

---

## 6. TensorRT Deployment

### 6.1 The Sparse Convolution Challenge

The primary obstacle for deploying CenterPoint (voxel variant) with TensorRT is `spconv`. Sparse convolution is **not a built-in TensorRT operation**. Deployment options:

| Approach | Complexity | Performance | Flexibility |
|----------|-----------|-------------|-------------|
| Use pillar variant (no spconv) | Low | Good | High |
| Split pipeline: custom CUDA + TRT | Medium | Best | Medium |
| Write TRT plugin for spconv | High | Best | Low (fixed input shapes) |
| Use NVIDIA Lidar_AI_Solution | Medium | Best | Medium |

### 6.2 Recommended Path: CenterPoint-Pillar ONNX Export

The CenterPoint-Pillar variant uses only standard convolutions after the pillar scatter, making it ONNX/TRT-compatible. The challenge is the `ScatterND` operation (pillar scatter), which TensorRT does not natively support. Solution: split into PFE and RPN.

**Export workflow (from CarkusL/CenterPoint fork):**

```bash
# Install dependencies
pip install onnx onnx-simplifier onnxruntime

# Step 1: Export PFE (Pillar Feature Extraction) and RPN separately
python tools/export_pointpillars_onnx.py
# → generates: pfe.onnx, rpn.onnx

# Step 2: Simplify ONNX models
python tools/simplify_model.py
# → generates: pfe_sim.onnx, rpn_sim.onnx

# Step 3: Build TensorRT engines
trtexec --onnx=pfe_sim.onnx --saveEngine=pfe.engine --fp16
trtexec --onnx=rpn_sim.onnx --saveEngine=rpn.engine --fp16
```

**Inference pipeline:**
```
Raw Points → Voxelization (CUDA kernel) → PFE engine → Scatter (CUDA kernel) → RPN engine → Decode + NMS (CUDA kernel)
```

The voxelization, scatter, and post-processing steps are implemented as custom CUDA kernels outside TensorRT.

### 6.3 NVIDIA Lidar_AI_Solution (Production-Grade)

NVIDIA's official `Lidar_AI_Solution` repository provides end-to-end TensorRT deployment for:
- **PointPillars**: Full CUDA + TRT pipeline
- **CenterPoint**: 3D sparse convolution backbone + RPN via TRT, with a custom sparse convolution inference engine (independent of TensorRT) supporting INT8/FP16
- **BEVFusion**: Multi-modal with quantization

Key features:
- Custom 3D sparse convolution engine: 422 MB @ FP16, 426 MB @ INT8
- Complete pipeline: preparation → inference → evaluation in one workflow
- Claims "low accuracy drop on nuScenes validation" for quantized models
- Supports PTQ (post-training quantization) and QAT (quantization-aware training)

### 6.4 Autoware CenterPoint Deployment

Autoware Universe uses CenterPoint-Pillar with TensorRT in production autonomous vehicles:
- Two ONNX models: voxel_encoder + backbone_neck_head
- Trained on nuScenes (~28k frames) + TIER IV internal data (~11k frames), 60 epochs
- Point cloud range: [-76.8, -76.8, -4.0, 76.8, 76.8, 6.0], voxel size [0.32, 0.32, 10.0]
- Supports multi-frame densification (fusing past LiDAR sweeps)
- `build_only` mode to pre-compile TRT engines from ONNX

### 6.5 Measured Latency on Jetson Orin

**CUDA-PointPillars (NVIDIA-AI-IOT) on Orin, FP16:**

| Component | Latency (ms) |
|-----------|-------------|
| Voxelization | 0.18 |
| Backbone + Head (TRT FP16) | 4.87 |
| Decoder + NMS | 1.79 |
| **Total** | **6.84** |

Accuracy on KITTI val (vs OpenPCDet FP32 baseline):

| Class | CUDA-PP | OpenPCDet | Delta |
|-------|---------|-----------|-------|
| Car@R11 | 77.00% | 77.28% | -0.28% |
| Pedestrian@R11 | 52.50% | 52.29% | +0.21% |
| Cyclist@R11 | 62.26% | 62.68% | -0.42% |

**CenterPoint-TRT on Jetson platforms (from Sensors 2023 benchmark):**

| Platform | FPS | Power (W) |
|----------|-----|-----------|
| Jetson Nano | 1.71 | 6.3 |
| Jetson TX2 | 4.29 | 11.3 |
| Xavier NX | 10.43 | 11.5 |
| AGX Xavier | 18.4 | 21.5 |

CenterPoint-TRT achieves ~4x speedup vs PyTorch CenterPoint on AGX Xavier, with CPU usage dropping from 63% to 18% and memory from 33% to 12.5%.

**Projected Orin AGX performance**: With ~2x the TOPS of AGX Xavier, CenterPoint-TRT should achieve ~30-40 FPS on AGX Orin, comfortably real-time at 10 Hz LiDAR rate.

### 6.6 FP16 and INT8 Quantization

**FP16 Quantization:**
- Near-lossless for 3D detection. Typical accuracy drop < 0.5% mAP.
- ~2x speedup on Tensor Core GPUs (Orin, A100, RTX 30xx/40xx).
- Always the first optimization step.

**INT8 Quantization:**

| Approach | Accuracy | Speed | Effort |
|----------|----------|-------|--------|
| Naive PTQ | Significant drop (5-10% mAP) | 2-3x vs FP32 | Low |
| LiDAR-PTQ (ICLR 2024) | Near FP32 | ~3x vs FP32 | Medium |
| QAT | Near FP32 | ~3x vs FP32 | High |
| Mixed precision (FP16:1) | Near FP32 | ~2.3x vs FP32 | Low |

**LiDAR-PTQ key findings:**
- First method achieving INT8 accuracy matching FP32 for 3D LiDAR detection.
- 30x faster than QAT to apply.
- Uses sparsity-based calibration, adaptive rounding, and task-guided global positive loss.
- Works on both spconv-based and spconv-free architectures.
- Important: keep PFN (Pillar Feature Net) in FP16/FP32 because input coordinates span ~200m range with 0.01m precision; INT8 quantization of coordinates causes severe information loss.

**Mixed Precision PointPillars benchmarks on Jetson Orin:**

| Precision | Orin Latency (ms) | KITTI mAP | Notes |
|-----------|------------------|-----------|-------|
| FP32 | 32.91 | 64.64 | Baseline |
| FP16 | 18.27 | ~64.5 | Near-lossless |
| INT8 | 14.77 | ~58 (naive PTQ) | Needs calibration |
| FP16:1 (first layer FP32) | 14.29 | ~64.0 | Best speed/accuracy |
| QAT FP16:1,22,3 | 18.40 | 64.47 | Near-FP32 accuracy |

**Recommendation for Orin deployment**: Use the "FP16:1" configuration (first layer in FP32, rest in FP16) for optimal latency-accuracy tradeoff: 14.29 ms on Orin, 2.3x faster than FP32, with only 0.6% mAP drop.

### 6.7 Deployment Checklist

1. **Choose variant**: CenterPoint-Pillar for easy TRT export; Voxel for accuracy (needs NVIDIA Lidar_AI_Solution).
2. **Export ONNX**: Split into PFE + RPN (pillar) or use Lidar_AI_Solution scripts.
3. **Build TRT engines**: Use `trtexec` or programmatic API. Match the target platform (build on Orin for Orin deployment).
4. **Implement CUDA kernels**: Voxelization, scatter, and post-processing (NMS + decode) in CUDA C++.
5. **FP16 first**: Always benchmark FP16 before considering INT8.
6. **INT8 calibration**: Use 500+ representative frames from your target domain. Calibrate on target hardware.
7. **Validate accuracy**: Compare TRT output to PyTorch output on 100+ frames. Acceptable delta: < 1% mAP.
8. **Profile**: Use `nsys` or `trtexec --dumpProfile` to find bottlenecks.

---

## 7. PointPillars as Lightweight Alternative

### 7.1 Architecture Overview

PointPillars collapses the entire Z-axis into a single "pillar" per XY grid cell, avoiding 3D sparse convolutions entirely:

```
Points → Pillar Grid → PillarFeatureNet (PointNet-like) → Scatter to BEV → 2D Conv Backbone → Detection Head
```

Key design choices:
- **PillarFeatureNet**: Per-pillar PointNet with augmented features (point position relative to pillar center, distance to sensor). Two FC layers (64 filters), batch norm, ReLU, max-pooling.
- **No 3D backbone**: After scatter, everything is standard 2D convolutions.
- **Detection head**: Can use anchor-based (SSD-style) or center-based (CenterPoint-style).

### 7.2 Speed vs Accuracy Comparison

| Model | nuScenes NDS | nuScenes mAP | Latency (V100) | FPS |
|-------|-------------|-------------|----------------|-----|
| PointPillars (anchor) | ~45% | ~30% | ~25 ms | ~40 |
| CenterPoint-Pillar | ~56% | ~45% | ~35 ms | ~28 |
| CenterPoint-Voxel | ~65% | ~56% | ~60 ms | ~16 |
| FastPillars | ~71.8% | ~66.8% | ~36.5 ms | ~27 |

On KITTI (Car, moderate):

| Model | 3D AP (R11) | BEV AP (R11) | Latency |
|-------|------------|-------------|---------|
| PointPillars | 77.28% | 86.56% | ~16 ms |
| SECOND | 78.62% | 87.43% | ~25 ms |
| CenterPoint-Pillar | ~78% | ~87% | ~20 ms |

### 7.3 Deployment Advantages

**Why PointPillars dominates edge deployment:**

1. **No spconv dependency**: Entire network is standard Conv2d operations after the scatter. Direct ONNX → TRT conversion works.
2. **Minimal custom CUDA**: Only voxelization and post-processing need custom kernels. Both are simple and well-documented.
3. **Quantization-friendly**: No sparse operations that confuse PTQ calibration. INT8 works with minimal accuracy loss.
4. **Small memory footprint**: ~40 MB model weights (FP16). Fits on Jetson Nano.
5. **Deterministic latency**: No data-dependent compute (unlike spconv where latency varies with point density).

**CUDA-PointPillars (NVIDIA-AI-IOT) latency on Orin: 6.84 ms total** -- enabling 146 Hz inference, far exceeding the 10-20 Hz LiDAR rate.

### 7.4 FastPillars: Best of Both Worlds

FastPillars is a recent architecture that closes the accuracy gap with voxel-based CenterPoint while maintaining deployment friendliness:

- **Max-and-Attention Pillar Encoding (MAPE)**: Better per-pillar feature extraction than vanilla PointNet max-pooling. Adds attention-weighted aggregation alongside max-pooling.
- **Computation-reallocated backbone**: Stage ratios (6:6:3:1) instead of standard ResNet patterns. More compute in early stages for geometric features.
- **Structural re-parameterization**: RepVGG-style multi-branch training, single-branch inference.
- **No spconv**: Entirely standard convolutions. Native ONNX/TRT compatibility.

**FastPillars vs CenterPoint (Waymo val):**
- **1.8x faster** (36.5 ms vs 64.3 ms)
- **+3.8 mAPH L2 higher** accuracy
- **18 FPS on Orin AGX** -- real-time capable

### 7.5 When to Use What

| Scenario | Recommended Model | Rationale |
|----------|------------------|-----------|
| Quick prototype / validation | PointPillars | Fastest setup, good-enough accuracy |
| Edge deployment (Orin NX/Nano) | PointPillars or FastPillars | Low latency, small footprint |
| Edge deployment (Orin AGX) | CenterPoint-Pillar or FastPillars | Better accuracy within latency budget |
| Server-side training/labeling | CenterPoint-Voxel | Maximum accuracy, latency irrelevant |
| Auto-labeling pipeline | CenterPoint-Voxel (nuScenes) | Best pseudo-label quality |
| Multi-class airside detection | CenterPoint-Pillar | Good balance; easy TRT deployment |
| Real-time tracking required | CenterPoint (any variant) | Built-in velocity + greedy tracking |

### 7.6 PointPillars Quick-Start on Custom Data

```yaml
# tools/cfgs/custom_models/pointpillars_custom.yaml
CLASS_NAMES: ['Vehicle', 'Pedestrian']

DATA_CONFIG:
  _BASE_CONFIG_: cfgs/dataset_configs/custom_dataset.yaml

MODEL:
  NAME: PointPillar

  VFE:
    NAME: PillarVFE
    WITH_DISTANCE: False
    USE_ABSLOTE_XYZ: True
    USE_NORM: True
    NUM_FILTERS: [64]

  MAP_TO_BEV:
    NAME: PointPillarScatter
    NUM_BEV_FEATURES: 64

  BACKBONE_2D:
    NAME: BaseBEVBackbone
    LAYER_NUMS: [3, 5, 5]
    LAYER_STRIDES: [2, 2, 2]
    NUM_FILTERS: [64, 128, 256]
    UPSAMPLE_STRIDES: [1, 2, 4]
    NUM_UPSAMPLE_FILTERS: [128, 128, 128]

  DENSE_HEAD:
    NAME: AnchorHeadSingle
    CLASS_AGNOSTIC: False
    USE_DIRECTION_CLASSIFIER: True
    DIR_OFFSET: 0.78539
    DIR_LIMIT_OFFSET: 0.0
    NUM_DIR_BINS: 2
    ANCHOR_GENERATOR_CONFIG:
      - class_name: Vehicle
        anchor_sizes: [[4.7, 2.1, 1.7]]
        anchor_rotations: [0, 1.57]
        anchor_bottom_heights: [-1.0]
        align_center: False
      - class_name: Pedestrian
        anchor_sizes: [[0.8, 0.6, 1.7]]
        anchor_rotations: [0, 1.57]
        anchor_bottom_heights: [-0.6]
        align_center: False
    TARGET_ASSIGNER_CONFIG:
      NAME: AxisAlignedTargetAssigner
      POS_FRACTION: -1.0
      SAMPLE_SIZE: 512
      NORM_BY_NUM_EXAMPLES: False
      MATCH_HEIGHT: False
      BOX_CODER: ResidualCoder
    LOSS_CONFIG:
      LOSS_WEIGHTS:
        cls_weight: 1.0
        loc_weight: 2.0
        dir_weight: 0.2
        code_weights: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]

  POST_PROCESSING:
    RECALL_THRESH_LIST: [0.3, 0.5, 0.7]
    SCORE_THRESH: 0.1
    OUTPUT_RAW_SCORE: False
    EVAL_METRIC: kitti
    NMS_CONFIG:
      MULTI_CLASSES_NMS: False
      NMS_TYPE: nms_gpu
      NMS_THRESH: 0.01
      NMS_PRE_MAXSIZE: 4096
      NMS_POST_MAXSIZE: 500

OPTIMIZATION:
  BATCH_SIZE_PER_GPU: 4
  NUM_EPOCHS: 80
  OPTIMIZER: adam_onecycle
  LR: 0.003
  WEIGHT_DECAY: 0.01
  MOMENTUM: 0.9
  MOMS: [0.95, 0.85]
  PCT_START: 0.4
  DIV_FACTOR: 10
  GRAD_NORM_CLIP: 10
```

### 7.7 Deployment Size Comparison

| Model | Weights (FP16) | TRT Engine | Peak GPU RAM | Orin Total Latency |
|-------|---------------|------------|-------------|-------------------|
| PointPillars | ~20 MB | ~15 MB | ~200 MB | ~7 ms |
| CenterPoint-Pillar | ~40 MB | ~30 MB | ~400 MB | ~15 ms |
| CenterPoint-Voxel | ~80 MB | N/A (needs spconv engine) | ~800 MB | ~40 ms |
| FastPillars | ~35 MB | ~25 MB | ~350 MB | ~18 ms (Orin AGX) |

---

## Summary: Recommended Pipeline for Airside AV

```
┌─────────────────────────────────────────────────────────┐
│                    TRAINING PHASE                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Collect data: RoboSense Helios/Bpearl → ROS bags    │
│  2. Extract: ROS bags → .npy files (XYZI, OpenPCDet     │
│     coordinate convention)                                │
│  3. Auto-label: CenterPoint-Voxel (nuScenes pretrained)  │
│     → pseudo-labels at threshold 0.5                      │
│  4. QA: Human review ~200 frames with SUSTechPOINTS      │
│  5. Fine-tune: CenterPoint-Pillar on corrected labels    │
│  6. Iterate: Re-label → review → retrain (2-3 rounds)   │
│                                                          │
├─────────────────────────────────────────────────────────┤
│                   DEPLOYMENT PHASE                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  7. Export: CenterPoint-Pillar → ONNX (PFE + RPN)       │
│  8. Build TRT: trtexec --fp16 on target Orin             │
│  9. Integrate: CUDA voxelization + TRT PFE + scatter     │
│     + TRT RPN + CUDA NMS                                 │
│  10. Validate: < 1% mAP drop vs PyTorch                 │
│  11. Optionally: INT8 with LiDAR-PTQ for extra speed    │
│                                                          │
│  Expected: ~15 ms total on Orin AGX (67 Hz)              │
│  Or with PointPillars: ~7 ms (143 Hz)                    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## References and Resources

### Official Repositories
- [OpenPCDet (open-mmlab)](https://github.com/open-mmlab/OpenPCDet) -- Main framework
- [CenterPoint (tianweiy)](https://github.com/tianweiy/CenterPoint) -- Original CenterPoint implementation
- [NVIDIA Lidar_AI_Solution](https://github.com/NVIDIA-AI-IOT/Lidar_AI_Solution) -- Production TRT deployment
- [NVIDIA CUDA-PointPillars](https://github.com/NVIDIA-AI-IOT/CUDA-PointPillars) -- Optimized PointPillars on Orin
- [FastPillars](https://github.com/StiphyJay/FastPillars) -- Deployment-friendly pillar detector

### TensorRT Export Forks
- [CarkusL/CenterPoint](https://github.com/CarkusL/CenterPoint) -- CenterPoint-Pillar ONNX export
- [Hale423/CenterPoint](https://github.com/Hale423/CenterPoint) -- PFE/RPN split export
- [stidk/CenterPoint_tensorrt](https://github.com/stidk/CenterPoint_tensorrt) -- TRT with INT8/FP16
- [spconv-builder](https://github.com/SilvesterHsu/spconv-builder) -- Prebuilt C++ spconv for TRT

### RoboSense Tools
- [rs_driver](https://github.com/RoboSense-LiDAR/rs_driver) -- Cross-platform driver kernel
- [rslidar_sdk](https://github.com/RoboSense-LiDAR/rslidar_sdk) -- ROS/ROS2 SDK
- [rs_to_velodyne](https://github.com/HViktorTsoi/rs_to_velodyne) -- Format conversion tool

### Papers
- [CenterPoint (CVPR 2021)](https://openaccess.thecvf.com/content/CVPR2021/papers/Yin_Center-Based_3D_Object_Detection_and_Tracking_CVPR_2021_paper.pdf) -- Original paper
- [PointPillars (CVPR 2019)](https://arxiv.org/abs/1812.05784) -- Pillar-based detection
- [FastPillars (ECCV 2022)](https://arxiv.org/abs/2302.02367) -- Deployment-friendly pillars
- [LiDAR-PTQ (ICLR 2024)](https://arxiv.org/abs/2401.15865) -- Quantization for 3D detection
- [Mixed Precision PointPillars](https://arxiv.org/html/2601.12638) -- Orin FP16/INT8 benchmarks
- [Jetson 3D Detector Benchmark (Sensors 2023)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10144830/) -- Edge platform evaluation

### Deployment Documentation
- [Autoware CenterPoint](https://autowarefoundation.github.io/autoware_universe/main/perception/autoware_lidar_centerpoint/) -- Production AD stack integration
- [TensorRT Developer Guide](https://docs.nvidia.com/deeplearning/tensorrt/developer-guide/index.html) -- Quantization and optimization
- [OpenPCDet Custom Dataset Tutorial](https://github.com/open-mmlab/OpenPCDet/blob/master/docs/CUSTOM_DATASET_TUTORIAL.md) -- Official custom data guide
- [OpenPCDet Installation](https://github.com/open-mmlab/OpenPCDet/blob/master/docs/INSTALL.md) -- Setup instructions
