# Neural Online Mapping: State of the Art (2024-2026)

## Beyond MapTR/MapTRv2 -- The Next Generation of Online HD Map Construction

---

## Table of Contents

1. [Field Overview and Evolution](#1-field-overview-and-evolution)
2. [Temporal Fusion Methods](#2-temporal-fusion-methods)
3. [Geometry and Representation Innovations](#3-geometry-and-representation-innovations)
4. [Neural Map Priors and SD Map Integration](#4-neural-map-priors-and-sd-map-integration)
5. [Topological and Scene Graph Approaches](#5-topological-and-scene-graph-approaches)
6. [Map-Free End-to-End Methods](#6-map-free-end-to-end-methods)
7. [Foundation Model Approaches](#7-foundation-model-approaches)
8. [Mamba/SSM Approaches](#8-mambassm-approaches)
9. [Benchmarks and Metrics](#9-benchmarks-and-metrics)
10. [Comprehensive Performance Comparison](#10-comprehensive-performance-comparison)
11. [Airside Applicability Analysis](#11-airside-applicability-analysis)
12. [Research Roadmap](#12-research-roadmap)

---

## 1. Field Overview and Evolution

### 1.1 The Paradigm After MapTR

MapTR (ICLR 2023) and MapTRv2 (IJCV 2024) established the dominant paradigm: DETR-style transformer decoders with permutation-equivalent point queries for single-stage, parallel vectorized map construction. Every major method since builds on or responds to this foundation.

The field has since branched into several distinct research directions:

```
MapTR/v2 (2023-2024): Foundation paradigm
    |
    +---> Temporal fusion: StreamMapNet, MapTracker, MemFusionMap, MambaMap
    |
    +---> Better geometry: GeMap, HIMap, MGMap, BeMapNet, PivotNet
    |
    +---> Map priors: NeuralMapPrior, PriorDrive, P-MapNet, MapEX
    |
    +---> Topology reasoning: TopoNet, TopoMLP, LaneSegNet, T2SG, TopoLogic, TLSD
    |
    +---> Training/scaling: MapNeXt, MapExpert, SQD-MapNet, ADMap
    |
    +---> State-space models: MambaMap
    |
    +---> Map-free E2E: VAD/VADv2, UniAD, Tesla FSD v12+, Wayve
    |
    +---> Future prediction: PredMapNet, AMap
```

### 1.2 Key Shifts Since MapTR

1. **Temporal modeling is now mandatory.** Single-frame methods cannot handle occlusion or maintain consistency. Every top-performing method in 2024-2025 uses multi-frame temporal fusion.
2. **Consistency metrics emerged.** MapTracker (ECCV 2024) exposed that high mAP does not imply temporal consistency, proposing C-mAP (Consistency-aware mAP) as a new evaluation dimension.
3. **Map priors complement perception.** Pure sensor-only approaches struggle at road far-ends and under heavy occlusion. SD map priors (from OpenStreetMap or equivalent) provide cheap but effective global context.
4. **Topology reasoning is a distinct capability.** Detecting map elements is insufficient; understanding how lanes connect is critical for planning. OpenLane-V2 benchmark formalized this.
5. **mAP has reached diminishing returns on nuScenes.** MapNeXt-Huge achieved 78.5 mAP; further gains require new representations, longer temporal context, or prior integration.

---

## 2. Temporal Fusion Methods

### 2.1 StreamMapNet

| | |
|---|---|
| **Paper** | StreamMapNet: Streaming Mapping Network for Vectorized Online HD Map Construction |
| **Venue** | WACV 2024 |
| **Authors** | Yuan et al. |
| **Code** | https://github.com/yuantianyuan01/StreamMapNet |

**Architecture:**

StreamMapNet introduces streaming temporal fusion into MapTR-style online mapping. The core innovation is **Multi-Point Attention** -- rather than standard deformable attention at a single reference point per query, it distributes attention across multiple reference points along predicted map elements, capturing long-range dependencies critical for elongated elements (lane dividers, road boundaries).

```
Multi-view images (t, t-1, t-2, ...)
    |
    v
Image Backbone (ResNet-50)
    |
    v
BEV Encoder (GKT/BEVFormer)
    |
    +---> Temporal BEV Fusion: warp + concatenate historical BEV features
    |
    v
DETR-like Decoder with Multi-Point Attention
    |
    +---> Query Propagation: high-confidence queries retained across frames
    |
    v
Vectorized map elements (polylines with class labels)
```

**Temporal fusion strategies:**
- **BEV feature fusion**: Historical BEV features are ego-motion warped and concatenated/fused with current features
- **Query propagation**: Element queries with confidence above threshold are propagated to the next frame, maintaining identity

**Performance (nuScenes):**

| Setting | Result | Notes |
|---------|--------|-------|
| 60x30m range | +13.0 mAP over prior SOTA | Significant gain |
| 100x50m range | +10.2 mAP over prior SOTA | Extended range |
| Inference speed | 14.2 FPS | Real-time capable |

**Benchmark contribution:** StreamMapNet exposed significant geographic bias in existing nuScenes and Argoverse 2 evaluation splits (train and test sets share overlapping geographic regions), and proposed new geographically non-overlapping splits. On these harder splits, all methods show substantially lower performance, revealing that prior results were inflated by geographic memorization.

**Airside relevance:** HIGH. Temporal fusion is essential for airside operations where aircraft and GSE frequently occlude taxiway markings. The 100x50m perception range is particularly valuable for airport aprons where stand layouts extend over large areas.

---

### 2.2 MapTracker

| | |
|---|---|
| **Paper** | MapTracker: Tracking with Strided Memory Fusion for Consistent Vector HD Mapping |
| **Venue** | ECCV 2024 (Oral) |
| **Authors** | Chen, Wu, Tan, Ma, Furukawa (Simon Fraser University / Wayve) |
| **Code** | https://github.com/woodfrog/maptracker |

**Core insight:** Online mapping should be formulated as a **tracking problem**, not just a detection problem. Map elements persist across frames and should be explicitly tracked with identity preservation.

**Architecture:**

MapTracker maintains **dual memory buffers** of two latent types:

```
Sensor stream (multi-view cameras)
    |
    v
Image Backbone (ResNet-50, ImageNet pretrained)
    |
    v
BEV Feature Extraction
    |
    +---> Raster (BEV) Memory Buffer
    |       - 50x100x256 dimensional latent image in BEV space
    |       - Accumulates spatial context across frames
    |       - Indexed by world coordinates
    |
    +---> Vector Memory Buffer
    |       - 512-dim latent vectors per tracked road element
    |       - Maintains element identities across frames
    |       - Types: lane dividers, road boundaries, pedestrian crossings
    |
    v
Strided Memory Fusion
    |
    +---> Select 4 memory entries at ~1m, 5m, 10m, 15m distance strides
    |     (distance from current vehicle position, not temporal distance)
    |
    v
VEC Module (Vector Element Construction)
    |
    +---> PropMLP: transforms previous-frame vectors using rotation/translation
    |     quaternions encoded as positional embeddings
    |
    +---> Queries = propagated latents (tracked) + new candidate latents (fresh)
    |
    v
Transformer Decoder
    |
    v
Vectorized map elements with tracking IDs
```

**Strided Memory Fusion:**

Rather than using all historical frames (computationally expensive and redundant for nearby frames), MapTracker selects exactly 4 memory entries positioned at approximately 1m, 5m, 10m, and 15m from the current vehicle location. This provides multi-scale temporal context: recent high-detail memory plus older coarse context, while keeping computation bounded.

**Consistency-aware Evaluation (C-mAP):**

MapTracker's major contribution beyond architecture is a new evaluation methodology:
- Standard mAP evaluates each frame independently -- a method can produce completely different map elements per frame and still score well
- **C-mAP** penalizes temporal inconsistency by checking whether matched elements in consecutive frames maintain ancestral correspondence
- The authors also re-processed nuScenes and Argoverse 2 ground truth to ensure temporal alignment of annotations

**Performance (consistent ground truth splits):**

| Dataset | Metric | MapTracker | StreamMapNet | Improvement |
|---------|--------|-----------|--------------|-------------|
| nuScenes | mAP | 76.1 | 70.4 | +5.7 |
| nuScenes | C-mAP | 69.1 | 56.4 | +12.7 |
| Argoverse 2 | mAP | 76.9 | 70.3 | +6.6 |
| Argoverse 2 | C-mAP | 68.3 | 57.5 | +10.8 |

The massive gap between mAP and C-mAP improvements (+12.7 vs +5.7 on nuScenes) demonstrates that MapTracker's tracking formulation specifically improves temporal consistency, not just per-frame accuracy.

**Airside relevance:** VERY HIGH. Consistent map reconstruction is critical for airside operations:
- Aircraft slowly entering/leaving stands create prolonged occlusions; tracking-based mapping maintains knowledge of markings behind the aircraft
- Baggage tractors traversing long apron routes need globally consistent maps, not flickering per-frame detections
- The strided memory at distance intervals maps well to the structured repetitive layouts of airport stands

---

### 2.3 MemFusionMap

| | |
|---|---|
| **Paper** | MemFusionMap: Working Memory Fusion for Online Vectorized HD Map Construction |
| **Venue** | WACV 2025 |
| **Authors** | Song et al. |
| **Code** | https://github.com/Song-Jingyu/MemFusionMap |

**Key innovation:** A simpler, more practical alternative to MapTracker's tracking-based approach. Uses only 4 past frames with a lightweight working memory fusion module, avoiding the need for ground-truth tracking supervision or complex post-processing.

**Architecture components:**

1. **Working Memory Fusion Module**: Maintains a fixed-lag buffer of 4 recent BEV features. Historical features are ego-motion warped to current frame and fused via dilated convolutions (2x2 dilation) to capture elongated map elements like lane markings.

2. **Temporal Overlap Heatmap**: A novel single-channel BEV map tracking how many times each grid cell has appeared in the field-of-view across frames. Recursively propagated using warping, incremented by 1 for newly visible regions. This implicitly encodes vehicle trajectory patterns and speed, helping distinguish high-confidence (frequently observed) from uncertain (newly seen) regions.

**Performance (StreamMapNet geographic splits):**

| Dataset | Range | MemFusionMap | StreamMapNet | MapTracker |
|---------|-------|-------------|--------------|------------|
| nuScenes | 60x30m | 38.0 mAP | 34.1 | 40.3* |
| nuScenes | 100x50m | 27.6 mAP | 22.2 | -- |
| Argoverse 2 | 60x30m | 60.6 mAP | 58.3 | -- |
| Argoverse 2 | 100x50m | 54.3 mAP | 51.5 | -- |

*MapTracker requires additional GT tracking supervision and 72 training epochs vs 24 for MemFusionMap

**Technical specifications:**
- Backbone: ResNet-50
- BEV encoder: BEVFormer
- Feature dimension: 256 channels
- Memory capacity: 4 frames
- Inference: ~15 FPS on NVIDIA A6000
- Training: 8x V100 GPUs, 24 epochs

**Airside relevance:** HIGH. The practical advantages -- no tracking supervision needed, short training schedule, simple architecture -- make this suitable for airside deployment where training data is scarce. The 100x50m range is particularly relevant for wide apron areas. The temporal overlap heatmap naturally handles the case where markings are briefly occluded by passing vehicles.

---

### 2.4 SQD-MapNet (Stream Query Denoising)

| | |
|---|---|
| **Paper** | Stream Query Denoising for Vectorized HD-Map Construction |
| **Venue** | ECCV 2024 |
| **Authors** | Wang et al. |
| **Code** | https://github.com/shuowang666/SQD-MapNet |

**Core idea:** Applies the denoising training paradigm (from DN-DETR/DINO) to temporal map construction. During training, noised ground truth from the previous frame is used to generate denoising queries, and the network learns to reconstruct the current frame's ground truth from these noisy temporal inputs. This explicitly teaches temporal consistency without requiring tracking labels.

**Key advantage:** Can be applied as a plug-in to both static (single-frame) and temporal methods, improving any base architecture. Extensive experiments on nuScenes and Argoverse 2 show consistent improvements.

**Airside relevance:** MEDIUM. Provides a training technique rather than a deployment architecture, but could improve any online mapping model's temporal consistency.

---

### 2.5 IC-Mapper

| | |
|---|---|
| **Paper** | IC-Mapper: Instance-Centric Spatio-Temporal Modeling for Online Vectorized Map Construction |
| **Venue** | ACM Multimedia 2024 |
| **Code** | Not yet released |

**Innovation:** Combines instance-centric temporal association (measuring detection queries across frames in both feature and geometric dimensions) with spatial fusion for end-to-end detection, tracking, and fusion of map instances. Facilitates online reconstruction of global vectorized maps.

**Performance:** +1.1 mAP over StreamMapNet at 60x30m range, +1.6 mAP at 100x50m range.

**Airside relevance:** MEDIUM. The instance-centric tracking and global map reconstruction capability is relevant for building coherent airside maps, but limited performance gains over simpler methods reduce urgency.

---

### 2.6 PredMapNet

| | |
|---|---|
| **Paper** | PredMapNet: Future and Historical Reasoning for Consistent Online HD Vectorized Map Construction |
| **Venue** | arXiv 2025 |
| **Code** | Not yet released |

**Innovation:** First to introduce **short-term future prediction** into online HD map construction. Three key components:

1. **Semantic-Aware Query Generator**: Initializes queries with spatially aligned semantic masks for scene-level context
2. **History-Map Guidance Module (HMG)**: Incorporates historical rasterized map information for smoother, more continuous detection
3. **Short-Term Future Guidance Module (STFG)**: Predicts near-future positions of map instances, providing anticipatory context

Achieves new SOTA on two representative benchmarks.

**Airside relevance:** MEDIUM-HIGH. Future prediction could anticipate taxiway markings around corners or behind slow-moving aircraft before they are directly visible. The historical map guidance concept aligns well with AIXM-based coarse priors.

---

## 3. Geometry and Representation Innovations

### 3.1 GeMap (Geometry-Aware Mapping)

| | |
|---|---|
| **Paper** | Online Vectorized HD Map Construction using Geometry |
| **Venue** | ECCV 2024 |
| **Authors** | Zhang et al. |
| **Code** | https://github.com/cnzzx/GeMap |

**Core innovation:** Explicitly learns Euclidean geometric properties of map elements -- angles between segments, distances between parallel lines, perpendicularity of intersecting elements -- going beyond pure coordinate regression.

**Key technical contributions:**

1. **Geometric Loss**: Based on angle and magnitude decomposition of predicted vectors, robust to rigid transformations (rotation/translation) of driving scenarios. Forces the network to learn structural relationships rather than memorizing absolute coordinates.

2. **Decoupled Self-Attention**: Separates self-attention into two mechanisms:
   - **Shape attention**: Learns intra-element geometry (how points within a single polyline relate)
   - **Relation attention**: Learns inter-element geometry (how different map elements relate to each other -- e.g., parallel lane boundaries)

**Performance:**

| Dataset | Backbone | mAP | vs MapTRv2 |
|---------|----------|-----|------------|
| nuScenes | ResNet-50 (camera) | 69.4 | +0.7 |
| Argoverse 2 | ResNet-50 (camera) | 71.8 | +4.4 |
| nuScenes | Updated model | 76.0 | +7.3 |

**Airside relevance:** HIGH. Airport surface markings follow strict geometric rules (ICAO Annex 14): taxiway centerlines are parallel to edges, stand markings follow specific angular patterns, holding position markings are perpendicular to centerlines. A geometry-aware model can exploit these structural constraints even when individual markings are partially occluded or faded.

---

### 3.2 HIMap (Hybrid Representation)

| | |
|---|---|
| **Paper** | HIMap: HybrId Representation Learning for End-to-end Vectorized HD Map Construction |
| **Venue** | CVPR 2024 |
| **Authors** | Zhou et al. (Samsung Research) |
| **Code** | https://github.com/BritaryZhou/HIMap |

**Core insight:** MapTR and its descendants use point-level representation -- each query represents individual polyline points. This misses element-level information (overall shape, topology). HIMap learns both simultaneously.

**Architecture:**
- **HIQuery**: Hybrid queries encoding both point-level positions and element-level shapes
- **Point-Element Interactor**: Cross-attention mechanism that bidirectionally exchanges information between point-level and element-level representations within each decoder layer
- Multiple decoder layers, each with point-element interactor + self-attention + FFN + prediction heads

**Performance (nuScenes):**
- HIMap: 68.5+ mAP (camera-only, ResNet-50)
- Consistently exceeds prior SOTA under both easy and hard settings

**Airside relevance:** MEDIUM. The hybrid point/element representation could better capture airport-specific elements like curved stand lead-in lines (which have both local point detail and global curvature properties). However, the gains over pure point-level methods are modest.

---

### 3.3 MGMap (Mask-Guided)

| | |
|---|---|
| **Paper** | MGMap: Mask-Guided Learning for Online Vectorized HD Map Construction |
| **Venue** | CVPR 2024 |
| **Authors** | Liu et al. |
| **Code** | https://github.com/xiaolul2/MGMap |

**Core innovation:** Uses predicted instance masks to guide map element query initialization and point refinement, providing global structural context that pure query-based methods lack.

**Architecture (three components):**

1. **Enhanced Multi-Level (EML) Neck**: Hybrid channel and spatial attention for multi-scale BEV features
2. **Mask-Activated Instance (MAI) Decoder**: Dynamically initializes element queries using learned instance masks, incorporating global instance and structural information
3. **Position-Guided Mask Patch Refinement (PG-MPR)**: Uses binary masks to extract patch-based features around predicted points for fine-grained localization

**Performance (nuScenes, camera-only, ResNet-50):**

| Setting | MGMap | MapTR | BeMapNet | Gain over MapTR |
|---------|-------|-------|----------|----------------|
| 30 epochs | 61.4 mAP | 51.1 | 59.8 | +10.3 |
| LiDAR | 67.9 mAP | 55.6 | -- | +12.3 |
| Camera+LiDAR | 71.7 mAP | 62.5 | -- | +9.2 |

**Per-category (camera, 30 epochs):**

| Category | MGMap | MapTR | Gain |
|----------|-------|-------|------|
| Pedestrian Crossing | 57.4 | 45.2 | +12.2 |
| Lane Divider | 63.5 | 53.8 | +9.7 |
| Road Boundary | 63.3 | 54.3 | +9.0 |

**Argoverse 2:** 62.8 mAP (+5.4 over MapTR)

**Airside relevance:** MEDIUM-HIGH. The mask-guided approach could be particularly effective for airport markings that have distinctive shapes (T-bar stand markings, ladder-style ILS markings) where instance masks provide strong structural priors.

---

### 3.4 BeMapNet (Bezier Curves)

| | |
|---|---|
| **Paper** | End-to-End Vectorized HD-map Construction with Piecewise Bezier Curve |
| **Venue** | CVPR 2023 |
| **Authors** | Qiao et al. |
| **Code** | https://github.com/er-muyue/BeMapNet |

**Innovation:** Represents map elements as piecewise Bezier curves rather than fixed-point polylines. Key components:
- **IPM-PE Align module**: Injects inverse perspective mapping geometric priors into BEV features
- **Piecewise Bezier Head**: Classification branch determines curve segment count, regression branch predicts control points
- **Point-Curve-Region Loss**: Progressive supervision from point-level to curve-level to region-level

**Advantage:** Bezier curves naturally model smooth, continuous map elements with fewer control points (64% reduction). This produces cleaner outputs without post-processing.

**Performance (nuScenes):** 57.7-62.6 mAP depending on training epochs, surpassing prior SOTA by 18.0+ mAP at time of publication.

**Airside relevance:** MEDIUM. Taxiway centerlines and curved taxi routes are naturally modeled by Bezier curves. Stand lead-in lines with their characteristic curves would benefit from smooth curve representation over piecewise linear approximations.

---

### 3.5 PivotNet (Dynamic Pivot Points)

| | |
|---|---|
| **Paper** | PivotNet: Vectorized Pivot Learning for End-to-end HD Map Construction |
| **Venue** | ICCV 2023 |
| **Authors** | Ding et al. |
| **Code** | https://github.com/wenjie710/PivotNet |

**Innovation:** Uses dynamic pivot points instead of fixed-count point sets. Key components:
- **Point-to-Line Mask Module**: Encodes subordinate and geometrical point-line priors
- **Pivot Dynamic Matching Module**: Models topology in dynamic point sequences via sequence matching
- **Dynamic Vectorized Sequence Loss**: Supervises both position and topology of vectorized predictions

**Performance (nuScenes):** 53.8 mAP with ResNet-50, surpassing prior SOTA by 5.9+ mAP at time of publication.

**Airside relevance:** LOW-MEDIUM. The dynamic point count is useful for elements of variable complexity, but superseded by later methods.

---

### 3.6 MapNeXt (Training and Scaling)

| | |
|---|---|
| **Paper** | MapNeXt: Revisiting Training and Scaling Practices for Online Vectorized HD Map Construction |
| **Venue** | arXiv 2024 |
| **Authors** | Li et al. |

**Key contribution:** Not a new architecture but a systematic study of training recipes and scaling laws for MapTR-family models.

**Onboard model improvements (no architecture changes):**
- Augmented map element decoder queries with richer initialization
- Dedicated image encoder pre-training
- MapNeXt-Tiny: 54.8 mAP (up from MapTR-Tiny's 49.0), zero inference cost increase

**Offboard model scaling rules:**
1. Increased query count requires proportionally larger decoder networks
2. Larger backbones steadily improve accuracy without diminishing returns (up to tested scale)

**MapNeXt-Huge: 78.5 mAP** on nuScenes -- first to exceed 78% for vision-only, single-model online map construction. This represents +16% over previous best.

**Airside relevance:** HIGH (practically). These training and scaling insights directly apply to training any MapTR-family model on airside data. The finding that proper training alone yields +5.8 mAP (MapTR-Tiny to MapNeXt-Tiny) without architectural changes is immediately actionable.

---

### 3.7 MapExpert (Sparse Element Experts)

| | |
|---|---|
| **Paper** | MapExpert: Online HD Map Construction with Simple and Efficient Sparse Map Element Expert |
| **Venue** | AAAI 2025 |

**Innovation:** Different map element types (lane boundaries, pedestrian crossings, road edges) have fundamentally different geometric characteristics. MapExpert assigns distinct expert transformer layers to different element types, rather than treating all elements uniformly.

- **Learnable Weighted Moving Descent (LWMD)**: Strengthens BEV features while filtering noise for the decoder
- **Sparse Expert Decoder**: Distributes element types to specialized experts
- **Auxiliary Balance Loss**: Ensures even load distribution across experts

SOTA performance on both nuScenes and Argoverse 2.

**Airside relevance:** HIGH. Airport surfaces have highly distinct element types -- taxiway centerlines, stand markings, safety zone boundaries, holding positions -- each with very different geometric properties. A mixture-of-experts approach that learns type-specific decoders could significantly improve accuracy for airport-specific elements.

---

### 3.8 ADMap (Anti-Disturbance)

| | |
|---|---|
| **Paper** | ADMap: Anti-disturbance Framework for Vectorized HD Map Construction |
| **Venue** | ECCV 2024 |
| **Code** | https://github.com/hht1996ok/ADMap |

**Innovation:** Addresses robustness to input disturbances through:
- **Multi-scale Perception Neck (MPN)**: Multi-scale BEV feature processing
- **Instance Interactive Attention (IIA)**: Interaction between map element instances for mutual refinement
- **Vector Direction Difference Loss (VDDL)**: Monitors point sequence prediction quality

SOTA performance on both nuScenes and Argoverse 2.

**Airside relevance:** MEDIUM-HIGH. Robustness to disturbances (de-icing spray, jet exhaust heat shimmer, night operations, rain on cameras) is directly relevant for airside operations where environmental conditions can be harsh.

---

### 3.9 MapUnveiler (Occlusion Handling)

| | |
|---|---|
| **Paper** | Unveiling the Hidden: Online Vectorized HD Map Construction with Clip-Level Token Interaction and Propagation |
| **Venue** | NeurIPS 2024 |
| **Project** | https://mapunveiler.github.io/ |

**Core innovation:** Explicitly handles **occluded map elements** -- the critical failure mode where vehicles, pedestrians, or obstacles block the view of road markings. Processes video clips (not individual frames) and generates compact clip tokens that capture temporal map information.

**Key mechanism:**
- **Clip-level pipeline**: Processes multiple frames as a clip, avoiding redundant per-frame computation via temporal stride
- **Clip token interaction**: Dense BEV features interact with compact clip tokens containing temporal map information
- **Inter-clip token propagation**: Associates information between clips for long-term temporal context
- **Global map relationship**: Builds coherent map understanding across the full driving sequence

**Performance:**
- SOTA on both nuScenes and Argoverse 2
- **+10.7% mAP improvement** in heavily occluded driving scenes (the key metric)

**Airside relevance:** VERY HIGH. Occlusion is the dominant challenge for airside online mapping -- aircraft fuselages, GSE equipment, and baggage carts frequently block taxiway markings. A method specifically designed to unveil occluded map elements would be directly valuable. The +10.7% improvement in occluded scenes is the most relevant number in this entire survey for airside applications.

---

### 3.10 MapQR (Enhanced Queries)

| | |
|---|---|
| **Paper** | Leveraging Enhanced Queries of Point Sets for Vectorized Map Construction |
| **Venue** | ECCV 2024 |

**Innovation:** Redesigns the query representation for vectorized map construction, achieving best mAP and good efficiency on both nuScenes and Argoverse 2. The enhanced query design can be integrated as a plug-in to boost other models.

**Airside relevance:** LOW-MEDIUM. Primarily an engineering improvement rather than a conceptual advance relevant to airside challenges.

---

## 4. Neural Map Priors and SD Map Integration

### 4.1 Neural Map Prior (NMP)

| | |
|---|---|
| **Paper** | Neural Map Prior for Autonomous Driving |
| **Venue** | CVPR 2023 |
| **Authors** | Xiong et al. (Tsinghua MARS Lab) |
| **Code** | https://github.com/Tsinghua-MARS-Lab/neural_map_prior |

**Architecture:**

NMP maintains a global neural map stored as sparse map tiles, each corresponding to a real-world location. When the vehicle revisits an area, the stored neural features are retrieved and fused with current observations:

```
Global Neural Map (stored in memory / disk)
    |
    +---> Map tiles indexed by geographic coordinates
    |       Each tile: learned feature tensor (not raw sensor data)
    |
    v
Current BEV Features (from live perception)
    |
    v
C2P (Current-to-Prior) Cross-Attention
    |   - Dynamically weights current vs. prior features
    |   - High-quality current frame -> more weight on current
    |   - Poor conditions (rain, night) -> more weight on prior
    |
    v
Enhanced BEV Features
    |
    v
GRU (Gated Recurrent Unit) Update
    |   - Updates global neural map with new observations
    |   - Incrementally improves the stored prior
    |
    v
Updated Neural Map Tile (stored back to global map)
```

**Key properties:**
- Architecture-agnostic: works with HDMapNet, VectorMapNet, and others
- Particularly effective in adverse conditions (rain, night)
- Improves with extended perception range (where current frame has less information)
- The prior gets better over time as the vehicle repeatedly traverses the same area

**Performance gains:**
- HDMapNet: +5.4 mAP (segmentation), +5.6 mAP (detection)
- Largest gains at night and in rain

**Airside relevance:** VERY HIGH. Airport vehicles traverse the same routes repeatedly (terminal-to-stand, stand-to-cargo). A neural map prior would rapidly build up rich representations of each route, compensating for temporary occlusions and adverse conditions. The GRU-based incremental update mechanism naturally handles the evolving nature of airport environments (different GSE parked at different times).

**Airside deployment strategy:**
1. Build NMP during initial survey passes (vehicle drives all routes)
2. Store NMP on airport edge server (~10MB per 100m tile, full airport ~1-5GB)
3. Load relevant tiles at runtime (vehicle downloads tiles for current route segment)
4. Continuous improvement: each operational pass updates tiles
5. Night/weather resilience: NMP provides strong prior when cameras are degraded

---

### 4.2 PriorDrive (Unified Vector Priors)

| | |
|---|---|
| **Paper** | PriorDrive: Enhancing Online HD Mapping with Unified Vector Priors |
| **Venue** | arXiv 2024 (with 2025 updates) |

**Innovation:** Integrates multiple types of prior maps into a unified framework:

1. **OpenStreetMap SD Maps**: Coarse road geometry (free, globally available)
2. **Outdated HD Maps**: Previous-generation vendor maps (may be stale but still informative)
3. **Locally Constructed Maps**: From historical vehicle traversals

**Key components:**
- **Hybrid Prior Representation (HPQuery)**: Standardizes diverse map element representations
- **Unified Vector Encoder (UVE)**: Fused prior embedding with dual encoding mechanism
- **Segment-level and point-level pre-training**: Learns prior distribution of vector data

**Performance improvements from SD map priors (applied to various base methods):**

| Base Method | Without Prior | With SD Map Prior | Gain |
|-------------|-------------|-------------------|------|
| HDMapNet | baseline | +3.0% mAP | +3.0 |
| VectorMapNet | baseline | +3.9% mAP | +3.9 |
| StreamMapNet | baseline | +5.9% mAP | +5.9 |
| MapTRv2 | baseline | +5.7% mAP | +5.7 |

Tested on nuScenes, Argoverse 2, and OpenLane-V2.

**Airside relevance:** VERY HIGH. This is one of the most directly applicable methods for airport deployment:
- AIXM/AMXM data (available for most airports) can serve as the SD map prior
- Historical traversal data builds local prior maps automatically
- The unified encoding means all prior types can be combined seamlessly
- Airport layouts are more stable than road networks, making priors more reliable

---

### 4.3 P-MapNet (Far-seeing with Map Priors)

| | |
|---|---|
| **Paper** | P-MapNet: Far-seeing Map Generator Enhanced by both SDMap and HDMap Priors |
| **Venue** | arXiv 2024 |

Uses SD map priors as conditional branches processed with masked autoencoders, specifically targeting long-range (far-seeing) map prediction where sensor data is sparse.

**Performance:** +6.7 mAP over MapTRv2 with SD map prior. +11.2 mAP with HD map prior.

**Airside relevance:** MEDIUM. Long-range perception is less critical for low-speed airside operations (typical 15-25 km/h) but useful for anticipating stand layouts ahead.

---

### 4.4 MapEX (Map Prior Refinement)

| | |
|---|---|
| **Paper** | MapEX |
| **Venue** | 2023 |

**Approach:** Categorizes existing maps into three types and refines query-based estimation model matching algorithms for handling priors.

**Limitation:** Simulates outdated maps by introducing artificial offsets and erasing map elements. This risks leaking ground truth data during training and fails to accurately represent real-world map staleness.

**Airside relevance:** LOW. The artificial simulation of map degradation does not reflect airport-specific scenarios well.

---

## 5. Topological and Scene Graph Approaches

### 5.1 Why Topology Matters (Especially for Airside)

Standard online mapping produces a set of independent polylines without explicit connectivity information. For planning, the vehicle needs to know:

- Which lanes connect to which (can I go from taxiway A to taxiway B?)
- What traffic signals control which lanes
- Where merge/diverge points are
- What the legal routing options are at each junction

This is **critical for airside operations**: taxiway junctions must be navigated correctly to avoid runway incursions, and ATC routing instructions reference specific taxiway segments connected in a graph.

---

### 5.2 TopoNet (Graph-Based Topology)

| | |
|---|---|
| **Paper** | TopoNet: Graph-based Topology Reasoning for Driving Scenes |
| **Venue** | 2023 |
| **Authors** | OpenDriveLab |
| **Code** | https://github.com/OpenDriveLab/TopoNet |

**Innovation:** First end-to-end framework for abstracting traffic knowledge beyond perception, specifically reasoning about connections between centerlines and traffic elements from sensor inputs. Uses Graph Neural Networks (GNNs) to model lane connectivity and traffic signal associations.

**Performance on OpenLane-V2:** 20.0 OLS

**Airside relevance:** HIGH. The graph representation directly maps to airport taxi routing: taxiway segments as nodes, junctions as connection edges, and airport signage as traffic elements with lane associations.

---

### 5.3 TopoMLP (Simple Topology Reasoning)

| | |
|---|---|
| **Paper** | TopoMLP: A Simple yet Strong Pipeline for Driving Topology Reasoning |
| **Venue** | ICLR 2024 |
| **Authors** | Wu et al. |
| **Code** | https://github.com/wudongming97/topomlp |

**Philosophy:** "First detect, then reason." Rather than jointly learning detection and topology, TopoMLP separates them into sequential stages.

**Architecture:**
1. **Lane Detector**: Inspired by PETR (3D position embedding in query-based DETR framework)
2. **Traffic Element Detector**: YOLOX-based detection head
3. **Topology MLP**: Two separate MLP heads (3 linear layers + ReLU each) with position embedding
   - Lane-lane topology: predicts connectivity between detected lanes
   - Lane-traffic topology: predicts which traffic elements control which lanes

**Performance on OpenLane-V2:**
- 41.2% OLS with ResNet-50 backbone
- Winner of the 1st OpenLane Topology Challenge

**Airside relevance:** HIGH. The decoupled detect-then-reason approach is practical for airport deployment:
- Standard detectors can be retrained for airport-specific elements (taxiway signs, holding position markings)
- Topology MLPs can learn airport-specific connectivity patterns
- Simple architecture is easier to debug and validate for safety-critical applications

---

### 5.4 LaneSegNet (Unified Lane Segments)

| | |
|---|---|
| **Paper** | LaneSegNet: Map Learning with Lane Segment Perception for Autonomous Driving |
| **Venue** | ICLR 2024 |
| **Authors** | OpenDriveLab |
| **Code** | https://github.com/OpenDriveLab/LaneSegNet |

**Core innovation:** Introduces the **lane segment** as a unified map representation that simultaneously encodes geometry AND topology. Each lane segment is defined by:

```
Lane Segment = {
    centerline:      [ordered 3D points defining the center path],
    left_boundary:   [3D points, derived as offset from centerline],
    right_boundary:  [3D points, derived as offset from centerline],
    lane_type:       {regular_lane | pedestrian_crossing | ...},
    left_line_type:  {dashed | solid | non_visible},
    right_line_type: {dashed | solid | non_visible},
    topology_edges:  {predecessor_segments, successor_segments}
}
```

**Architecture:**

```
Multi-view Images
    |
    v
ResNet-50 + FPN (3-stage multi-scale features)
    |
    v
BEV Feature Map
    |
    v
Lane Segment Decoder with Lane Attention
    |
    +---> Heads-to-Regions mechanism:
    |       - Multiple reference points distributed along predicted boundaries
    |       - Multi-head attention: each head attends to specific local region
    |       - 32 sampling locations per reference point, 8 directions
    |       - Identical initialization for all heads in first layer
    |
    v
Lane Segments (geometry + type + topology)
    |
    +---> Topology Branch:
            - MLP processes predecessor/successor features
            - Concatenation + sigmoid -> connection probability
            - Outputs weighted adjacency matrix
```

**Performance on OpenLane-V2:**

| Metric | LaneSegNet | TopoNet | Gain over TopoNet |
|--------|-----------|---------|-------------------|
| Lane Segment mAP | 32.6 | 23.0 | +9.6 |
| Centerline DET_l | 31.8 | 24.9 | +6.9 |
| Topology TOP_ll | 7.6 | 2.3 | +5.3 |
| OLS | 29.7 | 20.0 | +9.7 |
| FPS | 14.7 | 10.5 | +4.2 FPS |

Also: 37.7% fewer parameters and 31.4% less decoder latency than TopoNet.

**Airside relevance:** VERY HIGH. The lane segment representation is arguably the most natural fit for airport taxiways:
- Taxiway segments naturally have centerlines (painted yellow) with left/right edges (painted or implicit)
- Connectivity between taxiway segments is exactly the predecessor/successor graph
- Lane type classification maps to taxiway types (taxiway, apron, lead-in)
- Boundary types map to edge marking types (continuous, dashed at holding positions)
- The directed graph output can directly feed into airport routing algorithms

---

### 5.5 T2SG (Traffic Topology Scene Graph)

| | |
|---|---|
| **Paper** | T2SG: Traffic Topology Scene Graph for Topology Reasoning in Autonomous Driving |
| **Venue** | CVPR 2025 |
| **Authors** | Lv et al. |

**Innovation:** Defines a novel unified scene graph that explicitly models lanes, the road signals that control/guide them, and topology relationships among all elements.

**Architecture (TopoFormer):**

1. **Lane Aggregation Layer (LAL)**: Uses geometric distance among lane centerlines to guide global information aggregation. Lanes that are physically close interact more strongly.

2. **Counterfactual Intervention Layer (CIL)**: Models reasonable road structures (intersections, straights, merges) through counterfactual reasoning. This layer asks "what would the topology look like if this lane were removed?" to learn robust structural understanding.

**Performance on OpenLane-V2:** 46.3 OLS (SOTA as of early 2025)

**Airside relevance:** HIGH. Airport taxiway junctions are exactly the type of complex topology that T2SG handles. The scene graph representation could encode the full airport movement area structure including taxiway guidance signs, stop bars, and their lane associations. The counterfactual reasoning could help understand taxiway closures (NOTAMs).

---

### 5.6 TopoLogic (Interpretable Topology)

| | |
|---|---|
| **Paper** | TopoLogic: An Interpretable Pipeline for Lane Topology Reasoning on Driving Scenes |
| **Venue** | NeurIPS 2024 |
| **Code** | https://github.com/Franpin/TopoLogic |

**Innovation:** Addresses a fundamental weakness of prior topology methods: they use vanilla MLPs to predict connectivity from lane queries, ignoring geometric features intrinsic to lanes and being vulnerable to endpoint detection shifts.

**Two-pronged approach:**
1. **Geometric distance topology reasoning**: Uses lane centerline geometry (proximity, orientation alignment) to predict connectivity. Robust to endpoint detection noise.
2. **Lane query similarity**: Computes semantic similarity between lane queries as a complementary signal.

**Key advantage:** Can be **incorporated into well-trained models without re-training**, acting as a post-processing topology enhancement.

**Performance on OpenLane-V2:**
- TOP_ll: 23.9 (vs 10.9 for previous SOTA) -- **2.2x improvement in lane-lane topology**
- OLS: 44.1 (vs 39.8 for previous SOTA)

**Airside relevance:** MEDIUM-HIGH. The ability to improve topology reasoning without retraining is valuable for rapid airport-specific deployment. The geometric distance-based reasoning is particularly suitable for airport layouts where taxiway connectivity follows clear geometric patterns.

---

### 5.7 TLSD (Breaking Topology Limits)

| | |
|---|---|
| **Paper** | TLSD: Breaking the Limit of Topological Lane Mapping with Graph Knowledge and Distance Awareness |
| **Venue** | ACML 2025 |

**Innovations:**
1. Iterative refinement scheme within the decoder
2. Group-wise one-to-many assignment for faster training convergence
3. **GNN module** that integrates lane segment coordinates for spatial reasoning
4. Distance-aware topological post-processing

**Performance on OpenLane-V2:** 47.7 OLS (latest SOTA)

Efficient variant (eTLSD) with ResNet-18 outperforms ResNet-50-based competitors (+3.3% mAP, +6.6% APped).

---

### 5.8 Topology Methods Summary (OpenLane-V2)

| Method | Venue | OLS | TOP_ll | Key Innovation |
|--------|-------|-----|--------|----------------|
| TopoNet | 2023 | 20.0 | 2.3 | First GNN-based |
| LaneSegNet | ICLR 2024 | 29.7 | 7.6 | Unified lane segments |
| TopoMLP | ICLR 2024 | 41.2 | -- | Detect-then-reason |
| TopoLogic | NeurIPS 2024 | 44.1 | 23.9 | Geometric reasoning |
| T2SG | CVPR 2025 | 46.3 | -- | Scene graph + counterfactual |
| **TLSD** | ACML 2025 | **47.7** | -- | GNN + distance-aware |

The field has more than doubled OLS scores in two years (20.0 to 47.7), with the steepest gains from incorporating geometric reasoning and graph neural networks.

---

## 6. Map-Free End-to-End Methods

### 6.1 Tesla FSD v12+ (Production Implicit Maps)

**Architecture evolution:**
- FSD v11: ~300,000 lines of C++ control code + 48 neural networks for perception
- FSD v12 (March 2024): End-to-end neural network, ~2,000-3,000 lines of management code
- FSD v13-v14 (2025): Refined end-to-end with neural network vision encoder upgrades

**How Tesla eliminates explicit maps:**
- 8 cameras provide 360-degree coverage
- 2D camera images are transformed into 3D spatial understanding via BEV transformations and occupancy networks
- Navigation and routing are integrated directly into the vision-based neural network
- Real-time responses to blocked roads and detours without map-based instructions
- Fleet-learned driving patterns replace pre-built route data

**FSD v14.2.1 (2025)**: Major neural network vision encoder upgrade. Navigation routing is now part of the neural pipeline, not a separate module.

**Scale:** 3+ billion miles driven on FSD (Supervised) by January 2025. Robotaxi service launched in Austin, TX in June 2025.

**Airside relevance:** The Tesla approach proves that implicit maps work at massive scale on public roads, but its camera-only philosophy (no LiDAR) and the sheer data requirements (billions of miles) make direct adoption impractical for niche airside operations. The architectural principles are relevant: BEV occupancy for navigable space understanding is directly transferable.

---

### 6.2 Wayve (GAIA World Models)

**GAIA evolution:**
- **GAIA-1** (2023): 9B parameter generative world model, 4,700 hours UK driving data
- **GAIA-2** (2025): Multi-camera, spatio-temporally coherent scene generation, broader geographic coverage
- **GAIA-3** (December 2025): 15B parameters (2x GAIA-2), trained on 10x more data spanning 9 countries across 3 continents

**Implicit mapping approach:**
Rather than building explicit maps, Wayve's GAIA models learn to generate realistic driving scenes from their training data. The model encodes road structure, lane topology, and navigable space implicitly in its parameters. GAIA-3 can re-drive authentic driving sequences with parameterized variations while maintaining scene coherence.

**Wayve AV2.0**: Drives in 500+ cities with a single model, no HD maps. Demonstrated 40x improvement from zero-shot when adding 500 hours of domain-specific incremental data.

**Airside relevance:** MEDIUM. The demonstrated geographic transfer learning (zero-shot + incremental) is extremely relevant: an airside world model could be pre-trained on road data and incrementally adapted with limited airport-specific data. However, GAIA models are primarily for simulation/evaluation, not direct deployment.

---

### 6.3 VAD / VADv2 (Vectorized Autonomous Driving)

| | |
|---|---|
| **Paper** | VAD: Vectorized Scene Representation for Efficient Autonomous Driving |
| **Venue** | ICCV 2023 (VAD) / ICLR 2026 (VADv2) |
| **Authors** | Jiang et al. (Huazhong University / Horizon Robotics) |
| **Code** | https://github.com/hustvl/VAD |

**VAD (original):**
Models the entire driving scene as a fully vectorized representation -- agents, map elements, and ego trajectory are all vectors, not rasterized grids. This eliminates expensive rasterized BEV computation.

**Architecture flow:**
```
Multi-view Images
    |
    v
Image Backbone + BEV Encoder
    |
    v
Vectorized Scene Learning:
    +---> Agent Queries -> Agent Motion Vectors
    +---> Map Queries -> Map Element Vectors
    |
    v
Planning Module:
    +---> Agent motion vectors as dynamic constraints
    +---> Map element vectors as static constraints
    |
    v
Planned Trajectory (vectorized output)
```

**Performance:**
- 48.4% reduction in collision rate over previous best E2E method
- Up to 9.3x faster inference than rasterized methods
- VAD-Tiny: 0.78m average displacement error, 0.38% collision rate

**VADv2 (2024):**
Extends to probabilistic planning -- outputs a distribution over actions rather than a single trajectory. SOTA closed-loop performance on CARLA Town05.

**Online mapping role:** VAD's map queries serve as an **implicit online mapping** component: they detect and vectorize map elements not as an end in themselves but as planning constraints. This demonstrates that online mapping can be a learned intermediate representation rather than an explicit output.

**Airside relevance:** MEDIUM-HIGH. The vectorized planning constraint approach is elegant for airside operations: taxiway boundaries become explicit velocity constraints, stand markings become positioning constraints, and these can be learned end-to-end rather than hand-coded.

---

### 6.4 UniAD (Unified Autonomous Driving)

| | |
|---|---|
| **Paper** | Planning-oriented Autonomous Driving |
| **Venue** | CVPR 2023 (Best Paper Award) |
| **Authors** | Hu et al. (OpenDriveLab / SenseTime) |
| **Code** | https://github.com/OpenDriveLab/UniAD |

**Online mapping component (MapFormer):**
UniAD includes a dedicated MapFormer module that constructs online maps in BEV space:

- Segments lanes and road semantics
- Online mapping accuracy improved 30% over prior SOTA at time of publication
- Map features serve as inputs to MotionFormer (motion prediction) for agent-road interaction modeling

**Full pipeline:** MapFormer -> TrackFormer -> MotionFormer -> OccFormer -> Planner (all transformer decoder-based with query interfaces)

**Airside relevance:** MEDIUM. UniAD demonstrates the principle that online mapping should be integrated with planning rather than treated as a standalone perception module. For airside, the map-to-motion interaction (how do map elements constrain vehicle behavior?) is more important than raw map accuracy.

---

## 7. Foundation Model Approaches

### 7.1 Current State of Foundation Models for Mapping

Foundation model integration into online mapping is still nascent (as of early 2026). Unlike object detection and segmentation where SAM/DINOv2 have been rapidly adopted, online HD map construction poses unique challenges:

1. **BEV transformation bottleneck**: Foundation models produce 2D perspective features; online mapping requires BEV features. The view transformation step limits direct feature transfer.
2. **Structured output requirement**: Map elements are polylines/curves with class labels and topology, not bounding boxes or masks. Foundation model outputs need significant adaptation.
3. **Domain gap**: SAM/DINOv2 are trained on natural images, not BEV representations.

### 7.2 SAM for Road Segmentation

**Segment-Anything Models Achieve Zero-shot Robustness in Autonomous Driving** (2024) evaluates SAM's zero-shot capabilities:
- Acceptable adversarial robustness under black-box corruptions and white-box attacks
- Promising for road object segmentation without explicit prompts
- **Limitation:** SAM segments 2D perspective images; converting to vectorized BEV maps requires additional geometric reasoning

**SAM for Road Object Segmentation** (2025): Comprehensive evaluation showing SAM handles diverse road objects under challenging conditions but lacks the structured output (polylines, topology) needed for HD map construction.

### 7.3 DINOv2 for Map Feature Extraction

DINOv2's self-supervised visual features provide strong backbones for perception, but direct integration into online mapping faces the same BEV bottleneck. The most promising approach:

- Use DINOv2 as the image backbone (replacing ResNet-50/Swin)
- Apply adapter-mediated feature transfer (LoRA rank 32 optimal, per existing research in this repository)
- Maintain the standard view transform + decoder pipeline

**Current gap:** No published work specifically uses DINOv2 as a backbone for MapTR-family online mapping with reported metrics. This remains an open research opportunity.

### 7.4 MapVision (CVPR 2024 Challenge Winner)

| | |
|---|---|
| **Paper** | MapVision: CVPR 2024 Autonomous Grand Challenge Mapless Driving Tech Report |
| **Venue** | CVPR 2024 Workshop |

Winner of the CVPR 2024 Mapless Driving Challenge. Key technical approach:
- Multi-perspective camera images + standard-definition maps as input
- **Map encoder pre-training** to enhance geometric encoding
- YOLOX for traffic element detection
- Auxiliary tasks from MapTRv2

**Key insight:** Purely map-free approaches struggle at road far-ends and under occlusion. Lightweight SD map priors (globally available from OpenStreetMap) provide a valuable complement.

### 7.5 Vision-Language Integration (Emerging)

Early 2025-2026 work explores VLMs for mapping:
- LLM-based approaches for HD map updates (using language descriptions of changes)
- Vision-language agents for driving scenario understanding
- Multimodal reasoning about map structure

**Current maturity:** Low. No published method demonstrates competitive mAP on standard benchmarks using foundation model / VLM approaches for map construction. The structured geometric output requirement of mapping is poorly served by current VLM architectures.

**Airside relevance of foundation models overall:** MEDIUM-LONG-TERM. The most promising near-term application is using DINOv2 features as a robust backbone for airport-specific online mapping. Foundation models' true value may be in zero-shot transfer to new airport environments without fine-tuning.

---

## 8. Mamba/SSM Approaches

### 8.1 MambaMap

| | |
|---|---|
| **Paper** | MambaMap: Online Vectorized HD Map Construction using State Space Model |
| **Venue** | arXiv 2025 |

**Innovation:** Applies Mamba (S6) state space models to temporal fusion in online map construction, replacing transformer-based attention for processing historical frame sequences.

**Architecture:**
```
Current Multi-view Images
    |
    v
BEV Feature Extraction
    |
    +---> Memory Bank: stores historical BEV features and instance queries
    |
    v
BEV Mamba Fusion: enhances current BEV with historical BEV via SSM
    |
    v
Instance Mamba Fusion: temporal fusion of instance queries via SSM
    |   - Gating mechanism selectively integrates dependencies
    |   - Linear complexity O(n) vs transformer's O(n^2)
    |
    v
Map Element Decoder
    |
    v
Vectorized HD Map
```

**Key advantage:** SSM-based temporal fusion is linear in sequence length, enabling efficient processing of long historical sequences. The gating mechanism selectively integrates relevant temporal information while suppressing noise.

**Performance:** SOTA on nuScenes and Argoverse 2 with strong robustness across diverse scenarios.

**Airside relevance:** HIGH. The computational efficiency of SSM-based temporal fusion is critical for deployment on edge devices (NVIDIA Orin at 275 TOPS). If MambaMap achieves similar accuracy to transformer-based temporal methods at lower compute cost, it could enable longer temporal memory on hardware-constrained airside vehicles. This aligns with the DriveMamba finding elsewhere in this repository (42% L2 reduction, 3.2x faster, 68.8% less GPU memory).

---

## 9. Benchmarks and Metrics

### 9.1 nuScenes Map Construction Benchmark

**Dataset:** 1,000 scenes, 6 cameras, LiDAR, radar, IMU, GPS. 28,130 samples.

**Standard evaluation (60x30m range):**

| Method | Venue | Ped. Cross. | Lane Div. | Road Bound. | Mean mAP |
|--------|-------|-------------|-----------|-------------|----------|
| MapTR | ICLR 2023 | 45.2 | 53.8 | 54.3 | 51.1 |
| MapTRv2 | IJCV 2024 | -- | -- | -- | 68.7 |
| BeMapNet | CVPR 2023 | -- | -- | -- | 57.7-62.6 |
| PivotNet | ICCV 2023 | -- | -- | -- | 53.8 |
| MGMap | CVPR 2024 | 57.4 | 63.5 | 63.3 | 61.4 |
| HIMap | CVPR 2024 | -- | -- | -- | 68.5+ |
| GeMap | ECCV 2024 | -- | -- | -- | 69.4-76.0 |
| MapNeXt-Tiny | arXiv 2024 | -- | -- | -- | 54.8 |
| **MapNeXt-Huge** | arXiv 2024 | -- | -- | -- | **78.5** |

**Temporal methods (StreamMapNet geographic splits, harder):**

| Method | 60x30m mAP | 100x50m mAP | FPS |
|--------|-----------|-------------|-----|
| StreamMapNet | 34.1 | 22.2 | 14.2 |
| MemFusionMap | 38.0 | 27.6 | 15.1 |
| MapTracker | 40.3* | -- | -- |

*Requires GT tracking supervision

**Consistency-aware (MapTracker splits):**

| Method | mAP | C-mAP | Consistency Gap |
|--------|-----|-------|----------------|
| StreamMapNet | 70.4 | 56.4 | 14.0 |
| MapTracker | 76.1 | 69.1 | 7.0 |

### 9.2 Argoverse 2 Map Benchmark

**Dataset:** ~250,000 vector maps, richer annotation than nuScenes. Larger geographic diversity.

| Method | Venue | mAP | Notes |
|--------|-------|-----|-------|
| MapTRv2 | IJCV 2024 | 67.4 | Baseline |
| GeMap | ECCV 2024 | 71.8-76.0 | +4.4 over MapTRv2 |
| MapTracker | ECCV 2024 | 76.9 | Consistency-focused |
| MemFusionMap | WACV 2025 | 54.3-60.6 | On harder geographic split |

### 9.3 OpenLane-V2 Topology Benchmark

**Dataset:** 2,000 annotated road scenes, 2.1M instance-level annotations, 1.9M positive topology relationships.

**Metrics:**
- **DET_l**: Centerline detection score
- **TOP_ll**: Lane-lane topology accuracy
- **TOP_lt**: Lane-traffic topology accuracy
- **OLS (OpenLane-V2 Score)**: Combined metric

| Method | Venue | OLS | Key Innovation |
|--------|-------|-----|----------------|
| TopoNet | 2023 | 20.0 | First GNN-based |
| LaneSegNet | ICLR 2024 | 29.7 | Lane segments |
| TopoMLP | ICLR 2024 | 41.2 | Detect-then-reason |
| TopoLogic | NeurIPS 2024 | 44.1 | Geometric reasoning |
| T2SG | CVPR 2025 | 46.3 | Scene graph |
| **TLSD** | ACML 2025 | **47.7** | GNN + distance |

### 9.4 NAVSIM Benchmark

| | |
|---|---|
| **Paper** | NAVSIM: Data-Driven Non-Reactive Autonomous Vehicle Simulation and Benchmarking |
| **Venue** | NeurIPS 2024 |
| **Code** | https://github.com/autonomousvision/navsim |

NAVSIM evaluates **planning** (not mapping directly) but is relevant because it measures how well map-free end-to-end approaches perform in realistic driving scenarios.

**Key finding (CVPR 2024 Challenge, 143 teams, 463 entries):** Simple methods with moderate compute (TransFuser) can match large-scale E2E architectures (UniAD), suggesting that raw model complexity is less important than training data quality and evaluation methodology.

**NAVSIM v2 (2025):** Pseudo-simulation achieves strong correlation with traditional closed-loop simulation at 6x less compute.

### 9.5 CVPR 2024 Mapless Driving Challenge

Part of the Autonomous Grand Challenge, this track specifically evaluates autonomous driving **without HD maps**:
- Input: multi-perspective cameras + standard-definition maps
- Winner: MapVision (SD map encoder + YOLOX + MapTRv2 auxiliaries)
- Key insight: SD maps are not HD maps but provide essential coarse structure

---

## 10. Comprehensive Performance Comparison

### 10.1 Taxonomy of Methods (2023-2026)

| Category | Methods | Best mAP (nuScenes) | Key Trade-off |
|----------|---------|---------------------|---------------|
| **Single-frame** | MapTRv2, GeMap, HIMap, MGMap | 78.5 (MapNeXt-Huge) | High accuracy, no consistency |
| **Temporal** | StreamMapNet, MapTracker, MemFusionMap, MambaMap | 76.1 (MapTracker) | Consistency + occlusion handling |
| **Prior-augmented** | NMP, PriorDrive, P-MapNet | +3-6% over base | Requires prior availability |
| **Topology** | LaneSegNet, TopoMLP, T2SG, TLSD | 47.7 OLS | Connectivity reasoning |
| **Map-free E2E** | VAD, UniAD | N/A (planning metric) | Integrated perception-planning |
| **Expert/specialized** | MapExpert, BeMapNet | SOTA on both datasets | Element-type awareness |

### 10.2 Open-Source Availability Summary

| Method | GitHub | Venue | Available |
|--------|--------|-------|-----------|
| MapTracker | woodfrog/maptracker | ECCV 2024 | Yes |
| MemFusionMap | Song-Jingyu/MemFusionMap | WACV 2025 | Yes |
| SQD-MapNet | shuowang666/SQD-MapNet | ECCV 2024 | Yes |
| GeMap | cnzzx/GeMap | ECCV 2024 | Yes |
| HIMap | BritaryZhou/HIMap | CVPR 2024 | Yes |
| MGMap | xiaolul2/MGMap | CVPR 2024 | Yes |
| BeMapNet | er-muyue/BeMapNet | CVPR 2023 | Yes |
| PivotNet | wenjie710/PivotNet | ICCV 2023 | Yes |
| ADMap | hht1996ok/ADMap | ECCV 2024 | Yes |
| TopoNet | OpenDriveLab/TopoNet | 2023 | Yes |
| TopoMLP | wudongming97/topomlp | ICLR 2024 | Yes |
| LaneSegNet | OpenDriveLab/LaneSegNet | ICLR 2024 | Yes |
| TopoLogic | Franpin/TopoLogic | NeurIPS 2024 | Yes |
| NeuralMapPrior | Tsinghua-MARS-Lab/neural_map_prior | CVPR 2023 | Yes |
| UniAD | OpenDriveLab/UniAD | CVPR 2023 | Yes |
| VAD | hustvl/VAD | ICCV 2023 | Yes |
| NAVSIM | autonomousvision/navsim | NeurIPS 2024 | Yes |
| StreamMapNet | yuantianyuan01/StreamMapNet | WACV 2024 | Yes |

---

## 11. Airside Applicability Analysis

### 11.1 Airport-Specific Challenges vs Road Driving

| Challenge | Road Driving | Airport Airside | Impact on Online Mapping |
|-----------|-------------|-----------------|-------------------------|
| Lane markings | Abundant, standardized | Sparser, aviation-specific | Need custom element classes |
| Occlusion sources | Vehicles, pedestrians | Aircraft (massive), GSE, containers | Temporal fusion critical |
| Speed | 30-120 km/h | 5-25 km/h | More frames per area, richer temporal data |
| Topology complexity | Complex intersections | Simpler junctions, more repetitive | Topology methods should transfer well |
| Environmental variation | Season, weather, lighting | Same + jet blast heat haze, de-icing fluid | Need robustness to aviation-specific disturbances |
| Map element types | 3-5 types (standard) | 8-10+ types (aviation-specific) | Expert/specialized decoders needed |
| Training data | nuScenes/Argoverse (millions of frames) | None public, must collect | Transfer learning mandatory |

### 11.2 Recommended Methods for Airside Deployment

**Tier 1: Highest priority for evaluation**

| Method | Why | Difficulty |
|--------|-----|-----------|
| **MapTracker** | Tracking formulation handles persistent occlusions from aircraft; consistency metrics directly relevant for safety | Medium (code available, well-documented) |
| **MapUnveiler** | +10.7% in occluded scenes; directly addresses the #1 airside challenge | Medium (NeurIPS 2024) |
| **LaneSegNet** | Lane segment representation naturally maps to taxiway segments; topology output feeds routing | Medium (code available, OpenDriveLab quality) |
| **Neural Map Prior** | Repeated traversals of same routes build strong priors; handles weather degradation | Medium (code available) |

**Tier 2: Strong candidates with specific advantages**

| Method | Why | Difficulty |
|--------|-----|-----------|
| **MapExpert** | Expert decoders for different element types; critical for aviation-specific markings | Medium (AAAI 2025, no code yet) |
| **PriorDrive** | AIXM/AMXM as SD map prior; exactly the airport use case | Medium-High (no code yet) |
| **GeMap** | Geometry-aware learning exploits ICAO marking standards | Low (code available) |
| **MemFusionMap** | Practical: no tracking supervision, short training, real-time | Low (code available) |
| **MambaMap** | Efficient temporal fusion for Orin deployment | Medium-High (no code yet) |

**Tier 3: Architectural insights to adopt**

| Method | Insight to Extract |
|--------|-------------------|
| **MapNeXt** | Training recipes: +5.8 mAP from training alone |
| **TopoLogic** | Post-processing topology enhancement (no retraining) |
| **SQD-MapNet** | Denoising as plug-in temporal training technique |
| **T2SG** | Scene graph representation for full airport movement area |

### 11.3 Proposed Airside Online Mapping Architecture

Combining insights from the surveyed methods:

```
Input Layer:
    Multi-view cameras (existing reference airside AV stack cameras or new)
    4-8 RoboSense LiDAR (existing stack)
    AIXM/AMXM prior (loaded per airport)
    |
    v
Feature Extraction:
    Image backbone: DINOv2 with LoRA adapters (frozen foundation, airport-specific adapters)
    LiDAR backbone: PointPillars (6.84ms on Orin)
    BEV fusion: BEVFormer or LSS
    |
    v
Temporal Fusion (choose one):
    Option A: MapTracker-style strided memory (best consistency)
    Option B: MemFusionMap working memory (simplest, most practical)
    Option C: MambaMap SSM fusion (most efficient for Orin)
    |
    v
Prior Integration:
    NeuralMapPrior: GPS-indexed neural tiles from repeated traversals
    PriorDrive-style: AIXM geometry as vector prior encoding
    Cross-attention fusion: current BEV features <-> prior features
    |
    v
Map Element Decoder:
    MapExpert-style: specialized expert layers per element type
    Airport-specific classes:
        - Taxiway centerline
        - Taxiway edge
        - Holding position marking
        - Stand lead-in line
        - Safety zone boundary
        - ILS critical area marking
        - Stand number (requires camera OCR)
    |
    v
Topology Head:
    LaneSegNet-style: lane segments with connectivity graph
    Airport extensions:
        - Taxiway-to-taxiway connections
        - Taxiway guidance sign associations
        - NOTAM-aware dynamic topology (closed taxiways removed from graph)
    |
    v
Output:
    Vectorized map elements (polylines/Bezier curves)
    Topology graph (adjacency matrix)
    Confidence per element
    Temporal consistency score
    |
    v
Integration:
    Feed into Frenet planner as drivable space constraints
    Feed into global router as navigation graph
    Feed into safety monitor as boundary constraints
```

### 11.4 Data Strategy

1. **Pre-training:** Use nuScenes + Argoverse 2 to train base model on road mapping (abundant data)
2. **Domain adaptation:** Fine-tune with ~500-1,000 annotated frames from target airport (per LoRA transfer learning findings)
3. **Self-improvement:** Deploy Neural Map Prior to accumulate airport-specific knowledge from repeated operations
4. **Cross-airport transfer:** Freeze backbone, retrain adapter layers + prior maps per airport

---

## 12. Research Roadmap

### 12.1 Immediate (0-6 months)

1. **Reproduce MapTracker** on nuScenes; evaluate consistency metrics
2. **Reproduce MemFusionMap** as simpler alternative
3. **Create airside annotation classes** extending nuScenes format for airport markings
4. **Collect pilot dataset** at one airport (100-200 traversals)
5. **Evaluate PriorDrive** with AIXM data as SD map prior

### 12.2 Near-term (6-18 months)

1. **Train airport-specific MapTracker** or MemFusionMap with annotated data
2. **Add LaneSegNet topology** for taxiway connectivity graph
3. **Deploy Neural Map Prior** for route-level map accumulation
4. **Benchmark on airport-specific metrics** (marking detection, routing accuracy)
5. **Evaluate MapExpert** with airport-specific element experts

### 12.3 Longer-term (18-36 months)

1. **Release airport surface mapping benchmark** (no public dataset exists -- opportunity)
2. **Foundation model backbone** (DINOv2 or successor) for cross-airport zero-shot transfer
3. **Integrate with world model** for joint mapping + prediction
4. **Multi-airport transfer learning** via PriorDrive + AIXM priors
5. **Topology-aware planning** using T2SG-style scene graphs for ATC instruction compliance

---

## Sources

### Temporal Fusion
- Yuan et al. "StreamMapNet: Streaming Mapping Network for Vectorized Online HD Map Construction." WACV 2024
- Chen et al. "MapTracker: Tracking with Strided Memory Fusion for Consistent Vector HD Mapping." ECCV 2024 (Oral)
- Song et al. "MemFusionMap: Working Memory Fusion for Online Vectorized HD Map Construction." WACV 2025
- Wang et al. "Stream Query Denoising for Vectorized HD-Map Construction." ECCV 2024
- "IC-Mapper: Instance-Centric Spatio-Temporal Modeling for Online Vectorized Map Construction." ACM MM 2024
- "PredMapNet: Future and Historical Reasoning for Consistent Online HD Vectorized Map Construction." arXiv 2025

### Geometry and Representation
- Zhang et al. "Online Vectorized HD Map Construction using Geometry." ECCV 2024
- Zhou et al. "HIMap: HybrId Representation Learning for End-to-end Vectorized HD Map Construction." CVPR 2024
- Liu et al. "MGMap: Mask-Guided Learning for Online Vectorized HD Map Construction." CVPR 2024
- Qiao et al. "End-to-End Vectorized HD-map Construction with Piecewise Bezier Curve." CVPR 2023
- Ding et al. "PivotNet: Vectorized Pivot Learning for End-to-end HD Map Construction." ICCV 2023
- Li et al. "MapNeXt: Revisiting Training and Scaling Practices for Online Vectorized HD Map Construction." arXiv 2024
- "MapExpert: Online HD Map Construction with Simple and Efficient Sparse Map Element Expert." AAAI 2025
- "ADMap: Anti-disturbance Framework for Vectorized HD Map Construction." ECCV 2024
- "MapUnveiler: Online Vectorized HD Map Construction with Clip-Level Token Interaction and Propagation." NeurIPS 2024
- "MapQR: Leveraging Enhanced Queries of Point Sets for Vectorized Map Construction." ECCV 2024

### Prior Integration
- Xiong et al. "Neural Map Prior for Autonomous Driving." CVPR 2023
- "PriorDrive: Enhancing Online HD Mapping with Unified Vector Priors." arXiv 2024
- "P-MapNet: Far-seeing Map Generator Enhanced by both SDMap and HDMap Priors." arXiv 2024

### Topology
- OpenDriveLab. "TopoNet: Graph-based Topology Reasoning for Driving Scenes." 2023
- Wu et al. "TopoMLP: A Simple yet Strong Pipeline for Driving Topology Reasoning." ICLR 2024
- OpenDriveLab. "LaneSegNet: Map Learning with Lane Segment Perception for Autonomous Driving." ICLR 2024
- Lv et al. "T2SG: Traffic Topology Scene Graph for Topology Reasoning in Autonomous Driving." CVPR 2025
- "TopoLogic: An Interpretable Pipeline for Lane Topology Reasoning on Driving Scenes." NeurIPS 2024
- "TLSD: Breaking the Limit of Topological Lane Mapping with Graph Knowledge and Distance Awareness." ACML 2025

### Map-Free E2E
- Jiang et al. "VAD: Vectorized Scene Representation for Efficient Autonomous Driving." ICCV 2023 / ICLR 2026
- Hu et al. "Planning-oriented Autonomous Driving (UniAD)." CVPR 2023 (Best Paper)
- Tesla FSD v12-v14 technical analysis. 2024-2025
- Wayve GAIA-1/2/3 technical reports. 2023-2025

### SSM/Mamba
- "MambaMap: Online Vectorized HD Map Construction using State Space Model." arXiv 2025

### Benchmarks and Surveys
- Wang et al. "OpenLane-V2: A Topology Reasoning Benchmark for Unified 3D HD Mapping." NeurIPS 2023
- "NAVSIM: Data-Driven Non-Reactive Autonomous Vehicle Simulation and Benchmarking." NeurIPS 2024
- Lyu et al. "Online High-Definition Map Construction for Autonomous Vehicles: A Comprehensive Survey." J. Sensor and Actuator Networks, 2025
- "M3TR: A Generalist Model for Real-World HD Map Completion." arXiv 2025
- CVPR 2024 Autonomous Grand Challenge -- Mapless Driving Track
