# Real-Time Occupancy Grid Mapping for Airport Airside Autonomous Vehicles

Occupancy grid mapping is the foundational spatial representation that sits between raw sensor data and motion planning. Unlike learned occupancy prediction (see `30-autonomy-stack/world-models/occupancy-deployment-orin.md`) which uses neural networks to hallucinate unseen space, classical occupancy grid mapping uses probabilistic raycasting to build a live, evidence-based map of what is free, what is occupied, and what is unknown -- directly from LiDAR measurements. For Aurrigo's 4-8 RoboSense LiDAR stack processing 400K-1.2M points every 100ms, this is the first line of spatial reasoning: a continuously-updated volumetric representation that feeds the Frenet planner's costmap, provides collision avoidance guarantees, and -- when shared across vehicles -- creates fleet-wide situational awareness of the airport apron. This document covers the theory (log-odds Bayesian update, inverse sensor models), the data structures (dense grids, octrees, voxel hashmaps, spatial hashing), GPU-accelerated implementation on NVIDIA Orin, multi-LiDAR fusion, dynamic object handling, multi-resolution strategies, TSDF/ESDF alternatives, costmap generation for path planning, fleet sharing protocols, and airside-specific adaptations for the unique geometry of aircraft stands, jet blast zones, and FOD detection. The existing Aurrigo stack has no explicit occupancy grid layer -- RANSAC segmentation feeds obstacle clusters directly to the Frenet planner. Adding a proper occupancy grid is the single highest-value perception infrastructure upgrade available today, costing approximately $25-40K in development while providing the spatial backbone for every downstream capability: neural occupancy, flow prediction, CBF safety filtering, and fleet cooperative perception.

---

## Table of Contents

1. [Occupancy Grid Fundamentals](#1-occupancy-grid-fundamentals)
2. [3D Voxel Representations](#2-3d-voxel-representations)
3. [GPU-Accelerated Raycasting](#3-gpu-accelerated-raycasting)
4. [Multi-LiDAR Occupancy Fusion](#4-multi-lidar-occupancy-fusion)
5. [Dynamic Object Handling](#5-dynamic-object-handling)
6. [Multi-Resolution Grids](#6-multi-resolution-grids)
7. [TSDF vs Occupancy vs ESDF](#7-tsdf-vs-occupancy-vs-esdf)
8. [Costmap Generation for Planning](#8-costmap-generation-for-planning)
9. [Fleet-Shared Occupancy](#9-fleet-shared-occupancy)
10. [Airside-Specific Considerations](#10-airside-specific-considerations)
11. [Implementation with ROS Noetic](#11-implementation-with-ros-noetic)
12. [Performance on Orin](#12-performance-on-orin)
13. [Key Takeaways](#13-key-takeaways)
14. [Implementation Roadmap](#14-implementation-roadmap)
15. [References](#15-references)

---

## 1. Occupancy Grid Fundamentals

### 1.1 The Problem

An autonomous vehicle needs to answer a deceptively simple question at every planning cycle: "Which regions of space around me are free to drive through, which are blocked, and which have I never observed?" This question must be answered:

- **In real-time** (10 Hz minimum for 30 km/h operations)
- **Probabilistically** (a single LiDAR return is noisy; repeated observations increase confidence)
- **Volumetrically** (aircraft wings overhang at 5m height; ground-level FOD is <10cm)
- **Consistently** (sensor noise should not cause the map to flicker between free and occupied)

The occupancy grid, introduced by Moravec and Elfes (1985), discretizes space into cells (2D) or voxels (3D) and maintains a probability of occupancy for each. Forty years later, it remains the dominant representation for real-time spatial reasoning in robotics -- not because nothing better has been proposed, but because its mathematical simplicity, update speed, and interpretability make it uniquely suited as the foundation layer that everything else builds upon.

### 1.2 2D vs 3D Occupancy Grids

| Property | 2D Grid | 3D Grid |
|----------|---------|---------|
| **Representation** | Top-down bird's-eye-view | Volumetric voxel grid |
| **Cell content** | P(occupied) for ground plane | P(occupied) per voxel |
| **Memory (100m x 100m)** | 250K cells at 0.2m | 250K x 40 = 10M voxels at 0.2m |
| **Planning use** | Direct costmap for 2D planner | Requires projection to 2D for ground planner |
| **Vertical resolution** | None (height collapsed) | Resolves overhanging structures |
| **Airside problem** | Cannot distinguish wing overhang (passable) from fuselage (blocked) | Correctly models 3D aircraft geometry |
| **Compute cost** | Trivial (<1ms) | Significant (5-50ms) |
| **Standard message** | `nav_msgs/OccupancyGrid` | `octomap_msgs/Octomap` or custom |

**For airside operations, 3D is mandatory.** Aircraft wings overhang at 4-6m above ground. A 2D grid that collapses height sees the wing shadow as "occupied" and blocks all paths under the wing. A 3D grid correctly marks the wing voxels as occupied at z=5m while showing the ground-level voxels as free. The ADT3's height is approximately 2.5m -- it can pass under most aircraft wings, but only a 3D representation can make that determination.

However, the **planner itself operates in 2D** (the Frenet planner generates lateral/longitudinal trajectories on a reference path). The architecture is therefore: maintain a 3D occupancy grid, project to a height-filtered 2D costmap for planning. Section 8 covers this projection in detail.

### 1.3 Binary vs Probabilistic Occupancy

**Binary occupancy** assigns each cell a hard label: occupied (1), free (0), unknown (-1). Simple and fast, but fragile:

```
Binary update: single noisy LiDAR return marks cell as occupied.
Next scan: no return in that cell → cell flips to free.
Result: map flickers every frame. Planner sees phantom obstacles.
```

**Probabilistic occupancy** maintains a continuous probability P(occupied) in [0, 1] for each cell. Multiple consistent observations drive the probability toward 0 or 1. A single noisy reading barely moves the probability. This is the correct approach for any real-world deployment.

### 1.4 Log-Odds Representation

Maintaining probabilities directly is numerically problematic. The recursive Bayesian update requires multiplication:

```
P(occ | z_{1:t}) = P(z_t | occ) * P(occ | z_{1:t-1}) / P(z_t)
```

Repeatedly multiplying probabilities causes underflow. The **log-odds** representation (Thrun, Burgard, Fox 2005) solves this:

```
l(x) = log( P(occ=1|x) / P(occ=0|x) )

Properties:
  l = 0      → P = 0.5 (unknown, no evidence)
  l → +∞     → P → 1.0 (certainly occupied)
  l → -∞     → P → 0.0 (certainly free)
  l = +2.2   → P ≈ 0.9
  l = -2.2   → P ≈ 0.1
```

The Bayesian update in log-odds is pure addition:

```
l(x | z_{1:t}) = l(x | z_{1:t-1}) + l(x | z_t) - l_0

Where:
  l(x | z_{1:t-1}) = prior log-odds (accumulated from all previous observations)
  l(x | z_t)       = log-odds from current measurement (inverse sensor model)
  l_0               = log(P_prior / (1 - P_prior)) = 0 when P_prior = 0.5
```

**Why log-odds is perfect for real-time systems:**

1. **Addition instead of multiplication** -- numerically stable, no underflow
2. **O(1) per cell update** -- no normalization needed
3. **Trivially parallelizable** -- each cell updates independently (GPU-friendly)
4. **Clamping is simple** -- clamp l to [-L_max, +L_max] to prevent over-confidence
5. **Memory-efficient** -- store as int16 (65,536 levels) or even int8 (256 levels)

```python
"""
Log-odds occupancy update -- the core algorithm.
This runs per-cell, per-observation. GPU version parallelizes over all cells.
"""
import numpy as np

# Configuration
L_OCC = 0.85     # Log-odds increment when a ray hits this cell (occupied)
L_FREE = -0.4    # Log-odds increment when a ray passes through this cell (free)
L_MAX = 4.6      # Clamp value (corresponds to P ≈ 0.99)
L_MIN = -4.6     # Clamp value (corresponds to P ≈ 0.01)

def log_odds_update(grid, ray_cells, hit_cell):
    """
    Update occupancy grid along a single LiDAR ray.
    
    Args:
        grid: np.array of log-odds values (float32 or int16)
        ray_cells: list of (i, j, k) cell indices along the ray (excluding hit)
        hit_cell: (i, j, k) cell index where the ray terminated (the LiDAR return)
    """
    # All cells the ray passed through are evidence of "free"
    for cell in ray_cells:
        grid[cell] += L_FREE
        grid[cell] = max(grid[cell], L_MIN)  # Clamp
    
    # The cell where the ray terminated is evidence of "occupied"
    grid[hit_cell] += L_OCC
    grid[hit_cell] = min(grid[hit_cell], L_MAX)  # Clamp

def log_odds_to_probability(l):
    """Convert log-odds to probability."""
    return 1.0 - 1.0 / (1.0 + np.exp(l))
```

### 1.5 Inverse Sensor Model for LiDAR

The inverse sensor model maps a LiDAR measurement to log-odds updates for each cell. For LiDAR, the model is straightforward because LiDAR provides direct range measurements along known ray directions:

```
Given: LiDAR at position p_sensor, measurement at point p_hit
       with range r = ||p_hit - p_sensor||

For a cell at position p_cell:
  d = distance from p_sensor to p_cell along the ray direction
  
  If d < r - ε:        → cell is FREE  (ray passed through it)
  If |d - r| < ε:      → cell is OCCUPIED (ray terminated here)
  If d > r + ε:        → cell is UNKNOWN (no information beyond the hit point)

Where ε is a small tolerance (typically half a voxel size)
```

```
     Sensor                        Hit
     ══╤══ ─────────────────────── ●═══ ?????
     ║                             ║
     ║   FREE cells (ray passed)   ║ OCC ║  Unknown
     ║                             ║     ║  (behind)
```

**Asymmetric update strengths are critical.** A ray passing through a cell provides strong evidence of "free" (nothing was there). A ray hitting a cell provides somewhat weaker evidence of "occupied" (could be noise, dust, rain). Typical values:

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `L_OCC` (hit) | +0.7 to +1.0 | Single hit is moderate evidence |
| `L_FREE` (pass-through) | -0.3 to -0.5 | Pass-through is weaker per-ray but accumulates fast |
| `L_MAX` (clamp) | +3.5 to +5.0 | P=0.97-0.99, prevents over-confidence |
| `L_MIN` (clamp) | -3.5 to -5.0 | P=0.01-0.03, prevents over-confidence |
| `L_PRIOR` | 0.0 | P=0.5, no prior information |

**Why asymmetric?** A cell that has been confirmed free by 10 passing rays should not become "occupied" from a single noisy return. The asymmetry makes the map conservative -- it takes more evidence to mark something as occupied than as free, preventing phantom obstacles.

**Airside tuning note:** For airport operations, the asymmetry should be reversed for safety-critical zones (near aircraft, in jet blast areas). In those zones, a single occupied observation should immediately raise the probability, while many free observations are needed to clear the cell. This implements the "assume occupied until proven otherwise" safety principle.

### 1.6 Comparison with Occupancy Prediction Networks

| Aspect | Classical Occupancy Grid | Neural Occupancy Prediction |
|--------|-------------------------|----------------------------|
| **Method** | Raycasting + Bayesian update | Forward pass through CNN/Transformer |
| **Training data** | None | Thousands of annotated frames |
| **Occlusion handling** | Reports "unknown" | Predicts behind occlusions |
| **Semantic labels** | No (binary free/occupied) | Yes (per-class) |
| **Novel objects** | Detects any solid object | Detects if trained on similar objects |
| **Accuracy** | Exact to sensor noise | ~30-40 mIoU (benchmark) |
| **Latency** | 2-20ms | 10-100ms |
| **Deterministic** | Yes | No (inference variance) |
| **Certifiable** | Yes (fully inspectable math) | Difficult (black box) |
| **Use case** | Safety baseline, planning costmap | Scene understanding, prediction |

**The two are complementary, not competing.** Classical occupancy provides the certifiable safety baseline (see `60-safety-validation/runtime-assurance/runtime-verification-monitoring.md` -- Simplex BC). Neural occupancy provides richer understanding. The architecture is:

```
Classical occupancy grid (always running, 5-20ms, certifiable)
  → Safety costmap → Frenet planner (safety-critical path)

Neural occupancy prediction (running in parallel, 20-100ms)
  → Semantic costmap → Neural planner (performance path)
```

---

## 2. 3D Voxel Representations

### 2.1 The Memory Problem

A naive dense 3D voxel grid is unusable for large spaces:

```
Airport apron coverage: 200m x 200m x 8m (ground to aircraft tail)
At 0.2m resolution: 1000 x 1000 x 40 = 40,000,000 voxels

Memory per voxel:
  - float32 log-odds:  4 bytes → 160 MB
  - int16 log-odds:    2 bytes →  80 MB
  - int8 log-odds:     1 byte  →  40 MB

At 0.1m resolution: 2000 x 2000 x 80 = 320,000,000 voxels
  - float32: 1.28 GB — unacceptable on Orin with 32 GB shared memory
```

For a 200m apron at fine resolution, dense grids consume too much memory. But most of that space is empty air -- only a thin shell near surfaces and the ground plane is interesting. This motivates sparse representations.

### 2.2 Representation Comparison

| Representation | Memory | Query O() | Insert O() | GPU-Friendly | Dynamic Update | Notes |
|---------------|--------|-----------|-----------|--------------|----------------|-------|
| **Dense 3D array** | O(N^3) | O(1) | O(1) | Excellent | Excellent | Unusable for large spaces |
| **Octree (OctoMap)** | O(N_occupied * log N) | O(log N) | O(log N) | Poor | Moderate | Classic, CPU-bound |
| **Voxel hashmap** | O(N_occupied) | O(1) amortized | O(1) amortized | Good | Good | VDBFusion, nvblox |
| **Spatial hashing** | O(N_occupied) | O(1) | O(1) | Excellent | Excellent | Custom GPU implementations |
| **Block-sparse (VDB)** | O(N_blocks) | O(1) | O(1) | Good (OpenVDB GPU) | Good | OpenVDB heritage |
| **Multi-resolution dense** | O(sum N_i^3) | O(1) | O(1) | Excellent | Excellent | Multiple grids at different resolutions |

### 2.3 OctoMap: The Classic

OctoMap (Hornung et al., 2013) was the first widely-used 3D occupancy framework in robotics. It uses an octree -- a tree where each node has 8 children, recursively subdividing 3D space.

**Architecture:**

```
Root node (covers entire map volume)
  ├── Child 0 (octant 0)
  │   ├── Child 0.0 ... (subdivide further if heterogeneous)
  │   └── Child 0.7
  ├── ...
  └── Child 7 (octant 7)

Key property: homogeneous regions are represented by a single node.
  - Large empty area → single "free" node covering whole region
  - Large solid area → single "occupied" node
  - Only surfaces require fine subdivision

Memory: proportional to surface area, not volume
  - For a 200m x 200m apron at 0.1m: ~2-10M nodes (~50-250 MB)
  - Much better than 320M voxels for dense grid
```

**OctoMap strengths:**
- Proven in thousands of real robot deployments
- Lossless multi-resolution (query at any level)
- Built-in log-odds occupancy update
- `octomap_server` ROS package provides full pipeline
- Serialization for saving/loading maps

**OctoMap weaknesses for Aurrigo:**
- **CPU-only**: Tree traversal is inherently sequential, resists GPU parallelization
- **Slow raycasting**: Each ray requires tree traversal for every cell it passes through
- **Cache-unfriendly**: Pointer-chasing through the tree causes L1/L2 cache misses
- **Performance**: ~3-10 Hz on a single LiDAR at automotive resolution on modern CPUs
- **Insufficient throughput**: 4-8 LiDARs at 10 Hz = 40-80 updates/second; OctoMap cannot keep up

**OctoMap benchmarks (approximate, single-threaded CPU):**

| Configuration | Resolution | Update Rate | Memory |
|--------------|-----------|------------|--------|
| 1 LiDAR, 100K pts | 0.1m | 3-8 Hz | ~200 MB |
| 1 LiDAR, 100K pts | 0.2m | 8-15 Hz | ~80 MB |
| 4 LiDARs merged, 400K pts | 0.1m | 1-3 Hz | ~400 MB |
| 4 LiDARs merged, 400K pts | 0.2m | 3-6 Hz | ~150 MB |

**Verdict:** OctoMap is a useful reference implementation and works for prototyping, but its CPU-bound nature makes it unsuitable for production multi-LiDAR operation at Aurrigo's data rates.

### 2.4 VDBFusion: OpenVDB Meets Robotics

VDBFusion (Vizzo et al., RAL 2022) brings OpenVDB -- the hierarchical sparse data structure developed by DreamWorks Animation for visual effects -- to real-time TSDF mapping.

**OpenVDB data structure:**

```
Level 0: Root node (hash map of Level 1 pointers)
  Level 1: Internal node (32^3 = 32K children, 4KB bitmask)
    Level 2: Internal node (16^3 = 4K children, 512B bitmask)
      Level 3: Leaf node (8^3 = 512 voxels, dense)

Key properties:
  - Root hash map provides O(1) access to any region of space
  - Internal nodes use bitmasks (not pointers) for active children
  - Leaf nodes are dense 8^3 blocks — cache-friendly
  - Empty regions consume zero memory
  - Adjacent leaf nodes are likely allocated nearby in memory → spatial locality
```

**VDBFusion performance (from paper):**

| Dataset | Resolution | FPS (CPU) | Memory | Comparison to OctoMap |
|---------|-----------|----------|--------|----------------------|
| Newer College (LiDAR) | 0.1m | 40+ Hz | ~100 MB | 5-10x faster |
| Newer College (LiDAR) | 0.05m | 20+ Hz | ~300 MB | 4-8x faster |
| KITTI (LiDAR) | 0.1m | 30+ Hz | ~80 MB | 4-6x faster |

**VDBFusion strengths:**
- 5-10x faster than OctoMap on CPU
- Memory-efficient sparse representation
- Handles unbounded environments (no pre-allocated grid)
- TSDF output (useful for mesh extraction, ESDF computation)
- Open source (MIT license): `https://github.com/PRBonn/vdbfusion`

**VDBFusion limitations:**
- Still CPU-based (OpenVDB GPU support is experimental as of 2025)
- TSDF, not occupancy (requires conversion -- see Section 7)
- Less mature than OctoMap in the ROS ecosystem
- No built-in multi-resolution (though VDB natively supports it)

### 2.5 Spatial Hashing for GPU

The most GPU-friendly approach is spatial hashing: use a hash function to map 3D voxel coordinates to a flat array.

```cpp
/**
 * GPU spatial hash for occupancy grid.
 * Each voxel is addressed by hashing its (x, y, z) integer coordinate.
 * Collisions handled by open addressing (linear probing).
 */

// Hash function (FNV-1a variant for 3D coordinates)
__device__ uint32_t spatial_hash(int3 coord, uint32_t table_size) {
    uint32_t h = 2166136261u;
    h ^= (uint32_t)coord.x; h *= 16777619u;
    h ^= (uint32_t)coord.y; h *= 16777619u;
    h ^= (uint32_t)coord.z; h *= 16777619u;
    return h % table_size;
}

struct VoxelEntry {
    int3 coord;        // Voxel coordinate (or EMPTY sentinel)
    int16_t log_odds;  // Occupancy log-odds
    uint16_t timestamp; // Last observation time (for recency weighting)
};

// Table: flat array of VoxelEntry, pre-allocated on GPU
// Typical size: 4-16M entries (~32-128 MB for 8-byte entries)
```

**Spatial hashing advantages:**
- **O(1) lookup and insert** (amortized, with good hash function)
- **Massively parallel**: thousands of CUDA threads update simultaneously
- **Fixed memory**: pre-allocate the hash table, no dynamic allocation on GPU
- **Cache-friendly**: flat array, sequential memory access for nearby voxels
- **Simple**: ~200 lines of CUDA code for complete implementation

**Spatial hashing disadvantages:**
- Load factor matters: >70% occupancy causes collision chains, performance degrades
- No inherent multi-resolution (must maintain separate tables)
- No tree structure for hierarchical queries (e.g., "is this entire 1m^3 region free?")
- Pre-allocation means fixed maximum occupied voxels

**For Orin:** Spatial hashing is the recommended approach for custom GPU occupancy grids. Pre-allocate a 4-8M entry table (~32-64 MB), which can represent 4-8M occupied or observed voxels -- more than sufficient for a 200m airport apron.

### 2.6 nvblox Internal Representation

nvblox (NVIDIA) uses a block-based spatial hashing approach internally:

```
nvblox data structure:
  - Space divided into blocks (default: 8x8x8 voxels per block)
  - Blocks stored in a GPU hash map
  - Each block is a dense 8^3 array (512 voxels, contiguous memory)
  - Only blocks near surfaces are allocated

This is essentially VDB Level 3 (leaf nodes only) with a hash map root.

Performance benefit:
  - Hash map lookup to find the block: O(1)
  - Dense array index within block: O(1)
  - No pointer chasing (unlike octrees)
  - Blocks are cache-line sized for GPU
```

nvblox is covered in detail in `30-autonomy-stack/world-models/occupancy-deployment-orin.md` Section 6. This document focuses on the broader occupancy grid architecture, where nvblox is one implementation option.

### 2.7 Representation Decision Matrix for Aurrigo

| Criterion | OctoMap | VDBFusion | Spatial Hash (Custom) | nvblox |
|-----------|---------|-----------|----------------------|--------|
| **Throughput (4-8 LiDARs)** | Insufficient | Marginal | Excellent | Good |
| **GPU utilization** | None | Minimal | Full | Full |
| **Memory efficiency** | Good | Good | Moderate | Good |
| **Multi-resolution** | Native | Possible | Manual | Block-level |
| **ROS integration** | Excellent | Moderate | Custom | ROS 2 (needs bridge) |
| **Dynamic objects** | Manual | Manual | Manual | Built-in (ESDF decay) |
| **Development effort** | Low (pkg exists) | Medium | High | Medium |
| **Certifiability** | Good (simple math) | Good | Good | Moderate (NVIDIA binary) |
| **Recommended phase** | Prototype only | Not recommended | Phase 2 (custom perf) | Phase 1 (fast start) |

**Recommendation:** Start with nvblox (Phase 1) for rapid deployment, then develop a custom GPU spatial hashing occupancy node (Phase 2) for full control, certifiability, and maximum performance.

---

## 3. GPU-Accelerated Raycasting

### 3.1 The Raycasting Problem

For each LiDAR point, we must:
1. Cast a ray from the sensor origin to the hit point
2. Mark all voxels along the ray as "free" (log-odds decrement)
3. Mark the voxel containing the hit point as "occupied" (log-odds increment)

For 4-8 LiDARs at 10 Hz producing 400K-1.2M points per 100ms, this means 400K-1.2M rays per frame, each traversing 10-500 voxels (depending on range and resolution). Total voxel updates per frame: **4M-100M+**.

This is inherently parallel -- each ray is independent -- making it ideal for GPU computation.

### 3.2 Ray Marching Algorithms

Two primary algorithms for traversing a ray through a voxel grid:

**Bresenham's 3D Line Algorithm:**
```
Extends 2D Bresenham to 3D. Steps through voxels one at a time,
always choosing the voxel that minimizes error from the ideal ray line.

Pros: Integer-only arithmetic, no floating point needed
Cons: Branches on every step (bad for GPU warp divergence)
      Not constant-time per step
```

**3D-DDA (Digital Differential Analyzer):**
```
Computes the parametric t-value at which the ray crosses each axis-aligned
voxel boundary. Advances to the nearest boundary at each step.

For ray: p(t) = origin + t * direction

Initialize:
  t_max_x = t at first x-boundary crossing
  t_max_y = t at first y-boundary crossing
  t_max_z = t at first z-boundary crossing
  t_delta_x = t to cross one x-voxel = voxel_size / |dir.x|
  t_delta_y = t to cross one y-voxel = voxel_size / |dir.y|
  t_delta_z = t to cross one z-voxel = voxel_size / |dir.z|

Step:
  If t_max_x < t_max_y and t_max_x < t_max_z:
    advance in x, t_max_x += t_delta_x
  Elif t_max_y < t_max_z:
    advance in y, t_max_y += t_delta_y
  Else:
    advance in z, t_max_z += t_delta_z

Pros: Simple branches (3-way), predictable step count
      Well-suited for GPU (minimal divergence within warps)
Cons: Floating point arithmetic (but GPU has fast FP units)
```

**For GPU implementation, 3D-DDA is strongly preferred.** The regular step pattern and minimal branching result in better warp utilization on NVIDIA hardware.

### 3.3 CUDA Raycasting Kernel

```cpp
/**
 * GPU kernel: raycast all LiDAR points into occupancy grid.
 * One CUDA thread per LiDAR point (ray).
 * 
 * Grid stored as spatial hash table (Section 2.5).
 * Log-odds updates via atomicAdd for thread safety.
 */

__global__ void raycast_occupancy_kernel(
    const float3* __restrict__ points,     // LiDAR hit points (N x 3)
    const float3 sensor_origin,            // Sensor position in world frame
    const int num_points,
    VoxelEntry* __restrict__ hash_table,   // GPU spatial hash table
    const uint32_t table_size,
    const float voxel_size,
    const int16_t l_occ,                   // Log-odds increment for occupied
    const int16_t l_free,                  // Log-odds decrement for free
    const int16_t l_max,                   // Clamp max
    const int16_t l_min,                   // Clamp min
    const uint16_t timestamp               // Current frame timestamp
) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx >= num_points) return;
    
    float3 hit = points[idx];
    float3 dir = make_float3(
        hit.x - sensor_origin.x,
        hit.y - sensor_origin.y,
        hit.z - sensor_origin.z
    );
    float ray_length = sqrtf(dir.x*dir.x + dir.y*dir.y + dir.z*dir.z);
    
    // Skip invalid points (too close or too far)
    if (ray_length < 0.5f || ray_length > 150.0f) return;
    
    // Normalize direction
    float inv_len = 1.0f / ray_length;
    dir.x *= inv_len; dir.y *= inv_len; dir.z *= inv_len;
    
    // 3D-DDA initialization
    float inv_voxel = 1.0f / voxel_size;
    int3 voxel = make_int3(
        __float2int_rd(sensor_origin.x * inv_voxel),
        __float2int_rd(sensor_origin.y * inv_voxel),
        __float2int_rd(sensor_origin.z * inv_voxel)
    );
    int3 hit_voxel = make_int3(
        __float2int_rd(hit.x * inv_voxel),
        __float2int_rd(hit.y * inv_voxel),
        __float2int_rd(hit.z * inv_voxel)
    );
    
    int3 step = make_int3(
        (dir.x >= 0) ? 1 : -1,
        (dir.y >= 0) ? 1 : -1,
        (dir.z >= 0) ? 1 : -1
    );
    
    float3 t_delta = make_float3(
        fabsf(voxel_size / dir.x),
        fabsf(voxel_size / dir.y),
        fabsf(voxel_size / dir.z)
    );
    
    // Compute initial t_max for each axis
    float3 t_max;
    t_max.x = ((dir.x >= 0 ? (voxel.x + 1) : voxel.x) * voxel_size 
               - sensor_origin.x) / dir.x;
    t_max.y = ((dir.y >= 0 ? (voxel.y + 1) : voxel.y) * voxel_size 
               - sensor_origin.y) / dir.y;
    t_max.z = ((dir.z >= 0 ? (voxel.z + 1) : voxel.z) * voxel_size 
               - sensor_origin.z) / dir.z;
    
    // March along the ray, marking cells as free
    int max_steps = (int)(ray_length * inv_voxel) + 2;
    for (int s = 0; s < max_steps; s++) {
        // Check if we've reached the hit voxel
        if (voxel.x == hit_voxel.x && 
            voxel.y == hit_voxel.y && 
            voxel.z == hit_voxel.z) {
            break;
        }
        
        // Update this voxel as FREE
        uint32_t h = spatial_hash(voxel, table_size);
        // Insert-or-update with atomic operations
        atomic_log_odds_update(hash_table, h, voxel, l_free, l_min, l_max, 
                               timestamp, table_size);
        
        // DDA step: advance to next voxel boundary
        if (t_max.x < t_max.y) {
            if (t_max.x < t_max.z) {
                voxel.x += step.x;
                t_max.x += t_delta.x;
            } else {
                voxel.z += step.z;
                t_max.z += t_delta.z;
            }
        } else {
            if (t_max.y < t_max.z) {
                voxel.y += step.y;
                t_max.y += t_delta.y;
            } else {
                voxel.z += step.z;
                t_max.z += t_delta.z;
            }
        }
    }
    
    // Mark the hit voxel as OCCUPIED
    uint32_t h = spatial_hash(hit_voxel, table_size);
    atomic_log_odds_update(hash_table, h, hit_voxel, l_occ, l_min, l_max, 
                           timestamp, table_size);
}

/**
 * Atomic log-odds update with spatial hash collision handling.
 * Uses compare-and-swap for thread-safe insertion.
 */
__device__ void atomic_log_odds_update(
    VoxelEntry* table, uint32_t hash_start, int3 coord,
    int16_t delta, int16_t l_min, int16_t l_max,
    uint16_t timestamp, uint32_t table_size
) {
    uint32_t h = hash_start;
    for (int probe = 0; probe < 32; probe++) {  // Max 32 probes
        VoxelEntry* entry = &table[h];
        
        // Try to claim empty slot
        int old = atomicCAS((int*)&entry->coord.x, EMPTY_SENTINEL, coord.x);
        if (old == EMPTY_SENTINEL || old == coord.x) {
            // Either we claimed it or it's already ours
            if (old == EMPTY_SENTINEL) {
                entry->coord = coord;  // Initialize
            }
            if (entry->coord.x == coord.x && 
                entry->coord.y == coord.y && 
                entry->coord.z == coord.z) {
                // Atomic log-odds update
                atomicAdd(&entry->log_odds, delta);
                // Clamp (race-safe: slight over-clamp is acceptable)
                if (entry->log_odds > l_max) entry->log_odds = l_max;
                if (entry->log_odds < l_min) entry->log_odds = l_min;
                entry->timestamp = timestamp;
                return;
            }
        }
        // Collision: linear probe
        h = (h + 1) % table_size;
    }
    // Table full or too many collisions — drop this update (safe: conservative)
}
```

### 3.4 Raycasting Performance Analysis

**Theoretical throughput on Orin AGX (2048 CUDA cores, ~1.3 GHz):**

```
Per ray: ~50-500 voxel updates (depends on range / voxel_size)
Average ray: ~100 voxel updates at 0.2m resolution, 20m average range

Per voxel update: ~20 cycles (hash + atomic + DDA step)
  → Per ray: ~2000 cycles → ~1.5 microseconds

Points per frame: 300K (4 LiDARs) to 900K (8 LiDARs)
  
At 2048 cores:
  300K rays: 300K / 2048 * 1.5us ≈ 0.22ms per wave * ~150 waves ≈ 0.2ms
  (Actual: 2-5ms due to memory bandwidth, hash collisions, warp divergence)

Memory bandwidth:
  300K rays * 100 voxels * 8 bytes (read+write) = 240 MB / frame
  Orin bandwidth: 204.8 GB/s → 240 MB / 204.8 GB/s ≈ 1.2ms
  (Bandwidth-limited, not compute-limited)
```

**Expected GPU raycasting performance on Orin AGX:**

| Points/Frame | Resolution | Est. Latency | Bottleneck |
|-------------|-----------|-------------|-----------|
| 150K (2 LiDARs) | 0.2m | 1-3ms | Compute |
| 300K (4 LiDARs) | 0.2m | 3-6ms | Memory bandwidth |
| 600K (6 LiDARs) | 0.2m | 5-10ms | Memory bandwidth |
| 900K (8 LiDARs) | 0.2m | 8-15ms | Memory bandwidth |
| 300K (4 LiDARs) | 0.1m | 5-10ms | Both (2x more voxels per ray) |
| 300K (4 LiDARs) | 0.4m | 2-4ms | Compute |

**Key insight:** At 0.2m resolution with 4-8 LiDARs, GPU raycasting on Orin fits comfortably within the 100ms planning cycle, consuming 3-15ms of GPU time and leaving ample headroom for other tasks.

### 3.5 Optimization Techniques

**1. Ray subsampling:**
Not every ray needs to update every voxel. For long-range rays (>50m), subsample free-space updates to every Nth voxel. The hit point always updates at full resolution.

```
Subsampling strategy:
  Range 0-20m:   update every voxel (full raycasting)
  Range 20-50m:  update every 2nd voxel along ray
  Range 50-100m: update every 4th voxel along ray
  Range >100m:   only update hit voxel + 3 nearest free voxels

Result: ~40-60% fewer voxel updates, <5% accuracy loss
```

**2. Skip-empty optimization:**
If the hash table has no entry for a voxel and the voxel is along a free-space ray, skip the update entirely (the default state is "unknown" = 0 log-odds, which is fine for free space confirmation along long rays). Only create hash entries near surfaces.

**3. Batch coalesced access:**
Sort rays by direction (using a quick radix sort on the octant) so that rays in the same warp traverse nearby voxels, improving GPU cache utilization.

**4. Reduced free-space range:**
Instead of raycasting from sensor origin, start free-space marking 2-3m in front of the sensor (ego vehicle body is always free). Saves ~10-15% of voxel updates.

---

## 4. Multi-LiDAR Occupancy Fusion

### 4.1 The Aurrigo Multi-LiDAR Configuration

Aurrigo vehicles use 4-8 RoboSense LiDARs (RSHELIOS, RSBP) mounted around the vehicle for 360-degree coverage. Each LiDAR runs at 10 Hz, producing 50K-150K points per scan.

```
Typical ADT3 configuration (8 LiDARs):
  
  Front-left RSHELIOS  ────┐
  Front-right RSHELIOS ────┤
  Rear-left RSHELIOS   ────┤  Merged in /lidar_merger node
  Rear-right RSHELIOS  ────┤  → single PointCloud2 topic
  Left RSBP            ────┤
  Right RSBP           ────┤
  Front-center RSBP    ────┤
  Rear-center RSBP     ────┘
  
  Total points per cycle: 400K-1.2M
  Total data rate: ~40-120 MB/s (xyzi, float32)
```

### 4.2 Fusion Strategies

**Strategy 1: Merge-then-raycast (current approach recommendation)**

```
All LiDARs → transform to vehicle frame → merge into single cloud
  → single GPU raycasting pass

Pros:
  - Single raycasting pass (efficient)
  - Overlapping FOVs contribute evidence from different viewpoints
  - Simple pipeline
  
Cons:
  - Must wait for all LiDAR scans (synchronization)
  - Ego-motion during scan period (100ms) causes smearing
  - Single sensor origin approximation (all rays from vehicle center)

Mitigation:
  - Use per-LiDAR sensor origin during raycasting (array of origins)
  - Ego-motion compensate each point using IMU (already done in Aurrigo stack)
```

**Strategy 2: Per-LiDAR grids with probabilistic fusion**

```
Each LiDAR → separate occupancy grid → fuse log-odds

Fusion: l_fused(x) = l_1(x) + l_2(x) + ... + l_N(x)

(This works because log-odds are additive for independent observations!)

Pros:
  - No synchronization needed (each LiDAR updates independently)
  - Correct sensor origins for each LiDAR
  - Can handle different LiDAR rates/resolutions
  
Cons:
  - N separate raycasting passes (more GPU time)
  - N separate hash tables (more GPU memory)
  - Over-counting evidence in overlapping FOVs

Over-counting mitigation:
  - Reduce per-LiDAR L_OCC and L_FREE by factor 1/sqrt(N_overlap)
  - Or: use covariance intersection instead of naive addition
```

**Strategy 3: Hybrid — merge close LiDARs, separate far ones**

```
Front-left + Front-right → merge (overlapping FOV)
Rear-left + Rear-right   → merge (overlapping FOV)
Left + Right              → separate (non-overlapping)
Front-center              → separate
Rear-center               → separate

Result: 4-5 raycasting passes instead of 8
  - Overlapping pairs are merged (correct, efficient)
  - Non-overlapping LiDARs raycast independently (correct sensor origin)
```

**Recommendation:** Strategy 1 (merge-then-raycast) with per-LiDAR sensor origins. This is simplest, most GPU-efficient, and accurate enough given that ego-motion compensation is already in the pipeline.

### 4.3 Ego-Motion Compensation

During a 100ms scan cycle at 15 km/h, the vehicle moves ~42cm -- more than a 0.2m voxel. Without compensation, the map smears.

```python
"""
Ego-motion compensation for multi-LiDAR occupancy.
Uses the existing GTSAM pose at each LiDAR timestamp.
"""

def compensate_ego_motion(points, timestamps, pose_buffer):
    """
    Transform each point to the reference time (end of scan).
    
    Args:
        points: (N, 3) point cloud
        timestamps: (N,) per-point timestamps (from LiDAR hardware)
        pose_buffer: GTSAM pose history at 500 Hz (IMU rate)
    
    Returns:
        compensated_points: (N, 3) points in reference frame
    """
    t_ref = timestamps[-1]  # Reference time = end of scan
    T_ref = pose_buffer.interpolate(t_ref)  # SE(3) pose at reference time
    T_ref_inv = T_ref.inverse()
    
    compensated = np.empty_like(points)
    for i in range(len(points)):
        T_i = pose_buffer.interpolate(timestamps[i])  # Pose when point was captured
        T_delta = T_ref_inv @ T_i  # Relative motion since capture
        compensated[i] = T_delta @ points[i]  # Transform to reference frame
    
    return compensated

# In practice: vectorized with batch interpolation + matrix multiply on GPU
# The GTSAM 500 Hz pose buffer provides sub-millimeter interpolation accuracy
```

**Integration with existing Aurrigo stack:** The GTSAM localization node already produces high-rate poses. The occupancy node subscribes to `/gtsam/pose` and uses it for ego-motion compensation. No new sensor fusion is needed.

### 4.4 Temporal Consistency

Occupancy grids accumulate evidence over time. But when should old observations be forgotten?

**Problem scenarios:**

```
1. Vehicle drives past a parked baggage cart.
   → Cart reflected in occupancy grid. Vehicle moves on.
   → 10 seconds later, cart drives away.
   → Occupancy grid still shows "occupied" (no new observations from that area).
   → Ghost obstacle!

2. Aircraft pushback: tail sweeps through 15m arc over 30 seconds.
   → Old tail positions remain "occupied" in grid.
   → Planner sees a solid wall where the tail used to be.
   → Unnecessary detour!
```

**Solutions:**

| Method | Approach | Pros | Cons |
|--------|----------|------|------|
| **Log-odds decay** | Multiply all log-odds by factor <1 each frame | Simple, uniform forgetting | Forgets everything equally |
| **Timestamp-based** | Ignore observations older than T seconds | Sharp cutoff, tunable | Sudden transitions |
| **Recency-weighted** | Weight observations by age: w = exp(-alpha * age) | Smooth forgetting | More complex update |
| **Detection-gated** | Only forget cells associated with detected dynamic objects | Preserves static map | Requires object detection |

**Recommended approach for Aurrigo:**

```
Two-grid architecture:
  
  Static grid (persistent):
    - Updated only by points classified as static (ground, buildings, parked aircraft)
    - Very slow decay (hours to days)
    - Provides the persistent map layer
    
  Dynamic grid (short-memory):
    - Updated by all points
    - Fast decay: log-odds *= 0.9 every 200ms (half-life ~1.3 seconds)
    - Captures moving objects, temporary obstacles
    
  Merged grid (for planning):
    - l_merged(x) = max(l_static(x), l_dynamic(x))
    - Static map provides baseline, dynamic grid adds transient occupancy
```

This two-grid approach prevents ghost obstacles from dynamic objects while maintaining a stable map of static infrastructure.

---

## 5. Dynamic Object Handling

### 5.1 The Static-Dynamic Separation Problem

An airport apron contains:
- **Static**: Buildings, fixed infrastructure, parked aircraft (for minutes-hours)
- **Quasi-static**: Parked GSE (may move without warning), ground crew (stationary but will move)
- **Dynamic**: Moving GSE, walking personnel, taxiing aircraft, pushback operations

The occupancy grid should treat these differently:

| Category | Map behavior | Safety behavior |
|----------|-------------|-----------------|
| Static | Permanent, high confidence | Plan around with fixed margins |
| Quasi-static | Persistent until observed moving | Plan around, monitor for change |
| Dynamic | Short-memory, rapidly updating | Track, predict, avoid with velocity-dependent margins |

### 5.2 Moving Object Segmentation

Before updating the occupancy grid, separate static from dynamic points:

```python
"""
Simple moving object segmentation using map consistency.
Points that are occupied in the existing static map but shouldn't be
(or vice versa) are classified as dynamic.
"""

def segment_dynamic_points(points, static_grid, detection_boxes):
    """
    Classify points as static or dynamic.
    
    Method 1: Detection-based (primary)
      Points inside tracked object bounding boxes → dynamic
      All other points → static
    
    Method 2: Map-consistency (secondary)
      Points in cells that were recently free → likely dynamic
      Points in cells that were occupied and still occupied → static
    
    Method 3: Multi-scan difference (tertiary)
      Compare current scan to ego-compensated previous scan
      Points with no corresponding point in previous scan → possibly dynamic
    
    Returns:
      static_mask: (N,) boolean — True if point is static
      dynamic_mask: (N,) boolean — True if point is dynamic
    """
    N = len(points)
    static_mask = np.ones(N, dtype=bool)
    dynamic_mask = np.zeros(N, dtype=bool)
    
    # Method 1: Detection-based
    for box in detection_boxes:
        inside = points_in_box(points, box)
        dynamic_mask[inside] = True
        static_mask[inside] = False
    
    # Method 2: Map-consistency for remaining points
    for i in range(N):
        if dynamic_mask[i]:
            continue
        cell = point_to_cell(points[i])
        if static_grid[cell] < -2.0:  # Cell was confidently free
            dynamic_mask[i] = True     # New point in free space → dynamic
            static_mask[i] = False
    
    return static_mask, dynamic_mask
```

### 5.3 Detection-Occupancy Pipeline Coordination

The occupancy grid and the object detector (PointPillars/CenterPoint) should coordinate:

```
Point cloud arrives
    │
    ├── PointPillars detection (6.84ms, parallel on GPU)
    │   → Bounding boxes for known objects
    │
    ├── Occupancy grid raycasting (3-15ms, parallel on GPU)
    │   → Full volumetric occupancy
    │
    └── Coordination step (1-2ms):
        1. Points inside detection boxes → excluded from static grid update
        2. Detection boxes → immediate costmap inflation (even before occupancy converges)
        3. Occupied cells NOT inside any detection → unknown obstacle (FOD, novel object)
           → Higher cost in planner, alert operator
```

**The "unknown occupied" category is critical for airside.** A cell that is occupied but does not match any detected object class is either:
- FOD (foreign object debris) -- requires alerting and possible stop
- Novel GSE type not in training set -- requires caution
- Sensor artifact -- recency-weighted, will fade

This is one of the key advantages of maintaining both detection AND occupancy: the occupancy grid catches what the detector misses.

### 5.4 Recency-Weighted Occupancy for Dynamic Environments

```python
"""
Recency-weighted occupancy: recent observations count more.
Implemented as exponential decay of log-odds toward zero.
"""

def decay_occupancy_grid(grid, timestamps, current_time, half_life_seconds):
    """
    Decay all occupied cells toward unknown (log-odds = 0).
    
    For cells that haven't been observed recently:
      l(t) = l(t_obs) * exp(-lambda * (t - t_obs))
      where lambda = ln(2) / half_life
    
    Args:
        grid: occupancy hash table
        timestamps: per-voxel last-observation timestamps
        current_time: current frame time
        half_life_seconds: time for log-odds to decay by 50%
    """
    lam = 0.693 / half_life_seconds  # ln(2) / half_life
    
    for voxel in grid.active_voxels():
        age = current_time - voxel.timestamp
        if age > 0:
            decay = exp(-lam * age)
            voxel.log_odds *= decay
            
            # If decayed below threshold, remove from hash table
            if abs(voxel.log_odds) < 0.1:
                grid.remove(voxel)
```

**Recommended decay parameters for airside:**

| Object category | Half-life | Rationale |
|----------------|-----------|-----------|
| Ground surface | Never (static grid) | Ground doesn't move |
| Buildings/infrastructure | Never (static grid) | Static structure |
| Parked aircraft | 5 minutes | May pushback at any time |
| Parked GSE | 30 seconds | May drive away without warning |
| Moving objects | 1.0 seconds | ~3-5 frames persistence (eliminates flicker) |
| Jet blast zone markers | 30 seconds | Persist until engines confirmed off |
| Personnel | 0.5 seconds | Fast decay -- safety-critical, must track actively |

---

## 6. Multi-Resolution Grids

### 6.1 The Resolution Tradeoff

| Resolution | Detects | Memory (200m x 200m x 8m) | Voxels/ray (20m) | Use Case |
|-----------|---------|---------------------------|-------------------|----------|
| 0.05m | 5cm FOD, bolt heads | 10.24 B voxels (40 GB) | 400 | Impractical at scale |
| 0.1m | 10cm FOD, small tools | 1.28 B voxels (5 GB) | 200 | Close range only |
| 0.2m | Personnel limbs, barriers | 160M voxels (640 MB) | 100 | Primary resolution |
| 0.4m | Personnel body, GSE | 20M voxels (80 MB) | 50 | Medium range |
| 0.8m | Vehicles, aircraft parts | 2.5M voxels (10 MB) | 25 | Long range |
| 1.6m | Large obstacles only | 312K voxels (1.2 MB) | 12 | Very long range / overview |

No single resolution works everywhere. 0.1m catches FOD but is too expensive. 0.8m is efficient but misses personnel.

### 6.2 Multi-Resolution Architecture

```
Multi-resolution occupancy grid:

Zone 1: NEAR (0-15m from vehicle)
  Resolution: 0.1m
  Grid size: 30m x 30m x 6m = 300 x 300 x 60 = 5.4M voxels
  Memory: ~11 MB (int16)
  Purpose: FOD detection, precise clearance for docking
  Update rate: 10 Hz (every frame)

Zone 2: MEDIUM (15-50m)
  Resolution: 0.4m
  Grid size: 100m x 100m x 8m = 250 x 250 x 20 = 1.25M voxels
  Memory: ~2.5 MB (int16)
  Purpose: GSE/personnel detection, path planning
  Update rate: 10 Hz

Zone 3: FAR (50-150m)
  Resolution: 0.8m
  Grid size: 300m x 300m x 8m = 375 x 375 x 10 = 1.4M voxels
  Memory: ~2.8 MB (int16)
  Purpose: Large obstacle awareness, route planning
  Update rate: 5 Hz (every other frame)

Total voxels: ~8M
Total memory: ~16 MB
Total update: ~5-10ms GPU (well within budget)
```

### 6.3 Implementation Approaches

**Approach 1: Separate grids (simplest)**

```
Three separate spatial hash tables, one per resolution.
Each point is assigned to a zone based on range from sensor.
Points are raycasted into the appropriate grid.

Pro: Simple, each grid is independent
Con: Zone boundaries need overlap to avoid gaps
     Points near boundaries update two grids
```

**Approach 2: Hierarchical octree (OctoMap-style)**

```
Single octree with adaptive resolution.
Near surfaces: subdivide to fine resolution.
Empty space: coarse nodes.

Pro: Single data structure, adaptive
Con: CPU-bound (as discussed in Section 2.3)
```

**Approach 3: Cascaded dense grids (recommended for GPU)**

```
Three dense GPU arrays, each centered on the vehicle.
Each frame:
  1. Ego-shift all grids (circular buffer pointer offset)
  2. Raycast into appropriate grid based on point range
  3. Merge for costmap: near grid overrides medium overrides far

GPU implementation:
  Grid 1 (near):  cudaMalloc(5.4M * sizeof(int16_t)) → 10.8 MB
  Grid 2 (medium): cudaMalloc(1.25M * sizeof(int16_t)) → 2.5 MB
  Grid 3 (far):   cudaMalloc(1.4M * sizeof(int16_t)) → 2.8 MB
  Total: 16.1 MB GPU — trivial on 32 GB Orin
  
Pro: Dense arrays → perfect GPU memory coalescing
     No hash table overhead
     Circular buffer means no data copy on ego-shift
Con: Fixed grid extent (but 300m is enough for airport)
     No fine detail beyond 15m
```

### 6.4 Circular Buffer for Ego-Centric Grids

As the vehicle moves, the grid must shift to stay centered. Copying the entire grid each frame is wasteful. A circular buffer avoids this:

```cpp
/**
 * Circular buffer occupancy grid.
 * Grid wraps around in x and y. Moving the vehicle just changes the offset.
 * Cells that wrap to the "back" are cleared (new unknown territory).
 */
class CircularOccupancyGrid {
    int16_t* grid;      // Dense 3D array on GPU
    int3 dimensions;    // (nx, ny, nz)
    int3 offset;        // Current circular offset
    float voxel_size;
    float3 origin;      // World position of grid center
    
    // Convert world position to array index (with wrapping)
    __device__ int3 world_to_index(float3 world_pos) {
        int3 grid_coord = make_int3(
            (int)((world_pos.x - origin.x) / voxel_size) + dimensions.x / 2,
            (int)((world_pos.y - origin.y) / voxel_size) + dimensions.y / 2,
            (int)((world_pos.z - origin.z) / voxel_size)
        );
        // Wrap with circular offset
        return make_int3(
            (grid_coord.x + offset.x) % dimensions.x,
            (grid_coord.y + offset.y) % dimensions.y,
            grid_coord.z  // z does not wrap (vehicle doesn't fly)
        );
    }
    
    // Shift grid when vehicle moves (just update offset + clear new cells)
    void shift(float3 delta_position) {
        int3 delta_cells = make_int3(
            (int)(delta_position.x / voxel_size),
            (int)(delta_position.y / voxel_size),
            0
        );
        if (delta_cells.x == 0 && delta_cells.y == 0) return;
        
        offset.x = (offset.x + delta_cells.x) % dimensions.x;
        offset.y = (offset.y + delta_cells.y) % dimensions.y;
        origin.x += delta_cells.x * voxel_size;
        origin.y += delta_cells.y * voxel_size;
        
        // Clear newly exposed cells (GPU kernel: set to 0)
        clear_new_cells_kernel<<<...>>>(grid, offset, delta_cells, dimensions);
    }
};
```

**Performance:** Shifting the grid takes <0.1ms (only clearing new edge cells). This is vastly more efficient than rebuilding or copying the entire grid.

---

## 7. TSDF vs Occupancy vs ESDF

### 7.1 Three Distance-Based Representations

| Representation | Cell stores | Used for | Sign convention |
|---------------|------------|---------|-----------------|
| **Occupancy** | P(occupied) or log-odds | Collision detection, costmap | +occupied, -free |
| **TSDF** | Truncated signed distance to nearest surface | Surface reconstruction, mesh extraction | +outside, -inside |
| **ESDF** | Euclidean distance to nearest occupied cell | Path planning (safe distance) | Always positive |

```
              Surface
    ─────────|████████|─────────
    
    TSDF:    +d  +d  0  -d  -d    (truncated beyond ±τ)
    Occ:     free free OCC occ occ (behind surface is unknown or occupied)
    ESDF:    3m  2m  1m  0   0     (distance to nearest surface)
```

### 7.2 When to Use Each

**Occupancy (log-odds):**
- Best for: binary "can I drive here?" decisions
- Best for: Bayesian evidence accumulation from multiple observations
- Best for: simple costmap generation (threshold → binary → inflate)
- nvblox can produce this alongside TSDF
- Mathematical foundation: Thrun et al. (2005)

**TSDF (Truncated Signed Distance Function):**
- Best for: surface reconstruction and mesh extraction
- Best for: incremental mapping (TSDF fusion is weighted averaging)
- nvblox default representation
- Cannot distinguish "free space" from "unobserved space" without occupancy layer
- Truncation (typically ±3 voxels) means no information far from surfaces

**ESDF (Euclidean Signed Distance Function):**
- Best for: gradient-based path planning (CHOMP, TrajOpt)
- Provides exact distance-to-obstacle at every point
- Expensive to compute from scratch but can be incrementally updated from TSDF
- nvblox computes ESDF from TSDF automatically
- The gradient of ESDF gives the "push direction" away from obstacles

### 7.3 Comparison for Planning

| Feature | Log-Odds Occupancy | TSDF | ESDF |
|---------|-------------------|------|------|
| **Costmap generation** | Direct threshold | Must convert to occupancy first | Direct (distance = cost) |
| **Inflation layers** | Must compute separately | Must convert | Built-in (ESDF = distance) |
| **Speed-dependent margins** | Manual per-speed inflation | Manual | Natural (threshold ESDF at speed-dependent distance) |
| **Gradient for optimization** | Not available | Surface only | Full gradient field |
| **Memory per voxel** | 2 bytes (int16 log-odds) | 4 bytes (float16 distance + weight) | 2 bytes (float16 distance) |
| **Update complexity** | O(rays * voxels_per_ray) | O(points) | O(changed_voxels * neighborhood) |
| **Aurrigo Frenet planner** | Good (binary costmap) | Overkill | Excellent but not needed |

### 7.4 Recommended Architecture

```
LiDAR points
    │
    ├── GPU Raycasting → Log-Odds Occupancy Grid
    │   │                 (primary representation)
    │   │
    │   ├── Threshold → Binary 2D Costmap → Frenet Planner (current)
    │   │
    │   └── Optionally: ESDF computation → CBF safety filter (future)
    │
    └── nvblox (parallel) → TSDF → ESDF → mesh
        │                  (visualization, future neural planner input)
        └── ROS 2 bridge or C++ API

Phase 1: Log-odds occupancy only → costmap → Frenet
Phase 2: Add ESDF for CBF integration (see planning/cbf-safety-critical.md)
Phase 3: Add nvblox for mesh/TSDF if cameras are added
```

For the Frenet planner, log-odds occupancy is sufficient and simplest. ESDF becomes valuable when integrating CBF safety filters or optimization-based planners, which use the distance field gradient for constraint enforcement.

---

## 8. Costmap Generation for Planning

### 8.1 From 3D Occupancy to 2D Costmap

The Frenet planner operates in 2D (lateral/longitudinal along a reference path). The 3D occupancy grid must be projected to a 2D costmap:

```python
"""
Project 3D occupancy grid to 2D costmap with height filtering.
Critical for airside: must filter by vehicle height to allow passage under wings.
"""

def occupancy_3d_to_costmap_2d(
    grid_3d,              # 3D occupancy grid (nx, ny, nz)
    vehicle_height=2.5,   # ADT3 height in meters
    ground_clearance=0.3, # Minimum ground clearance
    z_min=-0.5,           # Below ground (ramps, depressions)
    z_max=None,           # Will be set to vehicle_height + margin
    safety_margin=0.3     # Extra height margin above vehicle
):
    """
    For each (x, y) column in the 3D grid, check if any voxel
    between z_min and z_max (vehicle envelope) is occupied.
    
    z_max = vehicle_height + safety_margin = 2.5 + 0.3 = 2.8m
    
    This means:
      - Wing at z=5m → NOT projected (above vehicle)
      - Wing at z=2.5m → PROJECTED (interferes with vehicle)
      - Ground obstacle at z=0.1m → PROJECTED
      - Depressed drain at z=-0.3m → PROJECTED (wheel hazard)
    """
    if z_max is None:
        z_max = vehicle_height + safety_margin
    
    nz_min = int((z_min - grid_3d.z_origin) / grid_3d.voxel_size)
    nz_max = int((z_max - grid_3d.z_origin) / grid_3d.voxel_size)
    
    costmap_2d = np.zeros((grid_3d.nx, grid_3d.ny), dtype=np.uint8)
    
    for ix in range(grid_3d.nx):
        for iy in range(grid_3d.ny):
            # Check all voxels in the vehicle height envelope
            max_occ = 0
            for iz in range(nz_min, nz_max + 1):
                log_odds = grid_3d.get(ix, iy, iz)
                if log_odds > 0.5:  # Likely occupied
                    max_occ = max(max_occ, log_odds)
            
            if max_occ > 2.0:
                costmap_2d[ix, iy] = 254  # Lethal (hard obstacle)
            elif max_occ > 0.5:
                costmap_2d[ix, iy] = 200  # High cost (likely obstacle)
            # else: 0 (free)
    
    return costmap_2d

# GPU version: one thread per (x, y) column → trivially parallel
# Expected: <0.5ms for 1000x1000 grid on Orin
```

### 8.2 Inflation Layers

Raw occupancy gives a binary obstacle map. The planner needs graduated cost zones around obstacles -- inflation layers:

```
Obstacle inflation for airside:

Layer 1: LETHAL (0m from obstacle)
  Cost: 254 (impassable)
  
Layer 2: INSCRIBED (vehicle inscribed radius, ~1.5m for ADT3)
  Cost: 253 (collision guaranteed if center is here)
  
Layer 3: INFLATION (variable, speed-dependent)
  Cost: decays linearly or exponentially from 253 to 0
  At 5 km/h: 1.5m inflation radius
  At 15 km/h: 3.0m inflation radius
  At 25 km/h: 5.0m inflation radius
  
Layer 4: AIRCRAFT SPECIAL (near detected aircraft)
  Additional 3m buffer around fuselage
  Additional 50m behind engines (jet blast zone)
  Additional 5m around intake (FOD ingestion zone)
  Cost: proportional to proximity, capped at 253
```

### 8.3 Speed-Dependent Costmaps

At different speeds, the planner needs different safety margins. Rather than a single costmap, maintain multiple inflation configurations or dynamically recompute:

```python
"""
Speed-dependent costmap inflation.
Called every planning cycle with current vehicle speed.
"""

def inflate_costmap(binary_costmap, vehicle_speed_mps, vehicle_radius=1.5):
    """
    Args:
        binary_costmap: 2D grid (0=free, 254=occupied)
        vehicle_speed_mps: current speed in m/s
        vehicle_radius: inscribed radius in meters
    
    Returns:
        inflated_costmap: 2D grid with graduated costs
    """
    # Stopping distance (dry tarmac, μ=0.7): d = v² / (2 * μ * g)
    stopping_distance = vehicle_speed_mps**2 / (2 * 0.7 * 9.81)
    
    # Reaction distance (at 10 Hz planning: 1 frame = 100ms)
    reaction_distance = vehicle_speed_mps * 0.1
    
    # Total inflation radius
    inflation_radius = vehicle_radius + stopping_distance + reaction_distance + 0.5
    # 0.5m additional safety margin
    
    # Example at different speeds:
    #   5 km/h (1.4 m/s):  1.5 + 0.14 + 0.14 + 0.5 = 2.28m
    #   15 km/h (4.2 m/s): 1.5 + 1.28 + 0.42 + 0.5 = 3.70m
    #   25 km/h (6.9 m/s): 1.5 + 3.46 + 0.69 + 0.5 = 6.15m
    
    inflated = apply_distance_transform(binary_costmap, inflation_radius)
    return inflated
```

### 8.4 Height-Specific Costmap Layers for Airside

Aircraft present a unique challenge: the wing overhangs at 4-6m, the fuselage is at 2-5m, and the engines/gear are at 0-3m. A single height-filtered costmap cannot capture this complexity. The solution is multiple height-band costmaps:

```
Height band costmaps:

Band 0: GROUND (-0.5m to 0.3m)
  Captures: FOD, curbs, drainage channels, ramp lips, chains
  Use: FOD detection, surface traversability
  
Band 1: VEHICLE BODY (0.3m to 2.8m)
  Captures: GSE, personnel, aircraft gear, engine nacelles, belt loaders
  Use: PRIMARY planning costmap — this is what the Frenet planner uses
  
Band 2: OVERHEAD (2.8m to 6.0m)
  Captures: Aircraft wings, jet bridges, building overhangs
  Use: Route planning for tall vehicles (POD is taller than ADT3)
  
Band 3: TALL (6.0m to 12.0m)
  Captures: Aircraft tail, control tower, light masts
  Use: Not relevant for ground vehicles, but useful for map building

Primary costmap = Band 1
Vehicle-specific: each vehicle type uses its own height envelope
  ADT3: 2.5m → Band 1 up to 2.8m (2.5 + 0.3 margin)
  POD:  3.0m → Band 1 up to 3.3m
```

### 8.5 Integration with Frenet Planner

The current Aurrigo Frenet planner generates 420 candidate trajectories per cycle. Each candidate is evaluated against the costmap:

```
Current Aurrigo obstacle check:
  Point obstacles (from RANSAC clusters) → check if trajectory passes near

Proposed occupancy-based check:
  For each candidate trajectory (420 per cycle):
    Sample N points along trajectory (N=20-50)
    For each point:
      Look up 2D costmap value
      Accumulate cost
    Total cost = sum of costmap values along trajectory
    
  Select trajectory with lowest (cost + smoothness + reference_deviation)

Advantages of costmap-based over point-cluster-based:
  1. Continuous cost field (no gaps between sparse clusters)
  2. Implicit inflation (already baked into costmap)
  3. Unknown-occupied cells naturally avoided
  4. Fleet-shared obstacles included automatically
  5. Speed-dependent margins applied uniformly
```

---

## 9. Fleet-Shared Occupancy

### 9.1 Why Fleet Sharing Matters for Airside

Airport aprons are large, open spaces with significant occlusion (aircraft fuselage blocks 60m of width). A single vehicle cannot observe the far side of a parked aircraft. But another vehicle on the other side can. Fleet-shared occupancy creates cooperative situational awareness.

```
Vehicle A                              Vehicle B
   ●═══► ─── cannot see ───█████████ ─── sees fine ─── ◄═══●
                            Aircraft
                            (60m long)
   
Without sharing: Vehicle A blind to activity behind aircraft
With sharing: Vehicle B's occupancy fills Vehicle A's blind spot
```

### 9.2 What to Share

Sharing the raw occupancy grid is too expensive. Instead, share incremental updates:

| Data type | Size per update | Update rate | Bandwidth |
|-----------|----------------|-------------|-----------|
| Full 3D grid | 16-640 MB | 1 Hz | 16-640 MB/s (infeasible) |
| Changed voxels only | 10-100 KB | 5 Hz | 50-500 KB/s |
| Compressed changed voxels | 2-20 KB | 5 Hz | 10-100 KB/s |
| Detected obstacle list | 1-5 KB | 10 Hz | 10-50 KB/s |
| BEV occupancy image (compressed) | 5-20 KB | 2 Hz | 10-40 KB/s |

**Recommended: BEV occupancy image at 2 Hz.** Compress the 2D height-filtered costmap to a PNG/JPEG-like format. At 0.4m resolution covering 200m x 200m = 500 x 500 pixels:

```
Raw: 500 x 500 x 1 byte = 250 KB
PNG compressed (mostly empty): ~5-15 KB
At 2 Hz: 10-30 KB/s per vehicle

20-vehicle fleet: 200-600 KB/s total bandwidth
Airport 5G capacity: 1+ Gbps → negligible load
```

### 9.3 Coordinate Transforms

Each vehicle maintains an ego-centric occupancy grid. Sharing requires transformation to a common frame:

```python
"""
Fleet occupancy fusion.
Each vehicle publishes its occupancy in a shared world frame.
"""

class FleetOccupancyFusion:
    def __init__(self, world_frame="airport_map"):
        self.world_frame = world_frame
        self.vehicle_grids = {}  # vehicle_id → (grid, timestamp, pose)
    
    def receive_update(self, vehicle_id, bev_grid, vehicle_pose, timestamp):
        """
        Receive a BEV occupancy update from another vehicle.
        
        Args:
            vehicle_id: unique identifier
            bev_grid: 2D occupancy grid in vehicle's frame (500x500, uint8)
            vehicle_pose: SE(2) pose in world frame (x, y, theta)
            timestamp: observation time
        """
        # Transform grid to world frame
        world_grid = transform_grid(bev_grid, vehicle_pose, 
                                     self.world_resolution)
        
        self.vehicle_grids[vehicle_id] = (world_grid, timestamp, vehicle_pose)
    
    def get_fused_grid(self, ego_pose, current_time, max_age_seconds=2.0):
        """
        Fuse all vehicle grids into ego-centric costmap.
        
        Staleness: discard observations older than max_age_seconds.
        Conflict: take maximum occupancy (conservative fusion).
        """
        ego_grid = self.local_occupancy.copy()
        
        for vid, (grid, ts, pose) in self.vehicle_grids.items():
            age = current_time - ts
            if age > max_age_seconds:
                continue  # Too stale, discard
            
            # Staleness weight: recent observations count more
            weight = max(0, 1.0 - age / max_age_seconds)
            
            # Transform to ego frame
            ego_frame_grid = transform_to_ego(grid, pose, ego_pose)
            
            # Conservative fusion: max of local and remote
            ego_grid = np.maximum(ego_grid, 
                                   (ego_frame_grid * weight).astype(np.uint8))
        
        return ego_grid
```

### 9.4 Temporal Staleness and Conflict Resolution

Fleet-shared occupancy data is always stale by the network latency + processing time (typically 50-200ms on airport 5G).

**Staleness handling:**

| Age | Confidence | Action |
|-----|-----------|--------|
| 0-200ms | High | Trust fully, use in planning |
| 200-500ms | Medium | Use with reduced weight (0.5-0.8) |
| 500-1000ms | Low | Use for awareness only, not planning |
| >1000ms | Expired | Discard (revert to local-only) |
| Network failure | Unknown | Degrade to local-only (safe default) |

**Conflict resolution when two vehicles disagree:**

```
Vehicle A says cell (50, 30) is OCCUPIED (log-odds +3.0)
Vehicle B says cell (50, 30) is FREE (log-odds -2.0)

Resolution strategies:
  1. CONSERVATIVE (recommended for safety): max(+3.0, -2.0) = +3.0 → occupied
     → Never ignores occupied evidence, even if outnumbered
  
  2. MAJORITY: if more vehicles say free than occupied → free
     → Dangerous: one vehicle with direct line of sight is more reliable
     
  3. RECENCY: most recent observation wins
     → Reasonable for dynamic objects, but wrong for static (building)
  
  4. VIEWPOINT-WEIGHTED: weight by angle to cell
     → Vehicle with direct line of sight gets higher weight
     → Best accuracy but most complex
```

**Recommendation:** Conservative (max) fusion for occupied cells, recency-weighted for free cells. This ensures that a detected obstacle is never ignored, while allowing cells to be cleared when the observing vehicle confirms they are free.

### 9.5 ROS Message Design

```
# FleetOccupancyUpdate.msg (custom ROS message)

Header header                    # Timestamp and frame_id
string vehicle_id                # Source vehicle identifier
geometry_msgs/Pose2D vehicle_pose # Vehicle pose in world frame
float32 grid_resolution          # Meters per cell
uint32 grid_width                # Number of cells in x
uint32 grid_height               # Number of cells in y
float32 origin_x                 # World x of grid origin
float32 origin_y                 # World y of grid origin
uint8[] data                     # Compressed occupancy data (PNG or run-length encoded)
float32 compression_ratio        # For debugging/monitoring
uint32 num_changed_cells         # For monitoring update density
```

---

## 10. Airside-Specific Considerations

### 10.1 Airport Geometry Challenges

Airport aprons are fundamentally different from urban streets:

| Challenge | Urban road | Airport apron | Impact on occupancy grid |
|-----------|-----------|--------------|-------------------------|
| **Open space** | 10-30m wide roads | 200m+ wide aprons | Need large grid extents |
| **Obstacle scale** | Cars (4m) | Aircraft (30-80m) | Single object spans hundreds of voxels |
| **Height variation** | Buildings (uniform edge) | Wings, engines, gear (complex 3D) | Must maintain true 3D, not just BEV |
| **Ground objects** | Curbs, barriers | FOD (bolts, rags, panel fragments) | Need 0.1m resolution near vehicle |
| **Invisible hazards** | None | Jet blast, intake suction zone | Cannot be detected by occupancy alone |
| **Dynamic scale** | Cars at 0-60 km/h | Pushback at 1-3 km/h, aircraft taxi at 20-30 km/h | Wide range of dynamic speeds |
| **Reflective surfaces** | Glass buildings | Wet tarmac, aircraft skin | LiDAR multipath → phantom voxels |
| **Ground texture** | Asphalt (uniform) | Paint markings, manhole covers, drainage | Ground clutter at fine resolution |

### 10.2 Aircraft as Occupancy Objects

A single aircraft occupies a massive, complex 3D volume:

```
A320 dimensions in occupancy grid (at 0.2m resolution):
  Length: 37.6m → 188 voxels
  Wingspan: 35.8m → 179 voxels
  Height: 11.8m → 59 voxels (but most volume is empty)
  
  Actual occupied voxels (fuselage + wings + gear + engines): ~50,000-80,000
  Bounding box voxels: 188 * 179 * 59 = 1,985,348
  Fill ratio: ~3-4% (extremely sparse)
  
Aircraft occupancy zones:

  WING ZONE (z = 4-6m):
    └── Overhang: GSE can pass under if height < 4m
    └── Tip clearance: 3m minimum lateral
    
  FUSELAGE ZONE (z = 1-5m):
    └── Solid obstacle, impassable
    └── Doors may open (dynamic zone change)
    
  ENGINE ZONE (z = 1-3m):
    └── Physical obstacle + intake suction zone (5m forward)
    └── Jet blast zone (50m+ behind) -- NOT visible in occupancy
    
  GEAR ZONE (z = 0-2m):
    └── Tight clearance, risk of FOD damage to aircraft
    └── Nose gear capture zone for pushback (±10cm tolerance)
```

### 10.3 Jet Blast and Invisible Hazards

Occupancy grids detect physical objects via LiDAR returns. Jet blast is invisible to LiDAR. The occupancy grid must be augmented with virtual obstacles:

```python
"""
Virtual occupancy zones for invisible hazards.
These are injected into the occupancy grid based on aircraft state,
not based on sensor observations.
"""

def inject_virtual_obstacles(occupancy_grid, aircraft_states):
    """
    Add virtual occupied zones for hazards that LiDAR cannot detect.
    
    Sources:
      - ADS-B / MLAT: aircraft position and heading
      - A-CDM: engine start time (EOBT)
      - Thermal camera: jet exhaust boundary (if available)
    """
    for aircraft in aircraft_states:
        if aircraft.engines_running:
            # Jet blast zone: cone behind engines
            # Length depends on thrust setting:
            #   Idle: 30-50m, breakaway: 100m+
            # Width: expands at ~15 degrees from engine centerline
            blast_zone = compute_jet_blast_cone(
                engine_positions=aircraft.engine_positions,
                heading=aircraft.heading,
                thrust_level=aircraft.estimated_thrust,
                safety_factor=1.5
            )
            # Mark blast zone as LETHAL in occupancy grid
            for voxel in blast_zone:
                occupancy_grid.set_occupied(voxel, log_odds=L_MAX)
            
            # Intake suction zone: 5m hemisphere in front of engines
            for engine_pos in aircraft.engine_positions:
                intake_zone = compute_hemisphere(
                    center=engine_pos,
                    direction=aircraft.forward_direction,
                    radius=5.0
                )
                for voxel in intake_zone:
                    occupancy_grid.set_occupied(voxel, log_odds=L_MAX)
```

### 10.4 FOD Detection at Ground Level

Foreign Object Debris (FOD) on airport surfaces is a critical safety concern. Objects as small as a bolt can cause $250K+ in aircraft engine damage. The occupancy grid can detect FOD if the near-field resolution is fine enough:

```
FOD detection requirements:
  - Object size: >5cm (ICAO minimum reportable)
  - Detection range: 0-20m ahead of vehicle
  - Detection rate: >90% for objects >10cm
  
Occupancy grid for FOD:
  - Near-field grid at 0.05m resolution: detects objects >5cm (2+ voxels)
  - Near-field grid at 0.1m resolution: detects objects >10cm (2+ voxels)
  
  Problem: at 0.05m, a 20m x 20m x 0.5m near-field grid is:
    400 x 400 x 10 = 1.6M voxels → only 3.2 MB → feasible!
  
  Enhanced FOD detection pipeline:
    1. Height filter: retain only points at z = -0.1m to 0.3m (near ground)
    2. Ground plane subtraction: remove ground surface
    3. Remaining points in near-field → update 0.05m grid
    4. Clusters of occupied voxels at ground level = FOD candidates
    5. Filter: must persist for 3+ frames (eliminates splash, leaves, etc.)
```

### 10.5 Reflective Surface Handling

Wet tarmac and polished aircraft skin cause LiDAR multipath reflections, creating phantom points below the ground plane or behind aircraft:

```
Mitigation strategies:

1. Ground plane filter: discard points below z = -0.3m (below ground surface)
   → Catches most wet-tarmac reflections (mirror image below ground)
   
2. Intensity filter: multipath reflections have lower intensity
   → Set minimum intensity threshold for occupancy updates
   
3. Multi-frame consistency: phantom reflections appear at different positions
   each frame (specular reflection angle changes with vehicle motion)
   → Require 3+ consistent observations before marking occupied
   
4. Known reflector map: map locations of highly reflective surfaces
   → Reduce L_OCC in these areas (require more evidence)
```

### 10.6 Occupancy Grid Parameters for Airside

| Parameter | Urban road value | Airport airside value | Rationale |
|-----------|-----------------|----------------------|-----------|
| Grid extent (x, y) | 100m x 100m | 200m x 200m | Larger open spaces, aircraft approach distance |
| Grid extent (z) | -3m to 3m | -0.5m to 8m | Aircraft tail height |
| Near resolution | 0.1m | 0.05-0.1m | FOD detection |
| Medium resolution | 0.2m | 0.2m | Standard for GSE/personnel |
| Far resolution | 0.5m | 0.8m | Large obstacles at range |
| L_OCC (general) | 0.85 | 0.85 | Standard |
| L_OCC (near aircraft) | 0.85 | 1.2 | Conservative: assume occupied faster |
| L_FREE | -0.4 | -0.3 | Slightly more conservative freeing |
| L_MAX | 4.6 | 3.5 | Prevent over-confidence (allows dynamic updates) |
| Decay half-life (dynamic) | 2.0s | 1.0s | Faster decay for slow-moving airport vehicles |
| Decay half-life (static) | 30min | 5min | Aircraft may pushback |
| Update rate | 10 Hz | 10 Hz | Matching LiDAR rate |
| Costmap publish rate | 10 Hz | 10 Hz | Matching planning rate |

---

## 11. Implementation with ROS Noetic

### 11.1 ROS Node Architecture

```
ROS Node Graph for Occupancy Grid:

/lidar_merger (existing)
  Publishes: /merged_points (sensor_msgs/PointCloud2)
  Rate: 10 Hz
  Content: All LiDARs merged, ego-motion compensated

/gtsam_localization (existing)
  Publishes: /vehicle_pose (geometry_msgs/PoseStamped)
  Rate: 100 Hz (IMU-driven)
  Content: SE(3) pose in map frame

/object_detector (existing or new: PointPillars)
  Publishes: /detections (custom msg or jsk_msgs/BoundingBoxArray)
  Rate: 10 Hz
  Content: 3D bounding boxes of detected objects

/occupancy_grid_node (NEW — this document)
  Subscribes:
    /merged_points (10 Hz)
    /vehicle_pose (100 Hz, buffered)
    /detections (10 Hz, optional)
    /fleet_occupancy (2 Hz, from fleet manager)
  
  Publishes:
    /occupancy_3d (custom OccupancyGrid3D msg, 10 Hz)
    /costmap (nav_msgs/OccupancyGrid, 10 Hz)
    /costmap_inflated (nav_msgs/OccupancyGrid, 10 Hz)
    /fleet_occupancy_out (FleetOccupancyUpdate, 2 Hz)
    /fod_candidates (PointCloud2, 10 Hz)
    /occupancy_viz (visualization_msgs/MarkerArray, 2 Hz)
  
  Parameters:
    ~voxel_size_near: 0.1    # meters
    ~voxel_size_medium: 0.2
    ~voxel_size_far: 0.8
    ~near_range: 15.0        # meters
    ~far_range: 50.0
    ~max_range: 150.0
    ~l_occ: 0.85
    ~l_free: -0.3
    ~l_max: 3.5
    ~l_min: -3.5
    ~decay_dynamic_halflife: 1.0  # seconds
    ~vehicle_height: 2.5
    ~inflation_inscribed: 1.5
    ~publish_rate: 10.0
    ~fleet_publish_rate: 2.0
```

### 11.2 Node Implementation Skeleton

```cpp
/**
 * GPU Occupancy Grid Node for ROS Noetic.
 * Implemented as a nodelet for zero-copy point cloud subscription.
 */

#include <ros/ros.h>
#include <nodelet/nodelet.h>
#include <sensor_msgs/PointCloud2.h>
#include <nav_msgs/OccupancyGrid.h>
#include <geometry_msgs/PoseStamped.h>
#include <tf2_ros/buffer.h>
#include <tf2_ros/transform_listener.h>

// CUDA headers
#include <cuda_runtime.h>

namespace aurrigo_occupancy {

class OccupancyGridNodelet : public nodelet::Nodelet {
public:
    void onInit() override {
        ros::NodeHandle& nh = getNodeHandle();
        ros::NodeHandle& pnh = getPrivateNodeHandle();
        
        // Load parameters
        pnh.param("voxel_size_near", voxel_near_, 0.1);
        pnh.param("voxel_size_medium", voxel_medium_, 0.2);
        pnh.param("voxel_size_far", voxel_far_, 0.8);
        pnh.param("near_range", near_range_, 15.0);
        pnh.param("far_range", far_range_, 50.0);
        pnh.param("vehicle_height", vehicle_height_, 2.5);
        
        // Initialize GPU grids
        initGPUGrids();
        
        // Subscribers (zero-copy via nodelet)
        sub_points_ = nh.subscribe("/merged_points", 1,
            &OccupancyGridNodelet::pointCloudCallback, this);
        sub_pose_ = nh.subscribe("/vehicle_pose", 100,
            &OccupancyGridNodelet::poseCallback, this);
        sub_detections_ = nh.subscribe("/detections", 1,
            &OccupancyGridNodelet::detectionsCallback, this);
        
        // Publishers
        pub_costmap_ = nh.advertise<nav_msgs::OccupancyGrid>(
            "/costmap", 1);
        pub_costmap_inflated_ = nh.advertise<nav_msgs::OccupancyGrid>(
            "/costmap_inflated", 1);
        pub_fleet_ = nh.advertise<FleetOccupancyUpdate>(
            "/fleet_occupancy_out", 1);
        
        // Timer for periodic publishing
        timer_ = nh.createTimer(ros::Duration(1.0 / 10.0),
            &OccupancyGridNodelet::publishCallback, this);
        
        NODELET_INFO("Occupancy grid initialized: near=%.2fm, med=%.2fm, far=%.2fm",
                     voxel_near_, voxel_medium_, voxel_far_);
    }
    
    void pointCloudCallback(const sensor_msgs::PointCloud2::ConstPtr& msg) {
        // 1. Extract points from PointCloud2 (zero-copy if possible)
        // 2. Upload to GPU
        // 3. Separate into near/medium/far by range
        // 4. GPU raycasting into each resolution grid
        // 5. Decay dynamic grid
        // 6. Project to 2D costmap
        // 7. Inflate costmap
        
        auto start = ros::WallTime::now();
        
        // Upload points to GPU
        uploadPointsToGPU(msg);
        
        // GPU raycasting (see Section 3.3)
        launchRaycastKernel(gpu_points_, num_points_, 
                           sensor_origins_, num_sensors_,
                           gpu_grid_near_, gpu_grid_medium_, gpu_grid_far_);
        
        // Decay dynamic cells
        launchDecayKernel(gpu_grid_dynamic_, current_time_, 
                         decay_halflife_);
        
        // 3D→2D projection (see Section 8.1)
        launchProjectionKernel(gpu_grid_near_, gpu_grid_medium_, gpu_grid_far_,
                              gpu_costmap_2d_, vehicle_height_);
        
        // Inflate (see Section 8.2)
        launchInflationKernel(gpu_costmap_2d_, gpu_costmap_inflated_,
                            inscribed_radius_, current_speed_);
        
        // Download costmap from GPU
        downloadCostmap(gpu_costmap_inflated_, costmap_msg_);
        
        auto elapsed = (ros::WallTime::now() - start).toSec() * 1000;
        NODELET_DEBUG("Occupancy update: %.1f ms (%d points)", 
                     elapsed, num_points_);
    }

private:
    // GPU resources
    float3* gpu_points_;
    int16_t* gpu_grid_near_;
    int16_t* gpu_grid_medium_;
    int16_t* gpu_grid_far_;
    uint8_t* gpu_costmap_2d_;
    uint8_t* gpu_costmap_inflated_;
    
    // ROS
    ros::Subscriber sub_points_, sub_pose_, sub_detections_;
    ros::Publisher pub_costmap_, pub_costmap_inflated_, pub_fleet_;
    ros::Timer timer_;
    
    // Parameters
    double voxel_near_, voxel_medium_, voxel_far_;
    double near_range_, far_range_;
    double vehicle_height_;
    double inscribed_radius_;
    double decay_halflife_;
    double current_speed_;
};

} // namespace aurrigo_occupancy

#include <pluginlib/class_list_macros.h>
PLUGINLIB_EXPORT_CLASS(aurrigo_occupancy::OccupancyGridNodelet, 
                       nodelet::Nodelet)
```

### 11.3 Existing ROS Packages

| Package | Description | Suitability for Aurrigo |
|---------|------------|------------------------|
| `octomap_server` | OctoMap-based 3D occupancy | Prototype only (CPU-bound, too slow for 4-8 LiDARs) |
| `costmap_2d` | ROS Navigation stack 2D costmap | Good for 2D costmap layer management, inflation |
| `grid_map` | ETH multi-layer grid map | Good for multi-layer 2D representation |
| `nvblox_ros` | NVIDIA nvblox ROS wrapper | ROS 2 only (needs bridge or C++ API) |
| `voxblox` | ETH TSDF/ESDF mapping | Mature, but CPU-based (slower than nvblox) |
| `gpu_voxels` | GPU voxel grid library | Outdated, not maintained |
| `spatio_temporal_voxel_layer` | Costmap layer with 3D voxels + decay | Excellent for costmap_2d integration |

**Recommended integration path:**

```
Phase 1 (prototype, 2-3 weeks):
  octomap_server for 3D occupancy (CPU, single LiDAR only)
  + costmap_2d for 2D planning costmap
  + spatio_temporal_voxel_layer for decay
  → Validates the pipeline, identifies parameter tuning needs
  
Phase 2 (production, 6-10 weeks):
  Custom GPU occupancy nodelet (CUDA raycasting, spatial hash)
  + costmap_2d for 2D costmap management
  + custom fleet sharing node
  → Full throughput, multi-LiDAR, meets 10 Hz at 4-8 LiDARs
```

### 11.4 TF Frame Management

```
TF tree for occupancy:

map (GTSAM output, global frame)
  └── vehicle_base (ego vehicle frame)
      ├── lidar_front_left
      ├── lidar_front_right
      ├── lidar_rear_left
      ├── lidar_rear_right
      ├── lidar_left
      ├── lidar_right
      ├── lidar_front_center
      └── lidar_rear_center

Occupancy grid operates in:
  - map frame (for fleet sharing, persistent map)
  - vehicle_base frame (for ego-centric costmap, planning)

Each LiDAR→vehicle_base transform is static (from calibration).
vehicle_base→map transform is dynamic (from GTSAM at 100 Hz).
```

### 11.5 `spatio_temporal_voxel_layer` for Quick Start

The `spatio_temporal_voxel_layer` ROS package is a drop-in costmap layer that provides 3D voxel tracking with built-in temporal decay -- closely matching the requirements described in this document:

```yaml
# costmap_common_params.yaml
plugins:
  - {name: spatio_temporal_voxel_layer, type: "spatio_temporal_voxel_layer/SpatioTemporalVoxelLayer"}

spatio_temporal_voxel_layer:
  enabled: true
  voxel_decay: 1.0           # seconds (maps to dynamic decay)
  decay_model: 0              # 0=linear, 1=exponential
  voxel_size: 0.2             # meters
  track_unknown_space: true
  mark_threshold: 0           # 0 = mark on first observation
  update_footprint_enabled: true
  combination_method: 1       # 1 = max (conservative)
  origin_z: 0.0
  z_resolution: 0.2
  z_voxels: 15                # 15 * 0.2 = 3.0m height
  observation_sources: merged_lidar
  merged_lidar:
    topic: /merged_points
    sensor_frame: vehicle_base
    observation_persistence: 0.0  # Use voxel_decay instead
    expected_update_rate: 10.0
    data_type: PointCloud2
    min_obstacle_height: 0.1
    max_obstacle_height: 2.8     # Vehicle height + margin
    marking: true
    clearing: true
    min_z: 0.1
    max_z: 2.8
```

**Limitations of `spatio_temporal_voxel_layer`:**
- CPU-based (OpenVDB backend) -- marginal at 4-8 LiDARs
- No multi-resolution support
- No fleet sharing
- No GPU raycasting
- Suitable for Phase 1 prototype, not production

---

## 12. Performance on Orin

### 12.1 GPU Memory Budget

```
Orin AGX 64GB: 64 GB unified memory (shared CPU+GPU)
Orin AGX 32GB: 32 GB unified memory

Occupancy grid GPU memory allocation:

Near grid (0.1m, 30x30x6m):
  300 x 300 x 60 = 5.4M voxels x 2 bytes = 10.8 MB

Medium grid (0.2m, 100x100x8m):
  500 x 500 x 40 = 10M voxels x 2 bytes = 20 MB
  (Dense. For sparse hash: ~2M occupied x 8 bytes = 16 MB)

Far grid (0.8m, 300x300x8m):
  375 x 375 x 10 = 1.4M voxels x 2 bytes = 2.8 MB

Dynamic grid (0.2m, 100x100x4m):
  500 x 500 x 20 = 5M voxels x 2 bytes = 10 MB

2D costmap (0.2m, 200x200m):
  1000 x 1000 x 1 byte = 1 MB

2D costmap inflated:
  1000 x 1000 x 1 byte = 1 MB

Point cloud buffer (GPU):
  1.2M points x 16 bytes (xyzI) = 19.2 MB

Sensor origins:
  8 x 12 bytes = 96 bytes

TOTAL GPU MEMORY: ~65 MB
  (Out of 32 GB = 0.2% — negligible)
```

### 12.2 CUDA Stream Management

Run occupancy grid operations on a dedicated CUDA stream to avoid blocking other GPU tasks:

```cpp
// CUDA stream for occupancy (separate from PointPillars, localization)
cudaStream_t occupancy_stream;
cudaStreamCreate(&occupancy_stream);

// All occupancy kernels run on this stream
raycast_kernel<<<grid, block, 0, occupancy_stream>>>(...);
decay_kernel<<<grid, block, 0, occupancy_stream>>>(...);
projection_kernel<<<grid, block, 0, occupancy_stream>>>(...);
inflation_kernel<<<grid, block, 0, occupancy_stream>>>(...);

// Synchronize only when downloading result to CPU
cudaStreamSynchronize(occupancy_stream);
// Copy costmap to CPU for ROS publishing
cudaMemcpyAsync(cpu_costmap, gpu_costmap, size, 
                cudaMemcpyDeviceToHost, occupancy_stream);
```

### 12.3 Pipeline Timing Breakdown

```
Per-frame occupancy pipeline on Orin AGX (4 LiDARs, ~300K points):

Step                          | GPU Time | Memory     | Notes
------------------------------|----------|------------|--------
Point upload to GPU           | 0.3ms    | 4.8 MB     | PCIe/unified memory
Static/dynamic separation     | 0.5ms    | negligible | Per-point classification
Near grid raycasting (0.1m)   | 2-4ms    | 10.8 MB    | ~50K near points
Medium grid raycasting (0.2m) | 2-5ms    | 20 MB      | ~200K medium points
Far grid raycasting (0.8m)    | 0.5-1ms  | 2.8 MB     | ~50K far points
Dynamic grid decay            | 0.3ms    | 10 MB      | Parallel over all voxels
3D→2D projection              | 0.3ms    | 1 MB       | Per-column max
Costmap inflation             | 0.5ms    | 1 MB       | Distance transform
Fleet grid merge              | 0.5ms    | 1 MB       | Max over remote grids
Download to CPU               | 0.2ms    | 1 MB       | Async copy
------------------------------|----------|------------|--------
TOTAL                         | 7-13ms   | ~65 MB     | Well within 100ms budget

For 8 LiDARs (~900K points):
  Raycasting steps roughly 2x: total ~12-22ms
  Still within 100ms budget
```

### 12.4 Concurrent Execution with Other Tasks

```
Orin GPU timeline (one 100ms planning cycle):

Time 0ms:    PointPillars starts (6.84ms)
Time 0ms:    Occupancy raycasting starts (parallel CUDA stream)
Time 7ms:    PointPillars complete → detections available
Time 7ms:    Static/dynamic separation uses detections
Time 10ms:   Occupancy raycasting complete
Time 10ms:   3D→2D projection + inflation starts
Time 12ms:   Costmap published → Frenet planner starts
Time 12ms:   Occupancy visualization computed (background)
Time 22ms:   Frenet planner completes (420 candidates evaluated)
Time 22ms:   GTSAM localization update (parallel, 15-25ms)
...
Time 100ms:  Next LiDAR scan arrives

GPU utilization: ~30-40% for occupancy + detection
Leaves ~60% for localization, future neural perception, etc.
```

### 12.5 Performance Scaling

| Configuration | Points/frame | Raycasting (ms) | Total pipeline (ms) | Feasible? |
|--------------|-------------|-----------------|--------------------|-----------| 
| 2 LiDARs | 150K | 2-4 | 4-7 | Easy |
| 4 LiDARs | 300K | 4-8 | 7-13 | Comfortable |
| 6 LiDARs | 600K | 7-14 | 12-20 | Good |
| 8 LiDARs | 900K | 10-20 | 15-28 | Sufficient (within 100ms) |
| 8 LiDARs + fleet | 900K + merge | 10-20 | 17-30 | Sufficient |
| 8 LiDARs + fleet + FOD | 900K + merge + fine | 10-20 | 20-35 | Sufficient |

Even the worst case (8 LiDARs + fleet + FOD detection) uses only 35ms of the 100ms budget, leaving ample room for other tasks.

### 12.6 Orin Power Modes

| Orin Power Mode | GPU Clock | Occupancy Latency | Use Case |
|----------------|-----------|-------------------|----------|
| MAXN (60W) | 1.3 GHz | 7-28ms | Full operation |
| 50W | 1.1 GHz | 9-35ms | Normal driving |
| 30W | 0.9 GHz | 12-45ms | Idle/low-speed |
| 15W | 0.6 GHz | 20-70ms | Parked, minimal awareness |

Even at 30W power mode, the occupancy grid runs within the 100ms budget. At 15W mode (parked/charging), occupancy can still maintain 10 Hz awareness for safety monitoring.

---

## 13. Key Takeaways

1. **Classical occupancy grids are the mandatory foundation layer.** Neural occupancy prediction (FlashOcc, SparseOcc) provides semantic understanding, but the geometric raycasting-based occupancy grid provides the certifiable, deterministic, zero-training-data safety baseline that every other perception module builds upon. The two are complementary, not competing.

2. **Log-odds Bayesian update is the correct formulation.** Addition instead of multiplication, numerically stable, trivially parallelizable on GPU, and O(1) per cell. Use asymmetric update strengths (L_OCC > |L_FREE|) to prevent phantom obstacles from noise while rapidly detecting real obstacles.

3. **OctoMap is insufficient for production multi-LiDAR operation.** Its CPU-bound octree traversal cannot process 400K-1.2M points at 10 Hz. Use it for prototyping only. Production requires GPU spatial hashing or nvblox.

4. **GPU raycasting on Orin processes 8 LiDARs in 10-20ms.** The 3D-DDA algorithm with spatial hashing achieves 7-28ms total pipeline latency, using only ~65 MB of GPU memory (0.2% of 32 GB Orin). This is comfortably within the 100ms planning cycle budget.

5. **Multi-resolution is essential for airside.** 0.1m near (FOD detection), 0.2m medium (personnel/GSE), 0.8m far (aircraft/building awareness). Total memory: ~16 MB. Cascaded dense grids with circular buffers provide optimal GPU performance.

6. **Two-grid architecture solves the static/dynamic problem.** A persistent static grid (slow decay) maintains infrastructure, while a fast-decay dynamic grid (1s half-life) tracks moving objects. Merge with max() for conservative planning.

7. **Height-filtered costmap projection is critical for airside.** Aircraft wings overhang at 4-6m; the ADT3 at 2.5m can pass under. The 3D-to-2D projection must use the vehicle's height envelope, not a simple max-height projection.

8. **Fleet-shared occupancy overcomes aircraft occlusion.** A 60m aircraft fuselage blocks line-of-sight for a single vehicle. Sharing compressed BEV costmaps at 2 Hz (5-15 KB per update) over airport 5G fills blind spots with negligible bandwidth cost.

9. **Virtual obstacles are required for invisible hazards.** Jet blast, engine intake suction, and fuel spill zones are invisible to LiDAR. The occupancy grid must be augmented with state-derived virtual zones based on A-CDM aircraft status data.

10. **FOD detection is feasible with a dedicated near-field fine grid.** A 0.05m resolution grid covering 20m x 20m x 0.5m uses only 3.2 MB and can detect objects >5cm (2+ voxels). Multi-frame persistence filtering eliminates transient noise.

11. **Reflective surfaces (wet tarmac, aircraft skin) cause phantom points.** Mitigate with ground plane filtering, intensity thresholding, multi-frame consistency requirements, and known-reflector maps.

12. **ESDF (Euclidean Signed Distance Field) is the optimal representation for future CBF integration.** While log-odds occupancy is sufficient for the current Frenet planner, the ESDF gradient field is required for CBF-QP safety filters (see `30-autonomy-stack/planning/safety-critical-planning-cbf.md`). nvblox computes ESDF from TSDF automatically.

13. **The `spatio_temporal_voxel_layer` ROS package provides a viable Phase 1 prototype** in 2-3 weeks, but its CPU-based OpenVDB backend will not sustain 10 Hz with 4-8 LiDARs in production.

14. **Conservative fusion is the only safe fleet merge strategy.** When two vehicles disagree on whether a cell is occupied, always assume occupied. A missed obstacle is catastrophic; a phantom obstacle merely causes a detour.

15. **Occupancy grid adds the most value to the existing Aurrigo stack.** The current RANSAC-cluster-to-Frenet pipeline has no explicit spatial representation between raw points and planning. Adding an occupancy grid provides: continuous cost fields (not sparse clusters), implicit inflation, unknown-object detection, fleet sharing, and the spatial backbone for every future capability.

16. **The occupancy grid is fully deterministic and inspectable.** Unlike neural perception, every cell value can be traced to specific LiDAR observations. This is a significant advantage for ISO 3691-4 certification and incident investigation.

17. **Temporal decay must be class-aware.** Personnel cells decay in 0.5s (must track actively), parked GSE in 30s (may move), static infrastructure never decays. Detection-gated decay prevents inappropriate forgetting of different object types.

---

## 14. Implementation Roadmap

### 14.1 Phased Plan

| Phase | Duration | Deliverable | Cost | Dependency |
|-------|----------|------------|------|-----------|
| **Phase 1: Prototype** | 2-3 weeks | `octomap_server` + `spatio_temporal_voxel_layer` + costmap_2d integration. Single LiDAR, CPU. Validates pipeline and parameter tuning | $5-8K | None |
| **Phase 2: GPU Core** | 6-8 weeks | Custom CUDA raycasting nodelet. Multi-resolution grids. Spatial hashing. 4-8 LiDARs at 10 Hz. 2D costmap output for Frenet | $15-22K | Phase 1 (parameters) |
| **Phase 3: Dynamic Handling** | 3-4 weeks | Static/dynamic separation. Detection-gated decay. Recency weighting. Two-grid architecture | $8-12K | Phase 2, PointPillars detector |
| **Phase 4: Fleet Sharing** | 3-4 weeks | Compressed BEV publishing. Fleet fusion node. Staleness handling. Conservative merge | $8-12K | Phase 2, fleet communication infrastructure |
| **Phase 5: Airside Tuning** | 2-3 weeks | Virtual obstacle injection (jet blast, intake). FOD detection fine grid. Reflective surface handling. Height-band costmaps | $5-8K | Phase 3, A-CDM integration |

### 14.2 Total Investment

| Item | Cost |
|------|------|
| Phase 1 (prototype) | $5-8K |
| Phase 2 (GPU core) | $15-22K |
| Phase 3 (dynamic) | $8-12K |
| Phase 4 (fleet) | $8-12K |
| Phase 5 (airside) | $5-8K |
| **Total** | **$41-62K** |
| **Timeline** | **16-22 weeks** |

### 14.3 Minimum Viable Product

**Phase 1 + Phase 2 alone ($20-30K, 8-11 weeks)** provide the core occupancy grid:
- Multi-LiDAR GPU raycasting at 10 Hz
- Multi-resolution grids (0.1m / 0.2m / 0.8m)
- 2D costmap generation for Frenet planner
- Height-filtered projection for aircraft wing clearance
- Basic temporal decay

This MVP immediately improves planning by replacing sparse RANSAC clusters with continuous occupancy-based costmaps, detecting unknown obstacles (FOD, novel objects), and providing the spatial backbone for all future perception capabilities.

---

## 15. References

### Foundational Papers

- Moravec, H.P. and Elfes, A. "High resolution maps from wide angle sonar." ICRA, 1985. (The original occupancy grid paper)
- Thrun, S., Burgard, W., and Fox, D. *Probabilistic Robotics.* MIT Press, 2005. (Chapter 9: Occupancy Grid Mapping)
- Hornung, A. et al. "OctoMap: An Efficient Probabilistic 3D Mapping Framework Based on Octrees." Autonomous Robots, 2013. (OctoMap)
- Amanatides, J. and Woo, A. "A Fast Voxel Traversal Algorithm for Ray Tracing." Eurographics, 1987. (3D-DDA algorithm)

### Modern Implementations

- Vizzo, I. et al. "VDBFusion: Flexible and Efficient TSDF Integration of Range Sensor Data." IEEE RA-L, 2022. (VDBFusion)
- Millane, A. et al. "nvblox: GPU-Accelerated Incremental Signed Distance Field Mapping." ICRA, 2024. (nvblox)
- Oleynikova, H. et al. "Voxblox: Incremental 3D Euclidean Signed Distance Fields for On-Board MAV Planning." IROS, 2017. (voxblox, CPU predecessor to nvblox)
- Niessner, M. et al. "Real-time 3D Reconstruction at Scale using Voxel Hashing." ACM TOG, 2013. (Spatial hashing for TSDF)

### GPU Techniques

- Laine, S. and Karras, T. "Efficient Sparse Voxel Octrees." IEEE TVCG, 2011. (GPU sparse octrees)
- Steinbruecker, F. et al. "Volumetric 3D Mapping in Real-Time on a CPU." ICRA, 2014. (Real-time volumetric mapping)

### ROS Packages

- `octomap`: `https://github.com/OctoMap/octomap` (BSD license)
- `octomap_server`: `https://github.com/OctoMap/octomap_mapping` (BSD license)
- `spatio_temporal_voxel_layer`: `https://github.com/SteveMacenski/spatio_temporal_voxel_layer` (LGPL 2.1)
- `costmap_2d`: Part of ROS Navigation stack (BSD license)
- `grid_map`: `https://github.com/ANYbotics/grid_map` (BSD license)
- `nvblox`: `https://github.com/nvidia-isaac/nvblox` (Apache 2.0)
- `voxblox`: `https://github.com/ethz-asl/voxblox` (BSD license)
- `VDBFusion`: `https://github.com/PRBonn/vdbfusion` (MIT license)

### Internal Repository References

| Topic | Document |
|-------|----------|
| Neural occupancy on Orin (FlashOcc, nvblox) | `30-autonomy-stack/world-models/occupancy-deployment-orin.md` |
| Occupancy prediction world models | `30-autonomy-stack/world-models/occupancy-world-models.md` |
| Occupancy flow and 4D scene understanding | `30-autonomy-stack/world-models/occupancy-flow-4d-scenes.md` |
| LiDAR SLAM algorithms | `30-autonomy-stack/localization-mapping/overview/lidar-slam-algorithms.md` |
| 3DGS for perception and mapping | `30-autonomy-stack/perception/overview/gaussian-splatting-driving.md` |
| Sensor fusion architectures | `30-autonomy-stack/perception/overview/sensor-fusion-architectures.md` |
| CBF safety-critical planning | `30-autonomy-stack/planning/safety-critical-planning-cbf.md` |
| Runtime verification and monitoring | `60-safety-validation/runtime-assurance/runtime-verification-monitoring.md` |
| Multi-LiDAR extrinsic calibration | `hardware/sensors/multi-lidar-extrinsic-calibration.md` |
| HD map standards for airside | `30-autonomy-stack/localization-mapping/maps/hd-map-standards-airside.md` |
| Fleet cooperative perception | `30-autonomy-stack/perception/overview/collaborative-fleet-perception.md` |
| Active perception and sensor scheduling | `30-autonomy-stack/perception/overview/active-perception-sensor-scheduling.md` |
| Autonomous docking and precision positioning | `30-autonomy-stack/planning/autonomous-docking-precision-positioning.md` |
| Night operations and thermal fusion | `30-autonomy-stack/perception/overview/night-operations-thermal-fusion.md` |
| RoboSense LiDAR specifications | `20-av-platform/sensors/robosense-lidar.md` |
| NVIDIA Orin technical specifications | `20-av-platform/compute/nvidia-orin-technical.md` |
| TensorRT deployment guide | `20-av-platform/compute/tensorrt-deployment-guide.md` |
