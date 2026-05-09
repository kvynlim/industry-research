# Recurrent Neural Networks, LSTM, and GRU: First Principles

## Sequence Modeling With Shared State

Autonomous driving is temporal. A single frame may show where an actor is, but
sequence context reveals velocity, intent, occlusion, traffic-light phase,
sensor dropout, and whether a detection is stable or flickering.

A recurrent neural network (RNN) processes a sequence by updating a hidden
state:

```text
h_t = f_theta(x_t, h_{t-1})
y_t = g_theta(h_t)
```

The same parameters `theta` are reused at every time step. This weight sharing
lets the model handle variable-length sequences and gives it a built-in notion
of temporal state.

Transformers and state-space models now dominate many sequence workloads, but
RNNs remain important because they expose the fundamental questions: what state
is retained, what is forgotten, how gradients move through time, and what
latency is required for online inference.

---

## 1. Vanilla RNN

A simple RNN uses:

```text
a_t = W_x x_t + W_h h_{t-1} + b
h_t = tanh(a_t)
y_t = W_y h_t + c
```

Unrolled over time:

```text
h_1 = f(x_1, h_0)
h_2 = f(x_2, h_1)
h_3 = f(x_3, h_2)
...
```

This is a deep network in time with shared weights. Backpropagation through time
(BPTT) applies ordinary backpropagation to the unrolled graph.

---

## 2. Backpropagation Through Time

The loss may be at every time step:

```text
L = sum_t L_t(y_t, target_t)
```

or only at the end:

```text
L = L_T(y_T, target_T)
```

Gradients flow backward through repeated hidden transitions:

```text
dL/dh_{t-1} includes dL/dh_t * dh_t/dh_{t-1}
```

Across many steps, products of Jacobians appear:

```text
dL/dh_t -> product_k (dh_k/dh_{k-1})
```

If the product norms are mostly below one, gradients vanish. If mostly above
one, gradients explode. This is the central training problem for vanilla RNNs.

### Truncated BPTT

Long sequences are expensive, so training often detaches hidden state every
`T` steps:

```python
h = h.detach()
```

This bounds memory and compute, but it also prevents credit assignment across
the detach boundary. In AV, truncation length should be chosen based on the
temporal dependencies required: short for smoothing detections, longer for
occlusion recovery or behavior prediction.

---

## 3. LSTM: Memory With Gates

Long Short-Term Memory introduces a cell state `c_t` and gates that control
write, forget, and read behavior:

```text
i_t = sigmoid(W_ii x_t + b_ii + W_hi h_{t-1} + b_hi)  # input gate
f_t = sigmoid(W_if x_t + b_if + W_hf h_{t-1} + b_hf)  # forget gate
g_t = tanh(   W_ig x_t + b_ig + W_hg h_{t-1} + b_hg)  # candidate
o_t = sigmoid(W_io x_t + b_io + W_ho h_{t-1} + b_ho)  # output gate

c_t = f_t * c_{t-1} + i_t * g_t
h_t = o_t * tanh(c_t)
```

The key path is:

```text
c_t = f_t * c_{t-1} + ...
```

If `f_t` is near one, information and gradients can persist through time. If
`f_t` is near zero, the cell forgets. The gates are learned and input-dependent,
so the model can decide what to store.

### LSTM Interpretation For AV

An LSTM hidden state can carry:

- Actor velocity and acceleration cues.
- Whether an object was visible before occlusion.
- Traffic-light phase history.
- Track confidence and identity continuity.
- Recent freespace evidence.
- Sensor health or dropout context.

The cell state is not guaranteed to store these concepts, but the architecture
makes persistent memory easier than a vanilla RNN.

---

## 4. GRU: A Smaller Gated Recurrent Unit

The gated recurrent unit (GRU) merges some LSTM ideas into a simpler cell:

```text
z_t = sigmoid(W_z x_t + U_z h_{t-1} + b_z)  # update gate
r_t = sigmoid(W_r x_t + U_r h_{t-1} + b_r)  # reset gate
n_t = tanh(W_n x_t + U_n (r_t * h_{t-1}) + b_n)
h_t = (1 - z_t) * n_t + z_t * h_{t-1}
```

Conventions differ on whether `z_t` weights the old or new state, but the idea
is the same: interpolate between previous memory and a candidate update.

GRUs have fewer parameters than LSTMs and can be faster. They often work well
when the sequence dependency is moderate and memory constraints matter.

---

## 5. Online Inference

RNNs are naturally streaming:

```python
h = None
for frame in stream:
    y, h = rnn(frame_features, h)
```

The compute per new frame does not grow with the full history length. This is a
major practical advantage over naive attention for low-latency systems.

But streaming state creates engineering obligations:

- Reset state at scene boundaries.
- Reset or mask state when a sensor stream is interrupted.
- Avoid leaking state across different logs in batched evaluation.
- Track timestamp gaps and variable frame intervals.
- Decide how state is initialized for cold start.
- Ensure hidden state is carried in the correct actor, lane, query, or grid-cell
  identity.

State bugs can be subtle because the model may look good on continuous logs but
fail when clips are shuffled, dropped, or restarted.

---

## 6. Many-To-One, One-To-Many, And Many-To-Many

RNN output patterns:

```text
many-to-one:   sequence -> one label
many-to-many:  sequence -> sequence labels
encoder-decoder: input sequence -> output sequence
```

AV examples:

- Many-to-one: classify whether an actor is yielding from the last few seconds.
- Many-to-many: smooth object state or occupancy over time.
- Encoder-decoder: encode actor history and decode future trajectory.

For prediction, causal structure matters. A model used online cannot attend to
future frames. Training pipelines must avoid target leakage through centered
windows, bidirectional RNNs, or future-derived features.

---

## 7. RNNs, CNNs, Attention, And State-Space Models

RNNs are not the only sequence model:

- 3D CNNs or temporal convolutions process fixed windows in parallel.
- Transformers use attention to connect tokens directly.
- State-space models such as Mamba use recurrent state with hardware-aware
  scans and input-dependent selection.

The tradeoff:

```text
RNN:          O(T) sequential, compact state, good for streaming
temporal CNN: O(T) parallel, finite receptive field, fixed window
attention:    O(T^2) full pairwise context, expensive for long sequences
SSM/Mamba:    O(T) or near-linear, long context, modern parallel training paths
```

RNNs remain a useful baseline and often a practical component when the temporal
state is small, causal, and latency-sensitive.

---

## 8. Implementation Notes

### PyTorch LSTM Shapes

Default PyTorch LSTM input is sequence-first:

```python
lstm = torch.nn.LSTM(input_size=D, hidden_size=H, num_layers=2)

# x: (T, B, D)
# output: (T, B, H)
# h_n: (num_layers, B, H)
# c_n: (num_layers, B, H)
output, (h_n, c_n) = lstm(x)
```

With `batch_first=True`:

```python
lstm = torch.nn.LSTM(D, H, batch_first=True)

# x: (B, T, D)
output, (h_n, c_n) = lstm(x)
```

Shape mistakes are common when moving between dataloaders, transformer blocks,
and recurrent modules. Name dimensions explicitly in comments.

### Variable-Length Sequences

Use masks or packed sequences so padded timesteps do not train as real data.
For AV logs, variable length arises from clip boundaries, dropped frames,
object track lifetime, and sensor availability.

### Hidden State Detach

For streaming training:

```python
h = tuple(v.detach() for v in h)
```

Detach intentionally and document the temporal horizon. Accidental detaches make
long-term learning impossible; missing detaches can create unbounded memory use.

### Gradient Clipping

RNNs commonly need clipping:

```python
torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
```

Log how often clipping occurs.

---

## 9. Failure Modes

### Vanishing Memory

The model forgets useful evidence too quickly. Symptoms include poor occlusion
recovery, unstable velocity estimates, or failure to use prior traffic-light
state. Increase hidden size, improve gating, adjust sequence length, or use
attention/SSM alternatives.

### Exploding Gradients

Symptoms include loss spikes, NaNs, and unstable hidden states. Use clipping,
lower learning rate, better initialization, normalization, or shorter BPTT.

### Hidden-State Leakage

Batched training may carry hidden state from one scene to another if reset masks
are wrong. This can inflate validation results and create deployment failures.

### Future Leakage

Bidirectional RNNs, centered temporal windows, or features computed with future
frames can make offline metrics look excellent while violating online causality.

### Timestamp Blindness

Standard RNNs assume regular steps unless time delta is an input. AV sensors
have dropped frames, asynchronous cameras, variable sweep intervals, and
latency. Include `dt` or handle irregular sampling explicitly.

### Identity Mismatch

Actor-level recurrent state must follow the same physical object. If tracking
association switches identity, the hidden state becomes misleading.

---

## 10. AV Review Checklist

```text
What is the temporal horizon?
Is the model causal for online use?
When is hidden state reset?
How are variable-length clips masked?
Is BPTT truncated, and at what length?
Are gradients clipped?
Is timestamp delta represented?
Can hidden state leak across logs or actors?
Does recurrent state follow stable identities?
How does the model behave after sensor dropout or cold start?
```

RNNs are conceptually simple but operationally delicate. Their value in AV is
streaming memory; their risk is invisible state.

---

## 11. Sources

- Hochreiter and Schmidhuber, [Long Short-Term Memory](https://doi.org/10.1162/neco.1997.9.8.1735), 1997.
- Cho et al., [Learning Phrase Representations using RNN Encoder-Decoder for Statistical Machine Translation](https://aclanthology.org/D14-1179/), 2014.
- PyTorch, [LSTM](https://docs.pytorch.org/docs/stable/generated/torch.nn.modules.rnn.LSTM.html).
- Goodfellow, Bengio, and Courville, [Deep Learning](https://www.deeplearningbook.org/), especially sequence modeling.
