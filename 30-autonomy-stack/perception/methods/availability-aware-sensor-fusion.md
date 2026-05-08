# Availability-Aware Sensor Fusion

## What It Is

- Availability-aware Sensor Fusion, or ASF, is a 4D radar, LiDAR, and camera fusion method.
- The full paper title is "Availability-aware Sensor Fusion via Unified Canonical Space for 4D Radar, LiDAR, and Camera."
- It was released as a 2025 arXiv paper by KAIST researchers.
- The method targets object detection when one or more sensors are degraded or unavailable.
- It is explicitly designed around sensor availability instead of assuming all modalities are always valid.
- The main benchmark in the paper is K-Radar.

## Core Technical Idea

- Deeply coupled fusion can fail when one sensor disappears or degrades.
- Sensor-wise cross-attention can avoid coupling but is often expensive and hard to align.
- ASF projects camera, LiDAR, and 4D radar features into a unified canonical space.
- Unified Canonical Projection, or UCP, makes features from different sensors more consistent before fusion.
- Cross-Attention across Sensors Along Patches, or CASAP, fuses available sensor features patch by patch.
- Sensor independence is preserved so unavailable sensors do not poison the fused representation.
- The canonical feature space lets cross-attention operate with lower cost than all-pairs sensor fusion.

## Inputs and Outputs

- Inputs are camera images, LiDAR point clouds, and 4D radar point or tensor features.
- The method can run with degraded or missing sensor modalities in the evaluated conditions.
- Intermediate outputs are canonical-space sensor features and patch-level attention features.
- Final outputs are 3D object detections with BEV and 3D AP metrics.
- The paper reports AP BEV and AP 3D at IoU 0.5.
- The method assumes a calibrated multi-sensor rig and a dataset with all three modalities.
- It is not a sensor fault diagnosis model, although it is designed to tolerate faults.

## Architecture or Benchmark Protocol

- Each sensor has its own feature encoder before canonical projection.
- UCP maps each modality into a shared feature representation.
- CASAP performs cross-attention among sensors along spatial patches.
- The design avoids direct feature coupling that would make one feature tensor depend irreversibly on a failed sensor.
- A detection head predicts objects from the availability-aware fused representation.
- The paper compares ASF to deeply coupled fusion and sensor-wise cross-attention baselines.
- Experiments include adverse weather and sensor degradation or failure conditions.

## Training and Evaluation

- Evaluation is performed on the K-Radar dataset.
- K-Radar provides camera, LiDAR, and 4D radar data in multiple weather conditions.
- The paper reports ASF reaching 87.2 AP BEV and 73.6 AP 3D at IoU 0.5.
- Reported improvements are 9.7% in AP BEV and 20.1% in AP 3D over prior fusion methods in the paper's setup.
- The key evaluation question is whether the detector retains performance when sensor availability changes.
- The arXiv page states that code will be available through the KAIST AVELab K-Radar repository.
- Production replication should verify the exact release status and configuration before comparison.

## Strengths

- Covers camera, LiDAR, and 4D radar in one fusion design.
- Radar inclusion makes it more relevant to adverse weather than camera-LiDAR-only methods.
- The method explicitly acknowledges missing and degraded sensors.
- Patch-level attention offers a practical tradeoff between robustness and compute.
- Canonical projection makes sensor feature alignment an architectural primitive.
- The K-Radar evaluation includes weather variation that is closer to operational degradation than clean nuScenes only.

## Failure Modes

- Results depend heavily on K-Radar sensor layout, labels, and weather distribution.
- Canonical features may still encode dataset-specific modality biases.
- A missing sensor is different from a subtly wrong sensor; the latter can be harder to detect.
- Calibration drift and timestamp skew can still corrupt canonical projection.
- 4D radar quality varies widely across hardware vendors and mounting locations.
- The method does not provide formal uncertainty bounds or safety guarantees.
- If all available sensors are weak in the same spatial patch, CASAP has no reliable evidence to recover.

## Airside AV Fit

- ASF is a strong conceptual fit for airport apron AVs because radar is useful in fog, rain, spray, darkness, and glare.
- Availability-aware fusion maps naturally to ODD policies that degrade speed or autonomy when sensors are impaired.
- It could support sensor-suite designs that keep radar as a primary resilience modality rather than a late-stage add-on.
- Airside transfer requires data with aircraft, ground crew, tugs, cones, baggage carts, jet bridges, and reflective clutter.
- Apron weather and lighting should be evaluated as real sensor data, not only synthetic corruption.
- ASF should be paired with explicit sensor-health monitoring and planner-side capability limits.

## Implementation Notes

- Check whether the exact ASF code and configs are released before planning reproduction.
- If porting to an airside stack, keep modality masks explicit and logged.
- Benchmark single-sensor, two-sensor, and all-sensor cases separately.
- Add calibration and timestamp perturbations to the evaluation because canonical projection depends on geometry.
- Verify radar preprocessing for the target hardware, including Doppler channels and elevation resolution.
- Use degraded-input validation from MSC-Bench, MultiCorrupt, and S2R-Bench as complementary tests.

## Sources

- arXiv paper: https://arxiv.org/abs/2503.07029
- ar5iv full text: https://ar5iv.labs.arxiv.org/html/2503.07029
- K-Radar repository: https://github.com/kaist-avelab/K-Radar
