# Open-Source World Model Implementations for Driving

**Research Date:** 2026-03-22
**Purpose:** Evaluate every usable open-source world model implementation for autonomous driving research

---

## Table of Contents

1. [Recommendation Matrix](#recommendation-matrix)
2. [Tier 1: Production-Ready Research Tools](#tier-1-production-ready-research-tools)
3. [Tier 2: Usable with Effort](#tier-2-usable-with-effort)
4. [Tier 3: Partial Code / Inference Only](#tier-3-partial-code--inference-only)
5. [Tier 4: Paper-Only / Broken Code](#tier-4-paper-only--broken-code)
6. [Detailed Evaluations](#detailed-evaluations)
7. [Dependency Compatibility Matrix](#dependency-compatibility-matrix)

---

## Recommendation Matrix

### Actually Usable for Research Today

| Repo | Usability | Training Code | Pretrained Weights | Active Maint. | Best For |
|------|-----------|---------------|-------------------|---------------|----------|
| **NVIDIA Cosmos** | YES | YES | YES | YES | General world foundation model, fine-tuning for AV |
| **OpenDWM** | YES | YES | YES | YES | Multi-view driving video generation, LiDAR generation |
| **CarDreamer** | YES | YES | YES | YES | RL-based driving in CARLA with world models |
| **DIAMOND** | YES | YES | YES | YES | Diffusion world model RL (Atari/CSGO, adaptable) |
| **DiffusionDrive** | YES | YES | YES | YES | Real-time end-to-end planning with diffusion |
| **MagicDrive** | YES | YES | YES | Moderate | Street-view image/video generation with 3D control |
| **Epona** | YES | YES | YES | YES | Autoregressive diffusion, video gen + planning |
| **Vista** | YES | YES | YES | Low | Generalizable driving video prediction |
| **OccWorld** | YES | YES | YES | Low | 3D occupancy world modeling |
| **Panacea** | YES | Partial | YES | Low | Panoramic multi-view video generation |
| **comma.ai commaVQ** | Partial | Partial | YES | YES | Tokenized driving video prediction |
| **NVIDIA Alpamayo** | YES | Inference only | YES | YES | VLA reasoning + trajectory prediction |

### Paper-Only or Broken/Incomplete Code

| Repo | Status | Notes |
|------|--------|-------|
| **DrivingGPT** | NO CODE RELEASED | Project page only, no GitHub repo |
| **Copilot4D** | NO CODE RELEASED | Waabi proprietary, paper only |
| **WorldDreamer** | PLACEHOLDER REPO | Repo initialized but no code |
| **Drive-WM** | INCOMPLETE | Weights "coming soon" since 2023, training code missing |
| **Think2Drive** | NO CODE | Only landing page; Bench2Drive has student models only |
| **GenAD** | PAPER REPO | DriveAGI repo is paper/dataset hub, not runnable GenAD code |
| **DriveDreamer** | PARTIAL | Code structure exists but sparse docs, unclear weight availability |
| **DriveDreamer-2** | PARTIAL | Inference code + weights released Dec 2024, no training code |
| **DrivingWorld** | INFERENCE ONLY | Inference code released, training code not available |

---

## Tier 1: Production-Ready Research Tools

These repos have working training code, pretrained weights, clear documentation, and active maintenance.

### 1. NVIDIA Cosmos (Predict 2 / 2.5)

| Field | Details |
|-------|---------|
| **GitHub URL** | https://github.com/nvidia-cosmos/cosmos-predict2.5 (latest) / https://github.com/nvidia-cosmos/cosmos-predict2 (archived) |
| **Stars** | ~971 (Predict2.5) / ~756 (Predict2) |
| **Last Commit** | 2026-02-24 (Predict2.5) |
| **License** | Apache 2.0 (code); NVIDIA Open Model License (weights) |
| **Dependencies** | Python 3.10, PyTorch 2.6.0, CUDA 12.6, Ampere+ GPUs (RTX 30xx/A100+) |
| **Supported Datasets** | General video, AV-specific multiview post-training, robotics datasets (Bridge, RoboCasa, Libero) |
| **Pretrained Weights** | YES - Extensive: 0.6B, 2B, 14B parameter variants on HuggingFace, including AV-specific and action-conditioned versions |
| **Ease of Setup** | 4/5 - pip install via PyPI, Docker support, conda/uv environments |
| **Documentation** | 5/5 - Comprehensive: setup, inference, post-training, distillation, troubleshooting, Cosmos Cookbook |
| **Known Issues** | Predict2 archived Dec 2025; must use Predict2.5. Large model sizes require significant VRAM. |

**Verdict:** The most comprehensive open-source world foundation model. Cosmos-Predict2.5 unifies Text2World, Image2World, and Video2World. Has AV-specific post-trained variants. Best starting point for fine-tuning a general world model to driving domains. LoRA post-training and DMD2 distillation supported.

---

### 2. OpenDWM (SenseTime)

| Field | Details |
|-------|---------|
| **GitHub URL** | https://github.com/SenseTime-FVG/OpenDWM |
| **Stars** | 382 |
| **Last Commit** | 2025-01-15 |
| **License** | MIT |
| **Dependencies** | Python >=3.9, PyTorch >=2.5 (tested 2.5.1), Git >=2.25, CUDA-capable GPU |
| **Supported Datasets** | nuScenes, Waymo, Argoverse, KITTI-360, CARLA |
| **Pretrained Weights** | YES - Extensive model zoo: SD 2.1/3.0/3.5 variants, LiDAR VQVAE/VAE/MaskGIT/DiT models, CogVideoX VAE |
| **Ease of Setup** | 4/5 - Standard pip install, git submodules, clear requirements.txt |
| **Documentation** | 4/5 - Comprehensive guides for datasets, training, evaluation (FID/FVD), interactive generation |
| **Known Issues** | 38 open / 0 closed issues - mostly config questions and dataset generation scripts. 32GB GPU minimum for short video; 80GB for long sequences. |

**Verdict:** Best open-source toolkit specifically designed for driving world models. Supports the widest range of driving datasets. MIT license is ideal. Active development with CogVideoX VAE integration (May 2025). The multi-dataset support (nuScenes + Waymo + Argoverse + KITTI-360) is unmatched. Highly recommended for driving video generation research.

---

### 3. CarDreamer

| Field | Details |
|-------|---------|
| **GitHub URL** | https://github.com/ucd-dare/CarDreamer |
| **Stars** | 326 |
| **Last Commit** | Active (2024-2025) |
| **License** | MIT (per repo structure) |
| **Dependencies** | Python 3.10, CARLA 0.9.15, DreamerV2/V3 (separate install), 10-20GB GPU VRAM |
| **Supported Datasets** | CARLA simulator (real-time generation, not static datasets) |
| **Pretrained Weights** | YES - All task checkpoints on HuggingFace (ucd-dare/CarDreamer) |
| **Ease of Setup** | 3/5 - Requires CARLA installation which is finicky; uses Flit package manager |
| **Documentation** | 5/5 - Full ReadTheDocs, API docs, customization guides, web-based visualization |
| **Known Issues** | Only 2 open issues. CARLA dependency is the main friction point. |

**Verdict:** Best platform for RL-based world model driving research. First open-source platform specifically for WM-based autonomous driving with CARLA integration. Built-in DreamerV2/V3 support. Multi-modal observations (BEV, camera, LiDAR). The agent learns to drive from scratch in a "dream world." Excellent for sim-to-real research pipelines.

---

### 4. DIAMOND

| Field | Details |
|-------|---------|
| **GitHub URL** | https://github.com/eloialonso/diamond |
| **Stars** | 2,000 |
| **Last Commit** | 2024-10-13 |
| **License** | MIT |
| **Dependencies** | Python 3.10, PyTorch (via requirements.txt), k-diffusion, HuggingFace Hub |
| **Supported Datasets** | Atari 100k (26 games), CS:GO (separate branch) |
| **Pretrained Weights** | YES - via HuggingFace Hub, one-command download |
| **Ease of Setup** | 5/5 - conda create + pip install, single command to play pretrained models |
| **Documentation** | 5/5 - Quick start, Hydra config guide, visualization controls, Discord community |
| **Known Issues** | Only 5 open issues. Not driving-specific but architecture is transferable. |

**Verdict:** Not a driving world model per se, but the highest-quality diffusion world model codebase available. NeurIPS 2024 Spotlight. The architecture (2D U-Net with action conditioning) is directly adaptable to driving. Cleanest codebase of all repos evaluated. If you want to build a custom diffusion world model for driving, start from DIAMOND's architecture.

---

### 5. DiffusionDrive

| Field | Details |
|-------|---------|
| **GitHub URL** | https://github.com/hustvl/DiffusionDrive |
| **Stars** | 1,300 |
| **Last Commit** | 2025 (active) |
| **License** | MIT |
| **Dependencies** | PyTorch (standard DL stack), environment.yml + requirements.txt provided |
| **Supported Datasets** | NAVSIM (primary), nuScenes (separate branch `nusc`) |
| **Pretrained Weights** | YES - ResNet-34 (60M params, 88.1 PDMS) and ResNet-50 variants on HuggingFace |
| **Ease of Setup** | 3/5 - Requires NAVSIM environment setup which adds complexity |
| **Documentation** | 4/5 - install.md, train_eval.md, qualitative results, video demos |
| **Known Issues** | 28 open / 0 closed issues. PyTorch compatibility issues (torch.xpu), assertion errors, some users report config confusion with NAVSIM. |

**Verdict:** State-of-the-art for real-time end-to-end planning with diffusion. 88.1 PDMS on NAVSIM at 45 FPS. CVPR 2025 Highlight. Not a "world model" in the generative sense but uses truncated diffusion for planning. DiffusionDriveV2 achieves 91.2 PDMS. Excellent for planning research, less relevant for future prediction/simulation.

---

### 6. Epona

| Field | Details |
|-------|---------|
| **GitHub URL** | https://github.com/Kevin-thu/Epona |
| **Stars** | 312 |
| **Last Commit** | 2025-06-26 |
| **License** | MIT |
| **Dependencies** | Python 3.10, PyTorch >=2.1.0+cu121, TorchVision >=0.16.0+cu121, CUDA 12.1 |
| **Supported Datasets** | NuPlan (primary), NuScenes |
| **Pretrained Weights** | YES - World models for NuPlan and NuScenes + finetuned temporal-aware DCAE autoencoder on HuggingFace |
| **Ease of Setup** | 4/5 - Standard conda/pip, inference runs on single RTX 4090 |
| **Documentation** | 4/5 - Installation, inference scripts, data preparation README, DeepSpeed training docs |
| **Known Issues** | Only 3 open issues (nuScenes preprocessing, trajectory quality, NAVSIM integration). |

**Verdict:** Strong recent entry (ICCV 2025). Generates consistent minutes-long driving videos at high resolution. Doubles as a motion planner (outperforms end-to-end planners on NAVSIM). Runs inference on consumer GPU (4090). Well-suited for both world modeling and planning research. MIT license.

---

## Tier 2: Usable with Effort

These repos have working code but require more setup effort, have documentation gaps, or limited maintenance.

### 7. MagicDrive (v1 / v2)

| Field | Details |
|-------|---------|
| **GitHub URL** | https://github.com/cure-lab/MagicDrive (v1) / https://github.com/flymin/MagicDrive-V2 (v2) |
| **Stars** | 1,200 (v1) / 702 (v2) |
| **Last Commit** | 2023-09-07 (v1) / 2025-06-26 (v2) |
| **License** | Apache-2.0 (v1) / AGPL-3.0 (v2) |
| **Dependencies** | v1: PyTorch 1.10.2, CUDA 10.2, diffusers 0.17.1, xformers 0.0.19 / v2: PyTorch 2.4.0, torchvision 0.19.0, xformers, flash-attn, ColossalAI |
| **mmdet3d** | Not required directly |
| **Supported Datasets** | nuScenes (primary), Waymo (v2, partial) |
| **Pretrained Weights** | YES - v1: 3 resolution variants (OneDrive + HuggingFace) / v2: Stage-3 checkpoint on HuggingFace |
| **Ease of Setup** | 3/5 (v1) / 2/5 (v2 - requires ColossalAI custom builds, multi-node setup) |
| **Documentation** | 4/5 (v1 - includes FAQ, GUI) / 3/5 (v2 - multi-platform guides but complex) |
| **Known Issues** | v1: 8 open issues, dead dataset links (CUHK storage expired), broken external resource links. v2: stages 1-2 weights not yet released. AGPL-3.0 license on v2 is restrictive. |

**Verdict:** MagicDrive v1 is a solid street-view generation framework with diverse 3D geometry controls (camera poses, road maps, 3D bounding boxes). Good for data augmentation. v2 adds high-res long video but uses AGPL-3.0 (copyleft) and requires multi-node training infrastructure. v1 is more practical for most research groups.

---

### 8. Vista (OpenDriveLab)

| Field | Details |
|-------|---------|
| **GitHub URL** | https://github.com/OpenDriveLab/Vista |
| **Stars** | 862 |
| **Last Commit** | 2024-05-28 |
| **License** | Apache-2.0 |
| **Dependencies** | Python 3.9, PyTorch 2.0.1, CUDA 11.7, torchvision 0.15.2, Stability AI generative-models base |
| **Supported Datasets** | OpenDV (1700+ hours driving video), nuScenes |
| **Pretrained Weights** | YES - vista.safetensors on HuggingFace and Google Drive (note: EMA weight merging error in early release, use latest) |
| **Ease of Setup** | 3/5 - Standard conda setup but built on Stability AI codebase which adds complexity |
| **Documentation** | 3/5 - INSTALL.md, TRAINING.md, SAMPLING.md exist but sparse. TODO items remain (memory-efficient training, online demo). |
| **Known Issues** | 21 open issues, 2 pending PRs. EMA weight merging error in initial release. No updates since May 2024 - appears abandoned. |

**Verdict:** NeurIPS 2024 paper with strong benchmark results (55% better FID, 27% better FVD than prior SOTA). Supports multi-modal action conditioning (steering, speed, commands, trajectories, goal points). Provides reward function for different actions. However, no updates in nearly 2 years suggests project is inactive. Usable but expect to self-maintain.

---

### 9. OccWorld

| Field | Details |
|-------|---------|
| **GitHub URL** | https://github.com/wzzheng/OccWorld |
| **Stars** | 527 |
| **Last Commit** | 2023-11-23 |
| **License** | Apache-2.0 |
| **Dependencies** | Python 3.8, mmdetection3d (full mmdet3d stack), CUDA-capable GPU (RTX 4090 24GB recommended) |
| **Supported Datasets** | nuScenes, Occ3D (semantic occupancy annotations) |
| **Pretrained Weights** | YES - Tsinghua cloud storage link |
| **Ease of Setup** | 2/5 - mmdet3d dependency chain is notoriously painful. Environment.yaml provided but mmdet3d version conflicts are common. |
| **Documentation** | 3/5 - Structured README with install/train/eval/vis sections, but gaps in custom dataset guidance |
| **Known Issues** | 23 open / 0 closed issues (none resolved). NaN during training, missing PKL files, unclear VQ-VAE selection, camera projection questions. Maintainers appear unresponsive. |

**Verdict:** ECCV 2024 paper. Unique approach: models 3D occupancy evolution over time. Relevant for spatial understanding in driving. However, the mmdet3d dependency makes setup painful, maintainers have not closed a single issue, and last commit was Nov 2023. Only use if you specifically need occupancy-based world modeling and are comfortable with mmdet3d.

---

### 10. Panacea / Panacea+

| Field | Details |
|-------|---------|
| **GitHub URL** | https://github.com/wenyuqing/panacea |
| **Stars** | 254 |
| **Last Commit** | 2023-12-06 |
| **License** | Apache-2.0 |
| **Dependencies** | PyTorch (version unspecified), Stability-AI generative models, ControlNet, StreamPETR |
| **Supported Datasets** | nuScenes, Gen-nuScenes (self-generated synthetic data) |
| **Pretrained Weights** | YES - panaceaplus_40k_deepspeed.ckpt on HuggingFace |
| **Ease of Setup** | 3/5 - Multi-GPU (8 GPU) inference pipeline, DeepSpeed required |
| **Documentation** | 3/5 - Environment setup and data prep docs exist, but inference requires 8-GPU distributed setup |
| **Known Issues** | 7 open issues. Requires significant compute (8 GPUs for inference). Last commit Dec 2023. |

**Verdict:** CVPR 2024. Panoramic multi-view video generation with weather/time/scene control. Good for data augmentation and rare scenario generation (rain, snow). Panacea+ (Aug 2024) improved performance. However, 8-GPU inference requirement limits accessibility. StreamPETR integration enables downstream perception evaluation.

---

### 11. NVIDIA Alpamayo + AlpaSim

| Field | Details |
|-------|---------|
| **GitHub URL** | https://github.com/NVlabs/alpamayo (model) / https://github.com/NVlabs/alpasim (simulator) |
| **Stars** | 1,600 (Alpamayo) / 910 (AlpaSim) |
| **Last Commit** | 2025-11-19 (Alpamayo) / ~2025-10 (AlpaSim) |
| **License** | Apache 2.0 (inference code); Non-commercial (model weights) |
| **Dependencies** | Python 3.12, PyTorch (via pyproject.toml), NVIDIA GPU >= 24GB VRAM, Flash Attention 2 |
| **Supported Datasets** | Physical AI AV Dataset (1700+ hours, gated access on HuggingFace) |
| **Pretrained Weights** | YES - 10B parameter model (22GB weights) on HuggingFace (gated) |
| **Ease of Setup** | 3/5 - Standard Python setup but gated access, large model, 24GB VRAM minimum |
| **Documentation** | 4/5 - Comprehensive README, FAQ, troubleshooting, Jupyter notebook for interactive inference |
| **Known Issues** | Non-commercial license on weights limits deployment. No RL post-training. No navigation/route conditioning. Research-only, explicitly not for production. |

**Verdict:** Not a world model per se -- it is a Vision-Language-Action (VLA) model with Chain-of-Causation reasoning for trajectory prediction. Alpamayo 1.5 released with improvements. AlpaSim provides closed-loop simulation for testing. The non-commercial weight license is a significant limitation. Best for understanding NVIDIA's approach to reasoning-based AV development.

---

### 12. comma.ai commaVQ / World Model

| Field | Details |
|-------|---------|
| **GitHub URL** | https://github.com/commaai/commavq (world model dataset + code) / https://github.com/commaai/openpilot (production system) |
| **Stars** | 358 (commaVQ) / 52,000+ (openpilot) |
| **Last Commit** | 2026-03-22 (commaVQ, actively maintained) |
| **License** | MIT (commaVQ) |
| **Dependencies** | numpy, HuggingFace datasets, PyTorch |
| **Supported Datasets** | 100,000 minutes of compressed driving video (VQ-VAE tokenized), 3M minutes used for GPT training |
| **Pretrained Weights** | YES - VQ-VAE encoder/decoder + GPT world model weights included |
| **Ease of Setup** | 4/5 - Lightweight, Jupyter notebooks, dataset via HuggingFace |
| **Documentation** | 4/5 - Clear README, notebooks for encoding/decoding/prediction, dataset loading examples |
| **Known Issues** | Training code is limited (focus on inference/dataset). The production openpilot world model training pipeline is NOT open-source. Model architecture details for the production system are partially documented but training is proprietary. |

**Verdict:** Unique position -- comma.ai is the only company shipping a world-model-trained driving system to real cars (openpilot 0.10+, 2025). commaVQ provides the tokenized dataset and a basic GPT world model for research. The gap: production training pipeline is closed-source. Still valuable for experimenting with tokenized driving video prediction at scale. MIT license.

---

## Tier 3: Partial Code / Inference Only

### 13. DrivingWorld

| Field | Details |
|-------|---------|
| **GitHub URL** | https://github.com/YvanYin/DrivingWorld |
| **Stars** | 238 |
| **Last Commit** | 2024-12-25 |
| **License** | MIT |
| **Pretrained Weights** | YES - Video VQVAE + World Model on HuggingFace |
| **Code Status** | Inference code released. Evaluation code available. Training code NOT released. |
| **Documentation** | 3/5 - Installation (3 steps), data prep, multiple demo scripts |
| **Known Issues** | No training code. 5 open TODO items including missing HuggingFace demos. |

**Verdict:** Generates 40s+ driving videos via Video GPT. Inference-only limits research utility. MIT license is good. Wait for training code release or use for evaluation/benchmarking only.

---

### 14. DriveDreamer

| Field | Details |
|-------|---------|
| **GitHub URL** | https://github.com/JeffWang987/DriveDreamer |
| **Stars** | 551 |
| **Last Commit** | 2023-09-17 |
| **License** | Apache-2.0 |
| **Supported Datasets** | nuScenes |
| **Code Status** | Code structure released (dreamer-datasets, dreamer-models, dreamer-train directories). Research code released Nov 2024 per announcement, but repo last updated Sep 2023. Unclear weight availability. |
| **Documentation** | 2/5 - Getting Started docs exist but completeness uncertain |
| **Known Issues** | 24 open issues. Significant gap between announcement and actual code quality. Future updates redirected to "GigaAI-research." |

**Verdict:** ECCV 2024. Historically important as first real-world-driven world model for driving. However, code quality and completeness are questionable. Development moved to GigaAI-research org. Not recommended for new research projects.

---

### 15. DriveDreamer-2

| Field | Details |
|-------|---------|
| **GitHub URL** | https://github.com/f1yfisher/DriveDreamer2 |
| **Stars** | 242 |
| **Last Commit** | 2024-03-11 |
| **License** | Apache-2.0 |
| **Supported Datasets** | nuScenes |
| **Pretrained Weights** | YES - Available via Baidu Cloud (password: dkjq) |
| **Code Status** | Inference code + weights released Dec 2024. Full training code availability uncertain. |
| **Documentation** | 3/5 - Install, dataset prep, train/test/vis docs provided |
| **Known Issues** | 24 open issues. Weights only on Baidu Cloud (slow/inaccessible outside China). Delayed code release. |

**Verdict:** AAAI 2025. LLM-enhanced trajectory generation for diverse driving videos. Inference works but training reproducibility is uncertain. Baidu Cloud for weights is a friction point for international researchers.

---

## Tier 4: Paper-Only / Broken Code

### 16. DrivingGPT

| Field | Details |
|-------|---------|
| **Project Page** | https://rogerchern.github.io/DrivingGPT/ |
| **GitHub URL** | No public repository found |
| **Status** | PAPER ONLY - No code released |

**Verdict:** Promising approach (unified world modeling + planning via autoregressive transformers, strong nuPlan/NAVSIM results) but no code available. Cannot be used for research.

---

### 17. Copilot4D (Waabi)

| Field | Details |
|-------|---------|
| **Project Page** | https://waabi.ai/copilot-4d/ |
| **GitHub URL** | No public repository |
| **Status** | PROPRIETARY - No code released |

**Verdict:** ICLR 2024. Impressive point cloud forecasting via discrete diffusion (65%+ Chamfer distance improvement). But Waabi is a commercial company and has not released code or weights. Completely unusable for open research.

---

### 18. WorldDreamer

| Field | Details |
|-------|---------|
| **GitHub URL** | https://github.com/JeffWang987/WorldDreamer |
| **Stars** | 201 |
| **Last Commit** | 2024-01-18 |
| **License** | MIT |
| **Status** | PLACEHOLDER - Only README.md and LICENSE files. No code. |
| **Known Issues** | 4 open issues (likely requesting code release) |

**Verdict:** General world model for video generation (not driving-specific). Repo is a placeholder with zero implementation code. Do not use.

---

### 19. Drive-WM

| Field | Details |
|-------|---------|
| **GitHub URL** | https://github.com/BraveGroup/Drive-WM |
| **Stars** | 415 |
| **Last Commit** | 2023-11-18 |
| **License** | Apache-2.0 |
| **Status** | INCOMPLETE - Weights marked "coming soon" since Nov 2023 (over 2 years). Training code missing. |
| **Known Issues** | 8 open issues. All core deliverables (conditional image/video generation weights, action-conditioned weights, training code) remain undelivered. |

**Verdict:** CVPR 2024 paper with promising multiview forecasting + planning approach. But the repo is effectively abandoned -- "coming soon" for 2+ years. Based on diffusers library. Do not depend on this.

---

### 20. Think2Drive

| Field | Details |
|-------|---------|
| **GitHub URL** | https://github.com/Thinklab-SJTU/CornerCaseRepo (landing page only) |
| **Related Repos** | https://github.com/Thinklab-SJTU/Bench2Drive (benchmark, 1.8k stars) / https://github.com/Thinklab-SJTU/Bench2DriveZoo (student models, 369 stars) |
| **Status** | NO WORLD MODEL CODE - CornerCaseRepo is just HTML. Bench2DriveZoo has student models trained BY Think2Drive but not the Think2Drive world model itself. |

**Verdict:** Think2Drive is historically important (first model-based RL for driving, DreamerV3-based, expert-level CARLA v2 performance in 3 days on 1 A6000). But the actual world model code is not released. Bench2Drive/Bench2DriveZoo are useful benchmarking tools but do not contain the world model. If you want to reproduce Think2Drive, use CarDreamer instead (which provides the DreamerV3 backbone + CARLA integration).

---

### 21. GenAD (OpenDriveLab)

| Field | Details |
|-------|---------|
| **GitHub URL** | https://github.com/OpenDriveLab/DriveAGI |
| **Stars** | 791 |
| **Last Commit** | Active (dataset tools) |
| **Status** | PAPER + DATASET REPO - GenAD model code is not in this repo. Contains OpenDV-YouTube dataset tools and paper references. |

**Verdict:** CVPR 2024 Highlight. GenAD's actual model implementation is not publicly available. The DriveAGI repo is a hub for OpenDriveLab's driving foundation model papers and the OpenDV dataset. Use Vista instead if you want OpenDriveLab's actual runnable world model code.

---

## Dependency Compatibility Matrix

| Repo | PyTorch | CUDA | Python | mmdet3d | Min VRAM | Multi-GPU Required |
|------|---------|------|--------|---------|----------|-------------------|
| Cosmos 2.5 | 2.6.0 | 12.6 | 3.10 | No | Varies by model size | No (inference) |
| OpenDWM | >=2.5 | Any | >=3.9 | No | 32GB (short) / 80GB (long) | Recommended |
| CarDreamer | Flexible | Any | 3.10 | No | 10-20GB | No |
| DIAMOND | Recent | Any | 3.10 | No | 8GB+ | No |
| DiffusionDrive | Recent | Any | 3.8+ | No | 16GB+ | No |
| Epona | >=2.1.0 | 12.1 | 3.10 | No | Single 4090 (24GB) | No (inference) |
| MagicDrive v1 | 1.10.2 | 10.2 | 3.8+ | No (uses bevfusion) | 32GB (V100) | Yes (8x for training) |
| MagicDrive v2 | 2.4.0 | Recent | 3.10+ | No | 80GB+ | Yes (multi-node) |
| Vista | 2.0.1 | 11.7 | 3.9 | No | 80GB (A100) | Recommended |
| OccWorld | <2.0 | 10.x-11.x | 3.8 | YES | 24GB (4090) | No |
| Panacea | Unspecified | Unspecified | 3.8+ | No | 8x GPU for inference | Yes |
| Alpamayo | Recent | Recent | 3.12 | No | 24GB | No |
| commaVQ | Any | Optional | 3.8+ | No | Minimal | No |

---

## Quick Decision Guide

**"I want to fine-tune a general world model for driving"**
--> NVIDIA Cosmos Predict 2.5. Largest pretrained model, best documentation, active support. Has AV-specific variants already.

**"I want to generate realistic multi-view driving videos"**
--> OpenDWM. Widest dataset support, MIT license, active development, full training pipeline.

**"I want to train an RL agent using a world model in simulation"**
--> CarDreamer (CARLA + DreamerV3) for driving-specific. DIAMOND for general diffusion world model RL.

**"I want a world model that also does planning"**
--> Epona (autoregressive diffusion, ICCV 2025) or DiffusionDrive (truncated diffusion, CVPR 2025).

**"I want 3D occupancy-based world modeling"**
--> OccWorld. Only option, but expect mmdet3d pain and unresponsive maintainers.

**"I want street-view generation with 3D control for data augmentation"**
--> MagicDrive v1 (Apache-2.0) or Panacea (panoramic multi-view, weather control).

**"I want to understand how a production world model works"**
--> comma.ai commaVQ + openpilot. Only shipping system. Dataset + basic model open, production training closed.

**"I need a VLA reasoning model for trajectory prediction"**
--> NVIDIA Alpamayo 1.5 + AlpaSim. Non-commercial weights limit deployment.

---

## Summary Statistics

| Category | Count | Repos |
|----------|-------|-------|
| Fully usable today | 6 | Cosmos, OpenDWM, CarDreamer, DIAMOND, DiffusionDrive, Epona |
| Usable with effort | 6 | MagicDrive, Vista, OccWorld, Panacea, Alpamayo, commaVQ |
| Inference only | 3 | DrivingWorld, DriveDreamer-2, DriveDreamer |
| Paper-only / broken | 6 | DrivingGPT, Copilot4D, WorldDreamer, Drive-WM, Think2Drive, GenAD |

**Top 3 Recommendations for Airside AV Research:**

1. **NVIDIA Cosmos Predict 2.5** -- Fine-tune the foundation model on airport airside data. Best generalization, largest pretrained model, LoRA support for efficient adaptation.

2. **OpenDWM** -- If you need multi-view driving video generation with layout control, this is the most complete toolkit. MIT license. Supports custom data pipelines.

3. **CarDreamer + DreamerV3** -- If your goal is training an RL policy using a learned world model in simulation, this is the most practical path. Directly integrates with CARLA for closed-loop training.
