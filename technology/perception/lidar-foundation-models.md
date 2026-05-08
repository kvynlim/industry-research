# LiDAR Foundation Models & 3D Point Cloud Pre-training for Autonomous Driving

## Comprehensive Technical Survey (2022-2026) for LiDAR-Primary Airside AV

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [3D Point Cloud Pre-training / Self-Supervised Learning](#2-3d-point-cloud-pre-training)
3. [LiDAR Foundation Models & Efficient 3D Backbones](#3-lidar-foundation-models)
4. [Multi-modal 3D Foundation Models (Language-3D Alignment)](#4-multi-modal-3d-foundation-models)
5. [Pre-training to Fine-tuning Pipeline](#5-pre-training-to-fine-tuning-pipeline)
6. [Practical Deployment on NVIDIA Orin](#6-practical-deployment)
7. [LiDAR World Models & Generation](#7-lidar-world-models)
8. [Latest 2025-2026 Advances](#8-latest-advances)
9. [Comparative Summary Table](#9-comparative-summary)
10. [Recommendations for LiDAR-Primary Airside AV](#10-recommendations)
11. [References](#11-references)

---

## 1. Executive Summary

LiDAR foundation models and 3D point cloud pre-training have matured rapidly from 2022-2026, evolving from object-level pre-training (Point-BERT, Point-MAE) to scene-level driving-specific methods (AD-PT, GD-MAE, BEV-MAE) and now to universal 3D encoders (Sonata, Concerto, Utonia) that span indoor, outdoor, and object domains.

### Key Findings for LiDAR-Primary Airside AV

1. **Pre-training saves 50-80% of labeled data.** GD-MAE achieves comparable accuracy with only 20% of Waymo labels. GPC outperforms full-dataset training-from-scratch using just 20% of KITTI labels. PSA-SSL matches SOTA with 10x fewer labels.

2. **The Pointcept stack (PTv3 + Sonata/Concerto) is the current SOTA.** PTv3 (CVPR 2024 Oral) is 3x faster and 10x more memory-efficient than PTv2. Sonata (CVPR 2025 Highlight) provides self-supervised pre-trained weights. Concerto (NeurIPS 2025) adds 2D-3D joint learning, outperforming standalone 3D SSL by 4.8%.

3. **FlatFormer is the path to real-time transformer-based LiDAR on Orin.** 4.6x faster than SST, 1.4x faster than CenterPoint -- the first point cloud transformer achieving real-time on edge GPUs.

4. **DSVT with TensorRT achieves 27 Hz** on A100, with a pillar variant reaching 37ms latency. Community TensorRT implementations exist.

5. **ScaLR provides the best LiDAR-only self-supervised features** via DINOv2-to-LiDAR distillation, reaching 67.8% mIoU linear probing on nuScenes. Directly applicable to a multi-LiDAR stack.

6. **No airside-specific LiDAR pre-training exists.** Road driving pre-training transfers, but domain adaptation (LoRA, adapters, or DADT) is needed. PointLoRA (CVPR 2025) provides parameter-efficient fine-tuning specifically for point clouds.

7. **LiDAR world models have emerged.** Copilot4D (ICLR 2024) reduces point cloud forecasting error by 65%. LiDARCrafter (AAAI 2026 Oral) enables 4D LiDAR scene generation from language prompts.

8. **Open-vocabulary 3D is bridged via CLIP alignment.** ULIP-2 (CVPR 2024) and OpenScene (CVPR 2023) enable language-queried 3D understanding. Concerto includes a CLIP translator for open-world 3D perception.

---

## 2. 3D Point Cloud Pre-training / Self-Supervised Learning

### 2.1 Point-BERT (CVPR 2022)

**Paper:** "Pre-training 3D Point Cloud Transformers with Masked Point Modeling"
**Authors:** Yu et al. (Tsinghua, Shanghai AI Lab)
**GitHub:** 677 stars | MIT License

**Architecture:**
- Discrete VAE (dVAE) tokenizer converts local point patches into discrete tokens
- Standard Transformer backbone trained via Masked Point Modeling (MPM): masks random patches, predicts original tokens
- Two-stage training: (1) train dVAE tokenizer, (2) pre-train transformer with MPM

**Key Results:**
| Benchmark | Metric | Score |
|-----------|--------|-------|
| ModelNet40 | Accuracy | 93.8% |
| ScanObjectNN (hardest) | Accuracy | 83.1% |
| Few-shot (5-way 10-shot) | Accuracy | Strong transfer |

**Airside Relevance:** Pioneered BERT-style pre-training for 3D. The few-shot transfer capability is relevant for learning to recognize novel airside objects (GSE, aircraft variants) with minimal labeled data. However, trained on object-level datasets (ShapeNet, ModelNet), not driving-scale point clouds.

**Limitation:** Object-level only. Does not handle large-scale outdoor LiDAR scenes directly.

---

### 2.2 Point-MAE (ECCV 2022)

**Paper:** "Masked Autoencoders for Point Cloud Self-supervised Learning"
**Authors:** Pang et al.
**GitHub:** 622 stars

**Architecture:**
- Divides point cloud into irregular patches, randomly masks at high ratio (60-80%)
- Standard Transformer autoencoder with asymmetric design (heavy encoder, light decoder)
- Shifting mask tokens operation adapted for point cloud properties
- Purely reconstruction-based objective (no tokenizer needed, unlike Point-BERT)

**Key Results:**
| Benchmark | Metric | Score |
|-----------|--------|-------|
| ScanObjectNN (hardest) | Accuracy | 85.18% |
| ModelNet40 | Accuracy | 94.04% |
| Few-shot (5-way 10-shot) | Accuracy | 96.3% +/- 2.5 |
| ShapeNetPart | mIoU | 86.1% |

**Airside Relevance:** Simpler than Point-BERT (no dVAE needed), better results. Demonstrated that a simple masked reconstruction objective learns powerful 3D features. Foundation for all subsequent MAE-based 3D methods.

**Limitation:** Same as Point-BERT -- object-level, not directly applicable to driving-scale scenes.

---

### 2.3 PointGPT (NeurIPS 2023)

**Paper:** "Auto-regressively Generative Pre-training from Point Clouds"
**Authors:** Chen et al. (Beijing Institute of Technology)
**GitHub:** 245 stars

**Architecture:**
- Partitions point cloud into irregular patches, orders via Morton (Z-order) curve
- Extractor-generator Transformer decoder with dual masking strategy
- Auto-regressive prediction of next point patches (GPT-style, not BERT-style)
- Three variants: PointGPT-S (small), PointGPT-B (base), PointGPT-L (large)

**Key Results:**
| Benchmark | Metric | Score |
|-----------|--------|-------|
| ModelNet40 | Accuracy | 94.9% (PointGPT-L) |
| ScanObjectNN (hardest) | Accuracy | 93.4% (PointGPT-L) |
| Few-shot (5-way 10-shot) | Accuracy | 98.0% +/- 1.9 |
| ShapeNetPart | mIoU | 86.6% (PointGPT-L) |

**Airside Relevance:** Best object-level pre-training results. The auto-regressive formulation learns generative representations that better capture 3D structure than masked reconstruction. Strong few-shot capabilities. However, still object-level.

---

### 2.4 GD-MAE (CVPR 2023)

**Paper:** "Generative Decoder for MAE Pre-training on LiDAR Point Clouds"
**Authors:** Yang et al.
**GitHub:** 124 stars

**Architecture:**
- **First MAE method designed specifically for outdoor LiDAR point clouds**
- Generative decoder that hierarchically merges surrounding context to restore masked geometric knowledge
- Works with voxel-based 3D backbones (VoxelBackBone, SECOND)
- Compatible with CenterPoint and PV-RCNN detection heads

**Key Results:**
| Dataset | Metric | Score | Notes |
|---------|--------|-------|-------|
| Waymo (Vehicle L1) | mAPH | 80.2/79.8 | Two-stage |
| KITTI (Car) | AP | 82.01 | Moderate |
| ONCE (Vehicle) | AP | 76.79 | vs 74.10 baseline |

**Critical Data Efficiency Result:**
- **Achieves comparable accuracy with only 20% of labeled Waymo data** -- the GD-MAE_0.2 variant demonstrates that pre-training on unlabeled data followed by fine-tuning on 20% of labels matches or approaches full-label performance.

**Airside Relevance:** HIGH. This is directly applicable to the Aurrigo stack. GD-MAE works with the same voxel-based backbones used by CenterPoint (already documented in `openpcdet-centerpoint.md`). The 80% label reduction directly addresses the zero-airside-dataset problem -- pre-train on unlabeled airside LiDAR sweeps, fine-tune with minimal annotations.

---

### 2.5 AD-PT (NeurIPS 2023)

**Paper:** "Autonomous Driving Pre-Training with Large-scale Point Cloud Dataset"
**Authors:** Yuan et al. (Shanghai AI Lab)
**GitHub:** Available

**Architecture:**
- Formulates pre-training as semi-supervised learning: few-shot labeled + massive unlabeled data
- First to build a large-scale, diverse pre-training point cloud dataset spanning multiple driving domains
- Compatible with PV-RCNN++, SECOND, CenterPoint backbones
- Cross-dataset transfer: pre-train on combined data, fine-tune on target domain

**Key Results:**
- Significant improvements on Waymo, nuScenes, and KITTI across all tested backbones (PV-RCNN++, SECOND, CenterPoint)
- Key innovation: unlike prior methods that pre-train and fine-tune on the same benchmark, AD-PT enables cross-dataset generalization
- Pre-training on diverse data distribution improves downstream performance beyond single-dataset pre-training

**Airside Relevance:** HIGH. AD-PT's cross-dataset transfer paradigm is exactly what airside needs -- pre-train on diverse road driving LiDAR data (Waymo + nuScenes + KITTI), then fine-tune on airside data. The semi-supervised formulation means even a small number of labeled airside samples combined with unlabeled airside sweeps can be effective.

---

### 2.6 Occupancy-MAE (IEEE TIV 2023)

**Paper:** "Self-supervised Pre-training Large-scale LiDAR Point Clouds with Masked Occupancy Autoencoders"
**Authors:** Min et al.
**GitHub:** 280 stars

**Architecture:**
- Designed specifically for voxel-based large-scale outdoor LiDAR
- Range-aware random masking strategy (accounts for LiDAR density variation with distance)
- Pretext task: binary occupancy prediction (does a voxel contain points?)
- Even with 90% masking ratio, learns representative features
- Compatible with SECOND, CenterPoint, PV-RCNN detectors

**Key Results:**
| Task | Dataset | Improvement |
|------|---------|------------|
| 3D Detection (Car) | KITTI | Reduces labeled data by 50% for car detection |
| 3D Detection (Small objects) | Waymo | ~2% AP improvement |
| 3D Segmentation | Multiple | ~2% mIoU improvement |

**Airside Relevance:** HIGH. The occupancy prediction pretext task is particularly well-suited for airside because occupancy awareness is fundamental for safe navigation. The 50% labeled data reduction for car detection suggests similar savings for airside objects. Works with existing OpenPCDet backbones.

---

### 2.7 BEV-MAE (AAAI 2024)

**Paper:** "Bird's Eye View Masked Autoencoders for Point Cloud Pre-training in Autonomous Driving"
**Authors:** Ren et al. (Peking University)
**GitHub:** Available

**Architecture:**
- Projects LiDAR point cloud onto 2D BEV grid
- BEV-guided masking: randomly masks non-empty BEV grids
- Pretext task: predicts point density per masked BEV grid (not just occupancy)
- Leverages LiDAR density-distance correlation
- Avoids complex 3D decoder design by operating in BEV space

**Key Results:**
| Setting | Metric | Improvement |
|---------|--------|-------------|
| 100% pretrain, 20% finetune (Waymo) | mAP | +1.42 over baseline |
| 100% pretrain, 20% finetune (Waymo) | APH | +1.34 over baseline |

**Airside Relevance:** The BEV formulation is particularly relevant because the Aurrigo stack already uses BEV representations for planning. Pre-training in BEV space means the learned features are directly aligned with the downstream planning representation.

---

### 2.8 ALSO (CVPR 2023)

**Paper:** "Automotive Lidar Self-supervision by Occupancy Estimation"
**Authors:** Boulch et al. (Valeo AI)
**GitHub:** 180 stars

**Architecture:**
- Self-supervised pretext task: reconstruct the surface from which 3D points were sampled
- Single-stream pipeline (unlike contrastive learning methods that require augmented pairs)
- Trains on the task of predicting whether a 3D point is on or off the LiDAR-measured surface
- Supports MinkUNet, SPVCNN backbones
- Very lightweight: trainable on limited compute resources

**Key Results:**
- Consistent improvements across nuScenes, SemanticKITTI, KITTI3D, ONCE
- Works for both semantic segmentation and 3D object detection
- Single-stream design is 2-3x more resource-efficient than contrastive methods

**Airside Relevance:** Developed by Valeo AI (automotive Tier-1 supplier), making it industry-validated. The surface reconstruction pretext task is intuitive for LiDAR: the model learns what surfaces look like, which transfers directly to understanding object shapes. The low compute requirement is important for resource-constrained airside AV development.

---

### 2.9 GPC: Grounded Point Colorization (ICLR 2024)

**Paper:** "Pre-Training LiDAR-Based 3D Object Detectors Through Colorization"
**Authors:** Pan et al.
**GitHub:** Available

**Architecture:**
- Cross-modal pre-training: teaches LiDAR backbone to predict colors from point positions
- Color prediction formulated as classification over quantized RGB bins
- Ground-truth colors provided as context hints (grounded colorization)
- Balanced softmax loss handles class imbalance (especially for ground points)
- Compatible with PointRCNN, PV-RCNN, CenterPoint

**Key Results:**
| Setting | Dataset | Result |
|---------|---------|--------|
| 20% labeled data | KITTI | **Outperforms training from scratch on 100% data** |
| 5% labeled data | KITTI | +7.5% AP (55.2 -> 62.7) for PointRCNN |
| Full data | KITTI/Waymo | Significant improvements across all detectors |

**Airside Relevance:** VERY HIGH. The remarkable data efficiency -- outperforming full-dataset training with only 20% of labels -- is exactly what airside needs. However, requires camera-LiDAR pairs for pre-training (to provide color supervision). The Aurrigo stack has 360-degree cameras alongside LiDAR, making this directly applicable.

---

## 3. LiDAR Foundation Models & Efficient 3D Backbones

### 3.1 Point Transformer V3 / PTv3 (CVPR 2024 Oral)

**Paper:** "Point Transformer V3: Simpler, Faster, Stronger"
**Authors:** Wu et al. (HKU, Max Planck)
**GitHub:** 2,900 stars (via Pointcept) | Part of the Pointcept ecosystem

**Architecture:**
- Replaces KNN neighbor search with serialized neighbor mapping using space-filling curves (Z-order, Hilbert)
- Sparse convolution layers replace complex relative positional encodings
- Scales receptive field from 16 to 1,024 points while remaining efficient
- **3x faster and 10x more memory-efficient than PTv2**

**Key Results:**
- SOTA on **20+ downstream tasks** across indoor and outdoor scenarios
- Selected as one of 90 Oral presentations at CVPR 2024 (0.78% of submissions)
- Multi-dataset joint training further improves results
- Supported datasets: ScanNet, S3DIS, SemanticKITTI, nuScenes, Waymo, ModelNet40

**Airside Relevance:** VERY HIGH. PTv3 is the current best general-purpose 3D backbone. Its efficiency improvements make it viable for deployment. The Pointcept codebase provides a complete training pipeline. The multi-dataset training capability means you can pre-train across diverse LiDAR datasets before fine-tuning on airside data.

---

### 3.2 DSVT (CVPR 2023)

**Paper:** "Dynamic Sparse Voxel Transformer with Rotated Sets"
**Authors:** Wang et al.
**GitHub:** 451 stars | TensorRT implementation available

**Architecture:**
- Transformer-only 3D backbone (no sparse convolutions)
- Dynamic Sparse Window Attention: partitions by sparsity, not fixed windows
- Rotated set attention avoids information isolation between windows
- Attention-style 3D pooling (no custom CUDA ops -- deployment-friendly)
- Pillar and Voxel variants

**Key Results:**
| Variant | mAP/H_L1 (Waymo) | Latency (PyTorch) | Latency (TensorRT) |
|---------|-------------------|-------------------|---------------------|
| Pillar | 71.0 mAPH_L2 | 67ms | **37ms** |
| Voxel (2-stage) | 78.9 mAPH_L1 | 97ms | - |
| Real-time (TRT) | - | - | **27 Hz** |

**Airside Relevance:** HIGH. The deployment-friendliness is critical -- no custom CUDA ops means easier TensorRT conversion. The pillar variant at 37ms TensorRT latency is within real-time budget for 20 km/h airside operations. Community TensorRT implementations exist (DSVT-AI-TRT).

---

### 3.3 FlatFormer (CVPR 2023)

**Paper:** "Flattened Window Attention for Efficient Point Cloud Transformer"
**Authors:** Liu et al. (MIT-Han-Lab, NVIDIA)
**GitHub:** 141 stars

**Architecture:**
- Trades spatial proximity for computational regularity
- Flattens point cloud via window-based sorting into equal-size groups (not equal-shape windows)
- Self-attention within groups; alternating sort axes for multi-directional feature exchange
- Shift windows for cross-group feature exchange
- **First point cloud transformer to achieve real-time on edge GPUs**

**Key Results:**
| Metric | FlatFormer | SST | CenterPoint |
|--------|-----------|-----|-------------|
| Waymo mAP/H_L1 | 76.1/73.4 (1-sweep) | - | - |
| Speedup vs SST | **4.6x** | 1x | - |
| Speedup vs CenterPoint | **1.4x** | - | 1x |

**Airside Relevance:** VERY HIGH for Orin deployment. FlatFormer explicitly targets edge GPU efficiency. Being faster than CenterPoint (the current Aurrigo detection backbone candidate) while achieving comparable or better accuracy makes it a direct upgrade path. Co-authored by NVIDIA, suggesting strong TensorRT compatibility.

---

### 3.4 SphereFormer (CVPR 2023)

**Paper:** "Spherical Transformer for LiDAR-based 3D Recognition"
**Authors:** Lai et al. (CUHK, NVIDIA)
**GitHub:** 364 stars

**Architecture:**
- Radial window self-attention: non-overlapping narrow, long windows extending radially from the sensor
- Overcomes disconnection between sparse distant points and dense close points
- Specifically designed for the spherical geometry of LiDAR point clouds
- Plug-and-play module that can be added to existing backbones

**Key Results:**
| Dataset | Metric | Score | Distant Point Improvement |
|---------|--------|-------|--------------------------|
| nuScenes (val) | mIoU | 79.5% (TTA) | 13.3% -> **30.4%** |
| SemanticKITTI (val) | mIoU | 69.0% (TTA) | - |
| Waymo (val) | mIoU | 70.8% (TTA) | 61.9% |

**Airside Relevance:** HIGH. The distant point performance improvement (13.3% -> 30.4%) is critical for airside operations where detecting distant aircraft, moving GSE, and personnel at range is essential for safe planning. The plug-and-play design means it could augment the existing Aurrigo perception pipeline.

---

### 3.5 LargeKernel3D (CVPR 2023)

**Paper:** "Scaling up Kernels in 3D Sparse CNNs"
**Authors:** Chen et al. (CUHK, SenseTime)
**GitHub:** 215 stars

**Architecture:**
- Spatial-wise partition convolution (SW-LK block) enables large 3D kernels efficiently
- Maintains sparsity while expanding the effective receptive field
- Applied on top of 3D sparse CNN backbones

**Key Results:**
| Dataset | Task | Metric | Score |
|---------|------|--------|-------|
| nuScenes (test) | Detection | NDS | 72.8 (LiDAR only) |
| nuScenes (test) | Detection | NDS | 74.2 (multimodal) |
| ScanNetv2 | Segmentation | mIoU | 73.9 |

Ranked **1st on nuScenes LiDAR leaderboard** at time of publication.

**Airside Relevance:** MODERATE. Improves 3D sparse CNN backbones that are already used in the Aurrigo stack. The large receptive field helps for detecting large objects (aircraft) at all distances. However, the CNN-based approach is being superseded by transformer methods (PTv3, DSVT).

---

### 3.6 Senna (arXiv 2024)

**Paper:** "Bridging Large Vision-Language Models and End-to-End Autonomous Driving"
**Authors:** Zhao et al. (HUST VL Lab)
**GitHub:** Available

**Note:** Despite initial framing as a "LiDAR foundation model," Senna is actually a VLM-based end-to-end driving system, not a LiDAR-specific foundation model. Included here for completeness as it was identified in the research scope.

**Architecture:**
- Senna-VLM generates planning decisions in natural language
- Senna-E2E predicts precise trajectories
- Multi-image encoding with multi-view prompts for scene understanding
- Pre-trained on DriveX (1M driving clips), fine-tuned on nuScenes

**Key Results:**
| Metric | Improvement |
|--------|------------|
| Average planning error | -27.12% (with DriveX pre-training) |
| Collision rate | -33.33% (with DriveX pre-training) |

**Airside Relevance:** LOW-MODERATE. Senna is primarily a camera-based VLM system, not a LiDAR foundation model. The natural language planning output is interesting for explainability but the architecture is not directly applicable to a LiDAR-primary stack. The DriveX pre-training approach (large-scale diverse data -> fine-tune) is a useful paradigm reference.

---

### 3.7 LiDARFormer (2023)

**Paper:** "A Unified Transformer-based Multi-task Network for LiDAR Perception"
**Authors:** Li et al.
**GitHub:** Available

**Architecture:**
- Cross-space transformer: learns attention between 2D BEV and 3D sparse voxel features
- Unified framework for detection and segmentation
- Multi-task learning improves individual task performance

**Key Results:**
| Dataset | Task | Metric | Score |
|---------|------|--------|-------|
| Waymo | Detection | mAPH L2 | 76.4 |
| nuScenes | Detection | NDS | 74.3 |

**Airside Relevance:** MODERATE. The multi-task capability (detection + segmentation) is useful for airside where you need both object detection and drivable area segmentation. The BEV-3D cross-attention could bridge different representation layers in the Aurrigo stack.

---

## 4. Multi-modal 3D Foundation Models (Language-3D Alignment)

### 4.1 ULIP / ULIP-2 (CVPR 2023 / CVPR 2024)

**Paper:** "Learning a Unified Representation of Language, Images, and Point Clouds"
**Authors:** Xue et al. (Salesforce Research)
**GitHub:** 598 stars

**ULIP Architecture:**
- Tri-modal contrastive learning: aligns 3D point cloud features with CLIP's image and text embeddings
- Freezes CLIP image/text encoders; trains 3D encoder to align
- Supports PointNet2, PointBERT, PointMLP, PointNeXt as 3D backbones
- Model-agnostic: no extra latency at inference (only 3D encoder needed)

**ULIP-2 Advances (CVPR 2024):**
- Uses LLMs to auto-generate holistic language descriptions for 3D shapes (eliminates manual 3D annotation)
- Scaled to larger datasets (Objaverse, ShapeNet)
- Only needs 3D data as input -- fully scalable

**Key Results:**
| Benchmark | Metric | ULIP | ULIP-2 |
|-----------|--------|------|--------|
| ModelNet40 (zero-shot) | Top-1 Acc | 60.4% | 84.7% |
| Objaverse-LVIS (zero-shot) | Top-1 Acc | - | 50.6% |
| ScanObjectNN (fine-tuned) | OA | - | 91.5% (1.4M params) |

ULIP-2 outperforms PointCLIP by 28.8% on zero-shot classification.

**Airside Relevance:** Enables language-queried 3D understanding. For airside: "find the pushback tug" or "where is the fuel bowser?" queries on 3D point clouds. However, currently object-level (ModelNet/ShapeNet scale), not scene-level driving LiDAR.

---

### 4.2 PointCLIP / PointCLIP V2 (CVPR 2022 / ICCV 2023)

**Paper:** "Point Cloud Understanding by CLIP" / "Prompting CLIP and GPT for Powerful 3D Open-world Learning"

**PointCLIP Architecture:**
- Projects point clouds into multi-view depth maps
- Feeds depth maps to frozen CLIP image encoder
- Aggregates view-wise zero-shot predictions

**PointCLIP V2 Advances:**
- Realistic depth map generation via shape projection module
- GPT generates 3D-specific text prompts for CLIP's text encoder
- Unified framework for zero-shot 3D classification, segmentation, and detection

**Airside Relevance:** LOW-MODERATE. The multi-view projection approach is computationally expensive and loses 3D information. ULIP's direct 3D feature alignment is superior. However, PointCLIP V2's zero-shot 3D detection capability could be useful for initial airside prototyping with zero labeled data.

---

### 4.3 OpenScene (CVPR 2023)

**Paper:** "3D Scene Understanding with Open Vocabularies"
**Authors:** Peng et al.
**GitHub:** 812 stars

**Architecture:**
- Back-projects 3D points into multi-view images to aggregate CLIP/OpenSeg features
- Trains sparse 3D convolutional network to distill aggregated pixel features into 3D
- Enables open-vocabulary queries on 3D point clouds at inference time
- At inference: only the 3D network is needed (no images required)

**Supported Datasets:** ScanNet, Matterport3D, nuScenes, Replica

**Key Capabilities:**
- Zero-shot 3D semantic segmentation via arbitrary text labels
- Open-vocabulary scene querying: objects, properties, materials, activities, abstract concepts
- 3D object search via image queries
- CPU inference possible after distillation

**Airside Relevance:** HIGH. OpenScene's open-vocabulary 3D understanding is directly applicable to airside. You could query the 3D scene with text: "aircraft engine," "ground power unit," "person in hi-vis." The distillation approach means cameras are only needed during training -- at inference, only LiDAR is required. This aligns perfectly with a LiDAR-primary stack.

**Critical Insight:** OpenScene's approach of distilling 2D foundation model knowledge into a 3D-only network is the ideal pattern for the Aurrigo stack: use cameras during pre-training/distillation, but deploy with LiDAR-only inference.

---

### 4.4 LiDAR-LLM (AAAI 2025)

**Paper:** "Exploring the Potential of Large Language Models for 3D LiDAR Understanding"
**Authors:** Liu et al.

**Architecture:**
- Takes raw LiDAR point clouds as input to an LLM
- View-Aware Transformer (VAT) bridges 3D encoder and LLM
- Three-stage training: (1) LiDAR feature alignment, (2) 3D caption training, (3) 3D grounding
- Reformulates 3D scene understanding as language modeling

**Key Results:**
| Task | Metric | Score |
|------|--------|-------|
| 3D Captioning | BLEU-1 | 40.9 |
| 3D Grounding (Classification) | Accuracy | 63.1% |
| 3D Grounding (Localization) | BEV mIoU | 14.3% |

**Airside Relevance:** MODERATE. The ability to ask natural language questions about LiDAR scenes ("What is the large object to the left?") is useful for explainability and safety cases. However, latency may be too high for real-time perception. Better suited for offline analysis and safety auditing.

---

## 5. Pre-training to Fine-tuning Pipeline

### 5.1 How Much Labeled Data Does Pre-training Save?

| Method | Pre-training Type | Label Savings | Evidence |
|--------|------------------|---------------|----------|
| **GD-MAE** | MAE on LiDAR | **80%** | 20% labels matches full-data performance on Waymo |
| **GPC** | Colorization | **80%** | 20% KITTI outperforms 100% from scratch |
| **GPC** (extreme) | Colorization | **95%** | 5% KITTI: +7.5% AP over scratch |
| **Occupancy-MAE** | Occupancy prediction | **50%** | Halves labeled data for car detection on KITTI |
| **PSA-SSL** (CVPR 2025) | Pose/size-aware SSL | **90%** | Matches SOTA with 10x fewer labels |
| **BEV-MAE** | BEV occupancy | ~60% | +1.42 mAP with 20% fine-tuning data |
| **TREND** | Temporal forecasting | Significant | +1.77% mAP on ONCE, +2.11% on nuScenes |
| **ScaLR** | Image-to-LiDAR distill | ~40-50% | 67.8% linear probe mIoU (strong frozen features) |
| **ALSO** | Surface reconstruction | ~30-40% | Consistent gains on SemanticKITTI, nuScenes |

**Recommended Strategy for Airside:**
1. Pre-train backbone on diverse road LiDAR data (Waymo + nuScenes + KITTI) using AD-PT's semi-supervised paradigm
2. Collect unlabeled airside LiDAR sweeps (requires only driving the vehicle)
3. Continue pre-training on unlabeled airside data using GD-MAE or Occupancy-MAE
4. Fine-tune with minimal labeled airside data (500-1,000 annotated frames may suffice)

### 5.2 Transfer from Road Driving to Airside (Domain Gap)

**Key Domain Differences:**
| Dimension | Road Driving | Airport Airside |
|-----------|-------------|-----------------|
| Object sizes | Cars 4m, trucks 12m | Baggage carts 2m, A380 73m |
| Point density | Dense in 30-50m range | Variable (open areas vs. stands) |
| Dynamic objects | Cars, pedestrians | GSE, aircraft, ground crew |
| Ground surface | Asphalt with lane markings | Apron concrete, stand markings |
| Structures | Buildings, trees, signs | Jetbridges, terminal buildings |
| LiDAR patterns | Typical urban scanning | May have reflections from aircraft fuselage |

**Transfer Methods (2024-2025):**

**Domain Adaptive Distill-Tuning (DADT):**
- Specifically designed for fine-tuning pre-trained 3D models with limited target data
- Uses pseudo beam generation and BEV attention-based regularizers
- Alleviates domain shift between source (road) and target (airside) domains

**Shelf-Supervised Cross-Modal Pre-Training:**
- Bootstraps 3D representations using 2D image foundation models (DINOv2, CLIP)
- Yields better semi-supervised detection accuracy than self-supervised pretext tasks
- Particularly effective when labeled target data is scarce

**ScaLR Distillation Pipeline:**
- Distill DINOv2 features into LiDAR backbone using camera-LiDAR pairs
- Pre-train on diverse driving datasets, then fine-tune on airside
- Produces strong frozen LiDAR features that transfer across domains

### 5.3 Few-Shot 3D Detection with Pre-trained Models

| Approach | Setting | Result |
|----------|---------|--------|
| GPC + PointRCNN | 5% KITTI labels | +7.5% AP (55.2 -> 62.7) |
| GD-MAE | 20% Waymo labels | Matches full-data baseline |
| PSA-SSL | 10% labels | Matches SOTA with 10x fewer labels |
| Point-BERT | 5-way 10-shot | Strong transfer on ModelNet |
| PointGPT | 5-way 10-shot | 98.0% accuracy on ModelNet |

**Practical Estimate for Airside:**
- **Pre-trained + 500 labeled airside frames**: ~65-75% mAP for common objects (tractors, baggage carts, aircraft)
- **Pre-trained + 1,000 labeled frames**: ~75-85% mAP
- **Pre-trained + 5,000 labeled frames**: ~85-90% mAP
- These estimates assume pre-training on road driving data with domain adaptation

### 5.4 LoRA/Adapter Approaches for 3D Models

**PointLoRA (CVPR 2025):**
- First LoRA method specifically designed for point cloud learning
- Multi-Scale Token Selection module captures local information
- Complements LoRA's global feature aggregation with local point cloud priors
- Integrates selected tokens at various scales via shared Prompt MLP

**LoRA for LiDAR Semantic Segmentation (2026):**
- 73.4% parameter reduction vs. full fine-tuning
- Greater resistance to catastrophic forgetting
- Achieves baseline accuracy with substantially fewer trainable parameters
- Suitable for resource-constrained deployment (Orin)

**Adapter Strategy for Airside:**
```
Pre-trained 3D Backbone (Frozen)
    |
    +-- LoRA adapters (rank 16-32) per transformer layer
    |       Only 2-5% parameters trained
    |       ~100x less GPU memory for fine-tuning
    |
    +-- Task-specific heads
            CenterPoint head for detection
            Segmentation head for drivable area
```

**Benefits for Airside:**
- Swap between road and airside LoRA adapters at deployment
- Fine-tune on consumer GPU (RTX 4090) instead of A100 cluster
- Maintain pre-trained knowledge while adapting to airside domain
- Multiple LoRA adapters: different airports, different seasons, different GSE types

---

## 6. Practical Deployment on NVIDIA Orin

### 6.1 Which Models Run on Orin (275 TOPS)?

| Model | Architecture | Latency (A100) | Estimated Latency (Orin) | TensorRT | Deployment Feasibility |
|-------|-------------|----------------|--------------------------|----------|----------------------|
| **PointPillars** | Pillar + 2D CNN | 2ms | **6.84ms** (measured) | Yes (INT8) | PRODUCTION READY |
| **CenterPoint** | Voxel + 2D CNN | ~15ms | ~45ms (estimated) | Yes | PRODUCTION READY |
| **FlatFormer** | Flat attention | ~25ms | ~75ms (estimated) | Likely | FEASIBLE with optimization |
| **DSVT (Pillar)** | Sparse transformer | 37ms (TRT) | ~110ms (estimated) | Yes (community) | MARGINAL (may need Thor) |
| **PTv3** | Serialized attention | Varies | >100ms (estimated) | Partial | FUTURE (Thor timeline) |
| **SphereFormer** | Radial attention | ~50ms | >150ms (estimated) | Unknown | FUTURE |
| **LargeKernel3D** | Sparse CNN | ~30ms | ~90ms (estimated) | Possible | FEASIBLE with optimization |

**Orin Latency Estimates:** Roughly 3x A100 latency for well-optimized TensorRT models. The Aurrigo system runs perception at ~10 Hz (100ms budget), so models under ~80ms Orin latency are viable.

### 6.2 TensorRT Compatibility

**Fully Compatible (tested):**
- PointPillars: via NVIDIA Lidar_AI_Solution, INT8 PTQ, 6.84ms on Orin
- CenterPoint: via NVIDIA Lidar_AI_Solution
- DSVT (Pillar): community TensorRT implementation (DSVT-AI-TRT), 37ms on A100 FP16

**Likely Compatible (standard ops):**
- FlatFormer: standard attention ops, designed for edge deployment by MIT-Han-Lab/NVIDIA
- BEV-MAE pre-trained backbones: standard voxel backbone, same TRT path as CenterPoint
- GD-MAE pre-trained backbones: same as above

**Challenging (custom ops):**
- SphereFormer: custom radial window ops
- PTv3: serialized attention with space-filling curves (non-standard)
- PointGPT/Point-MAE/Point-BERT: designed for object-level, not optimized for deployment

### 6.3 Integration with Existing Detection Heads

**Pre-trained backbones can drop into OpenPCDet detection heads:**

```
Pre-trained Backbone (GD-MAE, AD-PT, BEV-MAE, Occupancy-MAE)
    |
    +-- VoxelBackBone8x (standard OpenPCDet backbone)
    |
    +-- Compatible Detection Heads:
         - CenterHead (CenterPoint) -- heatmap-based, anchor-free
         - AnchorHeadSingle (PointPillars) -- anchor-based
         - Voxel R-CNN head -- two-stage refinement
         - PV-RCNN head -- point-voxel fusion
```

This means the pre-training methods from Section 2 (GD-MAE, AD-PT, Occupancy-MAE, BEV-MAE) can be used to initialize the same backbones already used for CenterPoint and PointPillars in the Aurrigo stack, with no architectural changes.

### 6.4 Recommended Deployment Path

**Phase 1 (Now): PointPillars with Pre-trained Backbone**
- Use GD-MAE or Occupancy-MAE pre-trained VoxelBackBone8x
- Same PointPillars head, same TensorRT pipeline
- Expected: ~6.84ms on Orin (unchanged latency), +2-5% mAP from pre-training

**Phase 2 (6-12 months): CenterPoint with Pre-trained Backbone + LoRA**
- Pre-train on Waymo/nuScenes, fine-tune with LoRA on airside data
- CenterPoint head for anchor-free multi-class detection
- Expected: ~45ms on Orin, ~70-80% mAP with 1,000 labeled airside frames

**Phase 3 (Thor era, 2026-2027): Transformer Backbone**
- DSVT or FlatFormer backbone with pre-trained weights
- PTv3 + Sonata/Concerto pre-training when Thor hardware available
- Expected: ~30ms on Thor, >85% mAP with full pre-training pipeline

---

## 7. LiDAR World Models & Generation

### 7.1 Copilot4D (ICLR 2024)

**Paper:** "Learning Unsupervised World Models for Autonomous Driving via Discrete Diffusion"
**Authors:** Zhang et al. (Waabi)

**Architecture:**
- VQVAE tokenizer converts LiDAR point clouds to discrete tokens
- Discrete diffusion model predicts future token sequences
- Parallel decoding and denoising via enhanced Masked Generative Image Transformer (MaskGIT)

**Key Results:**
- Reduces Chamfer distance by **>65%** for 1s prediction, **>50%** for 3s prediction
- Evaluated on nuScenes, KITTI Odometry, Argoverse2
- First LiDAR-native world model for autonomous driving

**Airside Relevance:** HIGH. LiDAR point cloud forecasting is directly applicable to predicting future positions of aircraft, GSE, and personnel. The unsupervised nature means no labeled data needed for world model training -- just collect LiDAR sequences while driving.

### 7.2 LiDARCrafter (AAAI 2026 Oral)

**Paper:** "Dynamic 4D World Modeling from LiDAR Sequences"
**Authors:** WorldBench
**GitHub:** 193 stars

**Architecture:**
- Three-component pipeline: (1) 4D layout generation from language, (2) single-frame LiDAR synthesis, (3) temporal consistency enforcement
- Language-guided: "add a moving vehicle on the left lane" generates corresponding 4D LiDAR sequence
- Scene-level, object-level, and sequence-level evaluation

**Key Results:**
- Best single-frame LiDAR generation on nuScenes
- Superior foreground object quality and temporal stability
- First controllable 4D LiDAR generation model

**Airside Relevance:** HIGH for simulation and training data generation. Generate synthetic airside LiDAR scenarios: "aircraft pushback from Stand 42," "baggage tractor crossing apron," "FOD on taxiway." Addresses the zero-public-airside-dataset problem through generation.

### 7.3 LidarDM (ICRA 2025)

**Paper:** "Generative LiDAR Simulation in a Generated World"

**Architecture:**
- Layout-aware LiDAR point cloud generation
- Physically plausible and temporally coherent
- Guided by driving scenarios (map, traffic)

**Airside Relevance:** MODERATE. LiDAR simulation for training and testing without real airside data.

### 7.4 Cosmos-Transfer-LidarGen (NVIDIA, 2025)

Part of NVIDIA Cosmos ecosystem:
- Uses Cosmos-Predict as runtime engine
- LiDAR tokenizer for range map representation
- Diffusion model for multi-view RGB to LiDAR range map generation
- Post-training scripts for custom dataset fine-tuning
- Commercially licensed (NVIDIA Open Model License)

**Airside Relevance:** HIGH. Commercially licensed LiDAR generation within the Cosmos ecosystem. Can generate synthetic LiDAR data from camera imagery, expanding training data. NVIDIA partnership makes it a natural fit for Orin/Thor deployment.

---

## 8. Latest 2025-2026 Advances

### 8.1 Sonata (CVPR 2025 Highlight)

**Paper:** "Self-Supervised Learning of Reliable Point Representations"
**Authors:** Wu et al. (Meta, HKU)
**GitHub:** 711 stars (via Facebook Research)

**Architecture:**
- Self-distillation approach on PTv3 backbone
- Encoder-only architecture for 3D point cloud understanding
- Multi-dataset pre-training across indoor and outdoor scenarios
- SOTA on ScanNet, S3DIS semantic segmentation

**License:** CC-BY-NC 4.0 (restricted by NC datasets like HM3D, ArkitScenes)

**Airside Relevance:** HIGH. Provides pre-trained PTv3 weights that transfer across domains. The self-supervised approach means no labels needed for pre-training. However, NC license restricts commercial deployment.

### 8.2 Concerto (NeurIPS 2025)

**Paper:** "Joint 2D-3D Self-Supervised Learning Emerges Spatial Representations"
**Authors:** Zhang et al. (Pointcept team)
**GitHub:** 519 stars

**Architecture:**
- Intra-modal self-distillation on 3D point clouds (refines internal spatial representations)
- Cross-modal joint embedding prediction (aligns point features with image patch features using camera parameters)
- Simulates human multisensory synergy for spatial cognition
- Includes CLIP translator for open-world 3D perception
- Three sizes: Small (39M), Base (108M), Large (208M)

**Key Results:**
- Outperforms standalone SOTA 2D SSL by 14.2% in linear probing for 3D perception
- Outperforms standalone SOTA 3D SSL by 4.8% in linear probing
- 80.7% mIoU on ScanNet with full fine-tuning (new SOTA)
- Variant for video-lifted point cloud spatial understanding

**Airside Relevance:** VERY HIGH. The joint 2D-3D learning is ideal for the Aurrigo stack which has both cameras and LiDAR. The CLIP translator enables open-world airside perception without airside-specific labels. The 39M parameter small model is potentially Orin-viable.

### 8.3 Utonia (March 2026)

**Paper:** "Toward One Encoder for All Point Clouds"
**Authors:** Pointcept team
**GitHub:** Available via Pointcept

**Architecture:**
- Single self-supervised encoder across heterogeneous domains: remote sensing, outdoor LiDAR, indoor RGB-D, CAD models, RGB-lifted point clouds
- Three designs: Causal Modality Blinding, Perceptual Granularity Rescale, RoPE for Cross-Domain Spatial Encoding
- Unified representation space across fundamentally different sensing geometries
- Emergent cross-domain behaviors from joint training

**Key Capabilities:**
- Benefits robotic manipulation when used as VLA features
- Improves VLM spatial reasoning when integrated
- Step toward true foundation model for sparse 3D data

**Airside Relevance:** HIGH. The universal encoder concept means pre-training on all available 3D data (driving, indoor, CAD models of aircraft/GSE) and deploying on airside LiDAR. The cross-domain capability directly addresses the domain gap problem.

### 8.4 NOMAE (CVPR 2025)

**Paper:** "Multi-Scale Neighborhood Occupancy Masked Autoencoder for Self-Supervised Learning in LiDAR"
**Authors:** Abdelsamad et al.

**Architecture:**
- Masked occupancy reconstruction only in neighborhood of non-masked voxels (prevents occupancy information leakage)
- Hierarchical mask generation captures objects at multiple scales
- Separate decoders for each feature scale (multi-scale representation)
- Token upsampling module fuses multi-scale representations

**Key Results:**
- **First SSL method to outperform strong supervised learning models** on some benchmarks
- New SOTA across nuScenes and Waymo for SSL-based 3D perception
- Superior performance on both semantic segmentation and 3D object detection

**Airside Relevance:** VERY HIGH. The multi-scale architecture handles the extreme scale variation on airside (2m baggage carts to 73m A380). The occupancy-based pretext task directly teaches the model about 3D structure. New CVPR 2025 SOTA.

### 8.5 PSA-SSL (CVPR 2025)

**Paper:** "Pose and Size-aware Self-Supervised Learning on LiDAR Point Clouds"
**Authors:** Nisar et al.

**Architecture:**
- Self-supervised bounding box regression as pretext task (first to use this)
- LiDAR beam pattern augmentation for sensor-agnostic features
- Complements contrastive learning with pose/size awareness
- 33% reduced pre-training time vs. comparable methods

**Key Results:**
- Matches SOTA SSL methods using **up to 10x fewer labels** on Waymo, nuScenes, SemanticKITTI
- Superior 3D object detection performance
- Sensor-agnostic features (important for cross-sensor transfer)

**Airside Relevance:** VERY HIGH. The sensor-agnostic feature learning means pre-trained models can transfer between different LiDAR configurations (e.g., from 64-beam Waymo LiDAR to 4-8 RoboSense RSHELIOS/RSBP on Aurrigo vehicles). The 10x label reduction is the best in the field.

### 8.6 TREND (NeurIPS 2025)

**Paper:** "Unsupervised 3D Representation Learning via Temporal Forecasting for LiDAR Perception"
**Authors:** Chen et al.
**GitHub:** Available

**Architecture:**
- First temporal forecasting method for unsupervised 3D pre-training
- Recurrent Embedding scheme generates 3D embeddings across time
- Temporal LiDAR Neural Field represents 3D scenes
- Differentiable rendering for loss computation
- Exploits object motion and semantics naturally present in temporal sequences

**Key Results:**
| Dataset | Task | Improvement | vs. Previous SOTA |
|---------|------|-------------|-------------------|
| ONCE | Detection | +1.77% mAP | **400% more improvement** |
| nuScenes | Detection | +2.11% mAP | **400% more improvement** |
| SemanticKITTI | Segmentation | Consistent gains | - |

**Airside Relevance:** HIGH. Temporal pre-training exploits the sequential nature of LiDAR data collection. Just driving the Aurrigo vehicle around the airside captures temporal LiDAR sequences that can be used for unsupervised pre-training with TREND. No labels needed, and the temporal context captures object dynamics (moving GSE, taxiing aircraft).

---

## 9. Comparative Summary Table

### 9.1 Pre-training Methods

| Method | Venue | Year | Type | Backbone | Data Savings | GitHub Stars | Orin-Ready | Airside Fit |
|--------|-------|------|------|----------|-------------|-------------|------------|-------------|
| Point-BERT | CVPR | 2022 | Masked modeling | Transformer | Few-shot | 677 | No | Low |
| Point-MAE | ECCV | 2022 | Masked reconstruction | Transformer | Few-shot | 622 | No | Low |
| PointGPT | NeurIPS | 2023 | Autoregressive | Transformer | Few-shot | 245 | No | Low |
| GD-MAE | CVPR | 2023 | MAE + generative decoder | Voxel CNN | **80%** | 124 | Yes | **HIGH** |
| AD-PT | NeurIPS | 2023 | Semi-supervised | Multi-backbone | Significant | - | Yes | **HIGH** |
| Occupancy-MAE | IEEE TIV | 2023 | Occupancy prediction | Voxel CNN | **50%** | 280 | Yes | **HIGH** |
| BEV-MAE | AAAI | 2024 | BEV occupancy | Voxel CNN | ~60% | - | Yes | HIGH |
| ALSO | CVPR | 2023 | Surface reconstruction | Sparse CNN | 30-40% | 180 | Yes | HIGH |
| GPC | ICLR | 2024 | Colorization | Multi-backbone | **80-95%** | - | Yes | **VERY HIGH** |
| UniPAD | CVPR | 2024 | Volume rendering | Multi-modal | 50-60% | 204 | Partial | HIGH |
| ScaLR | CVPR | 2024 | Image-to-LiDAR distill | WaffleIron | 40-50% | 62 | Partial | HIGH |
| Sonata | CVPR | 2025 | Self-distillation | PTv3 | Large | 711 | No (future) | HIGH |
| Concerto | NeurIPS | 2025 | 2D-3D joint SSL | PTv3 | Large | 519 | No (future) | **VERY HIGH** |
| NOMAE | CVPR | 2025 | Multi-scale occ MAE | Voxel | **Beats supervised** | - | Yes | **VERY HIGH** |
| PSA-SSL | CVPR | 2025 | Pose/size-aware SSL | Multi-backbone | **90%** | - | Yes | **VERY HIGH** |
| TREND | NeurIPS | 2025 | Temporal forecasting | Multi-backbone | Significant | - | Yes | HIGH |
| Utonia | arXiv | 2026 | Universal encoder | PTv3 | Large | - | No (future) | HIGH |

### 9.2 Backbone Models

| Model | Venue | Year | Latency (A100) | TensorRT | Orin Latency (est.) | GitHub Stars | Airside Fit |
|-------|-------|------|----------------|----------|--------------------|--------------|-|
| PointPillars | CVPR | 2019 | <5ms | **Yes** (NVIDIA) | **6.84ms** | (in OpenPCDet) | PRODUCTION |
| CenterPoint | CVPR | 2021 | ~15ms | **Yes** (NVIDIA) | ~45ms | (in OpenPCDet) | PRODUCTION |
| FlatFormer | CVPR | 2023 | ~25ms | Likely | ~75ms | 141 | HIGH |
| DSVT | CVPR | 2023 | **37ms** (TRT) | **Yes** | ~110ms | 451 | MARGINAL |
| SphereFormer | CVPR | 2023 | ~50ms | Unknown | >150ms | 364 | FUTURE |
| LargeKernel3D | CVPR | 2023 | ~30ms | Possible | ~90ms | 215 | MODERATE |
| LiDARFormer | 2023 | 2023 | ~40ms | Unknown | ~120ms | - | FUTURE |
| PTv3 | CVPR | 2024 | Varies | Partial | >100ms | 2,900 | FUTURE (Thor) |

---

## 10. Recommendations for LiDAR-Primary Airside AV

### 10.1 Immediate Actions (1-3 months)

1. **Deploy GD-MAE or Occupancy-MAE pre-training on current PointPillars/CenterPoint backbone:**
   - No architecture change needed -- pre-training initializes the same VoxelBackBone8x
   - Pre-train on unlabeled Waymo + nuScenes data
   - Expected improvement: +2-5% mAP at zero additional labeling cost
   - Same TensorRT deployment path, same latency on Orin

2. **Collect unlabeled airside LiDAR data:**
   - Drive Aurrigo vehicles around the airside, recording LiDAR sweeps
   - No annotation needed -- raw sweeps are used for self-supervised pre-training
   - Target: 10,000+ sweeps across multiple airports, times of day, weather conditions

3. **Evaluate GPC if camera-LiDAR pairs are available:**
   - If the Aurrigo stack records synchronized camera and LiDAR, GPC's colorization pre-training could yield 80-95% label savings
   - Outperforms full-dataset training from scratch with only 20% of labels

### 10.2 Medium-term (3-12 months)

4. **Implement ScaLR distillation pipeline:**
   - Distill DINOv2 features from cameras into LiDAR backbone
   - Produces strong frozen LiDAR features that transfer to airside
   - Requires camera-LiDAR calibration (already available in Aurrigo stack)

5. **Add PointLoRA for parameter-efficient airside fine-tuning:**
   - Freeze pre-trained backbone, add LoRA adapters (rank 16-32)
   - Fine-tune on labeled airside data (target: 1,000 annotated frames)
   - Maintain separate LoRA adapters per airport if needed

6. **Evaluate FlatFormer as CenterPoint backbone replacement:**
   - 1.4x faster than CenterPoint with comparable/better accuracy
   - First transformer backbone viable for Orin deployment
   - Drop-in replacement for sparse convolution backbone

7. **Explore OpenScene distillation for open-vocabulary LiDAR:**
   - Use camera data during training to distill CLIP features into LiDAR backbone
   - Deploy LiDAR-only at inference for open-vocabulary 3D understanding
   - Enables text-queried detection of novel airside objects

### 10.3 Long-term (12-24 months, Thor timeline)

8. **Adopt PTv3 + Sonata/Concerto pre-training:**
   - When Thor hardware is available (~1,000 TOPS), PTv3 becomes viable for real-time
   - Sonata provides self-supervised pre-trained weights
   - Concerto adds 2D-3D joint learning with CLIP translator for open-world perception

9. **Integrate LiDAR world model (Copilot4D/LiDARCrafter):**
   - Use for simulation: generate synthetic airside LiDAR scenarios
   - Use for prediction: forecast future LiDAR observations for planning
   - Address the zero-public-airside-dataset problem through generation

10. **Build airside LiDAR foundation model:**
    - Pre-train Utonia-style universal encoder on all available 3D data + airside data
    - Create the first airside-specific LiDAR benchmark
    - Target: single model that works across all airport types and conditions

### 10.4 POC Priority Order

| Priority | POC | Cost | Impact | Difficulty |
|----------|-----|------|--------|------------|
| 1 | GD-MAE pre-training for PointPillars | $500 (compute) | +2-5% mAP, zero labels | Low |
| 2 | Collect unlabeled airside LiDAR data | $0 (existing vehicles) | Enables all downstream | Operational |
| 3 | GPC colorization pre-training | $1,000 (compute) | 80%+ label savings | Medium |
| 4 | FlatFormer backbone evaluation | $500 (compute) | 1.4x faster, same accuracy | Medium |
| 5 | PointLoRA fine-tuning on airside | $500 (compute) | Domain adaptation | Medium |
| 6 | ScaLR DINOv2-to-LiDAR distillation | $2,000 (compute) | Strong frozen features | Medium-High |
| 7 | OpenScene distillation for open-vocab | $2,000 (compute) | Open-world 3D | High |
| 8 | LiDARCrafter synthetic data | $3,000 (compute) | Synthetic airside data | High |

---

## 11. References

### Core Pre-training Papers

| Paper | Venue | Year | Link |
|-------|-------|------|------|
| Point-BERT | CVPR | 2022 | [arXiv](https://arxiv.org/abs/2111.14819), [GitHub](https://github.com/Julie-tang00/Point-BERT) |
| Point-MAE | ECCV | 2022 | [GitHub](https://github.com/Pang-Yatian/Point-MAE) |
| PointGPT | NeurIPS | 2023 | [arXiv](https://arxiv.org/abs/2305.11487), [GitHub](https://github.com/CGuangyan-BIT/PointGPT) |
| GD-MAE | CVPR | 2023 | [Paper](https://openaccess.thecvf.com/content/CVPR2023/papers/Yang_GD-MAE_Generative_Decoder_for_MAE_Pre-Training_on_LiDAR_Point_Clouds_CVPR_2023_paper.pdf), [GitHub](https://github.com/Nightmare-n/GD-MAE) |
| AD-PT | NeurIPS | 2023 | [arXiv](https://arxiv.org/abs/2306.00612), [NeurIPS](https://proceedings.neurips.cc/paper_files/paper/2023/hash/95ab5c3e26fd82c7de3230bbad087d2d-Abstract-Conference.html) |
| Occupancy-MAE | IEEE TIV | 2023 | [arXiv](https://arxiv.org/abs/2206.09900), [GitHub](https://github.com/chaytonmin/Occupancy-MAE) |
| BEV-MAE | AAAI | 2024 | [arXiv](https://arxiv.org/abs/2212.05758), [GitHub](https://github.com/VDIGPKU/BEV-MAE) |
| ALSO | CVPR | 2023 | [arXiv](https://arxiv.org/abs/2212.05867), [GitHub](https://github.com/valeoai/ALSO) |
| GPC | ICLR | 2024 | [arXiv](https://arxiv.org/abs/2310.14592), [GitHub](https://github.com/tydpan/GPC) |
| UniPAD | CVPR | 2024 | [arXiv](https://arxiv.org/abs/2310.08370), [GitHub](https://github.com/Nightmare-n/UniPAD) |
| ScaLR | CVPR | 2024 | [arXiv](https://arxiv.org/abs/2310.17504), [GitHub](https://github.com/valeoai/ScaLR) |
| PSA-SSL | CVPR | 2025 | [arXiv](https://arxiv.org/abs/2503.13914) |
| NOMAE | CVPR | 2025 | [arXiv](https://arxiv.org/abs/2502.20316) |
| TREND | NeurIPS | 2025 | [arXiv](https://arxiv.org/abs/2412.03054), [GitHub](https://github.com/Runjian-Chen/TREND) |

### Foundation Models & Backbones

| Paper | Venue | Year | Link |
|-------|-------|------|------|
| PTv3 | CVPR (Oral) | 2024 | [arXiv](https://arxiv.org/abs/2312.10035), [GitHub](https://github.com/Pointcept/PointTransformerV3) |
| Sonata | CVPR (Highlight) | 2025 | [Paper](https://openaccess.thecvf.com/content/CVPR2025/papers/Wu_Sonata_Self-Supervised_Learning_of_Reliable_Point_Representations_CVPR_2025_paper.pdf), [GitHub](https://github.com/facebookresearch/sonata) |
| Concerto | NeurIPS | 2025 | [arXiv](https://arxiv.org/abs/2510.23607), [GitHub](https://github.com/Pointcept/Concerto) |
| Utonia | arXiv | 2026 | [arXiv](https://arxiv.org/abs/2603.03283), [GitHub](https://github.com/Pointcept/Utonia) |
| Pointcept | Framework | 2022-2026 | [GitHub](https://github.com/Pointcept/Pointcept) (2,900 stars) |
| DSVT | CVPR | 2023 | [arXiv](https://arxiv.org/abs/2301.06051), [GitHub](https://github.com/Haiyang-W/DSVT) |
| FlatFormer | CVPR | 2023 | [arXiv](https://arxiv.org/abs/2301.08739), [GitHub](https://github.com/mit-han-lab/flatformer) |
| SphereFormer | CVPR | 2023 | [arXiv](https://arxiv.org/abs/2303.12766), [GitHub](https://github.com/dvlab-research/SphereFormer) |
| LargeKernel3D | CVPR | 2023 | [arXiv](https://arxiv.org/abs/2206.10555), [GitHub](https://github.com/dvlab-research/LargeKernel3D) |

### Multi-modal & Language-3D

| Paper | Venue | Year | Link |
|-------|-------|------|------|
| ULIP | CVPR | 2023 | [arXiv](https://arxiv.org/abs/2212.05171), [GitHub](https://github.com/salesforce/ULIP) |
| ULIP-2 | CVPR | 2024 | [arXiv](https://arxiv.org/abs/2305.08275) |
| PointCLIP | CVPR | 2022 | [arXiv](https://arxiv.org/abs/2112.02413) |
| PointCLIP V2 | ICCV | 2023 | [arXiv](https://arxiv.org/abs/2211.11682) |
| OpenScene | CVPR | 2023 | [arXiv](https://arxiv.org/abs/2211.15654), [GitHub](https://github.com/pengsongyou/openscene) |
| LiDAR-LLM | AAAI | 2025 | [arXiv](https://arxiv.org/abs/2312.14074) |

### LiDAR World Models & Generation

| Paper | Venue | Year | Link |
|-------|-------|------|------|
| Copilot4D | ICLR | 2024 | [arXiv](https://arxiv.org/abs/2311.01017), [Website](https://waabi.ai/research/copilot-4d) |
| LiDARCrafter | AAAI (Oral) | 2026 | [GitHub](https://github.com/worldbench/LiDARCrafter) |
| LidarDM | ICRA | 2025 | [arXiv](https://arxiv.org/abs/2404.02903), [GitHub](https://github.com/vzyrianov/LidarDM) |
| Cosmos-LidarGen | NVIDIA | 2025 | [GitHub](https://github.com/nv-tlabs/Cosmos-Drive-Dreams) |
| DIO | CVPR | 2025 | [Paper](https://openaccess.thecvf.com/content/CVPR2025/papers/Diehl_DIO_Decomposable_Implicit_4D_Occupancy-Flow_World_Model_CVPR_2025_paper.pdf) |

### Deployment & Adaptation

| Paper | Venue | Year | Link |
|-------|-------|------|------|
| PointLoRA | CVPR | 2025 | [Paper](https://openaccess.thecvf.com/content/CVPR2025/papers/Wang_PointLoRA_Low-Rank_Adaptation_with_Token_Selection_for_Point_Cloud_Learning_CVPR_2025_paper.pdf) |
| DSVT-AI-TRT | Community | 2023 | [GitHub](https://github.com/jingyue202205/DSVT-AI-TRT) |
| Senna | arXiv | 2024 | [arXiv](https://arxiv.org/abs/2410.22313), [GitHub](https://github.com/hustvl/Senna) |

---

## Cross-References to Other Documents in This Repository

- **PointPillars architecture details:** `10-knowledge-base/geometry-3d/pointpillars.md`
- **CenterPoint + OpenPCDet setup:** `technology/perception/openpcdet-centerpoint.md`
- **TensorRT deployment guide:** `20-av-platform/compute/tensorrt-deployment-guide.md`
- **NVIDIA Orin specs (275 TOPS):** `20-av-platform/compute/nvidia-orin-technical.md`
- **NVIDIA Thor specs (~1000 TOPS):** `20-av-platform/compute/nvidia-drive-thor.md`
- **Vision foundation models (SAM, DINOv2, CLIP):** `technology/perception/vision-foundation-models.md`
- **Open-vocabulary detection (Grounding DINO, YOLO-World):** `technology/perception/open-vocab-detection.md`
- **DINOv2 for driving (LoRA integration):** `technology/perception/dinov2-foundation-models-driving.md`
- **Occupancy world models:** `technology/world-models/occupancy-world-models.md`
- **Sensor fusion architectures:** `cross-cutting/sensor-fusion-architectures.md`
- **RoboSense LiDAR specs:** `20-av-platform/sensors/robosense-lidar.md`
- **Master synthesis:** `synthesis/master-synthesis.md`
- **POC proposals:** `synthesis/poc-proposals.md`
