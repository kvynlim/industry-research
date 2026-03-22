# Shadow Mode / Dual-Stack Implementation for Progressive AI Deployment

## Comprehensive Guide for Autonomous Vehicle Development

---

## 1. Shadow Mode Architecture — Industry Approaches

### 1.1 Conceptual Overview

Shadow mode (also called shadow testing or parallel autonomy) runs an experimental autonomous driving stack alongside an active production system — or alongside a human driver — without controlling the vehicle. The experimental system receives identical sensor inputs, produces driving decisions, and logs everything for comparison, but its outputs are never routed to actuators.

The core value proposition: validate new AI models against billions of real-world miles without any safety risk, while systematically discovering edge cases that simulation alone cannot surface.

```
┌─────────────────────────────────────────────────────────┐
│                    SENSOR ARRAY                         │
│  (cameras, LiDAR, radar, IMU, GPS, wheel encoders)     │
└──────────────┬──────────────────────┬───────────────────┘
               │ (shared input)       │ (shared input)
               ▼                      ▼
┌──────────────────────┐  ┌──────────────────────────────┐
│  PRODUCTION STACK    │  │  SHADOW STACK                 │
│  (active control)    │  │  (observe only)               │
│                      │  │                               │
│  Perception ──┐      │  │  Perception ──┐               │
│  Prediction ──┼──►   │  │  Prediction ──┼──►            │
│  Planning  ───┘  │   │  │  Planning  ───┘  │            │
│              cmd_vel │  │              cmd_vel_shadow    │
└──────────┬───────────┘  └──────────┬────────────────────┘
           │                         │
           ▼                         ▼
┌──────────────────┐     ┌───────────────────────────────┐
│  ACTUATORS       │     │  COMPARISON / LOGGING ENGINE   │
│  (steering,      │     │  - Trajectory divergence       │
│   throttle,      │     │  - Decision disagreements      │
│   brake)         │     │  - Edge case triggers          │
└──────────────────┘     └───────────────────────────────┘
```

### 1.2 Tesla's Shadow Mode

Tesla operates the largest shadow testing deployment in the world. Key architectural elements:

**Fleet-Scale Passive Collection.** FSD runs silently in the background on every Tesla, even when FSD is not actively engaged by the driver. The system receives identical camera and sensor inputs, makes hypothetical driving decisions, but never controls the vehicle. This effectively turns millions of vehicles into a passive data-gathering and validation network.

**Triggering on Disagreement.** For every second of driving, the system compares its decision with the driver's decision. When they match, it validates the system's behavior. When they differ — for example, the AI thought a traffic light was red but the driver proceeded — the scenario imagery and video are flagged and can be uploaded to Tesla's servers for model retraining.

**Three-Chip Architecture (HW4.5).** Tesla has been preparing a three-SoC (System-on-Chip) architecture. The current HW4 uses a dual-chip design for redundancy, with both chips processing the driving scene in parallel. The third chip in HW4.5 enables:
- Two chips run stable production FSD software with standard redundancy
- The third chip runs an experimental "Alpha" version in the background (shadow mode)
- Triple Modular Redundancy (TMR) voting: if one chip hallucinates an obstacle but the other two see a clear road, the system votes to ignore the error
- Ability to split inference load across more silicon, running larger neural networks

**Data Engine Integration.** Shadow mode feeds Tesla's data engine — a flywheel of data collection, auto-labeling, model training, shadow validation, and OTA deployment. As of February 2026, Tesla reported 8.3 billion miles driven with FSD (Supervised), with a 400% increase in AI training compute during 2024.

**Scale Advantage.** While competitors rely on dedicated test fleets numbering in the hundreds or thousands, Tesla's approach tests against an unparalleled volume and diversity of real-world scenarios: inclement weather, challenging road layouts, and edge-case traffic interactions — all without risk to the driver.

### 1.3 Waymo's Approach

Waymo uses a fundamentally different architecture — a dedicated robotaxi fleet rather than consumer vehicles — but applies analogous shadow testing principles through simulation and replay:

**Waymax Simulator.** Built entirely in JAX for hardware-accelerated simulation, Waymax supports both log replay (replaying recorded behavior without regard to actual states in closed-loop rollout) and closed-loop simulation (using IDM-based route-following models that adjust speed profiles based on surrounding vehicle positions). It batches hundreds of scenarios in parallel at over 1000 Hz simulation throughput.

**Teacher-Student Architecture with Validation Layer.** Waymo employs a two-tier inference system:
- A large Teacher model handles complex reasoning during training
- A smaller Student model is distilled for real-time onboard deployment
- A separate, rigorous onboard validation layer verifies all generated trajectories before execution — analogous to a shadow-mode safety check

**Critic System.** Waymo's Critic component stress-tests the Waymo Driver by automatically identifying edge cases and generating improved alternatives. Behaviors flagged by the Critic are tested in simulation, verified, and deployed only after a safety framework confirms the absence of unreasonable risk.

**Dual Learning Loops:**
- Inner Loop: Reinforcement learning in simulation with reward/penalty signals
- Outer Loop: Real-world data feeds improvement cycle; flagged behaviors are tested in simulation, then deployed after safety confirmation

**SimulationCity.** Waymo's simulation platform automatically synthesizes entire journeys using over 20 million autonomous miles of collected data, plus third-party crash data (NHTSA). It generates realistic conditions including environmental factors like raindrops on sensors and solar glare.

### 1.4 comma.ai / openpilot

comma.ai implements a pragmatic graduated deployment model that demonstrates shadow mode principles in a consumer ADAS product:

**Shadow Mode for Parameter Learning.** In openpilot 0.9.9, the lateral acceleration delay learning daemon (lagd) ran in passive shadow mode for validation. Lagd learns the car's lateral time delay online — the time it takes for the car to reach the desired lateral acceleration commanded by openpilot, including system processing latency, steering actuator delay, and steering response lag. This lag varies across car models and even between individual cars of the same model. After validating the data from fleet deployment, version 0.10 enabled the use of live learned values.

**Experimental vs. Chill Mode.** openpilot implements a two-tier deployment:
- Chill Mode: Reliable and mature features; stable, proven behavior
- Experimental Mode: Alpha-stage features where "frequent mistakes are expected"
- Features progress from experimental to chill after fleet-wide validation

**Graduation Path.** End-to-end lateral planning → Chill mode (graduated). End-to-end longitudinal control → currently Experimental, graduating to Chill in upcoming releases. Navigate-on-openpilot → first rolled out in Experimental mode. The World Model ("Tomb Raider") in openpilot 0.10 removes MPC systems from both training and inference for lateral control in all modes, but longitudinal control still uses classical lead policy in Chill mode.

### 1.5 General Shadow Mode Architecture Pattern

Across all implementations, the common architectural elements are:

| Component | Purpose |
|-----------|---------|
| Shared Sensor Layer | Both stacks consume identical sensor data (cameras, LiDAR, IMU, etc.) |
| Isolated Compute | Shadow stack runs in separate compute domain (namespace, container, SoC) |
| Output Firewall | Shadow outputs are physically or logically prevented from reaching actuators |
| Comparison Engine | Real-time or post-hoc comparison of production vs. shadow decisions |
| Trigger-Based Recording | Disagreements between stacks trigger detailed data capture |
| Data Upload Pipeline | Selected edge cases uploaded for model retraining |
| Graduated Promotion | Shadow → supervised → primary, based on accumulated evidence |

---

## 2. ROS / ROS 2 Implementation

### 2.1 Dual Navigation Stacks in Parallel

The fundamental approach is running two complete autonomy stacks on the same robot, sharing sensors but isolated via namespaces, with only one stack connected to actuators.

**ROS 1 (Noetic) Architecture:**

```
rosmaster (shared)
│
├── /sensors/*  (shared topics — both stacks subscribe)
│   ├── /lidar/points
│   ├── /camera/image_raw
│   ├── /imu/data
│   └── /odom/fused
│
├── /production/*  (active stack)
│   ├── /production/perception/*
│   ├── /production/planning/*
│   └── /production/cmd_vel  (trajectory output → arbitrator)
│
├── /shadow/*  (experimental stack)
│   ├── /shadow/perception/*
│   ├── /shadow/planning/*
│   └── /shadow/cmd_vel  (trajectory output → logger ONLY)
│
├── /arbitrator/*  (safety monitor / simplex decision module)
│   ├── /arbitrator/divergence_score
│   ├── /arbitrator/selected_stack
│   └── /arbitrator/safety_status
│
└── /vehicle/*  (actuator interface)
    └── /vehicle/cmd_vel  (ONLY arbitrator publishes here)
```

**ROS 2 (Humble/Jazzy) Architecture:**

```python
# dual_stack_launch.py
from launch import LaunchDescription
from launch.actions import GroupAction, IncludeLaunchDescription
from launch_ros.actions import PushRosNamespace, SetRemap

def generate_launch_description():
    # Production stack — full autonomy with actuator access
    production_stack = GroupAction([
        PushRosNamespace('production'),
        # Remap sensor topics from shared namespace
        SetRemap(src='/lidar/points', dst='/sensors/lidar/points'),
        SetRemap(src='/camera/image_raw', dst='/sensors/camera/image_raw'),
        SetRemap(src='/imu/data', dst='/sensors/imu/data'),
        IncludeLaunchDescription(
            # Production perception + planning + control
            PythonLaunchDescriptionSource('production_nav.launch.py')
        ),
    ])

    # Shadow stack — observe only, no actuator access
    shadow_stack = GroupAction([
        PushRosNamespace('shadow'),
        # Same sensor remaps — shared input
        SetRemap(src='/lidar/points', dst='/sensors/lidar/points'),
        SetRemap(src='/camera/image_raw', dst='/sensors/camera/image_raw'),
        SetRemap(src='/imu/data', dst='/sensors/imu/data'),
        IncludeLaunchDescription(
            PythonLaunchDescriptionSource('shadow_nav.launch.py')
        ),
    ])

    # Arbitrator — compares outputs, gates actuator access
    arbitrator = IncludeLaunchDescription(
        PythonLaunchDescriptionSource('arbitrator.launch.py')
    )

    return LaunchDescription([
        production_stack,
        shadow_stack,
        arbitrator,
    ])
```

### 2.2 Namespace Isolation

ROS 2 provides two complementary isolation mechanisms:

**Namespaces** add a prefix to all node and topic names within a group, logically separating stacks while allowing selective cross-communication on shared sensor topics. This is the primary mechanism for dual-stack operation on the same robot.

```
/production/perception/detected_objects   ← production perception output
/shadow/perception/detected_objects       ← shadow perception output
/sensors/lidar/points                     ← shared sensor input (both subscribe)
```

**DDS Domain IDs** provide network-level isolation — nodes on different domain IDs cannot discover or communicate with each other at all. For dual-stack on the same robot, namespaces are preferred over domain IDs because the stacks need to share sensor topics. Domain IDs are more appropriate for isolating entirely separate robot systems on the same network.

**Nav2 Multi-Stack Support.** Nav2 natively supports namespacing through the `robot_namespace` launch parameter. All Nav2 launch files support namespacing, allowing two complete navigation stacks (SLAM, localization, planning) to run in parallel with different namespace prefixes.

### 2.3 Shared Sensor Access

Both stacks must consume the same sensor data to enable meaningful comparison. The approach:

**Sensor topics remain in a global namespace** (e.g., `/sensors/*`) accessible to both stacks. Each stack remaps its internal sensor topic references to the global topics.

**QoS Profile Strategy** (from ROS 2 autonomous driving research):

| Stream Category | QoS Settings | Rationale |
|----------------|-------------|-----------|
| Perception-critical (camera, LiDAR) | RELIABLE, KeepLast(2), VOLATILE, 40-50ms deadline | Ensure all perception data arrives; tolerate brief delays |
| Planning/control commands | BEST_EFFORT, KeepLast(1) | Event-driven; latest command matters most |
| Visualization/debug | BEST_EFFORT, KeepLast(1) | Non-critical; minimize overhead |
| Shadow comparison data | RELIABLE, KeepLast(5) | Ensure divergence data is not lost |

**Sensor Synchronization.** Different sensor streams operate at different frequencies — cameras at 20-30 Hz, LiDAR at 10-20 Hz, wheel encoders at 100 Hz. Both stacks must use consistent synchronization:
- Downsampling high-frequency streams for perception
- Zero-order hold upsampling for lower-frequency streams (hold last valid value until refresh)
- PTP (Precision Time Protocol) for hardware-level inter-sensor synchronization

### 2.4 Preventing Shadow Stack from Actuating

This is the single most critical safety requirement. Multiple layers of protection:

**Layer 1: Namespace Isolation.** The shadow stack publishes to `/shadow/cmd_vel`, which is a completely different topic from `/vehicle/cmd_vel`. No node in the shadow namespace has any topic remap or connection to the actuator topic.

**Layer 2: ROS 2 Lifecycle Managed Nodes.** Use lifecycle nodes for the actuator interface. The actuator driver node only processes commands when in the Active state, and its activate transition is controlled by the arbitrator. The shadow stack's output nodes are never transitioned to Active for the actuator subscription.

ROS 2 lifecycle states relevant to safety:
- **Unconfigured**: Node instantiated but not initialized
- **Inactive**: Node configured but does not process data or respond to functional requests — "will not receive any execution time to read topics"
- **Active**: Node processes data normally
- **Finalized**: Node preparing for destruction

The actuator node's `onActivate` callback should verify that the calling manager is the authorized arbitrator.

**Layer 3: Arbitrator/Gatekeeper Node.** A dedicated arbitrator node is the sole publisher on the actuator topic (`/vehicle/cmd_vel`). It subscribes to both `/production/cmd_vel` and `/shadow/cmd_vel`, but only forwards production commands to the actuator. Shadow commands are only logged and compared.

```python
class ArbitratorNode(LifecycleNode):
    def __init__(self):
        super().__init__('arbitrator')
        # Subscribe to both stacks
        self.prod_sub = self.create_subscription(
            Twist, '/production/cmd_vel', self.prod_callback, 10)
        self.shadow_sub = self.create_subscription(
            Twist, '/shadow/cmd_vel', self.shadow_callback, 10)
        # ONLY publisher to actuator topic
        self.actuator_pub = self.create_publisher(
            Twist, '/vehicle/cmd_vel', 10)
        # Shadow output is NEVER forwarded — only logged
        self.divergence_pub = self.create_publisher(
            DiagnosticStatus, '/arbitrator/divergence', 10)

    def prod_callback(self, msg):
        # Forward production commands to actuators
        self.actuator_pub.publish(msg)
        self.last_prod_cmd = msg
        self._compare_and_log()

    def shadow_callback(self, msg):
        # NEVER publish to actuator — only store for comparison
        self.last_shadow_cmd = msg
        self._compare_and_log()

    def _compare_and_log(self):
        if self.last_prod_cmd and self.last_shadow_cmd:
            divergence = self._compute_divergence(
                self.last_prod_cmd, self.last_shadow_cmd)
            self.divergence_pub.publish(divergence)
            if divergence.level > DIVERGENCE_THRESHOLD:
                self._trigger_detailed_recording()
```

**Layer 4: Hardware Interlock.** For safety-critical deployments, the actuator interface (e.g., CAN bus driver, motor controller) should have a hardware-level gate that only accepts commands from an authenticated source. The shadow stack's compute domain should not have physical access (USB, serial, CAN) to actuator hardware.

**Layer 5: Docker/Container Isolation.** Run the shadow stack in a Docker container that does not have `--device` flags for actuator hardware (serial ports, CAN interfaces). The container receives sensor data via ROS 2 DDS network but has no device access to actuators.

### 2.5 Docker Isolation Architecture

```yaml
# docker-compose.yml for dual-stack deployment
version: '3.8'

services:
  # Sensor drivers — host network, device access
  sensors:
    image: av_sensors:latest
    network_mode: host
    devices:
      - /dev/ttyUSB0:/dev/ttyUSB0    # GPS
      - /dev/video0:/dev/video0       # Camera
    privileged: false
    environment:
      - ROS_DOMAIN_ID=0

  # Production stack — has actuator device access
  production:
    image: av_production:latest
    network_mode: host
    devices:
      - /dev/ttyACM0:/dev/ttyACM0    # Motor controller / CAN
    environment:
      - ROS_DOMAIN_ID=0
      - ROS_NAMESPACE=production
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 8G
        reservations:
          devices:
            - capabilities: [gpu]
              count: 1

  # Shadow stack — NO actuator device access
  shadow:
    image: av_shadow:latest
    network_mode: host
    # NO devices section — cannot access actuator hardware
    environment:
      - ROS_DOMAIN_ID=0
      - ROS_NAMESPACE=shadow
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          devices:
            - capabilities: [gpu]
              count: 1

  # Arbitrator — has actuator access, gates commands
  arbitrator:
    image: av_arbitrator:latest
    network_mode: host
    devices:
      - /dev/ttyACM0:/dev/ttyACM0    # Motor controller
    environment:
      - ROS_DOMAIN_ID=0
```

**Key isolation properties:**
- Shadow container has no `devices` entry for actuator hardware — even if the shadow stack software has a bug that attempts to publish to actuator topics, there is no hardware path
- Resource limits (CPU, memory) prevent shadow stack from starving production
- Separate GPU allocations prevent inference contention (see Section 6)
- `network_mode: host` allows DDS discovery across containers while namespaces prevent topic collision

**Real-time Considerations.** Docker introduces nondeterminism through kernel-mediated resource control and virtualized networking. For safety-critical production deployments, consider:
- Using `--privileged=false` with explicit capability drops
- Setting CPU affinity via `--cpuset-cpus` for deterministic scheduling
- Using `--network=host` to avoid bridge networking latency
- Configuring SCHED_FIFO real-time scheduling for production container

---

## 3. Comparison and Analysis

### 3.1 Trajectory Divergence Metrics

When comparing production and shadow stack outputs, multiple complementary metrics capture different aspects of divergence:

**Point-wise Metrics:**

| Metric | Formula | What It Captures |
|--------|---------|-----------------|
| Lateral Deviation | Cross-track error at each timestep | Lane-keeping divergence |
| Longitudinal Error | Along-track error at each timestep | Speed/timing divergence |
| Heading Error | |θ_prod - θ_shadow| | Steering intent divergence |
| Speed Error | |v_prod - v_shadow| | Velocity control divergence |
| Action MSE/MAE | Mean squared/absolute error on (steer, throttle, brake) | Raw control divergence |

**Trajectory-level Metrics:**

| Metric | What It Captures |
|--------|-----------------|
| Frechet Distance | Order-preserving shape similarity — accounts for both spatial and temporal trajectory relationships; superior to Hausdorff for AV trajectories because it respects the direction and motion dynamics along the curve |
| Hausdorff Distance | Worst-case spatial deviation — the longest of all distances from a point on one trajectory to the nearest point on the other |
| Average Displacement Error (ADE) | Mean L2 distance between corresponding trajectory points over entire prediction horizon |
| Final Displacement Error (FDE) | L2 distance between trajectory endpoints — captures long-horizon planning divergence |
| Jerk Divergence | Difference in third derivative of position — captures comfort/smoothness differences |

**Semantic Metrics:**

| Metric | What It Captures |
|--------|-----------------|
| Decision Agreement Rate | Percentage of timesteps where both stacks agree on high-level action (go/stop/yield/turn) |
| Lane Assignment Agreement | Whether both stacks select the same target lane |
| Object Priority Agreement | Whether both stacks rank detected objects the same way for yielding/collision avoidance |
| Traffic Rule Compliance Delta | Difference in traffic rule violations between stacks |

### 3.2 Disagreement Detection

Implement a real-time disagreement detection pipeline with severity levels:

```python
class DisagreementDetector:
    """Multi-level disagreement detection between production and shadow stacks."""

    # Severity levels
    NOMINAL = 0       # Stacks agree within noise
    MINOR = 1         # Small trajectory differences, same intent
    MODERATE = 2      # Different trajectory shape, same high-level decision
    MAJOR = 3         # Different high-level decisions (e.g., go vs. stop)
    CRITICAL = 4      # One stack would cause collision, other would not

    def classify_disagreement(self, prod_traj, shadow_traj, scene_context):
        lateral_dev = compute_max_lateral_deviation(prod_traj, shadow_traj)
        speed_diff = compute_max_speed_difference(prod_traj, shadow_traj)
        decision_match = compare_high_level_decisions(prod_traj, shadow_traj)
        collision_prod = check_collision(prod_traj, scene_context)
        collision_shadow = check_collision(shadow_traj, scene_context)

        if collision_prod != collision_shadow:
            return self.CRITICAL
        if not decision_match:
            return self.MAJOR
        if lateral_dev > 1.0 or speed_diff > 5.0:  # meters, m/s
            return self.MODERATE
        if lateral_dev > 0.3 or speed_diff > 1.0:
            return self.MINOR
        return self.NOMINAL
```

**Feature Disagreement Scoring (FDS).** Recent research has developed metrics that quantify semantic misalignment at the BEV (Bird's Eye View) level, guiding conditional fusion decisions. FDSNet adaptively selects the fusion stage based on measured semantic consistency across sensor modalities — this is relevant when the production and shadow stacks use different perception architectures.

**Ensemble Disagreement for Epistemic Uncertainty.** The InDRiVE framework uses latent ensemble disagreement as a proxy for epistemic uncertainty. Applied to shadow mode: if multiple model variants in the shadow stack disagree among themselves, it signals high uncertainty — a valuable trigger for data collection regardless of whether the shadow agrees with production.

### 3.3 Root Cause Analysis

When disagreements are detected, automated root cause analysis categorizes them:

```
Disagreement Root Cause Taxonomy
├── Perception Divergence
│   ├── Object detection differences (FP/FN/classification)
│   ├── Tracking continuity differences
│   ├── Localization drift differences
│   └── Sensor fusion strategy differences
├── Prediction Divergence
│   ├── Different predicted trajectories for same detected objects
│   ├── Different intent classification for agents
│   └── Different time-to-collision estimates
├── Planning Divergence
│   ├── Different cost function weightings
│   ├── Different route preferences
│   ├── Different gap acceptance thresholds
│   └── Different comfort/safety tradeoffs
└── Control Divergence
    ├── Different tracking controllers
    ├── Different actuator models (lag, saturation)
    └── Different low-level optimization parameters
```

For each disagreement event, log:
1. The raw sensor data (camera, LiDAR frames) at the disagreement timestamp
2. Each stack's intermediate representations (BEV maps, detected objects, predicted trajectories)
3. Each stack's planning output (candidate trajectories, selected trajectory, cost breakdown)
4. Scene context (road geometry, traffic state, weather, time of day)
5. The human driver's actual action (if in human-driver shadow mode)

### 3.4 Monitoring Dashboards

Build observability infrastructure using standard DevOps tools adapted for robotics:

**Prometheus + Grafana Stack:**
- Prometheus scrapes metrics from ROS 2 nodes via a custom exporter that subscribes to diagnostic topics
- Grafana dashboards visualize real-time and historical metrics

**Key Dashboard Panels:**

| Panel | Metrics | Refresh Rate |
|-------|---------|-------------|
| Stack Health | CPU/GPU utilization per stack, memory usage, node heartbeats | 1s |
| Inference Latency | Per-model p50/p95/p99 latency for each stack | 1s |
| Divergence Overview | Disagreement count by severity level (rolling window) | 5s |
| Trajectory Comparison | Real-time overlay of production vs. shadow planned paths on map | 100ms |
| Decision Timeline | Time series of high-level decisions by each stack with agreement highlighting | 1s |
| Perception Delta | Detected object count differences, missed/extra detections | 1s |
| Data Recording Status | Bag recording state, disk usage, upload queue depth | 10s |
| Safety Monitor | Arbitrator state, selected stack, intervention count | 100ms |

**Autoware Reference Implementation.** Autoware provides a comprehensive monitoring system:
- **Error Monitor**: Judges system hazard level from aggregated diagnostic information of each module
- **Health Checker**: In-ROS and out-of-ROS diagnostics with heartbeat checking
- **Emergency Handler**: Contains a heartbeat checker (watchdog) that generates emergency state if the DrivingCapability message is not received at the specified frequency
- **Diagnostic Aggregator**: Hierarchical diagnostics output with graph-based analysis to trace root causes through node connection topology

---

## 4. Data Collection

### 4.1 What to Record

**Always-On Lightweight Recording (Continuous):**

| Data Category | Topics | Rate | Approx. Bandwidth |
|--------------|--------|------|-------------------|
| Production decisions | `/production/cmd_vel`, `/production/planned_path` | 10-50 Hz | ~100 KB/s |
| Shadow decisions | `/shadow/cmd_vel`, `/shadow/planned_path` | 10-50 Hz | ~100 KB/s |
| Divergence metrics | `/arbitrator/divergence`, severity scores | 10 Hz | ~10 KB/s |
| Vehicle state | Odometry, speed, steering angle | 100 Hz | ~500 KB/s |
| High-level decisions | Go/stop/yield from both stacks | 10 Hz | ~5 KB/s |
| System diagnostics | CPU/GPU temps, node health, latencies | 1 Hz | ~1 KB/s |

**Trigger-Based Full Recording (On Disagreement):**

| Data Category | Topics | Rate | Approx. Bandwidth |
|--------------|--------|------|-------------------|
| All cameras (raw) | `/sensors/camera/*/image_raw` | 20-30 Hz | 500-11,500 Mbit/s |
| LiDAR point clouds | `/sensors/lidar/points` | 10-20 Hz | 20-100 Mbit/s |
| Radar detections | `/sensors/radar/tracks` | 20 Hz | ~1 Mbit/s |
| IMU/GPS | `/sensors/imu/data`, `/sensors/gps/fix` | 100-200 Hz | ~1 Mbit/s |
| Perception intermediates | BEV maps, detections, tracks per stack | 10 Hz | ~50 Mbit/s |
| Planning intermediates | Cost maps, candidate trajectories per stack | 10 Hz | ~10 Mbit/s |

### 4.2 Synchronization

**Hardware-Level Synchronization:**
- PTP (Precision Time Protocol) for inter-sensor time alignment
- GPIO-based trigger generation for camera/LiDAR synchronization (as used in Tier IV's Data Recording System)
- All messages timestamped with synchronized ROS time

**Software-Level Synchronization:**
- `message_filters::ApproximateTimeSynchronizer` to align sensor streams before processing
- Both stacks must process the same sensor frame — use a shared sensor dispatcher node that republishes with a common frame ID

### 4.3 Storage Requirements

**Per-Sensor Bandwidth (representative configuration):**

| Sensor | Count | Per-Unit Rate | Total |
|--------|-------|---------------|-------|
| Camera (1080p, compressed) | 6 | ~10 MB/s | ~60 MB/s |
| Camera (1080p, raw) | 6 | ~170 MB/s | ~1,020 MB/s |
| LiDAR (128-beam) | 2 | ~15 MB/s | ~30 MB/s |
| Radar | 4 | ~0.5 MB/s | ~2 MB/s |
| IMU/GPS/CAN | - | ~0.5 MB/s | ~0.5 MB/s |
| **Total (compressed cameras)** | | | **~93 MB/s (~335 GB/hr)** |
| **Total (raw cameras)** | | | **~1,053 MB/s (~3.8 TB/hr)** |

Industry benchmarks confirm these ranges: a typical L4 autonomous vehicle generates 1.4 to 19 TB per hour depending on sensor configuration, with some estimates reaching 40 TB/hr for fully-equipped sensor suites.

**Storage Tiering (from AVS research):**

| Tier | Medium | Capacity | Purpose |
|------|--------|----------|---------|
| Hot (onboard) | NVMe SSD | 2-4 TB | Real-time recording buffer, fast random access |
| Warm (onboard) | SATA SSD | 4-8 TB | Daily accumulation before offload |
| Cold (offboard) | HDD / cloud | Unlimited | Long-term archival, training data lake |

**Compression Strategies (from AVS research):**
- LiDAR: LAZ format achieves 6.56x compression with geometric fidelity
- Images: JPEG quality 95 delivers 4.06x compression at 1.45ms latency
- Combined: 8.4x smaller than raw rosbag, 5.0x smaller than zstd compression
- LiDAR voxel grid downsampling (0.2m) reduces points ~53%, storage to ~24% of original

### 4.4 Trigger-Based Recording on Disagreements

Use rosbag2's snapshot mode for efficient event-based capture:

```bash
# Start recording in snapshot mode — keeps circular buffer in memory
ros2 bag record --snapshot-mode \
    --max-cache-size 1073741824 \    # 1 GB circular buffer
    --max-cache-duration 30 \        # Keep last 30 seconds
    --topics /sensors/camera/*/image_compressed \
             /sensors/lidar/points \
             /sensors/imu/data \
             /production/cmd_vel \
             /shadow/cmd_vel \
             /arbitrator/divergence \
    --output /data/snapshots/
```

When the disagreement detector triggers:

```python
# In the arbitrator node, when divergence exceeds threshold:
def _trigger_detailed_recording(self):
    """Dump snapshot buffer and start full recording."""
    # 1. Trigger snapshot dump (captures last 30 seconds)
    self.snapshot_client.call_async(Trigger.Request())

    # 2. Start time-bounded full recording for next 60 seconds
    self.start_full_recording(duration_sec=60)

    # 3. Log metadata (scenario type, severity, location, timestamp)
    self.log_trigger_event(
        severity=self.current_divergence.level,
        location=self.current_gps,
        scenario_hash=self.compute_scenario_hash()
    )
```

**Trigger Hierarchy:**

| Trigger Level | Condition | Action |
|--------------|-----------|--------|
| Level 0 (Always) | All times | Log lightweight decision metrics |
| Level 1 (Minor) | Lateral divergence > 0.3m | Start full sensor recording for 30s |
| Level 2 (Moderate) | Different trajectory shape | Dump 30s snapshot + record 60s |
| Level 3 (Major) | Different high-level decision | Dump 60s snapshot + record 120s + mark for priority upload |
| Level 4 (Critical) | Collision prediction disagreement | Dump max buffer + continuous record + immediate upload alert |

### 4.5 Data Pipeline

```
On-Vehicle                    Off-Vehicle
┌──────────────────────┐     ┌─────────────────────────────┐
│ Sensor Drivers       │     │ Cloud/Edge Data Lake         │
│   ↓                  │     │                              │
│ Shared Sensor Bus    │     │ ┌─────────────────────────┐  │
│   ↓          ↓       │     │ │ Raw Bag Storage (S3)    │  │
│ Prod Stack  Shadow   │     │ └──────────┬──────────────┘  │
│   ↓          ↓       │     │            ↓                 │
│ Comparator/Arbiter   │     │ ┌─────────────────────────┐  │
│   ↓                  │     │ │ Auto-Labeling Pipeline  │  │
│ Trigger Engine       │     │ └──────────┬──────────────┘  │
│   ↓                  │     │            ↓                 │
│ Bag Recorder         │     │ ┌─────────────────────────┐  │
│ (snapshot + full)    │     │ │ Scenario Database        │  │
│   ↓                  │ ──► │ │ (disagreement catalog)  │  │
│ Upload Queue         │WiFi │ └──────────┬──────────────┘  │
│ (prioritized)        │     │            ↓                 │
└──────────────────────┘     │ ┌─────────────────────────┐  │
                             │ │ Model Training Pipeline │  │
                             │ └─────────────────────────┘  │
                             └─────────────────────────────┘
```

---

## 5. Graduated Trust Transfer

### 5.1 Progression Stages

The transition from shadow to primary uses a multi-stage progression with clear criteria at each gate:

```
Stage 0          Stage 1           Stage 2           Stage 3           Stage 4
SHADOW     →   SUPERVISED      →   SUPERVISED     →   PRIMARY        →   PRIMARY
(observe        SHADOW              SIMPLEX            (shadow is         (shadow
 only)          (can suggest,       (shadow can        the old            retired)
                driver confirms)    take control       production
                                    with human         stack)
                                    override ready)
```

**Stage 0: Pure Shadow Mode**
- Shadow stack runs in parallel, outputs logged but never actuated
- Duration: weeks to months
- Goal: accumulate statistical evidence of shadow stack competence
- Exit criteria: see Section 5.2

**Stage 1: Supervised Shadow (Advisory)**
- Shadow stack suggestions displayed to operator/safety driver
- Operator can accept shadow recommendations or override
- Acceptance rate tracked as a confidence metric
- Equivalent to comma.ai's "Experimental Mode"

**Stage 2: Supervised Simplex**
- Shadow stack becomes the primary controller, but:
  - Human driver/safety operator has immediate override capability
  - Production stack runs as hot backup (reverse shadow mode)
  - Simplex safety monitor can instantly switch back to production stack
- The Simplex Architecture pattern: advanced controller (shadow) runs with a verified baseline controller (production) as backup, and a decision module monitors the advanced controller's outputs

**Stage 3: Primary with Shadow Backup**
- Former shadow stack is now the primary controller
- Former production stack runs in shadow mode for regression monitoring
- Simplex safety monitor still active, but rarely triggers
- New experimental features can begin their own shadow cycle on a third stack

**Stage 4: Full Transition**
- Old production stack retired
- New primary stack operates independently
- Next-generation shadow stack development begins

### 5.2 Metrics for Promotion

**Gate 0 → 1 (Shadow to Supervised Shadow):**

| Metric | Threshold | Rationale |
|--------|-----------|-----------|
| Decision Agreement Rate | > 95% over 10,000+ km | Shadow mostly agrees with production |
| Critical Disagreements | 0 where shadow would cause collision | Shadow never makes dangerous decisions |
| Perception Recall | ≥ production recall on all object classes | Shadow detects at least as many objects |
| Mean Trajectory Divergence (ADE) | < 0.5m over 5s horizon | Shadow trajectories are close to production |
| Latency p99 | ≤ production p99 | Shadow meets real-time requirements |
| Uptime | > 99.9% | Shadow does not crash or hang |

**Gate 1 → 2 (Supervised Shadow to Supervised Simplex):**

| Metric | Threshold | Rationale |
|--------|-----------|-----------|
| Operator Acceptance Rate | > 90% of shadow suggestions accepted | Human experts trust shadow decisions |
| Shadow-Better Rate | > 30% of disagreements favor shadow | Shadow is measurably better on some scenarios |
| Zero safety-critical failures | 0 over 5,000+ km of accepted shadow suggestions | No accepted shadow suggestions caused problems |
| Scenario Coverage | Shadow tested on ≥ 95% of defined ODD scenarios | Broad exposure to operational design domain |

**Gate 2 → 3 (Supervised Simplex to Primary):**

| Metric | Threshold | Rationale |
|--------|-----------|-----------|
| Disengagement Rate | < production historical rate | Fewer interventions than production |
| Miles Between Interventions | > 2x production baseline | Significantly better than production |
| Backup Activation Rate | < 1 per 1,000 km | Simplex safety monitor rarely triggers |
| Passenger Comfort Score | ≥ production (jerk, lateral acceleration) | Ride quality at least as good |
| Regulatory Compliance | All applicable standards met | Legal/regulatory gate |

### 5.3 Simplex Architecture for Trust Transfer

The Simplex Architecture provides the formal safety framework for graduated transfer:

**Architecture:**
```
                    ┌──────────────────┐
Sensor Data ──────► │  Advanced        │──► Candidate
                    │  Controller      │    Command
                    │  (shadow/new)    │       │
                    └──────────────────┘       │
                                               ▼
                    ┌──────────────────┐  ┌─────────────┐
Sensor Data ──────► │  Baseline        │  │  Decision    │──► Actuator
                    │  Controller      │──│  Module      │    Command
                    │  (production)    │  │  (safety     │
                    └──────────────────┘  │   monitor)   │
                                          └─────────────┘
```

**Decision Module Switching Logic:**
- The Decision Module continuously validates the advanced controller's output
- If the advanced controller drives the system through states from which the baseline can recover, it continues to actuate
- If safety is violated — the baseline controller's candidate command sequence fails to maintain safety — the DM uses a stored safe command sequence from the previous timestep
- This provides a formal guarantee: the system remains safe even if the advanced controller is completely untrusted

**Black-Box Simplex Variant:** The baseline controller does not need to be statically verified. Instead, the Decision Module performs more extensive runtime checking using safety envelopes defined by:
- Velocity limits that tighten with proximity to obstacles (zone-based)
- Geometric constraints (stay within lane boundaries)
- Kinematic feasibility checks (achievable acceleration, steering rate)

### 5.4 comma.ai's Graduation Approach

comma.ai provides a practical reference for graduated feature deployment:

1. **Shadow Mode Validation**: New parameters (e.g., lateral delay learning) run passively in shadow mode across the fleet, collecting data without affecting vehicle behavior
2. **Data Validation**: Engineering team analyzes collected shadow data to verify correctness and safety
3. **Experimental Mode Release**: Feature is enabled in Experimental mode — alpha quality, willing early adopters only, "frequent mistakes are expected"
4. **Fleet-Wide Monitoring**: Real-world performance data collected from Experimental mode users
5. **Chill Mode Graduation**: After sufficient evidence of reliability, feature graduates to Chill mode — the default, mature experience

Key insight from comma.ai: they validate specific learned parameters (like per-car lateral delay) in shadow mode before enabling them, rather than shadow-testing entire stack replacements. This granular approach reduces risk at each promotion step.

---

## 6. Edge Cases and Operational Challenges

### 6.1 Crash Isolation and Fault Containment

**Process-Level Isolation:**
- Run each stack as a separate process group with independent watchdogs
- If the shadow stack crashes (segfault, OOM), it must not affect the production stack
- Use Linux process isolation: separate PID namespaces, cgroups, memory limits
- The Autoware emergency handler pattern: heartbeat checker (watchdog) generates emergency state if expected messages are not received at the specified frequency

**Container-Level Isolation:**
- Shadow stack in a Docker container with strict resource limits
- Production stack either on bare metal or in a privileged container with real-time scheduling
- Container restart policies: shadow stack auto-restarts on crash; production stack triggers safe stop if it crashes

**Hypervisor-Level Isolation (safety-critical deployments):**
- Type-1 hypervisor (e.g., CLARE, Xen, QNX Hypervisor) providing strong spatial and temporal isolation
- Rich Domain: Linux with neural networks and complex perception (untrusted)
- Safe Domain: RTOS with safety-critical control functions (trusted)
- Bounded inter-domain communication latency (< 10 microseconds demonstrated in research)
- VM runtime monitoring with anomaly detection and trusted backup restoration

### 6.2 GPU / CPU Contention

Running two full autonomy stacks on the same hardware creates severe resource contention:

**GPU Contention Problem:**
- On integrated CPU-GPU SoCs (NVIDIA Jetson family), CPU and GPU share main memory subsystem
- Memory-intensive CPU tasks can cause up to 4x slowdown for real-time GPU tasks (demonstrated on Tegra K1)
- Worst-case GPU kernel slowdown can exceed 250% due to memory bandwidth contention
- Non-preemptive GPU kernel execution means low-priority inference can block high-priority inference

**GPU Isolation Technologies:**

| Technology | Mechanism | Isolation Level | Suitability |
|-----------|-----------|----------------|-------------|
| **MIG (Multi-Instance GPU)** | Hardware partitioning of GPCs | Strong (compute + memory) | Best for A100+; rigid allocation |
| **MPS (Multi-Process Service)** | Shared CUDA context, concurrent SM use | Moderate (compute only) | Good for Jetson; flexible but no memory isolation |
| **Green Contexts (GC)** | Per-process SM allocation limits (CUDA 12.4+) | Moderate (compute only) | Fine-grained; good for Jetson Orin |
| **Time Slicing** | OS-level GPU context switching | Weak (temporal only) | Simplest; high overhead |

**Practical Mitigation Strategy:**
```
Production Stack:
  - Priority: SCHED_FIFO, high nice value
  - GPU: 70% of SMs (via MPS/GC)
  - CPU: Cores 0-3 (via cpuset cgroup)
  - Memory: 8 GB reserved

Shadow Stack:
  - Priority: SCHED_OTHER (normal)
  - GPU: 30% of SMs (via MPS/GC)
  - CPU: Cores 4-5 (via cpuset cgroup)
  - Memory: 4 GB limit

Safety Monitor:
  - Priority: SCHED_FIFO, highest
  - CPU: Core 6 (dedicated, isolated)
  - No GPU (rules-based, not ML)
```

**BWLOCK++ Pattern:** Before a production GPU kernel launches, the OS is notified and regulates memory bandwidth consumption of shadow stack CPU cores by throttling non-real-time tasks if they exceed their periodic bandwidth budget.

### 6.3 Sensor Data Contention

Both stacks subscribing to the same sensor topics creates concerns:

**DDS Multicast.** ROS 2's DDS middleware natively supports one-to-many publication. A single sensor publisher can serve multiple subscribers without duplicating data at the publisher. However, each subscriber maintains its own buffer, so memory usage scales with subscriber count.

**Zero-Copy Transport.** Use shared-memory transport (e.g., Eclipse iceoryx, CycloneDDS shared memory) to avoid copying large sensor messages (camera frames, point clouds) between stacks. Both stacks read from the same shared memory segment.

**Sensor Driver Priority.** Sensor driver nodes should run at highest priority with dedicated CPU cores. Neither production nor shadow stack processing should be able to starve sensor drivers of CPU time.

### 6.4 Network Bandwidth

**On-Vehicle (inter-process):**
- DDS shared-memory transport eliminates network overhead for co-located nodes
- Camera data at 6x 1080p @ 30Hz ≈ 1 GB/s raw — shared memory is essential
- If using separate machines (dual-computer architecture), use dedicated Ethernet links (10 GbE minimum)

**Vehicle-to-Cloud (data upload):**
- Continuous lightweight telemetry: ~1 KB/s (feasible over cellular)
- Trigger-based bag uploads: 100 MB - 10 GB per event
- Strategy: queue uploads for WiFi connectivity; prioritize by severity
- Daily data budget: estimate based on trigger frequency and average event size

### 6.5 Privacy Considerations

Shadow mode at fleet scale collects vast amounts of data from public roads:

- Camera images may capture pedestrian faces, license plates, private property
- GPS traces reveal driving patterns and frequently visited locations
- Data must be anonymized before upload: face blurring, license plate masking
- GDPR and regional privacy regulations apply to fleet data collection
- On-vehicle processing for anonymization before any cloud upload
- Data retention policies: auto-delete after training use, configurable retention periods
- Consent frameworks: users must opt in to data collection programs

For airside airport operations: privacy concerns are reduced (controlled environment, no public pedestrians), but airport security requirements and CCTV governance may impose additional data handling constraints.

---

## 7. Evaluation Framework

### 7.1 Offline Replay on Bags

Replay recorded rosbags through the shadow stack to evaluate performance on historical scenarios:

**Open-Loop Replay:**
- Feed recorded sensor data through the perception and planning pipeline
- Compare shadow stack output to ground-truth human driver actions
- Evaluate perception recall/precision against labeled data
- Fast and scalable — can run faster than real-time on cloud GPUs

**Closed-Loop Log Replay (Re-simulation):**
Re-simulation goes beyond open-loop by responding to stack outputs:
- Recreate a logged real-world drive scene and alter it using simulation
- Determine "what would have happened" if the shadow stack had been in control
- Account for "ego divergence" — when the shadow stack chooses a different trajectory, other agents in the scene would react differently
- Apply coordinate transforms to align actor positions with the simulated ego pose

**Implementation with Applied Intuition's approach:**
1. Raw sensor data feeds into perception stack (open-loop portion)
2. Detected actors extracted for closed-loop motion planning
3. Perception outputs modified for ego divergence compensation
4. Metrics and observers compute pass/fail results
5. Engineers can augment scenarios by adding/removing actors, altering behaviors, injecting faults

**Reproducibility Requirement:** Before trusting re-simulation results, validate accuracy by running re-simulations on log sections without disengagements — the result should match the original recorded outcome. Computational timing differences between vehicle hardware and cloud hardware can cause inaccurate and non-deterministic results.

### 7.2 Counterfactual Evaluation

**Wayve GAIA-3 Approach:**
Generate realistic counterfactual scenarios using a 15-billion-parameter latent diffusion world model:
- "Re-drive" authentic sequences with parameterized variations — alter the ego vehicle's trajectory while every other element remains consistent
- Generate safety-critical scenarios: ego drifting into oncoming traffic, cyclist speeding up, sudden pedestrian appearance
- Validate spatial structure by aligning real-world LiDAR point clouds with generated frames
- Early studies show simulated testing closely mirrors real-world driving results, with 5x reduction in synthetic-test rejection rates

**Uncertainty-Weighted Evaluation (UWE):**
From recent research on scalable offline metrics:
- Weight prediction errors by model epistemic uncertainty (via Monte Carlo dropout)
- Achieves 13% improvement in correlation with actual driving performance compared to standard metrics
- Does not require perception annotations or HD maps — applicable at scale
- Correlation of 0.69 with Driving Score using dropout (0.80 with full ensembles)
- Production-ready characteristic: can be automatically applied at scale to any policy and dataset

**Counterfactual Scenario Categories:**

| Category | Examples | Generation Method |
|----------|----------|-------------------|
| Ego perturbation | Altered speed, steering, lane position | Trajectory modification in replay |
| Agent perturbation | Aggressive driver, jaywalking pedestrian | Behavior model modification |
| Environment variation | Rain, fog, night, glare | Sensor simulation / world model |
| Infrastructure change | Missing lane markings, construction zone | Scene editing |
| Failure injection | Sensor dropout, delayed perception | Fault injection framework |

### 7.3 Simulation Testing

**Simulation Stack Architecture:**

```
┌──────────────────────────────────────────────────────┐
│  SIMULATION ENVIRONMENT                               │
│  (CARLA, LGSVL, Waymax, GAIA-3, custom)              │
│                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐ │
│  │ Sensor Sim  │  │ Traffic Sim │  │ Physics Sim  │ │
│  │ (cameras,   │  │ (agents,    │  │ (vehicle     │ │
│  │  LiDAR)     │  │  traffic)   │  │  dynamics)   │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘ │
│         └────────────────┼────────────────┘          │
│                          ▼                            │
│              Simulated Sensor Data                    │
└──────────────────────────┬───────────────────────────┘
                           │ (ROS 2 bridge)
                           ▼
              ┌────────────────────────┐
              │  SHADOW STACK          │
              │  (identical to onboard)│
              └────────────┬───────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │  EVALUATION METRICS    │
              │  - Driving Score       │
              │  - Route Completion    │
              │  - Infraction Count    │
              │  - Comfort Metrics     │
              └────────────────────────┘
```

**Simulation Testing Protocol:**
1. **Regression Suite**: Fixed set of scenarios run on every code change — detects regressions
2. **Scenario Fuzzing**: Parameterized scenario generation with randomized variations — explores edge cases
3. **Adversarial Testing**: Scenarios specifically designed to trigger known failure modes
4. **Endurance Testing**: Long-duration simulated drives (hours) — tests stability and accumulated drift
5. **Cross-Domain Testing**: Scenarios from Waymo Open Motion Dataset, nuScenes, or custom airside scenarios

### 7.4 KPIs for Production Readiness

**Tier 1: Safety-Critical (Must Pass)**

| KPI | Target | Measurement Method |
|-----|--------|-------------------|
| Collision Rate (simulated) | 0 per 10,000 km in regression suite | Closed-loop simulation |
| Safety Intervention Rate | < 1 per 5,000 km in supervised testing | On-vehicle supervised deployment |
| Emergency Stop Rate | < 1 per 1,000 km (false positive) | On-vehicle deployment |
| Time to Safe Stop | < 3 seconds from any state | Simulation + on-vehicle testing |
| Perception Object Recall | > 99.5% for vehicles, > 98% for pedestrians | Labeled dataset evaluation |
| Latency Budget Compliance | p99 < 100ms end-to-end | On-vehicle profiling |

**Tier 2: Performance (Should Meet)**

| KPI | Target | Measurement Method |
|-----|--------|-------------------|
| Route Completion Rate | > 99% on defined routes | Simulation + on-vehicle |
| Driving Score (CARLA-style) | > 90% (route completion × infraction penalty) | Simulation |
| Trajectory Smoothness | Lateral jerk < 5 m/s³, longitudinal jerk < 3 m/s³ | On-vehicle recording |
| Speed Compliance | Within ±5% of speed limit, ±10% of flow speed | On-vehicle recording |
| Traffic Rule Compliance | 0 red light violations, 0 wrong-way, 0 stop sign violations | Simulation + on-vehicle |

**Tier 3: Operational (Should Track)**

| KPI | Target | Measurement Method |
|-----|--------|-------------------|
| Mean Mission Time | Within 1.2x of human baseline | Fleet statistics |
| Passenger Comfort Rating | ≥ 4/5 from passengers (if applicable) | Surveys |
| System Uptime | > 99.9% during operational hours | System monitoring |
| Shadow-Production Agreement | > 95% on high-level decisions | Divergence analysis |
| Model Inference Utilization | GPU < 80% average, < 95% peak | System monitoring |
| Data Upload Success Rate | > 99% of triggered events uploaded within 24h | Pipeline monitoring |

**Evaluation Cadence:**

| Activity | Frequency | Scope |
|----------|-----------|-------|
| Simulation regression suite | Every commit / PR | Full scenario library |
| Offline bag replay evaluation | Daily | New bags from fleet |
| Shadow mode divergence review | Daily | Aggregate metrics, drill into critical events |
| Supervised on-vehicle testing | Weekly | Controlled test routes |
| Counterfactual evaluation | Monthly | Generated edge cases |
| Full production readiness review | Quarterly | All Tier 1-3 KPIs |

---

## 8. Putting It Together — Implementation Roadmap

### Phase 1: Instrumentation (Weeks 1-4)
- Add namespace isolation to production stack launch files
- Implement lightweight decision logging on production stack
- Set up rosbag2 snapshot recording infrastructure
- Deploy Prometheus + Grafana monitoring for production stack baseline metrics
- Establish data upload pipeline (vehicle → cloud storage)

### Phase 2: Shadow Stack Integration (Weeks 5-8)
- Deploy shadow stack in Docker container with namespace isolation
- Verify sensor sharing via DDS multicast / shared memory
- Implement arbitrator node with divergence detection
- Validate that shadow stack has zero actuator access (hardware + software audit)
- Run shadow stack on recorded bags first (offline validation)

### Phase 3: Shadow Data Collection (Weeks 9-16)
- Deploy shadow stack on fleet vehicles in pure shadow mode
- Collect divergence statistics — establish baseline agreement rate
- Tune trigger thresholds for event-based recording
- Build disagreement catalog with root cause analysis
- Iterate on shadow stack model based on discovered edge cases

### Phase 4: Supervised Promotion (Weeks 17-24)
- Begin supervised simplex testing on controlled test routes
- Safety driver has immediate override capability
- Production stack runs as hot backup
- Track disengagement rate and intervention causes
- Validate Gate 1 → 2 metrics

### Phase 5: Primary Transition (Weeks 25+)
- Shadow stack becomes primary controller in expanding operational domain
- Former production stack monitors for regressions
- Track all Tier 1-3 KPIs continuously
- Begin next-generation shadow stack development cycle

---

## References and Key Sources

- [Tesla's FSD Shadow Mode: What It Is and How It Improves FSD](https://www.notateslaapp.com/news/3108/teslas-fsd-shadow-mode-what-it-is-and-how-it-improves-fsd)
- [Tesla FSD Hardware 4.5: A 3-Chip Upgrade Before AI5](https://www.notateslaapp.com/news/3529/tesla-fsd-hardware-45-appears-a-3-chip-upgrade-before-ai5)
- [Waymo: Demonstrably Safe AI for Autonomous Driving](https://waymo.com/blog/2025/12/demonstrably-safe-ai-for-autonomous-driving/)
- [Waymo SimulationCity](https://waymo.com/blog/2021/07/simulation-city/)
- [Waymax: An Accelerated, Data-Driven Simulator](https://waymo.com/research/waymax/)
- [comma.ai openpilot 0.10 Release](https://blog.comma.ai/010release/)
- [comma.ai openpilot 0.9.0 Release — Experimental Mode](https://blog.comma.ai/090release/)
- [The Simplex Architecture to Enhance Safety in Deep-Learning-Powered Autonomous Systems](https://arxiv.org/html/2509.21014)
- [The Black-Box Simplex Architecture for Runtime Assurance](https://arxiv.org/abs/2102.12981)
- [Shadow Testing in Autonomous Vehicles: A Novel Approach](https://ijsrcseit.com/index.php/home/article/view/CSEIT24106165)
- [Shadow Mode as the Next Step Towards Driverless Cars (Linklaters)](https://www.linklaters.com/en/insights/blogs/digilinks/2019/may/shadow-mode-as-the-next-step-towards-driverless-cars)
- [ROS 2-Based Architecture for Autonomous Driving Systems](https://pmc.ncbi.nlm.nih.gov/articles/PMC12845773/)
- [ROS 2 Managed Node Lifecycle Design](https://design.ros2.org/articles/node_lifecycle.html)
- [Nav2 — ROS 2 Navigation Stack](https://docs.nav2.org/)
- [Tier IV Data Recording System](https://github.com/tier4/data_recording_system)
- [AVS: A Computational and Hierarchical Storage System for Autonomous Vehicles](https://arxiv.org/html/2511.19453v1)
- [Scalable Offline Metrics for Autonomous Driving](https://arxiv.org/html/2510.08571v1)
- [GAIA-3: Scaling World Models to Power Safety and Evaluation (Wayve)](https://wayve.ai/thinking/gaia-3/)
- [Using Re-simulation to Verify AV Stack (Applied Intuition)](https://www.appliedintuition.com/blog/closed-loop-log-replay)
- [Sharing GPUs for Real-Time Autonomous Driving Systems (UNC dissertation)](https://www.cs.unc.edu/~anderson/diss/mingdiss.pdf)
- [Performance Isolation for Inference Processes in Edge GPU Systems](https://arxiv.org/html/2601.07600v1)
- [NVIDIA MPS Documentation](https://docs.nvidia.com/deploy/mps/introduction.html)
- [Docker and ROS 2 Guide](https://roboticseabass.com/2023/07/09/updated-guide-docker-and-ros2/)
- [Autoware Health Checker Design](https://github.com/autowarefoundation/autoware/issues/1860)
- [Autoware Error Monitor](https://tier4.github.io/autoware.iv/tree/main/system/autoware_error_monitor/)
- [ROS 2 Domain ID and Namespace for Multi-Robot Systems](https://blog.robotair.io/domain-id-and-namespace-in-ros-2-for-multi-robot-systems-9a939ae3fa40)
- [rosbag2 — ROS 2 Bag Recording](https://github.com/ros2/rosbag2)
