# SLiDE

<!-- method-priority:start
priority:
  learning: 3
  deployment: 4
  type: "method"
  stage: "deployment-pattern"
  maturity: "pilot-proven"
  tags: ["perception", "adverse-weather", "validation", "fallback", "mapping"]
  reason: "SLiDE is rated for cleaning, stress testing, or failure detection in degraded perception conditions."
method-priority:end -->

## What It Is

- SLiDE is an ECCV 2022 self-supervised LiDAR de-snowing method.
- The name refers to self-supervised LiDAR de-snowing through reconstruction difficulty.
- It removes snow points without requiring point-wise snow labels by learning which points are difficult to reconstruct from neighbors.
- It is focused on snowfall, not a general adverse-weather cleanup method for rain, fog, road spray, dust, steam, or multipath.
- It is closely related to [LiSnowNet](lisnownet.md) and later blind-spot variants such as [3D-KNN Blind-Spot Desnowing](3d-knn-blind-spot-desnowing.md).

## Core Technical Idea

- Snow points tend to have low spatial correlation with neighboring scene points.
- Train a Point Reconstruction Network, PR-Net, to reconstruct a target point from its local neighborhood.
- Train a Reconstruction Difficulty Network, RD-Net, to predict how difficult that reconstruction will be.
- Treat high reconstruction difficulty as evidence that the point is likely snow/noise.
- Use simple post-processing and a threshold on RD-Net output to classify snow points.
- Extend the reconstruction task as a pretext task for label-efficient supervised de-snowing when limited labels are available.

## Inputs and Outputs

- Input: LiDAR point clouds represented so local neighborhoods can be sampled around target points.
- Training input: unlabeled snowy point clouds; optional small labeled subsets for the semi-supervised extension.
- Intermediate output: reconstructed target-point estimates from PR-Net.
- Intermediate output: per-point reconstruction difficulty from RD-Net.
- Output: point-wise snow/noise classifications after thresholding.
- Non-output: object boxes, semantic classes beyond snow/noise, motion labels, or restored hidden geometry.

## Architecture or Pipeline

- Sample target points and their neighborhoods from the point cloud.
- Train PR-Net to infer each target point from neighboring points while withholding the target itself.
- Use multi-hypothesis reconstruction so ambiguous local neighborhoods can have multiple plausible reconstructions.
- Train RD-Net to predict the difficulty of PR-Net's reconstruction rather than directly using hand labels.
- At test time, classify points with RD-Net output above a selected threshold as noise.
- Apply post-processing to convert the difficulty estimate into a de-snowed point cloud.
- In the semi-supervised variant, use reconstruction difficulty as a pretext signal to improve training efficiency when a small label set exists.

## Training and Evaluation

- The arXiv page and ECCV paper present SLiDE as a label-free method comparable to fully supervised de-snowing.
- The paper compares against ROR, DROR, and WeatherNet on synthesized snow-noise data.
- Reported metrics include IoU, precision, and recall for binary snow/noise classification.
- The ECCV paper reports a threshold of 2.9 for RD-Net output in its experiments.
- It reports stronger label-free performance than DROR and comparable behavior to supervised WeatherNet in the studied setup.
- The paper also shows that the semi-supervised extension improves label efficiency when only a small percentage of labels is available.

## Strengths

- Does not require manual snow labels for the core self-supervised training path.
- The reconstruction-difficulty signal is interpretable: snow is hard to reconstruct from coherent scene geometry.
- Avoids relying solely on intensity, which varies across sensors, range, material, and weather exposure.
- Can improve supervised training when labels are scarce.
- Naturally highlights isolated or weakly correlated noise points.
- Provides a strong conceptual bridge between classical neighborhood filters and learned point-cloud denoising.

## Failure Modes

- Clean points that are isolated, thin, high, or geometrically unusual can also be hard to reconstruct and may be falsely removed.
- Dynamic-object points, personnel limbs, tow bars, cones, cables, and aircraft edges can look like low-correlation outliers.
- The method is snow-centric; rain streaks, dense fog attenuation, road spray, de-icing mist, dust, steam, and multipath ghosts have different statistics.
- Performance depends on neighborhood construction and target-point sampling.
- The threshold can be dataset-dependent and may drift across LiDAR models, beam layouts, and mounting heights.
- It does not reason over time, so it can confuse transient weather with transient object motion.
- It remains a research method and needs production wrappers, monitoring, and fallback logic.

## Airside AV Fit

- Useful for researching snowfall cleanup where explicit snow labels are expensive or inconsistent.
- Riskier near aircraft stands because small but safety-critical objects can be locally sparse and hard to reconstruct.
- Needs airport-specific false-positive analysis on cones, chocks, belt-loader edges, tow bars, baggage carts, personnel, and aircraft extremities.
- Does not directly handle de-icing spray, jet blast snow clouds, rain spray, or steam unless retrained and evaluated for those artifacts.
- Should be integrated with [Radar-LiDAR Fusion in Adverse Weather](../overview/radar-lidar-fusion-adverse-weather.md) for cross-sensor checks.
- Use the deployment discipline in [Production Perception Systems](../overview/production-perception-systems.md) before putting it in any safety-relevant path.

## Implementation Notes

- Keep PR-Net and RD-Net artifacts versioned together; RD-Net's target depends on PR-Net behavior.
- Store the reconstruction difficulty map for replay debugging, not just the final removed points.
- Treat the threshold as a calibration parameter that must be validated by route, sensor, and weather severity.
- Add scenario tests where clean sparse points are intentionally present so over-filtering is visible.
- Compare against [LiSnowNet](lisnownet.md), [LIORNet](liornet.md), and [3D-OutDet](3d-outdet.md) on the same point-index-preserving evaluation harness.
- Evaluate downstream detection and tracking impact, not just snow IoU.
- Keep raw point clouds available for safety analysis because the method can delete evidence of small obstacles.

## Sources

- arXiv abstract: https://arxiv.org/abs/2208.04043
- ECCV 2022 paper PDF: https://www.ecva.net/papers/eccv_2022/papers_ECCV/papers/136990277.pdf
