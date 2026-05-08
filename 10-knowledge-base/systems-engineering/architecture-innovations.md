# Neural Architecture Innovations for World Models

## Beyond Standard Transformers — Architectures That Could Give an Edge

---

## 1. State Space Models (Mamba/S4) for Driving

### 1.1 Why SSMs for World Models

Standard transformers have O(n^2) complexity for sequence length n. For world models predicting 40+ frames ahead with 16K+ tokens per frame, this becomes prohibitive. State Space Models offer O(n) complexity.

**S4 (Structured State Space for Sequences):**
```
x'(t) = Ax(t) + Bu(t)    — continuous state transition
y(t) = Cx(t) + Du(t)      — output

Discretized: x_k = Ā x_{k-1} + B̄ u_k
             y_k = C x_k + D u_k

Key: A is structured (diagonal + low-rank) for efficient computation
```

**Mamba (Selective State Spaces):**
- Adds input-dependent (selective) gating to S4
- Parameters B, C, Δ are functions of the input → content-aware processing
- Hardware-efficient implementation via scan operations on GPU
- Linear complexity but matches transformer quality on language

### 1.2 SSMs for Driving World Models

| System | Architecture | Result |
|--------|-------------|--------|
| **DriveMamba** | Task-centric SSM for E2E driving | Dynamic task relation modeling |
| **MambaOcc** | Mamba for BEV occupancy prediction | Linear attention for long-range perception |
| **DRAMA** | Hybrid Mamba-Transformer for motion planning | Multi-modal sensor fusion |
| **DriveWorld** | Memory State-Space Model | Dynamic memory banks for temporal prediction |

**Advantage for airside:** Low-speed driving requires long prediction horizons (8-10s at 5 km/h is only 11-14m, but you need to predict turnaround sequences minutes ahead). SSMs handle long sequences efficiently.

### 1.3 Mamba-2 and Beyond

Mamba-2 introduces **Structured State Space Duality (SSD):**
- Shows equivalence between state space models and a form of structured attention
- 2-8x faster than Mamba-1 while matching quality
- Can be combined with standard attention layers for hybrid architectures

**Hybrid Mamba-Transformer for world models:**
```
Block 1: Mamba (long-range temporal dependencies, O(n))
Block 2: Attention (local spatial interactions, O(n^2) but on small patches)
Block 3: Mamba (temporal again)
Block 4: Attention (spatial again)
...
```

This captures long temporal horizons efficiently (Mamba) while maintaining rich spatial reasoning (attention).

---

## 2. Mixture of Experts (MoE) for World Models

### 2.1 Sparse MoE for Conditional Computation

Most of a world model's capacity is wasted on easy predictions (static background, far-away objects). MoE activates only relevant experts:

```
x → Router(x) → top-K experts → weighted sum

For driving world model:
  Expert 1: Static scene prediction (roads, buildings)
  Expert 2: Vehicle motion prediction
  Expert 3: Pedestrian behavior
  Expert 4: Rare events (emergency, construction)
  Expert 5: Weather effects

Only 2 of 5 experts activated per token → 2.5x less compute
```

### 2.2 MoE for Multi-Airport Generalization

```
Shared experts: Physics, rigid body dynamics, general motion
Airport-specific experts: Layout patterns, turnaround sequences, local procedures

Router learns to activate airport-specific experts based on input features
→ Single model handles multiple airports without forgetting
```

### 2.3 Practical Considerations

| Aspect | Dense Model | MoE Model |
|--------|------------|-----------|
| Total params | 200M | 600M (3x) |
| Active params | 200M | 200M (same!) |
| Inference FLOPS | 1x | ~1x |
| Memory | 1x | 3x (all experts loaded) |
| Training | Standard | Load balancing needed |
| Deployment | Simple | Expert offloading possible |

**For Orin:** Memory is the constraint. MoE with expert offloading (keep inactive experts in CPU RAM, active on GPU) could give 3x model capacity with 1x inference cost.

---

## 3. Diffusion Transformers (DiT)

### 3.1 Architecture

DiT combines the scaling properties of transformers with the generation quality of diffusion:

```
Input: Noisy latent z_t + timestep t + conditioning c
  │
  ├── Patchify: Split latent into patches (like ViT)
  │
  ├── DiT Blocks (N layers):
  │   ├── LayerNorm with adaptive scale/shift (from timestep + condition)
  │   ├── Multi-head self-attention
  │   ├── LayerNorm with adaptive scale/shift
  │   └── MLP (feedforward)
  │
  └── Unpatchify + Linear → predicted noise ε_θ
```

### 3.2 DiT for Driving World Models

**comma.ai's world model is a DiT:**
- 500M / 1B / 2B parameter variants
- Trained on 2.5M minutes of real driving data
- Used as the simulator for policy training
- The first production driving model trained entirely in a learned simulator

**Why DiT works for driving:**
- Scales predictably (like LLMs — more params = better)
- Handles multi-modal data natively (images, actions, states as patches)
- Generates high-quality futures (diffusion quality > autoregressive for visual fidelity)
- Truncated diffusion (DiffusionDrive) enables real-time inference

### 3.3 DiT vs. Autoregressive Transformer for World Models

| Aspect | DiT (Diffusion) | AR Transformer |
|--------|-----------------|----------------|
| Generation quality | Higher visual fidelity | May lose fine details (tokenization) |
| Inference speed | Slower (multiple denoising steps) | Faster (single pass per token) |
| Controllability | Via classifier-free guidance | Via action token conditioning |
| Temporal consistency | Refinement across full sequence | Autoregressive drift risk |
| Training | Noise schedule complexity | Simple cross-entropy |
| Best for | Sensor simulation, data generation | Planning, real-time prediction |

**Recommendation:** Use DiT for simulation/data generation (quality matters), AR transformer for real-time planning (speed matters).

---

## 4. Flow Matching

### 4.1 How It Differs from Diffusion

Flow matching learns a vector field that transports a simple distribution (Gaussian) to the data distribution:

```
Diffusion: x_t = α_t x_0 + σ_t ε    (noising schedule, complex)
Flow matching: x_t = (1-t) ε + t x_0  (linear interpolation, simple!)

Training:
  Diffusion: L = ||ε_θ(x_t, t) - ε||²   (predict noise)
  Flow: L = ||v_θ(x_t, t) - (x_0 - ε)||² (predict velocity field)
```

### 4.2 Advantages for Action Generation

**Physical Intelligence's pi0 uses flow matching for actions:**
- More stable training than diffusion (no noise schedule to tune)
- Faster inference (fewer steps needed for convergence)
- Better mode coverage (less mode collapse than diffusion)
- Natural for trajectory generation (flow from random to trajectory)

**For airside AV planning:**
```
Flow matching trajectory generation:
  t=0: Random trajectory (Gaussian noise)
  t=1: Planned trajectory (goal-reaching, collision-free)

  The model learns the velocity field v_θ that transforms
  random trajectories into good driving trajectories.

  At inference: start with noise, integrate v_θ for T steps → trajectory
```

### 4.3 Rectified Flow

Rectified flow straightens the transport paths, enabling **1-step generation:**
```
Standard flow: curved paths from noise to data (need many integration steps)
Rectified flow: straight paths (1-2 steps sufficient)

Result: Near-diffusion quality at autoregressive speed
```

**InstaFlow** demonstrates 1-step image generation. Applied to driving, this could enable real-time world model generation without the multi-step overhead.

---

## 5. Tokenization Innovations

### 5.1 FSQ (Finite Scalar Quantization)

Used by NVIDIA Cosmos. Simpler than VQ-VAE:

```
VQ-VAE: Learn codebook C ∈ R^{K×d}, quantize by nearest-neighbor
  Problem: Codebook collapse, dead codes, training instability

FSQ: Round each dimension to L levels independently
  z_continuous ∈ R^d → z_quantized ∈ {-L/2, ..., L/2}^d

  Total codes = L^d (e.g., L=8, d=6 → 262,144 codes)

  No codebook to learn! No commitment loss! No EMA updates!
  Just round and use straight-through gradient.
```

**Why FSQ for driving world models:**
- More stable training (no codebook collapse)
- Higher effective codebook utilization (>90% vs <50% for VQ-VAE)
- Simpler implementation
- Cosmos uses FSQ → if you use Cosmos tokenizer, you get FSQ

### 5.2 Lookup-Free Quantization (LFQ)

Even simpler: binary quantization per dimension.

```
z_continuous ∈ R^d → z_binary ∈ {0, 1}^d
Total codes = 2^d (e.g., d=18 → 262,144 codes)

Advantage: Entropy-based regularization prevents collapse naturally
```

### 5.3 Continuous vs. Discrete for World Models

| Approach | Method | Quality | Speed | Stability |
|----------|--------|---------|-------|-----------|
| Continuous | Latent diffusion (GAIA-2) | Highest | Slowest | Good |
| Discrete (VQ-VAE) | OccWorld, GAIA-1 | Good | Fast | Codebook collapse risk |
| Discrete (FSQ) | Cosmos | Good | Fast | Very stable |
| Discrete (LFQ) | MaskGIT variants | Good | Fast | Stable |
| Hybrid | Epona (AR + diffusion) | High | Medium | Good |

**Recommendation for airside POC:** Start with FSQ (via Cosmos tokenizer) for stability. Fall back to VQ-VAE only if you need exact codebook control.

---

## 6. Efficient Attention Mechanisms

### 6.1 Flash Attention 2/3

```
Standard attention: O(n²) compute, O(n²) memory
Flash Attention 2: O(n²) compute, O(n) memory (tiling + recomputation)
Flash Attention 3: Further kernel optimizations for H100 (FP8 support)

Practical impact:
  - 2-4x faster than standard attention
  - Handles much longer sequences in same GPU memory
  - Essential for world models with long token sequences
```

### 6.2 Ring Attention for Very Long Sequences

For world models predicting many frames, the token sequence can be enormous:
```
8 past frames × 16K tokens/frame + 4 future frames × 16K tokens/frame = 192K tokens
Standard attention: 192K² = 36 billion operations
Ring Attention: Distribute across GPUs, each handles 192K/N² operations
```

### 6.3 Sliding Window Attention

For temporal prediction, you don't need full attention over all past frames:
```
Frame t: attend to frames [t-W, t] only (window W)
Reduces attention from O(T²) to O(T×W)

For driving at 5Hz, W=20 frames = 4 seconds of context
Still captures most relevant temporal dependencies
```

---

## 7. Graph Neural Networks for Driving

### 7.1 Scene Graphs for Multi-Agent Prediction

```
Nodes: ego vehicle, other vehicles, pedestrians, infrastructure
Edges: spatial relationships (near, behind, adjacent lane)

GNN message passing:
  h_i^{l+1} = UPDATE(h_i^l, AGGREGATE({m_{j→i} : j ∈ N(i)}))
  m_{j→i} = MESSAGE(h_j^l, h_i^l, e_{ji})
```

**For airside:** The graph structure is natural:
- Nodes: ego GSE, other GSE, aircraft, personnel, gates
- Edges: proximity, operational relationship (serving same aircraft), priority
- Heterogeneous: different node/edge types have different behavior models

### 7.2 Temporal Graph Networks

Combine GNNs with temporal modeling:
```
At each timestep:
  1. Update graph structure (add/remove edges based on proximity)
  2. GNN message passing (spatial reasoning)
  3. Temporal update (LSTM/GRU/Mamba per node)
  4. Predict future node states

This naturally handles:
  - Variable number of agents (graph grows/shrinks)
  - Long-range interactions (aircraft affects all GSE at its gate)
  - Structured relationships (turnaround sequence is a temporal graph)
```

---

## 8. Test-Time Compute Scaling

### 8.1 The O1-Style Approach for Driving

Instead of making the model larger, use more compute at inference:

```
Standard inference: Input → Model → Output (1 forward pass)

Test-time compute: Input → Model → Think → Refine → Think more → Output
  - Generate N candidate predictions
  - Score each with a verifier
  - Refine the best one
  - Repeat until confident or budget exhausted
```

**For world model planning:**
```
1. Generate 100 future predictions (sampling from world model)
2. Score each for safety (RSS check) and quality (progress, smoothness)
3. Refine top-10 via gradient-based optimization in latent space
4. Select best trajectory

More compute at inference → better decisions
Particularly valuable for rare/complex scenarios (pushback, multi-vehicle coordination)
```

### 8.2 Practical Budget Allocation

```
Easy scenario (straight road, no obstacles):
  1 world model forward pass → 80ms → done

Medium scenario (yielding to aircraft, route around obstacles):
  5 world model passes → 400ms → select best
  Acceptable at airside speeds (travels 0.5m in 400ms at 5 km/h)

Hard scenario (multi-vehicle coordination, narrow passage):
  20 world model passes → 1.6s → thorough evaluation
  Vehicle slows to walking speed while thinking
  Analogous to how human drivers slow down when uncertain
```

---

## 9. Retrieval-Augmented World Models

### 9.1 Concept

Instead of encoding all knowledge in model weights, retrieve relevant past experiences:

```
Current observation → Embedding → Retrieve top-K similar past scenes
                                        ↓
World model receives: [current state, retrieved similar scenes]
                                        ↓
Prediction: Informed by how similar scenarios played out in the past
```

### 9.2 For Airside Application

```
Scene: Ego approaching stand B12 during turnaround
Retrieval: Find 50 past instances of approaching B12 during turnaround
Context: "Last 50 times, pushback happened 3±1 min after cargo doors closed"
World model: Incorporates this temporal prior into prediction

Benefits:
  - No need to memorize every airport's patterns in weights
  - Naturally adapts to new airports (build retrieval index from first visits)
  - Provides explainable reasoning ("similar to scenario #47 from last Tuesday")
  - Memory grows with experience without retraining
```

---

## 10. Summary: Architecture Recommendations for Airside World Model

| Component | Recommended Architecture | Why |
|-----------|------------------------|-----|
| **Temporal backbone** | Hybrid Mamba-Transformer | Long horizons (Mamba) + spatial detail (Attention) |
| **Tokenizer** | FSQ (via Cosmos tokenizer) | Stable, no codebook collapse, commercially licensed |
| **Action generation** | Flow matching | Stable training, fast inference, good for trajectories |
| **Attention** | Flash Attention 2 + sliding window | Memory-efficient, handles long sequences |
| **Multi-agent** | Heterogeneous GNN | Natural for airside entity relationships |
| **Inference strategy** | Adaptive test-time compute | More thinking for harder scenarios |
| **Memory** | Retrieval-augmented | Adapts to new airports without retraining |

---

## Sources

- Gu & Dao. "Mamba: Linear-Time Sequence Modeling with Selective State Spaces." arXiv, 2023
- Dao et al. "Mamba-2: Structured State Space Duality." arXiv, 2024
- Peebles & Xie. "Scalable Diffusion Models with Transformers (DiT)." ICCV, 2023
- Lipman et al. "Flow Matching for Generative Modeling." ICLR, 2023
- Liu et al. "Rectified Flow." ICLR, 2023
- Mentzer et al. "Finite Scalar Quantization." ICLR, 2024
- Dao. "FlashAttention-2." NeurIPS, 2023
- Chi et al. "Diffusion Policy." RSS, 2023
- Black et al. "pi0: A Vision-Language-Action Flow Model." arXiv, 2024
- Fedus et al. "Switch Transformers: Scaling to Trillion Parameter Models." JMLR, 2022
