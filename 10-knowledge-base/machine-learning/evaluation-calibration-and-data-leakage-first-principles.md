# Evaluation, Calibration, and Data Leakage: First Principles

## Scope

ML evaluation turns model behavior into evidence. Calibration decides whether a
reported confidence means what it says. Data leakage decides whether the
evidence is real or inflated. This note explains first-principles metrics,
calibration math, leakage modes, benchmark contamination, and AV-specific
evaluation practices.

Related local notes:

- [../systems-engineering/benchmarking-metrics-statistical-validity.md](../systems-engineering/benchmarking-metrics-statistical-validity.md)
- [foundation-model-training-first-principles.md](foundation-model-training-first-principles.md)
- [self-supervised-learning-first-principles.md](self-supervised-learning-first-principles.md)
- [energy-based-models-first-principles.md](energy-based-models-first-principles.md)

## 1. The First-Principles Rule

An evaluation is valid only relative to a claim:

```text
claim = model + task + operating domain + metric + protocol + uncertainty
```

Examples:

```text
"Improves cone detection on night airside logs by 5 AP"
"Reduces future occupancy false negatives in rain"
"Keeps p99 latency below 50 ms on Orin"
"Calibrated 95% risk score covers 95% of realized hazards"
```

A metric without a claim is just a number.

## 2. Dataset Splits Are Part of the Model Contract

Random frame splits are often invalid for AV data because adjacent frames are
near duplicates. The split should match the generalization claim.

| Claim | Split should hold out |
|---|---|
| same route, new time | date/time blocks |
| new route | route IDs |
| new airport/site | site IDs |
| new weather | weather condition |
| new sensor rig | vehicle or calibration ID |
| new map version | map version |
| rare event robustness | event families |
| future prediction | future clips and labels |

The evaluation protocol should store:

```text
dataset version
split IDs
label version
map version
sensor calibration IDs
time sync assumptions
preprocessing commit
model checkpoint
thresholds and temperatures
```

Without this provenance, a reported metric is hard to audit.

## 3. Metrics Are Estimators

A metric estimates some underlying operational quantity.

For binary detection:

```text
precision = TP / (TP + FP)
recall    = TP / (TP + FN)
F1        = 2 * precision * recall / (precision + recall)
```

For probabilistic prediction:

```text
negative_log_likelihood = -mean_i log p_theta(y_i | x_i)
brier_score = mean_i sum_k (p_ik - 1[y_i = k])^2
```

For calibration:

```text
confidence = max_k p_theta(k | x)
accuracy   = 1[predicted_label = true_label]
```

The metric is meaningful only if the matching rules, thresholds, labels, and
aggregation match the decision being made.

For AV perception, average precision can hide exactly the failure that matters:
a rare small obstacle, a night pedestrian, an aircraft edge, or a wet-pavement
reflection.

## 4. Calibration

A model is calibrated if events assigned confidence `p` happen with frequency
`p`.

For classification:

```text
P(correct | confidence = 0.8) = 0.8
```

This is different from accuracy. A model can be accurate but overconfident, or
less accurate but better calibrated.

Reliability bins approximate calibration:

```text
bin B_m = examples with confidence in interval m
acc(B_m)  = mean correctness in bin
conf(B_m) = mean confidence in bin
```

Expected calibration error:

```text
ECE = sum_m |B_m| / n * |acc(B_m) - conf(B_m)|
```

ECE is useful but imperfect. It depends on binning and can hide class-specific
or scenario-specific miscalibration.

## 5. Temperature Scaling

Guo et al. showed that a simple post-hoc temperature often calibrates modern
classifiers well.

Given logits `z`, calibrated probabilities are:

```text
p_k = softmax(z_k / T)
```

Where:

- `T > 1` softens probabilities and reduces overconfidence.
- `T < 1` sharpens probabilities.
- `T` is fitted on a held-out calibration set by minimizing NLL.

Implementation:

```python
class TemperatureScaler(nn.Module):
    def __init__(self):
        self.log_t = nn.Parameter(torch.zeros(()))

    def forward(self, logits):
        temperature = self.log_t.exp().clamp(min=1e-3)
        return logits / temperature

def fit_temperature(logits_val, labels_val):
    scaler = TemperatureScaler()
    opt = torch.optim.LBFGS(scaler.parameters(), lr=0.1, max_iter=50)

    def closure():
        opt.zero_grad()
        loss = F.cross_entropy(scaler(logits_val), labels_val)
        loss.backward()
        return loss

    opt.step(closure)
    return scaler
```

Temperature scaling does not fix ranking, recall, class confusion, or OOD
failure. It only rescales confidence on data similar to the calibration set.

## 6. Calibration for Detection, Occupancy, and Forecasting

AV outputs are often structured, not single-label classification.

### Detection

Calibrate object scores by:

- class
- range bucket
- object size
- occlusion level
- weather/time condition
- sensor modality

The same 0.8 score may mean different reliability at 8 m versus 80 m.

### Occupancy

For occupancy probability:

```text
P(cell occupied | predicted probability = p) should equal p
```

Important slices:

- near field versus far field
- dynamic versus static cells
- free-space boundaries
- occluded regions
- drivable area
- high-consequence zones around aircraft or people

### Forecasting

For trajectory or future occupancy uncertainty, evaluate:

- coverage of prediction sets
- NLL of realized future under multimodal distribution
- miss rate at fixed false positive rate
- calibration of risk scores
- closed-loop planner sensitivity

## 7. Data Leakage

Data leakage means evaluation data influences training, tuning, or model
selection in a way the claim does not allow.

AV leakage examples:

| Leakage type | Example | Result |
|---|---|---|
| adjacent-frame leakage | frame `t` train, frame `t+1` validation | inflated perception metrics |
| route leakage | same route/day in train and test | weak new-route evidence |
| map leakage | future map used in current prediction | inflated mapping and planning |
| label leakage | auto-labeler saw future frames | unrealistic online performance |
| metadata leakage | filename encodes scenario class | shortcut learning |
| tuning leakage | repeated threshold tuning on test set | overfit benchmark |
| teacher leakage | foundation teacher trained on test images | inflated SSL transfer |
| simulation leakage | same random seeds across splits | weak sim generalization |

Leakage is not only a data engineering bug. It is a scientific validity bug.

## 8. Benchmark Contamination

Benchmark contamination is a broader form of leakage where evaluation examples,
labels, or benchmark-specific artifacts are present in pretraining, fine-tuning,
prompt tuning, data filtering, or repeated model selection.

In foundation-model workflows, contamination can happen because:

- pretraining data is web-scale and hard to audit
- benchmark datasets are public and copied into many corpora
- synthetic data is generated from models that saw the benchmark
- teams repeatedly tune on public leaderboards
- evaluation prompts leak into training logs

For AV foundation models, analogous contamination includes:

- training on validation routes through unlabeled SSL
- using final test logs for "just representation learning"
- deriving pseudo-labels from a model trained on the test site
- evaluating on public driving datasets that were part of generic pretraining
- tuning prompts, adapters, or thresholds on the benchmark

Mitigations:

```text
private holdout sets
time-based data cutoffs
route/site quarantines
deduplicated pretraining corpora
leaderboard-limited submissions
contamination audits by hash, embedding, and metadata
fresh scenario generation after model freeze
```

## 9. Test, Validation, Calibration, and Shadow Sets

Separate sets by purpose:

| Set | Purpose | May tune on it? |
|---|---|---|
| train | fit model parameters | yes |
| validation | choose architecture and hyperparameters | yes |
| calibration | fit thresholds, temperatures, conformal scores | yes, for calibration only |
| test | final evidence for release claim | no |
| shadow/fleet monitor | post-release drift detection | no for initial claim |
| incident set | regression and safety analysis | only under controlled protocol |

Thresholds are model parameters for evaluation purposes. If thresholds are tuned
on the test set, the test set is no longer a clean test.

## 10. Implementation Interface

An evaluation harness should make protocol explicit:

```python
class EvalExample(NamedTuple):
    input_ref: str
    label_ref: str
    route_id: str
    site_id: str
    timestamp_ns: int
    map_version: str
    calibration_id: str
    scenario_tags: tuple[str, ...]

class EvalProtocol(NamedTuple):
    split_name: str
    split_manifest: str
    metrics: tuple[str, ...]
    thresholds: dict
    calibration_artifact: str | None
    aggregation: str
    primary_slices: tuple[str, ...]
```

Every result should emit:

```text
metric table
confidence intervals
per-slice metrics
calibration curves
confusion examples
latency distribution
model and data provenance
```

For AV release gates, also emit a failure bundle:

```text
worst false negatives
worst false positives
highest-confidence wrong predictions
uncertain near misses
route/site/weather regressions
```

## 11. Statistical Uncertainty

A metric from finite data is noisy.

For paired comparisons, evaluate per-scenario deltas:

```text
d_i = metric_i(new_model) - metric_i(old_model)
```

Then report:

```text
mean(d)
confidence interval over scenarios
number of improved/regressed scenarios
tail regressions
```

Bootstrap by scenario, not by frame, when frames within a scenario are
correlated.

For safety-relevant metrics, do not rely only on mean improvement. A small mean
gain with severe rare-scenario regressions is not a deployable win.

## 12. Failure Modes

| Failure mode | Symptom | Mitigation |
|---|---|---|
| test leakage | great benchmark, poor field result | split audit and clean holdout |
| miscalibration | high confidence wrong predictions | temperature scaling, class/range calibration |
| aggregate masking | average improves, rare scenario regresses | primary slices and tail metrics |
| threshold overfit | test score improves after repeated tuning | freeze thresholds before final test |
| benchmark contamination | public benchmark no longer discriminates | private/fresh holdouts and audits |
| label noise | model penalized for correct behavior | label QA and uncertainty-aware metrics |
| ground-truth mismatch | metric rewards unsafe behavior | align metric with operational risk |
| latency ignored | accurate model misses runtime budget | p50/p95/p99 latency gates |
| calibration-set drift | temperature works offline but not in field | recalibration protocol and drift monitors |

## 13. AV and Research Relevance

Evaluation is an autonomy subsystem, not a report-writing step. It determines
whether a model can safely enter a stack.

AV-specific priorities:

- split by physical correlation, not random frames
- report rare-class and rare-scenario behavior
- calibrate by range, class, occlusion, and weather
- include latency and compute
- test under sensor degradation and calibration perturbation
- preserve evidence bundles for safety review
- keep final test sets quarantined
- use closed-loop evaluation when model outputs affect planning

For airside systems, the evaluation set should explicitly cover:

- aircraft proximity
- stand entry and exit
- service-road crossings
- baggage trains and dollies
- cones, chocks, FOD-like objects
- night, glare, rain, and wet apron
- jet blast or exhaust haze where relevant
- map changes and temporary closures

## 14. Practical Checklist

Before trusting a metric:

1. State the claim.
2. Identify the operational domain.
3. Confirm the split supports the claim.
4. Check whether thresholds and temperatures were fit on a separate set.
5. Audit leakage and contamination paths.
6. Inspect per-scenario and tail metrics.
7. Report confidence intervals.
8. Review high-confidence failures.
9. Verify latency and deployment constraints.
10. Preserve the exact protocol artifact.

## Sources

- Guo et al., "On Calibration of Modern Neural Networks." ICML, 2017. https://arxiv.org/abs/1706.04599
- Goodfellow, Bengio, and Courville, "Deep Learning." MIT Press, 2016. https://www.deeplearningbook.org/
- Deng et al., "Benchmark Data Contamination of Large Language Models: A Survey." arXiv:2406.04244. https://arxiv.org/abs/2406.04244
- Sainz et al., "NLP Evaluation in trouble: On the Need to Measure LLM Data Contamination for each Benchmark." arXiv:2310.18018. https://arxiv.org/abs/2310.18018
- Ovadia et al., "Can You Trust Your Model's Uncertainty? Evaluating Predictive Uncertainty Under Dataset Shift." NeurIPS, 2019. https://arxiv.org/abs/1906.02530
- OpenVINS filter evaluation metrics. https://docs.openvins.com/eval-metrics.html
