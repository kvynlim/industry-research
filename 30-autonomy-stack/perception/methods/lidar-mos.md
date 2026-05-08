# LiDAR-MOS

## What It Is

- LiDAR-MOS is the PRBonn LMNet method for moving object segmentation in 3D LiDAR sequences.
- It predicts whether each LiDAR point belongs to a moving object or a static/non-moving object.
- The task is intentionally motion-centric rather than semantic-class-centric.
- A parked car and a moving car have the same semantic class but different MOS labels.
- The work also introduced a SemanticKITTI-based moving object segmentation benchmark.
- It is a useful baseline for separating dynamic foreground from static map structure.

## Core Technical Idea

- Convert sequential rotating LiDAR scans into range-image representations.
- Use temporal residual information between scans to expose changes caused by object motion.
- Feed the range-view sequence features into CNN segmentation backbones adapted from LiDAR semantic segmentation.
- Predict binary moving/static labels rather than a full semantic taxonomy.
- Exploit several previous scans while keeping inference faster than sensor frame rate.
- Treat motion as a first-class perception output, not only as a byproduct of tracking.

## Inputs and Outputs

- Input: time-ordered 3D LiDAR scans from a rotating sensor.
- Input: ego-motion compensation or scan alignment so residuals reflect scene motion rather than only ego motion.
- Intermediate input: projected range images and temporal residual images.
- Output: per-point binary MOS label for the current scan.
- Output: moving-object mask that can be applied before SLAM, mapping, tracking, or occupancy updates.
- Assumption: the LiDAR scan pattern is regular enough for range-view projection.

## Architecture or Dataset/Pipeline

- The public repository contains MOS variants built on RangeNet++ and SalsaNext style range-view backbones.
- The pipeline projects point clouds to range images, stacks temporal cues, runs image-like convolutions, then reprojects predictions to points.
- Residual range images are used to highlight where measured range changes after ego-motion alignment.
- The benchmark remaps SemanticKITTI labels into moving and non-moving categories.
- The method is LiDAR-only and does not require cameras, radar, or object detections.
- The range-view design favors speed and simple integration with existing LiDAR segmentation stacks.

## Training and Evaluation

- Training uses SemanticKITTI sequences with moving-object labels derived for the MOS benchmark.
- Evaluation uses point-level moving IoU, static IoU, and mean IoU style MOS metrics.
- The paper reports stronger segmentation quality than prior LiDAR-only motion baselines available at publication time.
- The repository documents use for improving LiDAR odometry and mapping after removing moving points.
- The task is evaluated on urban driving sequences, not airport apron traffic.
- Generalization depends heavily on scan pattern, ego-motion quality, and object motion distribution.

## Strengths

- Simple binary output is easy to consume by SLAM, mapping, tracking, and planning modules.
- Range-view CNNs are mature, fast, and easier to deploy than heavy 4D sparse convolution models.
- Separates parked from moving objects, which semantic segmentation alone cannot do.
- Does not require bounding boxes or instance tracking at inference time.
- Public code and benchmark make it a practical reference implementation.
- Useful as a low-risk first learned MOS experiment for a LiDAR-first stack.

## Failure Modes

- Residuals are sensitive to ego-motion error, timestamp drift, and rolling LiDAR scan distortion.
- Very slow motion can be confused with static structure.
- Far objects with few points may be fragmented or missed.
- Motion during a single rotating scan can cause geometric artifacts.
- Range-view projection can lose detail for unusual multi-LiDAR layouts or non-repetitive solid-state LiDAR.
- The binary task does not identify object class, intent, or instance identity.

## Airside AV Fit

- High value for map cleanup around stands where aircraft, tugs, carts, and personnel move through mapped space.
- Useful for suppressing dynamic points before GTSAM/VGICP map matching.
- Helps detect whether GSE is parked or starting to move, but only if low-speed apron motion is represented in training.
- Needs airport-specific labels for aircraft parts, belt loaders, dollies, cones, FOD, and crouched personnel.
- Multi-LiDAR reference airside vehicles may need a fused range image or per-sensor MOS with late fusion.
- Should be treated as advisory perception, with classical obstacle persistence and radar Doppler as independent checks.

## Implementation Notes

- Start by replaying synchronized rosbag LiDAR plus localization into the offline PRBonn pipeline.
- Validate ego-motion compensation before judging network quality.
- Export both full cloud and dynamic-masked cloud topics for side-by-side SLAM tests.
- Use conservative thresholds: false negatives are dangerous for planning; false positives mainly reduce mapping density.
- Add temporal hysteresis before removing map points permanently.
- Re-label or fine-tune on airside clips with parked-vs-moving GSE transitions.

## Sources

- Paper: https://arxiv.org/abs/2105.08971
- Official repository: https://github.com/PRBonn/LiDAR-MOS
- SemanticKITTI dataset and tasks: https://semantic-kitti.org/index
- RA-L DOI: https://doi.org/10.1109/LRA.2021.3093567
