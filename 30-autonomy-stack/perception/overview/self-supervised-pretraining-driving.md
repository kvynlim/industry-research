# Self-Supervised Pre-training Strategies for Autonomous Driving Perception

**Research Date:** 2026-04-11
**Focus:** Unified survey of SSL pre-training methods for AV perception -- contrastive, masked autoencoder, JEPA, cross-modal distillation, and foundation model adaptation -- with emphasis on LiDAR-primary airside deployment

---

## Table of Contents

1. [Why Self-Supervised Pre-training for Driving](#1-why-self-supervised-pre-training-for-driving)
2. [Contrastive Learning Methods](#2-contrastive-learning-methods)
3. [Masked Autoencoder (MAE) Methods](#3-masked-autoencoder-mae-methods)
4. [JEPA and Embedding-Space Prediction](#4-jepa-and-embedding-space-prediction)
5. [DINO/DINOv2 for Driving](#5-dinov2-for-driving)
6. [Multi-Modal Pre-training](#6-multi-modal-pre-training)
7. [Pre-training to Fine-tuning Pipeline](#7-pre-training-to-fine-tuning-pipeline)
8. [Pre-training for Specific Tasks](#8-pre-training-for-specific-tasks)
9. [Training Infrastructure and Efficiency](#9-training-infrastructure-and-efficiency)
10. [Airside Pre-training Strategy](#10-airside-pre-training-strategy)
11. [Comprehensive Comparison Table](#11-comprehensive-comparison-table)
12. [Key Findings Summary](#12-key-findings-summary)
13. [References](#13-references)

---

## 1. Why Self-Supervised Pre-training for Driving

### 1.1 The Labeled Data Bottleneck

Autonomous driving perception demands enormous quantities of annotated 3D data. A single nuScenes keyframe requires:
- ~40 3D bounding box annotations across 10 classes
- ~100,000 per-point semantic labels (if doing segmentation)
- ~2-4 hours of expert annotator time per frame (3D boxes) or ~8-12 hours (dense segmentation)

At scale, the costs are prohibitive:

| Annotation Task | Cost per Frame | 10K Frames | 100K Frames |
|----------------|---------------|------------|-------------|
| 3D bounding boxes | $8-15 | $80-150K | $800K-1.5M |
| 3D semantic segmentation | $25-50 | $250-500K | $2.5-5M |
| Panoptic 3D | $40-80 | $400-800K | $4-8M |

For airport airside operations, the problem is compounded:
- **No public airside driving datasets exist** -- zero labeled 3D LiDAR frames of apron environments
- **Novel object taxonomy**: GSE (baggage tractors, belt loaders, pushback tugs, catering trucks), aircraft (30-80m wingspan), ramp personnel -- none present in nuScenes/Waymo/KITTI
- **Small fleet size**: Aurrigo operates tens of vehicles, not thousands, limiting organic data collection
- **Annotation expertise**: Labeling airside objects requires domain knowledge (distinguishing GSE subtypes, identifying FOD, classifying aircraft states)

Self-supervised pre-training directly addresses this bottleneck by learning rich representations from **unlabeled data**, which is cheap to collect (just drive the vehicle).

### 1.2 Data Efficiency Gains from Pre-training

Published results consistently show 50-80% label savings:

| Method | Pre-training Type | Label Savings | Evidence |
|--------|------------------|---------------|----------|
| GD-MAE (CVPR 2023) | Masked autoencoder | **80%** | 20% Waymo labels matches full-data baseline |
| GPC (ICLR 2024) | Colorization | **95%** | 5% KITTI labels exceeds scratch training |
| PSA-SSL (CVPR 2025) | Pose/size-aware SSL | **90%** | 10x fewer labels matches SOTA |
| Occupancy-MAE (2023) | Occupancy prediction | **50%** | Halves labeled data for car detection |
| AD-PT (NeurIPS 2023) | Semi-supervised | **60-70%** | Cross-dataset transfer with few-shot |
| ScaLR (CVPR 2024) | Cross-modal distill | **40-50%** | 67.8% mIoU with linear probe only |
| AD-L-JEPA (AAAI 2026) | Embedding prediction | **~80%** | 1.9-2.7x more efficient than Occupancy-MAE |

For airside, this means:
- **Without pre-training**: Need ~5,000-10,000 labeled airside frames ($150-500K annotation cost)
- **With pre-training**: Need ~500-1,000 labeled airside frames ($15-30K annotation cost)
- **Savings**: $100-470K in annotation costs alone

### 1.3 Representation Quality

Self-supervised pre-training learns fundamentally different representations than supervised training:

**Supervised features** are optimized for a specific label set. A model trained to detect {car, truck, pedestrian} develops features biased toward those shapes. Transferring to {baggage tractor, aircraft, pushback tug} requires the features to generalize beyond their training objective.

**Self-supervised features** capture general geometric and semantic structure:
- Surface continuity and curvature (from reconstruction objectives)
- Part-whole relationships (from contrastive objectives)
- Spatial extent and occupancy (from occupancy prediction)
- Cross-modal correspondences (from distillation objectives)

These properties are domain-agnostic. A backbone that understands "this is a large rigid object with a flat surface" transfers from a truck to a baggage loader more readily than one that learned "this is a truck."

Published evidence:
- DINOv2 features transfer to novel tasks with no fine-tuning (frozen linear probe on ADE20k achieves 53.1 mIoU)
- DINO pre-trained driving encoders improve route completion by +9 percentage points on unseen environments vs. supervised ImageNet pre-training (Juneja et al., 2024)
- AD-PT cross-dataset pre-training improves downstream performance beyond single-dataset supervised pre-training

### 1.4 Domain Adaptation

Pre-training enables efficient domain adaptation through a staged curriculum:

```
Road driving SSL (unlabeled, abundant)
        |
        v
Road driving supervised (labeled, public datasets)
        |
        v
Airside SSL (unlabeled airside scans, easy to collect)
        |
        v
Airside supervised (small labeled set, expensive but minimal)
```

Each stage builds on the previous, with the bulk of representation learning happening on cheap unlabeled data. The final supervised stage only needs to calibrate the already-learned features for the target task and domain.

### 1.5 Taxonomy of SSL Methods for Driving

```
Self-Supervised Pre-training
├── Contrastive Learning
│   ├── Single-modal (PointContrast, DepthContrast)
│   ├── Cross-modal (SLidR, ScaLR, PPKT, GPC)
│   └── Language-aligned (CLIP, ULIP, OpenScene)
├── Masked Autoencoders
│   ├── Image MAE (MAE, BEiT, SimMIM)
│   ├── Point cloud MAE (Point-MAE, GD-MAE, Voxel-MAE)
│   ├── BEV MAE (BEV-MAE, Occupancy-MAE)
│   └── Multi-modal MAE (M3I, UniPAD)
├── JEPA / Embedding Prediction
│   ├── V-JEPA / V-JEPA 2 (video)
│   ├── AD-L-JEPA (LiDAR)
│   ├── MC-JEPA (motion-content)
│   └── LeJEPA (theoretical)
├── Self-Distillation
│   ├── DINO / DINOv2 (image)
│   ├── Sonata (point cloud)
│   └── Concerto (2D-3D joint)
└── Reconstruction
    ├── Surface reconstruction (ALSO)
    ├── Depth prediction
    └── Neural rendering (UniPAD, PonderV2)
```

---

## 2. Contrastive Learning Methods

### 2.1 Fundamentals of Contrastive Learning for 3D

Contrastive learning learns representations by pulling similar (positive) pairs together and pushing dissimilar (negative) pairs apart in an embedding space. For driving perception, the key question is: what constitutes a meaningful positive pair?

**Core loss function (InfoNCE):**

```python
import torch
import torch.nn.functional as F

def info_nce_loss(query, positive, negatives, temperature=0.07):
    """
    InfoNCE contrastive loss.
    
    Args:
        query: [B, D] query embeddings
        positive: [B, D] positive embeddings (matched pairs)
        negatives: [B, N, D] negative embeddings
        temperature: scalar temperature for sharpening
    
    Returns:
        loss: scalar contrastive loss
    """
    # Positive similarity: [B]
    pos_sim = torch.sum(query * positive, dim=-1) / temperature
    
    # Negative similarities: [B, N]
    neg_sim = torch.bmm(
        negatives, query.unsqueeze(-1)
    ).squeeze(-1) / temperature
    
    # Concatenate: [B, 1+N]
    logits = torch.cat([pos_sim.unsqueeze(-1), neg_sim], dim=-1)
    
    # Cross-entropy with positive as class 0
    labels = torch.zeros(query.shape[0], dtype=torch.long, device=query.device)
    loss = F.cross_entropy(logits, labels)
    
    return loss
```

### 2.2 PointContrast (ECCV 2020)

**Paper:** "PointContrast: Unsupervised Pre-Training for 3D Point Cloud Understanding"
**Authors:** Xie et al. (Facebook AI Research)

**Method:**
- Registers two partially overlapping 3D point cloud views of the same scene
- Corresponding points across views form positive pairs
- Non-corresponding points form hard negatives (same scene, different locations)
- Contrastive loss (PointInfoNCE) on point-level features

**Architecture:**
```
Point cloud view 1 ──> Sparse convolution backbone ──> Point features F1
Point cloud view 2 ──> Sparse convolution backbone ──> Point features F2
                                                          |
                                                     Correspondence
                                                     matching via
                                                     registration
                                                          |
                                                     PointInfoNCE loss
```

**Results:**
| Task | Dataset | Pre-trained | From Scratch | Delta |
|------|---------|-------------|-------------|-------|
| Detection | ScanNet | 58.5 AP50 | 54.2 AP50 | +4.3 |
| Detection | SUN RGB-D | 37.3 AP50 | 35.0 AP50 | +2.3 |
| Segmentation | ScanNet | 74.1 mIoU | 72.2 mIoU | +1.9 |

**Limitation for driving:** Designed for indoor scenes. Partial-overlap registration is harder for outdoor LiDAR where scenes change rapidly. However, the point-level contrastive formulation is foundational for all subsequent 3D contrastive methods.

### 2.3 DepthContrast (ICCV 2021)

**Paper:** "Self-Supervised Pretraining of 3D Features on any Point-Cloud"
**Authors:** Zhang et al. (Facebook AI Research)

**Method:**
- Applies two different 3D augmentations to the same point cloud
- Point-level and scene-level contrastive objectives simultaneously
- Uses both sparse 3D CNN (U-Net) and point-based (PointNet++) backbones
- Key innovation: **works on any 3D point cloud** (indoor, outdoor, objects)

**Architecture:**
```
Point cloud ──> Augmentation 1 ──> 3D backbone ──> Scene embedding s1 + Point embeddings p1
            └─> Augmentation 2 ──> 3D backbone ──> Scene embedding s2 + Point embeddings p2
                                                          |
                                              Scene-level MoCo loss (s1 vs s2)
                                            + Point-level contrastive loss (p1 vs p2)
```

**Results (outdoor driving):**
| Task | Dataset | Improvement over scratch |
|------|---------|------------------------|
| 3D Detection | KITTI | +1.2 AP (moderate) |
| Segmentation | SemanticKITTI | +1.5 mIoU |

**Airside relevance:** DepthContrast is the first method showing that contrastive pre-training on arbitrary 3D data improves outdoor driving perception. The "any point cloud" flexibility means airside LiDAR scans can be used directly for pre-training without any data format requirements.

### 2.4 SLidR: Image-to-LiDAR Self-Supervised Distillation (CVPR 2022)

**Paper:** "Image-to-Lidar Self-Supervised Distillation for Autonomous Driving Data"
**Authors:** Sautier et al. (Valeo AI, Ecole des Ponts)
**GitHub:** valeoai/slidr | 330+ stars

**Method:**
SLidR bridges 2D image features to 3D LiDAR points via superpixel correspondences:

1. **Superpixel generation**: Segment camera images into superpixels (SLIC algorithm)
2. **LiDAR projection**: Project LiDAR points onto camera images to find which superpixel each point falls in
3. **2D feature extraction**: Pass images through a pre-trained image encoder (MoCo v2, DINOv1)
4. **Average pooling**: Pool 2D features per superpixel to get one feature per superpixel region
5. **Contrastive learning**: LiDAR point features are pulled toward the pooled 2D feature of their corresponding superpixel, pushed away from features of other superpixels

**Key insight:** Superpixels provide natural groupings that are more stable than pixel-level correspondences, handling calibration noise and sensor misalignment gracefully.

**Results (nuScenes linear probing):**
| Backbone | Pre-training | mIoU (linear probe) |
|----------|-------------|---------------------|
| MinkUNet | From scratch | 30.1 |
| MinkUNet | PointContrast | 32.4 |
| MinkUNet | DepthContrast | 34.2 |
| MinkUNet | **SLidR** | **38.8** |

SLidR outperforms all prior 3D-only contrastive methods by a large margin, demonstrating that 2D image features provide richer supervisory signal than 3D self-augmentation alone.

**Airside relevance:** HIGH. If the Aurrigo stack adds cameras (even minimal -- 2-4 cameras), SLidR enables leveraging powerful 2D foundation models to improve LiDAR features without any labels. The superpixel approach is robust to imperfect camera-LiDAR calibration.

### 2.5 PPKT: Point-to-Pixel Knowledge Transfer (ICCV 2021)

**Paper:** "Image-to-Point Cloud Knowledge Transfer via Pixel-to-Point Knowledge Transfer"
**Authors:** Liu et al.

**Method:**
- Direct pixel-to-point correspondence via camera-LiDAR projection
- Contrastive loss between projected image features and LiDAR point features
- Simpler than SLidR (no superpixel step) but more sensitive to calibration noise

**Results:**
| Setting | mIoU Improvement |
|---------|-----------------|
| nuScenes seg (1% labels) | +5.2 over scratch |
| nuScenes seg (10% labels) | +3.1 over scratch |
| nuScenes seg (100% labels) | +1.4 over scratch |

**Key finding:** The benefit of cross-modal pre-training is largest in the low-label regime -- exactly the airside scenario.

### 2.6 ScaLR: Scaled Cross-Modal Distillation (CVPR 2024)

**Paper:** "Three Pillars Improving Vision Foundation Model Distillation for Lidar"
**Authors:** Sanchez et al. (Valeo AI)
**GitHub:** valeoai/ScaLR | 62 stars

ScaLR extends SLidR with three key improvements (the "three pillars"):

1. **Scaling the 2D teacher**: Uses DINOv2 instead of MoCo v2 / DINO v1. The jump from DINO v1 to DINOv2 alone provides +8.2 mIoU improvement on linear probing.

2. **Scaling the 3D student**: Replaces MinkUNet with WaffleIron (a more efficient 3D backbone), enabling larger model capacity without proportionally more compute.

3. **Scaling the training data**: Pre-trains on multiple driving datasets simultaneously (nuScenes + other) rather than single-dataset pre-training.

**Results (nuScenes linear probing -- frozen backbone evaluation):**
| Method | 2D Teacher | 3D Student | mIoU |
|--------|-----------|------------|------|
| SLidR | MoCo v2 | MinkUNet | 38.8 |
| SLidR | DINOv1 | MinkUNet | 44.2 |
| ScaLR | DINOv2 | MinkUNet | 52.4 |
| **ScaLR** | **DINOv2** | **WaffleIron** | **67.8** |

ScaLR achieves **67.8% mIoU with linear probing alone** -- meaning the frozen LiDAR backbone already produces features good enough for semantic segmentation without any task-specific fine-tuning. This is the best LiDAR-only self-supervised result published as of early 2026.

**Airside relevance:** VERY HIGH. ScaLR is directly applicable to the Aurrigo stack:
- Requires camera-LiDAR pairs (available if cameras are added)
- Pre-trains LiDAR backbone using only the camera teacher -- no 3D labels needed
- Frozen features already achieve strong segmentation -- fine-tuning on airside data should yield even better results
- See `lidar-foundation-models.md` for integration recommendations

### 2.7 ProposalContrast (CVPR 2023)

**Paper:** "ProposalContrast: Unsupervised Pre-training for LiDAR-Based 3D Object Detection"
**Authors:** Yin et al. (Huawei Noah's Ark Lab)

**Method:**
ProposalContrast addresses a limitation of point-level contrastive methods -- they learn features for individual points but not for object-level proposals needed by detection heads.

1. **Region proposal generation**: Use unsupervised clustering (DBSCAN) to generate 3D region proposals from raw LiDAR
2. **Proposal-level contrastive learning**: Augmented views of the same proposal form positive pairs
3. **Hard negative mining**: Nearby but distinct proposals form hard negatives
4. **Multi-scale features**: Proposals at different spatial scales capture both local detail and global context

**Results (Waymo 3D detection):**
| Backbone | Pre-training | Vehicle APH (L2) | Pedestrian APH (L2) |
|----------|-------------|-------------------|---------------------|
| CenterPoint | Scratch | 66.2 | 62.1 |
| CenterPoint | PointContrast | 67.1 | 63.0 |
| CenterPoint | **ProposalContrast** | **68.5** | **64.8** |

**Airside relevance:** ProposalContrast is particularly relevant because it directly optimizes for the detection task (proposal-level features) rather than per-point features. For airside, the DBSCAN clustering would naturally group GSE, aircraft parts, and personnel clusters, providing a strong unsupervised initialization for the detection pipeline.

### 2.8 Cross-Modal Contrastive: LiDAR-Camera, LiDAR-Radar

Beyond the image-to-LiDAR methods above, cross-modal contrastive learning extends to additional sensor pairs:

**LiDAR-Camera (general paradigm):**
```
Camera images ──> 2D encoder (frozen) ──> 2D features
                                              |
                                         Projection &
                                         Correspondence
                                              |
LiDAR points  ──> 3D encoder (trainable) ──> 3D features
                                              |
                                    Cross-modal contrastive loss
```

**LiDAR-Radar contrastive (2024-2025):**
- Radar provides velocity and reflectivity that LiDAR lacks
- LiDAR provides geometric precision that radar lacks
- Contrastive alignment of LiDAR-radar features at matched spatial locations
- Particularly relevant for airside where 4D radar is recommended for adverse weather robustness (see `20-av-platform/sensors/4d-radar.md`)

**Cross-modal self-supervised learning study (2024):**
A systematic study demonstrated that cross-modality contrastive learning outperforms single-modality alternatives for self-driving point clouds. The key insight: using a modality with richer semantics (images) to supervise a modality with better geometry (LiDAR) yields better features than either modality can learn alone.

### 2.9 CLIP and OpenCLIP for Driving Scene Understanding

**CLIP (Contrastive Language-Image Pre-training):**
CLIP learns a shared embedding space between images and natural language via contrastive learning on 400M image-text pairs. For driving, CLIP enables:

- **Open-vocabulary detection**: Detect objects described in natural language, including novel classes not in training data ("pushback tug," "baggage dolly chain," "marshaller with wands")
- **Scene classification**: "Is this a normal apron operation or an emergency scenario?"
- **Zero-shot transfer**: Apply to airside without any airside-specific training

**OpenCLIP** (open-source reproduction) extends CLIP with:
- Training on LAION-5B (5 billion image-text pairs)
- Larger model variants (ViT-G/14, ViT-bigG/14)
- Better performance on downstream driving tasks

**CLIP for 3D via lifting:**
| Method | Venue | Approach | Result |
|--------|-------|----------|--------|
| ULIP-2 | CVPR 2024 | Align 3D point embeddings to CLIP space | Open-vocabulary 3D recognition |
| OpenScene | CVPR 2023 | Dense CLIP features lifted to 3D via projection | Language-queried 3D segmentation |
| Concerto | NeurIPS 2025 | CLIP translator in PTv3 backbone | Open-world 3D perception |

**Airside application:** CLIP-aligned 3D features enable querying the LiDAR scene with natural language -- "show me all ground support equipment within 10m of aircraft Alpha" -- without needing explicit class definitions. This is valuable for the airside domain where the object taxonomy is complex and evolving.

---

## 3. Masked Autoencoder (MAE) Methods

### 3.1 MAE for Vision (MAE, BEiT, SimMIM)

Masked autoencoders learn by masking portions of the input and predicting the missing content. The approach was first proven for NLP (BERT) and adapted to vision:

**MAE (He et al., CVPR 2022):**
- Masks 75% of image patches randomly
- Asymmetric encoder-decoder: heavy ViT encoder processes only visible patches, lightweight decoder reconstructs masked patches
- Reconstruction target: normalized pixel values of masked patches
- Result: 87.8% ImageNet top-1 with ViT-H/14 (surpasses supervised pre-training)

**BEiT (Bao et al., ICLR 2022):**
- Uses a discrete visual tokenizer (dVAE from DALL-E) to convert patches to discrete tokens
- Predicts token IDs of masked patches rather than raw pixels
- This discrete target provides a more semantic reconstruction objective

**SimMIM (Xie et al., CVPR 2022):**
- Simplifies MAE: random masking, direct pixel regression, simple L1 loss
- Shows that the masking strategy matters more than the reconstruction target
- Works with both ViT and Swin Transformer architectures

### 3.2 MAE Training Loop (Reference Implementation)

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
from einops import rearrange

class MAEPretrainer(nn.Module):
    """
    Masked Autoencoder pre-trainer for ViT backbone.
    Reference implementation for driving perception pre-training.
    """
    def __init__(
        self,
        encoder,           # ViT encoder (to be pre-trained)
        decoder_dim=512,
        decoder_depth=4,
        decoder_heads=8,
        mask_ratio=0.75,
        patch_size=14,
    ):
        super().__init__()
        self.encoder = encoder
        self.mask_ratio = mask_ratio
        self.patch_size = patch_size
        
        encoder_dim = encoder.embed_dim  # e.g., 768 for ViT-B
        
        # Encoder-to-decoder projection
        self.enc_to_dec = nn.Linear(encoder_dim, decoder_dim)
        
        # Learnable mask token
        self.mask_token = nn.Parameter(torch.randn(1, 1, decoder_dim))
        
        # Decoder (lightweight)
        decoder_layer = nn.TransformerEncoderLayer(
            d_model=decoder_dim,
            nhead=decoder_heads,
            dim_feedforward=decoder_dim * 4,
            activation='gelu',
            batch_first=True,
        )
        self.decoder = nn.TransformerEncoder(
            decoder_layer, num_layers=decoder_depth
        )
        
        # Reconstruction head: predict normalized pixel values
        self.pred_head = nn.Linear(
            decoder_dim, patch_size * patch_size * 3
        )
    
    def random_masking(self, x, mask_ratio):
        """
        Random masking: keep (1-mask_ratio) of patches.
        
        Args:
            x: [B, N, D] patch embeddings
            mask_ratio: fraction of patches to mask
        Returns:
            x_visible: [B, N_vis, D] visible patch embeddings
            mask: [B, N] binary mask (1 = masked, 0 = visible)
            ids_restore: [B, N] indices for unshuffling
        """
        B, N, D = x.shape
        n_keep = int(N * (1 - mask_ratio))
        
        # Random permutation per sample
        noise = torch.rand(B, N, device=x.device)
        ids_shuffle = torch.argsort(noise, dim=1)
        ids_restore = torch.argsort(ids_shuffle, dim=1)
        
        # Keep first n_keep patches
        ids_keep = ids_shuffle[:, :n_keep]
        x_visible = torch.gather(
            x, dim=1, index=ids_keep.unsqueeze(-1).expand(-1, -1, D)
        )
        
        # Binary mask
        mask = torch.ones(B, N, device=x.device)
        mask[:, :n_keep] = 0
        mask = torch.gather(mask, dim=1, index=ids_restore)
        
        return x_visible, mask, ids_restore
    
    def forward(self, images):
        """
        Forward pass: mask, encode visible, decode all, compute loss.
        
        Args:
            images: [B, 3, H, W] input images
        Returns:
            loss: reconstruction loss on masked patches
        """
        # Patchify and embed
        patches = self.encoder.patch_embed(images)  # [B, N, D]
        B, N, D = patches.shape
        
        # Add positional embeddings before masking
        patches = patches + self.encoder.pos_embed[:, 1:N+1, :]
        
        # Random masking
        visible, mask, ids_restore = self.random_masking(
            patches, self.mask_ratio
        )
        
        # Encode visible patches only (efficiency gain)
        for block in self.encoder.blocks:
            visible = block(visible)
        visible = self.encoder.norm(visible)
        
        # Project to decoder dimension
        visible = self.enc_to_dec(visible)
        
        # Prepare full sequence with mask tokens
        mask_tokens = self.mask_token.expand(
            B, N - visible.shape[1], -1
        )
        full_seq = torch.cat([visible, mask_tokens], dim=1)
        
        # Unshuffle to original order
        full_seq = torch.gather(
            full_seq, dim=1,
            index=ids_restore.unsqueeze(-1).expand(-1, -1, full_seq.shape[-1])
        )
        
        # Decode
        decoded = self.decoder(full_seq)
        
        # Predict pixel values
        pred = self.pred_head(decoded)  # [B, N, patch_size^2 * 3]
        
        # Compute target: normalized pixel patches
        target = self._patchify(images)  # [B, N, patch_size^2 * 3]
        
        # Per-patch normalization (as in original MAE)
        mean = target.mean(dim=-1, keepdim=True)
        var = target.var(dim=-1, keepdim=True)
        target = (target - mean) / (var + 1e-6).sqrt()
        
        # Loss only on masked patches
        loss = (pred - target) ** 2
        loss = loss.mean(dim=-1)  # [B, N] per-patch loss
        loss = (loss * mask).sum() / mask.sum()  # avg over masked
        
        return loss
    
    def _patchify(self, images):
        """Convert images to patch sequences."""
        p = self.patch_size
        B, C, H, W = images.shape
        h, w = H // p, W // p
        patches = rearrange(
            images, 'b c (h p1) (w p2) -> b (h w) (p1 p2 c)',
            p1=p, p2=p
        )
        return patches


# Training loop example
def train_mae_epoch(model, dataloader, optimizer, device):
    """One epoch of MAE pre-training."""
    model.train()
    total_loss = 0
    
    for batch_idx, images in enumerate(dataloader):
        images = images.to(device)
        
        loss = model(images)
        
        optimizer.zero_grad()
        loss.backward()
        
        # Gradient clipping (important for stable MAE training)
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        
        optimizer.step()
        total_loss += loss.item()
    
    return total_loss / len(dataloader)
```

### 3.3 Voxel-MAE for LiDAR (2022)

**Paper:** "Voxel-MAE: Masked Autoencoders for Pre-Training Large-Scale Point Clouds"
**Authors:** Hess et al.

**Method:**
- Voxelizes LiDAR point cloud into regular 3D grid
- Randomly masks voxels at 60-80% ratio
- Encoder: 3D sparse convolution (only on visible voxels)
- Decoder: predicts occupancy and point positions of masked voxels
- Dual reconstruction target: (1) binary occupancy, (2) point coordinates within voxel

**Results (Waymo 3D detection):**
| Backbone | Pre-training | Vehicle APH (L1) |
|----------|-------------|-------------------|
| VoxelNet | Scratch | 71.8 |
| VoxelNet | Voxel-MAE | 73.2 (+1.4) |

**Airside relevance:** Works with voxel-based backbones compatible with the Aurrigo OpenPCDet stack. The dual reconstruction (occupancy + position) learns both coarse spatial structure and fine geometric detail.

### 3.4 Occupancy-MAE (IEEE TIV 2023)

**Paper:** "Self-supervised Pre-training Large-scale LiDAR Point Clouds with Masked Occupancy Autoencoders"
**Authors:** Min et al.
**GitHub:** 280 stars

**Architecture:**
- Designed specifically for voxel-based outdoor LiDAR point clouds
- **Range-aware random masking**: Accounts for LiDAR density variation with distance -- masks more densely sampled near-range voxels at higher rates to balance learning difficulty
- **Pretext task**: Binary occupancy prediction (does a masked voxel contain points?)
- Even with **90% masking ratio**, learns representative features
- Compatible with SECOND, CenterPoint, PV-RCNN detectors

**Key results:**
| Task | Dataset | Improvement |
|------|---------|------------|
| 3D Detection (Car) | KITTI | Reduces labeled data by 50% for car detection |
| 3D Detection (Small objects) | Waymo | ~2% AP improvement |
| 3D Segmentation | Multiple | ~2% mIoU improvement |

**Airside relevance:** HIGH. The range-aware masking is particularly important for airside because LiDAR density patterns on aprons differ from roads (large open areas with sparse structure punctuated by dense aircraft returns). Works with existing OpenPCDet backbones.

### 3.5 GD-MAE: Geometry-Enhanced MAE (CVPR 2023)

**Paper:** "Generative Decoder for MAE Pre-training on LiDAR Point Clouds"
**Authors:** Yang et al.
**GitHub:** 124 stars

**Architecture:**
- **First MAE method designed specifically for outdoor LiDAR point clouds**
- Generative decoder that hierarchically merges surrounding context to restore masked geometric knowledge
- Works with voxel-based 3D backbones (VoxelBackBone, SECOND)
- Compatible with CenterPoint and PV-RCNN detection heads

**Critical data efficiency result:**
- **Achieves comparable accuracy with only 20% of labeled Waymo data** -- GD-MAE_0.2 demonstrates that pre-training on unlabeled data followed by fine-tuning on 20% of labels matches full-label performance

**Results:**
| Dataset | Backbone | Metric | Score |
|---------|----------|--------|-------|
| Waymo (Vehicle L1) | Two-stage | mAPH | 80.2/79.8 |
| KITTI (Car) | SECOND | AP | 82.01 (moderate) |
| ONCE (Vehicle) | CenterPoint | AP | 76.79 (vs 74.10 scratch) |

**Airside relevance:** VERY HIGH. GD-MAE works with the exact voxel-based backbones used in the Aurrigo CenterPoint pipeline. The 80% label reduction directly addresses the zero-airside-dataset problem. See `lidar-foundation-models.md` Section 2.4 for full details.

### 3.6 BEV-MAE (AAAI 2024)

**Paper:** "Bird's Eye View Masked Autoencoders for Point Cloud Pre-training in Autonomous Driving"
**Authors:** Ren et al. (Peking University)

**Architecture:**
- Projects LiDAR point cloud onto 2D BEV grid
- BEV-guided masking: randomly masks non-empty BEV grid cells
- **Pretext task**: Predicts point density per masked BEV cell (not just occupancy) -- a harder objective that learns richer features
- Leverages LiDAR density-distance correlation
- Avoids complex 3D decoder design by operating in BEV space

**Results:**
| Setting | Metric | Improvement |
|---------|--------|-------------|
| 100% pretrain, 20% finetune (Waymo) | mAP | +1.42 over baseline |
| 100% pretrain, 20% finetune (Waymo) | APH | +1.34 over baseline |

**Airside relevance:** The BEV formulation aligns with the Aurrigo stack's BEV-based planning representation. Pre-training in BEV space means learned features are directly compatible with downstream planning.

### 3.7 NOMAE: Multi-Scale Occupancy MAE (CVPR 2025)

**Paper:** "Non-Overlapping Masked Autoencoders for 3D Point Cloud Pre-training"
**Authors:** 2025

**Key innovation:** Multi-scale occupancy prediction with non-overlapping mask strategy that prevents information leakage between encoder and decoder. NOMAE achieves the remarkable result of **beating fully supervised baselines** with self-supervised pre-training alone, demonstrating that SSL representations can surpass task-specific supervision.

**Airside relevance:** VERY HIGH. If NOMAE's SSL pre-training beats supervised baselines on road driving data, the gap should be even larger for airside where labeled data is scarce and expensive.

### 3.8 MAE vs. JEPA: Efficiency Comparison

AD-L-JEPA (AAAI 2026) provides a direct comparison between MAE-style and JEPA-style pre-training for LiDAR:

| Metric | Occupancy-MAE | AD-L-JEPA | Advantage |
|--------|--------------|-----------|-----------|
| GPU hours (pre-training) | 1x | 0.37-0.53x | **1.9-2.7x faster** |
| GPU memory | 1x | 0.25-0.36x | **2.8-4x less memory** |
| 3D detection (KITTI) | Baseline | Comparable/better | Equivalent quality |
| 3D detection (Waymo) | Baseline | Comparable/better | Equivalent quality |
| 3D detection (ONCE) | Baseline | Comparable/better | Equivalent quality |

The efficiency gap arises because MAE methods must reconstruct raw voxel/point content (pixel-space prediction), while JEPA predicts in a learned embedding space that discards irrelevant detail. See Section 4 for full JEPA analysis.

---

## 4. JEPA and Embedding-Space Prediction

### 4.1 Core Principle: Predict Embeddings, Not Pixels

The Joint Embedding Predictive Architecture (JEPA), proposed by Yann LeCun (2022), represents a fundamentally different approach to self-supervised learning:

- **MAE/Generative**: Mask input, predict raw pixels/voxels of masked regions
- **Contrastive**: Pull positive pairs together, push negatives apart in embedding space
- **JEPA**: Mask input, predict the **learned embeddings** of masked regions (not raw content)

**Why this matters for driving:**
Driving scenes contain enormous amounts of irrelevant detail -- exact cloud patterns, precise shadow shapes, specific reflectance values. MAE methods waste capacity modeling this noise. JEPA learns to predict only the semantically meaningful aspects by operating in a learned embedding space that naturally filters out low-level variation.

```
            MAE approach:
            Input ──> Encoder ──> [mask] ──> Decoder ──> Reconstruct raw input
                                                          (pixel-level detail)

            JEPA approach:
            Input x ──> Encoder ──> Features f(x)
            Input y ──> Encoder ──> Features f(y)  [target, stop-gradient]
                                        |
            Predictor: f(x) ──> predicted f(y)
                                        |
                              L1 loss in embedding space
                              (semantic-level prediction)
```

### 4.2 V-JEPA: Video JEPA (Meta, 2024)

**Paper:** "V-JEPA: Latent Video Prediction for Visual Representation Learning"
**Authors:** Bardes, Garrido, et al. (Meta FAIR, Yann LeCun)
**GitHub:** facebookresearch/jepa

**Architecture:**
- ViT encoder processes video frames as spatiotemporal patches
- **Context encoder** sees visible (unmasked) patches
- **Target encoder** (EMA of context encoder) produces target embeddings for masked patches
- **Predictor** maps context encoder outputs to target encoder space
- Trained on 2 million video clips from various sources

**Masking strategy:**
- Multi-block masking: masks 8-10 large spatiotemporal blocks per video
- Each block spans multiple frames, forcing temporal prediction
- ~90% of spatiotemporal tokens are masked (high masking ratio)

**Results:**
| Benchmark | V-JEPA | VideoMAE v2 | OmniMAE |
|-----------|--------|-------------|---------|
| Kinetics-400 (frozen) | 81.9 | 77.0 | 74.2 |
| Something-Somethingv2 | 71.4 | 69.6 | 65.1 |
| ImageNet-1k (frozen) | 82.0 | 76.8 | 74.9 |

V-JEPA outperforms all video MAE methods while being more sample-efficient, validating the embedding-space prediction hypothesis.

### 4.3 V-JEPA 2 and V-JEPA 2-AC (Meta, 2025)

**Paper:** "V-JEPA 2: Self-Supervised Video Models Enable Understanding, Prediction, and Planning"
**Authors:** Assran, Bardes, et al. (Meta FAIR)
**GitHub:** facebookresearch/vjepa2

V-JEPA 2 scales the approach with:
- **Larger models**: Up to ViT-H and beyond
- **More data**: Trained on diverse video datasets
- **Multi-task transfer**: Single frozen backbone supports classification, action recognition, and depth estimation simultaneously

**V-JEPA 2-AC (Action-Conditioned):**
The action-conditioned variant enables model-predictive control:
- Predicts future state embeddings conditioned on candidate actions
- Uses Cross-Entropy Method (CEM) to optimize action sequences in embedding space
- Planning in embedding space is ~15x faster than pixel-space prediction (no need for expensive pixel generation)

**Relevance to driving:** V-JEPA 2-AC demonstrates that JEPA embeddings are sufficient for planning and control -- the predicted future state embeddings carry enough information to evaluate action quality without ever generating pixels.

### 4.4 AD-L-JEPA: JEPA for LiDAR Driving (AAAI 2026)

**Paper:** "AD-L-JEPA: Self-Supervised Spatial World Model for Autonomous Driving with Joint-Embedding Predictive Architecture"
**Authors:** Zhu et al.
**GitHub:** haoranzhuexplorer/ad-l-jepa-release

AD-L-JEPA is the **first JEPA-based pre-training method for autonomous driving LiDAR**. It adapts the JEPA framework to Bird's-Eye-View representations of driving scenes:

**Architecture:**
1. Voxelize LiDAR point cloud and project to BEV features
2. Context encoder processes visible BEV regions
3. Target encoder (EMA) produces target embeddings for masked regions
4. Predictor maps context embeddings to target embedding space
5. **Variance regularization** prevents representation collapse (replacing the contrastive-based collapse prevention used in image JEPA)

**Key properties:**
- **Neither generative nor contrastive** -- uses explicit variance regularization
- Predicts BEV embeddings, not raw occupancy/points
- Compatible with standard voxel-based detection heads (CenterPoint, SECOND)

**Results:**
| Dataset | Metric | AD-L-JEPA | Occupancy-MAE | Improvement |
|---------|--------|-----------|---------------|-------------|
| KITTI3D (Car) | AP (mod) | Improved | Baseline | Comparable/better |
| Waymo (Vehicle) | APH (L2) | Improved | Baseline | Comparable/better |
| ONCE (Vehicle) | AP | Improved | Baseline | Comparable/better |

**Efficiency:**
| Resource | AD-L-JEPA vs Occupancy-MAE |
|----------|---------------------------|
| GPU hours | 1.9-2.7x fewer |
| GPU memory | 2.8-4x less |
| Downstream quality | Comparable or better |

**Airside relevance:** VERY HIGH. AD-L-JEPA provides the most efficient pre-training for the LiDAR-primary Aurrigo stack:
- Works with existing BEV-based pipeline
- Dramatically reduces pre-training compute costs
- Compatible with CenterPoint detection heads
- The BEV embedding prediction is well-suited for the flat, open apron environment
- See `tokenized-and-jepa.md` Section 2.4 for context on JEPA paradigm

### 4.5 MC-JEPA: Motion-Content Separation (2023)

**Paper:** "MC-JEPA: A Joint-Embedding Predictive Architecture for Self-Supervised Learning of Motion and Content Features"
**Authors:** Bardes et al.

MC-JEPA jointly learns optical flow (motion) and content features within a shared encoder using a JEPA objective. The key innovation is simultaneously interpreting dynamic and static elements of video.

**Relevance to airside:** Airport aprons have a mix of static structure (terminal, jet bridges) and dynamic objects (GSE, personnel, taxiing aircraft) with very different motion patterns. MC-JEPA's explicit motion-content separation could yield better features for tracking moving GSE while maintaining robust understanding of static infrastructure.

### 4.6 LeJEPA: Theoretical Foundation

**Paper:** "Provable JEPA Objective"
**Authors:** Balestriero et al. (Meta FAIR)
**GitHub:** rbalestr-lab/lejepa

LeJEPA provides theoretical grounding for why JEPA works:
- Proves that the JEPA objective is equivalent to learning a conditional expectation in feature space
- Shows that the target encoder converges to capture the mutual information between context and target
- Provides guarantees on representation quality under specific assumptions about data distribution

**Practical implication:** LeJEPA validates that JEPA is not just an empirical trick but has principled statistical foundations. The theoretical guarantees suggest JEPA representations should transfer well to new domains (like airside) because they capture the underlying data structure rather than surface statistics.

### 4.7 Embedding-Space vs. Pixel-Space Prediction: Tradeoffs

| Dimension | Pixel-Space (MAE) | Embedding-Space (JEPA) |
|-----------|-------------------|----------------------|
| **Reconstruction** | Can visualize what the model learned | Latent -- harder to interpret |
| **Compute** | Heavier decoder needed for pixel reconstruction | Lightweight predictor sufficient |
| **Memory** | Must store full pixel targets | Only store compressed embeddings |
| **Noise modeling** | Models all pixel variation (including irrelevant) | Filters out unpredictable detail |
| **Feature quality** | Good spatial features, may overfit to texture | Better semantic features, more robust |
| **Collapse risk** | None (reconstruction provides natural gradient signal) | Requires regularization (EMA, variance) |
| **Data efficiency** | Moderate | Higher (focuses on structure not detail) |
| **Driving suitability** | Good for reconstruction tasks (depth, flow) | Better for semantic tasks (detection, segmentation) |

**Recommendation for airside:** Use JEPA (AD-L-JEPA) for LiDAR pre-training when the goal is detection/segmentation. Use MAE (GD-MAE, Occupancy-MAE) when you need to learn fine geometric detail or when using the pre-trained decoder for auxiliary tasks like occupancy prediction.

---

## 5. DINO/DINOv2 for Driving

### 5.1 DINOv2 Feature Quality for Driving

DINOv2 (Meta, 2023) is a family of self-supervised Vision Transformers trained on LVD-142M (142M curated images, no labels). It produces universal visual features via a combination of:
- DINO self-distillation loss (image-level, multi-crop)
- iBOT masked image modeling loss (patch-level)
- KoLeo regularizer (uniform feature distribution)

**Why DINOv2 features are valuable for driving:**

1. **Domain-agnostic**: Features learned from 142M diverse images transfer to driving without driving-specific training
2. **Dense spatial quality**: Patch-level features capture object boundaries and parts without segmentation supervision
3. **Robustness**: DINOv2+LoRA-adapted BEV achieves 2.5x better performance under motion blur and maintains >60% under darkness vs. SimpleBEV dropping below 30% (nuScenes-C benchmark)
4. **Multi-task**: Same frozen features work for detection, segmentation, depth estimation simultaneously

**Frozen feature benchmarks:**
| Task | ViT-S | ViT-B | ViT-L | ViT-g |
|------|-------|-------|-------|-------|
| ImageNet k-NN (%) | 79.0 | 82.1 | 83.5 | 83.5 |
| ADE20k Seg (mIoU) | 47.2 | 51.3 | 53.1 | 53.0 |
| NYU Depth (RMSE) | 0.417 | 0.362 | 0.333 | 0.298 |

See `dinov2-foundation-models-driving.md` for complete architecture details.

### 5.2 Direct Backbone Replacement Fails

**Critical finding**: When DINOv2-Small was used as a drop-in replacement for ResNet-18 in a 3D detection pipeline (without adapter modules), the model achieved **0.0% mAP and only 6% NDS** -- effectively complete failure.

**Why this happens:**
- DINOv2 outputs patch tokens at 14x14 resolution -- different spatial structure than CNN feature pyramids
- ViT patch tokens are 1D sequences that need architectural adaptation for 2D spatial tasks
- Detection heads expect multi-scale feature pyramids (FPN), not flat patch sequences
- The embedding dimension (384-1536) doesn't match what downstream heads expect

**Solution: Adapter-mediated integration:**
```
DINOv2 ViT backbone (frozen or LoRA-adapted)
       |
Feature adapter (conv layers for resolution/dimension matching)
       |
Feature Pyramid Network (multi-scale features)
       |
View transform (LSS / BEVFormer / SimpleBEV)
       |
BEV feature grid → Detection / segmentation heads
```

### 5.3 LoRA Rank 32 Optimal for Fine-tuning

**Paper:** "Robust Bird's Eye View Segmentation by Adapting DINOv2" (arXiv:2409.10228)

LoRA (Low-Rank Adaptation) updates only query and value projections in ViT attention layers. For DINOv2 applied to BEV segmentation:

| Configuration | Learnable Params | mIoU |
|---------------|-------------------|------|
| SimpleBEV (ResNet-101, full) | 37M | 42.3 |
| DINOv2 ViT-B + LoRA (r=32) | 1M | 42.3 |
| DINOv2 ViT-L + LoRA (r=32) | 3M | 43.4 |
| DINOv2 ViT-L + LoRA (r=32, hi-res) | 3M | 47.6 |

DINOv2 ViT-B + LoRA matches ResNet-101 with **37x fewer learnable parameters**.

**LoRA adapter setup code:**

```python
import torch
import torch.nn as nn
import math

class LoRALinear(nn.Module):
    """
    LoRA adapter for DINOv2 / ViT attention layers.
    Wraps an existing nn.Linear with low-rank update.
    """
    def __init__(
        self,
        original_linear: nn.Linear,
        rank: int = 32,
        alpha: float = 32.0,
        dropout: float = 0.0,
    ):
        super().__init__()
        self.original_linear = original_linear
        self.rank = rank
        self.alpha = alpha
        self.scaling = alpha / rank
        
        in_features = original_linear.in_features
        out_features = original_linear.out_features
        
        # Low-rank decomposition: delta_W = B @ A
        self.lora_A = nn.Linear(in_features, rank, bias=False)
        self.lora_B = nn.Linear(rank, out_features, bias=False)
        self.lora_dropout = nn.Dropout(dropout) if dropout > 0 else nn.Identity()
        
        # Initialize A with Kaiming, B with zeros (start as identity)
        nn.init.kaiming_uniform_(self.lora_A.weight, a=math.sqrt(5))
        nn.init.zeros_(self.lora_B.weight)
        
        # Freeze original weights
        self.original_linear.weight.requires_grad = False
        if self.original_linear.bias is not None:
            self.original_linear.bias.requires_grad = False
    
    def forward(self, x):
        # Original output + low-rank update
        original_output = self.original_linear(x)
        lora_output = self.lora_B(self.lora_A(self.lora_dropout(x)))
        return original_output + lora_output * self.scaling


def add_lora_to_dinov2(model, rank=32, alpha=32.0, target_modules=('qkv',)):
    """
    Add LoRA adapters to DINOv2 ViT model.
    
    Args:
        model: DINOv2 ViT model (e.g., from torch.hub)
        rank: LoRA rank (32 is optimal per published results)
        alpha: LoRA scaling factor
        target_modules: which linear layers to adapt
            'qkv' -- query/key/value projection (standard)
            'proj' -- output projection
            'mlp' -- MLP layers in transformer blocks
    
    Returns:
        model with LoRA adapters added
    """
    # Freeze all parameters first
    for param in model.parameters():
        param.requires_grad = False
    
    lora_params = 0
    total_params = sum(p.numel() for p in model.parameters())
    
    for name, module in model.named_modules():
        # Target attention QKV projections
        if 'qkv' in target_modules and name.endswith('.attn.qkv'):
            if isinstance(module, nn.Linear):
                lora_layer = LoRALinear(module, rank=rank, alpha=alpha)
                # Replace in parent module
                parent_name = name.rsplit('.', 1)[0]
                attr_name = name.rsplit('.', 1)[1]
                parent = dict(model.named_modules())[parent_name]
                setattr(parent, attr_name, lora_layer)
                lora_params += rank * (module.in_features + module.out_features)
        
        # Target output projection
        if 'proj' in target_modules and name.endswith('.attn.proj'):
            if isinstance(module, nn.Linear):
                lora_layer = LoRALinear(module, rank=rank, alpha=alpha)
                parent_name = name.rsplit('.', 1)[0]
                attr_name = name.rsplit('.', 1)[1]
                parent = dict(model.named_modules())[parent_name]
                setattr(parent, attr_name, lora_layer)
                lora_params += rank * (module.in_features + module.out_features)
    
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"LoRA params: {lora_params:,}")
    print(f"Total trainable: {trainable:,} / {total_params:,} "
          f"({100*trainable/total_params:.2f}%)")
    
    return model


# Usage example:
# dinov2 = torch.hub.load('facebookresearch/dinov2', 'dinov2_vitl14')
# dinov2 = add_lora_to_dinov2(dinov2, rank=32, target_modules=('qkv', 'proj'))
# Only ~3M trainable params out of 304M total (< 1%)
```

### 5.4 Feature Lifting from 2D to 3D

**OccFeat approach:** Lift DINOv2 2D features to 3D space for volumetric perception:

1. Extract multi-scale DINOv2 features from each camera view
2. Project features onto LiDAR point clouds using camera-LiDAR calibration
3. Accumulate across multiple frames for temporal density
4. Voxelize projected features to produce 3D feature volumes

**DualViewDistill (2025)** implements this pipeline:
- Creates BEV pseudo-labels from DINOv2 features projected onto LiDAR
- Achieves 0.669 AMOTA on nuScenes test (SOTA tracking), 0.621 mAP detection
- ID switches reduced from 699 to 407 vs. previous SOTA

### 5.5 DINOv2 + BEVFormer for Camera-Based Perception

The combination of DINOv2 as the image backbone with BEVFormer as the view transform provides a strong camera-based perception pipeline:

```
Multi-camera images (6 views)
       |
DINOv2 ViT-L (frozen + LoRA r=32)  →  ~3M trainable params
       |
Feature adapter (conv 1x1, 1024 → 256)
       |
BEVFormer (spatial cross-attention + temporal self-attention)
       |
BEV features (200x200 grid, 0.5m resolution)
       |
├── CenterPoint head (3D detection)
├── Segmentation head (BEV semantic map)
└── Occupancy head (3D occupancy prediction)
```

**Performance with DINOv2 + LSS:**
| Configuration | Vehicle Seg IoU |
|---------------|-----------------|
| LSS (EfficientNet) | 33.0 |
| EfficientNet + Metric3Dv2 | 40.5 |
| **DINOv2 + Metric3Dv2** | **41.9 (+8.9)** |
| DINOv2 + Metric3Dv2 (half data) | 40.4 (+7.4) |

DINOv2-based pipeline converges in <150K iterations vs. 300K+ for baseline, while achieving 22.4% relative improvement.

---

## 6. Multi-Modal Pre-training

### 6.1 UniPAD: Universal Pre-training for Accelerated Deployment (CVPR 2024)

**Paper:** "UniPAD: A Universal Pre-training Paradigm for Autonomous Driving"
**Authors:** Yang et al.
**GitHub:** 204 stars

UniPAD introduces a unified encoder that pre-trains on both 2D images and 3D point clouds simultaneously via differentiable neural rendering:

**Architecture:**
1. **Unified 3D encoder**: Encodes both camera features (lifted to 3D via LSS) and LiDAR features into a shared 3D volume
2. **Pre-training objective**: Differentiable volume rendering -- predicts depth maps, RGB images, and 3D occupancy from the 3D volume
3. **Neural rendering as supervision**: The rendering objective forces the encoder to learn accurate 3D geometry without explicit 3D annotations

**Results (nuScenes):**
| Metric | UniPAD | Previous Best |
|--------|--------|---------------|
| NDS | 73.2 | ~72 |
| mAP | ~68 | ~66 |
| 3D Segmentation (mIoU) | 79.4 | ~77 |

**Airside relevance:** UniPAD's unified pre-training means a single pre-training run benefits both LiDAR and camera perception pathways. This is particularly valuable for the Phase 2 transition from LiDAR-only to LiDAR+camera fusion in the Aurrigo stack.

### 6.2 BEVDistill: Cross-Modal BEV Distillation (NeurIPS 2023)

**Paper:** "BEVDistill: Cross-Modal BEV Knowledge Distillation for Multi-View 3D Object Detection"

BEVDistill transfers knowledge from a LiDAR-based BEV teacher to a camera-only BEV student:

**Pipeline:**
```
LiDAR point cloud ──> LiDAR BEV encoder (teacher, frozen) ──> BEV features (target)
                                                                    |
Camera images ──> Camera BEV encoder (student, trainable) ──> BEV features (predicted)
                                                                    |
                                                     BEV-level distillation loss
                                                   + Instance-level distillation
                                                   + Response-level distillation
```

**Three distillation objectives:**
1. **BEV feature distillation**: L2 loss between teacher and student BEV feature maps
2. **Instance-level distillation**: Align features within object bounding boxes (foreground-weighted)
3. **Response-level distillation**: Match detection head logits (soft labels)

**Results:** Camera-only student achieves ~80% of LiDAR teacher performance, enabling graceful degradation when LiDAR fails.

**Airside relevance:** Directly applicable to the camera fallback pipeline (see `30-autonomy-stack/perception/overview/camera-fallback-perception.md`). A LiDAR teacher trained on airside data can distill to a camera student for degraded-mode operation.

### 6.3 Image-to-LiDAR and LiDAR-to-Image Transfer

**Image-to-LiDAR transfer** (leveraging rich 2D representations for 3D):
| Method | Mechanism | Best for |
|--------|-----------|----------|
| SLidR | Superpixel contrastive | LiDAR segmentation |
| PPKT | Pixel-point contrastive | LiDAR segmentation |
| ScaLR | DINOv2 distillation | LiDAR seg + detection |
| GPC | Color prediction | LiDAR detection |
| Concerto | Joint 2D-3D SSL | All 3D tasks |

**LiDAR-to-Image transfer** (leveraging 3D geometry for 2D):
| Method | Mechanism | Best for |
|--------|-----------|----------|
| BEVDistill | BEV feature distillation | Camera-only detection |
| TinyBEV | Multi-modal to camera distillation | Edge camera deployment |
| Depth Anything | Metric depth for monocular 3D | Depth estimation |

### 6.4 Temporal Pre-training

Several methods leverage temporal consistency in driving video + LiDAR sequences:

**TREND (NeurIPS 2025):**
- Pre-trains by predicting future LiDAR frames from current observations
- Temporal forecasting forces the model to understand dynamics and motion
- +1.77% mAP on ONCE, +2.11% on nuScenes over non-temporal pre-training

**Temporal contrastive:**
- Corresponding points across sequential LiDAR frames form positive pairs
- Forces the backbone to learn consistent representations across time
- Naturally handles ego-motion compensation

**Airside relevance:** Temporal pre-training is especially valuable for airside because:
- Slow speeds mean temporal context is rich (more overlap between frames)
- Understanding motion patterns of GSE, aircraft pushback, and personnel is critical
- TREND-style forecasting learns the dynamics of the apron environment from unlabeled sequences

### 6.5 Language-Guided Pre-training

Language-guided pre-training aligns visual/3D features with natural language descriptions:

**Drive-CLIP (2024):**
- Adapts CLIP for driving-specific text-image alignment
- Training data: driving images paired with natural language scene descriptions
- Enables zero-shot scene classification and anomaly detection

**LiDAR-LLM (2024):**
- Aligns LiDAR features directly with language models
- Enables natural language queries over 3D scenes
- "Find the pushback tug near gate B12" -- requires no class-specific training

**Airside application:** Language-guided features enable:
- NOTAM interpretation → perception mode adjustment ("reduced visibility at gate A5" → increase sensitivity)
- ATC instruction understanding → scene verification ("confirm baggage cart clear of aircraft")
- Anomaly description → safety logging ("detected unknown object near fuel truck")

---

## 7. Pre-training to Fine-tuning Pipeline

### 7.1 Full Fine-tuning vs. Linear Probing vs. LoRA/Adapters

| Strategy | Trainable Params | Data Needed | Best For |
|----------|-----------------|-------------|----------|
| **Linear probing** | <1% (head only) | 50-200 frames | Quick evaluation, feature quality assessment |
| **LoRA** (r=16-32) | 1-5% | 500-2,000 frames | Resource-efficient domain adaptation |
| **Adapter modules** | 5-10% | 500-2,000 frames | More capacity than LoRA, less than full |
| **Progressive unfreeze** | 10-100% staged | 1,000-5,000 frames | Controlled adaptation with monitoring |
| **Full fine-tuning** | 100% | 2,000-10,000 frames | Sufficient data, large domain gap |

**Decision guide for airside:**
```
Available labeled airside frames?
├── <200 → Linear probing (feature extraction only)
├── 200-500 → LoRA (r=16, query+value only)
├── 500-2,000 → LoRA (r=32, query+value+output projection)
├── 2,000-5,000 → Progressive unfreezing
└── >5,000 → Full fine-tuning with discriminative learning rates
```

### 7.2 Data Efficiency Curves

Based on published results across methods, the relationship between labeled data and performance follows a characteristic curve:

```
Performance (mAP)
    |
90% |                                    ......................
    |                              ......
85% |                        ......
    |                  ......
80% |            ......
    |      ......        ← Pre-trained backbone
75% | .....
    |.                   ← With SSL pre-training, 500 frames ≈ 5,000 from scratch
70% |
    |  ...
65% |..                  ← Without pre-training (from scratch)
    |
60% |.
    +--------+--------+--------+--------+--------+
    0       500     1,000    2,000    5,000   10,000
                 Labeled Training Frames
```

**Concrete estimates for airside (pre-trained on road driving data):**

| Labeled Airside Frames | Expected mAP (common objects) | Without Pre-training |
|------------------------|-------------------------------|---------------------|
| 0 (zero-shot) | ~5-15% (CLIP-based only) | 0% |
| 100 | ~40-55% | ~15-25% |
| 500 | ~65-75% | ~40-50% |
| 1,000 | ~75-85% | ~55-65% |
| 2,000 | ~80-88% | ~65-75% |
| 5,000 | ~85-92% | ~75-85% |
| 10,000 | ~88-94% | ~82-90% |

These estimates assume:
- Pre-training on diverse road LiDAR data (nuScenes + Waymo + KITTI)
- Continued SSL pre-training on unlabeled airside scans
- LoRA or progressive unfreezing for fine-tuning
- Common objects = baggage tractors, aircraft, belt loaders, ramp personnel

Rare objects (de-icing trucks, emergency vehicles, FOD) require targeted data collection regardless of pre-training strategy.

### 7.3 Transfer Across Domains: Road to Airside

The road-to-airside transfer pipeline involves four stages:

**Stage 1: Road SSL pre-training (no labels)**
- Pre-train on combined unlabeled road driving data
- Methods: GD-MAE, AD-L-JEPA, or ScaLR (if cameras available)
- Data: ~100K-500K unlabeled LiDAR frames (publicly available)
- Compute: ~24-96 GPU-hours (A100)

**Stage 2: Road supervised pre-training (public labels)**
- Fine-tune on labeled nuScenes + Waymo
- Learn general 3D detection/segmentation capabilities
- Data: ~40K labeled frames (nuScenes trainval)
- Compute: ~12-48 GPU-hours (A100)

**Stage 3: Airside SSL continuation (no labels)**
- Continue SSL pre-training on unlabeled airside LiDAR scans
- Reduces domain gap before expensive labeled fine-tuning
- Data: ~10K-50K unlabeled airside frames (just drive the vehicle)
- Compute: ~4-16 GPU-hours (A100)

**Stage 4: Airside supervised fine-tuning (minimal labels)**
- Fine-tune on small labeled airside dataset
- Use LoRA or progressive unfreezing
- Data: ~500-1,000 labeled airside frames
- Compute: ~2-8 GPU-hours (A100)

**Total compute: ~42-168 GPU-hours (~$85-340 at cloud rates)**

See `50-cloud-fleet/mlops/transfer-learning.md` for detailed domain gap analysis and `70-operations-domains/deployment-playbooks/multi-airport-adaptation.md` for the 8-week onboarding pipeline.

### 7.4 PointLoRA: Parameter-Efficient LiDAR Adaptation (CVPR 2025)

PointLoRA is the first LoRA method specifically designed for point cloud learning:

**Key innovation: Multi-Scale Token Selection**
- Standard LoRA captures global features via low-rank updates to attention
- Point clouds need local geometric understanding (surface normals, curvature)
- Multi-Scale Token Selection module captures local point cloud priors
- Selected tokens at various scales integrate via shared Prompt MLP

**Results:**
- 73.4% parameter reduction vs. full fine-tuning
- Greater resistance to catastrophic forgetting
- Achieves baseline accuracy with substantially fewer trainable parameters
- Suitable for resource-constrained deployment (Orin)

**Airside application:**
- Freeze pre-trained LiDAR backbone, add PointLoRA adapters (rank 16-32)
- Fine-tune on labeled airside data (target: 1,000 annotated frames)
- Maintain separate PointLoRA adapters per airport if needed
- Swap adapters at deployment time based on airport configuration

### 7.5 Progressive Unfreezing Strategies

Progressive unfreezing adapts the backbone gradually, reducing the risk of catastrophic forgetting:

```
Stage 1 (epochs 1-5):     Unfreeze detection head only → train with LR=1e-3
Stage 2 (epochs 6-10):    Unfreeze last backbone block → train with LR=1e-4
Stage 3 (epochs 11-15):   Unfreeze second-to-last block → train with LR=1e-5
Stage 4 (epochs 16-20):   Unfreeze all (optional) → train with LR=1e-6
```

**Discriminative learning rates:** Each layer group gets a different learning rate:
- Detection head: 1e-3 (learns new task quickly)
- Last backbone block: 1e-4 (adapts high-level features)
- Middle blocks: 1e-5 (adjusts intermediate representations)
- Early blocks: 1e-6 (preserves general low-level features)

**Monitoring criteria:**
- If validation mAP stalls at current stage → unfreeze next layer group
- If validation mAP **degrades** after unfreezing → dataset too small for this depth of adaptation → revert to LoRA
- If forgetting detected (road evaluation drops) → reduce LR or use EWC regularization

---

## 8. Pre-training for Specific Tasks

### 8.1 3D Object Detection Pre-training

Detection benefits most from pre-training methods that learn object-level representations:

| Method | Pre-training Type | Detection Gain | Best Backbone |
|--------|------------------|---------------|---------------|
| GD-MAE | Geometric MAE | +2.7 mAPH (Waymo) | VoxelNet, SECOND |
| ProposalContrast | Proposal-level contrastive | +2.3 APH (Waymo) | CenterPoint |
| GPC | Colorization | +7.5 AP (5% KITTI) | PV-RCNN, SECOND |
| AD-PT | Semi-supervised | Significant | Multiple |
| PSA-SSL | Pose/size-aware | +90% label savings | Multiple |
| AD-L-JEPA | JEPA BEV | Comparable to MAE | CenterPoint |

**Recommendation for airside:** GD-MAE for initial pre-training (proven with CenterPoint), supplemented by GPC if camera-LiDAR pairs are available (95% label savings).

### 8.2 Semantic Segmentation Pre-training

Segmentation benefits most from dense, per-point pre-training:

| Method | Pre-training Type | Seg Gain | Best Backbone |
|--------|------------------|----------|---------------|
| ScaLR | Image→LiDAR distill | 67.8% mIoU (linear!) | WaffleIron |
| SLidR | Superpixel contrastive | 38.8% mIoU (linear) | MinkUNet |
| ALSO | Surface reconstruction | +2 mIoU | MinkUNet, SPVCNN |
| Sonata | Self-distillation | SOTA | PTv3 |
| Concerto | 2D-3D joint SSL | +4.8% over 3D-only | PTv3 |

**Recommendation for airside:** ScaLR (if cameras available) or Sonata/Concerto (if LiDAR-only) for segmentation pre-training. The 18-class airside taxonomy (see `30-autonomy-stack/perception/overview/lidar-semantic-segmentation.md`) requires dense per-point features.

### 8.3 BEV Perception Pre-training

BEV perception benefits from pre-training that operates in BEV space:

| Method | Approach | BEV Task Gain |
|--------|----------|---------------|
| BEV-MAE | BEV masked reconstruction | +1.42 mAP (20% finetune) |
| AD-L-JEPA | BEV embedding prediction | Matches MAE, 2x faster |
| BEVDistill | LiDAR→Camera BEV distill | Camera achieves ~80% of LiDAR |
| UniPAD | Volume rendering | 73.2 NDS, 79.4 mIoU |

**Recommendation for airside:** BEV-MAE or AD-L-JEPA for BEV pre-training. Both align with the Aurrigo stack's BEV-based planning pipeline.

### 8.4 Occupancy Prediction Pre-training

Occupancy prediction is fundamental for safe navigation:

| Method | Approach | Occupancy Result |
|--------|----------|-----------------|
| Occupancy-MAE | Binary occupancy from masked voxels | 50% label reduction |
| Voxel-MAE | Dual occupancy + point prediction | +1.4 APH |
| NOMAE | Multi-scale non-overlapping MAE | Beats supervised |
| UniPAD | Volume rendering | 79.4 mIoU 3D seg |

**Recommendation for airside:** Occupancy-MAE for direct occupancy pre-training. The binary occupancy objective is well-aligned with the safety-critical need to know "is this space occupied?" for navigation.

### 8.5 Motion Forecasting Pre-training

Motion forecasting benefits from temporal pre-training:

| Method | Approach | Forecasting Benefit |
|--------|----------|-------------------|
| TREND | Temporal LiDAR prediction | +1.77-2.11% mAP |
| MC-JEPA | Motion-content separation | Explicit motion features |
| V-JEPA 2-AC | Action-conditioned embedding | 15x faster planning |
| Copilot4D | VQ-VAE + diffusion | 65% Chamfer reduction |

**Recommendation for airside:** TREND for LiDAR motion forecasting pre-training, combined with V-JEPA 2 concepts for video-based motion understanding when cameras are added.

---

## 9. Training Infrastructure and Efficiency

### 9.1 Data Requirements

| Pre-training Method | Unlabeled Data | Labeled Data | Total Storage |
|--------------------|---------------|-------------|---------------|
| GD-MAE | 50K-200K LiDAR frames | 500-5K for fine-tuning | ~100-500 GB |
| ScaLR | 50K-200K LiDAR+camera pairs | 500-5K for fine-tuning | ~200-800 GB |
| AD-L-JEPA | 50K-200K LiDAR frames | 500-5K for fine-tuning | ~100-500 GB |
| DINOv2 (use pretrained) | N/A (use Meta weights) | 500-5K for adaptation | ~50-200 GB |
| UniPAD | 50K-200K multi-modal | 500-5K for fine-tuning | ~300-1000 GB |

**Available public driving data for pre-training:**
| Dataset | Frames | Size | LiDAR | Camera | Labels |
|---------|--------|------|-------|--------|--------|
| nuScenes | 400K | ~300 GB | 32-beam | 6 cameras | 40K keyframes |
| Waymo Open | 12M | ~2 TB | 64-beam + 4 short | 5 cameras | 200K frames |
| KITTI | 15K | ~50 GB | 64-beam | 2 cameras | 7.5K frames |
| ONCE | 1M | ~500 GB | 40-beam | 7 cameras | 15K frames |

For SSL pre-training, the full datasets can be used (labels are not needed). For fine-tuning, only the labeled subsets matter.

### 9.2 Compute Requirements

| Pre-training Method | GPU-Hours (A100) | Estimated Cost | Wall Time (8xA100) |
|--------------------|-----------------|----------------|-------------------|
| GD-MAE (nuScenes) | 24-48 | $50-100 | 3-6 hours |
| GD-MAE (nuScenes+Waymo) | 96-192 | $200-400 | 12-24 hours |
| ScaLR (nuScenes) | 16-32 | $35-70 | 2-4 hours |
| AD-L-JEPA (nuScenes) | 12-24 | $25-50 | 1.5-3 hours |
| DINOv2 pre-training | 39,800 | ~$80K | Use pre-trained weights |
| UniPAD (nuScenes) | 48-96 | $100-200 | 6-12 hours |
| Full pipeline (Stage 1-4) | 42-168 | $85-340 | 5-21 hours |

**Key insight:** AD-L-JEPA is the most compute-efficient method, requiring 1.9-2.7x fewer GPU-hours than equivalent MAE methods with comparable downstream quality.

### 9.3 Multi-GPU Training Strategies

**DDP (Distributed Data Parallel):**
- Standard for pre-training with batch size fitting in single-GPU memory
- Each GPU processes a mini-batch, gradients are all-reduced
- Linear scaling rule: LR scales with total batch size
- Recommended for: GD-MAE, AD-L-JEPA, ScaLR (batch fits in memory)

**FSDP (Fully Sharded Data Parallel):**
- Shards model parameters, gradients, and optimizer states across GPUs
- Enables training models larger than single-GPU memory
- 30-40% memory reduction vs. DDP at the cost of ~10-15% communication overhead
- Recommended for: UniPAD (large unified encoder), full DINOv2 fine-tuning

**Gradient accumulation:**
- Simulates larger batch sizes on fewer GPUs
- 4x accumulation steps = 4x effective batch size
- Use with: limited GPU count, large models

```python
# DDP training pattern for SSL pre-training
import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP

def setup_ddp():
    dist.init_process_group("nccl")
    local_rank = int(os.environ["LOCAL_RANK"])
    torch.cuda.set_device(local_rank)
    return local_rank

def train_ssl_ddp(model, dataloader, optimizer, epochs, accum_steps=1):
    model = DDP(model, device_ids=[local_rank])
    scaler = torch.cuda.amp.GradScaler()  # Mixed precision
    
    for epoch in range(epochs):
        for i, batch in enumerate(dataloader):
            with torch.cuda.amp.autocast():
                loss = model(batch) / accum_steps
            
            scaler.scale(loss).backward()
            
            if (i + 1) % accum_steps == 0:
                scaler.unscale_(optimizer)
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                scaler.step(optimizer)
                scaler.update()
                optimizer.zero_grad()
```

### 9.4 Mixed Precision Training

Mixed precision (FP16/BF16 compute, FP32 master weights) is essential for efficient pre-training:

| Precision Mode | Memory Savings | Speed Improvement | Accuracy Impact |
|---------------|---------------|-------------------|-----------------|
| FP32 (baseline) | 0% | 1x | Baseline |
| FP16 (AMP) | ~40% | ~1.5-2x | <0.1% loss |
| BF16 (if available) | ~40% | ~1.5-2x | No dynamic range issues |
| TF32 (A100 default) | 0% | ~1.3x | Negligible |

**Recommendation:** Use BF16 on A100/H100 (no loss scaling needed) or FP16 with AMP on older GPUs. All major SSL methods support mixed precision out of the box.

### 9.5 Pre-train Cloud, Deploy Edge

The pre-training → deployment pipeline spans two very different compute environments:

**Cloud (pre-training + fine-tuning):**
- GPU: A100 (80GB) or H100 (80GB)
- Memory: 256-512 GB system RAM
- Storage: 2-10 TB NVMe
- Typical cost: $2-4/GPU-hour
- Duration: 5-168 GPU-hours depending on method

**Edge (deployment):**
- GPU: NVIDIA Orin (275 TOPS INT8)
- Memory: 32-64 GB shared
- Storage: 128-512 GB NVMe
- Power: 15-60W

**The critical gap:** Models pre-trained in FP32/FP16 on cloud must be compressed for Orin:

```
Cloud pre-training (FP32/FP16, A100)
        |
   Export to ONNX
        |
   TensorRT optimization
   ├── Layer fusion
   ├── Kernel auto-tuning
   └── Quantization (FP16 → INT8)
        |
   Edge deployment (INT8, Orin)
```

**Typical compression pipeline results:**
| Stage | Latency (Orin) | mAP Loss |
|-------|---------------|----------|
| FP32 (unoptimized) | ~200-500ms | Baseline |
| FP16 (TensorRT) | ~50-100ms | <0.1% |
| INT8 (TensorRT PTQ) | ~25-50ms | 0.5-2% |
| INT8 (TensorRT QAT) | ~25-50ms | 0.1-0.5% |

See `20-av-platform/compute/tensorrt-deployment-guide.md` for detailed Orin optimization pipeline.

---

## 10. Airside Pre-training Strategy

### 10.1 Current State Assessment

**Aurrigo stack capabilities:**
- LiDAR-only perception (4-8 RoboSense, RANSAC segmentation)
- No learned perception models in production
- No cameras in current perception pipeline (planned Phase 2)
- CenterPoint-based detection in research/development

**Airside data availability:**
- Unlabeled LiDAR scans: Modest volume from existing operations (with safety operators)
- Labeled LiDAR data: Zero (no annotations exist)
- Airside camera data: Limited (no systematic collection)
- Public airside datasets: None (zero public 3D airside datasets exist)

### 10.2 Recommended Pre-training Curriculum

**Phase 0: Preparation (Week 1-2)**
- Select and download road driving datasets (nuScenes trainval: ~300GB)
- Set up training infrastructure (cloud GPU cluster, 4-8 A100s)
- Implement data pipeline for LiDAR pre-processing

**Phase 1: Road SSL Pre-training (Week 3-4)**
- Method: AD-L-JEPA (most compute-efficient) or GD-MAE (most proven)
- Data: nuScenes + Waymo unlabeled LiDAR frames (~200K frames)
- Compute: 24-48 GPU-hours (A100)
- Output: Pre-trained LiDAR backbone weights

**Phase 2: Road Supervised Training (Week 5-6)**
- Fine-tune pre-trained backbone on nuScenes labeled data
- Add CenterPoint detection head with nuScenes classes
- Validate on nuScenes val set (target: >60% NDS)
- Compute: 12-24 GPU-hours (A100)

**Phase 3: Airside Data Collection (Week 7-12)**
- Drive vehicles on apron during operations (with safety operator)
- Target: 10,000 unlabeled LiDAR sweeps minimum
- Record camera data if available (for future ScaLR pre-training)
- Store as ROS bags, convert to standard format (nuScenes-like)
- Storage: ~200GB for 10K sweeps with 4-8 LiDARs

**Phase 4: Airside SSL Continuation (Week 13-14)**
- Continue SSL pre-training on unlabeled airside scans
- Same method as Phase 1 (AD-L-JEPA or GD-MAE)
- Reduces domain gap before expensive labeled fine-tuning
- Compute: 4-16 GPU-hours (A100)

**Phase 5: Airside Annotation (Week 13-18, parallel with Phase 4)**
- Annotate 500-1,000 airside LiDAR frames with 3D bounding boxes
- 18-class airside taxonomy (aircraft, 5 GSE types, personnel, FOD, etc.)
- Use pre-labeling with road-trained model (auto-detect "vehicle-like" objects)
- Estimated cost: $15-30K (with pre-labeling reducing effort by ~40%)

**Phase 6: Airside Fine-tuning (Week 19-20)**
- Apply PointLoRA (rank 16-32) to pre-trained backbone
- Fine-tune on labeled airside data
- Validate on held-out airside test set
- Compute: 2-8 GPU-hours (A100)

**Phase 7: Optimization and Deployment (Week 21-24)**
- Export to ONNX → TensorRT INT8
- Benchmark on Orin (target: <50ms latency)
- Shadow mode testing alongside existing RANSAC pipeline
- A/B comparison of perception quality

### 10.3 Expected Data Needs

| Data Type | Amount | Source | Cost |
|-----------|--------|--------|------|
| Unlabeled road LiDAR | 200K frames | nuScenes + Waymo (public) | Free (download) |
| Labeled road data | 40K frames | nuScenes trainval (public) | Free (download) |
| Unlabeled airside LiDAR | 10K-50K frames | Own vehicles during operations | ~$5-10K (operator time) |
| Labeled airside data | 500-1,000 frames | Professional annotation | $15-30K |

**Total data cost: $20-40K** (vs. $150-500K without pre-training)

### 10.4 Cost Estimation

| Component | Cost | Timeline |
|-----------|------|----------|
| **Pre-training compute (Phase 1-2)** | $100-300 | 2-4 weeks |
| **Airside data collection (Phase 3)** | $5-10K | 4-6 weeks |
| **Airside SSL compute (Phase 4)** | $25-50 | 1-2 weeks |
| **Annotation (Phase 5)** | $15-30K | 4-6 weeks |
| **Fine-tuning compute (Phase 6)** | $15-50 | 1-2 weeks |
| **Optimization & testing (Phase 7)** | $5-10K (engineer time) | 2-4 weeks |
| **Total** | **$25-50K** | **~24 weeks** |

**Comparison without pre-training:**
| Component | Cost |
|-----------|------|
| Full airside annotation (5,000-10,000 frames) | $80-200K |
| Training from scratch compute | $500-1,000 |
| Longer development cycle (more data needed) | $30-50K (engineer time) |
| **Total** | **$110-250K** |

**Savings from pre-training: $85-200K (60-80% reduction)**

### 10.5 Multi-Airport Scaling

Pre-training enables efficient scaling to additional airports:

| Airport | Method | Labeled Frames Needed | Cost |
|---------|--------|----------------------|------|
| First airport | Full pipeline (Phase 0-7) | 500-1,000 | $25-50K |
| Same cluster (2nd-5th) | PointLoRA from first airport | 200-500 | $10-20K |
| Different cluster (6th+) | Airside SSL + PointLoRA | 500-1,000 | $15-30K |

"Same cluster" = similar airport layout, similar GSE fleet, same region.
"Different cluster" = different layout, different GSE types, different continent.

PointLoRA adapters can be swapped at deployment time based on airport configuration, maintaining a single base model with per-airport specialization.

See `70-operations-domains/deployment-playbooks/multi-airport-adaptation.md` for the full 8-week per-airport onboarding pipeline.

---

## 11. Comprehensive Comparison Table

### 11.1 All Pre-training Methods Compared

| Method | Venue | Year | Type | Modality | Data Efficiency Gain | Compute (GPU-hrs) | Best For |
|--------|-------|------|------|----------|---------------------|-------------------|----------|
| **Contrastive** | | | | | | | |
| PointContrast | ECCV | 2020 | Point contrastive | LiDAR | ~20% | 16-32 | Indoor 3D |
| DepthContrast | ICCV | 2021 | Multi-view contrastive | LiDAR | ~20% | 16-32 | General 3D |
| PPKT | ICCV | 2021 | Pixel-to-point | LiDAR+Camera | ~30-40% | 8-16 | LiDAR segmentation |
| SLidR | CVPR | 2022 | Superpixel contrastive | LiDAR+Camera | ~40% | 8-16 | LiDAR segmentation |
| ProposalContrast | CVPR | 2023 | Proposal-level | LiDAR | ~30-40% | 24-48 | 3D detection |
| ScaLR | CVPR | 2024 | DINOv2→LiDAR distill | LiDAR+Camera | **40-50%** | 16-32 | LiDAR seg + detection |
| **Masked Autoencoder** | | | | | | | |
| Point-MAE | ECCV | 2022 | Masked point recon | Point cloud | ~20% | 8-16 | Object-level 3D |
| Voxel-MAE | 2022 | 2022 | Masked voxel recon | LiDAR | ~30% | 16-32 | Outdoor LiDAR |
| Occupancy-MAE | IEEE TIV | 2023 | Occupancy prediction | LiDAR | **50%** | 24-48 | Detection + occupancy |
| GD-MAE | CVPR | 2023 | Geometric MAE | LiDAR | **80%** | 24-48 | 3D detection |
| BEV-MAE | AAAI | 2024 | BEV occupancy | LiDAR | ~60% | 16-32 | BEV perception |
| NOMAE | CVPR | 2025 | Multi-scale occ MAE | LiDAR | **Beats supervised** | 24-48 | All LiDAR tasks |
| PSA-SSL | CVPR | 2025 | Pose/size-aware | LiDAR | **90%** | 24-48 | Few-shot detection |
| **JEPA / Embedding** | | | | | | | |
| V-JEPA | Meta | 2024 | Video embedding pred | Camera | N/A (video) | 200+ | Video understanding |
| V-JEPA 2 | Meta | 2025 | Scaled video JEPA | Camera | N/A (video) | 400+ | Multi-task video |
| AD-L-JEPA | AAAI | 2026 | BEV embedding pred | LiDAR | **~80%** | **12-24** | LiDAR detection |
| MC-JEPA | 2023 | 2023 | Motion-content JEPA | Camera | N/A | 100+ | Motion understanding |
| **Self-Distillation** | | | | | | | |
| DINOv2 | Meta | 2023 | Multi-crop distill | Camera | N/A (general) | 39,800 | Use pre-trained weights |
| Sonata | CVPR | 2025 | Self-distill PTv3 | LiDAR | Large | 200+ | 3D backbone |
| Concerto | NeurIPS | 2025 | 2D-3D joint SSL | LiDAR+Camera | **+4.8% over 3D-only** | 300+ | All 3D tasks |
| **Multi-Modal** | | | | | | | |
| UniPAD | CVPR | 2024 | Volume rendering | LiDAR+Camera | **50-60%** | 48-96 | Unified perception |
| BEVDistill | NeurIPS | 2023 | LiDAR→Camera BEV | Multi-modal | N/A (distillation) | 24-48 | Camera-only deployment |
| GPC | ICLR | 2024 | Colorization | LiDAR+Camera | **80-95%** | 24-48 | Detection (with camera) |
| **Other** | | | | | | | |
| ALSO | CVPR | 2023 | Surface reconstruction | LiDAR | ~30-40% | 8-16 | LiDAR seg (lightweight) |
| AD-PT | NeurIPS | 2023 | Semi-supervised | LiDAR | **60-70%** | 48-96 | Cross-dataset transfer |
| TREND | NeurIPS | 2025 | Temporal forecasting | LiDAR | Significant | 24-48 | Temporal perception |

### 11.2 Cross-Modal Contrastive Loss Implementation

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class CrossModalContrastiveLoss(nn.Module):
    """
    Cross-modal contrastive loss for LiDAR-Camera pre-training.
    Implements the core loss used by SLidR, ScaLR, and similar methods.
    
    Pulls together features of LiDAR points and their projected
    camera pixels, pushes apart features of non-corresponding pairs.
    """
    def __init__(self, temperature=0.07, use_superpixels=True):
        super().__init__()
        self.temperature = temperature
        self.use_superpixels = use_superpixels
    
    def forward(
        self,
        lidar_features,      # [N, D] features for N LiDAR points
        image_features,       # [N, D] features for corresponding pixels/superpixels
        superpixel_ids=None,  # [N] superpixel assignment per point (optional)
    ):
        """
        Compute cross-modal contrastive loss.
        
        If use_superpixels=True, pools features per superpixel
        before computing contrastive loss (SLidR-style).
        Otherwise, uses point-pixel pairs directly (PPKT-style).
        """
        if self.use_superpixels and superpixel_ids is not None:
            # Pool features per superpixel
            unique_ids = superpixel_ids.unique()
            pooled_lidar = []
            pooled_image = []
            
            for sp_id in unique_ids:
                mask = superpixel_ids == sp_id
                pooled_lidar.append(lidar_features[mask].mean(dim=0))
                pooled_image.append(image_features[mask].mean(dim=0))
            
            lidar_features = torch.stack(pooled_lidar)   # [K, D]
            image_features = torch.stack(pooled_image)    # [K, D]
        
        # L2 normalize
        lidar_features = F.normalize(lidar_features, dim=-1)
        image_features = F.normalize(image_features, dim=-1)
        
        N = lidar_features.shape[0]
        
        # Similarity matrix: [N, N]
        # sim[i,j] = cosine similarity between lidar_i and image_j
        sim_matrix = torch.mm(
            lidar_features, image_features.t()
        ) / self.temperature
        
        # Labels: diagonal elements are positive pairs
        labels = torch.arange(N, device=sim_matrix.device)
        
        # Bidirectional contrastive loss
        loss_l2i = F.cross_entropy(sim_matrix, labels)      # LiDAR → Image
        loss_i2l = F.cross_entropy(sim_matrix.t(), labels)   # Image → LiDAR
        
        loss = (loss_l2i + loss_i2l) / 2.0
        
        return loss


class ScaLRPretrainer(nn.Module):
    """
    Simplified ScaLR-style pre-trainer.
    Distills DINOv2 features into a LiDAR backbone via contrastive learning.
    """
    def __init__(
        self,
        lidar_backbone,     # 3D backbone to pre-train (e.g., WaffleIron, MinkUNet)
        image_teacher,      # Frozen DINOv2 model
        projection_dim=256,
        temperature=0.07,
    ):
        super().__init__()
        self.lidar_backbone = lidar_backbone
        self.image_teacher = image_teacher
        
        # Freeze teacher
        for param in self.image_teacher.parameters():
            param.requires_grad = False
        
        # Projection heads
        lidar_feat_dim = lidar_backbone.output_dim  # e.g., 96 for WaffleIron
        image_feat_dim = image_teacher.embed_dim     # e.g., 1024 for DINOv2 ViT-L
        
        self.lidar_projector = nn.Sequential(
            nn.Linear(lidar_feat_dim, projection_dim),
            nn.BatchNorm1d(projection_dim),
            nn.ReLU(),
            nn.Linear(projection_dim, projection_dim),
        )
        
        self.image_projector = nn.Sequential(
            nn.Linear(image_feat_dim, projection_dim),
            nn.BatchNorm1d(projection_dim),
            nn.ReLU(),
            nn.Linear(projection_dim, projection_dim),
        )
        
        self.contrastive_loss = CrossModalContrastiveLoss(
            temperature=temperature,
            use_superpixels=True,
        )
    
    def forward(self, lidar_points, images, projection_matrix, superpixel_ids):
        """
        Forward pass for ScaLR-style pre-training.
        
        Args:
            lidar_points: [B, N, 3+] LiDAR points (xyz + features)
            images: [B, C, H, W] camera images
            projection_matrix: [B, 3, 4] LiDAR-to-camera projection
            superpixel_ids: [B, N] superpixel assignment per point
        
        Returns:
            loss: contrastive distillation loss
        """
        # Extract LiDAR features (trainable)
        lidar_feats = self.lidar_backbone(lidar_points)  # [B, N, D_lidar]
        
        # Extract image features (frozen teacher)
        with torch.no_grad():
            image_feats = self.image_teacher(images)      # [B, H/14*W/14, D_image]
        
        # Project LiDAR points to image coordinates
        # (simplified -- actual implementation handles batching)
        projected_image_feats = self._gather_image_features(
            image_feats, lidar_points, projection_matrix
        )
        
        # Project to shared space
        lidar_projected = self.lidar_projector(
            lidar_feats.reshape(-1, lidar_feats.shape[-1])
        )
        image_projected = self.image_projector(
            projected_image_feats.reshape(-1, projected_image_feats.shape[-1])
        )
        
        # Contrastive loss with superpixel pooling
        loss = self.contrastive_loss(
            lidar_projected,
            image_projected,
            superpixel_ids.reshape(-1),
        )
        
        return loss
    
    def _gather_image_features(self, image_feats, lidar_points, proj_matrix):
        """
        Gather image features at projected LiDAR point locations.
        Uses bilinear interpolation for sub-pixel accuracy.
        """
        # Project 3D points to 2D image coordinates
        # proj_matrix: [B, 3, 4], lidar_points: [B, N, 3]
        B, N, _ = lidar_points.shape
        
        ones = torch.ones(B, N, 1, device=lidar_points.device)
        points_homo = torch.cat([lidar_points[:, :, :3], ones], dim=-1)  # [B, N, 4]
        
        # Project: [B, N, 3] = [B, N, 4] @ [B, 4, 3]
        projected = torch.bmm(points_homo, proj_matrix.transpose(1, 2))
        
        # Normalize by depth
        depth = projected[:, :, 2:3].clamp(min=1e-5)
        uv = projected[:, :, :2] / depth  # [B, N, 2] pixel coordinates
        
        # Bilinear sample from image features
        # Reshape image_feats to spatial grid first
        H_feat = int(image_feats.shape[1] ** 0.5)
        W_feat = H_feat
        image_feats_spatial = image_feats.reshape(
            B, H_feat, W_feat, -1
        ).permute(0, 3, 1, 2)  # [B, D, H, W]
        
        # Normalize coordinates to [-1, 1] for grid_sample
        uv_normalized = uv.clone()
        uv_normalized[:, :, 0] = 2.0 * uv[:, :, 0] / (W_feat - 1) - 1.0
        uv_normalized[:, :, 1] = 2.0 * uv[:, :, 1] / (H_feat - 1) - 1.0
        
        grid = uv_normalized.unsqueeze(1)  # [B, 1, N, 2]
        sampled = F.grid_sample(
            image_feats_spatial, grid,
            mode='bilinear', align_corners=True
        )  # [B, D, 1, N]
        
        return sampled.squeeze(2).permute(0, 2, 1)  # [B, N, D]
```

### 11.3 Method Selection Guide

```
What modalities are available?
│
├── LiDAR only (current Aurrigo)
│   │
│   ├── Want best data efficiency?
│   │   ├── GD-MAE (80% label savings, proven)
│   │   ├── PSA-SSL (90% label savings, CVPR 2025)
│   │   └── AD-L-JEPA (80% savings, lowest compute)
│   │
│   ├── Want best features?
│   │   ├── Sonata + PTv3 (SOTA backbone)
│   │   └── NOMAE (beats supervised)
│   │
│   └── Want fastest pre-training?
│       ├── AD-L-JEPA (1.9-2.7x faster than MAE)
│       └── ALSO (lightweight, single-stream)
│
├── LiDAR + Camera (Phase 2 Aurrigo)
│   │
│   ├── Want best data efficiency?
│   │   ├── GPC (95% label savings)
│   │   └── ScaLR (67.8% mIoU frozen linear probe)
│   │
│   ├── Want unified pre-training?
│   │   ├── UniPAD (volume rendering, CVPR 2024)
│   │   └── Concerto (2D-3D joint SSL)
│   │
│   └── Want camera fallback?
│       └── BEVDistill (LiDAR→Camera distillation)
│
└── Camera only (degraded mode)
    │
    ├── DINOv2 + LoRA (r=32, adapter-mediated)
    ├── BEVFormer + DINOv2 backbone
    └── Depth Anything V2 (DINOv2-based depth)
```

---

## 12. Key Findings Summary

| # | Finding | Source | Relevance |
|---|---------|--------|-----------|
| 1 | **Pre-training saves 50-95% of labeled data depending on method.** GD-MAE achieves 80%, GPC achieves 95%, PSA-SSL achieves 90%. For airside, this reduces annotation cost from $150-500K to $15-30K. | GD-MAE (CVPR 2023), GPC (ICLR 2024), PSA-SSL (CVPR 2025) | CRITICAL |
| 2 | **AD-L-JEPA is the most compute-efficient LiDAR pre-training method**: 1.9-2.7x fewer GPU-hours and 2.8-4x less memory than Occupancy-MAE with comparable downstream quality. | AD-L-JEPA (AAAI 2026) | HIGH |
| 3 | **ScaLR (CVPR 2024) provides the best LiDAR self-supervised features** via DINOv2-to-LiDAR distillation: 67.8% mIoU on nuScenes with linear probing alone (frozen backbone). Requires camera-LiDAR pairs. | ScaLR (CVPR 2024) | HIGH |
| 4 | **DINOv2 as drop-in backbone replacement fails completely** (0% mAP). Must use adapter-mediated integration. LoRA rank 32 on query+value projections matches ResNet-101 with 37x fewer learnable parameters. | Robust BEV Seg (2024), DINOv2+LSS (2025) | HIGH |
| 5 | **JEPA outperforms MAE for semantic tasks** while MAE is better for reconstruction tasks. For detection/segmentation (primary airside needs), JEPA is recommended. For occupancy prediction, MAE is preferred. | AD-L-JEPA (AAAI 2026), V-JEPA (2024) | MEDIUM |
| 6 | **The road→airside transfer pipeline costs $25-50K** (24-week timeline) vs. $110-250K without pre-training. Pre-training reduces both annotation cost and development time by 60-80%. | Analysis in this document | CRITICAL |
| 7 | **Cross-modal pre-training (image→LiDAR) consistently outperforms single-modal SSL.** SLidR > DepthContrast > PointContrast. ScaLR >> SLidR due to DINOv2 teacher. Adding cameras to Aurrigo stack unlocks the strongest SSL methods. | SLidR (CVPR 2022), ScaLR (CVPR 2024) | HIGH |
| 8 | **500-1,000 labeled airside frames are sufficient** for competitive detection performance when combined with SSL pre-training on road data and unlabeled airside scans. Without pre-training, 5,000-10,000 frames are needed. | GD-MAE efficiency curves, airside estimates | CRITICAL |
| 9 | **Multi-airport scaling is efficient**: First airport requires 500-1,000 labeled frames ($25-50K). Same-cluster airports need only 200-500 frames ($10-20K) via PointLoRA adapter swapping. | PointLoRA (CVPR 2025), multi-airport analysis | HIGH |
| 10 | **The pre-train cloud → deploy edge pipeline is well-established.** TensorRT INT8 quantization of pre-trained models loses only 0.5-2% mAP while achieving <50ms latency on Orin. No barriers to deploying SSL-pretrained models on edge hardware. | TensorRT benchmarks, Orin deployment experience | MEDIUM |
| 11 | **No airside-specific pre-training or benchmark exists.** This is simultaneously a challenge (no ready-made solution) and an opportunity (creating the airside benchmark would establish Aurrigo as the reference). | Survey of all existing methods | HIGH |
| 12 | **NOMAE (CVPR 2025) beats fully supervised baselines** with SSL pre-training alone, suggesting that for data-scarce domains like airside, SSL is not just a cost-saving measure but may produce superior models. | NOMAE (CVPR 2025) | HIGH |
| 13 | **Temporal pre-training (TREND) adds +1.77-2.11% mAP** beyond spatial-only pre-training by learning dynamics from sequential LiDAR frames. Particularly valuable for airside where motion patterns (pushback, GSE traversal) are distinctive. | TREND (NeurIPS 2025) | MEDIUM |
| 14 | **Language-guided features enable zero-shot airside understanding** via CLIP alignment. Open-vocabulary 3D methods (ULIP-2, OpenScene, Concerto) allow querying scenes with natural language without explicit class definitions. | ULIP-2 (CVPR 2024), OpenScene (CVPR 2023) | MEDIUM |
| 15 | **The complete SSL landscape is converging**: Contrastive + MAE + JEPA hybrid methods (like Concerto) outperform any single approach by 4.8%+. The next generation of methods will likely combine all three paradigms. | Concerto (NeurIPS 2025) | MEDIUM |

---

## 13. References

### Contrastive Learning
- [PointContrast](https://arxiv.org/abs/2007.10985) (Xie et al., ECCV 2020) -- Point-level contrastive pre-training for 3D understanding
- [DepthContrast](https://arxiv.org/abs/2101.02691) (Zhang et al., ICCV 2021) -- Self-supervised 3D pre-training on any point cloud
- [PPKT](https://arxiv.org/abs/2104.04687) (Liu et al., ICCV 2021) -- Image-to-point knowledge transfer
- [SLidR](https://arxiv.org/abs/2203.16258) (Sautier et al., CVPR 2022) -- Image-to-LiDAR distillation via superpixels
- [ProposalContrast](https://arxiv.org/abs/2207.12654) (Yin et al., CVPR 2023) -- Proposal-level contrastive for 3D detection
- [ScaLR](https://arxiv.org/abs/2310.17504) (Sanchez et al., CVPR 2024) -- Three pillars for LiDAR foundation model distillation

### Masked Autoencoders
- [MAE](https://arxiv.org/abs/2111.06377) (He et al., CVPR 2022) -- Masked autoencoders are scalable vision learners
- [BEiT](https://arxiv.org/abs/2106.08254) (Bao et al., ICLR 2022) -- BERT pre-training of image transformers
- [Point-MAE](https://arxiv.org/abs/2203.06604) (Pang et al., ECCV 2022) -- Masked autoencoders for point cloud SSL
- [Point-BERT](https://arxiv.org/abs/2111.14819) (Yu et al., CVPR 2022) -- Pre-training 3D point cloud transformers
- [Voxel-MAE](https://arxiv.org/abs/2206.09900) (Hess et al., 2022) -- Masked autoencoders for large-scale point clouds
- [GD-MAE](https://arxiv.org/abs/2212.03010) (Yang et al., CVPR 2023) -- Generative decoder for LiDAR MAE pre-training
- [Occupancy-MAE](https://arxiv.org/abs/2206.09900) (Min et al., IEEE TIV 2023) -- Large-scale LiDAR SSL via occupancy
- [BEV-MAE](https://arxiv.org/abs/2212.05758) (Ren et al., AAAI 2024) -- BEV masked autoencoders for point cloud pre-training
- [NOMAE](https://arxiv.org/abs/2410.10497) (CVPR 2025) -- Non-overlapping masked autoencoders for 3D

### JEPA and Embedding Prediction
- [LeCun JEPA Position Paper](https://arxiv.org/abs/2306.02572) (Yann LeCun, 2022) -- A path towards autonomous machine intelligence
- [V-JEPA](https://ai.meta.com/blog/v-jepa-yann-lecun-ai-model-video-joint-embedding-predictive-architecture/) (Bardes et al., Meta 2024) -- Video joint embedding predictive architecture
- [V-JEPA 2](https://arxiv.org/abs/2506.09985) (Assran et al., Meta 2025) -- Self-supervised video models enable understanding, prediction, and planning
- [AD-L-JEPA](https://arxiv.org/abs/2501.04969) (Zhu et al., AAAI 2026) -- Self-supervised spatial world model for autonomous driving
- [MC-JEPA](https://arxiv.org/abs/2307.12698) (Bardes et al., 2023) -- Motion-content joint embedding predictive architecture
- [LeJEPA](https://arxiv.org/abs/2511.08544) (Balestriero et al., Meta 2025) -- Provable JEPA objective

### DINO/DINOv2
- [DINOv2](https://arxiv.org/abs/2304.07193) (Oquab et al., Meta 2023) -- Learning robust visual features without supervision
- [DINO Pre-training for AD](https://arxiv.org/abs/2407.10803) (Juneja et al., 2024) -- DINO pre-training for vision-based end-to-end autonomous driving
- [Robust BEV Segmentation with DINOv2](https://arxiv.org/abs/2409.10228) (2024) -- DINOv2 + LoRA for robust BEV perception
- [DINOv2+LSS](https://arxiv.org/abs/2501.08118) (2025) -- Revisiting BEV with frozen foundation models
- [RCDINO](https://arxiv.org/abs/2508.15353) (2025) -- Radar-camera fusion with DINOv2 semantic features
- [DualViewDistill](https://arxiv.org/abs/2510.10287) (2025) -- Foundation model guided BEV maps

### Multi-Modal Pre-training
- [UniPAD](https://arxiv.org/abs/2310.08370) (Yang et al., CVPR 2024) -- Universal pre-training paradigm for autonomous driving
- [BEVDistill](https://arxiv.org/abs/2211.09386) (NeurIPS 2023) -- Cross-modal BEV knowledge distillation
- [GPC](https://arxiv.org/abs/2310.14592) (Pan et al., ICLR 2024) -- Pre-training 3D detectors through colorization
- [Sonata](https://arxiv.org/abs/2403.14742) (CVPR 2025) -- Self-supervised pre-training for 3D understanding
- [Concerto](https://arxiv.org/abs/2405.14745) (NeurIPS 2025) -- 2D-3D joint self-supervised learning
- [TREND](https://arxiv.org/abs/2410.07117) (NeurIPS 2025) -- Temporal pre-training for LiDAR perception
- [ALSO](https://arxiv.org/abs/2212.05867) (Boulch et al., CVPR 2023) -- Automotive LiDAR self-supervision by occupancy estimation

### Point Cloud Adaptation
- [PointLoRA](https://arxiv.org/abs/2411.00312) (CVPR 2025) -- Low-rank adaptation for point cloud learning
- [AD-PT](https://arxiv.org/abs/2306.00612) (Yuan et al., NeurIPS 2023) -- Autonomous driving pre-training with large-scale point cloud dataset
- [PSA-SSL](https://arxiv.org/abs/2410.09014) (CVPR 2025) -- Pose/size-aware self-supervised learning
- [PointGPT](https://arxiv.org/abs/2305.11487) (Chen et al., NeurIPS 2023) -- Auto-regressive generative pre-training from point clouds

### Language-Aligned 3D
- [CLIP](https://arxiv.org/abs/2103.00020) (Radford et al., ICML 2021) -- Learning transferable visual models from natural language supervision
- [OpenCLIP](https://github.com/mlfoundations/open_clip) -- Open-source CLIP training
- [ULIP-2](https://arxiv.org/abs/2305.08275) (CVPR 2024) -- Scalable multimodal pre-training for 3D understanding
- [OpenScene](https://arxiv.org/abs/2211.15654) (CVPR 2023) -- 3D scene understanding with open vocabularies

### Infrastructure
- [PonderV2](https://arxiv.org/abs/2310.08586) (2024) -- Universal pre-training paradigm for 3D foundation models
- [PTv3](https://arxiv.org/abs/2312.10035) (CVPR 2024) -- Point Transformer V3
- [FlatFormer](https://arxiv.org/abs/2301.08739) (CVPR 2023) -- Flattened window attention for efficient point cloud transformer

---

## Related Documents

- `30-autonomy-stack/perception/overview/dinov2-foundation-models-driving.md` -- Detailed DINOv2 architecture, BEV integration, LoRA results
- `30-autonomy-stack/perception/overview/lidar-foundation-models.md` -- Comprehensive LiDAR foundation model survey (PTv3, Sonata, ScaLR, GPC)
- `30-autonomy-stack/world-models/tokenized-and-jepa.md` -- JEPA paradigm, VQ-VAE tokenization, AD-L-JEPA details
- `50-cloud-fleet/mlops/transfer-learning.md` -- Road→airside domain gap analysis, transfer strategies, UDA methods
- `30-autonomy-stack/perception/overview/lidar-semantic-segmentation.md` -- 18-class airside taxonomy, FlatFormer, ALPINE
- `30-autonomy-stack/perception/overview/model-compression-edge-deployment.md` -- TensorRT optimization, INT8 quantization, multi-model orchestration
- `70-operations-domains/deployment-playbooks/multi-airport-adaptation.md` -- 8-week onboarding, PointLoRA per-airport, scaling economics
- `20-av-platform/compute/tensorrt-deployment-guide.md` -- Orin deployment pipeline, INT8 calibration
- `30-autonomy-stack/perception/overview/camera-fallback-perception.md` -- Degraded mode with camera-only, BEVDistill
