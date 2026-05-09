# Radar-LiDAR Fusion for Adverse Weather Perception

## Combining 4D Radar Weather Robustness with LiDAR Geometric Precision

**Last updated:** 2026-04-11

---

**Summary:** LiDAR provides centimeter-level 3D geometry but degrades significantly in rain (-30-50% point density), fog (-20-75% range), snow (-15-40% AP), de-icing spray (near-total blindness), and jet blast (range shimmer ±0.5m). 4D radar maintains stable performance across all weather conditions due to millimeter-wave physics — wavelengths (4mm at 77 GHz) are 100-1000x larger than weather particles. Fusing both sensors creates a perception system that maintains >85% of clear-weather performance in conditions where either sensor alone drops below 50%. This document covers the full radar-LiDAR fusion pipeline from early fusion (point cloud concatenation), through mid-level fusion (BEV feature alignment), to late fusion (detection-level merging), with specific architectures proven for adverse weather (L4DR achieving +20% mAP in dense fog, RLNet adaptive gating). For the reference airside AV stack's airside stack, the recommendation is **asymmetric mid-level fusion: LiDAR-primary with radar weather augmentation** — using radar to denoise and densify LiDAR features when weather degrades, rather than treating both sensors equally. The Continental ARS548 4D radar already in the hardware roadmap provides the foundation; integration cost is $35-55K over 12 weeks.

For LiDAR-only preprocessing, snow/rain/fog artifact removal, and benchmark coverage, see [LiDAR Artifact Removal Techniques](lidar-artifact-removal-techniques.md) and [Weather Robustness Datasets](../datasets-benchmarks/weather-robustness-datasets.md).

---

## Table of Contents

1. [Why Radar-LiDAR Fusion for Airside](#1-why-radar-lidar-fusion-for-airside)
2. [Sensor Physics Complementarity](#2-sensor-physics-complementarity)
3. [Fusion Architecture Taxonomy](#3-fusion-architecture-taxonomy)
4. [Early Fusion: Point Cloud Level](#4-early-fusion-point-cloud-level)
5. [Mid-Level Fusion: Feature Space](#5-mid-level-fusion-feature-space)
6. [Late Fusion: Detection Level](#6-late-fusion-detection-level)
7. [Weather-Specific Performance Analysis](#7-weather-specific-performance-analysis)
8. [Airside Adverse Conditions](#8-airside-adverse-conditions)
9. [4D Radar Processing Pipeline](#9-4d-radar-processing-pipeline)
10. [Adaptive Fusion Gating](#10-adaptive-fusion-gating)
11. [Orin Deployment and Integration](#11-orin-deployment-and-integration)
12. [Key Takeaways](#12-key-takeaways)
13. [References](#13-references)

---

## 1. Why Radar-LiDAR Fusion for Airside

### 1.1 Weather Exposure Profile

Airport airside operations face weather exposure that enclosed or urban AV applications rarely encounter:

| Weather Condition | Frequency (Major Hub) | LiDAR Impact | Radar Impact | Duration |
|------------------|----------------------|-------------|-------------|----------|
| Rain (moderate) | 60-100 days/year | -30-50% density | <5% loss | Hours |
| Fog (visibility <400m) | 20-50 days/year | -20-75% range | <2% loss | Hours |
| Snow/ice | 10-40 days/year | -15-40% AP | <5% loss | Hours-days |
| De-icing spray | Per aircraft departure | Near-total blindness 5-15s | <10% loss | Seconds |
| Jet blast | Per aircraft departure | ±0.5m range error, 10-30s | Negligible | Seconds |
| Freezing rain | 5-15 days/year | Lens icing → failure | Radome heating OK | Hours |
| Dust/sand storm | 1-5 days/year (arid) | -40-60% density | <10% loss | Hours |
| Standing water splash | Frequent in rain | Momentary blindness | Negligible | <1s |

### 1.2 Current reference airside AV stack Gap

the reference airside AV stack's stack is LiDAR-only with 4-8 RoboSense sensors. In adverse weather:
- **No perception fallback** except speed reduction and eventual stop
- De-icing spray causes 5-15s perception blackout — vehicle must halt
- Fog at major hubs (LHR: 50+ days/year) reduces operational window
- Rain operations require manual safety operator override

Adding 4D radar provides a **weather-immune perception channel** that maintains operation during conditions that currently halt the vehicle.

---

## 2. Sensor Physics Complementarity

### 2.1 Fundamental Physics

```
LiDAR (905nm / 1550nm):
  Wavelength: 0.905-1.55 μm
  Rain droplet: 0.5-5 mm → 500-5000× larger than wavelength
  Interaction: Rayleigh scattering + absorption → severe attenuation
  Range in heavy rain: 30-60m (from 100m+ clear)
  Angular resolution: 0.1-0.2° (centimeter precision at 50m)

4D Radar (77 GHz):
  Wavelength: 3.9 mm
  Rain droplet: 0.5-5 mm → comparable to wavelength
  Interaction: Mie scattering (minimal attenuation for most rain rates)
  Range in heavy rain: >95% of clear-weather range
  Angular resolution: 1-2° (meter-level at 50m)
  Unique: Doppler velocity per detection (direct radial velocity measurement)
```

### 2.2 Complementary Strengths

| Capability | LiDAR | 4D Radar | Combined |
|-----------|-------|---------|----------|
| Range accuracy | ±2cm | ±25cm | ±2cm (LiDAR-primary) |
| Angular resolution | 0.1° | 1-2° | 0.1° (LiDAR) + radar confirmation |
| Velocity (direct) | No (multi-frame) | Yes (Doppler) | Direct + geometric |
| Weather robustness | Poor | Excellent | Excellent |
| Metal detection | Good | Excellent | Excellent |
| Person detection | Good | Moderate | Good + weather-robust |
| FOD (small objects) | Possible (few points) | Difficult (<0.1m²) | LiDAR with radar support |
| Point density | 100K+ per scan | 200-2000 per scan | LiDAR density + radar redundancy |
| Cost per sensor | $1-8K | $0.5-2K | Modest additional cost |

### 2.3 Continental ARS548 Specifications

The 4D radar recommended for reference airside AV stack integration:

```
Continental ARS548:
  Range: 300m (typical), 350m (max)
  FOV: ±60° azimuth, ±14° elevation
  Angular resolution: 1.2° azimuth, 2.3° elevation
  Range resolution: 0.22m
  Detections per frame: up to 800
  Doppler range: ±56.5 m/s
  Doppler resolution: 0.11 m/s
  Update rate: 20 Hz (vs 10 Hz LiDAR)
  Power: 13W
  Interface: Ethernet (100Base-T1)
  Operating temp: -40°C to +85°C
  IP rating: IP69K (high-pressure wash resistant)
  Cost: ~$500-1,500 per unit
```

---

## 3. Fusion Architecture Taxonomy

### 3.1 Overview

```
Radar-LiDAR Fusion Architectures
├── Early Fusion (Input Level)
│   ├── Point cloud concatenation
│   ├── Point cloud painting (radar features on LiDAR points)
│   └── Radar-guided LiDAR densification
├── Mid-Level Fusion (Feature Level)
│   ├── BEV feature concatenation (L4DR, RLNet)
│   ├── Cross-attention fusion (transformer-based)
│   ├── Deformable cross-attention (adaptive alignment)
│   └── Multi-modal denoising diffusion (MDD)
├── Late Fusion (Decision Level)
│   ├── Detection merging (NMS-based)
│   ├── Track-level fusion (Kalman filter)
│   └── Confidence-weighted voting
└── Asymmetric Fusion
    ├── LiDAR-primary, radar-augmented (recommended)
    ├── Weather-adaptive gating
    └── Radar-guided LiDAR denoising
```

### 3.2 Architecture Selection for Airside

| Architecture | Accuracy (Clear) | Accuracy (Fog) | Latency | Complexity |
|-------------|-----------------|----------------|---------|-----------|
| LiDAR only | 100% baseline | 40-70% | 6.84ms | Low |
| Early fusion (concat) | +2-3% | 70-80% | +1.5ms | Low |
| Mid-level BEV fusion | +5-8% | 80-90% | +3-5ms | Medium |
| Cross-attention fusion | +8-12% | 85-92% | +5-8ms | High |
| Late fusion (track) | +1-2% | 75-85% | +0.5ms | Low |
| Asymmetric adaptive | +5-8% | 85-95% | +3-5ms | Medium |

**Recommendation: Asymmetric adaptive fusion** — best weather robustness with moderate complexity.

---

## 4. Early Fusion: Point Cloud Level

### 4.1 Point Cloud Concatenation

Simplest approach: merge radar points into LiDAR point cloud with additional features.

```python
import numpy as np

class RadarLiDARPointFusion:
    """Early fusion by concatenating radar and LiDAR point clouds.
    
    Radar points are augmented with Doppler velocity and RCS features
    that LiDAR lacks. LiDAR points get zero-filled radar features.
    """
    
    # Feature channels: x, y, z, intensity, doppler, rcs, sensor_id, time_offset
    FEATURE_DIM = 8
    
    def fuse(self, lidar_points, radar_points, T_lidar_radar):
        """Fuse radar and LiDAR point clouds in LiDAR frame.
        
        Args:
            lidar_points: (N, 4) — x, y, z, intensity
            radar_points: (M, 7) — x, y, z, rcs, doppler_vr, doppler_compensated, snr
            T_lidar_radar: (4, 4) — extrinsic transform radar→LiDAR frame
        Returns:
            fused: (N+M, 8) — unified point cloud with extended features
        """
        # Transform radar points to LiDAR frame
        radar_xyz = radar_points[:, :3]
        radar_xyz_h = np.hstack([radar_xyz, np.ones((len(radar_xyz), 1))])
        radar_in_lidar = (T_lidar_radar @ radar_xyz_h.T).T[:, :3]
        
        # Build LiDAR features: [x, y, z, intensity, 0_doppler, 0_rcs, 0_sensor, 0_time]
        lidar_features = np.zeros((len(lidar_points), self.FEATURE_DIM))
        lidar_features[:, :4] = lidar_points[:, :4]
        lidar_features[:, 6] = 0  # sensor_id: 0 = LiDAR
        
        # Build radar features: [x, y, z, 0_intensity, doppler, rcs, 1_sensor, 0_time]
        radar_features = np.zeros((len(radar_points), self.FEATURE_DIM))
        radar_features[:, :3] = radar_in_lidar
        radar_features[:, 3] = 0  # No intensity from radar
        radar_features[:, 4] = radar_points[:, 4]  # Doppler velocity
        radar_features[:, 5] = radar_points[:, 3]  # RCS
        radar_features[:, 6] = 1  # sensor_id: 1 = radar
        
        return np.vstack([lidar_features, radar_features])
```

### 4.2 Radar-Guided LiDAR Densification

Use radar detections to guide attention in LiDAR-sparse weather-degraded regions:

```python
class RadarGuidedDensification:
    """Use radar detections to boost LiDAR processing in weather-degraded regions.
    
    When LiDAR point density drops below threshold near a radar detection,
    increase temporal accumulation and lower detection thresholds locally.
    """
    
    def __init__(self, density_threshold=10, radius=3.0):
        self.density_threshold = density_threshold  # Points per m³
        self.radius = radius  # Meters around radar detection
    
    def densify(self, lidar_points, radar_detections, lidar_history):
        """Selectively densify LiDAR near radar detections.
        
        If LiDAR density is low near a radar detection, 
        accumulate more historical sweeps in that region.
        """
        dense_points = [lidar_points]
        
        for det in radar_detections:
            center = det['position'][:3]
            
            # Check LiDAR density near this radar detection
            distances = np.linalg.norm(lidar_points[:, :3] - center, axis=1)
            nearby_count = np.sum(distances < self.radius)
            volume = (4/3) * np.pi * self.radius**3
            density = nearby_count / volume
            
            if density < self.density_threshold:
                # Low LiDAR density — accumulate historical points in this region
                for hist_points in lidar_history[-5:]:  # Up to 5 extra frames
                    hist_distances = np.linalg.norm(hist_points[:, :3] - center, axis=1)
                    hist_nearby = hist_points[hist_distances < self.radius]
                    dense_points.append(hist_nearby)
        
        return np.vstack(dense_points)
```

---

## 5. Mid-Level Fusion: Feature Space

### 5.1 L4DR: Weather-Robust LiDAR-4D Radar Fusion

L4DR (AAAI 2025) achieves +20% mAP in dense fog over LiDAR-only by using radar features to denoise weather-corrupted LiDAR features.

**Architecture:**
```
LiDAR → Voxelization → Sparse Conv → LiDAR BEV features
                                           ↓
4D Radar → Pillarization → Radar Net → Radar BEV features → MDD Module → Denoised LiDAR BEV
                                                                              ↓
                                                                    Detection Head → 3D Boxes
```

**Multi-modal Denoising Diffusion (MDD):**
- Uses radar BEV as conditioning signal
- Learns to remove weather noise from LiDAR features
- Forward process: add weather-like noise to clean LiDAR features
- Reverse process: denoise using radar-conditioned model
- Result: LiDAR features that look "clean weather" even in fog/rain

```python
class MultiModalDenoisingModule(nn.Module):
    """L4DR-inspired denoising using radar features to clean LiDAR.
    
    Simplified version — full implementation uses diffusion sampling.
    """
    
    def __init__(self, lidar_channels=256, radar_channels=128, hidden=256):
        super().__init__()
        # Condition on radar features
        self.radar_encoder = nn.Sequential(
            nn.Conv2d(radar_channels, hidden, 3, padding=1),
            nn.BatchNorm2d(hidden),
            nn.ReLU()
        )
        
        # Denoise LiDAR features
        self.denoiser = nn.Sequential(
            nn.Conv2d(lidar_channels + hidden, hidden, 3, padding=1),
            nn.BatchNorm2d(hidden),
            nn.ReLU(),
            nn.Conv2d(hidden, hidden, 3, padding=1),
            nn.BatchNorm2d(hidden),
            nn.ReLU(),
            nn.Conv2d(hidden, lidar_channels, 1)
        )
        
        # Weather condition estimator
        self.weather_gate = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Flatten(),
            nn.Linear(lidar_channels + radar_channels, 1),
            nn.Sigmoid()
        )
    
    def forward(self, lidar_bev, radar_bev):
        """Denoise LiDAR BEV features using radar conditioning.
        
        Args:
            lidar_bev: (B, C_l, H, W) — possibly weather-degraded
            radar_bev: (B, C_r, H, W) — weather-robust
        Returns:
            denoised: (B, C_l, H, W)
        """
        # Encode radar conditioning
        radar_cond = self.radar_encoder(radar_bev)
        
        # Estimate weather degradation level
        combined = torch.cat([
            lidar_bev.mean(dim=(2,3)),
            radar_bev.mean(dim=(2,3))
        ], dim=1)
        weather_weight = self.weather_gate(combined)  # 0=clear, 1=severe
        
        # Denoise
        concat = torch.cat([lidar_bev, radar_cond], dim=1)
        residual = self.denoiser(concat)
        
        # Adaptive: more denoising in worse weather
        denoised = lidar_bev + weather_weight.unsqueeze(-1).unsqueeze(-1) * residual
        
        return denoised
```

### 5.2 BEV Feature Concatenation

Simpler approach: independently generate BEV features from each sensor, then concatenate and fuse.

```python
class BEVFeatureFusion(nn.Module):
    """BEV-level radar-LiDAR fusion."""
    
    def __init__(self, lidar_channels=256, radar_channels=64):
        super().__init__()
        self.lidar_bev_encoder = PointPillarsBEV(out_channels=lidar_channels)
        self.radar_bev_encoder = RadarPillarsBEV(out_channels=radar_channels)
        
        # Fusion: concatenate + reduce
        self.fusion_conv = nn.Sequential(
            nn.Conv2d(lidar_channels + radar_channels, lidar_channels, 3, padding=1),
            nn.BatchNorm2d(lidar_channels),
            nn.ReLU(),
            nn.Conv2d(lidar_channels, lidar_channels, 3, padding=1),
            nn.BatchNorm2d(lidar_channels),
            nn.ReLU()
        )
    
    def forward(self, lidar_points, radar_points):
        lidar_bev = self.lidar_bev_encoder(lidar_points)
        radar_bev = self.radar_bev_encoder(radar_points)
        
        # Align spatial dimensions (radar may have coarser grid)
        if radar_bev.shape != lidar_bev.shape:
            radar_bev = F.interpolate(radar_bev, size=lidar_bev.shape[2:])
        
        fused = self.fusion_conv(torch.cat([lidar_bev, radar_bev], dim=1))
        return fused
```

### 5.3 Cross-Attention Fusion

Transformer cross-attention learns where to look in radar features to augment LiDAR:

```python
class CrossAttentionRadarLiDAR(nn.Module):
    """Transformer cross-attention for radar-LiDAR fusion."""
    
    def __init__(self, embed_dim=256, num_heads=8):
        super().__init__()
        # LiDAR queries attend to radar keys/values
        self.cross_attn = nn.MultiheadAttention(embed_dim, num_heads, batch_first=True)
        self.norm = nn.LayerNorm(embed_dim)
        self.ffn = nn.Sequential(
            nn.Linear(embed_dim, embed_dim * 4),
            nn.GELU(),
            nn.Linear(embed_dim * 4, embed_dim)
        )
        
        # Project radar features to same dimension
        self.radar_proj = nn.Linear(64, embed_dim)
    
    def forward(self, lidar_features, radar_features):
        """LiDAR features attend to radar features.
        
        lidar_features: (B, N_lidar, C)
        radar_features: (B, N_radar, C_radar)
        """
        radar_proj = self.radar_proj(radar_features)
        
        # Cross-attention: LiDAR asks "what does radar see here?"
        attended, _ = self.cross_attn(
            query=lidar_features,
            key=radar_proj,
            value=radar_proj
        )
        
        # Residual connection
        lidar_features = self.norm(lidar_features + attended)
        lidar_features = lidar_features + self.ffn(lidar_features)
        
        return lidar_features
```

---

## 6. Late Fusion: Detection Level

### 6.1 Detection Merging

Run independent detectors on each sensor, then merge results:

```python
class DetectionLevelFusion:
    """Late fusion: merge radar and LiDAR detection results."""
    
    def __init__(self, iou_threshold=0.3, radar_velocity_boost=0.15):
        self.iou_threshold = iou_threshold
        self.radar_velocity_boost = radar_velocity_boost
    
    def fuse(self, lidar_detections, radar_detections):
        """Merge detection lists with radar velocity enrichment.
        
        Strategy:
        1. Match by IoU
        2. Matched: keep LiDAR box geometry, add radar velocity
        3. Unmatched LiDAR: keep as-is
        4. Unmatched radar: add with lower confidence (radar-only)
        """
        matched_lidar = set()
        matched_radar = set()
        fused = []
        
        # Match by 2D BEV IoU
        for i, ldet in enumerate(lidar_detections):
            best_iou = 0
            best_j = -1
            for j, rdet in enumerate(radar_detections):
                iou = self.compute_bev_iou(ldet, rdet)
                if iou > best_iou:
                    best_iou = iou
                    best_j = j
            
            if best_iou > self.iou_threshold:
                # Matched: combine
                fused_det = ldet.copy()
                fused_det['velocity'] = radar_detections[best_j]['doppler_velocity']
                fused_det['confidence'] = min(
                    ldet['confidence'] + self.radar_velocity_boost, 1.0
                )
                fused_det['source'] = 'fused'
                fused.append(fused_det)
                matched_lidar.add(i)
                matched_radar.add(best_j)
            else:
                fused.append({**ldet, 'source': 'lidar_only'})
        
        # Radar-only detections (not matched to LiDAR)
        for j, rdet in enumerate(radar_detections):
            if j not in matched_radar:
                # Radar-only: lower confidence, but valuable in weather
                fused.append({
                    'center_xyz': rdet['position'],
                    'velocity': rdet['doppler_velocity'],
                    'confidence': rdet['confidence'] * 0.6,
                    'class': 'unknown',  # Radar has poor class discrimination
                    'source': 'radar_only'
                })
        
        return fused
```

### 6.2 Track-Level Fusion (Kalman Filter)

```python
class RadarLiDARTrackFusion:
    """Kalman filter fusion at track level.
    
    LiDAR provides position and size updates.
    Radar provides velocity updates.
    Combined: better state estimation than either alone.
    """
    
    def __init__(self):
        # State: [x, y, z, vx, vy, vz, l, w, h, yaw]
        self.state_dim = 10
        self.lidar_obs_dim = 7  # x, y, z, l, w, h, yaw
        self.radar_obs_dim = 4  # x, y, z, vr (radial velocity)
    
    def update_lidar(self, track, lidar_detection):
        """Update track with LiDAR observation (position + size)."""
        H_lidar = np.zeros((self.lidar_obs_dim, self.state_dim))
        H_lidar[0, 0] = 1  # x
        H_lidar[1, 1] = 1  # y
        H_lidar[2, 2] = 1  # z
        H_lidar[3, 6] = 1  # length
        H_lidar[4, 7] = 1  # width
        H_lidar[5, 8] = 1  # height
        H_lidar[6, 9] = 1  # yaw
        
        R_lidar = np.diag([0.05, 0.05, 0.1, 0.2, 0.1, 0.1, 0.05])  # LiDAR noise
        
        return self.kalman_update(track, lidar_detection, H_lidar, R_lidar)
    
    def update_radar(self, track, radar_detection):
        """Update track with radar observation (position + radial velocity)."""
        # Radar gives radial velocity, not Cartesian
        # Need to decompose based on angle from sensor to target
        angle = np.arctan2(track.state[1], track.state[0])
        
        H_radar = np.zeros((self.radar_obs_dim, self.state_dim))
        H_radar[0, 0] = 1  # x
        H_radar[1, 1] = 1  # y
        H_radar[2, 2] = 1  # z
        H_radar[3, 3] = np.cos(angle)  # vr = vx*cos + vy*sin
        H_radar[3, 4] = np.sin(angle)
        
        R_radar = np.diag([0.25, 0.25, 0.5, 0.05])  # Radar noise (coarser position, precise velocity)
        
        return self.kalman_update(track, radar_detection, H_radar, R_radar)
```

---

## 7. Weather-Specific Performance Analysis

### 7.1 Rain

| Rain Rate | LiDAR mAP | Radar mAP | Fused mAP | LiDAR Degradation |
|-----------|-----------|-----------|-----------|-------------------|
| Clear | 65.0% | 42.0% | 68.0% | 0% |
| Light (2 mm/h) | 58.0% | 41.5% | 65.0% | -11% |
| Moderate (8 mm/h) | 48.0% | 41.0% | 60.0% | -26% |
| Heavy (25 mm/h) | 35.0% | 40.0% | 55.0% | -46% |
| Torrential (50+ mm/h) | 20.0% | 38.0% | 48.0% | -69% |

### 7.2 Fog

| Visibility | LiDAR mAP | Radar mAP | Fused mAP | L4DR mAP | Notes |
|-----------|-----------|-----------|-----------|----------|-------|
| Clear (>10 km) | 65.0% | 42.0% | 68.0% | 68.0% | Baseline |
| Light fog (1 km) | 55.0% | 42.0% | 63.0% | 65.0% | Mild degradation |
| Moderate fog (400m) | 42.0% | 41.0% | 57.0% | 62.0% | Significant |
| Dense fog (100m) | 25.0% | 40.0% | 50.0% | 55.0% | L4DR +20% over LiDAR |
| Very dense (<50m) | 15.0% | 38.0% | 42.0% | 48.0% | Radar becomes primary |

### 7.3 Snow

```
Snow effects on LiDAR:
  - Falling snow: random false points (similar to rain but denser)
  - Snow accumulation: ground reflectivity changes → RANSAC ground removal struggles
  - Snow on sensor: progressive lens occlusion → total blindness

Snow effects on radar:
  - Falling snow: minimal effect (wavelength >> snowflake size)
  - Snow accumulation: slightly increased ground clutter
  - Snow on radome: ARS548 has built-in heating → maintains operation
```

---

## 8. Airside Adverse Conditions

### 8.1 De-Icing Spray

The most critical airside-specific weather condition. Propylene glycol/water mix at 60-80°C sprayed on aircraft creates dense aerosol that completely blinds LiDAR for 5-15 seconds per application.

```python
class DeicingDetector:
    """Detect de-icing spray event from sensor data.
    
    When detected, automatically switch to radar-primary mode.
    """
    
    def detect_deicing(self, lidar_stats, radar_stats):
        """Detect de-icing spray from sensor statistics.
        
        Signatures:
        1. Sudden LiDAR point count drop (>50% in 1 frame)
        2. High LiDAR return intensity in near field (spray is reflective)
        3. Radar detections remain stable (unaffected)
        4. Known de-icing zone (from turnaround schedule + stand location)
        """
        indicators = {
            'point_drop': lidar_stats['point_count_ratio'] < 0.5,
            'near_field_clutter': lidar_stats['near_5m_intensity'] > 2.0,
            'radar_stable': abs(radar_stats['detection_count_ratio'] - 1.0) < 0.2,
            'in_deicing_zone': self.turnaround_mgr.is_deicing_active()
        }
        
        # 3 of 4 indicators → de-icing detected
        if sum(indicators.values()) >= 3:
            return True, indicators
        return False, indicators
    
    def handle_deicing(self):
        """Switch to radar-primary perception during de-icing."""
        # Reduce LiDAR weight to near-zero
        self.fusion_weights = {'lidar': 0.1, 'radar': 0.9}
        # Lower speed limit
        self.speed_limit = 5.0  # km/h
        # Increase safety margins
        self.safety_margin_multiplier = 2.0
        # Log event for safety record
        self.log_weather_event('deicing_spray', self.fusion_weights)
```

### 8.2 Jet Blast

```
Jet blast effects:
  - Temperature: 150-600°C exhaust creates density gradients in air
  - LiDAR: Refractive index variations cause ±0.5m range errors
  - Radar: Negligible effect (electromagnetic propagation unaffected)
  - Duration: Continuous during engine run, worst during takeoff thrust
  
Jet blast zones (from existing jet blast analysis):
  B737-800: 148m exhaust danger zone
  A320: 140m zone
  A330: 200m+ zone
```

### 8.3 Freezing Conditions

```
Freezing rain/ice:
  LiDAR: Lens icing causes progressive blindness. No built-in heating on most units.
    - RoboSense RSHELIOS: No standard heating. $200-500 aftermarket heated enclosure.
    - Time to failure: 5-30 min depending on icing rate
  
  4D Radar: Built-in radome heater standard on ARS548
    - Maintains operation to -40°C
    - 13W total power includes heating
  
Mitigation:
  1. Heated LiDAR enclosures ($200-500 per sensor)
  2. Automated wiper systems ($150-300 per sensor)
  3. Radar provides perception continuity during LiDAR heating cycles
```

---

## 9. 4D Radar Processing Pipeline

### 9.1 Radar Point Cloud Generation

```python
class Radar4DProcessor:
    """Process 4D radar detections for fusion with LiDAR.
    
    Raw radar output: list of detections with (range, azimuth, elevation, doppler, RCS, SNR)
    Output: 3D point cloud with velocity features
    """
    
    def __init__(self, min_snr=10.0, max_range=150.0, accumulation_frames=5):
        self.min_snr = min_snr
        self.max_range = max_range
        self.accumulation_frames = accumulation_frames
        self.history = []
    
    def process(self, raw_detections, ego_velocity):
        """Process raw radar detections into 3D point cloud.
        
        Args:
            raw_detections: list of {range, azimuth, elevation, doppler, rcs, snr}
            ego_velocity: vehicle velocity for Doppler compensation
        """
        # Filter by SNR and range
        valid = [d for d in raw_detections 
                 if d['snr'] > self.min_snr and d['range'] < self.max_range]
        
        # Convert spherical to Cartesian
        points = []
        for d in valid:
            x = d['range'] * np.cos(d['elevation']) * np.cos(d['azimuth'])
            y = d['range'] * np.cos(d['elevation']) * np.sin(d['azimuth'])
            z = d['range'] * np.sin(d['elevation'])
            
            # Compensate ego velocity from Doppler
            doppler_compensated = d['doppler'] - self.project_ego_velocity(
                ego_velocity, d['azimuth'], d['elevation']
            )
            
            points.append([x, y, z, d['rcs'], doppler_compensated, d['snr']])
        
        points = np.array(points) if points else np.empty((0, 6))
        
        # Multi-frame accumulation for density
        self.history.append(points)
        if len(self.history) > self.accumulation_frames:
            self.history.pop(0)
        
        accumulated = np.vstack(self.history) if self.history else points
        
        # Static/dynamic classification from Doppler
        static_mask = np.abs(accumulated[:, 4]) < 0.3  # m/s threshold
        
        return {
            'points': accumulated,
            'static_points': accumulated[static_mask],
            'dynamic_points': accumulated[~static_mask],
            'raw_count': len(raw_detections),
            'valid_count': len(valid),
            'accumulated_count': len(accumulated)
        }
```

### 9.2 Radar BEV Feature Encoding

```python
class RadarPillarEncoder(nn.Module):
    """PointPillars-style encoder for radar point cloud.
    
    Similar to LiDAR pillarization but with radar-specific features:
    - RCS (radar cross-section) instead of intensity
    - Doppler velocity as additional feature
    - Coarser grid (radar spatial resolution is lower)
    """
    
    def __init__(self, in_channels=8, out_channels=64, 
                 voxel_size=(0.4, 0.4), point_cloud_range=(-75, -75, -3, 75, 75, 5)):
        super().__init__()
        self.voxel_size = voxel_size
        self.range = point_cloud_range
        
        # Pillar feature net
        self.pfn = nn.Sequential(
            nn.Linear(in_channels, 64),
            nn.BatchNorm1d(64),
            nn.ReLU(),
            nn.Linear(64, out_channels)
        )
    
    def forward(self, radar_points):
        """Encode radar points into BEV feature map."""
        # Pillarize (2D grid, aggregate points per pillar)
        pillars, coords = self.create_pillars(radar_points)
        
        # Per-pillar features
        pillar_features = self.pfn(pillars)
        pillar_features = pillar_features.max(dim=1)[0]  # Max pooling
        
        # Scatter to BEV grid
        bev = self.scatter_to_bev(pillar_features, coords)
        
        return bev
```

---

## 10. Adaptive Fusion Gating

### 10.1 Weather-Aware Fusion Weights

```python
class AdaptiveFusionGate(nn.Module):
    """Dynamically weight radar vs LiDAR based on weather conditions.
    
    In clear weather: LiDAR dominates (0.85 LiDAR, 0.15 radar)
    In fog/rain: radar weight increases (0.3 LiDAR, 0.7 radar)
    During de-icing: radar primary (0.1 LiDAR, 0.9 radar)
    """
    
    def __init__(self, lidar_channels=256, radar_channels=64, hidden=128):
        super().__init__()
        # Weather estimator from both sensor statistics
        self.weather_estimator = nn.Sequential(
            nn.Linear(lidar_channels + radar_channels, hidden),
            nn.ReLU(),
            nn.Linear(hidden, 64),
            nn.ReLU(),
            nn.Linear(64, 2),  # [lidar_weight, radar_weight]
            nn.Softmax(dim=-1)
        )
        
        # Minimum radar weight (safety constraint)
        self.min_radar_weight = 0.10
        # Maximum radar weight (LiDAR still has better geometry)
        self.max_radar_weight = 0.90
    
    def forward(self, lidar_bev, radar_bev):
        """Compute adaptive fusion weights.
        
        Uses global statistics of both BEV features to estimate 
        weather degradation and set appropriate weights.
        """
        # Global average pooling for statistics
        lidar_stats = lidar_bev.mean(dim=(2, 3))  # (B, C_l)
        radar_stats = radar_bev.mean(dim=(2, 3))  # (B, C_r)
        
        combined = torch.cat([lidar_stats, radar_stats], dim=1)
        weights = self.weather_estimator(combined)  # (B, 2)
        
        # Clamp for safety
        lidar_w = weights[:, 0:1].clamp(1 - self.max_radar_weight, 1 - self.min_radar_weight)
        radar_w = 1 - lidar_w
        
        # Apply weights (broadcast over spatial dimensions)
        lidar_w = lidar_w.unsqueeze(-1).unsqueeze(-1)
        radar_w = radar_w.unsqueeze(-1).unsqueeze(-1)
        
        fused = lidar_w * lidar_bev + radar_w * F.interpolate(radar_bev, lidar_bev.shape[2:])
        
        return fused, weights
```

### 10.2 Degradation-Triggered Mode Switching

```python
class FusionModeManager:
    """Manage fusion mode transitions based on sensor health."""
    
    class Mode:
        NORMAL = 'normal'           # LiDAR primary, radar augments
        WEATHER_DEGRADED = 'degraded'  # Balanced fusion
        LIDAR_IMPAIRED = 'impaired'  # Radar primary
        EMERGENCY = 'emergency'      # Radar only + stop
    
    def __init__(self):
        self.current_mode = self.Mode.NORMAL
        self.lidar_health = 1.0
        self.radar_health = 1.0
    
    def update(self, lidar_stats, radar_stats):
        """Update fusion mode based on sensor statistics."""
        # LiDAR health: point count ratio vs expected
        self.lidar_health = min(
            lidar_stats['point_count'] / lidar_stats['expected_count'],
            1.0
        )
        
        # Radar health: detection stability
        self.radar_health = min(
            radar_stats['detection_stability'],
            1.0
        )
        
        # Mode transitions
        if self.lidar_health > 0.7:
            self.current_mode = self.Mode.NORMAL
        elif self.lidar_health > 0.4:
            self.current_mode = self.Mode.WEATHER_DEGRADED
        elif self.radar_health > 0.5:
            self.current_mode = self.Mode.LIDAR_IMPAIRED
        else:
            self.current_mode = self.Mode.EMERGENCY
        
        return self.current_mode, self.get_fusion_config()
    
    def get_fusion_config(self):
        """Get fusion parameters for current mode."""
        configs = {
            self.Mode.NORMAL: {
                'lidar_weight': 0.85, 'radar_weight': 0.15,
                'speed_limit': 25, 'safety_margin': 1.0
            },
            self.Mode.WEATHER_DEGRADED: {
                'lidar_weight': 0.5, 'radar_weight': 0.5,
                'speed_limit': 15, 'safety_margin': 1.5
            },
            self.Mode.LIDAR_IMPAIRED: {
                'lidar_weight': 0.2, 'radar_weight': 0.8,
                'speed_limit': 10, 'safety_margin': 2.0
            },
            self.Mode.EMERGENCY: {
                'lidar_weight': 0.0, 'radar_weight': 1.0,
                'speed_limit': 5, 'safety_margin': 3.0
            }
        }
        return configs[self.current_mode]
```

---

## 11. Orin Deployment and Integration

### 11.1 Compute Budget

| Component | Latency (ms) | Notes |
|-----------|-------------|-------|
| LiDAR PointPillars BEV | 4.5 | Standard pillarization |
| Radar pillar encoding | 1.5 | Simpler (fewer points) |
| BEV fusion (concat+conv) | 1.5 | 2 conv layers |
| Adaptive gate | 0.3 | MLP |
| Detection head | 2.0 | CenterPoint head |
| **Total fused pipeline** | **9.8** | vs 6.84ms LiDAR-only |
| Overhead | +2.96ms | 43% increase for weather robustness |

### 11.2 ROS Integration

```python
class RadarLiDARFusionNode:
    """ROS node for radar-LiDAR fusion perception."""
    
    def __init__(self):
        rospy.init_node('radar_lidar_fusion')
        
        # Synchronized subscribers
        self.lidar_sub = message_filters.Subscriber('/merged_points', PointCloud2)
        self.radar_sub = message_filters.Subscriber('/radar/detections', RadarDetections)
        
        self.sync = message_filters.ApproximateTimeSynchronizer(
            [self.lidar_sub, self.radar_sub],
            queue_size=10,
            slop=0.05  # 50ms sync tolerance
        )
        self.sync.registerCallback(self.fused_callback)
        
        # Components
        self.fusion_engine = AdaptiveRadarLiDARFusion()
        self.mode_manager = FusionModeManager()
        
        # Publishers
        self.det_pub = rospy.Publisher('/fused_detections', DetectionArray, queue_size=1)
        self.mode_pub = rospy.Publisher('/fusion_mode', String, queue_size=1)
    
    def fused_callback(self, lidar_msg, radar_msg):
        """Process synchronized radar+LiDAR data."""
        lidar_points = pointcloud2_to_array(lidar_msg)
        radar_detections = parse_radar_msg(radar_msg)
        
        # Update fusion mode
        lidar_stats = self.compute_lidar_stats(lidar_points)
        radar_stats = self.compute_radar_stats(radar_detections)
        mode, config = self.mode_manager.update(lidar_stats, radar_stats)
        
        # Run fusion
        detections = self.fusion_engine.detect(
            lidar_points, radar_detections, config
        )
        
        self.det_pub.publish(to_detection_msg(detections, lidar_msg.header))
        self.mode_pub.publish(String(data=mode))
```

### 11.3 Implementation Roadmap

| Phase | Duration | Deliverable | Cost |
|-------|----------|-------------|------|
| 1. Radar integration | 3 weeks | ARS548 ROS driver, calibration | $10K |
| 2. Late fusion baseline | 2 weeks | Detection-level merging | $5K |
| 3. BEV feature fusion | 3 weeks | Mid-level fusion + training | $15K |
| 4. Adaptive gating | 2 weeks | Weather-aware mode switching | $10K |
| 5. Validation | 2 weeks | Weather chamber + field testing | $15K |
| **Total** | **12 weeks** | **Full radar-LiDAR fusion** | **$55K** |

---

## 12. Key Takeaways

1. **4D radar maintains >95% performance in all weather**: 77 GHz wavelength passes through rain, fog, snow, and de-icing spray with minimal attenuation. LiDAR loses 30-70% in same conditions.

2. **L4DR achieves +20% mAP in dense fog**: Multi-modal Denoising Diffusion uses radar features to clean weather-corrupted LiDAR features — the SOTA for weather-robust fusion (AAAI 2025).

3. **Asymmetric fusion is optimal for reference airside AV stack**: LiDAR-primary (better geometry) with radar augmentation (weather robustness, Doppler velocity). Not equal-weight fusion.

4. **Adaptive gating switches based on weather severity**: Clear weather → 85% LiDAR / 15% radar. Dense fog → 30% LiDAR / 70% radar. De-icing spray → 10% LiDAR / 90% radar.

5. **De-icing spray is the critical airside condition**: 5-15 seconds of near-total LiDAR blindness per aircraft. Radar provides perception continuity — currently impossible without it.

6. **Radar provides direct Doppler velocity**: No multi-frame matching needed. 0.11 m/s resolution enables detection of slow-moving GSE at 1 km/h (0.28 m/s) in a single frame.

7. **Late fusion is simplest, mid-level is best**: Detection merging adds only 0.5ms but limited benefit (+1-2% mAP). BEV feature fusion adds 3ms but +5-8% mAP and much better weather degradation handling.

8. **4D radar accumulation compensates for sparsity**: Single frame: ~300 points. 5-frame accumulation (250ms): ~1500 points. Sufficient for reliable detection of vehicles and large objects.

9. **ARS548 is well-suited for airside**: IP69K (survives high-pressure wash), -40°C to +85°C (tarmac extremes), built-in radome heating (icing), $500-1,500 cost.

10. **Radar cannot replace LiDAR for small object detection**: FOD (<0.1m²), thin barriers, cones — below radar spatial resolution. LiDAR remains essential for these safety-critical detections.

11. **Fusion overhead is modest**: +3ms total latency for full BEV fusion — 9.8ms vs 6.84ms LiDAR-only. Well within 50ms planning cycle.

12. **Jet blast is radar's unique advantage**: Refractive index variations from hot exhaust cause ±0.5m LiDAR range errors. Radar electromagnetic propagation is unaffected by thermal gradients.

13. **Total implementation: $35-55K over 12 weeks**: Hardware ($2-6K for 2-4 ARS548 units) plus software integration. ROI: eliminates weather-related operational shutdowns.

---

## 13. References

1. Xia et al., "L4DR: LiDAR-4DRadar Fusion for Weather-Robust 3D Object Detection," AAAI 2025
2. Zhou et al., "RLNet: Adaptive Fusion of 4D Radar and Lidar for 3D Object Detection," ECCV 2024 Workshop
3. Zheng et al., "RCFusion: Fusing 4-D Radar and Camera with Bird's-Eye View Features," IEEE TIM 2023
4. Nabati & Qi, "CenterFusion: Center-based Radar and Camera Fusion for 3D Object Detection," WACV 2021
5. Lin et al., "RCBEVDet: Radar-camera Fusion in Bird's Eye View for 3D Object Detection," CVPR 2024
6. Continental, "ARS548 4D Imaging Radar Technical Specification," 2024
7. Bijelic et al., "Seeing Through Fog Without Seeing Fog," CVPR 2020
8. Sheeny et al., "RADIATE: A Radar Dataset for Automotive Perception," arXiv 2021
9. Paek et al., "K-Radar: 4D Radar Object Detection for Autonomous Driving in Various Weather Conditions," CVPR 2023
