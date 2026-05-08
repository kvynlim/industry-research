# Autoware.Universe Deep Dive

*Last updated: 2026-03-22*

Autoware is the world's leading open-source autonomous driving software stack, built on ROS 2 and maintained by the Autoware Foundation. It powers deployments across **500+ companies**, **30+ vehicle types**, and **20+ countries**. This document provides a comprehensive architectural analysis, module-by-module breakdown, and assessment of what an airside AV could borrow versus build custom.

---

## 1. Full Architecture Overview

Autoware is organized as a **layered, microautonomy architecture** — autonomous driving is decomposed into many small, replaceable capabilities rather than one monolithic system. Each capability (object detection, behavior planning, lane-level routing) is a module with clear inputs and outputs, communicating over ROS 2 topics, services, and actions.

### Two-Tier Software Ecosystem

| Layer | Purpose | Quality Bar |
|-------|---------|-------------|
| **Autoware Core** | Foundational packages maintained by the Autoware Foundation | Unit tests, integration tests, performance validation, on-vehicle testing, semantic versioning |
| **Autoware Universe** | Community-contributed packages from individuals, companies, and research groups | Owner-maintained, acts as a sandbox for experimentation and new algorithms |

### Message Infrastructure

Three message definition layers standardize inter-component communication:
- **autoware_msgs** — common standardized messages
- **autoware_adapi_msgs** — Autonomous Driving API interfaces
- **autoware_internal_msgs** — internal component communication

### Data Flow Pipeline

```
Sensing → Localization → Perception → Planning → Control → Vehicle Interface
   ↑           ↑             ↑           ↑          ↑            ↑
   └───────────┴─────────────┴───────────┴──────────┴────────────┘
                         Map (Lanelet2 + PCD)
```

**Sensing** publishes point clouds, images, GNSS, and IMU data on `/sensing/*` topics. **Perception** processes these streams and outputs `/perception/objects`, `/perception/traffic_lights`, and `/perception/lane_markings`. **Localization** fuses perception with GNSS/IMU, producing `/localization/pose` (vehicle position) and `/localization/twist` (velocity). **Planning** consumes localization pose, perception objects, and traffic signals to produce `/planning/trajectory`. **Control** executes the trajectory, outputting `/control/command`. **Vehicle Interface** translates control commands to physical actuators via `/vehicle/command`.

### Communication Patterns

- **Topics**: asynchronous streaming (sensor data, perception outputs)
- **Services**: request-response operations (map queries, route planning)
- **Actions**: long-running goal-based operations (trajectory execution with feedback)

---

## 2. Component-by-Component Breakdown

### 2.1 Sensing

The sensing pipeline acquires raw environmental data and preprocesses it for downstream consumption.

**Sensor Drivers:**
- LiDAR drivers (point cloud generation)
- Camera drivers (image streams)
- Radar drivers (velocity/distance detection)
- GNSS drivers (global positioning)
- IMU drivers (inertial measurement)

**Pointcloud Preprocessor** (`autoware_pointcloud_preprocessor`):
The preprocessing flow for each LiDAR sensor includes:

| Filter | Function |
|--------|----------|
| **CropBox Filter** | Removes points within a given bounding box (e.g., ego vehicle body) |
| **Polygon Remover Filter** | Removes points within arbitrary polygon regions |
| **Distortion Corrector** | Compensates for pointcloud distortion caused by ego vehicle movement during one scan |
| **Outlier Filter** | Eliminates noise from hardware problems, rain drops, and small insects |
| **Downsample Filter** | Reduces point cloud density for computational efficiency |
| **Passthrough Filter** | Filters points based on value ranges in x, y, z, intensity |
| **Pointcloud Accumulator** | Gathers multiple frames over a defined time window |
| **Pointcloud Densifier** | Enhances sparse clouds using information from previous frames |
| **Vector Map Filter** | Removes points outside lane boundaries using map data |
| **Cloud Concatenator** | Merges and time-synchronizes point clouds from multiple LiDAR sensors |

After concatenation, **Ground Segmentation** is applied (RANSAC-based, ray-based, or scan-based variants). These modules run in a single composable node container leveraging intra-process communication for minimal overhead.

---

### 2.2 Localization

Localization determines the vehicle's precise 6-DOF pose within the map. Autoware provides multiple localization strategies that can be combined.

#### NDT Scan Matching (Primary Method)

The Normal Distributions Transform (NDT) is Autoware's primary localization algorithm, matching live LiDAR scans against a pre-built 3D point cloud map.

**How it works:**

1. **Map Representation**: The point cloud map is partitioned into 3D voxels. For each voxel, a centroid and covariance matrix are computed from the enclosed points, yielding a per-voxel multivariate Gaussian distribution. This transforms the discrete point cloud into a smooth, differentiable probability field.

2. **Scan Registration**: Rather than matching individual points, the algorithm evaluates how well each incoming scan point aligns with the probability distribution of its enclosing voxel. A point detected millimeters from where the map predicts a surface will still receive a high alignment score.

3. **Optimization**: The alignment problem is formulated as a differentiable optimization: maximize the sum of probability scores across all scan points. A Newton nonlinear optimizer iteratively refines the 6-DOF pose estimate (x, y, z, roll, pitch, yaw) to find the best match.

4. **Output**: The resulting pose is published with a confidence score and fed to the EKF for fusion with other sources.

#### EKF Localizer

The Extended Kalman Filter fuses multiple pose and twist sources:
- NDT scan matcher pose
- GNSS pose
- Gyro odometry twist
- Eagleye pose/twist (optional)

#### Eagleye (GNSS/IMU Localizer)

Eagleye is an open-source GNSS/IMU-based localizer developed by MAP IV that provides a cost-effective alternative to LiDAR-based localization.

- **Inputs**: GNSS, IMU, and vehicle speed
- **Accuracy**: 0.5m per 100m relative positioning; 1.5m absolute positioning in urban areas (sufficient for lane distinction)
- **Integration modes**: (1) Feed only twist into EKF (improves NDT stability), or (2) feed both twist and pose (enables LiDAR-free localization)
- **Default**: Autoware launches `gyro_odometer` for twist estimation by default

---

### 2.3 Perception Pipeline

The Perception Component receives inputs from Sensing, Localization, and Map, and adds semantic information — Object Recognition, Obstacle Segmentation, Traffic Light Recognition, and Occupancy Grid Map — which is passed to the Planning Component.

#### 2.3.1 LiDAR Object Detection

**CenterPoint** (`autoware_lidar_centerpoint`):
- PointPillars-based network for 3D object detection
- Inference via TensorRT (FP16 or FP32)
- Detects 5 classes: CAR, TRUCK, BUS, BICYCLE, PEDESTRIAN
- Standard model trained on nuScenes (~28k frames) + TIER IV internal (~11k frames) for 60 epochs
- Tiny variant trained on Argoverse 2 (~110k frames) + internal data for 20 epochs
- Detection range: [-76.8m, 76.8m] with 0.32m voxel size
- Trained using mmdetection3d

**TransFusion** (`autoware_lidar_transfusion`):
- Transformer-based 3D object detection from LiDAR data
- TensorRT inference with NMS post-processing (circle-based and IoU-based)
- Same 5 classes, trained on ~11k internal frames for 50 epochs
- Alternative to CenterPoint with emphasis on transformer-based fusion

#### 2.3.2 Euclidean Clustering

`autoware_euclidean_cluster` groups non-ground points into object detections:
- Points are clustered using a distance threshold that varies with radial distance (no fixed ring partition)
- Uses a KD-tree for nearest-neighbor queries
- Points assigned to a cluster are removed from the spatial hash to reduce computation
- Ground points removed first via RANSAC-based ground plane estimation

#### 2.3.3 Camera Object Detection

**YOLOX** (`autoware_tensorrt_yolox`):
- Detects cars, trucks, bicycles, and pedestrians in camera images
- Models auto-converted to TensorRT format (.engine) from ONNX
- Variants: `yolox-tiny.onnx` and `yolox-sPlus-opt.onnx` (tuned for accuracy with comparable speed)
- EfficientNMS_TRT module attached for accelerated non-maximum suppression
- RTMDet integration planned for improved instance segmentation

**BEV-based Vision** (emerging):
- BEVDet and BEVFormer approaches being explored for vision-first perception
- AutoSeg foundation model with HydraNet architecture: single backbone splitting into multiple heads for lane lines, ego path, segmentation, objects, and 3D

#### 2.3.4 Sensor Fusion

**Image Projection-Based Fusion** (`autoware_image_projection_based_fusion`):
- Integrates 2D image detections with 3D point cloud data
- Fuses bounding boxes or segmentation from cameras with LiDAR clusters or bounding boxes
- Refines obstacle classification and detection accuracy

**PointPainting Fusion**:
- Projects LiDAR points onto 2D object detection output
- Appends class confidence scores to each point
- Feeds enriched point cloud into 3D object detection network

#### 2.3.5 Multi-Object Tracking

The multi-object tracker consists of **data association** and **EKF (Extended Kalman Filter)** tracking.

**Data Association:**
- Solves a min-cost max-flow matching problem using the MUSSP solver
- Uses gating based on: BEV area, Mahalanobis distance, and maximum distance (configurable per class)
- Processes messages as early as they become available (LiDAR clusters at ~10Hz, camera detections at lower rates)

**Object-Specific Models:**
- Separate EKF models for pedestrians, bicycles/motorcycles, passenger cars, and large vehicles
- Pedestrian and bicycle trackers run simultaneously to enable type transitions
- Passenger car and large vehicle models also run in parallel for stability

**Detection-by-Tracker** (`autoware_detection_by_tracker`):
- Uses tracker predictions to guide detection in subsequent frames
- Improves continuity when objects are momentarily undetected

#### 2.3.6 Motion Prediction

**Map-Based Prediction** (`autoware_map_based_prediction`):
- Forecasts future trajectories for vehicles and pedestrians using road network geometry
- Maintains time-series object history to identify current lanelets
- Classifies maneuvers: lane-following, left lane-change, right lane-change
- Uses quintic polynomial fitting in Frenet frames for path generation
- Detection via geometric (lateral distance to boundaries) and temporal (time-to-boundary) domains
- Assumes constant velocity for non-vehicle objects; straight-line predictions for off-road objects

#### 2.3.7 Occupancy Grid Map

**Probabilistic Occupancy Grid Map** (`autoware_probabilistic_occupancy_grid_map`):

Detects blind spots — areas with no information where dynamic objects may emerge unexpectedly.

**Algorithm (3 steps):**
1. **Polar Coordinate Transform**: Input point clouds converted to polar coordinates centered on sensor origin, divided into angular bins with range data
2. **Ray Tracing (Bresenham's Algorithm)**: Initialize freespace to farthest bin point → fill unknown cells beyond obstacles (accounting for sensor inaccuracy) → mark occupied cells at obstacle locations with interpolation
3. **Bayesian Probability Update**: Binary Bayesian filter updates existence probability using previous occupancy grid, with time-decay for unobserved cells

**I/O:**
- Input: `obstacle_pointcloud` + `raw_pointcloud` (sensor_msgs::PointCloud2)
- Output: `occupancy_grid_map` (nav_msgs::OccupancyGrid)
- Supports `OccupancyGridMapProjectiveBlindSpot` for handling occlusion with projective geometry

#### 2.3.8 Traffic Light Recognition

- Detects and classifies traffic signal states (red, green, yellow, arrow)
- Requires GPU for inference
- Feeds directly into the behavior velocity planner's traffic light module

---

### 2.4 Planning Pipeline

The planning component generates trajectory messages from environmental data. It follows a hierarchical structure:

```
Mission Planning → Scenario Planning → Validation → Control
                      ├── Lane Driving
                      │     ├── Behavior Path Planner
                      │     └── Motion Planner
                      └── Parking
                            └── Freespace Planner
```

**Output specification**: Trajectory with pose/velocity/acceleration, 10-second horizon, 0.1-second resolution.

#### 2.4.1 Mission Planner

- Calculates route from current ego position to destination
- Uses Lanelet2 vector map (driving lanes, traffic rules, topology)
- Creates routing graph for shortest-path calculation
- Publishes route as a sequence of lanelet primitives

#### 2.4.2 Behavior Path Planner

Plans the path to follow from the given route. Uses a **behavior tree** mechanism for module management (vs. state machine) for easy visualization, configuration, and scalability.

**Scene Modules:**

| Module | Function |
|--------|----------|
| **Lane Following** | Generate lane centerline path from map |
| **Lane Change** | Execute lane changes when necessary, with collision checks against other vehicles |
| **Static Obstacle Avoidance** | Avoid parked vehicles or overtake low-speed obstacles at road edges |
| **Goal Planner** | Plan pull-over path to park at road shoulder |
| **Start Planner** | Plan pull-out path from stopped position |
| **Side Shift** | Shift path laterally based on external instructions (remote control) |

**Path Generation**: Uses constant-jerk profiles for smooth lateral shifts of the reference path (center line).

#### 2.4.3 Behavior Velocity Planner

Adjusts velocity based on traffic rules through pluggable modules:

| Module | Function |
|--------|----------|
| **Traffic Light** | Stop at red lights; pass/emergency-stop logic for yellow lights based on stopping feasibility |
| **Crosswalk** | Yield to pedestrians/bicycles when traffic light is GREEN or UNKNOWN; considers object behavior and surrounding traffic |
| **Intersection** | Judges go/no-go at intersections using dynamic objects; handles stuck vehicles; inserts stop lines before overlap regions |
| **Stop Line** | Stop before stop lines and restart after stopping |
| **Blind Spot** | Detect and handle blind spots at intersections |
| **Detection Area** | Velocity adjustment for configurable detection zones |
| **Occlusion Spot** | Handle areas with limited visibility |
| **Run Out** | Prepare for pedestrians/objects suddenly entering the path |
| **No Drivable Lane** | Handle scenarios where no drivable lane exists |
| **Virtual Traffic Light** | V2I-based traffic light control |

#### 2.4.4 Motion Planner / Path Optimizer

**Path Optimizer** (`autoware_path_optimizer`):
Uses Model Predictive Trajectory (MPT) optimization:

- Defines vehicle pose in Frenet coordinates relative to the reference path
- Minimizes tracking errors via QP optimization while considering vehicle kinematics and collision constraints
- Processes shorter trajectory segments (~50m) for reduced computation cost

**Cost Function Components:**
- Lateral error tracking
- Yaw error and yaw rate
- Steering input smoothness and rate constraints
- Terminal and goal position penalties (weights 100-1000x)

**Collision-Free Constraints:**
- Hard clearance from road boundaries (default: 0.0m)
- Soft clearance margins (default: 0.1m)
- Vehicle footprint approximated as circles (configurable methods)
- L-infinity norm option for robustness

**Replan Triggers**: Ego moves >5.0m, goal moves >15.0m, time threshold exceeded (1.0s), path shape changes >2.0m laterally.

**Path Smoother**: Elastic band techniques for smooth, feasible trajectories.

**Motion Velocity Smoother**: Final velocity profile with jerk constraints.

#### 2.4.5 Sampling-Based Planner

- Includes Bezier Sampler, Frenet Planner, and Path Sampler for generating diverse trajectory options

#### 2.4.6 Freespace Planner

- Enables parking and tight-space maneuvers using RRT* algorithm

#### 2.4.7 Diffusion Planner (Learning-Based)

A transformer-based approach for closed-loop planning:
- Uses DiT (Diffusion Transformer) architecture
- Learns gradient of trajectory score function to model multi-modal driving distributions
- Enables personalized planning behavior through classifier guidance
- Fast inference: ~20Hz for real-time performance
- Evaluated on nuPlan benchmark: state-of-the-art closed-loop performance
- Integrated into Autoware via ONNX decomposition through GraphSurgeon for plug-and-play evaluation

#### 2.4.8 Supporting Systems

- **Costmap Generator**: Provides occupancy data for planning algorithms
- **Surround Obstacle Checker**: Validates that planned paths avoid surrounding obstacles
- **Planning Validator**: Validates trajectory safety through collision checking
- **Planning Evaluator**: Metrics evaluation for planning quality
- **Trajectory Optimizer**: QP-based smoothing, kinematic feasibility enforcement, continuous jerk filtering

---

### 2.5 Control

The control subsystem translates planned trajectories into vehicle actuation commands.

#### Lateral Control

**MPC Lateral Controller** (`autoware_mpc_lateral_controller`):
- Linear Model Predictive Control formulated as a Quadratic Program (QP)
- Three vehicle models: Kinematics (bicycle with steering delay, default), Kinematics_no_delay, and Dynamics (with slip angle)
- Two QP solvers: `Unconstraint_fast` (Eigen-based least squares) and `OSQP` (ADMM for constrained optimization)
- Default: 50-step prediction horizon at 0.1s intervals
- Steering input delay compensation: 0.24s
- Butterworth filter (3 Hz cutoff) for noise reduction
- Weight parameters analogous to PID: `weight_lat_error` (P-like), `weight_heading_error` (D-like)

**Pure Pursuit Controller** (`autoware_pure_pursuit`):
- Geometric steering algorithm for simpler tracking scenarios
- Lower computational cost; used for parking (AVP) and less demanding ODDs

#### Longitudinal Control

- PID-based proportional-integral-derivative feedback controller
- Manages acceleration, braking, and speed following

#### Vehicle Command Gate

- Safety validation before commands reach actuators
- Enforces limits on steering rate, acceleration, and jerk

---

### 2.6 Vehicle Interface

The Vehicle Interface bridges Autoware's control commands and the physical vehicle:

- Converts Autoware-standard commands (`/control/command`) to vehicle-specific CAN bus messages
- Converts vehicle status (CAN feedback) to Autoware-standard messages
- Supports multiple drive-by-wire systems:
  - **PACMod2 / PACMod3** (AutonomouStuff): controls steering, throttle, brake, transmission via CAN
  - Generic vehicle interface for custom platforms
  - PACCAR vehicle integration
- Works with Kvaser CAN devices and Linux SocketCAN drivers
- Hardware-agnostic design enables integration with any drive-by-wire capable vehicle

---

### 2.7 Map Component

Autoware requires two map types:

**Point Cloud Map (PCD)**:
- 3D point cloud of the environment for NDT localization
- Generated via SLAM (e.g., LIO-SAM, hdl_graph_slam) or survey-grade scanners

**Vector Map (Lanelet2 format)**:
- Contains lane geometry, traffic lights, stop lines, crosswalks, parking spaces
- Each lanelet encodes: right of way, speed limits, traffic direction, associated signals
- Uses OpenStreetMap (OSM) XML as the base format
- Created using TIER IV's free web-based **Vector Map Builder**
- Required for route planning, traffic light detection, and trajectory prediction

---

## 3. Autoware.Flex — The E2E AI Extension

TIER IV launched a major initiative toward **Level 4+** autonomy in April 2025, publicly sharing the architecture through the Autoware Foundation. Level 4+ operates within Level 4 parameters but incorporates Level 5 elements, enabling vehicles to "operate under virtually all conditions by flexibly expanding their operational design domains."

### Transition Roadmap

Autoware's E2E transition occurs in four phases:

1. **Current state**: Traditional modular robotic stack (perception → planning → control)
2. **Step 1 — Learned Planning**: Deep learning applied to planning decisions (Diffusion Planner)
3. **Step 2 — Deep Perception + Learned Planning**: Neural networks for both perception and planning (AutoSeg + AutoSteer)
4. **Step 3 — Monolithic E2E**: Single neural network from sensor data to steering/acceleration
5. **Step 4 — Hybrid E2E**: Monolithic network with "guardian" redundancy systems

### Two System Configurations

**Hybrid System (Perception AI + Planning AI):**
- Uses diffusion models to probabilistically capture temporal environmental changes
- Combines environment perception from multiple ML models with decision-making and trajectory generation
- Mimics human driving behavior
- More interpretable; easier to debug and validate

**End-to-End System:**
- Treats surroundings and driving status as vector representations
- Leverages world models to integrate perception, planning, and control into a single learning process
- Seamless environmental recognition to vehicle operation

### Key Neural Network Models

| Model | Function | Details |
|-------|----------|---------|
| **AutoSpeed** | Longitudinal control (speed/acceleration) | Neural network for ADAS L2+ evolving to L4+ |
| **AutoSteer** | Lateral control (steering) | Neural network for path-following decisions |
| **AutoSeg** | Perception foundation model | HydraNet architecture: single backbone → multiple heads for lane lines, ego path, segmentation, objects, 3D |
| **Diffusion Planner** | Trajectory generation | Transformer-based diffusion model for multi-modal planning |

### CES 2026 Demonstration

At CES 2026 (January 2026), TIER IV demonstrated:
- Live E2E AI simulation for autonomous driving
- AutoSpeed and AutoSteer running on AMD Versal AI Edge Series computing platforms
- Level 4+ passenger vehicle jointly tested with RoboCars Inc.
- SOAFEE-based extensions for safety-critical automotive and off-road applications (partnership with driveblocks)

### NVIDIA World Model Integration

TIER IV is integrating NVIDIA's AI models into the Autoware stack:

**Alpamayo** (Vision-Language-Action model):
- 10-billion-parameter model introducing reasoning layers via chain-of-thought processing
- Interprets complex scene dynamics with human-like judgment
- Enhances transparency and traceability in AI decision-making

**Cosmos World Foundation Model** (three core functions):
- **Cosmos-Predict**: Generates synthetic edge cases from multimodal prompts
- **Cosmos-Transfer**: Data augmentation across environmental conditions (rain, snow, time of day)
- **Cosmos-Reason**: Searches and validates driving datasets using vision-language models

### MLOps Platform

TIER IV's machine learning operations platform supports:
- Data quality validation and anonymization
- Tagging and annotation with active learning frameworks
- Synthetic and real-world data combination
- Continuous AI model performance improvement
- Co-MLOps collaborative data platform (launched 2024)

---

## 4. NDT Scan Matching — Deep Technical Details

NDT (Normal Distributions Transform) is Autoware's primary localization algorithm, originally developed by Peter Biber at the University of Tubingen.

### Algorithm

**Step 1 — Build ND Map:**
The point cloud map is partitioned into 3D voxels. For each voxel containing ≥ threshold points, compute the centroid **μ** and covariance matrix **Σ**. Each voxel now stores a multivariate Gaussian N(**μ**, **Σ**) — a compact, differentiable representation replacing the discrete point cloud.

**Step 2 — Score Function:**
For an incoming scan point **x** falling in voxel *k*, the score contribution is:

```
s(x) = exp(-0.5 * (x - μ_k)^T * Σ_k^{-1} * (x - μ_k))
```

The total score S is the sum of s(x) across all scan points.

**Step 3 — Optimization:**
Find the 6-DOF pose **T** = (x, y, z, roll, pitch, yaw) that maximizes S. Because the score function is differentiable (Gaussian in each voxel), gradients and Hessians can be computed analytically. A Newton nonlinear optimizer iteratively refines **T** using gradient descent, converging to the best alignment.

**Step 4 — Output:**
The estimated pose is published with a fitness score (quality metric) and fed into the EKF localizer for fusion with GNSS, IMU, and wheel odometry.

### Advantages

- Fast: grid representation avoids expensive point-to-point matching
- Robust: smooth probability field tolerates sensor noise
- Differentiable: enables gradient-based optimization with fast convergence

### Failure Modes

- Degeneracy in feature-poor environments (long corridors, open fields)
- Map staleness (construction, seasonal changes)
- Initial pose must be reasonably close to truth for convergence

---

## 5. Agnocast Zero-Copy Middleware

Agnocast is a novel true zero-copy IPC middleware developed by TIER IV for ROS 2, now fully adopted across Autoware. It was accepted at IEEE ISORC 2025.

### Why Agnocast Exists

Standard ROS 2 DDS-based communication serializes and deserializes messages for inter-process communication, adding significant overhead for large messages (e.g., point clouds at ~1MB per message). IceOryx achieves zero-copy but only for static-sized messages. Dynamic types like `PointCloud2` (containing `std::vector`) fall back to serialization with IceOryx.

### Architecture (3 Components)

1. **Client Library (agnocastlib)**: Provides publish/subscribe APIs compatible with rclcpp — publishers use `borrow_loaded_message()`, subscribers receive `agnocast::message_ptr<T>` parameters
2. **Heap Runtime (agnocast_heaphook)**: Intercepts all malloc/free calls via `LD_PRELOAD` and redirects them to a shared virtual address range
3. **Kernel Module (agnocast_kmod)**: Manages metadata transactionality, reference counters, subscriber receipt tracking, and process termination cleanup

### How Zero-Copy Works

Rather than modifying C++ allocator templates (which ROS 2's rosidl hardcodes to `std::allocator`), Agnocast intercepts all memory allocation calls and redirects them to shared memory:

1. Publisher process allocates message data in a shared memory heap
2. Subscriber processes map the publisher's heap into their virtual address space **at the same offset** in read-only mode
3. Virtual addresses remain consistent across all participating processes
4. Direct pointer passing eliminates serialization/deserialization entirely
5. The kernel module maintains per-topic metadata (message virtual addresses, reference counters, subscriber receipt tracking)
6. Memory is deallocated when both the reference count and unreceived subscriber count reach zero

### Performance Results

Tested on Intel Xeon E-2278GE with Linux Kernel 6.2, on Autoware Universe v0.41.2:

| Metric | Before (ROS 2 DDS) | After (Agnocast) | Improvement |
|--------|--------------------|--------------------|-------------|
| LiDAR preprocessing avg response time | 64.5 ms | 54.5 ms | **16%** |
| LiDAR preprocessing worst-case response time | 99.5 ms | 74.3 ms | **25%** |
| Network traffic (single LiDAR topic) | Baseline | ~1/3 of baseline | **~67% reduction** |
| Communication latency (1MB message) | Variable | < 0.1 ms | Constant regardless of size |

**Key property**: Agnocast maintains constant IPC overhead regardless of message size, even for unsized message types. IceOryx's latency grows linearly with message size for dynamic types.

### Integration with Autoware

- Enabled via environment variable: `ENABLE_AGNOCAST=1`
- Requires kernel module insertion: `insmod agnocast_kmod`
- Launch file changes: `LD_PRELOAD` for heap hook
- Smart pointer namespace change from `rclcpp` to `agnocast`
- Bridge processes relay messages between Agnocast and standard ROS 2 nodes for mixed deployments
- Supports QoS parameters (history, depth, reliability, durability); liveliness and deadline not yet supported

---

## 6. Deployment Status

### Scale

- **500+ companies** utilizing the platform
- **30+ vehicle types** supported
- **20+ countries** with active deployments

### Specific Deployment Examples

**Japan — Autonomous Bus Services:**
- TIER IV + Isuzu: Level 4 autonomous buses using NVIDIA DRIVE Hyperion in Isuzu ERGA electric and diesel models (announced March 2026)
- Komatsu, Ishikawa Prefecture: Regular autonomous bus service connecting the city's airport and train station
- Shiojiri, Nagano Prefecture: Japan's first Level 4 certification at speeds up to 35 km/h on public roads shared by pedestrians and general traffic
- Suzuki Solio: Autonomous shuttle service operational since November 2025, powered by Autoware using TIER IV's robotaxi reference design

**Global Testing Programs (2026):**

| Location | Partner | Vehicle | Use Case |
|----------|---------|---------|----------|
| Tokyo | University of Tokyo | Toyota JPN TAXI | Urban hub travel |
| Pittsburgh | Carnegie Mellon University | Hyundai IONIQ 5 | Robotaxi/airport routes |
| Munich | Technical University of Munich | Volkswagen T7 Multivan | Urban safety scenarios |

**BrightDrive (Europe/Middle East):**
- Designed, integrated, and deployed autonomous vehicle platforms for passenger transportation and logistics
- Validating Autoware E2E AI models on production-oriented platforms in public road environments

### Supported Use Cases

- **Robo-Taxi**: Fully autonomous (Level 4) taxis in dense urban environments
- **Cargo Delivery**: Transport of goods between multiple points, last-mile delivery
- **Autonomous Shuttle/Bus**: Fixed-route public transit
- **Autonomous Valet Parking**: Depot maneuvering
- **Autonomous Racing**: Indy Autonomous Challenge competitions using AWSIM

### Autoware Foundation Members

**Premium and active members include**: TIER IV, ADASTEC Corp., AutoCore.ai, Amazon Web Services (AWS), Deepen AI, Hesai Technology, Hitachi, Leo Drive, Macnica, PIX Moving, Neolix Technologies, NEXTY Electronics, Advantech, and others. The foundation continues to grow with regular new member additions.

---

## 7. How to Add World Model Integration

Autoware's modular architecture provides clear integration points for world models. Here is a practical approach:

### Integration Points

**1. Prediction Module Replacement/Augmentation:**
The existing `autoware_map_based_prediction` module is the most natural insertion point. A world model can replace or augment the quintic polynomial trajectory prediction with learned, multi-modal trajectory forecasts.

- **Input**: Tracked objects (position, velocity, type) + Lanelet2 map data
- **Output**: `TrackedObjects` with predicted paths and probability distributions
- The prediction architecture explicitly supports neural network-based approaches: "the scene interpretation could infer intentions based on neural networks, or use a neural network to generate trajectories or estimate parameters of a Gaussian distribution"

**2. Planning Module (Diffusion Planner Pattern):**
Follow the Diffusion Planner integration pattern:
- Decompose monolithic ONNX model into independently executable modules via GraphSurgeon
- Plug into the Autoware + AWSIM stack for closed-loop evaluation
- Replace or run in parallel with the rule-based planning pipeline

**3. Perception Module (Foundation Model):**
Replace individual perception components with a unified world model:
- AutoSeg HydraNet pattern: single backbone → multiple heads
- BEVFormer for camera-only 3D perception
- Use the existing `autoware_image_projection_based_fusion` interface

**4. NVIDIA Cosmos Integration Pattern:**
Follow TIER IV's approach of integrating NVIDIA world foundation models:
- Cosmos-Predict for synthetic edge case generation (training data)
- Cosmos-Reason for validation dataset search
- Alpamayo for reasoning layers with chain-of-thought processing

### Technical Implementation Steps

1. **Create a ROS 2 node** that subscribes to `/perception/objects` and `/localization/pose`
2. **Run inference** through the world model (ONNX + TensorRT recommended)
3. **Publish predictions** in Autoware message formats (`autoware_perception_msgs`)
4. **Register as a planning plugin** or perception plugin in the launch configuration
5. **Use AWSIM** for closed-loop validation before on-vehicle testing
6. **Leverage Agnocast** for zero-copy communication if handling large tensors

### Interaction-Aware Prediction (Advanced)

Autoware's prediction architecture explicitly considers tighter integration levels:
- **Lonely-world prediction**: Each agent predicted independently (current default)
- **Interaction-aware**: Consider interactions between agents (e.g., GRIP++, TraPHic networks)
- **Planning-integrated**: Planner calls prediction to simulate scenarios, or planning and prediction run simultaneously — this is the world model integration sweet spot

---

## 8. ROS 2 Humble/Jazzy Support

### Current Status

Autoware currently runs on **ROS 2 Humble Hawksbill** (Ubuntu 22.04).

### Jazzy Migration Timeline

| Milestone | Date | Description |
|-----------|------|-------------|
| Jazzy Docker Beta | February 2026 | Initial Docker-based Jazzy support |
| Jazzy Full Support | April 2026 | Dual CI coverage (Humble + Jazzy) |
| Humble Soft-Freeze | January 2027 | Standard support ends; no destructive changes |
| Jazzy Exclusive Mode | May 2027 | Humble reaches end of support |

### Migration Constraints

- Initial Jazzy goal: sufficient to build and run with PlanningSimulator
- Destructive changes for Autoware behavior on ROS 2 Humble are **not permitted** during the transition
- Known challenges: QoS argument compatibility, missing binary distributions (navigation2), Open3D unavailability for Ubuntu 24.04 (Noble), Boost.Geometry errors

---

## 9. AWSIM Simulator

AWSIM is an open-source digital twin simulator purpose-built for Autoware, maintained by TIER IV.

### Core Architecture

- Built on **Unity 6000.0.61f1** (C# — 93.7% of codebase)
- Uses **ROS2ForUnity** for high-performance communication (higher throughput and lower latency than bridge solutions)
- Uses the same ROS 2 topics and messages as the actual vehicle
- Vehicle dynamics specifically tuned for Autoware's control requirements

### Sensor Simulation

| Sensor | Implementation |
|--------|---------------|
| LiDAR | Ray-traced simulation via Robotec GPU LiDAR (RGL) |
| Camera | OpenCV-based RGB camera simulation |
| IMU | Inertial measurement simulation |
| GNSS | Global positioning simulation |

### Environment and Traffic

- Digital twin of **Shinjuku, Tokyo** area provided with Lanelet2 and point cloud maps
- Configurable traffic: randomized seed, NPC count, spawning points
- Traffic respects Lanelet2 maps, traffic lights, and right of way
- Rain and fog simulation features (AWSIM-Labs)
- ASAM OpenSCENARIO compatibility

### Rendering

- **HDRP** (High Definition Render Pipeline) for maximum visual quality
- **URP** (Universal Render Pipeline) for better performance
- AWSIM v2.0.0 supports both in a single project

### Additional Features

- Controllable time scale for accelerated/decelerated testing
- Logitech G29 steering wheel support for manual control
- Reset vehicle positions during runtime
- Multiple scenes and vehicle setups
- V2I (Vehicle-to-Infrastructure) development support

### Licensing

- Code: Apache 2.0
- Assets: CC BY-NC (Creative Commons Attribution-Noncommercial)

---

## 10. Minimum Hardware Requirements

### Software Development / Simulation

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 8 cores | 16+ cores |
| RAM | 16 GB | 32+ GB |
| GPU | None (basic functionality) | NVIDIA with 8+ GB VRAM |
| Storage | 100+ GB SSD | NVMe SSD recommended |
| OS | Ubuntu 22.04 (Humble) | Ubuntu 22.04 / 24.04 (Jazzy, coming) |

**GPU is mandatory for**: LiDAR-based object detection (CenterPoint/TransFusion), camera-based object detection (YOLOX), traffic light detection and classification, and any neural network inference.

### On-Vehicle Compute

Autoware is tested on and supports multiple embedded platforms:

| Platform | Vendor | TOPS | Notes |
|----------|--------|------|-------|
| **Jetson AGX Orin** | NVIDIA | 275 | 12-core ARM Cortex-A78AE, 2048 CUDA cores, 64 Tensor cores, 32/64 GB DRAM, 204 GB/s bandwidth |
| **DRIVE AGX Orin** | NVIDIA | 254+ | Automotive-grade, DRIVE OS 6 |
| **AVA Platform** | ADLINK | Varies | x86-based industrial edge |
| **PCU** | AutoCore | Varies | Heterogeneous compute |
| **Bluebox III** | NXP | Varies | Automotive ECU |

Autoware emphasizes being **hardware-agnostic** — "scalable and customized to work with distributed or less powerful hardware." The Open AD Kit (first SOAFEE blueprint for Software-Defined Vehicles) provides reference integration patterns.

---

## 11. Airside AV: What to Borrow vs Build Custom

### What an Airside AV Can Borrow from Autoware

**High-value, directly reusable components:**

| Component | Reusability | Rationale |
|-----------|-------------|-----------|
| **Sensing pipeline** | HIGH | Point cloud preprocessing, concatenation, ground segmentation — works identically on tarmac |
| **NDT localization** | HIGH | Works with any pre-built 3D point cloud map; airports can be mapped with survey-grade accuracy |
| **EKF localizer** | HIGH | Sensor fusion logic is environment-agnostic |
| **Occupancy grid map** | HIGH | Blind spot detection critical for airside safety around aircraft, tugs, and GSE |
| **Multi-object tracker** | HIGH | Data association + EKF tracking works for any moving objects |
| **Control (MPC/PID)** | HIGH | Vehicle dynamics models are parameterizable; works for any drive-by-wire platform |
| **Vehicle interface** | HIGH | PACMod / CAN bus integration pattern reusable for any DBW vehicle |
| **AWSIM simulation** | MEDIUM-HIGH | Can create digital twin of airport environment; need custom Lanelet2 maps |
| **Agnocast middleware** | HIGH | Zero-copy IPC benefits any system with large point cloud messages |
| **ROS 2 framework** | HIGH | Message types, node lifecycle, composable containers all reusable |

**Medium-value, needs adaptation:**

| Component | Reusability | Adaptation Needed |
|-----------|-------------|-------------------|
| **CenterPoint / TransFusion** | MEDIUM | Retrain on airport-specific objects (aircraft, baggage carts, tugs, jet bridges, FOD). Classes differ significantly from on-road (CAR, TRUCK, BUS, BICYCLE, PEDESTRIAN) |
| **Euclidean clustering** | MEDIUM-HIGH | Works as-is for general obstacle detection; distance thresholds may need tuning for large aircraft |
| **Camera detection (YOLOX)** | MEDIUM | Retrain for airport-specific classes (ground crew, aircraft parts, GSE) |
| **Motion prediction** | MEDIUM | Map-based prediction assumes lane-following behavior; airport vehicles have less structured trajectories |
| **Path optimizer (MPT)** | MEDIUM-HIGH | Constraints and cost functions adaptable; road boundary concept maps to taxiway/apron boundaries |

### What Must Be Built Custom

| Component | Why Custom |
|-----------|-----------|
| **Lanelet2 maps for airside** | Airport taxiways, aprons, gates, and service roads have fundamentally different topology than public roads. No lane markings in traditional sense. Need custom map layer for aircraft stand boundaries, safety zones, jet blast areas, and equipment clearance zones |
| **Traffic rules engine** | Airport right-of-way rules (aircraft always have priority, ATC clearances, pushback procedures) have no equivalent in Autoware's on-road rule set |
| **ATC/ACDM integration** | Communication with Airport Collaborative Decision Making systems, SWIM feeds, A-SMGCS — no Autoware equivalent |
| **FOD detection** | Foreign Object Debris detection on runways/taxiways is unique to airports; needs specialized perception pipeline |
| **Aircraft-aware behavior planner** | Must understand jet blast zones, wing-tip clearance, pushback trajectories, fuel truck operations — none of these have on-road analogs |
| **Geofencing and safety zones** | Dynamic safety zones around active aircraft, restricted areas near runways, and NOTAMs-driven route modifications |
| **Regulatory compliance (FAA/EASA)** | FAA has not yet authorized AGVS testing at Part 139 certified airports; custom safety case needed |
| **Redundancy architecture** | Airport operations demand higher redundancy than typical L4 — need independent safety channel with separate sensors and compute |
| **Weather adaptation** | Airside operations in crosswinds, jet blast, heat shimmer, and ice/snow conditions on tarmac surfaces differ from road conditions |
| **V2X for airport** | Vehicle-to-everything communication with ATC, other GSE, and aircraft systems (ACARS) |

### Recommended Architecture Pattern

```
┌─────────────────────────────────────────────────────┐
│                 AIRSIDE AV STACK                     │
├─────────────────────────────────────────────────────┤
│  Custom Layer                                        │
│  ├── ATC Integration Module                          │
│  ├── Airport Traffic Rules Engine                    │
│  ├── Aircraft-Aware Behavior Planner                 │
│  ├── FOD Detection Pipeline                          │
│  ├── Dynamic Geofencing Manager                      │
│  └── Safety Monitor (independent channel)            │
├─────────────────────────────────────────────────────┤
│  Adapted from Autoware (retrained / reconfigured)    │
│  ├── Perception (retrained on airport objects)        │
│  ├── Motion Prediction (adapted for GSE behavior)    │
│  ├── Mission Planner (airport Lanelet2 maps)         │
│  └── Path Optimizer (airport constraints)            │
├─────────────────────────────────────────────────────┤
│  Directly Reused from Autoware                       │
│  ├── Sensing Pipeline (preprocessors, filters)       │
│  ├── NDT Localization + EKF Fusion                   │
│  ├── Occupancy Grid Map                              │
│  ├── Multi-Object Tracker                            │
│  ├── Control (MPC lateral + PID longitudinal)        │
│  ├── Vehicle Interface (CAN/PACMod)                  │
│  ├── Agnocast Zero-Copy Middleware                   │
│  └── ROS 2 Framework + Message Types                 │
├─────────────────────────────────────────────────────┤
│  World Model Integration                             │
│  ├── Scene Understanding (airport-specific)          │
│  ├── Trajectory Prediction (multi-agent, GSE)        │
│  ├── Edge Case Handling (Cosmos-Predict pattern)     │
│  └── Reasoning Layer (Alpamayo pattern)              │
└─────────────────────────────────────────────────────┘
```

### Estimated Reuse Ratio

Roughly **40-50% of Autoware's code can be directly reused** for an airside AV, with another **20-25% adaptable through retraining and reconfiguration**. The remaining **25-40% must be custom-built** to address airport-specific operational requirements, regulatory constraints, and safety standards that have no on-road analogy.

The primary value of building on Autoware is not just code reuse but the **architectural patterns, message interfaces, simulation infrastructure, and the massive community** that accelerates development. Starting from Autoware's proven architecture and adapting it for airside operations is significantly faster than building from scratch, even accounting for the custom components needed.

---

## References

### Autoware Foundation Documentation
- [Autoware Overview](https://autoware.org/autoware-overview/)
- [System Architecture (DeepWiki)](https://deepwiki.com/autowarefoundation/autoware/1.2-system-architecture)
- [Autoware Concepts](https://autowarefoundation.github.io/autoware-documentation/main/design/autoware-concepts/)

### Perception
- [CenterPoint LiDAR Detector](https://autowarefoundation.github.io/autoware_universe/main/perception/autoware_lidar_centerpoint/)
- [TransFusion LiDAR Detector](https://autowarefoundation.github.io/autoware_universe/main/perception/autoware_lidar_transfusion/)
- [Euclidean Cluster](https://autowarefoundation.github.io/autoware_universe/main/perception/autoware_euclidean_cluster/)
- [YOLOX TensorRT](https://autowarefoundation.github.io/autoware.universe/latest/perception/autoware_tensorrt_yolox/)
- [Image Projection-Based Fusion](https://autowarefoundation.github.io/autoware_universe/main/perception/autoware_image_projection_based_fusion/)
- [Probabilistic Occupancy Grid Map](https://autowarefoundation.github.io/autoware_universe/main/perception/autoware_probabilistic_occupancy_grid_map/pointcloud-based-occupancy-grid-map/)
- [Map-Based Prediction](https://autowarefoundation.github.io/autoware_universe/main/perception/autoware_map_based_prediction/)
- [Detection by Tracker](https://autowarefoundation.github.io/autoware_universe/main/perception/autoware_detection_by_tracker/)
- [BEVDet to BEVFormer Vision-First Future](https://autoware.org/from-bevdet-to-bevformer/)

### Planning
- [Planning Components](https://autowarefoundation.github.io/autoware_universe/main/planning/)
- [Planning Architecture](https://tier4.github.io/autoware-documentation/latest/design/autoware-architecture/planning/)
- [Path Optimizer (MPT)](https://autowarefoundation.github.io/autoware_universe/main/planning/autoware_path_optimizer/)
- [Behavior Path Planner](https://autowarefoundation.github.io/autoware_universe/main/planning/behavior_path_planner/autoware_behavior_path_planner/)
- [Lane Change Module](https://autowarefoundation.github.io/autoware_universe/main/planning/behavior_path_planner/autoware_behavior_path_lane_change_module/)

### Control
- [MPC Lateral Controller](https://autowarefoundation.github.io/autoware_universe/main/control/autoware_mpc_lateral_controller/)
- [Pure Pursuit Controller](https://autowarefoundation.github.io/autoware_universe/main/control/autoware_pure_pursuit/)

### Localization
- [NDT Literature Review](https://autowarefoundation.gitlab.io/autoware.auto/AutowareAuto/ndt-literature-review.html)
- [NDT Scan Matcher](https://autowarefoundation.github.io/autoware.universe_planning/pr-5583/localization/ndt_scan_matcher/)
- [Eagleye Integration](https://autowarefoundation.github.io/autoware-documentation/pr-366/how-to-guides/eagleye-integration-guide/)

### Sensing
- [Pointcloud Preprocessor](https://autowarefoundation.github.io/autoware_universe/main/sensing/autoware_pointcloud_preprocessor/)
- [Point Cloud Pre-processing Design](https://autowarefoundation.github.io/autoware-documentation/main/design/autoware-architecture/sensing/data-types/point-cloud/)

### Agnocast
- [Agnocast Paper (IEEE ISORC 2025)](https://arxiv.org/html/2506.16882)
- [Agnocast GitHub Discussion](https://github.com/orgs/autowarefoundation/discussions/5835)
- [Agnocast GitHub Repository](https://github.com/tier4/agnocast)
- [Agnocast Wrapper (Autoware Universe)](https://autowarefoundation.github.io/autoware_universe/main/common/autoware_agnocast_wrapper/)

### E2E AI and Autoware.Flex
- [TIER IV Level 4 Platform Announcement](https://www.prnewswire.com/news-releases/tier-iv-unveils-ai-based-level-4-autonomous-driving-accelerating-global-platform-expansion-across-japan-us-and-europe-302714131.html)
- [CES 2026 E2E AI Showcase](https://www.prnewswire.com/news-releases/tier-iv-to-showcase-e2e-ai-for-level-4-autonomy-at-ces-2026-302652020.html)
- [TIER IV + NVIDIA Cosmos/Alpamayo Integration](https://www.prnewswire.com/news-releases/tier-iv-accelerates-ai-based-level-4-autonomous-driving-with-nvidias-reasoning-based-ai-and-world-foundation-models-302717091.html)
- [Autoware E2E Transition (ThinkAutonomous)](https://www.thinkautonomous.ai/blog/autoware-end-to-end/)
- [AMD Silo AI Collaboration](https://autoware.org/advancing-open-source-end-to-end-ai-for-autonomous-driving-at-scale/)
- [BrightDrive E2E Validation](https://autoware.org/real-world-e2e-model-validation-with-brightdrive/)
- [Diffusion Planner (ICLR 2025)](https://github.com/ZhengYinan-AIR/Diffusion-Planner)

### Simulation
- [AWSIM GitHub](https://github.com/tier4/AWSIM)
- [AWSIM-Labs](https://github.com/autowarefoundation/AWSIM-Labs)
- [AWSIM Overview](https://autoware.org/awsim-end-to-end-digital-twin-simulation-platform/)

### Vehicle Interface and Maps
- [Vehicle Interface Design](https://autowarefoundation.github.io/autoware-documentation/main/design/autoware-interfaces/components/vehicle-interface/)
- [Map Component Design](https://autowarefoundation.github.io/autoware-documentation/main/design/autoware-architecture/map/)
- [Lanelet2 Maps for Autoware](https://autowarefoundation.gitlab.io/autoware.auto/AutowareAuto/lanelet2-map-for-autoware-auto.html)
- [Vector Map Builder](https://tools.tier4.jp/feature/vector_map_builder_ll2)

### Deployment
- [TIER IV + Isuzu Autonomous Buses](https://www.prnewswire.com/news-releases/tier-iv-and-isuzu-advance-autonomous-transit-with-deployment-of-level-4-buses-powered-by-nvidia-drive-hyperion-302714154.html)
- [Japan Level 4 Milestone (EV Magazine)](https://evmagazine.com/self-drive/tier-iv-japans-first-level-4-autonomous-driving-milestone)
- [ROS 2 Jazzy Migration Issue](https://github.com/autowarefoundation/autoware/issues/6695)
- [Autoware Foundation Members](https://autoware.org/about/members/)

### Hardware
- [Installation / Hardware Requirements](https://autowarefoundation.github.io/autoware-documentation/main/installation/)
- [Reference HW Design](https://autowarefoundation.github.io/autoware-documentation/main/reference-hw/)
- [Open AD Kit](https://autoware.org/open-ad-kit/)
