# AevaScenes

<!-- method-priority:start
priority:
  learning: 3
  deployment: 4
  type: "benchmark"
  stage: "reference"
  maturity: "fielded-pattern"
  tags: ["perception", "validation", "data-engine", "road-av"]
  reason: "AevaScenes is rated as a benchmark or dataset reference for perception robustness and validation coverage."
method-priority:end -->

## What It Is

- AevaScenes is an open-access FMCW 4D LiDAR and camera dataset for autonomous vehicle research.
- Aeva announced the dataset on September 30, 2025.
- It features synchronized FMCW LiDAR and RGB camera data.
- It includes object velocity measurements, semantic segmentation, tracking, and lane-line annotations.
- The dataset is available for academic and non-commercial use through the official AevaScenes site.
- It is a dataset, not a model architecture.

## Core Technical Idea

- Provide public data from FMCW LiDAR, where each point can carry range and radial velocity information.
- Expose motion information directly at sensor measurement time rather than deriving all velocity from multi-frame tracking.
- Pair 4D LiDAR with cameras so researchers can study detection, segmentation, tracking, motion forecasting, scene flow, and calibration.
- Include ultra-long-range annotations up to 400 m.
- Make FMCW-specific perception research possible without private sensor access.
- Show how velocity-per-point changes the design space for object detection and prediction.

## Inputs and Outputs

- Dataset input: FMCW 4D LiDAR point clouds.
- Dataset input: synchronized high-resolution RGB camera images.
- Dataset input: calibration and sensor metadata.
- Labels: object detection, semantic segmentation, tracking, and lane-line annotations.
- Format: PCD point clouds, JPEG images, and JSON annotations according to the announcement.
- User output: trained or evaluated perception models for FMCW LiDAR and camera fusion.

## Architecture or Dataset/Pipeline

- The release describes 100 curated sequences.
- It contains 10,000 frames at 10 Hz.
- Sensor suite: 6 Aeva FMCW LiDAR sensors.
- Camera suite: 6 high-resolution RGB cameras matched to wide and narrow field-of-view sensing.
- The announcement reports about 200 GB total, roughly 2 GB per sequence.
- Data was captured using Aeva Mercedes Metris test vehicles in and around the San Francisco Bay Area.

## Training and Evaluation

- Aeva positions the dataset for object detection, semantic segmentation, tracking, motion forecasting, scene flow, and trajectory estimation.
- The release includes 50 percent highway and 50 percent urban sequences.
- It includes 50 percent day and 50 percent night sequences.
- All sequences in the announcement are clear weather with dry road surfaces.
- Evaluation protocols should isolate the value of per-point velocity versus position-only LiDAR.
- The dataset is new enough that independent benchmark leaderboards may still be immature.

## Strengths

- Public FMCW LiDAR data is rare, making this a high-value sensor research resource.
- Per-point velocity can reduce the latency of motion detection and track initialization.
- Long-range annotations up to 400 m support high-speed and early-warning research.
- Multi-camera pairing supports fusion and cross-modal calibration studies.
- Day/night balance helps evaluate lighting robustness.
- Tracking and segmentation labels make it more useful than box-only releases.

## Failure Modes

- Clear-weather, dry-road collection does not cover rain, fog, snow, de-icing spray, or jet blast.
- Road scenes do not include aircraft, ramps, cones, dollies, fuel trucks, or ground crew workflows.
- FMCW velocity is radial; lateral motion still needs geometry, tracking, or fusion.
- Dataset license is non-commercial, which can restrict production training use.
- Sensor configuration is Aeva-specific and may not transfer perfectly to other FMCW LiDAR vendors.
- Long-range road annotations do not guarantee close-range aircraft-clearance accuracy.

## Airside AV Fit

- Very relevant as the first practical public dataset for FMCW LiDAR perception design.
- Per-point velocity is valuable for detecting moving GSE, personnel, jet blast particles, and approaching vehicles with lower latency.
- Clear-weather limitation means it cannot validate the most important airside weather claims.
- Airport transfer requires new data around aircraft metal surfaces, wet aprons, night lighting, and de-icing operations.
- The 6-LiDAR setup is conceptually close to multi-LiDAR airside vehicles, though sensor placement will differ.
- Best use is pretraining and architecture prototyping before collecting proprietary airside FMCW data.

## Implementation Notes

- Extend point-cloud schemas to preserve velocity fields, not just XYZ intensity.
- Update ROS PointCloud2 messages with an optional radial_velocity field for FMCW-aware pipelines.
- Benchmark single-frame velocity-based detection against multi-frame ToF LiDAR tracking.
- Evaluate how much per-point velocity improves track birth, stop/start detection, and prediction horizon.
- Keep a compatibility path that drops velocity for existing LiDAR models.
- Combine with radar in airside tests because radar and FMCW LiDAR have complementary weather and reflectivity behavior.

## Sources

- Official dataset site: https://scenes.aeva.com/
- Aeva announcement: https://www.aeva.com/press/aeva-introduces-aevascenes-the-first-open-access-fmcw-4d-lidar-and-camera-dataset-for-autonomous-vehicle-research/
- Aeva GitHub organization: https://github.com/aevainc
- Related FMCW predictive detection paper: https://arxiv.org/abs/2504.05649
