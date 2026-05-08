# Diffusion Models: First Principles

## The Generative Framework Behind World Model Video Generation and Trajectory Planning

---

## 1. Score Matching Foundation

### 1.1 The Core Idea

A diffusion model learns to **reverse a noise-adding process**. Train by adding noise, learn to remove it.

```
Forward (known): Clean data → gradually add noise → pure noise
Reverse (learned): Pure noise → gradually remove noise → clean data

The model learns: "given noisy data at noise level t, what direction
                   points toward cleaner data?"
                   = ∇_x log p_t(x) = the "score function"
```

### 1.2 Denoising Score Matching

Instead of estimating the score directly, estimate the noise that was added:

```
Score: s_θ(x_t, t) ≈ ∇_x log p_t(x_t)

Connection: s_θ(x_t, t) = -ε_θ(x_t, t) / σ_t

So predicting the noise ε IS predicting the score (up to scaling).
```

---

## 2. DDPM (Ho et al., NeurIPS 2020)

### 2.1 Forward Process

Add Gaussian noise in T steps according to a schedule β_1, ..., β_T:

```
q(x_t | x_{t-1}) = N(x_t; √(1-β_t) · x_{t-1}, β_t · I)

Equivalently, jump directly to any timestep:
q(x_t | x_0) = N(x_t; √(ᾱ_t) · x_0, (1-ᾱ_t) · I)

where: α_t = 1 - β_t,  ᾱ_t = Π_{s=1}^t α_s

Sampling: x_t = √(ᾱ_t) · x_0 + √(1-ᾱ_t) · ε,  ε ~ N(0, I)
```

**Noise schedule:** β_t increases from β_1 ≈ 10⁻⁴ to β_T ≈ 0.02 (linear schedule, T=1000).

At t=T: ᾱ_T ≈ 0, so x_T ≈ ε ~ N(0, I) — pure noise.

### 2.2 Reverse Process

Learn to go backward:

```
p_θ(x_{t-1} | x_t) = N(x_{t-1}; μ_θ(x_t, t), σ_t² · I)

where the mean is derived from the noise prediction:
μ_θ(x_t, t) = (1/√α_t) · (x_t - (β_t/√(1-ᾱ_t)) · ε_θ(x_t, t))

σ_t² = β_t  (simplified, or β̃_t = β_t(1-ᾱ_{t-1})/(1-ᾱ_t) for better quality)
```

### 2.3 Training Objective (Simplified)

```python
def training_step(model, x_0):
    # 1. Sample random timestep
    t = torch.randint(0, T, (batch_size,))

    # 2. Sample noise
    epsilon = torch.randn_like(x_0)

    # 3. Create noisy version
    x_t = sqrt_alpha_bar[t] * x_0 + sqrt_one_minus_alpha_bar[t] * epsilon

    # 4. Predict noise
    epsilon_pred = model(x_t, t)

    # 5. Loss: how well did we predict the noise?
    loss = F.mse_loss(epsilon_pred, epsilon)

    return loss
```

### 2.4 Sampling (Generation)

```python
def sample(model, shape):
    # Start from pure noise
    x_T = torch.randn(shape)

    for t in reversed(range(T)):  # T, T-1, ..., 1, 0
        z = torch.randn_like(x_T) if t > 0 else 0

        # Predict noise
        eps = model(x_t, t)

        # Denoise one step
        x_{t-1} = (1/sqrt(alpha[t])) * (x_t - beta[t]/sqrt(1-alpha_bar[t]) * eps) + sigma[t] * z

    return x_0  # clean sample
```

**Problem:** Requires T=1000 sequential steps — very slow.

---

## 3. DDIM (Song et al., ICLR 2021)

### 3.1 Deterministic Sampling

DDIM makes the reverse process deterministic (no random noise z added):

```
x_{t-1} = √(ᾱ_{t-1}) · (x_t - √(1-ᾱ_t) · ε_θ) / √(ᾱ_t)
         + √(1-ᾱ_{t-1}) · ε_θ

This is an ODE discretization: dx/dt = f_θ(x, t)
```

### 3.2 Fewer Steps

Because it's an ODE (not SDE), you can take larger steps:

```
Instead of 1000 steps, use a subsequence: [999, 949, 899, ..., 49, 0]
→ 20 steps instead of 1000
→ Same model, just skip timesteps during sampling
→ Quality drops slightly but speed improves 50x
```

---

## 4. Latent Diffusion (Rombach et al., CVPR 2022)

### 4.1 Key Insight

Diffusing in pixel space is expensive. Diffuse in a compressed latent space instead.

```
Image (3, 256, 256) → Encoder → Latent (4, 32, 32) → Diffusion → Latent → Decoder → Image

Compression: 256² × 3 = 196K values → 32² × 4 = 4K values
48x fewer values to diffuse!
```

### 4.2 Architecture

```
Stage 1: Train autoencoder (VAE or VQ-VAE)
  Encoder E: x → z = E(x)  (compress)
  Decoder D: z → x̂ = D(z)  (reconstruct)
  Train with: L_recon + KL_regularization

Stage 2: Train diffusion model in latent space
  Forward: z_t = √(ᾱ_t) · z + √(1-ᾱ_t) · ε
  Model: ε_θ(z_t, t, c)  where c = conditioning (text, action, etc.)
  Train with: L = ||ε - ε_θ(z_t, t, c)||²

Sampling:
  z_T ~ N(0, I)
  z_0 = denoise(z_T) via DDIM steps
  x = D(z_0)  (decode to output)
```

### 4.3 For Driving World Models

**GAIA-2 uses latent diffusion:**
```
Past frames → Encode to latents → Condition diffusion on past + action
→ Predict future latents → Decode to future frames

Advantage: Much cheaper than pixel-space diffusion
          Can generate multi-camera views jointly
```

---

## 5. EDM Framework (Karras et al., NeurIPS 2022)

### 5.1 Unified Framework

EDM (Elucidating the Design Space of Diffusion Models) unifies different diffusion formulations:

```
Key insight: Separate the model from the noise schedule.

Denoiser: D_θ(x; σ) — takes noisy input at noise level σ, outputs clean prediction

Preconditioning:
  D_θ(x; σ) = c_skip(σ) · x + c_out(σ) · F_θ(c_in(σ) · x; c_noise(σ))

  where F_θ is the raw network, and c_skip, c_out, c_in, c_noise are
  preconditioning functions that stabilize training across noise levels.
```

### 5.2 Why DIAMOND Uses EDM

DIAMOND (the diffusion world model for RL) uses EDM because:
- More stable for single-step denoising (critical for autoregressive world models)
- Better handling of error accumulation across steps
- 3 denoising steps sufficient (vs 20+ for DDPM/DDIM)

---

## 6. Classifier-Free Guidance (CFG)

### 6.1 How to Control Generation

```
Train TWO models (or one model with dropout):
  ε_θ(x_t, t, c)  — conditional (given text/action/context)
  ε_θ(x_t, t, ∅)  — unconditional (no conditioning)

During sampling, extrapolate AWAY from unconditional:
  ε̃ = (1 + w) · ε_θ(x_t, t, c) - w · ε_θ(x_t, t, ∅)

  w = guidance scale:
    w = 0: pure conditional (no guidance boost)
    w = 1: standard CFG
    w = 3-7: strong guidance (higher quality, less diversity)
```

### 6.2 For Driving World Models

```
Conditioning signals for driving:
  c = {ego_trajectory, past_frames, text_description, map_info}

At training: randomly drop conditioning with probability p=0.1 (learn unconditional too)
At inference: use CFG with w=2-5 for controllable generation

"Generate future driving scene conditioned on ego turning left"
→ Strong CFG produces futures consistent with left turn
→ Weak CFG produces diverse possible futures
```

---

## 7. DiT (Diffusion Transformer)

### 7.1 Architecture (Peebles & Xie, ICCV 2023)

Replace U-Net with transformer:

```
Input: Noisy latent z_t (from VAE encoder)
  │
  ├── Patchify: Split into patches (like ViT)
  │   z_t: (4, 32, 32) → patches: (256, patch_dim)
  │
  ├── + Positional embedding (learned or sinusoidal)
  │
  ├── DiT Block × N:
  │   ├── adaLN(x, t, c):  LayerNorm with scale/shift from timestep t and condition c
  │   │   γ, β = MLP(t_embed + c_embed)
  │   │   out = γ · LayerNorm(x) + β
  │   ├── Multi-Head Self-Attention
  │   ├── adaLN
  │   └── MLP (SiLU activation, 4× hidden dim)
  │
  ├── Final adaLN + Linear
  │
  └── Unpatchify → predicted noise ε_θ: (4, 32, 32)
```

### 7.2 Scaling Properties

```
DiT-S: 33M params  → FID 68.4
DiT-B: 130M params → FID 43.5
DiT-L: 458M params → FID 23.3
DiT-XL: 675M params → FID 9.62 (+ CFG: 2.27)

Scaling is smooth and predictable — larger models consistently improve.
This is why comma.ai scaled their world model to 2B params.
```

---

## 8. Flow Matching (Lipman et al., ICLR 2023)

### 8.1 Simpler Than Diffusion

Instead of a noise schedule, learn a vector field that transports noise to data:

```
Diffusion: Complex noise schedule, forward SDE, reverse SDE
Flow matching: Simple linear interpolation, ODE

Flow path: x_t = (1-t) · x_1 + t · x_0    where x_1 ~ N(0,I), x_0 ~ data

Velocity: v_t = x_0 - x_1  (constant along the path!)

Training:
  L = ||v_θ(x_t, t) - (x_0 - x_1)||²

  Predict the velocity field, not the noise.
```

### 8.2 Advantages Over Diffusion

| Aspect | Diffusion | Flow Matching |
|--------|-----------|---------------|
| Path | Curved (SDE) | Straight (ODE) |
| Training | Noise schedule needed | No schedule |
| # Steps for quality | 20-50 | 5-20 |
| Stability | Can be unstable | More stable |
| Theory | Score matching | Optimal transport |

### 8.3 Rectified Flow

Make paths even straighter by iterative "straightening":

```
1. Train flow model on data
2. Generate pairs (x_1, x_0) using trained model
3. Re-train on these pairs (paths are more direct)
4. Repeat → paths become straight → 1-2 steps sufficient
```

**InstaFlow:** 1-step image generation via rectified flow. If applied to driving, this could enable single-step world model prediction.

---

## 9. Application: DiffusionDrive (CVPR 2025)

### 9.1 Truncated Diffusion for Real-Time Planning

Instead of starting from pure noise, start from an **anchor trajectory**:

```
Standard diffusion planning:
  x_T ~ N(0, I)          → 20 denoising steps → trajectory x_0
  Total: ~100ms

DiffusionDrive truncated:
  1. Pre-compute K anchor trajectories from training data (K-means)
  2. At inference: select nearest anchor to current situation
  3. Add small noise: x_T' = anchor + σ · ε  (σ << 1)
  4. Denoise: 2-5 steps → trajectory x_0
  Total: ~5-10ms (10-20x faster!)

Why it works: Anchors are already close to good trajectories.
Only small corrections needed → few denoising steps sufficient.
```

### 9.2 Multi-Modal Trajectories

Diffusion naturally generates diverse samples:
```
Sample N=10 trajectories from the same observation
→ Get 10 different plausible futures
→ Score each against world model predictions
→ Select best

This captures multi-modality: "I might go left OR right around the obstacle"
Regression would output the mean (going straight into the obstacle).
```

---

## 10. Application: World Model Video Generation

### 10.1 Conditional Generation Pipeline

```
Past frames z_{1:T} (encoded) + ego action a_{T:T+K} + text prompt
    │
    ├── Encode conditions → c = [z_{1:T}, a_{T:T+K}, text_embed]
    │
    ├── Sample noise: z_{T+1:T+K}^noise ~ N(0, I) — future frame latents
    │
    ├── Denoise with DiT:
    │   for step in range(num_steps):  # 20-50 steps
    │       ε_pred = DiT(z_noisy, step, c)
    │       z_noisy = denoise_step(z_noisy, ε_pred)
    │
    └── Decode: x̂_{T+1:T+K} = Decoder(z_clean)
        → K future frames conditioned on past + action
```

### 10.2 For Airside Occupancy Prediction

```
Past occupancy tokens (8 frames) + ego trajectory (candidate)
    │
    ├── Latent diffusion predicts future occupancy tokens
    │
    ├── Decode to 3D occupancy grids
    │
    └── Score trajectory against predicted occupancy

Advantage over autoregressive: no compounding error
(entire future generated at once, then refined)
```

---

## 11. Key Equations Summary

```
DDPM Training:     L = E_{t,x_0,ε} [||ε - ε_θ(√(ᾱ_t)x_0 + √(1-ᾱ_t)ε, t)||²]

DDIM Sampling:     x_{t-1} = √(ᾱ_{t-1})·x̂_0 + √(1-ᾱ_{t-1})·ε_θ

CFG:               ε̃ = (1+w)·ε_θ(x_t,t,c) - w·ε_θ(x_t,t,∅)

Flow Matching:     L = E_{t,x_0,x_1} [||v_θ(x_t, t) - (x_0 - x_1)||²]
                   x_t = (1-t)·x_1 + t·x_0

Latent Diffusion:  z = E(x),  diffuse z,  x̂ = D(ẑ)
```

---

## Sources

- Ho et al. "Denoising Diffusion Probabilistic Models." NeurIPS, 2020
- Song et al. "Denoising Diffusion Implicit Models." ICLR, 2021
- Rombach et al. "High-Resolution Image Synthesis with Latent Diffusion Models." CVPR, 2022
- Karras et al. "Elucidating the Design Space of Diffusion-Based Generative Models." NeurIPS, 2022
- Peebles & Xie. "Scalable Diffusion Models with Transformers." ICCV, 2023
- Lipman et al. "Flow Matching for Generative Modeling." ICLR, 2023
- Ho & Salimans. "Classifier-Free Diffusion Guidance." NeurIPS Workshop, 2021
- Luo. "Understanding Diffusion Models: A Unified Perspective." arXiv, 2022
