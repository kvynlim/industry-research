# Camera-Only Degraded Perception for Airside Autonomous Vehicles

## When LiDAR Fails: Monocular/Stereo Depth, Camera 3D Detection, and Graceful Degradation Architecture

**Last updated:** 2026-04-11

---

> **Key Takeaway:** LiDAR failure on airport airside is not hypothetical -- de-icing glycol spray, jet exhaust thermal distortion, and sensor hardware faults will blind LiDAR at predictable rates (estimated 2-8 hours cumulative downtime per vehicle per year). Camera-only perception can sustain safe operation at reduced speed, but the accuracy gap is severe: camera-only 3D detection achieves roughly 40% NDS versus 70% for LiDAR on nuScenes, and monocular depth error at 50m exceeds 3-5m absolute. The key to safe degraded operation is not matching LiDAR accuracy with cameras, but building an architecture that (a) detects LiDAR failure within 100ms, (b) activates camera-only perception with correctly calibrated confidence, (c) reduces speed proportional to the degraded perception envelope, and (d) requests safe stop or teleoperation when camera confidence also drops below threshold. On NVIDIA Orin, DepthAnything v2 Small (INT8) achieves ~15ms and BEVFormer-Tiny runs at ~35-50ms, leaving budget for a combined camera fallback pipeline within the 100ms cycle.

---

## Table of Contents

1. [When LiDAR Fails on Airside](#1-when-lidar-fails-on-airside)
2. [Monocular Depth Estimation SOTA (2024-2026)](#2-monocular-depth-estimation-sota-2024-2026)
3. [Stereo Depth for Airside](#3-stereo-depth-for-airside)
4. [Camera-Only 3D Object Detection](#4-camera-only-3d-object-detection)
5. [Confidence Calibration for Degraded Mode](#5-confidence-calibration-for-degraded-mode)
6. [Thermal Stress and Calibration](#6-thermal-stress-and-calibration)
7. [Degraded Mode Architecture](#7-degraded-mode-architecture)
8. [Practical Deployment on Orin](#8-practical-deployment-on-orin)
9. [Testing and Validation](#9-testing-and-validation)
10. [Recommended Implementation Roadmap](#10-recommended-implementation-roadmap)
11. [References](#11-references)

---

## 1. When LiDAR Fails on Airside

### 1.1 LiDAR Failure Modes Specific to Airport Apron

Airport airside environments expose LiDAR to failure modes that do not occur (or occur rarely) on public roads. Each mode has distinct detection signatures and recovery characteristics.

| Failure Mode | Root Cause | Detection Time | Recovery Time | Frequency |
|---|---|---|---|---|
| **De-icing glycol coating** | Type I/IV glycol sprayed on aircraft splatters on vehicle sensors | Gradual (2-30s) | Requires cleaning stop (5-30 min) | Seasonal: daily in winter ops |
| **Jet exhaust thermal distortion** | Hot exhaust (300-600C) creates turbulent air, bending laser paths | Instantaneous | Self-resolves when aircraft moves (1-5 min) | Every pushback/taxi event |
| **FOD impact damage** | Debris on apron damages optical window or rotating assembly | Instantaneous | Sensor replacement (hours-days) | Rare: ~1-2 per vehicle per year |
| **Sensor hardware fault** | Electronics failure, motor stall, firmware crash | Instantaneous | Restart (5-30s) or replacement (hours) | ~0.1-0.5% per 1000 hours |
| **Calibration drift (thermal cycling)** | Repeated -30C to +50C cycles shift extrinsic alignment | Gradual (days) | Recalibration (15-60 min) | Continuous in extreme climates |
| **Rain/snow accumulation** | Water film on optical window scatters laser returns | Gradual (seconds) | Self-cleaning or manual wipe | Weather-dependent |
| **Retroreflective saturation** | Aircraft skin, hi-vis markings, wet tarmac create multi-path returns | Intermittent | Self-resolves per scan | Constant in apron areas |
| **Electrical interference** | Ground power units, radar, de-icing equipment EMI | Intermittent | Self-resolves when source removed | Airport-specific |

### 1.2 De-Icing Glycol: The Airside-Specific Threat

De-icing operations are the single most damaging LiDAR failure mode unique to airports. Aircraft de-icing uses Type I glycol (heated, low viscosity, orange/green) and Type IV glycol (thickened, high viscosity, green) sprayed at pressure. The spray creates an aerosol cloud that extends 10-30m from the aircraft. Any AV operating near active de-icing pads faces:

- **Lens coating**: Glycol is viscous and does not evaporate like water. It deposits a sticky film on optical surfaces that progressively attenuates laser returns. Within 2-5 minutes of exposure, LiDAR range can degrade by 30-60%.
- **Aerosol scattering**: Glycol aerosol particles (50-200 um diameter) are large enough to scatter 905nm laser beams, creating dense false returns at short range (1-5m) that mask real objects behind the aerosol cloud.
- **Cleaning difficulty**: Unlike rain that can be cleared by spinning or wipers, glycol requires chemical cleaning. Field cleaning with isopropyl alcohol takes 5-15 minutes per sensor. With 4-8 LiDAR units, this represents 20-60 minutes of downtime.

**Expected exposure frequency**: Major hub airports perform 50-200 de-icing operations per day during winter months (November-March in northern hemisphere). If an autonomous tug or baggage tractor operates within the de-icing zone, expect glycol exposure events 2-5 times per shift during winter.

### 1.3 Jet Exhaust Thermal Distortion

Jet engines at idle produce exhaust temperatures of 300-400C, and at takeoff thrust, 500-600C. The heated air column creates a refractive index gradient that bends laser beams passing through it. Effects include:

- **Point cloud warping**: Objects seen through the exhaust plume appear displaced by 0.5-2m at 30m range, depending on engine type and thrust setting
- **Range noise increase**: The turbulent mixing zone creates rapid fluctuations in measured range, increasing point-to-point noise from typical 2-3cm to 10-30cm
- **Phantom objects**: In severe cases, the density gradient boundary itself produces returns that appear as solid objects (particularly with multi-return LiDAR)

Unlike de-icing, jet exhaust distortion is transient and self-resolving, but it occurs at every pushback and taxi event -- the exact moments when the AV is most likely to be near the aircraft.

### 1.4 Expected Failure Rates and Downtime

Based on available reliability data from LiDAR manufacturers and field deployment reports:

| Metric | Estimate | Source Basis |
|---|---|---|
| Mean time between hardware failure (MTBF) | 20,000-50,000 hours | Manufacturer datasheets (RoboSense, Hesai) |
| Degraded operation hours per year (weather/glycol) | 50-200 hours | Estimated for northern European hub airport |
| Complete LiDAR blindness events per year | 10-50 | Hardware fault + severe glycol coating |
| Average degraded event duration | 5-30 minutes | Cleaning or environmental clearing |
| Total annual LiDAR downtime per vehicle | 2-8 hours | Combined hardware + environmental |

For a fleet of 10 vehicles operating 16 hours/day, this translates to roughly 20-80 total fleet-hours per year of LiDAR-degraded operation. Without camera fallback, each of these events requires either a safe stop (blocking operations) or a human safety driver takeover.

### 1.5 Multi-LiDAR Degradation Modes

Aurrigo vehicles carry 4-8 RoboSense LiDAR units. Not all failures blind all units simultaneously. The degradation is typically progressive:

```
Degradation Level 0: All LiDAR operational (normal mode)
Degradation Level 1: 1-2 LiDAR degraded (partial blind spot, camera supplements)
Degradation Level 2: 3+ LiDAR degraded (significant perception loss, camera primary for affected zones)
Degradation Level 3: All LiDAR offline (full camera fallback, severe speed restriction)
Degradation Level 4: LiDAR + partial camera failure (safe stop mandatory)
```

The most common scenario is Level 1-2: a subset of LiDAR units are affected (e.g., forward-facing units during approach to jet exhaust, or windward-side units during de-icing). Camera fallback for specific zones rather than full camera-only operation is the practical design target.

---

## 2. Monocular Depth Estimation SOTA (2024-2026)

### 2.1 Why Monocular Depth Matters for Fallback

When LiDAR is unavailable, the vehicle needs 3D spatial understanding from cameras alone. Monocular depth estimation provides per-pixel depth from a single camera image, serving two roles:

1. **Pseudo-LiDAR generation**: Convert depth maps to 3D point clouds for downstream detection/tracking pipelines that expect point cloud input
2. **Direct 3D reasoning**: Feed depth maps to BEV encoders or occupancy networks alongside RGB features

The fundamental challenge is that monocular depth is inherently ambiguous -- a small nearby object and a large distant object produce identical image features. Modern methods overcome this through learned priors, but accuracy at long range (>30m) remains significantly worse than LiDAR.

### 2.2 Metric3D v2 (Hu et al., 2024)

**Paper:** "Metric3D v2: A Versatile Monocular Geometric Foundation Model for Zero-Shot Metric Depth and Surface Normal Estimation"

Metric3D v2 addresses the key limitation of prior monocular depth models: they produce relative depth (correct ordering but unknown scale) rather than metric depth (absolute distances in meters). The innovation is a canonical camera transformation that normalizes all training images to a shared focal length, enabling the model to predict metric depth from any camera without calibration-time fine-tuning.

| Property | Value |
|---|---|
| Architecture | ViT-L (DINOv2 backbone) + Transformer decoder |
| Input resolution | Up to 1280x384 (flexible) |
| Output | Metric depth + surface normals |
| Training data | 16M images from 19 datasets (indoor + outdoor) |
| Zero-shot outdoor abs.rel. | 5.2% (KITTI), 7.8% (NYUv2) |
| Inference speed | ~15 FPS at 1280x384 on A100 |
| Camera agnostic | Yes -- canonical camera space eliminates intrinsic dependency |

**Airside relevance:**
- Metric (not relative) depth is essential for safety -- the vehicle needs to know actual distances to obstacles in meters, not just relative ordering
- Camera-agnostic operation means intrinsic calibration drift from thermal cycling does not catastrophically fail the depth estimation (only degrades it gradually)
- 5.2% abs.rel. on KITTI corresponds to roughly 0.5m error at 10m and 2.5m error at 50m -- acceptable for reduced-speed operation but insufficient for normal-speed navigation

**Limitations for airside:**
- 15 FPS on A100 translates to roughly 3-5 FPS on Orin at FP16, requiring INT8 quantization and smaller backbone (ViT-S) to achieve real-time
- Large featureless tarmac areas produce unreliable depth estimates (no texture for stereo matching or learned correlation)
- Aircraft fuselage presents large uniform surfaces with specular reflections that confuse depth estimation

### 2.3 DepthAnything v2 (Yang et al., 2024)

**Paper:** "Depth Anything V2" (University of Hong Kong / TikTok)

DepthAnything v2 represents the current practical SOTA for deployable monocular depth estimation. The key insight is training on a massive synthetic dataset (595K images) with precise depth labels, then fine-tuning on unlabeled real images using a pseudo-label strategy.

| Property | Value |
|---|---|
| Architecture | DINOv2 backbone (ViT-S/B/L) + DPT decoder |
| Model sizes | Small (25M), Base (98M), Large (335M) |
| Training | Stage 1: Synthetic (595K), Stage 2: Pseudo-label real images |
| Zero-shot abs.rel. | 4.8% (KITTI), 5.6% (ETH3D) |
| Inference (ViT-S) | ~15ms on Orin INT8 (estimated), 33 FPS on A100 |
| Metric depth variant | Available (DA v2 Metric) |

**Why DepthAnything v2 is the recommended fallback depth model:**

1. **Small model is fast enough**: The ViT-S variant has only 25M parameters and runs at ~15ms on Orin with INT8 quantization, fitting within the fallback perception budget
2. **DINOv2 backbone**: Shares features with other DINOv2-based models (if used elsewhere in the stack), enabling backbone sharing
3. **Strong generalization**: Trained on massive and diverse data, robust to domain shift. Synthetic pre-training means it has seen geometric patterns similar to airport infrastructure
4. **Metric depth variant**: Unlike many depth models that only output relative depth, DA v2 has an explicit metric depth variant

**Practical accuracy profile for airside:**

| Range | Expected Abs. Error | Error as % of Range | Usability |
|---|---|---|---|
| 0-5m | 0.2-0.4m | 4-8% | Good for collision avoidance |
| 5-15m | 0.5-1.2m | 3-8% | Adequate for slow-speed navigation |
| 15-30m | 1.0-2.5m | 3-8% | Marginal for planning |
| 30-50m | 2.0-5.0m | 4-10% | Detection only, not reliable range |
| 50-100m | 5-15m | 10-15% | Detection presence, no useful range |

### 2.4 UniDepth (Piccinelli et al., 2024)

**Paper:** "UniDepth: Universal Monocular Metric Depth Estimation"

UniDepth's key innovation is predicting camera intrinsics jointly with depth, making it truly self-promptable -- it does not need known camera parameters at inference time. This is achieved through a camera module that predicts a dense intrinsic representation (focal length per pixel) alongside the depth map.

| Property | Value |
|---|---|
| Architecture | DINOv2/ConvNeXt backbone + pseudo-spherical representation |
| Camera intrinsics | Self-predicted (not required as input) |
| Zero-shot abs.rel. | 5.6% (KITTI), 5.9% (NYUv2) |
| Key innovation | Pseudo-spherical output representation removes focal length ambiguity |

**Airside relevance:**
- Self-predicted intrinsics provide resilience against calibration drift from thermal cycling
- Pseudo-spherical representation handles wide-angle and fisheye cameras common in surround-view AV setups
- Slightly lower accuracy than Metric3D v2 and DA v2, but more robust to calibration uncertainty
- Useful as a cross-check: if UniDepth and DA v2 disagree significantly, that itself is a signal of degraded conditions

### 2.5 ZoeDepth (Bhat et al., 2023)

**Paper:** "ZoeDepth: Zero-shot Transfer by Combining Relative and Metric Depth"

ZoeDepth introduced the two-stage approach now standard in metric depth: first predict relative depth (which generalizes well), then convert to metric depth via a lightweight bin-based head that adapts to specific depth ranges.

| Property | Value |
|---|---|
| Architecture | MiDaS backbone + metric bins module |
| Approach | Relative depth (pre-trained) + metric head (fine-tuned) |
| Depth bins | 64 discrete bins, adaptive range |
| Zero-shot abs.rel. | 5.7% (KITTI) |

**Position in the landscape:** ZoeDepth is now superseded by Metric3D v2 and DA v2 in accuracy, but its bin-based approach is influential. The concept of separating relative depth (good generalization) from metric depth (domain-specific scale) is directly applicable to airside deployment where the depth distribution (0.5m FOD to 65m aircraft) differs from training distributions.

### 2.6 Comparative Summary

| Method | Abs.Rel (KITTI) | Metric Depth | Camera Agnostic | Orin Feasibility | Recommended |
|---|---|---|---|---|---|
| **DepthAnything v2 (S)** | 4.8% | Yes (variant) | Needs intrinsics | ~15ms INT8 | **Primary choice** |
| **Metric3D v2** | 5.2% | Yes (native) | Yes (canonical cam) | ~25-40ms INT8 | Backup/validation |
| **UniDepth** | 5.6% | Yes (native) | Yes (self-predicted) | ~30-50ms INT8 | Calibration-robust alt |
| **ZoeDepth** | 5.7% | Yes (bin-based) | No | ~20ms INT8 | Legacy, not recommended |
| **MiDaS v3.1** | 6.5% | Relative only | Needs intrinsics | ~12ms INT8 | Relative depth only |

### 2.7 Airside-Specific Depth Estimation Challenges

**Large depth range**: Airside perception must handle 0.5m (FOD on tarmac directly ahead) to 65m (aircraft wingspan) in a single scene. Most depth models are trained on driving datasets where the practical range is 3-80m with most content in the 5-40m band. The near-range accuracy for very small objects close to the vehicle is critical for FOD detection but undertested.

**Reflective and featureless surfaces**: Wet tarmac acts as a mirror, creating ambiguous depth cues. Aircraft fuselage is a large uniform reflective surface. The apron pavement itself has minimal texture compared to road scenes with lane markings, buildings, and vegetation.

**Scale ambiguity at distance**: A baggage cart at 20m and a de-icing truck at 40m may appear similar in size. Without strong semantic priors about object classes (which monocular depth does not have), range estimates for these objects can be confused.

**Mitigation strategies:**
1. Fuse monocular depth with known aircraft positions from ADS-B/MLAT as scale anchors
2. Use ground plane constraint: the camera height is known, and the apron is approximately flat, providing a geometric depth floor
3. Ensemble multiple depth models (DA v2 + Metric3D v2) and use disagreement as uncertainty signal
4. Incorporate temporal consistency: running depth estimation on video frames and enforcing consistency via optical flow filtering reduces single-frame outliers

---

## 3. Stereo Depth for Airside

### 3.1 Stereo vs Monocular for Fallback

If the vehicle is equipped with stereo camera pairs (even one pair for the forward direction), stereo depth provides significantly better range accuracy than monocular methods. The trade-off is hardware cost and additional calibration complexity.

| Property | Monocular Depth | Stereo Depth |
|---|---|---|
| Hardware | Single camera | Calibrated camera pair |
| Accuracy at 10m | 0.5-1.0m (5-10%) | 0.1-0.3m (1-3%) |
| Accuracy at 30m | 1.5-3.0m (5-10%) | 0.3-1.0m (1-3%) |
| Accuracy at 50m | 3-7m (6-14%) | 1.0-3.0m (2-6%) |
| Failure mode | Scale ambiguity | Textureless surfaces, baseline limitation |
| Computation | Single forward pass | Disparity matching + depth conversion |
| Calibration sensitivity | Low (self-intrinsic models) | High (extrinsic drift = range error) |

### 3.2 Stereo Baseline Requirements for Airside Ranges

Stereo depth accuracy is governed by the relationship:

```
depth = (focal_length * baseline) / disparity

depth_error = depth^2 / (focal_length * baseline) * disparity_error
```

For a target of 1m depth accuracy at 50m range with 0.5 pixel disparity error and a typical automotive camera (focal length ~700 pixels at 1280x720):

```
Required baseline = depth^2 * disparity_error / (focal_length * target_accuracy)
                  = 50^2 * 0.5 / (700 * 1.0)
                  = 1250 / 700
                  = 1.79m
```

This means reliable stereo depth at 50m requires a baseline of approximately 1.5-2.0m -- achievable on a larger vehicle (ADT3 has sufficient width) but not with a compact stereo camera unit like the ZED 2i (120mm baseline).

**Practical baselines for airside:**

| Camera Setup | Baseline | Reliable Range (1m acc.) | Reliable Range (0.5m acc.) |
|---|---|---|---|
| ZED 2i | 120mm | ~12m | ~8m |
| OAK-D Pro | 75mm | ~9m | ~6m |
| Custom wide-baseline pair | 0.5m | ~28m | ~20m |
| Vehicle-width stereo pair | 1.5m | ~48m | ~34m |
| Cross-vehicle multi-view | 3.0m+ | ~70m+ | ~50m+ |

**Recommendation**: For airside fallback, install a wide-baseline stereo pair (0.5-1.5m) using automotive-grade cameras (GMSL2 interface for Orin). The compact stereo units (ZED, OAK-D) are useful for near-field only (0-12m obstacle avoidance).

### 3.3 Modern Stereo Matching Methods

#### RAFT-Stereo (Lipson et al., ECCV 2022)

RAFT-Stereo applies the iterative update architecture from optical flow (RAFT) to stereo matching. It constructs a multi-scale 4D correlation volume and iteratively refines disparity using a GRU-based update operator.

| Property | Value |
|---|---|
| Architecture | Feature encoder + correlation volume + GRU iterative refinement |
| Accuracy (KITTI) | D1-all: 3.51% (6th on leaderboard at publication) |
| Inference | ~200ms on A100 (640x480) |
| Strengths | Robust to textureless regions, good at occlusion boundaries |
| Weaknesses | Slow iterative refinement, large memory for correlation volume |

#### CREStereo (Li et al., CVPR 2022)

CREStereo uses a cascaded recurrent architecture with adaptive group correlation. It processes stereo pairs at multiple resolutions in a cascade, with each level refining the previous estimate.

| Property | Value |
|---|---|
| Architecture | Cascaded recurrence + adaptive group correlation |
| Accuracy (KITTI) | D1-all: 2.18% (significant improvement over RAFT-Stereo) |
| Inference | ~100ms on A100 (640x480) |
| Edge deployment | TensorRT FP16 available, ~150-250ms on Orin |

#### IGEV-Stereo (Xu et al., CVPR 2023)

IGEV-Stereo combines geometry encoding volumes with iterative updates, achieving a better accuracy-speed trade-off than pure iterative methods.

| Property | Value |
|---|---|
| Architecture | Combined geometry encoding volume + GRU refinement |
| Accuracy (KITTI) | D1-all: 1.83% (SOTA at publication) |
| Inference | ~60ms on A100 (640x480) |
| Key innovation | Geometry encoding provides strong initialization, reducing iterations needed |

#### Comparison for Airside Deployment

| Method | KITTI D1-all | A100 Latency | Est. Orin Latency (FP16) | TensorRT Ready |
|---|---|---|---|---|
| RAFT-Stereo | 3.51% | 200ms | ~400-600ms | Partial |
| CREStereo | 2.18% | 100ms | 150-250ms | Yes |
| IGEV-Stereo | 1.83% | 60ms | 100-180ms | Community |
| **Hitnet** (Google) | 4.8% | 15ms | 25-40ms | Yes | 
| **AANet** | 3.29% | 30ms | 50-80ms | Yes |

For real-time fallback on Orin, **HITNet** (30-40ms) or **AANet** (50-80ms) are the only methods that fit within a 100ms perception cycle alongside other components. CREStereo and IGEV-Stereo require a dedicated stereo processing cycle at lower frequency (5 Hz rather than 10 Hz).

### 3.4 Practical Stereo Camera Hardware

| Camera | Resolution | Baseline | Interface | IP Rating | Temp Range | Price |
|---|---|---|---|---|---|---|
| **ZED 2i** | 2208x1242 | 120mm | USB 3.0 | IP66 | -10 to 50C | $500 |
| **OAK-D Pro** | 1280x800 (stereo) | 75mm | USB 3.0 / PoE | IP67 (enclosure) | -20 to 60C | $300 |
| **FLIR BFS-U3** (pair) | 1440x1080 | Custom | USB 3.1 | IP67 (enclosure) | -20 to 55C | $600/pair |
| **Leopard Imaging GMSL2** (pair) | 1920x1080 | Custom | GMSL2 (Orin native) | IP69K (enclosure) | -40 to 85C | $800/pair |
| **Entron F28 GMSL2** (pair) | 2880x1860 | Custom | GMSL2 | IP69K | -40 to 105C | $1000/pair |

**Recommendation for airside**: Leopard Imaging or Entron GMSL2 cameras in IP69K enclosures with heated lens covers (for de-icing fluid resistance). GMSL2 provides reliable, low-latency, long-cable-run connectivity to Orin without USB bandwidth contention. Custom mounting at 0.5-1.5m baseline on the vehicle roof rack.

---

## 4. Camera-Only 3D Object Detection

### 4.1 The Camera 3D Detection Accuracy Gap

Camera-only 3D detection has progressed rapidly but remains fundamentally limited by the absence of direct range measurement. On nuScenes (the standard benchmark):

| Method | Modality | NDS | mAP | mATE (m) | mASE | mAOE |
|---|---|---|---|---|---|---|
| CenterPoint | LiDAR | 67.3 | 60.3 | 0.262 | 0.239 | 0.361 |
| TransFusion-L | LiDAR | 71.7 | 68.9 | 0.259 | 0.243 | 0.359 |
| BEVFusion (MIT) | LiDAR+Camera | 72.9 | 70.2 | 0.261 | 0.239 | 0.354 |
| **BEVFormer v2** | **Camera only** | **56.9** | **47.5** | **0.570** | **0.261** | **0.373** |
| **StreamPETR** | **Camera only** | **55.0** | **45.0** | **0.613** | **0.267** | **0.413** |
| **Far3D** | **Camera only** | **54.2** | **44.7** | **0.560** | **0.269** | **0.385** |
| **PETR v2** | **Camera only** | **53.7** | **43.5** | **0.630** | **0.270** | **0.430** |
| **FCOS3D** | **Camera only** | **42.8** | **35.8** | **0.725** | **0.263** | **0.422** |

**The gap**: Camera-only methods achieve roughly 55-57 NDS compared to 67-73 for LiDAR and LiDAR+camera fusion. The primary driver is **mean Average Translation Error (mATE)**: camera methods produce 0.56-0.73m localization error versus 0.26m for LiDAR. This 2-3x worse localization accuracy is inherent to monocular/multi-camera depth estimation and cannot be fully closed by architecture improvements alone.

### 4.2 Multi-Camera BEV Detection Methods

#### BEVDet / BEVDet4D (Huang et al., 2022)

BEVDet established the paradigm of explicit view transformation from perspective images to BEV space using Lift-Splat-Shoot (LSS). BEVDet4D extends this with temporal fusion across frames.

- **Architecture**: Image backbone (ResNet/Swin) -> LSS view transform -> BEV backbone (ResNet) -> detection head
- **Temporal**: BEVDet4D aligns and concatenates BEV features across 2+ timestamps
- **Speed**: Base model ~30ms on A100, temporal variant ~40ms
- **Orin**: BEVDet-Tiny with ResNet-50 backbone achievable at ~40-60ms with TensorRT FP16

#### BEVFormer (Li et al., NeurIPS 2022)

BEVFormer uses deformable attention to query camera features from learned BEV query positions, avoiding the explicit depth estimation step of LSS-based methods.

- **Architecture**: BEV queries + spatial cross-attention to cameras + temporal self-attention
- **Key advantage**: Implicitly learns depth through attention, more flexible than LSS
- **Speed**: BEVFormer-Base ~100ms on A100, BEVFormer-Tiny ~30ms on A100
- **Orin**: BEVFormer-Tiny at FP16 achieves ~35-50ms with TensorRT

#### StreamPETR (Wang et al., ICCV 2023)

StreamPETR extends PETR with streaming temporal modeling. Instead of processing all frames jointly, it propagates object queries across frames as a memory stream.

- **Architecture**: Sparse 3D position-aware queries + temporal propagation
- **Key advantage**: Linear temporal complexity (not quadratic), handles long sequences
- **Speed**: ~25ms on A100
- **Orin**: ~40-60ms estimated with TensorRT FP16

#### Far3D (Jiang et al., 2024)

Far3D specifically targets long-range 3D detection, extending reliable detection range beyond the typical 50m limit of camera-only methods.

- **Architecture**: Adaptive queries + multi-scale feature aggregation + range-aware heads
- **Key advantage**: Maintains detection quality at 100-150m through perspective-aware feature sampling
- **Airside relevance**: Aircraft detection at long range is easier than pedestrian detection (large target), but Far3D's explicit handling of range-dependent feature resolution helps

### 4.3 Monocular 3D Detection

For fallback with limited cameras (e.g., only forward-facing cameras available), monocular 3D detection methods operate on single camera images.

#### FCOS3D (Wang et al., NeurIPS 2021)

- Anchor-free 3D detection from monocular images
- Predicts 3D center offset, depth, dimensions, and orientation per pixel
- Simple architecture, easy to deploy, but lowest accuracy among modern methods
- Orin: ~20-30ms with TensorRT

#### PGD (Wang et al., CoRL 2022)

- Probabilistic and Geometric Depth estimation for monocular 3D detection
- Models depth as a probability distribution rather than point estimate
- Provides native uncertainty quantification -- valuable for degraded mode confidence assessment
- 10-15% improvement over FCOS3D on nuScenes

### 4.4 Airside-Specific Detection Considerations

**Large objects are easier**: Aircraft fuselages span 30-65m and are 10-15m tall. Even with poor depth estimation, camera-based 2D detection of aircraft is reliable (>95% recall at moderate confidence). The challenge is precise 3D localization of the aircraft nose and wingtips for collision avoidance.

**Small objects are much harder**: FOD (bolts, tools, debris) at 10-50cm and crouching personnel at low angles are where camera-only perception degrades most severely. At 30m, a 10cm FOD object occupies only 2-3 pixels in a 1920x1080 image -- below reliable detection threshold for most architectures.

**Object size distribution for airside:**

| Object Class | Typical Size | Detection Range (Camera) | Detection Range (LiDAR) | Gap |
|---|---|---|---|---|
| Aircraft fuselage | 30-65m x 5-15m | >200m | >100m | Camera wins |
| De-icing truck | 8m x 3m | 80-120m | 60-80m | Comparable |
| Baggage tractor | 3m x 2m | 40-60m | 50-70m | LiDAR slightly better |
| Baggage cart | 2m x 1.5m | 25-40m | 40-60m | LiDAR better |
| Standing person | 0.5m x 1.8m | 30-50m | 30-50m | Comparable |
| Crouching person | 0.5m x 0.8m | 15-25m | 25-40m | LiDAR significantly better |
| FOD (>10cm) | 0.1-0.3m | 5-15m | 10-25m | LiDAR significantly better |
| FOD (<10cm) | <0.1m | 3-8m | 5-15m | Both poor |

**Critical implication**: Camera-only mode is acceptable for aircraft and large GSE detection but dangerously inadequate for personnel and FOD at the ranges needed for normal-speed operation. This is the primary justification for mandatory speed reduction in degraded mode.

---

## 5. Confidence Calibration for Degraded Mode

### 5.1 Why Calibration Matters More Than Accuracy

In normal operation, a 10% false negative rate in perception can be compensated by sensor redundancy (LiDAR catches what camera misses, and vice versa). In degraded mode with camera-only perception, every detection decision carries more weight because there is no cross-modal verification. The safety system needs to know: **how much should it trust each camera detection?**

Modern neural networks are notoriously poorly calibrated -- a detection with 90% confidence might only be correct 70% of the time (overconfident), or a detection with 60% confidence might be correct 85% of the time (underconfident). Temperature scaling and other post-hoc calibration methods fix this mapping.

### 5.2 Temperature Scaling

Temperature scaling is the simplest and most effective post-hoc calibration method. It applies a single learned parameter T to the logits before softmax:

```python
import torch
import torch.nn as nn
from torch.nn import functional as F

class TemperatureScaler(nn.Module):
    """
    Post-hoc temperature scaling for detection confidence calibration.
    
    Learns a single temperature T such that:
        calibrated_confidence = softmax(logits / T)
    
    T > 1 softens predictions (reduces overconfidence -- typical for neural nets)
    T < 1 sharpens predictions (reduces underconfidence)
    """
    def __init__(self):
        super().__init__()
        self.temperature = nn.Parameter(torch.ones(1) * 1.5)  # Initialize slightly above 1
    
    def forward(self, logits: torch.Tensor) -> torch.Tensor:
        return logits / self.temperature
    
    def calibrate(self, val_logits: torch.Tensor, val_labels: torch.Tensor, 
                  lr: float = 0.01, max_iter: int = 100) -> float:
        """
        Learn optimal temperature from validation set.
        
        Args:
            val_logits: Raw model logits [N, C] from validation set
            val_labels: Ground truth labels [N]
            lr: Learning rate for optimization
            max_iter: Maximum optimization iterations
        
        Returns:
            Learned temperature value
        """
        optimizer = torch.optim.LBFGS([self.temperature], lr=lr, max_iter=max_iter)
        
        def closure():
            optimizer.zero_grad()
            scaled = self.forward(val_logits)
            loss = F.cross_entropy(scaled, val_labels)
            loss.backward()
            return loss
        
        optimizer.step(closure)
        return self.temperature.item()


class DegradedModeConfidenceCalibrator:
    """
    Maintains separate calibration parameters for normal and degraded modes.
    
    Camera-only perception is systematically less accurate than LiDAR+camera,
    so it requires different calibration (typically higher temperature / more
    conservative confidence estimates).
    """
    def __init__(self):
        self.normal_temp = 1.0    # Learned from LiDAR+camera validation
        self.degraded_temp = 1.0  # Learned from camera-only validation
        self.per_class_temps = {} # Optional: per-class calibration
    
    def calibrate_from_data(self, normal_logits, normal_labels,
                            degraded_logits, degraded_labels):
        """Calibrate both modes from separate validation sets."""
        normal_scaler = TemperatureScaler()
        self.normal_temp = normal_scaler.calibrate(normal_logits, normal_labels)
        
        degraded_scaler = TemperatureScaler()
        self.degraded_temp = degraded_scaler.calibrate(degraded_logits, degraded_labels)
        
        print(f"Normal mode temperature:   {self.normal_temp:.3f}")
        print(f"Degraded mode temperature: {self.degraded_temp:.3f}")
        # Expect degraded_temp > normal_temp (more conservative)
    
    def get_calibrated_confidence(self, raw_confidence: float, 
                                  is_degraded: bool) -> float:
        """Apply appropriate temperature scaling based on mode."""
        # Convert confidence back to logit
        logit = torch.log(torch.tensor(raw_confidence / (1 - raw_confidence + 1e-8)))
        temp = self.degraded_temp if is_degraded else self.normal_temp
        calibrated = torch.sigmoid(logit / temp)
        return calibrated.item()
```

### 5.3 Ensemble Uncertainty via MC-Dropout

Monte Carlo Dropout provides uncertainty estimates by running inference multiple times with dropout enabled:

```python
import numpy as np
from typing import Tuple

class MCDropoutUncertainty:
    """
    Estimate detection uncertainty via MC-Dropout.
    
    Run N forward passes with dropout enabled, measure variance
    across predictions. High variance = high uncertainty.
    
    For degraded mode: use uncertainty to identify detections that
    should not be trusted (trigger speed reduction or safe stop).
    """
    def __init__(self, model, n_samples: int = 5, dropout_rate: float = 0.1):
        self.model = model
        self.n_samples = n_samples
        self.dropout_rate = dropout_rate
    
    def enable_mc_dropout(self):
        """Enable dropout layers during inference."""
        for module in self.model.modules():
            if isinstance(module, (torch.nn.Dropout, torch.nn.Dropout2d)):
                module.train()  # Keep dropout active
    
    def predict_with_uncertainty(self, input_data) -> Tuple[np.ndarray, np.ndarray]:
        """
        Run multiple forward passes and compute mean + variance.
        
        Returns:
            predictions: Mean predictions [N_detections, ...]
            uncertainties: Per-detection uncertainty scores [N_detections]
        """
        self.model.eval()
        self.enable_mc_dropout()
        
        all_predictions = []
        for _ in range(self.n_samples):
            with torch.no_grad():
                pred = self.model(input_data)
                all_predictions.append(pred)
        
        # Stack and compute statistics
        stacked = torch.stack(all_predictions, dim=0)
        mean_pred = stacked.mean(dim=0)
        
        # Predictive uncertainty: variance of confidence scores
        confidence_var = stacked[..., -1].var(dim=0)  # Assuming last dim is confidence
        
        # Spatial uncertainty: variance of bounding box coordinates
        bbox_var = stacked[..., :7].var(dim=0).sum(dim=-1)  # x,y,z,w,h,l,theta
        
        # Combined uncertainty score
        uncertainty = confidence_var + 0.1 * bbox_var
        
        return mean_pred, uncertainty
```

### 5.4 Confidence Thresholds for Safety Controller Takeover

The degraded mode manager must map perception confidence to action authority. This is not a single threshold but a graduated response:

| Perception Confidence | System Response | Max Speed | Safety Action |
|---|---|---|---|
| >0.85 (high) | Normal operation (rare in camera-only mode) | 15 km/h (airside limit) | None |
| 0.70 - 0.85 | Degraded but operational | 10 km/h | Alert operator |
| 0.50 - 0.70 | Significantly degraded | 5 km/h | Request teleop standby |
| 0.30 - 0.50 | Marginal perception | 2 km/h (crawl) | Active teleop supervision |
| <0.30 | Perception unreliable | 0 km/h | Safe stop, teleop takeover |

**Aggregate confidence** is computed from multiple signals:
- Detection confidence (calibrated) across all active cameras
- Depth estimation consistency (cross-method agreement)
- Temporal consistency (do detections persist across frames)
- Coverage (what fraction of the safety-critical zone has valid perception)

### 5.5 Reliability Diagrams

A reliability diagram plots predicted confidence against actual accuracy (fraction of detections that are correct at each confidence level). For a perfectly calibrated model, this is a diagonal line.

```
Typical reliability diagram for camera-only 3D detection (airside):

Actual   |
Accuracy |
  1.0    |                                          * (LiDAR)
         |                                     *
  0.8    |                                *
         |                           *
  0.6    |                      *
         |      * (Camera)  *
  0.4    |   *          *
         |  *       *
  0.2    | *    *
         |*  *
  0.0    +--*---------------------------------
         0.0  0.2  0.4  0.6  0.8  1.0
              Predicted Confidence

Before calibration: Camera detections are overconfident
(curve below diagonal). A 0.8 confidence detection is
actually correct only ~0.6 of the time.

After temperature scaling (T~1.5): The curve shifts closer
to the diagonal. Now 0.6 confidence means ~0.6 actual accuracy.
```

---

## 6. Thermal Stress and Calibration

### 6.1 Camera Intrinsic and Extrinsic Drift

Airport airside vehicles experience extreme thermal cycling:

| Scenario | Temperature | Duration |
|---|---|---|
| Cold morning startup (northern airport, winter) | -20 to -30C | 1-3 hours |
| Parked on sun-exposed tarmac (summer) | +50 to +60C surface | 2-6 hours |
| Transition from cold exterior to heated hangar | -20C to +20C in 10 min | Rapid |
| Engine exhaust proximity | Ambient +100-200C radiative | Minutes |
| Night operation after hot day | +40C to +5C over 4 hours | Gradual |

**Intrinsic drift** affects focal length and principal point:
- Typical automotive camera: focal length shifts 0.5-2.0 pixels per 10C temperature change
- At 1920x1080, a 2-pixel focal length shift causes ~0.2% depth error at 10m (negligible) but compounds with distance
- Lens barrel expansion shifts principal point by 0.3-1.0 pixels per 10C

**Extrinsic drift** (camera position/orientation relative to vehicle body) is more severe:
- Metal mounting brackets expand ~12um/m/C (steel) to ~23um/m/C (aluminum)
- A 0.5m mounting arm in aluminum shifts 0.7mm over a 60C range
- At 1m baseline stereo, 0.7mm displacement causes 0.07% baseline error (acceptable)
- But angular drift from bracket flex is more damaging: 0.1-degree pitch shift causes 0.17m depth error at 10m

### 6.2 Online Self-Calibration Methods

For degraded mode, online self-calibration ensures camera parameters remain accurate despite thermal drift.

**Ground plane estimation**: The apron is approximately flat. By estimating the ground plane from detected ground points in each frame, the system can continuously correct camera pitch and roll:

```python
import numpy as np
from typing import Tuple, Optional

class OnlineCameraCalibrator:
    """
    Continuous self-calibration using ground plane constraint.
    
    The airport apron is approximately flat. By tracking the apparent
    ground plane position across frames, we detect and correct
    extrinsic drift (primarily pitch and roll).
    """
    def __init__(self, camera_height: float = 2.0, 
                 alpha: float = 0.02,
                 max_correction_deg: float = 1.0):
        """
        Args:
            camera_height: Nominal camera height above ground (meters)
            alpha: Exponential moving average weight (lower = more stable)
            max_correction_deg: Maximum allowed correction per axis (safety limit)
        """
        self.camera_height = camera_height
        self.alpha = alpha
        self.max_correction = np.radians(max_correction_deg)
        self.pitch_correction = 0.0  # Accumulated pitch correction (radians)
        self.roll_correction = 0.0   # Accumulated roll correction (radians)
        
    def estimate_ground_plane(self, depth_map: np.ndarray, 
                               camera_matrix: np.ndarray) -> Optional[Tuple[float, float]]:
        """
        Estimate pitch and roll from ground plane in depth map.
        
        Uses RANSAC to fit a plane to the lower portion of the depth map
        (which should be ground). Returns pitch and roll deviations from
        the expected ground plane.
        
        Args:
            depth_map: Dense depth map [H, W] in meters
            camera_matrix: 3x3 intrinsic matrix
        
        Returns:
            (pitch_error, roll_error) in radians, or None if estimation fails
        """
        h, w = depth_map.shape
        
        # Sample points from lower third of image (likely ground)
        ground_region = depth_map[int(0.6*h):, :]
        
        # Back-project to 3D
        v_coords, u_coords = np.where(ground_region > 0.5)  # Valid depths > 0.5m
        v_coords = v_coords + int(0.6 * h)  # Adjust for crop offset
        
        if len(u_coords) < 100:
            return None  # Insufficient ground points
        
        # Sample subset for speed
        idx = np.random.choice(len(u_coords), min(1000, len(u_coords)), replace=False)
        u = u_coords[idx].astype(np.float64)
        v = v_coords[idx].astype(np.float64)
        d = depth_map[v_coords[idx], u_coords[idx]]
        
        fx, fy = camera_matrix[0, 0], camera_matrix[1, 1]
        cx, cy = camera_matrix[0, 2], camera_matrix[1, 2]
        
        # Back-project to camera frame
        x = (u - cx) * d / fx
        y = (v - cy) * d / fy
        z = d
        
        points_3d = np.stack([x, y, z], axis=1)
        
        # RANSAC plane fit
        best_normal = None
        best_inliers = 0
        
        for _ in range(50):
            sample_idx = np.random.choice(len(points_3d), 3, replace=False)
            p1, p2, p3 = points_3d[sample_idx]
            
            normal = np.cross(p2 - p1, p3 - p1)
            norm = np.linalg.norm(normal)
            if norm < 1e-6:
                continue
            normal = normal / norm
            
            # Ensure normal points upward (y-axis in camera frame)
            if normal[1] > 0:
                normal = -normal
            
            d_plane = -np.dot(normal, p1)
            distances = np.abs(np.dot(points_3d, normal) + d_plane)
            inliers = np.sum(distances < 0.1)  # 10cm threshold
            
            if inliers > best_inliers:
                best_inliers = inliers
                best_normal = normal
        
        if best_normal is None or best_inliers < 50:
            return None
        
        # Expected ground plane normal in camera frame: [0, -1, 0]
        # (camera y-axis points down, ground normal points up)
        expected_normal = np.array([0, -1, 0], dtype=np.float64)
        
        # Pitch error: deviation in the y-z plane
        pitch_error = np.arctan2(best_normal[2], -best_normal[1]) 
        
        # Roll error: deviation in the x-y plane
        roll_error = np.arctan2(best_normal[0], -best_normal[1])
        
        return (pitch_error, roll_error)
    
    def update(self, depth_map: np.ndarray, 
               camera_matrix: np.ndarray) -> Tuple[float, float]:
        """
        Update calibration correction from new frame.
        
        Returns current (pitch_correction, roll_correction) in radians.
        """
        result = self.estimate_ground_plane(depth_map, camera_matrix)
        
        if result is not None:
            pitch_err, roll_err = result
            
            # Exponential moving average update
            self.pitch_correction = (1 - self.alpha) * self.pitch_correction + self.alpha * pitch_err
            self.roll_correction = (1 - self.alpha) * self.roll_correction + self.alpha * roll_err
            
            # Clamp to safety limits
            self.pitch_correction = np.clip(self.pitch_correction, 
                                           -self.max_correction, self.max_correction)
            self.roll_correction = np.clip(self.roll_correction,
                                          -self.max_correction, self.max_correction)
        
        return (self.pitch_correction, self.roll_correction)
```

### 6.3 Protective Housing Design

For airside deployment, camera housings must address:

| Threat | Solution | Cost Impact |
|---|---|---|
| De-icing glycol coating | Heated hydrophobic optical window + compressed air wiper | +$200-400/unit |
| Jet exhaust heat | Insulated housing with thermal barrier | +$100-200/unit |
| Rain/snow | IP67+ housing with heated window (anti-fogging) | Standard |
| Solar loading (hot tarmac) | Active ventilation or Peltier cooling for sensor board | +$150-300/unit |
| Vibration (rough apron surface) | Vibration-isolated mount with anti-resonance damping | +$50-100/unit |
| FOD impact | Polycarbonate protective shield (replaceable) | +$30-50/unit |

**Total camera protection cost**: ~$500-1000 per camera unit for full airside-grade protection, on top of the camera hardware cost. For a 6-8 camera configuration, this adds $3,000-8,000 to the vehicle BOM.

---

## 7. Degraded Mode Architecture

### 7.1 Simplex Integration

The Aurrigo stack uses a Simplex architecture with dual channels:
- **AC (Advanced Controller)**: High-performance perception/planning (normally LiDAR+AI)
- **BC (Baseline Controller)**: Verified fallback (classical Frenet planner + safety bounds)

Camera fallback perception operates as a **degraded AC** that feeds into the existing BC safety envelope. The architecture ensures that even when running camera-only perception, the BC's safety invariants (speed limits, geofence, minimum stopping distance) are always enforced.

```
Normal Mode:
┌──────────────────┐     ┌──────────────────┐
│ LiDAR Perception │────>│ AC: World Model   │──> Trajectory
│ + Camera Fusion  │     │ + Neural Planner  │    (validated by BC)
└──────────────────┘     └──────────────────┘

Degraded Mode (Camera Fallback):
┌──────────────────┐     ┌──────────────────┐
│ Camera-Only      │────>│ Degraded AC:      │──> Trajectory
│ Depth + Detection│     │ Conservative Plan │    (validated by BC
│ + Confidence     │     │ + Speed Limit     │     with tighter bounds)
└──────────────────┘     └──────────────────┘

Failure Mode (All Perception Degraded):
┌──────────────────┐
│ BC: Safe Stop    │──> Controlled deceleration to standstill
│ (no perception   │    Hazard lights, teleop handover
│  required)       │
└──────────────────┘
```

### 7.2 Degraded Mode Manager

```python
#!/usr/bin/env python
"""
degraded_mode_manager.py

ROS node that monitors sensor health and manages transitions between
normal, degraded, and failure perception modes.

Subscribes to:
    /lidar/diagnostics     - Per-LiDAR health status
    /camera/diagnostics    - Per-camera health status  
    /perception/confidence - Aggregate perception confidence

Publishes:
    /degraded_mode/status  - Current degradation level and active perception stack
    /degraded_mode/speed_limit - Maximum allowed ego speed (m/s)
    /degraded_mode/alerts  - Human-readable status for teleop/HMI

Parameters:
    ~lidar_count: Number of expected LiDAR units (default: 4)
    ~camera_count: Number of expected cameras (default: 6)
    ~confidence_window: Sliding window for confidence averaging (default: 10 frames)
"""

import rospy
import numpy as np
from enum import IntEnum
from collections import deque
from std_msgs.msg import Float32, String, UInt8
from diagnostic_msgs.msg import DiagnosticArray, DiagnosticStatus


class DegradationLevel(IntEnum):
    """Perception degradation levels."""
    NORMAL = 0          # All sensors operational
    PARTIAL_LIDAR = 1   # 1-2 LiDAR degraded, camera supplements
    MAJOR_LIDAR = 2     # 3+ LiDAR degraded, camera primary for affected zones
    CAMERA_ONLY = 3     # All LiDAR offline, full camera fallback
    MINIMAL = 4         # LiDAR + partial camera failure
    BLIND = 5           # Insufficient perception for any operation


class DegradedModeManager:
    """
    Manages perception mode transitions based on sensor health.
    
    Key design principles:
    1. Transitions to degraded mode are FAST (within 100ms of detection)
    2. Transitions back to normal mode are SLOW (require sustained good health)
    3. Speed limits are MONOTONICALLY decreasing with degradation level
    4. Safe stop is ALWAYS available regardless of perception state
    """
    
    # Speed limits per degradation level (m/s)
    # Airside max is typically 15 km/h = 4.17 m/s
    SPEED_LIMITS = {
        DegradationLevel.NORMAL:        4.17,   # 15 km/h (airside max)
        DegradationLevel.PARTIAL_LIDAR: 2.78,   # 10 km/h
        DegradationLevel.MAJOR_LIDAR:   1.39,   # 5 km/h
        DegradationLevel.CAMERA_ONLY:   0.83,   # 3 km/h
        DegradationLevel.MINIMAL:       0.28,   # 1 km/h (crawl to safe stop)
        DegradationLevel.BLIND:         0.00,   # Stop
    }
    
    # Minimum sustained frames before upgrading degradation level
    UPGRADE_HYSTERESIS = {
        DegradationLevel.NORMAL:        50,   # 5 seconds at 10Hz
        DegradationLevel.PARTIAL_LIDAR: 30,   # 3 seconds
        DegradationLevel.MAJOR_LIDAR:   30,
        DegradationLevel.CAMERA_ONLY:   20,
        DegradationLevel.MINIMAL:       10,
    }
    
    def __init__(self):
        rospy.init_node('degraded_mode_manager')
        
        self.lidar_count = rospy.get_param('~lidar_count', 4)
        self.camera_count = rospy.get_param('~camera_count', 6)
        conf_window = rospy.get_param('~confidence_window', 10)
        
        # Sensor health tracking
        self.lidar_health = {}    # {sensor_id: DiagnosticStatus.level}
        self.camera_health = {}   # {sensor_id: DiagnosticStatus.level}
        
        # Confidence tracking
        self.confidence_buffer = deque(maxlen=conf_window)
        self.aggregate_confidence = 0.0
        
        # State
        self.current_level = DegradationLevel.NORMAL
        self.upgrade_counter = 0  # Frames of sustained better health
        self.last_transition_time = rospy.Time.now()
        
        # Publishers
        self.pub_status = rospy.Publisher('/degraded_mode/status', UInt8, queue_size=1)
        self.pub_speed = rospy.Publisher('/degraded_mode/speed_limit', Float32, queue_size=1)
        self.pub_alert = rospy.Publisher('/degraded_mode/alerts', String, queue_size=10)
        
        # Subscribers
        rospy.Subscriber('/lidar/diagnostics', DiagnosticArray, self.lidar_diag_cb)
        rospy.Subscriber('/camera/diagnostics', DiagnosticArray, self.camera_diag_cb)
        rospy.Subscriber('/perception/confidence', Float32, self.confidence_cb)
        
        # 10 Hz control loop
        self.timer = rospy.Timer(rospy.Duration(0.1), self.update)
        
        rospy.loginfo(f"DegradedModeManager initialized: "
                      f"{self.lidar_count} LiDAR, {self.camera_count} cameras")
    
    def lidar_diag_cb(self, msg):
        """Update LiDAR health from diagnostics."""
        for status in msg.status:
            self.lidar_health[status.name] = status.level
    
    def camera_diag_cb(self, msg):
        """Update camera health from diagnostics."""
        for status in msg.status:
            self.camera_health[status.name] = status.level
    
    def confidence_cb(self, msg):
        """Update perception confidence."""
        self.confidence_buffer.append(msg.data)
        if len(self.confidence_buffer) > 0:
            self.aggregate_confidence = np.mean(self.confidence_buffer)
    
    def count_healthy_sensors(self):
        """Count operational LiDAR and cameras."""
        healthy_lidar = sum(
            1 for level in self.lidar_health.values()
            if level == DiagnosticStatus.OK
        )
        healthy_cameras = sum(
            1 for level in self.camera_health.values()
            if level == DiagnosticStatus.OK
        )
        return healthy_lidar, healthy_cameras
    
    def compute_target_level(self) -> DegradationLevel:
        """
        Determine target degradation level from current sensor health
        and perception confidence.
        """
        healthy_lidar, healthy_cameras = self.count_healthy_sensors()
        degraded_lidar = self.lidar_count - healthy_lidar
        
        # Decision tree
        if healthy_cameras < 2:
            # Cannot maintain perception with <2 cameras
            return DegradationLevel.BLIND
        
        if healthy_lidar == 0 and healthy_cameras < 3:
            # No LiDAR and minimal cameras
            return DegradationLevel.MINIMAL
        
        if healthy_lidar == 0:
            # No LiDAR, but sufficient cameras
            return DegradationLevel.CAMERA_ONLY
        
        if degraded_lidar >= 3:
            return DegradationLevel.MAJOR_LIDAR
        
        if degraded_lidar >= 1:
            return DegradationLevel.PARTIAL_LIDAR
        
        # All sensors healthy -- also check confidence
        if self.aggregate_confidence < 0.5:
            # Sensors report OK but perception confidence is low
            # (e.g., jet exhaust distortion, severe weather)
            return DegradationLevel.MAJOR_LIDAR
        
        return DegradationLevel.NORMAL
    
    def update(self, event):
        """Main control loop: update degradation level and publish."""
        target = self.compute_target_level()
        
        if target > self.current_level:
            # DOWNGRADE: immediate (safety-critical)
            self.current_level = target
            self.upgrade_counter = 0
            self.last_transition_time = rospy.Time.now()
            
            self.pub_alert.publish(String(
                data=f"DEGRADED: Level {self.current_level.name} "
                     f"(speed limit: {self.SPEED_LIMITS[self.current_level]*3.6:.0f} km/h)"
            ))
            rospy.logwarn(f"Perception degraded to {self.current_level.name}")
        
        elif target < self.current_level:
            # UPGRADE: requires sustained good health (hysteresis)
            self.upgrade_counter += 1
            required = self.UPGRADE_HYSTERESIS.get(target, 50)
            
            if self.upgrade_counter >= required:
                self.current_level = target
                self.upgrade_counter = 0
                self.last_transition_time = rospy.Time.now()
                
                self.pub_alert.publish(String(
                    data=f"RECOVERED: Level {self.current_level.name} "
                         f"(speed limit: {self.SPEED_LIMITS[self.current_level]*3.6:.0f} km/h)"
                ))
                rospy.loginfo(f"Perception recovered to {self.current_level.name}")
        else:
            self.upgrade_counter = 0
        
        # Publish current state
        self.pub_status.publish(UInt8(data=int(self.current_level)))
        self.pub_speed.publish(Float32(data=self.SPEED_LIMITS[self.current_level]))


if __name__ == '__main__':
    try:
        node = DegradedModeManager()
        rospy.spin()
    except rospy.ROSInterruptException:
        pass
```

### 7.3 Speed Reduction Policy

The speed limit in degraded mode is derived from the stopping distance equation. The vehicle must be able to stop within the reliable perception range of the active sensors.

**Stopping distance model:**

```
d_stop = v * t_react + v^2 / (2 * a_brake)

Where:
  v       = ego velocity (m/s)
  t_react = perception + planning + actuation delay (s)
  a_brake = deceleration capability (m/s^2)
```

**Aurrigo vehicle parameters (estimated):**

| Parameter | Normal Mode | Degraded Mode |
|---|---|---|
| Perception latency | 70ms | 100-150ms (camera pipeline slower) |
| Planning latency | 10ms | 10ms (same planner) |
| Actuation latency | 100ms | 100ms (same actuators) |
| Total reaction time | 180ms | 210-260ms |
| Max braking deceleration | 3.0 m/s^2 | 3.0 m/s^2 (same brakes) |
| Safety factor | 1.5x | 2.0x (less perception confidence) |

**Speed vs perception range mapping:**

```python
def max_safe_speed(perception_range_m: float, 
                   reaction_time_s: float = 0.25,
                   brake_decel_ms2: float = 3.0,
                   safety_factor: float = 2.0) -> float:
    """
    Compute maximum safe speed given reliable perception range.
    
    Solves: perception_range >= safety_factor * (v*t + v^2/(2*a))
    
    For v: d = sf * (v*t + v^2/(2*a))
           v^2/(2*a) + v*t - d/sf = 0
           v = -t*a + sqrt((t*a)^2 + 2*a*d/sf)   [quadratic formula, positive root]
    
    Args:
        perception_range_m: Reliable detection range in meters
        reaction_time_s: Total system reaction time
        brake_decel_ms2: Maximum braking deceleration
        safety_factor: Multiplier on stopping distance (>1 for margin)
    
    Returns:
        Maximum safe speed in m/s
    """
    d = perception_range_m
    t = reaction_time_s
    a = brake_decel_ms2
    sf = safety_factor
    
    # Quadratic formula
    discriminant = (t * a) ** 2 + 2 * a * d / sf
    if discriminant < 0:
        return 0.0
    
    v_max = -t * a + (discriminant ** 0.5)
    return max(0.0, v_max)
```

**Resulting speed limits by perception mode:**

| Perception Mode | Reliable Range | Reaction Time | Safety Factor | Max Speed | Max Speed (km/h) |
|---|---|---|---|---|---|
| LiDAR (normal) | 60m | 0.18s | 1.5x | 5.8 m/s | 20.9 km/h |
| LiDAR partial (1-2 degraded) | 40m | 0.20s | 1.5x | 4.7 m/s | 16.8 km/h |
| Camera-only (multi-cam BEV) | 25m | 0.25s | 2.0x | 2.8 m/s | 10.1 km/h |
| Camera-only (monocular) | 15m | 0.25s | 2.0x | 1.9 m/s | 6.7 km/h |
| Minimal (2-3 cameras only) | 8m | 0.30s | 2.5x | 0.9 m/s | 3.3 km/h |

**Note**: The airside speed limit is typically 15 km/h (4.17 m/s). Even in normal mode with LiDAR, the theoretical max safe speed exceeds the operational limit, providing margin. In camera-only mode, the physics-derived limit (10 km/h) aligns well with the operational speed restrictions in the degraded mode table.

### 7.4 ROS Node Structure for Graceful Transition

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     DEGRADED MODE PERCEPTION PIPELINE                       │
│                                                                             │
│  ┌──────────────────┐                                                       │
│  │ Sensor Health     │  Monitors all LiDAR and cameras at 10Hz              │
│  │ Monitor           │  Publishes: /sensor_health/summary                   │
│  └────────┬─────────┘                                                       │
│           │                                                                 │
│           ▼                                                                 │
│  ┌──────────────────┐                                                       │
│  │ Degraded Mode     │  Decision: which perception stack to activate        │
│  │ Manager           │  Publishes: /degraded_mode/status, /speed_limit      │
│  └────────┬─────────┘                                                       │
│           │                                                                 │
│           ├──────────────────────────────┐                                   │
│           │ (activates on CAMERA_ONLY)   │                                   │
│           ▼                              ▼                                   │
│  ┌──────────────────┐       ┌──────────────────┐                            │
│  │ Camera Depth      │       │ Camera 3D         │                           │
│  │ Node              │       │ Detection Node    │                           │
│  │ (DepthAnything)   │       │ (BEVFormer-Tiny)  │                           │
│  │ ~15ms             │       │ ~35-50ms          │                           │
│  └────────┬─────────┘       └────────┬──────────┘                           │
│           │                          │                                       │
│           ▼                          ▼                                       │
│  ┌──────────────────┐       ┌──────────────────┐                            │
│  │ Pseudo-LiDAR     │       │ Camera Tracking   │                           │
│  │ Generator         │       │ (reuses existing  │                           │
│  │ (depth → 3D pts)  │       │  Kalman tracker)  │                           │
│  └────────┬─────────┘       └────────┬──────────┘                           │
│           │                          │                                       │
│           └──────────┬───────────────┘                                       │
│                      ▼                                                       │
│           ┌──────────────────┐                                              │
│           │ Confidence        │                                              │
│           │ Aggregator        │  Calibrated confidence + speed limit         │
│           └────────┬─────────┘                                              │
│                    │                                                         │
│                    ▼                                                         │
│           ┌──────────────────┐                                              │
│           │ Degraded          │  Same interface as normal perception output  │
│           │ Perception Output │  (/perception/objects, /perception/occupancy)│
│           └──────────────────┘                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

Key design decisions:

1. **Camera nodes are always running** (not cold-started on failure): The camera depth and detection nodes run continuously at low priority, warming the TensorRT engines. On LiDAR failure, the system only needs to switch which output the planner consumes, not start new inference pipelines.

2. **Same output interface**: The degraded perception pipeline publishes to the same ROS topics as the normal pipeline (`/perception/objects`, `/perception/occupancy`). The planner does not need to know whether its input came from LiDAR or camera -- it only sees the confidence field and the speed limit.

3. **Transition is atomic**: The degraded mode manager publishes a single topic switch message. There is no partial state where the planner sees half-LiDAR half-camera data.

### 7.5 Decision Tree for Sensor Availability

```
START: Evaluate sensor health
│
├─ All LiDAR healthy?
│   ├─ YES: Check perception confidence
│   │   ├─ Confidence > 0.7: NORMAL MODE (15 km/h)
│   │   └─ Confidence <= 0.7: ENVIRONMENTAL DEGRADATION
│   │       └─ Camera supplements LiDAR (10 km/h)
│   │
│   └─ NO: Count degraded LiDAR
│       ├─ 1-2 degraded: PARTIAL LIDAR
│       │   ├─ Camera covers blind spots
│       │   └─ Speed: 10 km/h
│       │
│       ├─ 3+ degraded: MAJOR LIDAR LOSS
│       │   ├─ Camera becomes primary for affected zones
│       │   └─ Speed: 5 km/h
│       │
│       └─ All degraded: ALL LIDAR OFFLINE
│           ├─ Check cameras
│           │   ├─ >= 4 cameras healthy: CAMERA ONLY (3 km/h)
│           │   ├─ 2-3 cameras healthy: MINIMAL (1 km/h, crawl to stop)
│           │   └─ < 2 cameras healthy: BLIND (immediate stop)
│           └─ Notify teleop immediately
│
└─ Any camera unhealthy?
    └─ Reduced redundancy warning (log, do not change mode if LiDAR healthy)
```

---

## 8. Practical Deployment on Orin

### 8.1 Compute Budget for Camera Fallback Pipeline

The camera fallback pipeline must fit within the 100ms perception cycle on NVIDIA Orin AGX (275 TOPS INT8, 64GB unified memory). The normal LiDAR pipeline uses approximately 70ms and 5.1GB (see `30-autonomy-stack/perception/overview/model-compression-edge-deployment.md`). In camera-only mode, the LiDAR pipeline is inactive, freeing its compute budget for camera models.

**Camera fallback pipeline budget:**

```
┌─────────────────────────────────────────┬──────────┬──────────┐
│ Component                                │ Latency  │ Memory   │
├─────────────────────────────────────────┼──────────┼──────────┤
│ Image preprocessing (6 cameras)          │ 3ms      │ 0.3 GB   │
│ DepthAnything v2 Small (INT8)            │ 15ms     │ 0.8 GB   │
│   (runs on 2-3 cameras, alternating)     │          │          │
│ BEVFormer-Tiny (FP16, 6 cameras)         │ 40ms     │ 2.5 GB   │
│   (3D detection + BEV features)          │          │          │
│ Pseudo-LiDAR generation                  │ 5ms      │ 0.4 GB   │
│   (depth map → 3D point cloud)           │          │          │
│ Camera tracking (Kalman + Hungarian)      │ 3ms      │ 0.2 GB   │
│ Confidence calibration + aggregation      │ 1ms      │ 0.1 GB   │
│ Occupancy estimation (cost volume)        │ 10ms     │ 0.8 GB   │
│ Localization (GTSAM — unchanged)          │ 8ms      │ 0.5 GB   │
│ Planning (Frenet — unchanged)             │ 5ms      │ 0.3 GB   │
│ Safety monitoring                         │ 2ms      │ 0.1 GB   │
├─────────────────────────────────────────┼──────────┼──────────┤
│ TOTAL                                    │ 92ms     │ 6.0 GB   │
│ Headroom                                 │ 8ms      │ 58.0 GB  │
└─────────────────────────────────────────┴──────────┴──────────┘
```

**Key optimization: pipeline parallelism.** DepthAnything and BEVFormer can run concurrently on separate CUDA streams since they consume the same images but produce independent outputs. With stream parallelism, the effective latency becomes max(15ms, 40ms) + sequential components = ~60ms total, providing comfortable margin.

### 8.2 DepthAnything v2 on Orin

**Model conversion pipeline:**

```bash
# 1. Export DepthAnything v2 Small to ONNX
python export_onnx.py --model depth_anything_v2_vits \
    --input-size 518 518 \
    --output depth_anything_v2_s.onnx

# 2. Convert to TensorRT with INT8 calibration
/usr/src/tensorrt/bin/trtexec \
    --onnx=depth_anything_v2_s.onnx \
    --int8 \
    --calib=calibration_data/ \
    --saveEngine=depth_anything_v2_s_int8.engine \
    --workspace=4096 \
    --inputIOFormats=fp16:chw \
    --outputIOFormats=fp16:chw \
    --minShapes=input:1x3x518x518 \
    --optShapes=input:1x3x518x518 \
    --maxShapes=input:2x3x518x518

# 3. Benchmark
/usr/src/tensorrt/bin/trtexec \
    --loadEngine=depth_anything_v2_s_int8.engine \
    --iterations=100 --warmUp=10
# Expected: ~12-18ms median latency on Orin AGX 64GB
```

**INT8 calibration data**: Use 500-1000 representative images from the target deployment environment (airport apron in various lighting/weather conditions). Include images with:
- Empty tarmac (featureless surfaces)
- Aircraft at various distances (10-100m)
- Personnel and GSE
- Night conditions
- Wet surface reflections

**Accuracy impact of INT8 quantization**: Based on DepthAnything v2 community benchmarks, INT8 PTQ increases absolute relative error by approximately 0.3-0.5% compared to FP32 (e.g., from 4.8% to 5.1-5.3% on KITTI). This is acceptable for fallback use.

### 8.3 BEVFormer-Tiny on Orin

BEVFormer-Tiny (ResNet-50 backbone, 6 cameras, 200x200 BEV grid) is the smallest BEVFormer variant suitable for multi-camera 3D detection.

**Expected performance on Orin:**

| Precision | Latency | Memory | NDS (nuScenes) |
|---|---|---|---|
| FP32 | ~120ms | 4.5 GB | 37.0 |
| FP16 | ~45ms | 2.8 GB | 36.8 |
| INT8 (PTQ) | ~30ms | 2.0 GB | 34.5 (-2.5) |
| INT8 (QAT) | ~30ms | 2.0 GB | 35.8 (-1.2) |

**Recommendation**: Use FP16 for the fallback pipeline. The 45ms latency fits within the budget with stream parallelism, and the 0.2 NDS loss from FP16 is negligible compared to the inherent camera-only accuracy gap. INT8 is available if additional compute is needed for other components.

**TensorRT conversion notes:**
- BEVFormer uses deformable attention, which requires custom CUDA kernels for TensorRT. The community has produced working plugins (see BEVFormer-TensorRT repositories on GitHub).
- Temporal attention across frames requires careful handling of the TensorRT engine state (BEV query buffer must persist between inference calls).
- Batch the 6 camera images into a single tensor to maximize GPU utilization.

### 8.4 Camera-Only Occupancy Without Learned Models

If the compute budget does not allow a learned occupancy model, geometric methods can produce coarse 3D occupancy from camera depth maps:

**Plane sweeping stereo** (if stereo cameras available):
1. For each depth hypothesis d in [d_min, d_max]:
   - Project a fronto-parallel plane at depth d into both camera views
   - Compute photometric consistency (NCC or SAD) between warped patches
2. Select depth with highest consistency per pixel
3. Convert depth map to 3D point cloud and voxelize

**Monocular depth to occupancy** (if monocular only):
1. Run DepthAnything v2 to get dense depth map
2. Back-project depth map to 3D point cloud using camera intrinsics
3. Voxelize the point cloud into a 3D grid (e.g., 0.4m resolution)
4. Apply free-space carving: cells between the camera and a surface point are free
5. Cells behind surface points are unknown (not occupied -- unknown)
6. Apply ground plane removal to separate traversable surface from obstacles

**Cost volume approach** (multi-camera, no learned weights):
1. For each BEV cell (x, y) at the ground plane:
   - Project to all cameras that observe this cell
   - Extract image features (can be simple color/gradient, or DINOv2 features)
   - Compute multi-view consistency
2. Cells with consistent features across cameras at a specific height are occupied
3. This is essentially a classical multi-view stereo approach applied to BEV space

**Performance**: Geometric methods run at 5-15ms on Orin (depending on resolution and number of cameras) since they do not require neural network inference. Accuracy is significantly worse than learned methods (no semantic understanding), but sufficient for binary obstacle/free-space classification at close range (<20m).

### 8.5 Combined Pipeline Timing Diagram

```
Time (ms):   0    10    20    30    40    50    60    70    80    90   100
             │     │     │     │     │     │     │     │     │     │     │
Camera in:   ├─────┤
             │ Preproc (3ms)
             │
Stream A:    │     ├──────────────────────────────────────────┤
(GPU)        │     │  BEVFormer-Tiny FP16 (40ms)              │
             │     │                                          │
Stream B:    │     ├────────────────┤                          │
(GPU)        │     │ DepthAnything  │                          │
             │     │ v2 INT8 (15ms) │                          │
             │     │                ├──────┤                   │
             │     │                │PseudoL│ (5ms)            │
             │     │                │ iDAR  │                  │
             │                                                │
Stream C:    │                                                ├─────┤
(GPU)        │                                                │Occup│ (10ms)
             │                                                │ancy │
             │                                                │     │
CPU:         │                                                      ├────────┤
             │                                                      │Tracking│(3ms)
             │                                                      │Confid. │(1ms)
             │                                                      │GTSAM   │(8ms)
             │                                                      │Frenet  │(5ms)
             │                                                      │Safety  │(2ms)
             │                                                               │
Output:      │                                                               ├─▶
             │                                                      ~81ms total
```

With pipeline parallelism, the camera fallback pipeline completes in approximately 80ms, providing 20ms of headroom within the 100ms cycle.

---

## 9. Testing and Validation

### 9.1 Degraded Mode Testing Strategy

Testing camera fallback requires systematically injecting LiDAR failures and validating that the camera-only pipeline maintains safe operation.

**Test categories:**

| Test Type | Method | Pass Criteria |
|---|---|---|
| **Hardware-in-loop LiDAR failure** | Disconnect LiDAR units during operation | Mode transition within 100ms, no unsafe trajectory |
| **Simulated degradation** | Inject increasing noise/dropout into LiDAR topic | Gradual speed reduction matches degradation level |
| **Camera-only detection accuracy** | Run detection pipeline on airside test images (no LiDAR) | mAP > 30% for personnel at 20m |
| **Speed reduction validation** | Verify stopping distance at degraded speed limits | Vehicle stops within reliable perception range |
| **Transition hysteresis** | Rapidly toggle LiDAR availability | No oscillation between modes (hysteresis works) |
| **Thermal calibration drift** | Operate across temperature range (-20 to +50C) | Depth error increase < 20% relative to calibrated baseline |
| **De-icing simulation** | Spray glycol solution on LiDAR windows | Detection of degradation within 30 seconds |
| **Night camera-only** | Run camera fallback pipeline in darkness | Thermal camera maintains personnel detection |
| **Safe stop from blind** | Kill all LiDAR and most cameras simultaneously | Vehicle stops within 2m of failure point at degraded speed |

### 9.2 Metrics for Degraded Mode Acceptance

| Metric | Normal Mode Target | Degraded Mode Target | Rationale |
|---|---|---|---|
| Personnel detection recall (20m) | >95% | >80% | Lower recall acceptable because speed is reduced |
| False positive rate | <2% | <5% | Higher false positives cause unnecessary stops, not unsafe |
| 3D localization error (10m) | <0.3m | <1.0m | Wider corridor for reduced-speed operation |
| Mode transition latency | N/A | <100ms | Must not operate at normal speed with degraded perception |
| Speed limit enforcement | Always | Always | Non-negotiable safety invariant |
| Safe stop availability | Always | Always | Non-negotiable safety invariant |

### 9.3 Regression Testing with Recorded Data

Maintain a library of recorded test scenarios (rosbags) that include:

1. **Normal operation baselines**: LiDAR + camera data with ground truth annotations. Use LiDAR as ground truth for camera-only evaluation.
2. **Real degradation events**: Record actual glycol exposure, jet exhaust encounters, and sensor faults. These become regression test inputs.
3. **Synthetic degradation**: Take normal recordings and programmatically remove/corrupt LiDAR data to test camera-only pipeline on the same scenes.

```bash
# Record a test scenario with all sensors
rosbag record -O test_scenario_001.bag \
    /lidar_front/points_raw /lidar_rear/points_raw \
    /lidar_left/points_raw /lidar_right/points_raw \
    /camera_front/image_raw /camera_rear/image_raw \
    /camera_left/image_raw /camera_right/image_raw \
    /imu/data /gps/fix /vehicle/odom \
    --duration=120

# Replay with LiDAR topics removed to test camera fallback
rosbag play test_scenario_001.bag \
    --topics /camera_front/image_raw /camera_rear/image_raw \
             /camera_left/image_raw /camera_right/image_raw \
             /imu/data /gps/fix /vehicle/odom
```

---

## 10. Recommended Implementation Roadmap

### Phase 1: Sensor Health Monitoring (2-4 weeks)

**Goal**: Detect LiDAR degradation reliably before building camera fallback.

- Implement per-LiDAR health diagnostics (point count, range statistics, return intensity)
- Build the degraded mode manager (Section 7.2) with speed reduction only (no camera perception yet)
- On LiDAR failure: reduce speed and alert teleop (existing behavior, now formalized)
- **Deliverable**: Degraded mode manager ROS node, tested with hardware-in-loop LiDAR disconnection

### Phase 2: Camera Depth Integration (4-6 weeks)

**Goal**: Monocular depth running on Orin as supplementary data source.

- Deploy DepthAnything v2 Small (INT8) on Orin via TensorRT
- Build pseudo-LiDAR generator (depth map to 3D point cloud)
- Integrate with existing 3D occupancy pipeline (nvblox or voxel grid)
- Validate depth accuracy on airside test data
- **Deliverable**: Camera depth node publishing pseudo-LiDAR, benchmarked against real LiDAR ground truth

### Phase 3: Camera 3D Detection (6-10 weeks)

**Goal**: Multi-camera 3D object detection as fallback perception.

- Deploy BEVFormer-Tiny (FP16) on Orin via TensorRT
- Train/fine-tune on airside data (if available) or validate zero-shot on airport imagery
- Implement confidence calibration (temperature scaling, per-class)
- Build camera tracking node (reuse existing Kalman tracker with camera detections)
- **Deliverable**: Camera-only 3D detection pipeline, accuracy benchmarked against LiDAR detections

### Phase 4: Full Degraded Mode Integration (4-6 weeks)

**Goal**: Seamless LiDAR-to-camera transition with validated safety properties.

- Integrate all camera perception nodes with degraded mode manager
- Implement pipeline parallelism (CUDA streams for concurrent depth + detection)
- Validate speed reduction policy against stopping distance requirements
- Thermal stress testing across temperature range
- **Deliverable**: Complete degraded mode system, tested in operational scenarios

### Phase 5: Stereo Depth Upgrade (Optional, 4-8 weeks)

**Goal**: Improve fallback accuracy with wide-baseline stereo.

- Install GMSL2 stereo pair(s) with custom baseline mounting
- Deploy HITNet or AANet stereo matching on Orin
- Compare stereo depth accuracy against monocular baseline
- Integrate stereo depth into fallback pipeline as accuracy upgrade
- **Deliverable**: Stereo-augmented camera fallback with improved range accuracy

### Cost Estimate

| Phase | Hardware | Engineering Time | Total |
|---|---|---|---|
| Phase 1 | None (software only) | 2-4 weeks @ 1 engineer | $5K-10K |
| Phase 2 | None (existing cameras) | 4-6 weeks @ 1 engineer | $10K-15K |
| Phase 3 | None (existing cameras) | 6-10 weeks @ 1 engineer | $15K-25K |
| Phase 4 | Test equipment | 4-6 weeks @ 1 engineer | $10K-15K |
| Phase 5 | $2K-4K cameras + mounts | 4-8 weeks @ 1 engineer | $12K-24K |
| **Total (Phase 1-4)** | **Minimal** | **16-26 weeks** | **$40K-65K** |
| **Total (all phases)** | **$2K-4K** | **20-34 weeks** | **$52K-89K** |

---

## 11. References

### Monocular Depth Estimation

1. **Metric3D v2**: Hu et al., "Metric3D v2: A Versatile Monocular Geometric Foundation Model for Zero-Shot Metric Depth and Surface Normal Estimation," 2024. arXiv:2404.15506
2. **DepthAnything v2**: Yang et al., "Depth Anything V2," 2024. arXiv:2406.09414
3. **UniDepth**: Piccinelli et al., "UniDepth: Universal Monocular Metric Depth Estimation," CVPR 2024. arXiv:2403.18913
4. **ZoeDepth**: Bhat et al., "ZoeDepth: Zero-shot Transfer by Combining Relative and Metric Depth," 2023. arXiv:2302.12288
5. **MiDaS v3.1**: Ranftl et al., "Vision Transformers for Dense Prediction," ICCV 2021 (updated 2023). arXiv:2103.13413

### Stereo Depth

6. **RAFT-Stereo**: Lipson et al., "RAFT-Stereo: Multilevel Recurrent Field Transforms for Stereo Matching," 3DV 2022. arXiv:2109.07547
7. **CREStereo**: Li et al., "Practical Stereo Matching via Cascaded Recurrent Network with Adaptive Correlation," CVPR 2022. arXiv:2203.11483
8. **IGEV-Stereo**: Xu et al., "Iterative Geometry Encoding Volume for Stereo Matching," CVPR 2023. arXiv:2303.06615
9. **HITNet**: Tankovich et al., "HITNet: Hierarchical Iterative Tile Refinement Network for Real-time Stereo Matching," CVPR 2021. arXiv:2007.12140

### Camera-Only 3D Detection

10. **BEVDet**: Huang et al., "BEVDet: High-Performance Multi-Camera 3D Object Detection in Bird-Eye-View," 2022. arXiv:2112.11790
11. **BEVFormer**: Li et al., "BEVFormer: Learning Bird's-Eye-View Representation from Multi-Camera Images via Spatiotemporal Transformers," ECCV 2022. arXiv:2203.17270
12. **PETR v2**: Liu et al., "PETRv2: A Unified Framework for 3D Perception from Multi-Camera Images," ICCV 2023. arXiv:2206.01256
13. **StreamPETR**: Wang et al., "Exploring Object-Centric Temporal Modeling for Efficient Multi-View 3D Object Detection," ICCV 2023. arXiv:2303.11926
14. **Far3D**: Jiang et al., "Far3D: Expanding the Horizon for Surround-view 3D Object Detection," AAAI 2024. arXiv:2308.09616
15. **FCOS3D**: Wang et al., "FCOS3D: Fully Convolutional One-Stage Monocular 3D Object Detection," NeurIPS 2021. arXiv:2104.10956
16. **PGD**: Wang et al., "Probabilistic and Geometric Depth: Detecting Objects in Perspective," CoRL 2022. arXiv:2107.14160

### Confidence Calibration

17. **Temperature Scaling**: Guo et al., "On Calibration of Modern Neural Networks," ICML 2017. arXiv:1706.04599
18. **MC-Dropout**: Gal and Ghahramani, "Dropout as a Bayesian Approximation: Representing Model Uncertainty in Deep Learning," ICML 2016. arXiv:1506.02142
19. **Deep Ensembles**: Lakshminarayanan et al., "Simple and Scalable Predictive Uncertainty Estimation using Deep Ensembles," NeurIPS 2017. arXiv:1612.01474

### Safety and Degraded Mode Design

20. **ISO 3691-4:2023**: Industrial trucks — Safety requirements and verification — Part 4: Driverless industrial trucks and their systems
21. **ISO 26262:2018**: Road vehicles — Functional safety (Part 6: Product development at the software level)
22. **Simplex Architecture**: Sha, "Using Simplicity to Control Complexity," IEEE Software 2001

### Airside Environment

23. **SAE ARP4754A**: Guidelines for Development of Civil Aircraft and Systems (adapted for ground vehicle safety cases)
24. **FAA CertAlert 24-02**: Autonomous Vehicle Operations on Airport Airside (non-directive guidance)
25. **ICAO Annex 14**: Aerodrome Design and Operations (surface movement area specifications)

---

## Cross-References

- **Existing perception architecture**: `30-autonomy-stack/perception/overview/production-perception-systems.md`
- **BEV encoding details**: `30-autonomy-stack/perception/overview/bev-encoding.md`
- **Model compression for Orin**: `30-autonomy-stack/perception/overview/model-compression-edge-deployment.md`
- **Vision foundation models (DINOv2, SAM)**: `30-autonomy-stack/perception/overview/vision-foundation-models.md`
- **Thermal/IR cameras**: `20-av-platform/sensors/thermal-ir-cameras.md`
- **4D radar as backup**: `20-av-platform/sensors/4d-radar.md`
- **Simplex architecture**: `90-synthesis/decisions/design-spec.md`
- **Functional safety software**: `60-safety-validation/standards-certification/functional-safety-software.md`
- **Ground crew safety**: `70-operations-domains/airside/safety/ground-crew-pedestrian-safety.md`
- **Orin compute platform**: `hardware/compute/orin-compute-platform.md`
- **CenterPoint detection**: `30-autonomy-stack/perception/overview/openpcdet-centerpoint.md`
- **Multi-object tracking**: `30-autonomy-stack/perception/overview/multi-object-tracking.md`
