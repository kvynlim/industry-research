# Diffusion Models and Video Generation as World Models for Autonomous Driving

## A Comprehensive Technical Report

---

## Table of Contents

1. [Video Generation as World Simulation](#1-video-generation-as-world-simulation)
2. [Diffusion-Based World Models for Driving](#2-diffusion-based-world-models-for-driving)
3. [Autoregressive World Models](#3-autoregressive-world-models)
4. [Controllability and Closed-Loop Simulation](#4-controllability-and-closed-loop-simulation)
5. [Evaluation Metrics and Benchmarks](#5-evaluation-metrics-and-benchmarks)
6. [Open Challenges and Future Directions](#6-open-challenges-and-future-directions)

---

## 1. Video Generation as World Simulation

The idea that video generation models can serve as *world simulators* -- systems that learn and reproduce the physics, geometry, and dynamics of reality -- has become one of the most consequential framings in modern AI. Rather than merely synthesizing plausible pixels, a world simulator internalizes rules of object permanence, gravity, lighting, and interaction, enabling it to predict how the future unfolds in response to actions.

### 1.1 Sora (OpenAI)

OpenAI's Sora, announced in February 2024, was described by the company as a step toward building "general purpose simulators of the physical world." Sora is a **diffusion transformer** that operates on **spacetime patches** of video and image latent codes. By tokenizing video into fixed-size patches across space and time (analogous to tokens in language models), Sora can handle videos and images of variable durations, resolutions, and aspect ratios within a single architecture.

**Key technical properties:**

- **Architecture:** A transformer-based diffusion model that processes spacetime patches in a compressed latent space, using a video compression network that reduces visual data to a lower-dimensional representation before patch decomposition.
- **Emergent capabilities:** Sora exhibits 3D consistency (smoothly moving through scenes while maintaining spatial coherence), long-range temporal coherence, rudimentary object permanence, and the ability to simulate digital worlds (e.g., Minecraft-like environments with physics and agent control).
- **Scale hypothesis:** OpenAI's results suggest that scaling video generation models -- in data, parameters, and compute -- is a viable path to general-purpose world simulation. Simple physical behaviors emerged from pre-training scale alone, without explicit physics supervision.

**Sora 2** (late 2025) advanced these capabilities substantially. Physics fidelity improved: basketballs rebound correctly off backboards, and the model maintains continuity across multiple shots. Sora 2 also introduces synchronized audio generation. OpenAI positions these improvements as analogous to the "GPT-3.5 moment" for video -- where qualitative leaps in coherence and controllability emerge from continued scaling.

**Implications for autonomous driving:** While Sora was not designed specifically for driving, its demonstration that diffusion transformers can learn rudimentary physics from video data alone validates the foundational thesis that drives the entire field of driving world models. The emergent 3D consistency and temporal coherence are precisely the properties needed for a driving simulator.

### 1.2 Genie / Genie 2 / Genie 3 (Google DeepMind)

Google DeepMind's Genie series represents the most ambitious effort to build **interactive** world models -- systems where a user or AI agent can take actions and the model generates the consequences in real time.

**Genie 2** (December 2024) is an **autoregressive latent diffusion model** trained on large-scale video data. Its architecture passes video frames through an autoencoder, then feeds latent representations into a large transformer dynamics model trained with a causal mask (similar to LLMs). At inference, it samples autoregressively on a frame-by-frame basis conditioned on individual actions and prior latent frames, with classifier-free guidance improving action controllability.

Key capabilities of Genie 2:
- Generates consistent interactive worlds for up to ~60 seconds
- Demonstrates **emergent behaviors**: object interactions (doors opening, balloons bursting), physics simulation (water, gravity, smoke), diverse character animation, NPC behavior modeling, and advanced rendering effects (reflections, bloom, dynamic lighting)
- Exhibits **long-horizon memory**: it remembers off-screen world elements and renders them consistently when the user returns
- Accepts a single prompt image (from Imagen 3 or real-world photos) and converts it into a playable 3D environment
- Generalizes out-of-distribution, converting concept art and drawings into interactive environments

**Genie 3** (August 2025) achieves **real-time interactivity** at 24 FPS and 720p resolution -- a fundamental shift from Genie 2's offline generation. Its autoregressive generation learns physics and world dynamics from observation rather than hardcoded physics engines. Genie 3 maintains consistency for several minutes with visual memory extending approximately one minute. DeepMind explicitly positions world models as "a key stepping stone on the path to AGI," with applications including training autonomous vehicles in realistic simulated scenarios.

### 1.3 GameNGen (Google)

GameNGen demonstrated that a **diffusion model can serve as a real-time game engine**, achieving the first neural model capable of interactive simulation over long trajectories at high quality.

**Architecture:** GameNGen adapts Stable Diffusion v1.4, replacing text conditioning with action embeddings (via cross-attention) and previous frames (concatenated in latent channels). It uses velocity parameterization with a U-Net denoiser at 320x256 resolution.

**Two-phase training:**
1. **RL agent phase:** A PPO-based agent trains for 50M environment steps on DOOM, generating a 70M-example dataset of gameplay trajectories
2. **Diffusion model phase:** The generative model trains on these trajectories for 700K steps on 128 TPU-v5e devices

**Critical innovation -- Noise Augmentation:** To address autoregressive drift (quality degradation when conditioning on the model's own predictions), variable Gaussian noise is added to encoded context frames during training. This allows the network to correct accumulated errors, maintaining stability beyond the 20-30 frame threshold that would otherwise cause degradation.

**Results:**
- 20 FPS on a single TPU-v5 (50 FPS with distillation)
- PSNR of 29.43 (comparable to JPEG quality 20-30)
- Human raters achieve only 58-60% accuracy distinguishing simulation from real gameplay in 3.2-second clips
- Surprisingly, only 4 DDIM sampling steps achieve quality comparable to 20+ steps due to strong conditioning from previous frames

### 1.4 World Labs (Fei-Fei Li)

World Labs, founded by Fei-Fei Li along with Justin Johnson, Christoph Lassner, and Ben Mildenhall, focuses on **spatial intelligence** -- building frontier models that can perceive, generate, and interact with the 3D world.

Their flagship product **Marble** is described as the first world model that can be prompted by multimodal inputs (text, images, videos, coarse 3D layouts, panoramas) to generate and maintain consistent 3D environments for exploration and interaction. Unlike purely video-based approaches, Marble generates fully editable, downloadable 3D environments -- interior spaces and expansive exteriors -- that users can navigate freely.

World Labs commercially launched Marble in November 2025. The company raised $230M in funding, reflecting the high stakes placed on spatial intelligence as a distinct paradigm from flat video generation.

### 1.5 Runway, Pika, and Commercial Video Generators

The commercial video generation landscape has evolved from creative tools toward world simulation:

- **Runway** released **GWM-1 (General World Model 1)** in December 2025, marking their first public step into world simulation with "dynamic simulation environments" that understand not just appearance but how things evolve over time. Their Gen-4.5 model hit #1 on Video Arena, with improvements in physical accuracy stemming from world model research. Runway gave early access to Ubisoft, indicating the gaming industry's interest in neural world simulation.

- **Pika** has focused more on creative effects (Pikaffects) and accessibility, though its underlying video generation capabilities share the same foundation of learned dynamics and physics. Pika 2.5 emphasizes the balance between creative control and physical plausibility.

- **Disney invested $1B with OpenAI** for Sora integration, and the broader entertainment industry is treating video generation models as proto-simulators for content creation, previsualization, and interactive experiences.

The trajectory is clear: commercial video generators are converging with world simulation research. The shift from "make a pretty video" to "simulate how the world works" is the defining transition of 2024-2025.

---

## 2. Diffusion-Based World Models for Driving

The autonomous driving community has been among the earliest and most active adopters of diffusion-based world models. The core motivation is **scalable data generation**: real-world driving data is expensive to collect, annotate, and maintain, and rare safety-critical scenarios are by definition underrepresented. Generative models promise to synthesize diverse, annotated training data at scale while also serving as neural simulators for closed-loop testing.

### 2.1 MagicDrive / MagicDrive3D / MagicDrive-V2

The MagicDrive family represents one of the most complete progressions from controllable image generation to high-resolution long video synthesis for driving.

**MagicDrive** (ICLR 2024) generates high-quality street-view images with diverse 3D geometry controls including camera poses, road maps, and 3D bounding boxes, together with textual descriptions. It produces multi-view images with strong cross-view consistency, usable as a data engine for perception tasks (3D detection, BEV segmentation).

**MagicDrive3D** inverts the typical pipeline: rather than reconstructing 3D before training a generative model, it first trains a video generation model and then reconstructs from generated data, enabling easily controllable generation with high-quality 3D scene reconstruction.

**MagicDrive-V2** (ICCV 2025) is built on the **DiT (Diffusion Transformer)** architecture with a 3D VAE for spatial-temporal compression. Key innovations include:
- **STDiT-3 blocks** enhanced with a Multi-View DiT (MVDiT) block for cross-view consistency
- **Spatial-temporal conditional encoding** that addresses misalignment between frame-level geometric controls and compressed latents, using downsampling modules with temporal transformers and RoPE
- Two-branch conditioning supporting both cross-attention and additive control pathways
- **Resolution:** 848x1600 pixels (3.3x improvement over prior work)
- **Duration:** Up to 241 frames at lower resolution, with extrapolation beyond training configurations
- **Results:** FVD of 94.84 (vs. 210.40 for prior methods), mAP of 18.17 and mIoU of 20.40 on nuScenes
- **Progressive training:** Low-resolution images -> high-resolution short videos -> long videos with mixed-resolution and mixed-length data

### 2.2 DrivingDiffusion

DrivingDiffusion (ECCV 2024) was the **first multi-view driving scene video generator** using diffusion models. It addresses three fundamental challenges: cross-view consistency, cross-frame (temporal) consistency, and instance quality.

The method uses a cascaded approach:
1. Multi-view single-frame image generation
2. Single-view video generation (shared across cameras)
3. Post-processing for long video generation

This cascaded design decomposes the joint multi-view video problem into manageable sub-problems, with layout guidance from 3D bounding boxes providing structural control.

### 2.3 Panacea / Panacea+

**Panacea** (CVPR 2024) generates panoramic and controllable videos for autonomous driving, addressing both consistency (temporal and cross-view coherence) and controllability (alignment with annotations).

**Key architecture:** A decomposed **4D attention module** comprising:
- **Intra-view attention** for spatial processing within individual views
- **Cross-view attention** for engagement with adjacent views
- **Cross-frame attention** for temporal processing

Text prompts are processed through a frozen CLIP encoder, while BEV sequences are handled via ControlNet. A two-stage generation pipeline maintains coherence.

**Panacea+** enhances this with multi-view appearance noise prior for improved consistency and a super-resolution module for higher-resolution synthesis.

### 2.4 BEVGen / BEVControl

**BEVGen** pioneered the generation of multi-view urban scene images from BEV layouts using VQ-VAE. While effective for single-frame multi-view generation conditioned on road and vehicle layouts, it lacked proper handling of 3D geometric information.

**BEVControl** addressed this limitation by introducing:
- A **height-lifting module** to partially restore scene geometry
- A diffusion model with **cross-view attention** mechanisms for spatial coherence across neighboring camera views
- Capability to generate synthetic validation sets for training perception models

### 2.5 WoVoGen

**WoVoGen** (ECCV 2024) introduces a **4D world volume** as a foundational element for multi-camera driving video generation. The system operates in two phases:
1. **Envisioning** the future 4D temporal world volume based on vehicle control sequences
2. **Generating** multi-camera videos informed by this 4D volume and sensor interconnectivity

The 4D world volume ensures both intra-world consistency and inter-sensor coherence -- two of the hardest challenges in multi-camera generation. WoVoGen also supports scene editing tasks, including weather and location modification via text prompts.

### 2.6 SubjectDrive

**SubjectDrive** is the first model proven to scale generative data production in a way that continuously improves autonomous driving applications. It addresses a unique challenge: generating driving videos featuring specific reference subjects (particular vehicle models, pedestrians, etc.).

The architecture uses three innovative modules:
- **Subject prompt adapter:** Integrates subject control with text-conditioned branches
- **Subject visual adapter:** Directly utilizes visual features within the diffusion U-Net
- **Augmented temporal attention:** Ensures consistent feature injection over time

Given a reference subject image, SubjectDrive generates layout-aligned driving videos featuring the desired subject, using a two-stage strategy (image generation followed by video generation).

### 2.7 Drive-WM ("Driving into the Future")

**Drive-WM** (CVPR 2024) is the **first driving world model compatible with existing end-to-end planning models**. Its key innovation is joint spatial-temporal modeling via view factorization:
- Inspired by latent video diffusion models, it introduces multiview and temporal modeling for jointly generating multiple views and frames
- To enhance multiview consistency, it predicts intermediate views conditioned on adjacent views
- Enables "driving into multiple futures" based on distinct driving maneuvers
- Determines optimal trajectories according to image-based rewards

### 2.8 Vista

**Vista** (NeurIPS 2024) represents a state-of-the-art generalizable driving world model, built upon Stable Video Diffusion (SVD).

**Training pipeline:**
1. **Phase 1 -- High-fidelity prediction:** Conditions on initial frame, trained on 1,740 hours of driving video at 576x1024 resolution, 10 Hz
2. **Phase 2 -- Action controllability:** Uses LoRA adapters at lower resolution (320x576) for efficiency, trained on combined OpenDV-YouTube and nuScenes data

**Action conditioning (four modalities):**
1. Steering angle and speed (fine-grained low-level control)
2. Trajectory (2D displacements in ego coordinates)
3. Commands (high-level: forward, turn left/right, stop)
4. Goal points (interactive 2D destination specifications)

All encoded via unified Fourier embeddings and injected through cross-attention layers.

**Novel loss functions:**
- **Dynamics Enhancement Loss:** Identifies motion discrepancies and applies adaptive weighting to focus learning on dynamic areas (moving vehicles, roadsides)
- **Structure Preservation Loss:** Operates in frequency domain using FFT to preserve edges and textures in high-frequency components

**Latent replacement for long-horizon coherence:** Rather than channel-wise concatenation, Vista replaces noisy latents with clean encoded frames providing position, velocity, and acceleration priors.

**Results:** FID 6.9 (vs. GenAD's 15.4), FVD 89.4 (vs. GenAD's 184.0). Outperforms best driving world model by 55% in FID and 27% in FVD. Supports 15-second high-resolution prediction without significant degradation.

**Generalization reward:** Vista's prediction uncertainty serves as an action reward without external detectors, enabling cross-dataset evaluation on unseen domains like Waymo.

### 2.9 DriveDreamer / DriveDreamer-2

**DriveDreamer** (ECCV 2024) is a world model entirely derived from real-world driving scenarios, harnessing diffusion models for comprehensive environment representation. It supports controllable generation aligned with text prompts and structured traffic constraints, and can predict different future videos based on input driving actions.

**DriveDreamer-2** (AAAI 2025) is the **first world model to generate customized driving videos** including uncommon scenarios (e.g., vehicles abruptly cutting in). It integrates an LLM to convert user queries into agent trajectories, generates HD maps adhering to traffic regulations, and uses a Unified Multi-View Model for temporal and spatial coherence. Results: FID 11.2, FVD 55.7 (relative improvements of 30% and 50% over prior SOTA).

### 2.10 OccSora

**OccSora** takes a fundamentally different approach: instead of generating camera images, it generates **4D occupancy** -- a volumetric representation of the 3D world evolving over time.

**Architecture:**
- **4D Scene Tokenizer:** Compresses 4D occupancy data using 3D downsampling and vector quantization with a learned codebook (8x compression in temporal and spatial dimensions)
- **Diffusion Transformer:** Generates 4D occupancy from noise, conditioned on ego vehicle trajectories via MLP-encoded embeddings

Unlike autoregressive frameworks (e.g., OccWorld), OccSora generates entire 4D sequences simultaneously, enabling "unified learning of both spatial and temporal evolution patterns" without requiring historical context. It generates 16-second sequences with authentic 3D layout and trajectory-consistent motion, achieving FID of 8.348.

### 2.11 DriveScape and DriveGen3D (2025)

**DriveScape** (CVPR 2025) is an end-to-end framework for multi-view, 3D condition-guided video generation at 1024x576 resolution at 10Hz. Built on the LDM framework, it conditions on scene annotations, BEV maps, and 3D bounding boxes, achieving FID 8.34 and FVD 76.39 on nuScenes.

**DriveGen3D** introduces a unified pipeline with FastDrive-DiT (efficient video diffusion transformer) and FastRecon3D (feed-forward 3D Gaussian reconstruction), enabling real-time generation of extended driving videos at 424x800 at 12 FPS with 80% faster generation than optimization-based baselines.

### 2.12 Epona (ICCV 2025)

**Epona** is an autoregressive diffusion world model that addresses a key limitation of prior work: the inability to generate flexible-length, long-horizon predictions while integrating trajectory planning. Its key innovations:
- **Decoupled spatiotemporal factorization:** Separates temporal dynamics modeling from fine-grained future world generation
- **Modular trajectory and video prediction:** Seamlessly integrates motion planning with visual modeling end-to-end
- Generates consistent **minute-long** driving videos without noticeable drift
- Achieves 7.4% FVD improvement over prior work and serves as a real-time motion planner outperforming strong end-to-end planners on NAVSIM

### 2.13 DriveLaW (Late 2025)

**DriveLaW** unifies video generation and motion planning by directly injecting latent representations from its video generator into a diffusion-based trajectory planner:
- **DriveLaW-Video:** World model with a novel noise reinjection mechanism to resolve structural inconsistencies and blurring in high-speed scenarios
- **DriveLaW-Act:** Diffusion planner conditioned on video latents
- Surpasses prior work by 33.3% in FID and 1.8% in FVD, and achieves a new record on the NAVSIM planning benchmark

---

## 3. Autoregressive World Models

While diffusion models dominate recent driving world model research, autoregressive approaches -- predicting the next token or frame in sequence -- offer complementary strengths, particularly for action-conditioned generation and long-horizon sequential decision-making.

### 3.1 GAIA-1 (Wayve)

**GAIA-1** (September 2023) was a landmark: the **first generative world model designed specifically for self-driving systems**. It reframes world modeling as unsupervised sequence modeling by mapping video, text, and action inputs to discrete tokens and predicting the next token autoregressively.

**Architecture:** An autoregressive transformer that predicts the next set of image tokens considering past image tokens plus contextual information from text and action tokens. The approach uses a VQ-VAE-style tokenizer for visual data.

**Scale:** 9 billion parameters, trained on ~4,700 hours of UK driving data from Wayve's corpus.

**Key capabilities:**
- Learns to disentangle driving concepts: cars, trucks, pedestrians, cyclists, road layouts, buildings, traffic lights
- Offers fine-grained control over ego-vehicle behavior and scene features
- Can serve as a neural simulator for generating unlimited training and validation data

**Limitations:** Computationally intensive for long video generation; primarily single-camera outputs; limited geographic diversity (UK only).

### 3.2 GAIA-2 (Wayve, March 2025)

**GAIA-2** represents a major architectural departure from GAIA-1, switching from discrete autoregressive tokens to a **latent diffusion framework** with flow matching training.

**Architecture:** An 8.4B-parameter space-time factorized transformer operating on continuous latent representations. The video tokenizer achieves ~400x compression (8x temporal, 32x spatial downsampling with 64-channel latents), yielding "fewer but semantically richer latent tokens" than typical LDMs.

**Seven conditioning pathways:**
1. Ego-vehicle dynamics (speed, curvature via symmetric log transform)
2. Dynamic agents (3D bounding boxes with feature/instance dropout)
3. Scene metadata (country, weather, time, lane types, traffic signals)
4. Camera parameters (intrinsics, extrinsics, distortion)
5. Video frequency (sinusoidal timestamp encoding)
6. CLIP embeddings (natural language scene control)
7. Scenario embeddings (proprietary driving model context)

**Multi-view generation:** Up to five temporally and spatially consistent camera streams at 448x960 resolution, with separate embeddings for intrinsics, extrinsics, and distortion enabling adaptation to various vehicle platforms.

**Training scale:** ~25 million two-second sequences from 2019-2024 across UK, US, and Germany. 300K tokenizer steps (128 H100 GPUs) + 460K world model steps (256 H100 GPUs).

**Four inference modes:** Generation from scratch, autoregressive prediction (sliding windows), spatial inpainting, and scene editing (partial noising + conditional denoising).

**GAIA-3** was subsequently launched by Wayve, advancing world models from simulation toward direct evaluation of driving systems.

### 3.3 Copilot4D (Waabi)

**Copilot4D** (ICLR 2024) takes a unique approach: rather than generating camera images, it predicts future **LiDAR point clouds** using discrete diffusion.

**Architecture:**
- **VQVAE Tokenizer:** Encodes point clouds into discrete BEV tokens via PointNet aggregation and Swin Transformer backbone. The decoder uses **differentiable depth rendering with implicit neural representations** to reconstruct point clouds from latent codes.
- **Discrete Diffusion World Model:** A spatio-temporal Transformer interleaving spatial (Swin Transformer) and temporal (GPT-2 blocks) attention on discrete token indices.

**Key innovation:** Reframes MaskGIT as discrete diffusion by adding uniform noise injection to non-masked tokens during training and allowing iterative refinement of previously decoded tokens during inference.

**Results:** Reduces prior SOTA Chamfer distance by **65-82% for 1s prediction** and **50-72% for 3s prediction** across NuScenes, KITTI, and Argoverse2. On NuScenes 3s: Chamfer distance of 0.58 vs. prior SOTA of 1.40. Classifier-free diffusion guidance alone reduces Chamfer distance by 60%.

### 3.4 WorldDreamer

**WorldDreamer** (January 2024) frames world modeling as unsupervised visual sequence modeling by mapping visual inputs to discrete tokens (via VQGAN) and predicting masked tokens. It uses a **Spatial Temporal Patchwise Transformer (STPT)** that enables attention within localized patches across temporal-spatial windows.

WorldDreamer excels across multiple scenarios (natural scenes, driving environments) and tasks (image-to-video, text-to-video, video inpainting, stylization, action-to-video generation).

### 3.5 OccWorld

**OccWorld** (ECCV 2024) models joint evolutions of 3D scenes and ego movements in the **3D occupancy space**. It jointly predicts ego car movement and surrounding scene evolution, combining self-supervised learning with machine-annotated 3D occupancy. This offers a path to scalable training for interpretable end-to-end driving models.

### 3.6 Token-Based Approaches and Embodied AI

The VQ-VAE tokenization paradigm -- encoding observations into discrete tokens for autoregressive prediction -- has become foundational across both driving and embodied AI:

- **DALL-E and its descendants** use VQ-VAE to translate visual inputs to condensed token spaces, then train GPT modules on next-token prediction
- **VQ-VLA** frameworks train action tokenizers using VQ-VAE for robotic manipulation, with progressive training from real-world to simulated datasets
- **LAPA** leverages VQ-VAE quantized latent actions to pre-train on large-scale video-language pairs, transferring from human videos to robot actions
- In driving, this paradigm underpins GAIA-1, Copilot4D, WorldDreamer, and others, with the key insight that discrete token spaces enable the proven machinery of language model training to be applied to multimodal world modeling

---

## 4. Controllability and Closed-Loop Simulation

The gap between "generating realistic driving videos" and "building a usable driving simulator" is fundamentally about **controllability** -- the ability to condition generation on specific actions, layouts, and scenarios -- and **closed-loop interaction** -- the ability to use the simulator reactively within a planning loop.

### 4.1 Action-Conditioned Generation

For a world model to be useful for driving, it must respond faithfully to ego-vehicle control inputs. Current approaches to action conditioning include:

**Low-level controls:**
- Steering angle and speed (Vista, GAIA-1/2)
- Ego trajectories as 2D displacement sequences (most recent methods)
- Curvature and velocity profiles (GAIA-2)

**High-level controls:**
- Text commands: "turn left," "change lane" (DriveDreamer-2, Vista)
- Goal points: 2D destination coordinates (Vista)
- LLM-generated scenarios: Natural language -> agent trajectories -> HD maps (DriveDreamer-2)

**Structural controls:**
- 3D bounding boxes for agent placement (MagicDrive, GAIA-2)
- BEV road maps and lane markings (Panacea, WoVoGen, DriveScape)
- Camera intrinsics/extrinsics for multi-platform compatibility (GAIA-2)
- Scene metadata: weather, time of day, geographic location (GAIA-2, WoVoGen)

**Key challenge -- Action fidelity:** The ACT-Bench benchmark (2024) revealed that even state-of-the-art models poorly follow action instructions. Vista achieved only a **30.72% match rate** between instructed and executed actions. The baseline Terra model improved to 44.11% but still fell far short of reliable control. The benchmark also identified "causal misalignment" where ego-vehicle actions inadvertently influenced other agents -- a critical limitation for simulation reliability.

### 4.2 Closed-Loop vs. Open-Loop Evaluation

**Open-loop evaluation** compares generated outputs against ground truth on held-out trajectories without interaction. It is simple and scalable but fundamentally limited: it cannot capture the compounding effects of errors or the quality of reactive decision-making.

**Closed-loop evaluation** feeds the driving agent's planned actions back into the simulator, generating the next observation based on the agent's decisions. This reveals failure modes invisible to open-loop testing: drifting off-road over time, failing to respond to emergent situations, and compounding prediction errors.

**DriveArena** is the first high-fidelity closed-loop simulation system for driving agents navigating real-world scenarios. It comprises:
- **Traffic Manager:** A traffic simulator generating realistic traffic flow on any global street map
- **World Dreamer:** A high-fidelity conditional generative model with infinite autoregression
- The agent perceives through generated images and outputs trajectories fed back into Traffic Manager, achieving realistic vehicle interactions

**NAVSIM** (NeurIPS 2024) offers a middle ground: a **non-reactive simulation** that bridges open-loop and closed-loop evaluation using large datasets. Agents plan trajectories over a 4-second horizon using initial sensor data. NAVSIM demonstrated substantially stronger correlation with closed-loop scores than traditional displacement errors.

### 4.3 Multi-View Consistency

Autonomous driving requires surround-view perception (typically 6 cameras), making multi-view consistency a critical challenge. The three primary problems are:

1. **Cross-view consistency:** Multi-view images must appear as if captured from the same physical scene. Overlapping fields of view must show the same objects at consistent positions.
2. **Cross-frame (temporal) consistency:** Video frames must be temporally aligned with coherent motion.
3. **Coupled dimensional relationships:** Cross-view and cross-frame consistency are coupled -- decoupled attention methods can fail to maintain appearance across frames due to limited implicit transmission of cross-dimensional associations.

**Approaches to multi-view consistency:**
- **View factorization** (Drive-WM): Predicts intermediate views conditioned on adjacent views
- **4D attention modules** (Panacea): Decomposes attention into intra-view, cross-view, and cross-frame components
- **4D world volumes** (WoVoGen): Uses a volumetric intermediate representation to enforce physical consistency
- **MVDiT blocks** (MagicDrive-V2): Cross-view attention layers within DiT architecture
- **Camera parameter conditioning** (GAIA-2): Separate embeddings for intrinsics, extrinsics, and distortion
- **Holistic 4D attention** (CogDriving): Simultaneously models spatial, temporal, and view dimensions in a single attention mechanism

### 4.4 Temporal Consistency Over Long Horizons

Long-horizon temporal consistency remains one of the hardest open problems:

- **Autoregressive drift:** When models condition on their own predictions, errors compound. GameNGen's noise augmentation during training was a breakthrough in mitigating this.
- **Latent replacement** (Vista): Injecting clean encoded historical frames as priors for coherent long-horizon rollouts
- **Noise reinjection** (DriveLaW): Resolves structural inconsistencies in high-speed scenarios
- **Sliding window autoregression** (GAIA-2): Uses linear-quadratic noise schedules with 50 denoising steps for extended generation
- **Decoupled spatiotemporal factorization** (Epona): Separates temporal dynamics from fine-grained generation, enabling minute-long drift-free videos
- **Progressive training** (MagicDrive-V2): Multi-stage training from images to short videos to long videos builds temporal understanding incrementally

---

## 5. Evaluation Metrics and Benchmarks

### 5.1 Visual Quality Metrics

**FID (Frechet Inception Distance):** Measures distributional similarity between generated and real images using Inception network features. Lower is better. Standard protocol: crop and resize to 256x448 for evaluation. Representative scores on nuScenes:
- Genesis: 4.24 (current SOTA)
- Vista: 6.9
- DriveScape: 8.34
- DriveDreamer-2: 11.2
- GenAD: 15.4

**FVD (Frechet Video Distance):** Extends FID to video by measuring temporal coherence. All frames downsampled to 224x224. Representative scores on nuScenes:
- Genesis: 16.95
- DriveDreamer-2: 55.7
- DriveScape: 76.39
- Vista: 89.4
- MagicDrive-V2: 94.84
- GenAD: 184.0

**Additional visual metrics:**
- **FDD (Frechet DINO Distance):** Used by GAIA-2, measuring distribution distance using DINO features
- **FVMD (Frechet Video Motion Distance):** Compares keypoint motion feature distributions for temporal consistency
- **PSNR / SSIM / LPIPS:** Pixel-level and perceptual similarity metrics (DriveGen3D: SSIM 0.811, PSNR 22.84)

### 5.2 Limitations of Visual Metrics

Classical metrics like FID and FVD measure distributional similarity but are **insensitive to many temporal or physics-driven failures**. A video can achieve excellent FID while violating traffic rules, spawning objects that phase through each other, or placing vehicles on sidewalks. This has driven the development of driving-specific evaluation.

### 5.3 Driving-Specific Metrics

**Controllability metrics:**
- **mAP (mean Average Precision):** Measures whether generated 3D bounding boxes match conditioning inputs (MagicDrive-V2: 18.17 on nuScenes)
- **mIoU (mean Intersection over Union):** Measures semantic segmentation alignment (MagicDrive-V2: 20.40)
- **IEC (Instruction-Execution Consistency):** ACT-Bench metric measuring action fidelity (Vista: 30.72%, Terra: 44.11%)
- **ADE / FDE (Average/Final Displacement Error):** Trajectory alignment between intended and executed paths

**Downstream task metrics:** Many works evaluate whether generated data improves perception training:
- 3D object detection mAP improvement when training with generated data
- BEV segmentation IoU improvement
- Tracking accuracy on generated sequences

### 5.4 Planning-Oriented Metrics

**NAVSIM PDM Score (PDMS):** A composite metric aggregating:
- **No Collisions (NC):** Hard penalty of 0 for collisions; 0.5 for static objects
- **Drivable Area Compliance (DAC):** Penalty of 0 for off-road violations
- **Ego Progress (EP):** Route progress ratio (weight 5)
- **Time-to-Collision (TTC):** Safety margin maintenance (weight 5)
- **Comfort (C):** Acceleration/jerk thresholds (weight 2)

Benchmark scores (navtest split, 12K scenarios):
- Human Expert: 94.8
- TransFuser: 84.0
- UniAD/PARA-Drive: 83.4-84.0
- Constant Velocity: 21.6

A surprising finding: the simpler TransFuser (1 GPU-day training) matched large-scale architectures like PARA-Drive (80 GPUs, 3 days).

**Chamfer Distance:** For point cloud world models (Copilot4D):
- NuScenes 3s prediction: 0.58 (vs. prior SOTA 1.40)
- Reductions of 50-82% across datasets

**Occupancy metrics:**
- **mIoU** for 4D occupancy prediction (OccSora: 27.4% at 32x compression)
- **4D reconstruction quality** for temporal evolution assessment

### 5.5 Benchmarks and Datasets

**Primary driving datasets for world model evaluation:**

| Dataset | Scale | Sensors | Key Use |
|---------|-------|---------|---------|
| **nuScenes** | 1,000 scenes, 1.4M frames | 6 cameras, LiDAR, radar | Standard benchmark for most generation methods |
| **Waymo Open** | 1,000+ scenes | 5 cameras, LiDAR | Cross-dataset generalization testing |
| **KITTI** | 80K frames | Stereo cameras, LiDAR | Point cloud prediction |
| **Argoverse2** | 1,000 scenes | 7 cameras, 2 LiDARs | Large-scale evaluation |
| **nuPlan** | 1,500 hours | Multi-modal | Planning-focused benchmark |
| **CARLA** | Unlimited (synthetic) | Configurable | Closed-loop training and testing |
| **OpenOccupancy / Occ3D** | Derived from nuScenes | Occupancy annotations | 4D occupancy forecasting |

**Specialized benchmarks:**
- **ACT-Bench:** 2,286 samples from nuScenes for action controllability evaluation
- **NAVSIM:** 12K filtered scenarios for planning evaluation with non-reactive simulation
- **OpenDriveLab Challenges (2024, 2025):** Annual competitions covering world models and end-to-end driving

---

## 6. Open Challenges and Future Directions

### 6.1 Physics Fidelity

Current world models learn correlations from data but do not explicitly model physics. This leads to:
- Objects phasing through each other
- Inconsistent shadows and reflections
- Unrealistic vehicle dynamics at high speeds
- Incorrect behavior at complex intersections

Emerging approaches integrate **physics-aware constraints**: Port-Hamiltonian Neural Networks embed energy-based physical constraints into diffusion models, and conditional diffusion models capture multimodal vehicle dynamics distributions.

### 6.2 Long-Tail and Safety-Critical Scenarios

The most valuable scenarios for autonomous driving -- near-misses, adverse weather, unusual road configurations -- are by definition rare in training data. World models must generate these convincingly without having seen many examples. Current approaches include:
- LLM-prompted scenario generation (DriveDreamer-2)
- Structured conditioning on agent trajectories and scene metadata (GAIA-2)
- Classifier-free guidance for rare scenario emphasis

### 6.3 Real-Time Inference

Most current driving world models require seconds to minutes per generated frame, far from the real-time requirements of closed-loop simulation:
- DiffusionDrive addresses this with truncated diffusion for end-to-end driving
- Model distillation (GameNGen: 20 FPS -> 50 FPS with distillation)
- Efficient architectures (DriveGen3D: 80% faster than optimization-based methods)
- Sparse attention and token compression

### 6.4 Unified Multi-Modal Representations

Current methods typically operate on a single modality (camera images, point clouds, or occupancy grids). The frontier is unified representations that fuse camera, LiDAR, radar, and HD-maps into coherent latent spaces, enabling generation and prediction across all sensor modalities simultaneously.

### 6.5 Bridging Generation and Planning

The most promising direction is **direct integration of world models with planning**, as demonstrated by:
- **DriveLaW:** Injecting video latents directly into a diffusion planner
- **Epona:** Modular trajectory and video prediction in an end-to-end framework
- **GenAD:** Generative end-to-end driving with structural latent spaces
- **Vista:** Using prediction uncertainty as a planning reward

This convergence suggests that world models and driving policies will increasingly be trained jointly, rather than as separate components.

### 6.6 Scaling Laws

The field is still in early stages of understanding scaling laws for world models. Key open questions:
- Does performance improve smoothly with model size, data volume, and compute?
- What is the relationship between visual quality metrics and downstream driving performance?
- How much real data is needed before synthetic data becomes the dominant training signal?

GAIA-2's training on 25M sequences across 256 H100 GPUs represents current scale, but this is likely early on the scaling curve.

---

## Summary Table: Key Models at a Glance

| Model | Type | Year/Venue | Representation | Multi-View | Action Control | Key Metric |
|-------|------|------------|----------------|------------|----------------|------------|
| **Sora / Sora 2** | Diffusion Transformer | 2024-25 | Video latents | No | Text | General world sim |
| **Genie 2/3** | AR Latent Diffusion | 2024-25 | Video latents | No | Keyboard/mouse | Interactive 24fps |
| **GameNGen** | Adapted SD 1.4 | 2024 | Game frames | No | Game actions | PSNR 29.43 |
| **GAIA-1** | Autoregressive | 2023 | Discrete tokens | No | Action+text | 9B params |
| **GAIA-2** | Latent Diffusion | 2025 | Continuous latents | 5 cameras | 7 pathways | 8.4B params |
| **MagicDrive-V2** | DiT + 3D VAE | 2025/ICCV | Video latents | 6 cameras | 3D boxes, BEV | FVD 94.84 |
| **Vista** | SVD-based LDM | 2024/NeurIPS | Video latents | Single | 4 modalities | FID 6.9 |
| **Copilot4D** | Discrete Diffusion | 2024/ICLR | Point cloud tokens | BEV | Ego trajectory | CD 0.58 (3s) |
| **DriveDreamer-2** | Diffusion + LLM | 2025/AAAI | Video latents | Multi-view | LLM-generated | FVD 55.7 |
| **OccSora** | Diffusion Transformer | 2024 | 4D Occupancy | Volumetric | Trajectory | FID 8.348 |
| **Panacea/+** | Diffusion + ControlNet | 2024/CVPR | Video latents | Panoramic | BEV + text | Panoramic |
| **WoVoGen** | Diffusion | 2024/ECCV | 4D World Volume | Multi-camera | Vehicle control | Scene editing |
| **DriveScape** | LDM | 2025/CVPR | Video latents | Multi-view | BEV + 3D boxes | FID 8.34 |
| **Epona** | AR + Diffusion | 2025/ICCV | Video latents | Single | Trajectory | Minute-long |
| **DriveLaW** | Diffusion (unified) | 2025 | Video latents | Multi-view | Trajectory | NAVSIM SOTA |

---

## Sources

- [Video generation models as world simulators - OpenAI](https://openai.com/index/video-generation-models-as-world-simulators/)
- [Sora 2 - OpenAI](https://openai.com/index/sora-2/)
- [Is Sora a World Simulator? - arXiv Survey](https://arxiv.org/html/2405.03520v1)
- [Genie 2: A large-scale foundation world model - Google DeepMind](https://deepmind.google/blog/genie-2-a-large-scale-foundation-world-model/)
- [Genie 3: A new frontier for world models - Google DeepMind](https://deepmind.google/blog/genie-3-a-new-frontier-for-world-models/)
- [GameNGen: Diffusion Models Are Real-Time Game Engines - arXiv](https://arxiv.org/abs/2408.14837)
- [World Labs](https://www.worldlabs.ai/)
- [Fei-Fei Li: From Words to Worlds](https://drfeifei.substack.com/p/from-words-to-worlds-spatial-intelligence)
- [World Labs launches Marble - TechCrunch](https://techcrunch.com/2025/11/12/fei-fei-lis-world-labs-speeds-up-the-world-model-race-with-marble-its-first-commercial-product/)
- [Runway GWM-1 and Gen-4.5](https://runwayml.com/)
- [MagicDrive - ICLR 2024](https://github.com/cure-lab/MagicDrive)
- [MagicDrive-V2 - ICCV 2025](https://arxiv.org/abs/2411.13807)
- [DrivingDiffusion - ECCV 2024](https://arxiv.org/abs/2310.07771)
- [Panacea - CVPR 2024](https://arxiv.org/abs/2311.16813)
- [Panacea+ - arXiv](https://arxiv.org/html/2408.07605v1)
- [WoVoGen - ECCV 2024](https://arxiv.org/abs/2312.02934)
- [SubjectDrive](https://subjectdrive.github.io/)
- [Drive-WM: Driving into the Future - CVPR 2024](https://arxiv.org/abs/2311.17918)
- [Vista - NeurIPS 2024](https://arxiv.org/abs/2405.17398)
- [DriveDreamer - ECCV 2024](https://drivedreamer.github.io/)
- [DriveDreamer-2 - AAAI 2025](https://arxiv.org/abs/2403.06845)
- [GenAD - ECCV 2024](https://arxiv.org/abs/2402.11502)
- [OccSora - arXiv](https://arxiv.org/abs/2405.20337)
- [OccWorld - ECCV 2024](https://github.com/wzzheng/OccWorld)
- [DriveScape - CVPR 2025](https://metadrivescape.github.io/papers_project/drivescapev1/index.html)
- [DriveGen3D - arXiv](https://arxiv.org/abs/2510.15264)
- [Epona - ICCV 2025](https://arxiv.org/abs/2506.24113)
- [DriveLaW - arXiv](https://arxiv.org/abs/2512.23421)
- [GAIA-1 - Wayve](https://wayve.ai/thinking/introducing-gaia1/)
- [GAIA-2 - Wayve](https://arxiv.org/abs/2503.20523)
- [GAIA-3 - Wayve](https://wayve.ai/press/wayve-launches-gaia3/)
- [Copilot4D - ICLR 2024](https://arxiv.org/abs/2311.01017)
- [WorldDreamer - arXiv](https://arxiv.org/abs/2401.09985)
- [UniSim - Waabi](https://waabi.ai/insights/introducing-unisim-one-of-the-core-groundbreaking-technologies-powering-waabi-world)
- [DriveArena - ICCV 2025](https://arxiv.org/abs/2408.00415)
- [NAVSIM - NeurIPS 2024](https://arxiv.org/abs/2406.15349)
- [ACT-Bench](https://arxiv.org/abs/2412.05337)
- [A Survey of World Models for Autonomous Driving](https://arxiv.org/abs/2501.11260)
- [The Role of World Models in Shaping Autonomous Driving - Survey](https://arxiv.org/pdf/2502.10498)
- [BEVGen / BEVControl](https://arxiv.org/html/2407.06109)
- [Open-Sora 2.0](https://arxiv.org/html/2503.09642v1)
