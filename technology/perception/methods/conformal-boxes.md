# Conformal Boxes

## What It Is

- Conformal Boxes is this library's name for conformal bounding-box uncertainty around object detections.
- The primary method here is "Adaptive Bounding Box Uncertainties via Two-Step Conformal Prediction."
- The paper was an ECCV 2024 oral.
- It provides post-hoc uncertainty intervals for object bounding boxes with conformal coverage guarantees.
- The method targets multi-object detection, including autonomous-driving-style safety applications.
- It is an uncertainty quantification method, not a detector architecture by itself.

## Core Technical Idea

- Split conformal prediction turns calibration-set errors into prediction intervals for new samples.
- A detector predicts class labels and bounding boxes.
- Standard box conformalization can fail when box regression depends on the predicted class.
- The two-step approach first accounts for class-label uncertainty.
- It then propagates that label uncertainty into bounding-box intervals.
- The method broadens coverage guarantees to include incorrectly classified objects.
- Ensemble and quantile-regression variants make intervals adaptive to object size.

## Inputs and Outputs

- Inputs are a trained object detector, a held-out calibration set, detector class scores, predicted boxes, and ground-truth boxes.
- The calibration set must be exchangeable with the deployment distribution for formal guarantees to apply.
- Intermediate outputs are nonconformity scores and quantile thresholds.
- Final outputs are intervals around box coordinates or shaded box uncertainty regions.
- The method can produce two-sided intervals that contain the true box with target coverage.
- It does not change the detector's raw box prediction unless integrated into a downstream decision rule.
- It currently applies most directly to 2D bounding-box localization as reported in the paper.

## Architecture or Benchmark Protocol

- Step one constructs a prediction set or uncertainty treatment for object class labels.
- Step two calibrates coordinate-wise box intervals conditional on class uncertainty.
- Per-class calibration is used when the class is known or included in the class prediction set.
- Adaptive variants scale interval width based on uncertainty estimates from ensembles or quantile regression.
- The method is model-agnostic and can wrap black-box detectors.
- Runtime overhead is small because conformal thresholds are learned offline.
- The resulting intervals can be passed to planners as conservative occupied regions.

## Training and Evaluation

- The detector is trained normally before conformal calibration.
- Calibration uses held-out labeled data and a chosen error rate alpha.
- Evaluation checks empirical coverage against the target level, such as 1 - alpha.
- The ECCV paper validates on real-world datasets for 2D bounding-box localization.
- The paper reports that desired coverage levels are satisfied with actionably tight intervals.
- It studies balanced coverage across object sizes, not only average coverage.
- The primary metrics are coverage, interval tightness, and size-conditioned behavior.

## Strengths

- Provides distribution-free uncertainty guarantees under exchangeability assumptions.
- Can be applied post-hoc to existing detectors.
- Makes detection uncertainty spatially explicit for planning and safety logic.
- The two-step design handles class-conditioned box predictions better than naive box-only conformalization.
- Adaptive intervals avoid making every object pay for worst-case uncertainty.
- It is easier to audit than opaque neural uncertainty scores.

## Failure Modes

- Guarantees depend on calibration data matching deployment data.
- Coverage can fail under domain shift, new object classes, different cameras, weather, or annotation changes.
- The method addresses localization uncertainty for detected objects, not missed detections.
- It is reported for 2D boxes; 3D boxes, BEV footprints, and occupancy require additional adaptation.
- Box intervals can become too wide for planning if the detector is weak or data are noisy.
- Association between predictions and ground truth can affect calibration scores in crowded scenes.
- It does not identify why a detector is uncertain.

## Airside AV Fit

- Conformal box intervals are useful for conservative planning around pedestrians, ground crew, baggage carts, and service vehicles.
- They can inflate occupied regions when camera detections are uncertain under glare, darkness, or occlusion.
- Airside systems need 3D or BEV uncertainty, so 2D conformal boxes are only a starting point.
- Calibration data must come from the airport ODD, including night operations, rain, snow, jet blast, and de-icing.
- Missed object risk must be handled separately with recall testing and sensor redundancy.
- The planner should consume conformal intervals as safety margins, not as proof that all hazards were detected.

## Implementation Notes

- Keep a dedicated calibration split that is never used for detector training or model selection.
- Recalibrate intervals whenever cameras, labels, detector architecture, or ODD distribution changes.
- Report empirical coverage by class, size, range, occlusion, lighting, and weather.
- For 3D detection, extend scores to center, size, yaw, and BEV footprint intervals before deployment use.
- Combine conformal intervals with track-level temporal smoothing to avoid frame-by-frame margin flicker.
- Treat low coverage on rare airside classes as a safety blocker, even if aggregate coverage is acceptable.

## Sources

- arXiv paper: https://arxiv.org/abs/2403.07263
- ECCV 2024 oral page: https://eccv.ecva.net/virtual/2024/oral/139
- ECCV paper PDF: https://www.ecva.net/papers/eccv_2024/papers_ECCV/papers/12292.pdf
