# NeRF-SLAM

## Executive Summary

NeRF-SLAM is a real-time dense monocular SLAM and mapping pipeline that combines dense visual SLAM with neural radiance field reconstruction. The Rosinol, Leonard, and Carlone system uses dense monocular SLAM to provide poses, depth maps, and depth uncertainty, then trains a real-time hierarchical volumetric NeRF-style map for geometric and photometric reconstruction.

This file is included in the indoor/dense/neural SLAM set because NeRF-SLAM is central to the neural field mapping lineage, even though the original method is monocular rather than RGB-D. Its value is strongest as a bridge between SLAM and neural rendering: it shows how a pose/depth front end can feed a live radiance field. It is not a mature localization stack for vehicles.

For AV and airside work, NeRF-SLAM is most relevant to digital twins, view synthesis, reconstruction QA, and simulation. It has major transfer limits: monocular scale and depth uncertainty, GPU-heavy neural optimization, dynamic scenes, illumination changes, lack of operational uncertainty, and no production multi-sensor fusion. For faster explicit renderable map representations that have become important after NeRF, see [3D Gaussian Splatting for Real-Time AV Perception and Mapping](../../perception/gaussian-splatting-driving.md).

## Historical Context

NeRF, introduced by Mildenhall et al. in 2020, represented scenes as neural radiance fields optimized from posed images. It produced impressive novel-view synthesis but was originally offline and required known camera poses. Instant-NGP later made neural graphics primitives much faster with multi-resolution hash encodings. DROID-SLAM showed strong dense visual SLAM from monocular, stereo, and RGB-D cameras using learned recurrent optimization.

NeRF-SLAM combined these ingredients. The system's insight was that dense monocular SLAM can provide the pose, depth, and uncertainty signals needed to train a NeRF online. The NeRF map then provides dense photometric and geometric scene reconstruction.

This is a different branch from RGB-D neural SLAM systems such as [iMAP](imap.md), [NICE-SLAM](nice-slam.md), and [Co-SLAM and ESLAM](co-slam-eslam.md). Those methods use measured depth directly. NeRF-SLAM instead relies on monocular dense SLAM depth estimates, which makes sensor requirements lighter but metric reliability harder.

## Sensor Assumptions

The original NeRF-SLAM system is monocular RGB. It assumes:

- Calibrated camera intrinsics.
- Enough visual texture and parallax for dense monocular SLAM.
- Mostly static scenes.
- Lighting consistency sufficient for photometric reconstruction.
- GPU resources for dense SLAM and NeRF training/rendering.
- A learned or optimized front end that can produce usable depth maps and depth uncertainty.

Because the input is monocular, metric scale is a core concern. A learned monocular system may produce depth in a useful scale convention on familiar data, and scale can be aligned for evaluation, but a safety-critical vehicle cannot assume monocular scale is certified without independent metric sensors.

NeRF-SLAM is not an RGB-D method in its original form. It is still relevant to RGB-D/neural SLAM research because it shows how radiance-field maps can be trained from a SLAM front end and because later systems often mix RGB-D, monocular, neural fields, and Gaussian maps.

## State/Map Representation

The system has two coupled representations:

```text
SLAM front end:
  camera poses
  dense depth maps
  depth uncertainty
  frame/keyframe buffers

NeRF map:
  neural radiance field parameters
  density field
  color/radiance field
  acceleration or hash-grid structure
```

The NeRF map represents a continuous volumetric scene function:

```text
F_theta(x, d) -> {
  density sigma,
  color c
}
```

`x` is a 3D point and `d` is viewing direction. Rendering integrates density and color along a camera ray to synthesize RGB and depth-like outputs. NeRF-SLAM uses depth supervision and uncertainty from the dense SLAM front end to make geometry converge faster and more accurately than pure photometric NeRF training.

The released repository includes components related to DROID-SLAM, Instant-NGP, GTSAM experimentation, and Sigma-Fusion. This reflects the hybrid nature of the method: it is not a standalone classical SLAM system, but a pipeline coupling learned SLAM and neural scene representation.

## Algorithm Pipeline

1. Receive monocular RGB frames.
2. Run dense visual SLAM to estimate camera poses.
3. Produce dense depth maps and per-depth uncertainty from the SLAM front end.
4. Select frames/keyframes for neural field training.
5. Train or update a hierarchical volumetric NeRF-style map online.
6. Use photometric loss from RGB images and uncertainty-weighted depth loss from SLAM depth.
7. Render novel views, depth, or geometry from the radiance field.
8. Optionally use volumetric fusion variants such as Sigma-Fusion for probabilistic dense mapping.
9. Continue updating as new frames arrive.

The front end supplies geometric scaffolding; the radiance field supplies dense appearance and geometry reconstruction. This separation is useful, but it also means NeRF quality depends on the front-end pose and depth quality.

## Formulation

Standard NeRF volume rendering predicts pixel color by integrating samples along a ray:

```text
C_rendered(r) = sum_k T_k * alpha_k * c_k
alpha_k = 1 - exp(-sigma_k * delta_k)
```

NeRF-SLAM adds geometric supervision from dense SLAM depth:

```text
L = L_rgb(C_rendered, C_observed)
  + lambda_d * L_depth(D_rendered, D_slam, uncertainty)
```

A simplified uncertainty-weighted depth term is:

```text
L_depth = sum_r w_r * |D_rendered(r) - D_slam(r)|
w_r = function(depth_uncertainty_r)
```

The paper's key claim is that uncertainty-aware depth supervision helps achieve both photometric and geometric accuracy while using only monocular images. The practical caveat is that the depth target is itself estimated, not directly measured by an RGB-D sensor or lidar.

## Failure Modes

- Monocular scale may be wrong or unstable without independent metric information.
- Dense SLAM front-end errors propagate into the NeRF map.
- Dynamic objects create inconsistent radiance and density unless segmented.
- Lighting changes, exposure shifts, shadows, wet surfaces, glare, and specular aircraft skin break photometric assumptions.
- Low texture, motion blur, pure rotation, or weak parallax can degrade dense monocular SLAM.
- GPU memory and runtime are significant; the repository explicitly notes memory-intensive components.
- NeRF rendering is slower and less explicit than later 3D Gaussian maps for many real-time rendering uses.
- Learned priors may not generalize to airside scenes.
- The radiance field may look visually plausible while geometry is metrically wrong.
- No production loop closure, map management, certified uncertainty, or multi-sensor fusion is provided.

## AV Relevance

NeRF-SLAM is relevant to AVs mainly through mapping, simulation, and perception validation. A radiance-field map can support view synthesis, camera simulation, visual inspection, and change analysis. It can help generate photorealistic indoor or constrained-scene digital twins from vehicle or handheld imagery.

It is weak as a primary AV localization method. Vehicle localization needs metric scale, long-range sensing, multi-sensor redundancy, global anchoring, dynamic-object handling, and real-time failure monitors. Monocular neural rendering pipelines do not provide that by themselves.

Transferable ideas:

- Use a robust SLAM front end to supervise a neural field.
- Weight depth supervision by uncertainty.
- Separate tracking from map rendering/reconstruction.
- Evaluate maps by photometric and geometric metrics.
- Use neural scene maps for simulation and QA rather than immediate safety pose.

The shift from NeRF to 3D Gaussian Splatting is also important for AV work. Gaussian maps render faster and are explicit primitives, which can make them more attractive for online perception and map maintenance. See [3D Gaussian Splatting for Real-Time AV Perception and Mapping](../../perception/gaussian-splatting-driving.md).

## Indoor/Outdoor Relevance

Indoor relevance is moderate to high for research. Indoor scenes provide bounded scale, repeated viewpoints, manageable lighting, and enough close-range texture for dense visual SLAM. NeRF-SLAM can be useful for reconstructing rooms and creating view-synthesis assets from monocular video.

Outdoor relevance is mixed. Urban scenes can provide texture and parallax, but lighting, weather, dynamic objects, large scale, and moving vehicles are much harder. Open airside aprons are especially difficult: large low-texture pavement, reflective aircraft, repeated stands, moving equipment, and harsh lighting all undermine monocular photometric assumptions.

For indoor/outdoor airport operation, use NeRF-SLAM as a digital-twin or reconstruction research tool, not as the localization bridge between terminal and apron.

## Airside Deployment Notes

Potential uses:

- Photorealistic reconstruction of indoor service spaces for operator training.
- View-synthesis QA for camera placement in hangars or terminal service corridors.
- Simulation asset generation from controlled captures.
- Research comparison against RGB-D neural SLAM and Gaussian SLAM.

Risks:

- Monocular scale is not sufficient for clearance near aircraft.
- Radiance-field appearance can hide wrong geometry.
- Wet concrete, aircraft skin, glass, and floodlights create photometric outliers.
- Moving aircraft, tugs, loaders, people, and carts violate static-scene assumptions.
- Runtime and GPU memory are difficult on embedded safety platforms.

If used airside, collect raw imagery with a separate metric pose source such as lidar-inertial/RTK, use NeRF-SLAM for offline or advisory reconstruction, and validate geometry against measured depth/lidar before any operational use.

## Datasets/Metrics

The NeRF-SLAM repository references Replica and Cube-Diorama data. More broadly, neural field SLAM evaluation can use:

- Replica for indoor reconstruction and rendering quality.
- ScanNet or TUM RGB-D for comparison against RGB-D neural SLAM, if adapting inputs and protocols.
- Monocular video sequences with ground-truth poses for pose and scale evaluation.
- Custom airside indoor video with independent metric ground truth.

Metrics:

- ATE/APE and RPE after appropriate scale handling.
- Scale drift and metric depth error.
- Depth L1 error against ground-truth or measured depth.
- RGB render PSNR, SSIM, and LPIPS.
- Geometry accuracy, completeness, Chamfer distance, and F-score when a mesh can be extracted.
- Runtime, GPU memory, and map update frequency.
- Robustness to lighting changes and dynamic objects.
- Failure rate under low texture and weak parallax.

For airside use, add clearance-critical geometry error, false surface completion, and render/geometry disagreement under reflective surfaces.

## Open-Source Implementations

- `ToniRV/NeRF-SLAM`: official research repository, BSD-2-Clause license, with DROID-SLAM and Instant-NGP dependencies/submodules and examples.
- The repository also implements Sigma-Fusion as an alternative probabilistic volumetric fusion path.
- Dependencies include PyTorch, CUDA components, Instant-NGP build steps, and a GTSAM fork for experimentation.

This is research software. It is useful for reproducing the method and studying the architecture, but it is not a maintained robotics deployment stack.

## Practical Recommendation

Use NeRF-SLAM as a neural rendering and dense reconstruction research reference. It is especially useful when comparing monocular neural field mapping against RGB-D neural SLAM and Gaussian SLAM. Do not use it as a primary indoor robot or airside vehicle localizer.

For RGB-D indoor neural SLAM, start with [NICE-SLAM](nice-slam.md) and [Co-SLAM and ESLAM](co-slam-eslam.md). For practical robotics, benchmark against [RTAB-Map](rtab-map.md). For fast explicit renderable maps and AV perception integration, prioritize Gaussian methods in [3D Gaussian Splatting for Real-Time AV Perception and Mapping](../../perception/gaussian-splatting-driving.md).

## Sources

- Rosinol, Leonard, and Carlone, "NeRF-SLAM: Real-Time Dense Monocular SLAM with Neural Radiance Fields," arXiv 2022. https://arxiv.org/abs/2210.13641
- NeRF-SLAM repository. https://github.com/ToniRV/NeRF-SLAM
- Mildenhall et al., "NeRF: Representing Scenes as Neural Radiance Fields for View Synthesis," 2020. https://arxiv.org/abs/2003.08934
- Mueller et al., "Instant Neural Graphics Primitives with a Multiresolution Hash Encoding," 2022. https://nvlabs.github.io/instant-ngp/
- Teed and Deng, "DROID-SLAM: Deep Visual SLAM for Monocular, Stereo, and RGB-D Cameras," NeurIPS 2021. https://arxiv.org/abs/2108.10869
- Local context: [iMAP](imap.md)
- Local context: [NICE-SLAM](nice-slam.md)
- Local context: [Co-SLAM and ESLAM](co-slam-eslam.md)
- Local context: [3D Gaussian Splatting for Real-Time AV Perception and Mapping](../../perception/gaussian-splatting-driving.md)
