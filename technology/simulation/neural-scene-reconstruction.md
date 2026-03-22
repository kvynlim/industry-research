# Neural Scene Reconstruction for Autonomous Driving Simulation
## Comprehensive Technical Report: NeRF, 3D Gaussian Splatting, and Neural Sensor Simulation

---

## Table of Contents

1. [NeRF for Driving Scenes](#1-nerf-for-driving-scenes)
2. [3D Gaussian Splatting for Driving](#2-3d-gaussian-splatting-for-driving)
3. [Neural Sensor Simulation](#3-neural-sensor-simulation)
4. [Scene Reconstruction Pipelines](#4-scene-reconstruction-pipelines)
5. [Applications to Simulation](#5-applications-to-simulation)
6. [Comparative Analysis: NeRF vs 3DGS](#6-comparative-analysis-nerf-vs-3dgs)

---

## 1. NeRF for Driving Scenes

### 1.1 Block-NeRF (Waymo / UC Berkeley, 2022)

**Paper:** [Block-NeRF: Scalable Large Scene Neural View Synthesis](https://ar5iv.labs.arxiv.org/html/2202.05263)

Block-NeRF is the foundational work for city-scale neural rendering in autonomous driving. It addresses the fundamental limitation that a single NeRF cannot represent scenes spanning multiple city blocks.

**Core Architecture:**
- Decomposes large-scale environments into individually trained NeRF "blocks," each covering a bounded spatial region
- Each block NeRF is augmented with appearance embeddings (to handle lighting changes), learned pose refinement, and controllable exposure parameters
- An appearance alignment procedure ensures seamless compositing between adjacent blocks during rendering

**Scale:**
- Trained on 2.8 million images collected over 3 months in San Francisco's Alamo Square neighborhood
- At the time of publication, the largest neural scene representation ever built
- Rendering time is decoupled from total scene size -- only blocks visible from the current viewpoint are rendered

**Key Contributions:**
- Demonstrated that NeRF could scale from single objects/rooms to entire neighborhoods
- Enabled per-block updates: when new data is collected for one area, only that block needs retraining
- Proved the viability of neural rendering for AV simulation at scale

**Limitations:**
- No explicit handling of dynamic objects (relies on transient embedding to suppress them)
- Slow rendering speed (not real-time)
- Requires substantial training time per block

---

### 1.2 Urban Radiance Fields (Google, CVPR 2022)

**Paper:** [Urban Radiance Fields](https://urban-radiance-fields.github.io/)

Urban Radiance Fields (URF) was developed specifically for the challenging conditions of Street View-style captures in urban outdoor environments.

**Key Technical Innovations:**
- **LiDAR integration:** Uses asynchronously captured LiDAR data as geometric supervision to combat scene sparsity, providing depth priors that significantly improve reconstruction quality
- **Exposure compensation:** Addresses variable exposure across captured images through affine color estimation per camera, automatically compensating for photometric inconsistencies
- **Sky supervision:** Leverages predicted image segmentations to supervise densities on sky-pointing rays, preventing the NeRF from placing spurious geometry in the sky region

**Results:**
- +19% PSNR improvement in novel view synthesis over baseline NeRF
- +0.35 F-score improvement in 3D surface reconstruction
- Demonstrated that LiDAR supervision is critical for unbounded outdoor scenes where photometric supervision alone is insufficient

---

### 1.3 SUDS: Scalable Urban Dynamic Scenes (CMU, CVPR 2023)

**Paper:** [SUDS: Scalable Urban Dynamic Scenes](https://haithemturki.com/suds/)

SUDS represents the first successful attempt at building truly large-scale *dynamic* neural radiance fields, scaling to entire cities.

**Three-Branch Hash Table Architecture:**
1. **Static branch:** Encodes the persistent background environment using multi-resolution hash tables (based on Instant-NGP)
2. **Dynamic branch:** Models moving objects (vehicles, pedestrians) with time-conditioned hash encodings
3. **Far-field branch:** Handles distant scene elements (sky, distant buildings) that remain approximately constant

**Self-Supervised Decomposition (no 3D annotations required):**
- RGB images provide photometric supervision
- Sparse LiDAR points provide geometric constraints
- Off-the-shelf self-supervised 2D descriptors (e.g., DINO features) provide feature-metric supervision
- 2D optical flow estimates provide motion cues for separating static and dynamic elements
- Combined through photometric, geometric, and feature-metric reconstruction losses

**Scale Achieved:**
- 1.2 million frames across 1,700 videos
- Tens of thousands of dynamic objects
- Geospatial footprints spanning hundreds of kilometers
- 10x faster training than prior methods despite not requiring ground truth 3D annotations

**Downstream Tasks Enabled:**
- Free-viewpoint synthesis of dynamic scenes
- 3D scene flow estimation
- Unsupervised 3D instance segmentation
- Unsupervised 3D cuboid detection

---

### 1.4 EmerNeRF (NVIDIA, ICLR 2024)

**Paper:** [EmerNeRF: Emergent Spatial-Temporal Scene Decomposition via Self-Supervision](https://emernerf.github.io/)

EmerNeRF is a self-supervised approach that learns spatial-temporal representations of dynamic driving scenes through three coupled neural fields.

**Architecture -- Three Coupled Fields:**
1. **Static field:** Captures time-invariant scene geometry and appearance
2. **Dynamic field:** Represents moving objects; parameterized to output both density/color and a flow vector
3. **Flow field:** Induced from the dynamic field; used to aggregate multi-frame features temporally, amplifying rendering precision for dynamic objects

**Self-Supervised Decomposition:**
- Scene stratification into static and dynamic fields *emerges purely from self-supervision*
- No ground truth object annotations, pre-trained segmentation models, or optical flow supervision required
- The flow estimation capability emerges as a byproduct of optimizing reconstruction losses

**Temporal Feature Aggregation:**
- The flow field warps features from neighboring timestamps to the current frame
- This multi-frame aggregation significantly improves dynamic object rendering by providing temporal context
- Works with 2D vision foundation model features (e.g., DINO, DINOv2) lifted to 4D space-time

**Key Results:**
- Static scene reconstruction: **+2.93 PSNR** over prior state-of-the-art
- Dynamic scene reconstruction: **+3.70 PSNR** improvement
- 3D perception (occupancy prediction): **37.50% relative improvement** when incorporating foundation model features

**NOTR Benchmark:**
- Introduced the NeRF On-The-Road (NOTR) benchmark
- 120 driving sequences from Waymo Open Dataset
- Balanced sampling across diverse visual conditions (lighting, weather, exposure) and dynamic complexity levels
- Designed to stress-test neural fields under extreme, real-world driving conditions

---

### 1.5 StreetSurf (PJLab, 2023)

**Paper:** [StreetSurf: Extending Multi-view Implicit Surface Reconstruction to Street Views](https://ventusff.github.io/streetsurf_web/)

StreetSurf focuses specifically on *surface reconstruction* (rather than purely radiance fields), producing explicit meshes from street-view captures.

**Technical Approach:**
- Divides each scene into three distance-based regions: close-range, distant-view, and sky
- Uses a multi-stage ray marching strategy optimized for the elongated, non-object-centric camera trajectories typical of driving
- Can operate with or without LiDAR data (supports monocular depth cues as alternative supervision)

**Performance:**
- State-of-the-art reconstruction quality in both geometry and appearance
- Training time: 1-2 hours per sequence on a single RTX 3090
- Reconstructed surfaces enable downstream ray tracing and LiDAR simulation

**Follow-up:** StreetSurfGS (2024) extends the approach using Gaussian Splatting with planar-based primitives for scalable surface reconstruction.

---

### 1.6 UniSim (Waabi / University of Toronto, CVPR 2023)

**Paper:** [UniSim: A Neural Closed-Loop Sensor Simulator](https://waabi.ai/unisim/)

UniSim is the seminal work on using neural scene reconstruction for *closed-loop* sensor simulation in autonomous driving.

**Architecture:**
- Builds separate neural feature grids for static background and each dynamic actor
- Composites these representations to simulate both LiDAR and camera data at arbitrary viewpoints
- For extrapolated views (beyond training distribution), incorporates:
  - Learnable priors for dynamic objects (capturing canonical appearance)
  - A convolutional network to inpaint/complete unseen regions

**Closed-Loop Simulation Pipeline:**
1. Takes a pre-recorded real-world driving log
2. Reconstructs the scene into modifiable neural feature grids
3. Enables modifications: adding/removing actors, changing trajectories, altering viewpoints
4. Simulates realistic sensor data (camera + LiDAR) at each timestep
5. Feeds sensor data to the autonomy stack, which produces control commands
6. Updates the ego vehicle state, creating a true closed-loop interaction

**Counterfactual Scenario Generation:**
- Actors can be repositioned, re-timed, added, or removed
- Ego vehicle trajectory responds to autonomy stack decisions
- Creates safety-critical scenarios that are rare or impossible to collect in the real world

**Impact:** UniSim demonstrated that the domain gap between neural-rendered and real sensor data is small enough for meaningful closed-loop evaluation of autonomy systems.

---

### 1.7 NeuRAD (Zenseact, CVPR 2024)

**Paper:** [NeuRAD: Neural Rendering for Autonomous Driving](https://research.zenseact.com/publications/neurad/)

NeuRAD is a comprehensive neural rendering method that prioritizes practical sensor modeling for autonomous driving.

**Key Technical Features:**
- **360-degree camera support:** First method to jointly handle full surround-view camera rigs
- **Multi-sensor unified approach:** Joint optimization of camera and LiDAR data in a single model
- **Rolling shutter modeling:** Assigns individual timestamps to each pixel/LiDAR point with pose interpolation
- **LiDAR-specific modeling:** Models beam divergence, secondary returns, and ray dropping
- **Static/dynamic decomposition:** Separates scene into background and tracked foreground actors

**Sensor Modeling Details:**
- Each pixel and LiDAR point gets its own timestamp
- Ray origins and directions are computed by interpolating sensor poses at the exact capture time
- Dynamic actor poses are similarly interpolated, ensuring temporal consistency
- This per-ray timestamp approach is critical for high-speed driving scenarios

**Benchmark Results:**
- State-of-the-art on 5 autonomous driving datasets (Waymo, nuScenes, PandaSet, Argoverse2, KITTI)
- Particularly strong on dynamic scene rendering due to careful sensor modeling

---

### 1.8 READ (AAAI 2023)

**Paper:** [READ: Large-Scale Neural Scene Rendering for Autonomous Driving](https://arxiv.org/abs/2205.05509)

READ takes a different approach from pure NeRF, learning neural descriptors from sparse point clouds for efficient large-scale rendering.

**Technical Approach:**
- Proposes an omega-net rendering network that learns neural descriptors from sparse 3D point clouds
- Can synthesize photo-realistic driving scenes in real-time on consumer hardware
- Supports scene stitching and editing operations

**Key Advantage:** Addresses the computational bottleneck of NeRF by operating on point cloud representations rather than volumetric ray marching, enabling real-time rendering of large-scale environments.

---

### 1.9 MARS: Instance-Aware Modular Simulator (2023)

**Paper:** [MARS: An Instance-aware, Modular and Realistic Simulator for Autonomous Driving](https://github.com/OPEN-AIR-SUN/mars)

MARS provides a modular framework for compositional neural rendering of driving scenes.

**Three Distinctive Properties:**
1. **Instance-aware:** Models foreground instances and background environments with independent networks; static properties (size, appearance) and dynamic properties (trajectory) are controlled separately
2. **Modular:** Supports flexible switching between NeRF backbones (vanilla NeRF, Instant-NGP, Mip-NeRF, etc.), sampling strategies, and input modalities
3. **Realistic:** Compositional neural field produces RGB images, depth maps, and semantic segmentation masks

**Compositional Rendering:**
- Each foreground instance has its own NeRF in a canonical coordinate space
- Rays are transformed into per-instance coordinates using tracked poses
- Instance-level and background NeRFs are composited during volume rendering
- Enables individual object manipulation (trajectory changes, appearance edits, insertion/removal)

**Open Source:** One of the few fully open-source neural driving simulators, with support for KITTI and vKITTI2 datasets.

---

## 2. 3D Gaussian Splatting for Driving

### 2.1 Street Gaussians (ZJU, ECCV 2024)

**Paper:** [Street Gaussians: Modeling Dynamic Urban Scenes with Gaussian Splatting](https://zju3dv.github.io/street_gaussians/)

Street Gaussians is a pioneering work applying 3D Gaussian Splatting to dynamic driving scenes with explicit decomposition.

**Representation:**
- Scene is represented as a set of point clouds equipped with semantic logits and 3D Gaussians
- Each Gaussian is associated with either a foreground vehicle or the background
- Foreground vehicles use optimizable tracked poses combined with a 4D spherical harmonics model for dynamic appearance

**Key Performance:**
- **135 FPS** rendering at 1066x1600 resolution
- Training completes within 30 minutes
- Consistently outperforms state-of-the-art on KITTI and Waymo Open datasets

**Advantages over NeRF-based methods:**
- Explicit representation enables easy composition/decomposition of vehicles and background
- Orders of magnitude faster rendering
- Straightforward scene editing (object insertion, removal, trajectory modification)

---

### 2.2 DrivingGaussian (PKU, CVPR 2024)

**Paper:** [DrivingGaussian: Composite Gaussian Splatting for Surrounding Dynamic Autonomous Driving Scenes](https://github.com/VDIGPKU/DrivingGaussian)

DrivingGaussian specifically targets surround-view (multi-camera) driving scenarios with two key modules.

**Two-Module Architecture:**

1. **Incremental Static 3D Gaussians:**
   - Progressively reconstructs the static background across sequential frames
   - Handles temporal and spatial variations from surrounding multi-camera setups
   - LiDAR points serve as initialization, providing geometric shape priors

2. **Composite Dynamic Gaussian Graphs:**
   - Models each dynamic object independently as a node in a Gaussian graph
   - Reconstructs per-object appearance and geometry
   - Restores accurate positions and occlusion relationships during compositing
   - Handles multi-object interactions and occlusion ordering

**LiDAR Integration:**
- LiDAR point clouds initialize Gaussian positions and provide depth supervision
- Enables reconstruction with greater geometric detail
- Maintains panoramic consistency across multiple cameras

**DrivingGaussian++ (2025):** Extended version with improved handling of unbounded dynamic scenes, where static backgrounds are incrementally reconstructed as the ego vehicle moves.

---

### 2.3 S3Gaussian: Self-Supervised Street Gaussians (2024)

**Paper:** [S3Gaussian: Self-Supervised Street Gaussians for Autonomous Driving](https://arxiv.org/abs/2405.20323)

S3Gaussian removes the dependency on expensive 3D bounding box annotations that other street Gaussian methods require.

**Core Innovation:**
- Decomposes static and dynamic elements using **4D consistency** as the self-supervised signal
- No tracked vehicle bounding boxes needed (unlike Street Gaussians)
- Combines 3D Gaussians for explicit representation with a spatial-temporal field network for 4D dynamics

**Self-Supervised Approach:**
- Temporal consistency across video frames serves as the supervision signal
- Automatically distinguishes moving objects from stationary elements
- Works in "in-the-wild" scenarios without structured annotation input

**Results:**
- Best performance among methods that do not use 3D annotations on Waymo-Open
- Practical advantage: eliminates the costly annotation pipeline required by competing methods

---

### 2.4 PVG: Periodic Vibration Gaussian (Fudan, IJCV 2026)

**Paper:** [Periodic Vibration Gaussian: Dynamic Urban Scene Reconstruction and Real-time Rendering](https://fudan-zvg.github.io/PVG/)

PVG introduces a fundamentally different approach to handling dynamics in Gaussian Splatting: rather than separating static and dynamic elements, it uses a *unified* representation with periodic temporal vibrations.

**Periodic Vibration Mechanism:**
- Each Gaussian has additional learnable temporal parameters: vibrating direction **v**, life peak tau, and decay rate beta
- Position evolves as: mu(t) = mu + (l/2pi) * sin(2pi(t-tau)/l) * **v**
- Static elements naturally have near-zero vibration amplitude
- Dynamic elements learn oscillatory motion patterns
- This sinusoidal formulation elegantly captures both static and dynamic behaviors without explicit separation

**Temporal Smoothing:**
- A flow-based temporal smoothing mechanism enforces consistency across frames
- Particularly effective with sparse training data (typical of driving datasets)

**Position-Aware Adaptive Control:**
- Adapts Gaussian density and size based on spatial position
- Handles the unique challenges of unbounded urban scenes with varying level of detail requirements

**Performance:**
- **50x faster training** than SUDS (the leading NeRF-based competitor)
- **6000x faster rendering** than SUDS
- **900x faster rendering** than the best NeRF alternative
- State-of-the-art novel view synthesis on KITTI and Waymo
- No manual bounding boxes or optical flow estimation required

---

### 2.5 HUGS: Holistic Urban 3D Scene Understanding (CVPR 2024)

**Paper:** [HUGS: Holistic Urban 3D Scene Understanding via Gaussian Splatting](https://xdimlab.github.io/hugs_website/)

HUGS extends Gaussian Splatting beyond pure rendering to provide comprehensive scene understanding.

**Joint Optimization of Multiple Outputs:**
- Geometry (3D structure)
- Appearance (photorealistic rendering)
- Semantics (per-Gaussian semantic labels)
- Motion (scene flow and optical flow)

**Dynamic Object Modeling:**
- Static and dynamic 3D Gaussians are decomposed explicitly
- Dynamic vehicle motion is modeled using a unicycle model (physically-constrained)
- Works even with highly noisy 3D bounding box detections

**Multi-Task Rendering:**
- Single forward pass produces: RGB images, semantic segmentation masks, and optical flow
- All rendered in real-time through Gaussian splatting's rasterization pipeline

**Evaluation:** Demonstrated on KITTI, KITTI-360, and Virtual KITTI 2 datasets with strong performance across all output modalities.

---

### 2.6 SplatAD (Zenseact, CVPR 2025)

**Paper:** [SplatAD: Real-Time Lidar and Camera Rendering with 3D Gaussian Splatting for Autonomous Driving](https://research.zenseact.com/publications/splatad/)

SplatAD is the first 3DGS method to jointly render both camera and LiDAR data in real-time for dynamic driving scenes.

**LiDAR Rendering Pipeline:**
1. Projects 3D Gaussians to spherical coordinates
2. Intersects with non-equidistant tiles matching actual LiDAR beam distribution
3. Rasterizes depth and features across the non-linear LiDAR grid
4. Compensates for rolling shutter effects
5. Decodes features to LiDAR intensity and ray dropout probability via custom CUDA kernels

**Camera Rendering Pipeline:**
1. Modifies standard 3DGS rasterization to output RGB + features
2. Decodes view-dependent colors via a small CNN
3. Applies rolling shutter compensation

**Sensor Modeling:**
- Rolling shutter effects for both camera and LiDAR
- LiDAR intensity (material-dependent reflectivity)
- LiDAR ray dropout probability (occlusion/absorption)
- Custom CUDA kernels for efficient rendering

**Performance:**
- **+2 PSNR** for novel view synthesis over NeRF methods
- **+3 PSNR** for reconstruction tasks
- **~10x faster rendering** than NeRF-based approaches
- Evaluated on PandaSet, Argoverse2, and nuScenes

---

### 2.7 3DGS vs NeRF: Key Tradeoffs for Driving Simulation

| Dimension | NeRF | 3D Gaussian Splatting |
|---|---|---|
| **Rendering Speed** | ~10 sec/frame (Mip-NeRF360) | Real-time (135+ FPS) |
| **Training Time** | 12-48 hours | 30-45 minutes |
| **Rendering Approach** | Backward ray marching | Forward rasterization |
| **Representation** | Implicit (MLP + encodings) | Explicit (3D Gaussians) |
| **Scene Editing** | Difficult (entangled representation) | Easy (explicit primitives) |
| **Memory** | Compact | Higher (millions of Gaussians) |
| **Geometric Accuracy** | Good with SDF variants | Improving (2D Gaussians, surface normals) |
| **LiDAR Rendering** | Well-established (beam models) | Emerging (SplatAD, GS-LiDAR) |
| **Dynamic Scenes** | Mature approaches (SUDS, EmerNeRF) | Rapidly catching up (PVG, Street Gaussians) |
| **Scalability** | Proven city-scale (Block-NeRF) | Proven route-scale, advancing |
| **Maturity for AD** | 3+ years of research | ~1.5 years, rapidly advancing |

**Current Consensus (2025):** 3DGS is becoming the preferred representation for driving simulation due to its real-time rendering capability, which is essential for closed-loop testing. NeRF retains advantages in geometric accuracy for surface reconstruction tasks, and many hybrid approaches (e.g., NeRF2GS by aiMotive) leverage both.

---

## 3. Neural Sensor Simulation

### 3.1 Camera Simulation / Novel View Synthesis

Camera simulation is the most mature application of neural scene reconstruction for driving. The pipeline typically involves:

1. **Training:** Multi-view images from driving logs + LiDAR depth supervision
2. **Static/Dynamic Decomposition:** Separate models for background and tracked objects
3. **Novel View Synthesis:** Render from new ego positions or after modifying actor configurations
4. **Sensor-Realistic Details:** Rolling shutter, lens distortion, exposure variation, motion blur

**State-of-the-art methods** (NeuRAD, SplatAD, EmerNeRF) achieve PSNR values of 28-32 dB on driving datasets, approaching photorealistic quality. Dynamic object rendering remains harder (+3-5 dB gap vs static scenes).

---

### 3.2 LiDAR Simulation from Neural Representations

LiDAR simulation has emerged as a critical capability beyond just camera rendering. Two primary modeling strategies exist:

**Ray Models:**
- Convert LiDAR point clouds to 360-degree panoramic images via spherical projection
- Render depth, intensity, and semantic labels per pixel
- Methods: LiDAR-NeRF, LiDAR4D

**Beam Models (more physically accurate):**
- Simulate beam divergence (LiDAR beams are not infinitesimally thin)
- Model secondary returns (multiple echoes from partial occlusions)
- Predict ray dropping (probabilistic modeling of missing returns)
- Methods: NeuRAD, SplatAD

**GS-LiDAR (ICLR 2025):**
- Uses 2D Gaussian disk primitives with periodic vibration for dynamics
- Explicit ray-splat intersection (not Jacobian approximation): solves linear equations for each LiDAR ray defined by azimuth and elevation
- Spherical harmonic coefficients per Gaussian for view-dependent intensity and ray-drop probability
- Dual depth rendering (mean + median) for improved geometric accuracy
- Results: 11.5% RMSE reduction vs LiDAR4D on KITTI-360; 31x faster rendering; 11 FPS

---

### 3.3 Radar Simulation

Radar simulation from neural representations is the newest and least mature modality.

**NeuRadar (CVPR Workshop 2025):**
- First NeRF model to jointly synthesize radar, camera, and LiDAR data
- Extends NeuRAD's Neural Feature Field (NFF) architecture
- Two point cloud representation modes:
  - **Deterministic:** Predicts fixed 3D positions and confidence scores per ray
  - **Probabilistic:** Models detections as a Multi-Bernoulli Random Finite Set (MB-RFS) with existence probabilities and Laplacian spatial uncertainty distributions
- The probabilistic variant captures radar's inherent stochastic behavior (multipath, clutter, variable detection probability)
- Evaluated on View-of-Delft and Zenseact Open Dataset

**Key Challenge:** Radar returns are fundamentally different from camera/LiDAR -- they are sparse, noisy, exhibit multipath effects, and have stochastic detection behavior. Deterministic rendering approaches that work for camera/LiDAR are insufficient; probabilistic models are necessary.

---

### 3.4 Multi-Sensor Consistent Rendering

Achieving consistency across multiple sensor modalities is critical for autonomous driving simulation:

- **Geometric consistency:** Camera images and LiDAR point clouds must describe the same 3D geometry
- **Temporal consistency:** All sensors must be properly synchronized with rolling shutter and motion compensation
- **Appearance consistency:** Colors, intensities, and material properties should be physically coherent

**Approaches:**
- **Unified neural field** (NeuRAD, NeuRadar): Single shared representation renders all modalities, ensuring intrinsic consistency
- **Hybrid rendering** (aiMotive NeRF2GS): Neural background + physics-based dynamic objects, requiring careful domain alignment
- **Compositional** (UniSim): Separate representations for background and each actor, composed during rendering with consistent geometry

---

## 4. Scene Reconstruction Pipelines

### 4.1 End-to-End Pipeline: From Raw Sensor Logs to Reconstructed Scenes

A typical neural scene reconstruction pipeline for driving consists of these stages:

**Stage 1: Data Preparation**
- Collect synchronized multi-sensor data: RGB cameras (surround view), LiDAR, IMU/GNSS
- Compute accurate sensor poses via SLAM or offline localization (GPS + IMU + visual odometry)
- Calibrate intrinsics (focal length, distortion) and extrinsics (sensor-to-vehicle transforms)
- Time-synchronize all sensor streams

**Stage 2: Dynamic Object Detection and Tracking**
- Run 3D object detection on LiDAR/camera data to identify vehicles, pedestrians, cyclists
- Track objects across frames to establish consistent identities and trajectories
- Estimate per-object 6-DoF poses at each timestamp
- (Self-supervised methods like EmerNeRF and S3Gaussian skip this stage)

**Stage 3: Scene Decomposition**
- Mask dynamic objects in training images (or learn to decompose via self-supervision)
- Separate static background from dynamic foreground
- Optionally segment sky, far-field, and close-range regions (StreetSurf, SUDS)

**Stage 4: Neural Reconstruction**
- Train neural representation(s) on decomposed data
- Background: NeRF, 3DGS, or hybrid trained on masked/inpainted images + LiDAR
- Dynamic objects: Per-instance canonical models + tracked poses (MARS, Street Gaussians) or temporal vibration (PVG)
- Apply sensor-specific supervision: photometric loss, depth loss, LiDAR intensity loss

**Stage 5: Validation and Artifact Removal**
- Evaluate rendering quality (PSNR, SSIM, LPIPS)
- Address artifacts: ghosting from imperfect dynamic masking, floaters from sparse views
- Apply neural inpainting/fixing (NVIDIA NuRec Fixer uses a transformer-based model)

**Stage 6: Integration into Simulation**
- Load reconstructed scene into simulation framework
- Place controllable dynamic agents
- Configure sensor models and viewpoints
- Run simulation (open-loop replay or closed-loop interaction)

---

### 4.2 Handling Dynamic Objects

Dynamic object handling is the central challenge of driving scene reconstruction. Three main paradigms exist:

**Paradigm 1: Detect, Remove, Reconstruct Separately**
- Detect and track all dynamic objects using 3D perception
- Remove dynamic objects from training data (masking + inpainting background)
- Build per-object canonical models in normalized coordinate spaces
- Recompose by placing canonical models at desired poses
- *Used by:* MARS, UniSim, DrivingGaussian, Street Gaussians, aiMotive NeRF2GS
- *Advantage:* Full control over individual objects (trajectory, appearance, insertion/removal)
- *Disadvantage:* Requires accurate 3D detection and tracking; errors propagate

**Paradigm 2: Self-Supervised Decomposition**
- Learn to separate static and dynamic fields from photometric/geometric/flow supervision alone
- No 3D bounding boxes required
- *Used by:* EmerNeRF, S3Gaussian, SUDS, PVG, DeSiRe-GS
- *Advantage:* No annotation cost; works on any driving data
- *Disadvantage:* Less precise control over individual objects; harder to edit specific actors

**Paradigm 3: Unified Temporal Representation**
- Model entire 4D scene (space + time) without explicit decomposition
- Temporal dynamics encoded through time-conditioned parameters
- *Used by:* PVG (periodic vibration), LiDAR4D
- *Advantage:* Simplest pipeline; captures all temporal effects
- *Disadvantage:* Cannot easily manipulate individual objects

---

### 4.3 Large-Scale Scene Reconstruction

Scaling neural reconstruction to full routes (kilometers) or areas (square kilometers) requires specialized strategies:

**Spatial Decomposition:**
- Block-NeRF: Divide into overlapping spatial blocks, train independently, align appearance at boundaries
- SUDS: Multi-resolution hash tables with scene partitioning
- DrivingGaussian: Incremental reconstruction -- add Gaussians progressively as ego vehicle traverses the route

**Parallelization:**
- Block-based approaches naturally parallelize across GPUs/machines
- Each block/region trains independently
- aiMotive: Block-based parallelization handles reconstructions exceeding 100,000 m2

**Level-of-Detail:**
- BungeeNeRF: Progressive rendering with shallow base for distant views, additional blocks for close-up detail
- Grid-NeRF: Grid-guided approach for scenes spanning 2.7+ km2

**Current Scale Records:**
- Block-NeRF: Entire San Francisco neighborhood (2.8M images)
- SUDS: Hundreds of kilometers, 1.2M frames
- NVIDIA NuRec: Full driving routes reconstructed for CARLA integration

---

### 4.4 Relighting and Weather Augmentation

Neural representations enable powerful appearance editing for simulation diversity:

**Relighting:**
- **LightSim (Waabi, NeurIPS 2023):** Builds lighting-aware digital twins by decomposing scenes into geometry, appearance, and estimated HDR environment lighting (sky dome). Enables physically-based relighting by modifying sun position, intensity, and shadow casting. Uses GPS to generate accurate HDR sky domes. FID: 29.5 (significantly lower than competing methods).
- **NeRF-OSR:** First outdoor scene relighting method based on NeRF, enabling simultaneous editing of illumination and viewpoint from photo collections.

**Weather Synthesis:**
- **ClimateNeRF (ICCV 2023):** Fuses physics-based particle simulations with NeRF. Synthesizes smog (variable density), snow (adjustable accumulation), and flood (controllable water level) effects. Uses physically meaningful control parameters. Limitation: static weather only, no dynamic precipitation.
- **WeatherEdit (2025):** Two-component pipeline: weather background editing + weather particle construction using dynamic 4D Gaussian fields for snowflakes, raindrops, and fog with physically-based dynamics.
- **WeatherWeaver:** Video diffusion model for synthesizing rain, snow, fog, and clouds with controllable intensity.

**Impact for Simulation:** These methods can dramatically increase training data diversity by rendering the same driving route under dozens of weather/lighting conditions, improving perception model robustness at minimal data collection cost.

---

## 5. Applications to Simulation

### 5.1 Closed-Loop Testing in Reconstructed Scenes

Closed-loop neural simulation represents the most impactful application of scene reconstruction for AV development.

**NeuroNCAP (Zenseact, ECCV 2024):**
The most developed closed-loop testing framework using neural rendering.

- **Four-Step Loop:**
  1. Neural renderer generates photorealistic sensor data from trained NeRF
  2. AD perception/planning model processes rendered images
  3. Controller converts planned trajectory to acceleration/steering commands
  4. Vehicle model updates ego state; loop repeats

- **Safety-Critical Scenario Types (inspired by Euro NCAP):**
  - **Stationary:** Actor motionless in ego path (tests AEB)
  - **Frontal:** Actor approaching head-on (tests evasive steering)
  - **Side/Crossing:** Actor from perpendicular angle (tests combined braking + steering)

- **Scoring:** 5-star system (5 = complete collision avoidance, 0 = full-speed impact)

- **Key Finding:** State-of-the-art end-to-end models (UniAD, VAD) can detect and forecast safety-critical actors but *fail to execute appropriate evasive maneuvers*, revealing critical planning gaps that open-loop evaluation misses.

**UniSim Closed-Loop Pipeline:**
- Converts real-world logs into modifiable digital twin simulations
- Enables counterfactual evaluation: "what would have happened if that vehicle cut in?"
- Demonstrated that neural simulation domain gap is small enough for meaningful evaluation

---

### 5.2 Counterfactual Scenario Generation

Neural scene reconstruction enables generating scenarios that *never occurred* but are plausible and safety-critical:

**Actor Manipulation:**
- **Trajectory modification:** Change the path of existing vehicles (e.g., simulate a cut-in)
- **Timing perturbation:** Adjust when actors appear (e.g., pedestrian steps out 0.5s earlier)
- **Actor insertion:** Place new vehicles/pedestrians from a library of reconstructed assets
- **Actor removal:** Remove occluding vehicles to test visibility-dependent behavior

**Scene Modification:**
- **Viewpoint changes:** Render from positions the ego vehicle never visited
- **Environmental conditions:** Change lighting, weather, time of day (via LightSim/ClimateNeRF)
- **Layout modifications:** Alter lane markings, add/remove construction zones (limited capability currently)

**Generation Strategies:**
- **Jittering:** Small perturbations to existing actor trajectories/positions to create scenario variants
- **Adversarial:** Optimize actor behaviors to create maximally challenging scenarios for the AV
- **Curriculum:** Generate progressive difficulty levels for systematic stress testing

---

### 5.3 Data Augmentation from Reconstructed Scenes

Neural reconstruction provides a cost-effective way to multiply training data:

**Approaches:**
- **Novel viewpoint rendering:** Generate images from positions between/beyond original camera poses
- **Object-level augmentation (Drive-3DAug):** Reconstruct 3D models of foreground objects, place them at valid locations in reconstructed backgrounds with appropriate orientation
- **Lighting augmentation (LightSim):** Render same scene under different illumination conditions; shown to significantly improve perception model performance on underrepresented lighting conditions
- **S-NeRF++:** End-to-end system that generates large-scale street scenes and foreground objects from driving datasets (nuScenes, Waymo) for training data generation

**Validation:** Training perception models on LightSim-augmented data significantly improves real-world performance, demonstrating that the domain gap is small enough for effective data augmentation.

---

### 5.4 Real-Time Rendering Requirements

For practical simulation deployment, rendering speed is critical:

| Use Case | Required FPS | Current Capability |
|---|---|---|
| Offline data generation | < 1 FPS acceptable | NeRF-based methods sufficient |
| Open-loop replay | 1-10 FPS | NeRF (with acceleration), 3DGS |
| Closed-loop testing | 10-30 FPS | 3DGS methods (SplatAD, Street Gaussians) |
| Real-time interactive | 30+ FPS | 3DGS (Street Gaussians: 135 FPS) |
| Hardware-in-the-loop | Sensor-rate (10-30 Hz) | 3DGS with custom CUDA kernels |

**Key Milestone:** SplatAD and Street Gaussians have demonstrated that *joint camera + LiDAR rendering at interactive rates* is achievable with 3DGS, unlocking practical closed-loop simulation.

---

### 5.5 Applications to Airside Autonomous Vehicles

Neural scene reconstruction offers specific advantages for airport/airside AV applications:

**Airport Environment Characteristics:**
- Large open areas (aprons, taxiways, runways) with less occlusion than urban streets
- Distinctive ground markings and signage critical for navigation
- Ground support equipment (GSE) with predictable but diverse motion patterns
- Aircraft of varying sizes as dynamic obstacles
- Controlled environment with known geometry (airport maps, CAD models available)

**Reconstruction Advantages for Airside:**
- **Digital twin creation:** Reconstruct specific airport layouts from sensor data collected by survey vehicles or operational AVs, capturing the exact appearance and geometry of each gate area, taxiway, and apron
- **GSE interaction testing:** Reconstruct and modify scenarios involving baggage tractors, belt loaders, fuel trucks to test AV reactions to various equipment configurations
- **Aircraft arrival/departure simulation:** Reconstruct scenarios with aircraft pushback, taxi, and parking to test AV yielding behavior
- **Lighting condition diversity:** Airport operations span all times of day; neural relighting (LightSim) can augment daytime captures to simulate night operations with ramp lighting
- **Weather robustness:** Airport operations in fog, rain, snow; weather augmentation (ClimateNeRF, WeatherEdit) can test perception under conditions rare in training data
- **Layout change testing:** When gate assignments change or construction alters the apron, scenes can be partially re-reconstructed and modified

**Specific Technical Considerations:**
- Airport environments have large flat surfaces (taxiways, aprons) that are well-suited for Gaussian splatting and surface reconstruction methods
- LiDAR is often the primary sensor for airside AVs (safety-critical, works in all conditions) -- methods like SplatAD and GS-LiDAR that render realistic LiDAR are particularly relevant
- The controlled, structured nature of airports may allow higher reconstruction quality than open-road driving
- Multi-sensor consistent rendering (camera + LiDAR + potentially radar) is essential given the safety requirements of airside operations

---

## 6. Comparative Analysis: NeRF vs 3DGS

### Evolution Timeline

```
2020: Original NeRF (single static scenes)
2022: Block-NeRF (city-scale static), Urban Radiance Fields (LiDAR-supervised)
2023: SUDS (large-scale dynamic), UniSim (closed-loop), MARS (modular), StreetSurf (surfaces)
      Original 3DGS paper (Kerbl et al.)
2024: EmerNeRF (self-supervised), NeuRAD (multi-sensor), Street Gaussians, DrivingGaussian,
      PVG, HUGS, S3Gaussian (all 3DGS-based dynamic driving)
2025: SplatAD (3DGS + LiDAR), GS-LiDAR, NeuRadar (radar), NeuroNCAP (closed-loop testing),
      DeSiRe-GS, DrivingGaussian++, NVIDIA NuRec pipeline
```

### Current State of the Art (Early 2026)

**For highest rendering quality:** EmerNeRF (NeRF) and PVG (3DGS) lead on benchmarks

**For real-time rendering:** 3DGS methods dominate -- Street Gaussians (135 FPS), SplatAD (10x over NeRF)

**For multi-sensor simulation:** NeuRAD (NeRF, camera+LiDAR), SplatAD (3DGS, camera+LiDAR), NeuRadar (NeRF, camera+LiDAR+radar)

**For closed-loop testing:** UniSim (pioneered the approach), NeuroNCAP (standardized safety evaluation)

**For large-scale reconstruction:** SUDS (hundreds of km), Block-NeRF (city neighborhoods), NVIDIA NuRec (production pipeline)

**For self-supervised operation:** EmerNeRF, S3Gaussian, PVG (no annotations required)

### Industry Adoption

- **Waabi:** UniSim + LightSim for closed-loop simulation
- **NVIDIA:** NuRec pipeline with 3DGUT (Gaussian Splatting) integrated into CARLA
- **Zenseact:** NeuRAD -> SplatAD progression, NeuroNCAP for safety testing
- **aiMotive:** NeRF2GS hybrid approach in aiSim production simulator
- **Waymo:** Block-NeRF for city-scale reconstruction (internal simulation stack)

---

## Key Takeaways

1. **3DGS is displacing NeRF** for real-time driving simulation due to 100x+ rendering speed advantage, though hybrid approaches combining NeRF's geometric understanding with 3DGS's rendering speed are emerging.

2. **Self-supervised decomposition** (EmerNeRF, S3Gaussian, PVG) is reducing the dependency on expensive 3D annotation pipelines, making neural reconstruction more practical at scale.

3. **Multi-sensor rendering** (camera + LiDAR + radar) is now achievable, with SplatAD and NeuRadar closing the gap for non-camera modalities.

4. **Closed-loop testing** using neural rendering has revealed critical planning failures in state-of-the-art AD systems that open-loop evaluation misses (NeuroNCAP findings).

5. **Production pipelines** are maturing (NVIDIA NuRec, aiMotive aiSim), with reconstruction times measured in hours and rendering at interactive rates.

6. **For airside AV specifically**, the structured and well-mapped nature of airport environments, combined with the critical importance of multi-sensor simulation and diverse weather/lighting testing, makes neural scene reconstruction a high-value approach for validation and data augmentation.

---

## Sources

### NeRF for Driving
- [Block-NeRF (Waymo Research)](https://waymo.com/research/block-nerf/)
- [Block-NeRF Paper](https://ar5iv.labs.arxiv.org/html/2202.05263)
- [Urban Radiance Fields](https://urban-radiance-fields.github.io/)
- [SUDS: Scalable Urban Dynamic Scenes](https://haithemturki.com/suds/)
- [SUDS Paper](https://arxiv.org/abs/2303.14536)
- [EmerNeRF Project Page](https://emernerf.github.io/)
- [EmerNeRF Paper](https://arxiv.org/abs/2311.02077)
- [NVIDIA Blog: Reconstructing Dynamic Driving Scenarios](https://developer.nvidia.com/blog/reconstructing-dynamic-driving-scenarios-using-self-supervised-learning/)
- [StreetSurf Project Page](https://ventusff.github.io/streetsurf_web/)
- [StreetSurf Paper](https://arxiv.org/abs/2306.04988)
- [UniSim (Waabi)](https://waabi.ai/unisim/)
- [UniSim Paper](https://arxiv.org/abs/2308.01898)
- [NeuRAD (Zenseact)](https://research.zenseact.com/publications/neurad/)
- [NeuRAD Paper](https://arxiv.org/abs/2311.15260)
- [READ Paper](https://arxiv.org/abs/2205.05509)
- [MARS Paper](https://arxiv.org/abs/2307.15058)
- [MARS GitHub](https://github.com/OPEN-AIR-SUN/mars)

### 3D Gaussian Splatting for Driving
- [Street Gaussians Project Page](https://zju3dv.github.io/street_gaussians/)
- [Street Gaussians Paper](https://arxiv.org/abs/2401.01339)
- [DrivingGaussian (CVPR 2024)](https://github.com/VDIGPKU/DrivingGaussian)
- [S3Gaussian Paper](https://arxiv.org/abs/2405.20323)
- [PVG Project Page](https://fudan-zvg.github.io/PVG/)
- [PVG Paper](https://arxiv.org/abs/2311.18561)
- [PVG GitHub](https://github.com/fudan-zvg/PVG)
- [HUGS Project Page](https://xdimlab.github.io/hugs_website/)
- [HUGS Paper](https://arxiv.org/abs/2403.12722)
- [HUGS GitHub](https://github.com/hyzhou404/HUGS)
- [SplatAD (Zenseact)](https://research.zenseact.com/publications/splatad/)
- [SplatAD Paper](https://arxiv.org/abs/2411.16816)
- [SplatAD GitHub](https://github.com/carlinds/splatad)
- [3DGS vs NeRF Comparison (PyImageSearch)](https://pyimagesearch.com/2024/12/09/3d-gaussian-splatting-vs-nerf-the-end-game-of-3d-reconstruction/)
- [DeSiRe-GS (CVPR 2025)](https://openaccess.thecvf.com/content/CVPR2025/papers/Peng_DeSiRe-GS_4D_Street_Gaussians_for_Static-Dynamic_Decomposition_and_Surface_Reconstruction_CVPR_2025_paper.pdf)

### Neural Sensor Simulation
- [GS-LiDAR Paper (ICLR 2025)](https://arxiv.org/abs/2501.13971)
- [GS-LiDAR GitHub](https://github.com/fudan-zvg/GS-LiDAR)
- [NeuRadar Paper (CVPR Workshop 2025)](https://arxiv.org/abs/2504.00859)
- [NeuRadar GitHub](https://github.com/mrafidashti/neuradar)
- [NeRF in Autonomous Driving Survey](https://arxiv.org/html/2404.13816v2)
- [3DGS for AD Scene Reconstruction Review](https://link.springer.com/article/10.1007/s10462-024-10955-4)
- [AD Scenario Generation Survey (2025)](https://www.sciencedirect.com/science/article/pii/S1000934525300975)

### Relighting and Weather
- [LightSim (Waabi, NeurIPS 2023)](https://waabi.ai/research/lightsim)
- [LightSim Paper](https://arxiv.org/abs/2312.06654)
- [ClimateNeRF Project Page](https://climatenerf.github.io/)
- [ClimateNeRF Paper](https://arxiv.org/abs/2211.13226)
- [NeRF-OSR: Outdoor Scene Relighting](https://4dqv.mpi-inf.mpg.de/NeRF-OSR/)

### Closed-Loop Testing and Simulation
- [NeuroNCAP (Zenseact)](https://research.zenseact.com/publications/neuro-ncap/)
- [NVIDIA NuRec Blog](https://developer.nvidia.com/blog/accelerating-av-simulation-with-neural-reconstruction-and-world-foundation-models/)
- [aiMotive aiSim Neural Reconstruction](https://aimotive.com/aisim-neural-reconstruction-and-rendering)
- [S-NeRF++ Paper](https://arxiv.org/abs/2402.02112)
- [FAA: Autonomous Ground Vehicles on Airports](https://www.faa.gov/airports/new_entrants/agvs_on_airports)
