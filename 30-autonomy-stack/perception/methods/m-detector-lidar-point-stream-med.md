# M-detector LiDAR Point-Stream MED

<!-- method-priority:start
priority:
  learning: 3
  deployment: 4
  type: "method"
  stage: "deployment-pattern"
  maturity: "pilot-proven"
  tags: ["perception", "validation", "data-engine", "road-av"]
  reason: "M-detector LiDAR Point-Stream MED is rated for operational perception validation, calibration, or safety-screening workflows."
method-priority:end -->

**Last updated:** 2026-05-09

## What It Is

M-detector is a moving event detector for LiDAR point streams. Instead of waiting for a full scan and then segmenting a frame, it labels each incoming LiDAR point as event or non-event immediately after point arrival.

The Nature Communications paper reports point-level detection latency of 2-4 us. That makes M-detector relevant when a robot needs a fast moving-object cue before the next full LiDAR frame is complete.

## Core Technical Idea

| Component | Role | Integration concern |
|---|---|---|
| Occlusion principle | Detects movement when objects occlude background rays or recursively occlude along the ray direction | Requires usable depth history and first-return LiDAR behavior |
| Three event tests | Runs parallel tests for different occlusion cases | Parameters are sensor and scene dependent |
| Point-out mode | Outputs an event label for each received point | Lowest latency, noisier than delayed refinement |
| Accumulation / clustering | Accumulates recent event labels and applies clustering or region growth | Better spatial coherence, but adds delay |
| Depth image library | Stores recent depth images for future point tests | Needs ego-motion compensation and memory management |
| Frame-out mode | Outputs refined labels after accumulation | Better for map cleaning and evaluation, less useful for hard real-time reaction |

## Inputs and Outputs

| Interface | Requirement |
|---|---|
| Input point stream | Individual LiDAR points or a serialized scan frame |
| Ego-motion | Sensor ego-motion should be compensated before event testing |
| Sensor support | Reported across multi-line spinning LiDAR and non-repetitive irregular LiDAR such as Livox AVIA |
| Output | Event/non-event labels per point, optionally accumulated frame outputs |
| Optional downstream | Dynamic point removal, traffic monitoring, surveillance, and obstacle avoidance |

## Evaluation Notes

| Source result | Practical interpretation |
|---|---|
| Nature Communications article published 2024-01-06 | Peer-reviewed method description and experiments |
| Evaluated on KITTI, SemanticKITTI, Waymo, nuScenes, and AVIA-Indoor | Broad dataset coverage, but not airside-specific |
| Paper reports 119 sequences and more than 51 minutes of data | Good diversity for first-principles method testing |
| Compared with LMNet and SMOS in the article | Useful baseline contrast between learning-based MOS and occupancy-style motion segmentation |
| MOE repository includes M-detector in its benchmark table | MOE score is modest there; latency and online behavior should still be evaluated separately |

## Strengths

| Strength | Why it matters |
|---|---|
| Training-data-free | Useful before airside MOS labels are available |
| Point-level latency | Can detect sudden motion before scan-level methods finish |
| Shape-agnostic motion cue | Does not require object categories or boxes |
| Sensor generalization goal | Designed around occlusion principles rather than road-only semantics |
| Public ROS package | Easier to replay with bags and compare against MOS baselines |
| Dynamic map cleaning use case | Can remove moving points before map integration or mark them for review |

## Failure Modes

| Failure mode | Mitigation |
|---|---|
| Ego-motion or timestamp error | Validate odometry, deskewing, and point timestamps before scoring |
| Sparse far objects | Report range-banded recall and minimum point count |
| Slow start/stop motion | Add low-speed replay clips and compare against radar Doppler or track evidence |
| Occlusion-poor motion | Do not assume all motion creates strong occlusion evidence |
| Parameter sensitivity | Keep per-sensor configs versioned and run sensitivity sweeps |
| No semantic class output | Pair with semantic segmentation or tracking when class-specific behavior matters |

## Airside AV Fit

| Use case | Fit |
|---|---|
| Sudden pedestrian or tug movement near a stand | Strong candidate as a fast advisory moving-event cue |
| Static map survey cleaning | Useful as a pre-filter, but delayed frame-out mode may be more stable |
| Multi-LiDAR apron vehicle | Requires per-sensor calibration and careful fusion of point timestamps |
| Cone/barrier handling | Detects motion, not temporary static obstacles; pair with object/zone perception |
| Aircraft pushback | Needs validation for large slow-moving geometry and occlusion by gear/wing structure |
| Safety case | Treat as one evidence channel, not a certified obstacle detector |

## Implementation Notes

1. Start with offline ROS bag replay using the public package, not direct production integration.
2. Run both point-out and frame-out modes and record latency, precision, recall, and static erosion.
3. Use the package's dataset folder convention for predictions and IoU calculation to keep evaluations reproducible.
4. Version the LiDAR-specific config files with sensor model, FOV, occlusion thresholds, and cluster settings.
5. Clear or reset depth history after localization discontinuities, route resets, or sensor time jumps.
6. Compare against LiDAR-MOS, 4DMOS, and MOE baselines on the same clips before selecting thresholds.

## Sources

- M-detector Nature Communications article: https://www.nature.com/articles/s41467-023-44554-8
- M-detector repository: https://github.com/hku-mars/M-detector
- MOE benchmark repository: https://github.com/DeepDuke/MOE-Dataset
- LiDAR-MOS paper: https://arxiv.org/abs/2105.08971
- Local context: `30-autonomy-stack/perception/methods/lidar-mos.md`
- Local context: `30-autonomy-stack/perception/datasets-benchmarks/moe-lidar-moving-event-benchmark.md`
