# 3D Point Cloud Annotation Tools and Workflows

## Practical Guide for Creating Airside Driving Datasets

---

## 1. The Annotation Challenge for Airside

You need 3D bounding box annotations for objects never seen in standard driving datasets:

| Object Class | Size (L×W×H m) | Challenge |
|-------------|-----------------|-----------|
| Aircraft (A320) | 37.6 × 35.8 × 11.8 | Enormous, partially visible, dynamic wings |
| Baggage tractor | 3.5 × 1.5 × 1.8 | Similar to cars but different shape |
| Belt loader | 8.0 × 2.5 × 3.5 | Articulated, changes shape when deployed |
| Pushback tug | 6.0 × 2.5 × 2.0 | Low profile, hard to distinguish |
| ULD container | 3.2 × 2.4 × 1.6 | Rectangular, stacked, on dollies |
| Ground crew | 0.5 × 0.5 × 1.8 | Small, hi-vis clothing |
| Baggage dolly train | 12+ × 1.5 × 1.0 | Multiple connected units |
| Fuel truck | 8.0 × 2.5 × 3.0 | Hose deployment changes footprint |
| Catering truck | 7.0 × 2.5 × 4.0 | Scissor lift changes height |
| FOD | 0.05-0.3 × 0.05-0.3 × 0.05 | Tiny, ground-level |

**Estimated annotation speed:** 20-40 3D boxes per hour per annotator (experienced). Airside objects are harder than cars — unusual shapes, varying configurations.

---

## 2. Open-Source 3D Annotation Tools

### 2.1 CVAT (Computer Vision Annotation Tool)

**Best for:** Teams, multi-format support, integration with auto-labeling

```
Setup:
  docker-compose up -d  # Self-hosted
  # Or use app.cvat.ai (cloud, free tier available)

3D Support:
  - 3D cuboid annotation on point clouds (Velodyne, custom formats)
  - Supports PCD, PLY, BIN point cloud formats
  - Timeline scrubbing for sequential frames
  - Interpolation between keyframes (reduces annotation by ~5x)

Strengths:
  + Most mature open-source option
  + Team collaboration (multi-user, review workflows)
  + REST API for automation
  + Active development (Intel)

Limitations:
  - 3D UI can be slow with large point clouds (>100K points)
  - No native support for multi-LiDAR merged clouds
  - Limited 3D auto-annotation integration
```

### 2.2 Label Studio

```
3D Support Status: Limited
  - 3D point cloud annotation via plugin (community)
  - Not as mature as CVAT for 3D
  - Better for image/text annotation

Verdict: Use CVAT for 3D, Label Studio for 2D camera annotation
```

### 2.3 SUSTechPOINTS

**Best for:** Research, fast 3D annotation

```
GitHub: github.com/naurril/SUSTechPOINTS
Setup: Web-based, runs locally

Features:
  - Purpose-built for LiDAR point cloud annotation
  - Supports BIN/PCD formats
  - Auto-annotation via pre-trained models
  - Ground removal tool
  - One-click box fitting from point selection
  - Frame interpolation

Verdict: Good for small-scale research annotation. Less team features than CVAT.
```

### 2.4 3D-BAT (3D Bounding Box Annotation Tool)

```
GitHub: github.com/walzimmer/3d-bat
Focus: Multi-sensor (camera + LiDAR) synchronized annotation
Feature: Project 3D boxes onto camera images for verification
Verdict: Useful when you add cameras and need cross-modal verification
```

### 2.5 scalabel

```
GitHub: github.com/scalabel/scalabel (Berkeley)
Focus: Designed for BDD100K driving dataset creation
Features: 3D box tracking, category hierarchy, export to multiple formats
Verdict: Good alternative to CVAT with driving-specific features
```

---

## 3. Commercial Annotation Services

| Service | 3D LiDAR Support | Pricing | Turnaround | Quality |
|---------|------------------|---------|------------|---------|
| **Scale AI** | Yes (primary focus) | $0.50-2.00/box | 24-72 hours | High (ML-assisted + human) |
| **Labelbox** | Yes | Custom | Varies | High |
| **V7** | Yes (Darwin) | $0.30-1.50/box | 24-48 hours | Medium-High |
| **Segments.ai** | Yes | $0.20-1.00/box | Varies | Medium |
| **Supervisely** | Yes | $0.40-1.50/box | 24-72 hours | High |
| **Kognic** | Yes (automotive-focused) | Custom | Custom | Very High (AV-specific) |

**For airside:** Consider Kognic or Scale AI — they understand AV annotation requirements. Budget ~$1-2 per 3D box for quality annotations.

**Cost estimate for initial airside dataset:**
```
1,000 frames × 15 objects/frame = 15,000 boxes
At $1.50/box = $22,500
Or: self-annotate with auto-labeling pipeline (slower, cheaper)
```

---

## 4. Auto-Labeling Pipeline

### 4.1 The Active Learning Loop

```
Iteration 0: Run nuScenes-pretrained CenterPoint on airside data
  → Noisy labels (wrong classes, missed objects, false positives)
  → Human corrects 200-500 frames (1-2 days of annotation)

Iteration 1: Fine-tune CenterPoint on corrected 200-500 frames
  → Better labels (correct classes, fewer missed objects)
  → Human corrects another 200-500 frames (focus on hard cases)

Iteration 2: Fine-tune on accumulated 400-1000 frames
  → Good labels (most objects detected correctly)
  → Human corrects only the mistakes (~100 frames)

Iteration 3+: Continue until quality plateaus
  → Typically 3-5 iterations, total 500-1500 manually corrected frames
```

### 4.2 Auto-Label Quality Tiers

```python
def tier_detections(detections, thresholds):
    """Sort auto-labels into quality tiers for review prioritization."""
    tiers = {
        'auto_accept': [],    # score > 0.85, use without review
        'spot_check': [],     # 0.6 < score < 0.85, review 10%
        'human_review': [],   # 0.3 < score < 0.6, review all
        'reject': [],         # score < 0.3, discard
    }

    for det in detections:
        if det['score'] > 0.85:
            tiers['auto_accept'].append(det)
        elif det['score'] > 0.6:
            tiers['spot_check'].append(det)
        elif det['score'] > 0.3:
            tiers['human_review'].append(det)
        else:
            tiers['reject'].append(det)

    return tiers

# Expected distribution after Iteration 2:
#   auto_accept: ~60% of detections
#   spot_check: ~20%
#   human_review: ~15%
#   reject: ~5%
# Total human effort: review ~35% of detections (vs 100% from scratch)
```

### 4.3 Foundation Model-Assisted Annotation (When Cameras Available)

```
Pipeline:
  1. Camera image → Grounding DINO (text prompt: "baggage tractor")
     → 2D bounding boxes with class labels

  2. SAM/SAM 2 → instance segmentation masks from Grounding DINO boxes

  3. LiDAR point cloud → project into camera frame
     → Select LiDAR points within SAM mask

  4. Selected LiDAR points → fit 3D bounding box
     → L-shape fitting or minimum bounding box

  5. Human reviews 3D box → adjusts size, position, heading

This reduces annotation from:
  "Draw a 3D box from scratch" (60-90 seconds/object)
  to: "Verify and adjust a pre-fitted box" (10-20 seconds/object)
  = 4-6x speedup
```

---

## 5. Annotation Format Standards

### 5.1 3D Bounding Box Specification

```
A 3D bounding box is defined by 7 parameters:
  (x, y, z, dx, dy, dz, heading)

  x, y, z: Center of the box in vehicle coordinates [meters]
  dx: Length (along heading direction) [meters]
  dy: Width (perpendicular to heading) [meters]
  dz: Height [meters]
  heading: Yaw angle [radians], measured from x-axis (forward)

Vehicle coordinate system (matching RoboSense/nuScenes):
  x: forward
  y: left
  z: up
  Origin: rear axle center
```

### 5.2 Format Comparison

| Format | Used By | Box Representation | Extras |
|--------|---------|-------------------|--------|
| **KITTI** | KITTI benchmark | (h,w,l,x,y,z,ry) — camera frame! | Truncation, occlusion levels |
| **nuScenes** | nuScenes devkit | (x,y,z,w,l,h) + quaternion | Velocity, visibility, attributes |
| **Waymo** | Waymo OD | (cx,cy,cz,l,w,h,heading) | Speed, acceleration |
| **OpenLABEL** | ASAM standard | JSON-LD, flexible | Most interoperable |
| **OpenPCDet** | OpenPCDet framework | (x,y,z,dx,dy,dz,heading) | Simple, direct |

**Recommendation:** Use **OpenPCDet format** for training (simplest), export to **nuScenes format** for sharing/benchmarking.

---

## 6. Airside Annotation Guidelines

### 6.1 Class Taxonomy

```yaml
classes:
  # Primary (always annotate)
  - aircraft          # Any aircraft, regardless of type
  - baggage_tractor   # Tow tractor for baggage carts
  - belt_loader       # Conveyor belt loader
  - pushback_tug      # Aircraft pushback vehicle (towbar or towbarless)
  - ground_crew       # Airport ground personnel (any role)
  - uld_container     # Unit Load Device (on dolly or standalone)
  - trailer           # Baggage/cargo trailer (single unit)

  # Secondary (annotate when present)
  - fuel_truck        # Aircraft refueling vehicle
  - catering_truck    # Catering/provisioning vehicle (scissor lift)
  - maintenance_vehicle # Maintenance/support vehicle
  - fire_truck        # Airport rescue and firefighting vehicle
  - follow_me_car     # Follow-me/marshalling vehicle
  - de_icing_truck    # De-icing/anti-icing vehicle

  # Optional
  - dolly_train       # Connected string of baggage dollies
  - gpu               # Ground Power Unit
  - passenger_stairs  # Mobile passenger stairway
  - apron_bus         # Passenger transfer bus
  - fod               # Foreign Object Debris (ground-level)
```

### 6.2 Annotation Rules

```
1. ANNOTATE if: Object is within 80m range AND has ≥ 10 LiDAR points
2. SKIP if: Object is beyond 80m OR has < 10 points (too sparse)
3. OCCLUDED objects: Annotate if ≥ 30% visible, mark occlusion level (0-3)
4. AIRCRAFT: Use tight box around fuselage only (not wings extending beyond sensors)
   - Mark aircraft_type attribute if identifiable (A320, B737, etc.)
5. DOLLY TRAINS: Annotate each dolly separately, not the whole train as one box
6. GROUND CREW: Annotate even if small — safety-critical class
7. FOD: Only annotate if clearly visible (≥ 5 points, ground-level, < 0.5m height)
8. HEADING: Point in the direction of travel (or forward direction for stationary vehicles)
```

### 6.3 Quality Metrics

```
Inter-Annotator Agreement (IAA):
  IoU threshold: 0.5 for position, 0.7 for size
  Heading tolerance: ±15°
  Target IAA: > 0.85 for primary classes, > 0.75 for secondary

Quality checks per batch:
  - Random sample 10% of frames for double-annotation
  - Compare IAA metrics
  - Flag annotators below threshold for retraining
  - Flag frames with > 30% disagreement for expert review
```

---

## 7. Recommended Workflow

```
Phase 1: Bootstrap (Week 1-2)
├── Run CenterPoint (nuScenes pretrained) on 500 frames
├── Export detections as initial labels
├── Correct 200 frames in CVAT (primary classes only)
├── Fine-tune CenterPoint on corrected data
└── Deliverable: First airside detector, ~40% mAP

Phase 2: Iterate (Week 2-4)
├── Auto-label remaining frames with improved model
├── Correct another 300 frames (focus on missed objects)
├── Add secondary classes
├── Fine-tune again
└── Deliverable: Improved detector, ~55% mAP

Phase 3: Scale (Week 4-8)
├── Process all available bag data through auto-labeler
├── Spot-check auto-labels (10% review rate)
├── Add camera-assisted annotation when cameras available
├── Build evaluation set (100 frames, exhaustively annotated)
└── Deliverable: Production-quality detector, ~65%+ mAP

Phase 4: Continuous (Ongoing)
├── Active learning: mine hard examples from fleet
├── Human annotates model failures
├── Retrain monthly
└── Target: >75% mAP with < 5% review rate
```

---

## Sources

- CVAT: github.com/opencv/cvat
- SUSTechPOINTS: github.com/naurril/SUSTechPOINTS
- scalabel: github.com/scalabel/scalabel
- OpenPCDet: github.com/open-mmlab/OpenPCDet
- Scale AI documentation
- nuScenes annotation format specification
- KITTI benchmark format specification
