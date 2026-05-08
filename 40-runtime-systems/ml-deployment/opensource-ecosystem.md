# Open-Source AV Ecosystem: Stacks, Perception, Planning, and Tools

**Status:** Research complete | **Last updated:** 2026-03-21

---

## Table of Contents

1. [Autoware.Universe](#1-autowareuniverse)
2. [comma.ai openpilot](#2-commaai-openpilot)
3. [NVIDIA DriveWorks / DRIVE SDK](#3-nvidia-driveworks--drive-sdk)
4. [Perception Frameworks](#4-perception-frameworks)
5. [Planning Frameworks](#5-planning-frameworks)
6. [Labeling and Visualization Tools](#6-labeling-and-visualization-tools)
7. [Simulation Platforms](#7-simulation-platforms)
8. [Airside Relevance Summary](#8-airside-relevance-summary)

---

## 1. Autoware.Universe

### 1.1 Overview and Deployment Status

Autoware is the world's leading open-source autonomous driving software project, celebrating its 10th anniversary in August 2025. It powers deployments across **500+ companies, 30+ vehicle types, and 20+ countries**. Real-world use cases span autonomous shuttles/buses, robotaxis, low-speed vehicles, racing platforms, and private vehicle automation.

A landmark 2025-2026 deployment: **TIER IV and Isuzu Motors** announced Level 4 autonomous driving for Isuzu ERGA electric and diesel bus models using the NVIDIA DRIVE Hyperion computing platform with Autoware's open-source stack. This represents expansion into heavy-duty commercial vehicles with functional safety rigor.

### 1.2 ROS 2 Architecture

Autoware is built on **Service-Oriented Architecture (SOA)** principles implemented in ROS 2. It leverages ROS 2's DDS-based QoS model for reliable communication, structured lifecycle management, and fault containment across distributed compute nodes.

**Communication patterns:**
- **Topic-based** (pub/sub): Asynchronous many-to-many messaging for sensor streams and perception outputs
- **Service-based**: Synchronous request-response for configuration and queries
- **Action-based**: Goal-oriented interfaces for long-running planning/control tasks

**Message architecture** uses three standardized packages:
- `autoware_msgs` -- common cross-domain messages
- `autoware_adapi_msgs` -- Automated Driving API contracts
- `autoware_internal_msgs` -- internal component-specific protocols

**Agnocast middleware (2025):** TIER IV developed Agnocast, a true zero-copy IPC middleware that coexists with ROS 2. Unlike IceOryx, it supports zero-copy for all message types including unsized types (those using `std::vector`). Results: **16% improvement in average response time, 25% improvement in worst-case response time** for PointCloud preprocessing, plus significant memory and CPU reductions. Paper accepted at ISORC 2025 and production version integrated into Autoware.

### 1.3 Module Architecture

The system is organized into six functional domains with clean interfaces:

#### Sensing
- LiDAR preprocessing and filtering (distortion correction, synchronization)
- Radar object adaptation
- IMU correction
- Camera drivers and preprocessing

#### Localization
- **NDT Matching** -- point cloud registration against HD maps
- **EKF Localizer** -- Extended Kalman Filter fusion of multiple modalities
- **Eagleye** -- GNSS/RTK-based positioning
- **YabLoc** -- vision-based localization
- **Landmark-based** -- AR tags, LiDAR markers
- Pose estimation and error monitoring

#### Perception
- **3D Object Detection:** BEVFusion, CenterPoint, FRNet, TransFusion
- **Multi-Object Tracking:** ByteTrack
- **Traffic Light:** classification and detection
- **Ground Segmentation:** RANSAC, Ray, scan filters
- **Occupancy Grid Mapping**
- **Clustering and merging utilities**

#### Planning (hierarchical, modular)
- **Mission Planning:** route computation between waypoints
- **Behavior Planning:** lane changes, merges, intersections, avoidance, goal planning
- **Velocity Planning:** intersection, crosswalk, traffic light, stop line handling
- **Motion Planning:** trajectory optimization, sampling-based planning, velocity limiting
- **Parking:** freespace planning with RRT* algorithm
- **Scenario Planning:** context-aware decision selection

#### Control
- **MPC** (Model Predictive Control) lateral controller
- **PID** longitudinal controller
- **Pure Pursuit** trajectory follower
- **Emergency braking** and collision detection
- **Vehicle Command Gate** -- safety validation layer

#### Vehicle Interface
- Converts control signals for specific vehicle types via CAN bus

### 1.4 BEV Integration (Vision-First Perception)

MulticoreWare partnered with the Autoware Foundation to integrate two BEV models into the perception stack, signaling a shift from LiDAR-heavy to scalable vision-based perception:

**BEVDet:**
- Implements Lift-Splat-Shoot: lifts image features into 3D, splats into unified BEV grid, detects in top-down space
- Camera-only operation, no LiDAR dependency
- ROS 2 native integration, TensorRT 10.x optimization with FP16 mixed-precision

**BEVFormer:**
- Adds temporal reasoning across multiple frames via spatial cross-attention and temporal self-attention
- Completely reimplemented in C++ for ROS 2 using ONNX-to-TensorRT workflows
- RViz visualization with real-time 3D bounding box rendering

### 1.5 End-to-End AI and World Model Integration Potential

Autoware is actively exploring end-to-end AI integration:

- **Autoware.Flex** (2024 paper): incorporates human natural-language instructions into ADS decision-making using LLMs. Validated in both simulation and real-world vehicles.
- **AMD Silo AI collaboration**: accelerating E2E model training and deployment using AMD Instinct/Radeon Pro GPUs.
- **BrightDrive validation**: testing E2E models (AutoSpeed, SceneSeg, DomainSeg) under real-world operational constraints, while Autoware serves as a fallback stack and benchmarking environment.

**World model integration potential for airside:** Autoware's modular architecture with standardized interfaces makes it straightforward to swap perception or planning modules with world-model-based alternatives. The BEV integration work demonstrates the pathway: implement as a ROS 2 node with TensorRT optimization, publish to standard `autoware_msgs` topics.

---

## 2. comma.ai openpilot

### 2.1 End-to-End Architecture

openpilot is an open-source operating system for robotics that currently upgrades ADAS on **300+ supported car models**. It takes a fundamentally different approach from Autoware: rather than a modular pipeline, it uses **end-to-end learned driving policies** that directly map sensor inputs to steering and acceleration commands.

### 2.2 World Model Architecture

comma.ai's world model work, documented in their CVPR 2025 Workshop paper "Learning to Drive from a World Model," represents one of the most advanced deployed world models in autonomous driving.

**DiT (Diffusion Transformer) configurations trained:**

| Config | Parameters | Notes |
|--------|-----------|-------|
| gpt | 250M | Small |
| gpt-medium | 500M | Primary experiment model |
| gpt-large | 1B | Larger scale |

**openpilot 0.11 world model (2B params, released March 2026):**
- Architecture: n_layer=48, n_head=25, n_embd=1600
- Input: 2 seconds past context, 1 second future conditioning, 0-7 seconds simulation window at 5 fps
- Training data: **2.5M minutes of driving video**
- Sampling: 15 Euler steps with Classifier-Free Guidance (strength 2.0)
- Throughput: 12.2 frames/sec/GPU

**Frame compression (VAE):**
- Encoder ViT: 50M params
- Decoder ViT: 100M params
- Latent space: 32x16x32 (from 3x128x256 dual camera input)
- Compression: 8x8 spatial with 4 latent channels per image
- Training losses: LPIPS + adversarial + least squares error
- Masked Auto Encoder formulation achieves 2.7x better performance than baseline

### 2.3 Training from Real Data

**Two simulation approaches for on-policy training:**

**Reprojective Simulation:**
- Uses dense depth maps and 6-DOF pose to render new views by reprojecting 3D points
- Ships in openpilot since 0.8.15 (lateral) and 0.9.0 (longitudinal)
- Limitations: static scene assumption, depth errors, occlusion artifacts, lighting artifacts (especially at night), range limited to <4m translation

**World Model Simulation:**
- Completely end-to-end, general-purpose method that scales with compute
- Overcomes reprojective simulation limitations
- **Future State Anchoring:** provides future states at fixed timesteps so the model can recover from errors and converge predictions toward goal states
- Uses IMPALA-style distributed, asynchronous rollout data collection

**Training data scales tested:** 100k, 200k, and 400k segments (each 1 minute of driving at 5 Hz)

### 2.4 CVPR 2025 Results and Real-World Deployment

The CVPR 2025 Workshop paper (arXiv 2504.19077) by Mitchell Goff, Greg Hogan, George Hotz et al. demonstrates:

- Both on-policy learning methods (reprojective and world model) successfully deployed in real-world openpilot
- Field deployment across 500 users over two months showed:
  - **29.92% engagement time** and **52.49% engagement distance** for world-model-trained policy

**openpilot 0.11 (March 2026) -- first model fully trained in learned simulation:**
- First driving model trained using both videos AND plans from world model (0.10 used world model for plans only, reprojective sim for videos)
- Users on nightly now prefer Experimental mode (E2E longitudinal) over ACC policy
- Improved highway speed convergence (a persistent issue with previous simulator-trained models)
- Noticeably improved reactivity around parked cars
- Hardware: comma four idle power reduced 77% (225mW to 52mW)

### 2.5 What to Borrow for Airside

1. **On-policy training methodology** -- training in learned simulation produces policies that handle real-world distribution shift better than off-policy approaches
2. **Future state anchoring** -- technique for overcoming off-policy training limitations, directly applicable to world models for airside navigation
3. **VAE + DiT architecture** -- the frame compression + diffusion transformer combo achieves good quality at practical inference speeds
4. **Data pipeline design** -- 2.5M minutes of driving data processed into on-policy training; similar scale achievable from airport fleet data
5. **Incremental deployment** -- started with reprojective sim (simpler, less compute), graduated to full world model sim; a pragmatic adoption path
6. **IMPALA-style distributed training** -- asynchronous rollout collection scales well for fleet-based data collection

---

## 3. NVIDIA DriveWorks / DRIVE SDK

### 3.1 DriveWorks SDK

NVIDIA DriveWorks SDK is middleware for autonomous vehicle software development, part of the larger NVIDIA DRIVE platform. It provides:

- **Sensor Abstraction Layer (SAL):** unified interface for cameras, LiDARs, radars, GPS, IMU
- **Sensor Plugins:** extensible sensor integration
- **DNN Framework:** infrastructure to optimize pre-trained DNNs with TensorRT, prepare input data, perform inference, and post-process results
- **Data Recorder:** for sensor data logging
- **Vehicle I/O Support:** CAN bus and vehicle interface
- **Calibration Tools:** multi-sensor extrinsic/intrinsic calibration

The DNN module specifically: takes pre-trained networks, optimizes with TensorRT (FP32, FP16, INT8), handles input preparation and output post-processing. The SDK abstracts low-level GPU programming so developers focus on algorithms.

**Design philosophy:** open and modular -- developers pick and choose components.

### 3.2 NVIDIA DRIVE AGX Thor

The latest NVIDIA DRIVE platform hardware, featuring:
- Next-generation SoC for autonomous vehicles
- Supports the full DRIVE software stack
- TIER IV's Autoware-based solutions run on DRIVE Hyperion computing platform

### 3.3 Cosmos World Foundation Models

NVIDIA Cosmos is a platform of generative world foundation models for physical AI development:

**Model families:**
- **Cosmos Predict:** generates future world states from sensor context
- **Cosmos Transfer 2.5:** high-fidelity world-to-world style transfer (relight, change weather/lighting/terrain conditions across multiple cameras)
- **Cosmos Reason 2:** reasoning model for physical AI, foundation for Alpamayo

**Timeline:**
- January 2025: initial Cosmos launch at CES
- March 2025: major release with reasoning capabilities
- December 2025: Cosmos-Predict2.5-2B with Diffusers support, Image2Image for Transfer 2.5
- February 2026: enhanced compute support and quantization for Cosmos Reason 2

**Adopters:** 1X, Agility Robotics, Figure AI, Foretellix, Skild AI, Uber, Nexar, Oxa

**Integration with CARLA:** the latest CARLA release includes Cosmos Transfer APIs for generating scene variants with diverse weather/lighting conditions, plus 40,000 clips generated through Cosmos.

### 3.4 Alpamayo VLA Model

Alpamayo is NVIDIA's Vision-Language-Action model for autonomous driving:

**Architecture:**
- 8.2B-parameter Cosmos Reason backbone + 2.3B-parameter action expert = **10B total parameters**
- Diffusion-based trajectory decoder
- Chain-of-Causation reasoning with trajectory planning

**Inputs:**
- Multi-camera images (4 cameras: front-wide, front-tele, cross-left, cross-right)
- 0.4 second history window at 10Hz
- 3D translation and 9D rotation egomotion history
- Navigation context and text prompts

**Training data:**
- NVIDIA Physical AI Open Dataset: **1,727 hours of driving data (100 TB)**
- 360-degree coverage from 7 cameras, LiDAR, up to 10 radars
- 25 countries

**Capabilities:**
- Generates human-readable reasoning traces explaining driving decisions
- Functions as a **teacher model** for distillation into smaller, deployable models (not intended to run directly in-vehicle)
- Supports fine-tuning and post-training with custom data

**AlpaSim:** Python-based closed-loop simulation testbed with microservice-based architecture, modular APIs, and pipeline parallelism for evaluation

**Requirements:** minimum 24 GB VRAM, optimized for NVIDIA GPUs

**Resources:** code on GitHub (NVlabs/alpamayo), weights on HuggingFace, post-training scripts, inference notebooks

### 3.5 Relevance for Airside

- **Cosmos Transfer:** generate synthetic airside training data with varied weather/lighting from limited real captures
- **Alpamayo as teacher:** distill airport-specific driving behaviors from fine-tuned Alpamayo into smaller models that run on edge compute
- **DriveWorks DNN inference:** TensorRT optimization pipeline directly applicable for deploying custom perception models on NVIDIA hardware
- **NuRec:** reconstruct 3D scenes from fleet sensor data for digital twin simulation

---

## 4. Perception Frameworks

### 4.1 MMDetection3D

**Repository:** [open-mmlab/mmdetection3d](https://github.com/open-mmlab/mmdetection3d)
**Latest version:** v1.4.0 (August 2024)
**License:** Apache 2.0

**Supported models (partial list):**

| Category | Models |
|----------|--------|
| LiDAR Outdoor | SECOND, PointPillars, SSN, 3DSSD, SA-SSD, PointRCNN, Part-A2, CenterPoint, PV-RCNN, CenterFormer |
| LiDAR Indoor | VoteNet, H3DNet, Group-Free-3D, FCAF3D, TR3D |
| Camera Outdoor | ImVoxelNet, SMOKE, FCOS3D, PGD, MonoFlex, DETR3D, PETR |
| Multi-Modal | MVXNet, BEVFusion, ImVoteNet |
| 3D Segmentation | MinkUNet, SPVCNN, Cylinder3D, TPVFormer, PointNet++, PAConv, DGCNN |

**Supported datasets:** KITTI, Waymo, nuScenes, Lyft (outdoor); ScanNet, SUN RGB-D (indoor); SemanticKITTI, S3DIS (segmentation)

**Key features:**
- 300+ models and methods from 40+ papers via MMDetection integration
- Modular design: encoders, backbones, necks, and heads can be configured independently
- Multi-modal detection combining LiDAR + camera
- Custom dataset support via KITTI-format conversion or native data pipeline customization
- Dataset wrappers: RepeatDataset, ClassBalancedDataset, ConcatDataset for training distribution control

**Custom dataset training:**
1. Convert data to KITTI format (easiest path) with ImageSets, calib, image_2, velodyne, label_2 directories
2. Or use native data pipeline customization with custom dataset class
3. Support for custom class definitions in config files

**Custom LiDAR support:** any LiDAR producing point clouds can be used -- convert to KITTI bin format (x,y,z,intensity per point) or define a custom data loader. Point cloud coordinate system is unified: (x, y, z, dx, dy, dz, heading) for 3D boxes.

### 4.2 OpenPCDet

**Repository:** [open-mmlab/OpenPCDet](https://github.com/open-mmlab/OpenPCDet)
**License:** Apache 2.0

**Supported models:**
- SECOND, PointPillars, PointRCNN, Part-A2, PV-RCNN, PV-RCNN++
- CenterPoint, Voxel R-CNN, VoxelNeXt
- DSVT (state-of-the-art on Waymo, real-time at 27Hz with TensorRT)
- TransFusion-Lidar (69.43% NDS on nuScenes validation)
- BEVFusion (70.98% NDS on nuScenes validation)

**Key differentiator:** data-model separation with unified point cloud coordinate system for easy custom dataset extension. Uses (x, y, z, dx, dy, dz, heading) box definition.

**Custom dataset support:**
- Dedicated `custom_dataset.py` and `custom_dataset.yaml` template
- Official `CUSTOM_DATASET_TUTORIAL.md` with step-by-step guide
- Shared memory support (`USE_SHARED_MEMORY`) for training IO optimization

**Pre-trained models:** available in model zoo for KITTI, Waymo, nuScenes datasets

### 4.3 Det3D

**Repository:** [V2AI/Det3D](https://github.com/V2AI/Det3D)
**License:** Apache 2.0

**Supported models:** PointPillars, SECOND, PIXOR (with VoteNet and STD planned)
**Supported datasets:** KITTI, nuScenes, Waymo

**Status:** Det3D was historically the first general-purpose 3D detection codebase but has seen less active development compared to MMDetection3D and OpenPCDet. Its Multi-Group Head implementation for SECOND differs from other codebases, making direct speed comparisons incompatible.

### 4.4 Framework Comparison

| Feature | MMDetection3D | OpenPCDet | Det3D |
|---------|--------------|-----------|-------|
| Model count | 20+ native, 300+ via MM ecosystem | 12+ | 3 native |
| Dataset support | KITTI, Waymo, nuScenes, Lyft, ScanNet, SUN RGB-D | KITTI, Waymo, nuScenes | KITTI, nuScenes, Waymo |
| Multi-modal | Yes (BEVFusion, MVXNet) | Yes (BEVFusion, TransFusion) | No |
| Custom dataset | KITTI-format or native | Dedicated tutorial + template | Manual |
| Indoor detection | Yes (VoteNet, FCAF3D) | No | No |
| Segmentation | Yes (MinkUNet, Cylinder3D) | No | No |
| TensorRT deploy | Via MMDeploy | Community scripts | Limited |
| Active maintenance | Yes | Yes | Minimal |
| Best for | Breadth, multi-modal, research | LiDAR-focused, production | Legacy |

**Recommendation for airside:** Start with **OpenPCDet** for LiDAR-focused detection (simpler setup, good custom dataset support, DSVT achieves real-time with TensorRT). Use **MMDetection3D** if multi-modal fusion (LiDAR + camera) or BEV-based detection is needed. Both support adding custom classes (GSE, aircraft, tow tractors, etc.) through config modification and dataset annotation.

### 4.5 Adding Custom Classes

Both MMDetection3D and OpenPCDet support custom classes through:

1. **Annotation:** label your airside objects (GSE, aircraft, baggage carts, etc.) with 3D bounding boxes in KITTI or nuScenes format
2. **Config modification:** update class lists in dataset config YAML
3. **Training:** either train from scratch or fine-tune from a pre-trained checkpoint (recommended for faster convergence)
4. **Pre-trained backbone transfer:** use a checkpoint trained on nuScenes/Waymo car/pedestrian/cyclist, freeze the backbone, and train only the detection head on airside classes

---

## 5. Planning Frameworks

### 5.1 CommonRoad

**Website:** [commonroad.in.tum.de](https://commonroad.in.tum.de)
**Origin:** Technical University of Munich

CommonRoad is a collection of composable benchmarks for motion planning on roads.

**Core components:**
- **Scenario Database:** continuously growing collection of naturalistic, handcrafted, and auto-generated scenarios in XML format (real traffic recordings + dangerous edge cases)
- **Drivability Checker:** validates trajectory feasibility
- **Route Planner:** high-level route computation
- **Criticality Measurement Toolbox:** evaluates scenario safety
- **Vehicle Dynamics Models:** multiple fidelity levels from kinematic bicycle to multi-body

**Evaluation dimensions:** efficiency, safety, comfort, and traffic rule compliance

**Annual Competition:** the 4th CommonRoad Motion Planning Competition (2024) used 500+ scenarios including interactive and non-interactive settings. Provides open-source, reproducible benchmarking framework.

**Scenario types:** highway and urban environments with diverse participants (cars, buses, bicycles)

**Airside relevance:** CommonRoad's scenario-based approach maps well to airside planning. Its drivability checker and criticality measurement tools can be adapted for taxiway/ramp scenarios. However, it lacks native support for non-road environments and would require scenario format adaptation.

### 5.2 nuPlan

**Origin:** Motional (now part of Hyundai Motor Group)

nuPlan is the world's first real-world autonomous driving dataset and benchmark specifically for motion planning.

**Dataset:**
- **1,282 hours** of diverse driving scenarios
- **4 cities:** Las Vegas, Boston, Pittsburgh, Singapore
- High-quality auto-labeled object tracks and traffic light data
- Modular simulation framework initialized with real-world observations

**Simulation architecture:**
- Agent model predicts future trajectories of all agents
- Planner predicts best route for ego vehicle
- Controller converts intended route into feasible trajectory
- Supports both open-loop (playback) and closed-loop (reactive) evaluation

**nuPlan-R (2025):** reactive closed-loop extension that replaces rule-based IDM agents with **noise-decoupled diffusion-based reactive agents**:
- Learning-based reactive agents as configurable simulation components
- Interaction-aware agent selection mechanism
- Extended metrics: Success Rate (SR) and All-Core Pass Rate (PR)
- More realistic, diverse, and human-like traffic behaviors

**Airside relevance:** nuPlan's closed-loop simulation framework is the gold standard for planner evaluation. Its reactive agent models could be adapted for simulating airside traffic (aircraft, GSE, personnel). The evaluation metrics framework is directly applicable.

### 5.3 Diffusion-Based Planners

**Diffusion Planner (ICLR 2025 Oral):**
- Transformer-based diffusion model for closed-loop planning
- Joint modeling of prediction and planning under same architecture
- Classifier guidance for safe and adaptable planning behaviors
- Achieves state-of-the-art closed-loop performance on nuPlan
- Validated on 200-hour delivery-vehicle dataset with robust style transfer
- [GitHub: ZhengYinan-AIR/Diffusion-Planner](https://github.com/ZhengYinan-AIR/Diffusion-Planner)

**DiffusionDrive (CVPR 2025 Highlight):**
- Truncated diffusion policy with multi-mode anchors
- **10x reduction** in denoising steps (2 steps vs 20+ for vanilla diffusion)
- 3.5 higher PDMS on NAVSIM benchmark
- 64% higher mode diversity score
- Real-time capable for end-to-end autonomous driving
- [GitHub: hustvl/DiffusionDrive](https://github.com/hustvl/DiffusionDrive)

**CoPlanner (2025):**
- Interactive motion planner with contingency-aware diffusion
- Models multi-agent interactions with contingency planning

**Airside relevance:** Diffusion planners are particularly promising for airside because they naturally handle multi-modal action distributions (e.g., yield or proceed, multiple valid parking paths). DiffusionDrive's 2-step inference is practical for real-time deployment. The joint prediction-planning architecture of Diffusion Planner aligns with the world-model approach where prediction and planning are unified.

### 5.4 CARLA Leaderboard

The CARLA Autonomous Driving Challenge provides standardized benchmarks for planning and driving agents:

- **Leaderboard 2.0/2.1:** updated March 2025 with modified infraction scoring
- **2024 winners:** top entries used learning-based approaches (TransFuser++ achieved 2nd place at CVPR 2024 challenge, Team Tuebingen_AI)
- **2025 challenge:** not running due to unforeseen circumstances, but leaderboard platform remains available for local evaluation
- **Evaluation criteria:** driving score combining route completion and infraction penalty

---

## 6. Labeling and Visualization Tools

### 6.1 CVAT (Computer Vision Annotation Tool)

**Website:** [cvat.ai](https://www.cvat.ai)
**License:** MIT (self-hosted) / SaaS available
**Strengths:** computer vision specialist, especially video

**3D Point Cloud capabilities:**
- Native rendering and annotation of raw 3D LiDAR data
- 3D cuboid/bounding box annotation
- Synchronized multi-sensor views (camera + LiDAR)
- Object tracking and interpolation between frames
- Semantic segmentation support

**2025 improvements:**
- Double-click to center camera on objects (speeds up small object annotation)
- Standardized zoom across all annotation modes including 3D side views
- Persistent zoom levels between object switches
- ML-assisted annotation with model backends

**Best for:** teams focused on vision and LiDAR annotation with strong tracking needs

### 6.2 Label Studio

**Website:** [labelstud.io](https://labelstud.io)
**License:** Apache 2.0 (open source)

**Capabilities:**
- Multi-modality: text, audio, images, video, time series, 3D
- Flexible UI customization via templating system
- ML backend integration for active learning
- 3D tasks through extensions
- Cloud-friendly deployment

**Best for:** teams needing flexible, multi-modality labeling with custom UIs and MLOps integration

**Comparison with CVAT:** CVAT is stronger for dedicated 3D point cloud work and video annotation (tracking, interpolation, segmentation assist). Label Studio is more flexible for mixed data types and custom labeling workflows.

### 6.3 Scalabel

**Website:** [scalabel.ai](http://www.scalabel.ai)
**License:** BSD

**Capabilities:**
- Scalable web-based annotation tool
- 3D bounding box annotation with four-click method
- Object tracking and interpolation between frames
- Lane marking annotation
- Drivable area annotation
- LiDAR point cloud support

**Best for:** research teams needing a lightweight, web-based annotation platform with basic 3D capabilities

### 6.4 Foxglove

**Website:** [foxglove.dev](https://foxglove.dev)
**License:** Source-available (MPL 2.0 for studio, commercial for platform features)

**Capabilities:**
- Full-platform visualization and observability for robotics
- Native ROS 1/2 and MCAP support
- Real-time and recorded data playback
- 3D scene visualization with point clouds, transforms, markers
- Organization-wide search and collaboration features
- Fleet operations and data management
- Extensions SDK (React/TypeScript) for custom visualizations
- Plugin-based extensibility with online registry

**MCAP format:** Foxglove + MCAP is the leading solution for multimodal data management in physical AI

**Best for:** production robotics teams needing fleet-scale data management, visualization, and collaboration

### 6.5 Rerun

**Website:** [rerun.io](https://rerun.io)
**License:** Apache 2.0 / MIT dual license
**Funding:** $20.2M total (including $17M seed in March 2025)

**Capabilities:**
- Open-source SDK for visualizing multimodal time-varying data
- SDKs for **Rust, C++, and Python**
- Interactive 2D/3D visualization: images, point clouds, coordinate frames, bounding boxes
- Time-aware: synchronized playback across multiple data streams
- Desktop or browser-based viewer
- Live streaming or from-disk replay
- MCAP format support (with ROS 2 reflection-based support in 0.26)

**Recent updates (2025-2026):**
- v0.27: experimental coordinate frame hierarchies, blueprint controls for 3D views
- v0.26: major performance improvements, reflection-based ROS 2 MCAP support
- Active development toward embedded/web-based deployment

**Best for:** engineering teams wanting a code-first, open-source visualization SDK with minimal setup. Particularly strong for debugging computer vision and ML pipelines.

### 6.6 Tool Comparison for Airside

| Tool | 3D LiDAR | Tracking | ROS 2 | Self-hosted | Cost | Best Airside Use |
|------|----------|----------|-------|-------------|------|-----------------|
| CVAT | Native cuboids | Yes | No | Yes | Free/SaaS | Annotation pipeline |
| Label Studio | Via extensions | Limited | No | Yes | Free | Multi-modal labeling |
| Scalabel | Basic | Yes | No | Yes | Free | Quick annotation |
| Foxglove | Visualization | No | Native | Yes/SaaS | Free/Paid | Fleet data review, debugging |
| Rerun | Visualization | No | Experimental | Yes | Free | ML pipeline debugging |

**Recommended stack for airside:**
- **Annotation:** CVAT for 3D point cloud + camera annotation (best native 3D support, tracking interpolation)
- **Visualization/Debugging:** Foxglove for ROS 2 bag review and fleet data; Rerun for ML pipeline development
- **Data management:** Foxglove + MCAP for fleet-scale recorded data

---

## 7. Simulation Platforms

### 7.1 CARLA

**Website:** [carla.org](https://carla.org)
**License:** MIT
**Engine:** Unreal Engine 5.5 (ue5-dev branch)
**Latest:** v0.10.0

**Key features:**
- Open-source simulator for autonomous driving research
- **150,000+ active developers** worldwide
- Native ROS 2 support compiled directly into server (as of 0.10.0)
- Python API for full scenario control
- Multi-agent traffic simulation
- Weather and lighting variation
- Multiple sensor models (camera, LiDAR, radar, GNSS, IMU)
- Digital Twins from OpenStreetMaps (v0.1)
- New maps: Town13 (large), Town15

**UE5 features:**
- Chaos physics engine
- Nanite/Lumen for high-fidelity rendering
- Requires Ubuntu 22.04+ or Windows 11+

**2025-2026 NVIDIA integrations:**
- **Cosmos Transfer APIs:** generate scene variants with diverse weather/lighting
- **NuRec tools:** neural reconstruction and rendering for high-fidelity simulation
- **Physical AI Dataset:** 40,000 clips generated through Cosmos
- Sample reconstructed scenes for neural rendering

**Leaderboard:** 2.1 version since March 2025 with modified infraction scoring. Challenge not running in 2025, but platform available for local evaluation.

### 7.2 AWSIM

**Website:** [github.com/tier4/AWSIM](https://github.com/tier4/AWSIM)
**License:** Apache 2.0
**Engine:** Unity3D

**Key features:**
- Built specifically for Autoware integration (works out-of-the-box)
- **Sensor simulation:** IMU, GNSS, RGB camera, various LiDARs
- **GPU LiDAR:** high-performance simulation via Robotec GPU Lidar (RGL)
- **Digital twin:** Shinjuku Tokyo area included with lanenet2 and point cloud maps
- **Traffic:** NPC vehicles respecting traffic lights and right of way, configurable density and spawn points
- **Communication:** ROS2ForUnity with higher throughput and lower latency than bridge solutions
- No API support (unlike CARLA)

**2025 updates:**
- Rain and fog simulation
- GPU skinning
- Multi-return LiDAR modes
- v2.0.0: major refactoring for improved scalability

**AWSIM-Labs:** Autoware Foundation maintained fork for self-driving research

**D-AWSIM (2025 paper):** distributed version for dynamic map generation framework

### 7.3 NVIDIA Isaac Sim

**Website:** [developer.nvidia.com/isaac/sim](https://developer.nvidia.com/isaac/sim)
**License:** Free for individual developers (NVIDIA Omniverse license)
**Engine:** NVIDIA Omniverse (USD-based)

**Key features (Isaac Sim 5.0):**
- Open-source and fully customizable (available on GitHub)
- Neural reconstruction and rendering
- Advanced synthetic data generation pipelines
- **MobilityGen:** generates diverse physics-based data for autonomous robots/vehicles
- New OmniSensor USD schema for improved sensor simulation
- Software-in-the-Loop (SIL) testing
- Domain randomization for training data generation
- Physically accurate sensor models

**Primary focus:** general robotics simulation (manipulators, mobile robots, humanoids), not specifically autonomous driving

**AV-relevant capabilities:**
- High-fidelity sensor simulation (cameras, LiDAR, radar, ultrasonic)
- Digital twin creation from real-world data
- Cosmos world foundation model integration
- FMU integration for vehicle dynamics

**Limitation for AV:** not purpose-built for driving scenarios. NVIDIA has **DRIVE Sim** (not fully open) for production AV simulation; Isaac Sim is more general-purpose robotics.

### 7.4 Comparison for Airside Use

| Feature | CARLA | AWSIM | Isaac Sim |
|---------|-------|-------|-----------|
| **Engine** | UE5.5 | Unity3D | Omniverse |
| **License** | MIT | Apache 2.0 | Free/Commercial |
| **Primary use** | AV research | Autoware testing | General robotics |
| **ROS 2** | Native (0.10+) | Native | Via bridge |
| **API** | Full Python API | No API | USD/Python API |
| **LiDAR sim** | Built-in | GPU-accelerated (RGL) | Omniverse RTX |
| **Custom environments** | UE5 editor | Unity editor | USD/Omniverse |
| **Traffic sim** | Yes (multi-agent) | Yes (configurable NPCs) | Limited |
| **Weather/lighting** | Yes + Cosmos | Rain/fog (2025) | Domain randomization |
| **Digital twins** | OpenStreetMaps | Shinjuku included | USD scene import |
| **Neural rendering** | NuRec integration | No | Built-in |
| **Cosmos integration** | Yes (Transfer APIs) | No | Yes |
| **Community size** | 150,000+ | Autoware ecosystem | Broad NVIDIA ecosystem |
| **Airside fit** | Best general choice | Best if using Autoware | Best for custom physics |

**Recommendation for airside simulation:**

**Short-term: CARLA** is the best starting point. It has:
- Largest community and most resources
- Full API for scripting custom airside scenarios (aircraft, GSE, personnel)
- Native ROS 2 for integration with Autoware or custom stacks
- Cosmos/NuRec integration for neural rendering and scene variation
- UE5 editor for creating custom airport environments

**For Autoware integration: AWSIM** is the natural choice if the production stack is Autoware-based, as it works out-of-the-box with Autoware's full pipeline.

**For synthetic data generation: Isaac Sim** excels at generating diverse, physically accurate training data through MobilityGen and domain randomization. Best used to supplement CARLA-based scenario testing.

**Key gap:** none of these simulators ship with airport/airside environments. Custom environment creation is required regardless of choice. CARLA's UE5 editor is the most mature for custom environment authoring. For airside, you need to model:
- Taxiways, aprons, and ramp areas (non-road surfaces)
- Aircraft (parked and taxiing)
- Ground support equipment (tugs, belt loaders, fuel trucks, baggage carts)
- Personnel (marshalling, ramp workers)
- Jet bridges and terminal buildings
- Airport-specific signage and markings

---

## 8. Airside Relevance Summary

### Architecture Decision

| Approach | Stack | When to Use |
|----------|-------|-------------|
| Modular pipeline | Autoware.Universe | Production deployment, safety certification, multi-sensor fusion, gradual component upgrades |
| End-to-end learned | openpilot-style | R&D, world model research, rapid iteration, data-driven improvement |
| Hybrid | Autoware + E2E modules | Best of both: use Autoware pipeline for safety-critical control, swap perception/planning with learned models |

### Recommended Tool Chain for Airside AV Development

```
Data Collection:  ROS 2 bags from fleet
                     |
Annotation:       CVAT (3D LiDAR + camera cuboids)
                     |
Perception:       OpenPCDet or MMDetection3D (custom airside classes)
                     |
World Model:      Custom DiT (borrow comma.ai architecture)
                  + Cosmos Transfer (synthetic data augmentation)
                     |
Planning:         Diffusion Planner (multi-modal, handles airside ambiguity)
                  + CommonRoad (scenario-based safety validation)
                     |
Simulation:       CARLA (custom airport environment)
                  + AWSIM (if Autoware-based)
                     |
Visualization:    Foxglove (fleet data review)
                  + Rerun (ML pipeline debugging)
                     |
Deployment:       Autoware.Universe (modular, certifiable)
                  + TensorRT (NVIDIA edge inference)
```

### Key Takeaways

1. **Autoware.Universe** provides the most production-ready open-source AV stack with strong ROS 2 architecture, active BEV perception integration, and Agnocast for real-time performance. Its modular design allows swapping in world-model-based components.

2. **comma.ai's world model** is the most advanced deployed learned driving simulator. The 2B DiT architecture, future state anchoring, and on-policy training methodology are directly applicable to airside world models. The progression from reprojective sim to full world model sim provides a practical adoption roadmap.

3. **NVIDIA's ecosystem** (Cosmos + Alpamayo + DriveWorks) provides the most comprehensive toolchain for going from data to deployed model, with Cosmos enabling synthetic data amplification and Alpamayo serving as a teacher model for knowledge distillation.

4. **Perception:** OpenPCDet for LiDAR-first development with custom airside classes; MMDetection3D for multi-modal fusion. Both support custom datasets with pre-trained backbone transfer.

5. **Planning:** Diffusion-based planners (ICLR/CVPR 2025) represent the state of the art, with natural multi-modality handling that suits airside's ambiguous scenarios. nuPlan provides the evaluation framework standard.

6. **Simulation:** CARLA with NVIDIA Cosmos integration is the strongest platform but requires custom airport environment development. No open-source airside simulation environments exist.

7. **Tooling:** CVAT for annotation, Foxglove for fleet data management, Rerun for ML debugging -- all open source and self-hostable.

---

## Sources

### Autoware
- [Autoware Overview](https://autoware.org/autoware-overview/)
- [Autoware System Architecture (DeepWiki)](https://deepwiki.com/autowarefoundation/autoware/1.2-system-architecture)
- [BEVDet to BEVFormer in Autoware](https://autoware.org/from-bevdet-to-bevformer/)
- [Autoware Universe Documentation](https://autowarefoundation.github.io/autoware_universe/main/)
- [Autoware Centers of Excellence August 2025 Update](https://autoware.org/autoware-centers-of-excellence-steering-committee-august-2025-update/)
- [Autoware.Flex Paper](https://arxiv.org/abs/2412.16265)
- [Advancing Open Source E2E AI for AD at Scale](https://autoware.org/advancing-open-source-end-to-end-ai-for-autonomous-driving-at-scale/)
- [Agnocast: Zero-Copy IPC for ROS 2](https://github.com/autowarefoundation/agnocast)
- [Agnocast Paper (ISORC 2025)](https://arxiv.org/abs/2506.16882)

### comma.ai
- [Learning to Drive from a World Model (CVPR 2025)](https://arxiv.org/html/2504.19077v1)
- [Learning to Drive from a World Model (Blog)](https://blog.comma.ai/mlsim)
- [openpilot 0.11 Release](https://blog.comma.ai/011release/)
- [openpilot 0.10.1 Release](https://blog.comma.ai/0101release/)
- [openpilot GitHub](https://github.com/commaai/openpilot)

### NVIDIA
- [NVIDIA Alpamayo Developer Page](https://developer.nvidia.com/drive/alpamayo)
- [Alpamayo-R1 on HuggingFace](https://huggingface.co/nvidia/Alpamayo-R1-10B)
- [Alpamayo-R1 Paper](https://arxiv.org/abs/2511.00088)
- [NVIDIA Cosmos Platform](https://www.nvidia.com/en-us/ai/cosmos/)
- [Cosmos Major Release Announcement (March 2025)](https://nvidianews.nvidia.com/news/nvidia-announces-major-release-of-cosmos-world-foundation-models-and-physical-ai-data-tools)
- [DriveWorks DNN Reference](https://developer.nvidia.com/docs/drive/driveworks/latest/nvsdk_dw_html/dnn_mainsection.html)
- [Accelerating AV Simulation with Neural Reconstruction](https://developer.nvidia.com/blog/accelerating-av-simulation-with-neural-reconstruction-and-world-foundation-models/)
- [Isaac Sim 5.0 Announcement](https://developer.nvidia.com/blog/isaac-sim-and-isaac-lab-are-now-available-for-early-developer-preview/)

### Perception Frameworks
- [MMDetection3D GitHub](https://github.com/open-mmlab/mmdetection3d)
- [MMDetection3D Models (DeepWiki)](https://deepwiki.com/open-mmlab/mmdetection3d/4-models)
- [OpenPCDet GitHub](https://github.com/open-mmlab/OpenPCDet)
- [OpenPCDet Custom Dataset Tutorial](https://github.com/open-mmlab/OpenPCDet/blob/master/docs/CUSTOM_DATASET_TUTORIAL.md)
- [Det3D GitHub](https://github.com/V2AI/Det3D)

### Planning Frameworks
- [CommonRoad](https://commonroad.in.tum.de/)
- [CommonRoad 2024 Competition Results](https://arxiv.org/abs/2512.19564)
- [nuPlan Benchmark](https://arxiv.org/abs/2106.11810)
- [nuPlan-R: Reactive Closed-Loop Benchmark](https://arxiv.org/abs/2511.10403)
- [Diffusion Planner (ICLR 2025 Oral)](https://github.com/ZhengYinan-AIR/Diffusion-Planner)
- [DiffusionDrive (CVPR 2025 Highlight)](https://github.com/hustvl/DiffusionDrive)

### Labeling Tools
- [CVAT](https://www.cvat.ai/)
- [CVAT 3D Point Cloud Annotation](https://www.cvat.ai/resources/blog/3d-point-cloud-annotation)
- [Label Studio](https://labelstud.io/)
- [Scalabel](http://www.scalabel.ai/)
- [Best Point Cloud Labeling Tools 2025](https://segments.ai/blog/the-8-best-point-cloud-labeling-tools/)

### Visualization
- [Foxglove](https://foxglove.dev/)
- [Rerun](https://rerun.io/)
- [RViz vs Foxglove vs Rerun Comparison](https://foxglove.dev/robotics/rviz-vs-foxglove-vs-rerun)

### Simulation
- [CARLA Simulator](https://carla.org/)
- [CARLA GitHub](https://github.com/carla-simulator/carla)
- [CARLA Leaderboard](https://leaderboard.carla.org/)
- [AWSIM GitHub](https://github.com/tier4/AWSIM)
- [AWSIM Documentation](https://autoware.org/awsim-end-to-end-digital-twin-simulation-platform/)
- [Isaac Sim](https://developer.nvidia.com/isaac/sim)
