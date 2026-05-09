# Perceptron and Linear Classifiers: First Principles

## The Smallest Useful Perception Model

A linear classifier is the first model worth understanding deeply because many
large AV networks end in the same object: an affine map from features to scores.
The features may come from a camera backbone, LiDAR encoder, radar fusion stack,
or BEV transformer, but the last classification head often still computes:

```text
s = W x + b

x in R^D        feature vector for one example, anchor, query, pixel, or voxel
W in R^(K x D)  one row per class
b in R^K        class bias
s in R^K        unnormalized class scores, also called logits
```

The classical linear model is therefore not obsolete. It is the microscope for
understanding what a learned representation has made easy. If a frozen feature
extractor plus a linear probe separates pedestrians, vehicles, drivable area,
and background, the backbone has exposed those concepts as directions in feature
space. If it cannot, adding a larger classifier head may hide a representation
failure rather than fix it.

---

## 1. Binary Linear Classification

Start with labels `y in {-1, +1}` and a score:

```text
score(x) = w^T x + b
prediction = sign(score(x))
```

The decision boundary is the hyperplane:

```text
w^T x + b = 0
```

The vector `w` is perpendicular to the boundary. Moving in the `+w` direction
increases the score; moving in `-w` decreases it. The bias `b` shifts the
boundary without changing its orientation.

A point is correctly classified when:

```text
y * (w^T x + b) > 0
```

The signed quantity `y * score(x)` is more informative than the raw prediction.
It says not only whether the sample is correct, but how far it is from the
boundary in score units. A small positive margin is technically correct but
fragile under noise, calibration drift, or feature quantization.

---

## 2. Perceptron Learning

Rosenblatt's perceptron can be written as a mistake-driven online algorithm.
For each example `(x_i, y_i)`, update only when the current classifier is wrong:

```text
if y_i * (w^T x_i + b) <= 0:
    w <- w + eta * y_i * x_i
    b <- b + eta * y_i
```

The update has a direct geometric meaning:

- If `y_i = +1` and the score is too low, move `w` toward `x_i`.
- If `y_i = -1` and the score is too high, move `w` away from `x_i`.
- The bias update shifts the boundary toward the mistaken side.

With a bias trick, append a constant feature:

```text
x_bar = [x; 1]
w_bar = [w; b]
score = w_bar^T x_bar
```

Then the bias is just another weight. This is convenient in derivations, but in
modern neural networks it is often clearer to keep biases separate because
normalization layers, weight decay, and parameter groups may treat them
differently.

### Separability and the Perceptron Guarantee

If a dataset is linearly separable, there exists some `w*` and margin `gamma`
such that every point satisfies:

```text
y_i * (w*^T x_i) >= gamma
```

Under bounded feature norm, the perceptron makes a finite number of mistakes.
That result is useful conceptually but limited in AV practice:

- Real perception data is rarely separable at the raw-feature level.
- Labels contain ambiguity: occluded pedestrians, truncation, sensor artifacts,
  and annotation policy differences.
- Training streams are imbalanced and non-stationary.
- The binary decision is usually only one part of a multi-class, multi-task
  system.

The perceptron is still valuable because it shows the minimum ingredients of
supervised learning: a score, a target, a mistake criterion, and an update rule
that changes the boundary in the direction that would reduce the mistake.

---

## 3. Margins and Linear Losses

The perceptron updates on any wrong sample but ignores how wrong it is once the
sign is correct. Margin-based classifiers add a desired buffer:

```text
want: y_i * score(x_i) >= 1
hinge loss: L_i = max(0, 1 - y_i * score(x_i))
```

The gradient for an active hinge violation is:

```text
if y_i * score(x_i) < 1:
    dL/dw = -y_i * x_i
    dL/db = -y_i
else:
    dL/dw = 0
    dL/db = 0
```

The hinge loss keeps pushing examples until they have a margin of at least one.
This is why support-vector machines emphasize boundary support points rather
than all correctly classified samples. In deep learning, hinge losses are less
common than cross-entropy for classification heads, but the margin idea remains
important in embedding losses, metric learning, re-identification, and
open-set detection.

---

## 4. Multiclass Linear Classifiers

For `K` classes:

```text
s_k = w_k^T x + b_k
prediction = argmax_k s_k
```

Each row `w_k` is a class template in the feature space. The boundary between
class `a` and class `b` is where their scores tie:

```text
w_a^T x + b_a = w_b^T x + b_b
(w_a - w_b)^T x + (b_a - b_b) = 0
```

So a multiclass linear classifier partitions feature space into convex regions.
This matters for AV perception because raw sensor distributions are highly
multi-modal. A single car class must cover sedans, buses, trailers, partly
occluded vehicles, night glare, wet roads, unusual paint colors, and long-tail
viewpoints. A linear classifier on raw pixels would collapse these modes into
one brittle template. A deep backbone is useful when it maps those modes into a
feature space where a simple final boundary is enough.

### Multiclass Hinge

For class label `y`, the multiclass SVM-style loss is:

```text
L_i = sum_{j != y} max(0, s_j - s_y + margin)
```

It penalizes any wrong class whose score is too close to or above the true
class. The gradient increases `s_y` and decreases the violating `s_j` values.
Unlike softmax cross-entropy, this loss only cares about scores that violate the
margin; very wrong classes outside the margin do not contribute.

---

## 5. Regularized Linear Models

Linear models can overfit when `D` is large, features are correlated, or labels
are noisy. Add a penalty:

```text
objective = data_loss(W, b) + lambda * R(W)

L2: R(W) = 0.5 * ||W||_2^2
L1: R(W) = ||W||_1
```

L2 discourages large weights and tends to distribute influence across correlated
features. L1 encourages sparsity and can reveal a smaller set of useful
features. In neural networks, the L2-like penalty is often implemented as
weight decay, but adaptive optimizers require care because L2 regularization and
decoupled weight decay are not the same update.

For AV heads, regularization is not only about validation accuracy. It affects:

- Calibration of confidence scores.
- Sensitivity to missing sensors or dropped features.
- Robustness under camera exposure shifts and LiDAR sparsity.
- Interpretability of feature probes.

---

## 6. Implementation Notes

### Shape Discipline

Use batch-major matrices:

```python
# x: (B, D)
# W: (K, D)
# b: (K,)
scores = x @ W.T + b  # (B, K)
pred = scores.argmax(dim=1)
```

For dense prediction, flatten spatial positions only after preserving the class
axis:

```python
# logits: (B, K, H, W)
# target: (B, H, W)
# For PyTorch CrossEntropyLoss, keep class dimension at dim=1.
```

Common mistakes:

- Applying `softmax` before a loss that expects logits.
- Mixing class-axis and batch-axis after a reshape.
- Forgetting that biases can dominate rare classes when features are weak.
- Applying weight decay to bias and normalization parameters without checking
  local training conventions.

### Linear Probes

A linear probe is a small diagnostic classifier trained on frozen features:

```python
for p in backbone.parameters():
    p.requires_grad_(False)

probe = torch.nn.Linear(feature_dim, num_classes)
```

Use probes to ask whether a representation linearly exposes a concept. In AV,
good probe targets include lane boundary presence, object motion state,
occlusion level, drivable region, traffic-light state, and weather/domain tags.
Bad probe performance can indicate either missing information or a label/task
definition that is not represented at the feature level being probed.

---

## 7. Failure Modes In AV Perception

### Non-Separable Data

Linear boundaries fail when classes interleave in the chosen feature space.
Symptoms include stable training loss but persistent confusion between visually
similar classes, such as pedestrian vs cyclist without motion cues or static
vehicle vs construction equipment under unusual viewpoints.

### Shortcut Features

Linear classifiers happily use any predictive direction. If dataset bias makes
traffic cones appear mostly in construction zones, a class head may use road
texture or scene context rather than cone evidence. Linear probes can expose
this if a sensitive nuisance attribute is easy to decode.

### Bias-Term Collapse

With extreme imbalance, the bias can encode the base rate so strongly that rare
positive examples require large feature evidence. This is common for small
objects and rare hazard classes. Track per-class logits and not just aggregate
loss.

### Margin Without Calibration

A large positive score is not a calibrated probability. A linear classifier can
rank correctly while being overconfident on out-of-distribution weather,
geography, or sensor degradation. Calibration belongs in the softmax and
cross-entropy note, but the root is already visible here: scores are arbitrary
real numbers.

### Feature Leakage

Linear separability is not always a sign of semantic understanding. If a feature
contains annotation artifacts, map priors, or temporal leakage, a linear
classifier may perform well for the wrong reason. AV validation should probe
across route, geography, weather, time, and sensor configuration splits.

---

## 8. AV Relevance

Linear classifiers appear in:

- Object classification heads after ROI pooling or query decoding.
- Anchor/objectness heads in detection.
- Semantic segmentation logits at each pixel or BEV cell.
- Occupancy state classification for voxels.
- Traffic-light state classification.
- Linear probes for representation auditing.
- Logistic safety monitors over engineered features.

The key operational question is not whether the full model is linear. It is
whether the final representation makes the safety-critical distinction simple
enough that a stable, calibrated, low-latency head can make it reliably.

---

## 9. Sources

- Frank Rosenblatt, [The Perceptron: A Probabilistic Model for Information Storage and Organization in the Brain](https://doi.org/10.1037/h0042519), 1958.
- Stanford CS231n, [Linear Classification](https://cs231n.github.io/linear-classify/).
- Goodfellow, Bengio, and Courville, [Deep Learning](https://www.deeplearningbook.org/), especially machine-learning basics and deep feedforward networks.
