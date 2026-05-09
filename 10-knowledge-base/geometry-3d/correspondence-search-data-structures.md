# Correspondence Search Data Structures

Most geometric perception problems need to answer the same question many times:
which map point, voxel, feature, surface patch, or track is compatible with this
measurement? Correspondence search is the data-structure layer behind ICP,
feature matching, clustering, occupancy updates, ray casting, map lookup, and
multi-sensor fusion. The math can be correct and still fail in production if
the search structure returns stale, biased, or poorly gated matches.

---

## 1. Related Docs

- [Point Cloud Registration Math: ICP, GICP, VGICP, and NDT](point-cloud-registration-math-icp-ndt-gicp.md)
- [Camera Projective Geometry, PnP, and Triangulation](camera-projective-geometry-pnp-triangulation.md)
- [Occupancy Bayes, Evidential, and Dynamic Grids](../mapping/occupancy-bayes-evidential-dynamic-grids.md)
- [Sparse Attention for 3D Perception](../machine-learning/sparse-attention-3d-perception.md)

---

## 2. Why It Matters for AV, Perception, SLAM, and Mapping

| Use case | Search query | Production concern |
|---|---|---|
| ICP/GICP | Nearest target point or voxel for each source point. | Search dominates runtime and false matches dominate residuals. |
| LiDAR segmentation | Fixed-radius neighbors for normal, curvature, and clustering. | Density changes with range, causing biased neighborhoods. |
| Feature matching | Approximate nearest descriptor under L2, Hamming, or cosine distance. | High-dimensional ANN can trade recall for speed. |
| Occupancy mapping | Voxel cell lookup along sensor rays. | Hash collisions, tile boundaries, and origin shifts create map artifacts. |
| Tracking and fusion | Gated association between detections and tracks. | Nearest Euclidean match is not the nearest probabilistic match. |
| HD map lookup | Nearest lane, sign, pole, curb, or semantic primitive. | Wrong frame or projection zone returns plausible but wrong map features. |

---

## 3. Core Math and Data Structures

### 3.1 Brute Force

Brute force evaluates every candidate:

```text
argmin_j distance(query, point_j)
```

It is simple, exact, and useful as a correctness oracle for tests. It is often
too slow for large point clouds, but for small candidate sets after spatial or
semantic gating it can outperform complex indexing.

### 3.2 KD-Tree

A KD-tree recursively partitions k-dimensional space with axis-aligned splits.
For 3D point clouds, it is a strong baseline for exact nearest neighbor and
radius search:

```text
build: choose split axis, split by median, recurse
query: descend nearest branch, backtrack if hypersphere crosses split plane
```

Typical queries:

```text
kNN(q, k) -> k nearest points
radius(q, r) -> all points with ||p - q|| <= r
```

KD-trees work well in low dimensions. They degrade as dimensionality grows,
which matters for learned descriptors, high-dimensional appearance features,
and some place-recognition embeddings.

### 3.3 Voxel Grid

A voxel grid maps continuous coordinates to integer cell IDs:

```text
ix = floor((x - origin_x) / resolution)
iy = floor((y - origin_y) / resolution)
iz = floor((z - origin_z) / resolution)
```

The cell can store points, counts, mean, covariance, occupancy, distance, or
semantic distributions. Neighbor search checks the containing voxel and nearby
voxels. Voxel grids are useful when queries are fixed-radius and density is
roughly controlled by downsampling.

### 3.4 Spatial Hash

A spatial hash stores only occupied cells:

```text
key = hash(ix, iy, iz)
bucket[key] -> cell payload
```

This is efficient for sparse outdoor maps and rolling local maps. The key must
be stable across negative indices, tile boundaries, and large coordinate values.
For deterministic systems, avoid hash iteration order in outputs that affect
planning or regression tests.

### 3.5 Octree

An octree recursively subdivides 3D space into eight children per node. It is
well suited for multi-resolution occupancy and ray queries. Octrees can store
coarse unknown space compactly and refine only observed areas, as in OctoMap.

### 3.6 Approximate Nearest Neighbor

ANN methods trade exactness for speed. Common families include randomized
KD-tree forests, hierarchical k-means trees, locality-sensitive hashing,
inverted product quantization, and graph-based HNSW. For geometric registration
in 3D, exact or voxel-gated search is often feasible. For descriptor search,
ANN is usually necessary.

The critical metric is not only query latency:

```text
recall = true_matches_returned / true_matches_available
```

Low recall can silently bias pose estimates if missed correspondences are not
uniform across space.

---

## 4. Algorithm Steps

### 4.1 Choosing a Correspondence Structure

1. Define the query type: nearest, fixed radius, ray traversal, frustum query,
   top-k descriptor, or probabilistic gate.
2. Define the metric: Euclidean, Mahalanobis, point-to-plane, descriptor L2,
   Hamming, cosine, semantic-compatible distance, or time-aware distance.
3. Estimate update pattern: static map, rolling map, per-frame rebuild, or
   online insert/delete.
4. Choose exact KD-tree for low-dimensional static point sets.
5. Choose voxel/hash grids for fixed-radius 3D queries and rolling local maps.
6. Choose octrees for sparse multi-resolution occupancy and ray casting.
7. Choose ANN for high-dimensional descriptors or large-scale retrieval.
8. Validate against brute force on small deterministic samples.

### 4.2 Gating Before Matching

Use gates before accepting a candidate:

```text
spatial distance < d_max
normal angle < angle_max
range difference < range_max
time difference < dt_max
semantic class compatible
Mahalanobis distance < chi_square_threshold
```

For tracking or calibrated fusion, Mahalanobis gating is often more correct
than Euclidean gating:

```text
d2 = (z - h(x))^T S^-1 (z - h(x))
```

where `S` includes measurement and prediction uncertainty.

---

## 5. Implementation Notes

- Use squared distances internally to avoid unnecessary square roots.
- Rebuild KD-trees when many points move or are deleted; dynamic updates can
  cost more than rebuilding for per-frame point clouds.
- For voxel grids, store both resolution and origin in map metadata. Changing
  either changes every cell key.
- Use 64-bit integer keys for large maps. Floating-point world coordinates are
  poor hash keys.
- For rolling maps, separate local metric coordinates from global geodetic map
  tile IDs.
- Tune voxel size jointly with sensor noise, point density, registration
  threshold, and map update rate.
- ANN indexes need recall tests on the actual descriptor distribution, not only
  benchmark vectors.
- Ensure thread-safe reads if registration, mapping, and planning query the same
  map concurrently.

---

## 6. Failure Modes and Diagnostics

| Symptom | Likely cause | Diagnostic |
|---|---|---|
| ICP residual is low but pose is wrong. | Nearest-neighbor search returns repeated-structure matches. | Visualize correspondence lines and semantic labels. |
| Runtime spikes in dense scenes. | Radius search returns too many neighbors. | Log neighbor-count percentiles by range and scene type. |
| Map has seams at tile boundaries. | Voxel key origin or projection differs between tiles. | Query identical world points in adjacent tiles and compare cell IDs. |
| Object clustering fragments at long range. | Fixed metric radius ignores range-dependent point density. | Plot neighbor counts versus range and adjust radius or use angular bins. |
| ANN feature matching loses rare landmarks. | Approximate search recall is uneven. | Compare ANN matches to brute force on labeled validation queries. |
| Non-deterministic regression outputs. | Hash iteration order affects tie-breaking. | Sort candidates by stable key before resolving ties. |

---

## 7. Sources

- Jon Louis Bentley, "Multidimensional Binary Search Trees Used for Associative Searching": https://cacm.acm.org/research/multidimensional-binary-search-trees-used-for-associative-searching/
- Bentley KD-tree PDF copy: https://www.cs.rpi.edu/~cutler/classes/advancedgraphics/S23/papers/bentley_kdtree_1975.pdf
- Point Cloud Library KD-tree search tutorial: https://pointclouds.org/documentation/tutorials/kdtree_search.html
- Marius Muja and David G. Lowe, "Fast Approximate Nearest Neighbors with Automatic Algorithm Configuration": https://www.scitepress.org/papers/2009/17878/pdf/index.html
- FLANN project repository and references: https://github.com/flann-lib/flann
- OctoMap project: https://octomap.github.io/
- Open3D KDTreeFlann API: https://www.open3d.org/docs/release/python_api/open3d.geometry.KDTreeFlann.html
