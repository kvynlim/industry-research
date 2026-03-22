# Simplex Architecture, Safety, and Shadow Mode

## Implementation Guide for Dual-Stack AV Operation

---

## 1. Simplex Architecture for ROS Noetic

### 1.1 Dual-Stack ROS Architecture

```
rosmaster (shared)
│
├── /sensors/* (shared topics — both stacks subscribe)
│   ├── /rslidar/points_0 ... /rslidar/points_7
│   ├── /imu/data
│   ├── /gps/fix
│   └── /odom/fused (from shared localization)
│
├── /production/* (current Aurrigo stack)
│   ├── /production/perception/*
│   ├── /production/nav/*
│   └── /production/cmd_twist  (trajectory output)
│
├── /shadow/* (new world model stack)
│   ├── /shadow/bev_encoder/*
│   ├── /shadow/occworld/*
│   ├── /shadow/planner/*
│   └── /shadow/cmd_twist  (trajectory output, NOT connected to actuators)
│
├── /safety_monitor/* (arbitration layer)
│   ├── /safety_monitor/ood_score
│   ├── /safety_monitor/rss_check
│   ├── /safety_monitor/confidence
│   └── /safety_monitor/selected_stack  ("production" or "shadow")
│
└── /vehicle/* (actuator interface — ONLY arbitrator publishes here)
    └── /av_nav/cmd_twist  (gated by arbitrator)
```

### 1.2 Namespace Isolation

```xml
<!-- production_stack.launch -->
<group ns="production">
  <include file="$(find aurrigo_perception)/launch/perception.launch"/>
  <include file="$(find aurrigo_nav)/launch/Navigation.launch"/>
  <!-- Output: /production/av_nav/cmd_twist -->
</group>

<!-- shadow_stack.launch -->
<group ns="shadow">
  <remap from="/pointcloud_aggregator/output" to="/sensors/pointcloud_aggregator/output"/>
  <remap from="/odom/fused" to="/sensors/odom/fused"/>
  <node pkg="world_model_stack" type="bev_encoder_node" name="bev_encoder"/>
  <node pkg="world_model_stack" type="occworld_node" name="occworld"/>
  <node pkg="world_model_stack" type="planner_node" name="planner"/>
  <!-- Output: /shadow/av_nav/cmd_twist — NOT connected to vehicle -->
</group>

<!-- arbitrator.launch -->
<node pkg="safety_monitor" type="arbitrator_node" name="arbitrator">
  <param name="production_topic" value="/production/av_nav/cmd_twist"/>
  <param name="shadow_topic" value="/shadow/av_nav/cmd_twist"/>
  <param name="output_topic" value="/av_nav/cmd_twist"/>  <!-- actual vehicle command -->
  <param name="mode" value="shadow"/>  <!-- shadow | simplex | production_only -->
</node>
```

### 1.3 Arbitrator Node

```python
#!/usr/bin/env python3
"""Simplex arbitrator — selects between production and shadow stacks."""

import rospy
from geometry_msgs.msg import Twist
from std_msgs.msg import String, Float32
from enum import Enum
import time

class ArbState(Enum):
    INITIALIZING = 'initializing'
    PRODUCTION_DRIVING = 'production_driving'
    SHADOW_DRIVING = 'shadow_driving'  # only in simplex mode
    FALLBACK = 'fallback'
    CONTROLLED_STOP = 'controlled_stop'

class ArbitratorNode:
    def __init__(self):
        rospy.init_node('arbitrator')

        self.mode = rospy.get_param('~mode', 'shadow')  # shadow | simplex
        self.promote_threshold_sec = rospy.get_param('~promote_threshold', 2.0)
        self.state = ArbState.INITIALIZING

        # Latest commands from each stack
        self.production_cmd = None
        self.shadow_cmd = None
        self.production_last_time = 0
        self.shadow_last_time = 0

        # Safety scores
        self.ood_score = 1.0  # 1.0 = fully in-distribution
        self.rss_safe = True
        self.confidence = 1.0
        self.shadow_safe_since = None  # timestamp when shadow became continuously safe

        # Subscribers
        rospy.Subscriber('/production/av_nav/cmd_twist', Twist, self.production_cb)
        rospy.Subscriber('/shadow/av_nav/cmd_twist', Twist, self.shadow_cb)
        rospy.Subscriber('/safety_monitor/ood_score', Float32, self.ood_cb)
        rospy.Subscriber('/safety_monitor/rss_safe', String, self.rss_cb)
        rospy.Subscriber('/safety_monitor/confidence', Float32, self.confidence_cb)

        # Publishers
        self.cmd_pub = rospy.Publisher('/av_nav/cmd_twist', Twist, queue_size=1)
        self.state_pub = rospy.Publisher('/arbitrator/state', String, queue_size=1)
        self.log_pub = rospy.Publisher('/arbitrator/decision_log', String, queue_size=10)

        # Main loop at 50Hz (matches control rate)
        self.timer = rospy.Timer(rospy.Duration(0.02), self.arbitrate)

    def arbitrate(self, event):
        now = rospy.Time.now().to_sec()

        # Check production stack health
        production_alive = (now - self.production_last_time) < 0.2  # 200ms timeout
        shadow_alive = (now - self.shadow_last_time) < 0.5  # 500ms timeout (more lenient)

        if not production_alive:
            self.transition(ArbState.CONTROLLED_STOP, 'production stack timeout')
            self.publish_stop()
            return

        # Shadow mode: always drive with production, log shadow decisions
        if self.mode == 'shadow':
            self.cmd_pub.publish(self.production_cmd)
            self.state = ArbState.PRODUCTION_DRIVING
            self.log_comparison()
            return

        # Simplex mode: choose between stacks
        shadow_safe = (
            shadow_alive
            and self.ood_score > 0.7
            and self.rss_safe
            and self.confidence > 0.8
        )

        if self.state == ArbState.PRODUCTION_DRIVING:
            if shadow_safe:
                if self.shadow_safe_since is None:
                    self.shadow_safe_since = now
                elif (now - self.shadow_safe_since) >= self.promote_threshold_sec:
                    self.transition(ArbState.SHADOW_DRIVING, 'shadow promoted (safe for 2s)')
            else:
                self.shadow_safe_since = None

            self.cmd_pub.publish(self.production_cmd)

        elif self.state == ArbState.SHADOW_DRIVING:
            if not shadow_safe:
                self.transition(ArbState.PRODUCTION_DRIVING, f'shadow demoted: ood={self.ood_score:.2f} rss={self.rss_safe} conf={self.confidence:.2f}')
                self.shadow_safe_since = None
                self.cmd_pub.publish(self.production_cmd)  # immediate switch
            else:
                self.cmd_pub.publish(self.shadow_cmd)

        self.state_pub.publish(String(data=self.state.value))

    def transition(self, new_state, reason):
        rospy.loginfo(f'Arbitrator: {self.state.value} → {new_state.value}: {reason}')
        self.log_pub.publish(String(data=f'{rospy.Time.now().to_sec()},{self.state.value},{new_state.value},{reason}'))
        self.state = new_state

    def publish_stop(self):
        stop = Twist()  # zero velocity = stop
        self.cmd_pub.publish(stop)

    def log_comparison(self):
        """Log comparison between production and shadow decisions."""
        if self.production_cmd and self.shadow_cmd:
            vel_diff = abs(self.production_cmd.linear.x - self.shadow_cmd.linear.x)
            steer_diff = abs(self.production_cmd.angular.z - self.shadow_cmd.angular.z)
            if vel_diff > 0.5 or steer_diff > 0.1:  # significant disagreement
                self.log_pub.publish(String(
                    data=f'DISAGREEMENT,vel_diff={vel_diff:.2f},steer_diff={steer_diff:.3f}'
                ))
```

---

## 2. RSS (Responsibility-Sensitive Safety) for Airside

### 2.1 RSS Rules Adapted for Airside

Mobileye's RSS defines 5 rules. Here they are adapted for airport apron:

| RSS Rule | Road Version | Airside Adaptation |
|----------|-------------|-------------------|
| Safe longitudinal distance | Based on response time + max braking | **Longer response time** (0.5s → 1.0s due to hydraulic braking). Lower max decel (2 m/s² for loaded tractor) |
| Safe lateral distance | Min 1m clearance | **Min 2m from aircraft, 1.5m from GSE, 3m from personnel** |
| Right of way | Traffic rules | **Aircraft ALWAYS have priority. Emergency vehicles priority. ATC clearance required for taxiway crossing** |
| Caution around occlusion | Slow at blind corners | **Slow near aircraft noses (hidden personnel), around building corners** |
| Avoid collisions if possible | Brake to avoid | **Always stop when uncertain — airside speed allows it** |

### 2.2 RSS Parameter Configuration

```python
@dataclass
class AirsideRSSParams:
    """RSS parameters for airport airside operation."""

    # Response times (seconds)
    ego_response_time: float = 1.0       # Hydraulic braking delay
    other_response_time: float = 1.5     # Assume slower reaction from others

    # Braking capabilities (m/s²)
    ego_max_decel: float = 2.0           # Loaded baggage tractor
    ego_min_decel: float = 1.0           # Minimum braking (gentle stop)
    other_max_accel: float = 1.5         # GSE acceleration capability
    other_max_decel: float = 2.0         # GSE braking capability

    # Lateral distances (meters)
    min_lateral_aircraft: float = 2.0    # Distance from aircraft
    min_lateral_gse: float = 1.5         # Distance from other GSE
    min_lateral_personnel: float = 3.0   # Distance from ground crew
    min_lateral_structure: float = 1.0   # Distance from buildings/infrastructure

    # Speed limits (m/s)
    max_speed_open_apron: float = 8.3    # 30 km/h
    max_speed_near_aircraft: float = 2.8  # 10 km/h
    max_speed_near_personnel: float = 1.4 # 5 km/h
    max_speed_loading_zone: float = 0.8   # 3 km/h (docking)

def compute_safe_longitudinal_distance(
    ego_vel: float,
    other_vel: float,
    params: AirsideRSSParams
) -> float:
    """RSS safe longitudinal distance."""
    # d_safe = ego_vel * t_response + 0.5 * a_max_accel * t_response²
    #        + (ego_vel + a_max_accel * t_response)² / (2 * ego_min_decel)
    #        - other_vel² / (2 * other_max_decel)

    v_after_response = ego_vel + params.other_max_accel * params.ego_response_time
    d_during_response = ego_vel * params.ego_response_time + \
                        0.5 * params.other_max_accel * params.ego_response_time ** 2
    d_braking = v_after_response ** 2 / (2 * params.ego_min_decel)
    d_other_braking = other_vel ** 2 / (2 * params.other_max_decel)

    return max(0, d_during_response + d_braking - d_other_braking)
```

### 2.3 RSS Trajectory Check

```python
def check_trajectory_rss(
    trajectory: np.ndarray,        # (T, 3) — x, y, yaw at each timestep
    predicted_occupancy: np.ndarray,  # (T, H, W, D) — from world model
    objects: List[Dict],            # detected objects with velocity
    params: AirsideRSSParams,
) -> Tuple[bool, str]:
    """Check if a trajectory satisfies RSS constraints."""

    for t in range(len(trajectory)):
        ego_pos = trajectory[t, :2]
        ego_yaw = trajectory[t, 2]

        for obj in objects:
            obj_pos = obj['predicted_position'][t]  # from world model
            obj_vel = obj['velocity']
            obj_class = obj['class']

            # Lateral distance check
            lateral_dist = compute_lateral_distance(ego_pos, ego_yaw, obj_pos)
            min_lateral = {
                'aircraft': params.min_lateral_aircraft,
                'ground_crew': params.min_lateral_personnel,
            }.get(obj_class, params.min_lateral_gse)

            if lateral_dist < min_lateral:
                return False, f'RSS lateral violation: {obj_class} at {lateral_dist:.1f}m (min {min_lateral}m) at t={t}'

            # Longitudinal distance check
            longitudinal_dist = compute_longitudinal_distance(ego_pos, ego_yaw, obj_pos)
            safe_dist = compute_safe_longitudinal_distance(
                ego_vel=np.linalg.norm(trajectory[t] - trajectory[max(0,t-1)]) / dt,
                other_vel=np.linalg.norm(obj_vel),
                params=params
            )

            if longitudinal_dist < safe_dist:
                return False, f'RSS longitudinal violation: {obj_class} at {longitudinal_dist:.1f}m (safe {safe_dist:.1f}m) at t={t}'

        # Occupancy collision check
        swept_volume = compute_vehicle_footprint(ego_pos, ego_yaw)
        if check_occupancy_collision(swept_volume, predicted_occupancy[t]):
            return False, f'Occupancy collision predicted at t={t}'

    return True, 'RSS satisfied'
```

---

## 3. OOD Detection

### 3.1 Ensemble Disagreement

```python
class OODDetector:
    def __init__(self, world_model, n_heads: int = 3):
        """
        Lightweight OOD detection via multiple prediction heads.
        Instead of N full models, use N prediction heads on shared backbone.
        """
        self.backbone = world_model.backbone  # shared
        self.heads = nn.ModuleList([
            copy.deepcopy(world_model.prediction_head) for _ in range(n_heads)
        ])

    def compute_ood_score(self, bev_features: torch.Tensor) -> float:
        """Return OOD score: 1.0 = in-distribution, 0.0 = out-of-distribution."""
        backbone_features = self.backbone(bev_features)

        predictions = []
        for head in self.heads:
            pred = head(backbone_features)
            predictions.append(pred)

        # Ensemble disagreement (lower disagreement = more in-distribution)
        stacked = torch.stack(predictions)  # (N, B, C, H, W)
        variance = stacked.var(dim=0).mean()  # mean variance across heads

        # Normalize to [0, 1] — calibrate these thresholds on validation data
        ood_score = 1.0 - torch.clamp(variance / self.variance_threshold, 0, 1)
        return ood_score.item()
```

### 3.2 VQ-VAE Reconstruction Error

```python
def compute_reconstruction_ood(vqvae, bev_features):
    """Use VQ-VAE reconstruction error as OOD signal."""
    # Encode
    tokens, indices = vqvae.encode(bev_features)
    # Decode
    reconstructed = vqvae.decode(tokens)
    # Reconstruction error
    recon_error = F.mse_loss(reconstructed, bev_features)

    # High error = OOD (scene doesn't match codebook well)
    # Calibrate threshold on in-distribution validation set
    return recon_error.item()
```

---

## 4. Shadow Mode Data Collection

### 4.1 What to Log

```python
class ShadowModeLogger:
    def __init__(self):
        self.bag_writer = rosbag.Bag('shadow_mode.bag', 'w')

    def log_frame(self, timestamp):
        """Log complete shadow mode frame for analysis."""
        # Always log
        self.log_topic('/shadow/cmd_twist', self.shadow_cmd)
        self.log_topic('/production/cmd_twist', self.production_cmd)
        self.log_topic('/arbitrator/state', self.arb_state)

        # Log on disagreement only (saves space)
        if self.is_disagreement():
            self.log_topic('/shadow/occworld/prediction', self.occ_prediction)
            self.log_topic('/shadow/bev_encoder/features', self.bev_features)
            self.log_topic('/safety_monitor/ood_score', self.ood_score)
            self.log_topic('/sensors/pointcloud', self.pointcloud)
            self.log_topic('/sensors/odom', self.odom)

    def is_disagreement(self) -> bool:
        """Detect significant disagreement between stacks."""
        if self.shadow_cmd is None or self.production_cmd is None:
            return False
        vel_diff = abs(self.shadow_cmd.linear.x - self.production_cmd.linear.x)
        steer_diff = abs(self.shadow_cmd.angular.z - self.production_cmd.angular.z)
        return vel_diff > 0.5 or steer_diff > 0.1
```

### 4.2 Analysis Dashboard Metrics

| Metric | Computation | Target |
|--------|-------------|--------|
| Decision agreement rate | % of frames where shadow ≈ production | >90% before simplex mode |
| Mean trajectory divergence | L2 distance between planned paths | <0.5m |
| Intervention prediction | When shadow would brake and production doesn't | Investigate all |
| OOD rate | % of frames with OOD score < 0.7 | <5% |
| World model prediction error | Predicted vs. actual occupancy IoU | >0.5 (Phase 1) |
| Shadow latency | Sensor-to-decision pipeline time | <200ms |
| GPU utilization | Shadow stack GPU % | <60% (leave headroom for production) |

### 4.3 Graduated Trust Transfer

```
Month 1-3: SHADOW MODE
  └── Shadow runs, production drives, log everything
  └── Analyze disagreements, fix world model issues
  └── Target: >85% agreement rate

Month 3-6: SUPERVISED SIMPLEX
  └── Shadow drives in easy scenarios (straight paths, no obstacles)
  └── Production drives in complex scenarios
  └── Human supervisor monitors with kill switch
  └── Target: >95% agreement, zero safety violations in sim

Month 6-12: FULL SIMPLEX
  └── Shadow drives by default
  └── Automatic fallback to production when confidence drops
  └── Target: >99% shadow driving time, <0.1% collision rate in sim

Month 12+: SHADOW BECOMES PRIMARY
  └── Rename: shadow → primary, production → fallback
  └── Fallback only activates on safety monitor trigger
```

---

## 5. Resource Management

### 5.1 GPU Sharing Between Stacks

```yaml
# nvidia-container-runtime config or manual GPU allocation

# Option A: Separate GPU processes with MPS
# NVIDIA Multi-Process Service allows GPU sharing
nvidia-cuda-mps-control -d  # start MPS daemon

# Option B: Time-sliced sharing
# Production stack: 60% GPU time (priority)
# Shadow stack: 40% GPU time (best-effort)

# Option C: Dual GPU (if hardware allows)
# GPU 0: Production stack (localization VGICP + perception)
# GPU 1: Shadow stack (BEV encoder + world model)
```

### 5.2 CPU Allocation

```bash
# Use cgroups or taskset for CPU affinity
# Production stack: cores 0-5 (guaranteed)
taskset -c 0-5 roslaunch production_stack.launch

# Shadow stack: cores 6-11 (best-effort)
taskset -c 6-11 roslaunch shadow_stack.launch

# Arbitrator: core 0 (shared with production, lightweight)
```

---

## Sources

- [Simplex Architecture (Sha et al., 2001)](https://ieeexplore.ieee.org/document/929752)
- [RSS (Mobileye)](https://www.mobileye.com/responsibility-sensitive-safety/)
- [Intel RSS Library](https://github.com/intel/ad-rss-lib)
- [CARLA RSS Integration](https://carla.readthedocs.io/en/latest/adv_rss/)
- [SafeDreamer (ICLR 2024)](https://arxiv.org/abs/2307.07176)
- [Fernride Teleoperation](https://fernride.com/)
