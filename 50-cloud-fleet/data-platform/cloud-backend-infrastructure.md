# Fleet Data Backend and Cloud Infrastructure for Autonomous GSE

## Table of Contents
1. [Introduction & Motivation](#1-introduction--motivation)
2. [End-to-End Data Architecture](#2-end-to-end-data-architecture)
3. [Vehicle Data Egress](#3-vehicle-data-egress)
4. [Cloud Ingestion Layer](#4-cloud-ingestion-layer)
5. [Data Lake Architecture](#5-data-lake-architecture)
6. [Rosbag Processing Pipeline](#6-rosbag-processing-pipeline)
7. [Streaming Telemetry Pipeline](#7-streaming-telemetry-pipeline)
8. [Orchestration with Apache Airflow](#8-orchestration-with-apache-airflow)
9. [Feature Store for ML Training](#9-feature-store-for-ml-training)
10. [Labeling Pipeline Integration](#10-labeling-pipeline-integration)
11. [Map Construction Data Flow](#11-map-construction-data-flow)
12. [Multi-Airport Data Isolation](#12-multi-airport-data-isolation)
13. [Compute Infrastructure (Kubernetes)](#13-compute-infrastructure-kubernetes)
14. [Cost Modeling](#14-cost-modeling)
15. [Monitoring and Observability](#15-monitoring-and-observability)
16. [Scaling Trajectory](#16-scaling-trajectory)
17. [Implementation Roadmap](#17-implementation-roadmap)
18. [Key Takeaways](#18-key-takeaways)
19. [References](#19-references)

---

## 1. Introduction & Motivation

### 1.1 The Backend Gap

The Aurrigo research repository covers what happens **on the vehicle** (perception, planning, control) and what happens **at the model level** (training, evaluation, deployment). What is missing is the **backend infrastructure** that connects them — the plumbing that moves data from live vehicles to cloud storage, processes it into training-ready datasets, orchestrates ML pipelines, and pushes updated models back to the fleet.

Without documented backend infrastructure, each new airport deployment reinvents:
- How to get rosbags off vehicles
- Where to store them
- How to process them into training data
- How to track which data trained which model
- How to manage costs as data grows

### 1.2 Data Volume Reality

| Source | Per Vehicle Per Day | 20-Vehicle Fleet/Day | 100-Vehicle Fleet/Day |
|---|---|---|---|
| Raw rosbags (all sensors) | 500-800 GB | 10-16 TB | 50-80 TB |
| Triggered events (50 GB budget) | 50 GB | 1 TB | 5 TB |
| Compressed telemetry | 2-5 GB | 40-100 GB | 200-500 GB |
| Map updates (SLAM scans) | 5-10 GB | 100-200 GB | 500 GB-1 TB |
| **Total (triggered + telemetry + map)** | **~60 GB** | **~1.2 TB** | **~6.5 TB** |

**Key insight**: We do NOT upload all raw rosbags. The trigger-based collection strategy (see ../mlops/data-flywheel-airside.md) selects ~50 GB/day per vehicle. Even so, a 100-vehicle fleet generates ~6.5 TB/day of cloud-bound data.

### 1.3 What Existing Docs Cover vs. What This Doc Adds

| Topic | Existing Doc | This Doc Adds |
|---|---|---|
| On-vehicle data collection | `fleet-data-pipeline.md` | Edge buffering, WiFi offload strategy |
| DVC versioning | `fleet-data-pipeline.md` | Integration with data lake, S3 backend |
| Labeling workflows | `../mlops/data-flywheel-airside.md` | Pipeline orchestration, QA gates |
| Auto-labeling | `../mlops/data-flywheel-airside.md` | Kubernetes job scheduling, GPU allocation |
| Model training | `../mlops/data-flywheel-airside.md` | Feature store, experiment tracking |
| OTA deployment | `ota-fleet-management.md` | Artifact registry, CI/CD integration |
| **Cloud architecture** | **Not covered** | **Full stack: ingestion → lake → processing → training → deployment** |

---

## 2. End-to-End Data Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                  FLEET DATA BACKEND ARCHITECTURE                         │
│                                                                          │
│  VEHICLE TIER          EDGE TIER          CLOUD TIER                    │
│  (On-Vehicle)          (Airport)          (AWS/GCP/Azure)               │
│                                                                          │
│  ┌───────────┐    ┌──────────────┐    ┌─────────────────────────────┐  │
│  │ ROS Nodes │    │ Airport Edge │    │ INGESTION LAYER             │  │
│  │ (Sensors, │──→ │ Gateway      │──→ │ ┌──────────┐ ┌──────────┐  │  │
│  │  Planner, │WiFi│ (NAS buffer) │ S3 │ │ S3 Event │ │ Kafka    │  │  │
│  │  Control) │    │              │Sync│ │ Trigger  │ │ Streaming│  │  │
│  └───────────┘    └──────────────┘    │ └────┬─────┘ └────┬─────┘  │  │
│       │                                │      │            │         │  │
│  ┌────┴──────┐                        │ ┌────┴────────────┴──────┐  │  │
│  │ Triggered │    Telemetry            │ │     DATA LAKE          │  │  │
│  │ Rosbag    │    Stream               │ │  ┌─────────────────┐  │  │  │
│  │ Recorder  │    (MQTT/Kafka)         │ │  │ Raw Zone (S3)   │  │  │  │
│  │           │──────────────────────→  │ │  │ (immutable)     │  │  │  │
│  └───────────┘                        │ │  ├─────────────────┤  │  │  │
│                                        │ │  │ Processed Zone  │  │  │  │
│                                        │ │  │ (Parquet/Delta) │  │  │  │
│                                        │ │  ├─────────────────┤  │  │  │
│                                        │ │  │ Curated Zone    │  │  │  │
│                                        │ │  │ (Training-ready)│  │  │  │
│                                        │ │  └─────────────────┘  │  │  │
│                                        │ └───────────┬───────────┘  │  │
│                                        │             │               │  │
│                                        │ ┌───────────┴───────────┐  │  │
│                                        │ │   PROCESSING LAYER    │  │  │
│                                        │ │ ┌───────┐ ┌────────┐  │  │  │
│                                        │ │ │Airflow│ │  K8s   │  │  │  │
│                                        │ │ │ DAGs  │→│ Jobs   │  │  │  │
│                                        │ │ └───────┘ └────────┘  │  │  │
│                                        │ └───────────┬───────────┘  │  │
│                                        │             │               │  │
│                                        │ ┌───────────┴───────────┐  │  │
│                                        │ │   ML TRAINING LAYER   │  │  │
│                                        │ │ ┌────────┐ ┌───────┐  │  │  │
│  ┌───────────┐                        │ │ │Feature │ │MLflow │  │  │  │
│  │ Model     │←── OTA Update ─────────│ │ │Store   │ │Track  │  │  │  │
│  │ Registry  │                        │ │ └────────┘ └───────┘  │  │  │
│  └───────────┘                        │ └────────────────────────┘  │  │
│                                        └─────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Design Principles

1. **Immutable raw data**: Raw rosbags are write-once, never modified. All processing creates new files.
2. **Schema evolution**: Data formats change as sensors/software evolve. Use schema-aware formats (Parquet, Delta Lake).
3. **Reproducibility**: Any model can be retrained from the exact same data. DVC + data lake versioning.
4. **Cost-tiered storage**: Hot (NVMe/SSD) → Warm (HDD/S3 Standard) → Cold (S3 Glacier) → Archive.
5. **Multi-airport isolation**: Each airport's data is logically isolated (compliance, sovereignty).
6. **Fail-open for vehicles**: Backend failure never affects vehicle operations. Vehicles buffer locally.

---

## 3. Vehicle Data Egress

### 3.1 On-Vehicle Storage and Buffering

```python
"""
Vehicle-side data egress manager.
Buffers triggered rosbags and telemetry for upload.
"""

import os
import time
import subprocess
from dataclasses import dataclass
from typing import List
from pathlib import Path


@dataclass
class UploadJob:
    local_path: str
    remote_key: str        # S3 key: s3://fleet-data/{airport}/{vehicle}/{date}/{file}
    priority: int          # 0=critical (safety event), 1=high (edge case), 2=normal, 3=low
    size_bytes: int
    trigger_type: str      # 'safety_event', 'perception_edge_case', 'map_update', 'routine'
    metadata: dict         # vehicle_id, timestamp, gps, scenario_tags


class VehicleDataEgress:
    """
    Manages data upload from vehicle to cloud via airport edge gateway.
    
    Upload strategy:
    1. While operating: stream telemetry (MQTT), buffer rosbags locally
    2. At charging station (WiFi/Ethernet): bulk upload buffered rosbags
    3. Safety events: upload immediately via 5G (highest priority)
    """
    
    # Daily upload budget per vehicle (from ../mlops/data-flywheel-airside.md)
    DAILY_BUDGET_GB = 50
    
    # Upload bandwidth estimates
    BANDWIDTH_5G_MBPS = 50       # Conservative UL over shared 5G
    BANDWIDTH_WIFI_MBPS = 200    # At charging station WiFi/Ethernet
    
    def __init__(self, vehicle_id: str, airport_code: str):
        self.vehicle_id = vehicle_id
        self.airport_code = airport_code
        self.upload_queue: List[UploadJob] = []
        self.local_buffer = Path(f"/data/upload_buffer")
        self.daily_uploaded_bytes = 0
        
    def enqueue_rosbag(self, bag_path: str, trigger_type: str, metadata: dict):
        """Enqueue a triggered rosbag for upload."""
        size = os.path.getsize(bag_path)
        date_str = time.strftime("%Y/%m/%d")
        bag_name = os.path.basename(bag_path)
        
        priority = {
            'safety_event': 0,           # Upload NOW via 5G
            'perception_edge_case': 1,   # Upload at next opportunity
            'map_update': 1,             # Important for fleet mapping
            'routine': 2,                # Upload during charging
            'diagnostic': 3,             # Lowest priority
        }.get(trigger_type, 2)
        
        job = UploadJob(
            local_path=bag_path,
            remote_key=f"s3://fleet-data-raw/{self.airport_code}/{self.vehicle_id}/{date_str}/{bag_name}",
            priority=priority,
            size_bytes=size,
            trigger_type=trigger_type,
            metadata={
                'vehicle_id': self.vehicle_id,
                'airport': self.airport_code,
                'upload_time': time.time(),
                **metadata,
            }
        )
        
        # Insert sorted by priority
        self.upload_queue.append(job)
        self.upload_queue.sort(key=lambda j: j.priority)
    
    def process_upload_queue(self, available_bandwidth_mbps: float):
        """
        Process upload queue based on available bandwidth.
        Called periodically by vehicle data manager.
        """
        if not self.upload_queue:
            return
        
        remaining_budget = (self.DAILY_BUDGET_GB * 1e9) - self.daily_uploaded_bytes
        
        for job in list(self.upload_queue):
            if job.size_bytes > remaining_budget and job.priority > 0:
                continue  # Skip non-critical if over budget
            
            # Safety events always upload regardless of budget
            if job.priority == 0 or job.size_bytes <= remaining_budget:
                success = self._upload_file(job, available_bandwidth_mbps)
                if success:
                    self.upload_queue.remove(job)
                    self.daily_uploaded_bytes += job.size_bytes
                    remaining_budget -= job.size_bytes
    
    def _upload_file(self, job: UploadJob, bandwidth_mbps: float) -> bool:
        """Upload a single file to S3 via aws cli with multipart."""
        estimated_time = (job.size_bytes * 8) / (bandwidth_mbps * 1e6)
        
        cmd = [
            "aws", "s3", "cp", job.local_path, job.remote_key,
            "--metadata", str(job.metadata),
            "--storage-class", "INTELLIGENT_TIERING",
            "--expected-size", str(job.size_bytes),
        ]
        
        try:
            subprocess.run(cmd, timeout=max(300, int(estimated_time * 2)), check=True)
            os.remove(job.local_path)  # Clean local buffer after successful upload
            return True
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError):
            return False  # Will retry on next cycle
```

### 3.2 Upload Timing Strategy

```
Vehicle Daily Timeline:

  06:00  ─── Start operations ─────────────────── 22:00
  │                                                   │
  │  Operating: stream telemetry via MQTT (5G)        │
  │  Buffer triggered rosbags locally (NVMe SSD)      │
  │  Upload safety events immediately (5G, priority 0)│
  │                                                   │
  │  Charging breaks (30-60 min, 2-3x per shift):     │
  │  ├── Connect to depot WiFi/Ethernet               │
  │  ├── Bulk upload buffered rosbags (200 Mbps)      │
  │  ├── 200 Mbps × 30 min = ~45 GB per charge break │
  │  └── Sufficient for daily 50 GB budget            │
  │                                                   │
  22:00 ─── End operations / overnight charging ──── 06:00
  │                                                   │
  │  Overnight: upload remaining bags (Ethernet)      │
  │  Full NVMe flush: any remaining data              │
  │  Download: updated models, maps, configs (OTA)    │
  │                                                   │
```

### 3.3 Airport Edge Gateway

Each airport has an edge gateway (rack-mounted NAS + networking) that acts as a local buffer:

| Component | Specification | Cost |
|---|---|---|
| NAS appliance | Synology RS3621xs+ (16-bay, 96 TB) | $5,000-8,000 |
| 10GbE uplink | To airport 5G core / internet | Included in 5G contract |
| UPS | 1 hour backup for graceful flush | $500-1,000 |
| S3 sync agent | AWS DataSync or MinIO gateway | $0 (software) |

**Function**: Vehicles upload to edge gateway over local WiFi/5G. Gateway syncs to cloud S3 asynchronously. This decouples vehicle upload speed from internet bandwidth.

---

## 4. Cloud Ingestion Layer

### 4.1 S3 Event-Driven Ingestion

```python
"""
AWS Lambda function triggered when new rosbag lands in S3 raw zone.
Registers the bag in the data catalog and triggers processing pipeline.
"""

import json
import boto3
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
catalog_table = dynamodb.Table('fleet-data-catalog')
airflow_client = boto3.client('mwaa')  # Managed Workflows for Apache Airflow


def handler(event, context):
    """S3 PutObject event handler."""
    for record in event['Records']:
        bucket = record['s3']['bucket']['name']
        key = record['s3']['object']['key']
        size = record['s3']['object']['size']
        
        # Parse S3 key: fleet-data-raw/{airport}/{vehicle}/{date}/{filename}
        parts = key.split('/')
        airport = parts[1]
        vehicle_id = parts[2]
        date_str = '/'.join(parts[3:6])  # YYYY/MM/DD
        filename = parts[-1]
        
        # Register in data catalog
        catalog_table.put_item(Item={
            'bag_id': f"{airport}/{vehicle_id}/{filename}",
            'airport': airport,
            'vehicle_id': vehicle_id,
            'date': date_str,
            's3_key': key,
            'size_bytes': size,
            'status': 'raw',
            'ingested_at': datetime.utcnow().isoformat(),
            'processing_status': 'pending',
        })
        
        # Trigger Airflow DAG for rosbag processing
        airflow_client.create_cli_token()
        # Trigger the processing DAG
        trigger_airflow_dag('rosbag_processing', {
            's3_key': key,
            'airport': airport,
            'vehicle_id': vehicle_id,
            'bag_id': f"{airport}/{vehicle_id}/{filename}",
        })
        
    return {'statusCode': 200}
```

### 4.2 Streaming Telemetry Ingestion

For real-time vehicle telemetry (health, position, status), use a streaming pipeline:

```
Vehicle MQTT → Amazon IoT Core → Kinesis Data Streams → Lambda → TimeStream DB
     │                                                              │
     │              Alternative: Kafka (self-managed)               │
     │                                                              │
     └── Topics:                                        ┌───────────┘
         /fleet/{vehicle_id}/telemetry/position         │
         /fleet/{vehicle_id}/telemetry/health           │
         /fleet/{vehicle_id}/telemetry/perception       │ Real-time dashboards
         /fleet/{vehicle_id}/events/safety              │ (Grafana)
         /fleet/{vehicle_id}/events/edge_case           │
                                                        ↓
                                                   Fleet monitoring
                                                   dashboard
```

| Pipeline | Latency | Throughput | Cost (100 vehicles) | Use Case |
|---|---|---|---|---|
| MQTT → IoT Core → TimeStream | 100-500 ms | 10K msgs/s | $200-500/month | Position, health telemetry |
| MQTT → Kafka → ClickHouse | 50-200 ms | 100K+ msgs/s | $500-1000/month | Perception metrics, detailed logs |
| S3 event → Lambda → DynamoDB | 1-5 s | Unlimited (async) | $50-200/month | Rosbag registration, batch triggers |

---

## 5. Data Lake Architecture

### 5.1 Three-Zone Design

```
┌───────────────────────────────────────────────────────────┐
│                      DATA LAKE                             │
│                                                           │
│  ┌───────────────────────────────────────────────────┐   │
│  │  RAW ZONE (Bronze)                                 │   │
│  │  s3://fleet-data-raw/{airport}/{vehicle}/{date}/   │   │
│  │                                                    │   │
│  │  Format: Original rosbags (.bag, .mcap)            │   │
│  │  Immutable: NEVER modified or deleted              │   │
│  │  Retention: 90 days hot, 1 year warm, then Glacier │   │
│  │  Access: Processing pipelines only (read-only)     │   │
│  │  Size: ~6.5 TB/day (100 vehicles × 50 GB budget)  │   │
│  └───────────────────────────────────────────────────┘   │
│            │                                              │
│            ↓ (Airflow processing DAGs)                    │
│  ┌───────────────────────────────────────────────────┐   │
│  │  PROCESSED ZONE (Silver)                           │   │
│  │  s3://fleet-data-processed/{airport}/{date}/       │   │
│  │                                                    │   │
│  │  Format: Apache Parquet + Delta Lake tables        │   │
│  │  Contents:                                         │   │
│  │   - Extracted LiDAR frames (.npz)                  │   │
│  │   - Extracted camera frames (.jpg)                 │   │
│  │   - Vehicle state timeseries (Parquet)             │   │
│  │   - Detection outputs per frame (Parquet)          │   │
│  │   - Metadata & scenario tags (Parquet)             │   │
│  │  Schema: Delta Lake (supports schema evolution)    │   │
│  │  Retention: 1 year hot, 3 years warm               │   │
│  │  Size: ~30% of raw (deduplication, compression)    │   │
│  └───────────────────────────────────────────────────┘   │
│            │                                              │
│            ↓ (Labeling + QA + feature extraction)         │
│  ┌───────────────────────────────────────────────────┐   │
│  │  CURATED ZONE (Gold)                               │   │
│  │  s3://fleet-data-curated/{dataset_version}/        │   │
│  │                                                    │   │
│  │  Format: Training-ready datasets (DVC-versioned)   │   │
│  │  Contents:                                         │   │
│  │   - Labeled LiDAR frames + 3D annotations          │   │
│  │   - Labeled images + 2D/3D annotations             │   │
│  │   - Feature vectors (pre-computed embeddings)      │   │
│  │   - Train/val/test splits (stratified by airport)  │   │
│  │  Versioning: DVC + Delta Lake snapshots            │   │
│  │  Retention: Permanent (all versions)               │   │
│  │  Size: ~10% of processed (labeled subset)          │   │
│  └───────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────┘
```

### 5.2 Storage Tiering and Cost

| Tier | Storage Class | Access Pattern | Cost/TB/Month | Use |
|---|---|---|---|---|
| Hot | S3 Standard / NVMe | Frequent read/write | $23 | Active processing, recent bags |
| Warm | S3 Infrequent Access | Weekly access | $12.50 | Processed data, 30-365 days old |
| Cold | S3 Glacier Instant | Monthly access | $4 | Archived data, 1-3 years |
| Archive | S3 Glacier Deep | Yearly / compliance | $1 | Safety events (permanent), regulatory |

### 5.3 Cost Projection

| Fleet Size | Raw Ingest/Day | Monthly Raw Storage | Monthly Cost (Tiered) |
|---|---|---|---|
| 20 vehicles | 1 TB | 30 TB (accumulating) | $800-1,500 |
| 50 vehicles | 3.2 TB | 96 TB | $2,500-4,500 |
| 100 vehicles | 6.5 TB | 195 TB | $5,000-9,000 |
| 200 vehicles | 13 TB | 390 TB | $9,000-16,000 |

**After 1 year with 100 vehicles**: ~2.4 PB total, tiered down to ~$8,000/month through automatic lifecycle rules.

### 5.4 Data Catalog (Apache Iceberg / Delta Lake)

```sql
-- Delta Lake table for the processed zone data catalog
-- Queryable via Spark, Trino, or AWS Athena

CREATE TABLE fleet_data.processed_frames (
    frame_id          STRING,         -- unique: {airport}_{vehicle}_{timestamp}
    airport_code      STRING,         -- ICAO code (e.g., 'EGLL')
    vehicle_id        STRING,         -- e.g., 'adt3-007'
    timestamp         TIMESTAMP,
    
    -- Sensor data paths (S3 keys)
    lidar_path        STRING,         -- s3://.../{frame_id}_lidar.npz
    camera_paths      ARRAY<STRING>,  -- [front, left, right, rear]
    radar_path        STRING,
    thermal_path      STRING,
    
    -- Vehicle state
    position_lat      DOUBLE,
    position_lon      DOUBLE,
    heading_deg       DOUBLE,
    speed_mps         DOUBLE,
    
    -- Metadata
    trigger_type      STRING,         -- safety_event, edge_case, routine, map_update
    scenario_tags     ARRAY<STRING>,  -- ['near_aircraft', 'night', 'rain', 'docking']
    weather_code      STRING,         -- from METAR
    lighting          STRING,         -- day, twilight, night
    
    -- Processing status
    labeled           BOOLEAN,
    label_source      STRING,         -- 'manual', 'auto_sam', 'auto_grounding_dino'
    label_quality     FLOAT,          -- QA score 0-1
    
    -- Partitioning
    year              INT,
    month             INT,
    day               INT
)
USING DELTA
PARTITIONED BY (airport_code, year, month)
LOCATION 's3://fleet-data-processed/delta/frames/'
```

---

## 6. Rosbag Processing Pipeline

### 6.1 Processing Stages

```
Raw Rosbag → Extract → Validate → Transform → Enrich → Store
    │            │          │           │          │        │
    │            │          │           │          │        └─ Processed Zone (S3)
    │            │          │           │          │
    │            │          │           │          └─ Add metadata: weather,
    │            │          │           │             scenario tags, vehicle state
    │            │          │           │
    │            │          │           └─ Coordinate transforms, ego-motion
    │            │          │              compensation, point cloud merging
    │            │          │
    │            │          └─ Integrity check: correct topics, timestamps
    │            │             monotonic, no corruption, sensor count matches
    │            │
    │            └─ Decompress, extract individual frames per topic:
    │               /rslidar_points → .npz (compressed point cloud)
    │               /camera/*/image_raw → .jpg (JPEG compressed)
    │               /imu/data_raw → Parquet timeseries
    │               /tf → Parquet (transforms)
    │
    └─ Original .bag file (immutable in raw zone)
```

### 6.2 Rosbag Extraction Job

```python
"""
Kubernetes job: Extract frames from a rosbag into processed zone.
Runs as an Airflow-triggered K8s pod.
"""

import rosbag
import numpy as np
import cv2
import pyarrow as pa
import pyarrow.parquet as pq
import boto3
from sensor_msgs.msg import PointCloud2, Image
from cv_bridge import CvBridge
import point_cloud2 as pc2


class RosbagExtractor:
    """Extract sensor frames from rosbag to structured storage."""
    
    LIDAR_TOPICS = ['/rslidar_points', '/rslidar_points_0', '/rslidar_points_1']
    CAMERA_TOPICS = ['/camera/front/image_raw', '/camera/left/image_raw',
                     '/camera/right/image_raw', '/camera/rear/image_raw']
    IMU_TOPIC = '/imu/data_raw'
    ODOM_TOPIC = '/odometry/filtered'
    TF_TOPIC = '/tf'
    
    def __init__(self, bag_path: str, output_prefix: str):
        self.bag = rosbag.Bag(bag_path, 'r')
        self.output_prefix = output_prefix
        self.s3 = boto3.client('s3')
        self.bridge = CvBridge()
        self.frame_index = []
    
    def extract_all(self):
        """Extract all topics into structured format."""
        info = self.bag.get_type_and_topic_info()
        
        lidar_frames = []
        camera_frames = []
        imu_samples = []
        
        for topic, msg, t in self.bag.read_messages():
            timestamp = t.to_sec()
            
            if topic in self.LIDAR_TOPICS:
                points = self._extract_lidar(msg)
                frame_id = f"{self.output_prefix}/lidar/{timestamp:.6f}"
                self._save_lidar_npz(points, frame_id)
                lidar_frames.append({
                    'timestamp': timestamp,
                    'topic': topic,
                    'num_points': len(points),
                    's3_key': f"{frame_id}.npz",
                })
            
            elif topic in self.CAMERA_TOPICS:
                image = self._extract_camera(msg)
                cam_name = topic.split('/')[2]  # front, left, right, rear
                frame_id = f"{self.output_prefix}/camera/{cam_name}/{timestamp:.6f}"
                self._save_camera_jpg(image, frame_id)
                camera_frames.append({
                    'timestamp': timestamp,
                    'camera': cam_name,
                    's3_key': f"{frame_id}.jpg",
                })
            
            elif topic == self.IMU_TOPIC:
                imu_samples.append({
                    'timestamp': timestamp,
                    'ax': msg.linear_acceleration.x,
                    'ay': msg.linear_acceleration.y,
                    'az': msg.linear_acceleration.z,
                    'wx': msg.angular_velocity.x,
                    'wy': msg.angular_velocity.y,
                    'wz': msg.angular_velocity.z,
                })
        
        # Save IMU as Parquet (efficient columnar storage)
        if imu_samples:
            imu_table = pa.Table.from_pylist(imu_samples)
            self._save_parquet(imu_table, f"{self.output_prefix}/imu/data.parquet")
        
        # Save frame index as Parquet
        index_table = pa.Table.from_pylist(lidar_frames + camera_frames)
        self._save_parquet(index_table, f"{self.output_prefix}/index.parquet")
        
        return len(lidar_frames), len(camera_frames), len(imu_samples)
    
    def _extract_lidar(self, msg):
        """Extract point cloud as numpy array [N, 4] (x, y, z, intensity)."""
        points = np.array(list(pc2.read_points(msg, field_names=('x', 'y', 'z', 'intensity'))))
        return points.astype(np.float32)
    
    def _extract_camera(self, msg):
        """Extract camera image as numpy array."""
        return self.bridge.imgmsg_to_cv2(msg, desired_encoding='bgr8')
    
    def _save_lidar_npz(self, points, key):
        """Save LiDAR frame as compressed numpy."""
        buf = io.BytesIO()
        np.savez_compressed(buf, points=points)
        buf.seek(0)
        self.s3.upload_fileobj(buf, 'fleet-data-processed', f"{key}.npz")
    
    def _save_camera_jpg(self, image, key):
        """Save camera frame as JPEG."""
        _, buf = cv2.imencode('.jpg', image, [cv2.IMWRITE_JPEG_QUALITY, 90])
        self.s3.put_object(Bucket='fleet-data-processed', Key=f"{key}.jpg", Body=buf.tobytes())
    
    def _save_parquet(self, table, key):
        """Save Parquet table to S3."""
        buf = io.BytesIO()
        pq.write_table(table, buf, compression='snappy')
        buf.seek(0)
        self.s3.upload_fileobj(buf, 'fleet-data-processed', key)
```

### 6.3 Processing Performance

| Stage | Time per Bag (10 min recording) | K8s Resources | Cost |
|---|---|---|---|
| Download from S3 | 30-60s (1-5 GB bag) | 1 CPU, 4 GB RAM | $0.01 |
| Extract LiDAR frames | 2-5 min | 2 CPU, 8 GB RAM | $0.02 |
| Extract camera frames | 1-3 min | 2 CPU, 8 GB RAM | $0.01 |
| Extract timeseries | 30s | 1 CPU, 4 GB RAM | $0.005 |
| Upload processed | 1-2 min | 1 CPU, 4 GB RAM | $0.01 |
| **Total per bag** | **5-12 min** | **4 CPU, 16 GB peak** | **~$0.05** |
| **Daily (100 vehicles, ~1000 bags)** | | **50-100 CPU-hours** | **~$50/day** |

---

## 7. Streaming Telemetry Pipeline

### 7.1 Real-Time Vehicle Telemetry

```python
"""
Vehicle-side telemetry publisher.
Streams key metrics via MQTT to fleet monitoring.
"""

import json
import time
import paho.mqtt.client as mqtt


class TelemetryPublisher:
    """Publish real-time vehicle telemetry via MQTT."""
    
    TELEMETRY_RATE_HZ = 1  # 1 Hz telemetry (position, health)
    PERCEPTION_RATE_HZ = 0.2  # 5s perception summary
    
    def __init__(self, vehicle_id: str, mqtt_broker: str):
        self.vehicle_id = vehicle_id
        self.client = mqtt.Client(client_id=f"vehicle-{vehicle_id}")
        self.client.tls_set()  # Mutual TLS for airport security
        self.client.connect(mqtt_broker, 8883)
        self.client.loop_start()
    
    def publish_position(self, lat, lon, heading, speed, mode):
        """1 Hz position and status update."""
        self.client.publish(
            f"fleet/{self.vehicle_id}/telemetry/position",
            json.dumps({
                'ts': time.time(),
                'lat': lat, 'lon': lon,
                'heading': heading, 'speed': speed,
                'mode': mode,  # autonomous, teleop, manual, charging
                'mission_id': self.current_mission_id,
            }),
            qos=1
        )
    
    def publish_health(self, health_summary: dict):
        """1 Hz health summary."""
        self.client.publish(
            f"fleet/{self.vehicle_id}/telemetry/health",
            json.dumps({
                'ts': time.time(),
                'vehicle_health_index': health_summary['overall'],
                'lidar_health': health_summary['lidar'],
                'compute_temp_c': health_summary['gpu_temp'],
                'battery_soc': health_summary['battery_soc'],
                'network_rssi': health_summary['rssi'],
            }),
            qos=1
        )
    
    def publish_perception_summary(self, detections: list):
        """Every 5s: perception summary for fleet monitoring."""
        self.client.publish(
            f"fleet/{self.vehicle_id}/telemetry/perception",
            json.dumps({
                'ts': time.time(),
                'num_detections': len(detections),
                'nearest_object_m': min((d['range'] for d in detections), default=999),
                'aircraft_detected': any(d['class'] == 'aircraft' for d in detections),
                'personnel_detected': any(d['class'] == 'person' for d in detections),
            }),
            qos=0  # Best-effort for non-critical summary
        )
```

### 7.2 Fleet Monitoring Dashboard

```
Grafana Dashboard: Fleet Operations

┌────────────────────────────────────────────────────────────┐
│ Airport: EGLL (Heathrow)    Active: 18/20 vehicles        │
│ Date: 2026-04-11            Missions: 47 completed today  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Map View (OpenStreetMap + vehicle positions)              │
│  ┌──────────────────────────────────────────┐             │
│  │    ○ ADT3-001 (autonomous, 15 km/h)      │             │
│  │        ○ ADT3-003 (docking, stand 24)    │             │
│  │  ■ ADT3-007 (charging, 78% SoC)         │             │
│  │            ○ ADT3-012 (taxiway B)        │             │
│  └──────────────────────────────────────────┘             │
│                                                            │
│  Fleet Health       │  Data Pipeline Status                │
│  ████████████ 95%   │  Bags uploaded today: 847           │
│  LiDAR: 97%         │  Bags processing: 23                │
│  Compute: 99%       │  Labels pending: 156                │
│  Battery avg: 62%   │  Model retrain trigger: 2,847/5,000│
│                     │  Storage used: 4.2 TB / 100 TB      │
└────────────────────────────────────────────────────────────┘
```

Data sources:
- **Vehicle positions**: TimeStream DB (MQTT → IoT Core → TimeStream)
- **Health metrics**: TimeStream DB (same pipeline)
- **Data pipeline**: Airflow API + S3 metrics
- **Storage**: CloudWatch S3 metrics

---

## 8. Orchestration with Apache Airflow

### 8.1 DAG Architecture

```
┌─────────────────────────────────────────────────────────┐
│              AIRFLOW DAG CATALOG                         │
│                                                         │
│  1. rosbag_processing (event-triggered)                 │
│     S3 event → extract → validate → transform → store   │
│                                                         │
│  2. auto_labeling (daily batch)                         │
│     Select unlabeled → SAM+CLIP → QA filter → store     │
│                                                         │
│  3. map_update (daily)                                  │
│     Collect SLAM scans → align → merge → diff → deploy  │
│                                                         │
│  4. model_retraining (triggered: 5K new frames)         │
│     Build dataset → train → evaluate → register → OTA   │
│                                                         │
│  5. fleet_analytics (daily)                             │
│     Aggregate telemetry → reports → dashboards          │
│                                                         │
│  6. data_lifecycle (weekly)                             │
│     Tier old data → archive safety events → cleanup     │
│                                                         │
│  7. calibration_check (weekly per vehicle)              │
│     Extract calibration frames → compute drift → alert  │
└─────────────────────────────────────────────────────────┘
```

### 8.2 Rosbag Processing DAG

```python
"""
Airflow DAG: Process incoming rosbags from fleet vehicles.
Triggered by S3 event via Lambda → Airflow API.
"""

from airflow import DAG
from airflow.providers.cncf.kubernetes.operators.pod import KubernetesPodOperator
from airflow.operators.python import PythonOperator
from airflow.utils.dates import days_ago
from datetime import timedelta


default_args = {
    'owner': 'fleet-ml',
    'retries': 2,
    'retry_delay': timedelta(minutes=5),
    'execution_timeout': timedelta(hours=1),
}

dag = DAG(
    'rosbag_processing',
    default_args=default_args,
    schedule_interval=None,  # Event-triggered only
    start_date=days_ago(1),
    catchup=False,
    tags=['fleet', 'data-pipeline'],
)


# Task 1: Validate rosbag integrity
validate_bag = KubernetesPodOperator(
    task_id='validate_bag',
    name='validate-rosbag',
    namespace='fleet-pipeline',
    image='fleet-ml/rosbag-tools:latest',
    cmds=['python', '-m', 'bag_validator'],
    arguments=['--s3-key', '{{ dag_run.conf["s3_key"] }}'],
    resources={
        'request_cpu': '1',
        'request_memory': '4Gi',
    },
    dag=dag,
)

# Task 2: Extract sensor frames
extract_frames = KubernetesPodOperator(
    task_id='extract_frames',
    name='extract-frames',
    namespace='fleet-pipeline',
    image='fleet-ml/rosbag-tools:latest',
    cmds=['python', '-m', 'frame_extractor'],
    arguments=[
        '--s3-key', '{{ dag_run.conf["s3_key"] }}',
        '--output-prefix', 's3://fleet-data-processed/{{ dag_run.conf["airport"] }}'
                           '/{{ dag_run.conf["vehicle_id"] }}'
                           '/{{ ds }}',
    ],
    resources={
        'request_cpu': '4',
        'request_memory': '16Gi',
        'limit_cpu': '8',
        'limit_memory': '32Gi',
    },
    dag=dag,
)

# Task 3: Run auto-labeling on extracted frames (GPU)
auto_label = KubernetesPodOperator(
    task_id='auto_label',
    name='auto-label',
    namespace='fleet-pipeline',
    image='fleet-ml/auto-labeler:latest',
    cmds=['python', '-m', 'auto_labeler'],
    arguments=[
        '--frames-prefix', 's3://fleet-data-processed/{{ dag_run.conf["airport"] }}'
                           '/{{ dag_run.conf["vehicle_id"] }}'
                           '/{{ ds }}',
        '--model', 'grounding-dino-base',
    ],
    resources={
        'request_cpu': '4',
        'request_memory': '16Gi',
        'limit_memory': '32Gi',
    },
    node_selector={'gpu': 'true'},
    tolerations=[{'key': 'nvidia.com/gpu', 'operator': 'Exists', 'effect': 'NoSchedule'}],
    container_resources={'limits': {'nvidia.com/gpu': '1'}},
    dag=dag,
)

# Task 4: Update data catalog
update_catalog = PythonOperator(
    task_id='update_catalog',
    python_callable=update_delta_catalog,
    op_kwargs={
        'bag_id': '{{ dag_run.conf["bag_id"] }}',
        'status': 'processed',
    },
    dag=dag,
)

# Task 5: Check if retraining trigger met
check_retrain = PythonOperator(
    task_id='check_retrain_trigger',
    python_callable=check_retraining_threshold,
    op_kwargs={'threshold_frames': 5000},
    dag=dag,
)

validate_bag >> extract_frames >> auto_label >> update_catalog >> check_retrain
```

---

## 9. Feature Store for ML Training

### 9.1 Feature Store Architecture

A feature store provides consistent, versioned feature vectors for model training and inference:

```
┌─────────────────────────────────────────────────────────┐
│                    FEATURE STORE                         │
│                                                         │
│  Entity: frame (frame_id = airport_vehicle_timestamp)    │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Offline Store (S3 + Parquet)                     │   │
│  │  - Pre-computed features for training             │   │
│  │  - DINOv2 embeddings per frame (768-dim)          │   │
│  │  - BEV feature maps (100×100×256)                │   │
│  │  - Scenario embeddings (scenario type, weather)   │   │
│  │  - Vehicle state features (speed, heading, mode)  │   │
│  │  Updated: batch (after each bag processing)       │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Online Store (Redis / DynamoDB)                  │   │
│  │  - Latest vehicle state per vehicle_id            │   │
│  │  - Latest perception summary per vehicle_id       │   │
│  │  - Airport-level aggregates (fleet health)        │   │
│  │  Updated: streaming (real-time telemetry)         │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  Tool: Feast (open-source) or AWS SageMaker Feature    │
│        Store or Vertex AI Feature Store                  │
└─────────────────────────────────────────────────────────┘
```

### 9.2 Key Feature Groups

| Feature Group | Entity | Update Frequency | Storage | Size |
|---|---|---|---|---|
| `lidar_frame_features` | frame_id | Batch (hourly) | S3 Parquet | 768-dim embedding |
| `scenario_metadata` | frame_id | Batch (hourly) | S3 Parquet | 50 fields |
| `vehicle_state` | vehicle_id | Streaming (1 Hz) | Redis | 20 fields |
| `airport_weather` | airport_code | Streaming (30 min) | Redis | 15 fields |
| `label_status` | frame_id | Batch (daily) | S3 Parquet | 10 fields |
| `model_predictions` | frame_id | Batch (per-model-run) | S3 Parquet | Variable |

---

## 10. Labeling Pipeline Integration

### 10.1 Multi-Stage Labeling

```
Unlabeled frames → Auto-label (SAM+CLIP) → QA filter → Human review → Curated dataset
       │                    │                   │              │              │
       │                    │                   │              │              └─ Gold zone
       │                    │                   │              └─ Labelbox/CVAT
       │                    │                   └─ Confidence > 0.8: accept
       │                    │                      Confidence 0.5-0.8: human review
       │                    │                      Confidence < 0.5: reject
       │                    └─ Kubernetes GPU job (1 GPU per 1000 frames)
       └─ Selected by active learning (highest uncertainty, safety priority)
```

### 10.2 Cost per Frame

| Method | Cost/Frame | Quality | Speed | GPU Needed |
|---|---|---|---|---|
| Manual (3D LiDAR) | $8-15 | Gold standard | 2-5 min/frame | No |
| Auto-label (SAM+CLIP) | $0.02-0.05 | 70-85% accuracy | 2-5 sec/frame | Yes (1 GPU) |
| Auto + human QA | $1.50-3.00 | 95%+ accuracy | 30-60 sec/frame | Yes + human |
| Pre-label + human correct | $3-6 | 98%+ accuracy | 1-2 min/frame | Yes + human |

**Target**: Auto-label 80% of frames, human review 20% → blended cost **$1.50-3.00/frame**.

---

## 11. Map Construction Data Flow

### 11.1 Fleet-to-Map Pipeline

This section describes how fleet data flows into the map construction pipeline (detailed in `map-construction-pipeline.md`):

```
Vehicle SLAM scans → Upload (map_update trigger) → Map processing pipeline
       │                        │                           │
       │                        │                    ┌──────┴──────┐
       │                        │                    │  Aggregate   │
       │                        │                    │  SLAM scans  │
       │                        │                    │  across fleet │
       │                        │                    └──────┬──────┘
       │                        │                           │
       │                        │                    ┌──────┴──────┐
       │                        │                    │  ICP global  │
       │                        │                    │  alignment   │
       │                        │                    └──────┬──────┘
       │                        │                           │
       │                        │                    ┌──────┴──────┐
       │                        │                    │  Change      │
       │                        │                    │  detection   │
       │                        │                    └──────┬──────┘
       │                        │                           │
       │                        │                    ┌──────┴──────┐
       │                        │                    │  Lanelet2    │
       │                        │                    │  update      │
       │                        │                    └──────┬──────┘
       │                        │                           │
       │                        │                    OTA map deployment
       │                        │                    to fleet
```

### 11.2 Map Data Budget

| Data Type | Per Scan | Per Vehicle/Day | Fleet/Day (20 vehicles) |
|---|---|---|---|
| Raw SLAM scan | 50-100 MB | 1-5 GB (periodic) | 20-100 GB |
| Compressed trajectory | 1-5 MB | 10-50 MB | 200 MB - 1 GB |
| Feature descriptors (place recognition) | 5-10 MB | 50-100 MB | 1-2 GB |
| Change detection deltas | 0.5-2 MB | 5-20 MB | 100-400 MB |

---

## 12. Multi-Airport Data Isolation

### 12.1 Data Sovereignty Requirements

| Requirement | Source | Implementation |
|---|---|---|
| Airport data stays in country | National aviation authority | S3 buckets in regional AWS/GCP regions |
| Airline data isolated | Ground handling contracts | IAM policies per airline tenant |
| No cross-airport data leakage | Privacy regulations (GDPR) | Separate S3 prefixes + bucket policies |
| Audit trail | ISO 27001, SOC 2 | CloudTrail logging, immutable audit logs |

### 12.2 Multi-Tenant Architecture

```
s3://fleet-data-raw/
├── EGLL/                  # Heathrow (EU region: eu-west-2)
│   ├── adt3-001/
│   ├── adt3-002/
│   └── ...
├── KJFK/                  # JFK (US region: us-east-1)
│   ├── adt3-101/
│   └── ...
├── WSSS/                  # Changi (APAC region: ap-southeast-1)
│   ├── adt3-201/
│   └── ...
```

Each airport gets:
- **Dedicated S3 bucket** (or prefix with bucket policy) in the correct AWS region
- **Dedicated processing namespace** in Kubernetes
- **Airport-specific IAM roles** for access control
- **Cross-airport data sharing** only for model training (anonymized, aggregated features)

---

## 13. Compute Infrastructure (Kubernetes)

### 13.1 Cluster Design

```
┌─────────────────────────────────────────────────────────┐
│              KUBERNETES CLUSTER                          │
│                                                         │
│  Node Pool: CPU Processing                              │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                  │
│  │8 CPU │ │8 CPU │ │8 CPU │ │8 CPU │  Auto-scaling    │
│  │32 GB │ │32 GB │ │32 GB │ │32 GB │  2-20 nodes     │
│  └──────┘ └──────┘ └──────┘ └──────┘                  │
│  Workloads: rosbag extraction, data transforms          │
│                                                         │
│  Node Pool: GPU (ML)                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │16 CPU    │ │16 CPU    │ │16 CPU    │ Auto-scaling  │
│  │64 GB     │ │64 GB     │ │64 GB     │ 1-8 nodes    │
│  │1x A10G   │ │1x A10G   │ │1x A10G   │              │
│  └──────────┘ └──────────┘ └──────────┘               │
│  Workloads: auto-labeling, model training, inference    │
│                                                         │
│  Node Pool: GPU (Training)                              │
│  ┌──────────┐ ┌──────────┐                             │
│  │32 CPU    │ │32 CPU    │  Spot instances             │
│  │128 GB   │ │128 GB   │  1-4 nodes                  │
│  │4x A100  │ │4x A100  │  (on-demand for training)   │
│  └──────────┘ └──────────┘                             │
│  Workloads: model retraining, large-scale inference     │
│                                                         │
│  Managed Services:                                      │
│  - EKS (AWS) or GKE (GCP)                              │
│  - Airflow: Amazon MWAA or self-hosted                  │
│  - Storage: S3 + Delta Lake                             │
│  - Monitoring: Prometheus + Grafana                     │
└─────────────────────────────────────────────────────────┘
```

### 13.2 Resource Allocation by Fleet Size

| Fleet Size | CPU Nodes | GPU Nodes (A10G) | GPU Nodes (A100) | Monthly Compute Cost |
|---|---|---|---|---|
| 20 vehicles | 2-4 | 1-2 | 0-1 (spot) | $2,000-5,000 |
| 50 vehicles | 4-8 | 2-4 | 1-2 (spot) | $5,000-12,000 |
| 100 vehicles | 8-16 | 4-8 | 2-4 (spot) | $10,000-25,000 |
| 200 vehicles | 16-32 | 8-16 | 4-8 (spot) | $20,000-50,000 |

---

## 14. Cost Modeling

### 14.1 Total Backend Cost by Fleet Size

| Cost Category | 20 Vehicles | 50 Vehicles | 100 Vehicles |
|---|---|---|---|
| **Storage (S3 tiered)** | $800-1,500 | $2,500-4,500 | $5,000-9,000 |
| **Compute (K8s)** | $2,000-5,000 | $5,000-12,000 | $10,000-25,000 |
| **Data transfer (egress)** | $500-1,000 | $1,500-3,000 | $3,000-6,000 |
| **Managed services** | $500-1,000 | $1,000-2,000 | $2,000-4,000 |
| **Monitoring (Grafana/Prometheus)** | $200-500 | $500-1,000 | $1,000-2,000 |
| **Edge gateways (per airport)** | $6,000-10,000 | $6,000-10,000 | $12,000-20,000 |
| **Total Monthly** | **$4,000-9,000** | **$10,500-22,500** | **$21,000-46,000** |
| **Per Vehicle/Month** | **$200-450** | **$210-450** | **$210-460** |

### 14.2 Cost vs. Benefit

| Benefit | Value per Month (100 vehicles) |
|---|---|
| Automated labeling (vs. manual) | -$50,000-100,000 |
| Continuous model improvement (mAP gains) | Hard to quantify but critical |
| Fleet monitoring (prevent incidents) | -$10,000-50,000 (avoided downtime) |
| Map auto-updates (vs. manual survey) | -$5,000-15,000 |
| **Total benefit** | **$65,000-165,000** |
| **Backend cost** | **$21,000-46,000** |
| **Net benefit** | **$44,000-119,000/month** |

---

## 15. Monitoring and Observability

### 15.1 Key Metrics

| Metric | Source | Alert Threshold | Dashboard |
|---|---|---|---|
| Bags ingested/hour | S3 events | <80% of expected | Data Pipeline |
| Processing backlog | Airflow | >100 bags waiting | Data Pipeline |
| Auto-label throughput | K8s metrics | <1000 frames/hour | ML Pipeline |
| GPU utilization | K8s node metrics | <30% (waste) or >90% (bottleneck) | Infrastructure |
| S3 storage growth rate | CloudWatch | >120% projected | Cost |
| Retraining trigger progress | Delta Lake query | >90% of threshold | ML Pipeline |
| Data catalog freshness | Custom | >24h since last update | Data Quality |

### 15.2 SLA Targets

| Pipeline | SLA | Measurement |
|---|---|---|
| Safety event upload | <5 min from event to S3 | Vehicle → S3 latency |
| Rosbag processing | <2 hours from upload to processed | S3 event → processed zone |
| Auto-labeling | <4 hours from processed to labeled | Processed → curated zone |
| Model retraining | <24 hours from trigger to registered model | Trigger → model registry |
| Map update | <48 hours from SLAM data to deployed map | SLAM upload → fleet OTA |

---

## 16. Scaling Trajectory

### 16.1 Three Phases

| Phase | Fleet Size | Architecture | Monthly Cost | Key Challenge |
|---|---|---|---|---|
| **Pilot** (Year 1) | 5-20 vehicles, 1 airport | Single region, minimal K8s, manual Airflow | $2,000-5,000 | Getting pipeline working end-to-end |
| **Growth** (Year 2-3) | 20-100 vehicles, 2-5 airports | Multi-region S3, auto-scaling K8s, full Airflow | $10,000-30,000 | Multi-airport data isolation, cost management |
| **Scale** (Year 3+) | 100-500 vehicles, 5-20 airports | Federated data lakes, dedicated GPU clusters, ML platform | $30,000-100,000 | Data governance, federated learning, compliance |

### 16.2 Technology Choices by Phase

| Component | Pilot | Growth | Scale |
|---|---|---|---|
| Storage | S3 + manual lifecycle | S3 + Delta Lake + auto-tiering | Multi-region lakehouse |
| Processing | Single K8s namespace | Multi-namespace, auto-scaling | Dedicated clusters per region |
| Orchestration | Cron jobs / simple Airflow | Managed Airflow (MWAA) | Airflow + custom operators |
| Feature store | Parquet files in S3 | Feast (open-source) | SageMaker / Vertex Feature Store |
| Experiment tracking | MLflow (self-hosted) | MLflow (managed) | Full ML platform (Weights & Biases) |
| Monitoring | Grafana + Prometheus | Same + PagerDuty alerts | Full observability stack |

---

## 17. Implementation Roadmap

| Phase | Duration | Cost | Deliverable |
|---|---|---|---|
| **Phase 1: Foundation** | 6 weeks | $20-35K | S3 data lake, rosbag extraction pipeline, basic Airflow DAG |
| **Phase 2: Processing** | 8 weeks | $25-40K | Auto-labeling pipeline, feature store, Delta Lake catalog |
| **Phase 3: Training** | 6 weeks | $15-25K | Model training pipeline, experiment tracking, model registry |
| **Phase 4: Fleet Scale** | 8 weeks | $20-35K | Multi-airport, streaming telemetry, fleet monitoring dashboard |
| **Total** | **28 weeks** | **$80-135K** | Full backend infrastructure for 100+ vehicle fleet |

---

## 18. Key Takeaways

1. **Trigger-based collection keeps data manageable**: 50 GB/day per vehicle (not 500-800 GB raw) makes cloud storage affordable at $200-460/vehicle/month

2. **Three-zone data lake is the backbone**: Raw (immutable rosbags) → Processed (extracted frames, Parquet) → Curated (labeled, versioned, training-ready). Never modify raw data.

3. **Airflow orchestrates everything**: Rosbag processing, auto-labeling, map updates, model retraining, data lifecycle — all as DAGs with dependency management and retry logic

4. **Edge gateway at each airport decouples vehicle from cloud**: Vehicles upload to local NAS at charging stations; NAS syncs to S3 asynchronously. Backend downtime never affects vehicle operations

5. **Auto-labeling at $0.02-0.05/frame enables continuous improvement**: 80% auto-labeled + 20% human QA yields 95%+ quality at $1.50-3.00/frame blended cost (vs. $8-15 fully manual)

6. **Kubernetes auto-scaling matches batch workload**: CPU nodes for rosbag extraction (2-20 nodes), GPU nodes for labeling/training (1-8 A10G), spot A100s for retraining

7. **Feature store provides reproducible ML**: DINOv2 embeddings, scenario metadata, vehicle state — pre-computed and versioned. Any model can be retrained from exact same features

8. **Multi-airport data isolation is mandatory from day one**: Separate S3 prefixes per airport, regional buckets for data sovereignty, IAM policies for airline tenants. Retrofitting isolation is expensive

9. **Streaming telemetry for real-time fleet monitoring**: MQTT → IoT Core → TimeStream → Grafana provides 1 Hz fleet visibility at <$500/month for 100 vehicles

10. **Backend cost scales sub-linearly**: $200-460/vehicle/month regardless of fleet size. The per-vehicle cost barely increases from 20 to 200 vehicles because infrastructure is shared

---

## 19. References

### Cloud Architecture
1. Amazon Web Services, "Data Lake Architecture on AWS," AWS Well-Architected Framework, 2025
2. Databricks, "Delta Lake: The Definitive Guide," O'Reilly Media, 2024
3. Apache Software Foundation, "Apache Airflow Documentation," 2025
4. Apache Software Foundation, "Apache Iceberg Table Format," 2025

### ML Infrastructure
5. Feast Authors, "Feast: Feature Store for Machine Learning," https://feast.dev, 2025
6. MLflow Authors, "MLflow: Platform for the ML Lifecycle," https://mlflow.org, 2025
7. Kubernetes Authors, "Kubernetes Documentation," https://kubernetes.io, 2025
8. NVIDIA, "Triton Inference Server," Developer Documentation, 2025

### Autonomous Vehicle Data Pipelines
9. Wiggers, K., "How Waymo's Data Factory Powers Self-Driving," TechCrunch, 2024
10. Motional, "Data Infrastructure for Autonomous Driving," Engineering Blog, 2024
11. Nuro, "Building ML Infrastructure for Autonomous Delivery," Blog, 2023
12. Scale AI, "Autonomous Vehicle Annotation Best Practices," 2024

### Streaming and Monitoring
13. Eclipse Foundation, "Eclipse Mosquitto MQTT Broker," https://mosquitto.org, 2025
14. Grafana Labs, "Grafana Documentation," 2025
15. Prometheus Authors, "Prometheus Monitoring System," 2025

### Related Repository Documents
- `50-cloud-fleet/data-platform/fleet-data-pipeline.md` — Vehicle-side data collection and DVC versioning
- `50-cloud-fleet/mlops/data-flywheel-airside.md` — Trigger-based collection, active learning, retraining cycle
- `40-runtime-systems/ml-deployment/av-cicd-devops-pipeline.md` — CI/CD for code, models, and fleet deployment
- `50-cloud-fleet/ota/ota-fleet-management.md` — OTA model and map deployment to vehicles
- `50-cloud-fleet/fleet-management/fleet-predictive-maintenance.md` — Maintenance data feeds from this pipeline
- `30-autonomy-stack/localization-mapping/maps/hd-map-change-detection-maintenance.md` — Map update data flow
- `20-av-platform/compute/edge-cloud-hybrid-inference.md` — Edge server architecture (complementary)
