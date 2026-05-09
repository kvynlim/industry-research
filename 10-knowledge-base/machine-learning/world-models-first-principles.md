# World Models: First Principles

## Scope

This note explains world models as learned predictive models of environment dynamics, with emphasis on AV perception, SLAM, mapping, occupancy prediction, and planning. It is a conceptual foundation for the more specialized local docs: [transformer-world-models.md](transformer-world-models.md), [diffusion-models.md](diffusion-models.md), [vqvae-tokenization.md](vqvae-tokenization.md), [jepa-latent-predictive-learning.md](jepa-latent-predictive-learning.md), and the world-model folder under [30-autonomy-stack/world-models](../../30-autonomy-stack/world-models/overview.md).

## 1. Definition

A world model predicts how the world changes. In control form:

```text
s_{t+1} = f(s_t, a_t, c_t)
```

Where:

- `s_t` is the current latent or explicit world state.
- `a_t` is the ego action or planned trajectory.
- `c_t` is context such as map, goal, weather, rules, or task.

For an AV, `s_t` can be:

- Raw pixels.
- LiDAR point cloud.
- BEV feature map.
- 3D occupancy grid.
- Object set.
- Token sequence.
- Latent embedding.
- Map state plus dynamic-agent state.

The useful world model is not necessarily photorealistic. It is useful if its predictions improve decisions.

## 2. Why World Models Matter

Traditional AV stacks are reactive pipelines:

```text
sensors -> perception -> prediction -> planning -> control
```

World models add imagination:

```text
current state + candidate action -> predicted future -> score action
```

This supports:

- Forecasting future occupancy.
- Testing candidate trajectories before execution.
- Generating rare scenarios for validation.
- Learning representations from unlabeled video or LiDAR.
- Planning in latent space instead of hand-coded state spaces.
- Detecting model mismatch and out-of-distribution scenes.

For airside vehicles, the value is high because low speeds and structured operations make short-horizon predictive planning practical, while unusual objects make class-specific detection brittle.

## 3. The Original Neural World Model Pattern

The 2018 "World Models" paper used three pieces:

```text
V: vision model compresses observation to latent z
M: memory model predicts latent dynamics over time
C: controller chooses actions from latent state
```

This established the common pattern:

```text
observation -> latent state -> dynamics prediction -> policy/planner
```

Modern systems scale each part:

- Larger tokenizers or encoders.
- Transformer, diffusion, SSM, or JEPA dynamics.
- Planner, actor-critic, diffusion policy, or MPC control.

## 4. PlaNet and Latent Planning

PlaNet learned latent dynamics from pixels and planned online using the Cross-Entropy Method. It combined deterministic and stochastic transition components so the latent state could represent both predictable dynamics and uncertainty.

The first-principles point:

```text
Planning does not need pixel-perfect futures if the latent future
contains enough information to predict reward and safety.
```

For AVs, this motivates planning over BEV or occupancy latents instead of raw sensor video.

## 5. Dreamer: Learning Behaviors by Imagination

Dreamer trains a world model, then trains behavior inside imagined latent rollouts. Instead of sampling action sequences at inference only, Dreamer learns an actor and critic using differentiable predictions.

DreamerV2 introduced discrete latent representations and showed strong Atari performance. DreamerV3 emphasized robustness across many domains with a single configuration. See [30-autonomy-stack/world-models/dreamer-world-model-rl.md](../../30-autonomy-stack/world-models/dreamer-world-model-rl.md) and [30-autonomy-stack/world-models/rl-with-world-models.md](../../30-autonomy-stack/world-models/rl-with-world-models.md) for driving and RL detail.

For AV readers, the Dreamer lesson is:

```text
If the world model predicts state, reward, and continuation well enough,
policy improvement can happen in imagination.
```

The safety caveat is equally important: imagined rollouts inherit model errors.

## 6. Representation Choices

World models differ mostly by what they predict.

| Representation | Strength | Weakness | AV fit |
|---|---|---|---|
| Pixels/video | Human-inspectable, supports simulation | Expensive, many irrelevant details | Scenario generation |
| Point cloud | Metric geometry | Sparse, sensor-specific | LiDAR forecasting |
| BEV features | Efficient, planner-friendly | Depends on encoder quality | Perception/planning |
| 3D occupancy | Class-agnostic geometry | Large grids | Safety and mapping |
| Discrete tokens | LLM-style training | Tokenizer bottleneck | Autoregressive world models |
| Continuous latents | Smooth, compact | Harder to inspect | Diffusion and JEPA |
| Embeddings | Semantic and efficient | Needs probes or decoder | JEPA planning |

For airside operations, occupancy is especially attractive because it represents unknown physical objects without requiring a complete object taxonomy. See [30-autonomy-stack/world-models/occupancy-world-models.md](../../30-autonomy-stack/world-models/occupancy-world-models.md).

## 7. Dynamics Model Families

### Autoregressive Transformer

Predicts the next token or latent from past tokens:

```text
p(x_{t+1} | x_{<=t}, a_{<=t})
```

Strengths: scalable sequence modeling, discrete token likelihood, flexible conditioning.

Weaknesses: sequential generation, growing KV cache, error accumulation.

Local deep dive: [transformer-world-models.md](transformer-world-models.md).

### Diffusion or Flow Model

Learns to denoise or transport noise into a future scene or trajectory:

```text
noise + context -> future sample
```

Strengths: multimodal futures, high-fidelity generation, parallel future generation.

Weaknesses: iterative sampling cost, harder real-time deployment.

Local deep dive: [diffusion-models.md](diffusion-models.md).

### State Space Model

Maintains a recurrent latent state:

```text
h_t = update(h_{t-1}, x_t, a_t)
```

Strengths: streaming, linear sequence scaling, constant memory.

Weaknesses: compressed memory, less exact retrieval than attention.

Local deep dive: [sequence-models-rnn-ssm-attention-first-principles.md](sequence-models-rnn-ssm-attention-first-principles.md) and [mamba-ssm-for-driving.md](mamba-ssm-for-driving.md).

### JEPA

Predicts future or masked target embeddings rather than pixels:

```text
context embedding + action -> target embedding
```

Strengths: efficient semantic prediction, ignores irrelevant pixel details, promising for planning.

Weaknesses: less directly inspectable, collapse prevention and evaluation matter.

Local deep dive: [jepa-latent-predictive-learning.md](jepa-latent-predictive-learning.md).

## 8. Tokenizers and Bottlenecks

A tokenizer compresses raw observations into a form the dynamics model can predict. VQ-VAE tokenizers convert continuous inputs into discrete code indices. Continuous autoencoders produce real-valued latents. JEPA encoders produce target embeddings.

The tokenizer defines what the world model can know. If a VQ-VAE erases small FOD or thin stand markings, the transformer cannot recover them. If an image encoder ignores height, the planner cannot reason about overhangs.

See [vqvae-tokenization.md](vqvae-tokenization.md).

## 9. World Models and SLAM

SLAM estimates the present and past. World models predict futures. They overlap in the state representation.

Useful integration points:

- Dynamic filtering: predict which points or voxels are likely moving before map fusion.
- Map completion: infer unobserved occupancy or semantics from context.
- Loop closure scoring: compare current latent scene to historical map latents.
- Change detection: predict expected map observations and flag residuals.
- Active mapping: choose actions that reduce future map uncertainty.

Do not replace the map with a hidden neural state when metric consistency matters. Use the world model to propose or regularize; use SLAM geometry to verify.

## 10. Planning with a World Model

A simple model predictive control loop:

```text
for each planning cycle:
    encode current observation to state s_t
    sample or optimize candidate action sequences
    roll out world model for each candidate
    score futures for safety, progress, comfort, rules
    execute first action of best candidate
    repeat
```

For occupancy world models, scoring can be direct:

```text
candidate trajectory intersects predicted occupied voxels -> high cost
candidate trajectory stays in drivable free space -> low cost
```

For JEPA or latent models, scoring may use:

- Learned reward/cost heads.
- Distance to goal embedding.
- Classifier or probe over latent state.
- Safety monitor over decoded occupancy.

## 11. Uncertainty

World models should expose uncertainty because wrong confident futures are dangerous.

Useful uncertainty signals:

- Ensemble disagreement.
- Distributional latent predictions.
- Diffusion sample diversity.
- Reconstruction or prediction residuals.
- Conformal prediction intervals.
- OOD detectors on latent state.

In planning, uncertainty can become a cost:

```text
score = progress - collision_cost - lambda * uncertainty
```

This is especially important when a vehicle enters rare airside situations, such as unusual aircraft servicing, de-icing operations, temporary closures, or emergency vehicles.

## 12. Evaluation

World-model evaluation should match intended use.

Open-loop prediction:

- One-step and multi-step error.
- Occupancy IoU.
- Chamfer distance for point clouds.
- FID/FVD for video if simulation quality matters.
- Reward and cost prediction accuracy.

Closed-loop planning:

- Collision rate.
- Route completion.
- Rule compliance.
- Comfort.
- Intervention rate.
- Performance under OOD weather and sensor degradation.

Mapping:

- Static map consistency.
- Dynamic-object removal.
- Map-change detection.
- Localization improvement from learned priors.

A visually realistic video generator can still be a poor planner if it misses geometry. A blurry occupancy predictor can still be useful if its collision probabilities are calibrated.

## 13. Failure Modes

- Compounding rollout errors.
- Hallucinated free space in occluded regions.
- Mode collapse to average futures.
- Ignoring ego action conditioning.
- Learning dataset priors instead of physical dynamics.
- Tokenizer losing small hazards.
- Over-trusting predictions outside the training distribution.
- Open-loop metrics improving while closed-loop safety degrades.

## 14. AV and Airside Design Guidance

For AV perception and mapping readers, a pragmatic stack is:

```text
1. Keep classical state estimation and map fusion as the safety backbone.
2. Train SSL/foundation encoders on large unlabeled logs.
3. Use occupancy or BEV latents as the planning-facing representation.
4. Add action-conditioned prediction for future occupancy or cost volumes.
5. Use world-model rollouts for scenario generation and planner scoring.
6. Gate online use by uncertainty and rule-based safety monitors.
```

For airside:

- Occupancy handles unknown GSE and irregular aircraft geometry.
- Long temporal context helps slow-moving operations such as pushback.
- Map conditioning is valuable because apron layouts are structured.
- Fine near-field resolution is necessary for personnel, chocks, cones, and FOD.
- Hazard layers can represent jet blast or restricted zones as non-solid but unsafe occupancy.

## 15. Relationship to Other Local Docs

- [transformer-world-models.md](transformer-world-models.md): autoregressive transformer scene prediction.
- [diffusion-models.md](diffusion-models.md): diffusion and flow foundations for video and trajectory generation.
- [vqvae-tokenization.md](vqvae-tokenization.md): discrete representation learning for token world models.
- [jepa-latent-predictive-learning.md](jepa-latent-predictive-learning.md): embedding-space predictive world models.
- [30-autonomy-stack/world-models/overview.md](../../30-autonomy-stack/world-models/overview.md): AV world-model survey.
- [30-autonomy-stack/world-models/occupancy-world-models.md](../../30-autonomy-stack/world-models/occupancy-world-models.md): occupancy world models.
- [30-autonomy-stack/world-models/diffusion-world-models.md](../../30-autonomy-stack/world-models/diffusion-world-models.md): diffusion world models.
- [30-autonomy-stack/world-models/dreamer-world-model-rl.md](../../30-autonomy-stack/world-models/dreamer-world-model-rl.md): Dreamer for AV RL.

## Sources

- Ha and Schmidhuber, "World Models." arXiv:1803.10122. https://arxiv.org/abs/1803.10122
- Hafner et al., "Learning Latent Dynamics for Planning from Pixels" (PlaNet). arXiv:1811.04551. https://arxiv.org/abs/1811.04551
- Hafner et al., "Dream to Control: Learning Behaviors by Latent Imagination" (Dreamer). arXiv:1912.01603. https://arxiv.org/abs/1912.01603
- Hafner et al., "Mastering Atari with Discrete World Models" (DreamerV2). arXiv:2010.02193. https://arxiv.org/abs/2010.02193
- Hafner et al., "Mastering Diverse Domains through World Models" (DreamerV3). arXiv:2301.04104. https://arxiv.org/abs/2301.04104
- Vaswani et al., "Attention Is All You Need." arXiv:1706.03762. https://arxiv.org/abs/1706.03762
- Assran et al., "Self-Supervised Learning from Images with a Joint-Embedding Predictive Architecture." arXiv:2301.08243. https://arxiv.org/abs/2301.08243
