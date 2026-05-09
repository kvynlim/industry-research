# Diffusion, Score Models, Flow Matching, and Samplers

## Scope

This page isolates the sampler and objective mechanics behind diffusion-style models. The existing [Diffusion Models](diffusion-models.md) page explains the broader generative framework and driving applications. This page focuses on the first principles needed to review AV world models, trajectory generators, occupancy forecasters, and denoising models.

## Score Functions

For a data distribution `p(x)`, the score is:

```text
score(x) = grad_x log p(x)
```

The score points toward regions of higher probability. Diffusion models learn scores at different noise levels so they can move noisy samples back toward the data manifold.

In AV terms, a score model learns how a noisy future scene, trajectory, occupancy grid, or point cloud should be corrected to look plausible under the training distribution.

## Denoising Score Matching

Train by corrupting clean data:

```text
x_sigma = x + sigma epsilon
epsilon ~ N(0, I)
```

Then learn a model that predicts either:

- the clean data `x`,
- the noise `epsilon`,
- the velocity/flow direction,
- or the score.

These parameterizations are mathematically related but have different numerical behavior.

## DDPM

DDPM defines a forward noising process and a learned reverse process. The core training loss is often a noise-prediction MSE:

```text
L = ||epsilon - epsilon_theta(x_t, t, condition)||^2
```

Strength: stable likelihood-inspired training.

Weakness: many reverse steps can be expensive for real-time autonomy.

## DDIM and Deterministic Sampling

DDIM interprets sampling as an ODE-like deterministic path. It can sample with fewer steps by skipping parts of the original noise schedule.

For AV deployment, step count matters directly:

```text
20 denoising steps x 10 ms network = 200 ms
```

That may be fine for offline scenario generation and too slow for an on-vehicle planner.

## SDE and ODE Views

Score-based generative models can be written as stochastic differential equations or probability-flow ODEs. The SDE view samples with noise; the ODE view follows a deterministic trajectory through probability space.

The practical review question is:

```text
Which solver, step count, and noise schedule were used at evaluation and deployment?
```

Changing the sampler can change both quality and failure modes.

## EDM

Elucidated Diffusion Models emphasized that many diffusion design choices are separable:

- noise distribution,
- preconditioning,
- loss weighting,
- sampler,
- time/noise schedule.

This is useful for AV model review because two papers may both say "diffusion" while using very different training and sampling regimes.

## Flow Matching

Flow matching trains a model to predict a velocity field that transports samples from a simple distribution to the data distribution:

```text
dx_t / dt = v_theta(x_t, t)
```

Compared with denoising diffusion, flow models can be simpler to sample and are increasingly used in action generation and trajectory policies.

For AV, flow matching is relevant to:

- multimodal trajectory generation,
- diffusion policies,
- future occupancy generation,
- controllable scenario generation,
- VLA action heads.

## Rectified Flow

Rectified flow attempts to learn straighter paths between noise and data. Straighter paths can reduce sampler steps. The safety-relevant question is whether reduced steps preserve rare-event diversity and constraint satisfaction.

## Sampler Error

A trained model is not enough. The sampler introduces approximation error.

Failure modes:

- Too few steps produce over-smoothed or implausible futures.
- Aggressive guidance collapses diversity.
- Deterministic sampling hides uncertainty.
- Noise schedules underrepresent rare edge cases.
- Training loss improves while closed-loop planning gets worse.

## AV Review Checklist

```text
What is predicted: noise, score, x0, or velocity?
How many sampler steps are used?
Is sampling stochastic or deterministic?
What conditioning is used: map, action, goal, text, ego state?
Are constraints enforced during sampling or after sampling?
Are rare but safe futures preserved?
Does sampler latency fit the planner cycle?
Are open-loop and closed-loop metrics both reported?
```

## Removal and Denoising Connection

LiDAR denoising and dynamic-object removal can use diffusion-style ideas, but the safety goal differs from image generation. A removal model should not hallucinate a cleaner point cloud that hides a real hazard. For removal, output uncertainty and removed-point evidence are more important than perceptual quality.

## Sources

- Ho et al., "Denoising Diffusion Probabilistic Models": https://arxiv.org/abs/2006.11239
- Song et al., "Denoising Diffusion Implicit Models": https://arxiv.org/abs/2010.02502
- Song et al., "Score-Based Generative Modeling through Stochastic Differential Equations": https://arxiv.org/abs/2011.13456
- Karras et al., "Elucidating the Design Space of Diffusion-Based Generative Models": https://arxiv.org/abs/2206.00364
- Lipman et al., "Flow Matching for Generative Modeling": https://arxiv.org/abs/2210.02747
- Liu et al., "Flow Straight and Fast: Learning to Generate and Transfer Data with Rectified Flow": https://arxiv.org/abs/2209.03003
- Local companion: [Diffusion Models](diffusion-models.md)
