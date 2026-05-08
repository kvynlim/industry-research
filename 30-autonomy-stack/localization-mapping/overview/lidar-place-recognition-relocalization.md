# LiDAR Place Recognition and Re-Localization for Airside Autonomous Vehicles

LiDAR place recognition determines whether a vehicle has previously visited its current location by matching compact scene descriptors against a database of prior observations. For airport airside operations, this capability is essential across four use cases: loop closure in SLAM (correcting accumulated drift during long autonomous missions), kidnapped robot recovery (re-localizing after GPS dropout or system restart), multi-session map alignment (merging maps built at different times or under different conditions), and cross-vehicle localization (enabling a fleet of 20+ vehicles to share spatial knowledge). The airside environment presents unique challenges that road-driving benchmarks do not capture: repetitive stand geometry where adjacent gates appear nearly identical, extreme dynamic content where aircraft presence changes every 30-60 minutes, and appearance variation from seasonal weather, night operations, and de-icing spray. This document surveys handcrafted descriptors (Scan Context, M2DP, RING), learned methods (PointNetVLAD, MinkLoc3D, LoGG3D-Net, LCDNet), and transformer-based approaches (PPT, TransLoc3D, PTv3-based retrieval), then details the complete re-localization pipeline from descriptor matching through ICP refinement to GTSAM factor graph integration. Deployment on NVIDIA Orin with 4-8 RoboSense LiDARs requires careful attention to descriptor latency (<50ms), database size (millions of entries across airports), and retrieval throughput. The recommended architecture combines Scan Context for real-time coarse matching with MinkLoc3D for learned verification, backed by FAISS for scalable retrieval and GTSAM loop closure factors for global consistency.

---

## Table of Contents

1. [Why Place Recognition Matters for Airside](#1-why-place-recognition-matters-for-airside)
2. [Handcrafted Descriptors](#2-handcrafted-descriptors)
3. [Learned Descriptors](#3-learned-descriptors)
4. [Transformer-Based Methods](#4-transformer-based-methods)
5. [Re-Localization Pipeline](#5-re-localization-pipeline)
6. [Multi-Session Mapping](#6-multi-session-mapping)
7. [Cross-Vehicle Place Recognition](#7-cross-vehicle-place-recognition)
8. [Challenging Airside Conditions](#8-challenging-airside-conditions)
9. [Descriptor Compression and Retrieval](#9-descriptor-compression-and-retrieval)
10. [Integration with GTSAM Factor Graphs](#10-integration-with-gtsam-factor-graphs)
11. [Orin Deployment Considerations](#11-orin-deployment-considerations)
12. [Key Takeaways](#12-key-takeaways)

---

## 1. Why Place Recognition Matters for Airside

### 1.1 The Core Problem

Place recognition answers a deceptively simple question: "Have I been here before?" In the context of LiDAR-based autonomous vehicles, this means comparing the current 3D point cloud observation against a database of prior scans to identify spatial revisits. The answer enables four critical capabilities that underpin reliable airside autonomy.

### 1.2 Loop Closure in SLAM

All LiDAR odometry systems -- KISS-ICP, LIO-SAM, FAST-LIO2, or the reference airside AV stack's GTSAM + GPU VGICP pipeline (see [lidar-slam-algorithms.md](lidar-slam-algorithms.md)) -- accumulate drift over time. For a vehicle traversing a 2 km apron loop at 15 km/h, typical drift of 0.1-0.5% translational error produces 2-10 m of accumulated error by the time the vehicle returns to its starting point. Without loop closure detection, the map tears apart at the seam.

Place recognition identifies the revisit, generating a **loop closure candidate** that the SLAM back-end (GTSAM ISAM2) incorporates as a constraint to correct the entire trajectory simultaneously. For the reference airside AV stack, this means:

- **Mission duration**: Vehicles operating 16-hour shifts accumulate significant drift without periodic loop closure
- **Map quality**: The fleet-shared prior map degrades if individual vehicles cannot close loops
- **Safety margin**: 2-10 m localization error exceeds the 0.5 m accuracy required for safe aircraft proximity operations

### 1.3 Kidnapped Robot Recovery

A "kidnapped robot" scenario occurs when the vehicle's localization state becomes invalid -- the system has no reliable estimate of where it is. On the airside, this happens more frequently than on public roads:

| Cause | Frequency | Duration |
|---|---|---|
| GPS/RTK dropout under terminal building overhang | Multiple times per shift | 10-60 seconds |
| System restart after software update | Weekly | 30-120 seconds |
| LiDAR temporary blindness (de-icing spray, jet blast) | 2-8 hours cumulative/year | 5-30 seconds per event |
| Tow to new location while powered off | Occasional (maintenance) | N/A -- full relocalization needed |
| Multi-LiDAR calibration jump | Rare but safety-critical | Instantaneous |

Place recognition provides the initial pose hypothesis for recovery: match current observation against the map database, retrieve the top-K candidates, verify with geometric registration (ICP/NDT), and reinitialize the localization filter.

### 1.4 Multi-Session Map Alignment

Airport environments change continuously. A map built during the morning shift has different aircraft at gates, different GSE parked on the apron, and potentially different weather conditions than one built during the night shift. Multi-session mapping requires identifying common places across sessions to align them into a single consistent map.

This is distinct from incremental mapping -- it requires recognizing the same physical location despite substantial appearance change. The terminal building, taxiway edges, and permanent infrastructure provide stable anchors, while aircraft, baggage carts, and fuel trucks constitute transient content that confuses naive matching.

### 1.5 Cross-Vehicle Localization

With a fleet of 20+ reference airside vehicles operating simultaneously, each vehicle builds its own local map segment. Cross-vehicle place recognition enables cooperative mapping by identifying when two vehicles observe the same location from different viewpoints. This feeds directly into the fleet SLAM architecture described in [../maps/hd-map-change-detection-maintenance.md](../maps/hd-map-change-detection-maintenance.md):

- Vehicle A's map segment at Stand 42 can be aligned with Vehicle B's observation
- New structural changes (temporary barriers, construction) detected by one vehicle propagate to the fleet
- Redundant observations improve map confidence via Bayesian consensus

The descriptor database becomes a shared fleet resource, with each vehicle contributing new descriptors and querying against the collective memory.

---

## 2. Handcrafted Descriptors

Handcrafted descriptors encode 3D point clouds into compact representations using manually designed features. Their key advantage is **no training data required** -- critical for airside deployment where no public LiDAR datasets exist. They are also deterministic, making them easier to validate for safety certification under ISO 3691-4.

### 2.1 Scan Context

**Paper:** Kim & Kim, "Scan Context: Egocentric Spatial Descriptor for Place Recognition within 3D Point Cloud Map" (IROS 2018)
**Code:** `https://github.com/irapkaist/scancontext` (BSD License, C++)

Scan Context converts a 3D point cloud into a 2D matrix by projecting points into a polar grid centered on the sensor. The grid has `Nr` radial bins and `Ns` azimuthal sectors, and each cell stores the maximum height of points falling within it.

```
Point Cloud → Polar Binning → Max-Height Encoding → 2D Matrix (Nr × Ns)
                                                         ↓
                                              Ring Key (1D, rotation-invariant)
                                              Sector Key (1D, for fast pre-filtering)
```

**Key properties:**

- **Yaw-invariant matching**: Column-shift of the 2D matrix corresponds to yaw rotation. Matching is performed by exhaustively shifting one descriptor against the other and taking the minimum distance. This costs O(Ns) comparisons per pair but makes the descriptor robust to arbitrary heading differences
- **Ring key for fast retrieval**: The row-wise mean of the Scan Context matrix produces a 1D "ring key" that is rotation-invariant by construction. This enables fast pre-filtering: only candidates with similar ring keys proceed to full 2D matching
- **Recall@1 ~90%**: On KITTI and MulRan benchmarks, achieves ~90% recall at rank 1 with appropriate thresholds
- **Latency**: <5 ms for descriptor computation, <10 ms for database search (1000 entries) on CPU

**Limitations for airside:**
- Height-based encoding is sensitive to ground plane variation (wet tarmac reflections, standing water)
- Aircraft fuselage creates dominant height features that can mask subtle structural differences between stands
- No semantic awareness -- cannot distinguish permanent structure from transient objects

#### Scan Context Descriptor Computation

```python
import numpy as np
from typing import Tuple

class ScanContextDescriptor:
    """
    Scan Context descriptor for LiDAR place recognition.
    Encodes a 3D point cloud into a yaw-invariant 2D matrix
    using polar binning and max-height projection.
    """
    
    def __init__(
        self,
        num_rings: int = 20,
        num_sectors: int = 60,
        max_range: float = 80.0,
        min_height: float = -2.0,
        max_height: float = 30.0,   # Accommodate aircraft tail (up to ~20m)
    ):
        self.num_rings = num_rings
        self.num_sectors = num_sectors
        self.max_range = max_range
        self.min_height = min_height
        self.max_height = max_height
        
        # Pre-compute bin edges
        self.ring_edges = np.linspace(0, max_range, num_rings + 1)
        self.sector_edges = np.linspace(-np.pi, np.pi, num_sectors + 1)
    
    def compute(self, points: np.ndarray) -> np.ndarray:
        """
        Compute Scan Context descriptor from point cloud.
        
        Args:
            points: (N, 3) array of [x, y, z] points in sensor frame
            
        Returns:
            (num_rings, num_sectors) max-height matrix
        """
        # Filter by range and height
        xy = points[:, :2]
        ranges = np.linalg.norm(xy, axis=1)
        mask = (
            (ranges > 0.5) &           # Remove self-returns
            (ranges < self.max_range) &
            (points[:, 2] > self.min_height) &
            (points[:, 2] < self.max_height)
        )
        pts = points[mask]
        r = ranges[mask]
        
        # Compute azimuth angles
        theta = np.arctan2(pts[:, 1], pts[:, 0])
        
        # Bin into polar grid
        ring_idx = np.digitize(r, self.ring_edges) - 1
        sector_idx = np.digitize(theta, self.sector_edges) - 1
        
        # Clamp to valid range
        ring_idx = np.clip(ring_idx, 0, self.num_rings - 1)
        sector_idx = np.clip(sector_idx, 0, self.num_sectors - 1)
        
        # Max-height encoding
        sc = np.full((self.num_rings, self.num_sectors), self.min_height)
        for i in range(len(pts)):
            ri, si = ring_idx[i], sector_idx[i]
            sc[ri, si] = max(sc[ri, si], pts[i, 2])
        
        # Normalize to [0, 1]
        sc = (sc - self.min_height) / (self.max_height - self.min_height)
        sc = np.clip(sc, 0.0, 1.0)
        
        return sc
    
    def ring_key(self, sc: np.ndarray) -> np.ndarray:
        """
        Extract rotation-invariant ring key (row-wise mean).
        Used for fast pre-filtering before full SC matching.
        """
        return np.mean(sc, axis=1)
    
    def sector_key(self, sc: np.ndarray) -> np.ndarray:
        """Extract sector key (column-wise mean) for secondary filtering."""
        return np.mean(sc, axis=0)
    
    def distance(self, sc_query: np.ndarray, sc_candidate: np.ndarray) -> float:
        """
        Compute distance between two Scan Contexts with yaw alignment.
        Tests all column shifts and returns minimum cosine distance.
        """
        min_dist = float('inf')
        for shift in range(self.num_sectors):
            shifted = np.roll(sc_candidate, shift, axis=1)
            # Column-wise cosine distance, averaged over columns
            cos_dists = []
            for col in range(self.num_sectors):
                q_col = sc_query[:, col]
                c_col = shifted[:, col]
                norm_q = np.linalg.norm(q_col)
                norm_c = np.linalg.norm(c_col)
                if norm_q > 1e-6 and norm_c > 1e-6:
                    cos_sim = np.dot(q_col, c_col) / (norm_q * norm_c)
                    cos_dists.append(1.0 - cos_sim)
                else:
                    cos_dists.append(1.0)
            dist = np.mean(cos_dists)
            min_dist = min(min_dist, dist)
        
        return min_dist
```

### 2.2 Scan Context++

**Paper:** Kim et al., "Scan Context++: Structural Place Recognition Robust to Rotation and Lateral Variations" (IEEE T-RO 2022)

Scan Context++ extends the original with two improvements relevant to airside:

1. **Augmented descriptor**: Adds a second channel encoding the maximum range (not just height) per bin, improving discrimination in flat environments like airport aprons where height variation is limited
2. **Lateral-invariant matching**: Introduces polar context alignment that handles both rotation and lateral displacement, important when vehicles approach the same stand from different lanes

Performance on MulRan (urban, diverse conditions): **94.2% recall@1**, a meaningful improvement over the original 90%.

### 2.3 M2DP (Multi-view 2D Projection)

**Paper:** He et al., "M2DP: A Novel 3D Point Cloud Descriptor and Its Application in Loop Closure Detection" (IROS 2016)

M2DP projects the 3D point cloud onto multiple 2D planes from different viewpoints, computes a signature for each projection, and concatenates them into a single descriptor vector. The descriptor is generated via SVD decomposition, producing a compact 192-dimensional vector.

**Key properties:**

- **Viewpoint invariance**: By projecting from many angles, the descriptor captures the 3D structure more completely than single-projection methods
- **Compact**: 192 floats = 768 bytes per descriptor
- **Fast**: <3 ms computation on CPU
- **Moderate recall**: ~85% recall@1 on KITTI, lower than Scan Context in structured environments

**Airside relevance:** The multi-view projection captures aircraft geometry well (fuselage, wings, tail from different angles) but struggles when the scene is dominated by flat ground with sparse features -- a common situation on empty apron areas between stands.

### 2.4 RING and RING++ (Rotation-Invariant)

**Paper:** Lu et al., "One RING to Rule Them All: Radon Sinogram for Place Recognition, Orientation and Translation Estimation" (IROS 2022) / RING++ (IEEE T-RO 2023)

RING converts the Bird's Eye View (BEV) representation to the Radon domain (sinogram), where rotation becomes a cyclic shift in the angle dimension. This achieves true rotation invariance without exhaustive shift search.

**Key properties:**

- **O(1) rotation invariance**: Unlike Scan Context's O(Ns) shift search, RING achieves rotation invariance through the Radon transform's mathematical properties
- **Translation estimation**: RING++ additionally recovers the relative translation between matched scans, providing a better initial guess for ICP refinement
- **92.8% recall@1** on MulRan with faster matching than Scan Context

**Airside relevance:** The BEV representation naturally captures apron layout (taxiway edges, stand markings, vehicle positions) and is less affected by aircraft height variation than height-based descriptors.

### 2.5 Handcrafted Descriptor Comparison

| Method | Descriptor Size | Compute Time | Recall@1 (KITTI) | Recall@1 (MulRan) | Rotation Invariant | Translation Est. |
|---|---|---|---|---|---|---|
| Scan Context | 20x60 matrix | <5 ms | ~90% | ~88% | Yes (shift search) | No |
| Scan Context++ | 20x60x2 | <8 ms | ~93% | ~94% | Yes (shift search) | No |
| M2DP | 192-dim vector | <3 ms | ~85% | ~82% | Yes (by construction) | No |
| RING | Sinogram | <10 ms | ~91% | ~92% | Yes (Radon domain) | No |
| RING++ | Sinogram | <15 ms | ~93% | ~93% | Yes (Radon domain) | Yes |

All timings measured on a single CPU core. On Orin ARM cores, expect 1.5-2x slowdown for these operations.

---

## 3. Learned Descriptors

Learned descriptors use neural networks to map point clouds to embedding spaces where similar scenes have small distances and dissimilar scenes have large distances. They typically achieve higher recall than handcrafted methods but require training data and GPU inference.

### 3.1 PointNetVLAD (Pioneering Work)

**Paper:** Uy & Lee, "PointNetVLAD: Deep Point Cloud Based Retrieval for Large-Scale Place Recognition" (CVPR 2018)
**Code:** `https://github.com/mikacuy/pointnetvlad` (MIT License, PyTorch)

PointNetVLAD combines PointNet for local feature extraction with NetVLAD aggregation (borrowed from image retrieval) to produce a single global descriptor from an unordered point cloud.

```
Raw Points (N×3) → PointNet → Local Features (N×D) → NetVLAD → Global Descriptor (256-dim)
```

**Architecture details:**

1. **PointNet backbone**: Processes raw xyz coordinates through shared MLPs with max-pooling, producing per-point features
2. **NetVLAD layer**: Learns K cluster centers and computes residuals of local features against each cluster, producing a K×D matrix flattened to a single vector
3. **Lazy triplet loss**: Trains with (anchor, positive, negative) tuples where positives are within 10 m and negatives are beyond 20 m

**Performance:**

- **80.3% recall@1** on the Oxford RobotCar benchmark (original paper)
- 256-dimensional descriptor (1 KB per place)
- ~20 ms inference on GPU

**Limitations:** PointNet's global max-pooling loses fine-grained local structure, limiting discrimination in environments with subtle differences -- exactly the challenge at airports where adjacent stands share nearly identical geometry.

### 3.2 MinkLoc3D (Sparse Convolution)

**Paper:** Komorowski, "MinkLoc3D: Point Cloud Based Large-Scale Place Recognition" (WACV 2021)
**Code:** `https://github.com/jac99/MinkLoc3D` (MIT License, PyTorch + MinkowskiEngine)

MinkLoc3D uses sparse 3D convolutions (via MinkowskiEngine) to process voxelized point clouds, followed by Generalized Mean Pooling (GeM) to produce a compact global descriptor. This architecture captures local geometric structure far better than PointNet's global aggregation.

**Architecture:**

```
Point Cloud → Voxelize (0.01m) → Sparse 3D Convolution (Feature Pyramid) → GeM Pooling → 256-dim Descriptor
```

**Key innovations:**

1. **Sparse convolution backbone**: Processes only occupied voxels, making computation proportional to scene content rather than volume. Essential for airside where most of the 80 m radius is empty apron
2. **Feature Pyramid Network**: Multi-scale features capture both fine details (cones, barriers) and coarse structure (buildings, aircraft)
3. **GeM pooling**: Learnable generalization of average and max pooling that adapts to the descriptor space

**Performance:**

- **97.5% recall@1** on Oxford RobotCar -- a massive leap over PointNetVLAD
- **94.4% recall@1** on In-house (indoor/outdoor mixed)
- 256-dimensional descriptor
- ~15 ms inference on GPU (RTX 3090)

**Airside relevance:** The sparse convolution backbone naturally handles the varying point density of multi-LiDAR systems (dense near-field from RSHELIOS, sparse far-field from RSBP). The Feature Pyramid captures both the fine geometry of stand equipment and the coarse layout of terminal buildings.

### 3.3 LoGG3D-Net (Local + Global)

**Paper:** Vidanapathirana et al., "LoGG3D-Net: Locally Guided Global Descriptor Learning for 3D Place Recognition" (ICRA 2022)
**Code:** `https://github.com/csiro-robotics/LoGG3D-Net` (BSD License, PyTorch + MinkowskiEngine)

LoGG3D-Net jointly learns local and global descriptors, using local consistency to guide global descriptor learning. This addresses a key weakness of purely global methods: two scenes might have similar global statistics but differ in critical local details.

**Key innovation:** A **local consistency loss** that encourages nearby points in the embedding space to have consistent local features, improving discrimination in structurally repetitive environments.

**Performance:**

- **96.0% recall@1** on KITTI (sequence 00)
- Local descriptors enable **geometric verification** of retrieval candidates, reducing false positives
- 256-dimensional global + per-point local descriptors

**Airside relevance:** The local descriptors are valuable for distinguishing adjacent stands -- the global descriptor might match multiple stands, but local features around unique markers (stand numbers, specific equipment) break the tie.

### 3.4 LCDNet (Loop Closure Detection)

**Paper:** Cattaneo et al., "LCDNet: Deep Loop Closure Detection and Point Cloud Registration for LiDAR SLAM" (IEEE T-RO 2022)
**Code:** `https://github.com/robot-learning-freiburg/LCDNet` (MIT License, PyTorch)

LCDNet combines place recognition with relative pose estimation in a single network, producing both a global descriptor for retrieval and a 6-DoF relative transform for registration. This eliminates the separate ICP step for coarse alignment.

**Architecture:**

```
Point Cloud Pair → Shared Backbone → Global Descriptors (retrieval)
                                   → Relative Pose Head (registration)
```

**Performance:**

- **95.8% recall@1** on KITTI
- Relative pose accuracy: <0.5 m translation, <2 degrees rotation error
- Combined retrieval + registration in ~30 ms

**Airside relevance:** The integrated pose estimation is particularly valuable for kidnapped robot recovery, where speed matters. Rather than retrieve-then-ICP (two serial steps), LCDNet provides a usable pose estimate directly from the recognition result.

### 3.5 Learned Descriptor Comparison

| Method | Backbone | Descriptor Dim | Recall@1 Oxford | Recall@1 KITTI | Latency (GPU) | Relative Pose |
|---|---|---|---|---|---|---|
| PointNetVLAD | PointNet | 256 | 80.3% | 78.2% | ~20 ms | No |
| PCAN | PointNet + Attention | 256 | 83.8% | 82.0% | ~25 ms | No |
| MinkLoc3D | Sparse Conv | 256 | 97.5% | 97.0% | ~15 ms | No |
| MinkLoc3Dv2 | Sparse Conv + Transformer | 256 | 98.2% | 97.8% | ~20 ms | No |
| LoGG3D-Net | Sparse Conv | 256 | 95.1% | 96.0% | ~18 ms | No |
| LCDNet | Sparse Conv + Heads | 256 | 95.8% | 95.8% | ~30 ms | Yes |
| EgoNN | Sparse Conv | 256 | 97.2% | 96.5% | ~22 ms | Yes |

---

## 4. Transformer-Based Methods

Transformer architectures have recently achieved state-of-the-art results in 3D place recognition by capturing long-range dependencies that convolution-based methods miss. These are particularly relevant for airside environments where contextual relationships (e.g., "this stand is next to the terminal with this specific roof shape") matter for disambiguation.

### 4.1 PPT (Point Prompt Tuning)

**Paper:** Wu et al., "PPT: Pre-trained Point Cloud Transformer for Place Recognition" (CVPR 2024)

PPT adapts pre-trained 3D point cloud transformers (specifically Point-MAE) for place recognition using prompt tuning -- inserting learnable prompt tokens that steer the frozen backbone toward retrieval-relevant features without full fine-tuning.

**Key innovations:**

1. **Foundation model transfer**: Leverages the rich 3D representations learned by Point-MAE during self-supervised pre-training, similar to how LoRA adapts language models
2. **Point prompt tokens**: Small set of learnable tokens (32-64) prepended to the input sequence, requiring only ~0.5% of the backbone parameters to be trained
3. **Efficient adaptation**: Can be fine-tuned with as few as 100 place-recognition training pairs -- critical when no airside training data exists

**Performance:**

- **98.6% recall@1** on Oxford RobotCar -- current SOTA among published methods
- Outperforms MinkLoc3Dv2 by +0.4% with 10x fewer trainable parameters
- ~25 ms inference on A100

**Airside relevance:** PPT's few-shot adaptation capability is directly applicable to airport deployment. Pre-train on road driving data (abundant), then prompt-tune with a small set of airside scenes (100-500 pairs) collected during initial mapping. The frozen backbone ensures that road-driving 3D understanding transfers while prompts capture airside-specific features.

### 4.2 TransLoc3D

**Paper:** Xu et al., "TransLoc3D: Point Cloud Based Large-Scale Place Recognition using Adaptive Receptive Fields" (arXiv 2021)

TransLoc3D introduces an **Adaptive Receptive Field Module** that dynamically adjusts the spatial extent of attention based on scene content. Sparse regions (open apron) get larger receptive fields while dense regions (near equipment) get focused attention.

**Architecture:**

```
Point Cloud → Point Embedding → Adaptive Receptive Field Module → External Transformer → NetVLAD → Descriptor
```

**Performance:**

- **97.8% recall@1** on Oxford RobotCar
- Adaptive receptive fields improve performance in environments with mixed density -- directly applicable to airside where density varies from cluttered stand areas to empty taxiways

### 4.3 PTv3-Based Retrieval

PointTransformerV3 (PTv3), detailed in the [sparse attention document](../../../10-knowledge-base/machine-learning/sparse-attention-3d-perception.md), achieves SOTA performance in 3D understanding tasks. While not originally designed for place recognition, its serialized attention mechanism and strong feature extraction make it an excellent backbone for retrieval:

**Approach:**

1. Use PTv3 pre-trained on semantic segmentation as a feature extractor
2. Add a GeM pooling head to aggregate per-point features into a global descriptor
3. Fine-tune the pooling head + last transformer block with triplet loss

**Expected performance (based on PTv3's feature quality):**

- Recall@1 comparable to or exceeding MinkLoc3Dv2 (~98%+)
- 3x faster and 10x less memory than PTv2-based retrieval
- Serialized attention naturally handles the 120K+ points from multi-LiDAR configurations

**Practical note:** PTv3 requires PyTorch 2.0+ and flash-attn. On Orin, window size should be reduced from 1024 to 256-512 for real-time operation (see [sparse-attention-3d-perception.md](../../../10-knowledge-base/machine-learning/sparse-attention-3d-perception.md) for tuning guidance).

### 4.4 BEVPlace and BEVPlace++

**Paper:** Luo et al., "BEVPlace: Learning LiDAR-based Place Recognition using Bird's Eye View Images" (ICCV 2023) / BEVPlace++ (IEEE T-RO 2024)

BEVPlace converts 3D point clouds to BEV images and applies 2D CNN + NetVLAD for place recognition, achieving competitive results with drastically simpler architecture.

**Key insight:** For ground vehicles operating on mostly flat surfaces (airport aprons), the BEV projection preserves the most discriminative information while enabling use of well-optimized 2D image retrieval pipelines.

**Performance:**

- **96.5% recall@1** on Oxford, **97.3%** on KITTI
- BEVPlace++: **97.9% recall@1** on Oxford with multi-scale BEV
- ~8 ms inference (BEV projection + 2D CNN on GPU)

**Airside relevance:** The BEV representation directly aligns with airport map formats (AMDB is inherently 2D). BEVPlace descriptors could potentially be matched against BEV renderings of the AMDB map for coarse localization without a prior LiDAR database.

### 4.5 Transformer Method Comparison

| Method | Year | Architecture | Recall@1 (Oxford) | Params (trainable) | Latency | Key Innovation |
|---|---|---|---|---|---|---|
| PPT | CVPR 2024 | Point-MAE + Prompts | 98.6% | ~500K (0.5%) | ~25 ms | Few-shot prompt tuning |
| TransLoc3D | 2021 | Adaptive Transformer | 97.8% | ~8M | ~20 ms | Adaptive receptive field |
| PTv3 + GeM | 2024 | Serialized Attention | ~98%+ (est.) | ~5M (head only) | ~15 ms | Serialized attention |
| BEVPlace++ | T-RO 2024 | BEV + 2D Transformer | 97.9% | ~12M | ~8 ms | BEV projection |
| OverlapTransformer | RAL 2022 | Range Image + Trans. | 93.6% | ~4M | ~10 ms | Range image encoding |

---

## 5. Re-Localization Pipeline

Place recognition alone is insufficient -- it provides a coarse location hypothesis that must be refined to centimeter-level accuracy for safe navigation. The complete re-localization pipeline chains descriptor matching, geometric verification, metric refinement, and state estimation update.

### 5.1 Pipeline Architecture

```
Current LiDAR Scan
    │
    ├── 1. Descriptor Extraction (Scan Context + MinkLoc3D)
    │       - SC: <5 ms CPU, for fast pre-filtering
    │       - MinkLoc3D: ~15 ms GPU, for learned verification
    │
    ├── 2. Database Retrieval (FAISS)
    │       - Ring-key pre-filter: O(N) linear scan, eliminates 90%+
    │       - FAISS IVF-PQ search on remaining: <1 ms for 100K entries
    │       - Top-K candidates (K=5-10)
    │
    ├── 3. Geometric Verification
    │       - ICP/NDT alignment between query scan and each candidate's stored scan
    │       - Fitness score (overlap ratio) > 0.7 required
    │       - Registration RMSE < 0.3 m required
    │       - Typically 2-3 of K candidates pass
    │
    ├── 4. Candidate Selection
    │       - Best fitness score among verified candidates
    │       - Consistency check: does the candidate agree with odometry?
    │       - Reject if disagreement > 5 m (likely false positive)
    │
    └── 5. GTSAM Integration
            - Add loop closure factor between current pose and matched pose
            - Noise model from ICP covariance (typically Hessian-based)
            - ISAM2 incremental update propagates correction
```

### 5.2 Two-Stage Descriptor Strategy

The recommended approach for airside combines speed and accuracy:

**Stage 1 -- Scan Context (CPU, always-on):**
- Computed for every keyframe (every 2 m or 5 seconds)
- Ring-key compared against database for fast pre-filtering
- Identifies potential loop closure zones (top-50 candidates by ring-key similarity)

**Stage 2 -- MinkLoc3D (GPU, triggered):**
- Only invoked when Stage 1 produces candidates above a similarity threshold
- Provides high-confidence verification with 97%+ recall
- Runs on shared GPU alongside perception (uses ~200 MB VRAM)

This two-stage approach reduces GPU load by 80-90% compared to running the learned descriptor on every frame while maintaining near-identical recall.

### 5.3 ICP Refinement

Once a place recognition match identifies a coarse correspondence, Iterative Closest Point (ICP) or Normal Distributions Transform (NDT) refines the alignment to centimeter accuracy. The reference airside AV stack's existing GPU VGICP (see [gtsam-factor-graphs.md](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md)) is ideal for this step.

**Refinement workflow:**

1. **Initial guess**: From place recognition descriptor match (typically 1-5 m, 5-15 degree accuracy)
2. **Coarse alignment**: VGICP with 1.0 m voxel size, 20 iterations, convergence threshold 0.1 m
3. **Fine alignment**: VGICP with 0.3 m voxel size, 30 iterations, convergence threshold 0.01 m
4. **Covariance extraction**: Hessian of the ICP objective at convergence provides the information matrix for GTSAM

**Critical parameters for airside:**

| Parameter | Road Driving | Airside | Rationale |
|---|---|---|---|
| Max correspondence distance | 2.0 m | 3.0 m | Aircraft create larger gaps in point clouds |
| Minimum overlap ratio | 0.5 | 0.3 | Dynamic objects (aircraft) reduce overlap |
| RANSAC outlier threshold | 0.5 m | 1.0 m | GSE movements between observations |
| Voxel size (coarse) | 0.5 m | 1.0 m | Larger open areas need coarser initial grid |
| Convergence threshold | 0.01 m | 0.01 m | Same accuracy requirement |

### 5.4 Failure Detection

False loop closures are catastrophic -- they warp the entire map. The pipeline must detect and reject false matches:

1. **Descriptor distance threshold**: Only accept matches below a conservative threshold (e.g., SC distance < 0.15 rather than the common 0.2)
2. **ICP fitness check**: Minimum 30% point overlap after alignment
3. **Odometry consistency**: The loop closure transform must be consistent with accumulated odometry within a generous bound (5-10 m)
4. **Temporal separation**: Require minimum 30 seconds between query and match to avoid trivially correct self-matches
5. **Switchable constraints**: Use GTSAM's switchable constraints or max-mixture factors that allow the optimizer to disable incorrect loop closures automatically

---

## 6. Multi-Session Mapping

### 6.1 The Multi-Session Problem

Airport airside environments undergo continuous structural change. A map built at 06:00 may be substantially different from one built at 14:00:

| Change Type | Frequency | Impact on Recognition |
|---|---|---|
| Aircraft presence at gates | Every 30-60 min per stand | Major: dominant features appear/disappear |
| GSE layout (tugs, carts, loaders) | Continuous | Moderate: scattered features shift |
| Temporary barriers/cones | Daily | Minor: small features at ground level |
| Weather (wet tarmac, snow) | Seasonal | Moderate: reflectivity changes |
| Construction | Weeks-months | Major: permanent structure changes |
| Lighting (day vs night) | Daily | Minor for LiDAR (direct effect on reflectivity only) |

Multi-session mapping must align maps built under different conditions into a single consistent representation.

### 6.2 Static Feature Extraction

The key to robust multi-session alignment is identifying **static features** that persist across sessions:

**Highly stable (years):**
- Terminal buildings, hangars, control tower
- Taxiway edges, runway boundaries
- Light poles, navigation aids
- Permanent fencing and gates

**Moderately stable (days-weeks):**
- Jetways (retracted position varies slightly)
- Parked ground equipment in designated areas
- Temporary construction barriers

**Transient (minutes-hours):**
- Aircraft at gates
- Moving GSE
- Personnel
- Baggage carts, containers

The practical approach is to filter transient objects before descriptor computation:

```python
def extract_static_points(
    points: np.ndarray,
    occupancy_history: dict,
    min_occupancy_rate: float = 0.7,
    voxel_size: float = 0.5,
) -> np.ndarray:
    """
    Filter point cloud to retain only points in voxels that have been
    consistently occupied across multiple mapping sessions.
    
    Args:
        points: (N, 3) current point cloud
        occupancy_history: dict mapping voxel_id -> (times_seen, total_sessions)
        min_occupancy_rate: minimum fraction of sessions where voxel was occupied
        voxel_size: voxel grid resolution in meters
        
    Returns:
        Filtered point cloud containing only static structure
    """
    # Voxelize current points
    voxel_ids = np.floor(points[:, :3] / voxel_size).astype(np.int32)
    voxel_keys = [tuple(v) for v in voxel_ids]
    
    # Filter: keep only points whose voxel has been consistently observed
    mask = np.zeros(len(points), dtype=bool)
    for i, key in enumerate(voxel_keys):
        if key in occupancy_history:
            seen, total = occupancy_history[key]
            if total > 3 and (seen / total) >= min_occupancy_rate:
                mask[i] = True
    
    return points[mask]
```

### 6.3 Anchor-Based Session Alignment

Rather than attempting to align entire maps (which is brittle when >50% of content has changed), use a small set of **anchor points** at stable landmarks:

1. **Identify anchor candidates**: Points consistently visible across 90%+ of sessions (terminal corners, light poles, permanent signs)
2. **Build anchor descriptors**: Extract local descriptors (e.g., FPFH or learned local features from LoGG3D-Net) around each anchor
3. **Cross-session matching**: Match anchor descriptors between sessions using nearest-neighbor search
4. **Rigid alignment**: Estimate the session-to-session transform from matched anchors using RANSAC + SVD
5. **Deformable refinement**: If rigid alignment residual is high (>0.2 m), apply elastic deformation correction for large maps where survey-grade alignment is needed

### 6.4 Temporal Descriptor Aggregation

Rather than storing a single descriptor per location, maintain a **temporal distribution** that captures the range of appearances:

- Store descriptors from N most recent sessions (e.g., N=10)
- Match query against all stored descriptors, take minimum distance
- Periodically compute a mean descriptor weighted by recency
- This naturally adapts to gradual structural changes (construction, new infrastructure)

---

## 7. Cross-Vehicle Place Recognition

### 7.1 Fleet-Scale Shared Descriptor Database

With 20+ reference airside vehicles operating simultaneously, place recognition becomes a fleet resource. Each vehicle contributes descriptors to a shared database and queries against the collective memory.

**Architecture:**

```
Vehicle A                          Fleet Database (Edge Server)              Vehicle B
─────────                          ────────────────────────────              ─────────
Compute SC + MinkLoc3D             FAISS index (IVF-PQ)                     Compute SC + MinkLoc3D
descriptor for keyframe    ──────► Add to per-vehicle partition  ◄────────  descriptor for keyframe
                                          │
Query against all partitions ◄────────────┤──────────────────────► Query against all partitions
                                          │
Receive top-K candidates   ◄──────────────┘──────────────────────► Receive top-K candidates
+ stored scans for ICP                                              + stored scans for ICP
```

**Communication protocol:**
- **Descriptor upload**: 256 floats (1 KB) per keyframe, one keyframe every 2 m = ~500 KB/min at 15 km/h
- **Query**: 1 KB descriptor + receive top-K results (~5 KB response) = negligible bandwidth
- **Scan retrieval for ICP**: Only when a match is found, retrieve the stored scan (~500 KB compressed)
- **Total bandwidth per vehicle**: <2 MB/min steady state, <5 MB/min during active loop closure

This is well within the airport 5G/CBRS infrastructure bandwidth (see [../../20-av-platform/networking-connectivity/airport-5g-cbrs.md](../../../20-av-platform/networking-connectivity/airport-5g-cbrs.md)).

### 7.2 Cross-Vehicle Viewpoint Challenge

Different vehicles observe the same location from different positions and orientations. A tug approaching Stand 42 from the south sees a fundamentally different point cloud than a baggage cart approaching from the north, even though they occupy the same place.

**Mitigation strategies:**

1. **Rotation-invariant descriptors**: Scan Context's shift-matching and RING's Radon transform handle yaw differences. Handcrafted methods are naturally better here than learned methods trained on forward-facing views
2. **BEV-based descriptors**: BEVPlace projects out the viewpoint dependency, encoding only the spatial layout
3. **Multi-descriptor matching**: Store descriptors from multiple viewpoints per location (N, S, E, W approaches)
4. **Canonicalization**: Transform all point clouds to a canonical orientation (e.g., aligned with the nearest taxiway centerline) before descriptor computation

### 7.3 Descriptor Database Management

```python
import numpy as np
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from collections import defaultdict
import time

@dataclass
class PlaceDescriptor:
    """Single place observation from one vehicle at one time."""
    vehicle_id: str
    timestamp: float
    pose_x: float
    pose_y: float
    pose_z: float
    pose_yaw: float
    scan_context: np.ndarray          # (20, 60) SC matrix
    learned_descriptor: np.ndarray    # (256,) MinkLoc3D embedding
    ring_key: np.ndarray              # (20,) rotation-invariant key
    scan_compressed: Optional[bytes] = None   # LZ4-compressed scan for ICP
    session_id: str = ""
    is_static_filtered: bool = False  # Whether transient objects were removed


class PlaceDatabase:
    """
    Fleet-scale place recognition database.
    Manages descriptors from multiple vehicles, supports efficient
    retrieval, and handles temporal updates.
    """
    
    def __init__(
        self,
        ring_key_threshold: float = 0.3,
        learned_threshold: float = 0.5,
        max_entries: int = 1_000_000,
        prune_age_seconds: float = 7 * 24 * 3600,  # 1 week default
    ):
        self.ring_key_threshold = ring_key_threshold
        self.learned_threshold = learned_threshold
        self.max_entries = max_entries
        self.prune_age_seconds = prune_age_seconds
        
        self.entries: List[PlaceDescriptor] = []
        self.ring_keys: Optional[np.ndarray] = None   # (N, 20) stacked
        self.learned_descs: Optional[np.ndarray] = None  # (N, 256) stacked
        self._faiss_index = None  # Lazily built
        self._dirty = True
        
        # Spatial index for fast geographic filtering
        self.grid_index: Dict[Tuple[int, int], List[int]] = defaultdict(list)
        self.grid_resolution = 10.0  # meters
    
    def add(self, descriptor: PlaceDescriptor) -> int:
        """Add a new place descriptor to the database. Returns entry index."""
        idx = len(self.entries)
        self.entries.append(descriptor)
        
        # Update spatial index
        gx = int(descriptor.pose_x // self.grid_resolution)
        gy = int(descriptor.pose_y // self.grid_resolution)
        self.grid_index[(gx, gy)].append(idx)
        
        self._dirty = True
        
        # Prune if over capacity
        if len(self.entries) > self.max_entries:
            self._prune_oldest()
        
        return idx
    
    def query_ring_key(
        self,
        ring_key: np.ndarray,
        top_k: int = 50,
    ) -> List[Tuple[int, float]]:
        """
        Fast pre-filtering using rotation-invariant ring keys.
        Returns list of (index, distance) pairs sorted by distance.
        """
        if self.ring_keys is None or self._dirty:
            self._rebuild_arrays()
        
        # L2 distance between ring keys
        dists = np.linalg.norm(self.ring_keys - ring_key[np.newaxis, :], axis=1)
        
        # Get top-K closest
        if len(dists) <= top_k:
            indices = np.argsort(dists)
        else:
            indices = np.argpartition(dists, top_k)[:top_k]
            indices = indices[np.argsort(dists[indices])]
        
        return [(int(i), float(dists[i])) for i in indices
                if dists[i] < self.ring_key_threshold]
    
    def query_learned(
        self,
        descriptor: np.ndarray,
        candidate_indices: Optional[List[int]] = None,
        top_k: int = 10,
    ) -> List[Tuple[int, float]]:
        """
        Query using learned descriptor (MinkLoc3D embedding).
        If candidate_indices provided, only search within those.
        """
        if self.learned_descs is None or self._dirty:
            self._rebuild_arrays()
        
        if candidate_indices is not None:
            # Search within pre-filtered candidates
            subset = self.learned_descs[candidate_indices]
            dists = np.linalg.norm(subset - descriptor[np.newaxis, :], axis=1)
            sorted_local = np.argsort(dists)[:top_k]
            return [(candidate_indices[i], float(dists[i]))
                    for i in sorted_local
                    if dists[i] < self.learned_threshold]
        else:
            # Full database search (use FAISS if available)
            dists = np.linalg.norm(
                self.learned_descs - descriptor[np.newaxis, :], axis=1
            )
            indices = np.argpartition(dists, min(top_k, len(dists) - 1))[:top_k]
            indices = indices[np.argsort(dists[indices])]
            return [(int(i), float(dists[i])) for i in indices
                    if dists[i] < self.learned_threshold]
    
    def query_two_stage(
        self,
        ring_key: np.ndarray,
        learned_desc: np.ndarray,
        min_time_gap: float = 30.0,
        current_time: Optional[float] = None,
        top_k: int = 5,
    ) -> List[Tuple[int, float]]:
        """
        Two-stage retrieval: ring-key pre-filter → learned verification.
        Excludes recent entries (within min_time_gap) to avoid self-matches.
        """
        if current_time is None:
            current_time = time.time()
        
        # Stage 1: Ring-key pre-filter (CPU, fast)
        rk_candidates = self.query_ring_key(ring_key, top_k=50)
        
        # Filter by temporal separation
        valid_indices = [
            idx for idx, dist in rk_candidates
            if (current_time - self.entries[idx].timestamp) > min_time_gap
        ]
        
        if not valid_indices:
            return []
        
        # Stage 2: Learned descriptor verification (GPU-quality, on subset)
        return self.query_learned(learned_desc, valid_indices, top_k=top_k)
    
    def get_scan(self, index: int) -> Optional[bytes]:
        """Retrieve compressed scan for ICP verification."""
        if 0 <= index < len(self.entries):
            return self.entries[index].scan_compressed
        return None
    
    def _rebuild_arrays(self):
        """Rebuild stacked arrays for efficient vectorized search."""
        if self.entries:
            self.ring_keys = np.stack([e.ring_key for e in self.entries])
            self.learned_descs = np.stack([e.learned_descriptor for e in self.entries])
        else:
            self.ring_keys = np.zeros((0, 20))
            self.learned_descs = np.zeros((0, 256))
        self._dirty = False
    
    def _prune_oldest(self):
        """Remove entries older than prune_age_seconds."""
        cutoff = time.time() - self.prune_age_seconds
        self.entries = [e for e in self.entries if e.timestamp > cutoff]
        self.grid_index.clear()
        for i, e in enumerate(self.entries):
            gx = int(e.pose_x // self.grid_resolution)
            gy = int(e.pose_y // self.grid_resolution)
            self.grid_index[(gx, gy)].append(i)
        self._dirty = True
    
    def stats(self) -> dict:
        """Return database statistics."""
        vehicles = set(e.vehicle_id for e in self.entries)
        sessions = set(e.session_id for e in self.entries)
        return {
            "total_entries": len(self.entries),
            "num_vehicles": len(vehicles),
            "num_sessions": len(sessions),
            "memory_descriptors_mb": (
                len(self.entries) * (20 * 60 * 4 + 256 * 4 + 20 * 4) / 1e6
            ),
            "grid_cells_populated": len(self.grid_index),
        }
```

### 7.4 Cooperative Mapping via Place Recognition

Cross-vehicle place recognition directly enables cooperative mapping for the fleet:

1. **Detect inter-vehicle loop closure**: Vehicle A's descriptor matches Vehicle B's database entry
2. **Retrieve and align scans**: Fetch Vehicle B's stored scan, run ICP to get relative transform
3. **Add inter-vehicle factor to fleet GTSAM graph**: This constrains the two vehicles' trajectories relative to each other
4. **Propagate map updates**: The aligned maps are merged, and discrepancies flag potential structural changes

This extends the fleet-based map maintenance described in [../maps/hd-map-change-detection-maintenance.md](../maps/hd-map-change-detection-maintenance.md) with real-time inter-vehicle alignment rather than post-hoc batch processing.

---

## 8. Challenging Airside Conditions

### 8.1 Repetitive Structure (The Identical Stands Problem)

Airport stands are designed to identical specifications -- same dimensions, same jetway type, same ground markings, same lighting. This creates a **perceptual aliasing** problem where multiple physically distinct locations produce nearly identical descriptors.

**Scale of the problem:**
- A typical terminal has 10-30 stands at regular intervals
- Stand spacing is typically 50-80 m (well within descriptor confusion range)
- The surrounding structure (terminal facade, taxiway edge) is continuous and featureless

**Solutions ranked by effectiveness:**

| Approach | Perceptual Aliasing Reduction | Computational Cost | Implementation Complexity |
|---|---|---|---|
| Odometry-constrained search | 80-90% | Negligible | Low |
| Geometric verification (ICP) | 95%+ | ~50 ms per candidate | Medium |
| Sequence matching (SeqSLAM-style) | 95%+ | ~20 ms per candidate | Medium |
| Semantic-aware descriptors | 70-80% | +5-10 ms | High |
| Stand-ID sign reading (camera) | 99%+ | ~30 ms | High (requires camera) |

**Recommended approach:** Odometry-constrained search (only consider candidates within a geographic radius consistent with dead-reckoning uncertainty) combined with geometric verification. This eliminates 95%+ of false matches with no additional sensor requirements.

### 8.2 Dynamic Object Dominance

Aircraft at gates are the largest features in the scene (30-65 m wingspan, 10-20 m height). When present, they dominate the descriptor; when absent, the descriptor changes radically. This means the same physical location can have two very different descriptor representations.

**Quantitative impact:**
- Aircraft presence can change 40-60% of occupied voxels in the scan
- Descriptor distance between same-location scans with/without aircraft: 0.3-0.5 (often above the matching threshold of 0.2)
- False negative rate increases by 25-40% at active gates vs empty stands

**Mitigation strategies:**

1. **Height filtering**: Remove points above 4 m before descriptor computation. This eliminates aircraft fuselage/tail while preserving ground-level infrastructure. Cost: ~10% loss of discriminative power from tall permanent structures (light poles, terminal)
2. **Ground-plane descriptor**: Compute descriptors using only points within 0.5-3.0 m height band -- captures vehicles, equipment, barriers while excluding aircraft
3. **Dual-descriptor approach**: Maintain both full-height and ground-only descriptors; match using the descriptor that better fits the current scene
4. **Dynamic object removal**: Use the existing detection pipeline (PointPillars) to identify and remove known dynamic classes before descriptor computation

### 8.3 Seasonal and Weather Appearance Changes

While LiDAR is less affected by appearance changes than cameras, airport-specific conditions do impact point cloud structure:

| Condition | LiDAR Impact | Descriptor Impact | Mitigation |
|---|---|---|---|
| Rain (wet tarmac) | Strong ground reflections, false returns below ground plane | 5-15% descriptor change | Height filter at -0.3 m |
| Snow accumulation | Ground plane shifts upward, curbs/markings buried | 20-40% descriptor change | Season-specific databases |
| De-icing spray | Temporary beam absorption, reduced range | Point density reduction, 10-20% | Density-normalized descriptors |
| Fog | Range reduction (>50 m range loss) | Near-field bias in descriptor | Range-adaptive binning |
| Jet blast heat shimmer | Refraction of beams, phantom returns | Localized 5-10% noise | Jet blast zone masking |

**Season-aware database management:**
- Maintain separate descriptor databases per season (4 seasons) or per weather condition
- During query, match against the current-condition database first, then fall back to all-conditions database
- Update databases continuously as new sessions are mapped under different conditions

### 8.4 Night vs Day

LiDAR is fundamentally less affected by lighting changes than cameras, but operational differences between night and day shifts create indirect challenges:

- **Different GSE distribution**: Night shifts typically have fewer active vehicles, changing the ground-level feature density
- **Reflective intensity changes**: LiDAR intensity measurements change with temperature-dependent surface properties
- **Operational zones shift**: Some stands may be closed at night, parked GSE accumulates in different areas

For descriptors based purely on geometry (Scan Context, MinkLoc3D without intensity), the day/night impact is minimal (<5% recall change). Intensity-augmented descriptors show 5-15% degradation.

### 8.5 Airside Challenge Summary and Solutions

| Challenge | Severity | Best Mitigation | Cost to Implement | Expected Improvement |
|---|---|---|---|---|
| Repetitive stands | Critical | Odometry-constrained search + ICP verification | Low (~$5K) | 95% false positive elimination |
| Aircraft dynamics | Critical | Height filtering + dual descriptors | Low (~$3K) | 30-40% recall recovery at active gates |
| Seasonal weather | Moderate | Season-specific databases | Medium (~$10K) | 15-25% recall improvement in winter |
| Night operations | Low | Geometry-only descriptors (no intensity) | Negligible | <5% impact when properly configured |
| Construction zones | Moderate | Temporal descriptor aggregation | Low (~$5K) | Gradual adaptation over 2-3 sessions |
| De-icing spray | Moderate | Density normalization + shorter range | Low (~$3K) | 10-15% recovery during de-icing ops |

---

## 9. Descriptor Compression and Retrieval

### 9.1 Scale of the Retrieval Problem

A fleet of 20 vehicles operating 16 hours/day, generating keyframes every 2 m at 15 km/h average speed:

```
Keyframes per vehicle per day: (15,000 m/h × 16 h) / 2 m = 120,000
Fleet daily keyframes: 120,000 × 20 = 2,400,000
Annual database size: 2,400,000 × 365 = 876,000,000 (without pruning)
```

Even with aggressive pruning (keep only unique locations, prune temporal duplicates), the database for a single airport reaches **1-5 million entries** within months. Multi-airport deployments multiply this further.

### 9.2 FAISS for Scalable Search

FAISS (Facebook AI Similarity Search) provides GPU-accelerated approximate nearest neighbor search that scales to billions of vectors.

**Recommended configuration for airside:**

```python
import faiss
import numpy as np

def build_faiss_index(
    descriptors: np.ndarray,
    use_gpu: bool = True,
    nlist: int = 256,
    m_pq: int = 32,
    nbits: int = 8,
) -> faiss.Index:
    """
    Build FAISS IVF-PQ index for place recognition descriptors.
    
    IVF (Inverted File): partitions space into nlist Voronoi cells
    PQ (Product Quantization): compresses each vector into m_pq × nbits bits
    
    Args:
        descriptors: (N, 256) float32 descriptor matrix
        use_gpu: whether to use GPU for search (recommended on Orin)
        nlist: number of Voronoi cells (sqrt(N) is a good heuristic)
        m_pq: number of sub-quantizers (must divide descriptor dim)
        nbits: bits per sub-quantizer
        
    Returns:
        Trained FAISS index ready for search
    """
    d = descriptors.shape[1]  # 256
    
    # IVF-PQ index: fast approximate search with compression
    quantizer = faiss.IndexFlatL2(d)
    index = faiss.IndexIVFPQ(quantizer, d, nlist, m_pq, nbits)
    
    # Train on a representative subset
    train_size = min(len(descriptors), 100_000)
    train_subset = descriptors[
        np.random.choice(len(descriptors), train_size, replace=False)
    ]
    index.train(train_subset)
    
    # Add all descriptors
    index.add(descriptors)
    
    # Search parameters
    index.nprobe = 16  # Search 16 of 256 cells (trade-off: speed vs recall)
    
    if use_gpu:
        # Move to GPU for faster search
        res = faiss.StandardGpuResources()
        res.setTempMemory(64 * 1024 * 1024)  # 64 MB temporary GPU memory
        index = faiss.index_cpu_to_gpu(res, 0, index)
    
    return index


def search_faiss(
    index: faiss.Index,
    query: np.ndarray,
    top_k: int = 10,
) -> tuple:
    """
    Search FAISS index for nearest neighbors.
    
    Args:
        index: trained FAISS index
        query: (1, 256) or (256,) query descriptor
        top_k: number of nearest neighbors to return
        
    Returns:
        (distances, indices) arrays of shape (1, top_k)
    """
    if query.ndim == 1:
        query = query.reshape(1, -1)
    
    distances, indices = index.search(query.astype(np.float32), top_k)
    return distances[0], indices[0]
```

### 9.3 Memory and Retrieval Performance

| Database Size | Index Type | Memory (RAM) | Memory (PQ compressed) | Search Time (CPU) | Search Time (GPU) |
|---|---|---|---|---|---|
| 100K | Flat L2 | 97 MB | 6 MB (IVF-PQ) | 5 ms | <1 ms |
| 1M | Flat L2 | 976 MB | 55 MB (IVF-PQ) | 50 ms | <1 ms |
| 10M | IVF-PQ | N/A | 550 MB | 5 ms | <1 ms |
| 100M | IVF-PQ | N/A | 5.4 GB | 10 ms | 1 ms |

With Product Quantization (32 sub-quantizers, 8 bits each), each 256-dim float32 descriptor (1024 bytes) compresses to just 32 bytes -- a **32x compression ratio** with <2% recall loss at top-10.

### 9.4 On-Vehicle vs Cloud Database

**On-vehicle database (Orin):**
- Stores descriptors for the current airport only
- Typical size: 100K-500K entries = 3-16 MB with PQ compression
- Search: <1 ms on Orin GPU
- Updated incrementally during operation
- Used for real-time loop closure detection

**Edge server database (per-airport):**
- Stores all descriptors from all vehicles for this airport
- Typical size: 1-5M entries = 32-160 MB with PQ compression
- Search: <1 ms on server GPU
- Aggregates cross-vehicle observations
- Used for cross-vehicle place recognition and fleet map alignment

**Cloud database (multi-airport):**
- Stores descriptors from all airports
- Typical size: 10-50M entries per airport × number of airports
- Used for cross-airport transfer (e.g., recognizing similar stand layouts)
- Accessed only during offline map building, not real-time operations

### 9.5 Descriptor Versioning

As learned models are updated (fine-tuned with new airside data, adapted to new airports), descriptor embeddings change. Old descriptors become incompatible with new queries.

**Solutions:**
1. **Regeneration**: When model updates, regenerate all database descriptors from stored scans. Cost: ~15 ms per entry × 1M entries = ~4 hours on single GPU
2. **Adapter layer**: Train a small linear projection that maps old descriptors to the new embedding space. Cost: minimal, but adds 1-2% retrieval loss
3. **Parallel databases**: Maintain old and new descriptor databases during transition, merge results. Memory cost: 2x during transition

Recommended approach: regeneration during weekly maintenance windows, with adapter layer as interim solution for urgent model updates.

---

## 10. Integration with GTSAM Factor Graphs

Place recognition's primary output is loop closure candidates that integrate into the GTSAM factor graph as between-pose factors. This section details the integration with the reference airside AV stack's GTSAM + ISAM2 back-end (see [gtsam-factor-graphs.md](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md) for GTSAM fundamentals).

### 10.1 Loop Closure Factor

A loop closure connects two poses that observe the same place at different times. The measurement is the relative transform between them, estimated by ICP alignment.

```python
import gtsam
import numpy as np
from typing import Optional, Tuple

def add_loop_closure_factor(
    graph: gtsam.NonlinearFactorGraph,
    pose_key_current: int,
    pose_key_matched: int,
    relative_transform: gtsam.Pose3,
    icp_covariance: np.ndarray,
    use_robust_kernel: bool = True,
    kernel_threshold: float = 2.0,
) -> None:
    """
    Add a loop closure factor to the GTSAM factor graph.
    
    This creates a BetweenFactor<Pose3> connecting the current pose
    to a previously visited pose, with noise derived from ICP registration.
    
    Args:
        graph: GTSAM NonlinearFactorGraph to add the factor to
        pose_key_current: GTSAM key for current robot pose (e.g., X(1000))
        pose_key_matched: GTSAM key for matched historical pose (e.g., X(42))
        relative_transform: SE(3) transform from matched to current
        icp_covariance: (6, 6) covariance from ICP Hessian [rot_x, rot_y, rot_z, x, y, z]
        use_robust_kernel: whether to use Huber robust kernel (recommended)
        kernel_threshold: Huber kernel threshold in sigmas
    """
    # Create noise model from ICP covariance
    noise = gtsam.noiseModel.Gaussian.Covariance(icp_covariance)
    
    # Optionally wrap with robust kernel to downweight outlier loop closures
    if use_robust_kernel:
        huber = gtsam.noiseModel.mEstimator.Huber(kernel_threshold)
        noise = gtsam.noiseModel.Robust.Create(huber, noise)
    
    # Create and add BetweenFactor
    factor = gtsam.BetweenFactorPose3(
        pose_key_matched,
        pose_key_current,
        relative_transform,
        noise,
    )
    graph.add(factor)


def compute_icp_covariance(
    source: np.ndarray,
    target: np.ndarray,
    transform: np.ndarray,
    correspondence_distances: np.ndarray,
) -> np.ndarray:
    """
    Estimate ICP covariance from the Hessian of the registration objective.
    
    Uses the Censi (2007) method: covariance is proportional to the inverse
    of the Hessian of the point-to-plane ICP objective at convergence.
    
    Args:
        source: (N, 3) source points after transformation
        target: (N, 3) corresponding target points
        transform: (4, 4) ICP result transform
        correspondence_distances: (N,) per-point residual distances
        
    Returns:
        (6, 6) covariance matrix in [rot_x, rot_y, rot_z, x, y, z] order
    """
    # Simplified Censi covariance estimation
    # In practice, use Open3D's get_information_matrix() or
    # gtsam_points' VGICP covariance output
    
    N = len(source)
    residual_var = np.mean(correspondence_distances ** 2)
    
    # Build approximate Hessian from correspondences
    # (simplified -- production code should use analytic Jacobians)
    J = np.zeros((N * 3, 6))
    for i in range(N):
        p = source[i]
        # Jacobian of transformed point w.r.t. [rot, trans]
        J[i*3:i*3+3, 0:3] = np.array([
            [0, p[2], -p[1]],
            [-p[2], 0, p[0]],
            [p[1], -p[0], 0],
        ])
        J[i*3:i*3+3, 3:6] = np.eye(3)
    
    # Hessian = J^T J / sigma^2
    H = J.T @ J / max(residual_var, 1e-6)
    
    # Covariance = H^{-1}
    try:
        cov = np.linalg.inv(H)
    except np.linalg.LinAlgError:
        # Fallback: conservative diagonal covariance
        cov = np.diag([0.01, 0.01, 0.01, 0.1, 0.1, 0.1])
    
    # Ensure positive definite
    eigvals = np.linalg.eigvalsh(cov)
    if np.any(eigvals <= 0):
        cov += np.eye(6) * (abs(min(eigvals)) + 1e-6)
    
    return cov


def loop_closure_pipeline(
    isam2: gtsam.ISAM2,
    graph: gtsam.NonlinearFactorGraph,
    initial_values: gtsam.Values,
    current_key: int,
    current_scan: np.ndarray,
    current_pose: gtsam.Pose3,
    place_database,  # PlaceDatabase instance
    sc_descriptor,   # ScanContextDescriptor instance
    icp_registrator,  # ICP/VGICP function
    min_fitness: float = 0.3,
    max_rmse: float = 0.3,
) -> Optional[Tuple[int, gtsam.Pose3]]:
    """
    Complete loop closure pipeline: descriptor matching → ICP → GTSAM update.
    
    Returns (matched_key, relative_pose) if loop closure accepted, None otherwise.
    """
    import time
    
    # Step 1: Compute descriptors
    sc = sc_descriptor.compute(current_scan)
    rk = sc_descriptor.ring_key(sc)
    # Assume MinkLoc3D descriptor computed separately on GPU
    # learned_desc = minkloc3d.encode(current_scan)
    learned_desc = np.random.randn(256).astype(np.float32)  # placeholder
    
    # Step 2: Two-stage retrieval
    candidates = place_database.query_two_stage(
        ring_key=rk,
        learned_desc=learned_desc,
        min_time_gap=30.0,
        current_time=time.time(),
        top_k=5,
    )
    
    if not candidates:
        return None
    
    # Step 3: Geometric verification via ICP
    best_match = None
    best_fitness = 0.0
    
    for idx, desc_dist in candidates:
        # Retrieve stored scan
        stored_scan_bytes = place_database.get_scan(idx)
        if stored_scan_bytes is None:
            continue
        
        # Decompress scan (LZ4)
        # stored_scan = lz4.frame.decompress(stored_scan_bytes)
        # stored_scan = np.frombuffer(stored_scan, dtype=np.float32).reshape(-1, 3)
        
        # ICP registration
        # result = icp_registrator(current_scan, stored_scan)
        # fitness = result.fitness
        # rmse = result.inlier_rmse
        # transform = result.transformation
        
        # Placeholder for demonstration
        fitness = 0.5  # Would come from ICP
        rmse = 0.15
        transform = np.eye(4)
        
        if fitness > min_fitness and rmse < max_rmse and fitness > best_fitness:
            best_fitness = fitness
            entry = place_database.entries[idx]
            matched_key = idx  # In practice, map entry index to GTSAM key
            best_match = (matched_key, transform, fitness)
    
    if best_match is None:
        return None
    
    matched_key, transform, fitness = best_match
    
    # Step 4: Odometry consistency check
    matched_pose = isam2.calculateEstimate().atPose3(matched_key)
    odom_distance = np.linalg.norm([
        current_pose.x() - matched_pose.x(),
        current_pose.y() - matched_pose.y(),
    ])
    
    # Check: is the loop closure geometrically plausible?
    lc_distance = np.linalg.norm(transform[:3, 3])
    if abs(odom_distance - lc_distance) > 5.0:
        # Inconsistent with odometry -- reject
        return None
    
    # Step 5: Add to GTSAM
    relative_pose = gtsam.Pose3(transform)
    
    # Compute covariance (in practice from ICP Hessian)
    cov = np.diag([0.005, 0.005, 0.01, 0.05, 0.05, 0.05])
    
    add_loop_closure_factor(
        graph=graph,
        pose_key_current=current_key,
        pose_key_matched=matched_key,
        relative_transform=relative_pose,
        icp_covariance=cov,
        use_robust_kernel=True,
    )
    
    # Step 6: ISAM2 update
    isam2.update(graph, initial_values)
    graph.resize(0)  # Clear graph after update
    initial_values.clear()
    
    return (matched_key, relative_pose)
```

### 10.2 Switchable Constraints for Outlier Rejection

Even with geometric verification, occasional false loop closures slip through. GTSAM's **switchable constraints** (Sunderhauf & Protzel, IROS 2012) add a binary switch variable to each loop closure factor that the optimizer can "turn off" if the constraint is inconsistent with the rest of the graph.

```python
def add_switchable_loop_closure(
    graph: gtsam.NonlinearFactorGraph,
    values: gtsam.Values,
    pose_key_current: int,
    pose_key_matched: int,
    switch_key: int,
    relative_transform: gtsam.Pose3,
    icp_covariance: np.ndarray,
    prior_probability: float = 0.9,  # Prior belief that this LC is correct
) -> None:
    """
    Add a loop closure with a switchable constraint for automatic outlier rejection.
    
    The switch variable s ∈ [0, 1] scales the loop closure factor:
    - s = 1: full loop closure (correct match)
    - s = 0: disabled (false positive)
    The optimizer finds the MAP estimate of s jointly with poses.
    """
    # Standard loop closure factor
    noise = gtsam.noiseModel.Gaussian.Covariance(icp_covariance)
    factor = gtsam.BetweenFactorPose3(
        pose_key_matched,
        pose_key_current,
        relative_transform,
        noise,
    )
    graph.add(factor)
    
    # Switch variable prior (high prior = likely correct)
    # In full implementation, this would use a custom SwitchableFactor
    # that multiplies the BetweenFactor error by the switch value.
    # Here we show the conceptual approach using max-mixture.
    
    # Alternative: Max-mixture model (Olson & Agarwal, ICRA 2013)
    # Uses mixture of null hypothesis (uniform) and loop closure hypothesis
    # GTSAM 4.2+ supports this via custom factors
    pass
```

### 10.3 Robust Back-End Configuration

For airside SLAM with place recognition loop closures, the ISAM2 parameters should be tuned for resilience:

| Parameter | Default | Airside Recommendation | Rationale |
|---|---|---|---|
| Relinearize threshold | 0.1 | 0.01 | Tighter relinearization for loop closure absorption |
| Relinearize skip | 10 | 1 | Relinearize every update when loop closures are active |
| Cache linearized factors | true | true | Performance optimization |
| Find unused keys | false | true | Enable pruning of old pose nodes |
| Wildfire threshold | 0.001 | 0.001 | Default is fine |

---

## 11. Orin Deployment Considerations

### 11.1 Compute Budget

The place recognition pipeline must fit within the overall reference airside AV stack perception budget. Based on the current stack's timing:

| Component | Latency | GPU Memory | Notes |
|---|---|---|---|
| PointPillars detection | 6.84 ms | ~200 MB | Existing, non-negotiable |
| GTSAM + VGICP | 15-25 ms | ~300 MB | Existing, non-negotiable |
| Scan Context (CPU) | 3-5 ms | 0 | Runs on ARM cores, parallel to GPU work |
| MinkLoc3D (GPU) | 15-20 ms | ~200 MB | Only triggered by SC pre-filter |
| FAISS search (GPU) | <1 ms | 32-64 MB | Minimal overhead |
| ICP verification (GPU) | 30-50 ms | ~100 MB | Only for top-K candidates (1-3x per closure) |
| **Total place recognition** | **~50-75 ms** | **~300 MB** | **Only when loop closure triggered** |

**Key insight:** Place recognition is not run on every frame. It triggers every 2 m (keyframe interval) for descriptor storage, and full two-stage retrieval + ICP only when the Scan Context pre-filter finds candidates. At 15 km/h with keyframes every 2 m, that is once every 0.48 seconds -- leaving ample time for the full pipeline between keyframes.

### 11.2 Model Optimization for Orin

**MinkLoc3D on Orin:**
- MinkowskiEngine requires custom build for ARM (not available via pip for aarch64)
- Alternative: Convert trained model to ONNX → TensorRT for 2-3x speedup
- TorchSparse (MIT license) is an alternative sparse convolution library with better ARM support
- Expected latency after TensorRT conversion: ~8-12 ms (from ~15-20 ms PyTorch)

**FAISS on Orin:**
- FAISS provides pre-built conda packages for aarch64 (GPU-enabled)
- Alternatively, `faiss-gpu` can be compiled from source with CUDA 11.4+ on Orin
- For databases <500K, CPU FAISS is sufficient (<5 ms search time)
- GPU FAISS recommended for cross-vehicle database (1M+ entries)

### 11.3 Memory Management

Orin has 32 GB shared CPU/GPU memory. The place recognition subsystem's memory footprint:

| Component | Memory | Notes |
|---|---|---|
| MinkLoc3D model | ~200 MB | GPU, loaded once |
| FAISS index (500K entries, PQ) | ~16 MB | GPU or CPU |
| Scan Context database (500K) | ~230 MB | CPU (ring keys + SC matrices) |
| Scan buffer (100 compressed scans for ICP) | ~50 MB | CPU, LRU cache |
| **Total** | **~500 MB** | **1.6% of 32 GB Orin memory** |

This is well within budget, even alongside the full perception stack.

### 11.4 Multi-LiDAR Descriptor Computation

The reference airside AV stack runs 4-8 RoboSense LiDARs. For place recognition, the merged point cloud provides the most discriminative descriptor, but per-LiDAR descriptors offer redundancy:

**Recommended approach:**
1. **Merged descriptor**: Compute Scan Context and MinkLoc3D on the fused point cloud (all 4-8 LiDARs merged and ego-motion compensated). This is the primary descriptor for database matching
2. **Per-LiDAR fallback**: If one or more LiDARs fail (de-icing spray, sensor fault), compute descriptors from remaining LiDARs only. Recall will degrade gracefully (~5-10% per lost LiDAR)
3. **Descriptor quality score**: Estimate descriptor reliability based on point count and coverage. If below threshold (e.g., <50% of nominal point count), flag the descriptor as low-confidence and require stricter verification thresholds

### 11.5 ROS Integration

Place recognition integrates into the ROS Noetic stack as a node that subscribes to keyframe point clouds and publishes loop closure candidates:

```
/merged_lidar (sensor_msgs/PointCloud2)
    │
    ├── /place_recognition_node
    │       - Subscribes: /merged_lidar, /current_pose
    │       - Publishes: /loop_closure_candidates (custom msg)
    │       - Services: /query_place, /add_to_database
    │       - Parameters: thresholds, database path, model path
    │
    └── /slam_backend_node (existing GTSAM node)
            - Subscribes: /loop_closure_candidates
            - Adds BetweenFactorPose3 to graph
            - Publishes: /optimized_trajectory
```

The existing GTSAM node in the reference airside AV stack already handles odometry and GPS factors; loop closure factors from place recognition integrate through the same factor graph interface.

---

## 12. Key Takeaways

1. **Place recognition is the missing link in the reference airside AV stack's localization stack.** The current GTSAM + VGICP pipeline handles odometry well but has no mechanism for loop closure, kidnapped robot recovery, or multi-session map alignment. Without it, long-duration missions accumulate unbounded drift.

2. **Two-stage descriptor matching is the optimal architecture for Orin.** Scan Context on CPU (always-on, <5 ms) pre-filters candidates, then MinkLoc3D on GPU (triggered, ~15 ms) verifies. This achieves 97%+ recall while consuming GPU only 10-20% of the time.

3. **MinkLoc3D is the current best learned descriptor for airside.** At 97.5% recall@1 with 15 ms GPU latency and 256-byte descriptor, it offers the best tradeoff of accuracy, speed, and maturity. PPT (98.6%) is newer and requires less fine-tuning data but is less battle-tested.

4. **Scan Context remains indispensable as a lightweight baseline.** No training data needed, deterministic, <5 ms CPU-only, rotation-invariant. For safety certification, its verifiable behavior is an advantage over neural approaches.

5. **The identical-stands problem is the primary airside challenge.** Adjacent stands with identical geometry cause perceptual aliasing that no descriptor alone can solve. Odometry-constrained geographic search (only consider candidates within dead-reckoning uncertainty) eliminates 80-90% of false matches at zero computational cost.

6. **Aircraft presence dominates and disrupts descriptors.** A 60 m aircraft changing 40-60% of occupied voxels makes same-location descriptors look completely different. Height filtering (remove >4 m) or ground-plane-only descriptors are essential for multi-session consistency.

7. **ICP geometric verification is non-negotiable.** Descriptor matching alone produces 5-15% false positives in repetitive environments. ICP fitness checking (>30% overlap, <0.3 m RMSE) reduces false loop closures to <1%, and switchable constraints handle the remainder.

8. **FAISS with Product Quantization enables million-scale retrieval on Orin.** A 1M-entry database compresses to ~55 MB with PQ (32x compression) and searches in <1 ms on GPU. This scales comfortably to multi-airport deployments.

9. **Fleet-scale shared descriptor databases enable cooperative mapping.** At <2 MB/min bandwidth per vehicle, sharing descriptors over airport 5G/CBRS is trivial. Cross-vehicle loop closures improve map consistency by 15-25% over single-vehicle SLAM.

10. **Integration with GTSAM uses standard BetweenFactorPose3.** Loop closure factors connect historical poses with ICP-derived transforms and Hessian-based covariance. Robust kernels (Huber) and switchable constraints protect against the inevitable false positives.

11. **Total system memory footprint is ~500 MB (1.6% of Orin's 32 GB).** MinkLoc3D model (~200 MB), FAISS index (~16 MB), Scan Context database (~230 MB), and scan cache (~50 MB) fit comfortably alongside the full perception stack.

12. **Seasonal descriptor databases are necessary for year-round operation.** Snow accumulation causes 20-40% descriptor change. Maintaining per-season or per-condition databases with fallback to all-conditions matching ensures consistent recall across weather conditions.

13. **Dynamic object filtering before descriptor computation is critical.** Using the existing PointPillars detection pipeline to mask known dynamic objects (vehicles, personnel) before computing descriptors improves multi-session recall by 15-25% at active gate areas.

14. **LCDNet provides integrated recognition + pose estimation.** For kidnapped robot recovery where speed matters, LCDNet's combined descriptor + 6-DoF pose output eliminates the serial ICP step, reducing recovery time from ~150 ms to ~30 ms.

15. **PPT's few-shot adaptation is ideal for new airport onboarding.** Pre-train on road driving data, then prompt-tune with 100-500 airside scene pairs from the initial mapping session. This aligns with the 8-week onboarding process described in the multi-airport adaptation workflow.

16. **No public airside place recognition benchmark exists.** Road-driving benchmarks (Oxford RobotCar, KITTI, MulRan) do not capture the unique challenges of repetitive stands, dominant aircraft dynamics, and de-icing conditions. Creating an internal benchmark from fleet data would enable proper method comparison for airside.

17. **BEVPlace is an underexplored shortcut for airside.** Because airports are flat and maps are inherently 2D (AMDB), BEV projection loses minimal information while enabling the use of mature 2D image retrieval techniques. At ~8 ms and 97.9% recall, it deserves evaluation.

18. **Estimated implementation cost: $25-40K over 8-12 weeks.** Phase 1 (Scan Context + GTSAM integration, 3 weeks, ~$8K) provides immediate loop closure. Phase 2 (MinkLoc3D + FAISS, 4 weeks, ~$12K) adds learned verification. Phase 3 (fleet database + cross-vehicle, 3-5 weeks, ~$10-20K) enables cooperative mapping.

---

## Cost and Implementation Roadmap

| Phase | Scope | Duration | Cost | Deliverable |
|---|---|---|---|---|
| **Phase 1** | Scan Context + GTSAM loop closure | 3 weeks | $8-12K | Basic loop closure in single-vehicle SLAM |
| **Phase 2** | MinkLoc3D + FAISS + two-stage pipeline | 4 weeks | $10-15K | High-recall place recognition, million-scale retrieval |
| **Phase 3** | Fleet descriptor database + cross-vehicle matching | 3-5 weeks | $10-20K | Cooperative mapping across fleet |
| **Phase 4** | PPT/BEVPlace evaluation + airside fine-tuning | 2-3 weeks | $5-10K | Airside-adapted descriptors, internal benchmark |
| **Total** | End-to-end place recognition system | 12-16 weeks | $33-57K | Fleet-scale relocalization and cooperative mapping |

---

## References

- Kim & Kim, "Scan Context: Egocentric Spatial Descriptor for Place Recognition" (IROS 2018)
- Kim et al., "Scan Context++: Structural Place Recognition Robust to Rotation and Lateral Variations" (IEEE T-RO 2022)
- He et al., "M2DP: A Novel 3D Point Cloud Descriptor" (IROS 2016)
- Lu et al., "One RING to Rule Them All" (IROS 2022) / RING++ (IEEE T-RO 2023)
- Uy & Lee, "PointNetVLAD: Deep Point Cloud Based Retrieval" (CVPR 2018)
- Komorowski, "MinkLoc3D: Point Cloud Based Large-Scale Place Recognition" (WACV 2021)
- Vidanapathirana et al., "LoGG3D-Net: Locally Guided Global Descriptor Learning" (ICRA 2022)
- Cattaneo et al., "LCDNet: Deep Loop Closure Detection and Point Cloud Registration" (IEEE T-RO 2022)
- Wu et al., "PPT: Pre-trained Point Cloud Transformer for Place Recognition" (CVPR 2024)
- Luo et al., "BEVPlace: Learning LiDAR-based Place Recognition using Bird's Eye View Images" (ICCV 2023)
- Sunderhauf & Protzel, "Switchable Constraints for Robust Pose Graph SLAM" (IROS 2012)
- Censi, "An Accurate Closed-Form Estimate of ICP's Covariance" (ICRA 2007)
- Johnson et al., "Billion-Scale Similarity Search with GPUs" (FAISS, IEEE T-BD 2021)

---

## Related Documents

- [LiDAR SLAM Algorithms](lidar-slam-algorithms.md) -- SLAM front-end algorithms (KISS-ICP, LIO-SAM, FAST-LIO2) that produce the odometry factors place recognition complements with loop closures
- [GTSAM Factor Graphs](../../../10-knowledge-base/state-estimation/gtsam-factor-graphs.md) -- Comprehensive GTSAM reference including ISAM2, noise models, and factor types used for loop closure integration
- [Mapping and Localization](mapping-and-localization.md) -- Overview of mapping paradigms including place recognition's role in spatial memory
- [Semantic Mapping and Learned Priors](../maps/semantic-mapping-learned-priors.md) -- Semantic features that could augment geometric descriptors for disambiguation
- [HD Map Change Detection and Maintenance](../maps/hd-map-change-detection-maintenance.md) -- Fleet-based map maintenance that relies on cross-vehicle place recognition for multi-session alignment
- [Multi-LiDAR Extrinsic Calibration](../../../20-av-platform/sensors/multi-lidar-calibration.md) -- Calibration accuracy directly impacts descriptor quality when fusing 4-8 LiDARs
- [Sparse Attention for 3D Perception](../../../10-knowledge-base/machine-learning/sparse-attention-3d-perception.md) -- PTv3 architecture details relevant to transformer-based place recognition
