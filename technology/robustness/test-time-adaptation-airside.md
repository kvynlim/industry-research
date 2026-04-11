# Test-Time Adaptation, Domain Adaptation, and Continual Learning for Multi-Airport AV Deployment

## Strategies for Robust Perception Across Diverse Airport Environments

**Date:** 2026-04-11
**Scope:** TTA, SFDA, continual learning, OOD detection, and active learning for deploying LiDAR-primary perception across multiple airports with heterogeneous conditions
**Stack Context:** Aurrigo ROS Noetic, 4-8 RoboSense LiDAR, GTSAM localization, Frenet planner, Simplex safety architecture

---

## Table of Contents

1. [Introduction: The Multi-Airport Challenge](#1-introduction-the-multi-airport-challenge)
2. [Domain Shift Taxonomy for Airside](#2-domain-shift-taxonomy-for-airside)
3. [Test-Time Adaptation Methods (SOTA 2023-2026)](#3-test-time-adaptation-methods-sota-2023-2026)
4. [Source-Free Domain Adaptation](#4-source-free-domain-adaptation)
5. [OOD Detection as Adaptation Trigger](#5-ood-detection-as-adaptation-trigger)
6. [Active Learning for Edge Case Mining](#6-active-learning-for-edge-case-mining)
7. [Continual Learning Without Catastrophic Forgetting](#7-continual-learning-without-catastrophic-forgetting)
8. [LiDAR-Specific Adaptation](#8-lidar-specific-adaptation)
9. [Practical Fleet-Scale Strategy](#9-practical-fleet-scale-strategy)
10. [Cost and Timeline](#10-cost-and-timeline)
11. [Recommended Pipeline for Aurrigo](#11-recommended-pipeline-for-aurrigo)
12. [References](#12-references)

---

## 1. Introduction: The Multi-Airport Challenge

### 1.1 The Scaling Problem

Every airport is a unique operating environment. A perception model trained at London Heathrow (temperate maritime climate, narrow taxiways, dense stand layouts) will degrade when deployed at Singapore Changi (equatorial, massive open aprons, tropical downpours) or Helsinki-Vantaa (arctic winter, de-icing operations, 4 hours of daylight in December). This is not a hypothetical concern — it is the primary barrier to scaling airside autonomous vehicle fleets beyond single-site deployments.

The current Aurrigo stack avoids this problem by using hand-crafted RANSAC perception that detects only 3 object types (deck, ULD, trailer). But any learned perception model — PointPillars, CenterPoint, open-vocabulary detection, occupancy prediction — will exhibit domain shift when transferred between airports. The question is not whether degradation occurs, but how to detect, quantify, and correct it efficiently.

### 1.2 Scale of the Problem

| Metric | Value |
|--------|-------|
| Major commercial airports worldwide | ~4,000+ |
| Airports with active GSE automation programs | ~30-50 |
| Expected Aurrigo target airports (3-year horizon) | 5-15 |
| Typical performance drop on new airport (no adaptation) | 15-40% mAP |
| Typical performance drop after 24h shadow mode + TTA | 3-8% mAP |
| Cost of full manual labeling per airport | $50K-150K |
| Cost of TTA + active learning pipeline per airport | $5K-20K |

The economics are clear: a systematic adaptation strategy reduces per-airport deployment cost by 5-10x while maintaining or exceeding the safety margins of full manual relabeling.

### 1.3 Terminology

| Term | Definition |
|------|-----------|
| **TTA (Test-Time Adaptation)** | Adapting model parameters during inference using only unlabeled test data |
| **SFDA (Source-Free Domain Adaptation)** | Adapting to a new domain without access to original training data |
| **OOD (Out-of-Distribution)** | Test samples that differ significantly from training distribution |
| **Continual Learning** | Learning new tasks/domains without forgetting previous knowledge |
| **Active Learning** | Selecting the most informative samples for human labeling |
| **Domain Shift** | Statistical difference between training and deployment distributions |
| **Shadow Mode** | Running new model in parallel without actuator access, logging outputs |

---

## 2. Domain Shift Taxonomy for Airside

### 2.1 Geometric Shift

Each airport has unique physical geometry that directly affects point cloud distributions:

| Parameter | Example Range | Impact on Perception |
|-----------|---------------|---------------------|
| Taxiway width | 15m (Code C) to 30m+ (Code F) | Ground plane extent, object-background ratio |
| Stand geometry | Nose-in, angled, remote | Approach angles, occlusion patterns |
| Apron surface | Concrete, asphalt, composite | Reflectance intensity, ground plane fitting |
| Terminal proximity | 10m to 200m+ | Background clutter, multipath reflections |
| Gradient/slope | 0-3% typical, up to 5% | Ground plane estimation error |
| Blast fence presence | Yes/No | Occlusion, airflow turbulence artifacts |

**Quantified impact:** Models trained on wide-open aprons (Dubai DXB) lose 12-18% mAP when transferred to congested stands (London LHR T5) due to increased occlusion density and closer object-sensor distances that change the point cloud density distribution.

### 2.2 Environmental Shift

Climate determines the dominant degradation modes:

| Climate Zone | Airports | Primary Challenges | LiDAR Impact |
|-------------|----------|-------------------|--------------|
| **Tropical** | Changi, Bangkok, Mumbai | 50mm/h rain, humidity, heat shimmer | 40-70% point density loss in rain |
| **Arctic/Subarctic** | Helsinki, Tromso, Anchorage | Snow, ice, de-icing spray, darkness | Ground plane obscured, glycol contamination |
| **Desert** | Dubai, Doha, Riyadh | Sand/dust, 50°C heat, thermal distortion | Particulate backscatter, range reduction |
| **Temperate maritime** | Heathrow, Amsterdam, Seattle | Fog, drizzle, variable lighting | Fog scattering at <150m visibility |
| **Continental** | Denver, Munich, Beijing | Extreme temperature range (-30 to +40°C) | Thermal drift in calibration |

**Key insight:** The same model needs to handle a 100°C temperature range, humidity from 10% (Riyadh) to 100% (Changi), and visibility from 30m (dense fog) to unlimited. No single training distribution covers this.

### 2.3 Seasonal Shift

Within a single airport, conditions change dramatically across seasons:

```
Winter operations (Nordic airport):
  - De-icing with propylene glycol → 40-70% LiDAR density loss in spray zone
  - Snow accumulation on apron → markings invisible, ground plane altered
  - Ice on sensor enclosures → progressive degradation without cleaning
  - 4-hour daylight window → thermal contrast changes
  - Snowplow/de-icer GSE present → new object classes appear

Summer operations (same airport):
  - 20+ hours daylight → consistent thermal imaging
  - Warm tarmac → heat shimmer at low altitude
  - Different GSE fleet (no de-icers) → object distribution shift
  - Bird activity peaks → small fast-moving OOD objects
  - Construction season → temporary obstacles, altered routes
```

**Adaptation requirement:** Models must handle intra-airport seasonal transitions without full retraining. A 6-month cycle means the model encounters "new" conditions twice yearly.

### 2.4 Equipment Shift

Different airports deploy different GSE fleets, aircraft types, and marking standards:

| Factor | Variation | Impact |
|--------|-----------|--------|
| GSE manufacturers | TLD, Trepel, MULAG, Goldhofer, etc. | Different dimensions, shapes, reflectance |
| Aircraft mix | B737/A320 dominated vs wide-body hub | Size distribution, wing height, engine positions |
| Tug types | Towbarless (Goldhofer AST-1) vs towbar | Dramatically different appearance and kinematics |
| Container types | LD3, LD6, LD8, LD11, pallets | Height, width, reflectance vary by 3x |
| Marking standards | ICAO vs FAA vs local variations | Line widths, colors, spacing |
| Personnel PPE | Hi-vis variants, hard hats, ear protection | Appearance diversity for pedestrian detection |

**Implication:** A model trained on TLD pushback tugs at Heathrow may fail to detect Goldhofer AST-1 towbarless tractors at Frankfurt. Equipment shift requires either broad pre-training or rapid online adaptation.

### 2.5 Lighting Shift

Airside lighting is fundamentally different from road lighting and varies dramatically between airports:

| Condition | Challenge | LiDAR Affected? | Camera Affected? |
|-----------|-----------|-----------------|-----------------|
| LED apron floods | Harsh shadows, color temperature varies | No | Yes — saturation, shadow edges |
| Sodium/HPS legacy | Orange cast, poor color rendering | No | Yes — color distortion |
| Dawn/dusk sun angle | Direct glare off wet tarmac | No | Yes — specular reflection blinds |
| Night operations | Minimal ambient light, point source glare | No | Yes — dynamic range challenge |
| Aircraft navigation lights | Strobing white/red/green | No | Yes — temporal aliasing |
| Seasonal sun angle | 10° (Nordic winter) vs 80° (tropical noon) | No | Yes — shadow length varies 10x |

**LiDAR advantage:** LiDAR is inherently lighting-invariant, which is a key reason the Aurrigo stack is LiDAR-primary. However, any future camera integration will face severe lighting shift between airports. TTA for camera-based perception must explicitly address lighting domain gaps.

---

## 3. Test-Time Adaptation Methods (SOTA 2023-2026)

### 3.1 Method Overview

Test-time adaptation modifies model parameters during inference using only the unlabeled test stream. No source data, no labels, no retraining infrastructure needed at deployment time.

| Method | Year | Venue | Core Idea | Updates | Memory | Stability |
|--------|------|-------|-----------|---------|--------|-----------|
| **TENT** | 2021 | ICLR | Entropy minimization on BN params | BN affine | O(1) | Low |
| **CoTTA** | 2022 | CVPR | Augmentation-averaged pseudo-labels + teacher | BN + selected layers | O(n) teacher | Medium |
| **EATA** | 2022 | ICML | Sample-efficient entropy + Fisher regularization | BN affine | O(p) Fisher | High |
| **SAR** | 2023 | ICLR | Sharpness-aware robust entropy minimization | BN affine | O(1) | High |
| **RoTTA** | 2023 | CVPR | Robust TTA with memory bank + reweighting | BN + teacher | O(n) memory | High |
| **EcoTTA** | 2023 | CVPR | Memory-efficient CTTA via self-distillation | Lightweight meta-net | O(1) | High |
| **CloudFixer** | 2024 | ECCV | Diffusion-guided geometric transformation for 3D | Input (not model) | O(1) | Very High |
| **MOS** | 2025 | ICLR | Model synergy via checkpoint ensemble for LiDAR 3D | Checkpoint selection | O(k) models | Very High |
| **ReservoirTTA** | 2025 | Preprint | Multi-model reservoir for recurring domains | Domain-specific models | O(k) models | Very High |
| **APCoTTA** | 2025 | Preprint | CTTA for LiDAR point cloud segmentation | Selected layers only | O(p) source | High |

### 3.2 TENT: Entropy Minimization (Baseline)

TENT (Wang et al., ICLR 2021) is the foundational TTA method. It adapts batch normalization (BN) parameters by minimizing the entropy of model predictions on each test batch.

**Mechanism:**
1. At test time, replace source BN statistics (running mean/var) with batch statistics from current test data
2. Optimize only the BN affine parameters (gamma, beta) to minimize prediction entropy
3. Update happens per-batch, no accumulation across batches

**Strengths:**
- Extremely simple — ~20 lines of code to implement
- Minimal compute overhead (~5% latency increase)
- No memory requirements beyond model parameters

**Weaknesses:**
- Unstable with small batch sizes (common in real-time AV systems where batch=1)
- Entropy collapse: can converge to trivially confident but wrong predictions
- No forgetting protection: original knowledge can be overwritten
- Performance degrades significantly in clean-to-noisy shift scenarios

```python
# TENT: Entropy minimization TTA update
# Minimal implementation for a PyTorch model

import torch
import torch.nn.functional as F

def tent_adapt(model, test_batch, optimizer, n_steps=1):
    """
    Test-time adaptation via entropy minimization.
    Only updates BatchNorm affine parameters (gamma, beta).
    
    Args:
        model: Pre-trained model with BN layers
        test_batch: Current batch of test data (unlabeled)
        optimizer: Optimizer over BN affine params only
        n_steps: Number of adaptation steps per batch
    
    Returns:
        Adapted model predictions
    """
    model.train()  # Enable BN to use batch statistics
    
    # Freeze all parameters except BN affine
    for name, param in model.named_parameters():
        if 'bn' not in name and 'norm' not in name:
            param.requires_grad = False
        else:
            param.requires_grad = True
    
    for _ in range(n_steps):
        logits = model(test_batch)
        # Shannon entropy of softmax predictions
        probs = F.softmax(logits, dim=1)
        entropy = -(probs * torch.log(probs + 1e-8)).sum(dim=1).mean()
        
        optimizer.zero_grad()
        entropy.backward()
        optimizer.step()
    
    # Final prediction after adaptation
    with torch.no_grad():
        output = model(test_batch)
    
    return output

# Setup: only optimize BN affine parameters
def configure_tent(model, lr=1e-3):
    """Configure model and optimizer for TENT adaptation."""
    params = []
    for name, param in model.named_parameters():
        if 'bn' in name or 'norm' in name:
            if 'weight' in name or 'bias' in name:
                params.append(param)
    
    optimizer = torch.optim.Adam(params, lr=lr)
    return optimizer
```

**Airside-specific concern:** Real-time AV perception operates at batch_size=1 (one LiDAR sweep per inference). TENT requires batch statistics, which are unreliable with batch_size=1. Solutions: (a) accumulate a sliding window of recent frames as a pseudo-batch, (b) use instance normalization as surrogate, or (c) skip TENT entirely in favor of methods that handle single-sample adaptation.

### 3.3 CoTTA: Continual TTA with Pseudo-Labels

CoTTA (Wang et al., CVPR 2022) addresses TENT's instability through two mechanisms:

1. **Augmentation-averaged pseudo-labels:** Generate N augmented views of each test sample, average predictions to produce stable pseudo-labels for self-training
2. **Mean teacher:** Maintain an EMA (exponential moving average) teacher model that provides stable targets, preventing error accumulation

**Key parameters:**
- Augmentation set: random crop, horizontal flip, color jitter (N=32 augmentations typical)
- EMA decay rate: alpha=0.999 (slow teacher update)
- Stochastic restore: randomly reset p=0.01 of parameters to source weights each step

**Performance:**
- Significantly more stable than TENT over long adaptation sequences
- However, fails when domain shift is large (source and target are too different)
- Augmentation overhead: 32x forward passes per sample — prohibitive for real-time

**Airside adaptation:** CoTTA's augmentation-averaging is impractical for real-time LiDAR at 10Hz (would require 320 forward passes/second). However, the mean teacher concept and stochastic restore are valuable and can be applied independently. Use CoTTA for offline adaptation during shadow mode data processing, not real-time inference.

### 3.4 EATA: Efficient Anti-Forgetting TTA

EATA (Niu et al., ICML 2022) resolves two critical weaknesses of TENT:

1. **Sample-efficient entropy minimization:** Only adapt on "reliable" samples — those with entropy below a threshold. High-entropy samples produce noisy gradients and are excluded from backward computation.
2. **Anti-forgetting Fisher regularization:** Compute the Fisher Information Matrix on source data before deployment. During TTA, penalize changes to parameters that are important for source performance.

**Sample selection criterion:**
```
Adapt on sample x if:  H(f(x)) < E_0 + margin
where E_0 = entropy on clean source data, margin = 0.4 * ln(C), C = num classes
```

**Fisher regularization:**
```
L_total = L_entropy + lambda * sum_i( F_i * (theta_i - theta_source_i)^2 )
where F_i = diagonal Fisher information for parameter i
lambda = 2000 (typical)
```

**Why EATA matters for airside:**
- Fisher regularization explicitly prevents forgetting the source domain (Airport A performance preserved while adapting to Airport B)
- Sample selection excludes highly uncertain detections — critical for safety: if the model is very uncertain, it should not be adapting on that data, it should be raising an alert
- Compute overhead is modest: only ~60% of samples trigger backward passes

**Quantitative results on ImageNet-C:**
- TENT: 62.0% accuracy → degrades to 55.2% after 100 batches (forgetting)
- EATA: 63.8% accuracy → maintains 62.9% after 100 batches (anti-forgetting)
- 8% gap after prolonged adaptation, which maps to ~3-5% mAP for 3D detection

### 3.5 SAR: Sharpness-Aware Robust TTA

SAR (Niu et al., ICLR 2023 Oral) discovers that batch normalization layers are a "crucial factor hindering TTA stability" and proposes:

1. **Sharpness-aware minimization (SAM):** Instead of minimizing entropy at the current parameter point, minimize entropy in the worst-case neighborhood of parameters. This finds "flat" minima that are more robust to distribution shift.
2. **Selective gradient filtering:** Exclude samples with gradient norms above a threshold (noisy outliers that destabilize adaptation).

**SAM update rule:**
```
Step 1: Compute perturbation  epsilon = rho * grad_L / ||grad_L||
Step 2: Evaluate gradient at  theta + epsilon
Step 3: Update theta using this "sharpness-aware" gradient
```

**Key finding:** Group normalization and layer normalization are inherently more stable than batch normalization for TTA. If designing a new architecture for deployment with TTA, prefer GroupNorm or LayerNorm over BatchNorm.

**Airside relevance:** SAR is the recommended drop-in replacement for TENT when batch normalization is present (which it is in most 3D detection backbones including PointPillars and CenterPoint). The selective gradient filtering naturally rejects corrupted LiDAR frames (e.g., during de-icing spray or heavy rain) that would otherwise destabilize adaptation.

### 3.6 RoTTA: Robust TTA with Memory

RoTTA (Yuan et al., CVPR 2023) adds a memory bank mechanism to TTA:

1. **Category-balanced memory bank:** Store representative samples from recent test data, balanced across predicted classes
2. **Robust batch normalization:** Estimate BN statistics from a mixture of source statistics and current batch, weighted by a learned mixing coefficient
3. **Timeliness-aware reweighting:** Recent samples get higher weight than old samples, allowing the model to track evolving distributions

**Memory bank details:**
- Size: 64-256 samples (configurable)
- Replacement: FIFO within each predicted class
- Sampling: Draw mini-batches from memory for BN statistic estimation

**Why RoTTA for airports:** Airport environments change over time (shift changes, weather evolution, aircraft mix changes). RoTTA's timeliness-aware reweighting naturally tracks these gradual shifts. The memory bank provides stable BN statistics even with batch_size=1 — solving TENT's fundamental limitation for real-time AV inference.

### 3.7 2024-2025 Advances

#### CloudFixer (ECCV 2024): Diffusion-Guided 3D Point Cloud TTA

CloudFixer (Shin et al., ECCV 2024) is the first TTA method specifically designed for 3D point clouds using diffusion models. Instead of adapting the model, it adapts the input:

**Approach:**
1. Pre-train a 3D point cloud diffusion model on clean data
2. At test time, optimize geometric transformation parameters (point-wise displacements + rotation matrices) to project noisy test points back toward the clean data manifold
3. The diffusion model provides the "clean data prior" — no backpropagation through the diffusion model needed

**Key properties:**
- **Input adaptation, not model adaptation** — model weights never change, eliminating forgetting risk entirely
- **Sub-second adaptation** per instance (<1s for a full point cloud)
- **No batch requirement** — works on individual point clouds
- Handles occlusion, limited resolution, scale variation, and sensor noise

**Airside application:** CloudFixer could preprocess incoming LiDAR scans to normalize them against sensor-specific artifacts before feeding to the detection pipeline. Particularly useful when deploying the same model on vehicles with different LiDAR configurations (e.g., Aurrigo ADT3 with 8 sensors vs STL2 with 4).

#### MOS: Model Synergy (ICLR 2025): LiDAR-Specific TTA

MOS (Chen et al., ICLR 2025) is the first TTA method specifically targeting LiDAR-based 3D object detection with a checkpoint ensemble strategy:

**Algorithm:**
1. During adaptation, save model checkpoints at regular intervals into a "model bank"
2. For each new test batch, compute "Synergy Weights" (SW) that measure:
   - Similarity of predicted bounding boxes between checkpoints and current batch
   - Feature independence between checkpoint pairs (diversity)
3. Assemble the best-matching checkpoints via weighted averaging
4. Discard lowest-SW checkpoints to maintain bank size

**Results:**
- 67.3% improvement in cross-corruption scenarios (e.g., model trained in clear weather, tested in rain+fog)
- Tested across 3 datasets (nuScenes, Waymo, KITTI) and 8 corruption types
- Handles both cross-dataset shifts AND real-time weather corruptions

**Airside relevance:** MOS is directly applicable to multi-airport deployment. The model bank effectively stores "airport-specialized" checkpoints. When deploying at a new airport, the synergy weights automatically select the most relevant checkpoints from previous airports. This is the closest existing method to what Aurrigo needs for fleet-scale adaptation.

#### ReservoirTTA (2025): Prolonged Adaptation for Recurring Domains

ReservoirTTA (LTS5/EPFL, 2025) addresses a scenario directly relevant to airports: domains that recur over time (e.g., summer conditions returning after winter).

**Architecture:**
1. **Style characterization:** Extract early convolutional features from each test batch, compute a style representation
2. **Online domain clustering:** Assign batches to style clusters; detect when a new domain appears
3. **Model reservoir:** Maintain a separate model for each detected domain
4. **Routing:** Each incoming batch is routed to the most appropriate domain-specific model

**Key insight:** Rather than one model adapting to everything, maintain a library of specialized models. This eliminates catastrophic forgetting (each model only adapts to its domain) and handles recurring domains (when winter returns, the winter model is ready).

**Airside mapping:**
- Cluster 1: Clear day operations → model specialized for high-density clean point clouds
- Cluster 2: Rain operations → model specialized for sparse, noisy point clouds
- Cluster 3: Night operations → model for different thermal/reflectance characteristics
- Cluster 4: De-icing operations → model for glycol-contaminated point clouds
- Cluster 5: Construction zone → model for altered geometry + new obstacles

#### APCoTTA (2025): Continual TTA for LiDAR Point Clouds

APCoTTA (Gao et al., 2025) is the first continual TTA method specifically designed for LiDAR point cloud semantic segmentation, consisting of three modules:

1. **Dynamic Selection of Trainable Layers (DSTL):** Only update layers whose gradient norms fall below a threshold; freeze the rest to retain source knowledge
2. **Entropy-Based Consistency Loss (EBCL):** Filter out low-confidence samples; compute consistency loss only on high-confidence predictions
3. **Randomized Parameter Interpolation (RPI):** Randomly blend adapted parameters with source parameters to prevent overfitting

**Tested corruption types:** Weather effects (rain, fog, snow), sensor measurement bias, complex real-world noise — covering the major airside degradation modes.

#### Test-Time Training E2E (2025): TTT for Autonomous Driving

The TTT-E2E paradigm applies test-time training directly to end-to-end driving models:

- **Centaur** instantiates TTA by minimizing model uncertainty over trajectory predictions to reduce collision rates
- Adaptation via one-step SGD update to the planner using unsupervised gradients from cluster entropy aggregated over a short buffer of recent frames
- Demonstrates that TTA can improve planning safety, not just perception accuracy

**Theoretical insight (2025):** Foundation models remain globally underparameterized; TTT provides a mechanism for specialization after generalization, focusing model capacity on concepts relevant to the current deployment environment.

### 3.8 Method Selection Guide for Airside

| Scenario | Recommended Method | Rationale |
|----------|--------------------|-----------|
| **Real-time on-vehicle (batch=1)** | RoTTA or MOS | Memory bank provides stable statistics; MOS handles LiDAR natively |
| **Shadow mode (offline processing)** | CoTTA or EATA | Can afford augmentation overhead; Fisher regularization preserves source |
| **Multi-airport fleet** | ReservoirTTA + MOS | Domain routing handles airport diversity; checkpoint bank scales |
| **Seasonal transition** | APCoTTA | Continual adaptation with forgetting prevention |
| **Different vehicle configurations** | CloudFixer | Input adaptation normalizes sensor differences |
| **New architecture design** | SAR + GroupNorm | Sharpness-aware + stable normalization |

---

## 4. Source-Free Domain Adaptation

### 4.1 Why Source-Free Matters for Multi-Customer Deployment

Source-free domain adaptation (SFDA) adapts a pre-trained model to a new domain without access to the original training data. This is critical for Aurrigo because:

1. **Customer data privacy:** Airport A's operational data cannot be shared with Airport B (different operators, possibly different countries with different data regulations)
2. **IP protection:** The source training dataset may contain proprietary annotations or airport-specific labels that cannot be redistributed
3. **Storage and bandwidth:** Transferring terabytes of LiDAR data between sites is impractical
4. **Regulatory compliance:** GDPR (EU), PDPA (Singapore), and airport security regulations restrict data movement

In practice, Aurrigo will ship a pre-trained model to each new airport. The model must adapt using only local data, without phoning home to a central training server.

### 4.2 Key SFDA Methods

#### SHOT: Source Hypothesis Transfer (ICML 2020)

SHOT freezes the classifier head and adapts only the feature extractor using:
1. **Information maximization (IM):** Make predictions individually confident (low entropy) and globally diverse (high class diversity in batch)
2. **Self-supervised pseudo-labeling:** Generate pseudo-labels from current model, retrain feature extractor to be consistent

**Performance:** On VisDA-C, SHOT achieves 82.9% accuracy without any source data access, vs 76.1% for source-only baseline.

**Limitation:** Pseudo-labels from heavily shifted domains contain significant noise, propagating errors.

#### NRC: Neighborhood Reciprocal Clustering (NeurIPS 2021)

NRC exploits the structure of target features:
1. For each target sample, find k-nearest neighbors in feature space
2. If sample A is in B's neighborhood AND B is in A's neighborhood (reciprocal), they likely share the same class
3. Use reciprocal pairs to form reliable pseudo-labels

**Advantage:** More robust pseudo-labels than SHOT because reciprocal consistency filters out noise.

#### AaD: Attracting and Dispersing (NeurIPS 2022)

AaD combines contrastive learning with SFDA:
1. **Attracting:** Pull features of likely same-class samples together
2. **Dispersing:** Push features of different-class samples apart
3. Jointly optimize with pseudo-label self-training

**Key result:** AaD outperforms SHOT by 3-5% on Office-Home and DomainNet benchmarks.

#### SF(DA)^2: Source-Free DA Through Data Augmentation (ICLR 2024)

SF(DA)^2 reframes SFDA through the lens of data augmentation:
- Generate augmented views of target data that simulate source-like conditions
- Self-train on augmented-to-original consistency
- Requires no source data, no source statistics — only the model checkpoint

#### Train Till You Drop (ECCV 2024): Stable SFDA for 3D Point Clouds

TTYD (Valeo AI, ECCV 2024) specifically addresses SFDA for 3D semantic segmentation and identifies a critical problem: **existing SFDA methods degrade after extended training** because the problem is fundamentally ill-posed without source data constraints.

**Solution:**
1. **Early stopping via reference model agreement:** Monitor agreement between adapting model and a frozen reference copy; stop when agreement drops below threshold
2. **Hyperparameter-free validation:** The reference agreement criterion selects hyperparameters without any knowledge of the target domain

**Airside relevance:** TTYD's automatic stopping criterion is essential for unattended adaptation at remote airport sites. Without it, adaptation could silently degrade overnight, creating a safety risk.

#### Revisiting SFDA (ICLR 2025): Uncertainty Control

The latest theoretical analysis of SFDA (ICLR 2025) reveals that controlling prediction uncertainty is the key mechanism behind all successful SFDA methods. The paper provides a unified framework showing that SHOT, NRC, and AaD all implicitly perform uncertainty reduction, and that explicitly controlling uncertainty improves all methods by 2-4%.

### 4.3 SFDA Pipeline for New Airport Deployment

```
Pre-deployment (at Aurrigo HQ):
  1. Train base model on all available labeled airport data
  2. Compute Fisher Information Matrix on source data → store with model
  3. Package model + Fisher matrix + reference checkpoint as deployment bundle

At new airport (no source data access):
  1. Collect 2-4 hours of unlabeled LiDAR data during shadow mode
  2. Run SHOT (information maximization + pseudo-labeling) for initial adaptation
  3. Apply TTYD early stopping criterion to prevent over-adaptation
  4. Validate adapted model against reference checkpoint agreement
  5. If validation passes → deploy adapted model with TTA enabled
  6. If validation fails → flag for human review, continue in shadow mode
```

---

## 5. OOD Detection as Adaptation Trigger

### 5.1 The Safety-Critical Decision

In airside operations, encountering out-of-distribution data requires a binary decision:

```
OOD detected → Is it safe to adapt? OR Should we stop and alert?

  Case A: Mild OOD (new GSE type, slightly different lighting)
    → Trigger TTA adaptation
    → Continue autonomous operation at reduced speed
    → Log for active learning pipeline

  Case B: Severe OOD (sensor failure, completely unknown object, smoke/fire)
    → DO NOT adapt (would learn wrong things)
    → Activate Simplex fallback to classical stack
    → Alert remote operator
    → Stop if classical stack also uncertain
```

This decision is the bridge between TTA and safety. Getting it wrong in either direction is costly:
- **False positive (unnecessary fallback):** Lost productivity, operator fatigue
- **False negative (missed OOD):** Adaptation on corrupted data, potential safety event

### 5.2 OOD Detection Methods

#### Mahalanobis Distance

The Mahalanobis distance measures how far a feature vector is from the training distribution, accounting for feature correlations:

```
D_M(x) = sqrt( (f(x) - mu_c)^T * Sigma_c^{-1} * (f(x) - mu_c) )
where:
  f(x) = feature vector from penultimate layer
  mu_c = class-conditional mean from training data
  Sigma_c = class-conditional covariance from training data
  c = nearest class
```

**Pre-compute at training time:** mu_c and Sigma_c for each class, store with model.
**At test time:** Compute distance in O(d^2) where d = feature dimension.

**Mahalanobis++ (ICML 2025):** Recent improvement that applies feature normalization before computing Mahalanobis distance, addressing violations of the Gaussian assumption in deep features. Consistently improves OOD detection across architectures and pre-training schemes.

#### Energy-Based OOD Detection

Energy score (Liu et al., NeurIPS 2020) uses the free energy of the model's logit output:

```
E(x) = -T * log( sum_c exp(f_c(x) / T) )
where:
  f_c(x) = logit for class c
  T = temperature (typically T=1)
```

Lower energy = more in-distribution. Higher energy = more OOD.

**Advantages over softmax confidence:**
- Theoretically grounded (aligned with density estimation)
- Less susceptible to overconfident wrong predictions
- Works with any classifier without modification

```python
# OOD Detection Score Computation
# Combining Mahalanobis distance and energy score

import torch
import torch.nn.functional as F
import numpy as np
from scipy.spatial.distance import mahalanobis

class OODDetector:
    """
    Combined OOD detector using Mahalanobis distance and energy score.
    Pre-compute class statistics on source/training data before deployment.
    """
    
    def __init__(self, model, class_means, class_covs_inv, 
                 temperature=1.0, 
                 mahal_threshold=25.0,    # Tuned on validation OOD set
                 energy_threshold=-5.0,   # Tuned on validation OOD set
                 combined_weight=0.6):    # Weight for Mahalanobis vs energy
        self.model = model
        self.class_means = class_means        # Dict[class_id -> mean_vector]
        self.class_covs_inv = class_covs_inv  # Dict[class_id -> inv_cov_matrix]
        self.temperature = temperature
        self.mahal_threshold = mahal_threshold
        self.energy_threshold = energy_threshold
        self.combined_weight = combined_weight
    
    def compute_mahalanobis(self, features):
        """
        Compute minimum Mahalanobis distance across classes.
        
        Args:
            features: (N, D) feature tensor from penultimate layer
        Returns:
            distances: (N,) minimum Mahalanobis distance per sample
        """
        features_np = features.cpu().numpy()
        distances = []
        
        for feat in features_np:
            min_dist = float('inf')
            for cls_id in self.class_means:
                mu = self.class_means[cls_id]
                cov_inv = self.class_covs_inv[cls_id]
                dist = mahalanobis(feat, mu, cov_inv)
                min_dist = min(min_dist, dist)
            distances.append(min_dist)
        
        return torch.tensor(distances)
    
    def compute_energy(self, logits):
        """
        Compute energy score from logits.
        Lower energy = more in-distribution.
        
        Args:
            logits: (N, C) raw logits from classifier
        Returns:
            energy: (N,) energy scores
        """
        energy = -self.temperature * torch.logsumexp(
            logits / self.temperature, dim=1
        )
        return energy
    
    def detect(self, features, logits):
        """
        Combined OOD detection. Returns per-sample OOD scores and decisions.
        
        Args:
            features: (N, D) penultimate layer features
            logits: (N, C) raw logits
        
        Returns:
            is_ood: (N,) boolean — True if OOD
            ood_score: (N,) float — combined OOD score (higher = more OOD)
            severity: (N,) str — 'in_dist', 'mild_ood', 'severe_ood'
        """
        mahal_dist = self.compute_mahalanobis(features)
        energy_score = self.compute_energy(logits)
        
        # Normalize to [0, 1] range using sigmoid
        mahal_norm = torch.sigmoid((mahal_dist - self.mahal_threshold) / 5.0)
        energy_norm = torch.sigmoid((-energy_score - (-self.energy_threshold)) / 2.0)
        
        # Combined score
        ood_score = (self.combined_weight * mahal_norm + 
                     (1 - self.combined_weight) * energy_norm)
        
        # Three-level severity classification
        severity = []
        for score in ood_score:
            if score < 0.3:
                severity.append('in_dist')
            elif score < 0.7:
                severity.append('mild_ood')
            else:
                severity.append('severe_ood')
        
        is_ood = ood_score > 0.3
        return is_ood, ood_score, severity

    @staticmethod
    def precompute_statistics(model, dataloader, num_classes):
        """
        Pre-compute class-conditional means and covariances on source data.
        Run once before deployment. Store results with the model checkpoint.
        """
        model.eval()
        features_by_class = {c: [] for c in range(num_classes)}
        
        with torch.no_grad():
            for batch, labels in dataloader:
                feats = model.extract_features(batch)  # Penultimate layer
                for feat, label in zip(feats, labels):
                    features_by_class[label.item()].append(feat.cpu().numpy())
        
        class_means = {}
        class_covs_inv = {}
        
        for cls_id, feats in features_by_class.items():
            feats = np.array(feats)
            class_means[cls_id] = np.mean(feats, axis=0)
            cov = np.cov(feats.T) + 1e-5 * np.eye(feats.shape[1])  # Regularize
            class_covs_inv[cls_id] = np.linalg.inv(cov)
        
        return class_means, class_covs_inv
```

### 5.3 Integration with Simplex Architecture

The OOD detector directly feeds the Simplex arbitrator that switches between the new ML-based stack (AC — Advanced Controller) and the classical RANSAC stack (BC — Baseline Controller):

```
                    ┌──────────────────┐
                    │   OOD Detector    │
                    │ (Mahal + Energy)  │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │  OOD Severity?    │
                    └──┬──────┬──────┬─┘
                       │      │      │
              in_dist  │ mild │  severe
                       │      │      │
                       ▼      ▼      ▼
              ┌────────┐ ┌────┐ ┌──────────┐
              │ Use AC  │ │TTA │ │ Use BC   │
              │ (ML     │ │ +  │ │ (RANSAC) │
              │  stack) │ │ AC │ │ + alert  │
              └────────┘ └────┘ └──────────┘
```

**Decision thresholds (tuned per deployment):**

| OOD Score | Severity | Action | Speed Limit |
|-----------|----------|--------|-------------|
| < 0.3 | In-distribution | Use ML stack normally | Normal (15 km/h) |
| 0.3 - 0.5 | Mild OOD | Enable TTA, use ML stack | Reduced (10 km/h) |
| 0.5 - 0.7 | Moderate OOD | Enable TTA, log for review | Slow (5 km/h) |
| > 0.7 | Severe OOD | Switch to classical stack | Creep (2 km/h) or stop |

### 5.4 Airside-Specific OOD Scenarios

| Scenario | Expected OOD Score | Correct Action |
|----------|-------------------|----------------|
| New GSE type never seen in training | 0.4-0.6 (mild) | TTA + continue, flag for labeling |
| De-icing spray contaminating sensors | 0.6-0.8 (severe) | Fallback to radar/classical, stop if needed |
| Aircraft type not in training set | 0.3-0.5 (mild) | TTA sufficient — geometry is similar |
| Fire/smoke on apron | 0.8+ (severe) | Emergency stop, alert operator |
| Night with new LED lighting | 0.3-0.4 (mild) | TTA on lighting, continue |
| Sensor degradation (dirty lens) | 0.5-0.7 (moderate) | Fallback, request cleaning |
| FOD on taxiway | 0.5-0.7 (moderate) | Alert, slow/stop, flag for investigation |

---

## 6. Active Learning for Edge Case Mining

### 6.1 The Fleet-Scale Annotation Problem

A fleet of 10 autonomous tractors operating 16 hours/day at 10Hz LiDAR generates:

```
10 vehicles x 16 hours x 3600 sec x 10 Hz = 5,760,000 point clouds per day
At ~2MB per cloud = ~11.5 TB per day of raw data

Annotation cost at $2/frame (3D bounding boxes) = $11.5M per day (!)
Obviously infeasible to label everything.
```

Active learning selects the ~0.1-1% of frames that are most informative for model improvement, reducing annotation cost by 100-1000x.

### 6.2 Selection Strategies

#### Uncertainty Sampling

Select frames where the model is least confident in its predictions:

| Method | Signal | Best For |
|--------|--------|----------|
| **Entropy-based** | High prediction entropy | General uncertainty |
| **MC Dropout** | Variance across N stochastic forward passes | Epistemic uncertainty |
| **Ensemble disagreement** | Variance across K model ensemble members | Model uncertainty |
| **Softmax margin** | Difference between top-2 class probabilities | Decision boundary cases |

**Practical implementation:** MC Dropout with N=5 passes adds 5x compute but captures meaningful uncertainty without training an ensemble. For 3D detection, measure uncertainty on both classification confidence and bounding box regression variance.

#### Committee Disagreement

Train K=3-5 models with different random seeds or architecture variants. Select frames where models disagree most:

```
Disagreement(x) = 1 - max_c( (1/K) * sum_k I[pred_k(x) == c] )
where K = committee size, c = predicted class
```

**3D detection specific:** Beyond class disagreement, measure IoU of predicted bounding boxes across committee members. Low IoU = high spatial uncertainty = high value for labeling.

#### Density-Based Selection

Select frames from underrepresented regions of the feature space:

1. Encode all unlabeled frames into a feature space
2. Cluster using k-means or HDBSCAN
3. Select frames from small clusters (rare scenarios) or cluster boundaries (ambiguous scenarios)

**Airside application:** Density-based selection naturally identifies rare events — FOD encounters, unusual aircraft approaches, equipment malfunctions — that are critical for safety but statistically rare.

### 6.3 Fleet-Scale Priority Pipeline

```
                   Fleet Vehicles (N=10+)
                         │
                    Raw LiDAR data
                         │
                    ┌────▼─────┐
                    │ Inference │
                    │ + Scores  │
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
         ┌────▼───┐ ┌───▼────┐ ┌──▼──────┐
         │Entropy │ │OOD     │ │Temporal │
         │Score   │ │Score   │ │Novelty  │
         └────┬───┘ └───┬────┘ └──┬──────┘
              │         │         │
              └─────────┼─────────┘
                        │
                   ┌────▼──────┐
                   │ Priority  │
                   │ Ranker    │
                   └────┬──────┘
                        │
              ┌─────────┼─────────┐
              │         │         │
         ┌────▼───┐ ┌──▼────┐ ┌──▼───────┐
         │Critical │ │High   │ │Medium    │
         │(0.1%)   │ │(1%)   │ │(5%)      │
         │→ Label  │ │→ Queue│ │→ Archive │
         │  NOW    │ │       │ │          │
         └─────────┘ └───────┘ └──────────┘
```

**Priority scoring formula:**

```
Priority(frame) = w1 * entropy_score 
                + w2 * ood_score 
                + w3 * temporal_novelty 
                + w4 * class_rarity_bonus
                + w5 * safety_relevance

Typical weights:
  w1 = 0.25  (model uncertainty)
  w2 = 0.30  (distribution shift signal)
  w3 = 0.15  (temporal: haven't seen similar recently)
  w4 = 0.15  (rare class: pedestrian close, FOD, etc.)
  w5 = 0.15  (safety weight: near-miss, low clearance, etc.)
```

### 6.4 Integration with Shadow Mode

During shadow mode deployment at a new airport:

| Phase | Duration | Data Volume | Labeled | Purpose |
|-------|----------|-------------|---------|---------|
| Initial shadow | 24-48 hours | ~100K frames | 0 | Collect baseline OOD statistics |
| Active selection | 1-2 weeks | ~500K frames | 500-2000 (0.1-0.4%) | Label highest-priority frames |
| Fine-tune + validate | 2-3 days | N/A | N/A | Adapt model, validate on held-out |
| Continued learning | Ongoing | Continuous | 50-100/week | Maintain and improve |

**Target:** 500-2000 labeled frames per new airport, selected by active learning, achieves 90-95% of full-dataset performance. This aligns with the finding (from transfer learning research) that LoRA fine-tuning needs only 500-1000 frames for domain adaptation.

---

## 7. Continual Learning Without Catastrophic Forgetting

### 7.1 The Forgetting Problem

When adapting a model from Airport A to Airport B, naive fine-tuning on B's data causes catastrophic forgetting of A's knowledge:

```
Before adaptation:
  Airport A performance: 78% mAP
  Airport B performance: 55% mAP (domain gap)

After naive fine-tuning on B:
  Airport A performance: 41% mAP  ← Catastrophic forgetting (37% drop!)
  Airport B performance: 76% mAP  ← Improved on B

Goal (continual learning):
  Airport A performance: 75% mAP  ← Minimal forgetting (3% drop)
  Airport B performance: 74% mAP  ← Nearly as good as naive fine-tuning
```

For a fleet operating across multiple airports, the model must accumulate knowledge without losing it.

### 7.2 Elastic Weight Consolidation (EWC)

EWC (Kirkpatrick et al., 2017) uses the Fisher Information Matrix to identify which parameters are important for previously learned tasks and penalizes changes to those parameters:

**Loss function:**

```
L_total = L_task_B(theta) + (lambda / 2) * sum_i( F_i * (theta_i - theta_A_i)^2 )
where:
  L_task_B = loss on new airport B data
  F_i = diagonal Fisher information for parameter i (computed on airport A data)
  theta_A_i = optimal parameter values after training on airport A
  lambda = regularization strength (typically 1000-10000)
```

**Compute cost:** Fisher matrix computation requires one pass over a representative subset of source data (~1000 samples). Storage: O(p) where p = number of parameters.

**Practical consideration for Aurrigo:** Compute Fisher matrix at each airport before moving to the next. Ship the Fisher matrix + optimal parameters as part of the "airport profile" alongside the model checkpoint.

### 7.3 PackNet: Parameter Isolation

PackNet (Mallya & Lazebnik, CVPR 2018) takes a different approach — instead of regularizing, it allocates separate parameter subsets to each task:

1. Train on Airport A using full network
2. Prune unimportant parameters (e.g., 75% of weights per layer)
3. Freeze remaining 25% — these are "Airport A's parameters"
4. Train on Airport B using only the freed 75%
5. Repeat for Airport C, D, ...

**Capacity:** With 75% pruning per task, a single network can accommodate ~4 airports before running out of capacity. With 90% pruning (more aggressive), ~10 airports fit.

**Advantage:** Zero forgetting by construction — Airport A's parameters are literally frozen.
**Disadvantage:** Capacity is bounded; eventually the network is full. Need to grow the network or use a hierarchy.

### 7.4 Replay Buffers with Airport-Specific Exemplars

Store a small representative set of labeled data from each airport and replay it during adaptation to new airports:

```
Replay buffer structure:
  Airport A: 200 exemplars (class-balanced, diversity-sampled)
  Airport B: 200 exemplars
  Airport C: 200 exemplars
  ...
  Total: 200 * N_airports exemplars

Training on new airport D:
  Each mini-batch = 50% Airport D data + 50% replay (uniform across A, B, C)
```

**Memory budget:** 200 exemplars per airport at ~2MB each = 400MB per airport. For 10 airports = 4GB — easily fits in GPU memory.

**Selection of exemplars:** Use herding (select exemplars closest to class centroids) or k-Center-Greedy (maximize coverage of feature space).

**Privacy concern:** Replay requires storing data from each airport. If data sharing between airports is restricted, consider:
- Synthetic replay: Train a generative model at each airport, generate synthetic exemplars
- Feature replay: Store feature vectors instead of raw point clouds (smaller, less identifiable)
- Federated learning: Keep data local, share only gradient updates

### 7.5 Model Versioning and Rollback Strategy

```
Model Version Registry:
  v1.0.0 — Base model (trained on synthetic + public data)
  v1.1.0 — Adapted to Airport A (Heathrow)
  v1.2.0 — Adapted to Airport A + B (Heathrow + Changi)
  v1.2.1 — Hotfix: Changi rain adaptation improved
  v1.3.0 — Adapted to Airport A + B + C (+ Dubai)
  ...

Rollback triggers:
  1. mAP drops > 5% on any previously validated airport → rollback to last known good
  2. False negative rate on pedestrians exceeds 1% → immediate rollback + alert
  3. OOD rate exceeds 20% sustained for > 1 hour → rollback + investigation
  4. Any safety-critical misdetection → immediate rollback + incident report

Storage: ~500MB per checkpoint x 20 versions = 10GB — trivial
Rollback time: < 30 seconds (load checkpoint into GPU memory)
```

### 7.6 Comparison of Continual Learning Approaches

| Method | Forgetting Prevention | Capacity | Privacy | Compute | Best For |
|--------|----------------------|----------|---------|---------|----------|
| **EWC** | Good (regularization) | Unlimited | No data stored | Low (Fisher once) | Sequential airports |
| **PackNet** | Perfect (isolation) | Limited (~4-10 tasks) | No data stored | Medium (pruning) | Small fleet (<5 airports) |
| **Replay** | Very good | Unlimited | Requires data storage | Medium (replay training) | Large fleet (>5 airports) |
| **Progressive Networks** | Perfect (separate columns) | Unlimited but expensive | No data stored | High (growing network) | Research/unlimited compute |
| **LoRA per airport** | Perfect (separate adapters) | ~100 airports at 4MB each | No data stored | Low (merge adapters) | Recommended for Aurrigo |

**Recommended approach for Aurrigo:** LoRA adapters per airport. Train a base model, then fine-tune lightweight LoRA adapters (rank=32, ~4MB each) per airport. At deployment, load base model + airport-specific LoRA. Zero forgetting, minimal storage, fast switching between airports.

---

## 8. LiDAR-Specific Adaptation

### 8.1 Point Cloud Density Changes

Different LiDAR configurations produce different point cloud distributions:

| Factor | Aurrigo ADT3 | Aurrigo STL2 | Aurrigo POD | Impact |
|--------|-------------|-------------|-------------|--------|
| Number of LiDARs | 8 (RSHELIOS) | 4 (RSBP) | 4 (RSHELIOS) | 2x density difference |
| Mounting height | ~2.5m | ~1.8m | ~2.0m | Ground plane distance changes |
| FOV coverage | 360° x 3 layers | 360° x 2 layers | 360° full | Overlap zones vary |
| Points per scan | ~300K-600K | ~150K-300K | ~200K-400K | Model sensitivity |

**Domain gap from sensor config:** A model trained on ADT3's dense 600K point clouds will see 50% fewer points on STL2, causing:
- Small objects (cones, FOD) to drop below detection threshold
- Range-dependent performance to shift (same object at 30m has half the points)
- Ground plane fitting to change due to different mounting height

**Adaptation strategies:**
1. **Random point dropping during training:** Train with 30-70% random point dropout to make the model robust to density variation
2. **Beam pattern simulation:** Simulate target sensor's beam pattern on source data during training
3. **CloudFixer:** Apply diffusion-guided input adaptation to normalize density at test time
4. **Mounting height normalization:** Transform point clouds to a canonical coordinate frame (ground plane at z=0) before feeding to the model

### 8.2 Ground Plane Adaptation

Airport surfaces vary significantly:

| Surface Type | Reflectance | Slope | Challenge |
|-------------|-------------|-------|-----------|
| Concrete apron | High (0.5-0.8) | 0.5-1.5% grade | Strong returns, good ground fit |
| Asphalt taxiway | Medium (0.2-0.4) | 1-2% cross-slope | Moderate returns |
| Wet concrete | Very high (0.8+) | Same | Specular reflection, phantom returns below ground |
| Snow-covered | High but diffuse | Altered by accumulation | Ground plane shifts upward |
| Painted markings | Variable | Same | Intensity jumps confuse some filters |
| Grooved concrete | High | Same | Speckle pattern in returns |

**Ground plane estimation is the foundation of 3D detection** — if the ground is wrong, all heights are wrong, and objects are mislocated vertically.

**Adaptation approach:**
1. **Online RANSAC with memory:** Maintain a running estimate of ground plane parameters (a, b, c, d in ax + by + cz + d = 0), update with exponential smoothing
2. **Slope map pre-computation:** During site survey, build a spatial map of ground slopes. At runtime, look up expected slope per position.
3. **Reflectance-adaptive filtering:** If surface reflectance changes significantly (wet → dry transition), adjust SOR (Statistical Outlier Removal) parameters dynamically

### 8.3 3D-Specific TTA Methods

#### PCT-TTA: Point Cloud Transformer with Test-Time Adaptation

Adapts point cloud transformers at test time by:
1. Updating positional encoding parameters based on test point distribution
2. Adjusting attention temperature to handle density variation
3. Self-supervised reconstruction auxiliary loss on test points

#### Domain Adaptation for Different Sensor Configurations (2025)

Recent work directly targets the performance impact of sensor placement differences between single-LiDAR and multi-LiDAR setups:

- **Partial Layer Fine-tuning:** Selectively update only layers most effective at bridging sensor configuration domain gaps. The backbone and neck are most sensitive to viewpoint and sensor placement.
- **Ground plane alignment:** Standardize by aligning the origin with the ground plane, regardless of sensor mounting height.
- **Beam pattern augmentation:** Data augmentation that simulates different LiDAR beam patterns and resolutions during training.

**Key finding:** The backbone and neck layers are most sensitive to sensor configuration changes, while detection heads are relatively robust. This suggests that adapting only the early layers (as in APCoTTA's DSTL approach) is the right strategy for cross-vehicle adaptation.

#### UADA3D: Unsupervised Adversarial Domain Adaptation for 3D

UADA3D handles large domain gaps in LiDAR 3D detection (e.g., Waymo → nuScenes) using:
1. Adversarial feature alignment in BEV space
2. Self-paced pseudo-labeling with curriculum difficulty
3. Point cloud statistical normalization

**Reported results:** Reduces domain gap by 50-70% on cross-dataset benchmarks, which translates to approximately 10-20% mAP recovery for cross-airport deployment.

### 8.4 RoboSense-Specific Considerations

Aurrigo uses RoboSense RSHELIOS (32-beam, 905nm) and RSBP (32-beam, 905nm) sensors. Specific adaptation concerns:

| Issue | Cause | Adaptation Strategy |
|-------|-------|-------------------|
| **Temperature drift** | Laser wavelength shifts with temperature | Per-airport intensity recalibration (automatic) |
| **Multi-sensor interference** | 4-8 sensors on same vehicle | Noise filter tuned per vehicle configuration |
| **Aging degradation** | Laser power decreases over 3-5 years | Monitor return intensity statistics, compensate |
| **Firmware updates** | New firmware may change point cloud characteristics | Re-run TTA after any firmware update |
| **Lens contamination** | De-icing spray, dust, insects | Detect via sudden density drop, trigger cleaning |

---

## 9. Practical Fleet-Scale Strategy

### 9.1 Phase 1: Pre-Deployment Site Survey + Fine-Tuning

**Duration:** 1-2 weeks before go-live
**Personnel:** 1 engineer on-site + remote ML team

```
Day 1-2: Data collection
  - Drive the autonomous route manually with full sensor recording
  - Cover all stands, taxiways, apron areas
  - Record at different times of day (dawn, midday, dusk, night)
  - Record in current weather + wait for at least one weather change if possible
  - Target: 20-30 hours of driving data (~7M LiDAR frames)

Day 3-4: OOD analysis
  - Run pre-trained model on collected data
  - Compute OOD scores for every frame
  - Identify: OOD rate, dominant OOD categories, severity distribution
  - Expected: 10-30% mild OOD, 2-5% moderate OOD, <1% severe OOD

Day 5-7: Active learning + annotation
  - Select top 500-2000 frames by priority score
  - Annotate with 3D bounding boxes (outsource or use 3D auto-labeling + verify)
  - Create airport-specific validation set (200 frames, held out)

Day 8-10: Adaptation
  - Option A: LoRA fine-tuning with airport-specific data (~4 hours on 1x A100)
  - Option B: SFDA (SHOT + TTYD) if no labels available (~8 hours)
  - Option C: Combination — SFDA first, then supervised LoRA on labeled subset
  - Validate on held-out set: target >90% of source airport mAP

Day 11-14: Integration testing
  - Deploy adapted model on vehicle in shadow mode
  - Run alongside classical RANSAC stack
  - Compare outputs, verify no regressions
  - Tune OOD thresholds for this specific airport
```

### 9.2 Phase 2: Shadow Mode with OOD Monitoring

**Duration:** 2-4 weeks
**Purpose:** Validate adapted model under real operational conditions before going live

```python
#!/usr/bin/env python3
"""
ROS node for OOD-aware confidence monitoring during shadow mode.
Publishes OOD scores, logs edge cases, triggers adaptation pipeline.

For Aurrigo ROS Noetic stack.
"""

import rospy
import numpy as np
from std_msgs.msg import Float32, String, Header
from sensor_msgs.msg import PointCloud2
from diagnostic_msgs.msg import DiagnosticStatus, KeyValue
import json
import os
from collections import deque
from datetime import datetime


class ConfidenceMonitor:
    """
    Shadow mode confidence monitor.
    Subscribes to perception outputs, computes OOD scores,
    publishes diagnostics, logs edge cases for active learning.
    """
    
    def __init__(self):
        rospy.init_node('confidence_monitor', anonymous=False)
        
        # Parameters
        self.ood_threshold_mild = rospy.get_param('~ood_threshold_mild', 0.3)
        self.ood_threshold_severe = rospy.get_param('~ood_threshold_severe', 0.7)
        self.log_dir = rospy.get_param('~log_dir', '/data/edge_cases/')
        self.window_size = rospy.get_param('~window_size', 100)
        self.alert_rate_threshold = rospy.get_param('~alert_rate_threshold', 0.20)
        self.enable_tta = rospy.get_param('~enable_tta', False)
        
        # State
        self.ood_history = deque(maxlen=self.window_size)
        self.frame_count = 0
        self.edge_case_count = 0
        self.session_start = datetime.now()
        
        # Publishers
        self.pub_ood_score = rospy.Publisher(
            '/perception/ood_score', Float32, queue_size=10)
        self.pub_severity = rospy.Publisher(
            '/perception/ood_severity', String, queue_size=10)
        self.pub_diagnostics = rospy.Publisher(
            '/diagnostics', DiagnosticStatus, queue_size=10)
        self.pub_tta_trigger = rospy.Publisher(
            '/perception/tta_trigger', String, queue_size=1)
        self.pub_speed_limit = rospy.Publisher(
            '/safety/ood_speed_limit', Float32, queue_size=1)
        
        # Subscribers
        rospy.Subscriber(
            '/perception/detection_confidences', 
            Float32,  # Would be custom msg in practice
            self.confidence_callback)
        rospy.Subscriber(
            '/perception/features',
            Float32,  # Would be custom msg in practice
            self.feature_callback)
        
        # Ensure log directory exists
        os.makedirs(self.log_dir, exist_ok=True)
        
        # Periodic reporting
        rospy.Timer(rospy.Duration(60), self.publish_summary)
        
        rospy.loginfo(
            f"Confidence monitor started. "
            f"Thresholds: mild={self.ood_threshold_mild}, "
            f"severe={self.ood_threshold_severe}")
    
    def compute_ood_score(self, confidences, features=None):
        """
        Compute combined OOD score from detection confidences.
        In production, would also use Mahalanobis distance on features.
        
        Simplified version using entropy of confidence distribution.
        """
        confs = np.array(confidences)
        if len(confs) == 0:
            # No detections at all — could be OOD (empty scene) or
            # genuinely empty. Use historical context.
            return 0.5  # Uncertain
        
        # Entropy of confidence distribution
        mean_conf = np.mean(confs)
        conf_entropy = -np.mean(
            confs * np.log(confs + 1e-8) + 
            (1 - confs) * np.log(1 - confs + 1e-8)
        )
        
        # Low mean confidence + high entropy = likely OOD
        ood_score = (1 - mean_conf) * 0.5 + conf_entropy * 0.5
        
        return float(np.clip(ood_score, 0.0, 1.0))
    
    def classify_severity(self, ood_score):
        """Map OOD score to severity level and speed limit."""
        if ood_score < self.ood_threshold_mild:
            return 'in_dist', 15.0  # km/h — normal speed
        elif ood_score < 0.5:
            return 'mild_ood', 10.0
        elif ood_score < self.ood_threshold_severe:
            return 'moderate_ood', 5.0
        else:
            return 'severe_ood', 2.0  # Creep or stop
    
    def confidence_callback(self, msg):
        """Process incoming detection confidences."""
        self.frame_count += 1
        
        # In practice, parse detection message for all box confidences
        confidences = [msg.data]  # Simplified — single value
        
        ood_score = self.compute_ood_score(confidences)
        severity, speed_limit = self.classify_severity(ood_score)
        
        # Publish
        self.pub_ood_score.publish(Float32(data=ood_score))
        self.pub_severity.publish(String(data=severity))
        self.pub_speed_limit.publish(Float32(data=speed_limit))
        
        # Track history
        self.ood_history.append(ood_score)
        
        # Log edge cases
        if severity in ('moderate_ood', 'severe_ood'):
            self.log_edge_case(ood_score, severity)
        
        # Check if sustained high OOD rate
        if len(self.ood_history) >= self.window_size:
            ood_rate = sum(
                1 for s in self.ood_history 
                if s > self.ood_threshold_mild
            ) / len(self.ood_history)
            
            if ood_rate > self.alert_rate_threshold:
                self.trigger_adaptation_alert(ood_rate)
    
    def log_edge_case(self, ood_score, severity):
        """Log edge case metadata for active learning pipeline."""
        self.edge_case_count += 1
        
        entry = {
            'timestamp': rospy.Time.now().to_sec(),
            'frame_id': self.frame_count,
            'ood_score': ood_score,
            'severity': severity,
            'session': self.session_start.isoformat()
        }
        
        log_file = os.path.join(
            self.log_dir, 
            f"edge_cases_{self.session_start.strftime('%Y%m%d')}.jsonl"
        )
        with open(log_file, 'a') as f:
            f.write(json.dumps(entry) + '\n')
    
    def trigger_adaptation_alert(self, ood_rate):
        """Alert when sustained OOD rate exceeds threshold."""
        msg = (
            f"SUSTAINED_OOD: rate={ood_rate:.2f} over "
            f"last {self.window_size} frames. "
            f"Consider triggering TTA or model rollback."
        )
        
        rospy.logwarn(msg)
        self.pub_tta_trigger.publish(String(data=msg))
        
        # Publish diagnostic
        diag = DiagnosticStatus()
        diag.level = DiagnosticStatus.WARN
        diag.name = 'perception/ood_monitor'
        diag.message = msg
        diag.values = [
            KeyValue(key='ood_rate', value=f'{ood_rate:.3f}'),
            KeyValue(key='threshold', value=f'{self.alert_rate_threshold:.3f}'),
            KeyValue(key='frames_analyzed', value=str(self.frame_count)),
            KeyValue(key='edge_cases_logged', value=str(self.edge_case_count))
        ]
        self.pub_diagnostics.publish(diag)
    
    def publish_summary(self, event):
        """Periodic summary of OOD statistics."""
        if len(self.ood_history) == 0:
            return
        
        scores = np.array(list(self.ood_history))
        
        diag = DiagnosticStatus()
        diag.level = DiagnosticStatus.OK
        diag.name = 'perception/ood_summary'
        diag.message = f'OOD monitoring active ({self.frame_count} frames)'
        diag.values = [
            KeyValue(key='mean_ood_score', value=f'{np.mean(scores):.3f}'),
            KeyValue(key='max_ood_score', value=f'{np.max(scores):.3f}'),
            KeyValue(key='ood_rate_mild', value=f'{np.mean(scores > self.ood_threshold_mild):.3f}'),
            KeyValue(key='ood_rate_severe', value=f'{np.mean(scores > self.ood_threshold_severe):.3f}'),
            KeyValue(key='edge_cases_total', value=str(self.edge_case_count)),
            KeyValue(key='total_frames', value=str(self.frame_count))
        ]
        self.pub_diagnostics.publish(diag)
    
    def feature_callback(self, msg):
        """
        Process feature vectors for Mahalanobis distance OOD.
        Placeholder — in production, would receive features from
        perception backbone and compute full Mahalanobis + energy OOD.
        """
        pass


if __name__ == '__main__':
    try:
        monitor = ConfidenceMonitor()
        rospy.spin()
    except rospy.ROSInterruptException:
        pass
```

### 9.3 Phase 3: Progressive TTA with Safety Gates

**Duration:** First 1-3 months of autonomous operation
**Purpose:** Allow model to continue adapting while maintaining safety

```
Safety gates for TTA:
  
  Gate 1: Sample quality
    - Only adapt on samples with entropy in [E_low, E_high] range
    - Too low entropy = already confident, no benefit to adapting
    - Too high entropy = too uncertain, adaptation may be harmful
    - Typical: E_low = 0.1, E_high = 0.6 (on 0-1 normalized scale)
  
  Gate 2: Batch consistency
    - Only adapt if >80% of samples in the batch agree on predictions
    - If batch is inconsistent, the shift may be too severe for TTA
  
  Gate 3: Performance monitoring
    - Maintain a small set of "canary" scenarios (known ground truth)
    - Run canary check every 1000 frames
    - If canary accuracy drops >5%, revert TTA updates
  
  Gate 4: Rate limiting
    - Maximum 1 TTA update per 10 seconds (not every frame)
    - Accumulate frames into mini-batches before adapting
    - Prevents oscillation from noisy single-frame updates
  
  Gate 5: Rollback readiness
    - Always keep last-known-good checkpoint in memory
    - If any safety metric degrades, revert in <100ms
```

### 9.4 Phase 4: Active Learning Loop with Human-in-the-Loop

**Duration:** Ongoing (continuous improvement)
**Purpose:** Systematically improve the model at each airport using fleet data

```
Weekly cycle:
  
  Monday-Friday: Fleet operates, edge cases logged automatically
    - ~5,000 edge case frames per vehicle per week
    - Priority-ranked by OOD score + uncertainty + rarity
  
  Saturday: Active learning selection
    - Select top 100-200 frames across fleet for labeling
    - Criteria: highest priority, maximum diversity, class balance
    - Auto-generate 3D bounding box proposals using current model
    - Upload to annotation platform with proposals pre-filled
  
  Sunday: Human annotation review
    - Annotators verify/correct auto-proposals (4-8 hours for 200 frames)
    - Cost: $400-800/week at $2-4/frame
    - Quality check: 10% re-annotated by second annotator
  
  Monday: Model update
    - LoRA fine-tune on new labeled data + replay buffer
    - Validate on airport-specific validation set
    - A/B test: new model vs current model on recent unlabeled data
    - If improved: deploy to fleet (OTA update)
    - If regressed: investigate, keep current model
```

### 9.5 ROS Integration Points

| ROS Topic | Type | Publisher | Purpose |
|-----------|------|-----------|---------|
| `/perception/ood_score` | Float32 | OOD detector | Per-frame OOD score |
| `/perception/ood_severity` | String | OOD detector | 'in_dist', 'mild_ood', 'severe_ood' |
| `/safety/ood_speed_limit` | Float32 | Confidence monitor | Speed limit based on OOD |
| `/perception/tta_trigger` | String | Confidence monitor | Alert for adaptation needed |
| `/perception/edge_case_log` | String | Active learning | Edge case metadata |
| `/fleet/model_version` | String | Model manager | Current model version |
| `/fleet/adaptation_status` | String | TTA controller | 'idle', 'adapting', 'validating' |
| `/diagnostics` | DiagnosticStatus | All monitors | Standard ROS diagnostics |

---

## 10. Cost and Timeline

### 10.1 Per-Airport Deployment Cost

| Item | Without Adaptation Pipeline | With Adaptation Pipeline |
|------|---------------------------|------------------------|
| Site survey (data collection) | $15K-30K (2 weeks, 1 engineer) | $10K-15K (1 week, 1 engineer) |
| Manual labeling | $50K-150K (10K-50K frames) | $5K-15K (500-2000 frames) |
| Model training | $2K-5K (cloud GPU) | $1K-3K (LoRA fine-tune) |
| Validation / testing | $10K-20K (2-4 weeks) | $5K-10K (1-2 weeks shadow mode) |
| Integration | $5K-10K | $2K-5K (standardized pipeline) |
| **Total per airport** | **$82K-215K** | **$23K-48K** |
| **Time to deployment** | **6-12 weeks** | **3-5 weeks** |

**Savings: 60-75% cost reduction, 50% time reduction.**

### 10.2 Infrastructure Cost (One-Time)

| Component | Cost | Purpose |
|-----------|------|---------|
| Active learning platform (Label Studio + customization) | $5K-15K | Annotation interface + auto-proposal |
| OOD detection module development | $20K-40K | Mahalanobis + energy scoring |
| TTA integration (SAR/EATA + ROS) | $15K-30K | Real-time adaptation pipeline |
| Continual learning framework | $10K-20K | EWC/LoRA + replay buffer + versioning |
| Fleet telemetry dashboard | $10K-20K | Monitoring OOD rates, model performance |
| Cloud GPU allocation (ongoing) | $500-2K/month | Weekly fine-tuning + validation |
| **Total infrastructure** | **$60K-125K** | **Amortized across all airports** |

**Break-even:** Infrastructure investment pays for itself after 2-3 airport deployments.

### 10.3 Engineering Effort

| Task | Effort | Skills Required |
|------|--------|----------------|
| OOD detector implementation | 2-3 weeks | ML engineer |
| TTA pipeline (SAR/EATA + ROS) | 3-4 weeks | ML engineer + ROS developer |
| Active learning pipeline | 2-3 weeks | ML engineer + data engineer |
| Continual learning (EWC + LoRA) | 2-3 weeks | ML engineer |
| Fleet monitoring dashboard | 2-3 weeks | Full-stack developer |
| Integration testing | 2-3 weeks | Systems engineer |
| **Total initial development** | **13-19 weeks** | **2-3 engineers** |

### 10.4 Data Requirements Per Airport

| Data Type | Volume | Purpose | Collection Method |
|-----------|--------|---------|------------------|
| Unlabeled LiDAR scans | 20-30 hours (~7M frames) | TTA, OOD baseline, SFDA | Shadow mode driving |
| Labeled 3D bounding boxes | 500-2000 frames | Fine-tuning, validation | Active learning selection |
| Airport metadata | 1 file | Ground plane, geofences, routes | Site survey + AMDB data |
| Weather log | Continuous | Correlate OOD with conditions | Weather API integration |
| Canary scenarios | 50-100 frames with ground truth | Performance monitoring | Manually verified during survey |

---

## 11. Recommended Pipeline for Aurrigo

### 11.1 Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                    AURRIGO ADAPTATION PIPELINE                       │
│                                                                      │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐        │
│  │  Base Model   │     │Airport LoRA  │     │  TTA Module  │        │
│  │ (PointPillars │ ──▶ │  Adapter     │ ──▶ │  (SAR/EATA)  │        │
│  │  or Center-   │     │ (4MB each)   │     │  Real-time   │        │
│  │  Point)       │     │              │     │  BN updates  │        │
│  └──────────────┘     └──────────────┘     └──────┬───────┘        │
│                                                     │                │
│  ┌──────────────┐     ┌──────────────┐     ┌──────▼───────┐        │
│  │  OOD         │ ◀── │  Feature     │ ◀── │  Perception  │        │
│  │  Detector    │     │  Extractor   │     │  Output      │        │
│  │ (Mahal +     │     │ (penultimate │     │ (detections) │        │
│  │  Energy)     │     │  layer)      │     │              │        │
│  └──────┬───────┘     └──────────────┘     └──────────────┘        │
│         │                                                            │
│  ┌──────▼──────────────────────────────────────────────────┐        │
│  │                DECISION LAYER                            │        │
│  │  OOD Score → Simplex Arbitrator → Stack Selection        │        │
│  │  OOD Score → Speed Limit → Planner Constraint            │        │
│  │  OOD Score → Edge Case Log → Active Learning Queue       │        │
│  └──────────────────────────────────────────────────────────┘        │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────┐        │
│  │              OFFLINE LEARNING LOOP                        │        │
│  │  Edge Cases → Priority Selection → Human Labeling →       │        │
│  │  LoRA Fine-tune → Validation → OTA Deploy                 │        │
│  └──────────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────────┘
```

### 11.2 Component Specifications

| Component | Implementation | Latency Budget | Memory Budget |
|-----------|---------------|----------------|---------------|
| Base model (PointPillars) | TensorRT INT8 on Orin | 6.8ms | 200MB |
| Airport LoRA adapter | PyTorch, merged at load time | 0ms (merged) | 4MB per airport |
| TTA (SAR) | BN affine update, 1 step/100 frames | 2ms every 10s | 50MB (Fisher matrix) |
| OOD detector | Mahalanobis + energy, batched | 1.5ms | 100MB (class statistics) |
| Confidence monitor (ROS node) | Python, 10Hz | 0.5ms | 50MB |
| Edge case logger | Async disk write | Non-blocking | 10MB buffer |
| **Total additional overhead** | | **~5ms amortized** | **~410MB** |

Orin has 32GB shared memory and the base perception pipeline uses ~4GB, leaving ample headroom for adaptation components.

### 11.3 Recommended Method Stack

**Tier 1 — Deploy immediately (low risk, high value):**
1. **OOD detection** (Mahalanobis + energy) → Enables Simplex switching, logs edge cases
2. **Confidence monitoring ROS node** → Fleet-wide visibility into model health
3. **Edge case logging** → Foundation for active learning

**Tier 2 — Deploy after validation (medium risk, high value):**
4. **EATA (test-time adaptation)** → Efficient anti-forgetting adaptation during inference
5. **LoRA per airport** → Lightweight airport-specific customization
6. **Active learning selection** → 100x reduction in labeling cost

**Tier 3 — Deploy after research (higher complexity):**
7. **MOS (model synergy)** → Multi-checkpoint ensemble for LiDAR-specific TTA
8. **ReservoirTTA** → Multi-domain model reservoir for recurring conditions
9. **CloudFixer** → Input-space adaptation for cross-vehicle deployment

### 11.4 Integration Sequence

```
Month 1-2: OOD Detection + Monitoring
  - Implement Mahalanobis + energy OOD scoring
  - Deploy confidence_monitor ROS node
  - Integrate with Simplex arbitrator (OOD → classical stack fallback)
  - Establish edge case logging pipeline
  - Validate: does OOD score correlate with actual failures?

Month 3-4: Test-Time Adaptation
  - Implement EATA (entropy minimization + Fisher regularization)
  - Gate with OOD detector: only adapt on mild OOD, never on severe
  - Rate limit: maximum 1 TTA step per 100 frames (10 seconds)
  - Validate: does TTA improve detection on shifted data?
  - Monitor: does TTA cause any regression on in-distribution data?

Month 5-6: Active Learning + LoRA
  - Deploy active learning selection (uncertainty + OOD + rarity)
  - Set up labeling pipeline (Label Studio + 3D auto-proposals)
  - Train first airport-specific LoRA adapter
  - Validate: does LoRA + active learning match full-labeling performance?

Month 7-8: Fleet-Scale
  - Deploy LoRA adapters across multiple airports
  - Implement EWC continual learning for cross-airport adaptation
  - Build fleet telemetry dashboard
  - Validate: does the system maintain performance across all airports?

Month 9+: Advanced Methods
  - Evaluate MOS checkpoint ensemble for real-time TTA
  - Evaluate ReservoirTTA for seasonal condition handling
  - Evaluate CloudFixer for cross-vehicle deployment
  - Research: airside-specific benchmarks and evaluation criteria
```

### 11.5 Success Metrics

| Metric | Baseline (No Adaptation) | Target (With Pipeline) |
|--------|-------------------------|----------------------|
| mAP on new airport (day 1) | 55-65% | 55-65% (same — no change yet) |
| mAP after shadow mode (week 2) | 55-65% (no improvement) | 75-85% (TTA + fine-tune) |
| mAP after active learning (month 2) | 55-65% | 85-92% |
| Forgetting on previous airports | N/A | <3% mAP drop |
| Per-airport labeling cost | $50-150K | $5-15K |
| Time to deployment | 6-12 weeks | 3-5 weeks |
| Pedestrian false negative rate | Variable | <0.5% (safety critical) |
| OOD detection AUROC | N/A | >0.95 |
| Edge cases captured per week | 0 (none logged) | 100-500 (prioritized) |

---

## 12. References

### Test-Time Adaptation

1. Wang, D., Shelhamer, E., Liu, S., Olshausen, B., Darrell, T. (2021). "Tent: Fully Test-Time Adaptation by Entropy Minimization." ICLR 2021. [arXiv:2006.10726](https://arxiv.org/abs/2006.10726)

2. Wang, Q., Fink, O., Van Gool, L., Dai, D. (2022). "Continual Test-Time Domain Adaptation (CoTTA)." CVPR 2022. [GitHub](https://github.com/qinenergy/cotta)

3. Niu, S., Wu, J., Zhang, Y., Chen, Y., Zheng, S., Zhao, P., Tan, M. (2022). "Efficient Test-Time Model Adaptation without Forgetting (EATA)." ICML 2022. [arXiv:2204.02610](https://arxiv.org/abs/2204.02610)

4. Niu, S., Wu, J., Zhang, Y., Wen, Z., Chen, Y., Zhao, P., Tan, M. (2023). "Towards Stable Test-Time Adaptation in Dynamic Wild World (SAR)." ICLR 2023 (Oral). [arXiv:2302.12400](https://arxiv.org/abs/2302.12400)

5. Yuan, L., Xie, B., Li, S. (2023). "Robust Test-Time Adaptation in Dynamic Scenarios (RoTTA)." CVPR 2023.

6. Song, J., Lee, J., Kweon, I.S., Choi, S. (2023). "EcoTTA: Memory-Efficient Continual Test-Time Adaptation via Self-Distilled Regularization." CVPR 2023.

7. Dobler, M., Marsden, R.A., Yang, B. (2024). "In Search of Lost Online Test-Time Adaptation: A Survey." IJCV 2024. [Springer](https://link.springer.com/article/10.1007/s11263-024-02213-5)

### 3D Point Cloud and LiDAR-Specific

8. Shin, S., et al. (2024). "CloudFixer: Test-Time Adaptation for 3D Point Clouds via Diffusion-Guided Geometric Transformation." ECCV 2024. [arXiv:2407.16193](https://arxiv.org/abs/2407.16193)

9. Chen, Z., et al. (2025). "MOS: Model Synergy for Test-Time Adaptation on LiDAR-Based 3D Object Detection." ICLR 2025. [arXiv:2406.14878](https://arxiv.org/abs/2406.14878)

10. Gao, Y., et al. (2025). "APCoTTA: Continual Test-Time Adaptation for Semantic Segmentation of Airborne LiDAR Point Clouds." arXiv:2505.09971. [GitHub](https://github.com/Gaoyuan2/APCoTTA)

11. LTS5/EPFL. (2025). "ReservoirTTA: Prolonged Test-time Adaptation for Evolving and Recurring Domains." arXiv:2505.14511. [GitHub](https://github.com/LTS5/ReservoirTTA)

12. Michele, B., Boulch, A., Vu, T.H., Puy, G., Marlet, R., Courty, N. (2024). "Train Till You Drop: Towards Stable and Robust Source-free Unsupervised 3D Domain Adaptation." ECCV 2024. [GitHub](https://github.com/valeoai/TTYD)

13. Domain Adaptation for Different Sensor Configurations in 3D Object Detection. (2025). [arXiv:2509.04711](https://arxiv.org/abs/2509.04711)

### Source-Free Domain Adaptation

14. Liang, J., Hu, D., Feng, J. (2020). "Do We Really Need to Access the Source Data? Source Hypothesis Transfer for Unsupervised Domain Adaptation (SHOT)." ICML 2020.

15. Yang, S., Wang, Y., van de Weijer, J., Herranz, L., Jui, S. (2021). "Exploiting the Intrinsic Neighborhood Structure for Source-free Domain Adaptation (NRC)." NeurIPS 2021.

16. Yang, S., van de Weijer, J., Herranz, L., Jui, S. (2022). "Attracting and Dispersing: A Simple Approach for Source-free Domain Adaptation (AaD)." NeurIPS 2022.

17. Shin, S., et al. (2024). "SF(DA)^2: Source-Free Domain Adaptation Through the Lens of Data Augmentation." ICLR 2024. [GitHub](https://github.com/shinyflight/SFDA2)

18. Revisiting Source-Free Domain Adaptation: a New Perspective via Uncertainty Control. ICLR 2025.

### OOD Detection

19. Liu, W., Wang, X., Owens, J.D., Li, Y. (2020). "Energy-based Out-of-distribution Detection." NeurIPS 2020.

20. Lee, K., Lee, K., Lee, H., Shin, J. (2018). "A Simple Unified Framework for Detecting Out-of-Distribution Samples and Adversarial Attacks (Mahalanobis)." NeurIPS 2018.

21. Muller, M., et al. (2025). "Mahalanobis++: Improving OOD Detection via Feature Normalization." ICML 2025.

22. Shoeb, et al. (2025). "Out-of-Distribution Segmentation in Autonomous Driving: Problems and State of the Art." CVPR 2025 Workshop.

23. Shuolu, et al. (2025). "Out-of-Distribution Detection: A Task-Oriented Survey of Recent Advances." ACM Computing Surveys 2025. [GitHub](https://github.com/shuolucs/Awesome-Out-Of-Distribution-Detection)

### Continual Learning

24. Kirkpatrick, J., et al. (2017). "Overcoming Catastrophic Forgetting in Neural Networks (EWC)." PNAS 114(13), 3521-3526.

25. Mallya, A., Lazebnik, S. (2018). "PackNet: Adding Multiple Tasks to a Single Network by Iterative Pruning." CVPR 2018.

26. Hu, E.J., et al. (2022). "LoRA: Low-Rank Adaptation of Large Language Models." ICLR 2022.

### Test-Time Training

27. Sun, Y., Wang, X., Liu, Z., Miller, J., Efros, A.A., Hardt, M. (2020). "Test-Time Training with Self-Supervision for Generalization under Distribution Shifts." ICML 2020. [Project page](https://test-time-training.github.io/)

28. Sun, Y., et al. (2024). "Learning to (Learn at Test Time): RNNs with Expressive Hidden States (TTT)." arXiv:2310.13807.

29. "Specialization after Generalization: Towards Understanding Test-Time Training in Foundation Models." arXiv:2509.24510 (2025).

### Benchmarks and Surveys

30. Xie, L., et al. (2025). "RoboBEV: Towards Robust Bird's Eye View Perception under Corruptions." TPAMI 2025. [GitHub](https://github.com/Daniel-xsy/RoboBEV)

31. Liu, Y., et al. (2024). "RoboFusion: Robust Multi-Modal 3D Object Detection via SAM." IJCAI 2024. [GitHub](https://github.com/adept-thu/RoboFusion)

32. Awesome Domain Adaptation for 3D Object Detection. [GitHub](https://github.com/zhuoxiao-chen/awesome-domain-adaptation-3d-object-detection)

33. Awesome Test-Time Adaptation. [GitHub](https://github.com/tim-learn/awesome-test-time-adaptation)

34. Mario Dobler's TTA Benchmark. [GitHub](https://github.com/mariodoebler/test-time-adaptation)

---

*Document version: 1.0. Research current as of April 2026. Methods landscape is evolving rapidly — review quarterly for new ICLR/ICML/NeurIPS/ECCV publications.*
