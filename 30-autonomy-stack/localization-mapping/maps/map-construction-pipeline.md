# HD Map Construction Pipeline: From Survey Drives to Fleet-Deployable Maps

> End-to-end offline map building pipeline for airport airside autonomous GSE -- covering survey drive planning and data collection protocols, multi-session SLAM processing and map merging, point cloud post-processing (noise removal, ground segmentation, feature extraction), geodetic alignment and ground control point registration, AMDB overlay and co-registration, automated semantic annotation with foundation models, Lanelet2 map generation (centerlines, boundaries, regulatory elements), quality assurance and validation gates, map packaging and OTA deployment, version control and CI/CD for maps, tools and software ecosystem comparison, cost and time estimates per airport. This document bridges the gap between "we drove around a new airport" and "we have a production-ready HD map on every vehicle."
>
> **Relation to existing docs**: `../overview/lidar-slam-algorithms.md` covers SLAM algorithms (KISS-ICP, LIO-SAM, FAST-LIO2). `hd-map-standards-airside.md` covers format standards (AMDB, Lanelet2, OpenDRIVE). `hd-map-change-detection-maintenance.md` covers ongoing map maintenance. `neural-online-mapping-sota.md` covers real-time neural methods. `semantic-mapping-learned-priors.md` covers learned priors. This document integrates all of these into the **complete offline construction workflow** that produces the initial map for a new airport deployment.
>
> **Key Takeaway**: A new airport's HD map can be constructed in 5-7 working days at $20-40K cost using the pipeline described here: 1 day survey driving (3-5 systematic laps covering all operational areas), 1-2 days SLAM processing and alignment, 1 day automated annotation (SAM + CLIP + AMDB overlay), 1 day manual QC and Lanelet2 generation, 1-2 days validation and packaging. The critical bottleneck is not data collection or processing but **annotation quality assurance** -- automated methods achieve 85-92% accuracy on airside features but miss rare classes (fire hydrants, cable trenches, drainage grates) that require manual verification. Multi-session SLAM with GTSAM factor graph achieves sub-10cm global consistency when anchored by RTK ground control points at 50-100m intervals. The pipeline produces a 7-layer map (AMDB base through dynamic overlay) packaged as versioned Lanelet2 + occupancy grid + metadata, distributed via the fleet OTA system with atomic rollback capability. **No complete open-source airside map construction pipeline exists** -- this is a competitive moat that compounds with each airport deployed.

---

## Table of Contents

1. [Introduction and Motivation](#1-introduction-and-motivation)
2. [Pipeline Architecture Overview](#2-pipeline-architecture-overview)
3. [Survey Drive Planning and Data Collection](#3-survey-drive-planning-and-data-collection)
4. [Multi-Session SLAM Processing](#4-multi-session-slam-processing)
5. [Point Cloud Post-Processing](#5-point-cloud-post-processing)
6. [Geodetic Alignment and Ground Control](#6-geodetic-alignment-and-ground-control)
7. [AMDB Overlay and Co-Registration](#7-amdb-overlay-and-co-registration)
8. [Automated Semantic Annotation](#8-automated-semantic-annotation)
9. [Lanelet2 Map Generation](#9-lanelet2-map-generation)
10. [Quality Assurance and Validation](#10-quality-assurance-and-validation)
11. [Map Packaging and Deployment](#11-map-packaging-and-deployment)
12. [Version Control and CI/CD for Maps](#12-version-control-and-cicd-for-maps)
13. [Tools and Software Ecosystem](#13-tools-and-software-ecosystem)
14. [Cost and Time Estimates](#14-cost-and-time-estimates)
15. [Industry Approaches](#15-industry-approaches)
16. [Key Takeaways](#16-key-takeaways)
17. [References](#17-references)

---

## 1. Introduction and Motivation

### 1.1 The Map Construction Bottleneck

When deploying autonomous GSE to a new airport, the HD map is the first and most critical infrastructure component. Without it, localization (GTSAM+VGICP), planning (Frenet), and safety (geofence, CBF) cannot function. Yet map construction is typically the least documented and most ad-hoc step in the deployment process.

The existing research repository covers individual components in depth:
- **SLAM algorithms** (`../overview/lidar-slam-algorithms.md`): KISS-ICP, LIO-SAM, FAST-LIO2
- **Map standards** (`hd-map-standards-airside.md`): AMDB, Lanelet2, OpenDRIVE
- **Change detection** (`hd-map-change-detection-maintenance.md`): Fleet-based updates, AIRAC integration
- **Neural online mapping** (`neural-online-mapping-sota.md`): MapTracker, StreamMapNet
- **Learned priors** (`semantic-mapping-learned-priors.md`): Neural Map Prior, PriorDrive

What is missing is the **end-to-end integration pipeline** that takes these components and produces a deployment-ready map for a new airport. This document fills that gap.

### 1.2 Requirements for an Airside HD Map

An airside HD map must satisfy requirements from multiple systems simultaneously:

| Consumer | Required Layers | Accuracy | Update Rate |
|---|---|---|---|
| GTSAM localization | Dense 3D point cloud | ±5cm | Static (monthly survey) |
| Frenet planner | Lanelet2 centerlines + boundaries | ±10cm | Per AIRAC cycle |
| CBF safety filter | Geofence polygons, SDF | ±20cm | Per AIRAC + live |
| VLM scene understanding | Semantic labels, landmark IDs | Feature-level | As needed |
| Fleet dispatch | Topology graph, routing costs | Topological | Dynamic |
| Runway incursion protection | Hold-short lines, geofences | ±50cm | Per AIRAC |
| Docking controllers | Aircraft stand templates | ±2cm | Per aircraft type |

### 1.3 The 7-Layer Map Architecture

From `semantic-mapping-learned-priors.md`, the recommended architecture:

```
L7: Dynamic Overlay        — Real-time fleet perception (obstacles, GSE, aircraft)
L6: Mission Layer           — Current task assignments, active routes, charging queues
L5: Topology Graph          — Navigable graph with edge costs, right-of-way rules
L4: Neural Map Prior        — Learned behavioral priors from fleet data
L3: Semantic Annotations    — Lane markings, signs, landmarks, stand IDs, hazard zones
L2: Fleet SLAM Refinement   — Accumulated VGICP corrections from operational data
L1: Survey HD Point Cloud   — Initial high-accuracy 3D survey
L0: AMDB Base               — FAA/EUROCONTROL aerodrome mapping data
```

This document covers the construction of layers L0-L3 and L5 — the static layers built during initial airport onboarding. Layers L4, L6, L7 are built during and after operational deployment.

---

## 2. Pipeline Architecture Overview

### 2.1 End-to-End Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MAP CONSTRUCTION PIPELINE                            │
│                                                                         │
│  ┌──────────┐    ┌──────────┐    ┌───────────┐    ┌──────────────┐     │
│  │ Survey   │───>│ Multi-   │───>│ Point     │───>│ Geodetic     │     │
│  │ Drives   │    │ Session  │    │ Cloud     │    │ Alignment    │     │
│  │ (rosbag) │    │ SLAM     │    │ Post-Proc │    │ (RTK/GCPs)   │     │
│  └──────────┘    └──────────┘    └───────────┘    └──────┬───────┘     │
│                                                          │              │
│  ┌──────────┐    ┌──────────┐    ┌───────────┐    ┌──────▼───────┐     │
│  │ Deploy   │<───│ Package  │<───│ QA &      │<───│ Semantic     │     │
│  │ to Fleet │    │ & Version│    │ Validate  │    │ Annotation   │     │
│  └──────────┘    └──────────┘    └───────────┘    │ + Lanelet2   │     │
│                                                    └──────────────┘     │
│                                                                         │
│  Parallel: AMDB Download & Parse ──────────────────────────────────>    │
│  Parallel: GCP Survey ─────────────────────────────────────────────>    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Pipeline Stages Summary

| Stage | Input | Output | Time | Tools |
|---|---|---|---|---|
| 1. Survey drives | Airport access | rosbags (200-500GB) | 4-8 hours | Vehicle + ROS |
| 2. Multi-session SLAM | rosbags | Per-session trajectories + submaps | 2-8 hours | LIO-SAM / FAST-LIO2 |
| 3. Point cloud post-processing | Raw SLAM clouds | Clean, merged 3D map | 1-2 hours | Open3D, PCL |
| 4. Geodetic alignment | SLAM map + GCPs | Geo-referenced map (EPSG) | 0.5-1 hour | GTSAM, CloudCompare |
| 5. AMDB overlay | FAA AMDB + aligned map | Co-registered map + AMDB features | 1-2 hours | Custom scripts |
| 6. Semantic annotation | Aligned map + images | Labeled features | 4-8 hours | SAM+CLIP, CVAT |
| 7. Lanelet2 generation | Semantic map | Lanelet2 .osm + occupancy grid | 2-4 hours | Custom + JOSM |
| 8. QA validation | Complete map | Validated map + test report | 2-4 hours | Automated checks |
| 9. Packaging + deploy | Validated map | Versioned map package | 0.5-1 hour | DVC, OTA system |

**Total: 5-7 working days per airport** (with 1-2 people)

---

## 3. Survey Drive Planning and Data Collection

### 3.1 Coverage Requirements

Airport airside areas have specific geometric properties that affect survey planning:

```
Typical apron/ramp area:
- Single stand: ~60m x 40m = 2,400 m²
- Terminal block (10 stands): ~600m x 80m = 48,000 m²
- Full airport apron: 0.5-3.0 km²
- Taxiway network: 2-15 km total length

RoboSense RSHELIOS coverage per scan:
- Effective range: 70m (90% return rate)
- Vertical FOV: -55° to +15°
- Horizontal FOV: 360°
- Single-pass corridor coverage: ~140m x 50m ≈ 7,000 m²
```

### 3.2 Survey Drive Patterns

Three systematic drive patterns ensure complete coverage:

**Pattern 1: Perimeter Loop**
```
Drive the perimeter of each operational area at 5-10 km/h.
Purpose: Capture building facades, fences, fixed infrastructure
from the outside. Provides global structure.

     ┌─────────────────────────────────┐
     │           Terminal              │
     │  ┌───┐ ┌───┐ ┌───┐ ┌───┐      │
     │  │ 1 │ │ 2 │ │ 3 │ │ 4 │ Stands│
     └──┴───┴─┴───┴─┴───┴─┴───┴──────┘
  ───────────────────────────────────────>  Drive direction
     Taxiway Alpha
```

**Pattern 2: Lane-Mow (Parallel Passes)**
```
Parallel passes at 20-30m spacing across each apron area.
Purpose: Dense interior coverage, sufficient overlap for
SLAM loop closure. 50% overlap between adjacent passes.

     ┌─────────────────────────────────┐
     │ ──────────────────────────> (1)  │
     │ <────────────────────────── (2)  │
     │ ──────────────────────────> (3)  │
     │ <────────────────────────── (4)  │
     │ ──────────────────────────> (5)  │
     └─────────────────────────────────┘
```

**Pattern 3: Feature-Focused**
```
Slow passes (2-3 km/h) near critical features:
- Hold-short lines and runway protection zones
- Aircraft stand markings and lead-in lines
- Equipment storage areas
- Fuel hydrant pits and covers
- Drainage grates and cable crossings
```

### 3.3 Data Collection Protocol

```python
class SurveyDriveProtocol:
    """Standard data collection protocol for new airport mapping."""
    
    # Minimum collection parameters
    MIN_LAPS_PERIMETER = 3        # For robust loop closure
    MIN_PASSES_INTERIOR = 2       # At different times/conditions
    MAX_SPEED_KMH = 10            # Slower = denser point clouds
    FEATURE_SPEED_KMH = 3         # For critical features
    
    # Sensor configuration during survey
    LIDAR_RATE_HZ = 10            # Standard rate, all LiDARs active
    IMU_RATE_HZ = 500             # Full rate for SLAM
    RTK_RATE_HZ = 10              # RTK-GPS for global alignment
    CAMERA_RATE_HZ = 10           # If available, for annotation
    
    # Data volume estimates
    LIDAR_BYTES_PER_SEC = 25_000_000    # ~25 MB/s per LiDAR
    NUM_LIDARS = 4                       # Minimum for 360° coverage
    SURVEY_DURATION_HOURS = 6            # Typical full airport
    
    @staticmethod
    def estimate_data_volume(num_lidars=4, hours=6):
        """Estimate total rosbag size for survey."""
        lidar_gb = num_lidars * 25e6 * 3600 * hours / 1e9
        imu_gb = 500 * 100 * 3600 * hours / 1e9   # ~100 bytes/msg
        rtk_gb = 10 * 200 * 3600 * hours / 1e9     # ~200 bytes/msg
        camera_gb = 10 * 2e6 * 3600 * hours / 1e9  # ~2 MB/frame
        total_gb = lidar_gb + imu_gb + rtk_gb + camera_gb
        return {
            'lidar_gb': lidar_gb,       # ~2160 GB (dominant)
            'total_gb': total_gb,        # ~2300 GB
            'compressed_gb': total_gb * 0.15  # ~345 GB with LZ4
        }
    
    # Survey checklist
    CHECKLIST = [
        "RTK base station set up with known coordinates (survey marker or PPP)",
        "All LiDARs verified: point count > 95% of nominal per scan",
        "IMU calibrated: bias estimated during 30s stationary period",
        "rosbag recording started: verify all topics present",
        "RTK fix status: must maintain RTK-fixed for >90% of survey",
        "Weather: no rain/fog (LiDAR degradation), wind <30kt (vehicle stability)",
        "Airport coordination: ramp clear of aircraft at surveyed stands (ideal)",
        "GCPs: minimum 10 ground control points surveyed with total station",
        "Time sync: PTP verified across all sensors before drive",
        "Battery: sufficient for 6+ hours continuous operation",
    ]
```

### 3.4 Ground Control Point (GCP) Placement

GCPs are permanent or semi-permanent markers surveyed with a total station or GNSS PPP to ±1cm accuracy. They anchor the SLAM map to the geodetic coordinate frame.

```
GCP placement strategy for airport apron:

  GCP spacing: 50-100m in operational areas, 200m on taxiways
  Total for typical airport: 20-50 GCPs
  Survey time: 4-8 hours with total station
  
  Recommended locations:
  ┌─────────────────────────────────────────────┐
  │  [G1]────Terminal Building────[G2]          │
  │   │    ┌───┐ ┌───┐ ┌───┐       │           │
  │   │    │ 1 │ │ 2 │ │ 3 │       │           │
  │  [G3]──┴───┴─┴───┴─┴───┴─────[G4]          │
  │   │                             │           │
  │  [G5]─────Taxiway Alpha──────[G6]──[G7]     │
  │                                              │
  │  [G8]─────Taxiway Bravo──────[G9]──[G10]    │
  └─────────────────────────────────────────────┘
  
  GCP types:
  - Paint marks on concrete (cheapest, 1-3 year life)
  - Embedded survey discs (expensive, permanent)
  - Existing surveyed points (taxiway centerline markers, runway threshold)
  - Airport reference points from the AIP (if accessible)
```

### 3.5 Dealing with Dynamic Objects During Survey

Airport aprons are never truly empty. Aircraft, GSE, and personnel will be present during survey:

| Object Type | Size | Impact on Map | Mitigation |
|---|---|---|---|
| Parked aircraft | 30-70m | Massive occlusion, false structure | Multi-pass from different sides; remove via height filter (>4m) or temporal consistency |
| GSE (tugs, loaders) | 2-8m | Moderate occlusion | Multi-pass; dynamic object removal |
| Personnel | 0.5m | Negligible occlusion | Automatic removal via motion filter |
| Jet bridges | 5-15m | Permanent structure — keep | Include in map as obstacle |
| Temporary barriers | 0.5-2m | Should NOT be in permanent map | Remove via AMDB cross-reference |

**Dynamic object removal strategy**: Run each SLAM session independently. Points observed in fewer than K of N sessions (e.g., 2 of 5) at a given voxel are classified as dynamic and removed from the final merged map.

```python
def remove_dynamic_objects(session_maps, voxel_size=0.2, min_sessions=2):
    """Remove dynamic objects by multi-session consistency voting.
    
    Args:
        session_maps: List of N point clouds from independent SLAM sessions
        voxel_size: Voxel resolution for consistency check
        min_sessions: Minimum sessions a point must appear in
    
    Returns:
        Filtered static map
    """
    from collections import defaultdict
    import numpy as np
    
    # Voxelize and count session observations per voxel
    voxel_counts = defaultdict(int)
    voxel_points = defaultdict(list)
    
    for session_idx, cloud in enumerate(session_maps):
        voxel_keys = np.floor(cloud[:, :3] / voxel_size).astype(int)
        seen_voxels = set()
        for i, key in enumerate(voxel_keys):
            k = tuple(key)
            if k not in seen_voxels:
                voxel_counts[k] += 1
                seen_voxels.add(k)
            voxel_points[k].append(cloud[i])
    
    # Keep only voxels observed in >= min_sessions
    static_points = []
    for voxel, count in voxel_counts.items():
        if count >= min_sessions:
            static_points.extend(voxel_points[voxel])
    
    return np.array(static_points)
```

---

## 4. Multi-Session SLAM Processing

### 4.1 SLAM Algorithm Selection for Map Construction

For offline map construction (not real-time), accuracy dominates over speed. The recommended approach:

| Algorithm | Role | Why |
|---|---|---|
| **FAST-LIO2** | Primary per-session SLAM | Tightly-coupled LiDAR-inertial, IMU pre-integration, 0.1° rotational accuracy. iKd-Tree for incremental map update |
| **KISS-ICP** | Secondary / validation | No IMU dependency, serves as independent check on FAST-LIO2 trajectory |
| **GTSAM** | Global optimization | Factor graph for multi-session alignment, GCP anchoring, loop closure |
| **Interactive SLAM** | Manual correction | CloudCompare + manual loop closure for difficult environments |

### 4.2 Per-Session Processing

Each survey drive session produces an independent trajectory and submap:

```
Input:  rosbag (LiDAR + IMU + RTK-GPS topics)
Output: trajectory.csv (timestamped SE3 poses)
        submap.pcd (accumulated point cloud in local frame)
        factor_graph.fg (GTSAM factors for later optimization)

Processing steps:
1. Extract LiDAR scans + IMU data from rosbag
2. Run FAST-LIO2 with configured parameters:
   - Voxel size: 0.3m (finer than real-time default of 0.5m)
   - Max iterations: 10 (vs 4 for real-time)
   - IMU pre-integration: 500Hz
   - Map update: iKd-Tree incremental
3. Extract per-frame poses at 10Hz
4. Accumulate deskewed scans into session submap
5. Downsample submap to 0.05m voxels (5cm resolution)
6. Identify loop closure candidates (revisited locations)
```

### 4.3 Multi-Session Map Merging

The critical step: aligning N independent session submaps into a single globally consistent map.

```python
import gtsam
import numpy as np

def build_multi_session_factor_graph(sessions, gcps, icp_results):
    """Build GTSAM factor graph for multi-session map alignment.
    
    Args:
        sessions: List of {trajectory, submap, gps_fixes}
        gcps: Ground control points with known geodetic coords
        icp_results: Pairwise ICP alignments between overlapping submaps
    """
    graph = gtsam.NonlinearFactorGraph()
    initial = gtsam.Values()
    
    # Noise models
    odom_noise = gtsam.noiseModel.Diagonal.Sigmas(
        np.array([0.01, 0.01, 0.01, 0.005, 0.005, 0.005])  # rad, m
    )
    gcp_noise = gtsam.noiseModel.Diagonal.Sigmas(
        np.array([0.001, 0.001, 0.001, 0.01, 0.01, 0.02])  # 1cm XY, 2cm Z
    )
    icp_noise = gtsam.noiseModel.Diagonal.Sigmas(
        np.array([0.005, 0.005, 0.005, 0.02, 0.02, 0.02])  # 2cm
    )
    gps_noise = gtsam.noiseModel.Diagonal.Sigmas(
        np.array([0.5, 0.5, 1.0])  # RTK accuracy: 0.5m XY, 1.0m Z
    )
    
    node_idx = 0
    session_origins = []
    
    for s_idx, session in enumerate(sessions):
        origin_key = gtsam.symbol('s', s_idx)
        session_origins.append(origin_key)
        
        # Initialize session origin from first GPS fix
        initial.insert(origin_key, gtsam.Pose3(
            gtsam.Rot3.RzRyRx(0, 0, session['heading_rad']),
            gtsam.Point3(*session['gps_fixes'][0])
        ))
        
        # Add GPS factors along trajectory (every 10th pose)
        for i in range(0, len(session['gps_fixes']), 10):
            pose_key = gtsam.symbol('x', node_idx + i)
            gps_point = gtsam.Point3(*session['gps_fixes'][i])
            graph.add(gtsam.GPSFactor(pose_key, gps_point, gps_noise))
        
        # Add odometry factors (FAST-LIO2 relative poses)
        for i in range(len(session['trajectory']) - 1):
            key_i = gtsam.symbol('x', node_idx + i)
            key_j = gtsam.symbol('x', node_idx + i + 1)
            delta = session['trajectory'][i].between(session['trajectory'][i+1])
            graph.add(gtsam.BetweenFactorPose3(key_i, key_j, delta, odom_noise))
        
        node_idx += len(session['trajectory'])
    
    # Add GCP factors (strongest constraints)
    for gcp in gcps:
        # Find nearest pose in nearest session
        nearest_key = find_nearest_pose_key(sessions, gcp['position'])
        gcp_point = gtsam.Point3(*gcp['geodetic_xyz'])
        # GCP is a hard constraint — low noise
        graph.add(gtsam.GPSFactor(nearest_key, gcp_point, gcp_noise))
    
    # Add inter-session ICP factors
    for icp in icp_results:
        key_a = gtsam.symbol('x', icp['pose_idx_a'])
        key_b = gtsam.symbol('x', icp['pose_idx_b'])
        graph.add(gtsam.BetweenFactorPose3(
            key_a, key_b, icp['relative_pose'], icp_noise
        ))
    
    # Optimize
    params = gtsam.LevenbergMarquardtParams()
    params.setMaxIterations(100)
    optimizer = gtsam.LevenbergMarquardtOptimizer(graph, initial, params)
    result = optimizer.optimize()
    
    return result
```

### 4.4 Loop Closure Detection

For multi-session map merging, loop closures are critical for eliminating drift. The pipeline from `../overview/lidar-place-recognition-relocalization.md` applies:

```
Session 1 trajectory ──────────────────────────────>
                   X                    X
Session 2 trajectory ──────────────────────────────>
                              X
Session 3 trajectory ──────────────────────────────>

X = Loop closure detection points (Scan Context pre-filter → MinkLoc3D verify → ICP refine)
```

**Loop closure pipeline for map construction:**
1. **Scan Context** (CPU, <5ms): Generate descriptors for each keyframe (every 5m traveled)
2. **MinkLoc3D** (GPU, ~15ms): Verify top-5 Scan Context candidates with learned descriptor matching
3. **Point-to-plane ICP** (CPU, 50-200ms): Precise 6-DOF alignment for verified matches
4. **Consistency check**: Reject if ICP fitness < 0.3 or RMSE > 0.3m
5. **Add factor**: Insert BetweenFactorPose3 into GTSAM graph

For map construction (offline), we process all loop closures before final optimization — unlike real-time where they're incremental.

### 4.5 Expected Accuracy Budget

| Source | Contribution to Error | After Optimization |
|---|---|---|
| FAST-LIO2 drift | 0.5-2% of travel distance | Bounded by loop closures |
| RTK-GPS (fixed) | ±2cm XY, ±5cm Z | Averaged over trajectory |
| RTK-GPS (float/DGPS) | ±30-50cm | Reduced by GCPs |
| GCP accuracy | ±1cm (total station) | Direct constraint |
| ICP registration | ±2-5cm per alignment | Averaged in graph |
| **Final map accuracy** | — | **±5-10cm global, ±2-3cm local** |

---

## 5. Point Cloud Post-Processing

### 5.1 Processing Pipeline

After multi-session SLAM optimization, the merged point cloud requires cleanup:

```
Merged SLAM Cloud (100M-1B+ points)
    │
    ├── 1. Statistical Outlier Removal (SOR)
    │       Remove isolated noise points
    │       k=30 neighbors, std_ratio=2.0
    │       Removes ~5-10% of points
    │
    ├── 2. Ground Segmentation
    │       RANSAC plane fitting (airport = mostly flat)
    │       Cloth Simulation Filter (CSF) for gentle slopes
    │       Separate ground from above-ground features
    │
    ├── 3. Height Filtering
    │       Remove aircraft (>4m above ground)
    │       Keep: ground, buildings, fences, bollards, signs
    │       Remove: aircraft fuselage, wings, engines
    │
    ├── 4. Voxel Downsampling
    │       Resolution: 0.02-0.05m depending on layer
    │       L1 survey map: 0.05m (manageable size)
    │       Docking templates: 0.02m (high precision)
    │
    ├── 5. Normal Estimation
    │       Required for ICP refinement and surface reconstruction
    │       k=20 neighbors, orient towards sensor origin
    │
    └── 6. Intensity Normalization
            Normalize per-LiDAR intensity to common scale
            Critical for appearance-based features (lane markings)
```

### 5.2 Ground Plane Extraction

Airport aprons are predominantly flat with gentle slopes (1-2% for drainage). This makes ground extraction more reliable than urban environments:

```python
import open3d as o3d
import numpy as np

def extract_ground_plane(cloud, max_slope_deg=3.0, cell_size=2.0):
    """Extract ground plane from airport point cloud.
    
    Uses cell-based RANSAC: divide into grid cells, fit local planes,
    merge cells with consistent planes. Handles gentle drainage slopes.
    """
    points = np.asarray(cloud.points)
    
    # Grid-based ground extraction
    x_cells = np.floor(points[:, 0] / cell_size).astype(int)
    y_cells = np.floor(points[:, 1] / cell_size).astype(int)
    
    ground_mask = np.zeros(len(points), dtype=bool)
    ground_heights = {}  # (cx, cy) -> ground_z
    
    for cx in range(x_cells.min(), x_cells.max() + 1):
        for cy in range(y_cells.min(), y_cells.max() + 1):
            cell_mask = (x_cells == cx) & (y_cells == cy)
            cell_points = points[cell_mask]
            
            if len(cell_points) < 20:
                continue
            
            # RANSAC plane fit within cell
            cell_cloud = o3d.geometry.PointCloud()
            cell_cloud.points = o3d.utility.Vector3dVector(cell_points)
            plane_model, inliers = cell_cloud.segment_plane(
                distance_threshold=0.05,  # 5cm threshold
                ransac_n=3,
                num_iterations=100
            )
            
            # Check plane is approximately horizontal
            normal = np.array(plane_model[:3])
            angle = np.degrees(np.arccos(abs(normal[2])))
            
            if angle < max_slope_deg and len(inliers) > 10:
                cell_indices = np.where(cell_mask)[0]
                ground_mask[cell_indices[inliers]] = True
                ground_heights[(cx, cy)] = np.mean(cell_points[inliers, 2])
    
    return ground_mask, ground_heights
```

### 5.3 Intensity-Based Feature Extraction

LiDAR intensity reveals surface markings invisible in geometry alone:

```
Intensity features on airport pavement:
- Lane markings (paint):  Intensity 180-255 (high reflectivity)
- Concrete pavement:      Intensity 80-120
- Asphalt:                Intensity 40-80
- Metal manhole covers:   Intensity 200-255 (specular)
- Water/puddles:          Intensity 5-20 (absorption)
- Oil stains:             Intensity 20-40 (dark)
- Rubber deposits:        Intensity 30-50

Extraction:
1. Project ground points to 2D intensity image (top-down, 2cm/pixel)
2. Apply adaptive thresholding to extract markings
3. Skeletonize to get centerlines
4. Match against expected patterns (stand numbers, taxiway centerlines)
```

---

## 6. Geodetic Alignment and Ground Control

### 6.1 Coordinate System Strategy

```
Coordinate frames involved:
                                           
  LiDAR frame          SLAM frame          Map frame (ENU)        Geodetic (WGS84)
  (per-sensor)    ──>  (SLAM origin)  ──>  (airport datum)   ──>  (lat/lon/alt)
                                           
  Extrinsic calib      SLAM trajectory     GCP alignment          UTM/EPSG projection
  (from calib doc)     (FAST-LIO2)         (GTSAM optimization)   (fixed transform)
```

**Airport datum**: Every airport has a designated Aerodrome Reference Point (ARP) in WGS84. The map frame should be East-North-Up (ENU) centered at or near the ARP.

### 6.2 RTK vs PPP vs GCP Alignment

| Method | Accuracy | Cost | Setup Time | Best For |
|---|---|---|---|---|
| RTK-GPS (fixed) | ±2cm | $5-15K (base station) | 1 hour | Real-time trajectory correction |
| PPP (post-processed) | ±3-5cm | Free (IGS products) | 24hr for convergence files | Post-processing without base station |
| Total station GCPs | ±1cm | $2-5K (rental + surveyor) | 4-8 hours | Absolute ground truth anchors |
| AMDB registration | ±0.5m (AMDB accuracy) | Free (FAA data) | 1 hour | Rough initial alignment |
| Airport survey markers | ±1cm | Free (if accessible) | Varies | Ideal if airport shares data |

**Recommended combination**: RTK for trajectory + GCPs for absolute anchoring + AMDB for validation.

### 6.3 GCP-Based Map Alignment

```python
def align_slam_map_to_gcps(slam_trajectory, gcps):
    """Compute rigid transform from SLAM frame to geodetic using GCPs.
    
    Minimum 3 GCPs for 6-DOF; 10+ recommended for overdetermined solution.
    Uses Horn's method (SVD-based) for initial estimate, then GTSAM refinement.
    """
    # Extract corresponding point pairs
    slam_points = []   # GCP location in SLAM frame (nearest trajectory point)
    geo_points = []    # GCP known geodetic coordinates (ENU)
    
    for gcp in gcps:
        # Find SLAM pose nearest to this GCP
        distances = np.linalg.norm(
            slam_trajectory[:, :3] - gcp['enu_position'], axis=1
        )
        nearest_idx = np.argmin(distances)
        slam_points.append(slam_trajectory[nearest_idx, :3])
        geo_points.append(gcp['enu_position'])
    
    slam_points = np.array(slam_points)
    geo_points = np.array(geo_points)
    
    # Horn's method: SVD-based rigid body alignment
    centroid_slam = slam_points.mean(axis=0)
    centroid_geo = geo_points.mean(axis=0)
    
    H = (slam_points - centroid_slam).T @ (geo_points - centroid_geo)
    U, S, Vt = np.linalg.svd(H)
    
    R = Vt.T @ U.T
    if np.linalg.det(R) < 0:
        Vt[-1, :] *= -1
        R = Vt.T @ U.T
    
    t = centroid_geo - R @ centroid_slam
    
    # Residuals
    transformed = (R @ slam_points.T).T + t
    residuals = np.linalg.norm(transformed - geo_points, axis=1)
    
    return {
        'rotation': R,
        'translation': t,
        'mean_residual_m': residuals.mean(),
        'max_residual_m': residuals.max(),
        'per_gcp_residuals': residuals,
    }
```

### 6.4 Accuracy Validation

After alignment, validate with held-out GCPs (not used in alignment):

| Metric | Threshold | Action if Failed |
|---|---|---|
| Mean GCP residual | <5cm | Re-check GCP identification |
| Max GCP residual | <15cm | Investigate specific GCP — may be mis-identified |
| Cross-track error on taxiway centerlines | <10cm | Compare against AMDB taxiway geometries |
| Building corner alignment | <20cm | Visual check against aerial imagery |
| Consistency between sessions | <5cm | Re-run SLAM with additional loop closures |

---

## 7. AMDB Overlay and Co-Registration

### 7.1 AMDB Data Acquisition

From `hd-map-standards-airside.md`: FAA AMDB data is freely available for 500+ US airports.

```
AMDB download and parse:
1. Download AMDB shapefile from FAA NASR (28-day cycle)
2. Convert from WGS84/geographic to local ENU (same as map frame)
3. Extract relevant layers:
   - RunwayElement:      Runway outlines, thresholds
   - TaxiwayElement:     Taxiway outlines, centerlines
   - ApronElement:       Apron boundaries
   - StandGuidanceLine:  Lead-in lines for aircraft stands
   - PaintedCenterline:  Taxiway painted centerlines
   - HoldingPosition:    Hold-short lines (safety-critical)
   - ServiceRoad:        GSE service roads
   - DeicingArea:        De-icing pad boundaries
   - FrequencyArea:      ATC frequency zones
```

### 7.2 AMDB-to-Lanelet2 Feature Mapping

```
AMDB Feature                    Lanelet2 Element
─────────────────────────────────────────────────
TaxiwayElement outline     ──>  Lanelet boundary (left/right linestrings)
PaintedCenterline          ──>  Lanelet centerline
HoldingPosition            ──>  Regulatory element (traffic_sign: stop_line)
StandGuidanceLine          ──>  Lanelet (narrow, one-way, low speed limit)
ServiceRoad                ──>  Lanelet (GSE operational area)
DeicingArea                ──>  Polygon regulatory element (speed limit, caution)
RunwayElement              ──>  Geofence exclusion zone (hard constraint)
ApronElement               ──>  Area with speed limit regulatory element
```

### 7.3 Co-Registration Quality

AMDB accuracy is ±0.5m at best — the survey HD map is ±5-10cm. The AMDB provides semantic structure; the HD map provides geometric precision.

```
Co-registration strategy:
1. Feature matching: Align AMDB taxiway centerlines to intensity-extracted
   centerlines from LiDAR. Use ICP on 2D centerline points.
   
2. Affine correction: Compute per-region affine transform from AMDB to
   HD map coordinates. AMDB may have systematic 0.5-2m offset.
   
3. Snap AMDB features to HD map geometry:
   - Taxiway edges → snap to nearest curb/paint edge in point cloud
   - Centerlines → snap to intensity-extracted markings
   - Hold-short lines → snap to painted markings
   
4. Validate: Overlay on aerial imagery (Google Earth, airport ortho)
   for visual sanity check. All features should align within 0.5m.
```

---

## 8. Automated Semantic Annotation

### 8.1 Annotation Requirements

The map must be semantically labeled for planning, safety, and fleet operations:

| Feature Class | Source | Annotation Method | Priority |
|---|---|---|---|
| Taxiway surface | LiDAR + AMDB | Ground segmentation + AMDB overlay | Critical |
| Lane markings | LiDAR intensity | Adaptive threshold + skeletonization | Critical |
| Hold-short lines | LiDAR intensity + AMDB | Combined detection | Critical (safety) |
| Buildings/structures | LiDAR geometry | Height filter + plane segmentation | High |
| Bollards/signs | LiDAR geometry | Vertical pole detection | High |
| Curbs/edges | LiDAR geometry | Height discontinuity detection | High |
| Stand numbers | Camera + AMDB | OCR + AMDB cross-reference | Medium |
| Fuel hydrant covers | Camera + geometry | Object detection (SAM+CLIP) | Medium |
| Drainage grates | Camera + geometry | Object detection (manual QC) | Medium |
| Cable trenches | LiDAR intensity | Linear feature detection | Low |

### 8.2 Foundation Model-Assisted Annotation

Using SAM (Segment Anything) + CLIP for zero-shot annotation of camera images, then projecting labels onto the 3D point cloud:

```python
class AutoAnnotator:
    """Semi-automated annotation using foundation models.
    
    Pipeline:
    1. Render top-down and perspective views from point cloud
    2. Run SAM to generate mask proposals
    3. Run CLIP to classify each mask
    4. Project 2D labels back to 3D point cloud
    5. Merge with geometry-based labels (ground, poles, planes)
    6. Export for manual QC
    """
    
    # CLIP text prompts for airside features
    AIRSIDE_PROMPTS = {
        'taxiway_surface': [
            "airport taxiway pavement", "concrete runway surface",
            "asphalt airport ground"
        ],
        'lane_marking': [
            "airport taxiway centerline marking", "yellow center line paint",
            "airport ground marking"
        ],
        'hold_short_line': [
            "runway hold short marking", "double yellow dashed line",
            "hold position marking airport"
        ],
        'building': [
            "airport terminal building", "hangar structure",
            "airport building facade"
        ],
        'bollard': [
            "airport ground bollard", "reflective delineator post",
            "airport marker pole"
        ],
        'fuel_hydrant': [
            "airport fuel hydrant pit", "ground fuel access cover",
            "recessed fuel coupling"
        ],
        'fence': [
            "airport perimeter fence", "chain link security fence"
        ],
        'vehicle': [
            "ground support equipment", "airport tug",
            "baggage cart"
        ],
    }
    
    # Expected accuracy by feature class
    EXPECTED_ACCURACY = {
        'taxiway_surface': 0.95,    # High — geometry dominant
        'lane_marking': 0.90,       # High — intensity dominant
        'building': 0.92,           # High — height dominant
        'bollard': 0.85,            # Medium — small objects
        'fuel_hydrant': 0.70,       # Low — rare, needs manual QC
        'hold_short_line': 0.88,    # Medium-high — AMDB helps
        'drainage_grate': 0.60,     # Low — needs manual QC
    }
```

### 8.3 Annotation Quality Metrics

| Metric | Target | Measurement |
|---|---|---|
| Feature completeness | >95% of AMDB features identified | Count matched vs unmatched |
| Positional accuracy | <10cm for safety features | Compare to AMDB + GCPs |
| Classification accuracy | >90% for 8 primary classes | Random sample manual check |
| Hold-short line recall | 100% (safety-critical) | Manual verification required |
| False positive rate | <2% | Sample-based inspection |

### 8.4 Manual QC Integration

Automated annotation outputs a CVAT-compatible dataset for manual review:

```
Auto-annotation → CVAT project
├── Pre-labeled 3D point cloud (semantic labels)
├── Pre-labeled 2D images (SAM masks + CLIP labels)
├── Confidence scores per label (flag low-confidence for review)
├── AMDB cross-reference (highlight discrepancies)
└── Annotation guide (airside feature taxonomy)

Manual QC focus areas (by priority):
1. Hold-short lines: Must be 100% correct. Any miss is safety-critical.
2. Stand numbering: Must match AIP/AMDB. Wrong stand = wrong destination.
3. Fuel hydrant locations: Must be accurate for docking.
4. Unlabeled objects: Review all "unknown" segments.
5. Boundary accuracy: Taxiway edges, apron limits.

Estimated manual QC time: 4-8 hours for typical airport
```

---

## 9. Lanelet2 Map Generation

### 9.1 Lanelet2 Structure for Airside

From `hd-map-standards-airside.md`, Lanelet2 is the recommended map format for the Frenet planner:

```xml
<!-- Airside Lanelet2 elements -->
<lanelet2>
  <!-- Taxiway segment -->
  <lanelet id="101" type="taxiway" subtype="service_road">
    <leftBound>  <lineString id="201" ... /> </leftBound>
    <rightBound> <lineString id="202" ... /> </rightBound>
    <centerline> <lineString id="203" ... /> </centerline>
    <regulatoryElement ref="301" />  <!-- speed limit -->
    <regulatoryElement ref="302" />  <!-- right of way -->
  </lanelet>
  
  <!-- Aircraft stand lead-in -->
  <lanelet id="102" type="stand_approach" subtype="lead_in">
    <attributes>
      <tag k="stand_id" v="B12" />
      <tag k="aircraft_types" v="A320,B737" />
      <tag k="max_speed_kmh" v="5" />
    </attributes>
  </lanelet>
  
  <!-- Regulatory elements -->
  <regulatoryElement id="301" type="speed_limit">
    <tag k="speed_kmh" v="25" />
  </regulatoryElement>
  
  <regulatoryElement id="302" type="hold_short">
    <tag k="runway" v="09L/27R" />
    <tag k="clearance_required" v="true" />
    <refers> <lineString id="401" /> </refers>  <!-- hold-short line -->
  </regulatoryElement>
</lanelet2>
```

### 9.2 Automated Lanelet2 Generation

```python
class Lanelet2Generator:
    """Generate Lanelet2 map from annotated point cloud + AMDB.
    
    Strategy:
    1. AMDB provides taxiway topology (which connects to which)
    2. LiDAR intensity provides precise centerlines and edges
    3. Combine: AMDB topology + LiDAR geometry = accurate Lanelet2
    """
    
    def generate(self, annotated_cloud, amdb_features, survey_metadata):
        lanelets = []
        
        # Step 1: Extract centerlines from intensity markings
        centerlines = self.extract_centerlines_from_intensity(
            annotated_cloud, paint_threshold=160
        )
        
        # Step 2: Extract edges from geometric discontinuities
        edges = self.extract_edges_from_geometry(
            annotated_cloud, curb_height_min=0.03, curb_height_max=0.15
        )
        
        # Step 3: Match AMDB taxiway segments to extracted centerlines
        for amdb_segment in amdb_features['taxiway_segments']:
            # Find best matching extracted centerline
            matched_cl = self.match_centerline(
                amdb_segment['centerline'], centerlines, max_dist=2.0
            )
            
            if matched_cl is not None:
                # Use LiDAR-extracted centerline (more accurate)
                centerline = matched_cl
            else:
                # Fall back to AMDB centerline (snap to surface)
                centerline = self.snap_to_ground(amdb_segment['centerline'])
            
            # Find left and right boundaries
            left_edge = self.find_nearest_edge(centerline, edges, side='left')
            right_edge = self.find_nearest_edge(centerline, edges, side='right')
            
            # If no physical edges detected, use AMDB width
            if left_edge is None:
                left_edge = self.offset_centerline(
                    centerline, -amdb_segment['width'] / 2
                )
            if right_edge is None:
                right_edge = self.offset_centerline(
                    centerline, +amdb_segment['width'] / 2
                )
            
            # Create Lanelet2 lanelet
            lanelet = Lanelet(
                id=self.next_id(),
                left_bound=left_edge,
                right_bound=right_edge,
                centerline=centerline,
                attributes={
                    'type': 'taxiway',
                    'subtype': amdb_segment.get('surface_type', 'concrete'),
                    'amdb_id': amdb_segment['id'],
                    'speed_limit_kmh': self.infer_speed_limit(amdb_segment),
                }
            )
            lanelets.append(lanelet)
        
        # Step 4: Add regulatory elements
        self.add_hold_short_lines(lanelets, amdb_features['holding_positions'])
        self.add_speed_zones(lanelets, amdb_features['speed_restrictions'])
        self.add_right_of_way(lanelets, amdb_features['intersections'])
        
        # Step 5: Build topology (predecessor/successor/adjacent)
        self.build_topology(lanelets)
        
        # Step 6: Generate routing graph
        routing_graph = self.build_routing_graph(lanelets)
        
        return Lanelet2Map(lanelets, routing_graph)
```

### 9.3 Occupancy Grid Generation

Alongside Lanelet2, generate a 2D/3D occupancy grid for planning and safety:

```
Occupancy grid layers:
├── ground_traversability.pgm    — Binary: drivable vs obstacle (2cm/pixel)
├── elevation_map.tif            — Float32: ground height (5cm/pixel)
├── intensity_map.pgm            — Uint8: LiDAR intensity (2cm/pixel)
├── semantic_map.pgm             — Uint8: semantic class per pixel
├── sdf_map.npy                  — Float32: signed distance field (5cm/pixel)
└── metadata.yaml                — Resolution, origin, coordinate frame, checksum
```

The SDF (Signed Distance Field) is particularly valuable for CBF safety filtering — it provides the distance to nearest obstacle at any point, enabling gradient-based trajectory optimization.

---

## 10. Quality Assurance and Validation

### 10.1 Automated Validation Checks

```python
class MapValidator:
    """Automated quality checks for constructed HD map."""
    
    CHECKS = [
        # Geometric checks
        ("global_accuracy", "GCP residuals < 10cm", "CRITICAL"),
        ("local_consistency", "Submap alignment < 5cm", "CRITICAL"),
        ("coverage", ">95% of AMDB features covered", "HIGH"),
        ("point_density", ">100 pts/m² in operational areas", "MEDIUM"),
        ("ground_flatness", "Ground height variation < 5cm per cell", "MEDIUM"),
        
        # Topological checks
        ("connectivity", "All lanelets reachable from entry", "CRITICAL"),
        ("dead_ends", "No unexpected dead-end lanelets", "HIGH"),
        ("routing", "Route exists between all stand pairs", "HIGH"),
        ("lane_width", "All lanelets width > 3m (vehicle + margin)", "HIGH"),
        
        # Safety checks
        ("hold_short_complete", "100% hold-short lines present", "CRITICAL"),
        ("geofence_closed", "Runway geofences form closed polygons", "CRITICAL"),
        ("speed_limits", "All lanelets have speed limits", "MEDIUM"),
        ("stand_templates", "All operational stands have docking templates", "HIGH"),
        
        # Semantic checks
        ("amdb_consistency", "Lanelet topology matches AMDB", "HIGH"),
        ("stand_ids", "All stand IDs match AIP/AMDB", "CRITICAL"),
        ("surface_types", "Surface classification complete", "MEDIUM"),
        
        # Format checks
        ("lanelet2_valid", "Lanelet2 schema validation passes", "CRITICAL"),
        ("coordinate_frame", "CRS matches airport ENU datum", "CRITICAL"),
        ("file_checksums", "All map files have valid checksums", "HIGH"),
    ]
    
    def validate(self, map_package):
        results = []
        for check_name, description, severity in self.CHECKS:
            method = getattr(self, f'check_{check_name}')
            passed, details = method(map_package)
            results.append({
                'check': check_name,
                'description': description,
                'severity': severity,
                'passed': passed,
                'details': details,
            })
        
        critical_failures = [r for r in results 
                           if not r['passed'] and r['severity'] == 'CRITICAL']
        
        return {
            'passed': len(critical_failures) == 0,
            'results': results,
            'critical_failures': critical_failures,
            'summary': f"{sum(r['passed'] for r in results)}/{len(results)} checks passed"
        }
```

### 10.2 Human Review Process

Automated checks catch structural issues. Human review catches semantic issues:

```
Human review checklist:
□ Overlay map on recent aerial imagery — do features align?
□ Drive simulated route through every operational stand — any missing connections?
□ Verify all hold-short lines against AIP (Aeronautical Information Publication)
□ Check stand IDs match gate assignments in airport AODB
□ Verify speed zones match airport ground traffic rules
□ Review right-of-way priorities at intersections
□ Check de-icing areas and fuel farm boundaries
□ Verify emergency access routes are mapped and routable
□ Sign-off from airport operations stakeholder (if required)

Time: 2-4 hours with experienced operator
Sign-off: Map engineer + operations lead
```

### 10.3 Regression Testing Against Operational Data

If the airport has existing operational data (from shadow mode or teleoperation), validate the new map against it:

```
1. Replay operational rosbags through localization stack with new map
2. Verify GTSAM convergence (should improve vs old map)
3. Check Frenet planner generates valid trajectories on new map
4. Verify geofence compliance — no operational paths cross restricted zones
5. Compare localization accuracy with old vs new map (expecting improvement)
```

---

## 11. Map Packaging and Deployment

### 11.1 Map Package Structure

```
airport-LHR-T5-v2.3.1/
├── manifest.yaml           — Version, airport, coverage, checksums, dependencies
├── lanelet2/
│   ├── map.osm             — Lanelet2 map (primary planning format)
│   ├── routing_graph.json  — Pre-computed routing graph
│   └── regulatory.yaml     — Speed limits, right-of-way, hold-short
├── pointcloud/
│   ├── survey_map.pcd      — Full 3D survey (L1, 0.05m voxels, ~500MB)
│   ├── localization_map.pcd — Decimated for VGICP (0.1m voxels, ~100MB)
│   └── docking_templates/  — Per-stand high-res clouds (0.02m, ~5MB each)
├── grids/
│   ├── occupancy_2d.pgm    — 2D traversability (2cm/pixel)
│   ├── elevation.tif        — Ground elevation (5cm/pixel)
│   ├── sdf.npy              — Signed distance field (5cm/pixel)
│   └── intensity.pgm        — LiDAR intensity (2cm/pixel)
├── geofence/
│   ├── runway_exclusion.geojson — Runway protection zones
│   ├── safety_zones.geojson     — Jet blast, de-icing, fuel areas
│   └── operational_boundary.geojson — Overall operational geofence
├── metadata/
│   ├── coordinate_frame.yaml — CRS definition, ENU origin, datum
│   ├── gcps.csv              — Ground control points used
│   ├── survey_log.yaml       — Survey dates, conditions, sessions
│   ├── amdb_version.yaml     — AMDB source version and AIRAC cycle
│   └── validation_report.json — Automated QA results
└── CHANGELOG.md              — Version history
```

### 11.2 Map Versioning

Semantic versioning adapted for maps:

```
MAJOR.MINOR.PATCH

MAJOR: Topology change (new taxiway, closed area, rerouted path)
       → Requires route re-planning, may invalidate missions
       
MINOR: Geometry refinement, new annotations, accuracy improvement
       → Transparent to planning, improves localization
       
PATCH: Metadata update, config change, bug fix in non-critical layer
       → No operational impact

Examples:
v1.0.0 — Initial airport map
v1.1.0 — Added fuel farm area, improved stand 12-18 geometry
v1.1.1 — Fixed stand B14 ID typo
v2.0.0 — New taxiway Foxtrot opened (topology change)
```

### 11.3 OTA Map Deployment

```
Deployment pipeline:
1. Map built and validated (this document)
2. Map uploaded to cloud storage (S3/MinIO via DVC)
3. Canary deployment: Push to 1 vehicle, monitor for 2 hours
   - GTSAM convergence within expected bounds?
   - Frenet planner generating valid trajectories?
   - No geofence violations on known-good routes?
4. Fleet-wide deployment: Push to all vehicles at next depot visit
5. Rollback: Atomic swap to previous map version if issues detected

Map update size optimization:
- Full map package: 500-800 MB
- Delta update (geometry only): 10-50 MB
- Metadata only: <1 MB
- Via airport WiFi at depot: 5-10 minutes for full map
```

---

## 12. Version Control and CI/CD for Maps

### 12.1 DVC for Map Data

From `cloud-backend-infrastructure.md`, DVC (Data Version Control) manages large map files alongside code:

```yaml
# dvc.yaml — Map construction pipeline
stages:
  slam_processing:
    cmd: python scripts/run_slam.py --config ${config} --bags ${bags_dir}
    deps:
      - scripts/run_slam.py
      - ${bags_dir}
    outs:
      - data/slam_output/trajectories/
      - data/slam_output/submaps/
    params:
      - slam.voxel_size
      - slam.max_iterations
  
  merge_and_align:
    cmd: python scripts/merge_sessions.py --gcps ${gcps_file}
    deps:
      - scripts/merge_sessions.py
      - data/slam_output/
      - ${gcps_file}
    outs:
      - data/aligned_map/merged.pcd
      - data/aligned_map/alignment_report.json
  
  annotate:
    cmd: python scripts/auto_annotate.py --amdb ${amdb_dir}
    deps:
      - scripts/auto_annotate.py
      - data/aligned_map/merged.pcd
      - ${amdb_dir}
    outs:
      - data/annotated/semantic_cloud.pcd
      - data/annotated/auto_labels.json
  
  generate_lanelet2:
    cmd: python scripts/generate_lanelet2.py
    deps:
      - scripts/generate_lanelet2.py
      - data/annotated/
    outs:
      - data/map_package/lanelet2/map.osm
      - data/map_package/grids/
  
  validate:
    cmd: python scripts/validate_map.py
    deps:
      - scripts/validate_map.py
      - data/map_package/
    metrics:
      - data/validation_report.json
```

### 12.2 Map CI Pipeline

```yaml
# .github/workflows/map-ci.yaml
name: Map Validation CI
on:
  push:
    paths: ['maps/**', 'scripts/map_*']
  pull_request:
    paths: ['maps/**']

jobs:
  validate-map:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Pull map data
        run: dvc pull maps/
      - name: Schema validation
        run: python scripts/validate_lanelet2_schema.py maps/*/lanelet2/map.osm
      - name: Topology checks
        run: python scripts/check_topology.py maps/*/lanelet2/map.osm
      - name: Geofence validation
        run: python scripts/validate_geofences.py maps/*/geofence/
      - name: Regression test (if operational data exists)
        run: python scripts/map_regression.py --map maps/*/ --bags test_bags/
      - name: Generate validation report
        run: python scripts/generate_report.py > validation_report.md
```

---

## 13. Tools and Software Ecosystem

### 13.1 SLAM and Processing Tools

| Tool | Role | License | Maturity | Airside Notes |
|---|---|---|---|---|
| **FAST-LIO2** | Primary SLAM | GPL-2.0 | Production | Best LiDAR-inertial accuracy |
| **LIO-SAM** | Alternative SLAM | BSD-3 | Production | Better loop closure support |
| **KISS-ICP** | Validation SLAM | MIT | Production | No IMU needed — independent check |
| **GTSAM** | Graph optimization | BSD | Production | Already in Aurrigo stack |
| **Open3D** | Point cloud processing | MIT | Production | Python API, GPU-accelerated |
| **PCL** | Point cloud processing | BSD | Production | C++ native, ROS integration |
| **CloudCompare** | Visualization + manual edit | GPL-2.0 | Production | Essential for QC |
| **PDAL** | Point cloud pipelines | BSD | Production | Format conversion, filtering |

### 13.2 Annotation and Mapping Tools

| Tool | Role | License | Cost | Notes |
|---|---|---|---|---|
| **CVAT** | 2D/3D annotation | MIT | Free | Self-hosted, supports LiDAR |
| **Label Studio** | Multi-modal annotation | Apache-2.0 | Free | ML-assisted pre-labeling |
| **JOSM** | OSM/Lanelet2 editing | GPL-2.0 | Free | Lanelet2 plugin available |
| **SAM (Meta)** | Zero-shot segmentation | Apache-2.0 | Free | Foundation model for auto-annotation |
| **CLIP (OpenAI)** | Zero-shot classification | MIT | Free | Classify SAM masks |
| **Mapillary** | Street-level imagery tools | — | Free tier | Useful for camera-based mapping |
| **QGIS** | GIS visualization | GPL-2.0 | Free | AMDB overlay, geofence editing |

### 13.3 Industry Mapping Platforms (Commercial)

| Platform | What It Does | Cost | Relevance |
|---|---|---|---|
| **Carmera/Woven** | Fleet-sourced map updates | Enterprise | Road-focused, not airside |
| **Civil Maps** | Crowdsourced HD mapping | Enterprise | Lightweight map approach |
| **Momenta** | Map construction + ML | Enterprise | Full pipeline, China-focused |
| **DeepMap (NVIDIA)** | Survey → HD map pipeline | Enterprise | Acquired by NVIDIA, integrated in DRIVE |
| **Atlatec** | Manual HD map creation | $10-50K/km | High-accuracy, labor-intensive |
| **TomTom/HERE** | Map maintenance | Enterprise | Road networks only |

**No commercial platform covers airside mapping.** The pipeline described here is purpose-built.

---

## 14. Cost and Time Estimates

### 14.1 Per-Airport Cost Breakdown

| Phase | First Airport | Additional Airport (same cluster) | Additional Airport (different cluster) |
|---|---|---|---|
| Survey equipment setup | $5-10K (one-time) | — | — |
| GCP survey (total station) | $3-5K | $3-5K | $3-5K |
| Survey drives (vehicle + operator) | $2-3K | $2-3K | $2-3K |
| SLAM processing (compute) | $0.5-1K | $0.5-1K | $0.5-1K |
| Auto-annotation (compute + models) | $0.5-1K | $0.5-1K | $0.5-1K |
| Manual QC (annotator hours) | $3-5K | $2-3K | $3-5K |
| Lanelet2 generation + validation | $3-5K | $2-3K | $3-5K |
| Map packaging + deployment | $1-2K | $0.5-1K | $1-2K |
| **Total** | **$18-32K** | **$11-18K** | **$14-23K** |

### 14.2 Timeline

```
Week 1: Airport access + GCP survey + survey drives
         ├── Day 1-2: GCP placement and survey (total station)
         ├── Day 3: Vehicle prep, sensor checks, RTK base station
         ├── Day 4-5: Survey drives (3-5 systematic laps)
         
Week 2: Processing + annotation
         ├── Day 1-2: SLAM processing, map merging, alignment
         ├── Day 3: Auto-annotation, AMDB overlay
         ├── Day 4-5: Manual QC, Lanelet2 generation
         
Week 3: Validation + deployment (can overlap with Week 2)
         ├── Day 1-2: Automated validation, regression tests
         ├── Day 3: Human review, sign-off
         ├── Day 4: Map packaging, canary deployment
         ├── Day 5: Fleet-wide deployment, monitoring

Total: 10-15 working days first airport
       5-10 working days additional airports (tooling reuse)
```

### 14.3 Scaling Economics

| Metric | 1 Airport | 5 Airports | 20 Airports |
|---|---|---|---|
| Total map construction cost | $25-35K | $75-110K | $240-380K |
| Per-airport average | $25-35K | $15-22K | $12-19K |
| Time per airport | 3 weeks | 2 weeks | 1.5 weeks |
| Tooling development (amortized) | $40-60K | $8-12K | $2-3K |
| Annual maintenance (fleet-based) | $5-10K | $25-50K | $80-150K |

The per-airport cost drops ~40% from airport 1 to airport 5, and ~50% by airport 20, primarily from tooling amortization and operator experience. Fleet-based change detection (`hd-map-change-detection-maintenance.md`) further reduces annual maintenance by 60-80%.

---

## 15. Industry Approaches

### 15.1 How Competitors Build Maps

| Company | Approach | Map Type | Cost/Airport | Time |
|---|---|---|---|---|
| **UISEE** | Manual survey + proprietary SLAM | Proprietary HD | Unknown (China-based pricing) | 2-4 weeks |
| **TractEasy** | Pre-mapped routes + RTK corrections | Route-based (not full HD) | Est. $10-20K | 1-2 weeks |
| **AeroVect** | "Mapped half of top 10 US airports" — likely LiDAR SLAM + manual annotation | HD + semantic | Unknown | Unknown |
| **Waymo** | Custom survey vehicles + DeepMap pipeline | Multi-layer HD | $50-100K+/area | 4-6 weeks |
| **Apollo (Baidu)** | SLAM + crowdsourced + neural priors | Layered HD | $20-40K/area | 2-4 weeks |
| **Autoware** | Open-source (Lanelet2 + manual JOSM editing) | Lanelet2 | $10-30K (labor) | 2-4 weeks |

### 15.2 Key Differentiators for Aurrigo

1. **AMDB bootstrap**: Free FAA data for 500+ US airports eliminates 60-70% of topology creation cost. No competitor publishes AMDB integration.

2. **Multi-LiDAR advantage**: 4-8 RoboSense LiDARs provide 360° coverage at higher density than single-LiDAR survey vehicles, reducing required passes.

3. **Existing GTSAM stack**: The production localization stack doubles as the map construction backend — no separate mapping system needed.

4. **Fleet-based maintenance**: Once deployed, every operational vehicle continuously validates and refines the map. Competitors with single-operator teleoperation don't have fleet data.

5. **7-layer architecture**: Most competitors use flat 2D maps or single-layer point clouds. The layered approach supports incremental updates without full re-mapping.

---

## 16. Key Takeaways

1. **5-7 working days per airport at $20-35K**: Achievable with the pipeline described here. The bottleneck is annotation QC, not data collection or SLAM processing.

2. **FAST-LIO2 + GTSAM + GCPs achieves ±5-10cm global accuracy**: Sufficient for Frenet planning (needs ±10cm), GTSAM localization (needs ±5cm), and CBF safety (needs ±20cm).

3. **Multi-session consistency voting removes dynamic objects**: No need to survey an empty airport. 3-5 passes from different times naturally separate static from dynamic features.

4. **AMDB provides free topology for 500+ US airports**: Combined with LiDAR-extracted geometry, this eliminates manual topology creation — the most labor-intensive annotation step.

5. **Foundation models (SAM + CLIP) achieve 85-92% auto-annotation accuracy**: Manual QC still required for safety-critical features (hold-short lines) and rare classes (fuel hydrants, drainage grates).

6. **Map CI/CD prevents regression**: DVC version control + automated validation + canary deployment ensures map updates don't break operational vehicles.

7. **Per-airport cost drops ~50% by airport 20**: Tooling amortization and operator learning curves compound. Each airport makes the next one cheaper.

8. **No complete open-source airside map construction pipeline exists**: This is infrastructure that compounds — each airport deployed adds to the moat.

9. **Fleet-based change detection reduces annual maintenance cost by 60-80%**: Vehicles as continuous mapping sensors vs quarterly manual re-survey.

10. **The 7-layer map architecture supports incremental updates**: Only rebuild the layer that changed. AIRAC updates affect L0, fleet corrections affect L2, semantic changes affect L3.

---

## 17. References

### 17.1 SLAM and Registration

1. Xu, W., & Zhang, F. (2022). "FAST-LIO2: Fast Direct LiDAR-Inertial Odometry." IEEE T-RO.
2. Vizzo, I., et al. (2023). "KISS-ICP: In Defense of Point-to-Point ICP." IEEE RA-L.
3. Shan, T., et al. (2020). "LIO-SAM: Tightly-coupled Lidar Inertial Odometry via Smoothing and Mapping." IROS.
4. Dellaert, F. (2012). "Factor Graphs and GTSAM: A Hands-On Introduction." Georgia Tech.

### 17.2 Map Standards and Formats

5. FAA. "Aerodrome Mapping Database (AMDB)." NASR data products.
6. Poggenhans, F., et al. (2018). "Lanelet2: A High-Definition Map Framework for the Future of Automated Driving." IEEE ITSC.
7. EUROCAE ED-119C / RTCA DO-272D. "Interchange Standards for Terrain, Obstacle, and Aerodrome Mapping Data."

### 17.3 Annotation and Foundation Models

8. Kirillov, A., et al. (2023). "Segment Anything." ICCV.
9. Radford, A., et al. (2021). "Learning Transferable Visual Models From Natural Language Supervision." ICML.
10. Zhou, B., et al. (2019). "Semantic Understanding of Scenes through the ADE20K Dataset." IJCV.

### 17.4 Map Construction Pipelines

11. Yang, B., et al. (2023). "MapTRv2: An End-to-End Framework for Online Vectorized HD Map Construction." IJCV.
12. Xie, Z., et al. (2024). "MapTracker: Tracking with Strided Memory Fusion for Consistent Vector HD Mapping." ECCV.
13. Xiong, X., et al. (2023). "Neural Map Prior for Autonomous Driving." CVPR.
14. Wen, L., et al. (2024). "RTMap: Real-Time Recursive Map Maintenance." ICCV.

### 17.5 Quality and Validation

15. ISO 19157:2023. "Geographic information — Data quality."
16. ASPRS. "Positional Accuracy Standards for Digital Geospatial Data."
17. Tao, Z., et al. (2023). "HD Map Quality Assessment for Autonomous Driving." IEEE IV.

### 17.6 Internal Cross-References

- `../overview/lidar-slam-algorithms.md` — SLAM algorithm details (KISS-ICP, LIO-SAM, FAST-LIO2)
- `hd-map-standards-airside.md` — Format standards (AMDB, Lanelet2, OpenDRIVE)
- `hd-map-change-detection-maintenance.md` — Fleet-based map maintenance
- `neural-online-mapping-sota.md` — Online neural mapping methods
- `semantic-mapping-learned-priors.md` — Neural Map Prior, PriorDrive, topology graphs
- `../overview/lidar-place-recognition-relocalization.md` — Loop closure and place recognition
- `../overview/robust-state-estimation-multi-sensor.md` — ESKF, GTSAM factor graph
- `cloud-backend-infrastructure.md` — Data storage, DVC, Airflow pipelines
- `multi-lidar-extrinsic-calibration.md` — Sensor calibration for multi-LiDAR mapping
- `realtime-occupancy-grid-mapping.md` — Occupancy grid generation
