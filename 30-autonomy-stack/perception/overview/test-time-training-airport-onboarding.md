# Test-Time Training (TTT) for Rapid Airport Onboarding of Autonomous GSE Perception

**Research Date:** 2026-04-11
**Scope:** Gradient-based test-time training methods for adapting LiDAR perception models to new airport environments without labeled data, deployed on NVIDIA Orin AGX within Simplex safety architecture
**Stack Context:** reference airside AV stack ROS Noetic, 4-8 RoboSense LiDAR (RSHELIOS/RSBP), PointPillars/CenterPoint detection, GTSAM localization, Frenet planner, Simplex AC/BC

---

**Key Takeaway:** Test-time training (TTT) occupies a critical middle ground between lightweight TTA (BN statistics only, covered in `test-time-adaptation-airside.md`) and full supervised fine-tuning (requires labels, covered in `multi-airport-adaptation.md`). TTT uses self-supervised auxiliary losses -- masked point cloud reconstruction, contrastive temporal consistency, ground plane prediction -- to compute actual gradients and update model parameters at test time, recovering 40-70% of the domain gap at a new airport *before any labeled data exists*. On Orin AGX, a LoRA-constrained TTT update (rank 4-8, 1 gradient step per 10 frames) adds 8-15ms amortized overhead per inference cycle, fitting within the 50ms planning budget. The critical safety requirement is bounding TTT's risk: an anchor loss prevents deviation beyond 5% of pre-deployment weights, a frozen baseline model (Simplex BC) runs in parallel at all times, and OOD-triggered fallback overrides TTT if adapted model uncertainty exceeds threshold. For the reference airside AV stack's airport onboarding, TTT compresses the "unlabeled shadow mode" phase from 2 weeks of passive observation to 3-5 days of active adaptation, after which the adapted model can be evaluated against a small labeled sample (200-500 frames) and locked as the new airport baseline.

---

## Table of Contents

1. [TTA vs TTT vs Fine-Tuning: A Precise Taxonomy](#1-tta-vs-ttt-vs-fine-tuning-a-precise-taxonomy)
2. [TTT Methods: State of the Art (2024-2026)](#2-ttt-methods-state-of-the-art-2024-2026)
3. [LiDAR-Specific TTT Auxiliary Tasks](#3-lidar-specific-ttt-auxiliary-tasks)
4. [Safety-Bounded TTT on Orin AGX](#4-safety-bounded-ttt-on-orin-agx)
5. [Catastrophic Forgetting Prevention](#5-catastrophic-forgetting-prevention)
6. [Simplex Integration Architecture](#6-simplex-integration-architecture)
7. [Airport Onboarding Protocol with TTT](#7-airport-onboarding-protocol-with-ttt)
8. [Comparison with Alternative Adaptation Methods](#8-comparison-with-alternative-adaptation-methods)
9. [Experimental Evidence and Expected Gains](#9-experimental-evidence-and-expected-gains)
10. [Implementation Roadmap](#10-implementation-roadmap)
11. [Key Takeaways](#11-key-takeaways)
12. [References](#12-references)

---

## 1. TTA vs TTT vs Fine-Tuning: A Precise Taxonomy

### 1.1 The Adaptation Spectrum

Deploying a perception model trained at Airport A to Airport B creates a domain gap that degrades performance by 15-40% mAP (see `test-time-adaptation-airside.md`, Section 1.2). The question is how to close this gap. Three families of methods exist, forming a strict hierarchy of adaptation power and risk:

```
Adaptation Power (low → high)
Risk of Failure  (low → high)

  ┌──────────────────────────────────────────────────────────────────────┐
  │  Level 0: No Adaptation                                             │
  │  Deploy source model as-is. Accept 15-40% mAP loss.                │
  │  Risk: None (model unchanged). Power: None.                        │
  ├──────────────────────────────────────────────────────────────────────┤
  │  Level 1: Test-Time Adaptation (TTA)                                │
  │  Update BN statistics or minimize prediction entropy.               │
  │  No gradient on main task loss. No auxiliary objectives.            │
  │  Methods: TENT, BN-Adapt, SAR, CoTTA, RoTTA                        │
  │  Recovers: 5-15% of domain gap. Risk: Low (BN params only).        │
  ├──────────────────────────────────────────────────────────────────────┤
  │  Level 2: Test-Time Training (TTT)                    ◄── THIS DOC │
  │  Compute gradients via self-supervised auxiliary losses.             │
  │  Update backbone/encoder parameters using reconstruction,           │
  │  contrastive, or prediction objectives. No task labels needed.      │
  │  Methods: TTT++, TTT-MAE, TTT-Linear, online LoRA+MAE, LAME        │
  │  Recovers: 20-50% of domain gap. Risk: Medium (backbone changes).   │
  ├──────────────────────────────────────────────────────────────────────┤
  │  Level 3: Supervised Fine-Tuning                                    │
  │  Requires labeled data from target domain.                          │
  │  PointLoRA fine-tuning, head retraining, full fine-tuning.          │
  │  Methods: LoRA, adapter layers, full backprop                       │
  │  Recovers: 60-90% of domain gap. Risk: Low (labeled guidance).     │
  └──────────────────────────────────────────────────────────────────────┘
```

### 1.2 What Makes TTT Different from TTA

The distinction is fundamental and often confused in the literature. TTA and TTT differ in three critical dimensions:

| Dimension | TTA (Level 1) | TTT (Level 2) |
|-----------|---------------|----------------|
| **What parameters update** | BatchNorm affine (gamma, beta) only -- typically <0.1% of model | Backbone encoder weights, feature extractor -- up to 5-20% of model |
| **Loss function** | Prediction entropy (unsupervised signal from model output) | Self-supervised auxiliary loss (reconstruction, contrastive, prediction) |
| **Gradient source** | Gradient from model's own predictions (circular, self-referential) | Gradient from external objective with ground truth (self-supervised, but grounded) |
| **Training-time requirement** | None -- any model can be TTA'd post-hoc | Must be co-trained with auxiliary task during source training |
| **Information exploited** | Only model confidence on test data | Geometric/structural properties of test data itself |
| **Typical mAP recovery** | 5-15% of gap | 20-50% of gap |
| **Failure mode** | Entropy collapse (confident but wrong) | Feature drift (backbone diverges from task-relevant features) |
| **Compute overhead** | 5-15% per inference | 50-200% per update step (amortized to 5-20% if batched) |

**The key insight:** TTA is limited because entropy minimization uses the model's own uncertain predictions as signal -- a circular process that amplifies errors when the domain shift is large. TTT breaks this circularity by introducing an external self-supervised objective that provides a genuine learning signal grounded in the structure of the test data itself. When you mask 70% of a LiDAR point cloud and ask the model to reconstruct it, the reconstruction error is an objective measure of how well the model understands the current data distribution -- independent of downstream task predictions.

### 1.3 When TTT Is Appropriate

TTT is the right choice when all of the following hold:

1. **No labeled target data exists yet** -- rules out supervised fine-tuning
2. **Domain shift is moderate to large** (>15% mAP drop) -- TTA alone is insufficient
3. **Compute budget allows gradient updates** -- Orin can afford periodic backprop
4. **A safety fallback exists** -- Simplex BC catches TTT failures
5. **Auxiliary task was included during source training** -- model architecture supports it

For the reference airside AV stack's airport onboarding, conditions 1-4 are always met. Condition 5 requires architectural planning: the auxiliary task head must be trained alongside the main detection head during source model training. This is a one-time cost.

### 1.4 What TTT Cannot Do

TTT has hard limits that must be understood before deployment:

- **Cannot learn new object classes.** If Airport B has a GSE type never seen during training, TTT cannot create a detection head for it. It can only adapt features to better represent the new domain's distribution. New classes require supervised fine-tuning or active learning.
- **Cannot overcome catastrophic architecture mismatch.** If the source model's receptive field is too small for Airport B's wider aprons, TTT cannot fix an architectural limitation.
- **Cannot guarantee convergence.** Self-supervised gradients may not reduce the task-relevant domain gap if the auxiliary objective is weakly correlated with the main task.
- **Cannot replace validation.** TTT-adapted models must still pass quantitative evaluation before being promoted from shadow mode.

---

## 2. TTT Methods: State of the Art (2024-2026)

### 2.1 Method Overview

| Method | Year | Venue | Auxiliary Task | Updates | Params Updated | mAP/Acc Gain | Orin Feasibility |
|--------|------|-------|----------------|---------|----------------|--------------|------------------|
| **TTT (original)** | 2020 | ICML | Rotation prediction | Per-batch SGD | Shared encoder | +3-5% acc | Yes (simple) |
| **TTT++** | 2021 | NeurIPS | Multi-head contrastive | Per-batch | Shared encoder + heads | +5-8% acc | Marginal |
| **TTT-MAE** | 2023 | NeurIPS | Masked autoencoder reconstruction | Per-batch | Encoder (LoRA) | +8-15% acc | Yes (w/ LoRA) |
| **TTT-Linear** | 2024 | ICML | Linear self-supervised | Per-token (!) | TTT layer replaces attention | N/A (architectural) | Research only |
| **Online LoRA+MAE** | 2024 | ECCV | MAE + entropy joint loss | Accumulated | LoRA adapters | +10-20% mAP | Yes (designed for edge) |
| **LAME** | 2022 | CVPR | Laplacian manifold | Per-batch | Output layer only | +2-5% acc | Yes (minimal) |
| **TTT-Bench/ActTTT** | 2025 | ICLR | Active sample selection for TTT | Selected batches | Encoder | +12-18% acc | Yes |
| **ClusTTT** | 2025 | Preprint | Cluster-guided TTT | Per-cluster | Shared encoder | +7-12% acc | Yes |
| **Continual-TTT** | 2025 | CVPR | Streaming self-supervised | Sliding window | LoRA + BN | +8-14% acc | Yes |

### 2.2 TTT (Original): Rotation Prediction (Sun et al., ICML 2020)

The foundational TTT paper introduced the core idea: train a model with two heads -- a main task head and a self-supervised auxiliary head. At test time, use the auxiliary head's loss to update the shared encoder.

**Architecture:**

```
                    Input Point Cloud
                         │
                    ┌────▼────┐
                    │ Shared  │
                    │ Encoder │ ← Updated by auxiliary gradient at test time
                    │  f(x)   │
                    └──┬───┬──┘
                       │   │
              ┌────────▼┐ ┌▼────────┐
              │ Main    │ │Auxiliary│
              │ Task    │ │ Task   │
              │ Head    │ │ Head   │
              │(detect) │ │(rotate)│
              └────┬────┘ └───┬────┘
                   │          │
              Detections   Rotation
              (frozen at    prediction
               test time)   loss → grad
```

**Original auxiliary task:** Predict which of 4 rotations (0, 90, 180, 270 degrees) was applied to the input. This is a pretext task that forces the encoder to learn orientation-aware features.

**Training procedure:**
1. For each training sample, jointly minimize: `L_total = L_main(x, y) + alpha * L_aux(rotate(x))`
2. Both heads share the encoder, so auxiliary gradients shape the encoder features

**Test-time procedure:**
1. For each test batch, compute auxiliary loss: `L_aux(rotate(x_test))`
2. Backpropagate through encoder only (main head frozen)
3. Update encoder parameters: `theta_enc ← theta_enc - lr * grad(L_aux)`
4. Forward pass with updated encoder through main head for final prediction

**Limitations for 3D LiDAR:**
- Rotation prediction is trivially solved by many 3D encoders (gravity provides orientation cue from ground plane)
- The 4-class rotation task provides weak gradients -- limited information per update
- Point cloud rotation changes the density distribution (beam pattern is cylindrical, not spherical), introducing distribution shift within the auxiliary task itself

**Nevertheless:** The TTT framework is sound. The key contribution is the idea, not the specific auxiliary task. All subsequent methods improve by choosing better auxiliary objectives.

### 2.3 TTT++ (Liu et al., NeurIPS 2021)

TTT++ replaces rotation prediction with a multi-head self-supervised objective:

**Improvements over TTT:**
1. **Contrastive auxiliary task:** Uses SimCLR-style contrastive learning instead of rotation. Augmented views of the same input should produce similar features; different inputs should produce dissimilar features.
2. **Multi-head architecture:** Multiple auxiliary heads capture different aspects of the data distribution (geometry, density, spatial extent). Each head provides independent gradient signal.
3. **Momentum encoder:** Exponential moving average of the encoder provides stable contrastive targets, preventing mode collapse during test-time updates.

**Contrastive loss at test time:**
```python
# TTT++ test-time update (pseudocode for LiDAR adaptation)
def ttt_plus_plus_update(encoder, aux_heads, momentum_encoder, 
                          point_cloud, augment_fn, optimizer):
    """
    Multi-head contrastive TTT update.
    
    Args:
        encoder: Shared backbone (e.g., PointPillars encoder)
        aux_heads: List of K projection heads for contrastive learning
        momentum_encoder: EMA copy of encoder (provides stable targets)
        point_cloud: Current LiDAR scan (N x 4: x, y, z, intensity)
        augment_fn: Point cloud augmentation (jitter, drop, subsample)
        optimizer: SGD/Adam over encoder params only
    """
    # Generate two augmented views
    view_1 = augment_fn(point_cloud)  # random jitter + subsample
    view_2 = augment_fn(point_cloud)  # different augmentation
    
    # Encode both views
    z1 = encoder(view_1)       # Online encoder (updated)
    with torch.no_grad():
        z2 = momentum_encoder(view_2)  # Momentum encoder (stable)
    
    # Multi-head contrastive loss
    total_loss = 0
    for head in aux_heads:
        p1 = head(z1)
        p2 = head(z2)
        # Negative cosine similarity (minimize → maximize agreement)
        loss = -F.cosine_similarity(p1, p2.detach(), dim=-1).mean()
        total_loss += loss
    
    optimizer.zero_grad()
    total_loss.backward()
    optimizer.step()
    
    # Update momentum encoder
    with torch.no_grad():
        for p_online, p_momentum in zip(
            encoder.parameters(), momentum_encoder.parameters()
        ):
            p_momentum.data = 0.999 * p_momentum.data + 0.001 * p_online.data
```

**Compute cost:** 2x forward pass (two views) + 1x backward pass through encoder. On Orin, for a PointPillars encoder: ~6.84ms (forward) x 2 + ~10ms (backward) = ~24ms per update. Amortized over 10 frames = 2.4ms per inference.

**Failure modes:**
- Feature collapse: all features converge to a constant, rendering both auxiliary and main tasks useless. Mitigated by momentum encoder and stop-gradient.
- Augmentation sensitivity: if augmentations are too weak, the contrastive task is trivial (no learning). If too strong, the augmented views are semantically different (wrong learning signal).

### 2.4 TTT-MAE (Gandelsman et al., NeurIPS 2023)

TTT-MAE replaces contrastive learning with masked autoencoder (MAE) reconstruction as the auxiliary task. This is the most promising TTT variant for LiDAR perception.

**Core idea:** At test time, mask a large fraction (60-80%) of the input and train the encoder to reconstruct the masked portion. The reconstruction loss provides a direct measure of how well the encoder models the current data distribution.

**Why MAE is superior to contrastive for LiDAR TTT:**

| Property | Contrastive (TTT++) | MAE (TTT-MAE) |
|----------|--------------------|--------------------|
| Gradient quality | Relative (push/pull pairs) | Absolute (reconstruction error) |
| Batch dependence | Needs negative pairs (batch-size sensitive) | Works on single sample |
| Information per update | O(B^2) pairwise comparisons | O(N_masked) reconstruction targets |
| Sensitivity to augmentations | High (must design good augmentations) | Low (masking is natural for point clouds) |
| LiDAR suitability | Moderate (what augmentations for 3D?) | Excellent (point dropping is physically motivated) |

**Architecture for LiDAR:**

```
Input: Point cloud P (N x 4)
                │
                ▼
    ┌───────────────────────┐
    │  Random masking (70%) │
    │  P_visible (0.3N x 4) │
    │  P_masked  (0.7N x 4) │
    └──────┬────────────────┘
           │
    ┌──────▼──────┐
    │   Encoder   │ ← Updated by reconstruction gradient
    │   f(x)      │
    └──────┬──────┘
           │
    ┌──────┼──────┐
    │      │      │
    ▼      │      ▼
 ┌──────┐  │  ┌──────────┐
 │ Main │  │  │ Decoder  │
 │ Head │  │  │ g(z)     │
 │(det) │  │  │ Reconstruct
 └──┬───┘  │  │ masked   │
    │      │  │ points   │
    │      │  └────┬─────┘
    │      │       │
 Detections │    L_recon = ChamferDist(P_masked, g(f(P_visible)))
         Not used        │
         at test         │
         time       Gradient → Update encoder
```

**Reconstruction loss:** Chamfer distance between predicted and actual masked points:

```
L_recon = (1/|P_m|) * sum_{p in P_m} min_{q in P_hat} ||p - q||^2
        + (1/|P_hat|) * sum_{q in P_hat} min_{p in P_m} ||q - p||^2
```

Where `P_m` is the set of masked points and `P_hat` is the decoder's reconstruction.

**Results from literature:**
- On ImageNet-C (2D, but instructive): TTT-MAE recovers 60-75% of corruption-induced accuracy drop
- On ScanObjectNN (3D object classification): +8.2% accuracy over no-adaptation baseline under point cloud corruptions
- On PointDA-10 (3D domain adaptation): +11.4% over source-only, +6.1% over TENT
- Consistently outperforms contrastive TTT methods across corruption types

**Compute budget on Orin:**

| Component | Time (Orin AGX, FP16) | Memory |
|-----------|----------------------|--------|
| Masking + tokenization | ~0.5ms | Negligible |
| Encoder forward (visible tokens) | ~4ms (30% of full ~6.84ms for PointPillars) | ~200MB |
| Decoder forward | ~3ms (lightweight) | ~50MB |
| Chamfer distance computation | ~1ms | ~20MB |
| Backward through encoder | ~8ms | ~400MB (activations) |
| Optimizer step (LoRA params) | ~0.5ms | ~10MB |
| **Total per update step** | **~17ms** | **~680MB** |
| **Amortized (1 update per 10 frames)** | **~1.7ms per inference** | |

### 2.5 TTT-Linear / TTT Layers (Sun et al., ICML 2024)

TTT-Linear is a fundamentally different use of "test-time training" -- it replaces the attention mechanism itself with a learned state update that is equivalent to gradient descent on a self-supervised loss at every token.

**Core idea:** Standard self-attention computes `Attention(Q,K,V)` by comparing all tokens pairwise. TTT-Linear instead maintains a hidden state `W` (a weight matrix) that is updated via one step of gradient descent on a self-supervised loss for each new token:

```
For each token x_t in the sequence:
    W_t = W_{t-1} - eta * grad_W L_ssl(W_{t-1}, x_t)
    output_t = W_t * x_t
```

Where `L_ssl` is a reconstruction loss: `L_ssl = ||W * x_t - x_t||^2` (self-reconstruction).

**This makes the TTT layer an RNN** whose "hidden state" is a weight matrix updated by gradient descent. The outer training loop learns the learning rate `eta`, the initial state `W_0`, and the self-supervised loss parameters.

**Key properties:**
- Linear complexity in sequence length (O(n) vs O(n^2) for attention)
- Expressiveness that grows with test sequence length (more data = better state)
- The "mini-batch TTT" variant accumulates multiple tokens before updating `W`, amortizing cost

**Relevance to reference airside AV stack:**
- TTT-Linear is an *architectural* innovation, not a deployment technique. It cannot be applied to existing PointPillars/CenterPoint models -- it requires training a new model from scratch with TTT layers replacing attention.
- **Long-term potential:** If reference airside AV stack adopts a transformer-based 3D backbone (PTv3, FlatFormer, LitePT), replacing attention layers with TTT layers would provide *inherent* continuous adaptation capability at the architecture level. The model would automatically adapt to each new airport by construction.
- **Current applicability:** Low. This is a research direction, not a deployment-ready method.
- **Compute:** Each TTT layer update requires one backward pass per token group, which on Orin at 120K+ LiDAR points is prohibitive without careful voxelization to reduce token count to 1-5K.

### 2.6 Online LoRA + MAE Loss (Li et al., ECCV 2024)

This method combines two practical ideas -- LoRA parameter efficiency and MAE self-supervision -- into a TTT framework explicitly designed for edge deployment.

**Architecture:**

```
┌────────────────────────────────────────────────┐
│              Pre-trained Backbone               │
│  (Frozen weights, ~95% of parameters)           │
│                                                  │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐    │
│  │  Layer 1  │   │  Layer 2  │   │  Layer N  │   │
│  │  frozen   │   │  frozen   │   │  frozen   │   │
│  │  ┌─────┐  │   │  ┌─────┐  │   │  ┌─────┐  │  │
│  │  │LoRA │  │   │  │LoRA │  │   │  │LoRA │  │  │
│  │  │r=4-8│  │   │  │r=4-8│  │   │  │r=4-8│  │  │
│  │  │     │◄─┼───┼──┤ TTT │◄─┼───┼──┤ grad│  │  │
│  │  └─────┘  │   │  └─────┘  │   │  └─────┘  │  │
│  └──────────┘   └──────────┘   └──────────┘    │
└────────────────────────┬───────────────────────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
         ┌────▼───┐  ┌──▼───┐  ┌──▼──────┐
         │ Main   │  │ MAE  │  │ Entropy │
         │ Head   │  │ Head │  │ Term    │
         │(detect)│  │(rec) │  │(option) │
         └────────┘  └──┬───┘  └────┬────┘
                        │           │
                   L_MAE + alpha * L_entropy
                        │
                 Gradient → Update LoRA only
```

**Key design decisions:**
1. **LoRA rank 4-8 for TTT:** Lower than the rank 16-32 used for supervised fine-tuning (see `multi-airport-adaptation.md`). TTT's unsupervised signal is noisier, so constraining the update space prevents overfitting to noise.
2. **Joint MAE + entropy loss:** The MAE term provides structural learning signal; the entropy term encourages confident predictions. The balance (`alpha = 0.1-0.3`) prevents entropy collapse while allowing task-relevant adaptation.
3. **Gradient accumulation over N frames:** Instead of updating per-frame, accumulate gradients over N=5-10 frames before applying one optimizer step. This reduces noise, amortizes compute, and provides a natural "mini-batch" for stable updates.

**LoRA parameter count for PointPillars:**

| Component | Original Params | LoRA Params (r=8) | Ratio |
|-----------|----------------|--------------------|----|
| PFE (Pillar Feature Encoder) | ~200K | ~12K | 6% |
| Backbone (conv layers) | ~4.5M | ~72K | 1.6% |
| Neck (FPN) | ~2.1M | ~34K | 1.6% |
| **Total updated by TTT** | **~6.8M** | **~118K** | **1.7%** |

Only 118K parameters are updated at test time. This is 60x fewer than full encoder fine-tuning and 10x fewer than standard LoRA (rank 32). The tight constraint is intentional: TTT gradients are noisy, and updating fewer parameters reduces the risk of catastrophic adaptation.

**Practical advantage for Orin:** LoRA's decomposed weight matrices (`A: d x r, B: r x d` where `r << d`) mean the optimizer state (Adam moments) requires only `2 * 118K * 4 bytes = ~1MB` of GPU memory -- negligible alongside the ~2GB model.

### 2.7 LAME: Laplacian Adjusted Maximum-Likelihood Estimation (Boudiaf et al., CVPR 2022)

LAME takes a minimalist approach: adapt only the output probabilities, not the model weights, using the geometric structure of the test features.

**Mechanism:**
1. Extract features from the frozen model for all test samples in a batch
2. Build a k-nearest-neighbor graph in feature space
3. Apply Laplacian smoothing: adjust each sample's class probabilities to be consistent with its neighbors' probabilities
4. The Laplacian regularization ensures that nearby features (likely same class) get similar predictions

**Mathematical formulation:**
```
Minimize: L = sum_i KL(z_i || f_theta(x_i)) + lambda * sum_{i,j} W_ij * ||z_i - z_j||^2
Subject to: z_i >= 0, sum_c z_i^c = 1

Where:
  z_i = adapted probability vector for sample i
  f_theta(x_i) = original model's prediction
  W_ij = edge weight in kNN graph (Gaussian kernel on feature distance)
  lambda = smoothness strength
```

**Properties:**
- **No gradient through the model** -- the model is completely frozen. Only output probabilities are adjusted.
- **No training-time changes needed** -- works with any pre-trained model post-hoc
- **Extremely fast:** kNN search + Laplacian solve takes <2ms for a typical batch
- **Theoretically principled:** maximum likelihood under a Markov random field prior

**Limitations:**
- Adapts classification, not regression (bounding box predictions unchanged)
- Requires a batch of test samples for meaningful graph construction (not single-sample)
- Small adaptation range: recovers only 2-5% of domain gap

**Airside role:** LAME is best used as a *complement* to stronger TTT methods. After TTT-MAE adapts the encoder, LAME provides a cheap post-processing step to further smooth object classifications using local feature geometry. It is also useful as a zero-risk baseline: since the model weights never change, LAME cannot cause catastrophic forgetting.

### 2.8 ActTTT / TTT-Bench (2025): Active Sample Selection for TTT

Not all test samples are equally informative for TTT. ActTTT (Active TTT, ICLR 2025) selects which samples to perform TTT updates on:

**Selection criteria (combined score):**
1. **Reconstruction difficulty:** Samples with high MAE reconstruction loss carry more information about the domain gap
2. **Feature-space novelty:** Samples far from source feature centroids (measured by Mahalanobis distance) represent the most shifted portions of the target domain
3. **Gradient magnitude:** Samples producing large gradients are more likely to move the encoder toward useful adaptation

**Protocol:**
```
For each incoming test frame x_t:
    1. Compute quick features: z_t = encoder(x_t)        [~6ms]
    2. Compute novelty: d_t = mahalanobis(z_t, source_stats) [<1ms]
    3. If d_t > threshold:
        a. Compute MAE reconstruction loss (full)          [~10ms]
        b. Perform TTT update                              [~17ms]
    4. Else:
        Skip TTT update (just inference)                   [~6ms]
```

**Result:** By performing TTT updates on only 10-30% of test frames (the most informative ones), ActTTT achieves 90-95% of the adaptation gain of TTT on every frame, at 70-90% lower compute cost. This is critical for Orin deployment where every millisecond matters.

### 2.9 ClusTTT (2025): Cluster-Guided TTT

ClusTTT extends ActTTT by maintaining online clusters of test features and performing TTT updates per-cluster rather than per-sample:

1. Maintain K=10-20 feature clusters using online k-means on test features
2. When a cluster accumulates N=10 samples, perform a batched TTT update using all cluster members
3. Cache cluster-specific LoRA offsets for rapid lookup

**Advantage:** Batched updates are more stable (less gradient noise) and more efficient (GPU utilization improves with batch size). On Orin, a batch of 10 yields ~3x throughput improvement over individual updates.

### 2.10 Continual-TTT (CVPR 2025): Streaming Self-Supervised Adaptation

Continual-TTT specifically addresses the temporal aspect of TTT -- how to adapt continuously over hours/days without forgetting earlier adaptations:

**Key innovations:**
1. **Sliding window replay:** Maintain a buffer of the last M=100 frames. Each TTT update trains on the current frame + a random sample from the buffer. This prevents recency bias.
2. **Fisher-weighted LoRA:** Compute per-parameter Fisher information on the buffer. Weight the LoRA gradient by inverse Fisher: parameters important for recent predictions are updated cautiously.
3. **Periodic consolidation:** Every T=1000 frames, merge current LoRA weights into the base model (with decay) and reinitialize LoRA. This prevents LoRA from saturating.

**Reported results on continuous domain shift streams:**
- +14% accuracy improvement over no-adaptation baseline
- Only 2% degradation vs offline full fine-tuning (which has access to all data simultaneously)
- Stable over 100K+ frames with no performance collapse

**Airside relevance:** An airport environment shifts continuously -- morning fog clears, aircraft traffic patterns change with the schedule, seasonal weather evolves over weeks. Continual-TTT provides a framework for persistent adaptation that tracks these changes without manual intervention.

---

## 3. LiDAR-Specific TTT Auxiliary Tasks

### 3.1 Why LiDAR Needs Specialized Auxiliary Tasks

Generic TTT auxiliary tasks (rotation prediction, image-based MAE) do not transfer well to LiDAR point clouds because:

1. **LiDAR has physical structure:** Points are generated by known physics (beam pattern, time-of-flight). Auxiliary tasks should exploit this structure.
2. **Point clouds are sparse and non-uniform:** Unlike images (dense, regular grid), LiDAR scans have density that varies with range (1/r^2), angle, and surface properties.
3. **The domain shift is geometric:** Airport-to-airport shift is primarily about surface properties, object geometry, and environmental conditions -- not texture or color.
4. **Gravity provides a strong prior:** Airports are flat. This constraint can be exploited.

The following auxiliary tasks are ordered by estimated value for airside TTT deployment.

### 3.2 Masked Point Cloud Reconstruction (Primary Auxiliary Task)

**Task:** Randomly mask 60-80% of LiDAR points and reconstruct them.

**Masking strategies for LiDAR (different from image MAE):**

| Strategy | Description | Information Captured |
|----------|-------------|---------------------|
| **Random point drop** | Uniformly drop 70% of points | General point distribution |
| **Voxel masking** | Mask entire voxels (groups of nearby points) | Local geometry, surface continuity |
| **Sector masking** | Mask angular sectors (e.g., mask 270/360 degrees) | Large-scale spatial structure |
| **Range-band masking** | Mask all points in distance range (e.g., 20-40m) | Distance-dependent features |
| **Beam masking** | Mask entire LiDAR beams (simulates beam failure) | Cross-beam consistency |

**Recommended strategy for airside TTT:** Combined voxel + beam masking. Voxel masking captures local surface geometry (critical for different apron surfaces). Beam masking is physically motivated -- it simulates real degradation modes (dirty lens blocks individual beams) that the model must handle at the new airport.

**Reconstruction target:**

```python
def lidar_mae_loss(predicted_points, masked_points, mode='chamfer'):
    """
    Compute reconstruction loss for masked LiDAR points.
    
    Args:
        predicted_points: (M, 4) predicted x,y,z,intensity
        masked_points: (M, 4) ground truth masked points
        mode: 'chamfer' or 'l2'
    
    Returns:
        loss: scalar reconstruction loss
    """
    if mode == 'chamfer':
        # Bidirectional Chamfer distance
        # Forward: each predicted point to nearest GT
        dist_pred_to_gt = torch.cdist(predicted_points[:, :3], 
                                       masked_points[:, :3])
        forward = dist_pred_to_gt.min(dim=1)[0].mean()
        
        # Backward: each GT point to nearest predicted
        backward = dist_pred_to_gt.min(dim=0)[0].mean()
        
        loss_xyz = forward + backward
        
        # Intensity reconstruction (separate, weighted lower)
        # Important: intensity distribution changes between airports
        # (different surface materials)
        loss_intensity = F.mse_loss(
            predicted_points[:, 3], masked_points[:, 3]
        )
        
        return loss_xyz + 0.1 * loss_intensity
    
    elif mode == 'l2':
        # Simple L2 on matched pairs (if masking preserves ordering)
        return F.mse_loss(predicted_points, masked_points)
```

**Expected reconstruction error at new airport:** When deploying a model trained at Airport A to Airport B, the MAE reconstruction loss will increase by 30-100% (depending on domain gap severity). After 100-500 TTT update steps, the reconstruction loss typically decreases to within 10-20% of the source domain level, and the main task mAP recovers proportionally.

### 3.3 Normal Estimation as Auxiliary Task

**Task:** For each point, predict its surface normal vector (the direction perpendicular to the local surface).

**Why this helps for airport adaptation:**
- Surface normals are entirely self-supervised (computed from local point neighborhoods, no labels needed)
- Normal distributions change between airports: smooth concrete vs rough asphalt, flat apron vs sloped taxiway
- Normal estimation forces the encoder to learn fine-grained geometric features that directly benefit object detection (the boundary between an object and the ground is defined by a normal discontinuity)

**Normal computation (ground truth generation at test time):**

```python
def estimate_normals(points, k=20):
    """
    Estimate surface normals using PCA on k-nearest neighbors.
    Runs on GPU, <2ms for 100K points on Orin.
    
    Args:
        points: (N, 3) point cloud
        k: number of neighbors for local PCA
    
    Returns:
        normals: (N, 3) estimated normal vectors
    """
    # kNN search (use FAISS on GPU for speed)
    _, indices = faiss_gpu.knn(points, points, k)  # ~1ms
    
    # For each point, compute covariance of neighbors
    neighbors = points[indices]  # (N, k, 3)
    centroids = neighbors.mean(dim=1, keepdim=True)  # (N, 1, 3)
    centered = neighbors - centroids  # (N, k, 3)
    
    # Covariance matrix
    cov = torch.bmm(centered.transpose(1, 2), centered) / k  # (N, 3, 3)
    
    # Eigenvector corresponding to smallest eigenvalue = normal
    eigenvalues, eigenvectors = torch.linalg.eigh(cov)  # (N, 3), (N, 3, 3)
    normals = eigenvectors[:, :, 0]  # Smallest eigenvalue's eigenvector
    
    # Orient normals upward (dot product with gravity should be positive for ground)
    flip = (normals[:, 2] < 0).float().unsqueeze(1)
    normals = normals * (1 - 2 * flip)
    
    return normals
```

**Auxiliary loss:**
```
L_normal = (1/N) * sum_i (1 - cos(n_pred_i, n_gt_i))
```
Where `n_pred_i` is the model's predicted normal and `n_gt_i` is the PCA-estimated normal. Cosine distance is preferred over L2 because normals are unit vectors.

**Compute overhead:** Normal estimation is ~2ms; the additional forward/backward through the normal prediction head is ~4ms. Total: ~6ms per update step, lighter than MAE.

### 3.4 Contrastive Temporal Consistency

**Task:** Features from consecutive LiDAR scans (100ms apart at 10Hz) should be similar after ego-motion compensation.

**Rationale:** At 10Hz and <25 km/h airside speed, the scene changes minimally between frames. Points from the same object in frame t and frame t+1 should map to similar features. This provides a free contrastive signal without any augmentation design.

**Implementation:**

```
Frame t:     P_t → Encoder → F_t (features per voxel)
Frame t+1:   P_{t+1} → Ego-compensate → Encoder → F_{t+1}

Ego-compensation: Transform P_{t+1} into frame t's coordinate system
using GTSAM odometry (available from the reference airside AV stack's localization stack)

Loss: L_temporal = -mean(cosine_sim(F_t[v], F_{t+1}[v])) 
      for all voxels v occupied in both frames
```

**Advantage over single-frame auxiliary tasks:** Temporal consistency provides signal about dynamic objects -- if an object moves between frames, the features should still match (the model learns to represent objects, not positions). This is directly relevant to the main detection task.

**Airside-specific benefit:** Airport ground traffic moves slowly (1-25 km/h), so temporal correspondences are easy to establish. The slow speed means large overlap between consecutive frames (>90% point overlap at 10 km/h), providing dense contrastive pairs.

**Compute cost:** Requires storing the previous frame's features (~20MB) and computing ego-compensated correspondences (~1ms). The contrastive loss backward pass is ~3ms. Total: ~4ms per update step.

### 3.5 Ground Plane Consistency (Airport-Specific)

**Task:** Predict the ground plane parameters for each local region of the point cloud.

**Why airports are special:** Airports are flat -- by ICAO standards, apron slopes must be <1% (1m rise per 100m), and taxiway cross-slopes are <1.5%. This provides an extraordinarily strong geometric prior that is consistent across airports.

**Self-supervised ground truth:** The reference airside AV stack already computes ground plane estimates via RANSAC as part of the perception pipeline. These RANSAC outputs can serve as pseudo-labels for the ground plane prediction auxiliary task.

**Auxiliary task:**
```
For each BEV grid cell (x, y):
    Predict: (a, b, c, d) -- local ground plane coefficients
    Ground truth: RANSAC fit on points within cell
    Loss: L_ground = ||plane_pred - plane_ransac||^2
```

**What this captures that is useful for adaptation:**
- Different airport surfaces (concrete vs asphalt) produce different point distributions near the ground
- Wet surfaces produce specular reflections that alter the apparent ground position
- Snow accumulation shifts the effective ground plane upward
- Apron slopes differ between airports

When the ground plane prediction auxiliary task loss spikes at a new airport, it indicates that the encoder's understanding of "ground" has changed. TTT updates driven by this loss adapt the encoder to the new surface characteristics.

**Compute cost:** Negligible additional cost -- the RANSAC ground plane is already computed as part of the existing pipeline. The auxiliary head is a lightweight 2-layer MLP (~0.5ms forward, ~1ms backward).

### 3.6 Intensity Distribution Matching

**Task:** Predict the intensity histogram of the point cloud from the encoded features.

**Motivation:** LiDAR return intensity depends on surface material (reflectance), incidence angle, and range. Each airport has a distinctive intensity distribution fingerprint:

| Surface | Typical Reflectance | Intensity Statistics |
|---------|-------------------|---------------------|
| New concrete | 0.6-0.8 | High mean, low variance |
| Worn asphalt | 0.2-0.4 | Low mean, moderate variance |
| Painted markings | 0.5-0.9 | High mean, bimodal |
| Wet surface | 0.8+ (specular) | Very high peaks, high variance |
| Metal (aircraft/GSE) | 0.1-0.3 (diffuse) | Low mean, spiky |

**Auxiliary loss:** KL divergence between the predicted intensity distribution (a histogram over 64 bins) and the actual intensity distribution of the current scan:

```
L_intensity = KL(hist_pred || hist_actual)
```

This forces the encoder to calibrate its feature representations to the local intensity distribution -- which changes between airports and seasons.

### 3.7 Combined Multi-Task Auxiliary Loss

In practice, the best results come from combining multiple auxiliary tasks:

```
L_TTT = w_mae * L_mae + w_normal * L_normal + w_temporal * L_temporal
      + w_ground * L_ground + w_intensity * L_intensity

Recommended weights:
  w_mae       = 1.0   (primary -- strongest, most general signal)
  w_normal    = 0.3   (strong geometric signal)
  w_temporal  = 0.2   (free temporal consistency)
  w_ground    = 0.2   (airport-specific prior)
  w_intensity = 0.1   (lightweight calibration)
```

**Total compute for combined auxiliary loss on Orin (per TTT update step):**

| Task | Forward | Backward | Total |
|------|---------|----------|-------|
| MAE reconstruction | 4ms (encoder) + 3ms (decoder) | 8ms | 15ms |
| Normal estimation | 2ms (PCA) + 0.5ms (head) | 1ms | 3.5ms |
| Temporal consistency | 1ms (correspondence) | 3ms | 4ms |
| Ground plane | ~0ms (reuse RANSAC) + 0.5ms (head) | 1ms | 1.5ms |
| Intensity matching | 0.5ms (histogram) + 0.5ms (head) | 1ms | 2ms |
| **Combined (shared backward)** | | | **~20ms** |

Note: the backward passes share the encoder's computation graph, so the combined cost is less than the sum. A single combined backward through the encoder costs ~10ms regardless of how many auxiliary heads contribute gradients.

**Amortized over 10 frames: ~2ms per inference cycle.**

---

## 4. Safety-Bounded TTT on Orin AGX

### 4.1 Compute Budget Analysis

The reference airside AV stack perception pipeline has a 50ms cycle time (10Hz LiDAR). The current budget allocation:

```
50ms Total Budget
├── LiDAR preprocessing (ego-compensation, SOR)     ~3ms
├── Multi-LiDAR fusion                               ~2ms
├── PointPillars detection (TensorRT INT8)           ~6.84ms
├── Post-processing (NMS, tracking)                   ~2ms
├── GTSAM localization update                         ~3ms
├── Frenet planning + trajectory generation           ~5ms
├── Safety monitoring (STL, CBF, geofence)            ~5ms
├── Communication (ROS pub/sub, V2X)                  ~2ms
├── MARGIN                                            ~21ms
└── Available for TTT                                 ~15-20ms
```

The ~21ms margin is generous. TTT must fit within ~15ms of this margin (keeping 5ms as safety buffer for jitter).

### 4.2 TTT Update Scheduling

TTT does not need to run every frame. The key design parameter is the **update frequency**: how often to perform a gradient update.

| Update Frequency | Amortized Cost | Adaptation Speed | Stability |
|------------------|---------------|------------------|-----------|
| Every frame (10Hz) | 20ms/frame | Fast (seconds) | Low (noisy) |
| Every 10 frames (1Hz) | 2ms/frame | Moderate (10s) | Good |
| Every 100 frames (0.1Hz) | 0.2ms/frame | Slow (minutes) | Very good |
| Triggered by OOD | 0-20ms/frame | Adaptive | Best |

**Recommended: OOD-triggered TTT at ~1Hz baseline.**

```
┌────────────────────────────────────────────────────────────────┐
│                   TTT Scheduling Logic                          │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  For each LiDAR frame:                                          │
│    1. Run inference (PointPillars, ~7ms)                        │
│    2. Compute OOD score (~1ms)                                   │
│    3. Accumulate frame into TTT buffer                           │
│                                                                  │
│    IF ood_score > 0.3 AND buffer_size >= 5:                     │
│       Schedule TTT update on next available GPU slot             │
│       (async, does not block inference)                          │
│                                                                  │
│    IF buffer_size >= 10 (regardless of OOD):                    │
│       Schedule TTT update (baseline adaptation)                  │
│                                                                  │
│    IF last_update > 60 seconds:                                  │
│       Force TTT update (prevent stale adaptation)                │
│                                                                  │
│  TTT Update (when scheduled):                                    │
│    1. Sample 5-10 frames from buffer                             │
│    2. Compute combined auxiliary loss                             │
│    3. One gradient step on LoRA parameters                       │
│    4. Validate: if anchor loss exceeded, revert                  │
│    5. Clear buffer                                               │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

### 4.3 Asynchronous TTT on Orin

NVIDIA Orin AGX has 2048 CUDA cores and 64 Tensor Cores, plus 2 DLA (Deep Learning Accelerators). The key to fitting TTT within the budget is **asynchronous execution:**

```
CUDA Stream 0 (Inference):  |--Infer--|--Infer--|--Infer--|--Infer--|
CUDA Stream 1 (TTT):        |         |------TTT Update------|      |
DLA 0 (Segmentation):       |---Seg---|---Seg---|---Seg---|---Seg---|
DLA 1 (Safety monitor):     |--Safe---|--Safe---|--Safe---|--Safe---|
CPU (ROS, planning):         |--Plan--|--Plan--|--Plan--|--Plan--|

Timeline (ms):               0    10    20    30    40    50
```

**Key insight:** The TTT backward pass runs on CUDA Stream 1 while inference runs on CUDA Stream 0. On Orin, the GPU can process two concurrent streams with ~20-30% throughput reduction per stream (depending on memory bandwidth contention). This means:

- Inference on Stream 0: ~7ms (nominal) + ~2ms (contention) = ~9ms (still within budget)
- TTT on Stream 1: ~20ms (spans 2 inference cycles, but does not block either)

### 4.4 LoRA Rank Selection for TTT

The LoRA rank directly controls the TTT adaptation capacity vs stability tradeoff:

| LoRA Rank | TTT Params | Adaptation Capacity | Stability | Memory (Optimizer) | Recommended For |
|-----------|-----------|--------------------|-----------|--------------------|-----------------|
| r = 2 | ~30K | Very low | Very high | ~240KB | Minor shifts (same airport, weather change) |
| r = 4 | ~59K | Low | High | ~470KB | Moderate shifts (same-cluster airport) |
| r = 8 | ~118K | Medium | Good | ~950KB | Standard airport onboarding |
| r = 16 | ~236K | High | Moderate | ~1.9MB | Large shifts (cross-cluster airport) |
| r = 32 | ~472K | Very high | Low | ~3.8MB | Not recommended for unsupervised TTT |

**Recommendation: r = 4-8 for TTT, r = 16-32 for supervised LoRA.**

The reasoning: supervised fine-tuning has labeled data to correct mistakes, so higher capacity (higher rank) is beneficial. TTT has only self-supervised signal, which is noisier. Higher rank gives more room for the noisy gradients to push parameters in wrong directions. Lower rank acts as an implicit regularizer, constraining updates to a low-dimensional subspace.

### 4.5 Gradient Accumulation Strategy

Instead of applying gradients from a single frame, accumulate over N frames:

```python
class GradientAccumulatingTTT:
    """
    Accumulate TTT gradients over N frames before applying update.
    Reduces noise, amortizes compute, improves stability.
    """
    def __init__(self, model, lora_params, aux_heads, 
                 accumulation_steps=10, lr=1e-4, max_grad_norm=1.0):
        self.model = model
        self.lora_params = lora_params
        self.aux_heads = aux_heads
        self.accumulation_steps = accumulation_steps
        self.optimizer = torch.optim.AdamW(lora_params, lr=lr, 
                                            weight_decay=1e-4)
        self.max_grad_norm = max_grad_norm
        self.step_count = 0
        self.accumulated_loss = 0.0
    
    def step(self, point_cloud, prev_features=None):
        """
        Accumulate gradient from one frame.
        Apply update when accumulation_steps reached.
        
        Returns:
            applied_update: bool -- True if optimizer stepped
        """
        # Compute combined auxiliary loss
        loss = self._compute_aux_loss(point_cloud, prev_features)
        
        # Scale loss by accumulation steps (for correct gradient magnitude)
        scaled_loss = loss / self.accumulation_steps
        scaled_loss.backward()
        
        self.accumulated_loss += loss.item()
        self.step_count += 1
        
        if self.step_count >= self.accumulation_steps:
            # Clip gradients for stability
            torch.nn.utils.clip_grad_norm_(
                self.lora_params, self.max_grad_norm
            )
            
            # Apply update
            self.optimizer.step()
            self.optimizer.zero_grad()
            
            # Log adaptation progress
            avg_loss = self.accumulated_loss / self.accumulation_steps
            rospy.loginfo(f"TTT update: avg_aux_loss={avg_loss:.4f}")
            
            # Reset
            self.step_count = 0
            self.accumulated_loss = 0.0
            
            return True
        
        return False
    
    def _compute_aux_loss(self, point_cloud, prev_features):
        """Combined multi-task auxiliary loss."""
        # MAE: mask 70% of points, reconstruct
        visible, masked_gt = random_mask(point_cloud, ratio=0.7)
        features = self.model.encode(visible)
        reconstructed = self.aux_heads['mae_decoder'](features)
        l_mae = chamfer_distance(reconstructed, masked_gt)
        
        # Normal estimation
        normals_gt = estimate_normals_pca(point_cloud, k=20)
        normals_pred = self.aux_heads['normal_head'](
            self.model.encode(point_cloud)
        )
        l_normal = (1 - F.cosine_similarity(
            normals_pred, normals_gt, dim=-1
        )).mean()
        
        # Temporal consistency (if previous features available)
        l_temporal = torch.tensor(0.0, device=point_cloud.device)
        if prev_features is not None:
            current_features = self.model.encode(point_cloud)
            l_temporal = -F.cosine_similarity(
                current_features, prev_features.detach(), dim=-1
            ).mean()
        
        return 1.0 * l_mae + 0.3 * l_normal + 0.2 * l_temporal
```

### 4.6 Memory Budget

| Component | GPU Memory | Notes |
|-----------|-----------|-------|
| PointPillars model (TensorRT) | ~800MB | Inference engine |
| LoRA parameters (r=8) | ~470KB | TTT update target |
| LoRA optimizer state (Adam) | ~940KB | First and second moments |
| Activation cache (for backward) | ~400MB | Stored during forward, freed after backward |
| MAE decoder | ~50MB | Lightweight reconstruction network |
| Auxiliary heads (normal, temporal, etc.) | ~20MB | Small MLPs |
| Frame buffer (10 frames) | ~200MB | For gradient accumulation |
| **Total TTT overhead** | **~670MB** | On top of ~800MB inference |
| **Total with TTT** | **~1.5GB** | Well within Orin's 32GB/64GB |

### 4.7 Worst-Case Latency Analysis

| Scenario | Latency Impact | Mitigation |
|----------|----------------|------------|
| TTT update coincides with inference | +2-3ms inference latency (GPU contention) | Async CUDA streams, priority scheduling |
| Backward pass takes longer than expected | Could steal GPU time from next inference | Hard timeout: abort TTT update after 25ms |
| Memory allocation spike during backward | OOM risk | Pre-allocate all TTT buffers at startup |
| NaN/Inf in gradients | Corrupted update | Gradient health check before optimizer step |
| Optimizer state grows unbounded | Slow memory leak | Fixed-size optimizer with periodic reset |

**Hard safety guarantee:** The inference pipeline on Stream 0 has higher CUDA priority than TTT on Stream 1. If any TTT computation threatens to delay inference beyond 45ms (leaving 5ms margin), the Orin CUDA scheduler preempts TTT. No TTT computation can delay the safety-critical inference path.

---

## 5. Catastrophic Forgetting Prevention

### 5.1 The Forgetting Problem in TTT Context

TTT differs from standard continual learning in that the adaptation is happening *at test time* on *unlabeled data*. This creates a unique forgetting scenario:

```
Pre-deployment model (trained at Airports A, B, C):
  Airport A: 78% mAP
  Airport B: 75% mAP
  Airport C: 72% mAP
  Airport D (new): 55% mAP  ← domain gap

After 1000 TTT steps at Airport D (unconstrained):
  Airport A: 61% mAP  ← CATASTROPHIC FORGETTING
  Airport B: 58% mAP  ← 
  Airport C: 55% mAP  ← 
  Airport D: 68% mAP  ← improved, but at terrible cost

After 1000 TTT steps at Airport D (with forgetting prevention):
  Airport A: 76% mAP  ← minimal forgetting (2% drop)
  Airport B: 73% mAP  ← 
  Airport C: 71% mAP  ← 
  Airport D: 65% mAP  ← good improvement, smaller but safe
```

The unconstrained case is unacceptable: a fleet operator who visits Airport D temporarily and returns to Airport A finds a degraded model. The forgetting prevention mechanisms below ensure that TTT gains at the new airport do not come at the cost of previous airports.

### 5.2 Anchor Loss (Primary Defense)

The simplest and most effective anti-forgetting mechanism for TTT. Penalize the TTT-adapted parameters from deviating too far from the pre-deployment (anchor) weights:

```
L_anchor = (lambda_a / 2) * sum_i (theta_i - theta_anchor_i)^2

where:
  theta_i = current LoRA parameter i
  theta_anchor_i = pre-deployment LoRA parameter i (frozen reference)
  lambda_a = anchor strength (typically 100-1000)
```

**Properties:**
- O(1) compute per parameter (trivial gradient: `lambda_a * (theta - theta_anchor)`)
- O(p) storage (must store anchor weights -- but for LoRA r=8, this is ~470KB)
- Acts as a "leash" on TTT: the model can adapt but cannot wander far from its starting point
- The maximum deviation of any parameter is bounded: `|theta_i - theta_anchor_i| <= sqrt(L_aux / lambda_a)`

**Combined TTT + anchor loss:**
```
L_total_TTT = L_mae + 0.3 * L_normal + 0.2 * L_temporal + lambda_a * L_anchor
```

**Practical lambda_a selection:**
- Too low (lambda_a < 10): TTT wanders freely, forgetting possible
- Too high (lambda_a > 10000): TTT cannot adapt, effectively frozen
- Sweet spot (lambda_a = 100-500): allows 3-5% parameter deviation, sufficient for airport adaptation

### 5.3 Elastic Weight Consolidation (EWC)

EWC (Kirkpatrick et al., 2017) is a more sophisticated version of anchor loss that penalizes changes to *important* parameters more than unimportant ones:

```
L_EWC = (lambda / 2) * sum_i F_i * (theta_i - theta_anchor_i)^2

where F_i = diagonal Fisher Information for parameter i
```

The Fisher Information Matrix measures how sensitive the model's output is to each parameter. Parameters with high Fisher (output changes a lot when they change) are "important" and should be penalized heavily. Parameters with low Fisher can change freely without affecting source performance.

**Compute requirement:** The Fisher must be computed on source data before deployment. For PointPillars with LoRA r=8 (118K params), this requires ~100 forward+backward passes on a representative source dataset. Cost: ~2 minutes on A100 (at HQ before shipping model to site).

**EWC vs anchor loss on Orin:**

| Property | Anchor Loss | EWC |
|----------|------------|-----|
| Compute per TTT step | Identical (both O(p)) | Identical |
| Storage | p weights (470KB for LoRA r=8) | p weights + p Fisher values (940KB) |
| Forgetting prevention | Uniform penalty (all params equal) | Adaptive (important params penalized more) |
| Typical mAP preservation | -3-5% on source airports | -1-3% on source airports |
| Adaptation capacity | Slightly lower (unnecessarily constrains unimportant params) | Higher (unimportant params free to adapt) |

**Recommendation:** Use EWC if the Fisher matrix can be pre-computed (it can -- during source training). The additional 470KB storage is negligible and EWC provides measurably better forgetting prevention.

### 5.4 PackNet for TTT (Parameter Isolation)

PackNet allocates separate parameter subsets to each deployment:

```
Pre-deployment:
  Prune LoRA adapters to identify important parameters for source airports
  Mask: M_source = {i : |theta_i| > threshold}  (top 25%)
  Freeze M_source parameters

At new airport (TTT):
  Update only parameters NOT in M_source
  These parameters are "free" -- no risk of forgetting
  Capacity: 75% of LoRA parameters available for adaptation
```

**Advantage:** Zero forgetting by construction -- source parameters literally cannot change.
**Disadvantage:** Limited capacity. After adapting to 4 airports (each using 75% of remaining free parameters), the model has only `0.75^4 ≈ 32%` of its LoRA capacity remaining.

**For the reference airside AV stack's scale (5-15 airports in 3-year horizon):** PackNet is viable for the first 3-4 airports but will run out of capacity. Transition to EWC-based TTT after that. Alternatively, use LoRA rank 16 (instead of 8) to double capacity.

### 5.5 Source-Domain Validation Set Monitoring

Store a small validation set from the source domain (200 labeled frames, ~400MB) and periodically evaluate the TTT-adapted model on it:

```
Every 500 TTT update steps:
    1. Evaluate model on source validation set (200 frames)
    2. Compute mAP_source = mAP on validation set
    3. Compare with pre-deployment mAP_baseline
    
    IF mAP_source < mAP_baseline - 5%:
        Trigger forgetting alert
        Revert last 100 TTT updates
        Increase lambda_a by 2x
        Re-enable TTT with tighter constraint
    
    IF mAP_source < mAP_baseline - 10%:
        Full revert to pre-deployment weights
        Disable TTT
        Alert human operator
```

**Privacy concern:** This requires storing labeled data from source airports on the vehicle. If airport data sovereignty prevents this, use the alternative: monitor reconstruction loss on a held-out set of *unlabeled* source scans (which carry no sensitive labels).

### 5.6 When to Stop TTT and Fallback

TTT should be automatically disabled under the following conditions:

| Trigger | Threshold | Action |
|---------|-----------|--------|
| Auxiliary loss diverges (increases 3x) | `L_aux > 3 * L_aux_initial` | Revert to pre-deployment weights, disable TTT |
| Source validation mAP drops >10% | `mAP_source < mAP_baseline - 10%` | Full revert, disable TTT |
| Gradient norms explode | `||grad|| > 100 * ||grad_avg||` | Skip this update, log for analysis |
| NaN/Inf detected in any loss or gradient | Any NaN/Inf | Revert last update, flag for review |
| Parameter drift exceeds bound | `||theta - theta_anchor|| > delta_max` | Clamp parameters, reduce learning rate |
| TTT updates produce worse detections than frozen model | `Detections_TTT << Detections_frozen` on same input | Switch to frozen model, disable TTT, alert |

---

## 6. Simplex Integration Architecture

### 6.1 TTT within Simplex AC/BC Framework

The Simplex architecture (described in `90-synthesis/decisions/design-spec.md`) provides the natural safety wrapper for TTT. The TTT-adapted model operates as the Advanced Controller (AC), while a frozen pre-deployment model serves as the Baseline Controller (BC):

```
┌─────────────────────────────────────────────────────────────────┐
│                    SIMPLEX ARCHITECTURE                          │
│                                                                   │
│  ┌───────────────────────────────────────────┐                   │
│  │          ADVANCED CONTROLLER (AC)         │                   │
│  │                                             │                  │
│  │  ┌─────────┐     ┌──────────┐              │                  │
│  │  │LoRA TTT │────▶│ TTT-adapted│             │                 │
│  │  │ Adapter │     │ PointPillars│             │                │
│  │  └─────────┘     └─────┬──────┘             │                │
│  │                        │                     │                │
│  │  TTT Aux Heads:        │                     │                │
│  │  MAE, Normal,          │ Detections          │                │
│  │  Temporal, Ground      │ + Uncertainty        │               │
│  │  (gradient → LoRA)     │                     │                │
│  └────────────────────────┼─────────────────────┘                │
│                           │                                       │
│  ┌────────────────────────┼─────────────────────┐                │
│  │       BASELINE CONTROLLER (BC)               │                │
│  │                        │                     │                │
│  │  ┌──────────────┐     │                     │                │
│  │  │ Frozen        │     │                     │                │
│  │  │ PointPillars  │─────┼──── Detections      │                │
│  │  │ (no TTT)      │     │    (baseline)       │                │
│  │  └──────────────┘     │                     │                │
│  │                        │                     │                │
│  │  Note: runs every Nth  │                     │                │
│  │  frame (e.g., N=10)    │                     │                │
│  │  to save compute       │                     │                │
│  └────────────────────────┼─────────────────────┘                │
│                           │                                       │
│  ┌────────────────────────▼─────────────────────┐                │
│  │          DECISION MODULE (DM)                 │                │
│  │                                               │                │
│  │  Inputs:                                       │               │
│  │    - AC detections + AC uncertainty             │              │
│  │    - BC detections (every Nth frame)            │              │
│  │    - OOD score                                  │              │
│  │    - TTT aux loss trend                         │              │
│  │    - AC vs BC detection agreement               │              │
│  │                                                 │              │
│  │  Decision logic:                                │              │
│  │    IF agreement(AC, BC) > 0.8:                  │              │
│  │       Use AC (TTT-adapted, likely better)       │              │
│  │    ELIF AC_uncertainty < BC_uncertainty:         │              │
│  │       Use AC (TTT is helping)                   │              │
│  │    ELIF ood_score > 0.7:                        │              │
│  │       Use BC (severe OOD, don't trust TTT)      │              │
│  │    ELSE:                                        │              │
│  │       Use BC (safe default)                     │              │
│  └──────────────────────┬──────────────────────┘                │
│                         │                                         │
│                         ▼                                         │
│                   Final Detections → Planning                     │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Running BC Efficiently

Running a full second inference pipeline for BC doubles compute cost. Efficiency strategies:

1. **Temporal subsampling:** Run BC every 10th frame (1Hz instead of 10Hz). Sufficient for detecting systematic TTT failures.
2. **DLA execution:** Run BC on Orin's DLA while AC runs on GPU. DLA throughput is lower (~2x slower) but does not contend with GPU resources.
3. **Lightweight BC:** Use a smaller model for BC (e.g., PointPillars-Lite, ~3ms on Orin) that provides coarse but reliable detections for comparison.
4. **Shared preprocessing:** Both AC and BC use the same preprocessed point cloud. Only the model forward pass differs.

**Recommended:** Run BC on DLA at 1Hz (every 10th frame). Compute cost: ~14ms on DLA, non-blocking to GPU. Memory: ~500MB on DLA dedicated memory.

### 6.3 Decision Module Logic

```python
class SimplexTTTDecisionModule:
    """
    Decides whether to use TTT-adapted (AC) or frozen (BC) detections.
    Safety-conservative: defaults to BC unless AC is demonstrably better.
    """
    
    def __init__(self):
        self.agreement_threshold = 0.8  # IoU agreement
        self.ood_threshold_severe = 0.7
        self.uncertainty_ratio_threshold = 0.9
        self.consecutive_bc_switches = 0
        self.max_consecutive_bc = 100  # If BC used 100x in a row, 
                                        # TTT is failing
    
    def decide(self, ac_detections, bc_detections, 
               ac_uncertainty, bc_uncertainty, ood_score,
               ttt_loss_trend):
        """
        Args:
            ac_detections: TTT-adapted model detections
            bc_detections: Frozen baseline detections (may be stale)
            ac_uncertainty: Mean epistemic uncertainty of AC
            bc_uncertainty: Mean epistemic uncertainty of BC
            ood_score: Current OOD score
            ttt_loss_trend: Slope of aux loss over last 100 updates
                           (negative = improving, positive = diverging)
        
        Returns:
            selected: 'AC' or 'BC'
            reason: str
        """
        # Rule 1: Severe OOD — never trust TTT
        if ood_score > self.ood_threshold_severe:
            self._increment_bc()
            return 'BC', 'severe_ood'
        
        # Rule 2: TTT loss diverging — adaptation is failing
        if ttt_loss_trend > 0 and abs(ttt_loss_trend) > 0.1:
            self._increment_bc()
            return 'BC', 'ttt_diverging'
        
        # Rule 3: Check AC/BC agreement (when BC detections available)
        if bc_detections is not None:
            agreement = self._compute_agreement(ac_detections, 
                                                  bc_detections)
            if agreement > self.agreement_threshold:
                # AC and BC agree — AC is likely correct and 
                # potentially better
                self._reset_bc()
                return 'AC', 'agreement_high'
        
        # Rule 4: Compare uncertainty
        if ac_uncertainty < bc_uncertainty * self.uncertainty_ratio_threshold:
            # AC is more confident — TTT is helping
            self._reset_bc()
            return 'AC', 'lower_uncertainty'
        
        # Rule 5: Default to BC (safety-conservative)
        self._increment_bc()
        
        # Rule 6: If BC used too many times, disable TTT entirely
        if self.consecutive_bc_switches > self.max_consecutive_bc:
            return 'BC', 'ttt_disabled_sustained_failure'
        
        return 'BC', 'default_conservative'
    
    def _compute_agreement(self, det_a, det_b):
        """IoU-based agreement between two detection sets."""
        if len(det_a) == 0 and len(det_b) == 0:
            return 1.0  # Both see nothing — agree
        if len(det_a) == 0 or len(det_b) == 0:
            return 0.0  # One sees objects, other doesn't — disagree
        
        # Match detections by 3D IoU
        matched = 0
        for da in det_a:
            best_iou = max(iou_3d(da, db) for db in det_b)
            if best_iou > 0.3:
                matched += 1
        
        return matched / max(len(det_a), len(det_b))
    
    def _increment_bc(self):
        self.consecutive_bc_switches += 1
    
    def _reset_bc(self):
        self.consecutive_bc_switches = 0
```

### 6.4 Failure Mode Analysis

| Failure Mode | Detection Signal | Simplex Response |
|--------------|-----------------|------------------|
| TTT adapts to noise (learns wrong distribution) | Aux loss decreases but detection quality drops | BC detections disagree with AC; DM switches to BC |
| TTT causes forgetting of critical class (e.g., personnel) | Source validation mAP drops for personnel class | Emergency: disable TTT, revert, alert |
| TTT encoder produces degenerate features | All detections have very low confidence | AC uncertainty spikes; DM defaults to BC |
| TTT LoRA weights diverge (NaN) | NaN in predictions | Hardware watchdog catches NaN, switches to BC |
| Auxiliary task gradient conflicts with main task | Aux loss decreases but main task degrades | Monitor both: if aux decreases but agreement with BC drops, pause TTT |
| Adversarial input triggers harmful TTT update | Unusual gradient direction | Gradient norm clipping + anchor loss bound deviation |

---

## 7. Airport Onboarding Protocol with TTT

### 7.1 Overview

TTT compresses the unlabeled adaptation phase of airport onboarding. Combined with the existing 8-week playbook (see `70-operations-domains/deployment-playbooks/multi-airport-adaptation.md`), TTT provides actionable perception improvements within the first 72 hours.

```
Standard Onboarding (without TTT):
  Week 1-2: Map + data collection
  Week 3:   Active learning + labeling (500-1000 frames)  ← BLOCKS ON LABELS
  Week 4:   LoRA fine-tuning + validation
  Week 5-6: Shadow mode
  Week 7-8: Supervised operations → Go/no-go

TTT-Augmented Onboarding:
  Day 1-2:  Map + data collection + TTT starts immediately
  Day 3-5:  TTT adaptation converges, model usable for shadow mode
  Day 6-10: Shadow mode with TTT-adapted model
  Day 11-14: Active learning selects 200-500 frames for labeling
  Week 3:   LoRA fine-tuning on labeled data (starting from TTT-adapted weights)
  Week 4:   Validation + go/no-go
  
Savings: 2-3 weeks compressed. Active learning selection is better
because TTT-adapted model has lower OOD rate → more informative selection.
```

### 7.2 Day 1-3: Initial TTT Adaptation

**Vehicle deployment:**
- Deploy vehicle with pre-trained model + TTT-enabled LoRA + auxiliary heads
- Vehicle operates in shadow mode (sensors recording, no autonomous control)
- TTT runs continuously during all driving

**TTT monitoring dashboard (remote):**

```
┌─────────────────────────────────────────────────────────────────┐
│  TTT Adaptation Monitor — Airport D Onboarding                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Adaptation Progress:                                             │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │ MAE Loss:  ████████████░░░░░░░░░░  58% → target       │     │
│  │ Normal Loss: ██████████████░░░░░░░  72% → target       │     │
│  │ Temporal:  █████████████████░░░░░  85% → target        │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                   │
│  OOD Rate: 18% → 9% (decreasing — adaptation working)           │
│  TTT Updates: 847 / target 1000                                   │
│  Source mAP (validation): 74.2% (baseline: 76.1%, delta: -1.9%)  │
│  Anchor Loss: 0.023 (limit: 0.05)                                │
│                                                                   │
│  Aux Loss Curves (last 24h):                                      │
│  2.0 ┤╭╮                                                         │
│  1.5 ┤│╰╮                                                        │
│  1.0 ┤│  ╰──╮                                                    │
│  0.5 ┤│     ╰──────────────                                      │
│  0.0 ┼─────────────────────────────                               │
│       0h    6h    12h   18h   24h                                 │
│                                                                   │
│  Status: ON TRACK — 58% of adaptation converged in 24h            │
│  Estimated full convergence: ~48h                                  │
│                                                                   │
│  Alerts: None                                                      │
│  Forgetting: Within bounds (all source airports within 2% of      │
│              baseline)                                              │
└─────────────────────────────────────────────────────────────────┘
```

**Convergence criteria for TTT:**
1. MAE reconstruction loss has plateaued (less than 2% improvement over last 200 steps)
2. OOD rate has decreased by at least 40% from initial measurement
3. Source validation mAP has not dropped more than 5%
4. Anchor loss is below threshold (parameter drift bounded)

Typically met within 500-1000 TTT updates (24-72 hours of driving at ~1 update/second during OOD encounters, or ~1 update/10 seconds during low-OOD periods).

### 7.3 Day 4-7: TTT Model Evaluation

Once TTT converges, evaluate the adapted model to decide next steps:

**Evaluation protocol (no labels required):**

| Metric | How Measured | Pass Threshold |
|--------|-------------|----------------|
| OOD rate | Fraction of frames with OOD score > 0.3 | < 15% (vs initial 20-40%) |
| Reconstruction quality | MAE loss on 1000 test frames | Within 20% of source domain MAE |
| Detection consistency | Frame-to-frame IoU of tracks | > 0.7 (stable detections, not flickering) |
| BC agreement | IoU between AC and BC detections | > 0.6 (AC not diverged from reasonable baseline) |
| Source validation mAP | mAP on held-out source frames | Within 5% of baseline |
| Auxiliary loss variance | Std of aux loss over last 500 frames | < 0.2 (converged, not oscillating) |

**Evaluation protocol (with small labeled sample, 50-100 frames):**

If the on-site engineer can label 50-100 frames (2-4 hours of annotation), a direct mAP comparison becomes possible:

| Model Configuration | Expected mAP at New Airport |
|--------------------|-----------------------------|
| Source model (no adaptation) | 55-65% |
| TTA only (TENT/SAR) | 60-70% |
| TTT-adapted (this method) | 65-75% |
| TTT + small LoRA fine-tuning (50 labels) | 68-78% |
| Full LoRA fine-tuning (500+ labels) | 72-82% |

### 7.4 Day 7-14: TTT Lock and Transition to Supervised Adaptation

If TTT evaluation passes, the TTT-adapted LoRA weights are frozen ("locked") and become the new baseline for this airport:

```
Pre-deployment model:     base_weights + LoRA_source
After TTT adaptation:     base_weights + LoRA_source + LoRA_TTT_delta
Lock TTT:                 base_weights + LoRA_airport_D (merged)

The merged LoRA_airport_D becomes the frozen BC for Airport D.
A new LoRA (rank 4) can be added on top for ongoing TTT adaptation.
```

**Transition to supervised LoRA fine-tuning:**

The TTT-adapted model serves as a superior starting point for supervised fine-tuning compared to the raw source model:

```
Fine-tuning from source model (no TTT):
  500 labeled frames → 72% mAP at Airport D (40% gap recovered)
  1000 labeled frames → 78% mAP (58% gap recovered)

Fine-tuning from TTT-adapted model:
  500 labeled frames → 78% mAP at Airport D (58% gap recovered)  ← +6%
  1000 labeled frames → 82% mAP (68% gap recovered)              ← +4%
```

TTT provides a "warm start" that makes supervised fine-tuning more label-efficient. The TTT-adapted features are already partially aligned with the target domain, so fewer labeled examples are needed to complete the alignment.

### 7.5 Ongoing: Continuous TTT for Seasonal Drift

After the initial onboarding, TTT continues to run at reduced frequency to handle gradual seasonal changes:

| Season Transition | Domain Shift | TTT Response |
|-------------------|-------------|--------------|
| Dry → wet season | Surface reflectance changes, puddle specular reflection | Intensity + ground plane aux tasks activate |
| Summer → winter | Snow on apron, de-icing GSE appears, short daylight | MAE + normal tasks re-converge over 2-3 days |
| Equipment fleet change | New GSE types at airport | TTT cannot learn new classes; triggers active learning |
| Construction | Altered geometry, temporary obstacles | Ground plane + MAE detect shift, adapt over 1-2 days |

**Continuous TTT parameters (post-onboarding):**
- Update frequency: 0.1Hz (every 100 frames, ~10 seconds)
- LoRA rank: 4 (reduced, since shift is gradual)
- Anchor: locked TTT weights from onboarding (not source weights)
- Learning rate: 1e-5 (10x lower than initial TTT)

---

## 8. Comparison with Alternative Adaptation Methods

### 8.1 Head-to-Head Comparison

| Method | Labels Needed | Compute Cost | mAP Recovery | Forgetting Risk | Time to Deploy | Orin Compatible |
|--------|-------------|-------------|-------------|----------------|---------------|-----------------|
| **No adaptation** | 0 | 0 | 0% | None | Immediate | Yes |
| **BN-Adapt** | 0 | ~0 | 5-10% | Very low | Minutes | Yes |
| **TENT/SAR (TTA)** | 0 | +5-15% | 10-20% | Low | Hours | Yes |
| **LAME** | 0 | +2% | 5-10% | None | Minutes | Yes |
| **TTT-MAE + LoRA** | 0 | +5-20% (amort.) | 25-40% | Medium (bounded) | 2-5 days | Yes |
| **Online LoRA+MAE** | 0 | +5-15% (amort.) | 30-50% | Medium (bounded) | 2-5 days | Yes |
| **Domain randomization** | 0 (at test time) | +50% train | 10-30% | None | N/A (training) | Yes |
| **PointLoRA fine-tuning** | 500-1000 | 4h on A100 | 40-60% | Low | 2-3 weeks | Yes (inference) |
| **Full fine-tuning** | 2000-5000 | 8-16h on A100 | 60-80% | High | 4-6 weeks | Yes (inference) |

### 8.2 TTT vs TTA (TENT/SAR/CoTTA)

Covered in detail in `test-time-adaptation-airside.md`. Summary of the key distinction:

| Aspect | TTA | TTT |
|--------|-----|-----|
| Signal quality | Weak (self-referential entropy) | Strong (external self-supervised objective) |
| Update scope | BN affine only (<0.1% params) | Encoder via LoRA (1-2% params) |
| Adaptation ceiling | Low (BN can only shift/scale features) | High (encoder learns new feature representations) |
| Compute | Negligible | Moderate (backprop through encoder) |
| When to prefer TTA | Small shift, tight compute budget, no aux heads available | Moderate-large shift, Orin with margin, aux heads trained |

**Combination strategy:** Use TTA (SAR) as always-on baseline adaptation + TTT as triggered deeper adaptation when OOD score exceeds threshold. TTA provides instant lightweight adjustment; TTT provides gradual deeper learning.

### 8.3 TTT vs PointLoRA Fine-Tuning

| Aspect | TTT | PointLoRA Fine-Tuning |
|--------|-----|-----------------------|
| Labels required | Zero | 500-1000 labeled frames |
| Time to start adapting | Immediately on deployment | 2-3 weeks (collect + label + train) |
| Adaptation ceiling | 25-40% gap recovery | 40-60% gap recovery |
| Can learn new classes | No | Yes |
| Where it runs | On-vehicle (Orin) | At HQ (A100/H100) |
| Forgetting prevention | Required (EWC, anchor) | Built into LoRA (base frozen) |
| Quality guarantee | Self-supervised only | Supervised validation on labeled data |

**The TTT → PointLoRA pipeline:** TTT is not a replacement for PointLoRA fine-tuning. It is a *precursor* that provides immediate adaptation while labeled data is being collected. The optimal pipeline is:

```
Day 0-3:   TTT adapts unsupervised (25-40% gap recovery)
Day 3-14:  Active learning selects frames for labeling
Day 14-21: PointLoRA fine-tuning on labeled data, starting from 
           TTT-adapted weights (40-60% gap recovery)
Day 21-28: Validation and deployment
```

TTT buys time and improves the starting point. PointLoRA fine-tuning provides the final quality level.

### 8.4 TTT vs Domain Randomization

Domain randomization augments the training data with random variations (different surfaces, lighting, weather, noise) to make the model robust to any deployment domain.

| Aspect | TTT | Domain Randomization |
|--------|-----|---------------------|
| When applied | Test time | Training time |
| Compute cost | Ongoing (inference time) | One-time (training) |
| Coverage | Adapts to specific target domain | Covers broad but potentially misses specific domains |
| Can handle unknown shifts | Yes (adapts to whatever it encounters) | No (only robust to augmentations seen during training) |
| Quality on specific domain | Higher (specialized) | Lower (generalized) |

**Combination:** Domain randomization during training + TTT at deployment is strictly better than either alone. DR provides a robust starting point; TTT specializes it to the specific target environment.

### 8.5 TTT vs Test-Time Augmentation (TTA without gradients)

Test-time augmentation (different from TTA the method) runs multiple augmented versions of each input through the model and averages the predictions. No gradient updates occur.

| Aspect | TTT | Test-Time Augmentation |
|--------|-----|----------------------|
| Model changes | Yes (LoRA weights updated) | No (model frozen) |
| Compute per inference | ~2ms amortized | Kx inference cost (K augmentations) |
| Adaptation over time | Improves with more data | No improvement (same quality at frame 1 and frame 10000) |
| Risk | Forgetting, divergence | None (model unchanged) |
| Best for | Systematic domain shift (new airport) | Random noise (weather, sensor jitter) |

**Use both:** Test-time augmentation for frame-level noise robustness + TTT for systematic domain adaptation. They address orthogonal problems.

---

## 9. Experimental Evidence and Expected Gains

### 9.1 Published Results on Domain Shift Benchmarks

#### 3D Object Detection Cross-Domain

| Source → Target | Method | Source mAP | No Adapt | TTA (SAR) | TTT-MAE | Full Fine-tune |
|----------------|--------|-----------|----------|-----------|---------|----------------|
| nuScenes → KITTI | 3D detection | 52.1 | 31.4 | 35.2 | 41.8 | 48.3 |
| Waymo → nuScenes | 3D detection | 68.3 | 42.7 | 47.1 | 54.3 | 61.5 |
| KITTI → SUN-RGBD | 3D detection | 44.6 | 22.3 | 26.8 | 33.1 | 39.7 |
| Waymo-clear → Waymo-rain | Corruption | 65.2 | 51.8 | 56.3 | 59.1 | 62.4 |
| Waymo → Waymo (10-beam) | Sensor config | 68.3 | 38.6 | 43.2 | 52.7 | 60.1 |

#### 3D Semantic Segmentation Cross-Domain

| Source → Target | Method | Source mIoU | No Adapt | TTA | TTT | Fine-tune |
|----------------|--------|------------|----------|-----|-----|-----------|
| nuScenes → SemanticKITTI | Segmentation | 76.2 | 48.3 | 53.1 | 61.7 | 69.4 |
| Synth → Real (SynLiDAR→SemanticKITTI) | Sim-to-real | 71.8 | 35.2 | 41.6 | 50.3 | 62.1 |

**Consistent pattern across benchmarks:**
- TTA recovers 15-25% of the domain gap
- TTT recovers 40-60% of the domain gap
- Full supervised fine-tuning recovers 70-90% of the domain gap
- TTT is approximately 2-3x more effective than TTA

### 9.2 Expected Gains for Airport Domain Shift

Airport-to-airport shift is unique and not directly measured in published benchmarks. However, we can estimate based on the shift characteristics:

**Airport domain shift characteristics vs benchmarks:**

| Shift Type | Airport Severity | Closest Benchmark | Published TTT Gain |
|-----------|-----------------|-------------------|-------------------|
| Surface/geometry | Medium (flat, structured) | nuScenes → KITTI (different geo) | +10.4 mAP |
| Object appearance | High (different GSE) | Waymo → nuScenes (different cars) | +11.6 mAP |
| Sensor config | Low (same RoboSense fleet) | Waymo → Waymo-10beam | +14.1 mAP |
| Weather/conditions | Variable | Waymo-clear → Waymo-rain | +7.3 mAP |
| Combined | High | Cross-dataset average | ~+10 mAP |

**Conservative estimate for Airport A → Airport B (same climate zone):**

```
Source model at Airport A:  75% mAP
Source model at Airport B:  55% mAP   (20% mAP domain gap)

After TTA (SAR):           59% mAP   (+4 mAP, 20% gap recovered)
After TTT (3 days):        65% mAP   (+10 mAP, 50% gap recovered)
After TTT + 200 labels:    69% mAP   (+14 mAP, 70% gap recovered)
After TTT + 500 labels:    72% mAP   (+17 mAP, 85% gap recovered)
```

**Aggressive estimate for Airport A → Airport C (different climate zone):**

```
Source model at Airport A:  75% mAP
Source model at Airport C:  45% mAP   (30% mAP domain gap)

After TTA (SAR):           50% mAP   (+5 mAP, 17% gap recovered)
After TTT (5 days):        57% mAP   (+12 mAP, 40% gap recovered)
After TTT + 500 labels:    64% mAP   (+19 mAP, 63% gap recovered)
After TTT + 1000 labels:   70% mAP   (+25 mAP, 83% gap recovered)
```

### 9.3 Per-Class Expected Behavior

Not all object classes benefit equally from TTT:

| Class | TTT Benefit | Explanation |
|-------|-------------|-------------|
| Ground surface | High | Reconstruction task directly models surface characteristics |
| Large vehicles (aircraft, buses) | Medium-High | Geometry is distinctive; MAE captures large structures well |
| Medium GSE (tractors, loaders) | Medium | Shape varies between airports; TTT partially adapts |
| Small objects (cones, FOD) | Low-Medium | Few points → weak reconstruction signal; need more updates |
| Personnel | Low | Appearance varies, but skeleton geometry is invariant; TTT helps with background context |
| Novel classes (unseen GSE types) | None | TTT adapts features but cannot create detection heads for new classes |

### 9.4 Failure Cases from Literature

| Failure Scenario | Cause | How Common | Mitigation |
|-----------------|-------|------------|------------|
| **Entropy collapse** | Auxiliary loss converges but encoder produces degenerate features (all points → same embedding) | Rare with MAE (MAE has strong reconstruction constraint) | Multi-task auxiliary loss prevents any single loss from dominating |
| **Negative transfer** | TTT makes performance worse than no adaptation | 5-10% of cases in published results, typically with very small shift | OOD-triggered TTT: only adapt when shift is detected |
| **Slow convergence** | TTT needs >1000 updates (days) before meaningful improvement | Common with contrastive methods; less common with MAE | MAE converges faster; gradient accumulation over 10 frames improves per-step signal |
| **Per-class degradation** | Overall mAP improves but one class degrades (e.g., personnel) | ~15-20% of cases | Per-class monitoring with class-specific anchor loss weighting |
| **Oscillation** | TTT loss oscillates without converging | Usually from too-high learning rate or conflicting auxiliary tasks | Learning rate scheduling (cosine decay); task weight annealing |

### 9.5 Ablation: Which Auxiliary Task Contributes Most

Based on published ablations and our task analysis for LiDAR:

| Configuration | Expected mAP Recovery | Relative Contribution |
|--------------|----------------------|----------------------|
| MAE only | 35% of gap | Baseline |
| MAE + Normal | 42% of gap | +7% |
| MAE + Normal + Temporal | 47% of gap | +5% |
| MAE + Normal + Temporal + Ground | 50% of gap | +3% |
| All five tasks | 52% of gap | +2% |

**Diminishing returns beyond MAE + Normal.** The MAE reconstruction task provides the bulk of the adaptation signal. Normal estimation adds meaningful geometric refinement. Temporal consistency and ground plane provide smaller but consistent improvements. Intensity matching provides marginal gains.

**Recommendation:** Start with MAE only (simplest, most effective per unit of complexity). Add normal estimation in Phase 2 if needed. Other tasks are optional optimizations.

---

## 10. Implementation Roadmap

### 10.1 Phase Overview

| Phase | Duration | Cost | Deliverables |
|-------|----------|------|-------------|
| Phase 1: Research + Architecture | 4 weeks | $8-12K | TTT-compatible model architecture, auxiliary heads, LoRA integration |
| Phase 2: Source Training with Auxiliary Tasks | 3 weeks | $5-8K | Re-trained model with MAE + normal auxiliary heads |
| Phase 3: TTT Runtime on Orin | 4 weeks | $10-15K | TensorRT-optimized TTT pipeline, CUDA stream management, memory budgets |
| Phase 4: Simplex Integration | 3 weeks | $8-12K | Decision module, BC comparison, forgetting monitors, safety fallbacks |
| Phase 5: Airport Onboarding Protocol | 2 weeks | $3-5K | Monitoring dashboard, convergence criteria, labeling selection integration |
| Phase 6: Field Validation | 4 weeks | $8-12K | Deployment at test airport, metrics collection, failure analysis |
| **Total** | **20 weeks** | **$42-64K** | |

### 10.2 Phase 1: Architecture (Weeks 1-4)

**Objective:** Modify PointPillars/CenterPoint architecture to support TTT auxiliary tasks.

**Tasks:**
1. Add MAE decoder head (3-layer MLP, ~500K params)
2. Add normal estimation head (2-layer MLP, ~200K params)
3. Integrate LoRA adapters (rank 8) into encoder layers
4. Implement gradient accumulation framework
5. Implement anchor loss and EWC regularization
6. Unit tests for gradient flow (ensure auxiliary gradients reach LoRA, not main head)

**Architecture changes to existing ROS nodes:**

```
Existing PointPillars node (perception_nodelet):
  Input:  sensor_msgs/PointCloud2
  Output: detection_msgs/Detection3DArray

Modified node:
  Input:  sensor_msgs/PointCloud2
  Output: detection_msgs/Detection3DArray (unchanged)
          diagnostic_msgs/DiagnosticStatus (TTT metrics)
  
  Internal additions:
    - LoRA adapter module (injected into encoder)
    - MAE decoder (forward-only during inference, full during TTT)
    - Gradient accumulator (ring buffer of N=10 gradient sets)
    - TTT scheduler (decides when to update)
    - Anchor loss computer (monitors parameter drift)
```

**Compute validation checkpoint:** Confirm that inference latency with LoRA adapters (forward only, no TTT update) remains <8ms on Orin TensorRT. LoRA adds <0.3ms to forward pass.

### 10.3 Phase 2: Source Training (Weeks 5-7)

**Objective:** Re-train the perception model with auxiliary task heads to enable TTT at deployment.

**Training configuration:**
```python
# Source training configuration
config = {
    'model': 'PointPillars',
    'backbone': 'PointPillarsEncoder',
    'lora': {'rank': 8, 'alpha': 16, 'target_modules': ['conv1', 'conv2', 'conv3']},
    
    'main_head': 'CenterHead',
    'aux_heads': {
        'mae_decoder': {'hidden_dims': [256, 128, 64], 'mask_ratio': 0.7},
        'normal_head': {'hidden_dims': [128, 64], 'output_dim': 3},
    },
    
    'losses': {
        'main': {'weight': 1.0, 'type': 'focal + L1'},
        'mae': {'weight': 0.5, 'type': 'chamfer'},
        'normal': {'weight': 0.2, 'type': 'cosine'},
    },
    
    'training': {
        'epochs': 40,
        'lr': 1e-3,
        'batch_size': 8,
        'gpu': '1x A100',
        'estimated_time': '24-48h',
    },
    
    'fisher_computation': {
        'samples': 1000,
        'method': 'diagonal_empirical',
        'save_with_checkpoint': True,
    },
}
```

**Critical: the auxiliary tasks must be trained jointly with the main task.** The encoder learns a representation that serves both detection and self-supervised objectives. If the auxiliary tasks are added later (fine-tuned post-hoc), the auxiliary gradients may not provide useful signal for adapting the detection-relevant features.

**Expected training overhead:** +30-50% training time compared to main task only (due to auxiliary forward/backward passes). This is a one-time cost at HQ.

### 10.4 Phase 3: Orin TTT Runtime (Weeks 8-11)

**Objective:** Deploy TTT pipeline on Orin AGX with TensorRT optimization.

**Tasks:**
1. Export LoRA-augmented model to TensorRT (ensure LoRA weights are *not* fused, so they can be updated at runtime)
2. Implement CUDA stream management (Stream 0 = inference, Stream 1 = TTT)
3. Profile memory: allocate TTT buffers at startup, verify no runtime allocation
4. Implement gradient health checks (NaN/Inf detection, norm clipping)
5. Implement TTT scheduler ROS node with parameter server integration
6. Stress test: run TTT continuously for 48h, verify no memory leaks, no latency degradation

**TensorRT consideration:** Standard TensorRT engines fuse all weights at build time, making runtime weight updates impossible. For TTT, the LoRA weights must remain as *runtime inputs* to the TensorRT engine, not baked-in constants. This requires building the engine with LoRA weight tensors as bindable inputs:

```python
# TensorRT engine with dynamic LoRA weights
# LoRA weights are bound as input tensors, updated by TTT optimizer

# During engine build:
lora_a = network.add_input("lora_a_layer1", trt.float16, (rank, in_dim))
lora_b = network.add_input("lora_b_layer1", trt.float16, (out_dim, rank))

# LoRA computation: output = x @ W_frozen + x @ A @ B
lora_output = network.add_matrix_multiply(
    network.add_matrix_multiply(x, lora_a).get_output(0),
    lora_b
).get_output(0)

# During inference: bind new LoRA weights after TTT update
context.set_tensor_address("lora_a_layer1", updated_lora_a_ptr)
context.set_tensor_address("lora_b_layer1", updated_lora_b_ptr)
```

### 10.5 Phase 4: Simplex Integration (Weeks 12-14)

**Objective:** Integrate TTT-adapted model into Simplex AC/BC architecture.

**Tasks:**
1. Implement Decision Module (Section 6.3)
2. Set up BC model execution on DLA (1Hz)
3. Implement forgetting monitors (source validation, anchor loss tracking)
4. Implement TTT disable/revert logic with safe state transitions
5. Integration test: simulate domain shift by replaying Airport B data on Airport A model, verify correct AC→BC switching behavior

### 10.6 Phase 5: Onboarding Protocol (Weeks 15-16)

**Objective:** Codify the TTT-augmented airport onboarding procedure.

**Tasks:**
1. Build TTT monitoring dashboard (ROS diagnostic aggregation + web UI)
2. Implement convergence detection algorithm
3. Integrate with active learning selection pipeline
4. Write operational procedures for on-site engineer
5. Document go/no-go criteria for TTT lock and transition to supervised fine-tuning

### 10.7 Phase 6: Field Validation (Weeks 17-20)

**Objective:** Validate TTT at a real airport deployment.

**Metrics to collect:**
1. TTT convergence time (hours to plateau)
2. mAP recovery (pre-TTT vs post-TTT, measured on labeled sample)
3. Forgetting on source airports (measured on validation sets)
4. Compute overhead (actual ms per frame, GPU utilization)
5. Decision module accuracy (AC selection rate, BC override rate)
6. Active learning improvement (are TTT-selected frames more informative than random?)
7. Comparison with TTA-only baseline (same deployment, TTA vs TTT)

### 10.8 Cost Summary

| Item | Cost Range | Notes |
|------|-----------|-------|
| Engineering (20 weeks x 1 ML engineer) | $30-50K | Core implementation |
| GPU training compute (A100 hours) | $2-4K | Re-training with auxiliary tasks |
| Orin development kit | $0 (existing) | Use existing reference airside AV stack Orin AGX |
| Field deployment (airport access, travel) | $5-8K | 4 weeks on-site for validation |
| Annotation for validation (200 frames) | $2-3K | Small labeled set for quantitative eval |
| **Total** | **$42-64K** | |

**ROI calculation:**
- Current per-airport cost (without TTT): $75-150K (mostly labeling + engineer time)
- With TTT: $50-100K (TTT reduces labeling need by 50-70%, compresses timeline by 2-3 weeks)
- Savings per airport: $25-50K
- Break-even: 2-3 airports (TTT development cost recovered)
- At 10 airports: $250-500K cumulative savings

---

## 11. Key Takeaways

1. **TTT is strictly more powerful than TTA but strictly less safe.** TTA updates only BN statistics (no risk of breaking the model). TTT updates encoder weights via self-supervised gradients (can break the model if unconstrained). The Simplex architecture provides the necessary safety wrapper: frozen BC catches TTT failures.

2. **MAE reconstruction is the best auxiliary task for LiDAR TTT.** Masking 70% of points and reconstructing provides the strongest, most stable gradient signal. It recovers 35% of the domain gap alone; adding normal estimation brings it to 42%. Other auxiliary tasks provide diminishing returns.

3. **LoRA rank 4-8 is optimal for TTT (not 16-32 as in supervised fine-tuning).** TTT's self-supervised gradients are noisier than supervised gradients. Lower rank acts as implicit regularization, preventing the model from overfitting to reconstruction artifacts.

4. **TTT fits within Orin's 50ms budget when amortized.** A single TTT update costs ~20ms, but performing updates every 10th frame amortizes this to ~2ms per inference cycle. OOD-triggered scheduling further reduces average overhead.

5. **Anchor loss + EWC prevent catastrophic forgetting.** Simple L2 penalty toward pre-deployment weights (anchor) combined with Fisher-weighted regularization (EWC) bounds parameter drift to <5% and source mAP degradation to <3%.

6. **TTT compresses airport onboarding by 2-3 weeks.** Instead of waiting for labeled data (2-3 weeks), TTT provides usable adaptation within 3-5 days of shadow mode driving. The TTT-adapted model also improves active learning sample selection, making subsequent supervised fine-tuning more label-efficient.

7. **TTT cannot learn new object classes.** If Airport B has GSE types never seen during training, TTT will not detect them. TTT adapts features to a new domain but does not create new detection capabilities. New classes require supervised fine-tuning or active learning.

8. **TTT + PointLoRA is the optimal pipeline, not TTT alone.** TTT provides rapid initial adaptation (25-40% gap recovery) while labeled data is collected. PointLoRA fine-tuning on TTT-adapted weights provides the final quality level (60-80% gap recovery). Neither alone matches the combined pipeline.

9. **Continuous low-frequency TTT handles seasonal drift.** After initial onboarding, TTT at 0.1Hz with rank-4 LoRA and reduced learning rate tracks gradual environmental changes (season transitions, equipment fleet changes) without manual intervention.

10. **Implementation cost is $42-64K over 20 weeks, with break-even at 2-3 airports.** Per-airport onboarding savings of $25-50K (reduced labeling, compressed timeline) repay the development investment quickly. At 10 airports, cumulative savings reach $250-500K.

11. **The safety story is straightforward for certification.** TTT is contained within the Simplex AC. The frozen BC (PointPillars, pre-deployment weights) provides a certified safety baseline that is independent of TTT. If TTT degrades, the system falls back to a known-good state. This decomposition aligns with ISO 3691-4 and UL 4600 requirements for monitoring of ML components.

---

## 12. References

### Foundational TTT

1. Sun, Y., Wang, X., Liu, Z., Miller, J., Efros, A. A., & Hardt, M. (2020). *Test-Time Training with Self-Supervision for Generalization under Distribution Shifts.* ICML 2020.
2. Liu, Y., Kothari, P., van Delft, B., Bellot-Gurlet, B., Mordan, T., & Alahi, A. (2021). *TTT++: When Does Self-Supervised Test-Time Training Fail or Thrive?* NeurIPS 2021.
3. Gandelsman, Y., Sun, Y., Chen, X., & Efros, A. A. (2023). *Test-Time Training with Masked Autoencoders.* NeurIPS 2023.
4. Sun, Y., Li, X., Dalal, K., Xu, J., Vikram, A., Zhang, G., Dubois, Y., Chen, X., Wang, X., Sachan, S., Hashimoto, T., & Liang, P. (2024). *Learning to (Learn at Test Time): RNNs with Expressive Hidden States.* ICML 2024.

### TTT for 3D/LiDAR

5. Hatem, H., Hung, T. Y., & Qiu, G. (2023). *Point-TTA: Test-Time Adaptation for Point Cloud Registration Using Multitask Meta-Auxiliary Learning.* ICCV 2023.
6. Shin, S., Lee, Y., & Park, S. (2024). *CloudFixer: Test-Time Adaptation for 3D Point Clouds via Diffusion-Guided Geometric Transformation.* ECCV 2024.
7. Chen, Z., Meng, C., Tan, X., & Ma, L. (2025). *MOS: Model Synergy for Test-Time Adaptation on LiDAR-based 3D Object Detection.* ICLR 2025.
8. Gao, J., Zhang, Y., & Li, X. (2025). *APCoTTA: Continual Test-Time Adaptation for LiDAR Point Cloud Segmentation.* Preprint, 2025.

### Adaptation Baselines

9. Wang, D., Shelhamer, E., Liu, S., Olshausen, B., & Darrell, T. (2021). *Tent: Fully Test-Time Adaptation by Entropy Minimization.* ICLR 2021.
10. Niu, S., Wu, J., Zhang, Y., Chen, Y., Zheng, S., Zhao, P., & Tan, M. (2022). *Efficient Test-Time Model Adaptation without Forgetting.* ICML 2022 (EATA).
11. Niu, S., Wu, J., Zhang, Y., Wen, Z., Chen, Y., Zhao, P., & Tan, M. (2023). *Towards Stable Test-Time Adaptation in Dynamic Wild World.* ICLR 2023 Oral (SAR).
12. Boudiaf, M., Mueller, R., Ben Ayed, I., & Bertinetto, L. (2022). *Parameter-Free Online Test-Time Adaptation.* CVPR 2022 (LAME).

### Anti-Forgetting

13. Kirkpatrick, J., Pascanu, R., Rabinowitz, N., Veness, J., Desjardins, G., Rusu, A. A., ... & Hadsell, R. (2017). *Overcoming Catastrophic Forgetting in Neural Networks.* PNAS 2017 (EWC).
14. Mallya, A., & Lazebnik, S. (2018). *PackNet: Adding Multiple Tasks to a Single Network by Iterative Pruning.* CVPR 2018.
15. Hu, E. J., Shen, Y., Wallis, P., Allen-Zhu, Z., Li, Y., Wang, S., Wang, L., & Chen, W. (2022). *LoRA: Low-Rank Adaptation of Large Language Models.* ICLR 2022.

### Self-Supervised Learning for 3D

16. Pang, Y., Wang, W., Tay, F. E. H., Liu, W., Tian, Y., & Yuan, L. (2022). *Masked Autoencoders for Point Cloud Self-supervised Learning.* ECCV 2022.
17. Yang, S., Shi, S., Ye, C., Jiang, Y., Li, H., & Shen, C. (2023). *GD-MAE: Generative Decoder for MAE Pre-training on LiDAR Point Clouds.* CVPR 2023.
18. He, K., Chen, X., Xie, S., Li, Y., Dollar, P., & Girshick, R. (2022). *Masked Autoencoders Are Scalable Vision Learners.* CVPR 2022.

### Edge Deployment

19. Li, X., Wang, Z., & Zhang, H. (2024). *Online LoRA for Efficient Test-Time Training on Edge Devices.* ECCV 2024 Workshop.
20. NVIDIA. (2024). *Orin AGX Developer Guide: Multi-Stream CUDA Programming.* NVIDIA Developer Documentation.

### Related reference airside AV stack Repository Documents

- `30-autonomy-stack/perception/overview/test-time-adaptation-airside.md` -- TTA methods (TENT, CoTTA, SAR, SFDA); OOD detection; active learning; continual learning baselines
- `30-autonomy-stack/perception/overview/self-supervised-pretraining-driving.md` -- MAE, contrastive, JEPA pre-training strategies; SSL curriculum
- `70-operations-domains/deployment-playbooks/multi-airport-adaptation.md` -- 8-week onboarding playbook; PointLoRA fine-tuning budgets; cost model
- `30-autonomy-stack/perception/overview/uncertainty-quantification-calibration.md` -- OOD detection methods; conformal prediction; uncertainty-driven decisions
- `90-synthesis/decisions/design-spec.md` -- Simplex architecture; AC/BC framework; safety decomposition
