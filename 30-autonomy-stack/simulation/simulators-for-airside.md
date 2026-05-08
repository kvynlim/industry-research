# Open-Source Simulators for Airside Autonomous Vehicle Development

**Research Date:** 2026-03-22
**Scope:** Evaluation of open-source simulation platforms for autonomous vehicle development in airport airside environments (taxiways, aprons, ramps, gate areas).

---

## Table of Contents

1. [CARLA Simulator (UE5.5)](#1-carla-simulator-ue55)
2. [AWSIM (Autoware/Unity)](#2-awsim-autowareunity)
3. [NVIDIA Isaac Sim 5.x](#3-nvidia-isaac-sim-5x)
4. [LGSVL / SVL Simulator (Discontinued)](#4-lgsvl--svl-simulator-discontinued)
5. [AirSim / Project AirSim](#5-airsim--project-airsim)
6. [Gazebo (ROS Testing)](#6-gazebo-ros-testing)
7. [Comparison Matrix](#7-comparison-matrix)
8. [Recommendations for Airside AV Development](#8-recommendations-for-airside-av-development)

---

## 1. CARLA Simulator (UE5.5)

### Current State and Maintenance

CARLA is the most widely-used open-source autonomous driving simulator. It is actively maintained with two parallel development tracks:

| Attribute | Detail |
|---|---|
| **Latest stable release** | 0.9.16 (September 16, 2025) |
| **Engine** | Unreal Engine 5.5 (ue5-dev branch) |
| **Legacy branch** | UE 4.26 (ue4-dev branch, still available) |
| **GitHub stars** | ~13,700 |
| **Contributors** | 161 |
| **Total commits (ue5-dev)** | 6,683+ |
| **License** | MIT |
| **Supported platforms** | Ubuntu 22.04+, Windows 11 |
| **Hardware requirements** | Intel i7/i9 9th gen+ or AMD Ryzen 7/9, 32GB+ RAM, NVIDIA RTX 3070+ (16GB+ VRAM) |

The project is actively maintained. The ue5-dev branch receives nightly builds via GitHub Actions. Neya Systems has collaborated with the CARLA team on the UE5 migration. A prior version, 0.10.0, was also referenced in some documentation as a UE5-based release, but 0.9.16 represents the latest numbered stable release with full feature documentation.

**Key 0.9.16 features:**
- NVIDIA NuRec 25.07 neural reconstruction integration
- NVIDIA Cosmos Transfer1 style transfer for dataset augmentation
- Native ROS 2 connectivity (no bridge required) with DDS-based message passing
- USD SimReady Exporter for Omniverse/Isaac Sim interop
- Left-handed traffic support (UK, Japan, India)
- Wheelchair vulnerable road user model
- Python 3.10/3.11/3.12 wheel support
- Project Chrono 6 physics integration

### Creating Custom Airport Environments in CARLA

#### Map Creation Workflow

CARLA requires two files for any custom map:
1. **`.xodr`** -- OpenDRIVE road network definition
2. **`.fbx`** -- 3D geometry mesh with textures

**Recommended tool:** MathWorks RoadRunner (commercial, not free) generates both formats. An open-source alternative is TrueVision Designer.

**Import methods (source build):**
1. Automatic `make import` (recommended)
2. RoadRunner plugin
3. Manual Unreal Engine import

**Import method (packaged build, Linux only):** Docker-based import, but no UE Editor customization.

#### Airport-Specific Challenges

**Road network (OpenDRIVE):** OpenDRIVE is designed for automotive road networks (lanes, junctions, signals). Airport taxiways and aprons do not map cleanly to this standard. Workarounds:
- Model taxiways as single-lane roads with very low speed limits
- Model apron areas as large parking zones or open-area junctions
- Mark aircraft stands as parking spots
- Use the `make import` method with custom `.xodr` files that encode taxiway centerlines as road segments

**Key limitation:** CARLA's traffic manager and AI-controlled vehicles assume road-legal driving behavior (traffic lights, lane keeping, intersection rules). Airport-specific logic (hold-short lines, pushback procedures, FOD avoidance) requires custom scripting via the Python API.

#### Adding Aircraft and GSE Actors

CARLA supports adding custom vehicle blueprints:

1. Create 3D model (50,000-100,000 triangles) with materials split into bodywork, glass, lights, interior
2. Rig to CARLA's base vehicle skeleton (hierarchy must be preserved; bone positions can be adjusted)
3. Create collision mesh (`SMC_<name>.fbx`) and raycast sensor mesh (`SM_sc_<name>.fbx`)
4. Import into `Content/Carla/Static/Vehicles/4Wheeled`
5. Create Animation Blueprint derived from `VehicleAnimInstance`
6. Create wheel blueprints and configure physics
7. Register in `VehicleFactory` blueprint (Make, Model, Class)

**N-wheeled vehicles** are supported -- configure additional wheel blueprints with differential torque distribution. This is relevant for multi-axle GSE like baggage tractors.

**Limitation:** The vehicle blueprint system is designed for cars and motorcycles. Aircraft (static obstacles) would need to be imported as static mesh props rather than dynamic actors, unless you implement a custom `BaseVehiclePawn` subclass with aircraft-specific physics. GSE with unconventional wheel arrangements or steering (e.g., aircraft tugs with 360-degree steering) will require significant custom work.

### CARLA Sensor Models

#### Ray-Cast LiDAR (`sensor.lidar.ray_cast`)

| Parameter | Default | Notes |
|---|---|---|
| Channels | 32 | Configurable |
| Range | 10.0 m | Configurable |
| Points per second | 56,000 | Configurable |
| Rotation frequency | 10.0 Hz | Configurable |
| Upper FOV | 10.0 deg | |
| Lower FOV | -30.0 deg | |
| Horizontal FOV | 360 deg | |
| Atmosphere attenuation rate | 0.004 | Intensity loss per meter |
| Dropoff rate | 0.45 | Random point dropout proportion |
| Noise std dev | 0.0 | Along raycast vector |

#### Hybrid Solid-State LiDAR (`sensor.lidar.hss_lidar`)

| Parameter | Default | Notes |
|---|---|---|
| Channels | 128 | Based on Hesai AT128 |
| Range | 10.0 m | |
| Rotation frequency | 10.0 Hz | |
| Upper FOV | 12.9 deg | |
| Lower FOV | -12.5 deg | |
| Horizontal FOV | 120 deg | Symmetric around forward |
| Horizontal resolution | 0.1 deg | |

#### Matching RoboSense RS-HELIOS-5515 Specs

**RS-HELIOS-5515 real-world specifications:**

| Parameter | RS-HELIOS-5515 |
|---|---|
| Channels | 32 |
| Wavelength | 905 nm |
| Range | 150 m |
| Vertical FOV | 70 deg (-55 to +15 deg) |
| Horizontal FOV | 360 deg |
| Accuracy | +/-2 cm (1-100m), +/-3 cm (0.1-1m and 100-150m) |
| Data rate (single return) | 576,000 pts/s |
| Data rate (dual return) | 1,152,000 pts/s |
| RPM | 600 / 1200 |
| Dimensions | 100mm dia x 100mm H |
| Weight | ~1 kg |
| Power | 9-32V |
| IP rating | IP67 |
| Temp range | -30 to 60 deg C |
| Return modes | Single and dual |
| Beam distribution | Dense in center, sparse at edges |

**CARLA configuration to approximate RS-HELIOS-5515:**

```python
lidar_bp = blueprint_library.find('sensor.lidar.ray_cast')
lidar_bp.set_attribute('channels', '32')
lidar_bp.set_attribute('range', '150.0')            # 150m range
lidar_bp.set_attribute('upper_fov', '15.0')          # +15 deg
lidar_bp.set_attribute('lower_fov', '-55.0')         # -55 deg (70 deg total)
lidar_bp.set_attribute('rotation_frequency', '10.0') # 600 RPM = 10 Hz
lidar_bp.set_attribute('points_per_second', '576000') # Single return rate
lidar_bp.set_attribute('atmosphere_attenuation_rate', '0.004')
lidar_bp.set_attribute('dropoff_general_rate', '0.0') # Disable for clean data
lidar_bp.set_attribute('noise_stddev', '0.02')        # ~2cm noise
```

**Fidelity gap:** CARLA's ray-cast LiDAR does not model the RS-HELIOS's non-uniform beam distribution (dense center, sparse edges). All channels are evenly distributed across the vertical FOV. CARLA also lacks material-dependent reflectivity simulation in the standard ray-cast LiDAR (AWSIM handles this better with 32 configurable parameters vs. CARLA's 13). Dual-return mode is not natively supported in CARLA.

#### Camera Sensors

| Type | Key Parameters |
|---|---|
| RGB (`sensor.camera.rgb`) | 800x600 default, 90 deg FOV, bloom/lens flare/ISO/gamma/f-stop/shutter speed, exposure histogram or manual, lens distortion coefficients |
| Depth | R+G*256+B*65536 encoding, 1000m max range |
| Semantic segmentation | 29 semantic classes, CityScapes palette |
| Instance segmentation | Semantic tag + unique instance ID |
| Wide-angle | Perspective, stereographic, equidistant, equisolid, orthographic, Kannala-Brandt projection models |
| DVS (event camera) | Asynchronous events, configurable positive/negative thresholds |

#### Radar (`sensor.other.radar`)

| Parameter | Default |
|---|---|
| Horizontal FOV | 30 deg |
| Vertical FOV | 30 deg |
| Points per second | 1,500 |
| Range | 100 m |
| Output | Polar coordinates + velocity |

#### Other Sensors

- **IMU:** Accelerometer, gyroscope, compass with configurable noise per axis
- **GNSS:** Lat/lon/alt with configurable bias and noise
- **Collision detector:** Normal impulse data on collision events
- **Lane invasion detector:** OpenDRIVE-based lane crossing detection
- **Obstacle detector:** Ray-cast based, 5m default range
- **V2X (CAM and custom):** Cooperative awareness messages, configurable transmission power/sensitivity/path loss

### CARLA ROS Bridge

**As of CARLA 0.9.16:** Native ROS 2 connectivity is built into the CARLA server, eliminating the need for a separate bridge process. This provides:
- DDS-based message passing with lower latency than the previous bridge architecture
- Time synchronization between CARLA simulation clock and ROS 2 clock
- Compatible with ROS 2 Foxy, Galactic, Humble, and later distributions
- Sensor data published as standard ROS 2 messages (sensor_msgs/PointCloud2, sensor_msgs/Image, etc.)
- Ego vehicle control via standard Autoware or custom command topics

**Legacy ROS bridge** (for older CARLA versions): The `carla-simulator/ros-bridge` package provides bidirectional ROS 1/ROS 2 communication. Community forks exist for specific version combinations (e.g., `willv678/carla-ros2-bridge` for CARLA 0.10.0+).

**Autoware integration:** The `autoware_carla_interface` package in Autoware Universe provides direct Autoware-to-CARLA connectivity. Uses `carla_sensor_kit` with 6 cameras (360-degree coverage), LiDAR, IMU, and GNSS. Known limitation: CARLA's Lanelet2 maps lack proper traffic light components for Autoware, and coordinate systems differ from the pointcloud map.

### CARLA Leaderboard and Benchmark Agents

**Current version:** Leaderboard 2.1 (launched March 2025). Scoring shifted from exponential to linear infraction penalties, preventing agents from gaming the system by stopping early.

**Status:** The 2025 CARLA Autonomous Driving Challenge is not running due to unforeseen circumstances, but the leaderboard infrastructure remains available for local evaluation.

**Evaluation framework:**
- Routes span freeways, urban, residential, and rural environments
- Weather variations: daylight, sunset, rain, fog, night
- NHTSA typology scenarios: lane merge/change, intersections, roundabouts, traffic lights/signs, emergency vehicles, pedestrians, cyclists
- Metrics: Driving Score (DS), Route Completion (RC), Infraction Penalty (IP)
- Two modalities: SENSORS (perception-only input) and MAP (includes HD map access)
- Hardware: AWS g5.12xlarge evaluation instances

**Notable benchmark agents:**
- **SimLingo** -- 1st place on Leaderboard 2 SENSORS track
- **TransFuser++ / TransFuser v6** -- 2nd place at CVPR 2024 challenge; CVPR 2026 paper "LEAD: Minimizing Learner-Expert Asymmetry in End-to-End Driving"
- **InterFuser** -- Zero collisions/km on leaderboard but 5.24 collisions/km under HABIT benchmark
- **BEVDriver** -- Recent entrant using bird's-eye-view representations

### CARLA for World Model Training Data

**Neural reconstruction (NVIDIA NuRec):** Converts recorded camera and LiDAR data into 3D scenes using neural networks. Enables re-rendering from arbitrary viewpoints, camera configurations, or trajectory perturbations. NuRec Fixer resolves reconstruction artifacts via a transformer-based inpainting model.

**Cosmos Transfer1:** Generates photorealistic video variations from CARLA sequences using text prompts. Can produce variations in architecture, vehicles, weather, and lighting from a single simulation run. NVIDIA's Physical AI Dataset release includes 40,000 Cosmos-generated clips.

**Relevance to world models:** CARLA + NuRec + Cosmos provides a pipeline for generating diverse, photorealistic training data. The workflow is: (1) run simulation scenarios in CARLA, (2) optionally apply Cosmos Transfer for style diversity, (3) use NuRec for neural 3D reconstruction, (4) render novel viewpoints and perturbations. This is directly applicable to training video prediction models, occupancy networks, and other world model architectures.

---

## 2. AWSIM (Autoware/Unity)

### Overview

| Attribute | Detail |
|---|---|
| **Latest release** | v2.0.1 (October 31, 2025) |
| **Engine** | Unity 6000.0.61f1 |
| **Rendering** | HDRP or URP (switchable) |
| **GitHub stars** | ~690 (TIER IV/AWSIM) |
| **Commits** | 1,445+ |
| **License** | Apache 2.0 (code), CC BY-NC (assets) |
| **Forks** | AWSIM-Labs (Autoware Foundation), D-AWSIM (distributed variant) |
| **Maintenance** | Active, latest release Oct 2025 |

AWSIM is purpose-built for Autoware development. It uses ROS2ForUnity for high-throughput, low-latency ROS 2 communication. A key fork, **AWSIM-Labs**, is maintained by the Autoware Foundation with additional features.

### Sensor Simulation

- **LiDAR:** GPU-accelerated via Robotec GPU Lidar (RGL) with ray tracing. **32 configurable parameters** including material-dependent reflectivity -- significantly more detailed than CARLA's 13 parameters. This is a major advantage for matching real-world LiDAR behavior.
- **Camera:** OpenCV-based with post-effects (bloom, motion blur, depth of field, noise, grain, color grading, glare, halo, sharpening, anti-aliasing). More post-processing options than CARLA.
- **IMU and GNSS:** Standard simulation with configurable noise.
- **No radar support.** This is a notable gap.

### Custom Environment Creation

Requires three files:
1. **Lanelet2 OSM file** (`lanelet2_map.osm`) -- road network definition
2. **PCD file** (`pointcloud_map.pcd`) -- point cloud map for localization
3. **3D mesh files** (`.fbx` recommended, also `.obj/.mtl/.png`)

Import process:
1. Import `.fbx` into Unity Editor
2. Add Mesh Collider scripts for physics interaction
3. Import Lanelet2 and PCD files for Autoware compatibility
4. Add traffic rules and NPC behavior definitions

**For airport environments:** Lanelet2 is more flexible than OpenDRIVE for non-standard road geometries. Taxiways and apron areas can be represented as lanelets with custom regulatory elements. However, traffic behavior (NPC vehicles, pedestrians) still assumes road-driving conventions.

### Vehicle Integration

Custom vehicle integration follows Autoware's standard workflow. Vehicle dynamics are optimized for Autoware's control systems. Logitech G29 steering wheel support is included for human-in-the-loop testing.

### Performance

AWSIM maintains real-time simulation more reliably than CARLA. CARLA in asynchronous mode drops frames and is hard to control; in synchronous mode it runs below real-time with low ROS topic publishing rates. AWSIM supports configurable time scaling for flexible real-time factors.

### Airport Capability Assessment

**Feasible:** Custom 3D airport environments can be imported. Lanelet2 is more suitable than OpenDRIVE for modeling taxiway networks. GPU-based LiDAR with material reflectivity is valuable for realistic apron surface detection.

**Gaps:** No radar sensor. NPC traffic assumes road vehicles. No built-in airport-specific assets. No aircraft or GSE models included.

---

## 3. NVIDIA Isaac Sim 5.x

### Overview

| Attribute | Detail |
|---|---|
| **Latest release** | v5.1.0 (October 21, 2025) |
| **Platform** | NVIDIA Omniverse |
| **GitHub stars** | ~2,800 |
| **License** | Open-source (Isaac Sim extensions); Omniverse Kit remains proprietary |
| **Languages** | Python (78.7%), C++ (18.2%) |
| **Supported OS** | Windows 10/11, Ubuntu 22.04 (x86_64 and aarch64) |
| **Maintenance** | Active |

### Key Features

- **Physics:** GPU-accelerated PhysX, rigid body and vehicle dynamics, multi-joint articulation, SDF colliders
- **Rendering:** RTX-based physically accurate rendering, neural reconstruction via NuRec and 3DGUT
- **Sensors:** RTX and physics-based sensors defined via OmniSensor USD schema; stereo depth sensor with disparity artifacts
- **Synthetic data:** Omniverse Replicator for large-scale SDG; Cosmos Transfer writer
- **ROS 2:** Full ROS 2 Jazzy support, ZeroMQ bridge, MoveIt 2 tutorials, standardized ROS 2 simulation interfaces
- **Asset import:** URDF, MJCF, CAD formats

### MobilityGen

An extension for training data generation for mobile robots:
- Generates occupancy maps, robot states, poses, velocities, images
- Supports teleoperation, automated actions, customizable path planning
- Works with differential drive robots, quadrupeds, humanoids
- Custom robot registration via subclassing

### Autonomous Vehicle Suitability

**Isaac Sim is not designed for autonomous vehicles on public roads.** Per NVIDIA's own forums, it lacks:
- Realistic diverse outdoor scenarios (traffic conditions, weather, road types)
- Complex vehicle dynamics modeling
- Full AV sensor suites (LiDAR arrays, radar, multi-camera rigs)
- Scalable large outdoor environments (urban/highway)

**NVIDIA DRIVE Sim** is the intended product for AV simulation but is not open-source and requires early access/enterprise licensing.

**However, for airside AV (confined, structured environments):** Isaac Sim is more viable than for on-road AV. Airport aprons are controlled, low-speed environments closer to warehouse/industrial settings -- which is Isaac Sim's sweet spot. Cyngn uses Isaac Sim for autonomous industrial vehicle deployment in warehouses with similar constraints.

### Airport Capability Assessment

**Strengths:** USD-based environment authoring allows detailed airport scene construction. RTX sensor simulation is physically accurate. ROS 2 integration is production-ready. MobilityGen can generate training data for mobile robot navigation relevant to GSE operation.

**Gaps:** No built-in traffic simulation for multi-agent scenarios. No road network standards (OpenDRIVE/Lanelet2). No specific AV perception pipeline (no native BEV, no traffic light detection). Requires significant custom development for airport-specific scenarios.

**Best use:** Perception model training with high-fidelity synthetic data, especially for close-range obstacle detection and ground surface classification relevant to airside operations.

---

## 4. LGSVL / SVL Simulator (Discontinued)

### Status

| Attribute | Detail |
|---|---|
| **Last active** | January 2022 |
| **Developed by** | LG Electronics Silicon Valley Lab |
| **Engine** | Unity HDRP |
| **Status** | **Discontinued.** No new releases, no PR reviews, no asset updates since early 2022 |
| **Web services** | wise.svlsimulator.com shut down June 30, 2022 |
| **Source code** | Still available on GitHub (`lgsvl/simulator`), buildable from source |
| **License** | Other (custom LG license) |

### What It Offered

- High-fidelity Unity HDRP rendering
- ROS 1/ROS 2 bridge
- Autoware and Apollo integration
- Sensor simulation (camera, LiDAR, radar)
- Cloud-based scenario management
- Custom map support

### Why It Matters

LGSVL was the second-most-popular open-source AV simulator after CARLA. Its shutdown left a gap, particularly for Autoware users. The community response:
- **AWSIM** was developed by TIER IV specifically to fill this gap
- **CARLA-Autoware-Bridge** projects emerged to connect CARLA with Autoware
- Some teams forked LGSVL source and maintain private builds

### Alternatives

| LGSVL Feature | Replacement |
|---|---|
| Autoware integration | AWSIM (primary), CARLA via autoware_carla_interface |
| Apollo integration | CARLA (direct support) |
| High-fidelity rendering | CARLA UE5.5, Isaac Sim RTX |
| Cloud scenario management | No direct open-source replacement; CARLA ScenarioRunner + OpenSCENARIO |

---

## 5. AirSim / Project AirSim

### History and Current Status

| Attribute | AirSim (Original) | Project AirSim |
|---|---|---|
| **Developer** | Microsoft Research | IAMAI Simulations (ex-Microsoft engineers) |
| **Status** | Archived (2022) | Active development |
| **Latest release** | -- | v0.1.1 (July 30, 2025) |
| **Engine** | UE4 / Unity | UE5 |
| **GitHub stars** | ~16,000 (microsoft/AirSim) | ~563 (iamaisim/ProjectAirSim) |
| **License** | MIT | MIT |
| **Platforms** | Windows, Linux | Windows 11, Ubuntu 22 |
| **Focus** | Drones + ground vehicles | Primarily drones/aerial autonomy |

### Architecture

Project AirSim has three layers:
1. Simulation libraries for generic robot structures
2. UE5 plugin connecting external physics and controllers
3. Client library for network-based API interactions

Custom physics, sensors, actuators, and controllers can be integrated. ROS support exists (`/ros` directory in repo).

### Airport Relevance

**Unique advantage:** Project AirSim can create 3D environments from Bing Maps data, including a library of specific locations and generic spaces like airports. This is the only open-source simulator explicitly mentioning airport environment support.

**Limitations:**
- Primarily designed for aerial vehicles (drones, air taxis)
- Ground vehicle support exists but is not the primary focus
- Small community (563 stars, 18 contributors)
- Early-stage software (v0.1.1)
- Sensor simulation details are sparse in documentation

### Assessment for Airside AV

Project AirSim could be valuable for testing perception in airport environments (especially if using Bing Maps airport data), but it is not mature enough for full AV stack development. The aerial-first design means ground vehicle dynamics, traffic simulation, and sensor configurations are underdeveloped compared to CARLA or AWSIM.

---

## 6. Gazebo (ROS Testing)

### Overview

| Attribute | Detail |
|---|---|
| **Latest LTS** | Gazebo Jetty (Sep 2025 - Sep 2030) |
| **Previous stable** | Gazebo Harmonic, Gazebo Ionic |
| **Engine** | Custom (gz-sim), Ogre 2.x rendering, Vulkan support (Ionic+) |
| **Physics** | DART, ODE, Bullet (Featherstone API) |
| **License** | Apache 2.0 |
| **Maintenance** | Active, maintained by Open Robotics |

Gazebo Classic was officially discontinued and replaced by the modern "Gazebo" (formerly Ignition Gazebo).

### Sensor Simulation

- Camera (monocular, depth, thermal, segmentation, bounding box, wide-angle)
- LiDAR (GPU ray-cast)
- IMU, magnetometer, altimeter, airspeed
- GPS/NavSat
- Contact sensors, force-torque
- Optical tactile sensor
- Custom sensor plugins

### ROS 2 Integration

- `ros_gz_bridge` provides bidirectional message exchange between Gazebo Transport and ROS 2
- Launch Gazebo from ROS 2 launch files
- Integration with `ros2_control` for hardware abstraction
- SDF robot description support
- Model spawning and service bridging

### Vehicle Simulation

- Mecanum wheel controller
- Tracked vehicle support
- Wheel slip commands
- Hydrodynamics for water vehicles
- UAV support via PX4/ArduPilot SITL
- Ackermann steering plugin available

### Airport Capability Assessment

**Strengths:** Gazebo is the gold standard for ROS-based robot testing. SDF/URDF model format is well-suited for custom vehicles. Physics engines are accurate for low-speed ground vehicles. Lightweight enough to run many instances in CI/CD pipelines.

**Gaps:** Rendering quality is significantly below CARLA or AWSIM (Ogre 2.x vs. UE5 or Unity HDRP). No traffic simulation. No road network standards. No built-in AV perception pipeline. Not designed for photorealistic synthetic data generation.

**Best use for airside AV:** Unit testing of ROS 2 nodes, control algorithm validation, multi-robot coordination testing, and sensor integration verification. Not suitable for perception model training or end-to-end driving validation.

---

## 7. Comparison Matrix

### Feature Comparison

| Feature | CARLA 0.9.16 | AWSIM v2.0.1 | Isaac Sim 5.1 | Project AirSim 0.1.1 | Gazebo Jetty | LGSVL (archived) |
|---|---|---|---|---|---|---|
| **Engine** | UE 5.5 | Unity 6000 | Omniverse | UE 5 | gz-sim/Ogre2 | Unity HDRP |
| **Maintenance** | Active | Active | Active | Active (early) | Active | Discontinued |
| **License** | MIT | Apache 2.0 | Open-source* | MIT | Apache 2.0 | Custom |
| **Latest Release** | Sep 2025 | Oct 2025 | Oct 2025 | Jul 2025 | Sep 2025 | Jan 2022 |

*Isaac Sim extensions are open-source; Omniverse Kit components are proprietary.

### Rendering and Fidelity

| Capability | CARLA | AWSIM | Isaac Sim | Project AirSim | Gazebo | LGSVL |
|---|---|---|---|---|---|---|
| **Rendering quality** | High (UE5 Lumen/Nanite) | High (HDRP/URP) | Very High (RTX) | High (UE5) | Medium (Ogre2) | High (HDRP) |
| **Ray tracing** | Yes | Yes (LiDAR) | Yes (full RTX) | Yes | No | Limited |
| **Neural rendering** | NuRec + Cosmos | No | NuRec + 3DGUT | No | No | No |
| **Weather simulation** | Rain/fog/night/cloudy | Limited | Configurable | Limited | Plugin-based | Yes |
| **Dynamic lighting** | Yes (Lumen) | Yes (HDRP) | Yes (RTX) | Yes | Basic | Yes |

### Sensor Simulation

| Sensor | CARLA | AWSIM | Isaac Sim | Project AirSim | Gazebo | LGSVL |
|---|---|---|---|---|---|---|
| **LiDAR** | Ray-cast + HSS (13 params) | GPU ray-trace (32 params, material reflectivity) | RTX-based | Basic | GPU ray-cast | Ray-cast |
| **Camera (RGB)** | Yes (full post-processing) | Yes (extended post-processing) | Yes (RTX) | Yes | Yes | Yes |
| **Depth camera** | Yes | Yes | Yes (stereo disparity) | Yes | Yes | Yes |
| **Semantic segmentation** | Yes (29 classes) | Yes | Yes (Replicator) | Limited | Yes (plugin) | Yes |
| **Radar** | Yes | **No** | Limited | Limited | No | Yes |
| **IMU** | Yes | Yes | Yes | Yes | Yes | Yes |
| **GNSS** | Yes | Yes | Yes | Yes | Yes (NavSat) | Yes |
| **Event camera (DVS)** | Yes | No | No | No | No | No |
| **V2X** | Yes (CAM + custom) | Yes (V2I) | No | No | No | No |

### Simulation Speed and Performance

| Metric | CARLA | AWSIM | Isaac Sim | Project AirSim | Gazebo |
|---|---|---|---|---|---|
| **Real-time capability** | Sync mode: below real-time; Async: above real-time with frame drops | Maintains real-time reliably | Depends on scene complexity | Real-time capable | Real-time for simple scenes |
| **Time scaling** | Fixed-delta configurable | Flexible time scaling | Configurable | Configurable | Configurable |
| **Headless mode** | Yes | Yes | Yes | Yes | Yes |
| **Multi-instance** | Possible but resource-heavy | Possible | Possible (cloud) | Limited | Yes (lightweight) |
| **Min GPU** | RTX 3070 (16GB VRAM) | RTX 2060+ | RTX 3070+ | RTX 2060+ | Integrated OK |
| **Disk footprint** | ~20 GB | ~5 GB | ~30 GB | ~10 GB | <1 GB |

### Airport Airside Capability

| Capability | CARLA | AWSIM | Isaac Sim | Project AirSim | Gazebo |
|---|---|---|---|---|---|
| **Custom environment import** | Yes (.fbx + .xodr) | Yes (.fbx + Lanelet2 + PCD) | Yes (USD, URDF, CAD) | Yes (Bing Maps, custom) | Yes (SDF, URDF) |
| **Airport assets built-in** | No | No | No | Airport env mentioned | No |
| **Road network for taxiways** | OpenDRIVE (poor fit) | Lanelet2 (better fit) | None (custom) | Bing Maps data | None (custom) |
| **Custom vehicle types (GSE)** | Yes (N-wheel, custom skeleton) | Yes (Autoware vehicle model) | Yes (URDF/USD) | Yes (custom) | Yes (SDF/URDF) |
| **Aircraft as static obstacles** | Yes (static mesh import) | Yes (Unity asset import) | Yes (USD import) | Yes (UE5 mesh) | Yes (SDF mesh) |
| **Multi-agent traffic** | Yes (Traffic Manager) | Yes (NPC traffic) | Limited | Limited | Limited (multi-robot) |
| **Low-speed vehicle dynamics** | Yes (PhysX / Chrono) | Yes (Unity physics) | Yes (PhysX) | Yes (custom physics) | Yes (DART/ODE/Bullet) |

### ROS Integration

| Feature | CARLA | AWSIM | Isaac Sim | Project AirSim | Gazebo |
|---|---|---|---|---|---|
| **ROS 2 support** | Native (0.9.16+) | Native (ROS2ForUnity) | Yes (Jazzy) | Yes (/ros package) | Native (ros_gz_bridge) |
| **ROS 1 support** | Via legacy bridge | No | No | Via original AirSim | Via ros_gz_bridge |
| **Autoware integration** | autoware_carla_interface | Primary design target | No | No | Limited |
| **Latency** | Low (native DDS) | Low (ROS2ForUnity) | Low (ZeroMQ + DDS) | Medium | Low (native) |
| **Standard message types** | Yes | Yes | Yes | Partial | Yes |

### World Model Training Data Generation

| Capability | CARLA | AWSIM | Isaac Sim | Project AirSim | Gazebo |
|---|---|---|---|---|---|
| **Synthetic data pipeline** | NuRec + Cosmos + standard sensors | Standard sensors, GPU LiDAR | Omniverse Replicator + MobilityGen + NuRec | Basic sensor recording | Basic sensor recording |
| **Neural rendering** | Yes (NuRec 25.07) | No | Yes (NuRec + 3DGUT) | No | No |
| **Style transfer** | Yes (Cosmos Transfer1) | No | Yes (Cosmos writer) | No | No |
| **Domain randomization** | Weather, lighting, textures | Limited | Extensive (Replicator) | Weather, lighting | Limited |
| **Data format export** | Custom + USD | ROS bags | USD + custom | Custom | ROS bags |
| **Scalable generation** | Yes (headless, multi-GPU) | Yes | Yes (cloud, multi-GPU) | Limited | Yes (lightweight) |

### Sim-to-Real Gap Assessment

| Factor | CARLA | AWSIM | Isaac Sim | Project AirSim | Gazebo |
|---|---|---|---|---|---|
| **Visual realism** | High but imperfect in adverse weather | High | Very high (RTX) | High | Low |
| **LiDAR realism** | Moderate (no material reflectivity) | High (material reflectivity, 32 params) | High (RTX physics-based) | Low | Moderate |
| **Physics accuracy** | Moderate (PhysX/Chrono) | Moderate (Unity) | High (PhysX GPU) | Moderate | High (DART/Bullet) |
| **Domain adaptation tools** | Cosmos Transfer, NuRec | None built-in | Replicator domain randomization | None | None |
| **Proven sim-to-real** | Many published results (RALAD: 10-12% mAP improvement) | Limited published results | Published for manipulation, not AV | Published for drones | Published for manipulation/navigation |
| **Key gap** | Weather rendering, LiDAR material response | Radar absent, weather limited | Not designed for outdoor AV | Immature for ground vehicles | Visual fidelity too low |

---

## 8. Recommendations for Airside AV Development

### Primary Recommendation: CARLA 0.9.16

CARLA is the strongest choice for airside AV simulation due to:

1. **Richest sensor suite** including radar, V2X, and event cameras
2. **Neural rendering pipeline** (NuRec + Cosmos) for world model training data
3. **Native ROS 2** without bridge overhead
4. **Largest community** (13.7k stars, 161 contributors, extensive published research)
5. **Autoware integration** via autoware_carla_interface
6. **Leaderboard/benchmarks** for measuring perception and planning performance
7. **Custom vehicle support** including N-wheeled configurations for GSE

**Required custom work for airside:**
- Create airport environment in RoadRunner (or TrueVision Designer) with taxiway/apron geometry encoded as OpenDRIVE roads
- Import aircraft 3D models as static props
- Create GSE vehicle blueprints (baggage tractors, belt loaders, pushback tugs) with custom skeletons
- Implement airport-specific traffic rules via Python API (hold-short logic, pushback sequences, right-of-way for aircraft)
- Configure LiDAR to match RS-HELIOS-5515 specs (32 channels, 70 deg VFOV, 150m range, 576k pts/s)

### Secondary Recommendation: AWSIM for Autoware Stack Testing

If the AV stack is built on Autoware, AWSIM provides:
- Tightest Autoware integration (designed for it)
- Superior LiDAR simulation (32 parameters, material reflectivity)
- More reliable real-time performance
- Lanelet2 map format is better suited for airport taxiway representation

Use AWSIM for closed-loop Autoware stack validation and CARLA for perception training data generation.

### Supplementary Tools

| Tool | Use Case |
|---|---|
| **Isaac Sim** | High-fidelity synthetic data generation for perception model training (close-range obstacle detection, surface classification). Use MobilityGen for navigation training data. Valuable if operating within NVIDIA's ecosystem (DRIVE Sim for later stages). |
| **Gazebo** | CI/CD testing of individual ROS 2 nodes, control algorithm unit tests, multi-robot coordination. Lightweight enough to run in automated pipelines. Not for perception training. |
| **Project AirSim** | Worth monitoring for airport environment generation from Bing Maps data. Too immature for production simulation today. |

### Sim-to-Real Strategy

The current state of the art for closing the sim-to-real gap in AV simulation (2025 research):

1. **Cosmos Transfer** (via CARLA 0.9.16): Generate photorealistic variations of simulated sequences to improve visual diversity
2. **NuRec neural reconstruction**: Convert real airport sensor recordings into interactive 3D scenes for replay with perturbations
3. **Domain randomization**: Vary lighting, weather, surface textures, and object placement systematically
4. **RALAD framework**: Retrieval-augmented learning bridges real-to-sim gap, improving mIOU by 10.3% and mAP by 12.3% while reducing retraining cost by 88%
5. **Sim2Real Diffusion**: Latent diffusion transforms simulated perception streams, bridging perceptual gap by 40%+

For airside specifically, the sim-to-real gap is potentially smaller than on-road AV because:
- Airport environments are more controlled and structured
- Speed is low (typically < 30 km/h)
- Lighting conditions are more predictable (apron lighting)
- Obstacle types are finite and well-defined (aircraft, GSE, personnel, FOD)
- Surface textures are relatively uniform (concrete/asphalt)

The biggest remaining gap for airside will be **LiDAR material response** (jet blast deflectors, aircraft fuselage reflectivity, wet tarmac) -- where AWSIM's material-aware LiDAR or Isaac Sim's RTX sensors are superior to CARLA's standard ray-cast approach.

---

## Sources

### CARLA
- [CARLA GitHub Repository](https://github.com/carla-simulator/carla)
- [CARLA UE5 Documentation](https://carla-ue5.readthedocs.io/en/latest/)
- [CARLA Sensor Reference](https://carla.readthedocs.io/en/latest/ref_sensors/)
- [CARLA Custom Map Overview](https://carla.readthedocs.io/en/latest/tuto_M_custom_map_overview/)
- [CARLA Add Vehicle Tutorial](https://carla.readthedocs.io/en/latest/tuto_A_add_vehicle/)
- [CARLA AI Rendering](https://carla.readthedocs.io/en/latest/ai_rendering/)
- [CARLA 0.9.16 Release](https://carla.org/2025/09/16/release-0.9.16/)
- [CARLA Autonomous Driving Leaderboard](https://leaderboard.carla.org/)
- [CARLA Leaderboard v2.1 Evaluation](https://leaderboard.carla.org/evaluation_v2_1/)
- [CARLA ROS Bridge GitHub](https://github.com/carla-simulator/ros-bridge)
- [CARLA OpenDRIVE Documentation](https://carla.readthedocs.io/en/latest/adv_opendrive/)
- [CARLA Benchmarking](https://carla.readthedocs.io/en/latest/adv_benchmarking/)
- [Autoware CARLA Interface](https://autowarefoundation.github.io/autoware_universe/main/simulator/autoware_carla_interface/)
- [CARLA-Autoware-Bridge (TUM)](https://github.com/TUMFTM/Carla-Autoware-Bridge)
- [Neya Systems CARLA UE5 Collaboration](https://neyarobotics.com/2024/03/26/carla-collaboration/)
- [LEAD: CVPR 2026 TransFuser v6](https://github.com/autonomousvision/lead)
- [CARLA Leaderboard Benchmarks (Papers With Code)](https://paperswithcode.com/sota/autonomous-driving-on-carla-leaderboard)

### AWSIM
- [AWSIM GitHub (TIER IV)](https://github.com/tier4/AWSIM)
- [AWSIM-Labs GitHub (Autoware Foundation)](https://github.com/autowarefoundation/AWSIM-Labs)
- [AWSIM Autoware Platform Page](https://autoware.org/awsim-end-to-end-digital-twin-simulation-platform/)
- [AWSIM Robotec.ai Overview](https://www.robotec.ai/awsim-simulation-for-self-driving-vehicles)
- [D-AWSIM Distributed Simulator](https://arxiv.org/html/2511.09080v1)
- [CARLA vs AWSIM Comparative Analysis (SSRN)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5249951)
- [AWSIM Map Creation Workflow](https://arxiv.org/html/2508.16856v1)

### Isaac Sim
- [Isaac Sim GitHub](https://github.com/isaac-sim/IsaacSim)
- [Isaac Sim 5.0 GA Announcement](https://developer.nvidia.com/blog/isaac-sim-and-isaac-lab-are-now-available-for-early-developer-preview/)
- [Isaac Sim Developer Page](https://developer.nvidia.com/isaac/sim)
- [Isaac Sim Advanced Sensor Physics Blog](https://developer.nvidia.com/blog/advanced-sensor-physics-customization-and-model-benchmarking-coming-to-nvidia-isaac-sim-and-nvidia-isaac-lab/)
- [MobilityGen Custom Robot Registration](https://medium.com/@kabilankb2003/subclassing-and-registering-custom-robots-in-nvidia-isaac-sims-mobilitygen-b499c59fb0f6)
- [Cyngn + Isaac Sim Deployment](https://www.prnewswire.com/news-releases/cyngn-accelerates-commercial-deployment-of-physical-ai-with-nvidia-isaac-sim-302676806.html)
- [Isaac Sim AV Forum Discussion](https://forums.developer.nvidia.com/t/autonomous-vehicle-simulation-in-isaac/275102)
- [NVIDIA AV Simulation (DRIVE Sim)](https://developer.nvidia.com/drive/simulation)
- [NVIDIA Scaling Physical AI with Omniverse](https://blogs.nvidia.com/blog/scaling-physical-ai-omniverse/)

### LGSVL
- [LGSVL Simulator GitHub](https://github.com/lgsvl/simulator)
- [SVL Simulator SourceForge Mirror](https://sourceforge.net/projects/svl-simulator.mirror/)

### AirSim / Project AirSim
- [AirSim GitHub (Microsoft, archived)](https://github.com/microsoft/AirSim)
- [Project AirSim GitHub (IAMAI)](https://github.com/iamaisim/ProjectAirSim)
- [Project AirSim Documentation](https://iamaisim.github.io/ProjectAirSim/)
- [Project AirSim + UE5 Spotlight](https://www.unrealengine.com/en-US/spotlights/microsoft-project-airsim-accelerates-autonomous-flight-with-unreal-engine)

### Gazebo
- [Gazebo Release Features](https://gazebosim.org/docs/latest/release-features/)
- [ROS 2 Gazebo Tutorial](https://docs.ros.org/en/humble/Tutorials/Advanced/Simulators/Gazebo/Gazebo.html)
- [ArduPilot Gazebo Integration](https://github.com/ArduPilot/ardupilot_gazebo)

### RoboSense RS-HELIOS
- [RS-HELIOS-5515 (ROS Components)](https://www.roscomponents.com/product/rs-helios-5515/)
- [RoboSense Helios Series](https://www.robosense.ai/en/IncrementalComponents/Helios)
- [RS-Helios-5515 ROS Simulator Package](https://github.com/SynapseProgramming/robosense_simulator_Helios_5515)

### Sim-to-Real Research
- [RALAD: Bridging Real-to-Sim Domain Gap](https://arxiv.org/html/2501.12296v2)
- [Sim2Real Diffusion for Autonomous Driving](https://arxiv.org/abs/2507.00236)
- [Platform-Agnostic Deep RL for Sim2Real Transfer (Nature)](https://www.nature.com/articles/s44172-024-00292-3)
- [Open-Source Simulator Review (2023)](https://arxiv.org/html/2311.11056v2)
- [Realistic 3D Simulators for Automotive (MDPI)](https://www.mdpi.com/1424-8220/24/18/5880)

### Airport/Airside
- [FAA Autonomous Ground Vehicle Systems](https://www.faa.gov/airports/new_entrants/agvs_on_airports)
- [Tokyo Airport GSE Traffic Simulation](https://www.mdpi.com/2226-4310/12/10/896)
- [AirTOP Airside Vehicle Simulation](https://www.transoftsolutions.com/aviation/software/airport-airspace-fast-time-simulation/airtop-airside-vehicle/)
- [AeroVect Autonomous GSE Case Study](https://pointonenav.com/news/aerovects-autonomous-gse-case-study/)
- [Autonoma Airport Digital Twin Platform](https://www.autonoma.ai/industries/airports-airlines)
