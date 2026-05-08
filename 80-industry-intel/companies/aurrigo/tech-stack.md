# Aurrigo Technology Stack Analysis

## Complete Technical Architecture of the Current AV Stack

*Source: Direct analysis of the Aurrigo ROS workspace at `~/ubuntu_20-04/z-aurrigo-ws/`*

---

## 1. Company Overview

- **Founded:** 2014, Coventry, UK (originally RDM Group, rebranded to Aurrigo)
- **Public:** Listed on AIM (London Stock Exchange)
- **Revenue:** £8M total, ~£2.5M from autonomous division (FY2024)
- **EBITDA:** -£1.6M adjusted (FY2024, loss-making)
- **Headcount:** ~80-100 employees
- **Funding:** £14.1M raised September 2025
- **Largest order:** £6.28M from Ultra Global (25 autonomous transit vehicles)
- **Key partnerships:** Swissport (285-airport network), IAG/British Airways, SATS

---

## 2. Vehicle Platforms

| Platform | Type | Steering | Primary Use | Status |
|----------|------|----------|-------------|--------|
| **ADT3** | Baggage/cargo tractor | Ackermann + crab (all-wheel) | Airport cargo/baggage transport | Primary |
| **STL2** | Shuttle | Ackermann | People mover | Active |
| **POD** | Pod vehicle | TBD | Campus transport | Planned |
| **ACA1** | Cargo vehicle | TBD | Cargo transport | Planned |

### ADT3 Specifications

```
Wheelbase (L_eff): 3.15m (validated from bag data)
Max steering angle: 0.8762 rad (50.2°)
Min turning radius: 2.63m (rear axle)
Max speed: 6.67 m/s (24 km/h)
Max deceleration: 2.0 m/s² (hydraulic braking)
Track width: ~1.8m
Vehicle length: ~5.5m
Steering actuator: Roboteq MDC1460 brushed DC motor → orbital valve → hydraulic cylinder → rack
Braking: Binary (0/200-240 Nm equivalent)
Drive modes: Ackermann (normal), Crab (side-drive), Transition
```

---

## 3. Software Architecture

### 3.1 Technology Stack

| Component | Technology |
|-----------|-----------|
| **OS** | Ubuntu 20.04 |
| **Middleware** | ROS Noetic |
| **Build** | Catkin (catkin_tools) |
| **Language** | C++17 (nodelets), Python 3 (simulation, tools) |
| **GPU** | CUDA 12.9 (localization only) |
| **Code style** | Google clang-format, Python black |
| **CI/CD** | Docker, GitHub Actions |

### 3.2 ROS Packages (22 Total)

**Core Autonomy (6 packages):**

| Package | Function | Architecture |
|---------|----------|-------------|
| `aurrigo_nav` | Navigation pipeline | 6 nodelets: LaneGraph, GlobalPlanning, LocalPlanning, BehaviorPlanner, SideDrive, CargoLoading |
| `aurrigo_localization` | Multi-sensor fusion | 4 nodelets: LidarProcessor, SensorFusion, GlobalmapServer, GpsConversion |
| `aurrigo_perception` | LiDAR processing | 9 sub-packages (see Section 4) |
| `aurrigo_av_comms` | Vehicle CAN interface | VehicleInterfaceBase + per-platform implementations |
| `aurrigo_msgs` | Message definitions | Perception, localization, planning, vehicle-specific |
| `aurrigo_vehicle_description` | URDF models | Per-unit sensor calibration, static TF tree |

**Simulation & Testing:**
- `aurrigo_python_sim` — Kinematic bicycle model simulator (validated 4.1% error)
- `aurrigo_vse` — Virtual Scenario Engine (inject dynamic/static obstacles via JSON)

**System Monitoring:**
- `aurrigo_system_minder` — Health monitor (16 subsystems)
- `aurrigo_blackbox_recorder` — LZ4-compressed bag recorder
- `aurrigo_auto_rosbagger` — Rolling/scenario/manual recording
- `aurrigo_auto_connect_bridge` — Fleet management integration

**Supporting:**
- `aurrigo_zone_manager` — Lanelet2-based spatial zones
- `aurrigo_ezdisplay_manager` — Lumex EzDisplay
- `aurrigo_ipe_acs_bridge` — IPE/ACS gateway
- `aurrigo_waypoint_manipulation_panel` — Waypoint UI
- `aurrigo_camera_ros` — Camera drivers

**Third-Party:**
- `microstrain_inertial` — IMU driver (GX5/CV7)
- `rslidar_sdk` — RoboSense LiDAR drivers
- `ntrip_client` — RTK GPS corrections
- `st2_av_dbw_gwy` — STL2 CAN gateway

---

## 4. Perception Stack (100% LiDAR, No ML)

### 4.1 Sensors

| Sensor | Model | Quantity | Placement |
|--------|-------|----------|-----------|
| LiDAR (front/rear) | RoboSense RSHELIOS | 2 | Roof-mounted |
| LiDAR (sides) | RoboSense RSBP | 4 | Side-mounted |
| IMU | Microstrain GX5/CV7 | 1 | Vehicle center |
| GNSS | Dual-antenna RTK | 1 | Roof |
| Wheel encoders | Via CAN bus | 4 | Wheels |

**No cameras in core perception pipeline.** `aurrigo_camera_ros` exists but is not integrated into autonomy.

### 4.2 Perception Pipeline (9 Packages)

```
4-8 LiDAR streams @ 10Hz
    │
    ├── PointcloudAggregator: Fuse all LiDARs → base_link frame
    │
    ├── PointcloudPreprocessor: Region crop (front/back/left/right), intensity filter
    │
    ├── GroundGrid: Terrain segmentation (GroundGrid algorithm, NOT ML)
    │
    ├── PointcloudSegmentation: Object separation (RANSAC edge fitting, plane detection)
    │   ├── DeckDetection: Airport deck edge fitting (cubic Bézier validation)
    │   ├── UldDetection: Unit Load Device pose (plane height triangulation)
    │   └── TrailerDetection: Trailer plane fitting (YAW from edge lines)
    │
    ├── RainDetection: Weather noise (Statistical Outlier Removal)
    │
    └── PolygonDetector: Road/zone boundary extraction
```

**Critical limitation:** Only detects 3 object types (deck, ULD, trailer) via hand-crafted RANSAC. Cannot detect aircraft, ground crew, other GSE, or FOD.

### 4.3 Detection Algorithms

| Algorithm | Type | What It Does |
|-----------|------|-------------|
| RANSAC | Classical | Edge fitting for deck/trailer plane extraction |
| Cubic Bézier | Classical | Deck edge validation (curve fitting) |
| Plane intersection | Classical | ULD height estimation from triangulation |
| Statistical Outlier Removal | Classical | Rain/noise filtering |
| GroundGrid | Classical | Terrain model for ground/obstacle separation |

**No neural networks, no deep learning, no ML in any perception component.** The emerging AI work (Aston University KTP, February 2026) focuses on fleet-level multi-agent coordination, not vehicle-level perception.

---

## 5. Localization Stack

### 5.1 Architecture: GTSAM Factor Graph (GPU-Accelerated)

```
Sensors → Factor Graph (ISAM2) → Optimized Poses

Factors:
├── VGICP GPU: LiDAR scan-to-map matching (gtsam_points, custom Aurrigo fork)
├── IMU Preintegration: 500Hz inertial measurements (Forster et al.)
├── Wheel Odometry: 3-DOF XY+yaw from encoders (Ackermann + crab)
├── GPS PVT: Dual-antenna RTK position+velocity
└── Level Factor: Constrains roll/pitch to near-zero

Output:
├── /odom/fused @ 20Hz (ISAM2 optimized state)
└── /odom/fused/high_rate @ 50Hz (IMU+wheel interpolated)
```

### 5.2 Key Technical Details

- **GPU acceleration:** TBB parallel LiDAR preprocessing + GPU voxelmap (CUDA 12.9)
- **Map format:** PCD point cloud files (~166MB and ~287MB)
- **Map loading:** Tiled by GlobalmapServerNodelet around current position
- **Build requirement:** Must build in Release mode for GPU localization performance
- **600+ unit tests** in localization package

---

## 6. Planning Stack

### 6.1 Architecture: Waypoint-Based Frenet Trajectory Generation

```
Waypoints → Lane Graph → Global Planner → Local Planner → Behavior Planner → Vehicle

LaneGraphNodelet (event-driven):
  Waypoints → Cubic Bézier paths (C¹ continuity, 0.5m segment spacing)

GlobalPlanningNodelet (20Hz):
  Position tracking, velocity profile planning, path segmentation

LocalPlanningNodelet (50Hz):
  Frenet trajectory generation: 7 lateral × 4 velocity × 15 time = 420 candidates/cycle
  Stanley lateral control for trajectory tracking

BehaviorPlannerNodelet (20Hz):
  6-state FSM: IDLE → READY → NAVIGATING → AT_PAUSE → CARGO_LOADING → DONE
  Safety gating: obstacle distance, remote e-stop, system health, zone speed caps

SideDriveNodelet (ADT3 only):
  9-state FSM for crab/side navigation (parallel/perpendicular docking)

CargoLoadingNodelet (ADT3 only):
  ULD arm/flap control (docking state machine)
```

### 6.2 Key Limitations

- **No prediction:** Treats all obstacles as static. Cannot anticipate vehicle/pedestrian motion.
- **No learning:** All planning rules are hand-coded. No learned cost functions.
- **No map-free capability:** Requires pre-authored waypoints and PCD maps per airport.
- **No language interface:** Cannot process ground control instructions.

---

## 7. Control & Vehicle Interface

### 7.1 CAN Communication

```
/av_nav/cmd_twist (Twist: linear.x = velocity m/s, angular.z = steering rad)
    │
    ├── Steering: angle_rad → sign-inverted percentage counts
    │   ADT3: ±95 counts = ±50.2° (0.8762 rad)
    │
    ├── Velocity: m/s → 0.1 kph/LSB (CAN wire unit)
    │
    └── Output: /{adt3|stl2}/ads_to_av (CAN messages @ 50Hz)

Feedback: /{adt3|stl2}/av_to_ads_core → steering position, velocity, e-stop, wheel encoders @ 45Hz
```

### 7.2 Multi-Platform Abstraction

`VehicleInterfaceBase` provides common interface. Each platform (ADT3, STL2, POD, ACA1) has its own implementation handling platform-specific CAN message formats, steering conversion, and braking strategies.

---

## 8. Simulation

### 8.1 Kinematic Bicycle Model (aurrigo_python_sim)

```
Model: Discrete-time Ackermann bicycle
  L_eff = 3.15m, dt = 0.02s (50Hz)
  Validated: mean 4.76m / 4.1% error over 116m trajectory

What it replaces: Localization, perception, vehicle interface (CAN mock)
What runs unmodified: Real nav stack (6 C++ nodelets)

Scenarios: YAML format (waypoints + assertions)
Testing: 43 unit tests, batch mode (exit 0/1 based on assertions)
```

### 8.2 Limitations

- **No 3D rendering** — cannot test perception
- **No sensor simulation** — no LiDAR/camera/radar generation
- **No dynamic agents** — obstacles injected via VSE as static/scripted
- **No weather variation** — no rain, fog, or lighting changes

---

## 9. Infrastructure

### 9.1 Monitoring

`aurrigo_system_minder` monitors 16 subsystems:
VCU, MCU, EPB, 4 wheels, hydraulics, steering, thermal, battery, ADS, 5 LiDAR sensors

### 9.2 Zone Management

`aurrigo_zone_manager` uses Lanelet2 for spatial zones:
- Restricted zones (no entry)
- Speed limit zones
- Caution zones
- Loading zones

### 9.3 Recording

- `aurrigo_blackbox_recorder`: LZ4-compressed continuous recording
- `aurrigo_auto_rosbagger`: Event-triggered, rolling, and manual recording modes

---

## 10. Technology Gaps for World Model Integration

| Current Capability | Gap | World Model Solution |
|-------------------|-----|---------------------|
| 3 object types (RANSAC) | Cannot detect aircraft, crew, GSE, FOD | CenterPoint/PointPillars learned detection |
| No prediction | Reactive-only planning | 4D occupancy world model (OccWorld) |
| Per-airport waypoints + PCD maps | Weeks to deploy at new airport | Online mapping (MapTRv2) + world model generalization |
| No cameras in perception | Missing color, texture, signage info | BEVFusion with DINOv2 backbone |
| Kinematic sim only | Cannot test perception or edge cases | 3DGS digital twin + neural sim |
| No explainability | Hard to build safety cases | VLA reasoning traces (Alpamayo distilled) |
| No weather handling (beyond SOR rain filter) | Degraded in rain, fog, de-icing | 4D radar fusion + learned robustness |
| No fleet intelligence | Each vehicle operates independently | Shared world model, A-CDM integration |

---

## 11. What's Good About the Current Stack

The current stack has significant strengths that should be preserved in any upgrade:

1. **GTSAM localization is excellent** — GPU-accelerated, multi-sensor, production-tested, 600+ unit tests
2. **Frenet planner is proven** — 420 candidates/cycle provides rich trajectory space
3. **Multi-platform abstraction** — VehicleInterfaceBase pattern cleanly separates vehicle-specific from generic
4. **Comprehensive monitoring** — 16-subsystem health checks catch hardware failures
5. **Validated simulation** — 4.1% error kinematic model is sufficient for nav stack testing
6. **Zone management** — Lanelet2 integration handles spatial restrictions cleanly
7. **Safety gating** — Behavior planner gates all commands through obstacle/e-stop/health checks

**The Simplex architecture preserves ALL of these** as the verified fallback controller while adding the world model as the high-performance controller.

---

*Analysis based on direct workspace exploration of ~/ubuntu_20-04/z-aurrigo-ws/ (22 packages, March 2026).*
