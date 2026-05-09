# Multi-Task Losses and Objectives: First Principles

## Scope

AV models often train many heads together: detection, classification, box regression, velocity, segmentation, occupancy, depth, flow, tracking, trajectory prediction, map elements, and uncertainty. The architecture may be modern, but training behavior is dominated by the objective.

This page explains the first principles behind multi-task losses and why objective design matters for perception, dynamic object removal, map cleaning, and world models.

## Scalar Losses

Gradient descent needs a scalar:

```text
L_total = sum_i w_i L_i
```

Each task loss contributes gradients:

```text
grad L_total = sum_i w_i grad L_i
```

The weights `w_i` decide which task gets training priority. If a rare-object removal loss is tiny relative to dense background segmentation, the model may learn a clean-looking map that deletes hazards.

## Classification Losses

Cross-entropy trains class probabilities. Focal loss downweights easy examples:

```text
FL(p_t) = - alpha (1 - p_t)^gamma log(p_t)
```

This is useful for dense detection because background cells dominate. It is also relevant to moving/static separation: moving points are often rare compared with static points.

Failure mode: focal loss can overfocus on noisy labels if rare positives are mislabeled.

## Regression Losses

Common regression losses:

- L1: robust, sparse gradients.
- L2: penalizes large errors strongly.
- Smooth L1 / Huber: blends L1 and L2.
- IoU/GIoU/DIoU: box-overlap objectives.

For map cleaning, geometric regression should be tied to metric error. A small visual error can be a large localization error if it removes a thin but important feature.

## Segmentation and Occupancy Losses

Dense losses often combine:

```text
cross entropy + dice / IoU + boundary / Lovasz-style terms
```

Occupancy adds a class imbalance problem: free space is abundant, occupied cells are sparse, unknown cells are ambiguous. Dynamic-object removal adds another imbalance: true moving points may be a small fraction of a scan.

## Flow and Trajectory Losses

Flow and trajectory models often use endpoint errors:

```text
EPE = ||predicted_vector - true_vector||
```

For planning, average displacement can hide rare collision-relevant errors. Use horizon-specific metrics, collision proxies, calibration, and scenario buckets.

## Loss Weighting

Manual weighting is common but brittle. Alternatives include:

- uncertainty weighting,
- gradient normalization,
- dynamic weight averaging,
- task-specific schedules,
- two-stage training,
- frozen backbones or adapters.

Uncertainty weighting learns weights based on task noise, but it is not a magic safety policy. A task with noisy labels can be downweighted even if it is safety-critical.

## Gradient Conflict

Tasks can produce conflicting gradients. A shared BEV backbone may receive one gradient that improves occupancy and another that worsens velocity prediction.

Review signals:

- per-task gradient norms,
- cosine similarity between task gradients,
- per-task validation curves,
- rare-class metrics after adding a new task,
- ablations with and without each head.

## Objective-Deployment Mismatch

The training objective may not match deployment risk.

Examples:

- Removing more dynamic points improves map cleanliness but erodes static structure.
- Improving mIoU hides poor small-object recall.
- Lower ADE averages over a rare but dangerous future.
- Better image reconstruction erases low-contrast FOD.

Safety-critical tasks need explicit risk-weighted metrics, not only aggregate losses.

## AV Review Checklist

```text
What losses are used by each head?
How are loss weights chosen and logged?
Are per-task gradients monitored?
Do rare hazards have enough loss mass?
Does improving one task regress another?
Are deployment metrics aligned with training losses?
Are false deletion and false retention costs separated?
```

## Sources

- Lin et al., "Focal Loss for Dense Object Detection": https://arxiv.org/abs/1708.02002
- Kendall et al., "Multi-Task Learning Using Uncertainty to Weigh Losses": https://arxiv.org/abs/1705.07115
- Rezatofighi et al., "Generalized Intersection over Union": https://arxiv.org/abs/1902.09630
- Chen et al., "GradNorm": https://arxiv.org/abs/1711.02257
- Yu et al., "Gradient Surgery for Multi-Task Learning": https://arxiv.org/abs/2001.06782
- Local companion: [Optimization and Training Dynamics](optimization-training-dynamics.md)
