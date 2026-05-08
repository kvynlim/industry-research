# Map-Free and Map-Lite Driving for Airports

## Eliminating the Per-Airport HD Map Bottleneck

---

## 1. Why Map-Free Matters for Airports

### 1.1 The Current Problem

Every airside AV deployment today requires:
- **Surveying:** $50K-200K per airport for AMDB/HD map creation
- **Waypoint authoring:** Days to weeks of manual route creation per airport
- **Map maintenance:** Airport layouts change (construction, gate reassignment, seasonal)
- **NOTAM integration:** Temporary restrictions must update the map in real-time
- **Scaling bottleneck:** Each new airport = repeat the entire mapping process

TractEasy takes **1-6 years per airport** to deploy. AeroVect's Explorer maps in **2 hours** — but still creates an HD map that goes stale.

### 1.2 The World Model Alternative

A world model that understands navigable space from sensor data eliminates the HD map dependency:

```
HD Map approach:    Survey → Build map → Author waypoints → Navigate on map → Maintain map
Map-free approach:  Perceive → Understand → Navigate → Learn → Generalize

HD Map: O(airports) cost to scale
Map-free: O(1) — same model works everywhere
```

---

## 2. Online Vectorized Mapping

### 2.1 MapTR / MapTRv2

**What it does:** Constructs vectorized map elements (lane dividers, road boundaries, pedestrian crossings) in real-time from camera/LiDAR input.

```
Architecture:
  BEV features (from cameras or LiDAR)
      │
      ├── Learnable map queries (like DETR object queries but for map elements)
      │
      ├── Transformer decoder with cross-attention to BEV features
      │
      └── Output: Set of polylines with class labels
          - Lane dividers
          - Road boundaries
          - Pedestrian crossings

MapTRv2 improvements:
  - One-to-many matching (more training signal)
  - Auxiliary losses (point direction, segment angle)
  - Decoupled self-attention (inter-instance + intra-instance)

Performance (nuScenes):
  MapTRv2: 68.7 mAP (vectorized map construction)
  Latency: ~50ms
```

### 2.2 Airport Mapping: What Transfers

| Road Map Element | Airport Equivalent | Detectability |
|-----------------|-------------------|---------------|
| Lane dividers | Taxiway centerline markings | High (painted lines) |
| Road boundaries | Apron/taxiway edges | High (painted lines) |
| Pedestrian crossings | Pedestrian walkways (if marked) | Medium |
| Stop lines | Holding position markings | High (painted) |
| *Not in road domain* | Stand/gate markings | Need custom class |
| *Not in road domain* | Safety zone boundaries | Need custom class |
| *Not in road domain* | Equipment positioning marks | Need custom class |

### 2.3 StreamMapNet (Temporal Consistency)

Extends MapTR with temporal fusion — map elements persist and update over time:

```
Frame t-2: detect partial taxiway edge →
Frame t-1: extend with more observations →
Frame t: complete taxiway boundary

Benefits for airports:
  - Handles partial visibility (aircraft blocking view of markings)
  - Maintains map consistency across frames
  - Reduces jitter in map element positions
```

---

## 3. AIXM/AMXM as Lightweight Prior

### 3.1 The Hybrid Approach

Instead of NO map, use a **lightweight coarse map** from standardized aviation data:

```
AIXM/AMXM provides (FREE for most airports):
  ├── Taxiway centerlines (approximate, ±1-2m)
  ├── Apron boundaries
  ├── Stand positions and numbers
  ├── Runway locations (obviously)
  ├── Building outlines
  └── No surface markings, no height data, no obstacles

This is NOT an HD map. It's a coarse prior that:
  - Tells you WHERE taxiways and stands are (approximately)
  - Gives you a navigation graph (which taxiways connect)
  - Provides stand numbers for dispatch integration

Online perception REFINES this:
  - Detects actual lane markings (precise position)
  - Identifies obstacles not in AIXM
  - Handles temporary changes (construction, equipment)
  - Updates for NOTAM restrictions
```

### 3.2 AIXM-to-Navigation Pipeline

```python
def create_navigation_prior(aixm_file):
    """Convert AIXM airport data to navigation prior."""
    # Parse AIXM XML
    airport = parse_aixm(aixm_file)

    # Extract features
    taxiways = airport.get_features('TaxiwayElement')
    aprons = airport.get_features('ApronElement')
    stands = airport.get_features('AircraftStand')

    # Build navigation graph
    graph = NavigationGraph()
    for tw in taxiways:
        # Taxiway centerline → navigable path
        graph.add_edge(
            start=tw.start_point,
            end=tw.end_point,
            width=tw.width,
            name=tw.designator,
            speed_limit=get_speed_limit(tw),
        )

    for stand in stands:
        # Stand → node in graph
        graph.add_node(
            position=stand.reference_point,
            name=stand.designator,
            type='stand',
        )

    return graph  # Coarse navigation prior

# At runtime:
#   1. Load AIXM navigation prior
#   2. Localize on prior (coarse, GPS-based)
#   3. Online perception refines local map (lane markings, obstacles)
#   4. NOTAM parser updates restrictions dynamically
#   5. Navigate using refined local map + coarse global graph
```

### 3.3 NOTAM-Triggered Dynamic Updates

```python
def apply_notam_to_graph(graph, notam):
    """Update navigation graph based on NOTAM restrictions."""
    if notam.type == 'TAXIWAY_CLOSED':
        graph.close_edge(notam.taxiway_designator)
    elif notam.type == 'CONSTRUCTION':
        graph.add_restricted_zone(notam.polygon)
    elif notam.type == 'SPEED_RESTRICTION':
        graph.set_speed_limit(notam.area, notam.speed_limit)
    elif notam.type == 'TEMPORARY_ROUTE':
        graph.add_temporary_edge(notam.route)
    # Planner automatically routes around restrictions
```

---

## 4. World Model as Implicit Map

### 4.1 The Argument

A world model trained on airside driving data learns the structure of airport surfaces implicitly:

```
Explicit map: "There is a taxiway centerline at coordinates (x, y) with heading θ"
World model:  "Given current sensor data, the drivable space extends in this direction,
               and vehicles typically travel along this path"

The world model doesn't need a map because it HAS internalized map-like knowledge:
  - Where drivable surfaces are (from occupancy prediction)
  - Where vehicles typically go (from motion prediction)
  - What structures look like (from scene understanding)
  - Where boundaries are (from road/apron edge detection)
```

### 4.2 How This Works in Practice

```
Scenario: First visit to a new airport

With HD map: Cannot operate — no map exists, must survey first
With AIXM prior + world model:
  1. Load AIXM prior (approximate taxiway/stand layout)
  2. World model perceives actual surface markings, obstacles, drivable space
  3. Frenet planner generates trajectories within perceived drivable space
  4. World model predicts outcomes of candidate trajectories
  5. Vehicle navigates successfully using perception alone

Requirements:
  - World model pre-trained on multiple airports (generalization)
  - AIXM data for the airport (available for most airports globally)
  - Camera or LiDAR perception of surface markings and boundaries
  - GPS for coarse localization within AIXM graph
```

### 4.3 Evidence This Could Work

| System | Map Dependency | Result |
|--------|---------------|--------|
| **Wayve AV2.0** | No HD map, single model | Drives 500+ cities with one model |
| **Wayve US adaptation** | 500 hours incremental data | 40x improvement from zero-shot |
| **comma.ai openpilot** | No HD map | 325+ car models, all roads |
| **Tesla FSD V13** | No HD map (vision-only) | Operates everywhere cameras can see |

If it works for road driving without HD maps, it should work for the more structured airport environment — fewer intersections, lower speeds, more consistent markings.

---

## 5. Practical Architecture for Airside

### 5.1 Recommended Three-Layer Map System

```
Layer 1: AIXM Static Prior (loaded once per airport)
├── Taxiway network (navigation graph)
├── Stand positions and numbers
├── Building outlines
├── Runway positions (no-go zones)
└── Resolution: ±1-2m, sufficient for global routing

Layer 2: Lanelet2 Operational Layer (updated from NOTAMs)
├── Speed limits per zone
├── Restricted areas (construction, de-icing)
├── Temporary routes
├── Active stand assignments
└── Updated: every NOTAM cycle or real-time from A-CDM

Layer 3: Online Perception (real-time from sensors)
├── Surface marking detection (taxiway lines, stand markings)
├── Drivable space prediction (from world model occupancy)
├── Dynamic obstacle detection (aircraft, GSE, personnel)
├── Local map refinement (cm-level accuracy)
└── Updated: every sensor cycle (10Hz)

Navigation uses:
  Layer 1 for global routing (which taxiway to take)
  Layer 2 for operational constraints (speed limits, closures)
  Layer 3 for local planning (exact trajectory within drivable space)
```

### 5.2 Deployment at a New Airport

```
Traditional approach (TractEasy/Aurrigo):
  Week 1-4: Site survey, map creation
  Week 4-8: Waypoint authoring, route programming
  Week 8-12: Testing, tuning, validation
  Week 12+: Operational deployment
  Total: 3-6 months

Map-lite approach:
  Day 1: Load AIXM data for airport (download from national AIP)
  Day 1: Configure Lanelet2 zones from airport ops procedures
  Day 1-3: Supervised driving on routes (vehicle learns with world model)
  Day 3-7: Shadow mode validation
  Week 2+: Begin autonomous operations
  Total: 1-2 weeks

10-25x faster deployment.
```

---

## 6. Surface Marking Recognition

### 6.1 Airport-Specific Markings

Airports have standardized markings (ICAO Annex 14, FAA AC 150/5340-1M):

| Marking | Description | Color | Detection Method |
|---------|-------------|-------|-----------------|
| Taxiway centerline | Continuous yellow line | Yellow | Line detection (classical or learned) |
| Taxiway edge | Continuous double yellow | Yellow | Line detection |
| Holding position | Dashed yellow across taxiway | Yellow | Pattern detection |
| ILS critical area | Ladder marking | Yellow | Pattern detection |
| Stand centerline | Lead-in line to parking position | Yellow/white | Line detection |
| Stop bar | Red flush lights | Red (lit) | Light detection |
| Stand number | Painted on apron surface | White | OCR (needs camera) |
| Safety zone boundary | Red/white markings | Red/white | Color detection (needs camera) |

### 6.2 Detection Approaches

**LiDAR-based (Phase 1):**
- Intensity-based: Painted markings have different LiDAR reflectivity than bare tarmac
- Works for yellow/white lines on dark asphalt
- Limited: Cannot distinguish colors, harder in wet conditions

**Camera-based (Phase 2):**
- Learned lane detection (CLRNet, LaneATT) adapted for taxiway markings
- Color-based: Yellow vs white vs red marking classification
- OCR for stand numbers
- Foundation model (DINOv2) features for robust detection

---

## 7. Comparison: Map-Based vs Map-Free

| Aspect | HD Map | AIXM + World Model |
|--------|--------|-------------------|
| **Deployment time per airport** | 3-6 months | 1-2 weeks |
| **Survey cost per airport** | $50K-200K | $0 (AIXM is free/cheap) |
| **Accuracy** | cm-level (surveyed) | m-level global, cm-level local (perception) |
| **Maintenance** | Manual updates needed | Self-updating from perception |
| **NOTAM handling** | Manual map patching | Automatic from NOTAM parser |
| **Scalability** | O(n) cost per airport | O(1) after model is trained |
| **Weather robustness** | Map always available | Perception degrades in weather |
| **Night operations** | Map always available | LiDAR unaffected, camera limited |
| **Construction handling** | Map becomes stale | Detected by perception + NOTAM |
| **Risk** | Low (proven, deterministic) | Medium (learned, probabilistic) |

**Recommendation:** Start with HD map approach (proven, what Aurrigo already does). Develop map-lite capability in parallel. Transition when world model accuracy is validated. Keep HD map as fallback.

---

## Sources

- Liao et al. "MapTR: Structured Modeling and Learning for Online Vectorized HD Map Construction." ICLR, 2023
- Liao et al. "MapTRv2: An End-to-End Framework for Online Vectorized HD Map Construction." arXiv, 2023
- Yuan et al. "StreamMapNet: Streaming Mapping Network for Vectorized Online HD Map Construction." WACV, 2024
- ICAO Annex 14: Aerodromes — Surface Markings
- FAA AC 150/5340-1M: Standards for Airport Markings
- AIXM 5.1 specification (EUROCONTROL/FAA)
- Wayve AV2.0 blog posts
- comma.ai research publications
