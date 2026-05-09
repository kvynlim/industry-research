# Uncertainty-Aware BEV Fusion

## What It Covers

- BEV fusion systems often output a fused representation without exposing how uncertain the depth, modality alignment, or feature fusion was.
- Uncertainty-aware BEV fusion keeps uncertainty close to the representation used by detection, occupancy, and planning.
- This page focuses on two recent directions: depth uncertainty for camera BEV lifting and feature-level uncertainty for multimodal fusion.
- Representative methods are GaussianLSS and HyperDUM.
- It complements the broader [Uncertainty Quantification and Calibration](uncertainty-quantification-calibration.md) page.

## Why It Matters

- Camera BEV methods depend on depth estimation, and depth ambiguity is highest exactly where planning risk grows: far range, occlusion, glare, and weak texture.
- Multimodal fusion can look more confident after combining sensors even when the sensors disagree.
- Feature-level uncertainty matters because many failures happen before the final detection or occupancy head.
- In airside environments, uncertainty should drive speed limits, buffers, teleoperation requests, and data collection.
- A fused BEV tensor without uncertainty is difficult to audit after a near miss.

## Core Technical Ideas

- GaussianLSS revisits Lift-Splat-Shoot and models depth uncertainty during camera-to-BEV lifting.
- It uses Gaussian splatting-style rasterization so lifted image features carry depth uncertainty into BEV rather than collapsing to a single hard depth.
- The result is an uncertainty-aware BEV representation for camera perception.
- HyperDUM is a deterministic uncertainty method that estimates feature-level epistemic uncertainty for multimodal fusion.
- It uses hyperdimensional computing to avoid the training and inference cost of heavy Bayesian or ensemble approaches.
- The common principle is to quantify uncertainty where fusion happens, not only at the final class score.

## Inputs and Outputs

- Input: multi-view camera images and camera calibration for GaussianLSS-style depth lifting.
- Input: multimodal features, such as camera, LiDAR, and radar features, for HyperDUM-style fusion uncertainty.
- Optional input: sensor-health masks, calibration covariance, modality dropout masks, and weather or visibility signals.
- Output: BEV feature map with depth or fusion uncertainty.
- Output: uncertainty score or map that can be attached to detections, occupancy cells, or planning corridors.
- Monitoring output: per-modality feature uncertainty, depth uncertainty, and fused-feature confidence.

## Benchmark Signals

- GaussianLSS was accepted at CVPR 2025 under the title "Toward Real-world BEV Perception: Depth Uncertainty Estimation via Gaussian Splatting."
- The paper positions GaussianLSS as an uncertainty-aware alternative to standard LSS-style unprojection for BEV perception.
- HyperDUM was accepted at CVPR 2025 and targets feature-level epistemic uncertainty in multimodal autonomous-vehicle perception.
- HyperDUM emphasizes deployability by avoiding expensive Bayesian approximations while estimating uncertainty at fusion level.
- Benchmark interpretation should report accuracy, calibration, uncertainty usefulness under corruption, and runtime overhead.
- A method that improves calibration but hides high-uncertainty regions from planning is not deployment-ready.

## Deployment Risks

- Depth uncertainty can be underestimated if the depth network is overconfident on out-of-distribution scenes.
- Gaussian-style lifting can still smear features along wrong depth if calibration or pose is wrong.
- Hyperdimensional uncertainty scores need calibration against actual perception error, not only internal feature novelty.
- Feature-level uncertainty can be hard to translate into object-level or voxel-level safety actions.
- Planners may ignore uncertainty if it is not represented in the interface contract.
- Overly conservative uncertainty thresholds can cause unnecessary stops and teleoperation load.

## Airside AV Fit

- Strong fit for camera BEV around stands because aircraft, ground markings, wet pavement, and glare create depth ambiguity.
- Feature-level multimodal uncertainty is useful when cameras, LiDAR, radar, and maps disagree near aircraft or terminal structures.
- Uncertainty maps should increase clearance around wings, engines, jet bridges, chocks, cones, tow bars, hoses, and personnel.
- Airside ODDs need slices for night floodlights, wet concrete, rain, fog, de-icing mist, spray, and reflective metal.
- Treat high BEV uncertainty inside the planned path as a runtime health signal, not just a model diagnostic.
- Use uncertainty-triggered data upload to capture repeated site-specific failures.

## Implementation Guidance

- Keep uncertainty channels aligned with the same BEV grid or voxel grid used by planning.
- Calibrate uncertainty by range, sensor configuration, lighting, weather, and object class.
- Add corruption tests for camera blackout, LiDAR sparsity, radar ghosting, and calibration perturbation.
- Convert uncertainty into planner actions: larger buffers, slower speed, re-observe, teleop request, or minimum-risk stop.
- Log uncertainty before and after fusion so incident review can see whether fusion amplified or reduced risk.
- Measure uncertainty usefulness with error-detection AUROC/AuPRC, expected calibration error, and path-corridor false-free rate.

## Sources

- GaussianLSS arXiv paper: https://arxiv.org/abs/2504.01957
- GaussianLSS CVPR paper: https://openaccess.thecvf.com/content/CVPR2025/papers/Lu_Toward_Real-world_BEV_Perception_Depth_Uncertainty_Estimation_via_Gaussian_Splatting_CVPR_2025_paper.pdf
- HyperDUM CVPR paper page: https://openaccess.thecvf.com/content/CVPR2025/html/Chen_Hyperdimensional_Uncertainty_Quantification_for_Multimodal_Uncertainty_Fusion_in_Autonomous_Vehicles_CVPR_2025_paper.html
- HyperDUM arXiv paper: https://arxiv.org/abs/2503.20011
- Existing uncertainty overview: [Uncertainty Quantification and Calibration](uncertainty-quantification-calibration.md)
