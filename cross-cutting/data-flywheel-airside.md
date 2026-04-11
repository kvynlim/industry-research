# Closed-Loop Data Flywheel for Airside Autonomous Operations

## Executive Summary

The data flywheel is the core engine that transforms operational driving data into continuous model improvement. This document covers the **ML-centric closed loop** for Aurrigo's airside operations: trigger-based data mining, auto-labeling pipelines, active learning selection, model training orchestration, deployment validation, and production monitoring — the intelligence layer that sits on top of the fleet data pipeline infrastructure (see `cross-cutting/fleet-data-pipeline.md`). Tesla's data engine processes 160 petaflops daily across 10,000+ GPUs, training on billions of auto-labeled clips from 8.3B+ fleet miles. Waymo's content search system mines petabytes for specific scenarios. comma.ai's open fleet of 10,000+ devices enables rapid iteration with openpilot releasing every 2 weeks. For airport airside — where no public datasets exist and every frame has proprietary value — a well-designed flywheel is the difference between a static system and one that improves with every mile driven. This document provides the complete flywheel architecture scaled to Aurrigo's current fleet (5-20 vehicles) with a path to 100+ vehicles across multiple airports.

---

## Table of Contents

1. [The Data Flywheel Concept](#1-the-data-flywheel-concept)
2. [Trigger-Based Data Collection](#2-trigger-based-data-collection)
3. [Auto-Labeling Pipeline](#3-auto-labeling-pipeline)
4. [Active Learning and Data Selection](#4-active-learning-and-data-selection)
5. [Model Training Orchestration](#5-model-training-orchestration)
6. [Deployment Validation and A/B Testing](#6-deployment-validation-and-ab-testing)
7. [Production Monitoring and Feedback](#7-production-monitoring-and-feedback)
8. [Scenario Mining and Long-Tail Discovery](#8-scenario-mining-and-long-tail-discovery)
9. [Synthetic Data Augmentation](#9-synthetic-data-augmentation)
10. [Multi-Airport Transfer Learning](#10-multi-airport-transfer-learning)
11. [Metrics and KPIs](#11-metrics-and-kpis)
12. [Cost Model and Scaling](#12-cost-model-and-scaling)
13. [Implementation Roadmap](#13-implementation-roadmap)
14. [Key Takeaways](#14-key-takeaways)

---

## 1. The Data Flywheel Concept

### 1.1 What Makes a Flywheel, Not Just a Pipeline

A data **pipeline** moves data from vehicles to storage to training. A data **flywheel** creates a self-reinforcing cycle where each component's output improves the next:

```
┌─────────────────────────────────────────────────────────────────┐
│                     DATA FLYWHEEL                                │
│                                                                  │
│   ┌──────────┐    ┌───────────┐    ┌───────────┐               │
│   │ COLLECT  │───→│   MINE    │───→│   LABEL   │               │
│   │ (Fleet)  │    │ (Triggers)│    │ (Auto+QA) │               │
│   └────▲─────┘    └───────────┘    └─────┬─────┘               │
│        │                                  │                      │
│        │                                  ▼                      │
│   ┌────┴─────┐    ┌───────────┐    ┌───────────┐               │
│   │ DEPLOY   │←───│ VALIDATE  │←───│   TRAIN   │               │
│   │ (OTA)    │    │ (Shadow)  │    │ (GPU/TPU) │               │
│   └────┬─────┘    └───────────┘    └───────────┘               │
│        │                                                         │
│        ▼                                                         │
│   ┌──────────┐                                                  │
│   │ MONITOR  │──→ New triggers, failure cases, edge cases        │
│   │(Prod KPIs)│   feed back into COLLECT and MINE               │
│   └──────────┘                                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

The flywheel **accelerates**: more vehicles → more data → better models → fewer interventions → higher customer confidence → more deployments → more vehicles.

### 1.2 Industry Data Flywheel Benchmarks

| Company | Fleet Size | Data Volume | Training Compute | Release Cadence | Key Metric |
|---------|-----------|-------------|-----------------|-----------------|------------|
| **Tesla** | 6M+ vehicles | 160 PF-days/training run | 10,000+ H100s (Cortex) | Bi-weekly | Miles between interventions |
| **Waymo** | 2,500+ robotaxis | PB/day | 100,000+ TPUv4 | Continuous | Miles per contact |
| **comma.ai** | 10,000+ devices | TB/day (uploaded subset) | ~500 GPUs | Bi-weekly | % engaged miles |
| **Cruise** (pre-pause) | 400+ vehicles | 50TB/day | ~5,000 GPUs | Monthly | Trips between issues |
| **Aurrigo** (current) | 5-20 vehicles | 200GB-1TB/day | 0 (no ML training) | N/A | N/A |
| **Aurrigo** (target) | 50-100 vehicles | 5-10TB/day | 8-64 GPUs | Monthly | Missions per intervention |

### 1.3 Why Airside Demands a Flywheel

The airside environment has characteristics that make a data flywheel especially critical:

1. **No public datasets**: Cannot rely on academic benchmarks. Must build everything from operational data
2. **Long-tail safety events**: Near-miss with aircraft, FOD encounter, jet blast exposure — rare but must be captured and trained on
3. **Environment diversity**: Each airport is different (layout, aircraft types, ground equipment, weather patterns)
4. **Regulatory evidence**: Safety cases require demonstrating continuous improvement from operational data
5. **High stakes per error**: $250K average aircraft damage from GSE collision, potential $139M+ for structural damage
6. **Seasonal variation**: Snow, de-icing operations, heat shimmer, different lighting — a summer model may fail in winter

---

## 2. Trigger-Based Data Collection

### 2.1 Why Not Upload Everything?

With 4-8 RoboSense LiDARs + cameras, each Aurrigo vehicle generates 200-400 GB/day. Uploading everything is:
- **Expensive**: At $0.09/GB S3 storage, 10 vehicles × 300GB/day × 365 days = $98K/year in storage alone
- **Wasteful**: 95%+ of driving is routine (straight taxiway, empty apron) — low information value
- **Bandwidth-constrained**: Airport 5G upload realistic at ~100 Mbps → 1.1 TB/day max per vehicle

**Solution**: intelligent trigger-based collection that uploads only high-value data.

### 2.2 Trigger Taxonomy

| Trigger Category | Trigger | Upload Priority | Data Window | Estimated Frequency |
|-----------------|---------|-----------------|-------------|-------------------|
| **Safety** | Operator intervention (e-stop, takeover) | Critical | -30s to +10s | 1-5/day |
| **Safety** | Minimum clearance violation (<3m to aircraft) | Critical | -15s to +5s | 0-2/day |
| **Safety** | Emergency stop triggered | Critical | -30s to +10s | 0-1/day |
| **Safety** | Speed limit violation | High | -10s to +5s | 0-5/day |
| **Perception** | Detection confidence drop (<0.5) | High | -5s to +5s | 5-20/day |
| **Perception** | Tracking ID switch or loss | High | -10s to +5s | 10-30/day |
| **Perception** | Novel object (no class match >0.3) | High | -5s to +10s | 2-10/day |
| **Perception** | Localization uncertainty spike | Medium | -5s to +5s | 5-15/day |
| **Planning** | Path deviation >1m from planned | Medium | -10s to +5s | 2-10/day |
| **Planning** | Unplanned stop (not at waypoint) | Medium | -5s to +10s | 5-20/day |
| **Environment** | Weather change (rain onset, fog) | Medium | -30s to +60s | 0-3/day |
| **Environment** | Night/dawn/dusk transition | Low | -60s to +60s | 2/day |
| **Random** | Time-based sampling (every 30 min) | Low | 30s window | 16-32/day |
| **Random** | Distance-based sampling (every 5 km) | Low | 30s window | 10-20/day |

### 2.3 On-Vehicle Trigger Engine

```python
class DataTriggerEngine:
    """On-vehicle trigger engine for intelligent data collection.
    
    Runs as ROS node, monitors topics, triggers bag recording.
    """
    
    def __init__(self):
        self.triggers = self.load_trigger_config()
        self.ring_buffer = RingBuffer(duration_sec=60)  # always buffering
        self.upload_queue = PriorityQueue()
        self.daily_budget_gb = 50  # max upload per day
        self.daily_uploaded_gb = 0
        
    def monitor(self, msg, topic):
        """Called for every subscribed message."""
        # Always write to ring buffer
        self.ring_buffer.write(msg, topic)
        
        # Check triggers
        for trigger in self.triggers:
            if trigger.topic == topic and trigger.evaluate(msg):
                self.fire_trigger(trigger, msg)
    
    def fire_trigger(self, trigger, msg):
        """Extract data window and queue for upload."""
        # Extract from ring buffer
        window = self.ring_buffer.extract(
            start=rospy.Time.now() - rospy.Duration(trigger.pre_seconds),
            end=rospy.Time.now() + rospy.Duration(trigger.post_seconds)
        )
        
        # Estimate data size
        size_gb = window.estimate_size_gb()
        
        # Budget check
        if self.daily_uploaded_gb + size_gb > self.daily_budget_gb:
            if trigger.priority < Priority.CRITICAL:
                rospy.logwarn(f"Budget exceeded, skipping {trigger.name}")
                return
        
        # Create upload package
        package = UploadPackage(
            trigger_name=trigger.name,
            trigger_type=trigger.category,
            priority=trigger.priority,
            timestamp=rospy.Time.now(),
            vehicle_id=self.vehicle_id,
            airport=self.airport_id,
            data=window,
            metadata={
                'ego_pose': self.current_pose,
                'weather': self.weather_state,
                'nearby_objects': self.perception_state.get_objects(),
                'model_version': self.model_version,
            }
        )
        
        self.upload_queue.put((-trigger.priority.value, package))
        self.daily_uploaded_gb += size_gb
```

### 2.4 Upload Budget Optimization

With a 50 GB/day budget per vehicle (realistic for airport 5G):

| Priority | Daily Allocation | Avg Clip Size | Clips/Day | Coverage |
|----------|-----------------|---------------|-----------|----------|
| Critical (safety) | 15 GB | 3 GB | 5 | 100% capture |
| High (perception) | 20 GB | 1 GB | 20 | ~60% capture |
| Medium (planning) | 10 GB | 0.5 GB | 20 | ~40% capture |
| Low (sampling) | 5 GB | 0.1 GB | 50 | Systematic |

**Expected data yield per vehicle per month:**
- ~150 critical safety events (all captured)
- ~400 perception edge cases (subset captured)
- ~300 planning anomalies (subset captured)
- ~1,500 random samples (systematic coverage)
- Total: ~1.5 TB/month of high-value data per vehicle

---

## 3. Auto-Labeling Pipeline

### 3.1 Why Auto-Labeling Is Essential

Manual 3D LiDAR labeling costs $8-15 per frame (3D bounding boxes) or $15-25 per frame (occupancy). At the volumes needed for ML training:

| Dataset Size | Manual Cost | Auto-Label + QA Cost | Savings |
|-------------|-------------|---------------------|---------|
| 10,000 frames | $80K-150K | $15K-25K | 70-85% |
| 50,000 frames | $400K-750K | $50K-80K | 80-88% |
| 200,000 frames | $1.6M-3M | $120K-200K | 88-93% |

Auto-labeling produces initial annotations using ML models, which are then reviewed and corrected by human annotators — dramatically reducing per-frame cost.

### 3.2 Auto-Labeling Architecture

```
Raw Sensor Data (LiDAR + Camera + IMU + GPS)
                    ↓
┌───────────────────────────────────────────────┐
│            AUTO-LABELING PIPELINE              │
│                                                │
│  ┌──────────────┐   ┌──────────────────────┐  │
│  │ Multi-Frame   │   │ Foundation Model     │  │
│  │ Accumulation  │   │ (DINOv2/SAM/CLIP)   │  │
│  │ (10-20 frames)│   │ Image-level labels   │  │
│  └──────┬───────┘   └──────────┬───────────┘  │
│         ↓                       ↓              │
│  ┌──────────────┐   ┌──────────────────────┐  │
│  │ Offline 3D   │   │ 2D→3D Label Lifting  │  │
│  │ Detection     │   │ (Project 2D labels   │  │
│  │ (Larger model)│   │  to 3D points)       │  │
│  └──────┬───────┘   └──────────┬───────────┘  │
│         ↓                       ↓              │
│  ┌────────────────────────────────────────┐   │
│  │     Label Fusion & Consensus           │   │
│  │  - Multi-model agreement               │   │
│  │  - Temporal consistency check           │   │
│  │  - Confidence scoring                   │   │
│  └──────────────┬─────────────────────────┘   │
│                  ↓                              │
│  ┌────────────────────────────────────────┐   │
│  │     Quality Gate                        │   │
│  │  - High confidence → auto-accept        │   │
│  │  - Medium → human review                │   │
│  │  - Low → discard or flag                │   │
│  └──────────────┬─────────────────────────┘   │
│                  ↓                              │
│         Auto-Labeled Dataset                   │
└───────────────────────────────────────────────┘
```

### 3.3 Offline Multi-Frame Detection

Unlike online (real-time) detection, offline auto-labeling can use:
- **Multi-frame accumulation**: Stack 10-20 LiDAR sweeps for dense point clouds
- **Larger models**: No latency constraint — use 200M+ parameter detectors
- **Bi-directional temporal context**: Future frames inform past detections
- **SLAM-refined poses**: Better alignment than real-time odometry

```python
class OfflineAutoLabeler:
    """Offline auto-labeling with multi-frame accumulation."""
    
    def __init__(self):
        self.detector = load_model('centerpoint_voxelnet_large')  # larger than real-time
        self.tracker = ABCTracker(max_age=30)
        self.foundation_model = DINOv2Backbone()
        self.slam_poses = None  # loaded from SLAM output
    
    def label_sequence(self, bag_path, slam_trajectory):
        """Auto-label an entire sequence."""
        self.slam_poses = slam_trajectory
        frames = self.load_frames(bag_path)
        
        # Forward pass: detect and track
        forward_tracks = self.forward_pass(frames)
        
        # Backward pass: detect and track (reversed)
        backward_tracks = self.backward_pass(frames)
        
        # Merge: bi-directional consensus
        merged_tracks = self.merge_bidirectional(forward_tracks, backward_tracks)
        
        # Smooth: temporal interpolation for missed detections
        smoothed = self.smooth_tracks(merged_tracks)
        
        # Multi-frame refinement: refine boxes using accumulated points
        refined = self.multiframe_refine(smoothed, frames)
        
        # Score confidence
        for track in refined:
            track.confidence = self.compute_confidence(track)
        
        return refined
    
    def multiframe_refine(self, tracks, frames):
        """Refine bounding boxes using accumulated point clouds."""
        for track in tracks:
            for det in track.detections:
                # Accumulate points from nearby frames
                accumulated = self.accumulate_points(
                    frames, det.timestamp, 
                    window=10,  # ±10 frames
                    box=det.box3d.expanded(1.5)  # search region
                )
                
                # Fit tight box to accumulated points
                refined_box = fit_oriented_bbox(accumulated)
                det.box3d = refined_box
                det.point_count = len(accumulated)
        
        return tracks
```

### 3.4 Foundation Model Labels

For semantic labels and novel object discovery:

```python
class FoundationModelLabeler:
    """Use foundation models for semantic auto-labeling."""
    
    def __init__(self):
        self.sam = SAM2()           # Segment Anything 2
        self.clip = CLIP()          # Language-image matching
        self.dinov2 = DINOv2()      # Visual features
        
        # Airside vocabulary
        self.airside_classes = [
            "aircraft", "baggage cart", "tug vehicle", "belt loader",
            "fuel truck", "catering truck", "ground crew person",
            "safety cone", "jet bridge", "fire truck", "ambulance",
            "pushback tractor", "GPU (ground power unit)", "air starter",
            "lavatory truck", "water truck", "de-icing vehicle",
            "cargo loader", "passenger stairs", "foreign object debris"
        ]
    
    def label_image(self, image, lidar_points_2d):
        """Generate semantic labels from camera images."""
        # SAM2: generate masks
        masks = self.sam.generate_masks(image)
        
        # CLIP: classify each mask
        labels = []
        for mask in masks:
            # Crop mask region
            crop = image * mask.unsqueeze(-1)
            
            # CLIP zero-shot classification
            similarities = self.clip.similarity(crop, self.airside_classes)
            best_class = self.airside_classes[similarities.argmax()]
            confidence = similarities.max().item()
            
            if confidence > 0.25:  # threshold
                labels.append(SemanticLabel(
                    mask=mask,
                    class_name=best_class,
                    confidence=confidence
                ))
        
        # Lift to 3D: project 2D labels to LiDAR points
        for label in labels:
            points_in_mask = lidar_points_2d[label.mask[lidar_points_2d[:, 1], 
                                                          lidar_points_2d[:, 0]] > 0.5]
            label.points_3d = points_in_mask
        
        return labels
```

### 3.5 Quality Gate and Human Review

```python
class QualityGate:
    """Route auto-labels to accept, review, or discard."""
    
    # Confidence thresholds (tuned per class)
    THRESHOLDS = {
        'aircraft':      {'auto_accept': 0.95, 'review': 0.7, 'discard': 0.3},
        'baggage_cart':  {'auto_accept': 0.90, 'review': 0.6, 'discard': 0.3},
        'ground_crew':   {'auto_accept': 0.85, 'review': 0.5, 'discard': 0.2},
        'fod':           {'auto_accept': 0.99, 'review': 0.8, 'discard': 0.5},
        # FOD: very high threshold — false negatives are dangerous
    }
    
    def route(self, auto_labels):
        """Route each label to appropriate quality tier."""
        accepted, review, discarded = [], [], []
        
        for label in auto_labels:
            thresholds = self.THRESHOLDS.get(
                label.class_name, 
                {'auto_accept': 0.90, 'review': 0.6, 'discard': 0.3}
            )
            
            if label.confidence >= thresholds['auto_accept']:
                # Also check temporal consistency
                if self.is_temporally_consistent(label):
                    accepted.append(label)
                else:
                    review.append(label)
            elif label.confidence >= thresholds['review']:
                review.append(label)
            elif label.confidence >= thresholds['discard']:
                review.append(label)  # borderline → human decides
            else:
                discarded.append(label)
        
        return {
            'accepted': accepted,      # ~60-70% of labels
            'needs_review': review,    # ~20-30% of labels
            'discarded': discarded     # ~5-10% of labels
        }
```

**Expected auto-labeling throughput and cost:**

| Metric | Manual Only | Auto-Label + QA |
|--------|------------|-----------------|
| Frames/hour/annotator | 15-25 | 100-200 (review only) |
| Cost per frame (3D boxes) | $8-15 | $1.50-3.00 |
| Cost per frame (occupancy) | $15-25 | $3-6 |
| Quality (mAP vs ground truth) | 95%+ | 90-93% (auto) → 95%+ (after QA) |
| Turnaround (1000 frames) | 5-7 days | 1-2 days |

---

## 4. Active Learning and Data Selection

### 4.1 The Core Problem

Not all data is equally valuable for training. A frame showing an empty taxiway contributes almost nothing to model improvement. A frame showing a partially occluded tug behind an aircraft wing is extremely valuable. Active learning selects the most informative samples for labeling.

### 4.2 Active Learning Strategies

| Strategy | Method | Best For | Compute Cost |
|----------|--------|----------|-------------|
| **Uncertainty sampling** | Select frames where model is least confident | General improvement | Low |
| **Committee disagreement** | Select frames where ensemble members disagree | Finding blind spots | Medium |
| **Gradient-based** | Select frames with highest expected gradient norm | Maximum learning signal | High |
| **Diversity sampling** | Select frames that maximize feature space coverage | Avoiding redundancy | Medium |
| **Error-driven** | Select frames where model produces errors | Fixing known failures | Low |
| **Hybrid** | Combine uncertainty + diversity | Balance exploitation + exploration | Medium |

### 4.3 Airside Active Learning Pipeline

```python
class AirsideActiveLearner:
    """Active learning pipeline for airside perception."""
    
    def __init__(self, model, unlabeled_pool, budget_frames=1000):
        self.model = model
        self.unlabeled_pool = unlabeled_pool
        self.budget = budget_frames
        self.feature_bank = FeatureBank()  # for diversity
    
    def select_batch(self):
        """Select most informative frames for labeling."""
        scores = {}
        
        for frame_id, frame in self.unlabeled_pool.items():
            # 1. Uncertainty score (epistemic)
            predictions = []
            for _ in range(5):  # MC Dropout
                pred = self.model.predict(frame, dropout=True)
                predictions.append(pred)
            uncertainty = self.compute_uncertainty(predictions)
            
            # 2. Novelty score (distance from labeled data)
            features = self.model.extract_features(frame)
            novelty = self.feature_bank.novelty_score(features)
            
            # 3. Safety relevance score
            safety_score = self.safety_relevance(frame, predictions[0])
            
            # Composite score (safety-weighted)
            scores[frame_id] = (
                0.3 * uncertainty + 
                0.3 * novelty + 
                0.4 * safety_score  # safety events get priority
            )
        
        # Select top-k by score, with diversity filtering
        selected = self.diverse_topk(scores, k=self.budget)
        
        return selected
    
    def safety_relevance(self, frame, prediction):
        """Prioritize frames with safety-relevant content."""
        score = 0.0
        
        # Frames near aircraft score higher
        for obj in prediction.objects:
            if obj.class_name == 'aircraft':
                distance = np.linalg.norm(obj.position[:2])
                score += max(0, 1.0 - distance / 50.0)  # higher when closer
        
        # Frames with operator intervention score maximum
        if frame.metadata.get('operator_intervention'):
            score = 1.0
        
        # Frames with novel objects
        for obj in prediction.objects:
            if obj.confidence < 0.5:
                score += 0.3
        
        return min(score, 1.0)
    
    def compute_uncertainty(self, mc_predictions):
        """Compute epistemic uncertainty from MC Dropout predictions."""
        # Per-object: variance of position predictions
        position_vars = []
        for obj_track in self.match_across_predictions(mc_predictions):
            positions = np.array([p.position for p in obj_track])
            position_vars.append(positions.var(axis=0).sum())
        
        if not position_vars:
            return 0.0
        
        # Also: entropy of class distributions
        class_probs = np.mean([p.class_distribution for p in mc_predictions], axis=0)
        entropy = -np.sum(class_probs * np.log(class_probs + 1e-8))
        
        return np.mean(position_vars) + 0.1 * entropy
```

### 4.4 Active Learning Effectiveness

Research shows active learning achieves target performance with 20-50% fewer labeled frames:

| Scenario | Random Selection | Active Learning | Reduction |
|----------|-----------------|-----------------|-----------|
| Detection mAP = 50 | 5,000 frames | 2,500 frames | 50% |
| Detection mAP = 60 | 15,000 frames | 8,000 frames | 47% |
| Detection mAP = 70 | 50,000 frames | 30,000 frames | 40% |
| Occupancy mIoU = 30 | 10,000 frames | 6,000 frames | 40% |

At $3/frame (auto-labeled + QA), saving 20,000 frames = **$60K saved** per training iteration.

### 4.5 Curriculum Learning for Airside

Beyond active learning, curriculum learning orders training data from easy to hard:

| Phase | Duration | Data Focus | Expected Outcome |
|-------|----------|-----------|-----------------|
| **1. Easy** | Epochs 1-10 | Clear weather, few objects, straight paths | Base feature learning |
| **2. Medium** | Epochs 11-25 | Moderate traffic, curves, parked aircraft | Object recognition |
| **3. Hard** | Epochs 26-40 | Dense traffic, weather, night, occlusion | Robustness |
| **4. Critical** | Epochs 41-50 | Safety events, edge cases, rare scenarios | Long-tail coverage |

---

## 5. Model Training Orchestration

### 5.1 Training Pipeline Architecture

```
┌─────────────────────────────────────────────────┐
│              TRAINING ORCHESTRATOR                │
│                                                   │
│  ┌─────────────┐   ┌──────────────┐             │
│  │ Data Loader  │   │ Experiment   │             │
│  │ (versioned)  │   │ Tracker      │             │
│  │ DVC + S3     │   │ (W&B/MLflow) │             │
│  └──────┬──────┘   └──────┬───────┘             │
│         │                  │                      │
│         ▼                  ▼                      │
│  ┌─────────────────────────────────────────┐     │
│  │         Training Job (GPU Cluster)       │     │
│  │                                          │     │
│  │  Pre-train (nuScenes/Waymo)             │     │
│  │       ↓                                  │     │
│  │  Fine-tune (airport data + LoRA)         │     │
│  │       ↓                                  │     │
│  │  Evaluate (held-out airport test set)    │     │
│  │       ↓                                  │     │
│  │  Export (TensorRT for Orin)              │     │
│  └──────────────┬──────────────────────────┘     │
│                  ↓                                │
│  ┌─────────────────────────────────────────┐     │
│  │      Model Registry                      │     │
│  │  - Version tagged                        │     │
│  │  - Metrics attached                      │     │
│  │  - Lineage tracked (data → model)        │     │
│  │  - Approval workflow                     │     │
│  └─────────────────────────────────────────┘     │
└─────────────────────────────────────────────────┘
```

### 5.2 Training Configuration

```yaml
# training_config.yaml — PointPillars fine-tune for airside
experiment:
  name: "pointpillars_airside_v12"
  base_model: "pointpillars_nuscenes_pretrained"
  
data:
  train:
    - source: "s3://aurrigo-data/airport-a/train/"
      version: "dvc://v2.3"
      frames: 45000
    - source: "s3://aurrigo-data/airport-b/train/"
      version: "dvc://v1.1"  
      frames: 12000
  val:
    - source: "s3://aurrigo-data/airport-a/val/"
      frames: 5000
  test:
    - source: "s3://aurrigo-data/airport-a/test/"
      frames: 5000
      
model:
  backbone: "pillar_vfe"
  neck: "second_fpn"
  head: "center_head"
  classes:
    - aircraft
    - baggage_cart
    - tug_vehicle
    - belt_loader
    - fuel_truck
    - ground_crew
    - safety_cone
    - fod
  fine_tune:
    method: "lora"
    rank: 32
    alpha: 64
    target_modules: ["backbone", "neck"]  # freeze head initially
    
training:
  epochs: 50
  batch_size: 16
  lr: 0.001
  lr_schedule: "cosine_warmup"
  warmup_epochs: 5
  optimizer: "adamw"
  weight_decay: 0.01
  
  # Class weighting (safety-critical classes weighted higher)
  class_weights:
    aircraft: 5.0       # must never miss
    ground_crew: 3.0    # safety critical
    fod: 10.0           # highest priority
    baggage_cart: 1.0   # common, well-represented
    
export:
  format: "tensorrt"
  precision: "fp16"  # int8 for PointPillars backbone
  target: "orin_agx"
  calibration_dataset: "s3://aurrigo-data/calibration/int8_500frames/"
```

### 5.3 Experiment Tracking

Every training run must be fully reproducible:

| Tracked Artifact | Tool | Purpose |
|-----------------|------|---------|
| Dataset version | DVC | Exact data used for training |
| Code version | Git commit SHA | Exact code used |
| Config | YAML in git | Hyperparameters |
| Model weights | Model registry | Deployable artifacts |
| Training metrics | W&B / MLflow | Loss curves, mAP progression |
| Evaluation results | W&B / MLflow | Per-class mAP, latency, failure cases |
| Data lineage | DVC + metadata | Which bags → which frames → which model |

### 5.4 Continuous Training Pipeline

```python
class ContinuousTrainingPipeline:
    """Automated retraining when new data meets trigger criteria."""
    
    def __init__(self):
        self.data_registry = DataRegistry()
        self.model_registry = ModelRegistry()
        self.retrain_triggers = {
            'new_frames': 5000,         # retrain when 5K new frames available
            'performance_drop': 0.03,   # retrain when mAP drops 3%+
            'new_airport': True,        # retrain for every new airport
            'max_age_days': 30,         # retrain at least monthly
        }
    
    def check_retrain_needed(self):
        """Check if retraining should be triggered."""
        current_model = self.model_registry.get_production()
        
        # Count new frames since last training
        new_frames = self.data_registry.count_new_since(
            current_model.training_date
        )
        if new_frames >= self.retrain_triggers['new_frames']:
            return True, f"new_data: {new_frames} frames"
        
        # Check production performance
        prod_metrics = self.get_production_metrics(days=7)
        training_metrics = current_model.metrics
        if training_metrics['mAP'] - prod_metrics['mAP'] > self.retrain_triggers['performance_drop']:
            return True, f"perf_drop: {training_metrics['mAP']:.1f} → {prod_metrics['mAP']:.1f}"
        
        # Check model age
        age_days = (datetime.now() - current_model.training_date).days
        if age_days >= self.retrain_triggers['max_age_days']:
            return True, f"age: {age_days} days"
        
        return False, "no trigger"
```

---

## 6. Deployment Validation and A/B Testing

### 6.1 Shadow Mode Evaluation

Before deploying a new model to production, it runs in **shadow mode** alongside the current production model (see `operations/deployment/shadow-mode.md` for infrastructure details). Here we focus on the ML-specific validation criteria.

**Shadow Mode Metrics Gate:**

| Metric | Threshold | Measurement Period | Rationale |
|--------|-----------|-------------------|-----------|
| mAP (overall) | ≥ production model | 1 week shadow | Must not regress |
| mAP (aircraft) | ≥ production + 0% | 1 week | Safety-critical, never regress |
| mAP (ground crew) | ≥ production + 0% | 1 week | Safety-critical, never regress |
| mAP (FOD) | ≥ production + 0% | 1 week | Safety-critical, never regress |
| False positive rate | ≤ production + 5% | 1 week | Avoid phantom braking |
| Latency p99 | ≤ production + 2ms | 1 week | Must fit timing budget |
| Operator interventions (shadow) | ≤ production | 2 weeks | Would-have-intervened analysis |
| Edge case coverage | > production | 1 week | Measured on curated hard set |

### 6.2 A/B Testing on Fleet

For a fleet of 10+ vehicles, split into control and treatment groups:

```python
class FleetABTest:
    """A/B test new model across fleet subset."""
    
    def __init__(self, fleet_size, treatment_fraction=0.2):
        self.treatment_vehicles = self.select_treatment(
            fleet_size, treatment_fraction
        )
        self.metrics = ABMetrics()
    
    def select_treatment(self, fleet_size, fraction):
        """Select vehicles for treatment group.
        
        Stratify by: airport, vehicle type, shift pattern
        to ensure fair comparison.
        """
        vehicles = self.get_fleet()
        # Stratified random selection
        treatment = stratified_sample(
            vehicles,
            strata=['airport', 'vehicle_type', 'shift'],
            fraction=fraction
        )
        return treatment
    
    def analyze(self, duration_days=14):
        """Analyze A/B test results."""
        control_metrics = self.metrics.get_group('control', duration_days)
        treatment_metrics = self.metrics.get_group('treatment', duration_days)
        
        results = {}
        for metric in ['mAP', 'interventions_per_km', 'false_positive_rate',
                        'latency_p99', 'mission_completion_rate']:
            control_val = control_metrics[metric]
            treatment_val = treatment_metrics[metric]
            
            # Statistical significance (two-sample t-test)
            t_stat, p_value = ttest_ind(control_val, treatment_val)
            
            results[metric] = {
                'control': np.mean(control_val),
                'treatment': np.mean(treatment_val),
                'delta': np.mean(treatment_val) - np.mean(control_val),
                'p_value': p_value,
                'significant': p_value < 0.05
            }
        
        return results
```

### 6.3 Rollback Criteria

Automatic rollback if any of these triggers fire within 48 hours of deployment:

| Trigger | Threshold | Response |
|---------|-----------|----------|
| Safety-critical miss | Any aircraft/crew miss with <20m range | Immediate rollback |
| Intervention spike | 2x baseline intervention rate | Rollback within 1 hour |
| Latency breach | p99 > timing budget for >5 min | Rollback within 1 hour |
| Crash/exception | Any model crash | Immediate rollback |
| Operator complaint | 2+ operators report issues | Pause, investigate |

---

## 7. Production Monitoring and Feedback

### 7.1 Monitoring Dashboard

Real-time metrics that close the loop back to data collection:

```
┌────────────────────────────────────────────────────────┐
│  PERCEPTION MODEL HEALTH DASHBOARD                      │
│                                                          │
│  Model: pointpillars_airside_v12   Deployed: 2026-04-01│
│  Fleet: 12 vehicles, 3 airports                         │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ mAP (7-day)  │  │ Interventions│  │ Latency p99  │ │
│  │   68.3%      │  │   0.8/100km  │  │   6.2ms      │ │
│  │   ↑ 2.1%     │  │   ↓ 15%     │  │   stable     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                          │
│  Per-Class Performance:                                  │
│  aircraft:     94.2% ████████████████████ ✓             │
│  baggage_cart: 78.5% ████████████████   ✓               │
│  ground_crew:  71.3% ██████████████    ✓                │
│  tug_vehicle:  75.8% ███████████████   ✓                │
│  belt_loader:  65.2% █████████████     ⚠ (below target)│
│  fod:          45.1% █████████         ⚠ (needs data)  │
│                                                          │
│  Alerts:                                                 │
│  ⚠ belt_loader mAP dropped 3.2% at Airport C (new type)│
│  ⚠ FOD detection below 50% target — active learning     │
│    requesting 500 more labeled FOD frames                │
│                                                          │
└────────────────────────────────────────────────────────┘
```

### 7.2 Automated Feedback Signals

Production monitoring generates signals that feed back into the flywheel:

| Signal | Detection Method | Flywheel Action |
|--------|-----------------|-----------------|
| Class mAP drop | Rolling 7-day eval vs baseline | Trigger retraining with class-weighted sampling |
| Novel object type | Confidence <0.3 on detected object | Upload clip, route to labeling, add to training |
| Domain shift | Feature distribution drift (KL divergence) | Alert, collect more data from affected conditions |
| Seasonal performance | mAP vs weather/time-of-day correlation | Trigger seasonal retraining with recent data |
| Airport-specific gap | Per-airport metrics diverge | Collect airport-specific data, LoRA adapter |

### 7.3 Failure Case Analysis

Every operator intervention triggers a failure analysis pipeline:

```python
class FailureCaseAnalyzer:
    """Analyze perception failures from interventions."""
    
    def analyze_intervention(self, event):
        """Root-cause an operator intervention."""
        # Load sensor data around intervention
        data = self.load_event_data(event, window=(-30, 10))
        
        # Re-run perception with debug logging
        debug_output = self.model.predict_debug(data)
        
        # Classify failure mode
        failure_mode = self.classify_failure(event, debug_output)
        
        # Store for training
        self.failure_database.add(FailureCase(
            event_id=event.id,
            timestamp=event.timestamp,
            airport=event.airport,
            vehicle=event.vehicle_id,
            failure_mode=failure_mode,
            root_cause=self.estimate_root_cause(failure_mode, debug_output),
            sensor_data_path=data.path,
            model_version=self.model.version
        ))
        
        return failure_mode
    
    def classify_failure(self, event, debug_output):
        """Classify failure into actionable categories."""
        modes = {
            'false_negative': 'Object present but not detected',
            'false_positive': 'Detection with no real object',
            'misclassification': 'Detected but wrong class',
            'localization_error': 'Detected but position >1m off',
            'tracking_failure': 'ID switch or track loss',
            'latency': 'Detection too late for planning',
            'sensor_failure': 'Sensor data quality issue',
            'ood_input': 'Input outside training distribution',
        }
        # Logic to classify based on ground truth reconstruction
        ...
```

---

## 8. Scenario Mining and Long-Tail Discovery

### 8.1 The Long-Tail Problem

Autonomous driving follows a power law: 95% of scenarios are routine, but the remaining 5% contains 95% of the safety-critical situations. For airside operations:

| Scenario Category | Frequency | Difficulty | Safety Impact |
|------------------|-----------|-----------|---------------|
| Empty taxiway driving | 40% | Low | Low |
| Single aircraft at gate | 25% | Low | Medium |
| Multiple GSE at gate | 15% | Medium | Medium |
| Dense turnaround traffic | 10% | High | High |
| Unusual equipment | 5% | High | High |
| Weather degradation | 3% | High | High |
| FOD on surface | 1% | Very high | Critical |
| Near-miss / emergency | 0.5% | Very high | Critical |
| Novel situation | 0.5% | Very high | Critical |

### 8.2 Scenario Mining Pipeline

```python
class ScenarioMiner:
    """Mine fleet data for specific scenario types."""
    
    def __init__(self):
        self.embedding_model = SceneEmbedder()  # encode scenes to vectors
        self.scenario_library = ScenarioLibrary()
        
    def mine_scenario(self, query, fleet_data):
        """Find clips matching a scenario description.
        
        Examples:
            "baggage cart crossing vehicle path within 10m"
            "aircraft pushback while vehicle is near gate"
            "FOD-like object on taxiway surface"
            "rain onset during active operation"
        """
        results = []
        
        for clip in fleet_data:
            # Structured query matching
            if self.matches_structured_query(query, clip):
                results.append(clip)
            
            # Embedding similarity (for fuzzy matching)
            clip_embedding = self.embedding_model.encode(clip)
            query_embedding = self.embedding_model.encode_text(query)
            similarity = cosine_similarity(clip_embedding, query_embedding)
            
            if similarity > 0.7:
                results.append((clip, similarity))
        
        return sorted(results, key=lambda x: x[1], reverse=True)
    
    def discover_novel_scenarios(self, fleet_data, known_scenarios):
        """Discover scenarios not in the known library."""
        # Embed all clips
        embeddings = [self.embedding_model.encode(clip) for clip in fleet_data]
        
        # Cluster
        clusters = HDBSCAN(min_cluster_size=5).fit(embeddings)
        
        # Find clusters far from known scenarios
        known_embeddings = [self.embedding_model.encode(s) for s in known_scenarios]
        
        novel_clusters = []
        for cluster_id in set(clusters.labels_):
            if cluster_id == -1:
                continue  # noise
            cluster_center = np.mean(embeddings[clusters.labels_ == cluster_id], axis=0)
            min_distance = min(cosine_distance(cluster_center, k) for k in known_embeddings)
            if min_distance > 0.5:
                novel_clusters.append((cluster_id, min_distance))
        
        return novel_clusters
```

### 8.3 Scenario Balancing for Training

Training data should overrepresent rare but important scenarios:

| Scenario | Real Frequency | Training Frequency | Oversampling Factor |
|----------|---------------|-------------------|-------------------|
| Routine driving | 40% | 15% | 0.4x |
| Single aircraft | 25% | 20% | 0.8x |
| Multiple GSE | 15% | 20% | 1.3x |
| Dense traffic | 10% | 20% | 2x |
| Unusual equipment | 5% | 10% | 2x |
| Weather | 3% | 8% | 2.7x |
| FOD | 1% | 4% | 4x |
| Near-miss | 0.5% | 2% | 4x |
| Novel | 0.5% | 1% | 2x |

---

## 9. Synthetic Data Augmentation

### 9.1 Filling Gaps with Synthetic Data

For scenarios too rare or too dangerous to collect naturally (FOD, near-misses, extreme weather), synthetic data fills the gap (see `cross-cutting/synthetic-data-generation.md` for tools).

**Synthetic data integration in the flywheel:**

```
Real Data (Fleet) ──┐
                     ├──→ Training Data Mixer ──→ Training
Synthetic Data ─────┘     (ratio: 70-80% real, 20-30% synthetic)
     ↑
     │
  Gap Analysis ←── Active Learning identifies gaps
                   that synthetic data can fill
```

### 9.2 Synthetic Data Budget

| Gap Type | Synthetic Method | Volume | Cost |
|----------|-----------------|--------|------|
| FOD variations | 3DGS insertion into real scenes | 5,000 frames | $2K compute |
| Night driving | Neural style transfer | 10,000 frames | $3K compute |
| Rain/fog | Weather augmentation on real data | 10,000 frames | $2K compute |
| Novel aircraft types | 3D model insertion | 2,000 frames | $5K (3D models) |
| Near-miss scenarios | Trajectory perturbation | 3,000 frames | $1K compute |
| New airport layout | Digital twin generation | 5,000 frames | $10K (mapping + gen) |
| **Total** | | **35,000 frames** | **~$23K** |

### 9.3 Domain Randomization for Robustness

```python
class AirsideDomainRandomizer:
    """Apply domain randomization to increase robustness."""
    
    def randomize(self, scene):
        """Apply random augmentations to training data."""
        augmentations = []
        
        # Lighting variations (time of day, clouds)
        if random.random() < 0.3:
            scene = self.vary_lighting(scene, 
                intensity_range=(0.3, 3.0),  # dawn to midday
                color_temp_range=(3500, 6500)  # warm to cool
            )
            augmentations.append('lighting')
        
        # Weather effects
        if random.random() < 0.2:
            weather = random.choice(['rain', 'fog', 'snow', 'heat_shimmer'])
            scene = self.add_weather(scene, weather, 
                severity=random.uniform(0.2, 0.8))
            augmentations.append(f'weather_{weather}')
        
        # Ground surface variations
        if random.random() < 0.15:
            scene = self.vary_surface(scene,
                options=['dry', 'wet', 'puddles', 'oil_spill', 'deicing_fluid'])
            augmentations.append('surface')
        
        # Aircraft livery randomization (different airlines)
        if random.random() < 0.25:
            scene = self.randomize_livery(scene)
            augmentations.append('livery')
        
        # LiDAR noise model variations
        if random.random() < 0.2:
            scene = self.vary_lidar_noise(scene,
                dropout_rate=random.uniform(0, 0.15),
                range_noise_std=random.uniform(0.01, 0.05))
            augmentations.append('lidar_noise')
        
        return scene, augmentations
```

---

## 10. Multi-Airport Transfer Learning

### 10.1 The Multi-Airport Challenge

Each airport has unique characteristics:

| Property | Variation Across Airports |
|----------|--------------------------|
| Layout | Completely different gate/taxiway geometry |
| Aircraft types | Regional vs international → different sizes |
| GSE fleet | Different manufacturers, models |
| Surface markings | Different standards (ICAO vs FAA) |
| Weather | Arctic (Helsinki) vs tropical (Singapore) |
| Lighting | High-mast (Europe) vs embedded (US) |
| Traffic density | 2 gates (regional) vs 200 gates (hub) |

### 10.2 LoRA Adapters Per Airport

Rather than training a separate model per airport, use LoRA adapters (see `cross-cutting/transfer-learning.md`):

```
Base Model (trained on all airports)
     │
     ├── LoRA Airport A (rank 16, 2.1M params)
     ├── LoRA Airport B (rank 16, 2.1M params)  
     ├── LoRA Airport C (rank 16, 2.1M params)
     └── LoRA Airport D (rank 16, 2.1M params)
```

**Training data requirements per airport:**

| Data Level | Frames | Labeling Cost | Expected mAP | Timeline |
|-----------|--------|---------------|-------------|----------|
| Minimal (mapping only) | 100-500 | $500-2K | 45-55 | 1 week |
| Basic (LoRA fine-tune) | 500-2,000 | $2K-8K | 55-65 | 2-4 weeks |
| Standard (full fine-tune) | 5,000-10,000 | $15K-40K | 65-75 | 4-8 weeks |
| Production (+ active learning) | 20,000-50,000 | $30K-80K | 75-85 | 3-6 months |

### 10.3 Airport Onboarding Flywheel

When deploying to a new airport:

```
Week 1: Mapping drives (manual, record data)
         → Auto-label with existing model
         → Identify domain gaps (novel GSE types, layout features)

Week 2: Label critical frames (500-1000, focus on gaps)
         → Train LoRA adapter
         → Shadow mode testing

Week 3-4: Shadow mode validation
           → Active learning selects hard cases
           → Label additional 500-1000 frames
           → Retrain LoRA adapter

Month 2: Supervised autonomous operation
          → Continuous data collection
          → Monthly retraining cycle starts
          → Performance converges to production level

Month 3+: Full autonomous operation
           → Flywheel self-sustaining
           → Airport LoRA adapter stabilizes
```

---

## 11. Metrics and KPIs

### 11.1 Flywheel Health Metrics

| Metric | Target | Measurement | Current (est.) |
|--------|--------|------------|----------------|
| **Flywheel cycle time** | <30 days | Time from data collection to model deployment | N/A (no ML) |
| **Data yield rate** | >5% of collected data used in training | Useful frames / total frames | N/A |
| **Auto-label accuracy** | >90% mAP vs human labels | Periodic human audit | N/A |
| **Active learning efficiency** | >1.5x random baseline | mAP gain per labeled frame | N/A |
| **Model improvement rate** | >2% mAP/quarter | Quarterly evaluation on fixed test set | N/A |
| **Deployment success rate** | >90% of candidates pass validation | Candidates deployed / candidates trained | N/A |
| **Retrain trigger rate** | 1-2/month | Automatic retraining triggers per month | N/A |

### 11.2 Perception Improvement Trajectory

Expected mAP progression with active flywheel:

| Timeline | Data Volume | Training | mAP (est.) | Interventions/100km |
|----------|------------|---------|-----------|-------------------|
| **Month 0** | 0 (no ML) | N/A | N/A (rules only) | 5-10 |
| **Month 3** | 5K frames (nuScenes transfer) | Pre-train + 500 labeled | 45-55 | 3-5 |
| **Month 6** | 20K frames | Active learning + LoRA | 60-68 | 1-3 |
| **Month 12** | 80K frames | Full fine-tune + curriculum | 70-78 | 0.5-1.5 |
| **Month 18** | 200K frames | Continuous retraining | 75-82 | 0.2-0.8 |
| **Month 24** | 500K frames | Multi-airport + synthetic | 80-85 | 0.1-0.5 |

### 11.3 ROI Model

| Cost Category | Year 1 | Year 2 | Year 3 |
|--------------|--------|--------|--------|
| **Compute (training)** | $30K | $60K | $100K |
| **Labeling** | $40K | $50K | $60K |
| **Storage** | $15K | $30K | $50K |
| **Engineering** (1 ML engineer) | $120K | $130K | $140K |
| **Total** | **$205K** | **$270K** | **$350K** |

| Benefit Category | Year 1 | Year 2 | Year 3 |
|-----------------|--------|--------|--------|
| **Reduced interventions** | $50K | $150K | $300K |
| **Faster airport onboarding** | $0 | $100K | $200K |
| **Avoided incidents** | $100K | $250K | $500K |
| **Competitive differentiation** | Hard to quantify | | |
| **Total** | **$150K** | **$500K** | **$1M** |

**Breakeven: ~Month 18. NPV positive by end of Year 2.**

---

## 12. Cost Model and Scaling

### 12.1 Compute Requirements

| Fleet Size | Monthly Data | Training Compute | Storage | Total Monthly |
|-----------|-------------|-----------------|---------|---------------|
| 5 vehicles | 7.5 TB | 8 GPUs × 48h = $2K | $675 | $2.7K |
| 20 vehicles | 30 TB | 16 GPUs × 72h = $6K | $2.7K | $8.7K |
| 50 vehicles | 75 TB | 32 GPUs × 96h = $15K | $6.8K | $21.8K |
| 100 vehicles | 150 TB | 64 GPUs × 120h = $38K | $13.5K | $51.5K |

Assumes:
- H100 spot instances at $2.50/GPU-hour
- S3 standard storage at $0.023/GB/month (first year retention)
- Monthly retraining cycle
- 5% of raw data retained long-term

### 12.2 Scaling Strategy

| Scale | Infrastructure | Automation Level | Human Effort |
|-------|---------------|-----------------|--------------|
| **5 vehicles** | Local GPU server (8× A5000) | Semi-manual triggers, manual labeling | 1 ML engineer (50%) |
| **20 vehicles** | Cloud GPU (on-demand) | Automated triggers, auto-label + QA | 1 ML engineer + 2 annotators |
| **50 vehicles** | Dedicated cloud cluster | Fully automated flywheel | 2 ML engineers + 4 annotators |
| **100 vehicles** | Multi-region cloud | Self-optimizing flywheel | 3 ML engineers + 6 annotators |

---

## 13. Implementation Roadmap

### Phase 1: Foundation (Months 1-3) — $25K

| Task | Duration | Dependencies | Deliverable |
|------|----------|-------------|-------------|
| Trigger engine deployment | 2 weeks | ROS node development | On-vehicle data collection |
| Bag→training data pipeline | 3 weeks | Fleet data pipeline | Automated frame extraction |
| Auto-labeling v1 (CenterPoint offline) | 3 weeks | Pipeline | 90%+ auto-label on common classes |
| nuScenes pre-training | 1 week | GPU access | Base model weights |
| First LoRA fine-tune | 2 weeks | 500 labeled frames | Airport-specific model v1 |
| Shadow mode evaluation | 2 weeks | Model v1 | Baseline metrics |

### Phase 2: Active Flywheel (Months 4-6) — $35K

| Task | Duration | Dependencies | Deliverable |
|------|----------|-------------|-------------|
| Active learning selection | 3 weeks | Phase 1 complete | Intelligent data selection |
| Foundation model auto-labeling | 4 weeks | SAM + CLIP setup | Novel object labels |
| Quality gate + annotation UI | 3 weeks | Auto-labeling | Human review workflow |
| Experiment tracking (W&B) | 1 week | Training pipeline | Reproducible experiments |
| First retrained model (v2) | 2 weeks | 5K labeled frames | Improved model |
| A/B testing infrastructure | 2 weeks | Fleet > 5 vehicles | Split deployment |

### Phase 3: Scaling (Months 7-12) — $75K

| Task | Duration | Dependencies | Deliverable |
|------|----------|-------------|-------------|
| Continuous retraining automation | 4 weeks | Phase 2 | Automated flywheel |
| Scenario mining | 4 weeks | 6+ months of fleet data | Long-tail discovery |
| Synthetic data integration | 6 weeks | Gap analysis | Augmented training set |
| Multi-airport LoRA system | 4 weeks | Second airport deployment | Scalable adaptation |
| Production monitoring dashboard | 3 weeks | Fleet telemetry | Real-time model health |
| Performance regression CI/CD | 3 weeks | Test set curation | Automated quality gates |

### Phase 4: Optimization (Months 13-18) — $50K

| Task | Duration | Dependencies | Deliverable |
|------|----------|-------------|-------------|
| Curriculum learning | 3 weeks | Scenario library | Optimized training |
| Self-supervised pre-training | 6 weeks | Large unlabeled dataset | Reduced label needs |
| Model distillation (smaller models) | 4 weeks | Production model | Faster inference |
| Fleet-wide learning (V2V data sharing) | 6 weeks | Collaborative pipeline | Cross-vehicle learning |
| Flywheel KPI optimization | Ongoing | All phases | Self-improving system |

---

## 14. Key Takeaways

1. **A data flywheel is not a data pipeline** — the flywheel creates a self-reinforcing cycle where more vehicles → more data → better models → fewer interventions → more deployments → more vehicles

2. **Trigger-based collection uploads ~5% of raw data** — intelligent triggers capture 100% of safety events, ~60% of perception edge cases, while staying within 50 GB/day upload budget per vehicle

3. **Auto-labeling reduces cost by 70-85%** — from $8-15/frame manual to $1.50-3.00/frame with auto-label + human QA, enabling 5-10x more labeled data for the same budget

4. **Active learning achieves target mAP with 40-50% fewer labeled frames** — safety-weighted selection prioritizes aircraft, ground crew, and FOD frames, saving ~$60K per training iteration at scale

5. **Monthly retraining cycle is the target cadence** — triggered by 5,000 new frames, 3% mAP drop, or 30-day age, whichever comes first

6. **Shadow mode validation requires 1-2 weeks** with strict gates: safety-critical classes (aircraft, crew, FOD) must never regress, even by 0.1% mAP

7. **Per-airport LoRA adapters need only 500-2,000 labeled frames** ($2K-8K) to reach initial deployment quality, vs 20,000-50,000 frames for full training — enabling rapid airport onboarding

8. **Expected mAP trajectory: 45% (month 3) → 70% (month 12) → 82% (month 24)** with interventions dropping from 5-10/100km to 0.1-0.5/100km

9. **Flywheel breakeven at ~Month 18** with NPV positive by end of Year 2, driven by reduced interventions ($300K/yr), faster onboarding ($200K/yr), and avoided incidents ($500K/yr)

10. **Scenario mining discovers long-tail events** that comprise 5% of driving but 95% of safety risk — oversampling these by 2-4x in training is critical for safety performance

11. **Synthetic data fills gaps at $23K** for 35,000 frames covering FOD, night, weather, novel aircraft, and near-misses — scenarios too rare or dangerous to collect naturally

12. **Foundation models (SAM + CLIP) enable zero-shot labeling of novel airside objects** — critical for the first deployment when no training data exists for airside-specific classes

13. **Quality gate routes 60-70% of auto-labels to auto-accept**, 20-30% to human review, 5-10% to discard — FOD requires highest confidence (0.99) for auto-accept due to safety criticality

14. **Failure case analysis closes the loop** — every operator intervention generates a classified failure case that informs what data to collect next, what scenarios to mine, and what to prioritize in active learning

15. **Fleet of 100 vehicles generates ~150 TB/month** requiring ~$52K/month for compute + storage, but the flywheel efficiency (auto-labeling, active learning, scenario balancing) means each dollar of data investment yields 3-5x more model improvement than naive approaches

16. **New airport onboarding drops from months to weeks** once the flywheel is running — week 1 mapping, week 2 LoRA training, weeks 3-4 shadow validation, month 2 supervised autonomy

---

## References

1. Tesla AI Day 2022, 2023 — Data engine and auto-labeling pipeline architecture
2. Waymo, "Content Search: Mining Real-World Data for Autonomous Driving," 2023
3. Ren et al., "A Survey on Active Learning for Object Detection," IJCV 2024
4. Sener & Savarese, "Active Learning for Convolutional Neural Networks: A Core-Set Approach," ICLR 2018
5. Yoo & Kweon, "Learning Loss for Active Learning," CVPR 2019
6. Settles, "Active Learning Literature Survey," 2009
7. Wang et al., "Auto-Labeling 3D Objects with Differentiable Rendering and LiDAR," NeurIPS 2023
8. Caesar et al., "nuScenes: A Multimodal Dataset for Autonomous Driving," CVPR 2020
9. comma.ai, "openpilot: An open source driver assistance system," 2024
10. Hu et al., "LoRA: Low-Rank Adaptation of Large Language Models," ICLR 2022
11. Bengio et al., "Curriculum Learning," ICML 2009
12. NVIDIA, "Auto-Labeling for Autonomous Driving," Drive Sim Documentation, 2025

---

*Document generated for Aurrigo industry research, April 2026. Covers the ML-centric data flywheel — for infrastructure (storage, transfer, DVC), see `cross-cutting/fleet-data-pipeline.md`. For bag processing specifics, see `cross-cutting/data-engine-from-bags.md`. For public datasets, see `cross-cutting/data-engines-datasets.md`.*
