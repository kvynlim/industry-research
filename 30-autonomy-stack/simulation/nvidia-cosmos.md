# NVIDIA Cosmos World Foundation Models: Comprehensive Guide

## Table of Contents

1. [Cosmos Model Family Overview](#1-cosmos-model-family-overview)
2. [Getting Started](#2-getting-started)
3. [Cosmos Tokenizer Deep Dive](#3-cosmos-tokenizer-deep-dive)
4. [Fine-Tuning for Airside Operations](#4-fine-tuning-for-airside-operations)
5. [Synthetic Data Generation](#5-synthetic-data-generation)
6. [Integration with Omniverse and Isaac Sim](#6-integration-with-omniverse-and-isaac-sim)
7. [Cosmos + Alpamayo Relationship](#7-cosmos--alpamayo-relationship)
8. [Licensing Details](#8-licensing-details)

---

## 1. Cosmos Model Family Overview

NVIDIA Cosmos is a developer-first platform of world foundation models (WFMs), tokenizers, guardrails, and data curation pipelines purpose-built for Physical AI. The platform was first launched at CES 2025 and has undergone rapid iteration through 2025-2026. Cosmos WFMs are general-purpose models designed to be fine-tuned into customized world models for autonomous vehicles, robotics, and video analytics.

The platform was trained on approximately **20 million hours of video** (9,000 trillion tokens) using a cluster of **10,000 NVIDIA H100 GPUs over three months**.

### 1.1 Cosmos-Predict (Video Generation / World Simulation)

Cosmos-Predict models simulate and predict the future state of the world in the form of video. Three generations exist:

#### Cosmos-Predict2.5 (Latest)

A flow-based model that unifies Text2World, Image2World, and Video2World into a single architecture. Uses Cosmos-Reason1 as its text encoder for improved prompt alignment.

| Checkpoint | Parameters | Task | VRAM (Inference) |
|---|---|---|---|
| Cosmos-Predict2.5-2B | 2B | Text2World, Image2World, Video2World | ~27 GB |
| Cosmos-Predict2.5-14B | 14B | Text2World, Image2World, Video2World | ~50 GB |
| Cosmos-Predict2.5-2B-Distilled | 2B | Text2World only | ~20 GB |
| Cosmos-Predict2.5-Auto-Multiview | 2B/14B | AV 7-camera multiview | 8x80 GB GPUs min |
| Cosmos-Predict2.5-Robot-Action-Cond | 2B | Action-conditioned robot video | Single GPU |
| Cosmos-Predict2.5-Robot-Multiview-Agibot | 2B | 3-camera AgiBot multiview | Multi-GPU |
| Cosmos-Predict2.5-Robot-Policy | 2B | Libero/RoboCasa manipulation | Single GPU |

#### Cosmos-Predict2

Diffusion transformer models for video denoising in latent space, composed of interleaved self-attention, cross-attention, and feedforward layers.

| Checkpoint | Parameters | Task | VRAM (Inference) |
|---|---|---|---|
| Cosmos-Predict2-2B-Text2Image | 2B | Text-to-image | 26.02 GB |
| Cosmos-Predict2-14B-Text2Image | 14B | Text-to-image | 48.93 GB |
| Cosmos-Predict2-2B-Video2World | 2B | Video continuation | 32.54 GB |
| Cosmos-Predict2-14B-Video2World | 14B | Video continuation | 56.38 GB |
| Cosmos-Predict2-2B-Sample-Action-Conditioned | 2B | Action-conditioned | ~32 GB |

#### Cosmos-Predict1

Original general-purpose WFMs available in two architecture families:

- **Diffusion models**: 7B and 14B parameters, using continuous tokens
- **Autoregressive models**: 4B and 12B parameters (Llama3-style GPT), using discrete tokens

The diffusion models use EDM-based denoising score matching. The autoregressive models use cross-attention layers with T5 embeddings and include a diffusion decoder to upgrade discrete tokens (DV8x16x16) to continuous tokens (CV8x8x8).

### 1.2 Cosmos-Transfer (Controlled World Generation)

Cosmos-Transfer produces high-quality world simulations conditioned on multiple spatial control inputs. It is built on top of Cosmos-Predict.

#### Cosmos-Transfer2.5

A multi-controlnet model accepting structured video input of multiple modalities:

| Control Input | Description |
|---|---|
| Depth maps | Spatial structure preservation |
| Canny edge maps | Boundary and geometric precision |
| Semantic segmentation | Object identification and class preservation |
| Visual blur | Motion and focus representation |

**Key capabilities:**
- Multi-control: combine multiple control inputs simultaneously via JSON-based `controlnet_specs`
- Spatiotemporal masks: define binary masks for per-region control application
- Automatic extraction: edge and blur controls can be auto-extracted from RGB video
- Sim2Real: transform simulator outputs (CARLA, Isaac Sim, Omniverse) into photorealistic video

| Checkpoint | Parameters | Notes |
|---|---|---|
| Cosmos-Transfer2.5-2B | 2B | Base multi-controlnet |
| Cosmos-Transfer2.5-2B-Distilled | 2B | Faster inference, reduced latency |
| Cosmos-Transfer2.5-Auto-Multiview | 2B | AV-specific multi-camera |

#### Cosmos-Transfer1

Diffusion-based conditional models with weighted spatial-temporal control inputs. 7B parameter model.

### 1.3 Cosmos-Reason (Physical AI Reasoning)

Vision language models that understand physical common sense and generate embodied decisions through chain-of-thought reasoning.

#### Cosmos-Reason2

Built on Qwen3-VL architecture, post-trained with physical common sense and embodied reasoning data using SFT and RL.

| Checkpoint | Parameters | VRAM | Architecture Base |
|---|---|---|---|
| Cosmos-Reason2-2B | 2B | 24 GB min | Qwen3-VL-2B-Instruct |
| Cosmos-Reason2-8B | 8B | 32 GB min | Qwen3-VL-8B-Instruct |

**Capabilities:**
- Spatio-temporal understanding with timestamp precision
- Object detection with 2D/3D point localization and bounding box coordinates
- Long-context understanding up to 256K input tokens
- Video captioning and temporal localization
- Embodied reasoning for robotic planning
- Chain-of-thought reasoning with explanations

#### Cosmos-Reason1

7B parameter reasoning VLM for spatial-temporal understanding. Serves as the text encoder backbone in Cosmos-Predict2.5.

### 1.4 Cosmos-Tokenizer

A suite of image and video neural tokenizers achieving up to **2048x compression** (see Section 3 for full details).

### 1.5 Cosmos-Curator (Data Pipeline)

Accelerated data processing and curation pipeline:
- **89x faster** than CPU-based pipelines
- Handles 100+ PB of data
- Processed 20M video hours in 40 days on Hopper GPUs (14 days on Blackwell)
- Modular pipelines: splitting, captioning, filtering, deduplication, task-specific sampling

### 1.6 Cosmos Guardrails

Two-stage safety framework:
- **Pre-Guard**: keyword blocking via lemmatization, NVIDIA Aegis AI Content Safety model
- **Post-Guard**: video content safety classifier, RetinaFace-based face blurring
- Over 10,000 prompt-video pairs annotated for refinement

---

## 2. Getting Started

### 2.1 Hardware Requirements

| Component | Minimum | Recommended |
|---|---|---|
| GPU Architecture | Ampere (RTX 30 Series, A100) | Hopper (H100) or Blackwell (GB200) |
| GPU Memory (2B inference) | 27 GB | 48 GB (A100-48GB) |
| GPU Memory (14B inference) | 50 GB | 80 GB (H100-80GB, A100-80GB) |
| GPU Memory (Post-training) | 80 GB per GPU | 8x H100-80GB |
| Multiview Inference | 8x 80 GB GPUs | 8x H100-80GB |
| NVIDIA Driver | >= 570.124.06 | Latest |
| CUDA | 12.8.1 | 12.8.1 or 13.0 |
| OS | Linux x86-64, glibc >= 2.35 | Ubuntu 22.04 or 24.04 |

**Cosmos-Reason2 validated platforms:**
- H100 (CUDA 12.8)
- GB200 (CUDA 13.0)
- DGX Spark (CUDA 13.0)
- Jetson AGX Thor (CUDA 13.0)

### 2.2 Repository Structure

All Cosmos repositories live under the `nvidia-cosmos` GitHub organization:

```
github.com/nvidia-cosmos/
├── cosmos-predict2.5     # Latest prediction models
├── cosmos-predict2       # Previous prediction models
├── cosmos-predict1       # Original prediction models (includes tokenizer)
├── cosmos-transfer2.5    # Latest transfer/control models
├── cosmos-transfer1      # Original transfer models
├── cosmos-reason2        # Latest reasoning models
├── cosmos-reason1        # Original reasoning models
├── cosmos-cookbook        # Post-training recipes and tutorials
└── cosmos-rl             # RL framework for Cosmos

github.com/NVIDIA/
├── Cosmos-Tokenizer      # Standalone tokenizer suite
└── Cosmos                # Legacy repo (redirects to nvidia-cosmos org)
```

### 2.3 Installation Option A: Virtual Environment with uv

```bash
# Install system dependencies
sudo apt update && sudo apt -y install curl ffmpeg libx11-dev tree wget

# Install Git LFS
sudo apt install git-lfs
git lfs install

# Clone repository (e.g., Predict2.5)
git clone git@github.com:nvidia-cosmos/cosmos-predict2.5.git
cd cosmos-predict2.5
git lfs pull

# Install uv and create environment
# (Install uv per https://docs.astral.sh/uv/getting-started/installation/)
uv python install
uv sync --extra=cu128    # For CUDA 12.8
# OR
uv sync --extra=cu130    # For CUDA 13.0 (DGX Spark, Jetson AGX)
source .venv/bin/activate
```

### 2.4 Installation Option B: Docker

```bash
# Build container
image_tag=$(docker build -f Dockerfile -q .)

# For Blackwell architecture
image_tag=$(docker build -f docker/nightly.Dockerfile -q .)

# Run container
docker run -it --runtime=nvidia --ipc=host --rm \
  -v .:/workspace \
  -v /workspace/.venv \
  -v /root/.cache:/root/.cache \
  -e HF_TOKEN="$HF_TOKEN" \
  $image_tag
```

Pre-built Docker images are also available:
```bash
docker pull nvcr.io/nvidia/cosmos/cosmos-predict2-container:1.1
```

### 2.5 Installation Option C: Conda (for Predict2)

```bash
git clone git@github.com:nvidia-cosmos/cosmos-predict2.git
cd cosmos-predict2
conda env create --file cosmos-predict2.yaml
conda activate cosmos-predict2
# Install flash-attn, transformer-engine, NATTEN
```

### 2.6 Model Checkpoint Access

```bash
# Install Hugging Face CLI
uv tool install -U "huggingface_hub[cli]"
# OR
pip install huggingface_hub[cli]

# Authenticate (need Read-permission token)
hf auth login

# Accept NVIDIA Open Model License on HuggingFace model page
# Checkpoints auto-download during first inference/training run
# Customize cache location:
export HF_HOME=/path/to/cache
```

### 2.7 Running Inference

#### Text2World (generate video from text)

```bash
python examples/inference.py \
  -i assets/base/text_prompt.json \
  -o outputs/text2world \
  --inference-type=text2world
```

#### Image2World (extend image to video)

```bash
python examples/inference.py \
  -i assets/base/image_input.json \
  -o outputs/image2world \
  --inference-type=image2world
```

#### Video2World (continue/extend video)

```bash
python examples/inference.py \
  -i assets/base/robot_pouring.json \
  -o outputs/video2world \
  --inference-type=video2world
```

#### Multi-GPU inference (14B model)

```bash
torchrun --nproc_per_node=8 examples/inference.py \
  -i assets/base/robot_pouring.json \
  -o outputs/base_video2world \
  --inference-type=video2world
```

#### Batch inference

```bash
torchrun --nproc_per_node=8 examples/inference.py \
  -i assets/base/*.json \
  -o outputs/base
```

#### Select model variant

```bash
python examples/inference.py \
  -i assets/base/text_prompt.json \
  -o outputs/ \
  --model 2B/post-trained     # or 14B/post-trained or 2B/distilled
```

#### Autoregressive (extended videos)

```bash
python examples/inference.py \
  -i assets/base/bus_terminal_long.json \
  -o outputs/autoregressive
```

#### Input JSON format

```json
{
  "inference_type": "video2world",
  "name": "airport_scene",
  "prompt": "A ground-level view of an airport tarmac with baggage carts moving between parked aircraft. The scene shows clear weather with strong sunlight casting shadows on the concrete apron.",
  "input_path": "airport_video.mp4"
}
```

**Prompt tips:** Use concrete photography terminology. Emphasize physical realism and natural phenomena. Describe lighting, materials, and motion patterns explicitly.

### 2.8 Cosmos-Reason2 Inference

```python
# Using transformers (>= 4.57.0)
from transformers import AutoProcessor, AutoModelForImageTextToText
import torch

model_name = "nvidia/Cosmos-Reason2-8B"
model = AutoModelForImageTextToText.from_pretrained(
    model_name, torch_dtype=torch.bfloat16, device_map="auto"
)
processor = AutoProcessor.from_pretrained(model_name)
```

Production deployment via vLLM (>= 0.11.0) for online serving and batch inference.

---

## 3. Cosmos Tokenizer Deep Dive

### 3.1 Architecture

The Cosmos Tokenizer is a suite of image and video neural tokenizers that can be used independently from the rest of the Cosmos platform. It achieves state-of-the-art compression while maintaining high reconstruction quality.

**Core architecture elements:**

1. **Haar Wavelet Transform**: The encoder starts with a 2-level Haar wavelet transform that downsamples inputs by 4x in both spatial and temporal dimensions. The decoder ends with an inverse wavelet transform. This replaces learnable downsampling/upsampling layers.

2. **Spatio-temporal Factorized 3D Convolution**: Combines 2D spatial convolutions with temporal convolutions for efficient processing.

3. **Causal Temporal Design**: Uses causal temporal convolution and causal temporal attention layers that preserve natural temporal order. This enables joint image-video training and is critical for Physical AI systems that operate in temporal causal settings.

4. **Causal Self-Attention**: Applied across temporal dimensions to model long-range dependencies while maintaining causality.

### 3.2 Latent Space Quantization

Two fundamentally different approaches:

| Approach | Latent Type | Dimensions | Quantizer | Use Case |
|---|---|---|---|---|
| **Continuous (C)** | Continuous embeddings | 16-channel latent | Vanilla Autoencoder (AE) | Diffusion model training |
| **Discrete (D)** | Token indices | 6-dimensional FSQ | Finite-Scalar-Quantization | Autoregressive model training |

**Why FSQ instead of VQ-VAE?** FSQ avoids VQ-VAE's commitment loss, codebook collapse, and complex training dynamics. The discrete tokenizer uses a 6-dimensional FSQ space yielding a vocabulary size of ~64,000 tokens.

### 3.3 Available Tokenizer Models

| Model | Type | Spatial | Temporal | Total Compression |
|---|---|---|---|---|
| Cosmos-0.1-Tokenizer-CI8x8 | Continuous Image | 8x8 | N/A | 64x |
| Cosmos-0.1-Tokenizer-CI16x16 | Continuous Image | 16x16 | N/A | 256x |
| Cosmos-0.1-Tokenizer-DI8x8 | Discrete Image | 8x8 | N/A | 64x |
| Cosmos-0.1-Tokenizer-DI16x16 | Discrete Image | 16x16 | N/A | 256x |
| Cosmos-0.1-Tokenizer-CV4x8x8 | Continuous Video | 8x8 | 4x | 256x |
| Cosmos-0.1-Tokenizer-CV8x8x8 | Continuous Video | 8x8 | 8x | 512x |
| Cosmos-0.1-Tokenizer-CV8x16x16 | Continuous Video | 16x16 | 8x | 2048x |
| Cosmos-0.1-Tokenizer-DV4x8x8 | Discrete Video | 8x8 | 4x | 256x |
| Cosmos-0.1-Tokenizer-DV8x8x8 | Discrete Video | 8x8 | 8x | 512x |
| Cosmos-0.1-Tokenizer-DV8x16x16 | Discrete Video | 16x16 | 8x | 2048x |
| Cosmos-1.0-Tokenizer-CV8x8x8 | Continuous Video | 8x8 | 8x | 512x |
| Cosmos-1.0-Tokenizer-DV8x16x16 | Discrete Video | 16x16 | 8x | 2048x |

**Performance**: 8x more total compression than SOTA methods, while running up to 12x faster.

### 3.4 Using the Tokenizer

Each checkpoint provides three JIT-compiled components:
- `encoder.jit` — encode images/video to latent space
- `decoder.jit` — decode latents back to pixels
- `autoencoder.jit` — combined encode-decode

#### Continuous Video Encoding

```python
import torch
from cosmos_tokenizer.video_lib import CausalVideoTokenizer

model_name = "Cosmos-0.1-Tokenizer-CV4x8x8"
input_tensor = torch.randn(1, 3, 9, 512, 512).to('cuda').to(torch.bfloat16)
# Input shape: (batch, channels, frames, height, width)

encoder = CausalVideoTokenizer(
    checkpoint_enc=f'pretrained_ckpts/{model_name}/encoder.jit'
)
(latent,) = encoder.encode(input_tensor)
# Output shape: (1, 16, 3, 64, 64) — 16 latent channels
```

#### Discrete Video Encoding

```python
model_name = "Cosmos-0.1-Tokenizer-DV4x8x8"
encoder = CausalVideoTokenizer(
    checkpoint_enc=f'pretrained_ckpts/{model_name}/encoder.jit'
)
(indices, codes) = encoder.encode(input_tensor)
# indices shape: (1, 3, 64, 64) — token values in [1..64K]
# codes shape: (1, 6, 3, 64, 64) — 6-dim FSQ quantization levels
```

#### Full Encode-Decode Round Trip

```python
tokenizer = CausalVideoTokenizer(
    checkpoint=f'pretrained_ckpts/{model_name}/autoencoder.jit'
)
reconstructed = tokenizer(input_tensor)
# reconstructed has same shape as input_tensor
```

### 3.5 Using Cosmos Tokenizer as a VQ-VAE for Custom World Models

This is one of the most valuable applications for building your own world model. The Cosmos Tokenizer can serve as the visual encoder/decoder backbone in a custom autoregressive or diffusion-based world model:

**Architecture pattern for a custom driving world model:**

```
Camera frames → Cosmos Tokenizer (encoder) → Latent tokens
                                                    ↓
                                    Your custom transformer/diffusion model
                                    (trained on your airside driving data)
                                                    ↓
                                              Predicted latent tokens
                                                    ↓
                              Cosmos Tokenizer (decoder) → Predicted future frames
```

**Recommended tokenizer choices by use case:**

| Your World Model Architecture | Recommended Tokenizer | Why |
|---|---|---|
| Autoregressive transformer (like GPT) | DV8x16x16 (discrete) | Discrete tokens feed naturally into next-token prediction |
| Diffusion model | CV8x8x8 (continuous) | Continuous latents required for diffusion denoising |
| Lightweight/real-time | CV4x8x8 (continuous) | Lower temporal compression = easier prediction task |
| Maximum compression | DV8x16x16 or CV8x16x16 | 2048x compression, smallest latent sequences |

**Steps to use in your own pipeline:**

1. **Pre-tokenize your dataset**: Run the encoder over all your training videos to produce latent representations. Store these on disk to avoid re-encoding during training.
2. **Train your world model** in latent space: Your model learns to predict future latent tokens given past tokens (plus any conditioning like actions, ego-state, etc.).
3. **Decode predictions**: Use the decoder to convert predicted latents back to pixel space for visualization or downstream use.

### 3.6 Fine-Tuning the Tokenizer

The tokenizer itself can be fine-tuned on domain-specific data (e.g., airside video footage) to improve reconstruction quality in your domain.

```bash
# Prepare dataset: collect MP4 videos (720p preferred)
# Register in dataset_provider.py:
#   "airside_video": "datasets/airside/videos/*.mp4"

# Run tokenizer post-training (8 GPUs)
torchrun --nproc_per_node=8 -m cosmos_predict1.tokenizer.training.train \
    --config=cosmos_predict1/tokenizer/training/configs/config.py -- \
    experiment=Cosmos_Tokenize1_CV8x8x8_720p_AIRSIDE
```

Output checkpoints include separate encoder and decoder JIT files:
```
checkpoints/posttraining/tokenizer/[MODEL_NAME]/checkpoints/
├── iter_{N}.pt
├── iter_{N}_enc.jit
├── iter_{N}_dec.jit
└── iter_{N}_ema.jit
```

---

## 4. Fine-Tuning for Airside Operations

### 4.1 Can You Fine-Tune on Custom Driving Data?

**Yes.** Cosmos is explicitly designed for domain-specific post-training. NVIDIA provides multiple post-training approaches, and all model families (Predict, Transfer, Reason) support customization.

### 4.2 Post-Training Approaches

| Method | What It Does | GPU Requirements | When to Use |
|---|---|---|---|
| **LoRA** | Trains ~1-2% of parameters via low-rank adapters | 8x GPUs (80GB each recommended) | Domain adaptation with limited compute |
| **Full SFT** | Updates all model weights | 8x H100-80GB or more | Maximum quality, large dataset available |
| **Action-Conditioned** | Adds action inputs (steering, velocity) to Video2World | 1+ GPU (80GB) | Controllable driving simulation |
| **Distillation (DMD2)** | Compresses model for faster inference | 8x GPUs | Edge deployment |
| **RL Post-Training** | Reinforcement learning optimization | Multi-node GPU clusters | Aligning with reward signals |

### 4.3 LoRA Fine-Tuning Recipe (Recommended Starting Point)

This is the most practical approach for adapting Cosmos to airside driving data.

#### Step 1: Prepare Your Data

```
datasets/airside/
├── metas/
│   └── *.txt          # One prompt file per video
└── videos/
    └── *.mp4          # 720p MP4 videos, any length
```

Each `.txt` file contains a text description of the corresponding video. Example prompt:
```
A ground-level view from an autonomous vehicle driving on an airport apron.
Yellow baggage tugs cross the path ahead. A Boeing 737 is parked at a jet bridge
on the right. Ground markings show taxiway centerlines in yellow paint.
Clear weather with harsh midday sunlight.
```

#### Step 2: Generate Prompt Files

```bash
python -m scripts.create_prompts_for_nemo_assets \
    --dataset_path datasets/airside \
    --prompt "A video of airport airside ground operations with vehicles and aircraft."
```

#### Step 3: Configure LoRA Training

Key parameters in the configuration:

```python
model = dict(
    config = dict(
        use_lora=True,
        lora_rank=32,           # Higher rank = more capacity, more VRAM
        lora_alpha=32,          # Typically equal to rank
        lora_target_modules="q_proj,k_proj,v_proj,output_proj,mlp.layer1,mlp.layer2",
        init_lora_weights=True,
    ),
)

dataloader = dict(
    dataset=dict(
        dataset_dir="datasets/airside",
        num_frames=93,           # Standard frame count
        video_size=(704, 1280),  # 720p
    ),
    batch_size=1,
    num_workers=4,
    pin_memory=True,
)
```

#### Step 4: Launch Training

```bash
# Set output directory (default is /tmp/imaginaire4-output)
export IMAGINAIRE_OUTPUT_ROOT=/data/cosmos_training

# Launch LoRA training on 8 GPUs
torchrun --nproc_per_node=8 scripts/train.py \
  --config=cosmos_predict2/_src/predict2/configs/video2world/config.py \
  -- experiment=predict2_video2world_lora_training_2b_airside
```

#### Step 5: Convert and Run Inference

```bash
# Find latest checkpoint
CHECKPOINTS_DIR=${IMAGINAIRE_OUTPUT_ROOT}/cosmos_predict_v2p5/video2world_lora/2b_airside/checkpoints
CHECKPOINT_ITER=$(cat $CHECKPOINTS_DIR/latest_checkpoint.txt)
CHECKPOINT_DIR=$CHECKPOINTS_DIR/$CHECKPOINT_ITER

# Convert DCP to PyTorch format
python scripts/convert_distcp_to_pt.py $CHECKPOINT_DIR/model $CHECKPOINT_DIR
# Produces: model.pt, model_ema_fp32.pt, model_ema_bf16.pt

# Run inference with LoRA weights
torchrun --nproc_per_node=8 examples/inference.py \
  assets/airside/test_scene.json \
  outputs/airside_generation \
  --checkpoint-path $CHECKPOINT_DIR/model_ema_bf16.pt \
  --experiment predict2_video2world_lora_training_2b_airside
```

### 4.4 Action-Conditioned Fine-Tuning

For controllable world simulation where you want to input vehicle actions (steering, throttle, brake) and predict the resulting video:

#### Data Format

```
datasets/airside_actions/
├── annotations/
│   └── scene_001.json    # Per-frame action annotations
└── videos/
    └── scene_001.mp4     # Corresponding video
```

Each annotation JSON contains:
```json
{
  "state": [x, y, z, roll, pitch, yaw],
  "action": [dx, dy, dz, droll, dpitch, dyaw, gripper_or_brake],
  "continuous_gripper_state": 0
}
```

For driving, you would adapt the 7-dimensional action vector to represent your vehicle's control space (e.g., `[steering_angle, throttle, brake, 0, 0, 0, 0]` or full 6-DoF ego-motion deltas).

#### Training Command

```bash
torchrun --nproc_per_node=1 --master_port=12341 -m scripts.train \
  --config=cosmos_predict2/_src/predict2/action/configs/action_conditioned/config.py \
  -- experiment=ac_reason_embeddings_rectified_flow_2b_256_320
```

**Key training parameters:**
- Learning rate: ~3.05e-05 (2^(-14.5))
- Weight decay: 0.1
- Input resolution: 480x640
- Frame count: 13 frames
- Base model: Cosmos-Predict2-2B-Video2World

### 4.5 Airside-Specific Fine-Tuning Strategy

**Recommended approach for airport autonomous vehicles:**

1. **Start with LoRA on Cosmos-Predict2.5-2B** using your recorded airside driving footage:
   - Record 720p video from your vehicle cameras during normal operations
   - Annotate with text descriptions of scenes (can use Cosmos-Reason2 to auto-caption)
   - Fine-tune with LoRA rank 32-64 for domain adaptation

2. **Add action conditioning** if you need controllable simulation:
   - Log ego-vehicle pose (position + orientation) alongside video
   - Compute frame-to-frame deltas as action vectors
   - Fine-tune the action-conditioned variant

3. **Use Cosmos-Transfer2.5** for weather/lighting augmentation:
   - Take your real airside footage
   - Generate variants with rain, fog, night, dawn conditions
   - Multiply your dataset 10-18x

4. **Deploy Cosmos-Reason2** for auto-labeling:
   - Generate captions describing scenes
   - Identify objects (aircraft, tugs, ground crew, vehicles)
   - Detect anomalies and safety-critical scenarios

### 4.6 GPU Budget Planning

| Task | Minimum Setup | Recommended Setup |
|---|---|---|
| Inference (2B) | 1x RTX 4090 (24GB) | 1x A100-40GB |
| Inference (14B) | 1x A100-80GB | 2x A100-80GB |
| LoRA post-training (2B) | 4x A100-40GB | 8x H100-80GB |
| Full SFT (2B) | 8x A100-80GB | 8x H100-80GB |
| Action-conditioned training | 1x A100-80GB | 4x H100-80GB |
| Multiview AV inference | 8x A100-80GB | 8x H100-80GB |
| Tokenizer post-training | 8x A100-40GB | 8x H100-80GB |
| Cosmos-Reason2 (8B) inference | 1x RTX 4090 (24GB) | 1x A100-40GB |
| Cosmos-Reason2 post-training | 4x A100-80GB | 4x H100-80GB |

---

## 5. Synthetic Data Generation

### 5.1 Text-Conditioned Generation for Airport Scenes

Use Cosmos-Predict2.5 to generate novel airport scenarios from text descriptions:

```json
{
  "inference_type": "text2world",
  "name": "airport_night_rain",
  "prompt": "A first-person view from a low autonomous vehicle driving on a wet airport tarmac at night. Reflections of blue taxiway lights shimmer on the wet concrete surface. A large commercial aircraft with illuminated windows is visible ahead, connected to a jet bridge. Yellow ground service equipment crosses the path from left to right. Rain droplets are visible on the camera lens. The scene has strong contrast between dark sky and artificial lighting."
}
```

```bash
python examples/inference.py \
  -i assets/airside/airport_night_rain.json \
  -o outputs/synthetic_airside \
  --inference-type=text2world \
  --model 14B/post-trained
```

### 5.2 Action-Conditioned Generation

Generate video conditioned on specific driving actions (requires action-conditioned model):

```bash
# After fine-tuning on your action-conditioned data:
python examples/inference.py \
  -i assets/airside/action_conditioned_scene.json \
  -o outputs/action_conditioned \
  --inference-type=video2world
```

The action-conditioned model takes:
- An initial frame (real camera image from your vehicle)
- A sequence of action vectors (steering, throttle, brake over time)
- And predicts the resulting video

This enables "what-if" simulation: what would the world look like if the vehicle turned left vs. continued straight?

### 5.3 Cosmos-Drive-Dreams Pipeline

NVIDIA's dedicated synthetic driving data generation pipeline, built on Cosmos WFMs. Released as open-source under Apache 2.0.

**Pipeline stages:**

```
Stage 1: Condition Video Preprocessing
  ├── HDMap rendering (CPU, 2D projection)
  ├── LiDAR depth rendering (GPU)
  └── World Scenario rendering (GPU, 3D geometry + lanes + bboxes)
          ↓
Stage 2: Prompt Augmentation
  └── VLM (Qwen3) generates diverse text variations
          ↓
Stage 3: Single-View Video Generation
  └── Cosmos-Transfer1-7B-Sample-AV generates front-view 121-frame RGB
          ↓
Stage 4: Multi-View Extension
  └── Cosmos-7B-Single2MultiView extends to multi-camera
          ↓
Stage 5: Quality Filtering
  └── VLM-based quality assessment
```

**Released dataset**: 81,802 synthetic video clips from 5,843 base 10-second clips with labels (HDMap, bounding boxes, LiDAR).

**Generating synthetic driving data:**

```bash
# Clone Drive-Dreams
git clone https://github.com/nv-tlabs/Cosmos-Drive-Dreams.git
cd Cosmos-Drive-Dreams

# Stage 1: Render condition videos from structured labels
cd cosmos-drive-dreams-toolkits
python render_from_rds_hq.py -i ../assets/example -o ../outputs \
  -d rds_hq_mv --skip lidar --skip world_scenario

# Stage 2: Augment prompts for diversity
python scripts/rewrite_caption.py -i assets/example/captions \
  -o outputs/captions

# Stage 3: Generate single-view video
PYTHONPATH="cosmos-transfer1" python scripts/generate_video_single_view.py \
  --caption_path outputs/captions --input_path outputs \
  --video_save_folder outputs/single_view \
  --checkpoint_dir checkpoints/ --is_av_sample
```

**Adapting for airport operations**: The Drive-Dreams pipeline uses Waymo Open Dataset format. To use with airside data, you would need to:
1. Convert your sensor data to the RDS-HQ format (camera images, LiDAR, HD maps, object annotations)
2. Create airport-specific HD map renderings (taxiway lines, apron markings, gate positions)
3. Annotate bounding boxes for airport-specific objects (aircraft, ground service equipment, pedestrians)

### 5.4 Sim2Real with Cosmos-Transfer2.5

Transform simulator outputs into photorealistic scenes while preserving ground truth labels. This is particularly powerful for creating diverse training data from a single simulated scenario.

**The CARLA Sim2Real recipe demonstrates:**

1. Generate a driving scenario in CARLA (or your simulator)
2. Extract depth maps, segmentation masks, edge maps
3. Use Cosmos-Reason1-7B to caption the scene
4. Use Llama-3.1-8B to create augmentation-specific prompts
5. Run Cosmos-Transfer2.5 to generate photorealistic variants

**18 augmentation types supported:**

| Category | Variants |
|---|---|
| Lighting | Sunrise, sunset, twilight, golden hour, blue hour, night |
| Weather | Clear, overcast, snow, rain, fog |
| Road Surface | Dry, snow-covered, sand, puddles |

**Control type selection:**

| Control | Best For |
|---|---|
| Depth | Spatial consistency, night scenes, fog |
| Segmentation | Object boundary preservation, bright daylight |
| Edge | Geometric precision, heavy snowfall |

**Configuration example:**

```json
{
    "prompt_path": "assets/airport_scene/prompt.json",
    "output_dir": "outputs/airport_depth",
    "video_path": "assets/airport_scene/sim_input.mp4",
    "control_weight": 1.0,
    "depth": {
        "control_path": "assets/airport_scene/depth/sim_depth.mp4"
    }
}
```

**Key result**: 100% anomaly/behavior preservation across all variations with pixel-accurate bounding-box alignment to original simulator data.

### 5.5 Cosmos Cookbook Recipes Relevant to AV/Driving

The Cosmos Cookbook provides ready-to-run recipes:

**Inference recipes:**
- Text2Image synthetic data for intelligent transportation systems (ITS)
- CARLA Sim2Real augmentation for traffic scenarios
- Weather augmentation for simulation data
- Style-guided video generation

**Post-training recipes:**
- Traffic anomaly generation with improved realism
- Multiview AV generation with world scenario maps
- 3D AV grounding (Cosmos-Reason2)
- AV video caption VQA
- Intelligent transportation scene understanding

**End-to-end workflows:**
- Smart City SDG: complete traffic scenario pipeline using CARLA

Access at: https://nvidia-cosmos.github.io/cosmos-cookbook/

---

## 6. Integration with Omniverse and Isaac Sim

### 6.1 The Ecosystem

NVIDIA's Physical AI stack forms a three-layer architecture:

```
Layer 3: AI Models
  ├── Cosmos WFMs (Predict, Transfer, Reason)
  ├── Alpamayo (AV reasoning)
  └── GR00T (Robot foundation models)

Layer 2: Simulation Platform
  ├── NVIDIA Omniverse (3D collaboration & rendering, OpenUSD)
  ├── Isaac Sim (robotics simulation, sensor simulation)
  └── DRIVE Sim (AV-specific simulation)

Layer 1: Infrastructure
  ├── DGX Cloud / DGX SuperPOD
  ├── NeMo Framework
  └── NVIDIA Container Toolkit
```

### 6.2 Omniverse + Cosmos Pipeline

The recommended pipeline for creating synthetic airside data:

1. **Build 3D Airport Scene in Omniverse**
   - Use OpenUSD to model your airport airside environment
   - Place SimReady assets: aircraft models, ground service equipment, vehicles, buildings
   - Configure physics: vehicle dynamics, object interactions
   - Set up camera sensors matching your real vehicle's camera configuration

2. **Simulate in Isaac Sim**
   - Run your AV stack in the simulated airport
   - Generate sensor data: cameras, LiDAR, radar
   - Record ground truth: bounding boxes, segmentation, depth, ego-pose
   - Create edge cases: near-misses, unusual vehicle behavior, FOD on tarmac

3. **Augment with Cosmos-Transfer2.5**
   - Take simulator RGB output + control signals (depth, segmentation)
   - Use Cosmos-Transfer2.5 to generate photorealistic variants
   - Vary weather (rain, fog, snow), lighting (dawn, dusk, night), surface conditions
   - Each simulated scenario yields 10-18x more training data

4. **Generate Novel Scenarios with Cosmos-Predict2.5**
   - Use text prompts to generate scenarios not easily built in simulation
   - Create rare events: aircraft pushback emergencies, equipment failures
   - Extend existing video clips into longer sequences

### 6.3 Neural Volume Rendering (NuRec)

NVIDIA Omniverse NuRec brings the real world into simulation:

- **Technologies**: Neural Radiance Fields (NeRFs), 3D Gaussian Splats (3DGS), 3D Gaussian Unscented Transforms (3DGUT)
- **Purpose**: Reconstruct real-world environments from multi-sensor data for photorealistic simulation
- **Application**: Record your actual airport with cameras/LiDAR, reconstruct as a neural scene, then simulate your AV within it

**For airside operations:**
1. Drive your data collection vehicle around the airport
2. Capture multi-camera + LiDAR data
3. Use NuRec to reconstruct the airport as a 3DGS scene
4. Import into Isaac Sim for physics-enabled simulation
5. Use Cosmos-Transfer to add environmental variations

### 6.4 NVIDIA Omniverse Blueprint for AV Simulation

A pre-built pipeline that combines:
- Omniverse for 3D scene composition
- Physically-based sensor simulation
- Cosmos-Transfer for dataset amplification
- Cosmos-Predict for novel scenario generation

Partners like Foretellix use this blueprint to enhance behavioral scenarios with varied conditions.

### 6.5 MobilityGen Workflows

For generating occupancy maps and trajectory data within Isaac Sim:
- Create occupancy grids from simulated environments
- Generate diverse trajectory datasets
- Combine with Cosmos-Transfer for Sim2Real augmentation

---

## 7. Cosmos + Alpamayo Relationship

### 7.1 What is Alpamayo?

Alpamayo is NVIDIA's family of open AI models, simulation tools, and datasets for reasoning-based autonomous vehicle development. Launched at CES 2026, it enables AVs to "think through rare scenarios, drive safely in complex environments, and explain their driving decisions."

### 7.2 Architectural Relationship

Alpamayo is built directly on top of Cosmos Reason:

```
Alpamayo 1.0 (10B total)
├── Cosmos-Reason1 backbone (8.2B parameters)
│   └── Spatial-temporal understanding, physical reasoning
└── Action Expert (2.3B parameters)
    └── Trajectory planning, driving actions

Alpamayo 1.5 (10B total)
├── Cosmos-Reason2 backbone (8B parameters)
│   └── Enhanced reasoning, RL post-trained
└── Action Expert (2B parameters)
    └── Navigation guidance, multi-camera support
```

**Key insight**: Cosmos-Reason is the "brain" that understands the physical world. Alpamayo adds the "motor cortex" that translates understanding into driving actions.

### 7.3 How They Work Together

```
                    ┌─────────────────────────────────┐
                    │     COSMOS ECOSYSTEM             │
                    │                                  │
 Real/Sim Data ────→ Cosmos-Curator (data curation)   │
                    │          ↓                       │
                    │ Cosmos-Tokenizer (compression)   │
                    │          ↓                       │
                    │ Cosmos-Predict2.5 (world sim)    │──→ Synthetic training data
                    │ Cosmos-Transfer2.5 (Sim2Real)    │──→ Augmented training data
                    │ Cosmos-Reason2 (understanding)   │──→ Auto-labels, captions
                    │          ↓                       │
                    └──────────┬──────────────────────┘
                               │
                    ┌──────────┴──────────────────────┐
                    │     ALPAMAYO ECOSYSTEM            │
                    │                                  │
                    │ Alpamayo 1.5 (reasoning + action)│
                    │   ├── Chain-of-thought reasoning │
                    │   ├── Trajectory planning        │
                    │   └── Decision explanation        │
                    │          ↓                       │
                    │ AlpaSim (closed-loop evaluation)  │
                    │   ├── 900+ pre-reconstructed     │
                    │   │   scenarios (NuRec)          │
                    │   ├── Vehicle dynamics            │
                    │   └── Reactive traffic agents     │
                    └─────────────────────────────────┘
```

### 7.4 Cosmos Supports Alpamayo Through:

1. **Synthetic Data Generation**: Use Cosmos-Predict2.5 and Cosmos-Transfer2.5 to generate training data for Alpamayo models
2. **Scene Understanding Backbone**: Cosmos-Reason2 is the vision-language backbone that gives Alpamayo its physical world understanding
3. **Auto-labeling**: Cosmos-Reason2 generates reasoning traces and captions for driving data
4. **Data Curation**: Cosmos-Curator processes the Physical AI Autonomous Vehicles dataset (1,727 hours, 100 TB, 25 countries)

### 7.5 Alpamayo Components

| Component | Description | Link |
|---|---|---|
| Alpamayo-1.5-10B | Chain-of-thought reasoning VLA model | huggingface.co/nvidia/Alpamayo-1.5-10B |
| Alpamayo-R1-10B | Original reasoning model | huggingface.co/nvidia/Alpamayo-R1-10B |
| AlpaSim | Closed-loop AV simulation platform | github.com/NVlabs/alpasim |
| Physical AI AV Dataset | 1,727 hours driving data, 100 TB | huggingface.co/datasets/nvidia/PhysicalAI-Autonomous-Vehicles |
| Post-training scripts | SFT and RL fine-tuning | github.com/NVlabs/alpamayo |

### 7.6 Relevance to Airside AV Development

For airport autonomous vehicles, the Cosmos + Alpamayo stack offers:

1. **Generate airport driving data** with Cosmos-Predict/Transfer (Section 5)
2. **Fine-tune Alpamayo** on your airside driving data for airport-specific reasoning
3. **Evaluate in AlpaSim** with reconstructed airport scenarios (NuRec)
4. **Use Alpamayo as teacher model** to distill reasoning into smaller, edge-deployable models
5. **Explain decisions** via chain-of-thought reasoning traces (critical for airport safety compliance)

The 24 GB VRAM minimum for Alpamayo 1.5 inference makes it deployable on NVIDIA AGX Orin or similar edge platforms.

---

## 8. Licensing Details

### 8.1 Dual License Structure

NVIDIA Cosmos uses a split licensing model:

| Component | License | Commercial Use |
|---|---|---|
| **Source code** (all repos) | Apache License 2.0 | Yes, fully permissive |
| **Model weights** (all WFMs) | NVIDIA Open Model License | Yes, with conditions |
| **Cosmos-Drive-Dreams** | Apache License 2.0 | Yes, fully permissive |
| **Cosmos Tokenizer** (code) | Apache License 2.0 | Yes, fully permissive |
| **Cosmos Tokenizer** (weights) | NVIDIA Open Model License | Yes, with conditions |

### 8.2 Apache 2.0 License (Source Code)

Standard Apache 2.0 terms:
- Free to use, modify, and distribute
- Commercial use permitted
- Patent grant included
- Must include license notice and attribution
- No trademark rights
- No warranty

### 8.3 NVIDIA Open Model License (Model Weights)

This is NOT Apache 2.0. Key provisions:

**Permitted:**
- Commercial use of models and derivative models
- Create and distribute derivative models
- Reproduce and distribute in any medium, with or without modifications
- Add your own copyright statements and license terms for modifications
- NVIDIA does not claim ownership of outputs generated using the models

**Required:**
- Provide recipients with a copy of the agreement
- Include attribution: "Licensed by NVIDIA Corporation under the NVIDIA Open Model License"
- Maintain substantially similar guardrails if you modify safety mechanisms

**Critical restriction — Guardrail Clause:**
> If you bypass, disable, reduce the efficacy of, or circumvent any technical limitation, safety guardrail or associated safety guardrail hyperparameter, encryption, security, digital rights management, or authentication mechanism contained in the Model **without a substantially similar Guardrail appropriate for your use case**, your rights under the NVIDIA Open Model License Agreement will **automatically terminate**.

This means:
- You cannot simply remove safety guardrails
- You CAN replace them with your own equivalent guardrails appropriate for your domain
- For airside AV use, you would need guardrails appropriate to your operational safety requirements

**Custom licensing**: Contact cosmos-license@nvidia.com for alternative arrangements.

### 8.4 Practical Implications for Airside AV Development

1. **Code modification**: Fully open under Apache 2.0. You can fork, modify, and redistribute the training/inference code freely.

2. **Model fine-tuning**: Permitted under NVIDIA Open Model License. Your fine-tuned models are "Derivative Models" that you own.

3. **Generated outputs**: NVIDIA claims no ownership over generated synthetic data. Your synthetic training data is yours.

4. **Guardrails**: You must maintain safety mechanisms. For airport AV use, replace the default content-safety guardrails with domain-appropriate safety checks (e.g., ensuring generated scenes don't depict unsafe aircraft operations that could confuse your perception model).

5. **Distribution**: If you ship models to customers, include the NVIDIA Open Model License and attribution.

6. **Alpamayo models**: Also under NVIDIA Open Model License with same terms.

7. **Physical AI Dataset**: Separate license terms — check the specific dataset license on Hugging Face.

---

## Appendix A: Quick Reference — All Cosmos GitHub Repositories

| Repository | URL | Purpose |
|---|---|---|
| cosmos-predict2.5 | github.com/nvidia-cosmos/cosmos-predict2.5 | Latest world prediction models |
| cosmos-predict2 | github.com/nvidia-cosmos/cosmos-predict2 | Previous gen prediction models |
| cosmos-predict1 | github.com/nvidia-cosmos/cosmos-predict1 | Original prediction + tokenizer |
| cosmos-transfer2.5 | github.com/nvidia-cosmos/cosmos-transfer2.5 | Controlled world generation |
| cosmos-transfer1 | github.com/nvidia-cosmos/cosmos-transfer1 | Original controlled generation |
| cosmos-reason2 | github.com/nvidia-cosmos/cosmos-reason2 | Physical AI reasoning VLM |
| cosmos-reason1 | github.com/nvidia-cosmos/cosmos-reason1 | Original reasoning VLM |
| cosmos-cookbook | github.com/nvidia-cosmos/cosmos-cookbook | Post-training recipes |
| cosmos-rl | github.com/nvidia-cosmos/cosmos-rl | RL framework |
| Cosmos-Tokenizer | github.com/NVIDIA/Cosmos-Tokenizer | Standalone tokenizer suite |
| Cosmos-Drive-Dreams | github.com/nv-tlabs/Cosmos-Drive-Dreams | Synthetic driving data pipeline |

## Appendix B: Quick Reference — HuggingFace Models

**Predict2.5:**
- nvidia/Cosmos-Predict2.5-2B
- nvidia/Cosmos-Predict2.5-14B

**Predict2:**
- nvidia/Cosmos-Predict2-2B-Text2Image
- nvidia/Cosmos-Predict2-14B-Text2Image
- nvidia/Cosmos-Predict2-2B-Video2World
- nvidia/Cosmos-Predict2-14B-Video2World
- nvidia/Cosmos-Predict2-2B-Sample-Action-Conditioned

**Transfer2.5:**
- nvidia/Cosmos-Transfer2.5-2B

**Reason2:**
- nvidia/Cosmos-Reason2-2B
- nvidia/Cosmos-Reason2-8B

**Tokenizer:**
- nvidia/Cosmos-0.1-Tokenizer-CI8x8
- nvidia/Cosmos-0.1-Tokenizer-CI16x16
- nvidia/Cosmos-0.1-Tokenizer-CV4x8x8
- nvidia/Cosmos-0.1-Tokenizer-CV8x8x8
- nvidia/Cosmos-0.1-Tokenizer-CV8x16x16
- nvidia/Cosmos-0.1-Tokenizer-DI8x8
- nvidia/Cosmos-0.1-Tokenizer-DI16x16
- nvidia/Cosmos-0.1-Tokenizer-DV4x8x8
- nvidia/Cosmos-0.1-Tokenizer-DV8x8x8
- nvidia/Cosmos-0.1-Tokenizer-DV8x16x16
- nvidia/Cosmos-1.0-Tokenizer-CV8x8x8
- nvidia/Cosmos-1.0-Tokenizer-DV8x16x16

**Alpamayo:**
- nvidia/Alpamayo-1.5-10B
- nvidia/Alpamayo-R1-10B

## Appendix C: Key Performance Benchmarks

**Cosmos-Predict2 inference times (Video2World at 480p/16FPS):**
- GB200: 3.39s (2B Text2Image)
- H100: varies by model
- NATTEN sparse attention: up to 2.5x speedup at 720p on Hopper/Blackwell

**Cosmos Tokenizer:**
- 8x more total compression than prior SOTA
- Up to 12x faster encoding/decoding than prior SOTA
- Up to 2048x total compression ratio (8x temporal, 16x16 spatial)

**Cosmos training data:**
- 20M hours of video (raw)
- ~100M curated video clips (2-60s each)
- Resolutions: 720p to 4K

**Physics evaluation (Cosmos Diffusion Text2World 7B):**
- Sampson error: 0.355 (vs 0.841 VideoLDM baseline)
- With 9-frame conditioning: 21.06 PSNR, 0.69 SSIM
