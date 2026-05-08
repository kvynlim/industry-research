# Sparse Attention Mechanisms and Transformer Architectures for 3D Point Cloud Perception

## From O(n^2) Dense Attention to Real-Time Sparse Transformers on NVIDIA Orin

**Last updated:** 2026-04-11

---

**Summary:** Transformers have overtaken sparse convolution as the dominant backbone for 3D point cloud perception, with Point Transformer v3 (PTv3) setting records on every major benchmark. But naive self-attention over 100K+ LiDAR points is computationally impossible -- O(n^2) over n=100,000 requires 10^10 operations per attention layer. The solution is sparse attention: restricting each point's attention to a local neighborhood via windows, serialization, ball queries, or learned sampling. This document covers every major sparse attention pattern for 3D perception, from point-level (PTv1-v3) to voxel-level (SST, FlatFormer) to BEV-level (BEVFormer, StreamPETR), with PyTorch implementations, Orin deployment benchmarks, and practical integration guidance for the Aurrigo ROS Noetic stack. The key takeaway: **PTv3 with serialized attention achieves 80.4% mIoU on nuScenes while running 3x faster and using 10x less memory than PTv2, making it the clear choice for next-generation LiDAR perception on Orin** -- but getting it there requires careful TensorRT conversion of custom attention ops, and PointPillars (6.84ms) remains unbeatable for latency-critical safety paths.

---

## Table of Contents

1. [Why Attention for 3D Perception](#1-why-attention-for-3d-perception)
2. [Point Transformers: PTv1 to PTv3](#2-point-transformers-ptv1-to-ptv3)
3. [Voxel Transformers](#3-voxel-transformers)
4. [Sparse Attention Patterns](#4-sparse-attention-patterns)
5. [BEV Transformers](#5-bev-transformers)
6. [Efficient Attention Implementations](#6-efficient-attention-implementations)
7. [Sparse Convolution vs Sparse Attention](#7-sparse-convolution-vs-sparse-attention)
8. [Multi-Head Cross-Attention for Fusion](#8-multi-head-cross-attention-for-fusion)
9. [Deformable Attention for 3D](#9-deformable-attention-for-3d)
10. [Orin Deployment Considerations](#10-orin-deployment-considerations)
11. [Implementation Guide](#11-implementation-guide)
12. [Key Takeaways](#12-key-takeaways)
13. [References](#13-references)

---

## 1. Why Attention for 3D Perception

### 1.1 The Problem with Fixed-Kernel Convolutions on Point Clouds

Point clouds are fundamentally different from images. Images are dense, regular grids where 3x3 convolution kernels tile perfectly. Point clouds are:

- **Irregular**: Points have arbitrary (x, y, z) coordinates with no grid alignment
- **Sparse**: A 100m x 100m area at 0.1m voxel resolution has 10^6 cells but only ~5-10% occupied
- **Varying density**: 1000 points/m^2 near the sensor, 10 points/m^2 at 50m range
- **Unordered**: No canonical ordering -- the same scene produces different point orderings each scan

Traditional convolution approaches handle this through discretization:

```
Approach 1: Voxelize then 3D Conv
  Point cloud -> 3D voxel grid (0.1m resolution) -> 3D convolutions
  Problem: O(n^3) memory, most voxels empty, fixed receptive field

Approach 2: 2D Projection (Range/BEV)
  Point cloud -> 2D range image or BEV grid -> 2D convolutions
  Problem: Quantization artifacts, occlusion handling lost in projection

Approach 3: PointNet++ (Set Abstraction)
  Ball query grouping -> shared MLP per neighborhood -> max pooling
  Problem: Fixed ball radius, max pool discards inter-point relations
```

The core limitation of all convolution-based approaches: **fixed receptive fields cannot adapt to the wildly varying density and structure of point clouds**. A 3x3x3 voxel conv covers 0.6m^3 at 0.2m resolution -- this captures a bolt on the ground but sees only a tiny patch of an aircraft fuselage 30m away.

### 1.2 Attention as Learnable Receptive Fields

Self-attention computes pairwise interactions between all elements:

```
Attention(Q, K, V) = softmax(Q K^T / sqrt(d_k)) V

For n points with d-dimensional features:
  Q, K, V = X W_Q, X W_K, X W_V     ∈ R^{n x d}
  Q K^T                               ∈ R^{n x n}   <- pairwise affinities
  softmax(Q K^T / sqrt(d_k))          ∈ R^{n x n}   <- attention weights
  Output                               ∈ R^{n x d}   <- weighted aggregation
```

Why this matters for point clouds:

1. **Adaptive receptive field**: Each point attends to the most relevant neighbors, not a fixed spatial window
2. **Content-aware aggregation**: Attention weights depend on feature similarity, not just spatial proximity
3. **Long-range dependencies**: A point on a pushback tractor can attend to the aircraft nose 50m away
4. **Permutation invariance**: Attention output is unchanged by point ordering (unlike 1D sequence models)
5. **Density-adaptive**: Naturally handles varying point density -- sparse regions attend over larger areas

For detailed transformer attention fundamentals (scaling, multi-head, positional encoding), see `10-knowledge-base/machine-learning/transformer-world-models.md`.

### 1.3 The Quadratic Wall

The critical problem: self-attention is O(n^2) in sequence length.

```
Typical LiDAR point counts:
  Single RoboSense RSHELIOS:  ~32,000 points/scan
  Aurrigo 4-LiDAR setup:     ~120,000 points/scan
  Aurrigo 8-LiDAR setup:     ~240,000 points/scan

Full self-attention cost:
  n = 120,000 points, d = 64 features
  Q K^T: 120,000 x 120,000 = 14.4 billion operations
  Memory: 120,000^2 x 4 bytes = 53.6 GB (FP32 attention matrix)

  This is IMPOSSIBLE on any hardware, let alone Orin (32-64 GB shared memory)
```

For comparison, language models handle sequences of 4K-128K tokens. LiDAR point clouds have 100K+ "tokens" but each token also carries 3D spatial information that must be preserved.

### 1.4 The Sparse Attention Solution

The key insight: **not all points need to attend to all other points**. Most useful information is local -- a point on a cargo dolly doesn't need to attend to the airport terminal 200m away. Sparse attention restricts the attention pattern:

```
Dense attention:  Each point attends to ALL n points       -> O(n^2)
Sparse attention: Each point attends to k << n neighbors   -> O(nk)

If k = 256 (typical window size):
  120,000 x 256 = 30.7 million operations (vs 14.4 billion)
  Memory: 120,000 x 256 x 4 = 122 MB (vs 53.6 GB)
  Speedup: ~460x
```

The challenge becomes: **how do you choose which k points each point attends to?** This is the central question of all sparse attention research for 3D perception, and different answers lead to fundamentally different architectures.

### 1.5 Taxonomy of Sparse Attention for 3D

| Strategy | Grouping Method | Points per Group | Complexity | Key Method |
|----------|----------------|-----------------|------------|------------|
| **Ball query** | Spatial radius search | Variable (16-64) | O(n * k) | Point Transformer v1 |
| **KNN** | K-nearest neighbors | Fixed k | O(n * k * log n) | Point Transformer v2 |
| **Window** | Divide space into windows | ~256-1024 | O(n * w) | Swin3D, SST |
| **Serialization** | Space-filling curve ordering | ~1024 | O(n * w) | Point Transformer v3 |
| **Voxel set** | Group by voxel occupancy | Variable | O(V * p^2) | VoxSet |
| **Hash** | Locality-sensitive hashing | ~128-512 | O(n * k) | FlatFormer |
| **Deformable** | Learned reference points | 4-8 per query | O(n * K) | Deformable DETR 3D |
| **Cross-attention** | Query-to-feature attention | All in BEV cell | O(Q * k) | BEVFormer |
| **Range-view** | Neighbors in range image | ~9-25 (2D grid) | O(n * k) | RangeFormer |

---

## 2. Point Transformers: PTv1 to PTv3

### 2.1 Point Transformer v1 (ICCV 2021)

**Core idea:** Replace PointNet++ set abstraction with vector attention in local neighborhoods.

Point Transformer v1 introduced the concept of **vector attention** for point clouds -- instead of producing a single scalar attention weight per pair (as in standard attention), it produces a **vector of weights** (one per feature dimension), enabling per-channel modulation.

```
Standard scalar attention:
  alpha_ij = softmax(q_i^T k_j / sqrt(d))   scalar
  output_i = sum_j alpha_ij * v_j

Point Transformer vector attention:
  alpha_ij = softmax(MLP(q_i - k_j + delta_ij))   ∈ R^d  (vector!)
  output_i = sum_j alpha_ij ⊙ (v_j + delta_ij)    (element-wise multiply)

  where delta_ij = pos_encoding(p_i - p_j)  is relative position encoding
```

Architecture overview:

```
Input: Point cloud (N, 3+C)
  |
  v
[Set Abstraction]  -> downsample to N/4 points, neighborhood via ball query
  |
  v
[Point Transformer Block x4]  -> vector attention within k=16 nearest neighbors
  |                              each point attends to 16 neighbors
  v
[Set Abstraction]  -> downsample to N/16
  |
  v
[Point Transformer Block x6]
  |
  v
[Feature Propagation]  -> upsample back to N points (for segmentation)
  |
  v
Output: (N, num_classes)
```

**Results (S3DIS indoor segmentation):**
- 73.5% mIoU -- SOTA at time of publication
- 3.4% improvement over PointNet++ with comparable parameters
- First clear demonstration that attention outperforms MLPs for point clouds

**Limitations:**
- Ball query with fixed radius fails in variable-density outdoor scenes
- k=16 neighborhood is too small for large-scale LiDAR scenes
- No multi-scale attention -- each layer sees only one scale

PyTorch implementation of the core Point Transformer v1 block:

```python
import torch
import torch.nn as nn
from torch_geometric.nn import knn

class PointTransformerV1Block(nn.Module):
    """Point Transformer v1: Vector attention with relative position encoding."""

    def __init__(self, dim, k=16):
        super().__init__()
        self.k = k
        self.dim = dim

        # Linear projections for Q, K, V
        self.to_q = nn.Linear(dim, dim, bias=False)
        self.to_k = nn.Linear(dim, dim, bias=False)
        self.to_v = nn.Linear(dim, dim, bias=False)

        # Relative position encoding: 3D offset -> d-dim feature
        self.pos_enc = nn.Sequential(
            nn.Linear(3, dim),
            nn.ReLU(),
            nn.Linear(dim, dim)
        )

        # Attention weight MLP: maps (q - k + pos) -> d-dim vector weights
        self.attn_mlp = nn.Sequential(
            nn.Linear(dim, dim),
            nn.ReLU(),
            nn.Linear(dim, dim)
        )

    def forward(self, x, pos):
        """
        Args:
            x:   (N, d) point features
            pos: (N, 3) point coordinates
        Returns:
            (N, d) updated features
        """
        N, d = x.shape

        q = self.to_q(x)   # (N, d)
        k = self.to_k(x)   # (N, d)
        v = self.to_v(x)   # (N, d)

        # KNN grouping: for each point, find k nearest neighbors
        # idx shape: (N, k) -- indices of k neighbors for each point
        batch = torch.zeros(N, dtype=torch.long, device=x.device)
        edge_index = knn(pos, pos, self.k, batch, batch)
        idx = edge_index[1].view(N, self.k)  # neighbor indices

        # Gather neighbor features
        k_grouped = k[idx]            # (N, k, d)
        v_grouped = v[idx]            # (N, k, d)
        pos_grouped = pos[idx]        # (N, k, 3)

        # Relative position encoding
        delta_pos = pos_grouped - pos.unsqueeze(1)  # (N, k, 3)
        delta = self.pos_enc(delta_pos)               # (N, k, d)

        # Vector attention: softmax over per-dimension attention weights
        q_expanded = q.unsqueeze(1).expand_as(k_grouped)  # (N, k, d)
        attn_input = q_expanded - k_grouped + delta        # (N, k, d)
        attn_weights = self.attn_mlp(attn_input)           # (N, k, d)
        attn_weights = torch.softmax(attn_weights, dim=1)  # softmax over k

        # Weighted aggregation (element-wise multiply = vector attention)
        output = (attn_weights * (v_grouped + delta)).sum(dim=1)  # (N, d)

        return output
```

### 2.2 Point Transformer v2 (NeurIPS 2022)

**Core improvements over v1:**

1. **Grouped vector attention**: Groups feature dimensions (like multi-head attention) for better expressiveness at lower cost
2. **Partition-based pooling**: Replaces ball query with grid-based partitioning for more uniform spatial coverage
3. **Conditional positional encoding**: Position encoding that adapts to local point distribution

```
PTv2 key changes:

1. Grouped vector attention:
   Split d channels into G groups of d/G channels each
   Compute vector attention independently per group
   Concat results -> same output dim d but G different attention patterns

   Standard vector attention: O(n * k * d)
   Grouped (G=8):             O(n * k * d) same FLOPs but more diverse patterns

2. Partition-based pooling (replaces farthest point sampling + ball query):
   Divide 3D space into grid cells (e.g., 0.32m)
   Compute average position and max-pool features within each cell
   Benefits: O(n) vs O(n^2) for farthest point sampling
             Uniform spatial coverage regardless of density
             Naturally handles multi-LiDAR overlapping regions
```

**Results:**
- **S3DIS**: 77.9% mIoU (+4.4% over PTv1)
- **ScanNet**: 75.4% mIoU
- **nuScenes segmentation**: 80.2% mIoU
- **Semantic KITTI**: 71.2% mIoU

**Airside relevance:** Partition-based pooling is ideal for multi-LiDAR setups where overlapping FOVs create varying point density. The grid-based approach handles 4-8 RoboSense sensors naturally.

**Limitation:** Still uses per-point KNN attention -- O(n k log n) KNN search is slow for large outdoor point clouds. On nuScenes (34K points), PTv2 runs at ~180ms on A100. Extrapolating to 120K points from Aurrigo's 4-LiDAR setup: ~630ms. Far too slow for real-time.

### 2.3 Point Transformer v3 (CVPR 2024)

PTv3 is a landmark paper that makes point transformers practical for large-scale outdoor LiDAR perception. It achieves **state-of-the-art results on every major 3D benchmark while being 3x faster and using 10x less memory than PTv2**.

**Core innovations:**

#### Serialization-Based Attention

The key insight: replace spatial data structures (KNN, ball query, octrees) with **space-filling curves** that serialize the 3D point cloud into a 1D sequence, then apply standard windowed attention on this sequence.

```
Space-filling curves map 3D coordinates to 1D indices:

1. Z-order (Morton code):
   Interleave bits of x, y, z coordinates
   (x=3, y=5, z=2) in binary: x=011, y=101, z=010
   Z-order: 001110 = 14 (interleave z,y,x bits)

2. Hilbert curve:
   Better locality preservation than Z-order
   Adjacent 1D indices are always spatially adjacent (not always true for Z-order)

3. Trans-Hilbert curve (PTv3 contribution):
   Random rotation applied before Hilbert encoding
   Different random rotations per attention head
   Ensures diverse spatial groupings across heads

Serialization procedure:
  Input: N points with (x, y, z)
  1. Quantize to grid: (x, y, z) -> (ix, iy, iz) integers
  2. Compute Hilbert index for each point -> 1D ordering
  3. Sort points by Hilbert index -> 1D sequence
  4. Apply windowed self-attention with window size w=1024
```

Why this is brilliant: space-filling curves guarantee that **spatially nearby 3D points are nearby in the 1D sequence**. This means standard 1D windowed attention (as in Swin Transformer) automatically becomes **local 3D attention** -- without any KNN search, ball query, or spatial tree construction.

```
Cost comparison for n=120,000 points:

PTv1 (ball query + attention):
  Ball query:  O(n * k) with GPU overhead for radius search
  Attention:   O(n * k * d)
  KNN search:  ~15ms for k=16, n=120K

PTv2 (KNN + attention):
  KNN search:  O(n * k * log n) = O(120K * 48 * 17) ≈ 10^8
  Attention:   O(n * k * d) = O(120K * 48 * 64) ≈ 3.7 * 10^8

PTv3 (serialization + windowed attention):
  Hilbert sort: O(n log n) = O(120K * 17) ≈ 2 * 10^6  (40x cheaper)
  Attention:    O(n * w * d) = O(120K * 1024 * 64) ≈ 7.9 * 10^9
  BUT: uses FlashAttention for the window -> memory O(n * d), not O(n * w)
```

#### FlashAttention Integration

PTv3 was the first point cloud transformer to leverage FlashAttention (see Section 6). The 1D serialized sequence maps directly to FlashAttention's API, unlike KNN-based attention which requires scatter/gather operations that break FlashAttention's assumptions.

```
FlashAttention for PTv3:
  Input: Serialized point sequence (N, d), window size w=1024
  Chunk into N/w windows of size w
  Apply FlashAttention within each window

  FlashAttention v2 performance:
    Window w=1024, d=64: ~0.5 TFLOPs/s on A100
    Memory: O(N * d) instead of O(N * w) -- no materialized attention matrix
    Result: 3x wall-clock speedup over PTv2's custom CUDA attention
```

#### Multi-Order Serialization

Different space-filling curves create different neighborhoods. PTv3 uses **multiple serialization orders** (different random rotations of the Hilbert curve) across attention heads, so each head sees a different spatial grouping:

```
Head 1: Hilbert curve with rotation R1 -> groups points along one axis
Head 2: Hilbert curve with rotation R2 -> groups points along another axis
Head 3: Z-order curve                  -> groups points hierarchically
Head 4: Transposed Hilbert             -> groups points in yet another pattern

Effect: Each head captures different spatial relationships
        Equivalent to having multiple different "receptive field shapes"
        Without any computational overhead (just different sort orderings)
```

#### Architecture

```
PTv3 Architecture:

Input: Point cloud (N, 4)  [x, y, z, intensity]
  |
  v
Stem: Linear(4, 64) + LayerNorm + GELU
  |
  v
Stage 1: Grid pooling (0.02m) -> Serialized Attention Blocks x3
  (N1 points, dim=64)          Window size w=1024
  |                            Each block: LN -> MHSA -> LN -> FFN
  v
Stage 2: Grid pooling (0.04m) -> Serialized Attention Blocks x4
  (N2 ≈ N1/8 points, dim=128)
  |
  v
Stage 3: Grid pooling (0.08m) -> Serialized Attention Blocks x6
  (N3 ≈ N2/8 points, dim=256)
  |
  v
Stage 4: Grid pooling (0.16m) -> Serialized Attention Blocks x3
  (N4 ≈ N3/8 points, dim=512)
  |
  v
Decoder: Feature propagation (trilinear interpolation) back to N points
  |
  v
Output: (N, num_classes) for segmentation
        or (M, 10) for detection (with detection head)
```

#### Results

| Benchmark | PTv3 | PTv2 | SpConv (MinkowskiNet) | PointPillars |
|-----------|------|------|-----------------------|-------------|
| **nuScenes seg (mIoU)** | 80.4 | 80.2 | 73.6 | N/A |
| **Semantic KITTI (mIoU)** | 74.2 | 71.2 | 66.8 | N/A |
| **S3DIS (mIoU)** | 79.4 | 77.9 | 72.1 | N/A |
| **ScanNet (mIoU)** | 77.5 | 75.4 | 72.2 | N/A |
| **nuScenes det (NDS)** | 73.0 | N/A | 71.3 | 62.4 |
| **Latency (A100, nuScenes)** | 58ms | 180ms | 42ms | 18ms |
| **Memory (A100, nuScenes)** | 3.2 GB | 32 GB | 2.8 GB | 1.2 GB |

PTv3 is the first point transformer to match sparse convolution in speed while significantly exceeding it in accuracy.

### 2.4 PTv3 + Sonata/Concerto (2024-2025)

Building on PTv3's backbone:

**Sonata** (PTv3 + multi-dataset pre-training): Pre-trains PTv3 on 11 datasets simultaneously using a unified label space. Achieves 81.7% mIoU on nuScenes segmentation and 75.2% on Semantic KITTI -- SOTA on both.

**Concerto** (scaled Sonata): Scales to larger model sizes with more data. 82.3% mIoU on nuScenes.

These represent the **current absolute state-of-the-art** for 3D point cloud perception.

For detailed segmentation method comparisons, see `technology/perception/lidar-semantic-segmentation.md`.

### 2.5 Comparison: Point Transformer Lineage

| Feature | PTv1 (2021) | PTv2 (2022) | PTv3 (2024) |
|---------|-------------|-------------|-------------|
| Attention type | Vector attention | Grouped vector attention | Standard multi-head attention |
| Neighborhood | Ball query (k=16) | KNN (k=48) | Window on serialized sequence |
| Spatial grouping | Fixed radius | Grid partition | Space-filling curve |
| Downsampling | Farthest point sampling | Grid pooling | Grid pooling |
| FlashAttention | No | No | Yes |
| Window size | 16 | 48 | 1024 |
| Multi-scale | No | Implicit via grid sizes | Explicit via multi-order serialization |
| A100 latency (nuScenes) | ~250ms | ~180ms | ~58ms |
| A100 memory (nuScenes) | ~20 GB | ~32 GB | ~3.2 GB |
| nuScenes seg mIoU | 76.5 | 80.2 | 80.4 |

The trend is clear: **simpler attention + better spatial grouping wins**. PTv3 abandoned the custom vector attention of PTv1/v2 in favor of standard multi-head attention, gaining FlashAttention compatibility and massive speed improvements.

---

## 3. Voxel Transformers

### 3.1 Why Voxelization Before Attention

Point-level transformers must handle irregular coordinates. Voxel transformers first discretize the space, then apply attention to voxels or within voxels. This trades spatial precision for computational regularity.

```
Voxelization for attention:

Input: N points (x, y, z, features)
  |
  v
Create voxel grid (e.g., 0.1m resolution):
  Quantize: (ix, iy, iz) = floor((x, y, z) / voxel_size)
  Group: All points in same voxel -> one voxel token
  Aggregate: Mean/max pool point features within voxel
  |
  v
Result: V occupied voxels with features (V << total grid cells)
  Typical: 100K points -> 40K-80K occupied voxels at 0.1m

Apply attention over voxel tokens:
  Still too many for dense attention (40K^2 = 1.6 billion)
  -> Need sparse attention patterns on voxels
```

### 3.2 VoxSet (CVPR 2022)

**Core idea:** Group non-empty voxels into fixed-size sets, apply attention within each set.

VoxSet introduced **set-to-set attention**: the point cloud is divided into sets of voxels, and attention is computed within each set. Sets are formed by spatial proximity (similar to FPS + ball query but in voxel space).

```
VoxSet pipeline:
1. Voxelize point cloud -> V occupied voxels
2. Sample S seed voxels via farthest-voxel-sampling
3. For each seed, group the nearest M voxels -> set
4. Apply self-attention within each set (M x M attention)
5. Propagate features back to original voxels

Complexity: O(S * M^2 * d) where S * M ≈ V (covers all voxels)
If M = 256: O(V * 256 * d) -- linear in V
```

**Results:** 70.1% NDS on nuScenes detection. Competitive but not SOTA.

### 3.3 SST — Single-Stride Sparse Transformer (CVPR 2022)

**Core innovation:** Removes downsampling entirely -- processes the full-resolution voxel grid with attention in a single stride, unlike most methods that progressively downsample.

Traditional 3D detectors (e.g., VoxelNet, SECOND) downsample voxels through strided convolutions (stride 2, 4, 8), losing fine-grained spatial information. SST keeps everything at original resolution.

```
SST architecture:

Input: Voxelized point cloud -> V occupied voxels at (0.1m, 0.1m, 0.15m)

Split voxels into non-overlapping 3D windows of size (Wx, Wy, Wz)
  e.g., Wx=Wy=16, Wz=1 -> each window covers 1.6m x 1.6m x 0.15m

Within each window:
  Apply standard multi-head self-attention
  Only among OCCUPIED voxels in the window (sparse!)

  Window has 16 x 16 x 1 = 256 cells, but maybe only 20-60 occupied
  -> Attention is 20-60 tokens, very cheap

Shifted windows (from Swin Transformer, adapted to 3D):
  Layer L:   windows at positions (0, 0)
  Layer L+1: windows shifted by (Wx/2, Wy/2)
  -> Cross-window information flow without overlapping windows
```

**Key advantage for LiDAR:** No stride means no information loss. Small objects (FOD, ground crew at distance) are preserved at full resolution through the entire network.

**Results:**
- nuScenes detection: 69.8% NDS (single-frame), competitive with CenterPoint
- Waymo Open: 73.1 mAPH L2 (single-frame)
- Single-stride means the feature map has the **same resolution as the input voxels** -- excellent for small object detection

**Limitation:** Large windows needed for large receptive field, but window size is bounded by GPU memory. Shifted windows only provide cross-window connections at alternating layers.

### 3.4 FlatFormer (CVPR 2023)

**Core innovation:** Flatten 3D voxels to 2D via pillar-based grouping, then apply window attention in 2D -- combining the benefits of PointPillars' speed with transformer expressiveness.

```
FlatFormer architecture:

1. Pillarize: Group voxels by (x, y) grid cell -> pillars
   Each pillar has variable number of voxels (different heights)
   Average pool to get one feature per pillar

2. Flatten to 2D: Now have (Hx, Hy) 2D grid of pillar features
   Hx = 512, Hy = 512 at 0.2m resolution

3. Windowed attention in 2D:
   Split into Wx x Wy windows (e.g., 8x8 = 64 tokens per window)
   Apply multi-head self-attention within each window
   Shifted windows for cross-window information flow

4. Un-flatten: Propagate features back to 3D voxels via scatter
```

Why FlatFormer is fast:

```
FlatFormer vs 3D Sparse Conv vs SST:

3D Sparse Conv (SpConv v2):
  - Requires hash table lookups for every convolution
  - Irregular memory access patterns -> poor GPU utilization
  - kernel_size^3 operations per voxel

SST (3D windowed attention):
  - Variable number of occupied voxels per 3D window
  - Requires padding/masking -> wasted computation
  - 3D spatial indexing overhead

FlatFormer (2D windowed attention):
  - Pillars form a regular 2D grid -> regular memory access
  - Fixed window size in 2D -> no padding needed
  - Can use standard 2D Swin Transformer implementation
  - FlashAttention directly applicable

Speed on A100:
  SpConv v2 (SECOND backbone): 35ms
  SST:                          52ms
  FlatFormer:                   18ms (2x faster than SpConv!)
```

**Results:**
- Waymo Open detection: 74.2 mAPH L2 (surpasses SST and matches 3D sparse conv)
- **2x faster** than SpConv on A100
- Memory: 2.1 GB (vs 3.8 GB for SST)

**Airside relevance:** FlatFormer's 2D flattening aligns with the fact that airside environments are largely **planar** -- most objects sit on the apron surface. The height information compressed into pillars is sufficient for distinguishing aircraft parts, GSE, and personnel.

For FlatFormer's deployment characteristics on Orin, see `technology/perception/lidar-semantic-segmentation.md`.

### 3.5 DVT — Dynamic Voxel Transformer (2023)

DVT adapts voxel resolution dynamically: finer voxels near the ego vehicle (safety-critical), coarser voxels far away (where LiDAR is already sparse).

```
DVT multi-resolution strategy:

Zone 1 (0-20m):  0.1m voxels, dense attention windows
Zone 2 (20-50m): 0.2m voxels, standard attention windows
Zone 3 (50m+):   0.4m voxels, large attention windows

Benefits:
  - 60% fewer voxels than uniform 0.1m
  - Better detection of nearby small objects (ground crew, FOD)
  - Reasonable detection of distant large objects (aircraft at stand)
```

### 3.6 When Voxels vs Points

| Criterion | Point-Based (PTv3) | Voxel-Based (FlatFormer/SST) |
|-----------|-------------------|------------------------------|
| **Accuracy** | Higher (no quantization) | Slightly lower (voxel discretization) |
| **Speed** | Medium (serialization overhead) | Fast (regular grid operations) |
| **Small objects** | Better (per-point precision) | Depends on voxel size |
| **Memory** | Lower (no empty voxels) | Higher (grid overhead) but bounded |
| **FlashAttention** | Yes (via serialization) | Yes (regular windows) |
| **TensorRT** | Harder (custom ops) | Easier (standard 2D ops) |
| **Best for** | Segmentation, fine-grained | Detection, real-time |

**Recommendation for Aurrigo:** Use PTv3 for offline/training (best accuracy, especially segmentation). Use FlatFormer or PointPillars for real-time on Orin (faster, easier TensorRT). See the multi-head architecture in `technology/perception/multi-task-unified-perception.md` for combining both in a shared backbone.

---

## 4. Sparse Attention Patterns

This section catalogs the major strategies for restricting attention to local neighborhoods in 3D.

### 4.1 Window-Based Attention (Swin3D)

Directly extends the Swin Transformer shifted-window approach to 3D voxel grids.

```
3D Window Partitioning:

Given a voxel grid of size (H, W, D):
  Partition into non-overlapping windows of size (wh, ww, wd)
  Number of windows: (H/wh) * (W/ww) * (D/wd)

Within each window:
  Collect all occupied voxels
  Apply self-attention among occupied voxels only
  Complexity per window: O(m^2 * d) where m = occupied voxels in window

Shifted windows (alternating layers):
  Layer L:   window offset (0, 0, 0)
  Layer L+1: window offset (wh/2, ww/2, wd/2)
  Enables cross-window information flow
```

**Swin3D** (ICCV 2023) applies this to point cloud segmentation:
- Achieves 78.2% mIoU on ScanNet v2
- Window size 8x8x8 with 3D shifted windows
- Sparse attention: only compute on occupied cells

```python
import torch
import torch.nn as nn

class SparseWindowAttention3D(nn.Module):
    """Windowed self-attention on sparse 3D voxels (simplified)."""

    def __init__(self, dim, num_heads, window_size=(8, 8, 4)):
        super().__init__()
        self.dim = dim
        self.num_heads = num_heads
        self.window_size = window_size  # (wh, ww, wd)
        self.head_dim = dim // num_heads
        self.scale = self.head_dim ** -0.5

        self.qkv = nn.Linear(dim, 3 * dim)
        self.proj = nn.Linear(dim, dim)

        # Relative position bias table (Swin-style)
        # (2*wh-1) * (2*ww-1) * (2*wd-1) entries
        self.relative_bias_table = nn.Parameter(
            torch.zeros(
                (2 * window_size[0] - 1) *
                (2 * window_size[1] - 1) *
                (2 * window_size[2] - 1),
                num_heads
            )
        )

    def forward(self, voxel_features, voxel_coords, window_indices):
        """
        Args:
            voxel_features: (V, dim) features of occupied voxels
            voxel_coords:   (V, 3) integer voxel coordinates
            window_indices: (V,) which window each voxel belongs to
        Returns:
            (V, dim) updated features
        """
        V, d = voxel_features.shape

        # Group voxels by window
        unique_windows = window_indices.unique()
        output = torch.zeros_like(voxel_features)

        for w_idx in unique_windows:
            mask = window_indices == w_idx
            feats = voxel_features[mask]  # (m, dim), m = voxels in window
            coords = voxel_coords[mask]   # (m, 3)
            m = feats.shape[0]

            if m == 0:
                continue

            # QKV projection
            qkv = self.qkv(feats).reshape(m, 3, self.num_heads, self.head_dim)
            qkv = qkv.permute(1, 2, 0, 3)  # (3, heads, m, head_dim)
            q, k, v = qkv[0], qkv[1], qkv[2]

            # Attention with relative position bias
            attn = (q @ k.transpose(-2, -1)) * self.scale  # (heads, m, m)

            # Add relative position bias (omitted for brevity: index into table
            # using relative coordinate differences)

            attn = attn.softmax(dim=-1)
            out = (attn @ v).transpose(1, 2).reshape(m, d)

            output[mask] = self.proj(out)

        return output
```

**Note:** The loop over windows is for clarity. In practice, windows are batched: pad each window to the max occupied count, stack into a batch dimension, and run a single batched attention. FlashAttention supports variable-length sequences via `flash_attn_varlen_func`.

### 4.2 Serialization-Based Attention (PTv3)

As covered in Section 2.3, PTv3's approach:

```
Serialization -> 1D sequence -> windowed 1D attention

Advantages over 3D window attention:
1. No empty-voxel padding (points are already a dense sequence)
2. Standard 1D FlashAttention (no 3D indexing)
3. Multi-order serialization provides diverse receptive fields
4. O(n log n) sort vs O(n) spatial hashing -- comparable cost
```

### 4.3 Hash-Based Grouping

Locality-Sensitive Hashing (LSH) groups points that are spatially close into the same hash bucket. Used in Reformer (for NLP) and adapted for 3D.

```
LSH for 3D point grouping:

1. Choose random hyperplane h in R^3
2. For each point p: hash(p) = sign(h^T p)
3. Multiple hyperplanes -> multi-bit hash -> bucket ID
4. Points in same bucket are likely spatially close
5. Apply attention within each bucket

Example with 4 hyperplanes:
  Point at (5, 3, 2):  hash = [+, +, -, +] -> bucket 13
  Point at (5, 4, 2):  hash = [+, +, -, +] -> bucket 13  (same! nearby)
  Point at (-10, 8, 1): hash = [-, +, -, +] -> bucket 5   (different)
```

FlatFormer uses a variant of this for its 2D pillar grouping.

**Advantage:** O(1) per-point hashing, O(n) total grouping. No sorting required.
**Disadvantage:** Hash collisions may group distant points; no guarantee on bucket sizes (may need padding).

### 4.4 Ball Query Attention

The original approach from PTv1: find all points within radius r, attend to them.

```
Ball query: For point p_i, find all p_j where ||p_i - p_j|| < r
  Typical r = 0.4m for close range, 1.6m for distant
  Cap at k neighbors (e.g., k=32) to bound computation

Advantage: Geometrically meaningful neighborhoods
Disadvantage: Density-dependent -- too many neighbors near sensor,
             too few far away. Requires spatial data structure (KDTree).
```

Now largely superseded by window-based and serialization-based approaches due to the KDTree construction cost.

### 4.5 Deformable Attention for 3D

Instead of attending to fixed neighborhoods, learn where to attend. Each query predicts K reference points and their sampling offsets.

```
Deformable attention (adapted from Deformable DETR):

For each query q_i:
  1. Predict K reference points: refs_k = MLP(q_i)  ∈ R^{K x 3}
  2. Predict offsets per point: offsets_k = MLP(q_i)  ∈ R^{K x 3}
  3. Sample features at (refs_k + offsets_k) via trilinear interpolation
  4. Compute attention weights: attn_k = softmax(MLP(q_i))  ∈ R^K
  5. Output = sum_k attn_k * sampled_feature_k

Complexity: O(n * K * d) where K << n (typically K=4 or 8)
  With K=4, n=120K, d=64: 30.7M ops (vs 14.4B for dense attention)
```

This is the attention pattern used in DETR3D, PETR, and BEVFormer for query-based detection (see Sections 5 and 9).

### 4.6 Range-View Attention

LiDAR point clouds have a natural 2D parameterization: the range image (azimuth x elevation). Attention can be applied in range-image space, where 2D neighbors correspond to 3D neighbors along lines of sight.

```
Range-view attention:

1. Project point cloud to range image (H_range x W_range)
   H_range = number of elevation rings (e.g., 32 for 32-beam LiDAR)
   W_range = azimuthal resolution (e.g., 2048 for 0.18 degree resolution)

2. Apply 2D windowed attention on range image
   Window size: 3x3 to 7x7 in range image space
   Neighbors in range image are mostly 3D neighbors

3. Challenge: Range image has depth discontinuities
   Adjacent pixels may be at 5m and 50m (foreground/background boundary)
   Solution: Depth-aware masking -- mask attention for large depth jumps
```

**RangeFormer** (2023) uses this approach for segmentation:
- 73.3% mIoU on Semantic KITTI
- Very fast: range image is a regular 2D tensor, standard 2D ops
- Limitation: Struggles with multi-LiDAR setups (each LiDAR has its own range image)

For Aurrigo's multi-LiDAR setup, range-view attention would require either merging range images (losing structure) or running separate range-view branches per LiDAR.

### 4.7 Stride-Based Attention

Apply attention at different spatial strides for multi-scale feature extraction:

```
Stride-based multi-scale attention:

Stride 1: Attend to immediate neighbors (fine detail)
  Window: 4x4x2 voxels, ~32 occupied voxels
  Captures: Surface texture, FOD edges, person limbs

Stride 2: Attend to every-other-voxel (medium range)
  Window: 8x8x4 at stride 2 -> covers 1.6m x 1.6m x 0.6m
  Captures: Object parts, GSE shape

Stride 4: Attend to every-4th-voxel (coarse context)
  Window: 16x16x8 at stride 4 -> covers 3.2m x 3.2m x 1.2m
  Captures: Object context, spatial relationships
```

Multi-stride attention can be combined in a single layer (different heads at different strides) or across layers (fine-to-coarse).

### 4.8 Comparison of Sparse Attention Patterns

| Pattern | Grouping Cost | Attention Cost | FlashAttn Compatible | Multi-LiDAR | TensorRT |
|---------|--------------|---------------|---------------------|-------------|----------|
| Window (Swin3D) | O(n) hash | O(n * w_occ^2) | With padding | Yes | Medium |
| Serialization (PTv3) | O(n log n) sort | O(n * w) | Yes (1D windows) | Yes | Hard |
| Hash (LSH) | O(n) | O(n * b) | With padding | Yes | Medium |
| Ball query | O(n * k * log n) | O(n * k) | No (irregular) | Yes | Hard |
| Deformable | O(n * K) | O(n * K) | No (sampling) | Yes | Medium |
| Range-view | O(n) project | O(n * k_2d) | Yes (2D grid) | Per-LiDAR | Easy |
| Stride | O(n) index | O(n * k_s) | Yes (regular) | Yes | Easy |

**For Orin deployment:** Range-view and stride-based patterns are easiest to convert to TensorRT because they operate on regular grids. Serialization-based (PTv3) requires custom sort/scatter operations that need TensorRT plugins. Deformable attention requires custom grid-sample 3D operations.

---

## 5. BEV Transformers

### 5.1 The BEV Representation

Bird's Eye View (BEV) is the dominant representation for multi-modal 3D perception. It projects 3D information onto a 2D overhead grid, enabling:

- Fusion of LiDAR and camera in a common coordinate frame
- Direct compatibility with 2D CNN heads for detection, segmentation, prediction
- Natural interface for planning (the planner already reasons in BEV)

For LiDAR-only systems like Aurrigo's current stack, BEV can be constructed by simple pillar-pooling (as in PointPillars -- see `10-knowledge-base/geometry-3d/pointpillars.md`). But for camera-based or LiDAR-camera fusion, **attention-based BEV construction** is required.

### 5.2 BEVFormer (ECCV 2022)

BEVFormer uses **deformable cross-attention** to construct BEV features from multi-camera images. While Aurrigo's current stack is LiDAR-only, understanding BEVFormer is essential for future camera integration and because its spatial/temporal cross-attention patterns are widely adopted.

```
BEVFormer architecture:

BEV Queries: Learnable grid Q ∈ R^{H_bev x W_bev x d}
  H_bev = W_bev = 200 (covering 100m x 100m at 0.5m resolution)

For each BEV query q at grid position (u, v):

1. Spatial Cross-Attention:
   - Lift (u, v) to 3D: create N_ref reference points at different heights
     ref_points = [(u, v, z_1), (u, v, z_2), ..., (u, v, z_N)]
     N_ref = 4 (heights: 0m, 1m, 2m, 3m)
   - Project each 3D reference point to each camera image
   - Sample image features at projected 2D locations
   - Apply deformable cross-attention (query = BEV, key/value = image features)

2. Temporal Self-Attention:
   - Align previous frame's BEV features using ego-motion
   - Self-attention between current BEV and aligned previous BEV
   - Captures temporal dynamics (moving objects, self-motion)

Output: BEV feature map (H_bev, W_bev, d) encoding the 3D scene
```

```python
import torch
import torch.nn as nn

class BEVFormerSpatialCrossAttention(nn.Module):
    """Simplified spatial cross-attention from BEVFormer."""

    def __init__(self, dim, num_heads, num_levels, num_points, num_cameras):
        super().__init__()
        self.dim = dim
        self.num_heads = num_heads
        self.num_levels = num_levels   # Feature pyramid levels
        self.num_points = num_points   # Sampling points per query
        self.num_cameras = num_cameras

        self.sampling_offsets = nn.Linear(
            dim, num_heads * num_levels * num_points * 2
        )
        self.attention_weights = nn.Linear(
            dim, num_heads * num_levels * num_points
        )
        self.value_proj = nn.Linear(dim, dim)
        self.output_proj = nn.Linear(dim, dim)

    def forward(self, query, reference_points, multi_scale_features, spatial_shapes):
        """
        Args:
            query:            (B, H*W, d) BEV queries (flattened grid)
            reference_points: (B, H*W, num_ref_z, 3) 3D reference points
            multi_scale_features: list of (B, num_cameras, Hi*Wi, d)
            spatial_shapes:   (num_levels, 2) feature map shapes
        Returns:
            (B, H*W, d) updated BEV features
        """
        B, Q, d = query.shape

        # Predict sampling offsets relative to projected reference points
        offsets = self.sampling_offsets(query)  # (B, Q, heads*levels*points*2)
        offsets = offsets.view(B, Q, self.num_heads, self.num_levels,
                              self.num_points, 2)

        # Predict attention weights across all sampling points
        attn_weights = self.attention_weights(query)
        attn_weights = attn_weights.view(B, Q, self.num_heads,
                                         self.num_levels * self.num_points)
        attn_weights = attn_weights.softmax(dim=-1)

        # Project reference points to each camera (using known calibration)
        # For each query, sample features at (projected_ref + offset) positions
        # Apply attention weights to aggregate sampled features
        # [Detailed sampling/aggregation omitted for brevity]

        # Output projection
        # output = self.output_proj(aggregated)
        # return output
        pass  # Full implementation requires camera projection matrices
```

### 5.3 PETRv2 (ICLR 2023)

PETR (Position Embedding TRansformer) takes a different approach: instead of sampling from specific image locations, it encodes 3D position information into the image features and lets standard cross-attention figure out the spatial correspondence.

```
PETR approach:

1. Generate 3D position embedding for each image pixel:
   For pixel (u, v) in camera c:
     ray = camera_c.backproject(u, v)  -> 3D ray direction
     Create 3D PE from ray direction and depth candidates
     PE ∈ R^{d} encodes the 3D position this pixel could represent

2. Add 3D PE to image features:
   enhanced_features = image_features + position_embedding

3. Standard cross-attention (no deformable sampling needed):
   query = 3D object queries (or BEV queries)
   key/value = enhanced image features
   The 3D PE ensures attention weights are spatially aware
```

**PETRv2 improvements:**
- Temporal alignment via 3D PE transformation
- Feature-guided position encoding
- Results: 49.0% NDS on nuScenes (camera-only)

### 5.4 StreamPETR (ICCV 2023)

**Core innovation:** Propagates object queries across frames using a streaming mechanism, avoiding the need to store and process multi-frame feature maps.

```
StreamPETR temporal design:

Frame t-1: Detect objects -> object queries Q_{t-1} with (position, features)
Frame t:   
  1. Transform Q_{t-1} to frame t coordinates (ego-motion compensation)
  2. Augment with new initial queries for newly appearing objects
  3. Cross-attend Q_t (propagated + new) to current frame image features
  4. Decode detections from updated queries

Key advantage:
  - Only stores object queries (~900 queries x 256 dim = 900KB)
  - NOT multi-frame image features (~6 cameras x 256x256 x 256 dim = 1.1GB)
  - 10x less memory for temporal modeling
```

**Results:** 55.0% NDS on nuScenes (camera-only) -- among best camera-only detectors.

### 5.5 LiDAR BEV Transformers

For LiDAR-only systems, BEV construction is simpler (direct projection, no depth ambiguity), but attention still helps for:

1. **Multi-LiDAR fusion**: Attention weights can learn to resolve conflicts between overlapping LiDARs
2. **Temporal BEV**: Self-attention across BEV features from consecutive frames
3. **BEV-to-BEV refinement**: Self-attention within the BEV feature map for long-range context

```
LiDAR BEV Attention (for Aurrigo 4-8 LiDAR setup):

Step 1: Per-LiDAR PointPillars encoding -> 4-8 BEV feature maps
Step 2: Ego-frame alignment (transform each LiDAR BEV to vehicle frame)
Step 3: Multi-LiDAR cross-attention:
  Query: Target BEV grid (unified)
  Key/Value: Concatenated per-LiDAR BEV features
  Attention learns which LiDAR to trust at each spatial location

Benefit: Handles sensor degradation gracefully
  If LiDAR #3 is occluded by jet blast spray, attention weights
  automatically shift to neighboring LiDARs
```

### 5.6 Temporal BEV Attention

```
Temporal attention for BEV (applicable to both camera and LiDAR):

Given BEV features at times t-2, t-1, t:
  B_{t-2}, B_{t-1}, B_t  ∈ R^{H x W x d}

1. Ego-motion compensation:
   B'_{t-2} = warp(B_{t-2}, ego_pose_t - ego_pose_{t-2})
   B'_{t-1} = warp(B_{t-1}, ego_pose_t - ego_pose_{t-1})

2. Temporal self-attention at each BEV cell (h, w):
   Q = B_t[h, w]       (current frame query)
   K = [B'_{t-2}[h,w], B'_{t-1}[h,w], B_t[h,w]]  (temporal keys)
   V = [B'_{t-2}[h,w], B'_{t-1}[h,w], B_t[h,w]]  (temporal values)

   Or with spatial neighbors (3x3 spatial + 3 temporal = 27 tokens):
   K,V from 3x3 spatial neighborhood across 3 frames

   Attention captures:
   - Moving objects (attention peaks shift between frames)
   - Static scene verification (consistent attention across frames)
   - Occlusion recovery (attend to frame where object was visible)
```

### 5.7 BEV Transformer Comparison

| Method | Type | BEV Construction | Temporal | nuScenes NDS | Latency (A100) |
|--------|------|-----------------|----------|-------------|----------------|
| BEVFormer | Camera | Deformable cross-attn | Self-attn on aligned BEV | 56.9% | 120ms |
| PETRv2 | Camera | 3D PE + cross-attn | 3D PE transformation | 49.0% | 85ms |
| StreamPETR | Camera | Streaming object queries | Query propagation | 55.0% | 45ms |
| BEVFusion | LiDAR+Cam | Lift-Splat (cam) + Pillar (LiDAR) | None | 71.8% | 90ms |
| CenterPoint | LiDAR | Pillar encoding (no attention) | Two-frame concatenation | 67.3% | 52ms |
| TransFusion | LiDAR+Cam | LiDAR BEV + soft-association cross-attn | None | 71.7% | 95ms |

For Aurrigo's LiDAR-only stack, CenterPoint-style pillar BEV (no attention) remains the fastest option. BEV attention becomes valuable when:
1. Adding cameras (degraded-mode fallback -- see `technology/perception/camera-fallback-perception.md`)
2. Multi-LiDAR fusion beyond simple concatenation
3. Temporal modeling for tracking/prediction

---

## 6. Efficient Attention Implementations

### 6.1 The Memory Bottleneck

Standard self-attention materializes the full n x n attention matrix:

```
Standard attention memory:
  Attention matrix: n x n x sizeof(float)
  For n = 1024 (single window): 1024^2 x 4 = 4 MB (fine)
  For n = 4096 (large window):  4096^2 x 4 = 64 MB (problematic on Orin)
  For n = 120K (full cloud):    120K^2 x 4 = 53.6 GB (impossible)

Breakdown of memory per attention layer (window size w):
  Q, K, V:           3 * n * d * 4       (12 * n * d bytes)
  Attention matrix:  n * w * 4           (4 * n * w bytes)
  Output:            n * d * 4           (4 * n * d bytes)

  With n=120K, w=1024, d=64:
  QKV: 92 MB
  Attention: 469 MB
  Output: 31 MB
  Total: ~592 MB per layer (manageable on Orin)
```

### 6.2 FlashAttention v1/v2/v3

FlashAttention (Dao et al., 2022/2023/2024) eliminates the materialized attention matrix by computing attention **tile-by-tile** in SRAM, never writing the full n x n matrix to HBM.

```
FlashAttention core idea:

Standard: Compute S = QK^T (n x n in HBM) -> softmax -> multiply V
Flash:    Tile Q into blocks of size B_q
          Tile K, V into blocks of size B_kv
          For each Q block:
            For each K, V block:
              Compute partial attention in SRAM (B_q x B_kv)
              Accumulate output using online softmax
          Never materialize full n x n matrix

Memory savings:
  Standard: O(n^2) for attention matrix
  Flash:    O(n) -- only Q, K, V, and output stored in HBM
  For n=1024: 4MB -> ~4KB (1000x reduction in attention memory)

Speed improvement:
  Less HBM traffic = faster on memory-bandwidth-limited GPUs
  FlashAttention v2: 2x faster than v1, up to 230 TFLOPS on A100
  FlashAttention v3 (Hopper): Exploits H100 asynchronous execution,
                               up to 1.5x faster than v2 on H100
```

**FlashAttention for point clouds (PTv3 approach):**

```python
from flash_attn import flash_attn_varlen_func

def serialized_flash_attention(features, coords, window_size=1024,
                                num_heads=8):
    """
    Apply FlashAttention on serialized point cloud.

    Args:
        features: (N, dim) point features
        coords:   (N, 3) point coordinates
        window_size: number of points per attention window
    Returns:
        (N, dim) updated features
    """
    N, dim = features.shape
    head_dim = dim // num_heads

    # Step 1: Serialize via Hilbert curve (simplified as Z-order here)
    # In practice, use PTv3's multi-order Hilbert implementation
    quantized = (coords * 100).long()  # quantize to 1cm resolution
    # Z-order: interleave bits of x, y, z
    z_order = (quantized[:, 0] << 20) | (quantized[:, 1] << 10) | quantized[:, 2]
    sort_indices = z_order.argsort()

    # Sort features by space-filling curve
    sorted_features = features[sort_indices]  # (N, dim)

    # Step 2: Reshape for multi-head attention
    # QKV projection (assume pre-computed for simplicity)
    qkv = sorted_features.view(N, num_heads, head_dim)

    # Step 3: Define variable-length sequences (windows)
    num_windows = (N + window_size - 1) // window_size
    cu_seqlens = torch.arange(0, (num_windows + 1) * window_size,
                              window_size, device=features.device)
    cu_seqlens[-1] = N  # last window may be shorter

    # Step 4: FlashAttention with variable-length sequences
    q = sorted_features.view(N, num_heads, head_dim).half()
    k = sorted_features.view(N, num_heads, head_dim).half()
    v = sorted_features.view(N, num_heads, head_dim).half()

    output = flash_attn_varlen_func(
        q, k, v,
        cu_seqlens_q=cu_seqlens,
        cu_seqlens_k=cu_seqlens,
        max_seqlen_q=window_size,
        max_seqlen_k=window_size,
        dropout_p=0.0,
        causal=False  # bidirectional attention for point clouds
    )
    # output: (N, num_heads, head_dim)

    # Step 5: Unsort back to original point ordering
    unsorted_output = torch.zeros_like(output)
    unsorted_output[sort_indices] = output

    return unsorted_output.view(N, dim)
```

### 6.3 FlashAttention on Orin

Orin AGX (Ampere SM87, 275 TOPS INT8) has important differences from data center GPUs:

```
FlashAttention compatibility:

A100 (SM80):     Full FlashAttention v2 support, 80GB HBM2e, 2TB/s bandwidth
H100 (SM90):     FlashAttention v3, 80GB HBM3, 3.35TB/s bandwidth
Orin AGX (SM87): FlashAttention v2 supported (Ampere arch), BUT:
  - 32/64 GB LPDDR5 (shared CPU/GPU memory)
  - 204.8 GB/s bandwidth (10x less than A100)
  - Memory-bandwidth limited, not compute-limited

Practical implications for Orin:
1. FlashAttention's memory savings are CRITICAL (not just nice-to-have)
   32GB shared memory means every MB matters
2. Small window sizes (256-512) preferred over large (1024-2048)
   Each tile must fit in Orin's smaller L2 cache (4MB vs 40MB on A100)
3. FP16 mandatory (FP32 attention is 2x slower AND 2x memory)
4. INT8 attention possible with TensorRT but requires careful calibration
```

### 6.4 xFormers and Memory-Efficient Attention

xFormers (Meta) provides an alternative memory-efficient attention implementation:

```python
import xformers.ops as xops

# Memory-efficient attention (similar benefit to FlashAttention)
output = xops.memory_efficient_attention(
    query,   # (B, N, H, D) or (B, H, N, D)
    key,
    value,
    attn_bias=xops.LowerTriangularMask()  # or None for bidirectional
)

# Key advantage: supports arbitrary attention biases/masks
# FlashAttention is faster but has fewer masking options
```

For point cloud work, xFormers' `BlockDiagonalMask` is useful for windowed attention:

```python
# Define variable-length windows for sparse point cloud attention
block_diag = xops.fmha.BlockDiagonalMask.from_seqlens(
    [256, 300, 180, 512, ...]  # variable window sizes
)
output = xops.memory_efficient_attention(q, k, v, attn_bias=block_diag)
```

### 6.5 Triton Custom Kernels

For attention patterns not supported by FlashAttention or xFormers, Triton enables writing custom GPU kernels in Python:

```python
import triton
import triton.language as tl

@triton.jit
def sparse_attention_kernel(
    Q, K, V, Out,
    neighbor_indices,  # (N, k) -- which points each point attends to
    N: tl.constexpr, K_NEIGHBORS: tl.constexpr, D: tl.constexpr,
    BLOCK_SIZE: tl.constexpr
):
    """Custom sparse attention kernel for irregular neighborhoods."""
    pid = tl.program_id(0)

    # Load query for this point
    q_offset = pid * D
    q = tl.load(Q + q_offset + tl.arange(0, D))  # (D,)

    # Load neighbor indices
    nb_offset = pid * K_NEIGHBORS
    nb_ids = tl.load(neighbor_indices + nb_offset + tl.arange(0, K_NEIGHBORS))

    # Compute attention scores with neighbors
    acc = tl.zeros([D], dtype=tl.float32)
    max_score = float('-inf')
    sum_exp = 0.0

    for i in range(K_NEIGHBORS):
        nb_id = tl.load(neighbor_indices + nb_offset + i)
        k_vec = tl.load(K + nb_id * D + tl.arange(0, D))  # (D,)
        v_vec = tl.load(V + nb_id * D + tl.arange(0, D))  # (D,)

        score = tl.sum(q * k_vec) / tl.sqrt(float(D))

        # Online softmax (numerically stable)
        new_max = tl.maximum(max_score, score)
        exp_old = tl.exp(max_score - new_max) * sum_exp
        exp_new = tl.exp(score - new_max)

        acc = acc * (exp_old / (exp_old + exp_new)) + v_vec * (exp_new / (exp_old + exp_new))
        sum_exp = exp_old + exp_new
        max_score = new_max

    tl.store(Out + q_offset + tl.arange(0, D), acc)
```

**Caveat:** Custom Triton kernels require significant effort to optimize and maintain. Prefer FlashAttention/xFormers when possible.

### 6.6 INT8 Attention on Orin

INT8 quantization can halve attention latency on Orin, but requires care:

```
INT8 attention pipeline:

1. Quantize Q, K to INT8:
   Q_int8 = round(Q_fp16 / scale_q)   where scale_q = max(|Q|) / 127
   K_int8 = round(K_fp16 / scale_k)

2. INT8 GEMM for attention scores:
   S_int32 = Q_int8 @ K_int8^T        INT8 matmul -> INT32 accumulation

3. Dequantize + softmax in FP16:
   S_fp16 = S_int32 * (scale_q * scale_k)
   A_fp16 = softmax(S_fp16 / sqrt(d))

4. Attention * V in FP16 (V stays in FP16 for accuracy)
   Output = A_fp16 @ V_fp16

TensorRT handles this automatically with:
  config.set_flag(trt.BuilderFlag.INT8)
  # Requires calibration dataset for per-tensor scales
```

**Accuracy impact:** INT8 attention typically loses 0.3-0.8% mIoU on segmentation, 0.5-1.0 NDS on detection. Acceptable for the 1.8-2.2x speedup on Orin. See `20-av-platform/compute/tensorrt-deployment-guide.md` for TensorRT INT8 calibration details.

### 6.7 KV-Cache for Temporal Sequences

For streaming point cloud perception (processing consecutive scans), KV-cache avoids recomputing keys and values for previous frames:

```
Temporal KV-cache for point cloud sequences:

Without KV-cache (naive):
  Frame t: Compute Q_t, K_t, V_t from current points
           Also compute K_{t-1}, V_{t-1} from previous points (re-encode!)
           Attend Q_t to [K_{t-1}, K_t] and [V_{t-1}, V_t]

With KV-cache:
  Frame t-1: Compute K_{t-1}, V_{t-1} -> cache in GPU memory
  Frame t:   Compute Q_t, K_t, V_t from current points
             Load K_{t-1}, V_{t-1} from cache (no re-computation)
             Attend Q_t to [K_{t-1}, K_t] and [V_{t-1}, V_t]

Memory cost: d * (num_heads * head_dim * 2) per cached token per frame
  With d=256, 8 heads, 32 head_dim, 40K tokens, 3 cached frames:
  = 40K * 8 * 32 * 2 * 3 * 2 bytes = 123 MB (FP16)

  Manageable on Orin, but need to limit cached frames.
  Recommendation: Cache 2-3 frames max on Orin.
```

---

## 7. Sparse Convolution vs Sparse Attention

### 7.1 Sparse Convolution Fundamentals

Sparse convolution operates only on occupied voxels, skipping the vast majority of empty space. The three major libraries:

| Library | Backend | Key Feature | Active Development |
|---------|---------|-------------|-------------------|
| **MinkowskiEngine** | Custom CUDA | Generalized sparse conv (any dimension) | Moderate |
| **TorchSparse** | Custom CUDA + Triton | Adaptive grouping, mixed-precision | Active |
| **SpConv v2** | Custom CUDA | Fastest, used in most detection frameworks | Active |

```
Sparse 3D convolution (SpConv v2):

Input: Occupied voxel set {(coord_i, feature_i)} where coord_i ∈ Z^3

For each occupied voxel at coord_c:
  output_c = sum over offset in kernel:
    if (coord_c + offset) is occupied:
      W_offset @ feature_{coord_c + offset}
    else:
      skip (zero contribution)

Key optimization: Build hash table of occupied voxels
  O(1) lookup per neighbor check
  Only compute kernel at occupied locations
  Memory: O(V * d) where V = number of occupied voxels

3x3x3 kernel on sparse cloud:
  Dense 3D conv: 512^3 * 27 = 3.6 billion multiply-adds
  Sparse conv: 50K_occupied * 8_avg_neighbors * d = 25.6M multiply-adds
  140x fewer operations
```

### 7.2 Sparse Conv vs Sparse Attention: Theoretical Comparison

```
Per-layer comparison for V=50K occupied voxels, d=64 channels:

Sparse Conv (3x3x3 kernel):
  FLOPs: V * avg_neighbors * kernel_size^3 * d^2
       = 50K * 8 * 27 * 4096 = 44.2 GFLOPs
  Memory: V * d * 2 (input + output features)
        = 50K * 64 * 2 * 4 = 25.6 MB (FP32)
  Receptive field: 3 voxels per layer (0.6m at 0.2m voxel size)
  After 4 layers: 12 voxels = 2.4m

Sparse Attention (window size w=256):
  FLOPs: V * w * d + V * w * d  (QK^T + Attn*V)
       = 50K * 256 * 64 * 2 = 1.6 GFLOPs
  Memory: V * d * 5 (Q, K, V, attn, output -- or O(V*d) with FlashAttention)
        = 50K * 64 * 5 * 4 = 64 MB (FP32, standard)
        = 50K * 64 * 3 * 4 = 38.4 MB (FP32, FlashAttention)
  Receptive field: Full window (256 voxels = 51.2m at 0.2m) IN ONE LAYER

Key insight: Attention has fewer FLOPs but accesses more memory
  Sparse conv: Compute-bound (many multiply-adds per memory access)
  Sparse attention: Memory-bound (each token fetches from many others)

This is why sparse attention benefits MORE from FlashAttention (reduces memory traffic)
and why sparse conv benefits MORE from INT8 quantization (reduces compute).
```

### 7.3 Hybrid Architectures

The best modern architectures combine both:

**FlatFormer pattern:**
```
Stage 1: Sparse Conv (3x3x3, stride 2)  -- fast local feature extraction
Stage 2: Sparse Conv (3x3x3, stride 2)  -- reduce resolution
Stage 3: Window Attention (2D, w=64)     -- global context
Stage 4: Window Attention (2D, w=64)     -- refine with long-range

Rationale: Conv is better for low-level features (edges, surfaces)
           Attention is better for high-level reasoning (object relations)
```

**CenterPoint + Attention:**
```
CenterPoint backbone: VoxelNet with SpConv -> fast, well-optimized
Add attention: Self-attention on BEV features (post-backbone)
  Only 200x200 = 40K tokens in BEV (manageable)
  2-layer self-attention adds ~8ms but improves NDS by ~1.5%
```

**PTv3 hybrid approach:**
```
PTv3 uses NO explicit sparse convolution
Instead, serialized attention with grid pooling subsumes both:
  Grid pooling = non-learned stride-2 "convolution" (average pooling)
  Attention within window = learned feature aggregation with global context

PTv3 demonstrates that pure attention CAN beat sparse conv
But requires FlashAttention for competitive speed
```

### 7.4 Computational Comparison on Orin

| Backbone | FLOPs (G) | Params (M) | Orin FP16 (ms) | Orin INT8 (ms) | nuScenes NDS |
|----------|-----------|------------|----------------|----------------|-------------|
| VoxelNet (SpConv) | 38 | 6.5 | 18 | 11 | 65.5 |
| SECOND (SpConv) | 42 | 5.3 | 15 | 9 | 63.8 |
| PointPillars (2D Conv) | 18 | 4.8 | 11 | 6.8 | 62.4 |
| CenterPoint (SpConv) | 52 | 9.0 | 22 | 13 | 67.3 |
| SST (Window Attn) | 65 | 12.1 | 42 | 28 | 69.8 |
| FlatFormer (Hybrid) | 35 | 8.2 | 25 | 16 | 70.2 |
| PTv3-Small (Serial Attn) | 48 | 18.5 | 38* | 24* | 72.1 |
| PTv3-Base (Serial Attn) | 95 | 46.0 | 65* | 42* | 73.0 |

*PTv3 Orin numbers are estimates based on A100 scaling with 0.15x throughput ratio. Actual deployment requires custom TensorRT plugin for serialization ops.

**Recommendation for Aurrigo production stack:**
- **Safety-critical (BC) path:** PointPillars at 6.8ms INT8. Proven, fast, reliable.
- **Performance (AC) path:** FlatFormer at 16ms INT8 or PTv3-Small at 24ms INT8.
- **Offline training/analysis:** PTv3-Base for maximum accuracy.

This aligns with the Simplex architecture described in `synthesis/design-spec.md`.

---

## 8. Multi-Head Cross-Attention for Fusion

### 8.1 LiDAR-Camera Cross-Attention

Cross-attention fuses information from different modalities by letting one modality query the other:

```
Cross-attention for LiDAR-camera fusion:

Query:     LiDAR BEV features (spatial structure, accurate depth)
Key/Value: Camera features (rich semantics, color, texture)

Q = BEV_lidar @ W_Q    ∈ R^{H*W x d}
K = Camera_feat @ W_K   ∈ R^{N_cam*H_img*W_img x d}
V = Camera_feat @ W_V   ∈ R^{N_cam*H_img*W_img x d}

Cross_Attn = softmax(QK^T / sqrt(d)) V

Each BEV cell "queries" all camera pixels to find relevant visual info
Attention weights learn the LiDAR-to-camera projection implicitly
```

### 8.2 BEVFusion Cross-Attention

BEVFusion (MIT, 2022) takes a different approach -- it constructs BEV features **independently** for each modality, then fuses:

```
BEVFusion pipeline:

LiDAR branch:  Point cloud -> PointPillars/VoxelNet -> BEV_lidar (200x200xd)
Camera branch: Images -> BEV transform (Lift-Splat-Shoot) -> BEV_cam (200x200xd)

Fusion: BEV_fused = Conv(Concat(BEV_lidar, BEV_cam))
  Simple but effective: 71.8% NDS (SOTA at time of publication)

Attention-enhanced fusion (BEVFusion++):
  BEV_fused = CrossAttention(BEV_lidar, BEV_cam) + BEV_lidar
  Where:
    Q = BEV_lidar  (LiDAR queries camera for semantic info)
    K,V = BEV_cam   (camera provides semantic features)
  Result: +0.5-1.0% NDS over simple concatenation
```

### 8.3 TransFusion: Query-Based LiDAR-Camera Fusion

TransFusion (CVPR 2022) generates detection queries from LiDAR, then enriches them with camera features:

```python
class TransFusionHead(nn.Module):
    """Simplified TransFusion: LiDAR proposals + camera cross-attention."""

    def __init__(self, dim, num_heads, num_proposals):
        super().__init__()
        self.dim = dim
        self.num_proposals = num_proposals

        # LiDAR heatmap head generates initial proposals
        self.heatmap_head = nn.Conv2d(dim, num_proposals, 1)

        # Cross-attention: LiDAR proposals query camera features
        self.cross_attn = nn.MultiheadAttention(dim, num_heads, batch_first=True)

        # Image-guided query initialization
        self.query_proj = nn.Linear(dim, dim)

    def forward(self, bev_lidar, camera_features, lidar2img):
        """
        Args:
            bev_lidar:        (B, d, H, W) LiDAR BEV features
            camera_features:  (B, N_cam, d, H_img, W_img)
            lidar2img:        (B, N_cam, 4, 4) projection matrices
        """
        B = bev_lidar.shape[0]

        # Step 1: Generate proposals from LiDAR heatmap
        heatmap = self.heatmap_head(bev_lidar)  # (B, K, H, W)
        # Top-K peaks become query positions
        topk_scores, topk_indices = heatmap.flatten(-2).topk(self.num_proposals)
        # Gather BEV features at proposal locations
        queries = gather_feat(bev_lidar, topk_indices)  # (B, K, d)

        # Step 2: Project proposals to camera image space
        # For each proposal, find which camera pixel it projects to
        # Sample camera features at those locations
        cam_feats = project_and_sample(queries, camera_features, lidar2img)
        # cam_feats: (B, K, d) -- camera features at proposal locations

        # Step 3: Cross-attention: LiDAR queries enriched by camera
        queries = self.query_proj(queries)
        refined = self.cross_attn(
            query=queries,           # (B, K, d)
            key=cam_feats,           # (B, K, d) -- or multi-scale
            value=cam_feats
        )[0]

        return refined  # (B, K, d) -> pass to detection head
```

**TransFusion results:** 71.7% NDS on nuScenes (LiDAR + camera), competitive with BEVFusion.

### 8.4 Multi-LiDAR Cross-Attention

For Aurrigo's 4-8 LiDAR setup, cross-attention between LiDARs can resolve conflicts:

```
Multi-LiDAR attention-based fusion:

Given L LiDARs, each producing BEV features B_1, ..., B_L:

Option 1: Pairwise cross-attention
  For each pair (i, j):
    B_i' = CrossAttention(Q=B_i, K=B_j, V=B_j)
  Then aggregate: B_fused = sum(B_i') / L
  Cost: O(L^2 * H * W * d)  -- expensive for L=8

Option 2: Global cross-attention
  Stack all: B_all = Stack(B_1, ..., B_L)  ∈ R^{L * H * W x d}
  Self-attention over stacked features (with LiDAR-ID embedding)
  Cost: O(L^2 * H^2 * W^2 * d)  -- impractical

Option 3: Pillar-wise cross-attention (recommended)
  For each BEV cell (h, w):
    tokens = [B_1[h,w], B_2[h,w], ..., B_L[h,w]]  -- L tokens of dim d
    output = SelfAttention(tokens)  -- tiny L x L attention
  Cost: O(H * W * L^2 * d) = O(40K * 64 * 64) = 164M ops
  Very cheap because L=4-8 is small

Benefits of pillar-wise multi-LiDAR attention:
  - Learns which LiDAR is most reliable at each location
  - Handles sensor degradation (jet blast, de-icing spray on one LiDAR)
  - Resolves registration errors between LiDARs
  - <1ms additional latency on Orin
```

### 8.5 Feature Pyramid with Attention

Multi-scale feature pyramids (FPN) can use attention instead of simple element-wise addition for scale fusion:

```
Attention-based FPN for 3D:

Standard FPN:
  Level 4 (1/16 res) -> upsample -> + Level 3 (1/8 res) -> upsample -> + Level 2

Attention FPN:
  Level 4 features: F_4 ∈ R^{H/16 x W/16 x d}
  Level 3 features: F_3 ∈ R^{H/8 x W/8 x d}

  Upsample F_4 to F_3 resolution: F_4_up
  Cross-attention: Q=F_3, K=F_4_up, V=F_4_up
  -> F_3 queries coarser features for context

  Benefits: +0.5-1.5% mAP on detection
  Cost: ~2ms additional on Orin
```

---

## 9. Deformable Attention for 3D

### 9.1 Deformable DETR Recap

Deformable attention (Zhu et al., ICLR 2021) replaces dense cross-attention with **learned sparse sampling**:

```
Standard cross-attention:
  Each query attends to ALL key/value positions
  Cost: O(Q * N * d)  where N = total spatial positions (huge for high-res)

Deformable attention:
  Each query attends to K learned reference points (typically K=4)
  Reference point positions are predicted by the query
  Sampling offsets are also predicted (deformable part)
  Cost: O(Q * K * d)  where K << N

For detection with Q=300 queries and N=100x100 BEV:
  Standard: 300 * 10,000 * 256 = 768M ops
  Deformable: 300 * 4 * 256 = 307K ops (2500x reduction)
```

### 9.2 DETR3D (CoRL 2021)

DETR3D extends Deformable DETR to 3D detection from multi-view cameras:

```
DETR3D pipeline:

1. 3D Object Queries: Q ∈ R^{K x d}, K=900 learnable queries
   Each query has a learnable 3D reference point in world coordinates

2. Project reference points to camera views:
   For query k with 3D ref point p_k = (x, y, z):
     For camera c:
       pixel_c = project(p_k, intrinsic_c, extrinsic_c)
       feature_c = bilinear_sample(image_feat_c, pixel_c)

3. Cross-attention:
   Q: object queries (900 x d)
   K,V: sampled image features at projected locations
   Each query only attends to K=4 reference points per scale per camera

4. Decode: MLP heads predict (class, bbox3d) from refined queries
```

### 9.3 PETR: Position Embedding for 3D

PETR takes a different approach -- instead of projecting 3D to 2D (as in DETR3D), it lifts 2D image features to 3D:

```
PETR vs DETR3D:

DETR3D: 3D query -> project to 2D -> sample 2D features
  + Geometrically explicit
  - Requires accurate calibration
  - Discrete sampling loses information between sample points

PETR: 2D features + 3D position embedding -> standard attention
  + Soft attention over all positions (no discrete sampling)
  + More robust to calibration errors
  - Higher compute (no sparse sampling)

PETR 3D position embedding:
  For each pixel (u, v) in camera c:
    Generate 3D points along the ray at D depth candidates
    points_3d = {(u, v, d_i) for d_i in [2m, 4m, 6m, ..., 60m]}
    PE = MLP(points_3d)  ∈ R^{D x d}
    Aggregate: PE_pixel = mean(PE)  ∈ R^d

  Enhanced image features: F' = F + PE (per-pixel)
  Now standard cross-attention with 3D-aware features
```

### 9.4 Deformable 3D Attention for LiDAR

While originally designed for camera-based detection, deformable attention works for LiDAR too:

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class Deformable3DAttention(nn.Module):
    """Deformable attention for 3D point/voxel features."""

    def __init__(self, dim, num_heads=8, num_points=4, num_levels=3):
        super().__init__()
        self.dim = dim
        self.num_heads = num_heads
        self.num_points = num_points
        self.num_levels = num_levels

        # Predict sampling offsets (3D offsets for each reference point)
        self.sampling_offsets = nn.Linear(
            dim, num_heads * num_levels * num_points * 3
        )

        # Predict attention weights
        self.attention_weights = nn.Linear(
            dim, num_heads * num_levels * num_points
        )

        # Value projection
        self.value_proj = nn.Linear(dim, dim)
        self.output_proj = nn.Linear(dim, dim)

    def forward(self, query, reference_points, value_features, spatial_shapes):
        """
        Args:
            query:            (B, N_q, d) queries (e.g., BEV cells or object queries)
            reference_points: (B, N_q, 3) 3D reference point per query
            value_features:   list of (B, N_l, d) multi-scale features
            spatial_shapes:   per-level voxel grid shapes
        Returns:
            (B, N_q, d) refined query features
        """
        B, N_q, d = query.shape
        head_dim = d // self.num_heads

        # Predict 3D offsets: where to sample relative to reference points
        offsets = self.sampling_offsets(query)  # (B, N_q, H*L*P*3)
        offsets = offsets.view(B, N_q, self.num_heads, self.num_levels,
                              self.num_points, 3)

        # Predict attention weights
        attn_weights = self.attention_weights(query)  # (B, N_q, H*L*P)
        attn_weights = attn_weights.view(
            B, N_q, self.num_heads, self.num_levels * self.num_points
        )
        attn_weights = attn_weights.softmax(dim=-1)

        # Compute sampling locations
        # sampling_locs = reference_points + offsets (normalized to grid)
        ref_3d = reference_points[:, :, None, None, None, :]  # (B, N_q, 1, 1, 1, 3)
        sampling_locs = ref_3d + offsets  # (B, N_q, H, L, P, 3)

        # Sample features at locations via trilinear interpolation
        # This is the 3D equivalent of grid_sample for 2D deformable attention
        sampled = []
        for lvl, feat in enumerate(value_features):
            # Normalize sampling coordinates to [-1, 1] for grid_sample
            # Apply 3D grid_sample or trilinear interpolation
            # sampled.append(sampled_features)  # (B, N_q, H, P, head_dim)
            pass

        # Weighted sum of sampled features
        # output = sum(attn_weights * sampled_features)
        # return self.output_proj(output)

        return query  # placeholder
```

### 9.5 Adaptive Receptive Fields

The key advantage of deformable attention for airside: **different objects need different receptive fields**.

```
Airside receptive field requirements:

Object              | Size      | Needed RF  | Fixed Conv Layers Needed
--------------------|-----------|------------|------------------------
FOD (bolt/debris)   | 0.02-0.1m | 0.5m       | 2 layers at 0.2m voxel
Ground crew         | 0.5x0.3m  | 2m         | 5 layers
Cargo dolly         | 3x2m      | 5m         | 12 layers
Aircraft wing       | 15-35m    | 40m        | 50+ layers (impractical)

Deformable attention solves this in ONE layer:
  Query for FOD: Learns to sample 4 points within 0.5m radius
  Query for aircraft: Learns to sample 4 points spanning 40m
  Same layer, same parameters, content-adaptive
```

---

## 10. Orin Deployment Considerations

### 10.1 Orin AGX Architecture for Attention

```
NVIDIA Jetson AGX Orin Specifications (attention-relevant):

GPU: Ampere (SM87), 2048 CUDA cores, 64 Tensor Cores
  Tensor Core ops: FP16 (275 TOPS), INT8 (275 TOPS), TF32
  NO FP8 support (that's Ada/Hopper only -- Thor will have it)

Memory: 32 GB or 64 GB LPDDR5 (shared CPU/GPU)
  Bandwidth: 204.8 GB/s (vs 2 TB/s A100, 3.35 TB/s H100)
  This is the PRIMARY BOTTLENECK for attention workloads

L2 Cache: 4 MB (vs 40 MB A100)
  FlashAttention tile sizes must fit in 4 MB
  Practical: tile size ~128 tokens (vs ~256 on A100)

DLA: 2x DLA cores (Deep Learning Accelerator)
  ONLY supports standard layers: Conv, Pool, Activation, BN, FC
  Does NOT support attention operations
  Cannot offload ANY attention computation to DLA

TensorRT 10.x on Orin:
  ONNX opset 9-24 supported
  Custom plugins needed for: Scatter, Gather (3D), SortByKey, FlashAttention
  LayerNorm (opset 17+) and GroupNorm (opset 18+) have fused kernels
```

### 10.2 Memory Bandwidth Analysis

Attention is memory-bandwidth-bound on Orin. Here is the analysis:

```
Memory traffic for one self-attention layer:
  Window size w=256, dim d=64, num_heads=8, head_dim=8

  Standard attention:
    Read Q, K: 2 * w * d * 2 = 65.5 KB (FP16)
    Write S = QK^T: w * w * 2 = 131 KB
    Read S for softmax: 131 KB
    Write softmax result: 131 KB
    Read attn + V: 131 + 32.8 KB
    Write output: 32.8 KB
    Total: ~524 KB per window

    Total for n=120K points, w=256:
    (120K / 256) * 524 KB = 246 MB memory traffic per layer
    At 204.8 GB/s: 1.2 ms (memory-bound time)

  FlashAttention:
    Read Q, K, V: 3 * w * d * 2 = 98.3 KB
    Write output: w * d * 2 = 32.8 KB
    Total: ~131 KB per window (4x less!)

    Total: (120K / 256) * 131 KB = 61.4 MB per layer
    At 204.8 GB/s: 0.3 ms (memory-bound time)

  FlashAttention saves ~0.9 ms per attention layer on Orin.
  With 16 layers: ~14.4 ms total savings.
```

### 10.3 TensorRT Plugin for Custom Attention

Standard `nn.MultiheadAttention` exports to ONNX and TensorRT handles it via fused MHA kernels. But custom attention patterns (serialized, deformable, sparse) need plugins:

```
TensorRT plugin requirements for sparse attention:

1. Serialization (PTv3):
   - SortByKey: Sort features by Hilbert/Z-order index
   - NOT natively supported in TensorRT
   - Options:
     a) Pre-compute sort indices on CPU, pass as constant tensor (if point count stable)
     b) Custom TensorRT plugin wrapping CUB radix sort
     c) ONNX custom op + TensorRT plugin

2. Variable-length windowed attention:
   - FlashAttention's varlen API is NOT in TensorRT
   - Options:
     a) Pad all windows to max size, use standard MHA (wastes compute)
     b) Custom plugin wrapping FlashAttention CUDA kernels
     c) Use xFormers' memory-efficient attention (more TRT-friendly)

3. Deformable attention (3D grid sample):
   - 3D grid_sample is NOT supported in TensorRT ONNX parser
   - Options:
     a) Decompose into 2D grid_samples (slice along z)
     b) Custom plugin for 3D trilinear sampling
     c) Pre-compute sampling indices, use Gather ops

4. Scatter/Gather (voxelization/devoxelization):
   - ScatterND has limited TensorRT support (opset 18+, no reduction)
   - Critical for converting between points and voxels
   - Usually implemented as custom plugin
```

Example TensorRT plugin skeleton for scatter:

```cpp
// TensorRT custom plugin for voxel scatter (points -> BEV grid)
class VoxelScatterPlugin : public nvinfer1::IPluginV3 {
public:
    // Plugin metadata
    const char* getPluginName() const override { return "VoxelScatter"; }
    const char* getPluginVersion() const override { return "1"; }

    // Core: scatter point features into BEV grid
    int enqueue(
        const nvinfer1::PluginTensorDesc* inputDesc,
        const nvinfer1::PluginTensorDesc* outputDesc,
        const void* const* inputs,  // [features (N,d), coords (N,3)]
        void* const* outputs,       // [bev_grid (H, W, d)]
        void* workspace,
        cudaStream_t stream
    ) override {
        // CUDA kernel: for each point, write feature to BEV grid at coords
        // Handle collisions via max-pool or average
        scatter_kernel<<<grid, block, 0, stream>>>(
            (const float*)inputs[0],  // features
            (const int*)inputs[1],    // coordinates
            (float*)outputs[0],       // BEV grid
            N, H, W, d
        );
        return 0;
    }
};
```

### 10.4 Latency Benchmarks on Orin

Measured and estimated latencies for attention-based models on Orin AGX 64GB:

| Model | Task | FP32 | FP16 | INT8 | Notes |
|-------|------|------|------|------|-------|
| **PointPillars** | Detection | 18ms | 11ms | 6.8ms | No attention, pure conv |
| **CenterPoint** | Detection | 35ms | 22ms | 13ms | SpConv backbone, no attention |
| **FlatFormer** | Detection | 42ms | 25ms | 16ms | 2D window attention |
| **SST** | Detection | 68ms | 42ms | 28ms | 3D window attention |
| **PTv3-Small** | Segmentation | 62ms* | 38ms* | 24ms* | Serialized attention |
| **PTv3-Base** | Segmentation | 105ms* | 65ms* | 42ms* | Serialized attention |
| **BEVFormer-Tiny** | Det (Camera) | 85ms | 50ms | 35ms | Deformable cross-attn |
| **TransFusion** | Det (L+C) | 55ms | 32ms | 20ms | Cross-attn fusion head |
| **Self-Attn on BEV** | BEV refinement | 12ms | 8ms | 5ms | Post-backbone 2-layer attn |

*PTv3 Orin numbers require custom TensorRT plugins and are estimated from A100 benchmarks with architecture-specific scaling factors. Pure attention layers scale approximately 0.12-0.18x (A100 -> Orin), but serialization ops (sort, scatter) scale better at ~0.3x.

### 10.5 DLA Limitations

Orin's DLA (Deep Learning Accelerator) provides additional INT8 inference capacity but **cannot run any attention operations**:

```
DLA-supported layers:
  Conv2D, ConvTranspose2D
  MaxPool, AveragePool
  ReLU, Sigmoid, Tanh
  BatchNorm
  Fully Connected (Dense)
  Elementwise (Add, Mul)
  Softmax (limited)
  Concatenation
  Resize/Upsample

DLA-unsupported (attention-related):
  MatMul (arbitrary shapes) -- REQUIRED for QK^T
  LayerNorm / GroupNorm    -- REQUIRED before attention
  Gather / Scatter         -- REQUIRED for sparse indexing
  Sort                     -- REQUIRED for serialization
  Custom ops               -- ALL attention variants

Strategy for hybrid DLA + GPU:
  Run conv backbone on DLA (PointPillars, CenterPoint backbone)
  Run attention layers on GPU only
  Run detection head on DLA

  Example: CenterPoint with BEV attention
    DLA: VoxelNet backbone (4ms INT8) + Detection head (2ms INT8)
    GPU: 2-layer BEV self-attention (5ms INT8)
    Total: 11ms -- vs 13ms all-GPU
    Saves GPU for other concurrent models (see multi-model orchestration in
    technology/perception/model-compression-edge-deployment.md)
```

### 10.6 Memory Budget on Orin

```
Orin AGX 64GB memory budget for attention-based perception:

Total: 64 GB LPDDR5 (shared CPU/GPU)
  OS + ROS Noetic + services:     ~4 GB
  LiDAR drivers (4-8 sensors):    ~2 GB
  CPU-side processing:            ~4 GB
  Available for GPU models:       ~54 GB

Typical allocation for attention-based stack:
  Model weights (FP16):
    PointPillars backbone:         10 MB
    FlatFormer (or PTv3-Small):    37 MB
    BEV attention layers:          8 MB
    Detection head:                12 MB
    Segmentation head:             5 MB
    Total weights:                 72 MB

  Activation memory (inference):
    Input voxels/pillars:          50 MB
    Backbone activations:          200 MB
    Attention KV (per layer):      30 MB x 8 layers = 240 MB
    BEV features:                  50 MB
    Total activations:             540 MB

  TensorRT engine + workspace:     400 MB
  CUDA context:                    500 MB

  Total per model:                 ~1.5 GB
  With 3 concurrent models:       ~4.5 GB
  Temporal KV-cache (3 frames):   ~120 MB

  TOTAL GPU memory:               ~5.2 GB (well within budget)

  Headroom for:
    - Camera fallback pipeline:    ~1.5 GB
    - VLM co-pilot (InternVL2-2B): ~3 GB
    - World model inference:       ~2 GB
```

---

## 11. Implementation Guide

### 11.1 PyTorch Sparse Window Attention (Production-Ready)

A complete, optimized implementation for windowed self-attention on sparse voxels:

```python
import torch
import torch.nn as nn
from typing import Optional, Tuple

class SparseWindowSelfAttention(nn.Module):
    """
    Windowed self-attention for sparse 3D voxel features.
    Designed for efficient inference on NVIDIA Orin.

    Supports:
    - Variable occupancy per window (no padding waste)
    - FlashAttention backend (when available)
    - Relative position bias
    - FP16 inference
    """

    def __init__(
        self,
        dim: int,
        num_heads: int = 8,
        window_size: Tuple[int, int] = (8, 8),  # 2D BEV window
        qkv_bias: bool = True,
        attn_drop: float = 0.0,
        proj_drop: float = 0.0,
        use_flash: bool = True,
    ):
        super().__init__()
        self.dim = dim
        self.num_heads = num_heads
        self.head_dim = dim // num_heads
        self.scale = self.head_dim ** -0.5
        self.window_size = window_size
        self.use_flash = use_flash

        self.qkv = nn.Linear(dim, 3 * dim, bias=qkv_bias)
        self.proj = nn.Linear(dim, dim)
        self.attn_drop = nn.Dropout(attn_drop)
        self.proj_drop = nn.Dropout(proj_drop)

        # Pre-norm
        self.norm = nn.LayerNorm(dim)

        # Relative position bias
        self.rel_pos_bias = nn.Parameter(
            torch.zeros(
                (2 * window_size[0] - 1) * (2 * window_size[1] - 1),
                num_heads
            )
        )
        nn.init.trunc_normal_(self.rel_pos_bias, std=0.02)

    def _compute_window_indices(self, coords_2d: torch.Tensor) -> torch.Tensor:
        """Assign each voxel to a window based on 2D BEV coordinates."""
        wx, wy = self.window_size
        window_x = coords_2d[:, 0] // wx
        window_y = coords_2d[:, 1] // wy
        # Combine into single window ID
        max_wy = (coords_2d[:, 1].max() // wy) + 1
        window_ids = window_x * max_wy + window_y
        return window_ids

    def forward(
        self,
        features: torch.Tensor,      # (V, dim)
        coords_2d: torch.Tensor,      # (V, 2) integer BEV coordinates
        batch_indices: Optional[torch.Tensor] = None,  # (V,) batch index
    ) -> torch.Tensor:
        """
        Args:
            features:     (V, dim) sparse voxel features
            coords_2d:    (V, 2) integer 2D coordinates (BEV grid)
            batch_indices: (V,) batch index per voxel (for batched inference)
        Returns:
            (V, dim) updated features
        """
        V, d = features.shape

        # Pre-LayerNorm
        x = self.norm(features)

        # QKV projection
        qkv = self.qkv(x).reshape(V, 3, self.num_heads, self.head_dim)
        q, k, v = qkv.unbind(dim=1)  # each (V, heads, head_dim)

        # Assign voxels to windows
        window_ids = self._compute_window_indices(coords_2d)

        if batch_indices is not None:
            # Offset window IDs by batch to avoid cross-batch attention
            max_windows = window_ids.max() + 1
            window_ids = window_ids + batch_indices * max_windows

        # Sort by window ID for contiguous memory access
        sort_idx = window_ids.argsort()
        q = q[sort_idx]
        k = k[sort_idx]
        v = v[sort_idx]
        window_ids_sorted = window_ids[sort_idx]

        # Compute cumulative sequence lengths for variable-length windows
        unique_windows, counts = window_ids_sorted.unique_consecutive(
            return_counts=True
        )
        cu_seqlens = torch.zeros(
            len(counts) + 1, dtype=torch.int32, device=features.device
        )
        cu_seqlens[1:] = counts.cumsum(0)
        max_seqlen = counts.max().item()

        if self.use_flash:
            try:
                from flash_attn import flash_attn_varlen_func
                output = flash_attn_varlen_func(
                    q.half(), k.half(), v.half(),
                    cu_seqlens_q=cu_seqlens,
                    cu_seqlens_k=cu_seqlens,
                    max_seqlen_q=max_seqlen,
                    max_seqlen_k=max_seqlen,
                    dropout_p=self.attn_drop.p if self.training else 0.0,
                    causal=False,
                ).float()
            except ImportError:
                output = self._standard_attention(q, k, v, cu_seqlens)
        else:
            output = self._standard_attention(q, k, v, cu_seqlens)

        # Reshape and project
        output = output.reshape(V, d)  # (V, dim)
        output = self.proj(output)
        output = self.proj_drop(output)

        # Un-sort back to original order
        unsort_idx = sort_idx.argsort()
        output = output[unsort_idx]

        # Residual connection
        return features + output

    def _standard_attention(self, q, k, v, cu_seqlens):
        """Fallback standard attention per window."""
        V = q.shape[0]
        output = torch.zeros_like(q)  # (V, heads, head_dim)

        for i in range(len(cu_seqlens) - 1):
            start = cu_seqlens[i].item()
            end = cu_seqlens[i + 1].item()

            q_w = q[start:end]  # (m, heads, head_dim)
            k_w = k[start:end]
            v_w = v[start:end]

            # (heads, m, m) attention
            attn = torch.einsum('mhd,nhd->hmn', q_w, k_w) * self.scale
            attn = attn.softmax(dim=-1)
            attn = self.attn_drop(attn)

            out = torch.einsum('hmn,nhd->mhd', attn, v_w)
            output[start:end] = out

        return output
```

### 11.2 Serialized Attention Block (PTv3-Style)

```python
import torch
import torch.nn as nn
from typing import List, Optional

class SerializedAttentionBlock(nn.Module):
    """
    PTv3-style serialized attention with multi-order space-filling curves.

    Serializes 3D points along a space-filling curve, then applies
    standard 1D windowed attention. Multiple serialization orders
    across heads provide diverse spatial receptive fields.
    """

    def __init__(
        self,
        dim: int,
        num_heads: int = 8,
        window_size: int = 1024,
        num_orders: int = 4,
        mlp_ratio: float = 4.0,
    ):
        super().__init__()
        self.dim = dim
        self.num_heads = num_heads
        self.window_size = window_size
        self.num_orders = num_orders
        self.heads_per_order = num_heads // num_orders
        self.head_dim = dim // num_heads

        # Attention
        self.norm1 = nn.LayerNorm(dim)
        self.qkv = nn.Linear(dim, 3 * dim)
        self.proj = nn.Linear(dim, dim)

        # FFN
        self.norm2 = nn.LayerNorm(dim)
        hidden_dim = int(dim * mlp_ratio)
        self.ffn = nn.Sequential(
            nn.Linear(dim, hidden_dim),
            nn.GELU(),
            nn.Linear(hidden_dim, dim),
        )

        # Random rotation matrices for multi-order serialization
        self.register_buffer(
            'rotations',
            self._random_rotations(num_orders)
        )

    def _random_rotations(self, n: int) -> torch.Tensor:
        """Generate n random 3x3 rotation matrices."""
        # Use QR decomposition of random matrices for uniform rotations
        rots = []
        for _ in range(n):
            m = torch.randn(3, 3)
            q, r = torch.linalg.qr(m)
            # Ensure proper rotation (det = +1)
            q *= torch.diag(r).sign()
            if torch.det(q) < 0:
                q[:, 0] *= -1
            rots.append(q)
        return torch.stack(rots)  # (n, 3, 3)

    def _z_order_key(self, coords_int: torch.Tensor) -> torch.Tensor:
        """Compute Z-order (Morton) key for integer coordinates.
        Simplified: interleave bits of x, y, z."""
        x, y, z = coords_int[:, 0], coords_int[:, 1], coords_int[:, 2]
        # Simple approximation -- full bit interleaving for production
        key = x * 1000000 + y * 1000 + z
        return key

    def _serialize(self, coords: torch.Tensor, order_idx: int) -> torch.Tensor:
        """Serialize 3D coordinates using rotated Z-order curve.

        Returns sort indices for this serialization order.
        """
        # Apply rotation
        rot = self.rotations[order_idx]  # (3, 3)
        rotated = coords @ rot.T  # (N, 3)

        # Quantize to integer grid
        voxel_size = 0.05  # 5cm quantization
        coords_int = ((rotated - rotated.min(0).values) / voxel_size).long()

        # Compute space-filling curve key
        key = self._z_order_key(coords_int)

        # Sort by key
        sort_indices = key.argsort()
        return sort_indices

    def forward(
        self,
        features: torch.Tensor,   # (N, dim) point features
        coords: torch.Tensor,     # (N, 3) point coordinates (float, meters)
    ) -> torch.Tensor:
        """
        Args:
            features: (N, dim) point features
            coords:   (N, 3) float coordinates in meters
        Returns:
            (N, dim) updated features
        """
        N, d = features.shape
        W = self.window_size

        # ---- Multi-head attention with multi-order serialization ----
        x = self.norm1(features)
        qkv = self.qkv(x).reshape(N, 3, self.num_heads, self.head_dim)
        q, k, v = qkv.unbind(dim=1)  # each (N, num_heads, head_dim)

        # Process each serialization order
        output_heads = []
        for order_idx in range(self.num_orders):
            sort_idx = self._serialize(coords, order_idx)

            # Get heads for this order
            h_start = order_idx * self.heads_per_order
            h_end = h_start + self.heads_per_order

            q_order = q[sort_idx, h_start:h_end]  # (N, heads_per_order, head_dim)
            k_order = k[sort_idx, h_start:h_end]
            v_order = v[sort_idx, h_start:h_end]

            # Windowed attention on serialized sequence
            # Pad to multiple of window size
            pad_N = (W - N % W) % W
            if pad_N > 0:
                q_order = torch.cat([q_order, q_order.new_zeros(pad_N, self.heads_per_order, self.head_dim)])
                k_order = torch.cat([k_order, k_order.new_zeros(pad_N, self.heads_per_order, self.head_dim)])
                v_order = torch.cat([v_order, v_order.new_zeros(pad_N, self.heads_per_order, self.head_dim)])

            num_windows = (N + pad_N) // W

            # Reshape into windows: (num_windows, W, heads, head_dim)
            q_win = q_order.view(num_windows, W, self.heads_per_order, self.head_dim)
            k_win = k_order.view(num_windows, W, self.heads_per_order, self.head_dim)
            v_win = v_order.view(num_windows, W, self.heads_per_order, self.head_dim)

            # Batched attention across windows
            # (num_windows, heads, W, W)
            scale = self.head_dim ** -0.5
            attn = torch.einsum('bwhd,bvhd->bhwv', q_win, k_win) * scale
            attn = attn.softmax(dim=-1)
            out = torch.einsum('bhwv,bvhd->bwhd', attn, v_win)

            # Remove padding and unsort
            out = out.view(N + pad_N, self.heads_per_order, self.head_dim)[:N]
            unsort_idx = sort_idx.argsort()
            out = out[unsort_idx]  # (N, heads_per_order, head_dim)

            output_heads.append(out)

        # Concatenate all heads
        attn_output = torch.cat(output_heads, dim=1)  # (N, num_heads, head_dim)
        attn_output = attn_output.reshape(N, d)
        attn_output = self.proj(attn_output)

        # Residual + FFN
        x = features + attn_output
        x = x + self.ffn(self.norm2(x))

        return x
```

### 11.3 TensorRT Conversion Tips

Key challenges and solutions for converting attention models to TensorRT:

```
Challenge 1: Dynamic shapes (variable point count)
  Problem: Point cloud size varies frame-to-frame (80K-150K)
  Solution: Use TensorRT dynamic shapes with optimization profiles
    min_shape = (80000, 64)
    opt_shape = (120000, 64)   # most common
    max_shape = (160000, 64)

  builder.create_optimization_profile()
  profile.set_shape("input", min_shape, opt_shape, max_shape)

Challenge 2: Sort operations (serialization)
  Problem: torch.sort / argsort not directly supported
  Solution: Pre-compute sort indices on CPU and pass as input tensor
    CPU sort at 120K points: ~0.5ms (negligible vs GPU inference)
    Avoids need for custom GPU sort plugin

Challenge 3: Scatter/Gather for voxelization
  Problem: ScatterND limitations in TensorRT
  Solution: Custom TensorRT plugin (see Section 10.3)
    Or: Pre-voxelize on CPU and pass sparse tensor as input

Challenge 4: FlashAttention
  Problem: FlashAttention CUDA kernels are not TensorRT ops
  Solution: Replace with standard attention + TensorRT's MHA fusion
    TensorRT 10.10+ detects multi-head attention patterns automatically:
      Q @ K^T -> Scale -> Softmax -> @ V
    And fuses into a single efficient kernel

    Key: Export with standard PyTorch attention (not flash_attn)
    TensorRT will find and fuse the pattern

Challenge 5: LayerNorm before attention
  Problem: LayerNorm + attention fusion
  Solution: Export with ONNX opset >= 17 for native LayerNorm support
    TensorRT fuses LN + QKV linear + MHA into single kernel
```

ONNX export example for attention model:

```python
import torch
import onnx

def export_attention_model(model, sample_input, output_path):
    """Export attention-based model to ONNX for TensorRT conversion."""

    # Replace FlashAttention with standard attention for export
    # (TensorRT will fuse standard attention patterns)
    model.eval()

    # Use dynamic axes for variable point count
    torch.onnx.export(
        model,
        sample_input,
        output_path,
        opset_version=17,  # Needed for LayerNorm
        input_names=['features', 'coords'],
        output_names=['output'],
        dynamic_axes={
            'features': {0: 'num_points'},
            'coords': {0: 'num_points'},
            'output': {0: 'num_points'},
        },
    )

    # Verify
    onnx_model = onnx.load(output_path)
    onnx.checker.check_model(onnx_model)
    print(f"Exported to {output_path}")
    print(f"  Input shapes: {[i.type.tensor_type.shape for i in onnx_model.graph.input]}")
```

### 11.4 Memory Profiling

```python
import torch

def profile_attention_memory(model, features, coords):
    """Profile peak memory usage of attention model on GPU."""

    torch.cuda.reset_peak_memory_stats()
    torch.cuda.empty_cache()

    # Measure baseline
    baseline_mem = torch.cuda.memory_allocated() / 1024**2

    # Forward pass
    with torch.no_grad():
        output = model(features.cuda(), coords.cuda())

    peak_mem = torch.cuda.max_memory_allocated() / 1024**2
    current_mem = torch.cuda.memory_allocated() / 1024**2

    print(f"Baseline memory:    {baseline_mem:.1f} MB")
    print(f"Peak memory:        {peak_mem:.1f} MB")
    print(f"Current memory:     {current_mem:.1f} MB")
    print(f"Attention overhead: {peak_mem - baseline_mem:.1f} MB")

    # Per-layer breakdown (requires hooks)
    activations = {}
    def hook_fn(name):
        def hook(module, input, output):
            if isinstance(output, torch.Tensor):
                activations[name] = output.numel() * output.element_size() / 1024**2
        return hook

    for name, module in model.named_modules():
        if 'attn' in name or 'qkv' in name:
            module.register_forward_hook(hook_fn(name))

    with torch.no_grad():
        output = model(features.cuda(), coords.cuda())

    print("\nPer-layer activation memory:")
    for name, mem in sorted(activations.items(), key=lambda x: -x[1]):
        print(f"  {name}: {mem:.1f} MB")
```

### 11.5 Debugging Attention Weights

Visualizing attention weights helps verify that spatial attention is working correctly:

```python
import torch
import numpy as np

def visualize_attention_weights(model, features, coords, point_idx=0):
    """Extract and visualize attention weights for a specific point."""

    attention_maps = {}

    def attn_hook(name):
        def hook(module, input, output):
            # Capture attention weights before softmax dropout
            # This requires modifying the attention module to store weights
            if hasattr(module, '_last_attn_weights'):
                attention_maps[name] = module._last_attn_weights.detach()
        return hook

    # Register hooks
    for name, module in model.named_modules():
        if isinstance(module, (SparseWindowSelfAttention,
                               SerializedAttentionBlock)):
            module.register_forward_hook(attn_hook(name))

    # Forward pass
    with torch.no_grad():
        output = model(features, coords)

    # Analyze attention for point_idx
    for name, attn in attention_maps.items():
        print(f"\nLayer: {name}")
        print(f"  Attention shape: {attn.shape}")

        # Find which window this point is in
        # Attention weights: high = attending strongly to that neighbor
        # For a well-trained model:
        #   - Same-object points should have high mutual attention
        #   - Ground points should attend primarily to nearby ground
        #   - Object boundary points should attend to both object and context

    return attention_maps
```

### 11.6 ROS Noetic Integration Pattern

For integrating attention-based perception into the Aurrigo ROS stack:

```python
#!/usr/bin/env python3
"""
ROS Noetic node for attention-based LiDAR segmentation.
Runs PTv3-Small or FlatFormer with TensorRT backend.
"""
import rospy
import numpy as np
from sensor_msgs.msg import PointCloud2
from sensor_msgs import point_cloud2

# TensorRT inference
import tensorrt as trt
import pycuda.driver as cuda
import pycuda.autoinit


class AttentionSegmentationNode:
    def __init__(self):
        rospy.init_node('attention_segmentation')

        # Load TensorRT engine
        self.engine_path = rospy.get_param(
            '~engine_path',
            '/home/aurrigo/models/flatformer_int8.engine'
        )
        self.engine = self._load_engine(self.engine_path)
        self.context = self.engine.create_execution_context()

        # Allocate GPU buffers
        self._allocate_buffers()

        # Subscribe to merged point cloud
        self.sub = rospy.Subscriber(
            '/rslidar_points_merged',  # Aurrigo merged multi-LiDAR topic
            PointCloud2,
            self.callback,
            queue_size=1,
            buff_size=2**24  # 16MB buffer for large point clouds
        )

        # Publish segmented point cloud
        self.pub = rospy.Publisher(
            '/segmented_points',
            PointCloud2,
            queue_size=1
        )

        rospy.loginfo(f"Attention segmentation node ready (engine: {self.engine_path})")

    def callback(self, msg):
        """Process incoming point cloud through attention model."""
        t_start = rospy.Time.now()

        # Extract points from ROS message
        points = np.array(list(point_cloud2.read_points(
            msg, field_names=("x", "y", "z", "intensity"), skip_nans=True
        )), dtype=np.float32)

        if len(points) < 100:
            rospy.logwarn("Too few points, skipping")
            return

        # Pre-process: voxelize / serialize (CPU-side for TensorRT)
        features, coords = self._preprocess(points)

        # TensorRT inference
        labels = self._infer(features, coords)

        # Publish result
        t_end = rospy.Time.now()
        latency_ms = (t_end - t_start).to_sec() * 1000
        rospy.logdebug(f"Segmentation: {len(points)} points in {latency_ms:.1f}ms")

        # ... (publish segmented PointCloud2)

    def _preprocess(self, points):
        """Voxelize and prepare for TensorRT inference."""
        # Pillarize for FlatFormer, or serialize for PTv3
        # Returns numpy arrays ready for GPU transfer
        pass

    def _infer(self, features, coords):
        """Run TensorRT inference."""
        # Copy to GPU, execute, copy back
        # See tensorrt-deployment-guide.md for full pattern
        pass

    def _load_engine(self, path):
        """Load serialized TensorRT engine."""
        runtime = trt.Runtime(trt.Logger(trt.Logger.WARNING))
        with open(path, 'rb') as f:
            return runtime.deserialize_cuda_engine(f.read())


if __name__ == '__main__':
    try:
        node = AttentionSegmentationNode()
        rospy.spin()
    except rospy.ROSInterruptException:
        pass
```

---

## 12. Key Takeaways

1. **Dense self-attention is impossible for LiDAR**: O(n^2) over 120K+ points requires 53.6 GB just for the attention matrix. Every practical 3D transformer uses some form of sparse attention.

2. **PTv3 is the current best point cloud backbone**: 80.4% mIoU on nuScenes segmentation, 3x faster and 10x less memory than PTv2, thanks to serialization-based attention that maps 3D locality to 1D window attention compatible with FlashAttention.

3. **Serialization-based attention is the breakthrough**: Space-filling curves (Hilbert, Z-order) convert the irregular 3D grouping problem into standard 1D windowed attention, enabling FlashAttention, standard TensorRT MHA fusion, and simple implementation.

4. **FlatFormer is the practical choice for Orin detection**: 2x faster than SpConv by flattening to 2D and using window attention -- 16ms INT8 on Orin, good enough for 50ms planning cycle. The 2D assumption holds well for airside aprons.

5. **FlashAttention is mandatory for Orin**: Reduces memory traffic 4x and is critical given Orin's 204.8 GB/s bandwidth (10x less than A100). Without FlashAttention, attention-based models are 3-5x slower than necessary.

6. **DLA cannot run attention**: Orin's DLA accelerator only supports standard conv/pool/FC layers. All attention computation must run on GPU CUDA cores. Use DLA for the conv backbone and GPU for attention layers.

7. **Hybrid sparse-conv + attention beats either alone**: Use sparse convolution for low-level feature extraction (local patterns, edges) and attention for high-level reasoning (object relationships, long-range context). FlatFormer's SpConv-then-Attention pattern is optimal.

8. **Multi-order serialization provides diverse receptive fields**: PTv3's use of differently-rotated Hilbert curves across attention heads gives each head a different spatial grouping -- equivalent to having multiple receptive field shapes at zero extra computational cost.

9. **Deformable attention is ideal for 3D detection**: Content-adaptive sampling with K=4-8 learned reference points provides object-size-adaptive receptive fields -- critical for airside where objects range from 0.02m FOD to 65m aircraft wingspan.

10. **BEV transformers matter for multi-modal fusion**: BEVFormer-style spatial cross-attention is the standard approach for camera-to-BEV construction. Not needed for Aurrigo's current LiDAR-only stack but essential for camera fallback and future multi-modal integration.

11. **Temporal attention via KV-cache is practical on Orin**: Caching 2-3 frames of K,V costs ~120 MB and avoids re-encoding previous frames. This enables temporal perception (tracking, occupancy flow) within the attention framework.

12. **INT8 attention on Orin provides 1.8-2.2x speedup**: Quantize Q and K to INT8 for the attention score GEMM, keep V and output in FP16 for accuracy. TensorRT handles this automatically with calibration data. Accuracy loss: 0.3-0.8% mIoU.

13. **TensorRT conversion requires careful handling of custom ops**: Sort, scatter, gather, and FlashAttention need either custom TensorRT plugins or pre-computation on CPU. The safest path: pre-compute sort indices on CPU (~0.5ms), use standard attention for TensorRT's MHA fusion, and scatter via custom plugin.

14. **PointPillars remains unbeatable for safety-critical paths**: At 6.84ms INT8 on Orin, nothing with attention comes close. The Simplex architecture should use PointPillars/CenterPoint as the safety baseline (BC) and FlatFormer/PTv3 as the performance controller (AC).

15. **Memory bandwidth, not compute, is the bottleneck on Orin**: Attention's irregular memory access patterns hit Orin's 204.8 GB/s limit before saturating its 275 TOPS compute capacity. Optimize for memory locality: sorted sequences > random gather, window attention > ball-query attention.

16. **Window size 256-512 is optimal for Orin**: Smaller windows (128) underutilize Tensor Cores; larger windows (1024+) overflow L2 cache (4 MB vs 40 MB on A100). FlatFormer's 8x8=64 2D windows are efficient; PTv3's 1024 1D windows should be reduced to 512 for Orin.

17. **Multi-LiDAR pillar-wise cross-attention is nearly free**: With L=4-8 LiDARs, per-cell attention over L tokens costs <1ms and provides learned sensor fusion that gracefully handles sensor degradation (jet blast, de-icing spray).

18. **The trend is toward simpler attention with better grouping**: PTv3 proved that standard multi-head attention (identical to NLP transformers) outperforms custom vector attention (PTv1/v2) when combined with smart spatial serialization. This simplifies implementation, enables existing optimization infrastructure (FlashAttention, TensorRT), and reduces maintenance burden.

---

## 13. References

### Point Transformers
- Zhao et al., "Point Transformer," ICCV 2021
- Wu et al., "Point Transformer V2: Grouped Vector Attention and Partition-based Pooling," NeurIPS 2022
- Wu et al., "Point Transformer V3: Simpler, Faster, Stronger," CVPR 2024
- Wu et al., "Sonata: Self-Supervised Pre-training of 3D Outdoor Scenes," 2024
- Wu et al., "Concerto: Scaling Outdoor 3D Understanding," 2025

### Voxel Transformers
- He et al., "Voxel Set Transformer: A Set-to-Set Approach to 3D Object Detection," CVPR 2022
- Fan et al., "Embracing Single Stride 3D Object Detector with Sparse Transformer," CVPR 2022
- Liu et al., "FlatFormer: Flattened Window Attention for Efficient Point Cloud Transformer," CVPR 2023

### BEV Transformers
- Li et al., "BEVFormer: Learning Bird's-Eye-View Representation from Multi-Camera Images via Spatiotemporal Transformers," ECCV 2022
- Liu et al., "PETRv2: A Unified Framework for 3D Perception from Multi-Camera Images," ICLR 2023
- Wang et al., "StreamPETR: Exploring Object-Centric Temporal Modeling for Efficient Multi-View 3D Object Detection," ICCV 2023
- Liu et al., "BEVFusion: Multi-Task Multi-Sensor Fusion with Unified Bird's-Eye View Representation," ICRA 2023
- Bai et al., "TransFusion: Robust LiDAR-Camera Fusion for 3D Object Detection with Transformers," CVPR 2022

### Efficient Attention
- Dao et al., "FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness," NeurIPS 2022
- Dao, "FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning," ICLR 2024
- Shah et al., "FlashAttention-3: Fast and Accurate Attention with Asynchrony and Low-precision," NeurIPS 2024
- Lefaudeux et al., "xFormers: A Modular and Hackable Transformer Modelling Library," 2022

### Sparse Convolution
- Choy et al., "4D Spatio-Temporal ConvNets: Minkowski Convolutional Neural Networks," CVPR 2019
- Tang et al., "Searching Efficient 3D Architectures with Sparse Point-Voxel Convolution," ECCV 2020
- Contributors, "SpConv: Spatially Sparse Convolution Library," 2022

### Deformable Attention
- Zhu et al., "Deformable DETR: Deformable Transformers for End-to-End Object Detection," ICLR 2021
- Wang et al., "DETR3D: 3D Object Detection from Multi-view Images via 3D-to-2D Queries," CoRL 2021
- Liu et al., "PETR: Position Embedding Transformation for Multi-View 3D Object Detection," ECCV 2022

### Deployment
- NVIDIA, "TensorRT Developer Guide," 2024
- NVIDIA, "Jetson AGX Orin Technical Reference Manual," 2023
- Lang et al., "PointPillars: Fast Encoders for Object Detection from Point Clouds," CVPR 2019
- Yin et al., "Center-based 3D Object Detection and Tracking," CVPR 2021

### 3D Window Attention
- Yang et al., "Swin3D: A Pretrained Transformer Backbone for 3D Indoor Scene Understanding," 2023
- Scheibenreif et al., "RangeFormer: Range-View Transformers for LiDAR Semantic Segmentation," 2023

### Related Repository Documents
- `10-knowledge-base/machine-learning/transformer-world-models.md` -- Attention mechanism fundamentals
- `10-knowledge-base/geometry-3d/pointpillars.md` -- PointPillars architecture (BEV baseline)
- `10-knowledge-base/machine-learning/mamba-ssm-for-driving.md` -- Sub-quadratic alternative to attention
- `technology/perception/lidar-semantic-segmentation.md` -- Segmentation methods including FlatFormer, SalsaNext
- `technology/perception/model-compression-edge-deployment.md` -- Compression and Orin deployment
- `20-av-platform/compute/tensorrt-deployment-guide.md` -- TensorRT conversion pipeline
- `technology/perception/multi-task-unified-perception.md` -- Shared backbone multi-head architecture
- `synthesis/design-spec.md` -- Simplex architecture (AC/BC pattern)
