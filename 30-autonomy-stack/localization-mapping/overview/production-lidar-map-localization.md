# Production LiDAR-to-Map Localization Pipeline for Airside Autonomous Vehicles

LiDAR-to-map localization is the runtime process of determining a vehicle's precise pose by aligning live LiDAR scans against a pre-built reference map. This is distinct from SLAM (which builds the map) and from state estimation (which fuses multiple sensor sources into a coherent ego-state). For Aurrigo's airside GSE fleet running GTSAM + GPU VGICP on NVIDIA Orin with 4-8 RoboSense LiDARs, the scan-to-map matching module is the single largest contributor to localization accuracy during normal operation — it provides the position "anchor" that prevents dead-reckoning drift from accumulating. This document covers the complete production pipeline: reference map representation and management, scan preprocessing for matching, registration algorithms (ICP variants, NDT, feature-based, and learned methods), degenerate geometry detection and handling, multi-LiDAR fusion strategies for scan-to-map, GTSAM factor graph integration, fallback behaviors when matching degrades, and Orin deployment with real-time budgets. The existing repository covers offline map construction (`../maps/map-construction-pipeline.md`), SLAM algorithms for building maps (`lidar-slam-algorithms.md`), state estimation fusion (`robust-state-estimation-multi-sensor.md`), place recognition for re-localization (`lidar-place-recognition-relocalization.md`), and map change detection (`../maps/hd-map-change-detection-maintenance.md`). This document fills the gap between map construction and state estimation: the runtime scan-matching engine that converts a raw LiDAR sweep into a 6-DoF pose measurement with calibrated uncertainty, suitable for factor graph integration. The key finding: GPU-accelerated VGICP with multi-resolution coarse-to-fine matching, adaptive voxel sizing, and eigenvalue-based degeneracy detection achieves ±5-10 cm translational and ±0.1° rotational accuracy at 15-25 ms per scan on Orin — well within the 50 ms localization budget — while gracefully degrading through NDT fallback and eventually dead-reckoning when geometric structure is insufficient.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Reference Map Representation](#2-reference-map-representation)
3. [Live Scan Preprocessing](#3-live-scan-preprocessing)
4. [ICP-Family Registration](#4-icp-family-registration)
5. [Normal Distributions Transform (NDT)](#5-normal-distributions-transform-ndt)
6. [Feature-Based Scan Matching](#6-feature-based-scan-matching)
7. [Learned Registration Methods](#7-learned-registration-methods)
8. [Multi-Resolution Coarse-to-Fine Matching](#8-multi-resolution-coarse-to-fine-matching)
9. [Degenerate Geometry Detection and Handling](#9-degenerate-geometry-detection-and-handling)
10. [Multi-LiDAR Scan-to-Map Fusion](#10-multi-lidar-scan-to-map-fusion)
11. [GTSAM Factor Graph Integration](#11-gtsam-factor-graph-integration)
12. [Airside-Specific Challenges](#12-airside-specific-challenges)
13. [Fallback Hierarchy and Graceful Degradation](#13-fallback-hierarchy-and-graceful-degradation)
14. [Orin Deployment and Real-Time Budgets](#14-orin-deployment-and-real-time-budgets)
15. [Non-AI Classical Methods Comparison](#15-non-ai-classical-methods-comparison)
16. [AI-Based and Hybrid Methods](#16-ai-based-and-hybrid-methods)
17. [End-to-End Pipeline Integration](#17-end-to-end-pipeline-integration)
18. [Monitoring, Diagnostics, and Certification](#18-monitoring-diagnostics-and-certification)
19. [Cost and Implementation Roadmap](#19-cost-and-implementation-roadmap)
20. [Key Takeaways](#20-key-takeaways)
21. [References](#21-references)

---

## 1. Architecture Overview

### 1.1 Where Scan-to-Map Fits in the Localization Stack

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LOCALIZATION ARCHITECTURE                        │
│                                                                     │
│  ┌──────────┐   ┌──────────────────┐   ┌────────────────────────┐  │
│  │ IMU 500Hz│──▶│  ESKF Prediction  │──▶│  High-Rate Pose Output │  │
│  │          │   │  (0.5ms/update)   │   │  200 Hz to control     │  │
│  └──────────┘   └────────┬─────────┘   └────────────────────────┘  │
│                          │ ▲                                        │
│                          │ │ Correction factors                     │
│                          ▼ │                                        │
│  ┌──────────┐   ┌────────────────────┐                             │
│  │ RTK-GPS  │──▶│  GTSAM Factor      │                             │
│  │ 10 Hz    │   │  Graph Backend     │◀──── Loop closure factors   │
│  └──────────┘   │  (ISAM2)           │      (place recognition)    │
│                 │                    │                              │
│  ┌──────────┐   │  ┌──────────────┐  │                             │
│  │ Wheel    │──▶│  │ Odometry     │  │                             │
│  │ Encoders │   │  │ Factors      │  │                             │
│  └──────────┘   │  └──────────────┘  │                             │
│                 │                    │                             │
│  ┌──────────┐   │  ┌──────────────┐  │                             │
│  │ 4-8      │──▶│  │ SCAN-TO-MAP  │◀─┼──── THIS DOCUMENT          │
│  │ RoboSense│   │  │ FACTORS      │  │                             │
│  │ LiDARs   │   │  │ (10 Hz)      │  │                             │
│  └──────────┘   │  └──────────────┘  │                             │
│                 └────────────────────┘                             │
└─────────────────────────────────────────────────────────────────────┘
```

The scan-to-map module consumes:
- **Input**: Merged/individual LiDAR point clouds (10 Hz, 300K-1.2M points per cycle)
- **Input**: Current best pose estimate from ESKF (as initial guess for registration)
- **Input**: Reference map (pre-built, stored on NVMe, loaded into GPU memory)

And produces:
- **Output**: 6-DoF relative pose (T_map_to_scan) with covariance estimate
- **Output**: Registration quality metrics (fitness score, eigenvalue ratios, convergence info)
- **Output**: GTSAM factor for insertion into the factor graph

### 1.2 Timing Budget

```
Total localization cycle: 100 ms (10 Hz LiDAR rate)
├── Scan preprocessing:         3-5 ms
├── Scan-to-map registration:  15-25 ms  ◀── Primary budget consumer
├── GTSAM ISAM2 update:         2-5 ms
├── ESKF correction:            0.5 ms
├── Quality assessment:         1-2 ms
└── Margin/overhead:           62-78 ms  (shared with perception pipeline)
```

At 10 Hz LiDAR rate, the entire scan-to-map pipeline must complete within ~30 ms to leave headroom for perception. The 15-25 ms registration target is achievable with GPU-accelerated methods on Orin.

### 1.3 Design Principles

1. **Accuracy first, speed second** — At airside speeds (1-25 km/h), 10 Hz updates are sufficient. Better to get ±5 cm accuracy at 10 Hz than ±15 cm at 50 Hz
2. **Calibrated uncertainty** — The covariance estimate from registration MUST be honest. Overconfident estimates corrupt the GTSAM graph. Underconfident estimates waste safety margin
3. **Graceful degradation** — When scan-to-map fails, the system must detect this and fall back smoothly through NDT, odometry-only, and finally safe stop
4. **Deterministic on Orin** — No dynamic memory allocation in the hot path. Pre-allocated GPU buffers. Bounded worst-case execution time

---

## 2. Reference Map Representation

### 2.1 Map Data Structures for Scan Matching

The reference map must support fast nearest-neighbor queries from millions of map points. Three primary representations are used in production:

#### Voxelized Point Cloud (VoxelMap)

```
┌────────────────────────────────────────────────┐
│              VOXELIZED MAP STRUCTURE            │
│                                                  │
│  Spatial Hash Map: O(1) voxel lookup            │
│  ┌─────┐ ┌─────┐ ┌─────┐                       │
│  │V(0,0)│ │V(1,0)│ │V(2,0)│  Each voxel stores: │
│  │ •••  │ │ ••   │ │ •    │  - Points (≤20)     │
│  │ ••   │ │ •••• │ │ ••   │  - Normal vector     │
│  │ •    │ │ •    │ │      │  - Covariance (3×3)  │
│  └─────┘ └─────┘ └─────┘  - Point count        │
│  ┌─────┐ ┌─────┐ ┌─────┐                       │
│  │V(0,1)│ │V(1,1)│ │V(2,1)│  Voxel size:        │
│  │ •    │ │ •••• │ │ ••   │  0.2-0.5m for dense  │
│  │ ••   │ │ •••  │ │ •    │  0.5-1.0m for coarse │
│  └─────┘ └─────┘ └─────┘                       │
└────────────────────────────────────────────────┘
```

The VoxelMap is the optimal structure for VGICP on Orin:

```cpp
struct Voxel {
    Eigen::Vector3f centroid;           // Mean position
    Eigen::Matrix3f covariance;         // Point distribution covariance (for GICP)
    Eigen::Vector3f normal;             // Surface normal (principal eigenvector)
    uint16_t point_count;               // Number of contributing points
    uint8_t  semantic_label;            // Optional: ground, building, infrastructure
    uint8_t  stability_score;           // 0-255, how stable over time (from fleet)
};

// Spatial hash for O(1) lookup
struct VoxelKey {
    int32_t x, y, z;
    
    bool operator==(const VoxelKey& other) const {
        return x == other.x && y == other.y && z == other.z;
    }
};

struct VoxelKeyHash {
    size_t operator()(const VoxelKey& k) const {
        // FNV-1a hash for spatial keys
        size_t h = 2166136261u;
        h = (h ^ static_cast<size_t>(k.x)) * 16777619u;
        h = (h ^ static_cast<size_t>(k.y)) * 16777619u;
        h = (h ^ static_cast<size_t>(k.z)) * 16777619u;
        return h;
    }
};

using VoxelMap = std::unordered_map<VoxelKey, Voxel, VoxelKeyHash>;
```

**Memory budget for typical airport (200m × 500m apron)**:
- At 0.3m voxel resolution: ~3.7M occupied voxels
- Per voxel: 3×4 + 9×4 + 3×4 + 2 + 1 + 1 = 64 bytes
- Total: ~237 MB — fits comfortably in Orin's 32 GB shared memory
- With multi-resolution (0.2m near, 0.5m far): ~150 MB

#### NDT Grid (for NDT matching)

The NDT representation discretizes space into cells, each storing a Gaussian distribution:

```cpp
struct NDTCell {
    Eigen::Vector3d mean;               // Cell center of mass
    Eigen::Matrix3d covariance;         // Point distribution in cell
    Eigen::Matrix3d inverse_covariance; // Pre-computed for matching
    double num_points;                  // Weight
    bool valid;                         // Sufficient points for Gaussian
};

struct NDTGrid {
    double cell_size;                   // Typically 1.0-2.0m
    std::unordered_map<VoxelKey, NDTCell, VoxelKeyHash> cells;
    
    // Multi-resolution: coarse (2.0m) + fine (0.5m)
    // Coarse for initial alignment, fine for refinement
};
```

**Memory**: NDT cells are larger (104 bytes each) but fewer cells needed (1-2m resolution). Typical airport: ~50K cells = ~5 MB. Much lighter than voxel maps.

#### KD-Tree (for point-to-point ICP)

```cpp
// nanoflann-based KD-tree for fast nearest-neighbor
// Used as fallback when voxel hash has poor distribution
#include <nanoflann.hpp>

struct MapPointCloud {
    std::vector<Eigen::Vector3f> points;
    std::vector<Eigen::Vector3f> normals;  // Pre-computed surface normals
    
    inline size_t kdtree_get_point_count() const { return points.size(); }
    inline float kdtree_get_pt(size_t idx, size_t dim) const { 
        return points[idx][dim]; 
    }
};

using KDTree = nanoflann::KDTreeSingleIndexAdaptor<
    nanoflann::L2_Simple_Adaptor<float, MapPointCloud>,
    MapPointCloud, 3>;
```

**Memory**: Raw points + KD-tree overhead. For 5M map points: ~80 MB points + ~40 MB tree = ~120 MB.

### 2.2 Map Loading and Tile Management

For runtime, only the tiles surrounding the vehicle's current position need to be in GPU memory:

```python
class MapTileManager:
    """Manages map tile loading/unloading for scan-to-map matching."""
    
    def __init__(self, tile_size=100.0, preload_radius=200.0, 
                 map_dir="/data/maps/current"):
        self.tile_size = tile_size          # meters
        self.preload_radius = preload_radius # meters ahead to preload
        self.loaded_tiles = {}               # tile_key -> VoxelMap (GPU)
        self.tile_index = self._load_tile_index(map_dir)
        self.max_gpu_tiles = 12              # ~1.8 GB at 150 MB/tile
        
    def update(self, vehicle_pose, planned_route=None):
        """Called every localization cycle to manage tiles."""
        current_key = self._pose_to_tile_key(vehicle_pose)
        
        # Determine needed tiles: current + neighbors + route lookahead
        needed = set()
        needed.add(current_key)
        needed.update(self._get_neighbor_keys(current_key))
        
        if planned_route is not None:
            # Preload tiles along planned route
            for waypoint in planned_route:
                if self._distance(vehicle_pose, waypoint) < self.preload_radius:
                    needed.add(self._pose_to_tile_key(waypoint))
        
        # Evict tiles no longer needed (LRU)
        to_evict = set(self.loaded_tiles.keys()) - needed
        for key in to_evict:
            self._unload_tile(key)
        
        # Load missing tiles (async, non-blocking)
        to_load = needed - set(self.loaded_tiles.keys())
        for key in to_load:
            self._async_load_tile(key)  # NVMe -> CPU -> GPU transfer
    
    def get_local_map(self, center, radius=80.0):
        """Extract voxels within radius of center for registration."""
        local_voxels = {}
        for key, tile in self.loaded_tiles.items():
            if self._tile_overlaps_sphere(key, center, radius):
                local_voxels.update(tile.get_voxels_in_sphere(center, radius))
        return local_voxels
```

### 2.3 Map Preprocessing for Matching Quality

Before a reference map is used for scan-to-map matching, it undergoes preprocessing to maximize matching quality:

```python
def preprocess_reference_map(raw_map_points, voxel_size=0.3):
    """Prepare reference map for production scan-to-map matching."""
    
    # 1. Remove dynamic objects (from multi-session voting in map pipeline)
    static_points = raw_map_points[raw_map_points['stability'] > 0.8]
    
    # 2. Remove ground plane (optional — depends on matching algorithm)
    # Ground helps NDT but hurts GICP in flat areas (degenerate)
    # Compromise: keep ground but downweight in cost function
    ground_mask = extract_ground_mask(static_points, cell_size=2.0, 
                                      height_threshold=0.15)
    static_points['ground_weight'] = np.where(ground_mask, 0.3, 1.0)
    
    # 3. Voxelize with distribution statistics
    voxel_map = VoxelMap(voxel_size)
    for voxel_key, points_in_voxel in voxelize(static_points, voxel_size):
        if len(points_in_voxel) < 5:
            continue  # Insufficient points for reliable covariance
        
        centroid = np.mean(points_in_voxel[:, :3], axis=0)
        cov = np.cov(points_in_voxel[:, :3].T)
        
        # Regularize covariance to prevent singularity
        eigenvalues = np.linalg.eigvalsh(cov)
        min_eigenvalue = 1e-4  # Minimum eigenvalue for numerical stability
        cov += max(0, min_eigenvalue - eigenvalues.min()) * np.eye(3)
        
        normal = compute_normal_from_covariance(cov)
        
        voxel_map.insert(voxel_key, centroid, cov, normal, 
                         len(points_in_voxel))
    
    # 4. Compute per-voxel "matchability" score
    # High planarity = good for matching; low planarity = ambiguous
    for key, voxel in voxel_map.items():
        eigenvalues = np.sort(np.linalg.eigvalsh(voxel.covariance))
        # Planarity: (lambda2 - lambda1) / lambda3
        voxel.matchability = (eigenvalues[1] - eigenvalues[0]) / (eigenvalues[2] + 1e-6)
    
    return voxel_map
```

---

## 3. Live Scan Preprocessing

### 3.1 Multi-LiDAR Merge

Aurrigo vehicles carry 4-8 RoboSense LiDARs (RSHELIOS 32-beam and RSBP 16-beam). Before scan-to-map matching, the multi-LiDAR data must be merged into a single scan in the vehicle body frame:

```cpp
class MultiLidarMerger {
public:
    MultiLidarMerger(const std::vector<Eigen::Isometry3d>& extrinsics,
                     const Eigen::Isometry3d& imu_to_body)
        : extrinsics_(extrinsics), imu_to_body_(imu_to_body) {}
    
    PointCloud merge(const std::vector<PointCloud>& scans,
                     const IMUBuffer& imu_buffer,
                     double target_timestamp) {
        PointCloud merged;
        merged.reserve(total_points(scans));
        
        for (size_t i = 0; i < scans.size(); ++i) {
            for (const auto& point : scans[i]) {
                // 1. Undistort: compensate for ego-motion during scan
                double dt = point.timestamp - target_timestamp;
                Eigen::Isometry3d T_motion = imu_buffer.integrate(
                    target_timestamp, point.timestamp);
                
                // 2. Transform to body frame via extrinsic calibration
                Eigen::Vector3d p_body = 
                    T_motion * extrinsics_[i] * point.position;
                
                // 3. Apply range and intensity filters
                double range = p_body.norm();
                if (range < 0.5 || range > 120.0) continue;  // Min/max range
                if (point.intensity < 5) continue;             // Noise filter
                
                merged.push_back({p_body, point.intensity, point.ring});
            }
        }
        return merged;
    }
    
private:
    std::vector<Eigen::Isometry3d> extrinsics_;  // LiDAR_i to body
    Eigen::Isometry3d imu_to_body_;
};
```

### 3.2 Downsampling for Registration

Raw merged scans contain 300K-1.2M points. Registration requires aggressive downsampling:

```python
def preprocess_scan_for_matching(merged_cloud, target_voxel_size=0.3):
    """Preprocess live scan for scan-to-map registration."""
    
    # 1. Voxel grid downsample (matches reference map resolution)
    downsampled = voxel_downsample(merged_cloud, target_voxel_size)
    # Typical: 1.2M -> 15-30K points
    
    # 2. Compute surface normals (needed for GICP/plane-to-plane)
    normals = estimate_normals(downsampled, k_neighbors=20)
    
    # 3. Remove isolated points (likely noise)
    # Statistical outlier removal: reject points >2σ from mean k-NN distance
    filtered = statistical_outlier_removal(downsampled, k=30, std_ratio=2.0)
    # Typically removes 3-8% of points
    
    # 4. Segment and optionally remove ground
    ground_mask = ransac_ground_segmentation(filtered, 
                                              distance_threshold=0.15,
                                              cell_size=3.0)
    
    # For GICP: keep ground but mark it
    # For feature-based: extract edge/planar features separately
    filtered['is_ground'] = ground_mask
    
    return filtered  # ~12-25K points with normals
```

### 3.3 Motion Compensation (Deskewing)

At 25 km/h, a vehicle moves ~7 cm during a 10 Hz LiDAR sweep period. Without deskewing, this introduces systematic registration error:

```cpp
void deskew_scan(PointCloud& cloud, 
                 const IMUBuffer& imu_buf,
                 double scan_start_time,
                 double scan_end_time) {
    // Get IMU-predicted motion over scan duration
    // Using pre-integrated IMU measurements (see robust-state-estimation doc)
    
    double scan_duration = scan_end_time - scan_start_time;
    
    for (auto& point : cloud) {
        // Fractional time within scan [0, 1]
        double alpha = (point.timestamp - scan_start_time) / scan_duration;
        alpha = std::clamp(alpha, 0.0, 1.0);
        
        // Interpolated transform from point time to scan reference time
        // Using SLERP for rotation, linear for translation
        Eigen::Isometry3d T = imu_buf.interpolate_transform(
            scan_start_time, 
            scan_start_time + alpha * scan_duration);
        
        // Transform point to scan reference frame
        point.position = T.inverse() * point.position;
    }
}
```

**Timing**: Deskewing costs ~1-2 ms for 1M points on Orin GPU (CUDA parallelized).

---

## 4. ICP-Family Registration

### 4.1 Point-to-Point ICP

The simplest scan-to-map matching. Minimizes point-to-point distances:

```
Objective: T* = argmin_T Σᵢ ||T·pᵢ - qᵢ||²

where pᵢ = source (live scan) points
      qᵢ = corresponding target (map) points
      T   = 6-DoF rigid transform (3 rotation + 3 translation)

Algorithm:
1. Find correspondences: for each pᵢ, find nearest qᵢ in map
2. Solve for T using SVD (closed-form Procrustes)
3. Apply T to source, repeat until convergence

Convergence: typically 15-30 iterations
Accuracy: ±10-20 cm (limited by point discretization)
Speed: 3-8 ms on Orin GPU (CUDA nearest-neighbor)
```

**Pros**: Simple, fast, no surface normal estimation needed.
**Cons**: Converges to local minima if initial guess is poor (>1m error). Sensitive to outliers. Accuracy limited by point sampling — two scans of a flat wall have ambiguous lateral alignment.

### 4.2 Point-to-Plane ICP

Adds surface normal information to the cost function:

```
Objective: T* = argmin_T Σᵢ (nᵢᵀ(T·pᵢ - qᵢ))²

where nᵢ = surface normal at corresponding map point qᵢ

Key difference: only penalizes distance ALONG the normal direction.
Points can slide freely along the surface → faster convergence on flat/planar structures.
```

**Convergence**: 5-15 iterations (much faster than point-to-point).
**Accuracy**: ±5-15 cm — better than point-to-point on structured environments.
**Speed**: 5-10 ms on Orin GPU (normal computation adds overhead).

This is the standard ICP variant used in most production systems. Autoware's NDT implementation uses point-to-plane as its core matching cost.

### 4.3 Generalized ICP (GICP)

GICP models both source and target point distributions as Gaussians:

```
Objective: T* = argmin_T Σᵢ dᵢᵀ (Cᵢˢ + T·Cᵢᵗ·Tᵀ)⁻¹ dᵢ

where dᵢ  = T·pᵢ - qᵢ (residual)
      Cᵢˢ = covariance of source point neighborhood
      Cᵢᵗ = covariance of target (map) point neighborhood

Special cases:
  - Cˢ = Cᵗ = I     → point-to-point ICP
  - Cˢ = I, Cᵗ → ε  → point-to-plane ICP
  - Both estimated    → full GICP (plane-to-plane)
```

**Advantages**:
- Automatically adapts to surface geometry (planar, cylindrical, spherical)
- More robust to noise than point-to-point or point-to-plane
- Natural probabilistic formulation enables covariance estimation on the result

**VGICP (Voxelized GICP)**: The variant used in Aurrigo's GTSAM stack. Instead of per-point covariances, uses voxel-level distributions from the reference map. This eliminates the per-query k-NN search for covariance estimation:

```cpp
// VGICP cost function for a single correspondence
double vgicp_cost(const Eigen::Vector3d& source_point,
                  const Eigen::Matrix3d& source_cov,
                  const Voxel& target_voxel,
                  const Eigen::Isometry3d& T) {
    Eigen::Vector3d transformed = T * source_point;
    Eigen::Vector3d residual = transformed - target_voxel.centroid;
    
    // Combined covariance in target frame
    Eigen::Matrix3d R = T.rotation();
    Eigen::Matrix3d combined_cov = target_voxel.covariance + 
                                   R * source_cov * R.transpose();
    
    // Mahalanobis distance
    return residual.transpose() * combined_cov.inverse() * residual;
}
```

**GPU-Accelerated VGICP on Orin**:

```
Orin VGICP Performance (RoboSense 4-LiDAR, ~25K downsampled points):
├── Correspondence search (voxel hash):  2-3 ms (GPU)
├── Cost evaluation + Jacobian:          5-8 ms (GPU, parallel per point)
├── Gauss-Newton solve:                  1-2 ms (CPU, 6×6 system)
├── Convergence check + iterate:         × 5-10 iterations
└── Total: 15-25 ms (typical), 35 ms (worst case complex scene)

Memory: ~300 MB (map voxels + source buffers + working memory)
```

### 4.4 Robust Kernels for Outlier Rejection

Real scans contain dynamic objects (aircraft, GSE, personnel) not in the reference map. Robust kernels downweight outlier correspondences:

```cpp
enum class RobustKernel { NONE, HUBER, CAUCHY, WELSCH, GM };

double apply_kernel(double squared_error, RobustKernel kernel, double delta) {
    switch (kernel) {
        case RobustKernel::HUBER:
            // Huber: linear beyond delta, quadratic below
            if (squared_error < delta * delta)
                return squared_error;
            else
                return 2.0 * delta * sqrt(squared_error) - delta * delta;
                
        case RobustKernel::CAUCHY:
            // Cauchy: heavy-tailed, aggressive outlier rejection
            return delta * delta * log(1.0 + squared_error / (delta * delta));
            
        case RobustKernel::WELSCH:
            // Welsch: smoothly rejects far outliers
            return delta * delta * (1.0 - exp(-squared_error / (delta * delta)));
            
        case RobustKernel::GM:
            // Geman-McClure: strongest outlier rejection
            return squared_error / (squared_error + delta * delta);
            
        default:
            return squared_error;
    }
}
```

For airside operations, **Cauchy kernel with delta=0.5m** provides the best tradeoff:
- Tolerates dynamic objects (GSE, personnel) up to ~2m from their map absence
- Rejects aircraft (massive outlier mass) effectively
- Preserves convergence basin for well-matched structural features

### 4.5 Correspondence Search Strategies

```
Method              | Speed (25K pts) | Accuracy | Memory | Best For
--------------------|-----------------|----------|--------|------------------
Brute force         | 50+ ms          | Best     | O(1)   | Never in production
KD-tree             | 5-8 ms          | Best     | O(n)   | Small maps (<1M pts)
Voxel hash          | 2-3 ms          | Good     | O(n)   | Large maps, GPU
Projective (2D)     | 1-2 ms          | Lower    | O(hw)  | Camera-like proj
Multi-scale hash    | 3-5 ms          | Best     | O(2n)  | Coarse-to-fine
```

Production recommendation: **Voxel hash** on GPU for primary matching, **KD-tree** on CPU as fallback.

---

## 5. Normal Distributions Transform (NDT)

### 5.1 NDT Algorithm

NDT divides the reference map into a regular grid of cells, each modeled as a Gaussian distribution. Scan matching finds the transform that maximizes the likelihood of live scan points under the map's Gaussian mixture:

```
Reference map NDT representation:
  For each cell c with points {xⱼ}:
    μc = (1/n) Σⱼ xⱼ           (cell mean)
    Σc = (1/n) Σⱼ (xⱼ-μc)(xⱼ-μc)ᵀ  (cell covariance)

Score function for a scan point p transformed by T:
  s(p, T) = -Σc exp(-½ (T·p - μc)ᵀ Σc⁻¹ (T·p - μc))

Optimization: T* = argmax_T Σᵢ s(pᵢ, T)
  Solved with Newton's method using analytical gradient and Hessian
```

### 5.2 Multi-Resolution NDT (MR-NDT)

The critical improvement for production use — coarse-to-fine matching:

```python
class MultiResolutionNDT:
    """Multi-resolution NDT for coarse-to-fine scan matching."""
    
    def __init__(self, map_points):
        # Build NDT grids at multiple resolutions
        self.levels = [
            NDTGrid(map_points, cell_size=4.0),   # Level 0: coarse (convergence basin)
            NDTGrid(map_points, cell_size=2.0),   # Level 1: medium
            NDTGrid(map_points, cell_size=1.0),   # Level 2: fine
            NDTGrid(map_points, cell_size=0.5),   # Level 3: precise (final refinement)
        ]
        self.max_iterations = [10, 10, 15, 20]
        self.convergence_thresholds = [0.1, 0.05, 0.01, 0.001]  # meters
    
    def align(self, scan_points, initial_guess):
        """Coarse-to-fine NDT alignment."""
        T = initial_guess
        
        for level_idx, (ndt_grid, max_iter, threshold) in enumerate(
                zip(self.levels, self.max_iterations, self.convergence_thresholds)):
            
            for iteration in range(max_iter):
                # Compute score, gradient, and Hessian
                score, gradient, hessian = ndt_grid.compute_derivatives(
                    scan_points, T)
                
                # Newton step
                try:
                    delta = np.linalg.solve(hessian, -gradient)
                except np.linalg.LinAlgError:
                    break  # Singular Hessian — degenerate geometry
                
                # Line search for step size
                alpha = self._backtracking_line_search(
                    ndt_grid, scan_points, T, delta, score)
                
                # Apply update
                T = T @ se3_exp(alpha * delta)
                
                # Convergence check
                if np.linalg.norm(delta[:3]) < threshold:
                    break
            
        return T, self._compute_covariance(self.levels[-1], scan_points, T)
    
    def _compute_covariance(self, ndt_grid, scan_points, T):
        """Estimate registration covariance from Hessian inverse."""
        _, _, hessian = ndt_grid.compute_derivatives(scan_points, T)
        try:
            # Fisher information matrix → covariance
            covariance = np.linalg.inv(hessian)
            # Ensure positive definite
            eigenvalues = np.linalg.eigvalsh(covariance)
            if eigenvalues.min() < 0:
                covariance += (abs(eigenvalues.min()) + 1e-6) * np.eye(6)
            return covariance
        except np.linalg.LinAlgError:
            # Degenerate — return large uncertainty
            return np.diag([1.0, 1.0, 1.0, 0.1, 0.1, 0.1])
```

### 5.3 NDT vs GICP Comparison for Airside

```
Criterion               | NDT (MR-NDT)        | GICP/VGICP
------------------------|---------------------|--------------------
Accuracy (structured)    | ±5-10 cm            | ±3-8 cm
Accuracy (open area)     | ±15-30 cm           | ±10-20 cm
Speed (Orin GPU)        | 8-15 ms             | 15-25 ms
Convergence basin       | ±2-3 m (4m cells)   | ±0.5-1 m
Memory                  | 5-50 MB             | 150-300 MB
Degenerate handling     | Hessian singularity  | Eigenvalue analysis
Ground plane            | Handles well         | Can be degenerate
Implementation maturity | Autoware production  | Aurrigo current stack
Best for                | Backup/fast path     | Primary high-accuracy
```

**Recommendation**: VGICP as primary (higher accuracy, already in Aurrigo stack), NDT as fast fallback when VGICP fails to converge or is too slow.

### 5.4 Autoware NDT Implementation Reference

Autoware's production NDT matcher is the most field-proven open-source implementation:

```
Autoware NDT stack:
├── ndt_scan_matcher     — Core NDT matching with multi-resolution
├── ndt_omp             — OpenMP-parallelized NDT
├── initial_pose_tool   — GNSS-based initial pose for cold start
├── ekf_localizer       — EKF fusing NDT + IMU + wheel odometry
└── diagnostics         — Matching quality monitoring

Key parameters (from Autoware production configs):
  resolution: 2.0        # NDT cell size (meters)
  step_size: 0.1         # Newton step size
  trans_epsilon: 0.01    # Convergence threshold (m)
  max_iterations: 30
  regularization_scale_factor: 0.01  # Hessian regularization
```

---

## 6. Feature-Based Scan Matching

### 6.1 Edge and Planar Feature Extraction

Instead of matching raw points, extract geometric features and match feature-to-feature. This approach, pioneered by LOAM (Zhang & Singh, 2014) and refined by LeGO-LOAM, LIO-SAM, and FAST-LIO2:

```python
def extract_features_for_matching(scan, num_rings=32):
    """Extract edge and planar features from LiDAR scan.
    
    Based on LOAM/LIO-SAM feature extraction.
    Edge features: high curvature points (corners, edges)
    Planar features: low curvature points (walls, ground)
    """
    edge_features = []
    planar_features = []
    
    for ring in range(num_rings):
        ring_points = scan[scan['ring'] == ring]
        if len(ring_points) < 20:
            continue
        
        # Compute smoothness (curvature proxy) for each point
        # c = (1/2k) * ||Σⱼ (pⱼ - pᵢ)|| / ||pᵢ||
        # where j are k neighbors on the same ring
        smoothness = compute_ring_smoothness(ring_points, k=5)
        
        # Sort by smoothness within sectors (avoid clustering)
        num_sectors = 6
        sector_size = len(ring_points) // num_sectors
        
        for sector in range(num_sectors):
            start = sector * sector_size
            end = min(start + sector_size, len(ring_points))
            sector_points = ring_points[start:end]
            sector_smooth = smoothness[start:end]
            
            sorted_idx = np.argsort(sector_smooth)
            
            # Top 2 smoothest → edge features
            for i in sorted_idx[-2:]:
                if sector_smooth[i] > 0.1:  # Minimum curvature threshold
                    edge_features.append(sector_points[i])
            
            # Bottom 4 smoothest → planar features
            for i in sorted_idx[:4]:
                if sector_smooth[i] < 0.01:  # Maximum curvature threshold
                    planar_features.append(sector_points[i])
    
    return np.array(edge_features), np.array(planar_features)
```

### 6.2 Feature-to-Map Matching

```
Edge features → match against edge lines in map (point-to-line distance)
Planar features → match against planar surfaces in map (point-to-plane distance)

Combined cost:
  E(T) = Σ_edge  w_e · d_line(T·pᵢ, map_edge)²
       + Σ_planar w_p · d_plane(T·pⱼ, map_plane)²

where:
  d_line(p, l) = ||(p-a) × (b-a)|| / ||b-a||     (point-to-line)
  d_plane(p, π) = nᵀ·p + d                         (point-to-plane)
```

**Advantages**: Fewer correspondences (100s vs 10Ks) → faster solve. Geometric features are more distinctive than raw points. Better in environments with clear edges (buildings, terminal walls, taxiway markings).

**Disadvantages**: Feature extraction adds 2-3 ms. Fails in featureless environments (open apron with no nearby structures). Feature quality depends on LiDAR beam density.

### 6.3 FAST-LIO2 Feature Matching (ikd-Tree)

FAST-LIO2 uses an incremental KD-tree (ikd-Tree) for efficient map maintenance and feature matching:

```
ikd-Tree properties:
├── Incremental insertion: O(log n) amortized
├── Lazy deletion: mark nodes, rebuild subtree periodically
├── Box-wise operations: insert/delete all points in a bounding box
├── Re-balancing: alpha-balanced, worst case O(n) but amortized O(log n)
└── 5-nearest-neighbor query: ~0.1 ms for 500K map points

Key insight: The map IS the KD-tree. No separate map representation needed.
New scan points are inserted into the tree after registration, maintaining
a sliding-window local map without explicit tile management.
```

For scan-to-map in production (where the map is pre-built and static), the ikd-Tree is overkill — a static KD-tree or voxel hash suffices. But for fleet-based map refinement where the reference map evolves, ikd-Tree's incremental updates are valuable.

---

## 7. Learned Registration Methods

### 7.1 Deep Closest Point (DCP)

Learned correspondence prediction using attention mechanisms:

```
Architecture:
  Input: Source point cloud P, Target point cloud Q
  1. PointNet/DGCNN feature extraction → per-point features
  2. Attention-based soft correspondence matrix
  3. SVD on weighted correspondences → rigid transform

Advantage: End-to-end differentiable, handles partial overlap
Disadvantage: Trained on specific data → domain gap for airside
Orin: ~30-50 ms (too slow for primary, useful for verification)
```

### 7.2 REGTR (Registration Transformer)

```
Architecture:
  1. KPConv backbone → local features
  2. Transformer cross-attention → feature matching
  3. Overlap prediction → which points have correspondences
  4. Weighted SVD → rigid transform

Performance (3DMatch benchmark):
  Registration Recall: 92.0% (vs 78.4% for traditional RANSAC+FPFH)
  
Advantage: Works with low overlap (30-50%), robust to noise
Disadvantage: 80-120 ms on A100, ~200-300 ms on Orin → offline use only
```

### 7.3 GeoTransformer (CVPR 2022)

Current SOTA learned registration method:

```
Architecture:
  1. KPConv → multi-scale point features
  2. Geometric transformer with superpoint matching
  3. Local-to-global registration via patch correspondences
  4. LGR (Local-to-Global Registration) for robust pose estimation

Performance:
  3DMatch: 92.5% Registration Recall
  3DLoMatch (low overlap): 75.0% (vs 47.2% for FPFH+RANSAC)
  Speed: ~150 ms on A100, ~400 ms on Orin

Use case for Aurrigo:
  NOT for real-time scan-to-map (too slow)
  YES for: initial localization from cold start
           recovery after kidnapped robot scenario
           multi-session map alignment in map pipeline
           verification of classical registration results
```

### 7.4 Hybrid Classical-Learned Pipeline

The production-optimal approach combines classical speed with learned robustness:

```
┌──────────────────────────────────────────────────────────────┐
│                   HYBRID REGISTRATION PIPELINE               │
│                                                              │
│  1. CLASSICAL (real-time, 15-25 ms)                         │
│     ├── VGICP: Primary matcher, GPU-accelerated             │
│     ├── NDT: Fallback when VGICP diverges                   │
│     └── Feature ICP: Additional fallback for structured env  │
│                                                              │
│  2. LEARNED (triggered, 100-400 ms)                         │
│     ├── GeoTransformer: Cold-start initialization           │
│     ├── DCP: Registration verification (confidence check)    │
│     └── MinkLoc3D: Place recognition (see place-recog doc)  │
│                                                              │
│  Decision logic:                                             │
│     if (ESKF has valid prediction within 1m):               │
│       → VGICP with ESKF prediction as initial guess         │
│     elif (VGICP fitness < threshold):                       │
│       → NDT coarse + VGICP fine                             │
│     elif (NDT also fails):                                  │
│       → GeoTransformer for re-initialization                │
│     else:                                                    │
│       → Dead-reckoning + place recognition search           │
└──────────────────────────────────────────────────────────────┘
```

---

## 8. Multi-Resolution Coarse-to-Fine Matching

### 8.1 Why Coarse-to-Fine Matters

Single-resolution matching has a fundamental tradeoff:
- **Fine resolution** (0.2m voxels): High accuracy but small convergence basin (~0.5m)
- **Coarse resolution** (2.0m cells): Large convergence basin (~3m) but low accuracy

Coarse-to-fine breaks this tradeoff by matching at decreasing resolutions:

```python
class CoarseToFineRegistration:
    """Multi-resolution coarse-to-fine scan-to-map matching.
    
    Combines NDT (coarse) and VGICP (fine) for optimal accuracy
    with large convergence basin.
    """
    
    def __init__(self, reference_map):
        # Build multi-resolution representations
        self.ndt_coarse = NDTGrid(reference_map, cell_size=4.0)
        self.ndt_medium = NDTGrid(reference_map, cell_size=1.5)
        self.vgicp_fine = VGICPMap(reference_map, voxel_size=0.3)
        
    def align(self, scan, initial_guess, scan_normals=None):
        """Three-stage coarse-to-fine alignment."""
        
        # Stage 1: Coarse NDT (convergence basin ~5m, ~3 ms)
        T1, score1 = self.ndt_coarse.align(
            scan, initial_guess,
            max_iterations=10,
            convergence_threshold=0.1)
        
        if score1 < 0.3:  # Poor coarse match — try wider search
            T1 = self._grid_search_ndt(scan, initial_guess, 
                                        search_radius=5.0, 
                                        angular_range=10.0)
        
        # Stage 2: Medium NDT (refine to ~10cm, ~4 ms)
        T2, score2 = self.ndt_medium.align(
            scan, T1,
            max_iterations=15,
            convergence_threshold=0.02)
        
        # Stage 3: Fine VGICP (refine to ~3-5cm, ~12-18 ms)
        T3, cov3, fitness3 = self.vgicp_fine.align(
            scan, T2,
            scan_normals=scan_normals,
            max_iterations=20,
            convergence_threshold=0.001,
            robust_kernel='cauchy',
            kernel_delta=0.5)
        
        # Quality assessment
        quality = RegistrationQuality(
            fitness=fitness3,
            inlier_rmse=self.vgicp_fine.get_inlier_rmse(),
            covariance=cov3,
            num_correspondences=self.vgicp_fine.get_num_correspondences(),
            eigenvalue_ratios=self._compute_observability(cov3)
        )
        
        return T3, quality
    
    def _grid_search_ndt(self, scan, center_guess, 
                          search_radius, angular_range):
        """Grid search for coarse initialization when prediction is poor."""
        best_score = -float('inf')
        best_T = center_guess
        
        # Search grid: ±search_radius in x,y; ±angular_range in yaw
        for dx in np.arange(-search_radius, search_radius + 0.5, 1.0):
            for dy in np.arange(-search_radius, search_radius + 0.5, 1.0):
                for dyaw in np.arange(-angular_range, angular_range + 2.0, 3.0):
                    trial = perturb_pose(center_guess, dx, dy, 0, 0, 0, 
                                         np.radians(dyaw))
                    T, score = self.ndt_coarse.align(
                        scan, trial, max_iterations=5)
                    if score > best_score:
                        best_score = score
                        best_T = T
        
        return best_T
```

### 8.2 Timing Analysis on Orin

```
Coarse-to-Fine Pipeline (typical, 25K scan points):
├── Stage 1: Coarse NDT (4.0m cells, 10 iterations):     2-4 ms
├── Stage 2: Medium NDT (1.5m cells, 15 iterations):     3-5 ms
├── Stage 3: Fine VGICP (0.3m voxels, 20 iterations):   10-18 ms
├── Quality assessment:                                   0.5-1 ms
└── Total: 15-28 ms (typical), 35 ms (worst case)

Grid search fallback (rare, <2% of cycles):
├── 11×11×7 = 847 NDT evaluations × 5 iterations:       40-80 ms
└── Triggers speed reduction while searching
```

---

## 9. Degenerate Geometry Detection and Handling

### 9.1 What Is Degeneracy in Scan Matching

Degeneracy occurs when the environment does not provide sufficient geometric constraints to determine all 6 DoF of the vehicle pose. Common airside scenarios:

```
Scenario                          | Degenerate DoF    | Frequency
----------------------------------|-------------------|------------------
Long straight taxiway             | Along-track (x)   | Very common
Open apron (no nearby structures) | x, y (translation)| Common
Flat ground, no vertical features | z, roll, pitch    | Moderate
Narrow corridor between buildings | Yaw (rotation)    | Rare on airside
Tunnel/underpass (terminal)       | Full 6-DoF        | Very rare
```

### 9.2 Eigenvalue-Based Degeneracy Detection

The Hessian matrix of the registration cost function encodes how well each DoF is constrained. Its eigenvalues reveal which directions are well-observed:

```python
def detect_degeneracy(hessian_6x6, threshold_ratio=100.0):
    """Detect degenerate directions in registration.
    
    Args:
        hessian_6x6: 6x6 Hessian of registration cost (tx,ty,tz,rx,ry,rz)
        threshold_ratio: eigenvalue ratio threshold for degeneracy
    
    Returns:
        degenerate_dofs: list of degenerate direction indices
        eigenvalue_ratios: per-DoF constraint strength
        projection_matrix: projects solution away from degenerate dirs
    """
    eigenvalues, eigenvectors = np.linalg.eigh(hessian_6x6)
    
    # Eigenvalue ratios relative to maximum
    max_eigenvalue = eigenvalues.max()
    eigenvalue_ratios = eigenvalues / (max_eigenvalue + 1e-10)
    
    # Degenerate directions: eigenvalue < max / threshold_ratio
    degenerate_mask = eigenvalue_ratios < (1.0 / threshold_ratio)
    degenerate_dofs = np.where(degenerate_mask)[0]
    
    # Build projection matrix that zeros out degenerate directions
    # This prevents the registration from "hallucinating" solutions
    # in unconstrained directions
    P = np.eye(6)
    for i in degenerate_dofs:
        v = eigenvectors[:, i]
        P -= np.outer(v, v)  # Remove degenerate eigenvector component
    
    return degenerate_dofs, eigenvalue_ratios, P


def apply_degeneracy_aware_update(delta_pose, hessian, 
                                   threshold_ratio=100.0):
    """Apply registration update only in well-constrained directions.
    
    In degenerate directions, keep the prior estimate (from ESKF/IMU).
    This is the "Zhang degeneracy" method from LOAM.
    """
    degenerate_dofs, ratios, P = detect_degeneracy(hessian, threshold_ratio)
    
    # Project the update to only modify well-constrained components
    constrained_update = P @ delta_pose
    
    # Inflate covariance in degenerate directions
    cov = np.linalg.inv(hessian + 1e-6 * np.eye(6))
    for dof in degenerate_dofs:
        # Set covariance to large value (trust prior, not registration)
        v = np.linalg.eigh(hessian)[1][:, dof]
        cov += 10.0 * np.outer(v, v)  # 10 m² uncertainty in degenerate dir
    
    return constrained_update, cov
```

### 9.3 Localizability Score

A scalar metric that summarizes how well the environment supports localization:

```python
def compute_localizability(hessian_6x6):
    """Compute a [0,1] localizability score.
    
    1.0 = fully constrained in all 6 DoF
    0.0 = fully degenerate (no geometric structure)
    
    Based on: "On Degeneracy of Optimization-based State Estimation Problems"
    (Zhang et al., ICRA 2016)
    """
    eigenvalues = np.sort(np.linalg.eigvalsh(hessian_6x6))
    
    # Condition number based score
    condition = eigenvalues[-1] / (eigenvalues[0] + 1e-10)
    
    # Map to [0,1] with sigmoid
    # condition < 50: well-constrained (score > 0.8)
    # condition 50-500: partially degenerate (0.3-0.8)
    # condition > 500: severely degenerate (score < 0.3)
    score = 1.0 / (1.0 + np.exp((np.log10(condition) - 2.0) * 3.0))
    
    return score, eigenvalues
```

### 9.4 Airside Degeneracy Patterns

```
┌─────────────────────────────────────────────────────────────┐
│              AIRSIDE DEGENERACY MAP                          │
│                                                              │
│  Terminal ████████████████████████████████ High constraint   │
│           ██                            ██                   │
│  Stand    ██  Good (aircraft + jetway)  ██                   │
│  area     ██  Score: 0.85-0.95          ██                   │
│           ██                            ██                   │
│  ─────────██────────────────────────────██──────────         │
│                                                              │
│  Taxiway (straight): Degenerate along-track                  │
│  ═══════════════════════════════════════                     │
│  Score: 0.4-0.6 (cross-track OK, along-track poor)          │
│                                                              │
│  Open apron: Severely degenerate                             │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                    │
│  Score: 0.1-0.3 (minimal structure, flat ground only)        │
│                                                              │
│  Taxiway (curved): Well-constrained                          │
│  ╔══╗                                                        │
│  ║  ╚══╗  Score: 0.7-0.9 (curvature provides observability) │
│  ╚════╗║                                                     │
│       ╚╝                                                     │
└─────────────────────────────────────────────────────────────┘
```

### 9.5 Response to Degeneracy

```python
class DegeneracyHandler:
    """Handle degenerate scan-to-map matching situations."""
    
    # Localizability thresholds
    WELL_CONSTRAINED = 0.7      # Full trust in registration
    PARTIALLY_DEGENERATE = 0.4  # Blend with odometry
    SEVERELY_DEGENERATE = 0.2   # Mostly trust odometry
    UNUSABLE = 0.1              # Registration result discarded
    
    def handle(self, registration_result, localizability_score, 
               eskf_prediction, eskf_covariance):
        """Decide how to use registration result given degeneracy level."""
        
        if localizability_score >= self.WELL_CONSTRAINED:
            # Normal: use registration result directly
            return FactorType.SCAN_MATCH, registration_result
        
        elif localizability_score >= self.PARTIALLY_DEGENERATE:
            # Partial: use only well-constrained directions
            constrained_pose, inflated_cov = apply_degeneracy_aware_update(
                registration_result.pose, 
                registration_result.hessian)
            registration_result.pose = constrained_pose
            registration_result.covariance = inflated_cov
            return FactorType.PARTIAL_SCAN_MATCH, registration_result
        
        elif localizability_score >= self.SEVERELY_DEGENERATE:
            # Severe: use only strongest constraint direction (usually lateral)
            # and rely on odometry for everything else
            best_dof = np.argmax(np.linalg.eigvalsh(
                registration_result.hessian))
            # Create 1-DoF factor
            return FactorType.SINGLE_DOF_CONSTRAINT, (best_dof, 
                registration_result.pose[best_dof],
                registration_result.covariance[best_dof, best_dof])
        
        else:
            # Unusable: discard registration, rely on dead-reckoning
            return FactorType.NONE, None
```

---

## 10. Multi-LiDAR Scan-to-Map Fusion

### 10.1 Strategies for 4-8 LiDAR Fleet

Aurrigo vehicles have 4-8 LiDARs. Three strategies for incorporating them into scan-to-map matching:

```
Strategy 1: MERGE THEN MATCH (Current Aurrigo approach)
  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
  │LiDAR1│ │LiDAR2│ │LiDAR3│ │LiDAR4│
  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘
     └────┬────┘────┬────┘────┬────┘
          │   MERGE (extrinsic transforms)
          ▼
     ┌─────────┐
     │ Merged  │ 300K-1.2M points
     │ Cloud   │
     └────┬────┘
          │   DOWNSAMPLE + MATCH
          ▼
     ┌─────────┐
     │  VGICP  │ Single registration
     └─────────┘
  
  Pros: Simple, single optimization, highest point density
  Cons: Extrinsic calibration error included, single failure mode
  Timing: ~20 ms

Strategy 2: MATCH THEN FUSE
  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
  │LiDAR1│ │LiDAR2│ │LiDAR3│ │LiDAR4│
  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘
     │         │         │         │
     ▼         ▼         ▼         ▼
  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
  │VGICP1│ │VGICP2│ │VGICP3│ │VGICP4│  Parallel registration
  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘
     └────┬────┘────┬────┘────┬────┘
          │   COVARIANCE INTERSECTION
          ▼
     ┌────────────┐
     │ Fused Pose │  Weighted by per-LiDAR quality
     └────────────┘
  
  Pros: Robust to single LiDAR failure, per-LiDAR quality assessment
  Cons: 4x compute (but parallelizable on GPU), smaller per-scan point count
  Timing: ~15 ms (parallel on 4 GPU streams) or ~60 ms (sequential)

Strategy 3: SELECTIVE MATCHING (Recommended for production)
  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
  │LiDAR1│ │LiDAR2│ │LiDAR3│ │LiDAR4│
  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘
     │         │         │         │
     ▼         ▼         ▼         ▼
  ┌──────────────────────────────────┐
  │        SELECT BEST 2-3          │ Based on FOV overlap with
  │  (structural content scoring)    │ map features, health status
  └──────────┬───────────────────────┘
             │ MERGE SELECTED
             ▼
     ┌─────────────┐
     │ VGICP (fine) │ Primary: best LiDARs merged
     └──────┬──────┘
            │
            ▼
  ┌──────────────────────┐
  │ REMAINING LiDARs:    │ Cross-check or next cycle
  │ Consistency check    │
  └──────────────────────┘
```

### 10.2 Per-LiDAR Structural Content Scoring

Not all LiDARs see equally useful structure for matching:

```python
def score_lidar_structural_content(cloud, map_local):
    """Score how useful a single LiDAR's view is for scan-to-map matching.
    
    Returns 0-1 score. High = lots of matchable structure.
    """
    # 1. Point density in structured areas
    near_structure = 0
    for point in cloud:
        nearest_map_dist = map_local.nearest_distance(point)
        if nearest_map_dist < 1.0:  # Within 1m of map features
            near_structure += 1
    structure_ratio = near_structure / len(cloud)
    
    # 2. Geometric diversity (eigenvalue analysis)
    if len(cloud) > 100:
        cov = np.cov(cloud[:, :3].T)
        eigenvalues = np.sort(np.linalg.eigvalsh(cov))
        # High diversity = all three eigenvalues similar (3D spread)
        diversity = eigenvalues[0] / (eigenvalues[2] + 1e-6)
    else:
        diversity = 0
    
    # 3. Range distribution (prefer medium range, not too close/far)
    ranges = np.linalg.norm(cloud[:, :3], axis=1)
    range_score = np.mean((ranges > 5) & (ranges < 60))
    
    return 0.5 * structure_ratio + 0.3 * diversity + 0.2 * range_score
```

### 10.3 Covariance Intersection for Multi-LiDAR Fusion

When using Strategy 2 (match-then-fuse), covariance intersection provides a consistent fusion without assuming independence:

```python
def covariance_intersection(poses, covariances):
    """Fuse multiple pose estimates with unknown correlation.
    
    Covariance intersection is always consistent (never overconfident)
    even when the correlation structure between estimates is unknown.
    """
    n = len(poses)
    
    # Optimize weights (convex optimization)
    def objective(omega):
        """Minimize trace of fused covariance."""
        omega = np.abs(omega) / np.sum(np.abs(omega))  # Normalize
        P_inv = sum(w * np.linalg.inv(C) for w, C in zip(omega, covariances))
        return np.trace(np.linalg.inv(P_inv))
    
    from scipy.optimize import minimize
    result = minimize(objective, np.ones(n) / n, 
                     method='Nelder-Mead')
    omega = np.abs(result.x) / np.sum(np.abs(result.x))
    
    # Fused estimate
    P_fused_inv = sum(w * np.linalg.inv(C) for w, C in zip(omega, covariances))
    P_fused = np.linalg.inv(P_fused_inv)
    x_fused = P_fused @ sum(w * np.linalg.solve(C, x) 
                            for w, C, x in zip(omega, covariances, poses))
    
    return x_fused, P_fused
```

---

## 11. GTSAM Factor Graph Integration

### 11.1 Scan-to-Map as a GTSAM Factor

The scan-to-map registration result becomes a unary factor (absolute pose measurement) in the GTSAM factor graph:

```cpp
#include <gtsam/nonlinear/NonlinearFactor.h>
#include <gtsam/geometry/Pose3.h>

class ScanToMapFactor : public gtsam::NoiseModelFactor1<gtsam::Pose3> {
public:
    ScanToMapFactor(gtsam::Key key, 
                    const gtsam::Pose3& measured_pose,
                    const gtsam::SharedNoiseModel& noise_model,
                    double fitness_score,
                    double localizability)
        : NoiseModelFactor1(noise_model, key),
          measured_(measured_pose),
          fitness_(fitness_score),
          localizability_(localizability) {}
    
    gtsam::Vector evaluateError(
            const gtsam::Pose3& pose,
            boost::optional<gtsam::Matrix&> H = boost::none) const override {
        // Error = log map of relative pose
        gtsam::Pose3 error_pose = measured_.between(pose);
        
        if (H) {
            // Jacobian of logmap
            *H = gtsam::Pose3::LogmapDerivative(error_pose);
        }
        
        return gtsam::Pose3::Logmap(error_pose);
    }
    
    double fitness() const { return fitness_; }
    double localizability() const { return localizability_; }
    
private:
    gtsam::Pose3 measured_;
    double fitness_;
    double localizability_;
};
```

### 11.2 Adaptive Noise Model

The noise model for the scan-to-map factor should adapt based on registration quality:

```cpp
gtsam::SharedNoiseModel compute_adaptive_noise(
        const Eigen::Matrix<double, 6, 6>& registration_covariance,
        double fitness_score,
        double localizability,
        const DegeneracyInfo& degeneracy) {
    
    Eigen::Matrix<double, 6, 6> noise_cov = registration_covariance;
    
    // Scale by fitness (lower fitness = more uncertain)
    double fitness_scale = 1.0 / (fitness_score + 0.1);
    noise_cov *= fitness_scale;
    
    // Inflate degenerate directions
    for (int dof : degeneracy.degenerate_dofs) {
        Eigen::Matrix<double, 6, 1> v = degeneracy.eigenvectors.col(dof);
        noise_cov += 100.0 * v * v.transpose();  // 10m uncertainty
    }
    
    // Minimum uncertainty floor (never claim better than sensor + calibration allows)
    Eigen::Matrix<double, 6, 1> min_sigma;
    min_sigma << 0.02, 0.02, 0.02,    // 2 cm translation minimum
                 0.001, 0.001, 0.001;  // 0.06 deg rotation minimum
    noise_cov = noise_cov.cwiseMax(min_sigma * min_sigma.transpose());
    
    return gtsam::noiseModel::Gaussian::Covariance(noise_cov);
}
```

### 11.3 Factor Graph Update Cycle

```cpp
void localization_callback(const sensor_msgs::PointCloud2& merged_scan) {
    // 1. Get current ESKF prediction as initial guess
    gtsam::Pose3 prediction = eskf_.get_current_pose();
    
    // 2. Preprocess scan
    auto preprocessed = preprocess_scan(merged_scan);
    
    // 3. Get local map around prediction
    auto local_map = tile_manager_.get_local_map(
        prediction.translation(), /*radius=*/80.0);
    
    // 4. Coarse-to-fine registration
    auto [result_pose, quality] = coarse_to_fine_.align(
        preprocessed, prediction);
    
    // 5. Degeneracy check
    auto degeneracy = detect_degeneracy(quality.hessian);
    auto [factor_type, action] = degeneracy_handler_.handle(
        result_pose, quality.localizability, prediction, eskf_.covariance());
    
    // 6. Create and add GTSAM factor
    if (factor_type != FactorType::NONE) {
        auto noise = compute_adaptive_noise(
            quality.covariance, quality.fitness, 
            quality.localizability, degeneracy);
        
        auto factor = boost::make_shared<ScanToMapFactor>(
            current_key_, result_pose, noise,
            quality.fitness, quality.localizability);
        
        graph_.add(factor);
    }
    
    // 7. Add IMU preintegration factor (between previous and current key)
    auto imu_factor = create_imu_factor(previous_key_, current_key_);
    graph_.add(imu_factor);
    
    // 8. ISAM2 incremental update
    auto isam_result = isam2_.update(graph_, initial_values_);
    gtsam::Pose3 optimized = isam_result.at<gtsam::Pose3>(current_key_);
    
    // 9. Feed back to ESKF
    eskf_.correct(optimized, isam_result.marginalCovariance(current_key_));
    
    // 10. Publish and advance
    publish_pose(optimized);
    graph_.resize(0);
    initial_values_.clear();
    previous_key_ = current_key_;
    current_key_ = gtsam::Symbol('x', ++frame_id_);
}
```

---

## 12. Airside-Specific Challenges

### 12.1 Dynamic Content Ratio

Airports have extremely high dynamic content compared to urban driving:

```
Environment          | Static Content | Dynamic Content | Impact on Matching
---------------------|----------------|-----------------|-------------------
Urban street         | 85-95%         | 5-15%           | Minimal
Highway              | 90-98%         | 2-10%           | Negligible
Airport stand area   | 30-60%         | 40-70%          | SEVERE
Airport taxiway      | 80-95%         | 5-20%           | Moderate
Open apron           | 60-80%         | 20-40%          | Significant
```

Stand areas are worst: aircraft fuselage (60m), jetways, baggage trains, fuel trucks, catering vehicles, and ground crew can occlude 40-70% of the static map features.

**Mitigation**: Robust kernels (Cauchy, delta=0.5m) reject dynamic objects. Semantic filtering removes known dynamic classes. Stability-weighted matching emphasizes permanent infrastructure.

### 12.2 Aircraft as Massive Occluders

A single aircraft body occludes 30-60m of map features behind it. This creates a "shadow" where the vehicle can only see the aircraft surface (not in the map) and the ground (degenerate):

```python
def aircraft_occlusion_compensation(scan, map_local, detected_aircraft):
    """Adjust matching strategy when aircraft occlude map features."""
    
    for aircraft in detected_aircraft:
        # Estimate occluded map region behind aircraft
        occluded_region = compute_occlusion_cone(
            vehicle_position=scan.origin,
            aircraft_bbox=aircraft.bbox,
            max_range=80.0)
        
        # Remove map features in occluded region from matching
        # (they can't be observed, so correspondences would be wrong)
        map_local.disable_region(occluded_region)
        
        # If >50% of local map is occluded, flag as degraded
        visible_ratio = map_local.get_visible_ratio()
        if visible_ratio < 0.5:
            return MatchingMode.DEGRADED, visible_ratio
    
    return MatchingMode.NORMAL, 1.0
```

### 12.3 Ground Reflectivity Variation

Airport aprons have painted markings, oil stains, rubber deposits, puddles, and variable concrete surfaces. These cause LiDAR intensity variations that affect intensity-based matching:

- **Paint markings**: Intensity 200+ (high reflectivity)
- **Rubber deposits**: Intensity 20-40 (low reflectivity)
- **Oil stains**: Near-zero return (absorption)
- **Puddles**: Specular reflection (may not return, or return at wrong range)

**Mitigation**: Use geometry-only matching (ignore intensity). If intensity is used for feature extraction, apply per-LiDAR intensity normalization.

### 12.4 Jet Blast and Thermal Shimmer

Jet exhaust creates air density gradients that refract LiDAR beams, causing:
- Range measurement errors of 5-50 cm
- Point cloud "wobble" in thermal shimmer regions
- Intermittent point dropout near exhaust cones

**Mitigation**: Detect jet blast regions (via thermal camera, radar Doppler, or fleet V2X alerts — see `night-operations-thermal-fusion.md` and `radar-lidar-adverse-weather.md`). Exclude points in jet blast regions from registration. Increase covariance in affected directions.

### 12.5 Seasonal and Diurnal Variation

The reference map may not reflect current conditions:

```
Variation Source         | Map Impact                  | Compensation
-------------------------|-----------------------------|------------------
Snow cover               | Ground geometry changes     | Ground exclusion
Ice/frost                | Surface reflectivity change | Intensity-agnostic
De-icing fluid           | Puddles, spray contamination| Sensor health check
Construction             | Map features removed/added  | Fleet map updates
Night vs day             | Intensity distributions     | Geometry-only matching
Seasonal vegetation      | Tree/bush shape changes     | Vegetation exclusion
Wet vs dry pavement      | Ground reflectivity         | Geometry-only matching
```

---

## 13. Fallback Hierarchy and Graceful Degradation

### 13.1 Five-Level Localization Fallback

```
┌─────────────────────────────────────────────────────────────┐
│            LOCALIZATION FALLBACK HIERARCHY                   │
│                                                              │
│  Level 0: FULL LOCALIZATION                                 │
│  ├── VGICP scan-to-map + RTK-GPS + IMU + wheel odometry    │
│  ├── Accuracy: ±3-10 cm                                     │
│  ├── Speed limit: Full (25 km/h)                            │
│  └── Trigger: Normal operation, localizability > 0.7        │
│                                                              │
│  Level 1: NDT FALLBACK                                      │
│  ├── NDT scan-to-map + RTK-GPS + IMU + wheel odometry      │
│  ├── Accuracy: ±10-20 cm                                    │
│  ├── Speed limit: 15 km/h                                   │
│  └── Trigger: VGICP divergence, fitness < 0.3               │
│                                                              │
│  Level 2: GPS-PRIMARY                                       │
│  ├── RTK-GPS + IMU + wheel odometry (no scan matching)      │
│  ├── Accuracy: ±2-5 cm (RTK fix) or ±1-3 m (float/SBAS)   │
│  ├── Speed limit: 10 km/h (RTK fix), 5 km/h (float)        │
│  └── Trigger: Both VGICP and NDT fail, localizability < 0.2 │
│                                                              │
│  Level 3: DEAD RECKONING                                    │
│  ├── IMU + wheel odometry only                              │
│  ├── Accuracy: ±0.5 m/10 s drift (increasing with time)    │
│  ├── Speed limit: 5 km/h, max 30 seconds                   │
│  └── Trigger: GPS denied + scan matching failed             │
│                                                              │
│  Level 4: SAFE STOP                                         │
│  ├── Stop vehicle, request teleop/recovery                  │
│  ├── Trigger: Dead reckoning budget exceeded (>0.5 m unc.)  │
│  └── Recovery: Place recognition + GeoTransformer re-init   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 13.2 Transition Logic

```python
class LocalizationFallbackManager:
    """Manages transitions between localization levels."""
    
    LEVELS = {
        0: {'name': 'FULL', 'max_speed': 25.0, 'min_localizability': 0.7},
        1: {'name': 'NDT_FALLBACK', 'max_speed': 15.0, 'min_localizability': 0.4},
        2: {'name': 'GPS_PRIMARY', 'max_speed': 10.0, 'min_localizability': 0.0},
        3: {'name': 'DEAD_RECKONING', 'max_speed': 5.0, 'max_duration': 30.0},
        4: {'name': 'SAFE_STOP', 'max_speed': 0.0},
    }
    
    def __init__(self):
        self.current_level = 0
        self.level_entry_time = time.time()
        self.dr_start_time = None
        
        # Hysteresis: require sustained improvement to upgrade
        self.upgrade_hold_time = 5.0  # seconds
        self.upgrade_candidate_since = None
    
    def update(self, scan_match_quality, gps_status, imu_healthy, 
               wheel_odom_healthy):
        """Called every localization cycle. Returns current level and max speed."""
        
        # Determine best achievable level
        if (scan_match_quality.vgicp_fitness > 0.5 and 
            scan_match_quality.localizability > 0.7):
            target_level = 0
        elif (scan_match_quality.ndt_converged and 
              scan_match_quality.ndt_fitness > 0.4):
            target_level = 1
        elif gps_status in ('RTK_FIX', 'RTK_FLOAT', 'SBAS'):
            target_level = 2
        elif imu_healthy and wheel_odom_healthy:
            target_level = 3
        else:
            target_level = 4
        
        # Downgrade: immediate (safety)
        if target_level > self.current_level:
            self._transition_to(target_level)
        
        # Upgrade: requires sustained improvement (stability)
        elif target_level < self.current_level:
            if self.upgrade_candidate_since is None:
                self.upgrade_candidate_since = time.time()
            elif time.time() - self.upgrade_candidate_since > self.upgrade_hold_time:
                self._transition_to(target_level)
                self.upgrade_candidate_since = None
        else:
            self.upgrade_candidate_since = None
        
        # Dead reckoning timeout
        if self.current_level == 3:
            if self.dr_start_time is None:
                self.dr_start_time = time.time()
            elif time.time() - self.dr_start_time > 30.0:
                self._transition_to(4)  # Exceeded DR budget
        else:
            self.dr_start_time = None
        
        return self.current_level, self.LEVELS[self.current_level]['max_speed']
```

---

## 14. Orin Deployment and Real-Time Budgets

### 14.1 GPU Memory Layout

```
Orin AGX 64 GB shared memory allocation for localization:

Component                          | Memory    | Notes
-----------------------------------|-----------|---------------------------
Reference map (loaded tiles)        | 150-300 MB| 8-12 tiles × 15-25 MB each
NDT grids (coarse + fine)          | 10-50 MB  | Pre-computed at map load
Live scan buffer (double-buffered)  | 40 MB     | 2 × 20 MB for 1.2M points
VGICP working memory               | 80 MB     | Correspondences, Jacobians
KD-tree (fallback)                  | 40 MB     | For point-to-point ICP
Covariance matrices                 | 5 MB      | Per-voxel distributions
GTSAM graph                         | 20-50 MB  | Sliding window, ~100 poses
─────────────────────────────────────────────────────────
Total localization:                 | 345-565 MB| ~1-2% of 64 GB Orin AGX
                                   |           | ~1-2% of 32 GB Orin NX
```

### 14.2 CUDA Stream Architecture

```
Stream 0 (default): VGICP registration
Stream 1: Scan preprocessing (deskew, downsample, normal estimation)
Stream 2: NDT evaluation (runs in parallel, used as fallback)
Stream 3: Map tile loading (async NVMe → GPU transfer)

Timeline for one cycle (10 Hz):
  t=0 ms    Stream 1: Start preprocessing new scan
  t=3 ms    Stream 1: Done. Stream 0: Start VGICP
  t=3 ms    Stream 2: Start NDT (parallel with VGICP)
  t=12 ms   Stream 2: NDT done (result cached as fallback)
  t=20 ms   Stream 0: VGICP done
  t=20 ms   CPU: Quality check, factor creation, GTSAM update
  t=25 ms   CPU: Publish pose, update ESKF
  t=25 ms   Stream 3: Preload next tiles if needed
```

### 14.3 TensorRT for Learned Components

If using learned registration (GeoTransformer) or learned features:

```python
# TensorRT optimization for GeoTransformer backbone
import tensorrt as trt

def optimize_geotransformer_backbone(onnx_path, engine_path):
    """Build TensorRT engine for GeoTransformer feature extraction."""
    
    builder = trt.Builder(TRT_LOGGER)
    network = builder.create_network(
        1 << int(trt.NetworkDefinitionCreationFlag.EXPLICIT_BATCH))
    parser = trt.OnnxParser(network, TRT_LOGGER)
    
    with open(onnx_path, 'rb') as f:
        parser.parse(f.read())
    
    config = builder.create_builder_config()
    config.set_memory_pool_limit(trt.MemoryPoolType.WORKSPACE, 1 << 30)  # 1 GB
    config.set_flag(trt.BuilderFlag.FP16)  # FP16 for Orin
    
    # Dynamic shapes for variable point cloud sizes
    profile = builder.create_optimization_profile()
    profile.set_shape("source_points", 
                       min=(1, 1000, 3),
                       opt=(1, 15000, 3),
                       max=(1, 30000, 3))
    config.add_optimization_profile(profile)
    
    engine = builder.build_serialized_network(network, config)
    with open(engine_path, 'wb') as f:
        f.write(engine)
    
    return engine

# Inference timing on Orin (FP16):
# KPConv feature extraction: ~40-60 ms
# Transformer cross-attention: ~30-50 ms
# Superpoint matching + pose: ~10-20 ms
# Total: ~80-130 ms (for re-initialization only, not real-time)
```

### 14.4 Worst-Case Execution Time (WCET) Analysis

```
Component                    | Typical  | Worst Case | Deterministic?
-----------------------------|----------|------------|---------------
Scan deskewing (CUDA)        | 1.5 ms   | 3 ms       | Yes (bounded input)
Voxel downsample (CUDA)      | 1.0 ms   | 2 ms       | Yes (fixed output)
Normal estimation (CUDA)     | 1.5 ms   | 3 ms       | Yes (fixed k)
VGICP correspondence (CUDA)  | 3.0 ms   | 5 ms       | Yes (hash-based)
VGICP optimization (CPU+GPU) | 12.0 ms  | 25 ms      | Bounded iterations
NDT matching (CPU)           | 8.0 ms   | 15 ms      | Bounded iterations
Quality assessment (CPU)     | 0.5 ms   | 1 ms       | Yes
GTSAM ISAM2 update (CPU)    | 3.0 ms   | 8 ms       | Bounded by graph size
────────────────────────────────────────────────────────
Total pipeline               | 22 ms    | 40 ms      | Bounded within 50 ms
```

---

## 15. Non-AI Classical Methods Comparison

### 15.1 Complete Method Taxonomy

```
Category           | Method              | Accuracy    | Speed (Orin) | Maturity
-------------------|---------------------|-------------|-------------|----------
Point-to-Point     | ICP (SVD)           | ±10-20 cm   | 3-8 ms      | Textbook
Point-to-Plane     | ICP (linearized)    | ±5-15 cm    | 5-10 ms     | Standard
Generalized        | GICP                | ±3-10 cm    | 10-18 ms    | Proven
Voxelized          | VGICP (GPU)         | ±3-8 cm     | 15-25 ms    | Production
NDT                | 3D-NDT              | ±5-15 cm    | 5-12 ms     | Autoware
Multi-Res NDT      | MR-NDT              | ±5-10 cm    | 8-15 ms     | Autoware+
Feature-based      | LOAM-style          | ±5-12 cm    | 10-15 ms    | LIO-SAM
Correlative        | Scan correlation    | ±10-20 cm   | 20-40 ms    | Cartographer
Branch & Bound     | BBS (global)        | ±5-10 cm    | 100-500 ms  | Cartographer
RANSAC+FPFH        | Feature matching    | ±10-30 cm   | 30-80 ms    | Open3D
```

### 15.2 Classical Method Selection Guide for Airside

```
Scenario                    | Primary Method  | Fallback        | Rationale
----------------------------|-----------------|-----------------|------------------
Normal operation            | VGICP (GPU)     | MR-NDT          | Best accuracy
Stand area (high dynamics)  | VGICP + Cauchy  | Feature ICP     | Robust to outliers
Long straight taxiway       | NDT (degenerate)| GPS + odometry  | Along-track degenerate
Open apron                  | GPS primary     | NDT coarse      | Minimal structure
Cold start / recovery       | BBS or FPFH+ICP | Place recognition| Global search needed
Post-calibration            | VGICP (strict)  | None            | Verify calibration
```

---

## 16. AI-Based and Hybrid Methods

### 16.1 Learned Feature Descriptors for Matching

Instead of raw point coordinates, extract learned per-point features for more robust correspondence:

```
Method           | Feature Dim | Extraction Time | Matching Quality | Training Data
-----------------|-------------|-----------------|------------------|---------------
FPFH (classical) | 33          | 5-10 ms         | Good (structured)| None
FCGF             | 32          | 15-25 ms (GPU)  | Very good        | 3DMatch
DIP (D3Feat)     | 32          | 20-30 ms (GPU)  | Very good        | 3DMatch
Predator         | 256         | 30-50 ms (GPU)  | Best (low overlap)| 3DMatch
SpinNet          | 64          | 40-60 ms (GPU)  | Very good        | 3DMatch
```

**Production hybrid**: Use FPFH features for real-time correspondence initialization, learned features (FCGF) for verification when FPFH quality is low.

### 16.2 Neural Network Scan-to-Map Approaches

Fully learned scan-to-map localization — predict pose directly from scan + map:

```
Method              | Architecture            | Accuracy     | Speed    | Maturity
--------------------|-------------------------|-------------|----------|----------
PointLoc            | PointNet++ + attention  | ±15-30 cm   | 50 ms   | Research
DeepLocalization    | 3D CNN + regression     | ±10-20 cm   | 30 ms   | Research
LCDNet              | Sparse conv + head      | ±5-15 cm    | 40 ms   | Research
OverlapTransformer  | Range image transformer | ±10-25 cm   | 25 ms   | Emerging
LoGG3D-Net          | Local-global features   | ±8-18 cm    | 35 ms   | Emerging
```

**Current assessment**: No learned method matches classical VGICP accuracy (±3-8 cm) while being faster. Learned methods excel at handling large initial pose errors and low-overlap scenarios where classical methods fail. Best used as initialization for classical refinement.

### 16.3 Self-Supervised Map Representation Learning

Learn compressed map representations that encode the information needed for matching without storing full point clouds:

```
Approach             | Map Size Reduction | Matching Quality | Training
---------------------|-------------------|-----------------|----------
Neural Implicit Map  | 10-50x            | 85-95% of raw   | Scene-specific
Learned Descriptors  | 5-20x             | 90-98% of raw   | Pre-trained + finetune
Compressed Features  | 3-10x             | 95-99% of raw   | End-to-end
Hash-grid (InstantNGP)| 20-100x          | 90-95% of raw   | Scene-specific
```

**Potential for Aurrigo**: Reduce map tile sizes from 15-25 MB to 1-5 MB, enabling faster OTA distribution (see `../maps/map-tile-versioning-distribution.md`). Research-stage; not recommended for initial deployment.

### 16.4 Confidence-Aware Neural Registration

Train networks to output calibrated uncertainty alongside pose predictions:

```python
class UncertaintyAwareRegistration:
    """Neural registration with learned confidence estimation.
    
    Uses MC-Dropout or deep ensembles to provide calibrated uncertainty
    that feeds directly into GTSAM noise models.
    """
    
    def __init__(self, model_path, num_mc_samples=5):
        self.model = load_model(model_path)
        self.num_mc_samples = num_mc_samples
        
    def predict_with_uncertainty(self, source, target):
        """Run MC-Dropout inference for uncertainty estimation."""
        self.model.train()  # Enable dropout
        
        predictions = []
        for _ in range(self.num_mc_samples):
            with torch.no_grad():
                pose = self.model(source, target)
            predictions.append(pose.cpu().numpy())
        
        # Mean prediction
        mean_pose = np.mean(predictions, axis=0)
        
        # Covariance from sample spread
        covariance = np.cov(np.array(predictions).T)
        
        # Epistemic uncertainty (model uncertainty)
        epistemic = np.trace(covariance)
        
        return mean_pose, covariance, epistemic
```

---

## 17. End-to-End Pipeline Integration

### 17.1 Complete ROS Node Architecture

```
┌───────────────────────────────────────────────────────────┐
│              scan_to_map_localizer (ROS Node)              │
│                                                            │
│  Subscribers:                                              │
│  ├── /merged_cloud (sensor_msgs/PointCloud2, 10 Hz)       │
│  ├── /imu/data (sensor_msgs/Imu, 500 Hz)                 │
│  ├── /gps/fix (sensor_msgs/NavSatFix, 10 Hz)             │
│  ├── /wheel_odom (nav_msgs/Odometry, 50 Hz)              │
│  └── /map_manager/tile_update (custom, event-based)       │
│                                                            │
│  Publishers:                                               │
│  ├── /localization/pose (geometry_msgs/PoseWithCovStamped) │
│  ├── /localization/quality (custom LocalizationQuality)    │
│  ├── /localization/level (std_msgs/UInt8)                 │
│  ├── /localization/diagnostics (diagnostic_msgs/*)        │
│  └── /localization/debug_cloud (PointCloud2, optional)    │
│                                                            │
│  Services:                                                 │
│  ├── /localization/reinitialize (trigger re-localization)  │
│  └── /localization/set_map (load specific map version)    │
│                                                            │
│  Internal pipeline:                                        │
│  ┌──────────┐  ┌───────────────┐  ┌──────────────┐      │
│  │Preprocess│─▶│Coarse-to-Fine│─▶│Quality Check │      │
│  │  3-5 ms  │  │  15-25 ms     │  │  1-2 ms      │      │
│  └──────────┘  └───────────────┘  └──────┬───────┘      │
│                                           │               │
│  ┌──────────────┐  ┌──────────────┐  ┌───▼──────┐      │
│  │Fallback Mgr  │◀─│Degeneracy    │◀─│Factor    │      │
│  │              │  │Detection     │  │Creation  │      │
│  └──────────────┘  └──────────────┘  └──────────┘      │
└───────────────────────────────────────────────────────────┘
```

### 17.2 Configuration Parameters

```yaml
# scan_to_map_localizer.yaml
scan_preprocessing:
  voxel_size: 0.3              # meters, match reference map resolution
  min_range: 0.5               # meters, reject near-field noise
  max_range: 120.0             # meters
  statistical_outlier_k: 30    # k-NN for outlier removal
  statistical_outlier_std: 2.0 # std ratio for outlier rejection
  ground_segmentation: true
  ground_height_threshold: 0.15

vgicp:
  max_iterations: 20
  convergence_translation: 0.001  # meters
  convergence_rotation: 0.0001    # radians
  robust_kernel: cauchy
  kernel_delta: 0.5               # meters
  correspondence_max_distance: 2.0 # meters
  num_threads: 4

ndt:
  resolutions: [4.0, 1.5, 0.5]   # meters, coarse to fine
  max_iterations_per_level: [10, 15, 20]
  step_size: 0.1
  convergence_threshold: [0.1, 0.02, 0.005]

degeneracy:
  eigenvalue_ratio_threshold: 100.0
  localizability_thresholds:
    well_constrained: 0.7
    partially_degenerate: 0.4
    severely_degenerate: 0.2
    unusable: 0.1

fallback:
  level_0_max_speed: 25.0       # km/h
  level_1_max_speed: 15.0
  level_2_max_speed: 10.0
  level_3_max_speed: 5.0
  level_3_max_duration: 30.0    # seconds
  upgrade_hold_time: 5.0        # seconds of sustained improvement

tile_manager:
  tile_size: 100.0              # meters
  preload_radius: 200.0         # meters
  max_loaded_tiles: 12
  
noise_model:
  min_translation_sigma: 0.02  # meters
  min_rotation_sigma: 0.001    # radians
  fitness_scale: true
  degeneracy_inflation: 100.0  # m² in degenerate directions
```

### 17.3 Initialization Sequence

```python
def initialize_localization():
    """Cold start initialization sequence."""
    
    # Phase 1: Load default map tiles around last known position
    last_known = load_last_known_pose()  # From persistent storage
    if last_known is not None:
        tile_manager.load_tiles_around(last_known, radius=200)
    else:
        tile_manager.load_all_tiles()  # First boot — load everything
    
    # Phase 2: Get initial GPS fix
    gps_fix = wait_for_gps(timeout=30.0)
    
    if gps_fix is not None and gps_fix.status >= GPS_SBAS:
        # Phase 3a: GPS-guided initialization
        initial_guess = gps_to_map_frame(gps_fix)
        result = coarse_to_fine.align(current_scan, initial_guess)
        
        if result.fitness > 0.5:
            return result.pose  # Success: GPS + scan matching
    
    # Phase 3b: Place recognition initialization (GPS denied or poor)
    candidates = place_recognizer.query(current_scan, top_k=10)
    
    for candidate in candidates:
        # Verify with ICP
        result = vgicp.align(current_scan, candidate.pose, 
                             max_iterations=50)
        if result.fitness > 0.6:
            return result.pose  # Success: place recognition + ICP
    
    # Phase 3c: Global search (last resort)
    # Branch-and-bound or grid search over entire airport
    result = global_search(current_scan, tile_manager.get_all_maps(),
                           resolution=2.0, angular_resolution=5.0)
    
    if result is not None:
        return result.pose
    
    # Phase 4: Failed — request manual initialization or teleop
    raise LocalizationInitFailure("Cannot determine initial pose")
```

---

## 18. Monitoring, Diagnostics, and Certification

### 18.1 Real-Time Diagnostics

```python
class LocalizationDiagnostics:
    """Continuous monitoring of localization health for ISO 3691-4 compliance."""
    
    def __init__(self):
        self.metrics_history = RingBuffer(maxlen=6000)  # 10 min at 10 Hz
        self.alert_thresholds = {
            'fitness_low': 0.3,
            'localizability_low': 0.4,
            'convergence_iterations_high': 18,  # out of 20 max
            'correspondence_ratio_low': 0.3,    # inliers / total
            'covariance_trace_high': 0.1,       # m² (translational)
            'consecutive_failures': 3,
        }
    
    def update(self, quality_msg):
        """Process every localization quality message."""
        self.metrics_history.append(quality_msg)
        
        alerts = []
        
        # Instantaneous checks
        if quality_msg.fitness < self.alert_thresholds['fitness_low']:
            alerts.append(Alert('FITNESS_LOW', Severity.WARN))
        
        if quality_msg.localizability < self.alert_thresholds['localizability_low']:
            alerts.append(Alert('LOCALIZABILITY_LOW', Severity.WARN))
        
        # Trend checks (over last 60 seconds)
        recent = self.metrics_history.last(600)  # 60s at 10 Hz
        if len(recent) > 100:
            fitness_trend = np.polyfit(range(len(recent)), 
                                      [m.fitness for m in recent], 1)[0]
            if fitness_trend < -0.001:  # Decreasing fitness
                alerts.append(Alert('FITNESS_DEGRADING', Severity.INFO))
        
        # Consecutive failure detection
        consecutive_failures = 0
        for m in reversed(list(self.metrics_history)):
            if m.fitness < 0.2:
                consecutive_failures += 1
            else:
                break
        if consecutive_failures >= self.alert_thresholds['consecutive_failures']:
            alerts.append(Alert('CONSECUTIVE_FAILURES', Severity.ERROR))
        
        return alerts
```

### 18.2 Certification Evidence

For ISO 3691-4 and UL 4600 compliance, the localization system must provide:

| Requirement | Evidence | How Collected |
|-------------|----------|--------------|
| Accuracy specification | ±X cm in Y% of conditions | Offline validation on ground-truth dataset |
| Uncertainty calibration | ECE < 0.05 | Covariance vs actual error statistics |
| Fault detection rate | >99.9% within Z ms | Degeneracy + fitness monitoring |
| Recovery time | <T seconds from failure | Cold start + re-initialization tests |
| Deterministic timing | WCET < 50 ms | Static analysis + runtime profiling |
| Graceful degradation | Speed reduction table | Fallback hierarchy documentation |

### 18.3 Logging and Audit Trail

```python
class LocalizationAuditLogger:
    """Log all localization decisions for post-incident analysis."""
    
    def log_cycle(self, timestamp, scan_id, 
                  registration_result, quality, 
                  fallback_level, speed_limit,
                  degeneracy_info, factor_type):
        """Log one localization cycle. ~200 bytes per entry."""
        entry = {
            'ts': timestamp,
            'scan_id': scan_id,
            'pose': registration_result.pose.tolist(),
            'fitness': quality.fitness,
            'localizability': quality.localizability,
            'inlier_rmse': quality.inlier_rmse,
            'num_correspondences': quality.num_correspondences,
            'iterations': quality.iterations,
            'eigenvalue_ratios': quality.eigenvalue_ratios.tolist(),
            'degenerate_dofs': degeneracy_info.degenerate_dofs,
            'fallback_level': fallback_level,
            'speed_limit': speed_limit,
            'factor_type': factor_type.name,
            'covariance_trace': np.trace(quality.covariance[:3, :3]),
        }
        self.buffer.append(entry)
        
        # Flush every 100 entries or on safety event
        if len(self.buffer) >= 100 or fallback_level >= 3:
            self._flush_to_disk()
```

At 10 Hz, ~200 bytes per entry: **~7 MB/hour**, **~112 MB/16-hour shift**. Minimal storage cost for full audit trail.

---

## 19. Cost and Implementation Roadmap

### 19.1 Phase 1: Enhance Existing VGICP (Weeks 1-4, $8-15K)

| Task | Effort | Cost |
|------|--------|------|
| Add multi-resolution coarse-to-fine wrapper | 1 week | $2-4K |
| Implement eigenvalue-based degeneracy detection | 3 days | $1.5-3K |
| Add adaptive noise model for GTSAM factors | 3 days | $1.5-3K |
| Implement fallback hierarchy (5 levels) | 1 week | $2-4K |
| Testing and validation | 1 week | $2-4K |

**Deliverable**: Production-grade VGICP with degeneracy handling and graceful degradation.

### 19.2 Phase 2: Add NDT Fallback + Multi-LiDAR Strategies (Weeks 5-8, $10-18K)

| Task | Effort | Cost |
|------|--------|------|
| Port Autoware NDT to Aurrigo stack | 1.5 weeks | $3-6K |
| Implement selective multi-LiDAR matching (Strategy 3) | 1 week | $2-4K |
| Covariance intersection for multi-LiDAR fusion | 3 days | $1.5-3K |
| Map tile manager with async loading | 1 week | $2-4K |
| Integration testing on recorded data | 1 week | $2-4K |

**Deliverable**: Dual-method (VGICP + NDT) with intelligent multi-LiDAR selection.

### 19.3 Phase 3: Learned Components + Monitoring (Weeks 9-12, $12-20K)

| Task | Effort | Cost |
|------|--------|------|
| GeoTransformer integration for cold start | 1 week | $2-4K |
| TensorRT optimization for Orin | 1 week | $2-4K |
| Comprehensive diagnostics and audit logging | 1 week | $2-4K |
| Localizability scoring and speed envelope | 3 days | $1.5-3K |
| Certification evidence collection | 1 week | $3-5K |

**Deliverable**: Production-ready localization pipeline with learned fallback and certification readiness.

### 19.4 Total Cost

```
Phase 1 (core improvements):    $8-15K,   4 weeks
Phase 2 (redundancy):           $10-18K,  4 weeks
Phase 3 (advanced + cert):      $12-20K,  4 weeks
─────────────────────────────────────────────────
Total:                          $30-53K,  12 weeks

No additional hardware required — uses existing LiDARs, Orin, GPS, IMU.
```

---

## 20. Key Takeaways

1. **VGICP is the right primary method**: GPU-accelerated VGICP on Orin achieves ±3-8 cm at 15-25 ms — the best accuracy/speed tradeoff for airside. It matches Aurrigo's existing stack investment

2. **Multi-resolution coarse-to-fine is essential**: Single-resolution matching either has poor convergence basin or poor accuracy. Three-level NDT→NDT→VGICP provides both

3. **Degeneracy detection prevents silent failures**: Eigenvalue analysis on the Hessian reveals which pose directions are unconstrained. Without it, the system can "hallucinate" position updates in featureless areas

4. **Five-level fallback hierarchy**: VGICP → NDT → GPS → dead reckoning → safe stop. Each level has defined accuracy bounds, speed limits, and transition criteria. Downgrades are immediate; upgrades require sustained improvement (hysteresis)

5. **Airside has unique challenges**: 40-70% dynamic content at stands (aircraft + GSE), long degenerate taxiway segments, jet blast thermal shimmer, ground reflectivity variation. No road-driving benchmark captures these conditions

6. **Classical methods dominate production**: Point-to-point/plane ICP, GICP, and NDT are the workhorses. Learned methods (GeoTransformer, DCP) are valuable for initialization and recovery but too slow/unproven for real-time primary matching

7. **Adaptive noise models are critical**: Registration covariance must reflect actual confidence — fitness score, number of correspondences, degeneracy state. Overconfident noise models corrupt the GTSAM graph

8. **Dead-reckoning budget is 30 seconds**: IMU + wheel odometry accumulates ~0.5 m uncertainty in 30 seconds at airside speeds. Place recognition and GeoTransformer extend recovery beyond this window

9. **Per-LiDAR structural scoring optimizes compute**: Not all 4-8 LiDARs see useful structure. Selecting the best 2-3 for matching saves 30-50% compute while maintaining accuracy

10. **Full pipeline fits within 30 ms on Orin**: Preprocessing (5 ms) + coarse-to-fine registration (20 ms) + quality check (2 ms) + GTSAM update (3 ms) = 30 ms typical, 40 ms worst case. Well within the 100 ms cycle budget

---

## 21. References

### Classical Registration
- Besl & McKay (1992). "A Method for Registration of 3-D Shapes." IEEE TPAMI — original ICP
- Chen & Medioni (1992). "Object Modelling by Registration of Multiple Range Images." — point-to-plane ICP
- Segal, Haehnel & Thrun (2009). "Generalized-ICP." RSS — GICP formulation
- Koide et al. (2021). "Voxelized GICP for Fast and Accurate 3D Point Cloud Registration." ICRA — VGICP
- Biber & Strasser (2003). "The Normal Distributions Transform: A New Approach to Laser Scan Matching." IROS — NDT
- Magnusson et al. (2007). "Scan Registration for Autonomous Mining Vehicles Using 3D-NDT." Journal of Field Robotics — 3D NDT
- Stoyanov et al. (2012). "Fast and Accurate Scan Registration through Minimization of the Distance between Compact 3D NDT Representations." IJRR — NDT-D2D

### Feature-Based
- Zhang & Singh (2014). "LOAM: Lidar Odometry and Mapping in Real-time." RSS — LOAM features
- Shan & Englot (2018). "LeGO-LOAM." IROS — lightweight LOAM
- Shan, Englot, Meyers, et al. (2020). "LIO-SAM: Tightly-coupled Lidar Inertial Odometry via Smoothing and Mapping." IROS

### Learned Registration
- Wang & Solomon (2019). "Deep Closest Point." ICCV — DCP
- Yew & Lee (2022). "REGTR: End-to-end Point Cloud Correspondences with Transformers." CVPR
- Qin et al. (2023). "GeoTransformer: Fast and Robust Point Cloud Registration with Geometric Transformer." CVPR

### Degeneracy
- Zhang, Kaess & Singh (2016). "On Degeneracy of Optimization-based State Estimation Problems." ICRA — eigenvalue degeneracy detection
- Hinduja et al. (2019). "Degeneracy-Aware Factors with Applications to Underwater SLAM." IROS
- Tuna et al. (2024). "X-ICP: Localizability-Aware LiDAR Registration for Robust Localization in Extreme Environments." IEEE T-RO

### Production Systems
- Autoware Foundation. "ndt_scan_matcher" — production NDT implementation
- Koide et al. (2024). "GLIM: 3D Range-Inertial Localization and Mapping with GPU-Accelerated Scan Matching Factors." — GPU GTSAM integration
- Vizzo et al. (2023). "KISS-ICP: In Defense of Point-to-Point ICP." IEEE RA-L
- Xu et al. (2022). "FAST-LIO2: Fast Direct LiDAR-Inertial Odometry." IEEE T-RO — ikd-Tree

### State Estimation Integration
- Kaess et al. (2012). "iSAM2: Incremental Smoothing and Mapping Using the Bayes Tree." IJRR — GTSAM ISAM2
- Forster et al. (2017). "On-Manifold Preintegration for Real-Time Visual-Inertial Odometry." IEEE T-RO — IMU preintegration
