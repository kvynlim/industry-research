# LiDAR-Native World Models for Autonomous Driving

## Point Cloud Prediction, 4D Occupancy Forecasting, and Deployment for Airport Airside Operations

**Last updated:** 2026-04-11

---

> **Key Takeaway:** Camera-centric world models generate images or video -- representations that a LiDAR-primary stack cannot directly consume. LiDAR-native world models predict future point clouds, voxel occupancy, or range images in the same metric coordinate system the planner already operates in. For a LiDAR-primary airside AV like Aurrigo, this eliminates the modality translation problem entirely. Copilot4D proved LiDAR future prediction is viable (65% Chamfer distance reduction). UnO demonstrated that self-supervised LiDAR occupancy forecasting outperforms supervised baselines. The field is converging on voxel-tokenized discrete diffusion and continuous occupancy fields as the two dominant paradigms. Both are deployable on Orin within 50-100ms for 3-step prediction, and both train self-supervised -- critical when no public airside LiDAR datasets exist.

---

## Table of Contents

1. [Why LiDAR-Native World Models](#1-why-lidar-native-world-models)
2. [Copilot4D: Discrete Diffusion on LiDAR Tokens](#2-copilot4d-discrete-diffusion-on-lidar-tokens)
3. [UnO: Unsupervised Occupancy Fields](#3-uno-unsupervised-occupancy-fields)
4. [LidarDM: Map-Conditioned LiDAR Generation](#4-lidardm-map-conditioned-lidar-generation)
5. [LiDARCrafter: Language-Guided 4D LiDAR Generation](#5-lidarcrafter-language-guided-4d-lidar-generation)
6. [4D Occupancy Forecasting with LiDAR Input](#6-4d-occupancy-forecasting-with-lidar-input)
7. [Point Cloud Prediction Networks](#7-point-cloud-prediction-networks)
8. [Multi-Sensor Fusion World Models](#8-multi-sensor-fusion-world-models)
9. [AD-L-JEPA: Embedding-Space LiDAR Prediction](#9-ad-l-jepa-embedding-space-lidar-prediction)
10. [Training LiDAR World Models on Airside Data](#10-training-lidar-world-models-on-airside-data)
11. [Deployment on NVIDIA Orin](#11-deployment-on-nvidia-orin)
12. [Applications for Airside Safety](#12-applications-for-airside-safety)
13. [Comparison Table](#13-comparison-table)
14. [Recommended Roadmap](#14-recommended-roadmap)
15. [References](#15-references)

---

## 1. Why LiDAR-Native World Models

### 1.1 The Modality Mismatch Problem

The dominant world model research (GAIA-1/2/3, Sora, Vista, DrivingWorld) generates **video frames** -- pixel-space predictions of what the camera will see. This is natural for camera-primary stacks (Wayve, Tesla, comma.ai) but creates a fundamental mismatch for LiDAR-primary stacks:

| Camera World Model Output | LiDAR Stack Needs |
|--------------------------|-------------------|
| RGB pixel predictions | 3D point coordinates (x, y, z) |
| BEV from image lifting | Native BEV from point cloud |
| Relative depth estimates | Absolute metric distances |
| 2D flow vectors | 3D velocity vectors |
| Appearance-based prediction | Geometry-based prediction |
| Resolution: ~1280x720 pixels | Resolution: ~200K points/scan |

The Aurrigo stack operates entirely in metric 3D coordinates: GTSAM localization produces metric poses, Frenet planning uses metric distances, and the safety controller checks metric clearances. A world model that predicts in pixel space requires an additional depth estimation stage to convert back to 3D -- introducing error, latency, and architectural complexity that is entirely avoidable.

### 1.2 What LiDAR-Native World Models Predict

LiDAR-native world models operate directly on point cloud or voxel representations. They predict one (or more) of:

```
Input:  LiDAR scans at t-T, t-T+1, ..., t (past T frames)
        Optional: ego action a_t, HD map M

Output options:
  1. Future point clouds:    P_{t+1}, P_{t+2}, ..., P_{t+K}
  2. Future voxel occupancy: O_{t+1}, O_{t+2}, ..., O_{t+K}
  3. Future range images:    R_{t+1}, R_{t+2}, ..., R_{t+K}
  4. Future occupancy flow:  {O_k, F_k} for k = t+1 ... t+K
  5. Continuous 4D field:    f(x, y, z, t) → {occupied, flow}
```

All of these outputs are in the same metric coordinate frame the planner uses. No conversion, no lifting, no depth estimation.

### 1.3 Metric Accuracy: Why It Matters for Safety

Camera world models inherently operate in a projective space where metric distances are ambiguous. A predicted image cannot distinguish between a small object nearby and a large object far away. LiDAR world models preserve **absolute metric distances** because they operate on range measurements:

| Safety Requirement | Camera World Model | LiDAR World Model |
|-------------------|-------------------|-------------------|
| "Is the aircraft 15m away?" | Requires depth estimation (10-20% error at range) | Direct: range measurement in prediction |
| "Will the GSE be within 2m in 3s?" | Requires 3D trajectory extraction from video | Direct: predicted point cloud positions |
| "Is there a 0.5m clearance?" | Sub-meter accuracy unreliable beyond 20m | Sub-meter accuracy maintained to 100m+ |
| "Is FOD stationary or moving?" | Requires optical flow + depth → 3D flow | Direct: 3D flow in voxel space |

For airside operations where clearances are tight (wing tips within 2-3m of obstacles, personnel within arm's reach of equipment), metric prediction accuracy is not optional -- it is a safety requirement.

### 1.4 Advantages for Airport Airside

**Aircraft trajectory prediction:** Aircraft during pushback follow predictable geometric arcs defined by the nose gear steering angle and the pushback tractor's path. A LiDAR world model that has observed pushback sequences can predict the 3D swept volume of an aircraft 5-10 seconds ahead -- directly providing the forbidden zone for ego path planning.

**GSE motion prediction:** Baggage tractors, belt loaders, catering trucks, and fuel bowsers follow semi-structured patterns during turnaround. A LiDAR world model trained on turnaround sequences learns these patterns as 3D occupancy evolution, providing trajectory predictions without requiring per-vehicle-type detection and tracking.

**FOD persistence modeling:** LiDAR world models naturally separate static and dynamic scene elements. A detected object that persists in the same voxels across predicted future frames is confirmed stationary (debris, tool left on apron). One that disappears or moves is dynamic (person walking, vehicle in motion). This static/dynamic decomposition is critical for FOD assessment.

**Metric safety envelopes:** The planner can directly query predicted future occupancy: "At t+3s, is any voxel within my planned swept volume occupied?" This is a native operation in voxel space. The equivalent query in pixel space requires projecting the swept volume into image coordinates, checking predicted images, and converting back -- lossy and slow.

### 1.5 Relationship to Camera-Centric Work in This Repository

This document complements the existing camera-centric world model research:

| Document | Focus | Modality |
|----------|-------|----------|
| `overview.md` | GAIA-1/2, Cosmos, DriveWorld, Think2Drive | Camera (video generation) |
| `diffusion-world-models.md` | Sora, DriveDreamer, Drive-WM | Camera (diffusion video) |
| `tokenized-and-jepa.md` | DrivingGPT, GAIA-1, VQ-VAE | Camera (token prediction) |
| `occupancy-world-models.md` | OccWorld, Drive-OccWorld, OccSora | Camera BEV (occupancy) |
| `occupancy-deployment-orin.md` | FlashOcc, nvblox | Camera/LiDAR (occupancy) |
| **This document** | **Copilot4D, UnO, LidarDM, LiDARCrafter** | **LiDAR-native** |

The key architectural point: occupancy world models (OccWorld, Drive-OccWorld) operate on BEV/voxel representations that are **modality-agnostic** at the world model stage. They can be driven by either camera-based BEV encoders or LiDAR-based voxelization. The LiDAR-native world models covered here either operate directly on raw point clouds/range images or use LiDAR-specific tokenization.

---

## 2. Copilot4D: Discrete Diffusion on LiDAR Tokens

### 2.1 Overview

**Paper:** "Learning Unsupervised World Models for Autonomous Driving via Discrete Diffusion"
**Authors:** Zhang et al. (Waabi)
**Venue:** ICLR 2024
**arXiv:** [2311.01017](https://arxiv.org/abs/2311.01017)

Copilot4D is the first LiDAR-native world model that demonstrates high-quality future point cloud prediction. It frames point cloud forecasting as discrete token prediction using a VQ-VAE tokenizer and a discrete diffusion process.

### 2.2 Architecture

```
LiDAR Point Cloud Sequence
│
├─ Past frames: P_{t-T}, ..., P_t
│
▼
┌──────────────────────────────────────────────────────┐
│  VQ-VAE Tokenizer                                     │
│                                                        │
│  Encoder:                                              │
│    Point cloud → Voxelize (BEV pillars)               │
│    → PointNet per-pillar feature extraction            │
│    → Swin Transformer backbone (multi-scale features)  │
│    → Bottleneck projection                             │
│                                                        │
│  Vector Quantization:                                  │
│    → Lookup nearest codebook entry (K=8192 entries)    │
│    → Straight-through estimator for gradients          │
│    → Exponential moving average codebook updates       │
│                                                        │
│  Decoder (dual-branch):                                │
│    Branch 1: Neural feature grid → continuous features │
│    Branch 2: Binary occupancy map → occupied/free      │
│    → Combined via differentiable rendering → P_recon   │
└───────────────────┬──────────────────────────────────┘
                    │ Discrete tokens z_t per frame
                    ▼
┌──────────────────────────────────────────────────────┐
│  Discrete Diffusion World Model                       │
│                                                        │
│  Input: z_{t-T}, ..., z_t (past token sequences)      │
│                                                        │
│  Forward process:                                      │
│    Randomly mask tokens with probability β (absorbing) │
│    Controlled noise injection rate η = 20%             │
│                                                        │
│  Reverse process (MaskGIT-based):                      │
│    Predict all masked tokens in parallel               │
│    Iteratively unmask by confidence score              │
│    10-20 steps for high-quality generation             │
│                                                        │
│  Architecture: Transformer with spatiotemporal attn    │
│  Temporal causal masking: can only attend to past      │
│                                                        │
│  Output: z_{t+1}, ..., z_{t+K} (future token seqs)    │
└───────────────────┬──────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────┐
│  VQ-VAE Decoder                                       │
│                                                        │
│  Tokens → codebook lookup → features                   │
│  → Dual-branch decoding → point cloud reconstruction  │
│                                                        │
│  Output: P_{t+1}, ..., P_{t+K} (predicted future      │
│          point clouds in metric coordinates)           │
└──────────────────────────────────────────────────────┘
```

### 2.3 Key Technical Innovations

**Discrete tokenization of LiDAR occupancy:** Rather than modeling continuous point distributions (which is intractable for 200K+ points/scan), Copilot4D converts point clouds to a discrete BEV grid and applies vector quantization. This reduces the prediction problem from generating 200K 3D coordinates to predicting ~2000 discrete tokens -- a 100x dimensionality reduction that makes transformer-based modeling feasible.

**Modified MaskGIT for temporal prediction:** Standard MaskGIT generates images by iteratively unmasking tokens. Copilot4D extends this to temporal sequences: given past frames as context (unmasked), predict all future tokens simultaneously, then iteratively refine by confidence. The controlled noise injection (eta=20%) during training prevents the model from collapsing to copying the last observed frame.

**Dual-branch decoder:** The decoder produces both a neural feature grid (for continuous features like intensity) and a binary occupancy map (for structure). Point clouds are reconstructed via differentiable ray-casting through the occupancy map, producing physically plausible returns (respecting occlusion, ray termination).

### 2.4 Results

| Metric | Copilot4D | Previous SOTA | Improvement |
|--------|-----------|---------------|-------------|
| Chamfer Distance @ 1s (nuScenes) | **0.36** | 1.41 | **74% reduction** |
| Chamfer Distance @ 3s (nuScenes) | **0.72** | ~1.5 | **>50% reduction** |
| Perceptual Quality (FPD) | **Best** | -- | First to evaluate |
| Datasets evaluated | nuScenes, KITTI, Argoverse2 | Single dataset | 3x generality |

**Qualitative observations:**
- Generates realistic future point clouds that preserve object shapes and scene geometry
- Handles dynamic objects: vehicles accelerating, turning, stopping
- Preserves static background structure: buildings, fences, vegetation
- Struggles with sudden appearance of new objects (occlusion-to-visibility transitions)

### 2.5 Limitations

1. **Not open-source:** Code and weights are not publicly released. Waabi (founded by Raquel Urtasun, previously of Uber ATG) treats this as proprietary technology.
2. **BEV-only representation:** Copilot4D uses BEV pillars, collapsing height information. This limits prediction of objects at different vertical levels (e.g., aircraft wing tips above vehicle roof).
3. **Single-sensor training:** Trained on individual LiDAR sweeps from nuScenes (32-beam) and Waymo (64-beam). Multi-LiDAR setups like Aurrigo's 4-8 sensors are not directly supported -- would need to merge point clouds before tokenization.
4. **No action conditioning:** Copilot4D predicts unconditional futures -- it does not condition on the ego vehicle's planned action. This means it cannot answer "what will happen IF I take this action?"
5. **Inference speed:** The iterative MaskGIT decoding requires 10-20 steps per future frame. Estimated 80-150ms per 3-step prediction on A100. On Orin, this would need significant optimization.

### 2.6 Airside Relevance

Despite its limitations, Copilot4D proved a critical thesis: **LiDAR future prediction is viable and dramatically better than prior approaches.** The 65-75% Chamfer distance reduction demonstrates that discrete tokenization of LiDAR data is a productive representation for world modeling.

For airside application, Copilot4D's approach would need adaptation:
- Merge 4-8 RoboSense scans into unified cloud before tokenization
- Extend BEV to full 3D voxelization (aircraft height variation requires it)
- Add action conditioning for planning integration
- Fine-tune on airside LiDAR data (see Section 10)

The architecture is reproducible from the paper even without official code. The VQ-VAE tokenizer uses standard components (PointNet, Swin Transformer, codebook quantization), and MaskGIT-based diffusion is well-documented.

---

## 3. UnO: Unsupervised Occupancy Fields

### 3.1 Overview

**Paper:** "Unsupervised Occupancy Fields for Perception and Forecasting"
**Authors:** Agro et al. (Waabi)
**Venue:** CVPR 2024 Oral
**arXiv:** [2406.08691](https://arxiv.org/abs/2406.08691)

UnO learns a continuous 4D spatio-temporal occupancy field from raw LiDAR data with **zero semantic labels**. It is arguably the most relevant LiDAR-native world model for the Aurrigo stack because it is fully self-supervised, operates directly on LiDAR, and produces both occupancy and flow predictions.

### 3.2 Architecture

```
LiDAR Point Cloud Sequence: P_{t-T}, ..., P_t
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│  Voxelized LiDAR Encoder                                │
│                                                          │
│  Each scan → voxel grid (e.g., 0.2m resolution)         │
│  → Sparse 3D convolution backbone (VoxelNet-style)      │
│  → BEV feature extraction F_t                            │
│                                                          │
│  HD Map Rasterization (optional):                        │
│  → Rasterize lane lines, road boundaries → BEV map      │
│  → Concatenate with LiDAR BEV features                   │
└───────────────────┬─────────────────────────────────────┘
                    │ BEV features: F_{t-T}, ..., F_t
                    ▼
┌─────────────────────────────────────────────────────────┐
│  Temporal Fusion + Implicit Field Decoder                │
│                                                          │
│  Query: (x, y, z, t') for any future spacetime point    │
│                                                          │
│  Decoder:                                                │
│    1. Bilinear interpolate BEV features at (x, y)       │
│    2. Cross-attend to temporal sequence (past context)   │
│    3. MLP head → {P(occupied), flow_vector(vx, vy, vz)} │
│                                                          │
│  Continuous: queries at arbitrary resolution/timestep    │
│  No grid commitment at inference time                    │
└───────────────────┬─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│  Self-Supervised Training                                │
│                                                          │
│  1. Occupancy loss: Does predicted occupancy explain     │
│     observed LiDAR returns? (ray termination likelihood) │
│                                                          │
│  2. Free-space loss: Rays that pass through a region     │
│     without returning → that region should be empty      │
│                                                          │
│  3. Flow consistency loss: Predicted flow should         │
│     transport occupancy from t to t+1 consistently      │
│                                                          │
│  4. Point cloud rendering loss (optional):               │
│     Render predicted occupancy to point cloud,           │
│     compare with actual future LiDAR scan                │
│                                                          │
│  NO SEMANTIC LABELS REQUIRED                             │
└─────────────────────────────────────────────────────────┘
```

### 3.3 Key Technical Aspects

**Continuous implicit representation:** Unlike grid-based methods (Copilot4D, OccWorld) that commit to a fixed resolution, UnO represents the environment as a continuous function. The planner can query occupancy at any 3D point at any future time -- enabling adaptive resolution (fine near the vehicle, coarse at distance) without retraining.

**Self-supervised training from LiDAR only:** The training signal comes entirely from future LiDAR observations. If the model predicts a region is occupied at t+1 and the actual LiDAR scan at t+1 has returns in that region, the prediction was correct. Free-space supervision comes from rays that traverse a region without hitting anything. This eliminates the need for any human annotation.

**Flow prediction:** In addition to occupancy, UnO predicts 3D flow vectors for each occupied point. Flow indicates direction and speed of movement, enabling distinction between static obstacles (zero flow) and dynamic agents (nonzero flow). This is directly usable for trajectory prediction.

### 3.4 Results

| Benchmark | Metric | UnO | Previous SOTA | Notes |
|-----------|--------|-----|---------------|-------|
| Argoverse 2 | Point Cloud Forecasting | **SOTA** | -- | Best across all horizons |
| nuScenes | Point Cloud Forecasting | **SOTA** | -- | Best across all horizons |
| KITTI | Point Cloud Forecasting | **SOTA** | -- | Best across all horizons |
| nuScenes | BEV Semantic Occupancy (fine-tuned) | **SOTA** | -- | Superior to supervised baselines |
| nuScenes | Low-data regime (10% labels) | **SOTA** | -- | Largest advantage when labels scarce |

**Critical finding:** UnO pre-trained with self-supervision **outperforms fully supervised baselines** when fine-tuned on limited labeled data. This is the scalability breakthrough -- the model learns useful 3D world dynamics from raw LiDAR without any annotation.

### 3.5 Airside Relevance

UnO is arguably the **highest-priority LiDAR world model for the Aurrigo stack** for several reasons:

1. **Zero labels needed for pre-training.** Just drive the vehicle around the airside recording LiDAR sequences. UnO learns world dynamics from these raw recordings.
2. **Continuous representation matches planner queries.** The Frenet planner can query arbitrary (x, y, z, t) points along candidate trajectories to check predicted occupancy and flow.
3. **Flow prediction enables agent classification.** Static objects (FOD, parked aircraft) vs. dynamic agents (GSE, personnel) are distinguished by flow magnitude -- no detection or tracking required.
4. **Generalizes to any object.** Class-agnostic occupancy handles the 30+ GSE types, 100+ aircraft variants, and novel objects (construction barriers, temporary signage) found on airside.
5. **CVPR Oral quality.** This is peer-reviewed work from Waabi (Raquel Urtasun's company, focused on LiDAR-first autonomy).

**Limitation:** Like Copilot4D, UnO is not open-source. However, the architecture is fully described in the paper, and the components (sparse 3D CNN, implicit field decoder, self-supervised losses) are all implementable with standard libraries (spconv, PyTorch).

---

## 4. LidarDM: Map-Conditioned LiDAR Generation

### 4.1 Overview

**Paper:** "Generative LiDAR Simulation in a Generated World"
**Authors:** Zyrianov et al.
**Venue:** ICRA 2025
**arXiv:** [2404.02903](https://arxiv.org/abs/2404.02903)
**GitHub:** [vzyrianov/LidarDM](https://github.com/vzyrianov/LidarDM)

LidarDM is the **first map-conditioned LiDAR generation model** -- given an HD map layout and a driving scenario (trajectories of actors), it generates realistic LiDAR point cloud sequences. This is not a world model in the prediction sense (it does not forecast from past observations), but rather a **generative simulation model** that creates synthetic LiDAR data for training and testing.

### 4.2 Architecture

```
Inputs:
  1. HD Map layout (lanes, road boundaries, crosswalks)
  2. Actor trajectories (position, heading, velocity over time)
  3. Ego trajectory (position, heading over time)
  4. Optional: LiDAR sensor specification (beam pattern, range)

Pipeline:
┌─────────────────────────────────────────────┐
│  Stage 1: Layout-Aware Scene Composition     │
│                                              │
│  HD map → rasterized BEV layout              │
│  Actor trajectories → 3D bounding boxes      │
│  Compose background + foreground layout      │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Stage 2: Continuous Diffusion on            │
│           Range Images                       │
│                                              │
│  Layout → condition features                 │
│  Diffusion model generates range images      │
│  (H x W where H = beam count, W = azimuth)  │
│  Denoising: 50-100 DDPM steps               │
│  Produces: range + intensity per pixel       │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│  Stage 3: Range Image → Point Cloud          │
│                                              │
│  Convert range pixels to 3D (x, y, z) using │
│  known beam angles and ego pose              │
│  Apply raydrop modeling (physically-based    │
│  model of which rays return vs miss)         │
│  Output: realistic point cloud P_t           │
└─────────────────────────────────────────────┘
```

### 4.3 Key Innovations

**Range image as diffusion target:** Rather than generating 3D points directly (high-dimensional, unordered), LidarDM converts the problem to 2D: generate a range image where each pixel encodes the distance measured by one LiDAR beam at one azimuth angle. This 2D representation allows efficient use of standard image diffusion architectures (U-Net with cross-attention for conditioning).

**Map conditioning:** The HD map provides structural priors (road geometry, building outlines) that constrain the generated scene. This is critical for generating novel but plausible scenes -- the LiDAR returns must be consistent with the underlying road layout.

**Raydrop modeling:** Real LiDAR sensors do not receive returns from all emitted beams -- some miss due to surface properties, range limits, or multi-path effects. LidarDM models this raydrop pattern, producing point clouds with realistic density variations.

### 4.4 Results

- Generates physically plausible LiDAR sequences from map + trajectory specification
- Temporal coherence across frames (smooth scene evolution)
- Evaluated by training 3D detection models on synthetic data and testing on real data
- Sim-to-real gap: models trained on LidarDM data achieve within 5-8% of real-data performance

### 4.5 Airside Application: Generating Training Data from AMDB Maps

This is where LidarDM becomes uniquely valuable for the Aurrigo use case. The existing repository documents note that **no public airside LiDAR datasets exist** and that AMDB (Aerodrome Mapping Database) data is **available free from the FAA for 500+ US airports**.

The pipeline:

```
AMDB (airport layout) → Convert to HD map format
                       → Define turnaround scenarios (actor trajectories)
                       → LidarDM generates synthetic LiDAR sequences
                       → Train/validate perception models on synthetic data
                       → Fine-tune on small real airside dataset (500-1000 frames)
```

**Specific scenarios for generation:**
1. Aircraft pushback from gate (define aircraft trajectory from gate to taxiway)
2. Baggage tractor convoy crossing apron (define multi-vehicle trajectories)
3. Catering truck approaching aircraft door (define approach trajectory)
4. Personnel walking near active taxiway (define pedestrian trajectories)
5. FOD on apron surface (place static objects at specified locations)

**Cost estimate:** Per the sim-to-real document, a high-fidelity digital twin can outperform real-data training by 4.8%. LidarDM + 500 real scans achieves within 3-5% of fully real-data-trained models using 10x less real annotation. Development cost: $50-75K for first airport, $25-50K for each additional airport.

### 4.6 Limitations

- Requires HD map as input (AMDB provides this for airports, but conversion to HD map format is needed -- see the AMXM/Lanelet2 discussion in `technology/localization/`)
- Range image representation limits to single-LiDAR viewpoint per generation step
- 50-100 diffusion steps per frame: not real-time, only for offline data generation
- Beam pattern specific to training data (nuScenes 32-beam vs. RoboSense 32-beam RSHELIOS -- close but not identical)

---

## 5. LiDARCrafter: Language-Guided 4D LiDAR Generation

### 5.1 Overview

**Paper:** "Dynamic 4D World Modeling from LiDAR Sequences"
**Authors:** WorldBench
**Venue:** AAAI 2026 Oral
**GitHub:** [worldbench/LiDARCrafter](https://github.com/worldbench/LiDARCrafter) (193 stars)

LiDARCrafter extends LiDAR generation to **language-guided 4D scene creation**. Rather than specifying exact trajectories (as LidarDM requires), you describe the scene in natural language and the model generates corresponding 4D LiDAR sequences.

### 5.2 Architecture

```
Input: Language prompt + optional seed LiDAR frame
       "A truck merges from the right lane while a pedestrian
        crosses ahead"

Pipeline:
┌─────────────────────────────────────────────────┐
│  Component 1: 4D Layout Generation               │
│                                                   │
│  Language prompt → CLIP text encoder              │
│  → Layout prediction network                      │
│  → 3D bounding box trajectories over time         │
│  → Scene graph with object types and motions      │
└──────────────────┬────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Component 2: Single-Frame LiDAR Synthesis       │
│                                                   │
│  Layout → condition features                      │
│  Seed frame (if provided) → structural prior      │
│  Diffusion model generates high-fidelity frame    │
│  Scene-level and object-level generation          │
└──────────────────┬────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Component 3: Temporal Consistency Enforcement    │
│                                                   │
│  Inter-frame coherence via temporal attention     │
│  Static background persistence                    │
│  Dynamic object motion smoothness                 │
│  Output: 4D LiDAR sequence (T frames x N points) │
└─────────────────────────────────────────────────┘
```

### 5.3 Results

| Evaluation | LiDARCrafter | Previous SOTA | Metric |
|------------|-------------|---------------|--------|
| Single-frame quality (nuScenes) | **Best** | LidarDM | Scene-level FPD |
| Foreground object quality | **Best** | -- | Object-level Chamfer |
| Temporal stability | **Best** | -- | Frame-to-frame consistency |
| Controllability | **Language-guided** | Trajectory-only (LidarDM) | Flexibility |

### 5.4 Airside Application

LiDARCrafter's language interface is powerful for generating diverse airside scenarios:

```
Prompt examples for airside data generation:

"Aircraft pushback from stand with tractor attached to nose gear,
 turning right onto taxiway alpha"

"Three baggage carts in convoy crossing apron from left to right,
 with a loader parked at the aircraft door"

"Ground crew member walking from the terminal building toward
 the aircraft, passing behind a fuel bowser"

"Small debris on the taxiway centerline, with a taxiing aircraft
 approaching from 100 meters"

"De-icing truck spraying aircraft wing, with fog reducing
 visibility to 200 meters"
```

**Advantage over LidarDM:** No need to specify exact trajectories -- the language model handles motion planning of the described agents. This dramatically reduces the cost of scenario authoring, enabling generation of hundreds of diverse airside scenarios from text descriptions.

**Limitation:** Language-conditioned generation may not produce sufficiently precise geometric accuracy for safety-critical scenarios. The aircraft swept area during pushback must be geometrically exact (determined by nose gear angle and aircraft dimensions), which a language-conditioned model may approximate imprecisely.

---

## 6. 4D Occupancy Forecasting with LiDAR Input

### 6.1 The Occupancy Forecasting Paradigm

4D occupancy forecasting predicts future 3D occupancy grids from past observations. While most published methods use camera-based BEV encoders (because nuScenes benchmarks are camera-focused), the forecasting stage itself is **modality-agnostic** -- it operates on BEV/voxel features regardless of how they were produced. This means any camera-based occupancy forecasting method can be driven by LiDAR-based BEV features instead.

```
Camera-based pipeline (published):
  Multi-view images → BEV encoder (LSS/BEVFormer) → BEV features
  → Occupancy forecasting model → Future occupancy grids

LiDAR-based pipeline (for Aurrigo):
  Multi-LiDAR point clouds → Voxelization + 3D sparse CNN → BEV features
  → SAME occupancy forecasting model → Future occupancy grids

The forecasting model does not care how the BEV features were produced.
```

### 6.2 OccWorld with LiDAR Input

**Paper:** [OccWorld (ECCV 2024)](https://arxiv.org/abs/2311.16038)
**GitHub:** [wzzheng/OccWorld](https://github.com/wzzheng/OccWorld)

OccWorld's architecture has two stages: (1) scene tokenizer (VQ-VAE) and (2) GPT-like temporal predictor. The scene tokenizer operates on 3D semantic occupancy grids -- which can come from either camera-based or LiDAR-based occupancy estimation.

**LiDAR adaptation:**

```python
# Original OccWorld: camera BEV → occupancy → tokenize → predict
# Adapted for LiDAR: LiDAR voxels → occupancy → tokenize → predict

# Step 1: Replace BEV encoder with LiDAR voxelization
# Original:
#   bev_features = camera_bev_encoder(multi_view_images)
# Replace with:
#   bev_features = lidar_voxel_encoder(merged_point_cloud)

import torch
import spconv.pytorch as spconv

class LiDARBEVEncoder(torch.nn.Module):
    """Replace camera BEV encoder with LiDAR-based encoder."""
    
    def __init__(self, voxel_size=[0.2, 0.2, 0.2],
                 point_cloud_range=[-51.2, -51.2, -5.0, 51.2, 51.2, 3.0],
                 max_points_per_voxel=20,
                 max_voxels=40000):
        super().__init__()
        self.voxel_size = voxel_size
        self.point_cloud_range = point_cloud_range
        
        # Hard voxelization
        self.voxel_layer = spconv.VoxelGeneratorV2(
            voxel_size=voxel_size,
            point_cloud_range=point_cloud_range,
            max_num_points=max_points_per_voxel,
            max_voxels=max_voxels
        )
        
        # Simple mean encoder (or PointNet for richer features)
        self.voxel_encoder = MeanVoxelEncoder(in_channels=4)  # x, y, z, intensity
        
        # Sparse 3D backbone (matches VoxelBackBone8x)
        self.backbone_3d = spconv.SparseSequential(
            spconv.SubMConv3d(16, 32, 3, padding=1),
            torch.nn.BatchNorm1d(32),
            torch.nn.ReLU(),
            spconv.SparseConv3d(32, 64, 3, stride=2, padding=1),
            torch.nn.BatchNorm1d(64),
            torch.nn.ReLU(),
            # ... additional layers to match BEV feature dim
        )
        
        # Height compression → BEV
        self.height_compression = torch.nn.Conv2d(64 * 8, 256, 1)
    
    def forward(self, points):
        """
        Args:
            points: merged multi-LiDAR point cloud [N, 4] (x, y, z, intensity)
        Returns:
            bev_features: [B, C, H, W] matching OccWorld's expected input
        """
        voxels, coords, num_points = self.voxel_layer(points)
        voxel_features = self.voxel_encoder(voxels, num_points)
        sparse_features = self.backbone_3d(voxel_features, coords)
        bev = self.height_compression(sparse_features.dense())
        return bev
```

### 6.3 Drive-OccWorld with LiDAR Input

**Paper:** [Drive-OccWorld (AAAI 2025)](https://arxiv.org/abs/2408.14197)
**GitHub:** [yuyang-cloud/Drive-OccWorld](https://github.com/yuyang-cloud/Drive-OccWorld)

Drive-OccWorld extends OccWorld with **action conditioning** -- it predicts what the world will look like IF the ego vehicle takes a specific action. This is critical for planning: evaluate multiple candidate trajectories by predicting their consequences.

**Action conditioning formats supported:**
- Velocity: (vx, vy) in m/s
- Steering angle: converted to curvature
- Trajectory: sequence of (delta_x, delta_y) in meters
- High-level commands: "go forward," "turn left," "turn right"

**LiDAR adaptation is identical to OccWorld** -- replace the camera BEV encoder with a LiDAR voxel encoder. The action conditioning and temporal prediction stages are unchanged.

**Results on nuScenes (camera-based, for reference):**
- 33% improvement on L2@1s vs. UniAD
- 0.85m average L2 error
- 0.29% collision rate

### 6.4 DIO: Decomposable Implicit 4D Occupancy-Flow

**Paper:** "Decomposable Implicit 4D Occupancy-Flow World Model"
**Venue:** CVPR 2025
**Link:** [DIO](https://openaccess.thecvf.com/content/CVPR2025/papers/Diehl_DIO_Decomposable_Implicit_4D_Occupancy-Flow_World_Model_CVPR_2025_paper.pdf)

DIO combines the implicit continuous representation of UnO with the action-conditioned prediction of Drive-OccWorld. Key innovation: **decomposing the scene into static background and per-object dynamic fields**, with each object's future state predicted by a decomposed implicit function conditioned on its class, velocity, and the ego action.

**Relevance for airside:** The decomposition into static background (terminal buildings, taxiway surface) and dynamic objects (aircraft, GSE, personnel) naturally maps to airside scene structure. Each dynamic object's trajectory is predicted independently, enabling per-agent risk assessment.

### 6.5 FlashOcc Extension for Temporal Prediction

FlashOcc (see `occupancy-deployment-orin.md`) achieves 197.6 FPS on Orin for single-frame occupancy prediction. Extending it to temporal prediction requires adding a recurrent or attention-based temporal module:

```
FlashOcc (single frame):
  BEV features → 2D CNN → channel-to-height → 3D occupancy
  Speed: 197.6 FPS on Orin (TensorRT INT8)

FlashOcc + Temporal (proposed):
  BEV features at t-2, t-1, t → Temporal fusion (ConvGRU or temporal attention)
  → 2D CNN → channel-to-height → future 3D occupancy at t+1, t+2, t+3
  Estimated speed: 40-80 FPS on Orin (3-step prediction adds ~3x compute)
```

This lightweight temporal extension preserves FlashOcc's efficiency while adding prediction capability. The temporal fusion can be as simple as a ConvGRU operating on BEV features:

```python
class TemporalFlashOcc(torch.nn.Module):
    """FlashOcc with lightweight temporal prediction."""
    
    def __init__(self, flashocc_backbone, hidden_dim=128, num_future_steps=3):
        super().__init__()
        self.backbone = flashocc_backbone  # Pre-trained FlashOcc
        self.num_future_steps = num_future_steps
        
        # ConvGRU for temporal fusion
        self.temporal_gru = ConvGRU(
            input_dim=hidden_dim,
            hidden_dim=hidden_dim,
            kernel_size=3,
            num_layers=2
        )
        
        # Future prediction heads (one per timestep)
        self.future_heads = torch.nn.ModuleList([
            torch.nn.Conv2d(hidden_dim, hidden_dim, 3, padding=1)
            for _ in range(num_future_steps)
        ])
    
    def forward(self, bev_features_sequence):
        """
        Args:
            bev_features_sequence: [B, T, C, H, W] past BEV features
        Returns:
            future_occupancy: [B, K, X, Y, Z] predicted future occupancy
        """
        # Encode temporal context
        hidden = self.temporal_gru(bev_features_sequence)  # [B, C, H, W]
        
        # Predict future steps autoregressively
        future_occ = []
        h = hidden
        for k in range(self.num_future_steps):
            h = self.future_heads[k](h) + h  # residual
            occ_k = self.backbone.occ_head(h)  # channel-to-height → 3D
            future_occ.append(occ_k)
        
        return torch.stack(future_occ, dim=1)
```

### 6.6 Comparison of 4D Occupancy Forecasting Methods

| Method | Venue | Input | Action Conditioned | Self-Supervised | LiDAR-Native | Open Source |
|--------|-------|-------|-------------------|-----------------|--------------|-------------|
| OccWorld | ECCV 2024 | Camera BEV | No | No | Adaptable | Yes |
| Drive-OccWorld | AAAI 2025 | Camera BEV | **Yes** | No | Adaptable | Yes |
| OccSora | 2024 | Camera BEV | Yes (trajectory) | No | Adaptable | Partial |
| UnO | CVPR 2024 | **LiDAR** | No | **Yes** | **Yes** | No |
| DIO | CVPR 2025 | Multi-modal | Yes | Partial | **Yes** | No |
| Cam4DOcc | CVPR 2024 | Camera | No | No | No | Yes |
| OccLLaMA | 2024 | Camera BEV | Yes (language) | No | Adaptable | Partial |

**Recommendation:** Start with OccWorld (open-source, well-documented) with a LiDAR BEV encoder. Upgrade to Drive-OccWorld when action conditioning is needed. Aim toward UnO-style self-supervised training long-term to eliminate labeling requirements.

---

## 7. Point Cloud Prediction Networks

### 7.1 Direct Point Cloud Sequence Prediction

Before the world model era, several methods tackled point cloud prediction as a sequence modeling problem. These are simpler, faster, and more directly deployable than the methods in Sections 2-6, though less capable.

### 7.2 PointRNN / PointGRU / PointLSTM

**Papers:**
- PointRNN (ECCV 2020): "PointRNN: Point Recurrent Neural Network for Moving Point Cloud Processing"
- PointLSTM (2020): Extension with LSTM gating for longer-term dependencies

**Architecture:**

```
PointRNN / PointLSTM:

Input: Point cloud sequence P_{t-T}, ..., P_t
       Each P_i = [N_i x 3] (variable number of points)

For each timestep:
  1. Group nearby points into local neighborhoods (ball query)
  2. Extract per-neighborhood features (PointNet)
  3. Update recurrent state:
     PointRNN:  h_t = tanh(W_h * h_{t-1} + W_x * x_t + b)
     PointLSTM: f_t, i_t, o_t, c_t = LSTM(h_{t-1}, x_t)
  4. Decode next point positions from hidden state

Output: Predicted P_{t+1}, ..., P_{t+K}
```

**Pros:**
- Simple architecture, easy to implement
- Operates directly on point clouds (no voxelization)
- Lightweight: 1-5M parameters

**Cons:**
- Limited receptive field (local neighborhoods only)
- Poor long-range prediction (>2 seconds)
- No scene context (no map, no ego action)
- Fixed point count assumptions

### 7.3 Pillar-Based Prediction (PillarFlow / PillarMotion)

**Approach:** Convert point clouds to pillar representation (same as PointPillars), then apply 2D temporal prediction in BEV space.

```
Multi-LiDAR point cloud → Pillar encoder (PointPillars)
→ BEV features [C, H, W]
→ Stack past T BEV features: [T, C, H, W]
→ 3D convolution or ConvLSTM for temporal modeling
→ Predicted future BEV features [K, C, H, W]
→ BEV → occupancy or pillar → point cloud
```

**Advantage:** Leverages existing PointPillars deployment (6.84ms on Orin with TensorRT). The temporal module adds only 2D operations on top.

**Estimated performance on Orin:**
- PointPillars BEV encoding: ~7ms per frame
- Past 5 frames encoding: ~35ms (or amortized ~7ms if pipelined)
- Temporal ConvLSTM: ~5-10ms
- Future 3-step prediction: ~15ms
- **Total: ~30-50ms for 3-step BEV occupancy prediction**

This is the **fastest path to LiDAR-based occupancy forecasting on Orin** -- it reuses the existing PointPillars deployment and adds minimal overhead.

### 7.4 SPFNet: Scene Flow + Prediction

**Approach:** Decompose the prediction problem into (1) estimate scene flow (per-point 3D motion vectors) between consecutive frames, and (2) extrapolate flow forward to predict future positions.

```
P_t, P_{t-1} → Scene flow estimation F_t (per-point velocity)
Static points (|F| < threshold) → persist unchanged
Dynamic points → extrapolate position: P_{t+k} = P_t + k * F_t
Collision handling: merge overlapping predictions
```

**Advantage:** Physically interpretable -- each point's future position is predicted based on its observed velocity. Simple constant-velocity assumption works well for 1-2 second horizons.

**Limitation:** Cannot predict behavior changes (a vehicle that is moving straight but will turn). This is where learned world models outperform flow extrapolation.

### 7.5 Range Image Prediction

**Approach:** Convert LiDAR point clouds to range images (H=beams, W=azimuth, value=range), then apply standard 2D video prediction architectures.

```
LiDAR scan → Range image R_t [H x W] (H=32 beams, W=2048 azimuths)
Stack past T range images: R_{t-T}, ..., R_t
→ 2D video prediction model (ConvLSTM, PredRNN, SimVP)
→ Predicted future range images R_{t+1}, ..., R_{t+K}
→ Convert range images back to 3D point clouds
```

**Advantage:** Reduces 3D prediction to 2D video prediction -- a much more mature field with well-optimized architectures and TensorRT support. Range images preserve full 3D information (losslessly recoverable given beam angles).

**LidarDM uses this representation** for its generative model. SimVP (Simple Video Prediction, NeurIPS 2022) achieves competitive prediction quality with only 2D convolutions, making it TensorRT-friendly.

### 7.6 Comparison of Point Cloud Prediction Methods

| Method | Representation | Parameters | Inference (A100) | Inference (Orin est.) | Accuracy (CD@1s) | Scene Context | Action Cond. |
|--------|---------------|-----------|-------------------|----------------------|-------------------|---------------|-------------|
| PointRNN | Raw points | ~2M | ~20ms | ~60ms | 1.2-1.5 | None | No |
| PointLSTM | Raw points | ~3M | ~25ms | ~75ms | 1.0-1.3 | None | No |
| Pillar-based | BEV pillars | ~5M | ~15ms | ~45ms | 0.8-1.0 | BEV map | Possible |
| SPFNet (flow) | Raw points | ~4M | ~30ms | ~90ms | 0.9-1.1 | None | No |
| Range image | Range image | ~8M | ~20ms | ~60ms | 0.7-0.9 | None | Possible |
| Copilot4D | BEV tokens | ~50M | ~100ms | ~300ms | **0.36** | Temporal | No |
| UnO | Implicit field | ~30M | ~60ms | ~180ms | **~0.4** | Map + temporal | No |

**Observations:**
- Simple methods (PointRNN, flow) are fast but inaccurate beyond 1 second
- Copilot4D and UnO are dramatically more accurate but ~5-10x slower
- Pillar-based and range image methods offer the best accuracy/speed tradeoff for Orin
- For safety applications (is this space safe in 3 seconds?), the binary occupancy accuracy matters more than exact point positions -- even simple methods can answer this

---

## 8. Multi-Sensor Fusion World Models

### 8.1 MUVO: Camera + LiDAR Joint Future Prediction

**Paper:** "Multimodal World Model with Geometric Voxel Representations"
**Venue:** IV 2025
**arXiv:** [2311.11762](https://arxiv.org/abs/2311.11762)

MUVO is the first world model that jointly predicts future camera images AND LiDAR point clouds from multi-modal input. Rather than predicting raw sensor data, it outputs **3D occupancy predictions** as the shared representation.

**Architecture:**

```
Input: Camera images + LiDAR point clouds (current + past)

Camera branch:
  Multi-view images → Image backbone → BEV features (via LSS or BEVFormer)

LiDAR branch:
  Point cloud → Voxelization → Sparse 3D CNN → BEV features

Fusion:
  Camera BEV + LiDAR BEV → Concatenation or attention fusion → Fused BEV

Temporal prediction:
  Fused BEV sequence → Temporal transformer → Future fused BEV

Decoding:
  Future BEV → 3D occupancy prediction
  Future BEV → Camera image decoder (for camera-based validation)
  Future BEV → Point cloud renderer (for LiDAR-based validation)
```

### 8.2 Waymo World Model

Waymo's internal world model (referenced in the `cutting-edge-2026.md` document) generates both camera AND LiDAR data, built on top of DeepMind's Genie 3. Key details:
- Multi-modal consistency: predicted camera views and LiDAR scans are geometrically consistent
- Used for closed-loop simulation testing
- Not publicly available (Waymo internal)

### 8.3 Challenge: Aligning Camera and LiDAR Feature Spaces

The fundamental challenge in multi-modal world models is aligning two fundamentally different representations:

| Dimension | Camera Features | LiDAR Features |
|-----------|----------------|----------------|
| Spatial structure | Dense 2D grid | Sparse 3D points |
| Information content | Texture, color, semantics | Geometry, range, reflectance |
| Distance encoding | Implicit (depth ambiguity) | Explicit (range measurement) |
| Density | Uniform (every pixel has a value) | Non-uniform (density falls with range) |
| Failure modes | Lighting, weather, occlusion | Range limits, reflectance, rain |

**Alignment strategies:**
1. **Late fusion in BEV space:** Each modality produces BEV features independently, then concatenate. Simple but may miss cross-modal correlations.
2. **Cross-attention fusion:** Attend camera features to LiDAR features and vice versa. More expensive but captures cross-modal dependencies.
3. **Shared latent space:** Project both modalities into a shared latent representation. Requires careful training to avoid one modality dominating.

### 8.4 Airside Relevance: LiDAR Primary + Camera Secondary

For the Aurrigo stack evolution:

**Phase 1 (Current):** LiDAR-only world model. Use methods from Sections 2-7 with the existing 4-8 RoboSense LiDAR.

**Phase 2 (When cameras are added):** LiDAR-primary fusion world model. LiDAR provides the geometric backbone; cameras add texture, color, and semantic information. The world model prediction is still in 3D occupancy/point cloud space (the planner's native representation), but training benefits from camera supervision.

**Phase 3 (Thor era):** Full multi-modal world model with both LiDAR and camera prediction, enabling sensor redundancy verification. If the LiDAR prediction and camera prediction disagree, flag as anomaly.

---

## 9. AD-L-JEPA: Embedding-Space LiDAR Prediction

### 9.1 Overview

**Paper:** "AD-L-JEPA" (AAAI 2026)
**arXiv:** [2501.04969](https://arxiv.org/abs/2501.04969)
**GitHub:** [haoranzhuexplorer/ad-l-jepa-release](https://github.com/haoranzhuexplorer/ad-l-jepa-release)

AD-L-JEPA is the first JEPA (Joint Embedding Predictive Architecture) for LiDAR-based driving perception. Rather than predicting future point clouds or occupancy (pixel/voxel space prediction), it predicts future **embeddings** -- compressed representations in a learned feature space.

### 9.2 Key Innovation: Predicting Embeddings, Not Pixels

The JEPA philosophy (LeCun, 2022) argues that predicting in pixel/voxel space is wasteful because most of the prediction capacity is spent on irrelevant details (exact surface texture, shadow patterns, background clutter). Predicting in **embedding space** focuses the model on semantically meaningful structure.

```
MAE-style (Occupancy-MAE, GD-MAE):
  Mask voxels → Predict exact voxel contents → Reconstruct input
  Problem: spends capacity on exact geometry of irrelevant regions

JEPA-style (AD-L-JEPA):
  Mask BEV regions → Predict EMBEDDINGS of masked regions
  → Match embedding of predicted vs. actual
  Advantage: learns semantic structure, not pixel-level reconstruction
```

### 9.3 Architecture and Results

- Predicts Bird's-Eye-View embeddings rather than generating masked regions
- Neither generative nor contrastive -- uses explicit variance regularization to avoid representation collapse
- **1.9-2.7x reduction in GPU hours** vs. Occupancy-MAE for comparable accuracy
- **2.8-4x reduction in GPU memory** during pre-training
- Consistent improvements on 3D detection across KITTI3D, Waymo, and ONCE datasets

### 9.4 From Pre-training to World Modeling

AD-L-JEPA is currently a **pre-training method** (learning representations from LiDAR data for downstream detection). However, the JEPA framework naturally extends to temporal prediction:

```
Current AD-L-JEPA (pre-training):
  Mask spatial regions of single LiDAR frame
  Predict embeddings of masked regions from unmasked regions
  → Learns spatial understanding

Future AD-L-JEPA (world model):
  Given past LiDAR embeddings E_{t-T}, ..., E_t
  Predict future embeddings E_{t+1}, ..., E_{t+K}
  → Learns temporal dynamics in embedding space

Planning with JEPA world model:
  Compute goal embedding E_goal (desired future state)
  For each candidate action a:
    Predict E_{future}(a) = world_model(E_past, a)
    Score = similarity(E_{future}(a), E_goal)
  Select action that produces embedding closest to goal
```

This is analogous to V-JEPA 2-AC (Meta), which achieves 15x speedup over video-generation baselines for robotic control by planning in embedding space rather than pixel space. Extending this to LiDAR-based driving is an open research direction.

### 9.5 Airside Relevance

AD-L-JEPA is the most **compute-efficient** path to LiDAR representation learning -- critical for training on limited airside data with limited compute budget. The 2-4x efficiency gains over MAE-based methods mean:
- Pre-training on Waymo + nuScenes in ~12 hours on 4x A100 (vs. ~30 hours for Occupancy-MAE)
- Fine-tuning on airside data in ~2 hours (vs. ~6 hours)
- Smaller memory footprint enables larger batch sizes on available hardware

**Current status:** Open-source code available. Pre-training works today. Temporal extension (world model) is not yet published but architecturally straightforward.

---

## 10. Training LiDAR World Models on Airside Data

### 10.1 The Data Gap

No public airside point cloud sequences exist. This is simultaneously the biggest challenge and the biggest opportunity -- whoever creates the first airside LiDAR benchmark owns the evaluation standard for the field.

**Available data sources:**

| Source | Type | Size | Airside-Specific? | Cost |
|--------|------|------|--------------------|------|
| nuScenes | LiDAR + camera | ~300GB (trainval) | No (urban road) | Free |
| Waymo Open | LiDAR + camera | ~1.5TB | No (urban road) | Free |
| Argoverse 2 | LiDAR + camera | ~1TB | No (urban road) | Free |
| KITTI | LiDAR + camera | ~100GB | No (suburban road) | Free |
| WOMD-LiDAR | LiDAR range images | 574h | No (road, motion) | Free |
| Aurrigo fleet | LiDAR (4-8 sensors) | Growing | **Yes** | Collection cost |
| LidarDM synthetic | LiDAR (generated) | Unlimited | Configurable | Compute cost |
| LiDARCrafter synthetic | LiDAR (generated) | Unlimited | Configurable | Compute cost |

### 10.2 Pre-training Strategy: Road Data First, Airside Fine-tuning

The recommended approach follows the transfer learning paradigm validated across the perception research:

```
Phase 1: Self-supervised pre-training on road data
  Dataset: Waymo Open + nuScenes + Argoverse 2 (combined)
  Method: AD-L-JEPA or GD-MAE (self-supervised, no labels needed)
  Objective: Learn general 3D point cloud structure and dynamics
  Compute: ~24-48 hours on 4x A100
  Output: Pre-trained LiDAR encoder weights

Phase 2: Self-supervised temporal pre-training on airside data
  Dataset: 10-50 hours of Aurrigo airside LiDAR recordings
  Method: UnO-style self-supervised occupancy prediction
  Objective: Learn airside-specific dynamics (pushback patterns,
             GSE trajectories, personnel movement)
  Compute: ~12-24 hours on 4x A100
  Output: Pre-trained LiDAR world model

Phase 3: Supervised fine-tuning (optional, for semantic prediction)
  Dataset: 500-1000 labeled airside LiDAR frames
  Method: PointLoRA (parameter-efficient fine-tuning)
  Objective: Add semantic class prediction to occupancy forecasting
  Compute: ~4-8 hours on 4x A100
  Output: Semantic 4D occupancy world model
```

### 10.3 Data Collection Requirements

**For Phase 2 (self-supervised temporal pre-training):**

| Requirement | Minimum | Recommended | Notes |
|-------------|---------|-------------|-------|
| Recording hours | 10h | 50h | More data = better dynamics learning |
| Airports covered | 1 | 3+ | Domain diversity improves generalization |
| Turnaround sequences | 50 | 200+ | Critical for learning turnaround dynamics |
| Pushback sequences | 20 | 100+ | Aircraft trajectory prediction |
| Weather conditions | Dry | Dry + rain + fog | Robustness |
| Time of day | Day | Day + night + twilight | Lighting variation |
| LiDAR frame rate | 10 Hz | 10 Hz | Standard for RoboSense |
| Storage per hour | ~20 GB | ~20 GB | 4-8 LiDAR at 10 Hz |

**Total storage for 50 hours:** ~1 TB raw, ~300 GB compressed. Per the fleet data pipeline document, this fits comfortably in the hot storage tier (NVMe, 30-day retention).

### 10.4 Self-Supervised Pre-training Methods for LiDAR

| Method | Pretext Task | GPU Hours | Label Savings | Best For |
|--------|-------------|-----------|---------------|----------|
| AD-L-JEPA | Embedding prediction | **Lowest** (1.9x faster) | 50-80% | Fast pre-training, limited compute |
| GD-MAE | Masked voxel reconstruction | Moderate | 80% | Detection backbone initialization |
| Occupancy-MAE | Masked occupancy reconstruction | Moderate | 50% | Occupancy prediction |
| TREND | Temporal forecasting | Moderate | Significant | Learning dynamics from sequences |
| UnO | Self-supervised occupancy + flow | Higher | **N/A (full SSL)** | World model pre-training |
| GPC | LiDAR colorization (needs camera) | Moderate | 80-95% | When camera+LiDAR available |

**Recommendation:** Start with AD-L-JEPA for perception backbone pre-training (cheapest, open-source). Progress to UnO-style self-supervised training for the world model itself.

### 10.5 Evaluation Metrics

| Metric | What It Measures | Range | Used By |
|--------|-----------------|-------|---------|
| **Chamfer Distance (CD)** | Average nearest-neighbor distance between predicted and actual point clouds | Lower = better (0.3-1.5 typical) | Copilot4D, PointRNN |
| **Occupancy IoU** | Intersection over union of predicted vs. actual occupied voxels | 0-100% (30-50% typical) | OccWorld, Drive-OccWorld |
| **mIoU (semantic)** | Mean IoU across semantic classes | 0-100% (30-60% typical) | Semantic occupancy methods |
| **Ray-Drop Accuracy** | Correctly predicting which LiDAR beams return vs. miss | 0-100% (85-95% typical) | LidarDM, range image methods |
| **Flow EPE** | End-point error of predicted flow vectors | Lower = better (0.1-0.5m typical) | UnO, SPFNet |
| **L2 Planning Error** | Downstream planning accuracy when using predicted world | Lower = better (0.5-2.0m typical) | Drive-OccWorld |
| **Collision Rate** | Fraction of planned trajectories that collide in predicted future | Lower = better (0.1-1.0% typical) | Drive-OccWorld, DIO |

### 10.6 Augmentation via LiDAR Simulation

Supplement real airside data with synthetic data:

```
1. AMDB map → Lanelet2 conversion → LidarDM input
   → Generate 1000+ synthetic airside LiDAR sequences
   → Cover scenarios too rare to collect naturally:
     - Near-miss events
     - Multi-vehicle intersection conflicts
     - FOD in various positions
     - Extreme weather conditions

2. LiDARCrafter language-guided generation
   → "Aircraft pushback colliding with baggage tractor"
   → Generate safety-critical scenarios for world model training
   → Evaluate world model's ability to predict dangerous futures

3. Domain randomization on synthetic data
   → Vary LiDAR beam pattern (match RoboSense RSHELIOS/RSBP specs)
   → Vary object sizes (different aircraft types, GSE models)
   → Vary surface reflectance (wet apron, de-icing fluid)
```

Per the sim-to-real transfer research: combined synthetic + 500 real scans achieves within 3-5% of fully real-data-trained models. This makes the data gap surmountable.

---

## 11. Deployment on NVIDIA Orin

### 11.1 Compute Budget

From `occupancy-deployment-orin.md`, the Orin AGX 64GB has:

| Resource | Total | Available for World Model |
|----------|-------|--------------------------|
| GPU | 2048 CUDA cores, 64 Tensor Cores | ~30% (shared with perception, planning) |
| Memory | 64 GB unified | 4-8 GB for world model |
| INT8 TOPS | 275 | ~80 TOPS |
| Power | 60W max | ~15W |

### 11.2 Inference Time Budget

At 30 km/h (maximum airside speed), 10 Hz control rate, and 3-second prediction horizon:

| Component | Budget | Notes |
|-----------|--------|-------|
| LiDAR preprocessing | 5ms | Point cloud merging, ego-motion compensation |
| Voxelization | 3ms | Hard voxelization on GPU |
| BEV encoding | 7-15ms | PointPillars (7ms) or CenterPoint (15ms) |
| Temporal fusion | 5-10ms | ConvGRU on BEV features |
| Future prediction (3 steps) | 15-30ms | Autoregressive or parallel |
| Occupancy decoding | 5ms | Channel-to-height (FlashOcc-style) |
| **Total** | **40-70ms** | Within 100ms budget |

### 11.3 Model Architecture for Orin

The recommended architecture for deployable LiDAR world model on Orin:

```
┌─────────────────────────────────────────────────────────────┐
│  Orin-Deployable LiDAR World Model                          │
│                                                              │
│  Input: Merged multi-LiDAR point cloud (10 Hz)              │
│                                                              │
│  Stage 1: PointPillars BEV Encoding (TensorRT INT8)         │
│    Point cloud → Pillar features → BEV [C=64, H=200, W=200]│
│    Latency: ~7ms | Memory: ~0.5 GB                          │
│                                                              │
│  Stage 2: Temporal ConvGRU (TensorRT FP16)                  │
│    Past 5 BEV frames → Hidden state [C=128, H=200, W=200]  │
│    Latency: ~8ms | Memory: ~0.5 GB                          │
│                                                              │
│  Stage 3: Future BEV Prediction (TensorRT FP16)             │
│    Hidden → 3 future BEV frames (autoregressive)            │
│    Latency: ~15ms | Memory: ~1.0 GB                         │
│                                                              │
│  Stage 4: BEV → 3D Occupancy (TensorRT INT8)               │
│    FlashOcc-style channel-to-height expansion               │
│    Latency: ~5ms | Memory: ~0.5 GB                          │
│                                                              │
│  Output: Future 3D occupancy grids at t+0.3, t+0.6, t+0.9s │
│    Resolution: 0.4m voxels, 80m x 80m x 6m range           │
│    Classes: occupied / free / unknown                        │
│                                                              │
│  Total: ~35ms | ~2.5 GB VRAM                                │
└─────────────────────────────────────────────────────────────┘
```

### 11.4 TensorRT Optimization

Key optimizations for Orin deployment:

```python
# TensorRT optimization recipe for LiDAR world model

# 1. Export BEV encoder to ONNX
import torch.onnx
torch.onnx.export(
    bev_encoder,
    dummy_input,
    "bev_encoder.onnx",
    opset_version=17,
    dynamic_axes={"points": {0: "num_points"}}
)

# 2. Build TensorRT engine with INT8 calibration
# Use pillar-based encoding (fully TensorRT-compatible)
# trtexec --onnx=bev_encoder.onnx \
#         --saveEngine=bev_encoder_int8.engine \
#         --int8 \
#         --calib=calibration_data.bin \
#         --workspace=4096

# 3. ConvGRU: Use FP16 (recurrent ops less suitable for INT8)
# trtexec --onnx=temporal_gru.onnx \
#         --saveEngine=temporal_gru_fp16.engine \
#         --fp16 \
#         --workspace=2048

# 4. Future prediction heads: FP16
# trtexec --onnx=future_heads.onnx \
#         --saveEngine=future_heads_fp16.engine \
#         --fp16

# 5. Occupancy decoder: INT8 (simple conv ops)
# trtexec --onnx=occ_decoder.onnx \
#         --saveEngine=occ_decoder_int8.engine \
#         --int8 \
#         --calib=calibration_data.bin

# 6. Multi-model orchestration with CUDA streams
# Run BEV encoding and temporal fusion on separate CUDA streams
# for overlap with other perception tasks (detection, segmentation)
```

### 11.5 Use Cases on the Aurrigo Stack

**1. Safety verification (check planned trajectory against predicted future):**

```python
def verify_trajectory_safety(planned_trajectory, predicted_occupancy, clearance=1.0):
    """
    Check if planned ego trajectory is safe against predicted future occupancy.
    
    Args:
        planned_trajectory: [(x, y, theta, t)] ego poses over time
        predicted_occupancy: [K, X, Y, Z] future occupancy grids
        clearance: minimum required clearance in meters
    
    Returns:
        is_safe: bool
        first_conflict_time: float or None
        conflict_voxels: occupied voxels within clearance
    """
    ego_footprint = get_vehicle_footprint()  # ADT3 dimensions + clearance buffer
    
    for k, (x, y, theta, t) in enumerate(planned_trajectory):
        if k >= len(predicted_occupancy):
            break
        
        # Transform ego footprint to world frame
        footprint_voxels = transform_footprint(ego_footprint, x, y, theta)
        
        # Inflate by clearance
        inflated_voxels = dilate_voxels(footprint_voxels, clearance / voxel_size)
        
        # Check for collision
        occ_grid = predicted_occupancy[k]
        conflicts = occ_grid[inflated_voxels] > 0.5  # occupied threshold
        
        if conflicts.any():
            return False, t, inflated_voxels[conflicts]
    
    return True, None, None
```

**2. Gap detection (find safe windows in dynamic environment):**

```python
def find_safe_crossing_window(crossing_point, predicted_occupancy, 
                               ego_crossing_time=2.0):
    """
    Find temporal windows where a crossing point is predicted to be clear.
    
    Args:
        crossing_point: (x, y) point where ego path crosses another agent's path
        predicted_occupancy: [K, X, Y, Z] future occupancy grids
        ego_crossing_time: time needed to traverse the crossing zone
    
    Returns:
        windows: list of (start_time, end_time) safe crossing windows
    """
    crossing_voxels = get_voxels_around(crossing_point, radius=3.0)
    
    # Check occupancy at crossing point for each future timestep
    clear_at_t = []
    for k in range(len(predicted_occupancy)):
        occupied = predicted_occupancy[k][crossing_voxels].max() > 0.5
        clear_at_t.append(not occupied)
    
    # Find windows of consecutive clear timesteps
    windows = []
    start = None
    for k, is_clear in enumerate(clear_at_t):
        if is_clear and start is None:
            start = k * dt  # timestep to seconds
        elif not is_clear and start is not None:
            end = k * dt
            if (end - start) >= ego_crossing_time:
                windows.append((start, end))
            start = None
    
    return windows
```

**3. Behavior prediction (will this GSE cross my path?):**

```python
def predict_agent_crossing(agent_voxels_current, predicted_occupancy,
                            ego_path_voxels):
    """
    Predict if a detected agent will cross the ego's planned path.
    
    Args:
        agent_voxels_current: current voxels occupied by the agent
        predicted_occupancy: [K, X, Y, Z] future occupancy grids
        ego_path_voxels: voxels along ego's planned route
    
    Returns:
        will_cross: bool
        crossing_time: estimated time of crossing
        crossing_confidence: probability
    """
    for k in range(len(predicted_occupancy)):
        # Find where the agent will be (track occupancy propagation)
        future_occ = predicted_occupancy[k]
        
        # Check overlap between predicted occupancy and ego path
        overlap = future_occ[ego_path_voxels] > 0.3  # lower threshold for prediction
        
        if overlap.any():
            confidence = future_occ[ego_path_voxels][overlap].mean()
            return True, k * dt, confidence.item()
    
    return False, None, 0.0
```

### 11.6 Integration with Simplex Architecture

The design spec describes a Simplex architecture where a **high-performance new stack (AC)** operates alongside a **verified fallback stack (BC)**. The LiDAR world model integrates as a confidence signal for the AC:

```
┌────────────────────────────────────────────────────┐
│  Assured Controller (AC) — New Stack                │
│                                                      │
│  LiDAR World Model → Predicted future occupancy     │
│  Neural Planner → Candidate trajectory              │
│  Safety Check: verify_trajectory_safety()            │
│  If safe → publish trajectory to actuators           │
│  If unsafe → flag to Decision Module                 │
└──────────────────┬─────────────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────┐
│  Decision Module                                     │
│                                                      │
│  AC confidence = f(world_model_certainty,            │
│                    prediction_horizon,                │
│                    OOD_score)                         │
│  If AC_confidence > threshold → use AC trajectory    │
│  If AC_confidence < threshold → switch to BC          │
└──────────────────┬─────────────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────┐
│  Baseline Controller (BC) — Current Stack            │
│                                                      │
│  RANSAC perception → known obstacles only            │
│  Frenet planner → conservative trajectory            │
│  Always available, always verified                    │
│  No world model dependency                           │
└────────────────────────────────────────────────────┘
```

The world model's prediction uncertainty serves as a natural confidence metric. If the predicted future occupancy has high entropy (uncertain about whether a space is occupied), the AC should reduce speed or defer to the BC. This maps directly to the Simplex safety architecture.

---

## 12. Applications for Airside Safety

### 12.1 Pushback Prediction: Aircraft Swept Area 5-10s Ahead

Aircraft pushback is the highest-risk dynamic event on the apron. During pushback, a tow tractor reverses the aircraft from the stand onto the taxiway. The aircraft's tail sweeps a wide arc determined by the nose gear steering angle.

**World model application:**

```
Observation: Aircraft attached to tow tractor, pushback initiated
             LiDAR tracks aircraft position over past 3-5 seconds

World model input:
  Past occupancy grids showing aircraft and tractor positions
  Optional: inferred nose gear angle from observed curvature

World model output:
  Predicted occupancy at t+1s, t+3s, t+5s, t+10s
  → Aircraft swept area over next 10 seconds
  → Forbidden zone for ego vehicle path planning

Safety action:
  If ego planned path intersects predicted swept area within horizon
  → Stop and wait
  → Or reroute around predicted swept area
```

**Why this is hard without a world model:** Classical approaches estimate aircraft trajectory from kinematic models (bicycle model with known wheelbase). But the pushback tractor operator may vary speed, change steering angle, or stop/restart -- behaviors that a kinematic model cannot predict but a learned world model (trained on pushback sequences) can anticipate.

### 12.2 GSE Trajectory Prediction

Baggage tractors, belt loaders, catering trucks, and fuel bowsers follow semi-structured but variable patterns during turnaround. A world model trained on turnaround sequences learns these patterns.

**Key scenarios:**

| Scenario | Prediction Need | Time Horizon | Accuracy Required |
|----------|----------------|--------------|-------------------|
| Baggage train crossing apron | Will it cross my path? | 3-5s | 2m positional |
| Belt loader approaching aircraft | Will it block my route? | 5-10s | 3m positional |
| Fuel bowser departing | When will it clear my path? | 5-15s | 5m positional |
| Catering truck maneuvering | Is it reversing toward me? | 1-3s | 1m positional |

**Advantage over per-agent tracking:** Classical tracking + prediction requires detecting each GSE, classifying its type, estimating its velocity, and running a per-agent motion model. The world model predicts the **entire scene's future occupancy** in a single forward pass -- inherently handling multi-agent interactions (e.g., one GSE yields to another).

### 12.3 Personnel Prediction

Ground crew prediction is the most safety-critical application. 27,000 ramp accidents occur annually, and ground crew movements are unpredictable -- they dart between vehicles, crouch under aircraft, and walk behind equipment.

**World model capabilities:**
- **Intent prediction:** A person walking toward the ego vehicle's route will be predicted as occupying that route in future frames -- triggering early deceleration even before the person enters the path.
- **Crouching detection:** Occupancy world models detect occupied voxels at any height. A crouching person (partially occluded behind a wheel chock) occupies voxels at 0.3-0.8m height. As long as the LiDAR observes sufficient returns, the world model tracks and predicts this occupancy.
- **Disocclusion prediction:** If a person is fully occluded behind a vehicle, classical detection fails. Occupancy flow methods (UnO, ImplicitO) can predict that a moving agent will emerge from behind occlusion based on observed flow vectors -- predicting **currently invisible** agents.

### 12.4 FOD Persistence Modeling

Foreign Object Debris (FOD) on the apron ranges from small tools to luggage to vehicle parts. FOD detection requires distinguishing between truly stationary debris (must be avoided or reported) and transient occupied voxels (sensor noise, rain drops).

**World model approach:**

```
FOD classification via temporal occupancy:

Frame t:   Voxel (x, y, z) occupied, flow = 0
Frame t+1: Voxel (x, y, z) occupied, flow = 0
Frame t+2: Voxel (x, y, z) occupied, flow = 0
→ Persistent static occupancy → high confidence FOD

vs.

Frame t:   Voxel (x, y, z) occupied
Frame t+1: Voxel (x, y, z) empty
Frame t+2: Voxel (x, y, z) empty
→ Transient → likely sensor noise or rain

vs.

Frame t:   Voxel (x, y, z) occupied, flow = (1.2, 0.3, 0) m/s
Frame t+1: Voxel (x+0.12, y+0.03, z) occupied, flow = (1.2, 0.3, 0)
→ Moving object → not FOD, dynamic agent
```

The world model provides temporal smoothing automatically -- persistent occupancy predictions inherently filter out transient noise.

### 12.5 Jet Blast Prediction

Jet blast is the only airside hazard that is **geometrically invisible** -- there is no physical object to detect. However, jet exhaust interacts with airborne particles (dust, de-icing fluid mist, rain) creating a density change that LiDAR can partially observe.

**World model approach to jet blast:**
- LiDAR may observe scattered returns in the jet exhaust plume (from entrained particles)
- These returns appear as diffuse, low-density occupancy in voxel space
- A world model trained on sequences near running engines can learn to predict plume expansion
- The predicted "occupied" region expands behind the engine over time, even if LiDAR returns are sparse

**Limitation:** Pure LiDAR detection of jet blast is unreliable without particles in the exhaust. Thermal cameras (see `hardware/sensors/`) are the primary sensor for jet blast detection. However, a world model that incorporates historical jet blast observations can provide prediction even when current LiDAR returns are sparse.

### 12.6 Combining Predictions for Integrated Safety

```
Integrated airside safety prediction pipeline:

LiDAR World Model Output:
  Future occupancy grids: O_{t+1}, O_{t+2}, O_{t+3} (0.3s, 0.6s, 0.9s)
  Future flow fields:     F_{t+1}, F_{t+2}, F_{t+3}

Safety checks (run in parallel):
  1. Trajectory safety:   planned_path ∩ O_{t+k} = ∅ for all k?
  2. Clearance check:     min_dist(planned_path, O_{t+k}) > clearance?
  3. Crossing prediction: any O_{t+k} intersects ego path with |F| > 0?
  4. FOD detection:       persistent static O with no F across all k?
  5. Pushback zone:       large connected O moving with rotational F?

Decision:
  All safe → proceed at planned speed
  Any warning → reduce speed + alert operator
  Any critical → emergency stop + switch to BC
```

---

## 13. Comparison Table

### 13.1 LiDAR-Native World Models: Complete Comparison

| Model | Venue | Year | Representation | Self-Supervised | Action Cond. | Open Source | Orin Deployable | Airside Fit |
|-------|-------|------|---------------|-----------------|--------------|-------------|-----------------|-------------|
| **Copilot4D** | ICLR | 2024 | BEV tokens (discrete) | Yes | No | No | Needs optimization | HIGH |
| **UnO** | CVPR Oral | 2024 | Continuous implicit field | **Yes** | No | No | Needs optimization | **VERY HIGH** |
| **LidarDM** | ICRA | 2025 | Range images (diffusion) | N/A (generative) | N/A | **Yes** | Offline only | HIGH (data gen) |
| **LiDARCrafter** | AAAI Oral | 2026 | 4D point cloud | N/A (generative) | N/A (language) | **Yes** | Offline only | HIGH (data gen) |
| **DIO** | CVPR | 2025 | Decomposed implicit | Partial | **Yes** | No | Needs optimization | HIGH |
| **Cosmos-LidarGen** | NVIDIA | 2025 | Range images (tokenized) | N/A (generative) | N/A | **Yes** | Offline only | HIGH (data gen) |
| **OccWorld** (LiDAR-adapted) | ECCV | 2024 | VQ-VAE voxels | No | No | **Yes** | **Feasible** | HIGH |
| **Drive-OccWorld** (LiDAR-adapted) | AAAI | 2025 | VQ-VAE voxels | No | **Yes** | **Yes** | **Feasible** | **VERY HIGH** |
| **AD-L-JEPA** | AAAI | 2026 | BEV embeddings | **Yes** | No (yet) | **Yes** | **Yes** (lightweight) | HIGH |

### 13.2 Performance and Compute Comparison

| Model | Chamfer Dist @1s | Occ IoU @1s | Params | A100 Inference | Orin Inference (est.) | VRAM |
|-------|-----------------|-------------|--------|---------------|----------------------|------|
| Copilot4D | **0.36** | -- | ~50M | ~100ms | ~300ms | ~4 GB |
| UnO | ~0.40 | SOTA | ~30M | ~60ms | ~180ms | ~3 GB |
| OccWorld (LiDAR) | -- | ~35% | ~25M | ~50ms | ~150ms | ~2 GB |
| Drive-OccWorld (LiDAR) | -- | ~37% | ~30M | ~60ms | ~180ms | ~2.5 GB |
| Pillar-based prediction | ~0.8 | ~25% | ~5M | ~15ms | **~45ms** | ~1 GB |
| Range image prediction | ~0.7 | ~28% | ~8M | ~20ms | ~60ms | ~1 GB |
| PointPillars + ConvGRU | -- | ~22% | ~7M | ~20ms | **~50ms** | ~1 GB |

### 13.3 Suitability Matrix for Airside

| Application | Best Model | Why | Fallback |
|-------------|-----------|------|----------|
| Pushback swept area | Drive-OccWorld | Action-conditioned, predicts conditional futures | Kinematic model |
| GSE crossing prediction | UnO / OccWorld | Scene-level occupancy + flow | Constant velocity |
| Personnel safety | UnO | Continuous field, fine resolution queries | RANSAC + buffer |
| FOD detection | Any temporal occ | Persistence filtering inherent | Multi-frame voting |
| Jet blast prediction | Specialized model needed | Standard methods lack thermal input | Lookup table |
| Data generation | LidarDM + LiDARCrafter | Synthetic airside data from maps/language | Manual collection |
| Pre-training | AD-L-JEPA | Most compute-efficient SSL for LiDAR | GD-MAE |

---

## 14. Recommended Roadmap

### Phase 1: Foundation (Months 1-3)

| Step | Action | Cost | Output |
|------|--------|------|--------|
| 1.1 | Collect 10h unlabeled airside LiDAR sequences | $0 (existing vehicles) | Raw training data |
| 1.2 | Pre-train LiDAR backbone with AD-L-JEPA on Waymo + nuScenes | $500 compute | Pre-trained encoder |
| 1.3 | Implement pillar-based temporal prediction (PointPillars + ConvGRU) | 2 weeks engineering | Baseline world model |
| 1.4 | Deploy baseline on Orin via TensorRT | 1 week engineering | ~50ms 3-step prediction |
| 1.5 | Evaluate on airside data: does prediction help planning? | 1 week testing | Quantitative evidence |

### Phase 2: Capability (Months 3-9)

| Step | Action | Cost | Output |
|------|--------|------|--------|
| 2.1 | Collect 50h airside LiDAR with diverse scenarios | $0 (fleet operations) | Comprehensive training set |
| 2.2 | Implement OccWorld with LiDAR BEV encoder | 3 weeks engineering | VQ-VAE occupancy world model |
| 2.3 | Self-supervised pre-train on airside sequences | $1,000 compute | Airside-adapted world model |
| 2.4 | Generate synthetic data with LidarDM + AMDB maps | $2,000 compute | 1000+ synthetic scenarios |
| 2.5 | Upgrade to Drive-OccWorld for action conditioning | 2 weeks engineering | Planning-integrated world model |
| 2.6 | Integrate with Simplex AC confidence signal | 2 weeks engineering | Safety-aware planning |

### Phase 3: Production (Months 9-18)

| Step | Action | Cost | Output |
|------|--------|------|--------|
| 3.1 | Implement UnO-style continuous occupancy field | 4 weeks engineering | High-accuracy self-supervised model |
| 3.2 | Add multi-resolution occupancy (0.2m/0.4m/0.8m) | 2 weeks engineering | Optimized memory + accuracy |
| 3.3 | Safety certification evidence gathering | Ongoing | World model safety case |
| 3.4 | Multi-airport transfer validation | 2 weeks per airport | Generalization evidence |
| 3.5 | Thor deployment (when hardware available) | 2 weeks porting | Full-scale world model |

### Total Estimated Investment

| Category | Cost |
|----------|------|
| Compute (Phases 1-3) | $5,000-10,000 |
| Engineering time | 6-12 person-months |
| Data collection | $0 (uses fleet vehicles) |
| Labeling (Phase 3 only) | $5,000-10,000 (500-1000 frames) |
| **Total** | **$10,000-20,000 + engineering time** |

---

## 15. References

### LiDAR-Native World Models

| Paper | Venue | Year | Link |
|-------|-------|------|------|
| Copilot4D | ICLR | 2024 | [arXiv](https://arxiv.org/abs/2311.01017), [Website](https://waabi.ai/research/copilot-4d) |
| UnO | CVPR Oral | 2024 | [arXiv](https://arxiv.org/abs/2406.08691) |
| LidarDM | ICRA | 2025 | [arXiv](https://arxiv.org/abs/2404.02903), [GitHub](https://github.com/vzyrianov/LidarDM) |
| LiDARCrafter | AAAI Oral | 2026 | [GitHub](https://github.com/worldbench/LiDARCrafter) |
| DIO | CVPR | 2025 | [Paper](https://openaccess.thecvf.com/content/CVPR2025/papers/Diehl_DIO_Decomposable_Implicit_4D_Occupancy-Flow_World_Model_CVPR_2025_paper.pdf) |
| Cosmos-LidarGen | NVIDIA | 2025 | [GitHub](https://github.com/nv-tlabs/Cosmos-Drive-Dreams) |

### 4D Occupancy Forecasting

| Paper | Venue | Year | Link |
|-------|-------|------|------|
| OccWorld | ECCV | 2024 | [arXiv](https://arxiv.org/abs/2311.16038), [GitHub](https://github.com/wzzheng/OccWorld) |
| Drive-OccWorld | AAAI | 2025 | [arXiv](https://arxiv.org/abs/2408.14197), [GitHub](https://github.com/yuyang-cloud/Drive-OccWorld) |
| OccSora | arXiv | 2024 | [arXiv](https://arxiv.org/abs/2405.20337) |
| Cam4DOcc | CVPR | 2024 | [arXiv](https://arxiv.org/abs/2311.17663) |
| OccLLaMA | arXiv | 2024 | [arXiv](https://arxiv.org/abs/2409.03272) |
| ImplicitO | CVPR | 2023 | [Paper](https://openaccess.thecvf.com/content/CVPR2023/html/Agro_Implicit_Occupancy_Flow_Fields_for_Perception_and_Prediction_in_Self-Driving_CVPR_2023_paper.html) |

### LiDAR Pre-training

| Paper | Venue | Year | Link |
|-------|-------|------|------|
| AD-L-JEPA | AAAI | 2026 | [arXiv](https://arxiv.org/abs/2501.04969), [GitHub](https://github.com/haoranzhuexplorer/ad-l-jepa-release) |
| GD-MAE | CVPR | 2023 | [GitHub](https://github.com/Nightmare-n/GD-MAE) |
| Occupancy-MAE | IEEE TIV | 2023 | [GitHub](https://github.com/chaytonmin/Occupancy-MAE) |
| TREND | NeurIPS | 2025 | [GitHub](https://github.com/Runjian-Chen/TREND) |
| GPC | ICLR | 2024 | [GitHub](https://github.com/tydpan/GPC) |
| PointLoRA | CVPR | 2025 | [Paper](https://openaccess.thecvf.com/content/CVPR2025/papers/Wang_PointLoRA_Low-Rank_Adaptation_with_Token_Selection_for_Point_Cloud_Learning_CVPR_2025_paper.pdf) |

### Point Cloud Prediction

| Paper | Venue | Year | Link |
|-------|-------|------|------|
| PointRNN | ECCV | 2020 | [arXiv](https://arxiv.org/abs/1910.08287) |
| ViDAR | CVPR Highlight | 2024 | [arXiv](https://arxiv.org/abs/2312.17655) |
| Occupancy Flow Fields | Waymo | 2022 | [arXiv](https://arxiv.org/abs/2203.03875) |

### Related Repository Documents

| Document | Relevance |
|----------|-----------|
| `30-autonomy-stack/world-models/overview.md` | Camera-centric world models overview |
| `30-autonomy-stack/world-models/occupancy-world-models.md` | Detailed occupancy forecasting methods |
| `30-autonomy-stack/world-models/occupancy-deployment-orin.md` | Orin deployment specifics |
| `30-autonomy-stack/world-models/occworld-implementation.md` | OccWorld hands-on setup guide |
| `30-autonomy-stack/world-models/tokenized-and-jepa.md` | VQ-VAE tokenization and JEPA theory |
| `30-autonomy-stack/perception/overview/lidar-foundation-models.md` | LiDAR pre-training and backbone models |
| `30-autonomy-stack/world-models/cutting-edge-2026.md` | Latest 2025-2026 developments |
| `synthesis/design-spec.md` | Simplex architecture and world model integration |
| `synthesis/poc-proposals.md` | POC cost estimates |
| `30-autonomy-stack/localization-mapping/overview/lidar-slam-algorithms.md` | LiDAR SLAM for map building |
