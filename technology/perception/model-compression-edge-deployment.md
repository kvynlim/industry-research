# Model Compression & Edge Deployment for Airside AV

## Unified Guide: From Research Models to Real-Time Orin Inference

**Last updated:** 2026-04-11

---

## Table of Contents

1. [The Edge Deployment Challenge](#1-the-edge-deployment-challenge)
2. [Compression Technique Taxonomy](#2-compression-technique-taxonomy)
3. [Quantization: PTQ vs QAT](#3-quantization-ptq-vs-qat)
4. [Knowledge Distillation](#4-knowledge-distillation)
5. [Pruning & Sparsity](#5-pruning--sparsity)
6. [Architecture-Aware Compression](#6-architecture-aware-compression)
7. [NVIDIA Model Optimizer (ModelOpt)](#7-nvidia-model-optimizer-modelopt)
8. [Model-Specific Recipes](#8-model-specific-recipes)
9. [TensorRT Deployment Pipeline](#9-tensorrt-deployment-pipeline)
10. [DLA Offloading Strategy](#10-dla-offloading-strategy)
11. [Multi-Model Orchestration on Orin](#11-multi-model-orchestration-on-orin)
12. [ROS Noetic Integration](#12-ros-noetic-integration)
13. [Validation & Safety](#13-validation--safety)
14. [Cost & Timeline](#14-cost--timeline)
15. [References](#15-references)

---

## 1. The Edge Deployment Challenge

### 1.1 The Gap Between Research and Production

| Model | Research GPU | Params | FP32 Latency | Target Orin Latency |
|-------|-------------|--------|-------------|-------------------|
| PTv3 (segmentation) | A100 | 46M | 85ms | <30ms |
| CenterPoint (detection) | V100 | 9M | 52ms | <15ms |
| BEVFusion (multi-modal) | A100 | 68M | 120ms | <40ms |
| DINOv2-L (backbone) | A100 | 304M | 45ms | <20ms |
| FlashOcc (occupancy) | A100 | 52M | 28ms | <15ms |
| FlatFormer (segmentation) | A100 | 18M | 35ms | <25ms |
| Alpamayo (VLA teacher) | 8×H100 | 10B | 2000ms | N/A (distill only) |

Research models run on A100/H100 GPUs with 40-80GB HBM and 300-700W TDP. NVIDIA Orin AGX provides 275 TOPS at 15-60W with 64GB unified memory. The **10-30x compute gap** requires systematic compression.

### 1.2 Aurrigo Orin Compute Budget

```
Available: 275 TOPS (INT8), 138 TFLOPS (FP16), 32GB or 64GB unified memory
Power envelope: 15W (min) to 60W (max) — airside vehicles are electric, power matters

Allocated per 100ms perception cycle (10Hz):
┌─────────────────────────────────┬──────────┬──────────┐
│ Component                        │ Latency  │ Memory   │
├─────────────────────────────────┼──────────┼──────────┤
│ LiDAR preprocessing              │ 5ms      │ 0.5 GB   │
│ 3D Segmentation (FlatFormer)     │ 25ms     │ 1.5 GB   │
│ 3D Detection (CenterPoint)       │ 12ms     │ 1.0 GB   │
│ Tracking (Kalman + association)   │ 3ms      │ 0.2 GB   │
│ Occupancy grid (nvblox)           │ 10ms     │ 1.0 GB   │
│ Localization (GTSAM)              │ 8ms      │ 0.5 GB   │
│ Planning (Frenet)                 │ 5ms      │ 0.3 GB   │
│ Safety monitoring                 │ 2ms      │ 0.1 GB   │
├─────────────────────────────────┼──────────┼──────────┤
│ TOTAL                             │ 70ms     │ 5.1 GB   │
│ Headroom                          │ 30ms     │ 58.9 GB  │
└─────────────────────────────────┴──────────┴──────────┘
```

**Key constraint**: Multiple models share the GPU. Even if one model fits in 30ms solo, concurrent execution with other models may cause contention. **CUDA streams** and **TensorRT execution contexts** enable time-multiplexing.

---

## 2. Compression Technique Taxonomy

```
Model Compression
│
├── Quantization (reduce precision)
│   ├── Post-Training Quantization (PTQ)     — no retraining
│   ├── Quantization-Aware Training (QAT)    — fine-tune with fake quantization
│   └── Mixed-Precision                      — different layers, different precision
│
├── Knowledge Distillation (train smaller model)
│   ├── Response distillation                — match teacher's output logits
│   ├── Feature distillation                 — match intermediate representations
│   └── Cross-modal distillation             — LiDAR ← camera teacher
│
├── Pruning (remove parameters)
│   ├── Structured pruning                   — remove entire channels/heads
│   ├── Unstructured pruning                 — remove individual weights
│   └── Task-aware safe pruning              — protect safety-critical paths
│
├── Architecture Search / Redesign
│   ├── Neural Architecture Search (NAS)     — automated architecture tuning
│   ├── Manual architecture reduction         — fewer layers/channels
│   └── Efficient operator substitution       — replace attention with linear
│
└── Pipeline-Level Optimization
    ├── Layer fusion (Conv+BN+ReLU)          — TensorRT automatic
    ├── Operator replacement                  — custom CUDA kernels
    └── Memory layout optimization            — NHWC vs NCHW for Orin DLA
```

### 2.1 Expected Compression by Technique

| Technique | Speedup | Accuracy Loss | Effort | Combinable? |
|-----------|---------|---------------|--------|-------------|
| FP16 (from FP32) | 1.5-2x | <0.1% | Trivial | Yes |
| INT8 PTQ | 2-4x | 0.5-2% | Low | Yes |
| INT8 QAT | 2-4x | 0.1-0.5% | Medium | Yes |
| Response distillation | 3-8x | 1-3% | Medium | Yes |
| Feature distillation | 3-8x | 0.5-2% | High | Yes |
| Structured pruning (30%) | 1.3-1.5x | 0.5-1% | Medium | Yes |
| Structured pruning (50%) | 1.8-2.2x | 1-3% | Medium | Yes |
| Layer fusion (TensorRT) | 1.2-1.5x | 0% | Automatic | Always |
| **Combined (distill + INT8 + fuse)** | **5-15x** | **1-3%** | **High** | — |

---

## 3. Quantization: PTQ vs QAT

### 3.1 Post-Training Quantization (PTQ)

PTQ computes quantization scale factors from a calibration dataset — no retraining needed.

```python
import tensorrt as trt
import numpy as np

class CalibrationDataset:
    """INT8 calibration dataset for LiDAR perception models."""
    
    def __init__(self, data_dir, num_samples=200):
        self.samples = self._load_samples(data_dir, num_samples)
        self.current_idx = 0
        self.batch_size = 1
    
    def _load_samples(self, data_dir, num_samples):
        """Load representative LiDAR scans for calibration.
        
        IMPORTANT: Calibration data must be representative of deployment:
        - Include day AND night scans
        - Include wet AND dry conditions
        - Include empty apron AND busy turnaround
        - Include close range (5m) AND far range (100m+) objects
        """
        import glob
        files = sorted(glob.glob(f'{data_dir}/*.npy'))[:num_samples]
        return [np.load(f) for f in files]
    
    def get_batch(self):
        if self.current_idx >= len(self.samples):
            return None
        batch = self.samples[self.current_idx]
        self.current_idx += 1
        return [batch]
    
    def reset(self):
        self.current_idx = 0


def build_int8_engine(onnx_path, calibrator, output_path):
    """Build TensorRT INT8 engine with PTQ calibration."""
    logger = trt.Logger(trt.Logger.WARNING)
    builder = trt.Builder(logger)
    network = builder.create_network(
        1 << int(trt.NetworkDefinitionCreationFlag.EXPLICIT_BATCH)
    )
    parser = trt.OnnxParser(network, logger)
    
    with open(onnx_path, 'rb') as f:
        parser.parse(f.read())
    
    config = builder.create_builder_config()
    config.set_memory_pool_limit(trt.MemoryPoolType.WORKSPACE, 4 << 30)  # 4GB
    config.set_flag(trt.BuilderFlag.INT8)
    config.set_flag(trt.BuilderFlag.FP16)  # fallback for unsupported INT8 layers
    config.int8_calibrator = calibrator
    
    # Profile for dynamic shapes (variable point count)
    profile = builder.create_optimization_profile()
    profile.set_shape('points', 
                      min=(1, 30000, 4),    # minimum 30K points
                      opt=(1, 100000, 4),   # typical 100K points
                      max=(1, 200000, 4))   # maximum 200K points
    config.add_optimization_profile(profile)
    
    engine = builder.build_serialized_network(network, config)
    with open(output_path, 'wb') as f:
        f.write(engine)
    
    return output_path
```

#### PTQ Accuracy Impact by Model Type

| Model | FP32 → FP16 Loss | FP32 → INT8 PTQ Loss | Notes |
|-------|------------------|---------------------|-------|
| CenterPoint | 0.02% mAP | 0.80% mAP | Well-behaved, symmetric weights |
| PointPillars | 0.05% mAP | 0.80% mAP | Simple architecture, quantizes well |
| FlatFormer | 0.1% mIoU | 1.5-2.0% mIoU | Attention layers sensitive |
| Cylinder3D | 0.1% mIoU | 2.0-3.0% mIoU | Sparse conv quantization tricky |
| BEVFusion | 0.2% mAP | 3.0-5.0% mAP | Multi-modal, needs careful calibration |
| FlashOcc | 0.1% IoU | 1.0-1.5% IoU | 2D backbone quantizes well |

### 3.2 Quantization-Aware Training (QAT)

When PTQ accuracy loss is unacceptable (>2%), QAT fine-tunes with simulated quantization:

```python
import torch
from torch.quantization import QConfig, prepare_qat, convert

def qat_fine_tune(model, train_loader, calibration_loader, epochs=10, lr=1e-5):
    """
    Quantization-aware training for LiDAR perception models.
    
    Key insight: Start from a pre-trained FP32 model, insert fake quantization
    nodes, then fine-tune for a few epochs. The model learns to be robust to
    quantization noise.
    """
    # Step 1: Define quantization config
    model.qconfig = QConfig(
        activation=torch.quantization.FakeQuantize.with_args(
            observer=torch.quantization.MovingAverageMinMaxObserver,
            quant_min=-128, quant_max=127, dtype=torch.qint8
        ),
        weight=torch.quantization.FakeQuantize.with_args(
            observer=torch.quantization.MovingAveragePerChannelMinMaxObserver,
            quant_min=-128, quant_max=127, dtype=torch.qint8,
            ch_axis=0  # per-channel for weights
        )
    )
    
    # Step 2: Prepare model with fake quantization
    model.train()
    model_prepared = prepare_qat(model)
    
    # Step 3: Fine-tune (typically 5-20% of original training epochs)
    optimizer = torch.optim.Adam(model_prepared.parameters(), lr=lr)
    
    for epoch in range(epochs):
        for batch in train_loader:
            points, labels = batch
            pred = model_prepared(points)
            loss = torch.nn.functional.cross_entropy(pred, labels)
            loss.backward()
            optimizer.step()
            optimizer.zero_grad()
    
    # Step 4: Convert to actual INT8
    model_int8 = convert(model_prepared.eval())
    return model_int8

# QAT typically recovers 50-80% of PTQ accuracy loss
# Example: FlatFormer PTQ loses 2.0% mIoU → QAT recovers to 0.5% loss
```

### 3.3 Mixed-Precision Strategy

Not all layers need the same precision. TensorRT automatically finds the best per-layer precision when both INT8 and FP16 flags are set:

```
Layer type → Recommended precision:
  Conv/Linear (backbone):     INT8  — most parameters, biggest speedup
  Batch Normalization:        Folded into Conv (zero cost)
  Attention Q,K,V projections: FP16 — sensitive to quantization
  Attention softmax:          FP32  — numerical stability
  Sparse convolution:         FP16  — INT8 support limited in TorchSparse
  Output head (classification): FP16 — small, accuracy-sensitive
  Loss/gradient (training):   FP32  — never quantize during training
```

---

## 4. Knowledge Distillation

### 4.1 Why Distillation for Airside

Distillation enables deploying a **small model that behaves like a large model**:

- **Teacher**: PTv3-Large (46M params, 82.7% mIoU, runs on A100)
- **Student**: FlatFormer-Small (8M params, 65% mIoU baseline → 72% after distillation, runs on Orin)

The teacher transfers its "dark knowledge" — the probability distribution over all classes, not just the argmax — to the student.

### 4.2 Response-Based Distillation

```python
import torch
import torch.nn.functional as F

def distillation_loss(student_logits, teacher_logits, labels, 
                      temperature=4.0, alpha=0.7):
    """
    Combined distillation + hard label loss.
    
    Args:
        student_logits: (B, C, N) student predictions
        teacher_logits: (B, C, N) teacher predictions (detached)
        labels: (B, N) ground truth class labels
        temperature: softens probability distributions (higher = softer)
        alpha: weight for distillation loss vs hard loss
    
    Returns:
        combined loss
    """
    # Soft targets from teacher (dark knowledge)
    soft_student = F.log_softmax(student_logits / temperature, dim=1)
    soft_teacher = F.softmax(teacher_logits / temperature, dim=1)
    distill_loss = F.kl_div(soft_student, soft_teacher, reduction='batchmean')
    distill_loss *= temperature ** 2  # scale gradient magnitude
    
    # Hard targets from ground truth
    hard_loss = F.cross_entropy(student_logits, labels)
    
    return alpha * distill_loss + (1 - alpha) * hard_loss

# Training loop
for points, labels in train_loader:
    with torch.no_grad():
        teacher_logits = teacher_model(points)  # large model
    student_logits = student_model(points)       # small model
    
    loss = distillation_loss(student_logits, teacher_logits, labels)
    loss.backward()
    optimizer.step()
```

### 4.3 Feature-Based Distillation

Match intermediate feature maps, not just output logits:

```python
def feature_distillation_loss(student_features, teacher_features, projectors):
    """
    Match intermediate representations from multiple layers.
    
    student_features: list of (B, C_s, N) tensors from student layers
    teacher_features: list of (B, C_t, N) tensors from teacher layers
    projectors: list of nn.Linear(C_s, C_t) alignment layers
    """
    total_loss = 0
    for s_feat, t_feat, proj in zip(student_features, teacher_features, projectors):
        # Project student features to teacher dimension
        s_aligned = proj(s_feat.permute(0, 2, 1)).permute(0, 2, 1)
        # L2 distance between normalized features
        s_norm = F.normalize(s_aligned, dim=1)
        t_norm = F.normalize(t_feat.detach(), dim=1)
        total_loss += (1 - (s_norm * t_norm).sum(dim=1)).mean()
    
    return total_loss / len(student_features)
```

### 4.4 Cross-Modal Distillation (Camera → LiDAR)

**TinyBEV** (ICCV 2025 Workshop) demonstrates distilling a multi-modal teacher (camera + LiDAR) into a camera-only student. For airside, the inverse is more useful:

```
Teacher: Camera + LiDAR multi-modal model (BEVFusion)
         - Uses 6 cameras + 4 LiDAR for training
         - Rich texture + depth information
Student: LiDAR-only model (FlatFormer)
         - Deployed with LiDAR only (Aurrigo's sensor suite)
         - Inherits camera-informed features without camera at inference

Benefit: LiDAR model learns texture-aware features from camera teacher
         e.g., distinguishing hi-vis vest (person) from orange cone (equipment)
         purely from LiDAR geometry + intensity, informed by camera knowledge
```

### 4.5 Distillation Results for Perception Models

| Teacher | Student | Task | Teacher Acc | Student (no distill) | Student (distilled) | Speedup |
|---------|---------|------|-------------|---------------------|--------------------|---------| 
| PTv3-L | FlatFormer-S | Seg | 82.7% mIoU | 65.0% | **72.1%** | 5x |
| BEVFusion | CenterPoint | Det | 72.9% mAP | 65.8% | **69.4%** | 4x |
| UniAD | TinyBEV | Multi | — | — | Within 2-3% | 5-8x |
| DINOv2-L | DINOv2-S | Backbone | — | — | Within 1.5% | 6x |

---

## 5. Pruning & Sparsity

### 5.1 Structured Pruning

Remove entire channels, attention heads, or layers — produces directly smaller model without special sparse hardware support:

```python
import torch.nn.utils.prune as prune

def structured_prune_model(model, amount=0.3):
    """
    Remove 30% of channels (structured pruning).
    
    After pruning, the model has fewer parameters and runs faster
    WITHOUT needing sparse tensor support.
    """
    for name, module in model.named_modules():
        if isinstance(module, torch.nn.Conv2d):
            prune.ln_structured(module, name='weight', amount=amount, n=2, dim=0)
            prune.remove(module, 'weight')  # make pruning permanent
        elif isinstance(module, torch.nn.Linear):
            prune.ln_structured(module, name='weight', amount=amount, n=2, dim=0)
            prune.remove(module, 'weight')
    
    return model
```

### 5.2 Task-Aware Safe Pruning for Safety-Critical Models

Recent work (2025) shows that naive pruning can disproportionately damage rare class detection — **exactly the safety-critical classes** (personnel, FOD) we care about most:

```python
def safety_aware_pruning(model, train_loader, safety_classes, amount=0.3):
    """
    Prune model while protecting channels most important for safety classes.
    
    Key idea: Compute channel importance separately for safety-critical classes.
    Only prune channels that have low importance for ALL classes including safety ones.
    """
    # Step 1: Compute per-channel importance for each class
    importance = {}  # {class_id: {layer_name: importance_scores}}
    
    for cls_id in range(model.num_classes):
        importance[cls_id] = compute_channel_importance(model, train_loader, cls_id)
    
    # Step 2: For each layer, protect channels important for safety classes
    for name, module in model.named_modules():
        if not hasattr(module, 'weight'):
            continue
        
        # Aggregate importance: max across safety classes
        safety_importance = torch.stack([
            importance[cls_id][name] for cls_id in safety_classes
        ]).max(dim=0).values
        
        # Only prune channels with low safety importance
        threshold = torch.quantile(safety_importance, amount)
        mask = safety_importance > threshold
        
        # Apply mask
        prune.custom_from_mask(module, name='weight', mask=mask.unsqueeze(-1))
```

### 5.3 Pruning + Distillation Pipeline

The NVIDIA Model Optimizer recommended pipeline:

```
Step 1: Train full model to convergence                    → 82% mIoU
Step 2: Structured pruning (30% channels)                  → 78% mIoU (-4%)
Step 3: Knowledge distillation from full model (10 epochs)  → 80% mIoU (+2% recovered)
Step 4: INT8 QAT (5 epochs)                                → 79.5% mIoU (-0.5%)
Step 5: TensorRT layer fusion + optimization               → 0% additional loss

Final: 79.5% mIoU at 3-5x speedup over original FP32 model
```

---

## 6. Architecture-Aware Compression

### 6.1 Efficient Backbone Substitution

Instead of compressing a large model, start with an efficient architecture:

| Large Model | Efficient Alternative | Params Ratio | Accuracy Gap | Orin Speedup |
|-------------|----------------------|-------------|-------------|-------------|
| PTv3-Large | FlatFormer | 0.39x | -10% mIoU | 4-5x faster |
| ResNet-101 (2D) | MobileNetV3-L | 0.14x | -3% mAP | 6x faster |
| DINOv2-Large | DINOv2-Small | 0.07x | -4% on ImageNet | 8x faster |
| Swin-L (BEV) | EfficientNet-B3 | 0.12x | -5% mAP | 5x faster |
| ViT-L (backbone) | FastViT-SA36 | 0.05x | -3% on ImageNet | 10x faster |

### 6.2 Operator Substitution for Orin

Some operations are efficient on desktop GPUs but slow on Orin:

| Expensive Op | Orin-Friendly Replacement | Speedup |
|-------------|--------------------------|---------|
| Multi-head attention (dense) | Grouped attention (fewer heads) | 1.5-2x |
| Deformable attention | Standard attention + learned offsets | 2-3x |
| Sparse 3D conv (MinkowskiEngine) | TorchSparse 2.x | 2-3x |
| Trilinear interpolation (3D) | Nearest-neighbor + learned upscale | 1.5x |
| Dynamic convolution | Static conv + channel attention | 2x |
| FlashAttention v2 | TensorRT fused MHA plugin | 1.3x |

---

## 7. NVIDIA Model Optimizer (ModelOpt)

### 7.1 Overview

NVIDIA Model Optimizer (formerly TensorRT Model Optimizer) is the unified compression toolkit:

```bash
pip install nvidia-modelopt

# Supported techniques:
# - PTQ (INT8, FP8, INT4, FP4)
# - QAT
# - Structured pruning (GradNorm-based)
# - Knowledge distillation
# - Sparsity (2:4 structured)
# - NAS (Neural Architecture Search)
```

### 7.2 PTQ with ModelOpt

```python
import modelopt.torch.quantization as mtq

# One-line PTQ quantization
model_quantized = mtq.quantize(model, quant_cfg=mtq.INT8_DEFAULT_CFG, 
                                forward_loop=calibration_forward_loop)

# Export to ONNX for TensorRT
torch.onnx.export(model_quantized, dummy_input, 'model_int8.onnx',
                   opset_version=17)
```

### 7.3 2:4 Structured Sparsity

Orin's GPU supports **2:4 sparsity** natively — for every 4 consecutive weights, at most 2 are non-zero. TensorRT exploits this for ~2x speedup with minimal accuracy loss:

```python
import modelopt.torch.sparsity as mts

# Apply 2:4 structured sparsity
model_sparse = mts.sparsify(model, mode='2:4')

# Fine-tune to recover accuracy (typically 5-10 epochs)
for epoch in range(10):
    train_one_epoch(model_sparse, train_loader, optimizer)

# Export — TensorRT automatically uses sparse tensor cores
torch.onnx.export(model_sparse, dummy_input, 'model_sparse.onnx')
```

---

## 8. Model-Specific Recipes

### 8.1 CenterPoint (3D Detection)

```
Starting point: CenterPoint-Pillar (9M params, 65.8% mAP nuScenes)
  Step 1: FP16 TensorRT conversion                         → 12ms Orin, 65.7% mAP
  Step 2: INT8 PTQ (200 calibration scans)                  → 7ms Orin, 65.0% mAP
  Step 3: Pillar size optimization (0.2m→0.25m)             → 5ms Orin, 64.5% mAP
  
  Final: 5ms, 64.5% mAP — fits comfortably in budget
  Already achieved in OpenPCDet/Lidar_AI_Solution reference code
```

### 8.2 FlatFormer (Segmentation)

```
Starting point: FlatFormer (18M params, 70% mIoU estimated)
  Step 1: Reduce embed_dim 128→96, num_layers 4→3           → ~12M params, 67% mIoU
  Step 2: FP16 TensorRT                                     → 35ms Orin, 67% mIoU  
  Step 3: INT8 PTQ                                           → 22ms Orin, 65.5% mIoU
  Step 4: QAT recovery (10 epochs)                           → 22ms Orin, 66.5% mIoU
  Step 5: 2:4 sparsity                                       → 18ms Orin, 66.0% mIoU
  
  Final: 18ms, 66% mIoU — within 30ms budget
```

### 8.3 FlashOcc (Camera Occupancy)

```
Starting point: FlashOcc-R50 (52M params, 32.0% mIoU Occ3D)
  Step 1: Replace ResNet-50 with MobileNetV3-L              → 18M params, 28% mIoU
  Step 2: FP16 TensorRT + C2H plugin                        → 5ms Orin, 28% mIoU
  Step 3: INT8 PTQ                                           → 3ms Orin, 27% mIoU
  
  Final: 3ms, 27% mIoU — extremely fast, adequate for safety grid
  Note: FlashOcc already designed for speed — compression gains are smaller
```

### 8.4 DINOv2 Backbone (Feature Extraction)

```
Starting point: DINOv2-Large (304M params)
  Option A: Use DINOv2-Small (22M params) + LoRA adapters
            → 22M + 0.5M LoRA = 22.5M params
            → FP16: 8ms Orin, within 1.5% of Large accuracy with task-specific adapter
  
  Option B: Distill DINOv2-Large → DINOv2-Small
            → Additional 1-2% accuracy recovery over Option A
            → Requires training pipeline (8 GPU-hours on A100)
  
  Recommendation: Option A (simpler, nearly as good)
```

### 8.5 VLA Distillation (Alpamayo → Edge Policy)

Alpamayo is a 10B-parameter Vision-Language-Action model. It **cannot run on Orin**. The deployment strategy is distillation to a small policy:

```
Teacher: Alpamayo 10B (runs on cloud/datacenter)
Student: FastViT-SA24 + Transformer-S (20M params, runs on Orin)

Distillation strategy:
  1. Run Alpamayo on recorded driving logs → generate trajectory labels
  2. Train student to match Alpamayo trajectories (behavioral cloning)
  3. Add DAgger: deploy student, query Alpamayo for corrections
  4. After 100K frames: student achieves 85-90% of teacher performance
  
  Student inference on Orin: ~15ms (FP16), ~10ms (INT8)
  Accuracy: 85-90% of Alpamayo, much better than rule-based planning
  
  Note: Alpamayo has non-commercial license — distillation may inherit
  license restrictions. Use Cosmos-based alternatives for commercial deployment.
```

---

## 9. TensorRT Deployment Pipeline

### 9.1 Complete Pipeline

```bash
#!/bin/bash
# Full model deployment pipeline: PyTorch → ONNX → TensorRT → ROS

# ===== Step 1: Export PyTorch to ONNX =====
python export_model.py \
    --model flatformer \
    --weights flatformer_airside_v1.pth \
    --output flatformer.onnx \
    --opset 17 \
    --dynamic-batch \
    --simplify  # onnx-simplifier removes redundant ops

# ===== Step 2: Validate ONNX =====
python -c "
import onnx
model = onnx.load('flatformer.onnx')
onnx.checker.check_model(model)
print(f'Inputs: {[i.name for i in model.graph.input]}')
print(f'Outputs: {[o.name for o in model.graph.output]}')
"

# ===== Step 3: Build TensorRT engine (ON ORIN TARGET) =====
# IMPORTANT: Engine must be built on the target device
# Engines are NOT portable between GPU architectures

# FP16 engine (safe default)
/usr/src/tensorrt/bin/trtexec \
    --onnx=flatformer.onnx \
    --saveEngine=flatformer_fp16.engine \
    --fp16 \
    --workspace=4096 \
    --minShapes=points:1x30000x4 \
    --optShapes=points:1x100000x4 \
    --maxShapes=points:1x200000x4 \
    --verbose 2>&1 | tee build_fp16.log

# INT8 engine (fastest)
/usr/src/tensorrt/bin/trtexec \
    --onnx=flatformer.onnx \
    --saveEngine=flatformer_int8.engine \
    --int8 --fp16 \
    --calib=calibration_cache.bin \
    --workspace=4096 \
    --minShapes=points:1x30000x4 \
    --optShapes=points:1x100000x4 \
    --maxShapes=points:1x200000x4

# ===== Step 4: Benchmark =====
/usr/src/tensorrt/bin/trtexec \
    --loadEngine=flatformer_int8.engine \
    --iterations=1000 \
    --warmUp=100 \
    --avgRuns=100
# Output: min/avg/max latency, throughput, GPU utilization

# ===== Step 5: Validate accuracy =====
python validate_engine.py \
    --engine flatformer_int8.engine \
    --test-data /data/airside_test/ \
    --metrics miou,per_class_iou,latency_p99 \
    --compare-with flatformer_fp16.engine  # ensure INT8 ≈ FP16
```

### 9.2 Common TensorRT Pitfalls on Orin

| Issue | Symptom | Fix |
|-------|---------|-----|
| Dynamic shapes OOM | Engine build fails | Reduce maxShapes or increase workspace |
| INT8 accuracy drop >3% | mIoU plummets | Use QAT instead of PTQ |
| Sparse conv not supported | ONNX export fails | Use TorchSparse ONNX plugin or convert to dense |
| Batch norm folding failure | Accuracy mismatch | Fold BN manually before export |
| DLA incompatible ops | DLA fallback to GPU | Check `--useDLACore=0 --allowGPUFallback` |
| Engine not portable | Crash on different Orin | Always build engine ON the target device |
| Attention mask dynamic | Shape mismatch | Pre-compute attention masks for each input size |

---

## 10. DLA Offloading Strategy

### 10.1 Orin DLA Capabilities

Orin has 2 Deep Learning Accelerators (DLAs), each providing ~50 TOPS INT8 at very low power (~5W each):

```
DLA supported ops: Conv2D, Deconv, FC, Pool, Activation (ReLU/Sigmoid/Tanh), 
                   BatchNorm, ElementWise, Scale, Softmax, Concat
DLA NOT supported: Sparse Conv, Attention, Custom CUDA, most transformer ops
```

### 10.2 Recommended DLA Assignment

```
GPU:   FlatFormer (segmentation) — attention ops, sparse/irregular
       CenterPoint backbone — sparse pillar conv
       
DLA 0: CenterPoint detection head — simple conv + FC layers
       Post-processing CNN refinements
       
DLA 1: SalsaNext (lightweight backup segmentation)
       Binary moving/static classifier
       Simple thermal fusion network (if thermal cameras added)
```

### 10.3 DLA Engine Build

```bash
# Build engine targeting DLA core 0 with GPU fallback
/usr/src/tensorrt/bin/trtexec \
    --onnx=detection_head.onnx \
    --saveEngine=detection_head_dla0.engine \
    --int8 \
    --useDLACore=0 \
    --allowGPUFallback \
    --workspace=1024

# Check DLA utilization
# TensorRT reports which layers run on DLA vs GPU fallback
```

---

## 11. Multi-Model Orchestration on Orin

### 11.1 Concurrent Execution with CUDA Streams

```cpp
// Multi-model inference manager for Orin
class MultiModelInference {
public:
    MultiModelInference() {
        // Create separate CUDA streams for each model
        cudaStreamCreate(&seg_stream_);      // segmentation
        cudaStreamCreate(&det_stream_);      // detection
        cudaStreamCreate(&occ_stream_);      // occupancy
    }
    
    void runPerceptionCycle(const PointCloud& input) {
        // Shared preprocessing on default stream
        auto preprocessed = preprocess(input);
        cudaDeviceSynchronize();
        
        // Launch all models concurrently on separate streams
        seg_engine_->enqueueV2(seg_buffers_, seg_stream_, nullptr);
        det_engine_->enqueueV2(det_buffers_, det_stream_, nullptr);
        occ_engine_->enqueueV2(occ_buffers_, occ_stream_, nullptr);
        
        // Wait for all to complete
        cudaStreamSynchronize(seg_stream_);
        cudaStreamSynchronize(det_stream_);
        cudaStreamSynchronize(occ_stream_);
        
        // Post-process results (can also be parallelized)
        auto seg_result = postprocessSeg();
        auto det_result = postprocessDet();
        auto occ_result = postprocessOcc();
    }
    
private:
    cudaStream_t seg_stream_, det_stream_, occ_stream_;
    TrtEngine* seg_engine_, *det_engine_, *occ_engine_;
};
```

### 11.2 Orin Power Mode Selection

| Mode | GPU Clock | CPU Clock | DLA | Power | Use Case |
|------|-----------|-----------|-----|-------|----------|
| MAXN | 1.3 GHz | 2.2 GHz | 2x active | 60W | Full autonomous operation |
| MODE_50W | 1.0 GHz | 1.5 GHz | 2x active | 50W | Normal operation |
| MODE_30W | 0.8 GHz | 1.2 GHz | 1x active | 30W | Low-speed maneuvering |
| MODE_15W | 0.6 GHz | 0.8 GHz | 1x active | 15W | Idle/monitoring |

**Recommendation**: Use **MODE_50W** as default for balance of performance and thermal management. Switch to MAXN during complex scenarios (busy turnaround, multiple aircraft).

```bash
# Set power mode (persistent across reboots)
sudo nvpmodel -m 2  # MODE_50W
sudo jetson_clocks   # lock clocks to max for consistent latency
```

---

## 12. ROS Noetic Integration

### 12.1 TensorRT Inference Node

```cpp
#include <ros/ros.h>
#include <sensor_msgs/PointCloud2.h>
#include <NvInfer.h>
#include <cuda_runtime_api.h>

class TrtInferenceNode {
public:
    TrtInferenceNode(ros::NodeHandle& nh) {
        // Load engine
        std::string engine_path;
        nh.param<std::string>("engine_path", engine_path, "model.engine");
        engine_ = loadEngine(engine_path);
        context_ = engine_->createExecutionContext();
        
        // Allocate GPU buffers
        allocateBuffers();
        
        // ROS interface
        sub_ = nh.subscribe("/aurrigo/lidar/aggregated", 1,
                           &TrtInferenceNode::callback, this);
        pub_ = nh.advertise<perception_msgs::SemanticPointCloud>(
               "/perception/segmentation", 1);
        
        ROS_INFO("TensorRT engine loaded: %s (%.1f MB)", 
                 engine_path.c_str(), getEngineSize() / 1e6);
    }
    
private:
    void callback(const sensor_msgs::PointCloud2::ConstPtr& msg) {
        auto t0 = ros::Time::now();
        
        // 1. Copy points to GPU input buffer
        int num_points = copyPointsToGPU(msg);
        
        // 2. Set dynamic shape for this input
        context_->setInputShape("points", 
            nvinfer1::Dims3{1, num_points, 4});
        
        // 3. Execute inference
        context_->enqueueV2(buffers_.data(), stream_, nullptr);
        cudaStreamSynchronize(stream_);
        
        // 4. Copy results back to CPU
        auto result = copyResultsFromGPU(num_points);
        
        // 5. Publish
        publishResult(msg->header, result);
        
        double elapsed = (ros::Time::now() - t0).toSec() * 1000;
        ROS_DEBUG_THROTTLE(5.0, "Inference: %.1fms (%d points)", 
                          elapsed, num_points);
    }
};
```

### 12.2 Model Hot-Swap for OTA Updates

```cpp
class ModelManager {
    /**
     * Supports swapping TensorRT engines at runtime without restarting ROS.
     * Used for OTA model updates: new engine → validate → swap → old as fallback.
     */
public:
    bool swapEngine(const std::string& new_engine_path) {
        // Step 1: Load new engine in background
        auto new_engine = loadEngine(new_engine_path);
        if (!new_engine) {
            ROS_ERROR("Failed to load new engine: %s", new_engine_path.c_str());
            return false;
        }
        
        // Step 2: Run validation on test inputs
        if (!validateEngine(new_engine, test_inputs_)) {
            ROS_WARN("New engine failed validation, keeping current");
            return false;
        }
        
        // Step 3: Atomic swap (lock-free pointer exchange)
        {
            std::lock_guard<std::mutex> lock(engine_mutex_);
            old_engine_ = std::move(active_engine_);  // keep as fallback
            active_engine_ = std::move(new_engine);
        }
        
        ROS_INFO("Engine swapped successfully: %s", new_engine_path.c_str());
        return true;
    }
};
```

---

## 13. Validation & Safety

### 13.1 Compression Validation Protocol

Before deploying any compressed model, validate against the uncompressed baseline:

```python
def validate_compression(original_engine, compressed_engine, test_data):
    """
    Validate that compression hasn't degraded safety-critical metrics.
    
    GATE CRITERIA (all must pass):
    1. Overall mIoU drop < 3%
    2. Personnel class IoU drop < 1%  (CRITICAL)
    3. Aircraft class IoU drop < 2%   (CRITICAL)
    4. No new false negatives for persons within 20m
    5. Latency P99 < target (e.g., 30ms)
    6. No inference failures over 10,000 consecutive frames
    """
    results = {
        'overall_miou_drop': 0,
        'person_iou_drop': 0,
        'aircraft_iou_drop': 0,
        'new_false_negatives': 0,
        'latency_p99': 0,
        'inference_failures': 0,
    }
    
    for sample in test_data:
        orig_pred = run_engine(original_engine, sample)
        comp_pred = run_engine(compressed_engine, sample)
        
        # Check for new false negatives (compressed misses, original detects)
        orig_person = orig_pred == PERSON_CLASS
        comp_person = comp_pred == PERSON_CLASS
        new_fn = (orig_person & ~comp_person).sum()
        
        # Filter to within 20m range
        range_mask = sample.ranges < 20.0
        results['new_false_negatives'] += (orig_person & ~comp_person & range_mask).sum()
    
    # Gate decisions
    gates = {
        'overall_miou': results['overall_miou_drop'] < 3.0,
        'person_safety': results['person_iou_drop'] < 1.0,
        'aircraft_safety': results['aircraft_iou_drop'] < 2.0,
        'no_new_fn': results['new_false_negatives'] == 0,
        'latency': results['latency_p99'] < 30.0,
        'stability': results['inference_failures'] == 0,
    }
    
    passed = all(gates.values())
    return passed, gates, results
```

### 13.2 Simplex Safety Integration

Compressed models are the **Advanced Controller (AC)** in the Simplex architecture. The **Baseline Controller (BC)** is the classical RANSAC pipeline that doesn't depend on ML:

```
┌─────────────────────────────────┐
│          Decision Module         │
│  if AC_confidence > threshold   │
│     AND AC_latency < deadline   │
│     AND no GPU errors:          │
│       → Use AC (neural model)   │
│  else:                          │
│       → Use BC (RANSAC)         │
└─────────────────────────────────┘
         │              │
    ┌────┴────┐    ┌────┴────┐
    │   AC    │    │   BC    │
    │ Neural  │    │ RANSAC  │
    │ FlatF.  │    │ Classic │
    │ INT8    │    │ No ML   │
    └─────────┘    └─────────┘
```

---

## 14. Cost & Timeline

### 14.1 Compression Engineering Effort

| Task | Duration | Prerequisites |
|------|----------|---------------|
| ONNX export + TensorRT FP16 | 1-2 days | Trained model |
| INT8 PTQ calibration | 2-3 days | 200 representative scans |
| QAT fine-tuning | 1 week | Training pipeline, GPU access |
| Knowledge distillation | 2-3 weeks | Teacher model, training data |
| Structured pruning + recovery | 1-2 weeks | Training pipeline |
| Full pipeline (distill + prune + INT8) | 4-6 weeks | All above |
| ROS integration + testing | 2-3 weeks | TensorRT engine |
| Validation + safety certification | 2-4 weeks | Test dataset, gate criteria |

### 14.2 Compute Cost

| Task | Hardware | Duration | Cloud Cost |
|------|----------|----------|-----------|
| Distillation training | 4× A100 | 3 days | $1,500 |
| QAT fine-tuning | 1× A100 | 1 day | $125 |
| Pruning + recovery | 1× A100 | 2 days | $250 |
| INT8 calibration | 1× Orin (local) | 2 hours | $0 |
| Validation runs | 1× Orin (local) | 8 hours | $0 |
| **Total compute** | | | **~$2,000** |

### 14.3 Expected Outcomes

| Model | Original (A100) | Compressed (Orin) | Speedup | Accuracy Delta |
|-------|-----------------|-------------------|---------|---------------|
| Segmentation (FlatFormer) | 35ms, 70% mIoU | 18ms, 66% mIoU | 2x | -4% |
| Detection (CenterPoint) | 52ms, 65.8% mAP | 5ms, 64.5% mAP | 10x | -1.3% |
| Occupancy (FlashOcc) | 28ms, 32% mIoU | 3ms, 27% mIoU | 9x | -5% |
| Total perception | ~115ms | ~26ms | 4.4x | Acceptable |

---

## 15. References

### Quantization
- NVIDIA TensorRT Quantization Guide — [docs.nvidia.com/deeplearning/tensorrt](https://docs.nvidia.com/deeplearning/tensorrt/latest/inference-library/work-quantized-types.html)
- "Achieving FP32 Accuracy for INT8 Inference Using QAT with TensorRT" — NVIDIA Blog
- NVIDIA Model Optimizer — [github.com/NVIDIA/Model-Optimizer](https://github.com/NVIDIA/Model-Optimizer)

### Knowledge Distillation
- "Compressing Multi-Task Model for Autonomous Driving via Pruning and Knowledge Distillation" (2025) — [arxiv.org/abs/2511.05557](https://arxiv.org/abs/2511.05557)
- **TinyBEV**: Khan et al., "Cross-Modal Knowledge Distillation for Efficient Multi-Task BEV Perception" (ICCV 2025 Workshop)
- "On the Road to Portability: Compressing End-to-End Motion Planner" (2024) — [arxiv.org/abs/2403.01238](https://arxiv.org/abs/2403.01238)

### Pruning
- NVIDIA Model Optimizer pruning — [github.com/NVIDIA/TensorRT-Model-Optimizer](https://github.com/NVIDIA/TensorRT-Model-Optimizer)
- Task-aware safe pruning for autonomous driving perception (2025)

### Edge Deployment
- NVIDIA Jetson Orin Benchmarks — [developer.nvidia.com/embedded/jetson-benchmarks](https://developer.nvidia.com/embedded/jetson-benchmarks)
- "Real-Time AI Inference at the Edge for Self-Driving Cars" (2025)
- NVIDIA DRIVE AGX Thor Developer Kit — NVIDIA Blog

### Architecture Efficiency
- **FlatFormer**: Liu et al., "Flattened Window Attention for Efficient Point Cloud Transformer" (CVPR 2023)
- **FastViT**: Vasu et al., "FastViT: A Fast Hybrid Vision Transformer using Structural Reparameterization" (ICCV 2023)
- **MobileNetV3**: Howard et al., "Searching for MobileNetV3" (ICCV 2019)
