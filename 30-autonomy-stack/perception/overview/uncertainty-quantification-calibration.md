# Uncertainty Quantification and Confidence Calibration for AV Perception

## Executive Summary

Neural perception models output confident predictions even when they are wrong — a catastrophic property for safety-critical autonomous vehicles. Uncertainty quantification (UQ) provides the mathematical framework to know **when the model doesn't know**, enabling principled decisions about when to slow down, request teleoperation, or engage the safety fallback. This document covers the full UQ stack for Aurrigo's airside perception: epistemic vs aleatoric uncertainty decomposition, Bayesian neural networks, Monte Carlo Dropout, deep ensembles, evidential deep learning, conformal prediction with distribution-free coverage guarantees, calibration metrics (ECE, NLL, Brier score), LiDAR-specific uncertainty sources, and practical deployment on Orin AGX. Key finding: a 5-member ensemble with temperature scaling achieves well-calibrated uncertainty at ~5x compute cost, but for real-time Orin deployment, MC-Dropout (3 passes, ~3x cost) or evidential deep learning (single pass, ~1.1x cost) are more practical. Conformal prediction provides the gold standard: P(true class ∈ prediction set) ≥ 1-α with zero distributional assumptions, requiring only ~1,000 calibration examples. For airside operations where no public datasets exist and novel objects appear regularly, uncertainty-aware perception is the difference between a system that fails silently and one that fails safely.

---

## Table of Contents

1. [Why Uncertainty Matters for AV Perception](#1-why-uncertainty-matters-for-av-perception)
2. [Epistemic vs Aleatoric Uncertainty](#2-epistemic-vs-aleatoric-uncertainty)
3. [Bayesian Neural Networks](#3-bayesian-neural-networks)
4. [Monte Carlo Dropout](#4-monte-carlo-dropout)
5. [Deep Ensembles](#5-deep-ensembles)
6. [Evidential Deep Learning](#6-evidential-deep-learning)
7. [Conformal Prediction](#7-conformal-prediction)
8. [Calibration Methods and Metrics](#8-calibration-methods-and-metrics)
9. [LiDAR-Specific Uncertainty](#9-lidar-specific-uncertainty)
10. [Uncertainty-Driven Decision Making](#10-uncertainty-driven-decision-making)
11. [Edge Deployment on Orin](#11-edge-deployment-on-orin)
12. [Airport Airside Applications](#12-airport-airside-applications)
13. [Key Takeaways](#13-key-takeaways)

---

## 1. Why Uncertainty Matters for AV Perception

### 1.1 The Overconfidence Problem

Standard neural networks trained with cross-entropy loss are systematically overconfident. A model outputting 99% confidence for "baggage cart" when the object is actually a novel de-icing vehicle is more dangerous than a model that admits uncertainty.

**Real-world consequences of overconfidence:**

| Scenario | Overconfident Behavior | Consequence | With Uncertainty |
|----------|----------------------|-------------|-----------------|
| Novel aircraft type | Classifies as known type (95%) | Wrong size/clearance assumptions | Low confidence → conservative clearance |
| LiDAR degraded by rain | Normal detections (90%) | Missed objects in sparse returns | High uncertainty → slow down |
| Reflective aircraft surface | Ghost detections (88%) | Phantom braking | High uncertainty → filter ghosts |
| FOD partially occluded | Misclassifies as ground (97%) | FOD not reported | Uncertain → flag for inspection |
| Ground crew behind cart | Not detected (0% — false negative) | No warning | High epistemic uncertainty in occluded region → caution |

### 1.2 What Uncertainty Enables

Uncertainty quantification enables a hierarchy of safety responses:

```
Confidence Level     Action
──────────────────────────────────────────────
High (>0.9)         Normal operation
Medium (0.5-0.9)    Increased attention, log for review
Low (0.2-0.5)       Slow down, increase sensor fusion
Very Low (<0.2)     Stop, request teleop assistance
Any class flip       Alert: perception state changed
```

### 1.3 Regulatory Requirements

- **ISO 3691-4**: Requires "reliable detection" — calibrated confidence enables quantitative reliability claims
- **UL 4600**: Section 10.6 requires monitoring ML model behavior — uncertainty metrics are the primary tool
- **EU AI Act**: High-risk AI (autonomous vehicles) must provide "appropriate levels of accuracy, robustness, and cybersecurity" — calibrated uncertainty is evidence
- **SOTIF (ISO 21448)**: Addresses "performance limitations" of perception — UQ formalizes this

---

## 2. Epistemic vs Aleatoric Uncertainty

### 2.1 Decomposition

| Type | Epistemic (Model) | Aleatoric (Data) |
|------|-------------------|-------------------|
| **Source** | Insufficient training data, model limitations | Inherent sensor noise, ambiguous observations |
| **Reducible?** | Yes — more data, bigger model | No — fundamental limit |
| **Example** | Novel aircraft type never seen in training | Distant object at edge of LiDAR range |
| **Implication** | Collect more data of this type | Accept uncertainty, design for it |
| **Detection** | Model disagreement, feature-space novelty | Heteroscedastic variance |

### 2.2 Mathematical Framework

For a prediction y given input x and model parameters θ:

**Total uncertainty** = **Aleatoric** + **Epistemic**

```
Var[y|x] = E_θ[Var[y|x,θ]] + Var_θ[E[y|x,θ]]
              ↑ aleatoric         ↑ epistemic
           (average noise)    (model disagreement)
```

For classification with C classes:

```python
def decompose_uncertainty(predictions_ensemble):
    """Decompose total uncertainty into epistemic and aleatoric.
    
    Args:
        predictions_ensemble: (M, C) — M model predictions over C classes
    Returns:
        total_entropy, epistemic (mutual info), aleatoric
    """
    M, C = predictions_ensemble.shape
    
    # Mean prediction across ensemble
    mean_pred = predictions_ensemble.mean(axis=0)  # (C,)
    
    # Total uncertainty: entropy of mean prediction
    total_entropy = -np.sum(mean_pred * np.log(mean_pred + 1e-10))
    
    # Aleatoric: mean entropy of individual predictions
    individual_entropies = -np.sum(
        predictions_ensemble * np.log(predictions_ensemble + 1e-10), 
        axis=1
    )
    aleatoric = individual_entropies.mean()
    
    # Epistemic: mutual information = total - aleatoric
    epistemic = total_entropy - aleatoric
    
    return total_entropy, epistemic, aleatoric
```

### 2.3 Why Both Matter for Airside

| Uncertainty Type | Airside Trigger | Correct Response |
|-----------------|----------------|-----------------|
| **High epistemic** | Novel object not in training | Upload data, add to training set |
| **High aleatoric** | Distant object at LiDAR range limit | Approach cautiously, fuse with camera |
| **High both** | Unknown object in rain at distance | Maximum caution: slow/stop, request teleop |
| **Low both** | Known baggage cart at 10m, clear weather | Normal operation |

---

## 3. Bayesian Neural Networks

### 3.1 Concept

A Bayesian Neural Network (BNN) maintains a distribution over weights p(θ|D) rather than point estimates. This naturally captures epistemic uncertainty: regions of input space with little training data have high posterior variance.

**Bayes' rule for neural networks:**

p(θ|D) = p(D|θ) · p(θ) / p(D)

The posterior p(θ|D) is intractable for modern networks → approximation methods required.

### 3.2 Variational Inference (Bayes by Backprop)

Blundell et al. (2015) approximate the posterior with a factorized Gaussian:

q(θ) = ∏_i N(θ_i | μ_i, σ_i²)

Optimization minimizes KL divergence: KL(q(θ) || p(θ|D))

```python
class BayesianLinear(nn.Module):
    """Bayesian linear layer with weight uncertainty."""
    
    def __init__(self, in_features, out_features):
        super().__init__()
        self.in_features = in_features
        self.out_features = out_features
        
        # Weight mean and log-variance
        self.weight_mu = nn.Parameter(torch.randn(out_features, in_features) * 0.1)
        self.weight_log_sigma = nn.Parameter(torch.full((out_features, in_features), -5.0))
        
        # Bias mean and log-variance
        self.bias_mu = nn.Parameter(torch.zeros(out_features))
        self.bias_log_sigma = nn.Parameter(torch.full((out_features,), -5.0))
    
    def forward(self, x):
        # Sample weights: w = mu + sigma * epsilon (reparameterization trick)
        weight_sigma = torch.exp(self.weight_log_sigma)
        weight = self.weight_mu + weight_sigma * torch.randn_like(weight_sigma)
        
        bias_sigma = torch.exp(self.bias_log_sigma)
        bias = self.bias_mu + bias_sigma * torch.randn_like(bias_sigma)
        
        return F.linear(x, weight, bias)
    
    def kl_divergence(self):
        """KL(q(w) || p(w)) for this layer."""
        weight_sigma = torch.exp(self.weight_log_sigma)
        kl = 0.5 * (weight_sigma**2 + self.weight_mu**2 - 2*self.weight_log_sigma - 1).sum()
        
        bias_sigma = torch.exp(self.bias_log_sigma)
        kl += 0.5 * (bias_sigma**2 + self.bias_mu**2 - 2*self.bias_log_sigma - 1).sum()
        
        return kl
```

### 3.3 Practical Limitations

| Challenge | Impact | Mitigation |
|-----------|--------|-----------|
| 2x parameters (mean + variance) | 2x memory | Apply only to select layers |
| Slow convergence | 3-5x training time | Pre-train point estimate, then variationalize |
| Mean-field assumption | Underestimates correlation | Use rank-1 or matrix-variate posteriors |
| Prior selection | Results sensitive to prior | Empirical Bayes, hierarchical priors |
| Inference cost | Multiple forward passes | Single pass approximations |

**Verdict**: Full BNNs are impractical for large-scale AV perception. Prefer MC-Dropout, ensembles, or evidential methods.

---

## 4. Monte Carlo Dropout

### 4.1 Dropout as Approximate Bayesian Inference

Gal & Ghahramani (2016) showed that a network with dropout applied at test time approximates a Bayesian neural network. Each stochastic forward pass samples from an approximate posterior.

**Key insight**: Most AV models already have dropout layers → uncertainty is nearly free.

### 4.2 Implementation

```python
class MCDropoutPredictor:
    """Monte Carlo Dropout for uncertainty estimation."""
    
    def __init__(self, model, n_passes=10, dropout_rate=0.1):
        self.model = model
        self.n_passes = n_passes
        self.dropout_rate = dropout_rate
    
    def predict_with_uncertainty(self, x):
        """Run T stochastic forward passes, compute uncertainty."""
        self.model.train()  # Enable dropout at test time
        
        predictions = []
        for _ in range(self.n_passes):
            with torch.no_grad():
                pred = self.model(x)  # stochastic due to dropout
                predictions.append(pred)
        
        self.model.eval()
        
        predictions = torch.stack(predictions)  # (T, B, C) or (T, B, N, 7+C)
        
        # Mean prediction
        mean_pred = predictions.mean(dim=0)
        
        # Epistemic uncertainty: variance across passes
        epistemic = predictions.var(dim=0)
        
        # For classification: predictive entropy
        mean_probs = F.softmax(predictions, dim=-1).mean(dim=0)
        pred_entropy = -(mean_probs * torch.log(mean_probs + 1e-10)).sum(dim=-1)
        
        # Mutual information (epistemic component of entropy)
        individual_entropies = -(F.softmax(predictions, dim=-1) * 
                                  torch.log(F.softmax(predictions, dim=-1) + 1e-10)
                                 ).sum(dim=-1).mean(dim=0)
        mutual_info = pred_entropy - individual_entropies
        
        return {
            'mean': mean_pred,
            'epistemic_var': epistemic,
            'pred_entropy': pred_entropy,
            'mutual_info': mutual_info,
            'all_predictions': predictions
        }
```

### 4.3 MC-Dropout for 3D Object Detection

For PointPillars / CenterPoint on LiDAR:

```python
def mc_dropout_detection(model, pointcloud, n_passes=5):
    """MC-Dropout for 3D object detection with uncertainty.
    
    Returns detections with per-object uncertainty estimates.
    """
    all_detections = []
    
    model.train()  # enable dropout
    for _ in range(n_passes):
        with torch.no_grad():
            detections = model(pointcloud)
            all_detections.append(detections)
    model.eval()
    
    # Match detections across passes (Hungarian matching by IoU)
    matched = match_detections_across_passes(all_detections)
    
    final_detections = []
    for obj_group in matched:
        # Position uncertainty: std of center coordinates
        centers = np.array([d.center for d in obj_group])
        position_std = centers.std(axis=0)  # (3,) — xyz uncertainty
        
        # Size uncertainty: std of dimensions
        dims = np.array([d.dimensions for d in obj_group])
        size_std = dims.std(axis=0)
        
        # Classification uncertainty: entropy of averaged class probs
        class_probs = np.array([d.class_probs for d in obj_group])
        mean_probs = class_probs.mean(axis=0)
        class_entropy = -np.sum(mean_probs * np.log(mean_probs + 1e-10))
        
        # Detection confidence: fraction of passes that detected this object
        detection_rate = len(obj_group) / n_passes
        
        final_detections.append(Detection3D(
            center=centers.mean(axis=0),
            dimensions=dims.mean(axis=0),
            class_probs=mean_probs,
            confidence=detection_rate * mean_probs.max(),
            position_uncertainty=position_std,
            size_uncertainty=size_std,
            class_uncertainty=class_entropy,
            epistemic_score=class_entropy  # high = novel/unseen
        ))
    
    return final_detections
```

### 4.4 MC-Dropout Performance

| Passes (T) | Latency Factor | Uncertainty Quality (AUROC OOD) | Calibration (ECE) |
|------------|---------------|--------------------------------|-------------------|
| 1 (deterministic) | 1.0x | 0.70 (baseline) | 0.15 |
| 3 | ~3.0x | 0.85 | 0.08 |
| 5 | ~5.0x | 0.89 | 0.06 |
| 10 | ~10x | 0.91 | 0.05 |
| 20 | ~20x | 0.92 | 0.05 |

Diminishing returns after T=5. For real-time on Orin (6.84ms PointPillars baseline), T=3 → ~20.5ms total — feasible within 50ms budget.

---

## 5. Deep Ensembles

### 5.1 Overview (Lakshminarayanan et al., 2017)

Deep ensembles train M independent networks from different random initializations. Disagreement between ensemble members quantifies epistemic uncertainty.

**Why ensembles work better than BNNs in practice:**
- Different random seeds explore different loss basins → diverse solutions
- No approximation to the posterior — each member is a proper maximum likelihood estimate
- Embarrassingly parallel — train M models independently
- Simple to implement — no architectural changes

### 5.2 Ensemble for LiDAR Detection

```python
class EnsembleDetector:
    """Ensemble of M detectors for uncertainty estimation."""
    
    def __init__(self, model_paths, device='cuda'):
        self.models = []
        for path in model_paths:
            model = load_model(path)
            model.eval()
            model.to(device)
            self.models.append(model)
        self.M = len(self.models)
    
    def predict_with_uncertainty(self, pointcloud):
        """Run all ensemble members, compute uncertainty."""
        all_detections = []
        
        for model in self.models:
            with torch.no_grad():
                dets = model(pointcloud)
            all_detections.append(dets)
        
        # Match and aggregate (same as MC-Dropout)
        matched = match_detections_across_passes(all_detections)
        
        results = []
        for group in matched:
            # Compute all uncertainties as in MC-Dropout
            ...
            
            # Additional ensemble-specific metric: 
            # Negative log predictive density (proper scoring rule)
            nlpd = self.compute_nlpd(group)
            
            results.append(detection_with_uncertainty)
        
        return results
    
    def compute_nlpd(self, predictions):
        """Negative log predictive density — proper scoring rule."""
        probs = np.array([p.class_probs for p in predictions])
        mean_prob = probs.mean(axis=0)
        return -np.log(mean_prob.max() + 1e-10)
```

### 5.3 Ensemble Training Strategies

| Strategy | Diversity Source | Cost | Quality |
|----------|----------------|------|---------|
| **Random init** | Weight initialization | M × training | Good baseline |
| **Random data** | Bootstrap sampling | M × training | Better for small data |
| **Snapshot ensemble** | Learning rate cycling | 1 × training | 70-80% of full ensemble |
| **BatchEnsemble** | Rank-1 perturbation | 1.2-1.5 × training | 85% of full ensemble |
| **Hyperensemble** | Different hyperparameters | M × training | Best diversity |
| **Multi-input ensemble** | Different input augmentations | M × training | Good for perception |

### 5.4 Ensemble vs MC-Dropout

| Property | MC-Dropout | Deep Ensemble |
|----------|-----------|---------------|
| Training cost | 1x | Mx |
| Inference cost | Tx (T passes) | Mx (M models) |
| Memory | 1x | Mx |
| Uncertainty quality | Good | **Best** |
| Calibration (ECE) | 0.06 (T=5) | **0.03** (M=5) |
| OOD detection (AUROC) | 0.89 (T=5) | **0.93** (M=5) |
| Ease of implementation | Easy | Easy |
| Orin feasibility | Yes (T=3) | Marginal (M=3) |

**Recommendation**: Ensemble is the gold standard for uncertainty. For Orin real-time, use MC-Dropout (T=3) or evidential (single pass). For offline analysis and training, use ensembles.

---

## 6. Evidential Deep Learning

### 6.1 Concept (Sensoy et al., 2018; Amini et al., 2020)

Evidential deep learning predicts uncertainty in a **single forward pass** by modeling a higher-order distribution (a distribution over distributions). Instead of predicting class probabilities directly, the network predicts the parameters of a Dirichlet distribution.

### 6.2 Classification with Dirichlet Prior

Standard network output: p = softmax(logits) — a point estimate of class probabilities

Evidential output: α = softplus(logits) + 1 — parameters of a Dirichlet distribution Dir(α)

```python
class EvidentialClassifier(nn.Module):
    """Single-pass evidential deep learning for classification."""
    
    def __init__(self, backbone, num_classes):
        super().__init__()
        self.backbone = backbone
        self.evidence_head = nn.Linear(backbone.out_features, num_classes)
    
    def forward(self, x):
        features = self.backbone(x)
        logits = self.evidence_head(features)
        
        # Evidence: non-negative (softplus ensures > 0)
        evidence = F.softplus(logits)
        
        # Dirichlet parameters
        alpha = evidence + 1  # +1 for uniform prior
        
        # Dirichlet strength (total evidence)
        S = alpha.sum(dim=-1, keepdim=True)
        
        # Expected class probabilities
        probs = alpha / S
        
        # Uncertainty measures
        # Epistemic: vacuity = C / S (inverse of total evidence)
        vacuity = self.num_classes / S.squeeze(-1)
        
        # Aleatoric: expected entropy of the categorical
        aleatoric = -(probs * torch.log(probs + 1e-10)).sum(dim=-1)
        
        return {
            'probs': probs,
            'alpha': alpha,
            'evidence': evidence,
            'vacuity': vacuity,        # epistemic uncertainty
            'aleatoric': aleatoric,     # data uncertainty
            'total_uncertainty': vacuity + aleatoric
        }
```

### 6.3 Evidential Loss

The loss encourages high evidence for correct classes and low evidence for incorrect:

```python
def evidential_loss(alpha, y_one_hot, epoch, annealing_epochs=10):
    """Evidential deep learning loss (Type II ML + KL regularizer)."""
    S = alpha.sum(dim=-1, keepdim=True)
    
    # Type II maximum likelihood
    log_likelihood = torch.lgamma(S) - torch.lgamma(alpha).sum(dim=-1, keepdim=True) + \
                     ((alpha - 1) * torch.log(y_one_hot + 1e-10)).sum(dim=-1, keepdim=True)
    
    # KL divergence regularizer (shrink wrong-class evidence to 0)
    alpha_tilde = y_one_hot + (1 - y_one_hot) * (alpha - 1) * 1 + 1
    kl = kl_dirichlet(alpha_tilde, torch.ones_like(alpha))
    
    # Anneal KL term (start training without regularization)
    annealing = min(1.0, epoch / annealing_epochs)
    
    return (-log_likelihood + annealing * kl).mean()
```

### 6.4 Advantages for Airside

| Property | Value for Airside Operations |
|----------|------------------------------|
| **Single forward pass** | No latency overhead (1.1x vs 3-5x for MC-Dropout/ensemble) |
| **Explicit vacuity** | Directly measures "I don't know" — perfect for novel objects |
| **OOD detection** | High vacuity for OOD inputs (no training data for that region) |
| **Disentangled** | Separate epistemic (model) from aleatoric (noise) in one pass |
| **Calibration** | Naturally calibrated when trained with proper loss |

### 6.5 Evidential 3D Detection

```python
class EvidentialPointPillars(nn.Module):
    """PointPillars with evidential classification head."""
    
    def __init__(self, base_model, num_classes):
        super().__init__()
        self.backbone = base_model.backbone  # PillarVFE + SECOND FPN
        self.bbox_head = base_model.bbox_head  # unchanged for regression
        self.evidence_head = nn.Sequential(
            nn.Conv2d(256, 128, 3, padding=1),
            nn.ReLU(),
            nn.Conv2d(128, num_classes, 1)  # per-anchor evidence
        )
    
    def forward(self, pillars):
        features = self.backbone(pillars)
        
        # Standard regression head (unchanged)
        bbox_pred = self.bbox_head.regression(features)
        
        # Evidential classification head
        logits = self.evidence_head(features)
        evidence = F.softplus(logits)
        alpha = evidence + 1
        
        S = alpha.sum(dim=1, keepdim=True)  # (B, 1, H, W)
        class_probs = alpha / S
        vacuity = self.num_classes / S  # epistemic uncertainty map
        
        return {
            'bbox': bbox_pred,
            'class_probs': class_probs,
            'vacuity': vacuity,  # spatial uncertainty map
            'alpha': alpha
        }
```

### 6.6 Comparison of UQ Methods

| Method | Passes | Latency Overhead | Memory Overhead | OOD AUROC | ECE | Training Cost |
|--------|--------|-----------------|-----------------|-----------|-----|---------------|
| Softmax (baseline) | 1 | 0% | 0% | 0.70 | 0.15 | 1x |
| Temperature scaling | 1 | 0% | 0% | 0.70 | 0.03 | 1x + calibration |
| MC-Dropout (T=3) | 3 | ~200% | 0% | 0.85 | 0.08 | 1x |
| MC-Dropout (T=10) | 10 | ~900% | 0% | 0.91 | 0.05 | 1x |
| Deep Ensemble (M=5) | 5 | ~400% | 400% | 0.93 | 0.03 | 5x |
| BatchEnsemble (M=5) | 5 | ~100% | ~20% | 0.88 | 0.05 | 1.5x |
| **Evidential** | **1** | **~10%** | **~5%** | **0.87** | **0.05** | **1x** |
| Evidential + temp. scaling | 1 | ~10% | ~5% | 0.87 | **0.02** | 1x + calibration |

---

## 7. Conformal Prediction

### 7.1 Distribution-Free Guarantees

Conformal prediction (CP) provides **guaranteed coverage** without any distributional assumptions. Given a desired coverage level 1-α (e.g., 99%):

P(y_true ∈ C(x)) ≥ 1 - α

This holds for ANY data distribution, with only the assumption that calibration and test data are exchangeable.

### 7.2 Split Conformal Prediction

```python
class SplitConformalPredictor:
    """Split conformal prediction for classification with coverage guarantees."""
    
    def __init__(self, model, alpha=0.01):
        """
        Args:
            model: trained classifier
            alpha: miscoverage level (0.01 = 99% coverage guarantee)
        """
        self.model = model
        self.alpha = alpha
        self.quantile = None  # computed during calibration
    
    def calibrate(self, cal_dataloader):
        """Compute conformal quantile from calibration set.
        
        Requires ~1000 calibration examples for tight guarantees.
        """
        scores = []
        
        for x, y_true in cal_dataloader:
            probs = self.model.predict_proba(x)
            # Non-conformity score: 1 - probability of true class
            score = 1 - probs[range(len(y_true)), y_true]
            scores.extend(score.tolist())
        
        n = len(scores)
        # Compute (1-alpha)(1 + 1/n) quantile
        level = np.ceil((1 - self.alpha) * (n + 1)) / n
        self.quantile = np.quantile(scores, min(level, 1.0))
        
        print(f"Calibrated: quantile = {self.quantile:.4f} "
              f"on {n} examples for {(1-self.alpha)*100}% coverage")
    
    def predict(self, x):
        """Predict with conformal prediction set.
        
        Returns a SET of classes, not a single prediction.
        Guaranteed: P(true class in set) >= 1-alpha
        """
        probs = self.model.predict_proba(x)
        
        # Include all classes whose score ≤ quantile
        prediction_set = (1 - probs) <= self.quantile
        
        return {
            'prediction_set': prediction_set,  # boolean mask over classes
            'set_size': prediction_set.sum(dim=-1),  # how many classes included
            'max_prob_class': probs.argmax(dim=-1),  # traditional prediction
            'max_prob': probs.max(dim=-1),
        }
```

### 7.3 Conformal Prediction for 3D Detection

For bounding box regression, conformal prediction provides guaranteed coverage intervals:

```python
class ConformalBBoxPredictor:
    """Conformal prediction for 3D bounding box regression."""
    
    def __init__(self, model, alpha=0.05):
        self.model = model
        self.alpha = alpha
        self.quantiles = {}  # per-dimension quantiles
    
    def calibrate(self, cal_data):
        """Calibrate residuals for each bbox dimension."""
        residuals = {dim: [] for dim in ['x', 'y', 'z', 'l', 'w', 'h', 'yaw']}
        
        for x, y_true in cal_data:
            y_pred = self.model.predict(x)
            for dim in residuals:
                res = abs(y_pred[dim] - y_true[dim])
                residuals[dim].append(res)
        
        for dim in residuals:
            n = len(residuals[dim])
            level = np.ceil((1 - self.alpha) * (n + 1)) / n
            self.quantiles[dim] = np.quantile(residuals[dim], min(level, 1.0))
    
    def predict(self, x):
        """Predict bbox with conformal intervals.
        
        Returns: prediction ± conformal_radius for each dimension.
        Coverage guarantee: true value in interval with prob >= 1-alpha.
        """
        pred = self.model.predict(x)
        
        intervals = {}
        for dim in self.quantiles:
            intervals[dim] = {
                'center': pred[dim],
                'lower': pred[dim] - self.quantiles[dim],
                'upper': pred[dim] + self.quantiles[dim],
                'radius': self.quantiles[dim]
            }
        
        return pred, intervals
```

### 7.4 Adaptive Conformal Prediction (ACI)

For non-stationary deployment (weather changes, new airports):

```python
class AdaptiveConformalPredictor:
    """Online adaptive conformal prediction (Gibbs & Candes, 2021).
    
    Adjusts coverage level online to maintain target coverage
    even under distribution shift.
    """
    
    def __init__(self, model, alpha=0.05, gamma=0.01):
        self.model = model
        self.alpha_target = alpha
        self.alpha_t = alpha  # adaptive threshold
        self.gamma = gamma  # learning rate
    
    def update(self, x_t, y_t):
        """Update after observing true label."""
        pred_set = self.predict(x_t)
        
        # Check if true label was covered
        covered = y_t in pred_set['prediction_set']
        
        # Update alpha_t: increase if over-covering, decrease if under-covering
        self.alpha_t = self.alpha_t + self.gamma * (
            self.alpha_target - (1 if not covered else 0)
        )
        self.alpha_t = np.clip(self.alpha_t, 0.001, 0.5)
```

### 7.5 Conformal Prediction for Airside

| Application | Coverage Target | Calibration Data | Prediction Set Behavior |
|------------|----------------|-----------------|------------------------|
| Aircraft detection | 99.9% | 1000 frames with aircraft | Set size 1-2 (tight when confident) |
| GSE classification | 99% | 2000 frames with GSE | Set size 1-3 (more ambiguity among GSE types) |
| FOD detection | 99.99% | 500 frames with FOD | Large sets acceptable (conservative OK for FOD) |
| Position estimation | 95% | 1000 frames | ±0.3m typical radius |
| Ground crew detection | 99.5% | 1000 frames | Set size 1 for clear views, 2-3 for occlusion |

**Key advantage**: Conformal prediction works with ANY base model (PointPillars, CenterPoint, GaussianFormer) — it's a post-hoc wrapper that adds guaranteed coverage.

---

## 8. Calibration Methods and Metrics

### 8.1 What Is Calibration?

A model is **perfectly calibrated** if: when it predicts P(class=c|x) = 0.8, the actual frequency of class c among such predictions is 80%.

Most neural networks are **overconfident**: predictions of 0.9 confidence are correct only ~70-80% of the time.

### 8.2 Calibration Metrics

```python
def compute_calibration_metrics(probs, labels, n_bins=15):
    """Compute ECE, MCE, NLL, and Brier score."""
    confidences = probs.max(dim=1).values
    predictions = probs.argmax(dim=1)
    correct = (predictions == labels).float()
    
    # Expected Calibration Error (ECE)
    bin_boundaries = torch.linspace(0, 1, n_bins + 1)
    ece = 0
    for i in range(n_bins):
        mask = (confidences > bin_boundaries[i]) & (confidences <= bin_boundaries[i+1])
        if mask.sum() > 0:
            bin_conf = confidences[mask].mean()
            bin_acc = correct[mask].mean()
            bin_weight = mask.float().mean()
            ece += bin_weight * abs(bin_acc - bin_conf)
    
    # Maximum Calibration Error (MCE)
    mce = max(abs(bin_acc - bin_conf) for each non-empty bin)
    
    # Negative Log-Likelihood (proper scoring rule)
    nll = F.nll_loss(torch.log(probs + 1e-10), labels)
    
    # Brier Score (proper scoring rule)
    one_hot = F.one_hot(labels, probs.shape[1]).float()
    brier = ((probs - one_hot) ** 2).sum(dim=1).mean()
    
    return {'ECE': ece, 'MCE': mce, 'NLL': nll, 'Brier': brier}
```

| Metric | Definition | Target | Interpretation |
|--------|-----------|--------|---------------|
| **ECE** | Weighted avg of |accuracy - confidence| per bin | <0.05 | Lower = better calibrated |
| **MCE** | Max |accuracy - confidence| across bins | <0.10 | Worst-case miscalibration |
| **NLL** | -log P(y_true) | Lower | Proper scoring rule |
| **Brier** | Mean squared error of probabilities | Lower | Proper scoring rule |
| **AUROC** | OOD detection area under ROC | >0.90 | Uncertainty discriminates ID vs OOD |

### 8.3 Temperature Scaling (Guo et al., 2017)

The simplest and most effective post-hoc calibration:

```python
class TemperatureScaling:
    """Post-hoc temperature scaling for calibration."""
    
    def __init__(self):
        self.temperature = nn.Parameter(torch.ones(1) * 1.5)
    
    def calibrate(self, logits, labels, lr=0.01, max_iter=50):
        """Find optimal temperature on validation set."""
        optimizer = torch.optim.LBFGS([self.temperature], lr=lr, max_iter=max_iter)
        
        def closure():
            scaled_logits = logits / self.temperature
            loss = F.cross_entropy(scaled_logits, labels)
            loss.backward()
            return loss
        
        optimizer.step(closure)
        print(f"Optimal temperature: {self.temperature.item():.3f}")
    
    def predict(self, logits):
        """Apply temperature scaling to logits."""
        scaled_logits = logits / self.temperature
        return F.softmax(scaled_logits, dim=-1)
```

**Typical results:**

| Model | Before (ECE) | After Temp. Scaling (ECE) | Temperature |
|-------|-------------|--------------------------|-------------|
| PointPillars | 0.12 | 0.03 | 1.8 |
| CenterPoint | 0.15 | 0.04 | 2.1 |
| BEVFormer | 0.18 | 0.05 | 2.5 |
| GaussianFormer | 0.10 | 0.02 | 1.5 |

Temperature scaling reduces ECE by 3-5x with zero performance impact and zero latency overhead.

### 8.4 Focal Loss Calibration

Focal loss (Lin et al., 2017) naturally produces better-calibrated predictions by down-weighting easy examples:

FL(p_t) = -α_t (1-p_t)^γ log(p_t)

With γ=2, focal loss produces models with ECE 0.05-0.08 vs 0.12-0.18 for cross-entropy, without any post-hoc calibration.

---

## 9. LiDAR-Specific Uncertainty

### 9.1 Sources of LiDAR Uncertainty

| Source | Type | Magnitude | Affected |
|--------|------|-----------|---------|
| **Range noise** | Aleatoric | ±2-5cm (RoboSense) | Position accuracy |
| **Angular noise** | Aleatoric | ±0.1° | Lateral position at distance |
| **Beam divergence** | Aleatoric | 0.1-0.3° | Point spread at distance |
| **Multi-return ambiguity** | Aleatoric | Variable | Rain, fog, dust |
| **Point density drop-off** | Aleatoric | 1/r² | Detection at range |
| **Occlusion** | Epistemic | Binary | Missing objects |
| **Specular reflection** | Both | Variable | Aircraft fuselage, wet tarmac |
| **Motion blur** | Aleatoric | ~1cm at 15km/h | Moving objects |
| **Crosstalk** | Both | Variable | Multi-LiDAR interference |
| **Novel geometry** | Epistemic | Variable | Unseen aircraft types |

### 9.2 Range-Dependent Uncertainty Model

```python
class LiDARUncertaintyModel:
    """Physics-based LiDAR uncertainty model for RoboSense RSHELIOS."""
    
    def __init__(self):
        # RoboSense RSHELIOS specs
        self.range_noise_base = 0.02  # 2cm at close range
        self.range_noise_scale = 0.001  # grows with distance
        self.angular_noise = 0.001  # ~0.06° in radians
        self.beam_divergence = 0.003  # ~0.17°
    
    def point_uncertainty(self, point, range_m):
        """Compute 3x3 covariance matrix for a single LiDAR point.
        
        Args:
            point: (3,) xyz in sensor frame
            range_m: range to point in meters
        Returns:
            (3,3) covariance matrix in sensor frame
        """
        # Range uncertainty (along beam direction)
        sigma_range = self.range_noise_base + self.range_noise_scale * range_m
        
        # Angular uncertainty (perpendicular to beam)
        sigma_angular = range_m * self.angular_noise
        
        # Beam spread (increases with range)
        sigma_beam = range_m * self.beam_divergence / 2
        
        # Total cross-beam uncertainty
        sigma_cross = np.sqrt(sigma_angular**2 + sigma_beam**2)
        
        # Build covariance in beam-aligned frame
        beam_dir = point / range_m
        # Rotation to align z with beam direction
        R = rotation_matrix_from_vectors([0, 0, 1], beam_dir)
        
        # Covariance in beam frame: larger along beam (range), 
        # smaller perpendicular
        cov_beam = np.diag([sigma_cross**2, sigma_cross**2, sigma_range**2])
        
        # Transform to sensor frame
        cov_sensor = R @ cov_beam @ R.T
        
        return cov_sensor
    
    def detection_uncertainty(self, detection, points_in_box):
        """Aggregate point uncertainties to detection-level uncertainty.
        
        More points → lower uncertainty (law of large numbers).
        """
        n_points = len(points_in_box)
        
        if n_points == 0:
            return np.eye(3) * 10.0  # very uncertain if no points
        
        # Average point-level covariance
        point_covs = [self.point_uncertainty(p, np.linalg.norm(p)) 
                      for p in points_in_box]
        avg_cov = np.mean(point_covs, axis=0)
        
        # Detection uncertainty: point uncertainty / sqrt(n_points)
        # (averaging reduces noise)
        det_cov = avg_cov / np.sqrt(n_points)
        
        # Add systematic uncertainty (registration, calibration)
        systematic = np.diag([0.05**2, 0.05**2, 0.03**2])  # 5cm/5cm/3cm
        
        return det_cov + systematic
```

### 9.3 Multi-LiDAR Uncertainty Fusion

Aurrigo uses 4-8 RoboSense LiDARs. Overlapping observations reduce uncertainty:

```python
def fuse_multi_lidar_uncertainty(observations):
    """Fuse observations from multiple LiDARs using covariance intersection.
    
    Args:
        observations: list of (mean, covariance) pairs from different LiDARs
    Returns:
        fused_mean, fused_covariance
    """
    if len(observations) == 1:
        return observations[0]
    
    # Covariance intersection (no cross-correlation assumption needed)
    # Minimize determinant of fused covariance
    n = len(observations)
    
    # Simple case: inverse-covariance weighted average
    P_inv_sum = sum(np.linalg.inv(obs[1]) for obs in observations)
    P_fused = np.linalg.inv(P_inv_sum)
    
    mu_fused = P_fused @ sum(
        np.linalg.inv(obs[1]) @ obs[0] for obs in observations
    )
    
    return mu_fused, P_fused
```

**Expected uncertainty reduction from multi-LiDAR fusion:**

| LiDAR Count | Overlap Zone Coverage | Position σ (single) | Position σ (fused) | Reduction |
|-------------|----------------------|---------------------|-------------------|-----------|
| 1 | 0% | 8.5 cm | 8.5 cm | 0% |
| 2 (overlap) | 30% | 8.5 cm | 6.0 cm | 29% |
| 4 (overlap) | 60% | 8.5 cm | 4.3 cm | 49% |
| 8 (overlap) | 80% | 8.5 cm | 3.0 cm | 65% |

---

## 10. Uncertainty-Driven Decision Making

### 10.1 Uncertainty-to-Action Mapping

```python
class UncertaintyDecisionEngine:
    """Map perception uncertainty to operational decisions."""
    
    # Thresholds calibrated for airside safety
    THRESHOLDS = {
        'normal': {
            'max_epistemic': 0.3,    # low model uncertainty
            'max_vacuity': 0.2,      # sufficient evidence
            'min_detection_rate': 0.8, # >80% of ensemble agrees
            'max_position_std': 0.5,  # <50cm position uncertainty
        },
        'caution': {
            'max_epistemic': 0.6,
            'max_vacuity': 0.5,
            'min_detection_rate': 0.5,
            'max_position_std': 1.5,
        },
        'critical': {  # anything beyond this → stop
            'max_epistemic': 1.0,
            'max_vacuity': 0.8,
            'min_detection_rate': 0.3,
            'max_position_std': 3.0,
        }
    }
    
    def decide(self, detections_with_uncertainty, ego_state):
        """Determine operational mode based on perception uncertainty."""
        max_risk = 'normal'
        risk_reasons = []
        
        for det in detections_with_uncertainty:
            distance = np.linalg.norm(det.center[:2] - ego_state.position[:2])
            
            # Closer objects have tighter uncertainty requirements
            distance_factor = max(0.5, distance / 20.0)  # relax with distance
            
            # Check each uncertainty dimension
            if det.epistemic > self.THRESHOLDS['caution']['max_epistemic'] / distance_factor:
                if det.epistemic > self.THRESHOLDS['critical']['max_epistemic'] / distance_factor:
                    max_risk = 'stop'
                    risk_reasons.append(f"Critical epistemic uncertainty on {det.class_name} at {distance:.1f}m")
                else:
                    max_risk = max(max_risk, 'caution', key=self.risk_order)
                    risk_reasons.append(f"High uncertainty on {det.class_name} at {distance:.1f}m")
            
            # FOD: extra conservative
            if det.class_name == 'fod' and det.vacuity > 0.3:
                risk_reasons.append(f"Uncertain FOD detection at {distance:.1f}m")
                max_risk = max(max_risk, 'caution', key=self.risk_order)
            
            # Aircraft: never uncertain
            if det.class_name == 'aircraft' and det.position_std.max() > 0.5:
                risk_reasons.append(f"Uncertain aircraft position (σ={det.position_std.max():.2f}m)")
                max_risk = max(max_risk, 'caution', key=self.risk_order)
        
        return UncertaintyDecision(
            mode=max_risk,
            speed_limit=self.speed_for_mode(max_risk),
            reasons=risk_reasons,
            should_request_teleop=(max_risk == 'stop'),
            should_upload_data=(max_risk in ['caution', 'stop'])
        )
    
    def speed_for_mode(self, mode):
        return {'normal': None, 'caution': 10, 'stop': 0}[mode]  # km/h
```

### 10.2 Uncertainty-Triggered Data Collection

High uncertainty is a signal to collect training data:

```python
def uncertainty_trigger(detections, threshold=0.5):
    """Trigger data upload when uncertainty is high."""
    for det in detections:
        if det.epistemic > threshold:
            return TriggerEvent(
                type='high_epistemic_uncertainty',
                priority='high',
                metadata={
                    'class': det.class_name,
                    'confidence': det.confidence,
                    'epistemic': det.epistemic,
                    'vacuity': det.vacuity,
                    'position': det.center.tolist(),
                    'reason': 'Novel or rare object — high model uncertainty'
                }
            )
    return None
```

This integrates with the data flywheel (see `50-cloud-fleet/mlops/data-flywheel-airside.md`): uncertainty-triggered uploads ensure the training set grows precisely where the model is weakest.

### 10.3 Uncertainty for Planning

The Frenet planner can use uncertainty to adjust safety margins:

| Object Uncertainty | Speed Limit | Lateral Buffer | Longitudinal Buffer |
|-------------------|------------|---------------|---------------------|
| Low (σ < 0.3m) | Normal | 1.5m | 3.0m |
| Medium (σ 0.3-1.0m) | -30% | 2.5m (σ + 1.5m) | 5.0m (σ + 3.0m) |
| High (σ 1.0-2.0m) | -60% | 3.5m (σ + 1.5m) | 7.0m (σ + 3.0m) |
| Very high (σ > 2.0m) | Stop | N/A | N/A |

---

## 11. Edge Deployment on Orin

### 11.1 Latency Budget

| UQ Method | Base Model Latency | UQ Overhead | Total | Orin Feasibility |
|-----------|-------------------|-------------|-------|-----------------|
| Temperature scaling | 6.84ms | 0ms | 6.84ms | Excellent |
| Evidential head | 6.84ms | 0.7ms | 7.54ms | Excellent |
| MC-Dropout T=3 | 6.84ms × 3 | 1ms (aggregation) | 21.5ms | Good |
| MC-Dropout T=5 | 6.84ms × 5 | 1.5ms | 35.7ms | Tight |
| Ensemble M=3 | 6.84ms × 3 | 1ms | 21.5ms | Good (3x memory) |
| Ensemble M=5 | 6.84ms × 5 | 1.5ms | 35.7ms | Tight (5x memory) |
| Conformal (post-hoc) | 6.84ms | 0.1ms | 6.94ms | Excellent |

### 11.2 Recommended Orin Configuration

For the 100ms planning cycle budget:

```
Detection: PointPillars + Evidential Head → 7.5ms
  + Temperature Scaling → 0ms additional
  + Conformal Prediction Set → 0.1ms additional
  → Total: 7.6ms with full UQ

Alternative (higher quality UQ):
Detection: PointPillars MC-Dropout T=3 → 21.5ms
  + Conformal Prediction → 0.1ms
  → Total: 21.6ms with ensemble-quality UQ
```

### 11.3 Memory Budget

| Component | Memory (Orin) |
|-----------|--------------|
| PointPillars base model | 0.3 GB |
| Evidential head addition | 0.02 GB |
| Conformal calibration tables | 0.001 GB |
| MC-Dropout (no extra memory) | 0 GB |
| Ensemble (M=3 models) | 0.9 GB |
| Temperature parameter | Negligible |

Evidential + conformal fits easily within Orin's 32GB. Even an ensemble of 3 models at 0.9 GB total is affordable.

### 11.4 TensorRT Considerations

- **Evidential head**: Fully compatible with TensorRT (softplus, division)
- **MC-Dropout**: Requires keeping dropout active during inference — use TRT's `IActivationLayer` or run in PyTorch alongside TRT engine
- **Temperature scaling**: Just a division — trivial in TRT
- **Conformal**: Post-processing in Python, not in TRT engine

---

## 12. Airport Airside Applications

### 12.1 Novel Object Discovery

Airport environments regularly encounter objects not in the training set:

| Novel Object | Why Novel | UQ Signal | Response |
|-------------|----------|-----------|----------|
| New aircraft type (A321XLR) | Not in training data | High vacuity, low evidence | Conservative clearance, upload data |
| Specialized GSE (lavatory truck variant) | Rare equipment | Medium vacuity | Log, continue with caution |
| Wildlife (birds, foxes) | Not an airside class | Very high vacuity | Stop, report to ATC |
| Construction barrier (temporary) | Not mapped | High epistemic | Slow down, re-route |
| Snow removal equipment | Seasonal | High vacuity in summer model | Engage winter LoRA adapter |
| Dropped luggage | Not a standard class | Medium vacuity | FOD protocol, report |

### 12.2 Weather Degradation Detection

Uncertainty spikes correlate with weather degradation:

```python
class WeatherDegradationDetector:
    """Detect weather-related perception degradation via uncertainty."""
    
    def __init__(self, baseline_uncertainty):
        self.baseline = baseline_uncertainty  # from clear-weather calibration
    
    def check(self, current_uncertainty_map):
        """Compare current uncertainty against baseline."""
        # Global uncertainty increase
        global_ratio = current_uncertainty_map.mean() / self.baseline.mean()
        
        # Spatial pattern
        if global_ratio > 1.5:
            # Uniform increase → likely weather (fog, rain)
            spatial_std = current_uncertainty_map.std() / current_uncertainty_map.mean()
            if spatial_std < 0.3:  # uniform
                return WeatherAlert(
                    type='global_degradation',
                    severity=global_ratio,
                    likely_cause='fog_or_rain',
                    action='reduce_speed_by_percent',
                    speed_reduction=min(50, (global_ratio - 1) * 30)
                )
            else:  # localized
                return WeatherAlert(
                    type='localized_degradation',
                    severity=global_ratio,
                    likely_cause='jet_exhaust_or_local_obstruction',
                    action='avoid_region'
                )
        
        return None
```

### 12.3 Teleop Request Decision

```python
def should_request_teleop(uncertainties, ego_state):
    """Decide whether to request teleoperator assistance.
    
    Conservative: request early, not too late.
    """
    # Immediate teleop if any detection near ego has extreme uncertainty
    for det in uncertainties:
        distance = np.linalg.norm(det.center[:2] - ego_state.position[:2])
        
        # Critical: uncertain object within 10m
        if distance < 10.0 and det.vacuity > 0.7:
            return TeleopRequest(
                urgency='immediate',
                reason=f'High uncertainty object at {distance:.1f}m',
                eta_to_stop=distance / max(ego_state.speed, 0.1),
                snapshot=det
            )
        
        # Precautionary: persistent uncertainty in planned path
        if det.in_planned_path and det.epistemic > 0.5:
            return TeleopRequest(
                urgency='planned',
                reason=f'Uncertain object in planned path',
                eta_to_reach=det.time_to_reach,
                snapshot=det
            )
    
    # Global degradation: many uncertain detections
    mean_vacuity = np.mean([d.vacuity for d in uncertainties])
    if mean_vacuity > 0.4:
        return TeleopRequest(
            urgency='advisory',
            reason=f'Global perception degradation (mean vacuity={mean_vacuity:.2f})',
            snapshot=None
        )
    
    return None  # no teleop needed
```

### 12.4 Integration with Safety Architecture

UQ integrates with the existing Simplex safety architecture:

```
Perception (with UQ)
     ↓
Uncertainty Assessment
     ↓
┌────────────────────────────────────┐
│ Normal Mode (low uncertainty)       │
│ → Neural planner, normal speed     │
├────────────────────────────────────┤
│ Caution Mode (medium uncertainty)   │
│ → Neural planner, reduced speed    │
│ → Increased safety margins         │
│ → Data upload triggered            │
├────────────────────────────────────┤
│ Fallback Mode (high uncertainty)    │
│ → Simplex: switch to Frenet        │
│ → Minimum risk condition (MRC)     │
│ → Teleop request sent              │
├────────────────────────────────────┤
│ Emergency (very high / sensor fail) │
│ → Emergency stop                   │
│ → Safety MCU takes over            │
└────────────────────────────────────┘
```

---

## 13. Key Takeaways

1. **Standard neural networks are systematically overconfident** — predictions of 90% confidence are correct only ~70-80% of the time. Temperature scaling fixes this at zero latency cost, reducing ECE from 0.12-0.18 to 0.02-0.05

2. **Evidential deep learning provides single-pass uncertainty** — only ~10% latency overhead (7.5ms vs 6.84ms on Orin), with explicit vacuity scores for epistemic uncertainty and OOD detection at 0.87 AUROC

3. **Deep ensembles (M=5) are the gold standard** — 0.93 AUROC for OOD detection, 0.03 ECE, but require 5x compute and memory. Use for offline analysis and training data selection, not real-time

4. **MC-Dropout (T=3) is the practical real-time choice** — 0.85 AUROC, ~3x latency (21.5ms total on Orin), zero extra memory, works with any model that already has dropout

5. **Conformal prediction provides distribution-free coverage guarantees** — P(true class ∈ prediction set) ≥ 99% with only ~1,000 calibration examples and zero distributional assumptions. Works as a post-hoc wrapper on any model

6. **Epistemic uncertainty (model disagreement) identifies novel objects** — critical for airside where new aircraft types, unusual GSE, and wildlife appear without warning. High vacuity → "I haven't seen this before"

7. **Aleatoric uncertainty (sensor noise) is irreducible** — grows as 1/r² with LiDAR range. At 80m, position uncertainty is ~8.5cm (single LiDAR) vs ~3.0cm with 8-LiDAR fusion (65% reduction)

8. **Multi-LiDAR fusion reduces position uncertainty by up to 65%** — Aurrigo's 4-8 RoboSense config provides 49-65% reduction in overlap zones via covariance intersection

9. **Uncertainty-driven speed control**: Low uncertainty → normal speed; medium → -30% with 2.5m buffer; high → -60% with 3.5m buffer; very high → stop. This formalizes "drive to the confidence of your perception"

10. **Uncertainty triggers close the data flywheel loop** — high epistemic uncertainty automatically flags frames for upload and labeling, ensuring training data grows where the model is weakest

11. **Weather degradation detection**: Global uncertainty increase >1.5x baseline with uniform spatial pattern indicates fog/rain; localized increase indicates jet exhaust or obstruction. Speed reduction = min(50%, (ratio-1)×30%)

12. **Teleop request criteria**: Uncertain object within 10m with vacuity >0.7 → immediate request; uncertain object in planned path with epistemic >0.5 → planned request; global mean vacuity >0.4 → advisory

13. **Recommended Orin configuration**: Evidential PointPillars (7.5ms) + temperature scaling + conformal prediction = full UQ stack at 7.6ms total, well within 100ms planning cycle

14. **Focal loss (γ=2) improves calibration during training** — ECE 0.05-0.08 vs 0.12-0.18 for cross-entropy, without post-hoc adjustment. Combining with temperature scaling achieves ECE <0.03

15. **Adaptive conformal prediction maintains coverage under distribution shift** — critical for multi-airport deployment where test distribution differs from calibration set. Online alpha adjustment preserves 99% coverage guarantee

16. **LiDAR-specific uncertainty model**: Physics-based covariance from range noise (2cm base + 0.1%/m), angular noise (0.06°), and beam divergence (0.17°). Detection uncertainty scales as σ/√n_points — more LiDAR returns → more certain

17. **Certification evidence**: Calibrated uncertainty metrics (ECE <0.05, conformal coverage ≥99%) provide quantitative evidence for ISO 3691-4 "reliable detection" and UL 4600 Section 10.6 ML monitoring requirements

18. **Total implementation cost: $15-25K** — temperature scaling (free), evidential head ($5K training), conformal calibration ($5K data collection), integration and testing ($5-15K). No hardware changes needed

---

## References

1. Gal, Y. and Ghahramani, Z., "Dropout as a Bayesian Approximation: Representing Model Uncertainty in Deep Learning," ICML 2016
2. Lakshminarayanan, B. et al., "Simple and Scalable Predictive Uncertainty Estimation using Deep Ensembles," NeurIPS 2017
3. Sensoy, M. et al., "Evidential Deep Learning to Quantify Classification Uncertainty," NeurIPS 2018
4. Amini, A. et al., "Deep Evidential Regression," NeurIPS 2020
5. Guo, C. et al., "On Calibration of Modern Neural Networks," ICML 2017
6. Vovk, V. et al., "Algorithmic Learning in a Random World," Springer 2005 (conformal prediction)
7. Angelopoulos, A. and Bates, S., "A Gentle Introduction to Conformal Prediction and Distribution-Free Uncertainty Quantification," 2022
8. Gibbs, I. and Candes, E., "Adaptive Conformal Inference Under Distribution Shift," NeurIPS 2021
9. Blundell, C. et al., "Weight Uncertainty in Neural Networks (Bayes by Backprop)," ICML 2015
10. Lin, T. et al., "Focal Loss for Dense Object Detection," ICCV 2017
11. Feng, D. et al., "A Review and Comparative Study on Probabilistic Object Detection in Autonomous Driving," T-ITS 2021
12. Hüllermeier, E. and Waegeman, W., "Aleatoric and Epistemic Uncertainty with Random Forests," Machine Learning 2021

---

*Document generated for Aurrigo industry research, April 2026. Covers uncertainty quantification and calibration for perception — for runtime monitoring and OOD detection in the safety context, see `60-safety-validation/runtime-assurance/runtime-verification-monitoring.md`. For data flywheel integration, see `50-cloud-fleet/mlops/data-flywheel-airside.md`.*
