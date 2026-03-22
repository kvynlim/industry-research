# ML Model POC Proposals for Airside AV

## Proof-of-Concept Models Derived from Research Corpus

**Context:** These POCs are prioritized by impact, feasibility with current hardware (LiDAR-only, RoboSense RSHELIOS/RSBP, ROS Noetic), and pathway to the larger world model vision. Each POC is designed to demonstrate concrete value independently while building toward the full architecture.

---

## POC Priority Matrix

| # | POC Name | Data Needed | Hardware | Timeline | Impact | Risk |
|---|----------|-------------|----------|----------|--------|------|
| 1 | LiDAR Scene Prediction | Existing bags (self-supervised) | 1x A100 (cloud) | 2-4 weeks | Very High | Low |
| 2 | Learned 3D Detection | Existing bags + auto-labels | 1x A100 (cloud) | 3-5 weeks | High | Low |
| 3 | Prediction-Aware Planner | POC 1 output | On-vehicle (Orin) | 2-3 weeks | Very High | Medium |
| 4 | Jet Blast Hazard Mapping | ADS-B receiver ($30) | Laptop | 1-2 weeks | High | Very Low |
| 5 | LiDAR Anomaly / FOD Detection | Existing PCD maps + bags | Laptop/GPU | 2-3 weeks | High | Low |
| 6 | Airside Digital Twin | Existing PCD maps | 1x A100 | 2-4 weeks | Medium | Medium |
| 7 | Open-Vocab GSE Detection | Cameras (new hardware) | Orin | 1-2 weeks | High | Low |
| 8 | Turnaround Phase Estimator | A-CDM/AODB data + bags | Laptop | 3-5 weeks | Medium | Medium |

---

## POC 1: LiDAR Scene Prediction (Self-Supervised Occupancy World Model)

### What It Does
Predicts the future 3D occupancy of the airside environment 2-4 seconds ahead, using only past LiDAR frames. No labels needed — the model learns by predicting the next LiDAR frame from past ones.

### Why It Matters
- **Prediction is the single biggest capability gap** in the current stack. The Frenet planner treats everything as static.
- Self-supervised = works immediately on your existing bag data with zero annotation effort.
- Directly demonstrates "world model" capability in the airside domain.
- Foundation for POC 3 (prediction-aware planner).

### Architecture

```
Input: 8 past BEV occupancy grids (from LiDAR accumulation)
  │
  ├── PointPillars BEV encoder (pre-trained on nuScenes, fine-tuned)
  │   → BEV features: (256, 128, 128) per frame
  │
  ├── VQ-VAE Tokenizer
  │   → 512-code codebook, 128x128 token grid per frame
  │
  ├── Causal Transformer (6 layers, 8 heads)
  │   → Predicts next 4-8 token grids autoregressively
  │
  └── VQ-VAE Decoder
      → Future occupancy: (4, 128, 128, 16) — 4 steps × BEV × height bins

Loss: Next-frame prediction (cross-entropy on tokens)
      + Occupancy reconstruction (binary cross-entropy on occupied/free)
```

### Training Recipe

```yaml
# Phase 1: BEV encoder (nuScenes pre-train)
model: PointPillars
dataset: nuScenes (28K frames)
gpu: 1x A100
time: 6-8 hours
result: BEV feature extractor

# Phase 2: Self-supervised on airside bags
model: VQ-VAE + Transformer
dataset: Your bags → extracted BEV sequences (50-200 hours)
gpu: 1x A100
time: 24-48 hours
labels_needed: NONE (self-supervised next-frame prediction)
result: Airside occupancy world model

# Phase 3: Evaluate
metrics:
  - Occupancy IoU @ 1s, 2s, 4s ahead
  - Chamfer distance (predicted vs actual point cloud)
  - Qualitative: visualize predictions overlaid on ground truth
```

### What Success Looks Like
- IoU > 0.3 at 1s, > 0.2 at 2s on airside data (first iteration)
- Model correctly predicts that a moving vehicle continues moving
- Model predicts that a static aircraft remains static
- Model handles the ego vehicle's own motion correctly

### Quick Start (7-Day Plan from E2E Pipeline Report)
- Days 1-2: Extract BEV sequences from bags, set up training environment
- Days 3-4: Train VQ-VAE tokenizer, then transformer
- Days 5-6: Evaluate, visualize predictions
- Day 7: Offline replay on vehicle data, identify failure modes

### Key Repos
- [OccWorld](https://github.com/wzzheng/OccWorld) — reference implementation
- [OpenPCDet](https://github.com/open-mmlab/OpenPCDet) — PointPillars BEV encoder
- [OpenDWM](https://github.com/SenseTime-FVG/OpenDWM) — driving world model framework

### Effort: 2-4 weeks, 1 ML engineer, ~$200-500 cloud GPU

---

## POC 2: Learned 3D Object Detection (CenterPoint on Airside LiDAR)

### What It Does
Replaces RANSAC-based segmentation with a neural network that detects and classifies 10+ object types from LiDAR point clouds, including objects the current stack can't detect (aircraft, ground crew, other GSE).

### Why It Matters
- Current stack detects only 3 object types (deck, ULD, trailer) via hand-crafted RANSAC.
- A learned detector handles **any object type** with training data.
- Auto-labeling with nuScenes-pretrained model bootstraps the annotation process.
- Direct improvement to safety — detecting ground crew and aircraft is critical.

### Architecture

```
Input: Aggregated LiDAR point cloud (N, 4) from /pointcloud_aggregator/output
  │
  ├── Pillar Feature Encoder (PointPillars)
  │   → Pillar features scattered to BEV grid
  │
  ├── 2D CNN Backbone (ResNet-based)
  │   → Multi-scale BEV features
  │
  └── CenterPoint Head
      → Heatmaps per class (center detection)
      → Regression: size (dx, dy, dz), offset, heading, velocity
      → Output: DetectedObjectArray (matches your existing message type)
```

### Training Pipeline

```
Step 1: Auto-label with nuScenes-pretrained CenterPoint
  - Run inference on your bags
  - Get noisy detections (cars/trucks detected, aircraft detected as "barrier")
  - Filter by confidence > 0.5

Step 2: Human review and correction
  - Correct class labels (barrier → aircraft, truck → baggage_tractor)
  - Add missed detections
  - ~2-3 days of annotation for initial dataset

Step 3: Fine-tune on corrected airside labels
  - LoRA or full fine-tune (500-1,000 labeled frames sufficient)
  - Custom classes: aircraft, baggage_tractor, belt_loader, pushback_tug,
                    ground_crew, ULD, trailer, fuel_truck, maintenance_vehicle

Step 4: Deploy as ROS node
  - TensorRT FP16 on Orin: ~7ms per frame (PointPillars) or ~20ms (CenterPoint)
  - Publishes to /obstacle_detector/detected_objects (same topic as current stack)
  - Drop-in replacement for RANSAC pipeline
```

### What Success Looks Like
- Detects aircraft at > 50m range (current stack: no aircraft detection)
- Detects ground crew (current stack: invisible)
- mAP > 40% on airside test set after fine-tuning
- Latency < 25ms on Orin (fits in 10Hz perception loop)

### Key Repos
- [OpenPCDet](https://github.com/open-mmlab/OpenPCDet) — CenterPoint implementation
- [NVIDIA Lidar_AI_Solution](https://github.com/NVIDIA-AI-IOT/Lidar_AI_Solution) — TensorRT optimized

### Effort: 3-5 weeks (includes 1 week annotation), 1 ML engineer, ~$300 cloud GPU

---

## POC 3: Prediction-Aware Frenet Planner

### What It Does
Augments the existing Frenet planner by scoring its 420 trajectory candidates against the world model's predicted future occupancy. The planner still generates candidates the same way — but now it knows which trajectories will lead to future conflicts.

### Why It Matters
- **Zero-risk upgrade** — your existing planner is unchanged, just better-informed.
- Transforms the planner from reactive (dodge current obstacles) to predictive (avoid future conflicts).
- Directly uses POC 1 output — this is where the world model delivers planning value.
- Path to fully learned planning without replacing anything.

### Architecture

```
Existing Frenet Planner generates 420 trajectory candidates
  │
  │ For each candidate (batched on GPU):
  │
  ├── Feed trajectory as ego-action to world model (POC 1)
  │   → Predicted occupancy for that trajectory: (4, 128, 128, 16)
  │
  ├── Compute world model costs:
  │   ├── Collision cost: sum(occupancy × ego_footprint) across future timesteps
  │   ├── Hazard proximity: min distance to occupied voxels along trajectory
  │   └── Prediction confidence: mean entropy of predicted occupancy
  │
  ├── Combine with existing Frenet costs:
  │   ├── Path smoothness (existing)
  │   ├── Lateral deviation (existing)
  │   ├── Velocity match (existing)
  │   └── World model costs (new, weighted)
  │
  └── Select trajectory with lowest combined cost

Result: Same planner behavior in easy cases,
        MUCH better behavior when other agents are moving
```

### Implementation

```python
# Key addition to LocalPlanningNodelet (or Python wrapper)
class WorldModelCostEvaluator:
    def __init__(self, world_model_path):
        self.world_model = load_tensorrt_engine(world_model_path)

    def score_trajectories(self, candidates, current_occupancy_history):
        """Score N trajectory candidates against world model predictions."""
        # Batch all candidates
        batch_actions = torch.stack([traj_to_action(c) for c in candidates])  # (N, T, 3)

        # Single batched forward pass through world model
        predicted_occupancy = self.world_model.predict_batch(
            past=current_occupancy_history,  # (8, 128, 128, 16)
            actions=batch_actions              # (N, T, 3)
        )  # (N, 4, 128, 128, 16)

        # Compute collision costs for all candidates simultaneously
        ego_footprints = compute_ego_footprints(candidates)  # (N, T, H, W)
        collision_costs = (predicted_occupancy * ego_footprints).sum(dim=(1,2,3,4))

        return collision_costs  # (N,) — one score per candidate
```

### What Success Looks Like
- Planner avoids trajectories that lead to future conflicts with moving vehicles
- In simulation: fewer near-miss events compared to traditional Frenet
- In shadow mode: world-model-augmented planner agrees with human driver more often than baseline planner
- Latency: < 20ms additional per planning cycle (batched GPU inference)

### Dependency: Requires POC 1 (world model) to be working first

### Effort: 2-3 weeks, 1 ML + 1 systems engineer, minimal cloud cost (inference only)

---

## POC 4: Jet Blast Hazard Mapping

### What It Does
Computes real-time jet blast hazard zones from ADS-B aircraft positions and publishes them as hazard occupancy in the planning layer. No ML needed — this is a lookup table + geometry computation, but it's a critical safety feature no competitor has.

### Why It Matters
- **Safety-critical** — jet blast can damage vehicles and injure personnel.
- B737-800 breakaway thrust creates a 148m hazard zone behind engines.
- No existing airside AV system accounts for jet blast dynamically.
- Extremely low cost to implement, high safety value.
- Feeds directly into the occupancy grid framework (POC 1/3).

### Architecture

```
ADS-B Receiver ($30 RTL-SDR + antenna)
  │
  ├── dump1090/readsb → aircraft positions, types, headings
  │
  ├── Aircraft Type Lookup
  │   → Engine configuration, thrust parameters
  │   → Jet blast envelope (from published data / CFD tables)
  │
  ├── Hazard Zone Computation
  │   → For each aircraft: position + heading + engine status
  │   → Compute hazard polygon extending behind engines
  │   → 3 zones: DANGER (>65 kt), CAUTION (>35 kt), ADVISORY (>15 kt)
  │
  └── Publish as ROS topic
      → /jet_blast/hazard_zones (PolygonArray or OccupancyGrid)
      → Consumed by planner as no-go zones
```

### Jet Blast Zone Data (from Research Report 17)

| Aircraft | Idle | Breakaway | Takeoff |
|----------|------|-----------|---------|
| B737-800 | 28m / 35kt | 148m / 35kt | 275m+ |
| A320 | 18m | 29m | 200m+ |
| B777 | 40m | 180m+ | 400m+ |
| A380 | 55m | 250m+ | 500m+ |

### Implementation

```python
JET_BLAST_DB = {
    'B738': {'idle_35kt': 28, 'breakaway_35kt': 148, 'engine_count': 2, 'engine_offset_m': 5.8},
    'A320': {'idle_35kt': 18, 'breakaway_35kt': 29, 'engine_count': 2, 'engine_offset_m': 5.4},
    'B77W': {'idle_35kt': 40, 'breakaway_35kt': 180, 'engine_count': 2, 'engine_offset_m': 9.1},
    # ... more aircraft types
}

def compute_jet_blast_zone(aircraft_type, position, heading, thrust_state='idle'):
    """Compute jet blast hazard polygon for an aircraft."""
    params = JET_BLAST_DB.get(aircraft_type, JET_BLAST_DB['B738'])  # default to B738

    if thrust_state == 'idle':
        length = params['idle_35kt']
    elif thrust_state == 'breakaway':
        length = params['breakaway_35kt']
    else:
        length = params['idle_35kt']

    # Compute cone extending behind aircraft
    # Opening angle ~15° from centerline
    cone = compute_cone_polygon(
        apex=position,
        direction=heading + 180,  # behind aircraft
        length=length,
        half_angle=15,
        engine_offset=params['engine_offset_m'],
        engine_count=params['engine_count']
    )
    return cone
```

### What Success Looks Like
- Real-time display of jet blast zones overlaid on map in RViz
- Planner automatically routes around active jet blast zones
- Correct zone sizing for 5+ aircraft types
- Updates within 1s of aircraft engine state change

### Effort: 1-2 weeks, 1 engineer, $30 hardware (RTL-SDR)

---

## POC 5: LiDAR Anomaly / FOD Detection

### What It Does
Detects unexpected objects on the apron surface by comparing current LiDAR scans against a reference map. Anything present in the current scan but absent from the reference map is flagged as an anomaly (potential FOD).

### Why It Matters
- FOD causes $13B in aircraft damage annually (IATA estimate).
- Current airside FOD detection is done by manual visual inspection or expensive dedicated systems (Tarsier radar: $1M+).
- Your vehicles already have LiDAR scanning the apron — this is free sensing.
- No training data needed — purely geometric comparison.

### Architecture

```
Reference: PCD map (you have two: 517_Combined_Road_Map.pcd, T3_A2_A11_A18_BHA.pcd)
Current:   Live LiDAR scan (aggregated, ego-compensated)

Algorithm:
1. Localize current scan in reference map (GTSAM already does this)
2. For each point in current scan:
   a. Find nearest neighbor in reference map
   b. If distance > threshold (e.g., 0.3m) → novel point
3. Cluster novel points
4. Filter clusters:
   - Remove known dynamic objects (from POC 2 detections)
   - Remove noise (clusters < 5 points)
   - Remove points above 0.5m (vehicles, not ground-level FOD)
5. Remaining ground-level clusters = potential FOD
6. Persistent clusters (present for > 3 frames) = confirmed anomaly
```

### Implementation

```python
import open3d as o3d
import numpy as np

def detect_anomalies(current_scan, reference_map, ego_pose,
                     distance_threshold=0.3, min_cluster_size=5,
                     max_height=0.5):
    """Detect novel objects not in reference map."""
    # Transform current scan to map frame
    current_map = transform_pointcloud(current_scan, ego_pose)

    # Build KD-tree of reference map (do once, cache)
    ref_tree = o3d.geometry.KDTreeFlann(reference_map)

    # Find novel points
    novel_points = []
    for point in current_map.points:
        [_, idx, dist] = ref_tree.search_knn_vector_3d(point, 1)
        if dist[0] > distance_threshold ** 2:  # squared distance
            if point[2] < max_height:  # ground-level only
                novel_points.append(point)

    if len(novel_points) < min_cluster_size:
        return []

    # Cluster novel points
    novel_cloud = o3d.geometry.PointCloud()
    novel_cloud.points = o3d.utility.Vector3dVector(novel_points)
    labels = np.array(novel_cloud.cluster_dbscan(eps=0.5, min_points=min_cluster_size))

    # Extract cluster centroids and sizes
    anomalies = []
    for label in set(labels):
        if label == -1:
            continue
        cluster = np.array(novel_points)[labels == label]
        anomalies.append({
            'centroid': cluster.mean(axis=0),
            'size': cluster.max(axis=0) - cluster.min(axis=0),
            'point_count': len(cluster),
            'confidence': min(1.0, len(cluster) / 20),  # more points = higher confidence
        })

    return anomalies
```

### What Success Looks Like
- Detects a placed object (e.g., traffic cone, toolbox) on the apron within 25m range
- Low false positive rate (< 5 false alarms per hour after filtering)
- Detection within 1-2 seconds of object appearing
- Works with existing PCD maps — no additional data collection

### Effort: 2-3 weeks, 1 engineer, no cloud cost (runs on CPU)

---

## POC 6: Airside Digital Twin (3DGS Reconstruction)

### What It Does
Reconstructs your operating airport as a photorealistic 3D Gaussian Splatting scene from accumulated LiDAR data. Enables novel-view rendering and synthetic sensor simulation for testing.

### Why It Matters
- Your kinematic sim (aurrigo_python_sim) has no 3D scene — cannot test perception.
- A 3DGS twin enables closed-loop testing with rendered LiDAR.
- Foundation for synthetic data generation (POC 1 training data amplification).
- No one else in airside AV has this — competitive advantage.

### Pipeline

```
Input: Your PCD maps + ego trajectories from bags
  │
  ├── Step 1: Preprocess PCD maps
  │   - Voxel downsample (0.05m)
  │   - Remove dynamic objects (use timestamps + RANSAC)
  │   - Colorize from LiDAR intensity → grayscale
  │
  ├── Step 2: Seed 3D Gaussians
  │   - Position: from point cloud points
  │   - Scale: from k-NN distances
  │   - Color: from intensity
  │   - Opacity: initialized to 0.5
  │
  ├── Step 3: Optimize Gaussians
  │   - Loss: L1 + SSIM on rendered vs. ground truth depth/intensity images
  │   - 30,000 iterations, ~1 hour on A100
  │   - Adaptive densification and pruning
  │
  └── Step 4: Validate
      - Render novel views, compare to held-out LiDAR scans
      - Check ground plane quality (critical for driving)
      - Measure PSNR, SSIM, LPIPS
```

### Tools
- [gsplat](https://github.com/nerfstudio-project/gsplat) — fast Gaussian rasterizer
- [nerfstudio](https://github.com/nerfstudio-project/nerfstudio) — 3DGS support
- [GS-LiDAR](https://github.com/GS-LiDAR/GS-LiDAR) — LiDAR-native 3DGS

### Effort: 2-4 weeks, 1 engineer, ~$100-200 cloud GPU

---

## POC 7: Open-Vocabulary GSE Detection (Requires Cameras)

### What It Does
Zero-shot detection of all airside object types using text prompts — no airside-specific training data needed. Detects "baggage tractor", "belt loader", "aircraft nose gear", "ground crew in hi-vis" from text descriptions alone.

### Why It Matters
- 30+ types of GSE, 100+ aircraft variants — impossible to annotate all classes.
- Works day one with cameras, no training.
- YOLO-World runs at 52 FPS on standard GPU, feasible on Orin.
- Produces labels for training the LiDAR detector (POC 2) via camera-LiDAR projection.

### Architecture

```
Camera image (any resolution)
  │
  ├── YOLO-World (re-parameterized, text encoder removed at deploy)
  │   Prompts (embedded offline):
  │     "baggage tractor", "belt loader", "pushback tug",
  │     "fuel truck", "catering truck", "aircraft",
  │     "ground crew", "follow me car", "ULD container"
  │   → 2D bounding boxes + class + confidence
  │
  ├── Optional: Grounded-SAM for segmentation
  │   → Instance masks for each detection
  │
  └── 2D-to-3D lifting (using LiDAR depth)
      → Project 2D boxes into LiDAR point cloud
      → 3D bounding boxes via frustum PointNets or simple clustering
```

### Prerequisites: Camera hardware mounted on vehicle

### Effort: 1-2 weeks once cameras available, 1 ML engineer

---

## POC 8: Turnaround Phase Estimator

### What It Does
Estimates which phase of the aircraft turnaround each gate/stand is in (arrival → unloading → loading → pushback), and predicts when the next phase transition will occur. Enables just-in-time GSE dispatch.

### Why It Matters
- Knowing turnaround phase = knowing when pushback will happen = route planning.
- Reduces idle time for autonomous GSE (don't arrive too early, don't be late).
- Moonware HALO achieves 20% delay reduction with similar approach.
- Differentiator from competitors who don't use operational context.

### Architecture

```
Inputs:
  ├── A-CDM milestones (if available): AIBT, TOBT, TSAT
  ├── ADS-B: aircraft arrival/departure times
  ├── Historical patterns: average phase durations per aircraft type
  └── Optional: LiDAR/camera observation of stand activity

Model: Gradient Boosted Regression Tree (GBRT) or LSTM
  ├── Features: aircraft type, time since arrival, scheduled departure,
  │            historical mean durations, day of week, time of day
  └── Output: current phase (classification), time to next phase (regression)

Target: 80% phase accuracy, ±5 min pushback prediction
```

### Effort: 3-5 weeks, 1 ML engineer + airport ops data access

---

## Recommended Execution Order

```
Week 1-2:   POC 4 (Jet Blast)     — Immediate safety value, near-zero cost
            POC 5 (FOD Detection)  — Run in parallel, no ML needed

Week 2-4:   POC 1 (Scene Prediction) — Core world model, self-supervised
            POC 2 (3D Detection)      — Start auto-labeling in parallel

Week 4-6:   POC 3 (Prediction-Aware Planner) — Integrate POC 1 into planning
            POC 6 (Digital Twin)              — Start reconstruction

Week 6-8:   POC 7 (Open-Vocab, when cameras arrive)
            POC 8 (Turnaround, when airport data available)
```

### Total Estimated Cost

| Item | Cost |
|------|------|
| Cloud GPU (Phases 1-6) | $1,000-2,000 |
| ADS-B receiver | $30 |
| Camera hardware (POC 7) | $500-2,000 |
| Human annotation time | 40-80 hours |
| **Total** | **~$2,000-5,000** |

### Expected Outcomes After 8 Weeks

| Capability | Before | After |
|-----------|--------|-------|
| Object types detected | 3 (deck, ULD, trailer) | 10+ (aircraft, GSE, crew, FOD) |
| Future prediction | None | 2-4 seconds ahead |
| Jet blast awareness | None | Real-time hazard zones |
| FOD detection | None (manual inspection) | Automatic LiDAR anomaly detection |
| Planning intelligence | Reactive (static obstacles) | Predictive (future occupancy) |
| Simulation fidelity | Kinematic only (no 3D) | 3DGS digital twin with sensor sim |

---

## What This Builds Toward

Each POC is a building block for the full world model stack:

```
POC 1 (Scene Prediction) ────────────────────┐
POC 2 (3D Detection) ──→ BEV features ──────→│──→ WORLD MODEL CORE
POC 4 (Jet Blast) ──→ Hazard occupancy ─────→│
POC 5 (FOD) ──→ Anomaly occupancy ──────────→│
                                              │
POC 3 (Prediction-Aware Planner) ◄───────────┘──→ PLANNING LAYER
                                              │
POC 6 (Digital Twin) ────────────────────────→│──→ SIMULATION LAYER
POC 7 (Open-Vocab Detection) ───────────────→│──→ PERCEPTION LAYER
POC 8 (Turnaround Estimator) ───────────────→│──→ AIRPORT CONTEXT LAYER
```

When all POCs are integrated, you have the Simplex high-performance controller from the design spec — running in shadow mode alongside the current Aurrigo stack.
