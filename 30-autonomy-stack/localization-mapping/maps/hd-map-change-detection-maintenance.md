# HD Map Change Detection, Maintenance, and Fleet-Based Updates

> Comprehensive guide to detecting, validating, and propagating changes in HD maps for autonomous driving — covering geometric change detection algorithms (point cloud differencing, semantic segmentation comparison, neural implicit divergence), temporal map evolution and versioning, fleet-based consensus mechanisms, airport-specific change patterns, AIRAC cycle integration, RTMap real-time recursive mapping, map-free and light-map alternatives, cost-benefit analysis for maintenance strategies. Focused on airport airside where construction, temporary equipment, seasonal markings, and 28-day AIRAC updates create a uniquely dynamic mapping challenge.
>
> **Relation to existing docs**: Extends `hd-map-standards-airside.md` (Section 10 briefly covers change detection), `semantic-mapping-learned-priors.md` (Section 8 covers fleet incremental updates), `neural-online-mapping-sota.md` (MapTracker, StreamMapNet for online mapping), `../overview/mapping-and-localization.md` (SLAM and localization). This document goes deep on the *maintenance and evolution* of maps after initial creation — the operational lifecycle that determines whether maps remain trustworthy.

**Key Takeaway**: Map maintenance is the hidden cost of HD map–dependent autonomous driving. Initial map creation costs $20-50K per airport, but annual maintenance through manual re-survey adds $10-20K/year per airport. Fleet-based change detection can reduce maintenance cost by 60-80% by using the vehicles themselves as continuous mapping sensors, requiring manual survey only for safety-critical geometry changes. RTMap (ICCV 2025) achieves real-time centimeter-level map maintenance with noise-aware probabilistic density inference. For airside operations, the critical integration is with the 28-day AIRAC cycle — changes that contradict published aeronautical data require human verification before map update, while changes within the vehicle's operational layer (temporary equipment, surface conditions) can be auto-updated from fleet consensus.

---

## Table of Contents

1. [Why Map Maintenance Matters](#1-why-map-maintenance-matters)
2. [Change Detection Algorithms](#2-change-detection-algorithms)
3. [Temporal Map Evolution and Versioning](#3-temporal-map-evolution-and-versioning)
4. [Fleet-Based Consensus Mechanisms](#4-fleet-based-consensus-mechanisms)
5. [Airport-Specific Change Patterns](#5-airport-specific-change-patterns)
6. [AIRAC Cycle Integration](#6-airac-cycle-integration)
7. [Neural and Implicit Map Maintenance](#7-neural-and-implicit-map-maintenance)
8. [Map-Free and Light-Map Alternatives](#8-map-free-and-light-map-alternatives)
9. [Map Update Distribution and Rollback](#9-map-update-distribution-and-rollback)
10. [Cost-Benefit Analysis](#10-cost-benefit-analysis)
11. [Practical Implementation for Airside](#11-practical-implementation-for-airside)
12. [Key Takeaways](#12-key-takeaways)
13. [References](#13-references)

---

## 1. Why Map Maintenance Matters

### 1.1 The Stale Map Problem

HD maps degrade from the moment they are created. The rate of degradation depends on the environment:

| Environment | Annual Change Rate | Critical Change Frequency |
|---|---|---|
| Highway | 1-5% of features | Monthly (construction, exits) |
| Urban road | 5-15% of features | Weekly (construction, parking) |
| **Airport apron** | **15-30% of features** | **Daily (equipment, ops zones)** |
| Construction site | 50-100% of features | Hourly |

Airports are among the most dynamic operating environments for autonomous vehicles:
- **Temporary equipment** moves constantly (baggage carts, fuel trucks, belt loaders, mobile stairs)
- **Construction** is frequent (terminal expansion, apron resurfacing, new stands)
- **Seasonal changes** affect surface markings (snow coverage, de-icing pad activation, summer paint refresh)
- **Operational changes** reconfigure zones (temporary closures, gate reassignments, emergency diversions)

### 1.2 Consequences of Stale Maps

| Failure Mode | Impact | Severity |
|---|---|---|
| **Missing obstacle in map** | Vehicle doesn't expect barrier → collision risk | Critical |
| **Deleted road boundary** | Vehicle enters non-navigable area | Critical |
| **Wrong lane direction** | Head-on conflict with other GSE | Critical |
| **Outdated speed zone** | Vehicle exceeds actual limit or is unnecessarily slow | Moderate |
| **Missing construction zone** | Vehicle plans through blocked area, must replan | Moderate |
| **Wrong stand geometry** | Positioning error during aircraft service | Moderate |
| **Stale traffic patterns** | Suboptimal routing, congestion | Low |

### 1.3 Current Industry Practice

| Company | Map Strategy | Maintenance Approach | Cost |
|---|---|---|---|
| **Waymo** | HD LiDAR maps | Dedicated mapping fleet, monthly updates per geofence | $1M+/year per city |
| **Tesla** | Map-free (camera-only) | No map maintenance needed | $0 map cost |
| **TractEasy** | Manual survey per airport | Re-survey every 3-6 months | $10-20K/survey |
| **UISEE** | LiDAR SLAM maps | Unknown frequency | Unknown |
| **AeroVect** | HD maps, "mapped half of top 10 US airports" | Manual survey | Significant |
| **comma.ai** | OpenStreetMap + online perception | No HD map maintenance | $0 map cost |
| **Mobileye** | REM (Road Experience Management) | Fleet crowdsourced, 8M vehicles | $0 per vehicle (fleet-funded) |

**Key insight from industry**: The most successful approaches either (a) eliminate HD maps entirely (Tesla, comma.ai) or (b) use fleet-crowdsourced updates (Mobileye REM, Nuro). Manual re-survey doesn't scale.

### 1.4 Aurrigo's Current State

Aurrigo uses a three-layer map architecture (from `hd-map-standards-airside.md`):

1. **AMDB base layer**: Taxiway/apron geometry from aeronautical data (28-day AIRAC cycle)
2. **HD survey overlay**: Service road centerlines, stand positions (manual LiDAR survey)
3. **Live perception**: Dynamic objects (real-time)

The HD survey overlay (Layer 2) is the maintenance bottleneck. It requires manual re-survey when airport geometry changes, costing $10-20K per airport per re-survey. With 10+ airports, this is $100-200K/year.

---

## 2. Change Detection Algorithms

### 2.1 Point Cloud Differencing

The most direct approach: compare current LiDAR scan with stored reference point cloud.

**ICP-based differencing**:
```python
class PointCloudChangeDetector:
    """Detect changes between reference map and live LiDAR scans."""
    
    def __init__(self, reference_map, config):
        self.reference_map = reference_map  # Dense point cloud (from survey)
        self.voxel_size = config.voxel_size  # 0.2m for airside
        self.change_threshold = config.change_threshold  # 0.5m
        self.persistence_threshold = config.persistence_count  # 3 trips
        
        # Build reference KD-tree for efficient nearest-neighbor
        self.ref_tree = KDTree(self.reference_map.points)
        self.change_accumulator = defaultdict(list)  # grid_cell → observations
    
    def detect_changes(self, live_scan, ego_pose):
        """Compare live scan against reference map.
        
        Returns:
            additions: Points in live scan not in reference (new obstacles)
            deletions: Points in reference not in live scan (removed features)
        """
        # Transform live scan to map frame
        live_map = transform_points(live_scan, ego_pose)
        
        # Find additions: points far from any reference point
        distances, _ = self.ref_tree.query(live_map.points)
        addition_mask = distances > self.change_threshold
        additions = live_map.points[addition_mask]
        
        # Find deletions: reference points that should be visible but aren't
        # (only check points within sensor FOV and range)
        visible_ref = self._get_visible_reference(ego_pose)
        live_tree = KDTree(live_map.points)
        ref_distances, _ = live_tree.query(visible_ref)
        deletion_mask = ref_distances > self.change_threshold
        deletions = visible_ref[deletion_mask]
        
        return additions, deletions
    
    def _get_visible_reference(self, ego_pose):
        """Get reference points that should be visible from current pose."""
        # Ray casting: for each reference point, check if ego should see it
        relative = self.reference_map.points - ego_pose[:3]
        distances = np.linalg.norm(relative, axis=1)
        
        # Within LiDAR range (100m for RSHELIOS)
        in_range = distances < 100.0
        # Within vertical FOV (-25° to +15° for RSHELIOS)
        elevation = np.arctan2(relative[:, 2], np.linalg.norm(relative[:, :2], axis=1))
        in_fov = (elevation > np.radians(-25)) & (elevation < np.radians(15))
        
        return self.reference_map.points[in_range & in_fov]
```

**Limitations**:
- Requires accurate localization (GTSAM provides this)
- Dynamic objects create false positives (parked GSE detected as "new obstacle")
- Occlusion causes false negatives (can't see behind new construction)
- Computationally expensive for dense reference maps

### 2.2 Semantic Change Detection

Instead of comparing raw points, compare semantic interpretations:

```python
class SemanticChangeDetector:
    """Detect changes at semantic level (lane markings, barriers, signs)."""
    
    AIRSIDE_SEMANTIC_CLASSES = {
        'taxiway_marking': {'importance': 'high', 'min_confirm': 5},
        'apron_boundary': {'importance': 'critical', 'min_confirm': 3},
        'equipment_zone': {'importance': 'medium', 'min_confirm': 3},
        'speed_sign': {'importance': 'high', 'min_confirm': 3},
        'barrier': {'importance': 'critical', 'min_confirm': 2},
        'construction_zone': {'importance': 'critical', 'min_confirm': 2},
        'stand_marking': {'importance': 'high', 'min_confirm': 5},
        'hold_line': {'importance': 'critical', 'min_confirm': 3},
    }
    
    def detect_semantic_changes(self, perception_output, map_semantics, ego_pose):
        """Compare perceived semantics with map semantics.
        
        perception_output: segmented point cloud with class labels
        map_semantics: expected semantic features at current location
        """
        changes = []
        
        for expected_feature in map_semantics.get_features_near(ego_pose, radius=50):
            # Check if expected feature is detected
            detected = self._find_matching_detection(
                expected_feature, perception_output
            )
            
            if detected is None:
                # Feature missing — possible deletion
                changes.append(Change(
                    type='deletion',
                    feature=expected_feature,
                    confidence=self._occlusion_adjusted_confidence(
                        expected_feature, ego_pose
                    )
                ))
            elif self._geometry_differs(detected, expected_feature):
                # Feature moved or reshaped
                changes.append(Change(
                    type='modification',
                    feature=expected_feature,
                    new_geometry=detected.geometry,
                    confidence=detected.confidence
                ))
        
        # Check for new features not in map
        for detection in perception_output.static_features:
            if not map_semantics.has_matching_feature(detection, threshold=2.0):
                changes.append(Change(
                    type='addition',
                    new_feature=detection,
                    confidence=detection.confidence
                ))
        
        return changes
```

### 2.3 Urban 3D Change Detection (2025 SOTA)

Recent work on urban 3D change detection using LiDAR specifically targets HD map maintenance:

**Approach** (arXiv:2510.21112):
1. Align multi-temporal LiDAR scans using ICP/NDT
2. Voxelize both scans at resolution r
3. For each voxel, compute occupancy change: Δ_occ = occ_new - occ_ref
4. Cluster changed voxels into change objects
5. Classify changes: construction, demolition, vegetation growth, vehicle (filter)

**Performance**: Detects building-level changes with >90% recall, sub-meter precision.

**Adaptation for airside**: Replace building detection with equipment/barrier detection. The voxel-level change detection is directly applicable to detecting new construction barriers, moved equipment, and surface changes.

### 2.4 AI-Driven Change Detection

CNN-based approaches combining semantic segmentation with anomaly detection:

**Architecture**:
```
Live sensor data → Semantic segmentation → Feature extraction
                                                    ↓
Map representation → Expected features → Feature comparison
                                                    ↓
                                            Change classifier
                                                    ↓
                                    ┌───────────────┴───────────────┐
                                    ↓                               ↓
                            True change                     False positive
                            (construction,                  (parked vehicle,
                             new marking)                    lighting change)
```

**Key challenge**: Distinguishing true map changes from temporary conditions (parked vehicles, weather effects, lighting variations). Solutions:
- **Temporal persistence**: Require multiple observations across different times
- **Class-based filtering**: Known dynamic classes (vehicles, people, carts) are never map changes
- **Time-of-day normalization**: Lighting changes don't constitute map changes
- **Weather filtering**: Don't flag changes during rain/snow events

### 2.5 Comparison of Change Detection Approaches

| Approach | Precision | Recall | Latency | Compute | Best For |
|---|---|---|---|---|---|
| **Point cloud diff** | Medium (many FP) | High | 50-200ms | High | Large geometry changes |
| **Semantic comparison** | High | Medium | 100-300ms | Medium | Feature-level changes |
| **Voxel occupancy** | Medium-High | High | 20-50ms | Low | Volume changes |
| **Neural implicit** | High | High | 200-500ms | High | Subtle/complex changes |
| **Image-based** | Medium | High | 10-50ms | Low | Marking/sign changes |

---

## 3. Temporal Map Evolution and Versioning

### 3.1 Map Version Control

Maps are living documents that evolve over time. A proper version control system is essential:

```python
class MapVersionManager:
    """Semantic versioning for HD maps with AIRAC alignment."""
    
    def __init__(self, airport_id):
        self.airport_id = airport_id
        self.versions = []
        self.current_version = None
    
    def create_version(self, changes, source):
        """
        Version format: AIRAC.PATCH.FLEET
        
        AIRAC: Aligns to 28-day AIRAC cycle (e.g., 2602 = 2nd cycle of 2026)
        PATCH: Manual survey/correction within AIRAC cycle
        FLEET: Fleet-detected changes (auto-increment)
        
        Example: 2602.1.15 = AIRAC cycle 2602, 1 manual patch, 15 fleet updates
        """
        if source == 'airac':
            new_version = self._increment_airac()
        elif source == 'survey':
            new_version = self._increment_patch()
        elif source == 'fleet':
            new_version = self._increment_fleet()
        
        version_record = MapVersion(
            version=new_version,
            timestamp=datetime.utcnow(),
            changes=changes,
            source=source,
            parent=self.current_version,
            checksum=self._compute_checksum(changes),
        )
        self.versions.append(version_record)
        self.current_version = version_record
        return version_record
```

### 3.2 Change Lifecycle

Every detected change goes through a lifecycle:

```
Detection → Accumulation → Validation → Integration → Distribution → Verification
    │            │              │              │              │              │
  Single      Multiple      Consensus/     Apply to      Push to        Vehicles
  vehicle    observations   human review    base map     fleet OTA      confirm
  observes   confirm                                                    receipt
```

**State machine**:

| State | Entry Condition | Exit Condition | Duration |
|---|---|---|---|
| **Detected** | Single vehicle observes anomaly | Accumulated by 2+ vehicles | Minutes-hours |
| **Accumulated** | Multiple independent observations | Consensus threshold met | Hours-days |
| **Pending Review** | Safety-critical change consensus | Human approves/rejects | Hours (24h SLA) |
| **Validated** | Human review passed (or auto-validated for low-risk) | Applied to map | Minutes |
| **Integrated** | Map updated in central repository | Distributed to fleet | Minutes-hours |
| **Distributed** | All vehicles receive update | Vehicles confirm receipt | Minutes |
| **Verified** | Vehicles confirm change matches their observations | Change archived | Hours |

### 3.3 Temporal Decay Model

Not all map features decay at the same rate. Model feature reliability as a function of time since last confirmation:

```python
class FeatureReliability:
    """Bayesian reliability model for map features."""
    
    # Feature-type specific decay parameters
    DECAY_RATES = {
        'permanent_structure': {'half_life_days': 365, 'min_reliability': 0.8},
        'road_marking': {'half_life_days': 90, 'min_reliability': 0.3},
        'barrier': {'half_life_days': 30, 'min_reliability': 0.2},
        'equipment_zone': {'half_life_days': 7, 'min_reliability': 0.1},
        'traffic_sign': {'half_life_days': 180, 'min_reliability': 0.5},
        'construction_zone': {'half_life_days': 14, 'min_reliability': 0.1},
        'surface_condition': {'half_life_days': 3, 'min_reliability': 0.0},
    }
    
    def compute_reliability(self, feature_type, days_since_confirmation):
        """Exponential decay with feature-type-specific half-life."""
        params = self.DECAY_RATES[feature_type]
        decay_rate = np.log(2) / params['half_life_days']
        reliability = np.exp(-decay_rate * days_since_confirmation)
        return max(reliability, params['min_reliability'])
    
    def needs_reverification(self, feature, threshold=0.6):
        """Flag features that need re-observation."""
        days = (datetime.utcnow() - feature.last_confirmed).days
        reliability = self.compute_reliability(feature.type, days)
        return reliability < threshold
```

### 3.4 Diff-Based Map Updates

Instead of distributing full maps, send only diffs:

```python
class MapDiff:
    """Minimal representation of map changes for OTA distribution."""
    
    def __init__(self):
        self.additions = []      # New features
        self.deletions = []      # Removed features (by ID)
        self.modifications = []  # Changed features (ID + new attributes)
        self.metadata = {
            'parent_version': None,
            'new_version': None,
            'timestamp': None,
            'source': None,  # 'airac', 'survey', 'fleet'
            'size_bytes': 0,
        }
    
    def serialize(self):
        """Compress diff for OTA transmission.
        
        Typical sizes:
        - Fleet update (few features): 1-10 KB
        - Survey patch (moderate changes): 10-100 KB
        - AIRAC update (significant changes): 100 KB - 1 MB
        - Full map: 10-50 MB per airport
        """
        data = msgpack.packb({
            'a': [(f.id, f.type, f.geometry.to_bytes()) for f in self.additions],
            'd': [f.id for f in self.deletions],
            'm': [(f.id, f.changed_attributes) for f in self.modifications],
            'meta': self.metadata,
        })
        return zstd.compress(data)  # 3-5x compression
```

---

## 4. Fleet-Based Consensus Mechanisms

### 4.1 The Multi-Vehicle Confirmation Problem

A single vehicle's observation may be:
- **Correct and real**: True change in environment
- **Perception error**: Misdetection, misclassification, localization drift
- **Temporary condition**: Parked vehicle, construction equipment in transit
- **Environmental artifact**: Rain puddle, shadow, low-sun reflection

Fleet consensus filters perception errors and temporary conditions while preserving real changes.

### 4.2 Voting-Based Consensus

Simple but effective: require N independent observations to confirm a change.

```python
class VotingConsensus:
    """N-of-M voting for map change confirmation."""
    
    def __init__(self, config):
        self.min_votes = config.min_votes           # 3
        self.min_unique_vehicles = config.min_vehicles  # 2
        self.time_window_hours = config.time_window  # 24
        self.spatial_tolerance_m = config.spatial_tol  # 2.0
        self.pending_changes = defaultdict(list)
    
    def submit_observation(self, vehicle_id, change_observation):
        """Submit a change observation from a vehicle."""
        # Spatial hash for grouping nearby observations
        grid_key = self._spatial_hash(
            change_observation.location, 
            self.spatial_tolerance_m
        )
        
        self.pending_changes[grid_key].append({
            'vehicle_id': vehicle_id,
            'timestamp': datetime.utcnow(),
            'observation': change_observation,
        })
        
        # Check consensus
        return self._check_consensus(grid_key)
    
    def _check_consensus(self, grid_key):
        """Check if enough votes exist for this change."""
        observations = self.pending_changes[grid_key]
        
        # Filter to recent observations within time window
        cutoff = datetime.utcnow() - timedelta(hours=self.time_window_hours)
        recent = [o for o in observations if o['timestamp'] > cutoff]
        
        # Count unique vehicles
        unique_vehicles = len(set(o['vehicle_id'] for o in recent))
        
        if len(recent) >= self.min_votes and unique_vehicles >= self.min_unique_vehicles:
            # Consensus reached — merge observations
            merged = self._merge_observations(recent)
            return ConsensusResult(
                confirmed=True,
                merged_change=merged,
                confidence=len(recent) / (self.min_votes * 2),  # scale to [0.5, 1.0]
                observations=recent,
            )
        
        return ConsensusResult(confirmed=False)
```

### 4.3 Bayesian Consensus

More sophisticated: model the probability of change given observations.

```python
class BayesianConsensus:
    """Bayesian approach to map change confirmation."""
    
    def __init__(self, prior_change_prob=0.01):
        # Prior: probability that any given feature has changed
        # Low prior reflects that most features are stable
        self.prior = prior_change_prob
        
        # Per-vehicle detection reliability (updated from fleet performance)
        self.vehicle_reliability = {}  # vehicle_id → (TPR, FPR)
        self.default_tpr = 0.8  # true positive rate
        self.default_fpr = 0.05  # false positive rate
    
    def update_belief(self, feature_id, observations):
        """
        Bayesian update: P(changed | observations) using independence assumption.
        
        P(changed | obs) ∝ P(obs | changed) * P(changed)
        P(unchanged | obs) ∝ P(obs | unchanged) * P(unchanged)
        
        For each vehicle observation:
          P(detect change | changed) = TPR
          P(detect change | unchanged) = FPR
          P(no detect | changed) = 1 - TPR (FNR)
          P(no detect | unchanged) = 1 - FPR (TNR)
        """
        log_odds = np.log(self.prior / (1 - self.prior))
        
        for obs in observations:
            vehicle_id = obs['vehicle_id']
            detected_change = obs['detected_change']
            
            tpr, fpr = self.vehicle_reliability.get(
                vehicle_id, (self.default_tpr, self.default_fpr)
            )
            
            if detected_change:
                # Vehicle detected a change
                log_likelihood_ratio = np.log(tpr / fpr)
            else:
                # Vehicle did NOT detect a change (passed through without flagging)
                log_likelihood_ratio = np.log((1 - tpr) / (1 - fpr))
            
            log_odds += log_likelihood_ratio
        
        posterior = 1 / (1 + np.exp(-log_odds))
        return posterior
    
    def should_update_map(self, posterior, change_type):
        """Decision thresholds vary by change criticality."""
        thresholds = {
            'safety_critical': 0.99,   # barrier, hold line → very high confidence
            'navigation': 0.90,         # road boundary, marking
            'optimization': 0.70,       # traffic pattern, surface condition
        }
        return posterior > thresholds.get(change_type, 0.90)
```

### 4.4 Spatial Clustering for Change Aggregation

Multiple vehicles may observe the same change from different angles and positions. Cluster observations spatially:

```python
def cluster_change_observations(observations, eps=3.0, min_samples=2):
    """DBSCAN clustering of spatially related change observations.
    
    eps: max distance between observations in same cluster (meters)
    min_samples: minimum observations to form a cluster
    """
    if len(observations) < min_samples:
        return []
    
    positions = np.array([obs.location for obs in observations])
    clustering = DBSCAN(eps=eps, min_samples=min_samples).fit(positions)
    
    clusters = []
    for label in set(clustering.labels_):
        if label == -1:
            continue  # noise
        
        cluster_obs = [observations[i] for i, l in enumerate(clustering.labels_) if l == label]
        
        # Compute cluster center (weighted by observation confidence)
        weights = np.array([obs.confidence for obs in cluster_obs])
        center = np.average(
            [obs.location for obs in cluster_obs], 
            weights=weights, axis=0
        )
        
        clusters.append(ChangeCluster(
            center=center,
            observations=cluster_obs,
            confidence=np.mean(weights),
            bounding_box=compute_bbox(cluster_obs),
            unique_vehicles=len(set(obs.vehicle_id for obs in cluster_obs)),
        ))
    
    return clusters
```

### 4.5 Handling Adversarial/Faulty Observations

Some vehicles may consistently report false changes (sensor degradation, calibration drift):

- **Byzantine filtering**: Inspired by FLTrust (from `cross-cutting/federated-learning-fleet.md`), maintain a trusted reference observation per feature from the last survey
- **Vehicle reputation scoring**: Track each vehicle's change detection accuracy over time; downweight consistently wrong vehicles
- **Outlier rejection**: If one vehicle reports a change that 5 others don't, the lone report is likely faulty

---

## 5. Airport-Specific Change Patterns

### 5.1 Change Taxonomy for Airside

Airports have unique change patterns distinct from road environments:

| Change Category | Frequency | Predictability | Duration | Auto-Update? |
|---|---|---|---|---|
| **Terminal construction** | Monthly-yearly | Low (but announced) | Months-years | No — human review |
| **Apron resurfacing** | Yearly | Scheduled | Weeks | No — human review |
| **New stand construction** | Yearly | Announced in NOTAM | Months | No — NOTAM integration |
| **Jet bridge repositioning** | Monthly | Low | Permanent | Fleet consensus (5+ obs) |
| **Temporary barriers** | Weekly | Low | Days-weeks | Fleet consensus (3+ obs) |
| **Equipment staging areas** | Daily | Moderate (shift-based) | Hours | Auto-update (time-aware) |
| **De-icing pad activation** | Seasonal | Weather-linked | Days-months | METAR + fleet |
| **Snow coverage** | Seasonal | Weather forecast | Hours-days | METAR + perception |
| **Paint/marking refresh** | Seasonal | Scheduled | Permanent | Fleet consensus (5+ obs) |
| **NOTAM closures** | Variable | Pre-announced | Hours-days | NOTAM feed integration |

### 5.2 Construction Zone Detection

Airport construction is the highest-impact change type. Detection requirements:

```python
class ConstructionZoneDetector:
    """Detect and track construction zones from fleet observations."""
    
    CONSTRUCTION_INDICATORS = [
        'orange_cone',
        'jersey_barrier',
        'construction_sign',
        'temporary_fence',
        'construction_vehicle',  # excavator, crane, dump truck
        'open_trench',
        'unpaved_surface',  # where map expects paved
    ]
    
    def detect(self, perception_output, map_context):
        """
        Construction zone = cluster of construction indicators
        that persist across multiple vehicles and time periods.
        """
        indicators = []
        for detection in perception_output.detections:
            if detection.class_name in self.CONSTRUCTION_INDICATORS:
                indicators.append(detection)
        
        if len(indicators) < 2:
            return None
        
        # Cluster indicators spatially
        zone = self._convex_hull(indicators)
        
        # Cross-reference with NOTAM data
        notam_match = self._check_notam_overlap(zone, map_context.active_notams)
        
        return ConstructionZone(
            boundary=zone,
            indicators=indicators,
            notam_corroborated=notam_match is not None,
            confidence=0.9 if notam_match else 0.6,
            recommended_action='block_zone' if notam_match else 'flag_for_review',
        )
```

### 5.3 Seasonal Adaptation

Airport maps need seasonal layers:

| Season | Map Changes | Detection Method |
|---|---|---|
| **Winter** | Snow cover obscures markings, de-icing pads active, salt/brine changes friction | METAR visibility + fleet friction estimation |
| **Summer** | Fresh paint markings, heat shimmer affects perception, increased construction | Fleet marking detection, perception confidence monitoring |
| **Rainy season** | Standing water areas, changed drainage paths, reduced marking visibility | Fleet water detection, drainage map updates |
| **Holiday peaks** | Temporary overflow stands, extra equipment zones, changed traffic flow | Fleet traffic pattern learning, AODB integration |

### 5.4 Diurnal Changes

Some changes are time-dependent and cyclic:

- **Night shifts**: Different equipment staging areas than day shifts
- **Peak hours**: Temporary one-way flow on service roads
- **Gate allocation changes**: Morning long-haul departures vs afternoon domestic
- **Lighting conditions**: Shadows from terminal buildings move through the day

**Approach**: Maintain time-conditioned map layers. The map at 3 AM looks different from the map at 3 PM — not because geometry changed, but because which features are relevant and where temporary equipment sits varies by time.

---

## 6. AIRAC Cycle Integration

### 6.1 AIRAC Overview

The Aeronautical Information Regulation and Control (AIRAC) cycle is the international standard for publishing aeronautical data changes:

- **Cycle length**: 28 days (13 cycles per year)
- **Publication date**: 42 days before effective date
- **Effective date**: 0000 UTC on the designated day
- **Data scope**: Taxiway geometry, runway status, NAVAIDs, obstacles, procedures

### 6.2 AIRAC → Map Update Pipeline

```
AIRAC Publication (T-42 days)
        │
        ▼
  Parse AMDB/AMXM updates
  (see hd-map-standards-airside.md Section 5)
        │
        ▼
  Diff against current map
        │
        ├── No conflicts → Stage update for effective date
        │
        └── Conflicts with fleet observations → Flag for review
                │
                ▼
        Manual reconciliation
        (AIRAC takes precedence for regulatory features)
        │
        ▼
  Apply update at T+0 (effective date)
        │
        ▼
  Distribute to fleet via OTA
        │
        ▼
  Fleet verification (first vehicles to operate confirm map accuracy)
```

### 6.3 AIRAC-Fleet Conflict Resolution

What happens when fleet observations contradict upcoming AIRAC data?

| Scenario | Resolution | Rationale |
|---|---|---|
| Fleet detects new barrier; AIRAC doesn't mention it | Keep fleet observation | AIRAC only covers published features |
| AIRAC closes taxiway; fleet hasn't detected closure | Apply AIRAC (may not be visible yet) | Regulatory data takes precedence |
| Fleet shows new marking; AIRAC shows different marking | Flag for human review | Possible surveying error or early implementation |
| AIRAC redesignates stand; fleet confirms new numbers | Apply AIRAC, fleet validates | Mutual confirmation |

```python
class AIRACFleetReconciler:
    """Reconcile AIRAC updates with fleet-observed map state."""
    
    AIRAC_PRECEDENCE_FEATURES = [
        'runway_designation',
        'taxiway_designation',
        'holding_position',
        'movement_area_boundary',
        'restricted_area',
    ]
    
    def reconcile(self, airac_diff, fleet_map):
        """
        Compare incoming AIRAC changes with current fleet-maintained map.
        """
        results = []
        
        for change in airac_diff.changes:
            fleet_feature = fleet_map.get_feature(change.feature_id)
            
            if fleet_feature is None:
                # New feature from AIRAC — add directly
                results.append(ReconcileAction('add', change, source='airac'))
                
            elif change.type in self.AIRAC_PRECEDENCE_FEATURES:
                # Regulatory feature — AIRAC always wins
                if self._geometry_differs(change, fleet_feature):
                    results.append(ReconcileAction(
                        'override', change, 
                        source='airac',
                        note=f'Overriding fleet observation for regulatory feature'
                    ))
                    
            else:
                # Non-regulatory feature — check fleet agreement
                if self._geometry_differs(change, fleet_feature):
                    results.append(ReconcileAction(
                        'review', change,
                        source='conflict',
                        fleet_observation=fleet_feature,
                        note=f'AIRAC and fleet disagree on {change.feature_id}'
                    ))
        
        return results
```

### 6.4 Dual-Layer Architecture

Maintain two map layers with different authority:

```
┌─────────────────────────────────────────┐
│  Layer 1: Regulatory (AIRAC-sourced)     │
│  • Taxiway geometry & designations       │
│  • Holding positions                     │
│  • Movement area boundaries              │
│  • Restricted/prohibited areas           │
│  • Runway-taxiway intersections          │
│  Update: 28-day AIRAC cycle only         │
│  Authority: AIRAC data takes precedence  │
└─────────────────────────────────────────┘
                    ↕ merged at runtime
┌─────────────────────────────────────────┐
│  Layer 2: Operational (Fleet-sourced)    │
│  • Service road geometry (HD detail)     │
│  • Stand precise positioning             │
│  • Equipment zones                       │
│  • Surface conditions                    │
│  • Construction zones                    │
│  • Traffic patterns                      │
│  Update: Continuous fleet consensus      │
│  Authority: Fleet consensus + human      │
└─────────────────────────────────────────┘
```

---

## 7. Neural and Implicit Map Maintenance

### 7.1 RTMap: Real-Time Recursive Mapping (ICCV 2025)

RTMap achieves real-time centimeter-level map maintenance through an end-to-end model:

**Architecture**:
- Inputs: current sensor observation + prior HD map
- Outputs: updated HD map elements + change probability
- Key innovation: probabilistic density inference for noise-aware mapping
- Recursively maintains the map — each pass updates the prior

**How it works**:
1. Encode current observation as feature vectors
2. Encode prior map elements as feature vectors
3. Cross-attention between observation and map features
4. Predict element-wise update (position correction, addition, deletion)
5. Output new map with per-element confidence

**Performance**: Centimeter-level localization accuracy while simultaneously detecting map changes. Runs in real-time on GPU.

**Relevance for airside**: RTMap's recursive nature means each vehicle pass through an area refines the map. Over a fleet of 20 vehicles operating 16 hours/day, every point on the apron is observed dozens of times — providing continuous, real-time map maintenance.

### 7.2 Implicit Map Representations

The trend toward implicit (neural) maps fundamentally changes the maintenance problem:

| Representation | Maintenance Approach | Pros | Cons |
|---|---|---|---|
| **Explicit HD map** (Lanelet2/AMXM) | Detect changes, patch features | Interpretable, version-controllable | Brittle, expensive to maintain |
| **Neural Map Prior** (NMP) | Re-aggregate fleet features | Learns from fleet naturally | Less interpretable |
| **PriorDrive** | Unified prior from heterogeneous sources | Graceful degradation with stale data | Training required |
| **Neural Radiance Fields** | Re-train from new observations | Photorealistic, continuous | Expensive to retrain |
| **Gaussian Splatting** | Add/remove/move Gaussians | Fast updates, explicit structure | Large storage |

### 7.3 NMP Fleet Update Loop

Neural Map Prior (from `semantic-mapping-learned-priors.md`) naturally handles map maintenance:

```
Vehicle observations → Compress to NMP features → Upload to edge server
                                                        │
                                                        ▼
                                            Aggregate with existing NMP
                                            (weighted average by recency)
                                                        │
                                                        ▼
                                            Updated NMP distributed to fleet
                                            (download on next shift start)
```

**Key property**: NMP features are continuous vectors, not discrete geometry. Averaging features from multiple vehicles automatically filters noise and highlights persistent changes. A temporary parked truck averages out; a new permanent barrier persists.

### 7.4 3DGS for Map Maintenance

Gaussian Splatting maps (from `gaussian-splatting-driving.md`) offer explicit map maintenance:

```python
class GaussianMapMaintainer:
    """Maintain 3DGS map using fleet observations."""
    
    def update_from_observation(self, gaussians, new_lidar_scan, ego_pose):
        """
        Update Gaussian map incrementally.
        
        1. Identify Gaussians visible from current pose
        2. Compare rendered view with actual observation
        3. Adjust Gaussians to minimize rendering error
        4. Add new Gaussians for unmatched observations
        5. Reduce opacity of Gaussians not observed when expected
        """
        # Render expected view from Gaussian map
        expected = self.render(gaussians, ego_pose)
        actual = new_lidar_scan.to_depth_image(ego_pose)
        
        # Per-pixel residual
        residual = actual - expected
        
        # Regions where actual has content but expected doesn't → new features
        new_regions = (actual > 0) & (expected == 0)
        if new_regions.sum() > self.min_new_pixels:
            new_gaussians = self.initialize_gaussians(
                new_lidar_scan[new_regions], ego_pose
            )
            gaussians.add(new_gaussians)
        
        # Regions where expected has content but actual doesn't → removed features
        removed_regions = (actual == 0) & (expected > 0)
        if removed_regions.sum() > self.min_removed_pixels:
            # Don't immediately remove — reduce opacity
            affected_ids = self.get_gaussian_ids(removed_regions, ego_pose)
            for gid in affected_ids:
                gaussians[gid].opacity *= 0.9  # decay
            # Remove when opacity drops below threshold
            gaussians.prune(opacity_threshold=0.01)
        
        # Fine-tune remaining Gaussians (few gradient steps)
        self.refine(gaussians, new_lidar_scan, ego_pose, n_steps=5)
```

---

## 8. Map-Free and Light-Map Alternatives

### 8.1 The Map-Free Trend

The industry is moving away from HD maps for good reason:

| Company | Strategy | Motivation |
|---|---|---|
| **Tesla** | Map-free, camera-only | HD maps don't scale to all roads |
| **comma.ai** | OSM + online perception | Maintenance cost, coverage gaps |
| **Wayve** | Light map (topology only) | Flexibility, cross-city generalization |
| **MapTracker** | Online vectorized mapping | +69% consistency without prior maps |

### 8.2 Can Airside Go Map-Free?

Analysis for airport operations:

| Factor | Map-Free Feasibility | Notes |
|---|---|---|
| **Localization** | Difficult | RTK-GPS works outdoors but not under terminal overhangs |
| **Route planning** | Possible | Can follow other vehicles/markings, but needs graph |
| **Stand positioning** | Hard | Requires precise alignment to aircraft nose wheel |
| **Regulatory** | Unlikely | ISO 3691-4 expects documented operational area definition |
| **Safety zones** | No | Aircraft proximity zones, jet blast zones must be predefined |
| **Right-of-way** | No | Priority rules are not perceivable from sensors alone |

**Verdict**: Full map-free is not feasible for airside due to safety zone definitions and regulatory requirements. However, a **light-map** approach is viable:

### 8.3 Light-Map Architecture for Airside

```
Heavy HD Map (current):
  - Full Lanelet2 geometry (~50 MB per airport)
  - Detailed surface markings
  - 3D point cloud reference
  - Requires expensive maintenance

Light Map (proposed):
  - Topology graph: nodes (stands, intersections) + edges (paths) (~500 KB)
  - Safety zones: aircraft proximity polygons, jet blast cones (~100 KB)
  - Speed limits per edge (~10 KB)
  - Right-of-way rules per intersection (~10 KB)
  - AIRAC regulatory overlay (~100 KB)
  Total: ~720 KB per airport (0.1% of HD map)
  
  + Online perception fills in geometry (using MapTracker/StreamMapNet)
  + Fleet consensus builds geometric priors over time (NMP)
```

**Advantages**:
- Topology rarely changes (requires new construction)
- Safety zones change only with aircraft type assignments (AODB integration)
- Speed limits change only with regulatory updates (AIRAC)
- Online perception handles all geometric detail
- Maintenance cost drops from $10-20K/year to ~$2-5K/year per airport

### 8.4 Hybrid Strategy

The recommended approach is a hybrid that uses each layer's strength:

| Map Layer | Source | Update Frequency | Maintenance |
|---|---|---|---|
| **Topology** | Initial survey + AIRAC | Yearly (or on construction) | Near-zero cost |
| **Safety zones** | Expert-defined | Per aircraft type change | Low cost |
| **Regulatory** | AIRAC feed | 28-day cycle | Automated |
| **Geometric prior** | NMP from fleet | Continuous | Zero marginal cost |
| **Live geometry** | Online perception | Real-time | Zero cost (already running) |
| **Surface conditions** | Fleet + METAR | Continuous | Zero marginal cost |

---

## 9. Map Update Distribution and Rollback

### 9.1 OTA Map Distribution

Map updates must be distributed to the fleet reliably:

```python
class MapOTADistributor:
    """Distribute map updates to fleet vehicles."""
    
    def distribute_update(self, map_diff, fleet):
        """
        Distribution strategy:
        1. Push to 10% of fleet (canary group)
        2. Monitor for 2 hours — check localization quality
        3. If no degradation, push to remaining fleet
        4. If degradation detected, rollback canary group
        """
        canary_group = fleet.get_canary_vehicles()
        
        # Push to canary
        for vehicle in canary_group:
            vehicle.receive_map_update(
                map_diff.serialize(),
                version=map_diff.metadata['new_version'],
            )
        
        # Monitor localization quality
        monitor_start = datetime.utcnow()
        while (datetime.utcnow() - monitor_start).seconds < 7200:  # 2 hours
            metrics = self._collect_localization_metrics(canary_group)
            
            if metrics['mean_position_error'] > 0.3:  # 30cm threshold
                self._rollback(canary_group, map_diff.metadata['parent_version'])
                return DistributionResult(success=False, reason='localization degradation')
            
            if metrics['max_position_error'] > 1.0:  # 1m hard limit
                self._rollback(canary_group, map_diff.metadata['parent_version'])
                return DistributionResult(success=False, reason='localization outlier')
        
        # Canary passed — distribute to full fleet
        for vehicle in fleet.get_all_vehicles():
            if vehicle not in canary_group:
                vehicle.receive_map_update(
                    map_diff.serialize(),
                    version=map_diff.metadata['new_version'],
                )
        
        return DistributionResult(success=True)
```

### 9.2 Rollback Capability

Every vehicle must maintain at least 2 map versions:

```
Vehicle storage:
├── maps/
│   ├── current/      ← active map (latest version)
│   ├── previous/     ← fallback map (previous version)
│   └── staging/      ← incoming update (not yet active)
```

**Rollback triggers**:
- Localization quality degrades (position uncertainty spikes)
- Perception output conflicts with map (too many unexpected detections)
- Operator reports map inaccuracy
- Central system commands rollback

### 9.3 Bandwidth and Storage

| Operation | Data Size | Frequency | Annual Bandwidth |
|---|---|---|---|
| Full map download (new airport) | 10-50 MB | Once | 50 MB |
| AIRAC update | 100 KB - 1 MB | Every 28 days | ~13 MB |
| Fleet-detected update | 1-10 KB | Daily | ~3.6 MB |
| NMP prior update | 5-20 MB | Weekly | ~1 GB |
| **Total per vehicle** | | | **~1.1 GB/year** |

This is negligible compared to sensor data upload (50 GB/day from `data-flywheel-airside.md`).

---

## 10. Cost-Benefit Analysis

### 10.1 Current Cost of Manual Map Maintenance

| Cost Item | Per Airport | Per Re-Survey | Annual (quarterly) |
|---|---|---|---|
| Survey team (2 people × 3 days) | | $3,000-5,000 | $12-20K |
| Survey equipment rental | | $1,000-2,000 | $4-8K |
| Post-processing (point cloud → Lanelet2) | | $2,000-5,000 | $8-20K |
| QA/validation | | $1,000-2,000 | $4-8K |
| **Total per airport** | | **$7-14K** | **$28-56K** |
| **10 airports** | | | **$280-560K** |

### 10.2 Fleet-Based Maintenance Cost

| Cost Item | One-Time | Annual |
|---|---|---|
| Change detection software development | $20-40K | — |
| Edge server per airport (for aggregation) | $3,500 | $500 (maintenance) |
| Cloud compute for NMP aggregation | — | $2-5K |
| Human review for safety-critical changes | — | $3-5K per airport |
| OTA infrastructure (shared with fleet management) | $0 (existing) | $0 |
| **Total (10 airports)** | **$55-75K** | **$55-100K** |

### 10.3 Cost Comparison

| Approach | Year 1 | Year 2+ | 10 Airports Year 3 |
|---|---|---|---|
| **Manual quarterly re-survey** | $28-56K/airport | $28-56K/airport | $280-560K |
| **Fleet-based (with initial dev)** | $75-115K total | $55-100K total | $55-100K |
| **Hybrid (fleet + annual survey)** | $85-125K total | $80-130K total | $80-130K |
| **Light-map + online perception** | $40-60K total | $20-50K total | $20-50K |

**Break-even**: Fleet-based approach breaks even vs manual at 2-3 airports by Year 2.

### 10.4 Hidden Costs of Stale Maps

| Risk | Probability/Year | Cost Per Incident | Expected Annual Cost |
|---|---|---|---|
| Vehicle enters construction zone | 5-10% with stale map | $10-50K (vehicle damage + downtime) | $0.5-5K |
| Wrong route due to closed taxiway | 10-20% | $1-5K (delay, manual intervention) | $0.1-1K |
| Aircraft proximity due to wrong stand geometry | 1-2% | $250K+ (aircraft damage) | $2.5-5K |
| Regulatory finding due to outdated map | 5% | $50-100K (compliance remediation) | $2.5-5K |
| **Total expected annual hidden cost** | | | **$5.6-16K per airport** |

This hidden cost further justifies the investment in fleet-based maintenance.

---

## 11. Practical Implementation for Airside

### 11.1 Phased Deployment

#### Phase 0: Change Logging (Weeks 1-4, $5-10K)
- Log all perception outputs that don't match map
- Classify as dynamic (ignore) or potentially static (flag)
- Build database of change observations
- **No map changes yet — observation only**

#### Phase 1: Offline Consensus (Weeks 5-10, $10-15K)
- Aggregate change observations daily (batch processing)
- Implement voting-based consensus (N=3 vehicles, 24h window)
- Human review dashboard for flagged changes
- **Manual map updates based on fleet recommendations**

#### Phase 2: Semi-Automated Updates (Weeks 11-18, $15-20K)
- Implement Bayesian consensus
- Auto-update non-safety features (traffic patterns, surface conditions)
- Human-in-the-loop for safety-critical changes
- Canary deployment with localization monitoring
- **Reduced manual survey frequency (semi-annual → annual)**

#### Phase 3: Continuous Fleet Maintenance (Weeks 19-28, $15-25K)
- Deploy NMP-based continuous map prior updates
- Integrate AIRAC feed for automated regulatory layer updates
- Implement time-conditioned map layers
- Light-map transition where feasible
- **Manual survey only for major construction changes**

**Total**: $45-70K over 28 weeks

### 11.2 ROS Integration

```yaml
# Map change detection node
/map_maintenance/change_detector:
  subscribe:
    - /perception/static_features   # Detected markings, barriers, signs
    - /localization/pose             # Current ego pose
    - /map_server/current_map        # Active map for comparison
  publish:
    - /map_maintenance/observations  # Detected changes (to edge server)
    - /map_maintenance/local_patches # Temporary local map corrections
    - /map_maintenance/reliability   # Per-feature reliability scores

# Edge server aggregation (not on vehicle)
map_aggregation_service:
  subscribe:
    - /fleet/*/map_maintenance/observations  # All vehicle observations
  publish:
    - /map_server/updates           # Validated map changes
    - /map_maintenance/consensus    # Consensus status per change
```

### 11.3 Integration with Existing Aurrigo Architecture

```
                    AIRAC Feed (28-day)
                         │
                         ▼
┌───────────────────────────────────────┐
│           Map Version Manager          │
│  (reconcile AIRAC + fleet + survey)   │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│          Current Map (Lanelet2)        │
│  Layer 1: Regulatory (AIRAC)          │
│  Layer 2: HD Geometry (survey+fleet)  │
│  Layer 3: Semantic (fleet-learned)    │
│  Layer 4: Conditions (fleet+METAR)    │
└───────────────────┬───────────────────┘
                    │
          ┌─────────┴──────────┐
          ▼                    ▼
   GTSAM Localization    Frenet Planner
   (uses Layer 2 for     (uses all layers
    scan matching)         for planning)
```

---

## 12. Key Takeaways

1. **Map maintenance is the hidden cost of HD map–dependent AV**: Initial map creation ($20-50K) is a one-time cost. Quarterly manual re-survey ($28-56K/year per airport) is recurring and doesn't scale. Fleet-based maintenance reduces this by 60-80%.

2. **Fleet-based change detection is fundamentally crowdsourced SLAM**: Each vehicle is a continuous mapping sensor. With 20 vehicles operating 16 hours/day, every point on the apron is observed dozens of times daily. Aggregating these observations detects changes that no single survey could capture.

3. **Bayesian consensus filters noise while preserving real changes**: By modeling per-vehicle detection reliability and requiring posterior probability >0.99 for safety-critical updates, the system avoids false map changes while quickly detecting real ones. Vehicle reputation scoring further filters systematic sensor failures.

4. **RTMap (ICCV 2025) enables real-time recursive map maintenance**: Centimeter-level accuracy, noise-aware probabilistic density inference, runs in real-time. Each vehicle pass refines the map — no separate "mapping mode" needed.

5. **AIRAC integration is non-negotiable for airside**: The 28-day aeronautical data cycle publishes taxiway changes, closures, and regulatory features. Fleet observations cannot override AIRAC for regulatory features (taxiway designations, holding positions, movement area boundaries). The dual-layer architecture (regulatory AIRAC + operational fleet) respects this hierarchy.

6. **Temporal decay models prevent silent map degradation**: Feature reliability decays exponentially based on feature type (permanent structures: 365-day half-life; equipment zones: 7-day half-life). Features below reliability threshold trigger re-observation requests, ensuring no feature silently becomes stale.

7. **Light-map architecture reduces maintenance cost by 90%**: A topology graph + safety zones + regulatory overlay (~720 KB) requires almost no maintenance. Online perception (MapTracker/StreamMapNet) fills in geometric detail. NMP fleet consensus builds geometric priors over time. Annual maintenance drops from $28-56K to $2-5K per airport.

8. **Semantic change detection outperforms raw point cloud differencing**: Comparing semantic features (markings, barriers, signs) instead of raw points dramatically reduces false positives from parked vehicles, weather effects, and lighting changes. Class-based filtering automatically ignores known dynamic objects.

9. **Spatial clustering (DBSCAN) aggregates multi-vehicle observations**: Different vehicles observe the same change from different angles and positions. DBSCAN clusters these observations spatially, confidence-weighted averaging gives precise change locations, and unique vehicle count provides independent confirmation.

10. **Airport changes follow predictable patterns**: Terminal construction (announced months ahead), seasonal changes (weather-linked), diurnal patterns (shift-based equipment staging). Time-conditioned map layers capture cyclic changes without treating them as permanent map modifications.

11. **Diff-based OTA map updates are tiny**: Fleet-detected updates are 1-10 KB per change. Even weekly NMP prior updates are 5-20 MB. Annual bandwidth for map maintenance is ~1.1 GB per vehicle — negligible compared to sensor data upload.

12. **Canary deployment catches bad map updates**: Push updates to 10% of fleet first, monitor localization quality for 2 hours. If position error exceeds 30cm mean or 1m max, automatic rollback. This catches surveying errors, data corruption, and misaligned AIRAC data before fleet-wide impact.

13. **Construction zone detection corroborates with NOTAMs**: Detected construction indicators (cones, barriers, fences) cross-referenced with active NOTAMs increases confidence and provides regulatory backing. Un-NOTAMed construction zones are flagged for both map update and airport safety reporting.

14. **Break-even at 2-3 airports**: Fleet-based maintenance ($55-75K one-time + $55-100K/year) becomes cheaper than manual quarterly re-survey ($28-56K/year × airports) once deployed at 2-3 airports. By 10 airports, savings exceed $200K/year.

15. **Hidden cost of stale maps is $5.6-16K/year per airport**: Includes expected cost of vehicle damage from entering construction zones, delays from wrong routes, aircraft proximity incidents, and regulatory findings. This hidden cost alone justifies fleet-based maintenance investment.

16. **Map-free is not viable for airside**: Safety zones, right-of-way rules, regulatory boundaries, and precise stand positioning cannot be derived from sensor perception alone. ISO 3691-4 requires documented operational area definition. Light-map is the minimum viable approach.

17. **NMP features naturally handle map maintenance**: Neural Map Prior features are continuous vectors that average across observations. Temporary objects average out; persistent changes persist. No explicit change detection algorithm needed — the representation handles it implicitly.

18. **Total implementation cost $45-70K over 28 weeks**: From change logging (Phase 0) through continuous fleet maintenance (Phase 3). Each phase delivers value independently — Phase 0 alone provides valuable data for understanding map decay patterns.

---

## 13. References

### Map Change Detection
- "Urban 3D Change Detection Using LiDAR Sensor for HD Map Maintenance and Smart Mobility." arXiv:2510.21112 (2025)
- "AI-Driven Change Detection in HD Maps for Autonomous Navigation Systems." ResearchGate (2025)
- "Real-Time HD Map Change Detection for Crowdsourcing Update Based on Mid-to-High-End Sensors." Sensors (2021)
- "High-Definition Map Change Regions Detection." Machines (2025)

### Neural Map Maintenance
- Du, Y., et al. (2025). "RTMap: Real-Time Recursive Mapping with Change Detection and Localization." ICCV
- Xiong, Y., et al. (2023). "Neural Map Prior for Autonomous Driving." CVPR — NMP
- Yang, X., et al. (2024). "PriorDrive: Unified Vector Prior Encoding for Autonomous Driving." — Stale map graceful degradation

### Online Mapping
- Chen, J., et al. (2024). "MapTracker: Tracking with Strided Memory Fusion Model for Consistent Vector HD Mapping." ECCV — +69% consistency
- Yuan, T., et al. (2024). "StreamMapNet: Streaming Mapping Network for Vectorized Online HD Map Construction." WACV
- Li, Y., et al. (2024). "LaneSegNet: Map Learning with Lane Segment Perception for Autonomous Driving." ICLR

### Map Standards and Industry
- "Maps for Autonomous Driving: Full-process Survey and Frontiers." arXiv:2509.12632 (2025)
- Nuro Engineering. "Exploring HD Mapping that Scales." Medium (2024)
- "A review of high-definition map creation methods for autonomous driving." Engineering Applications of AI (2023)

### Crowdsourced Mapping
- Mobileye. "Road Experience Management (REM)." — Fleet-crowdsourced HD maps from 8M+ vehicles
- Mapillary / Meta. "OpenStreetMap crowd-sourced mapping for autonomous driving."
- HERE. "HD Live Map." — Real-time map updates from fleet data

### Airport-Specific
- ICAO. "Annex 15 — Aeronautical Information Services." — AIRAC cycle definition
- EUROCAE ED-119C / RTCA DO-272D. "Interchange Standards for Terrain, Obstacle, and Aerodrome Mapping Data." — AMDB standard
- FAA. "Aeronautical Information Manual (AIM)." — NOTAM system
