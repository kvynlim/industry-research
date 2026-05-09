# Multilayer Perceptrons and Activations: First Principles

## Why A Stack Of Linear Layers Needs Nonlinearity

A multilayer perceptron (MLP) is a composition of affine maps and elementwise
nonlinearities:

```text
h_1 = phi(W_1 x + b_1)
h_2 = phi(W_2 h_1 + b_2)
...
s   = W_L h_{L-1} + b_L
```

If `phi` is removed, the whole network collapses into one affine map:

```text
W_3 (W_2 (W_1 x + b_1) + b_2) + b_3
  = W_eff x + b_eff
```

Depth without nonlinearity is still linear. The activation function is what
lets the network carve feature space into many regions, reuse intermediate
features, and express interactions between input dimensions. This is the
transition from template matching to learned representation.

In AV perception, MLPs appear everywhere even when the headline architecture is
not "an MLP": transformer feed-forward blocks, detection heads, query decoders,
lane graph classifiers, calibration modules, occupancy heads, trajectory
scorers, and small safety monitors.

---

## 1. A Neuron As A Half-Space Feature

One hidden unit computes:

```text
a = w^T x + b
h = phi(a)
```

For ReLU:

```text
phi(a) = max(0, a)
```

The unit is inactive on one side of the hyperplane `w^T x + b = 0` and active
on the other. A layer of ReLU units builds many learned half-space tests. The
next layer combines those tests. This creates a piecewise-linear function:

```text
input space -> partitioned by hidden hyperplanes -> linear function per region
```

This viewpoint is useful for debugging. If all hidden units are inactive for a
class of examples, the downstream head sees little signal. If a few units
activate on spurious context, the model may build shortcuts.

---

## 2. Matrix Form And Batching

For a batch:

```python
# x: (B, D_in)
h = activation(x @ W1.T + b1)  # (B, H)
logits = h @ W2.T + b2         # (B, K)
```

For dense prediction, the same operation is often applied pointwise:

```text
image or BEV features: (B, C, H, W)
1x1 convolution:       equivalent to shared linear layer per spatial cell
```

A `1x1` convolution is an MLP layer applied at every location with shared
weights. This is common in segmentation heads and feature-pyramid networks.

---

## 3. Common Activations

### Sigmoid

```text
sigmoid(a) = 1 / (1 + exp(-a))
d sigmoid / da = sigmoid(a) * (1 - sigmoid(a))
```

Sigmoid squashes to `(0, 1)`. It is useful for output probabilities in binary
or multi-label heads, but it is a poor default hidden activation in deep nets
because large positive or negative inputs saturate and produce tiny gradients.

### Tanh

```text
tanh(a) in (-1, 1)
d tanh / da = 1 - tanh(a)^2
```

Tanh is zero-centered, which helps compared with sigmoid, but it still
saturates. It remains common inside recurrent cells where bounded state updates
are useful.

### ReLU

```text
relu(a) = max(0, a)
d relu / da = 1 if a > 0 else 0
```

ReLU is cheap, sparse, and avoids saturation for positive activations. Its main
failure mode is dead units: if a unit's preactivation stays negative for all
training examples, its gradient is zero and it may never recover.

### Leaky ReLU and PReLU

```text
leaky_relu(a) = a if a > 0 else alpha * a
```

The negative slope keeps gradients alive when `a < 0`. PReLU learns `alpha`.
This can help very deep vision models, though it adds parameters and can be a
minor deployment consideration.

### GELU and SiLU

Smooth activations such as GELU and SiLU are common in transformers and modern
MLPs:

```text
silu(a) = a * sigmoid(a)
```

They preserve small negative values instead of hard-zeroing them. They can
improve optimization but are slightly more expensive than ReLU. In AV deployment
on constrained accelerators, activation choice may affect fusion, quantization,
and kernel availability.

---

## 4. Depth, Width, and Representation

Width gives a layer more features. Depth composes features.

For AV examples:

- Low layers may encode local edges, texture, reflectance, or point density.
- Middle layers may encode object parts, lane markings, curbs, and drivable
  boundaries.
- Later layers may encode object-level semantics, motion state, intent, or map
  context.

An MLP head on top of a rich feature is not merely "more classifier capacity".
It lets the model learn interactions. For example, a pedestrian-crossing intent
head may need a conjunction of actor pose, distance to crosswalk, traffic-light
state, vehicle speed, and temporal context. A linear head can only add those
directions; an MLP can gate one feature based on another.

### Universal Approximation, With A Practical Caveat

Classical results say a sufficiently wide network with a hidden layer can
approximate many continuous functions. This does not mean shallow giant MLPs are
the right engineering choice. Approximation theorems do not guarantee efficient
learning, data efficiency, latency, robustness, or good extrapolation. CNNs,
RNNs, attention, and state-space models add structure so the model does not
need to rediscover every invariance from data.

---

## 5. MLPs In Modern AV Architectures

### Transformer Feed-Forward Blocks

A transformer block usually contains an MLP after attention:

```text
y = W_2 phi(W_1 x + b_1) + b_2
```

The first projection expands channels, the activation mixes nonlinear features
per token, and the second projection returns to model dimension. Attention mixes
information across tokens; the MLP transforms each token independently.

### Detection And Segmentation Heads

Common heads:

```text
features -> MLP -> class logits
features -> MLP -> box deltas
features -> MLP -> velocity
features -> MLP -> heading bins
```

Multi-task heads often share early layers and split into task-specific final
layers. Sharing can improve data efficiency but also creates gradient conflict:
classification may prefer invariance while box regression needs precise
geometry.

### Coordinate-Based Networks

MLPs can map coordinates to signals:

```text
(x, y, z, t, view_dir) -> occupancy / density / semantic value
```

These implicit functions are relevant to occupancy, neural fields, and scene
reconstruction. Positional encoding is often added because raw coordinates are
hard for standard MLPs to fit at high spatial frequency.

---

## 6. Implementation Notes

### Initialization And Activation Must Match

ReLU-family networks usually pair with He initialization. Tanh/sigmoid networks
often need smaller variance such as Xavier/Glorot. A mismatch changes
activation variance layer by layer and can create dead or saturated networks.

### Biases After Normalization

If a linear layer is immediately followed by BatchNorm or LayerNorm, the bias is
often redundant because normalization has its own shift parameter. Many systems
disable those biases to save parameters and avoid unnecessary degrees of
freedom.

### Dropout Placement

Dropout is usually placed after activations or between MLP layers. It is a
training-time stochastic regularizer and should be disabled in evaluation mode.
In perception systems, accidental train mode at inference can cause frame-level
jitter.

### Quantization

ReLU is quantization-friendly because its output range has a hard lower bound.
GELU/SiLU can be deployed efficiently on many accelerators, but verify kernels,
approximation error, and calibration data. Small confidence changes can matter
when thresholds feed safety logic.

---

## 7. Failure Modes

### Dead ReLUs

Symptoms:

- Large fraction of activations exactly zero.
- Layers whose gradients vanish after a learning-rate spike.
- Rare-class examples never activate a useful subnetwork.

Mitigations:

- Lower learning rate or use warmup.
- Use He initialization.
- Try Leaky ReLU, GELU, or SiLU.
- Monitor activation histograms by layer and by scenario slice.

### Saturating Sigmoid Or Tanh

When preactivations are very large in magnitude, gradients approach zero. This
is especially likely with poor initialization, unnormalized inputs, or recurrent
unrolling. Hidden sigmoid networks are rarely the right default for new AV
perception modules.

### Over-Capacity Heads

A large MLP head can memorize dataset-specific shortcuts on top of a weak
backbone. It may improve validation on random splits while failing across
geography, weather, sensor setup, or map version. Compare linear probes, small
heads, and larger heads to separate representation quality from memorization.

### Multi-Task Gradient Conflict

Shared MLP layers feeding classification, regression, velocity, and uncertainty
heads may receive incompatible gradients. Watch per-task loss curves and
gradient norms. Splitting heads earlier can improve stability when tasks need
different invariances.

### Shape Collapse In Dense Prediction

Flattening `(B, C, H, W)` into `(B, C*H*W)` before an MLP destroys locality and
creates huge parameter counts. Use `1x1` convolutions, per-cell MLPs, or
structured decoders unless the global interaction is intentional.

---

## 8. AV Relevance

MLPs are often the final place where perception features become task-specific
outputs. They are small enough to inspect but important enough to create safety
failures. Review them for:

```text
activation choice
initialization
normalization placement
dropout/train mode
head sharing across tasks
class imbalance sensitivity
latency and quantization behavior
```

When a modern perception model fails, do not skip the MLP head because it looks
simple. The head defines which feature interactions are expressible at the final
decision point.

---

## 9. Sources

- Stanford CS231n, [Neural Networks Part 1](https://cs231n.github.io/neural-networks-1/).
- Stanford CS231n, [Neural Networks Part 2](https://cs231n.github.io/neural-networks-2/).
- Goodfellow, Bengio, and Courville, [Deep Learning](https://www.deeplearningbook.org/), especially deep feedforward networks.
- He et al., [Delving Deep into Rectifiers](https://arxiv.org/abs/1502.01852), 2015.
