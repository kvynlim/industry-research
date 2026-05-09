# Uncertainty Quantification, Calibration, and Conformal Prediction

Uncertainty quantification is the practice of making model uncertainty explicit
enough to support decisions. Calibration asks whether predicted probabilities
match empirical frequencies. Conformal prediction wraps a predictor with
finite-sample coverage guarantees under exchangeability assumptions.

## Related docs

- [Gaussian Noise, Covariance, Information, Whitening, and Uncertainty Ellipses](gaussian-noise-covariance-information.md)
- [Mahalanobis and Chi-Square Gating](mahalanobis-chi-square-gating.md)
- [Mixture Models and Multimodal Beliefs](mixture-models-multimodal-beliefs.md)
- [Information Theory for Perception and Machine Learning](information-theory-for-perception-ml.md)
- [Evaluation, Calibration, and Data Leakage: First Principles](../machine-learning/evaluation-calibration-and-data-leakage-first-principles.md)
- [Sensor Likelihoods, Noise, and Error Budgets](../sensors/sensor-likelihoods-noise-error-budgets.md)
- [World Model Evaluation and Planning Objectives](../machine-learning/world-model-evaluation-and-planning-objectives-first-principles.md)

## Why it matters for AV, perception, SLAM, and mapping

Autonomy decisions depend on uncertainty:

- A tracker gates detections using predicted innovation covariance.
- A planner slows down when occupancy or localization uncertainty grows.
- A perception model threshold turns scores into object reports.
- A world model exposes multiple future modes for interactive agents.
- A safety monitor needs coverage claims that survive distribution shift audits.

Raw neural confidence is not enough. Guo et al. showed that modern neural
networks can be poorly calibrated and that temperature scaling is a practical
post-hoc fix for many classification settings. Deep ensembles often provide
strong predictive uncertainty and OOD sensitivity. MC dropout provides one
approximate Bayesian route. Conformal prediction provides distribution-free
prediction sets with explicit coverage when the calibration and test examples
are exchangeable.

## Core definitions

### Aleatoric and epistemic uncertainty

Aleatoric uncertainty is irreducible randomness in observations or outcomes:

```text
wet pavement returns, photon noise, occlusion, future human choice
```

Epistemic uncertainty is model ignorance:

```text
unseen airport layout, novel vehicle type, insufficient training data
```

In practice they interact. A far pedestrian under rain is both noisy and less
represented in training.

### Predictive distribution

A probabilistic predictor returns:

```text
p_theta(y | x)
```

For regression, a common Gaussian output is:

```text
y | x ~ N(mu_theta(x), Sigma_theta(x))
```

For classification:

```text
p_theta(y = k | x) = softmax_k(z_theta(x))
```

Uncertainty quality is about the distribution, not just the point estimate.

### Calibration

A classifier is calibrated if:

```text
P(Y = y_hat | confidence = p) = p
```

For binary or multiclass confidence:

```text
confidence = max_k p_theta(k | x)
```

If examples assigned 0.9 confidence are correct about 90 percent of the time,
the model is calibrated on that slice.

### Sharpness

Calibration alone is not enough. A model that always predicts base rates may be
calibrated but useless. Sharpness measures concentration of predictive
distributions. The goal is calibrated and sharp.

### Prediction set

A prediction set returns a set `C(x)` rather than one label:

```text
P(Y in C(X)) >= 1 - alpha
```

The set should be small when the model is confident and large when the input is
ambiguous.

## First-principles math

### Negative log-likelihood

For data `{(x_i, y_i)}`:

```text
NLL = - (1 / n) sum_i log p_theta(y_i | x_i)
```

NLL rewards probability mass on the realized outcome. It penalizes confident
wrong predictions heavily, which is useful for safety-critical perception.

### Brier score

For class probabilities `p_i` and one-hot target `e_{y_i}`:

```text
Brier = (1 / n) sum_i ||p_i - e_{y_i}||_2^2
```

It is a proper scoring rule and often easier to decompose visually than NLL.

### Expected calibration error

Partition examples into confidence bins `B_m`:

```text
acc(B_m)  = mean_i in B_m 1[y_i = y_hat_i]
conf(B_m) = mean_i in B_m confidence_i
```

Then:

```text
ECE = sum_m |B_m| / n * |acc(B_m) - conf(B_m)|
```

ECE is easy to report but depends on binning and can hide class, range, weather,
and scene-specific miscalibration.

### Temperature scaling

Given logits `z`, calibrated probabilities are:

```text
p_k = softmax(z_k / T)
```

`T` is fitted on a held-out calibration set by minimizing NLL. If `T > 1`,
probabilities are softened. Temperature scaling does not change the predicted
class ranking; it changes confidence.

### Ensembles

For `M` models:

```text
p(y | x) = (1 / M) sum_m p_m(y | x)
```

Regression with mean and variance can decompose uncertainty:

```text
E[y] = (1 / M) sum_m mu_m
Var[y] = (1 / M) sum_m (sigma_m^2 + mu_m^2) - E[y]^2
```

The average predicted variance captures aleatoric uncertainty; disagreement
between means is a proxy for epistemic uncertainty.

### MC dropout

At test time, keep dropout active and sample predictions:

```text
y_hat_s = f_{theta, dropout_s}(x)
```

The empirical mean and variance approximate a Bayesian predictive distribution
under assumptions that connect dropout to variational inference.

### Split conformal prediction

Given a trained model and calibration examples `(x_i, y_i)`, define a
nonconformity score `s_i` where larger means worse fit.

For classification, one simple score is:

```text
s_i = 1 - p_theta(y_i | x_i)
```

Let `q` be the empirical quantile:

```text
q = ceil((n + 1) * (1 - alpha)) / n quantile of {s_i}
```

For a new example:

```text
C(x) = {y: 1 - p_theta(y | x) <= q}
```

Under exchangeability of calibration and test examples:

```text
P(Y_new in C(X_new)) >= 1 - alpha
```

For regression, if `s_i = |y_i - mu(x_i)|`, the conformal interval is:

```text
[mu(x) - q, mu(x) + q]
```

For heteroscedastic models, use normalized scores:

```text
s_i = |y_i - mu(x_i)| / sigma(x_i)
```

## Algorithmic patterns

| Pattern | Output | Best use | Main caveat |
|---|---|---|---|
| Temperature scaling | calibrated class probabilities | classification post-processing | assumes validation slice matches deployment |
| Isotonic or Platt scaling | calibrated scores | binary detectors | can overfit small calibration sets |
| Deep ensembles | predictive distribution | robust UQ, OOD detection | higher train and inference cost |
| MC dropout | sample-based uncertainty | approximate Bayesian retrofit | dropout distribution may be weak |
| Evidential models | distribution over evidence parameters | compact uncertainty head | can be miscalibrated without strong validation |
| Quantile regression | conditional intervals | regression bounds | quantile crossing and coverage drift |
| Split conformal | prediction sets or intervals | coverage guarantee on exchangeable data | guarantee is marginal, not per-slice |
| Mondrian conformal | group-conditional sets | class/range/weather slices | needs enough calibration data per group |

## AV, perception, SLAM, mapping, and planning relevance

### Detection

Detector scores are often ranking scores, not calibrated probabilities. Calibrate
by slices that affect sensor quality:

- class
- range
- object size
- occlusion
- weather
- time of day
- sensor modality
- map region or site

A 0.8 score for a close vehicle and a 0.8 score for a far cone may not mean the
same empirical correctness.

### Tracking and fusion

Kalman-style tracking requires covariance consistency. Use normalized
innovation squared:

```text
NIS = innovation^T S^-1 innovation
```

If the model is consistent, NIS follows an approximate chi-square distribution
with degrees of freedom equal to measurement dimension. Persistent excess NIS
means uncertainty is underestimated or the model is wrong.

### Occupancy and mapping

For occupancy:

```text
P(cell occupied | predicted p = 0.7) should be about 0.7
```

But cell-wise calibration is not enough. Evaluate connected components, object
surfaces, drivable-space boundaries, and high-consequence regions separately.

### Forecasting and world models

Future prediction is multimodal. A single mean trajectory can be calibrated in
MSE terms and still be useless. Use probabilistic metrics:

- NLL under a mixture or sample distribution
- coverage of prediction sets
- miss rate at fixed false positive rate
- closed-loop planner regret or collision rate
- slice calibration for interactive and occluded scenarios

### Planning

A planner should consume uncertainty through explicit contracts:

```text
state estimate + covariance
object distribution or prediction set
occupancy probability and age
model confidence or OOD score
calibration domain metadata
```

Do not pass an uncalibrated neural score as if it were a probability in a safety
cost.

## Implementation notes

- Keep a separate calibration split. Do not tune temperature, thresholds, or
  conformal quantiles on the final test set.
- Version calibration artifacts with dataset slice, model checkpoint, label
  version, preprocessing, and operating domain.
- Report reliability diagrams by scenario slice, not only globally.
- Use proper scoring rules such as NLL and Brier score when evaluating
  predictive distributions.
- For conformal prediction, document exchangeability assumptions. Route, date,
  weather, sensor rig, and map version splits matter.
- Avoid treating marginal conformal coverage as per-class or per-scenario
  coverage. Use grouped methods or separate calibration when operationally
  required.
- Monitor uncertainty drift online with NIS, score histograms, set sizes, OOD
  rates, and post-deployment label audits.

## Failure modes and diagnostics

| Symptom | Likely cause | Diagnostic |
|---|---|---|
| Confident false detections | score is uncalibrated or OOD | reliability by class/range/weather |
| Conformal sets too large | base model weak or calibration slice broad | inspect nonconformity quantiles by slice |
| Conformal coverage fails in deployment | exchangeability broken | recalibrate by route/site/weather/time split |
| Ensemble disagreement low but wrong | shared training bias or blind spot | diversify data, architecture, and OOD tests |
| MC dropout variance meaningless | dropout not aligned with epistemic uncertainty | compare to ensembles and held-out OOD |
| Planner overreacts to uncertainty | uncertainty not tied to consequence | calibrate risk costs against closed-loop outcomes |
| Planner underreacts to uncertainty | probabilities treated as scores | enforce calibrated probability contracts |
| Global ECE looks good | slice errors cancel | class/range/scenario reliability diagrams |

## Sources

- Chuan Guo, Geoff Pleiss, Yu Sun, and Kilian Q. Weinberger, "On Calibration of Modern Neural Networks": https://arxiv.org/abs/1706.04599
- Balaji Lakshminarayanan, Alexander Pritzel, and Charles Blundell, "Simple and Scalable Predictive Uncertainty Estimation using Deep Ensembles": https://arxiv.org/abs/1612.01474
- Yarin Gal and Zoubin Ghahramani, "Dropout as a Bayesian Approximation: Representing Model Uncertainty in Deep Learning": https://arxiv.org/abs/1506.02142
- Anastasios N. Angelopoulos and Stephen Bates, "A Gentle Introduction to Conformal Prediction and Distribution-Free Uncertainty Quantification": https://arxiv.org/abs/2107.07511
- Glenn Shafer and Vladimir Vovk, "A Tutorial on Conformal Prediction": https://jmlr.csail.mit.edu/papers/v9/shafer08a.html
