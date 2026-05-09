# Detection Theory, ROC/PR Curves, and Operating Points

A detector turns uncertain evidence into an action. The first-principles problem
is not "maximize accuracy"; it is deciding when evidence is strong enough to
declare a hypothesis under asymmetric costs, class imbalance, and downstream
risk. ROC and precision-recall curves are ways to visualize this threshold
choice, but deployment requires a specific operating point.

In perception, this appears everywhere: radar CFAR thresholds, camera object
detection confidence, occupancy cell decisions, anomaly monitors, map-change
detection, and gating of track associations.

---

## 1. Related Docs

- [Gaussian Noise, Covariance, Information, Whitening, and Uncertainty Ellipses](gaussian-noise-covariance-information.md)
- [Mahalanobis Distance, Chi-Square Gates, NIS, and NEES](mahalanobis-chi-square-gating.md)
- [Robust Statistics, RANSAC, and Hypothesis Testing](robust-statistics-ransac-hypothesis-testing.md)
- [Uncertainty Quantification, Calibration, and Conformal Prediction](uncertainty-quantification-calibration-conformal.md)
- [CFAR Detection and Thresholding](../signal-processing/cfar-detection-thresholding.md)
- [Data Association and Gating](../state-estimation/data-association-and-gating.md)

---

## 2. Binary Detection From First Principles

There are two hypotheses:

```text
H0: target/event absent
H1: target/event present
```

A sensor produces observation `z`. A detector computes a statistic `s(z)` and
compares it to a threshold:

```text
decide H1 if s(z) >= tau
decide H0 otherwise
```

For known probability models, the likelihood ratio is the canonical statistic:

```text
Lambda(z) = p(z | H1) / p(z | H0)
```

The Neyman-Pearson result says that, for simple hypotheses, a likelihood-ratio
test is most powerful for a fixed false-alarm probability:

```text
decide H1 if Lambda(z) >= eta
```

Modern neural detectors rarely expose clean likelihoods, but their confidence
scores still play the same operational role: sort examples by evidence strength
and choose a threshold.

---

## 3. Confusion Matrix

For a fixed threshold:

| | Truth positive | Truth negative |
|---|---:|---:|
| predict positive | TP | FP |
| predict negative | FN | TN |

Core rates:

```text
TPR = recall = TP / (TP + FN)
FNR = FN / (TP + FN) = 1 - TPR
FPR = FP / (FP + TN)
TNR = specificity = TN / (FP + TN)
precision = TP / (TP + FP)
```

Accuracy can be misleading:

```text
accuracy = (TP + TN) / (TP + FP + FN + TN)
```

If positives are rare, a detector that always says "absent" can have high
accuracy and zero operational value.

---

## 4. ROC Curves

An ROC curve sweeps threshold and plots:

```text
x-axis: FPR
y-axis: TPR
```

Each point is one operating threshold. Lowering the threshold usually increases
both TPR and FPR.

ROC is useful when:

- negative examples are meaningful and well sampled,
- false-alarm rate is the operational constraint,
- class priors may change but score ranking is stable,
- comparing ranking quality independent of one threshold.

Area under ROC curve (AUROC) is a ranking metric. It does not choose a threshold
and can look strong even when precision is poor for rare events.

---

## 5. Precision-Recall Curves

A PR curve sweeps threshold and plots:

```text
x-axis: recall = TP / (TP + FN)
y-axis: precision = TP / (TP + FP)
```

PR curves focus on positive predictions. They are often more informative for
rare-object perception because false positives dominate the usefulness of
reported detections.

The base rate matters. If prevalence is:

```text
pi = P(H1)
```

then precision can be written from TPR and FPR:

```text
precision = (TPR * pi) / (TPR * pi + FPR * (1 - pi))
```

This equation explains why tiny FPR values can still produce low precision when
positives are rare.

---

## 6. Operating Points

A curve is not a deployed detector. A deployed detector uses an operating point:

```text
tau_deploy = chosen score threshold
```

Thresholds should be selected from downstream costs:

```text
expected_cost(tau) =
    C_FP * FP_rate(tau) * P(H0)
  + C_FN * FN_rate(tau) * P(H1)
```

or from hard constraints:

```text
maximize recall subject to FP_per_hour <= budget
maximize precision subject to recall >= minimum
choose threshold with acceptable latency and track stability
```

For autonomy, the unit of false positives may be more useful as:

- false detections per frame,
- false tracks per minute,
- false braking events per hour,
- false map-change alerts per kilometer,
- nuisance interventions per shift.

The right threshold for a perception benchmark may not be the right threshold
for a planner, tracker, or safety monitor.

---

## 7. Calibration

A score is calibrated if:

```text
P(y = 1 | score = 0.8) ~= 0.8
```

Calibration is different from ranking. A detector can have high AUROC but
miscalibrated probabilities. Thresholds are easier to maintain when scores are
calibrated across:

- weather and lighting,
- distance and object size,
- geography/site,
- sensor hardware versions,
- class taxonomy changes,
- model updates.

Common calibration tools include reliability diagrams, expected calibration
error, Platt scaling, isotonic regression, temperature scaling, and conformal
prediction wrappers.

---

## 8. How It Appears in Perception and SLAM

| System | Detection decision |
|---|---|
| radar | declare target cell under CFAR false-alarm control |
| camera object detector | keep boxes above confidence threshold |
| LiDAR segmentation | decide object/background points |
| occupancy mapping | occupied/free threshold from probability or evidence |
| data association | accept/reject candidate association by gate distance |
| loop closure | accept/reject place match under false-closure risk |
| safety monitor | trigger alert from anomaly score |
| map validation | classify changed/unchanged infrastructure |

Tracking changes the problem because isolated false detections may be tolerable
while persistent false tracks are not. Thresholds should be evaluated after the
track lifecycle, not only on single-frame detections.

---

## 9. Common Failure Modes

| Failure | Why it happens |
|---|---|
| high AUROC but unusable detector | rare positives make precision low at deployable FPR |
| threshold tuned on test set | optimistic metrics and unstable deployment |
| one global threshold for all ranges | score distribution shifts with distance/occlusion |
| PR curve compared across different class priors | precision changes with prevalence |
| confidence treated as probability | scores are uncalibrated |
| missed safety-critical rare cases | threshold chosen for average F1 rather than cost |
| false positives cluster in time | frame-level FP rate hides event-level nuisance |
| benchmark mAP improves but tracker worsens | low-confidence boxes increase ID switches |

---

## 10. Implementation Checklist

- Preserve raw scores so thresholds can be swept offline.
- Report confusion matrices at the deployed threshold, not only AUC.
- Plot ROC, PR, precision-vs-threshold, recall-vs-threshold, and FP-rate-vs-
  threshold.
- Slice metrics by range, speed, occlusion, weather, class, site, and sensor.
- Choose thresholds on validation data and lock them before test evaluation.
- Use event-level metrics when frame-level independence is false.
- Calibrate scores if downstream systems interpret them as probabilities.
- Re-evaluate thresholds after non-maximum suppression, tracking, map fusion, or
  temporal smoothing.
- Define a false-positive budget in operational units that matter to the system.
- Monitor score distribution drift after deployment.

---

## 11. Minimal Mental Model

Detection theory starts with:

```text
evidence -> threshold -> decision -> cost
```

ROC and PR curves show what happens as the threshold moves. They do not tell you
which mistake is acceptable. The operating point is an engineering and safety
decision grounded in false-alarm budget, miss cost, class prevalence, and
downstream behavior.

---

## 12. Sources

- Steven M. Kay, "Fundamentals of Statistical Signal Processing, Volume II: Detection Theory": https://www.informit.com/store/fundamentals-of-statistical-signal-processing-volume-9780135041352
- J. Neyman and E. S. Pearson, "On the Problem of the Most Efficient Tests of Statistical Hypotheses": https://royalsocietypublishing.org/doi/10.1098/rsta.1933.0009
- Jesse Davis and Mark Goadrich, "The Relationship Between Precision-Recall and ROC Curves": https://ftp.cs.wisc.edu/machine-learning/shavlik-group/davis.icml06.pdf
- scikit-learn ROC curve documentation: https://scikit-learn.org/stable/modules/generated/sklearn.metrics.roc_curve.html
- scikit-learn precision-recall example and operating-point discussion: https://sklearn.org/stable/auto_examples/model_selection/plot_precision_recall.html
- Tom Fawcett, "An Introduction to ROC Analysis": https://www.sciencedirect.com/science/article/pii/S016786550500303X
