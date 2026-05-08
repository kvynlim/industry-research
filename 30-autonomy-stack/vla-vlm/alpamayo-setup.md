# NVIDIA Alpamayo: Deep Practical Guide

**Status:** Research-ready, non-commercial
**Current versions:** Alpamayo 1 (Dec 2025), Alpamayo 1.5 (Mar 2026)
**Paper:** [arXiv:2511.00088](https://arxiv.org/abs/2511.00088) — *Alpamayo-R1: Bridging Reasoning and Action Prediction for Generalizable Autonomous Driving in the Long Tail*

---

## Table of Contents

1. [Architecture Deep Dive](#1-architecture-deep-dive)
2. [Getting Started](#2-getting-started)
3. [Fine-Tuning on Custom Data](#3-fine-tuning-on-custom-data)
4. [AlpaSim](#4-alpasim)
5. [Alpamayo 1.5](#5-alpamayo-15)
6. [Edge Deployment](#6-edge-deployment)
7. [Licensing](#7-licensing)
8. [The 1,727 Hours Dataset and 700K Reasoning Traces](#8-the-1727-hours-dataset-and-700k-reasoning-traces)

---

## 1. Architecture Deep Dive

### 1.1 High-Level Design

Alpamayo is a **Vision-Language-Action (VLA)** model — a single 10B-parameter transformer that consumes multi-camera video, egomotion history, and optional text, then jointly produces:
- **Chain-of-Causation (CoC) reasoning traces** — structured natural language explaining *why* the vehicle should act.
- **Driving trajectories** — 6.4-second future path as 64 waypoints at 10 Hz.

It functions as an **implicit world model operating in semantic space**, meaning the VLM backbone maintains an internal representation of scene dynamics, physics, and traffic rules that enables step-by-step causal reasoning before committing to an action.

### 1.2 Parameter Breakdown

| Component | Parameters | Role |
|-----------|-----------|------|
| Cosmos-Reason VLM backbone | 8.2B | Vision encoding, language reasoning, CoC generation |
| Diffusion-based action expert | 2.3B | Trajectory decoding via conditional flow matching |
| **Total** | **~10B** | — |

Tensor type: BF16. Model weights on HuggingFace: ~22 GB download.

### 1.3 Cosmos-Reason Backbone

The backbone is built on [Cosmos-Reason](https://github.com/nvidia-cosmos/cosmos-reason1), NVIDIA's physical-AI VLM family:

- **Alpamayo 1:** Based on **Cosmos-Reason 1** (Qwen2.5-VL architecture), 7B parameters.
- **Alpamayo 1.5:** Based on **Cosmos-Reason 2** (Qwen3-VL architecture), 8B parameters, with 256K input token context (up from 16K).

Cosmos-Reason is pre-trained on 3.7M Visual QA samples focused on physical AI, then post-trained on 100K driving-specific samples covering critical objects, traffic signals, and reasoning annotations. Fine-tuning on physical AI tasks boosts the base model performance by over 10%, with RL adding another 5%.

### 1.4 Vision Encoding — Three Strategies

The paper describes three tokenization strategies, selectable based on deployment constraints:

**Single-Image Tokenization:**
- ViT patch encoding with 2x2 bilinear downsampling.
- ~160 tokens per 448x280 image.
- Simplest, but scales linearly with camera count.

**Multi-Camera Triplane Tokenization:**
- Fixed grid sizes (Sx=Sy=96, Sz=48) with patchification (px=py=pz=8).
- Produces **288 tokens per timestep** regardless of camera count.
- 3.9x fewer tokens than single-image approach (~41.1 tokens per image equivalent).

**Multi-Camera Video (Flex) Tokenization:**
- Achieves **up to 20x token compression** compared to single-image.
- Best for multi-timestep, multi-camera input at scale.

### 1.5 Action Expert and Trajectory Decoder

The action expert is a separate transformer with the same architecture as the VLM backbone but with **smaller hidden embedding and MLP dimensions** for efficiency. It uses a **unicycle dynamics model** in bird's-eye-view (BEV) space:

- **Control inputs:** acceleration and curvature.
- **Training representation:** 128 discrete trajectory tokens per 6.4s prediction (64 waypoints x 2 values), trained with cross-entropy loss.
- **Inference representation:** Continuous decoder using **conditional flow matching** (diffusion-based), enabling multiple trajectory samples.

The dual-representation is key: discrete tokens during training allow joint autoregressive training with reasoning tokens, while the flow-matching decoder at inference produces smooth, physically feasible trajectories. A **stop-gradient** is applied to the VLM KV-cache during action expert training, preventing gradient backpropagation into the main backbone during Stage 1.

End-to-end on-vehicle latency: **99 ms** (meeting the 10 Hz / 100 ms real-time constraint).

### 1.6 Chain-of-Causation (CoC) Reasoning

CoC is a structured annotation schema that forces causal grounding of driving decisions. Each trace contains:

**Driving Decisions (closed set):**
- 10 longitudinal decisions: set-speed tracking, lead following, speed adaptation, gap-searching, overtaking, yielding, full stops, etc.
- 8 lateral decisions: lane keeping, lane merges, turns, nudges, etc.

**Critical Components (open-ended):**
- Critical objects (vehicles, pedestrians, cyclists, construction equipment)
- Traffic signals and signs
- Road events (construction zones, accidents)
- Lane characteristics (markings, width, curvature)
- Routing intent

**Composed Trace:** Natural language reasoning linking the above into a causal chain. Example output:
> "Construction zone ahead with narrowing lanes and cones on right shoulder. Lateral decision: nudge left. Longitudinal decision: speed adaptation — reduce speed to 15 mph for clearance from construction cones."

The structured format achieves a **132.8% relative improvement** in causal relationship scoring over free-form reasoning approaches.

### 1.7 Input/Output Specifications

**Inputs:**

| Modality | Format | Details |
|----------|--------|---------|
| Multi-camera video | RGB images | 4 cameras default (front-wide, front-tele, cross-left, cross-right); 1080x1920 downsampled to 320x576; 0.4s history at 10Hz (4 frames per camera) |
| Egomotion history | (x,y,z) + 3x3 rotation | 16 waypoints at 10Hz with timestamps |
| Text (optional, v1.5) | String | User commands, navigation guidance |

**Outputs:**

| Modality | Format | Details |
|----------|--------|---------|
| Reasoning trace | Variable-length text | CoC format linking decisions to causal factors |
| Trajectory | (x,y,z) + 3x3 rotation | 64 waypoints at 10Hz over 6.4s in ego vehicle frame |

### 1.8 Training Pipeline — Three Stages

**Stage 1 — Action Modality Injection:**
- Cross-entropy loss over discrete trajectory tokens.
- Stop-gradient on VLM KV-cache (action expert trains independently).
- Teaches the model the "language" of vehicle control.

**Stage 2 — Reasoning Elicitation:**
- Supervised fine-tuning (SFT) on the CoC dataset.
- Maximizes conditional log-likelihood: the VLA learns joint distributions of language explanations and action predictions through unified autoregressive training.

**Stage 3 — RL Post-Training (v1.5 only):**
- **Algorithm:** Group Relative Policy Optimization (GRPO).
- **Reward signals:**
  - Reasoning quality (evaluated via large teacher model, e.g., DeepSeek-R1 or Cosmos-Reason).
  - Reasoning-action consistency (are the stated reasons reflected in the trajectory?).
  - Trajectory quality (safety, smoothness, rule compliance).
- Cost-efficient data curation: high-uncertainty scenarios and long-tail events are prioritized.
- The policy update uses cross-entropy reward with a KL divergence penalty against a reference policy.

**RL Results:**
- 45% improvement in reasoning quality.
- 37% improvement in reasoning-action consistency.
- 35% reduction in close-encounter rate (closed-loop simulation).

---

## 2. Getting Started

### 2.1 Download Locations

| Resource | Location |
|----------|----------|
| Model weights (Alpamayo 1) | [nvidia/Alpamayo-R1-10B](https://huggingface.co/nvidia/Alpamayo-R1-10B) (HuggingFace, gated) |
| Model weights (Alpamayo 1.5) | [nvidia/Alpamayo-1.5-10B](https://huggingface.co/nvidia/Alpamayo-1.5-10B) (HuggingFace, gated) |
| Inference code (v1) | [github.com/NVlabs/alpamayo](https://github.com/NVlabs/alpamayo) |
| Inference code (v1.5) | [github.com/NVlabs/alpamayo1.5](https://github.com/NVlabs/alpamayo1.5) |
| Post-training scripts (SFT + RL) | [github.com/NVlabs/alpamayo](https://github.com/NVlabs/alpamayo) |
| AlpaSim simulator | [github.com/NVlabs/alpasim](https://github.com/NVlabs/alpasim) |
| Dataset | [nvidia/PhysicalAI-Autonomous-Vehicles](https://huggingface.co/datasets/nvidia/PhysicalAI-Autonomous-Vehicles) (HuggingFace, gated) |
| NuRec scenes for AlpaSim | [nvidia/PhysicalAI-Autonomous-Vehicles-NuRec](https://huggingface.co/datasets/nvidia/PhysicalAI-Autonomous-Vehicles-NuRec) (HuggingFace) |
| Dataset developer kit | [github.com/NVlabs/physical_ai_av](https://github.com/NVlabs/physical_ai_av) |

**Note:** Both model weights and the main dataset are **gated resources** requiring HuggingFace authentication and acceptance of the respective license agreements.

### 2.2 Hardware Requirements

**Inference (minimum):**

| Configuration | VRAM Required | Example GPUs |
|---------------|--------------|--------------|
| Single-sample inference | ~24 GB | RTX 3090, RTX 4090, A5000, A100, H100 |
| Multi-sample (16 trajectories) | ~40 GB | A100-40GB, A100-80GB |
| Multi-sample with CFG | ~60 GB | A100-80GB, H100 |

GPUs with less than 24 GB VRAM will encounter CUDA out-of-memory errors.

**Software requirements:**

| Component | Minimum Version |
|-----------|----------------|
| Python | 3.12.x |
| PyTorch | 2.8+ |
| HuggingFace Transformers | 4.57.1+ |
| DeepSpeed | 0.17.4+ |
| OS | Linux (other platforms unverified) |
| Attention backend | Flash Attention 2 (default) or SDPA fallback |

### 2.3 Environment Setup (Alpamayo 1)

```bash
# Step 1: Install uv package manager
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"

# Step 2: Clone and set up
git clone https://github.com/NVlabs/alpamayo.git
cd alpamayo
uv venv ar1_venv
source ar1_venv/bin/activate
uv sync --active

# Step 3: HuggingFace authentication (required for gated resources)
pip install huggingface_hub
huggingface-cli login
# Paste your token from https://huggingface.co/settings/tokens
```

Before running inference, you must request access to both:
1. [Physical AI Autonomous Vehicles Dataset](https://huggingface.co/datasets/nvidia/PhysicalAI-Autonomous-Vehicles)
2. [Alpamayo Model Weights](https://huggingface.co/nvidia/Alpamayo-R1-10B)

### 2.4 Environment Setup (Alpamayo 1.5)

```bash
git clone https://github.com/NVlabs/alpamayo1.5.git
cd alpamayo1.5
uv venv a1_5_venv
source a1_5_venv/bin/activate
uv sync --active
hf auth login
```

### 2.5 Running Inference

**Quick test (v1):**

```bash
python src/alpamayo_r1/test_inference.py
```

This downloads example data (small) and model weights (22 GB) on first run. It runs a forward pass on sample driving data and outputs a trajectory + reasoning trace.

To generate multiple trajectory samples, modify Line 60: `num_traj_samples=N`.

**Interactive notebook:**

```
notebooks/inference.ipynb        # Standard inference
notebooks/inference_cam_num.ipynb  # Multi-camera experiments (v1.5)
```

**Attention backend fallback** (if Flash Attention 2 is unavailable):

```python
config.attn_implementation = "sdpa"
```

### 2.6 Project Structure

```
src/alpamayo_r1/
├── action_space/          # Action space definitions (unicycle model)
├── diffusion/             # Flow-matching trajectory decoder
├── geometry/              # Coordinate transforms, BEV utilities
├── models/                # VLM + action expert model definitions
├── config.py              # Hydra configuration
├── helper.py              # Utilities
├── load_physical_aiavdataset.py  # Dataset loader
└── test_inference.py      # Quick inference test
```

---

## 3. Fine-Tuning on Custom Data

### 3.1 Available Training Scripts

As of the Alpamayo 1.5 release (March 2026), NVIDIA provides two categories of post-training scripts in the [NVlabs/alpamayo](https://github.com/NVlabs/alpamayo) repository:

1. **Supervised Fine-Tuning (SFT) scripts** — For domain adaptation on your own driving data. Fine-tune the model to produce CoC reasoning traces and trajectories specific to your operational domain.

2. **Reinforcement Learning (RL) post-training scripts** — For reward-driven improvement of reasoning quality, trajectory accuracy, and reasoning-trajectory alignment. Customizable reward functions allow optimizing for specific driving behaviors.

### 3.2 Data Format

The Alpamayo training pipeline expects data in the following structure:

**Multi-camera video clips:**
- 20-second clips at 30 fps, 1080p resolution.
- 7 cameras (or a subset): front-wide-120, front-tele-30, cross-left-120, cross-right-120, rear-left-70, rear-right-70, rear-tele-30.
- Format: MP4 video files named `<clip_uuid>.camera_<fov>.mp4`.

**Egomotion data:**
- Parquet files with (x, y, z) translation and 3x3 rotation matrices.
- 10 Hz sampling, 16 waypoints per input, 64 waypoints per output target.

**CoC reasoning labels:**
- Structured text in English following the CoC schema.
- Must include longitudinal decision, lateral decision, critical components, and composed reasoning trace.
- Can be human-labeled (~10% recommended) or auto-labeled using a teacher VLM (90% via GPT-5 or equivalent with structured prompting).

**Trajectory labels:**
- 6.4-second future trajectories as (x, y, z) + rotation in ego vehicle frame.
- 64 waypoints at 10 Hz.
- Internally converted to acceleration and curvature values in BEV space.

### 3.3 LoRA vs. Full Fine-Tuning

The Alpamayo repository and model card **do not explicitly document LoRA fine-tuning** as a supported pathway. However, since the backbone is Cosmos-Reason (based on Qwen2.5-VL / Qwen3-VL), standard LoRA techniques are architecturally compatible:

**Full fine-tuning (SFT):**
- GPU requirement: multiple GPUs with aggregate 80+ GB VRAM recommended.
- Uses DeepSpeed ZeRO-3 for memory-efficient multi-GPU training.
- Recommended for domain adaptation where you have substantial (>10K clips) driving data from your target domain.

**LoRA (community/custom approach):**
- Not officially provided but technically feasible since the backbone is a standard transformer.
- Target the attention projection layers (q_proj, k_proj, v_proj, o_proj) of the Cosmos-Reason backbone.
- Rank 16-64 typical for VLM adaptation.
- Reduces trainable parameters by ~10,000x, GPU memory by ~3x.
- Would work for the VLM backbone but **not** for the action expert (which requires separate handling due to its diffusion-based architecture).

**Practical recommendation:**
Use the official SFT scripts with DeepSpeed ZeRO-3 for proper joint training of reasoning + trajectory outputs. A LoRA approach that only adapts the VLM backbone would improve reasoning quality but might not properly fine-tune the trajectory decoder without additional engineering.

### 3.4 GPU Requirements for Training

| Task | Minimum Setup | Recommended |
|------|--------------|-------------|
| SFT on custom data | 4x A100 40GB (ZeRO-3) | 8x H100 80GB |
| RL post-training (GRPO) | 8x A100 80GB | 8x H100 80GB |
| Inference-only | 1x RTX 3090 24GB | 1x A100 40GB |

DeepSpeed ZeRO-3 is required for multi-GPU training, enabling optimizer state, gradient, and parameter partitioning across GPUs.

### 3.5 Can You Fine-Tune with LiDAR-Only?

**No — Alpamayo is a camera-only model at the architecture level.** The vision encoder (ViT) is designed exclusively for RGB image input. LiDAR point clouds cannot be directly fed into the model.

However, you have options:

1. **LiDAR-derived BEV maps as images:** Render LiDAR point clouds as BEV occupancy grids or intensity images, then feed them as camera inputs. This is a workaround, not a native capability, and would require SFT to adapt the vision encoder.

2. **LiDAR for label generation:** Use LiDAR for creating high-quality ground-truth trajectories and annotations during training, while the model itself operates on camera input at inference. This is how the Physical AI AV dataset is structured — LiDAR is available for 298K of the 306K clips but is used for annotation, not model input.

3. **Sensor fusion modification:** This would require modifying the model architecture to add a LiDAR encoder branch, which is possible but goes well beyond the provided fine-tuning scripts.

The dataset includes LiDAR data (top 360-degree rotating LiDAR at 10 Hz in Draco-compressed Parquet format), making it valuable for supervision even if the model itself is camera-only.

---

## 4. AlpaSim

### 4.1 Architecture Overview

[AlpaSim](https://github.com/NVlabs/alpasim) is a **microservice-based** end-to-end AV simulation platform. Each component runs in a separate Docker container and communicates via **gRPC**:

```
┌──────────────────────────────────────────────────┐
│                    Runtime                        │
│         (central orchestrator service)            │
│    Manages simulation loop, time stepping,        │
│    coordinates all other services                 │
├──────────┬──────────┬──────────┬─────────────────┤
│  Driver  │ Renderer │ Traffic  │   Controller    │
│ (policy) │ (NuRec)  │  Sim     │  (ego vehicle)  │
│          │          │          │                 │
│ gRPC     │ gRPC     │ gRPC     │   gRPC          │
└──────────┴──────────┴──────────┴─────────────────┘
           │                      │
           │       Physics        │
           │    (road surface      │
           │     constraints)      │
           └──────────────────────┘
```

**Microservices:**
- **Runtime:** Central orchestrator managing the simulation loop.
- **Driver:** Driving policy (Alpamayo, VaVAM, Transfuser, or custom).
- **Renderer (SensorSim):** Neural reconstruction (NuRec) providing photorealistic camera feeds.
- **TrafficSim:** Background traffic agent simulation.
- **Controller:** Ego vehicle trajectory management from recorded logs.
- **Physics:** Constrains actors to road surfaces, enforces physical limits.

This design enables: (a) clear modular APIs with no dependency conflicts, and (b) arbitrary horizontal scaling — assign different services to different GPUs.

### 4.2 Setup

```bash
git clone https://github.com/NVlabs/alpasim.git
cd alpasim

# Follow onboarding
# source docs/ONBOARDING.md steps

# Set up environment
source setup_local_env.sh
export HF_TOKEN="<your_huggingface_token>"

# Download a driver model (VaVAM default)
bash data/download_vavam_assets.sh --model vavam-b

# Run with default settings
uv run alpasim_wizard +deploy=local wizard.log_dir=$PWD/tutorial
```

This generates Docker Compose configurations, downloads NuRec scenes if needed, and executes the simulation.

### 4.3 Supported Driving Policies

| Policy | Command Override | Notes |
|--------|-----------------|-------|
| VaVAM (default) | `driver=[vavam,vavam_runtime_configs]` | Autoregressive video-action model, lightweight |
| Alpamayo-R1 | `driver=[ar1,ar1_runtime_configs]` | 10B params — requires substantial GPU memory |
| Transfuser (LTFv6) | `driver=[transfuser,transfuser_runtime_configs]` | NAVSIM-compatible policy |
| Log Replay | Special config (see tutorial) | Ground-truth trajectory playback |

For Alpamayo-R1, download weights first:
```bash
huggingface-cli download nvidia/Alpamayo-R1-10B
uv run alpasim_wizard +deploy=local wizard.log_dir=$PWD/tutorial_alpamayo \
  driver=[ar1,ar1_runtime_configs]
```

### 4.4 Scenario Definition

Scenarios are **NuRec reconstructions** of real-world driving logs, stored as `.usdz` files. The platform ships with ~**900 reconstructed scenes**, each 20 seconds long.

**Run specific scenes:**
```bash
uv run alpasim_wizard +deploy=local wizard.log_dir=$PWD/run1 \
  scenes.scene_ids=['clipgt-02eadd92-02f1-46d8-86fe-a9e338fed0b6']
```

**Run a pre-validated scene suite:**
```bash
uv run alpasim_wizard +deploy=local wizard.log_dir=$PWD/run_suite \
  scenes.test_suite_id=public_2602
```

Scene IDs are listed in `data/scenes/sim_scenes.csv`; suites in `data/scenes/sim_suites.csv`.

### 4.5 Evaluation Metrics

AlpaSim produces structured evaluation output:

```
log_dir/
├── rollouts/{scene_id}/{batch_uuid}/
│   ├── rollout.asl              # Size-delimited protobuf simulation log
│   ├── rollout.rclog            # Complete interaction log
│   ├── metrics.parquet          # Per-rollout evaluation metrics
│   └── *.mp4                    # Evaluation video
└── aggregate/
    ├── metrics_results.txt      # Driving scores (mean, std, quantiles)
    ├── metrics_results.png      # Visual metric summary
    └── videos/                  # Organized by violation type
        ├── collision_at_fault/
        ├── offroad/
        └── ...
```

**Key metric:** AlpaSim Score — a composite driving quality score. Alpamayo 1 achieves **0.73 +/- 0.01**, Alpamayo 1.5 achieves **0.81 +/- 0.01** on 910 scenarios.

**Sim2Val framework:** Demonstrated up to **83% variance reduction** when correlating simulation metrics with real-world validation, showing strong sim-to-real transfer.

### 4.6 Custom Environments and Extensibility

**Code changes:** Modifications to Python code in `src/driver/src/alpasim_driver/` are automatically mounted into Docker containers. Dependent package updates require image rebuilds.

**Custom driver containers:**
```yaml
services.<service>.image: <custom_image_name>
services.<service>.command: <startup_command>
```

Images must expose gRPC endpoints matching the interfaces defined in `src/grpc/alpasim_grpc/v0/`.

**Plugin system:** An extensible plugin system allows adding new microservices (drivers, renderers, data sources) without modifying core AlpaSim code. See `docs/PLUGIN_SYSTEM.md`.

**Language composition:** Python (78.3%), Jupyter Notebook (16.4%), Rust (4.3%).

### 4.7 Debugging

AlpaSim supports breakpoint debugging by generating configs without running:

```bash
uv run alpasim_wizard +deploy=local wizard.log_dir=$PWD/debug \
  wizard.run_method=NONE wizard.debug_flags.use_localhost=True
```

Then start individual services manually for debugging, e.g.:
```bash
cd src/controller/
uv run python -m alpasim_controller.server --port=6003 \
  --log_dir=my_log --log-level=INFO
```

A Jupyter notebook (`src/runtime/notebooks/replay_logs_alpamodel.ipynb`) supports replaying simulation stimuli with debuggers attached.

---

## 5. Alpamayo 1.5

### 5.1 What Changed

| Feature | v1.0 | v1.5 |
|---------|------|------|
| VLM backbone | Cosmos-Reason 1 (Qwen2.5-VL) | Cosmos-Reason 2 (Qwen3-VL, 256K context) |
| RL post-training | Not included | GRPO with verifiable rewards |
| Navigation conditioning | Not supported | Text-guided trajectory planning |
| Multi-camera flexibility | Fixed 4-camera layout | Variable camera counts |
| Visual Question Answering | Not supported | `generate_text` method |
| CoC reasoning traces | 700K | 3M |
| AlpaSim score | 0.73 | 0.81 |
| Open-loop minADE_6 @ 6.4s | 1.22m | 1.11m |
| Lingo-Judge reasoning score | — | 74.2 |

### 5.2 RL Post-Training Details

Alpamayo 1.5's key differentiator is **Stage 3 RL post-training** using **Group Relative Policy Optimization (GRPO)**:

1. **Data selection:** Cost-efficient curation targeting high-uncertainty scenarios and long-tail events from the 80K-hour driving corpus.
2. **Group sampling:** For each input, multiple (reasoning, trajectory) pairs are sampled from the current policy.
3. **Reward computation:** Each sample is scored by:
   - A large reasoning teacher model (e.g., DeepSeek-R1, Cosmos-Reason) for **reasoning quality**.
   - A consistency evaluator for **reasoning-action alignment** (does the reasoning actually justify the trajectory?).
   - A trajectory quality evaluator for **safety and rule compliance**.
4. **Policy update:** Cross-entropy reward with KL divergence penalty against the reference (pre-RL) policy. Rewards are normalized relative to the group (hence "Group Relative").

The open-source repository provides these RL scripts with **customizable reward functions**, allowing researchers to define their own driving behavior objectives.

### 5.3 Text-Guided Planning

Alpamayo 1.5 accepts natural language instructions that condition trajectory generation:

```
"Turn left at the next intersection"
"Merge into the right lane in 200 meters"
"Stop at the pedestrian crossing"
```

This enables controllable and interpretable planning — developers can steer behavior and specify constraints directly through text prompts alongside navigation guidance.

### 5.4 Multi-Camera Support

Alpamayo 1.5 supports **variable camera counts** at inference time, removing the fixed 4-camera constraint of v1.0. This means:
- Adaptable to different vehicle platforms and sensor rigs.
- Can run with fewer cameras (e.g., front-only) at the cost of reduced accuracy.
- Experiment via `notebooks/inference_cam_num.ipynb`.

Accuracy degrades with fewer cameras; the magnitude depends on the scenario (e.g., a straight highway is less affected than a complex intersection).

### 5.5 Visual Question Answering

A new `generate_text` method enables text-only inference:

```python
# Instead of trajectory output, get a text answer
response = model.generate_text(images, question="What hazards are visible ahead?")
```

This supports use cases like automated scene annotation, scenario tagging, and debugging.

---

## 6. Edge Deployment

### 6.1 The Deployment Paradigm: Teacher-Student Distillation

Alpamayo is **not designed to run directly on edge hardware**. NVIDIA's intended deployment model:

1. **Alpamayo as offline teacher:** The 10B model runs in the cloud or on datacenter GPUs, generating trajectories, reasoning traces, and labels.
2. **Distillation into smaller runtime models:** Developers fine-tune and distill Alpamayo's capabilities into compact models that fit on in-vehicle compute.
3. **Edge deployment of distilled student:** The smaller model runs on NVIDIA DRIVE AGX Orin or DRIVE AGX Thor.

This is explicitly stated: *"Rather than running directly in-vehicle, Alpamayo models serve as large-scale teacher models that developers can fine-tune and distill into the backbones of their complete AV stacks."*

### 6.2 TensorRT Edge-LLM

For deploying distilled VLM/VLA models at the edge, NVIDIA provides [TensorRT Edge-LLM](https://developer.nvidia.com/blog/accelerating-llm-and-vlm-inference-for-automotive-and-robotics-with-nvidia-tensorrt-edge-llm):

- **Open-source C++ framework** — no Python dependencies in the inference path.
- **Designed for:** NVIDIA DRIVE AGX Thor, Jetson Thor, and (with limitations) DRIVE AGX Orin.
- **Quantization support:** NVFP4, FP8 (for ViT components), with the export pipeline handling quantization.
- **Key features:** EAGLE-3 speculative decoding, chunked prefill, LoRA adapter support, Vision Transformer integration.
- **Three-stage pipeline:** HuggingFace model → ONNX export → TensorRT engine build → C++ runtime inference.
- **Cosmos-Reason 2 support:** Confirmed as a supported model for edge deployment.

**Published performance targets:**
- Time to First Token (TTFT): < 200 ms
- Time per Output Token (TPOT): < 50 ms
- Both measured on Jetson Thor / DRIVE AGX Thor.

### 6.3 DRIVE AGX Thor vs. DRIVE AGX Orin

| Spec | DRIVE AGX Orin | DRIVE AGX Thor |
|------|---------------|----------------|
| INT8 TOPS | 254 | 1,000 |
| FP4 TFLOPS | — | 2,000 |
| Architecture | Ampere | Blackwell (4nm/3nm) |
| GPU Memory | 32-64 GB (shared) | 128 GB+ |
| Target | L2+ ADAS, L4 AV | Next-gen L4 AV |

**Orin feasibility for full Alpamayo 10B:** Unlikely. The 24 GB minimum VRAM requirement exceeds Orin's available GPU memory after OS and other stack components. However:
- A distilled 2-3B student model could fit.
- ThunderSoft has demonstrated TensorRT Edge-LLM integration on an AIBOX platform based on DRIVE AGX Orin for responsive on-device LLM and multimodal inference.

**Thor feasibility for Alpamayo:** More viable. On DRIVE Thor, NVIDIA states Alpamayo 1 achieves "production-viable latencies" using FP8 acceleration for the ViT components. However, it remains a distilled/optimized version rather than the full 10B model.

**Jetson Thor:** Delivers up to 5x performance improvement over Jetson Orin for generative AI models.

### 6.4 Quantization Approaches

For edge deployment of Alpamayo-derived models:

| Method | Precision | Memory Reduction | Quality Impact | Hardware |
|--------|-----------|-----------------|----------------|----------|
| FP8 (ViT only) | E4M3 | ~2x for vision encoder | Minimal | Thor (Blackwell) |
| NVFP4 | 4-bit floating point | ~4x | Moderate | Thor (Blackwell) |
| INT8 | 8-bit integer | ~2x | Low-moderate | Orin, Thor |
| INT4/AWQ | 4-bit integer, activation-aware | ~4x | Moderate-high | Orin, Thor |

NVIDIA's recommended path: use TensorRT Model Optimizer for pruning and distillation, then TensorRT Edge-LLM for optimized inference.

### 6.5 On-Vehicle Measured Latency

From the Alpamayo paper (full 10B model on datacenter GPU):
- **End-to-end latency: 99 ms** — meeting the 10 Hz real-time constraint.
- This was measured during on-vehicle road tests in urban environments.
- The 99 ms figure includes vision encoding, reasoning token generation, and trajectory decoding.

No public benchmarks exist for distilled Alpamayo models on Orin or Thor specifically.

---

## 7. Licensing

### 7.1 License Matrix

| Component | License | Commercial Use |
|-----------|---------|---------------|
| Inference code (GitHub repos) | Apache License 2.0 | Yes |
| Model weights (Alpamayo 1) | NVIDIA Non-Commercial License | No — research/evaluation only |
| Model weights (Alpamayo 1.5) | NVIDIA Non-Commercial License | No — research/evaluation only |
| AlpaSim code | Apache License 2.0 | Yes |
| Physical AI AV Dataset | NVIDIA Autonomous Vehicle Dataset License | Internal development only (see below) |

### 7.2 Model Weights: Non-Commercial License

The Alpamayo model weights license permits:
- Reproduction in any form.
- Preparation of derivative works.
- Public display and performance.
- Sublicensing and distribution (under the same non-commercial terms).

**Critical restriction:** *"The Work and derivative works may only be used for research or evaluation purposes."* Only NVIDIA Corporation and its affiliates may use the weights commercially.

- Derivative works must be redistributed under the same license.
- A complete copy of the license must accompany any distribution.
- Patent litigation against NVIDIA immediately terminates your license.
- Use must comply with NVIDIA's Trustworthy AI terms.

### 7.3 NVIDIA Open Model License (NOML) — For Reference

The [NVIDIA Open Model License](https://www.nvidia.com/en-us/agreements/enterprise-software/nvidia-open-model-license/) is a separate, **commercially permissive** license used for some NVIDIA models (e.g., certain Cosmos models). Key provisions:

- **Commercial use explicitly allowed** — sell, distribute, create derivative works.
- **Guardrail provision:** If you bypass safety guardrails without providing substantially similar alternatives, your rights terminate automatically.
- **Attribution:** Products using NVIDIA Cosmos Models must include "Built on NVIDIA Cosmos" in documentation.
- **No safety-critical carve-out** — no specific restrictions for autonomous vehicles beyond the guardrail provision.

**Alpamayo model weights are NOT under NOML** — they use the more restrictive non-commercial license. The code is under Apache 2.0. This is an important distinction for anyone planning commercial deployment.

### 7.4 Dataset License

The Physical AI AV Dataset uses a custom NVIDIA Autonomous Vehicle Dataset License:
- **Permitted:** Autonomous vehicle development (commercial and non-commercial), internal development only, use with NVIDIA technology.
- **Prohibited:** Surveillance, biometric processing, individual identification (license plates, de-anonymization), redistribution/sublicensing.
- **Term:** 12 months from download date (auto-renewal).
- **Governing law:** Delaware; jurisdiction in Santa Clara County, CA.

### 7.5 Practical Implications

For production AV deployment:
1. You **cannot** deploy Alpamayo weights directly in a commercial product.
2. You **can** use Alpamayo as a research tool to develop understanding, then train your own models from scratch using the publicly available architectural insights.
3. The **dataset** can be used for commercial AV development (internal only), but you cannot redistribute it.
4. The **code** (Apache 2.0) can be used commercially, modified, and redistributed freely.
5. Models distilled *from* Alpamayo weights inherit the non-commercial restriction.

---

## 8. The 1,727 Hours Dataset and 700K Reasoning Traces

### 8.1 Physical AI AV Dataset

**Scale:**
- **1,727 hours** of driving data (133 TB total).
- **306,152 clips**, each 20 seconds long.
- **25 countries**, 2,500+ cities.
- Geographic breakdown: US (155K clips), Germany (44K), France (10K), Italy (9K), Sweden (7K), plus 20 other countries.

**Sensor configuration:**

| Sensor | Count | Coverage | Format |
|--------|-------|----------|--------|
| Cameras | 7 (360-degree) | All 306K clips | 1080p MP4 at 30fps |
| LiDAR | 1 (top 360-degree) | 298K clips | Draco-compressed Parquet, 10Hz |
| Radar | Up to 10 | 161K clips | Parquet files |

**Camera arrangement:**
- Front wide (120 FOV)
- Front tele (30 FOV)
- Cross left (120 FOV)
- Cross right (120 FOV)
- Rear left (70 FOV)
- Rear right (70 FOV)
- Rear tele (30 FOV)

**Radar positions:** Front bumper center, front left/right corners, left/right sides, rear left/right corners, rear left/right. Includes SRR (Short Range), MRR (Medium Range), and LRR (Long Range) types.

### 8.2 Data Organization

```
PhysicalAI-Autonomous-Vehicles/
├── camera/
│   ├── camera_front_wide_120fov/
│   │   ├── camera_front_wide_120fov.chunk_0000.zip   # ~100 clips per chunk
│   │   └── ...
│   └── [6 other camera views]/
├── lidar/
│   └── lidar_top_360fov/
│       ├── lidar_top_360fov.chunk_0000.zip
│       └── ...
├── radar/
│   ├── radar_corner_front_left_srr_0/
│   └── [9 other radar positions]/
├── calibration/
│   ├── camera_intrinsics/
│   ├── lidar_intrinsics/
│   ├── sensor_extrinsics/
│   └── vehicle_dimensions/
├── labels/
│   ├── egomotion/
│   └── obstacle.offline/
└── metadata/
    ├── feature_presence.parquet    # Sensor availability per clip
    └── data_collection.parquet     # Country, time, weather filters
```

Each chunk ZIP contains ~100 clips. Files within are named `<clip_uuid>.<sensor_type>.<format>`, enabling cross-sensor mapping via UUID.

### 8.3 Accessing the Dataset

```bash
pip install physical_ai_av  # Python >= 3.11

# Authenticate
huggingface-cli login

# Use the developer kit for programmatic access
# See: https://github.com/NVlabs/physical_ai_av
```

The dataset is chunked to allow selective download. Use `feature_presence.parquet` to identify which clips have which sensors, and `data_collection.parquet` to filter by geography, weather, time of day, etc.

**Cosmos Dataset Search (CDS):** NVIDIA provides a text/video query tool for finding relevant clips: [build.nvidia.com/nvidia/cosmos-dataset-search](https://build.nvidia.com/nvidia/cosmos-dataset-search).

### 8.4 The 700K (Now 3M) Reasoning Traces

**Alpamayo 1 training data:**
- 700K Chain-of-Causation reasoning traces.
- ~10% (70K) human-labeled via a two-stage process:
  - **Stage I:** Annotators identify observable causal factors from 0-2 second history.
  - **Stage II:** Annotators select driving decisions and compose structured reasoning.
  - 0.5-second temporal buffers prevent causal confusion.
- ~90% (630K) auto-labeled using GPT-5 with structured prompting:
  - Input: structured state sequences and meta-actions at 10 Hz.
  - Output: extracted causes and synthesized CoC traces.
  - Quality assurance: secondary review and 10-20% audit sampling.
  - LLM judge agreement with human evaluation: **92%**.

**Alpamayo 1.5 training data:**
- **3M** Chain-of-Causation reasoning traces (4.3x increase).
- Human + VLM-generated mix.
- Enhanced with reasoning traces from 16 public datasets including nuScenes, CODA-LM, DriveLM, DriveGPT4.

**Additional training data:**
- 80,000 hours of multi-camera driving video (>1 billion images).
- Text tokens: <1 billion (CoC traces + Cosmos-Reason training data).
- NVIDIA proprietary autonomous driving data (not publicly available).

### 8.5 Availability Summary

| Data Component | Public? | Where |
|----------------|---------|-------|
| 306K raw sensor clips (camera, LiDAR, radar) | Yes (gated) | [HuggingFace](https://huggingface.co/datasets/nvidia/PhysicalAI-Autonomous-Vehicles) |
| Egomotion labels | Yes (gated) | Same dataset |
| Obstacle labels (auto-generated) | Yes (gated) | Same dataset |
| Calibration data | Yes (gated) | Same dataset |
| NuRec scenes for AlpaSim | Yes | [HuggingFace](https://huggingface.co/datasets/nvidia/PhysicalAI-Autonomous-Vehicles-NuRec) |
| CoC reasoning traces (subset) | Yes (gated) | Released with high-quality manual labels |
| CoC auto-labeling pipeline | Coming soon | Announced with 1.5 release |
| OOD benchmark | Coming soon | Announced with 1.5 release |
| 80K hours training video | No | NVIDIA proprietary |
| Full 700K/3M CoC traces | Partial | Subset released; full set is proprietary |

The publicly available subset includes high-quality manually verified reasoning labels. The full auto-labeling pipeline for generating your own CoC traces is listed as "coming soon" in the Alpamayo 1.5 announcement.

---

## Appendix: Quick Reference

### Inference in 5 Minutes

```bash
# Clone and setup
git clone https://github.com/NVlabs/alpamayo1.5.git && cd alpamayo1.5
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
uv venv a1_5_venv && source a1_5_venv/bin/activate
uv sync --active
hf auth login

# Run inference
python src/alpamayo_r1/test_inference.py
```

### Key Performance Numbers

| Metric | Alpamayo 1 | Alpamayo 1.5 |
|--------|-----------|-------------|
| AlpaSim Score (910 scenarios) | 0.73 +/- 0.01 | 0.81 +/- 0.01 |
| Open-loop minADE_6 @ 6.4s | 1.22m | 1.11m |
| Lingo-Judge reasoning score | — | 74.2 |
| On-vehicle latency | 99 ms | 99 ms |
| Close encounter reduction (vs baseline) | — | 35% |
| Reasoning quality improvement (via RL) | — | 45% |
| Reasoning-action alignment improvement | — | 37% |

### Citation

```bibtex
@article{nvidia2025alpamayo,
  title={{Alpamayo-R1}: Bridging Reasoning and Action Prediction
         for Generalizable Autonomous Driving in the Long Tail},
  author={NVIDIA and Yan Wang and others},
  year={2025},
  journal={arXiv preprint arXiv:2511.00088}
}
```

---

## Sources

- [NVIDIA Alpamayo-R1-10B (HuggingFace)](https://huggingface.co/nvidia/Alpamayo-R1-10B)
- [NVIDIA Alpamayo-1.5-10B (HuggingFace)](https://huggingface.co/nvidia/Alpamayo-1.5-10B)
- [Alpamayo GitHub (NVlabs/alpamayo)](https://github.com/NVlabs/alpamayo)
- [Alpamayo 1.5 GitHub (NVlabs/alpamayo1.5)](https://github.com/NVlabs/alpamayo1.5)
- [AlpaSim GitHub (NVlabs/alpasim)](https://github.com/NVlabs/alpasim)
- [Physical AI AV Dataset (HuggingFace)](https://huggingface.co/datasets/nvidia/PhysicalAI-Autonomous-Vehicles)
- [Physical AI AV NuRec Dataset (HuggingFace)](https://huggingface.co/datasets/nvidia/PhysicalAI-Autonomous-Vehicles-NuRec)
- [arXiv:2511.00088 — Alpamayo-R1 Paper](https://arxiv.org/abs/2511.00088)
- [NVIDIA Developer Blog: Building AVs That Reason with Alpamayo](https://developer.nvidia.com/blog/building-autonomous-vehicles-that-reason-with-nvidia-alpamayo/)
- [HuggingFace Blog: Alpamayo Ecosystem](https://huggingface.co/blog/drmapavone/nvidia-alpamayo)
- [HuggingFace Blog: Alpamayo 1.5](https://huggingface.co/blog/drmapavone/nvidia-alpamayo-1-5)
- [NVIDIA Newsroom: Alpamayo Announcement](https://nvidianews.nvidia.com/news/alpamayo-autonomous-vehicle-development)
- [NVIDIA Developer: Alpamayo Product Page](https://developer.nvidia.com/drive/alpamayo)
- [NVIDIA Open Model License](https://www.nvidia.com/en-us/agreements/enterprise-software/nvidia-open-model-license/)
- [NVIDIA Developer Blog: TensorRT Edge-LLM](https://developer.nvidia.com/blog/accelerating-llm-and-vlm-inference-for-automotive-and-robotics-with-nvidia-tensorrt-edge-llm)
- [NVIDIA Developer Blog: Edge-First LLMs for Physical AI](https://developer.nvidia.com/blog/build-next-gen-physical-ai-with-edge-first-llms-for-autonomous-vehicles-and-robotics/)
- [Cosmos-Reason GitHub](https://github.com/nvidia-cosmos/cosmos-reason1)
- [AlpaSim Tutorial](https://github.com/NVlabs/alpasim/blob/main/docs/TUTORIAL.md)
- [Physical AI AV Developer Kit](https://github.com/NVlabs/physical_ai_av)
