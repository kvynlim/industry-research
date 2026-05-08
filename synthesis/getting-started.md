# Getting Started: Day 1 Guide

## From Research to Running Code — Your First Week

---

## Prerequisites

| Item | Where | Time |
|------|-------|------|
| Access to Aurrigo ROS bags | Your vehicle/server storage | Available now |
| Python 3.8+ with PyTorch 2.0+ | Any dev machine | 30 min setup |
| GPU access (A100 recommended) | Lambda Labs / RunPod / CoreWeave | Sign up in 5 min |
| RTL-SDR ADS-B receiver | Amazon (~$30) | Order now, arrives in 2-3 days |
| This repository | `~/industry-research/` | Available now |

---

## Day 1: Environment + Data Exploration

### 1.1 Set up Python environment

```bash
# Create conda environment
conda create -n airside-wm python=3.10 -y
conda activate airside-wm

# Core ML dependencies
pip install torch==2.1.0 torchvision --index-url https://download.pytorch.org/whl/cu118
pip install einops timm open3d numpy scipy

# ROS bag processing (no ROS install needed)
pip install rosbags rosbags-dataframe

# Visualization
pip install matplotlib rerun-sdk foxglove-schemas
```

### 1.2 Index your bag files

```python
#!/usr/bin/env python3
"""index_bags.py — Catalog all available ROS bags."""

from pathlib import Path
from rosbags.rosbag1 import Reader
import json

def index_bag(path):
    with Reader(path) as reader:
        return {
            'path': str(path),
            'duration_sec': reader.duration / 1e9,
            'size_gb': path.stat().st_size / 1e9,
            'topics': {t: {'type': m, 'count': c}
                       for t, m, c in reader.topics.values()},
        }

# Scan for bags (adjust path)
bags = list(Path('/path/to/your/bags').rglob('*.bag'))
index = [index_bag(b) for b in bags]

total_hours = sum(b['duration_sec'] for b in index) / 3600
total_gb = sum(b['size_gb'] for b in index)
print(f"Found {len(bags)} bags: {total_hours:.1f} hours, {total_gb:.1f} GB")

with open('bag_index.json', 'w') as f:
    json.dump(index, f, indent=2)
```

### 1.3 Extract and visualize a point cloud

```python
"""extract_pointcloud.py — View your first LiDAR frame."""

from rosbags.rosbag1 import Reader
from rosbags.serde import deserialize_cdr, ros1_to_cdr
import numpy as np
import open3d as o3d

bag_path = '/path/to/your/bag.bag'
topic = '/pointcloud_aggregator/output'

with Reader(bag_path) as reader:
    connections = [c for c in reader.connections if c.topic == topic]
    for connection, timestamp, rawdata in reader.messages(connections=connections):
        msg = deserialize_cdr(ros1_to_cdr(rawdata, connection.msgtype), connection.msgtype)

        # Parse PointCloud2 → numpy (x, y, z, intensity)
        dt = np.dtype([('x', '<f4'), ('y', '<f4'), ('z', '<f4'), ('intensity', '<f4')])
        points = np.frombuffer(msg.data, dtype=dt)
        xyz = np.stack([points['x'], points['y'], points['z']], axis=-1)

        # Visualize
        pcd = o3d.geometry.PointCloud()
        pcd.points = o3d.utility.Vector3dVector(xyz)
        o3d.visualization.draw_geometries([pcd])
        break  # just first frame
```

---

## Day 2: Run Pre-trained Detection on Your Data

### 2.1 Set up OpenPCDet

```bash
# Clone and install
git clone https://github.com/open-mmlab/OpenPCDet.git
cd OpenPCDet
pip install spconv-cu118  # match your CUDA
python setup.py develop

# Download nuScenes-pretrained CenterPoint
# Check model zoo: docs/GETTING_STARTED.md
```

### 2.2 Run inference on your point cloud

```python
"""detect_objects.py — Run CenterPoint on airside LiDAR."""

# Convert your extracted point cloud to OpenPCDet format
# Save as .bin file: points.astype(np.float32).tofile('frame.bin')

# Run demo
# python tools/demo.py \
#     --cfg_file cfgs/nuscenes_models/cbgs_dyn_pp_centerpoint.yaml \
#     --ckpt centerpoint_nuscenes.pth \
#     --data_path ./your_pointclouds/ \
#     --ext .bin
```

**Expected results:** Cars/trucks detected well, aircraft detected as "barrier" or "truck" (wrong class but detected), ground crew as "pedestrian" (low confidence).

**This is your auto-labeling baseline.** Correct the labels → fine-tune → iterate.

---

## Day 3: Set Up ADS-B Jet Blast Monitoring (POC 4)

### 3.1 Hardware

```bash
# RTL-SDR + antenna (~$30 from Amazon/AliExpress)
# Install dump1090
sudo apt install rtl-sdr dump1090-mutability
# Or build readsb from source for better performance
```

### 3.2 Start receiving aircraft positions

```bash
# Start dump1090
dump1090 --interactive --net

# In another terminal, read aircraft JSON
curl http://localhost:8080/data/aircraft.json | python -m json.tool
```

### 3.3 Compute jet blast zones

```python
"""jet_blast.py — Compute hazard zones from ADS-B positions."""

import json, math, requests

JET_BLAST_DB = {
    'B738': {'idle_35kt': 28, 'breakaway_35kt': 148},
    'A320': {'idle_35kt': 18, 'breakaway_35kt': 29},
    'B77W': {'idle_35kt': 40, 'breakaway_35kt': 180},
}

def get_aircraft():
    r = requests.get('http://localhost:8080/data/aircraft.json')
    return r.json().get('aircraft', [])

def compute_hazard_zone(ac):
    ac_type = ac.get('t', 'B738')  # ICAO type code
    params = JET_BLAST_DB.get(ac_type, JET_BLAST_DB['B738'])
    lat, lon = ac.get('lat'), ac.get('lon')
    heading = ac.get('track', 0)

    if lat and lon:
        # Zone extends BEHIND the aircraft
        zone_length = params['idle_35kt']  # meters
        zone_heading = (heading + 180) % 360  # behind
        return {
            'type': ac_type,
            'lat': lat, 'lon': lon,
            'heading': zone_heading,
            'length_m': zone_length,
            'status': 'CAUTION',
        }
    return None

# Poll and display
for ac in get_aircraft():
    zone = compute_hazard_zone(ac)
    if zone:
        print(f"{zone['type']} at ({zone['lat']:.4f}, {zone['lon']:.4f}): "
              f"{zone['length_m']}m hazard zone at {zone['heading']}°")
```

---

## Day 4-5: Build Self-Supervised Occupancy (POC 1 Start)

### 4.1 Generate occupancy from accumulated LiDAR

```python
"""generate_occupancy.py — Create occupancy grids from LiDAR bags."""

import numpy as np

def generate_occupancy(pointcloud, voxel_size=0.2,
                       x_range=(-51.2, 51.2), y_range=(-51.2, 51.2),
                       z_range=(-1.0, 5.0)):
    nx = int((x_range[1] - x_range[0]) / voxel_size)  # 512
    ny = int((y_range[1] - y_range[0]) / voxel_size)  # 512
    nz = int((z_range[1] - z_range[0]) / voxel_size)  # 30

    occ = np.zeros((nx, ny, nz), dtype=np.uint8)

    # Voxelize points
    vx = ((pointcloud[:, 0] - x_range[0]) / voxel_size).astype(int)
    vy = ((pointcloud[:, 1] - y_range[0]) / voxel_size).astype(int)
    vz = ((pointcloud[:, 2] - z_range[0]) / voxel_size).astype(int)

    valid = (vx >= 0) & (vx < nx) & (vy >= 0) & (vy < ny) & (vz >= 0) & (vz < nz)
    occ[vx[valid], vy[valid], vz[valid]] = 1

    return occ  # (512, 512, 30) binary occupancy
```

### 4.2 Create training sequences

```python
"""create_sequences.py — Build (past, future) occupancy pairs for training."""

# For each scene, create 8-frame past + 4-frame future sequences
# Past occupancy → model predicts → compare with future occupancy
# This is SELF-SUPERVISED — no labels needed!

sequences = []
for scene in extracted_scenes:
    frames = scene['occupancy_grids']  # list of (512, 512, 30) arrays
    for t in range(8, len(frames) - 4):
        past = np.stack(frames[t-8:t])      # (8, 512, 512, 30)
        future = np.stack(frames[t:t+4])    # (4, 512, 512, 30)
        sequences.append({'past': past, 'future': future})

print(f"Created {len(sequences)} training sequences")
# Save to disk for training
```

---

## Day 6: FOD Detection (POC 5)

```python
"""fod_detection.py — Detect anomalies by map differencing."""

import open3d as o3d
import numpy as np

# Load reference map
ref_map = o3d.io.read_point_cloud('/path/to/your/map.pcd')
ref_tree = o3d.geometry.KDTreeFlann(ref_map)

def detect_fod(current_scan_xyz, threshold=0.3, min_cluster=5, max_height=0.5):
    novel = []
    for pt in current_scan_xyz:
        if pt[2] > max_height:  # skip non-ground objects
            continue
        [_, idx, dist] = ref_tree.search_knn_vector_3d(pt, 1)
        if dist[0] > threshold ** 2:
            novel.append(pt)

    if len(novel) < min_cluster:
        return []

    # Cluster
    novel_pcd = o3d.geometry.PointCloud()
    novel_pcd.points = o3d.utility.Vector3dVector(novel)
    labels = np.array(novel_pcd.cluster_dbscan(eps=0.5, min_points=min_cluster))

    anomalies = []
    for label in set(labels):
        if label == -1:
            continue
        cluster = np.array(novel)[labels == label]
        anomalies.append({
            'centroid': cluster.mean(axis=0).tolist(),
            'size_m': float(np.linalg.norm(cluster.max(0) - cluster.min(0))),
            'points': len(cluster),
        })
    return anomalies

# Run on extracted point cloud
anomalies = detect_fod(current_xyz)
for a in anomalies:
    print(f"FOD detected at {a['centroid']}, size {a['size_m']:.2f}m ({a['points']} pts)")
```

---

## Day 7: Evaluate and Plan Next Steps

### 7.1 What you should have by end of week

| Deliverable | Status Check |
|-------------|-------------|
| Bag inventory (hours, topics, sizes) | `bag_index.json` created |
| Point cloud visualization working | Can view LiDAR frames in Open3D |
| CenterPoint running on your data | Detections (even with wrong classes) |
| ADS-B receiving aircraft positions | dump1090 showing local traffic |
| Jet blast zones computed | Zone lengths for aircraft types |
| Occupancy grids generated | (512, 512, 30) arrays from LiDAR |
| Training sequences created | (past, future) pairs for world model |
| FOD detection prototype | Map differencing finding anomalies |

### 7.2 Week 2 priorities

Based on Week 1 results, choose:

**If detection worked well:** Focus on auto-labeling → fine-tuning → airside-specific detector (POC 2).

**If occupancy generation worked well:** Start training VQ-VAE tokenizer → world model transformer (POC 1).

**If jet blast/FOD worked well:** Integrate as ROS nodes into the Aurrigo stack for immediate value (POC 4, 5).

### 7.3 Where to read more

| Topic | Document |
|-------|----------|
| Full architecture | `synthesis/design-spec.md` |
| All 8 POCs in detail | `synthesis/poc-proposals.md` |
| TRL assessment | `synthesis/technology-readiness.md` |
| Competitive landscape | `synthesis/competitive-landscape.md` |
| BEV encoding details | `30-autonomy-stack/perception/overview/bev-encoding.md` |
| OccWorld implementation | `30-autonomy-stack/world-models/occworld-implementation.md` |
| Data pipeline from bags | `cross-cutting/data-engine-from-bags.md` |
| TensorRT deployment | `20-av-platform/compute/tensorrt-deployment-guide.md` |
| E2E pipeline (detailed) | `30-autonomy-stack/end-to-end-driving/e2e-world-model-pipeline.md` |

---

*This guide distills actionable first steps from 155 research documents. Each code snippet is designed to run on your Aurrigo ROS bag data with minimal modification.*
