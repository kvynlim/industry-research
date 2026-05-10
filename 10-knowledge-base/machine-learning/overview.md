# Machine Learning Foundations for Autonomy

<!-- kb-visual:start -->
![Machine Learning Foundations for Autonomy curated visual](../_assets/visuals/machine-learning-overview.svg)

*Visual: machine-learning foundation ladder from linear models and gradients to sequence models, self-supervision, world models, evaluation, and autonomy review.*
<!-- kb-visual:end -->

## Why This Foundation Exists

Autonomy stacks increasingly describe learned behavior through model families: BEV encoders, sparse attention, occupancy networks, diffusion policies, state-space temporal fusion, or world models. Those systems change quickly, but the review questions that decide whether the model can be trusted are older and more stable: what representation is learned, what objective shaped it, what data contract supports it, and what runtime behavior is actually monitored.

This foundation exists to keep model review grounded in first principles instead of product names. Linear scores, logits, cross-entropy, backpropagation, optimizer state, convolutional invariance, recurrent memory, attention, tokenization, self-supervision, latent dynamics, calibration, and leakage checks all remain relevant when a modern autonomy model fails in deployment.

## What This Field Studies From First Principles

Machine learning studies how data, parameterized functions, objectives, gradients, architectures, regularizers, evaluation protocols, and deployment interfaces create learned behavior. In this section, the emphasis is supervised classification, differentiable representation learning, training dynamics, sequence modeling, self-supervised objectives, latent and generative models, world-model learning, calibration, and evidence needed for autonomy review.

The first-principles thread is cumulative: affine scores become probabilistic classifiers; nonlinear layers become learned representations; computation graphs carry gradients; optimization dynamics shape what is learned; architecture choices encode spatial and temporal assumptions; representation objectives define invariances; evaluation decides whether the resulting evidence survives deployment.

## Autonomy Problem Map

Machine learning is central wherever autonomy depends on learned perception, scene understanding, prediction, representation learning, model comparison, confidence calibration, or world-model rollouts. It consumes sensor tensors, labels, pseudo-labels, logs, priors, map context, trajectories, objectives, and deployment constraints. It produces features, logits, probabilities, embeddings, detections, segmentations, tokens, latent states, rollouts, calibrated thresholds, and model-release evidence.

The autonomy risk is shortcut learning under a plausible metric. A model can improve validation mAP, open-loop loss, or benchmark score while learning leakage, label artifacts, spurious correlations, unstable calibration, or invariances that erase safety-relevant evidence. The review must connect training evidence to runtime use inside perception, prediction, planning, monitoring, and release gates.

## Core Mental Model

Think in contracts between data, representation, objective, architecture, evaluation, and deployment. A learned model is not just a function approximation artifact; it is a runtime component whose outputs must carry interpretable semantics for downstream autonomy modules.

Wrong mental model: machine learning is not just choosing the newest model family; it is the discipline of designing learned representations, objectives, data contracts, evaluation evidence, and deployment behavior that remain meaningful inside an autonomy stack.

The practical ladder is: `linear scores -> probabilistic losses -> hidden representations -> gradients and optimizer state -> spatial and temporal architectures -> token and latent objectives -> world-model rollouts -> calibration, leakage checks, and deployment monitors`. A diffusion world model, sparse 3D attention network, or Mamba-style temporal model still inherits logits, losses, gradients, initialization, normalization, optimizer state, representation invariances, and calibration obligations.

Diagnostic checks from this mental model:

- Classifier failures start with score definitions, label encoding, class imbalance, calibration, thresholding, and shortcut features before blaming the backbone.
- Training failures start with gradient paths, optimizer state, learning-rate schedules, initialization, normalization statistics, mixed precision, and multi-task loss scale.
- Spatial failures start with receptive field, stride, interpolation, coordinate transforms, padding policy, and whether the architecture encodes the invariance the task needs.
- Temporal failures start with state reset policy, sequence length, latency, BPTT truncation, hidden-state leakage, timestamp alignment, and memory/computation limits.
- Representation failures start with pretext objective, token definition, positional encoding, negative sampling, masking policy, and whether the learned invariance deletes safety-relevant evidence.

## What This Foundation Lets You Review

- Is the model learning a deployable representation or exploiting leakage, shortcuts, or label artifacts?
- Are losses, logits, probabilities, thresholds, and calibration interpreted consistently across training, validation, and runtime monitors?
- Do architecture choices match the spatial, temporal, and compute constraints of the autonomy task?
- Are world-model or prediction objectives evaluated against closed-loop planning utility rather than open-loop loss alone?
- Which failure belongs to ML foundations, and which should be handed to probability, optimization, controls, systems engineering, or MLOps?

## Problem-Class Coverage

| Problem Class | Role Of This Foundation | Representative Applied Pages |
|---|---|---|
| Perception and scene understanding | primary - learned encoders, detectors, segmenters, calibration, and leakage review define whether perception evidence is reliable. | [Production Perception Systems](../../30-autonomy-stack/perception/overview/production-perception-systems.md) for deployment review. |
| Localization, SLAM, and state estimation | supporting - learned features, descriptors, depth, place recognition, and learned priors can feed estimators, but estimator consistency is owned elsewhere. | [Robust State Estimation and Multi-Sensor Localization Fusion](../../30-autonomy-stack/localization-mapping/overview/robust-state-estimation-multi-sensor.md) for estimator handoff. |
| Mapping and spatial memory | supporting - learned occupancy, semantics, implicit fields, and world-model priors shape map evidence without owning persistent map policy. | [World Models Overview](../../30-autonomy-stack/world-models/overview.md) for learned scene memory. |
| Prediction and world modeling | primary - sequence models, latent dynamics, generative rollouts, and world-model objectives define learned future-state evidence. | [World Models Overview](../../30-autonomy-stack/world-models/overview.md) for rollout review. |
| Planning and decision making | supporting - learned costs, policies, imitation, and world models influence planning, but feasibility and safety constraints need planning/control review. | [Neural Motion Planning](../../30-autonomy-stack/planning/neural-motion-planning.md) for planning-facing objective review. |
| Control and actuation | not central - ML may estimate latent state or learned dynamics, but closed-loop command feasibility belongs to controls. | [Neural Motion Planning](../../30-autonomy-stack/planning/neural-motion-planning.md) for learning-to-planning handoff before control review. |
| Safety, validation, and assurance | primary - data splits, leakage, calibration, robustness, confidence intervals, and model comparison are central to ML safety evidence. | [Production ML Deployment](../../40-runtime-systems/ml-deployment/production-ml-deployment.md) for release and monitoring evidence. |
| Runtime systems and operations | supporting - model size, batching, precision, determinism, monitoring, and fallback behavior affect runtime operations, but system ownership sits in deployment and operations. | [Production ML Deployment](../../40-runtime-systems/ml-deployment/production-ml-deployment.md) for runtime model contract review. |

## Reading Paths By Task

For linear decision semantics, read [Perceptron and Linear Classifiers](perceptron-linear-classifiers.md), then [Logistic, Softmax, and Cross-Entropy](logistic-softmax-cross-entropy.md).

For differentiable representation learning, read [Multilayer Perceptrons and Activations](multilayer-perceptrons-activations.md), [Backpropagation, Computational Graphs, and Autodiff](backprop-computational-graphs-autodiff.md), [Convolutional Neural Networks](convolutional-neural-networks.md), and [Recurrent Neural Networks, LSTM, and GRU](recurrent-neural-networks-lstm-gru.md).

For training instability, read [Optimization and Training Dynamics](optimization-training-dynamics.md), [Initialization, Normalization, and Regularization](initialization-normalization-regularization.md), and [Multi-Task Losses and Objectives](multi-task-losses-and-objectives-first-principles.md).

For attention and sequence architectures, read [Attention and Transformers: First Principles](attention-transformers-first-principles.md), [Vision Transformers: First Principles](vision-transformers-first-principles.md), [Sequence Models: RNNs, SSMs, Attention, and Mamba](sequence-models-rnn-ssm-attention-first-principles.md), [State-Space Models, S4, and Mamba](state-space-models-s4-mamba-first-principles.md), [Mamba and State Space Models for Autonomous Driving](mamba-ssm-for-driving.md), and [Sparse Attention for 3D Perception](sparse-attention-3d-perception.md).

For self-supervision, tokenization, generative modeling, and world-model evaluation, follow the grouped page list below from representation objectives through rollout utility.

## Dependency Map

```
data contract and labels
  -> linear scores and probabilistic losses
  -> hidden representations and gradients
  -> optimizer, normalization, and regularization dynamics
  -> spatial, temporal, attention, and state-space architecture choices
  -> tokenization, self-supervised, latent, and generative objectives
  -> world-model rollouts and planning-facing evaluation
  -> calibration, leakage checks, deployment monitors, and autonomy review
```

Machine learning depends on probability for uncertainty semantics, optimization for solver mechanics, numerical linear algebra for stable tensor computation, geometry and sensors for measurement structure, systems engineering for data lineage and release evidence, and controls/planning for closed-loop utility. Downstream, it feeds perception, prediction, world modeling, learned costs, monitoring, and model-release decisions.

## Interfaces, Artifacts, and Failure Modes

Core artifacts include datasets, split manifests, labels, pseudo-labels, data contracts, augmentation policies, losses, logits, probabilities, embeddings, feature maps, tokens, latent states, optimizer checkpoints, calibration plots, leakage reports, model cards, runtime thresholds, precision settings, batching contracts, fallback behavior, and deployment monitors.

Diagnostic case: a self-supervised perception backbone improves validation mAP but degrades closed-loop behavior after deployment. The ML review starts with split hygiene, representation shortcuts, calibration, task-loss weighting, and temporal context. If the failure is caused by timestamp drift, the handoff is systems engineering; if the issue is threshold calibration, the handoff is probability/statistics; if actuator feasibility is the limiting factor, the handoff is controls.

Common failure modes include shortcut learning, train/validation leakage, label artifacts, score-probability confusion, calibration drift, rare-object imbalance, hard-negative instability, broken gradient paths, stale normalization statistics, train/inference mode mismatch, dtype changes, nondeterministic kernels, batching differences, memory-layout regressions, hidden-state leakage, open-loop world-model metrics that do not predict planning utility, and deployment monitors that do not observe the right semantics.

## Boundaries With Neighboring Foundations

Machine learning owns learned representations, learned objectives, architectures, calibration/leakage review, world-model learning, evaluation, and deployment failure modes. Probability owns the semantics of uncertainty and statistical evidence; optimization owns solver mechanics and residual updates; controls owns closed-loop command feasibility; systems engineering owns timing, release gates, runtime observability, and operational evidence.

- Owns: learned representations, learned objectives, architecture suitability, logits/loss interpretation, calibration and leakage review, world-model learning, model comparison, and deployment behavior of learned components.
- Hands off to: probability/statistics for uncertainty semantics, optimization for solver mechanics, controls for command feasibility, systems engineering for timing and release evidence, and MLOps/runtime systems for production orchestration.
- Does not own: statistical meaning of uncertainty, nonlinear solver mechanics, actuator feasibility, timing infrastructure, release gates, runtime observability platforms, or fleet operations policy.

## Pages In This Section

linear decisions and classification: [perceptron-linear-classifiers.md](perceptron-linear-classifiers.md), [logistic-softmax-cross-entropy.md](logistic-softmax-cross-entropy.md)

differentiable representation learning: [multilayer-perceptrons-activations.md](multilayer-perceptrons-activations.md), [backprop-computational-graphs-autodiff.md](backprop-computational-graphs-autodiff.md), [convolutional-neural-networks.md](convolutional-neural-networks.md), [recurrent-neural-networks-lstm-gru.md](recurrent-neural-networks-lstm-gru.md)

training dynamics and regularization: [optimization-training-dynamics.md](optimization-training-dynamics.md), [initialization-normalization-regularization.md](initialization-normalization-regularization.md), [multi-task-losses-and-objectives-first-principles.md](multi-task-losses-and-objectives-first-principles.md)

attention and sequence architectures: [attention-transformers-first-principles.md](attention-transformers-first-principles.md), [vision-transformers-first-principles.md](vision-transformers-first-principles.md), [sequence-models-rnn-ssm-attention-first-principles.md](sequence-models-rnn-ssm-attention-first-principles.md), [state-space-models-s4-mamba-first-principles.md](state-space-models-s4-mamba-first-principles.md), [mamba-ssm-for-driving.md](mamba-ssm-for-driving.md), [sparse-attention-3d-perception.md](sparse-attention-3d-perception.md)

self-supervision and representation objectives: [self-supervised-learning-first-principles.md](self-supervised-learning-first-principles.md), [contrastive-learning-infonsce-first-principles.md](contrastive-learning-infonsce-first-principles.md), [masked-modeling-first-principles.md](masked-modeling-first-principles.md), [jepa-latent-predictive-learning.md](jepa-latent-predictive-learning.md), [foundation-model-training-first-principles.md](foundation-model-training-first-principles.md)

latent and generative models: [autoencoders-vae-and-latent-variable-models-first-principles.md](autoencoders-vae-and-latent-variable-models-first-principles.md), [vqvae-tokenization.md](vqvae-tokenization.md), [diffusion-models.md](diffusion-models.md), [diffusion-score-flow-samplers-first-principles.md](diffusion-score-flow-samplers-first-principles.md), [energy-based-models-first-principles.md](energy-based-models-first-principles.md)

tokenization and spatial-temporal encoding: [tokenization-and-discretization-first-principles.md](tokenization-and-discretization-first-principles.md), [positional-encodings-and-coordinate-tokenization-first-principles.md](positional-encodings-and-coordinate-tokenization-first-principles.md)

world models and planning-facing evaluation: [world-models-first-principles.md](world-models-first-principles.md), [transformer-world-models.md](transformer-world-models.md), [world-model-evaluation-and-planning-objectives-first-principles.md](world-model-evaluation-and-planning-objectives-first-principles.md)

evaluation and deployment evidence: [evaluation-calibration-and-data-leakage-first-principles.md](evaluation-calibration-and-data-leakage-first-principles.md)

## Core Sources

- Goodfellow, Bengio, and Courville, [Deep Learning](https://www.deeplearningbook.org/).
- Stanford CS231n, [Linear Classification](https://cs231n.github.io/linear-classify/).
- Stanford CS231n, [Neural Networks Part 1](https://cs231n.github.io/neural-networks-1/).
- Stanford CS231n, [Neural Networks Part 2](https://cs231n.github.io/neural-networks-2/).
- Stanford CS231n, [Neural Networks Part 3](https://cs231n.github.io/neural-networks-3/).
- Stanford CS231n, [Convolutional Networks](https://cs231n.github.io/convolutional-networks/).
- PyTorch, [Automatic Differentiation with torch.autograd](https://docs.pytorch.org/tutorials/beginner/basics/autogradqs_tutorial.html).
