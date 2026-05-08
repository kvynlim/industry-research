# DINOv2 and Vision Foundation Models as Perception Backbones for Autonomous Driving

**Research Date:** 2026-03-22
**Focus:** Self-supervised vision transformers for AV perception, with emphasis on airside deployment

---

## 1. DINOv2 Architecture

### Model Family

DINOv2 (Meta, 2023) is a family of self-supervised Vision Transformers that produce universal visual features without any labels. Four model sizes are available, all using patch size 14:

| Variant | Parameters | Embedding Dim | Heads | Layers | FFN Type |
|---------|-----------|---------------|-------|--------|----------|
| ViT-S/14 | 21M | 384 | 6 | 12 | MLP |
| ViT-B/14 | 86M | 768 | 12 | 12 | MLP |
| ViT-L/14 | 304M | 1024 | 16 | 24 | MLP |
| ViT-g/14 | 1.1B | 1536 | 24 | 40 | SwiGLU |

All variants use 64 dimensions per attention head. Each model is available with and without 4 register tokens (which reduce attention artifacts). For a 518x518 input image, each model produces 1 [CLS] token + 1369 patch tokens (37x37 grid).

### Self-Supervised Training on LVD-142M

DINOv2 was trained on **LVD-142M**, a curated dataset of 142 million images assembled without any human annotations. The dataset was constructed through:

1. **Source aggregation** from diverse image collections
2. **Content-based filtering** using PCA hashing and Faiss k-NN for deduplication (cosine similarity thresholds)
3. **Balanced retrieval** via distributed k-means over 100K clusters to ensure diversity
4. **Benchmark decontamination** removing near-duplicates of test set images

The dataset curation pipeline ran on 20 nodes with 8 V100-32GB GPUs in under 2 days. Total training compute was approximately 39,800 A100 GPU-hours.

### Training Methodology

DINOv2 combines three self-supervised objectives:

1. **DINO self-distillation loss (image-level):** A student network learns to match the output of a teacher network (exponential moving average of the student) using multi-crop augmentations -- 2 global crops + 8 local crops force cross-scale consistency.

2. **iBOT masked image modeling loss (patch-level):** The teacher's outputs on non-masked patches supervise the student's predictions on masked regions, driving spatially coherent feature learning.

3. **KoLeo regularizer:** Spreads features uniformly in the embedding space, preventing dimensional collapse.

Additional stabilization techniques include **LayerScale** (adaptive scaling of residual block outputs), **stochastic depth** (up to 40% drop rate for ViT-g), and a short high-resolution fine-tuning phase. The largest ViT-g teacher is trained first, then smaller ViT-S/B/L students are distilled from it.

### What Makes It Different from Supervised Backbones

- **No label dependency:** Features are learned entirely from pixel statistics, making them domain-agnostic and transferable to novel environments (critical for airside where labeled data is scarce)
- **Dense feature quality:** Patch-level features capture part-level semantics without any segmentation supervision. PCA visualization of DINOv2 patch features shows coherent object boundaries and part segmentation emerging naturally.
- **Frozen feature utility:** A simple linear probe or k-NN classifier on frozen DINOv2 features matches or exceeds fine-tuned supervised models on many benchmarks
- **Multi-task versatility:** The same frozen features work for classification, segmentation, depth estimation, and retrieval simultaneously

### Official Benchmarks (Frozen Features)

| Task | ViT-S | ViT-B | ViT-L | ViT-g |
|------|-------|-------|-------|-------|
| ImageNet-1k k-NN (%) | 79.0 | 82.1 | 83.5 | 83.5 |
| ADE20k Segmentation (mIoU) | 47.2 | 51.3 | 53.1 | 53.0 |
| NYU Depth v2 (RMSE, lower=better) | 0.417 | 0.362 | 0.333 | 0.298 |

---

## 2. Published Results for Autonomous Driving

### DINO Pre-training for End-to-End Driving (Juneja et al., 2024)

**Paper:** "DINO Pre-training for Vision-based End-to-end Autonomous Driving" (arXiv:2407.10803, published in Baltic Journal of Modern Computing, 2024)

This paper directly compares DINO self-supervised pre-training against ImageNet classification pre-training for the vision encoder of an imitation-learning driving agent, evaluated on the CARLA Leaderboard benchmark.

**Key results in New Town & Weather (unseen environments):**

| Pre-training Method | Route Completion (%) | Distance Completion (%) |
|---------------------|---------------------|------------------------|
| **DINO (proposed)** | **62.18 +/- 7** | 82.67 +/- 6 |
| ImageNet baseline | 53.20 +/- 1 | 72.23 +/- 6 |
| VPRPre (place recognition) | 60.25 +/- 2 | 86.01 +/- 0 |

**Key finding:** DINO pre-training yields a **+9 percentage point improvement in route completion** over supervised ImageNet pre-training on unseen environments. The self-supervised features generalize better to novel towns and weather conditions because they capture task-agnostic visual structure rather than ImageNet-specific category boundaries.

The improvement is particularly notable because the DINO pre-training does not require any driving data -- it learns general visual representations that transfer directly to the driving domain.

### CarLLaVA (CARLA Challenge 2024 Winner)

CarLLaVA won 1st place in the CARLA Autonomous Driving Challenge 2.0 (2024) sensor track, outperforming the previous SOTA by 458%. While this system used a LLaVA vision encoder rather than DINOv2 directly, it validates the trend of using foundation model encoders (pre-trained on large-scale data) for driving perception.

---

## 3. DINOv2 Features for BEV Encoding

### Integration Architecture: Extract Features then View Transform

The standard pipeline for integrating DINOv2 into BEV perception:

```
Multi-camera images
       |
       v
DINOv2 ViT backbone (frozen or LoRA-adapted)
       |
       v
Feature adapter (conv layer to reduce dimensionality)
       |
       v
View transform (LSS / BEVFormer / SimpleBEV)
       |
       v
BEV feature grid
       |
       v
Detection / segmentation heads
```

### DINOv2 + LSS (Lift-Splat-Shoot) Integration

**Paper:** "Revisiting Birds Eye View Perception Models with Frozen Foundation Models: DINOv2 and Metric3Dv2" (arXiv:2501.08118, January 2025)

This paper replaces the EfficientNet backbone in LSS with frozen DINOv2 and Metric3Dv2 for depth:

**Feature extraction details:**
- DINOv2 divides images into 14x14 patches (vs EfficientNet's 16x downsampling), providing finer spatial granularity
- Features are downsampled to 64 dimensions via a single convolutional layer for compatibility with the LSS decoder
- Metric3Dv2 produces depth in [41, H/16, W/16] format representing 41 bins across 4-45m range

**Vehicle segmentation IoU results (nuScenes):**

| Configuration | IoU | Delta |
|---------------|-----|-------|
| Baseline LSS (EfficientNet) | 33.0 | -- |
| EfficientNet + Metric3Dv2 (Giant) | 40.5 | +7.5 |
| **DINOv2 + Metric3Dv2 (Giant)** | **41.9** | **+8.9** |
| DINOv2 + Metric3Dv2 (half data) | 40.4 | +7.4 |

The frozen foundation models converge in under 150K iterations versus 300K+ for the original LSS, while achieving a **22.4% relative improvement** in vehicle segmentation IoU.

### DINOv2 + SimpleBEV with LoRA

**Paper:** "Robust Bird's Eye View Segmentation by Adapting DINOv2" (arXiv:2409.10228, September 2024)

This paper adapts DINOv2 to SimpleBEV using LoRA, specifically updating only query and value projections in ViT attention layers.

**BEV segmentation mIoU (nuScenes):**

| Model | Input Resolution | Learnable Params | mIoU |
|-------|-----------------|-------------------|------|
| SimpleBEV (ResNet-101) | 224x400 | 37M | 42.3 |
| DINOv2 ViT-B + LoRA | 224x392 | 1M | 42.3 |
| DINOv2 ViT-L + LoRA | 224x392 | 3M | 43.4 |
| DINOv2 ViT-L + LoRA | 392x700 | 3M | 47.6 |

DINOv2 ViT-B with LoRA matches ResNet-101 performance with **37x fewer learnable parameters**. ViT-L at higher resolution outperforms SimpleBEV (47.6 vs 47.4 mIoU) with far fewer trainable parameters.

**Robustness under corruption (nuScenes-C):**
- Motion blur: ViT-L achieves 2.5x SimpleBEV performance
- Darkness: SimpleBEV drops below 30%, ViT-L stays above 60%
- Brightness/fog: ViT-L maintains >80% of clean performance; SimpleBEV drops below 40%
- DINOv2 adaptations show robustness advantages in 6 of 8 corruption types

### DINOv2-Guided BEV Maps for 3D Detection and Tracking

**Paper:** "DualViewDistill: Bridging Perspectives: Foundation Model Guided BEV Maps for 3D Object Detection and Tracking" (arXiv:2510.10287, October 2025)

This method uses DINOv2 as an offline feature generator to create BEV pseudo-labels via LiDAR point cloud projection:

1. Extract multi-scale DINOv2 features from each camera view
2. Project features onto LiDAR point clouds using calibration
3. Accumulate point clouds across sequences for dense, static scene representations
4. Voxelize and average along height axis to produce 2D BEV feature grids as distillation targets

**nuScenes test set performance:**

| Metric | DualViewDistill (ViT-L) | Previous SOTA (Sparse4Dv3) |
|--------|------------------------|---------------------------|
| AMOTA (tracking) | 0.669 | 0.643 |
| NDS (detection) | 0.695 | -- |
| mAP (detection) | 0.621 | -- |
| ID Switches | 407 | 699 |

### Important Caveat: Direct Backbone Replacement Fails

When DINOv2-small was used as a direct drop-in replacement for ResNet-18 in a 3D detection pipeline (without adapter modules), the model achieved **0.0% mAP and only 6% NDS** -- effectively failing completely. DINOv2 works best as a **semantic feature enrichment module** or through **adapter-mediated integration** rather than a naive backbone swap. The ViT patch-token outputs require architectural adaptation (feature pyramid, resolution matching, adapter modules) to interface with existing detection heads.

---

## 4. DINOv2 as Backbone in BEVFusion

### RCDINO: Radar-Camera Fusion with DINOv2

**Paper:** "RCDINO: Enhancing Radar-Camera 3D Object Detection with DINOv2 Semantic Features" (arXiv:2508.15353, August 2025)

RCDINO integrates DINOv2 into the RCTrans radar-camera fusion pipeline via a lightweight adapter module:

**Architecture:**
1. **Visual Encoder:** Standard ResNet backbone extracts initial visual features
2. **DINOv2 Adapter:** Three-stage bidirectional module:
   - *Injection:* ResNet features injected into DINOv2 intermediate layers via deformable attention with learnable scalar gate
   - *Inference:* DINOv2 processes normally, propagating injected features through transformer layers
   - *Extraction:* Convolutional extractors with spatial feedback retrieve task-specific representations, interpolated and projected to backbone dimensions via learnable fusion layer
3. **Radar Encoders:** Sparse and dense radar encoding
4. **Sequential Transformer Decoder:** Final detection

**DINOv2 configuration:** DINOv2-small, patch size 14x14, input resized to 224x448, features extracted from 4 intermediate layers.

**nuScenes results:**

| Model | NDS | mAP | Latency (ms/frame) |
|-------|-----|-----|-------------------|
| RCTrans (R18 baseline) | 56.0 | 47.4 | 48.9 |
| **RCDINO (R18 + DINOv2)** | **56.4** | **48.1** | **85.2** |
| RCDINO (R50 + DINOv2) | 59.0 | 51.4 | 156.9 |

RCDINO achieves SOTA among radar-camera models but at the cost of nearly doubled inference latency. The DINOv2 features particularly help with challenging categories: truck, bus, construction vehicle, pedestrian, bicycle, and barrier.

### Multi-Modal Fusion Pattern

The general pattern for using DINOv2 in multi-modal fusion (camera + LiDAR or camera + radar):

1. **Do not replace** the existing camera backbone -- keep ResNet/ConvNeXt for the primary feature stream
2. **Add DINOv2 as a parallel semantic branch** with a lightweight adapter
3. **Fuse DINOv2 features into the primary stream** via attention or concatenation before the BEV transform
4. **Freeze DINOv2 weights** to avoid catastrophic forgetting and reduce training compute

This pattern preserves the geometric precision of task-specific backbones while enriching them with DINOv2's semantic understanding.

---

## 5. DINOv2 for Depth Estimation

### Depth Anything V2 (NeurIPS 2024)

**Paper:** "Depth Anything V2: A More Capable Foundation Model for Monocular Depth Estimation" (NeurIPS 2024)

Depth Anything V2 uses DINOv2 as its encoder backbone with a DPT (Dense Prediction Transformer) decoder:

**Architecture:**
- **Encoder:** DINOv2 ViT (S/B/L/G variants), providing multi-scale feature representations
- **Decoder:** DPT-style four-stage multi-scale fusion with upsampling and convolution
- **Feature selection:** V2 uses intermediate layer features (correcting V1 which unintentionally used last-4-layer features)

**Training pipeline:**
1. Train teacher on 595K synthetic labeled images (high-quality ground truth)
2. Generate pseudo-labels on 62M+ unlabeled real images using the teacher
3. Train student models via distillation on pseudo-labeled real data

**Performance:**
- 10-15x faster than diffusion-based methods (Marigold)
- DA-V2-Small: real-time (~30ms per image on RTX 3090)
- State-of-the-art accuracy across indoor and outdoor benchmarks

**Driving applications:** The frozen DINOv2 features provide rich semantic priors that help resolve depth ambiguities in driving scenes. The self-supervised pre-training on 142M diverse images means the depth model generalizes to unusual objects (construction equipment, fallen debris) that supervised depth models may fail on.

### DINOv2 + Metric3Dv2 for Driving Depth

In the BEV perception context (Section 3 above), Metric3Dv2 provides metric depth maps that are converted to point clouds for pseudo-LiDAR applications. When combined with DINOv2 features, this achieves +3 IoU improvement over camera-only models (though still 13.4 IoU below actual LiDAR).

### DINO-SD for Robust Multi-View Depth

The DINO-SD model (RoboDrive Challenge 2024) uses pre-trained DINOv2 as encoder with M-DPT and DPT decoders for robust multi-view depth estimation under challenging driving conditions (rain, night, fog).

---

## 6. DINOv2 for Open-World Segmentation

### PROWL: Zero-Shot OOD Detection with DINOv2

**Paper:** "Finding Dino: A Plug-and-Play Framework for Zero-Shot Detection of Out-of-Distribution Objects Using Prototypes" (arXiv:2404.07664, 2024)

PROWL uses frozen DINOv2 features (ViT-S/14) to detect out-of-distribution objects without any domain-specific training:

**Three-stage pipeline:**
1. **Prototype Feature Bank:** Extract DINOv2 features from a minimal number of known-class samples (5-20 per class). Spatial averaging creates class prototype vectors.
2. **Prototype Matching:** At inference, compare test image features against prototypes using cosine similarity. Pixels below threshold (default 0.55) flagged as OOD using inverse normalized cosine similarity.
3. **Refinement:** Combine with unsupervised segmentation (CutLER/STEGO) for instance-level masks.

**Road driving benchmark results:**

| Dataset | AUPRC | FPR | IoU | F1 |
|---------|-------|-----|-----|-----|
| RoadAnomaly | 75.25 | 1.75 | 75.22 | 85.25 |
| RoadObstacle | 73.53 | 5.58 | 49.16 | 53.31 |
| Fishyscapes Static | 70.27 | 8.21 | 64.79 | 72.18 |

PROWL outperforms supervised methods trained without auxiliary OOD data on RoadObstacle. It generalizes zero-shot to rail and maritime domains.

### DINOv2 + Grounding DINO + SAM2

The combined pipeline for open-vocabulary segmentation:

1. **Grounding DINO** takes text prompts and produces bounding boxes for objects matching the description
2. **SAM2** generates precise segmentation masks within the bounding boxes
3. **DINOv2 features** provide semantic embeddings for instance identification and open-set classification

This pipeline enables detecting and segmenting objects described in natural language without any task-specific training. The Grounded SAM 2 framework (IDEA Research, 2025) supports this workflow with DINO-X for improved open-world perception.

### NIDS-Net: Novel Instance Detection and Segmentation

NIDS-Net combines Grounding DINO and SAM to generate foreground object proposals, then uses DINOv2 foreground feature averages of patch embeddings for instance embedding generation, enabling detection of novel object instances without prior training.

### CLIP + DINOv2 Multimodal Fusion

Zero-shot anomaly detection frameworks leverage multimodal feature fusion where CLIP's global semantic embeddings are hierarchically aligned with DINOv2's multi-scale structural features via Dual-Modality Attention mechanisms. This combines CLIP's language grounding with DINOv2's superior spatial understanding.

---

## 7. Fine-Tuning Strategies

### Strategy Comparison

| Strategy | Trainable Params (ViT-B) | Training Time | Accuracy | Risk |
|----------|--------------------------|---------------|----------|------|
| **Frozen + linear head** | ~1-5M (head only) | Fastest | Good baseline | None (features preserved) |
| **LoRA (rank 32)** | ~1-3M | Fast | Best tradeoff | Low (minimal weight perturbation) |
| **Full fine-tuning** | 86M (all) | Slowest | Domain-optimal but risky | High (catastrophic forgetting) |

### Frozen Features

DINOv2 is designed to produce features usable without fine-tuning. Common frozen configurations:

- **Linear probe:** Single linear layer on [CLS] token for classification
- **MLP head:** Small MLP on patch tokens for dense prediction
- **k-NN classifier:** Direct nearest-neighbor lookup in feature space
- **Frozen encoder + trainable decoder:** DPT or FPN decoder trained on frozen DINOv2 features

Frozen DINOv2 consistently outperforms other self-supervised and weakly supervised features on most benchmarks. Training only the decoder means 5M trainable parameters for ViT-B (vs 86M for full fine-tuning).

### LoRA Adaptation

Low-Rank Adaptation injects small trainable matrices into attention layers: W' = W + BA, where A and B have rank r.

**Optimal configuration for BEV tasks:**
- **Rank 32** provides the best balance (rank 64 shows 0.1 mIoU decrease from losing pre-training inductive bias)
- Apply to query (Q) and value (V) projections only
- Updates only **1.12% of ViT-B** and **2.70% of ViT-L** parameters

**Published results (LoRA vs full fine-tuning):**
- LoRA-adapted DINOv2 shows **1.7% improvement over standard fine-tuning** in classification tasks
- **2.7% increase in ROC AUC** compared to best existing approaches
- **85M fewer trainable parameters**
- Training **25.8% faster** than full fine-tuning

**BEV-specific LoRA results (SimpleBEV):**
- ViT-B with LoRA: 42.3 mIoU (matching ResNet-101 with 37x fewer parameters)
- ViT-L with LoRA: 43.4 mIoU at 224x392, 47.6 mIoU at 392x700

### Full Fine-Tuning

Generally not recommended for DINOv2 in driving applications because:

1. **Catastrophic forgetting** destroys the general visual understanding learned from 142M images
2. **Compute prohibitive** for large ViT backbones (304M+ params for ViT-L)
3. **Overfitting risk** on limited driving datasets
4. **Robustness degradation** -- frozen/LoRA models maintain better OOD generalization

Full fine-tuning may be justified when: (a) the target domain is radically different from natural images, (b) extremely large in-domain datasets are available, or (c) the downstream task requires fundamentally different feature representations.

### Practical Recommendation for Airside AV

Use **LoRA rank 32 on ViT-B or ViT-L** as the default strategy:
- Preserves DINOv2's ability to represent novel objects (unseen GSE types)
- Adapts spatial features to the specific camera geometry and viewpoints of airside vehicles
- 1-3M trainable parameters keeps training feasible on limited compute
- Robustness under environmental corruption (darkness, rain, fog) is significantly better than fine-tuned models

---

## 8. SigLIP as an Alternative

### Architecture Differences

| Property | DINOv2 | SigLIP / SigLIP 2 |
|----------|--------|--------------------|
| Training signal | Self-supervised (no text) | Image-text pairs (sigmoid loss) |
| Loss function | DINO + iBOT + KoLeo | Sigmoid binary classification on all image-text pairs |
| Text encoder | None | Transformer text tower |
| Pre-training data | 142M images (LVD-142M) | Billions of image-text pairs from web |
| Dense feature quality | Excellent (designed for it) | Improved in SigLIP 2, but still behind DINOv2 |
| Zero-shot classification | Requires adapter | Native (via text prompts) |
| Multilingual support | No | Yes (SigLIP 2) |

### SigLIP 2 (Google, February 2025)

SigLIP 2 extends the original training with:
- **LocCa loss:** Transformer decoder for captioning, referring expressions, and grounded captioning
- **Self-distillation + masked prediction:** Student sees partial view, trained to match teacher's full-image representation with 50% patch masking
- **Online data curation** during training

### When to Prefer Each

**Prefer DINOv2 when:**
- Dense prediction tasks dominate (segmentation, depth, BEV encoding)
- Robustness to domain shift is critical
- Features will be used frozen (DINOv2's primary design goal)
- Spatial/geometric precision matters more than semantic labeling
- PASCAL VOC segmentation: DINOv2 83.1 mIoU vs SigLIP 2 72.7 mIoU

**Prefer SigLIP 2 when:**
- Zero-shot classification via text prompts is needed
- Multilingual text-visual alignment is required
- The system needs to interface with VLMs/LLMs (SigLIP 2 excels as VLM vision encoder)
- Image-text retrieval or captioning is a primary task

**For airside AV:** DINOv2 is the stronger choice for perception backbone tasks (BEV segmentation, depth estimation, object detection). SigLIP 2 is useful if the system includes a VLM component for scene understanding or natural language interaction.

---

## 9. EVA / InternVL / InternImage Comparison

### EVA-02 (BAAI, 2023)

- **Architecture:** ViT with SwiGLU FFN, sub-LN, 2D RoPE
- **Training:** Masked image modeling to reconstruct CLIP-aligned features
- **Key result:** 304M parameters achieving 90.0% top-1 on ImageNet-1k
- **vs DINOv2:** DINOv2 outperforms EVA-02 by **+4.8 mIoU** on in-target segmentation and **+2.9 mIoU** on out-of-target (domain generalization)
- **Strengths:** Strong detection performance, efficient for its size
- **Weakness:** CLIP dependency during pre-training means less purely visual features

### InternImage (Shanghai AI Lab, CVPR 2023)

- **Architecture:** CNN-based (not ViT), using **Deformable Convolution v3 (DCNv3)** as core operator
- **Key insight:** Large-scale CNNs can match ViTs when using adaptive spatial aggregation
- **Detection result:** InternImage-XL with BEVFormer v2 achieves 63.4 NDS on nuScenes camera-only
- **DCNv4 update (2024):** FlashInternImage with DCNv4 provides up to 80% speedup
- **Advantage over ViTs:** No quadratic attention cost; naturally handles multi-scale features
- **Disadvantage:** Requires task-specific training; no frozen feature paradigm like DINOv2

### InternVL / InternViT-6B (Shanghai AI Lab, CVPR 2024 Oral)

- **Architecture:** ViT scaled to 6B parameters with optimized depth/head-dim/MLP ratios
- **Training:** Contrastive learning aligned with LLaMA-based language middleware
- **Driving result:** InternVL-1.5 achieved 0.6002 score on CVPR 2024 Autonomous Grand Challenge (Driving with Language track)
- **InternVL2.5:** Fine-tuned on driving reasoning datasets shows 7.49% better answer accuracy
- **InternVL3.5 (2025):** SOTA among open-source multimodal LLMs
- **vs DINOv2:** Designed for VLM applications, not perception backbones. InternViT produces language-aligned features, DINOv2 produces purely visual features.

### Comparison Summary for Driving Perception

| Model | Type | Dense Feature Quality | Zero-Shot | 3D Det. Proven | Edge-Deployable |
|-------|------|----------------------|-----------|----------------|-----------------|
| DINOv2 ViT-B | SSL ViT | Excellent | Via adapter | Yes (adapter) | Yes (86M params) |
| DINOv2 ViT-L | SSL ViT | Best | Via adapter | Yes | Marginal (304M) |
| EVA-02 | CLIP-MIM ViT | Good | Yes (CLIP) | Yes | Yes (304M) |
| InternImage-XL | DCN CNN | Good | No | Yes (SOTA) | Marginal |
| InternViT-6B | VLM ViT | Good | Yes (text) | Emerging | No (6B params) |
| SigLIP 2 | VL ViT | Moderate | Yes (text) | Emerging | Yes (various) |

**Recommendation for airside:** DINOv2 ViT-B or ViT-L provides the best tradeoff for perception backbone tasks. InternImage is competitive for pure detection but lacks the frozen-feature and zero-shot benefits. InternVL is best suited as a VLM component rather than a perception backbone.

---

## 10. Practical Deployment

### DINOv2 ViT-B Inference Latency

**Desktop GPU benchmarks (RTX 4090, TensorRT 10.8):**

| Configuration | Latency (ms) |
|---------------|-------------|
| FP32 | 0.93 |
| FP16 | 0.93 |
| INT8 PTQ | 0.98 |
| INT8 SmoothQuant | 0.90 |

**Jetson AGX Orin benchmarks (TensorRT 10.4, DINOv2-S):**

| Configuration | GPU Compute (ms) | Throughput (qps) |
|---------------|-----------------|-----------------|
| FP32 | 23.2 | 39.1 |
| FP16 | 23.1 | 42.7 |
| INT8 PTQ | 22.1 | 44.9 |
| INT8 SmoothQuant | 22.0 | 45.1 |

**Important note:** FP16 provides minimal speedup over FP32 for transformer architectures on these platforms. NVIDIA recommends using ModelOpt to insert Q/DQ operations for proper INT8/FP8 acceleration on transformers.

**Estimated ViT-B latency on Jetson AGX Orin:** Based on the 4x parameter increase from ViT-S to ViT-B and quadratic attention scaling with more heads, expect approximately **60-90ms per frame at 518x518** with TensorRT FP16 on AGX Orin. This is marginal for real-time driving at 10Hz but feasible at 5Hz or as a parallel semantic branch.

### Memory Footprint

| Model | PyTorch (CPU) | Optimized (GGML/C++) | INT4 Quantized |
|-------|--------------|---------------------|----------------|
| ViT-S | 455 MB | 110 MB | 49 MB |
| ViT-B | 720 MB | 367 MB | 129 MB |
| ViT-L | 1.55 GB | 1.2 GB | 371 MB |
| ViT-g | 4.8 GB | 4.4 GB | 1.28 GB |

For Jetson AGX Orin (32GB or 64GB VRAM), ViT-B at 367-720MB is comfortably within budget even alongside other perception models. ViT-L at 1.2-1.55GB is feasible but requires careful memory management with concurrent models.

### CPU Inference Latency (Intel i9-14900HX, GGML)

| Model | Non-Quantized (ms) | INT4 Quantized (ms) | Speedup |
|-------|-------------------|--------------------|---------|
| ViT-S | 62-64 | 46-52 | ~1.3x |
| ViT-B | 197-200 | 136-141 | ~1.4x |
| ViT-L | 597-600 | 389-395 | ~1.5x |
| ViT-g | 1969-1995 | 1268-1275 | ~1.6x |

### TensorRT Compatibility

**Conversion pipeline:** PyTorch model -> ONNX export -> trtexec -> TensorRT engine (.engine)

**Known issues:**
- DINOv2 FMHA (Fused Multi-Head Attention) fusion failures reported in TensorRT 10.8 with ONNX export
- FP8 quantization causes severe performance degradation (92ms vs 23ms baseline on Orin) -- avoid FP8 for now
- Mixed precision (FP16) shows inconsistent speedups on some platforms due to transformer kernel optimization gaps
- Register tokens may need special handling in ONNX export

**NVIDIA nv-dinov2 (NGC):**
NVIDIA offers an optimized variant trained on proprietary 130M-700M image datasets:
- Supports input from 224x224 to 518x518
- ViT-L variant, 1024-dim embeddings
- Optimized for TensorRT on Ampere, Hopper, Lovelace, Jetson
- Performance: H100 batch-64 @ 2500 FPS; A100 batch-32 @ 1031 FPS (224x224 FP16)
- Includes TAO Toolkit integration for transfer learning

### Handling the 518x518 Resolution Requirement

DINOv2 was pre-trained at 224x224 with a short fine-tuning phase at 518x518. The 518x518 resolution is optimal but not strictly required.

**Resolution strategies:**
1. **Use 518x518:** Best feature quality. For multi-camera setups, resize each camera image to 518x518 before processing. This is the safest option.
2. **Use native resolution with position embedding interpolation:** DINOv2 supports arbitrary resolutions that are multiples of 14. Positional embeddings are bicubically interpolated to match the new patch grid. Works well for resolutions close to training resolution.
3. **Multi-scale processing:** Process at 224x224 for speed-critical paths and 518x518 for quality-critical paths.
4. **Resolution-specific fine-tuning:** Brief LoRA adaptation at the target resolution (e.g., 448x800 for driving cameras) helps the model adapt positional embeddings.

**For airside cameras:** Typical driving cameras produce 1920x1080 or similar. Options:
- Center-crop and resize to 518x518 (loses peripheral context)
- Resize to 518x924 (14x multiples, maintains aspect ratio, requires position interpolation)
- Use overlapping 518x518 crops with feature stitching
- Use 224x392 (as in RCDINO) for real-time speed, accepting some feature quality loss

**DINOv3 improvement:** DINOv3 (Meta, 2025) replaces learned positional embeddings with RoPE + RoPE jittering for better stability across resolutions, alleviating this concern for future deployments.

---

## 11. Airside Application: Detecting Novel GSE Types

### The Problem

Airport airside environments contain a diverse and constantly evolving set of Ground Support Equipment (GSE): baggage tractors, catering trucks, fuel bowsers, GPU carts, lavatory trucks, cargo loaders, pushback tugs, de-icing vehicles, passenger stairs, belt loaders, and more. New equipment variants, custom modifications, and manufacturer-specific designs mean that a closed-set detector trained on known GSE types will inevitably encounter **novel objects it has never seen**.

This is a safety-critical gap: the AV must detect and avoid all objects on the apron, not just the ones it was trained on.

### How Foundation Model Features Help

**1. Rich semantic representation without category labels:**
DINOv2 features encode object shape, texture, and part structure without being tied to specific category names. A novel GSE type (e.g., a new autonomous baggage robot) will still produce a distinctive feature vector because DINOv2 has learned general "objectness" from 142M images.

**2. Zero-shot OOD detection (PROWL approach):**
Using the PROWL framework with frozen DINOv2 features:
- Build a prototype bank from 5-20 examples of each known GSE type
- At inference, any object with features dissimilar to all prototypes (cosine similarity < threshold) is flagged as "unknown object"
- On driving benchmarks: 75.25 AUPRC on RoadAnomaly, successfully generalizes to rail and maritime domains
- For airside: flag novel GSE for cautious behavior (slow down, yield, alert operator)

**3. Few-shot adaptation:**
When a new GSE type enters service, add just 5-20 labeled images to update the prototype bank -- no model retraining required. The frozen DINOv2 features are discriminative enough for k-NN classification with minimal examples.

**4. Open-vocabulary detection via Grounding DINO + SAM:**
For GSE that can be described in text (e.g., "yellow baggage tractor", "tall catering truck with lift"), Grounding DINO provides text-prompted detection and SAM provides precise segmentation. DINOv2 features complement this by providing semantic embeddings for instance differentiation.

**5. Robustness to environmental variation:**
Airside environments feature harsh lighting (night ops, apron floodlights, low sun angles), weather (rain, snow, de-icing spray), and surface variations (wet tarmac, painted markings). DINOv2's self-supervised training on diverse images provides inherent robustness:
- ViT-L maintains >60% performance under darkness (SimpleBEV drops below 30%)
- ViT-L achieves 2.5x SimpleBEV performance under motion blur
- Frozen features are more robust than fine-tuned features under domain shift

### Practical Airside Pipeline

```
Airside camera images (6-8 surround cameras)
              |
              v
     DINOv2 ViT-B/14 (frozen, LoRA rank 32)
              |
     +--------+--------+
     |        |        |
     v        v        v
  BEV        Depth    OOD Detection
  Segm.    (Depth     (PROWL prototypes
  (LSS)   Anything)   for known GSE)
     |        |        |
     v        v        v
  BEV fusion grid    Unknown object
  (vehicles,         alerts
   drivable area,
   lane markings)
              |
              v
      Planning & control
```

### Key Advantages for Airside vs Road Driving

1. **Lower speed requirement:** Airside vehicles typically operate at 5-25 km/h, relaxing the real-time constraint from 10Hz to 5Hz, making ViT-B latency (~60-90ms on Orin) acceptable
2. **Higher safety margin:** Zero-shot OOD detection is especially valuable because airside collisions can damage aircraft worth hundreds of millions of dollars
3. **Controlled environment:** Despite GSE diversity, the environment is more constrained than public roads, making prototype-based detection more reliable
4. **Regulatory alignment:** The FAA's CertAlert 24-02 supports AGVS testing in controlled environments; demonstrating novel object detection capability strengthens the safety case

---

## 12. DINOv3: The Next Generation (August 2025)

While DINOv2 remains the current practical choice, DINOv3 addresses several of its limitations:

**Key improvements:**
- **Scale:** 7B-parameter teacher trained on 1.7B images (vs 1.1B params on 142M images)
- **Gram Anchoring:** New loss function that prevents dense feature degradation during long training -- a fundamental problem in DINOv2 where global metrics improve but local (segmentation/depth) features erode
- **RoPE positional embeddings:** Replace learned embeddings, enabling resolution-flexible inference without interpolation artifacts
- **Performance:** +6 mIoU on ADE20k segmentation, +6.7 J&F-Mean on video tracking, +10.9 GAP on instance retrieval vs DINOv2
- **Distilled variants:** ViT-B and ViT-L distilled from ViT-7B, plus ConvNeXt variants (T/S/B/L) for different compute budgets

**When to adopt DINOv3 for airside:**
- Once TensorRT-optimized variants are available for Jetson Orin
- If the ConvNeXt distilled variants provide better latency/accuracy tradeoffs than DINOv2 ViT-B
- For the resolution flexibility (RoPE) which eliminates positional embedding interpolation issues with non-standard camera resolutions

---

## Summary: Actionable Recommendations

1. **Start with DINOv2 ViT-B/14 + LoRA rank 32** as the perception backbone. This provides the best compute/accuracy/robustness tradeoff for airside deployment on Jetson AGX Orin.

2. **Use the frozen-feature paradigm** for OOD detection (PROWL) and few-shot GSE classification. This requires no model changes when new equipment appears.

3. **Integrate via adapter modules, not direct backbone replacement.** RCDINO's adapter pattern and the LSS integration pattern are proven approaches.

4. **Pair with Depth Anything V2** for monocular depth estimation using the same DINOv2 backbone features.

5. **Target 5Hz perception** for airside speeds. This provides a comfortable latency budget of 200ms per frame, well within ViT-B's capability on AGX Orin.

6. **Plan for DINOv3 migration** once edge-optimized models are available, particularly for the resolution flexibility and improved dense features.

7. **Use SigLIP 2 only if adding a VLM/LLM component** for scene reasoning or natural language interfaces.

---

## Sources

- [DINOv2: Learning Robust Visual Features without Supervision (arXiv:2304.07193)](https://arxiv.org/abs/2304.07193)
- [DINO Pre-training for Vision-based End-to-end Autonomous Driving (arXiv:2407.10803)](https://arxiv.org/abs/2407.10803)
- [Revisiting BEV Perception with Frozen Foundation Models: DINOv2 and Metric3Dv2 (arXiv:2501.08118)](https://arxiv.org/html/2501.08118)
- [Robust BEV Segmentation by Adapting DINOv2 (arXiv:2409.10228)](https://arxiv.org/html/2409.10228v1/)
- [DualViewDistill: Foundation Model Guided BEV Maps (arXiv:2510.10287)](https://arxiv.org/html/2510.10287)
- [RCDINO: Enhancing Radar-Camera 3D Detection with DINOv2 (arXiv:2508.15353)](https://arxiv.org/abs/2508.15353)
- [Finding Dino / PROWL: Zero-Shot OOD Detection Using Prototypes (arXiv:2404.07664)](https://arxiv.org/html/2404.07664v2)
- [Depth Anything V2 (NeurIPS 2024)](https://github.com/DepthAnything/Depth-Anything-V2)
- [SigLIP 2: Multilingual Vision-Language Encoders (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786)
- [DINOv3 (arXiv:2508.10104)](https://arxiv.org/abs/2508.10104)
- [DINOv2 GitHub Repository](https://github.com/facebookresearch/dinov2)
- [DINOv2 Model Card](https://github.com/facebookresearch/dinov2/blob/main/MODEL_CARD.md)
- [NVIDIA nv-dinov2 NIM](https://build.nvidia.com/nvidia/nv-dinov2/modelcard)
- [DINOv2 TensorRT Issues (GitHub NVIDIA/TensorRT #4348)](https://github.com/NVIDIA/TensorRT/issues/4348)
- [DINOv2.cpp: Accelerating Edge Inference](https://alexlavaee.me/projects/dinov2cpp/)
- [DINOv2 Inference Speed Discussion (GitHub #191)](https://github.com/facebookresearch/dinov2/issues/191)
- [Optimizing Vision Transformers on Jetson AGX Orin (Embedl)](https://www.embedl.com/optimizing-vision-transformers-for-peak-performance-on-nvidia-jetson-agx-orinvidia-jetson-agx-orin)
- [EVA-02: A Visual Representation for Neon Genesis](https://arxiv.org/pdf/2303.11331)
- [InternVL: Scaling up Vision Foundation Models (CVPR 2024)](https://openaccess.thecvf.com/content/CVPR2024/papers/Chen_InternVL_Scaling_up_Vision_Foundation_Models_and_Aligning_for_Generic_CVPR_2024_paper.pdf)
- [InternImage: Large-Scale Vision Foundation Models with Deformable Convolutions](https://arxiv.org/abs/2211.05778)
- [BEVFusion: Multi-Task Multi-Sensor Fusion](https://arxiv.org/abs/2205.13542)
- [Grounded SAM 2 (IDEA Research)](https://github.com/IDEA-Research/Grounded-SAM-2)
- [FAA CertAlert on Autonomous Ground Vehicle Systems](https://www.faa.gov/airports/new_entrants/agvs_on_airports)
- [Foundation Models for Autonomous Driving Perception Survey (arXiv:2509.08302)](https://arxiv.org/html/2509.08302v1)
- [A Survey for Foundation Models in Autonomous Driving (arXiv:2402.01105)](https://arxiv.org/html/2402.01105v1)
