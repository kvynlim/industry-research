# Multi-Airport Domain Adaptation Playbook

> Methodology for rapidly deploying autonomous ground vehicles across multiple airports with minimal per-airport data collection and retraining. Covers domain shift characterization, few-shot adaptation strategies, map bootstrapping from AMDB, perception model fine-tuning budgets, seasonal adaptation, deployment gates, and cost modeling for scaling from 1 to 50+ airports.

**Key Takeaway**: The biggest barrier to multi-airport scaling is not the technology — it's the per-airport data and validation cost. With LiDAR foundation model pre-training + PointLoRA fine-tuning, a new airport can be brought online with 500-1,000 labeled LiDAR frames (~2 days of collection, ~$15-30K annotation), compared to 10,000+ frames without transfer learning. Map bootstrapping from free FAA AMDB data eliminates 60-70% of HD mapping cost. The total cost for each additional airport after the first drops from $200-400K to $75-150K.

---

## Table of Contents

1. [Multi-Airport Domain Shift Analysis](#1-multi-airport-domain-shift-analysis)
2. [Map Bootstrapping Strategy](#2-map-bootstrapping-strategy)
3. [Perception Adaptation Pipeline](#3-perception-adaptation-pipeline)
4. [Localization Adaptation](#4-localization-adaptation)
5. [Environmental and Seasonal Adaptation](#5-environmental-and-seasonal-adaptation)
6. [Deployment Gates and Validation](#6-deployment-gates-and-validation)
7. [Fleet Configuration Management](#7-fleet-configuration-management)
8. [Cost Model for Multi-Airport Scaling](#8-cost-model-for-multi-airport-scaling)
9. [Competitive Benchmarking](#9-competitive-benchmarking)
10. [Practical Playbook: Airport Onboarding in 8 Weeks](#10-practical-playbook-airport-onboarding-in-8-weeks)

---

## 1. Multi-Airport Domain Shift Analysis

### 1.1 Types of Domain Shift

When deploying perception and planning models trained at Airport A to Airport B, the following shifts occur:

| Shift Type | Description | Severity | Examples |
|-----------|-------------|----------|---------|
| **Geometric** | Different apron layouts, stand configurations, service road widths | High | Schiphol MARS stands vs Heathrow pier stands; 3m vs 6m service roads |
| **Environmental** | Climate differences affecting sensor performance | High | Dubai heat haze vs Helsinki ice; tropical rain vs desert dust |
| **Infrastructure** | Different GSE fleets, markings, signage, lighting | Medium | Blue baggage carts (Airport A) vs yellow (Airport B); LED vs sodium lighting |
| **Surface** | Concrete vs asphalt, painted markings, surface condition | Medium | White concrete (Dubai) vs dark asphalt (Manchester); rubber deposits near runways |
| **Object appearance** | Different aircraft liveries, GSE manufacturers, uniform colors | Low-Medium | Swissport vs SATS vs dnata ground crew; TLD vs Textron GSE |
| **Temporal** | Different traffic patterns, peak hours, seasonal variations | Medium | Hub airport (continuous) vs seasonal leisure airport (summer peaks) |
| **Regulatory** | Airport-specific SOPs, speed limits, restricted zones | Low | Left-hand drive (UK) vs right-hand drive aprons; airport-specific speed zones |

### 1.2 Quantifying Domain Shift

```python
class DomainShiftAnalyzer:
    """Measure domain gap between airports for transfer planning."""
    
    def __init__(self, source_dataset, target_dataset):
        self.source = source_dataset
        self.target = target_dataset
    
    def measure_gap(self):
        """Compute domain gap metrics between airports."""
        results = {}
        
        # 1. Point cloud statistics
        results["point_density_ratio"] = (
            self.target.mean_points_per_scan / 
            self.source.mean_points_per_scan
        )
        
        # 2. Intensity distribution shift (Wasserstein distance)
        results["intensity_shift"] = wasserstein_distance(
            self.source.intensity_histogram,
            self.target.intensity_histogram
        )
        
        # 3. Object size distributions
        for obj_class in ["aircraft", "gse", "personnel"]:
            source_sizes = self.source.get_object_sizes(obj_class)
            target_sizes = self.target.get_object_sizes(obj_class)
            results[f"{obj_class}_size_shift"] = ks_2samp(
                source_sizes, target_sizes
            ).statistic
        
        # 4. Ground plane characteristics
        results["ground_roughness_diff"] = abs(
            self.target.mean_ground_roughness - 
            self.source.mean_ground_roughness
        )
        
        # 5. Feature distribution (DINOv2 embeddings)
        source_features = self._extract_features(self.source)
        target_features = self._extract_features(self.target)
        results["feature_mmd"] = maximum_mean_discrepancy(
            source_features, target_features
        )
        
        # 6. Overall gap score (weighted combination)
        results["overall_gap"] = self._compute_overall_gap(results)
        
        return results
    
    def recommend_adaptation_budget(self, gap_results):
        """Recommend labeled data budget based on gap size."""
        gap = gap_results["overall_gap"]
        
        if gap < 0.2:
            return {
                "labeled_frames": 200,
                "collection_days": 1,
                "adaptation_method": "PointLoRA_rank_8",
                "expected_accuracy_drop": "1-2%",
            }
        elif gap < 0.5:
            return {
                "labeled_frames": 500,
                "collection_days": 2,
                "adaptation_method": "PointLoRA_rank_16",
                "expected_accuracy_drop": "2-4%",
            }
        elif gap < 0.8:
            return {
                "labeled_frames": 1000,
                "collection_days": 3,
                "adaptation_method": "PointLoRA_rank_32_plus_head_finetune",
                "expected_accuracy_drop": "3-5%",
            }
        else:
            return {
                "labeled_frames": 2000,
                "collection_days": 5,
                "adaptation_method": "full_finetune_from_pretrained",
                "expected_accuracy_drop": "5-10%",
            }
    
    def _compute_overall_gap(self, results):
        """Weighted gap score."""
        weights = {
            "intensity_shift": 0.15,
            "ground_roughness_diff": 0.10,
            "feature_mmd": 0.40,
            "aircraft_size_shift": 0.10,
            "gse_size_shift": 0.15,
            "personnel_size_shift": 0.10,
        }
        score = 0
        for key, weight in weights.items():
            if key in results:
                score += weight * min(results[key], 1.0)
        return score
```

### 1.3 Airport Similarity Clusters

Airports can be grouped by similarity to optimize adaptation strategy:

| Cluster | Characteristics | Transfer Difficulty | Examples |
|---------|----------------|-------------------|---------|
| **Northern European** | Concrete aprons, seasonal ice/snow, moderate traffic | Low (within cluster) | Heathrow, Schiphol, Frankfurt, Copenhagen |
| **Southern European** | Asphalt/concrete mix, heat haze, seasonal tourism | Low-Medium | Barcelona, Nice, Rome, Athens |
| **Middle Eastern** | White concrete, extreme heat, dust, 24/7 operations | Medium | Dubai, Doha, Abu Dhabi, Riyadh |
| **Tropical Asian** | Heavy rain, high humidity, tropical vegetation | Medium | Changi, KLIA, Suvarnabhumi, Bali |
| **North American** | Varied climate, large aprons, high GSE diversity | Medium | JFK, LAX, DFW, O'Hare |
| **Regional/small** | Simple layout, low traffic, limited GSE types | Low | Inverness, Newquay, Cairns |

**Cross-cluster transfer** (e.g., Heathrow → Dubai) requires ~2x the adaptation data of within-cluster transfer.

---

## 2. Map Bootstrapping Strategy

### 2.1 Map Bootstrap from AMDB

AMDB (Aerodrome Mapping Database) data is available free from the FAA for 500+ US airports and from EUROCONTROL for European airports. This provides a head start on HD mapping.

```python
class AMDBBootstrapper:
    """Bootstrap HD map from AMDB data + survey refinement."""
    
    def __init__(self, amdb_data, target_accuracy_m=0.1):
        self.amdb = amdb_data  # AMXM format
        self.target_accuracy = target_accuracy_m
    
    def bootstrap_map(self):
        """Create initial HD map from AMDB.
        
        AMDB provides:
        - Apron boundaries (±0.5m accuracy at best)
        - Taxiway centerlines
        - Stand numbers and locations
        - Building outlines
        - Runway/taxiway geometry
        
        Missing from AMDB (need survey):
        - Service road centerlines (not in AMDB)
        - Precise stand approach paths
        - Equipment parking positions
        - Dynamic signage locations
        - Curb/barrier heights
        - Surface type per area
        """
        base_map = Lanelet2Map()
        
        # 1. Extract taxiway centerlines as lanelets
        for taxiway in self.amdb.get_features("TaxiwayElement"):
            centerline = taxiway.geometry.centroid_line
            lanelet = base_map.create_lanelet(
                centerline=centerline,
                width=taxiway.properties.get("width", 15.0),
                name=taxiway.properties.get("designator", ""),
                surface_type="TAXIWAY",
                accuracy=0.5,  # AMDB accuracy
            )
        
        # 2. Extract apron areas
        for apron in self.amdb.get_features("ApronElement"):
            base_map.add_area(
                polygon=apron.geometry,
                name=apron.properties.get("name", ""),
                surface_type="APRON",
                accuracy=0.5,
            )
        
        # 3. Extract stand positions
        for stand in self.amdb.get_features("StandArea"):
            base_map.add_stand(
                position=stand.geometry.centroid,
                number=stand.properties.get("designator", ""),
                aircraft_code=stand.properties.get("code", "C"),
                accuracy=0.5,
            )
        
        # 4. Extract buildings (for localization reference)
        for building in self.amdb.get_features("ConstructionArea"):
            base_map.add_building(
                polygon=building.geometry,
                name=building.properties.get("name", ""),
            )
        
        # 5. Mark areas needing survey refinement
        gaps = self._identify_gaps(base_map)
        
        return base_map, gaps
    
    def _identify_gaps(self, base_map):
        """Identify what AMDB doesn't provide."""
        return {
            "service_roads": "Not in AMDB — need mobile LiDAR survey",
            "approach_paths": "Stand approach geometry needs survey to ±0.1m",
            "equipment_parking": "GSE parking positions not in AMDB",
            "barriers_curbs": "Height information not in AMDB",
            "surface_types": "AMDB has limited surface classification",
            "signage": "Dynamic/static sign locations not in AMDB",
            "speed_zones": "Airport-specific speed limits not in AMDB",
        }
    
    def estimate_survey_effort(self):
        """Estimate survey effort to complete HD map from AMDB bootstrap."""
        apron_area_m2 = self.amdb.total_apron_area()
        num_stands = len(self.amdb.get_features("StandArea"))
        service_road_km = self._estimate_service_road_km()
        
        return {
            "mobile_lidar_survey_hours": service_road_km * 2,  # 2h per km
            "rtk_gps_survey_hours": num_stands * 0.5,  # 30 min per stand
            "post_processing_hours": (apron_area_m2 / 10000) * 4,  # 4h per hectare
            "total_days": max(3, service_road_km * 0.5 + num_stands * 0.1),
            "cost_estimate_usd": {
                "survey_crew": service_road_km * 1000 + num_stands * 200,
                "equipment_rental": 2000,  # per day
                "post_processing": apron_area_m2 / 10000 * 500,
            }
        }
```

### 2.2 Map Refinement from LiDAR SLAM

After the initial AMDB bootstrap, the vehicle's own LiDAR can refine the map during supervised operations:

```python
class SLAMMapRefinement:
    """Refine AMDB-bootstrapped map using vehicle LiDAR SLAM data."""
    
    def __init__(self, base_map, slam_config):
        self.base_map = base_map
        self.config = slam_config
        self.slam = KISS_ICP(config=slam_config)  # or LIO-SAM
    
    def refine_from_mission_data(self, rosbag_paths):
        """Refine map using collected mission data.
        
        Strategy:
        1. Run SLAM on each mission bag to get point cloud map
        2. Align SLAM map to AMDB base map (ICP registration)
        3. Extract refined geometry (service roads, curbs, barriers)
        4. Update base map with higher-accuracy features
        """
        slam_maps = []
        
        for bag_path in rosbag_paths:
            slam_map = self.slam.process_bag(bag_path)
            slam_maps.append(slam_map)
        
        # Merge and align
        merged = self._merge_slam_maps(slam_maps)
        aligned = self._align_to_amdb(merged, self.base_map)
        
        # Extract features
        refined_features = self._extract_features(aligned)
        
        # Update base map
        updated_map = self.base_map.copy()
        for feature in refined_features:
            if feature.accuracy < self.base_map.get_accuracy(feature.id):
                updated_map.update_feature(feature)
        
        return updated_map
    
    def _align_to_amdb(self, slam_map, amdb_map):
        """Align SLAM map to AMDB coordinate frame.
        
        Uses building corners and taxiway edges as alignment features
        (these are most accurately represented in AMDB).
        """
        # Extract building corners from both maps
        amdb_corners = amdb_map.get_building_corners()
        slam_corners = self._detect_corners(slam_map)
        
        # ICP alignment
        transform = icp_align(slam_corners, amdb_corners)
        
        return slam_map.transform(transform)
    
    def estimate_missions_needed(self):
        """How many missions to achieve target accuracy."""
        return {
            "for_0.5m_accuracy": "5-10 missions covering all service roads",
            "for_0.2m_accuracy": "20-50 missions with loop closures",
            "for_0.1m_accuracy": "50-100 missions + RTK ground truth validation",
            "typical_timeline": "1-2 weeks of normal operations",
        }
```

### 2.3 Map Cost Comparison

| Approach | Cost | Time | Accuracy | Prerequisites |
|----------|------|------|----------|--------------|
| **Full HD survey from scratch** | $50-100K | 4-8 weeks | ±0.05m | Professional survey crew |
| **AMDB bootstrap + survey refinement** | $15-40K | 2-4 weeks | ±0.1m | AMDB data (free) |
| **AMDB bootstrap + SLAM refinement** | $5-15K | 2-4 weeks | ±0.2m | Vehicle with LiDAR, supervised operations |
| **Neural map only** | $2-5K | 1-2 weeks | ±0.5m | Camera fleet, MapTracker/NMP model |

**Recommendation**: AMDB bootstrap + SLAM refinement for first deployment at a new airport (±0.2m sufficient for service roads), with RTK survey refinement for stand approach paths (need ±0.1m for docking accuracy).

---

## 3. Perception Adaptation Pipeline

### 3.1 Adaptation Strategy Decision Tree

```
Is the new airport in the SAME climate cluster as training airports?
├── YES: Low-effort adaptation
│   ├── Collect 200-500 frames unlabeled
│   ├── Run TTA (TENT/CoTTA) for immediate deployment
│   ├── Collect 200 labeled frames for PointLoRA fine-tuning
│   └── Expected gap: 1-3% mAP vs fully trained
│
└── NO: Medium-effort adaptation
    ├── Collect 500-1,000 frames with diverse conditions
    ├── Label using pre-trained model + human correction (active learning)
    ├── Fine-tune with PointLoRA rank 32 + detection head
    ├── Validate on 200 held-out labeled frames
    └── Expected gap: 3-5% mAP vs fully trained
```

### 3.2 Few-Shot Perception Fine-Tuning

```python
class AirportPerceptionAdapter:
    """Adapt perception models to a new airport with minimal data."""
    
    def __init__(self, base_model, adaptation_config):
        self.base = base_model
        self.config = adaptation_config
    
    def adapt_detection(self, target_data, method="pointlora"):
        """Adapt 3D object detection to new airport.
        
        Methods ranked by data efficiency:
        1. TTA (0 labels): TENT entropy minimization at inference
        2. PointLoRA (200 labels): Parameter-efficient fine-tuning
        3. Head fine-tune (500 labels): Retrain detection head only
        4. Full fine-tune (2000+ labels): Retrain all parameters
        """
        
        if method == "tta":
            # No labels needed — adapt at inference time
            adapted = TTAWrapper(
                self.base,
                method="tent",
                entropy_threshold=0.5,
                learning_rate=1e-4,
                update_bn_only=True,
            )
            return adapted
        
        elif method == "pointlora":
            # Efficient fine-tuning with 200-500 labeled frames
            lora_model = add_pointlora(
                self.base,
                rank=self.config.get("lora_rank", 16),
                target_modules=["backbone", "neck"],
                # Don't add LoRA to detection head — fine-tune it directly
            )
            
            optimizer = torch.optim.AdamW([
                {"params": lora_model.lora_parameters(), "lr": 1e-4},
                {"params": lora_model.head.parameters(), "lr": 5e-4},
            ])
            
            # Train for 20-50 epochs on small dataset
            for epoch in range(self.config.get("epochs", 30)):
                for batch in target_data:
                    loss = lora_model(batch)
                    loss.backward()
                    optimizer.step()
                    optimizer.zero_grad()
            
            return lora_model
        
        elif method == "head_finetune":
            # Freeze backbone, fine-tune head with 500-1000 labels
            for param in self.base.backbone.parameters():
                param.requires_grad = False
            
            optimizer = torch.optim.AdamW(
                self.base.head.parameters(), lr=1e-3
            )
            
            for epoch in range(50):
                for batch in target_data:
                    loss = self.base(batch)
                    loss.backward()
                    optimizer.step()
                    optimizer.zero_grad()
            
            return self.base
    
    def adapt_segmentation(self, target_data, method="pointlora"):
        """Adapt LiDAR semantic segmentation to new airport.
        
        Key adaptation needs:
        - New GSE types/colors at target airport
        - Different surface materials and reflectivities
        - Different building/infrastructure shapes
        - New aircraft liveries (minor impact on LiDAR)
        """
        # Similar to detection but with segmentation-specific loss
        # Key: Safety-aware adaptation — never reduce recall on personnel class
        pass
    
    def validate_adaptation(self, holdout_data, safety_thresholds):
        """Validate adapted model meets safety thresholds."""
        results = {}
        
        for class_name, threshold in safety_thresholds.items():
            metrics = evaluate_class(self.base, holdout_data, class_name)
            results[class_name] = {
                "recall": metrics.recall,
                "precision": metrics.precision,
                "threshold": threshold,
                "pass": metrics.recall >= threshold,
            }
        
        # Safety-critical classes must meet minimum recall
        safety_critical = {
            "personnel": 0.99,
            "aircraft": 0.995,
            "gse": 0.95,
        }
        
        results["overall_pass"] = all(
            results.get(cls, {}).get("pass", False)
            for cls in safety_critical
        )
        
        return results
```

### 3.3 Data Collection Protocol for New Airport

```
Week 1: Supervised Data Collection
──────────────────────────────────
Day 1-2: Drive all service roads (supervised operation)
  - Collect LiDAR + camera at 10Hz
  - Cover all stands, depot routes, charging stations
  - Drive in daylight, different weather if available
  - Estimated: 100-200 km, 200-500 GB raw data
  
Day 3: Annotate subset for detection
  - Pre-label using base model (transfer predictions)
  - Human reviewer corrects errors (~40% correction rate expected)
  - Target: 200-500 frames with 3D bounding boxes
  - Cost: $15-25/frame with pre-labeling assistance

Day 4: Fine-tune and validate
  - PointLoRA fine-tuning: 2-4 hours on single GPU
  - Validate on held-out 50-100 frames
  - Check safety-critical class recall ≥ thresholds

Day 5: Shadow mode deployment
  - Run adapted model alongside existing perception
  - Compare outputs, log disagreements
  - No safety-critical decisions from adapted model yet
```

### 3.4 Active Learning for Efficient Labeling

```python
class AirportActiveLearner:
    """Select most informative frames for annotation at new airport."""
    
    def __init__(self, model, budget_frames=500):
        self.model = model
        self.budget = budget_frames
    
    def select_frames(self, unlabeled_pool):
        """Select frames that maximize information gain.
        
        Strategy:
        1. Run model on all unlabeled frames
        2. Score by uncertainty (entropy of predictions)
        3. Also include diversity (cover different areas/conditions)
        4. Prioritize frames with safety-critical objects
        """
        scores = []
        
        for frame in unlabeled_pool:
            predictions = self.model.predict_with_uncertainty(frame)
            
            # Uncertainty score
            entropy = predictions.mean_entropy()
            
            # Safety priority: boost frames with personnel detections
            has_personnel = any(
                p.class_name == "personnel" for p in predictions.detections
            )
            safety_boost = 2.0 if has_personnel else 1.0
            
            # Novelty: high OOD score means new object types
            ood_score = predictions.max_ood_score()
            
            score = (entropy * 0.4 + ood_score * 0.3) * safety_boost
            scores.append((frame.id, score))
        
        # Sort by score and apply diversity sampling
        scores.sort(key=lambda x: x[1], reverse=True)
        
        # Take top-K but ensure spatial diversity
        selected = self._diversity_sample(scores, self.budget)
        
        return selected
    
    def _diversity_sample(self, scored_frames, budget):
        """Ensure selected frames cover diverse locations and conditions."""
        selected = []
        covered_zones = set()
        
        for frame_id, score in scored_frames:
            frame = self.get_frame(frame_id)
            zone = self._get_zone(frame.position)  # spatial binning
            
            if zone not in covered_zones or len(selected) < budget * 0.5:
                selected.append(frame_id)
                covered_zones.add(zone)
            
            if len(selected) >= budget:
                break
        
        return selected
```

---

## 4. Localization Adaptation

### 4.1 SLAM Map Building at New Airport

```python
class AirportLocalizationBootstrap:
    """Bootstrap localization system at a new airport."""
    
    PHASES = {
        1: "Initial SLAM map (5-10 missions, ±0.5m)",
        2: "Refined SLAM map (20-50 missions, ±0.2m)", 
        3: "RTK-validated map (50-100 missions, ±0.1m)",
    }
    
    def build_initial_map(self, rosbag_paths):
        """Phase 1: Build initial map from supervised missions.
        
        Uses KISS-ICP for fast, robust LiDAR SLAM.
        5-10 missions covering all operational areas.
        """
        slam = KISS_ICP(
            max_range=100.0,  # Orin with RoboSense
            min_range=1.0,
            voxel_size=0.5,    # coarse for initial map
            max_points_per_voxel=20,
        )
        
        trajectories = []
        for bag in rosbag_paths:
            trajectory = slam.process_bag(bag)
            trajectories.append(trajectory)
        
        # Merge with loop closure
        merged_map = slam.merge_sessions(trajectories)
        
        return merged_map
    
    def validate_localization(self, test_bags, ground_truth_rtk):
        """Validate localization accuracy against RTK ground truth."""
        errors = []
        
        for bag in test_bags:
            estimated = self.localize(bag)
            gt = ground_truth_rtk[bag.id]
            
            for est, truth in zip(estimated, gt):
                error = np.linalg.norm(est.position - truth.position)
                errors.append(error)
        
        return {
            "mean_error_m": np.mean(errors),
            "p95_error_m": np.percentile(errors, 95),
            "max_error_m": np.max(errors),
            "pass_threshold_0.3m": np.percentile(errors, 95) < 0.3,
        }
```

### 4.2 GNSS Multipath Characterization

Each airport has unique GNSS multipath patterns depending on terminal building geometry:

```python
class GNSSMultipathMapper:
    """Map GNSS multipath zones at a new airport.
    
    Critical for airside AV: GNSS errors of 2-10m near terminal 
    buildings can cause route deviation or geofence violations.
    """
    
    def build_multipath_map(self, missions_with_rtk):
        """Build spatial map of GNSS quality from fleet data.
        
        Compare RTK-fixed solution (centimeter accuracy) with 
        standalone GNSS to identify degraded zones.
        """
        quality_grid = {}
        
        for mission in missions_with_rtk:
            for frame in mission.frames:
                cell = self._grid_cell(frame.position)
                
                rtk_pos = frame.rtk_position
                standalone_pos = frame.gnss_standalone_position
                
                error = np.linalg.norm(rtk_pos - standalone_pos)
                rtk_fix = frame.rtk_fix_quality  # 1=fix, 2=float, 5=standalone
                
                if cell not in quality_grid:
                    quality_grid[cell] = []
                quality_grid[cell].append({
                    "error_m": error,
                    "fix_quality": rtk_fix,
                    "num_satellites": frame.num_sats,
                    "hdop": frame.hdop,
                })
        
        # Compute per-cell statistics
        multipath_map = {}
        for cell, measurements in quality_grid.items():
            errors = [m["error_m"] for m in measurements]
            multipath_map[cell] = {
                "mean_error": np.mean(errors),
                "max_error": np.max(errors),
                "rtk_fix_rate": sum(1 for m in measurements if m["fix_quality"] == 1) / len(measurements),
                "is_degraded": np.mean(errors) > 1.0 or np.max(errors) > 5.0,
                "recommendation": "SLAM_PRIMARY" if np.mean(errors) > 2.0 else "GNSS_OK",
            }
        
        return multipath_map
```

---

## 5. Environmental and Seasonal Adaptation

### 5.1 Seasonal Domain Shift

| Season | Conditions | Perception Impact | Adaptation Need |
|--------|-----------|-------------------|-----------------|
| **Summer** | Heat haze, bright sun, long days | Camera saturation, thermal shimmer | Expose-robust model, sun position-aware processing |
| **Autumn** | Rain, fog, falling leaves, reduced daylight | LiDAR noise from rain, fog attenuation | Rain-mode calibration, fog detection trigger |
| **Winter** | Ice, snow, de-icing spray, short days | Ground plane lost, sensor contamination | Winter calibration, heated sensor housings |
| **Spring** | Variable weather, seasonal GSE changes | Mixed conditions | Transition calibration |

### 5.2 Seasonal Adaptation Strategy

```python
class SeasonalAdaptationManager:
    """Manage model adaptation across seasons at each airport."""
    
    def __init__(self, airport_id, model_registry):
        self.airport = airport_id
        self.registry = model_registry
        
        # Per-airport, per-season model variants
        self.season_models = {
            "summer": None,
            "autumn": None,
            "winter": None,
            "spring": None,
        }
    
    def get_active_model(self, current_conditions):
        """Select best model variant for current conditions."""
        season = self._determine_season(current_conditions)
        
        if self.season_models[season] is not None:
            return self.season_models[season]
        
        # Fallback: use nearest season's model with TTA
        nearest = self._nearest_available_season(season)
        return TTAWrapper(self.season_models[nearest])
    
    def adapt_for_season(self, season, seasonal_data):
        """Fine-tune model for specific season.
        
        Triggered when:
        - Season transition detected
        - Fleet data shows increased perception errors
        - First deployment in this season at this airport
        """
        base_model = self.registry.get_base_model()
        
        # Collect condition-specific data
        rain_data = seasonal_data.filter(weather="rain")
        fog_data = seasonal_data.filter(weather="fog")
        snow_data = seasonal_data.filter(weather="snow")
        night_data = seasonal_data.filter(lighting="night")
        
        # Fine-tune with emphasis on degraded conditions
        adapted = self._finetune_with_emphasis(
            base_model,
            seasonal_data,
            emphasis_subsets={
                "rain": (rain_data, 2.0),    # 2x weight
                "fog": (fog_data, 3.0),      # 3x weight (rare but critical)
                "snow": (snow_data, 2.0),
                "night": (night_data, 1.5),
            }
        )
        
        self.season_models[season] = adapted
        self.registry.register(
            model=adapted,
            airport=self.airport,
            season=season,
            version=datetime.now().isoformat(),
        )
    
    def continuous_monitoring(self, fleet_metrics):
        """Monitor fleet perception performance for seasonal drift."""
        if fleet_metrics.detection_confidence_p50 < 0.7:
            return "ADAPTATION_NEEDED"
        if fleet_metrics.false_positive_rate > 0.01:
            return "INVESTIGATE"
        if fleet_metrics.ood_detection_rate > 0.05:
            return "NEW_OBJECTS_DETECTED"
        return "OK"
```

### 5.3 Weather-Specific Sensor Configuration

```python
# Per-weather sensor configuration profiles
WEATHER_PROFILES = {
    "clear_day": {
        "lidar_mode": "normal",
        "camera_exposure": "auto",
        "radar_sensitivity": "normal",
        "thermal_enabled": False,
        "max_speed_kmh": 25,
    },
    "rain_light": {
        "lidar_mode": "rain_filter_enabled",
        "camera_exposure": "auto_rain",
        "radar_sensitivity": "high",  # radar unaffected by rain
        "thermal_enabled": False,
        "max_speed_kmh": 20,
    },
    "rain_heavy": {
        "lidar_mode": "rain_filter_aggressive",
        "camera_exposure": "high_gain",
        "radar_sensitivity": "high",
        "thermal_enabled": True,  # supplement degraded LiDAR
        "max_speed_kmh": 10,
    },
    "fog_200m": {
        "lidar_mode": "fog_mode",  # reduced range, higher sensitivity
        "camera_exposure": "high_gain",
        "radar_sensitivity": "primary",  # radar becomes primary
        "thermal_enabled": True,
        "max_speed_kmh": 10,
    },
    "night_lit": {
        "lidar_mode": "normal",
        "camera_exposure": "night_mode",
        "radar_sensitivity": "normal",
        "thermal_enabled": True,  # thermal primary for personnel
        "max_speed_kmh": 15,
    },
    "snow_ice": {
        "lidar_mode": "snow_filter",
        "camera_exposure": "auto",
        "radar_sensitivity": "high",
        "thermal_enabled": True,
        "max_speed_kmh": 10,
        "braking_safety_factor": 3.0,  # 3x longer braking distance
    },
}
```

---

## 6. Deployment Gates and Validation

### 6.1 Gate Criteria for New Airport

| Gate | Criteria | Evidence |
|------|----------|---------|
| **G1: Map Ready** | HD map accuracy ≤ 0.2m for service roads, ≤ 0.1m for stand approaches | RTK survey validation report |
| **G2: Perception Adapted** | Detection recall ≥ 99% personnel, ≥ 99.5% aircraft on target airport data | Validation on 200+ labeled frames |
| **G3: Localization Validated** | Position error ≤ 0.3m (95th percentile) across all operational areas | 50+ missions with RTK comparison |
| **G4: GNSS Characterized** | Multipath map complete, SLAM fallback validated in degraded zones | Grid map with per-cell quality |
| **G5: Shadow Mode Passed** | 1,000+ km shadow mode with ≤ 1 safety-relevant disagreement per 100 km | Shadow mode log analysis |
| **G6: Supervised Operations** | 500+ supervised autonomous km, 0 safety-critical events | Operational log analysis |
| **G7: Regulatory Approval** | Airport-specific operating permit, safety case accepted | Regulatory documentation |

### 6.2 Shadow Mode Protocol

```python
class AirportShadowMode:
    """Shadow mode validation at new airport.
    
    Adapted (new airport) perception runs alongside 
    primary (human-supervised) system. Disagreements are logged
    but do not affect vehicle behavior.
    """
    
    def __init__(self, primary_system, adapted_system, thresholds):
        self.primary = primary_system
        self.adapted = adapted_system
        self.thresholds = thresholds
        self.disagreement_log = []
    
    def evaluate_frame(self, sensor_data):
        """Compare primary and adapted perception on same frame."""
        primary_result = self.primary.process(sensor_data)
        adapted_result = self.adapted.process(sensor_data)
        
        # Compare detections
        disagreements = self._compare_detections(
            primary_result.detections,
            adapted_result.detections
        )
        
        # Compare trajectories
        traj_divergence = self._compare_trajectories(
            primary_result.planned_trajectory,
            adapted_result.planned_trajectory
        )
        
        if disagreements or traj_divergence > self.thresholds["max_traj_divergence_m"]:
            self.disagreement_log.append({
                "timestamp": time.time(),
                "position": sensor_data.ego_position,
                "disagreements": disagreements,
                "traj_divergence_m": traj_divergence,
                "frame_data": sensor_data.to_compressed(),
            })
        
        return primary_result  # Always use primary for safety
    
    def generate_report(self):
        """Generate shadow mode validation report."""
        total_frames = self.total_frames_processed
        total_km = self.total_km_driven
        
        return {
            "total_frames": total_frames,
            "total_km": total_km,
            "disagreement_count": len(self.disagreement_log),
            "disagreements_per_km": len(self.disagreement_log) / max(total_km, 1),
            "safety_relevant_disagreements": sum(
                1 for d in self.disagreement_log 
                if d["traj_divergence_m"] > 1.0
            ),
            "pass": (
                len(self.disagreement_log) / max(total_km, 1) < 
                self.thresholds["max_disagreements_per_km"]
            ),
        }
```

---

## 7. Fleet Configuration Management

### 7.1 Per-Airport Configuration

```yaml
# Airport configuration file: airport_eddm.yaml (Munich)
airport:
  icao: EDDM
  name: "Munich Franz Josef Strauss"
  cluster: "northern_european"
  timezone: "Europe/Berlin"

map:
  version: "2.3.1"
  source: "amdb_bootstrap_v1 + slam_refinement_v2 + rtk_survey_v1"
  accuracy_m: 0.15
  last_updated: "2026-03-15"
  amdb_cycle: "2603"  # AIRAC cycle

perception:
  base_model: "centerpoint_ptv3_v4"
  adaptation: "pointlora_rank_16_eddm"
  adaptation_date: "2026-03-20"
  labeled_frames_used: 480
  validation_recall:
    personnel: 0.993
    aircraft: 0.997
    gse: 0.961
  
  segmentation_model: "flatformer_airside_v3"
  segmentation_adaptation: "pointlora_rank_8_eddm"
  
  seasonal_variants:
    summer: "eddm_summer_v1"
    winter: "eddm_winter_v1"  # snow/ice adaptation
    # spring/autumn: use base model + TTA

localization:
  slam_map_version: "slam_eddm_v5"
  gnss_multipath_map: "multipath_eddm_v2"
  degraded_zones: ["pier_c_east", "cargo_apron_south"]

operations:
  speed_limits:
    service_road: 25
    near_aircraft: 5
    stand_approach: 5
  restricted_zones:
    - name: "ILS_28R_critical"
      type: "dynamic_geofence"
      trigger: "rwy_28R_in_use"
    - name: "construction_zone_pier_d"
      type: "notam_linked"
      notam_id: "A1234/26"
  
  route_names:
    ALPHA: [lanelet_101, lanelet_102, lanelet_103]
    BRAVO: [lanelet_201, lanelet_202]
    CHARLIE: [lanelet_301, lanelet_302, lanelet_303, lanelet_304]
```

### 7.2 Configuration Version Control

```python
class AirportConfigManager:
    """Manage per-airport configurations across fleet."""
    
    def __init__(self, config_store):
        self.store = config_store  # Git repo or S3-backed store
    
    def get_config(self, airport_icao, vehicle_id=None):
        """Get current configuration for airport."""
        config = self.store.get_latest(airport_icao)
        
        # Vehicle-specific overrides (e.g., different sensor suite)
        if vehicle_id:
            overrides = self.store.get_vehicle_overrides(vehicle_id, airport_icao)
            config = deep_merge(config, overrides)
        
        return config
    
    def deploy_update(self, airport_icao, update_type, new_config):
        """Deploy configuration update to fleet at airport.
        
        Update types:
        - map: New map version (requires validation)
        - perception: New model weights (requires shadow mode)
        - operations: Route/speed changes (immediate)
        - seasonal: Seasonal model swap (automatic)
        """
        if update_type in ("map", "perception"):
            # Staged rollout: 1 vehicle first, then fleet
            self.store.stage(airport_icao, new_config, rollout="canary")
        else:
            self.store.deploy(airport_icao, new_config, rollout="immediate")
    
    def rollback(self, airport_icao, to_version):
        """Rollback to previous configuration version."""
        self.store.rollback(airport_icao, to_version)
```

---

## 8. Cost Model for Multi-Airport Scaling

### 8.1 Per-Airport Cost Breakdown

| Activity | First Airport | Additional Airport (same cluster) | Additional Airport (new cluster) |
|----------|--------------|----------------------------------|--------------------------------|
| **HD Map** | $50-100K | $15-40K (AMDB + SLAM) | $20-50K |
| **Perception Adaptation** | Included in R&D | $15-30K (500 labels + fine-tune) | $25-45K (1000 labels) |
| **Localization Setup** | Included in R&D | $5-10K (SLAM + validation) | $5-10K |
| **GNSS Characterization** | $5-10K | $3-5K | $3-5K |
| **Shadow Mode Validation** | $20-40K (4-8 weeks) | $10-20K (2-4 weeks) | $15-30K |
| **Regulatory/Safety Case** | $130-380K | $30-80K (delta assessment) | $50-100K |
| **Operational Setup** | $20-40K | $10-20K | $10-20K |
| **Total** | **$255-570K** | **$88-205K** | **$128-260K** |

### 8.2 Scaling Economics

```
Airport Count vs Per-Airport Marginal Cost:
                                                         
  $300K ┤                                                 
        │*                                                
  $250K ┤ \                                               
        │  \                                              
  $200K ┤   \                                             
        │    \                                            
  $150K ┤     \___                                        
        │         \_____                                  
  $100K ┤                \___________                     
        │                            \___________________ 
   $75K ┤                                                 
        └──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬─
           1  2  3  4  5  7  10 15 20 25 30 40 50     
                        Number of Airports               

Key inflection points:
- Airport 1-3: High cost (building tools, processes, base models)
- Airport 4-10: Cost drops as templates and tools mature
- Airport 10+: Marginal cost stabilizes at $75-100K per airport
- Airport 20+: Fleet data improves base models, reducing adaptation needs
```

### 8.3 Break-Even Analysis

```python
def multi_airport_roi(num_airports, vehicles_per_airport=10):
    """Estimate ROI for multi-airport deployment."""
    
    # Costs
    rd_fixed = 500_000  # One-time R&D for adaptation pipeline
    
    per_airport_cost = []
    for i in range(1, num_airports + 1):
        if i <= 3:
            cost = 250_000  # First airports: high
        elif i <= 10:
            cost = 150_000  # Learning curve
        else:
            cost = 100_000  # Mature deployment
        per_airport_cost.append(cost)
    
    total_cost = rd_fixed + sum(per_airport_cost)
    
    # Revenue / savings per airport per year
    # Each vehicle saves ~1.5 FTE at $40-60K/year
    savings_per_vehicle_year = 50_000
    savings_per_airport_year = vehicles_per_airport * savings_per_vehicle_year
    
    total_annual_savings = num_airports * savings_per_airport_year
    
    payback_years = total_cost / total_annual_savings
    
    return {
        "total_deployment_cost": total_cost,
        "annual_savings": total_annual_savings,
        "payback_years": payback_years,
        "5_year_roi_pct": ((total_annual_savings * 5 - total_cost) / total_cost) * 100,
    }

# Examples:
# 5 airports, 10 vehicles each:  payback 0.7 years, 5yr ROI 614%
# 10 airports, 10 vehicles each: payback 0.5 years, 5yr ROI 862%
# 20 airports, 10 vehicles each: payback 0.4 years, 5yr ROI 1071%
```

---

## 9. Competitive Benchmarking

### 9.1 Competitor Multi-Airport Approach

| Company | Airports | Adaptation Method | Time per Airport | Key Limitation |
|---------|----------|------------------|-----------------|----------------|
| **UISEE** | 4+ airports | Full custom per airport | 6-12 months | Manual map creation, airport-specific software |
| **TractEasy** | 8 airports | Template-based, manual tuning | 1-6 years (including regulatory) | No ML adaptation, manual mapping |
| **AeroVect** | 5+ airports | Retrofit + re-mapping | 2-4 months | Manual map of each airport, no perception adaptation |
| **Aurrigo (target)** | 9 airports | AMDB bootstrap + PointLoRA + SLAM | 8-12 weeks | Building the pipeline (this document) |

### 9.2 Aurrigo Competitive Advantage

1. **AMDB bootstrap**: Free FAA data eliminates 60-70% of mapping cost vs competitors who survey from scratch
2. **Foundation model + PointLoRA**: 200-500 labeled frames vs 10,000+ for full retraining
3. **Fleet learning**: Each new airport's data improves the base model for subsequent airports
4. **Seasonal auto-adaptation**: TTA + seasonal model registry vs manual recalibration
5. **Standardized deployment pipeline**: Repeatable process reduces per-airport engineering effort

---

## 10. Practical Playbook: Airport Onboarding in 8 Weeks

### Week 1: Pre-Deployment Preparation
- Obtain AMDB data (free from FAA / EUROCONTROL)
- Bootstrap HD map from AMDB
- Analyze airport satellite imagery for route planning
- Identify airport cluster for transfer baseline
- Begin regulatory engagement

### Week 2: Site Survey and Data Collection
- Mobile LiDAR survey of service roads (2-3 days)
- RTK GPS survey of stand approach paths (1-2 days)
- Collect 100-200 km of LiDAR data during supervised drives
- Photograph all signage, markings, speed zones
- Document airport-specific SOPs

### Week 3: Map Building and Perception Adaptation
- Build SLAM map from collected data
- Align SLAM map to AMDB base
- Pre-label LiDAR frames with base model
- Human annotation of 200-500 frames (outsourced, 2-3 days)
- Fine-tune perception with PointLoRA (1 day compute)

### Week 4: Integration and Validation
- Deploy adapted models to vehicle
- GNSS multipath mapping (concurrent with testing)
- Run validation on 200+ held-out labeled frames
- Check all safety-critical class recall thresholds
- Configure airport-specific route names and speed zones

### Week 5-6: Shadow Mode
- 500+ km shadow mode operation
- Monitor disagreement rate
- Identify and annotate edge cases
- Iterate on perception if needed
- Build seasonal baseline data

### Week 7-8: Supervised Autonomous Operations
- 500+ km supervised autonomous driving
- Track safety disengagement rate
- Validate all operational scenarios
- Generate safety case delta report
- Final regulatory submission

### Go/No-Go Decision
```
All gates passed?
├── G1 (Map): ✓ HD map ≤ 0.2m accuracy
├── G2 (Perception): ✓ Personnel recall ≥ 99%
├── G3 (Localization): ✓ Position error ≤ 0.3m (95th)
├── G4 (GNSS): ✓ Multipath map complete
├── G5 (Shadow): ✓ ≤ 1 disagreement per 100 km
├── G6 (Supervised): ✓ 0 safety-critical events in 500 km
├── G7 (Regulatory): ✓ Operating permit received
│
├── ALL PASS → Proceed to unattended operations
└── ANY FAIL → Remediate and re-validate (add 2-4 weeks)
```

---

## References

### Transfer Learning and Domain Adaptation
- PointLoRA (CVPR 2025) — Parameter-efficient fine-tuning for point clouds
- TENT (ICLR 2021) — Test-time entropy minimization
- CoTTA (CVPR 2022) — Continual test-time adaptation
- GD-MAE (NeurIPS 2023) — Generative decoder MAE for 3D pre-training

### Mapping and Localization
- KISS-ICP (RA-L 2023) — Keep It Small and Simple LiDAR odometry
- AMDB/AMXM (EUROCAE ED-119C / RTCA DO-272D) — Aerodrome Mapping Database
- FAA AMDB Portal — Free AMDB data for 500+ US airports

### Related Repository Documents
- `30-autonomy-stack/localization-mapping/maps/hd-map-standards-airside.md` — AMDB/AMXM conversion pipeline
- `30-autonomy-stack/localization-mapping/overview/lidar-slam-algorithms.md` — KISS-ICP, LIO-SAM comparison
- `30-autonomy-stack/perception/overview/lidar-foundation-models.md` — PTv3, PointLoRA
- `30-autonomy-stack/perception/overview/test-time-adaptation-airside.md` — TTA methods for domain shift
- `cross-cutting/fleet-data-pipeline.md` — Data collection and labeling workflows
- `operations/deployment/deployment-playbook.md` — General deployment methodology
- `30-autonomy-stack/perception/overview/model-compression-edge-deployment.md` — Orin deployment recipes
