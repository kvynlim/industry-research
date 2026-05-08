# 08 — 3D Gaussian Splatting Digital Twin Pipeline for Airport AV Simulation

## Executive Summary

This report covers the end-to-end pipeline for building a 3D Gaussian Splatting (3DGS) digital twin of an airport airside environment from LiDAR data, for use as a sensor-realistic autonomous vehicle simulator. We cover LiDAR-native 3DGS methods (SplatAD, GS-LiDAR, LiDAR-GS, FGGS-LiDAR), practical tooling (nerfstudio/gsplat, official 3DGS repo, Street Gaussians), airport-specific challenges (large-scale scenes, reflective aircraft, ground planes), simulation capabilities (novel view synthesis, synthetic LiDAR, weather augmentation, dynamic object insertion), and closed-loop testing pipelines (HUGSIM-style). The goal is a simulation environment where the AV stack perceives sensor data indistinguishable from real airside operations.

---

## 1. 3DGS from LiDAR Data — Methods and Quality

### 1.1 Why LiDAR for 3DGS Initialization Matters

Standard 3DGS relies on COLMAP Structure-from-Motion (SfM) point clouds for Gaussian initialization. This works well in texture-rich environments but fails in:
- **Monotonous surfaces** (airport tarmac, concrete aprons)
- **Repetitive structures** (terminal facades, taxiway markings)
- **Large-scale open areas** where SfM produces sparse, noisy point clouds

LiDAR provides dense, metrically accurate point clouds regardless of texture, making it the natural initialization source for airport environments. Research consistently shows that LiDAR-initialized Gaussians converge faster, produce better geometry, and avoid the floating artifacts endemic to sparse SfM initialization.

### 1.2 SplatAD (Zenseact, CVPR 2025)

SplatAD is the first 3DGS method that renders both camera and LiDAR data in real time for autonomous driving simulation.

**LiDAR Rendering Pipeline:**
- Projects 3D Gaussian means and covariances from Cartesian to **spherical coordinates** (azimuth, elevation, range) using a Jacobian transformation
- Custom **non-uniform tiling** aligned with LiDAR beam distribution: 32 azimuth points horizontally, 8 diode channels vertically per tile (256 threads per tile)
- Explicit ray-splat intersection in spherical space with special handling for 360-degree azimuth wrapping
- Models **rolling shutter** effects via velocity projections in spherical space
- Renders **intensity** and **ray-drop probability** as additional Gaussian attributes

**Initialization:**
- Up to 2M LiDAR points for static background; 500 random points per dynamic actor
- Color initialization: LiDAR points projected to nearest camera image for initial RGB
- Uses **MCMC-based densification** instead of traditional split/clone for predictable compute

**Training:**
- Loss: L1 + SSIM (image) + depth + line-of-sight occlusion + intensity + ray-drop BCE + MCMC regularization
- 30,000 iterations on single A100, ~1 hour
- Resolution schedule: 4x downsampled initially, upsampled at iterations 3,000 and 6,000

**Quantitative Results (Novel View Synthesis):**

| Dataset | Image PSNR | SSIM | LPIPS | LiDAR Depth Error | Chamfer Dist | Camera Speed (MP/s) | LiDAR Speed (MR/s) |
|---------|-----------|------|-------|-------------------|-------------|--------------------|--------------------|
| PandaSet | 26.76 dB | 0.815 | 0.193 | 0.01 m | 1.6 cm | 121.5 | 19.5 |
| Argoverse2 | 28.42 dB | 0.826 | 0.270 | 0.02 m | 2.8 cm | 134.5 | 9.5 |
| nuScenes | 27.54 dB | 0.849 | 0.302 | 0.02 m | 1.7 cm | 106.1 | 5.7 |

**Verdict:** SplatAD is the most complete pipeline for joint camera+LiDAR simulation. The 10-12x speedup over NeuRAD makes it viable for real-time closed-loop testing. Code available via gsplat fork + neurad-studio.

### 1.3 GS-LiDAR (Fudan University, ICLR 2025)

GS-LiDAR focuses specifically on generating realistic LiDAR point clouds from 3DGS.

**Key Technical Contributions:**
- Uses **2D Gaussian primitives** with periodic vibration properties for precise geometric reconstruction
- Introduces **panoramic rendering** with explicit ray-splat intersection guided by panoramic LiDAR supervision
- Encodes **intensity** and **ray-drop** as spherical harmonic coefficients within each Gaussian primitive
- Handles both static and dynamic elements in driving scenarios

**Evaluation:**
- Evaluated on KITTI-360 and nuScenes
- Superior in quantitative metrics, visual quality, and training/rendering efficiency vs. NeRF-based methods
- Significantly faster than methods like LiDAR-NeRF and NFL (Neural Feature LiDAR)

**Setup (from GitHub):**
```bash
git clone https://github.com/fudan-zvg/GS-LiDAR.git
conda create --name gslidar python=3.9
pip install torch==2.0.1 torchvision==0.15.2
pip install -r requirements.txt
# Install custom rasterizer and chamfer distance
python train.py --config configs/kitti360_nvs_1908.yaml \
  source_path=data/kitti360 model_path=eval_output/kitti360/1908
```

**Verdict:** Best dedicated LiDAR novel view synthesis. If the primary goal is generating realistic synthetic LiDAR scans (for LiDAR-based perception testing), GS-LiDAR is the most specialized tool.

### 1.4 LiDAR-GS (Real-time LiDAR Re-Simulation)

LiDAR-GS takes a different approach with **differentiable laser beam splatting**.

**Key Design:**
- Uses **range-view representation** for precise surface splatting by projecting lasers onto micro cross-sections
- Eliminates artifacts from local affine approximations used in camera-centric methods
- Integrates view-dependent cues to capture LiDAR properties influenced by incident direction
- Simultaneously renders **depth**, **intensity**, and **ray-drop** channels

**Performance:** State-of-the-art in both rendering frame rate and quality on public urban road datasets. Source code publicly available.

### 1.5 FGGS-LiDAR (Plug-and-Play, 500+ FPS)

FGGS-LiDAR solves a different problem: converting *any* pretrained 3DGS model to a LiDAR simulator without retraining.

**Pipeline:**
1. **Volumetric Discretization:** Each Gaussian gets an AABB; Morton code sorting for spatial coherence; BVH construction
2. **TSDF Mesh Reconstruction:** Flood-fill sign assignment, narrow-band distance propagation, Marching Cubes isosurface extraction, Taubin smoothing
3. **GPU-Accelerated Ray Casting:** Hardware-optimized ray-triangle intersection with BVH traversal, achieving O(Nr * (log T + K)) complexity

**Performance:**
- **>500 FPS** for 200K+ rays in 6M+ triangle scenes
- Indoor Chamfer Distance: 4.07 mm, F-score: 0.994
- Outdoor Chamfer Distance: 17.0 mm, F-score: 0.982
- Validated on HDL64, OS128, VLP32 sensor configurations

**Key Advantage:** No LiDAR-specific training required. Build your 3DGS from cameras, then simulate LiDAR for free. Code: https://github.com/TATP-233/FGGS-LiDAR

### 1.6 LiDAR-Only Quality Assessment

**Can you build a useful 3DGS from LiDAR alone (no cameras)?**

Current research consistently shows that LiDAR-only 3DGS produces good **geometry** but lacks **photorealistic appearance**:
- LiDAR provides dense, accurate 3D structure — ideal for Gaussian position/scale initialization
- Without camera images, there is no photometric supervision to learn spherical harmonic color coefficients
- LiDAR intensity can provide a single-channel appearance signal, but it is a poor proxy for RGB

**Practical recommendation for airport digital twin:**
1. Use LiDAR as the **primary geometric scaffold** (Gaussian positions, scales, normals)
2. Use vehicle-mounted or drone cameras for **appearance supervision** (even sparse coverage helps)
3. For LiDAR-only simulation (testing LiDAR perception), LiDAR-only initialization is sufficient — you only need depth/intensity/ray-drop, not RGB
4. For camera simulation, camera images are mandatory for photometric quality

---

## 2. Practical Pipeline — PCD Map to Simulation-Ready Digital Twin

### 2.1 End-to-End Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA ACQUISITION                             │
│  LiDAR PCD map (aggregated) + Camera images + Poses (SLAM)     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    PREPROCESSING                                │
│  1. Voxel downsample PCD (0.1-0.15m)                           │
│  2. Remove dynamic objects (3D detection + tracking masks)      │
│  3. Register camera poses to LiDAR frame                       │
│  4. Generate per-frame depth maps from LiDAR projection        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    GAUSSIAN SEEDING                              │
│  1. Initialize Gaussians at LiDAR point positions              │
│  2. Set scales from local point density (k-NN radius)          │
│  3. Set rotations from local surface normals (PCA)             │
│  4. Initialize colors by projecting to nearest camera frame    │
│  5. Initialize opacity to 0.5-0.8                              │
│  6. Add random sky/far-field points for completeness           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    OPTIMIZATION                                 │
│  1. Photometric loss (L1 + SSIM) on camera views               │
│  2. Depth loss from LiDAR-projected depth maps                 │
│  3. Normal consistency loss for surface regularization         │
│  4. LiDAR intensity + ray-drop losses (if training for LiDAR)  │
│  5. MCMC or adaptive densification for Gaussian count control  │
│  6. 30K iterations, ~1-2 hours on A100 per scene segment       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    POST-PROCESSING                              │
│  1. Prune low-opacity Gaussians (< 0.005)                      │
│  2. Merge overlapping tile boundaries                          │
│  3. Extract mesh for collision geometry (TSDF + Marching Cubes)│
│  4. Quality validation (PSNR/SSIM on held-out views)           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    SIMULATION-READY OUTPUT                       │
│  Static background Gaussians + Collision mesh + Metadata        │
│  → Feed into closed-loop simulator (HUGSIM-style)              │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 LiDAR Point Cloud Preprocessing

**Voxel Downsampling:**
- Airport-scale PCD maps can contain billions of points from accumulated LiDAR scans
- Downsample to 0.1-0.15m voxels for Gaussian initialization (following Street Gaussians: 0.15m voxel size)
- Preserve per-point attributes: intensity, return number, normal estimates

**Coordinate Frame Alignment:**
- All LiDAR points in a global frame (UTM or local ENU)
- Camera extrinsics registered to the same frame via LiDAR-camera calibration
- If using SLAM-produced maps, ensure loop closure quality (cm-level accuracy needed)

**Depth Map Generation:**
- For each camera frame, project the aggregated LiDAR map to generate dense depth supervision
- Use z-buffering to handle occlusions
- These depth maps provide geometric supervision during 3DGS training (critical for texture-poor airport surfaces)

### 2.3 Dynamic Object Removal

For the static background digital twin, dynamic objects (vehicles, personnel, pushback tugs, baggage carts) must be removed.

**Recommended Approach — Two-Stage (DeSiRe-GS style):**

1. **Stage 1: Automatic Detection**
   - Run 3D object detector on LiDAR frames to identify dynamic objects
   - Use 2D semantic segmentation (SAM2 / SegmentAnything) on camera images for pixel-level masks
   - Combine 3D bounding boxes with 2D masks for robust identification

2. **Stage 2: Training-Based Separation**
   - Initialize 3DGS on full scene
   - The static regions naturally reconstruct well; dynamic regions show inconsistency
   - Extract per-Gaussian "staticness" scores (DAS3R approach) or use semantic masks (T-3DGS approach)
   - Prune Gaussians associated with dynamic objects
   - Re-optimize the remaining static Gaussians to fill holes (inpainting via densification)

**Alternative: DeGauss (ICCV 2025):**
- Models dynamic elements with foreground Gaussians and static content with background Gaussians
- Uses a probabilistic mask to coordinate composition
- Generalizes across real-world scenarios without complex heuristics

### 2.4 Quality Validation

**Quantitative Metrics:**
- **PSNR** (>25 dB for usable, >28 dB for high-quality) on held-out camera views
- **SSIM** (>0.80 target) for structural similarity
- **LPIPS** (<0.25 target) for perceptual quality
- **Chamfer Distance** (<5 cm) for LiDAR geometric accuracy
- **Depth RMSE** (<0.05 m) for geometric fidelity

**Airport-Specific Validation:**
- Drive the AV through the reconstructed scene and compare rendered sensor data vs. logged real data
- Run perception stack on synthetic data: detection rates, false positive rates should match real data within 5%
- Check ground plane flatness: rendered ground should be within 2 cm of actual surface elevation
- Validate taxiway marking visibility and readability in rendered images

---

## 3. Tools and Frameworks

### 3.1 gsplat (nerfstudio project)

**Repository:** https://github.com/nerfstudio-project/gsplat

gsplat is the de facto standard CUDA rasterization library for Gaussian Splatting research.

**Key Capabilities:**
- 4x less GPU memory, 10-15% faster training than official 3DGS implementation
- MCMC densification, ADC, and Absgrad strategies
- N-dimensional feature rendering (not just RGB)
- Depth rendering (essential for LiDAR simulation)
- Multi-GPU distributed rasterization via Grendel-GS integration
- Batch rasterization over multiple viewpoints
- **SplatAD's LiDAR rasterization** is implemented as `lidar_rasterization` in `gsplat/rendering.py`

**Installation:**
```bash
pip install gsplat  # JIT CUDA compilation on first run
# OR from source:
pip install git+https://github.com/nerfstudio-project/gsplat.git
```

**Language composition:** 53.9% CUDA, 42.6% Python, 3.5% C++

### 3.2 NeuRAD-Studio (Zenseact)

**Repository:** https://github.com/georghess/neurad-studio

A nerfstudio fork specifically designed for autonomous driving scene reconstruction.

**Setup:**
```bash
git clone https://github.com/georghess/neurad-studio.git
cd neurad-studio
pip install -e .
# For SplatAD LiDAR rendering, install custom gsplat fork:
# (see gsplat repo for SplatAD branch)
```

**Training:**
```bash
python nerfstudio/scripts/train.py neurad pandaset-data
# Or with SplatAD:
python nerfstudio/scripts/train.py splatad pandaset-data
```

**Supported datasets:** PandaSet, nuScenes, Argoverse2 (data loaders included). Docker/Apptainer images available.

### 3.3 Official 3DGS Repository (INRIA)

**Repository:** https://github.com/graphdeco-inria/gaussian-splatting

**Requirements:**
- CUDA GPU with Compute Capability 7.0+ (RTX 20xx or newer)
- 24 GB VRAM for paper-quality training
- CUDA SDK 11+

**Training from Custom Point Cloud:**
```bash
# Prepare COLMAP-format data:
# <data>/
#   images/        (camera frames)
#   sparse/0/      (cameras.bin, images.bin, points3D.bin)
python train.py -s <path_to_data>
# 30,000 iterations default, outputs .ply scene
```

**For LiDAR point cloud initialization:** Convert your LiDAR PCD to COLMAP `points3D.bin` format. Each point needs: position (x,y,z), color (r,g,b), and error. Set color from projected camera image or LiDAR intensity mapped to grayscale.

### 3.4 Street Gaussians (ZJU)

**Repository:** https://zju3dv.github.io/street_gaussians/

**Key for airport use:**
- Separates dynamic vehicles from static background using tracked bounding boxes
- LiDAR point cloud initialization with 0.15m voxel downsampling
- 4D spherical harmonics for time-varying appearance (useful for lighting changes)
- 133 FPS at 1066x1600 resolution on RTX 4090
- 30K iterations, ~30 minutes training

**Extension — DeSiRe-GS (CVPR 2025):**
- Self-supervised static-dynamic decomposition
- Surface reconstruction with geometric regularization
- Code: https://github.com/chengweialan/DeSiRe-GS

### 3.5 HUGSIM (Closed-Loop Simulator)

**Repository:** https://github.com/hyzhou404/HUGSIM

The most complete open-source closed-loop driving simulator built on 3DGS.

**Setup:**
```bash
curl -fsSL https://pixi.sh/install.sh | sh
# Edit pixi.toml, then:
pixi install
pixi run install-apex
pixi shell
```

**Pipeline:**
```bash
# 1. Reconstruct ground
python train_ground.py --data_cfg ./configs/nuscenes.yaml \
  --source_path data/ --model_path output/

# 2. Reconstruct full scene
python train.py --data_cfg ./configs/nuscenes.yaml \
  --source_path data/ --model_path output/

# 3. Export scene
python eval_render/export_scene.py --model_path output/ \
  --output_path scenes/ --iteration 30000

# 4. Run closed-loop simulation
python closed_loop.py --scenario_path scenario.yaml \
  --base_path ./configs/sim/nuscenes_base.yaml \
  --ad uniad --ad_cuda 1
```

**Supports:** KITTI-360, Waymo, nuScenes, PandaSet. 70+ sequences, 400+ scenarios in benchmark.

### 3.6 Tool Comparison Matrix

| Tool | LiDAR Render | Camera Render | Dynamic Objects | Closed-Loop | Scale | Maturity | License |
|------|-------------|--------------|-----------------|-------------|-------|----------|---------|
| **gsplat** | Yes (SplatAD) | Yes | Via extensions | No | Any | Production | Apache-2.0 |
| **NeuRAD-Studio** | Yes | Yes | Yes | No | Driving | Research+ | Apache-2.0 |
| **Official 3DGS** | No | Yes | No | No | Medium | Stable | Custom |
| **Street Gaussians** | Init only | Yes | Yes (tracked) | No | Driving | Research | MIT |
| **GS-LiDAR** | Yes | No | Yes | No | Driving | Research | MIT |
| **HUGSIM** | No | Yes | Yes (full) | Yes | Driving | Research | Apache-2.0 |
| **FGGS-LiDAR** | Yes (mesh) | No | No | No | Any | Research | Open |
| **OpenSplat** | No | Yes | No | No | Any | Production | AGPLv3 |
| **CityGaussian** | No | Yes | No | No | City | Research | Open |
| **Grendel-GS** | No | Yes | No | No | Massive | Research | Open |

---

## 4. Airport-Specific Challenges and Solutions

### 4.1 Large-Scale Scene Reconstruction

An airport airside area can span several square kilometers. A single 3DGS model cannot fit this in GPU memory.

**Solution: Hierarchical / Tiled Approach**

**Option A — CityGaussian Divide-and-Conquer:**
- Partition the airport into rectangular tiles (e.g., 200m x 200m)
- Train each tile independently with overlapping boundaries (20-30m overlap)
- Fuse tiles with Level-of-Detail: full detail for nearby tiles, compressed for distant
- Performance: 18 FPS without LoD, 36 FPS with LoD on A100

**Option B — Hierarchical 3D Gaussians (INRIA):**
- Divide-and-conquer training in independent chunks
- Consolidate into a hierarchy with optimized intermediate nodes
- Smooth LOD transitions during rendering
- Proven on multi-kilometer trajectories with tens of thousands of images
- Code: https://github.com/graphdeco-inria/hierarchical-3d-gaussians

**Option C — Grendel-GS Distributed Training:**
- Distribute Gaussians across up to 32 GPUs
- Achieves 40.4M Gaussians on 16 GPUs (vs. 11.2M on single GPU)
- 3.5x faster training with 4 GPUs
- Supports full-resolution training without downsampling
- Code: https://github.com/nyu-systems/Grendel-GS

**Recommended for Airport:**
- Tile the airport into zones: aprons, taxiways, runways, terminal frontage
- Train each zone independently using Grendel-GS or standard gsplat
- Merge using hierarchical approach for simulator-wide rendering
- Stream tiles on demand based on ego vehicle position (out-of-core rendering)

### 4.2 Reflective Aircraft Surfaces

Aircraft fuselages, engine nacelles, and wing surfaces are highly reflective and specular. Standard 3DGS uses low-order spherical harmonics (SH) that cannot capture sharp specular reflections.

**Mitigation Strategies:**

1. **GaussianShader (CVPR 2024):**
   - Augments Gaussians with explicit shading functions
   - Uses prefiltered environment mipmap lighting for reflections
   - +1.57 dB PSNR improvement on specular objects
   - Particularly effective for metallic sheen (aircraft aluminum)

2. **3DGS-DR (Deferred Reflection):**
   - Deferred shading pipeline for specular reflection rendering
   - Separates diffuse and specular components
   - Better normal estimation for reflection direction computation

3. **Reflective Gaussian Splatting (ICLR 2025):**
   - Dedicated handling of view-dependent appearance changes
   - Models semi-transparent and iridescent surfaces

4. **Practical Approach for Airport:**
   - Use higher-order SH (degree 3-4) for aircraft Gaussians
   - If aircraft are static props in the scene, capture them from multiple angles during data collection
   - For dynamic aircraft insertion, pre-reconstruct aircraft models from dedicated scans and insert as rigid objects
   - Accept that highly specular reflections of the environment (sky, terminal reflections in fuselage) will be approximate — the AV perception stack cares about detection, not reflection accuracy

### 4.3 Ground Plane Quality

Airport surfaces (tarmac, concrete) are flat, texture-poor, and critical for AV navigation. Standard 3DGS tends to produce:
- Floating Gaussians above the ground surface
- Wavy/undulating ground instead of flat planes
- Missing ground coverage in areas without visual features

**Solutions:**

1. **HUGSIM Multi-Plane Ground Model:**
   - Constrains Gaussians within local planes using height variance regularization
   - Assumes ground is planar within limited distance (handles slopes)
   - Anchors planes to camera coordinates
   - **Directly applicable to airport tarmac**

2. **PGSR (Planar-based Gaussian Splatting):**
   - Compresses 3D Gaussians into 2D flat plane representation
   - Generates plane distance and normal maps converted to unbiased depth
   - Multi-view regularization for global geometric consistency
   - Ideal for airport ground surfaces

3. **LiDAR Depth Regularization:**
   - Use LiDAR-projected depth maps as hard constraints during training
   - Forces ground Gaussians to lie on the measured surface
   - LetsGo's "unbiased Gaussian depth regularizer" eliminates floating artifacts

4. **Airport-Specific Ground Strategy:**
   ```
   Step 1: Segment ground points from LiDAR PCD (RANSAC plane fit + semantic labels)
   Step 2: Initialize ground Gaussians as thin disks (scale_z << scale_x, scale_y)
   Step 3: Train with height regularization loss:
           L_ground = ||gaussian_z - lidar_surface_z||^2
   Step 4: Add normal consistency loss forcing ground normals toward vertical
   Step 5: Separate ground optimization phase (HUGSIM train_ground.py pattern)
   ```

### 4.4 Airport-Specific Data Collection Strategy

**LiDAR Mapping:**
- Use vehicle-mounted LiDAR during normal operations to build PCD map
- Minimum: 32-beam LiDAR (Ouster OS1-32); ideal: 128-beam (OS2-128) or solid-state
- Coverage: drive all taxiways, apron areas, service roads
- Multiple passes for loop closure quality

**Camera Coverage:**
- Mount 6-8 cameras on mapping vehicle (surround view)
- Capture at 10-15 Hz during mapping runs
- Include different lighting conditions (dawn, midday, dusk, overcast)
- Ensure coverage of all key areas: gates, taxiway intersections, hold points

**Ground Truth for Validation:**
- Hold out 10-20% of camera frames for test set
- Record specific validation runs after reconstruction
- Place known targets (ArUco markers, surveyed GCPs) for absolute accuracy checks

---

## 5. Simulation Capabilities

### 5.1 Novel View Synthesis

The core capability: render what the AV cameras would see from any position/orientation within the reconstructed environment.

**Quality expectations for airport digital twin:**
- PSNR 25-28 dB for typical viewpoints (within training distribution)
- PSNR degrades 2-5 dB for extrapolated viewpoints (off trained trajectory)
- Ground markings (taxiway lines, hold bars) should be clearly legible
- Rendering speed: 30-100+ FPS at 1920x1080 on RTX 4090

**Extrapolation handling:**
- Airport AV routes are somewhat constrained (taxiways, aprons) but the AV must handle unexpected deviations
- HUGSIM's multi-plane ground model helps prevent ground distortion during extrapolation
- Training with aerial/drone imagery (Horizon-GS approach) provides top-down supervision that dramatically improves ground appearance from any angle

### 5.2 Synthetic LiDAR Ray Casting

Three approaches for generating synthetic LiDAR from the 3DGS digital twin:

**Approach A — Native LiDAR Rasterization (SplatAD / GS-LiDAR):**
- Directly render depth, intensity, ray-drop from Gaussian representation
- Models sensor-specific phenomena (beam pattern, rolling shutter)
- ~5-20 million rays/second
- Requires LiDAR-specific training with real LiDAR supervision

**Approach B — Mesh Extraction + Ray Casting (FGGS-LiDAR):**
- Convert trained 3DGS to watertight mesh via TSDF
- GPU-accelerated ray-triangle intersection at 500+ FPS
- No LiDAR-specific training needed (plug-and-play)
- Geometrically accurate but lacks learned intensity/ray-drop
- Can configure any LiDAR sensor model (Ouster, Velodyne, Hesai, etc.)

**Approach C — Hybrid:**
- Use FGGS-LiDAR mesh for geometric depth
- Use learned Gaussian attributes for intensity and ray-drop probability
- Apply sensor noise model as post-processing

**Recommendation for airport:**
Start with Approach B (FGGS-LiDAR) for rapid prototyping — build your 3DGS from camera+LiDAR, extract mesh, ray-cast with your specific LiDAR model. Graduate to Approach A (SplatAD-style native rasterization) when you need maximum realism for perception testing.

### 5.3 Dynamic Object Insertion

The static digital twin needs dynamic objects: aircraft, GSE vehicles, baggage tugs, fuel trucks, personnel.

**HUGSIM Approach:**
- Pre-reconstruct 100+ vehicle models from real captures (3DRealCar dataset)
- Each vehicle is a separate 3DGS model with 360-degree appearance
- Insert at arbitrary positions using rigid body transformation
- Add shadow Gaussians beneath vehicles for visual realism
- Motion follows unicycle model (bicycle model for ego) with IDM behavior

**For Airport:**
1. **Aircraft:** Reconstruct 3-5 representative aircraft types from walk-around captures or detailed CAD models; convert to 3DGS
2. **GSE Vehicles:** Capture pushback tugs, baggage carts, fuel trucks, de-icing vehicles from multiple angles; reconstruct as individual 3DGS assets
3. **Personnel:** Use human avatar 3DGS methods or simplified billboard representations
4. **Insertion Pipeline:**
   - Define spawn points and routes on the airport layout
   - Assign motion models (constant velocity, IDM, scripted scenarios)
   - Composite dynamic Gaussians with static background during rendering (Street Gaussians decomposition)

### 5.4 Weather Augmentation

**RainyGS (CVPR 2025):**
- Physics-based raindrop and shallow water simulation within 3DGS rendering
- Generates height maps with shallow-water simulation for dynamic water effects (puddles, splashes)
- Screen-space ray tracing for rain streaks, reflections, refraction
- 30+ FPS, controllable intensity from drizzle to heavy downpour
- Directly applicable to airside rain scenarios

**WeatherCity:**
- Text-guided weather editing using vision-language models
- Physics-driven simulation for rain, snow, and fog
- Controllable multi-weather transformation on reconstructed scenes
- Evaluated on Waymo and nuScenes benchmarks

**DrivingGaussian++:**
- Multi-task editing: texture modification, weather simulation, object manipulation
- Integrated into the driving scene reconstruction pipeline

**Airport Weather Scenarios:**
- **Rain:** RainyGS for wet tarmac reflections and rain streaks; critical for testing hydroplaning detection
- **Fog/Low Visibility:** Atmospheric scattering model applied to rendered views; reduce LiDAR range accordingly
- **Night:** Modify lighting conditions; add airport lighting (blue taxiway edge lights, green centerline lights)
- **Snow/Ice:** WeatherCity approach for surface texture modification; adjust friction models in simulation

### 5.5 Synthetic Sensor Data Generation Pipeline

```
For each simulation timestep:
  1. Compute ego vehicle pose from motion model / planner output
  2. Compute all dynamic object poses from behavior models
  3. Compose scene: static background Gaussians + dynamic object Gaussians
  4. Render:
     a. Camera images: standard 3DGS rasterization (gsplat)
     b. LiDAR point cloud: spherical rasterization (SplatAD) or mesh ray-cast (FGGS-LiDAR)
     c. Depth maps: weighted accumulation of Gaussian depths
     d. Semantic maps: softmax over per-Gaussian semantic logits
  5. Apply sensor noise models:
     a. Camera: exposure variation, motion blur, lens distortion
     b. LiDAR: range noise (~2cm), intensity noise, beam divergence
  6. Apply weather effects (if enabled):
     a. Rain streaks, wet surface reflections
     b. Fog attenuation (exponential decay with distance)
  7. Package as sensor messages (ROS2 format or custom)
  8. Feed to AV perception/planning stack
  9. Receive control commands, update ego pose
  10. Repeat
```

---

## 6. Closed-Loop Testing Pipeline

### 6.1 HUGSIM Architecture for Airport Adaptation

HUGSIM provides the most complete reference architecture for 3DGS-based closed-loop simulation.

**Communication Architecture:**
- Named pipes for same-machine simulator-to-AD-stack communication
- WebSockets for distributed setup
- Gymnasium environment interface for standardized interaction

**Rendering Pipeline:**
- Per-frame: update ego pose → update actor poses → composite scene → render all sensors → return observations
- Separate GPU for rendering vs. AD algorithm recommended
- Multi-modal output: RGB, depth, semantic, optical flow

**Ego Vehicle Model:**
- Discrete bicycle model: state = (x, y, theta, v)
- LQR controller converts planning waypoints to steering/acceleration
- Configurable vehicle parameters for different GSE types

**Actor Behavior:**
- Replayed trajectories from recorded data
- IDM (Intelligent Driver Model) for normal behavior
- Optimization-based aggressive behavior for safety testing

**Collision Detection:**
- BEV bounding box overlap for actor-actor collisions
- Gaussian counting within ego volume for background collisions (uses semantic segmentation to distinguish drivable/non-drivable)

### 6.2 Rendering Latency Budget

For a closed-loop sim running at 10 Hz (typical AV control rate):

| Component | Budget | Achievable |
|-----------|--------|------------|
| Scene composition | 2 ms | Yes (GPU transform) |
| Camera render (6 cameras, 1920x1080) | 20 ms | Yes (gsplat: ~100 MP/s → 12 MP total → ~120 ms for 6 cams on single GPU, but parallelizable) |
| LiDAR render (128 beams, 2048 pts/beam) | 5 ms | Yes (SplatAD: 5-20 MR/s → 262K rays → <50 ms; FGGS: <2 ms) |
| Weather effects | 3 ms | Yes (screen-space post-processing) |
| Sensor noise | 1 ms | Yes |
| Communication overhead | 1 ms | Yes (named pipes) |
| **Total per frame** | **~35 ms** | **Feasible at 10 Hz on 2x GPU setup** |

**Hardware recommendation for closed-loop airport sim:**
- Rendering GPU: RTX 4090 (24 GB) or A100 (40/80 GB) for large scenes
- AD stack GPU: Separate RTX 4090 or target deployment hardware (NVIDIA Orin)
- CPU: 16+ cores for scene management, actor behavior, communication
- RAM: 64+ GB for scene data streaming

### 6.3 Airport-Specific Closed-Loop Scenarios

Priority test scenarios for airside AV:

1. **Taxiway Navigation:** Follow taxiway centerline, respond to hold-short markings
2. **Ramp Area Operations:** Navigate among parked aircraft, avoid wingtips and jet blast zones
3. **Vehicle Interaction:** Yield to crossing GSE traffic, follow-the-leader convoys
4. **Pedestrian Safety:** Detect and stop for ground crew near aircraft
5. **Adverse Weather:** Rain-degraded LiDAR range, fog visibility reduction
6. **Night Operations:** Low-light camera performance, reliance on airport lighting
7. **Emergency Stop:** Sudden obstacle appearance (FOD, wildlife)
8. **Multi-Agent Coordination:** Multiple AVs sharing apron space

### 6.4 Evaluation Metrics (HD-Score Adaptation for Airport)

Adapting HUGSIM's HD-Score for airport operations:

**Safety (Multiplicative — must all pass):**
- No Collision (NC): zero contact with aircraft, structures, personnel
- Operational Area Compliance (OAC): stay within authorized movement areas
- Jet Blast Avoidance (JBA): maintain safe distance from active engines

**Performance (Weighted Average):**
- Route Completion: percentage of assigned route completed
- Time to Collision (TTC): minimum TTC during scenario
- Comfort: acceleration/jerk limits for baggage/passenger transport
- Speed Compliance: adhere to airside speed limits (typically 15-25 km/h)

---

## 7. Open-Source Tools: What Works Today vs. Research-Only

### 7.1 Production-Ready Today (Can build and run a pipeline)

| Tool | What It Does | Readiness | Notes |
|------|-------------|-----------|-------|
| **gsplat** | CUDA Gaussian rasterization | High | Core rendering engine; pip-installable; well-documented API |
| **Official 3DGS (INRIA)** | Reference training pipeline | High | Stable, well-tested; COLMAP input format; 24GB VRAM recommended |
| **OpenSplat** | C++ 3DGS training | High | Cross-platform (Windows/Mac/Linux); CPU fallback; AGPLv3 |
| **NeuRAD-Studio** | AD scene reconstruction | Medium-High | Docker available; PandaSet data loader works out of box; nerfstudio-based |
| **COLMAP** | SfM for pose estimation | High | Industry standard; but slow on large datasets |
| **SuperSplat** | Web-based 3DGS editor | High | View, edit, optimize .ply/.splat files in browser |

### 7.2 Usable with Effort (Need to adapt/integrate)

| Tool | What It Does | Readiness | Gap |
|------|-------------|-----------|-----|
| **HUGSIM** | Closed-loop driving sim | Medium | Pixi-based setup; needs custom data loaders for non-standard datasets; no native LiDAR rendering |
| **GS-LiDAR** | LiDAR point cloud synthesis | Medium | Conda setup documented; KITTI-360 data loader provided; adding new datasets requires work |
| **Street Gaussians** | Dynamic urban scenes | Medium | LiDAR init documented; requires tracked object annotations |
| **Hierarchical 3DGS** | Large-scale rendering | Medium | Code available; needs adaptation for custom scenes |
| **CityGaussian** | City-scale training | Medium | LoD rendering works; tile partitioning needs scene-specific tuning |
| **Grendel-GS** | Multi-GPU training | Medium | Requires multi-GPU setup; hyperparameter tuning for scaling |
| **FGGS-LiDAR** | 3DGS-to-LiDAR conversion | Medium | Plug-and-play design; mesh extraction quality depends on 3DGS quality |
| **DeSiRe-GS** | Static-dynamic decomposition | Medium | CVPR 2025; code on GitHub; Waymo data loader included |

### 7.3 Research-Only (Paper code, not pipeline-ready)

| Tool | What It Does | Status | Limitation |
|------|-------------|--------|------------|
| **SplatAD** | Joint camera+LiDAR rendering | Research | Full model code via neurad-studio "coming soon"; gsplat rendering kernels available |
| **LiDAR-GS** | LiDAR re-simulation | Research | Source available but limited documentation |
| **RainyGS** | Rain weather effects | Research | CVPR 2025 paper; code quality unclear |
| **WeatherCity** | Multi-weather transformation | Research | Recent paper; no confirmed open release |
| **DrivingGaussian** | Surround-view reconstruction | Research | CVPR 2024 code available but limited maintenance |
| **GaussianShader** | Reflective surface rendering | Research | CVPR 2024; useful for aircraft but integration non-trivial |
| **LiHi-GS** | Highway LiDAR-supervised GS | Research | First highway-specific method; code available |
| **LetsGo** | Large-scale LiDAR-assisted GS | Research | SIGGRAPH Asia 2024; GarageWorld dataset public |

### 7.4 Recommended Stack for Airport Digital Twin

**Phase 1 — Static Digital Twin (3-6 months):**
```
Data Collection → COLMAP/LiDAR-SLAM for poses
                → gsplat for training (LiDAR-initialized Gaussians)
                → Hierarchical 3DGS for scene merging
                → FGGS-LiDAR for synthetic LiDAR
                → SuperSplat for visualization/QA
```

**Phase 2 — Dynamic Simulation (6-12 months):**
```
Static Twin   → Street Gaussians / DeSiRe-GS for dynamic decomposition
              → HUGSIM architecture for closed-loop simulation
              → SplatAD LiDAR rendering (when code matures)
              → RainyGS for weather augmentation
              → Custom actor models for airport-specific vehicles
```

**Phase 3 — Production Simulator (12-18 months):**
```
Full Pipeline → Grendel-GS for full-airport training
              → Custom closed-loop sim with ROS2 integration
              → Multi-scenario generation and batch evaluation
              → CI/CD integration for AV stack regression testing
              → Hardware-in-the-loop with Orin deployment target
```

---

## 8. Key Technical Decisions and Recommendations

### 8.1 Gaussian Primitive Choice: 3D vs. 2D

- **3D Gaussians** (standard): Better for volumetric effects (vegetation, fences), but can produce floaters on flat surfaces
- **2D Gaussians** (GS-LiDAR, PGSR): Better for flat surfaces (ground, walls, aircraft fuselage panels); more geometrically accurate
- **Recommendation for airport:** Use 2D Gaussians for ground plane and building facades; 3D Gaussians for vegetation, fences, equipment. This can be achieved by surface-type-aware initialization.

### 8.2 Densification Strategy

- **Split/Clone (Original 3DGS):** Simple but unpredictable Gaussian count growth; can OOM on large scenes
- **MCMC (SplatAD):** Predictable compute budget; better far-field coverage; recommended for production
- **ADC / Absgrad (gsplat):** More aggressive densification in under-reconstructed regions

### 8.3 Training Scale and Tiling

For an airport with 2 km x 2 km operational area:
- Tile size: 200m x 200m = ~100 tiles
- Per-tile: 2-5M Gaussians, 1-2 hours training on A100
- Total: 200-500M Gaussians, 100-200 GPU-hours
- Active rendering: 3-5 tiles loaded simultaneously based on ego position
- Memory per active tile: ~4-10 GB (at ~2KB per Gaussian)

### 8.4 Data Format Standardization

Use glTF with KHR_gaussian_splatting extension (standardized August 2025) for interoperability:
- Export trained scenes to .glb/.gltf format
- Compatible with web viewers, game engines, and custom renderers
- Alternatively, .ply format remains the de facto standard in research code

---

## 9. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Texture-poor tarmac → poor appearance | High | LiDAR depth supervision; multi-view regularization; ground-specific training stage |
| Aircraft reflections → artifacts | Medium | GaussianShader integration; accept approximate reflections for perception testing |
| Scale → GPU memory limits | High | Hierarchical tiling; Grendel-GS distributed training; out-of-core rendering |
| Dynamic object quality | Medium | Dedicated per-object reconstruction; CAD model fallback for aircraft |
| Sim-to-real gap | High | Validate perception metrics (detection rate, false positives) on synthetic vs. real data |
| LiDAR simulation fidelity | Medium | FGGS-LiDAR for geometry + learned intensity models; validate Chamfer distance < 5cm |
| SplatAD code maturity | Medium | Start with gsplat + FGGS-LiDAR; migrate to SplatAD when neurad-studio release is stable |
| Weather effects realism | Low-Medium | RainyGS provides good rain; fog is simpler to model; snow is least critical for most airports |

---

## 10. References and Resources

**Core Methods:**
- SplatAD: https://github.com/carlinds/splatad / https://arxiv.org/abs/2411.16816
- GS-LiDAR: https://github.com/fudan-zvg/gs-lidar / https://arxiv.org/abs/2501.13971
- LiDAR-GS: https://arxiv.org/abs/2410.05111
- FGGS-LiDAR: https://github.com/TATP-233/FGGS-LiDAR / https://arxiv.org/abs/2509.17390
- LI-GS: https://arxiv.org/abs/2409.12899
- LiHi-GS: https://arxiv.org/abs/2412.15447

**Dynamic Scenes:**
- Street Gaussians: https://zju3dv.github.io/street_gaussians/ / https://arxiv.org/abs/2401.01339
- DeSiRe-GS: https://github.com/chengweialan/DeSiRe-GS / https://arxiv.org/abs/2411.11921
- DrivingGaussian: https://github.com/VDIGPKU/DrivingGaussian
- DAS3R: https://arxiv.org/abs/2412.19584
- T-3DGS: https://arxiv.org/abs/2412.00155
- DeGauss: https://batfacewayne.github.io/DeGauss.io/

**Large-Scale:**
- Hierarchical 3DGS: https://github.com/graphdeco-inria/hierarchical-3d-gaussians
- CityGaussian: https://dekuliutesla.github.io/citygs/
- Grendel-GS: https://github.com/nyu-systems/Grendel-GS
- LetsGo: https://github.com/zhaofuq/LOD-3DGS
- Horizon-GS: https://city-super.github.io/horizon-gs/

**Simulation:**
- HUGSIM: https://github.com/hyzhou404/HUGSIM
- UniSim: https://waabi.ai/unisim/
- NeuRAD-Studio: https://github.com/georghess/neurad-studio

**Tools:**
- gsplat: https://github.com/nerfstudio-project/gsplat
- Official 3DGS: https://github.com/graphdeco-inria/gaussian-splatting
- OpenSplat: https://github.com/pierotofy/OpenSplat
- SuperSplat: https://superspl.at/
- nerfstudio: https://docs.nerf.studio/

**Surface Quality / Reflections:**
- PGSR: https://arxiv.org/abs/2406.06521
- GaussianShader: https://asparagus15.github.io/GaussianShader.github.io/
- SuGaR: https://github.com/Anttwo/SuGaR

**Weather:**
- RainyGS: https://pku-vcl-geometry.github.io/RainyGS/
- WeatherCity: https://arxiv.org/abs/2602.22096
- DrivingGaussian++: https://arxiv.org/abs/2508.20965

**Airport Digital Twin Context:**
- Autonoma Airport Simulation: https://www.autonoma.ai/
