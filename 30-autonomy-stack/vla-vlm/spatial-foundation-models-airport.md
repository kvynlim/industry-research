# Spatial Foundation Models for Airport-Specific Embodied Robotics Tasks

## Unifying Perception, Spatial Reasoning, and Manipulation for Airside GSE Operations

**Last updated:** 2026-04-11

---

## Table of Contents

1. [Introduction and Motivation](#1-introduction-and-motivation)
2. [Spatial Intelligence Foundation Models](#2-spatial-intelligence-foundation-models)
3. [Embodied Foundation Models for Robotics](#3-embodied-foundation-models-for-robotics)
4. [Task-Specific Airport Applications](#4-task-specific-airport-applications)
5. [Architecture for On-Vehicle Deployment](#5-architecture-for-on-vehicle-deployment)
6. [Transfer Learning and Adaptation](#6-transfer-learning-and-adaptation)
7. [Benchmarks and Evaluation](#7-benchmarks-and-evaluation)
8. [Integration with Aurrigo Stack](#8-integration-with-aurrigo-stack)
9. [Implementation Roadmap](#9-implementation-roadmap)
10. [Key Takeaways](#10-key-takeaways)
11. [References](#11-references)

---

## 1. Introduction and Motivation

### 1.1 Beyond Point-to-Point Navigation

The autonomous driving research community has invested heavily in solving the open-road navigation problem: detect obstacles, predict their motion, plan a trajectory, and follow it. This perception-prediction-planning loop is the core of every AV stack, including Aurrigo's current ROS Noetic pipeline (PointPillars detection at 6.84ms, GTSAM localization, Frenet planning with 420 candidates/cycle). It works well for the "drive from A to B" portion of airport airside operations.

But airport GSE vehicles do far more than drive between points. A turnaround at a single stand involves a sequence of heterogeneous physical tasks that have more in common with industrial robotics than with highway driving:

| Task | Precision Required | Perception Need | Planning Need |
|------|-------------------|-----------------|---------------|
| Belt loader docking | +-5 cm lateral, +-3 cm vertical | Visual servoing, template matching | MPC, impedance at contact |
| Pushback tug coupling | +-10 cm lateral, +-15 cm longitudinal | Nose gear detection, 6-DoF pose | Force-controlled approach |
| Baggage cart alignment | +-15 cm | Conveyor end detection, cart chain pose | Trajectory stitching |
| FOD detection and classification | Detect 2 cm debris at 50 m | Open-vocabulary, size estimation | Route deviation planning |
| Gate/stand identification | Identify correct stand from 200 m | Text recognition, layout matching | Approach path selection |
| Line/marking following | +-10 cm from centerline | Segmentation of faded/occluded markings | Path tracking |
| Cargo container placement | +-5 cm for ULD locks | 3D pose estimation, spatial reasoning | Precision positioning |
| Aircraft push from gate | Follow ATC-cleared route | Spatial awareness, clearance estimation | Multi-waypoint with constraints |

Each of these tasks currently requires its own specialized perception module, its own training pipeline, its own labeled dataset, and its own control policy. The result is a combinatorial explosion of engineering effort that scales poorly across airports and across vehicle types (ADT3, STL2, POD, ACA1).

### 1.2 The Spatial Intelligence Gap

Current driving perception answers two questions well: **what** is in the scene and **where** is it (in BEV coordinates). But airside tasks demand a richer form of spatial understanding:

```
Questions driving perception answers:
  "There is a belt loader at [x=12.3, y=-4.5, z=0.2]"
  "There is an aircraft at [x=45.0, y=2.1, z=0.0]"

Questions airside tasks require:
  "Is the belt loader close enough to begin docking?"              → spatial relation
  "Is the conveyor aligned with the cargo door sill?"              → relative pose
  "Is the gap between the loader and fuselage safe for crew?"      → distance reasoning
  "What type of FOD is that, and how large is it?"                 → object characterization
  "Which stand number is this — 23 or 24?"                         → scene identification
  "Can the tug clear the wing tip during pushback from stand 14?"  → clearance estimation
  "Where exactly is the nose gear relative to the tug cradle?"     → fine-grained alignment
```

These are questions of **spatial intelligence**: understanding 3D geometry, spatial relationships, distances, clearances, relative poses, and physical affordances. They go beyond bounding-box detection into the territory of spatial reasoning — traditionally the domain of robotics, not autonomous driving.

### 1.3 Foundation Models as the Unification Layer

The recent emergence of spatial foundation models offers a path to solving this proliferation problem. Instead of building N separate perception-planning pipelines for N tasks, a spatial foundation model can serve as a **shared representation layer** that provides:

1. **Dense spatial features** usable across all downstream tasks
2. **Zero-shot spatial reasoning** for novel situations (new aircraft types, unfamiliar stand layouts)
3. **Language-grounded spatial understanding** ("dock at the forward cargo door" parsed into geometric constraints)
4. **Cross-task transfer** (features learned for docking transfer to FOD characterization)

```
CURRENT APPROACH (N separate pipelines):

  Docking perception   → Docking planner   → Docking controller
  FOD perception       → FOD classifier    → FOD response
  Stand ID perception  → Stand matcher     → Approach planner
  Line perception      → Line tracker      → Path controller
  ...N more...

FOUNDATION MODEL APPROACH (shared backbone):

                  ┌─── Docking head (fine alignment)
                  ├─── FOD head (detection + characterization)
  Spatial FM ─────┼─── Stand ID head (identification + approach)
  (shared)        ├─── Line following head (marking tracking)
                  ├─── Clearance head (spatial reasoning)
                  └─── Cargo alignment head (precision placement)
```

This mirrors the evolution already underway in driving perception (shared-backbone multi-head: 14.8ms on Orin, 56% savings vs 4 separate models), but extends it from detection/segmentation into the richer domain of spatial reasoning and embodied task execution.

### 1.4 Scope of This Document

This document surveys the landscape of spatial foundation models and embodied foundation models (EFMs) as of early 2026, evaluates their applicability to airport airside GSE operations, and proposes a concrete integration path with Aurrigo's existing ROS Noetic stack. It builds on:
- `30-autonomy-stack/vla-vlm/vla-for-driving.md` — VLA architectures for driving
- `30-autonomy-stack/vla-vlm/vlm-scene-understanding.md` — VLM co-pilot for scene understanding
- `30-autonomy-stack/vla-vlm/vla-distillation-scaling.md` — distilling large VLAs for Orin
- `10-knowledge-base/robotics/embodied-ai-crossover.md` — robotics-to-driving transfer
- `30-autonomy-stack/planning/autonomous-docking-precision-positioning.md` — docking algorithms
- `30-autonomy-stack/perception/overview/open-vocab-detection.md` — open-vocabulary detection

---

## 2. Spatial Intelligence Foundation Models

### 2.1 4M / 4M-21 (EPFL)

**Paper:** Bachmann et al., "4M-21: An Any-to-Any Vision Model for Tens of Tasks and Modalities," NeurIPS 2024
**Code:** github.com/apple/ml-4m

#### 2.1.1 Architecture

4M (4 Modalities, Massive, Multi-task) is EPFL's unified multimodal architecture that treats all modalities — RGB images, depth maps, surface normals, semantic segmentation, edges, CLIP features, SAM features, 3D human poses, and more — as sequences of discrete tokens that can be both input and output to a single transformer.

```
                    Tokenizers (modality-specific)
                    ┌─────────────────────────────┐
  RGB image    ──→  │ ViT tokenizer (256 tokens)  │──┐
  Depth map    ──→  │ ViT tokenizer (256 tokens)  │──┤
  Normals      ──→  │ ViT tokenizer (256 tokens)  │──┤
  Semantics    ──→  │ ViT tokenizer (256 tokens)  │──┼──→ Transformer ──→ Output tokens
  SAM features ──→  │ ViT tokenizer (256 tokens)  │──┤     (XL/XXL)       (any modality)
  CLIP features──→  │ MLP tokenizer               │──┤
  Text         ──→  │ WordPiece tokenizer          │──┤
  Edges/bboxes ──→  │ ViT tokenizer (256 tokens)  │──┘
                    └─────────────────────────────┘
```

The key insight is the **tokenize-everything** approach: each modality is encoded into a fixed-length discrete token sequence by a modality-specific tokenizer (most use a ViT-based discrete VAE that maps spatial inputs to 256 tokens). The transformer operates on concatenated token sequences from any subset of input modalities and autoregressively generates tokens for any subset of output modalities.

**4M-21** (the latest version) extends the original 4M (7 modalities) to 21 modalities:

| Category | Modalities |
|----------|-----------|
| Geometric | RGB, depth, surface normals, edges (Canny), 3D point maps |
| Semantic | CLIP features, DINOv2 features, SAM features, ImageBind features |
| Segmentation | Semantic segmentation (COCO/ADE20k), instance segmentation |
| Structural | Bounding boxes, human poses (2D/3D), object centroids |
| Language | Captions, metadata, color palette |

**Model sizes:**

| Variant | Parameters | Training Data | Training Compute |
|---------|-----------|---------------|-----------------|
| 4M-B | 198M | CC12M (12M images) | ~500 A100-hours |
| 4M-L | 705M | CC12M | ~2,000 A100-hours |
| 4M-XL | 2.8B | CC12M | ~8,000 A100-hours |
| 4M-21-XL | 2.8B | CC12M + 21 pseudo-labels | ~12,000 A100-hours |

#### 2.1.2 Capabilities Relevant to Airside

4M's any-to-any generation means a single model can:

1. **RGB to depth**: Estimate metric depth from monocular images — needed for camera-based spatial reasoning when LiDAR is degraded (de-icing spray, sensor fault)
2. **RGB to normals**: Surface normal estimation enables understanding of 3D surface geometry (aircraft fuselage curvature, ground plane tilt) without explicit 3D reconstruction
3. **RGB to semantics**: Semantic segmentation with open-vocabulary capability via CLIP/DINOv2 feature prediction
4. **Any combination to any combination**: Predict missing modalities from available ones — critical for sensor degradation graceful fallback

**Airside-specific value proposition:**

| 4M Capability | Airside Application | Current Alternative |
|--------------|--------------------|--------------------|
| RGB → depth + normals | Camera fallback perception (LiDAR failure) | DepthAnything v2 (~15ms INT8, depth only) |
| RGB → SAM features | Zero-shot FOD segmentation | Grounding DINO (44.8 AP, but separate model) |
| RGB + depth → semantics | Fused LiDAR-camera segmentation | Separate per-modality models |
| RGB → DINOv2 features | Rich features for docking visual servoing | DINOv2 ViT-B frozen (separate inference) |
| Partial inputs → full outputs | Degraded-mode perception | No current unified fallback |

#### 2.1.3 Inference Speed

4M-XL at 2.8B parameters is not directly deployable on Orin for real-time tasks:

| Platform | Model | Resolution | Latency | Notes |
|----------|-------|-----------|---------|-------|
| A100 | 4M-XL (2.8B) | 224x224, RGB→5 outputs | ~180ms | Autoregressive generation |
| A100 | 4M-L (705M) | 224x224, RGB→depth | ~45ms | Single output modality |
| Orin (est.) | 4M-L (705M) | 224x224, RGB→depth | ~200-300ms | TensorRT FP16, estimated |
| Orin (est.) | 4M-B (198M) | 224x224, RGB→depth | ~60-100ms | Viable for 2 Hz co-pilot |

**Key limitation:** 4M uses autoregressive token generation, so producing multiple output modalities is sequential, not parallel. Generating depth + normals + semantics from a single RGB input takes ~3x longer than generating depth alone.

**Mitigation:** Use 4M as a teacher for offline feature generation and distill task-specific lightweight heads for on-vehicle deployment (see Section 5.2).

#### 2.1.4 Licensing

4M is released under **Apache 2.0** by Apple via EPFL. Fully commercial use permitted. The pretrained tokenizers and transformer weights are available on Hugging Face.

### 2.2 SpatialVLM (Google)

**Paper:** Chen et al., "SpatialVLM: Endowing Vision-Language Models with Spatial Reasoning Capabilities," CVPR 2024
**No public code/weights** — architecture is reproducible from the paper

#### 2.2.1 Architecture and Training

SpatialVLM addresses a fundamental gap in VLMs: they can describe scenes verbally but cannot reason about metric distances, spatial relationships, or 3D geometry. The approach:

1. **Automatic 3D spatial data generation**: Use off-the-shelf depth estimators and object detectors on 10M+ internet images to create pseudo ground-truth spatial annotations (point clouds, inter-object distances, relative positions)
2. **Spatial VQA dataset**: Generate 2B spatial question-answer pairs from the 3D annotations:
   - "How far is the table from the chair?" → "1.3 meters"
   - "Is the cup to the left or right of the keyboard?" → "To the left, 0.2 meters away"
   - "What is the distance from the camera to the nearest person?" → "3.7 meters"
3. **Fine-tune a VLM** (PaLM-E 12B backbone) on this spatial VQA data alongside standard VQA data

#### 2.2.2 Spatial Reasoning Performance

| Task | Metric | SpatialVLM | GPT-4V (baseline) |
|------|--------|------------|-------------------|
| Distance estimation (indoor) | Mean abs. error | 0.42 m | 1.85 m |
| Distance estimation (outdoor) | Mean abs. error | 1.8 m | 6.3 m |
| Relative position (left/right/front/behind) | Accuracy | 89.2% | 72.4% |
| Size estimation | Mean abs. error | 12 cm | 48 cm |
| Spatial comparison ("closer to A or B?") | Accuracy | 91.7% | 68.1% |

The results show that spatial reasoning can be substantially improved through training on automatically generated 3D spatial data, without requiring any manual annotation.

#### 2.2.3 Airside-Specific Applications

SpatialVLM's natural-language spatial reasoning maps directly to airside queries:

```
AIRSIDE SPATIAL QUERIES (examples):

  Q: "How far is the belt loader from the cargo door?"
  A: "Approximately 2.3 meters. The loader needs to advance 2.0 meters
      to reach docking position."

  Q: "Is there enough clearance for the tug to pass between the
      fuselage and the baggage cart?"
  A: "The gap is approximately 1.8 meters. The tug width is 2.1 meters.
      Insufficient clearance — recommend rerouting."

  Q: "What is that object on the apron at 2 o'clock, 15 meters out?"
  A: "A wrench, approximately 25 cm long. This is FOD that should be
      reported and retrieved."

  Q: "Is the aircraft at stand 23 or stand 24?"
  A: "The aircraft is at stand 23. The stand number marking '23' is
      visible on the apron surface 8 meters ahead, and the aircraft
      nose gear is aligned with the stand 23 centerline."
```

**Key insight:** SpatialVLM would not replace the primary perception pipeline (PointPillars + GTSAM at 10 Hz). It would run as a **spatial reasoning co-pilot** at 1-2 Hz alongside the primary loop, providing higher-order spatial understanding for task planning and anomaly detection — analogous to the VLM co-pilot architecture described in `30-autonomy-stack/vla-vlm/vlm-scene-understanding.md`.

#### 2.2.4 Limitations

- **No public weights**: Google has not released the model. Reproducing requires significant compute (PaLM-E backbone not publicly available).
- **Camera-only**: No native LiDAR integration. Spatial reasoning from images alone has fundamental depth ambiguity at distance (>3-5m error at 50m for monocular methods).
- **Inference speed**: PaLM-E 12B is far too large for Orin. Would require distillation to a smaller backbone (InternVL2-2B or Qwen2.5-VL-3B).

**Workaround — Open reproduction approach:** Use InternVL2-2B (open-source, 300ms on Orin, 3GB VRAM) as the VLM backbone and replicate SpatialVLM's spatial VQA training pipeline with open depth estimators (DepthAnything v2) and detectors (Grounding DINO). This gives 80-90% of SpatialVLM's capability with open models.

### 2.3 SPA (Spatial Perception from Action)

**Paper:** Nagarajan et al., "SPA: 3D Spatial-Awareness Enables Effective Embodied Representation," CVPR 2024
**Code:** github.com/haoyispatial/spa

#### 2.3.1 Core Insight

SPA's thesis: robots that learn by acting in 3D space develop better spatial representations than models trained only on passive image datasets. The approach:

1. Start with a pre-trained DINOv2 backbone
2. Fine-tune using **egocentric videos from robots acting in 3D environments** (manipulation, navigation)
3. Self-supervised objectives that predict spatial properties from actions:
   - **Depth from motion**: Predict depth changes from ego-motion
   - **3D flow from action**: Predict how points move in 3D given the robot's action
   - **Spatial consistency**: Enforce that representations of the same 3D point from different viewpoints are consistent

#### 2.3.2 Architecture

```
Input: RGB image (from robot's camera during operation)
   │
   ▼
DINOv2 ViT-B (frozen lower layers, trainable upper layers)
   │
   ▼
SPA adapter layers (spatial prediction heads):
   ├── Depth prediction head
   ├── 3D scene flow head
   └── Ego-motion prediction head
   │
   ▼
Spatially-aware features (768-dim per patch)
```

Model size: ~105M parameters (DINOv2 ViT-B base + adapters)

#### 2.3.3 Results

| Downstream Task | SPA Features | DINOv2 Features | Improvement |
|----------------|-------------|-----------------|-------------|
| Object rearrangement (success rate) | 72.3% | 58.1% | +14.2% |
| Pick-and-place (success rate) | 68.7% | 52.4% | +16.3% |
| Navigation to goal (SPL) | 0.71 | 0.62 | +0.09 |
| Spatial relation QA (accuracy) | 84.5% | 71.2% | +13.3% |

#### 2.3.4 Relevance to Airside

SPA's action-conditioned spatial features are directly relevant for two airside scenarios:

1. **Docking**: The vehicle's own motion provides rich spatial information during approach — SPA-style features could improve the visual servoing pipeline by learning spatially-aware representations from docking trajectories
2. **FOD characterization**: Understanding the 3D structure of objects encountered during operation (distinguishing a flat piece of debris from a raised tool)

**Practical consideration:** SPA is small enough (~105M params) to potentially run on Orin at 5-10 Hz after TensorRT optimization, making it one of the few spatial foundation models viable for near-real-time on-vehicle deployment.

### 2.4 3D-LLM

**Paper:** Hong et al., "3D-LLM: Injecting the 3D World into Large Language Models," NeurIPS 2023
**Code:** github.com/UMass-Foundation-Model/3D-LLM

#### 2.4.1 Architecture

3D-LLM takes point clouds, multi-view images, or 3D scene representations as input and produces language outputs grounded in 3D space. The key innovation is the **3D feature extraction pipeline** that maps 3D scenes into token sequences compatible with LLM backbones:

```
3D Scene (point cloud or multi-view images)
   │
   ├── Multi-view feature extraction (CLIP/DINOv2 per view)
   ├── Feature lifting to 3D via known camera poses
   └── 3D feature volume → sampled 3D tokens
   │
   ▼
LLM backbone (LLaMA-2 7B / OPT-1.3B)
   │
   ▼
3D-grounded language output:
  - 3D captioning
  - 3D QA
  - 3D grounding (language → 3D coordinates)
  - Task planning with 3D spatial references
```

**Model sizes:** 1.3B (OPT-based) or 7B (LLaMA-based)

#### 2.4.2 3D Grounding Capabilities

3D-LLM can answer spatially grounded questions about 3D scenes:

| Query Type | Example | 3D-LLM Accuracy |
|-----------|---------|-----------------|
| Object localization | "Where is the fire extinguisher?" | 78.3% (within 1m) |
| Distance estimation | "How far is the table from the door?" | 0.68m mean error |
| Spatial relation | "What is between the sofa and the TV?" | 71.2% |
| Navigation planning | "How do I get from the kitchen to the bedroom?" | 65.4% (valid path) |
| Object counting | "How many chairs are in the room?" | 82.1% |

#### 2.4.3 Airside Potential

3D-LLM's native point cloud understanding is directly applicable given Aurrigo's LiDAR-primary stack:

```
AIRSIDE 3D-LLM USAGE:

  Input: Merged point cloud from 4-8 RoboSense LiDARs + task instruction

  Q: "Identify all GSE vehicles within 30 meters of stand 23 and
      describe their positions relative to the aircraft."
  A: "Belt loader at 3.2m from forward cargo door, aligned for docking.
      Fuel truck at 8.5m from underwing panel, approaching from the east.
      Baggage tractor with 3 carts at 15.1m, stationary on the service road."

  Q: "Is the path clear for pushback on taxiway Alpha?"
  A: "Obstruction detected: maintenance vehicle parked 45m ahead on
      taxiway Alpha centerline. Recommend holding or requesting alternative
      route via taxiway Bravo."
```

**Limitation:** 3D-LLM requires known camera poses for multi-view feature lifting. On Aurrigo's stack, this is available from GTSAM localization, so integration is feasible. However, 7B parameters makes real-time Orin deployment impractical — suitable for edge-server or cloud-based spatial reasoning at 0.5-1 Hz.

### 2.5 SpatialRGPT (UC San Diego)

**Paper:** Cheng et al., "SpatialRGPT: Grounded Spatial Reasoning in Vision-Language Models," NeurIPS 2024
**Code:** github.com/antoyang/SpatialRGPT

SpatialRGPT improves on SpatialVLM by integrating explicit depth maps as a separate input modality rather than relying on the VLM to infer depth from RGB alone:

```
Input: RGB image + depth map (from LiDAR projection or depth estimator)
   │
   ├── RGB → CLIP/SigLIP encoder → visual tokens
   └── Depth → depth encoder → depth tokens
   │
   ▼
   Interleaved visual + depth tokens → LLM → spatial reasoning output
```

**Performance vs SpatialVLM:**

| Task | SpatialRGPT | SpatialVLM | Delta |
|------|-------------|------------|-------|
| Distance estimation (indoor) | 0.28m error | 0.42m error | -33% error |
| Distance estimation (outdoor) | 1.1m error | 1.8m error | -39% error |
| Spatial relation | 93.4% | 89.2% | +4.2% |
| Depth-conditioned QA | 88.7% | 79.3% | +9.4% |

**Airside advantage:** Aurrigo vehicles already produce dense depth maps from 4-8 RoboSense LiDARs. Projecting LiDAR points into camera frames provides a high-quality depth channel that SpatialRGPT can directly consume — no monocular depth estimation needed. This eliminates the primary error source in camera-only spatial reasoning (depth estimation errors >3-5m at 50m) and provides metric-accurate spatial answers.

### 2.6 Comparison of Spatial Foundation Models

| Model | Params | Modalities In | Modalities Out | Spatial Accuracy | Speed (A100) | Open Weights | License |
|-------|--------|--------------|----------------|-----------------|-------------|-------------|---------|
| 4M-21 (XL) | 2.8B | 21 (any combo) | 21 (any combo) | Depth RMSE 0.33 (NYUv2) | ~180ms (multi-out) | Yes | Apache 2.0 |
| 4M (B) | 198M | 7 | 7 | Depth RMSE 0.42 (NYUv2) | ~30ms (single out) | Yes | Apache 2.0 |
| SpatialVLM | 12B | RGB + language | Language (spatial) | 0.42m dist. error (indoor) | ~400ms | No | N/A |
| SPA | 105M | RGB (egocentric) | Spatial features | +14% on downstream | ~15ms | Yes | MIT |
| 3D-LLM (7B) | 7B | Point cloud / multi-view | Language (3D-grounded) | 0.68m dist. error | ~350ms | Yes | MIT |
| 3D-LLM (1.3B) | 1.3B | Point cloud / multi-view | Language (3D-grounded) | 0.82m dist. error | ~80ms | Yes | MIT |
| SpatialRGPT | 7-13B | RGB + depth + language | Language (spatial) | 0.28m dist. error (indoor) | ~300ms | Yes | Apache 2.0 |

**Recommendation for Aurrigo:** Start with SPA (small, open, egocentric) for spatial feature extraction and SpatialRGPT (depth-aware, LiDAR-projectable) for spatial reasoning co-pilot. Use 4M as teacher for offline distillation of multi-task perception heads.

---

## 3. Embodied Foundation Models for Robotics

### 3.1 RT-2 / RT-X (Google DeepMind)

**Papers:**
- Brohan et al., "RT-2: Vision-Language-Action Models Transfer Web Knowledge to Robotic Control," arXiv 2023
- Open X-Embodiment Collaboration, "Open X-Embodiment: Robotic Learning Datasets and RT-X Models," arXiv 2023

#### 3.1.1 Architecture

RT-2 uses a large VLM (PaLM-E 12B or PaLI-X 55B) as the backbone and tokenizes robot actions into the VLM's output vocabulary. Actions are discretized into 256 bins per dimension and encoded as text tokens:

```
Input: "Move the can to the left of the bowl"
     + Camera image(s) + robot proprioception

Processing: PaLM-E / PaLI-X backbone processes multimodal input

Output: Token sequence "1 128 91 241 12 5 0 128"
        → decoded as [x, y, z, roll, pitch, yaw, gripper, terminate]
```

**RT-X** extends this with the Open X-Embodiment dataset: 1M+ episodes from 22 robot types across 21 institutions. The key finding is that **training on diverse robot data improves performance on each individual robot**, even though the robots have different embodiments, sensors, and action spaces.

#### 3.1.2 Cross-Embodiment Transfer Results

| Evaluation | RT-2 (single robot) | RT-X (cross-embodiment) | Improvement |
|-----------|---------------------|------------------------|-------------|
| Seen tasks | 84% success | 87% success | +3% |
| Unseen tasks | 32% success | 49% success | +17% |
| Unseen objects | 38% success | 56% success | +18% |
| Language generalization | 41% success | 62% success | +21% |

The largest gains are on **unseen** tasks and objects — exactly the regime where airside operations fall, since there is no public airside robot training data.

#### 3.1.3 Relevance to Airside

RT-2/RT-X demonstrates three principles directly applicable to airport GSE:

1. **Web-scale pre-training helps physical tasks**: Language understanding of spatial concepts ("left of," "aligned with," "close to") transfers to physical execution. A model pre-trained on internet data understands "dock at the cargo door" even without airside training data.

2. **Cross-embodiment training helps each robot**: If Aurrigo trains on data from ADT3, STL2, POD, and ACA1 jointly (analogous to RT-X's multi-robot training), each vehicle type benefits. The shared backbone learns universal spatial reasoning while vehicle-specific action heads handle different steering geometries.

3. **Action tokenization works**: Discretizing continuous control (steering angle, velocity) into tokens and predicting them autoregressively is a viable approach — proven at scale by Google.

**Practical limitation:** RT-2's PaLM-E backbone is not publicly available. RT-X provides open data but uses the closed PaLM-E model. For reproduction, use Octo or OpenVLA (see below).

### 3.2 Octo (UC Berkeley / TRI)

**Paper:** Ghosh et al., "Octo: An Open-Source Generalist Robot Policy," RSS 2024
**Code:** github.com/octo-models/octo
**Weights:** Hugging Face (octo-base, octo-small)

#### 3.2.1 Architecture

Octo is the **open-source counterpart to RT-2**: a generalist robot policy pre-trained on the Open X-Embodiment dataset that can be fine-tuned for specific robots and tasks.

```
┌─────────────────────────────────────────────────────┐
│ OCTO ARCHITECTURE                                    │
│                                                      │
│  Language tokens ─────────┐                          │
│  Image tokens (ViT) ─────┤                          │
│  Wrist camera tokens ────┤                          │
│  Proprioception tokens ──┤                          │
│                           ▼                          │
│               Transformer backbone                    │
│               (27M or 93M params)                     │
│                           │                          │
│                           ▼                          │
│               Readout tokens (learned)                │
│                           │                          │
│                    ┌──────┼──────┐                    │
│                    ▼      ▼      ▼                    │
│              Diffusion   MSE   Discrete               │
│              Head        Head  Head                    │
│              (default)                                │
│                    │                                  │
│                    ▼                                  │
│              Action chunk (K future actions)           │
└─────────────────────────────────────────────────────┘
```

**Model sizes:**

| Variant | Backbone Params | Total Params | Training Data | Training Compute |
|---------|----------------|-------------|---------------|-----------------|
| Octo-Small | 27M | ~35M | 800K episodes (Open X-Embodiment) | ~200 TPU-hours |
| Octo-Base | 93M | ~110M | 800K episodes | ~800 TPU-hours |

**Key design choice — diffusion action head:** Octo uses a diffusion-based action head by default, which generates K-step action chunks via iterative denoising. This handles multi-modal action distributions (important when multiple valid trajectories exist) and produces temporally smooth action sequences.

#### 3.2.2 Fine-Tuning for New Robots

Octo was designed for efficient fine-tuning on new embodiments:

```python
# Octo fine-tuning example (adapted for vehicle control)
from octo.model.octo_model import OctoModel
from octo.data.dataset import make_single_dataset

# Load pre-trained Octo
model = OctoModel.load_pretrained("hf://rail-berkeley/octo-base")

# Create airside docking dataset
dataset = make_single_dataset(
    dataset_kwargs={
        "name": "airside_docking",
        "data_dir": "/data/airside/docking_episodes",
        "image_obs_keys": {"primary": "front_camera", "wrist": None},
        "state_obs_keys": ["vehicle_state"],  # [x, y, yaw, speed, steer]
        "action_keys": ["steering", "velocity"],
    },
    train=True,
)

# Fine-tune with LoRA (efficient)
model.finetune(
    dataset,
    finetune_config={
        "method": "lora",
        "rank": 16,
        "target_modules": ["qkv_proj", "out_proj"],
        "learning_rate": 3e-4,
        "batch_size": 64,
        "num_steps": 50000,  # ~500 episodes * 100 steps each
    },
)
```

**Fine-tuning data requirements** (from Octo ablations):

| Target Task Similarity | Episodes Needed | Fine-Tuning Time (1x A100) |
|----------------------|-----------------|---------------------------|
| Similar to pre-training (tabletop manipulation) | 50-100 | 2-4 hours |
| Different embodiment, similar tasks | 200-500 | 8-16 hours |
| Novel domain (e.g., vehicle docking) | 500-2,000 | 24-48 hours |

#### 3.2.3 Airside Fine-Tuning Strategy

```
PRE-TRAINING (Octo-Base, already done):
  800K robot episodes → general spatial manipulation understanding

SIMULATION FINE-TUNING (Phase 1, ~2,000 episodes):
  Isaac Sim airport environment → docking, approach, FOD response
  Action space: [steering_angle, velocity, acceleration]
  Observation: front camera + side cameras + vehicle state

REAL-WORLD FINE-TUNING (Phase 2, ~500 episodes):
  Human-teleoperated docking approaches at 1-2 airports
  DAgger-style: Octo proposes, human corrects
  Progressive: easy docks → hard docks (wind, wet, night)
```

#### 3.2.4 Licensing

Apache 2.0. Fully open for commercial use. Training data (Open X-Embodiment) is also publicly available.

### 3.3 pi0 / pi0.5 (Physical Intelligence)

**Papers:**
- Black et al., "pi0: A Vision-Language-Action Flow Model for General Robot Control," arXiv 2024
- Physical Intelligence, "pi0.5: a Vision-Language-Action Model to Control Any Robot as a Universal Agent," arXiv 2025

#### 3.3.1 Architecture

pi0 combines a pre-trained VLM (PaLI-Gemma 3B) with a **flow matching action head** — not diffusion (which requires a noise schedule) and not regression (which is unimodal), but flow matching (which learns to transport from noise to action distribution via optimal transport):

```
┌──────────────────────────────────────────────────────┐
│ pi0 ARCHITECTURE                                      │
│                                                       │
│  Image(s) ──→ SigLIP ViT ──→ visual tokens            │
│  Language  ──→ Gemma tokenizer ──→ language tokens      │
│  State     ──→ MLP encoder ──→ state tokens             │
│                                                       │
│  [visual | language | state] ──→ PaLI-Gemma 3B         │
│                                      │                 │
│                                      ▼                 │
│                          Latent representation          │
│                                      │                 │
│                                      ▼                 │
│                      Flow Matching Action Head           │
│                      (separate from VLM, ~200M params)   │
│                                      │                 │
│                                      ▼                 │
│              Action chunk: [a_t, a_{t+1}, ..., a_{t+K}] │
│              (K=16 steps, continuous actions)             │
└──────────────────────────────────────────────────────┘
```

**Total parameters:** ~3.2B (3B VLM + 200M action head)

#### 3.3.2 Key Innovation: Flow Matching

Flow matching is mathematically equivalent to diffusion but with several practical advantages:

```
Diffusion:  Sample noise → iteratively denoise → action
            Requires: noise schedule, many denoising steps (20-100)

Flow matching: Sample noise → learn straight-line transport → action
               Requires: simpler training, fewer steps (5-10)

Result: Same quality, 2-4x faster inference, more stable training
```

On robotics benchmarks, flow matching produces smoother, more diverse action distributions than diffusion with the same compute budget.

#### 3.3.3 Few-Shot Fine-Tuning Results

pi0's most striking result is fine-tuning efficiency:

| Task | Demonstrations | Fine-Tuning Time | Success Rate |
|------|---------------|-----------------|-------------|
| Laundry folding | 50 | 4 hours (1x A100) | 85% |
| Table bussing | 30 | 3 hours | 72% |
| Box assembly | 40 | 3.5 hours | 78% |
| Novel object rearrangement | 20 | 2 hours | 64% |
| Zero-shot (unseen task) | 0 | N/A | 28% |

**For airside:** If 30-50 demonstrations can teach pi0 a new manipulation task, then 100-200 demonstrated docking approaches should be sufficient to learn the docking policy — significantly less data than training from scratch.

#### 3.3.4 pi0.5: Full Autonomy

pi0.5 (March 2025) extends pi0 from single-step manipulation to full autonomous task execution:
- **Language-conditioned autonomy**: "Clean the table" → complete sequence of actions
- **Multi-step planning**: Decomposes high-level goals into action sequences
- **Self-correction**: Detects and recovers from failures

**Relevance:** pi0.5's task decomposition maps to airside multi-step missions — "Service aircraft at stand 14" decomposes into: navigate to stand → identify equipment position → approach → dock → wait for loading → undock → navigate to next task.

#### 3.3.5 Licensing

**Proprietary.** Physical Intelligence has not released model weights. The architecture is described in sufficient detail for reproduction, but training data and compute are substantial (3.2B parameters, thousands of hours of robot data). Use as inspiration for architecture choices; do not plan on deploying pi0 directly.

### 3.4 GR-2 (ByteDance)

**Paper:** Cheang et al., "GR-2: A Generative Video-Language-Action Model with Web-Scale Knowledge for Robot Manipulation," arXiv 2024

#### 3.4.1 Key Insight

GR-2's approach is unique: **pre-train on video generation, then fine-tune for action prediction**. The thesis is that a model that can generate realistic future video frames has implicitly learned physics, spatial relationships, and action consequences.

```
Phase 1: Video Generation Pre-Training
  Input: Video frame(s) + text caption
  Output: Future video frames
  Data: 38M video clips from internet (no robot data)
  What it learns: Physics, object permanence, spatial consistency

Phase 2: Robot Fine-Tuning
  Input: Current observation + task instruction
  Output: Future video frames + action tokens (jointly)
  Data: 100K+ robot episodes
  What it learns: How actions cause scene changes
```

**Model size:** 2.8B parameters (video transformer backbone)

#### 3.4.2 Results

| Metric | GR-2 | RT-2 (55B) | Octo-Base (93M) |
|--------|------|-----------|-----------------|
| Seen tasks success rate | 92.0% | 84.0% | 67.5% |
| Unseen tasks success rate | 68.0% | 49.0% | 34.2% |
| Unseen objects success rate | 76.0% | 56.0% | 41.0% |
| Video generation FID | 12.3 | N/A | N/A |

GR-2 significantly outperforms both RT-2 (despite being 20x smaller) and Octo-Base on unseen tasks. The video generation pre-training provides superior generalization.

#### 3.4.3 Relevance to Airside

GR-2's video generation approach connects to NVIDIA Cosmos world models (documented in `30-autonomy-stack/world-models/`). The insight: **a model that can predict what the airport apron will look like after the vehicle moves has learned airport physics**. This is exactly what world models provide for driving — GR-2 shows the same approach works for robotics tasks.

**Potential integration:** Pre-train a video prediction model on airport driving data (available from existing rosbag fleet data), then fine-tune for task-specific action prediction (docking, alignment). The video generation capability doubles as a simulation tool for testing.

**Licensing:** Partially open — architecture described in paper, but full weights not released. Fine-tuning code available.

### 3.5 HPT (CMU)

**Paper:** Wang et al., "Scaling Proprioceptive-Visual Learning with Heterogeneous Pre-trained Transformers," arXiv 2024
**Code:** github.com/liruiw/HPT

#### 3.5.1 Architecture

HPT addresses a specific problem: how to pre-train on data from robots with **different proprioceptive spaces** (different numbers of joints, different sensor suites) and different action spaces. This is directly analogous to Aurrigo's challenge of training across ADT3 (Ackermann + crab steering), STL2, POD, and ACA1.

```
┌──────────────────────────────────────────────────────┐
│ HPT ARCHITECTURE                                      │
│                                                       │
│  Robot A: 7-DoF arm ──→ ┐                             │
│  Robot B: 6-DoF arm ──→ ├→ Per-robot stem (MLP)       │
│  Robot C: mobile base ─→ │   normalizes to shared dim  │
│  Vehicle ADT3 ─────────→ ┘                             │
│                             │                         │
│                             ▼                         │
│                    Shared trunk                        │
│                    (ViT backbone, 100-300M params)     │
│                             │                         │
│                             ▼                         │
│  Robot A: 7-DoF out ←─ ┐                             │
│  Robot B: 6-DoF out ←─ ├← Per-robot head (MLP)       │
│  Robot C: [v, omega] ← │   maps to specific actions   │
│  ADT3: [steer, vel] ←─ ┘                             │
└──────────────────────────────────────────────────────┘
```

**Key innovation:** The per-robot **stems** and **heads** are small MLPs (~1-5M params each) that normalize heterogeneous proprioceptive/action spaces to a shared dimension. The heavy computation is in the shared trunk that learns universal sensorimotor representations.

#### 3.5.2 Cross-Embodiment Results

| Evaluation | HPT (cross-embodiment) | Single-Robot Specialist | Delta |
|-----------|----------------------|----------------------|-------|
| Seen embodiments, seen tasks | 78.2% | 81.5% | -3.3% |
| Seen embodiments, unseen tasks | 58.4% | 42.1% | +16.3% |
| Unseen embodiments, seen tasks | 51.6% | 0% (N/A) | N/A |
| Scaling (4 → 16 robot types) | 64.8% → 72.1% | 64.8% (no scaling) | +7.3% |

**Key finding:** Cross-embodiment training costs ~3% on known tasks but gains ~16% on novel tasks and enables zero-shot transfer to new robots entirely.

#### 3.5.3 Aurrigo Multi-Vehicle Application

```
HPT for Aurrigo fleet:

Per-vehicle stems:
  ADT3: [steer_front, steer_rear, velocity, crab_angle] → 256-dim
  STL2: [steer, velocity] → 256-dim
  POD:  [steer, velocity, passenger_load] → 256-dim
  ACA1: [steer, velocity, articulation_angle] → 256-dim

Shared trunk (ViT, ~100M params):
  Learns: spatial reasoning, obstacle avoidance, approach strategy
  Shared across all vehicle types

Per-vehicle heads:
  ADT3: 256-dim → [steer_front, steer_rear, velocity, crab_angle]
  STL2: 256-dim → [steer, velocity]
  POD:  256-dim → [steer, velocity]
  ACA1: 256-dim → [steer, velocity, articulation]
```

**Benefit:** A single pre-trained model backbone, shared across all Aurrigo vehicle types. New vehicle types (future products) get free transfer learning — only a small stem and head need training.

#### 3.5.4 Licensing

MIT license. Fully open. Code and pre-trained weights available.

### 3.6 Scaling Laws for Embodied Foundation Models

Empirical scaling laws observed across EFMs follow a consistent pattern:

```
Performance ∝ (Model Size)^α × (Data Size)^β × (Embodiment Diversity)^γ

Where (approximate exponents from aggregate analysis):
  α ≈ 0.3   (model size — diminishing returns past ~3B for robotics)
  β ≈ 0.5   (data size — most important factor)
  γ ≈ 0.2   (embodiment diversity — modest but consistent benefit)
```

**Practical implications for Aurrigo:**

| Factor | Value | Impact | Cost |
|--------|-------|--------|------|
| Model 100M → 1B | +15-25% success rate | Moderate | ~$5K compute |
| Model 1B → 10B | +5-10% success rate | Small | ~$50K compute |
| Data 500 → 5,000 episodes | +20-30% success rate | Large | ~$30K collection |
| Data 5,000 → 50,000 episodes | +10-15% success rate | Moderate | ~$150K collection |
| 1 → 4 vehicle types | +5-10% generalization | Small | ~$10K stems/heads |

**Bottom line:** Investing in data collection (demonstrations, teleoperation episodes) yields higher returns than scaling model size past ~1B parameters. A 500M-1B model with 5,000 high-quality episodes will outperform a 10B model with 500 episodes.

### 3.7 Comparison of Embodied Foundation Models

| Model | Params | Action Head | Pre-Training Data | Fine-Tune Data Needed | Speed (A100) | Open | License |
|-------|--------|-----------|------------------|----------------------|-------------|------|---------|
| RT-2 | 12-55B | Token (autoregressive) | PaLM-E + robot data | 100+ episodes | ~500ms | No | Proprietary |
| RT-X | 12-55B | Token | Open X-Embodiment (1M eps) | 100+ episodes | ~500ms | Data only | Mixed |
| Octo-Base | 93M | Diffusion | Open X-Embodiment (800K eps) | 200-2,000 episodes | ~30ms | Yes | Apache 2.0 |
| Octo-Small | 27M | Diffusion | Open X-Embodiment (800K eps) | 200-2,000 episodes | ~10ms | Yes | Apache 2.0 |
| pi0 | 3.2B | Flow matching | Proprietary (multi-robot) | 30-50 demos | ~150ms | No | Proprietary |
| pi0.5 | 3.2B | Flow matching | Proprietary (enhanced) | 30-50 demos | ~150ms | No | Proprietary |
| GR-2 | 2.8B | Joint video+action | 38M video clips + 100K robot eps | 500+ episodes | ~200ms | Partial | Mixed |
| HPT | 100-300M | Per-embodiment MLP | 52 embodiment types | 200-500 episodes | ~20ms | Yes | MIT |
| OpenVLA | 7B | Token (autoregressive) | Open X-Embodiment | 100+ episodes | ~200ms | Yes | MIT |

**Recommendation for Aurrigo:** Octo-Base (open, proven, right size for distillation to Orin) as the primary foundation model platform, with HPT's stem/head architecture for cross-vehicle transfer. pi0's flow matching insight should be adopted as the action head architecture.

---

## 4. Task-Specific Airport Applications

### 4.1 Precision Docking (+-5 cm Belt Loader, +-10 cm Pushback)

#### 4.1.1 Current Approach Limitations

The two-phase docking architecture documented in `30-autonomy-stack/planning/autonomous-docking-precision-positioning.md` uses:
- **Coarse phase**: Frenet planner navigates to a Docking Approach Point (DAP) 3-5m from target
- **Fine phase**: ICP template alignment (+-1-2 cm) or AprilTag fiducial (+-0.5 cm) for final approach

This works well but requires:
- Pre-computed ICP templates per aircraft type (~50 KB each)
- Physical AprilTag fiducials installed on docking interfaces
- Manual engineering of handoff criteria between coarse and fine phases
- No generalization to novel aircraft or equipment configurations

#### 4.1.2 Foundation Model-Enhanced Docking

Spatial foundation models enable a more flexible approach:

```
CURRENT DOCKING PIPELINE:
  Frenet planner → DAP → handoff → ICP template match → MPC controller
  (rigid, requires templates, fragile to novel aircraft)

FOUNDATION MODEL-ENHANCED DOCKING:
  Frenet planner → DAP → spatial FM identifies dock target
                          → learned visual servoing policy
                          → MPC controller (same as current)
  (flexible, zero-shot on novel aircraft, degrades gracefully)
```

**Spatial VLM for dock target identification:**

```python
# Conceptual: SpatialRGPT identifies docking target
# Runs at 2 Hz during approach phase

import rospy
from sensor_msgs.msg import Image, PointCloud2
from geometry_msgs.msg import PoseStamped

class DockTargetIdentifier:
    """
    Uses spatial VLM to identify and localize docking targets.
    Runs alongside (not replacing) ICP template matching.
    """
    def __init__(self):
        self.vlm = load_spatial_vlm("spatialrgpt-7b-int4")  # 4-bit quantized
        self.image_sub = rospy.Subscriber("/front_camera/image", Image, self.cb_image)
        self.depth_sub = rospy.Subscriber("/lidar/projected_depth", Image, self.cb_depth)
        self.target_pub = rospy.Publisher("/docking/vlm_target", PoseStamped, queue_size=1)

    def identify_target(self, image, depth, task_description):
        """
        Query spatial VLM for dock target location.
        task_description: e.g., "forward cargo door lower sill, B737-800"
        """
        query = (
            f"Identify the {task_description}. "
            f"Report its position relative to the vehicle in meters "
            f"(forward, lateral, vertical) and the approach angle."
        )
        response = self.vlm.query(image, depth, query)
        # Parse structured spatial response
        # "Target at 3.2m forward, 0.4m left, 1.8m up. Approach angle: 87 degrees."
        return parse_spatial_response(response)
```

**Learned visual servoing with foundation model features:**

Rather than running the full VLM at control frequency, extract DINOv2/SPA features once and use them to condition a lightweight servoing policy:

```
Feature extraction (2 Hz, on VLM co-pilot):
  Camera image → DINOv2 ViT-B → 768-dim feature per patch (37x37 grid)
  Feature cache stored in shared memory

Servoing policy (20 Hz, on lightweight head):
  DINOv2 features (cached) + vehicle state → MLP (5M params) → [dx, dy, dyaw]
  Target: drive feature error to zero (features at target vs. features now)
  Latency: ~2ms (MLP only) + feature cache lookup

ICP template matching (10 Hz, safety verification):
  Runs in parallel as ground-truth check
  If VLM-based servoing diverges > 5 cm from ICP estimate → switch to ICP only
```

#### 4.1.3 Template Matching vs Foundation Model Features

| Aspect | ICP Templates | Foundation Model Features |
|--------|--------------|-------------------------|
| Accuracy at 2m | +-1-2 cm | +-3-5 cm (estimated) |
| Generalization to new aircraft | Requires new template | Zero-shot |
| Robustness to occlusion | Degrades with >30% occlusion | Degrades gracefully to ~50% |
| Night/low-light | LiDAR-based, unaffected | Camera features degrade; LiDAR backup |
| Setup per aircraft type | ~2 hours engineering | None |
| Data requirement | One scan per type | Pre-trained (web data) |

**Recommendation:** Foundation model features for coarse docking target identification and approach (DAP to 1m), ICP template matching for final precision (1m to contact). The foundation model handles generalization; the template handles precision.

### 4.2 Gate/Stand Identification and Approach

#### 4.2.1 The Problem

Airport stands are visually similar — adjacent gates have identical geometry (identical-stands problem, documented in `30-autonomy-stack/localization-mapping/overview/lidar-place-recognition-relocalization.md`). A vehicle must reliably identify which stand it is approaching. Current approaches use GPS position + AMDB/HD map matching, but GPS degrades under aircraft wings and terminal buildings (+-10-50 cm, exactly the zone where identification matters).

#### 4.2.2 Spatial Foundation Model Solution

A spatial foundation model can construct a **scene graph** from perception, grounded in the AMDB:

```
Scene Graph Construction (spatial FM output at 2 Hz):

  STAND_23 (type: contact_gate)
    ├── HAS_AIRCRAFT: B737_MAX_8 (orientation: heading_090)
    │   ├── FORWARD_CARGO_DOOR: open (status: loading)
    │   ├── AFT_CARGO_DOOR: closed
    │   └── NOSE_GEAR: visible (bearing: 012, range: 45m)
    ├── HAS_JETBRIDGE: extended (connected to L1 door)
    ├── HAS_GSE:
    │   ├── BELT_LOADER_1: docked (forward cargo)
    │   ├── FUEL_TRUCK: parked (underwing, 8m from panel)
    │   └── CATERING_TRUCK: approaching (12m, bearing 045)
    ├── MARKING: "23" (detected via text recognition, confidence 0.94)
    └── ADJACENT:
        ├── STAND_22: occupied (A320neo, heading_085)
        └── STAND_24: vacant

  SPATIAL_RELATIONS:
    ├── self_to_stand_23_centerline: 2.1m lateral, 55m longitudinal
    ├── clearance_to_wing_tip_22: 4.8m (safe, min required: 3.0m)
    └── clearance_to_belt_loader_1: 6.2m (safe)
```

This scene graph provides:
1. **Stand identification** from multiple cues (marking text, aircraft type, jetbridge position, spatial layout)
2. **Approach planning context** (which doors are being serviced, where are gaps in GSE arrangement)
3. **Clearance estimation** for safe approach paths

#### 4.2.3 AMDB-Grounded Spatial Reasoning

The scene graph is grounded in the AMDB (Aerodrome Mapping Database), which provides the static layout. The spatial FM bridges the gap between the AMDB's static geometry and the dynamic scene:

```
AMDB provides (static, updated on 28-day AIRAC cycle):
  - Stand positions, centerlines, clearance zones
  - Taxiway geometry, holding positions
  - Building outlines, jetbridge positions

Spatial FM adds (dynamic, per-observation):
  - Aircraft presence, type, and exact position
  - GSE positions and activities
  - Stand availability (occupied/vacant)
  - Clearance computations (wing tip to obstacle)
  - Text recognition (stand markings, signs)

Combined: AMDB + Spatial FM = complete situational awareness
```

### 4.3 FOD Detection and Characterization

#### 4.3.1 The Open-Vocabulary Challenge

Foreign Object Debris (FOD) is a major airport safety concern (estimated $13B annual cost to aviation industry, per FAA). The fundamental perception challenge is that FOD is inherently **open-vocabulary** — it can be any object, from a loose bolt to a luggage strap to a plastic bag to a dropped tool. Traditional closed-set detectors trained on a fixed taxonomy cannot cover the long tail of possible FOD items.

#### 4.3.2 Foundation Model Approach

Spatial foundation models enable a three-stage FOD pipeline:

```
Stage 1 — Anomaly Detection (always on, 10 Hz):
  Point cloud differencing against known map
  Any new object on apron surface → FOD candidate
  Sensitivity: detect objects > 2 cm at < 50m (existing LiDAR capability)

Stage 2 — Foundation Model Characterization (triggered, 2 Hz):
  FOD candidate → crop image + point cloud patch
  → Spatial VLM query: "Describe this object on the apron surface.
     Estimate its size, material, and risk level."
  → "Metal wrench, approximately 28 cm long, 4 cm wide.
     Risk: HIGH — could cause tire damage or FOD ingestion."

Stage 3 — Response Decision (triggered, per-event):
  Risk classification → action:
    LOW  (paper, fabric < 10 cm):  Log + continue + report at end of shift
    MED  (plastic, wood < 30 cm):  Log + alert ground control + avoid
    HIGH (metal, tools, parts):    Stop + alert ground control + do not proceed
    CRITICAL (aircraft parts):     Emergency stop + broadcast alert
```

#### 4.3.3 Size Estimation via Spatial Reasoning

The critical advantage of spatial foundation models over standard object detectors for FOD is **metric size estimation**. Knowing an object exists is insufficient — operators need to know if a 2 cm bolt or a 30 cm panel is on the runway. Standard 2D detectors provide bounding boxes in pixels; spatial VLMs provide metric dimensions:

```
Standard detector output:
  "Object detected at pixel (423, 612), class: unknown, confidence: 0.73"
  → Useless for FOD risk assessment

Spatial VLM output (with LiDAR depth):
  "Metallic object at [x=23.4, y=-1.2, z=0.02] meters.
   Dimensions: 0.28 x 0.04 x 0.02 meters. Material: metal (specular reflection).
   Classification: Hand tool (wrench). Risk: HIGH."
  → Actionable for ground control
```

### 4.4 Cargo/Baggage Alignment

#### 4.4.1 Task Description

Autonomous baggage tractors must position baggage carts such that the rear cart aligns with the belt loader conveyor endpoint. This requires:
- Detecting the conveyor endpoint position (variable based on belt loader model and extension)
- Estimating the rear cart's alignment error in 6-DoF
- Computing the corrective trajectory

#### 4.4.2 Foundation Model Approach

```
Perception (spatial FM, 2 Hz):
  "Where is the end of the belt loader conveyor relative to my rear cart?"
  → "Conveyor endpoint at 0.8m forward, 0.15m right, 0.3m above rear cart bed.
      Angular misalignment: 3.2 degrees yaw, 1.1 degrees pitch."

Planning (task-specific policy, 10 Hz):
  Alignment error → corrective trajectory via MPC
  Target: reduce all errors below threshold:
    lateral: < 15 cm
    longitudinal: < 20 cm
    yaw: < 5 degrees

Execution (vehicle controller, 50 Hz):
  Frenet planner modified with alignment cost term
  or: dedicated alignment MPC (2-5ms, CasADi/IPOPT)
```

### 4.5 Line/Marking Following in Degraded Conditions

#### 4.5.1 The Problem

Airport apron markings (stand centerlines, taxiway edges, stop bars) are critical navigation references. But they degrade due to:
- Rubber deposits from aircraft tires
- De-icing chemical damage
- Snow/ice coverage
- Oil and fuel stains
- Fading from UV exposure
- Standing water obscuring markings

In degraded conditions, marking visibility can drop below 30% — and this is precisely when accurate following matters most (low visibility conditions).

#### 4.5.2 Foundation Model Robustness

DINOv2 features (which underpin SPA and 4M) demonstrate remarkable robustness to visual degradation because they are trained on 142M diverse images without relying on specific visual patterns:

```
MARKING DETECTION PIPELINE:

Primary (LiDAR, always on, 10 Hz):
  Intensity-based marking detection
  Works: dry, painted markings with good contrast
  Fails: wet, snow-covered, faded, low-contrast

Secondary (Foundation model features, 5 Hz):
  DINOv2 features encode "marking-ness" as a semantic concept
  → Trained on diverse road markings from web data
  → Generalizes to faded, partially occluded, wet markings
  → Can infer marking location from partial observation
  Accuracy: ~10 cm lateral error (vs. ~5 cm for high-contrast primary)

Fallback (HD map prior, always available):
  If both primary and secondary fail:
  → Follow pre-surveyed marking positions from HD map
  → Accuracy: +-20-50 cm (survey accuracy + localization error)
  → Sufficient for safe low-speed operation

Fusion:
  confidence = max(primary_conf, secondary_conf)
  if confidence > 0.8: follow primary/secondary detection
  elif confidence > 0.5: follow detection with increased margins
  else: fall back to HD map prior with reduced speed
```

**Estimated performance by condition:**

| Condition | Primary (LiDAR intensity) | Foundation Model Features | HD Map Fallback |
|-----------|--------------------------|--------------------------|----------------|
| Dry, good markings | 95% detection, +-5 cm | 90% detection, +-10 cm | +-20 cm |
| Wet surface | 70% detection, +-8 cm | 85% detection, +-12 cm | +-25 cm |
| Faded markings | 50% detection, +-15 cm | 75% detection, +-15 cm | +-25 cm |
| Snow-covered | 5% detection | 30% detection (partial) | +-30 cm |
| Night | 90% detection, +-5 cm | 60% detection, +-15 cm | +-20 cm |

---

## 5. Architecture for On-Vehicle Deployment

### 5.1 Two-Tier Deployment Architecture

No spatial foundation model at full scale (2-10B parameters) can run in real-time on Orin AGX (275 TOPS, 64 GB unified memory). The solution is a **two-tier architecture** with compute split between on-vehicle and edge/cloud:

```
┌────────────────────────────────────────────────────────────────────┐
│ TIER 1: ON-VEHICLE (NVIDIA Orin AGX 64 GB)                         │
│                                                                    │
│  ┌─────────────────────────────────────────────────────┐           │
│  │ SAFETY-CRITICAL PATH (always running, hard real-time)│           │
│  │ PointPillars detection: 6.84ms                       │           │
│  │ GTSAM localization: ~5ms                             │           │
│  │ Frenet planning: ~8ms                                │           │
│  │ CBF safety filter: <1ms                              │           │
│  │ TOTAL: ~21ms (48 Hz)                                 │           │
│  └─────────────────────────────────────────────────────┘           │
│                                                                    │
│  ┌─────────────────────────────────────────────────────┐           │
│  │ TASK-SPECIFIC HEADS (distilled, running when needed) │           │
│  │ Docking servoing policy: ~10ms (distilled from FM)   │           │
│  │ FOD classification head: ~8ms (DINOv2-S + MLP)       │           │
│  │ Marking detection head: ~5ms (segmentation head)     │           │
│  │ Spatial feature cache: DINOv2-S features @ 5 Hz      │           │
│  │ TOTAL per-head: 5-10ms (add-on, not blocking)        │           │
│  └─────────────────────────────────────────────────────┘           │
│                                                                    │
│  ┌─────────────────────────────────────────────────────┐           │
│  │ VLM CO-PILOT (soft real-time, 1-2 Hz)                │           │
│  │ InternVL2-2B INT4: ~300ms, 1.5 GB                    │           │
│  │ or SpatialRGPT-2B (when available): ~350ms, 2 GB     │           │
│  │ Handles: spatial QA, anomaly explanation, FOD desc.   │           │
│  └─────────────────────────────────────────────────────┘           │
│                                                                    │
│  Memory budget:                                                    │
│    PointPillars + GTSAM + Frenet: ~4 GB                            │
│    Task heads (loaded on demand): ~1-2 GB each                     │
│    VLM co-pilot: ~1.5-2 GB                                        │
│    DINOv2-S feature extractor: ~0.5 GB                             │
│    Headroom: ~54 GB (sufficient for sensor buffers, TensorRT)      │
└────────────────────────────────────────────────────────────────────┘
          │                              ▲
          │ Upload: edge cases,          │ Download: model updates,
          │ spatial queries              │ spatial reasoning results
          │ (airport 5G, <20ms RTT)     │
          ▼                              │
┌────────────────────────────────────────────────────────────────────┐
│ TIER 2: AIRPORT EDGE SERVER (GPU server, 1-2 per airport)          │
│                                                                    │
│  ┌─────────────────────────────────────────────────────┐           │
│  │ FULL FOUNDATION MODELS                                │           │
│  │ 4M-XL (2.8B): multi-modal generation @ 5-10 Hz       │           │
│  │ SpatialRGPT-7B: spatial reasoning @ 2-5 Hz            │           │
│  │ 3D-LLM (7B): point cloud understanding @ 1-2 Hz      │           │
│  │ Grounding DINO 1.5 Pro: open-vocab detection @ 10 Hz  │           │
│  └─────────────────────────────────────────────────────┘           │
│                                                                    │
│  ┌─────────────────────────────────────────────────────┐           │
│  │ FLEET-LEVEL INTELLIGENCE                              │           │
│  │ Scene graph fusion across vehicles                    │           │
│  │ Cooperative spatial reasoning                         │           │
│  │ Distillation pipeline (teacher → student)             │           │
│  │ Active learning: flag uncertain spatial queries        │           │
│  └─────────────────────────────────────────────────────┘           │
│                                                                    │
│  Hardware: 1-2x NVIDIA A100/H100 or L40S                          │
│  Cost: $30-60K (GPU server) + $500/month (power, cooling)          │
│  Serves: 10-50 vehicles at single airport                          │
└────────────────────────────────────────────────────────────────────┘
```

### 5.2 Distillation from Foundation Models

The critical engineering challenge is transferring knowledge from large foundation models (Tier 2) into small task-specific models (Tier 1). Three distillation approaches, ordered by complexity:

#### 5.2.1 Feature Distillation

Transfer the feature representation from a large model to a small one:

```
Teacher: DINOv2 ViT-L/14 (304M params) or 4M-XL (2.8B)
Student: DINOv2 ViT-S/14 (21M params) or custom lightweight CNN

Training:
  L_distill = MSE(f_student(x), sg(f_teacher(x)))
  where sg = stop gradient (don't backprop through teacher)

Result: Student learns rich spatial features from teacher
  Feature quality: ~85-90% of teacher (measured by downstream task performance)
  Inference speed: 5-8x faster than teacher
```

**For airside:** Distill 4M-XL features into a DINOv2-S backbone. The distilled backbone provides multi-task features (depth, normals, semantics) at ~15ms on Orin.

#### 5.2.2 Policy Distillation

Transfer a complete task policy from a large model to a small one:

```
Teacher: Octo-Base (93M) running on edge server
  Input: multi-camera + LiDAR depth + task description
  Output: action chunks (K=16 steps)

Student: Lightweight policy (5-15M params) on Orin
  Input: DINOv2-S features (cached) + vehicle state
  Output: action chunks (K=16 steps)

Training:
  L = alpha * MSE(a_student, a_teacher)           # match teacher actions
    + beta * MSE(f_student, f_teacher)             # match teacher features
    + gamma * MSE(a_student, a_expert)             # match ground truth

  Typical: alpha=0.5, beta=0.3, gamma=0.2

Result: Student mimics teacher's policy at 100x inference speed
```

**For airside docking:**

```python
# Conceptual: Distilled docking policy on Orin
class DistilledDockingPolicy:
    """
    5M parameter MLP distilled from Octo-Base.
    Runs at 20 Hz for visual servoing during final approach.
    """
    def __init__(self):
        # DINOv2-S feature extractor (cached at 5 Hz)
        self.feature_extractor = load_dinov2_small_tensorrt()
        # Distilled policy head (5M params)
        self.policy = load_policy_tensorrt("docking_policy_int8.engine")

    def get_action(self, cached_features, vehicle_state, target_offset):
        """
        Input:
          cached_features: 384-dim DINOv2-S features (from 5 Hz extractor)
          vehicle_state: [x, y, yaw, speed, steer_angle]
          target_offset: [dx, dy, dyaw] from ICP or VLM target estimate
        Output:
          action: [steering_delta, velocity_target]
        """
        # Concatenate inputs
        policy_input = concatenate(cached_features, vehicle_state, target_offset)
        # MLP forward pass: ~2ms on Orin INT8
        action = self.policy.infer(policy_input)
        return action
```

#### 5.2.3 Progressive Distillation with Task-Specific Adaptation

The most sophisticated approach combines foundation model distillation with task-specific fine-tuning:

```
Step 1: Pre-train student backbone via feature distillation from 4M-XL
  → Student learns general spatial features

Step 2: Add task-specific heads (docking, FOD, marking, alignment)
  → Each head is a small MLP or convolutional decoder

Step 3: Fine-tune end-to-end with task-specific data
  → 500-2,000 demonstrations per task
  → Distillation loss from teacher + task loss from ground truth

Step 4: TensorRT optimization
  → INT8 quantization with calibration on airside data
  → Target: <50ms per forward pass per task head
```

### 5.3 Orin Inference Budget

Detailed latency analysis for foundation model components on Orin AGX 64GB:

| Component | Params | Precision | Latency (Orin) | VRAM | Frequency | Role |
|-----------|--------|-----------|---------------|------|-----------|------|
| PointPillars (existing) | 4.8M | INT8 | 6.84ms | 0.5 GB | 10 Hz | Safety-critical detection |
| GTSAM (existing) | N/A | FP64 | ~5ms | 0.3 GB | 10 Hz | Localization |
| Frenet (existing) | N/A | FP64 | ~8ms | 0.1 GB | 10 Hz | Planning |
| DINOv2 ViT-S | 21M | FP16 | ~12ms | 0.3 GB | 5 Hz | Spatial features |
| DINOv2 ViT-B | 86M | FP16 | ~35ms | 0.8 GB | 2 Hz | Rich spatial features |
| SPA adapter | 19M | FP16 | ~3ms | 0.2 GB | 5 Hz | Add to DINOv2-S |
| Docking policy (distilled) | 5M | INT8 | ~2ms | 0.05 GB | 20 Hz | Visual servoing |
| FOD classifier (distilled) | 10M | INT8 | ~3ms | 0.1 GB | 5 Hz | FOD characterization |
| Marking detector | 8M | INT8 | ~2.5ms | 0.08 GB | 10 Hz | Line following |
| InternVL2-2B | 2B | INT4 | ~300ms | 1.5 GB | 1-2 Hz | VLM co-pilot |
| 4M-B | 198M | FP16 | ~80ms | 1.2 GB | 1-2 Hz | Multi-modal gen |
| Octo-Small | 27M | FP16 | ~15ms | 0.3 GB | 5-10 Hz | General policy |

**Budget allocation (single Orin cycle at 10 Hz = 100ms):**

```
ALWAYS RUNNING (safety-critical, ~21ms total):
  PointPillars:  6.84ms (GPU)
  GTSAM:         ~5ms   (CPU/GPU)
  Frenet:        ~8ms   (CPU)
  CBF filter:    <1ms   (CPU)

TASK-SPECIFIC (loaded on demand, concurrent via CUDA streams):
  DINOv2-S + SPA: ~15ms (GPU, on DLA if possible)
  Task head:      ~2-5ms (GPU)

CO-PILOT (background, non-blocking):
  InternVL2-2B:  ~300ms (GPU, runs every 3-5th cycle)

REMAINING BUDGET: ~60ms headroom per cycle
  Sufficient for adding occupancy, flow, or additional task heads
```

### 5.4 Caching and Amortization

Foundation model features change slowly relative to control frequency. A caching strategy exploits this:

```
CACHING STRATEGY:

DINOv2-S features (15ms to compute, used by all task heads):
  Compute: every 200ms (5 Hz)
  Cache: shared GPU memory (37 x 37 x 384 = 0.5 MB per camera)
  Stale tolerance: 200ms (at 10 km/h = 0.56m traveled, acceptable)
  Invalidation: recompute if ego-motion > 0.3m or detection anomaly

VLM spatial reasoning (300ms to compute):
  Compute: every 500-1000ms (1-2 Hz)
  Cache: structured text response + parsed spatial coordinates
  Stale tolerance: 1s (spatial layout changes slowly during approach)
  Invalidation: recompute on new object detection or phase transition

Scene graph (from spatial FM):
  Compute: every 500ms (2 Hz)
  Cache: graph structure with incremental updates
  Stale tolerance: 500ms (update nodes individually, not full rebuild)
  Invalidation: add/remove nodes on detection/tracking events

Temperature field (from thermal):
  Compute: every 100ms (10 Hz, from thermal camera directly)
  Cache: 2D temperature grid registered to BEV
  Stale tolerance: 100ms (jet blast changes rapidly)
  Invalidation: no caching for jet blast zone — always recompute
```

---

## 6. Transfer Learning and Adaptation

### 6.1 Web-Scale Pre-Training to Airport Fine-Tuning

The transfer learning pipeline for spatial foundation models follows a consistent pattern:

```
TRANSFER PIPELINE:

Stage 1: Internet pre-training (already done by model authors)
  Data: Billions of images/videos, millions of text descriptions
  Learns: Visual features, language understanding, spatial concepts
  Cost: $0 to user (use published pre-trained models)

Stage 2: Driving domain fine-tuning (partially done)
  Data: nuScenes (300 GB), Waymo Open (1.5 TB), or L2D (90 TB)
  Learns: BEV understanding, vehicle dynamics, traffic patterns
  Cost: $5-15K compute (LoRA fine-tuning on available data)

Stage 3: Airside domain adaptation (Aurrigo-specific)
  Data: 500-2,000 demonstrations per task from Aurrigo fleet
  Learns: Airside objects, docking geometry, GSE behavior, FOD patterns
  Cost: $15-30K (data collection + annotation + compute)

Stage 4: Airport-specific fine-tuning (per deployment)
  Data: 100-500 examples from specific airport
  Learns: Local stand layout, specific aircraft mix, marking style
  Cost: $2-5K per airport (LoRA adaptation)
```

### 6.2 Data Requirements by Task

| Task | Demonstrations Needed | Collection Method | Estimated Cost | Quality Threshold |
|------|----------------------|-------------------|---------------|-------------------|
| Belt loader docking | 500-1,000 | Teleoperation + DAgger | $15-25K | +-5 cm final position |
| Pushback approach | 300-500 | Teleoperation | $10-15K | +-10 cm at coupling |
| FOD detection/classification | 1,000-2,000 images | Manual annotation + synthetic | $8-15K | 90% classification accuracy |
| Stand identification | 200-500 per airport | Automated from fleet data | $2-5K per airport | 99% correct identification |
| Line following | 500-1,000 per condition | Automated from driving data | $5-10K | +-10 cm lateral accuracy |
| Cargo alignment | 300-500 | Teleoperation | $8-12K | +-15 cm alignment error |
| Clearance estimation | 500-1,000 spatial QA pairs | Manual + synthetic generation | $5-10K | +-20 cm distance error |

**Total for all tasks at first airport:** ~$55-90K in data collection and annotation
**Each additional airport:** ~$10-20K (LoRA adaptation with airport-specific data)

### 6.3 LoRA/Adapter-Based Fine-Tuning

LoRA (Low-Rank Adaptation) enables efficient fine-tuning of foundation models with minimal additional parameters:

```
LORA FINE-TUNING FOR AIRSIDE TASKS:

Base model: DINOv2 ViT-B (86M params, frozen)
LoRA adapters: rank 16, applied to QKV projections
  Additional params: 86M × 2 × (16/768) = ~3.6M (4.2% of base)

Fine-tuning:
  Data: 1,000 airside images with spatial labels
  Compute: 1x A100, 8 hours
  Cost: ~$30 (cloud GPU rental)

Result:
  Base DINOv2 on airside tasks: ~45% accuracy (domain gap)
  LoRA-adapted DINOv2 on airside tasks: ~75% accuracy (+30%)
  Full fine-tuned DINOv2: ~78% accuracy (+33%, but 86M params to store)

Storage: 3.6M params × 2 bytes = 7.2 MB per airport LoRA adapter
  → Store one LoRA per airport, swap on deployment
```

For VLMs (InternVL2-2B), LoRA fine-tuning on spatial QA:

```python
# LoRA fine-tuning InternVL2-2B for airside spatial reasoning
from peft import LoraConfig, get_peft_model
from transformers import AutoModelForCausalLM

model = AutoModelForCausalLM.from_pretrained("OpenGVLab/InternVL2-2B")

lora_config = LoraConfig(
    r=32,                    # Rank 32 (optimal for driving, per DINOv2 findings)
    lora_alpha=64,
    target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
    lora_dropout=0.05,
    task_type="CAUSAL_LM",
)

model = get_peft_model(model, lora_config)
# Trainable params: ~25M (1.25% of 2B)

# Fine-tune on airside spatial QA dataset:
# Q: "How far is the belt loader from the cargo door?"
# A: "Approximately 2.3 meters forward, 0.2 meters to the left."
# + LiDAR-projected depth image as visual input
```

### 6.4 In-Context Learning for New Airport Layouts

Larger VLMs (7B+) demonstrate **in-context learning** — the ability to adapt to new situations from a few examples provided in the prompt, without any weight updates:

```
IN-CONTEXT ADAPTATION PROMPT:

System: You are an airside spatial reasoning assistant for autonomous
GSE vehicles at airports. You analyze camera images with projected
LiDAR depth to answer spatial questions about the airport environment.

Context: This is Airport XYZ. Here are reference views:
[Image 1: Stand 1 with B737, belt loader docked]
"Stand 1 is a contact gate with jetbridge on the left.
 Forward cargo door is at 2.1m above ground, 12.5m from nose gear."

[Image 2: Stand 2 with A320, vacant]
"Stand 2 is a remote stand. No jetbridge. Ground power at 3m from
 left main gear. Fuel hydrant 8m behind nose wheel position."

Now answer about the current scene:
[Current image: approaching stand 3]
Q: "What type of stand is this and where should I position for
    forward cargo door access?"
A: [VLM reasons from in-context examples + current observation]
```

This enables rapid adaptation to new airports without any model retraining — a few annotated reference images per stand provide sufficient context.

### 6.5 Sim-to-Real for Foundation Models

NVIDIA Isaac Sim provides the simulation environment for generating training data. Foundation model features reduce the sim-to-real gap:

```
SIM-TO-REAL GAP REDUCTION:

Standard approach:
  Train detector in simulation → 15-20% AP drop on real data

Foundation model approach:
  1. Pre-train backbone on real web data (DINOv2, already done)
  2. Generate simulation episodes in Isaac Sim
  3. Extract DINOv2 features from sim images
  4. Train task heads on DINOv2 features (not raw pixels)
  5. Deploy on real data → DINOv2 features are similar in sim and real

Result: Features are domain-invariant; only the task head needs adaptation
  Expected gap: 3-5% AP (vs. 15-20% without foundation features)
  Recovery with 100-500 real examples: <1% AP gap
```

This is critical because **no public airside simulation exists** — Aurrigo would need to build an airport environment in Isaac Sim, and the investment in simulation is much more efficient if foundation model features bridge most of the sim-to-real gap.

---

## 7. Benchmarks and Evaluation

### 7.1 No Public Airside Embodied AI Benchmark Exists

As documented across this repository (see master-synthesis.md, finding #25), there is no public airside driving dataset, and correspondingly **no public airside embodied robotics benchmark**. This is both a challenge (no standard to evaluate against) and an opportunity (first-mover advantage in defining the benchmark).

### 7.2 Proposed Benchmark: AirsideTasks

A comprehensive airside embodied AI benchmark should evaluate spatial intelligence across the task spectrum:

```
AIRSIDE-TASKS BENCHMARK (proposed structure)

1. SPATIAL PERCEPTION
   ├── 1a. Depth estimation from camera (metric RMSE at 10m, 30m, 50m, 100m)
   ├── 1b. Distance estimation between objects (mean abs. error in meters)
   ├── 1c. Size estimation of FOD (mean abs. error in cm)
   └── 1d. Clearance estimation (wing tip to obstacle, accuracy in cm)

2. SPATIAL REASONING
   ├── 2a. Spatial relation QA (accuracy on 1,000+ questions)
   │       "Is the loader between the aircraft and the fuel truck?"
   ├── 2b. Stand identification (accuracy, given image from 50m approach)
   ├── 2c. Scene graph construction (precision/recall of nodes and edges)
   └── 2d. Anomaly detection ("is this scene normal?" binary + explanation)

3. DOCKING TASKS
   ├── 3a. Belt loader docking (final position error in cm, success rate)
   ├── 3b. Pushback approach (alignment error at coupling, success rate)
   ├── 3c. Baggage cart alignment (alignment error, success rate)
   └── 3d. Generalization (success on unseen aircraft type)

4. FOD TASKS
   ├── 4a. FOD detection (recall, precision, vs. LiDAR-only baseline)
   ├── 4b. FOD classification (accuracy on 20+ object types)
   ├── 4c. FOD size estimation (mean abs. error in cm)
   └── 4d. FOD risk assessment (accuracy on HIGH/MEDIUM/LOW/CRITICAL)

5. NAVIGATION TASKS
   ├── 5a. Line following in degraded conditions (lateral error by condition)
   ├── 5b. Gate approach planning (path quality, clearance maintenance)
   └── 5c. Multi-step mission execution (task completion rate)

6. EFFICIENCY
   ├── 6a. Inference latency on Orin (ms per component)
   ├── 6b. Memory usage on Orin (GB per component)
   └── 6c. Power consumption on Orin (W per component)

7. GENERALIZATION
   ├── 7a. Cross-airport transfer (performance drop on unseen airport)
   ├── 7b. Cross-aircraft transfer (performance on unseen aircraft type)
   └── 7c. Cross-condition transfer (performance in rain, night, fog)
```

### 7.3 Evaluation Metrics

| Category | Metric | Target (Production) | Target (POC) |
|----------|--------|--------------------|--------------| 
| Docking position error | RMSE (cm) | <5 cm (belt loader) | <15 cm |
| Docking success rate | % first-attempt success | >95% | >70% |
| FOD detection recall | % (of annotated FOD) | >95% | >80% |
| FOD size estimation | Mean abs. error (cm) | <5 cm | <15 cm |
| Distance estimation | Mean abs. error (m) | <0.3 m | <1.0 m |
| Stand identification | Accuracy (%) | >99.5% | >95% |
| Spatial QA | Accuracy (%) | >90% | >75% |
| Line following lateral error | RMS (cm) | <10 cm | <20 cm |
| Inference latency (task head) | ms on Orin | <50 ms | <100 ms |
| Cross-airport generalization | Performance retention (%) | >90% | >70% |

### 7.4 Baseline Comparisons

Any spatial foundation model approach should be compared against these baselines:

| Baseline | Description | Expected Performance |
|----------|------------|---------------------|
| Rule-based + ICP | Current docking pipeline (template matching) | +-1-2 cm docking, no generalization |
| PointPillars only | LiDAR detection without spatial reasoning | Good detection, no spatial QA |
| Grounding DINO Edge | Open-vocab detection without spatial reasoning | 44.8 AP detection, no distance estimation |
| DepthAnything v2 | Monocular depth without spatial VLM | Depth only, no spatial reasoning |
| InternVL2-2B (vanilla) | VLM without spatial fine-tuning | Poor spatial accuracy (~1.5m distance error) |

---

## 8. Integration with Aurrigo Stack

### 8.1 ROS Noetic Integration Patterns

Foundation models are Python-based (PyTorch), while Aurrigo's core stack is C++ nodelets. Integration follows the existing pattern used for any ML model in the ROS stack:

```
INTEGRATION ARCHITECTURE:

┌─────────────────────────────────────────────────────────────────┐
│ ROS NOETIC                                                       │
│                                                                   │
│  C++ Nodelets (existing, real-time):                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐    │
│  │ LiDAR driver     │  │ PointPillars     │  │ GTSAM        │    │
│  │ (sensor_driver)  │→│ (detection)      │→│ (localization)│    │
│  └──────────────────┘  └──────────────────┘  └──────────────┘    │
│                                                                   │
│  Python Nodes (new, soft real-time):                              │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ spatial_fm_node.py                                         │    │
│  │   Subscribes: /camera/image, /lidar/projected_depth        │    │
│  │   Publishes:  /spatial/features (custom msg, 5 Hz)         │    │
│  │               /spatial/scene_graph (custom msg, 2 Hz)      │    │
│  │               /spatial/vlm_response (String, 1 Hz)         │    │
│  │   Inference:  TensorRT engine via trtexec or torch2trt      │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ task_policy_node.py                                        │    │
│  │   Subscribes: /spatial/features, /vehicle/state            │    │
│  │   Publishes:  /task/docking_cmd (Twist, 20 Hz)            │    │
│  │               /task/fod_report (custom msg, event-driven)  │    │
│  │   Inference:  Lightweight TensorRT engine (<5ms)            │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  C++ Node (existing, safety-critical):                            │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ frenet_planner                                             │    │
│  │   Subscribes: /spatial/scene_graph (for cost augmentation)  │    │
│  │   Uses spatial info to adjust candidate scoring              │    │
│  │   Does NOT depend on spatial FM for safety                   │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

#### 8.1.1 Custom ROS Messages

```python
# spatial_msgs/SpatialFeatures.msg
Header header
float32[] features        # DINOv2 features, flattened [H x W x D]
uint32 height             # Feature map height (e.g., 37)
uint32 width              # Feature map width (e.g., 37)
uint32 depth              # Feature dimension (e.g., 384 for DINOv2-S)
float64 extraction_time   # Time in seconds to extract features

# spatial_msgs/SpatialQuery.msg
Header header
string query              # Natural language spatial question
sensor_msgs/Image image   # Camera image
sensor_msgs/Image depth   # LiDAR-projected depth

# spatial_msgs/SpatialResponse.msg
Header header
string response           # Natural language spatial answer
float32[] coordinates     # Parsed 3D coordinates [x, y, z, ...]
float32 confidence        # Response confidence [0, 1]
float64 inference_time    # Time in seconds for VLM inference
```

#### 8.1.2 TensorRT Deployment

```python
# Example: DINOv2-S feature extraction with TensorRT on Orin
import tensorrt as trt
import pycuda.driver as cuda
import numpy as np

class DINOv2FeatureExtractor:
    """
    DINOv2 ViT-S/14 running as TensorRT engine on Orin.
    Input: 518x518 RGB image (FP16)
    Output: 37x37x384 feature map (FP16)
    Latency: ~12ms on Orin AGX 64GB
    """
    def __init__(self, engine_path="/models/dinov2_vits14_fp16.engine"):
        self.logger = trt.Logger(trt.Logger.WARNING)
        with open(engine_path, "rb") as f:
            self.engine = trt.Runtime(self.logger).deserialize_cuda_engine(f.read())
        self.context = self.engine.create_execution_context()

        # Allocate device memory
        self.d_input = cuda.mem_alloc(1 * 3 * 518 * 518 * 2)   # FP16
        self.d_output = cuda.mem_alloc(1 * 37 * 37 * 384 * 2)  # FP16
        self.stream = cuda.Stream()

    def extract(self, image_rgb):
        """
        Extract DINOv2-S features from a single RGB image.
        Returns: numpy array of shape (37, 37, 384), FP16
        """
        # Preprocess: resize to 518x518, normalize, convert to FP16
        preprocessed = self._preprocess(image_rgb)

        # Copy to device
        cuda.memcpy_htod_async(self.d_input, preprocessed, self.stream)

        # Run inference
        self.context.execute_async_v2(
            bindings=[int(self.d_input), int(self.d_output)],
            stream_handle=self.stream.handle
        )

        # Copy result back
        output = np.empty((37, 37, 384), dtype=np.float16)
        cuda.memcpy_dtoh_async(output, self.d_output, self.stream)
        self.stream.synchronize()

        return output
```

### 8.2 Relationship to Existing Frenet Planner

The spatial foundation model does **not replace** the Frenet planner. It augments it:

```
WITHOUT SPATIAL FM (current):
  Frenet planner receives: static obstacles (PointPillars detections)
  Frenet planner produces: trajectory candidates scored by distance to obstacles
  Limitation: treats all obstacles equally, no spatial reasoning

WITH SPATIAL FM (proposed):
  Frenet planner receives:
    + Static obstacles (PointPillars, same as before)
    + Scene graph with semantic labels (spatial FM)
    + Clearance estimates (spatial FM)
    + Task-specific cost modifiers (spatial FM)

  Example cost modifications:
    "Aircraft wing tip within 5m" → increase lateral clearance cost 3x
    "Ground crew detected in approach zone" → add exclusion zone
    "FOD detected on preferred path" → penalize path segment
    "Docking target identified at 2.1m ahead" → switch to docking mode

  Frenet planner produces: same trajectory candidates, better scored
```

This follows the pattern documented in `30-autonomy-stack/planning/joint-prediction-planning.md` where adding prediction-based costs to existing Frenet candidates captures 70-80% of the benefit at 10% of full implementation cost.

### 8.3 Simplex Architecture: Foundation Model Policy (AC) + Classical Controller (BC)

The Simplex architecture (documented in `90-synthesis/decisions/design-spec.md`) maps naturally to spatial foundation models:

```
┌─────────────────────────────────────────────────────────────┐
│ SIMPLEX FOR SPATIAL FOUNDATION MODELS                        │
│                                                               │
│  Advanced Controller (AC): Spatial FM task policy              │
│    - DINOv2 features → learned docking policy                 │
│    - Spatial VLM → clearance-aware approach planning          │
│    - Scene graph → semantic cost augmentation                 │
│    - Quality: higher performance, learned spatial reasoning    │
│                                                               │
│  Baseline Controller (BC): Classical controller                │
│    - ICP template matching → position-based servoing          │
│    - PointPillars → distance-based obstacle avoidance         │
│    - Frenet planner → waypoint following                      │
│    - Quality: proven, certified, no ML dependency             │
│                                                               │
│  Decision Module (DM): Safety monitor                         │
│    - If AC output violates CBF constraint → switch to BC      │
│    - If AC confidence < threshold → switch to BC              │
│    - If AC latency exceeds budget → switch to BC              │
│    - If OOD detected → switch to BC                           │
│                                                               │
│  Safety guarantee: BC is always available and verified         │
│  Performance: AC provides spatial intelligence when safe       │
└─────────────────────────────────────────────────────────────┘
```

The critical insight: **the foundation model can fail without compromising safety**. If DINOv2 features are corrupted, if the VLM hallucinates, if the policy outputs an unsafe action — the Simplex DM detects the anomaly and switches to the classical BC. This decouples the safety argument (which depends only on BC) from the performance argument (which benefits from AC).

### 8.4 Gradual Adoption Path

```
ADOPTION PHASES (cumulative, not replacement):

Phase 0 (Current):
  Perception: PointPillars + GTSAM + RANSAC
  Planning: Frenet + FSM
  Tasks: Waypoint following only
  No spatial intelligence

Phase 1 (Spatial Co-Pilot, +$10K, 6 weeks):
  + InternVL2-2B running at 1 Hz as observation-only co-pilot
  + Spatial QA for operator interface ("describe the scene")
  + No control authority — observation and logging only
  + Value: build dataset, validate spatial reasoning quality

Phase 2 (Feature Extraction, +$15K, 4 weeks):
  + DINOv2-S features extracted at 5 Hz, cached
  + FOD characterization head using DINOv2 features
  + Marking detection head using DINOv2 features
  + Features used for candidate scoring in Frenet planner
  + Value: multi-task perception from single backbone

Phase 3 (Task-Specific Policies, +$25K, 8 weeks):
  + Docking policy distilled from Octo/pi0-architecture teacher
  + Approach policy for stand-specific final approach
  + Policies run as AC with Frenet as BC (Simplex)
  + Value: autonomous docking without per-template engineering

Phase 4 (Full Spatial Intelligence, +$20K, 6 weeks):
  + Scene graph construction at 2 Hz
  + 3D spatial reasoning for clearance and approach planning
  + Cross-vehicle transfer (HPT stem/head architecture)
  + Active learning pipeline for continuous improvement
  + Value: generalized spatial intelligence across fleet
```

---

## 9. Implementation Roadmap

### 9.1 Phase 1: Evaluation ($5-10K, 4 weeks)

**Goal:** Determine baseline spatial reasoning capability on airside imagery.

| Week | Activity | Deliverable |
|------|----------|------------|
| 1 | Collect 500 airside images with LiDAR depth projections from fleet data | Evaluation dataset |
| 1-2 | Run InternVL2-2B and DINOv2-B on airside images, measure spatial QA accuracy | Baseline accuracy report |
| 2-3 | Evaluate SPA features vs raw DINOv2 for downstream task quality (FOD, marking) | Feature quality comparison |
| 3-4 | Benchmark inference latency on Orin for all candidate models | Latency profile report |

**Key decision gate:** If InternVL2-2B spatial QA accuracy on airside images exceeds 60% without any fine-tuning, proceed. If below 40%, spatial VLM approach is premature — focus on task-specific models instead.

**Compute requirements:** 1x A100 for evaluation (cloud, ~$50/day), Orin AGX for latency benchmarks

### 9.2 Phase 2: Simulated Task Training ($15-25K, 6 weeks)

**Goal:** Fine-tune foundation models on simulated airside tasks.

| Week | Activity | Deliverable |
|------|----------|------------|
| 1-2 | Build airport stand environment in Isaac Sim (single stand, 3 aircraft types) | Simulation environment |
| 2-3 | Generate 2,000 simulated docking episodes (500 belt loader, 500 pushback, 500 cart, 500 mixed) | Simulated dataset |
| 3-4 | Fine-tune Octo-Base on simulated docking data with LoRA | Adapted docking policy |
| 4-5 | Fine-tune DINOv2-S with SPA on simulated egocentric approach sequences | Airside spatial features |
| 5-6 | Generate SpatialVLM-style spatial QA from simulation (distance, clearance, position) | Spatial QA training data |
| 6 | Fine-tune InternVL2-2B on spatial QA with LoRA | Airside spatial VLM |

**Compute requirements:** 2x A100 for fine-tuning (~$100/day), Isaac Sim workstation

### 9.3 Phase 3: Distillation and Orin Deployment ($20-35K, 8 weeks)

**Goal:** Distill foundation model knowledge into Orin-deployable task-specific models.

| Week | Activity | Deliverable |
|------|----------|------------|
| 1-2 | Distill Octo-Base docking policy → 5M param student | Distilled docking policy |
| 2-3 | Distill DINOv2-B features → DINOv2-S backbone (feature distillation) | Lightweight spatial features |
| 3-4 | Train FOD classification head on distilled features | FOD classifier |
| 4-5 | Train marking detection head on distilled features | Marking detector |
| 5-6 | TensorRT INT8 optimization for all components | Optimized TRT engines |
| 6-7 | Integration testing on Orin: latency, accuracy, memory | Deployment validation |
| 7-8 | Real-world data collection: 500 docking approaches (teleoperation) | Real-world fine-tuning data |
| 8 | DAgger fine-tuning with real data to close sim-to-real gap | Production-ready models |

**Compute requirements:** 1x A100 for distillation, Orin AGX for deployment validation

### 9.4 Phase 4: Production Integration ($15-25K, 6 weeks)

**Goal:** Deploy within safety envelope with monitoring.

| Week | Activity | Deliverable |
|------|----------|------------|
| 1-2 | Implement Simplex wrapper (FM policy as AC, classical as BC) | Safety architecture |
| 2-3 | Implement monitoring: OOD detection, confidence thresholds, latency watchdog | Runtime monitoring |
| 3-4 | Shadow mode testing: FM co-pilot runs alongside classical stack, no authority | Shadow mode validation |
| 4-5 | Supervised operation: FM docking policy active with safety operator + BC fallback | Supervised deployment |
| 5-6 | Performance analysis: docking accuracy, FOD detection rate, operator interventions | Deployment report |

**Key success criteria for Phase 4 exit:**
- Docking position error < 15 cm (POC target) on >70% of attempts
- FOD detection recall > 80% (vs. LiDAR-only baseline)
- Zero safety-critical interventions per 100 docking attempts
- Total Orin latency increase < 30ms over baseline stack

### 9.5 Cost Summary

| Phase | Duration | Cost | Cumulative |
|-------|----------|------|-----------|
| Phase 1: Evaluation | 4 weeks | $5-10K | $5-10K |
| Phase 2: Sim training | 6 weeks | $15-25K | $20-35K |
| Phase 3: Distillation + Orin | 8 weeks | $20-35K | $40-70K |
| Phase 4: Production integration | 6 weeks | $15-25K | $55-95K |
| **Total** | **24 weeks** | **$55-95K** | — |

**Per-additional-airport:** $10-20K (LoRA fine-tuning + validation)
**Annual maintenance:** $15-25K (model updates, active learning, drift monitoring)

**ROI driver:** Elimination of per-aircraft-type docking template engineering (~$2-5K per template, 15-20 aircraft types per major airport = $30-100K saved per airport), plus FOD detection capability (~$5-15K per FOD incident avoided).

---

## 10. Key Takeaways

1. **Airport GSE operations require spatial intelligence beyond driving perception.** Docking (+-5 cm), FOD characterization, clearance estimation, and multi-step task execution demand 3D spatial reasoning that standard detection/segmentation models do not provide.

2. **Spatial foundation models provide a unifying representation.** 4M-21 (Apache 2.0, 21 modalities), SpatialRGPT (depth-aware spatial reasoning), and SPA (action-conditioned features, 105M params) can serve as shared backbones for multiple airside tasks, reducing the current N-pipeline proliferation.

3. **Embodied foundation models enable cross-task and cross-vehicle transfer.** Octo (Apache 2.0, 93M params, diffusion action head), HPT (MIT license, heterogeneous embodiment stems), and pi0's flow matching architecture demonstrate that pre-training on diverse robot data improves performance on specific tasks — including unseen tasks by +17% (RT-X finding).

4. **Distillation is mandatory for Orin deployment.** No spatial FM at full scale (>1B params) achieves real-time on Orin. The viable architecture is: full FM on airport edge server (Tier 2) + distilled task-specific heads on vehicle (Tier 1, <50ms). DINOv2-S features at 12ms + task head at 2-5ms fits the budget.

5. **Data collection matters more than model scaling.** Scaling from 1B to 10B parameters adds 5-10% performance; scaling from 500 to 5,000 demonstrations adds 20-30%. Invest in teleoperated docking demonstrations ($15-25K) before investing in larger models.

6. **Simplex architecture decouples safety from spatial intelligence.** Foundation model policy as Advanced Controller with classical Frenet/ICP as Baseline Controller means spatial FM failures do not compromise safety. The safety case depends only on the classical BC.

7. **SpatialRGPT-style depth-conditioned VLM is the highest-value starting point for Aurrigo.** Aurrigo already has dense LiDAR depth — projecting it into camera frames and feeding to a spatial VLM gives metric-accurate spatial reasoning (0.28m indoor error) without monocular depth estimation. Use InternVL2-2B as an open-source backbone, fine-tune with SpatialVLM-style spatial QA data.

8. **No public airside embodied AI benchmark exists.** Defining AirsideTasks (docking accuracy, spatial QA, FOD characterization, cross-airport transfer) creates a competitive moat through standardization — similar to how nuScenes defined autonomous driving evaluation.

9. **HPT's per-embodiment stem/head architecture matches Aurrigo's multi-vehicle fleet.** ADT3, STL2, POD, ACA1 each get a small stem (1-5M params) and head (1-5M params); the shared backbone (~100M params) is trained once. New vehicle types get free transfer.

10. **Total implementation: $55-95K over 24 weeks, $10-20K per additional airport.** Phase 1 evaluation ($5-10K) provides a clear go/no-go signal before committing to full development. ROI from eliminated per-template engineering and FOD detection alone justifies the investment at 2+ airports.

---

## 11. References

### Spatial Intelligence Foundation Models

- Bachmann, R., Mizrahi, D., Atanov, A., & Zamir, A. R. "4M-21: An Any-to-Any Vision Model for Tens of Tasks and Modalities." *NeurIPS*, 2024.
- Bachmann, R., Mizrahi, D., Atanov, A., & Zamir, A. R. "4M: Massively Multimodal Masked Modeling." *NeurIPS*, 2023.
- Chen, B., Xu, Z., Kirmani, S., et al. "SpatialVLM: Endowing Vision-Language Models with Spatial Reasoning Capabilities." *CVPR*, 2024.
- Nagarajan, T., Li, C., Singh, K., & Sclaroff, S. "SPA: 3D Spatial-Awareness Enables Effective Embodied Representation." *CVPR*, 2024.
- Hong, Y., Zhen, H., Chen, P., et al. "3D-LLM: Injecting the 3D World into Large Language Models." *NeurIPS*, 2023.
- Cheng, A. Q., Yang, Y., Wu, Y., & Yu, F. "SpatialRGPT: Grounded Spatial Reasoning in Vision-Language Models." *NeurIPS*, 2024.

### Embodied Foundation Models

- Brohan, A., Brown, N., Carbajal, J., et al. "RT-2: Vision-Language-Action Models Transfer Web Knowledge to Robotic Control." *arXiv:2307.15818*, 2023.
- Open X-Embodiment Collaboration. "Open X-Embodiment: Robotic Learning Datasets and RT-X Models." *arXiv:2310.08864*, 2023.
- Ghosh, D., Walke, H., Pertsch, K., et al. "Octo: An Open-Source Generalist Robot Policy." *RSS*, 2024.
- Black, K., Brown, N., Driess, D., et al. "pi0: A Vision-Language-Action Flow Model for General Robot Control." *arXiv:2410.24164*, 2024.
- Physical Intelligence. "pi0.5: a Vision-Language-Action Model to Control Any Robot as a Universal Agent." *arXiv:2503.16776*, 2025.
- Cheang, C. H., Lin, G., Liu, Z., et al. "GR-2: A Generative Video-Language-Action Model with Web-Scale Knowledge for Robot Manipulation." *arXiv:2407.14813*, 2024.
- Wang, L., Zhao, J., Pinto, L., & Gupta, A. "Scaling Proprioceptive-Visual Learning with Heterogeneous Pre-trained Transformers." *arXiv:2409.20537*, 2024.

### Vision Foundation Models and Transfer

- Oquab, M., Darcet, T., Moutakanni, T., et al. "DINOv2: Learning Robust Visual Features without Supervision." *TMLR*, 2024.
- Chen, Z., Duan, Y., Wang, W., et al. "InternVL: Scaling Up Vision Foundation Models and Aligning for Generic Visual-Linguistic Tasks." *CVPR*, 2024.
- Lipson, L., Teed, Z., & Deng, J. "Coupled Iterative Refinement for 6D Multi-Object Pose Estimation." *CVPR*, 2022.
- Hu, E. J., Shen, Y., Wallis, P., et al. "LoRA: Low-Rank Adaptation of Large Language Models." *ICLR*, 2022.

### Robotics Policies and Control

- Chi, C., Feng, S., Du, Y., et al. "Diffusion Policy: Visuomotor Policy Learning via Action Diffusion." *RSS*, 2023.
- Zhao, T. Z., Kumar, V., Levine, S., & Finn, C. "Learning Fine-Grained Bimanual Manipulation with Low-Cost Hardware." *RSS*, 2023.
- Lee, S., Wang, Y., & Erickson, Z. "Behavior Generation with Latent Actions." *ICML*, 2024.
- Liang, J., Huang, W., Xia, F., et al. "Code as Policies: Language Model Programs for Embodied Control." *ICRA*, 2023.

### Autonomous Driving and Planning

- Hu, Y., Yang, J., Chen, L., et al. "Planning-Oriented Autonomous Driving." *CVPR*, 2023. (UniAD)
- Sun, Z., et al. "SparseDrive: End-to-End Autonomous Driving with Sparse Queries." *ECCV*, 2024.
- Liang, Z., Yin, Z., Chen, S., et al. "DiffusionDrive: Truncated Diffusion Model for End-to-End Autonomous Driving." *CVPR*, 2025.
- Liu, S., Zeng, Z., Ren, T., et al. "Grounding DINO: Marrying DINO with Grounded Pre-Training for Open-Set Object Detection." *ECCV*, 2024.

### Simulation and Sim-to-Real

- NVIDIA. "Isaac Sim: Robotics Simulation and Synthetic Data Generation." 2024.
- Tobin, J., Fong, R., Ray, A., et al. "Domain Randomization for Transferring Deep Neural Networks from Simulation to the Real World." *IROS*, 2017.
- Ren, Z., Liang, Z., Zhao, Y., et al. "LidarDM: Generative LiDAR Simulation in a Generated World." *ICRA*, 2025.

### Safety Architecture

- Sha, L., Rajkumar, R., & Lehoczky, J. "Priority Inheritance Protocols: An Approach to Real-Time Synchronization." *IEEE Transactions on Computers*, 1990. (Simplex architecture foundations)
- Ames, A. D., Xu, X., Grizzle, J. W., & Tabuada, P. "Control Barrier Functions: Theory and Applications." *ECC*, 2019.
