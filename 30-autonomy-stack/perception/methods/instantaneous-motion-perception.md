# Instantaneous Motion Perception

## What It Is

- Instantaneous Motion Perception refers here to the CVPR 2024 method "Instantaneous Perception of Moving Objects in 3D."
- The paper introduces the S'More framework for subtle motion detection and motion-flow estimation from LiDAR.
- It targets small, safety-critical object motion that begins before standard trackers produce a stable velocity.
- Examples include a parked vehicle starting to move or a vehicle stopping and reversing.
- The method is object-centric rather than full-scene panoptic segmentation.
- It includes a benchmark extracted from Waymo for small-motion evaluation.

## Core Technical Idea

- Standard LiDAR motion estimation struggles with the "swimming" artifact: sparse point samples vary across frames even for static objects.
- The method uses local occupancy completion to densify the visible object surface cue.
- Occupancy completion is learned jointly with moving-object detection and motion-flow estimation.
- It avoids full object shape completion and focuses on the visible surface where motion evidence is strongest.
- The model is trained specifically in the subtle-motion regime.
- It detects and quantifies motion as soon as objects begin to move.

## Inputs and Outputs

- Input: sequential LiDAR point clouds over a short temporal window.
- Input: object proposals or objects of interest, with background and large-motion objects filtered out.
- Input assumption: ego-motion can be estimated reliably by ICP, GPS/INS, or a similar localization stack.
- Intermediate representation: per-object voxelized occupancy grids.
- Output: binary small-motion decision for each object.
- Output: point-level or object-level motion flow estimate for the moving object.

## Architecture or Dataset/Pipeline

- The framework first identifies objects of interest.
- It voxelizes each object's sequential LiDAR points.
- An encoder-decoder network predicts local occupancy completion.
- Completed occupancy features feed a motion detector.
- The same features feed a motion-flow predictor.
- Occupancy supervision uses accumulated nearby-frame LiDAR points to create denser visible-surface targets.

## Training and Evaluation

- The paper contributes a benchmark for subtle vehicle motion from the Waymo dataset.
- It compares against ICP, point-to-plane ICP, generalized ICP, CenterPoint, FastNSF, and tracking-style baselines.
- Evaluation focuses on detection F1 and motion estimation quality under latency-sensitive settings.
- The authors report superior performance for subtle motions compared with standard 3D motion estimation approaches.
- The published scope focuses on vehicles; the paper leaves human-category extension for future work.
- The method is a CVPR 2024 paper with open-access PDF and arXiv version.

## Strengths

- Directly targets early motion cues that matter before a track has several frames of evidence.
- Explicitly handles LiDAR swimming artifacts through occupancy completion.
- Complements MOS: it estimates subtle object motion, not only moving/static point labels.
- Object-centric processing can be plugged into a detector/tracker stack.
- Particularly relevant for start/stop events near conflict points.
- The benchmark frames a useful metric for reaction-time-sensitive perception.

## Failure Modes

- Requires reliable object proposals or track candidates before subtle motion inference.
- Vehicle-focused training may not transfer to pedestrians, dollies, aircraft tugs, or articulated GSE.
- Assumes ego-motion is reliable enough to subtract vehicle motion.
- Small objects with few points can still lack enough surface evidence for occupancy completion.
- Full-scene coverage is not provided; it is a targeted object module.
- It can miss hazards that are not proposed by the upstream detector.

## Airside AV Fit

- High value for slow start detection around gates, crossings, and service roads.
- Relevant to apron cases where a parked tug, belt loader, baggage train, or bus begins moving at low speed.
- Needs extension beyond road vehicles to GSE shapes and personnel.
- Could run only on objects near the ego vehicle's planned path or aircraft clearance envelope.
- the reference airside AV stack's RTK/IMU/GTSAM stack is a good source of ego-motion for this method's assumptions.
- Should be fused with radar Doppler where available, because radar gives direct radial velocity for many moving actors.

## Implementation Notes

- Use as a second-stage module after a detector/tracker, not as a replacement for dense obstacle detection.
- Build an airside subtle-motion validation set with start, stop, reverse, inching, and tow initiation events.
- Include negative examples where LiDAR sampling causes apparent motion on static aircraft and parked GSE.
- Measure time-to-detect relative to track-velocity baselines, not only final F1.
- Publish an "early motion" flag with confidence and estimated motion vector.
- Do not trigger aggressive planning behavior from this module alone; use it to increase caution and prediction priority.

## Sources

- Paper: https://arxiv.org/abs/2405.02781
- CVF open-access paper: https://openaccess.thecvf.com/content/CVPR2024/papers/Liu_Instantaneous_Perception_of_Moving_Objects_in_3D_CVPR_2024_paper.pdf
- CVPR 2024 proceedings entry: https://openaccess.thecvf.com/content/CVPR2024/html/Liu_Instantaneous_Perception_of_Moving_Objects_in_3D_CVPR_2024_paper.html
- Waymo Open Dataset: https://waymo.com/open/
