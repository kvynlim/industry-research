# Data Engine from ROS Bags

## Practical Pipeline for Building an Airside Driving Dataset

---

## 1. ROS Bag Processing at Scale

### 1.1 Tool Selection

| Tool | Pros | Cons | Recommendation |
|------|------|------|----------------|
| `rosbag` (Python API) | Native ROS, full compatibility | Requires ROS install, slow for large bags | Use for development |
| `rosbags` (standalone) | No ROS dependency, fast | Doesn't handle all compression types | **Use for batch processing** |
| `mcap` | Modern format, indexed, fast random access | Requires conversion from .bag | Convert for ML pipeline |

```bash
# Install rosbags (no ROS needed)
pip install rosbags rosbags-dataframe

# Install mcap tools
pip install mcap mcap-ros1-support
```

### 1.2 Batch Bag Processing

```python
#!/usr/bin/env python3
"""Batch process ROS bags into structured dataset."""

from pathlib import Path
from rosbags.rosbag1 import Reader
from rosbags.serde import deserialize_cdr, ros1_to_cdr
import numpy as np
import json
from concurrent.futures import ProcessPoolExecutor

def index_bag(bag_path: Path) -> dict:
    """Extract metadata from a bag file without reading full data."""
    with Reader(bag_path) as reader:
        info = {
            'path': str(bag_path),
            'duration_sec': (reader.duration) / 1e9,
            'start_time': reader.start_time,
            'end_time': reader.end_time,
            'message_count': reader.message_count,
            'topics': {},
            'size_gb': bag_path.stat().st_size / 1e9,
        }
        for topic, msgtype, count in reader.topics.values():
            info['topics'][topic] = {
                'type': msgtype,
                'count': count,
            }
    return info

def batch_index(bag_dir: Path, output: Path):
    """Index all bags in a directory."""
    bags = list(bag_dir.rglob('*.bag'))
    print(f"Found {len(bags)} bag files")

    with ProcessPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(index_bag, bags))

    # Save index
    with open(output, 'w') as f:
        json.dump(results, f, indent=2, default=str)

    total_hours = sum(r['duration_sec'] for r in results) / 3600
    total_gb = sum(r['size_gb'] for r in results)
    print(f"Total: {total_hours:.1f} hours, {total_gb:.1f} GB")
```

### 1.3 Efficient Large Bag Handling

```python
def stream_pointclouds_from_bag(bag_path: Path, topic: str = '/pointcloud_aggregator/output'):
    """Stream point clouds without loading entire bag into memory."""
    with Reader(bag_path) as reader:
        connections = [c for c in reader.connections if c.topic == topic]
        for connection, timestamp, rawdata in reader.messages(connections=connections):
            msg = deserialize_cdr(ros1_to_cdr(rawdata, connection.msgtype), connection.msgtype)

            # Convert PointCloud2 to numpy array
            points = pointcloud2_to_numpy(msg)  # (N, 4) x,y,z,intensity

            yield timestamp, points

def pointcloud2_to_numpy(msg) -> np.ndarray:
    """Convert ROS PointCloud2 message to numpy array."""
    # Handle RoboSense RSHELIOS/RSBP format
    # Fields: x(float32), y(float32), z(float32), intensity(float32)
    dtype = np.dtype([
        ('x', np.float32),
        ('y', np.float32),
        ('z', np.float32),
        ('intensity', np.float32),
    ])
    points = np.frombuffer(msg.data, dtype=dtype)
    return np.stack([points['x'], points['y'], points['z'], points['intensity']], axis=-1)
```

---

## 2. Scene Extraction Pipeline

### 2.1 Scene Segmentation

```python
def extract_scenes(
    bag_path: Path,
    scene_duration: float = 30.0,  # seconds
    overlap: float = 5.0,          # seconds overlap between scenes
    output_dir: Path = Path('dataset/scenes'),
):
    """Split continuous bag into discrete scenes."""
    scenes = []
    current_scene = {
        'pointclouds': [],
        'poses': [],
        'imu': [],
        'can': [],
        'timestamps': [],
    }

    with Reader(bag_path) as reader:
        scene_start = None

        for connection, timestamp, rawdata in reader.messages():
            t = timestamp / 1e9  # ns to seconds

            if scene_start is None:
                scene_start = t

            # Accumulate data by topic
            if connection.topic == '/pointcloud_aggregator/output':
                msg = deserialize_cdr(ros1_to_cdr(rawdata, connection.msgtype), connection.msgtype)
                current_scene['pointclouds'].append((t, pointcloud2_to_numpy(msg)))
                current_scene['timestamps'].append(t)

            elif connection.topic == '/odom/fused':
                msg = deserialize_cdr(ros1_to_cdr(rawdata, connection.msgtype), connection.msgtype)
                pose = odometry_to_matrix(msg)  # 4x4 SE3
                current_scene['poses'].append((t, pose))

            elif 'imu' in connection.topic:
                msg = deserialize_cdr(ros1_to_cdr(rawdata, connection.msgtype), connection.msgtype)
                current_scene['imu'].append((t, imu_to_array(msg)))

            # Scene boundary check
            if t - scene_start >= scene_duration:
                # Save scene
                scene_id = f"{bag_path.stem}_{len(scenes):04d}"
                save_scene(current_scene, output_dir / scene_id)
                scenes.append(scene_id)

                # Start new scene with overlap
                overlap_start = t - overlap
                current_scene = trim_to_start(current_scene, overlap_start)
                scene_start = overlap_start

    return scenes
```

### 2.2 Synchronized Frame Extraction

```python
def extract_synchronized_frames(
    scene_dir: Path,
    target_hz: float = 10.0,  # Match LiDAR rate
) -> List[Dict]:
    """Extract time-aligned frames from scene data."""
    frames = []
    pc_data = load_pointclouds(scene_dir)
    pose_data = load_poses(scene_dir)

    for pc_time, pointcloud in pc_data:
        # Find nearest pose (interpolate if needed)
        pose = interpolate_pose(pose_data, pc_time)

        # Ego-motion compensate point cloud
        compensated_pc = compensate_ego_motion(pointcloud, pose)

        frame = {
            'timestamp': pc_time,
            'pointcloud': compensated_pc,        # (N, 4) ego-compensated
            'ego_pose': pose,                     # (4, 4) in world frame
            'ego_velocity': compute_velocity(pose_data, pc_time),
        }
        frames.append(frame)

    return frames
```

---

## 3. Dataset Format for ML

### 3.1 nuScenes-Compatible Format (Recommended)

Create your data in nuScenes format so you can use nuScenes-devkit and all tools built for it:

```
airside_dataset/
├── v1.0-trainval/
│   ├── scene.json        # Scene metadata
│   ├── sample.json       # Keyframes (10Hz)
│   ├── sample_data.json  # Sensor data references
│   ├── ego_pose.json     # Vehicle poses
│   ├── calibrated_sensor.json  # Sensor calibration
│   ├── sensor.json       # Sensor definitions
│   ├── instance.json     # Object instances
│   ├── sample_annotation.json  # 3D bounding boxes
│   ├── category.json     # Object categories
│   ├── log.json          # Recording sessions
│   └── map.json          # Map references
├── samples/
│   └── LIDAR_TOP/        # Keyframe point clouds
│       ├── scene001_000.pcd.bin
│       └── ...
├── sweeps/
│   └── LIDAR_TOP/        # Non-keyframe sweeps
└── maps/                 # Pre-built maps (optional)
```

### 3.2 Creating nuScenes-Format Data

```python
import json
import uuid

def create_nuscenes_dataset(scenes: List[Dict], output_dir: Path):
    """Convert extracted scenes to nuScenes format."""

    # Categories for airside
    categories = [
        {'name': 'aircraft', 'description': 'Any aircraft type'},
        {'name': 'baggage_tractor', 'description': 'Tow tractor for baggage carts'},
        {'name': 'belt_loader', 'description': 'Conveyor belt loader'},
        {'name': 'pushback_tug', 'description': 'Aircraft pushback vehicle'},
        {'name': 'ground_crew', 'description': 'Airport ground personnel'},
        {'name': 'ULD', 'description': 'Unit Load Device container'},
        {'name': 'trailer', 'description': 'Baggage/cargo trailer'},
        {'name': 'fuel_truck', 'description': 'Aircraft refueling vehicle'},
        {'name': 'catering_truck', 'description': 'Catering/provisioning vehicle'},
        {'name': 'maintenance_vehicle', 'description': 'Maintenance/support vehicle'},
        {'name': 'fire_truck', 'description': 'Airport fire/rescue vehicle'},
        {'name': 'follow_me_car', 'description': 'Follow-me/marshalling vehicle'},
        {'name': 'FOD', 'description': 'Foreign Object Debris'},
    ]

    # Sensor definition (match your RoboSense setup)
    sensors = [
        {
            'token': str(uuid.uuid4()),
            'channel': 'LIDAR_TOP',  # aggregated multi-LiDAR
            'modality': 'lidar',
        }
    ]

    # For each scene, create sample entries...
    # (full implementation would serialize all nuScenes tables)
```

### 3.3 Efficient Storage: Lance Format

For large-scale ML training, Lance is faster than individual files:

```python
import lance
import pyarrow as pa

def create_lance_dataset(frames: List[Dict], output_path: str):
    """Create Lance dataset for efficient ML training."""
    schema = pa.schema([
        ('timestamp', pa.float64()),
        ('pointcloud', pa.large_binary()),  # serialized numpy array
        ('ego_pose', pa.list_(pa.float64(), 16)),  # flattened 4x4
        ('ego_velocity', pa.list_(pa.float64(), 6)),  # linear + angular
        ('occupancy', pa.large_binary()),  # serialized occupancy grid
        ('scene_id', pa.string()),
    ])

    table = pa.table({
        'timestamp': [f['timestamp'] for f in frames],
        'pointcloud': [f['pointcloud'].tobytes() for f in frames],
        'ego_pose': [f['ego_pose'].flatten().tolist() for f in frames],
        'ego_velocity': [f['ego_velocity'].tolist() for f in frames],
        'occupancy': [f.get('occupancy', b'').tobytes() for f in frames],
        'scene_id': [f['scene_id'] for f in frames],
    }, schema=schema)

    lance.write_dataset(table, output_path)
```

---

## 4. Auto-Labeling Pipeline

### 4.1 LiDAR 3D Detection (OpenPCDet)

```bash
# Setup OpenPCDet
git clone https://github.com/open-mmlab/OpenPCDet.git
cd OpenPCDet
pip install -r requirements.txt
python setup.py develop

# Download nuScenes pretrained CenterPoint
# https://github.com/open-mmlab/OpenPCDet/blob/master/docs/GETTING_STARTED.md

# Run inference on custom point clouds
python tools/demo.py \
    --cfg_file cfgs/nuscenes_models/cbgs_dyn_pp_centerpoint.yaml \
    --ckpt centerpoint_checkpoint.pth \
    --data_path /path/to/airside_pointclouds/ \
    --ext .bin
```

```python
def auto_label_with_centerpoint(pointcloud: np.ndarray, model, threshold: float = 0.3):
    """Run CenterPoint on a point cloud and return detections."""
    # Prepare input
    input_dict = {
        'points': pointcloud,  # (N, 4)
        'frame_id': 0,
    }

    # Run inference
    pred_dicts, _ = model.forward(input_dict)

    # Filter by confidence
    detections = []
    for pred in pred_dicts:
        mask = pred['pred_scores'] > threshold
        for i in range(mask.sum()):
            det = {
                'class': CLASS_NAMES[pred['pred_labels'][mask][i]],
                'score': float(pred['pred_scores'][mask][i]),
                'box_3d': pred['pred_boxes'][mask][i].tolist(),  # x,y,z,dx,dy,dz,heading
            }
            detections.append(det)

    return detections
```

### 4.2 Auto-Labeling Quality Tiers

```python
def tier_auto_labels(detections: List[Dict]) -> Dict[str, List]:
    """Sort auto-labels by confidence for review prioritization."""
    tiers = {
        'high_confidence': [],    # score > 0.8, use directly
        'medium_confidence': [],  # 0.5 < score < 0.8, spot-check
        'low_confidence': [],     # 0.3 < score < 0.5, human review required
    }

    for det in detections:
        if det['score'] > 0.8:
            tiers['high_confidence'].append(det)
        elif det['score'] > 0.5:
            tiers['medium_confidence'].append(det)
        else:
            tiers['low_confidence'].append(det)

    return tiers
```

**Expected quality on airside data with nuScenes-pretrained CenterPoint:**
- **Vehicles (cars, trucks):** High confidence — these are in nuScenes training set
- **Large objects (aircraft):** Medium — detected as "truck" or "barrier" but with wrong class
- **Small objects (FOD):** Low — likely missed
- **People (ground crew):** Medium — detected as "pedestrian" but score may be lower due to hi-vis clothing

**Strategy:** Use the detections as noisy labels. The occupancy world model doesn't need perfect class labels — it just needs to know what's occupied.

---

## 5. Scenario Tagging and Mining

```python
def tag_scenario(scene_frames: List[Dict]) -> Dict[str, any]:
    """Automatically tag a scene with scenario attributes."""
    tags = {}

    # Speed profile
    velocities = [f['ego_velocity'][:3] for f in scene_frames]
    speeds = [np.linalg.norm(v) for v in velocities]
    tags['max_speed_mps'] = max(speeds)
    tags['mean_speed_mps'] = np.mean(speeds)
    tags['has_stop'] = any(s < 0.1 for s in speeds)
    tags['has_reverse'] = any(v[0] < -0.1 for v in velocities)

    # Proximity events
    for frame in scene_frames:
        if 'detections' in frame:
            for det in frame['detections']:
                dist = np.linalg.norm(det['box_3d'][:3])
                if dist < 5.0:
                    tags['close_encounter'] = True
                    tags['min_distance_m'] = min(tags.get('min_distance_m', 999), dist)

    # Point cloud density (weather indicator)
    densities = [f['pointcloud'].shape[0] for f in scene_frames]
    tags['mean_point_count'] = np.mean(densities)
    if np.mean(densities) < 20000:
        tags['possible_adverse_weather'] = True

    # Time of day (from timestamp → UTC → local)
    tags['hour_utc'] = datetime.utcfromtimestamp(scene_frames[0]['timestamp']).hour
    tags['is_night'] = tags['hour_utc'] < 6 or tags['hour_utc'] > 20

    return tags
```

---

## 6. Storage Estimates

### 6.1 Per-Vehicle Data Rates

| Sensor | Raw Rate | Compressed | Notes |
|--------|----------|-----------|-------|
| 4x LiDAR @ 10Hz | ~40 MB/s | ~20 MB/s | LZ4 compression |
| 4x more LiDAR (8 total) | ~80 MB/s | ~40 MB/s | Full ADT3 config |
| IMU @ 500Hz | ~0.1 MB/s | ~0.05 MB/s | Negligible |
| GPS @ 2Hz | ~0.001 MB/s | Negligible | |
| CAN @ 50Hz | ~0.01 MB/s | Negligible | |
| **Total (4 LiDAR)** | **~40 MB/s** | **~20 MB/s** | **~72 GB/hour** |
| **Total (8 LiDAR)** | **~80 MB/s** | **~40 MB/s** | **~144 GB/hour** |

### 6.2 Extracted Dataset Sizes

| Format | Per Frame | Per Hour | Per 100 Hours |
|--------|-----------|----------|---------------|
| Raw bag (compressed) | N/A | 72-144 GB | 7-14 TB |
| Extracted frames (numpy) | ~5 MB | 50 GB | 5 TB |
| Occupancy labels | ~1 MB | 10 GB | 1 TB |
| Lance dataset (optimized) | ~3 MB | 30 GB | 3 TB |

### 6.3 Infrastructure Recommendation

| Phase | Storage Needed | Platform |
|-------|---------------|----------|
| Phase 0 (index existing) | 2-10 TB (existing bags) | Local NAS |
| Phase 1 (extracted dataset) | 5-20 TB | NAS + cloud backup |
| Phase 2 (with synthetic) | 50-100 TB | Cloud (S3/GCS) |
| Phase 3 (fleet scale) | 100-500 TB | Cloud + lifecycle management |

---

## 7. RoboSense-Specific Notes

### 7.1 RSHELIOS and RSBP Point Cloud Format

```python
# rslidar_sdk publishes sensor_msgs/PointCloud2
# Fields for RoboSense:
# - x (float32): forward
# - y (float32): left
# - z (float32): up
# - intensity (float32): 0-255
# - ring (uint16): beam index (0-31 for 32-ch)
# - timestamp (float64): per-point timestamp for motion compensation

# The pointcloud_aggregator already fuses these into base_link frame
# For ML, you typically use only (x, y, z, intensity) — 4 channels
```

### 7.2 Multi-LiDAR Aggregation

Your `aurrigo_pointcloud_aggregator` already handles this. For the data engine, extract the aggregated output (`/pointcloud_aggregator/output`) rather than individual LiDAR topics. This gives you:
- Motion-compensated (deskewed via IMU)
- Transformed to vehicle frame (base_link)
- All sensors fused into single cloud

This is exactly what the BEV encoder expects.

---

## Sources

- [rosbags (standalone)](https://pypi.org/project/rosbags/)
- [mcap format](https://mcap.dev/)
- [OpenPCDet](https://github.com/open-mmlab/OpenPCDet)
- [Lance format](https://lancedb.github.io/lance/)
- [nuScenes devkit](https://github.com/nutonomy/nuscenes-devkit)
- [Foxglove Studio](https://foxglove.dev/)
- [Label Studio](https://labelstud.io/)
- [CVAT](https://github.com/opencv/cvat)
