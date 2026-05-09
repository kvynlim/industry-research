# SplatFlow

## What It Is

- SplatFlow is a CVPR 2025 method for self-supervised dynamic Gaussian Splatting in autonomous-driving scenes.
- It reconstructs dynamic 4D scenes without requiring tracked 3D bounding boxes for dynamic-object supervision.
- It introduces Neural Motion Flow Field (NMFF), a set of implicit functions that model temporal motion for both LiDAR points and Gaussians.
- The method decomposes static background and dynamic objects, representing background with 3D Gaussians and dynamic content with 4D Gaussians.
- It is a reconstruction, rendering, and simulation-support method, not a production tracker or occupancy estimator.

## Core Technical Idea

- Replace object-box-driven dynamic Gaussian decomposition with self-supervised motion-flow learning.
- Pretrain or learn 3D motion priors from LiDAR data so dynamic and static points can be separated in 3D.
- Use NMFF to estimate continuous motion flow fields over space and time.
- Convert dynamic LiDAR points and dynamic Gaussians across timestamps through the learned motion field.
- Aggregate temporal features for each 4D Gaussian so dynamic actors remain consistent across views and times.
- Distill features from 2D foundation models into 4D space-time representation to improve dynamic object identification.
- Use separate 3D static Gaussians and 4D dynamic Gaussians for rendering RGB, depth, and flow.

## Inputs and Outputs

- Inputs: synchronized calibrated cameras, LiDAR point clouds, camera poses or ego poses, and temporal driving sequences.
- Training signals: image reconstruction, LiDAR-based motion priors, self-supervised temporal correspondence, and distilled 2D foundation-model features.
- Explicitly avoided input: manually labeled tracked 3D dynamic-object boxes as the core dynamic supervision.
- Outputs: reconstructed dynamic Gaussian scene, novel-view RGB renderings, rendered depth, and rendered flow.
- Intermediate output: static/dynamic decomposition of scene elements and NMFF-based temporal correspondences.
- Non-output: SplatFlow does not provide safety-certified object velocities, semantic occupancy grids, or production map updates by itself.

## Architecture or Pipeline

- Ingest multi-sensor driving sequences with RGB and LiDAR.
- Learn or initialize NMFF motion priors from 3D LiDAR observations.
- Identify dynamic components through motion-field behavior and foundation-feature distillation.
- Represent static background with ordinary 3D Gaussians.
- Represent moving objects with time-dependent 4D Gaussians whose status and correspondence are modeled by NMFF.
- Aggregate features across timestamps for each dynamic Gaussian to improve cross-view consistency.
- Render RGB, depth, and flow from the composed static plus dynamic scene.
- Optimize reconstruction, temporal motion consistency, and feature-distillation losses.

## Training and Evaluation

- Evaluation is reported on Waymo Open Dataset and KITTI.
- The paper evaluates image reconstruction and novel-view synthesis with PSNR, SSIM, and LPIPS.
- Baselines include NeRF, NSG, SUDS, MARS, 3DGS, PVG, StreetGS or StreetGaussian, and EmerNeRF-style dynamic neural fields.
- The paper reports state-of-the-art performance across standard rendering metrics on the evaluated dynamic urban scenes.
- KITTI split experiments test robustness under reduced training data settings.
- Ablations show the value of NMFF priors, NMFF optimization, and optical-flow or foundation-model feature distillation.
- Dynamic-region metrics are separated from whole-scene metrics to show whether moving objects are actually improved rather than hidden by static background quality.

## Strengths

- Reduces dependence on expensive dynamic object boxes and tracks.
- Static/dynamic decomposition is learned from motion and features, which helps with unlabeled fleet-scale data.
- LiDAR motion priors give the method a stronger geometric basis than RGB-only dynamic splatting.
- Dynamic 4D Gaussians preserve object detail better than methods that smear or ghost moving objects.
- Rendered depth and flow make the reconstruction more useful for perception QA than RGB-only scene replay.
- Good candidate for offline dynamic-object removal because dynamic regions are explicitly discovered and separated.

## Failure Modes

- Self-supervised motion decomposition can confuse ego-motion, object motion, shadows, reflections, and calibration errors.
- LiDAR sparsity or poor synchronization can create wrong motion priors.
- Foundation-model features may not identify airside-specific equipment or may group operationally different objects together.
- Dynamic objects with slow or intermittent motion can be absorbed into the static layer.
- Rendered flow is a reconstruction signal, not automatically a calibrated velocity estimate for planning.
- 4D Gaussian memory and optimization cost can grow quickly on long airport sequences with many independently moving assets.

## Airside AV Fit

- Very relevant for airport domains because labeled 3D boxes and tracks for every GSE class are expensive and incomplete.
- Useful for cleaning static stand maps by discovering moving GSE, workers, carts, aircraft under pushback, and temporary obstructions.
- LiDAR-informed motion fields can transfer better to low-texture aprons than pure photometric dynamic methods.
- Dynamic decomposition can support simulation variants: remove all transient assets, replay observed movement, or insert edited motion.
- Airside transfer needs validation on slow-moving, stop-start, articulated, and reflective objects that differ from road vehicles.
- Treat it as offline reconstruction and simulation infrastructure; production AV stacks still need explicit tracking, occupancy, and safety monitors.

## Implementation Notes

- Preserve raw LiDAR timestamps, camera exposure times, and ego-pose interpolation because motion-field supervision is synchronization-sensitive.
- Audit static-only and dynamic-only renders separately.
- For map hygiene, measure false-static insertions and false-dynamic deletions against repeated-day logs.
- Add manual review slices for parked aircraft, parked GSE that later moves, shadows under aircraft, wet pavement, and floodlit night operations.
- If foundation features are used for airside labels, evaluate class coverage before trusting dynamic identification.
- Store NMFF and Gaussian outputs with source log provenance so edited simulation assets do not contaminate real map-building data.

## Sources

- CVPR 2025 paper page: https://openaccess.thecvf.com/content/CVPR2025/html/Sun_SplatFlow_Self-Supervised_Dynamic_Gaussian_Splatting_in_Neural_Motion_Flow_Field_CVPR_2025_paper.html
- CVPR 2025 paper PDF: https://openaccess.thecvf.com/content/CVPR2025/papers/Sun_SplatFlow_Self-Supervised_Dynamic_Gaussian_Splatting_in_Neural_Motion_Flow_Field_CVPR_2025_paper.pdf
- 3D Gaussian Splatting foundation paper: https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/
