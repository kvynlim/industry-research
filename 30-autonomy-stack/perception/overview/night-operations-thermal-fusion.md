# Night Operations Perception and Thermal-LiDAR Fusion Architecture

> Comprehensive guide to perception system architecture for 24/7 airport airside operations with emphasis on night shifts (22:00-06:00) — covering thermal+LiDAR+radar multi-modal fusion architectures, thermal-specific detection models, the hi-vis paradox and its solution, night ground plane estimation, personnel detection and pose estimation from thermal imagery, thermal-LiDAR calibration, degraded-mode night perception, and night-specific benchmarking. Focused on solving the critical gap between daytime perception (well-documented) and nighttime perception (the missing 1/3 of airside operations).
>
> **Relation to existing docs**: Extends `thermal-ir-cameras.md` (sensor hardware, specs, cost — no fusion architecture), `camera-fallback-perception.md` (visible camera degraded mode, no thermal), `multi-task-unified-perception.md` (shared backbone architecture, daytime-focused), `sensor-fusion-architectures.md` (generic fusion, no thermal-specific), `ground-crew-pedestrian-safety.md` (documents the hi-vis paradox but doesn't solve it). This document provides the **perception algorithms and fusion architecture** needed to close the night operations gap.

**Key Takeaway**: Night operations represent 1/3 of airside activity but current perception stacks suffer catastrophic degradation: visible cameras fail in low light, and hi-vis retroreflective vests cause 84-88% AEB failure rate at night (overexposure blinds camera-based detection). Thermal cameras solve the hi-vis paradox entirely — they detect body heat regardless of clothing — but require a dedicated fusion architecture since thermal imagery has fundamentally different characteristics from visible (no color, no texture, low resolution 640×512). The recommended architecture is a **LiDAR-primary + thermal-augmented** pipeline where the thermal branch runs as a parallel "safety net" at 30 Hz, fusing with the LiDAR perception stack via late fusion (bounding box matching). This adds ~8ms to the perception pipeline on Orin (using INT8 YOLO-Thermal) and provides >95% personnel detection at night vs <60% with LiDAR-only at ranges beyond 30m. The critical implementation is thermal-LiDAR cross-modal calibration and temporal synchronization, which requires hardware PTP sync and a dedicated calibration target (heated plate).

---

## Table of Contents

1. [The Night Operations Challenge](#1-the-night-operations-challenge)
2. [Sensor Modality Comparison at Night](#2-sensor-modality-comparison-at-night)
3. [Thermal-Specific Perception Models](#3-thermal-specific-perception-models)
4. [The Hi-Vis Paradox and Solution](#4-the-hi-vis-paradox-and-solution)
5. [Thermal-LiDAR Fusion Architecture](#5-thermal-lidar-fusion-architecture)
6. [Night Ground Plane and Free Space](#6-night-ground-plane-and-free-space)
7. [Thermal-LiDAR Calibration](#7-thermal-lidar-calibration)
8. [Personnel Detection and Tracking at Night](#8-personnel-detection-and-tracking-at-night)
9. [Night-Specific Safety Applications](#9-night-specific-safety-applications)
10. [Degraded Night Mode Architecture](#10-degraded-night-mode-architecture)
11. [Benchmarking Night Perception](#11-benchmarking-night-perception)
12. [Practical Implementation](#12-practical-implementation)
13. [Key Takeaways](#13-key-takeaways)
14. [References](#14-references)

---

## 1. The Night Operations Challenge

### 1.1 Night Shift Characteristics

| Parameter | Day (06:00-22:00) | Night (22:00-06:00) |
|---|---|---|
| **Ambient light** | 10,000-100,000 lux | 1-50 lux (apron lighting) |
| **Visible camera performance** | Optimal | Severely degraded |
| **LiDAR performance** | Optimal | Unchanged (active sensor) |
| **4D radar performance** | Optimal | Unchanged (active sensor) |
| **Personnel visibility** | Good (hi-vis effective) | Poor (hi-vis causes AEB failure) |
| **Traffic density** | 100% | 30-60% (fewer flights) |
| **Crew fatigue** | Moderate | High (increased accident risk) |
| **Temperature** | Higher | Lower (thermal contrast changes) |

### 1.2 Why Night Is More Dangerous

Despite lower traffic, night operations carry disproportionate safety risk:

- **Fatigue**: Ground crew alertness drops 15-30% on night shifts
- **Visibility**: Reduced awareness of approaching vehicles
- **Equipment movement**: Less predictable; maintenance operations cluster at night
- **Lighting inconsistency**: Bright apron lights + deep shadows create extreme contrast
- **Hi-vis failure**: The primary passive safety mechanism fails at night

### 1.3 Current Aurrigo Night Capability

The current LiDAR-only stack is theoretically night-invariant (LiDAR is an active sensor). However:

| Capability | Day | Night | Gap |
|---|---|---|---|
| **Object detection (LiDAR)** | Good | Good | No gap |
| **Personnel detection at 50m** | 70-80% AP | 70-80% AP | No gap (LiDAR) |
| **Personnel classification** | Not possible (LiDAR) | Not possible | Need camera |
| **Intent estimation** | Requires camera | Fails at night | Critical gap |
| **Hi-vis detection** | Camera (day only) | Camera fails | Critical gap |
| **Jet blast detection** | Not possible (all) | Not possible | Need thermal |
| **Fuel spill detection** | Not possible (all) | Not possible | Need thermal |

**Key insight**: LiDAR provides geometry-based detection that works at night, but thermal adds safety-critical capabilities (jet blast, fuel spill, personnel classification) that no other sensor provides.

---

## 2. Sensor Modality Comparison at Night

### 2.1 Detection Performance by Modality and Condition

| Target | LiDAR (night) | Visible Camera (night) | 4D Radar (night) | Thermal Camera (night) |
|---|---|---|---|---|
| **Person at 30m** | 75% AP | 15-30% AP | 60% AP | **92% AP** |
| **Person at 50m** | 55% AP | <10% AP | 45% AP | **85% AP** |
| **Person at 80m** | 25% AP | <5% AP | 30% AP | **70% AP** |
| **Baggage tractor** | 85% AP | 40% AP | 75% AP | 80% AP |
| **Aircraft** | 90% AP | 50% AP | 85% AP | 85% AP |
| **Jet blast plume** | 0% | 0% | 5-10% | **95%** |
| **Fuel spill** | 0% | 0% | 0% | **80%** |

### 2.2 Thermal Camera Characteristics

| Property | Visible Camera | Thermal (LWIR) |
|---|---|---|
| **Resolution** | 1920×1080 typical | 640×512 (FLIR Boson) |
| **Spectral range** | 400-700nm | 7.5-13.5μm |
| **Information** | Color, texture, edges | Temperature distribution |
| **Night performance** | Poor (needs illumination) | Excellent (passive) |
| **Rain performance** | Poor (water on lens) | Good (IR penetrates light rain) |
| **Fog performance** | Poor | Moderate (LWIR partially penetrates) |
| **Contrast source** | Reflected light | Emitted heat |
| **Frame rate** | 30-60 fps | 30-60 fps (FLIR Boson 640) |
| **Cost** | $200-500 | $3,000-5,000 |

---

## 3. Thermal-Specific Perception Models

### 3.1 Why Standard Models Fail on Thermal

Models trained on RGB images (YOLO, Faster R-CNN, etc.) fail on thermal because:

| Difference | Impact |
|---|---|
| **No color channels** | 1-channel 16-bit vs 3-channel 8-bit; features differ fundamentally |
| **No texture** | Clothing texture invisible; surfaces appear as flat temperature regions |
| **Inverted contrast** | Hot objects are bright, cold are dark — opposite of visible in some cases |
| **Halo effects** | Heat radiation creates halos around hot objects (engines, exhausts) |
| **Low resolution** | 640×512 vs 1920×1080 — fewer pixels per object |
| **No pre-trained backbone** | ImageNet pre-training doesn't transfer well to thermal |

### 3.2 Thermal Object Detection Architectures

#### YOLO-Thermal (Adapted)

The most practical approach: adapt YOLOv8/v11 for thermal input.

```python
class YOLOThermal:
    """YOLO adapted for thermal imagery.
    
    Key modifications from standard YOLO:
    1. Single-channel input (16-bit thermal, not 3-channel RGB)
    2. Modified backbone (no color-dependent features)
    3. Thermal-specific augmentation (temperature jitter, not color jitter)
    4. Anchor sizes adjusted for thermal resolution (smaller objects)
    """
    
    def __init__(self):
        # Modify first conv layer for 1-channel input
        self.backbone = CSPDarknet(in_channels=1)  # was 3
        
        # Smaller anchor boxes for 640×512 resolution
        self.anchors = {
            'small': [(8, 16), (12, 24), (16, 32)],    # person at range
            'medium': [(24, 48), (36, 72), (48, 96)],   # person close, small GSE
            'large': [(72, 144), (96, 192), (128, 256)], # vehicles, aircraft
        }
    
    @staticmethod
    def thermal_augmentation(image):
        """Thermal-specific augmentation (not color jitter)."""
        # Temperature offset (simulates ambient temperature change)
        if np.random.random() < 0.5:
            image = image + np.random.uniform(-500, 500)  # raw 16-bit counts
        
        # Gain variation (simulates different camera gain settings)
        if np.random.random() < 0.3:
            image = image * np.random.uniform(0.9, 1.1)
        
        # Noise (thermal noise is different from visible)
        if np.random.random() < 0.3:
            noise = np.random.normal(0, 50, image.shape)  # NETD ~50mK
            image = image + noise
        
        # Random horizontal flip (valid for thermal)
        if np.random.random() < 0.5:
            image = np.fliplr(image)
        
        return image
```

**Performance**: YOLO-Thermal achieves 85-92% AP for person detection on FLIR ADAS dataset (night conditions), vs 30-45% for standard YOLO on visible cameras at night.

#### Thermal Pre-Training

Since ImageNet doesn't contain thermal images, thermal-specific pre-training is needed:

| Pre-training Strategy | Data Source | Effort | mAP Improvement |
|---|---|---|---|
| **From scratch** | Airside thermal only | None | Baseline |
| **Transfer from RGB** | ImageNet → thermal fine-tune | Low | +3-5% |
| **FLIR ADAS pre-train** | FLIR ADAS dataset (26K frames) | Medium | +8-12% |
| **Self-supervised on thermal** | Unlabeled thermal fleet data | Medium | +5-10% |
| **DINOv2 adaptation** | DINOv2 → LoRA thermal adapter | Low | +10-15% |

**Recommended**: DINOv2 with LoRA rank-16 thermal adapter. DINOv2's self-supervised features transfer surprisingly well to thermal because they learn structural features (edges, shapes) that are modality-agnostic.

### 3.3 Thermal Segmentation

For free-space estimation and ground plane detection from thermal:

```python
class ThermalFreespaceEstimator:
    """Estimate drivable area from thermal image.
    
    Thermal free space relies on temperature differences:
    - Asphalt: absorbs heat during day, radiates at night (warm)
    - Concrete: cooler than asphalt at night
    - Grass/dirt: much cooler
    - Vehicles/obstacles: distinct thermal signatures
    """
    
    def __init__(self, model_path):
        self.model = load_segmentation_model(model_path)  # U-Net or DeepLabv3+
        self.classes = ['drivable', 'non-drivable', 'obstacle', 'person', 'vehicle']
    
    def estimate_freespace(self, thermal_image):
        """
        Returns per-pixel free space probability.
        
        Key challenge: surface temperature changes with:
        - Time since sunset (cooling curve)
        - Season (absolute temperatures shift)
        - Recent rain (evaporative cooling)
        
        Solution: relative temperature analysis within frame,
        not absolute temperature thresholds.
        """
        # Normalize to relative temperature (within frame)
        normalized = (thermal_image - thermal_image.mean()) / (thermal_image.std() + 1e-6)
        
        # Run segmentation model
        segmentation = self.model(normalized.unsqueeze(0).unsqueeze(0))
        
        return segmentation
```

---

## 4. The Hi-Vis Paradox and Solution

### 4.1 The Problem

From `ground-crew-pedestrian-safety.md`: retroreflective hi-vis vests cause **84-88% AEB failure rate** at night in camera-based systems. The mechanism:

1. Vehicle headlights illuminate the retroreflective material
2. Material reflects light directly back to camera
3. Camera sensor saturates (blown-out pixels)
4. Detection algorithm sees a white blob, not a person
5. Classifier confidence drops below detection threshold
6. AEB fails to trigger

### 4.2 Why LiDAR Doesn't Fully Solve It

LiDAR is immune to hi-vis overexposure (it measures range, not brightness). However:

- LiDAR intensity **does** spike on retroreflective materials
- Personnel at >30m have <15 LiDAR points (sparse)
- LiDAR cannot distinguish person from small static object (cone, post) at range
- No pose/gesture information from LiDAR alone

### 4.3 Thermal as the Complete Solution

Thermal cameras detect body heat (36-37°C skin temperature) regardless of clothing:

| Scenario | Visible Camera | LiDAR | Thermal |
|---|---|---|---|
| **Hi-vis vest, headlights on** | FAIL (overexposure) | Detect (sparse) | **Detect (body heat)** |
| **Dark clothing, no lights** | FAIL (invisible) | Detect (sparse) | **Detect (body heat)** |
| **Person behind GSE** | FAIL (occluded) | FAIL (occluded) | **Partial** (heat around edges) |
| **Person crouching** | Difficult | Difficult (few points) | **Detect** (heat blob unchanged) |
| **Person vs mannequin** | Can't distinguish at night | Can't distinguish | **Distinguish** (heat vs ambient) |

### 4.4 Fusion Architecture for Hi-Vis Safety

```
                     ┌──────────────┐
   LiDAR points ────>│ PointPillars │──> 3D boxes (person candidates)
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Box Matcher  │──> Confirmed persons
                     └──────┬───────┘         │
                            ▲                  ▼
                     ┌──────┴───────┐   ┌──────────────┐
   Thermal image ───>│ YOLO-Thermal │   │  Safety Score │──> Distance to nearest
                     └──────────────┘   └──────────────┘    confirmed person
                     
   Rule: Person confirmed if EITHER LiDAR OR thermal detects.
         Distance safety uses the CLOSER detection (conservative).
```

---

## 5. Thermal-LiDAR Fusion Architecture

### 5.1 Fusion Strategies

| Strategy | Description | Latency | Accuracy | Implementation |
|---|---|---|---|---|
| **Early fusion** | Project LiDAR to thermal image, concatenate features | +15-25ms | Highest | Complex calibration required |
| **Mid fusion** | Fuse BEV features from both modalities | +10-20ms | High | Requires shared backbone |
| **Late fusion** | Match detections from independent pipelines | +5-10ms | Good | Simplest, most robust |
| **Asymmetric** | LiDAR primary, thermal as safety net | +5-10ms | Good+ | Recommended for airside |

### 5.2 Recommended: Asymmetric Late Fusion

```python
class ThermalLiDARFusion:
    """Asymmetric late fusion: LiDAR primary, thermal safety net.
    
    Architecture:
    - LiDAR pipeline runs independently (existing PointPillars/CenterPoint)
    - Thermal pipeline runs independently (YOLO-Thermal)
    - Fusion layer matches detections and resolves conflicts
    
    Key principle: Thermal ADDS detections, never REMOVES LiDAR detections.
    This ensures thermal failure doesn't degrade LiDAR performance.
    """
    
    def __init__(self, lidar_detector, thermal_detector, calibration):
        self.lidar_det = lidar_detector
        self.thermal_det = thermal_detector
        self.calib = calibration  # thermal-LiDAR extrinsic calibration
        
        self.iou_threshold = 0.3  # 2D IoU for matching (projected)
        self.person_boost_threshold = 0.3  # boost weak LiDAR person detections
    
    def fuse(self, lidar_points, thermal_image, ego_pose):
        """
        Fuse LiDAR 3D detections with thermal 2D detections.
        
        Returns: Enhanced 3D detections with thermal confidence scores.
        """
        # Run detectors independently
        lidar_boxes_3d = self.lidar_det(lidar_points)  # 3D boxes
        thermal_boxes_2d = self.thermal_det(thermal_image)  # 2D boxes + class
        
        # Project LiDAR 3D boxes to thermal image plane
        lidar_boxes_projected = self.calib.project_3d_to_thermal(lidar_boxes_3d)
        
        # Match LiDAR projections with thermal detections
        matches, unmatched_thermal = self._match_detections(
            lidar_boxes_projected, thermal_boxes_2d
        )
        
        fused_detections = []
        
        # Case 1: Matched (both detect) — highest confidence
        for lidar_idx, thermal_idx in matches:
            det = lidar_boxes_3d[lidar_idx].copy()
            det['thermal_confirmed'] = True
            det['thermal_confidence'] = thermal_boxes_2d[thermal_idx]['confidence']
            det['fused_confidence'] = max(
                det['confidence'], 
                det['thermal_confidence']
            )
            fused_detections.append(det)
        
        # Case 2: LiDAR-only — keep as-is
        for i, det in enumerate(lidar_boxes_3d):
            if i not in [m[0] for m in matches]:
                det['thermal_confirmed'] = False
                det['fused_confidence'] = det['confidence']
                fused_detections.append(det)
        
        # Case 3: Thermal-only (critical for safety)
        for thermal_idx in unmatched_thermal:
            tdet = thermal_boxes_2d[thermal_idx]
            if tdet['class'] == 'person' and tdet['confidence'] > 0.5:
                # Estimate 3D position from thermal + ground plane assumption
                position_3d = self.calib.thermal_to_3d_ground_plane(
                    tdet['bbox'], ego_pose
                )
                fused_detections.append({
                    'position': position_3d,
                    'class': 'person',
                    'confidence': tdet['confidence'] * 0.8,  # discount for single-modal
                    'thermal_only': True,
                    'thermal_confirmed': True,
                    'source': 'thermal',
                })
        
        return fused_detections
```

### 5.3 Orin Compute Budget for Night Perception

| Component | Daytime (ms) | Night Addition (ms) | Night Total (ms) |
|---|---|---|---|
| LiDAR PointPillars | 6.84 | 0 | 6.84 |
| Multi-task heads | 7.96 | 0 | 7.96 |
| **Thermal YOLO (INT8)** | 0 | **6-8** | 6-8 |
| **Thermal-LiDAR fusion** | 0 | **1-2** | 1-2 |
| CBF safety filter | 1.0 | 0 | 1.0 |
| **Total** | 15.8 | 7-10 | **22.8-25.8** |
| **Frequency** | 67 Hz | — | **38-44 Hz** |

At 38-44 Hz, the night perception pipeline exceeds the 10 Hz planning requirement with comfortable margin. The thermal branch can also run asynchronously at its own rate (30 Hz) with results buffered for the next fusion cycle.

---

## 6. Night Ground Plane and Free Space

### 6.1 Ground Plane Challenges at Night

| Challenge | Impact | Solution |
|---|---|---|
| **Shadows from floodlights** | Camera sees dark patches (false obstacles) | LiDAR + thermal immune |
| **Wet surface reflections** | Camera sees false objects (reflections) | LiDAR measures true range |
| **Lighting transitions** | Moving from bright to dark areas | Thermal provides uniform coverage |
| **Surface temperature variation** | Thermal sees "patterns" that aren't obstacles | Multi-modal cross-check |

### 6.2 LiDAR Ground Plane at Night

LiDAR-based ground plane (RANSAC) works identically day and night. No modification needed for:
- Ground segmentation
- Drivable area estimation
- Height-above-ground for object classification

### 6.3 Thermal Ground Segmentation

Thermal ground segmentation uses temperature patterns:

```python
class ThermalGroundSegmenter:
    """Segment ground from thermal image using temperature patterns.
    
    Key insight: At night, the ground radiates stored heat differently
    from vehicles, people, and infrastructure. The temperature pattern
    is more stable than visible appearance.
    
    Asphalt: 20-35°C at night (depends on daytime heating)
    Concrete: 18-30°C (lower thermal mass)
    Metal (vehicles): 15-25°C (radiates faster)
    Human body: 33-37°C (consistent)
    """
    
    def segment(self, thermal_image):
        """
        Returns: drivable_mask (H, W) binary
        
        Uses relative temperature analysis:
        - Ground is typically between 5th and 50th percentile temperature
        - Obstacles are typically above 50th or below 5th percentile
        - Robust to absolute temperature changes (seasonal, time-of-night)
        """
        temp_5 = np.percentile(thermal_image, 5)
        temp_50 = np.percentile(thermal_image, 50)
        temp_95 = np.percentile(thermal_image, 95)
        
        # Ground: within main temperature band
        ground_mask = (thermal_image >= temp_5) & (thermal_image <= temp_50)
        
        # Morphological cleanup
        ground_mask = cv2.morphologyEx(
            ground_mask.astype(np.uint8), 
            cv2.MORPH_CLOSE, 
            np.ones((15, 15))
        )
        
        return ground_mask.astype(bool)
```

---

## 7. Thermal-LiDAR Calibration

### 7.1 Cross-Modal Calibration Challenge

Thermal and LiDAR see fundamentally different things — no shared visual features (no edges, corners, or textures are visible in both modalities simultaneously). This makes calibration harder than camera-LiDAR.

### 7.2 Calibration Methods

| Method | Accuracy | Effort | Equipment |
|---|---|---|---|
| **Heated target board** | <0.5° rotation, <1cm translation | Medium | Heated aluminum plate ($200) |
| **Person as calibration target** | 1-2° rotation, 2-5cm translation | Low | None (person walks through FOV) |
| **Building corners (thermal gradient)** | 1-2° rotation, 3-5cm translation | Low | None (sun-heated building) |
| **Mutual information optimization** | 0.5-1° rotation, 1-3cm translation | High (compute) | None (automated) |

### 7.3 Heated Target Calibration

The most practical method for fleet deployment:

```python
class ThermalLiDARCalibrator:
    """Calibrate thermal camera to LiDAR using heated target.
    
    Setup:
    1. Place heated aluminum plate (50×50cm, heated to 50°C) at 5-10m
    2. LiDAR sees flat plane; thermal sees bright square
    3. Detect plate in both modalities
    4. Solve PnP for extrinsic transformation
    
    Repeat at 3-5 positions for robust calibration.
    """
    
    def calibrate(self, lidar_detections, thermal_detections):
        """
        lidar_detections: List of 3D plane centroids in LiDAR frame
        thermal_detections: List of 2D square centroids in image frame
        
        Returns: T_thermal_from_lidar (4×4 SE(3) transformation)
        """
        # At least 4 correspondences needed for PnP
        assert len(lidar_detections) >= 4
        
        # 3D-to-2D correspondence
        object_points = np.array(lidar_detections)  # (N, 3) in LiDAR frame
        image_points = np.array(thermal_detections)  # (N, 2) in thermal pixels
        
        # Solve PnP (thermal camera intrinsics must be known)
        success, rvec, tvec = cv2.solvePnP(
            object_points, image_points, 
            self.thermal_intrinsics, 
            self.thermal_distortion,
            flags=cv2.SOLVEPNP_ITERATIVE
        )
        
        # Convert to SE(3)
        R, _ = cv2.Rodrigues(rvec)
        T = np.eye(4)
        T[:3, :3] = R
        T[:3, 3] = tvec.flatten()
        
        return T
    
    def detect_heated_target_lidar(self, point_cloud):
        """Detect heated aluminum plate in LiDAR point cloud.
        
        The plate appears as a flat surface with high reflectivity.
        """
        # RANSAC plane fitting on high-intensity points
        high_intensity = point_cloud[point_cloud[:, 3] > 0.7]  # aluminum is reflective
        # ... plane fitting and centroid extraction
        return centroid
    
    def detect_heated_target_thermal(self, thermal_image):
        """Detect heated plate in thermal image.
        
        The 50°C plate is much hotter than background — appears as bright rectangle.
        """
        # Threshold for hot regions
        hot_mask = thermal_image > (thermal_image.mean() + 3 * thermal_image.std())
        # Find largest contour (the plate)
        contours = cv2.findContours(hot_mask.astype(np.uint8), 
                                     cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        # ... contour filtering and centroid extraction
        return centroid
```

### 7.4 Online Calibration Maintenance

Thermal-LiDAR calibration drifts due to thermal expansion. Monitor and correct:

```python
class ThermalCalibrationMonitor:
    """Monitor thermal-LiDAR calibration quality online."""
    
    def check_calibration(self, lidar_persons, thermal_persons, calibration):
        """
        Use personnel detections as natural calibration targets.
        
        If LiDAR detects a person at position P and thermal detects at T,
        and the projected T disagrees with P, calibration has drifted.
        """
        reprojection_errors = []
        
        for lidar_det, thermal_det in matched_pairs:
            # Project LiDAR 3D to thermal 2D
            projected = calibration.project(lidar_det.position_3d)
            # Measure pixel error
            error = np.linalg.norm(projected - thermal_det.center_2d)
            reprojection_errors.append(error)
        
        mean_error = np.mean(reprojection_errors)
        
        if mean_error > 10:  # pixels
            return CalibrationStatus.DEGRADED
        if mean_error > 25:
            return CalibrationStatus.FAILED
        return CalibrationStatus.OK
```

---

## 8. Personnel Detection and Tracking at Night

### 8.1 Multi-Modal Personnel Pipeline

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  LiDAR   │────>│ PointPillars │────>│ Person boxes  │──┐
│ (10 Hz)  │     │ (6.84ms)     │     │ (3D, sparse)  │  │
└──────────┘     └──────────────┘     └──────────────┘  │
                                                         ├──> Fused Persons
┌──────────┐     ┌──────────────┐     ┌──────────────┐  │    (3D position,
│ Thermal  │────>│ YOLO-Thermal │────>│ Person boxes  │──┘     class, intent,
│ (30 Hz)  │     │ INT8 (7ms)   │     │ (2D, dense)   │        confidence)
└──────────┘     └──────────────┘     └──────────────┘
                                                         
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│ 4D Radar │────>│ CFAR + track │────>│ Person tracks │──> Velocity confirmation
│ (20 Hz)  │     │ (2ms)        │     │ (Doppler)     │    (moving vs stationary)
└──────────┘     └──────────────┘     └──────────────┘
```

### 8.2 Thermal Person Classification

Beyond detection, thermal reveals:

| Feature | How Thermal Helps |
|---|---|
| **Person vs object** | Body heat (36°C) vs ambient (10-25°C) — unambiguous |
| **Person count in group** | Individual heat signatures, even when overlapping in LiDAR |
| **Activity level** | Active (higher skin temp) vs idle (lower extremity temp) |
| **Orientation** | Face vs back (face is warmer due to blood flow) |
| **Carrying objects** | Hot coffee, powered equipment visible as separate heat sources |

### 8.3 Night Tracking Considerations

```python
class NightPersonTracker:
    """Multi-modal person tracking optimized for night operations."""
    
    def __init__(self):
        self.tracks = {}
        self.next_id = 0
        
        # Night-specific parameters
        self.association_threshold_day = 3.0  # meters
        self.association_threshold_night = 4.0  # wider (more uncertainty)
        
        # Thermal provides better continuity than LiDAR at night
        # (LiDAR person returns are sparse at range)
        self.modality_weights = {
            'lidar': 0.6,    # primary for position
            'thermal': 0.3,  # secondary for existence confirmation
            'radar': 0.1,    # tertiary for velocity
        }
    
    def update(self, fused_detections, timestamp):
        """Update tracks with new fused detections."""
        # Hungarian matching with modality-weighted distance
        # Night: increase thermal weight since LiDAR person AP drops at range
        
        for detection in fused_detections:
            if detection.get('thermal_confirmed'):
                detection['track_confidence_boost'] = 0.2
            
            # Thermal-only detections get new tracks (safety-critical)
            if detection.get('thermal_only'):
                self._create_track(detection, source='thermal')
```

---

## 9. Night-Specific Safety Applications

### 9.1 Jet Blast Detection (Thermal Only)

Jet blast is invisible to LiDAR, cameras, and radar but clearly visible in thermal:

```python
class JetBlastDetector:
    """Detect jet engine exhaust plumes from thermal imagery.
    
    Exhaust gas temperature:
    - Idle: 300-500°C
    - Takeoff: 500-700°C
    - After shutdown: decreasing from 200°C to ambient over 5-10 min
    
    In thermal image: bright plume extending 20-150m behind aircraft.
    """
    
    def detect(self, thermal_image, aircraft_positions):
        """
        Returns: List of jet blast zones (polygon, confidence, temperature)
        """
        blast_zones = []
        
        for aircraft in aircraft_positions:
            # Region of interest: behind engines
            roi = self._get_engine_exhaust_roi(aircraft, thermal_image)
            
            # Threshold for hot gas (well above ambient)
            hot_threshold = np.percentile(thermal_image, 95)
            blast_mask = roi > hot_threshold
            
            if blast_mask.sum() > 100:  # minimum pixel count
                # Trace plume extent
                plume_polygon = self._trace_plume(blast_mask, aircraft)
                
                blast_zones.append(JetBlastZone(
                    polygon=plume_polygon,
                    max_temperature=roi[blast_mask].max(),
                    confidence=min(1.0, blast_mask.sum() / 500),
                    source_aircraft=aircraft.id,
                ))
        
        return blast_zones
```

### 9.2 Fuel Spill Detection

```python
class FuelSpillDetector:
    """Detect fuel spills on apron from thermal imagery.
    
    Physics: Jet-A fuel evaporates at ~150°C but evaporative cooling 
    makes the spill surface 2-5°C cooler than surrounding asphalt.
    
    In thermal image: dark (cool) patch on warm ground.
    """
    
    def detect(self, thermal_image, ground_mask):
        """Detect anomalously cool regions on the ground plane."""
        ground_temps = thermal_image[ground_mask]
        mean_ground = np.mean(ground_temps)
        std_ground = np.std(ground_temps)
        
        # Cool anomalies (>2σ below mean ground temperature)
        cool_mask = (thermal_image < mean_ground - 2 * std_ground) & ground_mask
        
        # Filter by size (fuel spill is >0.5m², not a shadow)
        contours = cv2.findContours(cool_mask.astype(np.uint8), 
                                     cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        spills = []
        for contour in contours[0]:
            area_pixels = cv2.contourArea(contour)
            area_m2 = area_pixels * self.pixel_to_m2_scale
            
            if area_m2 > 0.5:  # minimum 0.5 m²
                spills.append(FuelSpill(
                    contour=contour,
                    area_m2=area_m2,
                    temperature_delta=mean_ground - thermal_image[cool_mask].mean(),
                    confidence=min(1.0, area_m2 / 2.0),
                ))
        
        return spills
```

---

## 10. Degraded Night Mode Architecture

### 10.1 Failure Mode Handling

| Failure | Detection | Response |
|---|---|---|
| **Thermal camera failure** | No data / frozen frame / temperature out of range | Revert to LiDAR-only; reduce speed; increase safety margins |
| **LiDAR failure at night** | Existing monitoring (from runtime-verification) | Thermal + radar; 5 km/h speed limit; request teleop |
| **Both thermal + LiDAR fail** | No perception data | Emergency stop; Simplex safe state |
| **Calibration drift** | Reprojection error >25 pixels | Disable fusion; run modalities independently |

### 10.2 Night-Specific ODD

```python
class NightODDMonitor:
    """Monitor night-specific Operational Design Domain conditions."""
    
    def check_night_odd(self, sensor_status, environment):
        """
        Night ODD is a SUBSET of daytime ODD:
        - Same speed limits but may be further reduced
        - Additional thermal sensor required for full ODD
        - Minimum apron lighting level
        """
        if not sensor_status.thermal_operational:
            # Thermal offline — restricted ODD
            return ODD(
                max_speed=10,  # km/h (reduced from 25)
                personnel_safety_margin=5.0,  # m (increased from 3.0)
                aircraft_safety_margin=8.0,  # m (increased from 5.0)
                teleop_available_required=True,
            )
        
        if environment.apron_lighting < 20:  # lux
            # Very dark — even LiDAR-based classification may struggle
            return ODD(
                max_speed=15,
                personnel_safety_margin=4.0,
                aircraft_safety_margin=6.0,
            )
        
        # Full night ODD — thermal operational, adequate lighting
        return ODD(
            max_speed=25,  # same as day
            personnel_safety_margin=3.0,
            aircraft_safety_margin=5.0,
        )
```

---

## 11. Benchmarking Night Perception

### 11.1 No Public Airside Night Dataset

No public dataset exists for nighttime airside perception. The closest alternatives:

| Dataset | Night Data | Thermal | LiDAR | Airside | Relevance |
|---|---|---|---|---|---|
| **nuScenes Night** | ~25% night frames | No | Yes | No | Moderate (road) |
| **FLIR ADAS** | Yes (night driving) | Yes | No | No | Thermal models |
| **KAIST Multispectral** | 50% night | Yes | No | No | Thermal-visible fusion |
| **M3FD** | Challenging conditions | Yes | No | No | Multi-modal fusion |
| **Aurrigo fleet** (internal) | Yes (night shifts) | No (no thermal yet) | Yes | Yes | LiDAR night only |

### 11.2 Proposed Night Benchmarking Protocol

```python
class NightPerceptionBenchmark:
    """Benchmark protocol for night airside perception."""
    
    METRICS = {
        'person_detection': {
            'ranges': [10, 20, 30, 50, 80],  # meters
            'conditions': ['well_lit', 'shadowed', 'headlight_glare'],
            'target_ap': {10: 0.95, 20: 0.90, 30: 0.85, 50: 0.75, 80: 0.60},
        },
        'hi_vis_robustness': {
            'clothing_types': ['hi_vis', 'dark', 'mixed'],
            'target': 'no AP difference between hi_vis and dark',
        },
        'jet_blast_detection': {
            'engine_states': ['idle', 'taxi_power', 'just_shutdown'],
            'target_recall': 0.99,
        },
        'fuel_spill_detection': {
            'spill_sizes_m2': [0.5, 1, 5, 10],
            'target_recall': 0.90,
        },
        'overall_night_parity': {
            'metric': 'night_mAP / day_mAP',
            'target': '>= 0.90',  # within 10% of daytime
        },
    }
```

---

## 12. Practical Implementation

### 12.1 Phased Deployment

#### Phase 0: Thermal Data Collection (Weeks 1-4, $8-15K)
- Install 2-4 FLIR Boson 640 cameras per vehicle (forward + sides)
- Record synchronized thermal + LiDAR data during night shifts
- Build internal night dataset (1,000+ thermal frames with LiDAR pairs)
- **No perception changes — data collection only**

#### Phase 1: Thermal Person Detection (Weeks 5-10, $10-15K)
- Train YOLO-Thermal on FLIR ADAS + internal thermal data
- DINOv2 LoRA adapter for thermal backbone
- Deploy thermal person detector in shadow mode (parallel to LiDAR)
- Measure night person AP improvement
- **Deliverable**: Thermal person detector running on Orin

#### Phase 2: Thermal-LiDAR Fusion (Weeks 11-16, $10-15K)
- Implement heated-target calibration procedure
- Deploy late fusion pipeline (Section 5.2)
- Validate fused detection > max(LiDAR-only, thermal-only)
- Night-specific ODD monitoring
- **Deliverable**: Fused night perception pipeline

#### Phase 3: Safety Applications (Weeks 17-24, $15-20K)
- Jet blast detection from thermal
- Fuel spill detection from thermal
- V2X integration for JBW messages (from `v2x-protocols-airside.md`)
- Night benchmarking protocol
- **Deliverable**: Full night safety suite

**Total**: $43-65K over 24 weeks

### 12.2 Hardware Cost per Vehicle

| Component | Quantity | Unit Cost | Total |
|---|---|---|---|
| FLIR Boson 640 (LWIR) | 2-4 | $3,000-5,000 | $6,000-20,000 |
| Mounting + weather housing | 2-4 | $200-500 | $400-2,000 |
| MIPI → GMSL adapter | 2-4 | $50-100 | $100-400 |
| Calibration target (heated plate) | 1 per fleet | $200 | $200 |
| **Total per vehicle** | | | **$6,700-22,600** |

### 12.3 ROS Integration

```yaml
# Thermal perception node
/perception/thermal:
  subscribe:
    - /thermal_camera/image_raw   # sensor_msgs/Image (16-bit mono)
    - /thermal_camera/camera_info # sensor_msgs/CameraInfo
  publish:
    - /perception/thermal/detections  # vision_msgs/Detection2DArray
    - /perception/thermal/freespace   # sensor_msgs/Image (binary mask)
    - /perception/thermal/jet_blast   # custom JetBlastZone msg
    - /perception/thermal/fuel_spill  # custom FuelSpill msg

# Fusion node
/perception/thermal_lidar_fusion:
  subscribe:
    - /perception/lidar/detections_3d   # LiDAR 3D boxes
    - /perception/thermal/detections     # Thermal 2D boxes
    - /tf                                # Calibration transforms
  publish:
    - /perception/fused/detections       # Enhanced 3D detections
    - /perception/fused/persons          # Person-specific with thermal info
    - /perception/thermal/calibration_status  # CalibrationStatus msg
```

---

## 13. Key Takeaways

1. **Night operations are 1/3 of airside activity but have disproportionate safety risk**: Crew fatigue increases 15-30%, hi-vis vests cause 84-88% camera AEB failure, and lighting inconsistency creates extreme contrast zones.

2. **Thermal cameras solve the hi-vis paradox completely**: Body heat (36°C) is detected regardless of clothing type, headlight glare, or ambient lighting. YOLO-Thermal achieves 85-92% person AP at night vs <30% for visible cameras.

3. **LiDAR-primary + thermal-augmented is the recommended architecture**: The thermal branch runs as a parallel safety net. Thermal ADDS detections but never removes LiDAR detections — ensuring thermal failure doesn't degrade existing capability.

4. **Late fusion adds only 8-10ms to perception pipeline**: YOLO-Thermal INT8 (6-8ms) + fusion logic (1-2ms) = 8-10ms additional. Total night pipeline: 22.8-25.8ms → 38-44 Hz, well above 10 Hz planning requirement.

5. **Thermal provides unique safety capabilities no other sensor offers**: Jet blast detection (invisible to LiDAR/cameras/radar), fuel spill detection (evaporative cooling), and engine state monitoring. These are critical for airside and available only through thermal.

6. **DINOv2 with LoRA thermal adapter is the best pre-training strategy**: +10-15% mAP over training from scratch. DINOv2's self-supervised structural features transfer to thermal because they encode shape/edge information that is modality-agnostic.

7. **Heated-target calibration is the practical method for fleet deployment**: A $200 heated aluminum plate provides <0.5° rotation and <1cm translation accuracy. Person-based calibration is lower effort but less accurate (1-2° rotation).

8. **Online calibration monitoring uses personnel as natural targets**: If LiDAR and thermal consistently disagree on person position, calibration has drifted. Mean reprojection error >10 pixels triggers a degraded calibration alert.

9. **Night ODD is a subset of daytime ODD**: Without operational thermal, speed reduces to 10 km/h and safety margins increase by 60-100%. Full night ODD matches daytime limits when thermal is operational and apron lighting exceeds 20 lux.

10. **Thermal ground segmentation uses relative temperature, not absolute**: Ground temperature changes by 20°C between sunset and dawn. Using percentile-based analysis (ground = 5th-50th percentile) is robust to absolute temperature shifts.

11. **No public nighttime airside dataset exists**: Building a thermal+LiDAR night airside dataset would be a significant contribution. The benchmarking protocol (Section 11.2) defines the metrics and targets.

12. **Jet blast is the highest-criticality invisible hazard**: V2X JBW messages (from `v2x-protocols-airside.md`) provide fleet-wide warning, but thermal provides the ground-truth detection. Default behavior without thermal or JBW must assume worst-case exclusion zones.

13. **Person vs mannequin/obstacle discrimination**: Thermal distinguishes living persons (heat signature) from static obstacles at the same physical size — impossible for LiDAR or visible cameras at night. This reduces false AEB activations.

14. **Multi-modal night tracking improves continuity**: LiDAR person points are sparse at >30m; thermal maintains a dense detection. Fusing both modalities provides track continuity that neither achieves alone, especially for crossing trajectories.

15. **Total implementation cost $43-65K over 24 weeks**: Phase 0 (data collection) through Phase 3 (full safety suite). Hardware cost $6,700-22,600 per vehicle depending on sensor count (2-4 thermal cameras).

---

## 14. References

### Thermal Perception
- FLIR. "FLIR ADAS Dataset v2." — 26K annotated thermal frames for driving
- Choi, Y., et al. (2018). "KAIST Multispectral Pedestrian Detection Benchmark." CVPR
- Liu, J., et al. (2022). "Multispectral Deep Neural Networks for Pedestrian Detection." BMVC
- Ha, Q., et al. (2017). "MFNet: Towards Real-Time Semantic Segmentation for Autonomous Vehicles with Multi-Spectral Scenes." IROS

### Thermal-LiDAR Fusion
- Wang, C., et al. (2023). "Multi-Modal 3D Object Detection in Autonomous Driving: A Survey." Pattern Recognition
- Li, Y., et al. (2022). "DeepFusion: Lidar-Camera Deep Fusion for Multi-Modal 3D Object Detection." CVPR
- Liu, Z., et al. (2023). "BEVFusion: Multi-Task Multi-Sensor Fusion with Unified Bird's-Eye View Representation." ICRA

### Night Driving
- Dai, D., et al. (2018). "Dark Model Adaptation: Semantic Image Segmentation from Daytime to Nighttime." ITSC
- Sakaridis, C., et al. (2020). "Map-Guided Curriculum Domain Adaptation and Uncertainty-Aware Evaluation for Semantic Nighttime Image Segmentation." TPAMI
- Li, X., et al. (2021). "Night-time Semantic Segmentation with a Large Scale Virtual Night-time Dataset." BMVC

### Thermal Calibration
- Vidas, S., et al. (2013). "A Mask-Based Approach for the Geometric Calibration of Thermal-Infrared Cameras." IEEE TIM
- Prakash, S., et al. (2006). "Extrinsic Calibration of a 3D Laser Scanner and an Infrared Camera." IFAC
