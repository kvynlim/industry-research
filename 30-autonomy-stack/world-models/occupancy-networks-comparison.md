# Occupancy Network Architectures for Autonomous Driving: Comprehensive Comparison

**Last Updated:** 2026-03-22
**Scope:** All major 3D/4D occupancy prediction methods relevant to autonomous driving
**Primary Benchmarks:** Occ3D-nuScenes, SemanticKITTI, Argoverse 2

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Method-by-Method Analysis](#method-by-method-analysis)
3. [Comparison Tables](#comparison-tables)
   - [Table 1: Sorted by Accuracy (mIoU)](#table-1-sorted-by-accuracy-miou)
   - [Table 2: Sorted by Speed (FPS)](#table-2-sorted-by-speed-fps)
   - [Table 3: Sorted by Memory Usage](#table-3-sorted-by-memory-usage)
   - [Table 4: LiDAR-Only Capability](#table-4-lidar-only-capability)
4. [Open-Source Availability](#open-source-availability)
5. [Recommendations for Airside AV](#recommendations-for-airside-av)

---

## Executive Summary

Occupancy networks predict dense 3D voxelized representations of the environment, classifying each voxel as occupied/free with semantic labels. This survey covers 20 methods spanning three categories:

- **3D Occupancy Prediction** (single-frame or temporal): TPVFormer, SurroundOcc, FB-OCC, FlashOcc, SparseOcc, PanoOcc, RenderOcc, GaussianFormer, GaussianFormer-2, SimpleOccupancy, CTF-Occ, COTR, SelfOcc, MonoOcc
- **4D Occupancy World Models** (forecasting + planning): OccWorld, Drive-OccWorld, OccSora, OccLLaMA
- **4D Occupancy Benchmarks/Forecasting**: Cam4DOcc, UnO

**Critical finding for airside AV:** The vast majority of occupancy networks are **camera-only** or **camera-primary**. Only **UnO** is explicitly designed for LiDAR-only input with self-supervised 4D occupancy field learning. For Phase 1 LiDAR-only airside deployment, UnO is the strongest candidate, while FlashOcc and SparseOcc offer the best paths for future camera addition.

---

## Method-by-Method Analysis

### 1. TPVFormer

- **Paper:** "Tri-Perspective View for Vision-Based 3D Semantic Occupancy Prediction" (CVPR 2023)
- **Architecture:** Proposes tri-perspective view (TPV) representation -- three orthogonal planes (BEV + two perpendicular planes). Uses transformer-based cross-attention to lift 2D image features into the TPV space, with cross-view hybrid attention for inter-plane interaction.
- **Input:** Camera-only (6 surround-view images)
- **Backbone:** ResNet-101 with DCN
- **Performance (Occ3D-nuScenes):** 28.34 mIoU
- **Latency:** ~341 ms per frame on A100 (~2.9 FPS)
- **Memory:** ~29,000 MB (29 GB) during inference
- **Code:** Open-source with pretrained weights ([github.com/wzzheng/TPVFormer](https://github.com/wzzheng/TPVFormer))
- **LiDAR-only:** No (camera-only design)
- **Notes:** Foundational work; many subsequent methods build on or compare against it. S2TPVFormer adds spatiotemporal extension with +4.1% mIoU gain.

### 2. SurroundOcc

- **Paper:** "SurroundOcc: Multi-Camera 3D Occupancy Prediction for Autonomous Driving" (ICCV 2023)
- **Architecture:** Extracts multi-scale features from images, uses spatial 2D-3D cross-attention to lift to 3D volume space, applies 3D convolutions for progressive upsampling with multi-level supervision. Generates dense training labels via multi-frame LiDAR fusion + Poisson Reconstruction.
- **Input:** Camera-only (multi-camera)
- **Backbone:** ResNet-101 (default)
- **Performance (Occ3D-nuScenes):** ~20.30 mIoU (self-reported SSC), ~39.4 mIoU (later benchmark results with improved settings)
- **Latency:** Not officially reported
- **Memory:** Trained on 8x RTX 3090 (24 GB each)
- **Code:** Open-source with pretrained weights ([github.com/weiyithu/SurroundOcc](https://github.com/weiyithu/SurroundOcc))
- **LiDAR-only:** No (uses LiDAR for label generation only, not inference)
- **Notes:** Pioneered the dense label generation pipeline using Poisson reconstruction from sparse LiDAR.

### 3. FB-OCC

- **Paper:** "FB-OCC: 3D Occupancy Prediction based on Forward-Backward View Transformation" (2023, 1st place nuScenes challenge)
- **Architecture:** Built on FB-BEV forward-backward projection. Features joint depth-semantic pre-training, joint voxel-BEV representation, model scaling, and ensemble post-processing.
- **Input:** Camera-only (multi-camera, up to 16 temporal frames)
- **Backbone:** Scales from R50 to large models (67.8M to 1200M parameters)
- **Performance (Occ3D-nuScenes):**
  - Single model R50: 39.1 mIoU (16-frame, 10.3 FPS)
  - Single model 130.8M params: 48.90 mIoU
  - Ensemble (1200M params): **52.79 mIoU** (1st place challenge)
- **Latency:** 10.3 FPS (R50 variant)
- **Memory:** Not reported per-variant
- **Code:** Open-source (NVIDIA LPR lab)
- **LiDAR-only:** No
- **Notes:** Highest reported mIoU on Occ3D-nuScenes but achieved via massive ensembling. Single R50 model is practical at 10.3 FPS.

### 4. FlashOcc

- **Paper:** "FlashOcc: Fast and Memory-Efficient Occupancy Prediction via Channel-to-Height Plugin" (2023)
- **Architecture:** Keeps all feature processing in BEV domain using efficient 2D convolutions, then uses a channel-to-height transformation to lift BEV logits into 3D occupancy space. Replaces expensive 3D convolutions entirely.
- **Input:** Camera-only (multi-camera)
- **Backbone:** ResNet-50 (M0/M1), Swin-B (larger variants)
- **Performance (Occ3D-nuScenes):**
  - M0: 31.95 mIoU
  - M1: 32.08 mIoU
  - With TensorRT: 32.90 mIoU (M4 variant)
  - Survey-reported (enhanced): 45.51 mIoU
- **Latency:**
  - M0: **197.6 FPS** (RTX 3090, TensorRT FP16) -- **fastest known method**
  - M1: 152.7 FPS (RTX 3090, TensorRT FP16)
  - TensorRT deployment: **6.5 ms** latency, 2600 MB memory
- **Memory:** 2,600 MB (TensorRT M4)
- **Code:** Open-source with pretrained weights ([github.com/Yzichen/FlashOCC](https://github.com/Yzichen/FlashOCC))
- **LiDAR-only:** No
- **Notes:** Best speed-accuracy tradeoff. TensorRT-friendly architecture makes it the top candidate for edge deployment. Panoptic-FlashOcc extends to instance segmentation (30.2 FPS, 16.0 RayPQ).

### 5. SparseOcc

- **Paper:** "Fully Sparse 3D Occupancy Prediction" (ECCV 2024)
- **Architecture:** Fully sparse pipeline: reconstructs sparse 3D representation from images, predicts semantic/instance occupancy via sparse queries with mask-guided sparse sampling. Proposes RayIoU evaluation metric.
- **Input:** Camera-only (multi-camera, 8-16 temporal frames)
- **Backbone:** ResNet-50 (nuImages pretrained)
- **Performance (Occ3D-nuScenes):**
  - v1.1 (8f, 24ep): 36.8 RayIoU
  - v1.1 (8f, 60ep): 37.7 RayIoU
  - 8f: 39.4 mIoU, 34.0 RayIoU, 17.3 FPS
  - 16f: 40.3 mIoU, 35.1 RayIoU, 12.5 FPS
- **Latency:** 17.3 FPS (8-frame) on A100
- **Memory:** ~12 GB training
- **Code:** Open-source with pretrained weights ([github.com/MCG-NJU/SparseOcc](https://github.com/MCG-NJU/SparseOcc))
- **LiDAR-only:** No
- **Notes:** Excellent accuracy-speed balance. RayIoU metric addresses depth-inconsistency penalties in standard mIoU. Strong practical candidate.

### 6. PanoOcc

- **Paper:** "PanoOcc: Unified Occupancy Representation for Camera-based 3D Panoptic Segmentation" (CVPR 2024)
- **Architecture:** Uses voxel queries to aggregate spatiotemporal information from multi-frame, multi-view images in a coarse-to-fine scheme. Supports both semantic and panoptic segmentation.
- **Input:** Camera-only (multi-camera, multi-frame)
- **Backbone:** R50, R101-DCN, InternImage-XL
- **Performance (Occ3D-nuScenes):**
  - Pano-small: 36.63 mIoU
  - Pano-base: 41.60 mIoU
  - Pano-base-pretrain: **42.13 mIoU**
- **Latency:** ~149 ms (6.7 FPS)
- **Memory:** 14-35 GB depending on configuration
- **Code:** Open-source with pretrained weights ([github.com/Robertwyq/PanoOcc](https://github.com/Robertwyq/PanoOcc))
- **LiDAR-only:** No
- **Notes:** Strong accuracy with unified panoptic + occupancy framework. Memory-heavy for large configs.

### 7. RenderOcc

- **Paper:** "RenderOcc: Vision-Centric 3D Occupancy Prediction with 2D Rendering Supervision" (ICRA 2024)
- **Architecture:** NeRF-style volume rendering approach. Extracts 3D volume from multi-view images, uses volume rendering to generate 2D renderings, enabling 3D supervision from 2D semantic and depth labels only.
- **Input:** Camera-only (multi-camera)
- **Backbone:** Swin-Base with BEVStereo
- **Performance (Occ3D-nuScenes):**
  - 2D supervision only: 23.93 mIoU
  - 2D+3D combined: 26.11 mIoU
  - Swin-B, 12ep: 24.46 mIoU
- **Latency:** Not reported
- **Memory:** Not reported
- **Code:** Open-source with one pretrained model ([github.com/pmj110119/RenderOcc](https://github.com/pmj110119/RenderOcc))
- **LiDAR-only:** No
- **Notes:** Key innovation is eliminating need for 3D occupancy labels during training. Lower accuracy but dramatically reduces annotation cost.

### 8. GaussianFormer

- **Paper:** "GaussianFormer: Scene as Gaussians for Vision-Based 3D Semantic Occupancy Prediction" (ECCV 2024)
- **Architecture:** First object-centric representation using 3D semantic Gaussians. Each Gaussian has position, covariance, and semantics. GaussianFormer learns Gaussians from images via attention + iterative refinement, with efficient Gaussian-to-voxel splatting.
- **Input:** Camera-only (multi-camera)
- **Backbone:** ResNet-101 with DCN
- **Performance:**
  - Occ3D-nuScenes (SurroundOcc labels): 19.10 mIoU (SC IoU: 29.83)
- **Latency:** 372 ms (~2.7 FPS)
- **Memory:** 6,229 MB (~6.2 GB) -- **75-82% less than dense methods**
- **Code:** Open-source with pretrained weights ([github.com/huang-yh/GaussianFormer](https://github.com/huang-yh/GaussianFormer))
- **LiDAR-only:** No
- **Notes:** Revolutionary memory efficiency through Gaussian representation. Lower absolute mIoU but uses fundamentally different (sparser) labels than dense methods.

### 9. GaussianFormer-2

- **Paper:** "GaussianFormer-2: Probabilistic Gaussian Superposition for Efficient 3D Occupancy Prediction" (CVPR 2025)
- **Architecture:** Extends GaussianFormer with probabilistic Gaussian superposition model. Each Gaussian is a probability distribution of neighborhood occupancy. Uses exact Gaussian mixture for semantics. Distribution-based initialization to place Gaussians in non-empty regions.
- **Input:** Camera-only (multi-camera)
- **Backbone:** ResNet-101 with DCN
- **Performance:**
  - Occ3D-nuScenes: 20.33 mIoU (with only 25.6k Gaussians vs 144k in v1)
  - KITTI-360: +7.6% over GaussianFormer-v1
- **Latency:** Improved over v1 (exact not reported)
- **Memory:** Significantly less than v1 (uses <5% the number of Gaussians for better results)
- **Code:** Open-source with pretrained weights (same repo as GaussianFormer)
- **LiDAR-only:** No
- **Notes:** Major efficiency improvement. 12,800 Gaussians outperform 144,000 in v1.

### 10. OccWorld

- **Paper:** "OccWorld: Learning a 3D Occupancy World Model for Autonomous Driving" (ECCV 2024)
- **Architecture:** GPT-like spatial-temporal generative transformer. CNNs encode 3D occupancy + vector quantization (VQ-VAE) to obtain discrete tokens. Autoregressive transformer predicts next-future world tokens.
- **Input:** 3D occupancy (from various sources: LiDAR-collected, camera-predicted, or self-supervised)
- **Backbone:** Builds on TPVFormer / SelfOcc / SurroundOcc for occupancy input
- **Performance (4D Forecasting, Occ3D):**
  - OccWorld-O (GT occ): Avg IoU 26.63, Avg mIoU 17.14
  - OccWorld-D (camera pred): Avg IoU 16.53, Avg mIoU 8.62
  - Planning L2@3s: 1.99m, Collision: 1.35%
- **Latency:** Not reported
- **Memory:** Requires RTX 4090 24 GB for training
- **Code:** Open-source with pretrained weights ([github.com/wzzheng/OccWorld](https://github.com/wzzheng/OccWorld))
- **LiDAR-only:** Partially -- accepts LiDAR-derived occupancy as input (OccWorld-T variant uses semantic LiDAR)
- **Notes:** Foundational occupancy world model. Can be combined with any upstream occupancy predictor.

### 11. Drive-OccWorld

- **Paper:** "Driving in the Occupancy World: Vision-Centric 4D Occupancy Forecasting and Planning via World Models" (AAAI 2025, Oral)
- **Architecture:** Extends OccWorld with semantic/motion-conditional normalization in memory module. Unified conditioning interface for action conditions (velocity, steering, trajectory, commands). Occupancy-based planner selects trajectories via cost function.
- **Input:** Camera-only (multi-camera BEV features)
- **Backbone:** Not explicitly stated (uses BEV encoder)
- **Performance:**
  - Occupancy forecasting mIoU (future): 15.1% (+1.1% over Cam4DOcc)
  - Planning L2@1s: 0.44m (vs UniAD 0.67m, **33% improvement**)
  - Planning L2@2s: 0.77m (vs UniAD 1.20m, **36% improvement**)
  - Planning L2@3s: 1.20m (vs UniAD 1.65m, **27% improvement**)
- **Latency:** Not reported
- **Memory:** Not reported
- **Code:** Open-source ([github.com/yuyang-cloud/Drive-OccWorld](https://github.com/yuyang-cloud/Drive-OccWorld))
- **LiDAR-only:** No
- **Notes:** Best planning performance among occupancy world models. Action-controllable generation is key differentiator.

### 12. OccSora

- **Paper:** "OccSora: 4D Occupancy Generation Models as World Simulators for Autonomous Driving" (2024)
- **Architecture:** Diffusion-based (not autoregressive). 4D scene tokenizer for compact discrete spatial-temporal representations. Diffusion transformer generates 4D occupancy conditioned on trajectory prompts.
- **Input:** Camera (multi-view via nuScenes) + trajectory prompts
- **Backbone:** DiT-XL/2 (Diffusion Transformer)
- **Performance:** Generates 16-second occupancy videos with authentic 3D layout; quantitative metrics (FID/FVD) not prominently reported in available materials
- **Latency:** Not reported
- **Memory:** Requires A100 80 GB for training
- **Code:** Open-source ([github.com/wzzheng/OccSora](https://github.com/wzzheng/OccSora)); pretrained weights NOT available
- **LiDAR-only:** No
- **Notes:** Generative world simulator, not a perception model. Useful for data augmentation and scenario generation. Not suitable for real-time deployment.

### 13. Cam4DOcc

- **Paper:** "Cam4DOcc: Benchmark for Camera-Only 4D Occupancy Forecasting in Autonomous Driving" (CVPR 2024)
- **Architecture:** Benchmark providing four baseline types: static-world occupancy, voxelized point cloud prediction, 2D-3D instance-based prediction, and end-to-end OCFNet. Standardized evaluation protocol.
- **Input:** Camera-only (surround cameras)
- **Backbone:** Various (benchmark-dependent)
- **Performance:** OCFNet baselines provided for V1.1 (2 classes) and V1.2 (9 classes)
  - Voxel size: 0.2m, Volume: [512, 512, 40]
  - Training: 23,930 sequences, Validation: 5,119 frames
- **Code:** Open-source ([github.com/haomo-ai/Cam4DOcc](https://github.com/haomo-ai/Cam4DOcc)); pretrained weights pending update
- **LiDAR-only:** No (camera-only by design)
- **Notes:** A benchmark/dataset contribution, not a standalone model. Foundation for evaluating 4D occupancy forecasting methods.

### 14. UnO

- **Paper:** "UnO: Unsupervised Occupancy Fields for Perception and Forecasting" (CVPR 2024 Oral, Best Model -- Argoverse 2 LiDAR Forecasting Challenge)
- **Architecture:** Voxelizes past LiDAR, passes through LiDAR encoder to produce BEV feature map. Implicit decoder with deformable attention outputs continuous occupancy probability at any space-time point. Fully self-supervised -- no object annotations needed.
- **Input:** **LiDAR-only** (primary and native input modality)
- **Backbone:** Voxel-based LiDAR encoder + implicit decoder
- **Performance:**
  - **1st place** Argoverse 2 LiDAR forecasting challenge (CVPR 2024)
  - Argoverse 2: NFCD 0.71 m^2, Chamfer Distance 7.02 m^2
  - nuScenes: NFCD 0.89 m^2, Chamfer Distance 1.80 m^2
  - KITTI: NFCD 0.72 m^2, Chamfer Distance 0.90 m^2
  - BEV Semantic Occupancy (Argoverse 2): mAP 52.3, Soft-IoU 22.3
  - State-of-the-art across Argoverse 2, nuScenes, and KITTI
- **Latency:** Not reported (runs query points in parallel for efficiency)
- **Memory:** Not reported
- **Code:** **Not open-source** (Waabi proprietary)
- **LiDAR-only:** **YES -- native LiDAR-only design**
- **Notes:** MOST RELEVANT for Phase 1 airside deployment. Self-supervised from raw LiDAR, no annotation needed. However, code is NOT public (Waabi). Would need to reimplement or license.

### 15. OccLLaMA

- **Paper:** "OccLLaMA: An Occupancy-Language-Action Generative World Model for Autonomous Driving" (2024)
- **Architecture:** Unified multi-modal model using LLaMA backbone. Novel VQ-VAE scene tokenizer discretizes/reconstructs semantic occupancy. Unified vocabulary for vision, language, and action. Next-token/scene prediction.
- **Input:** 3D occupancy (from GT or camera-based prediction like FBOCC)
- **Backbone:** LLaMA (enhanced for multi-modal)
- **Performance (4D Forecasting):**
  - OccLLaMA-O (GT occ): 1s mIoU 25.05%, 2s 19.49%, 3s **15.26%** (vs OccWorld 10.51%)
  - OccLLaMA-F (camera pred): 1s mIoU 10.34%, 2s 8.66%, 3s 6.98%
  - Planning L2 avg: 1.14m, Collision avg: 0.49%
- **Latency:** Not reported (LLM-based, likely slow)
- **Memory:** Not reported (LLM-scale)
- **Code:** Not publicly available as of search date
- **LiDAR-only:** Partially (accepts occupancy from any source)
- **Notes:** Superior long-term forecasting vs OccWorld. Multi-task (forecasting + planning + VQA). Research prototype, not deployment-ready.

### 16. SimpleOccupancy

- **Paper:** "A Simple Framework for 3D Occupancy Estimation in Autonomous Driving" (IEEE TIV)
- **Architecture:** CNN-based framework using view transformation from images to 3D voxels, then NeRF-style rendering to 2D depth maps supervised by sparse LiDAR depth. Reveals key factors: network design, optimization, evaluation.
- **Input:** Camera-only (multi-camera)
- **Backbone:** Various (framework study)
- **Performance (Occ3D-nuScenes):** ~31.8 mIoU (from SparseOcc comparison table)
- **Latency:** ~9.7 FPS (from SparseOcc comparison: 103 ms)
- **Memory:** Not reported
- **Code:** Open-source ([github.com/GANWANSHUI/SimpleOccupancy](https://github.com/GANWANSHUI/SimpleOccupancy))
- **LiDAR-only:** No (uses LiDAR for depth supervision only)
- **Notes:** Valuable as a baseline and ablation study framework. Moderate performance.

### 17. CTF-Occ

- **Paper:** Part of Occ3D benchmark (NeurIPS 2023)
- **Architecture:** Coarse-to-Fine transformer-based occupancy prediction. Pyramid voxel encoder with incremental token selection and spatial cross-attention. Only top-k uncertain voxels propagated for efficiency.
- **Input:** Camera-only (multi-camera)
- **Backbone:** ResNet-101
- **Performance (Occ3D-nuScenes):** 28.53 mIoU
- **Latency:** Not reported
- **Memory:** Not reported
- **Code:** Open-source (via Occ3D repo, [github.com/Tsinghua-MARS-Lab/Occ3D](https://github.com/Tsinghua-MARS-Lab/Occ3D))
- **LiDAR-only:** No
- **Notes:** Released as part of Occ3D benchmark. Coarse-to-fine strategy reduces computation on confident voxels.

### 18. COTR

- **Paper:** "COTR: Compact Occupancy TRansformer for Vision-based 3D Occupancy Prediction" (CVPR 2024)
- **Architecture:** Geometry-aware occupancy encoder (explicit-implicit view transformation) + semantic-aware group decoder (coarse-to-fine semantic grouping with transformer mask classification). Designed as a modular plugin for existing methods.
- **Input:** Camera-only (multi-camera, multi-frame)
- **Backbone:** ResNet-50 (base), SwinTransformer-B (scaled)
- **Performance (Occ3D-nuScenes):**
  - COTR + TPVFormer: 39.3 mIoU (+5.1%)
  - COTR + SurroundOcc: 39.3 mIoU (+4.7%)
  - COTR + OccFormer: 41.2 mIoU (+3.8%)
  - COTR + BEVDet4D (R50): 44.5 mIoU (+5.2%)
  - COTR + BEVDet4D (Swin-B): **46.2 mIoU** (best single-model)
- **Latency:** Not officially benchmarked
- **Memory:** Not reported
- **Code:** Open-source ([github.com/NotACracker/COTR](https://github.com/NotACracker/COTR))
- **LiDAR-only:** No
- **Notes:** Universal improvement module. 8-15% relative improvement over any baseline. Best single-model mIoU (46.2) when paired with Swin-B backbone.

### 19. SelfOcc

- **Paper:** "SelfOcc: Self-Supervised Vision-Based 3D Occupancy Prediction" (CVPR 2024)
- **Architecture:** Transforms images to 3D representation (BEV or TPV), treats them as signed distance fields, renders 2D images of adjacent frames as self-supervision. No 3D occupancy labels needed.
- **Input:** Camera-only (video sequences + poses)
- **Backbone:** Not explicitly stated
- **Performance:**
  - Occ3D-nuScenes: 9.30 mIoU (self-supervised, no 3D labels)
  - SemanticKITTI (monocular): IoU 21.97 (vs SceneRF 13.84, **+58.7%**)
- **Latency:** Not reported
- **Memory:** Not reported
- **Code:** Open-source with pretrained weights ([github.com/huang-yh/SelfOcc](https://github.com/huang-yh/SelfOcc))
- **LiDAR-only:** No
- **Notes:** First self-supervised method producing reasonable occupancy. Low absolute numbers but eliminates need for 3D annotations. Powers OccWorld's scalable training.

### 20. MonoOcc

- **Paper:** "MonoOcc: Digging into Monocular Semantic Occupancy Prediction" (ICRA 2024)
- **Architecture:** Monocular framework with auxiliary semantic loss for shallow layers, image-conditioned cross-attention for voxel refinement, and distillation from larger backbone for temporal knowledge transfer.
- **Input:** Camera-only (monocular -- single image)
- **Backbone:** ResNet-50 (S), InternImage-XL (L)
- **Performance:**
  - SemanticKITTI: R50 = 14.01 mIoU (val), InternImage-XL = **15.63 mIoU** (test)
  - nuScenes: R50 = **41.86 mIoU** (val)
- **Latency:** Not reported
- **Memory:** Not reported
- **Code:** Open-source with pretrained weights ([github.com/ucaszyp/MonoOcc](https://github.com/ucaszyp/MonoOcc))
- **LiDAR-only:** No
- **Notes:** Monocular-only design (single camera). Surprisingly strong on nuScenes (41.86 mIoU) relative to multi-camera methods. Relevant for single-camera deployments.

---

## Comparison Tables

### Table 1: Sorted by Accuracy (mIoU on Occ3D-nuScenes)

| Rank | Method | mIoU | Benchmark | Input | Backbone | Venue |
|------|--------|------|-----------|-------|----------|-------|
| 1 | FB-OCC (ensemble) | 52.79 | Occ3D-nuScenes | Camera | Multi-model ensemble | Challenge 2023 |
| 2 | COTR + BEVDet4D | 46.2 | Occ3D-nuScenes | Camera | Swin-B | CVPR 2024 |
| 3 | FlashOcc (enhanced) | 45.51 | Occ3D-nuScenes | Camera | Varies | 2023 |
| 4 | COTR + BEVDet4D | 44.5 | Occ3D-nuScenes | Camera | R50 | CVPR 2024 |
| 5 | PanoOcc-base-pt | 42.13 | Occ3D-nuScenes | Camera | R101-DCN | CVPR 2024 |
| 6 | MonoOcc | 41.86 | nuScenes (val) | Camera (mono) | R50 | ICRA 2024 |
| 7 | PanoOcc-base | 41.60 | Occ3D-nuScenes | Camera | R101-DCN | CVPR 2024 |
| 8 | COTR + OccFormer | 41.2 | Occ3D-nuScenes | Camera | -- | CVPR 2024 |
| 9 | SparseOcc (16f) | 40.3 | Occ3D-nuScenes | Camera | R50 | ECCV 2024 |
| 10 | SurroundOcc | ~39.4 | Occ3D-nuScenes | Camera | R101 | ICCV 2023 |
| 11 | SparseOcc (8f) | 39.4 | Occ3D-nuScenes | Camera | R50 | ECCV 2024 |
| 12 | COTR + TPVFormer | 39.3 | Occ3D-nuScenes | Camera | R101-DCN | CVPR 2024 |
| 13 | FB-OCC (R50 single) | 39.1 | Occ3D-nuScenes | Camera | R50 | 2023 |
| 14 | PanoOcc-small | 36.63 | Occ3D-nuScenes | Camera | R50 | CVPR 2024 |
| 15 | FlashOcc-M4 (TRT) | 32.90 | Occ3D-nuScenes | Camera | R50 | 2023 |
| 16 | FlashOcc-M1 | 32.08 | Occ3D-nuScenes | Camera | R50 | 2023 |
| 17 | SimpleOccupancy | ~31.8 | Occ3D-nuScenes | Camera | R101 | IEEE TIV |
| 18 | CTF-Occ | 28.53 | Occ3D-nuScenes | Camera | R101 | NeurIPS 2023 |
| 19 | TPVFormer | 28.34 | Occ3D-nuScenes | Camera | R101-DCN | CVPR 2023 |
| 20 | RenderOcc (2D+3D) | 26.11 | Occ3D-nuScenes | Camera | Swin-B | ICRA 2024 |
| 21 | RenderOcc (2D only) | 23.93 | Occ3D-nuScenes | Camera | Swin-B | ICRA 2024 |
| 22 | GaussianFormer-2 | 20.33 | nuScenes (SurrOcc) | Camera | R101-DCN | CVPR 2025 |
| 23 | GaussianFormer | 19.10 | nuScenes (SurrOcc) | Camera | R101-DCN | ECCV 2024 |
| 24 | SelfOcc | 9.30 | Occ3D-nuScenes | Camera | -- | CVPR 2024 |

**Note:** GaussianFormer/GaussianFormer-2 mIoU uses SurroundOcc-style labels, not directly comparable to Occ3D. MonoOcc uses only a single camera input.

### Table 2: Sorted by Speed (FPS)

| Rank | Method | FPS | Latency | Hardware | mIoU | Notes |
|------|--------|-----|---------|----------|------|-------|
| 1 | FlashOcc-M0 | **197.6** | 5.1 ms | RTX 3090 TRT FP16 | 31.95 | Fastest by large margin |
| 2 | FlashOcc-M1 | 152.7 | 6.5 ms | RTX 3090 TRT FP16 | 32.08 | |
| 3 | FlashOcc-M4 | ~154 | 6.5 ms | RTX 3090 TRT FP16 | 32.90 | |
| 4 | SparseOcc (8f) | 17.3 | 57.8 ms | A100 | 39.4 | |
| 5 | SparseOcc (16f) | 12.5 | 80 ms | A100 | 40.3 | |
| 6 | FB-OCC (R50, 16f) | 10.3 | 97 ms | A100 | 39.1 | |
| 7 | SimpleOccupancy | ~9.7 | ~103 ms | -- | ~31.8 | |
| 8 | PanoOcc | ~6.7 | 149 ms | -- | 42.13 | |
| 9 | BEVFormer (ref) | ~3.3 | 302 ms | -- | 26.88 | Baseline reference |
| 10 | TPVFormer | ~2.9 | 341 ms | A100 | 28.34 | |
| 11 | GaussianFormer | ~2.7 | 372 ms | -- | 19.10 | |

**Methods without reported FPS:** SurroundOcc, RenderOcc, GaussianFormer-2, COTR, SelfOcc, MonoOcc, OccWorld, Drive-OccWorld, OccSora, OccLLaMA, Cam4DOcc, UnO

### Table 3: Sorted by Memory Usage

| Rank | Method | Memory | Notes |
|------|--------|--------|-------|
| 1 | FlashOcc-M4 (TRT) | **2,600 MB** | TensorRT optimized |
| 2 | GaussianFormer | 6,229 MB | 75-82% less than dense methods |
| 3 | GaussianFormer-2 | <6,229 MB | Uses <5% Gaussians of v1 |
| 4 | SparseOcc | ~12,000 MB | Training memory |
| 5 | PanoOcc-small | ~14,000 MB | |
| 6 | BEVFormer (ref) | 25,100 MB | Baseline reference |
| 7 | TPVFormer | 29,000 MB | |
| 8 | PanoOcc-base | ~35,000 MB | |
| 9 | OccSora | 80,000 MB+ | A100 80GB required for training |

**Methods without reported memory:** SurroundOcc, FB-OCC (per-variant), RenderOcc, COTR, CTF-Occ, SimpleOccupancy, SelfOcc, MonoOcc, OccWorld (24GB 4090 training), Drive-OccWorld, OccLLaMA, Cam4DOcc, UnO

### Table 4: LiDAR-Only Capability

| Method | Native LiDAR-Only | Can Accept LiDAR Input | Notes |
|--------|--------------------|----------------------|-------|
| **UnO** | **YES** | **YES** | Native LiDAR-only. Self-supervised from raw LiDAR scans. 1st place Argoverse 2 LiDAR forecasting. |
| OccWorld | Partially | YES | OccWorld-T variant uses semantic LiDAR occupancy as input. Core model is input-agnostic. |
| OccLLaMA | Partially | YES | Accepts pre-computed occupancy from any source including LiDAR. |
| TPVFormer | No | No* | *Originally camera-only, but paper shows LiDAR segmentation capability |
| SurroundOcc | No | No | Uses LiDAR for label generation only |
| FB-OCC | No | No | Camera-only |
| FlashOcc | No | No | Camera-only |
| SparseOcc | No | No | Camera-only |
| PanoOcc | No | No | Camera-only |
| RenderOcc | No | No | Camera-only |
| GaussianFormer | No | No | Camera-only |
| GaussianFormer-2 | No | No | Camera-only |
| Drive-OccWorld | No | No | Camera-only (BEV features) |
| OccSora | No | No | Camera-only generation |
| Cam4DOcc | No | No | Camera-only benchmark |
| SimpleOccupancy | No | No | Camera-only |
| CTF-Occ | No | No | Camera-only |
| COTR | No | No | Camera-only plugin |
| SelfOcc | No | No | Camera-only self-supervised |
| MonoOcc | No | No | Monocular camera only |

---

## Open-Source Availability

### Full Code + Pretrained Weights Available

| Method | Repository | Weights |
|--------|-----------|---------|
| TPVFormer | github.com/wzzheng/TPVFormer | Yes |
| SurroundOcc | github.com/weiyithu/SurroundOcc | Yes (Baidu Pan) |
| FlashOcc | github.com/Yzichen/FlashOCC | Yes (Google Drive + Baidu) |
| SparseOcc | github.com/MCG-NJU/SparseOcc | Yes (GitHub releases) |
| PanoOcc | github.com/Robertwyq/PanoOcc | Yes (Google Drive + Baidu) |
| RenderOcc | github.com/pmj110119/RenderOcc | Partial (1 model) |
| GaussianFormer / v2 | github.com/huang-yh/GaussianFormer | Yes |
| OccWorld | github.com/wzzheng/OccWorld | Yes |
| SelfOcc | github.com/huang-yh/SelfOcc | Yes |
| MonoOcc | github.com/ucaszyp/MonoOcc | Yes (Google Drive) |
| COTR | github.com/NotACracker/COTR | Partial |
| CTF-Occ | github.com/Tsinghua-MARS-Lab/Occ3D | Yes |
| SimpleOccupancy | github.com/GANWANSHUI/SimpleOccupancy | Partial |

### Code Available, Weights Pending or Partial

| Method | Repository | Status |
|--------|-----------|--------|
| Drive-OccWorld | github.com/yuyang-cloud/Drive-OccWorld | Code yes, weights unclear |
| OccSora | github.com/wzzheng/OccSora | Code yes, **no pretrained weights** |
| Cam4DOcc | github.com/haomo-ai/Cam4DOcc | Code yes, weights deprecated/pending update |
| FB-OCC | NVIDIA LPR (limited) | Partial |

### No Public Code

| Method | Status |
|--------|--------|
| **UnO** | **Waabi proprietary -- no public code or weights** |
| OccLLaMA | No public repository found |

---

## Recommendations for Airside AV

### Context
- **Phase 1:** LiDAR-only sensing (no cameras initially)
- **Target Hardware:** NVIDIA Jetson AGX Orin (275 TOPS INT8, ~60W)
- **Future:** Camera sensors will be added later
- **Environment:** Airport airside -- ground vehicles, aircraft, GSE, personnel on tarmac

### Recommended Option 1: FlashOcc (Best for Camera Phase)

**Why:** Unmatched deployment readiness.
- 197.6 FPS on RTX 3090 with TensorRT FP16 (6.5 ms latency, 2.6 GB memory)
- Orin AGX has ~1/4 to 1/3 of RTX 3090 throughput, so expect ~50-65 FPS -- still real-time
- Pure 2D conv architecture is maximally TensorRT-friendly
- Channel-to-height transformation avoids expensive 3D convolutions entirely
- Open-source with pretrained weights
- Panoptic-FlashOcc variant adds instance segmentation

**Limitation:** Camera-only. Not usable in Phase 1 LiDAR-only stage.

**Strategy:** Prepare FlashOcc pipeline for Phase 2 camera addition. Use the architecture's efficiency principles to design the LiDAR pipeline.

### Recommended Option 2: SparseOcc (Best Accuracy-Speed Balance for Camera Phase)

**Why:** Best practical accuracy with real-time inference.
- 17.3 FPS on A100 (expect ~4-6 FPS on Orin, potentially viable with TRT optimization)
- 39.4 mIoU (8-frame) -- strong accuracy
- Fully sparse architecture is memory-efficient
- RayIoU metric provides better evaluation for safety-critical applications
- Open-source with pretrained weights
- R50 backbone is Orin-friendly

**Limitation:** Camera-only. May need TensorRT optimization for Orin real-time.

**Strategy:** Evaluate TensorRT conversion for Orin target. Sparse architecture principles transfer well to LiDAR processing.

### Recommended Option 3: Custom LiDAR Occupancy (UnO-inspired) + OccWorld

**Why:** Only viable path for Phase 1 LiDAR-only deployment.

**UnO** is the only surveyed method designed for LiDAR-only 4D occupancy, but its code is proprietary (Waabi). The recommended approach:

1. **Build a LiDAR occupancy encoder** using UnO's published architecture as reference:
   - Voxelize LiDAR point clouds
   - BEV feature encoder (sparse 3D convolutions, e.g., using MinkowskiEngine or SpConv)
   - Implicit decoder with deformable attention for continuous space-time occupancy
   - Self-supervised training from raw LiDAR sequences (no annotation needed)

2. **Integrate with OccWorld** for forecasting and planning:
   - OccWorld is open-source and input-agnostic (accepts any occupancy representation)
   - OccWorld-T variant already demonstrates LiDAR-derived occupancy input
   - GPT-like autoregressive forecasting + planning from occupancy tokens

3. **Future camera fusion:** When cameras are added, replace/augment the LiDAR encoder with FlashOcc or SparseOcc, keeping OccWorld as the world model backbone.

**Key advantages for airside:**
- Self-supervised LiDAR training eliminates expensive annotation of airport-specific objects
- Continuous 4D occupancy field handles unusual objects (GSE, aircraft parts) without class-specific detection
- OccWorld provides planning capability from occupancy representation
- Architecture accommodates sensor addition without full redesign

### Hardware Deployment Summary (NVIDIA Orin AGX)

| Method | Estimated Orin FPS | Orin Viability | Phase |
|--------|-------------------|----------------|-------|
| FlashOcc (TRT FP16) | 50-65 FPS | Excellent | Phase 2 (Camera) |
| SparseOcc (TRT FP16) | 4-8 FPS | Marginal, needs optimization | Phase 2 (Camera) |
| Custom LiDAR Encoder | 10-30 FPS (design-dependent) | Good with sparse convolutions | Phase 1 (LiDAR) |
| PanoOcc | 1-2 FPS | Not viable | -- |
| GaussianFormer | <1 FPS | Not viable | -- |
| OccWorld (forecasting) | 2-5 FPS | Viable as async world model | Phase 1+2 |

### Key Takeaway

No existing open-source occupancy network natively supports LiDAR-only input for real-time deployment. The most practical path is:

1. **Phase 1:** Build a custom LiDAR voxel encoder (UnO-inspired, using open tools like SpConv/MinkowskiEngine) with self-supervised training, paired with OccWorld for forecasting.
2. **Phase 2:** Add FlashOcc for camera-based occupancy, fuse with LiDAR pipeline, retaining OccWorld as the world model backbone.

This two-phase approach avoids dependency on proprietary code while leveraging the best available open-source components.

---

## Appendix: World Model Methods (4D Forecasting) Comparison

| Method | Forecasting mIoU @3s | Planning L2 @3s | Collision @3s | Input | Venue |
|--------|---------------------|-----------------|--------------|-------|-------|
| OccLLaMA-O | **15.26%** | 2.03m | 1.20% | GT Occupancy | 2024 |
| OccWorld-O | 10.51% | 1.99m | 1.35% | GT Occupancy | ECCV 2024 |
| OccLLaMA-F | 6.98% | -- | -- | Camera pred | 2024 |
| Drive-OccWorld | -- | **1.20m** | -- | Camera BEV | AAAI 2025 |
| OccWorld-D | 6.22% (avg) | 2.41m | 2.08% | Camera pred | ECCV 2024 |

Drive-OccWorld achieves the best planning performance (L2@3s = 1.20m vs UniAD's 1.65m). OccLLaMA has the best long-term forecasting (15.26% vs OccWorld's 10.51% at 3s).

---

## References

- TPVFormer: https://github.com/wzzheng/TPVFormer
- SurroundOcc: https://github.com/weiyithu/SurroundOcc
- FB-OCC: https://arxiv.org/abs/2307.01492
- FlashOcc: https://github.com/Yzichen/FlashOCC
- SparseOcc: https://github.com/MCG-NJU/SparseOcc
- PanoOcc: https://github.com/Robertwyq/PanoOcc
- RenderOcc: https://github.com/pmj110119/RenderOcc
- GaussianFormer: https://github.com/huang-yh/GaussianFormer
- OccWorld: https://github.com/wzzheng/OccWorld
- Drive-OccWorld: https://github.com/yuyang-cloud/Drive-OccWorld
- OccSora: https://github.com/wzzheng/OccSora
- Cam4DOcc: https://github.com/haomo-ai/Cam4DOcc
- UnO: https://waabi.ai/uno/ (arXiv: 2406.08691)
- OccLLaMA: https://arxiv.org/abs/2409.03272
- SimpleOccupancy: https://github.com/GANWANSHUI/SimpleOccupancy
- CTF-Occ: https://github.com/Tsinghua-MARS-Lab/Occ3D
- COTR: https://github.com/NotACracker/COTR
- SelfOcc: https://github.com/huang-yh/SelfOcc
- MonoOcc: https://github.com/ucaszyp/MonoOcc
- Occ3D Benchmark: https://github.com/Tsinghua-MARS-Lab/Occ3D
- Survey (Information Fusion 2025): https://arxiv.org/abs/2405.05173
- Survey (Vision-based review): https://arxiv.org/abs/2405.02595
