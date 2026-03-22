# Tokenized World Models, Discrete Representation Learning, and JEPA-Style Approaches for Autonomous Driving

## Comprehensive Technical Report

---

## 1. Tokenized / Discrete World Models

### 1.1 VQ-VAE and VQ-GAN Based World Models

The core idea behind tokenized world models is to compress high-dimensional sensory inputs (images, video, LiDAR) into discrete token sequences using Vector Quantized Variational Autoencoders (VQ-VAE) or VQ-GAN, then model future predictions as next-token prediction -- mirroring the paradigm that has proven so successful in large language models.

**VQ-VAE Fundamentals for Driving:**
- An encoder maps input (e.g., a 256x256 image) to a spatial grid of continuous features
- Each feature vector is quantized to the nearest entry in a learned codebook (typically 512-16,384 codes)
- The decoder reconstructs the input from these discrete codes
- Straight-through estimation allows gradient flow through the non-differentiable quantization step

**Key driving world models using VQ-VAE / VQ-GAN tokenization:**

| Model | Venue | Tokenization | Key Innovation |
|-------|-------|-------------|----------------|
| [GAIA-1](https://arxiv.org/abs/2309.17080) | Wayve 2023 | VQ for video frames | 6.5B param autoregressive transformer; LLM-like scaling laws |
| [Copilot4D](https://arxiv.org/html/2311.01017) | ICLR 2024 | VQ-VAE for LiDAR BEV | Discrete diffusion over point cloud tokens; 50% Chamfer distance reduction |
| [OccWorld](https://arxiv.org/html/2311.16038) | ECCV 2024 | VQ-VAE for 3D occupancy grids | GPT-like autoregressive prediction in occupancy space; 512-code codebook |
| [DrivingWorld](https://arxiv.org/html/2412.19505v2) | 2024 | Temporal-aware VQ-VAE | 1B param world model; 40+ second video generation (640 frames) |
| [DrivingGPT](https://arxiv.org/html/2412.18607) | ICCV 2025 | VQ-VAE (16,384 codes) | Interleaved image+action tokens as unified "driving language" |

**Copilot4D (Waabi, ICLR 2024)** is a standout example. It tokenizes LiDAR point clouds into BEV representations using a custom VQ-VAE with a PointNet encoder, Swin Transformer backbone, and dual-branch decoder (neural feature grid + binary occupancy). It then applies discrete diffusion (a modified MaskGIT with controlled noise injection at rate eta=20%) to predict future point clouds. Results: 0.36 Chamfer distance at 1s on nuScenes vs. 1.41 for prior state-of-the-art -- a 65-75% reduction.

**OccWorld (ECCV 2024)** tokenizes 3D semantic occupancy grids by first projecting them to BEV, assigning learnable embeddings per semantic class, encoding with a lightweight 2D CNN, and quantizing against a 512-entry codebook. A GPT-like spatiotemporal transformer with U-Net multi-scale aggregation then predicts future scenes autoregressively with temporal causal attention.

### 1.2 VQVAE-2 for Video Prediction

The hierarchical VQ-VAE approach (VQ-VAE-2) decomposes video into multi-scale discrete latent hierarchies, separating global structure (top level) from fine texture and motion (bottom level). [Predicting Video with VQ-VAE](https://arxiv.org/abs/2103.01950) demonstrated this at 256x256 resolution using:
- A hierarchical VQ-VAE encoder producing top and bottom latent codes
- A PixelCNN with causal temporal convolutions and spatiotemporal self-attention for the top prior
- A slice-by-slice 2D PixelCNN for the bottom prior, conditioned on top latents

This hierarchical approach dramatically reduces dimensionality compared to pixel-space prediction, enabling scalable autoregressive models.

### 1.3 VideoGPT and Autoregressive Video Models

**[VideoGPT](https://arxiv.org/pdf/2104.10157)** established the two-stage pipeline: (1) train a VQ-VAE to encode video into discrete latent sequences, (2) train an autoregressive transformer in that latent space. This paradigm has been extended to driving:

**[DrivingWorld](https://arxiv.org/html/2412.19505v2)** (1B parameters) enhances the VideoGPT paradigm with:
- A temporal-aware VQ-VAE with self-attention layers before and after quantization operating along the temporal dimension
- A vehicle pose tokenizer that discretizes orientation into alpha categories and position into beta x gamma bins
- Decoupled spatial-temporal processing: next-state prediction via temporal-multimodal fusion + next-token prediction within each state
- Random masking strategy (50% token dropout) to prevent content drifting
- Result: FVD 90.9 on nuScenes, generating 40+ second coherent driving videos

**[DrivingGPT](https://arxiv.org/html/2412.18607)** (ICCV 2025) treats driving as a multi-modal language problem:
- Visual frames tokenized via VQ-VAE into 576-2,304 tokens per frame (spatial downsampling 8x or 16x)
- Actions tokenized as (x, y, theta) quantized into 128 bins each, with separate vocabularies
- Combined vocabulary: 16,768 tokens (16,384 image + 384 action)
- Interleaved sequence: z1, q1, z2, q2, ..., zt, qt
- Llama-like transformer with frame-wise 1D rotary embeddings
- Results: FVD 142.61, FID 12.78; planning PDMS score 82.4% on NAVSIM

### 1.4 How Tokenization Enables LLM-like Scaling

**[GAIA-1 Scaling](https://wayve.ai/thinking/scaling-gaia-1/)** provides the strongest evidence that tokenized world models follow LLM-like scaling laws:
- Scaled from 1B to 9B+ trainable parameters (6.5B world model + 2.6B video diffusion decoder)
- Trained on 4,700 hours of London driving footage
- Power-law curves fitted to validation cross-entropy show consistent improvement with scale
- "There is still significant room for improvement that can be obtained by scaling data and compute"
- Training: 15 days on 64 NVIDIA A100 GPUs for the world model

**[DriveGPT](https://openreview.net/forum?id=SBUxQakoJJ)** was the first published study of large-scale scaling laws specifically for driving, with the largest model trained on 100M+ human demonstrations and 1B+ parameters, validating that increasing both data and compute yields better scalability -- consistent with LLM trends.

**[DriveVLA-W0](https://arxiv.org/abs/2510.12796)** demonstrates that world modeling amplifies data scaling laws: using future image prediction as a dense self-supervised signal forces the model to learn driving dynamics, addressing the "supervision deficit" where sparse action labels leave model capacity underutilized.

### 1.5 Token Prediction vs. Continuous Latent Prediction Tradeoffs

| Dimension | Discrete Token Prediction | Continuous Latent Prediction |
|-----------|--------------------------|------------------------------|
| **Scaling** | LLM-proven scaling laws directly apply | Less established scaling behavior |
| **Computational efficiency** | More efficient at small scale; sequential bottleneck at large scale | Parallel generation possible (diffusion) |
| **Visual fidelity** | May lose fine details through quantization | Can preserve subtle visual information |
| **Prompt adherence** | Better CLIP scores (controllability) | Lower prompt fidelity |
| **Temporal consistency** | Autoregressive drift over long horizons | Diffusion models can refine globally |
| **Training simplicity** | Standard cross-entropy loss | Complex noise schedules, loss weighting |

**Evidence from RL world models:** [DIAMOND](https://diamond-wm.github.io/) (NeurIPS 2024 Spotlight) showed that diffusion-based continuous world models achieve a mean human-normalized score of 1.46 on Atari 100k, surpassing IRIS (a discrete-token world model) because "compression into a compact discrete representation may ignore visual details that are important for reinforcement learning."

**Hybrid approaches** are emerging as the best of both worlds. [Epona](https://openaccess.thecvf.com/content/ICCV2025/papers/Zhang_Epona_Autoregressive_Diffusion_World_Model_for_Autonomous_Driving_ICCV_2025_paper.pdf) (ICCV 2025) combines autoregressive modeling with diffusion, using continuous visual tokenizers to preserve scene details while maintaining autoregressive temporal structure -- generating minute-long driving videos without drift.

---

## 2. JEPA (Joint Embedding Predictive Architecture)

### 2.1 Yann LeCun's JEPA Vision for World Models

JEPA is LeCun's proposed architecture for building world models that can serve as the core reasoning module in autonomous AI agents. The fundamental insight: rather than predicting every pixel of the future (generative approach), predict abstract representations of the future in a learned embedding space. This allows the model to:

- Focus on high-level, semantically meaningful features
- Discard unpredictable, irrelevant details (e.g., exact texture of clouds)
- Learn more sample-efficiently
- Avoid the intractable problem of modeling every mode of high-dimensional output distributions

LeCun's [position paper](https://arxiv.org/abs/2306.02572) outlines JEPA as central to a modular cognitive architecture with a world model, actor, critic, short-term memory, and configurator.

### 2.2 I-JEPA and V-JEPA

**I-JEPA (Image JEPA):** Predicts abstract representations of masked image regions from visible context. Unlike MAE which reconstructs pixels, I-JEPA compares representations, enabling focus on semantic content rather than low-level texture. Uses a ViT encoder and predictor with EMA teacher updates.

**[V-JEPA](https://ai.meta.com/blog/v-jepa-yann-lecun-ai-model-video-joint-embedding-predictive-architecture/) (Video JEPA):** Extends to video, predicting masked spatiotemporal regions in representation space. Key results:
- 82.1% on Kinetics-400, 71.2% on Something-Something-v2
- 1.5x to 6x more training/sample efficient than generative approaches
- Pre-trained entirely on unlabeled video data

**[V-JEPA 2](https://arxiv.org/abs/2506.09985) (2025):** A major scale-up with several innovations:
- **Architecture:** ViT-g (1B parameters) with 3D Rotary Position Embeddings (3D-RoPE)
- **Data:** VideoMix22M dataset (22M videos, 1M+ hours) -- up from 2M videos
- **Training:** Progressive resolution training (low-res 16-frame to 64-frame 384x384), yielding 8.4x computational efficiency gain
- **Results:** 77.3% on SSv2, 39.7 recall@5 on Epic-Kitchens-100 (44% relative improvement), 84.0% on PerceptionTest
- **V-JEPA 2-AC:** Action-conditioned variant post-trained on only 62 hours of unlabeled robot video; deployed zero-shot on Franka arms for pick-and-place (65-80% success); planning in 16 seconds vs. 4 minutes for video-generation baselines

### 2.3 How JEPA Differs from Generative World Models

| Aspect | JEPA | Generative World Models |
|--------|------|------------------------|
| **Prediction target** | Abstract embeddings | Pixels, tokens, or continuous latents |
| **Information discarded** | Unpredictable details (noise, irrelevant texture) | Must model all details or explicitly compress |
| **Collapse prevention** | Variance regularization, EMA teacher | N/A (reconstruction loss prevents collapse) |
| **Sample efficiency** | 1.5-6x better than generative | Requires more data for comparable quality |
| **Output interpretability** | Embeddings require probes for visualization | Directly generates human-interpretable outputs |
| **Planning** | Energy minimization in embedding space | Rollout in pixel/token space |
| **Multimodal generation** | Cannot directly generate images/video | Can generate realistic synthetic data |

### 2.4 MC-JEPA and Other Variants

**[MC-JEPA](https://arxiv.org/abs/2307.12698) (Motion-Content JEPA):** Jointly learns optical flow (motion) and content features within a shared encoder. Uses a JEPA objective to simultaneously interpret dynamic and static elements of video.

**[AD-L-JEPA](https://arxiv.org/abs/2501.04969) (AAAI 2026):** The first JEPA-based pre-training method for autonomous driving with LiDAR:
- Predicts Bird's-Eye-View embeddings rather than generating masked regions
- Neither generative nor contrastive -- uses explicit variance regularization to avoid collapse
- Reduces GPU hours by 1.9-2.7x and GPU memory by 2.8-4x vs. Occupancy-MAE
- Consistent improvements on 3D detection across KITTI3D, Waymo, and ONCE datasets
- Code available at [github.com/haoranzhuexplorer/ad-l-jepa-release](https://github.com/haoranzhuexplorer/ad-l-jepa-release)

**[LeJEPA](https://arxiv.org/abs/2511.08544) (November 2025, by Balestriero and LeCun):** Provides the theoretical foundation previously missing from JEPA:
- Proves that the optimal embedding distribution is an isotropic Gaussian
- Introduces SIGReg (Sketched Isotropic Gaussian Regularization) objective
- Eliminates heuristics: no teacher-student networks, no stop-gradients needed
- Single hyperparameter; works out-of-the-box across datasets and architectures
- 79% top-1 accuracy on ImageNet with ViT-H/14 in only 100 epochs (vs. I-JEPA's 300)

### 2.5 Applicability to Driving: Predicting Future Embeddings of Driving Scenes

JEPA-style approaches are highly relevant to driving for several reasons:

1. **AD-L-JEPA** directly demonstrates JEPA for LiDAR-based driving perception, achieving state-of-the-art pre-training efficiency.

2. **Planning via embedding prediction:** V-JEPA 2-AC shows that predicting future embeddings (rather than pixels) enables efficient model-predictive control -- optimize action sequences by minimizing L1 distance between predicted and goal state representations using the Cross-Entropy Method.

3. **Robustness to irrelevant variation:** Driving scenes contain massive amounts of unpredictable detail (cloud shapes, exact shadow patterns, pedestrian clothing). JEPA's ability to focus on semantically meaningful features while ignoring such details is particularly valuable.

4. **Computational feasibility for real-time planning:** The 240x speedup of V-JEPA 2-AC over video-generation baselines for planning (16s vs 4min) suggests embedding-space prediction could enable real-time driving decisions.

---

## 3. Self-Supervised Representation Learning for Driving

### 3.1 Contrastive Learning Applied to Driving

**Cross-modal contrastive methods** have become a dominant paradigm for learning driving representations:

- **[SLidR](https://github.com/valeoai/slidr)** (Image-to-LiDAR Self-Supervised Distillation): Uses superpixels to cluster pixels and corresponding LiDAR points for contrastive learning.
- **[ScaLR](https://arxiv.org/abs/2310.17504)** (CVPR 2024): Scales cross-modal distillation, achieving better 3D features than PPKT and SLidR.
- **Cross-modal self-supervised learning** (2024): Systematic study showing cross-modality contrastive learning outperforms single-modality alternatives for self-driving point clouds.

**Key finding:** Combining contrastive learning with masked autoencoders creates a unified framework that leverages complementary strengths -- global semantic representation from contrastive loss + local spatial perception from reconstruction.

### 3.2 MAE (Masked Autoencoders) for Driving Scenes

- **Occupancy-MAE:** Masks and reconstructs 3D occupancy representations for self-supervised pre-training of driving perception models.
- AD-L-JEPA shows that JEPA-style prediction in embedding space outperforms MAE-style pixel reconstruction while using 1.9-2.7x fewer GPU hours and 2.8-4x less memory.

### 3.3 DINO/DINOv2 Features for Driving Understanding

**[DINO Pre-training for Vision-based End-to-end Autonomous Driving](https://arxiv.org/abs/2407.10803)** provides direct evidence:
- DINO-pretrained encoders achieve 62.18% route completion in novel environments vs. 53.20% for supervised ImageNet pre-training (~9 percentage point improvement)
- Distance completion: 82.67% vs. 72.23%
- DINO features show faster convergence and reduced overfitting compared to supervised baselines

### 3.4 Pre-trained Vision Foundation Models for Driving

**SAM (Segment Anything Model):**
- [AD-SAM](https://arxiv.org/abs/2510.27047): Fine-tuned SAM with dual-encoder and deformable decoder for driving semantic segmentation
- Zero-shot adversarial robustness is acceptable under both black-box corruptions and white-box attacks

**Cross-modal distillation pipeline (2D foundation models to 3D LiDAR):**
1. Extract rich features from 2D foundation models (DINO, DINOv2, SAM)
2. Project to 3D space using camera-LiDAR calibration
3. Contrastive or distillation loss to transfer knowledge to 3D networks
4. Result: significantly improved 3D detection and segmentation without 3D labels

### 3.5 How Representation Quality Impacts World Model Quality

- **DriveWorld** (CVPR 2024) uses world model pre-training to learn 4D representations, achieving 7.5% mAP improvement for 3D detection and 5.0% IoU improvement for occupancy prediction
- **DriveVLA-W0** shows that world modeling addresses the "supervision deficit" in VLA models
- Better tokenizers directly yield better world models: DrivingWorld's temporal-aware VQ-VAE reduces FVD from 4,017.15 to 637.60 through improved tokenization alone

---

## 4. Scaling Laws and Architecture Choices

### 4.1 Transformer-Based vs. CNN-Based World Models

The field has decisively shifted toward transformer-based architectures:

**Transformer-based (dominant):**
- GAIA-1 (6.5B params), DrivingWorld (1B), DrivingGPT (Llama-like)
- [Genie](https://arxiv.org/abs/2402.15391) (11B params, DeepMind): Foundation world model trained on 200,000+ hours of gaming video

### 4.2 State Space Models (Mamba, S4) for Temporal Prediction in Driving

Mamba-based architectures are gaining traction for their linear complexity vs. transformers' quadratic cost:

- **[DriveMamba](https://arxiv.org/abs/2602.13301):** Task-centric scalable SSM for end-to-end autonomous driving
- **[MambaOcc](https://arxiv.org/html/2408.11464):** BEV-based occupancy prediction using linear Mamba-style attention
- **[DRAMA](https://arxiv.org/html/2408.03601v1):** Hybrid Mamba-Transformer decoder for end-to-end motion planning
- **DriveWorld** (CVPR 2024): Memory State-Space Model with dynamic memory banks

**Key advantage:** Mamba enables O(n) temporal modeling vs. O(n^2) for self-attention, making long-horizon driving prediction computationally feasible.

### 4.3 Scaling Laws for World Models

**GAIA-1 scaling experiments:** Power-law curves on validation cross-entropy across model variants show consistent improvement, analogous to LLM scaling trends.

**[Data Scaling Laws for End-to-End Autonomous Driving](https://arxiv.org/abs/2504.04338)** (CVPR 2025 Workshop): Roughly log-linear gains in both open-loop and closed-loop metrics as data scales from 16 to 8,192 hours.

**[Waymo Scaling Laws](https://waymo.com/blog/2025/06/scaling-laws-in-autonomous-driving/)** (June 2025): Establishes new scaling laws for motion planning and forecasting, validating that bigger models + more data deliver extraordinary gains.

### 4.4 Hybrid Architectures

The most promising recent work combines multiple paradigms:

- **[Epona](https://openaccess.thecvf.com/content/ICCV2025/papers/Zhang_Epona_Autoregressive_Diffusion_World_Model_for_Autonomous_Driving_ICCV_2025_paper.pdf)** (ICCV 2025): Autoregressive + diffusion. Generates minute-long driving videos without drift.
- **Copilot4D:** Discrete tokens (VQ-VAE) + discrete diffusion (modified MaskGIT).
- **[DiffusionDrive](https://github.com/hustvl/DiffusionDrive)** (CVPR 2025 Highlight): Truncated diffusion for real-time E2E driving.
- **[Panacea](https://panacea-ad.github.io/):** Diffusion with decomposed 4D attention for panoramic controllable video generation.

---

## 5. Open-Source World Model Implementations

### 5.1 Available Code Repositories

**Complete Frameworks:**

| Repository | Description | Activity |
|-----------|-------------|----------|
| [OpenDWM](https://github.com/SenseTime-FVG/OpenDWM) | SenseTime's comprehensive framework with pretrained checkpoints | Active (May 2025) |
| [Vista](https://github.com/OpenDriveLab/DriveAGI) | OpenDriveLab's generalizable driving world model (NeurIPS 2024) | Available |
| [OccWorld](https://github.com/wzzheng/OccWorld) | 3D occupancy world model (ECCV 2024) | Available |
| [DriveDreamer](https://github.com/JeffWang987/DriveDreamer) | First world model from real-world driving (ECCV 2024) | Active |
| [DriveDreamer-2](https://github.com/f1yfisher/DriveDreamer2) | LLM-enhanced world model (AAAI 2025) | Active |
| [DiffusionDrive](https://github.com/hustvl/DiffusionDrive) | CVPR 2025 Highlight, real-time E2E driving | Code + weights |
| [DIAMOND](https://github.com/eloialonso/diamond) | Diffusion world model for RL (NeurIPS 2024 Spotlight) | Active |

**JEPA Implementations:**

| Repository | Description |
|-----------|-------------|
| [V-JEPA / facebookresearch/jepa](https://github.com/facebookresearch/jepa) | Meta's official V-JEPA |
| [V-JEPA 2 / facebookresearch/vjepa2](https://github.com/facebookresearch/vjepa2) | V-JEPA 2 with action-conditioned variant |
| [AD-L-JEPA](https://github.com/haoranzhuexplorer/ad-l-jepa-release) | First JEPA for driving LiDAR (AAAI 2026) |
| [LeJEPA](https://github.com/rbalestr-lab/lejepa) | Provable JEPA objective |

**Curated Lists:**

| Repository | Description |
|-----------|-------------|
| [Awesome-World-Model](https://github.com/LMD0311/Awesome-World-Model) | Comprehensive paper collection with code links |
| [World-Models-AD-Latest-Survey](https://github.com/HaoranZhuExplorer/World-Models-Autonomous-Driving-Latest-Survey) | Continuously updated survey |
| [Awesome-LLM4AD](https://github.com/Thinklab-SJTU/Awesome-LLM4AD) | LLM/VLM/VLA/World Model for AD |

### 5.2 Benchmarks and Evaluation

**Video generation metrics on nuScenes validation set:**

| Model | FID | FVD | Year |
|-------|-----|-----|------|
| DriveGAN | 73.4 | 502.3 | 2021 |
| DriveDreamer | 52.6 | 452.0 | 2023 |
| Drive-WM | 15.8 | 122.7 | 2024 |
| GenAD | 15.4 | 184.0 | 2024 |
| DrivingGPT | 12.78 | 142.61 | 2025 |
| DriveDreamer-2 | 11.2 | 55.7 | 2025 |

---

## Key Takeaways

1. **Tokenization is the bridge** between the LLM scaling paradigm and world models. VQ-VAE/VQ-GAN enable conversion of video, LiDAR, and occupancy data into discrete tokens, making next-token prediction directly applicable.

2. **JEPA offers a fundamentally different path** -- predicting in embedding space rather than pixel/token space. AD-L-JEPA and V-JEPA 2-AC show early but promising applicability to driving, with massive efficiency gains (1.9-4x compute reduction, 240x faster planning).

3. **Hybrid architectures are winning.** The best recent systems (Epona, Copilot4D) combine autoregressive structure with diffusion refinement.

4. **Scaling laws transfer from LLMs to driving world models**, as demonstrated by GAIA-1 and DriveGPT. Log-linear improvements with data (16-8,192 hours) and model scale (1B-9B parameters).

5. **Self-supervised pre-training (DINO, MAE, contrastive) dramatically improves driving representations**, with DINO showing ~9pp improvements over supervised baselines.

6. **The open-source ecosystem is maturing rapidly.** OpenDWM, JEPA implementations, and benchmarks like WorldLens enable standardized evaluation.

7. **State space models (Mamba)** are emerging as efficient alternatives to transformers for temporal modeling, with O(n) complexity enabling longer-horizon predictions.

---

## Sources

- [GAIA-1 Scaling](https://wayve.ai/thinking/scaling-gaia-1/)
- [Copilot4D](https://arxiv.org/html/2311.01017)
- [OccWorld](https://arxiv.org/html/2311.16038)
- [DrivingWorld](https://arxiv.org/html/2412.19505v2)
- [DrivingGPT](https://arxiv.org/html/2412.18607)
- [V-JEPA 2](https://arxiv.org/abs/2506.09985)
- [V-JEPA](https://ai.meta.com/blog/v-jepa-yann-lecun-ai-model-video-joint-embedding-predictive-architecture/)
- [AD-L-JEPA](https://arxiv.org/abs/2501.04969)
- [LeJEPA](https://arxiv.org/abs/2511.08544)
- [MC-JEPA](https://arxiv.org/abs/2307.12698)
- [DINO Pre-training for AD](https://arxiv.org/abs/2407.10803)
- [LeCun JEPA Position Paper](https://arxiv.org/abs/2306.02572)
- [DIAMOND](https://diamond-wm.github.io/)
- [VideoGPT](https://arxiv.org/pdf/2104.10157)
- [VQVAE-2 Video Prediction](https://arxiv.org/abs/2103.01950)
- [OpenDWM](https://github.com/SenseTime-FVG/OpenDWM)
- [DiffusionDrive](https://github.com/hustvl/DiffusionDrive)
- [Epona](https://openaccess.thecvf.com/content/ICCV2025/papers/Zhang_Epona_Autoregressive_Diffusion_World_Model_for_Autonomous_Driving_ICCV_2025_paper.pdf)
- [DriveMamba](https://arxiv.org/abs/2602.13301)
- [DriveWorld](https://arxiv.org/abs/2405.04390)
- [DriveVLA-W0](https://arxiv.org/abs/2510.12796)
- [Data Scaling Laws for E2E Driving](https://arxiv.org/abs/2504.04338)
- [Waymo Scaling Laws](https://waymo.com/blog/2025/06/scaling-laws-in-autonomous-driving/)
- [Genie](https://arxiv.org/abs/2402.15391)
- [Awesome-World-Model](https://github.com/LMD0311/Awesome-World-Model)
