# On-Vehicle Data Triage and Selective Upload Prioritization

## Complete Pipeline for Edge Data Management on Autonomous GSE

---

## Table of Contents

1. [Introduction and Motivation](#1-introduction-and-motivation)
2. [Ring Buffer Architecture](#2-ring-buffer-architecture)
3. [Event-Triggered Clip Extraction](#3-event-triggered-clip-extraction)
4. [Edge Scenario Classification](#4-edge-scenario-classification)
5. [Bandwidth-Aware Upload Scheduling](#5-bandwidth-aware-upload-scheduling)
6. [Data Retention Policies](#6-data-retention-policies)
7. [Rosbag Management and Tooling](#7-rosbag-management-and-tooling)
8. [Integration with Active Learning Pipeline](#8-integration-with-active-learning-pipeline)
9. [Fleet-Level Upload Coordination](#9-fleet-level-upload-coordination)
10. [Implementation Architecture](#10-implementation-architecture)
11. [Cost Model and Scaling](#11-cost-model-and-scaling)
12. [Key Takeaways](#12-key-takeaways)
13. [References](#13-references)

---

## 1. Introduction and Motivation

### 1.1 The Vehicle-Side Gap

The Aurrigo research repository documents what happens once data reaches the cloud (`cross-cutting/cloud-backend-infrastructure.md`) and how the closed-loop ML flywheel operates (`cross-cutting/data-flywheel-airside.md`). What is missing is the complete vehicle-side data management system: the ring buffers that hold sensor streams, the trigger logic that decides what to keep, the edge classifiers that score clips for annotation priority, the compression and upload scheduling that respects bandwidth constraints, and the retention policies that balance legal requirements against storage limits.

This document fills that gap. It covers everything that happens to sensor data from the moment it is published on a ROS topic to the moment it either leaves the vehicle for cloud upload or is evicted from local storage.

### 1.2 Why This Matters

Without disciplined on-vehicle triage, two failure modes dominate:

1. **Upload everything**: 4-8 RoboSense LiDARs at 10 Hz produce ~210 GB/day raw (see `cross-cutting/fleet-data-pipeline.md`). Even compressed, this exceeds any realistic upload budget by 3-4x. The result is either bandwidth saturation that disrupts V2X safety messages, or massive cloud storage bills dominated by empty taxiway scans that contribute nothing to model improvement.

2. **Upload nothing until manually triggered**: Safety events, perception edge cases, and calibration drift go unrecorded because no operator pressed a button. The data flywheel stalls. Models cannot improve. Competitive gap to UISEE (1,000+ vehicles generating continuous learning data) widens with every operational hour.

The triage system described here achieves a middle ground: continuous recording into ring buffers, automated extraction of high-value clips, edge classification for annotation prioritization, and bandwidth-aware upload scheduling that delivers 50 GB/day of curated data per vehicle to the cloud backend.

### 1.3 Data Volume Reality

From `cross-cutting/fleet-data-pipeline.md`, per-vehicle daily raw volumes:

| Source | Message Size | Rate | Daily (8h shift) | Compressed (LZ4) |
|--------|-------------|------|-------------------|-------------------|
| 4x RSHELIOS (32-beam) LiDAR | ~480 KB/scan | 10 Hz | 138 GB | ~100 GB |
| 4x RSBP (16-beam) LiDAR | ~256 KB/scan | 10 Hz | 74 GB | ~54 GB |
| Aggregated point cloud | ~2.9 MB/scan | 10 Hz | 84 GB | ~61 GB |
| IMU (500 Hz) | 64 bytes/msg | 500 Hz | 0.9 GB | ~0.5 GB |
| GTSAM poses (10 Hz) | 200 bytes/msg | 10 Hz | 5.8 MB | ~3 MB |
| CAN bus / DBW | 8-64 bytes/msg | 100 Hz | 0.18 GB | ~0.1 GB |
| Perception outputs | ~2 KB/msg | 10 Hz | 0.58 GB | ~0.3 GB |
| Planning state | ~1 KB/msg | 10 Hz | 0.29 GB | ~0.15 GB |
| **Total (LiDAR-only stack)** | | | **~298 GB** | **~216 GB** |

If cameras are added (planned for thermal and VLA integration):

| Source | Message Size | Rate | Daily (8h shift) | Compressed |
|--------|-------------|------|-------------------|------------|
| 4x RGB cameras (720p, H.265) | ~30 KB/frame | 20 Hz | 69 GB | N/A (already compressed) |
| 2x FLIR Boson 640 thermal (H.265) | ~8 KB/frame | 30 Hz | 1.4 GB | N/A |
| **Camera addition** | | | **~70 GB** | **~70 GB** |
| **Grand total (LiDAR + cameras)** | | | **~368 GB** | **~286 GB** |

Upload budget: 50 GB/day per vehicle (from `cloud-backend-infrastructure.md`). This means the triage system must achieve a **5.7x data reduction** (or 82.5% discard rate) while retaining 100% of safety-critical events and maximizing the information density of what reaches the cloud.

### 1.4 Document Scope and Integration

```
                    This Document
                    ┌──────────────────────────────┐
                    │  ON-VEHICLE DATA TRIAGE       │
                    │                               │
 ROS Topics ──────→│  Ring Buffers                 │
 (sensors,         │  Trigger Detection            │
  perception,      │  Clip Extraction              │
  planning)        │  Edge Classification          │
                    │  Compression                  │
                    │  Upload Scheduling            │──→ Cloud Backend
                    │  Local Retention              │    (cloud-backend-
                    │  Fleet Coordination           │     infrastructure.md)
                    └──────────────────────────────┘
                              │
                              ▼
                    Active Learning Pipeline
                    (data-flywheel-airside.md)
```

Related documents:
- `cross-cutting/cloud-backend-infrastructure.md` - Receiving end (S3 ingestion, data lake, Airflow DAGs)
- `cross-cutting/data-flywheel-airside.md` - Closed-loop ML from collected data
- `cross-cutting/data-engine-from-bags.md` - Rosbag batch processing for datasets
- `cross-cutting/fleet-data-pipeline.md` - End-to-end pipeline overview, DVC versioning
- `20-av-platform/compute/nvidia-orin-technical.md` - Orin memory/compute constraints
- `20-av-platform/networking-connectivity/airport-5g-cbrs.md` - Airport 5G bandwidth
- `operations/safety/runtime-verification-monitoring.md` - STL monitors that generate trigger events
- `20-av-platform/sensors/sensor-degradation-health-monitoring.md` - Sensor health signals as triggers

---

## 2. Ring Buffer Architecture

### 2.1 Design Requirements

The ring buffer subsystem must satisfy these constraints simultaneously:

1. **Zero message loss during normal operation**: Every sensor message must enter the buffer. Dropped messages mean gaps in safety event reconstruction.
2. **Bounded memory footprint**: Orin AGX 64 has 64 GB shared LPDDR5, of which perception + planning + control consume 10-18 GB at peak. The ring buffer must fit within a 4-8 GB memory allocation.
3. **Lock-free writes**: 4-8 LiDAR callbacks, IMU at 500 Hz, and 10+ other topics write concurrently. Mutex contention would introduce jitter in perception callbacks.
4. **Fast random access by timestamp**: Clip extraction needs to read a [t-30s, t+30s] window from the buffer without scanning the entire ring.
5. **Graceful overflow to NVMe**: When memory ring fills or a long clip is extracted, data spills to NVMe SSD without blocking sensor callbacks.

### 2.2 Memory Budget on Orin AGX 64

```
Orin AGX 64 Memory Map (64 GB LPDDR5 shared, 204.8 GB/s bandwidth):

┌─────────────────────────────────────────────────────────┐
│ Total: 64 GB LPDDR5                                      │
├─────────────────────────────────────────────────────────┤
│ Linux kernel + system         :  2-3 GB                  │
│ ROS Noetic core + nodelets    :  1-2 GB                  │
│ Perception pipeline (GPU+CPU) :  8-12 GB                 │
│   - PointPillars TRT engine   :    0.5 GB                │
│   - Multi-LiDAR preprocessing :    2-4 GB                │
│   - Tracking + fusion state   :    1-2 GB                │
│   - Occupancy grid            :    2-4 GB                │
│ Planning + control            :  1-2 GB                  │
│ GTSAM localization            :  2-3 GB                  │
│ V2X + telemetry               :  0.5-1 GB                │
│ Safety monitoring (STL + CBF) :  0.5-1 GB                │
│ ─────────────────────────────────────────                │
│ Subtotal (autonomy stack)     : 16-24 GB                 │
│                                                          │
│ RING BUFFER ALLOCATION        :  6 GB (target)           │
│ NVMe spill buffer             :  (uses disk, not RAM)    │
│ Upload staging + compression  :  2-4 GB                  │
│ Edge classifier (DLA)         :  0.5-1 GB                │
│ ─────────────────────────────────────────                │
│ Subtotal (data triage)        :  8.5-11 GB               │
│                                                          │
│ Headroom / fragmentation      : 29-39.5 GB               │
└─────────────────────────────────────────────────────────┘
```

**Decision: 6 GB in-memory ring buffer + NVMe spill.** This provides ~20-25 seconds of full-rate sensor data in RAM (sufficient for pre-roll capture), with NVMe extending to 60+ seconds for post-roll and longer clips.

### 2.3 Multi-Tier Buffer Design

The buffer uses three tiers matched to data rates and access patterns:

```
┌─────────────────────────────────────────────────────────────────┐
│                    MULTI-TIER RING BUFFER                        │
│                                                                  │
│  TIER 1: HOT (LPDDR5 in-memory)                                │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  LiDAR Ring     : 4 GB  ~17s of aggregated clouds     │     │
│  │  IMU Ring       : 64 MB ~500s at 500 Hz               │     │
│  │  Pose Ring      : 16 MB ~4000s at 10 Hz               │     │
│  │  CAN Ring       : 32 MB ~2000s at 100 Hz              │     │
│  │  Perception Ring: 128 MB ~660s at 10 Hz               │     │
│  │  Planning Ring  : 64 MB  ~2200s at 10 Hz              │     │
│  │  Camera Ring    : 1.5 GB ~7s (if cameras present)     │     │
│  │  Metadata Ring  : 128 MB index + timestamps           │     │
│  │  ────────────────────────────────────────              │     │
│  │  Total: ~6 GB   Retention: 17-25s (bottleneck: LiDAR) │     │
│  └────────────────────────────────────────────────────────┘     │
│       │ spill on clip extraction or overflow                     │
│       ▼                                                          │
│  TIER 2: WARM (NVMe SSD staging area)                           │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  Partition: /data/ring/  (500 GB allocated)            │     │
│  │  Format: sequential rosbag chunks (60s each)           │     │
│  │  Retention: rolling 10-15 minutes                      │     │
│  │  Write speed: 2-3 GB/s (NVMe Gen4 x4)                │     │
│  │  Eviction: oldest chunk deleted when partition >90%    │     │
│  └────────────────────────────────────────────────────────┘     │
│       │ clip extraction promotes to staging                      │
│       ▼                                                          │
│  TIER 3: COLD (NVMe SSD upload staging)                         │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  Partition: /data/upload/ (500 GB - 3 TB allocated)    │     │
│  │  Format: compressed rosbag clips + metadata JSON       │     │
│  │  Retention: until uploaded + confirmed by cloud        │     │
│  │  Managed by: upload scheduler daemon                   │     │
│  │  Eviction: FIFO by priority (low-priority first)       │     │
│  └────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

### 2.4 NVMe SSD Sizing

| Fleet Phase | NVMe Size | Ring Partition | Upload Staging | OS + Logs | Cost/Drive |
|-------------|-----------|---------------|----------------|-----------|------------|
| Pilot (5 vehicles) | 1 TB | 300 GB | 500 GB | 200 GB | $80-120 |
| Growth (20 vehicles) | 2 TB | 500 GB | 1.2 TB | 300 GB | $140-200 |
| Scale (50+ vehicles) | 4 TB | 500 GB | 3 TB | 500 GB | $300-450 |

**Key sizing insight**: The upload staging partition must buffer 2-3 days of extracted clips in case of extended connectivity loss. At 50 GB/day upload budget, that is 100-150 GB of compressed clips. However, safety events during connectivity outage could accumulate 10-30 GB/hour of high-priority data. A 2 TB staging partition provides comfortable headroom for a 48-hour outage.

**Drive recommendation**: Samsung 990 PRO 2 TB or Western Digital SN850X 2 TB. Both support sustained sequential writes at 2+ GB/s and have 1,200 TBW (terabytes written) endurance. At ~286 GB/day raw writes to the ring partition, the drive's write endurance supports ~4,200 days (~11.5 years) before theoretical write exhaustion. In practice, the ring buffer overwrites the same physical sectors, and NVMe wear leveling distributes writes across all NAND blocks.

### 2.5 Lock-Free Ring Buffer Implementation (C++)

The core ring buffer uses a single-producer-single-consumer (SPSC) design per topic, avoiding cross-topic lock contention. Each sensor callback writes to its own ring, and a background thread handles spill to NVMe.

```cpp
// ring_buffer.h
// Lock-free SPSC circular buffer for ROS sensor messages.
// Each topic gets its own ring instance. No mutexes on the hot path.

#pragma once

#include <atomic>
#include <cstdint>
#include <cstring>
#include <vector>
#include <ros/ros.h>
#include <topic_tools/shape_shifter.h>

namespace data_triage {

// Fixed-size slot header stored inline with serialized message data.
struct SlotHeader {
    uint64_t timestamp_ns;     // ROS timestamp as nanoseconds
    uint32_t data_size;        // Serialized message byte count
    uint32_t sequence;         // Monotonic sequence number
    uint16_t topic_hash;       // FNV-1a hash of topic name (for verification)
    uint16_t flags;            // 0x01 = compressed, 0x02 = camera, 0x04 = lidar
};
static_assert(sizeof(SlotHeader) == 20, "SlotHeader must be 20 bytes");

// Align slot starts to cache line boundary (64 bytes on ARM Cortex-A78AE).
constexpr size_t CACHE_LINE = 64;
inline size_t align_up(size_t val, size_t alignment) {
    return (val + alignment - 1) & ~(alignment - 1);
}

class SPSCRingBuffer {
public:
    // capacity_bytes: total ring buffer size for this topic.
    // max_msg_bytes: maximum single message size (for bounds checking).
    explicit SPSCRingBuffer(size_t capacity_bytes, size_t max_msg_bytes)
        : capacity_(capacity_bytes),
          max_msg_bytes_(max_msg_bytes),
          buffer_(capacity_bytes, 0),
          write_pos_(0),
          read_pos_(0),
          sequence_(0),
          dropped_count_(0) {}

    // Write a serialized ROS message into the ring.
    // Returns true if successful, false if message too large for buffer.
    // This is the ONLY function called from the sensor callback thread.
    bool write(const uint8_t* data, uint32_t size, uint64_t timestamp_ns,
               uint16_t topic_hash, uint16_t flags) {
        if (size > max_msg_bytes_ || size == 0) {
            dropped_count_.fetch_add(1, std::memory_order_relaxed);
            return false;
        }

        const size_t slot_size = align_up(sizeof(SlotHeader) + size, CACHE_LINE);

        // Snapshot read position (relaxed: producer only needs approximate)
        const size_t r_pos = read_pos_.load(std::memory_order_acquire);
        const size_t w_pos = write_pos_.load(std::memory_order_relaxed);

        // Available space calculation handles wrap-around
        size_t available;
        if (w_pos >= r_pos) {
            available = capacity_ - (w_pos - r_pos) - CACHE_LINE; // keep 1 CL gap
        } else {
            available = r_pos - w_pos - CACHE_LINE;
        }

        if (slot_size > available) {
            // Buffer full: overwrite oldest data by advancing read pointer.
            // This is the key design choice: we NEVER block the sensor callback.
            advance_read_past(slot_size);
            dropped_count_.fetch_add(1, std::memory_order_relaxed);
        }

        // Write header + data. If write wraps around the ring end, split across
        // boundary.
        SlotHeader header;
        header.timestamp_ns = timestamp_ns;
        header.data_size = size;
        header.sequence = sequence_++;
        header.topic_hash = topic_hash;
        header.flags = flags;

        write_bytes(w_pos, reinterpret_cast<const uint8_t*>(&header),
                    sizeof(SlotHeader));
        write_bytes((w_pos + sizeof(SlotHeader)) % capacity_, data, size);

        // Publish new write position (release: makes header+data visible to consumer)
        size_t new_w_pos = (w_pos + slot_size) % capacity_;
        write_pos_.store(new_w_pos, std::memory_order_release);

        return true;
    }

    // Read the oldest unread message. Called by the NVMe spill thread.
    // Returns false if no data available.
    bool read(uint8_t* out_data, uint32_t* out_size,
              SlotHeader* out_header) {
        const size_t w_pos = write_pos_.load(std::memory_order_acquire);
        const size_t r_pos = read_pos_.load(std::memory_order_relaxed);

        if (r_pos == w_pos) return false;  // Empty

        // Read header
        SlotHeader header;
        read_bytes(r_pos, reinterpret_cast<uint8_t*>(&header),
                   sizeof(SlotHeader));

        if (header.data_size > max_msg_bytes_) {
            // Corruption guard: skip this slot
            size_t skip = align_up(sizeof(SlotHeader) + max_msg_bytes_, CACHE_LINE);
            read_pos_.store((r_pos + skip) % capacity_, std::memory_order_release);
            return false;
        }

        // Read message data
        read_bytes((r_pos + sizeof(SlotHeader)) % capacity_,
                   out_data, header.data_size);
        *out_size = header.data_size;
        *out_header = header;

        // Advance read position
        size_t slot_size = align_up(sizeof(SlotHeader) + header.data_size,
                                     CACHE_LINE);
        read_pos_.store((r_pos + slot_size) % capacity_, std::memory_order_release);

        return true;
    }

    // Extract all messages within [start_ns, end_ns] without advancing read pointer.
    // Used by clip extraction. Returns vector of (header, data) pairs.
    // Note: This performs a full scan of the buffer and is NOT lock-free.
    // It acquires a snapshot by pausing the spill thread momentarily.
    std::vector<std::pair<SlotHeader, std::vector<uint8_t>>>
    extract_window(uint64_t start_ns, uint64_t end_ns) const {
        std::vector<std::pair<SlotHeader, std::vector<uint8_t>>> result;
        result.reserve(1024);  // Pre-allocate for typical 30s window

        const size_t w_pos = write_pos_.load(std::memory_order_acquire);
        size_t scan_pos = read_pos_.load(std::memory_order_acquire);

        while (scan_pos != w_pos) {
            SlotHeader header;
            read_bytes(scan_pos, reinterpret_cast<uint8_t*>(&header),
                       sizeof(SlotHeader));

            if (header.data_size > max_msg_bytes_) break;  // Corruption

            if (header.timestamp_ns >= start_ns &&
                header.timestamp_ns <= end_ns) {
                std::vector<uint8_t> data(header.data_size);
                read_bytes((scan_pos + sizeof(SlotHeader)) % capacity_,
                           data.data(), header.data_size);
                result.emplace_back(header, std::move(data));
            }

            size_t slot_size = align_up(sizeof(SlotHeader) + header.data_size,
                                         CACHE_LINE);
            scan_pos = (scan_pos + slot_size) % capacity_;

            // Early exit if we have passed the end of the window
            if (header.timestamp_ns > end_ns) break;
        }

        return result;
    }

    size_t dropped_count() const {
        return dropped_count_.load(std::memory_order_relaxed);
    }

    size_t used_bytes() const {
        size_t w = write_pos_.load(std::memory_order_acquire);
        size_t r = read_pos_.load(std::memory_order_acquire);
        return (w >= r) ? (w - r) : (capacity_ - r + w);
    }

private:
    void write_bytes(size_t pos, const uint8_t* src, size_t len) {
        size_t first_chunk = std::min(len, capacity_ - pos);
        std::memcpy(buffer_.data() + pos, src, first_chunk);
        if (first_chunk < len) {
            std::memcpy(buffer_.data(), src + first_chunk, len - first_chunk);
        }
    }

    void read_bytes(size_t pos, uint8_t* dst, size_t len) const {
        size_t first_chunk = std::min(len, capacity_ - pos);
        std::memcpy(dst, buffer_.data() + pos, first_chunk);
        if (first_chunk < len) {
            std::memcpy(dst, buffer_.data() + first_chunk, len - first_chunk);
        }
    }

    void advance_read_past(size_t needed_bytes) {
        size_t freed = 0;
        size_t r_pos = read_pos_.load(std::memory_order_relaxed);
        while (freed < needed_bytes) {
            SlotHeader header;
            read_bytes(r_pos, reinterpret_cast<uint8_t*>(&header),
                       sizeof(SlotHeader));
            size_t slot_size = align_up(sizeof(SlotHeader) + header.data_size,
                                         CACHE_LINE);
            r_pos = (r_pos + slot_size) % capacity_;
            freed += slot_size;
        }
        read_pos_.store(r_pos, std::memory_order_release);
    }

    const size_t capacity_;
    const size_t max_msg_bytes_;
    std::vector<uint8_t> buffer_;
    alignas(CACHE_LINE) std::atomic<size_t> write_pos_;
    alignas(CACHE_LINE) std::atomic<size_t> read_pos_;
    uint32_t sequence_;
    std::atomic<size_t> dropped_count_;
};

}  // namespace data_triage
```

### 2.6 Ring Buffer Manager (Multi-Topic Orchestration)

```cpp
// ring_buffer_manager.h
// Manages per-topic ring buffers and coordinates NVMe spill.

#pragma once

#include "ring_buffer.h"
#include <unordered_map>
#include <thread>
#include <ros/ros.h>

namespace data_triage {

struct TopicConfig {
    std::string topic_name;
    size_t ring_capacity_bytes;
    size_t max_msg_bytes;
    uint16_t flags;           // Bitmask: LIDAR=0x04, CAMERA=0x02, etc.
    bool spill_to_nvme;       // Whether to write through to NVMe ring
};

// Default configurations for Aurrigo sensor suite.
const std::vector<TopicConfig> DEFAULT_TOPIC_CONFIGS = {
    // LiDAR: 4 GB total across aggregated cloud
    {"/pointcloud_aggregator/output",     4ULL * 1024 * 1024 * 1024,
     4 * 1024 * 1024, 0x04, true},

    // IMU: 64 MB (500 Hz x 64 bytes x ~500s)
    {"/imu/data",                         64 * 1024 * 1024,
     256, 0x00, true},

    // GTSAM poses: 16 MB
    {"/localization/pose",                16 * 1024 * 1024,
     512, 0x00, true},

    // CAN bus / DBW feedback: 32 MB
    {"/can/vehicle_state",                32 * 1024 * 1024,
     256, 0x00, true},

    // Perception output (detections): 128 MB
    {"/perception/detections",            128 * 1024 * 1024,
     8192, 0x00, true},

    // Planning state: 64 MB
    {"/planning/trajectory",              64 * 1024 * 1024,
     4096, 0x00, true},

    // Safety monitor events: 16 MB (sparse but critical)
    {"/safety/stl_verdicts",              16 * 1024 * 1024,
     1024, 0x00, true},

    // Sensor health diagnostics: 8 MB
    {"/diagnostics/sensor_health",        8 * 1024 * 1024,
     2048, 0x00, true},

    // CBF filter state: 16 MB
    {"/safety/cbf_state",                 16 * 1024 * 1024,
     2048, 0x00, true},

    // Upload metadata ring: 128 MB (internal bookkeeping)
    {"/data_triage/metadata",             128 * 1024 * 1024,
     4096, 0x00, false},
};

// Camera topics (added when cameras are installed)
const std::vector<TopicConfig> CAMERA_TOPIC_CONFIGS = {
    {"/camera/front/compressed",          512 * 1024 * 1024,
     512 * 1024, 0x02, true},
    {"/camera/left/compressed",           256 * 1024 * 1024,
     512 * 1024, 0x02, true},
    {"/camera/right/compressed",          256 * 1024 * 1024,
     512 * 1024, 0x02, true},
    {"/camera/rear/compressed",           256 * 1024 * 1024,
     512 * 1024, 0x02, true},
    {"/thermal/front/image_raw",          128 * 1024 * 1024,
     1024 * 1024, 0x02, true},
    {"/thermal/rear/image_raw",           128 * 1024 * 1024,
     1024 * 1024, 0x02, true},
};

class RingBufferManager {
public:
    explicit RingBufferManager(const std::string& nvme_ring_path)
        : nvme_path_(nvme_ring_path), running_(false) {}

    void initialize(const std::vector<TopicConfig>& configs) {
        for (const auto& cfg : configs) {
            uint16_t topic_hash = fnv1a_hash(cfg.topic_name);
            auto ring = std::make_unique<SPSCRingBuffer>(
                cfg.ring_capacity_bytes, cfg.max_msg_bytes);

            topic_rings_[cfg.topic_name] = std::move(ring);
            topic_configs_[cfg.topic_name] = cfg;
            topic_hashes_[cfg.topic_name] = topic_hash;
        }
    }

    void start() {
        running_ = true;
        spill_thread_ = std::thread(&RingBufferManager::nvme_spill_loop, this);
    }

    void stop() {
        running_ = false;
        if (spill_thread_.joinable()) spill_thread_.join();
    }

    // Called from ROS subscriber callbacks.
    // The ShapeShifter allows subscribing to any message type generically.
    void on_message(const std::string& topic,
                    const topic_tools::ShapeShifter::ConstPtr& msg,
                    const ros::Time& stamp) {
        auto it = topic_rings_.find(topic);
        if (it == topic_rings_.end()) return;

        // Serialize message to byte buffer
        uint32_t serial_size = msg->size();
        thread_local std::vector<uint8_t> serial_buf(max_serial_size_);
        if (serial_size > serial_buf.size()) serial_buf.resize(serial_size);

        ros::serialization::OStream stream(serial_buf.data(), serial_size);
        msg->write(stream);

        uint64_t ts_ns = stamp.sec * 1000000000ULL + stamp.nsec;
        uint16_t hash = topic_hashes_[topic];
        uint16_t flags = topic_configs_[topic].flags;

        it->second->write(serial_buf.data(), serial_size, ts_ns, hash, flags);
    }

    // Extract all topics within a time window. Used by clip extractor.
    std::unordered_map<std::string,
        std::vector<std::pair<SlotHeader, std::vector<uint8_t>>>>
    extract_all_topics(uint64_t start_ns, uint64_t end_ns) {
        std::unordered_map<std::string,
            std::vector<std::pair<SlotHeader, std::vector<uint8_t>>>> result;

        for (auto& [topic, ring] : topic_rings_) {
            result[topic] = ring->extract_window(start_ns, end_ns);
        }
        return result;
    }

    // Get diagnostic summary for monitoring.
    std::unordered_map<std::string, size_t> get_dropped_counts() const {
        std::unordered_map<std::string, size_t> counts;
        for (const auto& [topic, ring] : topic_rings_) {
            counts[topic] = ring->dropped_count();
        }
        return counts;
    }

private:
    static uint16_t fnv1a_hash(const std::string& s) {
        uint16_t hash = 0x811c;
        for (char c : s) {
            hash ^= static_cast<uint16_t>(c);
            hash *= 0x0101;
        }
        return hash;
    }

    // Background thread: drain hot ring buffers to NVMe sequential chunks.
    void nvme_spill_loop() {
        const size_t CHUNK_DURATION_NS = 60ULL * 1000000000ULL;  // 60s chunks
        // Implementation: reads from each ring, writes to sequential
        // rosbag chunk files on NVMe. See Section 7 for rosbag format details.
        while (running_) {
            for (auto& [topic, ring] : topic_rings_) {
                if (!topic_configs_[topic].spill_to_nvme) continue;
                // Drain available messages to current NVMe chunk
                drain_ring_to_nvme(topic, *ring);
            }
            std::this_thread::sleep_for(std::chrono::milliseconds(50));
        }
    }

    void drain_ring_to_nvme(const std::string& topic, SPSCRingBuffer& ring) {
        thread_local std::vector<uint8_t> msg_buf(4 * 1024 * 1024);
        SlotHeader header;
        uint32_t msg_size;

        while (ring.read(msg_buf.data(), &msg_size, &header)) {
            // Write to current NVMe chunk file (rosbag format)
            write_to_nvme_chunk(topic, header, msg_buf.data(), msg_size);
        }
    }

    void write_to_nvme_chunk(const std::string& topic,
                              const SlotHeader& header,
                              const uint8_t* data, uint32_t size) {
        // Append to current 60s rosbag chunk.
        // Rotate chunk when duration exceeds 60s.
        // See Section 7.2 for chunk rotation logic.
    }

    std::string nvme_path_;
    std::atomic<bool> running_;
    std::thread spill_thread_;
    std::unordered_map<std::string, std::unique_ptr<SPSCRingBuffer>> topic_rings_;
    std::unordered_map<std::string, TopicConfig> topic_configs_;
    std::unordered_map<std::string, uint16_t> topic_hashes_;
    static constexpr size_t max_serial_size_ = 4 * 1024 * 1024;  // 4 MB
};

}  // namespace data_triage
```

### 2.7 Buffer Performance Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| Write latency (single LiDAR message, 2.9 MB) | ~1.2 us | memcpy to pre-allocated ring, no alloc |
| Write latency (IMU message, 64 bytes) | ~50 ns | Sub-cache-line write |
| Total write bandwidth (all topics) | ~330 MB/s peak | Well within LPDDR5 204.8 GB/s |
| NVMe spill bandwidth | 2-3 GB/s sustained | Samsung 990 PRO sequential write |
| Extract window (30s, all topics) | ~15-30 ms | Single scan of hot buffer |
| Memory overhead per ring instance | 48 bytes | Atomic positions + metadata |
| CPU cost (spill thread) | <2% of one A78AE core | Sleep 50ms between drain cycles |

### 2.8 Eviction Policy

The ring buffer uses a **non-blocking overwrite** policy for the hot tier: when the ring is full, the producer advances the read pointer to free space, discarding the oldest data. This guarantees that sensor callbacks never block, at the cost of potentially losing old data that was not yet spilled to NVMe.

For the NVMe warm tier, eviction follows a **priority-aware FIFO**:

1. Chunks older than 15 minutes are candidates for deletion.
2. If a chunk contains a trigger event timestamp, it is promoted to the upload staging partition instead of deleted.
3. If the ring partition exceeds 90% capacity, the oldest non-triggered chunk is deleted.
4. Chunks are never partially deleted; the 60-second granularity is the eviction unit.

```python
# nvme_eviction.py
# Manages NVMe warm ring partition lifecycle.

import os
import time
import json
from pathlib import Path
from typing import List, Set

class NVMeRingManager:
    """Manages 60s rosbag chunks on NVMe warm ring partition."""

    RING_PATH = Path("/data/ring")
    STAGING_PATH = Path("/data/upload")
    MAX_RING_USAGE_RATIO = 0.90      # Start eviction at 90% capacity
    MIN_RETENTION_SEC = 900           # Keep at least 15 minutes
    CHUNK_DURATION_SEC = 60

    def __init__(self, partition_size_gb: float = 500.0):
        self.partition_size_bytes = int(partition_size_gb * 1e9)
        self.triggered_timestamps: Set[float] = set()

    def register_trigger(self, trigger_time_sec: float, pre_roll_sec: float,
                          post_roll_sec: float):
        """Mark time window as triggered (do not evict)."""
        start = trigger_time_sec - pre_roll_sec
        end = trigger_time_sec + post_roll_sec
        # Mark every chunk that overlaps [start, end]
        chunk_start = start - (start % self.CHUNK_DURATION_SEC)
        while chunk_start <= end:
            self.triggered_timestamps.add(chunk_start)
            chunk_start += self.CHUNK_DURATION_SEC

    def evict_expired(self):
        """Delete oldest non-triggered chunks if capacity exceeded."""
        current_usage = self._get_usage_bytes()
        if current_usage < self.partition_size_bytes * self.MAX_RING_USAGE_RATIO:
            return  # No eviction needed

        chunks = self._list_chunks_sorted_by_age()
        now = time.time()

        for chunk_path, chunk_time in chunks:
            if current_usage < self.partition_size_bytes * 0.80:
                break  # Evicted enough

            age_sec = now - chunk_time
            if age_sec < self.MIN_RETENTION_SEC:
                continue  # Too recent

            if chunk_time in self.triggered_timestamps:
                # Promote to upload staging instead of deleting
                self._promote_to_staging(chunk_path, chunk_time)
            else:
                os.remove(chunk_path)

            current_usage -= os.path.getsize(chunk_path) if os.path.exists(chunk_path) else 0

    def _promote_to_staging(self, chunk_path: Path, chunk_time: float):
        """Move triggered chunk to upload staging partition."""
        dest = self.STAGING_PATH / chunk_path.name
        os.rename(str(chunk_path), str(dest))

    def _list_chunks_sorted_by_age(self) -> List:
        """List chunks sorted oldest first."""
        chunks = []
        for f in self.RING_PATH.glob("chunk_*.bag"):
            # Filename format: chunk_{timestamp_sec}.bag
            try:
                ts = float(f.stem.split("_")[1])
                chunks.append((f, ts))
            except (IndexError, ValueError):
                continue
        chunks.sort(key=lambda x: x[1])
        return chunks

    def _get_usage_bytes(self) -> int:
        """Get total disk usage of ring partition."""
        total = 0
        for f in self.RING_PATH.iterdir():
            if f.is_file():
                total += f.stat().st_size
        return total
```

---

## 3. Event-Triggered Clip Extraction

### 3.1 Trigger Taxonomy

Events that cause clip extraction fall into six categories, ordered by priority:

```
┌─────────────────────────────────────────────────────────────────┐
│                   TRIGGER PRIORITY HIERARCHY                     │
│                                                                  │
│  P0: SAFETY-CRITICAL (always extract, always upload)            │
│  ├── E-stop triggered (operator or autonomous)                  │
│  ├── Collision detected (bumper contact sensor)                 │
│  ├── CBF intervention (safety filter overrode planner)          │
│  ├── Geofence breach (runway incursion, restricted zone)        │
│  ├── Simplex switch (advanced→baseline controller failover)     │
│  └── Aircraft proximity violation (<3m clearance)               │
│                                                                  │
│  P1: PERCEPTION ANOMALY (extract if within budget)              │
│  ├── OOD score spike (energy score or Mahalanobis > threshold)  │
│  ├── Tracking failure (ID switch, track loss on large object)   │
│  ├── Novel object class (classifier confidence < 0.3 all classes)│
│  ├── Detection-tracking disagreement (>5 unmatched detections)  │
│  ├── Sensor degradation alert (LiDAR health check failure)      │
│  └── Multi-sensor inconsistency (LiDAR vs radar disagreement)  │
│                                                                  │
│  P2: LOCALIZATION EVENT (extract if within budget)              │
│  ├── GTSAM innovation spike (>3 sigma on any factor)            │
│  ├── GPS-denied transition (RTK fix lost)                       │
│  ├── Place recognition failure (no match in descriptor DB)      │
│  ├── Map-to-observation discrepancy (>0.5m systematic offset)   │
│  └── Calibration drift detected (inter-LiDAR consistency drop) │
│                                                                  │
│  P3: PLANNING EVENT (extract if within budget)                  │
│  ├── Frenet candidate exhaustion (<10 of 420 feasible)          │
│  ├── High-cost trajectory selected (cost > 90th percentile)     │
│  ├── Deadlock detected (zero-velocity for >10s not at stop)     │
│  ├── Path deviation >1m from planned route                      │
│  └── Unplanned stop (not at waypoint or hold-short)             │
│                                                                  │
│  P4: OPERATOR FLAG (extract always, upload as P1)               │
│  ├── One-button flag press (physical button or HMI)             │
│  └── Voice command flag (if voice interface installed)           │
│                                                                  │
│  P5: DIVERSITY SAMPLING (extract if within budget)              │
│  ├── Time-based sampling (every 30 minutes)                     │
│  ├── Distance-based sampling (every 5 km)                       │
│  ├── Weather transition detected (rain onset, fog, etc.)        │
│  └── New geographic area (first visit to this apron zone)       │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Trigger Detection Implementation

```python
#!/usr/bin/env python3
"""
trigger_detector.py
ROS node that monitors multiple topics and fires clip extraction triggers.
Runs alongside the ring buffer manager as part of the data triage system.
"""

import rospy
import numpy as np
from enum import IntEnum
from dataclasses import dataclass, field
from typing import Optional, List, Dict
from collections import deque
import time

from std_msgs.msg import Bool, Float64, String
from sensor_msgs.msg import PointCloud2
from geometry_msgs.msg import PoseStamped
from diagnostic_msgs.msg import DiagnosticArray


class Priority(IntEnum):
    """Upload priority levels. Lower number = higher priority."""
    SAFETY_CRITICAL = 0    # P0: always extract, always upload immediately
    PERCEPTION_ANOMALY = 1 # P1: extract within budget, upload high priority
    LOCALIZATION_EVENT = 2 # P2: extract within budget, upload medium priority
    PLANNING_EVENT = 3     # P3: extract within budget, upload medium priority
    OPERATOR_FLAG = 1      # P4: treated as P1 for upload
    DIVERSITY_SAMPLE = 4   # P5: extract if budget permits, upload low priority


@dataclass
class TriggerEvent:
    """Represents a detected trigger event."""
    trigger_type: str          # e.g., "estop", "ood_spike", "gtsam_innovation"
    priority: Priority
    timestamp_sec: float       # ROS time when trigger fired
    pre_roll_sec: float        # Seconds of data to capture before event
    post_roll_sec: float       # Seconds of data to capture after event
    metadata: Dict = field(default_factory=dict)
    topics_to_include: Optional[List[str]] = None  # None = all topics

    @property
    def clip_duration_sec(self) -> float:
        return self.pre_roll_sec + self.post_roll_sec

    @property
    def estimated_size_gb(self) -> float:
        """Estimate compressed clip size based on duration."""
        # ~7.5 GB/min for full sensor suite with LZ4 compression
        # ~0.125 GB/s = 0.125 * duration
        rate_gb_per_sec = 0.125
        if self.topics_to_include:
            # Rough topic-based scaling
            rate_gb_per_sec *= len(self.topics_to_include) / 12.0
        return rate_gb_per_sec * self.clip_duration_sec


# Trigger window configurations: (pre_roll_seconds, post_roll_seconds)
TRIGGER_WINDOWS = {
    # P0: Safety — long pre-roll to capture lead-up
    "estop":                    (30.0, 10.0),
    "collision":                (60.0, 30.0),
    "cbf_intervention":         (15.0,  5.0),
    "geofence_breach":          (30.0, 15.0),
    "simplex_switch":           (30.0, 15.0),
    "aircraft_proximity":       (15.0,  5.0),

    # P1: Perception — shorter, focused on the anomaly moment
    "ood_spike":                (10.0, 10.0),
    "tracking_failure":         (10.0,  5.0),
    "novel_object":             ( 5.0, 10.0),
    "detection_disagreement":   ( 5.0,  5.0),
    "sensor_degradation":       (10.0, 10.0),
    "multi_sensor_inconsistency":(5.0,  5.0),

    # P2: Localization
    "gtsam_innovation_spike":   (10.0,  5.0),
    "gps_denied_transition":    (15.0, 15.0),
    "place_recognition_fail":   (10.0, 10.0),
    "map_discrepancy":          ( 5.0,  5.0),
    "calibration_drift":        (30.0, 10.0),

    # P3: Planning
    "frenet_exhaustion":        (10.0,  5.0),
    "high_cost_trajectory":     ( 5.0,  5.0),
    "deadlock":                 (15.0, 10.0),
    "path_deviation":           (10.0,  5.0),
    "unplanned_stop":           ( 5.0, 10.0),

    # P4: Operator
    "operator_flag":            (30.0, 30.0),

    # P5: Diversity
    "time_sample":              (15.0, 15.0),
    "distance_sample":          (15.0, 15.0),
    "weather_transition":       (30.0, 60.0),
    "new_area":                 (15.0, 15.0),
}


class TriggerDetector:
    """
    Monitors ROS topics and detects events that should trigger clip extraction.
    Each trigger has configurable thresholds and cooldown periods to prevent
    flooding the upload queue with redundant clips.
    """

    def __init__(self):
        rospy.init_node("trigger_detector", anonymous=False)

        # Trigger output queue
        self.trigger_queue: deque = deque(maxlen=1000)

        # Cooldown tracking: trigger_type -> last_fire_time
        self.cooldowns: Dict[str, float] = {}
        self.cooldown_periods = {
            "estop": 0.0,              # No cooldown for safety events
            "collision": 0.0,
            "cbf_intervention": 2.0,   # Max once per 2 seconds
            "geofence_breach": 5.0,
            "ood_spike": 10.0,         # Max once per 10 seconds
            "tracking_failure": 5.0,
            "novel_object": 30.0,      # Max once per 30 seconds
            "gtsam_innovation_spike": 5.0,
            "gps_denied_transition": 30.0,
            "frenet_exhaustion": 10.0,
            "operator_flag": 0.0,      # No cooldown for manual flags
            "time_sample": 1800.0,     # Every 30 minutes
            "distance_sample": 0.0,    # Handled by distance tracking
        }

        # State tracking for multi-message triggers
        self.ood_scores = deque(maxlen=100)         # Rolling OOD score window
        self.gtsam_innovations = deque(maxlen=50)   # Rolling GTSAM innovation
        self.frenet_feasible_counts = deque(maxlen=20)
        self.trajectory_costs = deque(maxlen=1000)  # For percentile calc
        self.last_gps_status = "rtk_fixed"
        self.distance_since_last_sample_m = 0.0
        self.last_pose = None

        # Thresholds (tunable via rosparam)
        self.ood_threshold = rospy.get_param("~ood_threshold", 5.0)
        self.gtsam_sigma_threshold = rospy.get_param("~gtsam_sigma_threshold", 3.0)
        self.frenet_min_feasible = rospy.get_param("~frenet_min_feasible", 10)
        self.trajectory_cost_percentile = rospy.get_param("~cost_percentile", 90)
        self.aircraft_min_clearance_m = rospy.get_param("~aircraft_min_clearance_m", 3.0)
        self.path_deviation_threshold_m = rospy.get_param("~path_deviation_m", 1.0)
        self.distance_sample_interval_m = rospy.get_param("~distance_sample_m", 5000.0)

        # Set up subscribers
        self._setup_subscribers()

        rospy.loginfo("TriggerDetector initialized with %d trigger types",
                      len(TRIGGER_WINDOWS))

    def _setup_subscribers(self):
        """Subscribe to all monitored topics."""
        # Safety topics
        rospy.Subscriber("/safety/estop", Bool, self._cb_estop)
        rospy.Subscriber("/safety/cbf_state", Float64, self._cb_cbf)
        rospy.Subscriber("/safety/geofence_status", String, self._cb_geofence)
        rospy.Subscriber("/safety/simplex_mode", String, self._cb_simplex)
        rospy.Subscriber("/safety/collision_detect", Bool, self._cb_collision)

        # Perception topics
        rospy.Subscriber("/perception/ood_score", Float64, self._cb_ood)
        rospy.Subscriber("/perception/detections", String, self._cb_detections)
        rospy.Subscriber("/diagnostics/sensor_health", DiagnosticArray,
                         self._cb_sensor_health)

        # Localization topics
        rospy.Subscriber("/localization/innovation_norm", Float64,
                         self._cb_gtsam_innovation)
        rospy.Subscriber("/localization/gps_status", String, self._cb_gps_status)
        rospy.Subscriber("/localization/pose", PoseStamped, self._cb_pose)

        # Planning topics
        rospy.Subscriber("/planning/feasible_count", Float64,
                         self._cb_frenet_feasible)
        rospy.Subscriber("/planning/trajectory_cost", Float64,
                         self._cb_trajectory_cost)

        # Operator flag (physical button or HMI)
        rospy.Subscriber("/hmi/flag_event", Bool, self._cb_operator_flag)

        # Timer-based diversity sampling
        rospy.Timer(rospy.Duration(1800), self._cb_time_sample)  # 30 min

    def _fire_trigger(self, trigger_type: str, priority: Priority,
                      metadata: Optional[Dict] = None):
        """Fire a trigger if not in cooldown."""
        now = time.time()
        cooldown = self.cooldown_periods.get(trigger_type, 5.0)
        last_fire = self.cooldowns.get(trigger_type, 0.0)

        if now - last_fire < cooldown:
            return  # Still in cooldown

        self.cooldowns[trigger_type] = now
        pre_roll, post_roll = TRIGGER_WINDOWS.get(trigger_type, (10.0, 10.0))

        event = TriggerEvent(
            trigger_type=trigger_type,
            priority=priority,
            timestamp_sec=rospy.Time.now().to_sec(),
            pre_roll_sec=pre_roll,
            post_roll_sec=post_roll,
            metadata=metadata or {},
        )

        self.trigger_queue.append(event)
        rospy.loginfo("TRIGGER [P%d] %s (clip: %.0fs pre + %.0fs post, ~%.2f GB)",
                      priority, trigger_type, pre_roll, post_roll,
                      event.estimated_size_gb)

    # --- Safety Callbacks (P0) ---

    def _cb_estop(self, msg):
        if msg.data:
            self._fire_trigger("estop", Priority.SAFETY_CRITICAL,
                               {"source": "estop_button"})

    def _cb_collision(self, msg):
        if msg.data:
            self._fire_trigger("collision", Priority.SAFETY_CRITICAL)

    def _cb_cbf(self, msg):
        # CBF intervention: filter output differs from planner output by > threshold
        if msg.data > 0.1:  # Normalized intervention magnitude
            self._fire_trigger("cbf_intervention", Priority.SAFETY_CRITICAL,
                               {"intervention_magnitude": msg.data})

    def _cb_geofence(self, msg):
        if msg.data in ("breach", "warning"):
            self._fire_trigger("geofence_breach", Priority.SAFETY_CRITICAL,
                               {"zone": msg.data})

    def _cb_simplex(self, msg):
        if msg.data == "baseline":
            self._fire_trigger("simplex_switch", Priority.SAFETY_CRITICAL)

    # --- Perception Callbacks (P1) ---

    def _cb_ood(self, msg):
        self.ood_scores.append(msg.data)
        # Spike detection: current score > threshold AND > 2x rolling median
        if len(self.ood_scores) >= 10:
            median_score = float(np.median(list(self.ood_scores)[-50:]))
            if msg.data > self.ood_threshold and msg.data > 2.0 * max(median_score, 0.1):
                self._fire_trigger("ood_spike", Priority.PERCEPTION_ANOMALY,
                                   {"ood_score": msg.data, "median": median_score})

    def _cb_detections(self, msg):
        # Parse detection message for anomalies.
        # Simplified: check for novel objects (max class confidence < 0.3)
        # and tracking disagreements in actual implementation.
        pass

    def _cb_sensor_health(self, msg):
        for status in msg.status:
            if status.level >= 1:  # WARN or ERROR
                self._fire_trigger("sensor_degradation", Priority.PERCEPTION_ANOMALY,
                                   {"sensor": status.name,
                                    "level": status.level,
                                    "message": status.message})

    # --- Localization Callbacks (P2) ---

    def _cb_gtsam_innovation(self, msg):
        self.gtsam_innovations.append(msg.data)
        if len(self.gtsam_innovations) >= 5:
            mean_innov = float(np.mean(list(self.gtsam_innovations)[-20:]))
            std_innov = float(np.std(list(self.gtsam_innovations)[-20:]))
            if std_innov > 0 and msg.data > mean_innov + self.gtsam_sigma_threshold * std_innov:
                self._fire_trigger("gtsam_innovation_spike",
                                   Priority.LOCALIZATION_EVENT,
                                   {"innovation": msg.data, "mean": mean_innov})

    def _cb_gps_status(self, msg):
        if self.last_gps_status == "rtk_fixed" and msg.data != "rtk_fixed":
            self._fire_trigger("gps_denied_transition",
                               Priority.LOCALIZATION_EVENT,
                               {"previous": self.last_gps_status,
                                "current": msg.data})
        self.last_gps_status = msg.data

    def _cb_pose(self, msg):
        # Distance-based diversity sampling
        if self.last_pose is not None:
            dx = msg.pose.position.x - self.last_pose.pose.position.x
            dy = msg.pose.position.y - self.last_pose.pose.position.y
            dist = (dx**2 + dy**2) ** 0.5
            self.distance_since_last_sample_m += dist

            if self.distance_since_last_sample_m >= self.distance_sample_interval_m:
                self._fire_trigger("distance_sample", Priority.DIVERSITY_SAMPLE,
                                   {"distance_km": self.distance_since_last_sample_m / 1000.0})
                self.distance_since_last_sample_m = 0.0

        self.last_pose = msg

    # --- Planning Callbacks (P3) ---

    def _cb_frenet_feasible(self, msg):
        self.frenet_feasible_counts.append(msg.data)
        if msg.data < self.frenet_min_feasible:
            self._fire_trigger("frenet_exhaustion", Priority.PLANNING_EVENT,
                               {"feasible_count": int(msg.data)})

    def _cb_trajectory_cost(self, msg):
        self.trajectory_costs.append(msg.data)
        if len(self.trajectory_costs) >= 100:
            threshold = float(np.percentile(list(self.trajectory_costs),
                                            self.trajectory_cost_percentile))
            if msg.data > threshold:
                self._fire_trigger("high_cost_trajectory", Priority.PLANNING_EVENT,
                                   {"cost": msg.data, "threshold": threshold})

    # --- Operator Callback (P4) ---

    def _cb_operator_flag(self, msg):
        if msg.data:
            self._fire_trigger("operator_flag", Priority.OPERATOR_FLAG,
                               {"source": "hmi_button"})

    # --- Diversity Timer (P5) ---

    def _cb_time_sample(self, event):
        self._fire_trigger("time_sample", Priority.DIVERSITY_SAMPLE)

    def get_pending_triggers(self) -> List[TriggerEvent]:
        """Drain all pending triggers for the clip extractor."""
        events = list(self.trigger_queue)
        self.trigger_queue.clear()
        return events
```

### 3.3 Clip Extraction Pipeline

When a trigger fires, the clip extractor reads the appropriate time window from the ring buffer (hot tier) and/or NVMe warm tier and produces a self-contained compressed rosbag.

```
Trigger Event
    │
    ▼
┌───────────────────────────────────────────────────┐
│ CLIP EXTRACTION PIPELINE                           │
│                                                    │
│  1. Compute time window:                           │
│     start = trigger_time - pre_roll                │
│     end   = trigger_time + post_roll               │
│                                                    │
│  2. Determine data sources:                        │
│     ┌─ Hot ring buffer (if window is recent)       │
│     └─ NVMe warm chunks (if window extends back)   │
│                                                    │
│  3. Extract messages within [start, end]:          │
│     - All topics (default) or topic subset          │
│     - Merge from hot + warm if window spans both    │
│                                                    │
│  4. Write compressed rosbag:                       │
│     - LZ4 compression for point clouds             │
│     - JSON sidecar with trigger metadata            │
│     - SHA-256 checksum for integrity verification   │
│                                                    │
│  5. Run edge classifier (async, on DLA):           │
│     - Classify scenario type                        │
│     - Score annotation priority                     │
│     - Attach classification to metadata             │
│                                                    │
│  6. Enqueue to upload staging:                     │
│     - Place in /data/upload/P{priority}/            │
│     - Register with upload scheduler                │
└───────────────────────────────────────────────────┘
```

```python
# clip_extractor.py
# Extracts and packages clips from ring buffer when triggers fire.

import os
import json
import hashlib
import subprocess
import time
from pathlib import Path
from typing import List, Dict, Optional
from dataclasses import asdict

# Using rosbags library (standalone, no ROS dependency for the writing part)
from rosbags.rosbag1 import Writer as BagWriter
from rosbags.typesys import get_types_from_msg, register_types


class ClipExtractor:
    """
    Extracts sensor data clips from the ring buffer system and produces
    self-contained compressed rosbag files ready for upload.
    """

    STAGING_PATH = Path("/data/upload")
    NVME_RING_PATH = Path("/data/ring")

    # Maximum clip sizes by priority (to prevent budget blowout)
    MAX_CLIP_SIZE_GB = {
        0: 10.0,   # P0: Safety — no practical limit
        1: 3.0,    # P1: Perception anomaly
        2: 2.0,    # P2: Localization event
        3: 1.5,    # P3: Planning event
        4: 0.5,    # P5: Diversity sample
    }

    def __init__(self, ring_buffer_manager, daily_budget_gb: float = 50.0):
        self.ring_mgr = ring_buffer_manager
        self.daily_budget_gb = daily_budget_gb
        self.daily_extracted_gb = 0.0
        self.extraction_log: List[Dict] = []

    def process_triggers(self, triggers: List) -> List[Path]:
        """Process a batch of trigger events. Returns paths of created clips."""
        # Sort by priority (most critical first)
        triggers.sort(key=lambda t: t.priority)

        extracted_paths = []
        for trigger in triggers:
            # Budget check for non-safety triggers
            if trigger.priority > 0:
                remaining = self.daily_budget_gb - self.daily_extracted_gb
                if trigger.estimated_size_gb > remaining:
                    # Skip non-critical triggers if over budget
                    self._log_skipped(trigger, "budget_exceeded")
                    continue

            clip_path = self._extract_clip(trigger)
            if clip_path:
                extracted_paths.append(clip_path)
                clip_size_gb = clip_path.stat().st_size / 1e9
                self.daily_extracted_gb += clip_size_gb

        return extracted_paths

    def _extract_clip(self, trigger) -> Optional[Path]:
        """Extract a single clip from ring buffers."""
        start_ns = int((trigger.timestamp_sec - trigger.pre_roll_sec) * 1e9)
        end_ns = int((trigger.timestamp_sec + trigger.post_roll_sec) * 1e9)

        # Determine output path
        priority_dir = self.STAGING_PATH / f"P{trigger.priority}"
        priority_dir.mkdir(parents=True, exist_ok=True)

        timestamp_str = time.strftime("%Y%m%d_%H%M%S",
                                       time.gmtime(trigger.timestamp_sec))
        clip_name = f"{trigger.trigger_type}_{timestamp_str}"
        bag_path = priority_dir / f"{clip_name}.bag"
        meta_path = priority_dir / f"{clip_name}.json"

        # Step 1: Try extracting from hot ring buffer
        hot_data = self.ring_mgr.extract_all_topics(start_ns, end_ns)

        # Step 2: Check if we need NVMe warm data (pre-roll extends beyond hot)
        warm_data = {}
        hot_oldest_ns = self._get_oldest_timestamp(hot_data)
        if hot_oldest_ns is None or hot_oldest_ns > start_ns:
            warm_data = self._extract_from_nvme_chunks(start_ns,
                                                        hot_oldest_ns or end_ns)

        # Step 3: Merge hot + warm data
        merged = self._merge_data(warm_data, hot_data)

        if not any(msgs for msgs in merged.values()):
            return None  # No data in window

        # Step 4: Write compressed rosbag
        total_messages = self._write_rosbag(bag_path, merged)

        # Step 5: Compute checksum
        checksum = self._sha256(bag_path)

        # Step 6: Write metadata sidecar
        metadata = {
            "trigger_type": trigger.trigger_type,
            "priority": int(trigger.priority),
            "timestamp_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ",
                                            time.gmtime(trigger.timestamp_sec)),
            "timestamp_sec": trigger.timestamp_sec,
            "pre_roll_sec": trigger.pre_roll_sec,
            "post_roll_sec": trigger.post_roll_sec,
            "clip_duration_sec": trigger.clip_duration_sec,
            "bag_size_bytes": bag_path.stat().st_size,
            "bag_size_gb": bag_path.stat().st_size / 1e9,
            "total_messages": total_messages,
            "sha256": checksum,
            "topics": list(merged.keys()),
            "trigger_metadata": trigger.metadata,
            "vehicle_id": os.environ.get("VEHICLE_ID", "unknown"),
            "airport_code": os.environ.get("AIRPORT_CODE", "unknown"),
            "edge_classification": None,  # Filled by edge classifier
        }

        with open(meta_path, "w") as f:
            json.dump(metadata, f, indent=2)

        self._log_extraction(trigger, bag_path, metadata)
        return bag_path

    def _extract_from_nvme_chunks(self, start_ns: int,
                                   end_ns: int) -> Dict:
        """Read messages from NVMe warm ring chunks covering [start, end]."""
        result = {}
        # Find chunks that overlap the time window
        start_sec = start_ns / 1e9
        end_sec = end_ns / 1e9

        for chunk_file in sorted(self.NVME_RING_PATH.glob("chunk_*.bag")):
            try:
                chunk_ts = float(chunk_file.stem.split("_")[1])
            except (IndexError, ValueError):
                continue

            # Each chunk covers [chunk_ts, chunk_ts + 60]
            chunk_end = chunk_ts + 60.0
            if chunk_end < start_sec or chunk_ts > end_sec:
                continue

            # Read messages from this chunk within the window
            chunk_data = self._read_bag_window(chunk_file, start_ns, end_ns)
            for topic, msgs in chunk_data.items():
                result.setdefault(topic, []).extend(msgs)

        return result

    def _read_bag_window(self, bag_path: Path,
                          start_ns: int, end_ns: int) -> Dict:
        """Read messages from a rosbag within a time window."""
        from rosbags.rosbag1 import Reader
        result = {}

        try:
            with Reader(bag_path) as reader:
                for connection, timestamp, rawdata in reader.messages():
                    if start_ns <= timestamp <= end_ns:
                        result.setdefault(connection.topic, []).append(
                            (timestamp, rawdata))
        except Exception:
            pass  # Corrupted chunk, skip silently

        return result

    def _merge_data(self, warm: Dict, hot: Dict) -> Dict:
        """Merge warm (NVMe) and hot (RAM) data, deduplicate by timestamp."""
        merged = {}
        all_topics = set(warm.keys()) | set(hot.keys())

        for topic in all_topics:
            warm_msgs = warm.get(topic, [])
            hot_msgs = hot.get(topic, [])
            # Hot data takes precedence (more recent, no NVMe latency artifacts)
            all_msgs = warm_msgs + hot_msgs
            # Sort by timestamp and deduplicate
            all_msgs.sort(key=lambda m: m[0] if isinstance(m, tuple)
                          else m.timestamp_ns)
            merged[topic] = all_msgs

        return merged

    def _write_rosbag(self, path: Path, data: Dict) -> int:
        """Write merged data to a compressed rosbag file."""
        total_messages = 0
        # Use subprocess to call rosbag-based writer with LZ4 compression
        # (rosbags library handles serialization)
        # In production, this would use the rosbags Writer API
        for topic, messages in data.items():
            total_messages += len(messages)
        return total_messages

    def _sha256(self, path: Path) -> str:
        """Compute SHA-256 checksum of a file."""
        h = hashlib.sha256()
        with open(path, "rb") as f:
            while True:
                chunk = f.read(65536)
                if not chunk:
                    break
                h.update(chunk)
        return h.hexdigest()

    def _log_extraction(self, trigger, bag_path: Path, metadata: Dict):
        """Log extraction for monitoring and daily accounting."""
        self.extraction_log.append({
            "time": time.time(),
            "trigger": trigger.trigger_type,
            "priority": int(trigger.priority),
            "size_gb": metadata["bag_size_gb"],
            "path": str(bag_path),
        })

    def _log_skipped(self, trigger, reason: str):
        """Log skipped trigger for monitoring."""
        self.extraction_log.append({
            "time": time.time(),
            "trigger": trigger.trigger_type,
            "priority": int(trigger.priority),
            "skipped": True,
            "reason": reason,
        })

    def _get_oldest_timestamp(self, data: Dict) -> Optional[int]:
        """Get the oldest timestamp across all topics in extracted data."""
        oldest = None
        for topic, msgs in data.items():
            for msg in msgs:
                ts = msg[0] if isinstance(msg, tuple) else msg.timestamp_ns
                if oldest is None or ts < oldest:
                    oldest = ts
        return oldest
```

### 3.4 Pre-Roll and Post-Roll Budget

The pre-roll (data before event) and post-roll (data after event) durations determine both the information value of the clip and its size. Longer pre-roll captures more context about what caused the event; longer post-roll captures the vehicle's response and resolution.

| Trigger Type | Pre-Roll | Post-Roll | Total Duration | Est. Size (LZ4) | Rationale |
|-------------|----------|-----------|----------------|-----------------|-----------|
| Collision | 60s | 30s | 90s | 11.3 GB | Full incident reconstruction |
| E-stop | 30s | 10s | 40s | 5.0 GB | Lead-up context + immediate response |
| CBF intervention | 15s | 5s | 20s | 2.5 GB | Approach + filter action |
| Geofence breach | 30s | 15s | 45s | 5.6 GB | Approach trajectory |
| OOD spike | 10s | 10s | 20s | 2.5 GB | Object appearance + departure |
| Tracking failure | 10s | 5s | 15s | 1.9 GB | Pre-failure + recovery |
| Novel object | 5s | 10s | 15s | 1.9 GB | Object persistence |
| GTSAM innovation | 10s | 5s | 15s | 1.9 GB | Localization anomaly |
| GPS-denied transition | 15s | 15s | 30s | 3.8 GB | Transition behavior |
| Frenet exhaustion | 10s | 5s | 15s | 1.9 GB | Planning state |
| Operator flag | 30s | 30s | 60s | 7.5 GB | Operator-judged importance |
| Diversity sample | 15s | 15s | 30s | 3.8 GB | Representative coverage |

### 3.5 Daily Trigger Budget Allocation

With a 50 GB/day upload budget, trigger allocation follows the priority hierarchy:

| Priority | Budget Allocation | Avg Clip Size | Max Clips/Day | Expected Clips/Day |
|----------|------------------|---------------|---------------|-------------------|
| P0: Safety | 15 GB (uncapped) | 5 GB | No limit | 0-5 |
| P1: Perception | 15 GB | 2.5 GB | 6 | 5-20 |
| P2: Localization | 8 GB | 2 GB | 4 | 2-10 |
| P3: Planning | 5 GB | 1.5 GB | 3 | 2-10 |
| P4: Operator | (uses P1 budget) | 7.5 GB | 2 | 0-3 |
| P5: Diversity | 7 GB | 3.8 GB | 2 | 2-5 |

**P0 events always upload regardless of budget.** If safety events consume more than 15 GB, they eat into lower-priority budgets. In a catastrophic day with many safety events, diversity and planning clips are deferred or discarded.

### 3.6 Overlapping Trigger Deduplication

Multiple triggers can fire for the same underlying event (e.g., an aircraft proximity violation triggers both `aircraft_proximity` and `cbf_intervention` and possibly `estop`). The extractor merges overlapping time windows:

```python
def merge_overlapping_triggers(triggers: List) -> List:
    """Merge triggers with overlapping time windows.
    Keeps the highest priority (lowest number) of overlapping triggers.
    """
    if not triggers:
        return []

    # Sort by start time
    triggers.sort(key=lambda t: t.timestamp_sec - t.pre_roll_sec)

    merged = [triggers[0]]
    for trigger in triggers[1:]:
        prev = merged[-1]
        prev_end = prev.timestamp_sec + prev.post_roll_sec
        curr_start = trigger.timestamp_sec - trigger.pre_roll_sec

        if curr_start <= prev_end:
            # Overlap detected: extend the window, keep highest priority
            new_start = min(prev.timestamp_sec - prev.pre_roll_sec,
                            trigger.timestamp_sec - trigger.pre_roll_sec)
            new_end = max(prev_end,
                          trigger.timestamp_sec + trigger.post_roll_sec)

            merged[-1] = TriggerEvent(
                trigger_type=f"{prev.trigger_type}+{trigger.trigger_type}",
                priority=min(prev.priority, trigger.priority),
                timestamp_sec=(new_start + new_end) / 2.0,
                pre_roll_sec=(new_start + new_end) / 2.0 - new_start,
                post_roll_sec=new_end - (new_start + new_end) / 2.0,
                metadata={**prev.metadata, **trigger.metadata},
            )
        else:
            merged.append(trigger)

    return merged
```

---

## 4. Edge Scenario Classification

### 4.1 Purpose and Architecture

Once a clip is extracted, the edge scenario classifier assigns it a category and an annotation priority score. This metadata travels with the clip to the cloud, enabling the auto-labeling pipeline (`data-flywheel-airside.md`) to prioritize which clips get human attention first.

The classifier runs on the Orin DLA (Deep Learning Accelerator), consuming <3W and <2 GB memory, without competing with the primary perception pipeline on the GPU.

```
Extracted Clip                    Edge Classification
   │                                     │
   ▼                                     ▼
┌──────────────────────────────────────────────────────┐
│ EDGE SCENARIO CLASSIFIER                              │
│                                                       │
│  Input Features (from existing perception outputs):   │
│  ┌─────────────────────────────────────────────────┐ │
│  │ 1. Detection summary (N objects, class dist)     │ │
│  │ 2. OOD score trajectory (10s window)             │ │
│  │ 3. Tracking state (N tracks, age, confidence)    │ │
│  │ 4. GTSAM uncertainty (position covariance trace) │ │
│  │ 5. Weather indicators (sensor health metrics)    │ │
│  │ 6. Trigger type and metadata                     │ │
│  │ 7. Vehicle state (speed, steering, mode)         │ │
│  │ 8. Time of day (encoded as sin/cos)              │ │
│  └─────────────────────────────────────────────────┘ │
│           │                                           │
│           ▼                                           │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Lightweight MLP Classifier (runs on DLA)         │ │
│  │ Input: 128-dim feature vector                    │ │
│  │ Hidden: 256 → 128 → 64                          │ │
│  │ Output: 10 scenario classes + annotation score   │ │
│  │ Latency: <1 ms on DLA INT8                       │ │
│  │ Memory: 0.5 MB weights                           │ │
│  └─────────────────────────────────────────────────┘ │
│           │                                           │
│           ▼                                           │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Output:                                          │ │
│  │  - scenario_class: str (one of 10 categories)    │ │
│  │  - annotation_priority: float [0, 1]             │ │
│  │  - confidence: float [0, 1]                      │ │
│  │  - diversity_score: float [0, 1]                 │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### 4.2 Scenario Categories

| Category ID | Label | Description | Annotation Priority |
|-------------|-------|-------------|-------------------|
| 0 | `near_miss` | Safety event with nearby object involved | 1.0 (always annotate) |
| 1 | `novel_object` | Object not matching any trained class | 0.95 |
| 2 | `adverse_weather` | Rain, fog, de-icing spray degradation | 0.85 |
| 3 | `sensor_degradation` | LiDAR/camera/radar health anomaly | 0.80 |
| 4 | `mapping_discrepancy` | Perception-map disagreement | 0.75 |
| 5 | `calibration_drift` | Inter-sensor alignment degradation | 0.70 |
| 6 | `rare_maneuver` | Unusual planning behavior (deadlock, exhaustion) | 0.65 |
| 7 | `night_operation` | Night/dawn/dusk driving conditions | 0.60 |
| 8 | `normal_diverse` | Normal operation but geographically/temporally diverse | 0.40 |
| 9 | `normal_routine` | Routine operation, low information value | 0.10 |

### 4.3 Feature Extraction from Existing Perception Outputs

The classifier does NOT process raw sensor data. It uses features already computed by the perception pipeline, extracted from the clip's metadata and the last 10 seconds of perception state before the trigger event.

```python
# edge_classifier.py
# Lightweight scenario classifier using perception output features.

import numpy as np
from typing import Dict, List, Tuple
import json

# TensorRT engine for DLA inference
import tensorrt as trt
import pycuda.driver as cuda


class EdgeScenarioClassifier:
    """
    Classifies extracted clips into scenario categories using features
    from existing perception outputs. Runs on Orin DLA for minimal
    GPU contention.

    Key design: NO additional sensor processing. All inputs are derived
    from data already computed by the perception/planning/localization
    pipeline.
    """

    SCENARIO_LABELS = [
        "near_miss", "novel_object", "adverse_weather",
        "sensor_degradation", "mapping_discrepancy", "calibration_drift",
        "rare_maneuver", "night_operation", "normal_diverse", "normal_routine"
    ]

    def __init__(self, engine_path: str = "/models/edge_classifier_dla_int8.engine"):
        """Load TensorRT engine for DLA execution."""
        self.logger = trt.Logger(trt.Logger.WARNING)
        with open(engine_path, "rb") as f:
            self.engine = trt.Runtime(self.logger).deserialize_cuda_engine(f.read())
        self.context = self.engine.create_execution_context()

        # Allocate input/output buffers
        self.input_buf = cuda.mem_alloc(128 * 4)   # 128 float32 features
        self.output_buf = cuda.mem_alloc(11 * 4)   # 10 classes + 1 score

    def classify(self, trigger_event, perception_state: Dict,
                 localization_state: Dict, planning_state: Dict,
                 sensor_health: Dict) -> Dict:
        """
        Classify an extracted clip.

        Args:
            trigger_event: The TriggerEvent that caused extraction
            perception_state: Recent perception outputs (10s window)
            localization_state: Recent localization state
            planning_state: Recent planning state
            sensor_health: Current sensor health metrics

        Returns:
            Dict with scenario_class, annotation_priority, confidence,
            diversity_score
        """
        features = self._extract_features(
            trigger_event, perception_state, localization_state,
            planning_state, sensor_health)

        # Run DLA inference
        input_array = np.array(features, dtype=np.float32)
        cuda.memcpy_htod(self.input_buf, input_array.tobytes())
        self.context.execute_v2([int(self.input_buf), int(self.output_buf)])

        output = np.zeros(11, dtype=np.float32)
        cuda.memcpy_dtoh(output.tobytes(), self.output_buf)

        # Parse output
        class_logits = output[:10]
        annotation_score = float(self._sigmoid(output[10]))

        class_probs = self._softmax(class_logits)
        predicted_class = int(np.argmax(class_probs))
        confidence = float(class_probs[predicted_class])

        # Compute diversity score based on how different this clip is
        # from recently seen clips
        diversity = self._compute_diversity(features)

        return {
            "scenario_class": self.SCENARIO_LABELS[predicted_class],
            "scenario_class_id": predicted_class,
            "annotation_priority": annotation_score,
            "confidence": confidence,
            "class_probabilities": {
                self.SCENARIO_LABELS[i]: float(p)
                for i, p in enumerate(class_probs)
            },
            "diversity_score": diversity,
        }

    def _extract_features(self, trigger, perc, loc, plan, health) -> List[float]:
        """
        Extract 128-dimensional feature vector from perception outputs.
        All features are normalized to [0, 1] or [-1, 1] range.
        """
        features = []

        # --- Trigger features (dims 0-15) ---
        # One-hot trigger type (6 categories)
        trigger_onehot = [0.0] * 6
        trigger_map = {"safety": 0, "perception": 1, "localization": 2,
                       "planning": 3, "operator": 4, "diversity": 5}
        category = self._trigger_category(trigger.trigger_type)
        if category in trigger_map:
            trigger_onehot[trigger_map[category]] = 1.0
        features.extend(trigger_onehot)

        # Trigger priority (normalized)
        features.append(trigger.priority / 5.0)

        # Clip duration (normalized, max 120s)
        features.append(min(trigger.clip_duration_sec / 120.0, 1.0))

        # Padding for trigger block
        features.extend([0.0] * 8)

        # --- Detection features (dims 16-47) ---
        det = perc.get("detections", {})
        features.append(min(det.get("num_objects", 0) / 50.0, 1.0))
        features.append(min(det.get("num_aircraft", 0) / 5.0, 1.0))
        features.append(min(det.get("num_personnel", 0) / 20.0, 1.0))
        features.append(min(det.get("num_gse", 0) / 15.0, 1.0))
        features.append(min(det.get("nearest_object_m", 100.0) / 100.0, 1.0))
        features.append(min(det.get("nearest_aircraft_m", 200.0) / 200.0, 1.0))
        features.append(det.get("min_confidence", 1.0))
        features.append(det.get("mean_confidence", 1.0))

        # OOD score statistics (10s window)
        ood_scores = perc.get("ood_scores", [0.0])
        features.append(min(np.mean(ood_scores) / 10.0, 1.0))
        features.append(min(np.max(ood_scores) / 10.0, 1.0))
        features.append(min(np.std(ood_scores) / 5.0, 1.0))

        # Track statistics
        tracks = perc.get("tracks", {})
        features.append(min(tracks.get("num_active", 0) / 50.0, 1.0))
        features.append(min(tracks.get("num_lost", 0) / 10.0, 1.0))
        features.append(min(tracks.get("num_new", 0) / 10.0, 1.0))
        features.append(tracks.get("mean_age_sec", 0.0) / 60.0)
        features.append(tracks.get("id_switch_count", 0) / 5.0)

        # Padding for detection block
        features.extend([0.0] * 16)

        # --- Localization features (dims 48-71) ---
        features.append(min(loc.get("innovation_norm", 0.0) / 5.0, 1.0))
        features.append(min(loc.get("position_uncertainty_m", 0.0) / 2.0, 1.0))
        features.append(min(loc.get("heading_uncertainty_deg", 0.0) / 10.0, 1.0))
        gps_status = {"rtk_fixed": 0.0, "rtk_float": 0.25,
                       "dgps": 0.5, "standalone": 0.75, "denied": 1.0}
        features.append(gps_status.get(loc.get("gps_status", "rtk_fixed"), 0.5))
        features.append(loc.get("num_gtsam_factors", 100) / 500.0)

        # Padding for localization block
        features.extend([0.0] * 19)

        # --- Planning features (dims 72-95) ---
        features.append(min(plan.get("feasible_count", 420) / 420.0, 1.0))
        features.append(min(plan.get("trajectory_cost", 0.0) / 100.0, 1.0))
        features.append(plan.get("speed_mps", 0.0) / 7.0)  # max ~25 km/h
        features.append(plan.get("steering_rad", 0.0) / 0.5)
        mode_map = {"autonomous": 0.0, "supervised": 0.25,
                     "shared": 0.5, "teleop": 0.75, "manual": 1.0}
        features.append(mode_map.get(plan.get("mode", "autonomous"), 0.0))

        # Padding for planning block
        features.extend([0.0] * 19)

        # --- Sensor health features (dims 96-111) ---
        for sensor in ["lidar_0", "lidar_1", "lidar_2", "lidar_3",
                        "lidar_4", "lidar_5", "lidar_6", "lidar_7"]:
            h = health.get(sensor, {})
            features.append(h.get("health_score", 1.0))
            features.append(min(h.get("point_count_ratio", 1.0), 1.0))

        # --- Environmental features (dims 112-127) ---
        # Time of day (sin/cos encoding for cyclical nature)
        hour = perc.get("hour_of_day", 12.0)
        features.append(np.sin(2 * np.pi * hour / 24.0))
        features.append(np.cos(2 * np.pi * hour / 24.0))

        # Ambient light estimate
        features.append(min(perc.get("ambient_light_lux", 10000.0) / 100000.0, 1.0))

        # Visibility estimate (from sensor health)
        features.append(min(health.get("estimated_visibility_m", 5000.0) / 5000.0, 1.0))

        # Temperature
        features.append((health.get("ambient_temp_c", 20.0) + 20.0) / 70.0)

        # Padding
        features.extend([0.0] * 11)

        # Ensure exactly 128 features
        features = features[:128]
        while len(features) < 128:
            features.append(0.0)

        return features

    def _trigger_category(self, trigger_type: str) -> str:
        """Map trigger type to category."""
        safety = {"estop", "collision", "cbf_intervention",
                  "geofence_breach", "simplex_switch", "aircraft_proximity"}
        perception = {"ood_spike", "tracking_failure", "novel_object",
                      "detection_disagreement", "sensor_degradation",
                      "multi_sensor_inconsistency"}
        localization = {"gtsam_innovation_spike", "gps_denied_transition",
                        "place_recognition_fail", "map_discrepancy",
                        "calibration_drift"}
        planning = {"frenet_exhaustion", "high_cost_trajectory",
                    "deadlock", "path_deviation", "unplanned_stop"}
        operator = {"operator_flag"}

        if trigger_type in safety: return "safety"
        if trigger_type in perception: return "perception"
        if trigger_type in localization: return "localization"
        if trigger_type in planning: return "planning"
        if trigger_type in operator: return "operator"
        return "diversity"

    def _compute_diversity(self, features: List[float]) -> float:
        """
        Compute diversity score based on cosine distance to recently
        classified clips. Higher = more different from recent history.
        Uses a rolling buffer of recent feature vectors.
        """
        if not hasattr(self, '_recent_features'):
            self._recent_features = []

        if not self._recent_features:
            self._recent_features.append(features)
            return 1.0  # First clip is maximally diverse

        # Cosine similarity to each recent clip
        feat_arr = np.array(features)
        similarities = []
        for recent in self._recent_features[-100:]:  # Last 100 clips
            recent_arr = np.array(recent)
            cos_sim = np.dot(feat_arr, recent_arr) / (
                np.linalg.norm(feat_arr) * np.linalg.norm(recent_arr) + 1e-8)
            similarities.append(cos_sim)

        # Diversity = 1 - max similarity (most similar recent clip)
        diversity = 1.0 - max(similarities)

        self._recent_features.append(features)
        if len(self._recent_features) > 200:
            self._recent_features = self._recent_features[-100:]

        return float(np.clip(diversity, 0.0, 1.0))

    @staticmethod
    def _softmax(x):
        e = np.exp(x - np.max(x))
        return e / e.sum()

    @staticmethod
    def _sigmoid(x):
        return 1.0 / (1.0 + np.exp(-x))
```

### 4.4 Training the Edge Classifier

The edge classifier is trained offline from historical fleet data:

1. **Bootstrap phase (months 1-3)**: Use rule-based classification. The trigger type directly maps to scenario category (e.g., any P0 trigger maps to `near_miss`, any `ood_spike` maps to `novel_object`). No ML model needed yet.

2. **Initial training (month 4+)**: Once ~5,000 clips have been manually categorized by annotators in the cloud, train the MLP classifier. Feature vectors are extracted from the clip metadata. Training takes <1 hour on a single GPU.

3. **Continuous refinement**: As more annotated clips accumulate, retrain monthly. Push updated engine to vehicles via OTA.

| Phase | Classifier Type | Accuracy | Latency (DLA) | Memory |
|-------|----------------|----------|---------------|--------|
| Bootstrap | Rule-based | ~70% | <0.1 ms | 0 MB |
| V1 trained | MLP (128-256-128-64-11) | ~82% | <1 ms | 0.5 MB |
| V2 refined | MLP + temporal features | ~88% | <1 ms | 0.8 MB |
| V3 mature | MLP + embedding similarity | ~92% | <2 ms | 2 MB |

### 4.5 DLA Deployment

The classifier MLP is exported to TensorRT with DLA as the target device:

```python
# export_classifier_to_dla.py
# Convert trained PyTorch classifier to TensorRT DLA engine.

import torch
import torch.nn as nn
import tensorrt as trt


class ScenarioClassifierNet(nn.Module):
    """PyTorch model for export."""
    def __init__(self, input_dim=128, num_classes=10):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 256),
            nn.ReLU(),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, num_classes + 1),  # +1 for annotation score
        )

    def forward(self, x):
        return self.net(x)


def export_to_trt_dla(model_path: str, output_path: str):
    """Export PyTorch model to TensorRT engine targeting DLA."""
    # Load trained model
    model = ScenarioClassifierNet()
    model.load_state_dict(torch.load(model_path))
    model.eval()

    # Export to ONNX
    dummy_input = torch.randn(1, 128)
    onnx_path = "/tmp/classifier.onnx"
    torch.onnx.export(model, dummy_input, onnx_path,
                       input_names=["features"],
                       output_names=["logits"],
                       dynamic_axes={"features": {0: "batch"}})

    # Build TensorRT engine with DLA
    logger = trt.Logger(trt.Logger.INFO)
    builder = trt.Builder(logger)
    network = builder.create_network(
        1 << int(trt.NetworkDefinitionCreationFlag.EXPLICIT_BATCH))
    parser = trt.OnnxParser(network, logger)

    with open(onnx_path, "rb") as f:
        parser.parse(f.read())

    config = builder.create_builder_config()
    config.max_workspace_size = 1 << 24  # 16 MB
    config.set_flag(trt.BuilderFlag.INT8)
    config.default_device_type = trt.DeviceType.DLA
    config.DLA_core = 0  # Use DLA core 0 (core 1 available for other models)
    config.set_flag(trt.BuilderFlag.GPU_FALLBACK)  # Fallback for unsupported ops

    engine = builder.build_engine(network, config)
    with open(output_path, "wb") as f:
        f.write(engine.serialize())

    print(f"DLA engine saved to {output_path}")
    print(f"Engine size: {os.path.getsize(output_path) / 1024:.1f} KB")
```

---

## 5. Bandwidth-Aware Upload Scheduling

### 5.1 Airport Connectivity Model

From `20-av-platform/networking-connectivity/airport-5g-cbrs.md`, airport 5G connectivity has these characteristics:

| Parameter | Value | Notes |
|-----------|-------|-------|
| Downlink bandwidth (per vehicle) | 50-200 Mbps | Shared across fleet |
| Uplink bandwidth (per vehicle) | 20-80 Mbps | Bottleneck for data upload |
| Total cell capacity (uplink) | 200-500 Mbps | Shared by all vehicles in cell |
| Latency (5G URLLC) | 1-10 ms | For safety messages |
| Latency (5G eMBB) | 10-50 ms | For data upload |
| Coverage | 95-99% of airside | Dead zones near hangars, underground |
| WiFi at depot | 200-500 Mbps | Dedicated, not shared |

**Critical constraint**: V2X safety messages (see `cross-cutting/v2x-protocols-airside.md`) share the same 5G network. The upload scheduler must never saturate uplink bandwidth, as this would increase latency for safety-critical V2X messages.

**Upload bandwidth allocation**: Reserve 20% of uplink for V2X safety + telemetry. Remaining 80% available for data upload.

| Fleet Size | Per-Vehicle Uplink | Upload Allocation (80%) | Hourly Upload Capacity | Daily (16h ops) |
|------------|-------------------|------------------------|----------------------|-----------------|
| 5 vehicles | ~80 Mbps | 64 Mbps = 8 MB/s | 28.8 GB | 460 GB |
| 20 vehicles | ~20 Mbps | 16 Mbps = 2 MB/s | 7.2 GB | 115 GB |
| 50 vehicles | ~8 Mbps | 6.4 Mbps = 0.8 MB/s | 2.9 GB | 46 GB |
| 100 vehicles | ~4 Mbps | 3.2 Mbps = 0.4 MB/s | 1.4 GB | 23 GB |

At 50+ vehicles, the 5G uplink becomes the bottleneck. The 50 GB/day budget is achievable only if vehicles use depot WiFi during charging breaks for bulk upload.

### 5.2 Hybrid Upload Strategy

```
┌──────────────────────────────────────────────────────────────────┐
│            HYBRID UPLOAD STRATEGY                                 │
│                                                                   │
│  OPERATING (on airside, 5G):                                     │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  Upload ONLY:                                         │       │
│  │  - P0 safety events (immediately, full 5G bandwidth)  │       │
│  │  - Telemetry stream (1 Hz MQTT, ~50 KB/s)            │       │
│  │  - Compressed metadata for all extracted clips        │       │
│  │  - P1 perception clips (if bandwidth available)       │       │
│  │                                                       │       │
│  │  Budget: ~5-15 GB/shift via 5G                        │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
│  CHARGING (at depot, WiFi/Ethernet):                             │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  Bulk upload:                                         │       │
│  │  - All remaining P1-P3 clips                          │       │
│  │  - P5 diversity samples                               │       │
│  │  - Map update scans                                   │       │
│  │                                                       │       │
│  │  30 min charging @ 200 Mbps = ~45 GB                  │       │
│  │  2-3 charging breaks/day = ~90-135 GB capacity        │       │
│  │  More than sufficient for 50 GB/day budget            │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                   │
│  OVERNIGHT (depot, Ethernet):                                    │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  Full drain:                                          │       │
│  │  - Upload any remaining buffered clips                │       │
│  │  - Diagnostic logs                                    │       │
│  │  - Full NVMe staging flush                            │       │
│  │                                                       │       │
│  │  8h overnight @ 500 Mbps = ~1.8 TB capacity           │       │
│  │  Downloads: model updates, map updates, config (OTA)  │       │
│  └──────────────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────────┘
```

### 5.3 Upload Priority Queue Implementation

```python
# upload_scheduler.py
# Bandwidth-aware upload scheduler with priority queue and resumption.

import os
import json
import time
import threading
import subprocess
import hashlib
from pathlib import Path
from typing import Optional, Dict, List
from dataclasses import dataclass, field
from queue import PriorityQueue
from enum import IntEnum
import logging

logger = logging.getLogger("upload_scheduler")


class ConnectivityMode(IntEnum):
    """Current network connectivity state."""
    DISCONNECTED = 0    # No network
    CELLULAR_5G = 1     # Operating on airside, shared 5G
    WIFI_DEPOT = 2      # At charging station, dedicated WiFi
    ETHERNET_DEPOT = 3  # Overnight at depot, wired


@dataclass(order=True)
class UploadItem:
    """A single file queued for upload."""
    sort_key: tuple = field(compare=True)  # (priority, -timestamp) for ordering
    local_path: str = field(compare=False)
    remote_key: str = field(compare=False)
    size_bytes: int = field(compare=False)
    priority: int = field(compare=False)
    trigger_type: str = field(compare=False)
    metadata_path: str = field(compare=False)
    checksum: str = field(compare=False)
    upload_attempts: int = field(default=0, compare=False)
    bytes_uploaded: int = field(default=0, compare=False)  # For resumption


class UploadScheduler:
    """
    Manages upload of extracted clips to cloud backend.
    Respects bandwidth limits, connectivity mode, and daily budget.
    Supports upload resumption after connectivity loss.
    """

    DAILY_BUDGET_GB = 50.0
    MAX_UPLOAD_ATTEMPTS = 5
    MAX_5G_BANDWIDTH_MBPS = 20.0     # Conservative limit while operating
    MAX_WIFI_BANDWIDTH_MBPS = 150.0  # Depot WiFi
    SAFETY_BANDWIDTH_RESERVE = 0.20  # Reserve 20% for V2X/telemetry

    # Bandwidth limits by priority and connectivity mode
    BANDWIDTH_LIMITS = {
        # (priority, connectivity_mode) -> max_mbps
        (0, ConnectivityMode.CELLULAR_5G): 20.0,    # Safety: full 5G
        (0, ConnectivityMode.WIFI_DEPOT): 150.0,
        (0, ConnectivityMode.ETHERNET_DEPOT): 500.0,
        (1, ConnectivityMode.CELLULAR_5G): 10.0,    # Perception: half 5G
        (1, ConnectivityMode.WIFI_DEPOT): 150.0,
        (1, ConnectivityMode.ETHERNET_DEPOT): 500.0,
        (2, ConnectivityMode.CELLULAR_5G): 0.0,     # Localization: WiFi only
        (2, ConnectivityMode.WIFI_DEPOT): 100.0,
        (2, ConnectivityMode.ETHERNET_DEPOT): 500.0,
        (3, ConnectivityMode.CELLULAR_5G): 0.0,     # Planning: WiFi only
        (3, ConnectivityMode.WIFI_DEPOT): 100.0,
        (3, ConnectivityMode.ETHERNET_DEPOT): 500.0,
        (4, ConnectivityMode.CELLULAR_5G): 0.0,     # Diversity: WiFi only
        (4, ConnectivityMode.WIFI_DEPOT): 50.0,
        (4, ConnectivityMode.ETHERNET_DEPOT): 500.0,
    }

    STAGING_PATH = Path("/data/upload")

    def __init__(self, vehicle_id: str, airport_code: str):
        self.vehicle_id = vehicle_id
        self.airport_code = airport_code
        self.queue = PriorityQueue()
        self.daily_uploaded_bytes = 0
        self.daily_reset_time = time.time()
        self.connectivity_mode = ConnectivityMode.DISCONNECTED
        self.running = False
        self._lock = threading.Lock()
        self.upload_history: List[Dict] = []

    def enqueue_clip(self, bag_path: str, metadata_path: str):
        """Add an extracted clip to the upload queue."""
        with open(metadata_path) as f:
            meta = json.load(f)

        priority = meta["priority"]
        size = os.path.getsize(bag_path)
        timestamp = meta["timestamp_sec"]
        date_str = time.strftime("%Y/%m/%d", time.gmtime(timestamp))

        remote_key = (f"s3://fleet-data-raw/{self.airport_code}/"
                      f"{self.vehicle_id}/{date_str}/"
                      f"{os.path.basename(bag_path)}")

        item = UploadItem(
            sort_key=(priority, -timestamp),
            local_path=bag_path,
            remote_key=remote_key,
            size_bytes=size,
            priority=priority,
            trigger_type=meta["trigger_type"],
            metadata_path=metadata_path,
            checksum=meta.get("sha256", ""),
        )

        self.queue.put(item)
        logger.info("Enqueued: P%d %s (%.2f GB)", priority,
                     meta["trigger_type"], size / 1e9)

    def start(self):
        """Start the upload scheduler daemon."""
        self.running = True
        self._thread = threading.Thread(target=self._upload_loop, daemon=True)
        self._thread.start()
        logger.info("Upload scheduler started")

    def stop(self):
        """Stop the upload scheduler daemon."""
        self.running = False
        if self._thread.is_alive():
            self._thread.join(timeout=10)

    def set_connectivity(self, mode: ConnectivityMode):
        """Update connectivity mode (called by network monitor)."""
        if mode != self.connectivity_mode:
            logger.info("Connectivity changed: %s -> %s",
                        self.connectivity_mode.name, mode.name)
            self.connectivity_mode = mode

    def _upload_loop(self):
        """Main upload loop. Runs continuously in background."""
        while self.running:
            # Reset daily counter at midnight UTC
            self._check_daily_reset()

            if self.connectivity_mode == ConnectivityMode.DISCONNECTED:
                time.sleep(5.0)
                continue

            if self.queue.empty():
                time.sleep(1.0)
                continue

            # Peek at next item without removing
            item = self.queue.get()

            # Check if this item can upload given current connectivity
            max_bw = self.BANDWIDTH_LIMITS.get(
                (item.priority, self.connectivity_mode), 0.0)

            if max_bw <= 0.0:
                # Cannot upload at this priority with current connectivity
                self.queue.put(item)  # Put it back
                time.sleep(2.0)
                continue

            # Check daily budget (safety events bypass)
            remaining_budget = (self.DAILY_BUDGET_GB * 1e9 -
                                self.daily_uploaded_bytes)
            if item.priority > 0 and item.size_bytes > remaining_budget:
                logger.warning("Daily budget exceeded. Remaining: %.2f GB",
                               remaining_budget / 1e9)
                self.queue.put(item)
                time.sleep(30.0)
                continue

            # Attempt upload
            success = self._upload_item(item, max_bw)

            if success:
                self.daily_uploaded_bytes += item.size_bytes
                self._log_upload(item, success=True)
                self._cleanup_local(item)
            else:
                item.upload_attempts += 1
                if item.upload_attempts < self.MAX_UPLOAD_ATTEMPTS:
                    self.queue.put(item)  # Retry later
                else:
                    logger.error("Upload failed after %d attempts: %s",
                                 self.MAX_UPLOAD_ATTEMPTS, item.local_path)
                    self._log_upload(item, success=False)
                time.sleep(5.0)

    def _upload_item(self, item: UploadItem, max_bandwidth_mbps: float) -> bool:
        """Upload a single item with bandwidth limiting and resumption."""
        bandwidth_bytes_sec = int(max_bandwidth_mbps * 1e6 / 8)
        estimated_time_sec = item.size_bytes / max(bandwidth_bytes_sec, 1)

        # Use aws s3 cp with bandwidth limiting
        # For resumption, use multipart upload with part tracking
        cmd = [
            "aws", "s3", "cp",
            item.local_path,
            item.remote_key,
            "--storage-class", "INTELLIGENT_TIERING",
            "--expected-size", str(item.size_bytes),
            "--metadata", json.dumps({
                "vehicle_id": self.vehicle_id,
                "airport": self.airport_code,
                "trigger_type": item.trigger_type,
                "priority": str(item.priority),
                "sha256": item.checksum,
            }),
        ]

        timeout = max(300, int(estimated_time_sec * 3))

        try:
            result = subprocess.run(
                cmd, timeout=timeout, capture_output=True, text=True)
            if result.returncode == 0:
                logger.info("Uploaded: %s (%.2f GB in ~%.0fs)",
                            os.path.basename(item.local_path),
                            item.size_bytes / 1e9, estimated_time_sec)
                return True
            else:
                logger.warning("Upload failed: %s", result.stderr[:200])
                return False
        except subprocess.TimeoutExpired:
            logger.warning("Upload timed out after %ds", timeout)
            return False
        except Exception as e:
            logger.error("Upload error: %s", str(e))
            return False

    def _upload_metadata(self, item: UploadItem):
        """Upload the metadata JSON sidecar alongside the bag file."""
        if os.path.exists(item.metadata_path):
            meta_remote = item.remote_key.replace(".bag", ".json")
            subprocess.run([
                "aws", "s3", "cp", item.metadata_path, meta_remote,
                "--storage-class", "INTELLIGENT_TIERING",
            ], timeout=30, capture_output=True)

    def _cleanup_local(self, item: UploadItem):
        """Remove local files after confirmed upload."""
        try:
            if os.path.exists(item.local_path):
                os.remove(item.local_path)
            if os.path.exists(item.metadata_path):
                os.remove(item.metadata_path)
        except OSError as e:
            logger.warning("Cleanup failed: %s", str(e))

    def _check_daily_reset(self):
        """Reset daily upload counter at midnight UTC."""
        now = time.time()
        if now - self.daily_reset_time > 86400:
            self.daily_uploaded_bytes = 0
            self.daily_reset_time = now
            logger.info("Daily upload budget reset")

    def _log_upload(self, item: UploadItem, success: bool):
        """Record upload result for monitoring."""
        self.upload_history.append({
            "time": time.time(),
            "path": item.local_path,
            "size_gb": item.size_bytes / 1e9,
            "priority": item.priority,
            "trigger": item.trigger_type,
            "success": success,
            "attempts": item.upload_attempts,
        })

    def get_status(self) -> Dict:
        """Get current upload scheduler status for monitoring."""
        return {
            "queue_size": self.queue.qsize(),
            "daily_uploaded_gb": self.daily_uploaded_bytes / 1e9,
            "daily_remaining_gb": max(0, self.DAILY_BUDGET_GB -
                                       self.daily_uploaded_bytes / 1e9),
            "connectivity": self.connectivity_mode.name,
            "total_uploads_today": len([h for h in self.upload_history
                                         if h["success"]]),
            "total_failures_today": len([h for h in self.upload_history
                                          if not h["success"]]),
        }
```

### 5.4 Compression Strategy

Different data types compress differently. The triage system applies the optimal compression per data type:

| Data Type | Compression | Ratio | Speed (Orin) | CPU Cost | Notes |
|-----------|------------|-------|-------------|----------|-------|
| LiDAR point clouds | LZ4 (default) | 1.3-1.5x | 2.5 GB/s | <2% one core | Best speed/ratio for real-time |
| LiDAR point clouds | Zstd level 3 | 1.6-1.8x | 800 MB/s | ~5% one core | For staging, not live recording |
| LiDAR point clouds | Draco (geometry) | 5-10x | 100 MB/s | ~15% one core | For upload, lossy geometry quantization |
| Camera frames (RGB) | H.265 (NVENC) | 20-40x | Hardware | 0% CPU | Use Orin video encoder |
| Camera frames (thermal) | H.265 (NVENC) | 10-20x | Hardware | 0% CPU | 16-bit to 8-bit remapping first |
| IMU data | Zstd level 6 | 3-5x | 200 MB/s | ~3% one core | Highly compressible repetitive data |
| GTSAM poses | Zstd level 6 | 4-8x | 200 MB/s | ~1% one core | Floating point delta encoding first |
| Perception outputs | JSON + Zstd | 8-15x | 200 MB/s | ~2% one core | Structured data compresses well |
| CAN bus data | LZ4 | 2-3x | 2.5 GB/s | <1% one core | Small messages, fast compression |

**Combined compression pipeline for a 30-second clip**:

| Component | Raw Size | Compressed Size | Method |
|-----------|----------|----------------|--------|
| Aggregated LiDAR (10 Hz) | 870 MB | 580 MB (LZ4) or 145 MB (Draco) | LZ4 for speed, Draco for upload |
| IMU (500 Hz) | 0.96 MB | 0.24 MB | Zstd |
| Poses (10 Hz) | 60 KB | 12 KB | Delta + Zstd |
| CAN (100 Hz) | 0.58 MB | 0.25 MB | LZ4 |
| Perception (10 Hz) | 0.6 MB | 0.05 MB | JSON + Zstd |
| Planning (10 Hz) | 0.3 MB | 0.03 MB | JSON + Zstd |
| **Total (LiDAR only)** | **872 MB** | **581 MB (LZ4) / 146 MB (Draco)** | |
| Camera (4x RGB, 20 Hz) | 72 MB (H.265) | 72 MB | Already compressed |
| Thermal (2x, 30 Hz) | 14 MB (H.265) | 14 MB | Already compressed |
| **Total (with cameras)** | **958 MB** | **232 MB (Draco + H.265)** | |

**Key insight**: Draco geometry compression achieves 5-10x on point clouds (vs 1.5x for LZ4) by quantizing coordinates to 11-14 bits per axis. At 14 bits over a 200m range, quantization error is ~1.2 cm, which is well within LiDAR measurement noise (~3 cm for RoboSense RSHELIOS). This is the single most impactful compression for upload bandwidth.

```python
# compression.py
# Multi-format compression for different sensor data types.

import subprocess
import struct
import numpy as np
from pathlib import Path
from typing import Optional
import lz4.frame
import zstandard as zstd


class SensorCompressor:
    """
    Applies optimal compression per data type.
    Used by clip extractor before staging for upload.
    """

    # Zstd compressor (reusable, thread-safe for compression)
    _zstd_compressor = zstd.ZstdCompressor(level=3, threads=2)
    _zstd_compressor_high = zstd.ZstdCompressor(level=6, threads=2)

    @staticmethod
    def compress_pointcloud_lz4(points: np.ndarray) -> bytes:
        """
        LZ4 compression for point clouds.
        Used for ring buffer NVMe spill (fast, low CPU).
        Ratio: ~1.3-1.5x
        """
        raw_bytes = points.astype(np.float32).tobytes()
        return lz4.frame.compress(raw_bytes, compression_level=0)

    @staticmethod
    def compress_pointcloud_draco(points: np.ndarray,
                                   quantization_bits: int = 14) -> bytes:
        """
        Draco geometry compression for point clouds.
        Used for upload staging (high compression, moderate CPU).
        Ratio: ~5-10x

        Args:
            points: Nx4 float32 array (x, y, z, intensity)
            quantization_bits: Coordinate precision (14 = ~1.2cm over 200m)
        """
        # Write temporary PLY, compress with Draco CLI
        # In production, use DracoPy (Python bindings) or direct C++ API
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".ply", delete=False) as tmp_ply:
            _write_ply(tmp_ply.name, points)

        out_path = tmp_ply.name + ".drc"
        cmd = [
            "draco_encoder",
            "-i", tmp_ply.name,
            "-o", out_path,
            "-qp", str(quantization_bits),  # Position quantization
            "-cl", "7",                      # Compression level
        ]

        try:
            subprocess.run(cmd, timeout=30, capture_output=True, check=True)
            with open(out_path, "rb") as f:
                compressed = f.read()
            return compressed
        except (subprocess.CalledProcessError, FileNotFoundError):
            # Fallback to LZ4 if Draco not available
            return SensorCompressor.compress_pointcloud_lz4(points)

    @staticmethod
    def compress_imu_zstd(imu_data: np.ndarray) -> bytes:
        """Zstd compression for IMU data (highly repetitive)."""
        raw = imu_data.astype(np.float64).tobytes()
        return SensorCompressor._zstd_compressor_high.compress(raw)

    @staticmethod
    def compress_poses_delta_zstd(poses: np.ndarray) -> bytes:
        """
        Delta encoding + Zstd for pose data.
        Consecutive poses differ by small amounts; delta encoding
        makes the data highly compressible.
        """
        if len(poses) < 2:
            raw = poses.astype(np.float64).tobytes()
            return SensorCompressor._zstd_compressor_high.compress(raw)

        # Delta encoding: store first pose absolute, rest as deltas
        deltas = np.zeros_like(poses)
        deltas[0] = poses[0]
        deltas[1:] = poses[1:] - poses[:-1]

        # Pack with header indicating delta encoding
        header = struct.pack("<BII", 1, len(poses), poses.shape[1])  # version, rows, cols
        raw = header + deltas.astype(np.float64).tobytes()
        return SensorCompressor._zstd_compressor_high.compress(raw)

    @staticmethod
    def compress_for_upload(bag_path: Path, output_path: Path,
                            use_draco: bool = True) -> Path:
        """
        Recompress an LZ4-compressed rosbag for upload.
        Replaces LZ4 point clouds with Draco, keeps other topics as-is.
        Returns path to recompressed file.
        """
        # This would use rosbags library to read the bag,
        # recompress point cloud topics with Draco,
        # and write a new bag with mixed compression.
        # Net effect: ~3-4x additional compression on the LiDAR data.
        pass


def _write_ply(path: str, points: np.ndarray):
    """Write point cloud as PLY for Draco input."""
    n = len(points)
    with open(path, "w") as f:
        f.write("ply\n")
        f.write("format ascii 1.0\n")
        f.write(f"element vertex {n}\n")
        f.write("property float x\n")
        f.write("property float y\n")
        f.write("property float z\n")
        f.write("property float intensity\n")
        f.write("end_header\n")
        for p in points:
            f.write(f"{p[0]:.4f} {p[1]:.4f} {p[2]:.4f} {p[3]:.2f}\n")
```

### 5.5 Upload Resumption After Connectivity Loss

Airport connectivity is not guaranteed. Vehicles may pass through 5G dead zones (near hangars, underground tunnels) or experience network outages. The upload scheduler handles this with multipart upload resumption:

1. **Large files (>100 MB)** use S3 multipart upload with 10 MB parts.
2. **Each completed part is tracked** in a local SQLite database.
3. **On reconnection**, the scheduler checks which parts were already uploaded and resumes from the last incomplete part.
4. **Parts older than 7 days** are aborted and the upload restarts (S3 multipart upload lifecycle).

```python
# upload_resumption.py
# Multipart upload with resumption support.

import os
import sqlite3
import hashlib
import boto3
from pathlib import Path
from typing import Optional

PART_SIZE = 10 * 1024 * 1024  # 10 MB parts


class ResumableUploader:
    """S3 multipart upload with local progress tracking for resumption."""

    DB_PATH = "/data/upload/upload_state.db"

    def __init__(self):
        self.s3 = boto3.client("s3")
        self._init_db()

    def _init_db(self):
        """Initialize SQLite tracking database."""
        conn = sqlite3.connect(self.DB_PATH)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS uploads (
                local_path TEXT PRIMARY KEY,
                remote_bucket TEXT,
                remote_key TEXT,
                upload_id TEXT,
                total_parts INTEGER,
                completed_parts TEXT,  -- JSON array of completed part numbers
                total_bytes INTEGER,
                uploaded_bytes INTEGER,
                created_at REAL,
                updated_at REAL
            )
        """)
        conn.commit()
        conn.close()

    def upload_with_resumption(self, local_path: str, bucket: str,
                                key: str) -> bool:
        """Upload file with multipart resumption."""
        file_size = os.path.getsize(local_path)

        if file_size < PART_SIZE * 2:
            # Small file: single PUT, no multipart overhead
            return self._simple_upload(local_path, bucket, key)

        # Check for existing incomplete upload
        state = self._get_upload_state(local_path)

        if state is None:
            # Start new multipart upload
            response = self.s3.create_multipart_upload(
                Bucket=bucket, Key=key,
                StorageClass="INTELLIGENT_TIERING")
            upload_id = response["UploadId"]
            total_parts = (file_size + PART_SIZE - 1) // PART_SIZE

            self._save_upload_state(local_path, bucket, key, upload_id,
                                     total_parts, [], file_size, 0)
        else:
            upload_id = state["upload_id"]
            total_parts = state["total_parts"]
            completed_parts = state["completed_parts"]

        # Upload remaining parts
        completed = set(state["completed_parts"]) if state else set()
        parts = []

        with open(local_path, "rb") as f:
            for part_num in range(1, total_parts + 1):
                f.seek((part_num - 1) * PART_SIZE)
                data = f.read(PART_SIZE)

                if part_num in completed:
                    # Already uploaded, skip
                    continue

                try:
                    response = self.s3.upload_part(
                        Bucket=bucket, Key=key,
                        UploadId=upload_id,
                        PartNumber=part_num,
                        Body=data)
                    parts.append({
                        "PartNumber": part_num,
                        "ETag": response["ETag"]
                    })
                    completed.add(part_num)
                    self._update_progress(local_path, list(completed),
                                           len(completed) * PART_SIZE)
                except Exception:
                    return False  # Will resume on next attempt

        # Complete multipart upload
        try:
            # Need all ETags for completion
            all_parts = self._list_parts(bucket, key, upload_id)
            self.s3.complete_multipart_upload(
                Bucket=bucket, Key=key,
                UploadId=upload_id,
                MultipartUpload={"Parts": all_parts})
            self._delete_upload_state(local_path)
            return True
        except Exception:
            return False

    def _simple_upload(self, local_path: str, bucket: str,
                        key: str) -> bool:
        """Simple single-part upload for small files."""
        try:
            self.s3.upload_file(local_path, bucket, key)
            return True
        except Exception:
            return False

    def _get_upload_state(self, local_path: str) -> Optional[dict]:
        conn = sqlite3.connect(self.DB_PATH)
        row = conn.execute(
            "SELECT * FROM uploads WHERE local_path = ?",
            (local_path,)).fetchone()
        conn.close()
        if row:
            return {
                "upload_id": row[3],
                "total_parts": row[4],
                "completed_parts": eval(row[5]),
                "total_bytes": row[6],
                "uploaded_bytes": row[7],
            }
        return None

    def _save_upload_state(self, local_path, bucket, key, upload_id,
                            total_parts, completed, total_bytes, uploaded):
        import time
        conn = sqlite3.connect(self.DB_PATH)
        conn.execute("""
            INSERT OR REPLACE INTO uploads VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (local_path, bucket, key, upload_id, total_parts,
              str(completed), total_bytes, uploaded,
              time.time(), time.time()))
        conn.commit()
        conn.close()

    def _update_progress(self, local_path, completed, uploaded_bytes):
        import time
        conn = sqlite3.connect(self.DB_PATH)
        conn.execute("""
            UPDATE uploads SET completed_parts = ?, uploaded_bytes = ?,
            updated_at = ? WHERE local_path = ?
        """, (str(completed), uploaded_bytes, time.time(), local_path))
        conn.commit()
        conn.close()

    def _delete_upload_state(self, local_path):
        conn = sqlite3.connect(self.DB_PATH)
        conn.execute("DELETE FROM uploads WHERE local_path = ?",
                      (local_path,))
        conn.commit()
        conn.close()

    def _list_parts(self, bucket, key, upload_id):
        parts = []
        paginator = self.s3.get_paginator("list_parts")
        for page in paginator.paginate(Bucket=bucket, Key=key,
                                        UploadId=upload_id):
            for part in page.get("Parts", []):
                parts.append({
                    "PartNumber": part["PartNumber"],
                    "ETag": part["ETag"]
                })
        return sorted(parts, key=lambda p: p["PartNumber"])
```

---

## 6. Data Retention Policies

### 6.1 On-Vehicle Retention

| Data Type | On-Vehicle Retention | After Upload | After Upload Confirmation |
|-----------|---------------------|-------------|--------------------------|
| P0 safety clips | Until uploaded + 30 days | Retained for 30 days | Delete after 30 days |
| P1-P3 clips | Until uploaded + 7 days | Retained for 7 days | Delete after 7 days |
| P5 diversity clips | Until uploaded | Delete immediately | Delete after confirmation |
| NVMe ring chunks | 15 minutes rolling | N/A | N/A (continuously overwritten) |
| Hot ring buffer (RAM) | 17-25 seconds | N/A | N/A (continuously overwritten) |
| Telemetry (MQTT) | Not stored locally | Streamed to cloud | N/A |
| Upload state DB | Permanent | N/A | N/A |
| Diagnostic logs | 7 days | Uploaded during overnight | Delete after confirmation |

**Total NVMe capacity needed**:

| Scenario | P0 Retention | P1-P3 Retention | Ring Partition | Total |
|----------|-------------|-----------------|---------------|-------|
| Normal (1 P0/day) | 5 GB x 30 = 150 GB | 100 GB x 7 = 700 GB | 500 GB | 1.35 TB |
| Heavy safety day | 50 GB x 30 = 1.5 TB | 100 GB x 7 = 700 GB | 500 GB | 2.7 TB |
| Connectivity outage (2 days) | + 10 GB | + 100 GB | 500 GB | 1.46 TB |

**Recommendation**: 2 TB NVMe minimum, 4 TB preferred for headroom during heavy safety event periods and connectivity outages.

### 6.2 Cloud Retention

From `cloud-backend-infrastructure.md`, cloud storage follows a tiered lifecycle:

| Tier | Storage Class | Retention | Access | Cost/TB/Month |
|------|-------------|-----------|--------|---------------|
| Hot | S3 Standard | 0-90 days | Frequent | $23 |
| Warm | S3 IA | 90-365 days | Weekly | $12.50 |
| Cold | S3 Glacier Instant | 1-3 years | Monthly | $4 |
| Archive | S3 Glacier Deep | Permanent (safety) | Yearly | $1 |

### 6.3 Legal and Regulatory Requirements

**Incident data retention**: ISO 3691-4 and the EU Machinery Regulation (2027) require retention of safety-relevant operational data. Specific requirements:

| Requirement | Retention Period | Data Scope | Source |
|-------------|-----------------|------------|--------|
| ISO 3691-4 safety events | 3 years minimum | Full sensor + control state | ISO 3691-4:2020 Clause 4.11 |
| EU Machinery Regulation | 10 years after manufacture | Safety-critical logs | 2023/1230 Article 10 |
| GDPR (if camera captures faces) | Minimize | Camera data with identifiable persons | GDPR Articles 5, 17 |
| Airport operator contract | Per contract (typically 5 years) | All operational data | Commercial |
| Insurance/liability | 6 years (statute of limitations) | All data from incident window | Legal counsel |
| FAA/EASA investigation | Until investigation closes | All data from incident +/- 24h | FAA 49 CFR 830 |

**P0 clips (safety events) must be retained permanently in cloud archive** (Glacier Deep Archive, $1/TB/month). The on-vehicle 30-day retention provides a local backup in case of cloud upload failure.

### 6.4 GDPR Considerations for Camera Data

Airports are semi-public spaces. Camera data may capture identifiable individuals (ground crew, passengers visible through windows, visitors). GDPR compliance requires:

1. **Data minimization**: Extract perception outputs (bounding boxes, classes) rather than raw images where possible. Upload raw camera frames only when needed for model training.

2. **Purpose limitation**: Camera data collected for autonomous driving perception cannot be repurposed for surveillance. Metadata must tag purpose.

3. **Face blurring**: Apply face blurring (DeepPrivacy2 or similar) before cloud upload for any clip containing detected persons. Run blurring on Orin GPU during upload staging.

4. **Retention limits**: Camera clips with identifiable persons should have a maximum cloud retention of 90 days unless needed for safety investigation.

5. **Data subject rights**: The airport operator (not Aurrigo) is typically the data controller. Aurrigo is the processor. A Data Processing Agreement (DPA) must be in place per airport.

```python
# gdpr_filter.py
# Apply GDPR-compliant face blurring before camera data upload.

def blur_faces_in_clip(bag_path: str, output_path: str,
                        blur_model: str = "yolov8n-face"):
    """
    Blur all detected faces in camera topics of a rosbag clip.
    Uses a lightweight face detector running on GPU.

    Applied as a pre-upload filter only when camera topics are present.
    LiDAR-only clips pass through unchanged.
    """
    from rosbags.rosbag1 import Reader, Writer
    import cv2

    camera_topics = {"/camera/front/compressed", "/camera/left/compressed",
                     "/camera/right/compressed", "/camera/rear/compressed"}

    face_detector = cv2.dnn.readNetFromONNX(f"/models/{blur_model}.onnx")

    with Reader(bag_path) as reader, Writer(output_path) as writer:
        # Copy all connections
        for conn in reader.connections:
            writer.add_connection(conn.topic, conn.msgtype)

        for connection, timestamp, rawdata in reader.messages():
            if connection.topic in camera_topics:
                # Decode, detect faces, blur, re-encode
                img = _decode_compressed(rawdata)
                faces = _detect_faces(face_detector, img)
                for (x, y, w, h) in faces:
                    img[y:y+h, x:x+w] = cv2.GaussianBlur(
                        img[y:y+h, x:x+w], (99, 99), 30)
                rawdata = _encode_compressed(img)

            writer.write(connection, timestamp, rawdata)
```

---

## 7. Rosbag Management and Tooling

### 7.1 Rosbag Recording with Topic Filtering

The ring buffer system writes data in rosbag format for compatibility with the existing Aurrigo ROS Noetic toolchain. However, not all topics need to be recorded, and the recording configuration varies by context.

```yaml
# data_triage_config.yaml
# Configuration for on-vehicle data triage system.

ring_buffer:
  total_memory_gb: 6.0
  nvme_ring_path: /data/ring
  nvme_ring_size_gb: 500
  nvme_chunk_duration_sec: 60

# Topics to record (with per-topic ring sizes)
topics:
  # Always record (safety-critical reconstruction)
  primary:
    - topic: /pointcloud_aggregator/output
      ring_mb: 4096
      compression: lz4
    - topic: /imu/data
      ring_mb: 64
      compression: zstd
    - topic: /localization/pose
      ring_mb: 16
      compression: zstd
    - topic: /can/vehicle_state
      ring_mb: 32
      compression: lz4
    - topic: /safety/estop
      ring_mb: 1
      compression: none
    - topic: /safety/cbf_state
      ring_mb: 16
      compression: zstd
    - topic: /safety/stl_verdicts
      ring_mb: 16
      compression: zstd
    - topic: /safety/geofence_status
      ring_mb: 1
      compression: none

  # Record for perception analysis
  perception:
    - topic: /perception/detections
      ring_mb: 128
      compression: zstd
    - topic: /perception/ood_score
      ring_mb: 8
      compression: zstd
    - topic: /perception/tracking_state
      ring_mb: 64
      compression: zstd

  # Record for planning analysis
  planning:
    - topic: /planning/trajectory
      ring_mb: 64
      compression: zstd
    - topic: /planning/frenet_candidates
      ring_mb: 32
      compression: zstd

  # Record only when cameras are installed
  cameras:
    - topic: /camera/front/compressed
      ring_mb: 512
      compression: passthrough  # Already H.265
    - topic: /camera/left/compressed
      ring_mb: 256
      compression: passthrough
    - topic: /camera/right/compressed
      ring_mb: 256
      compression: passthrough
    - topic: /camera/rear/compressed
      ring_mb: 256
      compression: passthrough
    - topic: /thermal/front/image_raw
      ring_mb: 128
      compression: lz4
    - topic: /thermal/rear/image_raw
      ring_mb: 128
      compression: lz4

  # Diagnostic topics (lower priority, smaller buffers)
  diagnostics:
    - topic: /diagnostics/sensor_health
      ring_mb: 8
      compression: zstd
    - topic: /diagnostics/compute_health
      ring_mb: 4
      compression: zstd
    - topic: /localization/innovation_norm
      ring_mb: 4
      compression: zstd
    - topic: /localization/gps_status
      ring_mb: 1
      compression: none

# Trigger configuration
triggers:
  safety:
    estop:
      topic: /safety/estop
      condition: "msg.data == True"
      pre_roll_sec: 30
      post_roll_sec: 10
      cooldown_sec: 0
    cbf_intervention:
      topic: /safety/cbf_state
      condition: "msg.data > 0.1"
      pre_roll_sec: 15
      post_roll_sec: 5
      cooldown_sec: 2

  perception:
    ood_spike:
      topic: /perception/ood_score
      condition: "msg.data > 5.0 and msg.data > 2.0 * rolling_median"
      pre_roll_sec: 10
      post_roll_sec: 10
      cooldown_sec: 10

  diversity:
    time_sample:
      interval_sec: 1800
      pre_roll_sec: 15
      post_roll_sec: 15
    distance_sample:
      interval_m: 5000
      pre_roll_sec: 15
      post_roll_sec: 15

# Upload configuration
upload:
  daily_budget_gb: 50
  priority_allocations:
    P0_safety_gb: 15        # Uncapped (this is the minimum allocation)
    P1_perception_gb: 15
    P2_localization_gb: 8
    P3_planning_gb: 5
    P5_diversity_gb: 7
  connectivity:
    5g_max_upload_mbps: 20
    wifi_max_upload_mbps: 150
    ethernet_max_upload_mbps: 500
    v2x_reserve_fraction: 0.20
```

### 7.2 Rosbag Chunk Rotation and Indexing

The NVMe warm ring writes data as a series of 60-second rosbag chunks. Each chunk is a complete, self-contained rosbag file that can be opened independently.

```python
# chunk_writer.py
# Writes ring buffer data as sequential rosbag chunks on NVMe.

import os
import time
from pathlib import Path
from rosbags.rosbag1 import Writer


class ChunkWriter:
    """
    Writes sensor data to sequential 60-second rosbag chunks on NVMe.
    Each chunk is a complete rosbag file for independent access.
    Maintains an index file for fast time-based retrieval.
    """

    CHUNK_DURATION_SEC = 60
    RING_PATH = Path("/data/ring")
    INDEX_PATH = Path("/data/ring/chunk_index.json")

    def __init__(self):
        self.RING_PATH.mkdir(parents=True, exist_ok=True)
        self.current_writer = None
        self.current_chunk_start = None
        self.current_chunk_path = None
        self.chunk_index = self._load_index()
        self._connections_registered = set()

    def write_message(self, topic: str, timestamp_ns: int,
                       raw_data: bytes, msg_type: str):
        """Write a single message to the current chunk."""
        timestamp_sec = timestamp_ns / 1e9

        # Rotate chunk if needed
        if (self.current_chunk_start is None or
                timestamp_sec - self.current_chunk_start >= self.CHUNK_DURATION_SEC):
            self._rotate_chunk(timestamp_sec)

        # Register connection if new topic
        if topic not in self._connections_registered:
            self.current_writer.add_connection(topic, msg_type)
            self._connections_registered.add(topic)

        # Write message
        self.current_writer.write(topic, timestamp_ns, raw_data)

    def _rotate_chunk(self, timestamp_sec: float):
        """Close current chunk and start a new one."""
        if self.current_writer is not None:
            self.current_writer.close()
            # Update index
            self.chunk_index[str(self.current_chunk_path)] = {
                "start_sec": self.current_chunk_start,
                "end_sec": timestamp_sec,
                "size_bytes": os.path.getsize(self.current_chunk_path),
            }
            self._save_index()

        # Create new chunk
        self.current_chunk_start = timestamp_sec
        chunk_name = f"chunk_{timestamp_sec:.3f}.bag"
        self.current_chunk_path = self.RING_PATH / chunk_name
        self.current_writer = Writer(self.current_chunk_path)
        self._connections_registered = set()

    def find_chunks_for_window(self, start_sec: float,
                                end_sec: float) -> list:
        """Find chunk files that overlap a time window."""
        matching = []
        for path_str, info in self.chunk_index.items():
            if info["end_sec"] >= start_sec and info["start_sec"] <= end_sec:
                matching.append(Path(path_str))
        return sorted(matching)

    def _load_index(self) -> dict:
        import json
        if self.INDEX_PATH.exists():
            with open(self.INDEX_PATH) as f:
                return json.load(f)
        return {}

    def _save_index(self):
        import json
        with open(self.INDEX_PATH, "w") as f:
            json.dump(self.chunk_index, f)
```

### 7.3 MCAP Format for Efficient Storage

While rosbag v1 is the native format for ROS Noetic, MCAP (https://mcap.dev/) provides significant advantages for ML pipeline consumption:

| Feature | rosbag v1 (.bag) | MCAP (.mcap) |
|---------|-----------------|--------------|
| Random access by time | Full scan required | Indexed, O(log n) |
| Multiple topic seek | Read all topics sequentially | Per-topic index |
| Compression | Per-chunk LZ4/BZ2 | Per-message, mixed |
| Schema evolution | Fixed at creation | Schema in file |
| Max file size | 2 GB per chunk (splits) | No practical limit |
| Tooling | ROS-only | Standalone (Python, C++, Go, Rust) |
| Cloud processing | Requires ROS install | No ROS dependency |

**Strategy**: Record in rosbag v1 (native ROS Noetic compatibility for on-vehicle playback) and convert to MCAP during upload staging. The cloud backend (`cloud-backend-infrastructure.md`) processes MCAP files using the standalone `mcap` library without requiring a ROS installation.

```python
# bag_to_mcap.py
# Convert rosbag v1 to MCAP format during upload staging.

from pathlib import Path
from rosbags.rosbag1 import Reader as Bag1Reader
from rosbags.rosbag2 import Writer as Bag2Writer
from rosbags.typesys import get_types_from_msg


def convert_bag_to_mcap(input_bag: Path, output_mcap: Path) -> dict:
    """
    Convert rosbag v1 to MCAP format.
    Uses rosbags library for ROS-free conversion.

    Returns metadata about the conversion.
    """
    stats = {"messages": 0, "topics": set(), "duration_sec": 0}

    with Bag1Reader(input_bag) as reader:
        with Bag2Writer(output_mcap) as writer:
            # Register all connections
            conn_map = {}
            for conn in reader.connections:
                new_conn = writer.add_connection(
                    conn.topic, conn.msgtype,
                    serialization_format="cdr")
                conn_map[conn.id] = new_conn
                stats["topics"].add(conn.topic)

            # Copy messages
            for connection, timestamp, rawdata in reader.messages():
                writer.write(conn_map[connection.id], timestamp, rawdata)
                stats["messages"] += 1

        stats["duration_sec"] = (reader.end_time - reader.start_time) / 1e9

    stats["topics"] = list(stats["topics"])
    stats["input_size_mb"] = input_bag.stat().st_size / 1e6
    stats["output_size_mb"] = output_mcap.stat().st_size / 1e6
    stats["compression_ratio"] = (stats["input_size_mb"] /
                                   max(stats["output_size_mb"], 0.001))
    return stats
```

### 7.4 Custom Rosbag Indexing for Fast Retrieval

For the NVMe chunk system to support fast clip extraction, we maintain a lightweight secondary index beyond the chunk-level index:

```python
# bag_index.py
# Lightweight secondary index for fast time-range queries across chunks.

import struct
import mmap
from pathlib import Path
from typing import List, Tuple


class BagTimeIndex:
    """
    Compact binary index mapping timestamps to chunk files and byte offsets.
    Enables O(log n) time-range queries across the NVMe ring.

    Index format (per entry, 24 bytes):
        uint64  timestamp_ns
        uint32  chunk_id
        uint64  byte_offset_in_chunk
        uint32  message_size

    At 10 Hz LiDAR x 8 sensors = 80 messages/sec:
        1 hour = 288,000 entries = 6.9 MB
        1 day = ~55 MB (fits in RAM for fast binary search)
    """

    ENTRY_SIZE = 24  # bytes per index entry
    INDEX_PATH = Path("/data/ring/time_index.bin")

    def __init__(self):
        self._entries = []  # In-memory for current session
        self._file = None

    def add_entry(self, timestamp_ns: int, chunk_id: int,
                   byte_offset: int, message_size: int):
        """Add a new index entry. Called during NVMe chunk writing."""
        self._entries.append(
            struct.pack("<QIqI", timestamp_ns, chunk_id,
                        byte_offset, message_size))

    def flush(self):
        """Flush pending entries to disk."""
        with open(self.INDEX_PATH, "ab") as f:
            for entry in self._entries:
                f.write(entry)
        self._entries.clear()

    def find_range(self, start_ns: int, end_ns: int) -> List[Tuple]:
        """
        Find all index entries in [start_ns, end_ns].
        Uses binary search for O(log n) start, then sequential scan.
        """
        file_size = self.INDEX_PATH.stat().st_size
        num_entries = file_size // self.ENTRY_SIZE

        with open(self.INDEX_PATH, "rb") as f:
            mm = mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)

            # Binary search for start position
            lo, hi = 0, num_entries - 1
            while lo < hi:
                mid = (lo + hi) // 2
                ts = struct.unpack_from("<Q", mm, mid * self.ENTRY_SIZE)[0]
                if ts < start_ns:
                    lo = mid + 1
                else:
                    hi = mid

            # Sequential scan from start to end
            results = []
            for i in range(lo, num_entries):
                offset = i * self.ENTRY_SIZE
                ts, chunk_id, byte_off, msg_size = struct.unpack_from(
                    "<QIqI", mm, offset)
                if ts > end_ns:
                    break
                if ts >= start_ns:
                    results.append((ts, chunk_id, byte_off, msg_size))

            mm.close()

        return results

    def prune_before(self, timestamp_ns: int):
        """Remove index entries older than timestamp. Called during eviction."""
        # Read, filter, rewrite (infrequent operation during chunk eviction)
        remaining = []
        with open(self.INDEX_PATH, "rb") as f:
            while True:
                data = f.read(self.ENTRY_SIZE)
                if len(data) < self.ENTRY_SIZE:
                    break
                ts = struct.unpack_from("<Q", data, 0)[0]
                if ts >= timestamp_ns:
                    remaining.append(data)

        with open(self.INDEX_PATH, "wb") as f:
            for entry in remaining:
                f.write(entry)
```

---

## 8. Integration with Active Learning Pipeline

### 8.1 Data Triage as the Mouth of the Flywheel

The on-vehicle data triage system is the first stage of the closed-loop data flywheel described in `data-flywheel-airside.md`. Its outputs directly feed the active learning pipeline:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    DATA FLYWHEEL INTEGRATION                              │
│                                                                           │
│  ON-VEHICLE (this document)       CLOUD (data-flywheel-airside.md)       │
│  ┌─────────────────────┐         ┌─────────────────────────────────┐    │
│  │ Ring Buffer          │         │                                  │    │
│  │  ↓                   │         │  Ingestion                       │    │
│  │ Trigger Detection    │         │    ↓                             │    │
│  │  ↓                   │         │  Rosbag Processing (Airflow)     │    │
│  │ Clip Extraction      │         │    ↓                             │    │
│  │  ↓                   │         │  ┌──────────────────┐            │    │
│  │ Edge Classification  │ ──5G──→ │  │ Active Learning  │            │    │
│  │  ↓                   │         │  │ Selector         │            │    │
│  │ Upload Scheduling    │         │  │  - Sort by       │            │    │
│  │                      │         │  │    annotation    │            │    │
│  └─────────────────────┘         │  │    priority      │            │    │
│                                   │  │  - Dedup across  │            │    │
│                                   │  │    fleet         │            │    │
│                                   │  │  - Coverage      │            │    │
│                                   │  │    sampling      │            │    │
│                                   │  └────────┬─────────┘            │    │
│                                   │           ↓                      │    │
│                                   │  Auto-Label → Human QA → Train  │    │
│                                   │                           ↓      │    │
│  ┌─────────────────────┐         │  OTA Model Update ←── Validate   │    │
│  │ Updated Models       │ ←─OTA── │                                  │    │
│  │ Updated Triggers     │         │  Updated trigger thresholds      │    │
│  │ Updated Classifier   │         │  Updated edge classifier         │    │
│  └─────────────────────┘         └─────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Annotation Priority Scoring

The edge classifier's `annotation_priority` score (0-1) is used by the cloud-side active learning selector to decide which clips get human annotation first:

| Priority Range | Action | Expected Cost | Value |
|---------------|--------|---------------|-------|
| 0.90-1.00 | Annotate immediately (safety, novel) | $8-15/frame | Critical for safety case |
| 0.70-0.89 | Annotate within 1 week | $8-15/frame | High model improvement |
| 0.40-0.69 | Auto-label, human QA on subset | $1.50-3/frame | Moderate improvement |
| 0.10-0.39 | Auto-label only, no human QA | $0.50-1/frame | Diversity filler |
| 0.00-0.09 | Archive without annotation | $0/frame | Retained for future mining |

### 8.3 Uncertainty-Scored Upload

The trigger detector already captures the perception model's uncertainty (OOD score, detection confidence, tracking stability). The upload scheduler uses these to further prioritize within the same priority level:

```python
def compute_upload_score(trigger_event, edge_classification) -> float:
    """
    Compute a composite upload priority score that combines:
    1. Trigger priority (P0-P5)
    2. Edge classifier annotation priority
    3. Diversity score (avoid uploading redundant clips)
    4. Uncertainty metrics from perception

    Lower score = upload first (used by priority queue).
    """
    # Base: priority level (0-5, lower = more urgent)
    base = trigger_event.priority * 100.0

    # Annotation priority (0-1, higher = more valuable for annotation)
    annotation = edge_classification.get("annotation_priority", 0.5)
    base -= annotation * 50.0  # Higher annotation priority reduces score

    # Diversity bonus (0-1, higher = more different from recent uploads)
    diversity = edge_classification.get("diversity_score", 0.5)
    base -= diversity * 20.0

    # Uncertainty from perception (higher uncertainty = more informative)
    ood_score = trigger_event.metadata.get("ood_score", 0.0)
    base -= min(ood_score / 10.0, 1.0) * 30.0

    return base
```

### 8.4 Feedback Loop: Cloud-to-Vehicle

The cloud active learning pipeline periodically sends back updates to the vehicle triage system:

1. **Updated trigger thresholds**: If the model improves on certain scenarios (e.g., tracking of catering trucks), the OOD threshold for those scenarios increases, reducing redundant trigger events.

2. **Updated edge classifier**: Retrained on newly annotated data, pushed via OTA alongside model updates.

3. **Coverage gaps**: The cloud identifies underrepresented scenarios (e.g., "night + fog + aircraft taxiing") and sends targeted trigger configurations that lower the activation threshold for those specific conditions.

4. **Saturation signals**: If a particular scenario category has sufficient training data (>5,000 annotated frames), the cloud instructs vehicles to reduce trigger frequency for that category, freeing upload budget for underrepresented scenarios.

```python
# Example OTA-delivered trigger config update
{
    "version": "2026.04.11.001",
    "updates": {
        "ood_spike": {
            "threshold": 6.0,           # Raised from 5.0 (model improved)
            "cooldown_sec": 15          # Increased from 10 (less frequent)
        },
        "novel_object": {
            "cooldown_sec": 60          # Reduced frequency (good coverage)
        }
    },
    "coverage_requests": [
        {
            "condition": "night AND fog",
            "trigger": "weather_transition",
            "boost_priority": -1,       # Elevate priority by 1 level
            "reduce_cooldown": 0.5      # Half the cooldown
        },
        {
            "condition": "aircraft_type == widebody",
            "trigger": "time_sample",
            "interval_override_sec": 600  # Sample every 10 min near widebody
        }
    ],
    "saturation_signals": [
        {
            "scenario": "normal_routine",
            "coverage_frames": 15000,
            "target_frames": 10000,
            "action": "reduce_sampling_50pct"
        }
    ]
}
```

---

## 9. Fleet-Level Upload Coordination

### 9.1 The Bandwidth Contention Problem

When 20+ vehicles share a single airport 5G cell, simultaneous upload from all vehicles can saturate the uplink. Worse, if multiple vehicles witness the same event (e.g., an aircraft taxiing through the apron), they may all trigger clips for the same scene, wasting upload bandwidth on duplicate data.

Fleet-level coordination solves both problems through a central upload coordinator running on the airport edge server.

```
┌────────────────────────────────────────────────────────────────────┐
│            FLEET UPLOAD COORDINATION                                │
│                                                                     │
│  Airport Edge Server                                               │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │ UPLOAD COORDINATOR                                        │     │
│  │                                                           │     │
│  │  1. Collect clip manifests from all vehicles (MQTT)       │     │
│  │  2. Deduplicate: same event seen by multiple vehicles     │     │
│  │  3. Allocate bandwidth slots per vehicle                  │     │
│  │  4. Prioritize fleet-wide: safety first, then coverage    │     │
│  │  5. Assign upload windows to avoid contention             │     │
│  │                                                           │     │
│  │  Vehicle Manifests:                                       │     │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │     │
│  │  │ V-001   │ │ V-002   │ │ V-003   │ │ V-004   │ ...   │     │
│  │  │ 12 clips│ │ 8 clips │ │ 15 clips│ │ 6 clips │       │     │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘       │     │
│  │       └──────┬─────┴──────┬────┘            │            │     │
│  │              ▼            ▼                  ▼            │     │
│  │  ┌──────────────────────────────────────────────┐        │     │
│  │  │ Deduplication Engine                          │        │     │
│  │  │ - Cluster events by time + location           │        │     │
│  │  │ - Select best viewpoint per event             │        │     │
│  │  │ - Tag duplicates as "upload not needed"       │        │     │
│  │  └──────────────┬───────────────────────────────┘        │     │
│  │                  ▼                                        │     │
│  │  ┌──────────────────────────────────────────────┐        │     │
│  │  │ Bandwidth Scheduler                           │        │     │
│  │  │ - Total uplink: 200-500 Mbps                 │        │     │
│  │  │ - Reserve 20% for V2X safety                  │        │     │
│  │  │ - Allocate remaining by priority + fairness   │        │     │
│  │  │ - Stagger vehicle upload windows              │        │     │
│  │  └──────────────────────────────────────────────┘        │     │
│  └──────────────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────────┘
```

### 9.2 Clip Manifest Protocol

Each vehicle periodically publishes a manifest of pending clips to the upload coordinator:

```python
# clip_manifest.py
# Vehicle-side: publish clip manifests to fleet coordinator.

import json
import time


def build_clip_manifest(vehicle_id: str, pending_clips: list) -> dict:
    """
    Build a clip manifest for the fleet upload coordinator.
    Sent via MQTT every 30 seconds.
    """
    manifest = {
        "vehicle_id": vehicle_id,
        "timestamp": time.time(),
        "num_pending": len(pending_clips),
        "total_pending_gb": sum(c["size_gb"] for c in pending_clips),
        "clips": []
    }

    for clip in pending_clips:
        manifest["clips"].append({
            "clip_id": clip["clip_id"],
            "trigger_type": clip["trigger_type"],
            "priority": clip["priority"],
            "timestamp_sec": clip["timestamp_sec"],
            "size_gb": clip["size_gb"],
            "location": {
                "lat": clip["lat"],
                "lon": clip["lon"],
            },
            "scenario_class": clip["edge_classification"]["scenario_class"],
            "annotation_priority": clip["edge_classification"]["annotation_priority"],
            "diversity_score": clip["edge_classification"]["diversity_score"],
        })

    return manifest


# MQTT topic: fleet/{airport}/upload_coordinator/manifests/{vehicle_id}
# Published every 30 seconds
```

### 9.3 Deduplication Logic

Multiple vehicles observing the same event produces redundant clips. The coordinator deduplicates by clustering events in space-time:

```python
# fleet_dedup.py
# Fleet-level event deduplication for upload coordination.

import numpy as np
from typing import List, Dict, Tuple
from scipy.spatial.distance import cdist


def deduplicate_fleet_clips(all_manifests: List[Dict],
                             time_threshold_sec: float = 30.0,
                             distance_threshold_m: float = 50.0) -> List[Dict]:
    """
    Deduplicate clips across the fleet.

    Two clips are considered duplicates if they:
    1. Were triggered within `time_threshold_sec` of each other
    2. Were captured within `distance_threshold_m` of each other
    3. Have the same trigger category (safety, perception, etc.)

    For each duplicate cluster, select the clip with:
    - Highest annotation priority (most informative viewpoint)
    - If tied, closest proximity to the event
    - If tied, highest diversity score

    Returns list of clips with 'upload_approved' flag.
    """
    # Flatten all clips across vehicles
    all_clips = []
    for manifest in all_manifests:
        for clip in manifest["clips"]:
            clip["vehicle_id"] = manifest["vehicle_id"]
            all_clips.append(clip)

    if not all_clips:
        return []

    # Build feature matrix for clustering
    n = len(all_clips)
    timestamps = np.array([c["timestamp_sec"] for c in all_clips])
    locations = np.array([[c["location"]["lat"], c["location"]["lon"]]
                          for c in all_clips])

    # Convert lat/lon to meters (approximate, fine for <1km distances)
    LAT_M = 111320.0  # meters per degree latitude
    LON_M = 111320.0 * np.cos(np.radians(locations[0, 0]))  # At airport latitude
    locations_m = locations * np.array([LAT_M, LON_M])

    # Pairwise distance matrices
    time_dists = np.abs(timestamps[:, None] - timestamps[None, :])
    spatial_dists = cdist(locations_m, locations_m)

    # Find duplicate clusters (simple agglomerative)
    assigned = [False] * n
    clusters = []

    for i in range(n):
        if assigned[i]:
            continue
        cluster = [i]
        assigned[i] = True

        for j in range(i + 1, n):
            if assigned[j]:
                continue
            if (time_dists[i, j] < time_threshold_sec and
                    spatial_dists[i, j] < distance_threshold_m):
                # Same trigger category check
                cat_i = _trigger_category(all_clips[i]["trigger_type"])
                cat_j = _trigger_category(all_clips[j]["trigger_type"])
                if cat_i == cat_j:
                    cluster.append(j)
                    assigned[j] = True

        clusters.append(cluster)

    # Select best clip per cluster
    for cluster in clusters:
        if len(cluster) == 1:
            all_clips[cluster[0]]["upload_approved"] = True
            all_clips[cluster[0]]["dedup_status"] = "unique"
            continue

        # Rank by annotation_priority, then diversity_score
        ranked = sorted(cluster, key=lambda i: (
            -all_clips[i]["annotation_priority"],
            -all_clips[i]["diversity_score"],
        ))

        # Best clip uploads
        best = ranked[0]
        all_clips[best]["upload_approved"] = True
        all_clips[best]["dedup_status"] = "selected_best"

        # Others are suppressed
        for idx in ranked[1:]:
            all_clips[idx]["upload_approved"] = False
            all_clips[idx]["dedup_status"] = "suppressed_duplicate"

        # Exception: if cluster contains safety events, upload all
        if any(all_clips[i]["priority"] == 0 for i in cluster):
            for idx in cluster:
                all_clips[idx]["upload_approved"] = True
                all_clips[idx]["dedup_status"] = "safety_retain_all"

    return all_clips


def _trigger_category(trigger_type: str) -> str:
    """Simplified category mapping for dedup comparison."""
    safety = {"estop", "collision", "cbf_intervention",
              "geofence_breach", "simplex_switch", "aircraft_proximity"}
    if trigger_type in safety:
        return "safety"
    return "other"
```

### 9.4 Coverage-Aware Fleet Sampling

Beyond deduplication, the coordinator ensures geographic and scenario diversity across the fleet:

```python
def coverage_aware_selection(approved_clips: List[Dict],
                              fleet_upload_budget_gb: float,
                              coverage_grid_resolution_m: float = 100.0) -> List[Dict]:
    """
    Select clips from approved set to maximize coverage within budget.

    Uses a spatial grid to ensure geographic diversity:
    - Divide airport into 100m x 100m cells
    - Track coverage (# clips from each cell this week)
    - Prioritize cells with fewer existing clips

    Also ensures scenario diversity:
    - At least 1 clip per scenario category per day per airport
    """
    # Sort by coverage-adjusted priority
    for clip in approved_clips:
        cell_key = _get_grid_cell(clip["location"], coverage_grid_resolution_m)
        cell_count = _get_cell_coverage(cell_key)  # From persistent DB

        # Boost priority for underrepresented cells
        coverage_bonus = max(0, 10 - cell_count) / 10.0  # 0-1, higher = less covered
        clip["coverage_adjusted_score"] = (
            clip["annotation_priority"] * 0.6 +
            clip["diversity_score"] * 0.2 +
            coverage_bonus * 0.2
        )

    # Select clips within budget
    approved_clips.sort(key=lambda c: (-c["priority"],
                                         -c["coverage_adjusted_score"]))

    selected = []
    remaining_budget = fleet_upload_budget_gb

    for clip in approved_clips:
        if clip["size_gb"] <= remaining_budget:
            selected.append(clip)
            remaining_budget -= clip["size_gb"]

    return selected
```

### 9.5 Bandwidth Slot Allocation

The coordinator assigns bandwidth slots to vehicles to prevent contention:

| Time Slot | Duration | Priority Level | Vehicles | Bandwidth/Vehicle |
|-----------|----------|---------------|----------|-------------------|
| Continuous | Always | P0 Safety | All | Full available |
| Staggered 5G | 5 min windows | P1 Perception | 3-5 at a time | 10-20 Mbps |
| Charging (WiFi) | 30-60 min | P1-P5 All | 1-3 at depot | 100-200 Mbps |
| Overnight | 8 hours | All remaining | All at depot | 200-500 Mbps |

---

## 10. Implementation Architecture

### 10.1 ROS Node Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│              DATA TRIAGE ROS NODE ARCHITECTURE                        │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────┐      │
│  │ /data_triage_manager (nodelet, C++)                        │      │
│  │  - Ring buffer manager (multi-topic SPSC rings)            │      │
│  │  - NVMe spill thread                                       │      │
│  │  - Chunk writer and indexer                                 │      │
│  │  - Subscribes to ALL configured sensor/state topics        │      │
│  │  - CPU: 1-2 cores, Memory: 6 GB ring + 512 MB overhead    │      │
│  └────────────────────────┬───────────────────────────────────┘      │
│                            │ internal trigger notification            │
│  ┌────────────────────────┴───────────────────────────────────┐      │
│  │ /trigger_detector (node, Python)                           │      │
│  │  - Subscribes to safety/perception/planning/operator topics│      │
│  │  - Evaluates trigger conditions                             │      │
│  │  - Publishes TriggerEvent to /data_triage/triggers          │      │
│  │  - CPU: <0.5 core, Memory: 128 MB                         │      │
│  └────────────────────────┬───────────────────────────────────┘      │
│                            │ trigger events                           │
│  ┌────────────────────────┴───────────────────────────────────┐      │
│  │ /clip_extractor (node, Python)                             │      │
│  │  - Reads triggers from /data_triage/triggers                │      │
│  │  - Extracts clips from ring buffer (via service call)       │      │
│  │  - Writes compressed rosbag clips to /data/upload/          │      │
│  │  - Calls edge classifier for scenario tagging               │      │
│  │  - CPU: 1 core (burst during extraction), Memory: 2 GB     │      │
│  └────────────────────────┬───────────────────────────────────┘      │
│                            │ clip files + metadata                    │
│  ┌────────────────────────┴───────────────────────────────────┐      │
│  │ /edge_classifier (node, Python + TensorRT DLA)             │      │
│  │  - Classifies extracted clips into scenario categories      │      │
│  │  - Runs MLP on DLA core 0 (no GPU contention)              │      │
│  │  - Publishes classification to clip metadata                │      │
│  │  - DLA: core 0, Memory: 0.5 GB, Power: ~3W                │      │
│  └────────────────────────┬───────────────────────────────────┘      │
│                            │ classified clips                         │
│  ┌────────────────────────┴───────────────────────────────────┐      │
│  │ /upload_scheduler (node, Python, daemon)                   │      │
│  │  - Priority queue of pending uploads                        │      │
│  │  - Bandwidth-aware scheduling                               │      │
│  │  - Multipart resumable upload to S3                         │      │
│  │  - Publishes manifests to fleet coordinator                 │      │
│  │  - Receives upload approval/suppression from coordinator    │      │
│  │  - CPU: 0.5 core, Memory: 256 MB                          │      │
│  └────────────────────────────────────────────────────────────┘      │
│                                                                       │
│  Resource Summary:                                                    │
│  - CPU: 3-4 cores (out of 12 available on Orin 64GB)                 │
│  - Memory: ~9 GB (6 GB ring + 3 GB nodes)                           │
│  - GPU: 0 (no GPU used by triage system)                             │
│  - DLA: core 0 (for edge classifier, ~3W)                           │
│  - NVMe: 2-4 TB dedicated partitions                                 │
│  - Network: 20% uplink reserve maintained for V2X safety             │
└──────────────────────────────────────────────────────────────────────┘
```

### 10.2 NVMe Partition Scheme

```
NVMe SSD Layout (2 TB example):

Partition 1: /boot + /root (200 GB)
├── OS (Ubuntu 20.04 + ROS Noetic)
├── Models (/models/): TensorRT engines, classifier weights
├── Configuration: trigger configs, upload configs
└── System logs

Partition 2: /data/ring (500 GB, ext4 with noatime)
├── chunk_*.bag: 60-second rolling rosbag chunks
├── chunk_index.json: chunk-level time index
├── time_index.bin: message-level binary time index
└── Eviction managed by NVMeRingManager

Partition 3: /data/upload (1.1 TB, ext4 with noatime)
├── P0/: Safety-critical clips (retained 30 days)
├── P1/: Perception anomaly clips
├── P2/: Localization event clips
├── P3/: Planning event clips
├── P5/: Diversity sample clips
├── upload_state.db: SQLite multipart upload tracking
└── Eviction: uploaded + confirmed files deleted

Partition 4: /data/scratch (200 GB, ext4)
├── Temporary files during compression/conversion
├── GDPR face blurring intermediate files
├── MCAP conversion staging
└── Cleaned after each operation
```

### 10.3 Monitoring and Alerting

```python
# triage_monitor.py
# Publish diagnostic metrics for fleet monitoring dashboard.

import rospy
from diagnostic_msgs.msg import DiagnosticArray, DiagnosticStatus, KeyValue


class TriageMonitor:
    """Publishes data triage metrics to /diagnostics for fleet monitoring."""

    def __init__(self, ring_mgr, trigger_detector, clip_extractor,
                 upload_scheduler):
        self.ring_mgr = ring_mgr
        self.trigger = trigger_detector
        self.extractor = clip_extractor
        self.uploader = upload_scheduler
        self.pub = rospy.Publisher("/diagnostics", DiagnosticArray,
                                   queue_size=1)
        rospy.Timer(rospy.Duration(10), self._publish_diagnostics)

    def _publish_diagnostics(self, event):
        """Publish triage metrics every 10 seconds."""
        msg = DiagnosticArray()
        msg.header.stamp = rospy.Time.now()

        # Ring buffer status
        ring_status = DiagnosticStatus()
        ring_status.name = "data_triage/ring_buffer"
        ring_status.level = DiagnosticStatus.OK
        dropped = self.ring_mgr.get_dropped_counts()
        total_dropped = sum(dropped.values())
        if total_dropped > 100:
            ring_status.level = DiagnosticStatus.WARN
        ring_status.message = f"Dropped: {total_dropped}"
        for topic, count in dropped.items():
            ring_status.values.append(
                KeyValue(key=f"dropped/{topic}", value=str(count)))
        msg.status.append(ring_status)

        # Upload status
        upload_status = DiagnosticStatus()
        upload_status.name = "data_triage/upload"
        upload_info = self.uploader.get_status()
        upload_status.level = DiagnosticStatus.OK
        if upload_info["daily_remaining_gb"] < 5:
            upload_status.level = DiagnosticStatus.WARN
        upload_status.message = (
            f"Uploaded: {upload_info['daily_uploaded_gb']:.1f} GB / "
            f"{self.uploader.DAILY_BUDGET_GB} GB")
        upload_status.values.append(
            KeyValue(key="queue_size", value=str(upload_info["queue_size"])))
        upload_status.values.append(
            KeyValue(key="connectivity", value=upload_info["connectivity"]))
        upload_status.values.append(
            KeyValue(key="remaining_gb",
                     value=f"{upload_info['daily_remaining_gb']:.1f}"))
        msg.status.append(upload_status)

        # NVMe disk usage
        disk_status = DiagnosticStatus()
        disk_status.name = "data_triage/nvme"
        disk_status.level = DiagnosticStatus.OK
        ring_usage = self._get_disk_usage("/data/ring")
        upload_usage = self._get_disk_usage("/data/upload")
        if ring_usage > 0.90 or upload_usage > 0.90:
            disk_status.level = DiagnosticStatus.WARN
        if ring_usage > 0.95 or upload_usage > 0.95:
            disk_status.level = DiagnosticStatus.ERROR
        disk_status.message = (
            f"Ring: {ring_usage*100:.0f}%, Upload: {upload_usage*100:.0f}%")
        msg.status.append(disk_status)

        self.pub.publish(msg)

    def _get_disk_usage(self, path: str) -> float:
        import shutil
        total, used, free = shutil.disk_usage(path)
        return used / total
```

### 10.4 Launch File

```xml
<!-- data_triage.launch -->
<!-- Launch all data triage nodes for on-vehicle data management -->
<launch>
  <!-- Parameters -->
  <arg name="vehicle_id" default="adt3-001" />
  <arg name="airport_code" default="EGLL" />
  <arg name="daily_budget_gb" default="50" />
  <arg name="nvme_ring_path" default="/data/ring" />
  <arg name="nvme_upload_path" default="/data/upload" />

  <!-- Ring Buffer Manager (C++ nodelet for performance) -->
  <node pkg="data_triage" type="ring_buffer_manager_node"
        name="ring_buffer_manager" output="screen">
    <param name="config_file" value="$(find data_triage)/config/data_triage_config.yaml" />
    <param name="total_memory_gb" value="6.0" />
    <param name="nvme_ring_path" value="$(arg nvme_ring_path)" />
  </node>

  <!-- Trigger Detector (Python) -->
  <node pkg="data_triage" type="trigger_detector.py"
        name="trigger_detector" output="screen">
    <param name="ood_threshold" value="5.0" />
    <param name="gtsam_sigma_threshold" value="3.0" />
    <param name="frenet_min_feasible" value="10" />
    <param name="cost_percentile" value="90" />
    <param name="aircraft_min_clearance_m" value="3.0" />
    <param name="path_deviation_m" value="1.0" />
    <param name="distance_sample_m" value="5000.0" />
  </node>

  <!-- Clip Extractor (Python) -->
  <node pkg="data_triage" type="clip_extractor.py"
        name="clip_extractor" output="screen">
    <param name="daily_budget_gb" value="$(arg daily_budget_gb)" />
    <param name="staging_path" value="$(arg nvme_upload_path)" />
  </node>

  <!-- Edge Scenario Classifier (Python + DLA) -->
  <node pkg="data_triage" type="edge_classifier.py"
        name="edge_classifier" output="screen">
    <param name="engine_path" value="/models/edge_classifier_dla_int8.engine" />
    <param name="dla_core" value="0" />
  </node>

  <!-- Upload Scheduler (Python daemon) -->
  <node pkg="data_triage" type="upload_scheduler.py"
        name="upload_scheduler" output="screen">
    <param name="vehicle_id" value="$(arg vehicle_id)" />
    <param name="airport_code" value="$(arg airport_code)" />
    <param name="daily_budget_gb" value="$(arg daily_budget_gb)" />
  </node>

  <!-- Triage Monitor (diagnostics publisher) -->
  <node pkg="data_triage" type="triage_monitor.py"
        name="triage_monitor" output="screen" />
</launch>
```

---

## 11. Cost Model and Scaling

### 11.1 Hardware Costs Per Vehicle

| Component | Specification | Cost | Notes |
|-----------|--------------|------|-------|
| NVMe SSD | Samsung 990 PRO 2 TB | $180 | Endurance: 1,200 TBW |
| NVMe SSD (upgrade) | Samsung 990 PRO 4 TB | $350 | For heavy safety event retention |
| M.2 heatsink | Passive aluminum | $10 | Required for sustained write in vehicle |
| **Total hardware** | | **$190-360** | **Per vehicle, one-time** |

The Orin AGX development kit includes an M.2 slot. Production carrier boards (Connect Tech, ADLINK) typically provide 1-2 M.2 NVMe slots.

### 11.2 Development Costs

| Component | Effort | Cost | Timeline |
|-----------|--------|------|----------|
| Ring buffer manager (C++ nodelet) | 3-4 weeks | $12-16K | Month 1 |
| Trigger detector (Python node) | 2 weeks | $8-10K | Month 1 |
| Clip extractor + compression | 2 weeks | $8-10K | Month 2 |
| Edge classifier (rule-based bootstrap) | 1 week | $4-5K | Month 2 |
| Upload scheduler + resumption | 2-3 weeks | $10-12K | Month 2-3 |
| NVMe partitioning + eviction | 1 week | $4-5K | Month 1 |
| Fleet upload coordinator | 2 weeks | $8-10K | Month 3 |
| Monitoring + diagnostics | 1 week | $4-5K | Month 3 |
| Integration testing | 2 weeks | $8-10K | Month 3-4 |
| Edge classifier ML training (V1) | 2 weeks | $8-10K | Month 5+ |
| **Total development** | **18-22 weeks** | **$74-93K** | **4-5 months** |

### 11.3 Operational Costs Per Vehicle Per Month

| Item | Cost/Vehicle/Month | Notes |
|------|-------------------|-------|
| NVMe replacement (2-year MTBF assumed) | $8-15 | $190-360 / 24 months |
| 5G data transfer (50 GB/day x 30 days) | $15-30 | Depends on airport 5G contract |
| Cloud storage (S3 tiered) | $4-9 | From `cloud-backend-infrastructure.md` |
| **Total operational** | **$27-54** | **Per vehicle per month** |

### 11.4 Scaling Economics

| Fleet Size | Dev Cost (Amortized/Vehicle) | Hardware/Vehicle | Ops/Vehicle/Month | Total Year 1/Vehicle |
|------------|---------------------------|-----------------|-------------------|---------------------|
| 5 | $14,800-18,600 | $190-360 | $27-54 | $15,310-19,610 |
| 20 | $3,700-4,650 | $190-360 | $27-54 | $4,210-5,660 |
| 50 | $1,480-1,860 | $190-360 | $27-54 | $1,990-2,870 |
| 100 | $740-930 | $190-360 | $27-54 | $1,250-1,940 |

### 11.5 ROI Analysis

The data triage system pays for itself through:

1. **Reduced cloud storage costs**: Uploading 50 GB/day (curated) vs 286 GB/day (raw) saves ~$15/vehicle/month in S3 costs at 20 vehicles. At 100 vehicles, savings are ~$3,000/month.

2. **Reduced annotation costs**: Edge classification enables prioritized annotation, saving 30-50% of annotation budget ($15-30K/year for a 20-vehicle fleet).

3. **Faster model improvement**: Higher-quality training data from intelligent triage means fewer training iterations and faster convergence. Estimated 2-4 week reduction in model improvement cycles.

4. **Safety evidence**: Complete recording of all safety events with pre-roll context is mandatory for ISO 3691-4 certification. Without the ring buffer system, this requires continuous recording and full upload, which is 5-6x more expensive.

### 11.6 Implementation Phases

| Phase | Duration | Deliverables | Cost |
|-------|----------|-------------|------|
| Phase 1: Foundation | 6 weeks | Ring buffer, NVMe chunks, basic triggers (P0 only), LZ4 compression, simple upload (no priority queue) | $28-36K |
| Phase 2: Intelligence | 6 weeks | Full trigger taxonomy, clip extraction, rule-based edge classifier, priority queue, bandwidth scheduling | $28-35K |
| Phase 3: Fleet | 4 weeks | Fleet coordinator, deduplication, coverage-aware sampling, monitoring dashboard | $12-15K |
| Phase 4: ML Classifier | 4 weeks | Trained edge classifier, DLA deployment, OTA update pipeline for classifier | $8-10K |
| **Total** | **20 weeks** | **Complete system** | **$76-96K** |

---

## 12. Key Takeaways

1. **6 GB in-memory ring buffer + NVMe spill provides 17-25 seconds hot retention**: Sufficient for pre-roll capture on all safety events. NVMe extends to 15+ minutes for longer windows. Total memory footprint fits within Orin 64 GB budget alongside the full autonomy stack.

2. **Lock-free SPSC ring buffers eliminate callback contention**: Each sensor topic writes to its own ring with atomic-only synchronization. Write latency is ~1.2 us for a 2.9 MB LiDAR message. No mutex, no priority inversion, no jitter on perception callbacks.

3. **Six-level trigger hierarchy ensures safety events are never lost**: P0 safety events always extract and always upload regardless of budget. Lower priorities share remaining budget through a priority queue. Daily 50 GB upload budget achieves 82.5% data reduction while retaining all safety events and high-value perception anomalies.

4. **Draco geometry compression achieves 5-10x on point clouds**: Compared to 1.3-1.5x for LZ4. Quantization to 14 bits introduces <1.2 cm error over 200m range, well within LiDAR noise. This single technique is the largest contributor to fitting within the upload budget.

5. **Edge scenario classification on DLA costs <1 ms and 3W**: A 128-dim MLP running on DLA core 0 classifies clips into 10 scenario categories without consuming any GPU cycles. Annotation priority scores enable the cloud pipeline to focus human annotators on the most valuable data first.

6. **Fleet deduplication prevents redundant uploads**: When multiple vehicles witness the same event, the coordinator selects the best viewpoint and suppresses duplicates. For a 20-vehicle fleet, this reduces effective upload volume by an estimated 15-25%.

7. **Multipart upload with SQLite progress tracking handles connectivity loss**: Vehicles operating in 5G dead zones or during network outages resume uploads from the last completed 10 MB part. The 2 TB NVMe staging partition buffers 2-3 days of clips during extended outages.

8. **GDPR compliance requires face blurring before camera upload**: Applied as a pre-upload filter using a lightweight face detector on GPU. LiDAR-only clips (current Aurrigo stack) require no GDPR filtering.

9. **The triage system is the mouth of the data flywheel**: Edge classification metadata travels with each clip to the cloud, enabling the active learning pipeline to prioritize annotation. Cloud feedback updates trigger thresholds and classifier weights via OTA, creating a closed loop that adapts data collection to model needs.

10. **Total cost: $76-96K development + $190-360 hardware per vehicle + $27-54/vehicle/month operations**: ROI positive through reduced cloud storage, targeted annotation, and mandatory safety recording for ISO 3691-4 certification. At 20+ vehicles, the per-vehicle amortized cost drops below $5,000 in Year 1.

---

## 13. References

### Standards and Regulations
1. ISO 3691-4:2020 - Industrial trucks - Safety requirements and verification - Driverless trucks
2. EU Machinery Regulation 2023/1230 - Safety requirements for machinery including AI-autonomous vehicles
3. GDPR Regulation (EU) 2016/679 - General Data Protection Regulation
4. EU Product Liability Directive 2024/2853 - AI/software as products

### Tools and Libraries
5. rosbags - Standalone Python library for reading/writing ROS 1 bags (https://gitlab.com/ternaris/rosbags)
6. mcap - Open-source container file format (https://mcap.dev/)
7. LZ4 - Fast lossless compression (https://github.com/lz4/lz4)
8. Zstandard - Real-time compression algorithm (https://facebook.github.io/zstd/)
9. Google Draco - 3D geometry compression (https://github.com/google/draco)
10. DracoPy - Python bindings for Draco (https://github.com/seung-lab/DracoPy)
11. cloudini - Point cloud compression for ROS (https://github.com/ika-rwth-aachen/cloudini)
12. AWS S3 Multipart Upload API (https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html)

### NVIDIA Orin References
13. Jetson AGX Orin Technical Reference Manual (NVIDIA)
14. TensorRT Developer Guide - DLA Support (NVIDIA)
15. JetPack 6.x Release Notes - NVMe support and NVDLA v2.0

### Academic and Industry References
16. DeepPrivacy2 - Face anonymization for autonomous driving datasets (Hukkelas et al., 2023)
17. DAIR-V2X - Vehicle-Infrastructure Cooperative dataset (Yu et al., CVPR 2022)
18. Where2comm - Communication-efficient cooperative perception (Hu et al., NeurIPS 2022)
19. Tesla AI Day 2022 - Data engine and auto-labeling pipeline overview
20. Waymo Open Dataset - Data collection and curation practices
21. comma.ai openpilot data pipeline - Open-source fleet data collection

### Related Repository Documents
22. `cross-cutting/cloud-backend-infrastructure.md` - Cloud receiving end
23. `cross-cutting/data-flywheel-airside.md` - Closed-loop ML pipeline
24. `cross-cutting/data-engine-from-bags.md` - Rosbag processing for datasets
25. `cross-cutting/fleet-data-pipeline.md` - End-to-end pipeline overview
26. `20-av-platform/compute/nvidia-orin-technical.md` - Orin platform constraints
27. `20-av-platform/networking-connectivity/airport-5g-cbrs.md` - Airport 5G bandwidth
28. `operations/safety/runtime-verification-monitoring.md` - STL monitors as triggers
29. `20-av-platform/sensors/sensor-degradation-health-monitoring.md` - Sensor health triggers
30. `operations/deployment/fleet-data-pipeline.md` - DVC versioning and fleet data management
