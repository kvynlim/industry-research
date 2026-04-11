# Fleet Data Pipeline for Airside Autonomous Vehicle Operations

## End-to-End Data Infrastructure from Vehicle to Training Cluster

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Data Sources and Volumes](#2-data-sources-and-volumes)
3. [On-Vehicle Data Management](#3-on-vehicle-data-management)
4. [Data Transfer and Ingestion](#4-data-transfer-and-ingestion)
5. [Dataset Versioning with DVC](#5-dataset-versioning-with-dvc)
6. [Bag Processing Pipeline](#6-bag-processing-pipeline)
7. [Labeling Workflows](#7-labeling-workflows)
8. [Data Quality and Validation](#8-data-quality-and-validation)
9. [Feature Store and Training Data](#9-feature-store-and-training-data)
10. [Fleet Telemetry and Monitoring](#10-fleet-telemetry-and-monitoring)
11. [Storage and Cost Models](#11-storage-and-cost-models)
12. [Integration with ML Training Pipeline](#12-integration-with-ml-training-pipeline)
13. [Recommended Architecture for Aurrigo](#13-recommended-architecture-for-aurrigo)
14. [References](#14-references)

---

## 1. Introduction

Fleet-scale data infrastructure is the single most important enabler for transitioning an autonomous vehicle program from hand-tuned classical perception to ML-driven continuous improvement. Without a functioning data pipeline, every model improvement is an ad hoc effort: engineers manually copy bags from vehicles, hand-pick training samples, and lose track of what was trained on what. The result is irreproducible experiments, wasted compute, and a perception system that cannot systematically improve from operational experience.

The data flywheel that powers companies like Tesla, Waymo, and comma.ai follows a consistent pattern: vehicles collect data in the field, interesting or problematic scenarios are identified and uploaded, data is processed and labeled, models are trained on the expanded dataset, improved models are deployed back to vehicles, and the cycle repeats. Tesla reported 8.3 billion FSD miles by early 2026, with shadow mode feeding a continuous data engine. Waymo operates 2,500+ robotaxis generating petabytes of driving data. comma.ai leverages its open-source fleet of 10,000+ devices for distributed data collection.

For Aurrigo's airside operations, the data pipeline challenge has unique characteristics:

- **No public airside driving datasets exist.** Every frame of airside data has proprietary value.
- **LiDAR-dominant perception** generates extreme data volumes (200+ GB/day per vehicle).
- **Airport network constraints** complicate data offload (security policies, bandwidth limits).
- **Rare but safety-critical events** (near-misses, FOD encounters, jet blast exposure) must never be lost.
- **Fleet size is growing.** The pipeline that works for 5 vehicles at one airport must scale to 100 vehicles across 10 airports.

This document provides the complete architecture for a fleet data pipeline tailored to Aurrigo's ROS Noetic stack, RoboSense LiDAR sensors, and GTSAM localization system, with concrete cost projections and a phased deployment plan.

---

## 2. Data Sources and Volumes

### 2.1 LiDAR Point Clouds (Dominant Data Source)

Aurrigo vehicles run 4-8 RoboSense sensors (RSHELIOS 32-beam and RSBP 16-beam). Each sensor generates PointCloud2 messages at 10 Hz.

| Sensor Config | Points/Scan | Message Size | Rate | Per-Sensor/Hour | Per-Vehicle/Day (8h) |
|---|---|---|---|---|---|
| RSHELIOS (32-beam) | ~30,000 | ~480 KB | 10 Hz | 17.3 GB | 138 GB |
| RSBP (16-beam) | ~16,000 | ~256 KB | 10 Hz | 9.2 GB | 74 GB |
| Aggregated cloud (4 RSHELIOS + 4 RSBP) | ~184,000 | ~2.9 MB | 10 Hz | 105 GB | — |

**Realistic per-vehicle daily volumes (8-hour operational shift):**

| Configuration | Raw Volume/Day | With LZ4 Compression | With Zstd Compression |
|---|---|---|---|
| 4 RSHELIOS + 4 RSBP (current) | ~210 GB | ~155 GB | ~125 GB |
| 4 RSHELIOS only (minimal) | ~138 GB | ~100 GB | ~83 GB |
| 8 RSHELIOS (future dense config) | ~276 GB | ~200 GB | ~165 GB |

LZ4 achieves approximately 1.3-1.5x compression on point cloud data with near-zero CPU overhead. Zstd at level 3 achieves 1.6-1.8x compression with modest CPU cost. At higher Zstd levels (6-9), compression reaches 2x but decompression slows significantly. For on-vehicle recording where CPU budget is tight, LZ4 is the correct default. For archival, re-compress with Zstd offline.

**Key insight:** Almost 50% of serialized `sensor_msgs::PointCloud2` messages can be padding due to ROS serialization alignment. The `cloudini` library (released 2025) achieves substantially better compression by operating directly on point cloud structure rather than treating the data as a generic byte stream.

### 2.2 Camera Data (If Added)

Aurrigo's current stack is LiDAR-only, but camera addition is under evaluation for VLA integration and thermal personnel detection.

| Camera Type | Resolution | Format | FPS | Per-Camera/Hour | Per-Vehicle/Day (8h, 6 cams) |
|---|---|---|---|---|---|
| RGB (GMSL2) | 1920x1080 | H.265 | 20 | 14 GB | 672 GB |
| RGB (GMSL2) | 1280x720 | H.265 | 20 | 7 GB | 336 GB |
| LWIR Thermal (FLIR Boson 640) | 640x512 | Raw 16-bit | 30 | 34 GB | 270 GB |
| LWIR Thermal (FLIR Boson 640) | 640x512 | H.265 encoded | 30 | 3 GB | 24 GB |

Adding 6 RGB cameras at 720p with H.265 encoding roughly doubles the daily data volume. Adding thermal cameras adds 24-270 GB depending on encoding. The pipeline must be designed to handle camera data from day one even if cameras are not yet installed.

### 2.3 Vehicle Telemetry and CAN Bus

| Data Source | Rate | Size/Message | Daily Volume (8h) |
|---|---|---|---|
| CAN bus (raw frames) | 1000 Hz | 16 bytes | ~460 MB |
| Odometry (`/odom/fused`) | 100 Hz | 408 bytes | ~1.2 GB |
| IMU (`/imu/data`) | 500 Hz | 312 bytes | ~4.5 GB |
| RTK-GPS (`/fix`) | 10 Hz | 296 bytes | ~85 MB |
| Wheel encoders | 100 Hz | 64 bytes | ~185 MB |
| Vehicle state (steering, brake, speed) | 50 Hz | 128 bytes | ~185 MB |
| Diagnostic messages | 1 Hz | ~1 KB | ~29 MB |

**Total telemetry per vehicle per day: ~7 GB** (highly compressible, Zstd achieves 5-10x on structured telemetry).

### 2.4 Event Triggers

Event-triggered data captures full-fidelity sensor snapshots around safety-relevant moments:

| Event Type | Trigger Condition | Pre-Buffer | Post-Buffer | Estimated Frequency |
|---|---|---|---|---|
| Hard brake | Deceleration > 3 m/s^2 | 10 sec | 5 sec | 2-5/shift |
| Near-miss | Object within safety margin | 15 sec | 10 sec | 1-3/shift |
| OOD detection | Perception confidence < threshold | 10 sec | 5 sec | 5-20/shift |
| Localization degradation | GTSAM confidence drop | 30 sec | 10 sec | 1-5/shift |
| Planning override | Teleop intervention | 30 sec | 30 sec | 0-3/shift |
| Sensor dropout | LiDAR/IMU message gap > 100ms | 5 sec | 5 sec | 0-2/shift |
| FOD candidate | Unknown ground-level object | 10 sec | 5 sec | 0-5/shift |

Event data is tagged with maximum priority for upload and permanent retention. A single near-miss event at full sensor fidelity (all LiDAR + telemetry, 25 seconds) is approximately 7-10 GB uncompressed.

### 2.5 Metadata

Every bag and event is enriched with contextual metadata:

| Metadata Field | Source | Update Rate |
|---|---|---|
| GPS position (lat/lon/alt) | RTK-GPS | Per-frame |
| Weather conditions | Airport METAR feed | Every 30 min |
| Active flight schedule | Airport FIDS API | Every 5 min |
| Turnaround phase | Fleet management system | Event-driven |
| Vehicle ID and config | Static config file | Per-session |
| Operator ID (if safety driver) | Login system | Per-session |
| Airport zone (ramp, taxilane, gate) | Geofence lookup | Per-frame |
| Lighting conditions | Calculated from time + weather | Per-session |

### 2.6 Fleet-Scale Volume Projections

| Fleet Size | LiDAR Only/Day | LiDAR + 6 Cameras/Day | Monthly (LiDAR Only) | Annual (LiDAR Only) |
|---|---|---|---|---|
| 5 vehicles | 1.05 TB | 2.73 TB | 31.5 TB | 383 TB |
| 10 vehicles | 2.1 TB | 5.46 TB | 63 TB | 766 TB |
| 25 vehicles | 5.25 TB | 13.65 TB | 158 TB | 1.9 PB |
| 50 vehicles | 10.5 TB | 27.3 TB | 315 TB | 3.8 PB |
| 100 vehicles | 21 TB | 54.6 TB | 630 TB | 7.7 PB |

These are raw recording volumes. With selective recording (section 3.2), actual stored volumes are 30-50% of these figures.

---

## 3. On-Vehicle Data Management

### 3.1 Edge Storage Hardware

Each vehicle requires sufficient NVMe SSD capacity to buffer an entire operational shift plus a safety margin for failed uploads.

**Storage sizing formula:**

```
Required capacity = (daily_raw_volume * compression_ratio * buffer_days) + OS_and_logs
```

| Fleet Phase | Sensor Config | Daily Volume (compressed) | Buffer Days | Recommended SSD | Estimated Cost |
|---|---|---|---|---|---|
| Phase 1 (LiDAR only) | 4+4 RoboSense | 155 GB | 3 | 1 TB NVMe | $80-120 |
| Phase 2 (+ 6 cameras) | LiDAR + cameras | 490 GB | 3 | 2 TB NVMe | $140-200 |
| Phase 3 (full sensor suite) | LiDAR + cameras + thermal | 520 GB | 3 | 2 TB NVMe | $140-200 |
| Safety margin config | Any | — | 7 | 4 TB NVMe | $280-400 |

**Hardware recommendations:**

- **Samsung 990 Pro 2TB** or **WD Black SN850X 2TB**: Consumer-grade NVMe with 7,000 MB/s sequential write, adequate for point cloud write rates (~30 MB/s sustained). $140-180.
- **Samsung PM9A3 3.84TB**: Enterprise/automotive-grade, higher endurance (1 DWPD vs 0.3 DWPD consumer), wider temperature range. $400-600. Recommended for production vehicles.
- **Solidigm P44 Pro 2TB**: Strong value option with high endurance. $120-160.

**Endurance calculation:** At 155 GB/day write, a consumer 2TB SSD with 600 TBW endurance lasts approximately 10 years. Endurance is not the bottleneck; capacity and temperature resilience are.

**Vibration and temperature:** Airport tarmac temperatures reach 60C+ in summer. Consumer SSDs throttle at 70C. Mount SSDs with thermal pads against the vehicle chassis (heat sink) and away from engine/motor heat sources. Automotive-grade SSDs (Samsung PM9C1a, Kioxia XG8) are rated to 85C operating temperature but cost 2-3x more.

### 3.2 Selective Recording Strategies

Recording everything at full fidelity is wasteful. Stationary vehicles at a charging dock do not need 210 GB/day of LiDAR data. A tiered recording strategy reduces storage and upload volumes by 50-70%:

**Tier 1: Always-On (Full Fidelity)**
- All LiDAR sensors at native rate (10 Hz)
- All telemetry (IMU, GPS, odometry, CAN)
- Triggered during: active driving, turnaround operations, any task execution

**Tier 2: Reduced Rate**
- Aggregated point cloud only (skip per-sensor topics) at 2 Hz
- Telemetry at reduced rates (IMU 50 Hz, GPS 1 Hz)
- Triggered during: stationary but in operational zone, waiting for task

**Tier 3: Minimal**
- Telemetry only (no LiDAR, no cameras)
- GPS at 0.1 Hz, diagnostics at 0.1 Hz
- Triggered during: stationary at depot/charging, maintenance mode

**Tier 4: Event Burst**
- All sensors at maximum rate
- Circular buffer ensures pre-event data is preserved
- Triggered by: any safety event (see section 2.4)
- Overrides current tier to full fidelity

```python
#!/usr/bin/env python3
"""On-vehicle recording tier controller for ROS Noetic."""

import rospy
from std_msgs.msg import String
from geometry_msgs.msg import Twist

class RecordingTierController:
    """Manages recording tiers based on vehicle operational state."""

    TIER_FULL = 1       # Active driving
    TIER_REDUCED = 2    # Stationary in operational zone
    TIER_MINIMAL = 3    # At depot/charging
    TIER_EVENT = 4      # Safety event burst

    # Topics per tier: topic -> max_rate_hz (None = native rate)
    TIER_TOPICS = {
        TIER_FULL: {
            '/pointcloud_aggregator/output': None,
            '/rshelios_*/points': None,
            '/rsbp_*/points': None,
            '/imu/data': None,
            '/fix': None,
            '/odom/fused': None,
            '/can/raw': None,
            '/vehicle/state': None,
        },
        TIER_REDUCED: {
            '/pointcloud_aggregator/output': 2.0,
            '/imu/data': 50.0,
            '/fix': 1.0,
            '/odom/fused': 10.0,
            '/vehicle/state': 10.0,
        },
        TIER_MINIMAL: {
            '/fix': 0.1,
            '/vehicle/state': 1.0,
            '/diagnostics': 0.1,
        },
        TIER_EVENT: {
            # Everything at max rate — same as TIER_FULL
            # plus event metadata
        },
    }

    def __init__(self):
        self.current_tier = self.TIER_MINIMAL
        self.vehicle_speed = 0.0
        self.in_operational_zone = False
        self.event_active = False
        self.event_timeout = rospy.Duration(30.0)
        self.last_event_time = rospy.Time(0)

        rospy.Subscriber('/cmd_vel', Twist, self._speed_cb)
        rospy.Subscriber('/fleet/zone_status', String, self._zone_cb)
        rospy.Subscriber('/safety/event', String, self._event_cb)
        self.tier_pub = rospy.Publisher('/recording/tier', String, queue_size=1)

    def _speed_cb(self, msg):
        self.vehicle_speed = abs(msg.linear.x)

    def _zone_cb(self, msg):
        self.in_operational_zone = msg.data in ['ramp', 'taxilane', 'gate', 'apron']

    def _event_cb(self, msg):
        self.event_active = True
        self.last_event_time = rospy.Time.now()

    def compute_tier(self):
        now = rospy.Time.now()

        # Event burst overrides everything
        if self.event_active:
            if (now - self.last_event_time) > self.event_timeout:
                self.event_active = False
            else:
                return self.TIER_EVENT

        # Active driving
        if self.vehicle_speed > 0.1:
            return self.TIER_FULL

        # Stationary in operational zone
        if self.in_operational_zone:
            return self.TIER_REDUCED

        # At depot
        return self.TIER_MINIMAL

    def run(self):
        rate = rospy.Rate(1.0)
        while not rospy.is_shutdown():
            new_tier = self.compute_tier()
            if new_tier != self.current_tier:
                self.current_tier = new_tier
                self.tier_pub.publish(String(data=str(new_tier)))
                rospy.loginfo(f"Recording tier changed to {new_tier}")
            rate.sleep()
```

### 3.3 On-Vehicle Compression

ROS 1 bags support LZ4 and BZ2 compression natively. For the airside data pipeline:

```bash
# Record with LZ4 compression (recommended for on-vehicle)
rosbag record -j --lz4 \
  /pointcloud_aggregator/output \
  /imu/data \
  /fix \
  /odom/fused \
  /can/raw \
  -o /data/bags/$(date +%Y%m%d_%H%M%S)

# Post-hoc recompress with Zstd for archival (run at depot)
# Requires conversion to MCAP format
mcap convert input.bag output.mcap --compression zstd --compression-level 6
```

**Compression benchmarks on Aurrigo-typical data:**

| Method | Ratio (LiDAR) | Compress Speed | Decompress Speed | CPU Load |
|---|---|---|---|---|
| None | 1.0x | N/A | N/A | 0% |
| LZ4 (default) | 1.35x | 780 MB/s | 4,200 MB/s | ~5% per core |
| LZ4 HC (level 9) | 1.50x | 120 MB/s | 4,200 MB/s | ~30% per core |
| Zstd (level 1) | 1.55x | 500 MB/s | 1,500 MB/s | ~10% per core |
| Zstd (level 3) | 1.70x | 300 MB/s | 1,400 MB/s | ~15% per core |
| Zstd (level 6) | 1.85x | 130 MB/s | 1,300 MB/s | ~25% per core |
| BZ2 | 1.90x | 30 MB/s | 80 MB/s | ~80% per core |
| Cloudini + LZ4 | 2.5-3.0x | ~200 MB/s | ~800 MB/s | ~20% per core |

**Recommendation:** Use LZ4 on-vehicle for recording. Re-compress to Zstd level 3 during depot offload. Use Cloudini for long-term archival of point cloud data specifically.

### 3.4 Pre-Filtering and Deduplication

Before upload, the on-vehicle pipeline should discard or downsample low-value data:

1. **Stationary deduplication:** If the vehicle has not moved more than 0.5m in the last 30 seconds and no safety event is active, reduce LiDAR recording to 1 Hz. This alone can cut 40-60% of total volume for vehicles that spend significant time parked at gates.

2. **Ground-plane removal:** For upload (not for on-vehicle perception), remove ground points before compression. A RANSAC ground plane fit followed by removal of points within 10cm of the plane typically removes 30-50% of points with no loss of object-level information. This is done as a post-processing step, not in the recording pipeline.

3. **Topic filtering:** Strip debug/visualization topics before upload. Topics like `/rviz/*`, `/rosout`, `/diagnostics_agg` add noise and volume.

4. **Duplicate bag detection:** Hash-based detection of accidentally duplicated bags (same start time + vehicle ID + first 1000 messages hash).

### 3.5 Prioritized Upload Queue

Not all data has equal value. The on-vehicle upload manager maintains a priority queue:

| Priority | Data Type | Upload Deadline | Retention If Upload Fails |
|---|---|---|---|
| P0 (Critical) | Safety events, near-misses, teleop interventions | Within 1 hour | Permanent (never auto-delete) |
| P1 (High) | OOD detections, localization failures, new object encounters | Within 4 hours | 7 days |
| P2 (Normal) | Routine operational bags | Within 24 hours | 3 days |
| P3 (Low) | Stationary/depot recordings, diagnostics | Best-effort | 1 day |

```python
import heapq
import dataclasses
from pathlib import Path
from typing import Optional

@dataclasses.dataclass(order=True)
class UploadJob:
    priority: int
    timestamp: float = dataclasses.field(compare=False)
    bag_path: Path = dataclasses.field(compare=False)
    size_bytes: int = dataclasses.field(compare=False)
    event_type: Optional[str] = dataclasses.field(compare=False, default=None)
    retry_count: int = dataclasses.field(compare=False, default=0)
    max_retries: int = dataclasses.field(compare=False, default=5)

class UploadQueue:
    """Priority queue for bag uploads with bandwidth-aware scheduling."""

    def __init__(self, max_bandwidth_mbps: float = 100.0):
        self.queue: list[UploadJob] = []
        self.max_bandwidth_mbps = max_bandwidth_mbps
        self.active_uploads: list[UploadJob] = []

    def enqueue(self, job: UploadJob):
        heapq.heappush(self.queue, job)

    def next_job(self) -> Optional[UploadJob]:
        if not self.queue:
            return None
        return heapq.heappop(self.queue)

    def estimated_upload_time(self, job: UploadJob) -> float:
        """Estimate upload time in seconds."""
        bandwidth_bytes = self.max_bandwidth_mbps * 1e6 / 8
        return job.size_bytes / bandwidth_bytes
```

---

## 4. Data Transfer and Ingestion

### 4.1 Airport WiFi Offload (Primary Path)

The primary data transfer mechanism is WiFi bulk upload when vehicles return to the depot or charging station at the end of a shift. Airport operational networks typically provide dedicated VLAN access for ground vehicles.

**Bandwidth planning:**

| Scenario | Data/Vehicle/Day | Vehicles | Total/Day | WiFi Speed | Upload Time |
|---|---|---|---|---|---|
| LiDAR only, compressed | 125 GB | 5 | 625 GB | 1 Gbps | 1.4 hours |
| LiDAR only, compressed | 125 GB | 10 | 1.25 TB | 1 Gbps | 2.8 hours |
| LiDAR only, compressed | 125 GB | 25 | 3.1 TB | 10 Gbps | 42 min |
| LiDAR + cameras | 490 GB | 10 | 4.9 TB | 10 Gbps | 65 min |
| LiDAR + cameras | 490 GB | 50 | 24.5 TB | 10 Gbps | 5.4 hours |

**For fleets beyond 10 vehicles, 10 Gbps backhaul from the depot to the data center is essential.** With WiFi 6E access points (2.4 Gbps per client theoretical, ~800 Mbps practical), 4-6 APs at the depot can support simultaneous upload from 10+ vehicles.

**Implementation:**

```bash
# On-vehicle upload script (runs when WiFi detected at depot)
#!/bin/bash
UPLOAD_ENDPOINT="https://data-ingest.aurrigo.internal/api/v1/upload"
BAG_DIR="/data/bags/pending"
VEHICLE_ID=$(cat /etc/vehicle_id)

# Upload in priority order
for bag in $(ls -t ${BAG_DIR}/*.bag); do
    PRIORITY=$(get_bag_priority "$bag")
    CHECKSUM=$(md5sum "$bag" | cut -d' ' -f1)

    curl -X POST "$UPLOAD_ENDPOINT" \
        -H "X-Vehicle-ID: ${VEHICLE_ID}" \
        -H "X-Priority: ${PRIORITY}" \
        -H "X-Checksum: ${CHECKSUM}" \
        -F "file=@${bag}" \
        --retry 3 \
        --retry-delay 10 \
        --max-time 3600

    if [ $? -eq 0 ]; then
        mv "$bag" "${BAG_DIR}/../uploaded/"
    fi
done
```

### 4.2 5G/CBRS Real-Time Telemetry Stream

Real-time telemetry (not bulk sensor data) streams over cellular for fleet monitoring, alerting, and remote intervention.

| Data Type | Bandwidth Required | Latency Requirement | Protocol |
|---|---|---|---|
| Vehicle state (speed, heading, battery) | 5 Kbps | < 1 sec | MQTT over TLS |
| Localization confidence | 2 Kbps | < 1 sec | MQTT over TLS |
| Perception alerts (OOD, near-miss) | 10 Kbps (bursty) | < 500 ms | MQTT over TLS |
| Compressed camera snapshot (on event) | 500 Kbps (bursty) | < 5 sec | HTTPS |
| Teleop video stream | 5-15 Mbps | < 100 ms | WebRTC/SRT |

**CBRS (Citizens Broadband Radio Service)** private LTE/5G networks deployed at airports provide dedicated bandwidth not shared with public cellular. DFW spent $10M deploying airport-wide 5G coverage, achieving 200+ Mbps downlink and <20ms latency across the airfield.

For airports without CBRS, commercial 5G provides adequate bandwidth for telemetry but not for bulk sensor upload. Plan for telemetry over 5G and bulk data over depot WiFi.

**MQTT topic structure for fleet telemetry:**

```
fleet/{vehicle_id}/telemetry          # 10 Hz vehicle state
fleet/{vehicle_id}/localization       # 10 Hz pose + confidence
fleet/{vehicle_id}/perception/alerts  # Event-driven safety alerts
fleet/{vehicle_id}/diagnostics        # 1 Hz system health
fleet/{vehicle_id}/task/status        # Event-driven task updates
fleet/+/heartbeat                     # 1 Hz fleet-wide liveness
```

### 4.3 Ingest Pipeline Architecture

The ingest pipeline receives bags from vehicles, validates them, extracts metadata, and registers them in the data catalog.

```
Vehicle WiFi Upload
        │
        ▼
┌───────────────────┐
│  Ingest Gateway   │  (nginx + auth, rate limiting)
│  TLS termination  │
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│  Validation       │  (checksum, format check, completeness)
│  Service          │
└───────┬───────────┘
        │
        ▼
┌───────────────────┐     ┌─────────────────────┐
│  Object Storage   │────►│  Metadata Extractor  │
│  (MinIO / S3)     │     │  (async worker)      │
│  raw-bags/        │     └───────┬──────────────┘
└───────────────────┘             │
                                  ▼
                          ┌───────────────────┐
                          │  Catalog Database  │
                          │  (PostgreSQL)      │
                          └───────┬───────────┘
                                  │
                                  ▼
                          ┌───────────────────┐
                          │  Processing Queue  │
                          │  (Redis / Celery)  │
                          └───────────────────┘
```

**MinIO vs S3 decision:**

| Factor | MinIO (On-Premises) | AWS S3 (Cloud) |
|---|---|---|
| Latency to GPU training cluster | <1ms (local network) | 50-200ms |
| Data sovereignty | Full control | AWS region dependent |
| Cost at 100 TB | $5K/year (hardware amortized) | $27,600/year (Standard) |
| Cost at 1 PB | $30K/year (hardware amortized) | $276,000/year |
| Operational overhead | High (manage hardware) | Low (managed service) |
| S3 API compatibility | Full | Native |
| Disaster recovery | Must implement | Built-in cross-region |

**Recommendation for Aurrigo:** Start with MinIO on-premises at each airport depot for hot storage, with S3 as the archival tier. MinIO provides S3 API compatibility, so the pipeline code does not change when migrating between on-prem and cloud.

---

## 5. Dataset Versioning with DVC

### 5.1 Why DVC for ROS Bag Management

DVC (Data Version Control) provides Git-like versioning for large datasets without storing the data itself in Git. In November 2025, lakeFS acquired DVC, but DVC remains fully open-source under the same Apache 2.0 license with continued active development.

For autonomous vehicle data pipelines, DVC solves three critical problems:

1. **Reproducibility:** Every training run references an exact dataset version. "Which bags were in the v3.2 training set?" has a deterministic answer.
2. **Collaboration:** Multiple engineers can work on different dataset versions without conflict.
3. **Storage efficiency:** DVC uses content-addressable storage, so duplicate data across versions is stored once.

### 5.2 DVC Setup for Aurrigo

```bash
# Initialize DVC in the ML training repository
cd /home/kvyn/airside-ml
git init
dvc init

# Configure remote storage (MinIO with S3 API)
dvc remote add -d minio-storage s3://airside-datasets
dvc remote modify minio-storage endpointurl http://minio.aurrigo.internal:9000
dvc remote modify minio-storage access_key_id ${MINIO_ACCESS_KEY}
dvc remote modify minio-storage secret_access_key ${MINIO_SECRET_KEY}

# For cloud backup
dvc remote add s3-archive s3://aurrigo-airside-archive
dvc remote modify s3-archive region eu-west-2
```

### 5.3 Versioning a Labeled Training Set

```bash
# Directory structure for a labeled dataset
airside-ml/
├── data/
│   ├── raw/                    # Symlinks to MinIO-managed bags
│   ├── processed/
│   │   ├── scenes/             # Extracted 30-second scenes
│   │   ├── frames/             # Synchronized sensor frames
│   │   └── labels/             # 3D bounding box annotations
│   ├── splits/
│   │   ├── train.txt           # Scene IDs for training
│   │   ├── val.txt             # Scene IDs for validation
│   │   └── test.txt            # Scene IDs for testing
│   └── data.dvc                # DVC tracking file
├── models/
│   └── pointpillars_v1.dvc     # Versioned model checkpoint
├── dvc.yaml                    # Pipeline definition
├── dvc.lock                    # Pipeline state (auto-generated)
└── params.yaml                 # Hyperparameters
```

```bash
# Track a new dataset version
cd /home/kvyn/airside-ml
dvc add data/processed/
git add data/processed.dvc data/.gitignore
git commit -m "Dataset v1.2: add 500 gate-area scenes from LHR"
dvc push

# Checkout a previous dataset version
git checkout v1.1 -- data/processed.dvc
dvc checkout
```

### 5.4 DVC Pipeline Definition

```yaml
# dvc.yaml — defines the reproducible data processing pipeline
stages:
  extract_scenes:
    cmd: python scripts/extract_scenes.py
      --bag-dir data/raw/
      --output-dir data/processed/scenes/
      --scene-duration 30
      --overlap 5
    deps:
      - scripts/extract_scenes.py
      - data/raw/
    outs:
      - data/processed/scenes/

  extract_frames:
    cmd: python scripts/extract_frames.py
      --scene-dir data/processed/scenes/
      --output-dir data/processed/frames/
      --target-hz 10
    deps:
      - scripts/extract_frames.py
      - data/processed/scenes/
    outs:
      - data/processed/frames/

  generate_splits:
    cmd: python scripts/generate_splits.py
      --frame-dir data/processed/frames/
      --output-dir data/splits/
      --train-ratio 0.7
      --val-ratio 0.15
      --test-ratio 0.15
      --temporal-gap 300
    deps:
      - scripts/generate_splits.py
      - data/processed/frames/
    outs:
      - data/splits/

  train_pointpillars:
    cmd: python scripts/train.py
      --data-dir data/processed/frames/
      --splits-dir data/splits/
      --config configs/pointpillars_airside.yaml
    deps:
      - scripts/train.py
      - data/processed/frames/
      - data/splits/
      - configs/pointpillars_airside.yaml
    params:
      - params.yaml:
          - train.batch_size
          - train.learning_rate
          - train.epochs
          - model.voxel_size
          - model.point_cloud_range
    outs:
      - models/pointpillars_latest/
    metrics:
      - metrics/eval_results.json:
          cache: false

  evaluate:
    cmd: python scripts/evaluate.py
      --model-dir models/pointpillars_latest/
      --data-dir data/processed/frames/
      --splits-dir data/splits/
    deps:
      - scripts/evaluate.py
      - models/pointpillars_latest/
      - data/processed/frames/
      - data/splits/
    metrics:
      - metrics/eval_results.json:
          cache: false
    plots:
      - metrics/pr_curve.json:
          x: recall
          y: precision
```

```bash
# Run the full pipeline
dvc repro

# Compare metrics across experiments
dvc metrics diff v1.1 v1.2

# Show pipeline DAG
dvc dag
```

### 5.5 Experiment Tracking with DVC

```bash
# Run an experiment with modified parameters
dvc exp run --set-param train.learning_rate=0.0003 \
            --set-param model.voxel_size="[0.16, 0.16, 4.0]"

# List all experiments
dvc exp show

# Compare two experiments
dvc exp diff exp-abc123 exp-def456

# Promote an experiment to a Git branch
dvc exp branch exp-abc123 feature/smaller-voxels
```

### 5.6 DVC vs lakeFS

For teams scaling beyond 50 TB of managed data, lakeFS provides a complementary layer:

| Feature | DVC | lakeFS |
|---|---|---|
| Git integration | Native (`.dvc` files in Git) | Separate (Git-like branching on data lake) |
| Best for | Dataset versioning, ML pipelines | Data lake branching, concurrent writes |
| Scale sweet spot | 1-50 TB | 50 TB - PB+ |
| Atomic operations | File-level | Commit-level across entire lake |
| S3 compatibility | Via remote backends | Native S3 gateway |
| Cost | Free (open-source) | Free (open-source), enterprise tier available |
| Post-acquisition status | Maintained by lakeFS, Apache 2.0 | Primary product |

**Recommendation:** Start with DVC. Evaluate lakeFS when dataset management exceeds 50 TB or when multiple teams need concurrent branch-level access to the data lake.

---

## 6. Bag Processing Pipeline

### 6.1 Tool Selection

| Tool | Use Case | ROS Dependency | Performance |
|---|---|---|---|
| `rosbags` (Python) | Batch extraction, no ROS install needed | None | Fast, recommended |
| `mcap` (Python/CLI) | MCAP format read/write, indexed access | None | Very fast (indexed) |
| `rosbag` (ROS native) | On-vehicle recording, live operations | Full ROS install | Standard |
| Foxglove | Visualization, debugging, manual review | None | Excellent UI |
| Kappe | MCAP migration, topic manipulation | None | Batch operations |

### 6.2 Batch Extraction Pipeline

```python
#!/usr/bin/env python3
"""Batch bag processing pipeline for airside dataset creation.

Extracts point clouds, poses, and telemetry from ROS bags into
a structured format suitable for ML training.
"""

import json
import hashlib
import logging
from pathlib import Path
from datetime import datetime
from concurrent.futures import ProcessPoolExecutor, as_completed
from typing import Dict, List, Optional, Tuple

import numpy as np
from rosbags.rosbag1 import Reader
from rosbags.serde import deserialize_cdr, ros1_to_cdr

logger = logging.getLogger(__name__)


def pointcloud2_to_numpy(msg) -> np.ndarray:
    """Convert ROS PointCloud2 to numpy array.

    Handles RoboSense RSHELIOS/RSBP format:
    Fields: x(f32), y(f32), z(f32), intensity(f32), ring(u16), timestamp(f64)
    """
    dtype = np.dtype([
        ('x', np.float32),
        ('y', np.float32),
        ('z', np.float32),
        ('intensity', np.float32),
    ])
    raw = np.frombuffer(msg.data, dtype=dtype)
    valid = raw[np.isfinite(raw['x']) & (raw['x'] != 0)]
    return np.stack([valid['x'], valid['y'], valid['z'], valid['intensity']], axis=-1)


def extract_bag_metadata(bag_path: Path) -> Dict:
    """Extract metadata from bag without reading full sensor data."""
    with Reader(bag_path) as reader:
        topics = {}
        for conn in reader.connections:
            key = conn.topic
            if key not in topics:
                topics[key] = {
                    'msgtype': conn.msgtype,
                    'count': 0,
                }
        # Count messages per topic
        for conn, timestamp, rawdata in reader.messages():
            topics[conn.topic]['count'] += 1

        bag_hash = hashlib.md5(bag_path.read_bytes()[:1024*1024]).hexdigest()

        return {
            'path': str(bag_path),
            'filename': bag_path.name,
            'size_bytes': bag_path.stat().st_size,
            'size_gb': round(bag_path.stat().st_size / 1e9, 3),
            'duration_sec': round(reader.duration / 1e9, 2),
            'start_time': reader.start_time,
            'end_time': reader.end_time,
            'message_count': reader.message_count,
            'topics': topics,
            'hash_prefix': bag_hash,
            'extracted_at': datetime.utcnow().isoformat(),
        }


def process_bag_to_frames(
    bag_path: Path,
    output_dir: Path,
    pointcloud_topic: str = '/pointcloud_aggregator/output',
    odom_topic: str = '/odom/fused',
    imu_topic: str = '/imu/data',
    gps_topic: str = '/fix',
) -> Dict:
    """Process a single bag into synchronized frames.

    Each frame contains:
    - Point cloud as .npy (N, 4) array
    - Pose as 4x4 SE3 matrix
    - Metadata JSON with timestamp, GPS, IMU snapshot
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    frame_count = 0
    frames_metadata = []

    with Reader(bag_path) as reader:
        # Build topic -> connection mapping
        pc_conns = [c for c in reader.connections if c.topic == pointcloud_topic]
        odom_conns = [c for c in reader.connections if c.topic == odom_topic]

        # Buffer for nearest-neighbor synchronization
        latest_odom = None
        latest_gps = None
        latest_imu = None

        for conn, timestamp, rawdata in reader.messages():
            t_sec = timestamp / 1e9

            if conn.topic == odom_topic:
                msg = deserialize_cdr(ros1_to_cdr(rawdata, conn.msgtype), conn.msgtype)
                latest_odom = {
                    'timestamp': t_sec,
                    'position': [
                        msg.pose.pose.position.x,
                        msg.pose.pose.position.y,
                        msg.pose.pose.position.z,
                    ],
                    'orientation': [
                        msg.pose.pose.orientation.x,
                        msg.pose.pose.orientation.y,
                        msg.pose.pose.orientation.z,
                        msg.pose.pose.orientation.w,
                    ],
                }

            elif conn.topic == gps_topic:
                msg = deserialize_cdr(ros1_to_cdr(rawdata, conn.msgtype), conn.msgtype)
                latest_gps = {
                    'timestamp': t_sec,
                    'latitude': msg.latitude,
                    'longitude': msg.longitude,
                    'altitude': msg.altitude,
                    'status': msg.status.status,
                }

            elif conn.topic == pointcloud_topic:
                msg = deserialize_cdr(ros1_to_cdr(rawdata, conn.msgtype), conn.msgtype)
                points = pointcloud2_to_numpy(msg)

                # Save frame
                frame_id = f"{frame_count:06d}"
                np.save(output_dir / f"{frame_id}_points.npy", points)

                frame_meta = {
                    'frame_id': frame_id,
                    'timestamp': t_sec,
                    'num_points': len(points),
                    'bag_source': bag_path.name,
                    'odom': latest_odom,
                    'gps': latest_gps,
                }
                frames_metadata.append(frame_meta)

                with open(output_dir / f"{frame_id}_meta.json", 'w') as f:
                    json.dump(frame_meta, f, indent=2)

                frame_count += 1

    # Save aggregate metadata
    summary = {
        'bag_path': str(bag_path),
        'total_frames': frame_count,
        'total_points': sum(f['num_points'] for f in frames_metadata),
        'duration_sec': (frames_metadata[-1]['timestamp'] - frames_metadata[0]['timestamp'])
        if frames_metadata else 0,
    }
    with open(output_dir / 'summary.json', 'w') as f:
        json.dump(summary, f, indent=2)

    return summary


def batch_process_bags(
    bag_dir: Path,
    output_dir: Path,
    max_workers: int = 4,
    pointcloud_topic: str = '/pointcloud_aggregator/output',
) -> List[Dict]:
    """Process all bags in a directory in parallel."""
    bags = sorted(bag_dir.rglob('*.bag'))
    logger.info(f"Found {len(bags)} bags to process")

    results = []
    with ProcessPoolExecutor(max_workers=max_workers) as executor:
        futures = {}
        for bag_path in bags:
            bag_output = output_dir / bag_path.stem
            future = executor.submit(
                process_bag_to_frames,
                bag_path,
                bag_output,
                pointcloud_topic,
            )
            futures[future] = bag_path

        for future in as_completed(futures):
            bag_path = futures[future]
            try:
                result = future.result()
                results.append(result)
                logger.info(
                    f"Processed {bag_path.name}: "
                    f"{result['total_frames']} frames, "
                    f"{result['duration_sec']:.1f}s"
                )
            except Exception as e:
                logger.error(f"Failed to process {bag_path.name}: {e}")

    return results
```

### 6.3 MCAP Format Migration

MCAP is the default format for ROS 2 and is increasingly used for ROS 1 data archival due to its indexed random access, crash recovery, and superior compression. For Aurrigo's ROS Noetic bags, conversion to MCAP is recommended for the archival and training pipeline.

```bash
# Install tools
pip install mcap mcap-ros1-support rosbags

# Convert a single bag
mcap convert recording_2026-04-11.bag recording_2026-04-11.mcap

# Batch convert with Kappe (handles topic renaming, filtering)
pip install kappe
kappe convert \
    --input-dir /data/bags/raw/ \
    --output-dir /data/mcap/converted/ \
    --compression zstd \
    --exclude-topics "/rosout,/rviz/*,/diagnostics_agg"

# Verify conversion
mcap info recording_2026-04-11.mcap
```

**MCAP advantages for the data pipeline:**

| Feature | ROS 1 .bag | MCAP |
|---|---|---|
| Random access by time | Sequential scan | O(1) indexed |
| Crash recovery | Bag may be corrupted | Append-only, recoverable |
| Compression | Per-chunk (LZ4/BZ2) | Per-chunk (LZ4/Zstd) |
| Multi-language support | Python/C++ (with ROS) | Python/C++/Rust/Go/TS (no ROS needed) |
| Foxglove visualization | Supported | Native, 10x faster |
| File size overhead | ~2% | ~1% |

### 6.4 Scene Extraction and Scenario Classification

Bags are segmented into discrete scenarios for structured dataset organization:

| Scenario Type | Duration | Trigger | Training Value |
|---|---|---|---|
| Gate approach | 60-120 sec | Entering gate geofence | High — navigation near aircraft |
| Turnaround operation | 5-45 min | Turnaround start event | High — dynamic GSE, personnel |
| Taxilane transit | 30-300 sec | Traveling between gates | Medium — path following |
| Depot departure/return | 30-60 sec | Leaving/entering depot geofence | Low — repetitive |
| Charging station | — | Stationary at charger | None — discard sensor data |
| Safety event | 15-60 sec | Any P0 trigger | Critical — always retain |

### 6.5 Metadata Database Schema

```sql
-- PostgreSQL schema for the bag and frame catalog

CREATE TABLE vehicles (
    vehicle_id      VARCHAR(32) PRIMARY KEY,
    vehicle_type    VARCHAR(32) NOT NULL,  -- 'ADT3', 'STL2', 'POD', 'ACA1'
    sensor_config   JSONB NOT NULL,        -- LiDAR types, camera config
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE bags (
    bag_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id      VARCHAR(32) REFERENCES vehicles(vehicle_id),
    filename        VARCHAR(256) NOT NULL,
    storage_path    VARCHAR(512) NOT NULL,  -- MinIO/S3 path
    format          VARCHAR(16) NOT NULL DEFAULT 'rosbag1',  -- 'rosbag1', 'mcap'
    size_bytes      BIGINT NOT NULL,
    duration_sec    FLOAT NOT NULL,
    start_time      TIMESTAMP NOT NULL,
    end_time        TIMESTAMP NOT NULL,
    message_count   INTEGER NOT NULL,
    topics          JSONB NOT NULL,
    compression     VARCHAR(16),           -- 'none', 'lz4', 'zstd'
    hash_md5        VARCHAR(32),
    airport_code    VARCHAR(8) NOT NULL,   -- 'EGLL', 'KDFW', etc.
    upload_time     TIMESTAMP DEFAULT NOW(),
    processing_status VARCHAR(16) DEFAULT 'pending',
    metadata        JSONB                  -- weather, flight schedule, etc.
);

CREATE INDEX idx_bags_vehicle ON bags(vehicle_id);
CREATE INDEX idx_bags_airport ON bags(airport_code);
CREATE INDEX idx_bags_time ON bags(start_time);
CREATE INDEX idx_bags_status ON bags(processing_status);

CREATE TABLE scenes (
    scene_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bag_id          UUID REFERENCES bags(bag_id),
    scenario_type   VARCHAR(32) NOT NULL,  -- 'gate_approach', 'turnaround', etc.
    start_offset    FLOAT NOT NULL,        -- seconds from bag start
    duration_sec    FLOAT NOT NULL,
    frame_count     INTEGER NOT NULL,
    storage_path    VARCHAR(512) NOT NULL,
    metadata        JSONB
);

CREATE INDEX idx_scenes_type ON scenes(scenario_type);
CREATE INDEX idx_scenes_bag ON scenes(bag_id);

CREATE TABLE frames (
    frame_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id        UUID REFERENCES scenes(scene_id),
    sequence_idx    INTEGER NOT NULL,
    timestamp       DOUBLE PRECISION NOT NULL,
    num_points      INTEGER NOT NULL,
    storage_path    VARCHAR(512) NOT NULL,  -- path to .npy file
    ego_pose        JSONB,                 -- 4x4 SE3 matrix
    gps_position    JSONB,                 -- lat, lon, alt
    has_labels      BOOLEAN DEFAULT FALSE,
    label_path      VARCHAR(512),
    metadata        JSONB
);

CREATE INDEX idx_frames_scene ON frames(scene_id);
CREATE INDEX idx_frames_labeled ON frames(has_labels);

CREATE TABLE labels (
    label_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    frame_id        UUID REFERENCES frames(frame_id),
    label_format    VARCHAR(32) NOT NULL,  -- 'nuscenes', 'kitti', 'custom'
    annotator_id    VARCHAR(64),
    annotation_time FLOAT,                 -- seconds to annotate
    num_boxes       INTEGER,
    num_points_labeled INTEGER,
    quality_score   FLOAT,                 -- 0-1, from QA review
    storage_path    VARCHAR(512) NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW(),
    reviewed        BOOLEAN DEFAULT FALSE,
    reviewer_id     VARCHAR(64)
);

CREATE TABLE events (
    event_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bag_id          UUID REFERENCES bags(bag_id),
    event_type      VARCHAR(32) NOT NULL,
    priority        INTEGER NOT NULL,      -- 0=critical, 3=low
    timestamp       TIMESTAMP NOT NULL,
    duration_sec    FLOAT,
    description     TEXT,
    metadata        JSONB,                 -- sensor readings, thresholds
    reviewed        BOOLEAN DEFAULT FALSE,
    reviewer_notes  TEXT
);

CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_priority ON events(priority);

-- Useful views

CREATE VIEW dataset_summary AS
SELECT
    b.airport_code,
    s.scenario_type,
    COUNT(DISTINCT s.scene_id) AS num_scenes,
    COUNT(DISTINCT f.frame_id) AS num_frames,
    COUNT(DISTINCT f.frame_id) FILTER (WHERE f.has_labels) AS labeled_frames,
    ROUND(SUM(s.duration_sec) / 3600.0, 1) AS total_hours
FROM bags b
JOIN scenes s ON s.bag_id = b.bag_id
JOIN frames f ON f.scene_id = s.scene_id
GROUP BY b.airport_code, s.scenario_type;

CREATE VIEW labeling_progress AS
SELECT
    l.annotator_id,
    COUNT(*) AS frames_labeled,
    AVG(l.annotation_time) AS avg_seconds_per_frame,
    AVG(l.num_boxes) AS avg_boxes_per_frame,
    AVG(l.quality_score) AS avg_quality,
    COUNT(*) FILTER (WHERE l.reviewed) AS reviewed_count
FROM labels l
GROUP BY l.annotator_id;
```

---

## 7. Labeling Workflows

### 7.1 3D Point Cloud Annotation Tools

| Tool | Type | 3D Support | Multi-LiDAR | Pre-labeling | Cost | Recommendation |
|---|---|---|---|---|---|---|
| CVAT | Open-source, self-hosted | 3D cuboids on PCD/PLY | Manual merge needed | Via API | Free | Good for small teams |
| Segments.ai | Cloud platform | Native 3D, batch tracking | Supported | Built-in | $0.10-0.30/frame | **Recommended for Aurrigo** |
| Scale AI | Managed service | Full pipeline | Native | Proprietary | $1-5/frame | For production-scale |
| SUSTechPOINTS | Open-source | 3D boxes, strong UI | Limited | None | Free | Good for prototyping |
| BasicAI | Cloud platform | 3D boxes, segmentation | Supported | Built-in | $0.15-0.40/frame | Alternative to Segments.ai |
| Supervisely | Cloud/self-hosted | 3D point clouds | Supported | Via SDK | $0.10-0.25/frame | Good SDK integration |

### 7.2 Cost Estimation for Airside Annotation

Airside objects are harder to annotate than standard driving objects due to unusual shapes (belt loaders, catering trucks with scissor lifts), varying configurations, and the need for airside-specific class taxonomies.

**3D bounding box annotation:**

| Annotation Type | Speed (boxes/hr) | Cost/Frame (outsourced) | Cost/Frame (in-house) |
|---|---|---|---|
| 3D boxes, standard classes (vehicle, person) | 30-40 boxes/hr | $0.50-1.00 | $0.20-0.40 |
| 3D boxes, airside classes (15+ types) | 15-25 boxes/hr | $1.00-3.00 | $0.40-1.00 |
| 3D semantic segmentation (point-level) | 500-1,000 pts/hr | $5.00-15.00 | $2.00-6.00 |
| 3D panoptic segmentation | 300-600 pts/hr | $8.00-20.00 | $3.00-8.00 |

**Budget projections for building an airside dataset:**

| Dataset Size | 3D Box Cost (outsourced) | 3D Box Cost (in-house) | Timeline |
|---|---|---|---|
| 5,000 frames (MVP) | $5K-15K | $2K-5K | 2-4 weeks |
| 20,000 frames (v1.0) | $20K-60K | $8K-20K | 2-3 months |
| 100,000 frames (production) | $100K-300K | $40K-100K | 6-12 months |

In-house costs assume 2-3 dedicated annotators at $20-30/hr with Segments.ai platform licensing.

### 7.3 Active Learning for Label Prioritization

Labeling every frame uniformly is wasteful. Active learning identifies the frames most valuable for model improvement, reducing annotation cost by 50-70% while achieving comparable model performance.

**ActiveAD (2025)** demonstrated that planning-oriented active learning achieves comparable end-to-end driving performance using only 30% of labeled data through uncertainty-based sample selection.

**Practical active learning pipeline for Aurrigo:**

```python
"""Active learning frame selection for airside annotation prioritization."""

import numpy as np
from typing import List, Dict, Tuple

class AirsideActiveLearner:
    """Select frames for annotation based on model uncertainty and diversity."""

    def __init__(self, model, feature_extractor):
        self.model = model
        self.feature_extractor = feature_extractor

    def compute_uncertainty(self, frames: List[np.ndarray]) -> np.ndarray:
        """Compute detection uncertainty per frame using MC Dropout.

        Run N forward passes with dropout enabled, measure variance
        in detection confidence and box regression.
        """
        N_PASSES = 10
        all_scores = []

        self.model.train()  # Enable dropout
        for _ in range(N_PASSES):
            scores = []
            for frame in frames:
                detections = self.model(frame)
                scores.append(detections['scores'].mean().item())
            all_scores.append(scores)

        self.model.eval()
        uncertainties = np.std(all_scores, axis=0)
        return uncertainties

    def compute_diversity(self, frames: List[np.ndarray]) -> np.ndarray:
        """Compute feature-space diversity using k-means distance."""
        features = []
        for frame in frames:
            feat = self.feature_extractor(frame)
            features.append(feat)

        features = np.stack(features)
        # Distance to nearest cluster center (from already-labeled data)
        from sklearn.cluster import KMeans
        kmeans = KMeans(n_clusters=min(50, len(features)))
        kmeans.fit(features)
        distances = kmeans.transform(features).min(axis=1)
        return distances

    def select_frames(
        self,
        candidate_frames: List[np.ndarray],
        budget: int,
        alpha: float = 0.6,  # Weight for uncertainty vs diversity
    ) -> List[int]:
        """Select top-k frames balancing uncertainty and diversity.

        Args:
            candidate_frames: Unlabeled frames to evaluate
            budget: Number of frames to select for annotation
            alpha: Balance between uncertainty (alpha) and diversity (1-alpha)

        Returns:
            Indices of selected frames
        """
        uncertainty = self.compute_uncertainty(candidate_frames)
        diversity = self.compute_diversity(candidate_frames)

        # Normalize to [0, 1]
        uncertainty = (uncertainty - uncertainty.min()) / (uncertainty.max() - uncertainty.min() + 1e-8)
        diversity = (diversity - diversity.min()) / (diversity.max() - diversity.min() + 1e-8)

        # Combined score
        scores = alpha * uncertainty + (1 - alpha) * diversity

        # Select top-k
        selected = np.argsort(scores)[-budget:]
        return selected.tolist()
```

### 7.4 Pre-labeling with Existing Models

Running an existing detection model on unlabeled frames before human annotation reduces annotation time by 40-60%:

1. **Run PointPillars** (or CenterPoint if available) on all unlabeled frames.
2. **Export predictions** in the annotation tool's import format (nuScenes JSON, KITTI txt).
3. **Human annotators correct** rather than create from scratch: adjust boxes, add missed objects, remove false positives.
4. **Track corrections** to measure model weaknesses (which classes are most often missed or incorrectly detected).

For airside-specific classes not present in nuScenes/Waymo pretrained models, pre-labeling will not help initially. After labeling the first 2,000-5,000 frames and training an airside-specific model, pre-labeling becomes increasingly effective.

### 7.5 Quality Assurance

| QA Method | What It Catches | Implementation |
|---|---|---|
| Inter-annotator agreement | Systematic labeling inconsistency | 10% of frames double-labeled, IoU threshold > 0.7 |
| Automated consistency checks | Physically impossible boxes (underground, floating) | Script: z_min > ground_plane, z_max < 15m |
| Temporal consistency | Disappearing/teleporting objects between frames | Track objects across consecutive frames, flag gaps |
| Review workflow | Subjective errors, edge cases | Senior annotator reviews 20% of labels |
| Model-label disagreement | Annotation errors or model blind spots | Flag frames where trained model strongly disagrees with label |

**Target quality metrics:**
- Inter-annotator IoU agreement: > 0.75 (3D boxes)
- Label review rejection rate: < 5%
- Temporal consistency score: > 0.90 (tracked objects persist across consecutive frames)

---

## 8. Data Quality and Validation

### 8.1 Sensor Health Monitoring

Continuous monitoring of sensor data quality catches hardware failures before they corrupt the dataset.

```python
"""Sensor health validators for airside AV bag processing."""

from dataclasses import dataclass
from typing import Optional
import numpy as np


@dataclass
class SensorHealthReport:
    sensor_id: str
    status: str  # 'healthy', 'degraded', 'failed'
    message_rate_hz: float
    expected_rate_hz: float
    dropout_count: int
    dropout_duration_sec: float
    point_count_mean: float
    point_count_std: float
    intensity_mean: float
    issues: list


def validate_lidar_health(
    timestamps: np.ndarray,
    point_counts: np.ndarray,
    intensities: np.ndarray,
    sensor_id: str,
    expected_rate: float = 10.0,
    min_points: int = 1000,
) -> SensorHealthReport:
    """Validate LiDAR sensor health from extracted bag data."""
    issues = []

    # Message rate
    if len(timestamps) < 2:
        return SensorHealthReport(
            sensor_id=sensor_id, status='failed',
            message_rate_hz=0, expected_rate_hz=expected_rate,
            dropout_count=0, dropout_duration_sec=0,
            point_count_mean=0, point_count_std=0,
            intensity_mean=0, issues=['No messages received'],
        )

    dt = np.diff(timestamps)
    actual_rate = 1.0 / np.median(dt)

    # Check for dropouts (gaps > 2x expected interval)
    gap_threshold = 2.0 / expected_rate
    dropouts = dt > gap_threshold
    dropout_count = int(dropouts.sum())
    dropout_duration = float(dt[dropouts].sum()) if dropout_count > 0 else 0.0

    if dropout_count > 5:
        issues.append(f"{dropout_count} message dropouts detected")
    if actual_rate < expected_rate * 0.9:
        issues.append(f"Rate {actual_rate:.1f} Hz below expected {expected_rate} Hz")

    # Point count anomalies
    if np.any(point_counts < min_points):
        low_count = int(np.sum(point_counts < min_points))
        issues.append(f"{low_count} frames with < {min_points} points (possible obstruction)")

    pc_std = float(np.std(point_counts))
    if pc_std > 0.3 * np.mean(point_counts):
        issues.append(f"High point count variance (std={pc_std:.0f}), possible intermittent failure")

    # Intensity anomalies (saturation or zero)
    if np.mean(intensities) < 1.0:
        issues.append("Mean intensity near zero — possible sensor miscalibration")

    status = 'healthy'
    if len(issues) > 2 or dropout_count > 10:
        status = 'failed'
    elif len(issues) > 0:
        status = 'degraded'

    return SensorHealthReport(
        sensor_id=sensor_id,
        status=status,
        message_rate_hz=round(actual_rate, 2),
        expected_rate_hz=expected_rate,
        dropout_count=dropout_count,
        dropout_duration_sec=round(dropout_duration, 2),
        point_count_mean=round(float(np.mean(point_counts)), 0),
        point_count_std=round(pc_std, 0),
        intensity_mean=round(float(np.mean(intensities)), 2),
        issues=issues,
    )
```

### 8.2 Duplicate Detection and Deduplication

Duplicate bags arise from accidental re-uploads, failed upload retries, and overlapping recording sessions.

**Deduplication strategy:**

1. **Exact duplicates:** MD5 hash of first 10 MB + file size. O(1) lookup in catalog database.
2. **Temporal overlap:** Two bags from the same vehicle with overlapping time ranges (start_time_A < end_time_B AND start_time_B < end_time_A). Keep the longer bag, discard the shorter.
3. **Semantic duplicates:** Different bags covering the same physical scenario (e.g., vehicle re-recorded the same route). Detect via GPS trajectory similarity (Dynamic Time Warping on lat/lon sequences, threshold DTW distance < 5m). Flag for manual review rather than auto-delete.

### 8.3 Coverage Analysis

Systematic tracking of which scenarios, locations, weather conditions, and object types are represented in the dataset:

```sql
-- Scenario coverage dashboard query
SELECT
    scenario_type,
    airport_code,
    COUNT(*) AS scene_count,
    SUM(duration_sec) / 3600.0 AS total_hours,
    COUNT(*) FILTER (WHERE has_labels) AS labeled_scenes,
    ROUND(100.0 * COUNT(*) FILTER (WHERE has_labels) / COUNT(*), 1) AS label_pct
FROM scenes s
JOIN bags b ON s.bag_id = b.bag_id
JOIN frames f ON f.scene_id = s.scene_id
GROUP BY scenario_type, airport_code
ORDER BY total_hours DESC;
```

**Coverage gaps to monitor:**
- Night operations (< 20% of data is typically night)
- Rain/fog conditions (< 5% for most airports)
- Rare GSE types (catering trucks, de-icing vehicles)
- Personnel in unusual positions (under aircraft, between dollies)
- FOD events (extremely rare but safety-critical)

### 8.4 Distribution Shift Monitoring

Detect when production data diverges from training data:

1. **Feature distribution tracking:** Compute mean and covariance of BEV feature vectors over the training set. Monitor the Mahalanobis distance of production frame features from the training distribution. Alert if the 95th percentile distance exceeds a threshold.
2. **Object class frequency drift:** Track the frequency of detected object classes per shift. If a class that normally appears 50 times/shift drops below 10, investigate (sensor issue, operational change, or model regression).
3. **Prediction confidence drift:** Rolling average of detection confidence scores. A gradual decline indicates the model is encountering increasingly unfamiliar data.

---

## 9. Feature Store and Training Data

### 9.1 Pre-Computed Features

For training pipelines that process raw point clouds, the compute cost of voxelization and feature extraction is repeated every epoch. Pre-computing and caching features saves 30-50% of training time.

| Feature Type | Computation | Storage/Frame | Use Case |
|---|---|---|---|
| Voxelized pillars (PointPillars) | Pillar creation + PointNet | ~2 MB | Detection training |
| BEV projection (height/density/intensity) | 2D histogram | ~0.5 MB | BEV detection |
| Range image (LiDAR) | Spherical projection | ~1 MB | Range-based detection |
| Occupancy grid (0.2m resolution) | GPU voxelization | ~4 MB | Occupancy prediction |
| Ground-removed cloud | RANSAC + filter | ~60% of raw | Any non-ground task |

```python
"""Pre-compute and cache voxelized features for PointPillars training."""

import numpy as np
from pathlib import Path

def precompute_pillars(
    frame_path: Path,
    output_path: Path,
    voxel_size: tuple = (0.16, 0.16, 4.0),
    point_cloud_range: tuple = (-51.2, -51.2, -3.0, 51.2, 51.2, 1.0),
    max_points_per_voxel: int = 32,
    max_voxels: int = 40000,
):
    """Voxelize a point cloud frame into PointPillars format."""
    points = np.load(frame_path)  # (N, 4)

    # Filter to range
    mask = (
        (points[:, 0] >= point_cloud_range[0]) &
        (points[:, 0] < point_cloud_range[3]) &
        (points[:, 1] >= point_cloud_range[1]) &
        (points[:, 1] < point_cloud_range[4]) &
        (points[:, 2] >= point_cloud_range[2]) &
        (points[:, 2] < point_cloud_range[5])
    )
    points = points[mask]

    # Compute voxel indices
    voxel_idx = np.floor(
        (points[:, :3] - np.array(point_cloud_range[:3])) /
        np.array(voxel_size)
    ).astype(np.int32)

    # Group points into voxels (simplified — production uses hash map)
    unique_voxels, inverse = np.unique(
        voxel_idx, axis=0, return_inverse=True
    )

    num_voxels = min(len(unique_voxels), max_voxels)
    pillar_features = np.zeros(
        (num_voxels, max_points_per_voxel, 4), dtype=np.float32
    )
    pillar_coords = unique_voxels[:num_voxels]
    num_points_per_voxel = np.zeros(num_voxels, dtype=np.int32)

    for i in range(num_voxels):
        voxel_points = points[inverse == i][:max_points_per_voxel]
        pillar_features[i, :len(voxel_points)] = voxel_points
        num_points_per_voxel[i] = len(voxel_points)

    # Save pre-computed features
    np.savez_compressed(
        output_path,
        pillar_features=pillar_features,
        pillar_coords=pillar_coords,
        num_points_per_voxel=num_points_per_voxel,
    )
```

### 9.2 Train/Val/Test Split Strategies

Temporal data requires careful splitting to avoid data leakage:

**Rule 1: No future leakage.** Validation and test sets must contain only data collected after the training set cutoff time. This mirrors production conditions where the model has never seen future scenarios.

**Rule 2: Temporal gap.** Maintain a minimum 5-minute gap between the end of any training scene and the start of any validation/test scene from the same vehicle on the same day. Adjacent scenes share visual context (same objects, same lighting) and inflate validation metrics.

**Rule 3: Vehicle split.** For the test set specifically, hold out data from at least 1-2 vehicles entirely. This tests generalization across sensor calibration differences and mounting positions.

**Rule 4: Airport split.** If operating at multiple airports, the test set should include at least one airport not represented in training. This is the hardest generalization test and the most representative of deployment to a new customer site.

```python
def generate_temporal_splits(
    scenes: list,
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    temporal_gap_sec: float = 300,
    holdout_vehicles: list = None,
    holdout_airports: list = None,
) -> dict:
    """Generate train/val/test splits respecting temporal ordering."""
    # Sort by timestamp
    scenes = sorted(scenes, key=lambda s: s['start_time'])

    # Holdout vehicle and airport data goes directly to test
    test_scenes = []
    remaining = []
    for scene in scenes:
        if (holdout_vehicles and scene['vehicle_id'] in holdout_vehicles) or \
           (holdout_airports and scene['airport_code'] in holdout_airports):
            test_scenes.append(scene)
        else:
            remaining.append(scene)

    # Split remaining temporally
    n = len(remaining)
    train_end = int(n * train_ratio)
    val_end = int(n * (train_ratio + val_ratio))

    train_scenes = remaining[:train_end]
    val_scenes = remaining[train_end:val_end]
    test_scenes.extend(remaining[val_end:])

    # Enforce temporal gap
    if train_scenes and val_scenes:
        train_max_time = max(s['end_time'] for s in train_scenes)
        val_scenes = [s for s in val_scenes
                      if s['start_time'] > train_max_time + temporal_gap_sec]

    return {
        'train': [s['scene_id'] for s in train_scenes],
        'val': [s['scene_id'] for s in val_scenes],
        'test': [s['scene_id'] for s in test_scenes],
    }
```

### 9.3 Balanced Sampling for Rare Classes

Airside datasets suffer from severe class imbalance: baggage tractors appear 100x more often than FOD. Without balanced sampling, the model learns to ignore rare classes.

| Class | Estimated Frequency | Sampling Strategy |
|---|---|---|
| Baggage tractor | Very common (50+ per shift) | Downsample 3x |
| Ground crew (person) | Common (20+ per shift) | No adjustment |
| Belt loader | Moderate (5-10 per shift) | Upsample 2x |
| Pushback tug | Moderate (3-8 per shift) | Upsample 2x |
| Fuel truck | Moderate (2-5 per shift) | Upsample 3x |
| Catering truck | Uncommon (1-3 per shift) | Upsample 5x |
| De-icing vehicle | Rare (seasonal) | Upsample 10x + augment |
| FOD | Very rare (0-1 per week) | Upsample 20x + synthetic |

**Implementation:** Use weighted random sampling in the DataLoader, with weights inversely proportional to class frequency. Additionally, apply copy-paste augmentation for rare objects: extract 3D bounding box contents of rare objects and paste them into other scenes at physically plausible locations.

---

## 10. Fleet Telemetry and Monitoring

### 10.1 Telemetry Architecture

```
┌─────────────────────────────────────────────┐
│  Vehicle Fleet (N vehicles)                  │
│  ┌─────────────────────────────────────────┐│
│  │  ROS Noetic                              ││
│  │  ┌─────────┐  ┌───────┐  ┌───────────┐ ││
│  │  │Perception│  │Planner│  │Localization│ ││
│  │  └────┬─────┘  └──┬────┘  └─────┬─────┘ ││
│  │       └─────┬──────┴────────────┘        ││
│  │             ▼                            ││
│  │  ┌──────────────────────┐                ││
│  │  │  Telegraf Agent      │                ││
│  │  │  (ROS topic → MQTT)  │                ││
│  │  └──────────┬───────────┘                ││
│  └─────────────┼────────────────────────────┘│
│                │ MQTT/TLS                     │
└────────────────┼─────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────┐
│  MQTT Broker (Mosquitto/EMQX) │
└────────────────┬───────────────┘
                 │
          ┌──────┴──────┐
          ▼             ▼
┌──────────────┐  ┌──────────────┐
│  InfluxDB    │  │  PostgreSQL  │
│  (time-series│  │  (events,    │
│   metrics)   │  │   alerts)    │
└──────┬───────┘  └──────┬───────┘
       │                 │
       └─────┬───────────┘
             ▼
     ┌───────────────┐
     │  Grafana       │
     │  Dashboards    │
     └───────────────┘
```

### 10.2 Key Metrics to Monitor

| Metric | Source Topic | Rate | Alert Threshold |
|---|---|---|---|
| Localization confidence | `/gtsam/confidence` | 10 Hz | < 0.7 for 5 consecutive sec |
| Perception latency | `/perception/timing` | 10 Hz | > 100 ms |
| Planning cycle time | `/planner/timing` | 10 Hz | > 50 ms |
| LiDAR message rate | `/rshelios_*/points` | 10 Hz | < 8 Hz for any sensor |
| IMU message rate | `/imu/data` | 500 Hz | < 400 Hz |
| RTK fix quality | `/fix` status field | 10 Hz | Loss of RTK fix > 10 sec |
| Battery SOC | `/vehicle/battery` | 1 Hz | < 15% |
| CPU/GPU temperature | `/diagnostics` | 1 Hz | > 85C |
| CAN bus error rate | `/can/errors` | 1 Hz | > 10 errors/sec |
| Safety event count | `/safety/event` | Event | Any occurrence |

### 10.3 Telegraf Configuration for ROS Telemetry

```toml
# telegraf.conf — on-vehicle telemetry collection agent

[global_tags]
  vehicle_id = "${VEHICLE_ID}"
  airport = "${AIRPORT_CODE}"
  vehicle_type = "${VEHICLE_TYPE}"

[agent]
  interval = "1s"
  flush_interval = "5s"
  hostname = "${VEHICLE_ID}"

# Input: ROS topic bridge via rosbridge_websocket
[[inputs.mqtt_consumer]]
  servers = ["tcp://localhost:1883"]
  topics = [
    "ros/localization/confidence",
    "ros/perception/timing",
    "ros/planner/timing",
    "ros/vehicle/battery",
    "ros/diagnostics/cpu_temp",
    "ros/diagnostics/gpu_temp",
  ]
  data_format = "json"
  topic_tag = "ros_topic"

# Input: System metrics
[[inputs.cpu]]
  percpu = false
  totalcpu = true
  collect_cpu_time = false

[[inputs.mem]]

[[inputs.disk]]
  mount_points = ["/", "/data"]

[[inputs.nvidia_smi]]
  # GPU utilization and memory for Orin

# Output: MQTT to fleet broker
[[outputs.mqtt]]
  servers = ["tcp://fleet-broker.aurrigo.internal:8883"]
  topic_prefix = "fleet/${VEHICLE_ID}"
  tls_ca = "/etc/telegraf/ca.pem"
  tls_cert = "/etc/telegraf/client.pem"
  tls_key = "/etc/telegraf/client-key.pem"
  data_format = "influx"

# Output: Local InfluxDB (buffer for offline periods)
[[outputs.influxdb_v2]]
  urls = ["http://localhost:8086"]
  token = "${INFLUXDB_TOKEN}"
  organization = "aurrigo"
  bucket = "vehicle_telemetry"
```

### 10.4 Grafana Dashboard Configuration

```json
{
  "dashboard": {
    "title": "Aurrigo Fleet Operations",
    "panels": [
      {
        "title": "Fleet Map",
        "type": "geomap",
        "datasource": "InfluxDB",
        "targets": [
          {
            "query": "from(bucket: \"fleet_telemetry\") |> range(start: -5m) |> filter(fn: (r) => r._measurement == \"gps_position\") |> last()"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "custom": {
              "hideFrom": { "tooltip": false, "viz": false }
            }
          }
        }
      },
      {
        "title": "Localization Confidence (All Vehicles)",
        "type": "timeseries",
        "datasource": "InfluxDB",
        "targets": [
          {
            "query": "from(bucket: \"fleet_telemetry\") |> range(start: -30m) |> filter(fn: (r) => r._measurement == \"localization_confidence\") |> aggregateWindow(every: 5s, fn: mean)"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "thresholds": {
              "steps": [
                { "value": 0, "color": "red" },
                { "value": 0.5, "color": "yellow" },
                { "value": 0.7, "color": "green" }
              ]
            }
          }
        }
      },
      {
        "title": "Perception Latency",
        "type": "timeseries",
        "datasource": "InfluxDB",
        "targets": [
          {
            "query": "from(bucket: \"fleet_telemetry\") |> range(start: -30m) |> filter(fn: (r) => r._measurement == \"perception_latency_ms\") |> aggregateWindow(every: 5s, fn: percentile, createEmpty: false) |> yield(name: \"p95\")"
          }
        ]
      },
      {
        "title": "Safety Events (Last 24h)",
        "type": "table",
        "datasource": "PostgreSQL",
        "targets": [
          {
            "rawSql": "SELECT event_type, vehicle_id, timestamp, priority, description FROM events WHERE timestamp > NOW() - INTERVAL '24 hours' ORDER BY priority ASC, timestamp DESC LIMIT 50"
          }
        ]
      },
      {
        "title": "Data Upload Progress",
        "type": "stat",
        "datasource": "InfluxDB",
        "targets": [
          {
            "query": "from(bucket: \"fleet_telemetry\") |> range(start: -24h) |> filter(fn: (r) => r._measurement == \"upload_bytes\") |> sum()"
          }
        ]
      },
      {
        "title": "Vehicle Battery Levels",
        "type": "bargauge",
        "datasource": "InfluxDB",
        "targets": [
          {
            "query": "from(bucket: \"fleet_telemetry\") |> range(start: -5m) |> filter(fn: (r) => r._measurement == \"battery_soc\") |> last() |> group(columns: [\"vehicle_id\"])"
          }
        ]
      }
    ]
  }
}
```

### 10.5 Alerting Rules

```yaml
# Grafana alerting rules
groups:
  - name: fleet_safety
    interval: 10s
    rules:
      - alert: LocalizationDegraded
        expr: localization_confidence < 0.5
        for: 10s
        labels:
          severity: critical
        annotations:
          summary: "Vehicle {{ $labels.vehicle_id }} localization confidence below 0.5"
          action: "Investigate immediately. Consider pulling vehicle from service."

      - alert: PerceptionLatencyHigh
        expr: perception_latency_ms > 150
        for: 30s
        labels:
          severity: warning
        annotations:
          summary: "Vehicle {{ $labels.vehicle_id }} perception latency exceeding 150ms"

      - alert: LiDARDropout
        expr: lidar_message_rate < 7
        for: 5s
        labels:
          severity: critical
        annotations:
          summary: "Vehicle {{ $labels.vehicle_id }} LiDAR {{ $labels.sensor_id }} message rate dropped to {{ $value }} Hz"
          action: "Pull vehicle from service. Check sensor hardware."

      - alert: BatteryLow
        expr: battery_soc < 10
        for: 60s
        labels:
          severity: warning
        annotations:
          summary: "Vehicle {{ $labels.vehicle_id }} battery at {{ $value }}%"
          action: "Route to nearest charging station."

      - alert: HighGPUTemperature
        expr: gpu_temperature_c > 90
        for: 30s
        labels:
          severity: warning
        annotations:
          summary: "Vehicle {{ $labels.vehicle_id }} GPU temperature {{ $value }}C"
          action: "Reduce compute load or check cooling system."
```

---

## 11. Storage and Cost Models

### 11.1 Storage Tier Architecture

| Tier | Storage Type | Access Latency | Cost/TB/Month | Retention | Data |
|---|---|---|---|---|---|
| Hot | On-vehicle NVMe SSD | <1 ms | N/A (capital) | 1-7 days | Current shift bags |
| Warm | On-prem NVMe/SSD (MinIO) | <5 ms | ~$4 (amortized) | 30-90 days | Recent bags, active datasets |
| Cool | On-prem HDD array (MinIO) | 10-50 ms | ~$1.50 (amortized) | 1 year | Processed bags, features |
| Cold | S3 Standard-IA | 50-200 ms | $12.50 | 1-5 years | Archived bags |
| Glacier | S3 Glacier Flexible | Minutes-hours | $3.60 | Permanent | Safety events, regulatory |
| Deep Archive | S3 Glacier Deep Archive | 12-48 hours | $1.00 | Permanent | Raw bags (regulatory hold) |

### 11.2 Retention Policies

| Data Type | Hot (On-Prem) | Cold (S3-IA) | Archive (Glacier) | Deep Archive |
|---|---|---|---|---|
| Raw bags (routine) | 30 days | — | — | 1 year then delete |
| Raw bags (safety events) | 90 days | 2 years | Permanent | — |
| Processed scenes/frames | 1 year | Permanent | — | — |
| Labeled datasets | Permanent | — | — | — |
| Trained model checkpoints | 1 year | 3 years | Permanent | — |
| Fleet telemetry | 90 days | 1 year | — | — |
| Diagnostic logs | 30 days | 1 year | — | — |

### 11.3 Cost Projections

**Assumptions:**
- LiDAR-only vehicles, Zstd-compressed bags (~125 GB/vehicle/day)
- 50% selective recording factor (62.5 GB/vehicle/day effectively stored long-term)
- 22 operational days/month
- 10% of data is labeled (higher cost per TB due to annotation)
- On-prem hardware amortized over 3 years

**5-Vehicle Fleet (Single Airport, Phase 1)**

| Cost Category | Monthly | Annual |
|---|---|---|
| On-vehicle SSDs (5x 2TB Samsung PM9A3) | — | $2,500 (one-time) |
| On-prem warm storage (MinIO, 32 TB NVMe) | $180 (amortized) | $2,160 |
| On-prem cool storage (MinIO, 100 TB HDD) | $125 (amortized) | $1,500 |
| S3 Standard-IA (archival, ~8 TB/month growing) | $100-400 | $3,000 |
| S3 Glacier (safety events, ~0.5 TB total) | $2 | $24 |
| Network (10 Gbps depot backhaul) | $200 | $2,400 |
| **Total storage cost** | **~$700** | **~$11,600** |
| Annotation (Segments.ai, 2,000 frames/month) | $600-2,000 | $7,200-24,000 |
| **Total with annotation** | **$1,300-2,700** | **$18,800-35,600** |

**25-Vehicle Fleet (2-3 Airports, Phase 2)**

| Cost Category | Monthly | Annual |
|---|---|---|
| On-vehicle SSDs (25x 2TB) | — | $12,500 (one-time) |
| On-prem warm storage (MinIO, 100 TB NVMe) | $550 | $6,600 |
| On-prem cool storage (MinIO, 500 TB HDD) | $625 | $7,500 |
| S3 Standard-IA (~40 TB/month growing) | $500-2,000 | $15,000 |
| S3 Glacier (~2 TB total) | $7 | $84 |
| Network (10 Gbps per depot x 3) | $600 | $7,200 |
| **Total storage cost** | **~$2,500** | **~$49,000** |
| Annotation (10,000 frames/month) | $5,000-15,000 | $60,000-180,000 |
| Compute (training, 4x A100 spot) | $2,000-4,000 | $24,000-48,000 |
| **Total with annotation + compute** | **$9,500-21,500** | **$133,000-277,000** |

**100-Vehicle Fleet (10+ Airports, Phase 3)**

| Cost Category | Monthly | Annual |
|---|---|---|
| On-vehicle SSDs (100x 2TB) | — | $50,000 (one-time) |
| On-prem warm storage (distributed MinIO, 400 TB) | $2,200 | $26,400 |
| On-prem cool storage (2 PB HDD) | $2,500 | $30,000 |
| S3 Standard-IA (~150 TB/month growing) | $1,875-8,000 | $50,000-96,000 |
| S3 Glacier (~10 TB total) | $36 | $432 |
| Network (10 Gbps per depot x 10) | $2,000 | $24,000 |
| **Total storage cost** | **~$10,000** | **~$230,000** |
| Annotation (50,000 frames/month, mixed in-house/outsource) | $25,000-75,000 | $300,000-900,000 |
| Compute (training cluster, 16x H100) | $15,000-30,000 | $180,000-360,000 |
| Data engineering team (3-5 engineers) | $30,000-60,000 | $360,000-720,000 |
| **Total pipeline cost** | **$80,000-175,000** | **$1.07M-2.21M** |

### 11.4 ROI Analysis

The cost of the data pipeline is justified by the model improvements it enables:

| Improvement | Value |
|---|---|
| 1% reduction in safety interventions | Avoids 1 operator per 2-3 vehicles (saving ~$60K/year per operator removed) |
| 10% reduction in turnaround time | $50K-200K/year per gate (airport revenue increase) |
| Faster new airport deployment | Each month saved = $100K-500K (earlier revenue recognition) |
| Reduced insurance premiums | 5-15% reduction with demonstrated safety data ($10K-50K/year per vehicle) |
| Regulatory approval acceleration | Data-backed safety cases reduce certification timeline by 3-6 months |

At the 25-vehicle fleet scale, removing safety operators from even 5 vehicles (enabled by ML improvements from the data pipeline) saves $300K/year in labor costs alone, exceeding the entire pipeline cost.

---

## 12. Integration with ML Training Pipeline

### 12.1 End-to-End Training Loop

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA FLYWHEEL                                 │
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ Collect   │───►│ Process  │───►│ Label    │───►│ Train    │  │
│  │ (Fleet)   │    │ (Pipeline│    │ (Active  │    │ (DVC +   │  │
│  │           │    │  + DVC)  │    │  Learning│    │  GPU)    │  │
│  └──────────┘    └──────────┘    └──────────┘    └─────┬────┘  │
│       ▲                                                 │       │
│       │          ┌──────────┐    ┌──────────┐          │       │
│       │          │ Monitor  │◄───│ Deploy   │◄─────────┘       │
│       └──────────│ (Grafana)│    │ (Shadow  │                   │
│                  │          │    │  + OTA)  │                   │
│                  └──────────┘    └──────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 12.2 Continuous Training Triggers

The training pipeline should not run on a fixed schedule. Instead, specific conditions trigger retraining:

| Trigger | Detection Method | Action |
|---|---|---|
| New labeled data exceeds threshold | Catalog query: unlabeled since last train > 5,000 frames | Full retrain or fine-tune |
| Performance degradation detected | Shadow mode: mAP drops > 5% vs baseline | Investigate + retrain |
| New airport data available | Catalog query: new airport_code with > 1,000 frames | Domain adaptation fine-tune |
| New object class encountered | OOD detector flags consistent unknown class | Label samples, add class, retrain |
| Seasonal change | Calendar trigger (winter: de-icing, summer: heat shimmer) | Augmented retrain |
| Model architecture update | Engineering decision | Full retrain on complete dataset |

### 12.3 Shadow Mode Integration

Shadow mode is the bridge between offline training and production deployment. The data pipeline feeds shadow mode in two directions:

1. **Data out:** Shadow mode disagreements (where the new model's decision differs from the production model or safety driver) are automatically tagged as high-priority upload data. This creates a natural active learning loop.

2. **Data in:** Shadow mode evaluation metrics (agreement rate, latency, resource consumption) flow into the telemetry pipeline and inform the next training iteration.

```python
"""Shadow mode disagreement detector for data pipeline integration."""

import rospy
from geometry_msgs.msg import PoseArray
from std_msgs.msg import Float32, String
import numpy as np


class ShadowDisagreementDetector:
    """Detect and log disagreements between production and shadow stacks."""

    def __init__(self, distance_threshold: float = 2.0, heading_threshold: float = 0.3):
        self.distance_threshold = distance_threshold  # meters
        self.heading_threshold = heading_threshold     # radians
        self.production_plan = None
        self.shadow_plan = None

        rospy.Subscriber('/planner/trajectory', PoseArray, self._prod_cb)
        rospy.Subscriber('/shadow/planner/trajectory', PoseArray, self._shadow_cb)
        self.disagreement_pub = rospy.Publisher(
            '/shadow/disagreement', String, queue_size=10
        )
        self.event_pub = rospy.Publisher(
            '/safety/event', String, queue_size=10
        )

    def _prod_cb(self, msg):
        self.production_plan = msg
        self._check_disagreement()

    def _shadow_cb(self, msg):
        self.shadow_plan = msg
        self._check_disagreement()

    def _check_disagreement(self):
        if self.production_plan is None or self.shadow_plan is None:
            return

        # Compare trajectory endpoints (5 seconds ahead)
        prod_end = self.production_plan.poses[-1].position
        shadow_end = self.shadow_plan.poses[-1].position

        distance = np.sqrt(
            (prod_end.x - shadow_end.x)**2 +
            (prod_end.y - shadow_end.y)**2
        )

        if distance > self.distance_threshold:
            msg = String()
            msg.data = f"trajectory_disagreement:distance={distance:.2f}m"
            self.disagreement_pub.publish(msg)

            # Trigger event for data pipeline (P1 priority upload)
            event_msg = String()
            event_msg.data = "shadow_disagreement"
            self.event_pub.publish(event_msg)
```

### 12.4 A/B Testing with Shadow Mode

When a new model candidate is ready, deploy it in shadow mode across a subset of the fleet:

1. **Deploy shadow model** to 3-5 vehicles via OTA (shadow stack only, production unchanged).
2. **Collect comparison data** for 1-2 weeks (minimum 10,000 decision points).
3. **Evaluate metrics:** Agreement rate with production, agreement rate with safety driver, latency, detection recall on known-difficult scenarios.
4. **Statistical significance test:** Fisher's exact test or chi-squared on disagreement categories.
5. **Promote or reject:** If shadow model outperforms on key metrics with p < 0.05, promote to production candidate.

### 12.5 Model Registry

```
model-registry/
├── pointpillars/
│   ├── v1.0.0/                     # Initial airside model
│   │   ├── model.onnx
│   │   ├── model_orin.trt          # TensorRT engine for Orin
│   │   ├── config.yaml
│   │   ├── metrics.json            # Evaluation metrics
│   │   ├── training_data.dvc       # DVC ref to exact training dataset
│   │   └── CHANGELOG.md
│   ├── v1.1.0/                     # + catering truck class
│   └── v2.0.0/                     # Architecture change
├── centernet/
│   └── v1.0.0/
└── registry.json                   # Model metadata index
```

```json
{
  "models": [
    {
      "name": "pointpillars",
      "version": "1.1.0",
      "status": "production",
      "deployed_to": ["ADT3-001", "ADT3-002", "ADT3-003", "STL2-001", "STL2-002"],
      "trained_on": "dataset-v1.2",
      "training_date": "2026-03-15",
      "metrics": {
        "mAP_3d": 0.68,
        "mAP_bev": 0.74,
        "inference_ms_orin": 6.84,
        "classes": 12
      },
      "shadow_tested": true,
      "shadow_agreement_rate": 0.94,
      "approved_by": "safety-team",
      "approval_date": "2026-04-01"
    }
  ]
}
```

---

## 13. Recommended Architecture for Aurrigo

### 13.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         VEHICLE LAYER                                    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Orin (ROS Noetic)                                              │    │
│  │  ┌────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐           │    │
│  │  │LiDAR x8│ │  GTSAM   │ │  Frenet  │ │ Perception│           │    │
│  │  │Drivers  │ │Localizer │ │ Planner  │ │ (current) │           │    │
│  │  └────┬───┘ └────┬─────┘ └────┬─────┘ └─────┬─────┘           │    │
│  │       │          │            │              │                  │    │
│  │  ┌────▼──────────▼────────────▼──────────────▼─────┐           │    │
│  │  │  Recording Tier Controller + rosbag record       │           │    │
│  │  └──────────────────┬──────────────────────────────┘           │    │
│  │                     │                                           │    │
│  │  ┌──────────────────▼──────────────────────────────┐           │    │
│  │  │  NVMe SSD (2TB)                                  │           │    │
│  │  │  - Bags with LZ4 compression                     │           │    │
│  │  │  - Priority queue manager                        │           │    │
│  │  └──────────────────┬──────────────────────────────┘           │    │
│  │                     │                                           │    │
│  │  ┌──────────────────▼──────────────────────────────┐           │    │
│  │  │  Telegraf Agent                                  │           │    │
│  │  │  - ROS metrics → MQTT (5G/CBRS)                 │           │    │
│  │  │  - Bag upload manager (WiFi at depot)            │           │    │
│  │  └──────────────────┬──────────────────────────────┘           │    │
│  └─────────────────────┼──────────────────────────────────────────┘    │
│                        │                                                 │
└────────────────────────┼─────────────────────────────────────────────────┘
                         │
            ┌────────────┴────────────┐
            │  5G/CBRS    │  WiFi     │
            │  (telemetry)│  (bags)   │
            └─────┬───────┴─────┬─────┘
                  │             │
┌─────────────────┼─────────────┼──────────────────────────────────────────┐
│                 │  AIRPORT DEPOT LAYER                                    │
│                 │             │                                           │
│  ┌──────────────▼──┐  ┌──────▼───────────────────────────────────┐      │
│  │  MQTT Broker     │  │  Ingest Gateway (nginx)                  │      │
│  │  (Mosquitto)     │  │  → Validation Service                    │      │
│  └────────┬─────────┘  │  → MinIO (on-prem hot storage, 32TB+)   │      │
│           │             │  → Metadata Extractor (async)            │      │
│           │             └──────────────┬─────────────────────────┘      │
│           │                            │                                 │
│  ┌────────▼─────────────────┐  ┌──────▼──────────────────────┐         │
│  │  InfluxDB (local)        │  │  PostgreSQL (catalog)        │         │
│  │  - Vehicle telemetry     │  │  - Bag/scene/frame metadata  │         │
│  │  - 90-day retention      │  │  - Label tracking            │         │
│  └──────────────────────────┘  │  - Event log                 │         │
│                                 └──────────────────────────────┘         │
└──────────────────────────────────────────────────────────────────────────┘
                         │
                    VPN / Direct Connect
                         │
┌────────────────────────┼─────────────────────────────────────────────────┐
│                   CLOUD / DATA CENTER LAYER                              │
│                        │                                                 │
│  ┌─────────────────────▼──────────────────────────────────────────┐     │
│  │  S3 / MinIO (archival)                                         │     │
│  │  - S3-IA: processed bags (1 year)                              │     │
│  │  - Glacier: safety events (permanent)                          │     │
│  │  - Deep Archive: regulatory hold                               │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  ┌────────────────────┐  ┌────────────────────┐  ┌──────────────────┐  │
│  │  Processing Workers │  │  DVC + Git Server   │  │  Grafana Cloud   │  │
│  │  (Celery + Redis)   │  │  (Dataset versions)  │  │  (Fleet dashboard│  │
│  │  - Bag → MCAP       │  │  - Experiment track  │  │   + alerts)      │  │
│  │  - Scene extraction │  │  - ML reproducibility│  └──────────────────┘  │
│  │  - Feature compute  │  └────────────────────┘                         │
│  └────────┬───────────┘                                                  │
│           │                                                              │
│  ┌────────▼───────────────────────────────────────────────────────┐     │
│  │  ML Training Cluster                                           │     │
│  │  - 4x A100 (Phase 1) → 16x H100 (Phase 3)                   │     │
│  │  - Training triggered by: new data, perf drop, new airport    │     │
│  │  - Model → ONNX → TensorRT → model registry → OTA deploy     │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │  Annotation Platform (Segments.ai)                             │     │
│  │  - Active learning frame selection                             │     │
│  │  - Pre-labeling with current model                             │     │
│  │  - QA review workflow                                          │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 13.2 Technology Stack

| Component | Recommended Tool | Alternative | Rationale |
|---|---|---|---|
| On-vehicle recording | `rosbag record` (LZ4) | MCAP writer | Native ROS 1 support |
| On-vehicle telemetry | Telegraf + MQTT | Custom ROS bridge | Lightweight, proven |
| MQTT broker | Mosquitto (< 25 vehicles) / EMQX (> 25) | HiveMQ | Open-source, scalable |
| Object storage (hot) | MinIO (on-prem) | Ceph | S3-compatible, simple ops |
| Object storage (archive) | AWS S3 + Glacier | GCS, Azure Blob | Cost-effective at scale |
| Metadata catalog | PostgreSQL | SQLite (< 10 vehicles) | JSONB for flexible metadata |
| Processing queue | Celery + Redis | Apache Airflow | Simpler for data pipelines |
| Batch bag processing | `rosbags` (Python) | `mcap` library | No ROS dependency |
| Format migration | Kappe + `mcap` CLI | `rosbags` convert | Batch-friendly |
| Dataset versioning | DVC | lakeFS (> 50 TB) | Git-native, ML-focused |
| Annotation platform | Segments.ai | CVAT (budget), Scale AI (scale) | Best 3D UX, active learning |
| Feature store | Pre-computed .npz on MinIO | Feast, custom DB | Simple, sufficient for < 100 TB |
| Visualization | Foxglove | Rerun.io | MCAP native, 10x faster than RViz |
| Time-series DB | InfluxDB v2 | TimescaleDB, Prometheus | Flux query, strong Grafana integration |
| Dashboards | Grafana | Custom web app | Industry standard, free tier |
| ML experiment tracking | DVC experiments + MLflow | Weights & Biases | DVC for data, MLflow for models |
| Model registry | MLflow Model Registry | Custom JSON + S3 | Standard, integrates with deployment |
| OTA deployment | NVIDIA Fleet Command | Custom (Ansible + rsync) | Manages Orin fleet natively |

### 13.3 Phased Deployment Plan

**Phase 1: Foundation (Months 1-3) — 5 Vehicles, 1 Airport**

| Week | Deliverable | Cost |
|---|---|---|
| 1-2 | Install NVMe SSDs, configure rosbag recording with LZ4 | $1,500 |
| 2-3 | Deploy Telegraf + Mosquitto for fleet telemetry | $500 (time) |
| 3-4 | Set up MinIO on depot server (32 TB), configure WiFi offload | $5,000 |
| 4-6 | PostgreSQL catalog, bag ingest pipeline, metadata extraction | $2,000 (time) |
| 6-8 | Bag processing pipeline (rosbags batch extraction, scene segmentation) | $2,000 (time) |
| 8-10 | DVC setup, first labeled dataset (5,000 frames via Segments.ai) | $5,000 |
| 10-12 | Grafana dashboards, alerting rules, monitoring operational | $1,000 (time) |
| **Total Phase 1** | | **~$17,000 + engineering time** |

**Phase 2: Scale (Months 4-9) — 25 Vehicles, 2-3 Airports**

| Month | Deliverable | Cost |
|---|---|---|
| 4 | Replicate depot infrastructure to 2nd airport | $8,000 |
| 5 | MCAP migration pipeline, long-term archival to S3 | $2,000 |
| 5-6 | Active learning loop: model uncertainty → frame selection → annotation | $5,000 |
| 6-7 | Shadow mode data integration, disagreement-triggered upload | $3,000 |
| 7-8 | Pre-computed feature store for training pipeline | $2,000 |
| 8-9 | Automated training triggers, model registry, A/B testing framework | $5,000 |
| **Total Phase 2** | | **~$25,000 + $150K annotation** |

**Phase 3: Production (Months 10-18) — 100 Vehicles, 10+ Airports**

| Quarter | Deliverable | Cost |
|---|---|---|
| Q4 | Distributed MinIO federation across airports | $30,000 |
| Q4 | EMQX cluster for high-throughput telemetry | $10,000 |
| Q5 | Automated new-airport onboarding pipeline | $15,000 |
| Q5 | Full continuous training loop (detect drift → retrain → shadow → deploy) | $20,000 |
| Q6 | Data quality automation (coverage analysis, distribution shift monitoring) | $10,000 |
| Q6 | Regulatory data retention and audit trail compliance | $5,000 |
| **Total Phase 3** | | **~$90,000 + $900K annotation + $360K compute** |

### 13.4 Total Cost of Ownership (3-Year Projection)

| Category | Year 1 | Year 2 | Year 3 | Total |
|---|---|---|---|---|
| Infrastructure (hardware + cloud) | $50K | $120K | $250K | $420K |
| Annotation | $30K | $180K | $500K | $710K |
| Compute (training) | $20K | $100K | $300K | $420K |
| Data engineering headcount (1→3→5) | $120K | $360K | $600K | $1.08M |
| Tooling licenses (Segments.ai, Grafana Enterprise) | $10K | $30K | $50K | $90K |
| **Total** | **$230K** | **$790K** | **$1.7M** | **$2.72M** |

**Break-even:** If the data pipeline enables removal of safety operators from 10 vehicles by Year 2 ($600K/year savings) and 30 vehicles by Year 3 ($1.8M/year savings), cumulative savings of $3.0M exceed the $2.72M total pipeline cost by end of Year 3.

---

## 14. References

### Tools and Platforms

1. DVC (Data Version Control). https://dvc.org/
2. lakeFS. https://lakefs.io/ — Acquired DVC in November 2025.
3. MinIO. https://min.io/ — S3-compatible object storage for AI workloads.
4. MCAP file format. https://mcap.dev/ — Default recording format for ROS 2.
5. Foxglove. https://foxglove.dev/ — Multimodal data visualization for robotics.
6. Rerun. https://rerun.io/ — Open-source multimodal data logging and visualization. Raised $17M seed in March 2025.
7. Kappe. https://discourse.openrobotics.org/t/kappe-the-new-mcap-migration-and-cutting-tool/32581 — MCAP migration tool.
8. rosbags (Python). https://pypi.org/project/rosbags/ — Standalone ROS bag reader, no ROS dependency.
9. Cloudini. https://github.com/facontidavide/cloudini — Point cloud compression library for ROS.
10. Segments.ai. https://segments.ai/ — 3D point cloud annotation platform.
11. CVAT. https://github.com/cvat-ai/cvat — Open-source annotation tool.
12. Telegraf. https://www.influxdata.com/time-series-platform/telegraf/ — Metrics collection agent.
13. InfluxDB. https://www.influxdata.com/ — Time-series database.
14. Grafana. https://grafana.com/ — Observability and dashboarding platform.
15. Mosquitto. https://mosquitto.org/ — Lightweight MQTT broker.
16. EMQX. https://www.emqx.io/ — Scalable MQTT broker for IoT.
17. MLflow. https://mlflow.org/ — ML experiment tracking and model registry.

### Cloud Services

18. AWS S3 pricing. https://aws.amazon.com/s3/pricing/ — Storage tiers from $0.023/GB (Standard) to $0.00099/GB (Deep Archive) per month.
19. AWS IoT FleetWise. https://aws.amazon.com/iot-fleetwise/ — Vehicle data collection service. Note: Not accepting new customers after April 30, 2026.
20. NVIDIA Fleet Command. https://www.nvidia.com/en-us/data-center/products/fleet-command/ — Edge AI fleet management.

### Research

21. ActiveAD: Planning-Oriented Active Learning for End-to-End Autonomous Driving. OpenReview, 2025. Achieves comparable performance with 30% of labeled data.
22. AVS: A Computational and Hierarchical Storage System for Autonomous Vehicles. arXiv:2511.19453, 2025. Addresses on-vehicle storage architecture for 14 TB/day workloads.
23. AWS + NVIDIA End-to-End Physical AI Data Pipeline. https://aws.amazon.com/blogs/industries/building-an-end-to-end-physical-ai-data-pipeline-for-autonomous-vehicle-3-0-on-aws-with-nvidia/ — Reference architecture for fleet-scale AV data.
24. Multi-Agent AI for Fleet Data Discovery and Edge Case Classification. AWS Blog, 2025. HDBSCAN-based edge case discovery.
25. Microsoft DataOps for Autonomous Vehicle Operations. https://learn.microsoft.com/en-us/azure/architecture/example-scenario/automotive/autonomous-vehicle-operations-dataops — Reference architecture.

### Industry Data Points

26. Autonomous vehicles generate 1-5 TB/hour (AWS IoT FleetWise documentation).
27. Level 4 AVs generate approximately 14-20 TB/day with full sensor suite logging (AVS paper, Premio Inc.).
28. Global data annotation market: $1.69B (2025), projected $14B by 2034. AVs account for 46% of market share.
29. Automotive NVMe SSD market: $1.42B (2024), projected $6.27B by 2033. CAGR 17.8%.
30. Tesla FSD: 8.3 billion miles by early 2026, bi-weekly OTA model updates.
31. Waymo: 2,500+ robotaxis, centralized fleet data management.
32. DFW Airport: $10M 5G deployment, 200+ Mbps across airfield.

### Related Documents in This Repository

33. `cross-cutting/data-engine-from-bags.md` — Detailed bag processing code for airside dataset creation.
34. `cross-cutting/data-engines-datasets.md` — Survey of AV datasets and data engine architectures.
35. `cross-cutting/3d-annotation-tools.md` — Comprehensive annotation tool comparison for airside objects.
36. `operations/deployment/production-ml-deployment.md` — TensorRT deployment, model monitoring, A/B testing.
37. `operations/deployment/ota-fleet-management.md` — OTA update architectures and fleet management platforms.
38. `operations/deployment/shadow-mode.md` — Shadow mode architecture for progressive AI deployment.
39. `operations/deployment/fleet-management-dispatch.md` — Fleet management and dispatch systems.
40. `hardware/connectivity/airport-5g-cbrs.md` — Airport 5G/CBRS network deployment and costs.
41. `cross-cutting/nuscenes-waymo-practical-guide.md` — Working with standard AV datasets.
42. `cross-cutting/transfer-learning.md` — Domain adaptation for airside from road datasets.
