# CVFusion

<!-- method-priority:start
priority:
  learning: 3
  deployment: 4
  type: "method"
  stage: "modern-core"
  maturity: "prototype"
  tags: ["perception", "adverse-weather"]
  reason: "Important radar-camera fusion method for degraded visual conditions."
method-priority:end -->

## What It Is

- CVFusion is an ICCV 2025 4D radar-camera 3D object detection method.
- It is a cross-view, two-stage fusion network for View-of-Delft and TJ4DRadSet-style 4D radar-camera data.
- The method fuses radar and camera evidence at proposal level after using radar-guided BEV fusion for high-recall proposals.
- It is a detector, not a dense occupancy estimator or future-occupancy model.
- ZFusion and MLF-4DRCNet are closely related 4D radar-camera detection baselines, but they use different fusion mechanisms.
- For radar-camera occupancy instead of boxes, see [4D Radar-Camera Occupancy](4d-radar-camera-occupancy.md); for query-based radar-camera detection, see [RaCFormer](racformer.md).

## Core Idea

- Do not rely on a single BEV fusion stage to solve all radar-camera alignment problems.
- First use radar-guided iterative BEV fusion to produce high-recall 3D proposals.
- Then refine each proposal by aggregating heterogeneous features from radar points, camera images, and BEV maps.
- Use instance-level cross-view fusion so each candidate object can gather evidence from the views where it is actually visible.
- Preserve radar advantages for range and robustness while using image features for appearance and semantics.
- Contrast with ZFusion, whose FP-DDCA fuser uses feature-pyramid double deformable cross attention for multi-scale radar-camera fusion.
- Contrast with MLF-4DRCNet, which explicitly combines point-, scene-, and proposal-level fusion.

## Inputs and Outputs

- Input: 4D radar point clouds with range, azimuth, elevation, and Doppler-derived measurements.
- Input: one or more camera images with calibration to the radar and ego frame.
- Input metadata: radar-camera extrinsics, intrinsics, timestamps, and dataset-specific coordinate transforms.
- Training input: 3D object boxes and class labels.
- Output: 3D bounding boxes with class confidence, position, dimensions, yaw, and detection scores.
- Optional output: intermediate proposals and fused instance features for ablation or debugging.
- It does not output freespace, voxel occupancy, semantic maps, or track identities.

## Architecture or Pipeline

- Camera backbone extracts image features from calibrated views.
- Radar encoder converts sparse 4D radar points into BEV or point-level features.
- Stage 1 uses the radar guided iterative, or RGIter, BEV fusion module to generate 3D proposals with high recall.
- Stage 2 pools or samples point, image, and BEV features for each proposal.
- Instance-level feature aggregation refines proposal localization and classification.
- Detection heads produce final boxes and scores after proposal refinement.
- The official repository is public but lightweight, so reproducibility should be checked against the paper configs before using it as a benchmark anchor.

## Training and Evaluation

- CVFusion is evaluated on View-of-Delft and TJ4DRadSet.
- The ICCV 2025 paper reports gains over previous state of the art of 9.10% mAP on View-of-Delft and 3.68% mAP on TJ4DRadSet.
- ZFusion is evaluated on View-of-Delft and reports state-of-the-art ROI mAP in the CVPR 2025 workshop paper.
- MLF-4DRCNet reports state-of-the-art results on View-of-Delft and TJ4DRadSet and performance comparable to LiDAR-based models on View-of-Delft.
- Use radar-only, camera-only, BEV-only fusion, and proposal-level fusion baselines when evaluating the fusion contribution.
- Report inference speed together with mAP, because proposal-level cross-view sampling can be expensive.
- Disclose radar point filtering and camera image resolution; both can dominate apparent method differences.

## Strengths

- Proposal-level fusion directly targets the information loss of scene-level BEV fusion.
- Radar-guided proposal generation can improve recall when camera depth is uncertain.
- Instance-level feature aggregation is useful for sparse radar objects whose evidence is scattered across views.
- The design is easier to compare with LiDAR two-stage detectors than pure BEV fusion methods.
- Reported gains on two public 4D radar-camera datasets make it a useful reference point.
- It complements dense occupancy methods by providing object-level boxes and confidence.

## Failure Modes

- Sparse radar returns can make proposal generation unstable for small or low-RCS objects.
- Radar-camera calibration errors corrupt both BEV proposal generation and proposal-level image sampling.
- Proposal-level refinement cannot recover objects missed by the high-recall stage.
- Doppler and point features may be unreliable under multipath, sidelobes, or moving clutter.
- The detector remains box-based, so it under-represents irregular or articulated occupied space.
- Public road datasets do not cover aircraft-scale reflective geometry or apron workflows.

## Airside AV Fit

- Good candidate detector for GSE, buses, tugs, carts, and service vehicles under lighting or weather degradation.
- Useful as a radar-camera object layer feeding a tracker or planner, especially where LiDAR cost or weather performance is a concern.
- Needs airport-specific classes and negative examples around aircraft stands before operational use.
- Should be paired with dense occupancy for wings, engines, jet bridges, cones, hoses, and chocks.
- Proposal-level image sampling may help with wide open apron scenes where pure BEV camera depth is weak.
- Validation must include radar multipath near aircraft fuselages, terminal glass, fences, wet pavement, and parked equipment.

## Implementation Notes

- Reproduce the official View-of-Delft and TJ4DRadSet preprocessing before changing sensor layouts.
- Audit timestamp alignment because radar Doppler and camera appearance can disagree under ego-motion or rolling-shutter effects.
- Keep the proposal recall metric visible; final mAP can hide missed close-range hazards.
- Tune radar point filtering with the target sensor rather than inheriting dataset defaults.
- For airport deployment, add classes and anchors or proposal priors for long, low, and articulated equipment.
- Export a conservative occupancy or exclusion-zone representation downstream because CVFusion boxes are not enough for close clearance.
- Compare against [RaCFormer](racformer.md) and [TacoDepth](tacodepth.md)-style depth-assisted lifting when deciding where radar-camera fusion should happen.

## Sources

- ICCV 2025 CVFusion paper page: https://openaccess.thecvf.com/content/ICCV2025/html/Zhong_CVFusion_Cross-View_Fusion_of_4D_Radar_and_Camera_for_3D_ICCV_2025_paper.html
- Official CVFusion repository: https://github.com/zhzhzhzhzhz/CVFusion
- ZFusion CVPR 2025 workshop paper page: https://openaccess.thecvf.com/content/CVPR2025W/WDFM-AD/html/Yang_ZFusion_An_Effective_Fuser_of_Camera_and_4D_Radar_for_CVPRW_2025_paper.html
- MLF-4DRCNet arXiv paper: https://arxiv.org/abs/2509.18613
- View-of-Delft dataset: https://intelligent-vehicles.org/datasets/view-of-delft/
- TJ4DRadSet dataset: https://github.com/TJRadarLab/TJ4DRadSet
