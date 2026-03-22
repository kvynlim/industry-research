# 4D Occupancy Prediction, Occupancy World Models, and Spatial-Temporal Scene Understanding for Autonomous Driving

## Comprehensive Technical Research Report

---

## Table of Contents

1. [Occupancy Networks for Driving](#1-occupancy-networks-for-driving)
2. [4D Occupancy Prediction (Future Occupancy)](#2-4d-occupancy-prediction-future-occupancy)
3. [Occupancy as Representation for Planning](#3-occupancy-as-representation-for-planning)
4. [Self-Supervised Approaches](#4-self-supervised-approaches)
5. [Relevance to Airside Operations](#5-relevance-to-airside-operations)

---

## 1. Occupancy Networks for Driving

### 1.1 Tesla's Occupancy Network (AI Day 2022)

Tesla introduced occupancy networks at AI Day 2022, catalyzing an entire research wave in vision-based 3D occupancy prediction. The core idea: instead of detecting objects with bounding boxes, **divide the world into tiny voxels and predict whether each voxel is occupied**, regardless of what occupies it.

**Architecture Pipeline:**

1. **Feature Extraction**: Eight surround cameras feed into a backbone made of RegNets and BiFPNs for multi-scale feature extraction.
2. **Attention-based 2D-to-3D Lifting**: An attention module with positional image encoding and fixed queries produces an **occupancy feature volume** -- extending BEV by adding the height dimension.
3. **Temporal Fusion**: The current feature volume is fused with previous volumes (t-1, t-2, ...) to build a **4D occupancy grid** with temporal context.
4. **Deconvolution Reconstruction**: Deconvolutions recover the original spatial dimensions, outputting both an **occupancy volume** (binary occupied/free per voxel) and **occupancy flow** (per-voxel motion vectors showing direction and magnitude).

**Key Capabilities:**

- Runs at **over 100 FPS** (3x faster than camera frame rate)
- Handles **arbitrary, unknown objects** -- a critical safety advantage. Traditional detectors fail silently on objects not in the training set (e.g., a fallen pallet, construction debris). Occupancy prediction detects any physical obstacle.
- Per-voxel flow vectors enable understanding of **moving vs. stationary** objects and motion direction (forward/backward/stationary).
- NeRF-based offline validation: Tesla uses fleet-collected multi-view data to build offline 3D reconstructions via Neural Radiance Fields, then validates occupancy predictions against these ground-truth reconstructions. "Fleet averaging" and descriptor-based matching handle weather/blur variations.

**Why This Matters:** Tesla demonstrated that occupancy is not just a perception trick -- it is a fundamental representation shift. Bounding boxes estimate the maximum possible boundary of objects; occupancy captures fine-grained geometric shape. An overhanging ladder on a truck, a partially collapsed barrier -- these are invisible to box-based detectors but naturally represented in occupancy grids.

---

### 1.2 SurroundOcc (ICCV 2023)

**Paper:** [SurroundOcc: Multi-Camera 3D Occupancy Prediction for Autonomous Driving](https://arxiv.org/abs/2303.09551)

**Architecture:**

1. Extract **multi-scale features** from each camera image.
2. Apply **spatial 2D-3D attention** to lift image features into 3D volume space.
3. Use **3D convolutions** to progressively upsample volume features.
4. Impose **multi-level supervision** at each resolution stage during upsampling.

**Dense Label Generation Pipeline:** Rather than relying on expensive manual voxel annotation, SurroundOcc introduces an automated pipeline:
- Fuse multi-frame LiDAR scans (treating dynamic and static objects separately).
- Apply **Poisson Reconstruction** to fill gaps in sparse LiDAR data.
- Voxelize the resulting mesh to create **dense occupancy ground truth**.

This pipeline was critical for enabling supervised training without impractical annotation costs and has influenced subsequent work.

---

### 1.3 Occ3D and OpenOccupancy Benchmarks

**Occ3D** ([NeurIPS 2023](https://tsinghua-mars-lab.github.io/Occ3D/)) provides large-scale 3D occupancy prediction benchmarks with two variants:
- **Occ3D-nuScenes**: 700 training / 150 validation scenes; occupancy scope of [-40m, 40m] for X/Y and [-1m, 5.4m] for Z; voxel resolution of 0.4m.
- **Occ3D-Waymo**: Finer 0.1m resolution labels (though few networks operate at this resolution).

**Label Generation Pipeline** (three stages):
1. **Voxel densification**: Accumulate multi-frame LiDAR into dense point clouds.
2. **Occlusion reasoning**: Determine visibility-aware labels (which voxels can be observed from the ego vehicle).
3. **Image-guided voxel refinement**: Use camera imagery to correct/refine voxel labels.

**OpenOccupancy** ([ICCV 2023](https://github.com/JeffWang987/OpenOccupancy)) extends nuScenes with denser semantic occupancy annotations, addressing the problem that LiDAR-superimposition-based labels miss occupancy in sparse LiDAR channels.

These benchmarks standardized evaluation and enabled fair comparison across methods.

---

### 1.4 TPVFormer -- Tri-Perspective View (CVPR 2023)

**Paper:** [TPVFormer](https://github.com/wzzheng/TPVFormer) -- described as "an academic alternative to Tesla's occupancy network."

**Core Innovation:** Instead of a single BEV plane, TPVFormer uses **three orthogonal planes** (top-down, front-view, side-view). Each 3D point is represented by **summing its projected features on the three planes**:

```
feature(x, y, z) = f_BEV(x, y) + f_front(x, z) + f_side(y, z)
```

A transformer-based encoder (TPVFormer) aggregates image features into each TPV plane via cross-attention.

**Key Advantages:**
- Uses only **sparse LiDAR semantic labels** for supervision (not dense 3D voxel annotations).
- Requires approximately **~300 GPU-hours** for training (vs. ~100,000 for Tesla-scale systems).
- Supports **16 semantic classes** from camera-only input.
- Achieves **LiDAR-segmentation-comparable results** using only six cameras.

TPVFormer showed that intelligent spatial representation design can match brute-force computation and data scale.

---

### 1.5 FB-OCC (CVPR 2023 Challenge Winner)

**Paper:** [FB-OCC: 3D Occupancy Prediction based on Forward-Backward View Transformation](https://arxiv.org/abs/2307.01492) (NVIDIA)

FB-OCC won the CVPR 2023 3D Occupancy Prediction Challenge with **54.19% mIoU** on nuScenes. Built on FB-BEV (forward-backward projection for camera-to-BEV transformation), it adds:

- **Joint depth-semantic pre-training**: Simultaneously learns depth estimation and semantic segmentation before occupancy training.
- **Joint voxel-BEV representation**: Combines BEV features with explicit 3D voxel features.
- **Forward-backward projection**: Forward projection lifts image features via depth-weighted LSS; backward projection queries image features from 3D locations. Their fusion produces denser, more accurate BEV representations.
- **Model scaling and post-processing**: Larger backbones and ensemble strategies for challenge performance.

FB-OCC demonstrated that combining multiple view transformation paradigms outperforms any single approach.

---

### 1.6 FlashOcc -- Efficient Deployment

**Paper:** [FlashOcc: Fast and Memory-Efficient Occupancy Prediction via Channel-to-Height Plugin](https://arxiv.org/abs/2311.12058)

**Core Idea:** Replace expensive 3D convolutions with **2D convolutions in BEV space**, then use a **channel-to-height transformation** to reshape BEV features into 3D occupancy logits:

```
BEV features: [B, C, W, H] --> reshape --> Occupancy: [B, C*, Z, W, H]
```

The channels encode height information, so a simple reshape (no computation) converts 2D features to 3D predictions.

**Performance:** Achieves **6.5ms latency** on consumer GPUs while maintaining accuracy comparable to 3D-convolution-based methods. This makes it a plug-and-play module that can be dropped into any BEV-based pipeline, removing the need for view transformers or 3D deformable convolution operators.

**Deployment Significance:** FlashOcc is one of the first occupancy methods truly viable for real-time on-vehicle deployment, critical for safety-critical systems.

---

### 1.7 SparseOcc -- Fully Sparse Architecture (ECCV 2024)

**Paper:** [Fully Sparse 3D Occupancy Prediction](https://arxiv.org/abs/2312.17118)

SparseOcc exploits scene sparsity -- most voxels in a driving scene are empty. The architecture is **fully sparse**: no dense 3D features, no sparse-to-dense operations, no global attention.

**Architecture:**
1. Reconstruct a **sparse 3D representation** from camera inputs.
2. Use **sparse queries** (inspired by Mask2Former) with **mask-guided sparse sampling** to predict semantic/instance occupancy.
3. Randomly sample 3D points within predicted masks, project to multi-view images, and extract features via bilinear interpolation -- fully sparse cross-attention.

**Performance:** 34.0 RayIoU at **17.3 FPS** (real-time) with 7 history frames; 35.1 RayIoU with 15 frames. Also introduces the **RayIoU metric**, which evaluates along camera rays rather than in dense voxel space, better reflecting perception quality.

---

### 1.8 PanoOcc -- Unified Panoptic Representation (CVPR 2024)

**Paper:** [PanoOcc: Unified Occupancy Representation for Camera-based 3D Panoptic Segmentation](https://arxiv.org/abs/2306.10013)

PanoOcc unifies 3D object detection, semantic segmentation, and panoptic segmentation in a single occupancy representation through a **coarse-to-fine scheme**:

1. **View Encoder**: Voxel queries aggregate multi-view, multi-frame features.
2. **Temporal Encoder**: Aligns previous voxel features with the current frame.
3. **Voxel Upsample**: Progressively restores high-resolution voxel representation.
4. **Occupancy Sparsify Module**: Prunes occupancy to spatially sparse representation during upsampling, greatly boosting memory efficiency.
5. **Task Heads**: Predict object detection + semantic segmentation jointly.
6. **Refine Module**: Produces 3D panoptic segmentation results.

**Key Result:** State-of-the-art on nuScenes for camera-based semantic and panoptic segmentation; competitive on Occ3D benchmark.

---

### 1.9 RenderOcc -- NeRF-Style Supervision (ICRA 2024)

**Paper:** [RenderOcc: Vision-Centric 3D Occupancy Prediction with 2D Rendering Supervision](https://arxiv.org/abs/2309.09502)

**Core Idea:** Train 3D occupancy models using **only 2D labels** (no 3D voxel annotations) by leveraging NeRF-style volume rendering:

1. Extract a 3D volume from multi-view images.
2. Transform it into a **Semantic-Density-Field (SDF)** encoding volume density and semantic logits.
3. Use **differentiable volume rendering** to produce 2D renderings (depth + semantics).
4. Supervise with 2D depth and semantic labels.

**Auxiliary Ray Method:** Addresses sparse viewpoints in driving by using sequential frames to construct comprehensive 2D rendering coverage for each object.

**Result:** Achieves **comparable performance to fully 3D-supervised methods**, demonstrating that expensive voxel annotations may be unnecessary.

---

### 1.10 GaussianFormer -- Scene as Gaussians (ECCV 2024)

**Paper:** [GaussianFormer: Scene as Gaussians for Vision-Based 3D Semantic Occupancy Prediction](https://arxiv.org/abs/2405.17429)

**Paradigm Shift:** Instead of dense voxel grids, represent scenes with **sparse 3D semantic Gaussians**. Each Gaussian has position, covariance (shape/scale), and semantic features.

**Architecture:**
1. Initialize sparse 3D Gaussians.
2. Aggregate information from multi-view images via **cross-attention** and **3D sparse convolutions** on Gaussian point clouds.
3. Iteratively refine Gaussian properties (position, covariance, semantics).
4. **Gaussian-to-voxel splatting**: Efficiently aggregate neighboring Gaussians for each voxel position to produce occupancy predictions.

**Key Advantage:** Achieves comparable performance to dense methods with only **17.8-24.8% of their memory consumption**. The object-centric Gaussian representation naturally handles the **diversity of object scales** and the **sparsity of occupancy**, which dense grids waste resources on.

---

## 2. 4D Occupancy Prediction (Future Occupancy)

### 2.1 Why 4D Occupancy Prediction IS a World Model

A world model, in the context of autonomous driving, is a **generative model that predicts how the environment will evolve over time**, conditioned on the ego vehicle's actions. The formulation is:

```
s_{t+1} = f(s_t, s_{t-1}, ..., a_t)
```

where `s_t` is the scene state at time `t` and `a_t` is the ego action.

**4D occupancy prediction is precisely this formulation**, where the scene state `s_t` is a dense 3D voxel grid. The system takes historical occupancy grids (or camera images that produce them) and predicts future 3D occupancy grids -- how every voxel in the world will change. This is more complete than trajectory-based world models (which only predict agent trajectories) because it captures:

- **Scene-level dynamics**: Road geometry changes, construction zones appearing
- **Multi-agent evolution**: All agents simultaneously, without requiring per-agent tracking
- **Non-agent dynamics**: Vegetation movement, debris, weather effects
- **Geometric completeness**: Fine-grained shape changes, not just bounding box trajectories

The occupancy world model reformulates scene evolution as **spatial-temporal generation**: given a sequence of 3D occupancy grids, predict the next grid(s). Action conditioning allows controllable generation -- "what happens if I turn left?" produces a different future occupancy than "what happens if I go straight?"

---

### 2.2 OccWorld -- GPT-Like Occupancy World Model

**Paper:** [OccWorld](https://wzzheng.net/OccWorld/)

OccWorld adapts the GPT generative paradigm to 3D occupancy forecasting -- predicting the next scene from previous scenes in an autoregressive manner.

**Architecture:**

1. **3D Occupancy Scene Tokenizer**: Uses CNNs to encode 3D occupancy and applies **vector quantization** (VQ-VAE) via a learnable codebook to discretize scenes. A decoder reconstructs scenes from tokens.

2. **Spatial-Temporal Generative Transformer**: Adapts GPT with:
   - **Spatial mixing modules** at multiple scales.
   - **Spatial-wise temporal causal self-attention**: Each spatial token attends only to past and present tokens (causal masking in time), preserving autoregressive generation.
   - **U-Net aggregation** across scales.

**Variants:**
- **OccWorld-O**: Takes ground-truth 3D occupancy as input (oracle).
- **OccWorld-D/T**: Uses TPVFormer-predicted occupancy (realistic pipeline).
- **OccWorld-S**: Self-supervised -- requires no 3D occupancy labels during training.

**Results:** OccWorld learns genuine scene evolution (predicting vehicle movements, completing unseen map elements like drivable areas) rather than memorizing static scenes. Achieves **competitive planning performance** against methods using much more expensive annotations. Limitation: struggles to predict previously-unseen vehicles entering the field of view.

---

### 2.3 Drive-OccWorld (AAAI 2025)

**Paper:** [Drive-OccWorld: Driving in the Occupancy World](https://arxiv.org/abs/2408.14197)

Drive-OccWorld extends OccWorld with action-conditioned generation and end-to-end planning integration.

**Architecture (Three Components):**

1. **History Encoder**: Extracts multi-view features into BEV embeddings.

2. **Memory Queue with Semantic-Motion Conditional Normalization**:
   - *Semantic conditioning*: A lightweight prediction head generates voxel-wise semantic probabilities, converted to one-hot embeddings, then convolved to produce learned scale/shift parameters for affine transformation.
   - *Motion conditioning*: Ego-pose transformation matrices are flattened and processed through MLPs; agent motion uses modulation parameters from 3D flow predictions.

3. **World Decoder**: Auto-regressive transformer with deformable self-attention, temporal cross-attention, and **conditional cross-attention** with action conditions.

**Action Conditioning Interface:** Supports four flexible action formats:
- Velocity (vx, vy in m/s)
- Steering angle (converted to curvature)
- Trajectory (delta-x, delta-y in meters)
- High-level commands (go forward, turn left/right)

Actions are encoded via **Fourier embeddings**, concatenated, and fused through learned projections.

**Occupancy-Based Cost Function for Planning:**
1. **Agent-Safety Cost**: Penalizes overlaps with occupied grids and proximity to other agents.
2. **Road-Safety Cost**: Ensures the vehicle stays in drivable areas (extracted from predicted occupancy).
3. **Learned-Volume Cost**: A learnable head generates a cost volume from BEV embeddings.
4. **BEV Refinement**: The selected trajectory is cross-attended with BEV features for fine-grained environmental reasoning.

**Quantitative Results on nuScenes:**
- **33% relative improvement** on L2@1s vs. UniAD.
- **0.85m average L2 error** with predicted trajectory conditions.
- **0.29% collision rate**.
- +2.0% mIoU_f improvement over Cam4DOcc for future occupancy.

---

### 2.4 OccSora -- Diffusion-Based 4D World Simulator

**Paper:** [OccSora: 4D Occupancy Generation Models as World Simulators for Autonomous Driving](https://arxiv.org/abs/2405.20337)

OccSora is the **first generative diffusion-based 4D occupancy world model**. Unlike autoregressive methods (OccWorld), it uses diffusion to model long-term temporal evolutions more efficiently.

**Architecture:**
1. **4D Scene Tokenizer**: Obtains compact discrete spatial-temporal representations from 4D occupancy input; achieves high-quality reconstruction for long-sequence occupancy videos.
2. **Diffusion Transformer (DiT)**: Trained on spatial-temporal representations to generate 4D occupancy **conditioned on trajectory prompts**.

**Capabilities:**
- Generates **16-second videos** with authentic 3D layout and temporal consistency.
- **Trajectory-aware generation**: Different ego trajectories produce different future worlds.
- No need for prior object detection boxes or scene information.
- Potential to serve as a **world simulator** for decision-making.

---

### 2.5 Cam4DOcc -- Camera-Only 4D Forecasting Benchmark (CVPR 2024)

**Paper:** [Cam4DOcc: Benchmark for Camera-Only 4D Occupancy Forecasting](https://arxiv.org/abs/2311.17663)

Cam4DOcc standardizes evaluation for camera-only 4D occupancy forecasting -- predicting future surrounding scene changes from camera images.

**Dataset:** Built on nuScenes, nuScenes-Occupancy, and Lyft-Level5. Provides sequential occupancy states of general movable and static objects with **3D backward centripetal flow** annotations.

**Four Baseline Types:**
1. **Static-world occupancy model**: Assumes the world does not change (lower bound).
2. **Voxelization of point cloud prediction**: Predict future point clouds, then voxelize.
3. **2D-3D instance-based prediction**: Track and predict individual instances, then aggregate.
4. **End-to-end 4D occupancy forecasting network**: Directly predict future occupancy volumes.

**Evaluation:** Standardized metrics for present and future occupancy estimation with respect to driving-relevant objects.

---

### 2.6 UnO -- Unsupervised Occupancy Fields (CVPR 2024 Oral)

**Paper:** [UnO: Unsupervised Occupancy Fields for Perception and Forecasting](https://arxiv.org/abs/2406.08691) (Waabi)

UnO learns a **continuous 4D spatio-temporal occupancy field** with **self-supervision from LiDAR data** -- no labeled object categories required.

**Key Technical Aspects:**
- Represents the environment as a **continuous implicit field** (not discrete voxels), capturing spatial layout and temporal dynamics simultaneously.
- For point cloud forecasting, adds a **lightweight learned renderer** to convert implicit predictions to explicit outputs.
- Trains without semantic labels, making it generalizable to **everything encountered on the road** rather than predefined classes.

**Results:**
- **State-of-the-art** on Argoverse 2, nuScenes, and KITTI for point cloud forecasting.
- When fine-tuned, achieves **superior BEV semantic occupancy forecasting**, especially when **labeled data is scarce**.
- Higher recall for self-driving-relevant object classes vs. prior geometric prediction methods.

**Significance:** UnO demonstrates that unsupervised pre-training of occupancy world models can outperform fully supervised baselines -- a scalability breakthrough.

---

### 2.7 ViDAR -- Visual Point Cloud Forecasting (CVPR 2024 Highlight)

**Paper:** [ViDAR: Visual Point Cloud Forecasting](https://arxiv.org/html/2312.17655v1) (OpenDriveLab)

ViDAR pre-trains autonomous driving models by predicting **future LiDAR point clouds from past camera images** -- a pre-text task that forces learning of semantics, 3D geometry, and temporal dynamics simultaneously.

**Architecture:**
1. **History Encoder**: Visual BEV encoder extracts BEV embeddings from multi-view camera sequences.
2. **Latent Rendering Operator**: Transforms encoder outputs into a 3D geometric latent space. Solves the "ray-shaped features" problem via conditional probability weighting and multi-group parallelization to maintain feature diversity.
3. **Future Decoder**: Autoregressive transformer that iteratively predicts future BEV features.
4. **Occupancy-to-Point-Cloud**: Ray-casting from predicted occupancy volumes produces point cloud predictions.

**Downstream Improvements from ViDAR Pre-training:**
- **3D Detection**: +3.1% NDS, surpasses supervised pre-training by 1.1% mAP.
- **Occupancy Prediction**: +4.6% mIoU over detection-based baselines.
- **Motion Forecasting**: ~10% error reduction.
- **Planning**: ~15% collision rate reduction.
- With **50% training data**, ViDAR-pretrained models exceed fully-supervised baselines by 1.7% mAP.
- With **12.5% data**, gains reach 7.3% mAP.

**Why It Matters:** ViDAR shows that visual point cloud forecasting is the ideal pre-text task for autonomous driving -- it unifies all the knowledge (semantics, geometry, dynamics) needed for downstream perception, prediction, and planning, and requires no expensive annotations beyond Image-LiDAR pairs.

---

### 2.8 OccLLaMA -- Occupancy-Language-Action World Model

**Paper:** [OccLLaMA: An Occupancy-Language-Action Generative World Model](https://arxiv.org/abs/2409.03272)

OccLLaMA unifies vision (occupancy), language, and action in a single autoregressive model, treating occupancy as the visual modality for an LLM-based world model.

**Key Components:**
- **VQVAE-like scene tokenizer**: Efficiently discretizes and reconstructs semantic occupancy scenes, handling sparsity and class imbalance.
- **Unified multi-modal vocabulary**: Combines scene tokens, language tokens, and action tokens.
- **Autoregressive generation**: A single model handles 4D occupancy forecasting, motion planning, and visual question answering.

**Significance:** Demonstrates that occupancy can serve as the "visual language" of an embodied world model, bridging perception, reasoning, and action.

---

## 3. Occupancy as Representation for Planning

### 3.1 Why Occupancy Maps Are Powerful for Planning

Occupancy-based representations offer fundamental advantages over traditional object-centric planning:

**1. Class-Agnostic Safety:**
Conventional detectors only find objects they were trained on. In open-world driving, unknown objects (debris, unusual vehicles, fallen cargo) are silently missed. Occupancy prediction answers a simpler, more fundamental question: "Is this space occupied?" This provides collision avoidance for **any physical obstacle** regardless of class.

**2. Fine-Grained Geometry:**
Bounding boxes estimate the maximum possible boundary -- a coarse approximation. For irregularly shaped objects (excavators, trailers, aircraft), occupancy captures actual geometric shape. This enables tighter, safer path planning through narrow gaps.

**3. Scene-Level Completeness:**
Occupancy represents the **entire scene** -- drivable surfaces, curbs, vegetation, barriers -- not just discrete detected objects. This provides a complete cost map for planning.

**4. Scalability:**
Occupancy is the same size regardless of the number of agents. Grid-based representations scale with scene volume, not entity count -- critical for dense environments.

---

### 3.2 Occupancy Flow Fields

**Paper:** [Occupancy Flow Fields for Motion Forecasting (Waymo)](https://arxiv.org/abs/2203.03875)

Occupancy Flow Fields combine occupancy grids with per-cell flow vectors into a unified representation:

```
Each cell contains:
  - P(occupied): probability of any agent occupying this cell
  - (vx, vy): 2D flow vector (motion direction and magnitude)
```

This bridges two existing paradigms:
- **Occupancy grids** efficiently represent multiple agents but lack motion information.
- **Trajectory sets** capture motion but don't scale for many agents.

**Flow Trace Loss:** A novel training loss ensures consistency between occupancy predictions and flow vectors -- flow should transport occupancy from one timestep to the next.

**Speculative Agents:** Uniquely, this formulation can predict **currently-occluded agents** that may emerge through disocclusion.

---

### 3.3 Implicit Occupancy Flow Fields (ImplicitO, CVPR 2023)

**Paper:** [ImplicitO](https://openaccess.thecvf.com/content/CVPR2023/html/Agro_Implicit_Occupancy_Flow_Fields_for_Perception_and_Prediction_in_Self-Driving_CVPR_2023_paper.html) (Waabi)

ImplicitO replaces discrete grids with a **continuous implicit representation** that predicts occupancy and flow at any queried spatio-temporal point:

```
(x, y, t) --> {P(occupied), flow_vector}
```

**Architecture:** Voxelized LiDAR and HD map rasters are encoded by a two-stream CNN. A decoder extracts features for query points and predicts occupancy + reverse flow.

**Advantages over Grid-Based:**
- **No resolution commitment**: Queries are continuous, so planning can evaluate at arbitrary resolution.
- **Efficient**: Only computes predictions at locations the planner needs (avoiding wasted computation on irrelevant grid cells).
- **Global context**: Overcomes limited receptive field of explicit methods via efficient global attention.

---

### 3.4 Occupancy-Based Cost Functions for Planning

Several frameworks demonstrate how occupancy predictions drive trajectory selection:

**OPGP (Occupancy Prediction-Guided Neural Planner):** A two-stage framework where occupancy forecasting provides scene-centric guidance for planning. Unlike agent-centric prediction (which requires tracking individual agents), occupancy-based guidance is scalable and invariant to the number of actors.

**UniAD:** Penalizes planned trajectories by their distance to predicted occupancy during post-optimization -- trajectories that pass through occupied regions receive high costs.

**Drive-OccWorld Cost Function:**
1. **Agent-safety cost**: Overlap with occupied voxels.
2. **Road-safety cost**: Deviation from predicted drivable areas.
3. **Learned-volume cost**: Neural network-generated cost volume from BEV features.

**DSDnet / P3:** Employ collision penalties associated with occupancy forecasting in the planning cost for candidate trajectory selection.

---

### 3.5 Differentiable Rendering from Occupancy

Occupancy volumes can be rendered into 2D images via differentiable volume rendering (NeRF-style), enabling:

- **Self-supervised training**: Render predicted occupancy to 2D, compare with camera images (photometric loss) or LiDAR-derived depth maps.
- **Gradient flow**: Differentiable rendering allows planning gradients to flow through the 3D representation back to the perception system, enabling true end-to-end optimization.
- **Novel view synthesis**: Generate sensor observations from predicted future occupancy for simulation and validation.

**Neural Radiance Fields in Driving:** NeuRAD and related methods encode static backgrounds and dynamic vehicles through multilevel hash grids with shared neural radiance fields. Occupancy grids (0.5m cell size) initialized from LiDAR are used to skip empty space during rendering.

**Gaussian Splatting:** GaussianFormer and GaussianOcc use 3D Gaussian representations that can be rendered via differentiable splatting -- combining the efficiency of sparse representations with the gradient-flow benefits of differentiable rendering.

---

### 3.6 Motion Planning in Occupancy Space

Planning directly in occupancy space replaces the traditional detect-track-predict-plan pipeline with a more direct approach:

1. **Predict future occupancy** (the world model): Generate 3D occupancy grids for t+1, t+2, ..., t+N.
2. **Sample candidate trajectories**: Generate a set of possible ego trajectories.
3. **Evaluate in occupancy space**: For each trajectory, check collision with predicted occupancy at each future timestep. Score by safety cost (distance to occupied voxels), comfort (smoothness), and progress (distance traveled).
4. **Select optimal trajectory**: Choose the trajectory with the lowest total cost.

This approach is inherently **multi-modal** (multiple futures can be evaluated), **scalable** (no per-agent processing), and **robust to unknown objects** (any occupied voxel is an obstacle).

---

## 4. Self-Supervised Approaches

### 4.1 Learning Occupancy Without 3D Labels

The fundamental challenge: annotating 3D occupancy voxel-by-voxel is prohibitively expensive. A single scene at 0.2m resolution within a 40m range contains **8 million voxels** to label. Self-supervised approaches eliminate this bottleneck.

**Key Insight:** If a predicted 3D occupancy volume is correct, it should be consistent with all available 2D observations when rendered from different viewpoints.

---

### 4.2 SelfOcc (CVPR 2024)

**Paper:** [SelfOcc: Self-Supervised Vision-Based 3D Occupancy Prediction](https://openaccess.thecvf.com/content/CVPR2024/papers/Huang_SelfOcc_Self-Supervised_Vision-Based_3D_Occupancy_Prediction_CVPR_2024_paper.pdf)

**Method:**
- Treats 3D representations as **signed distance fields (SDF)**.
- Renders 2D images of **previous and future frames** as self-supervision signals.
- Multi-frame photometric consistency drives 3D structure learning.

**Results:**
- Outperforms SceneRF by **58.7%** using a single frame on SemanticKITTI.
- First self-supervised work producing reasonable 3D occupancy for **surround cameras** on nuScenes.

---

### 4.3 Let Occ Flow / SelfOccFlow

**Let Occ Flow** -- first self-supervised method for **joint 3D occupancy and occupancy flow prediction** using only camera inputs, with no 3D annotations whatsoever.

**SelfOccFlow** -- extends this to full 3D occupancy flow estimation, disentangling the scene into **separate static and dynamic SDFs** -- the static background and dynamic foreground are modeled with distinct implicit fields, enabling flow prediction for dynamic objects while keeping the static scene anchored.

---

### 4.4 RenderOcc and Rendering-Based Supervision

RenderOcc (discussed in Section 1.9) pioneered 2D rendering supervision for occupancy. The broader approach:

1. Predict 3D occupancy volume from multi-view images.
2. Convert to **Semantic-Density-Field** (volume density + semantic logits per voxel).
3. **Volume render** this field to produce 2D depth maps and semantic maps.
4. Supervise with readily available 2D labels (LiDAR-projected depth, 2D semantic segmentation).

**GaussianOcc:** Fully self-supervised 3D occupancy estimation using **Gaussian splatting** instead of NeRF-style volume rendering. Faster rendering enables more efficient training.

**Annotation-free methods** (UniOcc, RadOcc) achieve **ranks 3-4** among all methods on Occ3D-nuScenes despite lacking explicit voxel annotations -- demonstrating that 3D labels may be unnecessary.

---

### 4.5 Foundation Models for 3D Understanding

**DINOv2 Integration:**
- Self-supervised DINOv2 features are lifted from 2D to 3D, providing feature targets for occupied voxels.
- OccFeat uses DINOv2 features as self-supervised occupancy prediction targets, enabling joint spatial and semantic reasoning without manual labels.
- Denoising procedures mitigate artifacts when lifting DINOv2 features with positional encodings.

**SAM Integration:**
- OccNeRF uses SAM-derived segmentation masks to infuse fine-grained semantic knowledge into occupancy prediction, particularly in LiDAR-free scenarios.

**GASP (Geometric and Semantic Self-Supervised Pre-training):**
- Trains a model to predict future occupancy, vision foundation model features, and ego-path at any queried point in continuous spacetime.
- Jointly reasons about geometric and semantic scene evolution.

**DriveWorld (4D Pre-training):**
- Uses world models for 4D pre-training, showing substantial improvements across 3D detection, tracking, mapping, motion forecasting, occupancy prediction, and planning simultaneously.

**ViDAR** (Section 2.7) is the most impactful result: visual point cloud forecasting as a pre-text task unifies all knowledge needed for downstream tasks, using only Image-LiDAR pairs with no annotations.

---

## 5. Relevance to Airside Operations

### 5.1 Why Occupancy Prediction Is Ideal for Airside

Airport airside environments present unique challenges that make occupancy prediction **fundamentally more suitable** than traditional object detection:

**Non-Standard Objects:**
The airside contains objects that do not exist in any standard driving dataset:
- Aircraft (extremely large, irregular shapes, varying configurations)
- Ground Support Equipment (GSE): tugs, pushback tractors, belt loaders, K-loaders, fuel trucks, catering trucks, lavatory trucks, air start units
- Baggage carts (articulated chains of varying length)
- Jet bridges (moving structures)
- Temporary obstacles: cones, chocks, barriers, FOD

A traditional object detector trained on road vehicles would fail silently on most of these. An occupancy network simply answers: **"Is this space occupied?"** -- and any physical obstacle is detected regardless of class.

**Research Validation:** Experiments with autonomous aircraft towing vehicles at airports have confirmed that "aircraft are among the most difficult objects to detect in an airfield due to their large sizes and irregular shapes, and aircraft detection by using sensors equipped with autonomous GSE has not been adequately addressed yet." Occupancy prediction sidesteps this entirely.

---

### 5.2 Class-Agnostic Detection Advantage

Occupancy prediction's class-agnostic nature is its greatest strength for airside:

- **No training data bottleneck**: Traditional detectors need thousands of labeled examples per class. Airport GSE comes in hundreds of variants from dozens of manufacturers. Occupancy prediction needs only "occupied/free" labels.
- **Automatic generalization**: New equipment types, unusual aircraft configurations, temporary structures -- all detected without retraining.
- **Safety-critical coverage**: A standard detector with 95% recall for known classes still misses 100% of unknown classes. Occupancy prediction provides recall across all physical objects.

Conventional 3D bounding boxes cannot describe irregular vehicles -- a belt loader with its conveyor extended, an articulated pushback tractor, or a catering truck with its platform raised. Occupancy captures the actual geometric shape.

---

### 5.3 Handling Large Objects (Aircraft)

Aircraft pose a unique challenge: they are **far larger than any road vehicle** (wingspan 30-80m, length 30-70m). Standard occupancy grids designed for urban driving use ranges of [-40m, 40m] and would not fully contain a large aircraft.

**Adaptations Required:**

| Parameter | Urban Driving (Standard) | Airside (Required) |
|-----------|--------------------------|---------------------|
| Range (X/Y) | 40m | 100-200m |
| Range (Z) | 5.4m | 15-20m (aircraft tail height) |
| Voxel Resolution | 0.2-0.4m | 0.2-0.5m (adaptive) |
| Grid Size | 200x200x16 | 500x500x40+ |

**Adaptive Resolution (AdaOcc-style):**
- **Fine resolution (0.1-0.2m)** near the ego vehicle for precise clearance with GSE and personnel.
- **Coarser resolution (0.5-1.0m)** at longer range for aircraft fuselage/wing detection.
- **Multi-resolution grids** that allocate computation proportional to safety criticality.

**Sparse Representations:** GaussianFormer and SparseOcc are particularly relevant -- aircraft occupy a small fraction of voxels, so sparse methods avoid the computational explosion of dense grids at airside scale.

---

### 5.4 Resolution and Range Requirements for Airside

**Near-Field (0-20m):**
- Fine resolution (0.1-0.2m) essential for:
  - Clearance with aircraft fuselage during pushback/towing
  - Personnel detection (ground crew)
  - FOD on taxiways
  - Chock and cone detection
- Safety-critical: collision avoidance at operational speeds

**Mid-Field (20-80m):**
- Medium resolution (0.2-0.5m) for:
  - Other GSE tracking and avoidance
  - Taxiway/apron layout understanding
  - Gate equipment configuration
- Planning horizon: trajectory planning around parked aircraft

**Far-Field (80-200m):**
- Coarser resolution (0.5-1.0m) for:
  - Aircraft on taxiways (approach/departure path)
  - Runway incursion prevention
  - Strategic path planning
- Awareness: anticipate movements and conflicts

---

### 5.5 Jet Blast and FOD as Occupancy/Hazard Prediction

**Jet Blast as Occupancy:**
Jet blast hazard zones are effectively **invisible occupied space** -- physically dangerous regions with no visual object present. This maps naturally to occupancy prediction with hazard semantics:

- **CFD-Informed Priors**: Jet blast follows predictable physics (1D exponential decay of a free jet into still air, modified by aircraft engine type and power setting). These physics models (using RANS equations with SST k-omega or RSM turbulence models) can provide prior distributions.
- **Occupancy-Style Representation**: Jet blast zones can be encoded as a **hazard occupancy field** -- voxels with predicted danger levels based on engine state, aircraft type, and wind conditions. The ego vehicle's planner treats high-hazard voxels the same as physically occupied voxels: regions to avoid.
- **Temporal Prediction**: Jet blast hazard zones change with engine state (idle, taxi, takeoff power). A 4D occupancy world model that conditions on aircraft state can predict future hazard evolution.

**FOD (Foreign Object Debris):**
- FOD detection maps naturally to **fine-grained occupancy prediction** at ground level. Small objects (0.05-0.2m) on taxiway/runway surfaces must be detected.
- Current systems use radar, electro-optical, and infrared sensors. Camera-based occupancy prediction at fine resolution (0.05-0.1m) in the near-field could complement these.
- AI-powered FOD detection using YOLO and drones is already deployed; occupancy-based approaches would provide continuous 3D spatial coverage rather than 2D image-based detection.
- A **4D occupancy world model** could track FOD persistence -- objects that remain in the same voxels across frames are likely static debris, while transient anomalies may be sensor noise.

---

### 5.6 Airside-Specific Architecture Recommendations

Based on this research, an airside occupancy system should incorporate:

1. **Adaptive Multi-Resolution Grid** (AdaOcc-inspired): Fine near-field, coarse far-field, with dynamic reallocation based on operational context.

2. **Sparse Representation** (GaussianFormer/SparseOcc): Essential for the scale of airside grids -- dense voxels at 200m range are computationally prohibitive.

3. **Self-Supervised Training** (SelfOcc/RenderOcc/UnO): Airside lacks large-scale 3D occupancy annotations. Self-supervised methods using camera-LiDAR pairs can bootstrap occupancy models without manual voxel labeling.

4. **4D Forecasting** (Drive-OccWorld/OccWorld): Predict future occupancy conditioned on ego and aircraft actions. Critical for pushback operations where the ego tractor must predict aircraft trajectory.

5. **Hazard Occupancy Layers**: Extend standard binary occupancy with hazard semantics -- jet blast zones, propeller wash, restricted areas encoded as occupancy with semantic tags.

6. **Class-Agnostic with Optional Semantics**: Primary system operates class-agnostic for safety (any obstacle is avoided). Optional semantic head distinguishes aircraft, GSE, personnel, FOD for operational intelligence.

7. **Foundation Model Backbone** (DINOv2): Pre-train on large-scale driving data, fine-tune on airside imagery. DINOv2 features transfer well to novel object categories without class-specific supervision.

---

## Summary of Key Methods

| Method | Year | Venue | Type | Key Innovation |
|--------|------|-------|------|----------------|
| Tesla Occupancy Net | 2022 | AI Day | 3D Occ | Voxel-based, multi-camera, real-time, flow output |
| SurroundOcc | 2023 | ICCV | 3D Occ | 2D-3D attention, multi-level supervision, dense label pipeline |
| TPVFormer | 2023 | CVPR | 3D Occ | Tri-perspective view, sparse supervision |
| FB-OCC | 2023 | CVPR-W | 3D Occ | Forward-backward projection, challenge winner |
| FlashOcc | 2023 | -- | 3D Occ | Channel-to-height, 2D-only convolutions, 6.5ms |
| SparseOcc | 2024 | ECCV | 3D Occ | Fully sparse architecture, RayIoU metric |
| PanoOcc | 2024 | CVPR | 3D Occ | Unified panoptic + occupancy, coarse-to-fine |
| RenderOcc | 2024 | ICRA | 3D Occ | 2D rendering supervision only, no 3D labels |
| GaussianFormer | 2024 | ECCV | 3D Occ | Gaussian scene representation, 17-25% memory |
| OccWorld | 2023 | -- | 4D Occ WM | GPT-like autoregressive occupancy generation |
| Drive-OccWorld | 2025 | AAAI | 4D Occ WM | Action-conditioned, end-to-end planning |
| OccSora | 2024 | -- | 4D Occ WM | Diffusion-based, 16s generation |
| Cam4DOcc | 2024 | CVPR | 4D Benchmark | Camera-only 4D forecasting benchmark |
| UnO | 2024 | CVPR | 4D Occ | Unsupervised continuous 4D field |
| ViDAR | 2024 | CVPR | Pre-training | Visual point cloud forecasting pre-text task |
| OccLLaMA | 2024 | -- | Multimodal WM | Occupancy-language-action unified model |
| SelfOcc | 2024 | CVPR | Self-supervised | SDF-based, rendering self-supervision |
| Occ3D | 2023 | NeurIPS | Benchmark | Large-scale occupancy benchmark |
| ImplicitO | 2023 | CVPR | Implicit Occ | Continuous spatio-temporal occupancy queries |
| Occ Flow Fields | 2022 | -- | Occ + Flow | Waymo's occupancy + flow representation |

---

## Key Takeaways

1. **Occupancy prediction has replaced BEV as the dominant 3D representation** for vision-based autonomous driving perception, driven by its ability to handle arbitrary objects and fine-grained geometry.

2. **4D occupancy prediction IS a world model** -- predicting future 3D occupancy grids conditioned on actions is precisely the world model formulation. Methods like OccWorld, Drive-OccWorld, and OccSora make this explicit.

3. **Self-supervised and annotation-free methods** (SelfOcc, RenderOcc, UnO, ViDAR) are closing the gap with fully supervised approaches, suggesting that expensive 3D voxel annotations may become unnecessary.

4. **Sparse and efficient representations** (GaussianFormer, SparseOcc, FlashOcc) make real-time deployment feasible, with some methods achieving <10ms latency.

5. **Occupancy-based planning** (cost volumes, flow fields, implicit queries) enables scalable, class-agnostic motion planning that naturally handles the open-world nature of driving.

6. **For airside applications**, occupancy prediction is arguably the only viable approach -- the non-standard object vocabulary, extreme size range (FOD to aircraft), and safety-critical requirements make class-specific detection impractical, while occupancy's class-agnostic nature provides complete spatial coverage.

---

## Sources

- [Tesla's Occupancy Networks - Think Autonomous](https://www.thinkautonomous.ai/blog/occupancy-networks/)
- [Vision-based 3D Occupancy Prediction Review (arXiv)](https://arxiv.org/html/2405.02595v1)
- [SurroundOcc (ICCV 2023)](https://arxiv.org/abs/2303.09551)
- [TPVFormer (CVPR 2023)](https://github.com/wzzheng/TPVFormer)
- [FB-OCC (NVIDIA)](https://arxiv.org/abs/2307.01492)
- [FlashOcc](https://arxiv.org/abs/2311.12058)
- [SparseOcc (ECCV 2024)](https://arxiv.org/abs/2312.17118)
- [PanoOcc (CVPR 2024)](https://arxiv.org/abs/2306.10013)
- [RenderOcc (ICRA 2024)](https://arxiv.org/abs/2309.09502)
- [GaussianFormer (ECCV 2024)](https://arxiv.org/abs/2405.17429)
- [OccWorld](https://wzzheng.net/OccWorld/)
- [Drive-OccWorld (AAAI 2025)](https://arxiv.org/abs/2408.14197)
- [OccSora](https://arxiv.org/abs/2405.20337)
- [Cam4DOcc (CVPR 2024)](https://arxiv.org/abs/2311.17663)
- [UnO (CVPR 2024)](https://arxiv.org/abs/2406.08691)
- [ViDAR (CVPR 2024)](https://arxiv.org/html/2312.17655v1)
- [OccLLaMA](https://arxiv.org/abs/2409.03272)
- [SelfOcc (CVPR 2024)](https://openaccess.thecvf.com/content/CVPR2024/papers/Huang_SelfOcc_Self-Supervised_Vision-Based_3D_Occupancy_Prediction_CVPR_2024_paper.pdf)
- [Occ3D (NeurIPS 2023)](https://tsinghua-mars-lab.github.io/Occ3D/)
- [OpenOccupancy (ICCV 2023)](https://github.com/JeffWang987/OpenOccupancy)
- [Occupancy Flow Fields (Waymo)](https://arxiv.org/abs/2203.03875)
- [ImplicitO (CVPR 2023)](https://openaccess.thecvf.com/content/CVPR2023/html/Agro_Implicit_Occupancy_Flow_Fields_for_Perception_and_Prediction_in_Self-Driving_CVPR_2023_paper.html)
- [AdaOcc: Adaptive-Resolution Occupancy](https://arxiv.org/html/2408.13454v1)
- [Occupancy Prediction-Guided Neural Planner](https://arxiv.org/pdf/2305.03303)
- [Awesome Multi-Camera 3D Occupancy Prediction](https://github.com/lvchuandong/Awesome-Multi-Camera-3D-Occupancy-Prediction)
- [A Survey of World Models for Autonomous Driving](https://arxiv.org/pdf/2501.11260)
- [Airfield Autonomous Driving Deployment](https://arxiv.org/html/2403.01233v1)
- [FAA - Autonomous Ground Vehicle Systems on Airports](https://www.faa.gov/airports/new_entrants/agvs_on_airports)
- [Foundation Models for AD Perception Survey](https://arxiv.org/html/2509.08302v1)
- [GASP Self-Supervised Pre-training](https://arxiv.org/html/2503.15672)
- [GaussianOcc](https://arxiv.org/html/2408.11447v3)
- [Jet Blast Prediction Model (DOT)](https://rosap.ntl.bts.gov/view/dot/9528/dot_9528_DS1.pdf)
