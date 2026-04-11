# 3D Gaussian Splatting for Real-Time AV Perception and Mapping

## Executive Summary

3D Gaussian Splatting (3DGS) has rapidly expanded beyond offline scene reconstruction into **real-time perception, mapping, and SLAM** for autonomous vehicles. This document covers the cutting-edge application of Gaussian representations as a unified scene representation that enables simultaneous mapping, novel view synthesis, and semantic understanding — all running online on the vehicle. Unlike the existing simulation-focused 3DGS docs in this repo, this document focuses on **online, real-time, on-vehicle** applications: Gaussian-based SLAM, real-time mapping, semantic scene understanding, and occupancy prediction using Gaussian primitives. Key methods include GaussianFormer (3D semantic occupancy from Gaussians, 20.0 FPS on A100), SplaTAM/MonoGS (Gaussian SLAM achieving <1cm trajectory error), GaussianOcc (self-supervised occupancy via Gaussian rendering), and LiDAR-Gaussian fusion for online map construction. For airport airside operations, Gaussian representations offer compelling advantages: they naturally handle the large open spaces, reflective surfaces, and dynamic objects that challenge voxel-based approaches, while providing a unified representation for perception, mapping, and planning.

---

## Table of Contents

1. [Why Gaussians for Online Perception](#1-why-gaussians-for-online-perception)
2. [GaussianFormer: 3D Semantic Occupancy](#2-gaussianformer-3d-semantic-occupancy)
3. [Gaussian-Based SLAM](#3-gaussian-based-slam)
4. [GaussianOcc: Self-Supervised Occupancy](#4-gaussianocc-self-supervised-occupancy)
5. [Gaussian Representations for BEV and Mapping](#5-gaussian-representations-for-bev-and-mapping)
6. [LiDAR-Gaussian Integration](#6-lidar-gaussian-integration)
7. [Dynamic Object Handling](#7-dynamic-object-handling)
8. [Semantic and Panoptic Gaussians](#8-semantic-and-panoptic-gaussians)
9. [Edge Deployment and Optimization](#9-edge-deployment-and-optimization)
10. [Comparison with Voxel and NeRF Methods](#10-comparison-with-voxel-and-nerf-methods)
11. [Airport Airside Applications](#11-airport-airside-applications)
12. [Implementation Architecture](#12-implementation-architecture)
13. [Key Takeaways](#13-key-takeaways)

---

## 1. Why Gaussians for Online Perception

### 1.1 The Representation Problem

Traditional AV perception pipelines use separate, disconnected representations:
- **Voxel grids** for 3D occupancy (memory-intensive, fixed resolution)
- **Point clouds** for LiDAR processing (unstructured, no surface information)
- **BEV feature maps** for planning (lossy height compression)
- **Mesh/CAD models** for mapping (rigid, hard to update)

Each representation has strengths but forces information loss at conversion boundaries. A voxel grid cannot represent fine surface details without massive memory. Point clouds lack connectivity. BEV maps lose vertical information.

### 1.2 Gaussians as Unified Primitives

3D Gaussians offer a **continuous, adaptive-resolution, differentiable** scene representation:

| Property | Voxel Grid | Point Cloud | 3D Gaussians |
|----------|-----------|-------------|--------------|
| **Resolution** | Fixed (0.2-0.8m) | Sensor-dependent | Adaptive (mm to m) |
| **Memory** | O(N^3) | O(N) | O(K) where K << N^3 |
| **Surface quality** | Blocky | Sparse | Smooth, continuous |
| **Differentiable** | Partially | No | Fully |
| **Rendering** | Ray marching | Splatting | Tile-based rasterization |
| **Update** | Full grid | Point insertion | Gaussian refinement |
| **Semantic** | Per-voxel | Per-point | Per-Gaussian |
| **Speed (render)** | ~5-15 FPS | N/A | 100-300+ FPS |

Key advantages for online AV perception:

1. **Adaptive density**: Gaussians concentrate where detail matters (object surfaces, lane markings) and are sparse in empty space — critical for large airport aprons
2. **Differentiable rendering**: Enables self-supervised training from images without 3D labels
3. **Incremental updates**: New observations refine existing Gaussians rather than rebuilding the map
4. **Multi-modal fusion**: A Gaussian can carry position, covariance, color, semantic label, velocity, and uncertainty simultaneously
5. **Efficient rendering**: Tile-based rasterization achieves 100-300+ FPS, enabling real-time novel view synthesis for perception validation

### 1.3 From Offline to Online

The key transition in 2024-2025 research has been moving 3DGS from **offline reconstruction** (train for hours, then render) to **online, incremental** operation:

| Paradigm | Training | Inference | Use Case |
|----------|----------|-----------|----------|
| **Offline 3DGS** | Hours on GPU | Real-time render | Simulation, digital twin |
| **Feed-forward 3DGS** | Offline (once) | Single forward pass | Instant reconstruction |
| **Online SLAM-GS** | Per-frame update | Real-time | Live mapping + tracking |
| **Learned Gaussian prediction** | Offline training | Real-time inference | Occupancy, BEV, semantics |

The last two categories are the focus of this document: systems that either incrementally build Gaussian maps online, or predict Gaussian scene representations in a single forward pass for downstream perception tasks.

---

## 2. GaussianFormer: 3D Semantic Occupancy

### 2.1 GaussianFormer v1 (Huang et al., 2024)

**Paper:** "GaussianFormer: Scene as Gaussians for Vision-Based 3D Semantic Occupancy Prediction"

GaussianFormer reformulates 3D semantic occupancy prediction as **predicting a set of 3D Gaussians** rather than filling a voxel grid. This is a fundamental paradigm shift: instead of classifying every voxel in a dense grid, the model predicts a sparse set of Gaussians that implicitly define occupancy through their spatial extent.

**Architecture:**

```
Multi-view Images → Image Backbone (ResNet/Swin) → 2D Features
                                                        ↓
                              3D Gaussian Queries (learnable, N=K)
                                                        ↓
                              Gaussian-Image Cross-Attention
                                                        ↓
                              Gaussian-Gaussian Self-Attention
                                                        ↓
                              Predicted Gaussians: {μ, Σ, s, c}
                                                        ↓
                              Splatting to Voxel Grid → Occupancy Output
```

**Gaussian Parameterization:**
Each predicted Gaussian has:
- **Position** μ ∈ R^3: center in 3D space
- **Covariance** Σ ∈ R^{3×3}: shape and orientation (parameterized as scale + rotation quaternion)
- **Semantic logits** c ∈ R^C: per-class probability
- **Opacity** α ∈ [0, 1]: occupancy confidence

**Splatting to Occupancy:**
To produce the final voxel grid for evaluation:
```python
def gaussian_to_occupancy(gaussians, voxel_centers):
    """Convert predicted Gaussians to occupancy grid."""
    occ = torch.zeros(X, Y, Z, C)
    for g in gaussians:
        # Compute Gaussian weight at each voxel center
        diff = voxel_centers - g.mu  # (X*Y*Z, 3)
        weight = torch.exp(-0.5 * (diff @ g.Sigma_inv @ diff.T).diag())
        weight = weight * g.alpha  # scale by opacity
        # Accumulate semantic logits
        occ += weight.unsqueeze(-1) * g.semantic_logits
    return occ.softmax(dim=-1)
```

**Results on Occ3D-nuScenes:**

| Method | Type | mIoU | FPS (A100) | Parameters |
|--------|------|------|-----------|------------|
| BEVFormer | Voxel | 39.3 | ~5 | 68M |
| TPVFormer | Tri-plane | 34.3 | ~8 | 52M |
| SurroundOcc | Dense voxel | 34.7 | ~4 | 109M |
| FB-OCC | Dense voxel | 39.1 | ~7 | 62M |
| **GaussianFormer** | **Gaussian** | **39.2** | **20.0** | **49M** |

Key insight: GaussianFormer matches dense voxel methods in accuracy while being **3-5x faster** because it only processes K Gaussians (typically 10,000-50,000) instead of a full voxel grid (200×200×16 = 640,000 voxels).

**Memory Advantage:**
- Dense voxel (200×200×16, 256-dim features): ~20.5 GB
- GaussianFormer (25,600 Gaussians, 256-dim): ~6.5 GB
- **3.2x memory reduction** with comparable accuracy

### 2.2 GaussianFormer v2 (2025)

**Paper:** "GaussianFormer-2: Probabilistic Gaussian Superposition for Efficient 3D Occupancy Prediction"

GaussianFormer v2 addresses the key limitation of v1: the splatting-to-voxel conversion is a bottleneck and loses the elegance of the Gaussian representation.

**Key Improvements:**
1. **Probabilistic Gaussian Superposition**: Instead of soft splatting, models occupancy as a mixture of Gaussians with proper probabilistic semantics. The probability that a point p is occupied by class c is:

   P(class=c | p) = 1 - ∏_i (1 - α_i · N(p; μ_i, Σ_i) · softmax(c_i)[c])

2. **Efficient Overlap Handling**: Uses a spatial hash grid to only evaluate Gaussians near each query point, reducing O(K×V) to approximately O(K+V)

3. **Hierarchical Gaussian Refinement**: Coarse-to-fine prediction where initial large Gaussians are split into smaller ones in regions of high complexity

**Results:**

| Method | Occ3D mIoU | Memory (GB) | FPS (A100) |
|--------|-----------|-------------|-----------|
| GaussianFormer v1 | 39.2 | 6.5 | 20.0 |
| **GaussianFormer v2** | **41.1** | **5.8** | **22.4** |
| FlashOcc | 32.0 | 3.2 | 197.6 |
| SparseOcc | 30.3 | 3.8 | 87.5 |

GaussianFormer v2 achieves the best accuracy among efficient methods, though FlashOcc remains far faster for real-time-constrained deployment.

### 2.3 Implications for Airside Deployment

For airport operations on Orin AGX (275 TOPS INT8):

- **GaussianFormer v2 on Orin**: Estimated ~8-12 FPS after TensorRT optimization (vs 22.4 FPS on A100). Feasible for 100ms planning cycle if occupancy runs at 10 Hz
- **Gaussian count tuning**: Airport scenes are more open than urban → can use fewer Gaussians (10,000 vs 25,600), proportionally faster
- **Semantic classes**: Airside needs different classes than nuScenes — aircraft, baggage cart, tug, fuel truck, ground crew, tarmac, taxiway marking, jet bridge, terminal building
- **Advantage over voxels**: The adaptive resolution naturally handles the scale difference between a 60m aircraft and a 0.5m FOD item

---

## 3. Gaussian-Based SLAM

### 3.1 SplaTAM (Keetha et al., CVPR 2024)

**Paper:** "SplaTAM: Splat, Track & Map 3D Gaussians for Dense RGB-D SLAM"

SplaTAM is the first system to use 3DGS as the **sole scene representation** for simultaneous localization and mapping, replacing both the traditional map (point cloud, mesh, TSDF) and the feature map used for tracking.

**System Architecture:**

```
RGB-D Frame t
     ↓
┌─────────────────────┐
│  Camera Tracking     │  Render current Gaussians from candidate poses
│  (Differentiable)    │  Optimize pose via photometric + depth loss
│                      │  Result: T_t (camera pose)
└─────────┬───────────┘
          ↓
┌─────────────────────┐
│  Gaussian Densification  │  Add new Gaussians where silhouette
│                          │  rendering shows unobserved regions
│                          │  Initialize from depth back-projection
└─────────┬───────────────┘
          ↓
┌─────────────────────┐
│  Map Refinement      │  Joint optimization of all Gaussians
│  (Differentiable)    │  visible in recent keyframes
│                      │  Loss: L1 + SSIM (image) + L1 (depth)
└─────────────────────┘
```

**Tracking Details:**
- Renders the current Gaussian map from a candidate pose using differentiable rasterization
- Computes photometric loss (L1 + 0.5×SSIM) and depth loss (L1) against the observed frame
- Optimizes the 6-DOF pose (3 translation + 3 rotation as exponential map) via Adam for 40 iterations
- Convergence typically in 20-30 iterations → ~15ms per frame

**Mapping Details:**
- New Gaussians initialized from depth map in unobserved regions (detected via silhouette rendering)
- Each new Gaussian: position from depth back-projection, scale from local depth gradient, color from pixel
- Map refinement: 60 iterations of Gaussian parameter optimization per keyframe
- Keyframe selection: every 5th frame or when >40% of pixels are in unobserved regions

**Results on Replica Dataset:**

| Method | ATE RMSE (cm) | Rendering PSNR | FPS | Representation |
|--------|--------------|---------------|-----|----------------|
| iMAP | 3.62 | 22.1 | ~1 | MLP |
| NICE-SLAM | 1.69 | 24.7 | ~2 | Feature grids |
| Co-SLAM | 1.06 | 27.1 | ~3 | Hash grids |
| Point-SLAM | 0.61 | 35.2 | ~5 | Neural points |
| **SplaTAM** | **0.36** | **34.1** | **~8** | **3D Gaussians** |

SplaTAM achieves the best trajectory accuracy while being fastest among neural SLAM methods.

### 3.2 MonoGS (Matsuki et al., CVPR 2024)

**Paper:** "Gaussian Splatting SLAM"

MonoGS extends Gaussian SLAM to work with **monocular** (single RGB camera) input — no depth sensor required.

**Key Innovations:**
1. **Geometric Regularization**: Without depth, Gaussians can degenerate into flat disks facing the camera. MonoGS adds:
   - Isotropic loss: penalizes extreme scale ratios (encourages roughly spherical Gaussians)
   - Multi-view consistency: Gaussians must render consistently from multiple viewpoints
   
2. **Depth Estimation**: Uses a pretrained monocular depth network (DPT/MiDaS) for initial Gaussian placement, then refines through multi-view optimization

3. **Covisibility-Based Mapping**: Only optimizes Gaussians visible in the current covisibility group, enabling scaling to large scenes

**Results on TUM-RGBD:**

| Method | ATE RMSE (cm) | Input | Real-time? |
|--------|--------------|-------|-----------|
| ORB-SLAM3 | 0.71 | Mono | Yes |
| DROID-SLAM | 0.47 | Mono | No |
| **MonoGS** | **0.53** | **Mono** | **Yes** |
| SplaTAM | 0.36 | RGB-D | Yes |

MonoGS is competitive with DROID-SLAM while running in real-time and producing a full 3DGS map as a byproduct.

### 3.3 Photo-SLAM (Hhuang et al., 2024)

**Paper:** "Photo-SLAM: Real-time Simultaneous Localization and Photorealistic Mapping for Monocular, Stereo, and RGB-D Cameras"

Photo-SLAM focuses on **photorealistic quality** of the reconstructed Gaussian map while maintaining real-time SLAM performance.

**Key Features:**
- Hyper primitives: compact Gaussian representation with learned feature vectors decoded by a tiny MLP
- ORB-SLAM3 backend for robust tracking (not differentiable rendering-based tracking)
- Gaussian map used for rendering, not tracking — decouples accuracy from map quality
- Achieves highest PSNR among real-time SLAM methods (35+ dB on Replica)

### 3.4 LiDAR-Gaussian SLAM

For a LiDAR-primary stack like Aurrigo's, camera-based Gaussian SLAM can be augmented with LiDAR:

**LiDAR-GS SLAM Pipeline (Emerging, 2025):**

```python
class LiDARGaussianSLAM:
    """Gaussian SLAM with LiDAR as primary sensor."""
    
    def __init__(self):
        self.gaussians = GaussianCloud()  # the map
        self.pose_graph = PoseGraph()  # GTSAM factor graph
        self.keyframes = KeyframeDatabase()
        
    def process_frame(self, lidar_scan, imu_data, camera_images=None):
        # 1. LiDAR odometry for initial pose estimate
        T_odom = self.lidar_odometry(lidar_scan)
        
        # 2. Register against Gaussian map (render expected point cloud)
        T_refined = self.register_to_gaussian_map(
            lidar_scan, T_odom, 
            method='gaussian_icp'  # ICP against rendered point cloud
        )
        
        # 3. Add pose to factor graph
        self.pose_graph.add_odometry_factor(T_refined)
        
        # 4. Densify Gaussians from new observations
        new_gaussians = self.lidar_to_gaussians(lidar_scan, T_refined)
        self.gaussians.add(new_gaussians)
        
        # 5. Optional: refine with camera images
        if camera_images is not None:
            self.refine_gaussians_photometric(camera_images, T_refined)
        
        # 6. Keyframe management and map optimization
        if self.is_keyframe(lidar_scan, T_refined):
            self.keyframes.add(lidar_scan, T_refined)
            self.optimize_local_gaussians()
    
    def lidar_to_gaussians(self, scan, pose):
        """Convert LiDAR points to 3D Gaussians."""
        points = pose @ scan.points  # transform to world frame
        gaussians = []
        for p, intensity, normal in zip(points, scan.intensities, 
                                         estimate_normals(points)):
            g = Gaussian3D(
                position=p,
                # Scale: larger for distant points (less certain)
                scale=self.scale_from_range(p.range),
                # Rotation: aligned with surface normal
                rotation=quaternion_from_normal(normal),
                # Color: from intensity (or camera if available)
                color=intensity_to_rgb(intensity),
                opacity=0.95
            )
            gaussians.append(g)
        return gaussians
```

**Advantages over TSDF/Voxel SLAM for Airside:**
- No fixed resolution — can represent fine markings and large structures simultaneously
- Naturally handles large open areas without wasting memory on empty voxels
- Map rendering enables loop closure via appearance matching
- Semantic labels per Gaussian enable semantic mapping without separate pipeline

### 3.5 Gaussian SLAM Comparison

| Method | Input | ATE (cm) | PSNR | FPS | Map Size | Loop Closure |
|--------|-------|----------|------|-----|----------|-------------|
| SplaTAM | RGB-D | 0.36 | 34.1 | 8 | ~10M Gaussians | No |
| MonoGS | Mono/Stereo | 0.53 | 31.2 | 12 | ~5M Gaussians | Yes |
| Photo-SLAM | Any | 0.71 | 35.4 | 15 | ~3M Gaussians | Yes (ORB) |
| GS-SLAM | RGB-D | 0.48 | 33.8 | 5 | ~8M Gaussians | No |
| Gaussian-LiDAR* | LiDAR+Cam | 0.25* | 28.5* | 10* | ~15M Gaussians | Yes (GTSAM) |

*Estimated for LiDAR-primary configuration based on published components

---

## 4. GaussianOcc: Self-Supervised Occupancy

### 4.1 Overview (Gan et al., 2024)

**Paper:** "GaussianOcc: Fully Self-Supervised and Efficient 3D Occupancy Estimation with 3D Gaussian Splatting"

GaussianOcc bridges 3DGS and occupancy prediction with a key insight: if you can render depth and color from a set of 3D Gaussians, you can train occupancy prediction **entirely self-supervised** using multi-view photometric consistency — no 3D occupancy labels needed.

**Motivation:**
- Labeled 3D occupancy data is extremely expensive ($15-25 per frame at 0.4m resolution)
- For airside operations, **no labeled occupancy data exists at all**
- Self-supervised learning from sensor data alone is the only viable path for novel domains

### 4.2 Architecture

```
Surround-view Images (6 cameras)
          ↓
    Image Backbone (ResNet-50)
          ↓
    2D→3D Lifting (LSS/BEVDet style)
          ↓
    3D Gaussian Prediction Head
    → N Gaussians per image feature
    → Each: (μ, Σ, color, opacity, semantic)
          ↓
    Differentiable Gaussian Rendering
    → Render to target viewpoints
          ↓
    Self-Supervised Loss:
    - Photometric (L1 + SSIM)
    - Depth smoothness
    - Temporal consistency
    - Semantic clustering
```

**Self-Supervised Training:**

The training signal comes from **novel view synthesis**: the model predicts Gaussians from camera set A (e.g., front, left, right), then renders the predicted scene from camera set B viewpoints (e.g., rear, left-rear, right-rear). The photometric loss between rendered and actual images provides supervision.

```python
class GaussianOccLoss:
    def __init__(self):
        self.ssim = SSIM(window_size=11)
    
    def forward(self, pred_gaussians, target_images, target_poses):
        total_loss = 0
        for img, pose in zip(target_images, target_poses):
            # Render predicted Gaussians from target viewpoint
            rendered = differentiable_render(pred_gaussians, pose)
            
            # Photometric loss (robust to occlusion)
            photo_loss = 0.85 * self.ssim(rendered.rgb, img) + \
                        0.15 * F.l1_loss(rendered.rgb, img)
            
            # Depth smoothness (edge-aware)
            smooth_loss = edge_aware_smoothness(rendered.depth, img)
            
            # Temporal consistency (adjacent frames)
            temporal_loss = self.temporal_photometric(
                pred_gaussians, adjacent_frames
            )
            
            total_loss += photo_loss + 0.001 * smooth_loss + 0.1 * temporal_loss
        
        return total_loss
```

### 4.3 Results

**Occ3D-nuScenes (Self-Supervised):**

| Method | Supervision | mIoU | FPS |
|--------|-----------|------|-----|
| SurroundOcc | Full 3D labels | 34.7 | 4 |
| SimpleOccupancy | Full 3D labels | 32.1 | 12 |
| RenderOcc | Self-supervised | 25.2 | 8 |
| OccNeRF | Self-supervised | 22.8 | 3 |
| **GaussianOcc** | **Self-supervised** | **28.4** | **18** |
| **GaussianOcc + fine-tune** | **500 labeled frames** | **33.2** | **18** |

Key findings:
- GaussianOcc closes **80% of the gap** to fully supervised methods using zero 3D labels
- With just 500 labeled frames (~$10K labeling cost), performance approaches fully supervised
- 4.5x faster than OccNeRF due to efficient Gaussian rendering vs volumetric rendering

### 4.4 Relevance to Airside Operations

This is particularly important for Aurrigo because:

1. **No airside occupancy labels exist** — self-supervised is the only option initially
2. **Bootstrapping strategy**: Deploy GaussianOcc self-supervised → collect data → label a small set → fine-tune → iterate
3. **Camera-optional**: The method can work with cameras alone, enabling a camera fallback path alongside LiDAR
4. **Domain adaptation**: Self-supervised training on actual airport data avoids domain gap entirely

**Estimated labeling cost savings:**

| Approach | Frames Needed | Cost | mIoU (estimated) |
|----------|--------------|------|-------------------|
| Fully supervised | 28,000 | $420K-700K | 34-39 |
| GaussianOcc self-supervised | 0 | $0 | 28 |
| GaussianOcc + 500 labels | 500 | $7.5K-12.5K | 33 |
| GaussianOcc + active learning | 2,000 | $30K-50K | 36-38 |

---

## 5. Gaussian Representations for BEV and Mapping

### 5.1 GaussianBEV (2024)

Traditional BEV methods (LSS, BEVDet, BEVFormer) use either depth-based lifting or transformer queries to create BEV feature maps. GaussianBEV uses **predicted 3D Gaussians** as the 2D-to-3D lifting mechanism.

**Advantages over depth-based lifting:**
- No hard depth discretization (continuous distribution)
- Natural uncertainty representation (Gaussian covariance = spatial uncertainty)
- Multi-scale features from different-sized Gaussians
- More efficient than dense voxel sampling

**Pipeline:**
```
Image Features → Predict Gaussian Parameters per pixel
                → Splat Gaussians to BEV plane (z-axis integration)
                → BEV Feature Map
                → Detection / Segmentation / Planning heads
```

### 5.2 GaussianMap: Online Mapping with Gaussians

For HD map construction, Gaussians offer a natural representation:

```python
class GaussianHDMap:
    """HD Map represented as semantic 3D Gaussians."""
    
    def __init__(self, map_extent=(-100, 100, -100, 100)):
        self.static_gaussians = {}   # permanent map elements
        self.dynamic_gaussians = {}  # temporary/moving elements
        self.map_extent = map_extent
        
    def add_observation(self, gaussians, pose, timestamp):
        """Incrementally update map from new observations."""
        # Transform to global frame
        global_gaussians = transform_gaussians(gaussians, pose)
        
        for g in global_gaussians:
            # Find matching Gaussian in existing map
            match = self.find_nearest_gaussian(g, threshold=0.5)
            
            if match is not None:
                # Bayesian update: merge new observation with existing
                self.static_gaussians[match.id] = bayesian_merge(
                    prior=match, observation=g
                )
            else:
                # New map element
                self.static_gaussians[g.id] = g
    
    def bayesian_merge(self, prior, observation):
        """Bayesian fusion of two Gaussians."""
        # Kalman-like update
        K = prior.covariance @ np.linalg.inv(
            prior.covariance + observation.covariance
        )
        merged_mean = prior.mean + K @ (observation.mean - prior.mean)
        merged_cov = (np.eye(3) - K) @ prior.covariance
        
        # Semantic fusion (log-odds)
        merged_semantic = prior.semantic_logits + observation.semantic_logits
        
        return Gaussian3D(
            position=merged_mean,
            covariance=merged_cov,
            semantic_logits=merged_semantic,
            color=weighted_average(prior.color, observation.color),
            opacity=min(prior.opacity + 0.1, 1.0),  # confidence grows
            observation_count=prior.observation_count + 1
        )
    
    def render_bev(self, center, extent, resolution=0.1):
        """Render BEV map view from Gaussians."""
        # Efficient: only process Gaussians within extent
        visible = self.query_region(center, extent)
        bev = splat_to_bev(visible, center, extent, resolution)
        return bev  # (H, W, C) with semantic channels
    
    def get_lane_boundaries(self):
        """Extract lane boundaries from Gaussian map."""
        lane_gaussians = [g for g in self.static_gaussians.values()
                         if g.semantic_class in ['lane_marking', 'taxiway_edge']]
        # Fit splines through Gaussian centers
        return fit_lane_splines(lane_gaussians)
```

### 5.3 Map Change Detection

Gaussians naturally support map change detection — critical for airport environments where:
- **Temporary construction** blocks regular paths
- **Aircraft positions** change every turnaround cycle (15-90 min)
- **Seasonal changes** (snow, de-icing equipment) alter the environment

```python
def detect_map_changes(current_gaussians, map_gaussians, threshold=3.0):
    """Detect changes between current observation and stored map."""
    changes = []
    
    for cg in current_gaussians:
        match = find_nearest_in_map(cg, map_gaussians)
        if match is None:
            # New object not in map
            changes.append(MapChange('addition', cg))
        elif mahalanobis_distance(cg, match) > threshold:
            # Significant deviation from map
            changes.append(MapChange('modification', cg, match))
    
    # Check for removals (map elements not observed)
    for mg in map_gaussians.in_view(current_pose):
        if not has_observation(mg, current_gaussians):
            mg.unobserved_count += 1
            if mg.unobserved_count > 5:  # persistent absence
                changes.append(MapChange('removal', reference=mg))
    
    return changes
```

---

## 6. LiDAR-Gaussian Integration

### 6.1 LiDAR Points to Gaussians

Converting LiDAR point clouds to Gaussians is the bridge between Aurrigo's existing LiDAR pipeline and Gaussian-based perception.

**Direct Conversion (Per-Point):**
```python
def lidar_points_to_gaussians(points, intensities, normals=None):
    """Convert raw LiDAR points to 3D Gaussians.
    
    Args:
        points: (N, 3) LiDAR points in sensor frame
        intensities: (N,) return intensities
        normals: (N, 3) estimated surface normals (optional)
    Returns:
        List of Gaussian3D primitives
    """
    if normals is None:
        normals = estimate_normals_knn(points, k=20)
    
    gaussians = []
    for i, (p, intensity, normal) in enumerate(zip(points, intensities, normals)):
        range_m = np.linalg.norm(p)
        
        # Scale proportional to range (farther = less certain)
        # Beam divergence ≈ 0.1° → 1.7mm/m range
        along_beam = 0.02 + 0.002 * range_m  # range uncertainty
        cross_beam = 0.001 * range_m  # angular uncertainty
        
        # Covariance aligned with surface normal
        R = rotation_from_normal(normal)
        scale = np.array([cross_beam, cross_beam, along_beam])
        
        g = Gaussian3D(
            position=p,
            rotation=R,
            scale=scale,
            color=intensity_colormap(intensity),
            opacity=intensity_to_opacity(intensity, range_m)
        )
        gaussians.append(g)
    
    return gaussians
```

**Learned Conversion (Neural):**
Instead of hand-crafted conversion, a small network predicts optimal Gaussian parameters:

```python
class LiDARGaussianEncoder(nn.Module):
    """Predict Gaussian parameters from LiDAR features."""
    
    def __init__(self, in_channels=4, hidden=64, n_gaussians_per_pillar=4):
        super().__init__()
        self.pillar_encoder = PointPillarsEncoder(in_channels, hidden)
        self.gaussian_head = nn.Sequential(
            nn.Conv2d(hidden, hidden, 3, padding=1),
            nn.ReLU(),
            nn.Conv2d(hidden, n_gaussians_per_pillar * 14, 1)
            # 14 = 3(pos) + 4(quat) + 3(scale) + 3(color) + 1(opacity)
        )
    
    def forward(self, pillars):
        features = self.pillar_encoder(pillars)  # (B, C, H, W)
        gaussian_params = self.gaussian_head(features)  # (B, K*14, H, W)
        
        # Reshape and decode
        B, _, H, W = gaussian_params.shape
        params = gaussian_params.reshape(B, self.n_gaussians_per_pillar, 14, H, W)
        
        positions = params[:, :, :3]  # offset from pillar center
        rotations = F.normalize(params[:, :, 3:7], dim=2)  # unit quaternion
        scales = F.softplus(params[:, :, 7:10])  # positive scales
        colors = torch.sigmoid(params[:, :, 10:13])
        opacities = torch.sigmoid(params[:, :, 13:14])
        
        return GaussianCloud(positions, rotations, scales, colors, opacities)
```

### 6.2 Multi-LiDAR Fusion via Gaussians

Aurrigo uses 4-8 RoboSense LiDARs. Gaussian representations naturally handle multi-sensor fusion:

```python
class MultiLiDARGaussianFusion:
    """Fuse multiple LiDAR scans into unified Gaussian map."""
    
    def __init__(self, lidar_configs):
        self.lidar_configs = lidar_configs  # extrinsics, models
        self.gaussian_cloud = GaussianCloud()
    
    def fuse_scans(self, scans, vehicle_pose):
        """Fuse N LiDAR scans into unified Gaussian representation."""
        all_gaussians = []
        
        for scan, config in zip(scans, self.lidar_configs):
            # Transform to vehicle frame
            points_vehicle = config.extrinsic @ scan.points
            
            # Convert to Gaussians with sensor-specific uncertainty
            gaussians = lidar_points_to_gaussians(
                points_vehicle,
                scan.intensities,
                range_noise=config.range_noise,  # sensor-specific
                angular_noise=config.angular_noise
            )
            all_gaussians.extend(gaussians)
        
        # Merge overlapping Gaussians (in overlap zones)
        merged = self.merge_overlapping(all_gaussians)
        
        return merged
    
    def merge_overlapping(self, gaussians, distance_threshold=0.1):
        """Merge Gaussians from overlapping sensor FOVs."""
        # Build spatial index
        tree = KDTree([g.position for g in gaussians])
        
        merged = []
        used = set()
        for i, g in enumerate(gaussians):
            if i in used:
                continue
            # Find nearby Gaussians from different sensors
            neighbors = tree.query_ball_point(g.position, distance_threshold)
            group = [gaussians[j] for j in neighbors if j not in used]
            
            if len(group) > 1:
                # Covariance intersection (consistent fusion)
                merged_g = covariance_intersection(group)
                merged.append(merged_g)
            else:
                merged.append(g)
            
            used.update(neighbors)
        
        return merged
```

**Advantage for Aurrigo's 4-8 LiDAR setup:**
- Each LiDAR produces Gaussians with sensor-appropriate uncertainty
- Overlapping regions get tighter covariances (more confident)
- Non-overlapping regions retain single-sensor uncertainty
- No need for explicit point cloud registration — Gaussians merge naturally

### 6.3 Gaussian-Enhanced PointPillars

The existing Aurrigo stack uses PointPillars (6.84ms on Orin with TensorRT). Gaussians can augment this:

```
LiDAR Scan → PointPillars (fast detection)
           → Gaussian Encoder (scene representation)
           → Fuse: detection boxes + Gaussian occupancy
           → Planning with rich scene understanding
```

This hybrid approach preserves the proven, fast detection pipeline while adding Gaussian-based scene understanding for:
- Free-space estimation (critical for path planning)
- Surface quality assessment (pothole, ice, debris)
- Occluded region reasoning (what's behind the aircraft?)

---

## 7. Dynamic Object Handling

### 7.1 The Static-Dynamic Decomposition Problem

Airports are challenging because objects have very different dynamics:
- **Static**: terminal buildings, taxiway markings, light poles (permanent)
- **Semi-static**: parked aircraft (stable for 30-120 minutes)
- **Slow dynamic**: baggage carts, tugs, belt loaders (0-15 km/h)
- **Fast dynamic**: aircraft taxiing (10-30 km/h), emergency vehicles

3DGS methods must separate these categories because static Gaussians form the persistent map while dynamic Gaussians represent moving objects.

### 7.2 Methods for Dynamic Gaussian Separation

**PVG — Periodic Vibration Gaussian (Chen et al., 2024):**
Uses periodic vibration to model temporal dynamics. Each Gaussian has a time-dependent position:

μ(t) = μ_0 + A · sin(ω·t + φ)

Static objects: A ≈ 0 (no vibration)
Dynamic objects: learned amplitude, frequency, phase

**4D-GS (Wu et al., CVPR 2024):**
Represents dynamic scenes using a canonical space + deformation field:
- Static Gaussians: fixed position
- Dynamic Gaussians: position = canonical + Δ(t), where Δ is a neural deformation network
- HexPlane feature encoding for efficient spatial-temporal deformation

**Street Gaussians (Yan et al., ECCV 2024):**
Specifically designed for driving scenes:
- Composite model: static background Gaussians + per-object dynamic Gaussians
- Object tracking provides per-object 6-DOF trajectories
- Each tracked object has its own Gaussian set in object-local coordinates
- Global scene = static Gaussians ∪ {T_i(t) · object_i_Gaussians}

### 7.3 Real-Time Dynamic Gaussian Tracking

For online operation, dynamic objects need per-frame tracking and Gaussian update:

```python
class DynamicGaussianTracker:
    """Track dynamic objects as moving Gaussian clusters."""
    
    def __init__(self):
        self.tracks = {}  # id → DynamicGaussianTrack
        self.static_map = GaussianMap()
        self.next_id = 0
    
    def update(self, frame_gaussians, detections, ego_pose):
        """Update dynamic tracks from new frame."""
        # Separate static from dynamic using motion cues
        static, dynamic = self.classify_motion(
            frame_gaussians, self.static_map, ego_pose
        )
        
        # Update static map
        self.static_map.integrate(static, ego_pose)
        
        # Associate dynamic Gaussians with detections
        for det in detections:
            # Find Gaussians within detection box
            det_gaussians = self.gaussians_in_box(dynamic, det.box3d)
            
            # Match to existing track
            track = self.associate(det, det_gaussians)
            
            if track is not None:
                track.update(det, det_gaussians, ego_pose)
            else:
                # New track
                self.tracks[self.next_id] = DynamicGaussianTrack(
                    id=self.next_id,
                    detection=det,
                    gaussians=det_gaussians,
                    timestamp=frame_gaussians.timestamp
                )
                self.next_id += 1
        
        # Predict positions of unobserved tracks
        for track in self.tracks.values():
            if not track.updated_this_frame:
                track.predict(dt=0.1)  # constant velocity prediction
    
    def classify_motion(self, current, static_map, ego_pose):
        """Classify Gaussians as static or dynamic."""
        static, dynamic = [], []
        for g in current:
            # Compare with static map
            map_match = static_map.query_nearest(g.position)
            if map_match is not None:
                # Check if position matches map (account for ego motion)
                residual = np.linalg.norm(g.position - map_match.position)
                if residual < 0.3:  # matches map → static
                    static.append(g)
                else:
                    dynamic.append(g)  # deviated from map → dynamic
            else:
                dynamic.append(g)  # not in map → potentially dynamic
        return static, dynamic
```

### 7.4 Airside-Specific Dynamic Handling

| Object Category | Dynamics | Gaussian Strategy | Update Rate |
|----------------|----------|-------------------|-------------|
| Terminal/hangar | Static | Permanent map Gaussians | Monthly |
| Taxiway markings | Static | Permanent, high confidence | Monthly |
| Parked aircraft | Semi-static | Temporal Gaussians, 30-120 min lifetime | Per turnaround |
| Jet bridge | Semi-static | Articulated model (hinge joint) | Per minute |
| Baggage cart train | Slow dynamic | Track-based, velocity 0-15 km/h | 10 Hz |
| Ground crew | Slow dynamic | Point-based, unpredictable motion | 10 Hz |
| Taxiing aircraft | Dynamic | Large-scale tracking, priority object | 10 Hz |
| Emergency vehicle | Fast dynamic | High-priority tracking | 20 Hz |

---

## 8. Semantic and Panoptic Gaussians

### 8.1 Semantic 3D Gaussians

Each Gaussian carries semantic information alongside geometry:

**Feature-3DGS (Zhou et al., 2024):**
- Attaches a learned feature vector to each Gaussian
- Feature vectors trained via contrastive loss with CLIP/DINOv2 features
- Enables open-vocabulary queries: "find the fuel truck" → query Gaussians by feature similarity

**LEGaussians (Shi et al., 2024):**
Language-Embedded Gaussians:
- Each Gaussian stores a compact language embedding (32-64 dim)
- Trained from multi-view CLIP features via distillation
- Enables natural language grounding in 3D: point at a region and ask "what is this?"

**LangSplat (Qin et al., CVPR 2024):**
- Hierarchical language features at multiple scales (object, part, material)
- SAM masks guide Gaussian-level language feature assignment
- Achieves 199x speedup over LERF (NeRF-based) for language grounding

### 8.2 Panoptic Gaussian Representation

For full scene understanding, Gaussians need both semantic class and instance identity:

```python
class PanopticGaussian:
    """3D Gaussian with full panoptic information."""
    position: np.ndarray    # (3,) center
    covariance: np.ndarray  # (3,3) shape
    color: np.ndarray       # (3,) RGB
    opacity: float          # [0, 1]
    
    # Semantic
    semantic_class: int     # e.g., 'aircraft', 'tug', 'ground_crew'
    semantic_confidence: float
    
    # Instance  
    instance_id: int        # unique object instance
    
    # Language (optional)
    language_embedding: np.ndarray  # (32,) CLIP-aligned
    
    # Temporal
    velocity: np.ndarray    # (3,) per-Gaussian velocity
    last_observed: float    # timestamp
    observation_count: int  # confidence proxy
```

### 8.3 Airside Semantic Classes

| Class | Description | Gaussian Properties |
|-------|------------|-------------------|
| `tarmac` | Paved surface | Flat, high confidence, large scale |
| `taxiway_marking` | Yellow/white lines | Thin, elongated Gaussians |
| `aircraft_body` | Fuselage, wings | Large, often reflective |
| `aircraft_engine` | Jet engines | Small, high-priority safety zone |
| `baggage_cart` | Cart train | Medium, articulated chain |
| `tug_vehicle` | Pushback tug, tow | Medium, tracked |
| `belt_loader` | Conveyor belt | Articulated, semi-static |
| `fuel_truck` | Fuel tanker | Large, hazmat zone |
| `ground_crew` | Personnel | Small, unpredictable motion |
| `jet_bridge` | Passenger boarding | Articulated, semi-static |
| `fod` | Foreign object debris | Very small (< 10cm), critical |
| `cone_barrier` | Safety cones/barriers | Small, static or semi-static |
| `light_pole` | Apron lighting | Tall, thin, static |
| `terminal` | Terminal building | Very large, static background |

---

## 9. Edge Deployment and Optimization

### 9.1 Gaussian Count vs Performance

The number of Gaussians directly controls compute and memory:

| Gaussian Count | Memory (FP16) | Render Time (A100) | Render Time (Orin est.) | Scene Coverage |
|---------------|--------------|--------------------|-----------------------|----------------|
| 5,000 | 0.5 MB | 0.8 ms | 3.2 ms | Sparse (main objects) |
| 10,000 | 1.0 MB | 1.5 ms | 6.0 ms | Medium (objects + ground) |
| 25,000 | 2.5 MB | 3.5 ms | 14 ms | Dense (full scene) |
| 50,000 | 5.0 MB | 6.5 ms | 26 ms | Very dense |
| 100,000 | 10.0 MB | 12 ms | 48 ms | Maximum detail |

For 100ms planning cycle on Orin, budget ~25ms for Gaussian processing → **25,000-50,000 Gaussians** is the practical limit.

### 9.2 TensorRT Optimization

GaussianFormer can be partially accelerated with TensorRT:

**Optimizable components:**
- Image backbone (ResNet/Swin) → TensorRT FP16: 2-4x speedup
- 2D→3D lifting → TensorRT INT8: 3-5x speedup
- Gaussian parameter prediction head → TensorRT FP16: 2-3x speedup

**Non-optimizable (custom CUDA):**
- Gaussian rasterization → Custom CUDA kernel (gsplat library)
- Tile-based sorting → Custom CUDA
- Alpha-compositing → Custom CUDA

**Estimated GaussianFormer pipeline on Orin AGX:**

| Component | A100 Latency | Orin Latency (est.) | Optimization |
|-----------|-------------|--------------------|--------------| 
| Image backbone (ResNet-50) | 8 ms | 15 ms | TensorRT FP16 |
| Gaussian cross-attention | 12 ms | 25 ms | TensorRT FP16 |
| Gaussian self-attention | 6 ms | 12 ms | TensorRT FP16 |
| Gaussian parameter decode | 2 ms | 5 ms | TensorRT INT8 |
| Splatting to occupancy | 15 ms | 35 ms | Custom CUDA |
| **Total** | **43 ms** | **92 ms** | |

This is tight for a 100ms cycle but feasible, especially if:
- Backbone features are shared with detection head (already computed)
- Gaussian count is reduced for airside (more open scenes)
- Splatting is only done for the planning-relevant region (50m radius)

### 9.3 Memory Budget on Orin

Orin AGX has 32GB unified memory (or 64GB on industrial modules). Budget allocation for Gaussian-augmented pipeline:

| Component | Memory | Notes |
|-----------|--------|-------|
| Image backbone + BEV | 2.5 GB | Shared with detection |
| GaussianFormer model | 0.4 GB | 49M parameters FP16 |
| Active Gaussians (50K) | 5 MB | Position + params |
| Gaussian map cache (500K) | 50 MB | Local area map |
| PointPillars (existing) | 0.3 GB | Unchanged |
| GTSAM localization | 0.5 GB | Unchanged |
| Planning + control | 0.3 GB | Unchanged |
| TensorRT engine cache | 1.0 GB | Pre-compiled |
| OS + ROS overhead | 2.0 GB | |
| **Total** | **~7.0 GB** | Well within 32GB |

### 9.4 Quantization Strategies

**FP16 (Default):**
- GaussianFormer: <1% mIoU loss
- Gaussian rasterization: requires FP32 for alpha-compositing (numerical stability)

**INT8 (Aggressive):**
- Backbone only: 1-2% mIoU loss, 1.5x speedup
- Full pipeline INT8: not recommended (Gaussian covariance loses precision)

**Mixed Precision (Recommended):**
- Backbone + attention: FP16
- Gaussian parameters: FP32 (positions, covariances need precision)
- Semantic heads: INT8 (classification is robust to quantization)

---

## 10. Comparison with Voxel and NeRF Methods

### 10.1 Representation Comparison for Online Perception

| Criterion | Voxel Grid | NeRF | 3D Gaussians | Winner |
|-----------|-----------|------|---------------|--------|
| **Render speed** | N/A | 0.1-5 FPS | 100-300+ FPS | 3DGS |
| **Training speed** | N/A | Hours | Minutes | 3DGS |
| **Online update** | Easy (grid write) | Hard (MLP retrain) | Medium (Gaussian add/merge) | Voxel |
| **Memory efficiency** | O(N^3) | O(MLP params) | O(K), K << N^3 | 3DGS |
| **Geometric accuracy** | Resolution-limited | Continuous | Continuous | NeRF ≈ 3DGS |
| **Semantic integration** | Per-voxel | Per-ray (slow) | Per-Gaussian | Voxel ≈ 3DGS |
| **View synthesis** | Limited | Excellent | Excellent | NeRF ≈ 3DGS |
| **Edge deployment** | Proven (FlashOcc) | Infeasible | Emerging | Voxel |
| **Dynamic objects** | Requires separate | Hard | Natural decomposition | 3DGS |
| **Uncertainty** | Bayesian grid | Ensemble needed | Covariance = uncertainty | 3DGS |

### 10.2 When to Use Which

**Use Voxel Grids when:**
- Maximum speed required (FlashOcc at 197.6 FPS)
- Fixed-resolution is acceptable
- Edge deployment maturity is critical (TensorRT pipeline proven)
- Standard benchmarks matter (most benchmarks evaluate voxel output)

**Use 3D Gaussians when:**
- Adaptive resolution needed (large airport + small FOD)
- Self-supervised training is required (no labels available)
- Map construction/update is a primary use case
- Rich scene representation for multiple downstream tasks
- Camera-LiDAR fusion in a unified representation

**Use NeRF when:**
- Offline reconstruction only (digital twin creation)
- Maximum photorealistic quality needed
- Real-time rendering not required

### 10.3 Hybrid Voxel-Gaussian Architecture

The practical recommendation for Aurrigo is a **hybrid** approach:

```
LiDAR Scan ──→ PointPillars ──→ Fast 3D Detection (6.84ms)
           │
           └──→ Gaussian Encoder ──→ Scene Gaussians
                                         ↓
Camera ────→ Image Backbone ────────→ GaussianFormer
                                         ↓
                              Gaussian Map (unified)
                                    ↓          ↓
                            BEV Occupancy    Semantic Map
                                    ↓          ↓
                              Frenet Planner (existing)
```

Benefits:
- PointPillars provides proven, fast detection (unchanged)
- Gaussians add scene understanding, free space, and map update
- Shared image backbone reduces redundant computation
- Gradual integration — can add Gaussian components incrementally

---

## 11. Airport Airside Applications

### 11.1 Gaussian Map for Airport Operations

Airport environments have unique characteristics that favor Gaussian representations:

**Large scale with fine details:**
- Apron area: 200m × 500m typical
- But must detect FOD: 2-10cm objects
- Voxel grid at 0.1m resolution: 2000 × 5000 × 50 = 500M voxels → infeasible
- Gaussians: ~100K for full apron at mixed resolution → feasible

**Reflective surfaces:**
- Aircraft fuselages are highly reflective (specular)
- Wet tarmac creates mirror-like reflections
- Gaussians can model view-dependent appearance via spherical harmonics
- Voxel grids assume Lambertian (diffuse) surfaces

**Dynamic environment:**
- Aircraft gate assignments change multiple times per day
- Ground equipment moves continuously during turnaround
- Gaussian map naturally separates static infrastructure from dynamic operations

### 11.2 FOD Detection Enhancement

Foreign Object Debris (FOD) detection is a critical airside safety function. Gaussians can enhance detection:

```python
class GaussianFODDetector:
    """Detect FOD by comparing current Gaussians against static map."""
    
    def __init__(self, static_map, fod_threshold=0.05):
        self.static_map = static_map
        self.fod_threshold = fod_threshold  # meters
    
    def detect(self, current_gaussians, ego_pose):
        """Detect small anomalous objects on tarmac surface."""
        candidates = []
        
        for g in current_gaussians:
            # Only check tarmac region (ground plane ± 0.3m)
            if abs(g.position[2] - self.ground_height(g.position[:2])) > 0.3:
                continue
            
            # Check if this Gaussian is in the static map
            map_match = self.static_map.query_nearest(g.position)
            
            if map_match is None or self.is_anomalous(g, map_match):
                # Small Gaussian on tarmac not in map → FOD candidate
                if g.scale.max() < 0.5:  # size filter
                    candidates.append(FODCandidate(
                        position=g.position,
                        size_estimate=g.scale * 2,  # 2-sigma extent
                        confidence=g.opacity,
                        source='gaussian_anomaly'
                    ))
        
        # Cluster nearby candidates
        clusters = self.cluster_candidates(candidates, eps=0.2)
        
        # Filter by persistence (seen in multiple frames)
        persistent = self.temporal_filter(clusters, min_frames=3)
        
        return persistent
```

### 11.3 Aircraft Proximity Monitoring

Gaussians provide a rich representation for monitoring vehicle-to-aircraft distance — the most critical safety metric on the airside:

```python
def compute_aircraft_clearance(vehicle_gaussians, aircraft_gaussians):
    """Compute minimum clearance between vehicle and aircraft using Gaussians.
    
    Unlike bounding-box distance, this accounts for actual shape.
    E.g., clearance to wingtip vs fuselage vs engine nacelle.
    """
    min_clearance = float('inf')
    critical_point = None
    
    for vg in vehicle_gaussians:
        for ag in aircraft_gaussians:
            # Mahalanobis distance accounts for Gaussian shape
            d = gaussian_distance(vg, ag)
            
            if d < min_clearance:
                min_clearance = d
                critical_point = {
                    'vehicle_point': vg.position,
                    'aircraft_point': ag.position,
                    'aircraft_part': ag.semantic_class,  # 'wing', 'engine', 'fuselage'
                    'clearance_m': d
                }
    
    return min_clearance, critical_point
```

### 11.4 Turnaround Progress Monitoring

Gaussians with semantic labels can monitor turnaround operations:

| Operation | Gaussian Signal | Detection Method |
|-----------|----------------|-----------------|
| Aircraft arrival | Large new Gaussian cluster at gate | Cluster size + velocity → 0 |
| Chocks placed | Small static Gaussians near wheels | Semantic class + position |
| Jet bridge connected | Bridge Gaussians extend to aircraft | Topology change detection |
| Belt loader positioned | Medium Gaussians near cargo door | Semantic class + proximity |
| Fueling started | Fuel truck Gaussians near wing | Semantic class + proximity |
| Pushback initiated | Tug Gaussians attached to nose | Track association + motion |
| Aircraft departure | Large Gaussian cluster leaves gate | Cluster velocity increase |

---

## 12. Implementation Architecture

### 12.1 ROS Integration

```python
#!/usr/bin/env python3
"""Gaussian perception node for Aurrigo ROS stack."""

import rospy
import torch
from sensor_msgs.msg import PointCloud2, Image
from nav_msgs.msg import OccupancyGrid
from gaussian_perception.msg import GaussianCloud, GaussianMap

class GaussianPerceptionNode:
    def __init__(self):
        rospy.init_node('gaussian_perception')
        
        # Parameters
        self.max_gaussians = rospy.get_param('~max_gaussians', 25000)
        self.map_update_rate = rospy.get_param('~map_update_rate', 2.0)
        self.detection_range = rospy.get_param('~detection_range', 80.0)
        
        # Model
        self.model = self.load_model()
        
        # Subscribers
        rospy.Subscriber('/rslidar_points', PointCloud2, self.lidar_cb)
        rospy.Subscriber('/camera/front/image_raw', Image, self.camera_cb)
        
        # Publishers
        self.gaussian_pub = rospy.Publisher(
            '/perception/gaussians', GaussianCloud, queue_size=1
        )
        self.occupancy_pub = rospy.Publisher(
            '/perception/gaussian_occupancy', OccupancyGrid, queue_size=1
        )
        self.map_pub = rospy.Publisher(
            '/mapping/gaussian_map', GaussianMap, queue_size=1
        )
        
        # Map state
        self.gaussian_map = GaussianHDMap()
        self.map_timer = rospy.Timer(
            rospy.Duration(1.0 / self.map_update_rate),
            self.publish_map
        )
    
    def lidar_cb(self, msg):
        """Process LiDAR scan into Gaussians."""
        points = pointcloud2_to_array(msg)
        
        # Fast path: PointPillars detection (existing, unchanged)
        # This node adds Gaussian scene representation
        
        # Convert LiDAR to Gaussians
        with torch.no_grad():
            gaussians = self.model.lidar_to_gaussians(points)
        
        # Publish current-frame Gaussians
        self.gaussian_pub.publish(gaussians.to_ros_msg())
        
        # Generate occupancy grid from Gaussians
        occupancy = gaussians.splat_to_grid(
            resolution=0.4,
            extent=(-40, 40, -40, 40, -1, 5)
        )
        self.occupancy_pub.publish(occupancy.to_ros_msg())
        
        # Update persistent map
        ego_pose = self.get_ego_pose()
        self.gaussian_map.add_observation(gaussians, ego_pose, msg.header.stamp)
    
    def camera_cb(self, msg):
        """Optional: refine Gaussians with camera data."""
        if self.model.has_camera_branch:
            image = imgmsg_to_tensor(msg)
            self.model.refine_with_image(image)
    
    def publish_map(self, event):
        """Publish current Gaussian map."""
        ego_pose = self.get_ego_pose()
        local_map = self.gaussian_map.query_region(
            ego_pose[:2, 3], extent=self.detection_range
        )
        self.map_pub.publish(local_map.to_ros_msg())
```

### 12.2 Phased Integration Plan

| Phase | Scope | Duration | Investment | Benefit |
|-------|-------|----------|-----------|---------|
| **1. Research** | GaussianFormer eval on nuScenes, benchmark on Orin | 4-6 weeks | $5K compute | Validate feasibility |
| **2. LiDAR-Gaussian** | Convert LiDAR scans to Gaussians, basic map | 6-8 weeks | $10K | Enhanced free-space estimation |
| **3. Self-supervised** | GaussianOcc training on airport data | 8-12 weeks | $15K compute | Occupancy without labels |
| **4. Semantic** | Add semantic classes, panoptic tracking | 8-12 weeks | $20K (labeling) | Full scene understanding |
| **5. Map integration** | Gaussian HD map, change detection | 12-16 weeks | $15K | Live map updates |
| **6. Production** | TensorRT optimization, safety validation | 12-16 weeks | $25K | Deployment-ready |
| **Total** | | **12-18 months** | **$90K** | |

### 12.3 Data Requirements

| Training Phase | Data Needed | Source | Estimated Size |
|---------------|-------------|--------|---------------|
| Pre-training | nuScenes + Waymo Open | Public datasets | ~1TB |
| Self-supervised fine-tune | Airport LiDAR+camera logs | Aurrigo fleet | 500-2000 hours |
| Supervised fine-tune | Labeled airport frames | Manual annotation | 500-2000 frames |
| Map construction | Full airport coverage | Mapping drives | 10-50 drives per airport |
| Evaluation | Held-out airport data | Aurrigo fleet | 100+ hours |

---

## 13. Key Takeaways

1. **GaussianFormer achieves 39.2 mIoU at 20 FPS on A100** — matching dense voxel methods (39.3 mIoU) while being 3-5x faster and using 3.2x less memory

2. **GaussianOcc enables self-supervised occupancy** — closing 80% of the gap to supervised methods with zero 3D labels, critical for airside where no labeled data exists

3. **Gaussian SLAM (SplaTAM) achieves <0.4cm trajectory error** on Replica, producing a photorealistic map as a byproduct — could eventually replace or augment GTSAM

4. **50,000 Gaussians fit within 100ms on Orin AGX** — practical for real-time perception in the planning cycle, with ~25ms budget for Gaussian processing

5. **Adaptive resolution is the key advantage over voxels** — a single representation handles 200m aprons and 2cm FOD items, while a voxel grid at 2cm resolution for a full apron would require 500M voxels

6. **LiDAR-to-Gaussian conversion is natural** — each LiDAR point becomes a Gaussian with range-dependent uncertainty, and multi-LiDAR fusion reduces to Gaussian merging (covariance intersection)

7. **Dynamic objects decompose naturally** — static map Gaussians persist, dynamic object Gaussians track with velocity, enabling change detection and FOD identification

8. **Semantic Gaussians unify perception** — a single Gaussian carries position, shape, class, instance, language embedding, velocity, and uncertainty simultaneously

9. **GaussianFormer v2 improves to 41.1 mIoU** with probabilistic superposition, while reducing memory to 5.8 GB — the accuracy/efficiency Pareto frontier is advancing rapidly

10. **Self-supervised + 500 labeled frames achieves 33.2 mIoU** — only 5.9 points below full supervision (39.1 mIoU), at 1.8% of the labeling cost ($12.5K vs $700K)

11. **Gaussian maps support incremental Bayesian updates** — new observations refine existing Gaussians via Kalman-like fusion, enabling live map maintenance without full reconstruction

12. **Airport FOD detection benefits from Gaussian anomaly detection** — comparing current-frame Gaussians against the static map identifies small objects that don't belong, complementing LiDAR-based detection

13. **Aircraft proximity monitoring is more accurate with Gaussians** — Gaussian-to-Gaussian distance respects actual shape (wing tip, engine nacelle), unlike bounding box center-to-center distance

14. **Recommended hybrid architecture**: PointPillars (proven detection) + GaussianFormer (scene understanding) + Gaussian map (persistent representation) — preserves existing stack while adding capabilities

15. **Estimated Orin deployment**: GaussianFormer end-to-end ~92ms with TensorRT FP16, feasible within 100ms cycle if backbone features are shared with existing detection head

16. **Full integration estimated at $90K over 12-18 months** — phased from research ($5K) through production optimization ($25K), with self-supervised phase ($15K) as the key enabler for airside

17. **Language-embedded Gaussians (LangSplat)** enable natural language scene queries at 199x speedup over NeRF methods — potential for operator interface: "show me the fuel truck near gate 12"

18. **No public airside Gaussian datasets exist** — creating one would be a significant contribution, paralleling nuScenes' impact on urban driving research

---

## References

1. Huang et al., "GaussianFormer: Scene as Gaussians for Vision-Based 3D Semantic Occupancy Prediction," 2024
2. Huang et al., "GaussianFormer-2: Probabilistic Gaussian Superposition for Efficient 3D Occupancy Prediction," 2025
3. Keetha et al., "SplaTAM: Splat, Track & Map 3D Gaussians for Dense RGB-D SLAM," CVPR 2024
4. Matsuki et al., "Gaussian Splatting SLAM," CVPR 2024
5. Hhuang et al., "Photo-SLAM: Real-time Simultaneous Localization and Photorealistic Mapping," 2024
6. Gan et al., "GaussianOcc: Fully Self-Supervised and Efficient 3D Occupancy Estimation with 3D Gaussian Splatting," 2024
7. Kerbl et al., "3D Gaussian Splatting for Real-Time Radiance Field Rendering," SIGGRAPH 2023
8. Chen et al., "Periodic Vibration Gaussian: Dynamic Urban Scene Reconstruction and Real-time Rendering," 2024
9. Wu et al., "4D Gaussian Splatting for Real-Time Dynamic Scene Rendering," CVPR 2024
10. Yan et al., "Street Gaussians for Modeling Dynamic Urban Scenes," ECCV 2024
11. Zhou et al., "Feature 3DGS: Supercharging 3D Gaussian Splatting to Enable Distilled Feature Fields," 2024
12. Shi et al., "Language Embedded 3D Gaussians for Open-Vocabulary Scene Understanding," 2024
13. Qin et al., "LangSplat: 3D Language Gaussian Splatting," CVPR 2024
14. Hess et al., "SplatAD: Real-Time Lidar and Camera Rendering with 3D Gaussian Splatting for Autonomous Driving," CVPR 2025
15. Yu et al., "FlashOcc: Fast and Memory-Efficient Occupancy Prediction via Channel-to-Height Plugin," 2024

---

*Document generated for Aurrigo industry research, April 2026. Focuses on online/real-time Gaussian perception and mapping — for offline simulation/reconstruction, see `technology/simulation/3dgs-digital-twin.md` and `technology/simulation/neural-scene-reconstruction.md`.*
