# Practical Guide: nuScenes, Waymo Open Dataset, and Related Driving Datasets for World Model Pre-Training

> Compiled March 2026. Oriented toward pre-training world models for airside autonomous vehicle adaptation.

---

## Table of Contents

1. [nuScenes](#1-nuscenes)
2. [Waymo Open Dataset](#2-waymo-open-dataset)
3. [Occupancy Labels (Occ3D, OpenOccupancy)](#3-occupancy-labels)
4. [nuPlan](#4-nuplan)
5. [Argoverse 2](#5-argoverse-2)
6. [KITTI](#6-kitti)
7. [Cross-Dataset Comparison for World Model Pre-Training](#7-cross-dataset-comparison-for-world-model-pre-training)

---

## 1. nuScenes

### 1.1 Overview

nuScenes is a large-scale multimodal autonomous driving dataset collected by Motional (formerly nuTonomy) in Boston and Singapore. It contains 1,000 driving scenes, each 20 seconds long, with full 360-degree sensor coverage from 6 cameras, 1 LiDAR, and 5 radars (12 sensors total). Keyframes are annotated at 2 Hz with 3D bounding boxes across 23 object categories and 8 attributes.

**Key statistics:**
- 1,000 scenes (700 train, 150 val, 150 test)
- ~40,000 keyframe samples (at 2 Hz)
- ~1.4 million 3D bounding box annotations
- 23 object classes, 8 dynamic attributes
- 7x more annotations and 100x more images than KITTI

### 1.2 Download Procedure

1. **Register** at [nuscenes.org](https://www.nuscenes.org/sign-up) (free academic account).
2. Navigate to the **Downloads** page.
3. Select the desired split:

| Split | Description | Approximate Size |
|-------|-------------|-----------------|
| **v1.0-mini** | 10 scenes, for quick prototyping | ~4 GB |
| **v1.0-trainval** | 850 scenes (700 train + 150 val) | ~300 GB (all blobs) |
| **v1.0-test** | 150 scenes, no annotations | ~70 GB |

4. Download includes multiple archives:
   - `samples/` -- keyframe sensor data (images, point clouds, radar)
   - `sweeps/` -- intermediate (non-keyframe) sensor data at full sensor rate
   - `maps/` -- rasterized and vectorized map files
   - `v1.0-trainval/` or `v1.0-mini/` -- JSON annotation/metadata files

5. Extract to a directory (conventionally `/data/sets/nuscenes/`):

```
nuscenes/
  samples/
    CAM_FRONT/
    CAM_FRONT_LEFT/
    CAM_FRONT_RIGHT/
    CAM_BACK/
    CAM_BACK_LEFT/
    CAM_BACK_RIGHT/
    LIDAR_TOP/
    RADAR_FRONT/
    RADAR_FRONT_LEFT/
    RADAR_FRONT_RIGHT/
    RADAR_BACK_LEFT/
    RADAR_BACK_RIGHT/
  sweeps/
    (same channel subdirectories)
  maps/
  v1.0-trainval/
    scene.json
    sample.json
    sample_data.json
    sample_annotation.json
    ego_pose.json
    calibrated_sensor.json
    sensor.json
    instance.json
    category.json
    attribute.json
    visibility.json
    log.json
    map.json
    lidarseg.json (if lidarseg downloaded)
```

**Optional extensions** (separate downloads):
- **nuScenes-lidarseg**: Semantic point-cloud labels for ~40,000 keyframes (16 classes)
- **Panoptic nuScenes**: Panoptic segmentation (instance + semantic) labels
- **CAN Bus Expansion**: Low-level vehicle data (IMU, steering, throttle)
- **Map Expansion v1.3**: 11 semantic map layers with lidar basemap

### 1.3 Sensor Configuration

#### Cameras (6x)

- **Type**: 6 Basler acA1600-60gc machine vision cameras
- **Resolution**: 1600 x 900 pixels
- **Frame rate**: 12 Hz (keyframes sampled at 2 Hz)
- **Coverage**: Full 360-degree surround view
- **Channels**:
  - `CAM_FRONT` -- forward-facing
  - `CAM_FRONT_LEFT` -- 60 degrees left of front
  - `CAM_FRONT_RIGHT` -- 60 degrees right of front
  - `CAM_BACK` -- rear-facing
  - `CAM_BACK_LEFT` -- 60 degrees left of rear
  - `CAM_BACK_RIGHT` -- 60 degrees right of rear

#### LiDAR (1x)

- **Type**: Velodyne VLP-32C (32-beam)
- **Channel**: `LIDAR_TOP` (roof-mounted)
- **Range**: ~70 m effective
- **Rotation rate**: 20 Hz (keyframes at 2 Hz)
- **Points per sweep**: ~34,000
- **Data format**: Binary `.pcd.bin` files -- `float32` array with 5 channels: `(x, y, z, intensity, ring_index)`. The devkit loads only the first 4 channels by default.

#### Radars (5x)

- **Type**: Continental ARS408-21 77 GHz long-range radar
- **Channels**:
  - `RADAR_FRONT`
  - `RADAR_FRONT_LEFT`
  - `RADAR_FRONT_RIGHT`
  - `RADAR_BACK_LEFT`
  - `RADAR_BACK_RIGHT`
- **Frame rate**: 13 Hz
- **Data format**: 18-dimensional point cloud per return including `(x, y, z, vx, vy, vx_comp, vy_comp, ...)` with velocity compensation for ego motion

### 1.4 Coordinate Systems

nuScenes uses a **right-handed coordinate system**:

- **Global (world) frame**: Fixed reference; ego poses are expressed in this frame. Derived from a lidar-map-based localization algorithm. Z is always 0 for ego_pose (2D localization).
- **Ego vehicle frame**: Origin at the center of the rear axle projected to ground. **X = forward, Y = left, Z = up**.
- **Sensor frames**: Each sensor has its own frame defined by `calibrated_sensor` (translation + rotation quaternion relative to ego frame). Cameras additionally have a 3x3 intrinsic matrix.
- **LiDAR/Radar point clouds**: Natively in their respective sensor frames. X = forward, Y = left, Z = up (same convention as ego frame).

**Quaternion convention**: `(w, x, y, z)` (scalar-first).

**Transformation chain** (sensor to global):
```
point_global = ego_pose @ calibrated_sensor @ point_sensor
```
Where each transform is a 4x4 homogeneous matrix constructed from `(translation, rotation)`.

### 1.5 Annotation Format (JSON Schema)

The nuScenes annotation system is a **relational database** stored as JSON files. Each record has a unique `token` (UUID string) as primary key, with foreign keys linking tables.

#### Core Tables

**`scene.json`** -- 20-second driving sequences
```json
{
  "token": "str (UUID)",
  "name": "str (e.g., 'scene-0001')",
  "description": "str",
  "log_token": "str -> log",
  "nbr_samples": "int",
  "first_sample_token": "str -> sample",
  "last_sample_token": "str -> sample"
}
```

**`sample.json`** -- Annotated keyframes at 2 Hz, synchronized with a LiDAR sweep
```json
{
  "token": "str (UUID)",
  "timestamp": "int (Unix microseconds)",
  "scene_token": "str -> scene",
  "next": "str -> sample (empty string if last)",
  "prev": "str -> sample (empty string if first)"
}
```

**`sample_data.json`** -- Individual sensor readings (images, point clouds, radar returns)
```json
{
  "token": "str (UUID)",
  "sample_token": "str -> sample",
  "ego_pose_token": "str -> ego_pose",
  "calibrated_sensor_token": "str -> calibrated_sensor",
  "filename": "str (relative path, e.g., 'samples/CAM_FRONT/n015-..._0.jpg')",
  "fileformat": "str ('jpg', 'pcd', 'pcd.bin')",
  "width": "int (image width, 0 for non-images)",
  "height": "int (image height, 0 for non-images)",
  "timestamp": "int (Unix microseconds)",
  "is_key_frame": "bool",
  "next": "str -> sample_data (same sensor)",
  "prev": "str -> sample_data (same sensor)"
}
```

**`sample_annotation.json`** -- 3D bounding boxes for objects
```json
{
  "token": "str (UUID)",
  "sample_token": "str -> sample (NOT sample_data)",
  "instance_token": "str -> instance",
  "attribute_tokens": ["str -> attribute", "..."],
  "visibility_token": "str -> visibility",
  "translation": [x, y, z],       // center in global frame, meters
  "size": [width, length, height], // meters
  "rotation": [w, x, y, z],       // quaternion in global frame
  "num_lidar_pts": "int",
  "num_radar_pts": "int",
  "next": "str -> sample_annotation (same instance, next timestep)",
  "prev": "str -> sample_annotation (same instance, prev timestep)"
}
```

**`ego_pose.json`** -- Vehicle pose relative to global/map frame
```json
{
  "token": "str (UUID)",
  "translation": [x, y, z],  // z is always 0 (2D localization)
  "rotation": [w, x, y, z],  // quaternion
  "timestamp": "int (Unix microseconds)"
}
```

**`calibrated_sensor.json`** -- Per-vehicle sensor calibration
```json
{
  "token": "str (UUID)",
  "sensor_token": "str -> sensor",
  "translation": [x, y, z],        // relative to ego frame, meters
  "rotation": [w, x, y, z],        // quaternion
  "camera_intrinsic": [[3x3 matrix]] // only for cameras, empty list for lidar/radar
}
```

**`sensor.json`** -- Sensor type definitions
```json
{
  "token": "str (UUID)",
  "channel": "str (e.g., 'CAM_FRONT', 'LIDAR_TOP')",
  "modality": "str ('camera' | 'lidar' | 'radar')"
}
```

#### Supporting Tables

| Table | Key Fields | Purpose |
|-------|-----------|---------|
| `instance.json` | `token`, `category_token`, `nbr_annotations`, `first_annotation_token`, `last_annotation_token` | Unique object instances across a scene |
| `category.json` | `token`, `name`, `description`, `index` | Object taxonomy (e.g., `vehicle.car`, `human.pedestrian.adult`). `index` maps to lidarseg `.bin` labels |
| `attribute.json` | `token`, `name`, `description` | Dynamic properties (e.g., `vehicle.moving`, `cycle.with_rider`) |
| `visibility.json` | `token`, `level`, `description` | Visibility bins: 0-40%, 40-60%, 60-80%, 80-100% (across all 6 cameras) |
| `log.json` | `token`, `logfile`, `vehicle`, `date_captured`, `location` | Collection metadata (locations: `singapore-onenorth`, `singapore-hollandvillage`, `singapore-queenstown`, `boston-seaport`) |
| `map.json` | `token`, `log_tokens`, `category`, `filename` | Top-down semantic masks for drivable surface and sidewalks |
| `lidarseg.json` | `token`, `filename`, `sample_data_token` | Points to `.bin` files containing per-point `uint8` semantic labels |

**Important constraints:**
- Object identities (`instance_token`) are **not preserved across scenes**.
- Annotations are tied to `sample` (keyframe), not `sample_data` (individual sensor reading).
- Linked-list navigation via `next`/`prev` enables temporal traversal within scenes or per-instance tracking.

### 1.6 Loading Data with nuscenes-devkit

#### Installation

```bash
pip install nuscenes-devkit
```

#### Basic Initialization

```python
from nuscenes.nuscenes import NuScenes

# Use 'v1.0-mini' for prototyping, 'v1.0-trainval' for full training
nusc = NuScenes(version='v1.0-mini', dataroot='/data/sets/nuscenes', verbose=True)
```

#### Iterating Over Scenes and Samples

```python
# List all scenes
nusc.list_scenes()

# Access a specific scene
my_scene = nusc.scene[0]
print(my_scene['name'], my_scene['description'])

# Navigate samples via linked list
sample_token = my_scene['first_sample_token']
my_sample = nusc.get('sample', sample_token)

while my_sample['next'] != '':
    my_sample = nusc.get('sample', my_sample['next'])
    # Process each keyframe...
```

#### Accessing Sensor Data

```python
# Get camera data for a sample
cam_front_data = nusc.get('sample_data', my_sample['data']['CAM_FRONT'])
print(cam_front_data['filename'])  # relative path to image

# Get LiDAR data
lidar_data = nusc.get('sample_data', my_sample['data']['LIDAR_TOP'])

# Get the full file path
from nuscenes.utils.data_classes import LidarPointCloud
lidar_path = nusc.get_sample_data_path(lidar_data['token'])
pc = LidarPointCloud.from_file(lidar_path)
print(pc.points.shape)  # (4, N) -- x, y, z, intensity
```

#### Working with Annotations

```python
# Get all annotation tokens for a sample
ann_tokens = my_sample['anns']

# Retrieve a specific annotation
ann = nusc.get('sample_annotation', ann_tokens[0])
print(f"Class: {ann['category_name']}")
print(f"Position: {ann['translation']}")
print(f"Size (w,l,h): {ann['size']}")
print(f"LiDAR points: {ann['num_lidar_pts']}")

# Track an instance across time
instance = nusc.get('instance', ann['instance_token'])
ann_record = nusc.get('sample_annotation', instance['first_annotation_token'])
while ann_record['next'] != '':
    ann_record = nusc.get('sample_annotation', ann_record['next'])
    # Process trajectory...
```

#### Coordinate Transforms

```python
from pyquaternion import Quaternion
import numpy as np

# Get calibration and pose for a sensor reading
sd_record = nusc.get('sample_data', my_sample['data']['LIDAR_TOP'])
cs_record = nusc.get('calibrated_sensor', sd_record['calibrated_sensor_token'])
ep_record = nusc.get('ego_pose', sd_record['ego_pose_token'])

# Sensor frame -> Ego frame
sensor_to_ego = np.eye(4)
sensor_to_ego[:3, :3] = Quaternion(cs_record['rotation']).rotation_matrix
sensor_to_ego[:3, 3] = cs_record['translation']

# Ego frame -> Global frame
ego_to_global = np.eye(4)
ego_to_global[:3, :3] = Quaternion(ep_record['rotation']).rotation_matrix
ego_to_global[:3, 3] = ep_record['translation']

# Full transform: sensor -> global
sensor_to_global = ego_to_global @ sensor_to_ego
```

#### Rendering and Visualization

```python
# Render a sample with all sensors
nusc.render_sample(my_sample['token'])

# Render point cloud projected onto camera
nusc.render_pointcloud_in_image(my_sample['token'],
                                pointsensor_channel='LIDAR_TOP')

# Render LiDAR with map underlay and multi-sweep aggregation
nusc.render_sample_data(my_sample['data']['LIDAR_TOP'],
                       nsweeps=5, underlay_map=True)

# Render ego poses on the map
nusc.render_egoposes_on_map(log_location='singapore-onenorth')
```

#### Multi-Sweep Aggregation

```python
from nuscenes.utils.data_classes import LidarPointCloud

# Aggregate 10 sweeps into a denser point cloud
pc, times = LidarPointCloud.from_file_multisweep(
    nusc, my_sample, chan='LIDAR_TOP', ref_chan='LIDAR_TOP', nsweeps=10
)
# pc.points shape: (4, N_total) with points from 10 sweeps
# times: (1, N_total) relative timestamps
```

### 1.7 nuScenes-to-Custom Format Conversion Tips

**Converting to KITTI format** (via mmdetection3d):
```bash
python tools/create_data.py nuscenes \
  --root-path ./data/nuscenes \
  --out-dir ./data/nuscenes \
  --extra-tag nuscenes
```
This generates `.pkl` info files and a database of cropped point cloud segments for GT augmentation.

**Common conversion pitfalls:**
- nuScenes annotations are in the **global frame**; you must transform to ego or sensor frame for most model inputs.
- The 32-beam VLP-32C produces significantly sparser point clouds (~34k pts/sweep) than Waymo's 64-beam top LiDAR. Compensate with multi-sweep aggregation (typically 10 sweeps).
- nuScenes uses `(w, l, h)` for bounding box size; KITTI uses `(h, w, l)`. Pay attention to dimension ordering.
- Quaternion rotation in nuScenes is `(w, x, y, z)` scalar-first; some frameworks expect `(x, y, z, w)`.
- The 2 Hz keyframe rate means temporal models see 0.5s between frames. Sweeps provide higher temporal resolution if needed.

---

## 2. Waymo Open Dataset

### 2.1 Overview

The Waymo Open Dataset is one of the largest and most diverse autonomous driving datasets, collected by Waymo's fleet across multiple U.S. cities. It comprises three sub-datasets:

| Sub-Dataset | Description | Scale |
|-------------|-------------|-------|
| **Perception** | High-resolution sensor data with 3D/2D labels | 1,150 scenes, 20s each, ~230,000 frames |
| **Motion** | Object trajectories + HD maps for forecasting | 103,354 scenes, 20s each at 10 Hz |
| **End-to-End Driving** | Camera data with high-level driving commands | 8 cameras with 360-degree coverage |

### 2.2 Download Procedure

Waymo data is hosted on **Google Cloud Platform (GCP)**. Access requires authentication:

1. **Register** at [waymo.com/open](https://waymo.com/open/) using a Google account.
2. **Accept the license agreement** (Waymo Dataset License Agreement for Non-Commercial Use).
3. Access data through one of two methods:

**Method A: Web portal**
- Navigate to [waymo.com/open/download](https://waymo.com/open/download/) (requires Google sign-in)
- Select dataset version and split
- Download TFRecord files directly

**Method B: GCP CLI (recommended for bulk download)**
```bash
# Install Google Cloud SDK
curl https://sdk.cloud.google.com | bash

# Authenticate
gcloud auth login

# v1 format (TFRecords):
gsutil -m cp -r gs://waymo_open_dataset_v_1_4_3/ /local/path/

# v2 format (Parquet files):
gsutil -m cp -r gs://waymo_open_dataset_v_2_0_0/ /local/path/
```

**GCP bucket names** (as of early 2026):
- `gs://waymo_open_dataset_v_1_4_3` -- v1.4.3 TFRecord format
- `gs://waymo_open_dataset_v_2_0_0` -- v2.0 Parquet format (recommended for new projects)

**Dataset sizes:**
- Perception dataset: ~1.5 TB (all splits, v1 TFRecords)
- Motion dataset: ~300 GB
- End-to-End dataset: varies by version

### 2.3 Data Format

#### v1 Format: TFRecords + Protocol Buffers

Each TFRecord file contains serialized `Frame` protocol buffer messages:

```python
import tensorflow as tf
from waymo_open_dataset import dataset_pb2 as open_dataset
from waymo_open_dataset.utils import frame_utils

# Load a TFRecord segment
dataset = tf.data.TFRecordDataset('segment-xxx.tfrecord', compression_type='')

for data in dataset:
    frame = open_dataset.Frame()
    frame.ParseFromString(bytearray(data.numpy()))

    # Access context (shared across all frames in segment)
    context = frame.context

    # Access sensor data
    for image in frame.images:
        camera_name = open_dataset.CameraName.Name.Name(image.name)
        # image.image is JPEG-compressed bytes

    for laser in frame.lasers:
        laser_name = open_dataset.LaserName.Name.Name(laser.name)
        # laser.ri_return1 contains range image (first return)
        # laser.ri_return2 contains range image (second return)
```

**Converting range images to point clouds:**
```python
(range_images, camera_projections,
 _, range_image_top_pose) = frame_utils.parse_range_image_and_camera_projection(frame)

points, cp_points = frame_utils.convert_range_image_to_point_cloud(
    frame, range_images, camera_projections, range_image_top_pose)

# points is a list of [N, 3] arrays, one per LiDAR
# points[0] is TOP lidar (largest), points[1-4] are the other four
```

#### v2 Format: Apache Parquet (Recommended)

The v2 format uses columnar Parquet files, enabling selective column/component downloads:

```bash
pip install gcsfs waymo-open-dataset-tf-2-12-0
```

```python
import dask.dataframe as dd
from waymo_open_dataset import v2

dataset_dir = '/path/to/waymo_v2'
context_name = '10023947602400723454_1120_000_1140_000'

def read(tag: str) -> dd.DataFrame:
    paths = f'{dataset_dir}/{tag}/{context_name}.parquet'
    return dd.read_parquet(paths)

# Read camera images
cam_image_df = read('camera_image')

# Read LiDAR 3D boxes
lidar_box_df = read('lidar_box')

# Merge camera images with 2D boxes
cam_box_df = read('camera_box')
cam_img_df = read('camera_image')
merged = v2.merge(cam_box_df, cam_img_df)
```

**v2 component tags** (folder names in the bucket):
- `camera_image` -- JPEG images with pose, velocity, rolling shutter params
- `camera_box` -- 2D bounding boxes with difficulty levels
- `lidar` -- Range image data (two returns)
- `lidar_box` -- 3D bounding boxes with speed, acceleration, point counts
- `camera_to_lidar_box_association` -- Cross-sensor object linking
- `camera_hkp` / `lidar_hkp` -- Human keypoints (2D and 3D)
- `lidar_segmentation` -- Per-point semantic labels (22 classes)

### 2.4 Sensor Configuration

#### LiDAR (5 sensors total)

| Name | Type | Specs |
|------|------|-------|
| `TOP` | Mid-range LiDAR | 64 vertical beams, 2650 columns per revolution, 360-degree HFOV, ~200 m range, roof-mounted |
| `FRONT` | Short-range LiDAR | Narrower FOV, shorter range, front bumper |
| `SIDE_LEFT` | Short-range LiDAR | Side-facing |
| `SIDE_RIGHT` | Short-range LiDAR | Side-facing |
| `REAR` | Short-range LiDAR | Rear-facing |

- **Frame rate**: 10 Hz
- **Multi-return**: Each LiDAR captures two returns per beam (first and second echo)
- **Range image format**: Channels are `(range, intensity, elongation, is_in_no_label_zone)`

#### Cameras (5 cameras for Perception, 8 for End-to-End)

| Name | Placement |
|------|-----------|
| `FRONT` | Forward-facing, widest FOV |
| `FRONT_LEFT` | Front-left |
| `FRONT_RIGHT` | Front-right |
| `SIDE_LEFT` | Left side |
| `SIDE_RIGHT` | Right side |

Additional cameras in End-to-End dataset: `REAR_LEFT`, `REAR`, `REAR_RIGHT` (for 360-degree coverage).

- **Resolution**: 1920 x 1280 (FRONT), 1920 x 886 (others, approximate -- varies by generation)
- **Frame rate**: 10 Hz, synchronized with LiDAR
- **Format**: JPEG-compressed in TFRecords
- **Rolling shutter**: Parameters provided for motion compensation

### 2.5 Coordinate Systems

Waymo uses a **right-handed coordinate system** but with different axis conventions than nuScenes:

| Frame | X | Y | Z | Notes |
|-------|---|---|---|-------|
| **Vehicle frame** | Forward | Left | Up | Origin at center of rear axle |
| **Sensor frames** | Forward | Left | Up | Each sensor has extrinsic `[4x4]` transform to vehicle frame |
| **Global frame** | East | North | Up | World-fixed reference |

**Key difference from nuScenes**: Both use X-forward, Y-left, Z-up for the vehicle frame, so the ego-frame conventions are compatible. However:

- **Waymo global frame** uses East-North-Up (ENU), while nuScenes global frame is derived from a local map coordinate system.
- **LiDAR calibration**: Waymo provides beam inclination angles (non-uniform spacing) rather than a fixed vertical FOV specification.
- **Rotation representation**: Waymo uses 4x4 transformation matrices in protobuf; nuScenes uses quaternions `(w, x, y, z)`.

**Vehicle frame to global transform:**
```python
# From Waymo Frame proto
vehicle_pose = np.array(frame.pose.transform).reshape(4, 4)
# This is a 4x4 matrix: global_point = vehicle_pose @ vehicle_point
```

### 2.6 Perception Dataset vs. Motion Dataset

| Aspect | Perception | Motion |
|--------|-----------|--------|
| **Primary use** | 3D detection, tracking, segmentation | Trajectory forecasting, interaction prediction |
| **Scenes** | 1,150 (20s each) | 103,354 (20s each, ~570 hours) |
| **Sensor data** | Full raw LiDAR + camera | Pre-extracted object trajectories + HD maps |
| **Annotations** | 3D/2D boxes, semantic segmentation | 3D bounding box trajectories, map features |
| **Download size** | ~1.5 TB | ~300 GB |
| **Key classes** | Vehicle, Pedestrian, Cyclist, Sign | Same + interactive behavior labels |
| **Maps** | Not included | HD vector maps with lane geometry |

The **Motion dataset** is pre-processed: you get object trajectories (position, velocity, heading at 10 Hz) and vectorized map data (lane boundaries, crosswalks, speed limits) rather than raw sensor data. This is ideal for forecasting/planning but not for perception model training.

### 2.7 Waymo-to-Other-Format Conversion

#### Waymo to KITTI format (via mmdetection3d)

```bash
pip install waymo-open-dataset-tf-2-6-0

# Convert TFRecords to KITTI-style format
TF_CPP_MIN_LOG_LEVEL=3 python tools/create_data.py waymo \
  --root-path ./data/waymo \
  --out-dir ./data/waymo \
  --workers 128 \
  --extra-tag waymo \
  --version v1.4
```

Output structure after conversion:
```
data/waymo/
  waymo_format/
    training/     # raw TFRecords
    validation/
    testing/
  kitti_format/
    ImageSets/
    training/
      image_0/ through image_4/   # 5 camera views
      velodyne/                    # merged point clouds as .bin
      label_0/                     # KITTI-style labels
    waymo_infos_train.pkl
    waymo_infos_val.pkl
```

**Naming convention**: Files use `{split_prefix}{segment_idx:03d}{frame_idx:03d}` where prefix 0=train, 1=val, 2=test.

#### Waymo to nuScenes format

There is no official converter. Common approaches:

1. **Intermediate KITTI format**: Convert Waymo -> KITTI -> custom, then map KITTI fields to nuScenes JSON tables.
2. **Custom script**: Write a converter that reads Waymo TFRecords/Parquet and generates nuScenes JSON + reorganized sensor files. Key mappings:
   - Waymo `Frame` -> nuScenes `sample`
   - Waymo `CameraImage` -> nuScenes `sample_data` (camera)
   - Waymo `Laser` -> nuScenes `sample_data` (lidar)
   - Waymo `Label` -> nuScenes `sample_annotation`
   - Waymo pose matrix -> nuScenes `ego_pose` (decompose to translation + quaternion)
   - Waymo calibration -> nuScenes `calibrated_sensor`

3. **Unified frameworks**: Use mmdetection3d or OpenPCDet, which support both formats natively and handle coordinate conversion internally.

**Critical conversion notes:**
- Waymo's 5-LiDAR merged point cloud is much denser (~180k pts/frame from TOP alone) than nuScenes' single 32-beam VLP-32C (~34k pts/frame).
- Waymo labels only 4 classes (Vehicle, Pedestrian, Cyclist, Sign) vs. nuScenes' 23. Category mapping requires careful handling.
- When converting coordinates: both use X-forward, Y-left, Z-up in the vehicle frame, but global frame conventions differ.
- Waymo annotations include per-frame difficulty levels; nuScenes uses visibility bins.

---

## 3. Occupancy Labels

Occupancy prediction represents 3D scenes as voxel grids with semantic labels -- essential for world models that need to reason about free space, occluded regions, and scene geometry.

### 3.1 Occ3D

**Paper**: "Occ3D: A Large-Scale 3D Occupancy Prediction Benchmark for Autonomous Driving" (ICCV 2023 area)

**Two benchmarks:**
- **Occ3D-nuScenes**: Built on nuScenes
- **Occ3D-Waymo**: Built on Waymo Open Dataset

#### Specifications

| Aspect | Occ3D-nuScenes | Occ3D-Waymo |
|--------|----------------|-------------|
| Voxel resolution | 0.4m x 0.4m x 0.4m | 0.05m x 0.05m x 0.05m |
| Volume range | +/-40m XY, -1 to 5.4m Z | +/-80m XY, -1 to 5.4m Z |
| Volume dimensions | 200 x 200 x 16 | 3200 x 3200 x 128 |
| Semantic classes | 16 + General Object (GO) | 14 + General Object (GO) |
| Training sequences | 700 | 798 |
| Validation sequences | 150 | 202 |
| Total frames | ~40,000 | ~200,000 |

**Semantic classes** (Occ3D-nuScenes): barrier, bicycle, bus, car, construction vehicle, motorcycle, pedestrian, traffic cone, trailer, truck, driveable surface, other flat, sidewalk, terrain, manmade, vegetation, + General Object.

**Voxel states**: Each voxel is one of:
- **Occupied** -- with a semantic label
- **Free** -- confirmed empty by ray casting
- **Unobserved** -- no sensor coverage (occluded or out of range)

#### Label Generation Pipeline

1. **Voxel densification**: Multi-frame LiDAR aggregation (separate pipelines for static and dynamic objects), KNN-based label propagation, mesh reconstruction via VDBFusion
2. **Occlusion reasoning**: Ray casting from LiDAR and camera viewpoints to determine visibility
3. **Image-guided refinement**: 2D semantic segmentation projected back to 3D to correct voxel labels

#### Download

- **Occ3D-nuScenes**: [Google Drive](https://drive.google.com/drive/folders/1wZ-8OI1IJkrXo6BudFSGmaKXBUYQ3ts_)
- **Occ3D-Waymo**: [Google Drive](https://drive.google.com/drive/folders/13WxRl9Zb_AshEwvD96Uwz8cHjRNrtfQk)
- **Code**: [GitHub - Tsinghua-MARS-Lab/Occ3D](https://github.com/Tsinghua-MARS-Lab/Occ3D)
- **License**: MIT for generated labels; underlying data subject to nuScenes/Waymo terms

#### Usage with nuScenes

Occ3D labels are stored as separate files that index into nuScenes samples by token. You load nuScenes normally, then load the corresponding occupancy ground truth:

```python
import numpy as np

# Load occupancy label for a sample
occ_path = f'occ3d_nuscenes/{sample_token}/labels.npz'
occ_data = np.load(occ_path)
semantics = occ_data['semantics']    # (200, 200, 16) uint8
mask_lidar = occ_data['mask_lidar']  # visibility from LiDAR
mask_camera = occ_data['mask_camera'] # visibility from cameras
```

### 3.2 OpenOccupancy

**Paper**: "OpenOccupancy: A Large Scale Benchmark for Surrounding Semantic Occupancy Perception" (ICCV 2023)

Built on nuScenes with denser annotations via the Augmenting And Purifying (AAP) pipeline (~4,000 human labeling hours to approximately double annotation density compared to automatic methods).

#### Specifications

| Aspect | Value |
|--------|-------|
| Voxel resolution | 0.2m |
| Volume range | [-51.2, -51.2, -5] to [51.2, 51.2, 3] meters |
| Volume dimensions | 512 x 512 x 40 voxels |
| Semantic classes | 16 (+ empty/noise) |
| Training frames | 28,130 |
| Validation frames | 6,019 |

#### Download and Setup

1. Download nuScenes v1.0 full dataset
2. Download pre-computed pickle files from the OpenOccupancy GitHub releases
3. Generate depth maps: `python ./tools/gen_data/gen_depth_gt.py`
4. Download occupancy annotations (~5 GB compressed):
   - nuScenes-Occupancy v0.1 via Google Drive or Baidu Cloud

```
OpenOccupancy/data/
  nuscenes/          # standard nuScenes data
  depth_gt/          # pre-computed depth maps
  nuScenes-Occupancy/ # occupancy labels
```

**Code**: [GitHub - JeffWang987/OpenOccupancy](https://github.com/JeffWang987/OpenOccupancy)

### 3.3 CVPR 2023 Occupancy Challenge (SurroundOcc / Occ-nuscenes)

Another occupancy benchmark built on nuScenes with:
- 0.4m voxel size, volume 200 x 200 x 16
- 18 semantic classes (16 from nuScenes-lidarseg + free space + general object)
- Camera visibility masks (`mask_camera`) for evaluating camera-only models
- mIoU evaluation metric

### 3.4 Choosing an Occupancy Dataset

| Dataset | Resolution | Coverage | Density | Best For |
|---------|-----------|----------|---------|----------|
| Occ3D-nuScenes | 0.4m | +/-40m | Medium | Standard benchmarking, camera-based occ |
| Occ3D-Waymo | 0.05m | +/-80m | Very high | Fine-grained geometry, LiDAR-rich tasks |
| OpenOccupancy | 0.2m | +/-51.2m | High (human-refined) | Surrounding perception, multi-modal |

For **world model pre-training**: Occ3D-Waymo offers the finest resolution and largest volume, but Occ3D-nuScenes has broader community adoption and simpler integration. OpenOccupancy's human-refined labels may yield better supervision quality despite smaller volume.

---

## 4. nuPlan

### 4.1 Overview

nuPlan is the world's first large-scale benchmark specifically for **autonomous vehicle planning**. Created by Motional, it shares sensor infrastructure with nuScenes but focuses on closed-loop planning evaluation.

**Key statistics:**
- 1,300+ hours of driving data
- 15,000+ logs across 4 cities: Las Vegas, Pittsburgh, Boston, Singapore
- Real-world driving scenarios (not simulation)
- Sensor data release ongoing (sensor blobs for mini split available)

### 4.2 Download and Setup

```bash
pip install nuplan-devkit
```

Data is available through the [nuScenes download portal](https://www.nuscenes.org/nuplan). The v1.1 release includes metadata; sensor blobs are being released incrementally (mini split sensor data available as of v1.2+).

### 4.3 Key Features for World Models

- **Closed-loop simulation**: Train planning models, run them in simulation, measure performance with integrated metrics
- **Rich scenario diversity**: 15,000+ logs means extensive coverage of driving behaviors
- **Sensor data interface** (v1.2+): Retrieve camera and LiDAR data programmatically
- **HD maps**: Detailed lane-level maps for all 4 cities

### 4.4 Tutorials

Available in the devkit repository:
- `nuplan_sensor_data_tutorial.ipynb` -- accessing sensor data
- ML planning workflow training
- Scenario visualization
- Custom planner development

### 4.5 Relevance to World Models

nuPlan is complementary to nuScenes for world model research:
- nuScenes provides perception-focused data (dense annotations, multi-modal sensors)
- nuPlan provides planning-focused data (closed-loop evaluation, diverse scenarios, longer drives)
- Together they enable training perception world models on nuScenes and evaluating downstream planning quality via nuPlan's simulation framework

---

## 5. Argoverse 2

### 5.1 Overview

Argoverse 2 is a collection of autonomous driving datasets from Argo AI, covering 6 U.S. cities (Austin, Detroit, Miami, Pittsburgh, Palo Alto, Washington D.C.). It comprises four sub-datasets:

| Dataset | Scale | Size | Primary Task |
|---------|-------|------|-------------|
| **Sensor** | 1,000 annotated scenarios | ~1 TB | 3D object detection/tracking (30 classes) |
| **LiDAR** | 20,000 unannotated sequences | ~5 TB | Self-supervised learning, point cloud forecasting |
| **Motion Forecasting** | 250,000 scenarios | ~58 GB | Trajectory prediction |
| **Map Change** | 1,000 scenarios (200 labeled) | ~1 TB | HD map change detection |

### 5.2 Sensor Configuration

**Vehicle**: Ford Fusion Hybrids with integrated self-driving stack

**LiDAR**:
- 2x Velodyne VLP-32C sensors (32 beams each, 64 beams total when combined)
- Stacked and offset 180 degrees from each other
- 10 Hz sweep frequency, ~200 m range
- Returns provided in **egovehicle frame** (not individual sensor frames)
- ~150 sweeps per 15-second log on average

**Cameras (9 total)**:
- 7 ring cameras: Full 360-degree panoramic coverage at 20 Hz
  - Front-center: 2048 x 1550 (portrait orientation)
  - Others: 1550 x 2048 (landscape orientation)
- 2 front-facing stereo cameras at 20 Hz
- All imagery provided **undistorted**

### 5.3 Data Format

- **Sensor data**: Apache Feather files (`.feather`) for tabular data (annotations, poses, calibration)
- **Point clouds**: In egovehicle frame
- **Images**: Standard image files
- **Annotations**: 3D cuboids with track UUID, category (30 classes), dimensions, quaternion rotation, translation, interior point count
- **HD maps**: Vector format (lane boundaries, markings, traffic direction, crosswalks, driveable area) + raster ground height at 30 cm resolution

### 5.4 Coordinate Systems

- **Egovehicle frame**: Standard autonomous driving convention
- **City (global) frame**: `city_SE3_egovehicle` provides 6-DOF ego-vehicle pose
- **Sensor calibration**: `egovehicle_SE3_sensor` for each sensor

### 5.5 Download Procedure

Data is hosted on **AWS S3** (no AWS account needed):

```bash
# Install s5cmd (fast S3 transfer tool)
conda install s5cmd -c conda-forge

# Download a dataset (e.g., sensor dataset)
s5cmd --no-sign-request cp "s3://argoverse/datasets/av2/sensor/*" /local/path/

# Download motion forecasting
s5cmd --no-sign-request cp "s3://argoverse/datasets/av2/motion-forecasting/*" /local/path/
```

**API installation:**
```bash
pip install av2
# or from source (requires Rust toolchain for SIMD optimizations):
pip install git+https://github.com/argoverse/av2-api#egg=av2
```

**License**: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 (CC BY-NC-SA 4.0).

### 5.6 Relevance to World Models

- **20,000 unannotated LiDAR sequences** (5 TB) are ideal for self-supervised pre-training
- **250,000 motion forecasting scenarios** provide massive trajectory data
- **30 annotation categories** (vs. nuScenes' 23) offer finer object taxonomy
- **Higher camera frame rate** (20 Hz vs. nuScenes 12 Hz) better for video prediction models
- **Dual LiDAR** (64 beams combined) is denser than nuScenes (32 beams) but still less than Waymo TOP (64 beams alone)

---

## 6. KITTI

### 6.1 Overview

KITTI (Karlsruhe Institute of Technology and Toyota Technological Institute) is the foundational autonomous driving benchmark. While smaller and older than nuScenes/Waymo, it remains important for baseline comparison and backward compatibility.

### 6.2 Sensor Configuration

**Vehicle**: Modified Volkswagen Passat B6

| Sensor | Model | Specs |
|--------|-------|-------|
| LiDAR | Velodyne HDL-64E | 64 beams, ~100,000 pts/rotation, 10 Hz |
| Grayscale cameras (2x) | Point Grey Flea 2 (FL2-14S3M-C) | 1.4 MP, 1382 x 512 (cropped) |
| Color cameras (2x) | Point Grey Flea 2 (FL2-14S3C-C) | 1.4 MP, 1382 x 512 (cropped) |
| Lenses (4x) | Edmund Optics NT59-917 | 4-8 mm varifocal |
| GPS/IMU | OXTS RT 3003 | High-precision INS |

- Frame rate: 10 Hz (synchronized across all sensors)
- Shutter: Max 2 ms, dynamically adjusted
- Coverage: Forward-facing only (not 360-degree)

### 6.3 Coordinate System

KITTI uses a **different convention** from nuScenes and Waymo:

| Frame | X | Y | Z |
|-------|---|---|---|
| **Camera frame** | Right | Down | Forward |
| **LiDAR (Velodyne) frame** | Forward | Left | Up |

This means KITTI camera convention is fundamentally different from nuScenes/Waymo, requiring careful rotation when converting.

### 6.4 Data Format

- **Point clouds**: Binary float32 files (`.bin`), 4 channels: `(x, y, z, reflectance)`
- **Images**: PNG files
- **Annotations**: Text files with KITTI-format labels: `type truncated occluded alpha bbox_2d(4) dimensions(3) location(3) rotation_y`
- **Calibration**: Per-sequence files with camera intrinsics, camera-to-velodyne, and camera-to-GPS/IMU transforms

### 6.5 Available Benchmarks

Stereo, optical flow, scene flow, depth completion/prediction, visual odometry, 3D object detection/tracking, road/lane detection, semantic/instance segmentation, multi-object tracking (MOTS).

### 6.6 Relevance to World Models

- **Baseline comparison**: Many world model papers report KITTI results for backward compatibility
- **64-beam LiDAR** provides denser single-sweep point clouds than nuScenes (but less than Waymo's multi-LiDAR setup)
- **Forward-facing only**: Not suitable as primary training data for 360-degree world models
- **Small scale**: Limited diversity compared to modern datasets
- **Different coordinate convention**: Requires explicit handling when combining with nuScenes/Waymo data

---

## 7. Cross-Dataset Comparison for World Model Pre-Training

### 7.1 Sensor Comparison Matrix

| Feature | nuScenes | Waymo | Argoverse 2 | KITTI |
|---------|----------|-------|-------------|-------|
| LiDAR beams | 32 | 64 (TOP) + 4 short-range | 64 (2x32) | 64 |
| LiDAR pts/frame | ~34k | ~180k (TOP only) | ~107k | ~100k |
| Cameras | 6 (360 deg) | 5-8 | 9 (360 deg) | 4 (forward) |
| Camera resolution | 1600x900 | ~1920x1280 | 2048x1550 | 1382x512 |
| Camera FPS | 12 Hz | 10 Hz | 20 Hz | 10 Hz |
| Radars | 5 | 0 | 0 | 0 |
| LiDAR FPS | 20 Hz | 10 Hz | 10 Hz | 10 Hz |
| Coverage | 360 deg | 360 deg | 360 deg | Forward |

### 7.2 Dataset Scale Comparison

| Feature | nuScenes | Waymo Perception | Waymo Motion | Argoverse 2 Sensor | KITTI |
|---------|----------|-----------------|--------------|-------------------|-------|
| Scenes | 1,000 | 1,150 | 103,354 | 1,000 | ~50 |
| Duration/scene | 20s | 20s | 20s | 15-45s | varies |
| Total hours | ~5.5 | ~6.4 | ~574 | ~4-12 | ~1.5 |
| Annotated frames | 40k | ~230k | N/A (trajectories) | ~150k | ~15k |
| 3D box annotations | ~1.4M | ~12M | trajectories | ~75/frame avg | ~200k |
| Object classes | 23 | 4 | 4 | 30 | 8 |
| Download size | ~300 GB | ~1.5 TB | ~300 GB | ~1 TB | ~180 GB |
| Locations | Boston, Singapore | U.S. cities | 6 U.S. cities | 6 U.S. cities | Karlsruhe |

### 7.3 Coordinate System Summary

| Dataset | Vehicle Frame | Convention | Rotation Format |
|---------|--------------|-----------|-----------------|
| nuScenes | X-fwd, Y-left, Z-up | RH | Quaternion (w,x,y,z) |
| Waymo | X-fwd, Y-left, Z-up | RH | 4x4 matrix |
| Argoverse 2 | X-fwd, Y-left, Z-up | RH | Quaternion |
| KITTI (LiDAR) | X-fwd, Y-left, Z-up | RH | Rotation matrix |
| KITTI (Camera) | X-right, Y-down, Z-fwd | RH | Rotation matrix |

**Good news**: The vehicle/LiDAR frames across nuScenes, Waymo, and Argoverse 2 all use the same X-forward, Y-left, Z-up convention. The main conversion work is in handling different rotation representations and global frame definitions.

### 7.4 Occupancy Label Availability

| Dataset | Occ3D | OpenOccupancy | Native Occ |
|---------|-------|---------------|-----------|
| nuScenes | Yes (0.4m) | Yes (0.2m) | No |
| Waymo | Yes (0.05m) | No | No |
| Argoverse 2 | No | No | 4D Occ Forecasting task |
| KITTI | No (some third-party) | No | No |

### 7.5 Strategy for Airside World Model Pre-Training

#### Why pre-train on public road datasets?

Airside environments (taxiways, aprons, runways) share structural similarities with road driving:
- Vehicles navigating defined pathways
- Pedestrian/worker interactions
- Static infrastructure (buildings, signs, markings)
- Weather and lighting variation

However, key differences exist:
- Different vehicle types (aircraft, GSE, tugs)
- Non-standard road geometry (wide aprons, no lane markings in many areas)
- Different speed profiles and dynamics
- Unique objects (jetbridges, fuel trucks, baggage carts)

#### Recommended pre-training approach

1. **Primary pre-training dataset: nuScenes + Occ3D-nuScenes**
   - Best community tooling and devkit support
   - 360-degree sensor coverage matches airside needs
   - Occupancy labels enable volumetric scene understanding
   - Radar data is unique to nuScenes -- useful for airside all-weather operation
   - Manageable download size (~300 GB)

2. **Scale up with Waymo perception data**
   - 6x more annotated frames than nuScenes
   - Denser LiDAR provides richer geometric supervision
   - Occ3D-Waymo has 10x finer voxel resolution
   - Larger investment in download/storage (~1.5 TB)

3. **Self-supervised pre-training with Argoverse 2 LiDAR dataset**
   - 20,000 unannotated sequences (5 TB) for contrastive/masked pre-training
   - No annotation labels needed for self-supervised approaches
   - Large-scale point cloud forecasting pre-training

4. **Motion/planning with Waymo Motion + nuPlan**
   - 103k+ scenarios for trajectory prediction pre-training
   - nuPlan for closed-loop planning evaluation
   - Transfer learned motion priors to airside vehicle planning

5. **Baseline validation with KITTI**
   - Compare pre-trained model quality against published baselines
   - Verify that fine-tuning pipeline works on a well-understood dataset

#### Practical pre-training pipeline

```
Phase 1: Self-supervised pre-training
  - Argoverse 2 LiDAR (20k sequences, unlabeled)
  - Masked autoencoding / point cloud prediction
  - Learn general 3D scene representations

Phase 2: Supervised perception pre-training
  - nuScenes + Occ3D labels (occupancy prediction)
  - Waymo perception (3D detection, tracking)
  - Learn object-level and volumetric understanding

Phase 3: Planning/forecasting pre-training
  - Waymo Motion (103k scenarios)
  - nuPlan (1,300 hours)
  - Learn motion priors and planning policies

Phase 4: Airside fine-tuning
  - Custom airside dataset (your sensor data)
  - Domain adaptation from road -> airside
  - Fine-tune all components with airside-specific classes
```

#### Key considerations for domain transfer

- **Point cloud density mismatch**: If your airside LiDAR differs from training data (e.g., different beam count), use density-invariant architectures or normalize point density during pre-processing.
- **Object size statistics**: Airside vehicles (aircraft, GSE) have very different size distributions than road vehicles. The statistical normalization approach from cross-dataset adaptation research (computing per-dataset size statistics and rescaling) is directly applicable.
- **Coordinate system alignment**: Standardize on X-forward, Y-left, Z-up (shared by nuScenes/Waymo/Argoverse) for your airside data to minimize conversion overhead.
- **Annotation taxonomy mapping**: Design your airside category hierarchy to be compatible with nuScenes-style hierarchical naming (e.g., `vehicle.aircraft`, `vehicle.gse.tug`).
- **Temporal resolution**: nuScenes keyframes at 2 Hz may be too slow for world models; use sweep data (12-20 Hz) or prefer Waymo/Argoverse (10-20 Hz native).

---

## Appendix A: Quick Reference -- Installation Commands

```bash
# nuScenes devkit
pip install nuscenes-devkit

# Waymo Open Dataset (v1 TFRecord tools)
pip install waymo-open-dataset-tf-2-12-0

# Waymo v2 (Parquet format)
pip install gcsfs waymo-open-dataset-tf-2-12-0

# Argoverse 2
pip install av2
# or with conda:
# bash conda/install.sh && conda activate av2

# mmdetection3d (unified framework for all datasets)
pip install openmim
mim install mmengine mmcv mmdet mmdet3d

# nuPlan
pip install nuplan-devkit
```

## Appendix B: Quick Reference -- Download Commands

```bash
# nuScenes: register at nuscenes.org, download via browser or provided links

# Waymo v1 TFRecords:
gsutil -m cp -r gs://waymo_open_dataset_v_1_4_3/ ./waymo/

# Waymo v2 Parquet:
gsutil -m cp -r gs://waymo_open_dataset_v_2_0_0/ ./waymo_v2/

# Argoverse 2 (no auth needed):
s5cmd --no-sign-request cp "s3://argoverse/datasets/av2/sensor/*" ./av2/sensor/
s5cmd --no-sign-request cp "s3://argoverse/datasets/av2/lidar/*" ./av2/lidar/
s5cmd --no-sign-request cp "s3://argoverse/datasets/av2/motion-forecasting/*" ./av2/motion/

# Occ3D labels: download from Google Drive links above

# KITTI: register at cvlibs.net/datasets/kitti, download via browser
```

## Appendix C: License Summary

| Dataset | License | Commercial Use |
|---------|---------|---------------|
| nuScenes | CC BY-NC-SA 4.0 | No |
| Waymo | Waymo Dataset License (Non-Commercial) | No |
| Argoverse 2 | CC BY-NC-SA 4.0 | No |
| KITTI | CC BY-NC-SA 3.0 | No |
| nuPlan | nuScenes terms | No |
| Occ3D labels | MIT (labels only) | Yes (labels); underlying data follows source dataset terms |
| OpenOccupancy | Project-specific | Check repository |

**Important**: All major AV datasets restrict commercial use. For commercial airside deployment, you can use these datasets for research and development (pre-training, architecture validation, benchmarking), but production models must be trained on properly licensed or proprietary data.
