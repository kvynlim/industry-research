# Semantic Mapping and Learned Map Priors for Airside Autonomous Vehicles

> Beyond geometric HD maps: semantic map construction that encodes traffic rules, topology, and behavioral priors directly into the map representation. Covers neural map priors (NMP), PriorDrive, topology reasoning (TopoMLP, T2SG), scene graph mapping, map uncertainty quantification, fleet-based incremental map updates, and how these techniques transform multi-airport deployment for airside operations.

**Key Takeaway**: Traditional HD maps store geometry (lane boundaries, centerlines) but not semantics (right-of-way rules, typical traffic patterns, risk zones). Semantic maps with learned priors close this gap. Neural Map Prior (NMP) improves online mapping by +5.4 mAP using fleet-aggregated prior features, with the largest gains in adverse conditions — exactly the airport deployment scenario (night, rain, construction changes). For multi-airport deployment, PriorDrive's ability to bootstrap from stale/incomplete prior maps (including AMDB data) and iteratively refine through fleet operations could reduce per-airport mapping cost by an additional 30-40% beyond the AMDB bootstrap approach.

---

## Table of Contents

1. [Why Semantic Maps for Airside](#1-why-semantic-maps-for-airside)
2. [Map Representation Hierarchy](#2-map-representation-hierarchy)
3. [Neural Map Prior (NMP)](#3-neural-map-prior-nmp)
4. [PriorDrive: Unified Vector Prior Encoding](#4-priordrive-unified-vector-prior-encoding)
5. [Topology Reasoning](#5-topology-reasoning)
6. [Scene Graph Mapping](#6-scene-graph-mapping)
7. [Map Uncertainty Quantification](#7-map-uncertainty-quantification)
8. [Fleet-Based Incremental Map Updates](#8-fleet-based-incremental-map-updates)
9. [Semantic Map Layers for Airside](#9-semantic-map-layers-for-airside)
10. [Integration with Existing Stack](#10-integration-with-existing-stack)
11. [Multi-Airport Map Sharing Strategy](#11-multi-airport-map-sharing-strategy)
12. [Practical Implementation](#12-practical-implementation)

---

## 1. Why Semantic Maps for Airside

### 1.1 The Limits of Geometric Maps

Current HD maps for autonomous driving store:
- Lane/road boundaries (polylines)
- Centerlines and reference paths
- Traffic sign positions
- Intersection geometry

For airside operations, the current three-layer map architecture (`hd-map-standards-airside.md`) provides:
- **AMDB base** (28-day AIRAC cycle): Taxiway/apron geometry
- **HD survey overlay** (monthly): Service road centerlines, stand positions
- **Live perception** (real-time): Dynamic objects

**What's missing**: The map stores *where things are* but not *what they mean* or *how they behave*.

### 1.2 Semantic Information Needed for Airside

| Semantic Layer | Example | Why It Matters |
|---------------|---------|----------------|
| **Right-of-way rules** | "Aircraft always have priority at this crossing" | Planner needs rule-aware behavior |
| **Typical traffic patterns** | "Baggage trains usually travel east on Road A at 14:00-16:00" | Predictive planning, risk assessment |
| **Risk zones** | "Jet blast hazard when engines running at Stand B12" | Dynamic safety margin adjustment |
| **Surface semantics** | "Painted area = reduced traction when wet" | Speed adaptation |
| **Visibility constraints** | "Blind corner at Pier C junction" | Conservative approach speed |
| **Temporal patterns** | "Stand A14 turnaround peaks at 0800-0900" | Mission scheduling optimization |
| **Connectivity/topology** | "Road A connects to Road B via Junction 3, one-way" | Route planning, alternative routes |
| **Behavioral expectations** | "GSE often reverse without warning at cargo apron" | Defensive driving policy |

### 1.3 Semantic Maps in the AV Literature

The autonomous driving field has moved from pure geometry to learned semantic representations:

```
2020: HDMapNet — Semantic map segmentation from camera
2021: VectorMapNet — Vectorized map element detection
2022: MapTR — End-to-end vectorized map construction
2023: Neural Map Prior — Fleet-learned prior features
2023: MapTracker — Tracking-based temporal consistency
2024: StreamMapNet — Streaming online construction
2024: PriorDrive — Unified vector prior encoding
2025: T2SG — Traffic topology scene graph (CVPR 2025)
2025: LGmap — Local-to-global long-range construction
```

The trend: maps are becoming **learned representations** rather than hand-crafted databases.

---

## 2. Map Representation Hierarchy

### 2.1 Four Levels of Map Representation

```
Level 4: Behavioral Map  ← Traffic patterns, risk zones, temporal models
Level 3: Semantic Map     ← Right-of-way, rules, surface types, topological connectivity
Level 2: Geometric Map    ← Precise boundaries, centerlines, 3D structure
Level 1: Metric Map       ← Point cloud, occupancy grid (raw sensor)
```

### 2.2 Representation Formats

| Level | Format | Resolution | Update Frequency | Storage |
|-------|--------|-----------|-----------------|---------|
| **L1: Metric** | Point cloud map, voxel grid | 0.05-0.5m | Per mission (SLAM) | 1-10 GB/airport |
| **L2: Geometric** | Lanelet2, OpenDRIVE, AMXM | 0.1-0.5m | Monthly (survey) | 10-100 MB/airport |
| **L3: Semantic** | Scene graph, annotated Lanelet2 | Per-element | Quarterly (manual + fleet) | 1-10 MB/airport |
| **L4: Behavioral** | Neural embeddings, flow statistics | Per-cell/element | Weekly (fleet data) | 50-500 MB/airport |

### 2.3 Encoding Scheme

```python
@dataclass
class SemanticMapElement:
    """Base class for semantic map elements."""
    id: str
    geometry: Any  # Polyline, polygon, or point
    semantic_class: str  # "service_road", "stand", "taxiway_crossing", etc.
    
    # Level 2: Geometric properties
    width_m: float = 0.0
    elevation_m: float = 0.0
    surface_type: str = "concrete"
    
    # Level 3: Semantic properties
    right_of_way: str = "yield_all"  # "priority", "yield_all", "yield_aircraft"
    speed_limit_kmh: float = 15.0
    direction: str = "bidirectional"  # "one_way_forward", "one_way_reverse", "bidirectional"
    connected_to: List[str] = field(default_factory=list)  # Topology
    rules: List[str] = field(default_factory=list)  # "no_stopping", "horn_required"
    visibility: str = "good"  # "good", "restricted", "blind_corner"
    
    # Level 4: Behavioral properties
    traffic_flow: Optional[np.ndarray] = None  # Hourly traffic counts [24]
    risk_score: float = 0.0  # 0-1, aggregated from incident history
    typical_speed_kmh: float = 0.0  # Observed average
    last_observed: Optional[datetime] = None
    confidence: float = 1.0  # Map element confidence


@dataclass
class AirsideSemanticMap:
    """Complete semantic map for an airport."""
    airport_icao: str
    version: str
    elements: Dict[str, SemanticMapElement]
    topology: nx.DiGraph  # Directed graph of connections
    
    # Spatial index for fast queries
    _rtree: rtree.Index = None
    
    def query_at_position(self, lat, lon, radius_m=50):
        """Get all map elements within radius of position."""
        nearby_ids = self._rtree.intersection(
            (lon - radius_m/111000, lat - radius_m/111000,
             lon + radius_m/111000, lat + radius_m/111000)
        )
        return [self.elements[eid] for eid in nearby_ids]
    
    def get_right_of_way(self, ego_element_id, other_element_id):
        """Determine who has right-of-way at intersection."""
        ego = self.elements[ego_element_id]
        other = self.elements[other_element_id]
        
        # Aircraft always have priority
        if other.semantic_class == "taxiway":
            return "yield"
        
        # Emergency vehicles always have priority
        # (checked via perception, not map)
        
        # Check intersection rules
        intersection = self.topology.get_edge_data(ego_element_id, other_element_id)
        if intersection:
            return intersection.get("right_of_way", "yield_all")
        
        return "yield_all"  # Conservative default
    
    def get_risk_at_position(self, lat, lon):
        """Get aggregated risk score at position."""
        elements = self.query_at_position(lat, lon, radius_m=10)
        if not elements:
            return 0.5  # Unknown area = moderate risk
        return max(e.risk_score for e in elements)
    
    def get_topology_route(self, start_element_id, end_element_id):
        """Find route through topological graph."""
        try:
            path = nx.shortest_path(
                self.topology, start_element_id, end_element_id,
                weight="cost"
            )
            return path
        except nx.NetworkXNoPath:
            return None
```

---

## 3. Neural Map Prior (NMP)

### 3.1 Overview

Neural Map Prior (CVPR 2023, Tsinghua MARS Lab) creates a global neural map representation that is incrementally updated from fleet observations.

**Key Insight**: Instead of storing a static geometric map, NMP stores a learned feature map that captures both geometry and appearance. When a vehicle revisits an area, the stored features provide a prior that dramatically improves online map prediction — especially in adverse conditions.

### 3.2 Architecture

```
Fleet Vehicle N traverses area → generates BEV features
                                         ↓
                              Cross-attention with stored prior
                                         ↓
                              Fused BEV features (current + prior)
                                         ↓
                              Online map prediction (improved)
                                         ↓
                              Update global prior with new observation
```

### 3.3 Performance Gains

| Base Method | Without NMP | With NMP | Improvement |
|-------------|-----------|---------|-------------|
| HDMapNet | 27.1 mIoU | 31.4 mIoU | +4.3 |
| LSS | 25.2 mIoU | 30.2 mIoU | +5.0 |
| BEVFormer | 40.8 mIoU | 46.2 mIoU | +5.4 |
| VectorMapNet | 24.3 mAP | 28.2 mAP | +3.9 |

**Key finding**: Largest improvements at night (+8.2 mIoU) and in rain (+6.7 mIoU) — conditions where current observation quality is poor and prior information is most valuable.

### 3.4 NMP for Airside Operations

```python
class AirsideNeuralMapPrior:
    """Neural Map Prior adapted for airport airside mapping.
    
    Key adaptations from road driving:
    1. Map elements are airport-specific (stands, service roads, not lanes)
    2. Prior includes semantic information (right-of-way, risk zones)
    3. Update frequency is higher (many traversals per day vs road)
    4. Multi-vehicle fleet provides rapid prior convergence
    """
    
    def __init__(self, feature_dim=256, grid_resolution=0.5):
        self.feature_dim = feature_dim
        self.resolution = grid_resolution
        
        # Global feature grid covering airport
        # For a 2km x 2km airport: 4000 x 4000 cells at 0.5m
        self.global_prior = None  # Initialized from first traversal
        
        # Cross-attention module for fusing current + prior
        self.cross_attention = CrossAttention(
            query_dim=feature_dim,
            key_dim=feature_dim,
            value_dim=feature_dim,
            num_heads=8,
        )
        
        # Feature fusion (learned weighting of current vs prior)
        self.fusion = nn.Sequential(
            nn.Linear(feature_dim * 2, feature_dim),
            nn.ReLU(),
            nn.Linear(feature_dim, feature_dim),
        )
    
    def predict_with_prior(self, current_bev_features, ego_pose):
        """Enhance current BEV prediction using stored prior.
        
        Args:
            current_bev_features: BEV features from current sensors [B, C, H, W]
            ego_pose: Vehicle position in global frame (for prior lookup)
            
        Returns:
            Enhanced BEV features incorporating prior knowledge
        """
        # Extract relevant prior features for current field of view
        prior_features = self._extract_local_prior(ego_pose)
        
        if prior_features is None:
            # First visit — no prior available
            return current_bev_features
        
        # Cross-attention: current attends to prior
        enhanced = self.cross_attention(
            query=current_bev_features,
            key=prior_features,
            value=prior_features,
        )
        
        # Learned fusion
        fused = self.fusion(
            torch.cat([current_bev_features, enhanced], dim=-1)
        )
        
        return fused
    
    def update_prior(self, bev_features, ego_pose, confidence):
        """Update global prior with new observation.
        
        Uses exponential moving average weighted by observation confidence.
        Higher confidence in good conditions (day, clear weather).
        """
        local_coords = self._global_to_local(ego_pose)
        
        if self.global_prior is None:
            self.global_prior = self._initialize_grid(bev_features, ego_pose)
        
        # EMA update: prior = (1-α) * prior + α * current
        alpha = 0.1 * confidence  # Slower update for uncertain observations
        
        self._update_cells(local_coords, bev_features, alpha)
    
    def _extract_local_prior(self, ego_pose):
        """Extract prior features for vehicle's current field of view."""
        if self.global_prior is None:
            return None
        
        # Get grid cells visible from current position
        x, y = self._global_to_grid(ego_pose)
        fov_radius = int(100.0 / self.resolution)  # 100m FOV
        
        # Extract local patch from global grid
        x_start = max(0, x - fov_radius)
        x_end = min(self.global_prior.shape[0], x + fov_radius)
        y_start = max(0, y - fov_radius)
        y_end = min(self.global_prior.shape[1], y + fov_radius)
        
        local = self.global_prior[x_start:x_end, y_start:y_end]
        
        return local


class NMPMapBuilder:
    """Build semantic map using Neural Map Prior from fleet data.
    
    Process:
    1. Vehicles traverse airport routes during normal operations
    2. Each traversal generates BEV features + online map predictions
    3. NMP accumulates features into global prior
    4. After N traversals, extract high-confidence semantic map
    """
    
    def __init__(self, nmp, extraction_threshold=0.8):
        self.nmp = nmp
        self.threshold = extraction_threshold
        self.traversal_count = {}  # Per-cell count
    
    def process_mission(self, mission_data):
        """Process one vehicle mission to update map prior."""
        for frame in mission_data.frames:
            # Get BEV features from perception
            bev_features = self.perception.extract_bev(frame.sensor_data)
            
            # Predict with prior
            enhanced = self.nmp.predict_with_prior(bev_features, frame.ego_pose)
            
            # Update prior
            confidence = self._estimate_confidence(frame)
            self.nmp.update_prior(enhanced, frame.ego_pose, confidence)
            
            # Track coverage
            cell = self._pose_to_cell(frame.ego_pose)
            self.traversal_count[cell] = self.traversal_count.get(cell, 0) + 1
    
    def extract_semantic_map(self):
        """Extract high-confidence semantic map from accumulated prior."""
        map_elements = []
        
        for cell, count in self.traversal_count.items():
            if count >= 5:  # Minimum 5 traversals for reliability
                features = self.nmp.global_prior[cell]
                
                # Decode features into semantic labels
                decoded = self.decoder(features)
                
                if decoded.confidence >= self.threshold:
                    element = SemanticMapElement(
                        id=f"cell_{cell[0]}_{cell[1]}",
                        geometry=self._cell_to_polygon(cell),
                        semantic_class=decoded.class_name,
                        surface_type=decoded.surface,
                        confidence=decoded.confidence,
                    )
                    map_elements.append(element)
        
        return map_elements
    
    def _estimate_confidence(self, frame):
        """Estimate observation confidence based on conditions."""
        confidence = 1.0
        
        if frame.weather == "rain":
            confidence *= 0.7
        elif frame.weather == "fog":
            confidence *= 0.5
        
        if frame.lighting == "night":
            confidence *= 0.8
        
        if frame.gnss_quality < 3:  # RTK float or worse
            confidence *= 0.6
        
        return confidence
```

### 3.5 NMP Convergence Analysis for Airside

| Metric | After 1 Day | After 1 Week | After 1 Month |
|--------|-------------|-------------|---------------|
| Area coverage (10-vehicle fleet) | 60-70% | 95%+ | 99%+ |
| Prior quality (mAP improvement) | +2-3 | +4-5 | +5-6 |
| Night performance improvement | +3-4 | +6-8 | +8-10 |
| Per-cell average traversals | 3-5 | 15-25 | 60-100 |
| Semantic label accuracy | 75% | 88% | 93% |

**Airport advantage**: Airport routes are repetitive — vehicles traverse the same paths hundreds of times per week. This means NMP converges much faster than in road driving.

---

## 4. PriorDrive: Unified Vector Prior Encoding

### 4.1 Overview

PriorDrive (2024) integrates diverse prior map sources — OpenStreetMap (SD maps), outdated HD maps, and fleet-constructed maps — into online mapping frameworks through a unified encoding.

### 4.2 Why PriorDrive Matters for Airside

| Prior Source | Airside Equivalent | Quality | Availability |
|-------------|-------------------|---------|--------------|
| OpenStreetMap | AMDB/AMXM | ±0.5m geometry | Free (FAA, EUROCONTROL) |
| Outdated HD map | Previous survey | ±0.1m but stale | From past deployments |
| Fleet-constructed | SLAM + NMP accumulated | ±0.2m, recent | From fleet operations |
| Satellite imagery | Google Earth / Maxar | ±1-2m | Commercial |

### 4.3 PriorDrive Architecture for Airside

```python
class AirsidePriorDrive:
    """PriorDrive adapted for airside map construction.
    
    Integrates multiple prior sources to enhance online mapping:
    1. AMDB base geometry (always available)
    2. Previous HD survey (if exists, may be stale)
    3. Fleet SLAM maps (accumulated from operations)
    4. NMP features (learned prior from fleet traversals)
    """
    
    def __init__(self, prior_encoder, online_mapper):
        self.prior_encoder = prior_encoder  # Unified vector encoding
        self.online_mapper = online_mapper  # MapTR / StreamMapNet
    
    def map_with_priors(self, sensor_data, ego_pose, available_priors):
        """Online mapping enhanced by available priors.
        
        Key insight from PriorDrive: even stale/inaccurate priors help,
        because the model learns to weight prior vs. observation adaptively.
        """
        # Encode each prior source into unified vector representation
        prior_features = []
        
        if "amdb" in available_priors:
            amdb_vectors = self.prior_encoder.encode_amdb(
                available_priors["amdb"], ego_pose
            )
            prior_features.append(("amdb", amdb_vectors, 0.5))  # lower weight
        
        if "hd_survey" in available_priors:
            survey_age_days = (datetime.now() - available_priors["hd_survey"].date).days
            weight = max(0.3, 1.0 - survey_age_days / 365)  # Decay over year
            survey_vectors = self.prior_encoder.encode_hd_map(
                available_priors["hd_survey"], ego_pose
            )
            prior_features.append(("hd_survey", survey_vectors, weight))
        
        if "fleet_slam" in available_priors:
            slam_vectors = self.prior_encoder.encode_slam(
                available_priors["fleet_slam"], ego_pose
            )
            prior_features.append(("fleet_slam", slam_vectors, 0.8))
        
        if "nmp" in available_priors:
            nmp_features = available_priors["nmp"].extract_local(ego_pose)
            prior_features.append(("nmp", nmp_features, 0.9))
        
        # Unified prior fusion (learned attention over all sources)
        fused_prior = self.prior_encoder.fuse(prior_features)
        
        # Online mapping with prior guidance
        map_prediction = self.online_mapper(
            sensor_data, ego_pose, prior=fused_prior
        )
        
        return map_prediction
    
    def iterative_refinement(self, map_prediction, ego_pose):
        """PriorDrive's key insight: use previous prediction as next prior.
        
        Each traversal's prediction becomes a prior for the next traversal,
        creating an iterative refinement loop that converges to ground truth.
        """
        # Store prediction as new prior for this area
        self.prior_store.update(
            ego_pose, map_prediction, 
            source="online_prediction",
            timestamp=datetime.now()
        )
```

### 4.4 Impact on Multi-Airport Deployment Cost

| Approach | Per-Airport Map Cost | Quality | Time |
|----------|---------------------|---------|------|
| Full HD survey (no priors) | $50-100K | ±0.05m | 4-8 weeks |
| AMDB bootstrap + survey | $15-40K | ±0.1m | 2-4 weeks |
| **AMDB + PriorDrive (fleet)** | **$5-15K** | **±0.15m** | **2-3 weeks** |
| AMDB + PriorDrive + NMP | $3-10K | ±0.1m (converges) | 1-2 weeks + fleet time |

PriorDrive reduces mapping cost by an additional 30-40% over AMDB bootstrap alone by:
1. Leveraging stale prior maps where available (no penalty for inaccuracy)
2. Iteratively refining through fleet operations (no dedicated survey needed)
3. Transferring learned prior encoding across airports (shared model)

---

## 5. Topology Reasoning

### 5.1 Why Topology Matters for Airside

Topology captures how map elements connect — crucial for route planning, alternative routing, and understanding traffic flow.

**Road driving**: Lanes connect at intersections with known rules (traffic lights, signs).

**Airside**: Service roads connect through unmarked junctions with convention-based rules. Topology is poorly documented; most airports have no formal service road network graph.

### 5.2 Topology Reasoning Methods

| Method | Approach | Performance | Year |
|--------|----------|-------------|------|
| **TopoNet** (CVPR 2023) | Graph-based topology reasoning for lane graphs | 28.5 OLS | 2023 |
| **TopoMLP** (NeurIPS 2023) | MLP-based lane-lane topology prediction | 41.2 OLS | 2023 |
| **TopoLogic** (2024) | Interpretable pipeline using geometric logic | 44.1 OLS | 2024 |
| **LaneSegNet** (CVPR 2024) | First end-to-end lane segment network | 44.7 OLS | 2024 |
| **T2SG** (CVPR 2025) | Traffic Topology Scene Graph | 47.2 OLS | 2025 |

### 5.3 T2SG: Traffic Topology Scene Graph

T2SG (CVPR 2025) infers topological relationships among lane objects using traffic scene graphs, guided by road signals associated with the lanes.

**Adaptation for airside**:

```python
class AirsideTopologyGraph:
    """Scene graph representing airside map topology.
    
    Nodes: service road segments, stand areas, junctions, taxiway crossings
    Edges: connectivity with semantic attributes (direction, priority, constraints)
    """
    
    NODE_TYPES = [
        "service_road",      # Regular service road segment
        "stand_approach",    # Approach path to aircraft stand
        "stand_area",        # Aircraft stand parking area
        "junction",          # Intersection of service roads
        "taxiway_crossing",  # Crossing point over taxiway
        "depot",             # Vehicle depot/charging area
        "loading_area",      # Baggage/cargo loading position
    ]
    
    EDGE_TYPES = [
        "connects_to",       # Basic connectivity
        "yields_to",         # Must yield at this connection
        "restricted_when",   # Conditional restriction (e.g., aircraft present)
        "one_way",           # Directed connection
        "emergency_only",    # Only for emergency routing
    ]
    
    def __init__(self):
        self.graph = nx.DiGraph()
    
    def add_connection(self, from_node, to_node, edge_type, properties=None):
        """Add topological connection with semantic attributes."""
        self.graph.add_edge(
            from_node, to_node,
            edge_type=edge_type,
            properties=properties or {},
        )
    
    def build_from_observations(self, fleet_trajectories):
        """Build topology graph from observed fleet movements.
        
        Key insight: fleet trajectories implicitly encode topology.
        If vehicles frequently travel from A to B, there must be 
        a traversable connection.
        """
        transition_counts = defaultdict(int)
        
        for trajectory in fleet_trajectories:
            segments = self._trajectory_to_segments(trajectory)
            for i in range(len(segments) - 1):
                transition_counts[(segments[i], segments[i+1])] += 1
        
        # High-frequency transitions → confirmed connections
        for (from_seg, to_seg), count in transition_counts.items():
            if count >= 5:  # Minimum 5 observations
                self.add_connection(
                    from_seg, to_seg, "connects_to",
                    properties={
                        "observation_count": count,
                        "typical_speed_kmh": self._avg_speed(from_seg, to_seg),
                        "direction": self._infer_direction(from_seg, to_seg, count),
                    }
                )
    
    def infer_right_of_way(self):
        """Infer right-of-way rules from topology and observations.
        
        Rules (from airport SOPs):
        1. Aircraft > all ground vehicles
        2. Emergency vehicles > all others
        3. Loaded vehicles > empty vehicles (by convention)
        4. Vehicles on main service roads > joining vehicles
        """
        for node in self.graph.nodes():
            if self.graph.nodes[node].get("type") == "taxiway_crossing":
                # Always yield at taxiway crossings
                for edge in self.graph.edges(node):
                    self.graph.edges[edge]["yields_to"] = "aircraft"
            
            elif self.graph.nodes[node].get("type") == "junction":
                # Main road has priority (higher traffic count)
                incoming = list(self.graph.predecessors(node))
                if len(incoming) > 1:
                    traffic_counts = {
                        pred: self.graph.edges[(pred, node)].get(
                            "properties", {}
                        ).get("observation_count", 0)
                        for pred in incoming
                    }
                    main_road = max(traffic_counts, key=traffic_counts.get)
                    for pred in incoming:
                        if pred != main_road:
                            self.graph.edges[(pred, node)]["yields_to"] = main_road
    
    def find_alternative_routes(self, start, end, blocked_edges):
        """Find alternative route when primary path is blocked.
        
        Critical for airside: pushbacks, NOTAMs, and construction
        frequently block routes. Need rapid re-routing.
        """
        # Remove blocked edges temporarily
        temp_graph = self.graph.copy()
        for edge in blocked_edges:
            if temp_graph.has_edge(*edge):
                temp_graph.remove_edge(*edge)
        
        try:
            alternative = nx.shortest_path(temp_graph, start, end, weight="cost")
            return alternative
        except nx.NetworkXNoPath:
            return None  # No alternative — must wait
```

### 5.4 Topology Discovery from Fleet Data

```python
class TopologyDiscovery:
    """Discover airport service road topology from fleet GPS traces.
    
    Method:
    1. Cluster GPS trajectories into road segments
    2. Find transition points (junctions)
    3. Build connectivity graph
    4. Validate against AMDB geometry
    """
    
    def discover(self, gps_traces, amdb_roads):
        """Main discovery pipeline."""
        # Step 1: Cluster trajectories into road segments
        segments = self._cluster_trajectories(gps_traces)
        
        # Step 2: Find junctions (where clusters meet)
        junctions = self._find_junctions(segments)
        
        # Step 3: Build graph
        topology = AirsideTopologyGraph()
        for seg in segments:
            topology.graph.add_node(seg.id, type=seg.type, geometry=seg.centerline)
        
        for junction in junctions:
            topology.graph.add_node(junction.id, type="junction", 
                                   position=junction.position)
            for seg in junction.connected_segments:
                topology.add_connection(seg, junction.id, "connects_to")
                topology.add_connection(junction.id, seg, "connects_to")
        
        # Step 4: Validate against AMDB
        topology = self._validate_against_amdb(topology, amdb_roads)
        
        # Step 5: Infer rules
        topology.infer_right_of_way()
        
        return topology
    
    def _cluster_trajectories(self, traces):
        """Cluster GPS points into road segments using DBSCAN."""
        all_points = np.concatenate([t.points for t in traces])
        
        # DBSCAN clustering of trajectory points
        clustering = DBSCAN(eps=2.0, min_samples=10).fit(all_points[:, :2])
        
        segments = []
        for label in set(clustering.labels_):
            if label == -1:
                continue
            cluster_points = all_points[clustering.labels_ == label]
            centerline = self._fit_centerline(cluster_points)
            segments.append(RoadSegment(
                id=f"seg_{label}",
                centerline=centerline,
                width=self._estimate_width(cluster_points),
                type="service_road",
            ))
        
        return segments
```

---

## 6. Scene Graph Mapping

### 6.1 What is a Map Scene Graph

A scene graph represents the map as nodes (objects/areas) with typed edges (spatial/functional relationships):

```
                    Airport Apron
                    /          \
              Stand_B14     Service_Road_A
              /    |   \          |
         Aircraft  Belt_Loader  Junction_3
             |         |            |
        Jet_Blast   Personnel   Speed_Zone_10kmh
```

### 6.2 Airside Map Scene Graph Schema

```python
class AirsideSceneGraph:
    """Scene graph representation of airport airside environment."""
    
    NODE_SCHEMA = {
        "stand": {
            "properties": ["number", "aircraft_code", "pier", "status"],
            "status_values": ["vacant", "occupied", "pushback", "maintenance"],
        },
        "service_road": {
            "properties": ["name", "width_m", "surface", "direction", "speed_limit"],
        },
        "junction": {
            "properties": ["type", "visibility", "priority_rules"],
        },
        "hazard_zone": {
            "properties": ["hazard_type", "radius_m", "active", "trigger"],
            "hazard_types": ["jet_blast", "fuel_spill", "construction", "ils_critical"],
        },
        "equipment_area": {
            "properties": ["type", "capacity", "occupancy"],
            "types": ["gse_parking", "charging_station", "fuel_farm", "cargo_area"],
        },
    }
    
    EDGE_SCHEMA = {
        "connects_to": {"source": "any", "target": "any"},
        "adjacent_to": {"source": "stand", "target": "stand"},
        "has_hazard": {"source": "stand", "target": "hazard_zone"},
        "served_by": {"source": "stand", "target": "service_road"},
        "restricted_by": {"source": "service_road", "target": "hazard_zone"},
        "monitored_by": {"source": "any", "target": "sensor"},
    }
    
    def __init__(self):
        self.graph = nx.DiGraph()
    
    def add_dynamic_state(self, stand_id, state):
        """Update dynamic state (e.g., aircraft arrived at stand).
        
        This triggers cascading updates:
        - Stand B14 → occupied → jet_blast_zone activated
        - Adjacent stands B13, B15 → clearance restricted
        - Service roads near B14 → speed reduced
        """
        self.graph.nodes[stand_id]["status"] = state
        
        if state == "occupied":
            # Activate associated hazard zones
            for _, hazard_id, data in self.graph.edges(stand_id, data=True):
                if data["edge_type"] == "has_hazard":
                    self.graph.nodes[hazard_id]["active"] = True
        
        elif state == "pushback":
            # Restrict adjacent service roads
            for _, road_id, data in self.graph.edges(stand_id, data=True):
                if data["edge_type"] == "served_by":
                    self.graph.nodes[road_id]["speed_limit"] = 5  # Reduce to 5 km/h
    
    def query_constraints(self, ego_position):
        """Get all active constraints affecting ego position."""
        constraints = []
        nearby = self._get_nearby_nodes(ego_position, radius_m=100)
        
        for node_id in nearby:
            node = self.graph.nodes[node_id]
            
            if node.get("type") == "hazard_zone" and node.get("active"):
                constraints.append({
                    "type": "hazard",
                    "hazard": node["hazard_type"],
                    "radius_m": node["radius_m"],
                    "action": "avoid" if node["hazard_type"] == "jet_blast" else "caution",
                })
            
            if node.get("type") == "service_road" and "speed_limit" in node:
                constraints.append({
                    "type": "speed_limit",
                    "limit_kmh": node["speed_limit"],
                    "road": node_id,
                })
        
        return constraints
```

---

## 7. Map Uncertainty Quantification

### 7.1 Why Map Uncertainty Matters

Maps are never perfect. For safety-critical airside operations, the planner must know *how much to trust the map*:

| Uncertainty Source | Impact | Magnitude |
|-------------------|--------|-----------|
| Survey age | Geometry may have changed (construction) | 0-5m (stale map) |
| AMDB accuracy | Base geometry uncertainty | ±0.5m |
| SLAM drift | Accumulated positioning error | 0.1-0.5m |
| NMP confidence | Learned features may not match current reality | Variable |
| Semantic label | Inferred rules may be wrong | 5-15% error rate |
| Dynamic changes | Temporary closures, equipment moves | Unbounded |

### 7.2 Uncertainty Representation

```python
class UncertainMapElement(SemanticMapElement):
    """Map element with explicit uncertainty quantification."""
    
    # Geometric uncertainty
    position_uncertainty_m: float = 0.0  # 1-sigma position error
    shape_uncertainty_m: float = 0.0     # Boundary position error
    
    # Semantic uncertainty
    class_confidence: float = 1.0        # P(correct semantic class)
    rule_confidence: float = 1.0         # P(correct right-of-way rule)
    
    # Temporal uncertainty
    last_validated: Optional[datetime] = None
    staleness_score: float = 0.0         # 0 = just validated, 1 = very stale
    
    # Source tracking
    sources: List[str] = field(default_factory=list)  # ["amdb", "slam", "nmp"]
    observation_count: int = 0
    
    def get_safety_margin(self):
        """Compute additional safety margin based on uncertainty.
        
        Planner should add this to nominal clearance distances.
        """
        geometric_margin = self.position_uncertainty_m * 2  # 2-sigma
        staleness_margin = self.staleness_score * 0.5  # Up to 0.5m extra
        
        return geometric_margin + staleness_margin
    
    def get_trust_level(self):
        """Overall trust level for planning decisions."""
        if self.observation_count < 3:
            return "LOW"  # Insufficient observations
        if self.staleness_score > 0.7:
            return "LOW"  # Very stale
        if self.class_confidence < 0.8:
            return "MEDIUM"  # Uncertain classification
        if self.position_uncertainty_m > 0.5:
            return "MEDIUM"  # Uncertain position
        return "HIGH"


class MapUncertaintyTracker:
    """Track and propagate map uncertainty over time."""
    
    def __init__(self, staleness_halflife_days=30):
        self.halflife = staleness_halflife_days
    
    def update_staleness(self, element):
        """Update staleness score based on time since last validation."""
        if element.last_validated is None:
            element.staleness_score = 1.0
            return
        
        days_since = (datetime.now() - element.last_validated).days
        element.staleness_score = 1.0 - math.exp(
            -0.693 * days_since / self.halflife
        )
    
    def validate_with_observation(self, element, observation):
        """Validate map element against current sensor observation.
        
        If observation matches map → increase confidence, reset staleness
        If observation conflicts → flag for review, increase uncertainty
        """
        agreement = self._compute_agreement(element, observation)
        
        if agreement > 0.8:
            # Observation confirms map
            element.last_validated = datetime.now()
            element.staleness_score = 0.0
            element.observation_count += 1
            element.position_uncertainty_m *= 0.95  # Slightly improve
        elif agreement < 0.3:
            # Observation conflicts with map
            element.class_confidence *= 0.8  # Reduce confidence
            self._flag_for_review(element, observation)
    
    def propagate_uncertainty(self, semantic_map):
        """Propagate uncertainty from sources to dependent elements.
        
        E.g., if a junction's position is uncertain, all connected
        road segments inherit additional uncertainty.
        """
        for node_id in semantic_map.topology.nodes():
            element = semantic_map.elements.get(node_id)
            if element is None:
                continue
            
            # Propagate to connected elements
            for neighbor_id in semantic_map.topology.neighbors(node_id):
                neighbor = semantic_map.elements.get(neighbor_id)
                if neighbor:
                    # Connection uncertainty ≥ max(source, target) uncertainty
                    edge_uncertainty = max(
                        element.position_uncertainty_m,
                        neighbor.position_uncertainty_m
                    )
                    semantic_map.topology.edges[
                        (node_id, neighbor_id)
                    ]["uncertainty_m"] = edge_uncertainty
```

### 7.3 Conformal Prediction for Map Uncertainty

Recent work (CVPR 2025) applies conformal prediction to provide distribution-free uncertainty guarantees:

```python
class ConformalMapPredictor:
    """Conformal prediction for calibrated map uncertainty.
    
    Guarantees: P(true element ∈ prediction set) ≥ 1 - α
    No distributional assumptions required.
    """
    
    def __init__(self, alpha=0.05):
        self.alpha = alpha  # Target miscoverage rate
        self.calibration_scores = []
    
    def calibrate(self, calibration_data):
        """Calibrate on held-out data.
        
        Compute nonconformity scores on labeled calibration set.
        """
        for sample in calibration_data:
            prediction = self.model.predict(sample.input)
            true_label = sample.label
            
            score = self._nonconformity_score(prediction, true_label)
            self.calibration_scores.append(score)
        
        # Compute threshold for desired coverage
        n = len(self.calibration_scores)
        k = int(np.ceil((n + 1) * (1 - self.alpha)))
        sorted_scores = sorted(self.calibration_scores)
        self.threshold = sorted_scores[min(k, n) - 1]
    
    def predict_with_guarantee(self, sensor_data):
        """Predict map elements with coverage guarantee.
        
        Returns prediction set: all classes with score ≤ threshold
        are included. Guaranteed ≥ (1-α) coverage.
        """
        predictions = self.model.predict_all_classes(sensor_data)
        
        # Include all classes with conformity score ≤ threshold
        prediction_set = []
        for cls, score in predictions:
            if score <= self.threshold:
                prediction_set.append(cls)
        
        return prediction_set  # Guaranteed to contain true class w.h.p.
```

---

## 8. Fleet-Based Incremental Map Updates

### 8.1 Crowdsourced Map Maintenance

```python
class FleetMapUpdater:
    """Incremental map updates from fleet observations.
    
    Architecture:
    Vehicle → Local map observations → Edge aggregation → Cloud merge → Updated map
    
    Key design decisions:
    1. Vehicles upload compressed observations, not raw data
    2. Multiple observations required before map change
    3. Safety-critical changes require human review
    4. Benign changes (traffic patterns) auto-update
    """
    
    CHANGE_CATEGORIES = {
        "geometry_change": {
            "examples": ["new barrier", "moved equipment", "construction"],
            "auto_update": False,  # Requires human review
            "min_observations": 3,
            "review_timeout_hours": 24,
        },
        "semantic_change": {
            "examples": ["new speed zone", "direction change", "new marking"],
            "auto_update": False,
            "min_observations": 5,
            "review_timeout_hours": 48,
        },
        "traffic_pattern_change": {
            "examples": ["new peak hour", "changed flow direction"],
            "auto_update": True,  # Statistical update
            "min_observations": 20,
            "review_timeout_hours": None,
        },
        "condition_change": {
            "examples": ["surface degradation", "lighting change"],
            "auto_update": True,
            "min_observations": 10,
            "review_timeout_hours": None,
        },
    }
    
    def __init__(self, current_map, change_detector):
        self.map = current_map
        self.detector = change_detector
        self.pending_changes = defaultdict(list)
    
    def process_observation(self, vehicle_id, observation):
        """Process a single vehicle observation for map changes."""
        # Detect differences between observation and current map
        changes = self.detector.detect(observation, self.map)
        
        for change in changes:
            category = self._categorize(change)
            key = (change.element_id, change.change_type)
            
            self.pending_changes[key].append({
                "vehicle_id": vehicle_id,
                "timestamp": datetime.now(),
                "observation": change,
                "category": category,
            })
            
            # Check if enough observations to act
            config = self.CHANGE_CATEGORIES[category]
            observations = self.pending_changes[key]
            
            if len(observations) >= config["min_observations"]:
                if config["auto_update"]:
                    self._apply_change(key, observations)
                else:
                    self._submit_for_review(key, observations)
    
    def _apply_change(self, key, observations):
        """Apply confirmed change to map."""
        element_id, change_type = key
        
        if change_type == "traffic_pattern":
            # Update behavioral statistics
            new_pattern = self._aggregate_traffic(observations)
            self.map.elements[element_id].traffic_flow = new_pattern
            self.map.elements[element_id].last_observed = datetime.now()
        
        elif change_type == "condition":
            new_condition = self._majority_vote(observations)
            self.map.elements[element_id].surface_type = new_condition
        
        # Clear pending
        del self.pending_changes[key]
    
    def _submit_for_review(self, key, observations):
        """Submit geometry/semantic change for human review."""
        element_id, change_type = key
        
        review_request = {
            "element_id": element_id,
            "change_type": change_type,
            "observation_count": len(observations),
            "first_seen": observations[0]["timestamp"],
            "last_seen": observations[-1]["timestamp"],
            "vehicles_reporting": list(set(o["vehicle_id"] for o in observations)),
            "proposed_change": self._aggregate_geometric(observations),
            "current_map_state": self.map.elements[element_id],
            "evidence_images": [o["observation"].image_path for o in observations[:5]],
        }
        
        self.review_queue.submit(review_request)
```

### 8.2 Change Detection from Fleet Data

```python
class MapChangeDetector:
    """Detect changes between current map and sensor observations."""
    
    def detect(self, observation, current_map):
        """Detect map changes from a single observation."""
        changes = []
        
        # 1. Geometric changes (new obstacles, moved barriers)
        observed_obstacles = observation.detected_static_objects
        expected_obstacles = current_map.get_static_objects(observation.ego_pose)
        
        for obs in observed_obstacles:
            if not self._matches_any(obs, expected_obstacles, threshold_m=1.0):
                changes.append(MapChange(
                    element_id=self._nearest_element(obs.position, current_map),
                    change_type="new_obstacle",
                    position=obs.position,
                    description=f"Unmatched static object: {obs.class_name}",
                    confidence=obs.confidence,
                ))
        
        # 2. Missing expected features
        for expected in expected_obstacles:
            if not self._matches_any(expected, observed_obstacles, threshold_m=2.0):
                changes.append(MapChange(
                    element_id=expected.id,
                    change_type="missing_feature",
                    position=expected.position,
                    description=f"Expected {expected.class_name} not observed",
                    confidence=0.6,  # Could be occlusion, not missing
                ))
        
        # 3. Surface condition changes
        observed_surface = observation.surface_classification
        expected_surface = current_map.get_surface_type(observation.ego_pose)
        if observed_surface != expected_surface:
            changes.append(MapChange(
                element_id=self._nearest_road(observation.ego_pose, current_map),
                change_type="condition",
                description=f"Surface: expected {expected_surface}, observed {observed_surface}",
                confidence=observation.surface_confidence,
            ))
        
        return changes
```

---

## 9. Semantic Map Layers for Airside

### 9.1 Complete Layer Architecture

```
Layer 7: Mission Layer         ← Current missions, vehicle assignments
Layer 6: Behavioral Layer      ← Traffic patterns, risk zones, temporal models
Layer 5: Dynamic Constraint    ← Active NOTAMs, pushback zones, fueling zones
Layer 4: Semantic Rules        ← Right-of-way, speed limits, direction, topology
Layer 3: Infrastructure        ← Buildings, jet bridges, barriers, lighting
Layer 2: Geometric             ← Service roads, stands, taxiway crossings
Layer 1: Metric (Point Cloud)  ← Raw LiDAR SLAM map
Layer 0: Base (AMDB)           ← Aerodrome mapping database geometry
```

### 9.2 Per-Layer Update Strategy

| Layer | Update Source | Frequency | Validation |
|-------|-------------|-----------|------------|
| L0: AMDB | FAA/EUROCONTROL AIRAC | 28 days | Automatic download |
| L1: Metric | Vehicle SLAM | Per mission | Loop closure check |
| L2: Geometric | HD survey + SLAM refinement | Monthly | RTK comparison |
| L3: Infrastructure | Manual annotation + fleet detection | Quarterly | Human review |
| L4: Semantic | Fleet observation + NMP | Weekly | Fleet consensus |
| L5: Dynamic | NOTAM feed + A-CDM + perception | Real-time | Automatic |
| L6: Behavioral | Fleet statistics + NMP | Daily | Statistical tests |
| L7: Mission | Fleet management system | Real-time | Operational |

---

## 10. Integration with Existing Stack

### 10.1 ROS Integration

```python
# ROS topics for semantic map integration

MAP_TOPICS = {
    # Published by semantic map node
    "/semantic_map/local_elements": "semantic_map_msgs/ElementArray",
    "/semantic_map/constraints": "semantic_map_msgs/ConstraintArray",
    "/semantic_map/topology": "semantic_map_msgs/TopologyGraph",
    "/semantic_map/uncertainty": "semantic_map_msgs/UncertaintyGrid",
    "/semantic_map/risk_zones": "semantic_map_msgs/RiskZoneArray",
    
    # Consumed by semantic map node
    "/localization/pose": "geometry_msgs/PoseStamped",
    "/perception/static_objects": "perception_msgs/ObjectArray",
    "/notam/constraints": "notam_msgs/ConstraintArray",
    "/acdm/flight_events": "acdm_msgs/FlightEvent",
    
    # Map update topics
    "/map_update/change_detected": "map_msgs/ChangeDetection",
    "/map_update/review_status": "map_msgs/ReviewStatus",
}
```

### 10.2 Planner Integration

```python
class SemanticAwarePlanner:
    """Planner that uses semantic map for informed decisions."""
    
    def __init__(self, base_planner, semantic_map):
        self.planner = base_planner  # Frenet or neural
        self.map = semantic_map
    
    def plan(self, ego_state, goal):
        """Plan with semantic awareness."""
        # Get local constraints from semantic map
        constraints = self.map.query_constraints(ego_state.position)
        
        # Adjust planning parameters
        speed_limit = min(
            c["limit_kmh"] for c in constraints 
            if c["type"] == "speed_limit"
        ) if any(c["type"] == "speed_limit" for c in constraints) else 25.0
        
        # Add safety margins from map uncertainty
        local_elements = self.map.query_at_position(*ego_state.position)
        max_uncertainty = max(
            (e.get_safety_margin() for e in local_elements), default=0
        )
        clearance = 0.5 + max_uncertainty  # Base + uncertainty margin
        
        # Check right-of-way at upcoming junctions
        upcoming_junctions = self._find_upcoming_junctions(ego_state, goal)
        for junction in upcoming_junctions:
            row = self.map.get_right_of_way(ego_state.current_road, junction)
            if row == "yield":
                # Add yield point to trajectory
                self.planner.add_yield_point(junction.position)
        
        # Plan with constraints
        trajectory = self.planner.plan(
            ego_state, goal,
            max_speed_kmh=speed_limit,
            min_clearance_m=clearance,
        )
        
        return trajectory
```

---

## 11. Multi-Airport Map Sharing Strategy

### 11.1 What Transfers Between Airports

| Component | Transferable? | How |
|-----------|--------------|-----|
| NMP encoder/decoder weights | Yes | Pre-trained on all airports, fine-tuned per airport |
| Semantic class definitions | Yes | Shared 18-class taxonomy across airports |
| Topology inference model | Yes | Junction/connection detection generalizes |
| Traffic pattern models | No | Airport-specific, must learn per airport |
| Risk zone definitions | Partially | Jet blast/fuel zones similar; layout-specific zones differ |
| Right-of-way rules | Partially | Aircraft priority universal; intersection rules local |
| AMDB data | Per-airport | Free from FAA/EUROCONTROL |

### 11.2 Shared Model Architecture

```python
class MultiAirportMapModel:
    """Shared semantic mapping model across airports.
    
    Architecture:
    - Shared backbone (BEV encoder, feature extractor)
    - Per-airport LoRA adapters (lightweight, ~2-5MB each)
    - Shared NMP encoder/decoder
    - Per-airport prior store (separate feature grids)
    """
    
    def __init__(self, airports):
        self.shared_backbone = BEVEncoder()
        self.shared_nmp = NeuralMapPrior()
        
        # Per-airport lightweight adapters
        self.airport_adapters = {
            airport: LoRAAdapter(rank=8) for airport in airports
        }
        
        # Per-airport prior stores
        self.prior_stores = {
            airport: PriorStore(airport) for airport in airports
        }
    
    def map_at_airport(self, sensor_data, ego_pose, airport_icao):
        """Generate semantic map at specific airport."""
        # Shared feature extraction
        features = self.shared_backbone(sensor_data)
        
        # Airport-specific adaptation
        adapter = self.airport_adapters[airport_icao]
        adapted_features = adapter(features)
        
        # Prior from this airport's store
        prior = self.prior_stores[airport_icao].get_prior(ego_pose)
        
        # NMP fusion
        enhanced = self.shared_nmp.predict_with_prior(adapted_features, prior)
        
        return self.decoder(enhanced)
    
    def add_new_airport(self, airport_icao):
        """Add a new airport with minimal setup.
        
        Cost: Initialize LoRA adapter (~10 minutes training on 100 frames)
              Initialize empty prior store
              AMDB bootstrap for initial geometry
        """
        self.airport_adapters[airport_icao] = LoRAAdapter(rank=8)
        self.prior_stores[airport_icao] = PriorStore(airport_icao)
        
        # Quick LoRA initialization from nearest airport
        nearest = self._find_nearest_airport(airport_icao)
        if nearest:
            self.airport_adapters[airport_icao].load_from(
                self.airport_adapters[nearest]
            )
```

---

## 12. Practical Implementation

### 12.1 Implementation Roadmap

| Phase | Capability | Timeline | Dependencies |
|-------|-----------|----------|-------------|
| **P1** | Geometric map + topology graph from AMDB + SLAM | 0-3 months | AMDB data, SLAM pipeline |
| **P2** | Semantic annotations (manual + rule-based) | 2-4 months | Airport SOPs, survey |
| **P3** | NMP integration (fleet-learned priors) | 4-8 months | 10+ vehicle fleet, cloud infra |
| **P4** | PriorDrive (multi-source prior fusion) | 6-12 months | NMP + AMDB + survey integration |
| **P5** | Topology discovery from fleet data | 8-12 months | Sufficient fleet trajectories |
| **P6** | Map uncertainty + conformal prediction | 12-18 months | Calibration dataset per airport |

### 12.2 Cost Estimates

| Component | First Airport | Additional Airports |
|-----------|--------------|-------------------|
| AMDB processing pipeline | $10-20K | $2-5K |
| Semantic annotation tooling | $15-25K | $5-10K |
| NMP training infrastructure | $20-40K | $5-10K |
| Topology discovery | $10-15K | $3-5K |
| Uncertainty calibration | $10-15K | $5-8K |
| **Total** | **$65-115K** | **$20-38K** |

### 12.3 Key Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Geometric accuracy | ≤ 0.2m (95th percentile) | RTK comparison |
| Semantic label accuracy | ≥ 90% | Human annotation comparison |
| Topology completeness | ≥ 95% connections discovered | Manual topology audit |
| NMP convergence | +4 mAP within 1 week of fleet ops | Online evaluation |
| Map staleness alert | Within 24 hours of change | Fleet change detection |
| Uncertainty calibration | 95% coverage at α=0.05 | Conformal prediction test |

---

## References

### Neural Map Prior and Online Mapping
- Xiong et al. (CVPR 2023) — Neural Map Prior for Autonomous Driving
- PriorDrive (2024) — Enhancing Online HD Mapping with Unified Vector Priors
- MapTR (ICLR 2023) — Structured Modeling and Learning for Online Vectorized HD Map Construction
- MapTracker (ECCV 2024) — Tracking with Strided Memory Transformer for Online Vectorized HD Map Construction
- StreamMapNet (WACV 2024) — Streaming HD Map Construction

### Topology Reasoning
- TopoNet (CVPR 2023) — Graph-based Topology Reasoning for Driving Scenes
- TopoMLP (NeurIPS 2023) — MLP-based Topology Reasoning
- LaneSegNet (CVPR 2024) — End-to-End Lane Segment Perception
- T2SG (CVPR 2025) — Traffic Topology Scene Graph for Topology Reasoning in Autonomous Driving

### Uncertainty Quantification
- Conformal Prediction and MLLM aided Uncertainty Quantification in Scene Graph Generation (CVPR 2025)
- Semantic Property Maps for Driving Applications (2025)

### Related Repository Documents
- `technology/localization/hd-map-standards-airside.md` — AMDB/AMXM/OpenDRIVE standards
- `technology/localization/neural-online-mapping-sota.md` — MapTracker, StreamMapNet comparison
- `technology/localization/lidar-slam-algorithms.md` — KISS-ICP for metric map layer
- `operations/deployment/multi-airport-adaptation.md` — AMDB bootstrap, per-airport adaptation
- `technology/perception/lidar-foundation-models.md` — PTv3 for BEV feature extraction
- `technology/robustness/test-time-adaptation-airside.md` — Domain adaptation for map models
