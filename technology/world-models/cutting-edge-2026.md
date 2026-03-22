# Cutting-Edge 2025-2026 Papers & Developments

## World Models, VLAs, and End-to-End Driving — What's Happening Right Now

---

## 1. Major Conference Papers (Late 2025 — Early 2026)

### 1.1 CVPR 2025 (June 2025)

| Paper | Key Contribution | Impact |
|-------|-----------------|--------|
| **DiffusionDrive** (Highlight) | Truncated diffusion for real-time E2E planning, 10x faster than vanilla diffusion | First real-time diffusion planner |
| **SplatAD** | Joint camera + LiDAR 3D Gaussian Splatting for AD simulation | First 3DGS with multi-modal sensor sim |
| **Data Scaling Laws for E2E AD** | Log-linear gains from 16 to 8,192 hours of driving data | Validates scaling for driving |
| **DriveTransformer** | Unified transformer for all driving tasks | End-to-end architecture simplification |
| **SparseDrive** | 0.06% collision rate, 7.3 FPS, fully sparse E2E driving | Current SOTA on nuScenes planning |

### 1.2 NeurIPS 2025 (December 2025)

| Paper | Key Contribution | Impact |
|-------|-----------------|--------|
| **WorldModelBench** | First benchmark evaluating video generators AS world models | Standardizes world model evaluation |
| **Vista** | Generalizable driving world model with multi-level controllability | 55% FID improvement, NeurIPS 2024 but widely adopted in 2025 |
| **AutoVLA** | Autonomous driving VLA with online RL fine-tuning | Bridge between VLAs and RL |

### 1.3 ICLR 2025-2026

| Paper | Key Contribution | Impact |
|-------|-----------------|--------|
| **GS-LiDAR** (ICLR 2025) | Panoramic 2D Gaussians for LiDAR simulation | LiDAR-native 3DGS |
| **AdaWM** (ICLR 2025) | Adaptive world model alignment for distribution shift | 2x success rate over DreamerV3 |
| **Copilot4D** (ICLR 2024, continued impact) | Discrete diffusion on LiDAR tokens | 65% Chamfer distance reduction |

### 1.4 AAAI 2026 (February 2026)

| Paper | Key Contribution | Impact |
|-------|-----------------|--------|
| **WorldRFT** | RL fine-tuning of world models with GRPO | 83% collision reduction on nuScenes |
| **AD-L-JEPA** | First JEPA for driving LiDAR pre-training | 1.9-2.7x GPU-hour reduction vs MAE |
| **Drive-OccWorld** | Action-conditioned 4D occupancy prediction | 33% improvement over UniAD |
| **DrivingGPT** | Unified driving language (interleaved image+action tokens) | PDMS 82.4% on NAVSIM |

### 1.5 CVPR 2026 / ICML 2026 (Expected)

| Paper/System | What's Known | Status |
|-------------|-------------|--------|
| **WorldLens** | Full-spectrum evaluation of driving world models in real-world settings, 24 dimensions across 5 axes | Accepted CVPR 2026 |
| **Epona** (ICCV 2025) | Autoregressive + diffusion hybrid, minute-long drift-free generation | Open code expected |
| **Dreamer V4** | Block-causal transformer world model, diamonds in Minecraft from offline data | May 2025 preprint, expected venue 2026 |

---

## 2. Industry Developments (2025-2026)

### 2.1 NVIDIA (January 2026 — CES)

- **Alpamayo-R1-10B** released: 10.5B VLA with Chain-of-Causation reasoning
- **Alpamayo 1.5**: RL post-training via GRPO, text-guided planning, flexible multi-camera
- **AlpaSim**: Open-source microservice closed-loop simulator
- **Physical AI dataset**: 1,727 hours across 25 countries, 700K reasoning traces (v1), 3M traces (v1.5)
- **Partners**: Lucid, JLR, Uber, Berkeley DeepDrive
- **Key detail**: Model weights are non-commercial (research/eval only). Designed as teacher for distillation.

### 2.2 Wayve

- **GAIA-3**: 15B parameters, 10x data of GAIA-2, 9 countries
- **Wayve AV2.0**: Single model navigating 500+ cities, no fine-tuning needed
- **US expansion**: Adapting to US roads with just 500 hours of incremental data
- **Uber partnership**: L4 trials in London planned for 2026
- **Valuation**: $8.6B

### 2.3 Waymo

- **EMMA**: End-to-end multimodal model built on Gemini, chain-of-thought reasoning
- **Waymo World Model**: Built on DeepMind Genie 3, generates camera AND LiDAR data
- **Sim Agents**: Scenario generation for testing
- **200M+ autonomous miles** in production
- **Scaling laws paper** (June 2025): Validated power-law improvements for motion planning

### 2.4 Tesla

- **FSD V13**: 48 neural nets, fully end-to-end from V12+
- **Temporal-Voxel Transformers**: Latest architecture evolution
- **3B+ FSD miles**: Largest real-world E2E driving dataset
- **Dojo 2**: Restarted, targeting 100K H100-equivalent scale in 2026

### 2.5 comma.ai

- **openpilot 0.11** (March 2026): First driving model fully trained in learned simulation
- **DiT world model**: 2B parameters (500M/1B variants also available)
- **CVPR 2025 paper**: On-policy learning from world model outperforms reprojective sim (52.49% vs 48.10% distance engagement)
- **325+ car models**, 100M+ miles, MIT licensed

### 2.6 Google DeepMind

- **Genie 2/3**: Interactive world models generating photorealistic environments at 24fps/720p
- **Scaling to driving**: Waymo World Model uses Genie 3 backbone
- **V-JEPA 2** (Meta, not DeepMind): 1B params, 240x faster planning than generation

### 2.7 Physical Intelligence

- **pi0.5**: Updated foundation model for robotics
- **Flow matching action head**: More stable than diffusion for action generation
- **Cross-embodiment**: Transfers across robot types — driving is the next target

---

## 3. Emerging Paradigms

### 3.1 World Models as Simulators (The "Learned Sim" Paradigm)

The biggest paradigm shift: **world models ARE the simulator**. Instead of building a physics engine, you train a model that generates realistic sensor data given actions.

| System | Approach | Status |
|--------|----------|--------|
| comma.ai openpilot | Train driving policy entirely in DiT world model | **Production** (March 2026) |
| Waymo World Model | Genie 3 generates camera+LiDAR for testing | Research+ |
| NVIDIA Cosmos | Foundation model for world simulation | Available |
| Wayve GAIA | Generative world model as simulator | Internal use |

**Why this matters for airside:** You don't need to build a CARLA-like airport simulator. Train a world model on your bags, then train your planner inside the world model. comma.ai proved this works.

### 3.2 VLAs Replacing Modular Stacks

The VLA paradigm (single model: sensor input → language reasoning → action output) is replacing modular perception-prediction-planning pipelines.

| Stage | 2024 | 2025-2026 |
|-------|------|-----------|
| Perception | Separate detector + tracker | VLA backbone handles it |
| Prediction | Separate motion forecaster | World model predicts implicitly |
| Planning | Separate trajectory optimizer | VLA directly outputs trajectories |
| Explanation | None | Chain-of-Causation reasoning |

### 3.3 RL Post-Training for Driving

Following the ChatGPT playbook: pre-train → SFT → RLHF. For driving: pre-train world model → supervised fine-tune on driving data → RL post-train in world model imagination.

| System | RL Method | Result |
|--------|-----------|--------|
| Alpamayo 1.5 | GRPO (3 reward signals) | AlpaSim 0.73→0.81, minADE 1.22→1.11m |
| WorldRFT | GRPO in latent world model | 83% collision reduction |
| SafeDreamer | Lagrangian-constrained RL | 94.3% cost reduction |
| Think2Drive | MBRL in latent space | Expert-level CARLA in 3 days |

### 3.4 Tokenize Everything

The field is converging on: tokenize all modalities → predict next token → scale.

```
Images → VQ-VAE/FSQ tokens → Transformer predicts next image tokens
LiDAR → Pillar/voxel tokens → Transformer predicts next LiDAR tokens
Actions → Discretized bins → Transformer predicts next action tokens
Language → BPE tokens → Transformer predicts next language tokens
Occupancy → VQ-VAE tokens → Transformer predicts next occupancy tokens

ALL IN ONE MODEL: DrivingGPT, GAIA-1, Alpamayo
```

---

## 4. Current SOTA Leaderboards (March 2026)

### 4.1 nuScenes Planning

| Rank | Method | Collision Rate | L2 Error (3s) | Year |
|------|--------|---------------|---------------|------|
| 1 | SparseDrive | 0.06% | 1.55m | 2024 |
| 2 | DiffusionDrive | 0.08% | 1.48m | 2025 |
| 3 | VADv2 | 0.12% | 1.62m | 2024 |
| 4 | UniAD | 0.31% | 1.65m | 2023 |

### 4.2 NAVSIM

| Rank | Method | PDMS Score | Year |
|------|--------|-----------|------|
| 1 | NVIDIA GTRS | 89.3% | 2025 |
| 2 | DrivingGPT | 82.4% | 2025 |
| 3 | DiffusionDrive | 80.1% | 2025 |

### 4.3 nuScenes Occupancy Prediction

| Rank | Method | mIoU | Year |
|------|--------|------|------|
| 1 | GaussianFormer-2 | 44.2% | 2025 |
| 2 | FB-OCC | 43.5% | 2024 |
| 3 | FlashOcc | 42.1% | 2024 |
| 4 | SurroundOcc | 40.7% | 2023 |

### 4.4 World Model Video Generation (nuScenes)

| Rank | Method | FID | FVD | Year |
|------|--------|-----|-----|------|
| 1 | DriveDreamer-2 | 11.2 | 55.7 | 2025 |
| 2 | DrivingGPT | 12.78 | 142.6 | 2025 |
| 3 | Drive-WM | 15.8 | 122.7 | 2024 |

---

## 5. What's Ahead of the Curve

### 5.1 Predictions for 2026-2027

1. **World model simulators go mainstream** — comma.ai proved it; expect Wayve, NVIDIA, and others to ship products trained primarily in learned simulators.

2. **VLA distillation pipelines mature** — Alpamayo is designed as a teacher. Expect standardized distillation → edge deployment pipelines for 100M-500M parameter student models on Orin/Thor.

3. **Multi-modal world models** — Models that jointly predict camera + LiDAR + radar futures (Waymo World Model already does camera + LiDAR). This enables full sensor simulation.

4. **Airside as a proving ground** — Low speed, structured environment, high economic value = ideal for early world model deployment. Expect 2-3 more companies to enter airside AV with learned approaches.

5. **Regulatory frameworks catch up** — ISO/PAS 8800 (Dec 2024) is the first standard addressing AI safety lifecycle. EASA AI Roadmap 2.0 targeting 2028 certification frameworks. FAA likely follows.

6. **Open-source world models reach production quality** — OpenDWM, Cosmos, OccWorld ecosystem maturing rapidly. The gap between research and deployable code is shrinking.

### 5.2 Research Gaps Worth Pursuing

| Gap | Why It Matters | Who Should Work On It |
|-----|---------------|----------------------|
| **Airside driving dataset** | Zero public datasets exist | You — publish a subset, become the benchmark |
| **LiDAR-native world models** | Most work is camera-centric | Copilot4D direction, but needs more work |
| **Multi-agent world models for GSE** | No airside coordination models | Combine with Moonware-style turnaround prediction |
| **Safety certification for world models** | No proven methodology exists | Build AMLAS + UL 4600 safety case, publish it |
| **Jet blast as learned hazard** | Only lookup tables today | Learn residuals from CFD + real data |

---

## Sources

- [CVPR 2025 Accepted Papers](https://cvpr.thecvf.com/)
- [NeurIPS 2025 Proceedings](https://neurips.cc/)
- [AAAI 2026 Proceedings](https://aaai.org/)
- [Wayve Blog](https://wayve.ai/thinking/)
- [NVIDIA Alpamayo](https://github.com/NVlabs/alpamayo)
- [comma.ai Research](https://blog.comma.ai/)
- [Waymo Research](https://waymo.com/research/)
- [OpenDriveLab](https://github.com/OpenDriveLab)
- [Awesome World Models for AD](https://github.com/LMD0311/Awesome-World-Model)
