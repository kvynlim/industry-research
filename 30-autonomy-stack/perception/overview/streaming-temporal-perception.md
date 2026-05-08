# Streaming & Temporal Perception for Real-Time Driving

## From Single-Frame Detection to Temporally Consistent Scene Understanding

**Last updated:** 2026-04-11

---

**Summary:** Single-frame 3D detection ignores temporal information that is freely available from sequential sensor data. Streaming perception methods propagate object queries, BEV features, or latent states across frames to improve detection accuracy (+3-8% NDS), enable implicit tracking (AMOTA 65%+ without explicit association), and compensate for inference latency — all critical for airside operations where slow-moving objects (1-5 km/h carts) are easily missed in single frames. This document covers every major streaming perception architecture from dense BEV temporal fusion (BEVFormer, SOLOFusion) through sparse query propagation (StreamPETR, Sparse4D v3) to LiDAR temporal accumulation (CenterPoint-Temporal, TransFusion-L), with latency-aware methods (LASP, ASAP) that predict object positions during inference delay. The key finding: **StreamPETR's object-centric temporal mechanism adds only 2-3ms overhead while boosting NDS by 6-8% and providing free multi-object tracking — the highest value-per-FLOP temporal method for Orin deployment**. For Aurrigo's LiDAR-primary stack, simple multi-scan accumulation (3-5 frames, 0.5s window) combined with CenterPoint-Temporal provides most of the benefit at minimal engineering cost.

---

## Table of Contents

1. [Why Temporal Perception Matters](#1-why-temporal-perception-matters)
2. [Temporal Information Sources](#2-temporal-information-sources)
3. [Dense BEV Temporal Fusion](#3-dense-bev-temporal-fusion)
4. [Sparse Query Propagation](#4-sparse-query-propagation)
5. [LiDAR Temporal Accumulation](#5-lidar-temporal-accumulation)
6. [Streaming Perception and Latency Compensation](#6-streaming-perception-and-latency-compensation)
7. [Temporal Occupancy Prediction](#7-temporal-occupancy-prediction)
8. [Video Backbone Architectures](#8-video-backbone-architectures)
9. [Temporal Fusion for Multi-Modal Stacks](#9-temporal-fusion-for-multi-modal-stacks)
10. [Orin Deployment Strategies](#10-orin-deployment-strategies)
11. [Airside-Specific Temporal Challenges](#11-airside-specific-temporal-challenges)
12. [Implementation Guide](#12-implementation-guide)
13. [Key Takeaways](#13-key-takeaways)
14. [References](#14-references)

---

## 1. Why Temporal Perception Matters

### 1.1 The Single-Frame Problem

Single-frame 3D detection treats each LiDAR sweep or camera capture independently, discarding:

- **Velocity information**: A stationary and moving object at the same position look identical
- **Occluded object memory**: Objects hidden behind aircraft fuselage for 1-2 seconds vanish from detections
- **Confidence accumulation**: Multiple observations of the same object should yield higher confidence
- **Trajectory history**: Critical for motion prediction and collision avoidance
- **Sparse region densification**: Multiple frames fill in gaps from LiDAR scan pattern

### 1.2 Why This Matters More on Airside

Airport ramps create uniquely challenging temporal scenarios:

| Challenge | Why Single-Frame Fails | Temporal Solution |
|-----------|----------------------|-------------------|
| Slow-moving GSE (1-5 km/h) | Below LiDAR motion threshold, looks static | Velocity from multi-frame displacement |
| Aircraft fuselage occlusion | 30-65m opaque body hides entire lanes | Memory retains objects during occlusion |
| Personnel crouching/bending | Height changes cause missed detections | Temporal smoothing maintains track |
| FOD on ground | Few LiDAR returns per object (2-5 points) | Multi-scan accumulation increases point count |
| De-icing spray clouds | Transient false positives per-frame | Temporal filtering (real obstacles persist) |
| Jet blast shimmer | LiDAR distortion varies frame-to-frame | Temporal consistency check rejects jitter |

### 1.3 Taxonomy of Temporal Methods

```
Temporal Perception Methods
├── Dense representation temporal fusion
│   ├── BEV concatenation (BEVDet4D, SOLOFusion)
│   ├── BEV warping + attention (BEVFormer v2)
│   └── BEV recurrence (BEVerse)
├── Sparse query propagation
│   ├── Object queries across frames (StreamPETR)
│   ├── Anchor-based temporal (Sparse4D v3)
│   └── Track queries (MUTR3D, PF-Track)
├── Point cloud accumulation
│   ├── Multi-sweep ego-motion compensated (CenterPoint)
│   ├── 4D radar accumulation (100+ sweeps)
│   └── Learned temporal point aggregation
├── Latency-aware streaming
│   ├── Future prediction (Streamer, LASP)
│   ├── Dual-computation (ASAP)
│   └── Async temporal fusion (StreamingFlow)
└── Temporal occupancy
    ├── 4D forecasting (UnO, OccSora)
    └── Scene flow integration (DeFlow)
```

---

## 2. Temporal Information Sources

### 2.1 Ego-Motion Compensation

The foundation of all temporal methods: transform historical data to the current ego-vehicle coordinate frame.

```python
import numpy as np
from scipy.spatial.transform import Rotation

class EgoMotionCompensator:
    """Transform past sensor data to current vehicle frame."""
    
    def __init__(self, max_history: int = 10):
        self.pose_history = []  # List of (timestamp, T_world_ego) tuples
        self.max_history = max_history
    
    def update_pose(self, timestamp: float, T_world_ego: np.ndarray):
        """Add current pose from GTSAM localization."""
        self.pose_history.append((timestamp, T_world_ego.copy()))
        if len(self.pose_history) > self.max_history:
            self.pose_history.pop(0)
    
    def transform_to_current(
        self, points: np.ndarray, source_timestamp: float
    ) -> np.ndarray:
        """Transform points from historical frame to current frame.
        
        Args:
            points: (N, 3+) point cloud in source frame
            source_timestamp: timestamp of source frame
            
        Returns:
            points_current: (N, 3+) points in current ego frame
        """
        T_world_source = self._get_pose(source_timestamp)
        T_world_current = self._get_pose(self.pose_history[-1][0])
        
        # T_current_source = T_current_world @ T_world_source
        T_current_source = np.linalg.inv(T_world_current) @ T_world_source
        
        # Transform xyz, keep other features (intensity, etc.)
        xyz = points[:, :3]
        xyz_h = np.hstack([xyz, np.ones((len(xyz), 1))])
        xyz_transformed = (T_current_source @ xyz_h.T).T[:, :3]
        
        result = points.copy()
        result[:, :3] = xyz_transformed
        return result
    
    def _get_pose(self, timestamp: float) -> np.ndarray:
        """Interpolate pose at given timestamp."""
        # Find bracketing poses
        for i in range(len(self.pose_history) - 1):
            t0, T0 = self.pose_history[i]
            t1, T1 = self.pose_history[i + 1]
            if t0 <= timestamp <= t1:
                alpha = (timestamp - t0) / (t1 - t0 + 1e-9)
                # SLERP for rotation, LERP for translation
                R0 = Rotation.from_matrix(T0[:3, :3])
                R1 = Rotation.from_matrix(T1[:3, :3])
                R_interp = Rotation.from_rotvec(
                    (1 - alpha) * R0.as_rotvec() + alpha * R1.as_rotvec()
                )
                t_interp = (1 - alpha) * T0[:3, 3] + alpha * T1[:3, 3]
                T = np.eye(4)
                T[:3, :3] = R_interp.as_matrix()
                T[:3, 3] = t_interp
                return T
        # Extrapolate from last two poses if needed
        return self.pose_history[-1][1]
```

### 2.2 Temporal Data Sources for Aurrigo Stack

| Source | Rate | History Depth | Compensation | Value |
|--------|------|--------------|--------------|-------|
| RoboSense LiDAR | 10 Hz | 5-10 frames (0.5-1.0s) | Ego-motion (GTSAM) | Point densification, velocity |
| IMU (SBG Ellipse) | 500 Hz | Continuous | N/A (used for compensation) | Sub-frame motion correction |
| GTSAM pose | 10 Hz | Full history | N/A (reference frame) | Ego-motion for warping |
| Wheel odometry | 100 Hz | 10s buffer | N/A (input to GTSAM) | Dead reckoning during GPS dropout |
| Thermal camera | 30 Hz | 3-5 frames | Image-level warp | Personnel trajectory |
| 4D radar | 20 Hz | 50-100 frames (2.5-5s) | Doppler-aware | Long-range velocity field |

### 2.3 Intra-Scan Motion Correction

LiDAR sweeps are not instantaneous — a 10 Hz RoboSense RSHELIOS has 100ms rotation period. At vehicle speed of 25 km/h, points at start vs. end of sweep are separated by ~0.7m.

```python
def motion_correct_lidar_sweep(
    points: np.ndarray,
    point_timestamps: np.ndarray,
    imu_data: list,
    scan_start_time: float,
    scan_end_time: float
) -> np.ndarray:
    """Correct intra-scan motion distortion using IMU data.
    
    Each point is transformed from its capture time to scan_end_time.
    This is critical for multi-LiDAR fusion where sweeps
    are not perfectly synchronized.
    """
    corrected = points.copy()
    
    # For each point, compute relative motion since scan start
    for i, (pt, t) in enumerate(zip(points, point_timestamps)):
        # Interpolate IMU pose at point capture time
        dt = scan_end_time - t
        # Angular velocity integration (simplified)
        omega = interpolate_imu_angular(imu_data, t)
        velocity = interpolate_imu_linear(imu_data, t)
        
        # Small-angle rotation correction
        dR = np.eye(3) + dt * skew_symmetric(omega)
        dt_vec = velocity * dt
        
        corrected[i, :3] = dR @ pt[:3] + dt_vec
    
    return corrected
```

---

## 3. Dense BEV Temporal Fusion

### 3.1 BEVFormer Temporal Self-Attention

BEVFormer (ECCV 2022) introduced temporal BEV fusion via deformable attention between current and historical BEV features.

**Architecture:**
```
Frame t-1 BEV features ─→ Ego-motion warp ─→ Deformable cross-attention
                                                      ↓
Frame t  Image features ─→ Spatial cross-attention ─→ BEV features t
```

**Key mechanism:** Temporal self-attention (TSA) samples reference points from the warped historical BEV grid, allowing the model to attend to where objects were in the previous frame.

```python
class TemporalSelfAttention:
    """BEVFormer-style temporal self-attention layer."""
    
    def __init__(self, embed_dim=256, num_heads=8, num_levels=1, num_points=4):
        self.deformable_attn = DeformableAttention(
            embed_dim, num_heads, num_levels, num_points
        )
    
    def forward(
        self,
        query: torch.Tensor,           # (B, H*W, C) current BEV queries
        prev_bev: torch.Tensor,         # (B, H*W, C) previous BEV features
        ego_motion: torch.Tensor,       # (B, 4, 4) T_current_prev
        reference_points: torch.Tensor  # (B, H*W, 2) BEV grid coordinates
    ) -> torch.Tensor:
        """Attend from current BEV queries to warped previous BEV."""
        
        # Warp previous BEV reference points using ego-motion
        # (transform 2D BEV coordinates by rigid motion)
        warped_ref = self.warp_reference_points(reference_points, ego_motion)
        
        # Stack current (self) + previous (cross-temporal) as key/value
        key_value = torch.stack([query, prev_bev], dim=1)  # (B, 2, H*W, C)
        
        # Deformable attention across temporal dimension
        output = self.deformable_attn(query, key_value, warped_ref)
        
        return output
```

**Performance impact (nuScenes):**
- BEVFormer without temporal: 41.6% NDS
- BEVFormer with 1-frame temporal: 51.7% NDS (+10.1%)
- Diminishing returns beyond 2-3 frames for camera-based BEV

### 3.2 SOLOFusion: Long-Term Stereo for Multi-View 3D Detection

SOLOFusion (ICLR 2023) demonstrates that **long temporal history dramatically improves camera 3D detection** by providing implicit stereo cues.

**Key insight:** Multi-frame ego-motion-compensated image features create wide-baseline stereo pairs. A camera moving 7m/s over 16 frames (1.6s) creates a 11.2m baseline — far wider than any physical stereo rig.

| Temporal Frames | mAP | NDS | Notes |
|----------------|-----|-----|-------|
| 1 frame | 35.4% | 44.9% | Single-frame baseline |
| 4 frames | 42.1% | 50.8% | Noticeable improvement |
| 9 frames | 48.2% | 55.3% | Significant gain |
| 16 frames | 53.4% | 58.2% | Best performance |
| 17+ frames | ~53.4% | ~58.2% | Saturates |

**Limitation for airside:** SOLOFusion assumes sufficient ego-motion for stereo parallax. Aurrigo vehicles often move at 1-5 km/h — 16 frames at 10 Hz with 2 km/h motion gives only 0.9m baseline. This limits camera-based temporal benefits for slow-speed operations.

### 3.3 BEV Temporal Memory Management

For Orin deployment, BEV temporal features consume significant memory:

```
BEV grid: 200 x 200 x 256 channels = ~20 MB per frame (FP16)
3-frame history: ~60 MB
10-frame history: ~200 MB

Orin AGX 64GB: ~60 MB is manageable
Orin NX 16GB:  ~60 MB is 0.4% of RAM — negligible
```

**KV-cache for temporal BEV:**
```python
class BEVTemporalCache:
    """FIFO cache for BEV temporal features with ego-motion warping."""
    
    def __init__(self, max_frames: int = 3, bev_shape=(200, 200, 256)):
        self.max_frames = max_frames
        self.cache = []  # List of (timestamp, bev_features, T_world_ego)
    
    def update(self, timestamp, bev_features, T_world_ego):
        """Push new frame, pop oldest if full."""
        self.cache.append((timestamp, bev_features.clone(), T_world_ego.copy()))
        if len(self.cache) > self.max_frames:
            self.cache.pop(0)
    
    def get_warped_history(self, T_world_current):
        """Get all historical BEV features warped to current frame."""
        warped = []
        for ts, bev, T_world_past in self.cache[:-1]:  # Exclude current
            T_current_past = np.linalg.inv(T_world_current) @ T_world_past
            warped_bev = self.warp_bev(bev, T_current_past)
            warped.append(warped_bev)
        return warped
    
    def warp_bev(self, bev, T_relative):
        """Warp BEV features using 2D affine transform from SE(3)."""
        # Extract 2D rotation and translation from 3D transform
        cos_theta = T_relative[0, 0]
        sin_theta = T_relative[1, 0]
        tx, ty = T_relative[0, 3], T_relative[1, 3]
        
        # Convert to grid_sample affine matrix
        # ... (standard 2D affine warp)
        return torch.nn.functional.grid_sample(
            bev.permute(2, 0, 1).unsqueeze(0),  # (1, C, H, W)
            grid, align_corners=True
        ).squeeze(0).permute(1, 2, 0)
```

---

## 4. Sparse Query Propagation

### 4.1 StreamPETR: Object-Centric Temporal Modeling

StreamPETR (ICCV 2023) is the most efficient temporal method — propagating object-level queries rather than dense BEV features.

**Core mechanism:**
1. Initialize N=900 learnable object queries
2. Per frame: queries attend to image features via spatial cross-attention
3. After detection: top-K=256 foreground queries become "memory" for next frame
4. Memory queries carry object identity, position, velocity across frames
5. Motion-aware layer normalization encodes inter-frame displacement

```python
class StreamPETRTemporalPropagation:
    """StreamPETR's query propagation across frames."""
    
    def __init__(self, embed_dim=256, num_queries=900, top_k=256, num_heads=8):
        self.embed_dim = embed_dim
        self.num_queries = num_queries
        self.top_k = top_k
        
        # Learnable object queries
        self.query_embedding = nn.Embedding(num_queries, embed_dim)
        self.query_pos = nn.Embedding(num_queries, embed_dim)
        
        # Temporal propagation transformer
        self.temporal_attn = nn.MultiheadAttention(embed_dim, num_heads)
        self.spatial_attn = nn.MultiheadAttention(embed_dim, num_heads)
        
        # Motion-aware layer norm
        self.motion_ln = MotionAwareLayerNorm(embed_dim)
        
        # Memory queue
        self.memory_queue = []  # (queries, positions, ego_motion)
    
    def forward(self, image_features, ego_motion):
        """Process one frame with temporal propagation.
        
        Args:
            image_features: (B, N_cam, H*W, C) multi-view features
            ego_motion: (B, 4, 4) ego-motion from last frame
        """
        # Current frame queries
        queries = self.query_embedding.weight.unsqueeze(0)  # (1, 900, C)
        
        # Temporal attention: current queries attend to memory
        if self.memory_queue:
            memory = self.get_warped_memory(ego_motion)
            queries = self.temporal_attn(
                query=queries,
                key=memory,
                value=memory
            )[0]
            
            # Apply motion-aware normalization
            queries = self.motion_ln(queries, ego_motion)
        
        # Spatial attention: queries attend to image features
        queries = self.spatial_attn(
            query=queries,
            key=image_features.flatten(1, 2),
            value=image_features.flatten(1, 2)
        )[0]
        
        # Generate detections
        detections = self.detection_head(queries)
        
        # Select top-K foreground queries for memory
        scores = detections['scores']  # (B, 900)
        top_k_idx = torch.topk(scores, self.top_k, dim=-1).indices
        memory_queries = torch.gather(
            queries, 1, top_k_idx.unsqueeze(-1).expand(-1, -1, self.embed_dim)
        )
        
        # Update memory queue
        self.memory_queue.append(memory_queries.detach())
        if len(self.memory_queue) > 3:
            self.memory_queue.pop(0)
        
        return detections
```

**StreamPETR performance (nuScenes):**

| Configuration | mAP | NDS | AMOTA | FPS (A100) | FPS (Orin est.) |
|--------------|-----|-----|-------|------------|----------------|
| PETR (no temporal) | 39.1% | 45.5% | — | 18.5 | ~6 |
| StreamPETR-S (R50) | 45.0% | 55.0% | 44.7% | 31.7 | ~10 |
| StreamPETR-L (V2-99) | 55.0% | 63.6% | 57.1% | 12.1 | ~4 |
| StreamPETR-L (V2-99, TTA) | 57.1% | 65.5% | 65.3% | — | — |

**Why StreamPETR is ideal for Orin:**
- Query propagation adds only 256 queries × 256 channels = 128 KB memory overhead per frame (vs 20 MB for BEV)
- Temporal attention over 256 memory queries takes <1ms
- Built-in tracking capability — object identity persists through queries
- No BEV grid needed — works directly in 3D query space

### 4.2 Sparse4D v3: Anchor-Based Temporal with Tracking

Sparse4D v3 (2024) extends sparse temporal detection with:
- **Temporal instance denoising**: Augments training by adding noise to ground truth in 3D+time
- **Quality estimation**: Predicts detection quality for NMS-free inference
- **ID-free tracking**: Assigns track IDs by query identity — same query across frames = same object

```
Performance on nuScenes test:
- Sparse4D v3 (ResNet101): 63.0% mAP, 71.9% NDS, 67.7% AMOTA
- vs StreamPETR-L: +6.0% mAP, +6.4% NDS — currently the sparse query SOTA
```

### 4.3 MUTR3D and Track Queries

MUTR3D introduced the concept of persistent track queries — queries that live for the lifetime of an object, initialized at first detection and terminated when the object leaves the scene.

```python
class TrackQueryManager:
    """Manages long-lived track queries for persistent object tracking."""
    
    def __init__(self, max_tracks=100, max_age=10, embed_dim=256):
        self.active_tracks = {}  # track_id -> (query, age, state)
        self.next_id = 0
        self.max_age = max_age
        self.embed_dim = embed_dim
    
    def update(self, detection_queries, detection_scores, threshold=0.3):
        """Match detections to existing tracks, create/destroy tracks."""
        # Hungarian matching between detection queries and track queries
        if self.active_tracks:
            track_queries = torch.stack([t[0] for t in self.active_tracks.values()])
            cost_matrix = 1 - torch.cosine_similarity(
                detection_queries.unsqueeze(1),
                track_queries.unsqueeze(0),
                dim=-1
            )
            row_ind, col_ind = linear_sum_assignment(cost_matrix.cpu().numpy())
            
            matched_det = set()
            matched_track = set()
            
            for r, c in zip(row_ind, col_ind):
                if cost_matrix[r, c] < 0.5:  # Match threshold
                    track_id = list(self.active_tracks.keys())[c]
                    self.active_tracks[track_id] = (
                        detection_queries[r], 0, 'active'
                    )
                    matched_det.add(r)
                    matched_track.add(track_id)
        else:
            matched_det = set()
            matched_track = set()
        
        # Age unmatched tracks
        for tid in list(self.active_tracks.keys()):
            if tid not in matched_track:
                q, age, state = self.active_tracks[tid]
                if age >= self.max_age:
                    del self.active_tracks[tid]
                else:
                    self.active_tracks[tid] = (q, age + 1, 'lost')
        
        # Create new tracks for unmatched high-confidence detections
        for i in range(len(detection_queries)):
            if i not in matched_det and detection_scores[i] > threshold:
                self.active_tracks[self.next_id] = (
                    detection_queries[i], 0, 'active'
                )
                self.next_id += 1
```

---

## 5. LiDAR Temporal Accumulation

### 5.1 Multi-Sweep Point Cloud Aggregation

The simplest and most effective temporal method for LiDAR: concatenate ego-motion-compensated sweeps.

```python
class MultiSweepAccumulator:
    """Accumulate ego-motion-compensated LiDAR sweeps.
    
    Standard approach: 10 sweeps (1s at 10Hz) for nuScenes.
    For airside at 5-25 km/h, 3-5 sweeps (0.3-0.5s) is optimal.
    """
    
    def __init__(self, num_sweeps: int = 5, max_distance: float = 100.0):
        self.num_sweeps = num_sweeps
        self.max_distance = max_distance
        self.sweep_buffer = []  # (points, timestamp, T_world_ego)
    
    def add_sweep(self, points, timestamp, T_world_ego):
        """Add new sweep, maintaining FIFO buffer."""
        self.sweep_buffer.append((points, timestamp, T_world_ego))
        if len(self.sweep_buffer) > self.num_sweeps:
            self.sweep_buffer.pop(0)
    
    def get_accumulated(self):
        """Get all sweeps transformed to latest ego frame.
        
        Returns:
            accumulated: (N_total, 5) — x, y, z, intensity, time_offset
        """
        if not self.sweep_buffer:
            return np.empty((0, 5))
        
        latest_ts, _, T_world_latest = (
            self.sweep_buffer[-1][1],
            self.sweep_buffer[-1][0],
            self.sweep_buffer[-1][2]
        )
        T_latest_world = np.linalg.inv(T_world_latest)
        
        all_points = []
        for points, ts, T_world_ego in self.sweep_buffer:
            # Transform to latest ego frame
            T_latest_past = T_latest_world @ T_world_ego
            xyz = points[:, :3]
            xyz_h = np.hstack([xyz, np.ones((len(xyz), 1))])
            xyz_transformed = (T_latest_past @ xyz_h.T).T[:, :3]
            
            # Add time offset as feature (seconds relative to current)
            time_offset = np.full((len(points), 1), ts - latest_ts)
            
            # Filter by distance
            dist = np.linalg.norm(xyz_transformed, axis=1)
            mask = dist < self.max_distance
            
            augmented = np.hstack([
                xyz_transformed[mask],
                points[mask, 3:4],  # intensity
                time_offset[mask]
            ])
            all_points.append(augmented)
        
        return np.vstack(all_points) if all_points else np.empty((0, 5))
```

### 5.2 CenterPoint Temporal Extension

CenterPoint's temporal extension concatenates multi-sweep pillar features before the backbone:

```
Frame t:   Points → Pillarize → Pillar Features (C=64)
Frame t-1: Points → Ego-compensate → Pillarize → Pillar Features (C=64)
Frame t-2: Points → Ego-compensate → Pillarize → Pillar Features (C=64)

Concatenate → (C=192) → Conv reduce to C=64 → Standard backbone
```

**Performance impact on nuScenes:**

| Method | Sweeps | mAP | NDS | Latency (Orin INT8) |
|--------|--------|-----|-----|---------------------|
| CenterPoint | 1 | 56.4% | 64.8% | 6.84ms |
| CenterPoint | 3 | 58.9% | 66.7% | 8.2ms |
| CenterPoint | 5 | 59.6% | 67.2% | 9.8ms |
| CenterPoint | 10 | 60.3% | 67.5% | 14.1ms |

**Recommendation for Aurrigo:** 3-sweep accumulation provides 80% of the temporal benefit at only 1.4ms additional cost. Beyond 5 sweeps, motion compensation errors from GTSAM pose uncertainty dominate.

### 5.3 Temporal Point Cloud Features

Beyond concatenation, learned temporal features capture motion patterns:

```python
class TemporalPointFeatureEncoder(nn.Module):
    """Encode temporal information per point.
    
    Each point gets features from its time offset and
    displacement relative to previous frames.
    """
    
    def __init__(self, time_channels=16, motion_channels=32):
        super().__init__()
        # Sinusoidal time encoding (like positional encoding)
        self.time_encoder = SinusoidalEncoding(time_channels)
        
        # Motion feature from displacement
        self.motion_mlp = nn.Sequential(
            nn.Linear(3, motion_channels),
            nn.ReLU(),
            nn.Linear(motion_channels, motion_channels)
        )
    
    def forward(self, points, time_offsets, displacements=None):
        """
        Args:
            points: (N, 4) — x, y, z, intensity
            time_offsets: (N,) — seconds relative to current
            displacements: (N, 3) — motion vectors (if available from scene flow)
        """
        time_features = self.time_encoder(time_offsets)
        
        if displacements is not None:
            motion_features = self.motion_mlp(displacements)
            return torch.cat([points, time_features, motion_features], dim=-1)
        else:
            return torch.cat([points, time_features], dim=-1)
```

### 5.4 4D Radar Temporal Accumulation

4D radar operates at 20 Hz with much sparser returns (~300 points/scan vs ~120K for LiDAR). Accumulation over 50-100 frames (2.5-5s) is standard:

```
Benefits for airside:
- 100-frame 4D radar accumulation: ~30K points (comparable to single LiDAR sweep)
- Doppler velocity is per-point: no need for multi-frame displacement estimation
- Immune to rain, fog, de-icing spray — temporal accumulation only improves already-clean data
- 5s history at 5 km/h = 7m baseline — excellent for slow-moving GSE tracking
```

---

## 6. Streaming Perception and Latency Compensation

### 6.1 The Streaming Perception Problem

Traditional perception evaluation assumes zero inference latency — detections correspond exactly to the input frame. In reality, by the time inference completes, the world has moved:

```
Time     t0          t0 + Δ          t0 + 2Δ
         |            |               |
Input: [Frame 0] ──inference──→ [Results 0] arrives
                  [Frame 1] ──inference──→ [Results 1] arrives

At time t0 + Δ:
  - Results 0 is available but refers to state at t0
  - Frame 1 is captured but results not yet available
  - Real objects have moved Δ × velocity since frame 0
```

At 25 km/h with 50ms inference latency, objects have moved 35 cm. At 5 km/h: 7 cm. For airside slow-speed operations, this matters less than highway driving, but still matters for close-proximity personnel detection.

### 6.2 ASAP Benchmark

The Autonomous-driving Streaming Perception (ASAP) benchmark evaluates perception under realistic latency constraints:

- **Streaming AP (sAP)**: Evaluates detections against ground truth at the time results become available, not at input time
- Standard mAP drops 5-15% when evaluated as sAP
- Methods must either be fast (reduce Δ) or predict ahead (compensate for Δ)

### 6.3 Latency-Aware 3D Streaming Perception (LASP)

LASP (2025) addresses latency through:

1. **Latency-aware history integration**: Extends query propagation into a continuous process using neural ODE, handling variable latency
2. **Latency-aware predictive detection**: Predicts where objects will be at output time using trajectory estimation

```python
class LatencyAwareDetector:
    """Compensate detection results for inference latency.
    
    Simple but effective: shift detected objects by
    velocity × latency_estimate.
    """
    
    def __init__(self, default_latency_ms: float = 50.0):
        self.default_latency = default_latency_ms / 1000.0
        self.latency_estimator = ExponentialMovingAverage(alpha=0.1)
    
    def compensate(self, detections, measured_latency_ms=None):
        """Shift detections forward in time by latency estimate.
        
        Args:
            detections: list of {center_xyz, velocity_xyz, ...}
            measured_latency_ms: actual inference time (for EMA update)
        """
        if measured_latency_ms is not None:
            self.latency_estimator.update(measured_latency_ms / 1000.0)
            latency = self.latency_estimator.value
        else:
            latency = self.default_latency
        
        compensated = []
        for det in detections:
            det_comp = det.copy()
            # Constant velocity prediction
            det_comp['center_xyz'] = (
                det['center_xyz'] + det['velocity_xyz'] * latency
            )
            # Also shift heading by yaw_rate if available
            if 'yaw_rate' in det:
                det_comp['heading'] = det['heading'] + det['yaw_rate'] * latency
            compensated.append(det_comp)
        
        return compensated
```

### 6.4 Dual-Path Streaming (for Camera Stacks)

For camera-based systems with higher latency (100-200ms), dual-path approaches run a lightweight detector on latest frames while the full model processes slightly older frames:

```
Path 1 (heavy, 150ms): Full BEVFormer on frame t-1 → accurate detections (delayed)
Path 2 (light, 30ms):  YOLO on frame t → fast detections (less accurate)

Fuse: Use heavy detections as prior, light detections for update
```

**Not relevant for Aurrigo's LiDAR stack** where CenterPoint runs in 6.84ms, but useful if camera fallback is activated.

---

## 7. Temporal Occupancy Prediction

### 7.1 Connection to World Models

Temporal occupancy methods bridge perception and prediction — they estimate what the 3D occupancy grid will look like in the future.

Already covered extensively in:
- `30-autonomy-stack/world-models/occupancy-flow-4d-scenes.md` (UnO, OccSora, scene flow)
- `30-autonomy-stack/world-models/lidar-native-world-models.md` (Copilot4D, LidarDM)

**Key temporal aspects not covered elsewhere:**

### 7.2 Streaming Occupancy Updates

Rather than recomputing full occupancy each frame, streaming updates modify the existing grid:

```python
class StreamingOccupancyGrid:
    """Incrementally update 3D occupancy using temporal consistency."""
    
    def __init__(self, grid_size=(200, 200, 16), voxel_size=0.4):
        self.grid = np.zeros(grid_size, dtype=np.float32)
        self.confidence = np.zeros(grid_size, dtype=np.float32)
        self.update_count = np.zeros(grid_size, dtype=np.int32)
        self.voxel_size = voxel_size
    
    def update(self, new_observation, ego_motion):
        """Fuse new observation with existing grid.
        
        Uses Bayesian update: P(occupied | obs1, obs2) = 
        P(obs2|occupied) * P(occupied|obs1) / P(obs2)
        """
        # Warp existing grid by ego-motion
        self.grid = self.warp_grid(self.grid, ego_motion)
        self.confidence = self.warp_grid(self.confidence, ego_motion)
        
        # Bayesian fusion (log-odds for numerical stability)
        log_odds_prior = np.log(self.confidence / (1 - self.confidence + 1e-7) + 1e-7)
        log_odds_obs = np.log(new_observation / (1 - new_observation + 1e-7) + 1e-7)
        log_odds_posterior = log_odds_prior + log_odds_obs
        
        self.confidence = 1 / (1 + np.exp(-log_odds_posterior))
        self.update_count += (new_observation > 0.1).astype(np.int32)
    
    def get_confident_occupancy(self, min_observations=3, min_confidence=0.7):
        """Return occupancy that meets both observation count and confidence."""
        mask = (self.update_count >= min_observations) & \
               (self.confidence >= min_confidence)
        return self.grid * mask
```

### 7.3 Temporal Filtering for Transient Noise

Airside-specific transient phenomena that temporal filtering eliminates:

| Phenomenon | Duration | LiDAR Effect | Temporal Filter |
|-----------|----------|-------------|----------------|
| De-icing spray | 5-15s | Dense false point cloud | Require 3+ consistent frames |
| Jet exhaust shimmer | Continuous | Range noise ±0.5m | Median filter across 5 frames |
| Rain/puddle splash | <1s | Random false points | Require persistence > 2 frames |
| Dust plume (from taxiing) | 2-5s | Gradual density reduction | Track and classify as transient |
| Snow/hail | Continuous | Sparse random points | Statistical outlier removal |

```python
class TemporalConsistencyFilter:
    """Filter detections requiring temporal consistency."""
    
    def __init__(self, persistence_threshold=3, window_size=5):
        self.persistence_threshold = persistence_threshold
        self.window_size = window_size
        self.detection_history = []  # List of detection sets per frame
    
    def filter(self, current_detections, ego_compensator):
        """Keep only detections seen in >= persistence_threshold of last window_size frames."""
        self.detection_history.append(current_detections)
        if len(self.detection_history) > self.window_size:
            self.detection_history.pop(0)
        
        if len(self.detection_history) < self.persistence_threshold:
            return current_detections  # Not enough history
        
        # Count how many frames each current detection appears in
        filtered = []
        for det in current_detections:
            count = 0
            for past_dets in self.detection_history[:-1]:
                # Transform past detections to current frame
                for past_det in past_dets:
                    if self._is_same_object(det, past_det, distance_thresh=1.0):
                        count += 1
                        break
            
            if count >= self.persistence_threshold - 1:  # -1 because current frame counts
                filtered.append(det)
            elif det['class'] in ['personnel', 'aircraft']:
                # Safety-critical: lower threshold for people and aircraft
                if count >= 1:
                    filtered.append(det)
        
        return filtered
```

---

## 8. Video Backbone Architectures

### 8.1 From Image to Video Backbones

Standard AV perception uses per-frame image backbones (ResNet, Swin, ViT). Video backbones process multiple frames jointly:

| Architecture | Type | Temporal Mechanism | FPS (A100) | Params | Key Paper |
|-------------|------|-------------------|------------|--------|-----------|
| ResNet-50 | Image | None (single frame) | 200+ | 25M | He 2016 |
| Swin-T | Image | None | 120+ | 29M | Liu 2021 |
| TimeSformer | Video | Divided space-time attention | 45 | 121M | Bertasius 2021 |
| VideoMAE v2 | Video | Masked autoencoder pre-training | 30 | 633M | Wang 2023 |
| MViTv2-S | Video | Pooling attention + multi-scale | 60 | 35M | Li 2022 |
| InternVideo2 | Video | Unified 2D+3D with learnable gating | 20 | 6B | Wang 2024 |
| Hiera | Video | Hierarchical masked autoencoder | 80 | 51M | Ryali 2023 |

### 8.2 Practical Choice for Orin

**Video backbones are NOT recommended for Orin-class hardware** in the perception loop. The overhead of joint spatiotemporal attention is too high:

```
ResNet-50 on Orin INT8: ~4ms per frame
TimeSformer-S on Orin INT8: ~35ms per 4 frames (8.75ms/frame effective)
MViTv2-S on Orin FP16: ~25ms per 4 frames (6.25ms/frame effective)
```

The latency increase eliminates the benefit of temporal information. Instead:
- Use per-frame backbone + **query-level temporal fusion** (StreamPETR approach)
- Or per-frame backbone + **feature-level temporal concatenation** (SOLOFusion/BEVDet4D)

### 8.3 Video Backbones for Offline Analysis

Video backbones are valuable for:
- **Data engine**: Auto-labeling using VideoMAE features for temporal consistency
- **Anomaly detection**: InternVideo2 for fleet-scale incident analysis
- **VLM co-pilot**: StreamingVLM for real-time video narration at 1-2 Hz (non-safety-critical path)

---

## 9. Temporal Fusion for Multi-Modal Stacks

### 9.1 Cross-Modal Temporal Alignment

When fusing LiDAR and camera (future Aurrigo capability), temporal alignment is critical:

```
LiDAR sweep: 100ms capture window, single timestamp at scan end
Camera frame: ~1ms exposure, effectively instantaneous
4D Radar: 50ms cycle

Misalignment at 25 km/h:
  - LiDAR intra-scan: 0.7m max displacement
  - LiDAR-camera sync error (1ms): 0.7cm (negligible)
  - LiDAR-radar sync error (5ms): 3.5cm
```

### 9.2 Temporal Feature Alignment via Deformable Attention

```python
class TemporalCrossModalFusion(nn.Module):
    """Fuse temporal features from different modalities.
    
    Each modality has its own temporal buffer; fusion happens
    in BEV space after individual temporal processing.
    """
    
    def __init__(self, embed_dim=256, num_modalities=3):
        super().__init__()
        # Per-modality temporal encoders
        self.lidar_temporal = MultiSweepEncoder(embed_dim)
        self.camera_temporal = BEVTemporalEncoder(embed_dim)
        self.radar_temporal = AccumulationEncoder(embed_dim)
        
        # Cross-modal fusion with temporal awareness
        self.fusion = nn.TransformerDecoderLayer(
            d_model=embed_dim, nhead=8, batch_first=True
        )
        
        # Modality timestamp encoding
        self.time_embed = SinusoidalEncoding(embed_dim)
    
    def forward(self, lidar_sweeps, camera_frames, radar_sweeps, timestamps):
        """Fuse temporally-encoded multi-modal features."""
        # Each modality processes its temporal history independently
        lidar_bev = self.lidar_temporal(lidar_sweeps)   # (B, H*W, C)
        camera_bev = self.camera_temporal(camera_frames) # (B, H*W, C)
        radar_bev = self.radar_temporal(radar_sweeps)    # (B, H*W, C)
        
        # Add timestamp encoding to handle async sensors
        lidar_bev += self.time_embed(timestamps['lidar'])
        camera_bev += self.time_embed(timestamps['camera'])
        radar_bev += self.time_embed(timestamps['radar'])
        
        # Concatenate and fuse
        multi_modal = torch.cat([lidar_bev, camera_bev, radar_bev], dim=1)
        fused = self.fusion(lidar_bev, multi_modal)  # LiDAR queries, MM keys
        
        return fused
```

### 9.3 Asynchronous Temporal Fusion

CoBEVFlow (from collaborative perception) handles asynchronous data from multiple vehicles — the same technique applies to asynchronous sensors on a single vehicle:

```
Key idea: Learn a BEV flow field to warp features from 
different timestamps to a common reference time.

BEV(t) + BEV(t-δ) → FlowNet → Flow(δ) → Warp(BEV(t-δ), Flow(δ)) → BEV_aligned(t)
```

---

## 10. Orin Deployment Strategies

### 10.1 Compute Budget for Temporal Methods

Starting from Aurrigo's current pipeline and adding temporal capability:

| Component | Current (ms) | + Temporal (ms) | Method |
|-----------|-------------|-----------------|--------|
| Multi-sweep accumulation | — | +1.4 | 3-sweep ego-compensated concat |
| PointPillars/CenterPoint | 6.84 | 8.2 | 3-sweep input (wider pillars) |
| Temporal filtering | — | +0.5 | 5-frame persistence filter |
| Latency compensation | — | +0.1 | Constant velocity prediction |
| **Total** | **6.84** | **10.2** | **+3.4ms overhead** |

For future camera-augmented stack:

| Component | Latency (ms) | Notes |
|-----------|-------------|-------|
| ResNet-50 backbone | 4.0 | INT8, per-frame |
| StreamPETR temporal | 2.5 | Query propagation + attention |
| BEV construction | 3.0 | Deformable spatial attention |
| Detection head | 1.0 | FP16 |
| **Camera temporal total** | **10.5** | Fits in 50ms cycle |

### 10.2 Memory Management

```python
class OrinTemporalMemoryManager:
    """Manage temporal feature memory within Orin constraints.
    
    Orin AGX 64GB: generous for temporal features
    Orin NX 16GB: requires careful management
    """
    
    MEMORY_BUDGET = {
        'orin_agx_64gb': {
            'lidar_sweeps': 5,       # 5 × 120K × 5 × 4B = ~12 MB
            'bev_cache': 3,          # 3 × 200×200×256 × 2B = ~60 MB
            'query_memory': 512,     # 512 × 256 × 2B = ~256 KB
            'occupancy_grid': 1,     # 200×200×16 × 4B = ~10 MB
        },
        'orin_nx_16gb': {
            'lidar_sweeps': 3,       # 3 × 120K × 5 × 4B = ~7.2 MB
            'bev_cache': 1,          # 1 × 200×200×256 × 2B = ~20 MB
            'query_memory': 256,     # 256 × 256 × 2B = ~128 KB
            'occupancy_grid': 1,     # 200×200×16 × 4B = ~10 MB (reduced resolution)
        }
    }
    
    def __init__(self, platform='orin_agx_64gb'):
        self.budget = self.MEMORY_BUDGET[platform]
        self.lidar_buffer = deque(maxlen=self.budget['lidar_sweeps'])
        self.bev_cache = deque(maxlen=self.budget['bev_cache'])
        self.query_memory = None
```

### 10.3 TensorRT Considerations for Temporal Models

Temporal models have **state** — they are not pure functions. TensorRT engines are stateless. Solutions:

1. **External state management**: Keep temporal buffers in CPU/GPU memory outside TensorRT engine
2. **Unrolled model**: Export model with fixed temporal depth (e.g., always 3 frames)
3. **Plugin approach**: Custom TensorRT plugin for temporal attention with state

```python
# Recommended approach: External state + TensorRT core
class TemporalTRTRunner:
    """Run temporal perception with TensorRT engine + external state."""
    
    def __init__(self, engine_path):
        self.engine = load_trt_engine(engine_path)
        self.temporal_state = {
            'prev_bev': None,
            'prev_queries': None,
            'sweep_buffer': deque(maxlen=3)
        }
    
    def infer(self, current_input, ego_motion):
        """Single-frame inference with temporal state."""
        # Prepare input: current + warped historical
        if self.temporal_state['prev_bev'] is not None:
            warped = warp_bev(self.temporal_state['prev_bev'], ego_motion)
            trt_input = {
                'current_features': current_input,
                'history_bev': warped,
                'history_queries': self.temporal_state['prev_queries']
            }
        else:
            trt_input = {
                'current_features': current_input,
                'history_bev': torch.zeros_like(current_input),
                'history_queries': torch.zeros(256, 256)
            }
        
        # Run TensorRT engine
        outputs = self.engine.run(trt_input)
        
        # Update state for next frame
        self.temporal_state['prev_bev'] = outputs['bev_features']
        self.temporal_state['prev_queries'] = outputs['top_k_queries']
        
        return outputs['detections']
```

---

## 11. Airside-Specific Temporal Challenges

### 11.1 Very Slow Object Speeds

Most temporal methods are tuned for highway/urban driving (30-130 km/h). Airside GSE operates at 1-25 km/h.

**Impact on temporal perception:**
- **Motion estimation**: 1 km/h = 0.028 m/frame at 10 Hz — below PointPillars voxel resolution (0.2m). Need >7 frames to detect 1-voxel displacement
- **SOLOFusion stereo**: 16 frames at 2 km/h = 0.9m baseline — insufficient for depth triangulation (need >3m for reasonable accuracy)
- **Doppler**: 4D radar Doppler at 1 km/h = 0.28 m/s — near noise floor. Need accumulation

**Solutions:**
1. Increase temporal window: 5→10 frames for LiDAR accumulation at slow speeds
2. Use GTSAM velocity directly (fused IMU/wheel/GNSS) rather than frame-to-frame displacement
3. Weight Doppler observations by vehicle speed — ignore at <2 km/h

### 11.2 Extended Occlusion Durations

A baggage cart behind a B737 fuselage may be occluded for 30+ seconds while both move at 2 km/h. Standard track persistence (10 frames = 1s) loses the object.

```python
class AirsideTrackPersistence:
    """Extended track persistence for airside occlusion patterns."""
    
    # Airside-specific occlusion durations
    PERSISTENCE_BY_CLASS = {
        'aircraft': 300,       # 30s — aircraft don't disappear
        'baggage_tractor': 100, # 10s — may be behind fuselage
        'belt_loader': 100,     # 10s
        'cargo_dolly': 150,     # 15s — often in train behind tractor
        'gpu': 50,              # 5s — large, rarely fully occluded
        'personnel': 30,        # 3s — safety critical, shorter window
        'fod': 200,             # 20s — stationary, should persist
        'catering_truck': 50,   # 5s — large vehicle
        'fuel_truck': 50,       # 5s — large vehicle
        'pushback_tug': 100,    # 10s — often attached to aircraft
    }
    
    def get_max_age(self, object_class: str, confidence: float) -> int:
        """Get maximum track age (frames) before deletion.
        
        Higher confidence tracks persist longer.
        """
        base = self.PERSISTENCE_BY_CLASS.get(object_class, 30)
        # Scale by confidence: high-confidence tracks persist 2x longer
        return int(base * (0.5 + confidence))
```

### 11.3 Dynamic vs. Quasi-Static Classification

Airside objects have bimodal speed distribution — either moving or parked. Temporal perception must classify this:

```
Moving: aircraft taxiing (5-30 km/h), baggage tractors (2-15 km/h), personnel walking (3-6 km/h)
Quasi-static: parked GSE, aircraft at stand, barriers, cones

Transition events (critical to detect):
  - Tractor starts moving from parked (0→5 km/h in 2-3s)
  - Personnel steps out from behind parked vehicle
  - Pushback tug engages aircraft nose gear (coupled motion begins)
```

### 11.4 Turnaround Scene Evolution

Airport turnarounds follow predictable temporal patterns (~30-60 min sequences):

```
Phase 1 (0-2 min):   Aircraft arrives, stops, chocks placed
Phase 2 (2-5 min):   Bridge connects, belt loader positions
Phase 3 (5-25 min):  Baggage/cargo unload, catering, cleaning
Phase 4 (25-40 min): Baggage/cargo load, fuel truck
Phase 5 (40-55 min): Equipment withdrawal, pushback tug connects
Phase 6 (55-60 min): Pushback, taxi out

Temporal perception value: Predict next phase from current scene state
→ Pre-position autonomous GSE for next task
→ Anticipate equipment movement patterns
→ Detect turnaround anomalies (equipment in wrong position)
```

---

## 12. Implementation Guide

### 12.1 ROS Integration Architecture

```python
#!/usr/bin/env python
"""Temporal perception ROS node for Aurrigo stack."""

import rospy
from sensor_msgs.msg import PointCloud2
from nav_msgs.msg import Odometry
from std_msgs.msg import Header
from collections import deque

class TemporalPerceptionNode:
    """Multi-sweep temporal perception with streaming output."""
    
    def __init__(self):
        rospy.init_node('temporal_perception')
        
        # Parameters
        self.num_sweeps = rospy.get_param('~num_sweeps', 3)
        self.persistence_frames = rospy.get_param('~persistence_frames', 5)
        self.latency_compensation = rospy.get_param('~latency_compensation', True)
        
        # Components
        self.ego_compensator = EgoMotionCompensator(max_history=20)
        self.sweep_accumulator = MultiSweepAccumulator(self.num_sweeps)
        self.consistency_filter = TemporalConsistencyFilter(
            persistence_threshold=3, window_size=self.persistence_frames
        )
        self.latency_compensator = LatencyAwareDetector(default_latency_ms=10.0)
        
        # Track manager for implicit tracking
        self.track_manager = TrackQueryManager(max_tracks=100, max_age=50)
        
        # Subscribers
        self.pc_sub = rospy.Subscriber(
            '/merged_points', PointCloud2, self.pointcloud_callback, queue_size=1
        )
        self.odom_sub = rospy.Subscriber(
            '/gtsam/odometry', Odometry, self.odometry_callback, queue_size=10
        )
        
        # Publishers
        self.det_pub = rospy.Publisher(
            '/temporal_detections', DetectionArray, queue_size=1
        )
        self.track_pub = rospy.Publisher(
            '/tracks', TrackArray, queue_size=1
        )
        
        # Timing
        self.inference_times = deque(maxlen=100)
    
    def odometry_callback(self, msg):
        """Update ego-motion from GTSAM localization."""
        T = odometry_to_matrix(msg)
        self.ego_compensator.update_pose(msg.header.stamp.to_sec(), T)
    
    def pointcloud_callback(self, msg):
        """Process incoming LiDAR sweep with temporal context."""
        t_start = rospy.Time.now()
        
        # Convert ROS msg to numpy
        points = pointcloud2_to_array(msg)
        timestamp = msg.header.stamp.to_sec()
        T_world_ego = self.ego_compensator.pose_history[-1][1]
        
        # Accumulate sweeps
        self.sweep_accumulator.add_sweep(points, timestamp, T_world_ego)
        accumulated = self.sweep_accumulator.get_accumulated()
        
        # Run detector on accumulated point cloud
        detections = self.detector.infer(accumulated)
        
        # Temporal consistency filter
        detections = self.consistency_filter.filter(
            detections, self.ego_compensator
        )
        
        # Latency compensation
        inference_time_ms = (rospy.Time.now() - t_start).to_sec() * 1000
        self.inference_times.append(inference_time_ms)
        
        if self.latency_compensation:
            detections = self.latency_compensator.compensate(
                detections, inference_time_ms
            )
        
        # Update tracks
        self.track_manager.update(
            [d['query'] for d in detections],
            [d['score'] for d in detections]
        )
        
        # Publish
        self.det_pub.publish(self.to_detection_msg(detections, msg.header))
        self.track_pub.publish(self.to_track_msg(self.track_manager.active_tracks, msg.header))
```

### 12.2 Phased Implementation Roadmap

| Phase | Duration | Deliverable | Cost | Impact |
|-------|----------|-------------|------|--------|
| 1. Multi-sweep accumulation | 2 weeks | 3-sweep ego-compensated LiDAR | $5K | +2-3% NDS, velocity estimation |
| 2. Temporal consistency filter | 1 week | Persistence-based filtering | $2K | Eliminates transient false positives |
| 3. Latency compensation | 1 week | Constant-velocity prediction | $1K | -0.35m prediction error at 25 km/h |
| 4. Track persistence (airside) | 2 weeks | Extended occlusion handling | $5K | Object memory during 10-30s occlusion |
| 5. StreamPETR integration | 4 weeks | Full sparse query temporal | $15K | +6-8% NDS, implicit tracking |
| 6. Temporal occupancy | 3 weeks | Streaming occupancy grid | $10K | FOD persistence, area monitoring |
| **Total** | **13 weeks** | **Full temporal stack** | **$38K** | **+8-12% NDS, tracking, filtering** |

### 12.3 Testing and Validation

```python
# Temporal perception test scenarios for airside
TEMPORAL_TEST_SCENARIOS = {
    'slow_approach': {
        'description': 'Baggage tractor approaching at 2 km/h',
        'metric': 'velocity_error < 0.5 km/h after 5 frames',
        'frames': 20
    },
    'fuselage_occlusion': {
        'description': 'Cart passes behind B737 fuselage',
        'metric': 'track maintained during 10s occlusion, re-associated after',
        'frames': 150
    },
    'personnel_crouching': {
        'description': 'Ground crew crouches to inspect wheel',
        'metric': 'detection maintained with confidence > 0.5',
        'frames': 50
    },
    'deicing_spray': {
        'description': 'De-icing spray creates point cloud artifact',
        'metric': 'no false positive objects from spray',
        'frames': 100
    },
    'turnaround_sequence': {
        'description': 'Full 45-minute turnaround',
        'metric': 'all GSE tracked, correct phase classification',
        'frames': 27000
    },
    'start_from_parked': {
        'description': 'Stationary GSE begins moving',
        'metric': 'motion detected within 3 frames (0.3s)',
        'frames': 30
    }
}
```

---

## 13. Key Takeaways

1. **Multi-sweep LiDAR accumulation is the highest-value temporal method**: 3-sweep ego-compensated concatenation adds only 1.4ms but provides velocity estimation, point densification, and +2.5% mAP. Implement this first.

2. **StreamPETR provides the best temporal perception per FLOP**: Object query propagation adds <3ms and 128 KB memory while providing +6-8% NDS and implicit multi-object tracking without explicit data association.

3. **Sparse4D v3 is the sparse query SOTA**: 71.9% NDS and 67.7% AMOTA on nuScenes test — transforms detection into a unified detection+tracking system with temporal denoising.

4. **Dense BEV temporal fusion is too expensive for Orin**: BEVFormer temporal self-attention requires 20 MB per cached frame. For LiDAR-primary stacks, multi-sweep accumulation achieves comparable benefit at 1/100th the memory.

5. **Slow airside speeds require longer temporal windows**: Standard 5-frame (0.5s) windows are insufficient for 1-5 km/h objects. Use 10+ frames (1s+) for displacement-based velocity, or leverage GTSAM velocity estimates directly.

6. **Latency compensation is nearly free and always beneficial**: Constant-velocity forward prediction by inference_time × velocity costs <0.1ms. At 25 km/h with 10ms inference, this recovers 7cm of prediction error.

7. **Temporal filtering eliminates airside transient noise**: De-icing spray, jet blast shimmer, puddle splashes, and dust plumes cause per-frame false positives that 3-frame persistence filtering removes at zero accuracy cost.

8. **Extended track persistence is essential for airside**: Standard 1s track timeout loses objects during 10-30s aircraft fuselage occlusions. Class-dependent persistence (30s for GSE, 3s for personnel) maintains tracks through typical airside occlusion patterns.

9. **Video backbones are not appropriate for Orin real-time**: TimeSformer/MViTv2 add 20-30ms overhead vs per-frame ResNet. Use per-frame backbone + query-level temporal fusion instead. Video backbones are valuable for offline data engine analysis.

10. **4D radar temporal accumulation provides unique value**: 100-frame (5s) radar accumulation creates dense point clouds (~30K points) immune to weather, de-icing, and jet blast — complementary to LiDAR temporal methods.

11. **Turnaround phase detection is a temporal perception application**: 30-60 minute turnaround sequences follow predictable patterns. Scene-level temporal understanding enables predictive GSE positioning and anomaly detection.

12. **Intra-scan motion correction matters for multi-LiDAR fusion**: 100ms RoboSense rotation at 25 km/h creates 0.7m intra-scan distortion. IMU-based per-point motion correction is essential for temporal consistency.

13. **TensorRT requires external state management for temporal models**: TRT engines are stateless. Keep temporal buffers (BEV cache, query memory) in external GPU memory and pass as additional inputs.

14. **Streaming occupancy grids provide persistent area monitoring**: Bayesian occupancy updates across frames enable FOD persistence monitoring and area-based anomaly detection that single-frame detection cannot provide.

15. **Asynchronous multi-modal temporal fusion uses flow-based warping**: When LiDAR (10 Hz), camera (30 Hz), and radar (20 Hz) arrive at different times, learned BEV flow compensates for temporal misalignment.

16. **Total implementation: $38K over 13 weeks**: Phased from simple multi-sweep (2 weeks, $5K) through full StreamPETR integration (4 weeks, $15K). Each phase delivers independent value.

---

## 14. References

1. Wang et al., "StreamPETR: Exploring Object-Centric Temporal Modeling for Efficient Multi-View 3D Object Detection," ICCV 2023
2. Li et al., "BEVFormer: Learning Bird's-Eye-View Representation from Multi-Camera Images via Spatiotemporal Transformers," ECCV 2022
3. Park et al., "SOLOFusion: Time Will Tell — New Outlooks and A Baseline for Temporal Multi-View 3D Object Detection," ICLR 2023
4. Lin et al., "Sparse4D v3: Advancing End-to-End 3D Detection and Tracking," arXiv 2024
5. Yin et al., "Center-based 3D Object Detection and Tracking," CVPR 2021
6. Chen et al., "ASAP: Are We Ready for Vision-Centric Driving Streaming Perception?" CVPR 2023
7. Li et al., "LASP: Towards Latency-aware 3D Streaming Perception for Autonomous Driving," arXiv 2025
8. Zhang et al., "MUTR3D: A Multi-camera Tracking Framework via 3D-to-2D Queries," CVPR 2022
9. Wang et al., "StreamingFlow: Streaming Occupancy Forecasting with Asynchronous Multi-modal Data Streams," NeurIPS 2023
10. Xu et al., "CoBEVFlow: Robust Asynchronous Collaborative Perception via BEV Flow," NeurIPS 2023
11. Tang et al., "BEVDet4D: 3D Object Detection with Temporal Cues in Multi-Camera BEV Space," arXiv 2022
12. Li et al., "MViTv2: Improved Multiscale Vision Transformers," CVPR 2022
13. Bertasius et al., "Is Space-Time Attention All You Need for Video Understanding?" ICML 2021
