# RaCFormer

<!-- method-priority:start
priority:
  learning: 3
  deployment: 4
  type: "method"
  stage: "deployment-pattern"
  maturity: "prototype"
  tags: ["perception", "fallback", "validation", "adverse-weather", "road-av"]
  reason: "RaCFormer is rated for alternative-sensor perception and adverse-weather fallback evaluation."
method-priority:end -->

## What It Is

- RaCFormer is a CVPR 2025 radar-camera 3D object detection method.
- It is a query-based fusion transformer for multi-view cameras and millimeter-wave radar.
- The method targets the misalignment caused by inaccurate image-to-BEV depth estimation.
- Instead of only concatenating radar BEV and camera BEV features, it samples object-relevant features from both perspective and BEV views.
- It is a detector, not a dense occupancy or forecasting method.
- The official implementation is PyTorch-based and built on the MMDetection3D ecosystem.

## Core Technical Idea

- Use object queries as the fusion medium between camera and radar features.
- Sample radar-enhanced image-view features, camera-transformed BEV features, and radar-encoded BEV features for each query.
- Avoid relying entirely on a single image-to-BEV transformation when pixel depth is uncertain.
- Initialize object queries with an adaptive circular distribution in polar coordinates.
- Adjust query density by distance so far-range coverage is not wasted or undersampled.
- Improve BEV representation with a radar-guided depth head and an implicit dynamic catcher that uses radar Doppler cues.
- The key claim is that query-based dual-view fusion better handles radar-camera view disparity than BEV-only fusion.

## Inputs and Outputs

- Input: multi-view camera images.
- Input: radar point clouds or radar sweeps encoded into BEV features.
- Input metadata: camera calibration, radar calibration, ego pose, timestamps, and sweep information.
- Training input: 3D boxes and class labels from nuScenes or View-of-Delft-style datasets.
- Output: 3D bounding boxes with class scores, location, dimensions, orientation, and velocity-related predictions.
- Optional output: radar-guided depth or BEV intermediate features for analysis.
- The method does not natively output dense freespace, semantic occupancy, or future occupancy.

## Architecture or Pipeline

- Camera backbone extracts image-view features from surround cameras.
- Camera features are transformed into BEV, aided by a radar-guided depth head.
- Radar encoder produces radar BEV features and exposes Doppler-informed motion cues.
- Query initialization uses polar adaptive circular distribution to place object queries in 3D space.
- Query decoder performs cross-perspective fusion by sampling from image-view and BEV feature sources.
- Implicit dynamic catcher strengthens temporal/dynamic BEV representation using radar Doppler.
- Detection head produces final 3D boxes and confidence scores.

## Training and Evaluation

- Evaluated on nuScenes and View-of-Delft.
- CVPR 2025 paper reports 64.9% mAP and 70.2% NDS on nuScenes.
- The paper reports 54.4% mAP over the full View-of-Delft annotated area and 78.6% mAP in the region of interest.
- Official repo includes nuScenes training and evaluation configs with ResNet-50 and 704x256 image input.
- Training uses standard 3D detection losses plus method-specific depth and fusion supervision implied by the radar-guided depth head.
- Evaluation should separate radar-camera fusion gains from backbone, image resolution, sweep count, and pretraining.
- Deployment comparisons should include radar-only, camera-only, BEV-fusion, and query-fusion baselines.

## Strengths

- Directly addresses radar-camera feature misalignment from imperfect camera depth.
- Query-based sampling lets each candidate object gather features from multiple relevant views.
- Radar Doppler cues improve dynamic-object representation.
- Radar guidance helps BEV camera features when image depth is ambiguous.
- Performs well on both nuScenes and View-of-Delft in reported results.
- More operationally relevant than camera-only detection under weather or lighting degradation.

## Failure Modes

- Radar multipath can create convincing object-query evidence in metallic environments.
- BEV and image features can still disagree when calibration or timestamp alignment is off.
- Query initialization priors may under-cover unusual airport object layouts or very large aircraft-adjacent objects.
- Radar sparsity limits small-object localization, especially for cones, chocks, tow bars, and pedestrians near clutter.
- The detector remains box-based and cannot represent irregular occupied volumes.
- Official code uses custom CUDA/C++ components, so deployment portability needs validation.

## Airside AV Fit

- Strong fit as a radar-camera detector for dynamic GSE, buses, tugs, carts, and personnel in poor visibility.
- Doppler-aware radar-camera fusion is valuable around rain, fog, spray, and night apron lighting.
- Needs retraining with airport classes and radar signatures before it can cover aircraft stands.
- Should be paired with dense occupancy or LiDAR geometry for wing, engine, jet bridge, and close-clearance safety.
- Query-based fusion may be especially useful where camera BEV depth is unreliable on large open pavement.
- Validation must include multipath near aircraft fuselages, terminal glass, fences, service equipment, and parked vehicles.

## Implementation Notes

- Start from the official nuScenes config only as a road-domain baseline.
- Rebuild radar sweep preprocessing for the selected radar hardware and timestamp model.
- Verify radar Doppler compensation before using dynamic cues in tracking or planning.
- Tune polar query initialization for airport layouts, long straight service roads, and wide stand areas.
- Keep camera-to-radar calibration monitoring online; fusion quality can degrade before either sensor fully fails.
- Export and benchmark custom CUDA extensions early if targeting embedded deployment.
- Add a downstream conservative occupancy layer because RaCFormer boxes are not sufficient for aircraft clearance.

## Sources

- CVPR 2025 paper PDF: https://openaccess.thecvf.com/content/CVPR2025/papers/Chu_RaCFormer_Towards_High-Quality_3D_Object_Detection_via_Query-based_Radar-Camera_Fusion_CVPR_2025_paper.pdf
- arXiv paper: https://arxiv.org/abs/2412.12725
- Official RaCFormer repository: https://github.com/cxmomo/RaCFormer
- nuScenes detection benchmark: https://www.nuscenes.org/object-detection
- View-of-Delft dataset: https://intelligent-vehicles.org/datasets/view-of-delft/
