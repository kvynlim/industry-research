# Online Perception Runtime Monitoring and ODD Boundary Enforcement

## Detecting Silent ML Degradation, Input/Output Anomaly Detection, Cross-Modal Consistency, and Automated Graceful Degradation for Airport Airside Autonomous GSE

**Last updated:** 2026-04-11

---

> **Key Takeaway:** Sensor hardware can be fully functional while perception ML models silently produce unreliable outputs -- domain shift from a new airport, seasonal lighting changes, novel aircraft types, or adversarial natural conditions (jet exhaust shimmer, de-icing spray optical effects, puddle reflections) cause neural network degradation that no hardware diagnostic can detect. This document defines the **perception quality monitoring layer** that sits between hardware sensor health (covered in `sensor-degradation-health-monitoring.md`) and formal temporal logic safety monitors (covered in `runtime-verification-monitoring.md`). The system continuously evaluates whether ML model outputs are trustworthy by monitoring input distribution drift, output consistency patterns, cross-modal agreement, OOD detection scores, calibration stability, and temporal anomaly trends -- all within a **<5ms compute budget on Orin AGX**. A composite Perception Health Score (PHS) drives graduated system responses from normal operation through speed reduction, increased margins, teleop escalation, to safe stop. When combined with the existing Simplex architecture (neural AC + classical Frenet BC), this monitoring layer provides the missing link between "sensors are working" and "perception outputs are correct" -- the gap that no existing airside AV competitor has addressed, and that ISO 3691-4, UL 4600, and the EU AI Act increasingly demand evidence for.

---

## Table of Contents

1. [The Silent Degradation Problem](#1-the-silent-degradation-problem)
2. [Architecture Overview](#2-architecture-overview)
3. [Input Distribution Monitoring](#3-input-distribution-monitoring)
4. [Output Consistency Checking](#4-output-consistency-checking)
5. [Cross-Modal Consistency](#5-cross-modal-consistency)
6. [OOD Detection Integration](#6-ood-detection-integration)
7. [ODD Boundary Monitoring](#7-odd-boundary-monitoring)
8. [Perception Confidence Aggregation](#8-perception-confidence-aggregation)
9. [Calibration Drift Detection](#9-calibration-drift-detection)
10. [Temporal Anomaly Detection](#10-temporal-anomaly-detection)
11. [Response Actions and Graceful Degradation](#11-response-actions-and-graceful-degradation)
12. [Implementation on Orin](#12-implementation-on-orin)
13. [Certification and Safety Case](#13-certification-and-safety-case)
14. [Implementation Roadmap](#14-implementation-roadmap)
15. [Key Takeaways](#15-key-takeaways)
16. [References](#16-references)

---

## 1. The Silent Degradation Problem

### 1.1 Why Perception Fails Without Sensor Faults

Hardware sensor health monitoring (see `hardware/sensors/sensor-degradation-health-monitoring.md`) catches physical degradation: dirty lenses, reduced point counts, intensity drops, angular coverage loss. But perception can fail catastrophically even when every sensor is physically perfect:

| Failure Mode | Sensor Status | ML Model Behavior | Consequence |
|---|---|---|---|
| **Domain shift (new airport)** | All nominal | Trained on Airport A's tarmac texture, Airport B has different reflectivity | Detection confidence drops 15-30%, false negatives on distant objects |
| **Seasonal lighting change** | All nominal | Winter sun angle creates shadow patterns never seen in training | Shadow regions misclassified as obstacles or vice versa |
| **Novel aircraft type** | All nominal | A380 wingspan never in training data | Bounding box regression fails, clearance computed wrong |
| **Jet exhaust shimmer** | All nominal | Thermal distortion warps point cloud geometry at 50-100m behind engines | Ghost detections, split objects, position errors up to 2m |
| **De-icing spray optical effects** | LiDAR sees normal point count | Glycol droplet scatter creates dense false point returns at 5-15m | False obstacle wall, phantom emergency stops |
| **Puddle reflections** | All nominal | Specular reflection creates mirrored point cloud below ground plane | Ground plane estimation fails, false obstacle below vehicle |
| **Model staleness** | All nominal | Distribution drifts over weeks as airport operations change | Gradual mAP decline of 0.5-1% per month undetected |
| **Adversarial weather combination** | All nominal | Low sun + wet tarmac + light fog -- individually tolerable, combined unseen | Compound degradation exceeding any single-condition training |

The critical insight: **sensor health monitoring answers "are my sensors working?" while perception monitoring answers "are my ML models producing trustworthy outputs?"** Both are necessary. Neither is sufficient alone.

### 1.2 The Monitoring Gap

```
Current Aurrigo Safety Stack (with existing documents):

  Hardware Health          Runtime Verification          Safety Architecture
  ┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
  │ sensor-degr. │         │ runtime-verif.   │         │ simplex     │
  │ health-mon.  │         │ monitoring       │         │ architecture│
  ├─────────────┤         ├──────────────────┤         ├─────────────┤
  │ Point count  │         │ STL temporal     │         │ Neural AC   │
  │ Max range    │         │   logic monitors │         │ Classical BC│
  │ Intensity    │         │ OOD detection    │         │ Arbitrator  │
  │ Angular cov. │         │ Shield synthesis │         │             │
  │ Beam uniform.│         │ Geofence         │         │             │
  └──────┬───────┘         └────────┬─────────┘         └──────┬──────┘
         │                          │                          │
         │      ┌───────────────────┤                          │
         │      │   GAP: No ML      │                          │
         │      │   perception      │                          │
         │      │   quality monitor │                          │
         │      └───────────────────┘                          │
         │                                                     │
  "Are sensors     "Is the system                  "Which stack
   physically       violating safety                controls the
   working?"        specifications?"                vehicle?"
```

This document fills the gap: **online perception quality monitoring** that detects when ML models are producing unreliable outputs even though hardware is fine and no explicit safety specification has been violated yet.

### 1.3 Distinction from Related Systems

| System | What It Monitors | Detection Method | This Document |
|---|---|---|---|
| **Sensor health** (`sensor-degradation-health-monitoring.md`) | Physical sensor function | Point count, range, intensity statistics | Assumes sensors are healthy; monitors ML output quality |
| **Runtime verification** (`runtime-verification-monitoring.md`) | Safety specification compliance | STL temporal logic over system state | Catches violations after they occur; this catches degradation before violations |
| **Weather-adaptive ODD** (`weather-adaptive-odd-management.md`) | Environmental conditions | METAR, sensor feeds, weather classification | Monitors environment; this monitors perception response to environment |
| **Uncertainty quantification** (`uncertainty-quantification-calibration.md`) | Per-prediction confidence | MC-Dropout, evidential, conformal | Provides per-detection uncertainty; this aggregates into system-level health |
| **This document** | ML perception quality | Input/output statistics, cross-modal consistency, OOD scores, calibration drift | Continuous trustworthiness assessment of the perception pipeline as a whole |

### 1.4 Threat Model for Perception Degradation

We categorize perception degradation by onset speed and scope:

```
                        Onset Speed
                 Sudden              Gradual
              (<1 second)          (hours/days/weeks)
         ┌──────────────────┬──────────────────────┐
  Local  │ Jet exhaust       │ Seasonal lighting     │
  (one   │ De-icing spray    │ Tarmac re-surfacing   │
  sensor │ Puddle reflection │ Sensor aging          │
  or     │ Bird strike       │ Calibration drift     │
  zone)  │ Sun glare         │ Vegetation growth     │
         ├──────────────────┼──────────────────────┤
  Global │ Fog onset          │ Distribution drift    │
  (all   │ Heavy rain burst   │ Model staleness       │
  percep.│ Power brownout     │ New fleet GSE types   │
  )      │ GPU thermal throt. │ Airport layout change │
         └──────────────────┴──────────────────────┘
```

Each quadrant requires different monitoring strategies:
- **Sudden + Local**: Per-frame cross-modal checks, spatial anomaly detection
- **Sudden + Global**: Input distribution monitoring, ODD state machine
- **Gradual + Local**: Calibration drift detection, per-sensor trend analysis
- **Gradual + Global**: Temporal anomaly detection (CUSUM/EWMA), fleet comparison

---

## 2. Architecture Overview

### 2.1 Monitoring Pipeline

```
                          Perception Pipeline (existing)
┌──────────────────────────────────────────────────────────────────┐
│  LiDAR Points ──► PointPillars ──► CenterPoint ──► Detections   │
│       │                 │                               │        │
│       │          Backbone Features                      │        │
│       │             (BEV grid)                          │        │
│       │                 │                               │        │
└───────┼─────────────────┼───────────────────────────────┼────────┘
        │                 │                               │
        ▼                 ▼                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                PERCEPTION MONITORING LAYER                       │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐   │
│  │   INPUT      │  │  FEATURE     │  │   OUTPUT              │   │
│  │   MONITORS   │  │  MONITORS    │  │   MONITORS            │   │
│  ├─────────────┤  ├──────────────┤  ├───────────────────────┤   │
│  │ Point density│  │ BEV stats    │  │ Detection count CUSUM │   │
│  │ Intensity    │  │ Mahalanobis  │  │ Bbox size EWMA        │   │
│  │ Spatial cov. │  │ Energy score │  │ Class distribution    │   │
│  │ Ground plane │  │ Feature norm │  │ Confidence calibration│   │
│  └──────┬──────┘  └──────┬───────┘  │ Track consistency     │   │
│         │                │          └───────────┬───────────┘   │
│         │                │                      │               │
│  ┌──────┴──────────────┴────────────────────┴───────────────┐  │
│  │              CROSS-MODAL CONSISTENCY                       │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  LiDAR vs Radar detection agreement                       │  │
│  │  Multi-LiDAR overlap consistency                          │  │
│  │  GTSAM innovation sequence monitoring                     │  │
│  │  Tracking prediction vs observation residuals             │  │
│  └──────────────────────────┬────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────┴──────────────────────────────┐   │
│  │            TEMPORAL ANOMALY DETECTION                     │   │
│  ├───────────────────────────────────────────────────────────┤   │
│  │  CUSUM on per-minute statistics                           │   │
│  │  EWMA on per-hour trends                                 │   │
│  │  Calibration drift (multi-LiDAR mutual information)      │   │
│  └──────────────────────────┬────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────┴──────────────────────────────┐   │
│  │         PERCEPTION HEALTH SCORE (PHS)                     │   │
│  │         Bayesian fusion of all monitor outputs            │   │
│  │         PHS ∈ [0, 1]                                      │   │
│  └──────────────────────────┬────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────┴──────────────────────────────┐   │
│  │           ODD BOUNDARY ENFORCEMENT                        │   │
│  │           State machine: NORMAL → DEGRADED → ...          │   │
│  └──────────────────────────┬────────────────────────────────┘  │
└─────────────────────────────┼────────────────────────────────────┘
                              │
                              ▼
                     Response Actions
              (speed, margins, mode, teleop, stop)
```

### 2.2 Compute Budget Allocation

Total budget: **<5ms per perception cycle** (10 Hz = 100ms cycle, 5% allocated to monitoring).

| Monitor Category | Budget | Runs On | Frequency |
|---|---|---|---|
| Input distribution monitors | 0.5 ms | GPU (piggyback on perception) | Every frame |
| Feature-space OOD | 0.8 ms | GPU (uses existing backbone features) | Every frame |
| Output consistency (CUSUM/EWMA) | 0.3 ms | CPU | Every frame |
| Cross-modal consistency | 0.8 ms | CPU | Every frame |
| Calibration drift | 0.2 ms | CPU | Every 10th frame (1 Hz) |
| Temporal anomaly (long-term) | 0.1 ms | CPU | Every 60th frame (~0.17 Hz) |
| PHS aggregation + ODD state machine | 0.3 ms | CPU | Every frame |
| **Total** | **3.0 ms typical, 4.2 ms worst-case** | Mixed | |

This leaves 1-2ms headroom within the 5ms budget for future monitors.

### 2.3 ROS Node Architecture

```
                                  ┌──────────────────────────┐
                                  │  /perception_monitor     │
                                  │  (C++ nodelet, 10 Hz)    │
                                  ├──────────────────────────┤
  Subscribes:                     │                          │  Publishes:
  /rslidar/points_* ────────────►│  Input monitors          │───► /monitor/input_health
  /perception/backbone_features ─►│  Feature OOD             │───► /monitor/ood_score
  /perception/detections ────────►│  Output consistency      │───► /monitor/output_health
  /radar/detections ─────────────►│  Cross-modal checks      │───► /monitor/cross_modal
  /gtsam/innovation ─────────────►│  Calibration drift       │───► /monitor/calibration
  /odom/fused ───────────────────►│  Temporal analysis        │───► /monitor/temporal_health
                                  │                          │
                                  │  PHS aggregation ────────│───► /monitor/perception_health
                                  │  ODD state machine ──────│───► /monitor/odd_state
                                  │                          │───► /monitor/response_action
                                  └──────────────────────────┘
                                            │
                                            ▼
                                  ┌──────────────────────────┐
                                  │  /safety_monitor/        │
                                  │  (Existing arbitrator    │
                                  │   from Simplex arch.)    │
                                  └──────────────────────────┘
```

The perception monitor runs as a **C++ nodelet** in the same process as the perception pipeline to access backbone features at zero serialization cost. The nodelet publishes diagnostic topics at 10 Hz and a latched `/monitor/odd_state` topic for the Simplex arbitrator.

---

## 3. Input Distribution Monitoring

### 3.1 Rationale

The simplest and most robust way to detect perception degradation is to check whether the model's input looks like what it was trained on. If the input distribution has shifted beyond what the model has seen, the outputs are unreliable regardless of confidence scores. Input monitoring catches problems that output monitoring cannot: a model may produce confident but wrong predictions on OOD inputs.

### 3.2 Point Cloud Statistical Monitors

For each incoming LiDAR frame (aggregated across 4-8 RoboSense sensors), we compute lightweight statistics and compare against reference distributions established during commissioning/validation.

**Monitor 1: Point Density Histogram**

Bin the aggregated point cloud into a 2D BEV grid and compute the density histogram. Compare against the reference via KL divergence.

```cpp
// point_density_monitor.hpp
#pragma once
#include <array>
#include <cmath>
#include <vector>

struct PointDensityMonitor {
    // BEV grid: 200m x 200m at 2m resolution = 100x100 = 10,000 bins
    static constexpr int GRID_SIZE = 100;
    static constexpr float CELL_SIZE = 2.0f;  // meters
    static constexpr float GRID_ORIGIN = -100.0f;  // meters from ego
    static constexpr int NUM_BINS = GRID_SIZE * GRID_SIZE;
    
    // Reference distribution (set during commissioning)
    std::array<float, NUM_BINS> ref_density{};
    float ref_total_points = 0.0f;
    
    // Current frame statistics
    std::array<int, NUM_BINS> current_counts{};
    int current_total = 0;
    
    // Smoothed KL divergence
    float kl_ewma = 0.0f;
    static constexpr float EWMA_ALPHA = 0.05f;  // ~20 frame smoothing
    
    // Thresholds (calibrated during commissioning)
    float kl_warn_threshold = 0.15f;   // DEGRADED
    float kl_alert_threshold = 0.35f;  // RESTRICTED
    float kl_critical_threshold = 0.60f;  // SUSPENDED
    
    void set_reference(const std::array<float, NUM_BINS>& ref, float total) {
        ref_density = ref;
        ref_total_points = total;
    }
    
    void reset_frame() {
        current_counts.fill(0);
        current_total = 0;
    }
    
    void add_point(float x, float y) {
        int gx = static_cast<int>((x - GRID_ORIGIN) / CELL_SIZE);
        int gy = static_cast<int>((y - GRID_ORIGIN) / CELL_SIZE);
        if (gx >= 0 && gx < GRID_SIZE && gy >= 0 && gy < GRID_SIZE) {
            current_counts[gy * GRID_SIZE + gx]++;
            current_total++;
        }
    }
    
    // Compute symmetrized KL divergence between current and reference
    float compute_kl_divergence() {
        if (current_total == 0 || ref_total_points == 0.0f) return 1.0f;
        
        float kl = 0.0f;
        float inv_current = 1.0f / static_cast<float>(current_total);
        float inv_ref = 1.0f / ref_total_points;
        
        for (int i = 0; i < NUM_BINS; i++) {
            // Add Laplace smoothing to avoid log(0)
            float p = static_cast<float>(current_counts[i]) * inv_current + 1e-7f;
            float q = ref_density[i] * inv_ref + 1e-7f;
            
            // Symmetrized KL: 0.5 * (KL(P||Q) + KL(Q||P))
            kl += 0.5f * (p * std::log(p / q) + q * std::log(q / p));
        }
        
        // Update EWMA
        kl_ewma = EWMA_ALPHA * kl + (1.0f - EWMA_ALPHA) * kl_ewma;
        
        return kl_ewma;
    }
    
    enum class Status { NORMAL, DEGRADED, RESTRICTED, SUSPENDED };
    
    Status get_status() const {
        if (kl_ewma >= kl_critical_threshold) return Status::SUSPENDED;
        if (kl_ewma >= kl_alert_threshold) return Status::RESTRICTED;
        if (kl_ewma >= kl_warn_threshold) return Status::DEGRADED;
        return Status::NORMAL;
    }
};
```

**Computational cost:** The BEV binning piggybacks on existing PointPillars voxelization (already iterates over all points). The KL divergence over 10,000 bins costs ~0.05ms on a single ARM core.

**Monitor 2: Intensity Distribution**

LiDAR intensity changes with surface wetness, contamination, and atmospheric conditions. Track the intensity histogram and detect shifts.

```cpp
struct IntensityDistMonitor {
    // 256-bin intensity histogram (RoboSense reports 0-255)
    static constexpr int NUM_BINS = 256;
    std::array<int, NUM_BINS> current_hist{};
    std::array<float, NUM_BINS> ref_hist{};
    int frame_count = 0;
    
    // MMD (Maximum Mean Discrepancy) with RBF kernel
    // More robust than KL for multimodal distributions
    float compute_mmd_approx() {
        // Linear-time MMD approximation using histogram comparison
        // Wasserstein-1 distance as computationally cheaper alternative
        float cdf_current = 0.0f, cdf_ref = 0.0f;
        float wasserstein = 0.0f;
        float total_current = 0.0f;
        
        for (int i = 0; i < NUM_BINS; i++) {
            total_current += current_hist[i];
        }
        if (total_current < 100) return 1.0f;  // Too few points
        
        float inv_total = 1.0f / total_current;
        for (int i = 0; i < NUM_BINS; i++) {
            cdf_current += current_hist[i] * inv_total;
            cdf_ref += ref_hist[i];
            wasserstein += std::abs(cdf_current - cdf_ref);
        }
        return wasserstein / NUM_BINS;
    }
};
```

**Monitor 3: Spatial Coverage Map**

Track which angular sectors have sufficient point density. Detects partial blockage, sensor misalignment, or environmental blind spots (e.g., rain reducing range in specific directions).

```cpp
struct SpatialCoverageMonitor {
    // 36 azimuth sectors x 8 range rings
    static constexpr int NUM_AZIMUTH = 36;  // 10 degrees each
    static constexpr int NUM_RANGE = 8;     // 0-10, 10-20, ..., 60-70, 70+ meters
    static constexpr int NUM_CELLS = NUM_AZIMUTH * NUM_RANGE;
    
    std::array<int, NUM_CELLS> current_counts{};
    std::array<float, NUM_CELLS> ref_fill_ratio{};  // Expected fill per cell
    
    float coverage_score() {
        // Fraction of cells that have at least 50% of expected points
        int sufficient = 0;
        for (int i = 0; i < NUM_CELLS; i++) {
            float expected = ref_fill_ratio[i] * 100.0f;  // Normalized
            if (expected < 5.0f) continue;  // Skip cells with few expected points
            if (current_counts[i] >= 0.5f * expected) sufficient++;
        }
        int active_cells = 0;
        for (int i = 0; i < NUM_CELLS; i++) {
            if (ref_fill_ratio[i] * 100.0f >= 5.0f) active_cells++;
        }
        return (active_cells > 0) ? 
            static_cast<float>(sufficient) / active_cells : 0.0f;
    }
};
```

### 3.3 BEV Feature Statistics

After the PointPillars backbone produces BEV features (typically a (C, H, W) tensor, e.g., 64 channels x 200 x 200), we compute lightweight statistics from the feature map. This is near-zero cost because the features are already in GPU memory.

```python
# bev_feature_monitor.py -- runs as CUDA kernel alongside perception
import torch

class BEVFeatureMonitor:
    """Monitor backbone BEV feature statistics for distribution shift."""
    
    def __init__(self, num_channels=64, ewma_alpha=0.02):
        self.alpha = ewma_alpha
        self.C = num_channels
        
        # Reference statistics (set during commissioning)
        self.ref_mean = None      # (C,)
        self.ref_var = None       # (C,)
        self.ref_skew = None      # (C,)
        self.ref_kurt = None      # (C,)
        self.ref_l2_norm = None   # scalar
        
        # Running EWMA of current statistics
        self.ewma_mean = None
        self.ewma_var = None
        
    def set_reference(self, mean, var, skew, kurt, l2_norm):
        self.ref_mean = mean
        self.ref_var = var
        self.ref_skew = skew
        self.ref_kurt = kurt
        self.ref_l2_norm = l2_norm
        self.ewma_mean = mean.clone()
        self.ewma_var = var.clone()
        
    @torch.no_grad()
    def update(self, bev_features: torch.Tensor) -> dict:
        """Compute feature statistics from BEV tensor.
        
        Args:
            bev_features: (C, H, W) BEV feature map from backbone
            
        Returns:
            dict with anomaly scores
        """
        C, H, W = bev_features.shape
        flat = bev_features.view(C, -1)  # (C, H*W)
        
        # Per-channel statistics -- all computed in single pass
        current_mean = flat.mean(dim=1)          # (C,)
        current_var = flat.var(dim=1)             # (C,)
        current_l2 = flat.norm(dim=1).mean()      # scalar
        
        # Standardized Mahalanobis-like distance from reference
        if self.ref_var is not None:
            mean_shift = ((current_mean - self.ref_mean) ** 2 / 
                         (self.ref_var + 1e-8)).mean().item()
            var_ratio = (current_var / (self.ref_var + 1e-8))
            var_shift = ((var_ratio - 1.0) ** 2).mean().item()
            l2_shift = abs(current_l2.item() - self.ref_l2_norm.item()) / \
                      (self.ref_l2_norm.item() + 1e-8)
        else:
            mean_shift = 0.0
            var_shift = 0.0
            l2_shift = 0.0
        
        # Update EWMA
        if self.ewma_mean is not None:
            self.ewma_mean = self.alpha * current_mean + \
                           (1 - self.alpha) * self.ewma_mean
            self.ewma_var = self.alpha * current_var + \
                          (1 - self.alpha) * self.ewma_var
        
        # Composite feature anomaly score (0 = normal, 1 = severely anomalous)
        feature_anomaly = min(1.0, 
            0.4 * sigmoid_scale(mean_shift, center=2.0, steepness=1.5) +
            0.3 * sigmoid_scale(var_shift, center=1.5, steepness=2.0) +
            0.3 * sigmoid_scale(l2_shift, center=0.5, steepness=3.0)
        )
        
        return {
            'mean_shift': mean_shift,
            'var_shift': var_shift,
            'l2_shift': l2_shift,
            'feature_anomaly_score': feature_anomaly,
        }

def sigmoid_scale(x, center=1.0, steepness=2.0):
    """Map [0, inf) to [0, 1) with configurable center and steepness."""
    return 1.0 / (1.0 + (-steepness * (x - center)).__exp__() if isinstance(x, float) 
                  else torch.exp(-steepness * (x - center)))
```

**Cost:** ~0.2ms on Orin GPU (fused kernel), executed in the same CUDA stream as the backbone immediately after feature extraction. Zero additional data transfer.

### 3.4 Reference Distribution Establishment

Reference distributions are established during commissioning at each airport:

1. **Collection phase** (first 2 weeks of supervised operation): Record input statistics under nominal conditions across all times of day, representative weather conditions
2. **Stratification**: Separate references for day/night, dry/wet, summer/winter
3. **Percentile-based thresholds**: Set warning at 95th percentile of observed KL/MMD during commissioning, alert at 99th, critical at 99.9th
4. **Fleet sharing**: Upload reference distributions to cloud; new airports bootstrap from most-similar existing airport, then refine locally

```python
# reference_calibration.py -- run offline after commissioning
import numpy as np
from scipy.stats import percentileofscore

def calibrate_thresholds(kl_values: np.ndarray, 
                          conditions: np.ndarray) -> dict:
    """Calibrate monitor thresholds from commissioning data.
    
    Args:
        kl_values: (N,) KL divergence values from N commissioning frames
        conditions: (N,) condition labels ('day_dry', 'night_wet', etc.)
    
    Returns:
        Per-condition threshold dictionary
    """
    thresholds = {}
    for condition in np.unique(conditions):
        mask = conditions == condition
        values = kl_values[mask]
        
        thresholds[condition] = {
            'warn': float(np.percentile(values, 95)),
            'alert': float(np.percentile(values, 99)),
            'critical': float(np.percentile(values, 99.9)),
            'n_samples': int(mask.sum()),
        }
    
    return thresholds
```

---

## 4. Output Consistency Checking

### 4.1 Rationale

Even without ground truth, perception outputs exhibit statistical regularity. A model operating correctly on an airport apron produces a stable number of detections per frame, consistent bounding box sizes for known object types, stable class distributions, and smooth tracking trajectories. Deviations from these patterns -- sudden drops in detection count, anomalous bounding box sizes, class distribution shifts -- indicate potential model degradation.

### 4.2 CUSUM Detector for Detection Count

The Cumulative Sum (CUSUM) algorithm detects small persistent shifts in a signal's mean. It is more sensitive than simple thresholding and has well-characterized statistical properties.

```cpp
// cusum_monitor.hpp
#pragma once
#include <algorithm>
#include <cmath>

class CUSUMMonitor {
public:
    // Parameters
    float target_mean;    // Expected value (from commissioning)
    float sigma;          // Expected standard deviation
    float k;              // Allowance parameter (slack, typically 0.5*sigma)
    float h;              // Decision threshold (typically 4-5*sigma)
    
    // State
    float s_high = 0.0f;  // Upper CUSUM (detects increase)
    float s_low = 0.0f;   // Lower CUSUM (detects decrease)
    bool alarm_high = false;
    bool alarm_low = false;
    int frames_since_alarm = 0;
    
    CUSUMMonitor(float mean, float std, float allowance_factor = 0.5f,
                 float threshold_factor = 4.0f)
        : target_mean(mean), sigma(std),
          k(allowance_factor * std),
          h(threshold_factor * std) {}
    
    struct Result {
        bool alarm;
        bool direction_high;  // true = increase, false = decrease
        float cusum_high;
        float cusum_low;
        float deviation;      // How far from target (in sigma units)
    };
    
    Result update(float observation) {
        float deviation = (observation - target_mean) / sigma;
        
        // Upper CUSUM: detects shift upward (e.g., spike in detections = ghosts)
        s_high = std::max(0.0f, s_high + (observation - target_mean) - k);
        
        // Lower CUSUM: detects shift downward (e.g., drop = missed objects)
        s_low = std::max(0.0f, s_low - (observation - target_mean) - k);
        
        alarm_high = (s_high > h);
        alarm_low = (s_low > h);
        
        if (alarm_high || alarm_low) {
            frames_since_alarm = 0;
        } else {
            frames_since_alarm++;
        }
        
        return {
            alarm_high || alarm_low,
            alarm_high,
            s_high,
            s_low,
            deviation
        };
    }
    
    void reset() {
        s_high = 0.0f;
        s_low = 0.0f;
        alarm_high = false;
        alarm_low = false;
    }
};
```

**Application to detection count:**

```cpp
// detection_count_monitor.cpp
struct DetectionCountMonitor {
    // Separate CUSUM monitors per class
    CUSUMMonitor total_count{35.0f, 8.0f};      // ~35 objects typical on busy apron
    CUSUMMonitor aircraft_count{2.0f, 1.0f};      // 1-3 aircraft at nearby stands
    CUSUMMonitor personnel_count{8.0f, 4.0f};     // Highly variable
    CUSUMMonitor gse_count{12.0f, 5.0f};          // Ground support equipment
    CUSUMMonitor unknown_count{1.0f, 1.5f};       // Should be rare
    
    struct FrameResult {
        bool any_alarm;
        bool detection_drop;    // Most dangerous: missing objects
        bool detection_spike;   // Possible ghosts/false positives
        bool unknown_spike;     // Novel objects appearing
        float worst_deviation;
    };
    
    FrameResult update(int total, int aircraft, int personnel, 
                       int gse, int unknown) {
        auto r_total = total_count.update(static_cast<float>(total));
        auto r_aircraft = aircraft_count.update(static_cast<float>(aircraft));
        auto r_personnel = personnel_count.update(static_cast<float>(personnel));
        auto r_gse = gse_count.update(static_cast<float>(gse));
        auto r_unknown = unknown_count.update(static_cast<float>(unknown));
        
        return {
            r_total.alarm || r_aircraft.alarm || r_personnel.alarm,
            r_total.alarm && !r_total.direction_high,  // Drop in total
            r_total.alarm && r_total.direction_high,    // Spike in total
            r_unknown.alarm && r_unknown.direction_high, // Unknown objects
            std::max({std::abs(r_total.deviation), 
                     std::abs(r_aircraft.deviation),
                     std::abs(r_personnel.deviation)})
        };
    }
};
```

### 4.3 EWMA for Bounding Box Size Distribution

Exponentially Weighted Moving Average (EWMA) tracks gradual shifts in bounding box dimensions. A shrinking average box size may indicate the model is "losing" distant detections. Growing boxes may indicate false merging of nearby objects.

```cpp
// ewma_monitor.hpp
class EWMAMonitor {
public:
    float lambda;         // Smoothing factor (0.05-0.3)
    float target;         // Target value
    float sigma;          // Process standard deviation
    float L;              // Control limit factor (typically 2.5-3.0)
    
    float ewma_value;
    float control_limit;
    bool alarm = false;
    
    EWMAMonitor(float target, float sigma, float lambda = 0.1f, 
                float L = 3.0f)
        : lambda(lambda), target(target), sigma(sigma), L(L),
          ewma_value(target) {
        // EWMA control limits (asymptotic)
        // UCL/LCL = target +/- L * sigma * sqrt(lambda / (2 - lambda))
        control_limit = L * sigma * std::sqrt(lambda / (2.0f - lambda));
    }
    
    bool update(float observation) {
        ewma_value = lambda * observation + (1.0f - lambda) * ewma_value;
        alarm = std::abs(ewma_value - target) > control_limit;
        return alarm;
    }
    
    float deviation_ratio() const {
        return std::abs(ewma_value - target) / control_limit;
    }
};

// Apply to bounding box monitoring
struct BBoxSizeMonitor {
    // Track mean bounding box dimensions per class
    // Aircraft: L~40m, W~35m, H~12m (large variance by type)
    // GSE: L~4m, W~2m, H~2.5m
    // Personnel: L~0.6m, W~0.6m, H~1.7m
    
    EWMAMonitor aircraft_length{40.0f, 15.0f, 0.05f};
    EWMAMonitor gse_length{4.0f, 1.5f, 0.1f};
    EWMAMonitor personnel_height{1.7f, 0.2f, 0.1f};
    
    // Also track confidence score distribution
    EWMAMonitor mean_confidence{0.82f, 0.08f, 0.05f};
    
    bool update(const std::vector<Detection>& detections) {
        // Compute per-class mean dimensions from current frame
        // ... (aggregate by class, compute means, feed to EWMA)
        // Returns true if any EWMA is in alarm state
        return aircraft_length.alarm || gse_length.alarm || 
               personnel_height.alarm || mean_confidence.alarm;
    }
};
```

### 4.4 Class Distribution Anomaly Detection

Track the empirical class distribution across a sliding window and compare against the expected distribution using chi-squared test.

```cpp
struct ClassDistributionMonitor {
    static constexpr int NUM_CLASSES = 10;  // Airside class taxonomy
    // 0: Aircraft, 1: Baggage cart, 2: Belt loader, 3: Catering truck,
    // 4: Fuel truck, 5: Pushback tug, 6: Personnel, 7: Cone/barrier,
    // 8: FOD, 9: Unknown
    
    static constexpr int WINDOW_SIZE = 100;  // 10 seconds at 10 Hz
    
    std::array<std::array<int, NUM_CLASSES>, WINDOW_SIZE> history{};
    int write_idx = 0;
    bool window_full = false;
    
    // Expected class proportions (from commissioning data)
    std::array<float, NUM_CLASSES> expected_proportions = {
        0.05f,   // Aircraft (few but large)
        0.15f,   // Baggage cart
        0.08f,   // Belt loader
        0.05f,   // Catering truck
        0.03f,   // Fuel truck
        0.06f,   // Pushback tug
        0.35f,   // Personnel
        0.15f,   // Cone/barrier
        0.03f,   // FOD
        0.05f    // Unknown
    };
    
    float chi_squared_threshold = 25.0f;  // ~p<0.005 for 9 dof
    
    float compute_chi_squared() {
        if (!window_full) return 0.0f;
        
        // Sum class counts over window
        std::array<float, NUM_CLASSES> observed{};
        float total = 0.0f;
        for (int i = 0; i < WINDOW_SIZE; i++) {
            for (int c = 0; c < NUM_CLASSES; c++) {
                observed[c] += history[i][c];
                total += history[i][c];
            }
        }
        
        if (total < 50.0f) return 0.0f;  // Insufficient data
        
        float chi2 = 0.0f;
        for (int c = 0; c < NUM_CLASSES; c++) {
            float expected = expected_proportions[c] * total;
            if (expected < 1.0f) continue;  // Avoid division by near-zero
            float diff = observed[c] - expected;
            chi2 += (diff * diff) / expected;
        }
        
        return chi2;
    }
};
```

### 4.5 Track Consistency Monitoring

Tracking quality degrades before detection quality -- ID switches, track fragmentation, and ghost tracks are early indicators of perception problems.

```cpp
struct TrackConsistencyMonitor {
    // Track lifecycle statistics over sliding window
    int window_frames = 300;  // 30 seconds
    
    // Per-window counters
    int id_switches = 0;
    int track_births = 0;
    int track_deaths = 0;
    int ghost_tracks = 0;     // Tracks <3 frames then lost
    int total_tracks = 0;
    
    // CUSUM monitors on rates
    CUSUMMonitor id_switch_rate{0.5f, 0.3f};    // Per second
    CUSUMMonitor fragmentation_rate{0.2f, 0.15f}; // Ghost tracks / total
    
    struct TrackHealth {
        float id_switch_score;      // 0 = normal, 1 = severe
        float fragmentation_score;  // 0 = normal, 1 = severe
        float composite;
    };
    
    TrackHealth evaluate() {
        float seconds = window_frames / 10.0f;
        float switch_rate = id_switches / seconds;
        float frag_rate = (total_tracks > 0) ? 
            static_cast<float>(ghost_tracks) / total_tracks : 0.0f;
        
        auto r_switch = id_switch_rate.update(switch_rate);
        auto r_frag = fragmentation_rate.update(frag_rate);
        
        float switch_score = std::min(1.0f, 
            std::abs(r_switch.deviation) / 3.0f);
        float frag_score = std::min(1.0f, 
            std::abs(r_frag.deviation) / 3.0f);
        
        return {
            switch_score,
            frag_score,
            0.6f * switch_score + 0.4f * frag_score
        };
    }
};
```

### 4.6 Occupancy Grid Fill Ratio

For occupancy-based perception (see `technology/perception/realtime-occupancy-grid-mapping.md`), the fill ratio -- fraction of occupied voxels -- should be stable for a given scene type. Sudden changes indicate perception anomalies.

```cpp
struct OccupancyFillMonitor {
    EWMAMonitor near_fill{0.12f, 0.04f, 0.1f};    // 0-20m: ~12% occupied
    EWMAMonitor mid_fill{0.06f, 0.03f, 0.1f};     // 20-50m: ~6% occupied  
    EWMAMonitor far_fill{0.02f, 0.02f, 0.1f};     // 50-100m: ~2% occupied
    
    bool update(float near, float mid, float far) {
        bool a = near_fill.update(near);
        bool b = mid_fill.update(mid);
        bool c = far_fill.update(far);
        return a || b || c;
    }
};
```

---

## 5. Cross-Modal Consistency

### 5.1 Rationale

When two independent perception channels disagree, at least one is wrong. Cross-modal consistency checking uses agreement between sensors/models as a proxy for correctness without requiring ground truth. This is the most powerful perception monitoring technique for multi-sensor vehicles like Aurrigo's fleet.

### 5.2 LiDAR vs Radar Detection Agreement

4D imaging radar (Continental ARS548, see `hardware/sensors/4d-imaging-radar.md`) provides independent object detections. Compare against LiDAR detections.

```cpp
// cross_modal_consistency.hpp
#pragma once
#include <vector>
#include <cmath>

struct Detection3D {
    float x, y, z;
    float length, width, height;
    float confidence;
    int class_id;
    int sensor_source;  // 0=LiDAR, 1=Radar, 2=Camera, 3=Thermal
};

class LidarRadarConsistency {
public:
    // Association parameters
    float max_association_dist = 3.0f;    // meters (generous for radar accuracy)
    float min_confidence = 0.3f;          // Ignore low-confidence detections
    
    struct ConsistencyResult {
        int lidar_only;       // Detections seen by LiDAR but not radar
        int radar_only;       // Detections seen by radar but not LiDAR
        int both;             // Matched detections
        float position_rmse;  // RMSE of matched detection positions
        float agreement_ratio;  // both / (lidar_only + radar_only + both)
        float score;          // 0 = complete disagreement, 1 = perfect agreement
    };
    
    ConsistencyResult compute(
        const std::vector<Detection3D>& lidar_dets,
        const std::vector<Detection3D>& radar_dets
    ) {
        // Greedy nearest-neighbor association (sufficient at 10 Hz)
        std::vector<bool> radar_matched(radar_dets.size(), false);
        int matched = 0;
        int lidar_count = 0;
        float position_error_sum = 0.0f;
        
        for (const auto& ld : lidar_dets) {
            if (ld.confidence < min_confidence) continue;
            lidar_count++;
            
            float best_dist = max_association_dist;
            int best_idx = -1;
            
            for (size_t j = 0; j < radar_dets.size(); j++) {
                if (radar_matched[j]) continue;
                if (radar_dets[j].confidence < min_confidence) continue;
                
                float dx = ld.x - radar_dets[j].x;
                float dy = ld.y - radar_dets[j].y;
                float dist = std::sqrt(dx * dx + dy * dy);
                
                if (dist < best_dist) {
                    best_dist = dist;
                    best_idx = static_cast<int>(j);
                }
            }
            
            if (best_idx >= 0) {
                radar_matched[best_idx] = true;
                matched++;
                position_error_sum += best_dist * best_dist;
            }
        }
        
        int radar_count = 0;
        for (size_t j = 0; j < radar_dets.size(); j++) {
            if (radar_dets[j].confidence >= min_confidence) radar_count++;
        }
        
        int lidar_only = lidar_count - matched;
        int radar_only = radar_count - matched;
        int total = lidar_only + radar_only + matched;
        
        float agreement = (total > 0) ? 
            static_cast<float>(matched) / total : 1.0f;
        float rmse = (matched > 0) ? 
            std::sqrt(position_error_sum / matched) : 0.0f;
        
        // Score: high agreement + low position error = good
        // Weight agreement more heavily (detection-level disagreement is
        // more concerning than position-level disagreement)
        float score = 0.7f * agreement + 
                     0.3f * std::max(0.0f, 1.0f - rmse / max_association_dist);
        
        return {lidar_only, radar_only, matched, rmse, agreement, score};
    }
};
```

### 5.3 Multi-LiDAR Overlap Consistency

With 4-8 RoboSense LiDARs having overlapping fields of view, objects in overlap zones should be detected consistently by both sensors. Disagreement indicates calibration drift or sensor-specific degradation.

```cpp
struct MultiLidarOverlapMonitor {
    // For each LiDAR pair with overlapping FOV, track detection agreement
    // Aurrigo typical: pairs (0,1), (1,2), (2,3), (3,0) for 4 front-facing
    static constexpr int MAX_PAIRS = 12;  // C(8,2) worst case, typically 4-6 active
    
    struct PairResult {
        int lidar_a_id;
        int lidar_b_id;
        float agreement_ratio;
        float position_consistency;  // Std dev of matched positions
    };
    
    // Per-pair EWMA monitors
    std::array<EWMAMonitor, MAX_PAIRS> pair_agreement;
    int num_active_pairs = 0;
    
    float worst_pair_score() {
        float worst = 1.0f;
        for (int i = 0; i < num_active_pairs; i++) {
            worst = std::min(worst, 
                1.0f - pair_agreement[i].deviation_ratio());
        }
        return worst;
    }
};
```

### 5.4 GTSAM Innovation Sequence Monitoring

The GTSAM factor graph optimizer (see `technology/localization/mapping-localization.md`) produces innovation sequences -- the difference between predicted and observed measurements. Under nominal conditions, innovations should be zero-mean Gaussian with covariance matching the measurement noise model. Departure from this indicates either localization failure or sensor/perception degradation.

```cpp
struct GTSAMInnovationMonitor {
    // Monitor innovation statistics from GTSAM factor graph
    // Innovations should be zero-mean with known covariance
    
    // Normalized Innovation Squared (NIS) test
    // NIS = innovation^T * S^-1 * innovation, where S = innovation covariance
    // Under nominal conditions, NIS ~ chi-squared(dof)
    
    EWMAMonitor nis_mean{0.0f, 1.0f, 0.1f};  // Should track 0
    CUSUMMonitor nis_cusum{3.0f, 1.5f};  // NIS mean should be ~dof (e.g., 3 for 3D)
    
    // Per-sensor type innovation tracking
    struct SensorInnovation {
        float mean_nis;
        float max_nis;
        int outlier_count;  // NIS > chi2_threshold
        float chi2_threshold;  // 99th percentile of chi2(dof)
    };
    
    SensorInnovation lidar_vgicp{0, 0, 0, 11.34f};  // dof=3, p=0.01
    SensorInnovation imu{0, 0, 0, 16.81f};           // dof=6, p=0.01
    SensorInnovation gps{0, 0, 0, 11.34f};           // dof=3, p=0.01
    SensorInnovation wheel_odom{0, 0, 0, 9.21f};     // dof=2, p=0.01
    
    float localization_health() {
        // Combine sensor innovation health scores
        auto score = [](const SensorInnovation& si) -> float {
            if (si.mean_nis < si.chi2_threshold * 0.5f) return 1.0f;
            if (si.mean_nis < si.chi2_threshold) return 0.7f;
            if (si.mean_nis < si.chi2_threshold * 2.0f) return 0.4f;
            return 0.1f;
        };
        
        return 0.4f * score(lidar_vgicp) + 
               0.2f * score(imu) + 
               0.25f * score(gps) + 
               0.15f * score(wheel_odom);
    }
};
```

### 5.5 Tracking Prediction vs Observation Residuals

The multi-object tracker predicts where objects will be in the next frame based on motion models. Large residuals between predictions and actual observations indicate either perception noise or tracker model mismatch.

```cpp
struct TrackingResidualMonitor {
    // For each active track, compute prediction-observation residual
    // Large residuals = perception noise or tracker degradation
    
    EWMAMonitor mean_residual_xy{0.15f, 0.08f, 0.1f};  // meters
    EWMAMonitor mean_residual_v{0.3f, 0.2f, 0.1f};     // m/s
    CUSUMMonitor large_residual_rate{0.05f, 0.03f};     // Fraction >1m
    
    void update(const std::vector<float>& residuals_xy,
                const std::vector<float>& residuals_v) {
        if (residuals_xy.empty()) return;
        
        float mean_xy = 0.0f, mean_v = 0.0f;
        int large_count = 0;
        
        for (size_t i = 0; i < residuals_xy.size(); i++) {
            mean_xy += residuals_xy[i];
            if (i < residuals_v.size()) mean_v += residuals_v[i];
            if (residuals_xy[i] > 1.0f) large_count++;
        }
        
        mean_xy /= residuals_xy.size();
        if (!residuals_v.empty()) mean_v /= residuals_v.size();
        float large_rate = static_cast<float>(large_count) / residuals_xy.size();
        
        mean_residual_xy.update(mean_xy);
        mean_residual_v.update(mean_v);
        large_residual_rate.update(large_rate);
    }
    
    float health_score() {
        float xy_score = 1.0f - std::min(1.0f, 
            mean_residual_xy.deviation_ratio());
        float rate_score = large_residual_rate.alarm ? 0.3f : 1.0f;
        return 0.6f * xy_score + 0.4f * rate_score;
    }
};
```

### 5.6 Expected Cross-Modal Agreement Rates

Calibrated during commissioning per airport:

| Comparison | Normal Agreement | Degraded Threshold | Restricted Threshold | Notes |
|---|---|---|---|---|
| LiDAR vs Radar (objects >1m) | 75-90% | <65% | <50% | Radar misses small objects normally |
| Multi-LiDAR overlap | 90-98% | <85% | <75% | High agreement expected |
| Track prediction residual (xy) | 0.10-0.20m | >0.35m | >0.60m | Depends on object speed |
| GTSAM NIS (LiDAR VGICP) | 1.5-4.5 | >8.0 | >15.0 | Chi-squared with 3 dof |
| GTSAM NIS (GPS) | 1.0-5.0 | >10.0 | >20.0 | Higher during multipath |
| Occupancy fill stability (near) | +/-2% | >+/-5% | >+/-10% | Per-frame variation |

---

## 6. OOD Detection Integration

### 6.1 Methods for Airside Perception

Three complementary OOD detection methods, each with different strengths (see `technology/perception/uncertainty-quantification-calibration.md` for mathematical foundations):

**Method 1: Energy-based OOD Score**

Uses the logits from the detection head directly. No additional model required.

```python
# energy_ood.py
import torch
import torch.nn.functional as F

class EnergyOODDetector:
    """Energy-based OOD detection (Liu et al., NeurIPS 2020).
    
    Free energy E(x) = -T * log(sum_c exp(f_c(x) / T))
    In-distribution: low energy. OOD: high energy.
    """
    
    def __init__(self, temperature=1.0, in_dist_percentiles=None):
        self.T = temperature
        # Thresholds set from in-distribution calibration data
        self.energy_mean = 0.0
        self.energy_std = 1.0
        if in_dist_percentiles is not None:
            self.energy_95 = in_dist_percentiles['p95']
            self.energy_99 = in_dist_percentiles['p99']
        else:
            self.energy_95 = float('inf')
            self.energy_99 = float('inf')
    
    @torch.no_grad()
    def compute_energy(self, logits: torch.Tensor) -> torch.Tensor:
        """Compute free energy from classification logits.
        
        Args:
            logits: (N, C) classification logits for N detections, C classes
            
        Returns:
            energy: (N,) free energy per detection (lower = more in-distribution)
        """
        return -self.T * torch.logsumexp(logits / self.T, dim=1)
    
    def score_frame(self, logits: torch.Tensor) -> dict:
        """Score entire frame for OOD content."""
        if logits.shape[0] == 0:
            return {'mean_energy': 0.0, 'max_energy': 0.0, 
                    'ood_fraction': 0.0, 'ood_score': 0.0}
        
        energies = self.compute_energy(logits)
        
        mean_e = energies.mean().item()
        max_e = energies.max().item()
        ood_fraction = (energies > self.energy_95).float().mean().item()
        
        # Normalized OOD score: 0 = fully in-distribution, 1 = fully OOD
        normalized = ((mean_e - self.energy_mean) / 
                     (self.energy_std + 1e-8))
        ood_score = min(1.0, max(0.0, normalized / 3.0))  # Clip at 3 sigma
        
        return {
            'mean_energy': mean_e,
            'max_energy': max_e,
            'ood_fraction': ood_fraction,
            'ood_score': ood_score,
        }
```

**Cost:** ~0.1ms (logits already computed by detection head).

**Method 2: Mahalanobis Distance in Feature Space**

Measures how far the current feature representation is from the training distribution in the learned feature space.

```python
# mahalanobis_ood.py
import torch

class MahalanobisOODDetector:
    """Mahalanobis distance OOD detection (Lee et al., NeurIPS 2018).
    
    Compute distance from class-conditional Gaussian fitted to
    penultimate layer features of the trained model.
    """
    
    def __init__(self, num_classes=10, feature_dim=256):
        self.num_classes = num_classes
        self.feature_dim = feature_dim
        
        # Class-conditional means and shared precision matrix
        # Set from training data features
        self.class_means = None   # (C, D) -- C classes, D feature dim
        self.precision = None     # (D, D) -- shared inverse covariance
        
        # Calibration thresholds
        self.threshold_warn = 50.0
        self.threshold_alert = 100.0
        self.threshold_critical = 200.0
    
    def fit(self, features: torch.Tensor, labels: torch.Tensor):
        """Fit class-conditional Gaussians from training features.
        
        Args:
            features: (N, D) penultimate layer features
            labels: (N,) class labels
        """
        self.class_means = torch.zeros(self.num_classes, self.feature_dim)
        covariance = torch.zeros(self.feature_dim, self.feature_dim)
        
        for c in range(self.num_classes):
            mask = labels == c
            if mask.sum() == 0:
                continue
            class_features = features[mask]
            self.class_means[c] = class_features.mean(dim=0)
            centered = class_features - self.class_means[c]
            covariance += centered.T @ centered
        
        covariance /= features.shape[0]
        # Add small ridge for numerical stability
        covariance += 1e-4 * torch.eye(self.feature_dim)
        self.precision = torch.linalg.inv(covariance)
    
    @torch.no_grad()
    def compute_distance(self, features: torch.Tensor) -> torch.Tensor:
        """Compute minimum Mahalanobis distance across all classes.
        
        Args:
            features: (N, D) features for N detections
            
        Returns:
            distances: (N,) minimum Mahalanobis distance per detection
        """
        # (N, C, D) - broadcast subtraction
        diff = features.unsqueeze(1) - self.class_means.unsqueeze(0)
        # (N, C) - Mahalanobis distance per class
        # d = diff^T @ precision @ diff
        mahal = torch.einsum('ncd,de,nce->nc', diff, self.precision, diff)
        # Minimum across classes
        return mahal.min(dim=1).values
    
    def score_frame(self, features: torch.Tensor) -> dict:
        if features.shape[0] == 0:
            return {'mean_mahal': 0.0, 'max_mahal': 0.0, 'ood_score': 0.0}
        
        distances = self.compute_distance(features)
        mean_d = distances.mean().item()
        max_d = distances.max().item()
        
        # Normalize to [0, 1]
        ood_score = min(1.0, mean_d / self.threshold_alert)
        
        return {
            'mean_mahal': mean_d,
            'max_mahal': max_d,
            'ood_score': ood_score,
        }
```

**Cost:** ~0.5ms on Orin GPU for 50 detections with 256-dim features.

**Method 3: Feature Norm as Lightweight Proxy**

The simplest OOD indicator: the L2 norm of backbone features tends to be lower for OOD inputs. Nearly free to compute.

```python
class FeatureNormOOD:
    """L2 feature norm as OOD proxy -- nearly zero cost."""
    
    def __init__(self, ref_mean_norm=12.5, ref_std_norm=2.0):
        self.ref_mean = ref_mean_norm
        self.ref_std = ref_std_norm
    
    @torch.no_grad()
    def score(self, features: torch.Tensor) -> float:
        """Score frame by mean feature norm deviation."""
        norm = features.norm(dim=-1).mean().item()
        z_score = abs(norm - self.ref_mean) / self.ref_std
        return min(1.0, z_score / 3.0)  # 3-sigma → 1.0
```

### 6.2 Threshold Calibration

Critical design decision: how to set OOD thresholds without an OOD validation set.

**Approach 1: Percentile-based (simple, conservative)**

```python
def calibrate_ood_thresholds(in_distribution_scores: np.ndarray) -> dict:
    """Set thresholds from in-distribution scores only.
    
    Logic: if it's more extreme than 95% of in-distribution,
    treat as potentially OOD. Beyond 99.9%, treat as definitely OOD.
    """
    return {
        'novel_but_safe':  float(np.percentile(in_distribution_scores, 95)),
        'likely_ood':      float(np.percentile(in_distribution_scores, 99)),
        'definitely_ood':  float(np.percentile(in_distribution_scores, 99.9)),
    }
```

**Approach 2: Conformal prediction (distribution-free guarantees)**

```python
def conformal_ood_threshold(calibration_scores: np.ndarray, 
                             alpha: float = 0.01) -> float:
    """Set threshold with P(false alarm) <= alpha guarantee.
    
    Conformal prediction: if we observe n calibration scores,
    the (1-alpha)(1+1/n) quantile gives a threshold with
    coverage guarantee.
    """
    n = len(calibration_scores)
    quantile_level = min(1.0, (1.0 - alpha) * (1.0 + 1.0 / n))
    threshold = float(np.quantile(calibration_scores, quantile_level))
    return threshold
```

With 1,000 commissioning frames and alpha=0.01, this gives a threshold where the false alarm rate is guaranteed to be at most 1% regardless of the score distribution.

### 6.3 Distinguishing "Novel but Safe" from "Novel and Dangerous"

Not all OOD inputs are dangerous. A new type of baggage cart never seen in training is OOD but still a standard GSE vehicle. A stray construction vehicle is OOD and potentially dangerous due to unknown dynamics.

```
Decision Matrix for OOD Detections:

                    Localized OOD              Global OOD
                    (one/few detections)        (entire scene shift)
                ┌──────────────────────┬──────────────────────┐
   Low          │ Log + continue       │ Input distribution   │
   severity     │ (new GSE variant,    │ drift. Flag for      │
   (object-     │  new marking)        │ offline review.      │
   level OOD    │ Treat as "unknown    │ Adjust reference.    │
   score        │  obstacle" class     │                      │
   moderate)    │                      │                      │
                ├──────────────────────┼──────────────────────┤
   High         │ Conservative         │ Domain shift or      │
   severity     │ treatment:           │ environmental event. │
   (detection   │ Stop, 5m clearance,  │ Enter DEGRADED mode. │
   with very    │ flag for teleop.     │ Speed reduction.     │
   high OOD     │ Object could be      │ Request human        │
   score)       │ anything.            │ oversight.           │
                └──────────────────────┴──────────────────────┘
```

Implementation: combine per-detection OOD score with spatial extent and temporal persistence.

```cpp
enum class OODCategory {
    IN_DISTRIBUTION,
    NOVEL_BENIGN,        // New object type, tracking normally
    NOVEL_UNCERTAIN,     // New object type, behavior unclear
    OOD_DANGEROUS,       // High OOD + unexpected behavior
    GLOBAL_SHIFT,        // Entire scene is OOD
};

OODCategory classify_ood(float ood_score, float track_stability,
                          float global_input_shift, int frame_persistence) {
    if (ood_score < 0.3f) return OODCategory::IN_DISTRIBUTION;
    
    if (global_input_shift > 0.5f) return OODCategory::GLOBAL_SHIFT;
    
    // Object-level OOD
    if (track_stability > 0.8f && frame_persistence > 30) {
        // OOD but tracks stably -- probably new GSE type
        return OODCategory::NOVEL_BENIGN;
    }
    
    if (ood_score > 0.7f || track_stability < 0.4f) {
        return OODCategory::OOD_DANGEROUS;
    }
    
    return OODCategory::NOVEL_UNCERTAIN;
}
```

---

## 7. ODD Boundary Monitoring

### 7.1 Formal ODD Specification

The ODD (Operational Design Domain) is defined as a machine-readable constraint set. Each parameter has four operating zones with explicit thresholds. This section complements `operations/safety/weather-adaptive-odd-management.md` by focusing on perception-driven ODD assessment rather than environmental weather feeds.

```python
# odd_specification.py
from dataclasses import dataclass, field
from enum import IntEnum
from typing import Dict

class ODDLevel(IntEnum):
    NORMAL = 0       # Full capability
    DEGRADED = 1     # Reduced speed, increased margins
    RESTRICTED = 2   # Minimal operation, teleop standby
    SUSPENDED = 3    # Safe stop required

@dataclass
class ODDParameter:
    """Single ODD parameter with four-level thresholds."""
    name: str
    unit: str
    
    # Thresholds -- direction indicates whether higher or lower is worse
    normal_min: float = float('-inf')
    normal_max: float = float('inf')
    degraded_min: float = float('-inf')
    degraded_max: float = float('inf')
    restricted_min: float = float('-inf')
    restricted_max: float = float('inf')
    # Beyond restricted thresholds = SUSPENDED
    
    # Hysteresis (prevent oscillation at boundaries)
    hysteresis: float = 0.0
    
    # Current smoothed value
    _current: float = 0.0
    _level: ODDLevel = ODDLevel.NORMAL
    
    def evaluate(self, value: float) -> ODDLevel:
        self._current = value
        
        # Determine raw level
        if (value >= self.normal_min and value <= self.normal_max):
            raw_level = ODDLevel.NORMAL
        elif (value >= self.degraded_min and value <= self.degraded_max):
            raw_level = ODDLevel.DEGRADED
        elif (value >= self.restricted_min and value <= self.restricted_max):
            raw_level = ODDLevel.RESTRICTED
        else:
            raw_level = ODDLevel.SUSPENDED
        
        # Apply hysteresis: fast degradation, slow recovery
        if raw_level > self._level:
            # Degrading: immediate transition
            self._level = raw_level
        elif raw_level < self._level:
            # Recovering: require sustained improvement (handled by state machine)
            pass  # State machine handles recovery delay
        
        return self._level


# Complete airside ODD specification
AIRSIDE_ODD_SPEC: Dict[str, ODDParameter] = {
    # === Perception-derived parameters ===
    'lidar_effective_range': ODDParameter(
        name='LiDAR Effective Detection Range',
        unit='meters',
        normal_min=60.0, normal_max=float('inf'),
        degraded_min=40.0, degraded_max=float('inf'),
        restricted_min=20.0, restricted_max=float('inf'),
        hysteresis=5.0,
    ),
    'perception_health_score': ODDParameter(
        name='Perception Health Score (PHS)',
        unit='ratio [0-1]',
        normal_min=0.7, normal_max=1.0,
        degraded_min=0.5, degraded_max=1.0,
        restricted_min=0.3, restricted_max=1.0,
        hysteresis=0.05,
    ),
    'ood_score': ODDParameter(
        name='Global OOD Score',
        unit='ratio [0-1]',
        normal_min=0.0, normal_max=0.3,
        degraded_min=0.0, degraded_max=0.5,
        restricted_min=0.0, restricted_max=0.7,
        hysteresis=0.05,
    ),
    'cross_modal_agreement': ODDParameter(
        name='Cross-Modal Detection Agreement',
        unit='ratio [0-1]',
        normal_min=0.65, normal_max=1.0,
        degraded_min=0.50, degraded_max=1.0,
        restricted_min=0.35, restricted_max=1.0,
        hysteresis=0.05,
    ),
    'detection_count_stability': ODDParameter(
        name='Detection Count CUSUM Status',
        unit='sigma',
        normal_min=0.0, normal_max=2.0,
        degraded_min=0.0, degraded_max=3.5,
        restricted_min=0.0, restricted_max=5.0,
        hysteresis=0.3,
    ),
    
    # === Environment-derived parameters ===
    # (Complement weather-adaptive-odd-management.md)
    'visibility_range': ODDParameter(
        name='Meteorological Visibility',
        unit='meters',
        normal_min=2000.0, normal_max=float('inf'),
        degraded_min=500.0, degraded_max=float('inf'),
        restricted_min=200.0, restricted_max=float('inf'),
        hysteresis=100.0,
    ),
    'precipitation_rate': ODDParameter(
        name='Precipitation Intensity',
        unit='mm/hr',
        normal_min=0.0, normal_max=2.5,
        degraded_min=0.0, degraded_max=7.5,
        restricted_min=0.0, restricted_max=15.0,
        hysteresis=0.5,
    ),
    'wind_speed': ODDParameter(
        name='Surface Wind Speed',
        unit='knots',
        normal_min=0.0, normal_max=20.0,
        degraded_min=0.0, degraded_max=35.0,
        restricted_min=0.0, restricted_max=50.0,
        hysteresis=3.0,
    ),
    'ambient_temperature': ODDParameter(
        name='Ambient Temperature',
        unit='celsius',
        normal_min=-5.0, normal_max=40.0,
        degraded_min=-15.0, degraded_max=48.0,
        restricted_min=-25.0, restricted_max=55.0,
        hysteresis=2.0,
    ),
    
    # === Operational parameters ===
    'traffic_density': ODDParameter(
        name='Proximate Object Count',
        unit='count within 50m',
        normal_min=0.0, normal_max=25.0,
        degraded_min=0.0, degraded_max=40.0,
        restricted_min=0.0, restricted_max=60.0,
        hysteresis=3.0,
    ),
    'calibration_health': ODDParameter(
        name='Multi-LiDAR Calibration Health',
        unit='ratio [0-1]',
        normal_min=0.8, normal_max=1.0,
        degraded_min=0.6, degraded_max=1.0,
        restricted_min=0.4, restricted_max=1.0,
        hysteresis=0.05,
    ),
}
```

### 7.2 ODD State Machine with Hysteresis

```
                    ┌──────────────────────────────────────┐
                    │                                      │
                    ▼                                      │
            ┌──────────────┐  Any param enters DEGRADED    │
            │              │  (immediate)                   │
  ────────► │   NORMAL     │ ─────────────────────┐        │
            │   v_max=25   │                      │        │
            │   margin=1x  │                      ▼        │
            └──────────────┘             ┌──────────────┐  │
                    ▲                    │              │  │
                    │                    │  DEGRADED    │  │
                    │  All params        │  v_max=15    │──┘
                    │  NORMAL for        │  margin=1.5x │  All params NORMAL
                    │  T_recover=30s     │              │  for 30s
                    │                    └──────┬───────┘
                    │                           │
                    │    Any param enters       │ Any param enters
                    │    RESTRICTED             │ RESTRICTED
                    │    (immediate)            │ (immediate)
                    │                           ▼
                    │                   ┌──────────────┐
                    │                   │              │
                    │                   │  RESTRICTED  │
                    │                   │  v_max=8     │
                    │                   │  margin=2.5x │
                    │                   │  teleop req  │
                    │                   └──────┬───────┘
                    │                          │
                    │   All params             │ Any param enters
                    │   ≤DEGRADED              │ SUSPENDED
                    │   for 60s                │ (immediate)
                    │                          ▼
                    │                  ┌──────────────┐
                    │                  │              │
                    │                  │  SUSPENDED   │
                    │                  │  v_max=0     │
                    │                  │  safe stop   │
                    │                  │  maint. req  │
                    │                  └──────┬───────┘
                    │                         │
                    │  All params ≤RESTRICTED  │
                    │  for 120s + human ack    │
                    └─────────────────────────┘
```

**Key design principles:**
- **Fast degradation, slow recovery**: Transition to worse state is immediate; recovery requires sustained good conditions for a hysteresis period
- **Worst-parameter drives state**: The system state is at least as bad as the worst individual parameter
- **SUSPENDED requires human acknowledgment** to recover: prevents automated oscillation in edge conditions
- **Recovery times increase with severity**: DEGRADED→NORMAL: 30s, RESTRICTED→DEGRADED: 60s, SUSPENDED→RESTRICTED: 120s + human ack

```cpp
// odd_state_machine.hpp
#pragma once
#include <chrono>
#include <algorithm>
#include <map>
#include <string>

enum class ODDState { NORMAL, DEGRADED, RESTRICTED, SUSPENDED };

class ODDStateMachine {
public:
    struct Config {
        // Recovery hold times (seconds)
        float degraded_to_normal_hold = 30.0f;
        float restricted_to_degraded_hold = 60.0f;
        float suspended_to_restricted_hold = 120.0f;
        
        // Speed limits per state (km/h)
        float normal_speed = 25.0f;
        float degraded_speed = 15.0f;
        float restricted_speed = 8.0f;
        float suspended_speed = 0.0f;
        
        // Safety margin multipliers
        float normal_margin = 1.0f;
        float degraded_margin = 1.5f;
        float restricted_margin = 2.5f;
    };
    
    ODDStateMachine(Config config = {}) : config_(config) {}
    
    struct StateOutput {
        ODDState state;
        float max_speed_kmh;
        float margin_multiplier;
        bool teleop_requested;
        bool safe_stop_required;
        bool maintenance_required;
        std::string worst_parameter;
        float time_in_state_s;
    };
    
    StateOutput update(
        const std::map<std::string, ODDState>& param_states,
        float dt_seconds,
        bool human_ack_received = false
    ) {
        // Find worst parameter state
        ODDState worst = ODDState::NORMAL;
        std::string worst_param = "none";
        
        for (const auto& [name, state] : param_states) {
            if (static_cast<int>(state) > static_cast<int>(worst)) {
                worst = state;
                worst_param = name;
            }
        }
        
        // State transition logic
        ODDState target = worst;
        
        if (target > current_state_) {
            // Degradation: immediate
            current_state_ = target;
            recovery_timer_ = 0.0f;
            time_in_state_ = 0.0f;
        } else if (target < current_state_) {
            // Recovery: requires sustained improvement
            recovery_timer_ += dt_seconds;
            float required_hold = get_recovery_hold(current_state_);
            
            bool can_recover = true;
            if (current_state_ == ODDState::SUSPENDED) {
                can_recover = human_ack_received;
            }
            
            if (recovery_timer_ >= required_hold && can_recover) {
                // Step down one level (not jump directly to NORMAL)
                current_state_ = static_cast<ODDState>(
                    static_cast<int>(current_state_) - 1);
                recovery_timer_ = 0.0f;
                time_in_state_ = 0.0f;
            }
        } else {
            recovery_timer_ = 0.0f;
        }
        
        time_in_state_ += dt_seconds;
        
        return {
            current_state_,
            get_max_speed(current_state_),
            get_margin(current_state_),
            current_state_ >= ODDState::RESTRICTED,
            current_state_ == ODDState::SUSPENDED,
            current_state_ == ODDState::SUSPENDED && 
                time_in_state_ > 300.0f,  // 5 min suspended = maintenance
            worst_param,
            time_in_state_
        };
    }
    
private:
    Config config_;
    ODDState current_state_ = ODDState::NORMAL;
    float recovery_timer_ = 0.0f;
    float time_in_state_ = 0.0f;
    
    float get_recovery_hold(ODDState state) const {
        switch (state) {
            case ODDState::DEGRADED:  return config_.degraded_to_normal_hold;
            case ODDState::RESTRICTED: return config_.restricted_to_degraded_hold;
            case ODDState::SUSPENDED: return config_.suspended_to_restricted_hold;
            default: return 0.0f;
        }
    }
    
    float get_max_speed(ODDState state) const {
        switch (state) {
            case ODDState::NORMAL:     return config_.normal_speed;
            case ODDState::DEGRADED:   return config_.degraded_speed;
            case ODDState::RESTRICTED: return config_.restricted_speed;
            case ODDState::SUSPENDED:  return config_.suspended_speed;
            default: return 0.0f;
        }
    }
    
    float get_margin(ODDState state) const {
        switch (state) {
            case ODDState::NORMAL:     return config_.normal_margin;
            case ODDState::DEGRADED:   return config_.degraded_margin;
            case ODDState::RESTRICTED: return config_.restricted_margin;
            case ODDState::SUSPENDED:  return config_.restricted_margin;
            default: return config_.restricted_margin;
        }
    }
};
```

### 7.3 LiDAR Effective Range Estimation

A critical perception-derived ODD parameter. The effective detection range is estimated without ground truth by measuring the maximum range at which the point cloud still has sufficient density for detection.

```cpp
struct EffectiveRangeEstimator {
    // Estimate effective LiDAR detection range from point cloud density
    // Method: find the range beyond which point density drops below
    // the minimum required for reliable object detection
    
    static constexpr float MIN_DENSITY_PER_M2 = 2.0f;  // Points/m^2
    static constexpr int NUM_RANGE_BINS = 20;  // 5m bins from 0-100m
    static constexpr float BIN_SIZE = 5.0f;
    
    float estimate(const std::vector<float>& point_ranges) {
        // Bin points by range
        std::array<int, NUM_RANGE_BINS> counts{};
        for (float r : point_ranges) {
            int bin = static_cast<int>(r / BIN_SIZE);
            if (bin >= 0 && bin < NUM_RANGE_BINS) {
                counts[bin]++;
            }
        }
        
        // Find outermost bin with sufficient density
        // Area of ring at range r with width dr = 2*pi*r*dr
        float effective_range = 10.0f;  // Minimum safe range
        for (int i = 0; i < NUM_RANGE_BINS; i++) {
            float r_center = (i + 0.5f) * BIN_SIZE;
            float ring_area = 2.0f * 3.14159f * r_center * BIN_SIZE;
            float density = counts[i] / ring_area;
            
            if (density >= MIN_DENSITY_PER_M2) {
                effective_range = (i + 1) * BIN_SIZE;
            }
        }
        
        return effective_range;
    }
};
```

### 7.4 NOTAM Integration

Active NOTAMs constrain the ODD spatially. See `operations/airside/ground-control-instruction-understanding.md` for NOTAM parsing.

```python
# notam_odd_constraints.py
@dataclass
class NOTAMConstraint:
    """NOTAM-derived ODD spatial constraint."""
    notam_id: str
    zone_polygon: list      # [(lat, lon), ...] or apron-relative coords
    constraint_type: str    # 'CLOSED', 'SPEED_REDUCED', 'CAUTION', 'CONSTRUCTION'
    max_speed_override: float = None  # km/h, None = use ODD state speed
    margin_override: float = None     # multiplier
    effective_from: str = ""
    effective_to: str = ""

def apply_notam_constraints(odd_output: dict, 
                             active_notams: list,
                             vehicle_position: tuple) -> dict:
    """Apply NOTAM constraints on top of perception-derived ODD."""
    for notam in active_notams:
        if point_in_polygon(vehicle_position, notam.zone_polygon):
            if notam.constraint_type == 'CLOSED':
                odd_output['state'] = 'SUSPENDED'
                odd_output['reason'] = f'NOTAM {notam.notam_id}: zone closed'
            elif notam.max_speed_override is not None:
                odd_output['max_speed'] = min(
                    odd_output['max_speed'], notam.max_speed_override)
            if notam.margin_override is not None:
                odd_output['margin_multiplier'] = max(
                    odd_output['margin_multiplier'], notam.margin_override)
    return odd_output
```

---

## 8. Perception Confidence Aggregation

### 8.1 The Perception Health Score (PHS)

The PHS combines all individual monitor outputs into a single score in [0, 1] that drives system behavior. A value of 1.0 indicates full confidence in perception outputs; 0.0 indicates no confidence.

**Design requirements:**
1. Conservative: PHS should decrease when any individual monitor degrades
2. Smooth: No sudden jumps from minor fluctuations
3. Interpretable: Each component's contribution traceable
4. Fast: <0.1ms computation

### 8.2 Bayesian Fusion Architecture

We use a weighted geometric mean formulation that naturally captures the "weakest link" property: if any single monitor reports severe degradation, the overall PHS drops significantly even if other monitors are healthy.

```cpp
// perception_health_score.hpp
#pragma once
#include <cmath>
#include <array>
#include <algorithm>
#include <string>

struct MonitorScore {
    std::string name;
    float score;      // [0, 1] where 1 = healthy
    float weight;     // Importance weight
    float confidence; // How much to trust this monitor [0, 1]
};

class PerceptionHealthScore {
public:
    // Monitor weights (sum to 1.0, calibrated from validation data)
    static constexpr int NUM_MONITORS = 8;
    
    struct Weights {
        float input_distribution  = 0.10f;
        float feature_ood         = 0.15f;
        float output_consistency  = 0.15f;
        float cross_modal         = 0.20f;  // Highest weight: independent check
        float track_consistency   = 0.10f;
        float calibration_health  = 0.10f;
        float localization_health = 0.10f;
        float temporal_trend      = 0.10f;
    };
    
    struct PHSResult {
        float phs;                           // [0, 1] composite score
        float phs_smoothed;                  // EWMA-smoothed PHS
        std::array<float, NUM_MONITORS> component_scores;
        std::array<float, NUM_MONITORS> component_contributions;
        std::string worst_component;
        float worst_score;
    };
    
    PHSResult compute(
        float input_dist_score,      // From Section 3
        float feature_ood_score,     // From Section 6 (inverted: 1 = healthy)
        float output_consist_score,  // From Section 4
        float cross_modal_score,     // From Section 5
        float track_consist_score,   // From Section 4.5
        float calibration_score,     // From Section 9
        float localization_score,    // From Section 5.4
        float temporal_score         // From Section 10
    ) {
        // Invert OOD scores (OOD reports high = bad, PHS uses high = good)
        // All inputs should be in [0, 1] where 1 = healthy
        
        std::array<float, NUM_MONITORS> scores = {
            input_dist_score,
            feature_ood_score,
            output_consist_score,
            cross_modal_score,
            track_consist_score,
            calibration_score,
            localization_score,
            temporal_score,
        };
        
        std::array<float, NUM_MONITORS> weights = {
            weights_.input_distribution,
            weights_.feature_ood,
            weights_.output_consistency,
            weights_.cross_modal,
            weights_.track_consistency,
            weights_.calibration_health,
            weights_.localization_health,
            weights_.temporal_trend,
        };
        
        static const std::array<std::string, NUM_MONITORS> names = {
            "input_distribution",
            "feature_ood",
            "output_consistency",
            "cross_modal",
            "track_consistency",
            "calibration",
            "localization",
            "temporal_trend",
        };
        
        // Weighted geometric mean: PHS = prod(s_i ^ w_i)
        // Equivalent to exp(sum(w_i * log(s_i)))
        // This ensures that any single low score pulls down the overall PHS
        float log_phs = 0.0f;
        float worst = 1.0f;
        int worst_idx = 0;
        std::array<float, NUM_MONITORS> contributions;
        
        for (int i = 0; i < NUM_MONITORS; i++) {
            float s = std::max(0.01f, std::min(1.0f, scores[i]));
            log_phs += weights[i] * std::log(s);
            contributions[i] = weights[i] * std::log(s);
            
            if (s < worst) {
                worst = s;
                worst_idx = i;
            }
        }
        
        float phs = std::exp(log_phs);
        
        // Additional floor: if ANY component is critically low, cap PHS
        // This prevents a single catastrophic failure from being
        // averaged away by many healthy monitors
        if (worst < 0.2f) {
            phs = std::min(phs, 0.3f);  // Floor if any component critical
        }
        
        // EWMA smoothing
        phs_smoothed_ = phs_alpha_ * phs + (1.0f - phs_alpha_) * phs_smoothed_;
        
        return {
            phs,
            phs_smoothed_,
            scores,
            contributions,
            names[worst_idx],
            worst,
        };
    }
    
    // Get system response recommendation based on PHS
    struct ResponseRecommendation {
        float max_speed_kmh;
        float margin_multiplier;
        bool request_teleop;
        bool request_safe_stop;
    };
    
    ResponseRecommendation get_response(float phs_smoothed) const {
        if (phs_smoothed >= 0.7f) {
            return {25.0f, 1.0f, false, false};       // NORMAL
        } else if (phs_smoothed >= 0.5f) {
            // Linear interpolation between NORMAL and DEGRADED
            float t = (0.7f - phs_smoothed) / 0.2f;
            return {
                25.0f - t * 10.0f,   // 25 → 15 km/h
                1.0f + t * 0.5f,     // 1.0 → 1.5x margins
                false, false
            };
        } else if (phs_smoothed >= 0.3f) {
            float t = (0.5f - phs_smoothed) / 0.2f;
            return {
                15.0f - t * 7.0f,    // 15 → 8 km/h
                1.5f + t * 1.0f,     // 1.5 → 2.5x margins
                true, false          // Request teleop
            };
        } else {
            return {0.0f, 2.5f, true, true};  // SAFE STOP
        }
    }

private:
    Weights weights_;
    float phs_smoothed_ = 1.0f;
    float phs_alpha_ = 0.1f;  // EWMA smoothing factor
};
```

### 8.3 PHS Behavior Examples

| Scenario | Input | Feature OOD | Output | Cross-Modal | Calib | Loc. | PHS | Action |
|---|---|---|---|---|---|---|---|---|
| Normal operation | 0.95 | 0.90 | 0.92 | 0.88 | 0.95 | 0.93 | 0.91 | Normal |
| New aircraft type | 0.85 | 0.60 | 0.80 | 0.70 | 0.95 | 0.93 | 0.74 | Normal (edge) |
| De-icing spray nearby | 0.50 | 0.65 | 0.55 | 0.60 | 0.90 | 0.85 | 0.55 | Degraded, slow to 15 |
| Heavy rain onset | 0.40 | 0.50 | 0.45 | 0.45 | 0.80 | 0.70 | 0.41 | Restricted, 8 km/h |
| Domain shift (new airport) | 0.30 | 0.35 | 0.40 | 0.55 | 0.90 | 0.80 | 0.38 | Restricted, teleop |
| Multiple sensor degradation | 0.20 | 0.25 | 0.30 | 0.20 | 0.50 | 0.40 | 0.19 | Safe stop |
| Calibration drift + fog | 0.45 | 0.55 | 0.50 | 0.40 | 0.30 | 0.60 | 0.36 | Restricted |

### 8.4 PHS Logging and Audit Trail

Every PHS computation is logged for post-hoc analysis and certification evidence:

```cpp
struct PHSLogEntry {
    double timestamp;
    float phs_raw;
    float phs_smoothed;
    std::array<float, 8> component_scores;
    std::string worst_component;
    ODDState odd_state;
    float max_speed_commanded;
    float margin_multiplier;
    bool teleop_requested;
    
    // Serialize to compact binary for rosbag
    std::vector<uint8_t> serialize() const;
};
```

At 10 Hz, this produces approximately 1.2 KB/s of monitoring data -- negligible relative to LiDAR data volumes.

---

## 9. Calibration Drift Detection

### 9.1 The Calibration Problem

Multi-LiDAR extrinsic calibration drifts due to thermal expansion, vibration, and mechanical settling (see `hardware/sensors/multi-lidar-extrinsic-calibration.md`). A 0.1 degree error produces 17 cm error at 100m -- enough to cause ghost detections and split objects that degrade perception without triggering sensor health alarms.

### 9.2 Mutual Information Between Overlapping FOVs

For LiDAR pairs with overlapping fields of view, compute the mutual information (MI) of their point clouds in the overlap region. Well-calibrated sensors produce high MI; drifted calibration produces low MI.

```cpp
// calibration_drift_monitor.hpp
struct CalibrationDriftMonitor {
    // For each LiDAR pair with overlap, track mutual information
    struct LidarPair {
        int lidar_a;
        int lidar_b;
        
        // Overlap region in vehicle frame (BEV bounding box)
        float overlap_x_min, overlap_x_max;
        float overlap_y_min, overlap_y_max;
        
        // Reference MI from factory calibration
        float ref_mi;
        
        // EWMA of current MI
        EWMAMonitor mi_monitor;
        
        // Ground plane consistency
        // Well-calibrated sensors agree on ground plane within overlap
        float ref_ground_z_diff;  // Expected difference (~0)
        EWMAMonitor ground_z_monitor;
    };
    
    std::vector<LidarPair> pairs;
    
    // Compute MI via 2D binned histogram
    // Each bin = (height from sensor A, height from sensor B) for
    // points in the overlap region
    float compute_overlap_mi(
        const std::vector<float>& heights_a,  // From LiDAR A
        const std::vector<float>& heights_b   // From LiDAR B (transformed to A frame)
    ) {
        static constexpr int MI_BINS = 20;
        static constexpr float Z_MIN = -2.0f, Z_MAX = 5.0f;
        static constexpr float BIN_SIZE = (Z_MAX - Z_MIN) / MI_BINS;
        
        // Joint histogram
        std::array<std::array<int, MI_BINS>, MI_BINS> joint{};
        int total = 0;
        
        // Simple approach: voxelize overlap region, compare z-values
        // in matching voxels between sensor A and sensor B
        size_t n = std::min(heights_a.size(), heights_b.size());
        for (size_t i = 0; i < n; i++) {
            int ba = static_cast<int>((heights_a[i] - Z_MIN) / BIN_SIZE);
            int bb = static_cast<int>((heights_b[i] - Z_MIN) / BIN_SIZE);
            if (ba >= 0 && ba < MI_BINS && bb >= 0 && bb < MI_BINS) {
                joint[ba][bb]++;
                total++;
            }
        }
        
        if (total < 100) return 0.0f;
        
        // Marginals
        std::array<int, MI_BINS> margin_a{}, margin_b{};
        for (int i = 0; i < MI_BINS; i++) {
            for (int j = 0; j < MI_BINS; j++) {
                margin_a[i] += joint[i][j];
                margin_b[j] += joint[i][j];
            }
        }
        
        // MI = sum p(a,b) * log(p(a,b) / (p(a)*p(b)))
        float mi = 0.0f;
        float inv_total = 1.0f / total;
        for (int i = 0; i < MI_BINS; i++) {
            for (int j = 0; j < MI_BINS; j++) {
                if (joint[i][j] == 0) continue;
                float pab = joint[i][j] * inv_total;
                float pa = margin_a[i] * inv_total;
                float pb = margin_b[j] * inv_total;
                mi += pab * std::log(pab / (pa * pb + 1e-10f) + 1e-10f);
            }
        }
        
        return mi;
    }
    
    struct CalibrationHealth {
        float overall_score;      // [0, 1]
        int degraded_pairs;       // Number of pairs with low MI
        std::string worst_pair;   // "lidar_2_3"
        bool recalibration_needed;
    };
    
    CalibrationHealth evaluate() {
        float min_score = 1.0f;
        int degraded = 0;
        std::string worst = "";
        
        for (auto& pair : pairs) {
            float ratio = pair.mi_monitor.ewma_value / 
                         (pair.ref_mi + 1e-6f);
            float score = std::min(1.0f, ratio);
            
            if (score < min_score) {
                min_score = score;
                worst = "lidar_" + std::to_string(pair.lidar_a) + 
                        "_" + std::to_string(pair.lidar_b);
            }
            if (score < 0.7f) degraded++;
        }
        
        return {
            min_score,
            degraded,
            worst,
            min_score < 0.5f || degraded >= 2
        };
    }
};
```

### 9.3 Ground Plane Consistency

A simpler but effective calibration check: fit a ground plane to each LiDAR's points independently and compare. Well-calibrated sensors produce ground planes that agree within 1-2 cm.

```cpp
struct GroundPlaneConsistency {
    // Fit ground plane z = ax + by + c per LiDAR
    // Compare coefficients across sensors
    
    struct PlaneParams {
        float a, b, c;  // z = ax + by + c
    };
    
    float compare_planes(const PlaneParams& p1, const PlaneParams& p2) {
        // Angular difference between plane normals
        // Normal of z = ax + by + c is (-a, -b, 1) / ||(-a, -b, 1)||
        float dot = (-p1.a * -p2.a + -p1.b * -p2.b + 1.0f);
        float n1 = std::sqrt(p1.a * p1.a + p1.b * p1.b + 1.0f);
        float n2 = std::sqrt(p2.a * p2.a + p2.b * p2.b + 1.0f);
        float cos_angle = dot / (n1 * n2);
        float angle_deg = std::acos(std::min(1.0f, cos_angle)) * 57.2958f;
        
        // Height offset at ego position (x=0, y=0)
        float z_diff = std::abs(p1.c - p2.c);
        
        // Score: good if angle < 0.5 deg and z_diff < 0.02m
        float angle_score = std::max(0.0f, 1.0f - angle_deg / 1.0f);
        float z_score = std::max(0.0f, 1.0f - z_diff / 0.05f);
        
        return 0.5f * angle_score + 0.5f * z_score;
    }
};
```

### 9.4 Static Object Position Consistency

Track known static objects (light poles, buildings, parked aircraft) across multiple LiDARs. If the same static object's position disagrees between sensors, calibration has drifted.

```cpp
struct StaticObjectConsistency {
    // Compare position of static landmarks across LiDARs
    // A static object detected by LiDAR A at (x_a, y_a) and by
    // LiDAR B at (x_b, y_b) should satisfy ||(x_a, y_a) - (x_b, y_b)|| < epsilon
    
    float max_acceptable_error = 0.10f;  // 10 cm for well-calibrated
    float warning_threshold = 0.15f;     // 15 cm = early warning
    float alarm_threshold = 0.25f;       // 25 cm = calibration drift confirmed
    
    EWMAMonitor static_error_monitor{0.05f, 0.03f, 0.05f};
    
    float update(const std::vector<float>& cross_sensor_errors) {
        if (cross_sensor_errors.empty()) return 0.0f;
        
        float mean_error = 0.0f;
        for (float e : cross_sensor_errors) mean_error += e;
        mean_error /= cross_sensor_errors.size();
        
        static_error_monitor.update(mean_error);
        
        // Return health score
        if (mean_error < max_acceptable_error) return 1.0f;
        if (mean_error < warning_threshold) return 0.7f;
        if (mean_error < alarm_threshold) return 0.4f;
        return 0.1f;
    }
};
```

---

## 10. Temporal Anomaly Detection

### 10.1 Rationale

Some perception degradation modes are invisible at the per-frame level but become apparent over longer time horizons: gradual decrease in effective detection range, slowly increasing false positive rate, seasonal performance changes. These require statistical monitoring over minutes, hours, and days.

### 10.2 Multi-Timescale Monitoring Architecture

```
  Per-Frame (10 Hz)          Per-Minute (0.017 Hz)       Per-Hour (0.00028 Hz)
  ┌───────────────┐          ┌───────────────┐           ┌──────────────────┐
  │ Raw monitor   │ ──────►  │ 1-min stats   │ ──────►   │ Hourly trends    │
  │ values        │  buffer  │ (mean, var,   │  buffer   │ (moving avg,     │
  │               │  600     │  min, max,    │  60 min   │  trend slope,    │
  │               │  samples │  percentiles) │  entries  │  change points)  │
  └───────────────┘          └───────┬───────┘           └────────┬─────────┘
                                     │                            │
                                     ▼                            ▼
                              CUSUM on 1-min            Linear regression
                              aggregates                 on hourly values
                              (detects drift             (detects seasonal
                               over minutes)              trends over hours)
```

### 10.3 Minute-Scale Anomaly Detection

```cpp
// temporal_anomaly.hpp
struct MinuteStatsBuffer {
    static constexpr int SAMPLES_PER_MINUTE = 600;  // 10 Hz * 60s
    static constexpr int BUFFER_MINUTES = 60;        // 1 hour of history
    
    struct MinuteStats {
        float mean;
        float variance;
        float min_val;
        float max_val;
        float p10, p50, p90;  // Percentiles
        int count;
    };
    
    std::array<MinuteStats, BUFFER_MINUTES> history{};
    int write_idx = 0;
    int num_valid = 0;
    
    // Running accumulator for current minute
    std::vector<float> current_minute_samples;
    
    void add_sample(float value) {
        current_minute_samples.push_back(value);
        
        if (current_minute_samples.size() >= SAMPLES_PER_MINUTE) {
            flush_minute();
        }
    }
    
    void flush_minute() {
        if (current_minute_samples.empty()) return;
        
        int n = current_minute_samples.size();
        std::sort(current_minute_samples.begin(), 
                  current_minute_samples.end());
        
        MinuteStats stats;
        stats.count = n;
        stats.min_val = current_minute_samples.front();
        stats.max_val = current_minute_samples.back();
        stats.p10 = current_minute_samples[n / 10];
        stats.p50 = current_minute_samples[n / 2];
        stats.p90 = current_minute_samples[n * 9 / 10];
        
        float sum = 0.0f, sum_sq = 0.0f;
        for (float v : current_minute_samples) {
            sum += v;
            sum_sq += v * v;
        }
        stats.mean = sum / n;
        stats.variance = sum_sq / n - stats.mean * stats.mean;
        
        history[write_idx] = stats;
        write_idx = (write_idx + 1) % BUFFER_MINUTES;
        if (num_valid < BUFFER_MINUTES) num_valid++;
        
        current_minute_samples.clear();
    }
};

// CUSUM on minute-level statistics to detect drift
struct TemporalDriftDetector {
    // Track multiple metrics over time
    MinuteStatsBuffer detection_count_buffer;
    MinuteStatsBuffer mean_confidence_buffer;
    MinuteStatsBuffer effective_range_buffer;
    MinuteStatsBuffer cross_modal_agreement_buffer;
    
    // CUSUM on minute means
    CUSUMMonitor detection_count_trend{35.0f, 3.0f, 0.5f, 5.0f};
    CUSUMMonitor confidence_trend{0.82f, 0.04f, 0.5f, 4.0f};
    CUSUMMonitor range_trend{65.0f, 5.0f, 0.5f, 4.0f};
    CUSUMMonitor agreement_trend{0.85f, 0.05f, 0.5f, 4.0f};
    
    struct TemporalHealth {
        float score;           // [0, 1]
        bool drift_detected;
        std::string drift_type;  // Which metric is drifting
        float drift_magnitude;   // In sigma units
    };
    
    TemporalHealth evaluate_minute() {
        bool any_drift = false;
        float worst_deviation = 0.0f;
        std::string worst_metric = "none";
        
        auto check = [&](CUSUMMonitor& mon, MinuteStatsBuffer& buf, 
                        const std::string& name) {
            if (buf.num_valid == 0) return;
            int latest = (buf.write_idx - 1 + buf.BUFFER_MINUTES) % 
                         buf.BUFFER_MINUTES;
            auto result = mon.update(buf.history[latest].mean);
            if (result.alarm) any_drift = true;
            if (std::abs(result.deviation) > worst_deviation) {
                worst_deviation = std::abs(result.deviation);
                worst_metric = name;
            }
        };
        
        check(detection_count_trend, detection_count_buffer, "detection_count");
        check(confidence_trend, mean_confidence_buffer, "confidence");
        check(range_trend, effective_range_buffer, "effective_range");
        check(agreement_trend, cross_modal_agreement_buffer, "cross_modal");
        
        float score = std::max(0.0f, 
            1.0f - worst_deviation / 5.0f);  // 5 sigma → score 0
        
        return {score, any_drift, worst_metric, worst_deviation};
    }
};
```

### 10.4 Hour-Scale Trend Detection

For gradual degradation over hours (model staleness, seasonal drift), fit a linear trend to hourly aggregated statistics.

```cpp
struct HourlyTrendDetector {
    static constexpr int HOURS_TRACKED = 24;
    
    struct HourlyEntry {
        float mean_phs;         // Average PHS over the hour
        float mean_ood_score;
        float mean_range;
        int num_samples;
        double timestamp;
    };
    
    std::array<HourlyEntry, HOURS_TRACKED> hourly_history{};
    int num_hours = 0;
    
    struct TrendResult {
        float phs_slope;        // PHS change per hour (negative = degrading)
        float range_slope;      // Effective range change per hour
        float ood_slope;        // OOD score change per hour (positive = degrading)
        bool significant_trend; // p-value < 0.05 equivalent
    };
    
    TrendResult compute_trends() {
        if (num_hours < 4) {
            return {0.0f, 0.0f, 0.0f, false};
        }
        
        // Simple linear regression: y = a + b*x
        // Using accumulated hours as x (0, 1, 2, ...)
        int n = std::min(num_hours, HOURS_TRACKED);
        float sum_x = 0, sum_y_phs = 0, sum_y_range = 0, sum_y_ood = 0;
        float sum_xx = 0, sum_xy_phs = 0, sum_xy_range = 0, sum_xy_ood = 0;
        
        for (int i = 0; i < n; i++) {
            float x = static_cast<float>(i);
            sum_x += x;
            sum_xx += x * x;
            sum_y_phs += hourly_history[i].mean_phs;
            sum_xy_phs += x * hourly_history[i].mean_phs;
            sum_y_range += hourly_history[i].mean_range;
            sum_xy_range += x * hourly_history[i].mean_range;
            sum_y_ood += hourly_history[i].mean_ood_score;
            sum_xy_ood += x * hourly_history[i].mean_ood_score;
        }
        
        float denom = n * sum_xx - sum_x * sum_x;
        if (std::abs(denom) < 1e-6f) {
            return {0.0f, 0.0f, 0.0f, false};
        }
        
        float slope_phs = (n * sum_xy_phs - sum_x * sum_y_phs) / denom;
        float slope_range = (n * sum_xy_range - sum_x * sum_y_range) / denom;
        float slope_ood = (n * sum_xy_ood - sum_x * sum_y_ood) / denom;
        
        // Significance: slope magnitude > 2 * standard error
        // Simplified: flag if PHS dropping > 0.02/hour or range > 2m/hour
        bool significant = (slope_phs < -0.02f) || 
                          (slope_range < -2.0f) || 
                          (slope_ood > 0.02f);
        
        return {slope_phs, slope_range, slope_ood, significant};
    }
};
```

### 10.5 Fleet Comparison

Compare this vehicle's perception health to the fleet average. If one vehicle degrades while others are fine, the problem is vehicle-specific (sensor, calibration). If all vehicles degrade simultaneously, the problem is environmental or model-global.

```python
# fleet_comparison.py -- runs on fleet manager, not on vehicle
class FleetPerceptionComparator:
    """Compare individual vehicle PHS against fleet baseline."""
    
    def __init__(self, fleet_size: int, z_threshold: float = 2.5):
        self.fleet_size = fleet_size
        self.z_threshold = z_threshold
    
    def identify_outliers(self, 
                          vehicle_phs: dict  # {vehicle_id: float}
                          ) -> dict:
        """Find vehicles whose PHS is significantly below fleet average."""
        values = list(vehicle_phs.values())
        if len(values) < 3:
            return {}
        
        fleet_mean = np.mean(values)
        fleet_std = max(np.std(values), 0.01)
        
        outliers = {}
        for vid, phs in vehicle_phs.items():
            z = (fleet_mean - phs) / fleet_std
            if z > self.z_threshold:
                outliers[vid] = {
                    'phs': phs,
                    'fleet_mean': fleet_mean,
                    'z_score': z,
                    'likely_cause': 'vehicle_specific' if z > 4.0 
                                    else 'possible_vehicle_specific'
                }
        
        # Check if fleet-wide degradation
        if fleet_mean < 0.6:
            for vid in vehicle_phs:
                if vid not in outliers:
                    outliers[vid] = {
                        'phs': vehicle_phs[vid],
                        'fleet_mean': fleet_mean,
                        'z_score': 0.0,
                        'likely_cause': 'fleet_wide_degradation'
                    }
        
        return outliers
```

---

## 11. Response Actions and Graceful Degradation

### 11.1 Response Decision Tree

```
PHS + ODD State ──► Response Decision
│
├── PHS >= 0.7 AND ODD = NORMAL
│   └── Full autonomous operation
│       Speed: 25 km/h, Margins: 1.0x
│       Stack: Neural AC active
│
├── PHS >= 0.5 AND PHS < 0.7 (OR ODD = DEGRADED)
│   └── Degraded autonomous operation
│       Speed: 15-25 km/h (linear interpolation)
│       Margins: 1.0-1.5x
│       Stack: Neural AC with increased CBF margins
│       Logging: Elevated (full rosbag)
│       Fleet: Notify fleet manager
│
├── PHS >= 0.3 AND PHS < 0.5 (OR ODD = RESTRICTED)
│   └── Restricted operation, teleop standby
│       Speed: 8-15 km/h
│       Margins: 1.5-2.5x
│       Stack: Consider switching to Classical BC (Frenet)
│       Teleop: Request operator attention
│       Mission: May abort non-critical missions
│
├── PHS < 0.3 (OR ODD = SUSPENDED)
│   └── Safe stop
│       Speed: Controlled deceleration to 0
│       Stack: Classical BC (Frenet) for stopping maneuver
│       Teleop: Urgent request
│       Maintenance: Auto-generate ticket
│       Fleet: Reassign missions to other vehicles
│
└── SPECIAL CASES (override above):
    │
    ├── Any single monitor score < 0.1
    │   └── Immediate RESTRICTED regardless of PHS
    │
    ├── Calibration health < 0.3
    │   └── Immediate RESTRICTED + schedule recalibration
    │
    ├── Localization health < 0.2 (GTSAM innovation > 20)
    │   └── Immediate safe stop (cannot trust position)
    │
    └── Cross-modal agreement < 0.3 AND declining
        └── Immediate RESTRICTED (fundamental perception failure)
```

### 11.2 Speed Reduction Curve

The speed limit is a continuous function of PHS, not discrete steps:

```cpp
float compute_safe_speed(float phs, float odd_speed_limit, 
                          float current_speed) {
    // Piecewise linear speed curve based on PHS
    float phs_speed;
    if (phs >= 0.8f) {
        phs_speed = 25.0f;  // Full speed
    } else if (phs >= 0.5f) {
        // Linear from 25 to 15 km/h
        phs_speed = 15.0f + (phs - 0.5f) / 0.3f * 10.0f;
    } else if (phs >= 0.3f) {
        // Linear from 15 to 5 km/h
        phs_speed = 5.0f + (phs - 0.3f) / 0.2f * 10.0f;
    } else {
        phs_speed = 0.0f;  // Stop
    }
    
    // Take minimum of PHS-derived speed and ODD speed limit
    float target = std::min(phs_speed, odd_speed_limit);
    
    // Rate limit: max deceleration 2 m/s^2 for comfort
    // (safety stops use higher deceleration)
    float max_decel_per_frame = 2.0f * 0.1f * 3.6f;  // m/s^2 * dt * km/h per m/s
    float limited = std::max(target, current_speed - max_decel_per_frame);
    
    return std::max(0.0f, limited);
}
```

### 11.3 Safety Margin Adjustment

Margins scale inversely with PHS:

```cpp
struct SafetyMarginAdjustment {
    // Base margins from Frenet planner configuration
    float base_lateral_margin = 1.5f;     // meters
    float base_longitudinal_margin = 3.0f; // meters
    float base_aircraft_margin = 5.0f;    // meters (nose/wing)
    float base_personnel_margin = 2.5f;   // meters
    
    struct AdjustedMargins {
        float lateral;
        float longitudinal;
        float aircraft;
        float personnel;
    };
    
    AdjustedMargins compute(float phs, float margin_multiplier) {
        // Multiplier from ODD state machine (1.0, 1.5, 2.5)
        // Additional PHS-proportional scaling
        float phs_factor = 1.0f + (1.0f - phs) * 1.0f;  // 1.0-2.0x
        float total_mult = margin_multiplier * phs_factor;
        
        return {
            base_lateral_margin * total_mult,
            base_longitudinal_margin * total_mult,
            base_aircraft_margin * std::max(total_mult, 1.5f),  // Never reduce aircraft margins
            base_personnel_margin * std::max(total_mult, 1.0f), // Never reduce personnel margins
        };
    }
};
```

### 11.4 Simplex Integration

The perception monitor integrates with the existing Simplex architecture (see `operations/safety/simplex-safety-architecture.md`):

```
Perception Monitor Output
         │
         ▼
┌─────────────────────┐
│   Simplex Decision  │
│   Module            │
├─────────────────────┤
│                     │
│  IF PHS > 0.5:     │───► Neural AC (advanced controller)
│    Use neural stack │     with adjusted speed/margins
│                     │
│  IF PHS 0.3-0.5:   │───► Classical BC (Frenet planner)
│    Switch to Frenet │     as primary controller
│    fallback         │
│                     │
│  IF PHS < 0.3:     │───► Safe stop via BC
│    Emergency stop   │     then request teleop
│                     │
│  IF PHS < 0.1:     │───► Hardware E-stop
│    Complete failure  │     via safety MCU
│                     │
└─────────────────────┘
```

The Frenet planner (420 candidates/cycle, Stanley lateral control) does not use neural networks and thus does not degrade with the same failure modes. It is always available as fallback:

```cpp
// simplex_perception_integration.hpp
enum class ActiveController {
    NEURAL_AC,    // Normal: neural perception + planning
    CLASSICAL_BC, // Fallback: Frenet planner + GTSAM
    SAFE_STOP,    // Controlled stop using BC
    E_STOP,       // Hardware emergency stop
};

ActiveController select_controller(float phs_smoothed, 
                                    ODDState odd_state,
                                    bool localization_healthy) {
    // Localization failure overrides everything
    if (!localization_healthy) return ActiveController::SAFE_STOP;
    
    // ODD SUSPENDED always means stop
    if (odd_state == ODDState::SUSPENDED) return ActiveController::SAFE_STOP;
    
    // PHS-based selection
    if (phs_smoothed >= 0.5f) return ActiveController::NEURAL_AC;
    if (phs_smoothed >= 0.3f) return ActiveController::CLASSICAL_BC;
    if (phs_smoothed >= 0.1f) return ActiveController::SAFE_STOP;
    
    return ActiveController::E_STOP;
}
```

### 11.5 Teleop Escalation Protocol

```
Level 1: Monitoring Notification (PHS < 0.7)
  ├── Fleet dashboard shows degraded vehicle
  ├── Operator sees amber indicator
  └── No immediate action required

Level 2: Attention Request (PHS < 0.5)
  ├── Audible alert to assigned operator
  ├── Vehicle camera feeds displayed prominently
  ├── Vehicle reduces to restricted speed
  └── Operator has 30 seconds to acknowledge

Level 3: Teleop Request (PHS < 0.3 or no ack)
  ├── Vehicle executes safe stop
  ├── Priority teleop connection established
  ├── Operator assumes control
  └── Rosbag flagged for review

Level 4: Fleet Escalation (multiple vehicles degraded)
  ├── Fleet manager alerts shift supervisor
  ├── Environmental condition suspected
  ├── Consider fleet-wide speed reduction
  └── Engage maintenance team
```

---

## 12. Implementation on Orin

### 12.1 Compute Budget Breakdown

Detailed timing analysis on NVIDIA Orin AGX (275 TOPS, 12-core ARM A78AE, Ampere GPU):

| Monitor | Where | Latency | Memory | Frequency | Notes |
|---|---|---|---|---|---|
| Point density KL | CPU (1 core) | 0.05 ms | 80 KB | 10 Hz | BEV grid 100x100 |
| Intensity Wasserstein | CPU (1 core) | 0.02 ms | 2 KB | 10 Hz | 256-bin histogram |
| Spatial coverage | CPU (1 core) | 0.03 ms | 5 KB | 10 Hz | 36x8 grid |
| BEV feature stats | GPU (piggyback) | 0.20 ms | 0 KB extra | 10 Hz | Fused with backbone |
| Energy OOD | GPU (piggyback) | 0.10 ms | 0 KB extra | 10 Hz | Uses existing logits |
| Mahalanobis OOD | GPU | 0.50 ms | 2 MB | 10 Hz | Precision matrix |
| Detection CUSUM | CPU (1 core) | 0.01 ms | 1 KB | 10 Hz | Per-class CUSUM |
| BBox size EWMA | CPU (1 core) | 0.01 ms | 1 KB | 10 Hz | Per-class EWMA |
| Class distribution chi2 | CPU (1 core) | 0.02 ms | 4 KB | 10 Hz | 100-frame window |
| Track consistency | CPU (1 core) | 0.05 ms | 10 KB | 10 Hz | Per-track stats |
| LiDAR-Radar agreement | CPU (1 core) | 0.30 ms | 20 KB | 10 Hz | Nearest-neighbor |
| Multi-LiDAR overlap | CPU (1 core) | 0.20 ms | 15 KB | 10 Hz | Per-pair MI |
| GTSAM innovation | CPU (1 core) | 0.05 ms | 5 KB | 10 Hz | Reuses GTSAM data |
| Track residuals | CPU (1 core) | 0.05 ms | 5 KB | 10 Hz | Per-track |
| Calibration MI | CPU (1 core) | 0.20 ms | 50 KB | 1 Hz | Every 10th frame |
| Ground plane check | CPU (1 core) | 0.10 ms | 10 KB | 1 Hz | Every 10th frame |
| Temporal CUSUM | CPU (1 core) | 0.01 ms | 500 KB | ~0.17 Hz | Minute buffer |
| Hourly trends | CPU (1 core) | 0.01 ms | 5 KB | ~0.0003 Hz | Hourly |
| PHS aggregation | CPU (1 core) | 0.01 ms | 1 KB | 10 Hz | Weighted geometric |
| ODD state machine | CPU (1 core) | 0.01 ms | 1 KB | 10 Hz | State transitions |
| **Total** | **Mixed** | **~2.0 ms typical** | **~700 KB** | | **Within 5ms budget** |

### 12.2 CUDA Stream Organization

```
GPU Execution Timeline (per 100ms cycle):

Stream 0 (Perception):
  ├─ Voxelization (2.0 ms)
  ├─ PointPillars backbone (3.5 ms)  ──► Features available
  ├─ CenterPoint head (1.5 ms)       ──► Detections available
  └─ Total: ~7.0 ms

Stream 1 (Monitoring, concurrent with Stream 0 after features):
  ├─ BEV feature stats (0.2 ms)      [after backbone completes]
  ├─ Energy OOD (0.1 ms)             [after head completes]
  ├─ Mahalanobis OOD (0.5 ms)        [after features available]
  └─ Total: ~0.8 ms (overlapped with perception)

CPU threads (concurrent with GPU):
  Thread 1: Input monitors (point density, intensity, coverage) -- 0.1 ms
  Thread 2: Output monitors (CUSUM, EWMA, chi2, tracks) -- 0.15 ms
  Thread 3: Cross-modal (LiDAR-radar, multi-LiDAR, GTSAM) -- 0.6 ms
  Thread 4: Aggregation + ODD state machine -- 0.05 ms
```

Effective added latency to perception pipeline: **~0.8ms** (GPU monitors overlap with perception; CPU monitors run in parallel).

### 12.3 ROS Nodelet Implementation

```cpp
// perception_monitor_nodelet.cpp
#include <nodelet/nodelet.h>
#include <pluginlib/class_list_macros.h>
#include <ros/ros.h>
#include <sensor_msgs/PointCloud2.h>
#include <std_msgs/Float32.h>
#include <diagnostic_msgs/DiagnosticArray.h>
#include <thread>
#include <mutex>

// Include all monitors defined in previous sections
#include "perception_monitor/point_density_monitor.hpp"
#include "perception_monitor/intensity_dist_monitor.hpp"
#include "perception_monitor/spatial_coverage_monitor.hpp"
#include "perception_monitor/cusum_monitor.hpp"
#include "perception_monitor/ewma_monitor.hpp"
#include "perception_monitor/cross_modal_consistency.hpp"
#include "perception_monitor/calibration_drift_monitor.hpp"
#include "perception_monitor/odd_state_machine.hpp"
#include "perception_monitor/perception_health_score.hpp"
#include "perception_monitor/temporal_anomaly.hpp"

namespace perception_monitor {

class PerceptionMonitorNodelet : public nodelet::Nodelet {
public:
    void onInit() override {
        ros::NodeHandle& nh = getNodeHandle();
        ros::NodeHandle& pnh = getPrivateNodeHandle();
        
        // Load configuration
        loadConfig(pnh);
        
        // Subscribers
        sub_pointcloud_ = nh.subscribe(
            "/pointcloud_aggregator/output", 1,
            &PerceptionMonitorNodelet::pointcloudCallback, this);
        
        sub_detections_ = nh.subscribe(
            "/perception/detections", 1,
            &PerceptionMonitorNodelet::detectionsCallback, this);
        
        sub_radar_ = nh.subscribe(
            "/radar/detections", 1,
            &PerceptionMonitorNodelet::radarCallback, this);
        
        sub_gtsam_ = nh.subscribe(
            "/gtsam/innovation", 1,
            &PerceptionMonitorNodelet::gtsamCallback, this);
        
        sub_tracks_ = nh.subscribe(
            "/perception/tracks", 1,
            &PerceptionMonitorNodelet::tracksCallback, this);
        
        // Publishers
        pub_phs_ = nh.advertise<std_msgs::Float32>(
            "/monitor/perception_health", 1);
        
        pub_odd_state_ = nh.advertise<std_msgs::String>(
            "/monitor/odd_state", 1, true);  // Latched
        
        pub_response_ = nh.advertise<perception_monitor::ResponseAction>(
            "/monitor/response_action", 1);
        
        pub_diagnostics_ = nh.advertise<diagnostic_msgs::DiagnosticArray>(
            "/monitor/diagnostics", 1);
        
        // 10 Hz timer for periodic evaluation
        timer_ = nh.createTimer(ros::Duration(0.1),
            &PerceptionMonitorNodelet::timerCallback, this);
        
        NODELET_INFO("Perception monitor initialized");
    }
    
private:
    void loadConfig(ros::NodeHandle& pnh) {
        // Load reference distributions, thresholds, weights
        // from YAML parameter file
        pnh.param("kl_warn_threshold", 
                  density_monitor_.kl_warn_threshold, 0.15f);
        pnh.param("kl_alert_threshold", 
                  density_monitor_.kl_alert_threshold, 0.35f);
        // ... (all parameters)
    }
    
    void timerCallback(const ros::TimerEvent&) {
        std::lock_guard<std::mutex> lock(mutex_);
        
        // Compute PHS from all monitors
        auto phs_result = phs_.compute(
            input_health_,
            1.0f - ood_score_,  // Invert: OOD high = bad, PHS high = good
            output_health_,
            cross_modal_health_,
            track_health_,
            calibration_health_,
            localization_health_,
            temporal_health_
        );
        
        // Update ODD state machine
        std::map<std::string, ODDState> param_states;
        param_states["perception_health"] = phs_to_odd(phs_result.phs_smoothed);
        param_states["cross_modal"] = score_to_odd(cross_modal_health_);
        param_states["calibration"] = score_to_odd(calibration_health_);
        param_states["localization"] = score_to_odd(localization_health_);
        
        auto odd_result = odd_sm_.update(param_states, 0.1f);
        
        // Publish results
        publish_phs(phs_result);
        publish_odd(odd_result);
        publish_response(phs_result, odd_result);
        publish_diagnostics(phs_result, odd_result);
    }
    
    // Member variables
    std::mutex mutex_;
    
    // Monitors
    PointDensityMonitor density_monitor_;
    IntensityDistMonitor intensity_monitor_;
    SpatialCoverageMonitor coverage_monitor_;
    DetectionCountMonitor detection_monitor_;
    BBoxSizeMonitor bbox_monitor_;
    ClassDistributionMonitor class_monitor_;
    TrackConsistencyMonitor track_monitor_;
    LidarRadarConsistency cross_modal_;
    CalibrationDriftMonitor calibration_monitor_;
    GTSAMInnovationMonitor gtsam_monitor_;
    TemporalDriftDetector temporal_detector_;
    
    // Aggregation
    PerceptionHealthScore phs_;
    ODDStateMachine odd_sm_;
    
    // Current scores (updated by callbacks)
    float input_health_ = 1.0f;
    float ood_score_ = 0.0f;
    float output_health_ = 1.0f;
    float cross_modal_health_ = 1.0f;
    float track_health_ = 1.0f;
    float calibration_health_ = 1.0f;
    float localization_health_ = 1.0f;
    float temporal_health_ = 1.0f;
    
    // ROS handles
    ros::Subscriber sub_pointcloud_, sub_detections_, sub_radar_;
    ros::Subscriber sub_gtsam_, sub_tracks_;
    ros::Publisher pub_phs_, pub_odd_state_, pub_response_, pub_diagnostics_;
    ros::Timer timer_;
};

}  // namespace perception_monitor

PLUGINLIB_EXPORT_CLASS(perception_monitor::PerceptionMonitorNodelet,
                       nodelet::Nodelet)
```

### 12.4 Launch File

```xml
<!-- perception_monitor.launch -->
<launch>
  <!-- Load reference distributions for this airport -->
  <arg name="airport" default="heathrow"/>
  <arg name="condition" default="auto"/>  <!-- auto, day_dry, night_wet, etc. -->
  
  <rosparam command="load" 
    file="$(find perception_monitor)/config/$(arg airport)_reference.yaml"/>
  <rosparam command="load"
    file="$(find perception_monitor)/config/thresholds.yaml"/>
  
  <!-- Nodelet manager (share with perception for zero-copy) -->
  <node pkg="nodelet" type="nodelet" name="perception_monitor"
        args="load perception_monitor/PerceptionMonitorNodelet 
              /perception_nodelet_manager"
        output="screen">
    <param name="airport" value="$(arg airport)"/>
    <param name="condition" value="$(arg condition)"/>
  </node>
  
  <!-- Rosbag logger for monitoring data (lightweight) -->
  <node pkg="rosbag" type="record" name="monitor_logger"
        args="/monitor/perception_health 
              /monitor/odd_state
              /monitor/response_action
              /monitor/diagnostics
              -o /data/logs/monitor_
              --split --duration=3600">
  </node>
</launch>
```

### 12.5 Power and Thermal Considerations

The monitoring layer adds minimal power draw:

| Component | Power Draw | Notes |
|---|---|---|
| GPU monitors | ~0.5W additional | Marginal work in existing CUDA context |
| CPU monitors (4 threads) | ~1.0W additional | Light computation, mostly idle |
| Memory | Negligible | ~700 KB total |
| **Total** | **~1.5W** | <3% of Orin's 50W MAXN budget |

Thermal impact is negligible. The monitoring layer does not contribute meaningfully to GPU or CPU thermal load.

---

## 13. Certification and Safety Case

### 13.1 Standards Mapping

| Standard | Requirement | How This System Addresses It |
|---|---|---|
| **ISO 3691-4:2023** Section 4.12 | Sensor performance monitoring | Input distribution + sensor health = continuous performance verification |
| **ISO 3691-4:2023** Section 4.8 | Safe state on detection of unsafe condition | ODD state machine SUSPENDED = safe stop |
| **ISO 3691-4:2023** Section 4.10 | Speed limitation | PHS-proportional speed reduction |
| **UL 4600** Section 10.6 | Monitor ML model behavior | Output consistency CUSUM/EWMA + OOD detection |
| **UL 4600** Section 10.3 | Runtime monitoring framework | Complete multi-monitor PHS architecture |
| **UL 4600** Section 10.7 | Self-diagnostic reporting | Diagnostic topic + rosbag logging |
| **UL 4600** Section 12.2 | Update validation | Temporal anomaly detection catches post-OTA regression |
| **EU AI Act** Article 9(8) | Monitoring post-deployment | Fleet PHS comparison + temporal trends |
| **EU AI Act** Article 14 | Human oversight | Teleop escalation protocol |
| **EU AI Act** Article 15(4) | Accuracy, robustness monitoring | PHS aggregation + ODD enforcement |
| **ISO 21448 (SOTIF)** | Triggering conditions for functional insufficiency | OOD detection identifies triggering conditions at runtime |
| **ISO 26262** ASIL | Independence of monitoring from monitored function | Separate nodelet, separate CUDA stream, independent computation path |
| **EU Machinery Reg. 2023/1230** Annex III 1.2.1 | Self-monitoring safety function | PHS = quantitative self-monitoring metric |

### 13.2 Independence Argument

For the monitoring to be credible as a safety function, it must be independent from the perception it monitors:

| Aspect | Perception Pipeline | Monitoring Layer | Independence |
|---|---|---|---|
| **Code** | PointPillars C++ / TensorRT | Separate C++ nodelet | Separate codebase, separate build |
| **GPU execution** | CUDA Stream 0 | CUDA Stream 1 | Stream-level isolation |
| **CPU execution** | Perception threads | Monitor threads (separate cores) | Core affinity enforced |
| **Data flow** | Publishes detections | Subscribes to detections | Read-only access to perception |
| **Failure mode** | GPU hang, model crash | CPU-only fallback viable | CPU monitors continue if GPU fails |
| **Development team** | Perception engineers | Safety engineers | Organizational independence |

### 13.3 Evidence Collection

The monitoring system automatically generates certification evidence:

```
Evidence Type                     Source                      Rate
──────────────────────────────────────────────────────────────────
PHS time series                   /monitor/perception_health  10 Hz
ODD state transitions             /monitor/odd_state          Event-based
Response actions taken            /monitor/response_action    Event-based
Monitor component details         /monitor/diagnostics        10 Hz
Threshold calibration records     Config YAML + commissioning Once per airport
False alarm analysis              Offline fleet analytics     Monthly
Detection of known degradation    Validation test results     Per-release
WCET timing analysis              Per-monitor profiling       Per-release
Monitor coverage analysis         Which degradation modes     Per-release
                                  are detectable
```

### 13.4 Safety Integrity Considerations

The perception monitoring layer is part of the safety function chain. Its required integrity level depends on the ASIL decomposition:

```
Full System Safety Requirement: ASIL B(D)
  (from ISO 26262 decomposition, see fail-operational-architecture.md)

Decomposition:
  Neural Perception + Planning (AC): ASIL QM (monitored)
  Classical Frenet (BC): ASIL B
  Safety Monitor (including PHS): ASIL B
  Hardware Safety MCU: ASIL D

Perception Monitor contributes to Safety Monitor (ASIL B):
  - Systematic capability: SC 2 (ISO 26262 Part 4)
  - Random hardware failure: N/A (software-only)
  - Diagnostic coverage: >90% (based on Section 1 threat model)
  - Latency: <5ms (verified by profiling)
  - Availability: 99.99% (monitor runs on CPU even if GPU fails)
```

### 13.5 Validation Protocol

To validate the monitoring system itself:

1. **Fault injection testing**: Inject known degradation conditions (reduce point cloud density, shift intensity distribution, inject wrong bounding boxes, corrupt calibration) and verify the monitoring system detects them within specified latency.

2. **False positive analysis**: Run monitoring on extensive nominal driving data (1,000+ hours) and measure false alarm rates. Target: <0.1% false RESTRICTED, <0.01% false SUSPENDED.

3. **Coverage analysis**: For each degradation mode in Section 1.1, verify that at least one monitor detects it. Document any residual undetectable modes.

4. **Timing verification**: Profile each monitor component on Orin under worst-case load. Verify total <5ms at 99.9th percentile.

```python
# fault_injection_validation.py
class FaultInjectionTest:
    """Systematic validation of perception monitoring."""
    
    test_cases = [
        {
            'name': 'gradual_point_reduction',
            'injection': 'reduce_point_count_by_50pct_over_60s',
            'expected_detection': 'input_distribution KL alarm',
            'max_detection_latency_s': 15.0,
        },
        {
            'name': 'sudden_intensity_shift',
            'injection': 'multiply_intensity_by_0.5',
            'expected_detection': 'input intensity Wasserstein alarm',
            'max_detection_latency_s': 3.0,
        },
        {
            'name': 'calibration_drift_0.2deg',
            'injection': 'rotate_lidar_2_extrinsic_by_0.2_deg',
            'expected_detection': 'calibration MI alarm',
            'max_detection_latency_s': 30.0,
        },
        {
            'name': 'false_detection_injection',
            'injection': 'add_10_random_ghost_detections',
            'expected_detection': 'detection_count CUSUM high alarm',
            'max_detection_latency_s': 5.0,
        },
        {
            'name': 'class_confusion',
            'injection': 'relabel_30pct_gse_as_unknown',
            'expected_detection': 'class_distribution chi2 alarm',
            'max_detection_latency_s': 10.0,
        },
        {
            'name': 'cross_modal_disagreement',
            'injection': 'shift_radar_detections_by_3m',
            'expected_detection': 'cross_modal agreement < 0.5',
            'max_detection_latency_s': 3.0,
        },
        {
            'name': 'confidence_score_inflation',
            'injection': 'add_0.15_to_all_confidences',
            'expected_detection': 'confidence EWMA alarm',
            'max_detection_latency_s': 20.0,
        },
        {
            'name': 'track_fragmentation',
            'injection': 'drop_every_3rd_detection_frame',
            'expected_detection': 'track_consistency fragmentation alarm',
            'max_detection_latency_s': 10.0,
        },
    ]
    
    def run_all(self, rosbag_path: str) -> dict:
        """Run all fault injection tests on recorded rosbag."""
        results = {}
        for tc in self.test_cases:
            detection_time = self.run_single(rosbag_path, tc)
            passed = detection_time <= tc['max_detection_latency_s']
            results[tc['name']] = {
                'passed': passed,
                'detection_time_s': detection_time,
                'max_allowed_s': tc['max_detection_latency_s'],
            }
        return results
```

---

## 14. Implementation Roadmap

### 14.1 Phased Deployment

| Phase | Duration | Cost | Deliverables | PHS Coverage |
|---|---|---|---|---|
| **Phase 1: Core Monitors** | 4 weeks | $8-12K | Input distribution (KL, Wasserstein), output CUSUM/EWMA, PHS aggregation, ODD state machine | 50% of degradation modes |
| **Phase 2: Cross-Modal** | 3 weeks | $7-10K | LiDAR-radar agreement, multi-LiDAR overlap, GTSAM innovation monitor | 70% of degradation modes |
| **Phase 3: OOD + Calibration** | 3 weeks | $8-12K | Energy OOD, Mahalanobis OOD, calibration MI, ground plane consistency | 85% of degradation modes |
| **Phase 4: Temporal + Fleet** | 2 weeks | $5-8K | Minute/hour temporal analysis, fleet comparison, hourly trend detector | 90%+ of degradation modes |
| **Phase 5: Validation** | 3 weeks | $7-10K | Fault injection suite, false alarm analysis, timing verification, FMEA | Validation evidence |
| **Total** | **15 weeks** | **$35-52K** | Complete monitoring system | **90%+ coverage** |

### 14.2 Prerequisites

- PointPillars backbone must expose intermediate BEV features via shared memory or ROS topic (for feature-space monitors)
- Continental ARS548 radar integration (for cross-modal checks; if radar not yet installed, Phase 2 is LiDAR-only)
- GTSAM must publish innovation/residual data (minor modification to existing localization node)
- Commissioning data collection process (2 weeks of nominal operation at target airport)

### 14.3 Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| High false alarm rate | Medium | Operators distrust the system | Extensive commissioning calibration; EWMA smoothing; configurable thresholds |
| Undetectable degradation mode | Low | Silent failure | Defense-in-depth: multiple independent monitors; fault injection testing |
| Compute budget overrun | Low | Monitoring slows perception | Profiling-driven development; monitors are individually budget-capped |
| Reference distribution staleness | Medium | Thresholds become loose/tight | Monthly reference update from fleet data; automated recalibration |
| GPU failure kills GPU-side monitors | Low | Loss of OOD detection | CPU-only fallback: input + output + cross-modal monitors still functional |

---

## 15. Key Takeaways

1. **Perception can fail silently while sensors are healthy**: Domain shift, model staleness, adversarial natural conditions, and novel object types cause neural network degradation that hardware diagnostics cannot detect. This is the gap between sensor health monitoring and runtime verification.

2. **Input distribution monitoring catches problems before outputs degrade**: KL divergence on point density histograms (0.05ms), Wasserstein distance on intensity distributions (0.02ms), and BEV feature statistics (0.2ms GPU) detect when inputs have shifted from the training distribution before the model starts producing errors.

3. **Output consistency checking is ground-truth-free**: CUSUM on detection counts, EWMA on bounding box sizes, chi-squared on class distributions, and track fragmentation rates detect anomalous output patterns without needing labels. The CUSUM detector is particularly effective for the "sudden drop in detections" failure mode that is most dangerous.

4. **Cross-modal consistency is the most powerful monitor**: Agreement between independently derived perception channels (LiDAR vs radar, multi-LiDAR overlap, tracker predictions vs observations) provides a proxy for correctness that requires no reference distribution and catches novel failure modes.

5. **The Perception Health Score (PHS) aggregates everything into one actionable number**: Weighted geometric mean of 8 component monitors, ranging from 0 (no confidence) to 1 (full confidence). Drives continuous speed reduction curve, margin adjustment, mode transitions, and teleop escalation.

6. **The ODD state machine provides hysteresis**: Fast degradation (immediate), slow recovery (30-120 seconds of sustained improvement). Prevents oscillation at boundaries. SUSPENDED state requires human acknowledgment.

7. **Complete monitoring fits in <5ms and 700 KB on Orin**: GPU monitors piggyback on existing perception (0.8ms additional GPU in separate stream), CPU monitors run concurrently on spare cores (1.2ms across 4 threads). Total effective added latency to the perception pipeline is <1ms.

8. **Simplex integration is natural**: PHS > 0.5 = neural AC, PHS 0.3-0.5 = classical BC (Frenet), PHS < 0.3 = safe stop, PHS < 0.1 = hardware E-stop. The Frenet planner is always available as fallback because it does not use neural networks.

9. **Temporal monitoring catches gradual degradation**: Per-minute CUSUM on aggregated statistics detects drift over minutes to hours. Hourly trend analysis catches seasonal performance changes. Fleet comparison distinguishes vehicle-specific from environmental degradation.

10. **Calibration drift detection prevents a common hidden failure**: Mutual information between overlapping LiDAR FOVs, ground plane consistency, and static object position consistency detect extrinsic calibration drift before it causes perception errors. A 0.1 degree drift creates 17 cm error at 100m.

11. **Implementation cost $35-52K over 15 weeks**: Phased from core monitors (4 weeks, $8-12K) through validation (3 weeks, $7-10K). No additional hardware required. Phase 1 alone provides 50% degradation mode coverage.

12. **Certification evidence is generated automatically**: Every PHS computation, ODD state transition, and response action is logged at 10 Hz. Fault injection validation suite provides systematic coverage evidence. Standards mapping covers ISO 3691-4, UL 4600, EU AI Act, and SOTIF.

---

## 16. References

### Academic

- Liu, W. et al. (2020). Energy-based Out-of-Distribution Detection. NeurIPS 2020. [Energy OOD scoring]
- Lee, K. et al. (2018). A Simple Unified Framework for Detecting Out-of-Distribution Samples and Adversarial Attacks. NeurIPS 2018. [Mahalanobis distance OOD]
- Page, E.S. (1954). Continuous Inspection Schemes. Biometrika. [CUSUM algorithm]
- Roberts, S.W. (1959). Control Chart Tests Based on Geometric Moving Averages. Technometrics. [EWMA algorithm]
- Vovk, V. et al. (2005). Algorithmic Learning in a Random World. Springer. [Conformal prediction foundations]
- Gretton, A. et al. (2012). A Kernel Two-Sample Test. JMLR. [MMD for distribution comparison]
- Hendrycks, D. and Gimpel, K. (2017). A Baseline for Detecting Misclassified and Out-of-Distribution Examples in Neural Networks. ICLR 2017.
- Sun, Y. et al. (2022). ReAct: Out-of-Distribution Detection with Rectified Activations. NeurIPS 2022.
- Angelopoulos, A. and Bates, S. (2022). A Gentle Introduction to Conformal Prediction and Distribution-Free Uncertainty Quantification. Foundations and Trends in Machine Learning.
- Yang, J. et al. (2024). Generalized Out-of-Distribution Detection: A Survey. International Journal of Computer Vision.

### Standards

- ISO 3691-4:2023. Industrial trucks -- Safety requirements and verification -- Part 4: Driverless industrial trucks and their systems.
- UL 4600:2022. Standard for Evaluation of Autonomous Products.
- ISO 21448:2022. Road vehicles -- Safety of the intended functionality.
- ISO 26262:2018. Road vehicles -- Functional safety.
- EU AI Act (Regulation 2024/1689).
- EU Machinery Regulation 2023/1230.

### Repository Cross-References

- `hardware/sensors/sensor-degradation-health-monitoring.md` -- Physical sensor health diagnostics
- `operations/safety/runtime-verification-monitoring.md` -- STL temporal logic monitors, shield synthesis
- `operations/safety/weather-adaptive-odd-management.md` -- Environmental ODD state machine, METAR integration
- `operations/safety/simplex-safety-architecture.md` -- Dual-stack AC/BC architecture
- `operations/safety/fail-operational-architecture.md` -- ASIL decomposition, redundancy patterns
- `technology/perception/uncertainty-quantification-calibration.md` -- Epistemic/aleatoric decomposition, conformal prediction
- `hardware/sensors/multi-lidar-extrinsic-calibration.md` -- Calibration procedures, thermal drift compensation
- `technology/localization/mapping-localization.md` -- GTSAM factor graph, innovation sequences
- `hardware/sensors/4d-imaging-radar.md` -- Continental ARS548 integration
- `operations/safety/functional-safety-software.md` -- MISRA C, ISO 26262 Part 6 development
- `operations/safety/airside-scenario-taxonomy.md` -- ISO 34502 scenario classification
- `operations/deployment/fleet-anomaly-root-cause.md` -- Fleet-level anomaly attribution
- `technology/perception/realtime-occupancy-grid-mapping.md` -- Occupancy grid monitoring context
- `operations/safety/testing-validation-methodology.md` -- Validation protocol, fault injection
