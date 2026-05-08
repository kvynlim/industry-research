# Synthetic Data Generation for Autonomous Driving: Bootstrapping an Airside Dataset

## Executive Summary

Synthetic data generation has become a critical enabler for autonomous driving development, offering scalable dataset creation, automatic annotation, and the ability to cover rare or dangerous scenarios that cannot be safely captured in the real world. For airport airside autonomous vehicles (AVs), synthetic data is especially important: airside environments are restricted, making real data collection expensive and logistically constrained, while the operational design domain (ODD) involves unique object classes (baggage tugs, pushback tractors, ground power units) and surface geometries (taxiways, aprons, service roads) poorly represented in public driving datasets.

This report surveys the state of the art across seven interrelated pillars --- video diffusion models, LiDAR point cloud generation, domain randomization, procedural airport scene construction, point cloud augmentation, sim-to-real gap quantification, and LLM-driven scenario generation --- then synthesizes a practical airside pipeline from AIXM geometry all the way to training data.

---

## 1. Video Diffusion for Driving Data

### 1.1 NVIDIA Cosmos World Foundation Models

NVIDIA Cosmos is a platform of open-weight world foundation models (WFMs) purpose-built for physical AI, including autonomous vehicles. The models were trained on approximately 20 million hours of video (100M clips after curation) across driving (11% of training mix), manipulation, human motion, and spatial navigation categories, using 10,000 H100 GPUs over three months.

**Architecture.** Cosmos offers two complementary model families:

- **Diffusion-based WFMs** (7B and 14B parameters): Latent diffusion models operating on continuous tokens from a CV8x8x8 tokenizer. Support Text2World and Video2World generation modes.
- **Autoregressive WFMs** (4B--13B parameters): GPT-style models using discrete tokens from a DV8x16x16 tokenizer with 64,000-entry FSQ codebook. Generate video through sequential token prediction.

Both families support text-to-world and video-to-world conditioning. Cosmos Predict 2.5, built on a flow-based architecture, unifies Text2World, Image2World, and Video2World in a single model and supports sequences up to 30 seconds.

**Tokenizer.** Cosmos Tokenizers use temporally causal encoder-decoder designs with wavelet transforms and spatio-temporal factorized convolutions. They achieve a 4 dB PSNR improvement in reconstruction quality on DAVIS videos and 12x faster encoding than competing tokenizers.

**Fine-tuning for domain adaptation.** Cosmos supports post-training on proprietary data with documented recipes for camera control conditioning, robotic manipulation, and autonomous driving. NVIDIA reports up to 10x higher accuracy on domain-specific tasks after post-training on proprietary data.

**Cosmos-Drive-Dreams.** This is the production-grade synthetic driving data pipeline built on Cosmos. It uses a prompt rewriter to generate diverse prompts, synthesizes single-view videos, expands to multi-view, and applies a VLM-based rejection filter for quality control. The pipeline produces multi-view, spatiotemporally consistent driving video with automatic 3D labels.

Published results on RDS-HQ and Waymo Open datasets include:

| Task | Dataset | Baseline | + Synth Data | Improvement |
|------|---------|----------|-------------|-------------|
| 3D Lane Detection (F1) | RDS-HQ 2k | 0.428 | 0.451 | +5.4% |
| 3D Lane Detection -- Foggy | RDS-HQ 2k | 0.402 | 0.455 | +13.2% |
| 3D Lane Detection -- Rainy | RDS-HQ 2k | 0.378 | 0.404 | +6.9% |
| 3D Lane Detection -- Night | RDS-HQ 2k | 0.532 | 0.566 | +6.4% |
| 3D Object Detection (mAP) | RDS-HQ 2k | 0.299 | 0.337 | +12.7% |
| 3D Object Detection -- Foggy | RDS-HQ 2k | 0.265 | 0.308 | +16.2% |
| 3D Object Detection (mAP) | RDS-HQ 20k | 0.459 | 0.489 | +6.5% |
| LiDAR Detection (mAP) | RDS-HQ 1k | 0.240 | 0.250 | +4.2% |

Data mixing ratio used: Rs2r = 0.5 (equal synthetic-to-real). Gains are most pronounced in low-data regimes and adverse weather conditions.

The pipeline, model weights, and a dataset of 81,802 synthetic clips are open-sourced.

### 1.2 Other Video Diffusion Models for Driving

**DriveDreamer / DriveDreamer-2.** DriveDreamer is a world model entirely derived from real-world driving scenarios. It uses ActionFormer to predict road structural features in latent space, which condition Auto-DM for future driving video generation. DriveDreamer-2 adds LLM-driven scenario specification: GPT-3.5 is fine-tuned on 18 driving behavior functions to convert natural language descriptions into executable trajectory scripts. A diffusion model then generates HD maps conditioned on those trajectories, and a Unified Multi-View Video Model (UniMVM) produces multi-view video. DriveDreamer-2 achieved FID 11.2 (~30% improvement) and FVD 55.7 (~50% improvement) over prior methods. Downstream: 3D detection mAP improved 3.8%, multi-object tracking AMOTA improved 8.3%.

**MagicDrive / MagicDrive-V2.** MagicDrive generates street-view images with diverse 3D geometry controls including camera poses, road maps, and 3D bounding boxes. MagicDrive-V2 (ICCV 2025) extends this to multi-view driving video at 3.3x higher resolution and 4x longer frame count than prior SOTA. Both condition on BEV representations for precise geometric control.

**DriveScape.** An end-to-end framework for multi-view, 3D condition-guided video generation at 1024x576 resolution and 10 Hz. Achieved FID 8.34 and FVD 76.39 on nuScenes.

**GAIA-1.** A transformer-based world model from Wayve that predicts next states from video, text, and action signals. Uses a world-model architecture to generate realistic driving scenarios from multimodal inputs.

**Sora-like models.** OpenAI's Sora demonstrates that scaling video generation models on diverse data yields emergent physical world simulation capabilities. While Sora itself is not driving-specific, its architectural principles (diffusion transformer on spacetime patches) have influenced all subsequent driving video generators. Limitations remain in consistent physics simulation, particularly for complex multi-agent interactions.

### 1.3 NeRF-Based View Synthesis

Neural Radiance Fields offer an alternative to pure video diffusion for synthetic view generation:

- **PC-NeRF**: Uses sparse LiDAR frames for large-scale 3D scene reconstruction and novel LiDAR view synthesis.
- **HarmonicNeRF**: Geometry-informed synthetic view augmentation for driving 3D reconstruction, addressing sparse viewpoint challenges.
- **UC-NeRF**: Handles under-calibrated multi-camera setups common in AV sensor rigs.

NeRFs are particularly useful for creating additional training views from existing logged drives, effectively multiplying dataset size without new data collection.

---

## 2. LiDAR Point Cloud Generation

### 2.1 LiDARGen

LiDARGen (Zyrianov et al., ECCV 2022) was the first generative model for realistic LiDAR point clouds. It uses a score-matching energy-based model and formulates generation as a stochastic denoising process in equirectangular view. Key properties:

- Unconditional and conditional generation without retraining
- Validated on KITTI-360 and nuScenes
- Can densify sparse LiDAR scans

**Limitation:** Extremely slow sampling at 0.02 samples/second on an RTX 3090. Degraded geometric detail at far range.

### 2.2 UltraLiDAR

UltraLiDAR uses a Bird's-Eye-View (BEV) voxel grid representation with VQ-VAE for discrete latent space modeling. It generates structured, reasonable scenes with better quality than LiDARGen. However:

- Produces only voxelized point clouds without intensity features
- Introduces quantization losses
- Slow generation at 0.16 samples/second

### 2.3 RangeLDM

RangeLDM (ECCV 2024) is the current state of the art for LiDAR point cloud generation. Key innovations:

- **Hough Voting** for sensor height and pitch angle estimation, correcting range-view data distribution (improves LiDARGen's MMD from 3.87x10^-4 to 1.41x10^-4)
- **VAE + Latent Diffusion**: Compresses 64x1024 range images into latent features (4x downsample), then applies UNet-based diffusion with transformer layers
- **Range-guided discriminator** using Meta-Kernel convolutions that learn weights from relative spherical coordinates

Performance comparison:

| Model | MMD (KITTI-360) | Speed (samples/s) | Relative Speed |
|-------|----------------|--------------------|----------------|
| LiDARGen | ~10^-4 | 0.02 | 1x |
| UltraLiDAR | ~10^-4 | 0.16 | 8x |
| RangeLDM | 3.07x10^-5 | 4.86 | 243x |

RangeLDM is 200x faster than LiDARGen and 30x faster than UltraLiDAR, while achieving an order-of-magnitude better MMD score. Downstream results include MAE of 0.89 for 4x upsampling and MAE of 0.190 for inpainting (vs LiDARGen's 0.367).

### 2.4 LaGen: Autoregressive LiDAR Scene Generation

LaGen (2025) is the first framework for frame-by-frame autoregressive generation of long-horizon LiDAR scenes. Starting from a single-frame LiDAR input and bounding box conditions, it generates high-fidelity 4D scene point clouds. Key modules include scene decoupling estimation for interactive object-level generation and noise modulation to mitigate long-horizon error accumulation. Demonstrates superior performance on nuScenes, especially on later frames in long sequences.

### 2.5 LidarDM and Other Approaches

LidarDM proposes generative LiDAR simulation within a generated world, combining layout generation with LiDAR rendering. Additional approaches include LiDARDraft (generating LiDAR from versatile inputs) and diffusion models operating directly on range images.

### 2.6 Relevance to Airside

Airport airside LiDAR data presents unique challenges: flat terrain with minimal elevation variation, unique reflectivity profiles from tarmac surfaces, sparse but highly structured environments (taxiway edges, apron markings), and unusual object geometries (aircraft, GSE). RangeLDM's speed makes it practical for generating large-scale augmentation datasets, but fine-tuning on airside-specific range image distributions would be essential.

---

## 3. Domain Randomization Strategies for Airside

### 3.1 Core Principles

Domain randomization trains models on synthetic data with randomized environmental parameters to extract invariant features that transfer to real-world deployment. The hypothesis: if the model sees enough variation in simulation, real-world data becomes just another variation.

Key parameters for randomization:

- **Visual**: Texture, lighting direction/intensity/color, sky/weather, camera intrinsics/extrinsics
- **Geometric**: Object placement, scale, orientation, occlusion patterns
- **Physical**: Surface reflectance (BRDF), motion blur, lens distortion, sensor noise

### 3.2 Structured Domain Randomization (SDR)

Pure random placement produces physically implausible scenes. SDR uses real-world spatial priors to constrain randomization:

- Objects placed on ground planes, not floating
- Vehicle orientations aligned with road directions
- Pedestrian positions on sidewalks/crossings
- Contextually appropriate object co-occurrences

SDR has been shown to produce improved out-of-distribution generalization compared to unconstrained randomization.

### 3.3 Meta-Sim

Meta-Sim aims to close the "content gap" by learning to generate task-specific synthetic datasets. It uses a neural network to modify scene attributes (object placement, appearances) to maximize downstream task performance, demonstrated on self-driving car training.

### 3.4 Published Effectiveness

A critical finding: models trained solely on randomization-based synthetic data can outperform those trained on photorealistic synthetic datasets, and when fine-tuned with limited real data, can surpass models trained on real data alone. This suggests that diversity of variation matters more than individual frame realism.

### 3.5 Airside-Specific Randomization Strategy

For airport airside environments, the following randomization axes are most impactful:

**Lighting and Weather:**
- Time of day (airports operate 24/7 with dramatic lighting changes from apron floodlights)
- Weather: rain on tarmac (specular reflections), fog (common at airports), snow/ice on surfaces
- Jet blast heat shimmer near aircraft engines
- Sun glare off aircraft fuselage and terminal glass

**Object Variation:**
- GSE type diversity: baggage tugs (open/closed cab), belt loaders, pushback tractors, fuel trucks, catering trucks, GPU units, lavatory service vehicles, de-icing trucks
- Aircraft livery randomization across airlines
- GSE fleet age/condition/paint variation
- Worker PPE configurations (hi-vis vest colors, hard hats)

**Scene Configuration:**
- Gate assignment density (busy vs quiet periods)
- Aircraft type variation at gates (narrow-body vs wide-body geometry)
- Baggage cart train lengths (1-6 carts)
- FOD (foreign object debris) placement on taxiways
- Temporary construction zones with cones and barriers

**Sensor Configuration:**
- LiDAR mounting height variation (different vehicle platforms)
- Camera mounting position jitter (vibration simulation)
- Sensor degradation (rain drops on lens, LiDAR in fog)

---

## 4. Procedural Airport Scene Generation from AIXM/AMXM Geometry

### 4.1 AIXM and AMXM Data Standards

**AIXM (Aeronautical Information Exchange Model)** is a GML 3.2.1-based standard developed by the FAA, NGA, and EUROCONTROL for managing and distributing aeronautical information in digital format. It encodes airport area data, airspace structures, navaids, procedures, and routes. AIXM 5.1 uses OGC GML for positional and shape data, implementing the ISO 19107 spatial schema with geometry types including points, lines, and polygons.

**AMXM (Aerodrome Mapping Exchange Model)** is a EUROCAE WG-44 / RTCA SC-217 specification for Aerodrome Mapping Databases (AMDB). It consists of a UML model and derived XML Schema based on ISO/OGC GML 3.2. AMXM describes the spatial layout of an aerodrome through features with geometry (points, lines, polygons) and attributes (surface type, elevation).

AMDB feature classes include:
- Runways (with thresholds, designators, surface types)
- Taxiways (centerlines, edges, holding positions)
- Aprons (parking stands, service road boundaries)
- Vertical structures (buildings, control towers, hangars)
- Surface lighting (edge lights, centerline lights, stop bars)
- Hotspots (areas of increased collision risk)

Data can be consumed via OGC Web Feature Service (WFS) for programmatic access, and tools like FME and ArcGIS Pro support AIXM 5.1 import and transformation.

### 4.2 AIXM-to-3D-Scene Pipeline

The following pipeline converts AIXM/AMXM geometry into training-ready synthetic scenes:

**Step 1: Geometry Extraction and Processing**
```
AIXM/AMXM XML --> GML Parser --> GIS Features (Shapely/GeoPandas)
  - Extract runway polygons, taxiway centerlines/edges, apron boundaries
  - Extract vertical structures (hangars, terminals) with height attributes
  - Extract parking stand points with orientation and aircraft type constraints
  - Extract surface lighting positions and types
```

**Step 2: Terrain and Surface Generation**
```
GIS Features --> Procedural Terrain Generator
  - Flat terrain mesh from aerodrome boundary polygon
  - Surface material assignment: concrete (runways), asphalt (taxiways/aprons), grass (infields)
  - Taxiway/runway marking generation from centerline geometry and ICAO standards
  - Painted hold-short lines, lead-in lines, stand markings from AMDB attributes
```

**Step 3: Vertical Structure Placement**
```
Building Footprints + Heights --> 3D Extrusions or Parametric Models
  - Terminal buildings from footprint polygons with procedural facade generation
  - Hangars from rectangular footprints with arched roof profiles
  - Control towers with procedural glass cab generation
  - Jet bridges placed at gate positions with articulated geometry
```

**Step 4: Dynamic Object Placement**
```
Parking Stand Points --> Scenario Configuration
  - Aircraft placement: sample aircraft type, sample airline livery
  - GSE placement: context-aware positioning using service road geometry
  - Worker placement: near active service positions
  - Baggage cart trains: along service road paths
```

**Step 5: Sensor Simulation and Rendering**
```
Configured Scene --> Sensor Simulator
  - Camera rendering with physically-based materials and ray tracing
  - LiDAR simulation with raycasting, beam divergence, and intensity modeling
  - Automatic ground truth: 2D/3D bounding boxes, semantic segmentation, depth, optical flow
```

### 4.3 Tools for Procedural Generation

**Infinigen** is a procedural generation framework that creates photorealistic 3D scenes from randomized mathematical rules. It outputs annotated datasets with RGB, metric depth, surface normals, occlusion boundaries, panoptic segmentation, 3D bounding boxes, and optical flow in standard formats. While not airport-specific, its procedural architecture is extensible to custom domains.

**Houdini + Solaris** provides industrial-strength procedural content generation with native USD output, suitable for airport scene parametric modeling.

**NVIDIA Omniverse** with USD provides the rendering and simulation backbone (discussed in Section 8).

**AirTOP** is specialized airport simulation software that accurately models airside operations, including GSE vehicle movements, but is designed for operational analysis rather than perception data generation.

---

## 5. Point Cloud Augmentation Techniques

### 5.1 Ground-Truth Sampling (GT-Paste)

GT-sampling is the most widely used point cloud augmentation technique in 3D object detection. The process:

1. Build a database: extract all 3D ground-truth boxes and their enclosed LiDAR points from the training set
2. During training: randomly sample objects from the database and paste them into the current scene
3. Collision check: ensure no two pasted boxes intersect

**Published improvements:**

| Model | Class | With GT-Sampling | With GT+FP Sampling | Improvement |
|-------|-------|-----------------|-------------------|-------------|
| SECOND | Car | ~80% | 82.16% | ~2% |
| SECOND | Pedestrian | ~55% | 57.22% | ~2% |
| SECOND | Cyclist | ~65% | 67.31% | ~2% |
| PointPillars | Pedestrian | 49.22% | 52.08% | +2.86pp |

Context-guided GT sampling further improves results by using scene context (image and point cloud) to guide paste locations and filtering, achieving a relative 15% improvement over standard GT sampling on benchmarks, with ablation studies showing +2.81% gain.

**Relevance to airside:** GT-sampling is directly applicable for augmenting rare airside objects (e.g., de-icing trucks, aircraft tugs) by building a GT database from limited real collections and pasting them into diverse scene contexts.

### 5.2 Copy-Paste Augmentation

Copy-paste extends GT-sampling to multi-modal settings. Objects (point clouds + corresponding image patches) are copied from one scene and pasted into another, with:
- Occlusion handling (removing points behind pasted objects)
- Shadow and ground plane consistency
- Multi-modal alignment between LiDAR points and camera pixels

### 5.3 PointMixup

PointMixup (ECCV 2020) generates new training examples by interpolating between two point clouds via optimal assignment. It finds the shortest path between point clouds using assignment-invariant linear interpolation, creating smooth transitions between objects. Particularly effective when training examples are scarce and for improving robustness to noise and geometric transformations. Focuses on object-level augmentation.

### 5.4 PolarMix

PolarMix (NeurIPS 2022) is a cross-scan augmentation strategy for LiDAR semantic segmentation that operates in polar coordinates:

1. Randomly divide the field of view into azimuth regions
2. Swap all points within selected angular intervals between two scans
3. Optionally apply instance-level rotation and paste

Published results demonstrate:
- Consistent best performance across two baseline networks and three benchmarks
- Can achieve equivalent segmentation mIoU using only 75% of SemanticKITTI data (compared to 100% without PolarMix)
- Under 10% label noise: 44.12% mIoU on SemanticKITTI vs 32.99% baseline (+11.13pp)
- nuScenes: 33.48% vs 21.76% baseline (+11.72pp)

### 5.5 PillarMix / CAPMix

Class-Aware PillarMix (CAPMix) applies MixUp at the pillar level in 3D point clouds, guided by class labels. Uses a beta distribution to sample mix ratios. Targets the specific challenge of class imbalance in 3D detection datasets.

### 5.6 Progressive Population Based Augmentation (PPBA)

Waymo's automated augmentation approach uses evolutionary search to find optimal augmentation policies. Key finding: PPBA is up to 10x more data-efficient than training without augmentation. The cut-and-paste strategy is particularly effective with limited training data, though gains diminish with large annotation volumes.

### 5.7 Augmentation Strategy for Airside

Recommended augmentation stack for airside 3D detection:

1. **GT-Paste** with airside-specific GT database (GSE, aircraft nose gear, workers, baggage carts)
2. **PolarMix** for LiDAR segmentation models processing taxiway/apron surfaces
3. **Context-guided placement** constrained by taxiway/apron geometry from AIXM data
4. **Class-balanced sampling** to address severe class imbalance (rare GSE types vs common baggage tugs)

---

## 6. Sim-to-Real Gap Quantification and Mixing Ratios

### 6.1 Quantifying the Gap

The sim-to-real gap is the distributional shift between synthetic training data and real-world deployment data, causing models to overfit to simulation artifacts. Recent work proposes systematic metrics:

**Style Embedding Distribution Discrepancy (SEDD):** Combines Gram matrix-based style extraction with metric learning optimized for intra-class compactness and inter-class separation. Provides a single scalar metric quantifying the stylistic gap between synthetic and real datasets.

**Multi-modal evaluation** using 12 image similarity metrics:
- Pixel-level: PSNR, MSE
- Structural: SSIM, normalized mutual information
- Perceptual: deep feature distance (LPIPS-like)
- Distributional: FID, Wasserstein distance

The gap is multidimensional, encompassing perception gaps (visual/sensor fidelity), behavioral gaps (agent dynamics), and actuation gaps (vehicle response characteristics).

### 6.2 Published Mixing Ratio Results

**Cosmos-Drive-Dreams (NVIDIA, 2025):**
- Mixing ratio: Rs2r = 0.5 (50/50 synthetic:real by volume)
- Low-data regime (2k real clips): +6.0% to +16.2% improvement across tasks
- High-data regime (20k real clips): +6.5% improvement in 3D detection mAP

**Unraveling Effects of Synthetic Data (ICCV 2025):**
- Small real dataset (8k samples) + 2k synthetic: 15% reduction in planning L2 error
- Larger real dataset (28k samples) + 2k synthetic: 5% reduction in planning L2 error
- VAD model: route completion improved from 42.01% to 53.03% (+26% absolute)
- Vehicle collision rate: 7.55% to 3.43% (-55% relative)
- Key finding: "synthetic data significantly improves planning performance when the real training set is small" with "diminishing returns at larger scales"

**SynAD (ICCV 2025):**
- 500 synthetic scenes added to real training: ~30% reduction in L2 planning error, ~56% reduction in collision rate
- Motion forecasting minADE improved from 0.75 to 0.69 (-8%)
- Achieves lowest collision rate (0.11%) among all baselines

**NVIDIA DRIVE Sim Replicator:**
- Far-field detection (190-200m): 33% improvement in F1 score
- Generated ~92,000 synthetic images with ~371,000 car instances
- Added to baseline of 1M+ real images
- Synthetic data intentionally concentrated on underrepresented distance ranges (150m+)

**2D Object Detection (KITTI mixtures):**
- 50/50 synthetic:real (BIT-TS + KITTI MIX++): 66.2 mAP@50 vs 64.1 real-only (+2.1pp)
- Cross-dataset generalization: 3.4x improvement when testing on BDD100K

**DriveDreamer-2:**
- 3D detection mAP improved 3.8%, NDS improved 4.4%
- Multi-object tracking AMOTA improved 8.3%

### 6.3 Key Principles for Mixing

1. **Marginal returns decrease with real data volume.** Synthetic data provides the most value when real data is scarce (classic for airside, where data collection is expensive and restricted).

2. **Targeted augmentation outperforms blanket augmentation.** NVIDIA's far-field focus (synthetic data concentrated at 150m+) yielded 33% F1 improvement precisely because it filled a real data gap, not because it duplicated existing distributions.

3. **Adverse conditions benefit most.** Foggy/rainy/night synthetic augmentation consistently shows the highest gains (+9--16%), because these conditions are naturally underrepresented in real collections.

4. **Quality filtering is essential.** Cosmos-Drive-Dreams uses VLM-based rejection sampling. Unfiltered synthetic data can degrade performance.

5. **Practical starting ratio: 50/50 synthetic:real by volume**, adjusting based on downstream task validation. Start with 1:1 and ablate.

### 6.4 Implications for Airside

Airport airside is a textbook case for synthetic data: severely constrained real data collection, well-defined ODD geometry, and a long tail of rare events (aircraft pushbacks, emergency vehicle incursions, FOD encounters). The published evidence strongly suggests that even a modest airside synthetic dataset (hundreds of scenes) combined with limited real data will significantly outperform real-only training, particularly for rare object classes and adverse weather conditions.

---

## 7. LLM-Driven Scenario Generation

### 7.1 Overview

Large language models are being used to bridge the gap between natural-language operational requirements and executable simulation scenarios. The key insight: instead of hand-coding thousands of scenario permutations, describe them in natural language and let an LLM generate simulation scripts.

### 7.2 Key Frameworks

**DriveDreamer-2 (LLM-to-Trajectory-to-Video):**
- Fine-tunes GPT-3.5 on 18 driving behavior functions (steering, acceleration, braking, pedestrian actions)
- Converts natural language ("a vehicle cuts in from the left lane") into Python scripts generating motion trajectories
- These trajectories condition a diffusion model for HD map generation, then multi-view video synthesis
- Three-stage pipeline: Trajectory Generation --> HDMap Generation --> Video Synthesis

**OmniTester:**
- Fully automated pipeline that generates test scenarios from user requests
- Creates realistic road geometries using prompt engineering and SUMO integration
- Targets specific AV functionality testing

**Text2Scenario:**
- LLM-based framework converting natural language inputs into OpenSCENARIO simulation scripts
- Autonomously generates scenarios aligned with user specifications

**LLM4AV:**
- Text-to-simulation pipeline outputting ASAM OpenSCENARIO 1.x format
- Uses domain DSL and rule-based map retrieval for OpenDRIVE road geometry
- Processes open-ended descriptions into structured scenario specifications

**LEADE:**
- LLM-enhanced adaptive evolutionary search for ADS testing
- Uses Tree of Thoughts strategy for scenario outlining
- Red-teaming-inspired refinement for accuracy and robustness
- Generates safety-critical and diverse test scenarios

**Risk2Scenario:**
- Hierarchical risk analysis to identify safety-critical scenarios
- LLM translates risk descriptions into executable simulation configurations

**TrafficComposer:**
- Multi-modal input: natural language + traffic scene image
- Generates corresponding scenarios in CARLA or LGSVL simulators

### 7.3 Pipeline Architecture Pattern

The dominant pattern across frameworks is:

```
Natural Language Description
  --> LLM (fine-tuned on domain DSL / function library)
  --> Structured Scene Representation (trajectories, OpenSCENARIO, Python scripts)
  --> Simulation Engine (CARLA, SUMO, DRIVE Sim)
  --> Sensor Data + Ground Truth Labels
```

Key capability: chain-of-thought reasoning enables the LLM to adjust scenario difficulty based on performance metrics, creating a curriculum learning loop.

### 7.4 Limitations

- Static elements (weather, road layout) are well-captured
- Dynamic elements (realistic vehicle/pedestrian behavior) require further refinement
- LLM hallucination can produce physically impossible scenarios (requiring validation)
- Current frameworks focus on on-road driving; airside-specific function libraries would need to be developed

### 7.5 Airside Scenario Generation with LLMs

An airside-specific LLM scenario generator would require:

**Custom function library covering:**
- Aircraft pushback maneuvers (with tug attachment/detachment)
- Baggage cart train movement along service roads
- Fuel truck approach and departure from aircraft
- Marshaller/wing-walker pedestrian behavior
- Emergency vehicle incursion scenarios
- FOD encounter and avoidance
- Aircraft taxi movement at gate vicinity
- Multiple GSE servicing an aircraft simultaneously

**Prompt templates derived from:**
- ICAO Annex 14 aerodrome design standards
- FAA AC 150/5210-20A ground vehicle operations
- Airport-specific Standard Operating Procedures (SOPs)
- Incident/accident reports from ASRS (Aviation Safety Reporting System)

---

## 8. NVIDIA Omniverse Replicator for Synthetic Data

### 8.1 Architecture

Omniverse Replicator is a synthetic data generation engine comprising six core components:

1. **Semantic Schema Editor**: Assigns semantic labels to 3D assets and primitives for annotation during rendering
2. **Visualizer**: Displays annotations including 2D/3D bounding boxes, normals, and depth maps
3. **Randomizers**: Domain randomization across scenes, assets, materials, lighting, and camera positions
4. **Omni.syntheticdata**: Low-level integration with RTX Renderer managing Arbitrary Output Variables (AOVs)
5. **Annotators**: Process AOVs to generate labeled annotations for DNN training
6. **Writers**: Convert images and annotations into DNN-specific training formats (KITTI, COCO, etc.)

Built on USD, PhysX, and MDL, Replicator generates physically accurate datasets through ray tracing and path tracing with RTX technology.

### 8.2 DRIVE Sim Integration

NVIDIA DRIVE Sim uses Replicator to provide AV developers with synthetic data generation capabilities:

- Control over weather, lighting, pedestrians, road debris, and traffic composition
- Deterministic and repeatable dataset generation
- Scene construction tools maintaining real-world context
- Support for specifying distributions (e.g., specific mix of vehicle types)

Published results:
- PathNet (drivable lane detection): significantly improved accuracy for off-centered vehicle positions after training on millions of synthetic images
- LightNet (traffic light detection): resolved misclassification at extreme viewing angles
- Far-field object detection: 33% F1 score improvement at 190-200m range

### 8.3 Scalability

Omniverse Farm enables distributed generation across multiple workstations or servers. Integration with TAO Toolkit enables transfer learning workflows on generated synthetic data with reduced training time.

### 8.4 Applicability to Airside

Omniverse Replicator is well-suited for airside synthetic data because:

- USD scene format supports importing airport geometry from CAD/GIS sources
- PhysX enables realistic GSE vehicle dynamics simulation
- RTX rendering produces high-fidelity camera and LiDAR sensor simulation
- Domain randomization is built-in and scriptable
- Annotation pipeline automatically produces training-ready labels

The main gap is the absence of airport-specific 3D assets (GSE, aircraft, airside infrastructure), which would need to be created or sourced. Companies like MK Studios produce licensed 3D airports for flight simulation that could potentially serve as a starting point.

---

## 9. Published Effectiveness Results: Accuracy vs Percentage Synthetic

### 9.1 Summary Table of Key Results

| Study | Task | Real Data | Synthetic Addition | Metric | Improvement |
|-------|------|-----------|-------------------|--------|-------------|
| Cosmos-Drive-Dreams | 3D Detection | 2k clips | 50% synthetic | mAP | +12.7% |
| Cosmos-Drive-Dreams | 3D Lane (Fog) | 2k clips | 50% synthetic | F1 | +13.2% |
| Cosmos-Drive-Dreams | 3D Detection | 20k clips | 50% synthetic | mAP | +6.5% |
| ICCV 2025 (E2E AD) | Planning | 8k samples | 2k synthetic | L2 error | -15% |
| ICCV 2025 (E2E AD) | Planning | 28k samples | 2k synthetic | L2 error | -5% |
| ICCV 2025 (E2E AD) | Route Completion | Full | Synthetic augment | Completion | +26% absolute |
| SynAD (ICCV 2025) | Planning + Safety | Full | 500 scenes | Collision rate | -56% |
| DRIVE Sim Replicator | Far-field Detection | 1M+ images | 92k images | F1 (190-200m) | +33% |
| DriveDreamer-2 | 3D Detection | Full | Video augment | mAP | +3.8% |
| DriveDreamer-2 | MOT | Full | Video augment | AMOTA | +8.3% |
| BIT-TS + KITTI | 2D Detection | 6k frames | 6k synthetic | mAP@50 | +2.1pp |
| Waymo PPBA | 3D Detection | Variable | Automated augment | Data efficiency | 10x |
| PolarMix | Segmentation | 100% data | Augmentation | mIoU | 75% data = 100% perf. |
| Airport Navigation* | Object Detection | Real images | MSFS synthetic | Combined accuracy | Outperforms single-source |

*The airport navigation study validated synthetic data from Microsoft Flight Simulator 2020, finding that models trained on combined real + synthetic airport imagery outperform single-source training.

### 9.2 Scaling Laws

The evidence reveals consistent scaling behavior:

1. **Low-data regime** (< 5k real samples): Synthetic data provides 10--16% improvements across metrics
2. **Medium-data regime** (5k--20k real samples): Synthetic data provides 5--8% improvements
3. **High-data regime** (> 20k real samples): Synthetic data provides 2--5% improvements, primarily for edge cases
4. **Targeted augmentation** (filling specific gaps): Can provide 25--33% improvements regardless of overall data volume

### 9.3 Diminishing Returns Curve

The relationship between synthetic data fraction and downstream performance follows a logarithmic curve: initial additions of synthetic data yield large gains, with diminishing marginal returns as the synthetic fraction increases. The optimal operating point depends on:

- Quality of the synthetic data pipeline
- Similarity between synthetic and target domain
- Task complexity (end-to-end planning benefits more than isolated detection)
- Presence of domain gap mitigation (domain adaptation, style transfer)

---

## 10. Step-by-Step Airside Synthetic Data Pipeline: AIXM to Training Data

### 10.1 Pipeline Overview

```
Phase 1: Scene Foundation (AIXM/AMXM --> 3D World)
Phase 2: Asset Population (GSE, Aircraft, Personnel)
Phase 3: Scenario Generation (LLM-driven operational scenarios)
Phase 4: Sensor Simulation (Multi-modal rendering)
Phase 5: Domain Randomization (Variation injection)
Phase 6: Quality Assurance (Filtering and validation)
Phase 7: Training Integration (Mixing with real data)
```

### 10.2 Phase 1: Scene Foundation

**Input:** AIXM 5.1 / AMXM XML dataset for target airport

**Processing Steps:**

1. Parse AIXM/AMXM XML using a GML-compatible parser (e.g., lxml with OGC GML bindings, or FME)
2. Extract feature classes into GeoDataFrames:
   - `RunwayElement` polygons with surface type attributes
   - `TaxiwayElement` polygons and centerline geometries
   - `ApronElement` polygons with parking stand points
   - `VerticalStructure` footprints with height attributes
   - `RunwayMarking`, `TaxiwayMarking` line geometries
   - `StandGuidanceLine` for aircraft parking guidance
   - `ServiceRoad` polygons for GSE traffic routes
   - `AerodromeBeacon`, `SurfaceLighting` point features
3. Reproject to local ENU (East-North-Up) coordinate frame centered on aerodrome reference point
4. Generate terrain mesh from aerodrome boundary polygon (flat for most airports, with micro-topography from DEM if available)
5. Apply surface materials:
   - PCC (Portland Cement Concrete) for runways and high-traffic taxiways
   - Asphalt for aprons, taxiways, service roads
   - Grass/dirt for infield areas
   - Painted markings from marking geometries (white for runways, yellow for taxiways per ICAO Annex 14)
6. Extrude vertical structures from footprint polygons using height attributes
7. Export as USD scene for Omniverse, or glTF/FBX for other engines

**Output:** Base 3D airport scene with correct geometry, surfaces, and static structures

### 10.3 Phase 2: Asset Population

**3D Asset Library Requirements:**

| Category | Assets Needed | Source Strategy |
|----------|--------------|----------------|
| Aircraft | Narrow-body (A320, B737), Wide-body (A330, B777), Regional (E175, CRJ) | Licensed 3D models or procedural generation from aircraft dimensions |
| GSE - Tugs | Baggage tractors (TLD, TREPEL), pushback tractors (Goldhofer, TLD) | Custom modeling from reference photos + CAD drawings |
| GSE - Loaders | Belt loaders, container loaders, cargo loaders | Custom modeling |
| GSE - Service | Fuel trucks, catering trucks, lavatory service, GPU, ACU, de-icing | Custom modeling |
| Personnel | Ground handlers, marshallers, wing-walkers, ramp agents | Rigged humanoid models with airport PPE |
| Vehicles | Follow-me cars, airfield maintenance vehicles, ARFF trucks | Standard vehicle models with airport-specific livery |
| Baggage | Individual bags, bag carts (dollies), ULD containers | Parametric models with size variation |
| Infrastructure | Jet bridges (articulated), blast fences, FOD detection equipment, perimeter fencing | Procedural generation from airport specifications |

**Placement Rules (derived from ICAO/FAA standards):**
- Aircraft nose wheel on stand centerline within 0.5m tolerance
- GSE positioned according to aircraft service zone diagrams (fuel truck at wing, belt loader at cargo door, etc.)
- Minimum clearance distances maintained (7.5m wingtip clearance for Code C stands)
- Baggage cart trains following service road geometry
- Personnel positioned at designated marshalling points

### 10.4 Phase 3: LLM-Driven Scenario Generation

**Scenario Categories for Airside Operations:**

1. **Turnaround Operations** (most common)
   - Full turnaround sequence: aircraft arrival, gate assignment, pushback
   - Partial turnaround with subset of GSE active
   - Delayed operations with GSE queuing

2. **Transit and Navigation**
   - AV following designated surface routes between apron areas
   - Yield-to-aircraft scenarios at taxiway crossings
   - Multi-vehicle convoy on service roads

3. **Edge Cases and Safety-Critical Scenarios**
   - Unexpected pedestrian crossing (ground handler walking between parked aircraft)
   - GSE malfunction/stopped on service road
   - FOD on taxiway requiring avoidance
   - Emergency vehicle with lights/sirens requiring right-of-way
   - Jet blast zone incursion
   - Low-visibility operations (fog, heavy rain, night)

4. **Regulatory Scenarios (FAA AC 150/5210-20A)**
   - Runway incursion avoidance
   - Hold-short compliance at runway-taxiway intersections
   - Communication with ATC for movement area access

**LLM Prompt Template:**
```
Given an airport apron with {N} active gates, generate a 60-second
scenario where:
- Gate {X} has an {aircraft_type} being serviced by {GSE_list}
- The ego vehicle is a {vehicle_type} navigating from {origin} to {destination}
- Weather: {conditions}
- Time: {time_of_day}
- Special event: {edge_case_description}

Output: JSON with timestamped positions and orientations for all agents,
weather parameters, and lighting configuration.
```

### 10.5 Phase 4: Sensor Simulation

**Camera Simulation:**
- Fisheye and pinhole camera models matching target AV sensor suite
- Physically-based rendering (PBR) with ray tracing for realistic reflections off aircraft skin and wet tarmac
- Motion blur at AV operational speeds (typically 15-25 km/h on apron)
- Rolling shutter simulation if using CMOS sensors

**LiDAR Simulation:**
- Raycasting against scene geometry with configurable scan patterns (Velodyne VLP-16, Ouster OS1-128, etc.)
- Beam divergence and range-dependent point density
- Intensity modeling from surface material reflectivity (highly variable on airports: retroreflective markings vs dark tarmac)
- Rain/fog attenuation using Beer-Lambert law
- Multi-return modeling for semi-transparent surfaces

**Ground Truth Generation:**
- 2D bounding boxes for all cameras
- 3D bounding boxes in ego vehicle frame
- Semantic segmentation maps (classes: tarmac, taxiway_marking, aircraft, GSE, person, building, sky, vegetation)
- Instance segmentation
- Depth maps
- Optical flow
- Point-wise semantic labels for LiDAR
- HD map labels (drivable area, lane boundaries, stop lines)

### 10.6 Phase 5: Domain Randomization

Apply structured domain randomization with airside-specific parameters:

**Per-frame randomization:**
- Lighting: sun angle, cloud cover, artificial light intensity/color temperature
- Weather: rain intensity (0--50 mm/h), fog visibility (100m--10km), snow coverage
- Camera: exposure, white balance, lens flare intensity
- LiDAR: noise profile, dropout rate

**Per-scene randomization:**
- Aircraft livery (sample from airline database)
- GSE paint scheme and condition (new/weathered)
- Personnel PPE color configuration
- Parking stand occupancy (40--100%)
- Baggage cart train length (1--6 carts)
- Time of day (0000--2359)
- Season (affects sun angle and vegetation)

**Per-episode randomization:**
- Scenario type (from Phase 3 library)
- Agent behavior parameters (speed profiles, reaction times)
- FOD placement (random position on taxiway/apron surface)
- Construction zone placement with cones/barriers

### 10.7 Phase 6: Quality Assurance

**Automated Filtering:**
- VLM-based quality scoring (following Cosmos-Drive-Dreams approach): reject scenes with visual artifacts, floating objects, or physically impossible configurations
- Ground truth validation: verify all bounding boxes have minimum point count, check for label consistency
- Sensor realism checks: compare synthetic LiDAR point density distribution against real sensor specifications
- Domain gap monitoring: compute SEDD or FID between synthetic and available real data batches

**Manual Review:**
- Sample 1-5% of generated data for human review
- Verify GSE placement realism with airport operations SMEs
- Validate marking/lighting accuracy against aerodrome charts

### 10.8 Phase 7: Training Integration

**Mixing Strategy:**

1. **Initial training (no real data available):**
   - Train entirely on synthetic data with aggressive domain randomization
   - This provides a strong initialization before any real data is collected

2. **Early real data collection (< 1k real samples):**
   - 80% synthetic / 20% real
   - Expect 15-25% improvement over synthetic-only baseline
   - Focus real data collection on scenarios poorly represented in simulation

3. **Growing real dataset (1k--10k samples):**
   - 50% synthetic / 50% real (Rs2r = 0.5, matching Cosmos-Drive-Dreams)
   - Apply targeted synthetic augmentation for underrepresented classes and conditions
   - Monitor per-class performance to identify where synthetic data helps most

4. **Mature dataset (> 10k samples):**
   - 20-30% synthetic / 70-80% real
   - Synthetic data primarily for edge cases, adverse weather, rare GSE types
   - Continuously update synthetic pipeline based on failure mode analysis

**Domain Adaptation Techniques:**
- Feature alignment between synthetic and real domains using adversarial training
- Style transfer to make synthetic images match real data appearance
- Progressive fine-tuning: pretrain on synthetic, then fine-tune on real with lower learning rate
- Curriculum learning: start with easy synthetic examples, gradually introduce harder/more realistic ones

---

## 11. Airport-Specific Considerations

### 11.1 Regulatory Context

The FAA is actively developing standards for Autonomous Ground Vehicle Systems (AGVS) on airports:

- **FAA Emerging Entrants Bulletin 25-02** (May 2025): Provides guidance for testing and demonstrating AGVS at federally obligated airports
- **Part 139 CertAlert 24-02**: Addresses AGVS technology on certificated airports
- AGVS may be tested in movement areas closed to aircraft operations
- Airport sponsors must demonstrate risk understanding and mitigation
- Remote and landside areas are recommended as initial testing environments

Synthetic data enables pre-deployment validation that would be required before accessing restricted airside areas, reducing the barrier to demonstrating safety compliance.

### 11.2 Existing Airside Datasets and Resources

**Amelia-42:** Large-scale airport surface movement dataset using SWIM/SMES data from 42 airports. Provides trajectory data for aircraft and vehicles, useful for scenario generation and motion forecasting model training, though it lacks perception data (camera/LiDAR).

**Airport Ground Vehicles Dataset (Roboflow):** Community dataset with annotated images of open baggage tractors, pushback tractors, and other GSE. Limited in scale but useful for establishing baseline detection capabilities.

**Microsoft Flight Simulator 2020:** Has been used to generate synthetic airport scenes for perception validation. A published study found that models trained on combined real + MSFS synthetic images outperform single-source models for airport navigation tasks.

### 11.3 Unique Challenges of Airside Synthetic Data

1. **Aircraft scale and geometry**: Aircraft are significantly larger than on-road vehicles, with complex geometry (wings, engines, landing gear) that creates unique occlusion and LiDAR reflection patterns

2. **Reflective surfaces**: Aircraft aluminum skin, wet tarmac, and terminal glass create challenging specular reflections that must be accurately modeled

3. **Non-standard dynamics**: GSE vehicles have unusual motion profiles (baggage tractors towing chains of carts, pushback tractors moving aircraft backward, belt loaders with articulated conveyors)

4. **Marking system**: Airport markings follow ICAO Annex 14 / FAA AC 150/5340-1 standards, which differ significantly from road markings and must be accurately reproduced

5. **Operational density**: During peak periods, 10-15 GSE units may be simultaneously servicing a single aircraft, creating dense, cluttered scenes rarely seen in on-road driving

---

## 12. Recommended Technology Stack

| Component | Recommended Tool | Alternative |
|-----------|-----------------|-------------|
| Scene geometry source | AIXM 5.1 / AMXM via FME or GeoTools | ArcGIS Pro AIXM import |
| 3D scene construction | NVIDIA Omniverse (USD) | Unreal Engine 5 |
| Procedural generation | Houdini + Solaris (USD export) | Infinigen (custom domain extension) |
| Sensor simulation | NVIDIA DRIVE Sim | CARLA (limited airport support) |
| Domain randomization | Omniverse Replicator | Custom scripting in UE5 |
| Video diffusion augmentation | Cosmos-Drive (fine-tuned on airside) | DriveDreamer-2 |
| LiDAR generation | RangeLDM (fine-tuned on airside scans) | LaGen for sequence generation |
| Scenario generation | GPT-4 / Claude fine-tuned on airside DSL | Text2Scenario + custom DSL |
| Point cloud augmentation | GT-Paste + PolarMix + CAPMix | PPBA (automated policy search) |
| Quality assurance | VLM filtering + SEDD gap monitoring | FID + human review |
| Training framework | PyTorch + MMDetection3D | Ultralytics + OpenPCDet |
| Asset management | NVIDIA Nucleus (USD collaboration) | Git LFS + DVC |

---

## 13. Conclusion and Recommendations

Synthetic data generation for autonomous driving has matured rapidly, with published evidence consistently demonstrating 5--16% improvements in perception tasks and up to 56% reduction in collision rates for planning tasks. The technology is especially impactful in data-scarce domains --- exactly the situation facing airside AV development.

**Priority recommendations for bootstrapping an airside dataset:**

1. **Start with AIXM-based procedural scene generation.** The geometry is already standardized and available for most airports. Convert it to USD and build a parametric scene generator that can produce any airport layout.

2. **Invest in a GSE 3D asset library.** This is the highest-value, least-available component. Partner with GSE manufacturers for CAD models, or commission 3D scanning of real equipment.

3. **Deploy Omniverse Replicator for initial dataset generation.** The built-in domain randomization, sensor simulation, and annotation pipeline accelerate time-to-training-data.

4. **Fine-tune Cosmos-Drive on airside video data.** Even a small corpus of real airside video (hundreds of clips) can adapt the world foundation model to generate plausible airside scenes for video-based augmentation.

5. **Fine-tune RangeLDM on airside LiDAR scans.** Adapt the range image distribution to airport-specific characteristics (flat terrain, large reflective surfaces, unique object geometries).

6. **Build an LLM-based scenario generator with airside-specific function library.** This enables rapid scaling of scenario diversity and systematic coverage of edge cases defined by FAA/ICAO operational requirements.

7. **Implement continuous gap monitoring.** As real data accumulates, track SEDD and per-class performance to dynamically adjust synthetic data composition and identify where the pipeline needs improvement.

8. **Target 50/50 synthetic:real mixing ratio initially**, transitioning to 20-30% synthetic as the real dataset grows, with synthetic data increasingly focused on rare events and adverse conditions.

---

## Sources

### Video Diffusion and World Foundation Models
- [NVIDIA Cosmos World Foundation Models](https://www.nvidia.com/en-us/ai/cosmos/)
- [NVIDIA Cosmos Technical Blog](https://developer.nvidia.com/blog/scale-synthetic-data-and-physical-ai-reasoning-with-nvidia-cosmos-world-foundation-models/)
- [Cosmos World Foundation Model Platform Paper](https://arxiv.org/html/2501.03575v1)
- [Cosmos-Drive-Dreams: Scalable Synthetic Driving Data](https://research.nvidia.com/labs/toronto-ai/cosmos_drive_dreams/)
- [Cosmos-Drive-Dreams Paper](https://arxiv.org/abs/2506.09042)
- [DriveDreamer-2: LLM-Enhanced World Models](https://arxiv.org/html/2403.06845v1)
- [MagicDrive-V2 (ICCV 2025)](https://arxiv.org/abs/2411.13807)
- [DriveScape: High-Resolution Driving Video Generation](https://arxiv.org/abs/2409.05463)
- [Video Generation Models as World Simulators (OpenAI Sora)](https://openai.com/index/video-generation-models-as-world-simulators/)
- [Is Sora a World Simulator? Survey](https://arxiv.org/html/2405.03520v2)

### LiDAR Point Cloud Generation
- [RangeLDM: Fast Realistic LiDAR Point Cloud Generation (ECCV 2024)](https://arxiv.org/abs/2403.10094)
- [LiDARGen: Learning to Generate Realistic LiDAR Point Clouds (ECCV 2022)](https://arxiv.org/abs/2209.03954)
- [LaGen: Autoregressive LiDAR Scene Generation](https://arxiv.org/abs/2511.21256)
- [LidarDM: Generative LiDAR Simulation](https://arxiv.org/html/2404.02903v1)

### Domain Randomization and Sim-to-Real
- [Domain Randomization for Sim2Real Transfer (Lil'Log)](https://lilianweng.github.io/posts/2019-05-05-domain-randomization/)
- [Understanding Domain Randomization for Sim-to-real Transfer](https://arxiv.org/abs/2110.03239)
- [Style-Based Framework for Quantifying Synthetic-to-Real Gap](https://arxiv.org/abs/2510.10203)
- [Multi-Modality Evaluation of the Reality Gap](https://arxiv.org/html/2509.22379v1)
- [Bridging the Domain Gap (ACM JATS)](https://dl.acm.org/doi/10.1145/3633463)

### Synthetic Data Effectiveness and Mixing Ratios
- [Evaluating Impact of Synthetic Data on Object Detection](https://arxiv.org/html/2503.09803v1)
- [Unraveling Effects of Synthetic Data on E2E AD (ICCV 2025)](https://arxiv.org/html/2503.18108)
- [SynAD: Enhancing E2E AD with Synthetic Data (ICCV 2025)](https://arxiv.org/abs/2510.24052)
- [Synthetic Datasets for Autonomous Driving: A Survey](https://arxiv.org/abs/2304.12205)
- [Enhancing Object Detection Accuracy with Synthetic Data](https://arxiv.org/html/2411.15602v1)

### Point Cloud Augmentation
- [Context-Guided Ground Truth Sampling](https://ietresearch.onlinelibrary.wiley.com/doi/full/10.1049/itr2.12272)
- [False Positive Sampling-based Data Augmentation](https://arxiv.org/html/2403.02639v3)
- [PointMixup: Augmentation for Point Clouds (ECCV 2020)](https://arxiv.org/abs/2008.06374)
- [PolarMix: Data Augmentation for LiDAR Point Clouds (NeurIPS 2022)](https://openreview.net/pdf?id=wS23xAeKwSN)
- [Class-Aware PillarMix](https://arxiv.org/abs/2503.02687)
- [Improving 3D Detection through PPBA (Waymo)](https://arxiv.org/abs/2004.00831)

### NVIDIA Omniverse and DRIVE Sim
- [NVIDIA Omniverse Replicator](https://developer.nvidia.com/omniverse/replicator)
- [Omniverse Replicator for DRIVE Sim](https://blogs.nvidia.com/blog/drive-sim-replicator-synthetic-data-generation/)
- [Build Custom SDG Pipelines with Replicator](https://developer.nvidia.com/blog/build-custom-synthetic-data-generation-pipelines-with-omniverse-replicator/)
- [Far-Field Objects with Synthetic Data for AV Perception](https://developer.nvidia.com/blog/bringing-far-field-objects-into-focus-with-synthetic-data-for-camera-based-av-perception/)

### LLM-Driven Scenario Generation
- [Automated Test Scenario Generation with LLMs](https://www.mdpi.com/2079-9292/14/16/3177)
- [OmniTester: MLLM-Driven Scenario Testing](https://link.springer.com/article/10.1007/s42154-025-00364-w)
- [Text2Scenario: Text-Driven Scenario Generation](https://arxiv.org/html/2503.02911v1)
- [LLM-Enhanced Evolutionary Search for ADS Testing](https://arxiv.org/html/2406.10857v1)
- [Risk2Scenario: LLM-Assisted Scenario Generation](https://ieeexplore.ieee.org/document/11292126/)
- [LLM-Driven Simulation Pipeline for Safety-Critical Evaluation](https://www.sciencedirect.com/science/article/pii/S2405896325030447)

### Airport and Airside Specific
- [AIXM - Aeronautical Information Exchange Model](https://en.wikipedia.org/wiki/AIXM)
- [FAA AIXM Program](https://www.faa.gov/about/office_org/headquarters_offices/ato/service_units/mission_support/aixm)
- [AMXM - Aerodrome Mapping Exchange Model](https://amxm.aero/page/about-amxm)
- [FAA Autonomous Ground Vehicle Systems on Airports](https://www.faa.gov/airports/new_entrants/agvs_on_airports)
- [Validating Synthetic Data for Airport Navigation (MDPI Aerospace)](https://www.mdpi.com/2226-4310/11/5/383)
- [Amelia: Large Model and Dataset for Airport Surface Movement](https://arxiv.org/html/2407.21185v1)
- [Airport Ground Vehicles Detection Dataset (Roboflow)](https://universe.roboflow.com/airport-gse/airport-ground-vehicles)

### NeRF for Driving
- [Neural Radiance Field in Autonomous Driving: A Survey](https://arxiv.org/html/2404.13816v1)
- [HarmonicNeRF: Synthetic View Augmentation for Driving](https://arxiv.org/html/2310.05483v5)
