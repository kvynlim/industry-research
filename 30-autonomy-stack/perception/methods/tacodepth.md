# TacoDepth

## What It Is

- TacoDepth is a CVPR 2025 radar-camera dense depth estimation method.
- It predicts dense metric depth from a camera image and sparse mmWave radar points.
- The method is designed to avoid slow multi-stage radar-camera depth pipelines.
- It uses one-stage fusion rather than first generating intermediate quasi-dense depth.
- TacoDepth supports both independent inference and plug-in inference with an optional initial relative depth map.
- It is a depth-estimation component, not a full detector or occupancy forecaster.

## Core Technical Idea

- Treat radar points as sparse but structured range evidence instead of isolated projected pixels.
- Extract graph structure from the radar point cloud so local radar topology can help reject noise and outliers.
- Fuse radar and image features through a pyramid, using shallow layers for details and deeper layers for semantics.
- Use radar-centered flash attention to compute cross-modal correlations near radar-centered image areas.
- Predict dense metric depth directly in one stage.
- Provide a faster independent mode and a higher-accuracy plug-in mode that can use an external relative depth predictor.
- The key claim is that better radar structure extraction can remove the need for intermediate quasi-dense depth.

## Inputs and Outputs

- Input: RGB camera image.
- Input: radar point cloud, typically sparse 3D points projected or associated with the camera frame.
- Input metadata: radar-camera calibration and any preprocessing needed to align radar points to the image.
- Optional input: initial relative depth map from another depth model for plug-in mode.
- Output: dense metric depth map aligned to the input image.
- Secondary output: intermediate fused image/radar features useful for inspection but not the primary product.
- It does not directly output 3D boxes, tracks, semantics, or freespace probabilities.

## Architecture or Pipeline

- Image encoder extracts a multi-scale feature pyramid from the RGB image.
- Graph-based radar structure extractor builds node and edge features from radar point relationships.
- Pyramid-based radar fusion integrates image and radar features at multiple feature levels.
- Radar-centered flash attention restricts cross-modal attention to local radar-centered regions for efficiency.
- Decoder produces dense depth from fused features.
- Independent mode runs directly from image and radar.
- Plug-in mode adds an auxiliary branch for an initial relative depth map and uses TacoDepth to recover metric scale and dense structure.

## Training and Evaluation

- Evaluated on nuScenes and ZJU-4DRadarCam depth-estimation settings.
- The paper follows prior radar-camera depth work with metrics such as MAE and RMSE over depth ranges.
- CVPR 2025 abstract reports 12.8% depth-accuracy improvement and 91.8% processing-speed improvement over the previous state of the art.
- The paper reports real-time independent-model behavior over 37 fps.
- Training uses radar-camera samples with dense or projected depth supervision from range sensors.
- Ablations evaluate the graph-based radar structure extractor, pyramid fusion, radar-centered attention, and inference modes.
- Evaluation should disclose whether the model is independent or plug-in, because speed and accuracy differ.

## Strengths

- Directly targets the runtime bottleneck in radar-camera depth estimation.
- Radar gives metric scale and better adverse-weather cues than monocular depth alone.
- One-stage fusion reduces failure propagation from bad intermediate quasi-dense depth.
- Graph radar features can be more robust to noisy radar returns than coordinate-only MLP features.
- Plug-in mode makes the method compatible with modern relative depth predictors.
- Dense depth output can support downstream BEV lifting, obstacle reasoning, and range sanity checks.

## Failure Modes

- Sparse radar returns may not cover thin, low-RCS, or laterally moving objects.
- Radar multipath can inject incorrect depth near aircraft, metal structures, jet bridges, fences, and terminal glass.
- Radar-camera calibration errors create dense depth artifacts because sparse radar anchors are trusted.
- A dense depth map can look plausible while missing clearance-critical small objects.
- Plug-in mode inherits biases and latency from the external relative depth model.
- The paper is road-dataset focused; airport surfaces and large reflective aircraft are out-of-distribution.

## Airside AV Fit

- Good fit as an efficient metric-depth prior for camera-heavy airside perception.
- Especially useful under rain, fog, spray, low sun, and night floodlights where camera depth alone degrades.
- Can improve camera-to-BEV lifting for occupancy or detection heads without using LiDAR at runtime.
- Should not be the only clearance source near aircraft skin, wings, engines, cones, chocks, or tow bars.
- Requires radar-specific validation around large metallic aircraft and service-equipment multipath.
- Best early role is a depth channel fused with LiDAR/radar tracks and conservative geometric exclusion zones.

## Implementation Notes

- Preserve radar-camera extrinsics and timestamp alignment; projected radar errors become dense depth errors.
- Keep radar preprocessing deterministic, including filtering, Doppler compensation, and point confidence thresholds.
- Validate independent and plug-in modes separately under the same latency budget.
- Benchmark with the target radar model, because point density and noise structure are hardware-specific.
- Inspect depth errors by material, range, weather, and lighting rather than only aggregate RMSE.
- Add guardrails so downstream BEV lifting does not overtrust dense depth in radar-empty regions.
- If used for occupancy, combine TacoDepth with explicit freespace/occupancy supervision instead of treating depth as occupancy.

## Sources

- CVPR 2025 paper page: https://openaccess.thecvf.com/content/CVPR2025/html/Wang_TacoDepth_Towards_Efficient_Radar-Camera_Depth_Estimation_with_One-stage_Fusion_CVPR_2025_paper.html
- CVPR 2025 paper PDF: https://openaccess.thecvf.com/content/CVPR2025/papers/Wang_TacoDepth_Towards_Efficient_Radar-Camera_Depth_Estimation_with_One-stage_Fusion_CVPR_2025_paper.pdf
- arXiv paper: https://arxiv.org/abs/2504.11773
- Official TacoDepth repository: https://github.com/RaymondWang987/TacoDepth
- ZJU-4DRadarCam / RadarCam-Depth paper: https://arxiv.org/abs/2401.04325
- nuScenes dataset: https://www.nuscenes.org/nuscenes
